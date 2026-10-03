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
 * text node. There is no stylesheet at this milestone — M7 owns that — so anything
 * conveyed visually would convey nothing at all today, and a row whose only signal was
 * a coloured dot would be a row that says nothing to a screen reader, in print, or on
 * a monochrome display.
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
  if (inbox.kind === "notStarted" || inbox.kind === "checking") {
    return (
      <section aria-labelledby="inbox-heading">
        <h3 id="inbox-heading">Inbox</h3>
        <p data-testid="inbox-checking">Checking this address for mail.</p>
        <p data-testid="inbox-cadence-note">
          This page checks while it is open and stops when you switch away.
        </p>
      </section>
    );
  }

  if (inbox.kind === "checkFailed") {
    return (
      <section aria-labelledby="inbox-heading">
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
        <button type="button" onClick={onCheck}>
          Check again
        </button>
      </section>
    );
  }

  if (inbox.listing.messages.length === 0) {
    return (
      <section aria-labelledby="inbox-heading">
        <h3 id="inbox-heading">Inbox</h3>
        <p data-testid="inbox-empty">No mail has arrived at this address yet.</p>
        <p data-testid="inbox-cadence-note">
          This page checks while it is open and stops when you switch away.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="inbox-heading">
      <h3 id="inbox-heading">Inbox</h3>
      <InboxRows listing={inbox.listing} onOpenMessage={onOpenMessage} />
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
    <ul data-testid="inbox-rows">
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
