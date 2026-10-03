/**
 * The website's provider configuration.
 *
 * ## One provider, and the measured reason for it
 *
 * Mail.tm sends `Access-Control-Allow-Origin` only to its own origins, so no
 * compliant web page can reach it. That was measured against the live API in the
 * M0 spike, not assumed: see `docs/PROVIDERS.md`. A SpectreMail-operated backend
 * to relay it is forbidden outright by `provider-abstraction`, both because it
 * would cost money and because it is a policy of the product rather than a
 * terms-compliance workaround.
 *
 * So the correct response is to configure the one provider a web page can reach,
 * and to record the limitation rather than dress it up as redundancy.
 *
 * ## What the extension does is not this module's business
 *
 * The extension is scheduled to use Mail.tm with Guerrilla Mail behind it, and
 * that is a fact about the extension's host environment, not about Mail.tm. The
 * two configurations are separate because reachability is a property of where
 * the code runs. Nothing here is a verdict on either provider.
 *
 * ## Why there is no provider selector
 *
 * A selector needs options, and the website has exactly one reachable provider. A
 * `<select>` with a single option is a control that cannot do anything, and it
 * would tell a reader that a choice exists and is unavailable — which is worse
 * than saying nothing. `website-client` requires the absence to be a stated
 * decision rather than a gap nobody has noticed, and this is that statement. The
 * extension, whose host permissions do reach two providers, is where a selector
 * would belong; that is M8.
 *
 * @module
 */

import { createGuerrillaAdapter, createProviderManager } from "@spectre-mail/providers";
import type { MailProvider, ProviderManager, Transport } from "@spectre-mail/providers";

import { webTransport } from "./transport";

/**
 * The providers the website reaches, in preference order.
 *
 * A named constant rather than a value inlined at the call site, so a test can
 * read the configuration instead of inferring it from rendered output, and so
 * adding a provider is a visible edit to one list rather than a change spread
 * across call sites.
 *
 * **Keep it a list of one.** Two entries here would claim redundancy the website
 * does not have.
 *
 * **This list is what configures the client, and that is now enforced rather than
 * described.** It used to be documentation beside the real configuration:
 * `createWebsiteProviderManager` constructed the adapter directly and never read
 * this constant, so adding a provider meant editing this list *and* the factory —
 * exactly the spread the paragraph above claims to avoid. The factory now derives
 * from this list, and {@link ADAPTERS} is typed as an exhaustive `Record` over it,
 * so an id added here without an adapter beside it is a compile error rather than
 * a runtime surprise.
 */
export const WEBSITE_PROVIDER_IDS = ["guerrilla"] as const;

/**
 * The ids this client declares, as a union.
 *
 * Derived from {@link WEBSITE_PROVIDER_IDS} rather than written out again, so the
 * two cannot disagree.
 */
export type WebsiteProviderId = (typeof WEBSITE_PROVIDER_IDS)[number];

/**
 * One adapter per declared id, and the only place an adapter is constructed.
 *
 * Typed `Record<WebsiteProviderId, …>` on purpose. `Record` over a finite literal
 * union is exhaustive in the type system, so declaring a second id in
 * {@link WEBSITE_PROVIDER_IDS} without adding it here **does not compile** — which
 * is what makes the list a real configuration rather than a comment beside one.
 *
 * **Client configuration, not shared provider machinery.** A registry like this
 * would be wrong inside `packages/providers`: keyed by id, it would let any client
 * import an adapter it must not reach, and the boundary rule that confines adapters
 * to that package exists precisely because reachability is per client.
 */
const ADAPTERS: Readonly<Record<WebsiteProviderId, (transport: Transport) => MailProvider>> = {
  // `now` is injected rather than read from the platform, so the adapter has no
  // clock of its own and a test can pin a mailbox's creation time. Nothing on the
  // page derives a lifetime from it — see `MailboxLifetime.tsx`.
  guerrilla: (transport) => createGuerrillaAdapter({ transport, now: () => Date.now() }),
};

/**
 * Build the website's provider manager.
 *
 * Derives its adapters from {@link WEBSITE_PROVIDER_IDS}, so the exported list and
 * the client's actual providers cannot drift apart.
 *
 * Takes the transport as a parameter rather than reading the global `fetch`, so
 * this file contains no `fetch` call and a test can supply a recording transport
 * without the module reaching for a browser global.
 *
 * @param transport - How requests are performed. Production passes {@link webTransport}.
 */
export function createWebsiteProviderManager(transport = webTransport): ProviderManager {
  return createProviderManager(WEBSITE_PROVIDER_IDS.map((id) => ADAPTERS[id](transport)));
}
