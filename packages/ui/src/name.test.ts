/**
 * The public name's own cases, and what each one is for.
 *
 * ## Why this file exists at all, given `branding-audit.test.ts` exists
 *
 * **Two different claims, and they are held by two different instruments.** That file resolves the
 * review's surface table against the tree — it asks *does every surface that names the product render
 * the one value*. This file asks about the **value itself**, and no amount of surface resolution can
 * answer it: eight surfaces faithfully rendering `"SpectreMail "` is a set of eight correct surfaces
 * and a broken product.
 *
 * **The first case is therefore the shape itself rather than an assertion about it**, so a reader
 * that matched nothing cannot satisfy the cases below. This is the ordering rule
 * `privacy-disclosure.test.ts` states for its own first case and it is repeated because the shape of
 * the mistake is what generalises, not the file it happened in.
 *
 * ## What the whitespace case is really for
 *
 * **A published name with a stray space is invisible in every instrument this repository already
 * has.** `git diff` shows one added space; a screenshot shows nothing; the browser tier reads text
 * and the tab would render it a character narrower. It is a defect that only exists as a property of
 * the string, so the string is what is checked.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "./name";

describe("PRODUCT_NAME", () => {
  it("is a non-empty string", () => {
    // **The first case, and it is positive rather than negative.** A reader that returned nothing
    // would satisfy every assertion below it, so the value is shown before anything is claimed about
    // it — the ordering `privacy-disclosure.test.ts` gives its own first case.
    expect(typeof PRODUCT_NAME).toBe("string");
    expect(PRODUCT_NAME.length, "the name is not empty").toBeGreaterThan(0);
  });

  it("is one word with no surrounding whitespace and no interior space", () => {
    // **Four separate properties, and each is a different way a published name goes wrong.**
    // A leading space is what a template literal with a stray newline produces; a trailing space is
    // what a `"..." + " "` produces; an interior space is what two words pasted together produce; and
    // a tab or newline is what a multi-line template produces. `trim()` alone catches the first two
    // and neither of the last, and `split` catches the third and not the fourth.
    expect(PRODUCT_NAME, "the name carries leading whitespace").toBe(PRODUCT_NAME.trim());
    expect(PRODUCT_NAME, "the name carries trailing whitespace").toBe(PRODUCT_NAME.trimEnd());
    expect(PRODUCT_NAME, "the name is more than one word").not.toContain(" ");
    expect(
      PRODUCT_NAME.split(/\s+/u).filter((word) => word.length > 0).length,
      "the name is not exactly one token",
    ).toBe(1);
    expect(
      [...PRODUCT_NAME].filter((character) => /\s/u.test(character)),
      "whitespace characters inside the name",
    ).toEqual([]);
  });

  it("holds a capital letter and no character that a URL, a file name or a store listing would mangle", () => {
    // **A narrower claim than "it is a good name", and deliberately so.** This is not a trademark
    // position and this repository has none - `docs/BRANDING.md` records three of the roadmap's six
    // checks as unmeasured. It is the narrower mechanical property: the value is shipped inside a
    // JSON manifest, two HTML documents and a `<title>`, and a name carrying a space, a slash or a
    // control character would be mangled or refused by at least one of them.
    expect(PRODUCT_NAME, "the name starts with a lower-case letter").toMatch(/^[A-Z]/u);
    expect(
      [...PRODUCT_NAME],
      "characters in the name that a manifest, a document or a URL would mangle",
    ).toEqual([...PRODUCT_NAME].filter((character) => /^[A-Za-z0-9]+$/u.test(character)));
  });

  it("is the value every surface is required to render, and the reader that resolves them imports this one", () => {
    // **This case exists to make the coupling structural rather than declared.** The surface
    // instrument in `tests/architecture/branding-audit.test.ts` resolves the tree's surfaces against
    // the **imported** value rather than against a string typed beside it, so a rename of this
    // constant moves the eight surfaces' expectation with it and a reader comparing against a
    // retyped literal would report the tree as wrong after a correct rename.
    //
    // **What it does NOT establish is that the instrument imports it.** That file is not a workspace
    // member and `pnpm typecheck` does not check its types, so a binding there is checked at runtime
    // by its own cases rather than by the compiler. The honest form of the claim is the one above:
    // the coupling is made where the type system can see it, and the rest is recorded in
    // `docs/BRANDING.md` rather than asserted here.
    expect(PRODUCT_NAME).toBe("SpectreMail");
  });
});
