/**
 * One message channel, several handlers, exactly one answer.
 *
 * **What is under test is a decision table, and the table is the defect this module exists to
 * prevent.** Chromium takes the **first** listener to call `sendResponse` and closes the channel for
 * the rest, and `fill.ts`'s handler answers `notActedOn` to every kind it does not recognise - which
 * is exactly what a host request is to it. So had this been a second `onExtensionMessage`
 * registration, **every host request would have been answered `notActedOn`, deterministically, with a
 * green suite throughout.**
 *
 * **The cases below are therefore about refusal, not about success.** A composition that returned the
 * *first* answer regardless of what it was would satisfy every "answers X" case and fail this
 * milestone's actual requirement, which is that a refused kind falls through to the handler that acts
 * on it.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";

import { startInPageFill } from "./content-script/fill";
import { composeMessageHandlers } from "./content-script/handlers";
import { startInPageHostContext } from "./content-script/host-context";
import { CREATE_MAILBOX_REQUEST, HOST_CONTEXT_REQUEST } from "./protocol";

/** A handler that refuses everything, which is what every kind-unaware handler does. */
const refusesEverything = async (): Promise<unknown> => ({ kind: "notActedOn" });

describe("one message channel, several handlers", () => {
  it("returns the first handler's answer when that handler acts on the request", async () => {
    // **The positive control for every case below.** Without it, a composition that answered
    // `notActedOn` unconditionally would satisfy the whole file.
    const composed = composeMessageHandlers(async () => ({ kind: "filled" }));

    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toEqual({ kind: "filled" });
  });

  it("skips a refusing handler and reaches the one that acts", async () => {
    // **The case the module exists for.** The fill handler refuses a host request; the host handler
    // answers it. A composition returning the first answer outright would answer `notActedOn`.
    const composed = composeMessageHandlers(refusesEverything, async () => ({
      kind: "host",
      host: "signup.example.test",
    }));

    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toEqual({
      kind: "host",
      host: "signup.example.test",
    });
  });

  it("tries handlers in the order given, not in registration order", async () => {
    // **Order is a caller decision and it is an argument rather than an accident.** Two handlers that
    // both act on the same request must see the caller's order, or `entry.ts` could not put fill
    // first - which is what keeps a fill request from ever reading `location` on a stranger's page.
    const first: string[] = [];
    const second: string[] = [];

    const composed = composeMessageHandlers(
      async () => {
        first.push("fill");
        return { kind: "notActedOn" };
      },
      async () => {
        second.push("host");
        return { kind: "host", host: "signup.example.test" };
      },
    );

    await composed(HOST_CONTEXT_REQUEST);

    expect(first).toEqual(["fill"]);
    expect(second).toEqual(["host"]);
  });

  it("answers notActedOn when no handler acts, rather than the last handler's answer", async () => {
    // **The composed answer is its own, not whichever handler happened to be last.** A composition
    // that returned the final handler's refusal would be right here by accident and wrong as soon as
    // a third handler answered something unrecognised - which is the drift this module documents.
    const composed = composeMessageHandlers(refusesEverything, refusesEverything);

    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toEqual({ kind: "notActedOn" });
  });

  it("treats a handler that throws as a refusal and carries on", async () => {
    // **An exception escaping into a document keypress handler on somebody else's page is what
    // `onExtensionMessage` already collapses**, and a composition layer that re-introduced it would
    // undo that for every handler at once. It must not become the answer either.
    const composed = composeMessageHandlers(
      async () => {
        throw new Error("the fill handler failed on a page it does not understand");
      },
      async () => ({ kind: "host", host: "signup.example.test" }),
    );

    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toEqual({
      kind: "host",
      host: "signup.example.test",
    });
  });

  it("answers notActedOn when the only handler throws", async () => {
    // **The other half of the same claim**: a throwing handler must not become the answer by being
    // the last one tried.
    const composed = composeMessageHandlers(async () => {
      throw new Error("the only handler failed");
    });

    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toEqual({ kind: "notActedOn" });
  });

  it("takes an answer of undefined as an answer, not as a refusal", async () => {
    // **The polarity of this composition, and the reason `isRefusal` reads a discriminant rather
    // than checking for a shape.** The host handler returns `undefined` for a request that is not a
    // host request - deliberately, so "not a request this module acts on" stays distinguishable from
    // "I could not name it". **If `undefined` were read as a refusal the composition would behave
    // correctly here by accident**, and a handler returning `undefined` by mistake would silently
    // become the winner for requests it was never asked.
    //
    // The value is reported rather than discarded, because **an answer this module cannot classify is
    // not silently dropped** - and the case is written to fail loudly if that ever changes.
    const composed = composeMessageHandlers(async () => undefined);

    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toBeUndefined();
  });

  it("keeps an unrecognised answer shape rather than discarding it as a refusal", async () => {
    // **Refusing to guess which shape meant "not mine"** is what keeps a malformed answer from being
    // read as a refusal and dropped without trace. A shape with no `kind` is therefore an answer.
    const malformed = { somethingElse: true };
    const composed = composeMessageHandlers(async () => malformed);

    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toBe(malformed);
  });

  it("composes the shipped fill handler with the shipped host handler", async () => {
    // **The arrangement `entry.ts` actually registers, driven through the real handlers.** A pair of
    // cases against `composeMessageHandlers` with stand-ins would pass against a composition whose
    // refusal convention disagreed with the two handlers it composes - and that disagreement is the
    // whole failure this module records, so the case uses the shipped modules themselves.
    const composed = composeMessageHandlers(
      startInPageFill({ document, view: window }).handle,
      startInPageHostContext({ pageLocation: window.location }).handle,
    );

    // **The host request, which the real fill handler refuses** - `fill.ts` narrows on its own
    // discriminant and answers `notActedOn` to everything else, which is the refusal the whole
    // composition is built around.
    await expect(composed(HOST_CONTEXT_REQUEST)).resolves.toEqual({
      kind: "host",
      host: window.location.hostname,
    });

    // **And a creation request, which both shipped handlers refuse** - so composing them did not make
    // this module answer everything that arrives.
    await expect(composed(CREATE_MAILBOX_REQUEST)).resolves.toEqual({
      kind: "notActedOn",
    });

    // **And an outright unrecognised message**, which is the shape every extension message the
    // browser routes here can take.
    await expect(composed({ kind: "someone-else:something" })).resolves.toEqual({
      kind: "notActedOn",
    });
  });

  it("answers notActedOn for an unrecognised message when no handler is composed", async () => {
    // **The empty composition.** `entry.ts` always passes two, so this shape cannot arise from a
    // shipped call site - and a composition that answered `undefined` for it would leave the channel
    // open rather than refused, which is a different fact from "nothing here acts on this".
    const composed = composeMessageHandlers();

    await expect(composed({ kind: "spectre:anything" })).resolves.toEqual({ kind: "notActedOn" });
  });
});
