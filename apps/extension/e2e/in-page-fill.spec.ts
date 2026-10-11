/**
 * The whole delivery, end to end, in a real Chromium.
 *
 * ## What only this tier can answer
 *
 * Every link in the chain is a fact about **two extension contexts talking to each other**, and
 * nothing above the browser can hold it:
 *
 * 1. **the popup's control is the only thing that starts the delivery.** Opening a message, reading
 *    a code, and rendering a button are all things a component test can do in jsdom; deciding to
 *    write to somebody else's page is not one of them.
 * 2. **`chrome.tabs.sendMessage` reaches a content script on an origin with no host permission.**
 *    `design.md` D1 measured that it does, with `permissions: ["storage"]` alone — and a jsdom test
 *    installs the API it wished for, so it would report the same thing either way.
 * 3. **the write lands in a real React 19 field's state.** `in-page.spec.ts` records the two
 *    substitute-platform defects that make this the interesting tier, and the same shape applies
 *    here: a hand-written controlled input would be a proxy for the thing under test.
 * 4. **the page is hostile.** `in-page.spec.ts` links `button { display: none !important }` on
 *    purpose, so the asking control's styles are read against a page actively trying to reach them.
 *
 * ## What this does not establish, and the list is the point
 *
 * - **Nothing about a real action popup window.** `chrome.action.openPopup()` was measured on
 *   2026-10-10 and `context.pages()` was **identical before and after** — headless Chromium
 *   surfaces no page object for it, and `chrome.extension.getViews` does not exist in MV3. So the
 *   popup is opened as a **document at its own origin**, which is the same module and the same
 *   bundle; the one link this cannot hold is Chromium's own toolbar button, which is not this
 *   repository's code. `popup.spec.ts` already runs every other popup claim that way.
 * - **Nothing about a per-frame delivery.** The manifest declares no `all_frames`, so this file
 *   has no frame to deliver to, and `in-page.spec.ts`'s frame cases exercise the *address* control
 *   rather than this one. The refusal is unit-tested through an injected `view`; see
 *   `design.md` D4.
 * - **Nothing about a real signup page.** Every field here is one this repository wrote, and the
 *   recogniser's whole reason for existing is that real forms do not declare anything.
 * - **Nothing about a live provider.** Every response is recorded; see `recorded-provider.ts`.
 *
 * @module
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { recordProviderTraffic, FIXTURE_IDS } from "./recorded-provider";
import type { ProviderTraffic } from "./recorded-provider";
import {
  FIELD_CHOICE_HOST_ATTRIBUTE,
  FIELD_CHOICE_OPTION_ATTRIBUTE,
} from "../src/content-script/affordance";
import { clearStoredMailbox } from "./helpers/stored-mailbox";
import {
  armBackgroundAlarm,
  clearArmedAlarms,
  readArmedAlarms,
  waitForTheArmingThenDisarm,
} from "./helpers/background-state";
import { BACKGROUND_ALARM_NAME } from "../src/alarms";
import { INBOX_POLL_CEILING_MS, INBOX_POLL_PROMPT_MS } from "@spectre-mail/mailbox";
import {
  openFixturePage,
  plantSecondCodeField,
  reactState,
  removeFixtureCodeField,
} from "./helpers/in-page-fixture";

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
 * **This is not tidiness; it is a precondition the delivery depends on.** `findActiveTab` asks for
 * the *active* tab of the *current* window, so a page left open and left focused from a previous
 * case would answer the next case's delivery. The recorded precedent for a suite whose pass/fail
 * depends on run order is `popup.spec.ts`'s storage reset, and this is the same shape in a
 * different place.
 */
const opened: Page[] = [];

test.afterEach(async () => {
  for (const page of opened.splice(0)) {
    await page.close().catch(() => undefined);
  }

  /**
   * **The alarm is cleared after every case, and this file now has a case that arms one on purpose.**
   *
   * `stage()` disarms it because creating an address arms it, but a *deliberate* arming outlives the
   * case that asked for it in exactly the way the recorded late-answer rule describes: the worker
   * outlives the document. Without this line the control below would keep listing into the next case's
   * log, and the next case would fail for a reason that has nothing to do with what it is about.
   */
  await clearArmedAlarms(extension);
});

