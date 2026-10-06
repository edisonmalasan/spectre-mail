/**
 * The page's sections, as the browser's own accessibility tree reports them.
 *
 * ## Why this file exists, and what it is the only instrument for
 *
 * Two claims this change makes are about **the document's structure**, and neither can be
 * checked by reading markup or by a unit test in jsdom:
 *
 * - **the regions render in the stated order**, and
 * - **every region is reachable by its own accessible name**.
 *
 * The order is a requirement rather than a description, and the only place it is visible is
 * the DOM a browser builds from the built page.
 *
 * ## The defect this file was written after, and it is the reason it reads CDP
 *
 * **The first version of this change put the limits list in a `<footer>` nested inside
 * `<main>`, and the client suite passed.** ARIA forbids `contentinfo` as a descendant of
 * `main`, and Testing Library maps `footer` to `contentinfo` unconditionally — so
 * `getByRole("contentinfo", { name: ... })` was green on a role the user's screen reader
 * never receives.
 *
 * **Chromium was then asked directly**, over CDP's `Accessibility.getFullAXTree`, which is
 * the platform's own tree rather than this repository's guess at it:
 *
 * ```text
 * roles: RootWebArea=1  main=1  sectionfooter=1  region=4 ...
 * landmarks Chromium exposes:  main, 4 regions
 * contentinfo landmarks exposed: 0
 * the element itself: {"tag":"FOOTER","parent":"MAIN","role":null}
 * ```
 *
 * Zero. Not one — **zero**, while jsdom said one. After the footer became a sibling of
 * `<main>`:
 *
 * ```text
 * roles: ... contentinfo=1 region=5 ...
 * contentinfo landmarks exposed: 1
 *   "What this page can and cannot do"
 * ```
 *
 * That is `website-client`'s *"A substitute platform hid the defect"* scenario happening on
 * a change that had no excuse: jsdom is a substitute for the platform, and it disagreed.
 * **So the landmark assertions below read Chromium's accessibility tree through CDP rather
 * than through a role query**, because a role query is the instrument that lied. Playwright's
 * own `getByRole` is not used for landmarks for the same reason.
 *
 * ## What this file deliberately does NOT check
 *
 * **Nothing here says the page looks good.** No test in this repository reads a rendered
 * pixel's colour or position. What follows asserts structure, resolved values, and text —
 * three instruments that are exact about what they measure and completely silent about
 * whether the result is handsome. A human opening the page is the only instrument for that.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test, type CDPSession, type Page } from "@playwright/test";

import { openFreshMailbox } from "./open-mailbox";
import type { ProviderTraffic } from "./recorded-provider";

/**
 * The page's region order, as declared.
 *
 * ## Why this is imported from the client's own module
 *
 * **The expected value and the implementation share a source, and that is the point.**
 * `PAGE_ORDER` is the declaration the requirement names; the check is that **the DOM a
 * browser built from the built page agrees with it**. Importing it is what makes the
 * assertion about agreement rather than about a literal list copied into a spec file, which
 * would drift the moment a region was added.
 *
 * **What it does not catch**, stated so a reader is not misled: a change that edited
 * `PAGE_ORDER` *and* the JSX to match would pass. That is a specification change and belongs
 * in review; no test can distinguish it from a correct implementation, and pretending
 * otherwise would be the assertion-aimed-at-the-file mistake this repository keeps
 * recording.
 */
import { PAGE_ORDER } from "../src/sections";

/** One landmark or region as Chromium's accessibility tree reports it. */
interface AxNode {
  readonly role: string;
  readonly name: string;
}

/** A page with a mailbox, its provider traffic, and its CDP session. */
interface Reading {
  readonly traffic: ProviderTraffic;
  readonly cdp: CDPSession;
}

/**
 * Open the page and attach to Chromium's accessibility tree.
 *
 * **CDP is Chromium-only, and that is why this suite is Chromium-only** — a deliberate
 * configuration rather than an oversight. `Accessibility.getFullAXTree` is the instrument
 * that found the defect above; there is no cross-engine equivalent reachable from here, and
 * adding a project per engine would turn "verified" into "verified somewhere" without adding
 * evidence about the claim.
 */
async function openWithTree(page: Page): Promise<Reading> {
  const traffic = await openFreshMailbox(page);

  // **`ready`, not merely an address.** Two conditions, both established rather than
  // guessed: `ready` is the state in which the whole product is on screen, and the removal
  // control only exists once the boot read has finished — so waiting for it is what makes
  // "the removal control is not filled" a reading about a page that has one. This is the
  // same precondition `focus.spec.ts` reaches through `openSettledMailbox`, and the two are
  // deliberately the same shape rather than the same function, because the focus tier's
  // version exists to serve a control walk and this one exists to serve a tree read.
  await expect(page.getByTestId("ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear saved data" })).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  return { traffic, cdp };
}

