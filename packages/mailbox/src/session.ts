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
   * assigning in place.
   */
  replace(): Promise<SessionState>;

  /**
   * Ask the provider that owns the current mailbox how it is doing.
   *
   * Reports the provider's own answer. It does not compute a status, does not
   * cache one across a failure, and does not derive anything from elapsed time.
   */
  health(): Promise<ProviderHealth>;

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
 */
export function createMailboxSession(manager: ProviderManager): MailboxSession {
  let state: SessionState = { kind: "creating" };

  const session: MailboxSession = {
    providers: manager.available,

    current: () => state,

    providerFor: (mailbox) => manager.providerFor(mailbox),

    async open() {
      state = { kind: "creating" };
      state = await createOnce(manager);
      return state;
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
    return { kind: "ready", mailbox };
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
