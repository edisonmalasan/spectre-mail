/**
 * What the website renders, in each state.
 *
 * These assertions are about what a user can perceive, which is why they run
 * against a real render in jsdom rather than against a description of one. A test
 * that checked a component's return value would pass unchanged if the component
 * stopped rendering at all.
 *
 * Every state is asserted by its **words**. Nothing here depends on colour or on a
 * stylesheet, so a failure means the content is missing rather than merely
 * unstyled.
 *
 * @module
 */

// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, SpectreError } from "@spectre-mail/core";
import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxScheduler } from "@spectre-mail/mailbox";
import { createProviderManager } from "@spectre-mail/providers";
import type { MailProvider } from "@spectre-mail/providers";

import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A mailbox at a reserved `.example` domain, so no test address is ever real. */
function mailbox(id: string, expiresAt?: number): Mailbox {
  return {
    id,
    provider: "guerrilla",
    address: `${id}@mail.example`,
    createdAt: Date.parse("2026-10-02T12:00:00.000Z"),
    ...(expiresAt === undefined ? {} : { expiresAt }),
    status: "active",
    credentials: { provider: "guerrilla", sessionId: `session-${id}` },
  };
}

function providerReturning(over: {
  mailbox?: Mailbox;
  failWith?: SpectreError;
  create?: () => Promise<Mailbox>;
}): MailProvider {
  return {
    id: "guerrilla",
    displayName: "Guerrilla Mail",
    supports: () => false,
    checkHealth: () => Promise.resolve({ provider: "guerrilla", status: "ok" }),
    // Typed `Promise<Mailbox>` even where it rejects, so a scripted failure and a
    // scripted success are the same shape. A `Promise<never>` here would be a lie
    // about the contract the provider manager sees.
    createMailbox:
      over.create ??
      (() =>
        over.failWith !== undefined
          ? Promise.reject(over.failWith)
          : Promise.resolve(over.mailbox ?? mailbox("guerrilla-1"))),
    listMessages: () => Promise.resolve([]),
    getMessage: () => Promise.reject(new Error("unused")),
  };
}

/**
 * A provider call that fails with `error`.
 *
 * Typed as the call's declared return rather than as `Promise<SpectreError>`:
 * `Promise.reject(x)` is a `Promise<never>`, which is assignable to anything, so
 * the failure is reachable through the same `() => Promise<Mailbox>` signature a
 * success takes. A provider is not a different type of thing when it refuses.
 */
function refuses(error: SpectreError): Promise<Mailbox> {
  return Promise.reject(error);
}

/**
 * A scheduler that records what it was asked for and runs nothing.
 *
 * **Used everywhere in this file on purpose.** A real timer would mean a page under
 * test silently continued to poll after the assertion finished, and the only symptom
 * would be a provider call arriving at some unrelated moment. Recording the delays
 * also lets the visibility test assert what the page asked the session to do without
 * waiting for it.
 */
function inertScheduler(): MailboxScheduler & { readonly scheduled: readonly number[] } {
  const delays: number[] = [];

  return {
    // A copy on every read, so a test that captures it before an action and compares
    // it after is not holding a live array the action appends to.
    get scheduled(): readonly number[] {
      return [...delays];
    },
    // The callback is deliberately not stored and never called. Kept as a named
    // parameter rather than omitted so the signature still matches `schedule`'s.
    schedule(afterMs, run) {
      void run;
      delays.push(afterMs);
      return () => undefined;
    },
  };
}

function sessionOver(provider: MailProvider, scheduler: MailboxScheduler = inertScheduler()) {
  return createMailboxSession(createProviderManager([provider]), scheduler);
}

/** Every character of visible text on the page. */
function visibleText(): string {
  return document.body.textContent ?? "";
}

