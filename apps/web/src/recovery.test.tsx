/**
 * What the website does with a mailbox this device already has.
 *
 * ## Why this is a separate file and not more of `App.test.tsx`
 *
 * Because every assertion here is about the **boot**, and the boot happens before
 * anything `App.test.tsx` describes has begun. `App.test.tsx` renders the page and
 * asks what it says; this file asks what it *did* — whether it read before it asked,
 * whether it asked twice, and what it wrote. Those are claims about order and count,
 * and a page whose states are all correct can still get every one of them wrong.
 *
 * ## What is asserted here and what is not
 *
 * Every assertion runs against a **stub provider over a stub storage**, so nothing
 * here has ever contacted Guerrilla Mail and nothing here has run in a browser. The
 * `createBrowserStorage` path in particular is *not* exercised by this file: `jsdom`
 * implements no IndexedDB, so the only way to test the real adapter from here would
 * be to substitute `fake-indexeddb`, and a fake is not a browser. That gap is stated
 * rather than papered over — `packages/storage/src/indexeddb.test.ts` is where the
 * adapter is checked, and neither of those two facts is a claim about a user's device.
 *
 * @module
 */

// @vitest-environment jsdom

import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, SpectreError } from "@spectre-mail/core";
import { createMailboxSession } from "@spectre-mail/mailbox";
import type { MailboxScheduler } from "@spectre-mail/mailbox";
import { createProviderManager } from "@spectre-mail/providers";
import type { MailProvider } from "@spectre-mail/providers";
import type { SpectreStorage } from "@spectre-mail/storage";

import { App } from "./App";
import { applyJsdomSuiteBudget } from "./jsdom-suite-budget";
import { createWebsiteStorage, useWebsiteStorage } from "./storage";
import type { WebsiteStorage } from "./storage";
import { EMPTY_STORE, stubStore } from "./storage-stub";
import { useMailboxSession } from "./useMailboxSession";

applyJsdomSuiteBudget();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A mailbox at a reserved `.example` domain, so no test address is ever real. */
function mailbox(id: string): Mailbox {
  return {
    id,
    provider: "guerrilla",
    address: `${id}@mail.example`,
    createdAt: Date.parse("2026-10-05T12:00:00.000Z"),
    status: "active",
    credentials: { provider: "guerrilla", sessionId: `session-${id}` },
  };
}

/**
 * A provider that records every call it receives.
 *
 * **The counters are the point of this file.** "The page says the right thing" cannot
 * distinguish a page that asked the provider twice from one that asked once, and a
 * duplicate create against a rate-limited provider is exactly the failure the
 * StrictMode guard exists to prevent — so the claims below are about counts.
 */
function countingProvider(
  over: {
    mailbox?: Mailbox;
    createMailbox?: () => Promise<Mailbox>;
    listMessages?: () => Promise<never[]>;
  } = {},
): MailProvider & { readonly creates: () => number; readonly lists: () => number } {
  let creates = 0;
  let lists = 0;

  return {
    id: "guerrilla",
    displayName: "Guerrilla Mail",
    supports: () => false,
    checkHealth: () => Promise.resolve({ provider: "guerrilla", status: "ok" }),
    createMailbox: () => {
      creates += 1;
      return over.createMailbox
        ? over.createMailbox()
        : Promise.resolve(over.mailbox ?? mailbox("guerrilla-1"));
    },
    listMessages: () => {
      lists += 1;
      return over.listMessages ? over.listMessages() : Promise.resolve([]);
    },
    getMessage: () => Promise.reject(new Error("unused")),
    creates: () => creates,
    lists: () => lists,
  };
}

/**
 * A scheduler that records what it was asked for and runs nothing.
 *
 * The same reasoning as `App.test.tsx`'s: a real timer would leave the page polling
 * after the assertion finished, and the only symptom would be a provider call arriving
 * at an unrelated moment.
 */
function inertScheduler(): MailboxScheduler {
  return {
    schedule: () => () => undefined,
  };
}

function sessionOver(provider: MailProvider) {
  return createMailboxSession(createProviderManager([provider]), inertScheduler());
}

/** Every character of visible text on the page. */
function visibleText(): string {
  return document.body.textContent ?? "";
}

