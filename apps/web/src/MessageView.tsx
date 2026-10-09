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
 * ## It acts on a detection only when the user asks
 *
 * Codes and links were rendered as text with **no copy control and no anchor**, and the
 * reason was sound: a link that navigates because a message was *rendered* is a side
 * effect of reading somebody's mail. That prohibition is `website-client`'s
 * *"This slice shows what it found and does not act on it"*, and `design.md` D1 records
 * the conflict it resolved — the roadmap's M5 acceptance criteria list "copy the OTP"
 * while `AGENTS.md` assigns OTP copy to the verification workflow milestone.
 *
 * **That requirement is removed, and what replaces it is narrower than it looks.** Both
 * actions now exist, and neither is reachable except by an explicit activation:
 *
 * - `MessageCodes` gives **every** code its own control, because `mail-parsing` never
 *   reports a detection as certain, so the page cannot know which candidate the user
 *   wants and must not choose for them.
 * - `MessageLinks` renders a **real anchor**, not a click handler — `javascript:` URLs,
 *   a synthetic click and `window.open` are three ways to make a link that reads as
 *   inert do something else, and anchor markup is the form the platform, the browser
 *   tier and a user's own middle-click all agree on. It opens in a **new tab** and
 *   carries `rel="noopener noreferrer"`: `noopener` because a new tab opened without it
 *   hands the destination a `window.opener` back to this page, and `noreferrer` because
 *   **this page's URL carries a mailbox address**, so the default `Referer` would hand
 *   the one piece of this product's data a user has an interest in keeping to an
 *   unrelated site.
 *
 * Rendering still does nothing on its own. There is no `useEffect` here, no effect at
 * all, and nothing in this file that runs before a user does something: the previous
 * requirement's surviving half — *"opening a message copies nothing and follows
 * nothing"* — is now carried by `website-client`'s `A detection is acted on only when
 * the user asks`, and the case that asserts it opens a message carrying two codes and
 * reads the clipboard stub.
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

import { useState } from "react";

import type { OpenedMessage, OpenedMessageState } from "@spectre-mail/mailbox";

// **The three states come from the address control, and that is deliberate.** It is the
// only place in this product that has already answered the hard question a copy control
// raises — what the page does when the clipboard refuses — and the answer is a rendered
// state rather than a thrown error, because the clipboard rejects for ordinary reasons
// (no permission, an insecure context, an unfocused document) and an unhandled rejection
// would leave a button that appears to have worked. Declaring a second, identical union
// here would give one platform behaviour two failure vocabularies on one page, and the
// two would drift.
//
// A type-only import, so it costs no runtime dependency between two components.
import type { CopyState } from "./Address";

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
  /**
   * Each code's copy result, keyed by the code's **position**.
   *
   * **Component-local, and not session state.** This is the position of a control on
   * this page and nothing else: it is not the mailbox's state, it is not persisted, it
   * does not survive closing the message, and no other context can read it. Putting it in
   * `packages/mailbox` would mean a framework-free and DOM-free package carries a field
   * whose only writer is one component in one client.
   *
   * **The consequence is asserted rather than worked around.** Re-opening the message
   * resets every result to idle, and that is the intended behaviour: a stale "copied"
   * beside a code the user has not re-copied would be a false claim about the clipboard,
   * which is the exact failure `Address.tsx`'s comment exists to prevent.
   *
   * **Keyed by index for the same reason the `<li>` keys are.** Two candidates can carry
   * the same value, so a key of the code's contents would collide and one row's result
   * would overwrite another's.
   */
  const [results, setResults] = useState<Readonly<Record<number, CopyState>>>({});

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

  /**
   * Put one code on the clipboard, and record what happened.
   *
   * **The value is written unchanged.** A code is a sequence of digits a server is
   * waiting for; trimming it, casing it or wrapping it produces a code that looks right
   * on screen and is refused on arrival, and the page would be reporting a copy it did
   * not perform.
   *
   * **A rejection is swallowed and reported as state**, for the reason `Address.tsx`
   * states at length, and **the code stays on screen either way**: selecting it by hand is
   * a complete answer to the same need.
   */
  async function copyCode(value: string, index: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setResults((previous) => ({ ...previous, [index]: "copied" }));
    } catch {
      setResults((previous) => ({ ...previous, [index]: "failed" }));
    }
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
            <code className="code">{code.value}</code>{" "}
            {/*
              **The visible label is the accessible name, and it names the code.**

              Not `aria-label` over a "Copy code" button: WCAG's *Label in Name* requires
              the accessible name to contain the visible text, and "Copy 493291" does not
              contain "Copy code". Putting the value in the visible text satisfies both
              halves with no attribute at all — and among two candidates it is also the
              only label that tells a screen-reader user *which* one they are choosing,
              which is the whole reason there is a control per code rather than one.
            */}
            <button
              type="button"
              className="control"
              data-testid="message-code-copy"
              onClick={() => void copyCode(code.value, index)}
            >
              {`Copy ${code.value}`}
            </button>
            {/*
              `role="status"` is a polite live region, so the outcome is announced without
              interrupting. **One per code rather than one for the list**, because the
              claim is about a particular code: a single region would have to name which
              one was copied, and a result that has to name its subject is a result that
              can be ambiguous about it.

              **And it occupies no line when there is nothing to say**, for the reason
              `Address.tsx` gives — a live region that reserves space reports its own
              emptiness as a gap on a page whose argument is that it says only what it
              knows. The outcome never depends on colour, because none is applied.
            */}
            <span role="status" className="status" data-testid="message-code-status">
              {results[index] === "copied" && `${code.value} is on your clipboard.`}
              {results[index] === "failed" &&
                `The clipboard refused, so ${code.value} was not copied. Select it to copy it by hand.`}
            </span>
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
      {/*
        The caveat sat here and said the links were *not* followable. That sentence became
        false the moment the anchor landed, and a caveat that contradicts the control
        beside it is worse than no caveat — so it is reworded, not dropped: the reading is
        still only a reading, which is the half of it that has not changed and the half
        `mail-parsing` actually guarantees.

        **The condition is stated rather than implied**, because it is the property the
        removed requirement used to hold in its entirety: following one is still something
        a person does, not something a rendered message does.
      */}
      <p className="finding__caveat" data-testid="message-links-caveat">
        These are readings of the message and may be wrong. Each one is opened only if you ask it
        to, in a new tab.
      </p>
      <ul className="links">
        {links.map((link, index) => (
          <li key={`${index}-${link.url}`} className="link" data-testid="message-link">
            {/*
              **A real anchor, and that is the whole decision.** Not a click handler, not
              `window.open`, not a synthetic click on a `<span>`: three ways to make a link
              that reads as inert do something else, none of which a middle-click, a
              screen reader, or the browser tier's own DOM reader would agree with. Anchor
              markup is the form the platform already defines.

              **`target="_blank"`** so the message stays on screen to be read again, which
              is the reason a user wanted a second tab at all.

              **`rel="noopener noreferrer"`** — see the module note. `noopener` because a
              new tab opened without it hands the destination a `window.opener` reference
              back to a cross-origin page the user never chose to be related to;
              `noreferrer` because this page's URL carries a **mailbox address**, so the
              default `Referer` would hand the one piece of this product's data a user has
              an interest in keeping to a host they have no reason to trust with it.

              **`className="link__anchor"` with `color: inherit`** so no user-agent link
              colour can appear on a page whose every other colour is a declared token,
              and so the affordance is declared rather than inherited from the browser.
            */}
            <a
              className="link__anchor"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="message-link-anchor"
            >
              {/* The host first, because it is the part a user judges a link by, and
                  `VerificationLink` already carries it so a view does not have to parse
                  the URL to get it. **Inside the anchor**, so clicking the host is
                  clicking the link — and so what is clickable and what is being clicked
                  are the same thing, which is the defect a host rendered beside an
                  anchor is. */}
              <span className="link__host" data-testid="message-link-host">
                {link.hostname}
              </span>
            </a>{" "}
            {/* The full URL is **kept**, not replaced by the host. A shortened link is a
                link whose destination cannot be read before being acted on, and reading
                the destination before acting on it is the entire reason this product
                declines to guess which code you meant. */}
            <span className="link__url" data-testid="message-link-url">
              {link.url}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
