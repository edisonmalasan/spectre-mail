/**
 * The in-page integration, in a real browser against a real page.
 *
 * ## What makes these cases worth the tier
 *
 * Every claim here is about **a page's own state**, and that is precisely the class of claim
 * this repository has recorded failing twice against a substitute platform. jsdom has no
 * `focus` transition worth the name and no React; the website tier found a footer inside
 * `<main>` because Testing Library mapped it to `contentinfo` unconditionally. So:
 *
 * - focus is a **real transition** (`locator.focus()`), because the claim under test includes
 *   *whether the platform fires `focusout` before the arriving `focusin`*; a spec that
 *   dispatched `focusin` alone would be assuming the ordering that hid a defect in the unit
 *   tier;
 * - the page is a **real React 19 app**, because "the value React's state holds" asserted
 *   against a hand-written controlled input would be a proxy for the thing under test;
 * - the page is **hostile on purpose**, with a firing precondition, because "the page's styles
 *   do not reach the control" is satisfied for free by a page with no styles.
 *
 * ## No provider, and no `webServer`
 *
 * Nothing here contacts a provider: the affordance inserts an address this device already
 * holds, and reading it is `chrome.storage`. The page is served by route interception on a
 * reserved `.invalid` origin — see `helpers/in-page-fixture.ts` for why, and for the recorded
 * CI hang that decided it.
 *
 * @module
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { AFFORDANCE_CREATE_LABEL } from "../src/content-script/affordance";
import {
  FIXTURE_HTTP_ORIGIN,
  FIXTURE_ORIGIN,
  LABEL,
  affordanceButton,
  affordanceComputed,
  affordanceCount,
  blurField,
  expectHostileCssActive,
  focusField,
  openFixturePage,
  pageCanSeeAffordanceButton,
  pageOwnedAffordanceButtons,
  pageOwnedButtons,
  plantEscapedAffordanceButton,
  plainEvents,
  reactState,
} from "./helpers/in-page-fixture";
import { clearStoredMailbox, resetStoredMailbox, STORED_ADDRESS } from "./helpers/stored-mailbox";

let extension: LaunchedExtension;

test.beforeAll(async () => {
  extension = await launchExtension();
});

test.afterAll(async () => {
  await extension?.close();
});

/**
 * Open the fixture with a mailbox already on this device.
 *
 * **Seed, then navigate — in that order, always.** The controller reads storage **once, at
 * boot** and does not re-read per focus (that is the design, so a rejected read is not retried
 * on every keystroke). A spec that navigated first and seeded after would be testing a
 * controller that had already decided, and would report the affordance's absence as a product
 * defect.
 *
 * **`origin` is optional and passed through unchanged**, because one case needs the same
 * fixture over `http://` - see `FIXTURE_HTTP_ORIGIN`. The default keeps every other case
 * naming nothing.
 */
async function openWithStoredMailbox(origin?: string): Promise<Page> {
  await resetStoredMailbox(extension);
  return openFixturePage(extension.context, origin);
}

