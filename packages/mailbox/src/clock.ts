/**
 * The clock seam.
 *
 * **The session is given its scheduler and reaches for no timer itself**, and that
 * is not tidiness - it is the only thing keeping a scheduler out of this package.
 *
 * `packages/mailbox`'s `tsconfig` omits the `DOM` lib, which makes `window`,
 * `document`, and `location` fail to compile. It does **not** stop `setTimeout`:
 * `@types/node` declares it, in exactly the way it declares `navigator` and
 * `sessionStorage`, both of which the M5 slice 1 verification pass measured
 * compiling in this package. So "the compiler keeps timers out" was never true, and
 * an injected scheduler is what actually does it.
 *
 * Two consequences shaped the shape below. It is **narrow** rather than a general
 * time service, because every extra capability here is another way for the package
 * to acquire something it should not have. And it is a real parameter rather than a
 * default, so there is no code path that works only when a test happens to have
 * mocked a global - a package whose only proof is that its test runner can
 * substitute a global is a package whose behaviour is really the runner's.
 *
 * @module
 */

/** Cancels a scheduled callback. Calling it more than once is harmless. */
export type Cancel = () => void;

/**
 * The only thing about time this package may know.
 *
 * **Narrowed at the apply stage, 2026-10-03, from the pair the design proposed.**
 * D2 specified `now(): number` alongside `schedule`, on the reasoning that a
 * timestamp is a natural thing for an inbox to label a check with. Nothing in this
 * slice labels one - `website-client` explicitly forbids showing a countdown or an
 * interval, so a `checkedAt` would have been carried through four layers to reach
 * no reader. So the seam is scheduling only.
 *
 * That is more than tidiness. `provider-abstraction` forbids inferring a mailbox
 * lifetime from elapsed time, and a clock handed to a package that holds state is
 * the standing invitation to do exactly that. Handing over only the capability
 * that is actually needed removes the invitation rather than relying on review to
 * decline it. When something genuinely needs to label a moment in time, add `now`
 * then - with a caller that wants it - rather than carrying it speculatively now.
 */
export interface MailboxScheduler {
  /**
   * Run `run` after at least `afterMs`.
   *
   * `afterMs` is a **minimum**, not a target. The poller passes a floor computed from
   * a provider's stated limit, and an implementation that fired sooner would break a
   * requirement the poller believes it is satisfying.
   */
  schedule(afterMs: number, run: () => void): Cancel;
}
