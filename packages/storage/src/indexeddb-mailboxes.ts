/**
 * The IndexedDB implementation of {@link SpectreMailboxes}, and the paired records the
 * website writes in one transaction.
 *
 * ## Why a second store rather than a second key in the first one
 *
 * `spectre-storage` requires removal not to be satisfied by clearing only the records
 * this build recognises, and its test proves that by planting a store this build does
 * **not** recognise. A planted store is a weaker proof than a real one, and this file
 * is the reason the proof stops being a fiction: **the shipped database now holds the
 * single current mailbox and the collection of mailboxes this device holds, both
 * created by this build**, so the deletion the removal requirement asks for is
 * exercised against the product's own shape rather than beside it.
 *
 * A second *key* in the first store would have kept the version at 1 and needed no
 * upgrade — and would have produced one store holding two unrelated record kinds,
 * which is the shape the requirement is written about rather than the shape it wants.
 *
 * ## Why the migration answer is "one write, atomically", and this is the measurement
 *
 * The extension's answer to "what happens to a mailbox recorded before the collection
 * existed" is a *rule*: *"the single-mailbox contract is the only place a mailbox
 * recorded by an earlier build can be found, and it is therefore consulted only while
 * the collection is empty."* That rule exists because **`chrome.storage` has no
 * transactions**, so "write the collection and write the current mailbox" cannot be one
 * atomic act there.
 *
 * IndexedDB can. Measured on this repository's own substrate before any code was
 * written, against `fake-indexeddb` `6.2.5`:
 *
 * ```text
 * abort  -> abort  { one: [],  two: [] }     // a transaction over both stores rolls BOTH back
 * commit -> complete { one: ["wrote A"], two: ["wrote B"] }
 * upgrade to 2 while a version-1 connection is open -> blocked
 * upgrade to 2 with no other connection          -> success
 * ```
 *
 * So the rule the extension is stuck with is **not a product decision**, and this file
 * does not inherit it. A website write here is one transaction over both stores: either
 * the collection gains the mailbox and the singular record names it, or neither happened.
 * **That is what makes the amended requirement's property true on this client** — *"the
 * head of this collection and the mailbox the single-mailbox contract reports shall be
 * the same mailbox"* — and it is true because the platform will not let them differ,
 * not because an adapter was written carefully.
 *
 * ## And the limit that platform guarantee has
 *
 * **`SPECTRE_DATABASE_VERSION` moving to 2 has a user-visible cost, measured above**: a
 * second tab holding the old build blocks the upgrade, `openSpectreDatabase` refuses, and
 * the visitor sees `BootFailure` rather than a slower page. Recorded rather than
 * smoothed over, and it is the price of the property above.
 *
 * ## Why the collection adapter does not touch the singular record
 *
 * `createIndexedDbMailboxes` reads and writes **one** store. It is given the other
 * store's name for one reason — so that whichever adapter opens the database first
 * creates the shipped shape — and that is creation, not a read or a write of the record.
 * The agreement between the two records is held by {@link createIndexedDbMailboxRecords},
 * which exists to be the place it is held; an adapter doing both would make the
 * agreement a property of that adapter rather than of the layer.
 *
 * @module
 */

import { isMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import type { SpectreStorage } from "./contract";
import {
  CURRENT_MAILBOX_KEY,
  deleteSpectreDatabase,
  MAILBOXES_STORE_NAME,
  openSpectreDatabase,
  SINGLE_MAILBOX_STORE_NAME,
  SPECTRE_DATABASE_NAME,
} from "./indexeddb";
import type { SpectreMailboxes } from "./mailboxes";
import {
  prependStoredMailbox,
  readStoredMailboxCollection,
  readStoredMailboxRecord,
  toStoredMailboxCollection,
  toStoredMailboxRecord,
} from "./record";
import type { StoredMailboxCollection } from "./record";

/**
 * The key the collection envelope is written under, inside its own store.
 *
 * **The same string the `chrome.storage` adapter uses** (`EXTENSION_MAILBOXES_KEY`), for
 * the reason that constant's own note gives: the key names a *concept* rather than a
 * location, and two spellings of one concept would be two things to keep in agreement.
 * The store is named for the same concept, and holding one envelope under one key is
 * what lets the adapter read it with `get` rather than `getAll`.
 */
export const MAILBOX_COLLECTION_KEY = "mailboxes";

/** The collection's object store, named by `indexeddb.ts` because the shape belongs there. */
export { MAILBOXES_STORE_NAME };

/** Everything the adapters here need, and nothing they could invent for themselves. */
export interface IndexedDbMailboxesOptions {
  /**
   * The IndexedDB implementation to use.
   *
   * **Required for the reason `createIndexedDbStorage` gives**: `globalThis.indexedDB`
   * compiles in every package in this workspace, DOM lib or not, so a default would be a
   * path that only runs where a browser happens to provide one.
   */
  readonly indexedDB: IDBFactory;
  /** The database to open. The caller names it, because naming is a policy. */
  readonly databaseName: string;
  /**
   * The object store the single current mailbox is written under.
   *
   * **Not read and not written by {@link createIndexedDbMailboxes}, and it is still
   * required** — it is passed to {@link openSpectreDatabase} so that the collection
   * adapter opening the database on its own still produces the shipped two-store shape.
   * The alternative is a database whose contents depend on which operation a visitor
   * performed first, and a removal requirement proved against that is a proof that
   * varies.
   */
  readonly storeName: string;
  /** The object store the collection of mailboxes is written under. */
  readonly mailboxesStoreName: string;
}

/**
 * One value read out of a store, or the transaction's own failure.
 *
 * **A union rather than a callback, because three of the four callers below need to read
 * more than one store in a single transaction** and a read that resolves from
 * `onsuccess` rather than from `oncomplete` would be read before the transaction that
 * produced it had committed.
 */
function readWithin(transaction: IDBTransaction, storeName: string, key: string): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = (event: Event): void => {
      resolve((event.target as IDBRequest<unknown>).result);
    };
    request.onerror = (): void => {
      reject(request.error ?? new Error(`Reading "${storeName}" failed.`));
    };
  });
}

/** Settle when a transaction has committed, or refuse when it did not. */
function committed(transaction: IDBTransaction, what: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = (): void => {
      resolve();
    };
    transaction.onerror = (): void => {
      reject(transaction.error ?? new Error(`${what} was rejected.`));
    };
    transaction.onabort = (): void => {
      reject(transaction.error ?? new Error(`${what} was aborted.`));
    };
  });
}

/**
 * Attach a transaction's outcome handlers **before** anything is awaited inside it.
 *
 * **This is not tidiness.** A caller that reads a request first and subscribes to
 * `oncomplete` afterwards is subscribing in a later microtask, and whether the platform
 * has dispatched `complete` by then is a question about the platform rather than about
 * the code. So the subscription happens here, in the same turn as the transaction.
 *
 * **The empty `catch` is a second correctness point.** A transaction that is abandoned -
 * because a read inside it already rejected - will reject here too, and a rejection
 * nobody awaits is an unhandled one. Marking it handled does not stop the caller that
 * *does* await `finished` from seeing it.
 */
function finished(transaction: IDBTransaction, what: string): Promise<void> {
  const outcome = committed(transaction, what);
  void outcome.catch(() => {
    // Handled by whoever awaits `outcome`; ignored here so an abandoned transaction is
    // not an unhandled rejection.
  });
  return outcome;
}

function openDatabase(options: IndexedDbMailboxesOptions): Promise<IDBDatabase> {
  return openSpectreDatabase({
    indexedDB: options.indexedDB,
    databaseName: options.databaseName,
    storeNames: [options.storeName, options.mailboxesStoreName],
  });
}

/**
 * The next envelope for `mailbox`, refusing rather than replacing a record this build
 * cannot read.
 *
 * **Shared with {@link createIndexedDbMailboxes} on purpose.** The rule `addMailbox`'s
 * documentation gives about `chrome.storage` — read the record, change it, write it
 * back — is the same rule here, and it is one rule: a build that changes how a member
 * this build cannot read is treated gets both adapters changed together rather than one
 * of them.
 *
 * @returns The record to write, or `null` when `raw` is an envelope this build cannot
 *   use — in which case the caller must refuse the write rather than replace it.
 */
function nextCollection(raw: unknown, mailbox: Mailbox): StoredMailboxCollection | null {
  return raw === undefined
    ? toStoredMailboxCollection([mailbox])
    : prependStoredMailbox(raw, mailbox);
}

