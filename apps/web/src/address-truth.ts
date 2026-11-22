/**
 * The website's three address-truth claims, as its own data.
 *
 * ## Why this is its own module
 *
 * M22's `provider-catalog` requirement names three facts that this repository had been keeping
 * apart only in prose: a domain is **available in a provider catalog**, a mailbox has been
 * **provisioned and confirmed by its provider**, and mail has actually arrived from an external
 * sender. The first two are reachable from values the website already holds. The third is not:
 * this repository has never received verification mail from a service, so the only truthful
 * wording for it is the one GOAL §8 names.
 *
 * **The website needs no selection UX change** (M22 task 5.5): its picker, generation token,
 * coalescing guard and five-region composition already satisfy the choice requirement. This
 * module is the copy half of task 4.3 — a claim reviewable beside the requirement it serves and
 * a test able to read what the page can say without scraping rendered text for it.
 *
 * ## Why there is no `deliveryVerified` value here
 *
 * A recorded fixture and a successful create are both evidence about provisioning, never about
 * delivery. There is no caller in this build that can observe an external sender, so a
 * "delivery verified" string would be a schema with no source — the kind of second spelling this
 * repository refuses to write. The delivery claim is therefore one fixed string, held under a
 * name that says it is unverified.
 *
 * @module
 */

/** The three claims, from weakest to strongest. */
export const WEBSITE_ADDRESS_TRUTH = {
  /** The domain was offered by a provider catalog this client can reach. */
  catalogAvailable: "Available in a provider catalog",
  /** The provider confirmed the mailbox it created. */
  provisioned: "Provisioned and confirmed by the provider",
  /** No external sender has been observed, so no delivery claim can be made. */
  deliveryUnverified: "LIVE DELIVERY NOT VERIFIED",
} as const;

/** What the website is entitled to report after one observation. */
export interface WebsiteAddressTruthReport {
  readonly catalogAvailable: boolean;
  readonly provisionedByProvider: boolean;
  readonly delivery: string;
}

/**
 * Report the three claims separately.
 *
 * A recorded response is accepted because a recording can show a provider's own confirmation;
 * it is refused permission to change the delivery sentence. The two booleans are reported as
 * independent facts so a catalog entry can be reported without a mailbox and a provisioned
 * mailbox can be reported without ever implying that mail arrived.
 */
export function reportWebsiteAddressTruth(evidence: {
  readonly inCatalog: boolean;
  readonly providerConfirmed: boolean;
  readonly recorded: boolean;
}): WebsiteAddressTruthReport {
  return {
    catalogAvailable: evidence.inCatalog,
    provisionedByProvider: evidence.providerConfirmed,
    delivery: WEBSITE_ADDRESS_TRUTH.deliveryUnverified,
  };
}
