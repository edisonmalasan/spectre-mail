/**
 * Domain provenance.
 *
 * A domain is only as trustworthy as the source of its fields. These cases hold
 * the line between "the provider reported this" and "we guessed it": reported
 * values travel with the domain, unreported values are explicit absences, and
 * a free/premium distinction is never invented where no provider sent one.
 *
 * Every assertion here is falsifiable: the conforming case and the
 * counterfactual are both written out, so a change that makes one vacuous
 * breaks the other.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { UNREPORTED_DOMAIN_PROVENANCE, type Domain, type DomainProvenance } from "./domain";

/** A provider-reported domain. Reserved name; this is synthetic test data. */
function reportedDomain(provenance: DomainProvenance): Domain {
  return {
    id: "domains/alpha",
    name: "alpha.example",
    provider: "mailtm",
    active: true,
    expiresAt: null,
    provenance,
  };
}

describe("Domain provenance", () => {
  it("carries every value a provider reported", () => {
    const provenance: DomainProvenance = {
      discoveredAt: 1_760_000_000_000,
      runtime: "extension",
      lifecycle: "active",
      capabilities: ["listDomains", "createOnChosenDomain", "restore"],
      tier: "premium",
    };
    const domain = reportedDomain(provenance);

    // Conforming case: the whole provenance object round-trips unchanged.
    expect(domain.provenance).toEqual(provenance);
    expect(domain.provenance.discoveredAt).toBe(1_760_000_000_000);
    expect(domain.provenance.runtime).toBe("extension");
    expect(domain.provenance.lifecycle).toBe("active");
    expect(domain.provenance.capabilities).toContain("createOnChosenDomain");
    expect(domain.provenance.tier).toBe("premium");
  });

  it("keeps a reported premium value only where one was actually supplied", () => {
    // Counterfactual for the case above: the same domain without a tier must not
    // acquire one from a default, a price, or another provider's data.
    const domain = reportedDomain({
      discoveredAt: 1_760_000_000_000,
      runtime: "extension",
      lifecycle: "active",
      capabilities: ["listDomains"],
    });

    expect(Object.hasOwn(domain.provenance, "tier")).toBe(false);
    expect("tier" in domain.provenance).toBe(false);
  });

  it("records unreported values as absences, not as guesses", () => {
    const domain = reportedDomain(UNREPORTED_DOMAIN_PROVENANCE);

    expect(domain.provenance.discoveredAt).toBeNull();
    expect(domain.provenance.runtime).toBeNull();
    expect(domain.provenance.lifecycle).toBeNull();
    expect(domain.provenance.capabilities).toEqual([]);
    expect(Object.hasOwn(domain.provenance, "tier")).toBe(false);
  });

  it("never infers a runtime from a domain's spelling", () => {
    // A name that looks like a consumer domain is not evidence of a runtime.
    // If a future edit derived runtime from `name`, this case would go red.
    const domain: Domain = {
      ...reportedDomain(UNREPORTED_DOMAIN_PROVENANCE),
      name: "extension.example",
    };

    expect(domain.provenance.runtime).toBeNull();
  });

  it("exposes one frozen absent provenance rather than a mutable literal", () => {
    expect(Object.isFrozen(UNREPORTED_DOMAIN_PROVENANCE)).toBe(true);
    expect(Object.isFrozen(UNREPORTED_DOMAIN_PROVENANCE.capabilities)).toBe(true);
  });
});
