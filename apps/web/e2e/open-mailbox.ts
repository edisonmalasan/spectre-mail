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

/**
 * Load the page and wait until it has finished creating a mailbox.
 *
 * **Waiting for `ready` rather than for the address.** `ready` is the state the session
 * reaches once the provider has confirmed an address and the first listing has been
 * analysed, so it is the first point at which every control a focus spec wants to reach
 * is actually on the page. Waiting for the address alone would pass while the inbox had
 * not yet rendered, and the controls below are part of the inbox.
 *
 * Provider traffic is installed **before** `goto`, so the very first document request is
 * already covered by the handler that denies unrecorded origins. See
 * `recorded-provider.ts` for why that ordering is not optional.
 */
export async function openFreshMailbox(page: Page): Promise<ProviderTraffic> {
  const traffic = serveRecordedProvider(page);
  await page.goto("/");
  await expect(page.getByTestId("ready")).toBeVisible();
  return traffic;
}
