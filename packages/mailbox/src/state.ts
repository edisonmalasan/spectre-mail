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

import type { Mailbox, MessageSummary, NormalizedErrorCode } from "@spectre-mail/core";
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

/**
 * What is known about whether a message carries something the user came for.
 *
 * **`carriesNothing` and `undetermined` are different claims and the difference is
 * the whole point of this type.** `carriesNothing` says the message was read and no
 * verification was found in it. `undetermined` says it was never read - the read
 * failed, or has not happened yet. A row that cannot tell them apart reports "no
 * code here" about a message the product never looked at, and that is the one false
 * claim in this product that costs a user the code they were waiting for.
 */
export type MessageVerdict =
  | { readonly kind: "carriesCode" }
  | { readonly kind: "carriesLink" }
  | { readonly kind: "carriesCodeAndLink" }
  | { readonly kind: "carriesNothing" }
  | { readonly kind: "undetermined" };

/**
 * What the inbox currently holds.
 *
 * A union rather than `messages` plus a `loading` flag, for slice 1's reason, which
 * the inbox makes worse rather than better: a flag that clears while the list is
 * still stale, or a list that arrives while the flag is still set, are both states
 * the type now makes unrepresentable.
 *
 * **`checkFailed` keeps the last known `listing`.** A failed check is a condition of
 * the inbox, not the loss of it - the rows the user was already reading are still
 * true, and blanking them because one request failed would be destroying information
 * the product has, in exchange for dramatising a problem the user can do nothing
 * about. What a failure must never do is touch the mailbox: that lives on
 * `SessionState`, which is why a requirement can say a failed check leaves the
 * address alone.
 */
export type InboxState =
  | { readonly kind: "notStarted" }
  | { readonly kind: "checking" }
  | { readonly kind: "checked"; readonly listing: InboxListing }
  | {
      readonly kind: "checkFailed";
      readonly listing: InboxListing;
      readonly failure: SessionFailure;
    };

/**
 * The last thing a check actually learned.
 *
 * `messages` and `verdicts` are carried together and never reconciled by a client,
 * because the map is what stops a row claiming nothing about a message that has not
 * been read: a client renders a verdict by looking the id up here, and the lookup
 * missing *is* the answer - `undetermined`.
 */
export interface InboxListing {
  /** What the owning provider reported, in the order it reported it. */
  readonly messages: readonly MessageSummary[];
  /** Verdicts by message id. Ids absent from it are `undetermined`, not `carriesNothing`. */
  readonly verdicts: ReadonlyMap<string, MessageVerdict>;
  /**
   * The provider's advertised rate limit, verbatim, when it sent one.
   *
   * Reported rather than acted on. The poller honours a stated delay as a floor, but
   * it does not read a scope into the string: `1; w=60` does not say what it is
   * counted per, and a value that appeared on screen as a number would be an
   * inference presented as a measurement.
   */
  readonly rateLimit?: string;
}

export type SessionState =
  | { readonly kind: "creating" }
  | { readonly kind: "ready"; readonly mailbox: Mailbox; readonly inbox: InboxState }
  | { readonly kind: "failed"; readonly failure: SessionFailure };

/** Narrowing helpers, so a client reads as `isReady(state)` rather than a cast. */
export function isCreating(state: SessionState): state is { readonly kind: "creating" } {
  return state.kind === "creating";
}

export function isReady(
  state: SessionState,
): state is { readonly kind: "ready"; readonly mailbox: Mailbox; readonly inbox: InboxState } {
  return state.kind === "ready";
}

export function isFailed(
  state: SessionState,
): state is { readonly kind: "failed"; readonly failure: SessionFailure } {
  return state.kind === "failed";
}

/** Narrowing helpers for the inbox, matching the session's. */
export function isInboxNotStarted(state: InboxState): state is { readonly kind: "notStarted" } {
  return state.kind === "notStarted";
}

export function isInboxChecking(state: InboxState): state is { readonly kind: "checking" } {
  return state.kind === "checking";
}

export function isInboxChecked(
  state: InboxState,
): state is { readonly kind: "checked"; readonly listing: InboxListing } {
  return state.kind === "checked";
}

export function isInboxCheckFailed(state: InboxState): state is {
  readonly kind: "checkFailed";
  readonly listing: InboxListing;
  readonly failure: SessionFailure;
} {
  return state.kind === "checkFailed";
}

/**
 * The verdict for one message, defaulting to `undetermined`.
 *
 * The default is the safe direction on purpose: a caller asking about a message the
 * map has never heard of gets "not known" rather than an accidental `undefined` it
 * might treat as a negative answer.
 */
export function verdictFor(
  verdicts: ReadonlyMap<string, MessageVerdict>,
  messageId: string,
): MessageVerdict {
  return verdicts.get(messageId) ?? { kind: "undetermined" };
}

/**
 * The provider's health, exactly as the provider stated it.
 *
 * Re-exported rather than redeclared so a client importing from this package and a
 * client importing from `@spectre-mail/providers` are holding the same type, and a
 * change to `ProviderHealth` cannot be half-adopted here.
 */
export type { ProviderHealth };
