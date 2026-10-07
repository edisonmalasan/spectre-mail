/**
 * The `chrome.storage` implementation of {@link SpectreStorage}.
 *
 * ## Why this is here and not in `apps/extension`
 *
 * `contract.ts` says it in the paragraph that explains why the contract is three
 * operations and not a key-value bag: a generic `get`/`set` would mean the
 * extension at M8 reimplements all three against `chrome.storage` — "a platform
 * with no transactions, so the durability guarantee below would have to be
 * restated per platform rather than implemented once".
 *
 * That note was written before this adapter existed, and it is the reason this
 * adapter sits **beside** the IndexedDB one rather than inside the client:
 *
 * 1. **The boundary rule already forbids the alternative.** No file under `apps/`
 *    may name a platform storage API, with one carve-out for `navigator.clipboard`.
 *    An adapter inside `apps/extension` would need a second carve-out, which is a
 *    rule weakened to accommodate a placement.
 * 2. **`packages/storage` is the one package whose `tsconfig` declares `DOM`**,
 *    because it is the only one whose job is to speak to a platform API. A second
 *    client needs a second platform; keeping both adapters in one package keeps
 *    that justification singular and true.
 * 3. **`apps/web` would otherwise grow a sibling**, or the adapter would be
 *    copied. Either is the duplication the M8 gate forbids, one layer down.
 *
 * ## It is not the IndexedDB adapter with a different global
 *
 * The two platforms differ in ways that matter to a caller, and the differences
 * are documented here rather than smoothed over:
 *
 * - **No transactions.** An IndexedDB write resolves on `transaction.oncomplete`,
 *   which is a durability guarantee. Here `chrome.storage`'s promise resolves when
 *   the platform has accepted the individual write, and there is no transaction to
 *   commit and no way to make two writes atomic together. `saveMailbox` therefore
 *   resolves on the platform's confirmation of *that* write, and this is what the
 *   contract's durability clause means on this platform.
 * - **No `deleteDatabase`, and so no blocked removal.** `clearAll` empties the whole
 *   `local` area. That satisfies "everything this device holds" *more* directly
 *   than `deleteDatabase` can — there is no second connection to be blocked by,
 *   because nothing here holds a connection open between calls — so the
 *   queued-removal semantics `fake-indexeddb` recorded for the IndexedDB adapter
 *   **do not arise on this platform at all**. Recorded because "simpler" read as
 *   "less careful" once already in this package, and the contract's own note about
 *   blocked removals is worth saying explicitly does not apply here.
 * - **Serialization is JSON.** `chrome.storage.local` holds JSON-serializable
 *   values only. `StoredMailboxRecord` is a version number and a `Mailbox`, both
 *   plain data, so it round-trips. A field that were not would be dropped in
 *   silence by the platform rather than rejected by this adapter — which is a real
 *   limit of this platform and is stated rather than discovered.
 *
 * ## Why the area is injected
 *
 * The same reason `createIndexedDbStorage` takes a required `IDBFactory`:
 * `globalThis.indexedDB` compiles in every package in this workspace, DOM lib or
 * not, so a default would be a path that only runs in production. Here the
 * platform is `chrome.storage`, which is not a DOM global at all and does not
 * compile anywhere without a declaration — so the injection is not a precaution
 * but the only way this can be typed. See `chrome-api.ts` for what that costs.
 *
 * @module
 */

import { isMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import type { SpectreStorage } from "./contract";
import { readStoredMailboxRecord, toStoredMailboxRecord } from "./record";
import type { StoredMailboxRecord } from "./record";

import type { ChromeStorageArea } from "./chrome-api";

/**
 * The key the current mailbox is written under.
 *
 * **The same string the IndexedDB adapter uses, deliberately.** They are two
 * platforms rather than two records — a mailbox in one is not automatically in the
 * other — so this is not a compatibility measure. It is because the key names a
 * *concept* ("the current mailbox") rather than a storage location, and two
 * spellings of one concept would be two things to keep in agreement.
 */
export const EXTENSION_MAILBOX_KEY = "current";

/** Everything the adapter needs, and nothing it could invent for itself. */
export interface ChromeStorageOptions {
  /**
   * The extension's `chrome.storage.local` area.
   *
   * Required rather than read off a global: `chrome` is not a DOM global, so there
   * is no ambient value this could default to even if defaulting were safe. The
   * caller is the extension's composition root and it has the real one.
   */
  readonly area: ChromeStorageArea;
}

/**
 * A {@link SpectreStorage} over one `chrome.storage` area.
 *
 * ## The narrowing is the shared one, on both platforms
 *
 * `readStoredMailboxRecord` is called here rather than a second parse written for
 * this platform, and that is the point of the requirement it comes from: a record
 * neither platform can read is neither surfaced nor deleted by **either**. A
 * parallel parser would be a second answer to "what is a usable stored record",
 * and the two would drift exactly where it matters — on a future model change,
 * where one would destroy records the other preserved.
 */
export function createChromeStorage(options: ChromeStorageOptions): SpectreStorage {
  const { area } = options;

  async function readStored(): Promise<unknown> {
    const stored = await area.get(EXTENSION_MAILBOX_KEY);
    // `chrome.storage.get` resolves with an object keyed by the requested keys,
    // and a key that was never written is **absent** rather than present-and-
    // undefined. Reading it defensively matters because `noUncheckedIndexedAccess`
    // is on, but it also matters at runtime: on some paths the platform resolves
    // `{}` and the absence is the value.
    if (typeof stored !== "object" || stored === null) {
      throw new Error("Reading from the extension's storage returned no object.");
    }
    return (stored as Record<string, unknown>)[EXTENSION_MAILBOX_KEY];
  }

  return {
    async loadMailbox() {
      return readStoredMailboxRecord(await readStored());
    },

    async saveMailbox(mailbox: Mailbox) {
      /**
       * **Narrowed on the way in as well as out**, for the reason the IndexedDB
       * adapter gives and not because the types would catch it: a value assembled
       * from `unknown` reaches a typed parameter happily, and persisting it would
       * be a save that reports success and loses the address on the next read.
       *
       * A `TypeError`, not a normalized code, for the reason that adapter gives:
       * the normalized vocabulary describes **provider** failures, and a caller
       * passing something that is not a mailbox is not a provider condition.
       */
      if (!isMailbox(mailbox)) {
        throw new TypeError(
          "saveMailbox was given a value that is not a mailbox of the shared model, so " +
            "nothing was stored. Build it with createMailbox.",
        );
      }

      const record: StoredMailboxRecord = toStoredMailboxRecord(mailbox);

      // **Resolved on the platform's own confirmation, and that is the whole
      // durability story on this platform.** `chrome.storage`'s promise settles
      // when the platform has accepted the write; there is no transaction to wait
      // for afterwards. Saying so here rather than implying the IndexedDB adapter's
      // `oncomplete` guarantee, which this platform cannot make.
      await area.set({ [EXTENSION_MAILBOX_KEY]: record });
    },

    /**
     * Remove everything this extension holds.
     *
     * **The whole area, and for the same reason the IndexedDB adapter deletes the
     * whole database** — deleting `EXTENSION_MAILBOX_KEY` would be the smaller
     * function, would pass every test written against today's single record, and
     * would quietly stop clearing everything the moment a later build added a
     * second record kind. There is no key here this build does not recognise,
     * because `clear()` is the platform's own operation over its own area.
     *
     * **There is no blocked-removal branch, and its absence is a platform fact
     * rather than an oversight.** The IndexedDB adapter has an `onblocked` handler
     * because `deleteDatabase` can be held open by another connection and its
     * rejection there is what forces the page's wording. `chrome.storage` holds no
     * open connection between calls, so that event cannot occur — which is the one
     * place this platform satisfies the contract's removal requirement more
     * directly than IndexedDB does, and worth recording so nobody adds a handler
     * for an event that cannot fire.
     *
     * No narrowing happens, for the reason the IndexedDB adapter gives: there is
     * nothing to narrow when the operation is deletion.
     */
    async clearAll() {
      await area.clear();
    },
  };
}
