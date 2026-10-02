/**
 * The polling loop and the inbox state.
 *
 * **No test in this file waits.** Every one drives a `manualScheduler`: the test
 * decides when a scheduled callback fires, so the cadence is asserted as a number
 * and no outcome depends on how fast the machine is. That is the reason the clock is
 * a required parameter rather than an optional one - if a test could leave it out,
 * the suite's correctness would rest on whether the runner's timers happened to
 * behave.
 *
 * ## Every assertion here was watched to fail
 *
 * The falsification harness outside this repository mutated each behaviour this file
 * describes. Two assertions in the first draft of this file were caught by that pass
 * as passing for the wrong reason and were rewritten rather than kept:
 *
 * - "no request on behalf of the discarded mailbox" counted listing calls, which
 *   passes just as happily when every call is for a mailbox already thrown away. It
 *   now reads `listedFor`, which names the mailbox each request was about.
 * - "keeps the messages a previous check learned" asserted on a stub that could not
 *   fail only on the second listing, so the state it claimed to reach was never
 *   reached. The stub now takes a per-call failure queue.
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { MessageSummary } from "@spectre-mail/core";
import { createProviderManager } from "@spectre-mail/providers";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createMailboxSession,
  INBOX_POLL_CEILING_MS,
  INBOX_POLL_PROMPT_MS,
  isFailed,
  isInboxChecked,
  isInboxChecking,
  isReady,
  verdictFor,
} from "./index";
import type { InboxState, MailboxSession, MessageVerdict } from "./index";
import {
  BOTH_BODY,
  CODE_BODY,
  LINK_BODY,
  manualScheduler,
  makeSummary,
  NEUTRAL_BODY,
  stubProvider,
  throttled,
  throttledStating,
  unreachable,
} from "./test-support";
import type { ManualScheduler, StubProvider } from "./test-support";

/** The verdicts that claim a message carries something the user came for. */
const POSITIVE = new Set(["carriesCode", "carriesLink", "carriesCodeAndLink"]);

/** The mailbox of a ready session, failing loudly if it is not ready. */
function mailboxOf(session: MailboxSession) {
  const state = session.current();
  if (!isReady(state)) throw new Error(`expected a ready session, got ${state.kind}`);
  return state.mailbox;
}

/** The inbox of a ready session, failing loudly if the session is not ready. */
function inboxOf(session: MailboxSession): InboxState {
  const state = session.current();
  if (!isReady(state)) throw new Error(`expected a ready session, got ${state.kind}`);
  return state.inbox;
}

/** The listing of a checked or failed inbox, failing loudly if there is none. */
function listingOf(state: InboxState) {
  if (state.kind !== "checked" && state.kind !== "checkFailed") {
    throw new Error(`expected a listing, got ${state.kind}`);
  }
  return state.listing;
}

/** The verdict map of an inbox that has one, or an empty one. */
function verdictsOf(state: InboxState): ReadonlyMap<string, MessageVerdict> {
  if (state.kind === "checked" || state.kind === "checkFailed") return state.listing.verdicts;
  return new Map<string, MessageVerdict>();
}