/**
 * A {@link SpectreMailboxes} over one IndexedDB database.
 *
 * ## Read and write in one transaction, and that is what this platform allows
 *
 * `chrome.storage` has no transactions, so that adapter reads the collection, changes
 * it, and writes it back with no atomicity at all. Here the two steps are **one
 * transaction**, which is not an optimisation: a lost update needs two writers racing,
 * and this client has one — but the stronger property it buys is that a reader never
 * observes a half-written collection, which on the other platform is a thing a
 * multi-tab client can observe.
 */
export function createIndexedDbMailboxes(options: IndexedDbMailboxesOptions): SpectreMailboxes {
  const { databaseName, mailboxesStoreName } = options;

  return {
    async loadMailboxes() {
      const db = await openDatabase(options);

      try {
        const transaction = db.transaction(mailboxesStoreName, "readonly");
        const settled = finished(transaction, "Reading the mailboxes this device holds");
        const raw = await readWithin(transaction, mailboxesStoreName, MAILBOX_COLLECTION_KEY);
        await settled;

        // **An envelope that is not one this build can use reads as empty, and that is
        // the whole narrowing story.** `readStoredMailboxCollection` skips a *member* it
        // cannot narrow so one bad member costs one mailbox rather than all of them, and
        // returns `null` only when the envelope itself is unusable — which is the safe
        // reading here, because offering an address that cannot be narrowed is the worse
        // of the two mistakes. The boot read in `createIndexedDbMailboxRecords` below
        // refuses rather than doing this, because *there* an empty answer means "first
        // visit" and a first visit creates.
        return readStoredMailboxCollection(raw) ?? [];
      } finally {
        db.close();
      }
    },

    async addMailbox(mailbox: Mailbox) {
      // **Narrowed on the way in as well as out**, for the reason the single-mailbox
      // adapter gives: a value assembled from `unknown` reaches a typed parameter
      // happily, and persisting one would be a save that reports success and loses the
      // address on the next read. A `TypeError` rather than a normalized code, because
      // the normalized vocabulary describes *provider* failures and a caller passing
      // something that is not a mailbox is not a provider condition.
      if (!isMailbox(mailbox)) {
        throw new TypeError(
          "addMailbox was given a value that is not a mailbox of the shared model, so nothing " +
            "was stored. Build it with createMailbox.",
        );
      }

      const db = await openDatabase(options);

      try {
        const transaction = db.transaction(mailboxesStoreName, "readwrite");
        const settled = finished(transaction, "Recording the mailbox");
        const raw = await readWithin(transaction, mailboxesStoreName, MAILBOX_COLLECTION_KEY);
        const next = nextCollection(raw, mailbox);

        /**
         * **A record this build cannot read is refused rather than replaced.**
         *
         * `nextCollection` returns `null` for an envelope it cannot narrow, and the only way
         * to "recover" would be to overwrite it — which is the deletion
         * `readStoredMailboxRecord` refuses to perform. So this is a refusal, with a
         * message that says what happened rather than what to do about it: the alternative
         * would be a write that reports success and loses a record from a build this one
         * does not understand.
         */
        if (next === null) {
          throw new Error(
            `The mailboxes stored in "${mailboxesStoreName}" of the "${databaseName}" database ` +
              "could not be read, so this mailbox was not recorded: writing it would replace a " +
              "record this build does not understand. Removing everything this device holds " +
              "would clear it.",
          );
        }

        transaction.objectStore(mailboxesStoreName).put(next, MAILBOX_COLLECTION_KEY);
        await settled;
      } finally {
        db.close();
      }
    },
  };
}

/**
 * The two contracts a client needs to hold one mailbox, over one database.
 *
 * **Both at once, and that is the whole reason this type exists.** A client holding
 * `storage` and reaching for the collection through a second adapter would have two
 * places where "which record names the current mailbox" is answered, and the requirement
 * that they agree would be a property of the client rather than of the layer.
 */
export interface MailboxRecords {
  /** Serves {@link SpectreStorage}, writing **both** records of a mailbox in one transaction. */
  readonly storage: SpectreStorage;
  /** Serves {@link SpectreMailboxes} over the collection store, and nothing else. */
  readonly mailboxes: SpectreMailboxes;
}

