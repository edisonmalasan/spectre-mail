/**
 * The message view, as a user would perceive it.
 *
 * **Assertions are about words and about the document, never about markup.** A
 * requirement about what is *displayed* cannot be checked against a component's return
 * value, so these render against jsdom and read the document. Where a requirement is
 * about markup *not* being interpreted, the assertion reads the document's **text** and
 * separately asks whether any element was created from the body — because a pattern
 * scan proves the absence of a spelling, not the presence of a rendering.
 *
 * **No jest-dom.** Every assertion reads `textContent` or queries the document itself.
 * The matchers would read better, but adding a dependency for them is a change to the
 * client's dev toolchain that this slice does not need and no other test in
 * `apps/web` asks for.
 *
 * **Every integration case drives the real session over a stub provider.** A test that
 * handed the component a hand-built state would prove the component renders what it was
 * given, and nothing about whether the session gives it the right thing. The one state
 * no stub can hold open — `opening`, which needs a read in flight — is rendered
 * directly, and that exception is stated at the point it happens.
 *
 * ## What this file does not establish
 *
 * **No live browser has ever run this page.** Everything here is jsdom, which is not a
 * browser: it has no focus model, no real navigation, and no accessibility tree. The
 * accessibility assertions below check that a control *is* a `button` with a name — they
 * do not check that a screen reader announces it, and no claim about that is made
 * anywhere in this repository.
 *
 * @module
 */

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Mailbox, MessageSummary, SpectreError } from "@spectre-mail/core";
import { createMailboxSession, isMessageOpened, isReady } from "@spectre-mail/mailbox";
import type { MailboxScheduler, MailboxSession, OpenedMessage } from "@spectre-mail/mailbox";
import { createProviderManager } from "@spectre-mail/providers";
import type { MailProvider } from "@spectre-mail/providers";

import { App } from "./App";
import { applyJsdomSuiteBudget } from "./jsdom-suite-budget";
import { EMPTY_STORE } from "./storage-stub";
import { MessageView } from "./MessageView";
// **Applied at module scope, once.** See `jsdom-suite-budget.ts`. This file's "gives every
// row a real button with a name" was the other of the two assertions that timed out in the
// eight-run record, at 117ms measured in isolation.
applyJsdomSuiteBudget();

afterEach(() => {
  restoreClipboard();
  cleanup();
});

/** The clipboard property a case replaced, so `afterEach` can put it back exactly. */
let restoreClipboard: () => void = () => undefined;

/**
 * A clipboard that records what it was asked to copy, and can be made to refuse.
 *
 * **Installed per case and restored after it**, rather than once for the file. A stub
 * left installed is a *precondition* the next case silently inherits, and this
 * repository's record is that a check whose precondition is wrong does not fail — it
 * measures the wrong thing and passes. Restoring is the cheap half; the expensive half
 * is the positive control the "copies nothing" case carries, without which an
 * unobservable stub would satisfy "nothing was written" forever.
 *
 * **The recorded array is the instrument**, and it is returned rather than wrapped in a
 * mock so a case can assert *exactly* what was copied - a mock's `toHaveBeenCalledWith`
 * passes for a call among many, and "this code and nothing else" is the claim.
 */
function recordingClipboard(options: { readonly refuses?: boolean } = {}): string[] {
  const written: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (value: string) => {
        written.push(value);
        return options.refuses === true
          ? Promise.reject(new Error("not allowed"))
          : Promise.resolve();
      },
    },
  });

  restoreClipboard = () => {
    if (previous === undefined) {
      Reflect.deleteProperty(navigator, "clipboard");
    } else {
      Object.defineProperty(navigator, "clipboard", previous);
    }
    restoreClipboard = () => undefined;
  };

  return written;
}

/** A fixed instant, so a rendered time is a value a test can state. */
const RECEIVED_AT = Date.UTC(2026, 9, 2, 12, 0, 0);

/** A body carrying a code, in the wording the parser detects. */
const CODE_BODY = "Your verification code is 492187. It expires in 10 minutes.";

/**
 * A body that is markup.
 *
 * **Markup on purpose.** Guerrilla Mail declared a plain-text content type and
 * delivered an HTML body, and the real message arrived as raw HTML
 * (`docs/PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`). A fixture of plain prose would
 * make every "renders as text" assertion here vacuous.
 */
