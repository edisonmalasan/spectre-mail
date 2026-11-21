/**
 * The page's structure and its claims, as the browser actually serves them.
 *
 * ## What this file holds after the temp-mail.org rebuild
 *
 * The five explanatory regions — `steps`, `reasons`, the extension preview and the
 * footer — are gone. So are the landmark and ordering assertions that only made sense
 * when those regions existed. What remains is the part of the old file that still
 * describes the page that ships:
 *
 * - the brand mark is drawn by the page and fetches no asset;
 * - the one filled control is the in-field Copy, painted in the declared accent;
 * - the stylesheet the browser loaded names no colour, radius, spacing step or type
 *   size literally, and the token layer holds no layout primitive;
 * - the page names no licence and no provider other than the one it reaches;
 * - and the four toolbar actions are real, named controls.
 *
 * Two new cases hold the rebuild itself to account: the informational headings that
 * used to explain the product must not reappear, and the stripped-down toolbar must
 * still expose all four actions with accessible names.
 *
 * ## Why the accessibility tree is still read through CDP
 *
 * The old file's landmark assertions needed Chromium's own tree because a role query
 * had once reported `contentinfo` for a footer the platform did not expose it for.
 * Those assertions are gone with the footer, but the habit is kept for the one claim
 * that remains about what a screen reader is offered — the anchor case lives in
 * `verification-actions.spec.ts`, which uses the same `Accessibility.queryAXTree`
 * instrument. This file no longer needs a CDP session.
 *
 * ## What this file deliberately does NOT check
 *
 * **Nothing here says the page looks good.** No test in this repository reads a
 * rendered pixel's colour or position. What follows asserts structure, resolved
 * values and text — three instruments that are exact about what they measure and
 * silent about whether the result is handsome. A human opening the page is the only
 * instrument for that.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";
import type { ProviderTraffic } from "./recorded-provider";

/** The four actions the rebuilt toolbar offers, by test id and accessible name. */
const TOOLBAR_ACTIONS = [
  ["toolbar-copy", "Copy"],
  ["toolbar-refresh", "Refresh"],
  ["toolbar-change", "Change"],
  ["toolbar-delete", "Delete: Clear saved data"],
] as const;

/**
 * Headings from the M7 sections that the G2/M17 reconstruction removed. The footer's
 * "What this page can and cannot do" is NOT here: M17 requires the footer landmark and
 * its accessible name, and the website-client spec pins that name. What stays forbidden is
 * the three removed marketing sections, which M16 measured as absent from the reference.
 */
const REMOVED_HEADINGS = [
  "What happens, in order",
  "Why SpectreMail",
  "The extension, in this browser",
] as const;

/** A page with a mailbox and its provider traffic. */
interface Reading {
  readonly traffic: ProviderTraffic;
}

/** Open the page, established rather than assumed. */
async function openPage(page: Page): Promise<Reading> {
  const traffic = await openFreshMailbox(page);
  await expect(page.getByTestId("ready")).toBeVisible();
  // The toolbar Delete is the one removal control the rebuilt page has. Waiting for
  // it is the same precondition the focus tier reaches through `openSettledMailbox`.
  await expect(page.getByRole("button", { name: "Clear saved data" })).toBeVisible();
  return { traffic };
}

/**
 * The CSS custom property as the browser resolves it, plus the `rgb()` form to compare with.
 *
 * **The comparison is against the resolved token, not against a hex written here.** A hex
 * in this file would be a second copy of the palette's value, and two copies drift —
 * which is the reason `packages/ui` generates `tokens.css` from `tokens.ts` in the first place.
 */
async function resolvedToken(page: Page, name: string): Promise<string> {
  const rgb = await page.evaluate((token) => {
    const declared = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(declared);
    if (hex === null) return `unresolved:${declared}`;
    const value = Number.parseInt(hex[1] as string, 16);

    return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
  }, name);

  if (rgb.startsWith("unresolved:")) {
    throw new Error(`--${name} did not resolve to a six-digit hex: ${rgb}`);
  }
  return rgb;
}

/** All of the page's visible text, whitespace-collapsed. */
function pageText(page: Page): Promise<string> {
  return page.evaluate(() => (document.body.textContent ?? "").replace(/\s+/g, " ").trim());
}

/**
 * The text of every heading the built page renders.
 *
 * Read from the DOM rather than from `pageText`, because the claim is about
 * *headings*: a sentence that happened to contain one of the old section names in a
 * paragraph would be a different fact from a page that still organised itself around
 * them.
 */
function headingTexts(page: Page): Promise<string[]> {
  return page.$$eval("h1, h2, h3, h4, h5, h6", (nodes) =>
    nodes.map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()),
  );
}

