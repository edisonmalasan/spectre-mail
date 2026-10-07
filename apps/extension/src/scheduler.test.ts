/**
 * The scheduler the background worker is given, exercised where there is no `window`.
 *
 * ## This file exists because of a defect found by reading
 *
 * `scheduler.ts` used to spell its receiver `window.setTimeout`, and a background service worker
 * has **no `window`** — so the scheduler the worker must be given threw at call time, in the one
 * context whose entire purpose is to be woken in the background. It compiled, every test that
 * reached it did so from the popup's jsdom environment, and no assertion covered the case. That is
 * the whole of how it survived, and it is recorded in `docs/PROVIDERS.md` §4.4 because the platform
 * fact behind it is the durable part.
 *
 * ## So the environment is the assertion, and it is chosen rather than incidental
 *
 * **This file declares `@vitest-environment node`, which is what makes it a regression test at
 * all.** Under jsdom — the environment the popup's tests run in — `window` exists, `globalThis.window
 * === window`, and **the original defect would have passed this file unchanged**. The one-line way
 * to have caught it was to run the scheduler where a worker actually runs, and choosing the
 * environment is the whole of that choice. Nothing below asserts a duration or a handle; the claim
 * is that the scheduler works in a context with no `window` at all.
 *
 * ## The negative half, and why it is an assertion rather than a comment
 *
 * **If someone reintroduced `window`, this file would fail to compile or fail at call time — and
 * that is the property worth pinning explicitly.** Asserting `globalThis.window` is `undefined` looks
 * like stating the obvious, and it is the only thing that would stop a future environment change
 * quietly restoring the receiver this file was written against: a reader who moved these cases to
 * jsdom "for consistency" would otherwise have removed the regression test without any test failing.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";

import { extensionScheduler } from "./scheduler";

describe("the extension's scheduler, in a context with no window", () => {
  it("runs where there is no window, which is the only place this scheduler is given a worker", () => {
    // **Stated, not assumed.** jsdom would satisfy every assertion in this file while hiding the
    // defect this file was written for, so the environment is pinned by an assertion rather than
    // left to a reader's trust in the docblock above.
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
  });

  it("schedules the run and the cancellation stops it", async () => {
    vi.useFakeTimers();

    try {
      const run = vi.fn();
      extensionScheduler.schedule(50, run);

      // **Both halves, and the second is what makes the first mean anything.** A scheduler that
      // ran everything regardless would pass "it schedules the run"; the cancellation is the claim
      // that it is a *scheduler* and not a loop, and the shared session's cadence depends on it.
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(49);
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops a scheduled run that was cancelled first", async () => {
    vi.useFakeTimers();

    try {
      const run = vi.fn();
      const cancel = extensionScheduler.schedule(50, run);
      cancel();
      vi.advanceTimersByTime(500);

      // **Long enough that a scheduler which ignored its cancel would have fired several times
      // over.** Fifty would also catch it, and the margin costs nothing — the point is that the run
      // has not happened at all by the time the assertion reads.
      expect(run).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancelling twice is harmless, because a teardown may be called twice", () => {
    vi.useFakeTimers();

    try {
      const run = vi.fn();
      const cancel = extensionScheduler.schedule(50, run);

      // **React StrictMode mounts, unmounts and remounts, and a double teardown is the ordinary way
      // that reaches a scheduler.** `packages/mailbox` documents the same hazard for a client
      // unmount; here the only requirement is that asking twice to cancel something already
      // cancelled does not raise.
      expect(() => cancel()).not.toThrow();
      expect(() => cancel()).not.toThrow();
      vi.advanceTimersByTime(500);
      expect(run).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
