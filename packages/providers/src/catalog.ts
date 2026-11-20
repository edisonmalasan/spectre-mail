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
 * available a minute ago can still refuse an address. No claim of freshness beyond
 * the TTL is made.
 *
 * @module
 */

import type { Domain } from "@spectre-mail/core";

import type { MailProvider } from "./contract";

/** Five minutes: long enough to be useful, short enough that a change is noticed. */
export const DOMAIN_CATALOG_TTL_MS = 5 * 60_000;

/** What a client needs from a catalog to offer a domain choice honestly. */
export interface DomainCatalog {
  /** The cached list, refreshing it first when the bounded TTL has elapsed. */
  listDomains(): Promise<Domain[]>;
  /** Fetch now, regardless of the TTL. */
  refresh(): Promise<Domain[]>;
}

/** Only the two contract members a catalog actually needs. */
type DomainSource = Pick<MailProvider, "id" | "listDomains">;

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

  async function fetchFresh(): Promise<Domain[]> {
    try {
      const listed = await provider.listDomains();
      const seen = new Set<string>();
      const domains: Domain[] = [];
      for (const entry of listed) {
        // A domain is only usable through the provider that served it. Dropping a
        // foreign entry is the honest reading; applying it here would construct an
        // address on a service that does not own the name.
        if (entry.provider !== provider.id || seen.has(entry.name)) continue;
        // Defense in depth: an adapter may already filter these, but a catalog must
        // never offer an inactive or expired domain no matter who reported it.
        if (!entry.active) continue;
        if (entry.expiresAt !== null && entry.expiresAt <= now()) continue;
        seen.add(entry.name);
        domains.push(entry);
      }
      cached = domains;
      fetchedAt = now();
      return [...domains];
    } catch {
      // No list is better than a fabricated one. A failure is not cached as a
      // successful empty answer, so the next call tries again.
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
  };
}
