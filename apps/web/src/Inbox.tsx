/**
 * The inbox.
 *
 * Presentational and nothing else. Every judgement about *what* is true belongs to the
 * session: this reads the `InboxState` it is handed, looks each verdict up in the map
 * the session filled, and renders words. It opens no message, keeps no timer, and
 * **calls no parser** — a view that re-parsed a body would undo the once-per-message
 * requirement at the one place nothing polices it.
 *
 * ## Everything is stated in words
 *
 * No state, marking, or unread flag is signalled by colour or shape alone. Each is a
 * text node, and M7 slice 1 has now given those words an accent *rule* to reinforce
 * them - the words are still the marking. A row whose only signal was a coloured dot
 * would be a row that says nothing to a screen reader, in print, or on a monochrome
 * display, and the stylesheet does not change that.
 *
 * ## A check in progress does not take the rows away
 *
 * **`checking` renders the rows it already has, and this is the repair
 * `motion-and-reduced-motion` forced (2026-10-06).** The session publishes `checking`
 * before every listing, and this file used to render that state as its own branch with
 * no rows at all - so every poll unmounted the `<ul>`, flashed a sentence, and rebuilt
 * it. Measured on the built page: the list was removed and recreated on each poll,
 * every five seconds, for as long as the tab stayed open.
 *
 * That was visible before motion existed and it is worse now, for two reasons that
 * needed two layers to fix and this file is the outer one. **In this file**, the branch
 * structure: an element is torn down and rebuilt whenever its parent returns a
 * different subtree, and a rebuilt row re-runs its entrance, so the inbox
 * re-materialised several times a minute. **In the session**, the reason the state
 * carried no rows to keep (`state.ts`, `motion-and-reduced-motion` D17).
 *
 * The tree below is therefore arranged so that `checked` and `checking` produce
 * **the same elements in the same order**, with the re-checking sentence *appended*
 * rather than inserted. That is not a stylistic preference: a `<p>` placed before the
 * list would shift its index, and a shifted index is a remount. The rows and the note
 * that follow them are keyed by position, so appending is what keeps the list alive
 * across a poll.
 *
 * ## No number about checking
 *
 * The page describes *that* it checks, never *how often*. The cadence is the product's
 * own choice — no provider limit was measured for the one provider a browser page can
 * reach — so any figure shown here would be an invention presented as a measurement.
 * See `docs/PROVIDERS.md` and `packages/mailbox/src/cadence.ts`.
 *
 * @module
 */

import type { MessageSummary } from "@spectre-mail/core";
import type { InboxState, MessageVerdict } from "@spectre-mail/mailbox";
import { verdictFor } from "@spectre-mail/mailbox";

import { InboxCheckFailed } from "./InboxCheckFailed";
import { InboxRow } from "./InboxRow";

export interface InboxProps {
  /** What the session currently holds. Rendered as-is, never re-derived. */
  readonly inbox: InboxState;
  /**
   * Ask for a listing now.
   *
   * Rendered only after a failure, because that is the one case where asking again is
   * something the product should offer: a throttled listing stops the loop rather than
   * backing off, so this button is the only way back — and it is a *visible* retry,
   * which is what `provider-abstraction` requires instead of a silent one.
   */
  readonly onCheck: () => void;
  /**
   * Open a message from the inbox.
   *
   * Passed down rather than imported from a session hook, which is what keeps this file
   * presentational: it renders the state it is handed and reports what a control did.
   * It never reads a message and never calls a parser.
   */
  readonly onOpenMessage: (messageId: string) => void;
}

