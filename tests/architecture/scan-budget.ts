// The architecture suites' shared scan budget.
//
// **A per-test budget for a suite that walks the whole tree is one shared decision, and it was
// one file's private copy.** `boundaries.test.ts` raised its own to 60 s on 2026-10-03, and its
// comment says why: *"a rule that writes a probe file and then re-walks the whole of `apps/` or
// `packages/mailbox/`"*. `branding-audit.test.ts` never raised one, and **its 5000 ms timeout is the
// one measured failure that is about the machine rather than about a race**.
//
// **A constant that lives in one file and is copied into another is a second spelling of a set**,
// and this repository has recorded that shape. So the constant is here, and both suites take it.
//
// **The value is not a tuning knob.** It is the number at which a walk that is slow because the
// machine is busy stops being reported as a failure of a property the assertion does not measure.

/**
 * The per-test budget for an architecture suite that walks the shipped tree.
 *
 * **60 s is roughly 250x the measured single-test cost**, so it cannot hide a regression: a rule
 * that stopped matching does not get *slower*, it gets wrong.
 */
export const SCAN_ASSERTION_TIMEOUT_MS = 60_000;
