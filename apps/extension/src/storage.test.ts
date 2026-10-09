/**
 * The extension's own storage seam: which records exist, and which mailbox this device inserts.
 *
 * ## Why this file is new rather than folded into an existing one
 *
 * `createExtensionStorage` and `loadInsertableMailboxes` had **no unit coverage at all** until this
 * change, and the gap is the shape AGENTS.md has recorded repeatedly: the browser tier exercises
 * them, so they read as covered, while every decision they make — which record wins, what happens
 * when one of two records fails to read — is invisible to a fast suite. `site-associations` moved
 * the answer to "which address does this device insert" *into* this file, and a decision moved into
 * a file with no unit tier is a decision nothing can be asked about.
 *
 * ## The one thing these cases are careful about
 *
 * **`loadInsertableMailboxes` reads two records, and reading them in series would let the first
 * one's answer decide the outcome.** The cases below pin the order that matters: the collection is
 * asked first and the singular record is never consulted when the collection holds anything. That is
 * one assertion here and it is the one that would have failed had the function been written the
 * other way round.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import type { Mailbox } from "@spectre-mail/core";
import { createMailbox } from "@spectre-mail/core";
import { fakeChromeArea } from "@spectre-mail/storage/testing";
import {
  EXTENSION_MAILBOX_KEY,
  EXTENSION_MAILBOXES_KEY,
  EXTENSION_SITE_MAILBOXES_KEY,
} from "@spectre-mail/storage";

import { createExtensionStorage, loadInsertableMailboxes } from "./storage";

function mailbox(id: string, address: string): Mailbox {
  return createMailbox({
    id,
    address,
    createdAt: 0,
    credentials: { provider: "guerrilla", sessionId: `${id}-session` },
  });
}

/** A `SpectreStorage`-narrowing stand-in, built so a case can say which record fails. */
function records(overrides: {
  readonly collection?: readonly Mailbox[];
  readonly singular?: Mailbox | null;
  readonly collectionRejects?: boolean;
  readonly singularRejects?: boolean;
  readonly asked?: string[];
}) {
  const asked = overrides.asked ?? [];
  const collection = overrides.collection ?? [];

  return {
    asked,
    records: {
      stored: {
        loadMailbox: async (): Promise<Mailbox | null> => {
          asked.push("singular");
          if (overrides.singularRejects === true) {
            throw new Error("the singular read failed");
          }
          return overrides.singular ?? null;
        },
        saveMailbox: async (): Promise<void> => {},
        clearAll: async (): Promise<void> => {},
      },
      mailboxes: {
        loadMailboxes: async (): Promise<readonly Mailbox[]> => {
          asked.push("collection");
          if (overrides.collectionRejects === true) {
            throw new Error("the collection read failed");
          }
          return collection;
        },
        addMailbox: async (): Promise<void> => {},
      },
      associations: {
        loadSiteMailboxId: async (): Promise<string | null> => null,
        saveSiteMailboxId: async (): Promise<void> => {},
      },
    },
  };
}

describe("the mailboxes this device could insert", () => {
  it("answers the collection when it holds anything, and never asks the other record", async () => {
    const held = records({
      collection: [
        mailbox("newest", "newest@address.test"),
        mailbox("older", "older@address.test"),
      ],
      singular: mailbox("singular", "singular@address.test"),
    });

    const answer = await loadInsertableMailboxes(held.records);

    expect(answer.map((held) => held.id)).toEqual(["newest", "older"]);

    // **The order is asserted, not just the names, and the question the list answers is asserted by
    // its exact contents.** "Both mailboxes came back" would be satisfied by a merge of the two
    // records, which this function refuses — but **the reason it gives for refusing is that nothing
    // in this milestone can show a second entry, not that the two records are unordered.** An
    // earlier version of that reason was wrong, and this change's own boundary rule is what proved
    // it wrong: `saveMailbox` cannot be named in this client, so the singular record is strictly
    // older than every member and a merge would have had a known order. So the assertion is here to
    // catch a merge appearing for a *new* reason, not to preserve an argument that turned out false.
    expect(held.asked).toEqual(["collection"]);
  });

  it("falls back to the singular record when the collection is empty", async () => {
    // **The person this exists for.** Somebody installed this extension before this change: their
    // address is in the singular record and nowhere else, and dropping it would tell them on their
    // next visit that they had none.
    const held = records({ collection: [], singular: mailbox("singular", "kept@address.test") });

    const answer = await loadInsertableMailboxes(held.records);

    expect(answer.map((held) => held.id)).toEqual(["singular"]);
    expect(held.asked).toEqual(["collection", "singular"]);
  });

  it("answers nothing when neither record holds anything", async () => {
    const held = records({ collection: [], singular: null });

    // **An empty list, and not `null` and not an error.** "This device holds no mailbox" is a
    // different report from "this device could not be read", and the difference is what decides
    // whether creation may be offered.
    await expect(loadInsertableMailboxes(held.records)).resolves.toEqual([]);
  });

  it("rejects when the collection cannot be read, and does not fall back", async () => {
    // **The fallback is not an error path.** If the collection read fails then asking the singular
    // record instead would answer a different question than the one that failed — and would report
    // "here is your address" from a record the product had already decided not to trust. The
    // rejection is the honest report, and it is what makes a caller offer nothing.
    const held = records({
      collectionRejects: true,
      singular: mailbox("singular", "kept@address.test"),
    });

    await expect(loadInsertableMailboxes(held.records)).rejects.toThrow(
      "the collection read failed",
    );
    expect(held.asked).toEqual(["collection"]);
  });

  it("rejects when the singular record cannot be read, having already found nothing", async () => {
    const held = records({ collection: [], singularRejects: true });

    await expect(loadInsertableMailboxes(held.records)).rejects.toThrow("the singular read failed");
    expect(held.asked).toEqual(["collection", "singular"]);
  });
});

