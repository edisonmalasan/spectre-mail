/**
 * Guarded access to an adapter's optional operations.
 *
 * ## Why this module exists
 *
 * `MailProvider` declares `deleteMessage?` and `destroyMailbox?` as optional, and
 * `supports()` as a required way to ask about them. That satisfies "a caller SHALL
 * be able to determine whether a given provider supports an optional operation
 * before invoking it" — but it leaves the second scenario of that requirement
 * unimplemented: *when a caller invokes an operation the adapter does not
 * implement, the absence SHALL be reported as an unsupported operation and it
 * SHALL name the operation that was requested.*
 *
 * Without a guard, that invocation is not a `SpectreError` at all. It is a
 * `TypeError` from the JavaScript runtime:
 *
 * ```text
 * TypeError: provider.destroyMailbox is not a function
 * ```
 *
 * That is a real defect, not a style preference. A `SpectreError` is a value a
 * caller can branch on; a `TypeError` says "this program is broken", so it
 * cannot be caught, presented, or recovered from by any layer that only knows the
 * closed error vocabulary. It also names the implementation detail rather than
 * the operation the caller asked for.
 *
 * The guard converts that into `UNSUPPORTED_OPERATION` carrying `operation`, so a
 * caller can offer an alternative - "this provider cannot delete a mailbox" -
 * instead of reporting a dead end.
 *
 * ## Why these are functions rather than contract methods
 *
 * Adding `requireDestroyMailbox()` to the interface would make the optional
 * members pointless: every adapter would implement all three, and `supports()`
 * would be reporting on a method that is always present. Keeping the members
 * optional and putting the guard beside them preserves both properties at once -
 * absence stays real and detectable, and invoking it stays safe.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, SpectreError } from "@spectre-mail/core";

import type { MailProvider, ProviderOperation } from "./contract";

/**
 * Invoke `provider.destroyMailbox`, or report that the provider does not offer it.
 *
 * @throws {SpectreError} `UNSUPPORTED_OPERATION` naming `destroyMailbox`, when
 * {@link MailProvider.supports} reports `"false"` for it.
 */
export async function destroyMailbox(provider: MailProvider, mailbox: Mailbox): Promise<void> {
  const method = requireSupport(provider, "destroyMailbox").destroyMailbox;
  // Non-null because `requireSupport` returned only after `supports` reported
  // `true`, and a conforming adapter does not lie about its own operations. An
  // adapter that does is caught by the conformance suite rather than here, because
  // guessing which of the two is wrong would hide a defect behind a guard.
  await (method as (target: Mailbox) => Promise<void>).call(provider, mailbox);
}

/**
 * Invoke `provider.deleteMessage`, or report that the provider does not offer it.
 *
 * @throws {SpectreError} `UNSUPPORTED_OPERATION` naming `deleteMessage`, when
 * {@link MailProvider.supports} reports `"false"` for it.
 */
export async function deleteMessage(
  provider: MailProvider,
  mailbox: Mailbox,
  messageId: string,
): Promise<void> {
  const method = requireSupport(provider, "deleteMessage").deleteMessage;
  await (method as (target: Mailbox, id: string) => Promise<void>).call(
    provider,
    mailbox,
    messageId,
  );
}

/**
 * Return `provider` if it offers `operation`, or throw naming it.
 *
 * @throws {SpectreError} `UNSUPPORTED_OPERATION`.
 */
function requireSupport(
  provider: MailProvider,
  operation: ProviderOperation,
): Pick<MailProvider, ProviderOperation> {
  if (provider.supports(operation)) {
    return provider as Pick<MailProvider, ProviderOperation>;
  }

  throw {
    code: NormalizedErrorCode.UNSUPPORTED_OPERATION,
    provider: provider.id,
    description:
      `${provider.displayName} does not offer the "${operation}" operation. ` +
      `This is recorded as unsupported because it was never observed to work, ` +
      `not because the provider was proven unable to serve it.`,
    // The operation named, because that is the code's entire purpose: to let a
    // caller offer an alternative rather than report a dead end.
    operation,
  } satisfies SpectreError;
}
