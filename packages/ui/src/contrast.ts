/**
 * WCAG 2.1 contrast arithmetic.
 *
 * ## Why this is arithmetic and not a rendering
 *
 * A contrast ratio is a function of two colours. It does not depend on layout, on what
 * surrounds them, or on a browser — it is the same number whether it is computed in a
 * unit test, in a browser, or on paper. So it is computed here, in a pure function with
 * no DOM and no clock, and `contrast.test.ts` asserts against it directly.
 *
 * Putting this in a browser check would be theatre: the browser supplies two colour
 * strings and the test supplies the ratio either way, so the browser would be doing
 * nothing. That is the opposite of the focus-indicator check, which genuinely needs
 * rendered pixels and genuinely cannot run here — `getComputedStyle` in `jsdom` returns
 * no resolved outline. **Two properties, two instruments, two different reasons.**
 *
 * ## The thresholds, and which is which
 *
 * - `BODY_TEXT` — 4.5:1. Ordinary text.
 * - `LARGE_TEXT` — 3:1. Text at 24px, or 18.66px bold.
 * - `NON_TEXT` — 3:1. A boundary, a focus indicator, a control's shape: anything a user
 *   must be able to *perceive* rather than read.
 *
 * ## What this does not establish
 *
 * It establishes that a declared pair meets its threshold. It establishes nothing about
 * whether the pair is the one a user actually sees: a token declared inside a selector
 * that never matches passes every assertion here. That limit belongs to the rule that
 * every `var()` resolves to a declaration, and to the browser tier.
 *
 * @module
 */

/** Ordinary text. WCAG 2.1 AA. */
export const BODY_TEXT = 4.5;

/** Text at 24px, or 18.66px bold. WCAG 2.1 AA. */
export const LARGE_TEXT = 3;

/** A boundary, an indicator, a control's shape. WCAG 2.1 non-text contrast. */
export const NON_TEXT = 3;

/**
 * The contrast threshold a pair is held to.
 *
 * A named union rather than a free number, so that adding a pair means choosing a
 * category rather than typing a figure — and so a pair cannot quietly claim a threshold
 * it was never measured against.
 */
export type ContrastThreshold = typeof BODY_TEXT | typeof LARGE_TEXT | typeof NON_TEXT;

/**
 * An `#rrggbb` or `#rgb` hex colour, without the leading `#`.
 *
 * Two forms only. The token layer uses one form, and accepting a second would mean
 * accepting `rgba()`, `hsl()`, and a CSS variable reference — none of which resolve to
 * a colour without a rendering engine, which is the thing this module deliberately does
 * not depend on.
 */
export type HexColour = string;

const SHORT_HEX = /^[\da-f]{3}$/i;
const LONG_HEX = /^[\da-f]{6}$/i;

/**
 * Expand `#rgb` to `#rrggbb`.
 *
 * A rule rather than a convenience: a three-digit colour parsed as six would produce
 * channels of `0x0` … and a ratio computed from nonsense that is still a number.
 */
function expand(hex: HexColour): string {
  const body = hex.startsWith("#") ? hex.slice(1) : hex;

  if (SHORT_HEX.test(body)) {
    return body
      .split("")
      .map((digit) => digit + digit)
      .join("");
  }

  if (LONG_HEX.test(body)) return body;

  throw new Error(`Not a hex colour: "${hex}". Expected #rgb or #rrggbb.`);
}

/** One sRGB channel, linearised. */
function channel(value: number): number {
  const c = value / 255;
  // WCAG's own piecewise definition. The 0.03928 threshold is the sRGB standard's,
  // and using 0.04045 here instead shifts results in the fourth decimal place.
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * The relative luminance of a colour, from 0 (black) to 1 (white).
 *
 * @throws if the colour is not `#rgb` or `#rrggbb`.
 */
export function relativeLuminance(colour: HexColour): number {
  const body = expand(colour);
  const r = channel(Number.parseInt(body.slice(0, 2), 16));
  const g = channel(Number.parseInt(body.slice(2, 4), 16));
  const b = channel(Number.parseInt(body.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The contrast ratio between two colours, from 1 to 21.
 *
 * **Symmetric, and deliberately so.** WCAG defines the ratio as the lighter over the
 * darker, so the order of the arguments cannot change the answer. A function whose
 * result depended on argument order would let a pair be declared in the order that
 * flatters it, and this number is the one an audit reads.
 *
 * @throws if either colour is not `#rgb` or `#rrggbb`.
 */
export function contrastRatio(a: HexColour, b: HexColour): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Whether a pair meets a threshold.
 *
 * @throws if either colour is not `#rgb` or `#rrggbb`.
 */
export function meets(foreground: HexColour, background: HexColour, threshold: number): boolean {
  return contrastRatio(foreground, background) >= threshold;
}
