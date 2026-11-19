/**
 * The website's document metadata, held to the sources it is written from.
 *
 * ## Why this is an architecture case and not a component test
 *
 * `apps/web/index.html` is a **build input that no module imports**. A component test can read
 * what React rendered, but nothing in that program sees the `<head>`, so a component test cannot
 * fail when the description is deleted. The same is true of the icon: it is data in an attribute,
 * never a request, so a browser case alone would see a tab with no icon and could not say why.
 *
 * **This file reads the input.** `tests/architecture/branding-audit.test.ts` already does this for
 * the title, for the same reason.
 *
 * ## The two directions, and why the second is the important one
 *
 * - **Tree → document**: the path data in the icon equals `BRAND_MARK_PATH`, the constant the
 *   page draws its mark from. An icon with different geometry is a second drawing of the mark,
 *   which is the second spelling of a set this repository records as a defect.
 * - **Reader → itself**: the reader is run against a fixture with no description and one with two,
 *   so a matcher that found nothing cannot pass the "exactly one" assertion for ever. **A reader
 *   that matches nothing reports the absence of what it looked for as if it were a finding**, and
 *   only a negative control separates that from a real measurement.
 *
 * ## What it does not establish
 *
 * **Nothing about how the icon looks.** The data URI is decoded as text and its path data compared
 * as a string; no test here renders it. A human looking at a browser tab is the only instrument for
 * that, and this file does not claim one.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BRAND_MARK_PATH } from "../../apps/web/src/sections";
import { PRODUCT_NAME } from "../../packages/ui/src/name";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(join(here, "..", ".."));

export const DOCUMENT_PATH = join(repositoryRoot, "apps", "web", "index.html");

/** Everything this reader needs from a document, or a reason it could not read one. */
export interface DocumentMetadata {
  readonly descriptions: string[];
  readonly iconHref: string | undefined;
}

/**
 * Read the description and the icon from a document's source.
 *
 * **The description is matched as a whole `<meta>` element, not by the word `description`
 * appearing in the file** — which the explanatory comment above already does, so a text search
 * would report a description in a document that has none.
 */
export function readDocumentMetadata(source: string): DocumentMetadata {
  const descriptions = [
    ...source.matchAll(/<meta\s+name="description"\s+content="([^"]*)"\s*\/>/g),
  ].map((match) => match[1] ?? "");
  const icon = source.match(/<link\s+rel="icon"[^>]*href="([^"]*)"[^>]*>/);
  return { descriptions, iconHref: icon?.[1] };
}

/** Decode a data URI's SVG body, so the path data can be compared as text. */
export function decodeIcon(href: string): string {
  if (!href.startsWith("data:image/svg+xml,")) {
    throw new Error(`the icon is not an inline SVG data URI: ${href}`);
  }
  return decodeURIComponent(href.slice("data:image/svg+xml,".length));
}

/** The `d` attribute of the first `<path>` in an SVG body, either quote style. */
export function pathDataOf(svg: string): string | undefined {
  return (
    svg.match(/\bd=(?:"([^"]*)"|'([^']*)')/)?.[1] ?? svg.match(/\bd=(?:"([^"]*)"|'([^']*)')/)?.[2]
  );
}

describe("the website's document metadata", () => {
  const source = readFileSync(DOCUMENT_PATH, "utf8");

  it("carries exactly one description, and it is a sentence rather than the product's name", () => {
    const { descriptions } = readDocumentMetadata(source);
    expect(descriptions).toHaveLength(1);

    const description = descriptions[0] ?? "";
    expect(description.trim().length).toBeGreaterThan(PRODUCT_NAME.length);
    expect(description.trim().endsWith(".")).toBe(true);
    expect(description).toContain("temporary email address");

    // **The reader's own negative controls.** Without them, a matcher that found no description
    // would report `[]` here and be caught by the length assertion — but the *second* control is
    // the one that proves it counts rather than merely finds the first, which is a different
    // failure when a second description is added.
    expect(
      readDocumentMetadata('<meta name="viewport" content="width=device-width" />').descriptions,
    ).toEqual([]);
    expect(
      readDocumentMetadata(
        '<meta name="description" content="one." /><meta name="description" content="two." />',
      ).descriptions,
    ).toEqual(["one.", "two."]);
  });

  it("declares the product's mark as its tab icon, with the page's own path data", () => {
    const { iconHref } = readDocumentMetadata(source);
    expect(iconHref, "the document declares no icon").toBeDefined();
    const svg = decodeIcon(iconHref ?? "");
    const pathData = pathDataOf(svg);
    expect(pathData, "the icon draws no path").toBeDefined();
    expect(pathData).toBe(BRAND_MARK_PATH);

    // **A mutant is reported by name, not silently.** Changing one character in the path is the
    // minimal drift a second drawing could introduce, and a reader that compared only that an
    // icon had *some* path would pass it.
    const mutant = BRAND_MARK_PATH.replace("H10", "H11");
    expect(mutant).not.toBe(BRAND_MARK_PATH);
    expect(
      pathDataOf(
        decodeIcon(`data:image/svg+xml,${encodeURIComponent(`<svg><path d="${mutant}"/></svg>`)}`),
      ),
    ).toBe(mutant);
  });

  it("declares the icon as data, so a tab cannot cost the page a request", () => {
    const { iconHref } = readDocumentMetadata(source);
    expect(iconHref?.startsWith("data:image/svg+xml,")).toBe(true);
    // **A file-backed icon is not a style preference here.** It is a second request for a drawing
    // the page already makes without fetching anything, and `sections.spec.ts` holds that line.
    expect(iconHref).not.toMatch(/\.(svg|png|ico|jpe?g|webp)(\?|$)/i);
  });
});
