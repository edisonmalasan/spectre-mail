/**
 * The mailboxes this device can insert.
 *
 * ## Why this is a second contract rather than a second field
 *
 * `SpectreStorage` stores **one** mailbox, under one key, and a second save overwrites the first.
 * That is right for the website — one page, one address — and it is what made the roadmap's
 * `hostname -> mailbox ID` mapping impossible to write honestly: a map from every site this device
 * has visited to *the* mailbox could only ever name one mailbox, and would go stale the moment a
 * second was created. So the device gained somewhere to keep several, and this is that place.
 *
 * The alternative was widening `SpectreStorage` to carry both. It is one interface instead of two,
 * and it would have forced the website's IndexedDB adapter to implement operations no page reads or
 * writes — which is the argument `contract.ts` already makes about itself: "a record with no
 * consumer is a schema to migrate rather than a feature."
 *
 * ## Newest first, and why the head means something
 *
 * The order is not presentational. A device's *current* mailbox is the one it made most recently,
 * so reporting them newest-first makes "the first entry" and "the current mailbox" the same answer —
 * and a client that wanted both had to reconcile two records, with no transaction to reconcile them
 * in. See {@link SpectreMailboxes.addMailbox} for why one write settles that.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

export interface SpectreMailboxes {
  /**
   * Every mailbox this device holds, newest first.
   *
   * The first entry is the mailbox {@link SpectreStorage.loadMailbox} reports as current, which is
   * the property that lets one read answer both questions.
   *
   * @returns The mailboxes, each narrowed on the way out of storage. An empty array means this
   *   device holds none; it is **not** a failure.
   * @throws {Error} If the collection could not be read. **Not** when this device holds none, and
   *   never a partially built value.
   */
  loadMailboxes(): Promise<readonly Mailbox[]>;

  /**
   * Record `mailbox` on this device as the newest one.
   *
   * ## One operation, and that is not only a convenience
   *
   * `chrome.storage` has **no transactions**. An implementation that recorded "the current mailbox"
   * and "this mailbox is in the collection" as two writes could be interrupted between them, leaving
   * the device holding an address its own collection does not know — and a client that trusts the
   * collection would offer nothing for an address it had just created. One record removes the
   * question rather than narrowing the window in which it can go wrong.
   *
   * Recording a mailbox this device already holds **moves it to the front** rather than adding a
   * second copy. A duplicate address is not a thing a user did, and an insert that appended would
   * grow the collection every time a person retried.
   *
   * @throws {TypeError} If `mailbox` is not a mailbox the shared model describes.
   * @throws {Error} If the write was not committed.
   */
  addMailbox(mailbox: Mailbox): Promise<void>;
}
