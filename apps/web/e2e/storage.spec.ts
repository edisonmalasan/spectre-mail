/**
 * The storage a page actually uses, on the platform a page actually runs on.
 *
 * ## Why these specs exist when 44 unit tests already cover the same functions
 *
 * Because they do not cover the same thing, and the difference is the whole point.
 *
 * Every storage test in this repository runs against `fake-indexeddb` `6.2.5`, which
 * is **not a browser**. That is a good substrate — it drives real `onblocked` events
 * from a real held-open connection, which is hard to arrange any other way — and it
 * is what established the blocked-removal semantics this repository has relied on
 * since M6 slice 3. But it cannot answer the question a user actually asks, which is
 * "is my address still on this device?", because `jsdom` implements no IndexedDB at
 * all and `createBrowserStorage()` — the function `main.tsx` reaches by default — was
 * **executed by no test in the workspace** before this file existed.
 *
 * ## Why the central assertion is about device state, not about a return value
 *
 * Each removal spec answers by asking the platform what is left, through
 * `indexedDB.databases()`. A call that resolved successfully and left its data behind
 * is precisely the failure a return-value assertion cannot see, and it is precisely
 * the failure a privacy control must not have. "The promise resolved" and "the data
 * is gone" are different claims, and only one of them is the claim that matters.
 *
 * ## Why nothing here is allowed to reach the network
 *
 * See `recorded-provider.ts`. A red run of this file must mean this repository
 * changed, which is only true while provider responses are replayed from recordings.
 *
 * @module
 */

import { expect, test, type Page } from "@playwright/test";

import { serveRecordedProvider } from "./recorded-provider";
import { openFreshMailbox } from "./open-mailbox";

/**
 * A promise the spec resolves when it chooses.
 *
 * Used to hold a provider answer open so an ordering claim can be inspected while it
 * is still undecided. No duration, so nothing here can flake on a slow machine.
 */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/**
 * Every IndexedDB database this origin currently holds, by name.
 *
 * **A fresh browser context holds none at all**, which is what makes this the honest
 * instrument: the suite never needs to know what the page calls its database, so it
 * cannot drift from the answer. Renaming the database would leave these specs passing
 * and correct, which is the opposite of the failure a hard-coded literal invites.
 */
async function databaseNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    return databases.map((database) => database.name).filter((name): name is string => !!name);
  });
}

/**
 * Everything stored in one database, read through the platform's own API.
 *
 * Reads **every** object store rather than one named store, on purpose: this is the
 * check that says what is on the device, and a helper that knew the store name would
 * be assuming the answer.
 */
async function readWholeDatabase(page: Page, databaseName: string): Promise<unknown[]> {
  return page.evaluate(async (name) => {
    const found: unknown[] = [];
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("open failed"));
    });
    try {
      for (const storeName of Array.from(database.objectStoreNames)) {
        const records = await new Promise<unknown[]>((resolve, reject) => {
          const transaction = database.transaction(storeName, "readonly");
          const request = transaction.objectStore(storeName).getAll();
          request.onsuccess = () => resolve(request.result as unknown[]);
          request.onerror = () => reject(request.error ?? new Error("read failed"));
        });
        found.push(...records);
      }
    } finally {
      database.close();
    }
    return found;
  }, databaseName);
}

/**
 * Add an object store this build does not recognise, and put something in it.
 *
 * **This is the assertion that separates deleting the database from deleting a key.**
 * A removal implemented as "delete the one record I know about" passes every
 * unit test written against today's single record, leaves the database in place, and
 * leaves this store sitting in it — so a spec that checks only for the absence of the
 * mailbox would call that implementation correct.
 *
 * The version is bumped because an object store can only be created during an upgrade.
 * The page opens without naming a version, so it never sees this one and is unaffected.
 */
async function plantUnrecognisedStore(page: Page, databaseName: string, fromVersion: number) {
  await page.evaluate(
    async ([name, version]) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name as string, version as number);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("spectre-experiment")) {
            request.result.createObjectStore("spectre-experiment");
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("upgrade open failed"));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("spectre-experiment", "readwrite");
          transaction.objectStore("spectre-experiment").put("not mine", "leftover");
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("plant failed"));
        });
      } finally {
        database.close();
      }
    },
    [databaseName, fromVersion + 1] as const,
  );
}

/** The one database the page created, named by the platform rather than by this suite. */
async function soleDatabaseName(page: Page): Promise<string> {
  const names = await databaseNames(page);
  expect(names).toHaveLength(1);
  return names[0] as string;
}

