/**
 * The address pill: one stable, single-line value with a round Copy control.
 *
 * The address is a single selectable text node — no zero-width characters and no
 * break opportunity inside the value — so copying by hand gives exactly the
 * address. A long address is clipped and can be scrolled (or selected) when it
 * does not fit; the field's box never changes when Copy is pressed. Clipboard
 * feedback is a fixed toast owned by the page, not an in-flow child here.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

export type CopyState = "idle" | "copied" | "failed";

export interface AddressProps {
  readonly mailbox: Mailbox;
  readonly onCopy: () => void;
  /** Drives a brief icon-state change only; never adds content to this component. */
  readonly copyState: CopyState;
}

export function Address({ mailbox, onCopy, copyState }: AddressProps) {
  return (
    <section className="address-region" aria-label="Your temporary email address">
      <p className="address" data-testid="address" title={mailbox.address}>
        <code className="address__value">{mailbox.address}</code>
      </p>
      <button
        type="button"
        className="control control--primary address__copy"
        data-testid="address-copy"
        aria-label="Copy address"
        onClick={onCopy}
      >
        {copyState === "copied" ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>
    </section>
  );
}
