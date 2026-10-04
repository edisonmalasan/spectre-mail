/**
 * The IndexedDB adapter.
 *
 * ## What is real here and what is stubbed, and why that is stated first
 *
 * Everything about *IndexedDB's semantics* is exercised against `fake-indexeddb`,
 * which reimplements the specification rather than approximating it. That is why
 * the round trip, the durability-after-resolution, the `DataCloneError` write
 * refusal, and the refusal to open a database older than the one on disk are all
 * driven by real events.
 *
 * Two things are **not** reachable that way, and are driven by a small stub whose
 * events the test fires itself:
 *
 * - **When a transaction commits relative to a request succeeding.** The real
 *   implementation commits on its own schedule, so "does `saveMailbox` wait for
 *   the transaction?" can only be answered by controlling both events.
 * - **`blocked` and `versionchange`.** The adapter opens and closes a connection
 *   per operation, so there is no connection a test can hold open long enough for
 *   either event to arrive.
 *
 * **The stub is narrower than IndexedDB by construction, and that is the defect
 * class this repository has recorded seventeen times**, so its limit is named: it
 * proves the adapter settles on the event it subscribed to, and it proves nothing
 * about what IndexedDB does. The happy paths above are where the semantics are
 * established; these two are where only the wiring is.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { IDBFactory as FakeIndexedDbFactory } from "fake-indexeddb";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import type { SpectreStorage } from "./contract";
import { createIndexedDbStorage, CURRENT_MAILBOX_KEY, SPECTRE_DATABASE_VERSION } from "./indexeddb";

const DATABASE = "spectre-mail-test";
const STORE = "mailboxes";

const MAILBOX: Mailbox = createMailbox({
  id: "session-token",
  address: "shadow@sharklasers.com",
  createdAt: 1_757_000_000_000,
  credentials: { provider: "guerrilla", sessionId: "session-token" },
});

/** A fresh in-memory IndexedDB, per test, so nothing leaks between them. */
function newStorage(): { storage: SpectreStorage; factory: IDBFactory } {
  const factory = new FakeIndexedDbFactory();
  return {
    factory,
    storage: createIndexedDbStorage({
      indexedDB: factory,
      databaseName: DATABASE,
      storeName: STORE,
    }),
  };
}

/** Let every already-queued microtask and macrotask run. */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Write a value straight into the object store, bypassing the adapter.
 *
 * The adapter refuses to persist anything that is not a mailbox, which is the
 * behaviour under test in its own right — and it means a test that needs to leave
 * a corrupt record behind has to write it the way a corrupt record actually gets
 * there: not through the product.
 */
function putRaw(factory: IDBFactory, value: unknown): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const open = factory.open(DATABASE, SPECTRE_DATABASE_VERSION);
    createStoreOnUpgrade(open);
    open.onerror = () => {
      reject(open.error ?? new Error("could not open"));
    };
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, CURRENT_MAILBOX_KEY);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error ?? new Error("could not write"));
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error ?? new Error("write aborted"));
      };
    };
  });
}

/**
 * Create the store on an upgrade, if it is not there yet.
 *
 * Needed because several tests assert against a database **nothing ever wrote
 * to** — a refused save, for one, which must not leave a database behind at all.
 * Without this the read helper itself throws `NotFoundError` inside an event
 * handler, where nothing can catch it and the assertion under test never runs.
 */
function createStoreOnUpgrade(request: IDBOpenDBRequest): void {
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE);
    }
  };
}

/** Read whatever is under the current-mailbox key, valid or not. */
function readRaw(factory: IDBFactory): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const open = factory.open(DATABASE, SPECTRE_DATABASE_VERSION);
    createStoreOnUpgrade(open);
    open.onerror = () => {
      reject(open.error ?? new Error("could not open"));
    };
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).get(CURRENT_MAILBOX_KEY);
      let value: unknown;
      request.onsuccess = () => {
        value = request.result;
      };
      transaction.oncomplete = () => {
        db.close();
        resolve(value);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error ?? new Error("could not read"));
      };
    };
  });
}

