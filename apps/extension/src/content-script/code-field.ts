/**
 * Recognising a one-time-code field, and only a one-time-code field.
 *
 * ## Why this exists beside `email-field.ts` rather than inside it
 *
 * **The two recognisers answer different questions and their requirements say so.** The email
 * requirement names its own signals — `type="email"`, an `autocomplete` naming an email, a
 * `name`/`id` containing `email` — and this capability's requirement names three different ones.
 * A single "is this a field worth putting something in" function would have to satisfy both
 * specifications with one signal list, and the list that satisfies one is wrong for the other:
 * `type="email"` is not a one-time-code signal, and `inputmode="numeric"` is not an email signal.
 *
 * So they are two readers of two requirements, and `holdsText` is shared because it answers a
 * third question that neither requirement owns.
 *
 * ## These signals are a requirement, not a heuristic, and that is the load-bearing sentence
 *
 * **`in-page-integration`'s requirement is titled "A one-time-code field is recognised only from signals this capability names", and it names the whole set.** There is no
 * fallback, no scoring and no "nearest empty short input". **Recognising a further shape is
 * therefore a spec amendment rather than a silent widening**, which is the point: a page whose code
 * field is named something this file does not recognise gets a control that says it found no field,
 * and a person who has opened a spec diff can see that the list grew. The alternative — a heuristic
 * that quietly starts recognising more — is a change nobody can review, because there is nothing
 * to review.
 *
 * ## Why `inputmode` is read and then refused rather than acted on
 *
 * **The requirement names three signals and the third is already covered by the second.** It reads
 * *"an `input` whose `inputmode` declares a numeric entry **together with** such a name or
 * id"* — "such a name or id" is the second signal, which recognises the field on that name or id
 * alone. A third branch that checked `inputmode` *and* then re-ran the same name-or-id match would
 * be a second spelling of one predicate, and two spellings of one predicate drift.
 *
 * So `inputmode` is read, recorded and **refused**: a field carrying nothing but `numeric` is not
 * recognised. That is the requirement's own load-bearing half — a numeric keypad is what a page
 * asks for on a quantity, a price, a card number, a telephone number and a postcode, and filling a
 * discount code into a quantity box is a data-entry error with a visible result and no way for the
 * person to notice before submitting.
 *
 * ## Why the identity is split into tokens rather than matched as a substring
 *
 * **`email-field.ts` uses a substring for `name`/`id` and this file does not, and the difference
 * is the difference between the two fields.** `emailAddress` has to match `email` as a substring,
 * because `email` is the noun and it is embedded in a word. A code field is named with the noun
 * itself — `otp`, `code`, `passcode`, `verification` — and those are whole words once the name is
 * split. A substring test would also accept `barcode`, `postcode`, `country-code`,
 * `discount-code` and `zipcode`, **every one of which is a real field on a real page and none of
 * which wants a verification code.**
 *
 * **Camel humps and separators are both split, because real names are written both ways.** Sites
 * write `verificationCode`, `verification_code`, `verification-code` and `verification code`, and a
 * reader that handled only two of those would recognise some pages' code fields and not others'
 * with nothing to tell the difference from the page.
 *
 * **The one phrase rather than one token.** `one-time-password` splits into `one`, `time` and
 * `password`, and none of the three is the noun — and `password` alone must never match, because
 * `new_password` is the field every account form has. So the phrase is matched on the normalised
 * string, and that is the only phrase in the file.
 *
 * ## Why inputs that cannot receive typed entry are refused
 *
 * **`type="hidden" name="csrf_token"` is an input whose name contains a code-ish word.** A hidden
 * input is not a field a person types a code into, and writing a verification code into one
 * destroys whatever the page put there. The requirement names `input` as the only element type; it
 * does not say which inputs, and this narrowing is recorded as an amendment on the delta rather
 * than left for the next reader to find out from a real page.
 *
 * @module
 */

/**
 * The token a page uses to say what a field is for, when it says it in the machine-readable way.
 *
 * **A constant rather than a literal, because three modules and two tiers read it** and the
 * browser tier's fixture declares a field with it. A renamed literal is a fixture that silently
 * stops declaring anything.
 */
export const ONE_TIME_CODE_AUTOCOMPLETE = "one-time-code";

/**
 * Whole words in a field's `name` or `id` that identify it as a code, a verification, or a
 * one-time-password field.
 *
 * **`otp` and `passcode` are the one-time-password field under the two spellings real pages use**,
 * and `verification` covers a field named for the act rather than for the secret. `code` covers the
 * rest.
 *
 * **What is deliberately absent is `token`.** A field named `token` is most often a CSRF token or a
 * session token, both of which are hidden and both of which are destroyed by writing a number into
 * them. The requirement names a code, a verification and a one-time-password field, and a token is
 * none of those three.
 */
