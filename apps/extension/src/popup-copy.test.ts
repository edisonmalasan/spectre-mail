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

import {
  ADDRESS_TRUTH,
  POPUP_COPY,
  POPUP_COPY_KEYS,
  POPUP_COPY_TEMPLATES,
  reportAddressTruth,
} from "./popup-copy";

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
    // **`fillCode` joined `reaching`, and the entry it replaced was a function.** The code is
    // substituted rather than composed, so the count of function-valued entries is still two and a
    // depiction can still not render either of them. A third function here would have made
    // `nonStringEntries` the assertion that changed, and it is the weaker place to put the change.
    expect(templatedEntries()).toEqual([...POPUP_COPY_TEMPLATES]);
  });

  it("declares every template entry as one that exists", () => {
    // The other direction. Without it, a typo in POPUP_COPY_TEMPLATES would exempt a token
    // that is not there while the real one stayed undeclared — and the assertion above would
    // report both sides agreeing on an exemption nothing earned.
    expect(POPUP_COPY_TEMPLATES.filter((key) => !POPUP_COPY_KEYS.includes(key))).toEqual([]);
  });

  it("resolves each template's declared token to a real value at render time", () => {
    // `reaching` and `fillCode` are the templates, and the popup substitutes before rendering.
    // Asserting the substitution here is what keeps `Popup.tsx`'s `.replace("{provider}", …)` and
    // `.replace("{code}", …)` honest: a rename of a token would otherwise leave a popup showing
    // "Asking {provider} first" or "Fill in code {code}".
    const provider = POPUP_COPY.reaching.replace("{provider}", "Mail.tm");
    expect(provider).toBe("Asking Mail.tm first");
    expect(provider).not.toContain("{");

    // **The code verbatim, and that is the property rather than the formatting.** A code is a
    // detection this product did not invent, so trimming it, shortening it or rendering its
    // confidence instead would each produce a control that names a value the page would not receive.
    const filled = POPUP_COPY.fillCode.replace("{code}", "493028");
    expect(filled).toBe("Fill in code 493028");
    expect(filled).not.toContain("{");
    // **A code with its own braces or spaces survives the substitution**, because `String.replace`
    // is given the code as the replacement rather than as part of a pattern.
    expect(POPUP_COPY.fillCode.replace("{code}", "a b {c}")).toBe("Fill in code a b {c}");

    // **The third template is a domain row, and it is resolved the same way.** The `@` is
    // data here rather than a literal in the component, so a row renamed in copy is a row
    // renamed on screen and no JSX edit can quietly keep the old spelling.
    expect(POPUP_COPY.domainOption.replace("{domain}", "example.test")).toBe("@example.test");
    expect(POPUP_COPY.domainOption.replace("{domain}", "example.test")).not.toContain("{");
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

/**
 * ## The three truth claims (M22 task 4.3)
 *
 * The point of these cases is not that three strings exist — it is that **no observation this
 * client can make promotes the third one**. A created mailbox, a provider confirmation and a
 * recorded fixture are all enumerated below, and in every combination the delivery claim is
 * still the fixed unverified sentence.
 */
describe("the popup's three address-truth claims", () => {
  it("holds three different sentences, named by the three facts they report", () => {
    // **Spelled literally on this side.** A record that collapsed two claims into one string
    // would satisfy any test that compared the record to itself; asserting the names and the
    // distinctness here is what keeps them three claims rather than one with two aliases.
    expect(Object.keys(ADDRESS_TRUTH).sort()).toEqual([
      "catalogAvailable",
      "deliveryUnverified",
      "provisioned",
    ]);
    expect(new Set(Object.values(ADDRESS_TRUTH)).size).toBe(3);

    // **The exact sentence GOAL §8 names, and a name that says it is unverified.** A rename
    // to "Delivered." would keep the value a string and keep the set distinct, and this is
    // the assertion that would catch it.
    expect(ADDRESS_TRUTH.deliveryUnverified).toBe("LIVE DELIVERY NOT VERIFIED");
    expect(ADDRESS_TRUTH.deliveryUnverified).not.toMatch(/verified delivery|delivered/i);

    // **The record is read from the copy the popup actually renders**, not spelled a second
    // time. A copy edit that widened one claim must be visible here by name.
    expect(ADDRESS_TRUTH.catalogAvailable).toBe(POPUP_COPY.catalogAvailable);
    expect(ADDRESS_TRUTH.provisioned).toBe(POPUP_COPY.provisioned);
    expect(ADDRESS_TRUTH.deliveryUnverified).toBe(POPUP_COPY.deliveryUnverified);
  });

  it("never upgrades delivery on a create, a confirmation, or a recorded fixture", () => {
    // **All eight combinations, not the happy arm.** The two claims that can move are asserted
    // to track their evidence; the third is asserted to be the same fixed sentence every time.
    const observed: string[] = [];
    for (const inCatalog of [false, true]) {
      for (const providerConfirmed of [false, true]) {
        for (const recorded of [false, true]) {
          const report = reportAddressTruth({ inCatalog, providerConfirmed, recorded });
          expect(report.catalogAvailable, `${inCatalog}/${providerConfirmed}/${recorded}`).toBe(
            inCatalog,
          );
          expect(
            report.provisionedByProvider,
            `${inCatalog}/${providerConfirmed}/${recorded}`,
          ).toBe(providerConfirmed);
          expect(report.delivery, `${inCatalog}/${providerConfirmed}/${recorded}`).toBe(
            ADDRESS_TRUTH.deliveryUnverified,
          );
          observed.push(report.delivery);
        }
      }
    }

    // **The enumeration really ran eight arms**, so a reader cannot satisfy the loop by
    // changing the ranges to empty arrays and having nothing to assert.
    expect(observed).toHaveLength(8);
    expect(new Set(observed).size).toBe(1);

    // **And the negative control on the reader itself.** A report that always answered
    // "Delivered." would be caught by the equality above, but a reader that reported nothing
    // would satisfy `new Set([]).size === 1`? No — an empty set has size 0, and the length
    // check above has already failed. This control proves the distinctness assertion can
    // fail in the other direction too: two different values make it report two.
    expect(new Set([...observed, "Delivered."]).size).toBe(2);
  });
});
