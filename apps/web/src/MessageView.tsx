/**
 * One open message.
 *
 * ## It renders text and has no escape hatch
 *
 * The readable text arrives as a string and goes into a `<pre>` as a text child. React
 * escapes it, so markup a provider delivered is *shown* rather than interpreted — which
 * is the whole reason `OpenedMessage` has a field named `readable` and no field holding
 * the body as received (`design.md` D3). There is no branch in this file that could
 * render markup, because there is nothing here to interpret: the decision was made in
 * the projection, once, and this component has no way to overrule it.
 *
 * `tests/architecture/boundaries.test.ts` separately asserts that no file under `apps/`
 * reaches for `dangerouslySetInnerHTML` or `innerHTML`, but that is a backstop for the
 * spelling. What proves the behaviour is a test asserting the markup appears in the
 * document's **text** and that no element was created from it.
 *
 * ## It shows what it found and does not act on it
 *
 * Codes and links are rendered as text. **No copy control and no anchor**, because both
 * are the verification workflow, which the roadmap schedules at M10 — and a link that
 * navigates because a message was rendered is a side effect of reading someone's mail.
 * `design.md` D4 records the conflict this resolves: the roadmap's M5 acceptance
 * criteria list "copy the OTP" while `AGENTS.md` assigns OTP copy to M10.
 *
 * ## No confidence number, anywhere
 *
 * `mail-parsing` describes every score as *"a judgement, not a probability"* traceable
 * to a published rule. Rendering `0.85` beside a code would invite reading it as an 85%
 * chance of being right, which is a claim the parser does not make and cannot support.
 * So the codes appear in the order the parser ranked them, with one sentence saying the
 * reading may be wrong — which honours "no detection is ever reported as certain"
 * without inventing a number.
 *
 * @module
 */

import type { OpenedMessage, OpenedMessageState } from "@spectre-mail/mailbox";

export interface MessageViewProps {
  /** What the session reports as open. Rendered as-is, never re-derived. */
  readonly opened: OpenedMessageState;
  /** Close the message and go back to the list. */
  readonly onClose: () => void;
  /**
   * Ask for this message again, after a failure.
   *
   * Rendered only in the `openFailed` branch, for the reason the inbox's retry is: a
   * throttled read stops rather than backing off, so an explicit retry the user can see
   * and decline is the only way back. A retry the user cannot see is the silent retry
   * `provider-abstraction` forbids.
   */
  readonly onRetry: () => void;
}

export function MessageView({ opened, onClose, onRetry }: MessageViewProps) {
  return (
    <section className="region message" aria-labelledby="message-heading">
      <h3 id="message-heading">Message</h3>

      {opened.kind === "none" && (
        <p data-testid="message-none">No message is open. Choose one from the inbox.</p>
      )}

      {opened.kind === "opening" && (
        // **Reads as a read in progress, not as an empty message.** The two look almost
        // identical on screen otherwise, and one of them is a lie: there is no message
        // here yet, and a user who is waiting for a code should be told the page is
        // still working.
        <p data-testid="message-opening">Reading this message…</p>
      )}

      {opened.kind === "openFailed" && (
        <div className="finding" data-testid="message-open-failed">
          <p data-testid="message-open-failed-reason">
            This message could not be read, so SpectreMail cannot say whether it carries a code or a
            link. That is not the same as there being none.
          </p>
          <p data-testid="message-open-failed-detail">{opened.failure.description}</p>
          <button type="button" className="control" onClick={onRetry}>
            Try reading it again
          </button>
        </div>
      )}

      {opened.kind === "opened" && <OpenedMessageBody message={opened.message} />}

      {/*
        **Always rendered, for every state.** A user who opens a message and finds no
        way back is stuck, and the control has to be reachable in the states where
        nothing is open too so it cannot shift position as the message loads.
      */}
      <button type="button" className="control" onClick={onClose} data-testid="message-close">
        Back to the inbox
      </button>
    </section>
  );
}

