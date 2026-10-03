/**
 * The opened-message tracker.
 *
 * ## Why it exists at all, when the inbox already read every message
 *
 * `inbox.ts`'s `determine()` fetches the whole message for each new arrival, runs
 * `analyseMessage` over its body, and decides a one-word verdict. The readable text,
 * the codes, and the links all existed in that function's scope and were discarded. So
 * this module is mostly about **not discarding what was already read**.
 *
 * ## It schedules nothing and reaches no network itself
 *
 * Every provider call here goes through a `MailProvider` handed in by the session, which
 * is what keeps "the session layer reaches no network directly" true of the opened path
 * as it is of the creation and listing paths.
 *
 * ## The retention is bounded, and the reason is the important part
 *
 * A retained message is an `OpenedMessage`, projected: its readable text and its
 * detections. **The body as received is never stored**, so an HTML document cannot sit
 * in this package waiting for something to render it — that is enforced by the
 * projection rather than by remembering to drop it.
 *
 * Retention is pruned to the ids of the current listing on every successful check. That
 * bound is what separates it from the inbox's verdict cache, which is **sticky by
 * design** and keeps an entry per message ever seen: a verdict is one word and
 * idempotent, while a readable body is neither cheap nor safe to keep for a session that
 * never ends. `pruneTo` drops the expensive half and leaves the cheap half alone.
 *
 * @module
 */

import { analyseMessage } from "@spectre-mail/mail-parser";
import type { MessageAnalysis } from "@spectre-mail/mail-parser";
import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, Message, MessageSummary } from "@spectre-mail/core";
import type { MailProvider } from "@spectre-mail/providers";

import { toSessionFailure } from "./failure";
import { isNoMessageOpen } from "./state";
import type { OpenedMessage, OpenedMessageState, SessionFailure } from "./state";

export interface OpenedMessagesOptions {
  /**
   * The caller supplies this rather than importing the manager, so this module holds no
   * reference to how providers are chosen — it is handed the one that owns the mailbox
   * and never goes looking for another. Same seam as the inbox tracker's, and for the
   * same reason: a message read through a different provider would authenticate with the
   * wrong credentials.
   */
  readonly providerFor: (mailbox: Mailbox) => MailProvider;

  /**
   * The summaries the inbox currently holds.
   *
   * **A function rather than a value, and that is load-bearing.** The retention is
   * pruned against the *latest* listing, so a value captured at construction would
   * always prune against the empty set and the retained fast path would never be taken.
   * Asking at open time is also what makes the refusal honest: an id the listing has
   * never reported is refused, and a cached copy could not be.
   *
   * Summaries rather than ids, because `project` needs their fields and the inbox
   * already holds them. A second copy kept here could disagree with the listing, and the
   * two would have to be reconciled to find out which was right.
   */
  readonly listedSummaries: () => readonly MessageSummary[];

  /** Called on every publish, for the same reason the inbox tracker's is. */
  readonly onChange?: (state: OpenedMessageState) => void;
}

export interface OpenedMessages {
  /** What is open. Never a promise; never partially built. */
  readonly state: OpenedMessageState;

  /**
   * Keep what was learned when a message was read for the inbox's verdict.
   *
   * Called only for messages that are new to the tracker, which is what makes the
   * retained set cost nothing per listing: a mailbox of fifty messages is analysed
   * fifty times in total, not fifty times per check.
   */
  retain(summary: MessageSummary, analysis: MessageAnalysis): void;

  /**
   * Drop retained messages the current listing no longer contains.
   *
   * The inbox's **verdict** for a departed message is deliberately untouched. It is one
   * word, it is already the answer, and the inbox's requirements say it survives; a body
   * is a different trade and is the thing being shed.
   */
  pruneTo(messageIds: readonly string[]): void;

  /**
   * Open one message.
   *
   * Three paths, and the order matters: refuse an id the listing never reported, serve a
   * retained reading without a request, and only then fetch.
   */
  open(mailbox: Mailbox | undefined, messageId: string): Promise<OpenedMessageState>;

  /**
   * Forget everything: the tracker becomes `none` and retains nothing.
   *
   * **Publishes, and that is not optional.** The first version set the internal `state`
   * without calling `onChange`, so a caller that had asked for a message to be closed
   * was still holding a session reporting it open — the tracker and the session
   * disagreed, and nothing anywhere noticed because the only test that asked read the
   * tracker's own `state` rather than the session's.
   *
   * Anything holding this tracker needs to be told it is now empty, so the transition
   * is published like every other one here.
   */
  reset(): void;

  /**
   * Stop answering.
   *
   * Unlike the inbox tracker this one schedules nothing, so there is no loop to stop.
   * What it does have is a read in flight, and a read that resolves after the session
   * was discarded must not publish: a caller holding the session is gone, and writing
   * into its state anyway is a write with no reader and a future that has already ended.
   */
  destroy(): void;
}

