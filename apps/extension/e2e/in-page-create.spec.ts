/**
 * Creating a mailbox from inside somebody else's page, in a real browser.
 *
 * ## Why these cases exist at all, given that the unit tier covers the same claims
 *
 * Because **every one of this slice's claims is about the platform, and no substitute platform
 * can answer any of them.** The unit tier proves the controller asks for a mailbox, that it
 * distinguishes the four answers, and that its ceiling re-reads this device's storage — against
 * an injected `createMailbox`. Every claim below is about the three links between that seam and
 * a real address:
 *
 * 1. **a content script may not make the request**, so the request is delegated (measured,
 *    `docs/PROVIDERS.md` §4.4), and that is asserted here by making the **page** attempt the
 *    identical request and watching it be refused;
 * 2. **the worker's request is reachable by this tier's recorder**, which is what keeps the
 *    whole suite offline;
 * 3. **the worker's own storage is the device's storage**, so the address the field received and
 *    the record on the device are the same value.
 *
 * A unit test with an injected seam is blind to all three, and the first two have both been
 * surprising — one refused where the architecture assumed it would work, and one refused because
 * a recorder was scoped to pages.
 *
 * ## What this tier still does not establish
 *
 * **Every provider response here is a recorded one**, so nothing establishes how a provider
 * responds to being asked to create a mailbox, nor how long that takes — which is exactly why
 * the content script's ceiling is a declared choice of this product's rather than a measurement,
 * and why the case that crosses it is the slowest in the suite. **And no assertion here reads a
 * rendered pixel**, so how the control looks while it waits is still a human judgement.
 *
 * @module
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { MAILTM_ACCOUNTS, recordProviderTraffic } from "./recorded-provider";
import type { ProviderTraffic, RecordingOptions } from "./recorded-provider";
import {
  AFFORDANCE_BUTTON_SELECTOR,
  FIXTURE_ORIGIN,
  affordanceButton,
  affordanceCount,
  blurField,
  focusField,
  openFixturePage,
  reactState,
} from "./helpers/in-page-fixture";
import type { FixturePageOptions } from "./helpers/in-page-fixture";
import {
  AFFORDANCE_CREATE_LABEL,
  AFFORDANCE_LABEL,
  AFFORDANCE_UNCONFIRMED_LABEL,
  AFFORDANCE_WAITING_LABEL,
} from "../src/content-script/affordance";
import { IN_PAGE_CREATE_CEILING_MS } from "../src/content-script/create-wait";
import { EXTENSION_PROVIDER_IDS } from "../src/provider-config";
import {
  clearStoredMailbox,
  readStoredMailboxAddress,
  readStoredMailboxRecord,
} from "./helpers/stored-mailbox";

let extension: LaunchedExtension;
let traffic: ProviderTraffic;

/**
 * Every recorder this file has installed, newest last.
 *
 * **A case that needs two requests cannot use one recorder, and the reason is worth recording.**
 * `resetToFirstVisit` installs a fresh `context.route` per call, and Playwright matches the
 * **most recently registered** handler first — so a second call shadows the first and the two
 * recorders' arrays are disjoint. The first version of the retention case therefore counted one
 * creation after making two, and the failure read as a product that had refused to ask the
 * provider twice. Keeping the retired recorders is what makes a count *across* pages mean what it
 * says; without it the honest assertion would have been "this page's recorder saw one", which is
 * true of every case here and therefore evidence about nothing.
 *
 * **The array is cleared between cases** in `beforeEach`, so a case cannot inherit the counts its
 * predecessor happened to make.
 */
const recorders: ProviderTraffic[] = [];

/** Every page this file opened, so `afterEach` can close them. */
const opened: Page[] = [];

