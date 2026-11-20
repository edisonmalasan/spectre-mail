/**
 * One row of the inbox.
 *
 * ## A message with nothing in a field still gets a row
 *
 * The sender and the subject may both be empty, and that is a **measurement** rather
 * than a defect: a real Guerrilla Mail message arrived with an empty subject while its
 * sender and body were present (`docs/PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`). A
 * row that dropped such a message would hide the very mail this product exists to
 * deliver, so each field falls back to words saying it was empty — never to nothing,
 * and never to a blank space where content should be.
 *
 * ## The verification marking is text
 *
 * "Contains a one-time code" is a text node, not a colour or an icon. Three reasons,
 * in order of how much they matter: a screen reader announces it, it survives a
 * monochrome display, and it survives the stylesheet — which M7 slice 1 has now
 * written, and which marks the row with an accent **rule** rather than recolouring it.
 * The words are still the marking; the accent reinforces them.
 *
 * ## Undetermined is a distinct state, not an absence
 *
 * `carriesNothing` renders no marking. `undetermined` renders "could not be read".
 * Those are different claims — the first says the message was read and held nothing,
 * the second says it was never read — and rendering them the same way would state
 * about a message this product never looked at that it contains no code.
 *
 * ## Which verdicts get the accent rule, and why `carriesNothing` is not among them
 *
 * The three `carries*` verdicts are the ones where the product knows a verification is
 * there. `carriesNothing` and `undetermined` are **not** marked, and the difference is
 * the whole point of the enum: a rule beside a row is a claim that something is in it.
 * Marking a row whose message could not be read would tell the user to go and look for
 * a code in a message nobody has read, which is the one false claim this inbox exists to
 * avoid.
 *
 * @module
 */

import type { MessageSummary } from "@spectre-mail/core";
import type { MessageVerdict } from "@spectre-mail/mailbox";

export interface InboxRowProps {
  readonly message: MessageSummary;
  readonly verdict: MessageVerdict;
  /**
   * Open this message.
   *
   * **Required, because a row that looks openable and is not would be worse than one
   * that does not pretend.** Slice 2 shipped rows with no control at all and said so in
   * prose, which was honest while it was true. Now that a message can be opened, a row
   * without this callback would render identically to one that can be opened and simply
   * do nothing — the exact failure the previous slice avoided by declining to look
   * clickable.
   */
  readonly onOpen: () => void;
}

/**
 * Whether this row's verdict is one where a verification is actually known to be there.
 *
 * **A closed list rather than "any marking".** `carriesNothing` and `undetermined` both
 * render a marking or nothing at all, and including them would put the accent rule beside
 * a row whose message could not be read — telling the user to go and find a code in a
 * message nobody has opened. Naming the three positive verdicts makes the omission a
 * decision rather than an oversight.
 */
const CARRIES_VERIFICATION: ReadonlySet<MessageVerdict["kind"]> = new Set([
  "carriesCode",
  "carriesLink",
  "carriesCodeAndLink",
]);

/** What a verdict says, in words.
 *
 * Every kind is listed, including the ones that render nothing, because "the row shows
 * no marking" is a deliberate outcome here rather than a missing case.
 */
const MARKING: Readonly<Record<MessageVerdict["kind"], string>> = {
  carriesCode: "Contains a one-time code.",
  carriesLink: "Contains a verification link.",
  carriesCodeAndLink: "Contains a one-time code and a verification link.",
  carriesNothing: "",
  undetermined: "This message could not be read, so what it carries is unknown.",
};

/** What the unread flag says, in words — including when it was never reported. */
function unreadWording(message: MessageSummary): string {
  if (message.unread === true) return "Unread";
  if (message.unread === false) return "Read";
  // Absent is not `false`. The provider did not say, and reporting "Read" would be a
  // claim about a field nobody sent.
  return "Unread state not reported";
}

