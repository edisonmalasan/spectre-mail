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
import type { InboxState } from "./state";
import type { SessionFailure, SessionState } from "./state";

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
  let state: SessionState = { kind: "creating" };

  const listeners = new Set<(next: SessionState) => void>();

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

  /** Republish the session so it carries the tracker's latest inbox, and notify. */
  function withInbox(next: SessionState): SessionState {
    return setState(next.kind === "ready" ? { ...next, inbox: inbox.state } : next);
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
      withInbox({ kind: "creating" });
      return withInbox(await createOnce(manager));
    },

    async replace() {
      return session.open();
    },

    async health() {
      // With no mailbox there is no owning provider, so this reports the health of
      // the first configured provider rather than inventing a status for a mailbox
      // that does not exist.
      const owner = mailboxOf(state);
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

    destroy() {
      inbox.destroy();
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
    return { kind: "ready", mailbox, inbox: { kind: "notStarted" } };
  } catch (cause) {
    return { kind: "failed", failure: normalize(cause, manager.available) };
  }
}

function mailboxOf(state: SessionState): Mailbox | undefined {
  return state.kind === "ready" ? state.mailbox : undefined;
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
