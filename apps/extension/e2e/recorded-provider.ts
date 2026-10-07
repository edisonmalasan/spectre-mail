/**
 * Recorded provider traffic for the extension's browser tier.
 *
 * ## Every provider response here is a recorded one
 *
 * **No test in this tier contacts a live provider**, and that is the same rule the
 * website's tier follows and the same limit: `use it externally` stays unverified, and
 * the polling cadence has still never been run against a real provider. What this buys
 * is that the *extension's* own wiring — host permissions in a `chrome-extension://`
 * context, `chrome.storage`, the popup's composition — is exercised for real.
 *
 * ## The fixtures are imported by name, never restated
 *
 * **That is not tidiness, and this file's first version got it wrong.** It transcribed
 * the recorded bodies inline, which put four provider field names under `apps/` — and
 * `tests/architecture/boundaries.test.ts` forbids provider wire format there with **no
 * test exemption at all**, so the architecture suite went red before anything was
 * pushed. The rule was right and the file was wrong, so the fix was to import rather
 * than to ask for an exemption: the website's tier has always done it this way, and its
 * module note explains why.
 *
 * The consequence is better than the tidiness: **the served bodies are the measured
 * ones**, so a spec asserting on a count is asserting on what the provider actually
 * returned rather than on a value invented to make a sentence appear.
 *
 * ## Any other origin is aborted and named, rather than passed through
 *
 * `apps/web/e2e/recorded-provider.ts` records every URL the page requested whatever its
 * origin and aborts the ones it has no script for. **The same rule here, and the reason
 * is sharper for an extension**: an extension with host permissions is exactly the kind
 * of program that could quietly reach something, so a request to an origin no test
 * scripted is a finding to be printed, not a request to be served.
 */

import type { BrowserContext } from "@playwright/test";

import {
  FIXTURE_IDS,
  guerrillaLiveList,
  guerrillaSessionCreated,
  mailtmAccountCreated,
  mailtmDomains,
  mailtmMessageList,
  mailtmToken,
} from "../../../packages/providers/src/fixtures";

/** One scripted answer. */
interface ScriptedResponse {
  readonly status: number;
  readonly body: string;
}

/**
 * The operations each provider reaches, each answered by its recorded response.
 *
 * **Keyed by the request path the adapter puts in the URL**, which is a spelling this
 * file has to write down and a wire-format question the boundary rule does not ask
 * about. Keying by the *operation name* instead would be worse: Guerrilla Mail carries
 * its operation in a query parameter, so the key would be provider vocabulary in a place
 * a reader would mistake for a path.
 *
 * **Ordered longest-prefix-last on purpose** — the lookup below takes the first match, so
 * `/messages` is written after nothing that could shadow it and must not shadow
 * `/messages/{id}`. No spec opens a message this milestone, so no entry fetches one.
 */
const SCRIPT: ReadonlyArray<readonly [string, ScriptedResponse]> = [
  ["https://api.mail.tm/domains", recorded(mailtmDomains)],
  ["https://api.mail.tm/accounts", recorded(mailtmAccountCreated)],
  ["https://api.mail.tm/token", recorded(mailtmToken)],
  ["https://api.mail.tm/messages", recorded(mailtmMessageList)],
  ["https://api.guerrillamail.com/ajax.php", recorded(guerrillaLiveList)],
];

/**
 * A recorded step, in the shape a route handler can fulfil.
 *
 * **Read off `RecordedStep` rather than re-declared.** `packages/providers`'s recorder
 * types the response as `{status, headers, body}` and this helper takes the two fields a
 * `route.fulfill` needs from it, so a fixture's own status code — `201` for account
 * creation — reaches the browser rather than a `200` this file decided was fine.
 */
function recorded(step: { readonly response: { readonly status: number; readonly body: string } }) {
  return { status: step.response.status, body: step.response.body };
}

/**
 * The recorded values a spec asserts against, re-exported so it reads one source.
 *
 * **`FIXTURE_IDS` is exported by the fixture module precisely so a test does not retype a
 * measured address**, and re-exporting it here rather than importing from two directories
 * in every spec keeps the recorded tier's inputs in one place.
 */
export { FIXTURE_IDS };

/** The recorded session exchange Guerrilla Mail's *creation* call is answered with. */
export const GUERRILLA_SESSION_RESPONSE = guerrillaSessionCreated;

/**
 * The origins this tier scripts a provider for, **derived from {@link SCRIPT}**.
 *
 * ## Why this is exported
 *
 * `manifest.spec.ts` has to answer *"does the extension declare host reach no shipped
 * surface reaches?"* and the honest way to answer it is against the reach a shipped
 * surface **has**, not against a second list of origin strings a spec file typed out.
 * Two lists is two things that can drift, and this repository has already paid for one:
 * `recorded-provider.ts` existed precisely because a spec that transcribed its own
 * fixtures proved the product echoed values the test invented.
 *
 * So the comparison is between the built manifest and **the tier's own script table**.
 * A host permission added for an origin nothing scripts is reach no shipped surface has,
 * and the assertion fires on it by name.
 */
export const SCRIPTED_PROVIDER_ORIGINS: readonly string[] = [
  ...new Set(SCRIPT.map(([prefix]) => new URL(prefix).origin)),
].sort();

export interface RecordingOptions {
  /** Answer Mail.tm with 503 so the fallback path runs. Off by default. */
  readonly mailTmUnavailable?: boolean;
}

/** What the interception saw. */
export interface ProviderTraffic {
  /** Every URL the page requested, whatever its origin. */
  readonly requested: readonly string[];
  /** Every origin that was requested but had no script, and therefore was aborted. */
  readonly unscripted: readonly string[];
}

/**
 * Intercept provider traffic, and report what was asked for.
 *
 * **Returns the live arrays rather than a snapshot**, because a spec has to read what
 * was requested *after* the interaction that caused it.
 */
export async function recordProviderTraffic(
  context: BrowserContext,
  options: RecordingOptions = {},
): Promise<ProviderTraffic> {
  const requested: string[] = [];
  const unscripted: string[] = [];

  await context.route("**/*", async (route) => {
    const url = route.request().url();

    // **Non-provider requests are passed through untouched** — the popup's own
    // `chrome-extension://` document, its script, its stylesheet. Routing those would
    // mean answering them, and the suite's subject is not the popup's own assets.
    if (!url.startsWith("https://")) {
      await route.continue();
      return;
    }

    requested.push(url);

    if (options.mailTmUnavailable && url.startsWith("https://api.mail.tm")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return;
    }

    const match = SCRIPT.find(([prefix]) => url.startsWith(prefix));
    if (match === undefined) {
      // **Named, not silently dropped.** An origin nobody scripted is either a new
      // provider or a bug; either a way to catch it is to print it.
      const origin = new URL(url).origin;
      if (!unscripted.includes(origin)) unscripted.push(origin);
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      status: match[1].status,
      contentType: "application/json",
      body: match[1].body,
    });
  });

  return {
    get requested() {
      return requested;
    },
    get unscripted() {
      return unscripted;
    },
  };
}
