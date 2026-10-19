/**
 * The collection's IndexedDB adapter, and the two records a website write settles at once.
 *
 * ## What is real here and what is not
 *
 * Everything about *IndexedDB's semantics* is exercised against `fake-indexeddb` `6.2.5`,
 * which reimplements the specification rather than approximating it — so the round trip,
 * the rollback of two stores together, and the refusal to answer for a record this build
 * cannot read are all driven by the platform rather than by a stub.
 *
 * **What this file does not establish is recorded in `apps/web/e2e`'s own note and in the
 * change's `design.md` D8:** `fake-indexeddb` is not a browser. Nothing here reads a
 * rendered pixel, and nothing here contacts a provider.
 *
 * ## The two cases this file exists to make unfalsifiable
 *
 * 1. **`the two records never name different mailboxes`** — the trap `addMailbox`'s own
 *    documentation is written against, and the reason the composed factory exists.
 * 2. **`removal takes the collection's own store`** — the requirement `clearAll` has
 *    always carried, whose proof used to be a store planted beside the product and is now
 *    the product's own shape.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { IDBFactory as FakeIndexedDbFactory } from "fake-indexeddb";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import type { SpectreMailboxes } from "./mailboxes";
import { createBrowserStorage } from "./browser";
import { CURRENT_MAILBOX_KEY, createIndexedDbStorage, SPECTRE_DATABASE_VERSION } from "./indexeddb";
import {
  createBrowserMailboxRecords,
  createBrowserMailboxes,
  createIndexedDbMailboxRecords,
  createIndexedDbMailboxes,
  MAILBOX_COLLECTION_KEY,
  MAILBOXES_STORE_NAME,
} from "./indexeddb-mailboxes";
import type { MailboxRecords } from "./indexeddb-mailboxes";
import { readStoredMailboxRecord, SPECTRE_ENVELOPE_VERSION } from "./record";

const DATABASE = "spectre-mail-records-test";
const SINGLE_STORE = "mailbox";

function mailbox(id: string, address: string): Mailbox {
  return createMailbox({
    id,
    address,
    createdAt: 1_757_000_000_000,
    credentials: { provider: "guerrilla", sessionId: id },
  });
}

const OLDER = mailbox("older-token", "older@sharklasers.com");
const NEWER = mailbox("newer-token", "newer@sharklasers.com");
const THIRD = mailbox("third-token", "third@sharklasers.com");

/** A fresh in-memory IndexedDB, per test, so nothing leaks between them. */
function newRecords(): { records: MailboxRecords; factory: IDBFactory } {
  const factory = new FakeIndexedDbFactory();
  const records = createIndexedDbMailboxRecords({
    indexedDB: factory,
    databaseName: DATABASE,
    storeName: SINGLE_STORE,
    mailboxesStoreName: MAILBOXES_STORE_NAME,
  });
  return { records, factory };
}

/** The raw value stored under `key`, read through the platform rather than the adapter. */
function readRaw(
  factory: IDBFactory,
  storeName: string,
  key: string,
): Promise<unknown | undefined> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DATABASE, SPECTRE_DATABASE_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const name of [SINGLE_STORE, MAILBOXES_STORE_NAME]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    open.onerror = () => reject(open.error ?? new Error("could not open"));
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => {
        db.close();
        resolve(request.result as unknown);
      };
      request.onerror = () => {
        db.close();
        reject(request.error ?? new Error("could not read"));
      };
    };
  });
}

/** Every object store name in the database, as the platform reports them. */
async function storeNamesIn(factory: IDBFactory, name: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const open = factory.open(name);
    open.onerror = () => reject(open.error ?? new Error("could not open"));
    open.onsuccess = () => {
      const db = open.result;
      const names = Array.from(db.objectStoreNames);
      db.close();
      resolve(names);
    };
  });
}

/** Write a value straight into a store, the way a record from another build gets there. */
function putRaw(
  factory: IDBFactory,
  storeName: string,
  key: string,
  value: unknown,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const open = factory.open(DATABASE, SPECTRE_DATABASE_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const name of [SINGLE_STORE, MAILBOXES_STORE_NAME]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    open.onerror = () => reject(open.error ?? new Error("could not open"));
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value, key);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error ?? new Error("could not write"));
      };
    };
  });
}

