/**
 * The background service worker.
 *
 * ## What it does now, and what it still deliberately does not do
 *
 * It **answers a request to create a mailbox**, and it **runs one wake of the background check**
 * (`background-check.ts`) on a schedule it does not hold: a single `chrome.alarms` alarm whose period
 * is read from `packages/mailbox`'s cadence at the point of use. **What it still does not do is hold
 * anything.** Each wake builds its own session, takes one listing, and releases it before the wake
 * ends — `create-mailbox.ts` already establishes that shape for creation, and `background-check.ts`
 * copies it rather than inventing a second one.
 *
 * **That shape is not a preference; an MV3 background worker is idle-terminated.** What this
 * repository holds about the worker's idle lifetime is a **120 000 ms bound and not a figure** — the
 * measurement stopped watching and the worker did not stop (`docs/PROVIDERS.md` §4.1.1,
 * `alarms-packing-interval`). **An earlier version of this note said `chrome.alarms` "enforces a
 * floor of its own", and that sentence was false**: §4.1.1 measured no packing at all on the
 * Chromium measured, and found instead that two alarms armed together starve one another. It is
 * deleted rather than reworded, because what it called a fact was not one this repository had evidence
 * for in either direction.
 *
 * **The alarm is reconciled on every browser start** rather than assumed to have survived, for the
 * matching reason: the measurement that established that a *record* survives a restart (§4.4)
 * established nothing about a *schedule*.
 *
 * **The alarm is armed where a mailbox is written and nowhere else.** The only place this product
 * writes a mailbox record is `handleCreateMailbox`'s `addMailbox`, so arming on that answer covers
 * every path this build has. **The limit is stated rather than closed**: a mailbox that reached
 * storage some other way — a record written by a build that predates this one, or a future path that
 * writes the area directly — is armed on the next browser start rather than at once, because
 * watching the area would add a platform seam for a case this repository cannot name.
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

import {
  BACKGROUND_ALARM_NAME,
  clearBackgroundAlarm,
  reconcileBackgroundAlarm,
} from "./alarms";
import { createBackgroundCheck } from "./background-check";
import { createExtensionMailboxOpener, handleCreateMailbox } from "./create-mailbox";
import {
  extensionAssetUrl,
  onAlarmFired,
  onBrowserStart,
  onExtensionMessage,
  readAlarmPlatform,
  readChromeLocalArea,
  readNotificationPlatform,
} from "./extension-platform";
import { NOTIFICATION_ICON_FILE, raiseNotification } from "./notification";
import { createExtensionStorage, loadInsertableMailboxes } from "./storage";
import type { ExtensionRecords } from "./storage";
import { extensionTransport } from "./transport";

/**
 * Nothing to do on install.
 *
 * **Deliberately unfilled, and this note is the reason it reads that way.** An empty listener reads as
 * forgotten, which is how this file's header came to carry a `chrome.alarms` floor that no
 * measurement supports. The module note above says what this worker deliberately does not do on a
 * version change, and there is nothing to do here that is not either a state change it must not make
 * or a schedule it must not assume survived.
 */
self.addEventListener("install", () => {
  // Deliberately unfilled. See the module note above.
});

/**
 * Nothing to do on activation.
 *
 * **Deliberately unfilled, for the reason the `install` listener above records.**
 */
self.addEventListener("activate", () => {
  // Deliberately unfilled. See the module note above.
});

/**
 * Answer whether this device holds a mailbox, for the alarm's reconciliation.
 *
 * **The question is answered here and passed as a function**, so `alarms.ts` can be driven to every
 * arm — holding one, holding none, and a read that fails — without a platform.
 * **`loadInsertableMailboxes` rather than the collection alone**, for the reason `storage.ts` gives: a
 * device whose mailbox predates the collection still holds one, and asking the collection alone would
 * tell this extension it has nothing to watch.
 */
function holdsMailbox(records: ExtensionRecords): Promise<boolean> {
  return loadInsertableMailboxes(records).then((held) => held.length > 0);
}

/**
 * Arm or withhold the background alarm for a context that has just read its storage.
 *
 * **Named for the question rather than for the work**, because the same function is reached from two
 * places that have nothing else in common: a browser starting, and a mailbox having just been written.
 */
