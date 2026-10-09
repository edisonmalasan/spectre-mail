/**
 * Putting a value into the page's own field, the way the page expects to receive it.
 *
 * ## Why this is one function with two callers, rather than a fill that reuses the address path
 *
 * **The measurement below was made with an address, and it is about the write rather than the
 * payload.** `in-page-integration` states one property — *"An inserted value becomes the value the
 * page's own state holds"* — and this milestone gave it a second caller. A second function would be
 * a second copy of a setter, a pair of dispatched events and an ordering, and the two copies would
 * drift the first time one of them was edited: **an address inserted correctly and a code inserted
 * wrongly would be two behaviours, and only one of them would have a requirement behind it.**
 *
 * So the payload is a parameter and the property is stated once. The name says *value* because that
 * is what it carries.
 *
 * ## Why a setter the page installed, and two dispatched events, and not `field.value = x`
 *
 * **The two halves answer two different failures, and which one carries a controlled field was
 * measured rather than assumed** — `design.md` D4 records the measurement and corrects the
 * reason this file originally gave for the setter.
 *
 * - **The dispatched events are what reach a framework's state.** Measured on React `19.3.0`:
 *   a plain `field.value = x` reaches the controlled component's state *just as well* as the
 *   prototype setter does, and what does **not** reach it is dispatching nothing at all. That
 *   is the failure D4 exists to prevent — a field that paints the address and submits empty —
 *   and it is reproduced by assigning the value alone.
 * - **A page listening for events never hears about a bare assignment.** No `input` event means
 *   no validator runs and nothing records the change. Assigning a value is not an edit as far as
 *   the page is concerned, whatever the field's own `value` property ends up saying.
 *
 * **The prototype setter is kept and is now defensive rather than load-bearing**, and the reason
 * is stated rather than repeated: on this measurement the setter and a direct assignment reach
 * the same place, but a framework that shadows the instance setter is exactly the case where the
 * direct assignment fails, and none has been measured in this repository. It costs one descriptor
 * lookup.
 *
 * So both are done, and the order matters: **set the value, then announce it.**
 *
 * **The prototype setter is looked up rather than assigned through, and it is defensive rather
 * than clever.** Where a page has replaced the setter on the instance, calling the prototype's
 * with the element as `this` is the one call that reaches whatever the page will actually read.
 * The fallback exists because a future `HTMLInputElement` with no own `value` descriptor would
 * otherwise leave the field untouched and report success.
 *
 * @module
 */

/**
 * Write `value` into `field` through the setter the platform's own prototype declares.
 *
 * **No `null` check**, because every caller has already established this is an input worth writing
 * into — {@link ./email-field!isEmailField} for the address and
 * {@link ./code-field!isOneTimeCodeField} for the code — and a caller that had not would want a
 * `TypeError` rather than a field silently left alone.
 */
function setFieldValue(field: HTMLInputElement, value: string): void {
  const prototypeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (typeof prototypeSetter === "function") {
    prototypeSetter.call(field, value);
    return;
  }

  field.value = value;
}

/**
 * Put `value` into `field` and announce it the way a person's typing would.
 *
 * **`input` and then `change`, in that order, and both bubbling.** `input` is what a controlled
 * field's state updates on; `change` is what a form's "dirty" tracking and its submit handling
 * listen for. Dispatching only one leaves a page that watches the other believing nothing
 * happened — and the value is on screen, so a page that believes nothing happened is a page
 * submitting an empty form.
 *
 * **`new Event` and not `new InputEvent`.** An `InputEvent` carries `data` and `inputType`,
 * and a page reading `event.data` to learn what changed would find nothing there. The measured
 * behaviour that made this requirement was `input` reaching React state, which is a question
 * about the event *type* being `input` and nothing more; claiming the richer event would be a
 * claim this repository has not measured.
 *
 * @param field - An input the caller has already recognised.
 * @param value - The value, sent verbatim. Nothing here trims it, reformats it or decides what a
 *   code looks like: the parser ranked it and the page will submit it, and a value altered in
 *   transit is a value the page never sent.
 */
export function insertValue(field: HTMLInputElement, value: string): void {
  setFieldValue(field, value);

  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}
