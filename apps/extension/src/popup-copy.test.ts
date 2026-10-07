/**
 * The popup copy's shape, which is what the website's depiction is allowed to show.
 *
 * ## What this file is for
 *
 * The website's `Extension preview` region depicts this popup by naming its regions and
 * controls. For that depiction to be honest, every label it shows must be a **string** this
 * popup renders — and there are three ways an entry here can stop being one:
 *
 * - it is **renamed**, so the website's declared name resolves to nothing;
 * - it becomes a **function**, so there is no string to render (`count`, `checkFailed`); and
 * - it becomes a **template**, so the string carries a substitution token (`reaching`).
 *
 * The third is why {@link POPUP_COPY_TEMPLATES} exists. A rule that discovered templates by
 * scanning for a brace and exempting what it found would enforce nothing — it would agree with
 * every input, including a second template added next month. **The list is declared, so a
 * second token is the thing that fails.**
 *
 * ## Why the tests read the object rather than the source
 *
 * These assertions are about what the copy *is*, not what it says. Reading the file's text
 * would make them pass and fail for reasons that have nothing to do with the claim — the
 * twenty-ninth recorded instance in this repository of a substitute instrument answering
 * confidently and wrongly.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { POPUP_COPY, POPUP_COPY_KEYS, POPUP_COPY_TEMPLATES } from "./popup-copy";

/** Every entry that holds something other than a string. */
function nonStringEntries(): string[] {
  return POPUP_COPY_KEYS.filter(
    (key) => typeof POPUP_COPY[key as keyof typeof POPUP_COPY] !== "string",
  );
}

/** Every entry that holds a string carrying a substitution token. */
function templatedEntries(): string[] {
  return POPUP_COPY_KEYS.filter((key) => {
    const value = POPUP_COPY[key as keyof typeof POPUP_COPY];
    return typeof value === "string" && value.includes("{");
  });
}

describe("the popup copy", () => {
  it("holds a string for every entry but the two that take a count", () => {
    // The positive control. Without it, a copy object emptied of strings would satisfy the
    // rule below by containing nothing to complain about.
    // `toEqual` on arrays is order-sensitive, so the expectation is sorted rather than typed in
    // declaration order: a reordering of two entries in the copy is not a defect, and an
    // assertion that fails on one is the kind that gets "fixed" by editing the test.
    expect(POPUP_COPY_KEYS.length).toBeGreaterThan(0);
    expect([...nonStringEntries()].sort()).toEqual(["checkFailed", "count"]);
  });

  it("carries a substitution token in exactly the entries it declares", () => {
    expect(templatedEntries()).toEqual([...POPUP_COPY_TEMPLATES]);
  });

  it("declares every template entry as one that exists", () => {
    // The other direction. Without it, a typo in POPUP_COPY_TEMPLATES would exempt a token
    // that is not there while the real one stayed undeclared — and the assertion above would
    // report both sides agreeing on an exemption nothing earned.
    expect(POPUP_COPY_TEMPLATES.filter((key) => !POPUP_COPY_KEYS.includes(key))).toEqual([]);
  });

  it("resolves each template's declared token to a real provider name at render time", () => {
    // `reaching` is the only template, and the popup substitutes before rendering. Asserting
    // the substitution here is what keeps `Popup.tsx`'s `.replace("{provider}", …)` honest:
    // a rename of the token would otherwise leave a page showing "Asking {provider} first".
    const rendered = POPUP_COPY.reaching.replace("{provider}", "Mail.tm");
    expect(rendered).toBe("Asking Mail.tm first");
    expect(rendered).not.toContain("{");
  });

  it("names no empty string, because a depiction cannot show one", () => {
    // **Read through `Object.entries` rather than by key.** The direct form is a comparison
    // the compiler rejects outright — `tsc` sees the union of every string literal in the
    // object and reports that none of them can be `""` — which is `tsc` being right about
    // *this* object and about nothing else. Widening the value back to `unknown` is what
    // makes the assertion about the data rather than about the type.
    const empties = Object.entries(POPUP_COPY)
      .filter(([, value]) => (value as unknown) === "")
      .map(([key]) => key);
    expect(empties).toEqual([]);
  });
});
