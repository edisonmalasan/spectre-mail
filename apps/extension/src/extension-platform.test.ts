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

import {
  extensionAssetUrl,
  findActiveTab,
  onAlarmFired,
  onBrowserStart,
  onExtensionMessage,
  readAlarmPlatform,
  readChromeLocalArea,
  readNotificationPlatform,
  sendToBackground,
  sendToTab,
} from "./extension-platform";

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

/**
 * ## The tab seam, and why its cases are as many absences as successes
 *
 * **A tab id is the only address this extension ever delivers a code to, and a wrong one is a code
 * in somebody else's form.** So the cases below are mostly about *not* producing one: no platform,
 * a `tabs` without a `query`, a query that answered with something that is not a list, a list with
 * no usable id in it, and a query that threw. **A seam that produced an id for any of those would
 * deliver a verification code to an arbitrary page**, and the platform would raise no complaint
 * doing it.
 */
describe("finding the tab this extension is looking at", () => {
  /** A platform whose `tabs.query` records what it was asked and answers with `tabs`. */
  function queryingPlatform(tabs: unknown) {
    const asked: unknown[] = [];
    const receivers: unknown[] = [];
    const query = function (this: unknown, queryInfo: unknown, respond: (found: unknown) => void) {
      receivers.push(this);
      asked.push(queryInfo);
      respond(tabs);
    };

    installPlatform({ tabs: { query, sendMessage: vi.fn() } });

    return { asked, receivers };
  }

  it("names the active tab of this extension's own window", async () => {
    // **The query itself is the assertion, not just the id.** An implementation that asked for
    // `{ active: true }` alone would return a tab id from a *different* window most of the time,
    // which is a page the person did not ask about and this suite would have called a pass.
    const { asked, receivers } = queryingPlatform([{ id: 41 }]);

    await expect(findActiveTab()).resolves.toBe(41);

    expect(asked).toEqual([{ active: true, currentWindow: true }]);
    // **And the receiver, because the platform's methods are read reflectively** — the same reason
    // the messaging cases above assert it.
    expect(receivers).toHaveLength(1);
    expect(receivers[0]).toMatchObject({ query: expect.any(Function) });
  });

  it("takes the first tab carrying a usable id, and ignores one that carries none", async () => {
    // **A tab object is not a tab id.** `active` and `currentWindow` narrow the *answer*, and a
    // window with its active tab mid-close answers with an entry whose `id` is gone; taking the
    // first entry rather than the first *usable* one would address nothing at all.
    queryingPlatform([{ pendingUrl: "https://elsewhere.invalid" }, { id: 41 }, { id: 42 }]);

    await expect(findActiveTab()).resolves.toBe(41);
  });

  it.each([
    ["no platform at all", () => removePlatform()],
    ["a platform that is not an object", () => installPlatform("chrome")],
    ["a platform with no tabs", () => installPlatform({ runtime: { onMessage: {} } })],
    ["tabs with no query", () => installPlatform({ tabs: { sendMessage: vi.fn() } })],
    [
      "a query that is not callable",
      () => installPlatform({ tabs: { query: "query", sendMessage: vi.fn() } }),
    ],
    // **Both seams are required together, and this row is where the coupling is checked.** A `tabs`
    // with a query and no `sendMessage` cannot deliver anything, so reporting a tab id from it would
    // be naming a destination this module cannot reach.
    ["tabs that can query but not send", () => installPlatform({ tabs: { query: vi.fn() } })],
    ["a null tabs", () => installPlatform({ tabs: null })],
  ])("names no tab for %s", async (_label, install) => {
    install();

    await expect(findActiveTab()).resolves.toBeNull();
  });

  it.each([
    ["an empty answer", []],
    ["an answer that is not a list", { id: 41 }],
    ["an answer that is a string", "tabs"],
    ["a list of entries with no usable id", [{ active: true }, { id: "41" }, {}]],
    ["nothing at all", undefined],
    ["null", null],
  ])("names no tab for %s", async (_label, answer) => {
    queryingPlatform(answer);

    await expect(findActiveTab()).resolves.toBeNull();
  });

  /**
   * **The refusal, and it is the one this function must never grow a way around.**
   *
   * **No tab means no tab — not "the next one", and not "all of them".** `design.md` D1 measured
   * what sending to every tab id does: exactly one page answered, and that is not a delivery, it is
   * a coincidence. A fallback here would put a verification code into every page the user has open
   * that happens to have a qualifying field, and the assertion that would have caught it is this
   * one.
   */
  it("names no tab rather than falling back to another tab", async () => {
    // **Two tabs in the answer, and `findActiveTab` is handed neither** — a query answering empty
    // while other tabs exist is the shape a fallback would quietly widen.
    queryingPlatform([]);
    await expect(findActiveTab()).resolves.toBeNull();

    // **And the positive control beside it, so the refusal above is not satisfied by a reader that
    // never names a tab at all.** A reader that answered `null` for every query would pass every
    // refusal row in this file, which is the recorded failure of a narrowing function.
    queryingPlatform([{ id: 41 }]);
    await expect(findActiveTab()).resolves.toBe(41);
  });

  it("names no tab when the query throws rather than answering", async () => {
    installPlatform({
      tabs: {
        query: () => {
          throw new Error("Extension context invalidated.");
        },
        sendMessage: vi.fn(),
      },
    });

    // **The same real platform outcome the messaging seam handles**, and for the same reason: a
    // torn-down context throws from every extension API, and an exception escaping here would be
    // raised inside a popup the user is looking at.
    await expect(findActiveTab()).resolves.toBeNull();
  });
});