/**
 * Every non-ignored node in Chromium's accessibility tree, as role and name.
 *
 * **Through CDP, not `getByRole`,** for the reason in this file's header: the role query is
 * the instrument that reported `contentinfo` for a footer the platform does not expose it
 * for.
 */
async function axNodes(cdp: CDPSession): Promise<AxNode[]> {
  const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
    nodes: { role?: { value?: string }; name?: { value?: string }; ignored?: boolean }[];
  };
  return nodes
    .filter((node) => node.ignored !== true)
    .map((node) => ({ role: node.role?.value ?? "", name: node.name?.value ?? "" }));
}

/**
 * The CSS custom property as the browser resolves it, plus the `rgb()` form to compare with.
 *
 * **The comparison is against the resolved token, not against a hex written here.** A hex
 * in this file would be a second copy of the palette's value, and two copies drift — which
 * is the reason `packages/ui` generates `tokens.css` from `tokens.ts` in the first place.
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
 * ## Why the first version of this sweep was wrong in the dangerous direction
 *
 * The first run of the colour assertion failed with twenty-eight hex values, and **every one
 * of them was correct to be there**: the served bundle includes `tokens.css`, whose entire
 * job is to be the file where a hex lives. A sweep that reports the token layer's own values
 * as literals is a rule broader than the rule it documents — the shape that reads as a
 * defect, cries wolf, and gets deleted.
 *
 * ## Why `:root` is the boundary and not a path
 *
 * `tokens.css` emits exactly two blocks, `:root` and `:root` inside a dark-scheme media
 * query, and **every hex it holds is inside one of them.** The page's own stylesheet
 * declares no `:root` at all. So the boundary is the generator's structure rather than its
 * filename, which means this sweep still measures what shipped if a build inlines the tokens
 * into the bundle instead of linking them — and it would keep working if the token file were
 * renamed.
 *
 * **And the guard below is what stops the strip from hiding real page styles.** A rule that
 * excludes a block it cannot see inside is a rule that can under-report, which is the
 * direction that lets a violation through. So the sweep first requires that the page's own
 * stylesheet declares no `:root`: if it ever does, this assertion fails rather than the
 * strip quietly eating it.
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

    // Walk to the matching brace so a nested block is consumed whole.
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

/* ── The order ───────────────────────────────────────────────────────────────── */

test.describe("the page's regions, in the order it states", () => {
  test("the DOM renders the regions in the declared order", async ({ page }) => {
    await openWithTree(page);

    // Read from the built page's DOM, in document order.
    const rendered = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-region]")).map(
        (element) => element.getAttribute("data-region") ?? "",
      ),
    );

    expect(
      rendered,
      "the page must render exactly the regions it declares, in the declared order",
    ).toEqual([...PAGE_ORDER]);
  });

  test("every region is reachable by its own accessible name in Chromium's tree", async ({
    page,
  }) => {
    const { cdp } = await openWithTree(page);
    const nodes = await axNodes(cdp);

    /** The name Chromium gives each region hook, read off the same tree. */
    const named = nodes.filter((node) => node.name !== "" && node.role === "region");
    const contentinfo = nodes.filter((node) => node.role === "contentinfo");

    // The product region is named by the page's own `<h1>`.
    expect(
      named.map((node) => node.name),
      "the product region must be named",
    ).toContain("SpectreMail");
    expect(named.map((node) => node.name)).toContain("What happens, in order");
    expect(named.map((node) => node.name)).toContain("Why SpectreMail");

    // The footer's landmark, and its accessible name, unchanged from where the list used
    // to be. `website-client`'s delta requires the limits to travel with their content.
    expect(contentinfo, "the limits list must be a contentinfo landmark").toHaveLength(1);
    expect(contentinfo[0]?.name).toBe("What this page can and cannot do");
  });

  test("no region previews the extension, and no region promises it", async ({ page }) => {
    await openWithTree(page);
    const text = await pageText(page);

    // `apps/extension` is an empty placeholder with no MV3 manifest, so there is nothing to
    // preview. `page-composition` requires the absence to go undescribed, so this checks
    // both halves: no preview, and no "coming soon".
    expect(text).not.toMatch(/\bextension\b/i);
    expect(text).not.toMatch(/coming soon|not yet available|forthcoming/i);
  });
});

/* ── The landmark the substitute platform hid ────────────────────────────────── */

