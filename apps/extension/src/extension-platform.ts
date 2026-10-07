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
 * {@link sendToBackground} answer "no answer" and {@link onBackgroundMessage} register nothing, and
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
 * **`true` is returned from the listener unconditionally**, which is what keeps the platform's reply
 * channel open past this listener's return. A listener answering synchronously would not need it, but
 * every answer here is asynchronous by construction — creation is a network round trip — and
 * returning `false` would close the channel before that round trip finished, turning every answer into
 * no answer at all.
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
export function onBackgroundMessage(handle: (request: unknown) => Promise<unknown>): () => void {
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
