/**
 * The inbox, as a user would perceive it.
 *
 * **Assertions are about words, never about markup or colour.** A requirement about
 * what is *displayed* cannot be checked against a component's return value, so these
 * render against jsdom and read the document. That is also why nothing here is a
 * snapshot: a snapshot would pass unchanged if the component stopped rendering at all.
 *
 * **Every case drives the real session over a stub provider**, not a hand-built
 * `InboxState`. A test that handed the component a state the session had never
 * produced would prove the component renders what it was given, and nothing about
 * whether the session gives it the right thing.
 *
 * ## The three things this file is really checking
 *
 * 1. A message with an empty subject still appears, and its row is not blank.
 *    That is a **measurement**, not a hypothetical: a real Guerrilla Mail message
 *    arrived with an empty subject (`docs/PROVIDERS.md`).
 * 2. "Undetermined" is rendered as its own thing and never as "carries nothing" —
 *    the one false claim in this product that costs a user the code they waited for.
 * 3. **No number about checking appears anywhere.** Not the cadence, not a countdown,
 *    not a rate. The interval is the product's own choice and no provider limit was
 *    measured, so any figure on screen would be an invention presented as a
 *    measurement.
 *
 * @module
 */

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, MessageSummary, SpectreError } from "@spectre-mail/core";
import { createMailboxSession } from "@spectre-mail/mailbox";
import type { InboxState, MailboxScheduler } from "@spectre-mail/mailbox";
import { createProviderManager } from "@spectre-mail/providers";
import type { MailProvider } from "@spectre-mail/providers";

import { App } from "./App";
import { applyJsdomSuiteBudget } from "./jsdom-suite-budget";
import { EMPTY_STORE } from "./storage-stub";
// **Applied at module scope, once.** See `jsdom-suite-budget.ts`: this file's own
// "clears the annotation once a later listing succeeds" was one of the two assertions
// that timed out in the eight-run record, at 247ms measured in isolation.
applyJsdomSuiteBudget();

afterEach(cleanup);

/** A fixed instant, so a row's rendered time is a value a test can state. */
const RECEIVED_AT = Date.UTC(2026, 9, 2, 12, 0, 0);
const RECEIVED_AT_ISO = "2026-10-02T12:00:00.000Z";

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

interface StubOptions {
  readonly listings?: readonly (readonly MessageSummary[])[];
  readonly bodies?: Readonly<Record<string, string>>;
  readonly listFailsWith?: readonly (SpectreError | undefined)[];
}

/** Counts nothing, runs nothing: the inbox must not keep polling during a test. */
const inertScheduler: MailboxScheduler = {
  schedule: () => () => undefined,
};

function providerReturning(options: StubOptions = {}): MailProvider {
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
      if (queue !== undefined && queue[calls - 1] !== undefined) {
        throw queue[calls - 1];
      }
      const listings = options.listings ?? [];
      return [...(listings[Math.min(calls - 1, listings.length - 1)] ?? [])];
    },
    getMessage: (mbx, messageId) => {
      const body = options.bodies?.[messageId];
      if (body === undefined) return Promise.reject(new Error("no body"));
      const summary = (options.listings ?? []).flat().find((m) => m.id === messageId);
      return Promise.resolve({
        ...(summary ?? { ...emptySummary(messageId), mailboxId: mbx.id }),
        text: body,
        verificationCodes: [],
        verificationLinks: [],
      });
    },
  };
}

function emptySummary(id: string): MessageSummary {
  return { id, mailboxId: "guerrilla-1", from: "", subject: "", receivedAt: RECEIVED_AT };
}

