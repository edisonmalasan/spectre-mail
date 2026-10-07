/**
 * Booting the in-page integration, and the two ways it declines to start.
 *
 * ## Both refusals report nothing on the page, and that is the decision
 *
 * A person on someone else's website has no context in which "SpectreMail could not start" is
 * actionable — there is no error region of this product's to put it in, and a banner drawn
 * inside a stranger's signup form is worse than nothing. So both refusals are silent to the
 * page, and both are *loud to this repository's own tiers* instead: the browser tier asserts
 * that no affordance appears, which is the same observable outcome a refusal produces and is
 * the only one a page can see.
 *
 * **1. No storage area.** The content script is injected with only the two provider origins,
 * and `storage` alone is enough for `chrome.storage.local` to be readable from it — measured,
 * and recorded in `docs/PROVIDERS.md` §4.2. Where it is not, `readChromeLocalArea()` returns
 * `undefined`, and there is nothing to read: **a blocked read is not a mailbox holding nothing.**
 * The distinction is why `SpectreStorage` reports the two separately, and this branch honours
 * it by offering nothing at all rather than offering a control that cannot act.
 *
 * **2. A blocked store.** `createExtensionStorage` reports `blocked` with a reason in the
 * platform's own words, and the content script keeps that reason for itself — the popup is where
 * it is shown to a person, and it already shows it.
 *
 * @module
 */

import { createExtensionStorage } from "../storage";
import { readChromeLocalArea } from "../local-area";
import { startInPageIntegration } from "./controller";

/**
 * Run `run` once the document has a body to put a control into.
 *
 * **The manifest injects at `document_idle`, and that is not a guarantee.** `document_idle`
 * fires at or after `DOMContentLoaded` in practice, but "in practice" is not a contract, and a
 * content script that calls `attachShadow` against a `document` with no `body` fails once in
 * ten thousand page loads. The check costs one comparison.
 */
function whenDomReady(run: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
    return;
  }

  run();
}

whenDomReady(() => {
  const area = readChromeLocalArea();

  if (area === undefined) {
    return;
  }

  const storage = createExtensionStorage(area);

  if (storage.kind === "blocked") {
    return;
  }

  startInPageIntegration({ document, storage: storage.storage });
});
