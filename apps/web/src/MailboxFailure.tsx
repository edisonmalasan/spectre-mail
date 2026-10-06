/**
 * The failure state.
 *
 * Every failure is shown, named when the condition is known, and retryable by hand.
 *
 * ## Why the copy differs per condition
 *
 * "Something went wrong" tells a user nothing they can act on. The normalized code
 * exists precisely so the page can say which thing happened, and each branch here
 * is a different instruction: wait, come back later, or try again. A page that
 * rendered one generic message for all of them would make the code pointless — and
 * would be indistinguishable from the page that never got a code at all, which is
 * exactly what the provider manager used to hand back.
 *
 * **No retry happens on its own.** `provider-abstraction` requires a throttle be
 * surfaced rather than silently retried, and a page that hid a 429 behind a spinner
 * would tell a rate-limited user their request was being handled.
 *
 * No address is rendered in any branch. Showing a stale or placeholder one is the
 * specific dishonesty this state exists to prevent.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { SessionFailure } from "@spectre-mail/mailbox";

export interface MailboxFailureProps {
  readonly failure: SessionFailure;
  readonly onRetry: () => void;
}

/** The user's-term description of each condition this page knows by name. */
function explain(failure: SessionFailure): string {
  switch (failure.code) {
    case NormalizedErrorCode.RATE_LIMITED:
      return "Guerrilla Mail is asking SpectreMail to slow down. Wait a moment, then try again.";
    case NormalizedErrorCode.PROVIDER_UNAVAILABLE:
      return "Guerrilla Mail could not be reached. It may be down or this network may be blocking it.";
    case NormalizedErrorCode.AUTH_FAILED:
      return "Guerrilla Mail refused this session. Try again to get a fresh one.";
    case NormalizedErrorCode.MAILBOX_EXPIRED:
      return "The previous mailbox is no longer available. Try again for a new one.";
    case NormalizedErrorCode.NETWORK_ERROR:
      return "The request to Guerrilla Mail could not be completed. Nothing was created.";
    case NormalizedErrorCode.MESSAGE_NOT_FOUND:
    case NormalizedErrorCode.UNSUPPORTED_OPERATION:
      return "Guerrilla Mail refused the request in a form SpectreMail did not expect. Nothing was created.";
    case NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR:
      return "The address could not be created, and SpectreMail could not tell why.";
    default:
      // Exhaustiveness is the default branch's job, not the caller's: a new code in
      // `core` turns this into a compile error here rather than a silent fallback to
      // the vaguest message.
      return assertNever(failure);
  }
}

function assertNever(failure: SessionFailure): never {
  throw new Error(`Unhandled failure code: ${String(failure.code)}`);
}

export function MailboxFailure({ failure, onRetry }: MailboxFailureProps) {
  return (
    <section className="region region--alert" aria-labelledby="failure-heading">
      <h2 id="failure-heading">No address yet</h2>

      <p data-testid="failure-explanation">{explain(failure)}</p>

      {/*
        The provider's own words, kept. They are the only place a user can see what
        the provider actually said, and they are shown as text - never as markup.
      */}
      <p data-testid="failure-detail">{failure.description}</p>

      {/*
        The rate limit is shown verbatim rather than interpreted. `1; w=60` states a
        count and a window and says nothing about what it is counted per - whether
        that is per IP or per account was never verified - so no scope is attached.
      */}
      {failure.rateLimit !== undefined && (
        <p data-testid="failure-rate-limit">
          The provider advertised this limit: <code>{failure.rateLimit}</code>. SpectreMail does not
          know what it is counted per.
        </p>
      )}

      <button type="button" className="control" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}
