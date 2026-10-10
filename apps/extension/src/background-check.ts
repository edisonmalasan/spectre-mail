/**
 * One wake of the background check: list the watched mailbox once, and announce what arrived.
 *
 * ## What a wake is, and what it is measured against
 *
 * `chrome.alarms` fires this every `INBOX_POLL_PROMPT_MS`, and each firing costs **one** provider
 * request - twelve a minute - against a `GET /messages` budget of `30; w=60` that
 * `docs/PROVIDERS.md` records as **measured unauthenticated only**. The shared session's cadence is
 * read from `packages/mailbox` rather than restated, for the reason `alarms.ts` records.
 *
 * **A wake takes one listing and never opens a message.** Opening one is a second request per
 * notification to obtain a body this slice has no use for, and it is what would put a one-time code
 * in front of a lock screen - see `notification.ts` for why the exclusion is structural rather than
 * a filter.
 *
 * ## The session is built per wake and released, never held
 *
 * This module takes a **function** that lists a mailbox rather than a session, because
 * `extension-client` requires the worker to hold nothing between wakes and an MV3 background worker
 * is idle-terminated at a **bound** rather than a lifetime anyone here has measured
 * (`docs/PROVIDERS.md` §4.1.1). Holding a session as a value would mean holding it in a context whose
 * death is unmeasured. {@link createExtensionListingReader} is the shape `create-mailbox.ts` already
 * establishes for creation, including the `finally` that is the only call stopping the scheduler.
 *
 * ## A failed check changes nothing, and that is a decision rather than an absence of code
 *
 * Every arm below either writes or does not, and the ones that do not are the ones worth reading. A
 * provider that could not be reached **will** be reachable again, and a check that shrank the record
 * on failure would make the next successful one announce the entire mailbox a second time. The same
 * reasoning holds for a record that could not be read: reading it as empty is the `loadMailbox` trap
 * in `packages/storage`, one step on.
 *
 * @module
 */

import type { Mailbox, MessageSummary } from "@spectre-mail/core";
import { createMailboxSession, isExpired, isReady } from "@spectre-mail/mailbox";
import type { InboxListing, MailboxSession, SessionState } from "@spectre-mail/mailbox";
import type { ProviderManager, Transport } from "@spectre-mail/providers";

import { createExtensionProviderManager } from "./provider-config";
import { extensionScheduler } from "./scheduler";
import { loadInsertableMailboxes } from "./storage";
import type { ExtensionRecords } from "./storage";

/**
 * Announce one message and report whether the platform accepted the request.
 *
 * **Named for what it promises rather than for the API behind it**, so a caller and a test cannot
 * read "the notification was raised" as "a person was told": this is the boolean `notification.ts`
 * documents as a **refusal flag, not a delivery receipt**.
 */
export type AnnounceMessage = (message: MessageSummary) => Promise<boolean>;

/** What one listing attempt produced, and every arm is one the session can actually return. */
export type MailboxListingOutcome =
  | { readonly kind: "listed"; readonly listing: InboxListing }
  | { readonly kind: "expired" }
  | { readonly kind: "unavailable"; readonly reason: string };

/**
 * What one wake found and did.
 *
 * **A union rather than a boolean, because the arms differ in their consequences for the alarm and
 * for the record**, and a `boolean` would throw away the only information the caller acts on.
 *
 * - `no-mailbox` - this device holds nothing to watch, and no alarm is armed behind it.
 * - `empty-mailbox` - the mailbox holds no messages. **Nothing is announced and nothing is written**;
 *   see {@link runBackgroundCheck} for why the second half is a fact about the record contract.
 * - `baseline` - no prior record, so one was written and **nothing was announced**. This is what
 *   makes "arrived since the last check" true rather than "is present".
 * - `announced` - at least one notification was **attempted**. **`withheld` is the half worth
 *   reading:** it names the messages the platform refused, and their ids are left out of the record so
 *   a later wake raises them again.
 * - `unchanged` - nothing new to announce and the record already said what the listing says, so
 *   **no notification and no write**.
 * - `pruned` - nothing new to announce, but an id the provider no longer reports was dropped from the
 *   record. **Its own arm rather than a flag on `announced`**, because an arm claiming a notification
 *   was raised when none was is the same defect as a record that advanced on a refused one.
 * - `expired` - the provider reported the mailbox gone. The alarm is cleared and **the stored
 *   mailbox is left exactly where it is**, because a provider's word about a mailbox is not this
 *   product's authority to delete the user's record of it.
 * - `failed` - the provider could not be reached, or the record could not be read or written.
 *   **Nothing changed and the alarm stays.**
 */