export function createOpenedMessages(options: OpenedMessagesOptions): OpenedMessages {
  const { providerFor, listedSummaries, onChange } = options;

  let state: OpenedMessageState = { kind: "none" };

  /** Message id → what we learned about it. Bounded by `pruneTo`. */
  const retained = new Map<string, OpenedMessage>();

  /** Whether the session asked this tracker to stop. Nothing here lifts it. */
  let destroyed = false;

  function publish(next: OpenedMessageState): OpenedMessageState {
    state = next;
    onChange?.(next);
    return state;
  }

  /**
   * Project a read message into the shape a client renders.
   *
   * **The body as received is dropped here and never stored.** Only the parser's readable
   * text survives, so there is no field on the result a renderer could mistake for
   * markup. `design.md` D3 explains why this is not the model's `Message`.
   *
   * The optional fields are spread conditionally rather than assigned as `undefined`,
   * because `exactOptionalPropertyTypes` is on and an explicit `undefined` is not the
   * same value as an absent one.
   */
  function project(summary: MessageSummary, analysis: MessageAnalysis): OpenedMessage {
    return {
      id: summary.id,
      mailboxId: summary.mailboxId,
      from: summary.from,
      subject: summary.subject,
      receivedAt: summary.receivedAt,
      ...(summary.fromName === undefined ? {} : { fromName: summary.fromName }),
      ...(summary.unread === undefined ? {} : { unread: summary.unread }),
      readable: analysis.readable,
      codes: [...analysis.codes],
      links: [...analysis.links],
    };
  }

  /**
   * The refusal for an id this mailbox does not list.
   *
   * **Built directly rather than thrown and normalized.** Nothing was thrown — the
   * session decided this itself — and routing a value it invented through the function
   * that interprets what providers threw would be a second, contradictory claim about
   * where the code came from. `MESSAGE_NOT_FOUND` already means "the requested message
   * does not exist, or is no longer retained", so it is the honest code rather than a
   * new one.
   *
   * The provider is named as `unknown` when there is no mailbox, because with no mailbox
   * there is no owning provider to name and `providerFor` would have nothing to resolve.
   */
  function notFound(messageId: string, provider: string): SessionFailure {
    const description = `This mailbox does not list a message with the identifier "${messageId}".`;
    return {
      code: NormalizedErrorCode.MESSAGE_NOT_FOUND,
      description,
      providerFailures: [
        {
          provider,
          code: NormalizedErrorCode.MESSAGE_NOT_FOUND,
          description,
        },
      ],
    };
  }

  async function open(
    mailbox: Mailbox | undefined,
    messageId: string,
  ): Promise<OpenedMessageState> {
    // **Refused before anything else, and without a request.** The session cannot know
    // that an id belongs to the mailbox it holds, so asking a provider about a message
    // this mailbox never reported would be a request made on a guess. With no mailbox
    // the listing is empty and this falls out of the same check rather than needing a
    // branch of its own.
    const summary = listedSummaries().find((each) => each.id === messageId);
    if (mailbox === undefined || summary === undefined) {
      return publish({ kind: "openFailed", messageId, failure: notFound(messageId, "unknown") });
    }

    const provider = providerFor(mailbox);

    // **Served from retention, and no request is made.** Detection is deterministic, so a
    // second read of a message already in memory has no correctness benefit at all and
    // would cost one provider request against a provider whose tolerance for the
    // existing cadence has never been measured.
    //
    // `opening` is deliberately **not** published on this path. There is no provider to
    // wait for, so an `opening` nobody waits through would render as something happening
    // when nothing is.
    const held = retained.get(messageId);
    if (held !== undefined) {
      return publish({ kind: "opened", message: held });
    }

    publish({ kind: "opening", messageId });

    let message: Message;
    try {
      message = await provider.getMessage(mailbox, messageId);
    } catch (cause) {
      // **Reported, never rendered as an empty message.** And the retained set is *not*
      // poisoned: an earlier failure may have been transient, so the next request tries
      // again rather than refusing forever on the strength of a cached one.
      return publish({
        kind: "openFailed",
        messageId,
        failure: toSessionFailure(cause, provider.id),
      });
    }

    if (destroyed) {
      // The session was discarded while this read was in flight. Answering a caller that
      // no longer exists is not useful, and publishing would write into a state nobody
      // reads. The call still *resolves* — a promise left pending would be a leak, and a
      // rejected one would be a failure the caller cannot do anything about.
      return state;
    }

    const opened = project(summary, analyseMessage(message.text));
    retained.set(messageId, opened);
    return publish({ kind: "opened", message: opened });
  }

  return {
    get state() {
      return state;
    },

    retain(summary, analysis) {
      retained.set(summary.id, project(summary, analysis));
    },

    pruneTo(messageIds) {
      const keep = new Set(messageIds);
      // Copied before iterating: deleting from a `Map` while iterating it is defined to
      // visit the entry after the deleted one, so an in-place delete would skip one.
      for (const id of [...retained.keys()]) {
        if (!keep.has(id)) retained.delete(id);
      }
    },

    open,

    reset() {
      retained.clear();
      // **Published only when the reported state actually changes.** Two things are
      // true here and conflating them is what made the first version wrong in both
      // directions. The *reported* state is what a client renders, and clearing it from
      // `opened` to `none` is a change every holder must be told about — that was the
      // bug: `closeMessage()` cleared the tracker and left the session still claiming a
      // message was open. But clearing the *retention* is not a change anyone can
      // observe, and publishing for it would make every mailbox replacement emit an
      // extra notification with the same value it already had — which a subscriber
      // counting transitions would see as a lie about how many there were.
      if (!isNoMessageOpen(state)) publish({ kind: "none" });
    },

    destroy() {
      // **Publishes nothing, deliberately.** The session that owned this is gone, so
      // there is nobody left to tell, and a notification with no subscriber is a
      // notification into a state nobody reads.
      destroyed = true;
      retained.clear();
      state = { kind: "none" };
    },
  };
}
