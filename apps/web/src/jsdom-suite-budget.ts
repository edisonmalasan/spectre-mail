/**
 * The per-test time budget for this client's jsdom suites, and why it is not the default.
 *
 * ## What was observed
 *
 * On 2026-10-03, `pnpm vitest run` was run eight times in a row on an otherwise clean
 * working tree. Two runs were fully green; **two failed**, and both failures were the
 * same test — `App.test.tsx`'s "renders no address while a second address is being
 * created" — failing with `Test timed out in 5000ms`:
 *
 * ```text
 * run 1 : files=[26 passed (26)] tests=[534 passed (534)]
 * run 2 : files=[1 failed | 25 passed (26)]   TIMEOUT  renders no address while a second address is being created
 * run 3 : files=[26 passed (26)] tests=[535 passed (535)]
 * run 4 : files=[2 failed | 24 passed (26)]   TIMEOUT  renders no address while a second address is being created
 *                                               TIMEOUT  gives every row a real button with a name, and opens what it names
 * run 5 : files=[26 passed (26)]
 * run 6 : files=[26 passed (26)]
 * run 7 : files=[26 passed (26)]
 * run 8 : files=[26 passed (26)]
 * ```
 *
 * ## Why it is contention and not a slow test
 *
 * The same assertions were timed in isolation and are **fast**: the whole of `apps/web`
 * is 74 tests summing to 2.54s with a maximum of **247ms**, and these two are 197ms and
 * 117ms respectively. Meanwhile the same machine measured `environment 26.63s` and
 * `collect 21.47s` for that one run — jsdom construction and module loading, not test
 * bodies — and a separate measurement of the architecture suite gave 8.6s and 37s in two
 * runs minutes apart.
 *
 * Both failing tests are the same shape: one `await screen.findByTestId(...)`, whose
 * **own** default budget is 1000ms with a 50ms poll. That is comfortable when the machine
 * is idle and unreachable when a dozen other workers are competing for disk. Nothing about
 * the product's behaviour decides the outcome, which is exactly what makes it a flake
 * rather than a defect — and a flake is still worth fixing, because its lesson is "re-run
 * until green", which is the habit `boundaries.test.ts` exists to prevent.
 *
 * ## Why the fix is a budget and not a faster test
 *
 * There is no slow code here to make faster. The tests are a handful of assertions around
 * a deterministic stub; the cost is jsdom. Shortening them would mean removing the
 * `findByTestId` waits, which are what let React settle — that trades a flake for a race.
 *
 * ## Why the budget is scoped rather than global
 *
 * `vitest.config.ts` is untouched, so no suite inherits a budget it did not ask for. A
 * genuinely slow unit test elsewhere is not masked by this decision.
 *
 * ## Why 60 seconds cannot hide a regression
 *
 * A rule or an assertion that stops matching does not get *slower* — it gets wrong. These
 * assertions either hold or throw, and they hold in under 250ms when the machine is not
 * busy. A test that truly hangs still fails; it just fails later. The value is chosen to
 * be generous rather than tight for that reason.
 *
 * @module
 */

import { vi } from "vitest";

/**
 * Milliseconds, generous rather than tight — see the module note for why that cannot
 * mask a regression.
 *
 * **The value is arbitrary and stated as such.** It is not derived from the observed
 * 247ms maximum by some computed margin; it is "far beyond anything these tests have
 * cost", so that the number does not pretend to a precision nobody measured.
 */
export const JSDOM_SUITE_TIMEOUT_MS = 60_000;

/**
 * Apply the budget to the calling file's tests.
 *
 * **Called at module scope, once per suite, and not inside a hook.** A budget applied
 * from `beforeEach` would leave the first test of each file on the default — which is how
 * a fix like this half-works and then fails once in eight runs, having appeared to solve
 * the problem.
 *
 * **Why `vi.setConfig` and not an argument on every `it`.** Sixteen assertions in
 * `boundaries.test.ts` and every `it` here would each need the third argument, and an
 * assertion that is easy to forget the budget on is an assertion that will time out
 * again. There is a matching consequence: adding a new `it` to these files needs no
 * thought about timeouts at all, which is the point.
 */
export function applyJsdomSuiteBudget(): void {
  vi.setConfig({ testTimeout: JSDOM_SUITE_TIMEOUT_MS });
}
