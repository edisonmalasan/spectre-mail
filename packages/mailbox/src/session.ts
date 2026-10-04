/**
 * The mailbox session.
 *
 * Owns the sequence a client actually performs — create a mailbox, replace it,
 * ask whether the provider is answering — and nothing else. It has no React, no
 * DOM, no storage, and no network: every provider request is made by an adapter,
 * and this package holds no transport and constructs no URL.
 *
 * **It holds no state between calls.** `current()` returns whatever was last
 * returned, and every operation produces a new immutable `SessionState` rather
 * than mutating one. That is what lets two clients share this file without either
 * of them having to reason about whether a call left something behind.
 *
 * @module
 */

import { isSpectreError, NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, SpectreError } from "@spectre-mail/core";
import type { MailProvider, ProviderHealth, ProviderManager } from "@spectre-mail/providers";

import type { MailboxScheduler } from "./clock";
import { createInboxTracker } from "./inbox";
import { createOpenedMessages } from "./opened";
import type { InboxState, OpenedMessageState, SessionState } from "./state";
import type { SessionFailure } from "./state";

/** What a client can ask of a session. */
export interface MailboxSession {
  /** What the session currently holds. Never a promise; never partially built. */
  current(): SessionState;

  /**
   * Create a mailbox and report the resulting state.
   *
   * Never retries a throttled failure: `provider-abstraction` requires throttling
   * be surfaced rather than silently retried, so a caller that wants to try again
   * calls this again, visibly.
   */
  open(): Promise<SessionState>;

  /**
   * Recover a stored mailbox, or create one when there is none.
   *
   * **`null` means "nothing is stored", and it is an argument rather than an
   * implicit behaviour** so that the decision between recovering and creating is
   * one the caller makes visibly, in one call. With `open` left to do the boot,
   * two things would create a mailbox and a caller that failed to read its own
   * storage would reach for `open` — which is exactly the silent replacement the
   * adoption requirements forbid.
   *
   * **The session is handed a mailbox, never a way to find one.** The parameter is
   * a `Mailbox | null`, so there is no path by which a storage handle could reach
   * this package: the dependency is impossible by type rather than forbidden by a
   * rule.
   *
   * **A stored mailbox is reconciled before it is presented.** This does not read
   * the record and trust it — the record proves only that this device once held a
   * mailbox, which is a different claim from the one the page is about to make. It
   * performs a real provider request, which is also the inbox's first listing, and
   * reports `expired` or `restoreFailed` rather than guessing. The empty-inbox trap
   * `docs/PROVIDERS.md` §3 records is why: a dead Guerrilla session answers
   * `HTTP 200` with no messages and no error.
   *
   * **Never retries, on the same terms as `open`.** A throttled or failed
   * reconciliation is reported, and the caller decides whether to ask again.
   */
  restore(stored: Mailbox | null): Promise<SessionState>;

  /**
   * Discard the current mailbox and create another.
   *
   * The previous state is **not** mutated. A client holding the old value keeps a
   * truthful description of what it held, which is why this returns rather than
   * assigning in place. The inbox is reset with it: message ids are provider-scoped,
   * so one mailbox's analysis carried onto another's message would be a claim about
   * a body this session never read.
   */
  replace(): Promise<SessionState>;

  /**
   * Ask the provider that owns the current mailbox how it is doing.
   *
   * Reports the provider's own answer. It does not compute a status, does not
   * cache one across a failure, and does not derive anything from elapsed time.
   */
  health(): Promise<ProviderHealth>;

  /**
   * Ask for the current mailbox's messages now.
   *
   * This is also the only way back after a throttled refusal, which stops the
   * polling loop rather than backing off - a scheduled retry would be a request the
   * user cannot see and cannot decline.
   */
  checkInbox(): Promise<InboxState>;

