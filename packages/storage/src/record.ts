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
