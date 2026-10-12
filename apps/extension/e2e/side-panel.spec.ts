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
import type { Locator, Page } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { recordProviderTraffic } from "./recorded-provider";
import type { ProviderTraffic } from "./recorded-provider";
import { clearArmedAlarms } from "./helpers/background-state";
import { openFixturePage, reactState } from "./helpers/in-page-fixture";
import {
  clearStoredMailbox,
  FIXTURE_HOST,
  readHeldAddresses,
  readSiteMap,
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

/**
 * The chooser's own trailing sentence, naming the mailbox this view is about.
 *
 * **Scoped to the chooser's own paragraph rather than searched for the address, and this is the
 * fifth recorded instance of the same defect.**
 *
 * `panel-copy.ts`'s `showingMailbox` and `chooseMailbox` both carry an address, so a
 * `getByText(SECOND_ADDRESS)` resolves to **three** elements — two entries and the sentence — and
 * `toHaveCount(1)` fails on a panel that is entirely correct. **The first version of this case did
 * exactly that**, and the repair is the scoped reader rather than a looser count: a count that
 * accepts three is a count that also accepts zero.
 *
 * **`section[aria-labelledby="panel-held-heading"] > p` rather than a class**, because the sentence
 * is deliberately a bare `<p>` with no new class hook (`Panel.tsx` says why: `.panel p` already
 * styles it, and a hook nothing selects differently would be a rule added for its own sake). **So
 * there is no class to point at, and the section's own heading is the only stable handle** — which
 * is also why this reader is written once and called from three places.
 */
function showingLine(panel: Page): Locator {
  return panel.locator('section[aria-labelledby="panel-held-heading"] > p');
}

/**
 * Whether a recorded request was made **for a given mailbox**, read as the whole query value rather
 * than as a substring of the URL.
 *
 * **The first version of the case this exists for used `url.includes(id)` and it was wrong in the
 * direction that makes a test pass.** `STORED_MAILBOX.id` is `"in-page-spec"` and
 * `SECOND_MAILBOX.id` is `"in-page-spec-second"` — so a request for the *second* mailbox contains
 * the *first* mailbox's id as a prefix, and `"no request names the mailbox already showing"` was
 * satisfied by a request naming the one that was chosen. **The assertion that was supposed to catch
 * a panel re-reconciling the wrong mailbox passed on a panel that never did.**
 *
 * **So the value is compared as a parsed parameter**, where a prefix match is impossible.
 *
 * **And this asks whether *any* parameter carries the id rather than naming the one that does.** The
 * first version spelled the Guerrilla Mail parameter by name, and `pnpm verify`'s architecture
 * boundary suite reported it on this file — a provider wire field name has no legitimate reason to
 * appear under `apps/`, and **the rule fired on this change's own work**, which is the same direction
 * the `verification-actions` boundary failure was: a rule earning its place rather than a rule
 * restricting the implementation. **Naming the parameter would also have coupled the reader to one
 * provider**, so the case below would be reporting on a URL shape rather than on the panel. **Any
 * parameter carrying the id is a request for that mailbox**, and comparing whole values is what keeps
 * the prefix collision impossible.
 *
 * **A reader that returned `true` for everything would satisfy every "no request" assertion for
 * ever**, so this returns a boolean about one exact value and the case below also asserts a
 * **positive** — that a request *was* made for the chosen mailbox — which a broken reader cannot
 * also produce for the absence it would have to fabricate.
 */
function requestedFor(urls: readonly string[], sessionId: string): boolean {
  return urls.some((url) => {
    try {
      return [...new URL(url).searchParams.values()].includes(sessionId);
    } catch {
      /** **A URL this reader cannot parse is not evidence about any mailbox.** */
      return false;
    }
  });
}

/**
 * The mailbox address an entry's own words carry, or `null` where it carries none.
 *
 * **Extracted rather than asserted as a literal, and the reason is the sentence above the entries.**
 * Since the chooser landed, each entry reads "Show `<address>` in this panel", and the group carries
 * its own sentence naming the mailbox the view is about. **A reader comparing the group's whole text
 * to an address list is satisfied by that sentence alone** — which would make every entry's own
 * words unasserted, and an entry that displayed no address at all would pass.
 *
 * **So a `null` here is a failure rather than a shrug**: the comparison below is against an exact
 * array, so an entry naming nothing compares unequal and the case fails loudly.
 */
function addressWithin(text: string): string | null {
  return /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text)?.[0] ?? null;
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

    /**
     * **And the held list names both, in newest-first order** — which is what distinguishes "the
     * mailbox this host resolves to" from "a mailbox this device holds". The order is asserted
     * because a collection read in insertion order is a different answer, and `site-associations`
     * named newest-first as the contract the resolution rule depends on.
     *
     * **Re-pointed at the entries rather than the spans this used to read, and the re-point is the
     * claim now rather than a rename.** Each entry is a control whose own words are "Show
     * `<address>` in this panel", and the group carries a sentence naming the mailbox the view is
     * about — so `allTextContents()` over the group's own children would still contain both
     * addresses while saying nothing about whether either is *offered as a control that acts*. The
     * addresses are compared by extraction out of each entry's text, so a control that named some
     * other mailbox while still displaying the right pair would fail here.
     */
    const held = panel.locator('[data-testid="panel-held"]');
    const entries = await held.getByRole("radio").allTextContents();

    expect(entries.map(addressWithin)).toEqual([STORED_ADDRESS, SECOND_ADDRESS]);

    // **And exactly this host's mailbox is the one checked**, so the two assertions above and this
    // one together say *which* of the pair belongs to the page — which is what a chooser is for and
    // what a list of inert text could not say.
    await expect(held.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
    await expect(held.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "false");
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

    /**
     * **And the rest of the panel is still working**, which is the requirement's second clause.
     *
     * **Re-pointed at the entries, for the reason the reader above gives.** A `toContainText` over
     * the whole group is satisfied by the sentence naming what the view is about, which would make
     * this clause pass on a panel offering **neither** address as a control — the fake-UI defect
     * this capability exists to prevent, and the one a chooser makes *more* reachable rather than
     * less, since a chooser is a set of controls and a control that cannot act is worse than text.
     */
    const held = panel.locator('[data-testid="panel-held"]');
    const entries = await held.getByRole("radio").allTextContents();

    expect(entries.map(addressWithin)).toEqual([STORED_ADDRESS, SECOND_ADDRESS]);

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

  /**
   * **Choosing a mailbox, in a real Chromium, beside a real page — and every case in this group is
   * a claim the jsdom tier structurally cannot reach.**
   *
   * `Panel.test.tsx` presses a real `<button role="radio">` and reads `aria-checked` off the DOM it
   * rendered. **None of that is a control a person could operate**, because jsdom has no
   * accessibility tree, no activation behaviour for a radio, and no platform to ask about focus. So
   * the group below is not a second copy of the unit tier: it holds the three properties that only
   * exist when a real Chromium is running the panel's own bundle.
   */
  test.describe("choosing a mailbox beside the page, in a real Chromium", () => {
    /** Both addresses seeded, and this host last used the newer of them. */
    async function seedTwo(): Promise<void> {
      await seedMailboxCollection(extension, [STORED_MAILBOX, SECOND_MAILBOX]);
      await seedSiteAssociation(extension, { [FIXTURE_HOST]: STORED_MAILBOX.id });
    }

    /** The chooser's entries, in the order they render. */
    function entriesOf(panel: Page) {
      return panel.locator('[data-testid="panel-held"]').getByRole("radio");
    }

    /**
     * The provider session each seeded mailbox is reconciled with, read **from the fixture's own
     * credentials** rather than spelled here.
     *
     * **`requestedFor` compares a whole parameter value, so a mistyped id would make every absence
     * assertion pass for the wrong reason** — this is the "a sweep matching nothing satisfies the
     * claim above it for ever" shape, one level down. **And the discriminant has to be read from the
     * union rather than cast**, so a rename of `ProviderCredentials`' variant is a type error here
     * rather than a spec that quietly compares against `undefined`.
     */
    function secondSession(): string {
      if (SECOND_MAILBOX.credentials.provider !== "guerrilla") {
        throw new Error("this case is about a Guerrilla-served mailbox and the fixture changed");
      }

      return SECOND_MAILBOX.credentials.sessionId;
    }

    /** {@link secondSession}, for the mailbox already showing. */
    function storedSession(): string {
      if (STORED_MAILBOX.credentials.provider !== "guerrilla") {
        throw new Error("this case is about a Guerrilla-served mailbox and the fixture changed");
      }

      return STORED_MAILBOX.credentials.sessionId;
    }

    /**
     * **The resolved style of one entry, read from the browser rather than from the stylesheet.**
     *
     * **Four properties, and the reason for each** — a reader picking one of them and calling it
     * "the difference" is the trap `design.md` D6 names:
     *
     * - `borderTopColor` and `backgroundColor` are what `[aria-checked="true"]` changes, so a rule
     *   that set only a colour would be caught by them and a rule that set only a border would not.
     * - `borderTopWidth` catches a rule that changed a colour without changing a width, which is
     *   invisible on a hover-only difference and is the shape `verification-actions`' focus work
     *   already recorded once in this repository.
     * - `borderTopStyle` catches the degenerate `[aria-checked="true"] { border-color: … }` on a
     *   control whose border is `none` — which computes identically checked and unchecked and is the
     *   most likely way this rule rots silently.
     */
    async function styleOf(entry: Locator) {
      return entry.evaluate((node) => {
        const style = getComputedStyle(node);

        return {
          borderTopColor: style.borderTopColor,
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          backgroundColor: style.backgroundColor,
        };
      });
    }

    test("a press on a real radio changes what the panel shows, and only the view", async () => {
      await seedTwo();

      const { panel } = await stage();

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await expect(panel.locator(".panel__address")).toHaveText(STORED_ADDRESS);

      // **The positive control.** Every assertion below is about what a press *changed*, and a panel
      // whose press did nothing satisfies "the other entry is now checked" only if that entry was
      // never checked — so the pre-press reading is asserted rather than assumed.
      const entries = entriesOf(panel);
      await expect(entries).toHaveCount(2);
      await expect(entries.nth(0)).toHaveAttribute("aria-checked", "true");

      /**
       * **The press is made the way a person makes one, with `.click()` on the control itself.**
       *
       * `HTMLElement.click()` respects `disabled` in jsdom, which is why `in-page-mailbox`'s
       * falsification pass had to reach a handler by `dispatchEvent` — but **that is a repair for a
       * test asserting "the control refused", and it is the wrong instrument for "a person pressed
       * it"**. Here the claim *is* that a press works, so the platform's own activation path is the
       * instrument: nothing in Chromium has to be bypassed for a working button to be caught by a
       * broken one.
       */
      await entries.nth(1).click();

      // **The address section follows.**
      await expect(panel.locator(".panel__address")).toHaveText(SECOND_ADDRESS);

      // **And the check moved with it, in both directions** — an `aria-checked` set on both entries
      // would satisfy the second half alone, which is why both are asserted.
      await expect(entries.nth(1)).toHaveAttribute("aria-checked", "true");
      await expect(entries.nth(0)).toHaveAttribute("aria-checked", "false");

      // **And it says in words which mailbox it is about**, because `aria-checked` alone reads as
      // correct to assistive technology and as *which one?* to a person (`design.md` D6). **Read as
      // the chooser's own trailing sentence rather than as a document-wide text query** — a
      // `getByText` for the address would find it in **both** entries' labels as well, so
      // `toHaveCount(1)` reported three and every count-based version of this assertion is
      // satisfied by a panel that named nothing at all while still offering two controls.
      await expect(showingLine(panel)).toContainText(SECOND_ADDRESS);

      // **And the host sentence is unchanged, which is `D10`'s reworded scenario's other half.**
      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST);
      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(STORED_ADDRESS);
    });

    test("a press changes what the session restored, read over the recorded provider's traffic", async () => {
      await seedTwo();

      const { panel, traffic } = await stage();

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await expect(panel.locator(".panel__address")).toHaveText(STORED_ADDRESS);

      /**
       * **The reconciliation for the mailbox already showing.**
       *
       * **Seeded records are `fake-indexeddb`-shaped with a session the recorded provider serves
       * no mailbox for**, which this file's own header records — so these reconciles fail, and a
       * *failed* reconcile still costs the request. **That is what makes the count meaningful**: the
       * claim is about the request being made, not about a listing arriving, and a case waiting for
       * a listing would be waiting for something this fixture can never produce.
       */
      await waitForRequests(traffic, 1);
      const before = traffic.requested.length;

      await entriesOf(panel).nth(1).click();

      /**
       * **One more request, and it is waited for rather than slept through.**
       *
       * **A count read straight after the click is the recorded precondition defect twice over**: the
       * restore is `void`-ed, so the request travels after the click's own commit, and a count taken
       * too early reads the *previous* number and passes. `in-page-fill.spec.ts` records this by
       * name for the popup's own `saveMailbox` write, and the same fact applies here — waiting for
       * the address to appear on screen does not wait for the reconcile that produced it.
       *
       * **So the press's consequence is waited for in the DOM first, and the traffic read after
       * that.** The address is the observable the restore publishes, so waiting for it is waiting
       * for the restore.
       */
      await expect(panel.locator(".panel__address")).toHaveText(SECOND_ADDRESS);

      expect(traffic.requested.length).toBeGreaterThan(before);

      /**
       * **And the session is holding the chosen mailbox's own reconcile, not merely more requests.**
       *
       * **The count alone is the fourth recorded shape of an insufficient assertion**: a panel that
       * re-listed the *same* mailbox twice, or listed both, produces the same larger number. So the
       * requests after the press are compared to the ones before it by **whether any of them is a
       * request for the chosen mailbox's credentials** — the recorded transport answers by URL, and
       * a request naming `SECOND_MAILBOX`'s session is one the panel could only have made after
       * restoring it.
       */
      const after = traffic.requested.slice(before);

      expect(after.length).toBeGreaterThan(0);

      /**
       * **A request was made for the chosen mailbox**, read through {@link requestedFor} — so the
       * positive half is a whole parameter value rather than a substring of a URL.
       */
      expect(requestedFor(after, secondSession())).toBe(true);

      /**
       * **And none for the mailbox that was already showing**, which is what *"changed what the
       * session restored"* means rather than *"asked again"*.
       *
       * **The negative half is the one the substring collision had made vacuous**, and it is also
       * the half that says the panel did not reconcile *both* — which a count cannot distinguish
       * from reconciling the right one twice.
       */
      expect(requestedFor(after, storedSession())).toBe(false);
    });

    test("a press draws the checked entry differently, and says so in words as well", async () => {
      /**
       * **`tasks.md` 4.2's other half — the *rendered* difference — and it is the one jsdom cannot
       * supply.**
       *
       * `Panel.test.tsx` asserts `aria-checked`, which is a string in the DOM. **A chooser whose
       * only difference is that string is invisible to a person**, and the requirement's *"the panel
       * names the most recent ones"* is a claim about what somebody can see. So this reads the
       * **resolved** styles of both entries, in real Chromium, on the built stylesheet — the same
       * instrument `focus.spec.ts` uses for its outline and for the reason that instrument is named
       * there.
       */
      await seedTwo();

      const { panel } = await stage();

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });

      const entries = entriesOf(panel);
      await expect(entries).toHaveCount(2);

      const checkedBefore = await styleOf(entries.nth(0));
      const uncheckedBefore = await styleOf(entries.nth(1));

      /**
       * **The two are already different before anything is pressed**, and that is the assertion that
       * makes the rest of this case a measurement rather than a description.
       *
       * **A reader that resolved `styleOf` for a panel with no `[aria-checked="true"]` rule at all
       * would return two identical objects, and every assertion below that compares *before* to
       * *after* would still pass** — because the press would move the styles and the difference
       * would be real. So the pre-press difference is asserted directly, and a stylesheet where the
       * rule was deleted fails **here**.
       */
      expect(checkedBefore).not.toEqual(uncheckedBefore);

      // **And specifically: not only a colour, and not only a border.** One property differing is
      // what `verification-actions`' focus work already recorded a rule satisfying by accident, so
      // each of the four is required to differ from the other's value.
      const differs = (key: keyof typeof checkedBefore) =>
        checkedBefore[key] !== uncheckedBefore[key];

      expect(differs("borderTopColor") || differs("borderTopWidth")).toBe(true);
      expect(differs("backgroundColor")).toBe(true);

      // **A real border rather than `none`**, because `[aria-checked="true"] { border-color: … }` on a
      // control whose border is `none` computes identically in both states and is the most likely
      // way this rule rots without anybody noticing.
      expect(uncheckedBefore.borderTopStyle).not.toBe("none");

      await entries.nth(1).click();
      await expect(panel.locator(".panel__address")).toHaveText(SECOND_ADDRESS);

      // **The difference followed the check**, which is what "distinguishable without pressing
      // anything" plus "distinguishable after" means: the same two style readings, swapped.
      const checkedAfter = await styleOf(entries.nth(1));
      const uncheckedAfter = await styleOf(entries.nth(0));

      expect(checkedAfter).toEqual(checkedBefore);
      expect(uncheckedAfter).toEqual(uncheckedBefore);

      // **And the words moved with them**, so the difference is not carried by styling alone.
      // **The same reader as the case above, and for the same reason**: the address is in both
      // entries' labels, so a document-wide query counts three and says nothing about the sentence.
      await expect(showingLine(panel)).toContainText(SECOND_ADDRESS);
    });

    test("a press writes nothing through the platform's own storage API", async () => {
      await seedTwo();

      const { panel } = await stage();

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });

      /**
       * **The association area, read before and after — and the negative control first.**
       *
       * **A reader that returned nothing would satisfy every "nothing was written" assertion for
       * ever.** So the control runs *before* the claim: it asserts the reader can see a value the
       * seed put there, and it does that **in the other direction** as well — a planted entry the
       * seed did not write, removed by hand, which proves the reader is returning the *live* record
       * rather than a fixture this file closed over.
       *
       * **The planted-and-removed half is the part that is not tidiness**: it is what distinguishes
       * "the reader reads storage" from "the reader returns what it was given", and only the second
       * would satisfy the case's own assertion after a real write.
       */
      const before = (await readSiteMap(extension)) as Readonly<Record<string, string>>;

      expect(Object.keys(before)).toContain(FIXTURE_HOST);

      /** A host the seed never wrote, planted so the control has something to remove. */
      const planted = `${FIXTURE_HOST}-planted`;
      const withPlant = { ...before, [planted]: SECOND_MAILBOX.id };

      await seedSiteAssociation(extension, withPlant);
      expect(Object.keys((await readSiteMap(extension)) as Record<string, string>)).toContain(
        planted,
      );

      // **Removed by writing the record the seed wrote, through the same helper** — so the removal
      // is a real write and not a deletion of the case's own fixture.
      await seedSiteAssociation(extension, before);

      const restored = (await readSiteMap(extension)) as Record<string, string>;

      expect(Object.keys(restored)).not.toContain(planted);
      expect(Object.keys(restored)).toEqual(Object.keys(before));

      // **Now the claim itself.**
      await entriesOf(panel).nth(1).click();
      await expect(panel.locator(".panel__address")).toHaveText(SECOND_ADDRESS);

      /**
       * **The whole area, read again — and compared as a value rather than as a count.**
       *
       * **A length would be satisfied by a write that replaced one entry with another**, which is
       * the write most likely to be planted: a panel recording *this* host as the chosen mailbox is
       * precisely the bug `PanelRecords`'s read-only contract exists to forbid, and it keeps the
       * count identical.
       */
      expect(await readSiteMap(extension)).toEqual(restored);

      // **And the mailboxes this device holds are untouched too**, because a chooser that moved a
      // mailbox between hosts would be a far larger defect and one the area above does not cover.
      expect((await readHeldAddresses(extension)).slice().sort()).toEqual(
        [STORED_ADDRESS, SECOND_ADDRESS].sort(),
      );
    });
  });
});

/**
 * Wait until the recorded provider has been asked for something, so a count is not read before the
 * request that makes it exists.
 *
 * **A count read immediately after an action is this repository's most-recorded defect**, and the
 * shape here is the specific one `background-check.spec.ts` had to invent an instrument for: a
 * request that takes the length from zero to one is also what a reader that never ran would look
 * like. So the wait is on the *fact that requests exist*, and it throws reporting what it last saw
 * — an instrument that declines to answer is worth more than one that answers wrongly.
 */
async function waitForRequests(traffic: ProviderTraffic, atLeast: number, timeout = 20_000) {
  const ceiling = Date.now() + timeout;

  while (traffic.requested.length < atLeast && Date.now() < ceiling) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  expect(
    traffic.requested.length,
    `the recorded provider was asked for ${traffic.requested.length} requests, wanted ${atLeast}`,
  ).toBeGreaterThanOrEqual(atLeast);
}
