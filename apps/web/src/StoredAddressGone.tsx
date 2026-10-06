/**
 * The state where the provider has said the stored mailbox is gone.
 *
 * ## What the copy must and must not claim
 *
 * It must say the address is gone, because that is what the provider reported. It
 * must **not** present the address as one the user can receive mail at — not in a
 * field, not in a copy control, not in a sentence that invites them to paste it
 * somewhere. The provider is the only authority on whether a session still works, and
 * this is the one state where it has said no.
 *
 * ## Why the address is named at all
 *
 * Because "your saved address is gone" without saying which one leaves a user with two
 * possibilities and no way to tell them apart: the address they came back for, or some
 * other address this page had. Naming it, plainly labelled as no longer working, is
 * what turns an unexplained loss into something the user can check against what they
 * were expecting.
 *
 * **It is not rendered by the `Address` component.** That component offers a copy
 * control and claims the address is usable; both would be false here. This is the
 * reason `expired` carries a mailbox but no inbox — a page given the address alone
 * could get this wrong, and a page given an inbox could render "no messages" for an
 * address that cannot receive any.
 *
 * ## Why two controls
 *
 * **A new address** is the useful one: the stored one is worthless, so there is nothing
 * to protect. **A saved record that still works** is offered too, but as the
 * *secondary* action, because the user chose this page precisely to get back to that
 * address — and a provider that reported a session as dead once may report it live on
 * the next request. The check is cheap and the outcome, if it works, is the thing the
 * user came for.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

export interface StoredAddressGoneProps {
  /** The mailbox the provider no longer recognises. */
  readonly mailbox: Mailbox;
  /** Ask the provider about it again, without discarding it. */
  readonly onRetry: () => void;
  /** Create a new address, replacing the stored record. */
  readonly onReplace: () => void;
}

export function StoredAddressGone({ mailbox, onRetry, onReplace }: StoredAddressGoneProps) {
  return (
    <section className="region region--alert" aria-labelledby="expired-heading">
      <h2 id="expired-heading">Your saved address is gone</h2>

      <p data-testid="expired-explanation">
        Guerrilla Mail does not recognise this address any more, so it will not receive mail.
        Nothing else was wrong and nothing on this device was deleted.
      </p>

      <p data-testid="expired-address">
        The address that has gone is <code>{mailbox.address}</code>.
      </p>

      <button type="button" className="control" onClick={onReplace}>
        Get a new address
      </button>
      <button type="button" className="control" onClick={onRetry}>
        Check the saved address again
      </button>
    </section>
  );
}
