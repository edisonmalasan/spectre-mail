/**
 * The website's document metadata, as the browser actually serves it.
 *
 * ## Why the source is read here too
 *
 * `tests/architecture/document-metadata.test.ts` reads `index.html` **as a build input**, which is
 * the only way to check the file a maintainer edits. What it cannot say is whether Vite shipped that
 * file: a broken build could serve an older copy, and the architecture case would still pass. So
 * this file reads the same source and compares it to the served document, reading the source by path
 * rather than carrying a second copy of the sentence — **a second copy would pass while both were
 * stale**, which is the defect this repository records most often.
 *
 * ## The icon's one honest assertion here
 *
 * The data URI's path data is compared to `BRAND_MARK_PATH` in the architecture case, because a
 * browser spec has no reason to import a section module. What this tier *can* say is what only a
 * browser knows: the `<link>` is in the served document after the app has rendered, and **nothing
 * was fetched to draw the mark** — the property the icon being data exists to preserve. That last
 * case is the same one `sections.spec.ts` holds for the in-page mark, restated in the file that adds
 * a second consumer of the same drawing.
 *
 * ## What this does not establish
 *
 * **Nothing about how a tab looks.** No test here reads a rendered pixel. A person looking at a
 * browser tab is the only instrument for that.
 *
 * @module
 */

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serveRecordedProvider } from "./recorded-provider";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "index.html"), "utf8");
const declaredDescription = source.match(
  /<meta\s+name="description"\s+content="([^"]*)"\s*\/>/,
)?.[1];

test("the served document carries the description the source declares", async ({ page }) => {
  expect(declaredDescription, "the source declares no description").toBeDefined();

  serveRecordedProvider(page);
  await page.goto("/");

  const served = await page.locator('meta[name="description"]').getAttribute("content");
  expect(served).toBe(declaredDescription);
});

test("the icon is in the served document after the app has rendered", async ({ page }) => {
  serveRecordedProvider(page);
  await page.goto("/");
  await expect(page.getByTestId("ready")).toBeVisible();

  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveCount(1);
  expect(await icon.getAttribute("href")).toMatch(/^data:image\/svg\+xml,/);
});

test("declaring the icon costs the page no image or font request", async ({ page }) => {
  const traffic = serveRecordedProvider(page);
  await page.goto("/");
  await expect(page.getByTestId("ready")).toBeVisible();

  // **Every URL, whatever its origin.** `denied` alone would be the wrong instrument: a
  // same-origin `/icon.svg` would be served by `route.continue()` and never appear there.
  const assets = traffic.requested
    .map((url) => new URL(url).pathname)
    .filter((pathname) => /\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|eot)$/i.test(pathname));

  expect(
    assets,
    "the page must fetch no image or font file: the tab icon is data, and the mark is drawn",
  ).toEqual([]);
});
