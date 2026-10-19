/**
 * The mailboxes this device holds, on the page the product ships.
 *
 * ## What is real here and what is not
 *
 * **The device's own IndexedDB, in real Chromium.** Every case here plants mailboxes into the
 * page's storage through `indexedDB` itself — not through the adapter, and not through a module
 * import that would share code with the reader — so "the page offers what the device holds" is
 * answered by the platform rather than by this repository's own bookkeeping.
 *
 * **Provider traffic is still replayed from recordings.** See `recorded-provider.ts`; a red run of
 * this file must mean this repository changed.
 *
 * ## What is deliberately not here, and why
 *
 * **The causal half of "a newer mailbox does not remove an older one" is proved below by planting
 * rather than by creating.** The recorded corpus can produce exactly **one** address for a
 * `f=get_email_address` request, so pressing *Replace address* yields the same mailbox again and
 * cannot produce a genuinely newer one. Asserting the causal path here would require fabricating a
 * provider delivery this repository has never received — so the causal write is proved where it can
 * be honest: `packages/storage`'s *"never lets the two records name different mailboxes"*, and the
 * page-level case in `RecentMailboxes.test.tsx`. **The limit is stated rather than engineered away.**
 *
 * ## Why every stub is installed immediately before a reload, and never before a first load
 *
 * `recorded-provider.ts` installs its own handler inside `openFreshMailbox`, immediately before
 * `goto`, and Playwright checks handlers in the reverse order they were registered — so a stub has
 * to be registered **after** it to win. **The `onDocumentLoaded` hook cannot do that**: the boot's
 * `restore` issues its listing from a React effect, which on the built page runs before the `load`
 * event the hook fires on, and the first version of the two stubbed cases here was green for exactly
 * that reason — the stub was installed after the request it was written to answer had already been
 * served from the recording. Every stubbed case therefore opens a first mailbox, installs its stub,
 * and reloads.
 *
 * ## The two unreachable answers, and why they need two different fixtures
 *
 * **A mailbox the provider no longer recognises needs no stub at all.** The Guerrilla adapter's
 * dead-session check compares the address the listing echoes with the mailbox's own, and the
 * recorded listing echoes one fixed address — so a planted mailbox with any other address is
 * reported `MAILBOX_EXPIRED` by the recorded corpus itself. **A mailbox that could not be checked
 * needs a 500**, because no recorded response is a failure; that one is fulfilled here and nowhere
 * else.
 *
 * @module
 */

import { expect, test, type Page } from "@playwright/test";

import {
  MAILBOX_COLLECTION_KEY,
  MAILBOXES_STORE_NAME,
  SPECTRE_ENVELOPE_VERSION,
  SPECTRE_RECORD_VERSION,
} from "@spectre-mail/storage";

import { openFreshMailbox } from "./open-mailbox";
import { PROVIDER_ORIGIN, serveRecordedProvider } from "./recorded-provider";

/** A mailbox whose address the recorded listing does not echo, so the provider reports it gone. */
const UNREACHABLE = {
  id: "planted-unreachable-sid",
  address: "planted-unreachable@sharklasers.com",
};

/** A newer mailbox, planted at the front so the collection is newest-first behind it. */
const NEWER = {
  id: "planted-newer-sid",
  address: "planted-newer@sharklasers.com",
};

/** An address this device has never held, which the page must therefore never offer. */
const NEVER_HELD = "never-held-on-this-device@sharklasers.com";

/**
 * The mailbox the page itself created and stored, read back from the device.
 *
 * ## Why it is read rather than written here
 *
 * The recorded corpus's address and session token are **module-private** in `fixtures.ts`, and the
 * honest alternative to a private constant is not a duplicated literal — it is asking the device
 * what it holds. So every case that needs "the mailbox this page already has" reads it through
 * `indexedDB`, and the id it carries is the real one, which is what makes the `recent-*` testids
 * below nameable at all.
 */
