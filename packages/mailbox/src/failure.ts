/**
 * Turning whatever a provider threw into a normalized failure.
 *
 * ## Why this is its own module
 *
 * Two paths in this package normalize a provider refusal: the inbox tracker's listing
 * failure and the opened-message tracker's read failure. The first version of this
 * module was a private function in `inbox.ts`, and the obvious way to add the second
 * would have been to write it again — which is how two definitions of one rule end up
 * disagreeing about what may be trusted. `inbox.ts` had already been repaired once for
 * duck-typing `cause.code` instead of asking `isSpectreError`, and a second copy
 * written from memory is how that repair would have been undone in one place.
 *
 * One definition, used by both, is worth more than the duplication saves.
 *
 * @module
 */

import { isSpectreError, NormalizedErrorCode } from "@spectre-mail/core";
import type { SpectreError } from "@spectre-mail/core";

import type { SessionFailure } from "./state";

/**
 * Normalize whatever the provider threw.
 *
 * A failure of one of these paths is a condition of the inbox or of the open message
 * rather than a session failure, so it reuses the same normalized shape rather than
 * inventing a second error vocabulary for the same condition.
 *
 * **`isSpectreError` decides the code, exactly as `session.normalize` does.** An earlier
 * version duck-typed it — `typeof cause.code === "string"` — so any object with a
 * `code` property had its string accepted as a `NormalizedErrorCode`. Nothing produces
 * such a value today, but the consequence is not hypothetical: a client's `explain()`
 * ends in `assertNever`, which **throws while rendering**, so a throwable with an
 * off-enum `code` would take the page down rather than showing something a user could
 * read. One definition of what may be trusted is worth more here than a second, more
 * permissive one.
 *
 * @param cause Whatever was thrown.
 * @param provider The provider whose call produced it, named so a user can be told
 *   *which* provider refused rather than only that something did.
 */
export function toSessionFailure(cause: unknown, provider: string): SessionFailure {
  const trusted = isSpectreError(cause)
    ? (cause as SpectreError & { readonly rateLimit?: string })
    : undefined;

  const code = trusted?.code ?? NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR;
  const description =
    trusted?.description ?? (cause instanceof Error ? cause.message : String(cause));

  return {
    code,
    description,
    providerFailures: [{ provider, code, description }],
    ...(trusted?.rateLimit === undefined ? {} : { rateLimit: trusted.rateLimit }),
  };
}
