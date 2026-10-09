/**
 * The stored record: what goes on disk, and what may come back off it.
 *
 * @module
 */

import { isMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";

/**
 * The version of the stored record this build writes and understands.
 *
 * Exported as a named value rather than inlined, because "which version is
 * current" is a question a reader of the read path needs answered without reading
 * a literal.
 */
export const SPECTRE_RECORD_VERSION = 1;

/**
 * The version of the **collection** envelope, and of the **association** map.
 *
 * **One constant for two envelopes, and that is a decision rather than an
 * oversight.** Each is a distinct record kind with its own lifecycle, so each could
 * carry its own number — but they are versioned for the same reason the mailbox
 * record is, they are written by the same builds, and a reader who finds three
 * version numbers in one module has to work out which applies to what. A build that
 * changes the shape of one envelope will bump this and be forced to look at the
 * other, which is the right time to ask that question.
 *
 * **The collection's members carry `SPECTRE_RECORD_VERSION` themselves**, and that
 * is what lets a member written by an older build be skipped rather than taking the
 * envelope with it. A single version covering the whole collection could not
 * express the difference.
 */
export const SPECTRE_ENVELOPE_VERSION = 1;

/**
 * One mailbox as it is written down.
 *
 * **The envelope is not decoration.** Versioning exists so a later build can tell
 * "written by an older version" apart from "not a mailbox at all". Without it,
 * every record written before a schema change arrives as corruption, and the only
 * available response to corruption is to discard it.
 *
 * The record is the model's own `Mailbox` rather than a bespoke shape, and that is
 * what satisfies `provider-adapters`' requirement that persisted credentials use
 * the normalized credential shape with no provider wire field name in them:
 * `packages/core` already derives `Mailbox.provider` from
 * `credentials.provider`, so a stored credential cannot contradict the mailbox it
 * belongs to.
 */
export interface StoredMailboxRecord {
  readonly version: number;
  readonly mailbox: Mailbox;
}

/**
 * The mailboxes this device holds, as written down.
 *
 * **Members are `StoredMailboxRecord`s rather than bare `Mailbox`s, and that is
 * the whole design of this envelope.** A collection of bare mailboxes could only be
 * narrowed member by member, so one member this build cannot read would take every
 * sibling with it — turning a single unreadable address into the loss of all of
 * them. Holding the records themselves means each member is narrowed by
 * {@link readStoredMailboxRecord}, the *same* function the single-mailbox path
 * uses, and one that fails is skipped while its siblings survive.
 *
 * **`mailboxes` is `readonly unknown[]` and not `readonly StoredMailboxRecord[]`, and that is
 * the other half of the same property.** A member written by a build this one does not
 * understand is still a member, and {@link prependStoredMailbox} has to keep it verbatim -
 * so the stored shape cannot claim to know what every entry is. Typing them as records
 * would be a claim about a record this process did not write; the *reader* is what
 * turns an `unknown` into a `Mailbox`, or declines to.
 */
export interface StoredMailboxCollection {
  readonly version: number;
  readonly mailboxes: readonly unknown[];
}

/**
 * Which mailbox each site was last used with, as written down.
 *
 * A map from host to mailbox id under a version. **The version is the only wrapper,
 * and it earns its place**: without it, a record written before the keys meant hosts
 * could not be told apart from corruption.
 */
export interface StoredSiteAssociations {
  readonly version: number;
  readonly sites: Readonly<Record<string, unknown>>;
}

/**
 * The record to write for `mailbox`.
 *
 * Adds no field and completes no missing one. In particular it does **not** add
 * an expiry, a cadence, or a provider status: `Mailbox.expiresAt` is documented as
 * a value a provider actually reported, and a storage layer that filled one in
 * would be recording an inference as an observation — the fabrication the shared
 * model exists to prevent.
 */
export function toStoredMailboxRecord(mailbox: Mailbox): StoredMailboxRecord {
  return { version: SPECTRE_RECORD_VERSION, mailbox };
}

/**
 * The mailbox in `value`, or `null` if it is not one this build can use.
 *
 * `value` is typed `unknown` because a record read out of a database is
 * **untrusted input**. `packages/core/src/invariants.ts` says so about the very
 * function this calls: a compile-time invariant "cannot stop a literal assembled
 * from `unknown` data, such as a record parsed out of storage", and it is why
 * `isMailbox` exists at all.
 *
 * ## Returning `null` rather than throwing
 *
 * A record that fails is not a storage failure. Nothing went wrong reading the
 * database; what came back is not usable. Throwing would report a working store
 * as broken, and the caller's correct response to the two is different.
 *
 * ## And the record is left where it is
 *
 * This function has no way to delete, and that is deliberate rather than
 * convenient. Deleting on a failed narrow looks tidy and is irreversible data loss
 * caused by a code bug: `isMailbox` requires a `status` field, so any future model
 * change that added or renamed one would destroy every stored mailbox the first
 * time this code ran. The record stays readable by a build that understands it,
 * and M6's privacy controls delete it when a user asks — on purpose, by a path
 * whose user is watching.
 */
export function readStoredMailboxRecord(value: unknown): Mailbox | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<StoredMailboxRecord>;

  // An unknown version is not corruption, and reporting it as such would invite
  // the discard D3 exists to prevent.
  if (candidate.version !== SPECTRE_RECORD_VERSION) {
    return null;
  }

  return isMailbox(candidate.mailbox) ? candidate.mailbox : null;
}