describe("the inbox", () => {
  let scheduler: ManualScheduler;
  let session: MailboxSession;
  let provider: StubProvider;

  beforeEach(() => {
    scheduler = manualScheduler();
  });

  /** Build a session over `over` and open it, so a test starts from a mailbox. */
  async function start(over: StubProvider): Promise<void> {
    provider = over;
    session = createMailboxSession(createProviderManager([provider]), scheduler);
    await session.open();
  }

  /** A provider listing `summaries`, with bodies by id. */
  function holding(summaries: readonly MessageSummary[], bodies: Record<string, string>) {
    return stubProvider("guerrilla", { messages: { summaries, bodies } });
  }

  describe("asking for a listing", () => {
    it("lists through the provider that owns the mailbox", async () => {
      await start(holding([makeSummary("m1")], { m1: NEUTRAL_BODY }));

      const state = await session.checkInbox();

      expect(provider.listCalls).toBe(1);
      expect(provider.listedFor).toEqual([mailboxOf(session).id]);
      expect(provider.reads).toEqual(["m1"]);
      expect(isInboxChecked(state)).toBe(true);
      expect(listingOf(state).messages.map((message) => message.id)).toEqual(["m1"]);
    });

    it("reports an empty mailbox as an empty one, not as an error", async () => {
      await start(stubProvider("guerrilla"));

      const state = await session.checkInbox();

      expect(isInboxChecked(state)).toBe(true);
      expect(listingOf(state).messages).toEqual([]);
    });

    it("passes through `checking` before it reports anything else", async () => {
      await start(stubProvider("guerrilla"));

      const pending = session.checkInbox();
      // Observed *during* the request, not after: an implementation that went
      // straight from one terminal state to the other would never expose this.
      expect(inboxOf(session).kind).toBe("checking");
      expect(isInboxChecking(inboxOf(session))).toBe(true);

      await pending;
      expect(inboxOf(session).kind).toBe("checked");
    });

    it("holds no field belonging to another variant, for any of the four", async () => {
      // The exact key set, per variant, rather than a subset: a leaked field cannot
      // pass by being unmentioned. The `failed` *session* state had exactly this gap
      // in slice 1, where a test asserted two of three variants.
      await start(stubProvider("guerrilla"));
      expect(inboxOf(session).kind).toBe("notStarted");
      expect(Object.keys(inboxOf(session)).sort()).toEqual(["kind"]);

      const pending = session.checkInbox();
      expect(Object.keys(inboxOf(session)).sort()).toEqual(["kind"]);
      await pending;
      expect(Object.keys(inboxOf(session)).sort()).toEqual(["kind", "listing"]);

      // Now a failure, against the same session's shape.
      await start(stubProvider("guerrilla", { messages: { listFailsWith: unreachable() } }));
      const failed = await session.checkInbox();
      expect(failed.kind).toBe("checkFailed");
      expect(Object.keys(failed).sort()).toEqual(["failure", "kind", "listing"]);
      expect(Object.keys(failed)).not.toContain("checked");
    });

    it("narrows each variant through its own helper", async () => {
      await start(stubProvider("guerrilla"));

      expect(isInboxChecked(inboxOf(session))).toBe(false);

      const pending = session.checkInbox();
      expect(isInboxChecking(inboxOf(session))).toBe(true);
      expect(isInboxChecked(inboxOf(session))).toBe(false);
      await pending;
      expect(isInboxChecked(inboxOf(session))).toBe(true);
    });
  });

  describe("the once-per-message analysis", () => {
    it("marks a message carrying a code, one carrying a link, and one carrying neither", async () => {
      await start(
        holding(
          [makeSummary("code"), makeSummary("link"), makeSummary("both"), makeSummary("plain")],
          { code: CODE_BODY, link: LINK_BODY, both: BOTH_BODY, plain: NEUTRAL_BODY },
        ),
      );

      const { verdicts } = listingOf(await session.checkInbox());

      expect(verdictFor(verdicts, "code").kind).toBe("carriesCode");
      expect(verdictFor(verdicts, "link").kind).toBe("carriesLink");
      // **The fourth case, which the first draft of this test left out.** With only
      // three, a `verdictFrom` that answered `carriesCode` for anything carrying a
      // code - ignoring the link entirely - would have passed, and the two facts would
      // have been collapsed into one. A message carrying both is ordinary: most
      // verification mail does.
      expect(verdictFor(verdicts, "both").kind).toBe("carriesCodeAndLink");
      expect(verdictFor(verdicts, "plain").kind).toBe("carriesNothing");
    });

    it("reports a message it could not read as undetermined, never as carrying nothing", async () => {
      // The listing succeeds and names three messages; only one has a recorded body,
      // so the other two reads reject. That is the condition under which a
      // "carriesNothing" claim would be a lie about a body this product never saw.
      await start(holding([makeSummary("readable"), makeSummary("a")], { readable: CODE_BODY }));

      const { verdicts } = listingOf(await session.checkInbox());

      expect(provider.reads).toEqual(["readable", "a"]);
      expect(verdictFor(verdicts, "readable").kind).toBe("carriesCode");
      expect(verdictFor(verdicts, "a").kind).toBe("undetermined");
    });

    it("makes no code-or-link claim about a message it never read", async () => {
      await start(holding([makeSummary("unread")], {}));

      const verdict = verdictFor(listingOf(await session.checkInbox()).verdicts, "unread");

      expect(POSITIVE.has(verdict.kind)).toBe(false);
      // Named explicitly, so "not positive" cannot be satisfied by a verdict that
      // claims something this test never enumerated - including `carriesNothing`,
      // which is the claim this test exists to prevent.
      expect(verdict.kind).not.toBe("carriesNothing");
    });

    it("reports a message the map has never heard of as undetermined", async () => {
      // The lookup missing *is* the answer. `undefined` here would render as whatever
      // the client did with it, and the default wrong for this is "nothing found" -
      // about a message this product never looked at.
      expect(verdictFor(new Map<string, MessageVerdict>(), "never-seen").kind).toBe("undetermined");
    });

    it("reads each message once, however many listings name it", async () => {
      await start(holding([makeSummary("m1")], { m1: NEUTRAL_BODY }));

      await session.checkInbox();
      await session.checkInbox();
      await session.checkInbox();

      expect(provider.listCalls).toBe(3);
      expect(provider.reads).toEqual(["m1"]);
    });

    it("reads only what arrived, so a fourth listing costs exactly one more read", async () => {
      const first = makeSummary("m1");
      const second = makeSummary("m2");
      await start(
        stubProvider("guerrilla", {
          messages: {
            listings: [[first], [first], [first], [first, second]],
            bodies: { m1: NEUTRAL_BODY, m2: CODE_BODY },
          },
        }),
      );

      for (let listing = 0; listing < 3; listing += 1) await session.checkInbox();
      expect(provider.reads).toEqual(["m1"]);

      await session.checkInbox();
      expect(provider.reads).toEqual(["m1", "m2"]);
    });

    it("does not re-read a message a listing dropped and then re-added", async () => {
      const first = makeSummary("m1");
      const second = makeSummary("m2");
      // Drop and re-add `m1` between listings: a real provider's ordering is not a
      // promise, and a map cleared on a shrinking listing would re-read everything.
      await start(
        stubProvider("guerrilla", {
          messages: {
            listings: [[first], [], [first], [first, second]],
            bodies: { m1: NEUTRAL_BODY, m2: NEUTRAL_BODY },
          },
        }),
      );

      for (let listing = 0; listing < 3; listing += 1) await session.checkInbox();
      expect(provider.reads).toEqual(["m1"]);

      await session.checkInbox();
      expect(provider.reads).toEqual(["m1", "m2"]);
    });

    it("hands the client a map it cannot use to corrupt the next check's", async () => {
      await start(holding([makeSummary("m1")], { m1: CODE_BODY }));

      // Cast away readonly deliberately: this is what a careless client would do, and
      // the guarantee under test is that the session holds a different object, so the
      // damage lands on the caller's copy only.
      const { verdicts } = listingOf(await session.checkInbox());
      (verdicts as Map<string, MessageVerdict>).set("m1", { kind: "carriesNothing" });

      const again = listingOf(await session.checkInbox());
      expect(verdictFor(again.verdicts, "m1").kind).toBe("carriesCode");
    });
  });

  describe("the cadence", () => {
    it("schedules the first check at the prompt interval", async () => {
      await start(stubProvider("guerrilla"));

      await session.checkInbox();

      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
    });

    it("lengthens the interval while nothing changes, and holds the ceiling", async () => {
      await start(stubProvider("guerrilla"));

      await session.checkInbox();
      const observed: number[] = [];
      for (let step = 0; step < 4; step += 1) {
        observed.push(scheduler.lastDelay ?? -1);
        await scheduler.run();
      }

      // Read off the doubling sequence rather than restating it, so a change to
      // `nextDelay` itself shows up here as a diff instead of a quietly wrong number.
      expect(observed).toEqual([
        INBOX_POLL_PROMPT_MS,
        INBOX_POLL_PROMPT_MS * 2,
        INBOX_POLL_PROMPT_MS * 4,
        INBOX_POLL_CEILING_MS,
      ]);
    });

    it("resets to the prompt interval as soon as something changes", async () => {
      const summary = makeSummary("m1");
      await start(
        stubProvider("guerrilla", {
          messages: {
            listings: [[], [], [], [summary], [], [summary]],
            bodies: { m1: NEUTRAL_BODY },
          },
        }),
      );

      // Three empty listings in a row, each backing off. The listing queue starts with
      // three empties, so checks two, three and four are the quiet ones.
      await session.checkInbox();
      const whileQuiet: number[] = [];
      for (let step = 0; step < 2; step += 1) {
        await scheduler.run();
        whileQuiet.push(scheduler.lastDelay ?? -1);
      }
      expect(whileQuiet).toEqual([INBOX_POLL_PROMPT_MS * 2, INBOX_POLL_PROMPT_MS * 4]);

      // The third run brings the message the queue's fourth entry names, and a user
      // whose code just arrived should not be made to wait out a backoff they never
      // watched start.
      await scheduler.run();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
    });

    it("treats two empty listings as unchanged, so a fresh mailbox backs off", async () => {
      // The bug this pins: a brand-new mailbox is empty, and treating "empty" as
      // "changed" would hold every fresh mailbox at the shortest interval forever,
      // which is the opposite of what a backoff is for.
      await start(stubProvider("guerrilla"));

      await session.checkInbox();
      const observed: number[] = [];
      for (let step = 0; step < 3; step += 1) {
        await scheduler.run();
        observed.push(scheduler.lastDelay ?? -1);
      }

      expect(observed).toEqual([
        INBOX_POLL_PROMPT_MS * 2,
        INBOX_POLL_PROMPT_MS * 4,
        INBOX_POLL_CEILING_MS,
      ]);
      expect(scheduler.lastDelay).toBeGreaterThan(INBOX_POLL_PROMPT_MS);
    });

    it("counts the identity of the listing, not its length", async () => {
      const first = makeSummary("m1");
      const second = makeSummary("m2");
      await start(
        stubProvider("guerrilla", {
          messages: {
            // **Every listing is two messages long.** The first draft of this test used
            // lengths 2, 3, 2, 2 — and a comparison that only looked at the *count*
            // reached the same verdict on all four, so it passed with the very defect
            // it was written for. A length-only comparison and an identity comparison
            // have to be given input they disagree about, or the test measures nothing.
            listings: [
              [first, second],
              [first, makeSummary("m3")],
              [first, makeSummary("m4")],
              [first, second],
              [first, second],
            ],
            bodies: { m1: NEUTRAL_BODY, m2: NEUTRAL_BODY, m3: NEUTRAL_BODY, m4: NEUTRAL_BODY },
          },
        }),
      );

      await session.checkInbox();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);

      // Three changes in a row, each the same length as the last: a different message
      // each time, so each resets the count rather than lengthening the interval.
      await scheduler.run();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
      await scheduler.run();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
      await scheduler.run();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);

      // And then a listing identical to the one before it, which is the only thing
      // that lets the interval lengthen.
      await scheduler.run();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS * 2);
    });

    it("replaces the pending schedule rather than stacking a second one", async () => {
      await start(stubProvider("guerrilla"));
      await session.checkInbox();

      // A caller-initiated check while something is already pending must not leave
      // two callbacks queued, or the mailbox would be listed twice per interval and
      // the effective cadence would be half of whatever `nextDelay` computed.
      await session.checkInbox();

      // One schedule per check, and only one outstanding.
      expect(scheduler.scheduled).toHaveLength(2);
      expect(scheduler.pending).toBe(1);

      // The second check saw the same empty listing twice, so it backed off to 10s.
      // Asserted so the count above is not read as "nothing was scheduled twice"
      // either.
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS * 2);
    });
  });

  describe("a provider's stated limit", () => {
    it("never schedules below the window a throttle statement names", async () => {
      // `throttled()` carries the measured `1; w=60`, naming a sixty-second window.
      // Every interval asked for after that must clear it, however quiet the inbox -
      // and 60s is well past the 30s ceiling, so the floor is doing the work.
      await start(
        stubProvider("guerrilla", { messages: { listFailsWith: [throttled(), undefined] } }),
      );

      await session.checkInbox();
      expect(inboxOf(session).kind).toBe("checkFailed");

      // The caller asks again - the visible retry - and it succeeds.
      await session.checkInbox();
      expect(inboxOf(session).kind).toBe("checked");

      expect(scheduler.lastDelay).toBe(60_000);
      expect(scheduler.lastDelay).toBeGreaterThan(INBOX_POLL_CEILING_MS);
    });

    it("keeps the floor for later checks, not only the first one after the refusal", async () => {
      await start(
        stubProvider("guerrilla", { messages: { listFailsWith: [throttled(), undefined] } }),
      );
      await session.checkInbox();
      await session.checkInbox();

      // Let the cadence back off over several steps. A floor honoured once and then
      // forgotten would show up here as the interval falling back to 5s.
      const observed: number[] = [];
      for (let step = 0; step < 3; step += 1) {
        observed.push(scheduler.lastDelay ?? -1);
        await scheduler.run();
      }

      expect(observed).toEqual([60_000, 60_000, 60_000]);
    });

    it("resumes polling when the caller asks again after a throttle", async () => {
      // The other half of "a throttle halts the loop": a loop that can be halted and
      // never restarted is not a surfaced throttle, it is a dead mailbox. The way back
      // is the caller asking, which is the visible retry - so the requirement is that
      // the ask both performs the check *and* leaves something scheduled.
      //
      // **`pending` rather than a delay, deliberately.** The delay is already asserted
      // elsewhere; this is about whether anything is queued at all, which is the half a
      // `check` that omitted its own `scheduleNext` got wrong.
      await start(
        stubProvider("guerrilla", { messages: { listFailsWith: [throttled(), undefined] } }),
      );
      await session.checkInbox();
      expect(scheduler.pending).toBe(0);

      await session.checkInbox();

      expect(scheduler.pending).toBe(1);
      await scheduler.run();
      // Two refusals plus this one, and nothing asked for it.
      expect(provider.listCalls).toBe(3);
    });

    it("reports a declared limit verbatim and derives no number from it", async () => {
      // The statement is a machine-readable header that states no scope, so the only
      // defensible reading is "wait at least the window". What must never happen is
      // the session re-parsing the string into a figure it presents as a measurement.
      await start(stubProvider("guerrilla", { messages: { listFailsWith: throttled() } }));

      const state = await session.checkInbox();
      if (state.kind !== "checkFailed") throw new Error("expected a failed check");

      expect(state.listing.rateLimit).toBe("1; w=60");
      expect(state.failure.rateLimit).toBe("1; w=60");

      // Nothing numeric is added. The listing's own keys are exactly the three the
      // requirement describes, so a derived `requestsPerWindow: 1` or `retryAfter: 60`
      // would appear here as an extra key.
      expect(Object.keys(state.listing).sort()).toEqual(["messages", "rateLimit", "verdicts"]);
    });

    it("states no limit at all when the provider stated none", async () => {
      await start(stubProvider("guerrilla", { messages: { listFailsWith: unreachable() } }));

      const state = await session.checkInbox();
      if (state.kind !== "checkFailed") throw new Error("expected a failed check");

      // Absent, not empty and not invented: reporting `""` or a guess would be
      // claiming a provider limit nobody published.
      expect(Object.keys(state.listing)).not.toContain("rateLimit");
      expect(Object.keys(state.listing).sort()).toEqual(["messages", "verdicts"]);
    });

    it("derives no floor from a statement it does not understand", async () => {
      // An unfamiliar string yields no floor rather than a wrong one. A garbage
      // `w=0` parsed optimistically would schedule faster than the cadence, which is
      // the one direction a conservative reader must never move in.
      await start(
        stubProvider("guerrilla", {
          // Refused once, then accepted. A throttled listing stops the loop whatever
          // its statement says, so the interval can only be observed on the check the
          // caller asks for afterwards.
          //
          // **`"1; d=60"` and not a wordless string, and that is the point.** It is a
          // real `ratelimit-policy` shape with a real number in it, so a reader that
          // grabbed *any* digits would derive a floor and this test would catch it. The
          // first draft used `"unparseable"`, which no reader of any kind can make a
          // number out of - so the assertion passed for a reason that had nothing to do
          // with the rule it was written for. A day-long window is also the honest
          // example: it is a limit, and it is emphatically not a floor for a five-second
          // poll.
          messages: { listFailsWith: [throttledStating("1; d=60"), undefined] },
        }),
      );
      await session.checkInbox();

      await session.checkInbox();

      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
      expect(scheduler.lastDelay).toBeLessThan(60_000);
    });

    it("derives no floor from a statement whose window is zero", async () => {
      // The conservative direction, stated separately because it is a *different*
      // grammar outcome: `1; w=0` is well-formed, and it says "no waiting at all",
      // which is a statement about what already happened rather than a permission.
      // Taking it as a zero floor would be correct arithmetic and wrong policy, since a
      // floor is only ever the product's conservative reading of what a provider asked
      // for - and `Math.max` would accept a zero without noticing.
      //
      // **This case existed only in a comment until the independent verification pass
      // pointed at it.** Rewriting the test above left `windowMsOf`'s `seconds <= 0`
      // guard unexercised while the comment beside it still described `w=0` - a guard
      // whose test drifted to a neighbouring case, which is the shape this repository
      // keeps finding.
      await start(
        stubProvider("guerrilla", {
          messages: { listFailsWith: [throttledStating("1; w=0"), undefined] },
        }),
      );

      await session.checkInbox();
      await session.checkInbox();

      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
    });
  });

  describe("a failed check", () => {
    it("does not retry a throttled listing on its own", async () => {
      await start(stubProvider("guerrilla", { messages: { listFailsWith: throttled() } }));

      await session.checkInbox();
      expect(provider.listCalls).toBe(1);

      // Nothing pending could fire, and driving the scheduler anyway changes nothing.
      expect(scheduler.pending).toBe(0);
      await scheduler.run();
      await scheduler.run();
      expect(provider.listCalls).toBe(1);
    });

    it("leaves the mailbox alone: the session is still ready, with its address", async () => {
      await start(stubProvider("guerrilla", { messages: { listFailsWith: throttled() } }));

      await session.checkInbox();

      // The failure is a condition of the *inbox*. A listing that failed says nothing
      // about whether the mailbox exists, and the address is the one thing a user
      // cannot afford to lose.
      expect(isReady(session.current())).toBe(true);
      expect(isFailed(session.current())).toBe(false);
      expect(mailboxOf(session).address).toMatch(/@mail\.example$/);
      expect(inboxOf(session).kind).toBe("checkFailed");
    });

    it("keeps the messages a previous check learned", async () => {
      await start(
        stubProvider("guerrilla", {
          messages: {
            summaries: [makeSummary("m1")],
            bodies: { m1: CODE_BODY },
            // Succeed, then refuse: the failure has to arrive *after* something was
            // learned, or this asserts against an empty inbox.
            listFailsWith: [undefined, unreachable()],
          },
        }),
      );

      await session.checkInbox();
      expect(listingOf(inboxOf(session)).messages).toHaveLength(1);

      const failed = await session.checkInbox();

      // Blanking a user's inbox because one request failed destroys information the
      // product still has, in exchange for dramatising a problem they cannot act on.
      expect(listingOf(failed).messages.map((message) => message.id)).toEqual(["m1"]);
      expect(verdictFor(listingOf(failed).verdicts, "m1").kind).toBe("carriesCode");
    });

    it("reports a non-throttled failure without stopping the loop", async () => {
      // A network blip is not throttling. A poller that gave up permanently on one
      // would then report an empty inbox for a mailbox that is perfectly alive.
      await start(stubProvider("guerrilla", { messages: { listFailsWith: unreachable() } }));

      await session.checkInbox();

      expect(inboxOf(session).kind).toBe("checkFailed");
      expect(scheduler.pending).toBe(1);
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
    });

    it("keeps polling through a non-throttled failure and recovers", async () => {
      await start(
        stubProvider("guerrilla", {
          messages: {
            summaries: [makeSummary("m1")],
            bodies: { m1: CODE_BODY },
            listFailsWith: [unreachable(), undefined],
          },
        }),
      );

      await session.checkInbox();
      expect(inboxOf(session).kind).toBe("checkFailed");

      // Nothing asked for it: the loop did.
      await scheduler.run();

      expect(provider.listCalls).toBe(2);
      expect(inboxOf(session).kind).toBe("checked");
      expect(listingOf(inboxOf(session)).messages).toHaveLength(1);
    });

    it("does not treat a refusal as the quiet it did not observe", async () => {
      // **The first listing is refused**, so nothing at all was learned about what is
      // in the mailbox. The next check is the first listing that answers, and it must be
      // treated as the *first* observation: comparing it against the refusal's own
      // empty listing would find two matching empties and lengthen the interval on the
      // strength of a request that failed.
      //
      // The effect is small and real — a mailbox that started with one unlucky request
      // would poll every ten seconds instead of every five — and it is invisible until
      // a test asserts the delay on exactly that check.
      await start(
        stubProvider("guerrilla", { messages: { listFailsWith: [unreachable(), undefined] } }),
      );

      await session.checkInbox();
      expect(inboxOf(session).kind).toBe("checkFailed");

      await session.checkInbox();

      expect(inboxOf(session).kind).toBe("checked");
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);

      // And *that* is the first unchanged pair, so the interval lengthens from here.
      await scheduler.run();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS * 2);
    });

    it("keeps the provider's own code rather than a generic one", async () => {
      await start(stubProvider("guerrilla", { messages: { listFailsWith: throttled() } }));

      const state = await session.checkInbox();
      if (state.kind !== "checkFailed") throw new Error("expected a failed check");

      // A listing refusal is reported as what it is. Collapsing it to
      // `PROVIDER_UNAVAILABLE` would tell a user to try a different provider when the
      // only thing wrong is that they are going too fast.
      expect(state.failure.code).toBe(NormalizedErrorCode.RATE_LIMITED);
      expect(state.failure.providerFailures.map((failure) => failure.provider)).toEqual([
        "guerrilla",
      ]);
    });

    it("describes a throwable it does not recognise rather than reporting nothing", async () => {
      // No adapter throws a bare `Error`, so this is the defensive branch. It is
      // tested because untested defensive code is code whose behaviour nobody knows -
      // and an empty description would render as a blank line where a user needs one.
      await start(
        stubProvider("guerrilla", { messages: { listThrows: new Error("socket hang up") } }),
      );

      const state = await session.checkInbox();
      if (state.kind !== "checkFailed") throw new Error("expected a failed check");

      expect(state.failure.code).toBe(NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR);
      expect(state.failure.description).toContain("socket hang up");
    });

    it("does not recover a rate limit out of an unrecognised throwable's wording", async () => {
      // "Rate limited; try again in 60 seconds" is prose. Reading a delay out of it is
      // the class of rule this repository explicitly refuses to write - it would fail
      // silently and permanently the first time the wording changed.
      await start(
        stubProvider("guerrilla", {
          messages: { listThrows: new Error("Rate limited; try again in 60 seconds.") },
        }),
      );

      await session.checkInbox();
      await session.checkInbox();

      expect(listingOf(inboxOf(session)).rateLimit).toBeUndefined();
      expect(scheduler.lastDelay).toBe(INBOX_POLL_PROMPT_MS);
    });
  });

  describe("the mailbox being replaced", () => {
    it("cancels the discarded mailbox's pending check instead of firing it", async () => {
      await start(holding([makeSummary("m1")], { m1: CODE_BODY }));
      await session.checkInbox();
      expect(scheduler.pending).toBe(1);

      await session.replace();

      // The falsifiable part: if the pending check were left queued it would still be
      // there, and the mailbox it names no longer exists.
      expect(scheduler.pending).toBe(0);

      const listed = provider.listCalls;
      await scheduler.run();
      await scheduler.run();
      expect(provider.listCalls).toBe(listed);
    });

    it("makes no later request on behalf of the mailbox it discarded", async () => {
      await start(holding([makeSummary("m1")], { m1: CODE_BODY }));
      await session.checkInbox();
      const first = mailboxOf(session).id;

      await session.replace();
      const second = mailboxOf(session).id;
      expect(second).not.toBe(first);

      // Everything from here on, so the check the first mailbox legitimately received
      // is not mistaken for a stale one.
      const before = provider.listedFor.length;

      await session.checkInbox();
      await scheduler.run();
      await scheduler.run();

      // **Which mailbox each request was about**, not how many there were: counting
      // passes just as happily when every one of them is for the discarded mailbox.
      const after = provider.listedFor.slice(before);
      expect(after.length).toBeGreaterThan(0);
      expect(after).not.toContain(first);
      expect(new Set(after)).toEqual(new Set([second]));
    });

    it("carries none of the previous mailbox's verdicts over", async () => {
      await start(holding([makeSummary("m1")], { m1: CODE_BODY }));
      await session.checkInbox();
      expect(verdictFor(verdictsOf(inboxOf(session)), "m1").kind).toBe("carriesCode");

      await session.replace();

      // Message ids are provider-scoped, so one mailbox's analysis attached to
      // another's message would be a claim about a body this session never read.
      expect(verdictsOf(inboxOf(session)).size).toBe(0);
      expect(verdictFor(verdictsOf(inboxOf(session)), "m1").kind).toBe("undetermined");
    });

    it("starts the replacement's inbox from nothing, not from the old listing", async () => {
      await start(holding([makeSummary("m1")], { m1: CODE_BODY }));
      await session.checkInbox();

      await session.replace();

      expect(inboxOf(session).kind).toBe("notStarted");
      expect(Object.keys(inboxOf(session))).toEqual(["kind"]);
    });

    it("re-reads a message the new mailbox happens to reuse an id for", async () => {
      // The opposite requirement from the one above: verdicts do not survive a
      // replacement, so a provider that hands out an id again gets a fresh read
      // rather than the previous mailbox's answer about a different body.
      await start(holding([makeSummary("m1")], { m1: CODE_BODY }));
      await session.checkInbox();
      await session.replace();

      await session.checkInbox();

      expect(provider.reads).toEqual(["m1", "m1"]);
    });

    it("keeps the provider's stated floor across a replacement", async () => {
      // **`providerFloorMs` deliberately survives `reset`, and nothing asserted it.**
      // The independent verification pass found the decision recorded only in a code
      // comment, and the direction it chooses matters: the sixty-second window a
      // provider stated while polling mailbox A still floors mailbox B. That is
      // conservative rather than convenient — a provider's statement is about the
      // provider, not about the mailbox — and it is invisible unless a test says so.
      await start(
        stubProvider("guerrilla", {
          messages: { listFailsWith: [throttled(), undefined, undefined] },
        }),
      );
      // Refused, so the floor is set and nothing is scheduled — the caller asks again.
      await session.checkInbox();
      await session.checkInbox();
      expect(scheduler.lastDelay).toBe(60_000);

      await session.replace();
      await session.checkInbox();

      // Not 5 000. The replacement gets a fresh mailbox and a fresh verdict map, and
      // still waits as long as the provider said.
      expect(scheduler.lastDelay).toBe(60_000);
    });
  });

  describe("whether anything is displaying the inbox", () => {
    it("makes no request at all while hidden, however long the clock advances", async () => {
      await start(stubProvider("guerrilla"));
      await session.checkInbox();
      expect(provider.listCalls).toBe(1);

      session.reportInboxVisible(false);

      // Nothing pending, so "far past the ceiling" cannot be reached at all - which
      // is the point. A test that merely advanced a real clock by the ceiling would
      // pass even if the loop had quietly rescheduled itself.
      expect(scheduler.pending).toBe(0);
      await scheduler.run();
      await scheduler.run();
      await scheduler.run();
      expect(provider.listCalls).toBe(1);
    });

    it("checks promptly when it becomes visible, without further advancing", async () => {
      await start(stubProvider("guerrilla"));
      await session.checkInbox();
      session.reportInboxVisible(false);

      session.reportInboxVisible(true);
      // No `scheduler.run()`: the check must not wait for a timer, because a user who
      // has just looked at the tab is watching now.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.listCalls).toBe(2);
    });

    it("stops again when it is hidden a second time", async () => {
      await start(stubProvider("guerrilla"));
      await session.checkInbox();

      session.reportInboxVisible(false);
      session.reportInboxVisible(true);
      await Promise.resolve();
      await Promise.resolve();
      const callsWhenHidden = provider.listCalls;

      session.reportInboxVisible(false);
      expect(scheduler.pending).toBe(0);
      await scheduler.run();
      await scheduler.run();
      expect(provider.listCalls).toBe(callsWhenHidden);
    });

    it("does not resume from a halt when it becomes visible", async () => {
      // Visibility is not consent. A user looking at the tab again has not asked for a
      // retry, and re-checking automatically would be the invisible retry
      // `provider-abstraction` forbids.
      await start(stubProvider("guerrilla", { messages: { listFailsWith: throttled() } }));
      await session.checkInbox();
      expect(provider.listCalls).toBe(1);

      session.reportInboxVisible(false);
      session.reportInboxVisible(true);
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.listCalls).toBe(1);
    });

    it("does not check for a mailbox that does not exist", async () => {
      // Reachable only through a session whose creation failed. Nothing may be
      // requested to discover that there is nothing to list.
      const neverOpened = stubProvider("guerrilla", { failWith: unreachable() });
      const failing = createMailboxSession(createProviderManager([neverOpened]), scheduler);
      await failing.open();

      const state = await failing.checkInbox();

      expect(state.kind).toBe("notStarted");
      expect(scheduler.pending).toBe(0);
      // **The requirement's stronger half, and it was asserted only indirectly.** "It
      // SHALL NOT contact a provider to find out" is a claim about a request, and a
      // `pending` of zero is a claim about a timer. A tracker that asked the provider
      // whether the mailbox existed would pass both of those and violate the rule.
      expect(neverOpened.listCalls).toBe(0);
    });
  });

  describe("being destroyed", () => {
    it("cancels the pending check and leaves the session readable", async () => {
      await start(stubProvider("guerrilla"));
      await session.checkInbox();
      expect(scheduler.pending).toBe(1);

      const before = session.current();
      session.destroy();

      expect(scheduler.pending).toBe(0);
      // The same value, by identity: destroying releases the scheduler, not the state
      // a client is mid-render on.
      expect(session.current()).toBe(before);

      await scheduler.run();
      expect(provider.listCalls).toBe(1);
    });

    it("answers an explicit ask after being destroyed, but schedules nothing further", async () => {
      await start(stubProvider("guerrilla"));
      await session.checkInbox();
      session.destroy();

      // Answering a caller is not polling, so the check still happens...
      const state = await session.checkInbox();
      expect(state.kind).toBe("checked");
      expect(provider.listCalls).toBe(2);

      // ...but nothing is queued, so a destroyed session cannot be restarted by
      // accident. A `destroy` that only cancelled the pending schedule would pass the
      // first assertion and fail this one.
      expect(scheduler.pending).toBe(0);
      await scheduler.run();
      expect(provider.listCalls).toBe(2);
    });
  });
});
