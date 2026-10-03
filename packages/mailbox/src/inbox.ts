/**
 * The inbox tracker.
 *
 * Owns the loop: when to ask the owning provider for its messages, when to stop,
 * and which messages have already been read. The session owns the mailbox; this
 * owns everything about the list of what is in it.
 *
 * **It schedules, it never requests.** Every provider call in this file goes
 * through a `MailProvider` handed in by the session, which is what keeps the
 * "reaches no network directly" requirement true of the polling path as well as of
 * the creation path - the temptation when a loop starts is to reach for `fetch`, and
 * the boundary rule for that now covers these modules too.
 *
 * **The cadence is decided by `nextDelay` and by nothing here.** The floor a provider
 * can impose is a lower bound on that decision, never a replacement for it: see
 * `cadence.ts` for why these intervals are the product's own numbers.
 *
 * @module
 */

import { analyseMessage } from "@spectre-mail/mail-parser";
import type { MessageAnalysis } from "@spectre-mail/mail-parser";
import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, Message, MessageSummary } from "@spectre-mail/core";
import type { MailProvider } from "@spectre-mail/providers";

import { nextDelay } from "./cadence";
import type { MailboxScheduler } from "./clock";
import { toSessionFailure } from "./failure";
import type { InboxListing, InboxState, MessageVerdict } from "./state";

/** How the tracker reaches the provider that owns a mailbox. */
export interface InboxTrackerOptions {
  /**
   * The caller supplies this rather than importing the manager, so this module holds
   * no reference to how providers are chosen - it is handed the one that owns the
   * mailbox and never goes looking for another.
   */
  readonly providerFor: (mailbox: Mailbox) => MailProvider;
  readonly scheduler: MailboxScheduler;
  /**
   * Called on every publish, so an owner holding this state in a larger structure
   * stays current.
   *
   * Without it the owner would have to refresh only after a call it made, and the
   * transition into `checking` - published synchronously, before the provider has
   * answered - would never reach a client. That state is the difference between a
   * page that says it is checking and one that looks frozen.
   */
  readonly onChange?: (state: InboxState) => void;
  /**
   * Called once per newly read message, with what the read found.
   *
   * **This is the only reason the opened-message tracker can serve a message without
   * asking the provider again**, so the read here and the reading there cannot drift
   * apart: one read, two consumers.
   *
   * A callback rather than a dependency on `opened.ts`, so this module never learns that
   * a retention exists. That matters for the reason `providerFor` is injected too — the
   * inbox tracker holds no reference to what consumes it, and either of them can be
   * built and tested without the other.
   */
  readonly onRead?: (summary: MessageSummary, analysis: MessageAnalysis) => void;
  /**
   * Called after a successful listing, with the summaries it reported.
   *
   * **Only ever called on success**, which is what makes the retention's pruning honest:
   * a failed listing learned nothing about which messages exist, so pruning against it
   * would shed readings for a mailbox the product merely failed to ask.
   */
  readonly onListed?: (summaries: readonly MessageSummary[]) => void;
}

export interface InboxTracker {
  /** What the inbox currently holds. Never a promise; never partially built. */
  readonly state: InboxState;

  /**
   * Tell the tracker whether anything is displaying the inbox.
   *
   * `false` stops the loop immediately, cancelling anything already scheduled rather
   * than merely declining to schedule more - a tab that was hidden for an hour has no
   * use for the check that was pending when it was hidden.
   */
  setVisible(visible: boolean): void;

  /**
   * Ask the owning provider for its messages now, and report what came back.
   *
   * Public because the requirement is written from the caller's side: a caller may
   * ask for a listing at any time, and this is also the only way back after a
   * throttled refusal, which halts the loop rather than backing off.
   */
  check(mailbox: Mailbox | undefined): Promise<InboxState>;

