/**
 * The content script's second job: naming the host it is beside.
 *
 * ## Why this is a module and not a branch in `fill.ts`
 *
 * Because it is **not** a branch in anything. This script answers a request that has nothing to do
 * with putting a code into a field, it touches no part of the page, and folding it into the fill
 * handler would mean a handler named for a delivery carrying a question about the page itself.
 *
 * ## The parameter type is the enforcement, and that is deliberate
 *
 * **`{ pageLocation: Pick<Location, "hostname"> }` and no `document`.** The requirement forbids reading
 * the page's DOM to answer, and this module **cannot** read it: the document is not in scope, and
 * `Pick` narrows the location to the one property the answer is allowed to carry. So *"reads no
 * property of the page's DOM"* is a property of the shape of this function rather than a promise
 * about its body — which is the difference between an assertion that can fail and a rule that cannot
 * be violated by a future edit.
 *
 * **The property is named `pageLocation` and not `location`, and the reason is that the name is a
 * decision a reader will otherwise have to reverse-engineer.** The boundary rule `keeps storage,
 * cookies, and the URL out of every client` forbids a client from naming the bare identifier
 * `location`, which is correct — a client reaching a URL on its own initiative is what that rule
 * exists to stop. **This module reaches no global at all**: it is handed a value, and naming the
 * parameter after the global it happens to carry would read as though it did. **The rename is not
 * what holds the property**, and neither was the rule: a *property* access was already invisible to
 * that lexical pattern, because its lookbehind excludes `location` preceded by a dot — which is how
 * `controller.ts` reads `watched.location` today without an exemption. **What holds it is the
 * `Pick`, and the instrument that proves it is behavioural:** `content-script-host-context.test.ts`
 * hands this function a `Proxy` that **throws** on any property but `hostname`, so a handler
 * reaching for `href` fails a test rather than passing a rule.
 *
 * **And `hostname` is the whole of what a panel needs.** `site-associations` keys by the exact
 * hostname with no registrable-domain folding, no requirement in this repository needs a path, and
 * **a signup page's query string is where that page's tokens are** — so an answer carrying a
 * `pathname` or a `search` would hold a signup token for every page this extension has ever been
 * beside. The type is where that is decided, rather than a comment asking the next editor to be
 * careful.
 *
 * ## Why the answer is built by `protocol.ts` and not here
 *
 * Because the refusal has to sit beside the answer. `hostContextAnswer` is the one spelling of
 * *"a location that gave nothing becomes `unconfirmed` rather than an empty hostname"*, and the
 * panel narrows the result with `readHostContextAnswer` on the other end. **Two scripts deciding
 * separately what an absent host looks like is how a panel ends up naming a host nobody read** —
 * which is the one wrong answer this milestone must never give.
 *
 * @module
 */

import { hostContextAnswer, isHostContextRequest } from "../protocol";
import type { HostContextAnswer } from "../protocol";
import type { ContentScriptRefusal } from "./handlers";

/** What this module needs to answer, and the whole of what it is given. */
export interface HostContextOptions {
  /**
   * The browser's own view of where this document is.
   *
   * **`Pick<Location, "hostname">` rather than `Location`,** for the reason the module's own
   * paragraph gives: the narrower type is what makes "and nothing more of the page" a property of
   * the signature. A caller holding a whole `Location` passes one in, and this module still cannot
   * reach a path — so a future answer that wanted one would have to change this line, which is a
   * reviewable edit rather than a silent widening.
   */
  readonly pageLocation: Pick<Location, "hostname">;
}

/** The handler this module returns, and it is the module's whole output. */
export interface InPageHostContext {
  /**
   * Answer one request.
   *
   * **`ContentScriptRefusal` (`notActedOn`) for a request this module does not act on, and it is
   * that variant rather than `undefined` on purpose.** `composeMessageHandlers` treats the first
   * non-refusal answer as the winner, and a refusal is named by the `notActedOn` discriminant — the
   * convention `fill.ts` already follows. **A handler that answered `undefined` here would be taken
   * at its word and returned as the answer to every kind it was never asked**, which is the exact
   * defect this composition exists to prevent.
   *
   * **The distinction `undefined` was carrying is preserved one layer out rather than dropped.**
   * "Not a request this module acts on" and "I am beside a page I could not name" stay different
   * facts, because the former never reaches the panel as a host answer at all: the panel's own
   * `readHostContextAnswer` maps this refusal to `null`, and `docs/PROVIDERS.md` §4.6 measured that
   * a content script answering nothing **resolves** and a resolution is indistinguishable from an
   * absent script — so "the kind was not mine" and "no script of this extension is here" both arrive
   * as the same honest *nothing to name*, which is correct, because for a kind this script does not
   * act on there genuinely is nothing to name.
   */
  readonly handle: (request: unknown) => Promise<HostContextAnswer | ContentScriptRefusal>;
}

/**
 * Start answering host requests for this document.
 *
 * **Registration and behaviour are separated, as they are for the fill handler and the insertion
 * controller:** this returns a handler and no side effect, so `entry.ts` owns when the listener is
 * attached and the unit tier can drive every branch without a message channel.
 *
 * @param options - The browser's own location for this document. Nothing else is in scope.
 */
export function startInPageHostContext({ pageLocation }: HostContextOptions): InPageHostContext {
  return {
    handle: async (request: unknown): Promise<HostContextAnswer | ContentScriptRefusal> => {
      // **The narrower first, for the reason `fill.ts` gives its own handler:** an unrecognised
      // message is not permission to read where the page is. The creation request and the fill
      // request both arrive here, and answering either of them with a hostname would be this
      // script answering a question nobody asked.
      //
      // **And the refusal is `notActedOn` rather than `undefined`, for the reason the interface
      // gives.** Returning `undefined` would be taken at its word by `composeMessageHandlers` and
      // become the answer.
      if (!isHostContextRequest(request)) {
        return { kind: "notActedOn" };
      }

      // **Read once, from the browser, and answer with that.** No reading of the document, no
      // cooperation asked of the page, and no permission needed to obtain it — which is the whole
      // reason `design.md` D4 chose this route over `tab.url`.
      return hostContextAnswer(pageLocation.hostname);
    },
  };
}
