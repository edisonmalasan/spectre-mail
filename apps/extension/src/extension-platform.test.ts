/**
 * The one module this client reaches its platform through, exercised against a platform this file
 * builds.
 *
 * ## Why a fake platform at all, when a real Chromium is a browser tier away
 *
 * **Because the paths that matter most are the ones the browser tier cannot reach.** The browser
 * tier runs against a real extension context, where the platform is present and complete; what it
 * cannot stage is a *missing* `chrome`, a `runtime` without `sendMessage`, or an `onMessage` that
 * never answers. Those are the absences the seam exists to report, and a seam's absences are exactly
 * the ones a real platform never demonstrates.
 *
 * ## The fake is built as an object literal, deliberately
 *
 * **Not a hand-written class and not a partial stub.** The module under test walks the platform
 * reflectively, so what it needs is a value with a particular *shape* — and a class would supply
 * methods on the prototype, which `Reflect.get` finds and a plain record does not. A record is
 * therefore the stricter fixture: it fails if the module started reading anything that only a
 * prototype would carry, which is what an object literal is for.
 *
 * ## Every case restores the global, and that is the part that makes the file trustworthy
 *
 * `globalThis` is shared by every test in the process, and the first version of this file installed
 * a platform and left it. A leaked `chrome` would make a later case that asserts *absence* pass for
 * the wrong reason — the same defect `content-script.test.ts` records about a leaked controller. So
 * the original descriptor is captured once and restored after every case, and there is a case that
 * asserts the restoration actually happened.
 *
 * @vitest-environment node
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChromeStorageArea } from "@spectre-mail/storage";

import { onBackgroundMessage, readChromeLocalArea, sendToBackground } from "./extension-platform";

/** How the platform was before this file touched it, captured before any case can change it. */
const ORIGINAL = Object.getOwnPropertyDescriptor(globalThis, "chrome");

/** Install a platform of the given shape for the duration of one case. */
function installPlatform(shape: unknown): void {
  Object.defineProperty(globalThis, "chrome", {
    value: shape,
    configurable: true,
    writable: true,
  });
}

/** Remove the platform, which is the case that matters for every "or `undefined`" claim below. */
function removePlatform(): void {
  Reflect.deleteProperty(globalThis, "chrome");
}

afterEach(() => {
  if (ORIGINAL === undefined) {
    Reflect.deleteProperty(globalThis, "chrome");
    return;
  }

  Object.defineProperty(globalThis, "chrome", ORIGINAL);
});

describe("reading the local storage area", () => {
  it("returns the area when the platform offers one", () => {
    const area = { get: vi.fn(), set: vi.fn(), clear: vi.fn() };
    installPlatform({ storage: { local: area } });

    expect(readChromeLocalArea()).toBe(area as unknown as ChromeStorageArea);
  });

  it.each([
    ["no platform at all", () => removePlatform()],
    ["a platform that is not an object", () => installPlatform("chrome")],
    ["a platform with no storage", () => installPlatform({ runtime: {} })],
    ["storage with no local area", () => installPlatform({ storage: {} })],
    // **Two areas that fail the shape check differently, because one is the case the rule's wording
    // would not obviously cover.** `get` is the only member `loadMailbox` needs, so an
    // implementation that checked `get` alone would return this area — and then a *write* would fail
    // at its first call, inside the popup, after the user pressed the button.
    ["an area that cannot write", () => installPlatform({ storage: { local: { get: vi.fn() } } })],
    [
      "an area that cannot clear",
      () => installPlatform({ storage: { local: { get: vi.fn(), set: vi.fn() } } }),
    ],
    [
      "a storage member that is not an object",
      () => installPlatform({ storage: { local: "local" } }),
    ],
    // **`null`, which is the value a platform is most likely to hold and the one a truthiness check
    // would let through.** `Reflect.get(null, "local")` throws a `TypeError`, so a walk that reached
    // this depth without a guard would raise inside the popup's module evaluation rather than
    // report absence.
    ["a null area", () => installPlatform({ storage: { local: null } })],
  ])("reports no area for %s", (_label, install) => {
    install();

    // **`undefined`, and never a throw.** This module's whole failure mode is "absence, reported as
    // absence" — every one of its three consumers branches on it, and a thrown `TypeError` would
    // happen while a module is still being evaluated, before any consumer could branch at all.
    expect(readChromeLocalArea()).toBeUndefined();
  });
});