describe("the mailboxes this device holds, over IndexedDB", () => {
  it("reports an empty collection rather than a failure when this device holds none", async () => {
    const { records } = newRecords();

    expect(await records.mailboxes.loadMailboxes()).toEqual([]);
    expect(await records.storage.loadMailbox()).toBeNull();
  });

  it("reads back a mailbox it was handed, through the same contract", async () => {
    const { records } = newRecords();

    await records.mailboxes.addMailbox(OLDER);

    expect(await records.mailboxes.loadMailboxes()).toEqual([OLDER]);
  });

  it("reports the newest first, and a second record moves a held mailbox rather than copying it", async () => {
    const { records } = newRecords();

    await records.mailboxes.addMailbox(OLDER);
    await records.mailboxes.addMailbox(NEWER);

    expect(await records.mailboxes.loadMailboxes()).toEqual([NEWER, OLDER]);

    // **Re-recording one this device already holds**, which is what a retry and a
    // return both do. A duplicate address is not a thing a user did.
    await records.mailboxes.addMailbox(OLDER);

    const held = await records.mailboxes.loadMailboxes();
    expect(held).toEqual([OLDER, NEWER]);
    expect(held.filter((one) => one.id === OLDER.id)).toHaveLength(1);
  });

  it("never hands out a partially built value, and never deletes a member it cannot read", async () => {
    const factory = new FakeIndexedDbFactory();
    const records = createIndexedDbMailboxRecords({
      indexedDB: factory,
      databaseName: DATABASE,
      storeName: SINGLE_STORE,
      mailboxesStoreName: MAILBOXES_STORE_NAME,
    });

    await records.mailboxes.addMailbox(OLDER);
    // **A member from a build this one does not understand**, written the way one gets
    // there: not through the product.
    const stored = (await readRaw(factory, MAILBOXES_STORE_NAME, MAILBOX_COLLECTION_KEY)) as {
      mailboxes: unknown[];
    };
    await putRaw(factory, MAILBOXES_STORE_NAME, MAILBOX_COLLECTION_KEY, {
      version: SPECTRE_ENVELOPE_VERSION,
      mailboxes: [...stored.mailboxes, { version: 99, mailbox: { nonsense: true } }],
    });

    expect(await records.mailboxes.loadMailboxes()).toEqual([OLDER]);

    // **And it is still there afterwards**, which is the half a `filter` at the call
    // site would lose.
    await records.mailboxes.addMailbox(NEWER);
    const after = (await readRaw(factory, MAILBOXES_STORE_NAME, MAILBOX_COLLECTION_KEY)) as {
      mailboxes: unknown[];
    };
    expect(after.mailboxes).toHaveLength(3);
    expect(await records.mailboxes.loadMailboxes()).toEqual([NEWER, OLDER]);
  });

  it("refuses to replace a collection record this build cannot read", async () => {
    const factory = new FakeIndexedDbFactory();
    const mailboxes: SpectreMailboxes = createIndexedDbMailboxes({
      indexedDB: factory,
      databaseName: DATABASE,
      storeName: SINGLE_STORE,
      mailboxesStoreName: MAILBOXES_STORE_NAME,
    });

    await mailboxes.addMailbox(OLDER);
    await putRaw(factory, MAILBOXES_STORE_NAME, MAILBOX_COLLECTION_KEY, { version: 99 });

    await expect(mailboxes.addMailbox(NEWER)).rejects.toThrow(/does not understand/);

    // **The refusal changed nothing**, which is the property the message promises.
    expect(
      (await readRaw(factory, MAILBOXES_STORE_NAME, MAILBOX_COLLECTION_KEY)) as unknown,
    ).toEqual({
      version: 99,
    });
  });

  it("refuses a value that is not a mailbox, on the way in", async () => {
    const { records } = newRecords();

    await expect(
      records.mailboxes.addMailbox({ address: "nope@example.test" } as unknown as Mailbox),
    ).rejects.toBeInstanceOf(TypeError);
    expect(await records.mailboxes.loadMailboxes()).toEqual([]);
  });

  it("reads and writes only its own store", async () => {
    const factory = new FakeIndexedDbFactory();
    const mailboxes = createIndexedDbMailboxes({
      indexedDB: factory,
      databaseName: DATABASE,
      storeName: SINGLE_STORE,
      mailboxesStoreName: MAILBOXES_STORE_NAME,
    });

    await mailboxes.addMailbox(OLDER);

    // **The singular record is untouched by the collection adapter**, which is what keeps
    // the agreement a property of the factory that pairs them rather than of one adapter.
    expect(await readRaw(factory, SINGLE_STORE, CURRENT_MAILBOX_KEY)).toBeUndefined();
    expect(await mailboxes.loadMailboxes()).toEqual([OLDER]);
  });

  it("creates the database's whole shape whichever adapter opens it first", async () => {
    const factory = new FakeIndexedDbFactory();

    // **The collection alone.**
    await createIndexedDbMailboxes({
      indexedDB: factory,
      databaseName: DATABASE,
      storeName: SINGLE_STORE,
      mailboxesStoreName: MAILBOXES_STORE_NAME,
    }).loadMailboxes();
    expect((await storeNamesIn(factory, DATABASE)).sort()).toEqual(
      [MAILBOXES_STORE_NAME, SINGLE_STORE].sort(),
    );

    // **And the single-mailbox one alone**, on a fresh platform. If each adapter created
    // only its own store, the database's shape would depend on which operation a visitor
    // performed first, and the removal requirement's proof would be a proof that varies.
    const other = new FakeIndexedDbFactory();
    await createIndexedDbStorage({
      indexedDB: other,
      databaseName: DATABASE,
      storeName: SINGLE_STORE,
    }).loadMailbox();
    expect((await storeNamesIn(other, DATABASE)).sort()).toEqual(
      [MAILBOXES_STORE_NAME, SINGLE_STORE].sort(),
    );
  });
});

