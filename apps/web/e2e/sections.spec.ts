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
 * The extension popup's own copy, read from the extension's source.
 *
 * ## Why this spec imports across the client boundary, when `design.md` D3 declines to
 *
 * **This is a test file and nothing else.** D3's measurement was that no *shipped source* file
 * in either client imports the other, and that an import would put `apps/extension/src` into
 * `apps/web`'s build graph. A Playwright spec is not shipped, is not in the `apps/web` `tsconfig`
 * include set's build path, and cannot be reached by a user - so it does not create the
 * coupling D3 refused, and it is the same shape as `apps/extension/src/provider-config.test.ts`
 * reading `packages/providers/src/fixtures`.
 *
 * **What it buys is that the assertion is not a proxy.** Without it, the labels case could only
 * compare what is on the page against `EXTENSION_PREVIEW`'s own declarations - which the unit
 * tier already covers, and which a component would satisfy by faithfully rendering declared data
 * while the popup had since said something else. Reading the popup's real copy is what makes
 * the chain whole: declared, rendered, and the value the popup itself holds.
 */
import { POPUP_COPY } from "../../extension/src/popup-copy";

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

/**
 * The roles a depiction must never expose, as a set for membership tests against a tree read.
 *
 * **Read from the tree rather than counted in the markup**, and the list is deliberately wide:
 * a `<div role="switch">` is as operable to a keyboard user as a `<button>`, and the obvious
 * next idea for this section - "and a button to install it" - arrives as a `link` far more often
 * than as a `button`. `list` and `listitem` are deliberately **absent**: the depiction is built
 * from lists, and a list is not something a reader can operate.
 *
 * **`text`, `image` and `img` are absent for the opposite reason.** They are not operable, and a
 * first draft of this list included them - which would have made the sweep fire on Chromium's
 * own `StaticText` nodes for every label in the depiction. That is the shape of a rule wider
 * than the rule it documents, and it was removed here rather than by rewording the pattern until
 * the assertion went quiet.
 */
const OPERABLE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "switch",
  "radio",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "textbox",
  "searchbox",
  "combobox",
  "slider",
  "spinbutton",
]);

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
 * Each region's own text, keyed by its `data-region` hook.
 *
 * ## Why a per-region map rather than the page's text
 *
 * **Two assertions in this file were whole-page and became false the moment the extension
 * preview shipped** - "no region previews the extension" and "no region names a second
 * provider". Neither is a fact about the page any more; both are facts about *regions*, and a
 * whole-page sweep can no longer say which region is at fault or exempt the one region that is
 * allowed to differ. Reading each region's own text makes the exemption explicit and names the
 * offender when the sweep fires.
 *
 * **The exemption is a named list rather than a pattern.** `EXEMPT_FROM_*` below is a set of
 * region hooks, so adding a region that legitimately contains the word is a visible edit to a
 * list rather than a pattern quietly widened - which is the shape a check narrower than its rule
 * takes, and this repository has recorded that defect many times.
 */
async function regionTexts(page: Page): Promise<Map<string, string>> {
  const entries = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-region]")).map((element) => [
      element.getAttribute("data-region") ?? "",
      (element.textContent ?? "").replace(/\s+/g, " ").trim(),
    ]),
  );
  return new Map(entries as [string, string][]);
}

/**
 * The accessibility roles Chromium exposes **within one element's subtree**.
 *
 * ## Why `queryAXTree` and not `getFullAXTree`
 *
 * The existing landmark assertions need the whole tree because a landmark's identity *is* its
 * position in the tree - that is the defect the footer case turns on. This case is different:
 * it asks whether a *particular region* exposes anything operable, and a whole-tree read
 * cannot answer it, because the page legitimately exposes several buttons in the product
 * region and the removal control in the footer's region. Answering by exclusion would be
 * reasoning about which buttons "belong" to the preview, and that reasoning is exactly the
 * judgement the tree should make instead.
 *
 * **So the tree is queried at the region's own DOM node**, and Chromium does the scoping.
 * `Accessibility.queryAXTree` takes an `objectId`; it is obtained by evaluating the selector in
 * the page and asking for the returned handle rather than its value.
 *
 * **Still Chromium's own tree, not a role query.** The same header argument applies with more
 * force here, not less: the claim is about what a screen reader is offered, so it is read from
 * the platform's model of that rather than from this repository's guess at it.
 */
