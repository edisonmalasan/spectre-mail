/**
 * How long a page waits for an answer this extension asked for, and what it does when none comes.
 *
 * ## The number is this product's choice, and it is deliberately not a measurement
 *
 * `packages/mailbox` publishes its polling cadence as **the product's own** constants with the
 * reasoning attached (`cadence.ts`), because no provider limit was ever measured for the only
 * provider a browser can reach. **The same is true here and it is worth being exact about what is
 * *not* being reused.** `docs/PROVIDERS.md` §4.4 arm E measured a worker round trip of **17 ms**,
 * then **5 ms**, against a **loopback origin** — that measures the worker's wake latency, not a
 * provider's, and no provider has ever been reached from this repository outside a recorded
 * response. So this number is **not** derived from it, and it is not published anywhere on the
 * page: `website-client` forbids the page showing a cadence it has not measured, and the same rule
 * applies to a stranger's page far more strongly, because there is nowhere on it to attribute a
 * figure to.
 *
 * **Why 30 000ms, stated so it can be argued with.** Three orders of magnitude above the only round
 * trip ever measured here, so that no plausible provider latency approaches it — and short enough
 * that a person waiting on a form is not left looking at a control that appears broken. It is a
 * **ceiling on this page's patience**, not a claim about any provider, and the requirement it serves
 * says only that the page re-reads what it can confirm when the ceiling passes.
 *
 * **It is exported so a browser spec can import it** rather than hand-pick a number large enough to
 * pass — which is the recorded defect this repository has hit four times, most recently when a
 * ceiling chosen to fit the test raced the thing it was waiting for.
 *
 * ## What crossing it produces, and why a read rather than a claim
 *
 * **A read of this device's stored mailbox, and nothing else.** The worker persists a created
 * mailbox before it answers, so a mailbox found there *is* the created address; and if the worker
 * never ran, then nothing was created and a second request is the right next step. The alternative —
 * reporting a failure — would be a claim about an event nobody observed, and it is also the report
 * that invites a second creation.
 *
 * **A read that *rejects* is not a read that found nothing**, and the two are kept apart here for
 * the reason `SpectreStorage` draws the line: a read reported as absent would let a page believe it
 * is a first visit. This page has nothing to create from that, but it does have something to report,
 * and both report the same sentence — *could not confirm* — because neither confirms anything.
 *
 * @module
 */

/**
 * How long the page waits before it stops and looks for what it can confirm.
 *
 * **Exported rather than inlined at the one call site**, so a browser spec that has to outlast it
 * can import it instead of picking a figure chosen to make its own assertions pass.
 */
export const IN_PAGE_CREATE_CEILING_MS = 30_000;