describe("sending a request to one named tab", () => {
  /** A platform whose `tabs.sendMessage` records every call and answers with `reply`. */
  function sendingPlatform(reply: unknown) {
    const sent: Array<{ receiver: unknown; tabId: unknown; request: unknown }> = [];
    const sendMessage = function (
      this: unknown,
      tabId: unknown,
      request: unknown,
      respond: (value: unknown) => void,
    ) {
      sent.push({ receiver: this, tabId, request });
      respond(reply);
    };

    installPlatform({ runtime: { onMessage: {} }, tabs: { query: vi.fn(), sendMessage } });

    return { sent };
  }

  it("sends to exactly the tab it was given, and resolves with what that page answered", async () => {
    // **The tab id is the assertion.** A send that reached every tab id would satisfy the first row
    // of this table and none of the rest of the product: `in-page-integration` requires that no
    // page the extension did not name be sent anything, and the *whole* of that claim is this list
    // having one entry carrying the id the caller named.
    const { sent } = sendingPlatform({ kind: "filled" });

    await expect(sendToTab(41, { kind: "spectre:fill-code", code: "493028" })).resolves.toEqual({
      kind: "filled",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.tabId).toBe(41);
    expect(sent[0]?.request).toEqual({ kind: "spectre:fill-code", code: "493028" });
    expect(sent[0]?.receiver).toMatchObject({ sendMessage: expect.any(Function) });
  });

  /**
   * **The request is sent verbatim, byte for byte.**
   *
   * A send that rebuilt the message from its parts would be free to add a field, and the content
   * script's narrower would admit it — so this case does not merely check that the code arrived, it
   * checks that nothing *else* did either.
   */
  it("carries the request through without adding or removing anything", async () => {
    const { sent } = sendingPlatform({ kind: "filled" });

    await sendToTab(41, { kind: "spectre:fill-code", code: "493028" });

    expect(sent[0]?.request).toEqual({ kind: "spectre:fill-code", code: "493028" });
    expect(Object.keys(sent[0]?.request as object)).toEqual(["kind", "code"]);
  });

  it("reads the platform's error channel inside the reply callback", async () => {
    // **The order is the whole assertion,** for the reason the messaging case above records: an
    // implementation that never read the channel inside the callback would pass a count-based check.
    const log: string[] = [];
    const runtime = {
      onMessage: {},
      sendMessage: vi.fn(),
      get lastError(): unknown {
        log.push("lastError");
        return { message: "Could not establish connection. Receiving end does not exist." };
      },
    };
    installPlatform({
      runtime,
      tabs: {
        query: vi.fn(),
        sendMessage(_tabId: unknown, _request: unknown, respond: (value: unknown) => void) {
          log.push("sendMessage");
          respond(undefined);
        },
      },
    });

    await expect(sendToTab(41, { kind: "spectre:fill-code", code: "1" })).resolves.toBeUndefined();

    expect(log).toEqual(["lastError", "sendMessage", "lastError"]);
  });

  it.each([
    ["no platform at all", () => removePlatform()],
    ["a platform with no tabs", () => installPlatform({ runtime: { onMessage: {} } })],
    ["tabs with no sendMessage", () => installPlatform({ tabs: { query: vi.fn() } })],
    [
      "a sendMessage that is not callable",
      () => installPlatform({ tabs: { query: vi.fn(), sendMessage: "send" } }),
    ],
  ])("resolves no answer for %s", async (_label, install) => {
    install();

    await expect(sendToTab(41, { kind: "spectre:fill-code", code: "1" })).resolves.toBeUndefined();
  });

  /**
   * **A tab id naming nothing answers with no answer, and is not the same fact as "no tab".**
   *
   * The platform answers `undefined` with `lastError` set when no content script is listening on
   * that tab, and this function reports that as **no answer** rather than inventing a refusal. Both
   * facts — a missing tab and an unanswered one — are the same thing as far as a *person* is
   * concerned: **the page has not confirmed that anything was filled.**
   */
  it("resolves no answer for a tab that names nothing, without inventing a refusal", async () => {
    sendingPlatform(undefined);

    const answer = await sendToTab(41, { kind: "spectre:fill-code", code: "493028" });

    expect(answer).toBeUndefined();
    // **Not a refusal the content script never wrote.** `noField` is the honest answer for a page
    // that looked and found nothing; inventing it here would be the extension reporting on a page
    // it never reached.
    expect(answer).not.toEqual({ kind: "noField" });
  });

  it("resolves no answer when the platform throws rather than answering", async () => {
    installPlatform({
      runtime: { onMessage: {} },
      tabs: {
        query: vi.fn(),
        sendMessage: () => {
          throw new Error("Extension context invalidated.");
        },
      },
    });

    await expect(sendToTab(41, { kind: "spectre:fill-code", code: "1" })).resolves.toBeUndefined();
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

    onExtensionMessage(handle);

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

    onExtensionMessage(() => Promise.reject(new Error("the store is gone")));

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

    const stop = onExtensionMessage(async () => undefined);
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

    const stop = onExtensionMessage(async () => ({ kind: "notActedOn" }));

    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
  });

  it("registers nothing where the platform's onMessage cannot add listeners", () => {
    installPlatform({ runtime: { onMessage: { addListener: "add" }, sendMessage: vi.fn() } });

    expect(() => onExtensionMessage(async () => undefined)).not.toThrow();
  });
});

describe("reading the notification platform", () => {
  /** A notifications member of exactly the given shape, on a platform that otherwise looks real. */
  function withNotifications(shape: unknown): void {
    installPlatform({ runtime: { sendMessage: vi.fn() }, notifications: shape });
  }

  it("returns the platform where it offers both members the seam names", () => {
    const clear = vi.fn(async () => true);
    withNotifications({ create: vi.fn(async () => "an id"), clear, onError: undefined });

    const platform = readNotificationPlatform();

    expect(platform).toBeDefined();
    // **The very object, not a wrapper.** A notification request is passed straight through, because
    // the platform's own `create` is the thing the measurement was taken against; wrapping it would
    // mean the measured shape and the used shape were two different shapes.
    expect(platform?.clear).toBe(clear);
  });

  it("reports no platform where this context has none", () => {
    // **The absence a real Chromium never demonstrates**, which is the reason this file exists at
    // all: a content script context has no notifications member, and asking must answer rather than
    // throw - a notification raised inside a listener that cannot listen is a fault nobody can catch.
    removePlatform();

    expect(readNotificationPlatform()).toBeUndefined();
  });

  it('reports no platform where it offers "create" alone', () => {
    // **Stricter than the product needs, and deliberately.** `create` is the only member anything
    // calls, so a check naming only that would pass on a platform that had lost `clear` - and the
    // whole reason for reading the platform reflectively is that the shape is checked *here*, at the
    // boundary, rather than discovered by a caller that expected a member and found nothing.
    withNotifications({ create: vi.fn(async () => "an id") });

    expect(readNotificationPlatform()).toBeUndefined();
  });

  it("reports no platform where a member is not callable", () => {
    // **The narrow form of the same claim, in the other direction: a member present but not a
    // function is not a member.** A platform whose `clear` is a string satisfies a "is it defined"
    // reading, and the seam would hand a caller a value it cannot call.
    withNotifications({ create: "create", clear: vi.fn(async () => true) });

    expect(readNotificationPlatform()).toBeUndefined();
  });
});

describe("resolving the address of a file this extension ships", () => {
  it("asks the runtime for that exact file and returns what it answers", () => {
    const seen: string[] = [];
    installPlatform({
      runtime: {
        getURL(file: string) {
          // **The receiver is checked here, not by the test**, because a reflective read of a method
          // invites detaching it: a detached `getURL` sees `this` as `undefined` and the file name
          // as its first argument, which on some platforms throws and on others answers with a URL
          // relative to nothing. This is the same trap `sendToTab` records.
          if (this === undefined) {
            throw new Error("detached");
          }
          seen.push(file);
          return `chrome-extension://measured/${file}`;
        },
      },
    });

    expect(extensionAssetUrl("icon.png")).toBe("chrome-extension://measured/icon.png");
    expect(seen).toEqual(["icon.png"]);
  });

  it("names no address where the runtime offers no way to build one", () => {
    installPlatform({ runtime: { sendMessage: vi.fn() } });

    expect(extensionAssetUrl("icon.png")).toBeUndefined();
  });

  it("names no address where the runtime refuses the file", () => {
    // **A thrown `getURL` is absence, not a fault.** This runs inside a notification request, and a
    // worker that raised here would answer nothing at all - losing the refusal the product would
    // otherwise report, which is the same information a `null` from `create` carries.
    installPlatform({
      runtime: {
        getURL: () => {
          throw new Error("no such file");
        },
      },
    });

    expect(extensionAssetUrl("icon.png")).toBeUndefined();
  });

  it("names no address where the runtime answers with something that is not a URL", () => {
    // **A value of the wrong type is absence too**, because a caller would otherwise put it in an
    // `iconUrl` the platform then refuses - and the refusal would be recorded against the product
    // rather than against the platform that answered wrongly.
    installPlatform({ runtime: { getURL: () => 42 } });

    expect(extensionAssetUrl("icon.png")).toBeUndefined();
  });
});

describe("reading the alarm platform", () => {
  it("passes the name and the schedule through, called on the platform's own member", async () => {
    const asks: Array<{ name: string; schedule: unknown }> = [];
    const alarms = {
      create(name: string, schedule: unknown) {
        // **The receiver, asserted from inside the member rather than from outside it.** A detached
        // call is invisible on a platform that ignores `this` and fatal on one that reads a private
        // field, so the case checks it at the point where detaching would show.
        if (this !== alarms) {
          throw new Error("detached");
        }
        asks.push({ name, schedule });
      },
      clear: async () => true,
    };
    installPlatform({ alarms });

    const platform = readAlarmPlatform();
    await platform?.create("spectre:inbox", { periodInMinutes: 5 });

    expect(asks).toEqual([{ name: "spectre:inbox", schedule: { periodInMinutes: 5 } }]);
  });

  it("resolves rather than rejecting where the platform refuses to schedule", async () => {
    installPlatform({
      alarms: {
        create: () => {
          throw new Error("quota");
        },
        clear: async () => true,
      },
    });

    const platform = readAlarmPlatform();

    // **The throw is swallowed, and the reason is stated beside it: an alarm this platform refused is
    // a check this device is not running, and the only listener that could report it is the timer
    // that never fired.** So there is no channel to report through, and a rejection here would
    // escape into the worker as an unhandled rejection.
    await expect(
      platform?.create("spectre:inbox", { periodInMinutes: 5 }),
    ).resolves.toBeUndefined();
  });

  it('answers whether there was an alarm, and answers "no" for every non-true answer', async () => {
    // **Three answers in a row through one reader**, because `clear` decides whether an alarm needs
    // clearing at all, and a platform answering `undefined` must not read as "there was one". Each
    // iteration reinstalls the platform rather than reusing it, so a reader that cached the platform
    // on first use would be caught by the second.
    const answers: Array<() => Promise<unknown>> = [
      async () => true,
      async () => false,
      async () => undefined,
    ];

    for (const answer of answers) {
      installPlatform({ alarms: { create: async () => {}, clear: answer } });
      const expected = await answer();
      await expect(readAlarmPlatform()?.clear("spectre:inbox")).resolves.toBe(expected === true);
    }

    installPlatform({
      alarms: {
        create: async () => {},
        clear: () => {
          throw new Error("gone");
        },
      },
    });
    await expect(readAlarmPlatform()?.clear("spectre:inbox")).resolves.toBe(false);
  });

  it("reports no platform where either member is missing", () => {
    // **Both directions, because "either" is only a claim if both halves are exercised** - and a
    // check demanding only `create` would pass the second and the third of these, which is why they
    // are here rather than the first case alone.
    installPlatform({ alarms: { clear: async () => true } });
    expect(readAlarmPlatform()).toBeUndefined();

    installPlatform({ alarms: { create: async () => {} } });
    expect(readAlarmPlatform()).toBeUndefined();

    installPlatform({ alarms: { create: "create", clear: async () => true } });
    expect(readAlarmPlatform()).toBeUndefined();
  });

  it("reports no platform where this context has none", () => {
    removePlatform();

    expect(readAlarmPlatform()).toBeUndefined();
  });
});

describe("listening for the platform's own events", () => {
  /** A platform whose two events record what was registered, so a listener can be driven. */
  function listeningPlatform() {
    const started: Array<() => void> = [];
    const fired: Array<(alarm: unknown) => void> = [];
    const removed: unknown[] = [];

    installPlatform({
      runtime: {
        onStartup: {
          addListener(listener: () => void) {
            started.push(listener);
          },
          removeListener(listener: unknown) {
            removed.push(listener);
          },
        },
      },
      alarms: {
        onAlarm: {
          addListener(listener: (alarm: unknown) => void) {
            fired.push(listener);
          },
          removeListener(listener: unknown) {
            removed.push(listener);
          },
        },
      },
    });

    return { started, fired, removed };
  }

  it("runs the handler when the browser starts, and stops when the teardown is called", () => {
    const { started, removed } = listeningPlatform();
    const handle = vi.fn();

    const stop = onBrowserStart(handle);

    expect(started).toHaveLength(1);
    started[0]?.();
    // **No payload, because the platform sends none.** A handler declaring an argument here would be
    // accepting a fact the platform does not offer, and the type is what stops it.
    expect(handle).toHaveBeenCalledWith();

    stop();
    expect(removed).toEqual(started);
    expect(() => stop()).not.toThrow();
  });

  it("passes every alarm name through, and never filters one", () => {
    const { fired } = listeningPlatform();
    const seen: string[] = [];

    onAlarmFired((name) => {
      seen.push(name);
    });

    fired[0]?.({ name: "spectre:inbox" });
    // **A name this extension did not create reaches the handler, and that is the design.** "Exactly
    // one alarm" is a property of what this code *creates*, and a filter here would make it
    // unfalsifiable: a second alarm would simply never arrive, so the suite could not catch one and
    // the claim would be a claim about a listener rather than about the product.
    fired[0]?.({ name: "something-else" });

    expect(seen).toEqual(["spectre:inbox", "something-else"]);
  });

  it("ignores a fired alarm this extension cannot name", () => {
    const { fired } = listeningPlatform();
    const handle = vi.fn();

    onAlarmFired(handle);
    fired[0]?.({ periodInMinutes: 5 });
    fired[0]?.({ name: 42 });

    expect(handle).not.toHaveBeenCalled();
  });

  it("returns an inert teardown where the platform offers no such event", () => {
    // **Two absences, both of which happen in a real context.** `runtime.onStartup` exists in the
    // worker and in the popup; `alarms.onAlarm` exists in the worker. Asking in the wrong one must
    // answer with a teardown rather than throw, or evaluating this module in a context that cannot
    // listen would take the whole page down.
    installPlatform({ runtime: {}, alarms: { onAlarm: { addListener: "add" } } });

    expect(() => onBrowserStart(() => {})()).not.toThrow();
    expect(() => onAlarmFired(() => {})()).not.toThrow();

    removePlatform();
    expect(() => onBrowserStart(() => {})()).not.toThrow();
    expect(() => onAlarmFired(() => {})()).not.toThrow();
  });
});