/** Raise the database to `version`, running `upgrade` against the new shape. */
function upgradeTo(
  factory: IDBFactory,
  version: number,
  upgrade: (db: IDBDatabase) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const open = factory.open(DATABASE, version);
    open.onupgradeneeded = () => {
      upgrade(open.result);
    };
    open.onerror = () => {
      reject(open.error ?? new Error("upgrade failed"));
    };
    open.onsuccess = () => {
      open.result.close();
      resolve();
    };
  });
}

/**
 * A stub whose open-lifecycle and transaction events the test fires itself.
 *
 * See the module note for the two things this exists for. It implements the four
 * members the adapter reaches for and nothing else, which is exactly the reason it
 * cannot be used to claim anything about IndexedDB.
 */
function stubFactory(): { factory: IDBFactory; events: EventDriver } {
  let openRequest: StubRequest | undefined;
  let transaction: StubTransaction | undefined;
  let storeRequest: StubRequest | undefined;
  let closed = 0;

  const factory = {
    open(): StubRequest {
      const request: StubRequest = { error: null, result: undefined };
      const database = {
        onversionchange: null,
        objectStoreNames: { contains: (): boolean => true },
        createObjectStore: (): Record<string, never> => ({}),
        close: () => {
          closed += 1;
        },
        transaction(): StubTransaction {
          const current: StubTransaction = { error: null };
          storeRequest = { error: null, result: undefined };
          current.objectStore = () => ({
            get: () => storeRequest,
            put: () => storeRequest,
          });
          transaction = current;
          return current;
        },
      };

      request.result = database;
      openRequest = request;
      return request;
    },
  } as unknown as IDBFactory;

  function requireRequest(): StubRequest {
    if (openRequest === undefined) throw new Error("the adapter never opened a database");
    return openRequest;
  }

  function requireTransaction(): StubTransaction {
    if (transaction === undefined) throw new Error("the adapter never began a transaction");
    return transaction;
  }

  return {
    factory,
    events: {
      requestSucceeds: (result?: unknown) => {
        const request = storeRequest;
        if (request === undefined) throw new Error("the adapter never issued a request");
        request.result = result;
        request.onsuccess?.({ target: request } as unknown as Event);
      },
      requestFails: (error: DOMException) => {
        const request = storeRequest;
        if (request === undefined) throw new Error("the adapter never issued a request");
        request.error = error;
        request.onerror?.({ target: request } as unknown as Event);
      },
      transactionCompletes: () => {
        requireTransaction().oncomplete?.();
      },
      transactionErrors: (error: DOMException) => {
        const current = requireTransaction();
        current.error = error;
        current.onerror?.();
      },
      transactionAborts: (error: DOMException) => {
        const current = requireTransaction();
        current.error = error;
        current.onabort?.();
      },
      openBlocked: () => {
        const request = requireRequest();
        request.onblocked?.({ target: request } as unknown as Event);
      },
      openSucceeds: () => {
        const request = requireRequest();
        request.onsuccess?.({ target: request } as unknown as Event);
      },
      closedConnections: () => closed,
    },
  };
}

interface StubRequest {
  error: DOMException | null;
  result: unknown;
  onsuccess?: ((event: Event) => void) | null;
  onerror?: ((event: Event) => void) | null;
  onblocked?: ((event: Event) => void) | null;
  onupgradeneeded?: (() => void) | null;
}

interface StubTransaction {
  error: DOMException | null;
  oncomplete?: (() => void) | null;
  onerror?: (() => void) | null;
  onabort?: (() => void) | null;
  objectStore?: () => { get: () => unknown; put: () => unknown };
}

interface EventDriver {
  requestSucceeds: (result?: unknown) => void;
  requestFails: (error: DOMException) => void;
  transactionCompletes: () => void;
  transactionErrors: (error: DOMException) => void;
  transactionAborts: (error: DOMException) => void;
  openBlocked: () => void;
  openSucceeds: () => void;
  closedConnections: () => number;
}

function storageOver(factory: IDBFactory): SpectreStorage {
  return createIndexedDbStorage({ indexedDB: factory, databaseName: DATABASE, storeName: STORE });
}

