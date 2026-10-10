/**
 * The one place this client reads the extension's platform global.
 *
 * ## What it supplies, and why the name says that rather than what it names
 *
 * Two seams: the extension's **local storage area**, and **messaging** between this extension's
 * contexts. The name is the one that covers both, and that is the rule this module has always
 * followed — *the name says what the module supplies rather than what it names.*
 *
 * **It was `local-area.ts`, and this is the second time the name had to move.** `chrome-platform.ts`
 * was the first, and it had to move because `tests/architecture/boundaries.test.ts` matches the bare
 * identifier `chrome` **including inside a module specifier** — so a file named after the platform
 * made the rule report `import … from "./chrome-platform"` in two entry points, as violations of the
 * very requirement that mandates that import. A rule that fires on the only correct import in the
 * codebase forces a choice between renaming the file and carving the pattern out, and the carve-out
 * was rejected because exempting any specifier containing the word would exempt a future one that
 * actually reaches the global.
 *
 * **`local-area.ts` was accurate until messaging arrived.** A content script may not `fetch` a
 * provider origin: measured on 2026-10-08 and recorded in `docs/PROVIDERS.md` §4.4, a content
 * script's request obeys the **page's** CORS policy while the extension's `host_permissions` do not
 * reach it, and the service worker's request to the same URL succeeds. So creating a mailbox from a
 * page has to be delegated, and delegation needs a second seam — and a module whose name no longer
 * describes it is how the next change ends up exempting paths by keyword.
 *
 * `extension-platform.ts` contains no `chrome` token in its path, so that first false positive
 * cannot recur.
 *
 * ## Why a module rather than a line in each entry point
 *
 * `main.tsx` used to hold the storage read, and its note said it was *"the only file that names
 * `chrome`"*. That sentence was true while the extension had **one** context, and stopped being a
 * boundary the moment it had two: either the read is copied into both and the two copies must be
 * kept in agreement forever, or it is shared and there is one expression. There are now **three**
 * consumers — the popup, the content script, and the background worker — so the duplication is not a
 * risk to watch for, it is what the natural spelling of this product would produce.
 *
 * **And the duplication had already happened before the rule existed.** `main.tsx` kept its own copy
 * of the shape check while this module was written beside it, and the new rule reported it by name
 * and line. Two copies of a shape check drift: one would gain a method the other did not, and the
 * extension would store a mailbox the popup could not read back.
 *
 * ## `Reflect.get` rather than a typed global, and the reason is a checked one
 *
 * There is no `chrome` declaration in this workspace's DOM lib, so `chrome.storage.local` would not
 * compile. A `declare global` block would make the platform's shape ambient across the whole package.
 * Reading it reflectively keeps the platform reachable from exactly one expression, and turns "no
 * `chrome` in this environment" into a value the caller can branch on rather than a crash on load.
 *
 * ## Why this also bears the rule's own design
 *
 * The boundary rule forbids the **member-expression** spelling `chrome.storage` across `apps/`, and
 * it strips comments before matching — so the prose in this file that names the platform is not a
 * violation, while `chrome.storage.local` in code would be. That is not a trick to evade the rule; it
 * is the rule's own design. The client is *supplying* the platform `packages/storage` needs, and the
 * adapter that consumes it lives in that package.
 *
 * ## What the messaging seam deliberately is not
 *
 * **It carries no request or answer shape.** This module moves bytes between two contexts and reports
 * absence as absence; what a request *means* and what an answer *claims* belong to `protocol.ts`, so
 * that both sides of the seam can agree on them without either importing the other. **Its failure
 * mode is `undefined`** — an absent platform, a send that is not a function, and a handler that threw
 * all resolve to no answer at all, which is a value the receiving side already has a name for and
 * already refuses to act on.
 *
 * ## The tab seam, and why it lives here rather than beside the popup
 *
 * **`chrome.tabs` is read through this module for the same reason `chrome.storage` is**, and the
 * boundary rule that confines the platform global to one module is the whole argument: a delivery
 * written beside the popup would name the global in a second file, and the rule that exists to stop
 * that would then have to be widened — which is the cheaper-looking option and the wrong one.
 *
 * **No `tabs` permission is declared, and none is needed.** `design.md` D1 measures it in Chromium
 * against the shipped manifest: `chrome.permissions.contains({permissions:["tabs"]})` answers
 * `false` throughout while `chrome.tabs.query({active:true, currentWindow:true})` names the tab the
 * popup is docked to and `chrome.tabs.sendMessage` reaches a content script there — on an origin
 * this extension holds **no** host permission for. So the seam returns a tab id and nothing else;
 * in particular it does not need `tab.url`, which is `undefined` without the permission and costs
 * nothing here because the content script knows which page it is in.
 *
 * @module
 */

