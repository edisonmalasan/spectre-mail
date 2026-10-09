/**
 * @vitest-environment jsdom
 *
 * Recognising a one-time-code field — the reader behind the requirement *"A one-time-code field is
 * recognised only from signals this capability names"*.
 *
 * ## What this tier is for, given the browser tier exists
 *
 * The browser tier can show a real `autocomplete="one-time-code"` input being filled. It cannot
 * reach the fields that must **not** be recognised without planting them into the page one at a
 * time, and every one of those is a decision this module makes. So this file holds the whole
 * signal table — every spelling that must match, and every spelling that must not — and the
 * browser tier holds the one case that proves the table was reached at all.
 *
 * ## Every case here can fail, and that is asserted rather than assumed
 *
 * The table is a list of words, and a list of words that grew by accident would recognise fields
 * nobody decided about. Each arm below carries the field that must not be recognised beside the
 * field that must be, so removing a restriction changes an answer rather than nothing.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findOneTimeCodeFields,
  isOneTimeCodeField,
  ONE_TIME_CODE_AUTOCOMPLETE,
} from "./content-script/code-field";

/**
 * This module's own source, read rather than transcribed.
 *
 * **`process.cwd()` rather than `import.meta.url`, and that is forced rather than preferred.** This
 * file runs under the `jsdom` environment, and Vitest rewrites `import.meta.url` to a *browser-shaped*
 * URL there — so `fileURLToPath` rejects it with *"The URL must be of scheme file"*, which is a
 * `TypeError` at module scope and therefore a suite that fails to collect at all. Reading relative to
 * the runner's root is the remaining option, and `pnpm test` runs from the workspace root that holds
 * this path.
 */
const MODULE_SOURCE = readFileSync(
  resolve(process.cwd(), "apps/extension/src/content-script/code-field.ts"),
  "utf8",
);

/**
 * Build an input and put it in the document.
 *
 * **`setAttribute` rather than markup.** No client file in this repository builds DOM from a string,
 * and the reason `controller.ts`'s own test records is the right one: a markup-built element is a
 * parsing question as well as a behaviour question, and a failure would name the parser.
 *
 * @param attributes - The attributes to set, in order. `type` is set when given so a case can
 *   declare one without this helper deciding what an input's type is.
 */
function input(attributes: Readonly<Record<string, string>>): HTMLInputElement {
  const element = document.createElement("input");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  document.body.append(element);
  return element;
}

