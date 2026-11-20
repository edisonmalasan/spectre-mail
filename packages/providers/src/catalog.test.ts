/**
 * The in-memory domain catalog.
 *
 * The catalog is the boundary between a provider's live domain API and a client
 * that wants a picker. It caches for a bounded time, refreshes on demand, and
 * answers `[]` when the provider is unreachable — because a picker built from a
 * stale or invented list would offer mailboxes that cannot be created.
 *
 * @module
 */

import type { Domain } from "@spectre-mail/core";
import { describe, expect, it } from "vitest";

import { createDomainCatalog, DOMAIN_CATALOG_TTL_MS } from "./catalog";
import type { MailProvider } from "./contract";
import { providerOnlyEnvironment } from "./environments";
import { createGuerrillaAdapter } from "./guerrilla";

/** A domain fixture using reserved names, never a production domain. */
function domain(name: string): Domain {
  return {
    id: `domains/${name}`,
    name,
    provider: "mailtm",
    active: true,
    expiresAt: null,
  };
}

/** A provider whose domain listing is counted and can be made to fail. */
function countable(pages: readonly (readonly Domain[])[]): {
  readonly provider: Pick<MailProvider, "id" | "listDomains">;
  readonly calls: () => number;
} {
  let calls = 0;
  return {
    calls: () => calls,
    provider: {
      id: "mailtm",
      listDomains: async () => {
        calls += 1;
        return [...(pages[Math.min(calls - 1, pages.length - 1)] ?? [])];
      },
    },
  };
}

/** A clock a test advances explicitly, so the TTL is measured and not guessed. */
function clock(start: number): {
  readonly now: () => number;
  readonly advance: (by: number) => void;
} {
  let current = start;
  return {
    now: () => current,
    advance: (by) => {
      current += by;
    },
  };
}

describe("the in-memory domain catalog", () => {
  it("fetches once within the TTL and refreshes after it", async () => {
    const { provider, calls } = countable([[domain("alpha.example")]]);
    const time = clock(1_000);
    const catalog = createDomainCatalog(provider, { now: time.now });

    expect(await catalog.listDomains()).toEqual([domain("alpha.example")]);
    expect(await catalog.listDomains()).toEqual([domain("alpha.example")]);
    expect(calls()).toBe(1);

    time.advance(DOMAIN_CATALOG_TTL_MS);
    expect(await catalog.listDomains()).toEqual([domain("alpha.example")]);
    expect(calls()).toBe(2);
  });

  it("refreshes on demand, without waiting for the TTL", async () => {
    const { provider, calls } = countable([[domain("alpha.example")]]);
    const catalog = createDomainCatalog(provider, { now: clock(1_000).now });

    expect(await catalog.listDomains()).toHaveLength(1);
    expect(await catalog.refresh()).toHaveLength(1);
    expect(calls()).toBe(2);
  });

  it("returns an empty list when the provider fails, and recovers on a later call", async () => {
    let fails = true;
    const provider: Pick<MailProvider, "id" | "listDomains"> = {
      id: "mailtm",
      listDomains: async () => {
        if (fails) throw new Error("offline");
        return [domain("alpha.example")];
      },
    };
    const catalog = createDomainCatalog(provider, { now: clock(1_000).now });

    expect(await catalog.listDomains()).toEqual([]);
    fails = false;
    // A failure is not cached as a successful empty answer: the next call retries.
    expect(await catalog.listDomains()).toEqual([domain("alpha.example")]);
  });

  it("dedupes by name, keeping the first of each", async () => {
    const { provider } = countable([
      [domain("alpha.example"), domain("alpha.example"), domain("beta.example")],
    ]);
    const catalog = createDomainCatalog(provider, { now: clock(1_000).now });

    expect((await catalog.listDomains()).map((each) => each.name)).toEqual([
      "alpha.example",
      "beta.example",
    ]);
  });

  it("is empty for Guerrilla, which assigns addresses and has no domain API", async () => {
    // Built over the real adapter with no recorded provider requests: a catalog
    // over Guerrilla must not manufacture domains or make a network call.
    const adapter = createGuerrillaAdapter(providerOnlyEnvironment([]));
    const catalog = createDomainCatalog(adapter, { now: clock(1_000).now });

    expect(await catalog.listDomains()).toEqual([]);
  });
});