function reconcileAlarmFor(records: ExtensionRecords): Promise<boolean> {
  return reconcileBackgroundAlarm({
    platform: readAlarmPlatform(),
    holdsMailbox: () => holdsMailbox(records),
  });
}

/**
 * Run one wake of the background check, against this context's platform and storage.
 *
 * **Built per alarm rather than held**, because the wake holds nothing: what this closes over is the
 * seams, and the session each wake builds is released inside `createExtensionListingReader` before the
 * wake resolves.
 *
 * **A resolved icon URL is passed whether or not one could be built**, because `raiseNotification`
 * requires the parameter and the measurement says a request naming nothing is refused with `null` —
 * which is the refusal this check already knows how to read. An absent URL is therefore reported by
 * the platform rather than being turned into a different, unmeasured behaviour here.
 */
function wakeThisContext(records: ExtensionRecords): Promise<unknown> {
  return createBackgroundCheck({
    transport: extensionTransport,
    records,
    announce: (message) =>
      raiseNotification(
        message,
        readNotificationPlatform(),
        extensionAssetUrl(NOTIFICATION_ICON_FILE) ?? "",
      ),
    clearAlarm: async () => {
      await clearBackgroundAlarm(readAlarmPlatform());
    },
  })();
}

/**
 * Reconcile the alarm on browser start.
 *
 * **The storage is read here rather than at module scope**, for the reason the message listener below
 * gives. A start on a device holding no mailbox arms nothing; a start on one that does asks for the
 * alarm again, and `chrome.alarms.create` replacing an alarm of the same name is what makes "is
 * there already one" a question this product never has to ask.
 */
onBrowserStart(() => {
  const extensionStorage = createExtensionStorage(readChromeLocalArea());

  if (extensionStorage.kind === "blocked") {
    // **Nothing is armed, and nothing is said.** A device whose storage cannot be read does not get a
    // schedule that would spend provider requests to discover what it could not have read.
    return;
  }

  void reconcileAlarmFor(extensionStorage.records);
});

/**
 * Run a wake when the background alarm fires.
 *
 * **The name is compared here rather than filtered upstream**, so a second alarm created by some
 * later change would reach this listener and be ignored *here*, where a test can see it — rather than
 * never arriving, where the "exactly one alarm" property would have nothing left to falsify.
 *
 * **A wake that rejects is contained**, because an unhandled rejection inside an alarm listener is a
 * worker that logs and stops, and the next wake then does not arrive because the listener is gone.
 * `background-check.ts` already resolves every failure it can name into an outcome; this catches the
 * ones it cannot.
 */
onAlarmFired((alarmName) => {
  if (alarmName !== BACKGROUND_ALARM_NAME) {
    return;
  }

  const extensionStorage = createExtensionStorage(readChromeLocalArea());

  if (extensionStorage.kind === "blocked") {
    // **Nothing is announced and the alarm stays.** A wake that cannot read this device's records
    // cannot know what it has already told anybody about, and announcing a whole mailbox because a
    // store is unavailable is the failure this product has spent five milestones refusing.
    return;
  }

  void wakeThisContext(extensionStorage.records).catch(() => {
    // **Deliberately silent, and this empty block is the whole of the reason.** Nothing in this
    // context can show an error to a person: a notification's failure is reported by *not recording*
    // the message, and a wake's failure by leaving the record untouched. A console line would be the
    // only trace, and a trace nobody reads is not a report.
  });
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
onExtensionMessage((request) => {
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
  }).then((answer) => {
    /**
     * **The alarm is armed here, on a mailbox that was actually recorded, and nowhere else.**
     *
     * The page's wait is answered with the answer `handleCreateMailbox` built — arming is a side
     * effect that happens after the write, never a step the page's request depends on, so a browser
     * without alarms still gets `created` answered. The alternative would be to await the arm inside
     * `handleCreateMailbox`, which would put a `chrome.alarms` failure into the answer of a request
     * that had nothing to do with alarms.
     *
     * **A refusal arms nothing**, because `notStored` means this device cannot keep a mailbox at all
     * and `notActedOn` means nothing was written for it.
     */
    if (answer.kind === "created") {
      void reconcileAlarmFor(extensionStorage.records);
    }

    return answer;
  });
});
