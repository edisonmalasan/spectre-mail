/**
 * Putting a one-time code into the page's own field, on one activation, on the person's behalf.
 *
 * ## What this module decides, and why it decides it rather than being told
 *
 * **Three decisions, in this order, and each one has a requirement naming it.**
 *
 * 1. **Whether this document may fill anything at all** — the top-frame rule below.
 * 2. **Which fields are candidates** — `code-field.ts`, and nothing here reads a `name`, an `id` or
 *    an `autocomplete`.
 * 3. **Whether one of them is filled unasked** — one empty candidate, or several.
 *
 * **The order is load-bearing and is the requirement's.** A page with no code field reports *no
 * field* whether or not it is the top frame; a page that is not the top frame reports *not the top
 * frame* whether or not it has a field. Checking fields first would make the top-frame rule
 * conditional on a coincidence in somebody else's markup, and two answers would then be possible
 * for one page.
 *
 * ## Why this is a message handler and not a second affordance beside the first
 *
 * **A code only exists on a message somebody opened.** `MessageSummary` carries no detection, by
 * construction — `packages/core` says so and gives the reason — so the person who could possibly
 * press something has already been looking at the popup, on a different screen, with the code in
 * front of them. The delivery is a message from there; **there is no page-side trigger to hang a
 * control on**, and adding one would mean this extension deciding on its own that a page is now
 * expecting a code.
 *
 * ## Why the handler answers a question rather than reporting an outcome
 *
 * **A content script is asked, and the answer travels back to the popup**, because the person who
 * pressed something needs to know whether it worked. `extension-client` requires the popup to say
 * it *could not confirm* rather than to invent either outcome, so every answer here is a named
 * fact about the page — and the one the caller most needs, `filled`, is the only one that claims
 * anything happened.
 *
 * ## Why the top-frame rule exists, given the manifest injects into the top frame only
 *
 * **`in-page-integration` requires the check, and `design.md` D4 records why.** `all_frames` is
 * unset in the shipped manifest, so in the *current* build the content script never runs in a
 * frame and this branch is unreachable from a browser case. **It is written and unit-tested anyway,
 * for the reason the requirement says: a later manifest that sets `all_frames` would otherwise turn
 * "the person asked" into "whichever frame had a qualifying field answered first".** A rule that
 * exists only because nothing can reach it is a rule nobody has falsified, and this one is
 * falsified by a unit case rather than by a browser case that cannot be written.
 *
 * @module
 */

import { isFillCodeRequest } from "../protocol";
import type { FillCodeAnswer } from "../protocol";
import { createFieldChoice } from "./affordance";
import type { FieldChoice, FieldChoiceOption } from "./affordance";
import { findOneTimeCodeFields } from "./code-field";
import type { CodeFieldCandidate } from "./code-field";
import { holdsText } from "./email-field";
import { insertValue } from "./insert";

/** What this context needs in order to fill, and both are handed to it rather than reached for. */
export interface InPageFillOptions {
  /**
   * The document whose fields are candidates.
   *
   * **Passed in rather than read from the global**, for the reason `code-field.ts` records: the unit
   * tier hands this a jsdom document and a global would be a second thing to keep in step.
   */
  readonly document: Document;
  /**
   * The window this document belongs to, or `null` when it belongs to none.
   *
   * **Explicit, and this is the one option that exists only to make the top-frame rule testable.**
   * The answer to "am I the top document" is a question about a window, not about a document, and
   * `document.defaultView` is a browser-shaped answer a unit tier cannot produce for a framed
   * document — `jsdom` has no frame the test could open, and inventing one would be a fixture
   * asserting that this repository's own `Window` shim is a browser. So the view is passed in, and
   * `entry.ts` passes the real one.
   */
  readonly view: Window | null;
}

/** What this module hands back so the caller can register it and take it away again. */
export interface InPageFill {
  /**
   * Answer one delivery request.
   *
   * **Never throws, and never returns `undefined`.** `extension-platform`'s listener treats a
   * rejection as *no answer at all*, which is honest but not what a page that looked and found
   * nothing should report — every failure in this file is a named fact instead.
   */
  readonly handle: (request: unknown) => Promise<FillCodeAnswer>;
  /** The asking control currently on the page, if any. Read by the unit tier, never by the page. */
  readonly pending: () => FieldChoice | null;
}

/**
 * Is this document the page's top-level one?
 *
 * **`view.top === view`, and never a name comparison or a walk.** `window.top` is the platform's own
 * answer, it is readable from a frame of any origin (it is a `WindowProxy`, not the window's
 * internals), and it is `null` only for a document with no window — which is a document nothing
 * should fill.
 *
 * **A strict equality rather than `window.top === window.self`-style gymnastics,** because `self` and
 * `top` are the same object in the top document by definition, and an equality that could be
 * satisfied by two proxies pointing at one window would be satisfied by nothing at all.
 */
function isTopLevel(view: Window | null): boolean {
  return view !== null && view.top === view;
}

