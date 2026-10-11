/**
 * The reported-message record, over a fake `chrome.storage` area.
 *
 * ## Why the substrate is a fake, and what that costs
 *
 * The substrate is `fakeChromeArea`, and the limit is the one `chrome-area.ts` states for itself:
 * **it is not Chromium.** It implements the shape `chrome.storage` is written against, so every
 * property asserted below is a property of this adapter against a fake behaving as documented.
 *
 * ## The arms here, and the one that matters most
 *
 * The requirements this file carries are six, and five of them are ordinary round-trip and refusal
 * checks. **The sixth is the one a reader should look at first**: an entry this build cannot read is
 * neither returned nor deleted, *including by a write for a different mailbox*. That last clause is
 * the one no assertion above it would catch on its own — a `saveSeenMessageIds` that rebuilt the
 * record from the ids it could read would pass every round-trip case here while quietly discarding
 * another mailbox's whole history on the first write of the day.
 */

import { describe, expect, it } from "vitest";

import { createChromeSeenMessages, EXTENSION_SEEN_MESSAGES_KEY } from "./chrome";
import { fakeChromeArea } from "./testing/chrome-area";
import { SPECTRE_ENVELOPE_VERSION, type StoredSeenMessages } from "./record";

/** A stored envelope, written the way a build that is not this one might have. */
function envelope(seen: Record<string, unknown>): StoredSeenMessages {
  return { version: SPECTRE_ENVELOPE_VERSION, seen };
}

