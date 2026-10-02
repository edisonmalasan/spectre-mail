/**
 * Provider manager tests.
 *
 * The behaviours that matter here are about honesty: which provider actually
 * served a mailbox, and whether a client with one provider is made to pretend
 * otherwise.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, ProviderId, SpectreError } from "@spectre-mail/core";
import { describe, expect, it } from "vitest";

import type { MailProvider } from "./contract";
import { createProviderManager } from "./manager";

/** A provider whose every operation is scripted, so no recording is needed. */
function scriptedProvider(
  id: "mailtm" | "guerrilla",
  behaviour: {
    readonly create?: () => Promise<Mailbox>;
    readonly list?: (mailbox: Mailbox) => Promise<never[]>;
  } = {},
): MailProvider & { readonly listCalls: Mailbox[] } {
  const listCalls: Mailbox[] = [];

  const provider = {
    id,
    displayName: id,
    listCalls,
    supports: () => false,
    checkHealth: async () => ({ provider: id, status: "ok" as const }),
    createMailbox: async (): Promise<Mailbox> => {
      if (behaviour.create !== undefined) {
        return behaviour.create();
      }
      return {
        id: `${id}-mailbox`,
        provider: id,
        address: `someone@${id}.invalid`,
        createdAt: 0,
        credentials:
          id === "mailtm"
            ? { provider: "mailtm", accountId: "/accounts/x", accessToken: "t" }
            : { provider: "guerrilla", sessionId: "s" },
        status: "active",
      };
    },
    listMessages: async (mailbox: Mailbox) => {
      listCalls.push(mailbox);
      return behaviour.list === undefined ? [] : behaviour.list(mailbox);
    },
    getMessage: async () => {
      throw new Error("not scripted");
    },
  } satisfies MailProvider & { readonly listCalls: Mailbox[] };

  return provider;
}

