/**
 * The website's three address-truth claims, held at the copy layer.
 *
 * ## What this file proves, and what it deliberately does not
 *
 * It proves that the three claims the M22 delta names are three different sentences in the
 * website's own voice, and that no combination of a catalog hit, a successful create or a
 * recorded fixture can change the delivery claim away from `LIVE DELIVERY NOT VERIFIED`. It is
 * a copy-layer instrument: it reads what the page **can** say, not what a rendered paragraph
 * currently says, and it does not claim that any real mail arrived (GOAL §8.4 stays BLOCKED).
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { reportWebsiteAddressTruth, WEBSITE_ADDRESS_TRUTH } from "./address-truth";

describe("the website's three address-truth claims", () => {
  it("holds three different sentences, with delivery fixed at the unverified wording", () => {
    // **A literal list on this side**, so a renamed or collapsed claim is reported by name
    // rather than agreed with by a comparison the record also passes.
    expect(Object.keys(WEBSITE_ADDRESS_TRUTH).sort()).toEqual([
      "catalogAvailable",
      "deliveryUnverified",
      "provisioned",
    ]);
    expect(new Set(Object.values(WEBSITE_ADDRESS_TRUTH)).size).toBe(3);

    expect(WEBSITE_ADDRESS_TRUTH.deliveryUnverified).toBe("LIVE DELIVERY NOT VERIFIED");
    expect(WEBSITE_ADDRESS_TRUTH.deliveryUnverified).not.toMatch(/verified delivery|delivered/i);
  });

  it("keeps delivery unverified for every combination of catalog, create and recording", () => {
    const deliveries: string[] = [];

    for (const inCatalog of [false, true]) {
      for (const providerConfirmed of [false, true]) {
        for (const recorded of [false, true]) {
          const report = reportWebsiteAddressTruth({ inCatalog, providerConfirmed, recorded });
          expect(report.catalogAvailable, `${inCatalog}/${providerConfirmed}/${recorded}`).toBe(
            inCatalog,
          );
          expect(
            report.provisionedByProvider,
            `${inCatalog}/${providerConfirmed}/${recorded}`,
          ).toBe(providerConfirmed);
          expect(report.delivery, `${inCatalog}/${providerConfirmed}/${recorded}`).toBe(
            WEBSITE_ADDRESS_TRUTH.deliveryUnverified,
          );
          deliveries.push(report.delivery);
        }
      }
    }

    // **The positive control for the enumeration**, so an empty loop cannot satisfy the
    // one-valued set below. And the control for the distinctness assertion in the other
    // direction: a second, different value must make it report two.
    expect(deliveries).toHaveLength(8);
    expect(new Set(deliveries).size).toBe(1);
    expect(new Set([...deliveries, "Delivered."]).size).toBe(2);
  });
});