  /**
   * Tell the session whether anything is displaying the inbox.
   *
   * Nothing is polled while this is `false`. A check the user cannot see is cost
   * with no possible benefit, and against a provider with no published limit it is
   * cost against an unknown budget.
   */
  reportInboxVisible(visible: boolean): void;

  /**
   * Open one of the current mailbox's messages.
   *
   * **A message the session already read for the inbox's verdict is served without a
   * request.** Detection is deterministic, so re-reading it would spend a provider
   * request to recompute an answer already in hand, against a provider whose tolerance
   * for the existing polling cadence has never been measured. A message with no retained
   * reading is fetched, and an identifier the mailbox does not list is refused locally
   * without contacting anything.
   *
   * The `opening` transition is published before the provider is asked, so a client can
   * say it is reading rather than look frozen — but not on the retained path, where
   * there is nothing to wait for.
   */
  openMessage(messageId: string): Promise<OpenedMessageState>;

  /**
   * Close whatever is open.
   *
   * Exists because the session owns what is open (`design.md` D1): a selection is a
   * provider-scoped message id, and letting the client hold one would mean the client
   * had to remember to drop it when the mailbox is replaced — which is the exact hazard
   * the inbox's verdict cache is documented as guarding against. One owner makes the
   * mailbox change clear it for free.
   */
  closeMessage(): void;

  /**
   * Stop polling and release the scheduler.
   *
   * Slice 1's design recorded that a value-shaped session would have to grow a
   * lifecycle once polling arrived, and this is that cost being paid rather than
   * inherited. `current()` still answers afterwards; the session simply stops.
   *
   * **A caller that unmounts must think before calling this.** React's StrictMode
   * mounts, unmounts, and remounts the same component with the *same* session
   * instance, so an unmount cleanup that destroyed the session would leave the
   * remounted page looking alive and never polling again. A component should
   * report the inbox invisible on unmount instead, which is reversible; this is
   * for a caller that genuinely discards the session.
   */
  destroy(): void;

  /**
   * Be told whenever the session's state changes.
   *
   * Added with polling, and it is not optional: a value-shaped session that can
   * only be read when the caller happens to ask is unrenderable once something is
   * changing on a timer. Every inbox transition — including the move into
   * `checking`, which happens before the provider has answered — arrives here.
   *
   * The returned function unsubscribes. It is called on every change rather than
   * only when a call settles, so a caller never renders a state the session has
   * already left.
   */
  subscribe(listener: (state: SessionState) => void): () => void;

  /** The providers this session may use, in preference order. */
  readonly providers: readonly MailProvider[];

  /**
   * The provider that owns `mailbox`.
   *
   * Never falls back. A mailbox read through a different provider would
   * authenticate with the wrong credentials, so an unconfigured provider is
   * reported rather than substituted.
   *
   * @throws {Error} If no configured provider owns `mailbox`.
   */
  providerFor(mailbox: Mailbox): MailProvider;
}

/**
 * Build a session over `manager`.
 *
 * The manager — not this function — decides which providers exist and in what
 * order. Two clients configured differently therefore get different sessions from
 * the same code, which is the point: the website reaches Guerrilla Mail alone and
 * the extension reaches Mail.tm with Guerrilla Mail behind it, and neither
 * decision leaks into this package.
 *
 * **`scheduler` is required, not defaulted.** A default reaching for the global
 * timer would compile happily here - `@types/node` declares `setTimeout` in exactly
 * the way it declares `navigator`, which slice 1's verification pass measured - and
 * would then be a path that only runs in production. Requiring it means there is no
 * such path to take.
 */
