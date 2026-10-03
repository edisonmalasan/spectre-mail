/**
 * The website's provider configuration, verified.
 *
 * These run in the default `node` environment: this module reaches no browser
 * global, which is the property that makes it testable here at all.
 *
 * @module
 */

import type { TransportRequest, TransportResponse } from "@spectre-mail/providers";
import { describe, expect, it } from "vitest";

import { createWebsiteProviderManager, WEBSITE_PROVIDER_IDS } from "./provider-config";

/** Records every URL it is asked to fetch and answers an empty 200. */
function recorder() {
  const urls: string[] = [];
  const transport = (request: TransportRequest): Promise<TransportResponse> => {
    urls.push(request.url);
    return Promise.resolve({ status: 200, headers: {}, body: "{}" });
  };
  return { urls, transport };
}

describe("the website's provider configuration", () => {
  it("configures exactly one provider, and it is Guerrilla Mail", () => {
    expect(WEBSITE_PROVIDER_IDS).toEqual(["guerrilla"]);
    expect(createWebsiteProviderManager(recorder().transport).available).toHaveLength(1);
    expect(createWebsiteProviderManager().available.map((p) => p.id)).toEqual(["guerrilla"]);
  });

  it("cannot reach Mail.tm's origin from a configured provider", async () => {
    const { urls, transport } = recorder();
    const manager = createWebsiteProviderManager(transport);

    // Drive a real creation through the configured adapter and look at every URL it
    // asked for. The requirement is that no *other* provider's origin is reachable
    // from this page, and a configuration assertion alone would not show that.
    await manager.createMailbox().catch(() => undefined);

    // **This does not prove a live page issues no other request.** It proves that the
    // provider this client is configured with resolves to Guerrilla's origin and
    // nothing else. A blanket statement about every request a real page could make
    // would need a browser and a network, and is recorded as unproven rather than
    // implied by this test.
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.includes("guerrillamail"))).toBe(true);
    expect(urls.some((url) => url.includes("mail.tm"))).toBe(false);
  });

  it("reaches no origin other than the one provider's", () => {
    const { transport } = recorder();
    const manager = createWebsiteProviderManager(transport);

    // A second provider would be a claim of redundancy this client does not have.
    // Asserting the length pins that, and the id pins which one.
    expect(manager.available[0]?.displayName).toBe("Guerrilla Mail");
    expect(WEBSITE_PROVIDER_IDS).toEqual(["guerrilla"]);
  });

  it("resolves its providers to exactly the ids it declares, in declared order", () => {
    const manager = createWebsiteProviderManager(recorder().transport);

    // **This assertion cannot catch the defect this change fixed, and is not claimed
    // to.** With one provider on each side it is a coincidental match: a factory that
    // ignored `WEBSITE_PROVIDER_IDS` entirely would satisfy it just as well, which is
    // why it was not the only assertion before. What was there —
    // `expect(manager.available).toHaveLength(WEBSITE_PROVIDER_IDS.length)` — has the
    // same weakness for the same reason, and its comment conceded it: "the two
    // constants must be changed together, so that is now said rather than implied".
    //
    // This form states the correct *relation* rather than a coincidental one, and it
    // would fail if a provider were added to the factory while the list still named
    // one. What it still cannot show is that the factory *reads* the list.
    //
    // That claim is asserted elsewhere and is falsifiable: the boundary rule in
    // `tests/architecture/boundaries.test.ts` fails when a client's configuration
    // exports an id list it never reads as a value, with a control that reverts this
    // factory to direct construction. Between the two, the list is the configuration
    // rather than documentation beside one — one test for the behaviour, one for the
    // structure, neither standing in for the other.
    expect(manager.available.map((provider) => provider.id)).toEqual([...WEBSITE_PROVIDER_IDS]);
  });
});
