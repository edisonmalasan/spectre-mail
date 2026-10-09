/**
 * Serving the in-page fixture, and reaching into it.
 *
 * ## Route interception rather than a `webServer`, and why
 *
 * `design.md` D8 planned a `webServer` for this suite. **It is not used**, and the reason is a
 * recorded failure rather than a preference: the website's browser job **hung five times in CI**
 * because `webServer` spawns a wrapper that Playwright cannot shut down, orphaning the real
 * server and holding its inherited stdout pipe and port open. Runs `37439940701` and
 * `37446193779` are the two that turned red; the diagnosis and the fix are in `AGENTS.md`.
 *
 * **A new `webServer` on the tier that already had that bug is buying a port and a process to
 * avoid.** `page.route` fulfils the same three responses with no child process to leak and no
 * port to hold, and the page is still a **real navigation to a real `https://` origin** - which
 * is the only thing the content script's `matches` cares about.
 *
 * ## The origin is `.invalid`, on purpose
 *
 * `https://in-page.invalid/` can never resolve. **That is the point:** every request is
 * fulfilled from disk, and a request this suite forgot to script fails loudly as an unhandled
 * route rather than reaching a real host on the internet. The website tier's provider recorder
 * already reports an unscripted origin by name; this is the same idea for the page.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BrowserContext, FrameLocator, Page, Route } from "@playwright/test";

import {
  AFFORDANCE_BUTTON_ATTRIBUTE,
  AFFORDANCE_HOST_ATTRIBUTE,
  AFFORDANCE_LABEL,
} from "../../src/content-script/affordance";

/**
 * Where the fixture's sources and its build live.
 *
 * **`fileURLToPath(new URL(...))`, not `__dirname`.** `apps/extension/package.json` declares
 * `"type": "module"`, so a Playwright spec here runs as ESM and `__dirname` does not exist —
 * the first version of this file used it and every spec failed to load with
 * `ReferenceError: __dirname is not defined in ES module scope`, which Playwright reported as
 * `No tests found` rather than as the reference error. `popup.spec.ts` already had this
 * spelling; there is now one.
 */
const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/in-page", import.meta.url));

/** The built script. Served, never sourced from `page.tsx`. */
const BUILT_SCRIPT = path.join(FIXTURE_DIR, "dist", "fixture.js");

/** The origin. `.invalid` is reserved and can never resolve - see the module note. */
export const FIXTURE_ORIGIN = "https://in-page.invalid";

/**
 * The same fixture, over plain `http`.
 *
 * **`content_scripts.matches` declares two schemes and this is how the second one is
 * evidenced rather than merely read.** The declaration is one pattern for `http` and one for
 * `https`, and a suite that only ever opens the page over `https` has demonstrated the reach
 * for one of them and taken the other on trust — which is exactly the "declared reach beyond
 * what the shipped surfaces use" the requirement forbids, in the direction where the
 * declaration is *wider* than anything measured.
 *
 * The host is the same reserved `.invalid` name, so this origin cannot resolve either.
 */
export const FIXTURE_HTTP_ORIGIN = "http://in-page.invalid";

/** The page's own stylesheet, and it is hostile on purpose. */
const HOSTILE_CSS = `
*, *::before, *::after { box-sizing: content-box }
button {
  display: none !important;
  transform: scale(0.1);
  color: transparent;
}
`;

/**
 * The affordance's own hooks and label, imported from the product.
 *
 * **Not written out here.** The first version of this file spelled all three as string
 * literals while its own note claimed that was what kept the product's hook and the test's
 * hook from drifting - which was exactly backwards: two literals are two things that *can*
 * drift, and it cost a real bug. `plantEscapedAffordanceButton` below passed the **selector**
 * to setAttribute, so it set an attribute literally named `[data-spectre-affordance-button]`
 * and planted nothing the reader could match; the negative control then reported the same
 * answer with and without the escape it was planted to simulate, which is the definition of a
 * control that verifies nothing.
 *
 * They come from `src/content-script/affordance.ts` now, so renaming a hook renames it in
 * both places or breaks the build.
 */
/** The affordance's own hook, as a selector. */
export const AFFORDANCE_HOST_SELECTOR = `[${AFFORDANCE_HOST_ATTRIBUTE}]`;

