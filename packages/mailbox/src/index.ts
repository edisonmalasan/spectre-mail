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
 *   the compiler enforces that half of the boundary, not only the source scan in
 *   `tests/architecture/boundaries.test.ts`. It reads no storage, no cookie, and
 *   nothing from the URL.
 * - **No clock of its own.** `MailboxScheduler` is injected and is the only thing
 *   about time this package knows. It does **not** stop a timer global the same way
 *   the missing `DOM` lib stops a DOM one: `@types/node` declares `setTimeout`,
 *   `Date`, and `performance` in exactly the way it declares `navigator`, which
 *   slice 1's verification pass measured compiling here. A rule in the boundary
 *   scan holds that half, and the rules file says so.
 * - **No state between calls.** Every operation returns a new immutable
 *   `SessionState`; nothing is mutated in place.
 * - **No provider selection of its own.** Which providers exist is the client's
 *   decision, because reachability is a property of the host environment.
 *
 * ## Polling, since slice 2
 *
 * The package polls, because there is no push transport to subscribe to — five SSE
 * paths and two WebSocket paths were probed and none connected. Two consequences
 * are worth knowing before changing anything here:
 *
 * - **The cadence is the product's own number.** `docs/PROVIDERS.md` records
 *   Mail.tm's `30; w=60` *measured unauthenticated only*, and Mail.tm is
 *   unreachable from a web page in any case; Guerrilla Mail, the only provider a
 *   browser page can reach, publishes no limit and none was measured. So the
 *   intervals in `cadence.ts` are ours, and a provider's own statement is treated
 *   as a floor the cadence never schedules beneath.
 * - **A throttled listing stops the loop** rather than backing off. Retrying
 *   invisibly is the silent retry `provider-abstraction` forbids, so the caller is
 *   given the failure and decides.
 *
 * The parser is reached in exactly one direction — this package calls
 * `@spectre-mail/mail-parser`, and no client calls the parser directly — and the
 * boundary scan asserts that direction rather than trusting it.
 *
 * ## Opening a message, since slice 3
 *
 * The inbox already reads every new arrival to decide its verdict, so a message the
 * session has seen can be opened **without a provider request at all**. That retention
 * is deliberately bounded to the current listing and holds only *readable* text — never
 * the body as received, which is an HTML document in the one case that was measured. A
 * client cannot reach the parser to do its own reading, so the projection here is the
 * only way a client sees a message's contents, and a message view cannot become a
 * second, differently-detecting implementation.
 *
 * The package is consumed **as TypeScript source** (see its `exports`), so it has
 * no build step. Its correctness is established by `pnpm typecheck` and
 * `pnpm test`; a successful `pnpm build` builds the website only and says nothing
 * about this package.
 *
 * @module
 */

export { INBOX_POLL_CEILING_MS, INBOX_POLL_PROMPT_MS, nextDelay } from "./cadence";
export type { Cancel, MailboxScheduler } from "./clock";
export { createMailboxSession } from "./session";
export type { MailboxSession } from "./session";

export {
  isCreating,
  isFailed,
  isInboxCheckFailed,
  isInboxChecked,
  isInboxChecking,
  isInboxNotStarted,
  isMessageOpenFailed,
  isMessageOpened,
  isMessageOpening,
  isNoMessageOpen,
  isReady,
  openedOf,
  verdictFor,
} from "./state";
export type {
  InboxListing,
  InboxState,
  MessageVerdict,
  OpenedMessage,
  OpenedMessageState,
  ProviderFailure,
  SessionFailure,
  SessionState,
} from "./state";

export type { ProviderHealth } from "./state";