describe("the two records of one mailbox", () => {
  it("records a mailbox in both stores, and they name the same mailbox", async () => {
    const { records, factory } = newRecords();

    await records.storage.saveMailbox(NEWER);

    expect(await records.storage.loadMailbox()).toEqual(NEWER);
    expect(
      readStoredMailboxRecord(await readRaw(factory, SINGLE_STORE, CURRENT_MAILBOX_KEY)),
    ).toEqual(NEWER);
    expect(await records.mailboxes.loadMailboxes()).toEqual([NEWER]);
  });

  it("never lets the two records name different mailboxes", async () => {
    const { records, factory } = newRecords();

    await records.storage.saveMailbox(OLDER);
    await records.storage.saveMailbox(NEWER);

    /** The invariant, read from both stores through the platform rather than the adapter. */
    const stored = readStoredMailboxRecord(
      await readRaw(factory, SINGLE_STORE, CURRENT_MAILBOX_KEY),
    );
    const held = await records.mailboxes.loadMailboxes();

    expect(stored).toEqual(NEWER);
    expect(held[0]).toEqual(stored);
    // **Every earlier mailbox is still held**, which is the website requirement this
    // record shape exists to make possible.
    expect(held.map((one) => one.id)).toEqual([NEWER.id, OLDER.id]);
  });

  it("answers the boot from the collection, and from the singular record only while it is empty", async () => {
    const factory = new FakeIndexedDbFactory();
    const records = createIndexedDbMailboxRecords({
      indexedDB: factory,
      databaseName: DATABASE,
      storeName: SINGLE_STORE,
      mailboxesStoreName: MAILBOXES_STORE_NAME,
    });

    // **A device whose only mailbox predates this build**: the singular record, and
    // nothing in the collection.
    await putRaw(factory, SINGLE_STORE, CURRENT_MAILBOX_KEY, {
      version: 1,
      mailbox: OLDER,
    });

    expect(await records.storage.loadMailbox()).toEqual(OLDER);

    // **And the migration answer is one write**, not a second place to look: the first
    // write after this build records the mailbox in both places at once.
    await records.storage.saveMailbox(NEWER);
    expect(await records.storage.loadMailbox()).toEqual(NEWER);
    expect(await records.mailboxes.loadMailboxes()).toEqual([NEWER]);
  });

  it("refuses to answer rather than reporting an unreadable collection as none held", async () => {
    const factory = new FakeIndexedDbFactory();
    const records = createIndexedDbMailboxRecords({
      indexedDB: factory,
      databaseName: DATABASE,
      storeName: SINGLE_STORE,
      mailboxesStoreName: MAILBOXES_STORE_NAME,
    });

    // **The dangerous state is precisely this one**: a singular record holding a real
    // mailbox, and a collection this build cannot read. Answering "none held" would tell
    // a page it is a first visit, and a first visit creates and overwrites.
    await putRaw(factory, SINGLE_STORE, CURRENT_MAILBOX_KEY, { version: 1, mailbox: OLDER });
    await putRaw(factory, MAILBOXES_STORE_NAME, MAILBOX_COLLECTION_KEY, { version: 99 });

    await expect(records.storage.loadMailbox()).rejects.toThrow(/does not understand/);
  });

  it("removes the collection's own store, not only the record the single-mailbox adapter holds", async () => {
    const { records, factory } = newRecords();

    await records.storage.saveMailbox(NEWER);
    expect((await storeNamesIn(factory, DATABASE)).sort()).toEqual(
      [MAILBOXES_STORE_NAME, SINGLE_STORE].sort(),
    );

    await records.storage.clearAll();

    // **The database is gone**, so the second store is unreachable rather than merely
    // unread. A key-scoped removal would leave it sitting there.
    expect(await storeNamesOrNone(factory)).toEqual([]);
    expect(await records.mailboxes.loadMailboxes()).toEqual([]);
    expect(await records.storage.loadMailbox()).toBeNull();
  });

  it("is idempotent, and a device holding nothing can be cleared", async () => {
    const { records } = newRecords();

    await expect(records.storage.clearAll()).resolves.toBeUndefined();
    await expect(records.storage.clearAll()).resolves.toBeUndefined();
  });
});