describe("building the extension's records", () => {
  it("builds all three over one area, so the three records cannot disagree about it", async () => {
    const platform = fakeChromeArea();
    const built = createExtensionStorage(platform.area);

    expect(built.kind).toBe("ready");
    if (built.kind !== "ready") {
      return;
    }

    await built.records.mailboxes.loadMailboxes();
    await built.records.associations.loadSiteMailboxId("example.test");
    await built.records.stored.loadMailbox();

    // **One area, and the calls prove it.** Three adapters over three areas would be a client that
    // could read its mailboxes from one store and its site associations from another, and no test in
    // this file would have noticed — because a *copy* of the area behaves identically. So this
    // asserts that all three reads asked the same object for its own key, which is the claim that
    // a duplicated fake cannot make.
    expect(platform.calls).toEqual([
      `get(${EXTENSION_MAILBOXES_KEY})`,
      `get(${EXTENSION_SITE_MAILBOXES_KEY})`,
      `get(${EXTENSION_MAILBOX_KEY})`,
    ]);
  });

  it("reports a context with no storage area, rather than throwing", async () => {
    // **`blocked`, and it names the absence.** A store that silently kept nothing would let the
    // popup report "nothing is saved here" on a device where saving is unavailable, which is the
    // same sentence this repository has retracted once already.
    const built = createExtensionStorage(undefined);

    expect(built.kind).toBe("blocked");
    if (built.kind !== "blocked") {
      return;
    }

    expect(built.reason).not.toBe("");
  });

  it("reports a read that failed as blocked, because the popup cannot tell either apart", () => {
    const platform = fakeChromeArea();
    const broken = {
      ...platform.area,
      get: async (): Promise<Record<string, unknown>> => {
        throw new Error("the area refused");
      },
    };

    const built = createExtensionStorage(broken, () => {
      throw new Error("the area refused");
    });

    expect(built.kind).toBe("blocked");
  });

  it("keeps each record under its own key, so one record's write is not another's", async () => {
    const platform = fakeChromeArea();
    const built = createExtensionStorage(platform.area);

    expect(built.kind).toBe("ready");
    if (built.kind !== "ready") {
      return;
    }

    // **The keys are distinct constants, and the call log is the evidence.** Three adapters over one
    // area is only safe because they disagree about what to call a key; a shared key would make the
    // three records one record with three shapes, and every test above would still pass.
    expect(EXTENSION_MAILBOXES_KEY).not.toBe(EXTENSION_SITE_MAILBOXES_KEY);

    await built.records.mailboxes.addMailbox(mailbox("made", "made@address.test"));
    await built.records.associations.saveSiteMailboxId("example.test", "made");

    expect(platform.calls).toEqual([
      // **`addMailbox` reads before it writes**, because refusing to replace a record it could not
      // read is one of that contract's claims. The order is asserted rather than summarised so that
      // a future change that skipped the read — and with it the protection — would show up here
      // rather than only in `packages/storage`'s own suite.
      `get(${EXTENSION_MAILBOXES_KEY})`,
      `set(${EXTENSION_MAILBOXES_KEY})`,
      `get(${EXTENSION_SITE_MAILBOXES_KEY})`,
      `set(${EXTENSION_SITE_MAILBOXES_KEY})`,
    ]);
  });
});