/**
 * Close every page this case opened.
 *
 * **A leak here is not tidiness, it is a correctness hazard, and this file learned that the hard
 * way.** The extension's context and its `chrome.storage` are per *file*, not per case, so a page
 * left open is a content script left listening on a document nothing will ever read again — and,
 * worse, a request it made is still in flight. A case that releases a gate and returns without
 * waiting for the answer leaves the harness fulfilling a provider request and the worker writing a
 * mailbox **after** the next case has already cleared storage and booted its page. The next case
 * then finds an address it did not create, offers insertion where it meant to offer creation, and
 * fails on an assertion that says nothing about itself.
 *
 * **Closing the page does not fix that, and the reason matters.** By the time `afterEach` runs, the
 * request has already been dispatched to the worker; closing the document cannot recall it. So the
 * cases that release a gate must also **wait for the write to land** — see the "could not confirm"
 * case, which does so and thereby covers the late-answer rule in a browser as well.
 */
test.beforeEach(() => {
  recorders.length = 0;
});

test.afterEach(async () => {
  while (opened.length > 0) {
    await opened.pop()?.close();
  }
});

/** A promise the spec resolves, and the two halves it needs to do that. */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/**
 * Open the fixture as a **first visit**: nothing stored, and a recorder already in place.
 *
 * **Recorder before navigation, and clear before both.** The controller reads storage once, at
 * boot, so a spec that cleared afterwards would be testing a controller that had already
 * decided — the same ordering rule `in-page.spec.ts`'s `openWithStoredMailbox` documents for
 * seeding, with the seed removed.
 *
 * **`resetToFirstVisit` reads its mailbox parameter as a deliberate `undefined`, not a default.**
 * There is a seeded mailbox constant two files away and a default argument would be the easy
 * mistake: a default that named it would make every case here offer to *insert* rather than to
 * *create*, and each would fail for the same wrong reason.
 */
async function resetToFirstVisit(
  options: RecordingOptions = {},
  page: FixturePageOptions = {},
): Promise<Page> {
  traffic = await recordProviderTraffic(extension.context, options);
  recorders.push(traffic);
  await clearStoredMailbox(extension);
  const openedPage = await openFixturePage(extension.context, page);
  opened.push(openedPage);
  return openedPage;
}

/**
 * How many account-creation requests every recorder this case installed has been asked to answer.
 *
 * **`MAILTM_ACCOUNTS` and not a path fragment**, for the reason the constant exists: three
 * separate spellings of "account creation" in one suite is three ways for the count to stop
 * meaning what it says, and a gate or an assertion written against a stale spelling would hold
 * nothing while reporting a number.
 */
function creationsRequested(): number {
  return recorders.reduce(
    (total, seen) => total + seen.requested.filter((url) => url.startsWith(MAILTM_ACCOUNTS)).length,
    0,
  );
}

/**
 * The control's own name, read from inside the shadow root.
 *
 * **`textContent` rather than `innerText`, and the difference matters here.** A refusal is a
 * multi-line sentence composed from one line per provider, and `innerText` is what a person
 * reads: it collapses whitespace. Reading `textContent` keeps the newlines, which means a
 * `toContain` on a provider's own line is answering about the sentence rather than about a
 * fragment that happened to survive layout.
 */
function affordanceName(page: Page): Promise<string | null> {
  return page.locator(AFFORDANCE_BUTTON_SELECTOR).evaluate((el) => el.textContent);
}

/** Whether the control refuses activation, and whether it says it is working. */
function affordancePendingState(page: Page): Promise<{ disabled: boolean; busy: string | null }> {
  return page.locator(AFFORDANCE_BUTTON_SELECTOR).evaluate((el) => ({
    disabled: (el as HTMLButtonElement).disabled,
    busy: el.getAttribute("aria-busy"),
  }));
}

