/**
 * Reading the token layer the way the browser resolved it.
 *
 * ## Why this file exists rather than reading the stylesheet
 *
 * A rule that says `font-size: var(--type-xs)` and a heading that *resolves to* 12 px are
 * two different claims, and only the second one is about what a person sees. `styles.css`
 * can name every token it likes while a later rule, a media query, or a missing declaration
 * leaves the element at something else — and `popup.spec.ts`'s literal sweep already proves
 * that reading the source is not reading the result.
 *
 * So the cases that hold a surface's hierarchy ask the document what it computed, and this
 * module is the three readers they share.
 *
 * ## Why it is duplicated rather than extracted
 *
 * `apps/web/e2e/resolved-tokens.ts` holds the same three functions, and this is a second
 * copy. The reason is the one `served-stylesheet.ts` records beside it and it is worth
 * repeating rather than rediscovering: **`tests/` is not typechecked** — it has no
 * `tsconfig` and `pnpm -r` covers workspace members only — which is the documented reason
 * the website's browser suite lives under `apps/web` at all. A shared e2e helper would have
 * to live somewhere with the same defect, so the smaller cost is two copies of three pure
 * functions in two directories that each own a suite.
 *
 * **Extraction is not declined forever.** When a third client appears this becomes worth
 * doing, and the recorded reason to do it is that there would then be three copies.
 *
 * ## What these establish, and what they do not
 *
 * `declared` returns a custom property's **authored value as the cascade resolved it** —
 * `0.75rem`, `1.5`, `0.08em`, `#5e5e68`. It does not return the used value on any element,
 * and it does not composite anything. `pxOf` converts a relative length against a basis the
 * caller supplies, and throws rather than guessing when it meets a unit it does not
 * understand. `rgbOf` accepts only an opaque `#rrggbb`, because a translucent colour would
 * need compositing before any comparison meant anything.
 *
 * **None of the three reads a rendered pixel**, and none of them judges emphasis.
 *
 * @module
 */

import type { Page } from "@playwright/test";

/** A token's authored value, read from the cascade rather than from `tokens.ts`. */
export async function declared(page: Page, name: string): Promise<string> {
  const value = await page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  );
  if (value === "") throw new Error(`${name} is declared nowhere the document can see`);
  return value;
}

/**
 * A length token in pixels, against the basis it is relative to.
 *
 * **`rem` is checked before `em`**, because `"1rem".endsWith("em")` is true and a reader
 * that tested the shorter suffix first would resolve `--type-xs` against the element's own
 * size — a number that happens to be right at the root and wrong everywhere else.
 */
export function pxOf(value: string, basisPx: number): number {
  const number = Number.parseFloat(value);
  if (Number.isNaN(number)) throw new Error(`not a length: ${value}`);
  if (value.endsWith("rem")) return number * basisPx;
  if (value.endsWith("em")) return number * basisPx;
  if (value.endsWith("px")) return number;
  throw new Error(`not a length this suite can read: ${value}`);
}

/** `#rrggbb` — the form the token layer authors — as Chromium's computed `rgb()`. */
export function rgbOf(hex: string): string {
  const parts = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (parts === null) throw new Error(`not an opaque #rrggbb colour: ${hex}`);
  return `rgb(${parts
    .slice(1, 4)
    .map((channel) => Number.parseInt(channel, 16))
    .join(", ")})`;
}
