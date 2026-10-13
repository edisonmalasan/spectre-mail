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

import { INBOX_POLL_CEILING_MS, INBOX_POLL_PROMPT_MS } from "../../../packages/mailbox/src/cadence";
import { PANEL_COPY, PANEL_VERDICT_WORDING } from "../src/panel-copy";
import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import {
  FIXTURE_IDS,
  GUERRILLA_LIST_OPERATION,
  GUERRILLA_OPERATION_PARAMETER,
  GUERRILLA_READ_ANSWERS,
  GUERRILLA_READ_OPERATION,
  recordProviderTraffic,
} from "./recorded-provider";
import type { ProviderTraffic } from "./recorded-provider";
import { clearArmedAlarms, waitForTheArmingThenDisarm } from "./helpers/background-state";
import { openFixturePage, reactState } from "./helpers/in-page-fixture";
import {
  clearStoredMailbox,
  FIXTURE_HOST,
  plantUnrecognisedRecord,
  readHeldAddresses,
  readSiteMap,
  readWholeArea,
  seedMailboxCollection,
  seedSiteAssociation,
  SECOND_ADDRESS,
  SECOND_MAILBOX,
  STORED_ADDRESS,
  STORED_MAILBOX,
  UNRECOGNISED_RECORD_KEY,
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
 * How long the panel's **own** host reading may take to appear at staging time.
 *
 * **Derived from nothing, and measured rather than reasoned** — see {@link establishTheHostReading}.
 * At staging time the page is already the active tab, so this ask is a content script round trip and
 * nothing more: **35, 51, 15, 12, 11, 12, 13 and 17 ms** over eight stagings. Five seconds is
 * roughly a hundred times the slowest of those, which is the margin a *sampling rate* buys rather
 * than a tolerance being granted.
 */
const HOST_RESOLUTION_CEILING_MS = 5_000;

/**
 * How long a **deliberate** tab switch may take to become observable in the panel document.
 *
 * **This is not the same kind of number as the one above, and the difference is the whole finding.**
 * `chrome.tabs.onActivated` reaches the panel document on Chromium's own schedule, and the
 * measurement recorded below put that schedule anywhere between **86 ms and 19 898 ms** on one
 * machine. So a switch gets its own ceiling, its own reader, and its own precondition — and the
 * assertions after it are then written with **no timeout pressure at all**.
 */
const TAB_SWITCH_CEILING_MS = 40_000;

/**
 * The host sentence the panel has rendered so far, or `null` while it is still asking.
 *
 * **Two separate nulls are folded into one `null` here on purpose, and the fold is what makes this
 * a precondition rather than a poll.** `hostLine` below is the reader the *assertions* use: it
 * resolves the element, so on a panel still asking it throws rather than answering. This one answers
 * instead, because the state {@link establishTheHostReading} exists to detect is precisely "there is
 * nothing to read yet", and a reader that threw there could not tell a panel still asking from a
 * panel that had gone wrong. **The wrong reading, once rendered, is not this helper's business** —
 * naming it is the assertion's, and the fixture host is the only thing `stage` could possibly
 * resolve to.
 */
async function currentHostLine(panel: Page): Promise<string | null> {
  const host = panel.locator('[data-testid="panel-host"]');
  if ((await host.count()) === 0) return null;
  return host.textContent({ timeout: 500 }).catch(() => null);
}

/**
 * The staging **precondition**: the panel has resolved a host, so every case below starts from a
 * question that has an answer rather than from a race.
 *
 * ## Why this exists, and why it is a repair rather than a larger number
 *
 * **CI run `38306040431` failed this file's 20th case** — *"leaves the row bare when the message was
 * read and carried nothing"* — with the panel rendering `PANEL_COPY.noScriptHere` where
 * `in-page.invalid` was expected. **No threshold was raised, and none should be**: the cause was
 * measured, and it was not a slow assertion.
 *
 * **The panel re-asks its host on every `chrome.tabs.onActivated`.** The old staging order opened the
 * panel document first and brought the fixture page to front second, so the *only* host reading 82
 * cases ever had was the one that depends on that event arriving. **Measured, on the panel's own
 * `performance.now()` clock with the listener installed in the panel's own world:**
 *
 * ```text
 * resolved after bringToFront   onActivated delivered   sendMessage round trip
 *                        89ms                      86ms                       10ms
 *                        194ms                     167ms                      31ms
 *                       5365ms                    3907ms                       2ms
 *                      10238ms                   10234ms                       6ms
 *                      19832ms                   19898ms                       4ms
 * ```
 *
 * **The event's delivery is the variable, and the round trip is not.** The last row is the CI
 * failure reproduced on this machine: a `sendMessage` answered correctly in **4 ms**, behind a
 * `chrome.tabs.onActivated` that took **19 898 ms** to arrive — against a 20 000 ms assertion
 * timeout. **So the same product was correct throughout, and a case was reading it through a
 * latency it does not control.**
 *
 * ## The repair is the order, not the ceiling
 *
 * {@link stage} now makes the fixture page the active tab **after the panel's tab exists and before
 * its document loads**, so the reading every case depends on is the panel's **mount-time** ask, which
 * is a direct `sendMessage` to a tab already known to be active. **No `chrome.tabs.onActivated` is
 * involved in staging at all**, which is the point: the event whose delivery was measured between
 * 86 ms and 19 898 ms is simply not on the path any more.
 *
 * **Both halves of that order are load-bearing, and the first attempt at this repair had only the
 * wrong half.** Putting `bringToFront` *before* `context.newPage` is undone by it — `newPage` creates
 * a tab, that tab becomes active, the panel mounts with itself active, and `sendMessage` reaches a
 * `chrome-extension://` document with no content script in it. Because the fixture page had been
 * activated *before* the panel existed, no `onActivated` followed to correct the reading either, and
 * the file failed **11 of 20 cases** on `noScriptHere`, each stuck on it across every poll of its
 * timeout. **Recorded because it is the same trap twice**: the first version of this file's staging
 * got the order right and paid for it in latency, the repair got the latency right and paid for it
 * in correctness, and only one of those is visible from reading the code.
 *
 * ## What this repair is NOT evidence of, stated before anyone reads it as such
 *
 * **The pre-repair file was run ten consecutive times on this machine and passed 10/10 at 20 cases.**
 * **The file-level failure did not reproduce here**, and a repair that fixes a defect nobody can
 * reproduce is a repair whose benefit rests entirely on the measurement above rather than on a
 * before/after tally. That is not nothing — the delivery-latency spread **was** observed on this
 * machine, and one arm of it (19 898 ms) did cross the 20 000 ms boundary the assertions carried —
 * but **it was observed under a diagnostic instrument** (twelve stagings inside one test, polling
 * every 50 ms), not under the ordinary run of this file, and a reader is entitled to know that.
 *
 * **So the honest statement is about the dependency, not about a fix rate:** before this change,
 * **every case in this file had a correctness precondition whose completion time Chromium does not
 * bound**, and this removes it. That is a property of the suite that holds regardless of how often
 * the bad outcome happens to land, and it is the same shape of repair as
 * `waitForTheArmingThenDisarm` — where the recorded lesson was also that the red rate was low
 * locally and the fix was to the dependency rather than to the rate.
 *
 * ## Both preconditions were falsified, and one of them first refused to be
 *
 * **And the reorder introduces no new condition, which was checked rather than assumed:** every
 * `bringToFront` in this file names a **fixture** page — `other`, `bare`, `page`, or a popup switch —
 * and none names `panel`, so nothing that used to be true of a staged panel stops being true. **Of
 * this file's 20 cases, 16 depend on the mount-time reading and the other 4 switch on purpose** —
 * those four are given their own precondition in {@link watchTabActivations} rather than being
 * staged around.
 *
 * **`establishTheHostReading` fails when the reading is absent**, and names what it saw: pointing
 * `currentHostLine` at a `data-testid` the panel never renders turns every case red with *"the panel
 * named no host within 5000ms of the fixture page becoming the active tab, and its last reading was
 * null"*. So the precondition is not a `count()` that cannot fail.
 *
 * **Collapsing {@link HOST_RESOLUTION_CEILING_MS} to `1` did NOT turn it red, and that is the more
 * useful measurement.** The repaired order means the panel's reading is already on screen by the time
 * `panel.goto` resolves, so the precondition is satisfied on its **first read** and the ceiling is
 * never reached. **The ceiling is not what removed the race — the order did** — and a mutation that
 * "proves" the ceiling load-bearing would have been reported here as a catch when it measured nothing
 * but a fast machine. The ceiling stays because a precondition without a deadline is a hang, not
 * because anything was measured to need one.
 *
 * **`watchTabActivations` fails when the listener is installed after the switch** — the deliberate
 * switch it guards was already delivered, the counter read `0` at every poll, and the case went red
 * naming the count. That is the falsification that matters for it: it proves the waiter observes an
 * event that happens **in the order the case creates it**, rather than a counter that was going to be
 * non-zero anyway.
 *
 * @throws If the panel names no host within {@link HOST_RESOLUTION_CEILING_MS}, naming what it saw.
 *   **Reported rather than swallowed**, because "the round trip was slow" and "the content script
 *   never answered" need opposite repairs and look identical to a silent reader.
 */
async function establishTheHostReading(panel: Page): Promise<void> {
  const deadline = Date.now() + HOST_RESOLUTION_CEILING_MS;
  let last: string | null = null;

  // **The interval is a sampling rate, not a tolerance.** Nothing is allowed to fail because of it;
  // what decides the outcome is `deadline`.
  for (;;) {
    last = await currentHostLine(panel);
    if (last !== null) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `the panel named no host within ${HOST_RESOLUTION_CEILING_MS}ms of the fixture page becoming ` +
          `the active tab, and its last reading was ${JSON.stringify(last)} - so either the mount ask ` +
          `never reached the content script or the panel never rendered a reading at all`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * The precondition for a case that **deliberately** switches tabs: a waiter that resolves once the
 * panel document has itself observed a `chrome.tabs.onActivated`.
 *
 * ## Why the switch sites need their own reader
 *
 * Reordering {@link stage} removes the mount-time race, and it deliberately does not remove the
 * behaviour the requirement is about: **the panel re-asks on a tab switch, without a reload.** Four
 * cases here exist to hold exactly that, so they cannot be staged their way out of needing it.
 *
 * **Those cases used to wait for it with a 20 000 ms assertion timeout, and that timeout was the
 * defect**: the measurement above puts this event's delivery between 86 ms and 19 898 ms on one
 * machine, so a 20 s budget on it is a coin toss dressed as a bound. **The repair inverts the
 * wait** — observe the activation in the panel's *own* world, with its own deadline, and then
 * assert with no timeout pressure at all. **The assertion becomes instantaneous because the
 * precondition has already established the event happened.**
 *
 * ## Read reflectively, for the reason `background-state.ts` gives
 *
 * There is no `@types/chrome` in this package, so `chrome` is reached through a cast rather than
 * written bare. **This is the same idiom the same file uses, and for the same reason** — and the
 * browser tier is exempted from the boundary rule confining the platform global by the `testDir`
 * allowance that rule already reads out of this suite's own config.
 *
 * @returns A waiter to `await` **after** the `bringToFront`, not before.
 * @throws If no activation is observed within {@link TAB_SWITCH_CEILING_MS}, naming the count it saw.
 */
async function watchTabActivations(panel: Page): Promise<() => Promise<void>> {
  await panel.evaluate(() => {
    const world = globalThis as unknown as {
      chrome: { tabs: { onActivated: { addListener: (listener: () => void) => void } } };
    };
    Reflect.set(globalThis, "__spectreSeenActivations", 0);
    world.chrome.tabs.onActivated.addListener(() => {
      const seen = Reflect.get(globalThis, "__spectreSeenActivations");
      Reflect.set(globalThis, "__spectreSeenActivations", Number(seen) + 1);
    });
  });

  return async () => {
    const deadline = Date.now() + TAB_SWITCH_CEILING_MS;
    let seen = 0;

    for (;;) {
      seen = await panel.evaluate(() =>
        Number(Reflect.get(globalThis, "__spectreSeenActivations")),
      );
      if (seen > 0) return;
      if (Date.now() >= deadline) {
        throw new Error(
          `the panel document observed no chrome.tabs.onActivated within ${TAB_SWITCH_CEILING_MS}ms of ` +
            `the switch and counted ${seen}, so the assertions after this point would have been waiting ` +
            `on an event this browser had not delivered`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
}

/**
 * A panel staged but not asked anything: the document is open, and the fixture page is the active
 * tab of the window they share.
 *
 * **The order of the last three steps is load-bearing, and it is the repair
 * {@link establishTheHostReading} documents.** The panel's tab is created first, the fixture page is
 * then made the active tab of the window they share, and only then does the panel document load — so
 * its mount ask names the page rather than itself. `in-page-fill.spec.ts`'s popup ordering is the
 * same rule about a different surface, and its failure mode is the same one: staging it the other
 * way round leaves every case depending on the delivery of `chrome.tabs.onActivated`, the one event
 * measured between 86 ms and 19 898 ms.
 *
 * **`options` is the only thing the marking cases below change, and it is passed to the recorder
 * rather than applied afterwards.** Every case that passes nothing is staged exactly as it was
 * before this change: the seam in `recorded-provider.ts` is a no-op unless a spec opts in, which is
 * the property that keeps the other 82 cases a measurement rather than a hope.
 */
async function stage(options: Parameters<typeof recordProviderTraffic>[1] = {}): Promise<{
  readonly page: Page;
  readonly panel: Page;
  readonly traffic: ProviderTraffic;
}> {
  const traffic: ProviderTraffic = await recordProviderTraffic(extension.context, options);
  expect(traffic.unscripted).toEqual([]);

  const page = await openFixturePage(extension.context);
  opened.push(page);

  const panel = await extension.context.newPage();
  opened.push(panel);

  /**
   * **The fixture page is made the active tab BEFORE the panel document loads, and after the panel's
   * tab exists. Both halves are load-bearing, and the first version of this repair got the first one
   * wrong.**
   *
   * **Wrong: `bringToFront` before `newPage`.** `context.newPage` creates a tab and that tab becomes
   * active, so a `bringToFront` issued before it is undone by it. The panel then mounts with *itself*
   * as the active tab, `sendMessage` reaches a `chrome-extension://` document, no content script is
   * there, and the panel renders `noScriptHere` — and because the fixture page was activated *before*
   * the panel existed, **no `chrome.tabs.onActivated` ever follows to correct it.** Measured: the
   * first case failed with the panel stuck on `noScriptHere` across all 43 polls of its 20 s timeout,
   * and 11 of 20 cases failed the same way.
   *
   * **Right: `newPage`, then `bringToFront`, then `goto`.** The panel's tab exists and is background;
   * the fixture page is the active tab; and a background tab's document still loads and runs, so the
   * panel's **mount ask** fires with the page already active. No `chrome.tabs.onActivated` is involved
   * at all, which is the whole point.
   */
  await page.bringToFront();

  await panel.goto(`chrome-extension://${extension.extensionId}/sidepanel.html`);

  await establishTheHostReading(panel);

  return { page, panel, traffic };
}

/**
 * Close one staging's pages and take them out of the list `afterEach` closes.
 *
 * **Only for a case that runs two stagings in sequence.** `opened` is closed after every case, so a
 * second `stage()` inside one case would otherwise leave the first panel answering the fixture page's
 * `chrome.tabs.sendMessage` - **and both recordings' `context.route` handlers stay installed for the
 * whole profile either way**, which is why the caller clears the device as well as closing the pages.
 */
async function closeStaged({ page, panel }: { readonly page: Page; readonly panel: Page }) {
  for (const target of [panel, page]) {
    const at = opened.indexOf(target);

    if (at >= 0) opened.splice(at, 1);
    await target.close().catch(() => undefined);
  }
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

/**
 * The chooser's entries, in the order they render.
 *
 * **Declared beside the file's other readers rather than inside the describe that first needed it.**
 * The verdict-wording group below presses one of these too, and a second copy of the selector would
 * be a second thing to keep in step - the defect `in-page-fill.spec.ts`'s `open-mailbox.ts` was
 * extracted to stop, and a selector is no different from a helper.
 */
function entriesOf(panel: Page): Locator {
  return panel.locator('[data-testid="panel-held"]').getByRole("radio");
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

    /**
     * **The activation is waited for in the panel's own world before it is asserted, and the
     * assertion then carries no timeout at all.** This case is one of the four that genuinely needs
     * `onActivated` — reordering `stage` removes the mount-time race and deliberately leaves this
     * behaviour alone. The 20 000 ms it used to wait here was the defect, not the bound: the event's
     * delivery was measured between 86 ms and 19 898 ms on one machine, so the precondition below is
     * what makes the following assertion instantaneous rather than lucky.
     */
    const activationOfTheOtherHost = await watchTabActivations(panel);
    await other.bringToFront();
    await activationOfTheOtherHost();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(
      new URL(OTHER_ORIGIN).hostname,
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

    /** **Its own activation precondition, for the reason the first switch site's gives.** */
    const activationOfTheBareHost = await watchTabActivations(panel);
    await bare.bringToFront();
    await activationOfTheBareHost();

    // **It says so, in its own words** — and specifically *not* the wording for a page that ran and
    // answered nothing, because the two are different faults and a person is the only one who can
    // act on the difference.
    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(
      /not one SpectreMail runs on/i,
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
    /**
     * **A second activation precondition rather than a second timeout**, because this is the same
     * event as the switch above and it delivers on the same schedule — measured on this machine
     * between 86 ms and 19 898 ms. The watcher is installed **after** the first switch was already
     * observed, so it counts from this second one and cannot be satisfied by it.
     */
    const activationOfTheRealPage = await watchTabActivations(panel);
    await page.bringToFront();
    await activationOfTheRealPage();

    await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST);

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

  /**
   * ## What the panel states about a message nobody opened
   *
   * **`MessageList` is one component serving both extension surfaces, and it now renders a marking on
   * a row when - and only when - its caller supplies the words to render it in.** So every claim in
   * this group is a claim about **which surface asked**, and none of them is about a verdict the
   * session failed to reach: `Panel.test.tsx` holds the verdicts-to-marking map in jsdom, and
   * `packages/mailbox`'s own suite holds `verdictFor`. What is here is what only a built bundle can
   * say - that the panel's own bundle asked, that the popup's did not, and that the words on the row
   * are the ones the panel's copy module declares.
   *
   * **Every case in this group carries the same three instruments, and none of them is optional.**
   *
   * 1. **A positive control**, because the negative assertions below are about an *absence* and an
   *    absence satisfied by a panel that rendered nothing is the recorded sweep-matching-nothing
   *    defect.
   * 2. **A planted control**, per case, because a reader that reports no marking for ever satisfies
   *    every "carries none" assertion in the file.
   * 3. **A staging that names its verdict**, so a reader of this file can tell which recorded answer
   *    produced which row without reading `recorded-provider.ts`.
   */
  test.describe("what the panel states about a message nobody opened", () => {
    /** The listing's rows, addressed as rows rather than as the list they sit in. */
    function rowsIn(surface: Page): Locator {
      return surface.locator('[data-testid="message-list"] > li');
    }

    /**
     * The marking one row carries.
     *
     * **Scoped to the row rather than searched for in the document**, because the row is the unit the
     * delta speaks in ("that message's row SHALL carry a marking"). A document-wide reader would
     * answer the same thing for a panel that marked every row the same way and for one that marked
     * exactly the row that was undetermined.
     */
    function markingOf(row: Locator): Locator {
      return row.locator('[data-testid="message-verdict"]');
    }

    /**
     * The one row this surface is showing.
     *
     * **Both recorded listings this tier serves hold exactly one message, and its subject is empty**,
     * so a row cannot be scoped by its text and every case below would be indexing into a list whose
     * length it never established. **The count is therefore asserted here, as a precondition**, and
     * a fixture that gained a second message fails at this line rather than quietly making the case
     * assert about whichever row happened to be first.
     */
    async function soleRow(surface: Page): Promise<Locator> {
      const rows = rowsIn(surface);

      await expect(rows, "the recorded listing this stage serves holds one message").toHaveCount(
        1,
        {
          timeout: 20_000,
        },
      );

      return rows.first();
    }

    /**
     * Plant a marking the product did not write.
     *
     * **Written straight into the DOM rather than through any product path**, because the claim it
     * exists for is about the *reader*: a reader that reported no marking for ever would satisfy
     * every "carries none" assertion in this file, and only a marking that arrived by some other
     * route can falsify it. **It takes a row or the whole surface**, because one case in this group
     * has no row left to plant into by the time its control runs.
     */
    async function plantVerdictInto(node: Locator, words: string): Promise<void> {
      await node.evaluate((element, text) => {
        const planted = element.ownerDocument.createElement("p");

        planted.setAttribute("data-testid", "message-verdict");
        planted.textContent = text;
        element.append(planted);
      }, words);
    }

    /**
     * Every Guerrilla Mail request for one operation, read from the query the adapter spells it in.
     *
     * **Per-operation rather than a total, and that is the claim rather than a convenience.** The
     * claim is *"the marking costs no listing and no second body read"*, and a total cannot tell
     * those apart: two listings and no reads is the same number as one listing and one read.
     */
    function guerrillaCalls(urls: readonly string[], operation: string): readonly string[] {
      return urls.filter((url) => {
        try {
          return new URL(url).searchParams.get(GUERRILLA_OPERATION_PARAMETER) === operation;
        } catch {
          /** **A URL this reader cannot parse is not evidence about any operation.** */
          return false;
        }
      });
    }

    /**
     * The panel's or the popup's own rendered words, whitespace-collapsed into one string.
     *
     * **Rendered text rather than the copy module**, because the clause is about what a person
     * would read. A wording entry that no surface ever renders satisfies a sweep over the record
     * and fails this one, and only the second of those is the defect the requirement describes.
     */
    async function renderedWords(surface: Page): Promise<string> {
      return (await surface.locator("body").innerText()).replace(/\s+/gu, " ");
    }

    /**
     * Every forbidden phrasing the surface actually rendered, by name.
     *
     * **The same four the unit sweep holds (`panel-copy.test.ts`), restated here on purpose.** That
     * file sweeps declared sentences; this one sweeps **rendered** ones, and a declaration that
     * reached the screen by a path no declaration describes is a shape the declaration sweep cannot
     * see. **Neither pattern carries `g`**, so `test` is not stateful across the calls below - a
     * last-index-carrying `RegExp` makes a sweep report nothing on its second reading, which is the
     * recorded "assertion that cannot fail" in its quietest form.
     */
    const FORBIDDEN = [
      { name: "a percentage", pattern: /%/u },
      { name: "a confidence value", pattern: /\bcertain[a-z]*\b|\bconfiden[a-z]*\b/iu },
      {
        /**
         * *"... a claim that a message carries no verification"*, phrased as the certification
         * shapes rather than as the bare substring - see `panel-copy.test.ts`'s own note for why
         * `PANEL_COPY.noLinks` ("No verification link was found in this message.") is a report of
         * what a scan found and not a claim about a message.
         */
        name: "a claim that the message carries no verification",
        pattern:
          /\b(?:carries?|carry|carried|contains?|contain)\s+no\s+(?:detected\s+)?verification\b|nothing\s+to\s+verify/iu,
      },
      { name: "the word 'pending'", pattern: /\bpending\b/iu },
    ] as const;

    /** Which of {@link FORBIDDEN} the surface rendered, by name. */
    async function forbiddenWords(surface: Page): Promise<string[]> {
      const words = await renderedWords(surface);

      return FORBIDDEN.filter(({ pattern }) => pattern.test(words)).map(({ name }) => name);
    }

    /**
     * The built popup, opened **as a tab** of the window the fixture page shares.
     *
     * **A substitute, and it is the same one `in-page-fill.spec.ts` uses for the same reason.**
     * `chrome.action.openPopup()` adds no Playwright `Page` - measured - and a real popup window is
     * not a tab. What this arrangement holds is that the **built** `popup.html` boots, adopts what
     * this device holds, and renders; what it cannot hold is anything about how a popup is docked,
     * which no case in either tier measures.
     *
     * **The caller brings the fixture page to front afterwards**, because the panel re-asks the active
     * tab on every switch and this document's own readers read a *host*.
     */
    async function openThePopupDocument(): Promise<Page> {
      const popup = await extension.context.newPage();

      opened.push(popup);
      await popup.goto(`chrome-extension://${extension.extensionId}/popup.html`);

      return popup;
    }

    /**
     * `4.1a` - *A message carries a detected verification*.
     *
     * **Two stagings in one case, and the reason is the clause.** "SHALL name which was detected"
     * is a claim about **two** markings not being the same, so a case that only ever rendered one
     * could not state it - it would be asserting a property of the record, which `panel-copy.test.ts`
     * already does, rather than a property of the panel's built bundle.
     *
     * **Each staging answers the body read with a different recorded fixture**, chosen from
     * `recorded-provider.ts`'s own list rather than by transcribing a provider body here:
     * `mailtmMessageFetched`'s body carries a one-time code and no link, and
     * `guerrillaMessageWithVerificationLink`'s carries an anchor and no code.
     */
    test("names a detected code on one row and a detected link on another, and tells them apart", async () => {
      const withACode = await stage();

      await expect(withACode.panel.locator('[data-testid="panel-host"]')).toContainText(
        FIXTURE_HOST,
        {
          timeout: 20_000,
        },
      );
      await createHere(withACode.panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      const codeRow = await soleRow(withACode.panel);

      await expect(markingOf(codeRow)).toHaveCount(1);
      await expect(markingOf(codeRow)).toHaveText(PANEL_VERDICT_WORDING.carriesCode, {
        timeout: 20_000,
      });

      const codeMarking = (await markingOf(codeRow).textContent()) ?? "";

      /**
       * **The first staging's pages are closed and the device emptied before the second begins.**
       *
       * `recordProviderTraffic` installs a `context.route` for the whole profile, so a second staging
       * in the same case means **two handlers on one context** - and the first one would then be
       * answering requests it was written for a closed panel. **Clearing the stored mailbox matters
       * for the same reason one device is one device**: the second panel would otherwise be offered
       * the address the first one created, and `restore` would take a path this case is not about.
       */
      await closeStaged(withACode);
      await clearArmedAlarms(extension);
      await clearStoredMailbox(extension);

      const withALink = await stage({
        mailTmUnavailable: true,
        guerrillaRead: GUERRILLA_READ_ANSWERS.link,
      });

      await expect(withALink.panel.locator('[data-testid="panel-host"]')).toContainText(
        FIXTURE_HOST,
        {
          timeout: 20_000,
        },
      );
      await createHere(withALink.panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      const linkRow = await soleRow(withALink.panel);

      await expect(markingOf(linkRow)).toHaveCount(1);
      await expect(markingOf(linkRow)).toHaveText(PANEL_VERDICT_WORDING.carriesLink, {
        timeout: 20_000,
      });

      const linkMarking = (await markingOf(linkRow).textContent()) ?? "";

      /**
       * **The claim, as rendered rather than as declared.** Two panels, two recorded bodies, two
       * different sentences - and a component that ignored the prop and marked every row the same
       * way would fail here while passing every assertion above it.
       */
      expect(codeMarking).not.toBe(linkMarking);
      expect(linkMarking).not.toBe(codeMarking);

      /**
       * **And neither names both** - *"SHALL name which was detected rather than naming both"*.
       *
       * **Checked against the rendered words and not against the record**, so a copy change that put
       * both detections in one sentence is caught where a person would meet it.
       */
      expect(codeMarking).not.toMatch(/verification link/iu);
      expect(linkMarking).not.toMatch(/one-time code/iu);

      /** **The reader's control, in the surface whose absence is asserted elsewhere.** */
      await plantVerdictInto(linkRow, PANEL_VERDICT_WORDING.undetermined);
      await expect(markingOf(linkRow)).toHaveCount(2);
    });

    /**
     * `4.1b` - *A message was read and carries nothing*.
     *
     * **Staged by letting the body read fall through to the recorded listing**, which carries no body
     * field - so the read *succeeds*, the text is empty, and the session's verdict pass reaches
     * `carriesNothing` for the honest reason rather than by being refused. **A refused read would
     * produce `undetermined` instead**, which is a different row and the next case's subject, so
     * the distinction this staging draws is the whole claim.
     */
    test("leaves the row bare when the message was read and carried nothing", async () => {
      const { panel } = await stage({ mailTmUnavailable: true });

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await createHere(panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      const row = await soleRow(panel);

      /**
       * **Bare is a count of zero on that row, and not "the text is not the other four".** A reader
       * that returned the empty string for every verdict would satisfy the second reading and fail
       * this one - and this is the direction that matters, because `carriesNothing` is the verdict a
       * mapping bug most easily turns into a silence that means something else.
       */
      await expect(markingOf(row)).toHaveCount(0);

      /** **And nothing anywhere on the panel renders one.** */
      await expect(panel.locator('[data-testid="message-verdict"]')).toHaveCount(0);

      /**
       * **The empty string is declared, not missing** - so "bare" is a decision this module made
       * rather than a key somebody forgot, and a future reader of `panel-copy.ts` sees why.
       */
      expect(PANEL_VERDICT_WORDING.carriesNothing).toBe("");

      /**
       * **And the panel says no forbidden thing anywhere**, which is the scenario's second half -
       * *"SHALL NOT state that the message carries no verification"*. **Silence is the answer**, so
       * this is the assertion that a future copy change cannot satisfy by rewording the marking.
       */
      expect(await forbiddenWords(panel)).toEqual([]);

      /** **The sweep's own control, planted where the sweep reads it.** */
      await plantVerdictInto(row, "Carries no verification.");
      expect(await forbiddenWords(panel)).toEqual([
        "a claim that the message carries no verification",
      ]);

      /** **And the reader can see a marking at all**, in the surface the assertion above emptied.** */
      await expect(markingOf(row)).toHaveCount(1);
    });

    /**
     * `4.1c` - *A message could not be determined*.
     *
     * **Staged by making the one body read answer with a recorded refusal**, so `getMessage` throws
     * and the verdict pass records `undetermined`. **This is the row the whole capability exists
     * for**: it is the only place in this product where a message is described by what the session
     * does not know rather than by what was found in it.
     */
    test("says on that row that the message could not be read, and nothing about what it holds", async () => {
      const { panel } = await stage({
        mailTmUnavailable: true,
        guerrillaRead: GUERRILLA_READ_ANSWERS.refused,
      });

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await createHere(panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      const row = await soleRow(panel);

      await expect(markingOf(row)).toHaveCount(1);
      await expect(markingOf(row)).toHaveText(PANEL_VERDICT_WORDING.undetermined, {
        timeout: 20_000,
      });

      const said = (await markingOf(row).textContent()) ?? "";

      /**
       * **It is words, and it is not the absence the other verdict uses.** `carriesNothing` and
       * `undetermined` are both "no detection" to a reader who only asks "did it find anything?", and
       * `state.ts` names collapsing the second into the first as *"the one false claim in this
       * product that costs a user the code they were waiting for"*. So the two are told apart by an
       * assertion a silence cannot pass.
       */
      expect(said).not.toBe(PANEL_VERDICT_WORDING.carriesNothing);
      expect(said.length).toBeGreaterThan(0);

      /** **And it is not any of the three the session could have stated instead.** */
      for (const kind of ["carriesCode", "carriesLink", "carriesCodeAndLink"] as const) {
        expect(said, kind).not.toBe(PANEL_VERDICT_WORDING[kind]);
      }

      /** **And nothing on the panel certifies anything.** */
      expect(await forbiddenWords(panel)).toEqual([]);

      await plantVerdictInto(row, "Certainly contains a one-time code.");
      expect(await forbiddenWords(panel)).toEqual(["a confidence value"]);
    });

    /**
     * `4.1d` - *The listing is not yet determined in full*.
     *
     * **The same staging as `4.1c`, and deliberately: the clause is about what the panel says about
     * the *mailbox* while one *row* is undetermined.** A panel that marked every row correctly could
     * still add a heading reading "Nothing to verify here", and that sentence is the false claim this
     * scenario forbids - so this case sweeps the whole rendered surface rather than the row.
     */
    test("concludes nothing about the whole mailbox while one message is undetermined", async () => {
      const { panel } = await stage({
        mailTmUnavailable: true,
        guerrillaRead: GUERRILLA_READ_ANSWERS.refused,
      });

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await createHere(panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      const row = await soleRow(panel);

      /**
       * **The positive control, and it runs first.** Without it the sweep below is satisfied by a
       * panel that rendered no words at all - which is the recorded shape of an assertion that cannot
       * fail, and the reason every sweep in this repository carries a control.
       */
      await expect(markingOf(row)).toHaveText(PANEL_VERDICT_WORDING.undetermined, {
        timeout: 20_000,
      });

      expect(await forbiddenWords(panel)).toEqual([]);

      /** **The sweep's control, in the sentence shape a real heading would take.** */
      await plantVerdictInto(row, "This mailbox contains no detected verification.");
      expect(await forbiddenWords(panel)).toEqual([
        "a claim that the message carries no verification",
      ]);
    });

    /**
     * `4.1e` - *A check failed and the last known listing is shown*, **staged by the panel's own poll
     * rather than by a press - and that staging is a correction rather than a preference.**
     *
     * **The first version of this case asserted the variant was unreachable.** Its reasoning was that
     * nothing in `apps/extension` calls `session.checkInbox()` or `session.setVisible()`, so nothing
     * is ever scheduled and the panel never polls. **Measurement overturned it, and the mechanism is
     * in `packages/mailbox` rather than in this client:** `InboxTracker` opens with `let visible = true`
     * (`inbox.ts:143`) rather than `false`, and the **public** `check:` member - the very one `adopt`
     * is handed (`session.ts:483`, `adopt(stored, inbox.check)`) - calls `scheduleNext()` itself
     * (`inbox.ts:456-459`, added by the comment that names the omission a defect). **So the reconcile
     * the panel already performs queues the next check**, and the recorded provider here was asked for
     * a second listing about ten seconds after the first with nothing in this file having asked for it.
     * Ten seconds is `nextDelay(1)`, not a number chosen here.
     *
     * **And the corrected staging is the stronger one, not the smaller one.** The rejected version
     * asserted an *absence* - no marking on a listing that had vanished - having staged a failed
     * reconcile, because `adopt` maps a first-failure to `restoreFailed`. **This reaches the thing the
     * delta actually describes: rows that were marked, surviving a listing that failed afterwards,
     * still marked with what they were found to carry.** The single case now covers what the two
     * before it did apart from, and it covers it through the shipped code path.
     */
    test("keeps a marked row and what it was marked with, when the next check fails", async () => {
      const { panel, traffic } = await stage({
        mailTmUnavailable: true,
        guerrillaRead: GUERRILLA_READ_ANSWERS.code,
        /**
         * **The second listing fails, counted in listings rather than as a boolean** - see
         * `recorded-provider.ts`. A staging that failed every listing could not show a row at all,
         * and this case's positive control *is* a row.
         */
        guerrillaListFailsFromAttempt: 2,
      });

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await createHere(panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      /** **The positive control: one listing, one body read, and a row marked from what they found.** */
      const row = await soleRow(panel);
      await expect(markingOf(row)).toHaveCount(1);
      await expect(markingOf(row)).toHaveText(PANEL_VERDICT_WORDING.carriesCode, {
        timeout: 20_000,
      });
      await waitForRequests(traffic, 1);
      expect(guerrillaCalls(traffic.requested, GUERRILLA_LIST_OPERATION)).toHaveLength(1);

      /**
       * **The panel's own cadence makes the second listing, and it fails.** The ceiling is imported
       * from `packages/mailbox/src/cadence` rather than picked, for the reason this file has recorded
       * about every hand-chosen constant - and the wait is on the *failure having happened*, so a
       * count is never read before the request that makes it exists.
       */
      await expect
        .poll(() => guerrillaCalls(traffic.requested, GUERRILLA_LIST_OPERATION).length, {
          timeout: INBOX_POLL_CEILING_MS,
        })
        .toBeGreaterThanOrEqual(2);

      /** **The failure is reported rather than swallowed.** */
      await expect(panel.getByRole("alert").first()).toBeVisible({ timeout: 20_000 });

      /**
       * **And the row is still on screen, still marked once, and still marked with what it was
       * actually found to carry - not with `undetermined`.** This is the whole claim, and the last
       * clause is the half that could have gone quietly wrong: a failure learned nothing *new*, so
       * "nothing new is known" must not become "nothing is known about what was already read".
       */
      await expect(panel.locator('[data-testid="message-list"]')).toHaveCount(1);
      const retained = await soleRow(panel);
      await expect(markingOf(retained)).toHaveCount(1);
      await expect(markingOf(retained)).toHaveText(PANEL_VERDICT_WORDING.carriesCode);
      await expect(panel.locator('[data-testid="message-verdict"]')).toHaveCount(1);
      await expect(panel.locator('[data-testid="message-verdict"]')).not.toHaveText(
        PANEL_VERDICT_WORDING.undetermined,
      );

      /**
       * **The reader's own control, planted into the panel's body rather than into a row.** A sweep
       * or a count that cannot fail proves nothing, and `undetermined` is the one word that would
       * satisfy "there is a marking" while telling the reader the opposite of the truth - so it is
       * planted into a place this case did not author to show the reader would have reported it.
       */
      await plantVerdictInto(panel.locator("body"), PANEL_VERDICT_WORDING.undetermined);
      await expect(panel.locator('[data-testid="message-verdict"]')).toHaveCount(2);
      await expect(markingOf(retained)).toHaveCount(1);
    });

    /**
     * `4.2` - the clause about **a surface that does not ask**: *"a surface that does not ask for a
     * marking SHALL render its listing exactly as it does without this requirement"*.
     *
     * **The only place a leak between the two surfaces is observable at all.** They render the same
     * component, over the same session, from the same recorded listing - and `Popup.test.tsx` cannot
     * catch a prop that defaults to on, because a component test asserting "the popup renders no
     * marking" passes against a component that marks every row when the assertion is written as
     * *"the popup does not pass the prop"* rather than as *"no marking appears"*.
     *
     * **Both surfaces hold the same recorded mailbox, and the second gets it without being asked
     * twice.** The panel creates it; the popup then adopts it out of `chrome.storage.local` through
     * `main.tsx`'s `loadMailbox`, so the two surfaces' rows come from the identical input, the
     * identical listing and the identical verdict pass - **and the only thing that differs is whether
     * the words were asked for.** A popup that created its own mailbox instead would be comparing
     * two different inputs, and "the popup renders no marking" would then be trivially true for the
     * wrong reason.
     */
    test("renders no marking in the popup for the mailbox the panel marks", async () => {
      const { page, panel } = await stage({
        mailTmUnavailable: true,
        guerrillaRead: GUERRILLA_READ_ANSWERS.code,
      });

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await createHere(panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      /** **The positive control: the panel marks it.** */
      const panelRow = await soleRow(panel);
      await expect(markingOf(panelRow)).toHaveCount(1);
      await expect(markingOf(panelRow)).toHaveText(PANEL_VERDICT_WORDING.carriesCode, {
        timeout: 20_000,
      });

      const popup = await openThePopupDocument();

      /**
       * **The fixture page comes to the front, and the reason is the one `in-page-fill.spec.ts`
       * gives.** A surface opened as a tab is its own active tab, so both `findActiveTab` calls -
       * the panel's host question and the popup's own - would answer with each other. **The panel
       * re-asks on every tab switch**, so this is also what keeps the panel's own marking in place
       * for the last assertion below.
       *
       * **And the switch is given the same activation precondition as the first two cases in this
       * file**, for the reason `establishTheHostReading` records: this is one of the four cases that
       * genuinely needs `chrome.tabs.onActivated`, so it cannot be staged around and must not be
       * left waiting on the delivery of an event this browser schedules.
       */
      const switchedBackFromPopup = await watchTabActivations(panel);
      await page.bringToFront();
      await switchedBackFromPopup();

      /**
       * **No press at all, and that is a measured property of the shipped tree rather than a
       * convenience.** `apps/extension/src/main.tsx` hands the session
       * `loadMailbox: async () => (await loadInsertableMailboxes(storage.records))[0] ?? null`, so a
       * popup opened on a device that already holds the mailbox the panel just created **adopts
       * that mailbox** and lists it - which means `Create an address` is not on the screen at all.
       * **The first version of this case pressed it, and failed with a 90 s timeout rather than with
       * an assertion, so nothing about the claim was measured.** Both presses are gone; the wait is
       * on the row appearing.
       */
      await expect(popup.locator(".popup__address")).toHaveText(FIXTURE_IDS.guerrilla.address, {
        timeout: 20_000,
      });
      await expect(rowsIn(popup)).toHaveCount(1, { timeout: 20_000 });

      /** **And no marking in it. This is the claim.** */
      await expect(popup.locator('[data-testid="message-verdict"]')).toHaveCount(0);

      /** **The reader's own control, in the popup.** */
      await plantVerdictInto(rowsIn(popup).first(), PANEL_VERDICT_WORDING.carriesCode);
      await expect(popup.locator('[data-testid="message-verdict"]')).toHaveCount(1);

      /**
       * **And the panel still marks its own row, at the same moment** - so the two readings are of
       * one device holding one mailbox, and this is not a case where the panel's marking had
       * quietly gone away before the popup was opened.
       */
      await expect(markingOf(await soleRow(panel))).toHaveText(PANEL_VERDICT_WORDING.carriesCode);
    });

    /**
     * `4.3` - *The panel states what the session holds*, read as a **request count** rather than as a
     * rendering.
     *
     * **The claim is `design.md` D4's: the marking costs no provider request and reads no body.** The
     * verdicts are already inside `listing.verdicts` by the time the panel renders, so a marking that
     * read a body to draw itself would show up here as a **second** `fetch_email` for a listing - which
     * is why the count is taken per operation rather than as a total.
     *
     * **And the shape asserted is an invariant rather than a difference, which is a repair rather than
     * a preference.** The first version of this case compared the panel's totals against the popup's
     * with `toBe(1)`. **That is a hand-picked figure and it is not load-independent:** both surfaces
     * poll, `main.tsx`'s `loadMailbox` makes the popup adopt rather than create, and the panel's own
     * `nextDelay(1)` listing landed inside the case - so the difference was 2, and a number that moves
     * with machine load is the defect this repository has recorded more often than any other in this
     * file. **Every listing this recording makes does exactly one body read and one body read per
     * listing, on both surfaces, always** - so `reads === listings` is what "the marking costs no
     * request and reads no body" looks like when nothing may be counted by hand, and it survives any
     * number of poll cycles either surface runs.
     */
    test("states the marking without costing a request the session was not already making", async () => {
      const { page, panel, traffic } = await stage({
        mailTmUnavailable: true,
        guerrillaRead: GUERRILLA_READ_ANSWERS.code,
      });

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await createHere(panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      /**
       * **Waited for the marking, not read beside it.** The body read is part of the verdict pass,
       * so a count taken while the marking has not appeared is a count about a listing that has not
       * been analysed yet - and the recording's own lesson is that a count read next to an action
       * is this repository's most-recorded defect.
       */
      await expect(markingOf(await soleRow(panel))).toHaveText(PANEL_VERDICT_WORDING.carriesCode, {
        timeout: 20_000,
      });

      /** **The counter's positive control: it can see a request at all.** */
      expect(traffic.requested.length).toBeGreaterThan(0);

      /** **One listing, one body read, one marking - and the read the verdict pass needed.** */
      await waitForRequests(traffic, 1);
      expect(guerrillaCalls(traffic.requested, GUERRILLA_LIST_OPERATION)).toHaveLength(1);
      expect(guerrillaCalls(traffic.requested, GUERRILLA_READ_OPERATION)).toHaveLength(1);

      /**
       * **The panel's own cadence makes the next listing, and it costs no body read.**
       *
       * **An earlier version of this line asserted `reads === listings`, and it was wrong** - that is
       * what a *first* listing followed by a poll looks like, because `InboxTracker` retains the
       * verdict of a message it has already read and re-reads nothing for a listing that brings no
       * new one. **A figure derived from the first cycle is a figure about the first cycle.** What the
       * scenario's *"SHALL read no message body of its own"* claims is that **no body read was spent on
       * the verdict**, so what states it is the read count re-read after the session has demonstrably
       * listed again: a listing with a marking on screen, and no read added by anything.
       *
       * **Waiting for the number of listings to grow is the load-independent half**; waiting for a
       * period to elapse and hoping none arrives is the other, and it is the one this file has had to
       * repair twice. The ceiling is the cadence's own, imported rather than picked.
       */
      await expect
        .poll(() => guerrillaCalls(traffic.requested, GUERRILLA_LIST_OPERATION).length, {
          timeout: INBOX_POLL_CEILING_MS,
        })
        .toBeGreaterThanOrEqual(2);

      expect(guerrillaCalls(traffic.requested, GUERRILLA_READ_OPERATION)).toHaveLength(1);

      /**
       * **The same mailbox, on the surface that renders no marking**, taken in this same recording so
       * one reader reads both surfaces' costs out of one log. `4.2` is what makes the popup's row the
       * same input; this is what shows a surface that asks for nothing spends nothing either.
       *
       * **The read count is taken on both sides of the popup, and the reason is a measured property
       * of the shipped tree rather than a convenience.** Each surface builds its own session over its
       * own `InboxTracker`, so the popup arrives with an **empty verdict map** and reads the message
       * once for itself - which is why the count after the popup is `+1` and not `+0`. **An earlier
       * draft of this case asserted a total of one across both surfaces and failed on exactly that**,
       * which is the finding: the figure has to account for two sessions, and only the recorded
       * reader says how many there are.
       */
      const readsBefore = guerrillaCalls(traffic.requested, GUERRILLA_READ_OPERATION).length;

      const popup = await openThePopupDocument();

      /** **The fourth case that genuinely needs `chrome.tabs.onActivated`**, so it is given the same
       * activation precondition as the other three rather than a 20 000 ms wait on an event measured
       * between 86 ms and 19 898 ms. See `establishTheHostReading`. */
      const switchedBackFromPopup = await watchTabActivations(panel);
      await page.bringToFront();
      await switchedBackFromPopup();

      /**
       * **No press, for the reason `4.2` gives**: the popup adopts the mailbox the panel created out
       * of the device's own storage, so it lists without being asked and has no create control to
       * press.
       */
      await expect(popup.locator(".popup__address")).toHaveText(FIXTURE_IDS.guerrilla.address, {
        timeout: 20_000,
      });
      await expect(rowsIn(popup)).toHaveCount(1, { timeout: 20_000 });
      await expect(popup.locator('[data-testid="message-verdict"]')).toHaveCount(0);

      /**
       * **The popup added a listing and its own single verdict read, and nothing else.** The listing
       * figure is a floor rather than an equality, because both surfaces go on polling on their own
       * cadences and how many land before this line runs is a fact about machine load; the read figure
       * is an equality **because a body read happens once per message per session**, and the recorded
       * provider serves the same one message for the whole run - so the two sessions account for
       * exactly `readsBefore + 1`, and a read spent on a marking would make it one more.
       *
       * **The popup's row is on screen**, so this is not a reading over an idle second surface, and
       * **the panel's own marking was on screen for every one of these listings**, which is what makes
       * the equality say something about the marking rather than about two surfaces at rest.
       */
      expect(guerrillaCalls(traffic.requested, GUERRILLA_LIST_OPERATION).length).toBeGreaterThan(2);
      expect(guerrillaCalls(traffic.requested, GUERRILLA_READ_OPERATION)).toHaveLength(
        readsBefore + 1,
      );

      /**
       * **Nothing unscripted was reached on the way**, which is the tier's standing claim and is
       * asserted last so it covers the popup's own traffic too.
       */
      expect(traffic.unscripted).toEqual([]);
    });
  });

  /**
   * ## Removing what this device keeps
   *
   * Eight cases for seven browser-observable scenarios (`tasks.md` 5.5's arithmetic, stated rather than
   * rounded). **The two scenarios this tier cannot hold are named rather than left to look like
   * coverage**: *a removal is refused* — **the browser tier has no way to make a real
   * `chrome.storage.local` reject a clear**, so a case for it would have to lie about the platform —
   * and *what the panel knows before its boot read has finished* — the read is a real asynchronous read
   * of a real area and **there is no window in which to catch it**, so a case for it would be a case
   * about a race. **Both are carried by `Panel.test.tsx`'s cases 3 and 9**, which is why that file grew
   * by nine and this one by eight.
   */
  test.describe("removing what this device keeps, in a real Chromium", () => {
    /**
     * **One mailbox this host was last used with, seeded before the panel is asked anything.**
     *
     * **`seedMailboxCollection` rather than `createHere`, and the difference is what these cases are
     * about.** A created address arrives with a session the recorded provider serves, and the panel then
     * adopts it and **starts polling on its own cadence** — which is exactly what B7 counts requests
     * across, and a case that seeded nothing would leave a second surface's traffic inside a count it
     * claims to own. A seeded mailbox whose reconcile the provider cannot satisfy leaves the panel
     * holding it, rendering its address, offering its removal, and **making no further request**, so the
     * request count is this case's own.
     *
     * **It is seeded before the stage for `resetStoredMailbox`'s reason**: the panel reads the device
     * once, at boot.
     */
    async function seedOne(): Promise<void> {
      await seedMailboxCollection(extension, [STORED_MAILBOX]);
      await seedSiteAssociation(extension, { [FIXTURE_HOST]: STORED_MAILBOX.id });
    }

    /**
     * Stage a panel that has finished reading this device, which is the precondition every case below
     * needs and none of them establishes for itself.
     *
     * **Waiting on the host line is the boot read's own signal rather than a delay**, because the panel
     * asks the page *only* after it knows what this device holds — the case
     * *"never asks the page for a host before it knows what this device holds"* is what makes this wait
     * a precondition rather than a hope. **Read it here once and passed in**, so eight cases do not
     * each spell the same 20 000 ms.
     */
    async function stageWithTheDeviceRead(needsMailbox: boolean): Promise<{
      readonly panel: Page;
      readonly traffic: ProviderTraffic;
    }> {
      if (needsMailbox) {
        await seedOne();
      }

      const staged = await stage();

      await expect(staged.panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });

      return staged;
    }

    /**
     * The removal region's own text, **scoped to the region's own `data-testid`.**
     *
     * **Not a page-wide search, and `showingLine`'s note above is the reason**: the address is on this
     * panel three sections up, so a reader searching the page for what the removal said would be
     * answering about the wrong region — and a claim like *"no sentence claims the address is gone"* is
     * a claim about **one region**. **B6 carries a positive and a negative control on this reader**, so
     * a reader that returned the whole page, or the empty string, is reported by name rather than
     * passing B6 for the wrong reason.
     */
    function removalRegionText(panel: Page): Promise<string> {
      return panel.locator('[data-testid="panel-removal-removed"]').innerText();
    }

    /**
     * The removal region's own paragraphs, **each one exactly as rendered.**
     *
     * **A second spelling of the same region, for the one claim a whole-region string cannot make.**
     * `innerText` answers *"what does the region say"*; this answers *"how many paragraphs is it, and
     * what is each"* — so `toEqual` on this list distinguishes *returned the two sentences* from
     * *returned something containing them*. It is scoped to the same `data-testid` for the same
     * reason, and it reads `textContent` per paragraph rather than the region's text, because a
     * reader that trimmed or reworded inside a paragraph has to be visible here and nowhere else.
     */
    function removalRegionParagraphs(panel: Page): Promise<Array<string>> {
      return panel
        .locator('[data-testid="panel-removal-removed"] p')
        .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    }

    /**
     * The listing's rows, addressed as rows rather than as the list they sit in.
     *
     * **The same selector `rowsIn` spells in the verdict group above, and it is spelled again rather
     * than shared because that one is declared inside that group's `test.describe`.** Moving it out to
     * this file's scope would be the tidier repair and is deliberately *not* done: `rowsIn` is read by
     * four cases that were falsified against it, and moving a helper those cases depend on, in a change
     * about a removal region, is an edit to their instrument that no mutation here would justify. **So
     * the duplication is deliberate and is the reason a drift between the two is possible** — which is
     * recorded here rather than left for a reader to find two literals and assume the first was a
     * mistake.
     */
    function listingRows(surface: Page): Locator {
      return surface.locator('[data-testid="message-list"] > li');
    }

    /**
     * How many **Mail.tm message listings** this panel has asked for.
     *
     * **Mail.tm and not Guerrilla, because this case is staged with a plain {@link stage} and the
     * extension's provider is Mail.tm primary with Guerrilla as the fallback — so this panel lists
     * through Mail.tm and a Guerrilla-only reader counts nothing, for ever.**
     *
     * **That was measured rather than reasoned, and it is the third instrument defect this falsification
     * pass found.** The first spelling of this helper counted Guerrilla `check_email` calls, and the
     * repaired assertion then sat at `Received: 0` on the *unmutated* tree — a 30-second wait for a
     * poll that the reader was never able to see. **A reader pointed at the wrong provider is the same
     * defect as a `-g` pointed at the wrong case**: the assertion runs, reports a confident number,
     * and the number is about something else. **A count of zero is the tell**, and the repair was to
     * read the provider this staging actually uses.
     *
     * **`/messages?page=1` and not `/messages`,** and `recorded-provider.ts:147` carries the reason:
     * the route table lists `/messages/{id}` before the collection so the item route cannot shadow it,
     * and a filter loose enough to match both would count every body read as a listing — which is
     * exactly the *"per-operation rather than a total"* note on {@link guerrillaCalls} above, and
     * `in-page-fill.spec.ts` already spells this same substring for the same reason.
     *
     * **A third spelling of that filter across the tier rather than a shared one**, for
     * {@link listingRows}'s reason: the other two live in spec files this group cannot import from, and
     * this change does not justify moving an instrument five falsified cases already read. **A URL that
     * cannot be parsed is not evidence about any listing**, as with `guerrillaCalls`.
     */
    function listingsMade(urls: readonly string[]): number {
      return urls.filter((url) => url.includes("/messages?page=1")).length;
    }

    test("offers a way to remove what this device holds, and the control that removes is not on the page", async () => {
      const { panel } = await stageWithTheDeviceRead(true);

      /**
       * **Both halves, and they are separate claims.** The offer is named from the copy record rather
       * than from a literal, so a reworded button is reported here instead of answering to its own old
       * wording; and the absence is checked by accessible name, because a `data-testid` query would pass
       * against a panel that rendered the control under a name this file had not been updated for.
       */
      await expect(panel.getByRole("button", { name: PANEL_COPY.removalOffers })).toBeVisible();

      await expect(panel.locator('[data-testid="panel-removal-confirm"]')).toHaveCount(0);
      await expect(panel.getByRole("button", { name: PANEL_COPY.removalConfirm })).toHaveCount(0);

      /**
       * **The region carries neither the confirmation's label nor its warning**, read as the region's
       * own text — **the region has no `data-testid` in the offering shape**, so it is reached through
       * the offer button's own section rather than by a selector that would resolve to nothing and
       * satisfy the assertion below vacuously.
       */
      const regionText = await panel
        .getByRole("button", { name: PANEL_COPY.removalOffers })
        .evaluate((node) => node.closest("section")?.textContent ?? "");

      expect(regionText.length).toBeGreaterThan(0);
      expect(regionText).not.toContain(PANEL_COPY.removalConfirm);
      expect(regionText).not.toContain(PANEL_COPY.removalConfirmWarning);

      // **The positive control for the region lookup above**: the heading *is* in it.
      expect(regionText).toContain(PANEL_COPY.removalHeading);
    });

    test("removes nothing until the further step is taken, read from the platform's own area", async () => {
      /**
       * **This is the case the change most needs**, and `tasks.md` 5.3 gives the reason: reading the
       * DOM for "nothing was removed" is satisfied by a panel that never removed anything on either
       * press — which is also a panel with no removal region at all. **So this asks the platform**, and
       * it asks it twice.
       */
      await seedOne();
      await plantUnrecognisedRecord(extension);

      const { panel } = await stageWithTheDeviceRead(false);

      /**
       * **The reading before anything is pressed, and the planted key *is* in it.**
       *
       * **This half is the control for the whole case.** A reader that answered `[]` for every device
       * would satisfy "nothing was removed after the first press" for ever — the sweep that matches
       * nothing is the defect this repository records more often than any other — so the planted record
       * this build has no code for is asserted **listed** first, and only then absent afterwards.
       */
      const before = await readWholeArea(extension);
      expect(before, `the area held: ${before.join(", ")}`).toContain(UNRECOGNISED_RECORD_KEY);

      await panel.getByRole("button", { name: PANEL_COPY.removalOffers }).click();

      /**
       * **After the *offering* press the area is byte-for-byte what it was**, and the assertion is an
       * equality of the whole key list rather than a length: a length would be satisfied by a removal
       * that removed one key and added another, and by a reader that reported the wrong device's keys.
       */
      expect(await readWholeArea(extension)).toEqual(before);

      // **And the further step is visibly taken**, so the next assertion has a press to credit.
      await expect(panel.locator('[data-testid="panel-removal-confirm"]')).toBeVisible();

      await panel.getByRole("button", { name: PANEL_COPY.removalConfirm }).click();

      /**
       * **And this is the control for the assertion above**: a reader answering "empty" for every
       * device passes the offering press and fails this one. **`site-associations`' *"a poll that
       * starts satisfied passes immediately on a controller that never wrote anything"* — in a browser
       * tier, against the platform rather than a fixture.**
       */
      expect(await readWholeArea(extension)).toEqual([]);
    });

    test("a confirmed removal empties the area, including a record this build does not recognise", async () => {
      /**
       * **Why a browser spec needs a record this build cannot read.** `chrome.storage.local` holds four
       * kinds of record over one area and `clearAll` removes the whole area — **and an empty area is
       * also what a removal of the four keys this build *knows about* produces.** That is why
       * `packages/storage/src/chrome.test.ts:251`–`:254` asserts *"the call, not the result"*, and why
       * `chrome.test.ts:257`–`:263` plants a key at all. **A key no shipped code names is the only
       * thing that can tell a whole-area clear from a key-scoped one through the platform.**
       */
      await seedOne();
      await plantUnrecognisedRecord(extension);

      const { panel } = await stageWithTheDeviceRead(false);

      // **Planted *after* the mailbox is stored**, for `storage.spec.ts:228`–`:256`'s ordering rule.
      expect(await readWholeArea(extension)).toContain(UNRECOGNISED_RECORD_KEY);

      await panel.getByRole("button", { name: PANEL_COPY.removalOffers }).click();
      await panel.getByRole("button", { name: PANEL_COPY.removalConfirm }).click();

      // **Waited on the panel's own report before reading the area**, because a synchronous read would
      // be reading a removal still in flight — and `chrome.storage.clear()` is a round trip.
      await expect(panel.locator('[data-testid="panel-removal-removed"]')).toBeVisible({
        timeout: 20_000,
      });

      expect(await readWholeArea(extension)).toEqual([]);
    });

    test("reports holding nothing afterwards and offers no further removal", async () => {
      const { panel } = await stageWithTheDeviceRead(true);

      await panel.getByRole("button", { name: PANEL_COPY.removalOffers }).click();
      await panel.getByRole("button", { name: PANEL_COPY.removalConfirm }).click();

      const region = panel.locator('[data-testid="panel-removal-removed"]');
      await expect(region).toBeVisible({ timeout: 20_000 });

      /**
       * **The removal's own sentence, and the empty device's sentence is absent.**
       *
       * `apps/web/src/LocalData.tsx:24`–`:29` is the recorded defect: one sentence served both the
       * first visit and the removal, so a person who had just pressed a button could not tell whether
       * the press had worked. **Asserting the absence is the half that catches it** — a panel that
       * rendered both sentences would satisfy the first assertion.
       */
      await expect(region).toContainText(PANEL_COPY.removalDone);
      await expect(region).not.toContainText(PANEL_COPY.removalHoldsNothingYet);

      /** **No control of any kind, read three ways: the two test ids and the accessible name.** */
      await expect(panel.locator('[data-testid="panel-removal-offer"]')).toHaveCount(0);
      await expect(panel.locator('[data-testid="panel-removal-confirm"]')).toHaveCount(0);
      await expect(panel.locator('[data-testid="panel-removal-keep"]')).toHaveCount(0);
      await expect(panel.getByRole("button", { name: PANEL_COPY.removalOffers })).toHaveCount(0);
    });

    test("keeps the mailbox on screen and its inbox usable after the removal", async () => {
      /**
       * **A created mailbox rather than a seeded one, and this case is the only one of the eight that
       * needs it** — *"its inbox SHALL remain usable"* is a claim about a **listing**, and a seeded
       * mailbox's reconcile the provider cannot satisfy leaves no listing to keep.
       *
       * **So this case measures what the other seven deliberately do not, and the two shapes are not
       * interchangeable**: this one runs the panel's own poll after the adoption, which is why it
       * asserts the inbox's presence and shape rather than a request count.
       */
      const { panel, traffic } = await stage();
      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });
      await createHere(panel);
      await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);

      /**
       * **The positive control: the address and the listing are on screen *before* anything is removed.**
       *
       * Without it, "still on screen" is satisfied by a panel that showed neither at any point — the
       * recorded precondition shape, and the one this case would otherwise have been filed as coverage
       * of.
       */
      await expect(panel.locator(".panel__address")).toHaveText(/@/u);
      await expect(panel.locator('[data-testid="message-list"]')).toBeVisible({ timeout: 20_000 });
      await expect(listingRows(panel)).toHaveCount(1);

      /**
       * **The listing count as it stands *before* the removal**, read only once the row above is on the
       * page — so it is a count of a listing that has already happened and not of one still to come, and
       * the assertion at the end is about a request made *afterwards*. **Read beside the removal it
       * would be a count taken next to an action, which is this repository's most-recorded defect.**
       *
       * **The row assertion is in the positive control rather than only after the removal for that
       * reason.** It was after the removal alone in the first version, which left `listingsBefore` free
       * to be `0` — and a wait for *"more than 0 listings"* is then satisfied by the adoption's own
       * listing, arriving after the removal, with the poll playing no part in it.
       */
      const listingsBefore = listingsMade(traffic.requested);
      expect(listingsBefore).toBeGreaterThan(0);

      await panel.getByRole("button", { name: PANEL_COPY.removalOffers }).click();
      await panel.getByRole("button", { name: PANEL_COPY.removalConfirm }).click();
      await expect(panel.locator('[data-testid="panel-removal-removed"]')).toBeVisible({
        timeout: 20_000,
      });

      /**
       * **The address, the listing and its rows, all still there** — three claims rather than one,
       * because a panel that kept the address and emptied the inbox would satisfy "the mailbox stays on
       * screen" in the only wording that case could have used.
       */
      await expect(panel.locator(".panel__address")).toHaveText(/@/u);
      await expect(panel.locator('[data-testid="message-list"]')).toBeVisible();
      await expect(listingRows(panel)).toHaveCount(1);

      /**
       * **And the inbox is still *checking itself*, which is the half of "usable" the three assertions
       * above cannot reach.**
       *
       * **They cannot, because a destroyed session keeps rendering everything it was last given.**
       * `inbox.test.ts` states this as its own measured fact — *"answers an explicit ask after being
       * destroyed, but schedules nothing further"* — so a panel whose removal tore the session down
       * still shows the address, still shows the list, and still shows the row: **all three pass on a
       * panel whose inbox can never again report a message.** This is `in-page-fill`'s `closeMessage`
       * defect in a browser tier, where a `reset()` that shed every reading was invisible to every
       * assertion about whether the message was open.
       *
       * **So the wait is on the panel's own cadence producing a listing nobody asked for. An explicit
       * press would settle nothing here**, since a destroyed session answers one; only a request nobody
       * made distinguishes the two.
       *
       * **The ceiling is `INBOX_POLL_CEILING_MS + INBOX_POLL_PROMPT_MS`, and the addition is the point.**
       * `INBOX_POLL_CEILING_MS` is *"the longest this package will wait between checks"* — so a wait of
       * exactly that length races the check it is waiting for, and `motion-and-reduced-motion` recorded
       * precisely that defect: a repair's ceiling red in six runs of ten because the wait and the poll
       * were the same length. **One more prompt interval is the shortest honest bound**, since the
       * assertion also has to *notice* the request; both terms are imported from
       * `packages/mailbox/src/cadence`, so nothing here is a number picked to be large enough.
       */
      await expect
        .poll(() => listingsMade(traffic.requested), {
          timeout: INBOX_POLL_CEILING_MS + INBOX_POLL_PROMPT_MS,
        })
        .toBeGreaterThan(listingsBefore);
    });

    test("states what was removed and that the address still works, and never says the address is gone", async () => {
      const { panel } = await stageWithTheDeviceRead(true);

      await panel.getByRole("button", { name: PANEL_COPY.removalOffers }).click();
      await panel.getByRole("button", { name: PANEL_COPY.removalConfirm }).click();
      await expect(panel.locator('[data-testid="panel-removal-removed"]')).toBeVisible({
        timeout: 20_000,
      });

      /**
       * **The claim, through a reader scoped to the removed region's own `data-testid`** — and the
       * reason for the scope is `showingLine`'s note: the address is on this panel three sections up.
       */
      const text = await removalRegionText(panel);

      expect(text).toContain(PANEL_COPY.removalDoneMeans);
      expect(text).toMatch(/still works/iu);

      /**
       * **No sentence claims the address is gone — two plain words rather than a pattern imported from
       * `panel-copy.test.ts`.** The full phrasing sweep — every sentence in the module, two named
       * patterns, two controls each — is that file's and it reads *copy*; this reads a *rendered
       * region*, and a second spelling of the same rule is what that file's own export case exists to
       * prevent. **Both words, because "no longer" is the one `mailboxGone` actually uses** and "gone"
       * is the one a copywriter reaching for the forbidden claim would reach for.
       */
      expect(text).not.toMatch(/\bgone\b/iu);
      expect(text).not.toMatch(/\bno longer\b/iu);

      /**
       * **And the reader's positive control: it returned the shipped sentences *unmodified***, read
       * **before the plant below** and asserted as an **equality against the region's own
       * paragraphs** rather than as a containment. A reader that returned every paragraph on the
       * panel would satisfy the containment assertion above and fail this one — a reader that
       * *reworded* or trimmed what it read would satisfy neither, and a region holding the two
       * sentences plus a third would too.
       *
       * **The ordering is load-bearing and it is the whole reason this assertion sits here rather
       * than at the foot of the case.** The negative control below plants into *this very region*,
       * so a positive control read after it measures the planted paragraph as though the panel had
       * shipped it — which is how this case first failed, on `toEqual` against a third paragraph
       * reading `"The address is gone."` **that the product never rendered**. A control that mutates
       * the thing a later assertion reads is not a control; it is a second subject.
       */
      expect(await removalRegionParagraphs(panel)).toEqual([
        PANEL_COPY.removalDone,
        PANEL_COPY.removalDoneMeans,
      ]);

      /**
       * **The reader's negative control, planted into the running panel** — the forbidden sentence is
       * added to the region this case just read, and the *same* reader has to report it. **Without
       * this, a reader returning the empty string for every region satisfies the two assertions above**,
       * which is the sweep that matches nothing in the direction where it looks rigorous. **It runs
       * last for the reason the positive control's note gives**, and nothing after it reads the
       * region again.
       */
      await panel.locator('[data-testid="panel-removal-removed"]').evaluate((node) => {
        const planted = node.ownerDocument.createElement("p");
        planted.textContent = "The address is gone.";
        node.appendChild(planted);
      });

      expect(await removalRegionText(panel)).toContain("The address is gone.");
    });

    test("costs no provider request and reaches no origin the tier did not script", async () => {
      const { panel, traffic } = await stageWithTheDeviceRead(true);

      /**
       * **The positive control, and it is the reason the count below means anything.** A recorder whose
       * router was never installed reports zero requests for ever, and so does a panel that reached
       * nothing — `waitForRequests` exists for this and is the file's own instrument.
       *
       * **The request that exists is this panel's own adoption of the seeded mailbox**, so the count is
       * one this panel produced rather than a floor of zero.
       */
      await waitForRequests(traffic, 1);

      const before = traffic.requested.length;

      await panel.getByRole("button", { name: PANEL_COPY.removalOffers }).click();
      await panel.getByRole("button", { name: PANEL_COPY.removalConfirm }).click();
      await expect(panel.locator('[data-testid="panel-removal-removed"]')).toBeVisible({
        timeout: 20_000,
      });

      /**
       * **An equality, and not a ceiling.** A ceiling would be satisfied by a panel that re-read the
       * provider, and *a removal is exactly the moment a panel might*, so the claim has to be that no
       * request was made at all.
       */
      expect(traffic.requested.length).toBe(before);

      /** **And the tier's standing claim, asserted over the removal's own traffic.** */
      expect(traffic.unscripted, `unscripted origins: ${traffic.unscripted.join(", ")}`).toEqual(
        [],
      );
    });

    test("offers no removal and says nothing is kept on a device that holds nothing", async () => {
      /**
       * **A plain `stage()`, and the device is empty because `afterEach` cleared it** — the file's own
       * standing rule (`tasks.md` B8). **Nothing is seeded and nothing is created**, so this is the
       * only one of the eight whose subject is a first visit rather than a held device.
       */
      const { panel } = await stage();

      await expect(panel.locator('[data-testid="panel-host"]')).toContainText(FIXTURE_HOST, {
        timeout: 20_000,
      });

      // **The device-holds-nothing shape, waited for** — a synchronous read would be reading a panel
      // whose boot read has not landed, which is the ninth scenario's subject and not this one's.
      await expect(panel.getByText(PANEL_COPY.removalHoldsNothingYet)).toBeVisible();

      await expect(panel.locator('[data-testid="panel-removal-offer"]')).toHaveCount(0);
      await expect(panel.locator('[data-testid="panel-removal-confirm"]')).toHaveCount(0);
      await expect(panel.getByRole("button", { name: PANEL_COPY.removalOffers })).toHaveCount(0);
      await expect(panel.getByRole("button", { name: PANEL_COPY.removalConfirm })).toHaveCount(0);

      /**
       * **The positive control, and it is what makes the four counts above mean anything**: the region
       * is on screen and is a region with **no button in it at all**, which is the claim — *a control
       * that cannot act is a control misreporting what is available*, so there is no disabled one
       * either. **A region that never rendered satisfies every count above.**
       */
      const regionText = await panel
        .getByText(PANEL_COPY.removalHoldsNothingYet)
        .evaluate((node) => node.closest("section")?.textContent ?? "");

      expect(regionText).toContain(PANEL_COPY.removalHeading);
      expect(
        await panel
          .getByText(PANEL_COPY.removalHoldsNothingYet)
          .evaluate((node) => node.closest("section")?.querySelectorAll("button").length ?? -1),
      ).toBe(0);
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
