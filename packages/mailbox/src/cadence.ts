/**
 * How often the inbox checks for new mail.
 *
 * **These numbers are the product's own, and no measurement supports them.**
 * `docs/PROVIDERS.md` records Mail.tm's `GET /messages` at `30; w=60` **measured
 * unauthenticated only** - the authenticated policy was never separately measured -
 * and Mail.tm is unreachable from a web page in any case, so that figure does not
 * govern this client. Guerrilla Mail, the only provider a browser page can reach,
 * publishes no limit and none was measured. There is therefore no measured safe
 * polling rate for the provider this website uses, and a cadence printed as though
 * a provider permitted it would be a number this repository cannot defend.
 *
 * So they are declared here rather than hidden in a `setTimeout` call, exported so a
 * test can read them, and named `PROMPT` and `CEILING` rather than something that
 * sounds like a budget. `D4` in the change's design.md is what keeps this honest at
 * runtime: when a provider *does* state a limit, that statement is a floor the
 * cadence never schedules beneath, so these constants are a starting point rather
 * than the last word.
 *
 * @module
 */

/**
 * The delay used while a mailbox's contents are changing - and the first delay
 * after anything at all arrives.
 *
 * Low because this is the interval a user feels: they have just typed their address
 * into someone else's form and are watching this page for a code.
 */
export const INBOX_POLL_PROMPT_MS = 5_000;

/**
 * The longest this package will wait between checks, however quiet the mailbox.
 *
 * A ceiling rather than an open-ended backoff, because an unbounded one converts a
 * quiet inbox into a blind spot: the longer the backoff, the longer a message that
 * *did* arrive waits unseen. Thirty seconds is two requests a minute, and bounds
 * the worst case at half a minute rather than at "however long it has been idle".
 */
export const INBOX_POLL_CEILING_MS = 30_000;

/**
 * The delay before the next check, given how many consecutive checks have seen no
 * change.
 *
 * Pure, and a function of its argument alone, so the cadence is verifiable without
 * a clock and cannot be steered by anything the session happens to hold. A change
 * resets the count to zero rather than decaying gradually: a user whose code just
 * arrived is watching, and halving their wait is worth more than the smoothness of
 * a geometric curve.
 *
 * @param unchangedInARow - Consecutive checks that reported identical contents.
 *   Zero means something changed, or nothing has been checked yet.
 * @returns Whole milliseconds to wait. Never above {@link INBOX_POLL_CEILING_MS}.
 */
export function nextDelay(unchangedInARow: number): number {
  if (unchangedInARow <= 0) return INBOX_POLL_PROMPT_MS;

  // `2 **` rather than repeated doubling: the argument is a count of checks, which
  // grows without bound as a mailbox sits quiet, and an unbounded exponent becomes
  // `Infinity` long before a real session would. `Math.min` clamps that to the
  // ceiling, which is the same answer an explicit guard would give - but it cannot
  // drift out of agreement with the constant if the constants change.
  const doubled = INBOX_POLL_PROMPT_MS * 2 ** unchangedInARow;
  return Math.min(doubled, INBOX_POLL_CEILING_MS);
}