test.describe("the storage a page actually uses", () => {
  test("the page creates a mailbox, and reaches only the provider it is configured for", async ({
    page,
  }) => {
    const traffic = await openFreshMailbox(page);

    // The address is on screen, which is the observable outcome of the whole boot
    // sequence rather than any one request.
    await expect(page.getByTestId("address")).not.toBeEmpty();

    // **The no-network property, asserted on a run that really made requests.** A
    // suite that asked for nothing would satisfy "nothing was denied" perfectly, so
    // the positive half is asserted first and in the same test: the page genuinely
    // went to the provider, and the provider was the recorded one.
    expect(traffic.served.length).toBeGreaterThan(0);
    for (const url of traffic.served) {
      expect(url.startsWith("https://api.guerrillamail.com/")).toBe(true);
    }
    expect(traffic.denied).toEqual([]);
  });

  test("what the page stored is readable from the platform afterwards", async ({ page }) => {
    await openFreshMailbox(page);

    const name = await soleDatabaseName(page);
    const stored = await readWholeDatabase(page, name);

    // **Read back through IndexedDB directly, not through the adapter that wrote it.**
    // Round-tripping through `SpectreStorage` would be satisfied by a writer and a
    // reader that were wrong in the same direction.
    expect(stored.length).toBeGreaterThan(0);
    expect(JSON.stringify(stored)).toContain("@");
  });

  test("a stored address is offered back only after the provider confirms it", async ({ page }) => {
    await openFreshMailbox(page);
    const storedAddress = await page.getByTestId("address").innerText();

    // Hold the provider's answer open so the ordering can be inspected while it is
    // still undecided, rather than inferred from a race that happened to resolve fast.
    const gate = deferred();
    const traffic = serveRecordedProvider(page, { listingGate: gate.promise });

    await page.reload();

    // **While the provider is still deciding, the address is not on screen.** This is
    // the claim `website-client` makes about a stored mailbox, and it is the one a
    // returning user depends on: an address shown before confirmation is an address
    // that may not exist.
    await expect(page.getByTestId("adopting")).toBeVisible();
    await expect(page.getByTestId("ready")).toHaveCount(0);

    gate.release();

    await expect(page.getByTestId("ready")).toBeVisible();
    await expect(page.getByTestId("address")).toHaveText(storedAddress);

    // **Adopted, not recreated.** A reload that quietly asked for a new address would
    // look identical on screen, and would strand anything already sent to the old one.
    expect(traffic.served.some((url) => url.includes("f=get_email_address"))).toBe(false);
    expect(traffic.served.some((url) => url.includes("f=check_email"))).toBe(true);
    expect(traffic.denied).toEqual([]);
  });

  test("the user can make this browser forget the address, and the device is left holding nothing", async ({
    page,
  }) => {
    await openFreshMailbox(page);
    const name = await soleDatabaseName(page);

    // **Two steps, driven as a user drives them.** Clicking the destructive action
    // directly would skip the very thing the confirmation exists for, and a test that
    // skipped it would pass on an implementation with no confirmation at all.
    await page.getByRole("button", { name: "Clear saved data" }).click();
    await expect(page.getByTestId("local-data-confirmation")).toBeVisible();
    await page.getByRole("button", { name: "Remove it" }).click();

    await expect(page.getByTestId("local-data-removed")).toBeVisible();

    // **The assertion this whole tier exists for.** Not "the page said it worked" —
    // the page said it worked one line earlier. This asks the platform.
    expect(await databaseNames(page)).toEqual([]);
    expect(name).not.toBe("");
  });

  test("a removal leaves nothing behind, including a record this build does not recognise", async ({
    page,
  }) => {
    await openFreshMailbox(page);
    const name = await soleDatabaseName(page);

    // Plant a store this build has no code for, **after** the page has stored its
    // mailbox, so a removal that only deletes the known key would leave it behind.
    await plantUnrecognisedStore(page, name, 1);
    const beforeRemoval = await readWholeDatabase(page, name);
    expect(beforeRemoval.some((record) => JSON.stringify(record) === '"not mine"')).toBe(true);

    await page.getByRole("button", { name: "Clear saved data" }).click();
    await page.getByRole("button", { name: "Remove it" }).click();
    await expect(page.getByTestId("local-data-removed")).toBeVisible();

    // The database itself is gone, so the planted store is not merely unreadable — it
    // is unreachable. A key-scoped removal would leave the database present and this
    // assertion would fail.
    expect(await databaseNames(page)).toEqual([]);

    // **And nothing recreated it.** A removal that deleted the database and then let
    // the page's own save effect write a fresh one would satisfy the assertion above
    // only if it raced; asking twice, once the page has settled, is what makes it mean
    // something.
    await expect(page.getByTestId("ready")).toBeVisible();
    await expect(page.getByTestId("address")).not.toBeEmpty();
    expect(await databaseNames(page)).toEqual([]);
  });

  test("the page still works after the removal, and says a reload will not bring the address back", async ({
    page,
  }) => {
    await openFreshMailbox(page);

    await page.getByRole("button", { name: "Clear saved data" }).click();
    await page.getByRole("button", { name: "Remove it" }).click();
    await expect(page.getByTestId("local-data-removed")).toBeVisible();

    // **The mailbox is untouched.** Removal deletes this device's note of the address,
    // not the address, and a spec that only checked the storage would miss a page that
    // tore down the mailbox along with it.
    await expect(page.getByTestId("address")).not.toBeEmpty();

    // **The consequence is stated, because the address above still works.** The two
    // claims sit next to each other on screen and pulling either one silently would
    // leave the user unable to tell what they did.
    await expect(page.getByTestId("local-data-removed")).toContainText("will not bring");
    await expect(page.getByTestId("local-data-stored")).toHaveCount(0);
  });
});