describe("the website's own storage", () => {
  it("builds the storage once for the life of the page", () => {
    // **Object identity, not a read count.** The hazard is a factory called in the
    // component body: a new storage per render would be a new dependency for the
    // boot, and would re-read the store each time. Counting `loadMailbox` would not
    // catch it, because the boot is guarded and would read only once regardless — the
    // waste would be invisible. Two renders and the same object is the claim.
    let constructions = 0;
    const working: SpectreStorage = {
      loadMailbox: () => Promise.resolve(null),
      saveMailbox: () => Promise.resolve(),
      // **These doubles answer everything, including removal.** A double that omitted
      // it would not compile once `clearAll` joined the contract, and the compiler
      // catching that is the point — but had it not, a double that "worked" while
      // storing nothing is precisely the fixture this repository distrusts.
      clearAll: () => Promise.resolve(),
    };

    const { result, rerender } = renderHook(
      ({ build }: { readonly build: () => SpectreStorage }) => useWebsiteStorage(build),
      { initialProps: { build: () => ((constructions += 1), working) } },
    );

    const first = result.current;
    expect(first.kind).toBe("ready");
    expect(constructions).toBe(1);

    rerender({ build: () => ((constructions += 1), working) });
    rerender({ build: () => ((constructions += 1), working) });

    expect(constructions).toBe(1);
    expect(result.current).toBe(first);
  });

  it("asks about what is stored before it asks the provider for a mailbox", async () => {
    // **The ordering claim, which nothing else here establishes.** The page reads its
    // storage first and only then decides whether to create. A page that created
    // eagerly and read afterwards would pass every state assertion in `App.test.tsx`
    // and still destroy the address the user came back for, because the create would
    // save over the record.
    let release: (stored: Mailbox | null) => void = () => undefined;
    const read = new Promise<Mailbox | null>((resolve) => {
      release = resolve;
    });

    const provider = countingProvider();
    const storage: SpectreStorage = {
      loadMailbox: () => read,
      saveMailbox: () => Promise.resolve(),
      // **These doubles answer everything, including removal.** A double that omitted
      // it would not compile once `clearAll` joined the contract, and the compiler
      // catching that is the point — but had it not, a double that "worked" while
      // storing nothing is precisely the fixture this repository distrusts.
      clearAll: () => Promise.resolve(),
    };

    render(<App session={sessionOver(provider)} storage={{ kind: "ready", storage }} />);

    // While the read is out: no create, and the page says what it is doing.
    expect(provider.creates()).toBe(0);
    expect(screen.getByTestId("idle")).toBeTruthy();
    expect(visibleText()).toContain("Checking what this device has stored.");

    await act(async () => {
      release(null);
      await read;
    });

    await screen.findByTestId("ready");
    // **The positive half.** Without this the assertions above would also hold for a
    // page that never read at all and simply showed "checking" forever.
    expect(provider.creates()).toBe(1);
  });

  it("stores the mailbox it created, and offers the same address again", async () => {
    const store = stubStore();
    const provider = countingProvider({ mailbox: mailbox("guerrilla-1") });

    render(<App session={sessionOver(provider)} storage={store.storage} />);
    await screen.findByTestId("ready");

    // **What was written is asserted, not only that something was.** A page that
    // stored a different mailbox than it displayed would satisfy a count.
    await vi.waitFor(() => {
      expect(store.saves).toHaveLength(1);
    });
    expect(store.saves[0]?.address).toBe("guerrilla-1@mail.example");
    expect(visibleText()).toContain("guerrilla-1@mail.example");
  });

  it("does not write the mailbox it was handed", async () => {
    // **The save rule's exclusion.** Adoption found the record already on the device
    // and confirmed it; writing it back would be a no-op whose only purpose is to make
    // a bug elsewhere look correct. `App.test.tsx` cannot see this — it passes the same
    // empty store to every test and none of them adopts.
    const store = stubStore({ stored: mailbox("stored-1") });
    const provider = countingProvider();

    render(<App session={sessionOver(provider)} storage={store.storage} />);
    await screen.findByTestId("ready");

    expect(visibleText()).toContain("stored-1@mail.example");
    // **And the listing happened**, so the adoption really did reconcile rather than
    // failing quietly and being reported as ready.
    expect(provider.lists()).toBeGreaterThan(0);
    // Give any stray write a chance to land before claiming there was none. A missing
    // `await` here would make this test pass for a page that does save.
    await act(async () => {
      await Promise.resolve();
    });
    expect(store.saves).toEqual([]);
  });

  it("writes the new mailbox when the address is replaced", async () => {
    // **The positive control for the test above.** If replacing did not write, the
    // previous test's silence would be indistinguishable from the save rule simply
    // being absent.
    const store = stubStore({ stored: mailbox("stored-1") });
    const provider = countingProvider({ mailbox: mailbox("guerrilla-2") });

    render(<App session={sessionOver(provider)} storage={store.storage} />);
    await screen.findByTestId("ready");
    expect(visibleText()).toContain("stored-1@mail.example");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /replace address/i }));
    });
    await screen.findByTestId("ready");

    await vi.waitFor(() => {
      expect(store.saves).toHaveLength(1);
    });
    expect(store.saves[0]?.address).toBe("guerrilla-2@mail.example");
  });

  it("reads once and creates once when React mounts the page twice", async () => {
    // **StrictMode.** Development remounts the same component with the same session
    // instance, so without a guard the boot would run twice: two reads, and — since
    // both would find nothing — two creates, one of which would be thrown away against
    // a provider that rate-limits account creation.
    const store = stubStore();
    const provider = countingProvider();

    render(
      <StrictMode>
        <App session={sessionOver(provider)} storage={store.storage} />
      </StrictMode>,
    );
    await screen.findByTestId("ready");

    expect(store.loadCount()).toBe(1);
    expect(provider.creates()).toBe(1);
  });

  it("says it could not check, and creates nothing, when the read fails", async () => {
    // **The half of `spectre-storage`'s contract that only a client can get wrong.**
    // `loadMailbox` rejects rather than returning `null` precisely so that this page
    // cannot mistake "I could not look" for "there is nothing there". The failure that
    // this test exists to catch is catching that rejection and passing `null` on.
    const store = stubStore({ loadThrows: new Error("the database is not readable") });
    const provider = countingProvider();

    render(<App session={sessionOver(provider)} storage={store.storage} />);
    await screen.findByTestId("boot-failure-reason");

    expect(visibleText()).toContain("the database is not readable");
    // **No mailbox, and no request.** Either one alone would be survivable; together
    // they are the data loss.
    expect(provider.creates()).toBe(0);
    expect(screen.queryByTestId("ready")).toBeNull();
    // **And nothing else from the session is rendered.** A page that showed the
    // refusal *and* "looking for a saved address" at the same time would be telling
    // the user two contradictory things, and the gate that prevents it is the one the
    // other half of this suite's mutations target. The session really is `idle` here,
    // so the absence is the gate's doing and not an accident of the state.
    expect(screen.queryByTestId("idle")).toBeNull();
    expect(visibleText()).not.toContain("@");
    // And it must not have claimed to have found nothing stored.
    expect(visibleText()).not.toMatch(/nothing (is |has been )?stored/i);
  });

  it("says it could not check, and creates nothing, when the browser cannot store", async () => {
    // **The other answer to the same question.** `createBrowserStorage` throws where
    // the platform has no IndexedDB, which happens in private modes and under some
    // fingerprinting settings. `createWebsiteStorage` turns that into a value, so this
    // is what the page sees.
    const provider = countingProvider();

    render(
      <App
        session={sessionOver(provider)}
        storage={createWebsiteStorage(() => {
          throw new Error("this browser has no IndexedDB");
        })}
      />,
    );
    await screen.findByTestId("boot-failure-reason");

    expect(visibleText()).toContain("this browser has no IndexedDB");
    expect(provider.creates()).toBe(0);
    expect(visibleText()).not.toContain("@");
  });

  it("keeps a ready store when there is no platform to build one from", () => {
    // **The positive control for the test above**, and it exercises the real factory
    // rather than a fixture: a `SpectreStorage` that works must survive the catch that
    // exists for one that does not.
    const working: SpectreStorage = {
      loadMailbox: () => Promise.resolve(null),
      saveMailbox: () => Promise.resolve(),
      // **These doubles answer everything, including removal.** A double that omitted
      // it would not compile once `clearAll` joined the contract, and the compiler
      // catching that is the point — but had it not, a double that "worked" while
      // storing nothing is precisely the fixture this repository distrusts.
      clearAll: () => Promise.resolve(),
    };

    const result = createWebsiteStorage(() => working);

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw new Error("expected a working store");
    expect(result.storage).toBe(working);
  });

  it("stops claiming it cannot check once a retry is under way", async () => {
    // **The regression this caught, and the first version of this test did not catch
    // it** — it asserted only the state *after* the retry landed, which the original
    // bug also reached. So the second attempt is held open and the page is inspected
    // while the read is still out, which is the only moment the claim is about.
    //
    // `retryBoot` originally left the boot at `blocked`, so the page kept rendering the
    // refusal for the whole of a second attempt and only swapped to the real answer
    // when the read resolved. A user who clicked *Check again* and saw the same refusal
    // would conclude the retry had not been tried.
    let failing = true;
    let release: (stored: Mailbox | null) => void = () => undefined;
    const retry = new Promise<Mailbox | null>((resolve) => {
      release = resolve;
    });
    const storage: SpectreStorage = {
      loadMailbox: () =>
        failing ? Promise.reject(new Error("still not readable")) : retry.then((stored) => stored),
      saveMailbox: () => Promise.resolve(),
      // **These doubles answer everything, including removal.** A double that omitted
      // it would not compile once `clearAll` joined the contract, and the compiler
      // catching that is the point — but had it not, a double that "worked" while
      // storing nothing is precisely the fixture this repository distrusts.
      clearAll: () => Promise.resolve(),
    };
    const provider = countingProvider();

    render(<App session={sessionOver(provider)} storage={{ kind: "ready", storage }} />);
    await screen.findByTestId("boot-failure-reason");

    failing = false;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /check again/i }));
    });

    // **During** the second attempt: the refusal is gone rather than supplemented,
    // and the page says what it is doing.
    expect(screen.queryByTestId("boot-failure-reason")).toBeNull();
    expect(screen.getByTestId("idle")).toBeTruthy();
    expect(visibleText()).toContain("Checking what this device has stored.");

    await act(async () => {
      release(null);
      await retry;
    });

    // And the attempt really did finish.
    await screen.findByTestId("ready");
    expect(provider.creates()).toBe(1);
  });

  it("says when the mailbox it holds could not be stored", async () => {
    const store = stubStore({ saveThrows: new Error("the disk is full") });

    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");
    await screen.findByTestId("save-failed");

    // **The claim being made and the claim being withheld, both asserted.** A page that
    // only said "could not be saved" leaves a user believing the next reload will bring
    // the address back; that is the belief this line exists to correct.
    expect(visibleText()).toContain("a reload will not bring it back");
    expect(visibleText()).toContain("the disk is full");
    // The address itself is still shown, because it is real and usable right now.
    expect(visibleText()).toContain("guerrilla-1@mail.example");
  });

  it("does not say a failed write is a problem when the write succeeded", async () => {
    // **The negative control for the line above.** A page that always rendered the
    // warning would satisfy it perfectly.
    render(<App session={sessionOver(countingProvider())} storage={EMPTY_STORE} />);
    await screen.findByTestId("ready");

    expect(screen.queryByTestId("save-failed")).toBeNull();
  });
});

