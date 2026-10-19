/**
 * The IndexedDB implementation of {@link SpectreStorage}.
 *
 * @module
 */

import { isMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import type { SpectreStorage } from "./contract";
import { readStoredMailboxRecord, toStoredMailboxRecord } from "./record";
import type { StoredMailboxRecord } from "./record";

/**
 * The schema version of the database this build creates.
 *
 * Separate from `SPECTRE_RECORD_VERSION` on purpose. The two answer different
 * questions — one is "what shape is a record", the other is "what shape is the
 * database" — and a change to either does not imply a change to the other. A
 * record added to a store needs no `IDB` upgrade; an index added to one does.
 *
 * ## It is 2, and that was measured rather than chosen
 *
 * Version 1 held one object store. `mailbox-history` added a **second store** for
 * the collection of mailboxes this device holds, and **an object store can only be
 * created inside a version-change transaction** — so the version had to move whether
 * or not the existing store changed shape. The earlier note above said "a record
 * added to a store needs no `IDB` upgrade", which is true of a *value* and was read
 * here as covering a *store*; it does not, and the correction is recorded rather than
 * quietly absorbed.
 *
 * **The consequence is measured on this repository's own substrate, and it is a real
 * one:** while a second connection holds version 1 open, `factory.open(name, 2)` fires
 * **`onblocked` and nothing else** — measured `{ one: [], two: [] }` for the rollback
 * probe and `blocked` for the upgrade probe. So a visitor with an old SpectreMail tab
 * open gets the `openDatabase` refusal below rather than a slower page, and
 * `BootFailure` is what they see. The alternative — a second store in a second
 * database — would have kept the version at 1 and produced **two** databases for one
 * product, which is exactly the shape `clearAll`'s requirement is about.
 */
export const SPECTRE_DATABASE_VERSION = 2;

/**
 * The key the current mailbox is written under.
 *
 * One key, because the contract stores one thing. The roadmap's other record
 * kinds get their own key when they get a consumer.
 */
export const CURRENT_MAILBOX_KEY = "current";

/**
 * The object store the **collection of mailboxes this device holds** is written under.
 *
 * ## It lives here rather than in the collection's own module, and that is the point
 *
 * This is the **database's** shape, not one adapter's, and the two come apart the moment
 * they do not: an object store can only be created inside a version-change transaction,
 * so whichever adapter opens the database first would otherwise decide whether the other
 * store exists — and `spectre-storage`'s removal requirement is proved against the
 * database's contents. **A proof taken against a shape that depends on which operation a
 * visitor performed first is not a proof.**
 *
 * So every adapter in this package creates both stores on upgrade, and this module is
 * where the name of the second one is declared, next to the database version that has to
 * move for it to exist at all.
 */
export const MAILBOXES_STORE_NAME = "mailboxes";

/** Everything the adapter needs, and nothing it could invent for itself. */
export interface IndexedDbStorageOptions {
  /**
   * The IndexedDB implementation to use.
   *
   * **Required rather than defaulted to the global**, following
   * `createMailboxSession`, whose scheduler is required for a reason recorded in
   * its own documentation: "a default reaching for the global timer would compile
   * happily here — `@types/node` declares `setTimeout` in exactly the way it
   * declares `navigator` — and would then be a path that only runs in production.
   * Requiring it means there is no such path to take."
   *
   * The same measured fact applies here. `globalThis.indexedDB` compiles in every
   * package in this workspace, DOM lib or not, so a default would be a path that
   * only runs where a browser happens to provide one.
   */
  readonly indexedDB: IDBFactory;
  /** The database to open. The caller names it, because naming is a policy. */
  readonly databaseName: string;
  /** The object store holding the records. */
  readonly storeName: string;
}

/**
 * What {@link openSpectreDatabase} needs, and nothing it could invent for itself.
 */
export interface OpenSpectreDatabaseOptions {
  /** The IndexedDB implementation to use. Required, for the reason above. */
  readonly indexedDB: IDBFactory;
  /** The database to open. */
  readonly databaseName: string;
  /**
   * Every object store this build's database has.
   *
   * **A list rather than one name, and that is the collection adapter's whole reason
   * for sharing this rather than writing its own opener.** An object store can only be
   * created inside a version-change transaction, so whichever adapter opens the
   * database first would otherwise decide whether the *other* store exists — and the
   * shipped database's shape would then depend on which operation a visitor happened
   * to perform first. `spectre-storage`'s removal requirement is proved against that
   * shape, so a shape that varies is a proof that varies.
   */
  readonly storeNames: readonly string[];
}

/**
 * Open this build's database, creating every object store it declares.
 *
 * ## One connection per operation
 *
 * The database is opened, used, and closed around each call rather than held
 * open. A cached connection has to be closed for a future `versionchange` upgrade
 * not to block, which means a lifecycle this contract has no room for — and a
 * client that forgets to call it leaves the next version of the site unable to
 * upgrade. Opening per operation cannot leak a connection, at the cost of an open
 * per save. A page saves a mailbox when it changes, not on a timer, so that is the
 * right way round.
 *
 * ## The caller closes it
 *
 * **No close here, deliberately.** Every operation that opens needs to close on the
 * failure path as well as the success one, and closing inside this function would
 * close a connection whose transaction has not finished — which is the durability
 * guarantee the writes below wait on `oncomplete` to provide.
 */
export function openSpectreDatabase(options: OpenSpectreDatabaseOptions): Promise<IDBDatabase> {
  const { indexedDB: factory, databaseName, storeNames } = options;

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(databaseName, SPECTRE_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      }
    };

    // A blocked open means another connection is holding an older version open.
    // Reported rather than waited on: an open that never resolves would leave a
    // caller with no address and no explanation, and "no explanation" is the one
    // outcome `SpectreStorage` exists to prevent. Measured, not assumed: an upgrade
    // blocked by a version-1 connection fires this event and completes nothing,
    // which is why `SPECTRE_DATABASE_VERSION` moving to 2 has a user-visible cost.
    request.onblocked = () => {
      reject(
        new Error(
          `Opening the "${databaseName}" database was blocked: another connection is ` +
            `holding an older version open.`,
        ),
      );
    };

    request.onerror = () => {
      reject(request.error ?? new Error(`Opening the "${databaseName}" database failed.`));
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading must not be blocked by this connection. The
      // connection is per-operation, so closing here is the whole of the
      // lifecycle this adapter needs.
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
  });
}

