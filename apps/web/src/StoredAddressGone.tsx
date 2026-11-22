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
 * ## Why there are no controls
 *
 * **This is a notice, not a choice.** A definitive `expired` answer is the provider's
 * own verdict that the address cannot receive mail, so asking a person to pick between
 * a new address and re-checking the dead one adds a step that cannot change the
 * answer. The page acts on the verdict itself: it creates and persists a replacement
 * without activation, and this component only says, truthfully, which address was
 * reported gone. A static notice cannot offer a second interpretation of a definitive
 * answer.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

export interface StoredAddressGoneProps {
  /** The mailbox the provider no longer recognises. */
  readonly mailbox: Mailbox;
}

export function StoredAddressGone({ mailbox }: StoredAddressGoneProps) {
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
    </section>
  );
}