/**
 * Whether any visible text on the page matches `pattern`, and then whether it does after the
 * pattern has been **planted** into the page.
 *
 * **Two answers from one reader, and the second is the one that makes the first worth having.**
 * A sweep over a page for a word the product must not say is satisfied by a page that says
 * nothing at all — which is what an absent affordance, a failed script, and a torn-down control
 * all look like. Planting the word into the *running* page and requiring the reader to report it
 * distinguishes "no such word" from "no such reader", and the planting is done here rather than
 * in the assertion so the two cannot disagree about what was planted.
 *
 * The page's own text is read, not the affordance's alone: the requirement forbids the **page**
 * reporting a failure, and a control that said nothing while an error region said plenty would
 * satisfy a narrower reader.
 */
async function sweepPageText(
  page: Page,
  planted: string,
  pattern: RegExp,
): Promise<{
  before: string[];
  after: string[];
}> {
  const read = () =>
    page.evaluate(() => document.body.innerText.split("\n").filter((line) => line.length > 0));

  const before = (await read()).filter((line) => pattern.test(line));

  await page.evaluate((word) => {
    const note = document.createElement("p");
    // **A marker attribute, so the cleanup removes what it planted.** The first version filtered on
    // `textContent === ""`, which matches the plant's own text never — so the paragraph survived
    // and the removal was a no-op that read as having run. A sweep's control has to be *taken back
    // out*, because a page still carrying the forbidden phrase is one a later assertion in the same
    // test would read as the product's own copy.
    note.setAttribute("data-planted", "");
    note.textContent = word;
    document.body.append(note);
  }, planted);

  const after = (await read()).filter((line) => pattern.test(line));

  await page.evaluate(() => {
    for (const node of document.querySelectorAll("[data-planted]")) node.remove();
  });

  return { before, after };
}

test.beforeAll(async () => {
  extension = await launchExtension();
});

test.afterAll(async () => {
  await extension?.close();
});