import type { ChromeStorageArea } from "@spectre-mail/storage";

/**
 * The platform global, or `undefined` where there is none.
 *
 * **One expression, and the reason the whole boundary is possible.** Every read of the platform in
 * this client goes through here, so "the platform is reachable" and "the platform is named in one
 * place" are the same claim rather than two that can drift.
 */
function readPlatform(): unknown {
  return Reflect.get(globalThis, "chrome");
}

/**
 * A member of `value`, or `undefined` where there is no object to hang it off.
 *
 * **`Reflect.get` takes an `object`, and every level above this one is `unknown` by design.** There
 * is no `chrome` declaration in this workspace's DOM lib — that absence is precisely why the platform
 * is read reflectively — so nothing about its shape is known and a property access on it does not
 * compile. **The guard at every level is what makes the walk total:** a platform missing the runtime
 * object produces `undefined` here rather than a thrown `TypeError` inside a listener, and a
 * `sendMessage` that exists without an `onMessage` is absence of the *second* seam only, which is
 * what lets each consumer report its own.
 */
function readMember(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return Reflect.get(value, key);
}

/**
 * Read the extension's local storage area, or `undefined` where there is none.
 *
 * **A shape check rather than a cast**, because the whole point of not declaring a global `chrome` is
 * that nothing has verified this value. A cast would assert the three operations exist without having
 * looked — and a missing one is the difference between a store that is empty and no store at all,
 * which `packages/storage` draws the line between for a reason.
 */
export function readChromeLocalArea(): ChromeStorageArea | undefined {
  const value: unknown = readMember(readMember(readPlatform(), "storage"), "local");

  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { get?: unknown }).get !== "function" ||
    typeof (value as { set?: unknown }).set !== "function" ||
    typeof (value as { clear?: unknown }).clear !== "function"
  ) {
    return undefined;
  }

  return value as ChromeStorageArea;
}

/** A callable reached through the platform, whose signature nothing has verified. */
type PlatformFunction = (...args: unknown[]) => unknown;

/** The messaging runtime's listener registration, and nothing else it carries. */
interface PlatformListeners {
  readonly addListener: (listener: unknown) => void;
  readonly removeListener: (listener: unknown) => void;
}

/** What this platform offers for talking between this extension's own contexts. */
interface MessagingSeams {
  readonly send: PlatformFunction | undefined;
  readonly listen: PlatformListeners | undefined;
  readonly readLastError: (() => unknown) | undefined;
}

/**
 * The messaging seams, or `undefined` where the platform offers none.
 *
 * **`send` and `listen` are decided independently**, because the two consumers live in different
 * contexts and a single verdict would be wrong in one of them: the content script can only send, and
 * the worker can only listen. Returning `undefined` when *both* are missing is what lets
 * {@link sendToBackground} answer "no answer" and {@link onExtensionMessage} register nothing, and
 * each reports the platform's absence for its own side rather than the other one's.
 */
function readMessaging(): MessagingSeams | undefined {
  const runtime = readMember(readPlatform(), "runtime");
  const rawSend = readMember(runtime, "sendMessage");
  const rawListen = readMember(runtime, "onMessage");
  const rawAdd = readMember(rawListen, "addListener");
  const rawRemove = readMember(rawListen, "removeListener");
  const rawLastError = readMember(runtime, "lastError");

  const send: PlatformFunction | undefined =
    typeof rawSend === "function" ? (rawSend as PlatformFunction) : undefined;

  const listen: PlatformListeners | undefined =
    typeof rawAdd === "function" && typeof rawRemove === "function"
      ? {
          // **Called on `onMessage`, never on the function itself.** These are methods on the event
          // object, and a reflective read is exactly the thing that invites detaching one — which
          // compiles, typechecks, and throws on the first message.
          addListener: (listener) => {
            (rawAdd as PlatformFunction).call(rawListen, listener);
          },
          removeListener: (listener) => {
            (rawRemove as PlatformFunction).call(rawListen, listener);
          },
        }
      : undefined;

  if (send === undefined && listen === undefined) {
    return undefined;
  }

  return {
    send,
    listen,
    readLastError:
      typeof rawLastError === "object" && rawLastError !== null
        ? () => readMember(runtime, "lastError")
        : undefined,
  };
}