/** Month abbreviations for a rendered date, fixed rather than locale-dependent. */
const MONTHS: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * An arrival instant as a person can read it.
 *
 * **The fallback is exact and states the absence.** A real Guerrilla welcome
 * message arrived with no date, which the adapters now map to `null`. Zero is not
 * absence — it is `1970-01-01T00:00:00.000Z` on screen — and `NaN` is "Invalid Date",
 * so neither is ever turned into text here. UTC is named in the output so a reader
 * is never invited to guess a time zone the provider did not send.
 *
 * Exported because the open-message reader renders the same field, and two copies
 * of the date format would be two claims about how this product shows a date.
 */
export function formatReceivedAt(receivedAt: number | null): string {
  if (receivedAt === null || !Number.isFinite(receivedAt)) {
    return "Date unavailable";
  }
  const date = new Date(receivedAt);
  const month = MONTHS[date.getUTCMonth()] ?? "???";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

/** The machine-readable instant, omitted entirely when there is no instant to name. */
export function receivedAtDateTime(receivedAt: number | null): string | undefined {
  if (receivedAt === null || !Number.isFinite(receivedAt)) {
    return undefined;
  }
  return new Date(receivedAt).toISOString();
}

export function InboxRow({ message, verdict, onOpen }: InboxRowProps) {
  const marking = MARKING[verdict.kind];

  return (
    // **A `<button>`, not an `<article>` with a click handler.**
    //
    // A row that opens a message is a control, and a control the keyboard cannot reach
    // is not one. A `div` with `onClick` would be operable with a mouse and
    // unreachable by Tab, silent to a screen reader as a control, and given no role —
    // so it would render identically to a real button while behaving like nothing at
    // all for anyone not using a mouse. There is no router here, so there is no link
    // to be honest about either; `design.md` D5 records why.
    //
    // The accessible name carries the subject, so a list of buttons is navigable by
    // their subjects rather than by their position.
    <button
      type="button"
      className={
        CARRIES_VERIFICATION.has(verdict.kind) ? "inbox-row inbox-row--carries" : "inbox-row"
      }
      aria-label={accessibleName(message, verdict)}
      onClick={onOpen}
      data-testid="inbox-row-open"
    >
      <p className="inbox-row__sender" data-testid="inbox-row-sender">
        {message.from === "" ? "No sender reported" : message.from}
      </p>

      <p className="inbox-row__subject" data-testid="inbox-row-subject">
        {message.subject === "" ? "No subject" : message.subject}
      </p>

      {/*
        A readable UTC date, with the machine-readable ISO instant beside it only
        when one exists. The old code rendered `new Date(receivedAt).toISOString()`
        unconditionally, so a missing date became 1970 on screen. The fallback is
        now words that say the date was not reported, and there is no `datetime`
        attribute to claim an instant nobody sent.
      */}
      <p className="inbox-row__time" data-testid="inbox-row-time">
        <time dateTime={receivedAtDateTime(message.receivedAt)}>
          {formatReceivedAt(message.receivedAt)}
        </time>
      </p>

      <p className="inbox-row__unread" data-testid="inbox-row-unread">
        {unreadWording(message)}
      </p>

      {marking !== "" && (
        <p className="inbox-row__verdict" data-testid="inbox-row-verdict">
          {marking}
        </p>
      )}
    </button>
  );
}

/**
 * The row's accessible name.
 *
 * **The marking is part of it, and that is deliberate.** Two messages with the same
 * subject from the same sender are otherwise indistinguishable in a list of buttons, and
 * the one carrying the code is the one the user came for — so a screen reader listing
 * the inbox should say which each is without the user opening either.
 */
function accessibleName(message: MessageSummary, verdict: MessageVerdict): string {
  const subject = message.subject === "" ? "Message with no subject" : message.subject;
  const marking = MARKING[verdict.kind];
  return marking === "" ? `Open ${subject}` : `Open ${subject}. ${marking}`;
}
