/**
 * The palette, held to the ratios it claims.
 *
 * ## What these tests are and are not
 *
 * They are **arithmetic over two colours**, which is the whole of what a contrast ratio
 * is. They run in Node with no DOM, no browser, and no clock, because there is nothing
 * else involved. A browser check for this would be theatre — the browser supplies colour
 * strings and this file supplies the ratio either way.
 *
 * They are **not** a check that the page looks right. They cannot see whether a token is
 * used, whether a component puts text on the surface its author thought it did, or
 * whether the layout crowds an ink together. Two things cover that, and neither is here:
 * the rule that every `var()` in a shipped stylesheet resolves to a declaration, and the
 * browser tier.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { BODY_TEXT, LARGE_TEXT, NON_TEXT, contrastRatio, meets } from "./contrast";
import { DECORATIVE, PAIRS, SURFACE_ONLY } from "./pairs";
import { COLOUR_NAMES, SCHEMES, type Scheme } from "./tokens";

const SCHEME_NAMES = Object.keys(SCHEMES) as Scheme[];

describe("the palette's declared contrast", () => {
  it("declares the same colour names in both schemes", () => {
    // A token added to one scheme and forgotten in the other renders as the property's
    // initial value — which for a colour means the declaration silently does nothing.
    // That is the same failure as an undeclared `var()`, one step further away.
    for (const scheme of SCHEME_NAMES) {
      expect(Object.keys(SCHEMES[scheme]).sort()).toEqual([...COLOUR_NAMES].sort());
    }
  });

  it("holds every declared pair to its threshold, in every scheme", () => {
    const failures: string[] = [];

    for (const pair of PAIRS) {
      for (const scheme of SCHEME_NAMES) {
        const ratio = contrastRatio(SCHEMES[scheme][pair.ink], SCHEMES[scheme][pair.surface]);
        if (!meets(SCHEMES[scheme][pair.ink], SCHEMES[scheme][pair.surface], pair.threshold)) {
          failures.push(
            `${scheme}: ${pair.ink} on ${pair.surface} is ${ratio.toFixed(2)}:1, below ${pair.threshold}:1 — ${pair.what}`,
          );
        }
      }
    }

    // One assertion listing every failure, rather than the first — a palette change
    // that breaks four pairs should say so once, not make four rounds of this test.
    expect(failures).toEqual([]);
  });

  it("reports a ratio with the precision an audit reads it at", () => {
    // The reason the failures above are formatted at two decimals: this is the number a
    // person checks by hand, and a number rounded to one decimal reads as 3.0 for 2.96.
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("holds a heading to the body threshold too, not only the large-text one", () => {
    // The `LARGE_TEXT` pair in `PAIRS` documents what a heading is rendered at. This
    // asserts the stronger fact, so that a future tightening of the type scale cannot
    // quietly drop a heading below the body threshold while the declared pair still
    // passes — which is a check that reads as coverage and is not.
    const heading = PAIRS.find(
      (pair) =>
        pair.ink === "ink-primary" &&
        pair.surface === "surface-raised" &&
        pair.threshold === LARGE_TEXT,
    );
    expect(heading).toBeDefined();

    for (const scheme of SCHEME_NAMES) {
      const ratio = contrastRatio(
        SCHEMES[scheme]["ink-primary"],
        SCHEMES[scheme]["surface-raised"],
      );
      expect({ scheme, passes: ratio >= BODY_TEXT }).toEqual({ scheme, passes: true });
    }
  });

  it("keeps the accent pair on a tinted surface out of the body-text requirement", () => {
    // `accent` on `surface-accent` is declared at NON_TEXT and that is deliberate: it is
    // a rule or a marker reinforcing a word, not reading matter. If it were silently
    // promoted to BODY_TEXT it would still pass, and the declaration would no longer say
    // what the thing actually is.
    const marker = PAIRS.find((pair) => pair.ink === "accent" && pair.surface === "surface-accent");
    expect(marker?.threshold).toBe(NON_TEXT);
  });
});

describe("what the palette deliberately does not claim", () => {
  it("holds no threshold for a decorative hairline, and says which one", () => {
    const decorativeTokens = new Set(DECORATIVE.map((entry) => entry.token));

    expect(decorativeTokens.has("line-subtle")).toBe(true);

    // The exclusion is the checked fact, not the gap. An omission reads as an oversight,
    // and the first person to add `--line-subtle` to a pair list would meet a red test
    // and no explanation.
    const usedByAnyPair = PAIRS.filter(
      (pair) => decorativeTokens.has(pair.ink) || decorativeTokens.has(pair.surface),
    ).map((pair) => `${pair.ink} on ${pair.surface}`);

    expect(usedByAnyPair).toEqual([]);
  });

  it("gives every declared exclusion a reason", () => {
    for (const entry of [...DECORATIVE, ...SURFACE_ONLY]) {
      expect(entry.why.length).toBeGreaterThan(40);
      expect(SCHEMES.light[entry.token]).toMatch(/^#[\da-f]{6}$/i);
    }
  });

  it("keeps the two lists apart, so neither can absorb the other", () => {
    // Conflating these was a real defect caught on this file's first run: `surface-sunken`
    // was listed as held to no threshold while eleven pairs used it as a background with
    // one. Two lists that cannot overlap cannot make that claim again.
    const decorative = new Set(DECORATIVE.map((entry) => entry.token));

    for (const entry of SURFACE_ONLY) {
      expect({ token: entry.token, alsoDecorative: decorative.has(entry.token) }).toEqual({
        token: entry.token,
        alsoDecorative: false,
      });
    }
  });

  it("never uses a surface-only colour as an ink", () => {
    const surfaceOnly = new Set(SURFACE_ONLY.map((entry) => entry.token));
    const usedForegrounds = new Set(PAIRS.map((pair) => pair.ink));

    for (const ink of usedForegrounds) {
      expect({ ink, surfaceOnly: surfaceOnly.has(ink) }).toEqual({ ink, surfaceOnly: false });
    }
  });

  it("uses every surface-only colour as a background, so the list cannot go stale", () => {
    // The counterpart to the assertion above. Without it, a token could be listed here
    // with a plausible reason while the page had stopped using it, and the list would
    // read as documentation of something that does not happen.
    const usedSurfaces = new Set(PAIRS.map((pair) => pair.surface));

    for (const entry of SURFACE_ONLY) {
      expect({ token: entry.token, usedAsSurface: usedSurfaces.has(entry.token) }).toEqual({
        token: entry.token,
        usedAsSurface: true,
      });
    }
  });

  it("accounts for every colour token between the three lists", () => {
    // So a new token cannot be added and silently end up in none of them — which is the
    // state in which nothing is known about it and nothing complains.
    const accounted = new Set([
      ...DECORATIVE.map((entry) => entry.token),
      ...SURFACE_ONLY.map((entry) => entry.token),
      ...PAIRS.flatMap((pair) => [pair.ink, pair.surface]),
    ]);

    expect(COLOUR_NAMES.filter((name) => !accounted.has(name))).toEqual([]);
  });
});
