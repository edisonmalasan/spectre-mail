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
 * @module
 */

import { createGuerrillaAdapter, createProviderManager } from "@spectre-mail/providers";
import type { ProviderManager } from "@spectre-mail/providers";

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
 */
export const WEBSITE_PROVIDER_IDS = ["guerrilla"] as const;

/**
 * Build the website's provider manager.
 *
 * Takes the transport as a parameter rather than reading the global `fetch`, so
 * this file contains no `fetch` call and a test can supply a recording transport
 * without the module reaching for a browser global.
 *
 * @param transport - How requests are performed. Production passes {@link webTransport}.
 */
export function createWebsiteProviderManager(transport = webTransport): ProviderManager {
  return createProviderManager([
    // `now` is injected rather than read from the platform, so the adapter has no
    // clock of its own and a test can pin a mailbox's creation time. Nothing on the
    // page derives a lifetime from it — see `MailboxLifetime.tsx`.
    createGuerrillaAdapter({ transport, now: () => Date.now() }),
  ]);
}