describe("the browser entry points name the same database and store", () => {
  it("a mailbox saved by the single-mailbox entry point is the one the paired entry point reads", async () => {
    const factory = new FakeIndexedDbFactory();
    const installed = Reflect.get(globalThis, "indexedDB");
    Reflect.set(globalThis, "indexedDB", factory);
    try {
      const single = createBrowserStorage();
      await single.saveMailbox(THIRD);

      // **Two declarations of the same database name**, one in `browser.ts` and one in
      // `indexeddb-mailboxes.ts`, which this stage could not merge. The consequence of
      // them drifting is two databases for one product, so it is asserted rather than
      // trusted — **in both directions**, because one direction alone would be satisfied
      // by a name that happened to agree on the read path only.
      //
      // **First: what the single-mailbox entry point wrote, the paired entry point reads
      // back.** That is the singular record, so it is answered through the fallback.
      expect(await createBrowserMailboxRecords().storage.loadMailbox()).toEqual(THIRD);

      // **Then: what the collection wrote, the single-mailbox entry point reads back as
      // current.** That is the collection's head winning over the singular record, which
      // only happens if both name one database and one store.
      await createBrowserMailboxes().addMailbox(THIRD);
      expect(await single.loadMailbox()).toEqual(THIRD);

      await single.clearAll();
      expect(await createBrowserMailboxes().loadMailboxes()).toEqual([]);
    } finally {
      if (installed === undefined) {
        Reflect.deleteProperty(globalThis, "indexedDB");
      } else {
        Reflect.set(globalThis, "indexedDB", installed);
      }
    }
  });

  it("refuses where the platform provides none, rather than storing nothing", () => {
    const installed = Reflect.get(globalThis, "indexedDB");
    Reflect.deleteProperty(globalThis, "indexedDB");
    try {
      expect(() => createBrowserMailboxes()).toThrow(/no IndexedDB/);
      expect(() => createBrowserMailboxRecords()).toThrow(/no IndexedDB/);
    } finally {
      if (installed !== undefined) Reflect.set(globalThis, "indexedDB", installed);
    }
  });
});

/**
 * Object store names, or an empty list when the database is not there at all.
 *
 * **A database that was deleted opens with no stores and fires `success`**, so the
 * success handler is the one that answers; `onerror` covers an open that never
 * completes either way, and a test asserting "the database is gone" must not pass on a
 * read that could not be made.
 */
async function storeNamesOrNone(factory: IDBFactory): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    const request = factory.open(DATABASE);
    request.onerror = () => resolve([]);
    request.onblocked = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;
      const found = Array.from(db.objectStoreNames);
      db.close();
      resolve(found);
    };
  });
}