test.describe("the affordance appears, and only when it can act", () => {
  test("shows nothing until an email field is focused", async () => {
    const page = await openWithStoredMailbox();

    // **The strongest form of the absence, and the one a broken reader gets wrong.** The page
    // is fully rendered and this device genuinely holds an address, so the only reason there
    // is nothing here is that nothing is focused.
    expect(await affordanceCount(page)).toBe(0);
    expect(await reactState(page, "react-input")).toBe("");
  });

  test("offers exactly one control on an empty email field", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "react-input");

    await expect(affordanceButton(page)).toHaveText(LABEL);
    expect(await affordanceCount(page)).toBe(1);
  });

  test("keeps exactly one control when focus moves between two fields", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "react-input");
    expect(await affordanceCount(page)).toBe(1);

    await focusField(page, "in-form");

    // **"Exactly one", and the defect this caught was *zero*.** `focusout` schedules a
    // deferred teardown, and a browser's focus transition is synchronous — out, then in, in
    // one task — so the teardown was landing after the arriving field's control existed and
    // removing that. The unit tier found it; a `toHaveCount(1)` assertion would have caught
    // the same zero, and this case is here so the browser tier holds it too.
    //
    // **What this cannot see is two-at-once.** The window is inside a single task, so no
    // out-of-process reader can observe it. The claim is "one after the move", not "never two".
    await expect(page.locator("[data-spectre-affordance]")).toHaveCount(1);
  });

  test("removes the control when the field loses focus", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "react-input");
    expect(await affordanceCount(page)).toBe(1);

    await blurField(page);

    await expect(page.locator("[data-spectre-affordance]")).toHaveCount(0);
  });

  test("offers nothing on a field that is not an email field", async () => {
    const page = await openWithStoredMailbox();

    // **Three recognition signals, one case each** — `type`, `autocomplete`, and the field
    // name. Any one of them on its own is the whole mechanism, so a rule matching only the
    // first would pass this file and reach the page wrongly.
    await focusField(page, "username-input");
    expect(await affordanceCount(page)).toBe(0);

    await focusField(page, "autocomplete-input");
    expect(await affordanceCount(page)).toBe(1);

    await focusField(page, "named-email");
    expect(await affordanceCount(page)).toBe(1);
  });

  test("offers nothing on a field that already holds text", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "prefilled-input");

    // **The absence is the requirement, and the value is read to prove the field really was
    // prefilled.** Without that read, a fixture that failed to set the value would satisfy
    // this assertion with an *empty* field — which is the arm two cases above requires a
    // control for.
    expect(await page.locator("#prefilled-input").inputValue()).toBe("already@typed.example");
    expect(await affordanceCount(page)).toBe(0);
  });

  test("offers to create, rather than nothing, when this device holds no stored mailbox", async () => {
    // **This case was inverted by `in-page-mailbox`, and the inversion is the slice's whole point.**
    //
    // It read "offers nothing when this device holds no stored mailbox", and the reasoning behind
    // that text is still sound: a control whose only reachable answer is "there is not an address
    // yet" is a control that cannot act, and this product does not ship those. **What changed is
    // what the control can now say.** With nothing stored it offers to *create* an address, and
    // creating one is a thing it can do - so the control is present and it can act, and the
    // requirement it was written against (`in-page-address`, slice 1) is superseded on this point
    // rather than weakened. The record is in `in-page-mailbox`'s delta.
    //
    // **The refusal half of the original rule survives, and this case still holds it.** A device
    // whose stored mailbox *cannot be read* is still offered nothing, because creation is only
    // offered to a device this product knows is empty - offering to create on a read that failed
    // would present a guess as knowledge, and would be a second mailbox on a device that already
    // has one. That case is `in-page.spec.ts`'s to keep and `entry.ts` names.
    await clearStoredMailbox(extension);
    const page = await openFixturePage(extension.context);

    await focusField(page, "react-input");

    // **The label, not the count.** "A control exists" and "a control that can act" are different
    // claims, and only the second is what this product owes: a control offering creation is
    // present *and* does something, while the control slice 1 forbade was present and did nothing.
    expect(await affordanceCount(page)).toBe(1);
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_CREATE_LABEL);
  });
});

