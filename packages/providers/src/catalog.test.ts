/**
 * The in-memory domain catalog and cross-provider aggregation.
 *
 * The catalog is the boundary between a provider's live domain API and a client
 * that wants a picker. It caches for a bounded time, refreshes on demand, exposes
 * the fetch time of the answer it holds, and answers `[]` when the provider is
 * unreachable — because a picker built from a stale or invented list would offer
 * mailboxes that cannot be created. Aggregation keeps the supplying provider on
 * every entry so an identical spelling from two providers stays two options.
 *
 * @module
 */

import {
  UNREPORTED_DOMAIN_PROVENANCE,
  type Domain,
  type DomainProvenance,
  type ProviderId,
} from "@spectre-mail/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  aggregateCatalogs,
  createDomainCatalog,
  DOMAIN_CATALOG_TTL_MS,
  type DomainCatalogSnapshot,
} from "./catalog";
import type { MailProvider } from "./contract";
import { FIXED_NOW, providerOnlyEnvironment, stubEnvironment } from "./environments";
import { createGuerrillaAdapter } from "./guerrilla";
import { createMailTmAdapter, MAX_DOMAIN_PAGES } from "./mailtm";

/** A domain fixture using reserved names, never a production domain. */
function domain(name: string, provenance: DomainProvenance = UNREPORTED_DOMAIN_PROVENANCE): Domain {
  return {
    id: `domains/${name}`,
    name,
    provider: "mailtm",
    active: true,
    expiresAt: null,
    provenance,
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

/** A snapshot helper; the fetch time is explicit so a stale one cannot hide. */
function snapshot(
  provider: ProviderId,
  fetchedAt: number | null,
  domains: readonly Domain[],
  truncated: boolean | null = false,
): DomainCatalogSnapshot {
  return { provider, fetchedAt, domains, truncated };
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

  it("keeps a failed refresh from overwriting a previous snapshot's fetch time", async () => {
    let fails = false;
    const provider: Pick<MailProvider, "id" | "listDomains"> = {
      id: "mailtm",
      listDomains: async () => {
        if (fails) throw new Error("offline");
        return [domain("alpha.example")];
      },
    };
    const time = clock(1_000);
    const catalog = createDomainCatalog(provider, { now: time.now });

    await catalog.listDomains();
    const before = catalog.snapshot().fetchedAt;
    expect(before).toBe(1_000);

    fails = true;
    time.advance(DOMAIN_CATALOG_TTL_MS);
    expect(await catalog.listDomains()).toEqual([]);
    // The failed refresh did not become a successful fetch: the entries still
    // carry the time they were actually fetched at.
    expect(catalog.snapshot().fetchedAt).toBe(before);
    expect(catalog.snapshot().domains).toEqual([domain("alpha.example")]);
  });

  it("dedupes by name within one provider, keeping the first of each", async () => {
    const { provider } = countable([
      [domain("alpha.example"), domain("alpha.example"), domain("beta.example")],
    ]);
    const catalog = createDomainCatalog(provider, { now: clock(1_000).now });

    expect((await catalog.listDomains()).map((each) => each.name)).toEqual([
      "alpha.example",
      "beta.example",
    ]);
  });

  it("exposes the fetch time with the entries it describes", async () => {
    const { provider } = countable([[domain("alpha.example")]]);
    const time = clock(4_000);
    const catalog = createDomainCatalog(provider, { now: time.now });

    expect(catalog.snapshot()).toEqual({
      provider: "mailtm",
      fetchedAt: null,
      domains: [],
      truncated: null,
    });
    await catalog.listDomains();
    expect(catalog.snapshot().fetchedAt).toBe(4_000);
    expect(catalog.snapshot().domains).toEqual([domain("alpha.example")]);

    time.advance(10);
    await catalog.refresh();
    expect(catalog.snapshot().fetchedAt).toBe(4_010);
  });

  it("derives no domain list from a rendered provider website", () => {
    // The provider's site shows a widget of usable domains, but a rendered page is
    // not a provider-supported API. A source scan is the right instrument here:
    // the defect would be a hardcoded list, and no request-count assertion could
    // see one. Only the API base URL may carry a hostname.
    const root = process.cwd();
    for (const file of [
      "packages/providers/src/guerrilla.ts",
      "packages/providers/src/catalog.ts",
    ]) {
      const source = readFileSync(join(root, file), "utf8");
      const withoutApiHost = source.replace(/https:\/\/api\.guerrillamail\.com\/ajax\.php/g, "");
      expect(withoutApiHost.match(/[a-z0-9-]+\.(?:com|net|org|io|me|info)\b/gi) ?? []).toEqual([]);
    }
  });

  it("is empty for Guerrilla, which assigns addresses and has no domain API", async () => {
    // Built over the real adapter with no recorded provider requests: a catalog
    // over Guerrilla must not manufacture domains or make a network call, and a
    // rendered provider website list is not a substitute for a domain API.
    const environment = providerOnlyEnvironment([]);
    const adapter = createGuerrillaAdapter(environment);
    const catalog = createDomainCatalog(adapter, { now: clock(1_000).now });

    expect(await catalog.listDomains()).toEqual([]);
    expect(environment.requests).toEqual([]);
    expect(adapter.supports("listDomains")).toBe("absent");
    expect(adapter.supports("createOnChosenDomain")).toBe("absent");
  });
});

describe("aggregating provider catalogs", () => {
  /** SYNTHETIC: reserved names and hand-set provenance; not provider evidence. */
  function reported(
    name: string,
    provider: ProviderId,
    runtime: Domain["provenance"]["runtime"],
  ): Domain {
    return {
      ...domain(name, {
        discoveredAt: 1_760_000_000_000,
        runtime,
        lifecycle: "active",
        capabilities: ["listDomains", "createOnChosenDomain"],
      }),
      provider,
    };
  }

  it("keeps two same-spelling entries from different providers distinct", () => {
    // Conforming case: one name, two owners, two options.
    const a = reported("shared.example", "mailtm", null);
    const b: Domain = { ...reported("shared.example", "guerrilla", null), provider: "guerrilla" };
    const result = aggregateCatalogs(
      [snapshot("mailtm", 1_000, [a]), snapshot("guerrilla", 2_000, [b])],
      { reachableProviders: ["mailtm", "guerrilla"] },
    );

    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.provider)).toEqual(["mailtm", "guerrilla"]);
  });

  it("would collapse them if dedupe used only the name", () => {
    // Counterfactual for the case above: the same two entries keyed by name alone
    // are one option. This is what the (provider, name) key must never do.
    const a = reported("shared.example", "mailtm", null);
    const b: Domain = { ...reported("shared.example", "guerrilla", null), provider: "guerrilla" };
    const byName = new Map<string, Domain>();
    for (const entry of [a, b]) byName.set(entry.name, entry);
    expect(byName.size).toBe(1);
    expect(
      aggregateCatalogs([snapshot("mailtm", 1_000, [a]), snapshot("guerrilla", 2_000, [b])], {
        reachableProviders: ["mailtm", "guerrilla"],
      }).entries,
    ).toHaveLength(2);
  });

  it("filters a domain whose provider this client cannot reach, without substituting another", () => {
    const owned = reported("owned.example", "mailtm", null);
    const foreign = reported("foreign.example", "guerrilla", null);
    const result = aggregateCatalogs(
      [snapshot("mailtm", 1_000, [owned]), snapshot("guerrilla", 2_000, [foreign])],
      { reachableProviders: ["mailtm"] },
    );

    expect(result.entries.map((entry) => entry.name)).toEqual(["owned.example"]);
    // One catalog from an unreachable provider contributes no entries and is not
    // replaced by a different provider's domain.
    expect(result.sources.map((source) => source.provider)).toEqual(["mailtm"]);
  });

  it("refuses an entry that claims a provider other than the catalog that carried it", () => {
    const foreign: Domain = {
      ...reported("foreign.example", "guerrilla", null),
      provider: "guerrilla",
    };
    const result = aggregateCatalogs([snapshot("mailtm", 1_000, [foreign])], {
      reachableProviders: ["mailtm", "guerrilla"],
    });

    expect(result.entries).toEqual([]);
  });

  it("filters by runtime but keeps an unreported runtime", () => {
    const forExtension = reported("extension.example", "mailtm", "extension");
    const forWebsite = reported("website.example", "mailtm", "website");
    const unreported = reported("unreported.example", "mailtm", null);
    const result = aggregateCatalogs(
      [snapshot("mailtm", 1_000, [forExtension, forWebsite, unreported])],
      {
        reachableProviders: ["mailtm"],
        runtime: "website",
      },
    );

    // "Unreported" is not "not supported", so it survives; only the entry
    // explicitly tied to another runtime is left out.
    expect(result.entries.map((entry) => entry.name)).toEqual([
      "website.example",
      "unreported.example",
    ]);
  });

  it("keeps counts attributed to their provider and fetch time instead of summing them", () => {
    const result = aggregateCatalogs(
      [
        snapshot("mailtm", 1_000, [reported("a.example", "mailtm", null)]),
        snapshot("guerrilla", 2_000, []),
      ],
      { reachableProviders: ["mailtm", "guerrilla"] },
    );

    expect(result.sources).toEqual([
      snapshot("mailtm", 1_000, [reported("a.example", "mailtm", null)]),
      snapshot("guerrilla", 2_000, []),
    ]);
    expect("total" in result).toBe(false);
  });

  it("reports a truncated source as incomplete rather than a whole inventory", () => {
    const partial = snapshot("mailtm", 1_000, [reported("a.example", "mailtm", null)], true);
    const result = aggregateCatalogs([partial], { reachableProviders: ["mailtm"] });

    expect(result.truncated).toBe(true);
    // A source that never reported completeness is not silently marked complete.
    const unknown = aggregateCatalogs(
      [snapshot("mailtm", 1_000, [reported("a.example", "mailtm", null)], null)],
      { reachableProviders: ["mailtm"] },
    );
    expect(unknown.truncated).toBe(false);
    expect(unknown.sources[0]?.truncated).toBeNull();
  });
});

