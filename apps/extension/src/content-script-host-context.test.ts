/**
 * The content script's second job — naming the host it is beside.
 *
 * **The property under test is a restriction, so most of these cases are about what the handler does
 * NOT do.** `in-page-integration` requires it to answer with `location.hostname` and *no other part
 * of the page's location*, to read nothing from the DOM, and to refuse rather than answer with a
 * value it did not read. A case that only asserted the happy path would pass against a handler that
 * reported `location.href`.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";

import { startInPageHostContext } from "./content-script/host-context";
import {
  CREATE_MAILBOX_REQUEST,
  fillCodeRequest,
  HOST_CONTEXT_REQUEST,
  RECONCILE_ALARM_REQUEST,
} from "./protocol";

/**
 * A location that records every property read, and **throws on any but `hostname`.**
 *
 * **This is the instrument that makes "and nothing more of the page" falsifiable.** A case that
 * asserts the answer equals the hostname would also pass against a handler returning `location.href`
 * — `href` *contains* the hostname — so the whole page would be reported and the suite green. A
 * location that refuses every other property makes that handler **throw** instead, and a handler
 * that caught the throw and answered nothing would be caught by the assertion on the answer.
 */
function recordingLocation(hostname: string): {
  readonly pageLocation: Pick<Location, "hostname">;
  readonly reads: string[];
} {
  const reads: string[] = [];

  const pageLocation = new Proxy(
    { hostname },
    {
      get(target, property) {
        if (typeof property === "symbol") {
          return Reflect.get(target, property);
        }

        reads.push(property);

        if (property !== "hostname") {
          throw new Error(`the handler read location.${property}, which no answer may carry`);
        }

        return target.hostname;
      },
      has(target, property) {
        reads.push(String(property));
        return Reflect.has(target, property);
      },
    },
  ) as Pick<Location, "hostname">;

  return { pageLocation, reads };
}

