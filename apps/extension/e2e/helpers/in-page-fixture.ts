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

import type { BrowserContext, Page, Route } from "@playwright/test";

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

/** The label the affordance carries. */
export const LABEL = AFFORDANCE_LABEL;

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

/**
 * Put the fixture's three responses in place on a fresh page.
 *
 * **`origin` is a parameter because the manifest declares two schemes** - see
 * {@link FIXTURE_HTTP_ORIGIN}. It defaults to the `https` origin, so every case that
 * does not care names nothing.
 */
export async function openFixturePage(
  context: BrowserContext,
  origin: string = FIXTURE_ORIGIN,
): Promise<Page> {
  const script = requireBuiltFixture();
  const html = fs.readFileSync(path.join(FIXTURE_DIR, "index.html"), "utf8");

  const page = await context.newPage();

  await page.route(`${origin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === "/" || pathname === "/index.html") {
      await fulfil(route, html, "text/html; charset=utf-8");
      return;
    }
    if (pathname === "/fixture.js") {
      await fulfil(route, script, "text/javascript; charset=utf-8");
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
    [AFFORDANCE_BUTTON_ATTRIBUTE, LABEL] as const,
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