/** A non-input element carrying the signals under test, so "it is not an input" is testable. */
function nonInput(attributes: Readonly<Record<string, string>>): HTMLElement {
  const element = document.createElement("div");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  document.body.append(element);
  return element;
}

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("isOneTimeCodeField", () => {
  it("recognises a field that declares a one-time code through autocomplete", () => {
    expect(isOneTimeCodeField(input({ autocomplete: ONE_TIME_CODE_AUTOCOMPLETE }))).toBe(true);
  });

  /**
   * **`autocomplete` is a token list, and this is the case that says so.**
   *
   * `section-login one-time-code shipping` is how a page spells it, and a substring test would
   * also accept `one-time-codes` and `x-one-time-code`, which name nothing in the standard.
   */
  it("recognises the token among others, and not a word that merely contains it", () => {
    expect(
      isOneTimeCodeField(input({ autocomplete: "section-login one-time-code shipping" })),
    ).toBe(true);
    expect(isOneTimeCodeField(input({ autocomplete: "one-time-codes" }))).toBe(false);
    expect(isOneTimeCodeField(input({ autocomplete: "x-one-time-code" }))).toBe(false);
  });

  /**
   * Every spelling the reader must accept, as one case.
   *
   * **Grouped deliberately, and the grouping is the argument.** A reader that handles only
   * `verificationCode` recognises some real pages and not others, with nothing to tell the person
   * apart from a page that has no code field at all. If one of these stops matching, this case
   * names which spelling changed.
   */
  it("recognises every spelling of a code, verification or one-time-password name it claims", () => {
    for (const name of [
      "code",
      "otp",
      "OTP",
      "passcode",
      "verification",
      "verificationCode",
      "verification_code",
      "verification-code",
      "one-time-password",
      "one_time_password",
      "oneTimePassword",
      "auth_code",
    ]) {
      expect(isOneTimeCodeField(input({ name }))).toBe(true);
    }
  });

  /**
   * The words that must never match, as one case.
   *
   * **Every one of these is a real field on a real form**, which is why they are named together
   * rather than one at a time: `barcode` and `postcode` are scanned all day by anybody using a
   * site, `token` is what a page calls its CSRF token, and `password` without the phrase before it
   * is the field every account form has.
   *
   * **The disqualifying rows below the embedded ones are a different kind of near miss, and that is
   * why the case is two.** `postcode` is one word containing `code`; `country_code` is two words
   * and one of them *is* `code`, so it survives a whole-word test and is stopped only by the
   * disqualifying list.
   */
  it("recognises no field whose name merely contains a code-ish word", () => {
    for (const name of [
      "barcode",
      "postcode",
      "zipcode",
      "token",
      "csrf_token",
      "password",
      "new_password",
      "username",
      "email",
    ]) {
      expect(isOneTimeCodeField(input({ name }))).toBe(false);
    }
  });

  /**
   * **The other half: a field whose name really does contain the word `code` and is still not one.**
   *
   * A checkout page has `discountCode`, `couponCode` and `promoCode`; an address form has
   * `countryCode` and `postalCode`; a card form has `securityCode`. **Filling a verification code
   * into any of them submits something the person did not read**, and in the checkout cases the
   * consequence is an order priced wrongly rather than an error anybody sees.
   */
  it("recognises no checkout, address or card field whose name contains the word code", () => {
    for (const name of [
      "discount_code",
      "discountCode",
      "coupon_code",
      "promoCode",
      "promotion_code",
      "voucher_code",
      "gift_code",
      "referral_code",
      "country_code",
      "postal_code",
      "zip_code",
      "security_code",
      "securityCode",
      "tax_code",
      "vatCode",
      "tracking_code",
      "sku_code",
      "product_code",
      "upc_code",
      "ean_code",
      "isbn_code",
    ]) {
      expect(isOneTimeCodeField(input({ name }))).toBe(false);
    }
  });

  /**
   * **A declaration outranks a disqualifying name, and this is the precedence the requirement
   * states.**
   *
   * A page that writes `autocomplete="one-time-code"` on `couponCode` has told this product what
   * the field is in the one way a machine can read. Refusing it would be the recogniser overruling
   * the page on a guess about which word meant more.
   */
  it("recognises a field that declares itself even when its name says something else", () => {
    expect(
      isOneTimeCodeField(input({ name: "coupon_code", autocomplete: ONE_TIME_CODE_AUTOCOMPLETE })),
    ).toBe(true);
  });

  /** `id` carries the same weight as `name`, and the reader reads both. */
  it("recognises a field identified by its id rather than its name", () => {
    expect(isOneTimeCodeField(input({ id: "verificationCode" }))).toBe(true);
  });

  /**
   * The requirement's load-bearing half: **a numeric keypad is not a signal.**
   *
   * A quantity box, a price, a card number, a telephone number and a postcode all ask for one, and
   * filling a code into any of them is a data-entry error the person cannot see before submitting.
   */
  it("does not recognise a field whose only signal is a numeric inputmode", () => {
    expect(isOneTimeCodeField(input({ inputmode: "numeric" }))).toBe(false);
    expect(isOneTimeCodeField(input({ name: "quantity", inputmode: "numeric" }))).toBe(false);
    expect(isOneTimeCodeField(input({ id: "postcode", inputmode: "numeric" }))).toBe(false);
  });

  /**
   * A numeric `inputmode` **alongside** a name that identifies a code is recognised — because the
   * name does the work and the keypad is consistent with it.
   *
   * **This is the requirement's third signal, and recording it as its own case is how the reader
   * would be held to it.** The requirement says a numeric `inputmode` "together with" such a name
   * or id; a reader that treated the keypad as *necessary* would refuse the `autocomplete` case
   * above, and a reader that ignored the name would fill quantity boxes.
   */
  it("recognises a numeric field whose name also identifies a code", () => {
    expect(isOneTimeCodeField(input({ name: "otp", inputmode: "numeric" }))).toBe(true);
    expect(isOneTimeCodeField(input({ id: "verificationCode", inputmode: "numeric" }))).toBe(true);
  });

  /**
   * Not an input, whatever the attributes say.
   *
   * **A `<button autocomplete="one-time-code">` is a button**, and a control drawn against it
   * would be a control that cannot act.
   */
  it("does not treat an element that is not an input as a code field", () => {
    expect(isOneTimeCodeField(nonInput({ autocomplete: ONE_TIME_CODE_AUTOCOMPLETE }))).toBe(false);
    expect(isOneTimeCodeField(nonInput({ name: "otp" }))).toBe(false);
    expect(isOneTimeCodeField(nonInput({ id: "verificationCode" }))).toBe(false);
  });

  /**
   * An input that cannot receive a typed value is not a field a person types a code into.
   *
   * **The hidden CSRF token is the case that matters**, and it is on a form a code is typed into.
   * Writing a verification code into it destroys what the page put there and nothing shows it.
   */
  it("does not treat an input that cannot receive a typed value as a code field", () => {
    expect(isOneTimeCodeField(input({ type: "hidden", name: "csrf_code" }))).toBe(false);
    expect(isOneTimeCodeField(input({ type: "submit", name: "code" }))).toBe(false);
    expect(
      isOneTimeCodeField(input({ type: "checkbox", autocomplete: ONE_TIME_CODE_AUTOCOMPLETE })),
    ).toBe(false);
  });

  /**
   * A type this reader has never heard of is treated as typable.
   *
   * **The default is the safe direction for a list of exclusions.** An unknown type is a future
   * type the platform added, and refusing it would make this product stop working on a page it
   * would otherwise be right about; the requirement's own concern is the fields it must leave
   * alone, and a field this reader cannot recognise at all is left alone anyway.
   */
  it("treats a type it does not know as typable", () => {
    expect(isOneTimeCodeField(input({ type: "text", name: "otp" }))).toBe(true);
  });

  /** The null cases, because a controller may hold no element at all. */
  it("recognises nothing at all in the absence of an element", () => {
    expect(isOneTimeCodeField(null)).toBe(false);
    expect(isOneTimeCodeField(undefined)).toBe(false);
  });
});

