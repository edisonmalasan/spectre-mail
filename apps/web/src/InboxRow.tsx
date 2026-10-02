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
 * monochrome display, and it survives the stylesheet M7 has not written yet.
 *
 * ## Undetermined is a distinct state, not an absence
 *
 * `carriesNothing` renders no marking. `undetermined` renders "could not be read".
 * Those are different claims — the first says the message was read and held nothing,
 * the second says it was never read — and rendering them the same way would state
 * about a message this product never looked at that it contains no code.
 *
 * @module
 */

import type { MessageSummary } from "@spectre-mail/core";
import type { MessageVerdict } from "@spectre-mail/mailbox";

export interface InboxRowProps {
  readonly message: MessageSummary;
  readonly verdict: MessageVerdict;
}

/**
 * What a verdict says, in words.
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

export function InboxRow({ message, verdict }: InboxRowProps) {
  const marking = MARKING[verdict.kind];

  return (
    <article aria-label={message.subject === "" ? "Message with no subject" : message.subject}>
      <p data-testid="inbox-row-sender">
        {message.from === "" ? "No sender reported" : message.from}
      </p>

      <p data-testid="inbox-row-subject">
        {message.subject === "" ? "No subject" : message.subject}
      </p>

      {/*
        An ISO 8601 instant in UTC rather than a formatted local time. It is
        unambiguous whatever the reader's locale and time zone, and it is the same
        string on every machine — which is what lets a test assert a row's contents
        without pinning a locale. M7 owns how a time should *look*; a fixed zone here
        is the honest default, not the designed one.
      */}
      <p data-testid="inbox-row-time">
        <time dateTime={new Date(message.receivedAt).toISOString()}>
          {new Date(message.receivedAt).toISOString()}
        </time>
      </p>

      <p data-testid="inbox-row-unread">{unreadWording(message)}</p>

      {marking !== "" && <p data-testid="inbox-row-verdict">{marking}</p>}
    </article>
  );
}
