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
 * ## Why creating a mailbox needs both refusals above to be false first
 *
 * Because this script does not create the mailbox. It **asks this extension's background context
 * to**, and that request is the only way a provider can be reached from a page: measured on
 * 2026-10-08 and recorded in `docs/PROVIDERS.md` §4.4, a content script's own cross-origin
 * request obeys the **page's** CORS policy while the extension's `host_permissions` do not reach
 * it, and the identical request from the background worker succeeds.
 *
 * **The store is still required here even though this script does not write.** The page reads it
 * twice: once at boot to decide which of the two offers to make, and once after a wait passes to
 * see whether a mailbox this extension asked for now exists. A context that could not read would
 * have to report "could not confirm" for every creation on every page, which is a worse answer than
 * offering no control at all — and offering no control is the refusal this module already makes.
 *
 * @module
 */

import { CREATE_MAILBOX_REQUEST, readCreateMailboxAnswer } from "../protocol";
import type { CreateMailboxAnswer } from "../protocol";
import { createExtensionStorage } from "../storage";
import { readChromeLocalArea, sendToBackground } from "../extension-platform";
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

  startInPageIntegration({
    document,
    storage: storage.storage,
    createMailbox: () => askTheBackgroundToCreate(),
  });
});

/**
 * Ask this extension's background context for a mailbox, and report what it answers.
 *
 * **Every shape that is not a recognised answer becomes `notActedOn`,** which is the answer that
 * says *nothing was created and nothing kept here* rather than the one that says a provider
 * refused. The seam already collapses an unreachable background context to no answer at all, and
 * this is the second half of the same rule: a reply nobody recognised is not a worse answer, it is
 * no answer, and the page has copy for that which makes no claim at all.
 *
 * **No timeout is imposed here.** The page owns how long it is willing to wait — it is a product
 * decision about a person's patience on somebody else's form, and the reasoning for the figure lives
 * with the one that uses it (`create-wait.ts`). A second deadline in the transport would be a second
 * place that figure could differ from the first.
 */
async function askTheBackgroundToCreate(): Promise<CreateMailboxAnswer> {
  return readCreateMailboxAnswer(await sendToBackground(CREATE_MAILBOX_REQUEST)) ?? {
    kind: "notActedOn",
  };
}