  /**
   * Forget everything about the previous mailbox.
   *
   * Verdicts are keyed by message id and message ids are provider-scoped, so carrying
   * them across a mailbox change would attach one mailbox's analysis to another's
   * message that happened to share an id.
   */
  reset(): void;

  /** Cancel anything pending. The tracker stays readable; it simply stops. */
  destroy(): void;
}

export function createInboxTracker(options: InboxTrackerOptions): InboxTracker {
  const { providerFor, scheduler, onChange, onRead, onListed } = options;

  let state: InboxState = { kind: "notStarted" };
  let verdicts = new Map<string, MessageVerdict>();

  /** Consecutive checks whose message ids matched the previous check's. */
  let unchangedInARow = 0;
  let visible = true;
  let cancelPending: (() => void) | undefined;

  /**
   * The longest delay a provider has asked us to wait, in milliseconds.
   *
   * **Sticky once set.** A provider that throttles us has told us something about
   * its limits that our own cadence knows nothing about, and the conservative reading
   * of that is to keep respecting it rather than to decide we have learned enough
   * after one success. The website creates a fresh mailbox per session, so this is
   * bounded in practice rather than accumulating across a user's whole day.
   */
  let providerFloorMs = 0;

  /**
   * The mailbox currently being polled.
   *
   * Held here rather than captured by the scheduled callback because the callback
   * runs later, and by then the session may have replaced the mailbox.
   *
   * **This is the second of two guards, not the only one, and that was measured
   * rather than assumed.** `reset` both cancels the pending schedule and clears this
   * field. The falsification pass removed *either* guard on its own and no test
   * turned red: cancelling the schedule means the callback never runs, and clearing
   * the field means a callback that did run had nothing to request. Only removing
   * both let a discarded mailbox be listed. So neither line here is load-bearing on
   * its own, and this comment is written to say that rather than to claim the single
   * mechanism that turned out not to be one.
   */
  let currentMailbox: Mailbox | undefined;

  /** Whether a refusal has halted the loop. Only a caller can lift that. */
  let halted = false;

  /** Whether the session asked this tracker to stop. Nothing here lifts it. */
  let destroyed = false;

  /**
   * The last listing a check actually learned.
   *
   * Held separately from `state` because `state` passes through `checking`, and
   * reading the previous listing back out of it there would find a `checking` and
   * report an empty inbox for a mailbox full of mail - turning one failed request
   * into the disappearance of everything already on screen.
   */
  let lastListing: InboxListing | undefined;

  function publish(next: InboxState): InboxState {
    state = next;
    onChange?.(next);
    return state;
  }

  function clearPending(): void {
    cancelPending?.();
    cancelPending = undefined;
  }

  function delayForNextCheck(): number {
    return Math.max(nextDelay(unchangedInARow), providerFloorMs);
  }

  function scheduleNext(): void {
    if (destroyed || halted || !visible || state.kind === "notStarted") return;

    // **Replaces rather than stacks.** A check asked for from outside, and a tab
    // becoming visible, both arrive with something already queued; without this the
    // mailbox would be listed twice per interval and the effective cadence would be
    // half of whatever `nextDelay` computed.
    clearPending();

    cancelPending = scheduler.schedule(delayForNextCheck(), async () => {
      cancelPending = undefined;
      const mailbox = currentMailbox;
      if (mailbox === undefined) return;
      await check(mailbox);
      scheduleNext();
    });
  }

  async function check(mailbox: Mailbox | undefined): Promise<InboxState> {
    if (mailbox === undefined) {
      // Nothing to list, and nothing is contacted to find that out.
      halted = false;
      currentMailbox = undefined;
      return publish({ kind: "notStarted" });
    }

    currentMailbox = mailbox;
    const provider = providerFor(mailbox);

    // Every check passes through `checking`, including the first, so "has not been
    // checked yet" and "is being checked now" are never rendered from the same value.
    publish({ kind: "checking" });

    let summaries: readonly MessageSummary[];
    try {
      summaries = await provider.listMessages(mailbox);
    } catch (cause) {
      return publish(refusalOf(cause, provider));
    }

    // "Unchanged" means the same set of ids as the previous check - compared as ids
    // rather than as a count, since a count could match with different messages in
    // it. **Two empty listings are unchanged**, which matters more than it sounds: a
    // brand-new mailbox is empty, and treating that as "something changed" would pin
    // every fresh mailbox to the shortest interval forever instead of backing off.
    const previous = lastListing?.messages;
    const allSeen =
      previous !== undefined &&
      previous.length === summaries.length &&
      summaries.every((summary) => previous.some((was) => was.id === summary.id));
    unchangedInARow = allSeen ? unchangedInARow + 1 : 0;

    // Only ids this tracker has never seen, so a listing costs what *arrived* rather
    // than what the mailbox has accumulated. The map is copied once and filled, not
    // rebuilt per message: a fresh inbox of fifty messages would otherwise rebuild a
    // fifty-entry map fifty times.
    const next = new Map(verdicts);
    for (const summary of summaries) {
      if (next.has(summary.id)) continue;
      next.set(summary.id, await determine(provider, mailbox, summary));
    }
    verdicts = next;

    const listing: InboxListing = { messages: summaries, verdicts: new Map(verdicts) };
    lastListing = listing;

    // **Pruned to this listing, and only this listing.** A failed check returns above
    // without reaching here, so a mailbox the product merely failed to ask keeps every
    // reading it had.
    onListed?.(summaries);

    return publish({ kind: "checked", listing });
  }

  /**
   * Read one message and decide what it carries.
   *
   * A read that fails yields `undetermined` rather than `carriesNothing`. Those are
   * different claims, and collapsing them would have the row state that a message has
   * no code in it when the product never managed to look.
   */
  async function determine(
    provider: MailProvider,
    mailbox: Mailbox,
    summary: MessageSummary,
  ): Promise<MessageVerdict> {
    let message: Message;
    try {
      message = await provider.getMessage(mailbox, summary.id);
    } catch {
      return { kind: "undetermined" };
    }

    const analysis = analyseMessage(message.text);

    // **Handed on, and the body is not.** The read above already happened and its
    // result already holds everything the message view will ever show, so throwing the
    // readable text away here and re-fetching it on a click would spend a provider
    // request to recompute a known answer.
    onRead?.(summary, analysis);

    return verdictFrom(analysis);
  }

  /**
   * Turn a parse into a verdict.
   *
   * Code and link are kept apart rather than collapsed into "carries a verification",
   * because they are different things to a user: one gets pasted into a field, the
   * other gets opened in a browser. A row that merged them would have to render both
   * possibilities' wording at once, or pick one and be wrong about the other.
   */
  function verdictFrom(parsed: MessageAnalysis): MessageVerdict {
    const code = parsed.codes.length > 0;
    const link = parsed.links.length > 0;

    if (code && link) return { kind: "carriesCodeAndLink" };
    if (code) return { kind: "carriesCode" };
    if (link) return { kind: "carriesLink" };
    return { kind: "carriesNothing" };
  }

  /**
   * Build the state for a listing that was refused or failed.
   *
   * **A throttled refusal halts the loop.** `provider-abstraction` requires
   * throttling be surfaced rather than silently retried or queued, and a scheduled
   * retry is exactly that - a request the user cannot see and cannot decline. The
   * caller is given the failure and decides, and `check` is how they decide. Any
   * *other* failure leaves the loop running on the normal cadence, because a poller
   * that gave up permanently on one network blip would then report an empty inbox for
   * a mailbox that is perfectly alive - and the backoff already bounds how often a
   * struggling provider is asked.
   */
  function refusalOf(cause: unknown, provider: MailProvider): InboxState {
    const failure = toSessionFailure(cause, provider.id);
    const listing: InboxListing = {
      // The last thing actually learned, not an empty list. Blanking a user's inbox
      // because one request failed destroys information the product still has, in
      // exchange for dramatising a problem they cannot do anything about.
      messages: lastListing?.messages ?? [],
      verdicts: new Map(verdicts),
      ...(failure.rateLimit === undefined ? {} : { rateLimit: failure.rateLimit }),
    };
    // **`lastListing` deliberately not updated.** It holds the last thing a check
    // actually *learned*, and a failure learned nothing. Overwriting it with the
    // failure's own listing would make the next successful check compare against a
    // refusal - so a mailbox refused on its very first listing would back off as if
    // the quiet had been observed, rather than starting at the prompt interval.
    // Consecutive failures still show the last good listing, which is what
    // "keeps the messages a previous check learned" requires.

    if (failure.code === NormalizedErrorCode.RATE_LIMITED) {
      halted = true;
      clearPending();
      // The provider stated its window; hold to it from now on, not just this once.
      const window = windowMsOf(failure.rateLimit);
      if (window !== undefined) providerFloorMs = Math.max(providerFloorMs, window);
    }

    return publish({ kind: "checkFailed", listing, failure });
  }

  return {
    get state() {
      return state;
    },

    setVisible(next) {
      visible = next;
      if (!next) {
        clearPending();
        return;
      }
      // Becoming visible checks promptly rather than waiting out a backoff the user
      // never watched start.
      if (!destroyed && !halted && state.kind !== "notStarted" && currentMailbox !== undefined) {
        clearPending();
        void check(currentMailbox).then(scheduleNext);
      }
    },

    check: (mailbox) => {
      // A caller-initiated check is also the way back from a halt: the user has been
      // shown the throttle and has asked again, which is the visible retry the
      // requirement asks for.
      if (halted) {
        halted = false;
        clearPending();
      }

      // **Reschedules, and omitting this is a defect this package shipped a moment
      // ago.** The scheduled callback chains its own `scheduleNext`, but a call made
      // from here did not - so the very first `checkInbox()` left nothing scheduled,
      // and a caller-initiated check after a throttle stopped the loop for good
      // rather than resuming it under the provider's floor. A session polled only
      // because something external kept asking would look identical from outside
      // while never polling at all.
      return check(mailbox).then((next) => {
        scheduleNext();
        return next;
      });
    },

    reset() {
      clearPending();
      state = { kind: "notStarted" };
      verdicts = new Map();
      lastListing = undefined;
      unchangedInARow = 0;
      halted = false;
      currentMailbox = undefined;
      // `providerFloorMs` deliberately survives: it is something the provider said
      // about itself, not something about the mailbox that was discarded.
    },

    destroy() {
      // **A flag, not just a cancellation.** Cancelling the pending schedule alone
      // would leave a session that starts polling again the moment anyone calls
      // `checkInbox` - a session that cannot be stopped, which is what `destroy` is
      // for. An explicit `checkInbox` on a destroyed tracker still reports what the
      // provider said, because answering a caller is not polling; what it must not do
      // is schedule anything further.
      destroyed = true;
      clearPending();
    },
  };
}

/**
 * The window length in a `ratelimit-policy` statement, in milliseconds.
 *
 * **Reads the window and nothing else.** `1; w=60` states one request per sixty
 * seconds and does not state what that is counted per, so what is taken from it is
 * "wait at least this long" - the conservative direction - and no scope, no budget,
 * and no allowance is derived. A statement that does not match the grammar yields
 * `undefined`, which means "no floor", because a wrong floor derived from an
 * unfamiliar string would be worse than none.
 */
export function windowMsOf(statement: string | undefined): number | undefined {
  if (statement === undefined) return undefined;

  const match = /(?:^|[;\s])w\s*=\s*(\d+)/i.exec(statement);
  if (match?.[1] === undefined) return undefined;

  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;

  return seconds * 1_000;
}
