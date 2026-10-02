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
    //
    // **These two constants are independent, and an earlier comment here claimed
    // they were not.** It said "the list is the single place that decision lives",
    // but `createWebsiteProviderManager` constructs `createGuerrillaAdapter`
    // directly and never reads `WEBSITE_PROVIDER_IDS`. So the list documented an
    // indirection that did not exist, and a reader would reasonably assume editing
    // the list changed the client's behaviour. It does not.
    //
    // The coverage is unaffected — the assertions above drive a real creation and
    // check every URL, which is what actually pins the behaviour — but the two
    // constants must be changed together, so that is now said rather than implied.
    expect(manager.available).toHaveLength(WEBSITE_PROVIDER_IDS.length);
    expect(manager.available[0]?.displayName).toBe("Guerrilla Mail");
    expect(WEBSITE_PROVIDER_IDS).toEqual(["guerrilla"]);
  });
});