/**
 * The collection to write for `mailboxes`, given in the order they should be read.
 *
 * Wraps each member in {@link toStoredMailboxRecord} rather than accepting records, because
 * every caller of this function has a `Mailbox` and none has ever had a `StoredMailboxRecord` —
 * and a function taking the stored shape would invite a caller to build one by hand, which is the
 * one thing the envelope exists to stop.
 */
export function toStoredMailboxCollection(mailboxes: readonly Mailbox[]): StoredMailboxCollection {
  return {
    version: SPECTRE_ENVELOPE_VERSION,
    mailboxes: mailboxes.map(toStoredMailboxRecord),
  };
}

/**
 * The mailboxes in `value`, in the order they were written, or `null` if it is not a collection
 * this build can use.
 *
 * ## Three outcomes, and they are deliberately not two
 *
 * - **`null`** — the envelope itself is unusable: not an object, a version this build does not
 *   write, or no `mailboxes` array. The caller cannot tell what was stored.
 * - **`[]`** — the envelope is fine and holds nothing this build can read. "This device holds no
 *   mailbox" is the safe reading, because the alternative is offering an address that cannot be
 *   narrowed.
 * - **a list** — the members that could be read, in the order they were written.
 *
 * ## A member that fails is skipped, never deleted
 *
 * Every member goes through {@link readStoredMailboxRecord}, so the rule this file already states
 * for a single record holds for each of them: nothing is deleted here, and there is no way to
 * delete from this function. Skipping rather than discarding is what lets one unreadable member
 * cost one mailbox instead of all of them, and **it is why the collection holds records rather than
 * bare mailboxes** — see {@link StoredMailboxCollection}.
 */
export function readStoredMailboxCollection(value: unknown): Mailbox[] | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<StoredMailboxCollection>;

  if (candidate.version !== SPECTRE_ENVELOPE_VERSION) {
    return null;
  }

  if (!Array.isArray(candidate.mailboxes)) {
    return null;
  }

  const read: Mailbox[] = [];
  for (const member of candidate.mailboxes) {
    // **The member itself is narrowed, not its `mailbox` field.** `readStoredMailboxRecord` takes
    // the *record*, and the envelope exists so that this same function can be pointed at a whole
    // member. Passing the inner value instead would be a second, wrong answer to "what is a usable
    // stored mailbox", and it fails silently: every member narrows to `null` and the collection
    // reads as empty rather than as broken.
    const mailbox = readStoredMailboxRecord(member);
    if (mailbox !== null) {
      read.push(mailbox);
    }
  }

  return read;
}

