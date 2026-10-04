/**
 * Adoption: a stored mailbox handed back to the session.
 *
 * ## Why this is a file of its own
 *
 * Two reasons, and the first is a rule rather than a preference.
 *
 * **The empty-inbox trap can only be driven with provider wire fields in the room.**
 * `docs/PROVIDERS.md` §3 records that an unrecognised Guerrilla Mail session answers
 * `HTTP 200` with an empty list and no error, so a dead session and a mailbox that
 * has simply received nothing are the same response. The only way to reproduce that
 * here is to hand the real adapter the two bodies it actually receives — and those
 * bodies are named in provider wire fields. The wire-format rule scans shipped sources
 * and exempts `.test.ts` precisely because a test has to be able to name what it
 * exercises; `test-support.ts` is not a test file, and the rule caught a first draft
 * that put these bodies there, correctly.
 *
 * **The assertion that matters most is here, not in `session.test.ts`.** Every other
 * adoption assertion could be met by a stub that returns `MAILBOX_EXPIRED` because it
 * was asked to. Only a real adapter over a recording transport can prove that an empty
 * response naming no address is read as *dead* while an empty response naming the
 * mailbox's own address is read as *empty* — which is the distinction the whole
 * feature rests on, and the distinction a stub would have had pre-supplied.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import { createGuerrillaAdapter, createProviderManager } from "@spectre-mail/providers";
import { describe, expect, it } from "vitest";

import {
  createMailboxSession,
  holdsMailbox,
  isAdopting,
  isCreating,
  isExpired,
  isFailed,
  isIdle,
  isReady,
  isRestoreFailed,
  openedOf,
} from "./index";
import type { SessionState } from "./index";
import {
  FIXED_NOW,
  makeMailbox,
  manualScheduler,
  recordingTransport,
  stubProvider,
  unreachable,
} from "./test-support";

/** One recorded answer, in the shape `recordingTransport` asks for. */
interface Answer {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/** The address the fixture mailbox has, since `email_addr` is compared against it. */
const ADDRESS = "stored@mail.example";

/**
 * A Guerrilla address creation, as recorded.
 *
 * The session under test is never asked to create anything except in the two tests
 * that say they are — the mailbox comes from storage — so this exists only so a test
 * can obtain a *real* mailbox from a *real* adapter and then restore it.
 */
function createsAddress(): Answer {
  return {
    status: 200,
    headers: {},
    body: JSON.stringify({ email_addr: ADDRESS, sid_token: "token-stored" }),
  };
}

/**
 * A live session with an empty inbox.
 *
 * **`email_addr` naming the mailbox's own address is the whole content of this
 * responder.** It is the one thing that separates this body from `deadSession`, and
 * `sessionIsLive` compares it against the mailbox rather than merely checking that
 * something came back. A test that asserted only on `deadSession` would pass against
 * an implementation that treated every empty listing as a dead session — which is a
 * product that tells every returning user their address is gone.
 */
function liveEmptyInbox(): Answer {
  return {
    status: 200,
    headers: {},
    body: JSON.stringify({ email_addr: ADDRESS, sid_token: "token-stored", list: [] }),
  };
}

/**
 * A session the provider no longer recognises, exactly as measured.
 *
 * A bare `{ list: [] }`: `HTTP 200`, no error, no address, an empty list. This is the
 * body `docs/PROVIDERS.md` §3 records, and it is the case that makes adoption unsafe
 * to do by reading a stored record.
 */
function deadSession(url: string): Answer {
  // **The address-creation request is answered normally**, and that is not a
  // convenience. The first draft of this responder ignored its argument and returned
  // the dead body for everything, which meant the *setup* mailbox creation was refused
  // too — so ten tests failed at their first line and the failures looked like
  // adoption defects rather than a fixture answering the wrong request. A responder
  // that ignores its URL is a responder answering a request it was not asked about.
  return url.includes("f=check_email")
    ? { status: 200, headers: {}, body: JSON.stringify({ list: [] }) }
    : createsAddress();
}

/** A live session holding one message, so the inbox is not trivially empty. */
function liveInboxWithOneMessage(): Answer {
  return {
    status: 200,
    headers: {},
    body: JSON.stringify({
      email_addr: ADDRESS,
      sid_token: "token-stored",
      list: [
        {
          mail_id: 1,
          mail_from: "noreply@mail.example",
          mail_subject: "Your verification code is 492187",
          mail_date: "2026-10-02",
          mail_time: "12:00:00",
          content_type: "text",
        },
      ],
    }),
  };
}

/** The message body the inbox tracker reads to decide a message's verdict. */
function messageBody(): Answer {
  return {
    status: 200,
    headers: {},
    body: JSON.stringify({
      mail_id: 1,
      mail_from: "noreply@mail.example",
      mail_subject: "Your verification code is 492187",
      mail_date: "2026-10-02",
      mail_time: "12:00:00",
      content_type: "text",
      mail_body: "Your verification code is 492187. It expires in 10 minutes.",
    }),
  };
}

/**
 * A listing the provider refuses with a bare `503`.
 *
 * **The `503` becomes `UNKNOWN_PROVIDER_ERROR`, not `NETWORK_ERROR`, and that is worth
 * stating rather than working around.** `NETWORK_ERROR` is what the adapter raises when
 * the transport itself throws — a dropped connection, a refused socket — and a `503` is
 * an HTTP *answer*, so the adapter classifies it as an unrecognised provider error. The
 * test that uses this asserts the code is not an expiry, which is the claim that
 * matters, rather than pinning a classification this change has no business deciding.
 */
function refusesListing(url: string): Answer {
  return url.includes("f=check_email") ? { status: 503, headers: {}, body: "" } : createsAddress();
}

/**
 * The rate-limit answer the recorded spike saw, headers and all.
 *
 * **`ratelimit-policy`, not a header invented here.** The adapter reads that name and
 * nothing else, so a test that wrote some other header would still get a
 * `RATE_LIMITED` failure from the status — passing while proving nothing about the
 * statement being captured.
 */
function throttled(url: string): Answer {
  return url.includes("f=check_email")
    ? { status: 429, headers: { "ratelimit-policy": "30; w=60" }, body: "" }
    : createsAddress();
}

/**
 * A real Guerrilla adapter over a recording transport, and a mailbox to restore.
 *
 * **The mailbox is created through the adapter, not hand-built.** A hand-built
 * `Mailbox` would satisfy `manager.providerFor` and reach the same code, so the
 * difference is not obvious — but the credentials are the adapter's own here, which is
 * what makes `sessionIsLive`'s comparison of the reported address against the
 * mailbox's own meaningful rather than an accident of two hand-written values
 * happening to match.
 *
 * The recorder is reset before returning, so a request count below is the adoption's
 * and never the fixture's.
 */
async function guerrillaMail(respond: (url: string) => Answer): Promise<{
  readonly adapter: ReturnType<typeof createGuerrillaAdapter>;
  readonly recorder: ReturnType<typeof recordingTransport>;
  readonly stored: Awaited<ReturnType<ReturnType<typeof createGuerrillaAdapter>["createMailbox"]>>;
}> {
  const recorder = recordingTransport({ respond });
  const adapter = createGuerrillaAdapter({ transport: recorder.transport, now: () => FIXED_NOW });
  const stored = await adapter.createMailbox();
  recorder.reset();
  return { adapter, recorder, stored };
}

describe("adopting a stored mailbox", () => {
  describe("what it reports before and after the provider answers", () => {
    it("publishes adopting synchronously, so a page can say it is checking", async () => {
      const { adapter, recorder, stored } = await guerrillaMail(liveEmptyInbox);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const seen: SessionState[] = [];
      session.subscribe((next) => seen.push(next));
      seen.length = 0;

      // Read **synchronously**, before awaiting: the whole point of the transition is
      // that it happens while the request is in flight, so a test that awaited first
      // would never see it — and the page would look frozen through the one request a
      // returning visitor waits longest for.
      const pending = session.restore(stored);

      // **The positive control, and it is the half that is easy to get wrong.** A
      // session that published nothing satisfies "the log contains no `creating`", so
      // the assertion has to be that `adopting` appears *exactly once* — not zero, and
      // not the two-notifications-per-change defect the opened-message path once
      // shipped here.
      expect(seen.filter((state) => state.kind === "adopting")).toHaveLength(1);
      // **And that it does not claim to be creating a new address**, which is what
      // reusing `creating` would have looked like from the page.
      expect(seen.filter((state) => state.kind === "creating")).toHaveLength(0);

      await pending;

      // Still exactly one: a second would mean the state was republished rather than
      // moved through.
      expect(seen.filter((state) => state.kind === "adopting")).toHaveLength(1);
      expect(seen.at(-1)?.kind).toBe("ready");
      // **The recorder saw the request this test says is in flight.**
      expect(recorder.requests.length).toBeGreaterThan(0);
    });

    it("reports the same states in the same order for nothing stored as for a retry", async () => {
      // **`restore(null)` is `open()` reached through a different door, and the claim
      // is that the two doors are indistinguishable.** A second implementation of
      // "create a mailbox" is free to drift — different states, different order, a
      // missing reset — and the drift would surface as a first visit behaving unlike a
      // retry, which is the one pair of paths a user cannot tell apart.
      const viaRestore: string[] = [];
      const viaOpen: string[] = [];

      const doors = [
        [viaRestore, (session: ReturnType<typeof createMailboxSession>) => session.restore(null)],
        [viaOpen, (session: ReturnType<typeof createMailboxSession>) => session.open()],
      ] as const;

      for (const [record, call] of doors) {
        const { adapter } = await guerrillaMail(createsAddress);
        const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());
        session.subscribe((next) => record.push(next.kind));
        await call(session);
      }

      expect(viaRestore).toEqual(viaOpen);
      // **Stated rather than left implicit**, because two empty arrays are equal.
      expect(viaRestore).toEqual(["idle", "creating", "ready"]);
    });
  });

  describe("reconciling it with the provider that owns it", () => {
    it("presents a live empty inbox as a mailbox, not as a dead session", async () => {
      // **The positive control for the trap test below, and it has to exist.** Both
      // bodies are `HTTP 200` with an empty `list`; the only difference is whether the
      // response names the mailbox's own address. An implementation that treated every
      // empty listing as a dead session passes a `deadSession` test and fails this one,
      // and that implementation tells every returning user their address is gone on
      // their very first visit.
      const { adapter, stored } = await guerrillaMail(liveEmptyInbox);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const state = await session.restore(stored);

      expect(state.kind).toBe("ready");
      if (!isReady(state)) throw new Error(`expected a ready state, got ${state.kind}`);
      expect(state.mailbox.address).toBe(stored.address);
      // The reconciliation listing *is* the inbox, so the page has something to render
      // immediately rather than a "not checked yet" that costs a second request.
      expect(state.inbox.kind).toBe("checked");
    });

    it("never presents an empty inbox as proof that a stored mailbox is alive", async () => {
      // **The assertion this whole change exists for.**
      //
      // The recorded Guerrilla behaviour is that an unrecognised session answers
      // `HTTP 200` with an empty list and no error, so a mailbox the provider has
      // dropped is indistinguishable from an empty one *unless something reads the
      // response's own account of the session*. This drives the real adapter with the
      // real body rather than a stub returning `MAILBOX_EXPIRED` because it was asked
      // to, because only the former proves the reading is actually made.
      const { adapter, stored } = await guerrillaMail(deadSession);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const state = await session.restore(stored);

      expect(state.kind).toBe("expired");
      expect(isExpired(state)).toBe(true);
      expect(isReady(state)).toBe(false);
      // And the mailbox is carried, so the page can name the address it has lost
      // rather than saying only that something went wrong.
      if (!isExpired(state)) throw new Error("expected an expired state");
      expect(state.mailbox.address).toBe(stored.address);
    });

    it("makes one request to reconcile, and that request is the inbox's first listing", async () => {
      // **The count, with a positive control first.** A recording transport that
      // recorded nothing would satisfy "no more requests than the adapter made
      // directly", so the same listing is driven straight through the adapter and the
      // two are compared.
      const { adapter, recorder, stored } = await guerrillaMail(liveEmptyInbox);

      // Positive control: the same operation, once, directly.
      await adapter.listMessages(stored);
      expect(recorder.requests).toHaveLength(1);

      recorder.reset();
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());
      await session.restore(stored);

      // Exactly one. A second would be a separate liveness probe, and against a
      // provider that publishes no limit for this path it is cost against an unknown
      // budget answering a weaker question than the listing already answered.
      expect(recorder.requests).toHaveLength(1);
    });

    it("arrives with a populated inbox rather than one it must fetch again", async () => {
      // **Not `notStarted`, and that is the claim.** Messages a restored mailbox
      // already holds are analysed as part of the reconciliation, so a user returning
      // to a mailbox with unread mail sees it marked without waiting for a second poll,
      // and the first listing is not work the next one repeats.
      const { adapter, stored } = await guerrillaMail((url) =>
        url.includes("f=fetch_email") ? messageBody() : liveInboxWithOneMessage(),
      );
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const state = await session.restore(stored);

      if (!isReady(state)) throw new Error(`expected a ready state, got ${state.kind}`);
      expect(state.inbox.kind).toBe("checked");
      if (state.inbox.kind !== "checked") throw new Error("expected a checked inbox");
      expect(state.inbox.listing.messages).toHaveLength(1);
      // The verdict came from the body read *during* reconciliation, not from a later
      // request — which is why the opened-message tracker has something to retain and
      // why the next click on that row needs no fetch.
      expect(state.inbox.listing.verdicts.get("1")?.kind).toBe("carriesCode");
    });

    it("never creates a replacement mailbox while adopting one", async () => {
      // **The negative control matters as much as the assertion.** If nothing in the
      // codebase ever called `createMailbox`, "no creation request" would hold for the
      // wrong reason; the second half drives `restore(null)` through the same recorder
      // and shows a creation request *does* appear when one should.
      const { adapter, recorder, stored } = await guerrillaMail(liveEmptyInbox);

      const adopting = createMailboxSession(createProviderManager([adapter]), manualScheduler());
      await adopting.restore(stored);
      expect(recorder.requests.some((request) => request.includes("get_email_address"))).toBe(
        false,
      );
      expect(recorder.requests).toHaveLength(1);

      recorder.reset();
      const firstVisit = createMailboxSession(createProviderManager([adapter]), manualScheduler());
      await firstVisit.restore(null);
      expect(recorder.requests.some((request) => request.includes("get_email_address"))).toBe(true);
    });
  });