describe("findOneTimeCodeFields", () => {
  it("returns every qualifying field in document order, and nothing else", () => {
    input({ name: "username" });
    const first = input({ name: "otp" });
    input({ id: "email" });
    const second = input({ autocomplete: ONE_TIME_CODE_AUTOCOMPLETE });

    expect(findOneTimeCodeFields(document).map((candidate) => candidate.field)).toEqual([
      first,
      second,
    ]);
  });

  /**
   * The preference the requirement names, carried as a fact rather than applied as an order.
   *
   * **Document order is what the person is looking at**, so the declared field is *marked* and not
   * moved to the front — a list reordered by preference is a list whose order means something other
   * than what it looks like.
   */
  it("marks the field that declares itself and not the one inferred from its name", () => {
    input({ name: "otp" });
    input({ autocomplete: ONE_TIME_CODE_AUTOCOMPLETE });

    expect(findOneTimeCodeFields(document).map((candidate) => candidate.declared)).toEqual([
      false,
      true,
    ]);
  });

  /**
   * A field with two qualifying signals is one candidate, not two.
   *
   * **A page that both names a field `verificationCode` and declares it `autocomplete` has said the
   * same thing twice**, and a reader that counted signals would put the same field in the asking
   * control twice — asking a person to choose between a field and itself.
   */
  it("returns one candidate for a field carrying both signals", () => {
    input({ name: "verificationCode", autocomplete: ONE_TIME_CODE_AUTOCOMPLETE });

    const candidates = findOneTimeCodeFields(document);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.declared).toBe(true);
  });

  /** The page's own label, because it is what the person is looking at. */
  it("calls a field by the label the page shows", () => {
    const label = document.createElement("label");
    label.textContent = "Enter the code we sent";
    document.body.append(label);

    const field = input({ name: "otp" });
    field.id = "code-field";
    label.htmlFor = "code-field";

    expect(findOneTimeCodeFields(document)[0]?.label).toBe("Enter the code we sent");
  });

  /** No label, so the `name` the page used to name it. */
  it("falls back to the name when the page shows no label", () => {
    input({ name: "verificationCode" });

    expect(findOneTimeCodeFields(document)[0]?.label).toBe("verificationCode");
  });

  /**
   * The page's `id`, when the page shows no label and names the field nothing.
   *
   * **And then the field's position, which is reachable only through a declaration.** A field
   * qualifies on its `name`, on its `id`, or on `autocomplete` — so a field with neither a name nor
   * an id can only have got here by declaring itself. That is why this case plants two declared
   * fields and not a pair of anonymous ones: an anonymous `input` is not a code field at all, and
   * the first version of this case asserted a second entry the reader had no reason to produce.
   */
  it("falls back to the id, then to the field's position", () => {
    input({ id: "code-one" });
    input({ autocomplete: ONE_TIME_CODE_AUTOCOMPLETE });

    expect(findOneTimeCodeFields(document).map((candidate) => candidate.label)).toEqual([
      "code-one",
      "Code field 2",
    ]);
  });

  /**
   * The positive control for the reader itself.
   *
   * **A reader that returned nothing for any document would satisfy every absence case above**,
   * and those cases are the reason this reader is worth having. Planting a field the reader must
   * report is what separates "recognised nothing" from "recognised this".
   */
  it("reports a planted qualifying field, so the empty answers elsewhere mean something", () => {
    expect(findOneTimeCodeFields(document)).toHaveLength(0);

    input({ autocomplete: ONE_TIME_CODE_AUTOCOMPLETE });

    expect(findOneTimeCodeFields(document)).toHaveLength(1);
  });
});

/**
 * ## The note, asserted
 *
 * A claim in a comment is not a claim anybody re-reads, and this one is the claim the whole file
 * rests on: **these signals are a requirement, so widening them is a spec amendment.** If a later
 * change adds a fourth signal and leaves the note saying otherwise, the note is now false and the
 * only warning was a file nobody opens.
 *
 * **The requirement is named by its own opening words rather than paraphrased**, so renaming the
 * requirement makes this fail — which is the point. A paraphrase of a heading is a second sentence
 * that can go stale independently of the first.
 */
describe("the module's own note", () => {
  it("names the requirement its signal list serves, verbatim", () => {
    expect(MODULE_SOURCE).toContain(
      "A one-time-code field is recognised only from signals this capability names",
    );
  });

  it("says that recognising a further shape is a spec amendment rather than a silent widening", () => {
    expect(MODULE_SOURCE).toContain("spec amendment rather than a silent widening");
  });
});
