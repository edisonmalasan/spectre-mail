/**
 * The state where the page could not read its own storage.
 *
 * ## What this state is not allowed to do
 *
 * It must not create a mailbox. That is the single most important thing about this
 * region, and it is not a detail of the wording.
 *
 * `spectre-storage` reserves `null` for "nothing is stored" and rejects for every
 * other failure, because the alternative is catastrophic and quiet: a client told
 * "nothing stored" when it had failed to read believes it is a first visit, creates a
 * mailbox, and saves over the record it never managed to look at. The user loses the
 * address they came back for and is told nothing.
 *
 * **So this page stops here.** It has not asked the session to do anything at all,
 * and no address is rendered — not even the one it might hold, because it does not
 * know that it holds one. `MailboxFailure`'s "No address yet" is close enough that a
 * reader should know the difference: that one follows a *creation* the provider
 * refused, and this one precedes any creation at all.
 *
 * ## Why the reason is shown
 *
 * A user whose browser has storage blocked, or whose storage threw, can act on the
 * difference. "SpectreMail cannot use storage in this browser" and "the read failed"
 * lead somewhere; "something went wrong" leads nowhere. The message is whatever the
 * failure said, verbatim — it is not rewritten, because this layer has no vocabulary
 * for a storage failure and inventing one would be a second, worse description of a
 * problem the storage layer already describes.
 *
 * @module
 */

export interface BootFailureProps {
  /** What the failure said. Shown as text. */
  readonly reason: string;
  /** Ask again whether this device has something stored. */
  readonly onRetry: () => void;
}

export function BootFailure({ reason, onRetry }: BootFailureProps) {
  return (
    <section aria-labelledby="boot-failure-heading">
      <h2 id="boot-failure-heading">SpectreMail cannot check what it has saved</h2>

      <p data-testid="boot-failure-explanation">
        This page did not create an address, because it could not read the one saved on this device
        and will not replace it without knowing what it was.
      </p>

      <p data-testid="boot-failure-reason">{reason}</p>

      <button type="button" onClick={onRetry}>
        Check again
      </button>
    </section>
  );
}
