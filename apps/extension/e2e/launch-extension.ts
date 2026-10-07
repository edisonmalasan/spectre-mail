/**
 * Launching the built extension in Chromium.
 *
 * ## Why this exists rather than each spec doing it
 *
 * Three things have to be true before any spec in this tier can assert anything, and
 * all three are preconditions rather than assertions — which is precisely the shape this
 * repository has recorded four times as the most likely to be too weak:
 *
 * 1. **`dist` exists and is current.** A stale `dist` makes every spec pass against a
 *    build this run never produced, which is the recorded `archive-bytes` defect: SHA
 *    verification covered sources while the artefact two seconds older survived.
 * 2. **The extension actually loaded.** `launchPersistentContext` does not fail when
 *    `--load-extension` names a directory Chromium rejects. It returns a perfectly
 *    ordinary context with no extension in it, and every spec that then looked for one
 *    would be looking for something that was never there.
 * 3. **Its service worker registered**, which is what proves the manifest was accepted
 *    rather than merely parsed.
 *
 * So each of the three is **established, and fails loudly.** The manifest's own validity
 * is checked by reading Chromium's own record of the installed extension, not by asking
 * whether a URL resolved.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import type { BrowserContext, Worker } from "@playwright/test";

import { EXTENSION_DIST, extensionFlags } from "../playwright.config";

/** The built extension's directory, resolved from this file rather than the cwd. */
const DIST_PATH = fileURLToPath(new URL(`../${EXTENSION_DIST}`, import.meta.url));

/** Distinguishes launches within one process. See the `userDataDir` note below. */
let launchCounter = 0;

/**
 * What a launched extension is, as this suite needs to see it.
 *
 * **The context, not the browser**, because `launchPersistentContext` returns a context
 * and a persistent context has no `browser` to close separately. Getting that wrong
 * leaks a profile directory per run.
 */
export interface LaunchedExtension {
  readonly context: BrowserContext;
  /** Chromium's own record of what it installed, read from the browser's extension API. */
  readonly worker: Worker;
  /** The `chrome-extension://` id Chromium assigned. */
  readonly extensionId: string;
  /** Close everything. Called by the spec's `afterAll`, never left to a `finally`. */
  close(): Promise<void>;
}

/**
 * Launch the built extension and wait until it has registered a service worker.
 *
 * **Fails rather than returning a context with nothing in it.** The failure message says
 * what was looked for and what was found, because "no service worker" is the single
 * symptom that covers a missing build, a rejected manifest, a malformed
 * `service_worker` path, and a worker that threw on load — and a suite that cannot tell
 * those apart produces the same green for all four.
 *
 * @throws If `dist` is missing, if no extension loads, or if no worker registers within
 *   the ceiling.
 */
export async function launchExtension(): Promise<LaunchedExtension> {
  if (!existsSync(join(DIST_PATH, "manifest.json"))) {
    throw new Error(
      `${join(DIST_PATH, "manifest.json")} does not exist. Run "pnpm build:extension" ` +
        `before this suite: without a built extension every spec here would pass ` +
        `against a directory Chromium never loaded.`,
    );
  }

  // **A fresh profile directory per launch, and the name is not just the pid.**
  //
  // Playwright runs spec files in parallel **within one process**, so `process.pid` is
  // the *same* for four specs at once — the first version of this used only the pid, so
  // `manifest.spec.ts` and `popup.spec.ts` shared one profile. It passed, and that is
  // exactly the problem: a shared profile means one spec's extension installation and
  // storage are visible to another, so which specs pass would depend on scheduling. The
  // counter makes each launch's directory unique within the process, and the pid keeps
  // concurrent processes apart.
  launchCounter += 1;
  const userDataDir = fileURLToPath(
    new URL(`../test-results/extension-profile-${process.pid}-${launchCounter}`, import.meta.url),
  );

  const context = await chromium.launchPersistentContext(userDataDir, {
    // **`channel: "chromium"` is retained even though it was measured not to be what
    // made the difference**, because it does select the full binary rather than
    // `chromium_headless_shell`, and a suite whose subject is extension loading should
    // not depend on which of the two Chromium builds Playwright happens to default to.
    // The measurement stands on its own in `playwright.config.ts`: the *flags* are what
    // load the extension, and the channel changed nothing.
    channel: "chromium",
    // **`extensionFlags(DIST_PATH)`, not the relative name.** Chromium silently loads
    // nothing for a relative `--load-extension`, which was measured rather than
    // assumed — see `playwright.config.ts`.
    args: extensionFlags(DIST_PATH),
  });

  let worker: Worker | undefined;
  try {
    worker = await waitForServiceWorker(context);
  } catch (cause) {
    await context.close();
    throw new Error(describeFailure(context, cause));
  }

  const extensionId = new URL(worker.url()).host;

  return {
    context,
    worker,
    extensionId,
    async close() {
      await context.close();
    },
  };
}

/**
 * Wait for the extension's worker, on an event rather than a sleep.
 *
 * **The event, because a poll loop here is the recorded weak precondition.** A worker
 * that registers in 80ms and one that registers in 4s are both fine; a fixed sleep is
 * either slow every run or flaky, and `AGENTS.md` records a repair that was red in 6 of
 * 10 runs for exactly this reason.
 */
async function waitForServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers();
  if (existing.length > 0) {
    return existing[0]!;
  }

  return context.waitForEvent("serviceworker", { timeout: 30_000 });
}

/**
 * Say what was actually installed, so the failure names a cause rather than a symptom.
 *
 * **The manifest is read from disk and its `name` reported.** Chromium does not expose
 * "extensions that failed to load" through the API this suite can reach, so the useful
 * information is what *was* found plus what the file claims — which together distinguish
 * "nothing installed at all" from "installed but never registered a worker".
 */
function describeFailure(context: BrowserContext, cause: unknown): string {
  const workers = context.serviceWorkers().length;
  let name = "(manifest unreadable)";
  try {
    const manifest = JSON.parse(readFileSync(join(DIST_PATH, "manifest.json"), "utf8")) as {
      name?: string;
    };
    name = manifest.name ?? "(manifest declares no name)";
  } catch {
    // Deliberately left as the default. The thrown cause carries the real failure.
  }
  return (
    `The built extension at ${DIST_PATH} (manifest name: ${name}) registered ` +
    `${workers} service worker(s). Chromium did not report an error, so the usual ` +
    `causes are a malformed manifest, a "background.service_worker" path that does not ` +
    `exist in dist, or a worker that threw while loading. Underlying cause: ${String(cause)}`
  );
}
