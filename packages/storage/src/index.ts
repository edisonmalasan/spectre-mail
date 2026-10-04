/**
 * `@spectre-mail/storage` — persistence contracts and platform adapters.
 *
 * Owns: the shared `SpectreStorage` contract, and the IndexedDB adapter that
 * implements it for the website. The extension's `chrome.storage` adapter is M8
 * and is deliberately absent: `apps/extension` is still an empty placeholder, and
 * `chrome.storage` has no transactions, so its adapter will not resemble this one
 * except in the contract it serves.
 *
 * ## No client consumes this package yet
 *
 * This is stated first because it is the fact most likely to be misread. M6 slice
 * 1 builds and verifies the layer; the slice that follows wires a client to it and
 * amends `mailbox-session`'s *A reload loses the session* scenario in the same
 * change as the behaviour. Until then **a reload still discards the mailbox**,
 * exactly as it did at M5.
 *
 * The precedent is M4: `packages/mail-parser` shipped fully verified with "No
 * client consumes it yet", and the alternative — a client wired against a contract
 * with no tests of its own — is how a seam becomes decorative.
 *
 * ## Why the contract is shaped the way it is
 *
 * The M1 placeholder this file replaced already named the constraint, and it was
 * right: "an expired Guerrilla session is reported as an empty inbox with no auth
 * error, so 'no messages' and 'session gone' are indistinguishable at the storage
 * layer. A contract that stores only a message list cannot represent that." The
 * trap is real and measured (`docs/PROVIDERS.md` §3, "Expired sessions fail
 * silently — a real data-loss trap"), and `packages/providers/src/guerrilla.ts`
 * implements the check that keeps `listMessages` from returning an empty list for a
 * session the provider no longer honours.
 *
 * So `loadMailbox` reserves `null` for one meaning and reports every failure as a
 * rejection. A read reported as "nothing stored" makes a client believe it is a
 * first visit, create a new mailbox, and overwrite the address the user came back
 * for, with no error anywhere.
 *
 * ## Boundary
 *
 * This is the **one** package in the workspace whose `tsconfig` declares `DOM`,
 * because it is the only one whose job is to speak to a platform API. Two rules in
 * `tests/architecture/boundaries.test.ts` hold both halves of that: no other
 * shared package may name a platform storage API, and no shared package may depend
 * on this one. Neither is enforced by the compiler — `@types/node` declares
 * `localStorage`, `sessionStorage`, and `navigator` in every package here, which
 * was measured — so both rules say what they can and cannot check.
 *
 * This package must never import from `apps/web` or `apps/extension`.
 *
 * @module
 */

export type { SpectreStorage } from "./contract";

export { SPECTRE_RECORD_VERSION, readStoredMailboxRecord, toStoredMailboxRecord } from "./record";
export type { StoredMailboxRecord } from "./record";

export { createIndexedDbStorage, CURRENT_MAILBOX_KEY, SPECTRE_DATABASE_VERSION } from "./indexeddb";
export type { IndexedDbStorageOptions } from "./indexeddb";