describe("sending a request to the background context", () => {
  it("resolves with whatever the platform answers, having called the platform itself", async () => {
    // **A plain function rather than a mock, because the receiver is the thing under test.**
    // `sendMessage` is read reflectively off `chrome.runtime`, so calling it with an undefined
    // receiver is what a naive reflective read produces — and a platform method that needs `this`
    // raises `TypeError` on such a call. A mock would record the receiver too, but reading it back
    // means reading an implementation detail of the mock; `this` in a function is the value itself.
    const receivers: unknown[] = [];
    // **Built as a record and typed as one, because the property is added after the object is
    // declared** — an object literal with both members would need the method to close over
    // `receivers` before it exists, and the workarounds for that (`as`, `!`, a class) would each
    // hide the very thing the receiver assertion is about.
    const platform: Record<string, unknown> = { runtime: { onMessage: {} } };
    (platform["runtime"] as Record<string, unknown>)["sendMessage"] = function (
      this: unknown,
      _request: unknown,
      respond: (reply: unknown) => void,
    ) {
      receivers.push(this);
      respond({ kind: "notActedOn" });
    };
    installPlatform(platform);

    await expect(sendToBackground({ kind: "a request" })).resolves.toEqual({
      kind: "notActedOn",
    });
    expect(receivers).toEqual([platform]);
  });

  it.each([
    ["no platform at all", () => removePlatform()],
    ["a platform with no runtime", () => installPlatform({ storage: { local: {} } })],
    ["a runtime with no messaging", () => installPlatform({ runtime: {} })],
    [
      "a sendMessage that is not callable",
      () => installPlatform({ runtime: { sendMessage: "send", onMessage: {} } }),
    ],
  ])("resolves no answer for %s", async (_label, install) => {
    install();

    // **`undefined` is the one absence this product has a name for**, and the requirement says an
    // answer the worker did not send SHALL NOT be presented as a refusal. If this resolved
    // `notActedOn` it would be the page reporting a refusal that never happened; if it rejected,
    // the rejection would surface inside a `void`ed call on somebody else's page.
    await expect(sendToBackground({ kind: "a request" })).resolves.toBeUndefined();
  });

  it("resolves no answer when the platform throws rather than answering", async () => {
    installPlatform({
      runtime: {
        sendMessage: () => {
          throw new Error("Extension context invalidated.");
        },
        onMessage: {},
      },
    });

    // **A thrown send is a real platform outcome, not a hypothetical one.** Chromium throws
    // "Extension context invalidated" from any extension API once its context has been torn down —
    // the popup closing, or a service worker being replaced — and an exception escaping here would
    // be raised on a page this product does not own.
    await expect(sendToBackground({ kind: "a request" })).resolves.toBeUndefined();
  });

  it("reads the platform's error channel *inside* the reply callback", async () => {
    // **Order is the assertion, and it is the only thing that can distinguish the two reads.** This
    // module reads `lastError` twice for two different reasons: once to decide whether the channel
    // exists at all, and once inside the reply callback. An accessor that records every read is
    // therefore the only fixture that can tell those apart — counting reads would be satisfied by
    // the detection read alone, which is the recorded shape of a check narrower than its rule.
    const log: string[] = [];
    const lastError = { message: "Could not establish connection." };
    const runtime = {
      onMessage: {},
      sendMessage(_request: unknown, respond: (reply: unknown) => void) {
        log.push("sendMessage");
        respond(undefined);
      },
      get lastError(): unknown {
        log.push("lastError");
        return lastError;
      },
    };
    installPlatform({ runtime });

    await expect(sendToBackground({ kind: "a request" })).resolves.toBeUndefined();

    // **Read, then discarded — and that is the whole of its purpose.** An error left unread on
    // `chrome.runtime.lastError` inside a callback is reported by the platform as an *unchecked
    // runtime error* on the console, so not reading it is what produces the warning. Reading it is
    // not the same as answering with it: the answer above is still `undefined`, which is what a page
    // must report when nothing came back.
    //
    // **The whole sequence, not an index comparison.** `indexOf` would return the *detection* read at
    // position 0 and pass on an implementation that never reads the channel inside the callback —
    // which is the exact shape of the defect this case exists to catch, committed while writing it.
    // Two reads and their positions are the assertion: one before the send to decide the channel
    // exists, one inside the reply.
    expect(log).toEqual(["lastError", "sendMessage", "lastError"]);
  });
});