export type BackgroundCheckOutcome =
  | { readonly kind: "no-mailbox" }
  | { readonly kind: "empty-mailbox" }
  | { readonly kind: "baseline"; readonly recorded: number }
  | {
      readonly kind: "announced";
      /** Ids the platform accepted, in the order the listing gave them. */
      readonly raised: readonly string[];
      /** Ids the platform refused. **Not** recorded, so a later wake raises them again. */
      readonly withheld: readonly string[];
    }
  | { readonly kind: "unchanged" }
  | { readonly kind: "pruned"; readonly removed: readonly string[] }
  | { readonly kind: "expired" }
  | { readonly kind: "failed"; readonly reason: string };

/** What a wake needs, and nothing else. Each member is a reason to be able to refuse it. */
export interface BackgroundCheckDependencies {
  /** List one mailbox through the provider that owns it, releasing the session before resolving. */
  readonly listMailbox: (mailbox: Mailbox) => Promise<MailboxListingOutcome>;
  /**
   * The ids this device was last told about for a mailbox, or `null` when none are recorded.
   *
   * **Rejects when the record could not be read, and that is the answer that matters**: `null` means
   * nothing is recorded and is the baseline, while a rejection must leave the record untouched. A
   * read reported as empty would make this wake announce a mailbox in full.
   */
  readonly loadSeenMessageIds: (mailboxId: string) => Promise<readonly string[] | null>;
  /** Replace one mailbox's whole set. See the empty-list note in {@link runBackgroundCheck}. */
  readonly saveSeenMessageIds: (mailboxId: string, ids: readonly string[]) => Promise<void>;
  /** Raise one notification. See {@link AnnounceMessage}. */
  readonly announce: AnnounceMessage;
  /** Clear the background alarm. Called **only** for a mailbox the provider reported gone. */
  readonly clearAlarm: () => Promise<void>;
}

/**
 * Read the listing out of a session's state, naming the states this cannot answer.
 *
 * **`checkFailed` is treated as unavailable rather than as its retained listing**, and the retained
 * listing is exactly why: it is the *previous* check's reading, and a wake that announced from it
 * would be announcing a listing it never took.
 *
 * **`notStarted` is unreachable for a restored mailbox and is handled rather than assumed** - the
 * repository's own idiom for a compiler-forced branch, recorded on `fill.ts` in `in-page-fill`. A
 * fall-through here would report an empty mailbox for a mailbox nobody had listed.
 */
function listingFromState(state: SessionState): MailboxListingOutcome {
  if (isExpired(state)) {
    return { kind: "expired" };
  }

  if (!isReady(state)) {
    return { kind: "unavailable", reason: `the session reported ${state.kind}` };
  }

  if (state.inbox.kind === "notStarted") {
    return { kind: "unavailable", reason: "the session listed nothing" };
  }

  if (state.inbox.kind === "checkFailed") {
    return { kind: "unavailable", reason: state.inbox.failure.description };
  }

  return { kind: "listed", listing: state.inbox.listing };
}

/**
 * The two things a wake's session is asked to do, and nothing else.
 *
 * **Narrower than `MailboxSession` on purpose.** It is what makes "never `openMessage`, never
 * `analyseMessage`" a property of the *type* a wake is built from rather than a promise about the
 * code: a module holding this cannot reach the other members even by accident, and a test can pass a
 * session that has only these two.
 */
export type WakeSession = Pick<MailboxSession, "restore" | "destroy">;

/**
 * Builds one wake's session from a provider manager.
 *
 * **A parameter, for the reason `createExtensionStorage` takes its adapter factories as one**: a
 * test can drive every arm of the state union — including `expired`, `restoreFailed`, and the
 * variants `restore` cannot itself return — without a provider, a transport, or a network. The
 * default is the real factory, and it is what production gets.
 */
