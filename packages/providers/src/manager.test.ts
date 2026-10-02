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
import type { Mailbox, SpectreError } from "@spectre-mail/core";
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

    // Both names present, so a reader can tell which providers are actually out
    // rather than guessing from "something went wrong".
    expect(error.message).toContain("mailtm");
    expect(error.message).toContain("guerrilla");
    expect(error.message).toContain("RATE_LIMITED");
    expect(error.message).toContain("PROVIDER_UNAVAILABLE");
  });

  it("attempts no fallback when only one provider is configured", async () => {
    let attempts = 0;
    const only = scriptedProvider("guerrilla", {
      create: () => {
        attempts += 1;
        return Promise.reject(throttled());
      },
    });

    const error = await capture(() => createProviderManager([only]).createMailbox());

    // Exactly one attempt. The website has one reachable provider and therefore no
    // redundancy; a manager that reported otherwise would present a known limitation
    // as a fallback path.
    expect(attempts).toBe(1);
    expect(error.message).toContain("guerrilla");
  });

  it("preserves a single provider's failure as the cause it was", async () => {
    const only = scriptedProvider("guerrilla", {
      create: () => Promise.reject(throttled()),
    });

    const error = await capture(() => createProviderManager([only]).createMailbox());

    // The throttle's own description survives into the report, so a client can tell
    // the user to come back rather than only that creation failed.
    expect(error.message).toContain("try again");
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
    expect(error.message).toContain("mailtm");
    expect(error.message).toContain("guerrilla");
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

function throttled(): SpectreError {
  return {
    code: NormalizedErrorCode.RATE_LIMITED,
    provider: "mailtm",
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

async function capture(operation: () => Promise<unknown>): Promise<Error> {
  try {
    await operation();
    throw new Error("expected the operation to fail");
  } catch (cause) {
    if (cause instanceof Error) {
      return cause;
    }
    throw cause;
  }
}