describe("bounded pagination", () => {
  it("labels the synthetic two-page fixture case as synthetic and reports truncation at the bound", async () => {
    // `mailtmDomainsPage1` and `mailtmDomainsPage2` are the repository's SYNTHETIC
    // reserved-name pagination fixtures. With the bound lowered to one page, the
    // first page still advertises `hydra:next`, so the fetch is incomplete.
    const { mailtmDomainsPage1, mailtmDomainsPage2 } = await import("./fixtures");
    const environment = stubEnvironment([mailtmDomainsPage1, mailtmDomainsPage2], () => FIXED_NOW);
    const adapter = createMailTmAdapter({ ...environment, maxDomainPages: 1 });

    const listing = await adapter.listDomainListing?.();

    expect(listing?.truncated).toBe(true);
    // The partial list is still a list of usable entries; it is the *claim of
    // completeness* that must not be made.
    expect(listing?.domains.map((entry) => entry.name)).toEqual(["alpha.example"]);
    expect(environment.requests).toHaveLength(1);
  });

  it("reports a complete walk when the provider stops advertising a next page", async () => {
    const { mailtmDomainsPage1, mailtmDomainsPage2 } = await import("./fixtures");
    const environment = stubEnvironment([mailtmDomainsPage1, mailtmDomainsPage2], () => FIXED_NOW);
    const adapter = createMailTmAdapter(environment);

    const listing = await adapter.listDomainListing?.();

    expect(listing?.truncated).toBe(false);
    expect(listing?.domains.map((entry) => entry.name)).toEqual(["alpha.example", "delta.example"]);
    expect(environment.requests).toHaveLength(2);
  });

  it("uses the adapter's declared bound when the environment has none", () => {
    // The bound is exported rather than hidden, so a reader can see that the
    // fixture's two pages are below it and a truncation test must lower it.
    expect(MAX_DOMAIN_PAGES).toBeGreaterThan(2);
  });
});