async function readStoredMailbox(page: Page): Promise<{ id: string; address: string }> {
  return page.evaluate(
    async ([storeKey, key]) => {
      const names = (await indexedDB.databases()).map((entry) => entry.name);
      const name = names.find((candidate): candidate is string => !!candidate);
      if (name === undefined) throw new Error("the page has created no database");

      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name as string);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("open failed"));
      });

      try {
        const transaction = database.transaction(storeKey as string, "readonly");
        const envelope = await new Promise<{
          mailboxes?: { mailbox?: { id: string; address: string } }[];
        }>((resolve) => {
          const request = transaction.objectStore(storeKey as string).get(key as string);
          request.onsuccess = () =>
            resolve(
              request.result as { mailboxes?: { mailbox?: { id: string; address: string } }[] },
            );
          request.onerror = () => resolve({});
        });
        const head = envelope.mailboxes?.[0]?.mailbox;
        if (head === undefined) throw new Error("no stored mailbox to read");
        return { id: head.id, address: head.address };
      } finally {
        database.close();
      }
    },
    [MAILBOXES_STORE_NAME, MAILBOX_COLLECTION_KEY] as const,
  );
}

/**
 * Plant `mailboxes` into the page's own storage, at the front or the back of the collection.
 *
 * ## Why the platform's own API and not the adapter
 *
 * The adapter would share its own narrowing code with the thing under test, so a mistake in that
 * narrowing would be invisible from both ends. Reading and writing through `indexedDB` directly
 * means the collection this case plants and the collection the page reads are two different
 * paths to the same bytes.
 *
 * **The database is named by the platform, not here**, for the same reason `storage.spec.ts` does it
 * that way: the suite never learns what the page calls its database, so it cannot drift from the
 * answer.
 */
async function plantMailboxes(
  page: Page,
  mailboxes: readonly { id: string; address: string }[],
  where: "front" | "back",
): Promise<void> {
  await page.evaluate(
    async ([entries, position, storeKey, key, envelopeVersion, recordVersion]) => {
      const names = (await indexedDB.databases()).map((entry) => entry.name);
      const name = names.find((candidate): candidate is string => !!candidate);
      if (name === undefined) throw new Error("the page has created no database");

      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name as string);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("open failed"));
      });

      try {
        const transaction = database.transaction(storeKey as string, "readwrite");
        const store = transaction.objectStore(storeKey as string);

        /** What the page already wrote, read from the record as stored rather than narrowed. */
        const existing = await new Promise<unknown>((resolve) => {
          const request = store.get(key as string);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(undefined);
        });

        const held =
          typeof existing === "object" &&
          existing !== null &&
          Array.isArray((existing as { mailboxes?: unknown }).mailboxes)
            ? ((existing as { mailboxes: unknown[] }).mailboxes as unknown[])
            : [];

        const planted = (entries as { id: string; address: string }[]).map((mailbox) => ({
          version: recordVersion as number,
          mailbox: {
            id: mailbox.id,
            provider: "guerrilla",
            address: mailbox.address,
            createdAt: 1759000000000,
            status: "active",
            credentials: { provider: "guerrilla", sessionId: mailbox.id },
          },
        }));

        store.put(
          {
            version: envelopeVersion as number,
            mailboxes: position === "front" ? [...planted, ...held] : [...held, ...planted],
          },
          key as string,
        );

        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("plant failed"));
          transaction.onabort = () => reject(transaction.error ?? new Error("plant aborted"));
        });
      } finally {
        database.close();
      }
    },
    [
      mailboxes,
      where,
      MAILBOXES_STORE_NAME,
      MAILBOX_COLLECTION_KEY,
      SPECTRE_ENVELOPE_VERSION,
      SPECTRE_RECORD_VERSION,
    ] as const,
  );
}

/**
 * Answer `f=check_email` with a status the recorded corpus has none of.
 *
 * **Registered after `recorded-provider`'s own handler and handed off with `fallback`**, which is
 * the only correct spelling: `continue()` would send the request to the network and `fulfill` on a
 * handler that also serves the create would break the rest of the file. `fallback` returns the
 * request to the next handler, so one case's 500 does not become every case's 500.
 */
function failEveryListing(page: Page): void {
  page.route(`${PROVIDER_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("f") !== "check_email") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":500}' });
  });
}

/** Answer `f=get_email_address` with a 500, so an address the user asked for could not be made. */
function failEveryCreate(page: Page): void {
  page.route(`${PROVIDER_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("f") !== "get_email_address") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":500}' });
  });
}

