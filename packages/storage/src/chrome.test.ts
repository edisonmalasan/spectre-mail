/**
 * The `chrome.storage` adapter, against a fake area.
 *
 * ## Why a fake, and not a stubbed global
 *
 * `chrome.storage` is not a DOM API and does not exist in any test environment, so
 * there is nothing to install. The fake here is therefore the *only* substrate
 * these tests run on — which is the situation `AGENTS.md` records for
 * `fake-indexeddb` and repeats here for a second reason: **a fake is not the
 * platform**, and the properties asserted below are properties of this adapter
 * against a fake that behaves as documented, not of Chromium's implementation.
 *
 * The properties the platform owns — that `get` resolves with absent keys rather
 * than `undefined` ones, and that `set` resolves on acceptance with no commit step
 * after it — are the platform's, and the fake implements them because they are what
 * the adapter is written against. Nothing here establishes that Chromium does the
 * same; `docs/PROVIDERS.md` records what was and was not measured.
 */

import { describe, expect, it } from "vitest";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import {
  createChromeMailboxes,
  createChromeSiteAssociations,
  createChromeStorage,
  EXTENSION_MAILBOX_KEY,
} from "./chrome";
import { fakeChromeArea as fakeArea } from "./testing/chrome-area";
import type { ChromeStorageArea } from "./chrome-api";
import { SPECTRE_RECORD_VERSION } from "./record";

/**
 * The mailbox this file round-trips.
 *
 * **`provider` is not supplied, and this version of the fixture got that wrong.** It
 * passed `provider: "mailtm"` alongside the credentials, and `createMailbox` derives
 * `Mailbox.provider` from the credential discriminant — so the extra field is not a
 * permitted override, it is a second source for a value the model already computes from
 * one. **`pnpm test` was green on this file and `pnpm typecheck` exited 1**, which is the
 * recorded lesson biting again: Vitest does not typecheck, so a fixture that the compiler
 * rejects still passes every assertion written against it.
 *
 * The address is a reserved `.example` domain for the same reason `packages/mail-parser`'s
 * corpus uses one: **an earlier draft of this fixture used `ghost83@api.mail.tm`**, which
 * is an API host rather than a mail domain and reads as a claim about where mail arrives.
 * Nothing in this file depends on the domain, and nothing here contacts a provider.
 */
const mailbox: Mailbox = createMailbox({
  id: "session-token",
  address: "stored@mail.example",
  credentials: { provider: "mailtm", accessToken: "measured-token", accountId: "acct-1" },
  createdAt: 1_760_000_000_000,
});