/**
 * Remove the database.
 *
 * ## The whole database, and that is the requirement rather than an implementation
 * detail
 *
 * Deleting `CURRENT_MAILBOX_KEY` would be the smaller function and would pass every
 * test written against today's single record — and it would quietly stop clearing
 * everything the moment a later build added a second record kind, with nothing failing
 * to notice. `deleteDatabase` removes anything that was there, **including the
 * collection's own store**, which is what a control described to the user as clearing
 * all local data means.
 *
 * **`onblocked` rejects rather than waits, and the reason is not "it would hang".**
 * That was the reason originally recorded here and it was wrong — it was read off a
 * probe whose promise had already resolved on `onblocked`, so it could not have
 * observed what the request did afterwards. Measured properly, a blocked removal is
 * *queued*: while it is pending a fresh `open` is blocked too, and once the holding
 * connection closes the removal goes through on its own.
 *
 * The real reason to report is that the wait ends when some **other** tab closes — a
 * page can neither cause that nor predict it, and the user would be watching a
 * button that does nothing for as long as they left another tab open.
 * `openSpectreDatabase` rejects on the same event for the same class of reason, and
 * these two paths behaving alike is the point.
 *
 * **And rejecting does not cancel anything**, which is the part a caller has to be
 * told: the queued removal still lands. The message says what blocked it, because
 * the fix is something the user can do.
 *
 * `fake-indexeddb` is not a browser. The behaviour above is why this path is
 * exercised rather than trusted, not a claim about what a real browser does — and
 * rejecting is correct whichever way a real browser goes.
 */
export function deleteSpectreDatabase(options: {
  readonly indexedDB: IDBFactory;
  readonly databaseName: string;
}): Promise<void> {
  const { indexedDB: factory, databaseName } = options;

  return new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error ?? new Error(`Removing the "${databaseName}" database failed.`));
    };

    request.onblocked = () => {
      reject(
        new Error(
          `Removing the "${databaseName}" database was blocked: another connection is ` +
            `holding it open. Close other SpectreMail tabs and try again.`,
        ),
      );
    };
  });
}

/**
 * A {@link SpectreStorage} over one IndexedDB database.
 *
 * ## One connection per operation
 *
 * Through {@link openSpectreDatabase}, which states why the connection is opened per
 * operation and why the caller closes it.
 *
 * ## A write waits for the transaction, not for the request
 *
 * An IndexedDB request's `success` fires *inside* its transaction, before the
 * transaction has committed. Resolving there would report a write as saved before
 * it is durable, and a user who reloads on that promise would come back to a
 * missing mailbox with no explanation. So this resolves on `oncomplete` and
 * rejects on both `onerror` and `onabort`.
 */