const MARKUP_BODY =
  "<p>Hello <b>there</b>, your code is 492187.</p><script>globalThis.__spectrePwned = true;</script>";

/** A body carrying only a verification link. */
const LINK_BODY =
  '<p>Confirm your address: <a href="https://verify.example/confirm?t=abc123">Verify email address</a></p>';

/**
 * A body carrying both a code and a link.
 *
 * **Used wherever a test must see both kinds of finding at once**, so that an assertion
 * about one of them cannot pass by having only the other on screen.
 */
const BOTH_BODY = `${CODE_BODY} ${LINK_BODY}`;

function mailbox(): Mailbox {
  return {
    id: "guerrilla-1",
    provider: "guerrilla",
    address: "guerrilla-1@mail.example",
    createdAt: RECEIVED_AT,
    status: "active",
    credentials: { provider: "guerrilla", sessionId: "session-guerrilla-1" },
  };
}

/** Counts nothing, runs nothing: the page must not keep polling during a test. */
const inertScheduler: MailboxScheduler = {
  schedule: () => () => undefined,
};

function summary(id: string, over: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id,
    mailboxId: "guerrilla-1",
    from: `sender-${id}@mail.example`,
    subject: `Subject for ${id}`,
    receivedAt: RECEIVED_AT,
    ...over,
  };
}

/**
 * A provider over a mutable set of bodies.
 *
 * **Mutable on purpose.** "Offer a retry, and the retry recovers" is a requirement, and
 * a stub whose bodies were fixed at construction could not express it — the retry would
 * have to be tested failing, which is the half that proves nothing about recovery.
 */
function providerReturning(
  options: {
    readonly listings?: readonly (readonly MessageSummary[])[];
    readonly bodies?: Record<string, string>;
    readonly listFailsWith?: readonly (SpectreError | undefined)[];
  } = {},
): MailProvider {
  let calls = 0;

  return {
    id: "guerrilla",
    displayName: "Guerrilla Mail",
    supports: () => false,
    checkHealth: () => Promise.resolve({ provider: "guerrilla", status: "ok" }),
    createMailbox: () => Promise.resolve(mailbox()),
    listMessages: async () => {
      calls += 1;
      const queue = options.listFailsWith;
      if (queue !== undefined && queue[calls - 1] !== undefined) throw queue[calls - 1];
      const listings = options.listings ?? [];
      return [...(listings[Math.min(calls - 1, listings.length - 1)] ?? [])];
    },
    getMessage: (mbx, messageId) => {
      const body = options.bodies?.[messageId];
      if (body === undefined) return Promise.reject(new Error("no body"));
      const found = (options.listings ?? []).flat().find((each) => each.id === messageId);
      return Promise.resolve({
        ...(found ?? { ...summary(messageId), mailboxId: mbx.id }),
        text: body,
        verificationCodes: [],
        verificationLinks: [],
      });
    },
  };
}

/** The whole page, with the mailbox created and the first listing settled. */
async function renderPage(provider: MailProvider) {
  const session = createMailboxSession(createProviderManager([provider]), inertScheduler);
  const view = render(<App session={session} storage={EMPTY_STORE} />);
  await screen.findByTestId("ready");
  await waitFor(() => expect(screen.queryByTestId("inbox-checking")).toBeNull());
  return { ...view, session };
}

/** Every word a reader would see, ignoring the markup it is wrapped in. */
function visibleText(): string {
  return document.body.textContent ?? "";
}

/** The text of one element, or `null` when nothing in the document carries that id. */
function textOf(testId: string): string | null {
  return document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;
}

/** Whether anything in the document carries `testId`. */
function shows(testId: string): boolean {
  return document.querySelector(`[data-testid="${testId}"]`) !== null;
}

/**
 * Each code's own value, read from the `<code>` element inside its row.
 *
 * **Not the row's text.** Each row now carries a control whose label repeats the value —
 * "Copy 492187" beside "492187" — so reading the row would yield `"492187 Copy 492187"`
 * and every assertion about *which* code is on screen would be satisfied by the button.
 * That is this repository's recorded narrow-assertion class in its most ordinary form: the
 * reading must come from the element the claim is about, or a control that duplicated
 * the value would be enough to pass a case about the value.
 */
function codeValues(): string[] {
  return [...document.querySelectorAll('[data-testid="message-code"] .code')].map((node) =>
    (node.textContent ?? "").trim(),
  );
}