/** One delivery, staged but not performed. */
interface Staged {
  /** The real page, with the content script injected into it. */
  readonly page: Page;
  /** The popup, with the message open and the fill control on screen. */
  readonly popup: Page;
  /** The code the recorded provider sent, read from what the popup rendered. */
  readonly code: string;
  /** The control that starts the delivery, located by the row that shows this code. */
  readonly control: ReturnType<Page["locator"]>;
  /** What the provider was sent while staging, read afterwards. */
  readonly traffic: ProviderTraffic;
}

/**
 * Stage a delivery: a real page, a popup that has a message open, and nothing sent.
 *
 * ## The order of the last three steps, and it is load-bearing
 *
 * **The page is brought to the front *last*.** `findActiveTab` reads the active tab of the window
 * the popup's document is in, and a popup opened as a *tab* is its own active tab — measured on
 * 2026-10-10, where a popup document reported its own tab id and `sendMessage` to it answered
 * `{where:"content", hasTabs:false}`. So the page must be frontmost at the moment of the press,
 * which is also the truth about a real popup: the page the user was looking at is the active tab,
 * and the popup is a panel over it rather than a tab beside it.
 *
 * **The two documents are tabs in the same window**, which is what makes `currentWindow` the right
 * question. `context.newPage()` opens in the context's window, and the fixture page and the popup
 * are both created that way, so nothing here has to say so.
 */
async function stage(): Promise<Staged> {
  await clearStoredMailbox(extension);
  const traffic: ProviderTraffic = await recordProviderTraffic(extension.context);
  // **Read once, in the middle of the staging, so the assertions can ask what the provider was
  // sent** rather than only what the page ended up holding.
  expect(traffic.unscripted).toEqual([]);

  const page = await openFixturePage(extension.context);
  opened.push(page);

  const popup = await extension.context.newPage();
  opened.push(popup);
  await popup.goto(`chrome-extension://${extension.extensionId}/popup.html`);
  await expect(popup.getByRole("button", { name: "Create an address" })).toBeVisible();

  await popup.getByRole("button", { name: "Create an address" }).click();
  await expect(popup.locator(".popup__address")).toHaveText(/@uberip\.com$/);

  /**
   * **The background check is disarmed here, and this line is the repair for a defect this milestone
   * authored.**
   *
   * **The press above is what arms the alarm.** `incoming-mail-notification` made the popup ask the
   * worker to reconcile after its own write (`design.md` D14), so creating an address now schedules a
   * 5 000 ms wake — and this file's cases assert on an **exact count** of provider requests. A wake
   * landing inside a case adds a listing to the log, and the count stops being the count the case
   * meant.
   *
   * **It was measured rather than reasoned, and the measurement changed the shape of the defect.**
   * A full-suite run failed `reads a message it has already opened for no second request` with
   * `Expected: 1, Received: 3` — three listings, which is one plus two wakes. **Twenty runs of this
   * spec alone were green**, so the first reading — a background wake from another spec, since specs
   * share a process — was wrong: each launch takes its own profile directory. The failing case's own
   * **duration** is the answer: **12.5 s against a 5 000 ms period**, so it was never a race. It is
   * **deterministic once the case runs longer than one period**, and a loaded machine is what makes
   * it run that long. **An assertion whose validity depends on the case finishing faster than a
   * period is a precondition the product controls and the spec did not.**
   *
   * **So the count is made independent of the machine rather than the window made longer.** Raising the
   * ceiling, or relaxing `toBe(1)`, would be the recorded defect with a larger constant: a wake
   * polluting the count would still read green. **Disarming removes the wake from the subject**, and
   * `background-check.spec.ts` is where the alarm is the subject.
   *
   * **And the first version of that line was a race, which the thirty-run block below found.** It
   * called `clearArmedAlarms` as soon as the address appeared — and the address appears when
   * `session.open()` publishes `ready`, which is *before* the press reaches
   * `await requestBackgroundAlarm()`. So the clear was issued while the arming was still travelling
   * to the worker, and the worker armed a moment afterwards. **Thirty consecutive runs came back 18
   * green and 12 red**, every red the same single case failing on its own assertion that nothing was
   * armed: the control was reporting that the repair was a race, not that the product was broken.
   * **A race is decided by which side is slower, so it is decided by machine load** — and the
   * pre-repair baseline was one red in forty-six attempts. The wait is `waitForTheArmingThenDisarm`,
   * which reads the alarm back until it is armed *and then* clears, so the clear cannot lose at any
   * load. See `helpers/background-state.ts` for why the popup's screen state cannot stand in for it.
   */
  await waitForTheArmingThenDisarm(extension, INBOX_POLL_CEILING_MS);
  // **A check the user asked for, and the honest limitation this file is named for.** Nothing polls
  // on its own — with the background check disarmed above, the only provider requests in this file are
  // the ones a case asked for — so a code is available only after someone pressed this. The press is
  // here rather than assumed so that the whole chain is a delivery a person started.
  await popup.getByRole("button", { name: "Check for mail" }).click();
  await expect(popup.locator('[data-testid="message-list"]')).toBeVisible();

  await popup.getByRole("button", { name: "Read" }).click();
  await expect(popup.locator('[data-testid="code-list"]')).toBeVisible();

  /**
   * **The code is read from the page, never typed here.**
   *
   * The recorded fixture carries `493028`, and writing that literal into this file would give it a
   * second copy of the value the provider sent — which is the recorded `popup.spec.ts` defect
   * twice over. So the case reads what the popup rendered and requires it to look like a code.
   */
  const code = (
    (await popup.locator('[data-testid="code-list"] code').first().textContent()) ?? ""
  ).trim();
  expect(code).toMatch(/^\d{6}$/);

  /**
   * **The control is located through the row that shows this code, not by its name.**
   *
   * Two independent claims live here and they are worth keeping apart: the row is found by what it
   * displays (so a control carrying the wrong code would not be found at all), and its **accessible
   * name is asserted separately** below — against a template written here, because an expectation
   * built from `POPUP_COPY_TEMPLATES` would move when the copy moves and could not fail.
   */
  const control = popup
    .locator('[data-testid="code-list"] li', { hasText: code })
    .getByRole("button");
  await expect(control).toBeVisible();
  expect(await control.textContent()).toBe(`Fill in code ${code}`);

  await page.bringToFront();

  return { page, popup, code, control, traffic };
}

