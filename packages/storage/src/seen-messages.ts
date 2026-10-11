/**
 * Which messages a client has already told this device about.
 *
 * ## What the ids mean, and what makes them worth storing
 *
 * An id means **"this device has already reported this message"** - nothing else. It is not a read
 * flag, not a kept message, and not evidence the person saw anything: a notification the platform
 * refused is not recorded, so an id here means the platform *answered*, which is a smaller fact than
 * a person reading it. The record kind exists so a background check can tell a message that arrived
 * while nobody was looking from a message it has already raised.
 *
 * **It is keyed by mailbox id because the ids mean nothing without it.** Carried under one key, the
 * list would have to be emptied whenever this device watched a different mailbox, and every new
 * mailbox would then announce everything already sitting in it. Keying by mailbox also makes a
 * stale entry *ignored* rather than *misread* - the same shape {@link SpectreSiteAssociations}
 * gives a stale association, and for the same reason: this product has no deletion, so an entry
 * naming a mailbox this device no longer holds is a record about something that cannot be checked.
 *
 * ## Why it holds a set of ids and not the messages
 *
 * A `MessageSummary` would grow with every arrival and would hold a sender and a subject - two
 * values this product deliberately keeps out of places a lock screen can read. An id carries none of
 * that, and the only question the record has to answer is *"have I said this one?"*.
 *
 * @module
 */

export interface SpectreSeenMessages {
  /**
   * The message ids this device has been told about for `mailboxId`, or `null` when none are
   * recorded.
   *
   * **Reading one mailbox does not read the whole collection**, for the reason
   * {@link SpectreSiteAssociations} gives: the lookup is the operation a caller makes on a wake, and
   * a client that had to load every mailbox's history to answer one question would hold data it does
   * not need.
   *
   * @param mailboxId - The id of the mailbox the ids were seen in. The ids mean nothing without it.
   * @returns The ids recorded for that mailbox, or `null` when nothing is recorded for it.
   * @throws {Error} If the record could not be read. **Not** when nothing is recorded for
   *   `mailboxId`, and never a partially built value.
   */
  loadSeenMessageIds(mailboxId: string): Promise<readonly string[] | null>;

  /**
   * Record that this device has been told about `ids` for `mailboxId`.
   *
   * **The call replaces the whole set for that one mailbox** rather than adding to it. This layer
   * does not know which ids are new, which are already there, or which a caller has since pruned -
   * and it must not guess, because the caller's list is the one that was derived from an actual
   * check. Idempotence is the caller's question: recording the same set twice is not an error and
   * does not grow the record.
   *
   * **Entries this build cannot read are left in place by a write as well as by a read, and so is
   * every other mailbox's entry.** An implementation that rebuilt the record from the ids it could
   * read would delete the rest, which is the loss this contract exists to prevent - so the record
   * as stored is what the new one is built from.
   *
   * @throws {TypeError} If `mailboxId` is empty, or `ids` is empty, or any id in it is empty.
   *   **Not** when the mailbox is one this device does not hold: this layer stores what it is told.
   * @throws {Error} If the record could not be read, or the write was not committed.
   */
  saveSeenMessageIds(mailboxId: string, ids: readonly string[]): Promise<void>;
}