/**
 * A summary with only the fields a test cares about overridden.
 *
 * **`unread` is absent by default, and that is the deliberate default.** Absent is
 * the case both measured adapters actually produce far more often than not, and it is
 * the case a row is most likely to get wrong by treating as `false`. A fixture that
 * reported `unread: true` everywhere would make "not reported" untested.
 */
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
 * A session over `provider`, rendered as the whole page, with the inbox settled.
 *
 * **It waits for the inbox, not only for the mailbox.** `ready` appears as soon as
 * the address exists, which is *before* the client's first listing has answered, so a
 * helper that stopped there handed back a page still saying "checking" — and a test
 * asserting an empty or populated inbox then failed on a race rather than on the
 * behaviour it was written for. That is a test that fails for the wrong reason, which
 * is worse than one that fails for the right one.
 */
async function renderPage(provider: MailProvider) {
  const session = createMailboxSession(createProviderManager([provider]), inertScheduler);
  const view = render(<App session={session} storage={EMPTY_STORE} />);
  await screen.findByTestId("ready");
  await waitFor(() => expect(screen.queryByTestId("inbox-checking")).toBeNull());
  return { ...view, session };
}

/** The inbox's current state, read from the session rather than from the DOM. */
function inboxOf(session: Awaited<ReturnType<typeof renderPage>>["session"]): InboxState {
  const state = session.current();
  if (state.kind !== "ready") throw new Error(`expected ready, got ${state.kind}`);
  return state.inbox;
}

