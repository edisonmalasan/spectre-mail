/**
 * A listing that could not be completed.
 *
 * ## An annotation, never a replacement
 *
 * The mailbox exists. The user has its address. A failed listing says something about
 * one request and nothing about the mailbox, so this renders **alongside** the address
 * rather than in place of it — and it says what happened in words a user can act on.
 *
 * The messages already learned are still shown, because they are still true. Blanking
 * them would trade information the product has for a dramatisation of a problem the
 * user cannot do anything about.
 *
 * ## No retry happens on its own
 *
 * `provider-abstraction` requires throttling be surfaced rather than silently retried,
 * and a throttled listing **stops the loop** rather than backing off. So the retry
 * here is a button the user presses: a retry the user cannot see and cannot decline
 * is the silent retry the rule forbids.
 *
 * ## The provider's own statement, verbatim
 *
 * A rate limit is shown as the provider's characters and nothing more. `1; w=60`
 * states a count and a window and says nothing about what it is counted per — whether
 * that is per IP or per account was never verified — so no scope is attached and no
 * number is derived from it. It is quoted as evidence, not parsed into a schedule the
 * page then displays.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { SessionFailure } from "@spectre-mail/mailbox";

export interface InboxCheckFailedProps {
  readonly failure: SessionFailure;
  /** The provider's statement, when one accompanied the refusal. */
  readonly rateLimit?: string | undefined;
}

/**
 * What a failed listing says, per condition.
 *
 * Distinct wording per condition for the reason `MailboxFailure` does the same: a
 * user told "something went wrong" cannot act, and a user told to wait cannot tell
 * whether they are being rate-limited or merely offline.
 */
function explain(failure: SessionFailure): string {
  switch (failure.code) {
    case NormalizedErrorCode.RATE_LIMITED:
      return "Guerrilla Mail is asking SpectreMail to slow down, so this address was not checked again.";
    case NormalizedErrorCode.PROVIDER_UNAVAILABLE:
      return "Guerrilla Mail could not be reached, so this address was not checked. The address itself is unaffected.";
    case NormalizedErrorCode.MAILBOX_EXPIRED:
      return "This address is no longer available. Replace it to get a new one.";
    case NormalizedErrorCode.NETWORK_ERROR:
      return "The request to Guerrilla Mail could not be completed. The address itself is unaffected.";
    case NormalizedErrorCode.AUTH_FAILED:
      return "Guerrilla Mail refused this session, so this address could not be listed.";
    case NormalizedErrorCode.MESSAGE_NOT_FOUND:
    case NormalizedErrorCode.UNSUPPORTED_OPERATION:
    case NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR:
      // Named together but not merged into one sentence about them: each is a
      // different thing that happened, and the detail line below says which.
      return "This address could not be listed, and SpectreMail could not tell why.";
    default:
      return assertNever(failure);
  }
}

function assertNever(failure: SessionFailure): never {
  throw new Error(`Unhandled failure code: ${String(failure.code)}`);
}

export function InboxCheckFailed({ failure, rateLimit }: InboxCheckFailedProps) {
  const stated = rateLimit ?? failure.rateLimit;

  return (
    <section aria-labelledby="inbox-failure-heading" data-testid="inbox-check-failed">
      <h4 id="inbox-failure-heading">This address could not be checked</h4>

      <p data-testid="inbox-failure-explanation">{explain(failure)}</p>

      <p data-testid="inbox-failure-detail">{failure.description}</p>

      {stated !== undefined && (
        <p data-testid="inbox-failure-rate-limit">
          The provider advertised this limit: <code>{stated}</code>. SpectreMail does not know what
          it is counted per.
        </p>
      )}
    </section>
  );
}