export function Inbox({ inbox, onCheck, onOpenMessage }: InboxProps) {
  // **The four states are distinct in words, and the strings differ from each other
  // rather than merely in wording.** An empty mailbox and a check that has not run are
  // different facts: the first says a provider answered and there was nothing, the
  // second says nobody has asked yet. Collapsing them would report "no mail" about a
  // mailbox that was never looked at.
  //
  // **`notStarted` and an empty `checking` render the same component, and that is now
  // a claim rather than a coincidence.** They are the same fact — a check is under way
  // or has not begun, and nothing has been learned either way — and `checking` only
  // starts carrying rows once there are some (see the module doc).
  if (inbox.kind === "notStarted") {
    return <CheckingInbox />;
  }

  if (inbox.kind === "checkFailed") {
    return (
      <section className="region" aria-labelledby="inbox-heading">
        <h3 id="inbox-heading">Inbox</h3>
        <InboxCheckFailed failure={inbox.failure} rateLimit={inbox.listing.rateLimit} />
        {/* The messages already learned are still true, so they are still shown. A
            failed check is a condition of the inbox, not the loss of it. */}
        {inbox.listing.messages.length > 0 ? (
          <InboxRows listing={inbox.listing} onOpenMessage={onOpenMessage} />
        ) : (
          // **An empty list under a failure needs a sentence, and did not have one.**
          // With no prior successful listing there is nothing to show, and rendering an
          // empty `<ul>` anyway put a bare list frame directly beneath a heading that
          // says the check failed — which reads as "the inbox is empty" to anyone
          // scanning it. Pointed out by the independent verification pass.
          <p data-testid="inbox-nothing-learned">
            Nothing had been listed before the check failed, so there is nothing to show yet.
          </p>
        )}
        <button type="button" className="control" onClick={onCheck}>
          Check again
        </button>
      </section>
    );
  }

  // **Everything below is `checked` or `checking`, and both carry a listing.** Which is
  // the whole point of the change: a check in progress is not a state that takes the
  // rows away. An empty listing under `checking` is what a first check looks like, and
  // it says the same sentence an empty listing under `checked` does *not* — because
  // there the provider answered and reported nothing, which is a different claim.
  if (inbox.listing.messages.length === 0) {
    return inbox.kind === "checking" ? <CheckingInbox /> : <EmptyInbox />;
  }

  return (
    <section className="region" aria-labelledby="inbox-heading">
      <h3 id="inbox-heading">Inbox</h3>
      <InboxRows listing={inbox.listing} onOpenMessage={onOpenMessage} />
      <p data-testid="inbox-cadence-note">
        This page checks while it is open and stops when you switch away.
      </p>
      {/*
        **Appended, and never inserted.** The three elements above are at the same
        indices in both states, so this one appearing cannot shift them; a `<p>` before
        the list would move the `<ul>` to a new index, and a node at a new index is a
        node React rebuilds — which is the remount this branch structure exists to
        avoid. Measured before the repair: every poll removed and recreated the list.
      */}
      {inbox.kind === "checking" ? (
        <p data-testid="inbox-rechecking">Checking again for new mail.</p>
      ) : null}
    </section>
  );
}

/** A check nobody has answered yet, whether or not one is running. */
function CheckingInbox() {
  return (
    <section className="region" aria-labelledby="inbox-heading">
      <h3 id="inbox-heading">Inbox</h3>
      <p data-testid="inbox-checking">Checking this address for mail.</p>
      <p data-testid="inbox-cadence-note">
        This page checks while it is open and stops when you switch away.
      </p>
    </section>
  );
}

/** A check that finished and reported nothing. */
function EmptyInbox() {
  return (
    <section className="region" aria-labelledby="inbox-heading">
      <h3 id="inbox-heading">Inbox</h3>
      <p data-testid="inbox-empty">No mail has arrived at this address yet.</p>
      <p data-testid="inbox-cadence-note">
        This page checks while it is open and stops when you switch away.
      </p>
    </section>
  );
}

interface InboxRowsProps {
  readonly listing: {
    readonly messages: readonly MessageSummary[];
    readonly verdicts: ReadonlyMap<string, MessageVerdict>;
  };
  readonly onOpenMessage: (messageId: string) => void;
}

function InboxRows({ listing, onOpenMessage }: InboxRowsProps) {
  return (
    <ul className="inbox-rows" data-testid="inbox-rows">
      {listing.messages.map((message) => (
        <li key={message.id}>
          <InboxRow
            message={message}
            // Read from the session's map. A missing entry is `undetermined` by
            // `verdictFor`, which is the honest answer for a row whose body this
            // product has not managed to read.
            verdict={verdictFor(listing.verdicts, message.id)}
            onOpen={() => onOpenMessage(message.id)}
          />
        </li>
      ))}
    </ul>
  );
}
