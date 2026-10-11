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
import {
  prependStoredMailbox,
  readStoredMailboxCollection,
  readStoredMailboxRecord,
  readStoredSeenMessageIds,
  readStoredSiteAssociations,
  toStoredMailboxCollection,
  toStoredMailboxRecord,
  toStoredSeenMessages,
  toStoredSiteAssociations,
  withStoredSeenMessageIds,
} from "./record";
import type { StoredMailboxRecord } from "./record";
import type { SpectreMailboxes } from "./mailboxes";
import type { SpectreSeenMessages } from "./seen-messages";
import type { SpectreSiteAssociations } from "./site-associations";

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

/**
 * The key the collection of mailboxes this device holds is written under.
 *
 * **A concept, like {@link EXTENSION_MAILBOX_KEY}, and not a location.** "the current mailbox" and
 * "the mailboxes" are two different records about one thing, so they take two keys: one that
 * remembers and one that lists.
 */
export const EXTENSION_MAILBOXES_KEY = "mailboxes";

/**
 * The key the site associations are written under.
 *
 * "site-mailboxes" rather than "sites" because the record is not a list of sites — it is which
 * mailbox each site was last used with, and a key that named only the sites would read as one.
 */
export const EXTENSION_SITE_MAILBOXES_KEY = "site-mailboxes";

/**
 * The key the reported message ids are written under.
 *
 * "seen-messages" rather than "messages" because the record holds **ids this device has already
 * reported** and nothing else - not the messages, not a sender, not a subject. A key named for the
 * messages would invite the next reader to put them there.
 */
export const EXTENSION_SEEN_MESSAGES_KEY = "seen-messages";

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

/**
 * Read one key's raw value out of the area, or `undefined` when it was never written.
 *
 * **`undefined` and `null` are different answers and both are needed.** `chrome.storage.get`
 * resolves with an object keyed by the requested keys, and a key that was never written is
 * **absent** rather than present-and-`undefined`. So an absent key is the only case where a new
 * record may be written from scratch; a key that is *present* and unreadable is a record this build
 * must not replace.
 */
async function readRaw(area: ChromeStorageArea, key: string): Promise<unknown> {
  const stored = await area.get(key);
  if (typeof stored !== "object" || stored === null) {
    throw new Error("Reading from the extension's storage returned no object.");
  }
  return (stored as Record<string, unknown>)[key];
}

/**
 * A {@link SpectreMailboxes} over one `chrome.storage` area.
 *
 * ## One key, one read, one write
 *
 * A mailbox this device was handed is recorded by rewriting the whole collection — which is the
 * point, not a limitation. `chrome.storage` has no transactions, so "read the collection, add to it,
 * write it back" is the only way the platform offers, and the alternative (a second record saying
 * the same thing) could disagree with this one. A lost update needs two writers racing, and this
 * client has one.
 */
export function createChromeMailboxes(options: ChromeStorageOptions): SpectreMailboxes {
  const { area } = options;

  return {
    async loadMailboxes() {
      const raw = await readRaw(area, EXTENSION_MAILBOXES_KEY);
      if (raw === undefined) {
        return [];
      }
      return readStoredMailboxCollection(raw) ?? [];
    },

    async addMailbox(mailbox: Mailbox) {
      if (!isMailbox(mailbox)) {
        throw new TypeError(
          "addMailbox was given a value that is not a mailbox of the shared model, so nothing " +
            "was stored. Build it with createMailbox.",
        );
      }

      const raw = await readRaw(area, EXTENSION_MAILBOXES_KEY);

      /**
       * **The write is built from the record as stored, not from the list the reader returned.**
       *
       * `readStoredMailboxCollection` skips a member it cannot narrow, so rebuilding from its output
       * would delete exactly what the skipping preserved - one new mailbox silently costing a person
       * an older one. `prependStoredMailbox` takes the stored record instead and keeps every member
       * it cannot read verbatim; see its own note for why this is not a `filter` at the call site.
       */
      const next =
        raw === undefined
          ? toStoredMailboxCollection([mailbox])
          : prependStoredMailbox(raw, mailbox);

      /**
       * **A record this build cannot read is refused rather than replaced.**
       *
       * `prependStoredMailbox` returns `null` for an envelope it cannot narrow, and the only way to
       * "recover" from that here would be to overwrite it — which is the deletion
       * `readStoredMailboxRecord` refuses to perform. So this is a refusal, with a message that says
       * what happened rather than what to do about it: the alternative would be a `create` that
       * reports success and loses a record from a build this one does not understand.
       */
      if (next === null) {
        throw new Error(
          `The mailboxes stored at "${EXTENSION_MAILBOXES_KEY}" could not be read, so this mailbox ` +
            "was not recorded: writing it would replace a record this build does not understand. " +
            "Removing everything this device holds would clear it.",
        );
      }

      await area.set({ [EXTENSION_MAILBOXES_KEY]: next });
    },
  };
}