export function createMailboxSession(
  manager: ProviderManager,
  scheduler: MailboxScheduler,
): MailboxSession {
  /**
   * **`idle`, not `creating`.** The session's first act used to be creating a
   * mailbox, which made `creating` an honest description of a session that had been
   * built and asked nothing. Now its first act is to be handed a stored mailbox or
   * told there is none, and a session that has not been asked anything is not
   * creating one — a page rendering before it has asked would say it is asking the
   * provider for a new address while it is in fact asking its own storage.
   */
  let state: SessionState = { kind: "idle", opened: { kind: "none" } };

  const listeners = new Set<(next: SessionState) => void>();

  const opened = createOpenedMessages({
    providerFor: (mailbox) => manager.providerFor(mailbox),
    // Read at call time rather than captured, so the refusal in `open` is against the
    // latest listing and the retained fast path is available at all. The inbox is
    // declared below, so this closure runs after both trackers exist.
    listedSummaries: () =>
      inbox.state.kind === "checked" || inbox.state.kind === "checkFailed"
        ? inbox.state.listing.messages
        : [],
    // **One notification per change, not two.** `withOpened` already publishes — it
    // ends in `setState` — so wrapping its result in a second `setState` here notified
    // every subscriber twice for every opened-state change, with the same value both
    // times. A React client re-rendered on each one, and a subscriber counting
    // transitions saw two `opening`s for a single read.
    //
    // This was found by a test written for a different reason (task 1.3's clause, which
    // asks whether the session reports `opening` before the provider answers), when its
    // synchronous read of the notification log saw `["opening", "opening"]`. Compare the
    // inbox tracker's `onChange` below, which calls `setState` once.
    onChange: (next) => {
      withOpened(state, next);
    },
  });

  const inbox = createInboxTracker({
    providerFor: (mailbox) => manager.providerFor(mailbox),
    scheduler,
    // Republish on every inbox transition, not only when a call returns. The move
    // into `checking` happens synchronously inside the call, before the provider has
    // answered, so a client that refreshed only on return would never see it - and a
    // page that cannot say it is checking looks broken.
    onChange: (next) => {
      if (state.kind === "ready") setState({ ...state, inbox: next });
    },
    // **One read, two consumers.** The inbox tracker reads a new arrival to decide its
    // verdict and hands the same analysis to the opened tracker, which is what lets a
    // message the session already knows be opened without a second request.
    onRead: (summary, analysis) => opened.retain(summary, analysis),
    // Pruned only on a successful listing, so a mailbox the product merely failed to
    // ask keeps every reading it had.
    onListed: (summaries) => opened.pruneTo(summaries.map((summary) => summary.id)),
  });

  /**
   * Replace the state and tell everyone.
   *
   * Listeners are notified from a **copy** of the set: a listener that unsubscribes
   * itself - which React does on every effect cleanup - would otherwise mutate the
   * set being iterated, and the next listener would be skipped. A session that
   * silently stopped notifying one of two subscribers would be very hard to see.
   */
  function setState(next: SessionState): SessionState {
    state = next;
    for (const listener of [...listeners]) listener(state);
    return state;
  }

  /**
   * Republish the session so it carries the tracker's latest inbox, and notify.
   *
   * **Only `ready` gets an inbox, because only `ready` has one.** `expired` and
   * `restoreFailed` hold a mailbox so a page can *name* the address the user came
   * back for, and neither has a listing — attaching one would let a client render
   * "no messages" for an address the provider has just said is gone, which is the
   * same unrepresentable reading the variant withholds by not having the field.
   */
  function withInbox(next: SessionState): SessionState {
    return setState(
      next.kind === "failed"
        ? next
        : next.kind === "ready"
          ? { ...next, inbox: inbox.state, opened: opened.state }
          : { ...next, opened: opened.state },
    );
  }

  /**
   * Republish with a new opened-message state, and notify.
   *
   * **Every non-failed state carries `opened`, so nothing else has to be handled
   * here.** That is what keeps the address and the message it belonged to from coming
   * apart on screen: `creating` and `adopting` say nothing is open as loudly as
   * `ready` does, and a client rendering any of them has a single field to read.
   *
   * This was three explicit branches before adoption, one per variant, and the
   * fourth and fifth states would have made seven. `failed` is the only variant with
   * no such field, so it is the only branch — a rule that had to be restated per
   * variant was a rule that would eventually be forgotten for one.
   *
   * **What the `failed` branch still does, stated rather than implied.** It returns
   * `current` unchanged, but it reaches that through `setState`, so a subscriber is
   * notified with an identical value. That is deliberate - removing it would mean
   * deciding a `failed` session should go silent, which is a different claim from the
   * one this function makes. It is close to unreachable: a `failed` state can only
   * follow `createOnce`, which runs after `opened.reset()`, and `reset` publishes only
   * when the reported state actually changes. The comment previously claimed the
   * branches were about the payload, which was true, and a reader took that as being
   * about the notification too.
   */
  function withOpened(current: SessionState, next: OpenedMessageState): SessionState {
    return setState(current.kind === "failed" ? current : { ...current, opened: next });
  }

  const session: MailboxSession = {
    providers: manager.available,

    current: () => state,

    providerFor: (mailbox) => manager.providerFor(mailbox),

    subscribe(listener) {
      listeners.add(listener);
      // Told the current state on the way in, so a subscriber does not have to call
      // `current()` separately and cannot end up one render behind a session it
      // subscribed to after the state had already moved.
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },

    async open() {
      inbox.reset();
      // **Both reset together, and `creating` picks the state up from the tracker.**
      // An opened message is a provider-scoped id, so carrying one across a mailbox
      // change would show the previous mailbox's mail beside the new mailbox's address
      // — the id-scoping hazard the inbox's `reset` documents, applied to the
      // selection. `withInbox` reads `opened.state` rather than being handed a literal,
      // so the two cannot disagree about whether anything is open.
      opened.reset();
      withInbox({ kind: "creating", opened: opened.state });
      return withInbox(await createOnce(manager));
    },

    async restore(stored) {
      // Nothing stored is the first-visit path, and it is the *same* path rather than
      // a parallel one. A second implementation of "create a mailbox" would be free
      // to drift — different states, different order — and the drift would show up as
      // a first visit behaving differently from a retry, which is the one pair of
      // paths a user cannot tell apart and must not be able to.
      if (stored === null) return session.open();

      // Both trackers forget the previous mailbox first, on the same grounds `open`
      // gives: an opened message is a provider-scoped id, and message ids are
      // provider-scoped too, so carrying either across a mailbox change would be a
      // claim about a mailbox this session has not reached yet.
      inbox.reset();
      opened.reset();

      // **Published before the provider is asked.** A page that cannot say it is
      // checking looks broken, and this request is the slowest thing a returning
      // visitor waits through — it is the one moment `adopting` is worth a variant
      // of its own rather than reusing `creating`, whose copy would say the page is
      // asking for a *new* address.
      withInbox({ kind: "adopting", opened: opened.state });

      // **One request, and it is the inbox's first listing.** Reusing the tracker
      // rather than calling the provider directly means a restored mailbox arrives
      // already analysed: the tracker reads each new arrival to decide its verdict
      // and hands the reading to the opened-message tracker, which is what lets a
      // message be opened later without a second request. It also means a separate
      // "is this mailbox alive" probe would be a second request against a provider
      // that publishes no limit for this path, answering a weaker question.
      const listing = await inbox.check(stored);

      if (listing.kind === "checked") {
        // The reconciliation listing *is* the inbox state, and it arrives already
        // analysed.
        //
        // **`listing` is passed and then replaced, and the falsification pass is why
        // that is written down rather than tidied away.** `withInbox` reads
        // `inbox.state` for the `ready` branch, so whatever arrives in this field is
        // discarded — the tracker is the single source of truth, which is the better
        // design. A mutation that replaced `inbox: listing` with `notStarted` left the
        // whole suite **green**, because it changes nothing.
        //
        // So the earlier comment here — "carried as `listing` rather than `inbox.state`
        // because they are the same value here" — described a choice that had no
        // effect, and implied a guarantee the line did not provide. The field exists
        // only because `SessionReady` requires one. What actually guarantees the
        // restored mailbox arrives with its messages read is that the listing came
        // from `inbox.check(stored)` rather than from a second request, and that is
        // what `makes one request to reconcile` asserts.
        return withInbox({ kind: "ready", mailbox: stored, inbox: listing, opened: opened.state });
      }

      if (listing.kind !== "checkFailed") {
        // **Unreachable, and reported rather than cast away.**
        //
        // `check` returns `notStarted` only when handed no mailbox, and returns
        // `checking` only as a transitional publish it has already moved past by the
        // time its promise resolves. This call passed a mailbox, so the answer is
        // `checked` or `checkFailed`. The compiler cannot see that — `InboxState` has
        // four variants and the two it cannot rule out are real variants a client
        // handles elsewhere — so a cast here would be hiding a possibility from the
        // next reader rather than documenting it.
        //
        // Reporting it means that if the tracker's contract ever changes to make this
        // reachable, a page finds out at runtime instead of rendering an address on
        // the strength of an inbox that is still being fetched.
        throw new Error(
          `The inbox tracker reported "${listing.kind}" instead of a listing, so a stored mailbox was neither confirmed nor refused.`,
        );
      }

      // **Stop the loop on both failure paths, and the reason is not tidiness.**
      // `check` reschedules, so without this the session would go on listing the very
      // mailbox it is about to report as gone — a request the provider has already
      // refused, repeating forever, for a state nothing reads. `reset` publishes
      // nothing, so no inbox transition is announced that the session cannot honour.
      inbox.reset();

      if (listing.failure.code === NormalizedErrorCode.MAILBOX_EXPIRED) {
        return withInbox({ kind: "expired", mailbox: stored, opened: opened.state });
      }

      // Everything else is "could not tell", including a throttle. Reporting a
      // throttled check as `expired` would tell a user their address is gone on the
      // strength of a provider asking us to slow down.
      return withInbox({
        kind: "restoreFailed",
        mailbox: stored,
        failure: listing.failure,
        opened: opened.state,
      });
    },

    async replace() {
      return session.open();
    },

    async health() {
      // With no mailbox there is no owning provider, so this reports the health of
      // the first configured provider rather than inventing a status for a mailbox
      // that does not exist. `subjectOf` rather than `mailboxOf`, so an `expired` or
      // `restoreFailed` session is still asked about the provider that owns the
      // address it is telling the user about.
      const owner = subjectOf(state);
      const provider = owner === undefined ? firstConfigured(manager) : manager.providerFor(owner);
      return provider.checkHealth();
    },

    async checkInbox() {
      // The tracker notifies on every transition, including the move into
      // `checking`, so there is nothing to republish here: doing it again would tell
      // subscribers about a state they were just told.
      return inbox.check(mailboxOf(state));
    },

    reportInboxVisible(visible) {
      inbox.setVisible(visible);
    },

    openMessage(messageId) {
      return opened.open(mailboxOf(state), messageId);
    },

    closeMessage() {
      opened.reset();
    },

    destroy() {
      inbox.destroy();
      opened.destroy();
    },
  };

  return session;
}

