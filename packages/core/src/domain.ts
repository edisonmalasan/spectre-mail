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
 * @module
 */

import type { ProviderId } from "./provider";

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
}