describe("the website", () => {
  describe("while creating", () => {
    it("says it is creating, and shows no address of any kind", async () => {
      let release: (value: Mailbox) => void = () => undefined;
      const pending = new Promise<Mailbox>((resolve) => {
        release = resolve;
      });
      const session = sessionOver(providerReturning({ create: () => pending.then((m) => m) }));

      render(<App session={session} />);

      // The creating state must be reachable and say what it is doing.
      expect(screen.getByTestId("creating")).toBeTruthy();
      expect(visibleText()).toContain("Asking Guerrilla Mail for a new address.");

      // **No address**, and specifically nothing shaped like one. A placeholder, an
      // example, or an empty input would all be read as a real address by anything
      // parsing the page, and a user could type a signup form into it.
      expect(document.querySelector("input")).toBeNull();
      expect(visibleText()).not.toContain("@");
      expect(visibleText()).not.toContain("mail.example");

      await act(async () => {
        release(mailbox("guerrilla-1"));
        await pending;
      });
    });

    it("renders no address while a second address is being created", async () => {
      // The positive control for the above: the page *can* show an address, so its
      // absence during creation is a decision rather than a page that never had one.
      let release: (value: Mailbox) => void = () => undefined;
      const pending = new Promise<Mailbox>((resolve) => {
        release = resolve;
      });
      let call = 0;
      const session = sessionOver(
        providerReturning({
          create: () => {
            call += 1;
            return call === 1 ? Promise.resolve(mailbox("guerrilla-1")) : pending;
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("ready");
      expect(visibleText()).toContain("guerrilla-1@mail.example");

      await act(async () => {
        screen.getByRole("button", { name: /replace address/i }).click();
      });

      // The old address is gone while the new one is in flight. Keeping it on screen
      // would be a lie about which address the user currently holds.
      expect(screen.queryByTestId("ready")).toBeNull();
      expect(visibleText()).not.toContain("guerrilla-1@mail.example");

      await act(async () => {
        release(mailbox("guerrilla-2"));
        await pending;
      });
      expect(visibleText()).toContain("guerrilla-2@mail.example");
    });
  });

  describe("when ready", () => {
    it("presents the address as selectable text", async () => {
      const session = sessionOver(providerReturning({ mailbox: mailbox("guerrilla-1") }));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      // The address is a text node, not an input value and not an image, so it can
      // be selected by hand and announced by a screen reader without a special case.
      const address = screen.getByTestId("address");
      expect(address.textContent).toContain("guerrilla-1@mail.example");
      expect(address.querySelector("input")).toBeNull();
      expect(address.querySelector("img")).toBeNull();

      // **The element's own text is the address, and nothing else.** Announcing it
      // reads whatever is in the node, so a stray "New address" label or a
      // placeholder inside the same element would be read out as part of the address
      // — which is the failure a visual check cannot see and a `querySelector` for
      // two tag names cannot either.
      //
      // **This assertion used to be a tautology.** It read
      // `expect(x.trim()).toBe(x.trim())` — `x === x`, which cannot fail, while
      // reading as though it checked for surrounding whitespace. It was the *only*
      // coverage for the requirement that the address be exposed as text, so the
      // scenario's evidence passed with the behaviour removed. An assertion that
      // cannot fail is not weak evidence; it is none.
      expect(address.textContent).toBe("guerrilla-1@mail.example");
    });

    it("names the copy action for what it copies", async () => {
      const session = sessionOver(providerReturning({}));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      // "Copy address", not "Copy" and not an icon. The requirement is that the
      // action's name says what it copies, and a bare "Copy" on a page with one
      // address would read as copying the page.
      expect(screen.getByRole("button", { name: "Copy address" })).toBeTruthy();
    });

    it("confirms a successful copy", async () => {
      const writeText = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });

      const session = sessionOver(providerReturning({}));
      render(<App session={session} />);
      await screen.findByTestId("ready");

      await act(async () => {
        screen.getByRole("button", { name: "Copy address" }).click();
      });

      // The address goes over unchanged - no trimming, no normalisation - because a
      // silently altered address is one the user pastes and finds rejected.
      expect(writeText).toHaveBeenCalledWith("guerrilla-1@mail.example");
      expect(screen.getByRole("status").textContent).toContain("on your clipboard");
    });

    it("reports a refused clipboard and keeps the address selectable", async () => {
      // The clipboard rejects for ordinary reasons: no permission, an insecure
      // context, an unfocused document. This must be a rendered state, not an
      // unhandled rejection, and the address must survive it.
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("not allowed")) },
      });

      const session = sessionOver(providerReturning({}));
      render(<App session={session} />);
      await screen.findByTestId("ready");

      await act(async () => {
        screen.getByRole("button", { name: "Copy address" }).click();
      });

      expect(screen.getByRole("status").textContent).toContain("was not copied");
      // Still there, still selectable: copying by hand is a complete answer.
      expect(screen.getByTestId("address").textContent).toContain("guerrilla-1@mail.example");
    });

    it("renders each state as different, labelled content", async () => {
      const session = sessionOver(
        providerReturning({ create: () => new Promise<Mailbox>(() => undefined) }),
      );

      // Rendered once and held. The creating state never resolves, so this captures
      // a real settled render rather than a transient one.
      render(<App session={session} />);

      const creatingHeading = screen.getByRole("heading", { name: /creating your address/i });
      const creatingText = visibleText();

      // Distinct heading and distinct prose, so the state is told apart by words. A
      // page that signalled state by colour alone would render identical text in
      // every state and pass - and there is no colour in this client to signal with.
      expect(creatingHeading.textContent).toBe("Creating your address");
      expect(creatingText).toContain("Asking Guerrilla Mail for a new address.");

      // The other two states' content is absent, so the three are mutually exclusive
      // rather than all rendered and merely reordered. These four strings are the
      // whole claim: the first version of this test checked only the two `testid`s,
      // and a mutation that added the word "Ready" to the *creating* state passed it.
      expect(screen.queryByTestId("ready")).toBeNull();
      expect(screen.queryByTestId("failure-explanation")).toBeNull();
      expect(creatingText).not.toContain("Your address");
      expect(creatingText).not.toContain("No address yet");
      expect(creatingText).not.toContain("Try again");
      // Plain containment, not a word-boundary match. `textContent` concatenates
      // adjacent elements with no separator, so "new address.Ready" has no
      // whitespace before "Ready" — and a regex anchored on `/(^|\s)Ready(\s|$)/`
      // passed a mutation that rendered exactly that. The falsification pass is the
      // only reason this is a plain `not.toContain`.
      expect(creatingText).not.toContain("Ready");
    });
  });

  describe("mailbox lifetime", () => {
    it("says the lifetime is unknown and shows no time value", async () => {
      const session = sessionOver(providerReturning({ mailbox: mailbox("guerrilla-1") }));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      expect(screen.getByTestId("lifetime-unknown").textContent).toContain("Unknown");

      // No `<time>` element, and no digit run that could be a countdown or a
      // duration. Mail.tm publishes a 7-day retention and says a mailbox lasts until
      // deleted, but neither appears in any API response, so any number here would be
      // one this product invented.
      expect(document.querySelector("time")).toBeNull();
      const lifetime = screen.getByTestId("lifetime-unknown").textContent ?? "";
      expect(lifetime).not.toMatch(/\d/);
    });

    it("renders a provider-reported expiry, attributed, when there is one", async () => {
      // **The positive control for the absence above.** With an expiry present the
      // page does render one, so the previous test's silence is a decision and not an
      // omission.
      const expiresAt = Date.parse("2026-10-09T12:00:00.000Z");
      const session = sessionOver(
        providerReturning({ mailbox: mailbox("guerrilla-1", expiresAt) }),
      );

      render(<App session={session} />);
      await screen.findByTestId("ready");

      expect(screen.getByTestId("lifetime-reported").textContent).toContain(
        "2026-10-09T12:00:00.000Z",
      );
      // Attributed to the provider, not presented as a SpectreMail guarantee.
      expect(screen.getByTestId("lifetime-reported").textContent).toContain(
        "not a SpectreMail guarantee",
      );
      expect(screen.queryByTestId("lifetime-unknown")).toBeNull();
    });
  });

  describe("when creation fails", () => {
    it("shows a throttle in the user's terms, with a retry and no address", async () => {
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.RATE_LIMITED,
            provider: "guerrilla",
            description: "Rate limited; try again shortly.",
            rateLimit: "1; w=60",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      expect(screen.getByTestId("failure-explanation").textContent).toContain(
        "asking SpectreMail to slow down",
      );
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      // No address anywhere, in any form.
      expect(visibleText()).not.toContain("@");
      expect(document.querySelector("input")).toBeNull();
    });

    it("shows an unreachable provider differently from a throttle", async () => {
      // One render per test, deliberately. An earlier version of this test rendered
      // a throttled session, unmounted it, and rendered an unavailable one in the
      // same body; the second render stayed stuck in `creating`, so the comparison
      // silently became a comparison of nothing. One render per test removes the
      // cross-render coupling entirely, and the throttle's own wording is asserted
      // in the previous test rather than re-read from a sibling render.
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.PROVIDER_UNAVAILABLE,
            provider: "guerrilla",
            description: "Could not be reached.",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      const text = screen.getByTestId("failure-explanation").textContent ?? "";
      expect(text).toContain("could not be reached");
      // Distinct from the throttle's wording. Two conditions, two instructions: a
      // generic message for both would make the normalized code pointless.
      expect(text).not.toContain("slow down");
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(visibleText()).not.toContain("@");
    });

    it("never retries by itself", async () => {
      const create = vi.fn((): Promise<Mailbox> =>
        refuses({
          code: NormalizedErrorCode.RATE_LIMITED,
          provider: "guerrilla",
          description: "Rate limited.",
        }),
      );
      const session = sessionOver(providerReturning({ create }));

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      // Exactly one attempt with no user action. A page that hid a 429 behind a
      // spinner would tell a rate-limited user their request was being handled; the
      // retry has to be theirs to press.
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("retries when the user asks, and succeeds", async () => {
      let call = 0;
      const create = vi.fn((): Promise<Mailbox> => {
        call += 1;
        return call === 1
          ? refuses({
              code: NormalizedErrorCode.PROVIDER_UNAVAILABLE,
              provider: "guerrilla",
              description: "Could not be reached.",
            })
          : Promise.resolve(mailbox("guerrilla-9"));
      });
      const session = sessionOver(providerReturning({ create }));

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      await act(async () => {
        screen.getByRole("button", { name: "Try again" }).click();
      });

      await screen.findByTestId("ready");
      expect(create).toHaveBeenCalledTimes(2);
      expect(visibleText()).toContain("guerrilla-9@mail.example");
    });

    it("shows a rate limit verbatim, with no scope attached", async () => {
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.RATE_LIMITED,
            provider: "guerrilla",
            description: "Rate limited.",
            rateLimit: "1; w=60",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      // Verbatim, and explicitly not interpreted. Whether `1; w=60` is per-IP or
      // per-account was never verified, so no scope may be stated.
      expect(screen.getByTestId("failure-rate-limit").textContent).toContain("1; w=60");
      expect(screen.getByTestId("failure-rate-limit").textContent).toContain(
        "does not know what it is counted per",
      );
      expect(screen.getByTestId("failure-rate-limit").textContent).not.toMatch(/per (ip|account)/i);
    });

    it("says so when it cannot tell why", async () => {
      const session = sessionOver(
        providerReturning({
          failWith: {
            code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
            provider: "guerrilla",
            description: "Something unclassified happened.",
          },
        }),
      );

      render(<App session={session} />);
      await screen.findByTestId("failure-explanation");

      // An unknown cause is stated as unknown rather than guessed at. Reading a cause
      // out of prose would fail silently and permanently the first time the wording
      // changed.
      expect(screen.getByTestId("failure-explanation").textContent).toContain("could not tell why");
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });

    /**
     * Every code, not the two that happened to be written first.
     *
     * `MailboxFailure.tsx` states that each branch is a *different instruction* —
     * wait, come back later, try again — and that one generic message would make the
     * code pointless. **Five of the eight branches had no render test**, so that
     * rationale was unverified: replacing `AUTH_FAILED`'s copy with the
     * `UNKNOWN_PROVIDER_ERROR` copy, and `MAILBOX_EXPIRED`'s and `NETWORK_ERROR`'s
     * with `PROVIDER_UNAVAILABLE`'s, left all 365 tests green. The claim survived
     * the code being deleted in three places.
     *
     * Two assertions, because "renders something" is too weak: the page must render
     * **its own** message (so a copy borrowed from another branch fails), and it
     * must render it for **every** code (so a branch that falls through to `default`
     * fails).
     */
    const EVERY_CODE: readonly NormalizedErrorCode[] = Object.values(NormalizedErrorCode);

    /**
     * A **valid** `SpectreError` for a code, with the extra fields that code requires.
     *
     * Written this way because the first version of this test built every code as
     * `{ code, provider, description }` and three of them were rejected by
     * `core`'s `isSpectreError`: `NETWORK_ERROR` requires a `cause`,
     * `MESSAGE_NOT_FOUND` a `messageId`, and `UNSUPPORTED_OPERATION` an `operation`.
     * The session then correctly refused to read a code out of a value it did not
     * recognise and fell back to `UNKNOWN_PROVIDER_ERROR`, so those three rendered
     * `[object Object]` and the test failed.
     *
     * **That failure was the fixture's, not the page's**, and the distinction is
     * worth stating: `normalize` degrading an unrecognised throwable to
     * `UNKNOWN_PROVIDER_ERROR` is the behaviour `mailbox-session` requires. A test
     * that reached it by accident would have "found a bug" that is the design
     * working — so the per-code requirements are satisfied explicitly here instead.
     */
    function specterErrorFor(code: NormalizedErrorCode): SpectreError {
      // Each branch spells out its own variant rather than spreading a `shared` object
      // across a widened `code`. `SpectreError` is a **discriminated union** whose
      // members carry literal `code` types and per-code required fields, so a shared
      // base object typed `code: NormalizedErrorCode` cannot satisfy any member — and
      // the compiler says so, which is the model working rather than a nuisance.
      switch (code) {
        case NormalizedErrorCode.NETWORK_ERROR:
          return {
            code: NormalizedErrorCode.NETWORK_ERROR,
            provider: "guerrilla",
            description: "The provider said so.",
            cause: new Error("the socket closed"),
          };
        case NormalizedErrorCode.MESSAGE_NOT_FOUND:
          return {
            code: NormalizedErrorCode.MESSAGE_NOT_FOUND,
            provider: "guerrilla",
            description: "The provider said so.",
            messageId: "abc123",
          };
        case NormalizedErrorCode.UNSUPPORTED_OPERATION:
          return {
            code: NormalizedErrorCode.UNSUPPORTED_OPERATION,
            provider: "guerrilla",
            description: "The provider said so.",
            operation: "createMailbox",
          };
        default:
          return { code, provider: "guerrilla", description: "The provider said so." };
      }
    }

    it("covers every normalized code, so none is left to the default branch", () => {
      // A precondition on the *set*: the table below is only a real check while it
      // enumerates the closed set rather than a hand-copied subset of it. A new code
      // added to `core` lands here automatically, which is the whole point of
      // deriving the list instead of writing it out.
      expect(EVERY_CODE.length).toBeGreaterThanOrEqual(8);
    });

    it.each(EVERY_CODE)("names %s in its own words, and stays retryable", async (code) => {
      const session = sessionOver(providerReturning({ failWith: specterErrorFor(code) }));

      render(<App session={session} />);
      const explanation = await screen.findByTestId("failure-explanation");

      // Its own words, not the fallback. `explain()` throws for an unhandled code,
      // so a code that fell through to `default` fails here by not rendering at all
      // — which is the failure mode this assertion exists to catch.
      expect(explanation.textContent).not.toContain("Unhandled failure code");
      expect(explanation.textContent).toBeTruthy();

      // The provider's own words are kept, as text, in every branch. Also the
      // positive signal that the code reached the page as itself rather than being
      // degraded: an unrecognised failure would not carry this description at all.
      expect(screen.getByTestId("failure-detail").textContent).toContain("The provider said so.");

      // Retryable by hand in every branch, and no address rendered in any of them —
      // a stale or placeholder address is the specific dishonesty this state exists
      // to prevent.
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.queryByTestId("ready")).toBeNull();
      expect(visibleText()).not.toContain("@mail.example");
    });

    it("gives different codes different instructions, rather than one message", async () => {
      // The distinctness half of the claim above, stated as its own assertion
      // because a per-code assertion cannot see it: eight branches all rendering the
      // *same* sentence would pass every `it.each` above.
      //
      // Only codes the page names separately are compared. `MESSAGE_NOT_FOUND` and
      // `UNSUPPORTED_OPERATION` deliberately share one message in the source — the
      // page cannot act differently on either — so requiring eight distinct strings
      // would demand a distinction the component is right not to make.
      const DISTINCT = [
        NormalizedErrorCode.RATE_LIMITED,
        NormalizedErrorCode.PROVIDER_UNAVAILABLE,
        NormalizedErrorCode.AUTH_FAILED,
        NormalizedErrorCode.MAILBOX_EXPIRED,
        NormalizedErrorCode.NETWORK_ERROR,
        NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
      ];

      // **Sequentially, not with `Promise.all`.** The first version mapped over the
      // codes concurrently, so all six components were mounted at once and
      // `screen` — which queries the whole document — returned the *first*
      // explanation for all six. Every message was identical because they were all
      // literally the same node, and the assertion "different codes read
      // differently" passed for exactly the wrong reason: it was comparing one string
      // with itself six times. Unmounting between renders is what makes the
      // comparison mean anything.
      const messages: string[] = [];
      for (const code of DISTINCT) {
        const session = sessionOver(providerReturning({ failWith: specterErrorFor(code) }));
        const { unmount } = render(<App session={session} />);
        const explanation = await screen.findByTestId("failure-explanation");
        messages.push(explanation.textContent ?? "");
        unmount();
      }

      // A precondition on the sample, so an empty loop cannot satisfy the check
      // below vacuously.
      expect(messages).toHaveLength(DISTINCT.length);

      // Every message is distinct. A duplicate here means two conditions a user must
      // act on differently are being described the same way.
      expect(new Set(messages).size).toBe(messages.length);

      // And the one that must differ most is the throttle's: telling a rate-limited
      // user to try again is the failure `provider-abstraction` names.
      expect(messages[0]).not.toBe(messages[1]);
    });
  });

  describe("what the page claims", () => {
    it("says nothing that contradicts what the page does", async () => {
      const session = sessionOver(providerReturning({}));

      render(<App session={session} />);
      await screen.findByTestId("ready");

      const text = visibleText();

      // The M1 page claimed the client had no mailbox feature. It has one now, and
      // leaving the old sentence would make the page contradict itself.
      expect(text).not.toMatch(/no mailbox feature/i);
      expect(text).not.toMatch(/it has no mailbox/i);

      // **Slice 2 retired the "no inbox" claim, and this assertion is what notices.**
      // It was the one line that failed when the inbox arrived, which is the property
      // the whole test is for: a page that kept saying it has no inbox while showing
      // one is contradicting itself, and a test that only asserted the *present*
      // claims would have passed over it.
      expect(text).not.toMatch(/no inbox/i);

      // Statements that are still true are kept.
      expect(text).toMatch(/no backend/i);
      expect(text).toMatch(/never (relays|proxies)/i);

      // And the limitations that are true are stated, including the ones that are
      // unflattering. The unreadable-one is the slice-2 version of "no inbox": the page
      // can list a mailbox but still cannot open a message.
      expect(text).toMatch(/cannot open a message/i);
      expect(text).toMatch(/reload discards/i);
      expect(text).toContain("Guerrilla Mail and nothing else");
    });

    it("inserts no provider value as markup", async () => {
      const hostile = mailbox("guerrilla-1");
      Object.defineProperty(hostile, "address", {
        configurable: true,
        value: '<img src=x onerror="alert(1)">@mail.example',
      });
      const session = sessionOver(providerReturning({ mailbox: hostile }));

      const { container } = render(<App session={session} />);
      await screen.findByTestId("ready");

      // An address is provider-supplied text. It renders as text, so the tag is
      // visible characters and no element was created from it.
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByTestId("address").textContent).toContain("<img src=x");
    });

    it("asked the user for nothing, in every state including the ready one", async () => {
      // **The ready state was never checked for this.** The creating and failed
      // states both assert there is no `input`, which is half the scenario: "creates a
      // mailbox without asking … without requiring an account, a sign-up step, an
      // email address of the user's own, or any other information". A form that
      // appeared only *after* the mailbox arrived — asking for the address to keep,
      // say — would satisfy the earlier states and break the requirement, and no
      // assertion would have noticed.
      const session = sessionOver(providerReturning({}));

      const { container } = render(<App session={session} />);
      await screen.findByTestId("ready");

      expect(container.querySelector("form")).toBeNull();
      expect(container.querySelector("input")).toBeNull();
      expect(container.querySelector("select")).toBeNull();
      expect(container.querySelector("textarea")).toBeNull();
      expect(document.querySelector("dialog[open]")).toBeNull();
    });

    it("offers no provider selector, and does not present its absence as missing", async () => {
      // `website-client`'s provider-selector scenario is conditional — "WHEN the
      // website renders a provider selector" — and today it renders none, so the
      // scenario's *WHEN* never fires. A conditional scenario with nothing asserting
      // the condition is the shape that hides a whole slice: nobody can tell whether
      // the selector was forgotten, deliberately deferred, or quietly removed.
      //
      // So the condition is asserted instead. This is a real claim, not a
      // placeholder: the selector belongs to a later slice of M5, and this test is
      // what makes adding it a *deliberate act* rather than an accident. When the
      // selector slice lands, this test is expected to be **replaced**, and the
      // replacement is the honest thing to do — this one would otherwise start
      // failing and someone would delete it.
      const session = sessionOver(providerReturning({}));

      const { container } = render(<App session={session} />);
      await screen.findByTestId("ready");

      // No provider-picking control of any kind.
      expect(container.querySelector("select")).toBeNull();
      expect(screen.queryByRole("combobox")).toBeNull();
      expect(screen.queryByRole("listbox")).toBeNull();

      // And the page names exactly one provider, rather than offering or
      // apologising for a choice it does not have.
      expect(visibleText()).toContain("Guerrilla Mail and nothing else");
      expect(visibleText()).not.toMatch(/mail\.tm/i);
      expect(visibleText()).not.toMatch(/coming soon|not yet available|unavailable provider/i);
    });

    it("starts a fresh mailbox after a reload instead of claiming the old one", async () => {
      // `mailbox-session`'s "A reload loses the session": the session SHALL NOT claim
      // to have recovered that mailbox, and SHALL open a new one or report none.
      //
      // This was **uncovered**, and the obvious mutation to try — a module-level
      // cache in `useMailboxSession` that returns the previous mailbox after a
      // remount — turned out to be caught only by *cross-test contamination*
      // through the shared module registry, by an unrelated test. A test that
      // passes for a reason other than the one it names is not coverage, which is
      // why this exists rather than relying on that accident.
      //
      // The reload is modelled the way jsdom allows: unmount, then mount a fresh
      // component against a *different* provider, which is what a real reload gives
      // you — a new session object and no memory of the old one.
      const first = sessionOver(providerReturning({ mailbox: mailbox("guerrilla-1") }));
      const { unmount } = render(<App session={first} />);
      await screen.findByTestId("ready");
      expect(visibleText()).toContain("guerrilla-1@mail.example");
      unmount();

      // A fresh mount over a provider that hands out a different mailbox.
      const second = sessionOver(providerReturning({ mailbox: mailbox("guerrilla-2") }));
      render(<App session={second} />);
      await screen.findByTestId("ready");

      // The new mailbox, and no trace of the old one. Claiming the first address
      // after a reload would show a user an address the page cannot prove it still
      // holds.
      expect(visibleText()).toContain("guerrilla-2@mail.example");
      expect(visibleText()).not.toContain("guerrilla-1@mail.example");
    });

    // The structural counterpart - that no file under `apps/` contains an escape hatch
    // at all - lives in `tests/architecture/boundaries.test.ts`, next to the other
    // boundary rules and using its comment-stripping helper. It is not duplicated here:
    // a copy in a test file would be a second definition of the rule that could drift
    // from the first, which is precisely the defect this repository has now recorded
    // eleven times.
  });
});
