/**
 * `createChromeMailboxes`, over a fake `chrome.storage.local` area.
 *
 * ## What this file is for, beyond the round trip
 *
 * A round trip is the easy half. The claims worth testing are the ones where getting it wrong
 * produces a device that **looks** right: a duplicate address a person never asked for, a newest
 * mailbox that is not the current one, a record from another build quietly overwritten, and a read
 * that reports "this device holds nothing" for a reason that is not that.
 *
 * ## And the ordering claim is the contract's
 *
 * "Newest first, and the first entry is the current mailbox" is a promise about *order*, and an
 * unordered assertion would pass against an adapter that returned them in reverse. So every ordering
 * assertion here reads the whole list rather than a length or a `toContain`.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import { createChromeMailboxes, EXTENSION_MAILBOXES_KEY } from "./chrome";
import { fakeChromeArea } from "./testing/chrome-area";
import { SPECTRE_ENVELOPE_VERSION, toStoredMailboxCollection } from "./record";

function mailboxWith(id: string, address: string): Mailbox {
  return createMailbox({
    id,
    address,
    credentials: { provider: "mailtm", accessToken: `token-${id}`, accountId: `acct-${id}` },
    createdAt: 1_760_000_000_000,
  });
}

const first = mailboxWith("session-1", "first@mail.example");
const second = mailboxWith("session-2", "second@mail.example");

describe("createChromeMailboxes", () => {
  it("records a mailbox this device was handed and reads it back", async () => {
    const { area } = fakeChromeArea();
    const mailboxes = createChromeMailboxes({ area });

    await mailboxes.addMailbox(first);

    await expect(mailboxes.loadMailboxes()).resolves.toEqual([first]);
  });

  it("reports the newest first, so the first entry is the current mailbox", async () => {
    const { area } = fakeChromeArea();
    const mailboxes = createChromeMailboxes({ area });

    await mailboxes.addMailbox(first);
    await mailboxes.addMailbox(second);

    // **The whole list, in order.** An adapter that prepended would satisfy a `toContain`
    // pair and fail this, which is the point: the claim is which mailbox is current.
    await expect(mailboxes.loadMailboxes()).resolves.toEqual([second, first]);
  });

  it("reports an empty collection rather than a failure when nothing is held", async () => {
    const { area } = fakeChromeArea();

    // **Two distinct readings of "no key at all", and the second is the one that matters.**
    // A key that was never written is absent from the object `get` resolves, and a record that is
    // present but unreadable is a different situation entirely — see the case below it.
    await expect(createChromeMailboxes({ area }).loadMailboxes()).resolves.toEqual([]);
  });

  it("reports a read failure as a failure rather than as an empty device", async () => {
    const failing = fakeChromeArea();
    failing.area.get = () => Promise.reject(new Error("quota"));

    await expect(createChromeMailboxes({ area: failing.area }).loadMailboxes()).rejects.toThrow(
      /quota/,
    );
  });

  it("records a mailbox this device already holds once, as the newest", async () => {
    const { area } = fakeChromeArea();
    const mailboxes = createChromeMailboxes({ area });

    await mailboxes.addMailbox(first);
    await mailboxes.addMailbox(second);
    await mailboxes.addMailbox(first);

    // **A duplicate is not a thing a person did.** Re-creating an address, or retrying, must not
    // grow the list — and re-recording must move it to the front, because it is the newest thing
    // this device did.
    await expect(mailboxes.loadMailboxes()).resolves.toEqual([first, second]);
  });

  it("refuses a value that is not a mailbox of the shared model", async () => {
    const { area, data } = fakeChromeArea();
    const mailboxes = createChromeMailboxes({ area });

    await expect(
      mailboxes.addMailbox({ id: "x", address: "not-a-mailbox" } as unknown as Mailbox),
    ).rejects.toThrow(TypeError);
    expect(data[EXTENSION_MAILBOXES_KEY]).toBeUndefined();
  });

  it("reads a collection whose one unreadable member does not take its siblings with it", async () => {
    const { area } = fakeChromeArea({
      [EXTENSION_MAILBOXES_KEY]: {
        version: SPECTRE_ENVELOPE_VERSION,
        mailboxes: [
          { version: 1, mailbox: first },
          // **A member from a build this one does not understand**, or a corrupt one.
          { version: 99, mailbox: second },
          "not a record at all",
        ],
      },
    });

    // **The amplification this prevents is the reason the envelope holds records.** A collection
    // narrowed as a whole would report nothing here, and a person would be offered a second
    // mailbox while the first was still stored.
    await expect(createChromeMailboxes({ area }).loadMailboxes()).resolves.toEqual([first]);
  });

  it("keeps a member it cannot read when it records a new mailbox", async () => {
    // **This case is here because a mutation found the defect it exists to catch.** Recording a
    // mailbox was written by filtering the list `loadMailboxes` returns, and that list *skips* a
    // member it cannot narrow - so recording one mailbox silently deleted an older one this build
    // simply could not read. The read side already had a case; the write side had none, which is
    // how a whole-run failure hid in a function that was green everywhere it was looked at.
    const unreadable = { version: 99, mailbox: second };
    const { area, data } = fakeChromeArea({
      [EXTENSION_MAILBOXES_KEY]: {
        version: SPECTRE_ENVELOPE_VERSION,
        mailboxes: [{ version: 1, mailbox: first }, unreadable],
      },
    });

    await createChromeMailboxes({ area }).addMailbox(second);

    const written = data[EXTENSION_MAILBOXES_KEY] as {
      mailboxes: readonly unknown[];
    };

    // **Both members are still there, in order, newest first** - and the one this build cannot read
    // is byte-identical rather than a re-narrowing of something that happens to fit.
    expect(written.mailboxes).toHaveLength(3);
    expect(written.mailboxes[1]).toEqual({ version: 1, mailbox: first });
    expect(written.mailboxes[2]).toBe(unreadable);

    // **And the reader still answers the two it can read**, which is what "kept" has to mean: a
    // member preserved in the record and dropped from every read is not preserved at all.
    await expect(createChromeMailboxes({ area }).loadMailboxes()).resolves.toEqual([second, first]);
  });

  it("moves a mailbox this device already holds rather than keeping the copy it cannot read", async () => {
    // **The other half of the same function, and it is the half that makes the preservation safe.**
    // "Keep everything unreadable" is only correct if "drop what is being re-recorded" still works -
    // otherwise every retry would grow the collection with copies of the same mailbox.
    const { area, data } = fakeChromeArea({
      [EXTENSION_MAILBOXES_KEY]: {
        version: SPECTRE_ENVELOPE_VERSION,
        mailboxes: [{ version: 1, mailbox: first }],
      },
    });

    await createChromeMailboxes({ area }).addMailbox(first);

    const written = data[EXTENSION_MAILBOXES_KEY] as { mailboxes: readonly unknown[] };
    expect(written.mailboxes).toHaveLength(1);
    await expect(createChromeMailboxes({ area }).loadMailboxes()).resolves.toEqual([first]);
  });

  it("leaves a record it cannot read in place rather than replacing it", async () => {
    const unreadable = { version: 99, mailboxes: [{ version: 1, mailbox: first }] };
    const { area, data } = fakeChromeArea({ [EXTENSION_MAILBOXES_KEY]: unreadable });
    const mailboxes = createChromeMailboxes({ area });

    await expect(mailboxes.addMailbox(second)).rejects.toThrow(/could not be read/);

    // **The write is the deletion.** Overwriting an envelope this build cannot narrow is the same
    // irreversible loss `readStoredMailboxRecord` refuses to perform on the way out, so the write
    // refuses too — and the record is still exactly what it was.
    expect(data[EXTENSION_MAILBOXES_KEY]).toEqual(unreadable);
  });

  it("writes the collection in the shape its own reader accepts", async () => {
    const { area, data } = fakeChromeArea();
    const mailboxes = createChromeMailboxes({ area });

    await mailboxes.addMailbox(first);

    // **The record is the declared shape, not merely something that round-trips.** An adapter that
    // wrote bare mailboxes would pass every read assertion above while producing a record a later
    // build could not tell from a different kind.
    expect(data[EXTENSION_MAILBOXES_KEY]).toEqual(toStoredMailboxCollection([first]));
  });
});