/**
 * One creation attempt.
 *
 * Separate from `open` so the "creating" transition and the outcome are distinct
 * steps, and so `replace` can be `open` rather than a second copy of it.
 */
async function createOnce(manager: ProviderManager): Promise<SessionState> {
  try {
    const mailbox = await manager.createMailbox();
    return { kind: "ready", mailbox, inbox: { kind: "notStarted" }, opened: { kind: "none" } };
  } catch (cause) {
    return { kind: "failed", failure: normalize(cause, manager.available) };
  }
}

/**
 * The mailbox this session may *act on*, which is only ever a `ready` one.
 *
 * **Deliberately narrower than `subjectOf`, and the difference is load-bearing.**
 * `expired` and `restoreFailed` hold a mailbox so the page can name it, but this
 * session will not list it, read from it, or poll it: the provider has either said
 * it is gone or failed to be asked, and in both cases a listing would either repeat
 * a refused request or produce an inbox for an address that may not receive mail.
 * `checkInbox` on such a session therefore reports `notStarted` — which is true,
 * since this session has never started checking a mailbox.
 */
function mailboxOf(state: SessionState): Mailbox | undefined {
  return state.kind === "ready" ? state.mailbox : undefined;
}

/**
 * The mailbox this session is *about*, which includes the two it could not confirm.
 *
 * **Only `health()` uses this, and the reason is that a provider question and a
 * mailbox question are not the same.** Asking "is this provider working" and getting
 * an answer about whichever provider happens to be first configured would be a true
 * answer to a question nobody asked, on a page currently saying the user's address
 * is gone. The owning provider is the one the answer is about.
 */
