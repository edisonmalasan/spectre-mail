/**
 * One message channel, several handlers, and exactly one answer.
 *
 * ## Why this exists now and not at the first handler
 *
 * Because with one handler the channel needed no dispatcher: `onExtensionMessage` registered the
 * fill handler and whatever arrived went to it. **The host request is the second kind this script
 * answers, and registering a second `onExtensionMessage` listener would have been a race that
 * always loses.** `chrome.runtime.onMessage` takes the **first** listener to call `sendResponse` and
 * closes the channel for the rest — and the fill handler answers `notActedOn` to every kind it does
 * not recognise, which is exactly what a host request is to it. **So the host request would have been
 * answered `notActedOn` on every tab switch, deterministically, with a green suite throughout.**
 *
 * That is the same shape as the defect `design.md` D2 names for the code controls: **two
 * implementations of a decision table drift, and each copy is locally correct.** Here it would have
 * been worse — not a drifting table but a channel where the platform silently picks a winner.
 *
 * ## The rule, stated once
 *
 * **Handlers run in order, and the first answer that is not a refusal wins.** A handler that does
 * not recognise the request answers `notActedOn`, which is the convention `FillCodeAnswer` already
 * establishes and which every handler in this directory follows — **so the refusal is named by the
 * variant rather than by a shape check here**, and a handler that answered `undefined` instead
 * would silently become the winner for requests it was never asked.
 *
 * @module
 */

/** What one content-script handler does with a request: answer it, or refuse it. */
export type ContentScriptHandler = (request: unknown) => Promise<unknown>;

/**
 * The one shape that means "this handler does not act on that request".
 *
 * **Exported so a handler can be typed against the convention rather than against its own
 * preference.** `FillCodeAnswer` already carries `notActedOn` as one of its six variants, and a
 * host answer does not - so a handler whose own answer union has no such variant has to be given
 * this type explicitly. **That asymmetry is what the first version of `host-context.ts` got
 * wrong**: it returned `undefined` for a kind it did not act on, and `composeMessageHandlers`
 * took `undefined` at its word and handed it back as the answer.
 *
 * **A named variant rather than `undefined`, because the composed listener must be able to tell a
 * refusal from an answer it has never seen.** Both `onExtensionMessage` and this module collapse a
 * *rejected* handler to no answer already, so an absent value on this path can only ever mean a
 * handler chose it deliberately - and the only honest reading of that is *I do not act on this*.
 */
export interface ContentScriptRefusal {
  readonly kind: "notActedOn";
}

/**
 * Combine handlers into the one this script registers, in the order given.
 *
 * **Order is the caller's decision and it is load-bearing, so it is an argument rather than an
 * accident.** The fill handler narrows before it reads the page and the host handler narrows before
 * it reads the location, so either order is correct — but putting the **fill** first means a fill
 * request never reads `location.hostname` on somebody's page, which is the cheaper of the two
 * refusals and is the order `entry.ts` passes them in.
 *
 * **A handler that throws is a refusal, not a fault.** An exception escaping into a document
 * keypress handler on somebody else's page is what `onExtensionMessage` already collapses, and a
 * composition layer that re-introduced it would undo that for both handlers at once.
 *
 * @param handlers - The handlers to try, in order. The first non-refusal answer is returned.
 * @returns A handler suitable for `onExtensionMessage`, answering `notActedOn` when none applies.
 */
export function composeMessageHandlers(
  ...handlers: readonly ContentScriptHandler[]
): ContentScriptHandler {
  return async (request: unknown): Promise<unknown> => {
    for (const handle of handlers) {
      let answer: unknown;

      try {
        answer = await handle(request);
      } catch {
        // **The same collapse `onExtensionMessage` makes**, for the same reason, and it has to be
        // here too: one handler's failure must not silently make it the answer to every request the
        // other one recognises.
        continue;
      }

      if (!isRefusal(answer)) {
        return answer;
      }
    }

    return { kind: "notActedOn" };
  };
}

/**
 * Whether `answer` is this convention's "I do not act on this".
 *
 * **A discriminant read rather than a shape check, because the convention is the discriminant.**
 * Anything else — `undefined`, a string, an object without a `kind` — is **an answer**, and a
 * handler returning `undefined` rather than `notActedOn` would be taken at its word, which is the
 * failure this function's comment above names. So an unrecognised shape is deliberately *not*
 * treated as a refusal: refusing to guess which shape meant "not mine" is what keeps a malformed
 * answer from being read as a refusal and being discarded silently.
 */
function isRefusal(answer: unknown): boolean {
  return (
    typeof answer === "object" && answer !== null && Reflect.get(answer, "kind") === "notActedOn"
  );
}
