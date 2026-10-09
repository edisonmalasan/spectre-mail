/**
 * Getting to a page that has a mailbox.
 *
 * ## Why this is its own module rather than a helper in one spec
 *
 * Because two specs now need it and this repository has a recorded history of two
 * spellings of one thing quietly disagreeing: a collection rule scoped to `apps/` while
 * its name said "every shipped test", and two boundary rules sharing one allowance
 * constant so that widening it silenced the other. Two copies of "load the page and wait
 * for a mailbox" would be the same defect in a smaller dress — one of them would gain a
 * wait for something the other did not, and both would still be green.
 *
 * **It is deliberately not a `.spec.ts`.** A file in `testDir` that declares no test
 * would be collected by nothing and read as a spec that verifies nothing, and the rule
 * in `tests/architecture/boundaries.test.ts` that requires every shipped spec to be
 * collected by the browser suite and by nothing else would report it. Support code lives
 * beside the specs; only specs live in the suite's own glob.
 *
 * @module
 */

import { expect, type Page } from "@playwright/test";

import { serveRecordedProvider, type ProviderTraffic } from "./recorded-provider";
import type { RecordedStep } from "../../../packages/providers/src/recorder";

/** How a spec joins "load the page and wait for a mailbox" without copying it. */
export interface OpenMailboxOptions {
  /**
   * Run once the document has loaded, and **before** `ready` is awaited.
   *
   * **Here and not afterwards, and the placement is measured.** `ready` appears before
   * the inbox has rendered its rows — checked on 2026-10-06, the page had **zero**
   * `.inbox-row` elements at the moment `ready` became visible, and the first row
   * appeared a moment later. So a listener installed after this hook returns can miss
   * the one event it exists to record, and a test would then read its own timing rather
   * than the page's behaviour.
   *
   * **A hook and not a second copy of the navigation.** This module's reason for
   * existing is that two spellings of "load the page and wait for a mailbox" would drift
   * apart silently, and a spec that navigated for itself would be exactly that.
   */
  readonly onDocumentLoaded?: (page: Page) => Promise<void>;

  /**
   * Hold a listing response open, by its one-based count.
   *
   * **Plumbed rather than re-installed, because installing a second handler over the
   * first would give two `denied` records for one request** and make the denial
   * assertion in 8.3 read as though the page had reached two unrecorded origins.
   *
   * Forwarded verbatim to `serveRecordedProvider`; see `RecordedProviderOptions` for why
   * it is a function of the call number.
   */
  readonly listingGate?: (call: number) => Promise<unknown> | undefined;

  /**
   * Answer `fetch_email` with this recorded step instead of the default one.
   *
   * **Plumbed rather than served by the caller, and for the reason this module exists.**
   * The alternative was a spec calling `serveRecordedProvider` itself and then navigating,
   * which is the "second copy of load-the-page" defect with a handler bolted on. Forwarded
   * verbatim; see `RecordedProviderOptions.messageStep` for why the recorded corpus cannot
   * supply a message carrying a link.
   */
  readonly messageStep?: RecordedStep;
}

/**
 * Load the page and wait until it has finished creating a mailbox.
 *
 * **Waiting for `ready` rather than for the address.** `ready` is the state the session
 * reaches once the provider has confirmed an address and the first listing has been
 * analysed, so it is the first point at which every control a focus spec wants to reach
 * is actually on the page. Waiting for the address alone would pass while the inbox had
 * not yet rendered, and the controls below are part of the inbox.
 *
 * **`ready` is not the inbox.** See `OpenMailboxOptions.onDocumentLoaded` for the
 * measurement: a spec that needs a *row* waits for the row, because no single state
 * covers both.
 *
 * Provider traffic is installed **before** `goto`, so the very first document request is
 * already covered by the handler that denies unrecorded origins. See
 * `recorded-provider.ts` for why that ordering is not optional.
 */
export async function openFreshMailbox(
  page: Page,
  options: OpenMailboxOptions = {},
): Promise<ProviderTraffic> {
  // **`exactOptionalPropertyTypes` is why this is conditional rather than
  // `{ listingGate: options.listingGate }`.** Passing an explicit `undefined` is not the
  // same as omitting the key under this compiler setting, and the error it produces reads
  // like a type mismatch rather than a decision about spelling. Both options are forwarded
  // the same way rather than one of them being spread in with a possibly-`undefined` value.
  const traffic = serveRecordedProvider(page, {
    ...(options.listingGate === undefined ? {} : { listingGate: options.listingGate }),
    ...(options.messageStep === undefined ? {} : { messageStep: options.messageStep }),
  });
  await page.goto("/");
  if (options.onDocumentLoaded !== undefined) await options.onDocumentLoaded(page);
  await expect(page.getByTestId("ready")).toBeVisible();
  return traffic;
}
