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

import type {
  Mailbox,
  MessageSummary,
  NormalizedErrorCode,
  VerificationCode,
  VerificationLink,
} from "@spectre-mail/core";
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
  | {
      readonly kind: "creating";
      /**
       * The previously opened message, kept while a new mailbox is being created.
       *
       * **Present on `creating` and always `none`, and that is the whole reason it is
       * here rather than only on `ready`.** A `SessionState` union whose `creating`
       * variant carries no mailbox cannot also carry the fact that the previous
       * mailbox's message was closed, so a client holding the old `ready` value
       * through the transition would keep rendering the old message beside a "creating
       * your address" heading. Both states have to say the same thing about what is
       * open, or the address and the message it belonged to come apart on screen for
       * exactly as long as the request takes.
       */
      readonly opened: OpenedMessageState;
    }
  | {
      readonly kind: "ready";
      readonly mailbox: Mailbox;
      readonly inbox: InboxState;
      readonly opened: OpenedMessageState;
    }
  | { readonly kind: "failed"; readonly failure: SessionFailure };

/**
 * One opened message: what a listing row already shows, plus what is worth showing
 * about the message itself.
 *
 * ## Why this is not the model's `Message`
 *
 * `Message.text` is documented as **the body as received**, and that body is an HTML
 * document in the one case that was measured: Guerrilla Mail declared a plain-text
 * content type and delivered an HTML body, and the real message arrived as raw HTML
 * (`docs/PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`). Overwriting that field with
 * extracted readable text would make a field whose documented meaning is "the body as
 * received" hold something else, and the mismatch would be invisible at every use.
 *
 * **The rename to `readable` is the safety property, not a naming preference.** There
 * is deliberately no field here a renderer could mistake for markup to interpret, so
 * rendering a message unsafely stops being a decision any call site is able to make.
 * The raw body is dropped at the point of projection rather than retained and
 * trusted.
 *
 * ## Why it extends `MessageSummary` rather than repeating it
 *
 * A listing row and an opened message show the same message fields, and duplicating
 * them would let `MessageSummary` gain a field the row renders while this type quietly
 * did not. The compiler then guarantees the two cannot drift, exactly as it does for
 * `Message`.
 */
export interface OpenedMessage extends MessageSummary {
  /**
   * The message's visible content as plain text.
   *
   * Markup-free by construction: it comes from the parser's extraction, which produces
   * text and reports anchors separately. The body as received is not retained anywhere.
   */
  readonly readable: string;
  /** One-time code candidates, ranked, highest confidence first. Empty when none. */
  readonly codes: readonly VerificationCode[];
  /** Verification links, ranked. Empty when no link's wording names one. */
  readonly links: readonly VerificationLink[];
}

/**
 * What is open, right now.
 *
 * Four states rather than a selected id plus a result, for `InboxState`'s reason: an id
 * and a result that disagree are both representable if they are two fields, and neither
 * disagreement — a selected id with no message, a message with no id — is a state any
 * client should have to handle.
 *
 * **`openFailed` is not `opened` with nothing in it.** That distinction is slice 2's
 * `undetermined` discipline one level down, and it is the one false claim that costs a
 * user the code they were waiting for: a view rendering an unreadable message as an
 * opened message with no codes states that the product looked and found nothing, when
 * in fact it never managed to look.
 */
export type OpenedMessageState =
  | { readonly kind: "none" }
  | { readonly kind: "opening"; readonly messageId: string }
  | { readonly kind: "opened"; readonly message: OpenedMessage }
  | {
      readonly kind: "openFailed";
      readonly messageId: string;
      readonly failure: SessionFailure;
    };

/**
 * The `creating` variant, extracted rather than restated.
 *
 * **A derived type, and that is the point.** These three helpers first wrote out their
 * variants by hand, and adding `opened` to `creating` and `ready` broke them at compile
 * time with "Property 'opened' is missing". The compiler caught it, which is the good
 * outcome — but the fix is not to paste the field into two more places. Extracting the
 * variants means a fourth field is added once, and a hand-written predicate that
 * disagreed with the union would be a type error rather than a silently-wrong narrowing.
 */
type SessionCreating = Extract<SessionState, { readonly kind: "creating" }>;
type SessionReady = Extract<SessionState, { readonly kind: "ready" }>;
type SessionFailed = Extract<SessionState, { readonly kind: "failed" }>;

/** Narrowing helpers, so a client reads as `isReady(state)` rather than a cast. */
export function isCreating(state: SessionState): state is SessionCreating {
  return state.kind === "creating";
}

export function isReady(state: SessionState): state is SessionReady {
  return state.kind === "ready";
}

export function isFailed(state: SessionState): state is SessionFailed {
  return state.kind === "failed";
}

/**
 * The inbox and opened-message variants, likewise extracted.
 *
 * Same reason as the session's three. An earlier revision of `isInboxCheckFailed` spelled
 * its variant out across five lines, so adding a field to `InboxState` would have been a
 * five-line edit that the compiler *could* catch — but only if the author remembered to
 * make it, and a forgotten edit here is a narrowing that claims a field exists when it
 * does not.
 */
type InboxNotStarted = Extract<InboxState, { readonly kind: "notStarted" }>;
type InboxChecking = Extract<InboxState, { readonly kind: "checking" }>;
type InboxChecked = Extract<InboxState, { readonly kind: "checked" }>;
type InboxCheckFailed = Extract<InboxState, { readonly kind: "checkFailed" }>;
type OpenedNone = Extract<OpenedMessageState, { readonly kind: "none" }>;
type OpenedOpening = Extract<OpenedMessageState, { readonly kind: "opening" }>;
type OpenedOpened = Extract<OpenedMessageState, { readonly kind: "opened" }>;
type OpenedOpenFailed = Extract<OpenedMessageState, { readonly kind: "openFailed" }>;

/** Narrowing helpers for the inbox, matching the session's. */
export function isInboxNotStarted(state: InboxState): state is InboxNotStarted {
  return state.kind === "notStarted";
}

export function isInboxChecking(state: InboxState): state is InboxChecking {
  return state.kind === "checking";
}

export function isInboxChecked(state: InboxState): state is InboxChecked {
  return state.kind === "checked";
}

export function isInboxCheckFailed(state: InboxState): state is InboxCheckFailed {
  return state.kind === "checkFailed";
}

/** Narrowing helpers for the opened message, matching the session's and inbox's. */
export function isNoMessageOpen(state: OpenedMessageState): state is OpenedNone {
  return state.kind === "none";
}

export function isMessageOpening(state: OpenedMessageState): state is OpenedOpening {
  return state.kind === "opening";
}

export function isMessageOpened(state: OpenedMessageState): state is OpenedOpened {
  return state.kind === "opened";
}

export function isMessageOpenFailed(state: OpenedMessageState): state is OpenedOpenFailed {
  return state.kind === "openFailed";
}

/**
 * What is open, for any session state.
 *
 * **`failed` reports `none`, and that is a claim rather than a default.** A mailbox
 * that could not be created has no messages, so it has nothing open; reporting
 * something else would let a client keep showing a message beside a creation failure.
 */
export function openedOf(state: SessionState): OpenedMessageState {
  return state.kind === "failed" ? { kind: "none" } : state.opened;
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