/**
 * The candidates that are worth filling, and the one the requirement's preference names.
 *
 * **A field holding text is excluded here rather than checked at the fill**, so the *one* empty
 * candidate and the *several* candidates are counted over the same list. `extension-client` requires
 * that nothing be inserted into a field a person has already filled — that is the field the browser
 * autofilled, and overwriting it is destroying something the person chose.
 */
function fillableCandidates(
  candidates: readonly CodeFieldCandidate[],
): readonly CodeFieldCandidate[] {
  return candidates.filter((candidate) => !holdsText(candidate.field));
}

/**
 * Draw the asking control, attaching it after the first candidate field.
 *
 * **After the first one, not after the preferred one, and not after the focused one.** The person is
 * looking at the page, and the fields are laid out in the order the options are listed — so the
 * control goes where the choice starts rather than where this extension's preference points.
 * Placing it after the preferred field would move the control when a page declared one, and a
 * control that moves is a control a person has to find again.
 *
 * @param candidates - The empty fields, in page order. Never empty; this is called only when there
 *   are at least two.
 * @param code - The code this person chose to fill, shown in the heading and sent verbatim.
 * @param takeDown - Removes the control this one replaces. Passed in rather than reached for,
 *   because the control that owns the reference is the caller's and this function is module-level.
 */
function askWhichField(
  candidates: readonly CodeFieldCandidate[],
  code: string,
  takeDown: () => void,
): FieldChoice {
  const choiceOptions: FieldChoiceOption[] = candidates.map((candidate) => ({
    label: candidate.label,
    preferred: candidate.declared,
    choose: () => {
      // **Take the control down first, then write.** A control that has already removed itself
      // cannot be pressed a second time while the write happens, and the write cannot fail in a way
      // that would leave a control still offering a code that is already in the field.
      takeDown();
      insertValue(candidate.field, code);
    },
  }));

  const control = createFieldChoice({ code, options: choiceOptions, onDismissed: takeDown });
  const first = candidates[0]?.field;

  if (first !== undefined) {
    first.insertAdjacentElement("afterend", control.host);
  }

  return control;
}

/**
 * Start answering fill requests for this document.
 *
 * **Registration and behaviour are separated, as they are for the insertion controller:** this
 * returns a handler and no side effect beyond building state, so `entry.ts` owns when the listener
 * is attached and the unit tier can drive every branch without a message channel.
 *
 * @param options - The document to read and the window that decides whether it may be filled.
 */
export function startInPageFill({ document, view }: InPageFillOptions): InPageFill {
  let pending: FieldChoice | null = null;

  const takeDown = (): void => {
    pending?.remove();
    pending = null;
  };

  const ask = (candidates: readonly CodeFieldCandidate[], code: string): FillCodeAnswer => {
    // **One at a time.** A second code arriving while the first is still being chosen replaces the
    // question rather than stacking a second one: two controls offering two codes on one page is a
    // page where nothing is chosen.
    takeDown();
    pending = askWhichField(candidates, code, takeDown);
    return { kind: "asked" };
  };

  return {
    handle: async (request: unknown): Promise<FillCodeAnswer> => {
      // **The narrower first, before any reading of the page.** An unrecognised message is not
      // permission to look at somebody's DOM, and the creation request travels over the same
      // channel: a content script that answered *that* by filling a field would be filling a
      // mailbox id into a signup form.
      if (!isFillCodeRequest(request)) {
        return { kind: "notActedOn" };
      }

      if (!isTopLevel(view)) {
        return { kind: "notTopFrame" };
      }

      const candidates = findOneTimeCodeFields(document);

      if (candidates.length === 0) {
        return { kind: "noField" };
      }

      const empty = fillableCandidates(candidates);

      // **One candidate, so the choice was made by the page's own markup.** A single qualifying
      // field is not a guess: this product has nothing to ask, and a person who asked for a code
      // pressed a button on purpose.
      //
      // **`filled` is returned from inside the block that performed the write, and from nowhere
      // else.** It is the only answer in this file that says the code went somewhere, and the
      // first version of this branch returned it from *outside* an `!== undefined` guard — so a
      // path that wrote nothing would still have said it wrote something. The branch is written
      // on the element rather than on the count so that the guard and the report cannot come
      // apart, which `noUncheckedIndexedAccess` would otherwise let a future edit do silently.
      const only = empty.length === 1 ? empty[0] : undefined;

      if (only !== undefined) {
        insertValue(only.field, request.code);
        return { kind: "filled" };
      }

      // **Read as a count, and after the write rather than before it.** The order of these two
      // arms is the order of the requirement's own clauses — nothing to fill, then a choice to
      // put — and the emptiness filter above has already run, so this is a count of *fillable*
      // fields and not of fields the page happens to have.
      if (empty.length === 0) {
        return { kind: "fieldHoldsText" };
      }

      return ask(empty, request.code);
    },
    pending: () => pending,
  };
}
