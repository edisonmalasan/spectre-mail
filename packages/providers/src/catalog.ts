/**
 * An in-memory catalog of provider-sourced domains.
 *
 * Nothing here is persisted and nothing here is hardcoded. The only source of a
 * domain is the provider's own `listDomains()` answer; the catalog caches that
 * answer for a bounded time so a picker does not spend the provider's unauthenticated
 * request window on every render, and it refreshes on demand. A provider failure
 * yields an empty list rather than a stale guess or an invented name.
 *
 * The value is a snapshot, not a promise of deliverability: a domain that was
 * available a minute ago can still refuse an address. The snapshot therefore
 * carries its own fetch time and completeness instead of implying either.
 *
 * Aggregation keeps every entry bound to the provider that supplied it. Two
 * identically spelled domains from two providers are two options, not one
 * interchangeable entry — the dedupe key is `(provider id, domain name)`. Counts
 * stay attributed to their provider and fetch time and are never summed into one
 * inventory figure.
 *
 * @module
 */

import { UNREPORTED_DOMAIN_PROVENANCE } from "@spectre-mail/core";
import type { Domain, DomainProvenance, DomainRuntime, ProviderId } from "@spectre-mail/core";

import type { MailProvider } from "./contract";

/** Five minutes: long enough to be useful, short enough that a change is noticed. */
export const DOMAIN_CATALOG_TTL_MS = 5 * 60_000;

/**
 * What one catalog knows about the answer it is holding.
 *
 * `fetchedAt` is `null` before the first successful fetch. `truncated` is `null`
 * when the provider did not report completeness at all — an unreported answer is
 * distinct from a reported `false`, for the same reason an unobserved capability
 * is distinct from a known-absent one.
 */
export interface DomainCatalogSnapshot {
  readonly provider: ProviderId;
  readonly fetchedAt: number | null;
  readonly domains: readonly Domain[];
  readonly truncated: boolean | null;
}

/** What a client needs from a catalog to offer a domain choice honestly. */
export interface DomainCatalog {
  /** The cached list, refreshing it first when the bounded TTL has elapsed. */
  listDomains(): Promise<Domain[]>;
  /** Fetch now, regardless of the TTL. */
  refresh(): Promise<Domain[]>;
  /** The answer it is currently holding, including its own provenance. */
  snapshot(): DomainCatalogSnapshot;
}

/**
 * Read provenance defensively.
 *
 * Provider data is untrusted, and an older or hand-built `Domain` may not carry
 * the field at all. Treating that as "unreported" keeps a picker working rather
 * than throwing inside the catalog and silently returning an empty list — which
 * would look exactly like a provider with no domains.
 */
function provenanceOf(entry: Domain): DomainProvenance {
  return entry.provenance ?? UNREPORTED_DOMAIN_PROVENANCE;
}

/** Only the contract members a catalog actually needs. */
type DomainSource = Pick<MailProvider, "id" | "listDomains" | "listDomainListing">;

/**
 * Build a catalog over `provider`.
 *
 * `now` and `ttlMs` are injected so a test can advance time rather than sleep, and
 * so the TTL has one declared home instead of a literal at each caller.
 */