/** Every address the offer is showing, in the order it is showing them. */
async function offeredAddresses(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="recent-return-"], [data-testid^="recent-current-"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.closest("li")?.querySelector("code")?.textContent ?? "")
        .filter((text) => text.length > 0),
    );
}

test.describe("the mailboxes this device holds", () => {
  test("every mailbox on the device is on the built page, newest first, inside the product region", async ({
    page,
  }) => {
    await openFreshMailbox(page);
    const reachable = await readStoredMailbox(page);
    await plantMailboxes(page, [UNREACHABLE], "back");

    const traffic = serveRecordedProvider(page);
    await page.reload();
    await expect(page.getByTestId("ready")).toBeVisible();

    // **Read from the offer itself, in the order the offer renders it.**
    expect(await offeredAddresses(page)).toEqual([reachable.address, UNREACHABLE.address]);

    // **The placement claim**, read from the DOM rather than from `PAGE_ORDER`.
    const product = page.locator('[data-region="product"]');
    await expect(product.getByTestId("recent-held")).toBeVisible();
    expect(await page.locator("[data-region]").count()).toBe(5);

    // **The negative direction**, because a case that only asserts a planted mailbox is offered
    // would be satisfied by a page that offers whatever it was told.
    expect(await offeredAddresses(page)).not.toContain(NEVER_HELD);
    await expect(page.getByText(NEVER_HELD)).toHaveCount(0);

    expect(traffic.denied).toEqual([]);
  });

  test("choosing one brings it up, and no address is created to do so", async ({ page }) => {
    await openFreshMailbox(page);
    await plantMailboxes(page, [UNREACHABLE], "back");

    const traffic = serveRecordedProvider(page);
    await page.reload();
    await expect(page.getByTestId("ready")).toBeVisible();

    // **The planted mailbox's own control**, chosen by its address rather than by position, so a
    // reordered list would not silently pass this case by aiming at a different row.
    await page
      .locator("li", { hasText: UNREACHABLE.address })
      .getByRole("button", { name: "Use this address" })
      .click();

    // **The page brought it up, and the provider says it is gone** - which is the honest outcome
    // for a mailbox the recorded corpus cannot serve, and is a *return*, not a creation.
    await expect(page.getByTestId("expired-address")).toContainText(UNREACHABLE.address);
    await expect(page.getByTestId(`recent-current-${UNREACHABLE.id}`)).toBeVisible();

    // **And the claim the requirement makes: no mailbox was created.** A create would look
    // identical on screen apart from the address, so it is counted rather than read.
    expect(traffic.served.some((url) => url.includes("f=get_email_address"))).toBe(false);
    expect(traffic.denied).toEqual([]);
  });

  test("a mailbox the provider will not serve is said differently from one it could not check", async ({
    page,
  }) => {
    // **The `gone` arm needs no stub at all**: the recorded listing echoes one address, so a
    // mailbox with another is reported expired by the recorded corpus itself.
    await openFreshMailbox(page);
    await plantMailboxes(page, [UNREACHABLE], "front");

    serveRecordedProvider(page);
    await page.reload();

    await expect(page.getByTestId(`recent-gone-${UNREACHABLE.id}`)).toBeVisible();
    await expect(page.getByTestId(`recent-unchecked-${UNREACHABLE.id}`)).toHaveCount(0);
    await expect(page.getByTestId("expired-explanation")).toBeVisible();
  });

  test("a mailbox whose session could not be checked is said differently from one that is gone", async ({
    page,
  }) => {
    // **A first visit to make a device holding one address, then the stub, then a reload** — see
    // this file's note on why no stub can be installed before a first load.
    await openFreshMailbox(page);
    const reachable = await readStoredMailbox(page);

    serveRecordedProvider(page);
    failEveryListing(page);
    await page.reload();

    // **The mailbox is the one the recorded listing *can* serve**, so nothing about the fixture
    // changed except the status - which is what makes the difference on screen attributable to
    // the provider's answer rather than to the address.
    await expect(page.getByTestId(`recent-unchecked-${reachable.id}`)).toBeVisible();
    await expect(page.getByTestId(`recent-gone-${reachable.id}`)).toHaveCount(0);
    await expect(page.getByTestId("restore-failed-explanation")).toBeVisible();
  });

  test("a newer mailbox does not remove an older one from the page", async ({ page }) => {
    await openFreshMailbox(page);
    const reachable = await readStoredMailbox(page);
    // **At the front, and in this order**, so the collection is newest-first with the two older
    // addresses behind the one the page adopted.
    await plantMailboxes(page, [NEWER, UNREACHABLE], "front");

    serveRecordedProvider(page);
    await page.reload();

    // **The head is the newer one, so the page cannot reach `ready`** - and that is the point:
    // the older two are still on the page while the page is in a state with no working address.
    await expect(page.getByTestId(`recent-gone-${NEWER.id}`)).toBeVisible();
    expect(await offeredAddresses(page)).toEqual([
      NEWER.address,
      UNREACHABLE.address,
      reachable.address,
    ]);
  });

  test("the offer is still there when an address the user asked for could not be created", async ({
    page,
  }) => {
    await openFreshMailbox(page);
    await plantMailboxes(page, [UNREACHABLE], "back");
    serveRecordedProvider(page);
    await page.reload();
    await expect(page.getByTestId("ready")).toBeVisible();

    // **The replacement fails, so the page has no working address at all** - and the addresses it
    // holds are still on screen. That is the requirement's scenario, and it is reachable: the
    // creation failure is the one the *user* asks for, not the one on the boot, because a boot
    // that failed to create is a boot that found nothing stored.
    await failEveryCreate(page);
    await page.getByRole("button", { name: "Replace address" }).click();

    await expect(page.getByRole("heading", { name: /no address yet/i })).toBeVisible();
    await expect(page.getByTestId("recent-held")).toBeVisible();
    expect(await offeredAddresses(page)).toContain(UNREACHABLE.address);
  });

  test("the address the provider reported gone carries no control that claims it works", async ({
    page,
  }) => {
    // **The `gone` arm needs no stub**: the recorded listing echoes one address, so a mailbox
    // with another is reported expired by the recorded corpus itself.
    await openFreshMailbox(page);
    await plantMailboxes(page, [UNREACHABLE], "front");

    serveRecordedProvider(page);
    await page.reload();

    await expect(page.getByTestId(`recent-gone-${UNREACHABLE.id}`)).toBeVisible();

    /**
     * **No control on that entry, and that is the requirement's clause read on the built page.**
     *
     * The delta says a mailbox this device can no longer reach "SHALL NOT be offered as though it
     * worked". **The falsification pass found that the control's second label is unreachable on
     * the built page** - the page only ever asks the provider about the mailbox it holds, so the
     * only mailbox it can mark is the one it is on, and that entry carries no control at all. So
     * the mechanism actually in force is the absence of a control, and this is the case that says
     * so, on the page a person receives.
     *
     * **The retry lives in the page's own "your saved address is gone" region**, so a second
     * control here would be one the page can neither justify nor need.
     */
    const row = page.locator("li", { hasText: UNREACHABLE.address });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("button")).toHaveCount(0);
  });

  test("a mailbox this device stopped holding is no longer offered", async ({ page }) => {
    await openFreshMailbox(page);
    await plantMailboxes(page, [UNREACHABLE], "back");
    serveRecordedProvider(page);
    await page.reload();
    await expect(page.getByTestId(`recent-return-${UNREACHABLE.id}`)).toBeVisible();

    // **The device stops holding it, and the offer stops offering it.** A list assembled from
    // anything other than this device's own records would keep it, which is what makes the cases
    // above evidence about storage rather than about markup.
    await page.getByRole("button", { name: "Clear saved data" }).click();
    await page.getByRole("button", { name: "Remove it" }).click();
    await expect(page.getByTestId("local-data-removed")).toBeVisible();

    await expect(page.getByTestId(`recent-return-${UNREACHABLE.id}`)).toHaveCount(0);
    await expect(page.getByText(UNREACHABLE.address)).toHaveCount(0);
  });
});