test.describe("pressing the control inserts the address into the page's own state", () => {
  test("reaches the state a React-controlled field holds, not just its value attribute", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "react-input");
    await affordanceButton(page).click();

    // **The read-back is React's own render, not `input.value`.** A direct assignment moves
    // `value` with no framework involved, so reading it would pass on the exact mechanism
    // that makes a field submit empty — which is the failure this whole capability exists to
    // prevent. `<output data-readback>` is written by React's render of its own state.
    await expect(page.locator('[data-readback="react-input"]')).toHaveText(STORED_ADDRESS);
    expect(await reactState(page, "react-input")).toBe(STORED_ADDRESS);
  });

  test("reaches a plain field and dispatches the events the page listens for", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "plain-input");
    await affordanceButton(page).click();

    expect(await page.locator("#plain-input").inputValue()).toBe(STORED_ADDRESS);

    // **The events, recorded by the page's own listeners** — the fixture appends to the
    // document, because the content script's isolated world cannot read the page's globals.
    // `input` alone would satisfy a React-controlled field and leave most other forms
    // untouched; the requirement is both, so both are required here.
    await expect.poll(() => plainEvents(page)).toEqual(["input", "change"]);
  });

  test("does not submit the form the field belongs to", async () => {
    const page = await openWithStoredMailbox();

    // **A positive control first, and it is the half that was missing.** Without it this case
    // asserts only that the attribute is absent, which is also what a fixture whose form never
    // fires would produce. So: plant a real `type="submit"` button inside the very same form,
    // press it, and require the attribute to appear. **If that control does not fire, this case
    // is not measuring anything and must not be reported as coverage.**
    await page.evaluate(() => {
      const probe = document.createElement("button");
      probe.id = "submit-probe";
      probe.type = "submit";
      probe.textContent = "probe";
      // **The override is load-bearing, and it is the fixture's own hostility that requires it.**
      // This page links `button { display: none !important }` on purpose — that is D6's measured
      // precondition — so a button planted into the page is invisible and Playwright refuses to
      // press it. The affordance is unaffected because it lives in a shadow root the sheet cannot
      // reach, which is the property under test elsewhere in this file.
      probe.style.setProperty("display", "inline-block", "important");
      document.getElementById("the-form")?.append(probe);
    });
    await page.locator("#submit-probe").click();
    expect(await page.evaluate(() => document.documentElement.dataset["formSubmitted"])).toBe(
      "true",
    );

    // Start from a clean slate for the claim under test.
    await page.evaluate(() => {
      document.documentElement.removeAttribute("data-form-submitted");
      document.getElementById("submit-probe")?.remove();
    });

    await focusField(page, "in-form");
    await affordanceButton(page).click();

    // **Asserted on the document attribute the form's own `onSubmit` sets.** A `<button>` with
    // no `type` defaults to `submit`, and this one is injected next to a field *inside* a
    // form, so the whole difference between the two lives in one attribute the affordance
    // sets.
    expect(await page.evaluate(() => document.documentElement.dataset["formSubmitted"])).toBe(
      undefined,
    );
  });

  test("leaves nothing behind once it has acted", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "react-input");
    await affordanceButton(page).click();

    // **Absent, not disabled.** A stale control on a field that now holds the address would
    // be a control offering to overwrite what it just wrote.
    await expect(page.locator("[data-spectre-affordance]")).toHaveCount(0);
  });
});

