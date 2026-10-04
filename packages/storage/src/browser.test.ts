/**
 * The browser-facing storage entry point.
 *
 * ## Why `fake-indexeddb` is set on the global here and nowhere else
 *
 * `createBrowserStorage` reads `globalThis.indexedDB`, so exercising it means putting
 * something there. `fake-indexeddb` is the substrate — and it is **not a browser**.
 * It implements the API's shapes well enough that a transaction resolves and a record
 * round-trips; it proves nothing about how a real engine persists, how much it
 * persists before evicting, or what it does when a user's disk is full. Every test
 * here is a test of this repository's logic, and the module note in `browser.ts` is
 * explicit that this layer cannot tell a real browser from this.
 *
 * The global is installed and removed around each test rather than at module scope, so
 * a test that must observe an *absent* platform can — which is the case the entry point
 * exists to handle correctly and the one a permanent global would make unreachable.
 *
 * @module
 */

import { createMailbox } from "@spectre-mail/core";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { createBrowserStorage } from "./browser";
import type { SpectreStorage } from "./contract";
import { createIndexedDbStorage, CURRENT_MAILBOX_KEY } from "./indexeddb";

/**
 * A mailbox built by the model's own constructor, not by hand.
 *
 * **`createMailbox`, not an object literal.** The first draft of this file wrote the
 * shape out — including `provider` — and `saveMailbox` refused it, because the model
 * derives `provider` from `credentials` and a hand-written one is not a mailbox the
 * model recognises. That refusal is the storage contract working: `saveMailbox`
 * narrows what it is given rather than storing whatever arrives. Building it the way
 * the model builds it is also what makes these tests agree with what a real session
 * hands the session.
 */
const A_MAILBOX = createMailbox({
  id: "session-token",
  address: "stored@mail.example",
  createdAt: Date.UTC(2026, 9, 2, 12, 0, 0),
  credentials: { provider: "guerrilla", sessionId: "session-token" },
});

const GLOBAL_KEY = "indexedDB";