/**
 * What this device holds, which is a third thing beside `boot` and `saving`.
 *
 * **`localData` is tested here rather than through the page**, because the page's
 * assertions about it are in the removal block below and would be satisfied by copy
 * alone. This is the state itself: the two derivations that look obvious and are both
 * wrong.
 *
 * **Every test here hoists its session out of the `renderHook` callback, and that is
 * not tidiness — it is the difference between passing and exhausting the heap.** A
 * session built inside the callback is a *new* object on every render; the boot effect
 * and the subscription both depend on it, so each render re-runs the boot, which sets
 * state, which renders again. The first version of these tests did exactly that and
 * ran until Node died with `JavaScript heap out of memory` rather than failing with a
 * useful message.
 */
describe("whether this device holds the record", () => {
  it("claims nothing before the boot has read anything", () => {
    // **`none` is the honest pre-answer**, and it is why the page offers no removal
    // during a read. Asserted directly because "the control is not there yet" is a
    // weaker thing to check than "the state does not claim a record exists".
    const session = sessionOver(countingProvider());
    const { result } = renderHook(() => useMailboxSession(session, EMPTY_STORE));

    expect(result.current.localData).toEqual({ kind: "none" });
  });

  it("claims a record once a boot read has found one", async () => {
    const store = stubStore({ stored: mailbox("stored-one") });
    const session = sessionOver(countingProvider());

    const { result } = renderHook(() => useMailboxSession(session, store.storage));

    await waitFor(() => expect(result.current.boot.kind).toBe("started"));
    expect(result.current.localData).toEqual({ kind: "stored" });
  });

  it("claims a record once a write has been confirmed", async () => {
    // **The positive control for the test below**, in the same file. Without it, "a
    // refused write leaves `none`" would also be satisfied by a `localData` that never
    // becomes `stored` for any reason at all.
    const store = stubStore();
    const session = sessionOver(countingProvider());
    const { result } = renderHook(() => useMailboxSession(session, store.storage));

    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    await waitFor(() => expect(result.current.localData).toEqual({ kind: "stored" }));
  });

  it("claims no record when the write was refused", async () => {
    // **The reason `localData` is not derived from `handed`.** `handed.current` is
    // claimed *before* the write is awaited, so deriving from it would report a record
    // this device does not have — and would offer the user a removal for something that
    // was never stored.
    const store = stubStore({ saveThrows: new Error("the disk is full") });
    const session = sessionOver(countingProvider());
    const { result } = renderHook(() => useMailboxSession(session, store.storage));

    await waitFor(() => expect(result.current.saving.kind).toBe("notSaved"));
    // Both halves at once: the write failed, **and** nothing is claimed to be stored.
    // Asserting only the first would pass against a page that both failed to write and
    // claimed a record anyway.
    expect(result.current.saving).toEqual({ kind: "notSaved", reason: "the disk is full" });
    expect(result.current.localData).toEqual({ kind: "none" });
  });

  it("hands a refused removal to the caller instead of swallowing it", async () => {
    // **A page that swallowed this would have to report the removal as having worked.**
    // That is the one outcome a privacy control may not produce, and it is only
    // prevented by the rejection reaching the caller intact.
    const store = stubStore({
      stored: mailbox("stored-one"),
      clearThrows: new Error("another connection is holding it open"),
    });
    const session = sessionOver(countingProvider());
    const { result } = renderHook(() => useMailboxSession(session, store.storage));
    await waitFor(() => expect(result.current.boot.kind).toBe("started"));

    let thrown: unknown = "nothing was thrown";
    await result.current.clearStored().catch((cause: unknown) => {
      thrown = cause;
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("another connection is holding it open");
    // **And nothing was claimed on the strength of a removal that did not happen.**
    expect(result.current.localData).toEqual({ kind: "stored" });
  });

  it("claims no record once a removal has succeeded", async () => {
    const store = stubStore({ stored: mailbox("stored-one") });
    const session = sessionOver(countingProvider());
    const { result } = renderHook(() => useMailboxSession(session, store.storage));
    await waitFor(() => expect(result.current.boot.kind).toBe("started"));

    await act(async () => {
      await result.current.clearStored();
    });

    expect(store.clearCount()).toBe(1);
    expect(result.current.localData).toEqual({ kind: "none" });
  });
});

/**
 * The page offering to forget, and saying so honestly.
 *
 * ## Why the negatives are asserted on which branch rendered
 *
 * Two of the claims here are about what the page must **not** say — that a refused
 * removal is not described as having happened, and that a store holding nothing is not
 * offered a removal. Matching those on copy would be brittle in the worst direction: a
 * reworded sentence could satisfy the regex while the claim stayed wrong.
 *
 * So those assertions are on **the branch**. The component has one shape per situation,
 * a refusal can only produce the refusal shape, and a store holding nothing can only
 * produce the empty one. An assertion about the shape is an assertion about the claim,
 * and it survives the copy being improved.
 *
 * ## Everything here runs against a stub provider and a stub storage
 *
 * Nothing in this block has contacted Guerrilla Mail and nothing has run in a browser.
 * `jsdom` implements no IndexedDB, so the real `deleteDatabase` path is exercised
 * nowhere from here — `packages/storage/src/indexeddb.test.ts` is where that is
 * checked, and neither fact is a claim about a user's device.
 */
describe("making this device forget the address", () => {
  it("says nothing about local data while the read is still out", async () => {
    // **The defect this block found.** The region was first gated on "anything but
    // blocked", so it rendered *during* the read with `localData` at its initial `none`
    // — and said "Nothing is kept in this browser" on a page that had not looked yet.
    // A region that asserts a store's contents before reading it is the failure
    // `storage-stub.ts` names, in a different place and a different layer.
    //
    // Asserted as the absence of the whole region rather than the presence of a "still
    // checking" line: the requirement is that the page claim neither way, and a region
    // that existed at all would be one more place for the claim to leak in.
    let release!: (value: Mailbox | null) => void;
    const read = new Promise<Mailbox | null>((resolve) => {
      release = resolve;
    });
    const storage: SpectreStorage = {
      loadMailbox: () => read,
      saveMailbox: () => Promise.resolve(),
      clearAll: () => Promise.resolve(),
    };
    const provider = countingProvider();

    render(<App session={sessionOver(provider)} storage={{ kind: "ready", storage }} />);

    expect(screen.queryByRole("heading", { name: /what this browser remembers/i })).toBeNull();
    // **The page does still say a check is in flight**, from the session's own region —
    // so nothing is left unsaid by the region being absent.
    expect(screen.getByTestId("idle")).toBeTruthy();
    expect(provider.creates()).toBe(0);

    release(null);
    await screen.findByTestId("ready");
  });

  it("offers a removal once it has stored something", async () => {
    // **And the wait is on the *store*, not on the session.**
    //
    // This test was flaky at about one run in three, and the reason is a real ordering
    // property rather than test noise: `ready` is published by the session the moment
    // the mailbox exists, while `localData` becomes `stored` only in the `saveMailbox`
    // success callback — a later turn of the microtask queue. So on a first visit the
    // page can legitimately be showing "Ready" with nothing stored yet, and
    // `findByTestId("ready")` is the wrong thing to synchronise on.
    //
    // **This is the third time this file has had a wait that was too early**, and the
    // shape is always the same: a binding publishes what the *user* sees from the
    // session, and what the *device* holds arrives from a promise afterwards. A wait on
    // the first cannot observe the second.
    const store = stubStore();

    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);

    await screen.findByTestId("local-data-stored");
    expect(store.saves).toHaveLength(1);
    expect(screen.getByRole("button", { name: /clear saved data/i })).toBeTruthy();
  });

  it("offers no removal, and says nothing is kept, when a write was refused", async () => {
    // **The reachable way to hold nothing while a mailbox is on screen.** The page
    // always stores the mailbox it creates, so on a first visit something *is* stored
    // within moments. The states where nothing is stored are a refused write, and the
    // window before the boot read lands — which is the test above.
    const store = stubStore({ saveThrows: new Error("the disk is full") });

    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");
    await screen.findByTestId("save-failed");

    expect(screen.getByTestId("local-data-empty")).toBeTruthy();
    // **The point of the assertion.** Offering to remove something this device never
    // managed to store is a control that cannot act, and the sentence beside it would
    // have to claim a record that does not exist.
    expect(screen.queryByRole("button", { name: /clear saved data/i })).toBeNull();
  });

  it("removes nothing until a second step is taken", async () => {
    const store = stubStore({ stored: mailbox("stored-one") });
    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");

    fireEvent.click(screen.getByRole("button", { name: /clear saved data/i }));

    // **Asserted after the click, not only at the end.** The slice-2 falsification pass
    // found a retry test that checked only the state after the retry landed, which the
    // buggy code also reached — so a control that removed on the first click and asked
    // afterwards would pass an outcome-only check.
    expect(screen.getByTestId("local-data-confirmation")).toBeTruthy();
    expect(store.clearCount()).toBe(0);
    // And it is irreversible, so the confirmation says so rather than implying a dialog
    // that can be dismissed later.
    expect(visibleText()).toMatch(/cannot be undone/i);
  });

  it("removes nothing when the user keeps it", async () => {
    const store = stubStore({ stored: mailbox("stored-one") });
    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");

    fireEvent.click(screen.getByRole("button", { name: /clear saved data/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep it/i }));

    expect(store.clearCount()).toBe(0);
    expect(screen.getByRole("button", { name: /clear saved data/i })).toBeTruthy();
  });

  it("removes what this device holds, and says what that means for a reload", async () => {
    const store = stubStore({ stored: mailbox("stored-one") });
    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");

    fireEvent.click(screen.getByRole("button", { name: /clear saved data/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove it/i }));

    await screen.findByTestId("local-data-removed");
    expect(store.clearCount()).toBe(1);
    // **The consequence is the half that is easy to omit.** A user who has just removed
    // their address, with the mailbox still on screen, needs to know what will and will
    // not still work.
    expect(visibleText()).toMatch(/reload will not bring/i);
    // **And it must not claim the address itself is gone** — the provider still has it.
    expect(visibleText()).toMatch(/still works/i);
    expect(screen.queryByRole("button", { name: /clear saved data/i })).toBeNull();
  });

  it("keeps the address and the inbox usable after a removal", async () => {
    // **Removal deletes this device's note of the address, not the mailbox.** A page
    // that tore down the inbox as well would trade a privacy action for a data loss the
    // user did not ask for — and from the outside it would be indistinguishable from a
    // product that destroys mailboxes.
    const store = stubStore({ stored: mailbox("stored-one") });
    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");
    await screen.findByTestId("inbox-empty");

    fireEvent.click(screen.getByRole("button", { name: /clear saved data/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove it/i }));
    await screen.findByTestId("local-data-removed");

    expect(visibleText()).toContain("stored-one@mail.example");
    expect(screen.getByTestId("ready")).toBeTruthy();
    expect(screen.getByTestId("inbox-empty")).toBeTruthy();
  });

  it("reports a refusal as a refusal, and does not describe the data as removed", async () => {
    // **The three-way exclusion, asserted on the shape rather than the words.** The page
    // may say the removal did not happen; it may not say the data is gone, and it may not
    // say the data is safe. The copy says only the first, and the assertion is that the
    // removed shape did not render — which a reworded sentence could not fake.
    const store = stubStore({
      stored: mailbox("stored-one"),
      clearThrows: new Error("another connection is holding it open"),
    });
    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");

    fireEvent.click(screen.getByRole("button", { name: /clear saved data/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove it/i }));

    await screen.findByTestId("local-data-refused");
    expect(visibleText()).toMatch(/was not removed/i);
    // **The platform's own words, verbatim.** "another connection is holding it open" is
    // something a user can act on, and rewriting it here would throw that away.
    expect(visibleText()).toContain("another connection is holding it open");
    // **The load-bearing negative.**
    expect(screen.queryByTestId("local-data-removed")).toBeNull();
    // Nor is it claimed to have survived: the device still reports what it holds, so the
    // control stays available for the retry the message asks for.
    expect(screen.getByRole("button", { name: /clear saved data/i })).toBeTruthy();
  });

  it("does not write the address back after a removal, however many checks follow", async () => {
    // **The property this whole slice turns on, and the one most likely to rot.** The
    // save effect refuses to write a mailbox whose id is the one this load was handed,
    // so nothing should be written — but that is a comparison nobody would notice
    // breaking, and a page that quietly undid a removal minutes later is the worst
    // outcome available here.
    //
    // **No new guard was added to make it true**, and that is a claim about the code
    // rather than about a test. It is recorded here so a later reader who finds this
    // assertion has two possible explanations and knows which one shipped.
    //
    // **A created mailbox, not a stored one — and that is forced, not preferred.** A
    // failing first listing against a *stored* mailbox fails `restore`, so the session
    // goes to `restoreFailed` and never reaches `ready`: the test would then be
    // measuring a failed adoption. Starting from nothing stored means the listing that
    // fails is the inbox's own, which is also what puts the "Check again" control on
    // the page — a healthy empty inbox has no control to drive it with.
    const provider = countingProvider({
      listMessages: () => Promise.reject(new Error("the listing failed")),
    });
    const store = stubStore();
    render(<App session={sessionOver(provider)} storage={store.storage} />);
    await screen.findByTestId("ready");
    await screen.findByTestId("inbox-check-failed");
    // The page stored what it created, so the removal control is there to be exercised.
    expect(store.saves.length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /clear saved data/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove it/i }));
    await screen.findByTestId("local-data-removed");
    const savesBeforeChecks = store.saves.length;

    // **Three separate transitions, and each is waited for rather than fired blind.** A
    // single check could pass because the poller had not run yet, which a positive
    // control alone does not rule out.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = provider.lists();
      fireEvent.click(screen.getByRole("button", { name: /check again/i }));
      await waitFor(() => expect(provider.lists()).toBeGreaterThan(before));
      await screen.findByTestId("inbox-check-failed");
    }

    expect(store.saves.length).toBe(savesBeforeChecks);
  });

  it("still stores an address the user asks for after a removal", async () => {
    // **The positive control for the test above, and it is in this file on purpose.** A
    // "the page stopped writing" assertion is satisfied just as well by a stub that
    // records nothing at all, and by a page that never writes — so without this half,
    // the assertion above would pass on a product that had simply stopped persisting.
    //
    // The distinction it turns on: a **replacement** address is a different mailbox from
    // the one handed to this load, so storing it is correct. That is the same precedence
    // the spec states — a user's decision to forget beats persistence until they decide
    // otherwise.
    const store = stubStore({ stored: mailbox("stored-one") });
    render(<App session={sessionOver(countingProvider())} storage={store.storage} />);
    await screen.findByTestId("ready");
    const savesBefore = store.saves.length;

    fireEvent.click(screen.getByRole("button", { name: /clear saved data/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove it/i }));
    await screen.findByTestId("local-data-removed");

    fireEvent.click(screen.getByRole("button", { name: /replace address/i }));
    // **Waited on the save rather than on `ready`, for the same reason as the flaky test
    // above.** A replacement address is stored by an effect that runs after the session
    // publishes its new mailbox, so `ready` can be on screen with the write outstanding.
    await waitFor(() => expect(store.saves.length).toBeGreaterThan(savesBefore));
    // **And the address on screen is the new one**, so the assertion is not satisfied by
    // a save of something the page is no longer showing.
    expect(visibleText()).toContain("guerrilla-1@mail.example");
  });
});