async function axRolesWithin(cdp: CDPSession, selector: string): Promise<string[]> {
  const { result } = (await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})`,
  })) as { result: { objectId?: string } };

  expect(result.objectId, `the page must render ${selector}`).toBeTruthy();

  const { nodes } = (await cdp.send("Accessibility.queryAXTree", {
    objectId: result.objectId as string,
  })) as { nodes: { role?: { value?: string }; ignored?: boolean }[] };

  return nodes
    .filter((node) => node.ignored !== true)
    .map((node) => node.role?.value ?? "")
    .filter((role) => role !== "");
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

  test("only the preview region mentions the extension, and no region promises it", async ({
    page,
  }) => {
    await openWithTree(page);

    // **Rescoped by `data-region`, and the rescope is the substance of this case.**
    //
    // It read `expect(text).not.toMatch(/\bextension\b/i)` over the whole page, on the stated
    // ground that `apps/extension` held no MV3 manifest and so there was nothing to preview.
    // M8 built the extension, which made the assertion false the moment the section shipped -
    // and a whole-page sweep is now the wrong instrument even though the underlying rule is
    // not. What `page-composition` actually requires is that no region *describes a surface as
    // absent or forthcoming*, and the region that legitimately mentions the extension is the
    // one describing it.
    //
    // **So the rule is per-region with a named exemption**, and the sweep reads each region's
    // own text rather than the page's. That is what lets the failure name the region.
    const PREVIEW = "extension";
    const texts = await regionTexts(page);

    expect(
      texts.has(PREVIEW),
      "the preview region must exist - this sweep only makes sense once it does",
    ).toBe(true);

    const offenders = [...texts.entries()]
      .filter(([region, text]) => region !== PREVIEW && /\bextension\b/i.test(text))
      .map(([region]) => region);
    expect(offenders, "no region other than the preview may mention the extension").toEqual([]);

    // The rule that is *not* rescoped, because it was never about absence: no region may
    // describe anything as forthcoming. The preview is included, and is the region most likely
    // to slip - it describes a surface that has no download - so the exemption deliberately does
    // not cover it.
    const promising = [...texts.entries()]
      .filter(([, text]) =>
        /coming soon|not yet available|forthcoming|will be available/i.test(text),
      )
      .map(([region]) => region);
    expect(promising, "no region may describe absent work as forthcoming").toEqual([]);

    // **The negative control for the sweep, planted into the running page.** Without it, a
    // sweep that matched nothing would satisfy every assertion above, and the exemption would
    // be indistinguishable from a pattern that silently stopped firing. `sections.spec.ts`
    // already plants the footer defect for the same reason; this is the other whole-page sweep
    // this file has, and it gets the same treatment.
    await page.evaluate(() => {
      const reasons = document.querySelector('[data-region="reasons"]');
      if (reasons === null) throw new Error("no reasons region to plant into");
      const planted = document.createElement("p");
      planted.textContent = "A SpectreMail extension is on its way.";
      reasons.append(planted);
    });

    const afterPlant = await regionTexts(page);
    const plantedOffenders = [...afterPlant.entries()]
      .filter(([region, text]) => region !== PREVIEW && /\bextension\b/i.test(text))
      .map(([region]) => region);
    expect(
      plantedOffenders,
      "the same sweep must report the region the word was planted in",
    ).toEqual(["reasons"]);
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
    //
    // **Rescoped by `data-region`, and here the rescope strengthens the rule rather than
    // merely relocating it.** It read as one whole-page sweep, which cannot say *which* region
    // made the claim - and a new region is exactly where a second provider would be named by
    // accident, the way a preview of an extension that names its two providers would be. So the
    // sweep is per-region, the preview is **not** exempt (`design.md` D4: it names no provider),
    // and the failure names the region.
    const texts = await regionTexts(page);
    const secondProviders = [...texts.entries()]
      .filter(([, regionText]) => /mail\s*\.?\s*tm/i.test(regionText))
      .map(([region]) => region);
    expect(secondProviders, "no region may name a provider this website cannot reach").toEqual([]);

    // **And the control.** `Guerrilla Mail` is in the footer and the word-bounded licence sweep
    // above passes over "mit", so a sweep that matched loosely would report regions it has no
    // business reporting - which is how a rule wider than the rule it documents survives. This
    // half pins the other direction: the sweep must fire on the name it exists to catch.
    await page.evaluate(() => {
      const footer = document.querySelector('[data-region="footer"]');
      if (footer === null) throw new Error("no footer region to plant into");
      const planted = document.createElement("p");
      planted.textContent = "Falls back to Mail.tm automatically.";
      footer.append(planted);
    });

    const afterPlant = await regionTexts(page);
    const plantedProviders = [...afterPlant.entries()]
      .filter(([, regionText]) => /mail\s*\.?\s*tm/i.test(regionText))
      .map(([region]) => region);
    expect(
      plantedProviders,
      "the same sweep must report the region the second provider was named in",
    ).toEqual(["footer"]);
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

/* ── The extension preview ─────────────────────────────────────────────────────── */

test.describe("the extension preview depicts, and does not act", () => {
  test("no element inside the preview exposes an operable role", async ({ page }) => {
    const { cdp } = await openWithTree(page);

    // **Read from Chromium's tree at the region's own node**, not from the whole page and not
    // from a DOM query. `design.md` D2 forbids the depiction rendering *any* interactive
    // element, and there are three ways to check that badly, each caught somewhere in this
    // repository's history:
    //
    // - counting `button` elements, which a `<div role="button">` satisfies;
    // - `getByRole`, which is the instrument that reported `contentinfo` for a footer Chromium
    //   does not expose it for;
    // - reading the whole page's tree and excluding the buttons it "knows" belong elsewhere,
    //   which substitutes this repository's judgement for the platform's.
    //
    // `Accessibility.queryAXTree` scoped to the region's object does none of those: Chromium
    // decides what is inside the region, and reports what a screen reader would be offered.
    const roles = await axRolesWithin(cdp, '[data-region="extension"]');

    expect(
      roles.filter((role) => OPERABLE_ROLES.has(role)),
      "the preview must expose nothing operable",
    ).toEqual([]);

    // **And the region is not concealed.** `aria-hidden` would pass every assertion above by
    // removing the subtree from the tree entirely, which is the wrong way to satisfy D2: it
    // achieves non-interactivity by hiding the depiction from the reader entitled to it. So the
    // subtree must actually be present in the tree, which is what makes the role sweep above a
    // reading about this region rather than about a region that was never there.
    expect(roles.length, "the preview's subtree is present in the tree").toBeGreaterThan(3);

    // **The negative control, planted into the running page.** A subtree-scoped tree query that
    // silently returned nothing would satisfy the first assertion for the wrong reason - the
    // failure this repository has recorded repeatedly is a check narrower than the rule it
    // documents, and a region emptied of content is the cheapest way to produce one.
    await page.evaluate(() => {
      const region = document.querySelector('[data-region="extension"]');
      if (region === null) throw new Error("no preview region to plant into");
      region.append(Object.assign(document.createElement("button"), { textContent: "Install" }));
    });

    const afterPlant = await axRolesWithin(cdp, '[data-region="extension"]');
    expect(
      afterPlant.filter((role) => OPERABLE_ROLES.has(role)),
      "the same reader must report the control planted inside the region",
    ).toContain("button");
  });

  test("every label the built preview shows is one the popup renders", async ({ page }) => {
    await openWithTree(page);

    // **The rendered labels, from the served page** - not from `EXTENSION_PREVIEW`'s
    // declarations. Reading the declarations would be a proxy satisfied by a component that
    // renders its own data faithfully while the popup had renamed a label underneath it, which
    // is the exact failure this case exists to catch and which `popup-copy.test.ts` provably
    // cannot catch either (see `tasks.md` 1.2).
    const rendered = await page.$$eval(".preview__label", (nodes) =>
      nodes.map((node) => (node.textContent ?? "").trim()),
    );

    expect(rendered.length, "the preview must render a depiction at all").toBeGreaterThan(0);

    // **The popup's string-valued copy, as a set**, so the check is "this is a string the popup
    // holds" rather than "this matches one specific entry" - the requirement is about the
    // correspondence being honest, and which entry a given label corresponds to is 2.3's
    // named assertion rather than this one's business.
    //
    // **The cast is required and its reason is recorded rather than worked around.**
    // `POPUP_COPY` is `as const`, so `Object.values` is typed as a union of string literals and
    // a `value is string` predicate is not a narrowing of it. Widening the parameter type here
    // says the same thing a reader of the assertion needs: this cares about the runtime shape,
    // not about the extension's compile-time guarantee about its own copy.
    const popupStrings = new Set(
      Object.values(POPUP_COPY as Record<string, unknown>).filter(
        (value): value is string => typeof value === "string",
      ),
    );

    const unknown = rendered.filter((label) => !popupStrings.has(label));
    expect(
      unknown,
      "the preview must show only strings the popup itself renders - a picture of the popup " +
        "that is quietly wrong about the popup is worse than no picture",
    ).toEqual([]);
  });

  test("the preview names no capability the extension has declared absent", async ({ page }) => {
    await openWithTree(page);
    const texts = await regionTexts(page);
    const preview = texts.get("extension") ?? "";

    expect(preview, "the preview region must be readable").not.toBe("");

    // **Each of these is an absence this repository has specified, not a guess.**
    // `extension-client` requires the popup to be a popup only: no content script and no side
    // panel are built (M9 and M11 own them), no notification is delivered, and no code is
    // copied or filled anywhere in the product (M10). The preview describes the extension, so
    // naming any of them would be the page describing a product that does not exist - which is
    // the defect `page-composition`'s *"A section depicts another surface"* scenario is about.
    //
    // **The words are listed, not derived from a manifest.** `manifest.json` declares no
    // content script today, and deriving the forbidden list from it would make the list shrink
    // silently as the manifest grows - so the day M9 adds one, this assertion would stop
    // complaining about the page's mention of it. The list is the requirement.
    const forbidden = [
      "content script",
      "side panel",
      "side bar",
      "notification",
      "notifies you",
      "one-time code",
      "verification code",
      "autofill",
      "fill in the code",
      "copies the code",
    ];
    const named = forbidden.filter((phrase) =>
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(preview),
    );
    expect(named, "the preview must name no capability the extension does not have").toEqual([]);

    // **And no cadence.** The popup's count comes from a check the user asked for, and
    // `website-client` requires this page to state no interval it cannot support. A figure in
    // this region would be an invention presented as a measurement - and an *inherited* one,
    // because the extension does have an alarm of its own, whose packing interval is unmeasured.
    expect(preview, "the preview must state no polling interval").not.toMatch(
      /\b\d+\s*(?:s|sec|secs|second|seconds|m|ms|min|mins|minute|minutes)\b/i,
    );
  });
});
