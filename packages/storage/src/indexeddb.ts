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
 */
export const SPECTRE_DATABASE_VERSION = 1;

/**
 * The key the current mailbox is written under.
 *
 * One key, because the contract stores one thing. The roadmap's other record
 * kinds get their own key when they get a consumer.
 */
export const CURRENT_MAILBOX_KEY = "current";

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
 * A {@link SpectreStorage} over one IndexedDB database.
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
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, SPECTRE_DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };

      // A blocked open means another connection is holding an older version open.
      // Reported rather than waited on: an open that never resolves would leave a
      // caller with no address and no explanation, and "no explanation" is the one
      // outcome `SpectreStorage` exists to prevent.
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
  };
}
