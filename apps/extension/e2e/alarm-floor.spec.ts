/**
 * The `chrome.alarms` period floor, measured through a throwaway fixture.
 *
 * ## Why a fixture and not the shipped extension
 *
 * `chrome.alarms` **does not exist** unless the manifest declares the `alarms`
 * permission, and `static/manifest.json` deliberately does not: `design.md` D1 declines
 * to ship a polling loop, and M12's permissions review asks of every permission "what
 * user-facing feature requires this?". Adding `alarms` to measure the floor would mean
 * shipping a permission nothing uses, which is the same defect the manifest spec file
 * asserts against.
 *
 * The first version of this measurement tried the shipped worker and failed with
 * `TypeError: Cannot read properties of undefined (reading 'create')`. **That failure is
 * recorded as a result**, not just as a wrong turn: it is the `alarms` permission's
 * absence being confirmed by the platform rather than by a review of a JSON file.
 *
 * So the measurement runs against `e2e/fixtures/alarm-probe/`, which declares `alarms`
 * **and now `storage` as well**, and ships no user-facing surface. This is the same
 * quarantine shape D4 establishes for the live host-permission check, and the same one
 * `tests/provider-spike/` established for the provider probes: **the instrument that
 * answers a question may need rights the product must not have.**
 *
 * **The second permission arrived with `alarms-packing-interval` (2026-10-10), which
 * needed a fired-alarm record to outlive the worker that observed it** — an array held in
 * the worker is silently truncated if the worker is terminated, and a truncated record is
 * indistinguishable from an alarm that stopped firing. So the sentence above was false
 * the moment that measurement landed and is corrected here rather than left to mislead.
 * `apps/extension/static/manifest.json` is still unchanged and requests `storage` alone.
 *
 * ## What this measurement can and cannot establish
 *
 * It measures what the API **stores**. It does not measure when Chromium **fires**, and
 * the two are different: Chrome documents packing recurring alarms to no more than once
 * per 30 seconds for unpacked extensions, while `getAll()` reports the requested period
 * verbatim. So "the platform accepted a 5-second period" and "the platform will wake a
 * worker every 5 seconds" are separate claims, only the first of which is established
 * here.
 *
 * **The second was measured on 2026-10-10 by `alarms-packing.mjs`, and the answer was
 * that this file's caution was warranted and then some**: there is no packing on this
 * substrate (a 5 000 ms alarm fired at 5 000 ms), **and two alarms armed together starve
 * one another**, the slower firing not at all in a 120 s window. Both are in
 * `docs/PROVIDERS.md` §4.1.1. **This spec still claims only what the API stores** — it is
 * a fast gate over a shipped manifest, and folding a four-minute measurement into it
 * would buy nothing: the finding is recorded once, in the place that owns it.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium, expect, test } from "@playwright/test";
import type { BrowserContext, Worker } from "@playwright/test";

import { extensionFlags } from "../playwright.config";

const PROBE_DIR = fileURLToPath(new URL("./fixtures/alarm-probe", import.meta.url));

/**
 * The periods to ask for, in minutes.
 *
 * **The first two are the product's own numbers**, from `packages/mailbox/src/cadence.ts`:
 * `INBOX_POLL_PROMPT_MS` is 5 000ms and `INBOX_POLL_CEILING_MS` is 30 000ms. A background
 * poller would have to schedule at one of those, so the floor is measured against them
 * rather than against a round number — and a floor above 30 seconds would mean the
 * website's whole cadence is unschedulable in a background context.
 *
 * **The last two are bounds rather than products.** `1 / 60` is one second, which is the
 * value a naive reading would expect a "minimum" to be; `0.0166` is 999.6ms, chosen to
 * sit *below* it so that a floor at one second would be caught rather than satisfied.
 */
const REQUESTED_PERIODS_MINUTES = [5_000 / 60_000, 30_000 / 60_000, 1, 1 / 60, 0.0166];

interface Probe {
  readonly context: BrowserContext;
  readonly worker: Worker;
  close(): Promise<void>;
}