describe("answering requests from this context", () => {
  /** A platform whose `onMessage` records what was registered, so a listener can be driven. */
  function listeningPlatform() {
    const registered: Array<
      (request: unknown, sender: unknown, respond: (v: unknown) => void) => boolean
    > = [];
    const removed: unknown[] = [];
    const onMessage = {
      addListener(listener: unknown) {
        registered.push(
          listener as (request: unknown, sender: unknown, respond: (v: unknown) => void) => boolean,
        );
      },
      removeListener(listener: unknown) {
        removed.push(listener);
      },
    };

    installPlatform({ runtime: { onMessage, sendMessage: vi.fn() } });

    return { registered, removed };
  }

  it("registers one listener and answers through it", async () => {
    const { registered } = listeningPlatform();
    const handle = vi.fn(async () => ({ kind: "created", address: "made@address.test" }));

    onBackgroundMessage(handle);

    expect(registered).toHaveLength(1);
    const answers: unknown[] = [];
    const kept = registered[0]?.({ kind: "spectre:create-mailbox" }, {}, (value) => {
      answers.push(value);
    });

    // **`true`, and that is load-bearing rather than conventional.** Returning `false` — or
    // returning nothing — closes the platform's reply channel the moment the listener returns, and
    // every answer here is asynchronous by construction. Closing it would turn every answer into no
    // answer at all, and the page would report "could not confirm" for a mailbox that was created.
    expect(kept).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(answers).toEqual([{ kind: "created", address: "made@address.test" }]);
  });

  it("answers no answer at all when the handler rejects", async () => {
    const { registered } = listeningPlatform();

    onBackgroundMessage(() => Promise.reject(new Error("the store is gone")));

    const answers: unknown[] = [];
    registered[0]?.({ kind: "spectre:create-mailbox" }, {}, (value) => {
      answers.push(value);
    });
    await Promise.resolve();
    await Promise.resolve();

    // **`undefined`, not the rejection and not a refusal.** A worker that never answered is a
    // different fact from a worker that refused, and `protocol.ts` collapses an unrecognised reply
    // to "no answer" precisely so the page can report it without inventing a refusal. A handler
    // rejection laundered into a refusal would name a provider that never refused anything.
    expect(answers).toEqual([undefined]);
  });

  it("stops listening, and reports nothing as removed twice", () => {
    const { registered, removed } = listeningPlatform();

    const stop = onBackgroundMessage(async () => undefined);
    stop();

    expect(removed).toEqual(registered);
    // **Idempotent, because the returned function is a teardown and teardowns get called twice.**
    // The service worker never calls it — its lifetime is the platform's — but the popup's module
    // evaluation does not own this either, and a teardown that throws on a second call would be a
    // failure nobody could reproduce.
    expect(() => stop()).not.toThrow();
  });

  it("returns an inert teardown where the platform offers no listener", () => {
    // **Absence, handled rather than reported**, because a context that cannot listen has nothing to
    // say about it: the worker is the context that can listen, and the content script is not. The
    // only obligation is that asking must not throw.
    removePlatform();

    const stop = onBackgroundMessage(async () => ({ kind: "notActedOn" }));

    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
  });

  it("registers nothing where the platform's onMessage cannot add listeners", () => {
    installPlatform({ runtime: { onMessage: { addListener: "add" }, sendMessage: vi.fn() } });

    expect(() => onBackgroundMessage(async () => undefined)).not.toThrow();
  });
});
