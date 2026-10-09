/**
 * The storage contract.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

/**
 * Where a client keeps what SpectreMail knows about its own mailbox.
 *
 * ## This is one of three contracts, and that is now said rather than implied
 *
 * `M6`'s Storage block names five record kinds — mailboxes, provider credentials,
 * preferences, a message-metadata cache, and provider health — and this contract has
 * room for **one** of them: the single current mailbox. `site-associations` added two
 * more record kinds this layer now serves, `SpectreMailboxes` and
 * `SpectreSiteAssociations`, and **a site association was not one of the five**, which
 * is why the scope statement above had to be answered rather than stretched.
 *
 * They are separate interfaces rather than members here because they have different
 * consumers and different platforms: this one has two adapters, each new one has one,
 * and widening this contract would have made the website's IndexedDB adapter implement
 * operations no page calls — "a record with no consumer is a schema to migrate rather
 * than a feature", which is the sentence this paragraph was written to keep true.
 * Removal stays here and stays singular, because `clearAll` is the layer's, not a
 * record kind's.
 *
 * ## Why it is three operations and not a key–value bag
 *
 * A generic `get(key)` / `set(key, value)` would have been the smaller interface, and it
 * was rejected. It moves every naming, versioning, and narrowing decision to the caller,
 * which means the extension at M8 reimplements all three against `chrome.storage` — a
 * platform with no transactions, so the durability guarantee below would have to be
 * restated per platform rather than implemented once. The contract is where "what is a
 * usable stored record" lives; a key–value bag has nowhere to put it.
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

  /**
   * Remove everything this device holds.
   *
   * ## It means *everything*, and that is the whole requirement
   *
   * An implementation SHALL NOT satisfy this by removing only the records this build
   * recognises. Deleting the one key this contract stores today is a smaller function
   * that passes every test anyone would write against today's single record — and it
   * becomes a silent lie the moment a record kind is added by a later build, with no
   * failing test to notice, because nothing tested the guarantee.
   *
   * The roadmap's Storage block names four further record kinds. Removing the whole
   * store removes them too, which is what a control described to the user as clearing
   * all local data means.
   *
   * ## Idempotent on purpose
   *
   * Removing when nothing is stored SHALL succeed. The state the user asked for is
   * the state they are already in, and an error for having reached it is an error
   * about nothing. It also means clearing twice — or clearing on a device that stored
   * nothing — is not a failure.
   *
   * ## A blocked removal is reported rather than waited on
   *
   * Measured against this repository's own test substrate, three things are true of a
   * removal blocked by a second open connection:
   *
   * - `onblocked` fires, and the request does not finish while that connection is open;
   * - **a fresh read cannot complete either**, so an implementation that tried to
   *   verify afterwards would hang rather than answer;
   * - **once the blocking connection closes, the queued removal completes.**
   *
   * So reporting is not a substitute for waiting, it is the only available answer: the
   * wait lasts until some *other* tab closes, which a page can neither cause nor
   * predict and a user cannot be asked to sit through. A control that stopped
   * responding for an unbounded time is the outcome this contract exists to prevent.
   *
   * **The third point is why a refusal may say "not done yet" and may not say "still
   * there".** Reporting the refusal does not cancel the queued removal, so at the
   * moment a caller is told the removal failed, it is genuinely true that nothing has
   * been removed — and a moment later it may be gone. A caller that told the user
   * "your address is still saved" would be making a promise the platform is already
   * in the process of breaking.
   *
   * `fake-indexeddb` is **not a browser**, so the above is a statement about the
   * substrate the tests run on. The design does not depend on which way a real browser
   * goes: reporting is correct whether the queued removal later lands or not, and the
   * only claim that would be unsafe is the one this documentation declines to make.
   *
   * @returns Nothing. It resolves once the platform has committed the removal.
   * @throws {Error} If the removal was blocked, refused, or did not complete. A
   *   refusal SHALL NOT be read as a statement that the data remains.
   */
  clearAll(): Promise<void>;
}