/** Each code's rendered copy result, in the same order as the codes. */
function codeStatuses(): string[] {
  return [...document.querySelectorAll('[data-testid="message-code-status"]')].map((node) =>
    (node.textContent ?? "").trim(),
  );
}

/**
 * Everything the opened-message region renders, minus the one timestamp.
 *
 * **Why the timestamp is removed rather than the check being scoped.** A rendered time
 * legitimately contains a decimal — `2026-10-02T12:00:00.000Z` — so a check for the
 * absence of a confidence value over the whole region can never pass. The alternatives
 * were to scope the check to each list (which cannot see a confidence rendered
 * somewhere else) or to exempt a spelling (which is how a real absence quietly stops
 * being checked). Removing one element's own text keeps the check whole.
 */
function openedRegionWithoutTheTimestamp(): string {
  const region = document.querySelector('[data-testid="message-opened"]');
  if (region === null) throw new Error("expected an opened message region in the document");
  const stamp = region.querySelector('[data-testid="message-received-at"]')?.textContent ?? "";
  return (region.textContent ?? "").replace(stamp, "");
}

/** The opened message the session holds, or a thrown error naming what it held. */
function openedMessage(session: MailboxSession): OpenedMessage {
  const state = session.current();
  if (!isReady(state)) throw new Error(`expected ready, got ${state.kind}`);
  if (!isMessageOpened(state.opened)) {
    throw new Error(`expected an opened message, got ${state.opened.kind}`);
  }
  return state.opened.message;
}

/** Click the first inbox row and wait for the message view to settle on a message. */
async function openFirstRow(): Promise<void> {
  fireEvent.click(screen.getAllByTestId("inbox-row-open")[0]!);
  await screen.findByTestId("message-opened");
}