describe("the inbox on the page", () => {
  describe("listing messages", () => {
    it("shows every message as its own row, naming its own sender", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("a"), summary("b"), summary("c")]],
          bodies: { a: "Ordinary mail.", b: "Ordinary mail.", c: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      const senders = screen.getAllByTestId("inbox-row-sender").map((node) => node.textContent);
      expect(senders).toEqual([
        "sender-a@mail.example",
        "sender-b@mail.example",
        "sender-c@mail.example",
      ]);

      // Each row names its own subject too, so a row is identifiable rather than
      // three identical fragments.
      const subjects = screen.getAllByTestId("inbox-row-subject").map((node) => node.textContent);
      expect(subjects).toEqual(["Subject for a", "Subject for b", "Subject for c"]);
    });

    it("names the sender, the subject, the time, and the unread state on every row", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("a", { unread: true }), summary("b", { unread: false })]],
          bodies: { a: "Ordinary mail.", b: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      const rows = screen.getAllByTestId("inbox-row-unread").map((node) => node.textContent);
      expect(rows).toEqual(["Unread", "Read"]);

      // One instant, in a form that does not depend on the reader's locale or time
      // zone — which is what lets a test state it.
      const times = screen.getAllByTestId("inbox-row-time").map((node) => node.textContent);
      expect(times).toEqual([RECEIVED_AT_ISO, RECEIVED_AT_ISO]);
    });

    it("says so when the provider did not report an unread state, rather than guessing", async () => {
      await renderPage(
        providerReturning({
          // No `unread` at all, so the field is genuinely absent rather than `false`.
          listings: [[summary("a")]],
          bodies: { a: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      // Absent is not `false`. Reporting "Read" would be a claim about a field nobody
      // sent, and this is a mailbox where being wrong means missing a code.
      expect(screen.getByTestId("inbox-row-unread").textContent).toBe("Unread state not reported");
    });

    it("still lists a message that arrived with no subject", async () => {
      // **A measurement, not a hypothetical.** A real Guerrilla Mail message arrived
      // with an empty subject while its sender and body were present
      // (`docs/PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`). A row that dropped it
      // would hide the very mail this product exists to deliver.
      await renderPage(
        providerReturning({
          listings: [[summary("blank", { subject: "" }), summary("ok")]],
          bodies: { blank: "Ordinary mail.", ok: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      expect(screen.getAllByTestId("inbox-row-subject")).toHaveLength(2);
      const subjects = screen.getAllByTestId("inbox-row-subject").map((node) => node.textContent);
      expect(subjects).toContain("No subject");
    });

    it("does not render a blank where an empty subject was", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("blank", { subject: "", from: "" })]],
          bodies: { blank: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      // Every cell says something. A row whose subject and sender rendered as empty
      // elements would be an invisible message — the requirement is that the row is
      // *not blank*, not merely that it exists.
      for (const testId of [
        "inbox-row-sender",
        "inbox-row-subject",
        "inbox-row-time",
        "inbox-row-unread",
      ]) {
        const text = screen.getByTestId(testId).textContent ?? "";
        expect(text.trim(), `${testId} should not be blank`).not.toBe("");
      }

      expect(screen.getByTestId("inbox-row-sender").textContent).toBe("No sender reported");
      expect(screen.getByTestId("inbox-row-subject").textContent).toBe("No subject");
    });
  });

  describe("the four inbox states", () => {
    it("says it is checking before any listing has completed", async () => {
      // **A listing that never answers, so the state is observable.**
      //
      // The first version of this test rendered a page whose listing resolved and then
      // asserted the "checking" element was *absent* — which is not the same claim at
      // all, and passed while saying nothing about whether the page can say it is
      // checking. A state that exists only between two renders is not a state a user
      // can be shown, so a test has to hold it open to assert it.
      render(<App session={blockedListingSession()} storage={EMPTY_STORE} />);
      await screen.findByTestId("ready");

      expect(screen.getByTestId("inbox-checking").textContent).toBe(
        "Checking this address for mail.",
      );
      // **And not the empty sentence.** An inbox that has not been checked must not
      // read as a mailbox with no mail: those are different facts, and conflating them
      // reports "nothing arrived" about a mailbox nobody has looked at.
      expect(screen.queryByTestId("inbox-empty")).toBeNull();
      // Nor as a failure.
      expect(screen.queryByTestId("inbox-check-failed")).toBeNull();
    });

    it("says the mailbox is empty when the provider reported no messages", async () => {
      await renderPage(providerReturning({ listings: [[]] }));

      expect(screen.getByTestId("inbox-empty").textContent).toBe(
        "No mail has arrived at this address yet.",
      );
      // An empty inbox is not a failure, and must not be dressed as one.
      expect(screen.queryByTestId("inbox-check-failed")).toBeNull();
      expect(screen.getByTestId("address").textContent).toContain("@mail.example");
    });

    it("does not present an empty mailbox as one that has never been checked", async () => {
      // The mutual-exclusion assertion **naming the strings themselves.** The vacuous
      // form of this assertion — checking only that a testid is absent — is one of
      // slice 1's two real findings, so the strings are compared to each other here.
      await renderPage(providerReturning({ listings: [[]] }));
      const empty = screen.getByTestId("inbox-empty").textContent;

      // A second page whose listing never answers, so `checking` is what it is stuck
      // at. **`cleanup()` between the two renders**, because `screen` searches the
      // whole document: without it both pages are mounted at once and each assertion
      // could be satisfied by the other's DOM.
      cleanup();
      render(<App session={blockedListingSession()} storage={EMPTY_STORE} />);
      await screen.findByTestId("inbox-checking");
      const checking = screen.getByTestId("inbox-checking").textContent;

      expect(empty).toBeTruthy();
      expect(checking).toBeTruthy();
      // Different claims: one says a provider answered and there was nothing, the
      // other says nobody has asked yet.
      expect(empty).not.toBe(checking);
      expect(checking).not.toContain("No mail has arrived");
      expect(empty).not.toContain("Checking");
    });

    it("keeps the address on screen while the inbox is still being checked", async () => {
      // The mailbox exists before the listing does. If the inbox drove the whole
      // `ready` branch, an address would appear and then vanish — which is the one
      // thing a user copying an address into a signup form cannot tolerate.
      render(<App session={blockedListingSession()} storage={EMPTY_STORE} />);
      await screen.findByTestId("ready");

      expect(screen.getByTestId("inbox-checking")).toBeTruthy();
      expect(screen.getByTestId("address").textContent).toContain("guerrilla-1@mail.example");
    });

    it("shows a populated inbox as rows rather than as the empty sentence", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("a")]],
          bodies: { a: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      expect(screen.queryByTestId("inbox-empty")).toBeNull();
      expect(screen.queryByTestId("inbox-checking")).toBeNull();
    });
  });

  describe("the verification marking", () => {
    it("marks a message the session determined carries a code, in words", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("code")]],
          bodies: { code: "Your verification code is 492187. It expires in 10 minutes." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      // **Text, not a shape.** The row states it in characters, so a screen reader
      // announces it, a monochrome display shows it, and it survives a stylesheet that
      // paints nothing at all.
      const marking = screen.getByTestId("inbox-row-verdict");
      expect(marking.textContent).toBe("Contains a one-time code.");
      expect(marking.querySelectorAll("span, svg, i")).toHaveLength(0);

      // **This assertion replaced `expect(marking.className).toBe("")`, and the reason
      // it could not stay is worth recording.** It stood for "the marking carries no
      // non-text signal of its own" — and M7 slice 1 gave the marking a class, so the
      // literal became false while the property it stood for held. A literal that a
      // routine change falsifies without any behaviour changing is a test that will be
      // deleted rather than understood.
      //
      // The property, asserted instead: the marking's class is **one fixed hook that
      // does not vary by verdict**. So all three `carries*` verdicts style identically,
      // no colour or weight distinguishes a code from a link, and the words stay the
      // only thing saying which was found.
      expect(marking.className).toBe("inbox-row__verdict");
    });

    it("marks a verification link separately from a code", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("link")]],
          bodies: {
            link: '<p>Confirm: <a href="https://verify.example/confirm?t=abc">Verify email address</a></p>',
          },
        }),
      );
      await screen.findByTestId("inbox-rows");

      expect(screen.getByTestId("inbox-row-verdict").textContent).toBe(
        "Contains a verification link.",
      );
    });

    it("does not mark a message determined to carry nothing", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("plain")]],
          bodies: { plain: "Hello. This is ordinary correspondence." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      expect(screen.queryByTestId("inbox-row-verdict")).toBeNull();
      // And the row says nothing that reads as a negative claim either.
      expect(screen.getByTestId("inbox-rows").textContent ?? "").not.toMatch(
        /carries nothing|no code|no verification/i,
      );
    });

    it("says so when a message could not be read, and never that it carries nothing", async () => {
      // Listed but with no body the stub can serve, so the read rejects and the
      // session reports it undetermined. This is the case that matters most: reporting
      // it as "carries nothing" would state about a message the product never looked
      // at that it contains no code.
      await renderPage(
        providerReturning({
          listings: [[summary("unreadable")]],
          bodies: {},
        }),
      );
      await screen.findByTestId("inbox-rows");

      const marking = screen.getByTestId("inbox-row-verdict");
      expect(marking.textContent).toBe(
        "This message could not be read, so what it carries is unknown.",
      );
      expect(marking.textContent).not.toMatch(/carries nothing|no code/i);
    });

    it("renders the marking from the session's verdict, not from the message body", async () => {
      // The two halves that together distinguish the implementations.
      //
      // **First: a body carrying a code produces the marking.** A row that ignored the
      // verdict and looked at nothing would show nothing here, and a row that parsed
      // the body itself would show this too — so this half alone cannot tell them
      // apart.
      await renderPage(
        providerReturning({
          listings: [[summary("code")]],
          bodies: { code: "Your verification code is 492187." },
        }),
      );
      await screen.findByTestId("inbox-rows");
      expect(screen.getByTestId("inbox-row-verdict").textContent).toBe("Contains a one-time code.");

      // **Second: a body this product never managed to read produces no positive
      // claim.** The listing succeeded and named the message; only the read failed. A
      // row that parsed the message itself would have nothing to parse and would very
      // likely render "nothing found" — which is a claim about a body nobody read.
      //
      // This is reached through the real session over a stub, not by handing the
      // component a state: a hand-built `InboxState` would prove the component renders
      // what it was given, and nothing about whether the session produces it.
      cleanup();
      await renderPage(
        providerReturning({
          listings: [[summary("unreadable")]],
          bodies: {},
        }),
      );
      await screen.findByTestId("inbox-rows");
      expect(screen.getByTestId("inbox-row-verdict").textContent).toBe(
        "This message could not be read, so what it carries is unknown.",
      );
    });
  });

  describe("the address surviving a failed check", () => {
    it("keeps the address on screen and says the inbox could not be checked", async () => {
      const throttled: SpectreError = {
        code: NormalizedErrorCode.RATE_LIMITED,
        provider: "guerrilla",
        description: "Guerrilla Mail is throttling this request.",
        rateLimit: "1; w=60",
      };

      await renderPage(providerReturning({ listFailsWith: [throttled] }));
      await screen.findByTestId("inbox-check-failed");

      // **The address is the one thing a user cannot afford to lose.** A failed
      // listing says something about one request and nothing about the mailbox.
      const address = screen.getByTestId("address");
      expect(address.textContent).toContain("guerrilla-1@mail.example");
      // Still selectable: it is a text node, not an input whose value would have to
      // be read out separately.
      expect(address.querySelector("code")).not.toBeNull();
      expect(address.querySelector("input")).toBeNull();

      // The failure is an annotation on the inbox, not the inbox's replacement.
      expect(screen.queryByTestId("failure-explanation")).toBeNull();
      expect(screen.getByTestId("inbox-failure-explanation").textContent).toContain("slow down");

      // **Nothing had been listed, and the page says so in words.** Without this the
      // failure branch rendered an empty `<ul>` beneath the annotation, which reads as
      // "the inbox is empty" to anyone scanning it — a claim about the mailbox the
      // annotation above it contradicts.
      expect(screen.queryByTestId("inbox-rows")).toBeNull();
      expect(screen.getByTestId("inbox-nothing-learned").textContent).toContain(
        "Nothing had been listed",
      );
    });

    it("still shows the messages it already had when the next check fails", async () => {
      // **A view-level claim, not a repeat of the package's.** The session already
      // keeps the messages a previous check learned, and that is asserted in
      // `packages/mailbox`. What was not asserted anywhere is that the *view* renders
      // them alongside the annotation - and a view that showed only the failure would
      // look correct while blanking a user's inbox over one bad request.
      //
      // Found by the falsification pass: deleting `<InboxRows>` from the failure branch
      // of `Inbox.tsx` turned no test red.
      // `NETWORK_ERROR` is the one `SpectreError` member carrying a required `cause`,
      // and omitting it is a type error Vitest does not see. This fixture was written
      // without it and `pnpm vitest run` was green anyway - found by the independent
      // verification pass, and the reason this repository keeps `pnpm typecheck` as a
      // separate gate rather than trusting a green suite.
      const gone: SpectreError = {
        code: NormalizedErrorCode.NETWORK_ERROR,
        provider: "guerrilla",
        description: "The request could not be completed.",
        cause: new Error("socket hang up"),
      };
      const { session } = await renderPage(
        providerReturning({
          listings: [[summary("kept")]],
          bodies: { kept: "Ordinary correspondence." },
          listFailsWith: [undefined, gone],
        }),
      );
      await screen.findByTestId("inbox-rows");

      // Asked for by the test rather than by a timer: `inertScheduler` schedules
      // nothing, so a second failure has to be requested.
      await act(async () => {
        await session.checkInbox();
      });

      // Both at once: the annotation *and* the message it did not erase.
      expect(screen.getByTestId("inbox-check-failed")).toBeTruthy();
      expect(screen.getByTestId("inbox-row-subject").textContent).toContain("Subject for kept");
    });

    it("quotes the provider's own statement without attaching a scope", async () => {
      const throttled: SpectreError = {
        code: NormalizedErrorCode.RATE_LIMITED,
        provider: "guerrilla",
        description: "Guerrilla Mail is throttling this request.",
        rateLimit: "1; w=60",
      };

      await renderPage(providerReturning({ listFailsWith: [throttled] }));
      await screen.findByTestId("inbox-check-failed");

      const stated = screen.getByTestId("inbox-failure-rate-limit");
      expect(stated.textContent).toContain("1; w=60");
      // `1; w=60` says nothing about what it is counted per, so nothing claims it is.
      expect(stated.textContent).toContain("does not know what it is counted per");
      expect(stated.textContent).not.toMatch(/per (ip|account|user)/i);
    });

    it("clears the annotation once a later listing succeeds", async () => {
      const throttled: SpectreError = {
        code: NormalizedErrorCode.RATE_LIMITED,
        provider: "guerrilla",
        description: "Guerrilla Mail is throttling this request.",
      };

      const { session } = await renderPage(
        providerReturning({
          listFailsWith: [throttled, undefined],
          listings: [[], [summary("late")]],
          bodies: { late: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-check-failed");
      expect(screen.getByTestId("address").textContent).toContain("@mail.example");

      // The retry the user presses — a throttled listing stops the loop rather than
      // backing off, so this button is the only way back.
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /check again/i }));
      });

      await screen.findByTestId("inbox-rows");
      expect(screen.queryByTestId("inbox-check-failed")).toBeNull();
      expect(screen.queryByTestId("inbox-empty")).toBeNull();
      expect(inboxOf(session).kind).toBe("checked");
      expect(screen.getByTestId("address").textContent).toContain("@mail.example");
    });
  });

  describe("what the page says about checking", () => {
    it("describes the behaviour without quoting a rate", async () => {
      await renderPage(
        providerReturning({
          listings: [[summary("a")]],
          bodies: { a: "Ordinary mail." },
        }),
      );
      await screen.findByTestId("inbox-rows");

      const text = document.body.textContent ?? "";
      const note = screen.getByTestId("inbox-cadence-note").textContent ?? "";

      // Describes *that* it checks, and when it stops.
      expect(note).toContain("checks while it is open");
      expect(note).toContain("stops when you switch away");

      // **And no number anywhere.** The cadence is this product's own choice: no
      // provider limit was measured for the only provider a browser page can reach, so
      // any figure here would be an invention presented as a measurement. This is the
      // assertion that would catch it, so it is stated as "no duration at all"
      // rather than as "not equal to the current constant" — a change to the cadence
      // must not be able to make this test pass by accident.
      expect(text).not.toMatch(/\d+\s*(seconds?|secs?|s\b|minutes?|mins?|m\b|milliseconds?|ms)/i);
      expect(text).not.toMatch(/every\s+\d+/i);
      expect(text).not.toMatch(/refresh(es)?\s+in\s+\d+/i);
    });

    it("distinguishes a rate the provider stated from a rate this product chose", async () => {
      // **The distinction the two deltas read differently, asserted rather than left
      // to a reader.** `mailbox-session` requires a provider's limit statement be
      // reported verbatim; `website-client` as originally written forbade showing a
      // "provider rate". The delta was amended during the verification pass to permit
      // the provider's own words and forbid only numbers SpectreMail picked — so the
      // page must show `1; w=60` **attributed to the provider** while still showing no
      // interval of its own, and this is the assertion that keeps both halves honest.
      const throttled: SpectreError = {
        code: NormalizedErrorCode.RATE_LIMITED,
        provider: "guerrilla",
        description: "Guerrilla Mail is throttling this request.",
        rateLimit: "1; w=60",
      };

      await renderPage(providerReturning({ listFailsWith: [throttled] }));
      await screen.findByTestId("inbox-check-failed");

      const text = document.body.textContent ?? "";

      // The provider's words, attributed to the provider and *only* quoted. No second
      // clause attaches a scope to them — "w=60" is a window the product reads out of
      // a header, not a permission the provider granted, and saying otherwise would be
      // the invention this requirement exists to prevent.
      expect(text).toContain("1; w=60");
      const quoted = screen.getByTestId("inbox-failure-rate-limit").textContent ?? "";
      expect(quoted).toContain("The provider advertised this limit");
      // The disclaimer is the second half of the clause: a window read out of a
      // header is not a permission the provider granted, and saying "you may make 1
      // request per 60 seconds" here would be exactly the invention being forbidden.
      expect(quoted).toContain("does not know what it is counted per");

      // And still no interval of the product's own. The duration regexes above are
      // re-run here for a different reason: they must hold *including* on the page
      // where a number genuinely is on screen, or they only ever proved that a
      // successful inbox shows no figures.
      expect(text).not.toMatch(/\d+\s*(seconds?|secs?|s\b|minutes?|mins?|m\b|milliseconds?|ms)/i);
      expect(text).not.toMatch(/every\s+\d+/i);
      expect(text).not.toMatch(/refresh(es)?\s+in\s+\d+/i);
    });

    it("shows no countdown or interval while a check is in flight", async () => {
      let release: (() => void) | undefined;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });

      const provider = providerReturning({ listings: [[summary("a")]], bodies: { a: "Mail." } });
      const listing = provider.listMessages.bind(provider);
      provider.listMessages = async () => {
        await blocked;
        return listing(mailbox());
      };

      const session = createMailboxSession(createProviderManager([provider]), inertScheduler);
      render(<App session={session} storage={EMPTY_STORE} />);
      await screen.findByTestId("ready");

      // Mid-check: the page says it is checking, and says no number while it waits.
      expect(screen.getByTestId("inbox-checking")).toBeTruthy();
      expect(document.body.textContent ?? "").not.toMatch(
        /\d+\s*(seconds?|minutes?|milliseconds?|ms)/i,
      );

      await act(async () => {
        release?.();
        await Promise.resolve();
      });
      await screen.findByTestId("inbox-rows");
    });
  });

  describe("the page's visibility", () => {
    it("asks for a listing when the page becomes visible again", async () => {
      let calls = 0;
      const provider = providerReturning({ listings: [[]], bodies: {} });
      const listing = provider.listMessages.bind(provider);
      provider.listMessages = (mbx) => {
        calls += 1;
        return listing(mbx);
      };

      await renderPage(provider);
      await screen.findByTestId("inbox-empty");
      const afterMount = calls;

      // Hidden, then shown. jsdom's `visibilityState` is read-only, so it is
      // redefined — the same way a browser really reports it.
      setVisibility("hidden");
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(calls).toBe(afterMount);

      setVisibility("visible");
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Promptly, and without the page waiting out an interval it is not showing.
      expect(calls).toBe(afterMount + 1);
    });

    it("reports that nothing is displaying the inbox while the page is hidden", async () => {
      const seen: boolean[] = [];
      const provider = providerReturning({ listings: [[]] });
      const session = createMailboxSession(createProviderManager([provider]), {
        schedule: () => () => undefined,
      });
      const original = session.reportInboxVisible.bind(session);
      Object.defineProperty(session, "reportInboxVisible", {
        configurable: true,
        value: (visible: boolean) => {
          seen.push(visible);
          original(visible);
        },
      });

      setVisibility("visible");
      render(<App session={session} storage={EMPTY_STORE} />);
      await screen.findByTestId("ready");
      expect(seen.at(-1)).toBe(true);

      setVisibility("hidden");
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(seen.at(-1)).toBe(false);
    });
  });
});

/** What the page saw the last time it was asked. */
function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

/**
 * A session whose first listing never answers.
 *
 * Reached through the real session rather than by handing the component a
 * `notStarted` state: the point of the assertion that uses it is that the *page*
 * distinguishes two states, and a fixture that bypassed the session would only prove
 * the component can tell two literals apart.
 */
function blockedListingSession() {
  const provider = providerReturning({ listings: [[]], bodies: {} });
  const listing = provider.listMessages.bind(provider);
  provider.listMessages = () => new Promise<never>(() => undefined);

  // Referenced so the rebinding cannot be read as an accident, and so a future edit
  // that makes the stub answer fails here rather than silently changing the state.
  void listing;

  return createMailboxSession(createProviderManager([provider]), inertScheduler);
}