test.describe("the page can neither style nor reach the control", () => {
  test("the page's own rules do not apply to the control", async () => {
    const page = await openWithStoredMailbox();

    // **The firing precondition, first and explicitly.** The fixture links a hostile sheet
    // that hides every button; the probe version of this fixture served such a sheet and
    // never linked it, so the isolation claim was true for the wrong reason. This reads the
    // **page's own** button, because that is the only element the page's rule is meant to
    // reach.
    await expectHostileCssActive(page);
    await focusField(page, "react-input");

    // **Both halves, and they are different claims.** `display: none !important` not applying
    // is isolation by cascade; `transform` and `color` not applying is isolation of the same
    // rule's other declarations. Asserting one and calling it "the page's styles do not
    // reach it" would be the narrower claim wearing the wider one's words.
    expect(await affordanceComputed(page, "display")).toBe("inline-block");
    expect(await affordanceComputed(page, "transform")).toBe("none");
    expect(await affordanceComputed(page, "color")).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("the page's document text does not grow the control's label", async () => {
    const page = await openWithStoredMailbox();

    // **Asserted both ways, and the "before" read is what makes the "after" one mean
    // something.** A sweep that only reported the label absent after focus would also pass on
    // a page that never contained it — and the fixture's own `<h1>` and `<label>`s give it
    // plenty of text to be absent from.
    const before = await page.evaluate(() => document.body.textContent ?? "");
    expect(before).not.toContain(LABEL);

    await focusField(page, "react-input");
    expect(await affordanceCount(page)).toBe(1);

    const after = await page.evaluate(() => document.body.textContent ?? "");
    expect(after).not.toContain(LABEL);

    // And the control genuinely carries it, so the two assertions above are not both
    // satisfied by a control with no label at all.
    await expect(affordanceButton(page)).toHaveText(LABEL);
  });

  test("runs on the origin the suite serves, which the manifest declares", async () => {
    const page = await openWithStoredMailbox();

    // **A precondition, named because every other case in this file rests on it.**
    //
    // A content script runs only where the manifest's `matches` covers the URL. If the page
    // under test were on an origin those patterns did not cover, **every absence assertion in
    // this file would pass for the wrong reason** — a content script that never ran looks
    // exactly like one that correctly refused. That is the failure this case exists to make
    // impossible to mistake, and it is the reason the fixture serves a real `https://` origin
    // rather than `about:blank`.
    //
    // **What the patterns themselves are is asserted in `manifest.spec.ts`**, against the built
    // file. Re-deriving Chromium's match-pattern rules here to check them a second time would
    // be a hand-rolled engine answering a question the platform answers — a proxy, in the one
    // place a proxy would be least noticed.
    const url = page.url();
    expect(url.startsWith("https://")).toBe(true);
    expect(url.startsWith(`${FIXTURE_ORIGIN}/`)).toBe(true);

    // **And it is running here**, which is the half no declaration can establish.
    await focusField(page, "react-input");
    expect(await affordanceCount(page)).toBe(1);
  });

  test("runs on a plain-http page too, which is the second scheme the manifest declares", async () => {
    // **The other half of the declared reach, established by the platform rather than read.**
    //
    // `content_scripts.matches` is `["http://*/*", "https://*/*"]`. Every other case in this
    // file runs on `https://in-page.invalid`, so on the shipped suite **half the declaration
    // was evidence-free**: `http://*/*` was in the file and nothing had ever shown the
    // content script running because of it. A declaration nobody has exercised is a claim
    // with no measurement under it, and this is the case that gives it one.
    //
    // **It matters because the failure is silent and one-sided.** If the platform ever
    // stopped injecting on `http://`, the affordance would simply not appear on plain-http
    // pages — and no `https` case in this file would notice, because nothing here would be
    // looking. That is the recorded "a content script that never ran looks exactly like one
    // that correctly refused" shape, reached from a different door.
    //
    // **The same fixture and the same assertions**, over `http://`, because the point is the
    // scheme and nothing else about the page.
    const page = await openWithStoredMailbox(FIXTURE_HTTP_ORIGIN);

    expect(page.url().startsWith(`${FIXTURE_HTTP_ORIGIN}/`)).toBe(true);

    // **Nothing until focus, and one control after it** — so this is a working injection
    // rather than a script that loaded and did nothing.
    expect(await affordanceCount(page)).toBe(0);
    await focusField(page, "react-input");
    expect(await affordanceCount(page)).toBe(1);

    // **And it inserts**, because a script that injected and could not act would be a
    // control that cannot act - the thing `AGENTS.md` names as what this product does not
    // ship.
    await affordanceButton(page).click();
    await expect(page.locator('[data-readback="react-input"]')).toHaveText(STORED_ADDRESS);
  });

  test("the page's own queries cannot see the control", async () => {
    const page = await openWithStoredMailbox();

    await focusField(page, "react-input");
    expect(await affordanceCount(page)).toBe(1);

    // **Read through the page, not through Playwright.** Playwright's CSS engine pierces open
    // shadow roots, so a locator would report the affordance and this requirement could never
    // fail. The page's `querySelectorAll` is the only reader that answers it as the page would
    // ask it — and the count is asserted as a **number**, because the fixture has two buttons
    // of its own and a reader that matched nothing at all would look identical to one that
    // was looking in the right place.
    expect(await pageCanSeeAffordanceButton(page)).toBe(false);
    expect(await pageOwnedAffordanceButtons(page)).toBe(0);
    expect(await pageOwnedButtons(page)).toBe(2);
  });

  test("the page's own queries would notice a control that had escaped", async () => {
    const page = await openWithStoredMailbox();

    // **The negative control, and it is the only thing that makes the case above an
    // assertion.** A plain button is planted carrying the affordance's own attribute, in the
    // light DOM; if the readers below reported zero whether or not that button existed, the
    // isolation case would have been satisfied by a sweep matching nothing — which is the
    // recorded defect a positive control exists to prevent.
    await plantEscapedAffordanceButton(page);
    await focusField(page, "react-input");

    // Both readers now see the planted escape, which is what makes their silence above mean
    // something.
    expect(await pageCanSeeAffordanceButton(page)).toBe(true);

    // **One, not two — and the number is the whole point.** The page's own
    // `querySelectorAll` does not pierce shadow roots, so it sees the planted light-DOM button
    // and *not* the affordance's real one. **The first version of this case expected 2**, on the
    // reasoning that both controls existed; it is a red that says the reader works, because it
    // counts the escape and excludes the shadow — which is precisely the discrimination being
    // claimed, arrived at by miscounting rather than by reading.
    expect(await pageOwnedAffordanceButtons(page)).toBe(1);

    // And the page's own button count moves by exactly one, because the affordance's button was
    // never in that count to begin with.
    expect(await pageOwnedButtons(page)).toBe(3);
  });
});
