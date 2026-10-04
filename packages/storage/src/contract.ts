/**
 * The storage contract.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

/**
 * Where a client keeps what SpectreMail knows about its own mailbox.
 *
 * ## Why it is two operations and not a key–value bag
 *
 * `M6`'s Storage block names five record kinds — mailboxes, provider credentials,
 * preferences, a message-metadata cache, and provider health — and this contract
 * has room for one of them. The other four have no consumer, and a record with no
 * consumer is a schema to migrate rather than a feature.
 *
 * A generic `get(key)` / `set(key, value)` would have been the smaller interface,
 * and it was rejected. It moves every naming, versioning, and narrowing decision to
 * the caller, which means the extension at M8 reimplements all three against
 * `chrome.storage` — a platform with no transactions, so the durability guarantee
 * below would have to be restated per platform rather than implemented once. The
 * contract is where "what is a usable stored record" lives; a key–value bag has
 * nowhere to put it.
 *
 * ## `null` means exactly one thing
 *
 * `loadMailbox` reports the absence of a stored mailbox as `null`, and reports a
 * **failure** as a rejected promise. It never reports the second as the first.
 *
 * This is the storage-layer form of the trap `docs/PROVIDERS.md` §3 records: an
 * unrecognised Guerrilla session answers `HTTP 200` with an empty inbox and no
 * error, so "nothing there" and "nothing could be read" are indistinguishable
 * unless the product says which happened. Applied to storage the consequence is
 * worse than a wrong-looking inbox. A read reported as "nothing stored" makes a
 * client believe this is a first visit, create a new mailbox, and overwrite the
 * address the user came back for — with no error anywhere in the product.
 *
 * ## It holds no storage API of its own
 *
 * Every method is a promise and nothing on this interface names a platform API,
 * a database, or a transaction. That is what lets `packages/storage` be the only
 * package in the workspace that speaks to one, and what
 * `tests/architecture/boundaries.test.ts` checks in both directions.
 */
export interface SpectreStorage {
  /**
   * The mailbox this device last stored, or `null` when none is stored.
   *
   * @returns The mailbox, narrowed and validated on the way out of storage.
   * @throws {Error} If the stored state could not be read. **Not** when nothing
   *   is stored, and never a partially built value.
   */
  loadMailbox(): Promise<Mailbox | null>;

  /**
   * Store `mailbox` as the current one.
   *
   * Resolves only once the platform has committed the write, so a caller that
   * awaits this and then loses the tab cannot come back to a missing mailbox.
   *
   * @throws {TypeError} If `mailbox` is not a mailbox the shared model describes.
   * @throws {Error} If the write was not committed.
   */
  saveMailbox(mailbox: Mailbox): Promise<void>;
}
