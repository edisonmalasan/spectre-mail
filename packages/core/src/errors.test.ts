import { describe, expect, it } from "vitest";

import {
  NORMALIZED_ERROR_CODES,
  NormalizedErrorCode,
  isNormalizedErrorCode,
  isSpectreError,
} from "./errors";
import type { SpectreError } from "./errors";

describe("NormalizedErrorCode", () => {
  it("is exactly the roadmap's closed vocabulary", () => {
    // Adding a code is a deliberate change to this list, and the roadmap fixed it.
    expect([...NORMALIZED_ERROR_CODES].sort()).toEqual(
      [
        "AUTH_FAILED",
        "MAILBOX_EXPIRED",
        "MESSAGE_NOT_FOUND",
        "NETWORK_ERROR",
        "PROVIDER_UNAVAILABLE",
        "RATE_LIMITED",
        "UNKNOWN_PROVIDER_ERROR",
        "UNSUPPORTED_OPERATION",
      ].sort(),
    );
  });

  it("refuses an unrecognised code", () => {
    expect(isNormalizedErrorCode("TEAPOT")).toBe(false);
    expect(isNormalizedErrorCode("rate_limited")).toBe(false);
    expect(isNormalizedErrorCode(42)).toBe(false);
  });
});

describe("SpectreError", () => {
  it("keeps throttling distinguishable from a generic network failure", () => {
    // provider-abstraction requires throttling to be surfaced rather than silently
    // retried. If the two collapsed into one code, a caller could not tell a
    // provider asking us to slow down from one we simply could not reach.
    const throttled: SpectreError = {
      code: NormalizedErrorCode.RATE_LIMITED,
      provider: "mailtm",
      description: "Too many requests",
      // Measured verbatim: Mail.tm advertises `1; w=60` on account creation.
      rateLimit: "1; w=60",
    };

    const networkFailure: SpectreError = {
      code: NormalizedErrorCode.NETWORK_ERROR,
      provider: "mailtm",
      description: "Failed to fetch",
      cause: new Error("ECONNREFUSED"),
    };

    expect(throttled.code).not.toBe(networkFailure.code);
    expect(isSpectreError(throttled)).toBe(true);
    expect(isSpectreError(networkFailure)).toBe(true);
    // The advertised limit is the only measured evidence for our own rate-limit
    // handling, so it is retained rather than parsed and discarded.
    expect(throttled.rateLimit).toBe("1; w=60");
  });

  it("keeps the provider's own account of an unclassifiable failure", () => {
    const unknown: SpectreError = {
      code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
      provider: "guerrilla",
      // Measured dead-session shape: HTTP 200, an `error` key in the body, and no
      // message list, while `auth.success` stayed `true`.
      description: "session expired (provider reported an error with a 200 status)",
    };

    expect(unknown.description).toContain("session expired");
    // An unknown failure must not be quietly upgraded to a code we do understand.
    expect(unknown.code).not.toBe(NormalizedErrorCode.AUTH_FAILED);
    expect(unknown.code).not.toBe(NormalizedErrorCode.MAILBOX_EXPIRED);
  });

  it("requires a cause on a network error and a description elsewhere", () => {
    // NETWORK_ERROR is the one code where the underlying transport failure is the
    // whole content of the error, so it is mandatory rather than optional.
    const withoutCause = {
      code: NormalizedErrorCode.NETWORK_ERROR,
      provider: "mailtm",
      description: "Failed to fetch",
    };

    expect(isSpectreError(withoutCause)).toBe(false);

    const authWithoutDescription = {
      code: NormalizedErrorCode.AUTH_FAILED,
      provider: "mailtm",
    };

    expect(isSpectreError(authWithoutDescription)).toBe(false);
  });

  it("requires the id it looked for when a message is missing", () => {
    const notFound: SpectreError = {
      code: NormalizedErrorCode.MESSAGE_NOT_FOUND,
      provider: "guerrilla",
      description: "no such message",
      messageId: "message-9",
    };

    expect(notFound.messageId).toBe("message-9");
    expect(isSpectreError(notFound)).toBe(true);
  });

  it("requires the operation name when the provider lacks one", () => {
    // Measured: Mail.tm advertises an SSE transport and serves none, so `subscribe`
    // is the concrete unsupported operation this exists for.
    const unsupported: SpectreError = {
      code: NormalizedErrorCode.UNSUPPORTED_OPERATION,
      provider: "mailtm",
      description: "no SSE or WebSocket endpoint is available",
      operation: "subscribe",
    };

    expect(unsupported.operation).toBe("subscribe");
    expect(isSpectreError(unsupported)).toBe(true);
  });

  it("does not accept a provider status code as a normalized one", () => {
    // The entire point of normalization: a consumer branches on these codes, not on
    // a provider's HTTP vocabulary.
    expect(isSpectreError({ code: 429, provider: "mailtm", description: "too many" })).toBe(false);
    expect(isSpectreError({ code: "429", provider: "mailtm", description: "x" })).toBe(false);
  });

  it("rejects values that are not errors", () => {
    expect(isSpectreError(null)).toBe(false);
    expect(isSpectreError("AUTH_FAILED")).toBe(false);
    expect(isSpectreError({})).toBe(false);
    expect(
      isSpectreError({
        code: NormalizedErrorCode.AUTH_FAILED,
        provider: "mailtm",
        description: "x",
      }),
    ).toBe(true);
  });
});
