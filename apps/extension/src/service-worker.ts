/**
 * The background service worker.
 *
 * ## What it does now, and what it still deliberately does not do
 *
 * It **answers a request to create a mailbox** and nothing else. What it still does not do is
 * **poll**: `packages/mailbox` polls through an injected `MailboxScheduler`, the website drives
 * that from a live tab at `INBOX_POLL_PROMPT_MS` — **5 000ms** — with an `INBOX_POLL_CEILING_MS` of
 * 30 000ms, and an MV3 background service worker is **idle-terminated** while `chrome.alarms`
 * enforces a floor of its own. So a session living here is a session that dies, and one living in
 * the popup dies whenever the popup closes, which is most of the time. **Neither is what the shared
 * layer assumes, and this repository has measured only a bound rather than a lifetime** —
 * `docs/PROVIDERS.md` §4.4 arm E has the worker still registered after a 35-second idle gap,
 * answering in 5 ms. That says it was alive; it says nothing about when it would not be.
 *
 * `docs/PROVIDERS.md` §4.1 records what `chrome.alarms` **stores**, and that Chrome's documented
 * packing of recurring alarms to at most once per 30 seconds is still unobserved here. **Two
 * absences are asserted in `service-worker.test.ts` rather than left to review**, because an absence
 * that is merely an omission reads as an oversight and gets filled in by whatever change next
 * touches this file. The requirement now reads *retention* rather than *emptiness*, which is the
 * stricter form of the same prohibition: a worker that holds nothing after answering behaves
 * identically whether it was woken or started cold.
 *
 * ## Why creation is here, and why that is a measurement rather than a choice
 *
 * Because a content script may not make this request itself. Measured 2026-10-08 (§4.4): a content
 * script's `fetch` to a host the extension holds `host_permissions` for is refused, while the
 * identical request from **this** worker succeeds — the extension's permissions do not cover a
 * content script's own request, and the **page's** CORS policy governs it. A control drawn inside
 * somebody else's signup form therefore has to ask this context to reach a provider on its behalf.
 *
 * ## What is deliberately not here
 *
 * **`skipWaiting` and `clients.claim` are not called**, on install or on activation. They exist to
 * make a new version take over from a running one mid-session, and this worker holds no state for a
 * takeover to corrupt — `create-mailbox.ts` builds and releases a session per request. The M0
 * spike's disposable fixture called `clients.claim()` to hold a permission open long enough to
 * measure a fetch; this is not that fixture, and claiming clients is a behaviour with
 * consequences bought for no reason this milestone can name.
 *
 * @module
 */

import { createExtensionMailboxOpener, handleCreateMailbox } from "./create-mailbox";
import { onBackgroundMessage, readChromeLocalArea } from "./extension-platform";
import { createExtensionStorage } from "./storage";
import { extensionTransport } from "./transport";

/**
 * Nothing to do on install.
 *
 * **Intentionally empty, and the note is the reason.** See the module note above.
 */
self.addEventListener("install", () => {
  // Intentionally empty. See the note above.
});

/**
 * Nothing to do on activation.
 *
 * **Intentionally empty, and the note is the reason.** See the module note above.
 */
self.addEventListener("activate", () => {
  // Intentionally empty. See the note above.
});

/**
 * Answer a request to create a mailbox.
 *
 * **The storage is read per request rather than once at module scope.** Reading it once would mean
 * caching a platform handle for the lifetime of a context whose lifetime is unmeasured, and would
 * make the "no storage area" path — which must answer `notStored` rather than throw — reachable
 * only before the first request.
 *
 * **`createExtensionStorage` never throws**, so this listener cannot fail to register over a
 * missing or blocked store; both become an answer, which is what keeps the page's wait from
 * outlasting a fault this worker could have named.
 *
 * **The opener is built once and holds nothing between requests.** `createExtensionMailboxOpener`
 * returns a function that builds a provider manager and a session, opens, and releases — so a
 * request arriving after an earlier one has been answered creates an independent mailbox rather
 * than reusing anything the earlier request left.
 */
onBackgroundMessage((request) => {
  const extensionStorage = createExtensionStorage(readChromeLocalArea());

  if (extensionStorage.kind === "blocked") {
    // **Nothing was created and nothing was persisted, but the answer is `notStored` rather than
    // `notActedOn`** because the request *was* acted on: this device cannot be told about an
    // address, so there is no address to offer. The two facts a page acts on differently are
    // "nothing was asked of a provider" and "an address cannot be kept here".
    return Promise.resolve({ kind: "notStored" });
  }

  return handleCreateMailbox(request, {
    mailboxes: extensionStorage.records.mailboxes,
    openMailbox: createExtensionMailboxOpener(extensionTransport),
  });
});
