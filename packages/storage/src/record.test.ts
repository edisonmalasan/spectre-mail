/**
 * The stored record: what is written, and what may come back off it.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

import { SPECTRE_RECORD_VERSION, readStoredMailboxRecord, toStoredMailboxRecord } from "./record";

/**
 * A mailbox as an adapter would have produced it.
 *
 * Built through `createMailbox` rather than written out, because a hand-written
 * literal is the shape this repository has twice proven can satisfy a type while
 * disagreeing with the model — `AssertProviderAgreement` exists because of exactly
 * that, and it resolved to `never` unconditionally the first time it was written.
 */
const MAILBOX: Mailbox = createMailbox({
  id: "session-token",
  address: "shadow@sharklasers.com",
  createdAt: 1_757_000_000_000,
  credentials: { provider: "guerrilla", sessionId: "session-token" },
});

describe("the stored record", () => {
  it("writes the version this build understands", () => {
    // A record whose version is a literal buried in the implementation would let a
    // version bump change what is written without changing what is read.
    expect(SPECTRE_RECORD_VERSION).toBe(1);
    expect(toStoredMailboxRecord(MAILBOX)).toEqual({
      version: SPECTRE_RECORD_VERSION,
      mailbox: MAILBOX,
    });
  });

  it("adds no field the caller did not hand it", () => {
    // `Mailbox.expiresAt` is documented as a value a provider actually reported. A
    // storage layer that completed a record — or derived an expiry — would be
    // recording an inference as an observation, which is the fabrication the shared
    // model exists to prevent.
    const record = toStoredMailboxRecord(MAILBOX);

    expect(Object.keys(record).sort()).toEqual(["mailbox", "version"]);
    expect(Object.keys(record.mailbox).sort()).toEqual([
      "address",
      "createdAt",
      "credentials",
      "id",
      "provider",
      "status",
    ]);
    expect(record.mailbox).not.toHaveProperty("expiresAt");
  });

  it("returns a well-formed record's mailbox", () => {
    expect(readStoredMailboxRecord(toStoredMailboxRecord(MAILBOX))).toEqual(MAILBOX);
  });

  it("refuses a record whose credentials contradict the mailbox", () => {
    // **The invariant a type cannot carry across an untyped boundary.** `Mailbox`
    // stores its credentials as the whole `ProviderCredentials` union, so
    // `{ provider: "guerrilla", credentials: <Mail.tm credentials> }` satisfies the
    // type perfectly and the first symptom would be an authentication failure
    // against the wrong provider. `isMailbox` exists for this and is the only
    // narrowing this layer uses.
    const contradicted = toStoredMailboxRecord({
      ...MAILBOX,
      credentials: { provider: "mailtm", accountId: "a", accessToken: "b" },
    } as unknown as Mailbox);

    expect(readStoredMailboxRecord(contradicted)).toBeNull();
  });

  it("refuses a record with no mailbox in it at all", () => {
    // **Every shape a database can hand back that is not a mailbox.** One assertion
    // over the set rather than a loop with a per-case expect, for the reason the
    // boundary file records: a per-case assertion stops at the first failure and so
    // cannot report that the next shape is also unhandled.
    const notRecords: readonly unknown[] = [
      undefined,
      null,
      "a mailbox, honestly",
      42,
      [],
      {},
      { version: SPECTRE_RECORD_VERSION },
      { mailbox: MAILBOX },
      { version: SPECTRE_RECORD_VERSION, mailbox: "shadow@sharklasers.com" },
      { version: SPECTRE_RECORD_VERSION, mailbox: { address: MAILBOX.address } },
    ];

    for (const value of notRecords) {
      expect(readStoredMailboxRecord(value), JSON.stringify(value) ?? "undefined").toBeNull();
    }
  });

  it("refuses a record carrying a version this build does not know", () => {
    // An unknown version is **not** corruption. Reporting it as such would invite
    // the discard the non-deletion rule exists to prevent, so it is reported as
    // "not a mailbox this build can use" and nothing more.
    for (const version of [0, 2, SPECTRE_RECORD_VERSION + 1, -1, "1", null]) {
      expect(readStoredMailboxRecord({ version, mailbox: MAILBOX })).toBeNull();
    }
  });

  it("does not throw for anything it is handed", () => {
    // **The other half of the "returns null rather than throwing" claim.** A
    // throw here would report a working store as broken, and the caller's correct
    // response to the two is different. This is asserted directly because it is the
    // property the null returns above cannot show on their own.
    const hostile: readonly unknown[] = [
      Object.freeze({}),
      Object.create(null),
      new Date(),
      // **A record that is well-shaped but fails the model.** Without this the
      // assertion could not fail for the reason it names: falsifying the null branch
      // into a `throw` was caught by this test in the first run only by accident,
      // because the mutation also broke the narrowing that three other tests read.
      // A test that catches a defect for an unrelated reason is not covering it.
      { version: SPECTRE_RECORD_VERSION, mailbox: { address: "someone@example.test" } },
    ];

    for (const value of hostile) {
      expect(
        () => readStoredMailboxRecord(value),
        JSON.stringify(value) ?? "unknown",
      ).not.toThrow();
      // Paired with each half, so "does not throw" cannot be satisfied by a value
      // that is also wrongly returned.
      expect(readStoredMailboxRecord(value), JSON.stringify(value) ?? "unknown").toBeNull();
    }
  });
});