const IDENTITY_TOKENS: ReadonlySet<string> = new Set(["code", "otp", "passcode", "verification"]);

/**
 * The one multi-word signal, matched on the normalised identity.
 *
 * **`one time password` and nothing else.** `password` on its own is `new_password`'s half, and the
 * only way to tell a one-time-password field from an account form's password field is the word
 * before it.
 */
const IDENTITY_PHRASES: readonly string[] = ["one time password"];

/**
 * Words that, appearing anywhere in a field's `name` or `id`, stop it being recognised.
 *
 * ## Why a disqualifying list at all, when the token list already exists
 *
 * **`code` is a whole word on a great many fields that are not verification codes, and every one of
 * them is scanned all day by somebody.** `discountCode`, `couponCode`, `promoCode` and
 * `voucherCode` are a checkout page; `countryCode` and `postalCode` are an address form; `sku`,
 * `barcode`, `upc` and `trackingCode` are a warehouse. **Filling a six-digit verification code into
 * any of them submits something a person did not read**, and in the checkout cases the consequence
 * is a real order priced wrongly rather than a visible error.
 *
 * Splitting on word boundaries stopped `postcode` and `barcode` and did nothing for the rest, because
 * `discountCode` genuinely contains the word `code`. **A whole-word test is a necessary condition
 * here and not a sufficient one, and the second half is this list.**
 *
 * ## Every entry is a real field, and the ones that decide the list are named
 *
 * `discount`, `coupon`, `promo`, `voucher` and `gift` are checkout; `country`, `postal`, `zip` and
 * `post` are addresses; `security` is the three digits on the back of a card; `bar`, `upc`, `ean`,
 * `sku`, `isbn` and `product` are goods; `tracking`, `referral`, `tax` and `vat` are the rest of a
 * checkout.
 *
 * **A list is a judgement and is recorded as one.** The alternative — recognising every field with
 * `code` in its name — is not a neutral choice either; it is a larger list of wrong answers. This
 * one is a list a person can read, argue with, and amend through the spec, which is the property
 * this capability's requirement is written to protect.
 */
const DISQUALIFYING_TOKENS: ReadonlySet<string> = new Set([
  "bar",
  "country",
  "coupon",
  "discount",
  "ean",
  "gift",
  "isbn",
  "post",
  "postal",
  "product",
  "promo",
  "promotion",
  "referral",
  "security",
  "sku",
  "tax",
  "tracking",
  "upc",
  "vat",
  "voucher",
  "zip",
]);

/**
 * `input` types that cannot receive a typed value, and therefore cannot be a code field.
 *
 * **`hidden` is the one that matters and the rest are cheap.** A page's CSRF token is
 * `<input type="hidden" name="csrf_token">` on the very form a code is typed into, and its name
 * carries `token` — a word this module deliberately does not match, so the practical case is
 * covered twice over. The list is here because a `type="submit"` input named `code` would
 * otherwise be offered a value it cannot hold.
 */
const UNTYPABLE_INPUT_TYPES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** One qualifying field, and the two facts about it the caller cannot recover cheaply. */
export interface CodeFieldCandidate {
  /** The field itself. */
  readonly field: HTMLInputElement;
  /**
   * Whether the page **declared** this field's purpose through `autocomplete`.
   *
   * **The preference, and it is the requirement's own.** A page that states what a field is for is
   * telling the truth about it in the one way a machine can read, so a declared field outranks one
   * inferred from a name — even though the declared one is not filled unasked.
   */
  readonly declared: boolean;
  /** What to call this field to a person choosing between them. */
  readonly label: string;
}

/**
 * Is this element an input that could hold a typed one-time code?
 *
 * **`tagName` before every attribute, for the reason `email-field.ts` gives.** The attributes below
 * say nothing about whether the element can hold a value at all, and a `<button
 * autocomplete="one-time-code">` is a button.
 */
function isTypableInput(element: Element | null | undefined): element is HTMLInputElement {
  if (!element || element.tagName !== "INPUT") {
    return false;
  }

  // **`type` is read from the attribute, not from `element.type`,** for the reason the email
  // recogniser records: the IDL property reports the default the element did not override, which
  // answers a different question.
  const declaredType = (element.getAttribute("type") ?? "text").toLowerCase();
  return !UNTYPABLE_INPUT_TYPES.has(declaredType);
}

/**
 * Does the field declare itself a one-time code through `autocomplete`?
 *
 * **Tokens, not a substring,** for the reason `email-field.ts` records: the attribute is a
 * space-separated list and `autocomplete="one-time-codes"` names nothing in the standard.
 */