  describe("when the provider will not answer", () => {
    it("reports that it could not tell when the listing was refused", async () => {
      // **The real adapter, a bare `503`, and no specific code asserted.** What this
      // asserts is the one thing that matters: a listing the provider refused is not
      // evidence that the mailbox is gone. Telling a user their address has expired on
      // the strength of one refused request costs them the address they came back for,
      // and it is the most damaging direction this feature can be wrong in.
      const { adapter, recorder, stored } = await guerrillaMail(refusesListing);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const state = await session.restore(stored);

      expect(state.kind).toBe("restoreFailed");
      expect(isRestoreFailed(state)).toBe(true);
      expect(isExpired(state)).toBe(false);
      if (!isRestoreFailed(state)) throw new Error("expected a restoreFailed state");
      // **Not `NETWORK_ERROR`, and the comment on `refusesListing` says why.** A `503`
      // is an answer, not a dropped connection, so the adapter classifies it as an
      // unrecognised provider error. Pinning `NETWORK_ERROR` here would assert a
      // classification this change has no business deciding; the next test covers the
      // genuine transport failure.
      expect(state.failure.code).not.toBe(NormalizedErrorCode.MAILBOX_EXPIRED);
      // The mailbox is carried, so the page can name it and a retry has something to
      // retry with. **Nothing here was thrown away.**
      expect(state.mailbox.address).toBe(stored.address);
      expect(recorder.requests.length).toBeGreaterThan(0);
    });

    it("reports that it could not tell when the connection itself failed", async () => {
      // **The genuine transport failure.** Driven through a stub that throws rather
      // than answers, because that is the shape of a dropped connection. Splitting this
      // from the `503` above keeps both honest: the previous version asserted
      // `NETWORK_ERROR` against a `503` and was simply wrong.
      //
      // **`listThrows` is nested under `messages`, and putting it at the top level is
      // what this test did first.** The option was silently ignored, the stub answered
      // with an empty inbox, and the session reported `ready` — a green-looking
      // fixture asserting the opposite of what it was named for. An option a stub
      // quietly discards is indistinguishable from one that works, right up until the
      // assertion is inverted.
      const provider = stubProvider("guerrilla", {
        messages: { listThrows: unreachable("guerrilla") },
      });
      const session = createMailboxSession(createProviderManager([provider]), manualScheduler());

      const state = await session.restore(makeMailbox("stored", "guerrilla"));

      expect(state.kind).toBe("restoreFailed");
      expect(isExpired(state)).toBe(false);
      if (!isRestoreFailed(state)) throw new Error("expected a restoreFailed state");
      // **`PROVIDER_UNAVAILABLE`, not `NETWORK_ERROR`, and the coarser code is the
      // manager's rather than this change's.** `ProviderManager` composes a refusal
      // into its own aggregate before the session sees it, and the aggregate replaces
      // the provider's specific code rather than carrying it alongside — so a client
      // reading this state learns that the listing failed and which provider was tried,
      // but not that the failure was a dropped connection. That is a pre-existing
      // property of the manager, unchanged here; it is recorded because a reader
      // expecting `NETWORK_ERROR` will otherwise assume adoption lost it.
      expect(state.failure.code).toBe(NormalizedErrorCode.PROVIDER_UNAVAILABLE);
      // The claim this test exists for, which is the one that does not depend on how
      // finely the failure is classified.
      expect(state.failure.code).not.toBe(NormalizedErrorCode.MAILBOX_EXPIRED);
      expect(state.failure.providerFailures[0]?.provider).toBe("guerrilla");
      // **The request was actually attempted**, so this is not a state the session
      // reached without asking anyone.
      expect(provider.listCalls).toBeGreaterThan(0);
      expect(provider.createCalls).toBe(0);
    });

    it("does not call a throttle an expiry", async () => {
      // **The third distinct case, and the one a two-state design would get wrong in
      // the most damaging direction.** A throttled provider is telling us to slow
      // down, not that the address is gone. Reporting it as `expired` would tell a
      // user to discard a perfectly good address because we asked too often.
      //
      // **The refusal is produced by the recorded response, not manufactured here**, so
      // the assertion is about the session's choice of state rather than about a code
      // this test hoped the adapter would produce. The `RATE_LIMITED` assertion below
      // is the positive control for that.
      const { adapter, stored } = await guerrillaMail(throttled);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const state = await session.restore(stored);

      if (!isRestoreFailed(state)) {
        throw new Error(`expected a restoreFailed state, got ${state.kind}`);
      }
      expect(state.failure.code).toBe(NormalizedErrorCode.RATE_LIMITED);
      expect(isExpired(state)).toBe(false);
    });

    it("does not call an expiry something it could not tell", async () => {
      // **The other direction of the same pair, which is a separate assertion.** A
      // design that reported `expired` for everything that went wrong would pass the
      // test above and fail this one, and it would be wrong in the direction that
      // destroys a working address.
      const { adapter, stored } = await guerrillaMail(deadSession);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const state = await session.restore(stored);

      expect(isExpired(state)).toBe(true);
      expect(isRestoreFailed(state)).toBe(false);
    });

    it("keeps the stored mailbox after a check that could not complete", async () => {
      // **The half of "could not tell" that matters to a user.** Nothing about the
      // mailbox was learned, so nothing about it may be forgotten: the failure state
      // carries it, which is what lets the page offer a retry with the same address
      // rather than silently moving the user to a new one.
      //
      // The stronger form of this — that the *record in storage* survives — is a
      // client-side property and is asserted in `apps/web`, where there is a real store
      // to read back. Asserting it here against no store would be a test that passes
      // because there is no store involved.
      const { adapter, stored } = await guerrillaMail(refusesListing);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      const state = await session.restore(stored);

      expect(holdsMailbox(state)).toBe(true);
      if (!holdsMailbox(state)) throw new Error("expected a state holding a mailbox");
      expect(state.mailbox).toEqual(stored);
    });

    it("does not leave the loop running on a mailbox it has given up on", async () => {
      // **A cost claim, and it is easy to miss.** The inbox tracker reschedules after
      // every check, so without stopping it, a session that has just reported a mailbox
      // as gone would go on listing it forever — a request the provider has already
      // refused, repeating, for a state nothing reads.
      const { adapter, recorder, stored } = await guerrillaMail(deadSession);
      const scheduler = manualScheduler();
      const session = createMailboxSession(createProviderManager([adapter]), scheduler);

      await session.restore(stored);
      const afterRestore = recorder.requests.length;
      expect(afterRestore).toBeGreaterThan(0);

      // **Positive control: the scheduler really does run pending work when asked.**
      // Without it, "nothing ran" would be satisfied by a scheduler that never runs
      // anything, and the assertion below would prove nothing.
      const healthy = await guerrillaMail(liveEmptyInbox);
      const liveScheduler = manualScheduler();
      const liveSession = createMailboxSession(
        createProviderManager([healthy.adapter]),
        liveScheduler,
      );
      await liveSession.restore(healthy.stored);
      expect(liveScheduler.pending).toBeGreaterThan(0);
      await liveScheduler.run();
      expect(healthy.recorder.requests.length).toBeGreaterThan(afterRestore);

      // **And the assertion: an `expired` session scheduled nothing.**
      expect(scheduler.pending).toBe(0);
      await scheduler.run();
      expect(recorder.requests).toHaveLength(afterRestore);
    });
  });