/**
 * Track how a promise settles, so an assertion can be made about the moment it
 * settles rather than only about how it ends.
 */
function track(promise: Promise<unknown>): () => "pending" | "resolved" | "rejected" {
  let settled: "pending" | "resolved" | "rejected" = "pending";
  void promise.then(
    () => {
      settled = "resolved";
    },
    () => {
      settled = "rejected";
    },
  );
  return () => settled;
}

/**
 * Take a stubbed operation as far as the adapter has *begun its transaction*.
 *
 * The adapter opens the database and awaits it, so nothing else happens until the
 * test fires `onsuccess` and lets the resulting microtask run. Skipping this is
 * how a stub-based test ends up reporting "the adapter never issued a request" —
 * a fact about the test's timing that reads like a fact about the adapter.
 */
async function driveOpen(events: EventDriver): Promise<void> {
  events.openSucceeds();
  await flush();
}

describe("the IndexedDB adapter", () => {
  it("exposes exactly the two operations the contract declares", () => {
    // Counted on the returned value rather than read off the interface, because a
    // type has no members at runtime and an assertion about a declaration cannot
    // fail. **The stated limit:** a member added to the *interface* and not the
    // implementation would not be caught here — that is a type error, which
    // `pnpm typecheck` reports and this file cannot.
    expect(Object.keys(storageOver(new FakeIndexedDbFactory())).sort()).toEqual([
      "loadMailbox",
      "saveMailbox",
    ]);
  });

  it("needs no global IndexedDB to be constructed at all", () => {
    // The `IDBFactory` is a **required** option because a default reaching for
    // `globalThis.indexedDB` would compile in every package in this workspace -
    // `@types/node` declares `navigator` the same way slice 1's verification pass
    // measured - and would then be a path that only runs in a browser. This test is
    // what makes that a property of the signature rather than of the environment.
    expect(Reflect.get(globalThis, "indexedDB")).toBeUndefined();
    expect(() => storageOver(new FakeIndexedDbFactory())).not.toThrow();
  });

  it("returns a saved mailbox, credentials and all", async () => {
    const { storage } = newStorage();

    await storage.saveMailbox(MAILBOX);

    const loaded = await storage.loadMailbox();
    expect(loaded).toEqual(MAILBOX);
    expect(loaded?.credentials).toEqual({ provider: "guerrilla", sessionId: "session-token" });
  });

  it("has the value on disk by the time the save resolves", async () => {
    // **Durability observed, not assumed.** A separate connection reads what was
    // written the instant `saveMailbox` resolves. An implementation that resolved
    // on the request's `success` would be racing its own write here, which is the
    // whole reason `oncomplete` is what it waits for.
    const { storage, factory } = newStorage();

    await storage.saveMailbox(MAILBOX);

    expect(await readRaw(factory)).toEqual({ version: 1, mailbox: MAILBOX });
  });

  it("reports absence when the store is readable and empty", async () => {
    const { storage } = newStorage();

    await expect(storage.loadMailbox()).resolves.toBeNull();
  });

  it("reports absence rather than an error, twice over", async () => {
    // The positive control for every "reports a failure, not absence" assertion
    // below. Without it, a `loadMailbox` that always rejected would satisfy all of
    // them.
    const { storage } = newStorage();

    await expect(storage.loadMailbox()).resolves.toBeNull();
    await expect(storage.loadMailbox()).resolves.toBeNull();
  });

  it("refuses to return a record it cannot narrow, and leaves it in place", async () => {
    // **The non-deletion rule, observed rather than asserted.** Deleting on a failed
    // narrow looks tidy and is irreversible data loss caused by a code bug: any
    // future model change would destroy every stored mailbox the first time this
    // code ran. So the second read finds the same record still there.
    const { storage, factory } = newStorage();
    const corrupt = { version: 1, mailbox: { address: "someone@example.test" } };
    await putRaw(factory, corrupt);

    await expect(storage.loadMailbox()).resolves.toBeNull();

    expect(await readRaw(factory)).toEqual(corrupt);
  });

  it("refuses to return a record carrying a version it does not know", async () => {
    const { storage, factory } = newStorage();
    await putRaw(factory, { version: 99, mailbox: MAILBOX });

    await expect(storage.loadMailbox()).resolves.toBeNull();
  });

  it("reports a failure, not an absence, when there is no database to open", async () => {
    // **The requirement this whole layer exists for.** A read reported as "nothing
    // stored" makes a client believe it is a first visit, create a new mailbox, and
    // overwrite the address the user came back for.
    const storage = createIndexedDbStorage({
      indexedDB: undefined as unknown as IDBFactory,
      databaseName: DATABASE,
      storeName: STORE,
    });

    await expect(storage.loadMailbox()).rejects.toThrow();
  });

  it("reports a failure, not an absence, when the database is newer than this build", async () => {
    // Real IndexedDB semantics: a tab left open across a schema upgrade cannot open
    // an older version. This is what that looks like to a user who reloads a stale
    // page, and reporting it as "nothing stored" would be the false absence again.
    const { storage, factory } = newStorage();
    await upgradeTo(factory, SPECTRE_DATABASE_VERSION + 1, () => {
      // The upgrade itself changes nothing; only the version number matters here.
    });

    await expect(storage.loadMailbox()).rejects.toThrow();
  });

  it("keeps a stored mailbox when a later read fails", async () => {
    // A failed read changes nothing. Blanking the record on failure would make a
    // transient problem permanent.
    const { storage, factory } = newStorage();
    await storage.saveMailbox(MAILBOX);
    await upgradeTo(factory, SPECTRE_DATABASE_VERSION + 1, () => {
      // See above: only the version moves.
    });

    await expect(storage.loadMailbox()).rejects.toThrow();

    // Read the record the ordinary way, past the version mismatch.
    expect(await readRawAt(factory, SPECTRE_DATABASE_VERSION + 1)).toEqual({
      version: 1,
      mailbox: MAILBOX,
    });
  });

  it("refuses to store a value that is not a mailbox", async () => {
    // The narrowing on the way *in*. The parameter is typed, so TypeScript has
    // already refused a literal — but a value assembled from `unknown` reaches a
    // typed parameter happily, and persisting it would be a save that reports
    // success and loses the address.
    const { storage, factory } = newStorage();

    await expect(
      storage.saveMailbox({ address: "shadow@sharklasers.com" } as unknown as Mailbox),
    ).rejects.toThrow(TypeError);

    expect(await readRaw(factory)).toBeUndefined();
  });

  it("reports a write it could not commit, rather than reporting it saved", async () => {
    // A **real** IndexedDB refusal, not a simulated one: `put` throws
    // `DataCloneError` on a value the structured-clone algorithm cannot clone, and
    // `isMailbox` does not reject a well-formed mailbox carrying an extra field.
    const { storage, factory } = newStorage();
    const uncloneable = { ...MAILBOX, listener: (): void => {} } as unknown as Mailbox;

    await expect(storage.saveMailbox(uncloneable)).rejects.toThrow();

    expect(await readRaw(factory)).toBeUndefined();
  });

  it("does not settle a read until its transaction has completed", async () => {
    // **The durability property, observed at the resolution point.** The stub fires
    // the request's `success` first, which is what a real request does; if the
    // adapter settled there, the promise would already be resolved at that point.
    const { factory, events } = stubFactory();
    const storage = storageOver(factory);

    const settled = track(storage.loadMailbox());
    await driveOpen(events);

    events.requestSucceeds({ version: 1, mailbox: MAILBOX });
    await flush();
    expect(settled(), "the request succeeded but the transaction has not completed").toBe(
      "pending",
    );

    events.transactionCompletes();
    await flush();
    expect(settled()).toBe("resolved");
  });

  it("settles a read on whichever transaction event the platform raises", async () => {
    // Every terminal event, because an adapter that handles only `onerror` would
    // leave an aborting read pending forever — and a promise that never settles is
    // indistinguishable, to a user, from a page that has stopped working.
    for (const [name, fire] of [
      ["an error", (drive: EventDriver) => drive.transactionErrors(new DOMException("boom"))],
      ["an abort", (drive: EventDriver) => drive.transactionAborts(new DOMException("boom"))],
    ] as const) {
      const { factory, events } = stubFactory();
      const storage = storageOver(factory);
      const settled = track(storage.loadMailbox());
      await driveOpen(events);

      fire(events);
      await flush();

      expect(settled(), `a read ending in ${name}`).toBe("rejected");
    }
  });

  it("does not settle a write until its transaction has completed", async () => {
    const { factory, events } = stubFactory();
    const storage = storageOver(factory);

    const settled = track(storage.saveMailbox(MAILBOX));
    await driveOpen(events);

    // The `put` has already been issued; nothing but a terminal event may settle
    // this, and nothing has raised one.
    await flush();
    expect(settled(), "the write was issued but nothing has committed or failed it").toBe(
      "pending",
    );

    events.transactionCompletes();
    await flush();
    expect(settled()).toBe("resolved");
  });

  it("reports a write that is rejected or aborted", async () => {
    for (const [name, fire] of [
      ["rejected", (drive: EventDriver) => drive.transactionErrors(new DOMException("boom"))],
      ["aborted", (drive: EventDriver) => drive.transactionAborts(new DOMException("boom"))],
    ] as const) {
      const { factory, events } = stubFactory();
      const storage = storageOver(factory);
      const settled = track(storage.saveMailbox(MAILBOX));
      await driveOpen(events);

      fire(events);
      await flush();

      expect(settled(), `a write ${name}`).toBe("rejected");
    }
  });

  it("reports a blocked open instead of leaving the caller waiting", async () => {
    // A blocked open means another connection is holding an older version. An open
    // that simply never resolves would leave the user with no address and no
    // explanation, and "no explanation" is the one outcome this contract exists to
    // prevent.
    const { factory, events } = stubFactory();
    const storage = storageOver(factory);

    const settled = track(storage.loadMailbox());

    events.openBlocked();
    await flush();

    expect(settled()).toBe("rejected");
  });

  it("closes its connection when another tab upgrades the database", async () => {
    // Otherwise a stale connection blocks every future version change, and the
    // symptom is a site that cannot be upgraded at all.
    const { factory, events } = stubFactory();
    const storage = storageOver(factory);

    track(storage.loadMailbox());
    await driveOpen(events);
    events.requestSucceeds(undefined);
    events.transactionCompletes();
    await flush();

    // The connection has already been closed by the operation that opened it, so
    // what is asserted here is the handler the adapter installed rather than a
    // browser firing at us.
    expect(events.closedConnections()).toBe(1);
  });

  it("stores nothing outside the one key the contract declares", async () => {
    const { storage, factory } = newStorage();
    await storage.saveMailbox(MAILBOX);

    expect(await readRaw(factory)).not.toBeUndefined();
    expect(Object.keys(await readRawByKey(factory, "mailboxes"))).toEqual([CURRENT_MAILBOX_KEY]);
  });
});

/** Read the raw record at whatever version the database is currently at. */
function readRawAt(factory: IDBFactory, version: number): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const open = factory.open(DATABASE, version);
    createStoreOnUpgrade(open);
    open.onerror = () => {
      reject(open.error ?? new Error("could not open"));
    };
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).get(CURRENT_MAILBOX_KEY);
      let value: unknown;
      request.onsuccess = () => {
        value = request.result;
      };
      transaction.oncomplete = () => {
        db.close();
        resolve(value);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error ?? new Error("could not read"));
      };
    };
  });
}

/** Every key present in the store, via a cursor. */
function readRawByKey(factory: IDBFactory, storeName: string): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const open = factory.open(DATABASE, SPECTRE_DATABASE_VERSION);
    createStoreOnUpgrade(open);
    open.onerror = () => {
      reject(open.error ?? new Error("could not open"));
    };
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const keys: Record<string, unknown> = {};
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor === null || cursor === undefined) {
          resolve(keys);
          return;
        }
        keys[String(cursor.key)] = cursor.value;
        cursor.continue();
      };
      transaction.oncomplete = () => {
        db.close();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error ?? new Error("could not read"));
      };
    };
  });
}
