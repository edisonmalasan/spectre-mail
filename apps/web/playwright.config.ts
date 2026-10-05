import { defineConfig, devices } from "@playwright/test";

/**
 * The browser tier's configuration.
 *
 * ## Why this file is not `vitest.config.ts`
 *
 * Two tiers, two runners, because they execute different code against different
 * platforms. Vitest runs the sources under Node and jsdom; this runs the **built**
 * page in a real browser against real IndexedDB. One runner claiming both would
 * report a browser-free run as covering a browser suite.
 *
 * ## Why the site under test is the built output
 *
 * `apps/web/src/main.tsx` renders `<App />` with no props, so the shipped page
 * builds its own provider manager and its own storage — including
 * `createBrowserStorage()`, which no test in this workspace has ever executed,
 * because jsdom implements no IndexedDB. Mounting `<App session={stub} />` in a
 * browser instead would verify a composition no user ever receives, and the one
 * decision this tier exists to check is the page's own wiring. `webServer` below
 * therefore runs `vite preview` against `dist`, not the dev server.
 *
 * ## Why the spec pattern is a glob and not a literal
 *
 * `tests/architecture/boundaries.test.ts` resolves the patterns from this file
 * against the specs actually on disk, so narrowing `testDir` or `testMatch` fails
 * the build and names the uncovered spec. A literal path would read as coverage
 * and verify one file.
 */
/**
 * Where the built site is served, and the one origin it is allowed to load from.
 *
 * Exported rather than repeated in the suite, because a spec that hard-coded the
 * port would be checking a *different* origin than the one it is running against —
 * and IndexedDB is partitioned by origin, so an origin mismatch would show up as
 * data written somewhere the assertion never looks. Importing it makes that
 * impossible rather than merely unlikely.
 */
export const SITE_ORIGIN = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,

  // **An empty run fails, and that is Playwright's default rather than a flag.**
  // This comment first set `passWithNoTests: false`, copied from `vitest.config.ts`,
  // and `tsc` rejected it: that option is Vitest's and Playwright has no such
  // field. The property I wanted is real anyway — observed, not assumed — because
  // Playwright exits non-zero with `No tests found` when `testDir` matches nothing.
  // So the flag is deleted and the behaviour is stated as a default we rely on.

  // **Chromium only, and headless.** Every claim this tier makes is about what a
  // browser does with IndexedDB, and Chromium is the one browser measured. Adding
  // a project per engine would turn "verified" into "verified somewhere" without
  // adding evidence about the claim itself.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // The built page, served over HTTP. A `file://` load would be a different
  // origin from anything a user has, and IndexedDB is partitioned by origin.
  webServer: {
    command: "pnpm preview --port 4173 --strictPort",
    url: `${SITE_ORIGIN}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },

  use: {
    baseURL: SITE_ORIGIN,
    // Each spec gets its own browser context, so one spec's IndexedDB is never
    // visible to the next. Playwright already isolates contexts; this is stated
    // because the whole suite is about persistence and the isolation is the point.
    trace: "off",

    /**
     * Chromium launch arguments, and this is the repair for a **measured** CI hang.
     *
     * ## What was observed
     *
     * Three runs of the `browser` job on `ubuntu-latest` printed
     * `Running 6 tests using 1 worker` and then produced **no test result line at
     * all** before the step was killed — 19m35s, 29m34s, and 10m respectively. The
     * webServer had come up, and the install had finished in 24 seconds.
     *
     * **The absence of a result line is the evidence, and it is what points here.** A
     * test that hangs still reports a timeout after its own 60 seconds. Producing
     * *nothing* for longer than the test timeout means the run never got as far as
     * running a test, so the wait is Chromium coming up rather than this suite's
     * logic — which is the one part of this tier that is not written in this
     * repository.
     *
     * ## Why these two flags
     *
     * - `--disable-dev-shm-usage` stops Chromium using `/dev/shm` for shared memory
     *   and uses `/tmp` instead. A runner with a small `/dev/shm` is the documented
     *   cause of a browser that starts and then stops responding.
     * - `--no-sandbox` is required because the GitHub-hosted Linux runner executes
     *   the browser in an environment where Chromium's user-namespace sandbox cannot
     *   initialise. Chromium then waits rather than exiting.
     *
     * **Neither flag is applied on Windows**, and neither is applied conditionally on
     * any signal this repository can observe: Chromium's sandbox state is not
     * something a test can read, and a conditional flag whose condition cannot be
     * tested is a flag whose absence cannot be noticed either. They are unconditional
     * so the configuration under test is the configuration that runs.
     *
     * **What this does not establish.** That these flags are *the* cause is a
     * hypothesis with a measurement behind it, not a confirmed diagnosis — this
     * machine is Windows and has never reproduced the hang. The flags are the
     * documented remedy for the symptom that was measured; if the next run still
     * hangs, the measurement stands and the hypothesis does not, and that is recorded
     * rather than argued away.
     */
    launchOptions: {
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    },
  },

  // The browser tier is allowed to be slower than the unit tier and is not
  // counted against it — `pnpm verify` does not run these specs at all.
  timeout: 60_000,
});
