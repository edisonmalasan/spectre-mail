/**
 * `@spectre-mail/storage` — persistence contracts and platform adapters.
 *
 * Owns: the shared `SpectreStorage` contract, and the IndexedDB adapter that
 * implements it for the website plus the `chrome.storage` adapter that implements
 * it for the extension. **M8 added the second one**, beside this one rather than
 * inside a client: `chrome.storage` has no transactions, so its adapter does not
 * resemble the IndexedDB one except in the contract it serves, and the differences
 * are documented in `./chrome.ts` rather than smoothed over. Both platforms narrow
 * a stored record through the *same* `readStoredMailboxRecord`, so a record neither
 * can read is neither surfaced nor deleted by either.
 *
 * ## Two ways in, and why there are two
 *
 * `createIndexedDbStorage` takes an injected `IDBFactory` and **has no default**,
 * because `globalThis.indexedDB` compiles in every package in this workspace and a
 * default would be a path that runs only where a browser happens to provide one.
 * `createBrowserStorage` is the browser-facing entry point: it reads that global
 * **inside this layer** and hands it over.
 *
 * The second exists because this package is the only place a client is permitted to
 * reach a platform store, and the website is the first client that needs to. Its
 * module note sets out the two rejected alternatives, one of which was to weaken the
 * boundary rule below to match what is actually scanned.
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
 * **A third rule covers the clients**, added when the website became the first one to
 * want a store: no file under `apps/` may name a platform storage API either. Before
 * it, the enforced rule scanned `packages/*` only while the requirement text said
 * "no client and no shared package" — a requirement broader than its own check, which
 * is the gap this repository has now recorded eighteen times.

**The extension's adapter is why that rule needed no second carve-out.** `apps/extension`
reaches storage through this package, and the one platform global it names is
`chrome.storage` — which the client rule does not match anyway, since it is neither a DOM
store nor a cookie jar. Putting the adapter here rather than in the client is what keeps
that true: a client-local adapter would have required weakening the rule to match what
was actually scanned, which is the repair `browser.ts`'s module note rejects in prose.
 *
 * This package must never import from `apps/web` or `apps/extension`.
 *
 * @module
 */

export type { SpectreStorage } from "./contract";

export { createBrowserStorage } from "./browser";

export { createChromeStorage, EXTENSION_MAILBOX_KEY } from "./chrome";
export type { ChromeStorageOptions } from "./chrome";
export type { ChromeStorageArea } from "./chrome-api";

export { SPECTRE_RECORD_VERSION, readStoredMailboxRecord, toStoredMailboxRecord } from "./record";
export type { StoredMailboxRecord } from "./record";

export { createIndexedDbStorage, CURRENT_MAILBOX_KEY, SPECTRE_DATABASE_VERSION } from "./indexeddb";
export type { IndexedDbStorageOptions } from "./indexeddb";