export function createIndexedDbStorage(options: IndexedDbStorageOptions): SpectreStorage {
  const { indexedDB: factory, databaseName, storeName } = options;

  function openDatabase(): Promise<IDBDatabase> {
    return openSpectreDatabase({
      indexedDB: factory,
      databaseName,
      // **Both stores, even though this adapter reads and writes one of them.** The
      // database's shape belongs to the database; see `MAILBOXES_STORE_NAME`. An adapter
      // that created only its own store would make the shipped contents depend on which
      // operation ran first, and `clearAll`'s removal requirement is proved against them.
      storeNames: [storeName, MAILBOXES_STORE_NAME],
    });
  }

  async function readStored(): Promise<unknown> {
    const db = await openDatabase();

    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        let value: unknown;

        transaction.objectStore(storeName).get(CURRENT_MAILBOX_KEY).onsuccess = (
          event: Event,
        ): void => {
          value = (event.target as IDBRequest<unknown>).result;
        };

        // Resolved on completion rather than on the request's success, so the read
        // and the write below agree about when a transaction has finished. A
        // rejection earlier in the chain settles the promise first, so the later
        // handlers here cannot un-settle it.
        transaction.oncomplete = () => {
          resolve(value);
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Reading the stored mailbox failed."));
        };
        transaction.onabort = () => {
          reject(transaction.error ?? new Error("Reading the stored mailbox was aborted."));
        };
      });
    } finally {
      db.close();
    }
  }

  async function writeStored(record: StoredMailboxRecord): Promise<void> {
    const db = await openDatabase();

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        // A synchronous throw here — `DataCloneError` on a value IndexedDB cannot
        // clone, most plausibly — rejects the promise through the executor, which
        // is the right outcome rather than an exception escaping a `void` call.
        transaction.objectStore(storeName).put(record, CURRENT_MAILBOX_KEY);

        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Saving the mailbox was rejected."));
        };
        transaction.onabort = () => {
          reject(transaction.error ?? new Error("Saving the mailbox was aborted."));
        };
      });
    } finally {
      db.close();
    }
  }

  /**
   * Remove the database, through {@link deleteSpectreDatabase}.
   *
   * **And it now covers a second store this build does create.** The collection of
   * mailboxes this device holds lives in its own object store in the same database,
   * so this removal is no longer proved by a planted store alone - it removes the
   * product's own shape. `deleteSpectreDatabase` states why the whole database and
   * why a refusal is reported rather than waited on.
   */
  function deleteDatabase(): Promise<void> {
    return deleteSpectreDatabase({ indexedDB: factory, databaseName });
  }

  return {
    async loadMailbox() {
      return readStoredMailboxRecord(await readStored());
    },

    async saveMailbox(mailbox: Mailbox) {
      // **Narrowed on the way in as well as out.** The parameter is typed, so
      // TypeScript has already refused a literal that is not a mailbox — but a
      // value assembled from `unknown` reaches a typed parameter happily, which is
      // the case `isMailbox`'s own documentation singles out. Persisting it would
      // put a record on disk that the next read refuses, which is a save that
      // reports success and loses the address.
      //
      // A `TypeError` rather than a normalized code, deliberately: the normalized
      // vocabulary in `packages/core` describes **provider** failures, and a caller
      // passing something that is not a mailbox is not a provider condition. There
      // is no code in that closed set this deserves, and inventing one would widen
      // a vocabulary two clients already switch over.
      if (!isMailbox(mailbox)) {
        throw new TypeError(
          "saveMailbox was given a value that is not a mailbox of the shared model, so " +
            "nothing was stored. Build it with createMailbox.",
        );
      }

      await writeStored(toStoredMailboxRecord(mailbox));
    },

    /**
     * Remove everything this device holds.
     *
     * **No narrowing happens here, and that is deliberate.** Every other method on
     * this contract validates the value it is given, because `spectre-storage`
     * requires a stored record to be untrusted input. There is nothing to narrow
     * when the operation is deletion — which is also why this method has no `TypeError`
     * branch while `saveMailbox` does, and why adding one to match it would be
     * inventing a failure the operation cannot have.
     */
    async clearAll() {
      await deleteDatabase();
    },
  };
}
