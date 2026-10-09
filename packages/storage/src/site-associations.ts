/**
 * Which mailbox a site was last used with.
 *
 * ## What a key is, measured rather than remembered
 *
 * A key is **the host the browser reports for the page**, read from inside the content script that
 * will use it. Measured in Chromium on `https://PROBE.Invalid:8443`, where that value reads
 * `probe.invalid`: the port is already excluded and the value is **already lower-cased**. So neither
 * case-folding nor port-stripping belongs to this layer, and a key derived from anything else would
 * be a second spelling of a host — the same defect as two spellings of a storage key, found only
 * when a lookup misses.
 *
 * ## Why the key is exact, and what that costs
 *
 * `login.example.co.uk` and `example.co.uk` are **two keys** here. Folding them together needs a
 * public suffix list, this product ships none, and guessing one from the last two labels merges a
 * login page into an unrelated site — a worse answer than two keys, and not repairable by the person
 * who hit it. Two keys is the safer wrong answer, and it is recorded here rather than deferred
 * quietly.
 *
 * ## Why the value is a mailbox *id* and not an address
 *
 * An address is what a provider hands out and an id is what this product stores, so the id is the
 * stable half: the same mailbox reached through two providers' spellings of its address is still one
 * entry. It is also the half that can go **stale** — this product has no deletion, so a mailbox that
 * is no longer in the collection is a record naming something this device cannot hand back, and
 * callers must not offer it. Deciding that is the caller's, because only the caller knows which
 * mailbox it would fall back to.
 *
 * @module
 */

export interface SpectreSiteAssociations {
  /**
   * The id of the mailbox last used on `host`, or `null` when none is recorded.
   *
   * Reading one site does **not** read the whole collection: the lookup is the operation a caller
   * makes on a page load, and a client that had to load every host to answer one question would hold
   * data it does not need on somebody else's page.
   *
   * @param host - The host the browser reports for the page, exactly. No folding, no `www.`
   *   removal, no lower-casing — the platform has already done the last one.
   * @returns The mailbox id recorded for that host, or `null` when no association is recorded.
   * @throws {Error} If the associations could not be read. **Not** when no association is recorded
   *   for `host`, and never a partially built value.
   */
  loadSiteMailboxId(host: string): Promise<string | null>;

  /**
   * Record that `host` was used with the mailbox whose id is `mailboxId`.
   *
   * Recording the same id twice is not an error and does not grow the record; recording a **different**
   * id replaces the association, because the contract is "last used with" and the last one is the
   * answer.
   *
   * **Entries this build cannot read are left in place by a write as well as by a read.** An
   * implementation that rebuilt the record from the entries it could read would delete the others,
   * which is the loss this contract exists to prevent — so the record as stored is what the new one
   * is built from.
   *
   * @throws {TypeError} If `host` is empty or `mailboxId` is empty. **Not** when the mailbox is one
   *   this device does not hold: this layer stores what it is told, and whether an association can be
   *   honoured is the caller's question to answer.
   * @throws {Error} If the associations could not be read, or the write was not committed.
   */
  saveSiteMailboxId(host: string, mailboxId: string): Promise<void>;
}