test.describe("the footer is a landmark the platform exposes", () => {
  test("nesting the footer inside <main> removes the landmark, which is what the check reads", async ({
    page,
  }) => {
    const { cdp } = await openWithTree(page);

    // **The negative control, and it is the most important assertion in this file.**
    //
    // Every landmark assertion above is of the form "Chromium exposes contentinfo", and an
    // assertion of that form is satisfied by a reader that returns the same answer always.
    // So the exact defect this file was written after is planted into the running page —
    // the footer moved inside `<main>`, which is where it was in the first version of this
    // change — and **the same reader** must report the landmark gone.
    //
    // Without this, a reader that reported `contentinfo` for any page would pass every
    // landmark test in the file.
    const before = (await axNodes(cdp)).filter((node) => node.role === "contentinfo");
    expect(before, "the precondition: the page starts with the landmark").toHaveLength(1);

    await page.evaluate(() => {
      const footer = document.querySelector("footer");
      const main = document.querySelector("main");
      if (footer === null || main === null) throw new Error("the page lost its structure");
      main.appendChild(footer);
    });

    const after = (await axNodes(cdp)).filter((node) => node.role === "contentinfo");
    expect(
      after,
      "a <footer> inside <main> is not a contentinfo landmark, and that is why it does not live there",
    ).toHaveLength(0);
  });
});

/* ── The accent reaches its three surfaces ───────────────────────────────────── */

