/**
 * Normalized provider failures.
 *
 * A consumer of SpectreMail branches on these codes, never on a provider's HTTP
 * status. That is the whole point: two providers describe the same condition
 * differently, and the product should not have to know either vocabulary.
 *
 * The vocabulary is **closed**. An unrecognised failure gets
 * {@link NormalizedErrorCode.UNKNOWN_PROVIDER} and keeps the provider's own
 * description, because mapping it onto a plausible-looking code would tell the user
 * something confidently false. `provider-abstraction` requires the same under
 * *Provider throttling is surfaced, not silently retried*.
 *
 * @module
 */

import { isProviderId } from "./provider";
import type { ProviderId } from "./provider";

/**
 * The fixed set of ways a provider operation can fail.
 */
export const NormalizedErrorCode = {
  /** The provider could not be reached, or answered in a way we cannot use at all. */
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  /** The provider refused the request for rate-limit reasons. Never silently retried. */
  RATE_LIMITED: "RATE_LIMITED",
  /** The provider reported the mailbox or its session as unusable. */
  MAILBOX_EXPIRED: "MAILBOX_EXPIRED",
  /** The provider rejected our credentials for this mailbox. */
  AUTH_FAILED: "AUTH_FAILED",
  /** The request failed before or during transport, with no provider response. */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** The requested message does not exist, or is no longer retained. */
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  /** The provider does not offer the requested operation. */
  UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION",
  /**
   * The provider failed in a way matching no other code.
   *
   * Not defensive boilerplate. The measured Guerrilla dead-session behaviour - HTTP
   * 200 with an `error` key and no message list while `auth.success` stays `true` -
   * shows concretely how easily a "success" status conceals a failure, so an
   * unrecognised condition is expected to occur, not exceptional.
   */
  UNKNOWN_PROVIDER_ERROR: "UNKNOWN_PROVIDER_ERROR",
} as const;

/**
 * One of the normalized failure codes.
 */
export type NormalizedErrorCode = (typeof NormalizedErrorCode)[keyof typeof NormalizedErrorCode];

/**
 * Every normalized failure code, for iteration and validation.
 */
export const NORMALIZED_ERROR_CODES = Object.values(NormalizedErrorCode);

/**
 * Whether `value` is a normalized failure code.
 */
export function isNormalizedErrorCode(value: unknown): value is NormalizedErrorCode {
  return typeof value === "string" && (NORMALIZED_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * The provider-independent description of a failure.
 *
 * Discriminated by `code` so that narrowing gives a consumer exactly the fields
 * that code guarantees. A flat `{ code: string; cause?: string }` would not: the
 * compiler could not prove `cause` is present, so every access would need a guard
 * anyway, and the guard would be easy to forget.
 */
export type SpectreError =
  | {
      readonly code: typeof NormalizedErrorCode.PROVIDER_UNAVAILABLE;
      readonly provider: ProviderId;
      /** What the provider said, in its own words, when it said anything. */
      readonly description: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: typeof NormalizedErrorCode.RATE_LIMITED;
      readonly provider: ProviderId;
      readonly description: string;
      /**
       * The provider's advertised rate-limit header, verbatim, when it sent one.
       *
       * Kept rather than parsed because Mail.tm publishes `1; w=60` for account
       * creation and that value is the evidence for the product's own rate-limit
       * handling. Discarding it would throw away the only measured fact we have.
       */
      readonly rateLimit?: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: typeof NormalizedErrorCode.MAILBOX_EXPIRED;
      readonly provider: ProviderId;
      readonly description: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: typeof NormalizedErrorCode.AUTH_FAILED;
      readonly provider: ProviderId;
      readonly description: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: typeof NormalizedErrorCode.NETWORK_ERROR;
      readonly provider: ProviderId;
      readonly description: string;
      /** The underlying transport failure, when one is available. */
      readonly cause: unknown;
    }
  | {
      readonly code: typeof NormalizedErrorCode.MESSAGE_NOT_FOUND;
      readonly provider: ProviderId;
      readonly description: string;
      /** The id we looked for, so the failure can be traced to a specific request. */
      readonly messageId: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: typeof NormalizedErrorCode.UNSUPPORTED_OPERATION;
      readonly provider: ProviderId;
      readonly description: string;
      /** The operation the provider does not offer, e.g. `subscribe`. */
      readonly operation: string;
      readonly cause?: unknown;
    }
  | {
      readonly code: typeof NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR;
      readonly provider: ProviderId;
      /**
       * The provider's own description of what went wrong.
       *
       * Required, not optional. This code exists precisely for conditions we could
       * not classify, so discarding the provider's account of it would leave the
       * condition undiagnosable - and would make the code useless.
       */
      readonly description: string;
      readonly cause?: unknown;
    };

/**
 * Whether `value` is a {@link SpectreError}.
 *
 * **A type guard is a promise, and this one has to be kept.** It declares
 * `value is SpectreError`, so every caller afterwards may read `messageId` on a
 * `MESSAGE_NOT_FOUND` or `operation` on an `UNSUPPORTED_OPERATION` and have the
 * compiler agree the field is there. The M2 verification pass proved the first
 * version of this function was unsound: it checked the discriminant, the provider,
 * and the description, but not the fields each individual variant *requires*. It
 * happily accepted a `MESSAGE_NOT_FOUND` with no `messageId`, an
 * `UNSUPPORTED_OPERATION` with no `operation`, a numeric `rateLimit`, and a
 * provider named `"protonmail"`. Every one of those is a value the type forbids,
 * so every one would have surfaced later as `undefined` where a `string` was
 * promised.
 *
 * So it now checks each variant's own requirements. The optional `cause` is
 * deliberately still unvalidated: it is `unknown`, so there is nothing to check,
 * and its presence carries no per-code guarantee.
 */
export function isSpectreError(value: unknown): value is SpectreError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  const code = candidate["code"];
  if (!isNormalizedErrorCode(code)) {
    return false;
  }

  // An unknown provider is a real condition and must not pass as a known one.
  if (!isProviderId(candidate["provider"])) {
    return false;
  }

  // Optional `rateLimit` is a string when present; a number here is corruption.
  if (candidate["rateLimit"] !== undefined && typeof candidate["rateLimit"] !== "string") {
    return false;
  }

  if (code === NormalizedErrorCode.NETWORK_ERROR) {
    // The one code whose whole content is the underlying cause.
    return "cause" in candidate;
  }

  if (typeof candidate["description"] !== "string") {
    return false;
  }

  // Fields each variant requires beyond the shared ones.
  if (code === NormalizedErrorCode.MESSAGE_NOT_FOUND) {
    return typeof candidate["messageId"] === "string";
  }

  if (code === NormalizedErrorCode.UNSUPPORTED_OPERATION) {
    return typeof candidate["operation"] === "string";
  }

  return true;
}
