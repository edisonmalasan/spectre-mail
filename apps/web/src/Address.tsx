/**
 * The address, and the action that copies it.
 *
 * The address is rendered as a text node so it is selectable, announced by a
 * screen reader as text, and escaped by the rendering layer. There is no
 * `dangerouslySetInnerHTML` anywhere in this client, and an architecture
 * assertion enforces that - an address is provider-supplied text, and rendering
 * untrusted content as markup is how a mailbox becomes an injection vector.
 *
 * A clipboard failure is a **rendered state, not a thrown error**. The clipboard
 * API rejects for ordinary, expected reasons - no permission, an insecure
 * context, a document not focused - and an unhandled rejection there would leave
 * the user with a button that appears to have worked and an address they never
 * received. The address stays visible and selectable either way, because
 * selecting text by hand is a complete answer to the same need.
 *
 * @module
 */

import { useState } from "react";

import type { Mailbox } from "@spectre-mail/core";

/** What the copy action has done so far. `idle` is the initial state. */
export type CopyState = "idle" | "copied" | "failed";

export interface AddressProps {
  readonly mailbox: Mailbox;
}

export function Address({ mailbox }: AddressProps) {
  const [copy, setCopy] = useState<CopyState>("idle");

  async function copyAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(mailbox.address);
      setCopy("copied");
    } catch {
      // Swallowed deliberately, and reported as state. The alternative - letting the
      // rejection escape - produces an unhandled rejection and a silent no-op.
      setCopy("failed");
    }
  }

  return (
    <section className="region" aria-labelledby="address-heading">
      <h2 id="address-heading">Your address</h2>

      {/*
        A plain text node inside a labelled element. Selecting, copying by hand, and
        announcing all work because this is text and not an image or an input whose
        value would have to be read out separately.

        **The border and the monospace are the design, and neither replaces the text.**
        The address is the one value on this page the user came for, so it is set in
        monospace at the largest size the page uses and given a panel to sit in — and it
        is still selectable text in a `<code>` element, so `website-client`'s requirement
        that the address be presentable as text the user can take is satisfied by the
        markup rather than by the styling.
      */}
      <p className="address" data-testid="address">
        <code className="address__value">{mailbox.address}</code>
      </p>

      <button type="button" className="control" onClick={() => void copyAddress()}>
        Copy address
      </button>

      {/*
        `role="status"` is a polite live region, so the confirmation is announced
        without interrupting whatever the user is doing. The text names what
        happened in words: the outcome never depends on colour, because none is
        applied.

        **And it occupies no line when there is nothing to say.** A live region that
        reserves space reports its own emptiness as a gap on a page whose whole argument
        is that it says only what it knows — so it collapses rather than sitting there
        blank between the button and the inbox.
      */}
      <p role="status" className="status">
        {copy === "copied" && "The address is on your clipboard."}
        {copy === "failed" &&
          "The clipboard refused, so the address was not copied. Select the address above to copy it by hand."}
      </p>
    </section>
  );
}