test.describe("creating a mailbox from inside a page", () => {
  test("offers to create, and inserts the address the extension made", async () => {
    const page = await resetToFirstVisit();

    await focusField(page, "react-input");

    // **"Create", not "Use", and the distinction is the whole requirement.** With nothing stored the
    // control offers to *make* an address; the sibling suite's `Use SpectreMail` label is what a
    // device holding one offers instead, and a control showing the wrong one of the two would
    // satisfy every assertion below while asking the person for nothing.
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_CREATE_LABEL);

    await affordanceButton(page).click();

    // **The value in the field, the value React's state holds, and the value on the device.**
    //
    // **Three readings rather than one, because each can be satisfied while the other two fail.**
    // A fixture input that is not controlled would accept a DOM write and re-render empty — which
    // is what a real page does, and the whole reason the state readback exists. A field that
    // received the address while the write never happened would leave the person with a form that
    // submits an address this device cannot serve. So all three, and they must be the *same*
    // address: the Mail.tm adapter generates the local part, so nothing here can be written as a
    // fixed string.
    await expect(page.locator("#react-input")).toHaveValue(/^[^@\s]+@[^@\s]+$/);
    const inserted = await page.locator("#react-input").inputValue();
    expect(await reactState(page, "react-input")).toBe(inserted);

    // **The address on the device is the address in the field, read through the platform's own
    // API inside the worker's own context.** D3 has the worker persist and the page not write, so
    // this is the claim that the page's value is not a copy of something transient.
    const record = await readStoredMailboxRecord(extension);
    expect(record).not.toBeNull();
    expect(JSON.stringify(record)).toContain(inserted);

    // **And the harness answered exactly one creation.** This is the positive control that
    // interception reaches a service worker's own `fetch`, which is the assumption that keeps
    // this whole tier offline. Were it false the request would have gone to the real internet,
    // no address could exist, and the assertion above would have failed — but naming the request
    // says *which* link is responsible, which a failing field value would not.
    expect(creationsRequested()).toBe(1);
    expect(traffic.unscripted).toEqual([]);
  });

  test("reaches the provider from a page whose own policy forbids cross-origin requests", async () => {
    // **`connect-src 'self'`, so the page cannot make the request and the extension still can.**
    //
    // **This case replaced one that asserted the wrong thing, and the wrong thing was worth
    // recording because it looked right.** The first version had the page attempt the identical
    // `fetch` and required it to be refused on CORS grounds - the recorded response carries no
    // `Access-Control-Allow-Origin`, so the reasoning is sound. It does not hold in this tier:
    // with `context.route` answering the provider origin, **the page's own cross-origin `fetch`
    // succeeds and returns the recorded body**, because a route fulfilled by the harness is not a
    // cross-origin response in the page's sense of one. Measured, not reasoned - the probe read
    // `{"threw": false, "status": 200, "text": "{\"@context\":\"/contexts\/Domain\"..."}`.
    //
    // **So that version would have kept passing if the extension had been making the request
    // itself**, and a case whose failure mode is blindness is not a case. A `connect-src` is
    // refused by the platform rather than by the harness, which is the mechanism the requirement
    // actually names: the document's policy governs the page's own requests, and it governs
    // nothing else.
    const page = await resetToFirstVisit({}, { connectSrc: "'self'" });

    // **The refusal, read from the page's own attempt.**
    //
    // **Two readings, because a refusal and an empty page are the same thing to a count.** The
    // exception's own `name` is the reason this works and not a substring: a thrown `TypeError`
    // names the policy, so an assertion reading "Refused to connect" is an assertion about Chromium
    // reporting its own refusal rather than about anything this repository wrote.
    const refused = await page.evaluate(async () => {
      try {
        const response = await fetch("https://api.mail.tm/domains");
        return { threw: false as const, reason: `resolved ${response.status}` };
      } catch (error) {
        return {
          threw: true as const,
          reason: error instanceof Error ? error.name : String(error),
        };
      }
    });
    expect(refused.threw).toBe(true);
    expect(refused.reason).toBe("TypeError");

    // **The positive control, and without it the arm above is worth nothing.** A page whose every
    // request failed - a `connect-src` too tight for the stylesheet, a route that never answered,
    // a page that never loaded - satisfies the assertion above for reasons that have nothing to do
    // with the provider. So the same function, in the same page, asks for its own origin.
    const allowed = await page.evaluate(async (origin) => {
      const response = await fetch(`${origin}/hostile.css`);
      return response.status;
    }, FIXTURE_ORIGIN);
    expect(allowed).toBe(200);

    // **And the identical provider operation, asked of the extension, works.** The same recorded
    // answer, a different context - which is the whole finding, and the reason the delegated
    // design is a measurement rather than an architectural preference.
    await focusField(page, "react-input");
    await affordanceButton(page).click();
    await expect(page.locator("#react-input")).toHaveValue(/@/);

    // **One creation request, and it was not made by the page.** The page's attempt never reaches
    // the network at all - a refused `connect-src` request is stopped before dispatch - so the
    // single request the harness answered can only have come from the extension's own context.
    // That is the assertion that names *which* context, which the field's value alone cannot: the
    // field would hold an address either way.
    expect(creationsRequested()).toBe(1);
    expect(traffic.requested.every((url) => !url.includes("in-page.invalid"))).toBe(true);

    // **And nothing is left on the page**, because the field holds the address now. This line is
    // here rather than at the top of the file because its first version asserted the opposite and
    // failed: a control surviving a successful insertion is a defect, not a leftover.
    expect(await affordanceCount(page)).toBe(0);
  });

  test("requests once per activation, and says it is working while it waits", async () => {
    const gate = deferred();
    const page = await resetToFirstVisit({ holdAccountCreation: gate.promise });

    await focusField(page, "react-input");
    await affordanceButton(page).click();

    // **The waiting label is the precondition, not an assertion about the copy.** It is only set
    // after the request has been dispatched, so seeing it is how this case knows the request is
    // genuinely in flight — and the gate is what keeps it there. A fixed sleep would be a number
    // chosen to be long enough, which `AGENTS.md` records as this repository's repeated defect.
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_WAITING_LABEL);
    expect(await affordancePendingState(page)).toEqual({ disabled: true, busy: "true" });

    // **A second activation, delivered the way a real one would be.**
    //
    // **`dispatchEvent`, not `click`, and the reason is that `click` could not test the claim.**
    // Playwright's `click` waits for the element to be *enabled*; with the control disabled it
    // would wait out the timeout and fail — reporting "this control is disabled", which the
    // previous assertion already established and which says nothing about what happens if a
    // press arrives anyway. A disabled `<button>` does not deliver clicks to its own handler in a
    // real browser, so the second arm of the guard — the one in the handler, which is what
    // protects against a second activation arriving by any other route — is what is under test.
    await page.locator(AFFORDANCE_BUTTON_SELECTOR).dispatchEvent("click");

    // **Still exactly one request, after the press and before the gate is released.** Both halves
    // of that ordering matter: reading before the press would pass on a guard that arrives late,
    // and reading after the release would let a second request be created and then counted as one.
    expect(creationsRequested()).toBe(1);

    // **And the control is still pending** — a guard that counted the request but let the control
    // look available would leave the person pressing a button that appears to do nothing.
    expect(await affordancePendingState(page)).toEqual({ disabled: true, busy: "true" });

    gate.release();

    await expect(page.locator("#react-input")).toHaveValue(/@/);

    // **The control is gone, and that is the design rather than an omission.** Nothing is left to
    // offer: the field holds the address, and a control still offering to create one would be the
    // second-creation path this whole slice exists to close. The first version of this case expected
    // the control to return to its resting label and failed - and the fix was to the *expectation*,
    // because a control that survives a successful insertion is the defect.
    await expect(page.locator("[data-spectre-affordance]")).toHaveCount(0);

    // **One request for the whole activation, confirmed after the answer rather than only
    // during it.** A second request that the *answer* triggered would not have been visible above.
    expect(creationsRequested()).toBe(1);
  });

  test("reports that it could not confirm when the wait passes and nothing was stored", async () => {
    // **A case that takes the length of the ceiling, and the ceiling is the product's own.**
    //
    // **The timeout is derived from the constant rather than chosen.** `IN_PAGE_CREATE_CEILING_MS`
    // is imported from the module that declares it, for the reason `AGENTS.md` records about
    // `INBOX_POLL_CEILING_MS`: a hand-picked number large enough is the recorded defect with a
    // larger constant, and it drifts the moment the product changes its own mind. **And the value
    // is imported at all rather than shortened for the test** — a test-only ceiling would be a
    // second, faster, unmeasured behaviour, which is the thing this suite exists to avoid.
    //
    // **The ceiling plus 45 seconds rather than 30**, because this case also stages the late
    // answer: it waits for that answer's write, opens a second page, and reads the address back
    // into a field. All three are waits on this product's own behaviour, so the budget is derived
    // from the one constant rather than chosen to make the first part fit.
    test.setTimeout(IN_PAGE_CREATE_CEILING_MS + 45_000);

    const gate = deferred();
    const page = await resetToFirstVisit({ holdAccountCreation: gate.promise });

    await focusField(page, "react-input");
    await affordanceButton(page).click();
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_WAITING_LABEL);

    // **The wait passes, finds nothing, and says so.** The harness is still holding the request,
    // so this is a request that was genuinely made and has genuinely not answered — the case the
    // ceiling exists for, and not a request that never happened.
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_UNCONFIRMED_LABEL, {
      timeout: IN_PAGE_CREATE_CEILING_MS + 15_000,
    });

    expect(await page.locator("#react-input").inputValue()).toBe("");

    // **The claim it must not make, checked over the whole page, and checked with a control.**
    //
    // **"Could not confirm an address" is the required sentence and "no mailbox was created" is
    // the forbidden one**, and the difference between them is a promise to a person who is
    // halfway through somebody else's signup form. The sweep reads the page's own text rather
    // than the button's, because a control that said nothing while an error region said plenty
    // would satisfy a narrower reader.
    const { before, after } = await sweepPageText(
      page,
      "no mailbox was created",
      /no mailbox|failed/i,
    );

    expect(before, "the page must not claim no mailbox was created").toEqual([]);
    expect(after, "the reader must be able to see the phrase it forbids").toHaveLength(1);

    // **And it offers a further request rather than stranding the person.** The cost of that is
    // disclosed in the requirement — two requests could create two mailboxes — and the
    // alternative is a control that reports a problem it offers no way past.
    expect(await affordancePendingState(page)).toEqual({ disabled: false, busy: null });
    expect(creationsRequested()).toBe(1);

    // **Then the answer arrives anyway, and the case covers that half here rather than only in the
    // unit tier.** A provider round trip is not bounded by anything this product decided - that is
    // the whole reason the wait has a ceiling - so releasing the gate produces exactly the
    // late-answer condition the requirement names, in a real browser, against a real worker.
    //
    // **And this is the drain the case owes the ones after it.** Releasing the gate and returning
    // would leave the harness fulfilling a request and the worker writing a mailbox *after* the
    // next case had cleared storage and booted its page; that case would then find an address it
    // did not create and offer insertion where it meant to offer creation. The first version of
    // this file did exactly that and the failure landed two cases later, on an assertion that
    // said nothing about itself. **A case that starts provider work must finish it.**
    gate.release();

    await expect
      .poll(async () => readStoredMailboxAddress(extension), { timeout: 15_000 })
      .not.toBeNull();

    // **Three readings of the late answer, and they are the requirement's own three.** The field
    // is untouched, the control reports nothing further, and the device holds the address — so a
    // later visit offers this address rather than creating a second mailbox.
    expect(await page.locator("#react-input").inputValue()).toBe("");
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_UNCONFIRMED_LABEL);

    const address = await readStoredMailboxAddress(extension);
    expect(address).not.toBeNull();

    const later = await openFixturePage(extension.context);
    opened.push(later);
    await focusField(later, "react-input");
    await expect(affordanceButton(later)).toHaveText(AFFORDANCE_LABEL);

    await affordanceButton(later).click();
    await expect(later.locator("#react-input")).toHaveValue(address as string);
    expect(creationsRequested()).toBe(1);
  });

  test("keeps the control while the wait passes, and takes it away only when focus leaves", async () => {
    const gate = deferred();
    const page = await resetToFirstVisit({ holdAccountCreation: gate.promise });

    await focusField(page, "react-input");
    await affordanceButton(page).click();
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_WAITING_LABEL);

    // **D8's rule, in a real browser.** The control outlives a focus change only while an answer
    // is outstanding, so this is the one moment a `focusout` must not remove it — and the
    // sibling cases in `in-page.spec.ts` establish the other half, that a focus change with
    // nothing outstanding does remove it. Between them the two cover both branches of the same
    // rule, which is why neither alone would be enough.
    await blurField(page);
    expect(await affordanceCount(page)).toBe(1);

    gate.release();
    await expect(page.locator("#react-input")).toHaveValue(/@/);
  });

  test("inserts nothing into a field that acquired text, and records the address anyway", async () => {
    const gate = deferred();
    const page = await resetToFirstVisit({ holdAccountCreation: gate.promise });

    await focusField(page, "react-input");
    await affordanceButton(page).click();
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_WAITING_LABEL);

    // **The person types while the request is out.** The Mail.tm adapter generates the local part,
    // so the address cannot equal the typed text and the assertion cannot be satisfied by luck.
    await page.locator("#react-input").pressSequentially("already@typed.example");
    await expect(page.locator("#react-input")).toHaveValue("already@typed.example");

    gate.release();

    // **The typed text survives, in the field and in React's state.** Overwriting it would destroy
    // what somebody had entered to reach a code, and the second reading is the one that matters:
    // a framework that thinks the field is empty will re-render it empty on the next render,
    // which is visible to a user without any instrumentation.
    await expect(page.locator("#react-input")).toHaveValue("already@typed.example");
    expect(await reactState(page, "react-input")).toBe("already@typed.example");

    // **And the address was created and recorded anyway.** This is the half that is easy to leave
    // out and expensive to get wrong: the mailbox is real, so a controller that learned the
    // address only by inserting it would offer to create a *second* one on the next field focus.
    const record = await readStoredMailboxRecord(extension);
    expect(record).not.toBeNull();

    // **The next focus on an *empty* field offers that address for insertion, not a further creation**
    // — which is the observable that distinguishes the two, and the one the duplicate-creation cost
    // would otherwise be paid through silently.
    //
    // **`#in-form`, and not the field that acquired text.** A field holding text is refused the
    // affordance outright, so focusing this one again would prove only that, and the first version
    // of this case asserted the insertion label here and found no control at all — which was the
    // product being right. `in-page.spec.ts` covers the prefilled field; what this case needs is a
    // field a person could still use.
    await blurField(page);
    await expect(page.locator("[data-spectre-affordance]")).toHaveCount(0);
    await focusField(page, "in-form");
    await expect(affordanceButton(page)).toHaveText(AFFORDANCE_LABEL);
    expect(creationsRequested()).toBe(1);
  });

  test("reports the extension's own composed refusal when no provider could create a mailbox", async () => {
    const page = await resetToFirstVisit({ allProvidersThrottled: true });

    await focusField(page, "react-input");
    await affordanceButton(page).click();

    // **The refusal names every provider that was asked, and the condition each refused in.**
    //
    // **This case's first version asserted the provider's verbatim body, and it was wrong by
    // measurement rather than by reading.** mailtmThrottled is a recorded response - docs/PROVIDERS.md §3 has the 429 and this
    // exact body - but the body never reaches this surface: the adapter classifies a throttled
    // creation as RATE_LIMITED and substitutes its own sentence, so what the control reads is
    // roughly
    //
    //     No configured provider could create a mailbox.
    //       - mailtm: RATE_LIMITED - Mail.tm is throttling this request while creating a mailbox.
    //       - guerrilla: RATE_LIMITED - Guerrilla Mail is throttling ...
    //
    // The change's requirement was amended to say so rather than to demand words no surface in
    // this product carries; design.md D12 records why that was a correction and not a rewrite.
    //
    // **The provider ids come from the extension's own list**, for the same reason the labels come
    // from `affordance.ts`: two spellings of "which providers this client has" is a second thing
    // that can drift, and a drift here would read as a refusal that named the wrong provider.
    // **`expect.poll` rather than one read, and the reason is the press rather than the
    // assertion.** Immediately after `click` the control is still `Creating an address…`, and a
    // single read would have measured the click. Polling makes "the refusal replaced the waiting
    // label" the thing being waited for, which is the product's own transition rather than a
    // timing this spec chose.
    await expect.poll(async () => affordanceName(page), { timeout: 15_000 }).toContain("mailtm:");

    const refusal = await affordanceName(page);

    for (const provider of EXTENSION_PROVIDER_IDS) {
      expect(refusal, "the refusal must name " + provider).toContain(provider + ":");
    }
    expect(refusal).toContain("RATE_LIMITED");

    // **And no success of any kind.** Three readings, because each can pass while the others
    // fail: the field could hold an address the control merely stopped naming, the button could
    // return to its resting label, and the device could hold a mailbox.
    expect(await page.locator("#react-input").inputValue()).toBe("");
    await expect(affordanceButton(page)).not.toHaveText(AFFORDANCE_LABEL);
    await expect(affordanceButton(page)).not.toHaveText(AFFORDANCE_CREATE_LABEL);
    expect(await readStoredMailboxRecord(extension)).toBeNull();

    // **Both providers were asked, and both refused.** The extension's manager prefers Mail.tm and
    // falls back, so a case that throttled only Mail.tm would be asserting a refusal the product
    // correctly never reports - it would have created the mailbox through the fallback, which is
    // the behaviour provider-abstraction requires and which a single-provider case would have
    // reported as a defect.
    expect(creationsRequested()).toBe(1);
    expect(
      traffic.requested.some((url) => new URL(url).origin === "https://api.guerrillamail.com"),
    ).toBe(true);
    expect(traffic.unscripted).toEqual([]);

    // **A person can ask again**, because the control reports a provider's refusal rather than
    // anything about this product's own state, and a rate limit passes.
    expect(await affordancePendingState(page)).toEqual({ disabled: false, busy: null });

    // **What this case does not establish, stated where a reader will find it.** Two providers
    // refusing is a *staged* condition: Mail.tm's 429 was measured, but **Guerrilla Mail was never
    // observed to send a 429** and its copy in `fixtures.ts` is labelled `SYNTHETIC`. So what is
    // established is that a refusal reaches the page when no provider could serve the request, and
    // nothing about what any one provider does when it refuses.
  });

  test("keeps nothing between requests, so a second creation is a second mailbox", async () => {
    const page = await resetToFirstVisit();

    await focusField(page, "react-input");
    await affordanceButton(page).click();
    await expect(page.locator("#react-input")).toHaveValue(/@/);
    const first = await page.locator("#react-input").inputValue();

    // **The device is emptied, and the worker is not restarted.** This is the retention claim in
    // the only form a browser can see it: nothing in the worker's own memory survives, so the
    // next request has to ask the provider again. A worker holding a session between events would
    // be holding one in a context this repository has measured only a *bound* for, never a
    // lifetime (`docs/PROVIDERS.md` §4.4, arm E).
    await clearStoredMailbox(extension);

    // **A second page, not a second focus on the first — and the reason is a property of the
    // product rather than of the test.**
    //
    // **The controller reads this device's storage once, at boot, and deliberately does not re-read
    // per focus** (`in-page.spec.ts` documents the rule, because a controller that retried a
    // rejected read would offer on every keystroke). So the *first* page still believes this device
    // holds nothing... and its own in-memory answer now says it holds the address it just made.
    // Emptying the storage under it changes nothing it can observe, and the first version of this
    // case expected the very next focus to offer creation again and found no control at all —
    // because the address it had created was in its own hands, and it offered to *insert* it.
    //
    // **So the second request comes from a document that booted with nothing stored**, which is
    // also the only way a later visit reaches this state. The worker is the same object in both,
    // which is the whole point: nothing about it was restarted between them.
    const second = await resetToFirstVisit();
    void page;

    await focusField(second, "react-input");
    await expect(affordanceButton(second)).toHaveText(AFFORDANCE_CREATE_LABEL);

    await affordanceButton(second).click();
    await expect(page.locator("[data-spectre-affordance]")).toHaveCount(0);
    await expect(second.locator("#react-input")).toHaveValue(/@/);
    const secondAddress = await second.locator("#react-input").inputValue();

    // **Two requests, two mailboxes, two different addresses.** The Mail.tm adapter *generates*
    // the local part rather than accepting one, so two creations on one recording are
    // distinguishable — and that is the only reason this case can assert the addresses differ
    // rather than merely that two were made.
    expect(creationsRequested()).toBe(2);
    expect(secondAddress).not.toBe(first);

    // **And the device holds the second one only.** A worker that retained the first would leave
    // a mailbox this device cannot reach, created by a person who never asked for it.
    const record = await readStoredMailboxRecord(extension);
    expect(JSON.stringify(record)).toContain(secondAddress);
    expect(JSON.stringify(record)).not.toContain(first);
  });
});