  describe("what it refuses to do", () => {
    it("has no inbox on a state that names a mailbox it could not confirm", async () => {
      // **By construction, not by convention.** An `expired` mailbox has no inbox, and
      // giving the variant an `InboxState` would let a client render "no messages" for
      // an address that cannot receive any. The field's absence is asserted so a later
      // edit adding it turns this red rather than making the claim quietly false.
      const expiredSetup = await guerrillaMail(deadSession);
      const expiredState = await createMailboxSession(
        createProviderManager([expiredSetup.adapter]),
        manualScheduler(),
      ).restore(expiredSetup.stored);
      expect("inbox" in expiredState).toBe(false);

      // **The same for the state that could not tell**, because an incomplete check
      // produced no listing either — and a client reading a cached empty one would be
      // reporting a listing nobody performed.
      const failedSetup = await guerrillaMail(refusesListing);
      const failedState = await createMailboxSession(
        createProviderManager([failedSetup.adapter]),
        manualScheduler(),
      ).restore(failedSetup.stored);
      expect("inbox" in failedState).toBe(false);

      // **Positive control: a `ready` state does have one**, so the two assertions
      // above are about the variants rather than about how the test reads a state.
      const readySetup = await guerrillaMail(liveEmptyInbox);
      const readyState = await createMailboxSession(
        createProviderManager([readySetup.adapter]),
        manualScheduler(),
      ).restore(readySetup.stored);
      expect("inbox" in readyState).toBe(true);
    });

    it("will not poll, read from, or list a mailbox it has not confirmed", async () => {
      // **`mailboxOf` is deliberately narrower than the states that hold a mailbox.**
      // `expired` and `restoreFailed` carry one so the page can *name* the address; the
      // session will not *act on* it, because in both cases the provider has either
      // said it is gone or failed to be asked. Polling it would repeat a refused
      // request or produce an inbox for an address that may not receive mail.
      const expiredSetup = await guerrillaMail(deadSession);
      const expiredSession = createMailboxSession(
        createProviderManager([expiredSetup.adapter]),
        manualScheduler(),
      );
      await expiredSession.restore(expiredSetup.stored);
      // **The recorder is reset first, or the count below would include the request
      // reconciliation itself made** — which is the one request this feature is
      // supposed to make, and asserting zero without clearing it fails for a reason
      // that has nothing to do with what is being tested.
      expiredSetup.recorder.reset();

      await expiredSession.checkInbox();
      await expiredSession.openMessage("1").catch(() => undefined);
      await expiredSession.checkInbox();
      expect(expiredSetup.recorder.requests).toHaveLength(0);

      // **Positive control:** the same calls against a `ready` session *do* make
      // requests, so a recorder that records nothing is not what is being observed.
      const readySetup = await guerrillaMail(liveInboxWithOneMessage);
      const readySession = createMailboxSession(
        createProviderManager([readySetup.adapter]),
        manualScheduler(),
      );
      await readySession.restore(readySetup.stored);
      await readySession.checkInbox();
      expect(readySetup.recorder.requests.length).toBeGreaterThan(0);
    });

    it("asks the owning provider about health, and reports rather than infers", async () => {
      // **`subjectOf` rather than `mailboxOf`, and `health()` is its only caller.** A
      // page currently saying "the address you were using is gone" and then reporting
      // the health of an unrelated provider would be answering a question nobody asked.
      // With one provider configured the two are indistinguishable, so this asserts the
      // narrower claim the setup can actually make — and says so rather than implying
      // more.
      const { adapter, recorder, stored } = await guerrillaMail(deadSession);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());
      await session.restore(stored);
      recorder.reset();

      const health = await session.health();

      expect(["ok", "degraded", "unreachable"]).toContain(health.status);
      // **The request went somewhere**, which is what makes the assertion above a
      // reading rather than a default.
      expect(recorder.requests.length).toBeGreaterThan(0);
    });
  });

  describe("the seven states and their narrowing helpers", () => {
    it("gives every helper its own variant and no other", async () => {
      // **Table-driven over the real states, not over literals.** A helper written for
      // a fourth variant as `state.kind === "ready"` compiles and answers `true` for
      // everything, and the only way to catch it is to hand every variant to every
      // helper. Hand-built literals would satisfy this without the session ever
      // producing one of them, so each row below is a state the session actually
      // reported.
      const idleSetup = await guerrillaMail(createsAddress);
      const idleSession = createMailboxSession(
        createProviderManager([idleSetup.adapter]),
        manualScheduler(),
      );
      const idle = idleSession.current();

      const creatingSetup = await guerrillaMail(createsAddress);
      const creatingSession = createMailboxSession(
        createProviderManager([creatingSetup.adapter]),
        manualScheduler(),
      );
      let creating: SessionState = idle;
      const stopCreating = creatingSession.subscribe((next) => {
        if (next.kind === "creating") creating = next;
      });
      await creatingSession.open();
      stopCreating();

      const adoptingSetup = await guerrillaMail(liveEmptyInbox);
      const adoptingSession = createMailboxSession(
        createProviderManager([adoptingSetup.adapter]),
        manualScheduler(),
      );
      let adopting: SessionState = idle;
      const stopAdopting = adoptingSession.subscribe((next) => {
        if (next.kind === "adopting") adopting = next;
      });
      const ready = await adoptingSession.restore(adoptingSetup.stored);
      stopAdopting();

      const expiredSetup = await guerrillaMail(deadSession);
      const expired = await createMailboxSession(
        createProviderManager([expiredSetup.adapter]),
        manualScheduler(),
      ).restore(expiredSetup.stored);

      const restoreFailedSetup = await guerrillaMail(refusesListing);
      const restoreFailed = await createMailboxSession(
        createProviderManager([restoreFailedSetup.adapter]),
        manualScheduler(),
      ).restore(restoreFailedSetup.stored);

      const failedSetup = stubProvider("guerrilla", { failWith: unreachable("guerrilla") });
      const failed = await createMailboxSession(
        createProviderManager([failedSetup]),
        manualScheduler(),
      ).open();

      const everyState: ReadonlyMap<string, SessionState> = new Map([
        ["idle", idle],
        ["creating", creating],
        ["adopting", adopting],
        ["ready", ready],
        ["expired", expired],
        ["restoreFailed", restoreFailed],
        ["failed", failed],
      ]);

      // **Seven rows, because there are seven states.** A variant added without this
      // list being updated would be missing from `everyState`, and the loop below would
      // silently stop testing the helpers against it — so the count is asserted as its
      // own claim rather than inferred from the loop running.
      expect(everyState.size).toBe(7);
      // **And each row is genuinely the state it claims to be.** A fixture that
      // produced seven copies of `idle` would satisfy the helper table below while
      // testing nothing.
      expect([...everyState.keys()].map((kind) => everyState.get(kind)?.kind)).toEqual([
        "idle",
        "creating",
        "adopting",
        "ready",
        "expired",
        "restoreFailed",
        "failed",
      ]);

      const helpers = [
        ["idle", isIdle],
        ["creating", isCreating],
        ["adopting", isAdopting],
        ["ready", isReady],
        ["expired", isExpired],
        ["restoreFailed", isRestoreFailed],
        ["failed", isFailed],
      ] as const;

      for (const [kind, helper] of helpers) {
        for (const [otherKind, other] of everyState) {
          expect(helper(other), `${kind} helper on a ${otherKind} state`).toBe(kind === otherKind);
        }
      }
    });

    it("says what is open on every state that has an opinion about it", async () => {
      // **`openedOf` is the one place a client should read, and this is the proof the
      // union did not grow a variant it cannot answer for.** `failed` has no `opened`
      // field and `openedOf` supplies `none`; every other variant carries one.
      const expiredSetup = await guerrillaMail(deadSession);
      const expiredSession = createMailboxSession(
        createProviderManager([expiredSetup.adapter]),
        manualScheduler(),
      );
      expect(openedOf(expiredSession.current())).toEqual({ kind: "none" });
      const expired = await expiredSession.restore(expiredSetup.stored);
      // **A mailbox the provider has dropped has provably nothing open**, and saying
      // so is what keeps a stale message from staying on screen beside the notice.
      expect(openedOf(expired)).toEqual({ kind: "none" });

      const restoreFailedSetup = await guerrillaMail(refusesListing);
      const restoreFailed = await createMailboxSession(
        createProviderManager([restoreFailedSetup.adapter]),
        manualScheduler(),
      ).restore(restoreFailedSetup.stored);
      expect(openedOf(restoreFailed)).toEqual({ kind: "none" });
    });

    it("does not report a mailbox the session has not been given", async () => {
      // **The negative half of `holdsMailbox`, and the reason `idle` is in the union at
      // all.** A session that has been built and asked nothing holds nothing, and a
      // helper that answered true for `idle` would put a page in a state it cannot
      // render.
      const { adapter } = await guerrillaMail(createsAddress);
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());

      expect(isIdle(session.current())).toBe(true);
      expect(holdsMailbox(session.current())).toBe(false);

      // **And it stays false after a failed creation**, because a `failed` state has no
      // mailbox to show — a helper that answered true for it would let a page render an
      // address it never received.
      const refusing = recordingTransport({
        respond: () => ({ status: 503, headers: {}, body: "" }),
      });
      const refusedAdapter = createGuerrillaAdapter({
        transport: refusing.transport,
        now: () => FIXED_NOW,
      });
      const refused = await createMailboxSession(
        createProviderManager([refusedAdapter]),
        manualScheduler(),
      ).open();
      expect(isFailed(refused)).toBe(true);
      expect(holdsMailbox(refused)).toBe(false);
    });
  });
});
