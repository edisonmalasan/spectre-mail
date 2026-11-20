/**
 * The address pill and its round Copy control, in the hero panel.
 *
 * The address is rendered as selectable text, never markup, with the break
 * opportunity after the `@` so a narrow viewport cannot split the domain. Both
 * Copy controls on the page call the same `onCopy` callback.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

export type CopyState = "idle" | "copied" | "failed";

export interface AddressProps {
  readonly mailbox: Mailbox;
  readonly onCopy: () => void;
  readonly copyState: CopyState;
}

export function Address({ mailbox, onCopy, copyState }: AddressProps) {
  const at = mailbox.address.lastIndexOf("@");
  const localPart = at === -1 ? mailbox.address : mailbox.address.slice(0, at + 1);
  const domainPart = at === -1 ? "" : mailbox.address.slice(at + 1);

  return (
    <section className="address-region" aria-label="Your temporary email address">
      <p className="address" data-testid="address">
        <code className="address__value">
          {localPart}
          <wbr />
          {domainPart}
        </code>
      </p>
      <button
        type="button"
        className="control control--primary address__copy"
        aria-label="Copy address"
        data-testid="address-copy"
        onClick={onCopy}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </svg>
      </button>
      <p role="status" className="status">
        {copyState === "copied" && "The address is on your clipboard."}
        {copyState === "failed" &&
          "The clipboard refused, so the address was not copied. Select the address above to copy it by hand."}
      </p>
    </section>
  );
}