/**
 * A {@link SpectreStorage} and a {@link SpectreMailboxes} that cannot disagree.
 *
 * ## What `saveMailbox` writes, and why both records
 *
 * **Both, in one transaction.** The requirement is *"the head of this collection and the
 * mailbox the single-mailbox contract reports shall be the same mailbox, and a client
 * shall not be able to write them apart"* — and writing only one of them cannot satisfy
 * it:
 *
 * - **writing only the collection** leaves a singular record naming a mailbox this device
 *   has stopped using, so the two stored records disagree and anything that ever read the
 *   singular record directly would be reading a stale answer;
 * - **writing only the singular record** means the collection never grows, and a client
 *   listing what this device holds has nothing to list after the first visit.
 *
 * The extension answers this with a boundary rule instead, because `chrome.storage`
 * cannot do the transaction. **The rule is not needed here and is not added**: the
 * platform refuses the disagreement, which is a stronger instrument than a scan, and a
 * scan for a property the database already enforces would be decoration.
 *
 * ## What `loadMailbox` reads, and why the collection first
 *
 * **The collection's head, and the singular record only while the collection is empty.**
 * That is the migration answer, and it is a single rule rather than a merge: every write
 * after this build records the mailbox in both places at once, so a device whose
 * collection is non-empty cannot be in the state where the two disagree — and a device
 * whose collection is empty is a device whose only mailbox predates this build, which is
 * exactly the one the singular record is there for.
 *
 * **An envelope this build cannot read is refused, not reported as empty.** That is the
 * load-bearing difference between this read and `loadMailboxes`, and it is the whole
 * reason the composed read is not a call to the collection adapter: this read answers
 * *"may I create a mailbox?"*, and an empty answer to that question is a page that
 * believes it is a first visit, creates, and overwrites the address the user came back
 * for.
 */
export function createIndexedDbMailboxRecords(options: IndexedDbMailboxesOptions): MailboxRecords {
  const { indexedDB: factory, databaseName, storeName, mailboxesStoreName } = options;

  const mailboxes = createIndexedDbMailboxes(options);

  const storage: SpectreStorage = {
    async loadMailbox() {
      const db = await openDatabase(options);

      try {
        /**
         * **One transaction over both stores.** Not for atomicity - this is a read - but
         * because two transactions over one database can be interleaved by another tab
         * between them, and the answer to "which mailbox is current" is only stable if it
         * was read in one go.
         */
        const transaction = db.transaction([storeName, mailboxesStoreName], "readonly");
        const settled = finished(transaction, "Reading the stored mailbox");
        const [singular, collection] = await Promise.all([
          readWithin(transaction, storeName, CURRENT_MAILBOX_KEY),
          readWithin(transaction, mailboxesStoreName, MAILBOX_COLLECTION_KEY),
        ]);
        await settled;

        /**
         * **Refused rather than answered, and this is the narrowest of the three refusals in
         * this package.** An envelope that is not one this build can use is not "this device
         * holds no mailboxes": it is a record this build does not understand, and treating
         * it as absent is the conversion `SpectreStorage`'s own `null` clause exists to
         * prevent. A `null` from here reaches a page that creates a mailbox.
         */
        const held = readStoredMailboxCollection(collection);
        if (collection !== undefined && held === null) {
          throw new Error(
            `The mailboxes stored in "${mailboxesStoreName}" of the "${databaseName}" database ` +
              "could not be read, so no answer is given about which mailbox this device holds: " +
              "a record this build does not understand is never treated as though it were absent.",
          );
        }

        return held?.[0] ?? readStoredMailboxRecord(singular);
      } finally {
        db.close();
      }
    },

    async saveMailbox(mailbox: Mailbox) {
      /** **Narrowed on the way in**, for the reason the collection adapter gives. */
      if (!isMailbox(mailbox)) {
        throw new TypeError(
          "saveMailbox was given a value that is not a mailbox of the shared model, so " +
            "nothing was stored. Build it with createMailbox.",
        );
      }

      const db = await openDatabase(options);

      try {
        /**
         * **The transaction that is the whole design.** Both stores, one `readwrite`, and
         * the collection read from *inside* it rather than before it - so the read that
         * decides what to write and the write that stores it cannot be interleaved with
         * another tab's write, and cannot be left half-done.
         *
         * A synchronous throw from either `put` - `DataCloneError` on a value IndexedDB
         * cannot clone - aborts the transaction, and with it **both** records. That is the
         * measured behaviour at the top of this file, and it is why the promise this method
         * returns can say one thing about two records: either the head of the collection is
         * this mailbox and the singular record names it, or neither write is on the device.
         */
        const transaction = db.transaction([storeName, mailboxesStoreName], "readwrite");
        const settled = finished(transaction, "Recording the mailbox");
        const raw = await readWithin(transaction, mailboxesStoreName, MAILBOX_COLLECTION_KEY);
        const next = nextCollection(raw, mailbox);

        if (next === null) {
          throw new Error(
            `The mailboxes stored in "${mailboxesStoreName}" of the "${databaseName}" database ` +
              "could not be read, so this mailbox was not recorded: writing it would replace a " +
              "record this build does not understand. Removing everything this device holds " +
              "would clear it.",
          );
        }

        transaction.objectStore(mailboxesStoreName).put(next, MAILBOX_COLLECTION_KEY);
        transaction.objectStore(storeName).put(toStoredMailboxRecord(mailbox), CURRENT_MAILBOX_KEY);

        await settled;
      } finally {
        db.close();
      }
    },

    /**
     * Remove everything this device holds.
     *
     * **The whole database, through the same helper the single-mailbox adapter uses** -
     * which now means both stores this build creates, not only the planted one its test
     * used to rely on. See `deleteSpectreDatabase` for why a blocked removal is reported
     * rather than waited on.
     *
     * No narrowing happens, for the reason the single-mailbox adapter gives: there is
     * nothing to narrow when the operation is deletion.
     */
    async clearAll() {
      await deleteSpectreDatabase({ indexedDB: factory, databaseName });
    },
  };

  return { storage, mailboxes };
}

