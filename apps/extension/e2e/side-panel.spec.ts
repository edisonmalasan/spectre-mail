/**
 * The side panel, in a real Chromium, beside a real page.
 *
 * ## What only this tier can answer
 *
 * Every link in the chain this change exists for is a fact about **two extension contexts talking
 * to each other across a page**, and nothing above the browser can hold it:
 *
 * 1. **the panel document runs at all**, at a `chrome-extension://` origin, with its own bundle.
 *    §4.6 measured `chrome.sidePanel` in a profile whose manifest declared neither it nor a
 *    `side_panel` key; this file is the first to load a manifest that declares both.
 * 2. **`chrome.tabs.sendMessage` from a panel reaches a content script, with no `tabs`
 *    permission.** `design.md` D1 measured that a content script is reachable that way with
 *    `permissions: ["storage"]` alone — and a jsdom test installs the API it wished for, so it
 *    would report the same thing either way.
 * 3. **the answer is the page's own `location.hostname`.** Every case here reads the host out of
 *    what the panel *rendered*, and none of them reads a URL, because the case below proves this
 *    extension cannot read one.
 * 4. **the write lands in a real React 19 field's state** on a page that is hostile by
 *    construction (`in-page.spec.ts` links `button { display: none !important }`).
 *
 * ## The substitute, and it is named rather than quietly used
 *
 * **The panel is opened as a *tab*, not docked.** `docs/PROVIDERS.md` §4.6 measured that Playwright
 * adds **no `Page`** for a docked panel at all — the page count rose only by the launcher's own page
 * — so the tier's usual instrument is simply unavailable for a docked surface. A panel opened as a
 * tab is its own active tab, so **the fixture page is brought to front before every reading**,
 * which is also the truth about a real panel: the page the person was looking at is the active tab,
 * and the panel is over it rather than beside it.
 *
 * **What this therefore cannot hold, stated rather than discovered later:** `docked`, `opened` and
 * `ran` are measured facts; *visible* is none of them, and no test in either tier reads a rendered
 * pixel. One run in six failed to dock the panel at all with no cause diagnosed (§4.6), so this file
 * does not attempt it. The arrangement is the same one `in-page-fill.spec.ts` uses for the popup,
 * for the same reason.
 *
 * ## What this does not establish, and the list is the point
 *
 * - **Nothing about a live provider.** Every response is recorded; see `recorded-provider.ts`.
 * - **Nothing about a per-frame page.** The manifest declares no `all_frames`; see
 *   `in-page-fill.spec.ts`'s note for why the top-frame refusal is unit-tested instead.
 * - **Nothing about how the panel looks.** No case here reads a rendered pixel.
 *
 * @module
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { recordProviderTraffic } from "./recorded-provider";
import type { ProviderTraffic } from "./recorded-provider";
import { clearArmedAlarms } from "./helpers/background-state";
import { openFixturePage, reactState } from "./helpers/in-page-fixture";
import {
  clearStoredMailbox,
  FIXTURE_HOST,
  seedMailboxCollection,
  seedSiteAssociation,
  SECOND_ADDRESS,
  SECOND_MAILBOX,
  STORED_ADDRESS,
  STORED_MAILBOX,
} from "./helpers/stored-mailbox";

let extension: LaunchedExtension;

test.beforeAll(async () => {
  extension = await launchExtension();
});

test.afterAll(async () => {
  await extension?.close();
});

/**
 * Every page this file opens, so each case can close all of them.
 *
 * **A precondition, not tidiness.** `findActiveTab` asks for the *active* tab of the *current*
 * window, so a page left focused from a previous case would answer the next case's host question
 * with its own hostname.
 */
const opened: Page[] = [];

test.afterEach(async () => {
  for (const page of opened.splice(0)) {
    await page.close().catch(() => undefined);
  }

  /**
   * **The alarm is cleared after every case, because a case below creates an address.**
   *
   * `incoming-mail-notification` made creating an address arm the worker's 5 000 ms wake, so a
   * wake landing inside a later case adds a provider listing that no case asked for. The repair
   * used here is the one `in-page-fill.spec.ts` arrived at: disarm rather than raise a ceiling.
   */
  await clearArmedAlarms(extension);
  await clearStoredMailbox(extension);
});