function subjectOf(state: SessionState): Mailbox | undefined {
  switch (state.kind) {
    case "ready":
    case "expired":
    case "restoreFailed":
      return state.mailbox;
    default:
      return undefined;
  }
}

function firstConfigured(manager: ProviderManager): MailProvider {
  const first = manager.available[0];
  if (first === undefined) {
    // Unreachable through `createProviderManager`, which refuses an empty list.
    // Reported rather than asserted, because a session built over a hand-rolled
    // manager should still fail with something a user could be shown.
    throw new Error(
      "This session has no provider configured, so it cannot report health or create a mailbox.",
    );
  }
  return first;
}

/**
 * Turn whatever was thrown into a normalized failure.
 *
 * **Nothing here parses prose to recover a code.** If a caller were handed a
 * failure whose `code` had been destroyed, the only way to recover `RATE_LIMITED`
 * from it would be to read it out of the message — and a rule that parses
 * strings to recover structured data fails silently and permanently the first time
 * the wording changes. So an unrecognised failure becomes
 * `UNKNOWN_PROVIDER_ERROR`, which `core` already documents as an expected outcome
 * rather than an exceptional one, and the thrown value is carried alongside it.
 */
function normalize(cause: unknown, providers: readonly MailProvider[]): SessionFailure {
  if (isSpectreFailure(cause)) {
    return {
      code: cause.code,
      description: cause.description,
      providerFailures: [
        {
          provider: cause.provider,
          code: cause.code,
          description: cause.description,
        },
      ],
      ...(cause.rateLimit === undefined ? {} : { rateLimit: cause.rateLimit }),
    };
  }

  // The manager's composed wrapper, which names every provider it tried. Its text
  // is kept as the description because there is nothing structured left in it, and
  // each provider's own code was already consumed by the manager — which is why a
  // client with several providers gets one aggregated code and a client with one
  // gets the provider's own.
  const description = cause instanceof Error ? cause.message : String(cause);

  return {
    code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
    description,
    // One entry per configured provider, each carrying the aggregate code.
    //
    // This branch cannot know *which* provider caused the failure, so it does not
    // guess: every configured provider is listed with `UNKNOWN_PROVIDER_ERROR` and
    // the shared description. An earlier version of this function kept an array and
    // branched on its length, which read as though a recoverable code were
    // sometimes available here — it never was, because the branch above returns
    // first. The list says "these are the providers this session had, and the cause
    // is not attributable", which is what is actually known.
    providerFailures: providers.map((provider) => ({
      provider: provider.id,
      code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
      description,
    })),
  };
}

/**
 * Whether `value` is a `SpectreError`.
 *
 * `core` exports `isSpectreError` and this delegates to it rather than
 * restating the shape. Two definitions of one predicate is how a check ends up
 * matching something the real one would not — and this function's whole job is to
 * decide whether a `code` can be trusted, so it is exactly the predicate that must
 * not be approximated.
 */
function isSpectreFailure(value: unknown): value is SpectreError & { readonly rateLimit?: string } {
  return isSpectreError(value);
}