describe("createChromeSeenMessages", () => {
  it("round-trips the ids reported for one mailbox", async () => {
    const { area } = fakeChromeArea();
    const seen = createChromeSeenMessages({ area });

    await seen.saveSeenMessageIds("mailbox-a", ["m1", "m2"]);

    await expect(seen.loadSeenMessageIds("mailbox-a")).resolves.toEqual(["m1", "m2"]);
  });

  it("reports nothing recorded as null, and never as an empty list", async () => {
    const { area } = fakeChromeArea();
    const seen = createChromeSeenMessages({ area });

    await expect(seen.loadSeenMessageIds("mailbox-a")).resolves.toBeNull();

    // **A mailbox this device has watched and found empty is a different thing from one it has
    // never watched, and the record cannot hold the difference.** So the write refuses rather than
    // storing a second spelling of "nothing", which is why this reads `null` above and would read
    // `null` below too.
    await expect(seen.saveSeenMessageIds("mailbox-a", [])).rejects.toBeInstanceOf(TypeError);
    await expect(seen.loadSeenMessageIds("mailbox-a")).resolves.toBeNull();
  });

  it("reports a read failure as a rejection rather than as an absence", async () => {
    const { area } = fakeChromeArea({
      // **A record whose version this build does not know is unreadable, not empty.** It is seeded
      // rather than produced by a write, because a write would narrow it first.
      [EXTENSION_SEEN_MESSAGES_KEY]: { version: SPECTRE_ENVELOPE_VERSION + 1, seen: { a: ["m1"] } },
    });
    const seen = createChromeSeenMessages({ area });

    // **This contract says nothing unreadable is ever treated as though it were absent.** Answering
    // `null` here would tell a background check that this device has never reported anything, and it
    // would announce every message in the mailbox a second time.
    await expect(seen.loadSeenMessageIds("a")).rejects.toBeInstanceOf(Error);
  });

  it("leaves another mailbox's ids exactly as they were", async () => {
    const { area } = fakeChromeArea();
    const seen = createChromeSeenMessages({ area });

    await seen.saveSeenMessageIds("mailbox-a", ["a1"]);
    await seen.saveSeenMessageIds("mailbox-b", ["b1", "b2"]);
    await seen.saveSeenMessageIds("mailbox-a", ["a1", "a2"]);

    await expect(seen.loadSeenMessageIds("mailbox-a")).resolves.toEqual(["a1", "a2"]);
    await expect(seen.loadSeenMessageIds("mailbox-b")).resolves.toEqual(["b1", "b2"]);
  });

  it("keeps an entry it cannot read, both by a read and by a write", async () => {
    const unreadable = { notAnArray: true };
    const { area } = fakeChromeArea({
      [EXTENSION_SEEN_MESSAGES_KEY]: envelope({
        "mailbox-a": ["a1"],
        "mailbox-broken": unreadable,
      }),
    });
    const seen = createChromeSeenMessages({ area });

    // **Not returned, and not an error either** — a mailbox whose entry this build cannot use is
    // answered as though nothing were recorded, because a *whole-record* failure and *this mailbox's*
    // absence are different questions and the record can only answer the second.
    await expect(seen.loadSeenMessageIds("mailbox-broken")).resolves.toBeNull();
    await expect(seen.loadSeenMessageIds("mailbox-a")).resolves.toEqual(["a1"]);

    await seen.saveSeenMessageIds("mailbox-a", ["a1", "a2"]);

    // **The clause that matters.** The entry is still there, byte for byte, after a write that
    // touched a different mailbox entirely. Rebuilding the record from the ids this build could read
    // would delete it here and pass every other assertion in this file.
    await expect(area.get(EXTENSION_SEEN_MESSAGES_KEY)).resolves.toEqual({
      [EXTENSION_SEEN_MESSAGES_KEY]: envelope({
        "mailbox-a": ["a1", "a2"],
        "mailbox-broken": unreadable,
      }),
    });
  });

  it("refuses to replace a record it cannot read", async () => {
    const { area, calls } = fakeChromeArea({
      [EXTENSION_SEEN_MESSAGES_KEY]: { version: SPECTRE_ENVELOPE_VERSION, seen: "not a map" },
    });
    const seen = createChromeSeenMessages({ area });

    await expect(seen.saveSeenMessageIds("mailbox-a", ["a1"])).rejects.toBeInstanceOf(Error);

    // **Asserted through the calls, not the data.** The data is unchanged either way, so only the
    // call the adapter made distinguishes a refusal from a write the fake ignored — and an adapter
    // that reported success while overwriting would be the deletion this contract exists to prevent.
    expect(calls.filter((call) => call.startsWith("set("))).toEqual([]);
  });

  it("refuses an empty mailbox id and an empty message id", async () => {
    const { area } = fakeChromeArea();
    const seen = createChromeSeenMessages({ area });

    await expect(seen.loadSeenMessageIds("")).rejects.toBeInstanceOf(TypeError);
    await expect(seen.saveSeenMessageIds("", ["m1"])).rejects.toBeInstanceOf(TypeError);
    await expect(seen.saveSeenMessageIds("mailbox-a", ["m1", ""])).rejects.toBeInstanceOf(
      TypeError,
    );

    // **And nothing was written by any of them.** A refusal that still wrote would leave a record
    // the next read would report as history.
    await expect(area.get(EXTENSION_SEEN_MESSAGES_KEY)).resolves.toEqual({});
  });

  it("is offered no IndexedDB adapter, and that omission is asserted rather than assumed", async () => {
    /**
     * **This is the last case and it is about what does not exist.**
     *
     * The requirement says a `chrome.storage` adapter exists and no IndexedDB adapter does, so the
     * second half needs an instrument or it is a claim nobody checks — and a missing adapter is the
     * kind of absence that reads as an oversight rather than a decision.
     *
     * **It asserts the module surface, not the file system.** A contract the website cannot use is a
     * contract the website should not be made to hold, and the failure this guards against is a
     * later build adding an adapter for a record no page calls.
     */
    const storage = await import("./index");

    expect(storage.createChromeSeenMessages).toBeTypeOf("function");
    expect(Object.keys(storage)).not.toContain("createIndexedDbSeenMessages");
    expect(Object.keys(storage)).not.toContain("createBrowserSeenMessages");
  });
});
