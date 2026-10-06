/**
 * The contrast arithmetic itself, against values whose answers are known.
 *
 * ## Why test the function and not only the palette
 *
 * `pairs.test.ts` proves the palette meets its thresholds **according to this
 * arithmetic**. If the arithmetic were wrong, every one of those assertions would pass
 * for the wrong reason — and the failure would appear as a palette that looked fine in a
 * browser and was not. So the function is checked against colours whose ratios are
 * published, which makes it the instrument rather than the reading.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import {
  BODY_TEXT,
  LARGE_TEXT,
  NON_TEXT,
  contrastRatio,
  meets,
  relativeLuminance,
} from "./contrast";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });

  it("is linear in the sRGB channels, so green weighs most", () => {
    // The coefficients are WCAG's, not a choice: at 0.7152 green dominates, which is
    // why a pure green is lighter than a pure blue at the same value.
    expect(relativeLuminance("#00ff00")).toBeGreaterThan(relativeLuminance("#0000ff"));
  });

  it("expands the three-digit form rather than misreading it as six", () => {
    // `#fff` and `#ffffff` are the same colour. A parser that treated the three-digit
    // form as six would compute channels of `0x0` … and still return a number.
    expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#ffffff"), 10);
    expect(relativeLuminance("#abc")).toBeCloseTo(relativeLuminance("#aabbcc"), 10);
  });

  it("accepts a colour with or without its leading hash", () => {
    expect(relativeLuminance("336699")).toBeCloseTo(relativeLuminance("#336699"), 10);
  });

  it("refuses a colour it cannot resolve, rather than guessing", () => {
    // A named colour, `rgb()`, and a CSS variable all resolve only inside a rendering
    // engine. Accepting them here would mean this module needed one, and the whole
    // reason it is a pure function is that it does not.
    for (const bad of ["rebeccapurple", "rgb(0,0,0)", "var(--ink-primary)", "#12345", ""]) {
      expect(() => relativeLuminance(bad)).toThrow(/hex colour/i);
    }
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black against white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
  });

  it("is 1:1 for a colour against itself", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 10);
  });

  it("does not depend on the order of its arguments", () => {
    // WCAG defines the ratio as lighter over darker, so the order cannot change the
    // answer. A function whose result depended on order would let a pair be declared in
    // whichever order flatters it, and this is the number an audit reads by hand.
    const pairs: readonly (readonly [string, string])[] = [
      ["#16161a", "#f4f4f2"],
      ["#5e5e68", "#ffffff"],
      ["#0e0e11", "#ecedf0"],
    ];

    for (const [a, b] of pairs) {
      expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
    }
  });

  it("agrees with published ratios for two colours whose answer is known", () => {
    // `#767676` on white is the value the WCAG technique pages use for the 4.5:1
    // boundary: it is the lightest grey that still passes ordinary text, and its
    // ratio is 4.54:1. If this arithmetic drifted, this number would drift with it.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
    expect(meets("#767676", "#ffffff", BODY_TEXT)).toBe(true);
    // And one step lighter fails, which is what makes the boundary a boundary.
    expect(meets("#777777", "#ffffff", BODY_TEXT)).toBe(false);
  });

  it("reports a ratio below 1 as impossible", () => {
    // The 1:1 floor is a property of the definition, not an accident of the palette. If
    // a colour could score below 1 the threshold comparisons above would stop meaning
    // what they say.
    expect(contrastRatio("#123456", "#123456")).toBeGreaterThanOrEqual(1);
  });
});

describe("the thresholds", () => {
  it("are WCAG's, and are distinguishable from one another", () => {
    expect(BODY_TEXT.ratio).toBe(4.5);
    expect(LARGE_TEXT.ratio).toBe(3);
    expect(NON_TEXT.ratio).toBe(3);
    // Large text and non-text share a number but not a meaning, which is why they are
    // two names. A reader seeing a single `3` cannot tell which rule they are reading.
    expect(NON_TEXT).not.toBe(BODY_TEXT);
  });

  it("carries a name that survives two standards sharing a ratio", () => {
    // **This is the assertion the collapse would have failed, and it is here because the
    // collapse happened.** The thresholds were bare numbers, so `ContrastThreshold` was
    // `4.5 | 3 | 3` — a union with one fewer member than it had names — and the renderer
    // recovered a name by comparing values. Because `LARGE_TEXT` was compared first, every
    // non-text pair in `docs/DESIGN_SYSTEM.md` was labelled "large text (3:1)": a generated
    // compliance table asserting that focus indicators are held to the wrong standard.
    //
    // The three `ratio` assertions above pass identically on the old constants, which is
    // why the suite was green while the document was wrong. Only the *names* can catch it,
    // so they are asserted rather than assumed.
    expect(NON_TEXT.name).not.toBe(LARGE_TEXT.name);
    expect({ ...NON_TEXT }).not.toEqual({ ...LARGE_TEXT });
    expect([BODY_TEXT.name, LARGE_TEXT.name, NON_TEXT.name].sort()).toEqual([
      "body-text",
      "large-text",
      "non-text",
    ]);
    // And the label a reader gets is the one the standard carries, not a value comparison:
    // a standard cannot be renamed into another by holding the same ratio.
    expect(`${NON_TEXT.name} (${NON_TEXT.ratio}:1)`).toBe("non-text (3:1)");
  });

  it("makes a pair that meets the large-text threshold fail the body one", () => {
    // The two thresholds have to disagree somewhere, or holding a pair to the stricter
    // one is free and the declaration of it is decorative.
    const pairThatOnlyPassesLarge = "#949494";

    expect(meets(pairThatOnlyPassesLarge, "#ffffff", LARGE_TEXT)).toBe(true);
    expect(meets(pairThatOnlyPassesLarge, "#ffffff", BODY_TEXT)).toBe(false);
  });
});
