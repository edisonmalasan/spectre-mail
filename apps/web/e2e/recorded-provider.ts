/**
 * The recorded provider, served to the page under test.
 *
 * ## Why this file exists at all
 *
 * The website reaches exactly one provider, and it reaches it over the network. A
 * browser suite that reached the real service would be the one check in this
 * repository whose red run could not say whether this repository broke or a third
 * party did — and every other check here runs from recorded responses precisely so
 * that a red run means something. So provider traffic is intercepted and answered
 * from the fixtures already committed to `packages/providers`.
 *
 * **The fixtures are imported by name, never restated.** That is not tidiness: a
 * provider JSON field name written in this file would be provider wire format under
 * `apps/`, which is exactly what `tests/architecture/boundaries.test.ts` forbids and
 * why it scans the apps with **no test exemption at all**. Importing a fixture names
 * no field.
 *
 * ## What "no network" means here, and how it is not merely configured
 *
 * `page.route` intercepting the provider is not by itself a guarantee — a page could
 * reach somewhere the handler never sees. So the handler **denies every origin it has
 * no recorded response for**, records the URL, and the suite asserts on that record. A
 * page that reaches for an unrecorded origin therefore fails, naming the origin,
 * rather than passing against nothing.
 *
 * @module
 */

import type { Page, Route } from "@playwright/test";

import { SITE_ORIGIN } from "../playwright.config";
import {
  guerrillaLiveList,
  guerrillaMessageFetched,
  guerrillaSessionCreated,
} from "../../../packages/providers/src/fixtures";
import type { RecordedStep } from "../../../packages/providers/src/recorder";

/** The one origin the website is permitted to ask for. */
export const PROVIDER_ORIGIN = "https://api.guerrillamail.com";

/** A promise a spec holds open, and then releases. */
export interface Deferred {
  readonly promise: Promise<void>;
  release(): void;
}

/**
 * A deferred, for holding one response open while the page is inspected.
 *
 * **Here and not in a spec, because the gate above is the thing it exists for** and two
 * specs now hold a listing open. Two copies of "a promise I can release" would be the
 * defect `open-mailbox.ts` exists to prevent, in its smallest possible dress.
 */
export function deferred(): Deferred {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { promise, release };
}

/**
 * The operations the website drives, each answered by a recorded response.
 *
 * Keyed by the operation the adapter puts in the query string. The adapter is the only
 * thing that knows that spelling, and this map is a **test double for it** — which is
 * why the keys are written here rather than imported: a provider's operation names
 * are provider wire format, and this file lives under `apps/`.
 */
const RECORDED = new Map<string, RecordedStep>([
  ["get_email_address", guerrillaSessionCreated],
  ["check_email", guerrillaLiveList],
  ["fetch_email", guerrillaMessageFetched],
]);

/** The operation whose answer decides whether a stored address is still alive. */
const LISTING_OPERATION = "check_email";

/** Everything the handler saw, so a spec can assert the page really asked for something. */
export interface ProviderTraffic {
  /** Full URLs served from a recorded response, in order. */
  readonly served: readonly string[];
  /** URLs the page reached for that had no recorded response, in order. */
  readonly denied: readonly string[];
}

/** What a spec may change about how the provider behaves. */
export interface RecordedProviderOptions {
  /**
   * Hold a listing response, and say **which** listing by its one-based count.
   *
   * **The purpose is to make time irrelevant.** "The page must not show a stored
   * address before the provider confirms it" is a claim about an ordering that
   * completes in milliseconds, so asserting it with a sleep would be asserting a race
   * happened to resolve the convenient way. A spec instead hands over a promise it
   * controls, inspects the page while the provider is still thinking, and then
   * releases it. Nothing here has a duration to tune.
   *
   * **A function of the call number, and not a single promise.** Two claims need two
   * different listings held: `storage.spec.ts` holds the *first* (there is nothing
   * stored before it), and `motion.spec.ts` holds the *second* (the first is what puts
   * a row on the page). A single promise cannot express both — holding the first would
   * also hold the second, so the second could never be released at the point the claim
   * is made. A single promise that releases everything at once is the other defect: it
   * cannot hold one request while answering another.
   *
   * **The per-call shape is the same one `apps/web/src/Inbox.test.tsx` already uses**
   * for its `holdListing` stub gate. Two tiers holding a listing open is one idea, and
   * two spellings of it would be the defect `open-mailbox.ts` exists to prevent.
   *
   * Return `undefined` to answer that listing immediately.
   */
  readonly listingGate?: (call: number) => Promise<unknown> | undefined;
}

/**
 * Serve `page` from recorded responses and deny everything else.
 *
 * Installed immediately, before the page has navigated — which is what lets the very
 * first document request be inspected. A separate `install()` step would have been
 * wrong twice over: a caller could forget it, and the origin comparison below cannot
 * be done before navigation anyway.
 *
 * @returns The traffic seen so far. Read it in an assertion, never inside the handler.
 */
export function serveRecordedProvider(
  page: Page,
  options: RecordedProviderOptions = {},
): ProviderTraffic {
  const served: string[] = [];
  const denied: string[] = [];

  /**
   * How many listings this handler has been asked for.
   *
   * **A count rather than a boolean**, because the gate has to be able to hold one
   * listing and answer the next, and "is a listing in progress" cannot say which.
   */
  let listingCalls = 0;

  page.route("**/*", async (route: Route) => {
    const url = new URL(route.request().url());

    // **The site's own origin is compared against a constant, not against
    // `page.url()`.** Reading `page.url()` looks like the robust choice and is not: the
    // first request a page makes is the document, and at that moment `page.url()` is
    // still `about:blank`, whose `origin` is the string `"null"`. Every asset would
    // then fail the comparison and be denied, and the suite would fail to load the app
    // rather than test it. The origin is a fact this file's peer already owns —
    // `playwright.config.ts` — so it is imported rather than re-read at the wrong time.
    if (url.origin === SITE_ORIGIN) {
      await route.continue();
      return;
    }

    const step = url.origin === PROVIDER_ORIGIN ? stepFor(url) : undefined;
    if (step === undefined) {
      // Either an origin nobody recorded, or a recorded one reached with an operation
      // nobody recorded. Denying both is the point: an unrecorded request must never
      // be answered plausibly, because a plausible answer reads as the product
      // working.
      denied.push(route.request().url());
      await route.abort("blockedbyclient");
      return;
    }

    const held =
      url.searchParams.get("f") === LISTING_OPERATION
        ? options.listingGate?.(++listingCalls)
        : undefined;

    // **Counted and held before the URL is recorded as served.** The count is the gate's
    // own input, and `served` is what a spec reads to know the provider was asked — so a
    // request the gate is still thinking about must not yet read as served.
    if (held !== undefined) await held;

    served.push(route.request().url());
    await route.fulfill({
      status: step.response.status,
      // The recorded CORS header is replayed verbatim. **A browser enforces it for real
      // here**, which is the one thing the jsdom tier cannot do: `ACAO: *` on the
      // session recording is what makes the response readable from a web page at all,
      // per `docs/PROVIDERS.md`. A handler that dropped the header would produce a
      // CORS failure rather than a data-shaped one.
      headers: step.response.headers,
      body: step.response.body,
    });
  });

  return { served, denied };

  /** The recorded response for this request, or `undefined` if nothing records it. */
  function stepFor(url: URL): RecordedStep | undefined {
    return RECORDED.get(url.searchParams.get("f") ?? "");
  }
}