/** Load the probe fixture and wait for its worker, failing loudly rather than returning nothing. */
async function launchProbe(): Promise<Probe> {
  if (!existsSync(PROBE_DIR)) {
    throw new Error(
      `The alarm probe fixture is missing at ${PROBE_DIR}. Without it this measurement ` +
        `cannot run, and it cannot be substituted by adding "alarms" to the shipped ` +
        `manifest — see this file's note on why that would be the wrong repair.`,
    );
  }

  const userDataDir = fileURLToPath(
    new URL(`../test-results/alarm-probe-profile-${process.pid}`, import.meta.url),
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    args: extensionFlags(PROBE_DIR),
  });

  let worker: Worker | undefined;
  try {
    const existing = context.serviceWorkers();
    worker = existing[0] ?? (await context.waitForEvent("serviceworker", { timeout: 30_000 }));
  } catch (cause) {
    await context.close();
    throw new Error(
      `The alarm probe fixture registered no service worker: ${String(cause)}. Both flags ` +
        `and an absolute path are required — see extensionFlags() in playwright.config.ts.`,
    );
  }

  return {
    context,
    worker,
    async close() {
      await context.close();
    },
  };
}

test.describe("the chrome.alarms period floor", () => {
  let probe: Probe;

  test.beforeAll(async () => {
    probe = await launchProbe();
    await probe.context.newPage();
  });

  test.afterAll(async () => {
    await probe?.close();
  });

  test("stores every requested period, including the 5 s the shared cadence wants", async () => {
    const readBack = await probe.worker.evaluate(async (requested: number[]) => {
      const alarms = (
        globalThis as unknown as {
          chrome: {
            alarms: {
              create(name: string, info: { periodInMinutes: number }): void;
              getAll(): Promise<{ name: string; periodInMinutes: number }[]>;
              clear(name: string): Promise<boolean>;
            };
          };
        }
      ).chrome.alarms;

      // **The API's existence is checked before it is used**, and reported as a value
      // rather than allowed to throw a bare `TypeError`. A measurement that cannot tell
      // "the platform has no such API" from "the platform refused my period" reports a
      // missing permission as a floor, which is a measurement about nothing.
      if (alarms === undefined) {
        return { available: false as const, entries: [] };
      }

      const entries: { requested: number; granted: number | undefined; refused: boolean }[] = [];

      for (const [index, periodInMinutes] of requested.entries()) {
        const name = `spectre-alarm-floor-${index}`;
        try {
          alarms.create(name, { periodInMinutes });
        } catch {
          entries.push({ requested: periodInMinutes, granted: undefined, refused: true });
          continue;
        }
        const found = (await alarms.getAll()).find((alarm) => alarm.name === name);
        entries.push({
          requested: periodInMinutes,
          granted: found?.periodInMinutes,
          refused: false,
        });
        await alarms.clear(name);
      }

      return { available: true as const, entries };
    }, REQUESTED_PERIODS_MINUTES);

    expect(
      readBack.available,
      "chrome.alarms is absent even from a fixture that declares the permission, so the " +
        "floor is unmeasured and must not be recorded as any particular value",
    ).toBe(true);

    // **Measured 2026-10-07, Chromium 141 (Playwright 1.63.0), headless, unpacked:** every
    // requested period was accepted and read back **unchanged** — including 0.0166
    // minutes (999.6 ms), which is below one second. No clamping, no rejection, no error.
    //
    // **Read the limits before reading the number.** This establishes that the API
    // *stores* what it is given. It does **not** establish that Chromium *fires* at that
    // rate: Chrome's documented behaviour is to pack recurring alarms to at most once
    // per 30 seconds, and `getAll()` reports the requested period rather than the
    // packing interval. So the honest conclusion is "**the API raises no floor here**",
    // and the open question D1 still carries is the packing interval — which needs a run
    // long enough to observe actual firing, and is **not** claimed by this file.
    for (const entry of readBack.entries) {
      expect(entry.refused, `chrome.alarms refused a period of ${entry.requested}`).toBe(false);
      expect(
        entry.granted,
        `chrome.alarms stored nothing for a requested period of ${entry.requested}`,
      ).toBeDefined();
      expect(entry.granted).toBeCloseTo(entry.requested, 4);
    }
  });
});
