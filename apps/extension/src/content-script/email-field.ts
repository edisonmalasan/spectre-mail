/**
 * Recognising an email field, and only an email field.
 *
 * ## Why this is a list rather than a heuristic
 *
 * The alternative — "any text input that might take an address" — is a control on every
 * search box, every comment box and every name field on every page, which is the outcome the
 * product's own UX rules forbid. So the signals are **named**, and a field that matches none
 * of them is offered nothing.
 *
 * **Three signals, and each covers a form the others miss.** `type="email"` is the honest
 * signal and the rarest in the wild; `autocomplete` is what a well-built form sets and is how
 * a password manager finds the same field; the `name`/`id` match is what the long tail of real
 * sites does. Measured on the M9 slice 1 fixture: all three matched a field they should and
 * the negative cases (a `username` text input, a `<button>`) matched none.
 *
 * @module
 */

/**
 * Is this element an email field?
 *
 * **`type` is read from the attribute, not from `element.type`.** The IDL property reports
 * `"text"` for an input with no `type`, which is the right answer to a different question; the
 * attribute is what the author wrote, and an omitted `type` on a field named `email` is still
 * a field someone types an address into.
 *
 * **`tagName !== "INPUT"` returns false before any attribute is read**, because the
 * attributes below say nothing about whether the element can hold a value at all. A `<button
 * autocomplete="email">` is a button.
 */
export function isEmailField(element: Element | null | undefined): element is HTMLInputElement {
  if (!element || element.tagName !== "INPUT") {
    return false;
  }

  const declaredType = (element.getAttribute("type") ?? "text").toLowerCase();
  if (declaredType === "email") {
    return true;
  }

  // **`autocomplete` is a space-separated token list, so it is read as tokens.** The attribute
  // is `autocomplete="section-login shipping email"`, and the signal is the token `email`
  // appearing among them. A substring test would also accept `emails` and `x-email`, which name
  // nothing in the HTML standard — and a recogniser that offers an address control on fields it
  // misreads is the outcome the requirement's "only from signals this requirement names" clause
  // exists to prevent.
  const autocomplete = (element.getAttribute("autocomplete") ?? "").toLowerCase();
  if (autocomplete.split(/[\s,]+/).includes("email")) {
    return true;
  }

  // **`name` and `id` are free-form identifiers, so a substring is right for those and a token
  // split would not be.** `emailAddress`, `user-email` and `work_email` are all what real sites
  // write, and none of them is a delimited list.
  const identity = `${element.getAttribute("name") ?? ""} ${element.id}`.toLowerCase();
  return identity.includes("email");
}

/**
 * Does this field already hold something a person typed?
 *
 * **A control over an empty field only.** Writing an address into a field the page already
 * filled in would destroy whatever was there, and no confirmation stands between a person and
 * that loss. `trim()` rather than a length check, because a field holding only spaces holds
 * nothing a person would miss.
 *
 * **`value` and not `textContent`,** because the first version read the latter and reported an
 * autofilled field as empty: autofill sets the IDL property, and `textContent` of an input
 * never changes at all.
 */
export function holdsText(field: HTMLInputElement): boolean {
  return field.value.trim() !== "";
}
