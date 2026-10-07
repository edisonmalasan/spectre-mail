/**
 * The two measurements `design.md` D1 requires before anything decides where the session
 * lives.
 *
 * ## Why a measurement lives in a test at all
 *
 * D1's decision was deferred because this repository could not answer two questions:
 * **how long an MV3 background service worker actually survives idle**, and **what floor
 * `chrome.alarms` enforces**. Both are properties of Chromium, not of this code, and
 * both were previously assumptions written as if they were facts.
 *
 * Measuring them here rather than by hand has one property worth stating plainly: **the
 * numbers below are recorded in the spec's own comments, and this file is where they
 * came from.** If a future Chromium changes them, this suite's assertions fail and the
 * recorded number is visibly wrong, rather than the decision quietly resting on a
 * measurement nobody re-checked.
 *
 * ## What this file deliberately does NOT measure, and cannot
 *
 * - **A live provider.** Nothing here contacts Mail.tm or Guerrilla Mail. Every provider
 *   response in this milestone's tiers is a recorded one, so `use it externally` remains
 *   unverified â€” and that is unchanged by this file.
 * - **Whether polling a provider every five seconds is tolerated.** That is the question
 *   M9's own slice has to answer, and it needs a live provider; measuring the browser's
 *   willingness to keep a worker alive says nothing about a provider's patience.
 * - **Firefox or WebKit.** Neither supports `--load-extension`, so neither is reachable
 *   from this tier at all.
 */

import { expect, test } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";

/**
 * The ceiling on the idle-lifetime measurement.
 *
 * **A ceiling, not a target, and the distinction matters.** The question D1 asks is "does
 * the worker survive at all", and the honest answer is a *bound* â€” "it was still alive
 * after N seconds" â€” rather than an exact lifetime, because the real termination point
 * depends on Chromium's internal inactivity bookkeeping and is not something to assert
 * to the second. Asserting an exact number would make this suite fail whenever
 * Chromium's bookkeeping shifts, for no gain in what it establishes.
 *
 * **The value is the one Chromium documents, not one chosen to be large enough.** This is
 * the recorded defect this repository has now hit four times: a hand-picked constant that
 * is "big enough" is a check that cannot fail. 30 seconds is MV3's documented
 * idle-termination window, so it is the smallest ceiling that could distinguish "the
 * worker survives half a minute idle" from "the worker dies almost immediately" â€” the
 * two answers that would decide D1 differently.
 */
const IDLE_SURVIVAL_CEILING_MS = 30_000;

/** How often the worker is checked while idling. */
const IDLE_POLL_MS = 1_000;

let extension: LaunchedExtension;

test.beforeAll(async () => {
  extension = await launchExtension();
  // **A page is required and this is not incidental.** `launchPersistentContext` returns
  // a context with no pages, and Chromium will not keep a profile alive with nothing in
  // it. A context that shuts down mid-measurement would read as "the worker terminated"
  // â€” which is precisely the ambiguity this file exists to remove.
  await extension.context.newPage();
});

test.afterAll(async () => {
  await extension?.close();
});

/**
 * ## The `chrome.alarms` floor is measured in a FIXTURE, and this file says why
 *
 * The obvious way to measure the alarms floor is to call `chrome.alarms` in the
 * shipped extension's worker. **That was tried, and it failed with
 * `TypeError: Cannot read properties of undefined (reading 'create')`** â€” because
 * `chrome.alarms` does not exist unless the manifest declares the `alarms` permission,
 * and `static/manifest.json` **deliberately does not**, because
 * `design.md` D1 declines to ship a polling loop and M12's permissions review asks of
 * every permission "what user-facing feature requires this?".
 *
 * So the two requirements genuinely conflict *for the instrument*: measuring the floor
 * requires declaring a permission that no shipped surface uses. The resolution is the
 * same one `docs/PROVIDERS.md` and D4 already establish for the live host-permission
 * check â€” **a throwaway fixture extension that ships nothing**, loaded separately from
 * `apps/extension/dist` by `alarm-floor.spec.ts`.
 *
 * That is a stronger outcome than the measurement it replaced, and worth naming: the
 * first attempt at this measurement **proved a fact about the shipped manifest** â€” that
 * it requests nothing it does not use â€” by being unable to run.
 */
test.describe("MV3 service worker idle lifetime", () => {
  test("stays alive across an idle window, and the window is the measured bound", async () => {
    const start = Date.now();
    let terminatedAt: number | null = null;

    while (Date.now() - start < IDLE_SURVIVAL_CEILING_MS) {
      // **Polling the context's own worker list, which is the observable.** Whether
      // Chromium has torn the worker down is not something the worker itself can report
      // â€” a terminated worker runs no more code, so anything it would have said is
      // silence. The list is the only witness.
      const alive = extension.context.serviceWorkers().length > 0;
      if (!alive) {
        terminatedAt = Date.now() - start;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, IDLE_POLL_MS));
    }

    const survivedMs = Date.now() - start;

    // **Measured 2026-10-07, Chromium 141 (Playwright 1.63.0), headless:** the worker was
    // still registered after a full 30 000 ms with no events dispatched to it and no
    // alarm created. **It did not terminate inside the ceiling.**
    //
    // **What that does and does not establish.** It establishes that a worker with no
    // work to do is not torn down within 30 seconds of idling in this Chromium, in this
    // configuration, under this load. It does **not** establish a lifetime â€” the worker
    // was still alive when the measurement stopped, so the termination point is
    // unmeasured and this file does not claim it. Nor does it establish anything about
    // a worker that *has* registered an alarm, which is the configuration D1 actually
    // needs, because the alarm is exactly the thing this milestone declines to create
    // until its floor is known.
    expect(
      terminatedAt,
      `the worker terminated after ${String(terminatedAt)}ms; it was still alive at ` +
        `${survivedMs}ms only if this passed`,
    ).toBeNull();
    expect(survivedMs).toBeGreaterThanOrEqual(IDLE_SURVIVAL_CEILING_MS);
  });
});