/** The control's own hook, as a selector. */
export const AFFORDANCE_BUTTON_SELECTOR = `[${AFFORDANCE_BUTTON_ATTRIBUTE}]`;

/**
 * The extension namespaces this product uses, and the ones a web page must not reach.
 *
 * **Three names, and every one of them is named by a module in `apps/extension/src`.** `storage`
 * is the whole of this slice's mechanism, `runtime` is slice 2's delegation seam, and `alarms` is
 * M8's scheduler. Listing them rather than testing a wildcard is deliberate: a wildcard would be
 * satisfied by a *new* extension API appearing without anyone deciding the page should get it,
 * and this case is about the three that exist.
 */
const EXTENSION_NAMESPACES = ["storage", "runtime", "alarms"] as const;

/**
 * Fail loudly if the fixture was not built.
 *
 * **A missing build must not read as an absent affordance.** If `dist/fixture.js` is missing
 * the page runs no React, every controlled-input assertion is trivially satisfiable, and the
 * suite reports a green that verified nothing. This throws at setup instead.
 */
function requireBuiltFixture(): string {
  if (!fs.existsSync(BUILT_SCRIPT)) {
    throw new Error(
      `The in-page fixture is not built: ${BUILT_SCRIPT} does not exist. ` +
        `Run the extension's build first - \`pnpm test:browser\` builds both clients, and ` +
        `\`build:fixture\` is its third step.`,
    );
  }
  return fs.readFileSync(BUILT_SCRIPT, "utf8");
}

async function fulfil(route: Route, body: string, contentType: string): Promise<void> {
  await route.fulfill({ status: 200, contentType, body });
}

/** What a case wants the page's own cross-origin requests to meet. */
export interface FixturePageOptions {
  /** The origin to serve the fixture from. Defaults to the `https` one. */
  readonly origin?: string;

  /**
   * A `connect-src` to put on the document response, in the CSP's own spelling.
   *
   * **This is how a page forbids cross-origin requests, and it is the only way this tier can
   * stage one.** The obvious implementation - have the page try the request and see whether it is
   * refused - was measured and does not work: with `context.route` in front of the provider origin,
   * **the page's own `fetch` to `api.mail.tm` succeeds and returns the recorded body**, because
   * a fulfilled route is not a cross-origin response in the page's sense of one. So an assertion
   * that the page's request was refused passed for a reason that had nothing to do with the page's
   * policy, and would have kept passing if the extension had been doing the fetch itself.
   *
   * A `connect-src` is refused by the platform rather than by the harness, so it is the real
   * mechanism the requirement names: the document's policy governs the page's own requests and
   * nothing else.
   */
  readonly connectSrc?: string;
}

/**
 * Put the fixture's three responses in place on a fresh page.
 *
 * **`origin` is a parameter because the manifest declares two schemes** - see
 * {@link FIXTURE_HTTP_ORIGIN}. It defaults to the `https` origin, so every case that
 * does not care names nothing.
 */
