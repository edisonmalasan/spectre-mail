/**
 * The session state.
 *
 * **Three named states, not a mailbox plus a loading flag.** Those two can
 * disagree — a loading flag that clears while the mailbox is still null, or a
 * mailbox that arrives while the flag is still true — and the disagreement is a
 * rendering bug that no unit test writes itself. A discriminated union makes the
 * impossible states unrepresentable instead of merely unlikely.
 *
 * Every variant is `readonly` and holds no reference to the session that produced
 * it, so a client may keep a state, compare it, and render it long after the
 * session that made it is gone.
 *
 * @module
 */

import type { Mailbox, NormalizedErrorCode } from "@spectre-mail/core";
import type { ProviderHealth } from "@spectre-mail/providers";

/**
 * One configured provider's contribution to a creation failure.
 *
 * Present so a user can be told *which* provider is refusing, rather than only
 * that something is. With one provider this is the only entry and its `code` is
 * the failure the session reports.
 */
export interface ProviderFailure {
  readonly provider: string;
  readonly code: NormalizedErrorCode;
  /** What the provider said, in its own words, when it said anything. */
  readonly description: string;
}

/**
 * A failure, normalized.
 *
 * `code` is the part a client acts on; `description` is the provider's own words,
 * kept so the page can say more than the code alone. Neither is derived here.
 */
export interface SessionFailure {
  readonly code: NormalizedErrorCode;
  readonly description: string;
  /**
   * Each configured provider, in the order the manager tried them.
   *
   * Where a provider's own failure was recoverable, its entry carries that
   * provider's own code. Where it was not — the manager's composed error has
   * already consumed each code — every entry carries
   * `UNKNOWN_PROVIDER_ERROR` and the shared description, because at that point the
   * cause is **not attributable to one provider**. Listing the providers and
   * marking each unattributable is a different claim from naming the one that
   * failed, and this field must not be read as the latter.
   */
  readonly providerFailures: readonly ProviderFailure[];
  /** The provider's advertised rate limit, verbatim, when it sent one. */
  readonly rateLimit?: string;
}

export type SessionState =
  | { readonly kind: "creating" }
  | { readonly kind: "ready"; readonly mailbox: Mailbox }
  | { readonly kind: "failed"; readonly failure: SessionFailure };

/** Narrowing helpers, so a client reads as `isReady(state)` rather than a cast. */
export function isCreating(state: SessionState): state is { readonly kind: "creating" } {
  return state.kind === "creating";
}

export function isReady(
  state: SessionState,
): state is { readonly kind: "ready"; readonly mailbox: Mailbox } {
  return state.kind === "ready";
}

export function isFailed(
  state: SessionState,
): state is { readonly kind: "failed"; readonly failure: SessionFailure } {
  return state.kind === "failed";
}

/**
 * The provider's health, exactly as the provider stated it.
 *
 * Re-exported rather than redeclared so a client importing from this package and a
 * client importing from `@spectre-mail/providers` are holding the same type, and a
 * change to `ProviderHealth` cannot be half-adopted here.
 */
export type { ProviderHealth };