export type WakeSessionFactory = (manager: ProviderManager) => WakeSession;

/**
 * Build the per-wake listing reader, over a transport this context owns.
 *
 * **The manager and the session are built inside the returned function and released in a `finally`**,
 * which is `createExtensionMailboxOpener`'s shape copied rather than a new one invented here: a
 * session that outlived its wake would poll from inside a worker whose lifetime is a bound.
 *
 * @param transport - The provider transport. Read per wake, never captured from an earlier one.
 * @param buildSession - Overrides how the session is built. A parameter so a test can reach every
 *   state `restore` can return; production passes nothing.
 */
export function createExtensionListingReader(
  transport: Transport,
  buildSession: WakeSessionFactory = (manager) => createMailboxSession(manager, extensionScheduler),
): (mailbox: Mailbox) => Promise<MailboxListingOutcome> {
  return async (mailbox) => {
    const manager = createExtensionProviderManager(transport);
    const session = buildSession(manager);

    try {
      // **`restore`, never `open`.** `open` asks a provider for an address to create, and this wake
      // has been given the address already; `restore` reconciles a stored mailbox through the
      // provider that owns it and returns the listing as the inbox's own first listing.
      return listingFromState(await session.restore(mailbox));
    } finally {
      session.destroy();
    }
  };
}

/** Whether two id lists hold the same ids, whatever order they are in. */
function holdsSameIds(here: readonly string[], there: readonly string[]): boolean {
  if (here.length !== there.length) {
    return false;
  }

  const held = new Set(here);
  return there.every((id) => held.has(id));
}

/** Turn whatever was thrown into a sentence, because an outcome's `reason` is read by a test. */
function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return String(cause);
}

/**
 * Run one wake over a mailbox this device already chose, and report what it did.
 *
 * ## The order of the arms, and why the empty mailbox is checked first
 *
 * An empty listing reaches no arm below it usefully: there is nothing to baseline, nothing to
 * announce, and nothing to write. So it is answered before the record is even read, which also means
 * **an empty mailbox costs one listing and no storage traffic at all**.
 *
 * ## Why an empty result is never written
 *
 * `SpectreSeenMessages.saveSeenMessageIds` **refuses an empty list**, because `loadSeenMessageIds`
 * answers `null` for a mailbox it has no entry for - storing `[]` would be a second spelling of "no
 * record". So a mailbox that empties keeps whatever it had recorded. **That is recorded as a
 * divergence from the delta's prune clause and amended there during apply**, with the reason: the
 * stale ids cost nothing, because the requirement already names the trade that a message leaving a
 * listing and returning is announced again either way.
 *
 * @param watched - The mailbox to check, or `null` when this device holds none.
 * @param dependencies - The seams this wake acts through.
 */