/** A {@link SpectreSiteAssociations} over one `chrome.storage` area. */
export function createChromeSiteAssociations(
  options: ChromeStorageOptions,
): SpectreSiteAssociations {
  const { area } = options;

  return {
    async loadSiteMailboxId(host: string) {
      const raw = await readRaw(area, EXTENSION_SITE_MAILBOXES_KEY);
      if (raw === undefined) {
        return null;
      }
      const sites = readStoredSiteAssociations(raw);
      if (sites === null) {
        throw new Error(
          `The site associations stored at "${EXTENSION_SITE_MAILBOXES_KEY}" could not be read, so ` +
            "this host cannot be answered: a record this build does not understand is never treated " +
            "as though it were absent, and it is never replaced.",
        );
      }
      return sites[host] ?? null;
    },

    async saveSiteMailboxId(host: string, mailboxId: string) {
      if (host.length === 0) {
        throw new TypeError("saveSiteMailboxId was given an empty host, so nothing was stored.");
      }
      if (mailboxId.length === 0) {
        throw new TypeError(
          "saveSiteMailboxId was given an empty mailbox id, so nothing was stored.",
        );
      }

      const raw = await readRaw(area, EXTENSION_SITE_MAILBOXES_KEY);

      if (raw !== undefined && readStoredSiteAssociations(raw) === null) {
        throw new Error(
          `The site associations stored at "${EXTENSION_SITE_MAILBOXES_KEY}" could not be read, so ` +
            `nothing was recorded for "${host}": writing it would replace a record this build does ` +
            "not understand.",
        );
      }

      /**
       * **The write is built from the record as stored, not from the narrowed map.**
       *
       * Narrowing has already dropped every entry this build could not read, so spreading *that* would
       * delete exactly what the narrowing went to the trouble of preserving — one write to record one
       * host would quietly discard another. Spreading the stored object instead keeps the unreadable
       * entries in place, and `toStoredSiteAssociations` copies it, so the object written shares no
       * reference with the one that was read.
       *
       * **A key that was never written is the empty map**, which is the one case where "as stored"
       * is also "as narrowed".
       */
      const stored =
        raw === undefined
          ? {}
          : ((raw as { readonly sites?: Readonly<Record<string, unknown>> }).sites ?? {});

      await area.set({
        [EXTENSION_SITE_MAILBOXES_KEY]: toStoredSiteAssociations({
          ...stored,
          [host]: mailboxId,
        }),
      });
    },
  };
}

/**
 * A {@link SpectreSeenMessages} over one `chrome.storage` area.
 *
 * ## One key, one read, one write, and the same reasoning as the two above it
 *
 * `chrome.storage` has no transactions, so "read the record, change one mailbox's entry, write it
 * back" is the only shape the platform offers. That is a limitation rather than a design, and it is
 * safe for the reason `createChromeMailboxes` gives: a lost update needs two writers racing, and
 * this client has one - a background check that runs one listing per wake.
 */
export function createChromeSeenMessages(options: ChromeStorageOptions): SpectreSeenMessages {
  const { area } = options;

  return {
    async loadSeenMessageIds(mailboxId: string) {
      if (mailboxId.length === 0) {
        throw new TypeError(
          "loadSeenMessageIds was given an empty mailbox id, so nothing was read.",
        );
      }

      const raw = await readRaw(area, EXTENSION_SEEN_MESSAGES_KEY);
      if (raw === undefined) {
        return null;
      }

      /**
       * **Three answers, and the middle one is the whole reason the reader is a union.**
       *
       * A record this build cannot read is refused rather than answered: reporting it as "this
       * mailbox has nothing recorded" would tell a background check that this device has never
       * reported anything here, and it would answer the first wake's question with a fact about the
       * *record* rather than about the mailbox.
       */
      const read = readStoredSeenMessageIds(raw, mailboxId);

      if (read.kind === "record-unreadable") {
        throw new Error(
          `The reported messages stored at "${EXTENSION_SEEN_MESSAGES_KEY}" could not be read, so ` +
            `"${mailboxId}" cannot be answered: a record this build does not understand is never ` +
            "treated as though it were absent, and it is never replaced.",
        );
      }

      return read.kind === "nothing-recorded" ? null : read.ids;
    },

    async saveSeenMessageIds(mailboxId: string, ids: readonly string[]) {
      /**
       * **Every empty-id refusal is here rather than in the record helpers, for the reason the
       * mailbox adapter gives about narrowing on the way in.** A value assembled from outside reaches
       * a typed parameter happily, and writing one would be a save that reports success and announces
       * the same message on every later wake.
       */
      if (mailboxId.length === 0) {
        throw new TypeError(
          "saveSeenMessageIds was given an empty mailbox id, so nothing was stored.",
        );
      }
      if (ids.length === 0) {
        /**
         * **An empty list is refused rather than stored, and the reason is the record's meaning.**
         *
         * `loadSeenMessageIds` answers `null` for a mailbox it has no entry for, so storing `[]` would
         * write a second spelling of "nothing recorded" - and a caller checking `ids !== null` could
         * not tell a mailbox this device has never watched from one it has watched and found empty.
         */
        throw new TypeError(
          "saveSeenMessageIds was given no ids, so nothing was stored: an empty list is not a " +
            "record of having reported nothing.",
        );
      }
      if (ids.some((id) => id.length === 0)) {
        throw new TypeError(
          "saveSeenMessageIds was given an empty message id, so nothing was stored.",
        );
      }

      const raw = await readRaw(area, EXTENSION_SEEN_MESSAGES_KEY);

      /**
       * **A record this build cannot read is refused rather than replaced**, for the same reason
       * `addMailbox` gives: the only way to "recover" would be to overwrite it, which is the deletion
       * the readers refuse to perform.
       */
      const next =
        raw === undefined
          ? toStoredSeenMessages({ [mailboxId]: [...ids] })
          : withStoredSeenMessageIds(raw, mailboxId, ids);

      if (next === null) {
        throw new Error(
          `The reported messages stored at "${EXTENSION_SEEN_MESSAGES_KEY}" could not be read, so ` +
            `nothing was recorded for "${mailboxId}": writing it would replace a record this build ` +
            "does not understand.",
        );
      }

      await area.set({ [EXTENSION_SEEN_MESSAGES_KEY]: next });
    },
  };
}