/** Install a fake IndexedDB on the global, and report how to take it away again. */
function withPlatform(): () => void {
  const had = Object.getOwnPropertyDescriptor(globalThis, GLOBAL_KEY);
  Object.defineProperty(globalThis, GLOBAL_KEY, {
    value: new IDBFactory(),
    configurable: true,
    writable: true,
  });
  return () => {
    if (had === undefined) {
      Reflect.deleteProperty(globalThis, GLOBAL_KEY);
      return;
    }
    Object.defineProperty(globalThis, GLOBAL_KEY, had);
  };
}

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("createBrowserStorage", () => {
  it("returns a working storage without the caller naming a platform API", async () => {
    // **The positive control, and it is a control rather than a formality.** A test
    // asserting only that the function returns would pass against an implementation
    // that returned an object storing nothing — the failure `contract.ts`'s `null`
    // rule exists to prevent, one layer up. So this writes and reads a real record.
    restore = withPlatform();
    const storage: SpectreStorage = createBrowserStorage();

    expect(await storage.loadMailbox()).toBeNull();
    await storage.saveMailbox(A_MAILBOX);
    expect(await storage.loadMailbox()).toEqual(A_MAILBOX);
  });

  it("shares one database across two constructions over the same platform", async () => {
    // **This is the property that makes reload recovery possible, asserted directly.**
    // Two storage objects built from the same environment see the same record — which
    // is exactly what happens when a page reloads and rebuilds everything.
    restore = withPlatform();
    const first = createBrowserStorage();
    await first.saveMailbox(A_MAILBOX);

    const second = createBrowserStorage();
    expect(await second.loadMailbox()).toEqual(A_MAILBOX);
  });

  it("keeps nothing in this process, so a reload is what makes a record exist", async () => {
    // **The negative of the test above, and it is the one that could pass for the
    // wrong reason.** If `createBrowserStorage` kept the mailbox in a module-level
    // variable, the "shares across constructions" test above would pass while nothing
    // had been written to the platform at all — and a real reload, which starts a new
    // process and a new engine, would find nothing. A brand-new `IDBFactory` is what a
    // fresh process looks like, so this is the closest a test can get to it.
    restore = withPlatform();
    const first = createBrowserStorage();
    await first.saveMailbox(A_MAILBOX);

    // A different platform entirely — a different engine, as a different browser would
    // be.
    Object.defineProperty(globalThis, GLOBAL_KEY, {
      value: new IDBFactory(),
      configurable: true,
    });
    expect(await createBrowserStorage().loadMailbox()).toBeNull();
  });

  it("reports that storage is unavailable rather than storing nothing", async () => {
    // **The case a global default would have made untestable, and the reason this
    // module exists as a separate export.** The global test environment is `"node"`,
    // so with nothing installed `globalThis.indexedDB` is genuinely absent — which is
    // the situation a client on a platform without IndexedDB would be in.
    //
    // The alternative under test is an implementation returning a storage that keeps
    // nothing. That implementation satisfies "does not throw" and fails here, and it is
    // the one that makes a client report *"nothing is saved on this device"* on a
    // device where saving is unavailable.
    restore = withPlatform();
    Object.defineProperty(globalThis, GLOBAL_KEY, { value: undefined, configurable: true });

    let thrown: unknown;
    try {
      createBrowserStorage();
    } catch (cause) {
      thrown = cause;
    }

    expect(thrown).toBeInstanceOf(Error);
    // **The message has to say what is wrong**, because this is what a user or a
    // maintainer will read. An exception whose text is "undefined is not an object"
    // names a symptom three layers below the decision.
    expect((thrown as Error).message).toContain("IndexedDB");
    expect((thrown as Error).message).toContain("nothing is saved on this device");
  });

  it("treats a null platform the same as an absent one", () => {
    // **Both spellings of "not here", and only one of them is natural to write.** A
    // platform that explicitly provides `null` is not a thing that occurs in a browser,
    // but a shim or a test double can produce it, and `null` slipping past an
    // `=== undefined` check turns into an `IDBFactory` that is `null` and a failure
    // several frames later.
    restore = withPlatform();
    Object.defineProperty(globalThis, GLOBAL_KEY, { value: null, configurable: true });
    expect(() => createBrowserStorage()).toThrow(/IndexedDB/);
  });

  it("still requires an injected factory from the adapter it is built on", async () => {
    // **The no-global-default rule, asserted rather than left as a comment.** A later
    // reader relaxing `createIndexedDbStorage` to default its factory would otherwise
    // change nothing measurable: every existing test injects one, so the default would
    // simply never be taken.
    //
    // **What is exercised is the adapter with the global *absent*.** If the adapter
    // reached for `globalThis.indexedDB` when its option were missing, this is the
    // test that notices — because at the point the storage is built there is no global
    // to reach for, and the injected factory is the only source it has.
    restore = withPlatform();
    Object.defineProperty(globalThis, GLOBAL_KEY, { value: undefined, configurable: true });

    const injected = createIndexedDbStorage({
      // **Handed a factory directly rather than read off the global**, which is the
      // whole difference: with the global undefined, reading it would yield
      // `undefined` and the type would not stop it.
      indexedDB: new IDBFactory(),
      databaseName: "spectre-mail-injected",
      storeName: "mailbox",
    });

    // **And it works**, so the assertion is not merely "did not throw".
    await injected.saveMailbox(A_MAILBOX);
    expect(await injected.loadMailbox()).toEqual(A_MAILBOX);
    // **While the browser entry point, at the same moment, refuses.** Same absent
    // global, opposite answers, and the difference is which one was handed its
    // implementation.
    expect(() => createBrowserStorage()).toThrow(/IndexedDB/);
    expect(CURRENT_MAILBOX_KEY).toBe("current");
  });
});

/**
 * ## Why there is no test here that scans for the platform global
 *
 * There was one, and it was removed rather than fixed. It read this package's sources
 * and asserted that `Reflect.get(globalThis, "indexedDB")` appeared exactly once,
 * which is `browser.ts` naming it and nothing else.
 *
 * **It failed**, because `indexeddb.test.ts` also names it — legitimately, since that
 * test drives the injected adapter with a global it installed itself. Narrowing the
 * scan to non-test sources would have made it pass, and that is the defect rather than
 * the fix: a check scoped more narrowly than the rule it claims to enforce is the
 * nineteenth instance of exactly that in this repository, and this one would have been
 * authored and shipped in the same change.
 *
 * A duplicate of a real check, scoped more narrowly, is worth less than no check. The
 * boundary itself is enforced once, in `tests/architecture/boundaries.test.ts`, by a
 * rule that scans every package **and every app**, reports violations by name, and
 * plants a probe in each package it must scan. That rule is where this belongs, and
 * this module's reason for existing is recorded in `browser.ts` where a reader of the
 * entry point will actually find it.
 */
