/**
 * A domain a provider can actually use to create a mailbox.
 *
 * A domain is not a product-owned list. There are no domain literals in this
 * package, in the adapters, or in the catalog: every value here must come from a
 * provider's own domain API, and a provider with no such API exposes no domains.
 * This is the difference between a catalog of measured facts and a menu of
 * guesses — a guessed domain that cannot receive mail is a broken mailbox.
 *
 * The provider id is part of the value because a domain is only meaningful
 * together with the service that serves it. A catalog entry handed to
 * `createMailbox(domain?)` must never be applied to a different provider: doing
 * so would construct an address on a service that does not own that domain.
 *
 * Provenance is likewise provider-sourced or explicitly absent. Nothing here is
 * inferred from a domain's spelling, from a price, or from another provider's
 * data: the time a provider made a domain known, the runtime through which that
 * provider can be reached, the provider's own lifecycle value and its declared
 * capability flags travel with the domain only when the provider reported them.
 * A free/premium distinction is the one field that may be *omitted* rather than
 * nulled, because a provider that reports no such distinction must not be made
 * to carry one by inference.
 *
 * @module
 */

import type { ProviderId } from "./provider";

/**
 * The client runtime through which a provider's domains can be reached.
 *
 * Sourced only from a provider-reported interface signal or the client's own
 * configured provider list — never from a domain's spelling or from another
 * provider's data. See design.md D2.
 */
export type DomainRuntime = "website" | "extension";

/**
 * The provider's own lifecycle/status for a domain, normalized to the statuses
 * a picker must act on. `null` on {@link DomainProvenance.lifecycle} means the
 * provider sent no lifecycle signal at all.
 */
export type DomainLifecycle = "active" | "inactive" | "private" | "expired";

/**
 * A capability the provider declared for a particular domain.
 *
 * An empty {@link DomainProvenance.capabilities} set means the provider declared
 * none; it is not a claim that the capability is impossible. An unreported
 * answer is kept distinct from a known absence throughout this change.
 */
export type DomainCapability = "listDomains" | "createOnChosenDomain" | "restore";

/**
 * A free/premium distinction, carried **only** when a provider actually reported
 * one. No measured free-tier provider did, so no shipped adapter sets this and
 * no test invents a value for it.
 */
export type DomainTier = "free" | "premium";

/**
 * Provider-sourced provenance for one {@link Domain}.
 *
 * Absent values are explicit: `null` for a time, runtime or lifecycle the
 * provider did not report, and an empty capability set when it declared none.
 * The optional `tier` is the exception — it is omitted, not set to a guessed
 * default, when the provider reported no free/premium distinction.
 */
export interface DomainProvenance {
  /** When the provider made the domain known, in epoch milliseconds; `null` if unreported. */
  readonly discoveredAt: number | null;
  /** The runtime through which the provider can be reached; `null` if unreported. */
  readonly runtime: DomainRuntime | null;
  /** The provider's own lifecycle value; `null` if it sent none. */
  readonly lifecycle: DomainLifecycle | null;
  /** Capabilities the provider declared usable for this domain; empty if none. */
  readonly capabilities: readonly DomainCapability[];
  /** Present only when a provider actually reported a free/premium distinction. */
  readonly tier?: DomainTier;
}

/**
 * The honest value for a provider that reported no provenance at all.
 *
 * A single named constant rather than a literal at every construction site: an
 * adapter with no measurement must not be tempted to fill one field with a
 * plausible-looking guess. Frozen so the "absent" set cannot be grown in place.
 */
export const UNREPORTED_DOMAIN_PROVENANCE: DomainProvenance = Object.freeze({
  discoveredAt: null,
  runtime: null,
  lifecycle: null,
  capabilities: Object.freeze([]),
});

/**
 * One selectable domain, as reported by a provider.
 */
export interface Domain {
  /** The provider's own identifier for this domain, when it gave one; else the name. */
  readonly id: string;
  /** The exact domain name to put after `@` in a generated address. */
  readonly name: string;
  /** The provider that serves this domain. Never re-derived from the current client. */
  readonly provider: ProviderId;
  /** Whether the provider reports the domain as active. Inactive domains are not offered. */
  readonly active: boolean;
  /**
   * When the provider says this domain stops being valid, in epoch milliseconds —
   * or `null` when it sent no expiry. `null` is not "never expires"; it is "not
   * reported", and a caller must not turn it into a countdown.
   */
  readonly expiresAt: number | null;
  /** Everything else the provider reported about this domain, or explicit absences. */
  readonly provenance: DomainProvenance;
}