/**
 * The stylesheet **as the browser loaded it**, rather than as it is on disk.
 *
 * `motion.spec.ts` reads `apps/web/src/styles.css` from the filesystem, which is the right
 * instrument for a question about what an author wrote. This file's question is different —
 * *what shipped* — and the two can differ: a build can substitute, prepend, or rewrite. So
 * this fetches the stylesheet the page already linked, from the page's own origin, and reads
 * the response the browser would have parsed.
 */
async function servedStylesheet(page: Page): Promise<string> {
  const href = await page.evaluate(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]');
    return link?.href ?? "";
  });
  expect(href, "the built page must link a stylesheet").not.toBe("");

  const css = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return await response.text();
  }, href);

  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Remove the generated token layer's declarations, **by selector rather than by filename**.
 *
 * The page's own stylesheet declares no `:root`; the generated one emits everything inside
 * `:root` blocks. So the boundary is the generator's structure rather than its filename,
 * and the guard in the sweep below fails rather than letting the strip eat real page styles.
 */
function stripGeneratedTokenBlocks(css: string): string {
  let out = "";
  let rest = css;

  for (;;) {
    const start = rest.search(/(^|[{}])\s*:root\s*\{/);
    if (start === -1) {
      out += rest;
      return out;
    }

    const open = rest.indexOf("{", start);
    out += rest.slice(0, start);

    let depth = 0;
    let cursor = open;
    for (; cursor < rest.length; cursor += 1) {
      if (rest[cursor] === "{") depth += 1;
      else if (rest[cursor] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    rest = rest.slice(cursor + 1);
  }
}

/* ── The toolbar the rebuild shipped ──────────────────────────────────────────── */

test.describe("the action toolbar", () => {
  test("the four actions are real buttons with the accessible names they show", async ({
    page,
  }) => {
    await openPage(page);

    const buttons = page.locator(".toolbar__actions button");
    await expect(buttons).toHaveCount(TOOLBAR_ACTIONS.length);

    for (const [testId, name] of TOOLBAR_ACTIONS) {
      const button = page.getByTestId(testId);
      await expect(button, `${testId} is missing`).toHaveCount(1);
      await expect(button, `${testId} is not a button`).toHaveJSProperty("type", "button");
      await expect(
        page.getByRole("button", { name, exact: true }),
        `${testId} does not carry the accessible name "${name}"`,
      ).toHaveCount(1);
    }

    // **The negative control, because a role query that matched nothing would otherwise
    // satisfy every "toHaveCount(1)" above for the wrong reason.** Plant a fifth button,
    // then require the same reader to find it.
    await page.evaluate(() => {
      const toolbar = document.querySelector(".toolbar__actions");
      if (toolbar === null) throw new Error("the toolbar is not on the page");
      toolbar.append(Object.assign(document.createElement("button"), { textContent: "Planted" }));
    });
    await expect(buttons).toHaveCount(TOOLBAR_ACTIONS.length + 1);
    await expect(page.getByRole("button", { name: "Planted", exact: true })).toHaveCount(1);
  });

  test("the rebuilt page does not bring back the old informational sections", async ({ page }) => {
    await openPage(page);

    const headings = await headingTexts(page);
    const present = REMOVED_HEADINGS.filter((phrase) =>
      headings.some((heading) => heading.includes(phrase)),
    );
    expect(
      present,
      "the page exists to hand over an address, not to explain itself in five sections",
    ).toEqual([]);

    // The same is true of the page's whole text: a heading is the usual home for these
    // phrases, but a paragraph reintroducing one would be the same regression wearing a
    // different tag.
    const text = await pageText(page);
    const inText = REMOVED_HEADINGS.filter((phrase) => text.includes(phrase));
    expect(inText, "an old section's words reappeared outside a heading").toEqual([]);

    // **And the reader's positive control.** A sweep that matches nothing satisfies both
    // assertions above forever; planting one of the forbidden headings must turn it red.
    await page.evaluate(() => {
      const heading = document.createElement("h2");
      heading.textContent = "Why SpectreMail";
      document.body.append(heading);
    });
    const afterPlant = await headingTexts(page);
    expect(
      afterPlant.some((heading) => heading.includes("Why SpectreMail")),
      "the same reader must report the heading that was planted",
    ).toBe(true);
  });
});

/* ── The accent reaches its surfaces ──────────────────────────────────────────── */

test.describe("the accent on the surfaces the direction names", () => {
  test("the brand mark resolves to the declared accent, and the wordmark beside it does not", async ({
    page,
  }) => {
    await openPage(page);
    const accent = await resolvedToken(page, "--accent");

    const reading = await page.evaluate(() => {
      const mark = document.querySelector(".wordmark__mark");
      const heading = document.querySelector(".wordmark h1");
      if (mark === null || heading === null) throw new Error("the wordmark is not on the page");
      return {
        mark: getComputedStyle(mark).color,
        heading: getComputedStyle(heading).color,
      };
    });

    expect(reading.mark, "the brand mark carries the accent").toBe(accent);
    // The point of the reset: the accent is on the mark, not on the wordmark. A page that
    // coloured the whole lockup accent would satisfy the first assertion alone.
    expect(reading.heading, "the wordmark keeps the page ink").not.toBe(accent);
  });

  test("the brand mark is drawn by the page, and requests nothing to draw it", async ({ page }) => {
    const { traffic } = await openPage(page);

    // **An inline `<svg>` that draws with a `<path>`.** `<image href>` and `<use>` both
    // defer to a file and neither is an `<img>`, so an `<img>` count of zero used to be a
    // proxy that a file-loading mark satisfied. The assertion is now the thing it names.
    const mark = page.locator(".wordmark__mark");
    await expect(mark).toBeVisible();

    const drawn = await page.evaluate(() => {
      const element = document.querySelector(".wordmark__mark");
      if (element === null) throw new Error("the mark is not on the page");
      return {
        tag: element.tagName.toLowerCase(),
        paths: element.querySelectorAll("path").length,
        deferred: element.querySelectorAll("image, use").length,
      };
    });

    expect(drawn.tag, "the mark is an inline svg, not a replaced element").toBe("svg");
    expect(drawn.paths, "and it draws with a path the page carries").toBeGreaterThan(0);
    expect(
      drawn.deferred,
      "and it defers to no file: <image> and <use> both fetch, and neither is an <img>",
    ).toBe(0);

    // `requested` carries every URL the page asked for whatever its origin; `denied`
    // alone cannot see a same-origin asset the router continued.
    const assets = traffic.requested
      .map((url) => new URL(url).pathname)
      .filter((pathname) => /\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|eot)$/i.test(pathname));

    expect(
      assets,
      "the page must fetch no image or font file: the mark is drawn, and no webfont is loaded",
    ).toEqual([]);
    expect(traffic.denied, "the page must reach no origin it has no recorded response for").toEqual(
      [],
    );
  });

  test("the in-field Copy is the one control filled with the accent", async ({ page }) => {
    await openPage(page);
    const accent = await resolvedToken(page, "--accent");
    const onAccent = await resolvedToken(page, "--ink-on-accent");

    const copy = page.getByTestId("address-copy");
    await expect(copy).toBeVisible();
    await expect(copy, "the in-field control keeps the accessible name a person reads").toHaveCount(
      1,
    );
    await expect(page.getByRole("button", { name: "Copy address", exact: true })).toHaveCount(1);

    const reading = await copy.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });

    expect(reading.background, "the primary action is filled with the accent").toBe(accent);
    expect(reading.color, "its label resolves to the pair the palette declares").toBe(onAccent);

    // **The toolbar's four pills keep their own framing.** Two of them are Copy and Delete,
    // and a restoration of the old page would have painted one of those as the primary
    // action; the whole-page scan below is what catches that rather than a single button.
    const filled = await page.evaluate(() => {
      const accentRgb = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim();
      const hex = /^#([0-9a-f]{6})$/i.exec(accentRgb);
      if (hex === null) throw new Error("--accent is not a six-digit hex");
      const value = Number.parseInt(hex[1] as string, 16);
      const rgb = `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
      return Array.from(document.querySelectorAll("button"))
        .filter((button) => getComputedStyle(button).backgroundColor === rgb)
        .map((button) => button.getAttribute("data-testid") ?? button.textContent?.trim() ?? "");
    });

    expect(filled, "the accent fill belongs to the in-field Copy alone").toEqual(["address-copy"]);
  });
});

/* ── The claims the page makes ────────────────────────────────────────────────── */

test.describe("what the page is allowed to say", () => {
  test("it advertises no provider and claims no licence or own mail servers", async ({ page }) => {
    await openPage(page);
    const text = await pageText(page);

    // The repository carries no LICENSE file and GitHub reports `licenseInfo: null`, so
    // neither an open-source claim nor a named licence can be supported by the page.
    expect(text, "no claim to a licence").not.toMatch(/open[- ]?source|licen[sc]e/i);
    // Word-bounded: "spectremail" contains "mit", which is how a naive sweep passes for
    // the wrong reason and reports a licence that is not there.
    expect(text).not.toMatch(/\b(?:MIT|ISC|GPL|BSD|MPL|Apache)\b/i);

    // GOAL §3: SpectreMail presents as one product, not as an advertisement for a
    // single upstream provider, and never claims to run its own mail servers.
    expect(text, "no provider advertised in the primary interface").not.toContain("Guerrilla Mail");
    expect(text, "no claim to operate mail servers").not.toMatch(/our (own )?mail servers/i);
    // A provider this website cannot reach must not be named as if it were available.
    expect(text, "no provider this website cannot reach").not.toMatch(
      /mail\s*\.?\s*tm|mail\.gw|dropmail/i,
    );

    // **The controls, in both directions.** A reader matching nothing would satisfy both
    // negative assertions above forever, so each is exercised against a planted sentence.
    await page.evaluate(() => {
      const planted = document.createElement("p");
      planted.textContent = "SpectreMail is open source and licensed under MIT.";
      document.body.append(planted);
    });
    expect(await pageText(page), "the licence sweep must fire on a planted claim").toMatch(
      /open[- ]?source|licen[sc]e|\bMIT\b/,
    );

    await page.evaluate(() => {
      const planted = document.createElement("p");
      planted.textContent = "It falls back to Mail.tm automatically.";
      document.body.append(planted);
    });
    expect(await pageText(page), "the provider sweep must fire on a planted name").toMatch(
      /mail\s*\.?\s*tm/i,
    );

    // And the provider-advertising sweep must fire on a planted badge too, so its
    // silence on the shipped page is evidence rather than a pattern that matches nothing.
    await page.evaluate(() => {
      const planted = document.createElement("p");
      planted.textContent = "Guerrilla Mail is our mail provider.";
      document.body.append(planted);
    });
    expect(await pageText(page), "the badge sweep must fire on a planted provider name").toContain(
      "Guerrilla Mail",
    );
  });
});

/* ── The shipped stylesheet ───────────────────────────────────────────────────── */

test.describe("the stylesheet the browser actually loaded", () => {
  test("it names no colour, radius, spacing step, or type size literally", async ({ page }) => {
    await openPage(page);
    const served = await servedStylesheet(page);

    // The guard, before the sweep: if the page's own stylesheet ever declared a `:root`,
    // the strip below would eat real styles and under-report — the direction that lets a
    // violation through.
    const authored = readFileSync(
      fileURLToPath(new URL("../src/styles.css", import.meta.url)),
      "utf8",
    );
    expect(
      authored.match(/(^|[{}])\s*:root\s*\{/g) ?? [],
      "the page's own stylesheet must declare no :root, or the token strip would hide real styles",
    ).toEqual([]);

    const css = stripGeneratedTokenBlocks(served);

    // The token layer really is excluded, and it really does hold colours — otherwise the
    // sweep below could be passing on a strip that removed everything.
    expect(served).toMatch(/#[0-9a-f]{6}\b/i);
    expect(css).not.toMatch(/#[0-9a-f]{6}\b/i);

    // Every component of every value must be a token reference or a permitted keyword.
    const PERMITTED = new Set([
      "0",
      "auto",
      "none",
      "inherit",
      "initial",
      "unset",
      "revert",
      "normal",
      "center",
      "baseline",
      "stretch",
      "start",
      "end",
      "left",
      "right",
      "top",
      "bottom",
      "currentcolor",
      "transparent",
      "solid",
      "border-box",
    ]);
    const isLiteral = (value: string): string[] =>
      value
        .split(/[\s,]+/)
        .filter(Boolean)
        .filter((part) => !/^var\(--[\w-]+\)$/.test(part) && !PERMITTED.has(part.toLowerCase()));

    const properties: readonly [string, RegExp][] = [
      ["radius", /border-radius:\s*([^;}]+)/g],
      ["spacing", /(?:margin|padding)(?:-[a-z]+)?:\s*([^;}]+)/g],
      ["type size", /font-size:\s*([^;}]+)/g],
    ];

    for (const [label, pattern] of properties) {
      const found = [...css.matchAll(pattern)]
        .flatMap((match) => isLiteral(match[1] ?? ""))
        .map((part) => part);
      expect(found, `the shipped stylesheet must not name a ${label} literally`).toEqual([]);
    }

    const colours = css.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/g) ?? [];
    expect(colours, "the shipped stylesheet must not name a colour literally").toEqual([]);
  });

  test("the layout arrangement is written in the client, not named as a token", async ({
    page,
  }) => {
    await openPage(page);
    const css = await servedStylesheet(page);

    // `packages/ui` documents "not layout", and a `--grid-columns` token would be the thing
    // that ends that clause. It must not arrive in the same change that first wanted one.
    const tokens = await page.evaluate(() =>
      Array.from(getComputedStyle(document.documentElement))
        .map((property) => property.trim())
        .filter((property) => property.startsWith("--"))
        .map((property) => property.split(":")[0] ?? ""),
    );

    expect(
      tokens.filter((token) => /grid|column|breakpoint|gutter/.test(token)),
      "the token layer must hold no layout primitive",
    ).toEqual([]);
    // And the arrangement itself is present, so the sweep is not passing on an empty file.
    expect(css).toContain("grid-template-columns");
  });
});
