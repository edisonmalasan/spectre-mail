/**
 * Reading the token layer the way the browser resolved it.
 *
 * ## Why these are shared rather than written in each spec
 *
 * Two specs now hold a region name to the ink its kind declares, and one of them is
 * `mailbox-history.spec.ts` — which reaches a failure region through machinery
 * `surface-hierarchy.spec.ts` has no reason to build. A second copy of "read a token" and
 * a second copy of "`#rrggbb` as `rgb()`" is the defect this repository records most
 * often: two spellings of one thing that drift, with both still green. So the readers
 * live here and the specs call them.
 *
 * **It is deliberately not a `.spec.ts`.** A file in `testDir` that declares no test would
 * be collected by nothing and read as a spec that verifies nothing, and
 * `tests/architecture/boundaries.test.ts` requires every shipped spec to be collected by
 * the browser suite and by nothing else. Support code lives beside the specs.
 *
 * ## What these establish, and what they do not
 *
 * `declared` returns a custom property's **authored value as the cascade resolved it** —
 * `0.75rem`, `1.5`, `0.08em`, `#5e5e68`. It does not return the used value on any
 * element, and it does not composite anything. `pxOf` converts a relative length against
 * a basis the caller supplies, and throws rather than guessing when it meets a unit it
 * does not understand. `rgbOf` accepts only an opaque `#rrggbb`, because a translucent
 * colour would need compositing before any comparison meant anything.
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
 * that tested the shorter suffix first would resolve `--type-xs` against the element's
 * own size — a number that happens to be right at the root and wrong everywhere else.
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
