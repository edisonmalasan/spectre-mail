/**
 * The state where the stored mailbox could not be checked.
 *
 * ## Why this is a separate component from `MailboxFailure`
 *
 * Because the two say opposite things about the address, and sharing a component would
 * force one of them to lie.
 *
 * `MailboxFailure` renders "No address yet" and its copy says "Nothing was created",
 * because the provider refused a creation. That is the truth after a failed
 * `open()`. Here an address exists, is on screen, and the provider merely did not
 * answer — so "No address yet" would be false, and a user who believed it would
 * conclude the address had never existed.
 *
 * **And `StoredAddressGone` is the other half of the same pair.** That one says the
 * address is gone; this one must not, on any wording, because a dropped request says
 * nothing about whether the mailbox works. The two states exist as separate values in
 * the session precisely so that no page has to compare an error code to work out which
 * of those two sentences is allowed — and this component is where that separation
 * becomes words.
 *
 * ## What is preserved
 *
 * The address, named as *unconfirmed*. It is the address the user came back for, and
 * hiding it would be a small loss next to the risk of their believing they had lost
 * it. The failure detail is shown verbatim for the same reason `MailboxFailure` shows
 * it: it is the only place a user can see what actually happened.
 *
 * ## Why "use a new address for now" does not replace the record
 *
 * Because this state does not establish that the stored mailbox is dead — only that
 * nobody could ask. Handing out a fresh address is a reasonable thing for a user to
 * want; overwriting the only copy of an address that may still work is not a thing
 * SpectreMail should do on their behalf. So the control creates an address for this
 * visit and leaves what is stored alone, and the button says so.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";
import type { SessionFailure } from "@spectre-mail/mailbox";

export interface StoredAddressUncheckedProps {
  /** The mailbox that could not be checked. Carried, not discarded. */
  readonly mailbox: Mailbox;
  readonly failure: SessionFailure;
  /** Ask the provider about it again, without discarding it. */
  readonly onRetry: () => void;
  /** Create an address for this visit, leaving the stored record untouched. */
  readonly onStartFresh: () => void;
}

export function StoredAddressUnchecked({
  mailbox,
  failure,
  onRetry,
  onStartFresh,
}: StoredAddressUncheckedProps) {
  return (
    <section className="region region--alert" aria-labelledby="restore-failed-heading">
      <h2 id="restore-failed-heading">SpectreMail could not check your saved address</h2>

      <p data-testid="restore-failed-explanation">
        This says only that the check did not complete. It is not a claim about the address, and
        what is saved on this device has not been changed.
      </p>

      <p data-testid="restore-failed-address">
        The address it could not check is <code>{mailbox.address}</code>.
      </p>

      <p data-testid="restore-failed-detail">{failure.description}</p>

      {failure.rateLimit !== undefined && (
        <p data-testid="restore-failed-rate-limit">
          The provider advertised this limit: <code>{failure.rateLimit}</code>. SpectreMail does not
          know what it is counted per.
        </p>
      )}

      <button type="button" className="control" onClick={onRetry}>
        Check again
      </button>
      <button type="button" className="control" onClick={onStartFresh}>
        Use a new address for now
      </button>
    </section>
  );
}