export async function openFixturePage(
  context: BrowserContext,
  options: string | FixturePageOptions = {},
): Promise<Page> {
  const script = requireBuiltFixture();
  const html = fs.readFileSync(path.join(FIXTURE_DIR, "index.html"), "utf8");
  const frame = fs.readFileSync(path.join(FIXTURE_DIR, "frame.html"), "utf8");

  // **A string is accepted as the origin, because five existing callers pass one.** Changing the
  // signature to options-only would have meant editing every one of them to learn a shape that
  // most of them do not use - and a mechanical edit of five working cases is where a mistake hides.
  const resolved: FixturePageOptions = typeof options === "string" ? { origin: options } : options;
  const origin = resolved.origin ?? FIXTURE_ORIGIN;

  const page = await context.newPage();

  await page.route(`${origin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === "/" || pathname === "/index.html") {
      // **The document's own policy, and only the document's.** `content-security-policy` is
      // attached here rather than injected into the HTML so that it is a response header, which is
      // where a real server puts it. A `<meta http-equiv>` would be nearly the same experiment and
      // a worse one: it cannot express `frame-ancestors`, is ignored for some directives, and is a
      // spelling no site ships.
      // **`headers` is conditional rather than an object carrying `undefined`.** `exactOptionalPropertyTypes`
      // is on across this workspace, and an absent `headers` is not the same type as
      // `headers: undefined` — so the single-object spelling does not compile. The fix that
      // compiles is two `fulfill` calls, which is also the version that cannot accidentally send a
      // policy of `undefined`.
      if (resolved.connectSrc === undefined) {
        await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: html,
        headers: {
          "content-security-policy": `connect-src ${resolved.connectSrc}; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`,
        },
      });
      return;
    }
    if (pathname === "/fixture.js") {
      await fulfil(route, script, "text/javascript; charset=utf-8");
      return;
    }
    if (pathname === "/frame.html") {
      // **The frame's document, served by name like any other response.** It is a separate
      // pathname rather than a `srcdoc` attribute precisely so the handler above has to
      // account for it: an unscripted pathname throws by name, so a frame that 404s is a
      // loud failure and not a green absence assertion.
      await fulfil(route, frame, "text/html; charset=utf-8");
      return;
    }
    if (pathname === "/hostile.css") {
      await fulfil(route, HOSTILE_CSS, "text/css; charset=utf-8");
      return;
    }

    // **An unscripted request is reported by name and fails.** A fixture that quietly 404s its
    // own stylesheet reads as "the page's styles did not reach the affordance" - which is the
    // assertion that needs a firing control most.
    throw new Error(`the in-page fixture received an unscripted request: ${pathname}`);
  });

  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });

  // **The fixture's own readiness, read from the page.** Waiting for a load event would be a
  // wait on the page rather than on the thing under test, and the affordance needs React's
  // first render to have happened before a focus is dispatched at anything.
  await page.waitForFunction(() => {
    const readback = document.querySelector('[data-readback="react-input"]');
    return readback !== null;
  });

  return page;
}

/**
 * The fixture's same-origin iframe, as a frame locator.
 *
 * **Returned rather than awaited-ready on purpose.** Nothing this suite ships is injected into
 * the frame (`all_frames` is unset in the manifest), so a readiness wait here would have to be
 * a wait for the *absence* of the product's own work — and a wait that can be satisfied by a
 * failure is not a precondition. `waitForFramedFixture` below waits for the frame's **own**
 * marker instead, which is the one thing the frame does whether or not this extension is in it.
 */
export function framedFixture(page: Page): FrameLocator {
  return page.frameLocator("#framed");
}

/**
 * Wait until the iframe has loaded its own document.
 *
 * **The frame's marker, read from inside the frame.** An absence assertion over a frame that
 * never loaded is satisfied by the frame being broken, and the recorded lesson is that the
 * cheapest way to be sure is to have the frame prove itself first.
 */
export async function waitForFramedFixture(page: Page): Promise<void> {
  await framedFixture(page).locator("[data-frame-ready]").waitFor({ state: "attached" });
}

/**
 * How many affordances the **iframe's own** document holds.
 *
 * **A count through the frame's document, not through Playwright's frame locator.** `frameLocator`
 * locates across frames; a `count()` on it answers for the frame, which is what the requirement
 * needs. The plant below is what makes the count mean something: it is the control that proves
 * this reader would report one.
 */
export function framedAffordanceCount(page: Page): Promise<number> {
  return framedFixture(page).locator(AFFORDANCE_HOST_SELECTOR).count();
}

/**
 * Plant the affordance's own hook inside the frame, then remove it, and report what the reader
 * saw both times.
 *
 * **The control for the absence claim, and it is the reason the absence is worth reading.** A
 * reader that cannot see the frame's light DOM would report `0` with or without the extension
 * doing anything, and the case would pass for a reason that had nothing to do with `all_frames`.
 * The numbers are returned as a pair rather than asserted here so the case can state them.
 */
export async function plantAndRemoveFramedAffordance(page: Page): Promise<{
  readonly planted: number;
  readonly removed: number;
}> {
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());

  if (frame === undefined) {
    throw new Error("the fixture's iframe is not among the page's frames, so nothing was planted");
  }

  const planted = await frame.evaluate((attribute) => {
    const host = document.createElement("div");
    host.setAttribute(attribute, "");
    document.body.append(host);
    return document.querySelectorAll(`[${attribute}]`).length;
  }, AFFORDANCE_HOST_ATTRIBUTE);

  await frame.evaluate((attribute) => {
    for (const host of Array.from(document.querySelectorAll(`[${attribute}]`))) {
      host.remove();
    }
  }, AFFORDANCE_HOST_ATTRIBUTE);

  const removed = await frame.evaluate(
    (selector) => document.querySelectorAll(selector).length,
    AFFORDANCE_HOST_SELECTOR,
  );

  return { planted, removed };
}

/**
 * Whether the **page's own world** can reach any of this extension's namespaces.
 *
 * **A list of names, not a boolean about the global's existence.** A content script runs in an
 * isolated world, so the extension's own APIs are absent for the page - and Chromium does hand a
 * web page a `chrome` object carrying the long-deprecated `loadTimes`, `csi` and `app` properties,
 * which is why `"chrome" in globalThis` is `true` there and was the wrong question. What has to be
 * unreachable is `storage`, `runtime` and `alarms`: those are the three this product uses, and the
 * absence of exactly those is the claim.
 */
export function pageWorldReachesExtensionApis(page: Page): Promise<string[]> {
  const wanted: readonly string[] = EXTENSION_NAMESPACES;
  return pageWorldChromeKeys(page).then((keys) => keys.filter((key) => wanted.includes(key)));
}

/**
 * Install a `storage` listener in the page and report how many events it has seen.
 *
 * **`window` listener, in the page's world, exactly as a page would write one.** This is the
 * instrument for the cross-document control: `localStorage` writes do *not* fire `storage` in the
 * document that made them, so the positive control has to write from a second page on the same
 * origin for the event to be a real one.
 */
export function installStorageListener(page: Page): Promise<void> {
  return page.evaluate(() => {
    const events: string[] = [];
    (globalThis as unknown as { __spectreStorageEvents: string[] }).__spectreStorageEvents = events;
    window.addEventListener("storage", (event) => {
      events.push(`${String(event.key)}:${String(event.storageArea === localStorage)}`);
    });
  });
}

/** How many `storage` events the page's own listener has reported. */
export function storageEventsSeen(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (globalThis as unknown as { __spectreStorageEvents?: string[] }).__spectreStorageEvents ?? [],
  );
}

/**
 * The **names** the page's own world finds on `globalThis.chrome`.
 *
 * **Measured, not assumed, and the measurement corrected the requirement's wording.** The first
 * version of this case asserted that `"chrome" in globalThis` is `false` in the page, and Chromium
 * answered `true`: a web page does get a `chrome` object, carrying the long-deprecated `loadTimes`,
 * `csi` and `app` properties. **A platform global's *presence* is not its *content*, and a claim
 * about isolation has to be about what the page can actually reach.** So the reader names the keys,
 * and the case requires that none of this extension's namespaces is among them.
 */
export function pageWorldChromeKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const platform = (globalThis as unknown as { chrome?: Record<string, unknown> }).chrome;
    return platform === undefined ? [] : Object.keys(platform).sort();
  });
}

/** How many affordances the page is showing. */
export function affordanceCount(page: Page): Promise<number> {
  return page.locator(AFFORDANCE_HOST_SELECTOR).count();
}

/**
 * The affordance's button, which lives inside an **open** shadow root.
 *
 * **A plain locator finds it, and that is Playwright's CSS engine piercing open shadow roots**
 * — not the page being able to. Which is exactly why the requirement about the page's own
 * queries is asserted through {@link pageOwnedButtons} rather than here: a locator cannot tell
 * the two apart, so using one for both would silently make the isolation claim unfalsifiable.
 */
export function affordanceButton(page: Page) {
  return page.locator(AFFORDANCE_BUTTON_SELECTOR);
}

/**
 * What **the page's own** queries can see: every `<button>` in the light DOM.
 *
 * **Read with `evaluate`, deliberately.** Playwright's locators pierce shadow roots, so a
 * locator-based count of buttons would include the affordance and the isolation requirement
 * could never fail. This is the only reader in the tier that answers the question as the page
 * would ask it.
 */
export function pageOwnedButtons(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll("button").length);
}

/**
 * Whether the page's own `querySelectorAll` can see the affordance's **button**.
 *
 * **The button, not the host — and the first version of this file asked the wrong question.**
 * The host is a light-DOM element by design: it is inserted `afterend` of the field precisely
 * so it is *not* inside the field's own subtree, which is what keeps it out of the form the
 * page serialises. `document.querySelector("[data-spectre-affordance]")` therefore finds it,
 * and asserting that it does not was asserting that the product was broken.
 *
 * What is isolated is the **control** — the `<button>` inside the shadow root — and that is
 * what the measurement in `docs/PROVIDERS.md` §4.2 recorded: the page's
 * `querySelectorAll("button")` found only its own.
 */
export function pageCanSeeAffordanceButton(page: Page): Promise<boolean> {
  return page.evaluate(
    (selector) => document.querySelector(selector) !== null,
    AFFORDANCE_BUTTON_SELECTOR,
  );
}

/** How many `[data-spectre-affordance-button]` elements the page's own queries return. */
export function pageOwnedAffordanceButtons(page: Page): Promise<number> {
  return page.evaluate(
    (selector) => document.querySelectorAll(selector).length,
    AFFORDANCE_BUTTON_SELECTOR,
  );
}

/** What React's own state holds, as the page rendered it. */
export function reactState(page: Page, label: string): Promise<string | null> {
  return page.locator(`[data-readback="${label}"]`).textContent();
}

/**
 * A resolved property of the affordance's button, read through the shadow root.
 *
 * **A computed style, never a rendered pixel.** This is the same limit the whole repository
 * works under: what the control *looks like* is a human judgement and no assertion here
 * substitutes for one. What this reads is whether the page's rules *applied*.
 */
export function affordanceComputed(page: Page, property: string): Promise<string> {
  return page
    .locator(AFFORDANCE_BUTTON_SELECTOR)
    .evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);
}

/**
 * Plant a plain, page-owned `<button>` carrying the affordance's own attribute, in the light
 * DOM, and report how many buttons the page now owns.
 *
 * **This is the negative control's instrument, and it exists so the control is not theatre.**
 * An absence assertion whose reader would report the same answer whether or not the thing it
 * forbids was present verifies nothing; planting the forbidden thing and requiring the reader
 * to change is what makes it worth having.
 */
export async function plantEscapedAffordanceButton(page: Page): Promise<number> {
  return page.evaluate(
    ([attribute, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      // **The attribute name, not the selector.** The first version passed the selector here
      // and set an attribute literally called `[data-spectre-affordance-button]` — so the plant
      // succeeded, the button existed, and the readers below still could not see it. The
      // negative control then passed while proving nothing.
      button.setAttribute(attribute as string, "");
      button.textContent = label as string;
      document.body.append(button);
      return document.querySelectorAll("button").length;
    },
    [AFFORDANCE_BUTTON_ATTRIBUTE, AFFORDANCE_LABEL] as const,
  );
}

/** The events the page's own listeners reported, in order. */
export function plainEvents(page: Page): Promise<string[]> {
  return page.locator("#plain-events li").allTextContents();
}

/**
 * Focus a field the way a user does.
 *
 * **`locator.focus()`, and the distinction is worth being precise about.** The unit tier
 * dispatches `focusout` then `focusin` by hand, and that is a legitimate way to reach the
 * controller's deferred-removal branch — it is how that branch's defect was found. What hand
 * dispatch cannot do is answer the question this tier asks: **whether the platform itself
 * fires `focusout` before the arriving `focusin`, and does both in one task.** A spec that
 * dispatched only `focusin` would be assuming the very ordering the defect lived in.
 *
 * **`blurField` focuses another element rather than calling `blur()`,** for the same reason:
 * `element.blur()` and a focus move are both real, but a focus move is what a user does, and
 * it is the transition the controller defers on.
 */
export async function focusField(page: Page, id: string): Promise<void> {
  await page.locator(`#${id}`).focus();
}

/**
 * Blur by focusing something that is not the field, which is a real transition.
 *
 * **The default target is a text field, not the page's button — and that is measured, not
 * tidiness.** This fixture's hostile stylesheet sets `button { display: none !important }`,
 * and **`focus()` does not move `document.activeElement` onto an element the page has hidden.**
 * Measured in Chromium through both routes — `element.focus()` and Playwright's
 * `locator.focus()` — against a `display: none` button: `activeElement` stayed on the field
 * that was focused before.
 *
 * The first version of this helper blurred to `#not-an-input`, a button. **The blur never
 * happened**, so the case that requires the affordance to be *removed* on blur reported it
 * still present — a red that said nothing about the product and would have sent the next
 * reader looking in `controller.ts` for a defect that was not there.
 */
export async function blurField(page: Page, toId = "username-input"): Promise<void> {
  await page.locator(`#${toId}`).focus();
}

/**
 * Add a **second** qualifying one-time-code field to a page that already has one, and report how
 * many the page now owns.
 *
 * ## Why this is a helper and not a fixture, and why it is planted rather than rendered
 *
 * **The fixture carries exactly one qualifying field on purpose**, because "exactly one field
 * qualified" is the claim most of the delivery cases rest on, and a page carrying a second would
 * make every one of them report a *refusal* for the wrong reason. Asking is the other claim, and
 * it needs two — so the second is added by the case that asks for it, and only that case pays for
 * it.
 *
 * **Planted rather than rendered through React, and the asymmetry is stated rather than hidden:**
 * this case asserts that a control appears and that *no field was written to*, which needs a real
 * DOM input and no framework. It does not assert anything about React's state on the planted field,
 * and the one case that does assert about React's state uses the field the fixture itself renders.
 *
 * **The field declares `autocomplete="one-time-code"`**, which is the strongest signal the
 * recogniser has and therefore the field least likely to be missed: if a fill would have gone into
 * it unasked, that is the recogniser over-filling rather than under-filling.
 */
export async function plantSecondCodeField(page: Page): Promise<number> {
  return page.evaluate(() => {
    const field = document.createElement("input");
    field.id = "planted-code";
    // **Named, not declared** — see below — and the name carries *two* whole-word code tokens
    // rather than one. That is the shape a real sign-up form uses (`verification_code`), and it
    // is a different signal from the fixture's own field, which is recognised by its
    // declaration.
    field.name = "verification_code";
    // **Deliberately *not* `one-time-code`.** Two fields both declaring it would make the two
    // equivalent signals, and the case could not say whether the product asked because two fields
    // qualified or because it had nothing to go on. The planted one is recognised by its **name**
    // instead, so the asking rule is exercised across two different signals.
    field.setAttribute("autocomplete", "off");
    document.body.append(field);
    return document.querySelectorAll("#code-input, #planted-code").length;
  });
}

/**
 * Remove the fixture's own code field, leaving the page with nothing that qualifies.
 *
 * **The counterpart to {@link plantSecondCodeField}, and it distinguishes two refusals that read
 * almost identically in a popup.** A page with a content script and *no* qualifying field answers
 * `noField`; a page with *no content script* answers nothing at all. Removing the field is how a
 * case reaches the first from the same page that reaches the second.
 *
 * **The existence check is written out rather than chained, and the first version chained.** It read
 * `document.getElementById("code-input")?.remove() !== undefined`, which is **always `false`** —
 * `remove()` returns `undefined` whether it removed anything or there was nothing there, so the
 * expression reported "no field was removed" in both cases. It failed the case that used it, and
 * the failure read as a product defect about a page the product had never been given.
 */
export async function removeFixtureCodeField(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const field = document.getElementById("code-input");
    if (field === null) {
      return false;
    }
    field.remove();
    return true;
  });
}

/**
 * Assert the page's hostile stylesheet is actually firing.
 *
 * **This is a precondition, not an assertion about the product.** Without it, every
 * shadow-isolation assertion below is satisfied by a page that is not hostile at all - which is
 * exactly what the probe version of this fixture did, by serving a stylesheet and never linking
 * it. It reads the **page's own** button, because that is the only element the page's rule is
 * supposed to reach.
 */
export async function expectHostileCssActive(page: Page): Promise<void> {
  const display = await page
    .locator("#not-an-input")
    .evaluate((el) => getComputedStyle(el).display);
  if (display !== "none") {
    throw new Error(
      `the fixture's hostile stylesheet is not firing: the page's own button computes ` +
        `display: ${display}, expected "none". Every shadow-isolation assertion in this file ` +
        `would be satisfied by a page that is not hostile.`,
    );
  }
}