export function createDomainCatalog(
  provider: DomainSource,
  options: { readonly now?: () => number; readonly ttlMs?: number } = {},
): DomainCatalog {
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? DOMAIN_CATALOG_TTL_MS;

  let cached: Domain[] | null = null;
  let fetchedAt: number | null = null;
  let truncated: boolean | null = null;

  async function fetchFresh(): Promise<Domain[]> {
    try {
      // A provider that can say whether it was bounded gets asked; one that cannot
      // keeps `truncated: null` rather than having an answer invented for it.
      const listing =
        provider.listDomainListing === undefined
          ? { domains: await provider.listDomains(), truncated: null }
          : await provider.listDomainListing();
      const seen = new Set<string>();
      const domains: Domain[] = [];
      for (const entry of listing.domains) {
        // A domain is only usable through the provider that served it. Dropping a
        // foreign entry is the honest reading; applying it here would construct an
        // address on a service that does not own the name.
        if (entry.provider !== provider.id || seen.has(entry.name)) continue;
        // Defense in depth: an adapter may already filter these, but a catalog must
        // never offer an inactive, private or expired domain no matter who reported it.
        if (!entry.active) continue;
        const provenance = provenanceOf(entry);
        if (
          provenance.lifecycle === "private" ||
          provenance.lifecycle === "inactive" ||
          provenance.lifecycle === "expired"
        ) {
          continue;
        }
        if (entry.expiresAt !== null && entry.expiresAt <= now()) continue;
        seen.add(entry.name);
        domains.push(entry);
      }
      cached = domains;
      fetchedAt = now();
      truncated = listing.truncated;
      return [...domains];
    } catch {
      // No list is better than a fabricated one. A failure is not cached as a
      // successful empty answer, so the next call tries again and the previous
      // snapshot keeps its own fetch time.
      return [];
    }
  }

  return {
    async listDomains(): Promise<Domain[]> {
      if (cached !== null && fetchedAt !== null && now() - fetchedAt < ttlMs) {
        return [...cached];
      }
      return fetchFresh();
    },
    refresh: fetchFresh,
    snapshot(): DomainCatalogSnapshot {
      return {
        provider: provider.id,
        fetchedAt,
        domains: cached === null ? [] : [...cached],
        truncated,
      };
    },
  };
}

/** The policy options for combining provider catalogs into one usable list. */
export interface AggregateOptions {
  /** The providers this client can actually reach; a foreign entry is filtered out. */
  readonly reachableProviders: readonly ProviderId[];
  /**
   * The runtime the client offers. An entry with an unreported runtime is kept —
   * "not reported" is not "not supported" — while one explicitly tied to another
   * runtime is left out.
   */
  readonly runtime?: DomainRuntime;
  /** Injected so a test can judge expiry against a fixed instant. */
  readonly now?: () => number;
}

/**
 * The combined answer, with its provenance kept rather than flattened away.
 */
export interface AggregatedDomains {
  /** Entries kept, each still bound to the provider that supplied it. */
  readonly entries: readonly Domain[];
  /** One snapshot per contributing provider; counts stay attributed, never summed. */
  readonly sources: readonly DomainCatalogSnapshot[];
  /** True when any contributing source reported a truncated fetch. */
  readonly truncated: boolean;
}

/**
 * Combine catalog snapshots without collapsing identity.
 *
 * The dedupe key is the pair `(provider id, domain name)`: an identical spelling
 * from two providers stays as two distinct entries. An entry is offered only
 * when its provider is reachable and its own reported state does not rule it out.
 */
export function aggregateCatalogs(
  snapshots: readonly DomainCatalogSnapshot[],
  options: AggregateOptions,
): AggregatedDomains {
  const reachable = new Set<ProviderId>(options.reachableProviders);
  const now = options.now ?? (() => Date.now());
  const sources: DomainCatalogSnapshot[] = [];
  const entries: Domain[] = [];
  const seen = new Set<string>();
  let truncated = false;

  for (const snapshot of snapshots) {
    if (!reachable.has(snapshot.provider)) continue;
    sources.push(snapshot);
    if (snapshot.truncated === true) truncated = true;

    for (const entry of snapshot.domains) {
      // Never adopt an entry whose declared owner differs from the catalog that
      // carried it, whatever its name says.
      if (entry.provider !== snapshot.provider) continue;
      if (!entry.active) continue;
      const provenance = provenanceOf(entry);
      if (
        provenance.lifecycle === "private" ||
        provenance.lifecycle === "inactive" ||
        provenance.lifecycle === "expired"
      ) {
        continue;
      }
      if (entry.expiresAt !== null && entry.expiresAt <= now()) continue;
      const runtime = provenance.runtime;
      if (options.runtime !== undefined && runtime !== null && runtime !== options.runtime) {
        continue;
      }
      // The pair, never the name alone: same-spelling domains from different
      // providers remain two options and are never interchangeable.
      const key = `${entry.provider}\u0000${entry.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }

  return { entries, sources, truncated };
}