describe("createChromeStorage", () => {
  it("round-trips a mailbox through the platform", async () => {
    const { area } = fakeArea();
    const storage = createChromeStorage({ area });

    await storage.saveMailbox(mailbox);

    await expect(storage.loadMailbox()).resolves.toEqual(mailbox);
  });

  it("reports nothing stored as null, and a read failure as a rejection", async () => {
    const { area } = fakeArea();
    await expect(createChromeStorage({ area }).loadMailbox()).resolves.toBeNull();

    // **A failure must not read as absence.** The contract reserves `null` for one
    // meaning, because a read reported as "nothing stored" makes a client believe it
    // is a first visit and overwrite the address the user came back for.
    const failing = fakeArea();
    failing.area.get = () => Promise.reject(new Error("quota"));
    await expect(createChromeStorage({ area: failing.area }).loadMailbox()).rejects.toThrow(
      /quota/,
    );
  });

  it("rejects a save of something that is not a mailbox, and stores nothing", async () => {
    const { area, data } = fakeArea();
    const storage = createChromeStorage({ area });

    await expect(storage.saveMailbox({ not: "a mailbox" } as never)).rejects.toBeInstanceOf(
      TypeError,
    );

    expect(data).toEqual({});
  });

  it("writes the versioned record the shared narrowing reads", async () => {
    const { area, data } = fakeArea();
    await createChromeStorage({ area }).saveMailbox(mailbox);

    expect(data[EXTENSION_MAILBOX_KEY]).toEqual({
      version: SPECTRE_RECORD_VERSION,
      mailbox,
    });
  });

  it("surfaces neither a wrong-version record nor a corrupt one, and deletes neither", async () => {
    for (const planted of [
      { version: 999, mailbox },
      { version: SPECTRE_RECORD_VERSION, mailbox: { address: 12 } },
      "not an object",
    ]) {
      const { area, data } = fakeArea({ [EXTENSION_MAILBOX_KEY]: planted });

      await expect(createChromeStorage({ area }).loadMailbox()).resolves.toBeNull();

      // **Left where it is.** A record that fails to narrow is not corruption to be
      // tidied away: a future model change would otherwise destroy every stored
      // mailbox the first time this code ran.
      expect(data[EXTENSION_MAILBOX_KEY]).toEqual(planted);
    }
  });

  it("removes the whole area, including a key this build does not recognise", async () => {
    // **The planted key is the assertion.** Deleting only the one key this build
    // stores would pass every other test in this file and quietly stop clearing
    // everything the moment a later build added a second record kind.
    const { area, data, calls } = fakeArea({
      [EXTENSION_MAILBOX_KEY]: { version: SPECTRE_RECORD_VERSION, mailbox },
      "some-future-record": { site: "example.com", mailboxId: "abc" },
    });
    const storage = createChromeStorage({ area });
    await storage.saveMailbox(mailbox);

    await storage.clearAll();

    expect(data).toEqual({});
    // The **call** as well as the outcome: `clearAll` emptying the area is the
    // requirement, and reading it only from the resulting object would also be
    // satisfied by a loop that deleted every key it happened to know.
    expect(calls).toContain("clear()");
  });

  it("succeeds when nothing is stored, because the user is already in that state", async () => {
    await expect(
      createChromeStorage({ area: fakeArea().area }).clearAll(),
    ).resolves.toBeUndefined();
  });

  it("resolves a save only after the platform accepted the write", async () => {
    // **Ordering, not just resolution.** `chrome.storage` has no transaction and no
    // commit step after its promise, so the only durability this platform offers is
    // that the promise settles after acceptance.
    //
    // ## This fixture could not fail for the reason the test names, and falsification found it
    //
    // **The thirtieth recorded instance of a check narrower than the rule it documents,
    // and this change authored it.** The first version's fake resolved the write
    // *synchronously* inside the promise executor:
    //
    // ```ts
    // set: () => new Promise<void>((resolve) => { order.push("platform-accepted"); resolve(); })
    // ```
    //
    // A promise resolved on the spot has already settled by the time the adapter reaches
    // its `await`, so `await area.set(...)` and `void area.set(...)` produce **the same
    // two pushes in the same order** — and the mutation replacing `await` with `void` left
    // this test green. The test's name promises "only after"; its fixture could not
    // distinguish "after" from "immediately".
    //
    // The repair is the one M6 slice 2's retry assertion needed for the same reason: **hold
    // the attempt open and inspect the state while the read is out**, rather than only
    // inspecting the state the buggy implementation also reaches. `void` resolves the save
    // on the next microtask; an awaited write cannot resolve until `accept()` is called.
    const order: string[] = [];
    let accept: (() => void) | undefined;
    const area: ChromeStorageArea = {
      get: () => Promise.resolve({}),
      set: () =>
        new Promise<void>((resolve) => {
          order.push("write-issued");
          accept = () => {
            order.push("platform-accepted");
            resolve();
          };
        }),
      clear: () => Promise.resolve(),
    };

    let settled = false;
    const save = createChromeStorage({ area })
      .saveMailbox(mailbox)
      .then(() => {
        settled = true;
      });

    // **A macrotask, not a counted number of microtasks.** The point is to flush every
    // pending microtask, because `void area.set(...)` settles on the very next one, and
    // `await Promise.resolve()` once would not be enough to see it. A guessed tick count is
    // the recorded defect with a smaller number in it.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // **The load-bearing assertion: the write is open and the save has not resolved.**
    // Written first, so the mutant cannot pass by the later assertions happening to hold.
    expect(settled, "the save resolved while the platform had not yet accepted the write").toBe(
      false,
    );

    accept?.();
    await save;

    expect(order).toEqual(["write-issued", "platform-accepted"]);
    expect(settled).toBe(true);
  });

  it("propagates a write rejection rather than reporting a save that did not happen", async () => {
    const area: ChromeStorageArea = {
      get: () => Promise.resolve({}),
      set: () => Promise.reject(new Error("QUOTA_BYTES exceeded")),
      clear: () => Promise.resolve(),
    };

    await expect(createChromeStorage({ area }).saveMailbox(mailbox)).rejects.toThrow(/QUOTA_BYTES/);
  });

  it("propagates a removal rejection, and does not claim the data is still there", async () => {
    // The contract forbids a refusal being read as a statement that the data
    // remains. This adapter has no way to make that claim and does not try; the
    // message says what happened and nothing about the data's fate.
    const area: ChromeStorageArea = {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      clear: () => Promise.reject(new Error("storage is unavailable")),
    };

    await expect(createChromeStorage({ area }).clearAll()).rejects.toThrow(/unavailable/);
  });

  it("removes a record written through a contract the caller never named", async () => {
    const { area, data, calls } = fakeArea();
    const storage = createChromeStorage({ area });

    // **Three record kinds, written through three contracts, and one removal.** This is the case
    // the single-record build could not write: at the time the requirement said removal means
    // *everything*, there was nothing else to mean it over. A caller holding only
    // `SpectreStorage` has no operation that could remove either of the others — so if this
    // adapter ever narrowed `clearAll` to `EXTENSION_MAILBOX_KEY`, the test would still find the
    // mailbox gone and would fail on the two records it never had a name for.
    await createChromeMailboxes({ area }).addMailbox(mailbox);
    await createChromeSiteAssociations({ area }).saveSiteMailboxId("mail.example", "session-token");

    await storage.clearAll();

    expect(data).toEqual({});
    // **The call, not the result.** An empty area is what both a whole-area clear and a
    // delete-every-known-key produce, so the result alone cannot tell the two apart — which is the
    // whole reason this assertion exists.
    expect(calls).toContain("clear()");
  });

  it("removes a record kind this build does not recognise", async () => {
    const { area, data } = fakeArea({ "a-record-from-another-build": { anything: true } });

    await createChromeStorage({ area }).clearAll();

    expect(Object.hasOwn(data, "a-record-from-another-build")).toBe(false);
  });
});