describe("the message view", () => {
  describe("opening a message from the inbox", () => {
    it("gives every row a real button with a name, and opens what it names", async () => {
      const provider = providerReturning({
        listings: [[summary("a"), summary("b")]],
        bodies: { a: CODE_BODY, b: LINK_BODY },
      });
      await renderPage(provider);

      const rows = [...document.querySelectorAll("[data-testid='inbox-row-open']")];

      // **A `button`, not a `div` with a click handler.** A row that opens a message is
      // a control; one the keyboard cannot reach is not a control. Asserted as the
      // element's own tag and name, which is what assistive technology reads — not as
      // a click handler being attached, which a div would satisfy equally.
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.tagName).toBe("BUTTON");
        expect(row.getAttribute("type")).toBe("button");
        // Named by subject, so a list of buttons is navigable by what each one says.
        const name = row.getAttribute("aria-label");
        expect(name).not.toBeNull();
        expect(name).toMatch(/^Open /);
      }

      fireEvent.click(rows[1]!);
      await screen.findByTestId("message-opened");

      // **The row that was clicked is the one that opened.** Asserted by absence too,
      // and **scoped to the message region** — the inbox stays on screen by design, so
      // a whole-document absence check would fail for a reason that is not a defect. A
      // view that opened some message regardless of which row was clicked would still
      // fail this.
      const opened = document.querySelector("[data-testid='message-opened']")?.textContent ?? "";
      expect(opened).toContain("Subject for b");
      expect(opened).not.toContain("Subject for a");
    });

    it("names the marking in the row's accessible name", async () => {
      const provider = providerReturning({
        listings: [[summary("a"), summary("b")]],
        bodies: { a: CODE_BODY, b: "Ordinary correspondence with nothing verifiable." },
      });
      await renderPage(provider);

      // **Two otherwise-identical rows would be indistinguishable in a list of
      // buttons**, and the one carrying the code is the one the user came for. Asserted
      // for both: a name that said "code" on every row would pass the first half alone.
      const labels = [...document.querySelectorAll("[data-testid='inbox-row-open']")].map((row) =>
        row.getAttribute("aria-label"),
      );
      expect(labels[0]).toMatch(/one-time code/i);
      expect(labels[1]).not.toMatch(/one-time code/i);
    });
  });

  describe("what an opened message shows", () => {
    it("shows the sender, the subject, when it arrived, its text, and what was found", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: CODE_BODY },
      });
      await renderPage(provider);
      await openFirstRow();

      // **All six, asserted by presence.** Not a snapshot: a snapshot would pass
      // unchanged if the component stopped rendering at all.
      expect(textOf("message-from")).toContain("sender-a@mail.example");
      expect(textOf("message-subject")).toContain("Subject for a");
      expect(textOf("message-received-at")).toContain("2026-10-02T12:00:00.000Z");
      expect(textOf("message-readable")).toContain("492187");
      expect(shows("message-codes")).toBe(true);
      // And the finding it made about links is stated rather than left to an empty area.
      expect(textOf("message-links-none")).toMatch(/no verification link/i);
    });

    it("says an empty sender and an empty subject were empty", async () => {
      // **A measurement, not a hypothetical.** A real Guerrilla Mail message arrived
      // with an empty subject while its sender and body were present
      // (`docs/PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`).
      const provider = providerReturning({
        listings: [[summary("a", { from: "", subject: "" })]],
        bodies: { a: CODE_BODY },
      });
      await renderPage(provider);
      await openFirstRow();

      expect(textOf("message-from")).toMatch(/no sender reported/i);
      expect(textOf("message-subject")).toMatch(/no subject/i);
      // Still readable — the body was there and the message was openable.
      expect(textOf("message-readable")).toContain("492187");
    });

    it("says a message it read and found nothing in, as a finding", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: "Ordinary correspondence with nothing verifiable." },
      });
      await renderPage(provider);
      await openFirstRow();

      // **Said, not left to be inferred.** This is the honest counterpart to the
      // unreadable case below: this one really was looked at.
      expect(textOf("message-codes-none")).toMatch(/no one-time code/i);
      expect(textOf("message-links-none")).toMatch(/no verification link/i);
    });
  });

  describe("the body a provider returned", () => {
    it("shows markup as text and creates no element from it", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: MARKUP_BODY },
      });
      await renderPage(provider);
      await openFirstRow();

      const readable = textOf("message-readable") ?? "";

      // ---- The words survived. ----------------------------------------------------
      expect(readable).toContain("there");
      expect(readable).toContain("492187");

      // ---- No markup character is present at all. ---------------------------------
      // **Asserted on the rendered text rather than by scanning the source for
      // `dangerouslySetInnerHTML`.** The scan proves the absence of a spelling; this
      // proves the presence of a safe rendering, which is the claim the requirement
      // actually makes. The scan lives in
      // `tests/architecture/boundaries.test.ts` and is a backstop, not the evidence.
      expect(readable).not.toContain("<");
      expect(readable).not.toContain(">");

      // ---- And nothing in the document was built from the body. -------------------
      expect(document.querySelector("script")).toBeNull();
      expect(document.querySelector("b")).toBeNull();
      // Observed rather than assumed: had the delivered script run, this would be set.
      expect((globalThis as Record<string, unknown>).__spectrePwned).toBeUndefined();
    });
  });

  describe("what the page found in a message", () => {
    it("lists codes in the order the parser ranked them", async () => {
      // Two codes, so "rank order" is distinguishable from "the only one".
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: "Your verification code is 492187. Or use 881204 to sign in." },
      });
      const { session } = await renderPage(provider);
      await openFirstRow();

      // **Off the `<code>`, not off the row** — the row now carries a control whose label
      // repeats the value, so reading the row would let the button satisfy a claim about
      // which code is on screen. See `codeValues`.
      const shown = codeValues();

      expect(shown).toHaveLength(2);
      expect(shown[0]).toBe("492187");
      expect(shown[1]).toBe("881204");

      // **The order is the parser's, not this page's.** Read back off the session, so a
      // page that reversed them fails here rather than merely differing from a
      // hand-written fixture — and so a fixture that happens to be in ascending order
      // cannot make a reversal invisible.
      const ranked = openedMessage(session).codes.map((code) => code.value);
      expect(shown).toEqual(ranked);
      expect(ranked[0]).not.toBe("881204");
    });

    it("gives every detected code its own copy control, and copies the one it names", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: "Your verification code is 492187. Or use 881204 to sign in." },
      });
      await renderPage(provider);
      await openFirstRow();

      const written = recordingClipboard();

      // **One control per code, and two is distinguishable from one.** `mail-parsing`
      // never reports a detection as certain, so this page cannot know which candidate the
      // user meant. A single control for the top-ranked code would be the page choosing
      // on the user's behalf, which is the judgement the caveat beside the list already
      // disclaims in words.
      const controls = screen.getAllByTestId("message-code-copy");
      expect(controls).toHaveLength(2);

      // **A real `<button>` whose visible text names the code.** Not `aria-label` over a
      // "Copy code" button: WCAG's *Label in Name* requires the accessible name to contain
      // the visible text, and among two candidates "Copy code" also does not tell a
      // screen-reader user which one they are choosing.
      expect(controls.map((control) => control.tagName)).toEqual(["BUTTON", "BUTTON"]);
      expect(controls.map((control) => control.textContent)).toEqual([
        "Copy 492187",
        "Copy 881204",
      ]);
      expect(controls.map((control) => control.getAttribute("aria-label"))).toEqual([null, null]);

      // **Activating the second copies the second.** The control resolves nothing and the
      // row is the identity, so this is the assertion that the *value* travels and not
      // merely "a clipboard call happened" — a control that copied the top-ranked code
      // regardless of which was pressed would pass a weaker reading of this.
      await act(async () => {
        (controls[1] as HTMLButtonElement).click();
      });
      expect(written).toEqual(["881204"]);
    });

    it("confirms a code was copied, and leaves the other codes saying nothing", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: "Your verification code is 492187. Or use 881204 to sign in." },
      });
      await renderPage(provider);
      await openFirstRow();

      const written = recordingClipboard();
      await act(async () => {
        (screen.getAllByTestId("message-code-copy")[0] as HTMLButtonElement).click();
      });

      // **The confirmation names the code**, because the claim is about one of two and a
      // result that did not say which would be true of either.
      expect(codeStatuses()[0]).toContain("492187 is on your clipboard");
      // **And the untouched code says nothing at all.** A live region that renders
      // something in its idle state reports its own emptiness as a gap, and would also
      // leave two results on a page where only one action happened.
      expect(codeStatuses()[1]).toBe("");
      expect(codeStatuses()).toHaveLength(2);

      // **It is announced rather than merely drawn** — a polite live region, so a
      // confirmation does not interrupt what the user was doing.
      expect(screen.getAllByTestId("message-code-status")[0]?.getAttribute("role")).toBe("status");
      expect(written).toEqual(["492187"]);
    });

    it("reports a refused clipboard and leaves the code on screen", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: "Your verification code is 492187. Or use 881204 to sign in." },
      });
      await renderPage(provider);
      await openFirstRow();

      // **A rejection, not a throw.** The clipboard refuses for ordinary reasons: no
      // permission, an insecure context, an unfocused document. An unhandled rejection
      // here would leave a button that appears to have worked.
      const written = recordingClipboard({ refuses: true });
      await act(async () => {
        (screen.getAllByTestId("message-code-copy")[0] as HTMLButtonElement).click();
      });

      // **Both halves of the claim.** Saying it failed, *and* not saying it succeeded —
      // a status that merely contained the word "copied" would satisfy the first and lie
      // on the second, which is why both are asserted.
      expect(codeStatuses()[0]).toContain("was not copied");
      expect(codeStatuses()[0]).not.toContain("is on your clipboard");

      // **The code survives**, and it is read off the `<code>` element rather than the
      // row: the row's text contains the button's label, which repeats the value, so a
      // row-level reading would pass even with the `<code>` element removed.
      expect(codeValues()[0]).toBe("492187");
      // **And the value was offered to the clipboard unchanged** — a refused write is
      // still a write attempt, and a page that reported a refusal while quietly sending
      // a trimmed value would be worse than one that sent nothing.
      expect(written).toEqual(["492187"]);
    });

    it("copies nothing when a message carrying codes is opened", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: "Your verification code is 492187. Or use 881204 to sign in." },
      });

      // **Installed before the message is opened**, because the claim is about what
      // opening *does*, and a stub installed afterwards would observe only the test.
      const written = recordingClipboard();
      await renderPage(provider);
      await openFirstRow();

      expect(written).toEqual([]);

      // **And the controls are on screen**, so this cannot be green because nothing
      // rendered. A count of zero beside an empty list is not a measurement.
      expect(screen.getAllByTestId("message-code-copy")).toHaveLength(2);

      // **The positive control, and the reason the assertion above is worth anything.**
      // Without it, a stub that silently did nothing would satisfy "nothing was written"
      // for ever. The stub is proved observable by the very next thing the page does.
      await act(async () => {
        (screen.getAllByTestId("message-code-copy")[0] as HTMLButtonElement).click();
      });
      expect(written).toEqual(["492187"]);
    });

    it("forgets a copy result when the message is shown again", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: "Your verification code is 492187. Or use 881204 to sign in." },
      });
      await renderPage(provider);
      await openFirstRow();

      const written = recordingClipboard();
      await act(async () => {
        (screen.getAllByTestId("message-code-copy")[0] as HTMLButtonElement).click();
      });
      expect(codeStatuses()[0]).toContain("is on your clipboard");

      // **Close it and open it again.** The message is retained by the session — clicking
      // an already-read message costs no provider request — so this re-render is the
      // *same* message reaching a *new* `MessageCodes`, and that is exactly the case the
      // D3 consequence is about.
      fireEvent.click(screen.getByTestId("message-close"));
      await openFirstRow();

      // **The stale confirmation is gone**, and the clipboard was not written a second
      // time. "Copied" beside a code the user has not re-copied is a false claim about
      // the clipboard, which is the failure `Address.tsx`'s comment exists to prevent —
      // and the reason the result is component-local rather than session state is
      // written on the hook itself.
      expect(codeStatuses()[0]).toBe("");
      expect(written).toEqual(["492187"]);
    });

    it("says the readings may be wrong, and shows no confidence number", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: BOTH_BODY },
      });
      const { session } = await renderPage(provider);
      await openFirstRow();

      // **No detection is ever reported as certain** is a guarantee `mail-parsing`
      // makes, and the only way to honour it in a view is to say so in words.
      expect(textOf("message-codes-caveat")).toMatch(/may be wrong/i);
      expect(textOf("message-codes-caveat")).toMatch(/most likely one is first/i);
      // **And the links say it too.** `mail-parsing`'s guarantee covers links exactly as
      // it covers codes, and the `website-client` delta names "codes **or links**" in the
      // same sentence as the confidence rule.
      expect(textOf("message-links-caveat")).toMatch(/may be wrong/i);

      const message = openedMessage(session);

      /**
       * Every confidence the model carries must be absent from the region that renders it.
       *
       * **Scoped to a region rather than the whole document**, because the rendered
       * timestamp legitimately contains a decimal (`.000`), so a whole-document check
       * would either be permanently false or need a special case — and a special case is
       * how a real absence quietly stops being checked.
       *
       * **Both the decimal and the percentage form**, because "0.7" and "70%" are the
       * same claim in two spellings and a view that avoided one would not be avoiding
       * the claim.
       *
       * **Both regions, over one fixture carrying both kinds.** This loop was previously
       * over `codes` alone, against a codes-only fixture, which left
       * `VerificationLink.confidence` — a real field on the model
       * (`packages/core/src/message.ts`) — entirely unchecked: adding `{link.confidence}`
       * to the links list turned the suite green while breaking a `SHALL`. That is the
       * recorded failure class in this repository, an assertion narrower than the rule it
       * documents, and it was found by the independent verification pass rather than by
       * any mutation.
       */
      const expectNoConfidence = (region: string, values: readonly number[]): void => {
        for (const value of values) {
          expect(region).not.toContain(String(value));
          expect(region).not.toContain(`${Math.round(value * 100)}%`);
        }
      };

      // **Positive control for both halves**: neither region may be empty, or the
      // assertions above would pass by having nothing to look for.
      expect(message.codes.length).toBeGreaterThan(0);
      expect(message.links.length).toBeGreaterThan(0);
      expect(textOf("message-codes")).not.toBe("");
      expect(textOf("message-links")).not.toBe("");

      expectNoConfidence(
        textOf("message-codes") ?? "",
        message.codes.map((code) => code.confidence),
      );
      expectNoConfidence(
        textOf("message-links") ?? "",
        message.links.map((link) => link.confidence),
      );

      // **And the union, in one place**, so that a confidence rendered outside both
      // regions — in the body, say, or in a summary line — is still caught. The two
      // scoped loops above cannot see that; this one can.
      const everythingExceptTheTimestamp = openedRegionWithoutTheTimestamp();
      for (const value of [...message.codes, ...message.links].map((each) => each.confidence)) {
        expect(everythingExceptTheTimestamp).not.toContain(String(value));
        expect(everythingExceptTheTimestamp).not.toContain(`${Math.round(value * 100)}%`);
      }
    });

    it("renders a detected link as a real anchor and follows nothing on its own", async () => {
      // **SUPERSESSION, recorded here because the case changed direction.** This case
      // used to be called *"shows a link as text with its destination host, and does not
      // follow it"*, and its body asserted `expect(hrefs).toHaveLength(0)` — **no anchor
      // anywhere on the page**. `verification-actions` REMOVES the `website-client`
      // requirement that case enforced (*"This slice shows what it found and does not act
      // on it"*) and replaces it with *"A detected verification link is opened only by
      // the user"*.
      //
      // **A case that flipped direction with nothing attached is the same defect as a
      // requirement that quietly stopped applying**, so the old title's claim and the new
      // one are both visible here. What did *not* change is the property the case was
      // built to protect, and that is what it still asserts: **rendering navigates
      // nowhere.** The prohibition was never against links existing; it was against them
      // acting by themselves, and the surviving half is the stronger claim because a
      // rendered anchor now *could* act.
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: LINK_BODY },
      });
      await renderPage(provider);
      await openFirstRow();

      // **The host is what a user judges a link by**, and `VerificationLink` already
      // carries it so a view need not parse the URL to get it. It is *inside* the anchor,
      // so clicking the host is clicking the link.
      expect(textOf("message-link-host")).toBe("verify.example");
      expect(textOf("message-link-url")).toContain("https://verify.example/");

      const anchors = [...document.querySelectorAll("a")];
      const anchor = anchors[0]!;
      expect(anchor.getAttribute("href")).toBe("https://verify.example/confirm?t=abc123");
      expect(anchor.textContent).toContain("verify.example");

      // **Exactly one anchor, and this is the sharper reading of that number.** The body
      // `LINK_BODY` carries is *itself* markup containing an `<a href>` — delivered by a
      // provider, which this repository has measured doing exactly that. So if the
      // message body were being interpreted rather than shown, there would be **two**
      // anchors here and a message would be able to ship its own activatable element. One
      // is not only "the new one is there"; it is the new one *and nothing from the
      // body*, which is `OpenedMessage.readable` existing for.
      expect(anchors).toHaveLength(1);

      // **A new tab, so the message stays readable** — and `rel` carrying *both* tokens
      // is asserted by membership rather than by the whole string, because `noopener` is
      // the security-relevant one and `noreferrer` is the privacy one on a page whose URL
      // carries a mailbox address; an assertion of the exact attribute would fail on a
      // correct build that added a third token and would pass on one that dropped one.
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")?.split(" ")).toContain("noopener");
      expect(anchor.getAttribute("rel")?.split(" ")).toContain("noreferrer");

      // **And the property the case was written for: opening this message navigated
      // nowhere.** jsdom records no navigation because nothing asks for one, so this
      // half is a real assertion about the *render*, and it is the half that would fail
      // if a `useEffect` were ever added here. Chromium corroborates it in
      // `apps/web/e2e/sections.spec.ts`, which requires the page's recorded traffic to
      // name no URL on the link's host.
      expect(document.querySelector("[href*='confirm']")).toBe(anchor);
      expect((window as { location?: { href: string } }).location?.href).not.toContain("confirm");
    });
  });

  describe("a message that could not be read", () => {
    it("says so, in words that are not the ones for an empty message", async () => {
      // The listing reports the message and its body cannot be read, so the inbox's
      // verdict is `undetermined` and the open fails too.
      const provider = providerReturning({ listings: [[summary("a")]], bodies: {} });
      await renderPage(provider);
      fireEvent.click(screen.getAllByTestId("inbox-row-open")[0]!);

      await screen.findByTestId("message-open-failed");

      // **The claim it must not make.** "No code was found" about a message the product
      // never managed to read is the false claim `mailbox-session` calls the one that
      // costs a user the code they were waiting for. Asserted as an absence *and* as
      // the presence of its opposite.
      expect(shows("message-codes-none")).toBe(false);
      expect(visibleText()).not.toMatch(/no one-time code was found/i);
      expect(visibleText()).not.toMatch(/no verification link was found/i);
      expect(textOf("message-open-failed-reason")).toMatch(/could not be read/i);
      expect(textOf("message-open-failed-reason")).toMatch(/not the same as there being none/i);
    });

    it("offers a retry, and the retry recovers", async () => {
      const bodies: Record<string, string> = {};
      const provider = providerReturning({ listings: [[summary("a")]], bodies });
      await renderPage(provider);

      fireEvent.click(screen.getAllByTestId("inbox-row-open")[0]!);
      await screen.findByTestId("message-open-failed");

      // The provider can now return the body.
      bodies.a = CODE_BODY;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /try reading it again/i }));
      });

      // **Recovery, not merely the existence of a retry control.** A page offering a
      // retry that always fails again is worse than one that says plainly it cannot be
      // read, because it looks like the product is still trying.
      await screen.findByTestId("message-opened");
      expect(textOf("message-readable")).toContain("492187");
    });

    it("keeps the provider's own reason for the failure", async () => {
      const provider = providerReturning({ listings: [[summary("a")]], bodies: {} });
      await renderPage(provider);
      fireEvent.click(screen.getAllByTestId("inbox-row-open")[0]!);

      await screen.findByTestId("message-open-failed");

      // **The normalized description, shown rather than swallowed.** A user told a
      // message "could not be read" with no reason has no idea whether to wait, and
      // `provider-abstraction` requires a failure be surfaced rather than retried
      // quietly.
      const detail = textOf("message-open-failed-detail");
      expect(detail).not.toBeNull();
      expect(detail?.trim()).not.toBe("");
    });
  });

  describe("getting back", () => {
    it("returns to the inbox, which never left", async () => {
      const provider = providerReturning({
        listings: [[summary("a"), summary("b")]],
        bodies: { a: CODE_BODY, b: LINK_BODY },
      });
      await renderPage(provider);

      // **The inbox stays on screen while a message is open.** A user who opened a
      // message to read one code and found their list gone has to hunt for it again,
      // and the list is what tells them the message arrived at all.
      expect(shows("inbox-rows")).toBe(true);
      await openFirstRow();
      expect(shows("inbox-rows")).toBe(true);

      await act(async () => {
        fireEvent.click(screen.getByTestId("message-close"));
      });

      expect(shows("message-opened")).toBe(false);
      expect(document.querySelectorAll("[data-testid='inbox-row-open']")).toHaveLength(2);
      // And the page says what to do next, rather than leaving an empty region.
      expect(textOf("message-none")).toMatch(/no message is open/i);
    });

    it("opens a message again after closing one", async () => {
      const provider = providerReturning({
        listings: [[summary("a")]],
        bodies: { a: CODE_BODY },
      });
      await renderPage(provider);
      await openFirstRow();

      await act(async () => {
        fireEvent.click(screen.getByTestId("message-close"));
      });
      await openFirstRow();

      expect(textOf("message-readable")).toContain("492187");
    });
  });

  /**
   * The one state a stub provider cannot hold open.
   *
   * Rendered directly rather than reached through a session, and that exception is
   * stated rather than hidden: `opening` exists between the click and the provider's
   * answer, and reproducing it through a session needs a transport a test can suspend,
   * which this slice did not need for anything else. Every other state in this file is
   * reached through the real session.
   */
  describe("a state a stub cannot hold open", () => {
    function renderOpening() {
      return render(
        <MessageView
          opened={{ kind: "opening", messageId: "a" }}
          onClose={() => undefined}
          onRetry={() => undefined}
        />,
      );
    }

    it("says a message is being read, and shows no message in place of it", () => {
      renderOpening();

      expect(textOf("message-opening")).toMatch(/reading this message/i);
      // **No opened-message region and no empty message.** The two look almost
      // identical on screen otherwise, and one of them is a lie: there is no message
      // here yet, and a user waiting for a code should be told the page is working.
      expect(shows("message-opened")).toBe(false);
      expect(shows("message-codes-none")).toBe(false);
      expect(shows("message-codes")).toBe(false);
      expect(shows("message-open-failed")).toBe(false);
      // The way back is offered in this state too, so the control cannot shift
      // position as the message loads.
      expect(shows("message-close")).toBe(true);
    });

    it("offers no retry while a message is merely being read", () => {
      renderOpening();

      // **A retry against a read still in flight is a second read**, and two reads for
      // one click is exactly the provider cost `design.md` D2 exists to avoid.
      expect(screen.queryByRole("button", { name: /try reading it again/i })).toBeNull();
    });

    it("says nothing is open, and points at the inbox", () => {
      render(
        <MessageView
          opened={{ kind: "none" }}
          onClose={() => undefined}
          onRetry={() => undefined}
        />,
      );

      expect(textOf("message-none")).toMatch(/no message is open/i);
      expect(textOf("message-none")).toMatch(/inbox/i);
      expect(shows("message-open-failed")).toBe(false);
    });
  });
});