interface OpenedMessageBodyProps {
  readonly message: OpenedMessage;
}

function OpenedMessageBody({ message }: OpenedMessageBodyProps) {
  return (
    <div data-testid="message-opened">
      <p className="message__meta" data-testid="message-from">
        {message.from === "" ? "No sender reported" : message.from}
      </p>

      <p className="message__subject" data-testid="message-subject">
        {message.subject === "" ? "No subject" : message.subject}
      </p>

      <p className="message__meta mono" data-testid="message-received-at">
        <time dateTime={new Date(message.receivedAt).toISOString()}>
          {new Date(message.receivedAt).toISOString()}
        </time>
      </p>

      {/*
        `<pre>` rather than a styled `<div>`, and that is not a layout choice: it
        preserves the line breaks the message arrived with, and it is a plain text
        container with no semantics a screen reader would have to be taught.

        **M7's answer to "how should this look": as the provider's text, not as ours.**
        Monospace, a sunken surface, and a scrollable slab, because the message was
        written by someone else and setting it in the page's own typeface and measure
        would imply this page composed it. `white-space: pre-wrap` keeps the author's
        line breaks while still reflowing, which is the one concession to a screen that
        is not a fixed-width terminal.
      */}
      <pre className="message__body" data-testid="message-readable">
        {message.readable}
      </pre>

      <MessageCodes codes={message.codes} />
      <MessageLinks links={message.links} />
    </div>
  );
}

interface MessageCodesProps {
  readonly codes: OpenedMessage["codes"];
}

function MessageCodes({ codes }: MessageCodesProps) {
  if (codes.length === 0) {
    // **Says so, rather than leaving an absence to be inferred.** A message that was read
    // and held no candidate is a *finding*, and it is the honest counterpart to
    // `message-open-failed`: this one really was looked at.
    return (
      <div className="finding" data-testid="message-codes-none">
        <p>No one-time code was found in this message.</p>
      </div>
    );
  }

  return (
    <div className="finding" data-testid="message-codes">
      <h4>One-time codes found</h4>
      {/* The caveat sits with the codes rather than in a footnote, because a code shown
          without it reads as certain - and `mail-parsing` guarantees no detection is
          ever reported as certain. */}
      <p className="finding__caveat" data-testid="message-codes-caveat">
        These are readings of the message and may be wrong. The most likely one is first.
      </p>
      <ol className="codes">
        {codes.map((code, index) => (
          // **Index-keyed, and the reason is worth stating.** Two candidates can be the
          // same value - a message that repeats its code is not unusual - and a key of
          // `code.value` would then collide and React would drop one of them silently.
          // The list is ranked and short, so its position is a better identity here
          // than its contents.
          <li key={`${index}-${code.value}`} data-testid="message-code">
            <code className="code">{code.value}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface MessageLinksProps {
  readonly links: OpenedMessage["links"];
}

function MessageLinks({ links }: MessageLinksProps) {
  if (links.length === 0) {
    return (
      <div className="finding" data-testid="message-links-none">
        <p>No verification link was found in this message.</p>
      </div>
    );
  }

  return (
    <div className="finding" data-testid="message-links">
      <h4>Verification links found</h4>
      <p className="finding__caveat" data-testid="message-links-caveat">
        These are readings of the message and may be wrong. They are shown as text, not as links you
        can follow: following one is the verification workflow, which this page does not perform
        yet.
      </p>
      <ul className="links">
        {links.map((link, index) => (
          <li key={`${index}-${link.url}`} className="link" data-testid="message-link">
            {/* The host first, because it is the part a user judges a link by, and
                `VerificationLink` already carries it so a view does not have to parse
                the URL to get it. */}
            <span className="link__host" data-testid="message-link-host">
              {link.hostname}
            </span>{" "}
            {/* Plain text and deliberately not an `href`. See the module note. */}
            <span className="link__url" data-testid="message-link-url">
              {link.url}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