test.describe("the accent on the surfaces the direction names", () => {
  test("the brand mark resolves to the declared accent, and the wordmark beside it does not", async ({
    page,
  }) => {
    await openWithTree(page);
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
    const { traffic } = await openWithTree(page);

    // **An inline `<svg>` that draws with a `<path>`.** The alternatives were a webfont, an
    // SVG file, and an image; all three make a request, and a third-party one breaks
    // `visual-system`'s no-external-asset rule outright.
    //
    // **This half is new, and the mutation record is why.** The first version asserted
    // `page.locator("img").count() === 0` and nothing else — and **that mutation survived**:
    // `<image href="/mark.svg">` inside the `<svg>` is not an `<img>`, so the count was still
    // zero. The assertion was a **proxy** for *"the page draws it"*, and a proxy was satisfied
    // by a form of loading it nobody had thought about. So the mark is now required to *be*
    // the drawn thing, and to contain nothing that defers to a file.
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

    // **And the request record, which is the half the first version was missing entirely.**
    // `traffic.denied` cannot see this: the site's own origin is `continue()`d, so a page
    // downloading `/mark.svg` produced a request that nothing in this repository observed.
    // `requested` carries every URL the page asked for whatever its origin.
    //
    // **The filter is on the file extension, not on the word "mark"**, because the point is
    // not that no file called `mark` was fetched — it is that **nothing was fetched in order to
    // draw anything.** A webfont is the same violation wearing a different extension, and a
    // rule that only knew about `.svg` would have let it through.
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

  test("the primary action is filled with the accent and keeps the accessible name it had", async ({
    page,
  }) => {
    await openWithTree(page);
    const accent = await resolvedToken(page, "--accent");
    const onAccent = await resolvedToken(page, "--ink-on-accent");

    const button = page.getByRole("button", { name: "Replace address" });
    await expect(button).toBeVisible();

    const reading = await page.evaluate(() => {
      const element = document.querySelector(".control--primary");
      if (element === null) throw new Error("no control carries the primary treatment");
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });

    expect(reading.background, "the primary action is filled with the accent").toBe(accent);
    expect(reading.color, "its label resolves to the pair the palette declares").toBe(onAccent);

    // **The name is the half that matters.** `website-client`'s delta requires the
    // treatment not to change the accessible name or the effect, and a restyled control
    // that also renamed itself would still pass a colour assertion.
    await expect(page.getByRole("button", { name: "Replace address" })).toHaveCount(1);
  });

  test("nothing but the primary action is filled, and the removal control keeps its framing", async ({
    page,
  }) => {
    await openWithTree(page);

    const filled = await page.evaluate(() => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const hexToRgb = (hex: string): string => {
        const value = Number.parseInt(hex.replace("#", ""), 16);

        return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
      };
      const accentRgb = hexToRgb(accent);
      return Array.from(document.querySelectorAll("button"))
        .filter((button) => getComputedStyle(button).backgroundColor === accentRgb)
        .map((button) => (button.textContent ?? "").replace(/\s+/g, " ").trim());
    });

    // **`LocalData`'s removal is destructive, and a destructive control wearing the
    // product's most emphatic treatment would be a design error** whatever the Accent
    // block says. `design.md` D6 records it.
    expect(filled, "the accent fill belongs to the one forward action").toEqual([
      "Replace address",
    ]);
  });
});

/* ── The claims the copy makes ──────────────────────────────────────────────── */

test.describe("what the sections are allowed to say", () => {
  test("no region names a licence, and the page says which provider it reaches", async ({
    page,
  }) => {
    await openWithTree(page);
    const text = await pageText(page);

    // **The repository carries no `LICENSE` file and GitHub reports `licenseInfo: null`.**
    // The roadmap's fifth section is an *open-source* footer; the item was audited away
    // rather than satisfied by a claim the page cannot support. `page-composition` requires
    // this absence, so it is asserted rather than left to review.
    expect(text, "no region may claim a licence").not.toMatch(/open[- ]?source|licen[sc]e/i);
    // Word-bounded throughout: `limits` contains "mit", which is how a naive sweep passes
    // for the wrong reason and reports a licence that is not there.
    expect(text).not.toMatch(/\b(?:MIT|ISC|GPL|BSD|MPL|Apache)\b/);

    // The provider sentence is the measured CORS fact and it must still be true.
    expect(text).toContain("Guerrilla Mail");
    // And no second provider may be named: the website reaches one, for the reason
    // `provider-config.ts` records, and a footer implying redundancy would be the loudest
    // false claim available.
    expect(text).not.toMatch(/mail\s*\.?\s*tm/i);
  });

  test("the third step does not claim the page can delete a message", async ({ page }) => {
    await openWithTree(page);
    const steps = page.locator(".steps");

    await expect(steps).toContainText("Discard");
    // The provider owns the mail and no control anywhere in this product removes one, so a
    // step that read as "the mail is deleted" would name a capability the page lacks.
    await expect(steps).not.toContainText(/delete|destroy|erase|remove the message|burn/i);
  });

  test("the footer's limits are the ones that moved, not a summary of them", async ({ page }) => {
    await openWithTree(page);
    const footer = page.locator(".footer");

    // `website-client`'s delta requires the limits to travel with their content intact, so
    // these are the sentences rather than a paraphrase of them.
    await expect(footer).toContainText("Guerrilla Mail and nothing else");
    await expect(footer).toContainText("does not copy codes or follow links");
    await expect(footer).toContainText("no backend");

    // **And the storage subject is a pointer, not a restatement.** What this device keeps
    // is owned by the region beside its removal control. A limit list that repeats a
    // storage guarantee is the claim this page deleted once already.
    await expect(footer).not.toContainText(/no button|deleted|erased|forgotten automatically/i);
  });
});

/* ── The shipped stylesheet ─────────────────────────────────────────────────── */

test.describe("the stylesheet the browser actually loaded", () => {
  test("it names no colour, radius, spacing step, or type size literally", async ({ page }) => {
    await openWithTree(page);
    const served = await servedStylesheet(page);

    // **The guard, before the sweep.** `stripGeneratedTokenBlocks` removes `:root` blocks on
    // the strength of the generator emitting its tokens there and nowhere else. If the page's
    // own stylesheet ever declared a `:root`, the strip would eat real page styles and the
    // sweep would under-report — which is the direction that lets a violation through. So
    // the premise is asserted rather than trusted.
    const authored = readFileSync(
      fileURLToPath(new URL("../src/styles.css", import.meta.url)),
      "utf8",
    );
    expect(
      authored.match(/(^|[{}])\s*:root\s*\{/g) ?? [],
      "the page's own stylesheet must declare no :root, or the token strip would hide real styles",
    ).toEqual([]);

    const css = stripGeneratedTokenBlocks(served);

    // **The token layer really is excluded, and it really does hold colours** — otherwise
    // the sweep below could be passing on a strip that removed everything.
    expect(served).toMatch(/#[0-9a-f]{6}\b/i);
    expect(css).not.toMatch(/#[0-9a-f]{6}\b/i);

    // **Every component of every value in the five categories must be a token reference or
    // a permitted keyword.** Testing the whole value rather than a single `var()` is the
    // third version of this scan; the first counted `border-radius: var(--radius-md)` as a
    // literal, and fixing that with a single-value test still reported `0 0 var(--space-2)`
    // as one. A check that cries wolf gets deleted, so it is worth getting right.
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

    // A colour, in any of the four notations that would survive a minifier.
    const colours = css.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/g) ?? [];
    expect(colours, "the shipped stylesheet must not name a colour literally").toEqual([]);

    // **Coverage, stated because a measurement that silently measures less than the
    // sentence beside it is the defect rather than the measurement.** This covers five
    // categories and says nothing about grid columns, breakpoints, or `translate` distances,
    // which `motion.spec.ts` covers for motion and `design.md` D4 covers for layout.
  });

  test("the layout arrangement is written in the client, not named as a token", async ({
    page,
  }) => {
    await openWithTree(page);
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