describe("a stored mailbox the provider will not confirm", () => {
  /** A provider whose listing fails with `error`, so adoption cannot confirm. */
  function refusing(error: SpectreError) {
    return countingProvider({
      listMessages: () => Promise.reject(error),
    });
  }

  it("renders the state as its own labelled region", async () => {
    render(
      <App
        session={sessionOver(
          refusing({
            code: NormalizedErrorCode.NETWORK_ERROR,
            provider: "guerrilla",
            description: "The request never reached the provider.",
            cause: new Error("network down"),
          }),
        )}
        storage={stubStore({ stored: mailbox("stored-1") }).storage}
      />,
    );

    // By accessible name, which is what a screen reader addresses it by. The section
    // carries `aria-labelledby`, so it is a `region`.
    // **Awaited first**, because a synchronous query after `render` sees the boot and
    // nothing else — the read and the reconciliation are both in flight.
    await screen.findByTestId("restore-failed-address");
    expect(
      screen.getByRole("region", { name: /could not check your saved address/i }),
    ).toBeTruthy();
  });

  it("does not say the address is gone when the check merely failed", async () => {
    // **The wording claim, and the reason this state exists at all.** A provider that
    // drops one request says nothing about whether the mailbox works, so any wording
    // that reads as "gone" tells the user something false about the only copy of their
    // address. `StoredAddressGone` is where that wording is allowed, and it is a
    // different state because the provider actually said so.
    render(
      <App
        session={sessionOver(
          refusing({
            code: NormalizedErrorCode.NETWORK_ERROR,
            provider: "guerrilla",
            description: "The request never reached the provider.",
            cause: new Error("network down"),
          }),
        )}
        storage={stubStore({ stored: mailbox("stored-1") }).storage}
      />,
    );
    await screen.findByTestId("restore-failed-address");

    const text = visibleText();
    expect(text).not.toMatch(/\bgone\b/i);
    expect(text).not.toMatch(/no longer/i);
    expect(text).not.toMatch(/will not receive/i);
    // The address is named, and named as unchecked rather than withheld: the user came
    // back for it and hiding it would be a small loss next to the risk of their
    // believing they had lost it.
    expect(text).toContain("stored-1@mail.example");
    expect(text).toContain("The request never reached the provider.");
  });

  it("offers a new address without discarding what is stored", async () => {
    // **The control `restoreFailed` offers, and the destructive thing it must not do.**
    // The provider did not say the mailbox is dead — only that nobody could ask — so
    // overwriting the only copy of an address that may still work is not a decision
    // SpectreMail should make on the user's behalf.
    const store = stubStore({ stored: mailbox("stored-1") });
    const provider = refusing({
      code: NormalizedErrorCode.NETWORK_ERROR,
      provider: "guerrilla",
      description: "The request never reached the provider.",
      cause: new Error("network down"),
    });

    render(<App session={sessionOver(provider)} storage={store.storage} />);
    await screen.findByTestId("restore-failed-address");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /use a new address for now/i }));
    });
    await screen.findByTestId("ready");

    // A usable address for this visit...
    expect(visibleText()).toContain("@mail.example");
    // ...and the stored record untouched.
    expect(store.saves).toEqual([]);
  });

  it("says the address is gone when the provider said it was", async () => {
    // **The positive control for every absence above.** Without this, a page whose
    // `expired` copy also avoided the word "gone" would pass all three.
    render(
      <App
        session={sessionOver(
          refusing({
            code: NormalizedErrorCode.MAILBOX_EXPIRED,
            provider: "guerrilla",
            description: "The provider does not recognise this session.",
            cause: new Error("no such session"),
          }),
        )}
        storage={stubStore({ stored: mailbox("stored-1") }).storage}
      />,
    );

    await screen.findByTestId("expired-address");
    expect(visibleText()).toContain("stored-1@mail.example");
    // **By accessible name, after the state has settled** — a synchronous query after
    // `render` sees the boot and nothing else. And the region is still the expired one
    // once the page has caught up, which is the claim that matters.
    expect(screen.getByRole("region", { name: /saved address is gone/i })).toBeTruthy();
    expect(screen.queryByTestId("restore-failed-address")).toBeNull();
  });

  it("does not offer a gone address as one to receive mail at", async () => {
    // **The claim `expired` must not make, and it is a structural one.** The `Address`
    // component renders the address, a copy control, and the words "Your address" — all
    // of which tell a reader the address is usable. So the assertion is about that
    // component being absent rather than about prose, because prose can be reworded
    // without the page becoming truthful.
    render(
      <App
        session={sessionOver(
          refusing({
            code: NormalizedErrorCode.MAILBOX_EXPIRED,
            provider: "guerrilla",
            description: "The provider does not recognise this session.",
            cause: new Error("no such session"),
          }),
        )}
        storage={stubStore({ stored: mailbox("stored-1") }).storage}
      />,
    );
    await screen.findByTestId("expired-address");

    expect(screen.queryByTestId("address")).toBeNull();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
    // And the page is not claiming to be ready for mail.
    expect(screen.queryByTestId("ready")).toBeNull();
    expect(visibleText()).not.toContain("Your address is below");
  });

  it("keeps writing after a fresh address, once the user replaces it", async () => {
    // **The other half of `startFresh`'s contract.** Persisting is suspended for the
    // fresh address; choosing *Replace address* afterwards is the user changing their
    // mind, and the page must not keep honouring the earlier decision — otherwise the
    // address they picked is discarded on the next reload and the one they rejected is
    // handed back.
    const store = stubStore({ stored: mailbox("stored-1") });
    const provider = refusing({
      code: NormalizedErrorCode.NETWORK_ERROR,
      provider: "guerrilla",
      description: "The request never reached the provider.",
      cause: new Error("network down"),
    });

    render(<App session={sessionOver(provider)} storage={store.storage} />);
    await screen.findByTestId("restore-failed-address");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /use a new address for now/i }));
    });
    await screen.findByTestId("ready");
    expect(store.saves).toEqual([]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /replace address/i }));
    });
    await screen.findByTestId("ready");

    await vi.waitFor(() => {
      expect(store.saves).toHaveLength(1);
    });
  });
});

describe("the state where a mailbox could not be created", () => {
  it("still names the provider it reached, so the limits list is checked in every state", async () => {
    // **Kept from `App.test.tsx`, because that test grew a fourth state and this one
    // is the case it does not cover.** The limits list is rendered outside every
    // conditional, and a change that moved it into one branch would keep the other
    // states green while dropping it from this one.
    const store: WebsiteStorage = stubStore().storage;

    render(
      <App
        session={sessionOver(
          countingProvider({
            createMailbox: () =>
              Promise.reject({
                code: NormalizedErrorCode.NETWORK_ERROR,
                provider: "guerrilla",
                description: "The request never reached the provider.",
                cause: new Error("network down"),
              }),
          }),
        )}
        storage={store}
      />,
    );
    await screen.findByTestId("failure-explanation");

    expect(
      screen.getByRole("region", { name: /what this page can and cannot do/i }).textContent,
    ).toContain("Guerrilla Mail");
    // And nothing was stored, because there was nothing to store.
    expect(screen.queryByTestId("save-failed")).toBeNull();
  });
});