/**
 * Send a request to this extension's background context and resolve with whatever it answers.
 *
 * **`undefined` is the failure value, and it is the only one.** No platform, a `sendMessage` that is
 * not callable, and a reply the platform never delivered all resolve to no answer — because those
 * three are the same fact as far as anything that has to *act* on an answer is concerned, and
 * collapsing them at the transport means `protocol.ts` has one absence to refuse rather than three.
 *
 * **The platform's own error channel is read, and the reason is not tidiness.** A `sendMessage`
 * callback whose reply arrived with an error set logs an unchecked-runtime-error to the console
 * unless `lastError` is read inside the callback. Reading it is what keeps this module from
 * producing a console warning on every refusal, and the refusal it corresponds to is still surfaced
 * as `undefined` — reading the channel is not the same as answering with it.
 */
export function sendToBackground(request: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const messaging = readMessaging();
    const send = messaging?.send;

    if (send === undefined) {
      resolve(undefined);
      return;
    }

    try {
      send.call(readPlatform(), request, (reply: unknown) => {
        // **Read, then discard.** The value is not used to decide anything: an error here means the
        // reply did not come, which is `undefined`, and reading the channel only suppresses the log.
        messaging?.readLastError?.();
        resolve(reply);
      });
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * Answer requests from this extension's other contexts, and return the function that stops.
 *
 * ## Renamed from `onBackgroundMessage`, and the name was the thing that had become false
 *
 * **It was written when the only listener was the background worker.** It is now also how the
 * content script answers a request the **popup** sent it, which `design.md` D4 measures and
 * `extension-client` requires — the worker is not in that path at all. A name saying *background*
 * on the one function the content script calls to answer a popup would send the next reader
 * looking for a worker that is not involved, and the module's own answer to "where does this run"
 * would be wrong.
 *
 * **The name says what the module supplies, not which context happens to be listening**, which is
 * the same rule `AFFORDANCE_LABEL` and `CREATE_MAILBOX_REQUEST` are named by.
 *
 * **`true` is returned from the listener unconditionally**, which is what keeps the platform's reply
 * channel open past this listener's return. A listener answering synchronously would not need it, but
 * every answer here is asynchronous by construction — creation is a network round trip, and a fill
 * may be a person choosing a field — and returning `false` would close the channel before that answer
 * finished, turning every answer into no answer at all.
 *
 * **A handler that rejects answers `undefined`,** because a rejected handler is not a refusal and
 * must not be presented as one: the worker refused nothing, it failed to answer, and the page's copy
 * for those two facts is different. The distinction survives to the page precisely because the
 * transport does not launder it into a refusal.
 *
 * @param handle - Answers one request. Its value is sent back verbatim, unvalidated: this module
 *   does not know what a valid answer looks like, and {@link ../protocol!readCreateMailboxAnswer}
 *   is where that is decided on the other side.
 * @returns A function that removes the listener. Idempotent, and safe where the platform offers none.
 */
export function onExtensionMessage(handle: (request: unknown) => Promise<unknown>): () => void {
  const listen = readMessaging()?.listen;

  if (listen === undefined) {
    return () => {};
  }

  const listener = (
    request: unknown,
    _sender: unknown,
    respond: (answer: unknown) => void,
  ): boolean => {
    void handle(request).then(respond, () => respond(undefined));
    return true;
  };

  listen.addListener(listener);

  return () => {
    listen.removeListener(listener);
  };
}

/**
 * The tab seams, or `undefined` where the platform offers none.
 *
 * **`query` and `send` are one seam rather than two, and the reason is that a caller has both or
 * neither.** A tab id is worth nothing without a way to send to it, and a send needs an id this
 * seam found. Returning `undefined` when both are missing is what lets {@link findActiveTab} answer
 * "no tab" and {@link sendToTab} answer "no answer", and each reports the platform's absence for
 * its own half.
 */
function readTabs():
  | {
      /** The `chrome.tabs` object itself, because its methods are called reflectively. */
      readonly receiver: unknown;
      readonly query: PlatformFunction;
      readonly send: PlatformFunction;
    }
  | undefined {
  const receiver = readMember(readPlatform(), "tabs");
  const rawQuery = readMember(receiver, "query");
  const rawSend = readMember(receiver, "sendMessage");

  if (typeof rawQuery !== "function" || typeof rawSend !== "function") {
    return undefined;
  }

  return {
    receiver,
    query: rawQuery as PlatformFunction,
    send: rawSend as PlatformFunction,
  };
}

/**
 * The id of the tab this extension's window is showing, or `null` where there is none.
 *
 * ## The query is the one `design.md` D1 measured, and the measurement is why it is written out
 *
 * **`{ active: true, currentWindow: true }` from an action popup names the tab the popup is docked
 * to**, and it does so **with no `tabs` permission declared**: measured in Chromium, with the
 * shipped manifest's `storage`-only permissions, `chrome.permissions.contains({permissions:["tabs"]})`
 * answered `false` throughout while this query named the right tab. That is why this function exists
 * at all rather than a permission being added, and `in-page-integration`'s *"A code reaches the
 * page without a permission this extension does not already hold"* is a behavioural requirement
 * precisely so that adding one would fail.
 *
 * **`currentWindow` rather than `active: true` alone**, because "the active tab" across all of a
 * user's windows is a different tab most of the time, and a verification code delivered to the
 * wrong one of them is a code in somebody else's form.
 *
 * ## `null` is the answer for three different absences, and they are not collapsed further
 *
 * **No `tabs`, a query that returned nothing, and a query that threw.** They are the same fact as
 * far as anything that has to *act* on a tab id is concerned — there is nothing to deliver to — and
 * the caller is required to refuse rather than fall back to some other tab. **A fallback is the one
 * thing this function must not grow:** "no tab, so try them all" is a delivery to every page the
 * user has open, and `design.md` D1 records the measurement that sending to every tab answered on
 * exactly one while placing a code into every content script that had a qualifying field.
 */
export function findActiveTab(): Promise<number | null> {
  return new Promise((resolve) => {
    const tabs = readTabs();

    if (tabs === undefined) {
      resolve(null);
      return;
    }

    try {
      void tabs.query.call(
        tabs.receiver,
        { active: true, currentWindow: true },
        (found: unknown) => {
          resolve(firstTabId(found));
        },
      );
    } catch {
      resolve(null);
    }
  });
}

/** The first numeric id in a `tabs.query` answer, or `null` for anything else. */
function firstTabId(found: unknown): number | null {
  if (!Array.isArray(found)) {
    return null;
  }

  for (const tab of found) {
    const id: unknown = readMember(tab, "id");
    if (typeof id === "number") {
      return id;
    }
  }

  return null;
}

/**
 * Send a request to one named tab and resolve with whatever it answers.
 *
 * **`undefined` is the failure value, for the same reasons as {@link sendToBackground}.** A
 * platform with no tab seams, a tab id that names nothing, and a page that refused to answer are
 * three facts the caller must report identically: **no page confirmed anything**, which is the one
 * report `extension-client` requires when a code cannot be confirmed as filled.
 *
 * **A tab id is passed through rather than discovered here**, because discovery is a separate
 * question with its own measurement and its own refusal. A function that found a tab *and* sent to
 * it would have one failure mode instead of two, and the caller would have no way to say "there was
 * no tab" as distinct from "the page did not answer".
 *
 * @param tabId - The tab {@link findActiveTab} named. Never a list, and never "any".
 * @param request - The request, sent verbatim. What it means belongs to `protocol.ts`.
 */
export function sendToTab(tabId: number, request: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const messaging = readMessaging();
    const tabs = readTabs();

    if (tabs === undefined) {
      resolve(undefined);
      return;
    }

    try {
      tabs.send.call(tabs.receiver, tabId, request, (reply: unknown) => {
        // **Read, then discard, for the reason {@link sendToBackground} records:** the error channel
        // is read to suppress the console warning, and the refusal itself is surfaced as
        // `undefined`.
        messaging?.readLastError?.();
        resolve(reply);
      });
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * What this platform can be asked to raise, and nothing else about it.
 *
 * ## The two members, and why the interface is this small
 *
 * `create` is what the product needs. `clear` is not used by anything this slice ships, and it is
 * here **only so a future caller cannot reach past this seam** — the whole point of reading the
 * platform reflectively is that the shape is checked at this boundary rather than assumed anywhere
 * downstream. A seam that carried the whole API would be a seam that could be used to reach a
 * member nobody looked at.
 */
export interface NotificationPlatform {
  /**
   * Ask for a notification, and resolve with the id the platform reports or `null`.
   *
   * **The resolved value is the whole of the answer, and `null` is the only refusal there is.**
   * Measured on 2026-10-11 (`docs/PROVIDERS.md` §4.5): `chrome.notifications.onError` **does not
   * exist** on the Chromium measured, so there is no second channel, and a callback that resolves
   * is *not* by itself evidence the platform holds a notification — a request with no icon resolved
   * and registered nothing. The caller must therefore treat `null` as a refusal and must not treat a
   * resolved id as proof of delivery to a person, which nothing here can observe.
   */
  readonly create: (notificationId: string, options: NotificationRequest) => Promise<string | null>;
  readonly clear: (notificationId: string) => Promise<boolean>;
}

/** What a notification asks the platform to show. Three fields, and the third is measured in. */
export interface NotificationRequest {
  /** The line a person reads first. */
  readonly title: string;
  /** The line under it. */
  readonly message: string;
  /**
   * The icon, as an absolute URL.
   *
   * **Not optional, and that is a measurement rather than a style.** `docs/PROVIDERS.md` §4.5: a
   * notification created without one resolves its callback and registers nothing, and an SVG is
   * refused outright. Making it optional here would put that trap one line away.
   */
  readonly iconUrl: string;
}

/**
 * Read the notification platform, or `undefined` where this context has none.
 *
 * **A shape check naming `create`, not `onError`, because the error event does not exist here.**
 * `onError` is checked in `notification-display.mjs`'s probe and found `undefined`; requiring it here
 * would report this platform unusable on the Chromium this repository measures, and requiring nothing
 * beyond `create` would not notice a platform that had lost `clear`. So the check is what the product
 * actually calls, and the absence it reports is a real one.
 */
export function readNotificationPlatform(): NotificationPlatform | undefined {
  const value: unknown = readMember(readPlatform(), "notifications");

  if (
    typeof value !== "object" ||
    value === null ||
    typeof readMember(value, "create") !== "function" ||
    typeof readMember(value, "clear") !== "function"
  ) {
    return undefined;
  }

  return value as NotificationPlatform;
}

/**
 * The absolute URL of a file this extension ships, or `undefined` where the runtime is absent.
 *
 * ## Why the icon cannot be spelled here or at the call site
 *
 * A relative path would be resolved against whatever document happened to load, and a notification
 * is raised from a worker that has no document at all. The extension's own URL prefix is therefore
 * the only correct spelling, and `design.md` D12's measurement says the icon is load-bearing — so it
 * is resolved in **one** place rather than in each caller, and the file name is a parameter so this
 * module holds no opinion about which asset the product ships.
 */
export function extensionAssetUrl(file: string): string | undefined {
  const runtime: unknown = readMember(readPlatform(), "runtime");
  const getUrl: unknown = readMember(runtime, "getURL");

  if (typeof getUrl !== "function") {
    return undefined;
  }

  try {
    const url: unknown = Reflect.apply(getUrl, runtime, [file]);
    return typeof url === "string" ? url : undefined;
  } catch {
    // **The same three absences {@link sendToTab} collapses**, for the same reason: a file this
    // extension cannot address is absence of the asset, not a fault to raise inside a listener.
    return undefined;
  }
}

/** What a repeated alarm is asked to be. One member, and the period is the only thing it carries. */
export interface AlarmSchedule {
  /**
   * The period, in minutes.
   *
   * **A fraction, not a floor.** `docs/PROVIDERS.md` §4.1.1 measured a 5 000 ms period firing at
   * 5 000 ms on the Chromium this repository uses, so the number reaching this interface is
   * `5000 / 60000` and rounding it up would silently quadruple the request rate.
   */
  readonly periodInMinutes: number;
}

/**
 * What this platform offers for scheduling this extension's own work.
 *
 * **`get` is deliberately absent.** `create` replaces an alarm of the same name, so "is there
 * already one" has no answer this product needs: reconciling on browser start means **asking for
 * the alarm again**, which is correct whether or not the previous one survived. A seam carrying a
 * member nothing calls is a seam a future caller can reach a member nobody looked at.
 */
export interface AlarmPlatform {
  /** Create, or replace, the named alarm. Resolves when the platform has taken the request. */
  readonly create: (name: string, schedule: AlarmSchedule) => Promise<void>;
  /** Clear the named alarm. Resolves with whether there was one. */
  readonly clear: (name: string) => Promise<boolean>;
}

/**
 * Read the alarm platform, or `undefined` where this context has none.
 *
 * **The shape check names the two members the product calls**, for the reason
 * {@link readNotificationPlatform} gives: requiring a member nothing uses would report this platform
 * unusable on a browser that has it.
 *
 * **Both members are wrapped rather than handed back raw**, because neither is awaited at the call
 * site without a promise: `create` returns nothing in some versions of the platform and a promise in
 * others, and the wrapper accepts either, so a caller can `await` unconditionally. The `catch` is the
 * same collapse {@link sendToTab} makes - an alarm this platform refused to schedule is absence of
 * the schedule, not a fault to raise inside a listener that fired on its own.
 */
export function readAlarmPlatform(): AlarmPlatform | undefined {
  const receiver: unknown = readMember(readPlatform(), "alarms");
  const rawCreate = readMember(receiver, "create");
  const rawClear = readMember(receiver, "clear");

  if (typeof rawCreate !== "function" || typeof rawClear !== "function") {
    return undefined;
  }

  return {
    create: async (name: string, schedule: AlarmSchedule): Promise<void> => {
      try {
        await Reflect.apply(rawCreate, receiver, [name, schedule]);
      } catch {
        // **Nothing here.** An alarm the platform refused is a check this device is not running, and
        // the only listener that would report it is a timer that never fired.
      }
    },
    clear: async (name: string): Promise<boolean> => {
      try {
        return (await Reflect.apply(rawClear, receiver, [name])) === true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Add a listener to one platform event, and return the function that removes it.
 *
 * **Both event registrations go through here rather than being written out twice**, because the two
 * that exist - an alarm firing and the browser starting - are read the same reflective way and fail
 * the same way, and a second spelling of "listen to an event" is a second place for a missing
 * `removeListener` to hide.
 *
 * @param object - The event object to listen on, or `undefined` where the platform offers none.
 * @returns A function that removes the listener. Idempotent, and safe where there was none.
 */
function onPlatformEvent(
  object: unknown,
  handle: (payload: unknown) => void,
): () => void {
  const add = readMember(object, "addListener");
  const remove = readMember(object, "removeListener");

  if (typeof add !== "function" || typeof remove !== "function") {
    return () => {};
  }

  // **Called on the event, never on the function itself** - the reason `readMessaging` records, and
  // the same trap: a reflective read of a method invites detaching it.
  add.call(object, handle);

  return () => {
    remove.call(object, handle);
  };
}

/**
 * Run `handle` when the browser starts.
 *
 * **This is the reconciliation seam, and `chrome.runtime.onStartup` is the third listener this
 * worker registers** (`design.md` D10). It exists because the measurement that discharged the
 * removed requirement's gate established that a **record** in `chrome.storage.local` survives a
 * restart, and established nothing about an **alarm**: `docs/PROVIDERS.md` §4.1.1 holds a 120 000 ms
 * idle bound and not a lifetime, so nothing here may assume a schedule outlived a reboot.
 *
 * @returns A function that removes the listener. Idempotent, and safe where the platform offers none.
 */
export function onBrowserStart(handle: () => void): () => void {
  return onPlatformEvent(
    readMember(readMember(readPlatform(), "runtime"), "onStartup"),
    () => {
      handle();
    },
  );
}

/**
 * Run `handle` with the name of an alarm that fired.
 *
 * **The name is passed through rather than filtered here.** "Exactly one alarm" is a property of
 * what this extension *creates*, and a filter would make that property unfalsifiable: a second alarm
 * would simply never reach a listener, and the suite would have nothing to catch.
 *
 * **An event carrying no readable name is ignored**, because an alarm this extension cannot name is
 * not one it created, and treating it as its own would make the one-alarm property a claim about a
 * listener rather than about the code.
 *
 * @returns A function that removes the listener. Idempotent, and safe where the platform offers none.
 */
export function onAlarmFired(handle: (alarmName: string) => void): () => void {
  return onPlatformEvent(
    readMember(readMember(readPlatform(), "alarms"), "onAlarm"),
    (alarm: unknown) => {
      const name: unknown = readMember(alarm, "name");

      if (typeof name !== "string") {
        return;
      }

      handle(name);
    },
  );
}