function declaresItself(element: Element): boolean {
  const autocomplete = (element.getAttribute("autocomplete") ?? "").toLowerCase();
  return autocomplete.split(/[\s,]+/).includes(ONE_TIME_CODE_AUTOCOMPLETE);
}

/**
 * The whole-word list, and the one phrase, read out of a field's `name` and `id`.
 *
 * **Both attributes together, in one normalisation, and neither is read as a substring.** See the
 * module note: `emailAddress` has to match `email` as a substring and `postcode` must not match
 * `code`, and the difference is whether the noun is embedded in a longer word or is the word.
 *
 * **A `declared` field is answered before any of this is read**, which is the precedence the
 * requirement states: a page that says `autocomplete="one-time-code"` has said what the field is in
 * the one way a machine can read, and a `name` that happens to contain `coupon` does not overrule
 * it. `couponCode` with `autocomplete="one-time-code"` is a page this product is right about.
 */
function identifiesACode(element: Element): boolean {
  const raw = `${element.getAttribute("name") ?? ""} ${element.getAttribute("id") ?? ""}`;
  const normalised = raw
    // **Camel humps first**, so `verificationCode` splits before the separators run: replacing
    // non-alphanumerics cannot find a boundary a name spells as a capital letter.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalised.length === 0) {
    return false;
  }

  const tokens = normalised.split(" ");

  // **The disqualifying list is checked first, over the whole identity rather than the token that
  // matched.** Checking only the matched token would leave `country_code` recognised, because the
  // word that disqualifies it is not the word that qualified it.
  if (tokens.some((token) => DISQUALIFYING_TOKENS.has(token))) {
    return false;
  }

  if (tokens.some((token) => IDENTITY_TOKENS.has(token))) {
    return true;
  }

  return IDENTITY_PHRASES.some((phrase) => normalised.includes(phrase));
}

/**
 * Is this element a one-time-code field?
 *
 * **Two signals fire, and a third is read only to be refused.** See the module note, and the
 * requirement this serves: `A one-time-code field is recognised only from signals this capability
 * names`.
 */
export function isOneTimeCodeField(
  element: Element | null | undefined,
): element is HTMLInputElement {
  if (!isTypableInput(element)) {
    return false;
  }

  if (declaresItself(element)) {
    return true;
  }

  return identifiesACode(element);
}

/**
 * What to call a field to a person who is choosing between several.
 *
 * **The page's own label first, then its `name`, then its `id`, then a count.** In that order,
 * because a label is what the person is looking at on screen, and the fallbacks are what the page
 * used to name the thing the person is being asked to identify. **The last fallback names the
 * position rather than the field**, because a page that declares a code field with neither a label
 * nor an id has given the person nothing to tell the two apart by — and "the second one" is
 * answerable by looking.
 *
 * **`labels`, not a query for `<label for>`.** `HTMLInputElement.labels` is the platform's own
 * answer, and it already accounts for a label wrapping the input.
 */
function describeField(field: HTMLInputElement, position: number): string {
  const fromLabel = field.labels?.[0]?.textContent?.trim();
  if (fromLabel !== undefined && fromLabel.length > 0) {
    return fromLabel;
  }

  const fromName = (field.getAttribute("name") ?? "").trim();
  if (fromName.length > 0) {
    return fromName;
  }

  const fromId = (field.getAttribute("id") ?? "").trim();
  if (fromId.length > 0) {
    return fromId;
  }

  return `Code field ${position}`;
}

/**
 * Every field on this page that qualifies, in document order, each carrying what the caller cannot
 * cheaply recover.
 *
 * **One reader rather than three**, for the reason this repository keeps re-learning: a filter, a
 * sort and a describe each written at a call site are three predicates that drift, and the second
 * one nobody re-measures. This returns all three facts in one value, and the caller chooses.
 *
 * **Document order, not preference order.** The person choosing between fields is looking at the
 * page, so the options are listed the way the page lays them out; `declared` is carried per
 * candidate so the preference is marked rather than imposed by position.
 *
 * @param document - The document to read. Passed in rather than reaching for the global, because the
 *   unit tier hands this a jsdom document and a global would be a second thing to keep in step.
 */
export function findOneTimeCodeFields(document: Document): readonly CodeFieldCandidate[] {
  const candidates: CodeFieldCandidate[] = [];

  for (const element of Array.from(document.querySelectorAll("input"))) {
    if (!isOneTimeCodeField(element)) {
      continue;
    }

    candidates.push({
      field: element,
      declared: declaresItself(element),
      label: describeField(element, candidates.length + 1),
    });
  }

  return candidates;
}