describe("the content script naming the page it is beside", () => {
  it("answers the host request with its own location's hostname", async () => {
    const { pageLocation: location } = recordingLocation("signup.example.test");

    await expect(
      startInPageHostContext({ pageLocation: location }).handle(HOST_CONTEXT_REQUEST),
    ).resolves.toEqual({
      kind: "host",
      host: "signup.example.test",
    });
  });

  it("reads hostname and no other part of the location", async () => {
    // **The assertion the proxy exists to make possible.** `href`, `pathname`, `search` and `origin`
    // would all *contain* the hostname, so an equality check on the answer cannot tell a hostname
    // from a URL — and **a signup page's query string is where that page's tokens are**, so this is
    // the difference between a panel naming a site and a panel holding a signup token per page.
    const { pageLocation: location, reads } = recordingLocation("signup.example.test");

    await startInPageHostContext({ pageLocation: location }).handle(HOST_CONTEXT_REQUEST);

    expect(reads).toEqual(["hostname"]);
  });

  it("answers a hostname verbatim, with no folding, trimming or case change", async () => {
    // **`site-associations` keys by the exact hostname with no registrable-domain folding**, so a
    // normalised host would name a key the association map has no record of — which reads as "no
    // mailbox was used here" on a host that had one.
    const { pageLocation: location } = recordingLocation("Signup.Example.TEST");

    await expect(
      startInPageHostContext({ pageLocation: location }).handle(HOST_CONTEXT_REQUEST),
    ).resolves.toEqual({
      kind: "host",
      host: "Signup.Example.TEST",
    });
  });

  it.each([
    ["a document with no host at all", ""],
    ["a page whose location gave nothing", undefined],
    ["a location that is not an object", null],
  ])(
    "refuses rather than answering with a value it did not read, for %s",
    async (_label, hostname) => {
      // **The case `tasks.md` 3.3 asks for.** The empty hostname is the trap: it is a string, it is
      // what `about:blank` really has, and a panel handed `""` would be holding a *host* it could
      // not display — while the requirement says a request it cannot answer SHALL be refused.
      const location = { hostname } as unknown as Pick<Location, "hostname">;

      await expect(
        startInPageHostContext({ pageLocation: location }).handle(HOST_CONTEXT_REQUEST),
      ).resolves.toEqual({
        kind: "unconfirmed",
      });
    },
  );

  it("refuses rather than answering a request that is not this one", async () => {
    // **Every other kind travelling the same channel.** The creation request and the fill request
    // both reach this script's listener, and answering either of them with a hostname would be this
    // script responding to a question nobody asked - which is the same defect `fill.ts`'s handler
    // documents at its own narrower.
    //
    // **`notActedOn` and not `undefined`.** The composed listener in `composeMessageHandlers` takes
    // the first non-refusal answer as the winner, and `undefined` is not a refusal - so a handler
    // returning it would be handed straight back as the answer to every kind it was never asked.
    // `content-script-handlers.test.ts` found that by composing the two *shipped* handlers rather
    // than stand-ins.
    const { pageLocation: location, reads } = recordingLocation("signup.example.test");
    const { handle } = startInPageHostContext({ pageLocation: location });

    for (const request of [
      CREATE_MAILBOX_REQUEST,
      RECONCILE_ALARM_REQUEST,
      fillCodeRequest("493028"),
      { kind: "someone-else:something" },
      { page: 1 },
      "a bare string",
      42,
      undefined,
      null,
    ]) {
      await expect(handle(request)).resolves.toEqual({ kind: "notActedOn" });
    }

    // **And it read nothing at all while refusing them.** A handler that narrowed *after* reading
    // the location would answer correctly and leak the host of a page that asked nothing.
    expect(reads).toEqual([]);
  });

  it("is given no document, so reading the page's DOM is not possible here", () => {
    // **The structural half of the requirement, and the reason the option type is
    // `Pick<Location, "hostname">` and not `Location`.** "Reads no property of the page's DOM" is
    // asserted by the proxy case above; this says the document is not even in scope, so a future
    // answer that wanted a path would have to change this signature — a reviewable edit — rather
    // than reading one more property.
    const { pageLocation: location } = recordingLocation("signup.example.test");

    expect(Object.keys(startInPageHostContext({ pageLocation: location }))).toEqual(["handle"]);
    expect(startInPageHostContext({ pageLocation: location }).handle).toHaveLength(1);
  });

  it("answers with the location's host even when the page's own content names a different one", async () => {
    // **The case `tasks.md` 3.2 asks for by name: a page whose `location` is distinguishable from
    // its DOM content.** Two sources could answer a host request, and they are indistinguishable
    // unless the test puts a *different* value in each - so the DOM here is planted with a hostname
    // that is not this document's host, and the answer is required to be the location's.
    //
    // **Why a competing value is the whole instrument.** A handler reading `document.title` or a
    // `<meta>` tag would return `decoy.example.test` here and the assertion would fail. A handler
    // reading nothing at all would return nothing and the earlier cases would catch it. Only a
    // handler reading the browser's own `location` passes, and it passes because it is the location
    // and not because no competing source existed.
    const { pageLocation: location } = recordingLocation("location.example.test");

    const decoy = document.createElement("meta");
    decoy.setAttribute("name", "host");
    decoy.setAttribute("content", "decoy.example.test");
    document.head.appendChild(decoy);

    const heading = document.createElement("h1");
    heading.textContent = "decoy.example.test signup";
    document.body.appendChild(heading);

    try {
      await expect(
        startInPageHostContext({ pageLocation: location }).handle(HOST_CONTEXT_REQUEST),
      ).resolves.toEqual({
        kind: "host",
        host: "location.example.test",
      });

      // **And the planted content really is distinguishable from the answer**, so the case above is
      // not satisfied by a fixture where both sources happened to agree. Read back **out of the DOM**,
      // and out of the right place: a `<meta>`'s content is an *attribute* and contributes nothing to
      // `head.textContent`, which is empty here by construction - so the first version of this
      // readback asserted against a string the fixture had never put anything into.
      expect(decoy.getAttribute("content")).toBe("decoy.example.test");
      expect(document.body.textContent).toContain("decoy.example.test");
      expect("location.example.test").not.toBe("decoy.example.test");
    } finally {
      decoy.remove();
      heading.remove();
    }
  });

  it("does not touch the document this module is running inside", async () => {
    // **A page that observes nothing is still answered**, and the plant is what makes that a
    // measurement rather than a claim: the document's `title`, `domain` and every element are
    // poisoned, and a handler reaching for any of them throws.
    const { pageLocation: location } = recordingLocation("signup.example.test");

    const poison = () => {
      throw new Error("the handler read the page's DOM to answer a host request");
    };
    const descriptor = { get: poison, configurable: true } as PropertyDescriptor;

    Object.defineProperty(document, "title", descriptor);
    Object.defineProperty(document, "domain", descriptor);
    Object.defineProperty(document, "cookie", descriptor);
    Object.defineProperty(document.documentElement, "dataset", {
      get: poison,
      configurable: true,
    } as PropertyDescriptor);

    try {
      await expect(
        startInPageHostContext({ pageLocation: location }).handle(HOST_CONTEXT_REQUEST),
      ).resolves.toEqual({ kind: "host", host: "signup.example.test" });
    } finally {
      for (const target of [document, document.documentElement]) {
        for (const property of ["title", "domain", "cookie", "dataset"]) {
          delete (target as unknown as Record<string, unknown>)[property];
        }
      }
    }
  });

  it("dispatches no event into the page to answer", async () => {
    // **The clause the poisoning above cannot carry.**
    //
    // `document.title`, `document.domain`, `document.cookie` and `documentElement.dataset` were
    // poisoned, and that catches *reading* the page. Dispatching is a different act and takes a
    // different route entirely.
    //
    // **Why the instrument patches `dispatchEvent` rather than listening for an event.**
    //
    // **Two listeners were tried first and both were wrong**, and the second one was wrong in the
    // direction that looks like a repair:
    //
    // 1. **One capture-phase listener on `window`.** That covers every event dispatched *from an
    //    element* in this document, and it covers a non-bubbling one — the capture path runs
    //    `window` → `document` regardless of the bubble flag, which is exactly why a bubble-phase
    //    listener would have missed `focus`, `blur`, `load` and every `mouseenter`.
    // 2. **A second capture-phase listener on `document`.** This was added because a mutation
    //    dispatched `new Event("spectre-host-read")` at `document` and the case stayed green.
    //
    // **Neither could ever catch that mutation, and adding the second one did not catch it either.**
    // Both listeners were registered for one hard-coded type, `spectre-host-context-probe`, and the
    // mutation dispatched a *different* type — so the instrument was reporting *"the page dispatched
    // no event of the one type I happened to name"*, while its title claimed **no event at all**.
    // **That is the fifth recorded instance of the same shape, and the first one in a case whose
    // entire subject is being an instrument.** The first repair also broke the case's own positive
    // control, because a document-targeted dispatch is seen by *both* listeners and was recorded
    // twice — so the arm aimed at this case was "caught" by the broken control and not by the
    // mutation. **A catcher that was failing before the mutation is not a catcher.**
    //
    // **Patching the method itself is the only reader that matches the claim**, because the claim is
    // about *every* type rather than about a list someone wrote down.
    const dispatched: string[] = [];
    const realDispatchEvent = EventTarget.prototype.dispatchEvent;
    const realWindowDispatchEvent = window.dispatchEvent;

    EventTarget.prototype.dispatchEvent = function patched(
      this: EventTarget,
      event: Event,
    ): boolean {
      dispatched.push(event.type);

      return realDispatchEvent.call(this, event);
    };

    /**
     * **`window` is patched too, and its own property is the reason.** In jsdom `window` carries an
     * **own** `dispatchEvent`, so it does not resolve to `EventTarget.prototype`'s — the first run
     * of this case recorded the document probe and the element probe and **silently lost the window
     * one**, which is the control reporting a route it claims to cover while observing nothing there.
     * **The reader patched the prototype and a route silently fell through it.**
     */
    window.dispatchEvent = function patchedWindow(this: Window, event: Event): boolean {
      dispatched.push(event.type);

      return realWindowDispatchEvent.call(this, event);
    };

    try {
      const { pageLocation: location } = recordingLocation("signup.example.test");

      await expect(
        startInPageHostContext({ pageLocation: location }).handle(HOST_CONTEXT_REQUEST),
      ).resolves.toEqual({ kind: "host", host: "signup.example.test" });

      expect(dispatched, "answering a host request dispatched nothing into the page").toEqual([]);

      /**
       * **The positive control, one probe per route and each one asserted on its own.**
       *
       * A reader that reports nothing because it was not reading satisfies the assertion above for
       * ever, so the control has to prove the reader reads. **Three routes, three distinct types**,
       * because a reader keyed on one type proves only that it reads that type — which is the defect
       * the first two versions of this instrument had.
       */
      window.dispatchEvent(new Event("spectre-probe-at-window"));
      document.dispatchEvent(new Event("spectre-probe-at-document"));
      document
        .createElement("div")
        .dispatchEvent(new CustomEvent("spectre-probe-from-an-element", { bubbles: true }));

      expect(dispatched).toEqual([
        "spectre-probe-at-window",
        "spectre-probe-at-document",
        "spectre-probe-from-an-element",
      ]);
    } finally {
      // **Restoring is asserted, not assumed** — a patched prototype or a patched `window` left in
      // place would make every later case in this file report dispatches it never made, which is the
      // same class of defect as a listener left attached.
      EventTarget.prototype.dispatchEvent = realDispatchEvent;
      window.dispatchEvent = realWindowDispatchEvent;
    }

    const afterRestore: string[] = [];

    EventTarget.prototype.dispatchEvent = function recording(
      this: EventTarget,
      event: Event,
    ): boolean {
      afterRestore.push(event.type);

      return realDispatchEvent.call(this, event);
    };

    document.dispatchEvent(new Event("spectre-probe-after-restore"));
    EventTarget.prototype.dispatchEvent = realDispatchEvent;

    expect(
      afterRestore,
      "the patched reader recorded nothing after a probe, so the control above proved nothing",
    ).toEqual(["spectre-probe-after-restore"]);
  });

  it("registers no listener of its own, so entry.ts keeps owning when it attaches", async () => {
    // **Registration and behaviour are separated, as they are for the fill handler and the
    // insertion controller** - and this is the case that holds it.
    //
    // **The instrument is a real listener registration, not an unused spy.** The previous version of
    // this case built a `vi.fn()`, never wired it to anything, and asserted it had not been called -
    // which any module at all would satisfy, including one that registered a listener on first import.
    // `extension-platform.ts` reads the global reflectively *at call time*
    // (`Reflect.get(globalThis, "chrome")`), so installing a `chrome` with a counting
    // `runtime.onMessage.addListener` observes an actual registration rather than standing in for
    // one.
    //
    // **What this holds.** Chromium takes the FIRST listener to respond and closes the channel for
    // the rest, and the fill handler answers `notActedOn` to every kind it does not recognise - which
    // is what a host request is to it. So a module that attached its own listener would answer every
    // host request `notActedOn`, deterministically, with a green suite throughout.
    // **Both `addListener` and `removeListener`, because `readMessaging()` builds its `listen` only
    // when both are functions.** A plant carrying `addListener` alone would leave `listen`
    // `undefined`, `onExtensionMessage` would return its no-op, and this counter would stay empty
    // **whether or not a listener was registered** - which is the recorded defect of an instrument
    // that measures less than the sentence beside it, in the direction that reads as a pass.
    const registrations: unknown[] = [];

    Reflect.set(globalThis, "chrome", {
      runtime: {
        onMessage: {
          addListener: (listener: unknown) => {
            registrations.push(listener);
          },
          removeListener: (listener: unknown) => {
            const at = registrations.indexOf(listener);
            if (at !== -1) {
              registrations.splice(at, 1);
            }
          },
        },
      },
    });

    try {
      const { pageLocation: location } = recordingLocation("a.example.test");
      const { handle } = startInPageHostContext({ pageLocation: location });

      // **Called as well as constructed,** because a module could legitimately register lazily on
      // first request - and that is exactly the shape that would race the fill handler.
      await handle(HOST_CONTEXT_REQUEST);

      expect(registrations).toEqual([]);
    } finally {
      Reflect.deleteProperty(globalThis, "chrome");
    }
  });
});