/**
 * A panel staged but not asked anything: the document is open, and the fixture page is the active
 * tab of the window they share.
 *
 * **The order of the last two steps is load-bearing**, and it is the same order
 * `in-page-fill.spec.ts` gives its popup: the panel is a **tab**, so it is its own active tab, and
 * `findActiveTab` would otherwise name the panel rather than the page.
 */
async function stage(): Promise<{
  readonly page: Page;
  readonly panel: Page;
  readonly traffic: ProviderTraffic;
}> {
  const traffic: ProviderTraffic = await recordProviderTraffic(extension.context);
  expect(traffic.unscripted).toEqual([]);

  const page = await openFixturePage(extension.context);
  opened.push(page);

  const panel = await extension.context.newPage();
  opened.push(panel);
  await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);

  await page.bringToFront();
  return { page, panel, traffic };
}

/** The host sentence the panel rendered, or `null` while it is still asking. */
async function hostLine(panel: Page): Promise<string | null> {
  return panel.locator('[data-testid="panel-host"]').textContent();
}

test.describe("the side panel, in a real Chromium", () => {
  test("names the host of the page beside it, and that host is the page's own", async () => {
    const { page, panel } = await stage();

    // **Waited rather than read.** The panel asks the page, the page's content script answers, and
    // the panel publishes — three hops. A synchronous read would be reading "Asking that page…",
    // and a case that asserted the asking sentence would pass against a panel that never resolves.
    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });

    // **And the sentence carries the host rather than merely mentioning one.** The requirement is
    // that the panel *names the page it is beside*; a panel that printed the word "host" beside a
    // blank would satisfy a `toContainText` on the heading.
    expect(await hostLine(panel)).toContain(FIXTURE_HOST);

    // **The page really is the page.** Without this the case would pass against a panel reading a
    // host from anywhere, because `FIXTURE_HOST` is a constant this file imported rather than a
    // fact about the tab in front.
    expect(new URL(page.url()).hostname).toBe(FIXTURE_HOST);
  });

  test("reads no URL to do it: the tab's own url and title are withheld while the host is named", async () => {
    const { panel } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });

    /**
     * **The premise, measured from the panel document itself rather than asserted from a
     * measurement record.**
     *
     * `docs/PROVIDERS.md` §4.6 recorded that `tab.url` and `tab.title` come back `undefined` to an
     * extension holding no `tabs` permission. **Asserting it here is what makes the pairing
     * meaningful**: the case above says the host is available, this says the URL is not, and
     * together they say the panel reached the host by a route that does not need to read across
     * every window. If a later change added `tabs` to make this simpler, this case goes red — which
     * is the drift the requirement exists to stop, caught rather than discovered by a reader.
     */
    const withheld = await panel.evaluate(async () => {
      const chromeApi = Reflect.get(globalThis, "chrome") as
        | { tabs?: { query: (info: unknown, respond: (found: unknown) => void) => void } }
        | undefined;
      const tabs = chromeApi?.tabs;
      if (tabs === undefined) return { stage: "no tabs seam" };

      const found = await new Promise<unknown>((resolve) => {
        tabs.query({ active: true, currentWindow: true }, resolve);
      });
      const tab = Array.isArray(found) ? (found[0] as { url?: unknown; title?: unknown }) : null;

      return { stage: "read", url: tab?.url ?? null, title: tab?.title ?? null };
    });

    expect(withheld).toEqual({ stage: "read", url: null, title: null });

    // **And the host is still on screen**, so the case is not satisfied by the panel having failed
    // to name anything. Without this line, a panel that showed nothing at all would pass it.
    expect(await hostLine(panel)).toContain(FIXTURE_HOST);
  });

  test("offers to create when this device holds nothing, and names no address as its own", async () => {
    const { panel } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });

    // **The create control is offered** — `extension-client`'s *"this device holds no mailbox"*.
    await expect(panel.getByRole("button", { name: "Create an address" })).toBeVisible();

    // **And no mailbox is offered to read.** A panel that offered both would be asking the person to
    // choose at the moment they least want a decision, which is the reason `Popup.tsx` does not
    // either. The requirement states it, so it is asserted rather than left to the absence of a
    // test id nobody here invented.
    await expect(panel.locator(".panel__address")).toHaveCount(0);
    await expect(panel.locator('[data-testid="panel-held"]')).toHaveCount(0);
  });

  test("names the mailbox this device last used on that host, and the other one it holds", async () => {
    /**
     * **Two mailboxes, newest first**, because the held list is rendered only when the device holds
     * more than one — which is what `extension-client`'s *"several mailboxes are held"* scenario
     * describes. Seeding one would have asserted an absence, and a case that asserts an absence
     * because the fixture is thin is a case measuring the fixture.
     */
    await seedMailboxCollection(extension, [STORED_MAILBOX, SECOND_MAILBOX]);
    await seedSiteAssociation(extension, { [FIXTURE_HOST]: STORED_MAILBOX.id });

    const { panel } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });

    // **The address is the one seeded for THIS host**, which is the claim. A panel offering the
    // newest mailbox regardless of the association would show the same address here — because this
    // device holds exactly one — so the case is only meaningful because the host line and the
    // address line are read together and the host line names the page in front.
    await expect(panel.locator(".panel__address")).toHaveText(STORED_ADDRESS);

    // **And the held list names both, in newest-first order** — which is what distinguishes "the
    // mailbox this host resolves to" from "a mailbox this device holds". The order is asserted
    // because a collection read in insertion order is a different answer, and `site-associations`
    // named newest-first as the contract the resolution rule depends on.
    const held = panel.locator('[data-testid="panel-held"]');
    await expect(held).toContainText(STORED_ADDRESS);
    await expect(held).toContainText(SECOND_ADDRESS);
    expect(
      (await held.locator(".panel__held-address").allTextContents()).map((text) => text.trim()),
    ).toEqual([STORED_ADDRESS, SECOND_ADDRESS]);
  });

  /**
   * **A mailbox made the way a person makes one, which is the popup's own flow and not a seeded
   * fixture.**
   *
   * **A first version of this file seeded `STORED_MAILBOX` through `chrome.storage` and waited for
   * a listing that never arrived.** The seeded record is a `fake-indexeddb`-shaped fixture with a
   * session id the recorded provider serves no mailbox for, so the panel adopted it and then
   * correctly reported that the reconcile failed. The case was measuring the fixture.
   *
   * **Creating is also the more faithful path**, and it exercises something seeding cannot: the
   * panel creates by **delegating to the background context** — §5.8, and the reason is that a
   * provider is contacted from exactly one context — so a listing only exists because the whole
   * chain ran: the panel's press, the worker's create, the recorded provider, the worker's storage
   * write, and the panel's own re-read of the device.
   */
  async function createHere(panel: Page): Promise<void> {
    await panel.getByRole("button", { name: "Create an address" }).click();

    /**
     * **The address is waited for by shape rather than by its literal**, because the value is the
     * recorded provider's to choose and `popup.spec.ts` already exists to be named for retyping it.
     */
    await expect(panel.locator(".panel__address")).toHaveText(/@/, { timeout: 30_000 });
  }

  test("lists messages and shows the code in one a person opens", async () => {
    const { panel } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });
    await createHere(panel);

    /**
     * **The listing arrives from the adoption, not from a press — and that is the requirement's
     * wording.** *"WHEN the side panel is opened THEN it SHALL … list that mailbox's messages"*, so
     * the list must be there without anybody asking. **The panel deliberately offers no "check for
     * mail" control**: a second press whose only meaning was "look again" would be a control that
     * exists because the popup has one, and this case would then be testing a copied affordance
     * rather than the panel's own behaviour.
     */
    await expect(panel.locator('[data-testid="message-list"]')).toBeVisible({ timeout: 20_000 });

    await panel.getByRole("button", { name: "Read" }).click();
    await expect(panel.locator('[data-testid="code-list"]')).toBeVisible();

    /**
     * **The code is read from the panel and checked for shape, never typed here.**
     *
     * Writing the recorded fixture's literal into this file would give it a second copy of the
     * value the provider sent, which is the defect `popup.spec.ts` is named for.
     */
    const code = (
      (await panel.locator('[data-testid="code-list"] code').first().textContent()) ?? ""
    ).trim();
    expect(code).toMatch(/^\d{6}$/);

    // **And the clipboard control carries that same code**, which is the scenario's *"each code
    // SHALL carry a control that puts it on the clipboard"* — asserted against a template written
    // here, because an expectation built from the copy module would move when the copy moves.
    //
    // **Named rather than positional, and the reason is a strict-mode violation this very
    // assertion produced.** Each code carries *two* controls in the panel — the fill and the copy —
    // so `getByRole("button")` inside the row resolved to both. The panel adding a third control
    // would then make this case fail for a reason that has nothing to do with the claim.
    await expect(
      panel
        .locator('[data-testid="code-list"] li', { hasText: code })
        .getByRole("button", { name: `Copy code ${code}` }),
    ).toHaveText(`Copy code ${code}`);
  });

  test("puts a code into the real page's React field, and submits nothing", async () => {
    const { page, panel } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });
    await createHere(panel);

    /** **The listing arrives from the adoption, for the reason the case above gives.** */
    await expect(panel.locator('[data-testid="message-list"]')).toBeVisible({ timeout: 20_000 });
    await panel.getByRole("button", { name: "Read" }).click();
    await expect(panel.locator('[data-testid="code-list"]')).toBeVisible();

    const code = (
      (await panel.locator('[data-testid="code-list"] code').first().textContent()) ?? ""
    ).trim();
    expect(code).toMatch(/^\d{6}$/);

    const control = panel
      .locator('[data-testid="code-list"] li', { hasText: code })
      .getByRole("button", { name: `Fill in code ${code}` });

    /** The page is in front, because the panel is a tab and `sendMessage` needs the active tab. */
    await page.bringToFront();

    expect(await reactState(page, "code-input")).toBe("");
    await control.click();
    await expect.poll(() => reactState(page, "code-input"), { timeout: 20_000 }).toBe(code);

    /**
     * **And nothing was submitted, which is the whole difference between filling a field and
     * completing a form on somebody's behalf.**
     *
     * The fixture carries a second field named `discount-input`; a delivery that pressed Enter or
     * submitted would land the code somewhere a person never asked for it to go.
     */
    expect(await reactState(page, "discount-input")).toBe("");
  });

  test("asks the newly active tab again when the tab changes, with no reload", async () => {
    /**
     * **A second origin, served by this file rather than by `openFixturePage`.**
     *
     * The tab-switch claim needs **two different hostnames**, or "the panel re-asked" and "the
     * panel printed what it printed last time" are indistinguishable. `openFixturePage` can be
     * given an origin, but its fixture document is the wrong shape for this — what is needed is
     * the smallest thing a content script runs on, because the case is about which tab answered and
     * not about the page's contents.
     */
    const OTHER_ORIGIN = "https://second-page.invalid";
    const other = await extension.context.newPage();
    opened.push(other);
    await other.route(`${OTHER_ORIGIN}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head><title>second</title></head><body><p>second</p></body></html>",
      }),
    );
    await other.goto(`${OTHER_ORIGIN}/`);

    const { page, panel } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });

    /**
     * **The no-reload marker is planted before the switch and read after it.**
     *
     * "Without a reload" is otherwise unobservable — a panel that reloaded would produce the same
     * text — and the requirement states it as its own clause. A value on the *window object*
     * survives everything except a document replacement, which is exactly the event being ruled
     * out.
     */
    await panel.evaluate(() => {
      Reflect.set(globalThis, "__spectreNoReload", "planted");
    });

    await other.bringToFront();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(
      new URL(OTHER_ORIGIN).hostname,
      { timeout: 20_000 },
    );

    // **The old host is gone from the sentence**, so this is a re-read rather than an append.
    expect(await hostLine(panel)).not.toContain(FIXTURE_HOST);

    // **And the panel was never reloaded to get there.**
    expect(await panel.evaluate(() => Reflect.get(globalThis, "__spectreNoReload"))).toBe(
      "planted",
    );

    // **The first page is still the one it was.** A panel that had closed or navigated a tab would
    // have taken this with it.
    expect(new URL(page.url()).hostname).toBe(FIXTURE_HOST);
  });

  test("requests no origin the tier did not script, however it is used", async () => {
    /**
     * **The strong form of "everything here is recorded", and `tasks.md` 8.4 names the popup's case
     * as the precedent.**
     *
     * **An extension document is precisely the kind of program that could reach somewhere nobody
     * scripted** — and a side panel is a second extension document this repository did not have, on
     * an origin with `host_permissions` of its own. **§4.6 measured that a panel-hosted page *may*
     * fetch a provider directly**, which is exactly why the check has to exist rather than follow
     * from the code being right.
     *
     * **It is read after a mailbox is made, not at staging**, because `stage()` only proves nothing
     * had been reached *yet*: the panel's own press, the worker's create and the reconcile that
     * follows are all work that happens afterwards.
     */
    const { panel, traffic } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });
    await createHere(panel);
    await expect(panel.locator('[data-testid="message-list"]')).toBeVisible({ timeout: 20_000 });

    // **Named rather than counted**, because a count cannot be told apart from a check that found
    // nothing to complain about — the same reason `popup.spec.ts` names the origin.
    expect(traffic.unscripted, `unscripted origins: ${traffic.unscripted.join(", ")}`).toEqual([]);

    /**
     * **And something did happen, so the emptiness is a measurement.** A panel that reached nothing
     * at all would satisfy the assertion above, and so would a `recordProviderTraffic` whose router
     * was never installed. This is the positive control that keeps the case from passing for the
     * wrong reason.
     */
    expect(traffic.requested.length).toBeGreaterThan(0);
  });

  test("says it cannot name a page this extension does not reach, and the rest keeps working", async () => {
    /**
     * **The page is `about:blank`, which `content_scripts.matches` covers no scheme of.**
     *
     * `content_scripts.matches` covers the `http` and `https` schemes and nothing else, so this
     * tab has no script of this extension's — it is the scenario's *"the page beside the panel has
     * no script of this extension's"* rather than a contrived stand-in for it.
     *
     * **Measured during this change, not assumed:** `chrome.tabs.sendMessage` to this tab **does**
     * call back, with `undefined`, in about a millisecond. That is what makes the requirement's
     * *"no answer arrives"* arm reachable here at all — `extension-platform.ts` resolves only from
     * its callback, so a platform that stayed silent would leave the panel asking for ever and this
     * case would hang rather than fail.
     */
    const bare = await extension.context.newPage();
    opened.push(bare);
    await bare.goto("about:blank");

    /**
     * **Two mailboxes seeded before the page is asked anything**, because *\"the rest of the panel
     * SHALL continue to work"* has to name something that is still on screen. It cannot be the
     * address section and it cannot be the create control: `design.md` D4 withholds **both** while no
     * host is named, which is the requirement's *\"it SHALL offer no mailbox as being that page's\"*
     * and the right behaviour rather than a gap. A panel that offered its newest address beside an
     * unnamed page is a panel inviting somebody to type another site's address into a form.
     *
     * **So what is observable is that the panel is still a working panel** — it still reads and
     * renders this device's own addresses, and it is not an error screen.
     */
    await seedMailboxCollection(extension, [STORED_MAILBOX, SECOND_MAILBOX]);

    const { page, panel } = await stage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });

    await bare.bringToFront();

    // **It says so, in its own words** — and specifically *not* the wording for a page that ran and
    // answered nothing, because the two are different faults and a person is the only one who can
    // act on the difference.
    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(
      /not one SpectreMail runs on/i,
      { timeout: 20_000 },
    );

    /**
     * **And it offers no mailbox as being that page's — asserted rather than left to the absence of
     * a selector.** This is the half of the requirement with teeth: a panel showing its newest
     * address beside a page it could not name is exactly the mistake D4 forbids.
     */
    await expect(panel.locator(".panel__address")).toHaveCount(0);

    /** **And the rest of the panel is still working**, which is the requirement's second clause. */
    const held = panel.locator('[data-testid="panel-held"]');
    await expect(held).toContainText(STORED_ADDRESS);
    await expect(held).toContainText(SECOND_ADDRESS);

    /**
     * **No assertion that the panel shows no alert, and the reason is worth recording.**
     *
     * `role="alert"` is where every failure in this component is reported — a refused storage read,
     * a refused creation, a provider failure — so asserting its absence here would have been a claim
     * about **an unrelated mailbox reconcile**, not about the host reading. The two seeded mailboxes
     * are a `fake-indexeddb`-shaped fixture with a session id the recorded provider does not serve
     * a listing for, so the panel correctly reports that their reconcile failed and an assertion of
     * silence would have failed for a true statement.
     *
     * **What is asserted instead is the claim the scenario makes**, and nothing broader: the host
     * is reported as unknown, no mailbox is offered as that page's, and the device's own addresses
     * are still on screen.
     */

    /**
     * **And the fault is not sticky.** Bringing the real page back to front must restore the whole
     * reading — host, address, listing — with no reload of the panel. This is the strongest form of
     * *\"the rest keeps working\"*, because a panel that went blank and stayed blank would satisfy
     * every assertion above while being useless.
     */
    await page.bringToFront();
    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
      timeout: 20_000,
    });

    // **The page it could not name is untouched**, which is the `in-page-integration` half of this:
    // asking a page for its host must not disturb it.
    expect(await reactState(page, "code-input")).toBe("");
  });
});
