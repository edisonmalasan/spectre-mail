/**
 * What a session did, counted.
 *
 * ## Why this is here and not in a client
 *
 * **Because both clients read the same session, and a fold over a session's states belongs beside
 * the states.** The website and the extension each report the outcomes of their own session, and the
 * thing that stops them drifting is that they **fold the same function** rather than each holding a
 * copy of the idea. A copy in each client is two implementations that agree until the first edit,
 * and the first edit is the one nobody reviews.
 *
 * **And it is here because it reads `SessionState`,** which this package owns. It has **no
 * dependency on the presentation layer** and knows nothing about how a report is rendered: it
 * produces **numbers and names**, and the client wraps them in whatever shape it shows.
 *
 * ## What it counts, and what it refuses to
 *
 * **Counts, normalized names, and one elapsed duration** -- and the shape of those is the
 * presentation layer's business. What belongs here is the rule: **a count is never a record of
 * what**, and **a duration is never a moment**.
 *
 * There is no field here for an address, a message id, a sender, a subject, a hostname, a URL, a
 * form, a field or content, **and that is the point** -- a thing a report cannot express is a thing
 * a report cannot leak.
 *
 * ## What it does not do
 *
 * **It does not persist anything.** Every value here is held by the caller for as long as the
 * session is open, and there is no store behind it, no key and no adapter. **A measurement that
 * does not outlive the session it happened in does not need a place to be stored.**
 *
 * @module
 */

import type { InboxListing, SessionState } from "./state";

/**
 * What a session has done so far.
 *
 * **A plain record of numbers and a record of names, and every field is one a report may carry.**
 */
export interface SessionDiagnostic {
  /** How many mailboxes this session created. */
  readonly created: number;
  /** How many mailboxes this session failed to create, by the provider's normalized code. */
  readonly creationFailures: Readonly<Record<string, number>>;
  /** How many listings this session received. */
  readonly listings: number;
  /** How many inbox checks this session could not complete. */
  readonly checksFailed: number;
  /** How many messages this session found a code or a link in. */
  readonly detections: number;
  /**
   * How long the first message took to arrive, in milliseconds.
   *
   * **`null` until one arrives, and it never becomes `0`.** A message that has not arrived is not a
   * failure and has no arrival time, and a report that said "0 ms" for a message that never came
   * would be measuring the wrong thing.
   */
  readonly firstArrivalMs: number | null;
  /**
   * The moment this session created its first mailbox, in milliseconds since the epoch.
   *
   * **This is the one value here that is a moment rather than a duration, and it never leaves the
   * caller.** It exists so the arrival time can be a *difference*, and it is not in the reported
   * shape because the report carries a duration.
   */
  readonly startedAtMs: number | null;
}

/** A session that has done nothing yet. */
export function emptySessionDiagnostic(): SessionDiagnostic {
  return {
    created: 0,
    creationFailures: {},
    listings: 0,
    checksFailed: 0,
    detections: 0,
    firstArrivalMs: null,
    startedAtMs: null,
  };
}

/**
 * Fold one session state into the diagnostic.
 *
 * **Pure, and that is what makes it testable.** It takes the state and the clock and returns a new
 * diagnostic; it does not read a clock itself, so a test can say exactly what time it was.
 *
 * @param diagnostic - What the session has done so far.
 * @param state - The session's current state.
 * @param nowMs - The current time, in milliseconds since the epoch.
 * @returns The diagnostic with this state folded in.
 */
export function observeSessionState(
  diagnostic: SessionDiagnostic,
  state: SessionState,
  nowMs: number,
): SessionDiagnostic {
  // **The inbox is read before the session's own kind**, because a session that has failed can
  // still carry an inbox from an earlier success, and the inbox's own transitions are the finer
  // grain.
  const inbox = "inbox" in state ? state.inbox : null;
  const listings = inbox?.kind === "checked" ? diagnostic.listings + 1 : diagnostic.listings;
  const checksFailed =
    inbox?.kind === "checkFailed" ? diagnostic.checksFailed + 1 : diagnostic.checksFailed;
  const detections =
    inbox?.kind === "checked"
      ? diagnostic.detections + countDetections(inbox.listing)
      : diagnostic.detections;

  if (state.kind === "failed") {
    return {
      ...diagnostic,
      creationFailures: countFailure(diagnostic, state.failure.code),
      listings,
      checksFailed,
      detections,
      startedAtMs: diagnostic.startedAtMs ?? nowMs,
    };
  }

  if (state.kind === "ready") {
    // **The first arrival is measured once and never re-measured.** A second listing is not a
    // second arrival, and a report that counted the *latest* listing's wait would report a duration
    // that shrank every time the inbox was refreshed.
    const startedAt = diagnostic.startedAtMs ?? nowMs;
    const firstArrivalMs =
      diagnostic.firstArrivalMs ??
      (inbox?.kind === "checked" && inbox.listing.messages.length > 0
        ? Math.max(0, nowMs - startedAt)
        : null);

    return {
      ...diagnostic,
      created: diagnostic.created + 1,
      listings,
      checksFailed,
      detections,
      firstArrivalMs,
      startedAtMs: startedAt,
    };
  }

  if (state.kind === "expired" || state.kind === "restoreFailed") {
    const code = state.kind === "expired" ? "MAILBOX_EXPIRED" : state.failure.code;
    return {
      ...diagnostic,
      creationFailures: countFailure(diagnostic, code),
      listings,
      checksFailed,
      detections,
    };
  }

  return { ...diagnostic, listings, checksFailed, detections };
}

/**
 * Whether a session state is one the caller has not folded in yet.
 *
 * ## Why this is a separate question, and why it is asked here
 *
 * **Because the fold counts an observation, and a caller can observe the same state twice.** React's
 * `StrictMode` runs an effect twice on mount in development, so a hook that folds on every effect
 * would count one failure twice **and the count is what a person is shown.**
 *
 * **The guard compares identity, not content.** A session publishes a *new* state object on each
 * transition, so identity says "this is a transition" exactly, and **two transitions that look
 * alike are two things that happened.**
 *
 * **The state is a parameter and never a field**, because the diagnostic must not hold a mailbox --
 * a `SessionState` carries one, with its address and its credentials.
 *
 * @param last - The state the caller folded in last, or `null` when it has folded in none.
 * @param next - The state in hand.
 * @returns Whether `next` is one the caller has not folded in.
 */
export function isNewSessionState(last: SessionState | null, next: SessionState): boolean {
  return last !== next;
}

/** One more failure of a kind, by the provider's own normalized code. */
function countFailure(
  diagnostic: SessionDiagnostic,
  code: string,
): Readonly<Record<string, number>> {
  return { ...diagnostic.creationFailures, [code]: (diagnostic.creationFailures[code] ?? 0) + 1 };
}

/**
 * How many messages a listing carried something worth detecting in.
 *
 * **A count of messages, and never a code, a link, a sender or a subject.** The parser's verdict is
 * a fact about a message, and the report carries how many messages there were.
 */
function countDetections(listing: InboxListing): number {
  let found = 0;
  // **The verdicts are a map keyed by message id, and the ids are not read.** A count of messages
  // something was detected in is the fact; the ids that named them are the other thing a report may
  // not hold.
  for (const verdict of listing.verdicts.values()) {
    if (
      verdict.kind === "carriesCode" ||
      verdict.kind === "carriesLink" ||
      verdict.kind === "carriesCodeAndLink"
    ) {
      found += 1;
    }
  }
  return found;
}