test.describe("a code reaches a page, and only because a person pressed something", () => {
  /**
   * **The positive control for the disarm every other case in this file depends on, and it is first
   * so the count below is read against a file that has just proved it can be wrong.**
   *
   * **What it establishes.** Arm the alarm the way the product arms it, confirm the platform accepted
   * it, and require a listing that nobody asked for to appear in this file's own request log. **That
   * listing is the thing `reads a message it has already opened for no second request` counts against**
   * — and the run that found the defect saw three where it expected one.
   *
   * **Why it is here and not a mutation arm.** The defect presented as *one red in thirty-one*: green
   * in twenty isolated runs of this spec, red once under a loaded machine, with the failing case's own
   * duration - **12.5 s against a 5 000 ms period** - naming the cause. **No repetition can settle
   * that**, and a mutation arm pointed at the same count would inherit the same dependence on how long
   * the case happens to take. Arming the alarm deliberately removes the dependence: the wait below is
   * a full ceiling, so the wake is *certain* rather than *likely*.
   *
   * **And it cannot pass vacuously.** `armBackgroundAlarm` only calls `chrome.alarms.create`, which
   * reports no error for a period it will not accept, so the next line reads the alarm back through
   * the platform before anything is waited for. **A control that could be satisfied by the alarm never
   * being armed would leave the disarm unfalsified, which is the state this case exists to prevent.**
   *
   * **The ceiling is the cadence's, not a number chosen to be large enough** - `INBOX_POLL_CEILING_MS`
   * is the same six periods `background-check.spec.ts` waits for a wake to be *askable*, so this case
   * and that file are waiting for the same thing by the same derivation.
   */
  test("counts a listing nobody asked for, once the background check is armed", async () => {
    const { traffic } = await stage();

    const listings = () =>
      traffic.requested.filter((url) => url.includes("/messages?page=1")).length;
    const asked = listings();

    /**
     * **The disarm itself, asserted rather than assumed - and this line is what makes the repair
     * falsifiable at all.**
     *
     * Arming the alarm below proves a wake *would* pollute this log. It says nothing about whether
     * `stage()`'s disarm works, and the defect it repairs appeared **once in thirty-one runs** - so an
     * arm that removed the disarm and waited for the count to break would inherit exactly the
     * dependence on machine load that made the defect hard to see in the first place, and would read
     * green on a fast machine while the repair was silently absent.
     *
     * **This assertion has no such dependence.** `chrome.alarms.clearAll` either cleared this
     * extension's alarm or it did not, and the platform answers immediately. A `stage()` without the
     * disarm leaves the alarm armed, this reads one name where it requires none, and the case fails on
     * that line - **in under a second, every run, on any machine.** A disarm that had been deleted, or
     * written against the wrong name, cannot survive this.
     */
    expect(await readArmedAlarms(extension)).toEqual([]);

    await armBackgroundAlarm(extension, BACKGROUND_ALARM_NAME, INBOX_POLL_PROMPT_MS / 60_000);

    /** **Read back before waiting**, so a refusal cannot be waited out and reported as a wake. */
    expect(await readArmedAlarms(extension)).toEqual([BACKGROUND_ALARM_NAME]);

    await expect.poll(listings, { timeout: INBOX_POLL_CEILING_MS }).toBeGreaterThan(asked);
  });

  /**
   * **The positive control for this file's zero, and the second of the file's two controls.**
   *
   * **"Second", and that is a correction rather than a decoration.** This case said *it is the first
   * case* for as long as it existed, and it stopped being true when the disarm control above was
   * added. Two blocks each claiming to be first is a contradiction a reader hits immediately, and a
   * case that has quietly stopped being where its comment says it is is the recorded supersession
   * defect wearing a different hat.
   *
   * **The two controls are not the same claim, which is why there are two.** The one above says *the
   * alarm can pollute this log* — the wake is real and this file must not have one. This one says
   * *this file's zero is a measurement* — a zero that nothing else makes non-zero is not one, and the
   * non-zero here is already in the record, because staging the delivery required opening the
   * message once.
   *
   * `packages/mailbox` retains an analysis it has already paid for, so reading the same message
   * twice costs one request rather than two.
   */
  test("reads a message it has already opened for no second request", async () => {
    const { popup, traffic } = await stage();

    // **The non-zero, established before the case does anything at all.**
    const fetches = () =>
      traffic.requested.filter((url) => url.includes(`/messages/${FIXTURE_IDS.mailtm.messageId}`))
        .length;
    expect(fetches()).toBe(1);

    await popup.getByRole("button", { name: "Close" }).click();
    await expect(popup.locator('[data-testid="code-list"]')).toHaveCount(0);

    await popup.getByRole("button", { name: "Read" }).click();
    await expect(popup.locator('[data-testid="code-list"]')).toBeVisible();

    // **Still one**, and the id comes from the recorded fixture rather than a literal here.
    expect(fetches()).toBe(1);
    // **And the listing was not re-fetched either**, because the retention is the session's and
    // the session kept that too.
    expect(traffic.requested.filter((url) => url.includes("/messages?page=1")).length).toBe(1);
  });

  test("writes the code into the page's own field, and into React's state for it", async () => {
    const { page, popup, code, control } = await stage();

    // **Nothing has been sent.** This is asserted on the *page*, not on a message log: the claim
    // is that the code is not in the field yet, and the field is what a user would look at.
    await expect(page.locator("#code-input")).toHaveValue("");
    expect(await reactState(page, "code-input")).toBe("");

    await control.click();

    // **The popup's own sentence first**, because a fill reported in the popup and absent from the
    // page is the failure mode a claim about "the delivery works" would miss.
    await expect(popup.getByRole("status")).toHaveText("The code is in the page.");

    // **The field's value *and* React's state**, in that order. The value alone would be satisfied
    // by any write; React's state is what makes the next render keep it.
    await expect(page.locator("#code-input")).toHaveValue(code);
    await expect(page.locator('[data-readback="code-input"]')).toHaveText(code);

    // **The field the recogniser must refuse is still empty.** `discountCode` carries the word
    // `code` as a whole word, so a recogniser that stopped at "the name contains a code word"
    // would have put a verification code into a checkout field, and this page is built so that
    // possibility has somewhere to go.
    await expect(page.locator("#discount-input")).toHaveValue("");
    expect(await reactState(page, "discount-input")).toBe("");

    // **And nothing was submitted.** A signup form does not stop at the first field, so a fill
    // that also submitted would have been acting on the page rather than on the field.
    expect(
      await page.evaluate(() => document.documentElement.getAttribute("data-form-submitted")),
    ).toBeNull();
  });

  test("writes nothing until the control is pressed", async () => {
    const { page, popup } = await stage();

    // **The message is open, the code is on screen, and the page is frontmost — and the field is
    // still empty.** A fill that fired on opening, or on the popup appearing, is satisfied by
    // every other case in this file passing while this one fails.
    await expect(popup.locator('[data-testid="code-list"]')).toBeVisible();
    expect(await reactState(page, "code-input")).toBe("");

    // **And no asking control was drawn**, which is the other half: a page the user is reading
    // must not grow a control because a message was opened somewhere else.
    await expect(page.locator(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`)).toHaveCount(0);
  });

  test("asks which field, and fills nothing until the person chooses", async () => {
    const { page, code, control } = await stage();

    // **A second qualifying field, added by this case and only this case.** The fixture carries
    // exactly one on purpose; see `plantSecondCodeField`.
    expect(await plantSecondCodeField(page)).toBe(2);

    await control.click();

    // **The asking control, inside the page**, drawn in a shadow root the page's own hostile
    // stylesheet cannot reach.
    const host = page.locator(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`);
    await expect(host).toHaveCount(1);

    // **Nothing has been filled — not into the declared field, not into the named one.** This is
    // the claim the whole asking rule exists for, and it is asserted on both fields rather than on
    // "the page is unchanged", which a control that had filled and then undone would also satisfy.
    await expect(page.locator("#code-input")).toHaveValue("");
    await expect(page.locator("#planted-code")).toHaveValue("");

    /**
     * **The two options, chosen by what each field's own `name` says.**
     *
     * A real form names its fields, and a person choosing between two boxes on a screen wants to
     * know which box is which. The fixture's own field is `name="otp"` and the planted one is
     * `name="verification_code"` — read off the page rather than assumed here, because a spec that
     * restates a field's name holds a second copy of the fixture's markup.
     */
    const options = host.locator(`[${FIELD_CHOICE_OPTION_ATTRIBUTE}]`);
    await expect(options).toHaveCount(2);
    const planted = page.locator("#planted-code");
    const plantedName = await planted.getAttribute("name");
    // **Narrowed by throwing rather than by a fallback.** `expect(x).not.toBeNull()` does not
    // narrow for the compiler, and the two available workarounds are both worse: `?? ""` would let
    // the case pass an empty substring, and a cast would assert nothing.
    if (plantedName === null) {
      throw new Error("the planted field carried no name attribute");
    }
    await expect(options.nth(1)).toContainText(plantedName);

    await options.nth(1).click();

    // **The chosen field holds the code; the other is still empty.** One activation by the user,
    // one field written, and the decision was theirs.
    await expect(planted).toHaveValue(code);
    await expect(page.locator("#code-input")).toHaveValue("");

    // **And nothing outlives its answer**, in the page as well as in the module.
    await expect(host).toHaveCount(0);
  });

  test("says the page has no such field, rather than reporting nothing happened", async () => {
    const { page, popup, control } = await stage();

    // **The fixture's own code field, removed** — so this page still has the content script and
    // still answers, which is what separates `noField` from a page that never replied at all.
    expect(await removeFixtureCodeField(page)).toBe(true);

    await control.click();

    // **The refusal is specific.** "Could not confirm" would be true and useless here: the page
    // did answer, and what it said is that there was nothing to fill.
    await expect(popup.getByRole("status")).toHaveText("That page has no one-time-code field.");
    await expect(page.locator("#discount-input")).toHaveValue("");
  });

  test("says it could not confirm when the page it is looking at cannot answer", async () => {
    const { popup, control } = await stage();

    // **A tab with no content script, frontmost.** `about:blank` is the shortest way to be a tab
    // this extension does not run in, and it is a *real* tab in the real window — so the popup's
    // own `findActiveTab` succeeds and the delivery genuinely fails at the next step.
    const silent = await extension.context.newPage();
    opened.push(silent);
    await silent.goto("about:blank");
    await silent.bringToFront();

    await control.click();

    // **The distinction from the previous case is the whole point of this one.** A page that
    // answered `noField` and a page that answered nothing both end with nothing in a field, and
    // only one of them is something the popup could have said something useful about.
    await expect(popup.getByRole("status")).toHaveText(
      "Could not confirm the code went into the page.",
    );
  });
});

/**
 * The permission the delivery did **not** need, read from the artefact that ships.
 *
 * ## Why `getManifest()` and not the source file
 *
 * **The source `static/manifest.json` is what was written; `chrome.runtime.getManifest()` is what
 * Chromium parsed.** Reading the file would prove a fact about the repository, and the requirement
 * is about what a user's browser will grant — a build that dropped or added a permission on the way
 * through would leave the file unchanged. `manifest.spec.ts` reads the built file; this reads the
 * running extension, and the two are deliberately different instruments.
 *
 * **Written out as literals, and that is the point.** An expectation that imported the manifest
 * module would move when the manifest moved. These two lines are the requirement: the delivery
 * works on `storage` alone, and the only host permissions are the two provider origins this
 * extension already reached before this milestone.
 *
 * ## Amended during `incoming-mail-notification`, and the amendment is a narrower claim rather than
 * a flipped one
 *
 * **This case asserted `permissions` equalled `["storage"]` exactly, and that assertion became
 * false** — the notification slice added `alarms` and `notifications`. It is the **second** place
 * holding the exact list, and `incoming-mail-notification`'s task 6.2 updated the first
 * (`manifest.spec.ts`, which reads the *built file*) without reaching this one.
 *
 * **The direction of this repair matters, because a case that flips with no note attached is the
 * recorded `in-page-fill` supersession defect.** Nothing was inverted: the claim this case exists to
 * make is about *the fill path*, not about the manifest being frozen, and that claim is unchanged —
 * the delivery still works on `storage` alone, and it still reaches no host this milestone did not
 * already reach. What is removed is the **exact-list** assertion, because **the exact list is now a
 * property of the milestone in progress rather than of this feature**, and `manifest.spec.ts` holds
 * it. **`storage` is now required to be present rather than to be alone**, which is strictly what
 * this case can honestly say.
 */
test("added no permission, in the manifest the browser actually parsed", async () => {
  const manifest = await extension.worker.evaluate(() =>
    (
      globalThis as unknown as {
        chrome: {
          runtime: { getManifest(): { permissions?: string[]; host_permissions?: string[] } };
        };
      }
    ).chrome.runtime.getManifest(),
  );

  // **`toContain("storage")` rather than an equality, and the header above says why.** The
  // permissions this manifest carries are the union of every milestone's, and `manifest.spec.ts`
  // holds that list; what this case can honestly say is that the in-page delivery's own permission
  // is still there and nothing below was taken with it.
  expect(manifest.permissions).toContain("storage");
  expect(manifest.host_permissions).toEqual([
    "https://api.mail.tm/*",
    "https://api.guerrillamail.com/*",
  ]);
  // **`tabs` is named, because it is the permission this feature could most plausibly have needed.**
  // It grants nothing to read a URL — D1 measured `tab.url` as `undefined` — but a *list* of this
  // extension's own tabs, and a milestone that had added it would have bought a capability nobody
  // here asked for.
  expect(manifest.permissions).not.toContain("tabs");
  // **`scripting` and `activeTab` are named beside it, for the reason `manifest.spec.ts` gives**
  // and not for this file's own: both would have let the popup reach a page it is not injected into,
  // which the D1 measurement rejected for this extension's whole design. **A case that checks one
  // absent permission reads as a check of absence**, and the three are one claim.
  expect(manifest.permissions).not.toContain("scripting");
  expect(manifest.permissions).not.toContain("activeTab");
});