/**
 * The names the browser entry points use, which a client has no reason to know.
 *
 * ## They are declared once, in `indexeddb.ts`, and that was not always true
 *
 * This module and `browser.ts` each held a private copy of the database's name and the single
 * mailbox store's name, and **that is exactly the duplication that produces two databases for one
 * product the day one of them is edited.**
 *
 * **The two modules now import one declaration**, and the two-directional test that guarded the
 * duplication stays: `indexeddb-mailboxes.test.ts` runs `createBrowserStorage` and this module's
 * browser entry point against **one** IndexedDB and requires a mailbox saved through either to be
 * the mailbox the other reads. **A guard that outlived the thing it guarded is not a guard, and a
 * test that was written because a duplication could not be merged should not be deleted because the
 * duplication was** -- it is now proving that the two entry points still agree, which is the
 * stronger claim.
 */

/**
 * Build a {@link SpectreMailboxes} over this environment's own IndexedDB.
 *
 * **The `Reflect.get` and the throw are `createBrowserStorage`'s, verbatim in substance
 * and for the same reason**: a direct property access compiles whether or not anything
 * defines it at runtime, so a missing platform would become `undefined` handed to an
 * adapter that fails later with a message about transactions. Reading it reflectively
 * makes the absence a value this function can test, which is the whole job.
 *
 * @throws {Error} If the environment provides no `indexedDB`.
 */
export function createBrowserMailboxes(): SpectreMailboxes {
  return createIndexedDbMailboxRecords(browserRecordsOptions()).mailboxes;
}

/**
 * Build both records over this environment's own IndexedDB, in one object.
 *
 * **A client that needs both should ask for both here rather than composing two adapters
 * itself** — `apps/web`'s storage module is the one that does, and the reason is that the
 * transaction which keeps the two records in step is a property of this factory rather
 * than of the client that happens to call two of them.
 *
 * @throws {Error} If the environment provides no `indexedDB`.
 */
export function createBrowserMailboxRecords(): MailboxRecords {
  return createIndexedDbMailboxRecords(browserRecordsOptions());
}

/** The options both browser entry points hand on, after checking the platform exists. */
function browserRecordsOptions(): IndexedDbMailboxesOptions {
  const provided: unknown = Reflect.get(globalThis, "indexedDB");

  if (provided === undefined || provided === null) {
    throw new Error(
      "This environment provides no IndexedDB, so SpectreMail cannot store anything here. " +
        "That is reported rather than worked around: a storage that kept nothing would let " +
        'a client report "nothing is saved on this device" when the truth is that saving ' +
        "is unavailable.",
    );
  }

  return {
    // **A cast is the honest way to say so**, because `IDBFactory` is a DOM interface and
    // the compiler cannot verify that an arbitrary value is one. The *absence* case, which
    // is the one a user experiences, was handled above rather than left to a constructor.
    indexedDB: provided as IDBFactory,
    databaseName: SPECTRE_DATABASE_NAME,
    storeName: SINGLE_MAILBOX_STORE_NAME,
    mailboxesStoreName: MAILBOXES_STORE_NAME,
  };
}