/**
 * The collection with `mailbox` at its front, **preserving every stored member this build cannot
 * read.**
 *
 * ## Why this exists rather than a `filter` at the call site
 *
 * `readStoredMailboxCollection` deliberately *skips* a member it cannot narrow, so the list it
 * returns is not the record as stored. Recording a new mailbox by rebuilding from that list
 * therefore **deletes** the members the narrowing dropped - the same irreversible loss on a failed
 * narrow that {@link readStoredMailboxRecord} exists to prevent, arriving through a function whose
 * whole design is about not doing it. The writer cannot be the reader's output for exactly the
 * reason the reader is not a round trip.
 *
 * {@link toStoredSiteAssociations} states the same rule for the other record ("a writer that
 * rebuilt this record from the entries it could read would delete the ones it could not"), and its
 * caller complies by spreading the stored object rather than the narrowed map. This is the same
 * defence for the collection.
 *
 * ## What it does with each stored member
 *
 * - **readable and a different id** - kept, behind `mailbox`;
 * - **readable and the same id** - dropped, because recording a mailbox a device already holds
 *   moves it rather than duplicating it;
 * - **not readable** - kept **verbatim**, because this build cannot know what it is and the only
 *   safe action is to leave it where it is.
 *
 * @returns The record to write, or `null` when `record` is not an envelope this build can use -
 *   in which case the caller must refuse the write rather than replace the record.
 */
export function prependStoredMailbox(
  record: unknown,
  mailbox: Mailbox,
): StoredMailboxCollection | null {
  if (typeof record !== "object" || record === null) {
    return null;
  }

  const candidate = record as Partial<StoredMailboxCollection>;
  if (candidate.version !== SPECTRE_ENVELOPE_VERSION || !Array.isArray(candidate.mailboxes)) {
    return null;
  }

  const kept: unknown[] = [];
  for (const member of candidate.mailboxes) {
    const narrowed = readStoredMailboxRecord(member);
    if (narrowed !== null && narrowed.id === mailbox.id) {
      continue;
    }
    kept.push(member);
  }

  return {
    version: SPECTRE_ENVELOPE_VERSION,
    mailboxes: [toStoredMailboxRecord(mailbox), ...kept],
  };
}

/**
 * The association record to write for `sites`, whose keys are hosts exactly as the browser reports them.
 *
 * **`unknown` values are accepted, and that is not laxity.** A writer that rebuilt this record from
 * the entries it could read would delete the ones it could not — so the value type is deliberately
 * wider than the value type {@link readStoredSiteAssociations} returns, and the difference between
 * the two is the whole reason a narrowing is not a round trip.
 */
export function toStoredSiteAssociations(
  sites: Readonly<Record<string, unknown>>,
): StoredSiteAssociations {
  return { version: SPECTRE_ENVELOPE_VERSION, sites: { ...sites } };
}

/**
 * The hosts and mailbox ids in `value`, or `null` if it is not an association record this build can
 * use.
 *
 * ## Entries that cannot be read are dropped; the record is not
 *
 * An entry whose value is not a non-empty string is left where it is and not returned, for the
 * reason the rest of this file gives: deleting on a failed narrow is irreversible data loss caused
 * by a code bug. One unreadable entry costs one host.
 *
 * ## The keys are not validated, and that is the decision worth defending
 *
 * A key is accepted as whatever string it is. **A rule for what a host looks like is a rule this
 * product cannot write correctly** — IPv6 literals, punycode, and IDN hosts all fail a naive
 * pattern — and a rule that guessed wrong would drop a real association while looking like the
 * narrowing that protects one. The key's shape is the platform's to report and the caller's to
 * pass; what this function checks is that the record holds ids it can hand back.
 */
export function readStoredSiteAssociations(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<StoredSiteAssociations>;

  if (candidate.version !== SPECTRE_ENVELOPE_VERSION) {
    return null;
  }

  const sites = candidate.sites;
  if (typeof sites !== "object" || sites === null || Array.isArray(sites)) {
    return null;
  }

  const read: Record<string, string> = {};
  for (const [host, mailboxId] of Object.entries(sites)) {
    if (typeof mailboxId === "string" && mailboxId.length > 0) {
      read[host] = mailboxId;
    }
  }

  return read;
}