describe("createProviderManager", () => {
  it("refuses to be built with no providers", () => {
    // A manager that cannot create a mailbox is not a degraded manager; it is a
    // configuration error, and failing at construction is when it is cheapest to see.
    expect(() => createProviderManager([])).toThrow(/at least one provider/);
  });

  it("refuses a provider configured twice", () => {
    // Two entries for one id makes the preference order ambiguous — which one is
    // "primary" becomes a matter of array position, silently.
    expect(() =>
      createProviderManager([scriptedProvider("guerrilla"), scriptedProvider("guerrilla")]),
    ).toThrow(/configured twice/);
  });

  it("creates with the first provider when it succeeds", async () => {
    const primary = scriptedProvider("mailtm");
    const fallback = scriptedProvider("guerrilla");

    const mailbox = await createProviderManager([primary, fallback]).createMailbox();

    expect(mailbox.provider).toBe("mailtm");
  });

  it("falls back to the next provider when the first cannot create", async () => {
    const primary = scriptedProvider("mailtm", {
      create: () => Promise.reject(throttled()),
    });
    const fallback = scriptedProvider("guerrilla");

    const mailbox = await createProviderManager([primary, fallback]).createMailbox();

    // The fallback must be visible as itself. Presenting it as the primary's result
    // would let a client claim a Mail.tm mailbox it does not have — and, for the
    // website, would hide that no fallback path exists at all.
    expect(mailbox.provider).toBe("guerrilla");
    expect(mailbox.credentials.provider).toBe("guerrilla");
  });

  it("names every provider it tried when all of them fail", async () => {
    const manager = createProviderManager([
      scriptedProvider("mailtm", { create: () => Promise.reject(throttled()) }),
      scriptedProvider("guerrilla", { create: () => Promise.reject(unreachable()) }),
    ]);

    const error = await capture(() => manager.createMailbox());

    // With more than one provider the composed wrapper stays, because there the
    // composed report genuinely is the answer: it names each provider that failed,
    // which no single provider's own failure can.
    const message = messageOf(error);
    expect(message).toContain("mailtm");
    expect(message).toContain("guerrilla");
    expect(message).toContain("RATE_LIMITED");
    expect(message).toContain("PROVIDER_UNAVAILABLE");
  });

  it("attempts no fallback when only one provider is configured", async () => {
    let attempts = 0;
    const only = scriptedProvider("guerrilla", {
      create: () => {
        attempts += 1;
        return Promise.reject(throttled("guerrilla"));
      },
    });

    const error = await capture(() => createProviderManager([only]).createMailbox());

    // Exactly one attempt. The website has one reachable provider and therefore no
    // redundancy; a manager that reported otherwise would present a known limitation
    // as a fallback path.
    expect(attempts).toBe(1);

    // And the failure that surfaces is the provider's own, naming the provider that
    // produced it rather than a wrapper describing the attempt.
    expect((error as SpectreError).provider).toBe("guerrilla");
  });

  it("preserves a single provider's failure as the cause it was", async () => {
    const only = scriptedProvider("guerrilla", {
      create: () => Promise.reject(throttled("guerrilla")),
    });

    const error = await capture(() => createProviderManager([only]).createMailbox());

    // The throttle's own description survives, so a client can tell the user to
    // come back rather than only that creation failed.
    expect(messageOf(error)).toContain("try again");

    // **And so does the normalized `code`**, which is the part a client cannot
    // reconstruct from prose. This assertion is what the previous version of this
    // test was missing: it checked the message and passed while the manager was
    // throwing a composed wrapper that destroyed `code` entirely.
    // `RATE_LIMITED` versus `PROVIDER_UNAVAILABLE` versus `AUTH_FAILED` is what
    // decides whether a user is told to wait, told the service is down, or told to
    // come back later.
    expect((error as SpectreError).code).toBe(NormalizedErrorCode.RATE_LIMITED);
  });

  it("rethrows the provider's own failure object for a single provider", async () => {
    const original = throttled("guerrilla");
    const only = scriptedProvider("guerrilla", {
      create: () => Promise.reject(original),
    });

    const error = await capture(() => createProviderManager([only]).createMailbox());

    // Identity, not just shape. Asserting the fields would pass for a copy, and a
    // copy built by the manager is precisely the wrapper this forbids - a copy can
    // drop `rateLimit` and nothing in the field assertions would notice.
    expect(error).toBe(original);

    // Narrowed rather than cast: `rateLimit` exists only on the rate-limited
    // variant, so reading it off the union without narrowing is the error the
    // discriminated type exists to prevent.
    const narrowed = error as Extract<
      SpectreError,
      { readonly code: typeof NormalizedErrorCode.RATE_LIMITED }
    >;
    expect(narrowed.rateLimit).toBe("1; w=60");
  });

  it("routes an existing mailbox to the provider that created it", async () => {
    const primary = scriptedProvider("mailtm");
    const fallback = scriptedProvider("guerrilla");
    const manager = createProviderManager([primary, fallback]);

    const mailbox = await manager.createMailbox();
    await manager.providerFor(mailbox).listMessages(mailbox);

    expect(primary.listCalls).toHaveLength(1);
    expect(fallback.listCalls).toHaveLength(0);
  });

  it("never falls back when reading a mailbox", async () => {
    const primary = scriptedProvider("mailtm", {
      create: () => Promise.reject(throttled()),
    });
    const fallback = scriptedProvider("guerrilla");
    const manager = createProviderManager([primary, fallback]);

    const mailbox = await manager.createMailbox();
    await manager.providerFor(mailbox).listMessages(mailbox);

    // Read the fallback's mailbox through the *primary* on purpose: the point is
    // that `providerFor` is driven by the mailbox's own provider field, never by
    // trying providers in order.
    expect(fallback.listCalls).toHaveLength(1);
    expect(primary.listCalls).toHaveLength(0);
  });

  it("refuses a mailbox belonging to an unconfigured provider", async () => {
    const manager = createProviderManager([scriptedProvider("guerrilla")]);
    const foreign = scriptedProvider("mailtm").createMailbox();

    const error = await capture(async () => {
      const mailbox = await foreign;
      manager.providerFor(mailbox);
    });

    // Serving a Mail.tm mailbox with a Guerrilla adapter would authenticate with the
    // wrong credentials. Better to name the mismatch than to attempt it.
    const message = messageOf(error);
    expect(message).toContain("mailtm");
    expect(message).toContain("guerrilla");
  });

  it("exposes its providers in preference order", () => {
    const primary = scriptedProvider("mailtm");
    const fallback = scriptedProvider("guerrilla");

    expect(createProviderManager([primary, fallback]).available.map((p) => p.id)).toEqual([
      "mailtm",
      "guerrilla",
    ]);
  });
});

function throttled(provider: ProviderId = "mailtm"): SpectreError {
  return {
    code: NormalizedErrorCode.RATE_LIMITED,
    provider,
    description: "Rate limited; try again in 60 seconds.",
    rateLimit: "1; w=60",
  };
}

function unreachable(): SpectreError {
  return {
    code: NormalizedErrorCode.PROVIDER_UNAVAILABLE,
    provider: "guerrilla",
    description: "The provider could not be reached.",
  };
}

/**
 * Await `operation` and return whatever it threw.
 *
 * Returns `unknown`, not `Error`, and that is the correction this file needed.
 * A `SpectreError` is a **plain discriminated object, not an `Error` subclass** -
 * deliberately, so narrowing by `code` gives a consumer exactly the fields that
 * code guarantees. This helper used to be typed `Promise<Error>` and rethrew
 * anything that was not an `Error`, so it could not return a `SpectreError` at
 * all. Every test here was therefore written against the assumption that the
 * manager always throws an `Error`, and that assumption is what let the manager
 * wrap a single provider's failure and destroy its `code` while the suite stayed
 * green.
 *
 * `conformance.ts` has its own correctly-typed equivalent using `isSpectreError`.
 */
async function capture(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation();
  } catch (cause) {
    return cause;
  }
  throw new Error("expected the operation to fail");
}

/** The failure's prose, whether it arrived as an `Error` or as a `SpectreError`. */
function messageOf(thrown: unknown): string {
  if (thrown instanceof Error) {
    return thrown.message;
  }
  const description = (thrown as { description?: unknown }).description;
  return typeof description === "string" ? description : String(thrown);
}
