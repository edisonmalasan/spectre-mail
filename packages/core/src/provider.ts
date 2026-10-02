/**
 * Provider identity.
 *
 * A provider id is SpectreMail's own closed vocabulary. It is a domain concept,
 * not wire format: knowing which provider issued a mailbox is something the
 * product must record, whereas knowing that provider calls a field `token` is
 * something only its adapter may know.
 *
 * Why the set is closed rather than open: `provider-abstraction` requires provider
 * roles to be assigned per client, not globally. The website reaches Guerrilla
 * Mail only; the extension reaches Mail.tm as primary with Guerrilla as fallback.
 * A record naming a provider the current client may not reach must be
 * identifiable so its absence can be *reported*, not silently coerced to whatever
 * provider happens to be reachable. An open string type would make that a runtime
 * accident instead of a compile-time fact.
 *
 * @module
 */

/**
 * The providers SpectreMail knows about.
 *
 * Membership is part of the domain contract. Adding a provider is a deliberate
 * change to this union, which forces a decision about which clients may reach it.
 */
export const PROVIDER_IDS = ["mailtm", "guerrilla"] as const;

/**
 * Identifies the provider that produced a piece of data.
 *
 * This value travels with stored records and is never re-derived from whatever a
 * client currently defaults to. A mailbox read from storage in a later session
 * must still say which provider issued it, or it cannot be routed, reported on, or
 * deleted correctly.
 */
export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * Narrow an unknown value to a {@link ProviderId}.
 *
 * Deliberately a type guard and nothing more: this never coerces, defaults, or
 * falls back. An unrecognised provider name is a real condition that has to
 * surface as an error, because mapping it onto a plausible-looking known provider
 * would attribute a failure to the wrong provider.
 */
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Return `value` as a {@link ProviderId}, or throw if it is not one.
 *
 * Use where a provider id must be present and a missing or unknown value is a
 * programming or data error rather than an expected runtime condition. Prefer
 * {@link isProviderId} where an absent provider is an expected outcome that should
 * be handled rather than thrown.
 *
 * This throws a plain `Error` rather than a member of the normalized error
 * vocabulary in `./errors.ts`. The normalized failures describe what a *provider*
 * did; this one describes what *our own stored data* contained. Folding the two
 * together would let a caller mistake a corrupt record for a provider outage.
 */
export function assertProviderId(value: unknown): ProviderId {
  if (!isProviderId(value)) {
    throw new Error(
      `Not a known SpectreMail provider: ${JSON.stringify(value)}. ` +
        `Known providers are: ${PROVIDER_IDS.join(", ")}.`,
    );
  }
  return value;
}