export async function runBackgroundCheck(
  watched: Mailbox | null,
  dependencies: BackgroundCheckDependencies,
): Promise<BackgroundCheckOutcome> {
  if (watched === null) {
    return { kind: "no-mailbox" };
  }

  const listed = await dependencies.listMailbox(watched);

  if (listed.kind === "expired") {
    await dependencies.clearAlarm();
    return { kind: "expired" };
  }

  if (listed.kind === "unavailable") {
    return { kind: "failed", reason: listed.reason };
  }

  const present = listed.listing.messages.map((message) => message.id);

  if (present.length === 0) {
    return { kind: "empty-mailbox" };
  }

  let recorded: readonly string[];
  try {
    const read = await dependencies.loadSeenMessageIds(watched.id);

    if (read === null) {
      await dependencies.saveSeenMessageIds(watched.id, present);
      return { kind: "baseline", recorded: present.length };
    }

    recorded = read;
  } catch (cause) {
    // **A read that failed and a read that found nothing are different answers, and only one of them
    // may be acted on.** This is the `loadMailbox` rule in `packages/storage`, applied to a record
    // that decides what a person is told.
    return { kind: "failed", reason: describeCause(cause) };
  }

  const held = new Set(recorded);
  const raised: string[] = [];
  const withheld: string[] = [];

  for (const message of listed.listing.messages) {
    if (held.has(message.id)) {
      continue;
    }

    // **Awaited one at a time, in listing order.** Each `create` resolves against the platform, so
    // firing them together would ask for several notifications whose order the platform decides - and
    // the order a person's notification centre shows is the order they read them in.
    const accepted = await dependencies.announce(message);
    (accepted ? raised : withheld).push(message.id);
  }

  const raisedSet = new Set(raised);

  /**
   * **Kept in the listing's order and pruned to it, so the record stays bounded by the mailbox.**
   *
   * An id that was held and is still present stays; an id the provider no longer reports goes; an id
   * whose notification was refused goes **now** and is therefore raised again later. The last is the
   * one that matters - it is the property `in-page-fill` found in a control that removed itself from
   * the page without telling its caller, here in a record that would have swallowed the retry.
   */
  const next = present.filter((id) => held.has(id) || raisedSet.has(id));

  /** Whether anything was asked of the platform, as distinct from whether anything succeeded. */
  const attempted = raised.length > 0 || withheld.length > 0;
  const changed = !holdsSameIds(recorded, next);

  /**
   * **Written before the outcome is chosen, and only when the set actually changed.**
   *
   * The order matters and it is the other way round from the obvious one. A reader that decided
   * "quiet" first and returned early would report *nothing happened* for a wake that had just been
   * refused a notification - and this repository's own `in-page-fill` finding is a control that
   * removed itself from the page without telling its caller, in the same shape. **`withheld` exists
   * so that refusal has somewhere to go**, and an arm that collapsed it into "unchanged" would
   * swallow exactly the information the next wake needs.
   *
   * A refused notification with an otherwise unchanged record therefore costs **no write**, because
   * `saveSeenMessageIds` replaces the whole set and replacing it with itself is not a change.
   */
  if (changed) {
    try {
      await dependencies.saveSeenMessageIds(watched.id, next);
    } catch (cause) {
      // **Raised and not recorded.** The next wake will raise it again, which is the same answer the
      // `withheld` arm gives, reached by a different cause.
      return { kind: "failed", reason: describeCause(cause) };
    }
  }

  if (attempted) {
    return { kind: "announced", raised, withheld };
  }

  if (changed) {
    const kept = new Set(next);
    return { kind: "pruned", removed: recorded.filter((id) => !kept.has(id)) };
  }

  return { kind: "unchanged" };
}

/** What a composed wake needs from its caller. */
export interface BackgroundCheckOptions {
  readonly transport: Transport;
  readonly records: ExtensionRecords;
  readonly announce: AnnounceMessage;
  readonly clearAlarm: () => Promise<void>;
}

/**
 * Compose a wake from this context's storage and platform.
 *
 * **The watched mailbox is the head of {@link loadInsertableMailboxes}** rather than a second
 * ordering invented here, so the mailbox the background check watches is the mailbox a visitor is
 * handed - `design.md` D6, and the reason the question is asked in one function rather than three.
 *
 * @param options - The platform seams and the records this context reads.
 * @param listMailbox - Overrides how a mailbox is listed, for the reason
 *   {@link createExtensionListingReader} takes its session factory: a composition whose only subject
 *   is *which mailbox it chose* cannot otherwise be observed, because a real listing needs a provider.
 *   Production passes nothing.
 */
export function createBackgroundCheck(
  options: BackgroundCheckOptions,
  listMailbox: (mailbox: Mailbox) => Promise<MailboxListingOutcome> = createExtensionListingReader(
    options.transport,
  ),
): () => Promise<BackgroundCheckOutcome> {
  return async () => {
    // **A load that rejects reaches the same place a failure anywhere else does**, and is handled
    // here rather than escaping into an alarm listener, where an unhandled rejection would be a
    // worker that logged and stopped.
    let watched: Mailbox | null;
    try {
      watched = (await loadInsertableMailboxes(options.records))[0] ?? null;
    } catch (cause) {
      return { kind: "failed", reason: describeCause(cause) };
    }

    return runBackgroundCheck(watched, {
      listMailbox,
      loadSeenMessageIds: (mailboxId) => options.records.seen.loadSeenMessageIds(mailboxId),
      saveSeenMessageIds: (mailboxId, ids) =>
        options.records.seen.saveSeenMessageIds(mailboxId, ids),
      announce: options.announce,
      clearAlarm: options.clearAlarm,
    });
  };
}
