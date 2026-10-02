/**
 * `@spectre-mail/mailbox` — mailbox session orchestration.
 *
 * Owns: creating a mailbox through the provider abstraction, replacing it,
 * reporting the owning provider's health, and normalizing a failure.
 *
 * ## Why this package exists
 *
 * M0–M4 built a provider abstraction, a domain model, and a parser. None of them
 * is the thing a user touches, and the sequence that turns them into one — create
 * a mailbox, show it, replace it, ask how the provider is doing — had no home.
 *
 * The roadmap's shared-package list assigns "mailbox lifecycle" and "mailbox
 * manager" to `@spectre-mail/core`, but `shared-domain-model`'s approved purpose
 * states that capability describes "the model and its invariants only" and
 * excludes lifecycle behaviour. Both cannot be true, and the spec is the contract.
 *
 * The alternative was writing this inside `apps/web`, which would leave M8's
 * extension to rewrite the same behaviour and guarantee the two diverge.
 *
 * ## What it deliberately does not do
 *
 * - **No framework, no DOM, no storage, no network.** The package's `tsconfig`
 *   sets `lib: ["ES2023"]` with no `DOM`, so a browser global fails to compile —
 *   the compiler enforces the boundary, not only the source scan in
 *   `tests/architecture/boundaries.test.ts`. It reads no storage, no cookie, and
 *   nothing from the URL.
 * - **No state between calls.** Every operation returns a new immutable
 *   `SessionState`; nothing is mutated in place.
 * - **No parsing.** Turning a message into readable text and detections is
 *   `@spectre-mail/mail-parser`'s job, and it stays there.
 * - **No polling.** There is no push transport to subscribe to — five SSE paths
 *   and two WebSocket paths were probed and none connected — so the cadence
 *   belongs to the client, which is the only layer that knows whether a tab is
 *   visible.
 * - **No provider selection of its own.** Which providers exist is the client's
 *   decision, because reachability is a property of the host environment.
 *
 * The package is consumed **as TypeScript source** (see its `exports`), so it has
 * no build step. Its correctness is established by `pnpm typecheck` and
 * `pnpm test`; a successful `pnpm build` builds the website only and says nothing
 * about this package.
 *
 * @module
 */

export { createMailboxSession } from "./session";
export type { MailboxSession } from "./session";

export { isCreating, isFailed, isReady } from "./state";
export type { ProviderFailure, SessionFailure, SessionState } from "./state";

export type { ProviderHealth } from "./state";
