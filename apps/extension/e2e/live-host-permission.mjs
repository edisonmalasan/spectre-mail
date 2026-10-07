/**
 * The live host-permission check — the ONLY live network call in this repository, and it
 * is opt-in.
 *
 * ## What requirement this discharges
 *
 * `provider-abstraction` requires that *"a test SHALL exercise the declared pattern against the
 * live provider origin to prove it grants access."* `README.md` deferred that to *"the milestone
 * that owns extension and provider infrastructure"*, and M8 is that milestone. This file is the
 * deliverable, and `design.md` D4 records why it does not run in CI.
 *
 * ## Why both forms, and why the failing one is the point
 *
 * `https://api.mail.tm` — no path — is **accepted into a manifest and grants nothing**. That was
 * measured by the M0 spike: the extension installs, reports success, and every cross-origin request
 * then fails with an opaque `TypeError: Failed to fetch` naming no permission at all.
 *
 * So a check that fetched once with the wildcard pattern and passed would ALSO pass on a
 * configuration where the product's provider is unreachable. The negative half is what gives the
 * check its meaning: **the wildcard form must succeed and the slash-less form must fail, in the
 * same run, against the same origin.** A check that cannot fail for the reason it exists is not a
 * check — the thirtieth recorded instance of that shape in this repository.
 *
 * ## Two fixture extensions, and neither ships anything
 *
 * The patterns cannot live in one manifest, because a manifest declaring both `https://api.mail.tm/*`
 * and `https://api.mail.tm` grants the origin outright and the negative half would be testing
 * nothing. **Each half is therefore its own throwaway extension**, generated into a temp directory
 * here rather than committed, so nothing under `apps/extension/static/` or `dist/` can carry a
 * permission the product does not hold.
 *
 * This is the same quarantine shape the `chrome.alarms` floor measurement uses
 * (`e2e/fixtures/alarm-probe/`), for the same reason: **the instrument that answers a question may
 * need rights the product must not have.**
 *
 * ## How to run it
 *
 *     node apps/extension/e2e/live-host-permission.mjs
 *
 * Exits `0` when both halves behave as required, `1` otherwise. **It is not in `package.json`'s
 * scripts**, deliberately: a script name is an invitation, and this must be run by a person who has
 * decided to spend a request on a third party. Task 9.4 confirms its absence from `pnpm verify`,
 * `pnpm test`, and the browser tiers by running all three with this file unreachable.
 *
 * ## What it establishes, and what it does not
 *
 * It establishes that **the declared pattern grants cross-origin access from a real privileged
 * extension context** — the one thing the slash-less form silently fails, and the one thing no
 * recorded fixture can stand in for, because a recorded response never involves a permission.
 *
 * It establishes **nothing about `use it externally`**, which is the whole signup flow against a
 * real service. It is one `GET` against one origin, and it creates nothing.
 *
 * The endpoint is Mail.tm's `GET /domains`, which is the same anonymous, unauthenticated call the
 * adapter's `fetchDomain` makes and the same one `docs/PROVIDERS.md` records as `200`.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "@playwright/test";

/** The endpoint the adapter reaches first, and the one the pattern is measured against. */
const ENDPOINT = "https://api.mail.tm/domains?page=1";

/** The origin whose grant is under test. */
const ORIGIN = "https://api.mail.tm";

/**
 * How long a single attempt may take before it counts as inconclusive rather than fast.
 *
 * **Applied as an abort signal, because declaring a timeout nobody enforces is a comment.**
 * `pnpm lint` caught this constant unused on its first run, which is the correct outcome:
 * the first version of this file measured nothing with it and merely named an intention.
 * An aborted fetch resolves as a throw like any other, so it lands in the same `refused`
 * branch — **which means a timeout would read as "the permission was refused"**, and that
 * is a distinction worth stating rather than hiding: the summary line prints the thrown
 * message, so a timeout is visible as a message naming `Abort` and not as a permission
 * verdict.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * The two manifests, differing in exactly one character.
 *
 * **Written as pairs so the difference is visible.** `host_permissions` is the only field that
 * differs between them; anything else varying would mean a difference in the run could explain a
 * difference in the result.
 */
const CASES = [
  { label: "wildcard path form", pattern: `${ORIGIN}/*`, mustGrant: true },
  { label: "slash-less form", pattern: ORIGIN, mustGrant: false },
];

/**
 * Write a throwaway extension declaring one host permission, and return its directory.
 *
 * **The smallest manifest that loads at all.** It names a background service worker because Chromium
 * requires one to register an extension, and that worker is the module this script evaluates the
 * `fetch` from — the fetch has to happen *inside* the privileged context, since that is the entire
 * question.
 */
function writeFixture(directory, pattern) {
  // **Created here, because `mkdtempSync` only creates the leaf.** The first run of this file
  // failed with `ENOENT` on `case-0/manifest.json` — a missing directory, not a bad path — and
  // the fix is to make the fixture rather than to widen the temp root.
  mkdirSync(directory, { recursive: true });

  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify(
      {
        manifest_version: 3,
        name: "SpectreMail live host-permission probe",
        version: "0.0.0",
        host_permissions: [pattern],
        background: { service_worker: "probe.js", type: "module" },
      },
      null,
      2,
    ),
    "utf8",
  );

  // **A no-op worker.** It holds no permission of its own and issues no request; the fetch below
  // is driven from Playwright into this context, so the script's only job is to exist.
  writeFileSync(join(directory, "probe.js"), "// live host-permission probe\nexport {};\n", "utf8");

  return directory;
}

/**
 * Ask the origin once, from inside the loaded extension, and report what happened.
 *
 * **The status code is the answer, and the fetch must be issued with no interception at all.** A
 * route handler would answer the request itself and the permission would never be consulted, which
 * is the failure this check exists to detect.
 *
 * A thrown error is a **result, not a crash**: an extension without the grant produces exactly that
 * (`TypeError: Failed to fetch`), so it is reported as "refused" with its own message.
 */
async function attempt(directory, label) {
  const context = await chromium.launchPersistentContext(join(directory, "profile"), {
    channel: "chromium",
    args: [
      `--load-extension=${directory}`,
      `--disable-extensions-except=${directory}`,
      "--no-first-run",
    ],
  });

  try {
    const workers = context.serviceWorkers();
    const worker = workers[0] ?? (await context.waitForEvent("serviceworker", { timeout: 30_000 }));

    const outcome = await worker.evaluate(
      async ([url, timeout]) => {
        try {
          // **`credentials: "omit"`, and it matters to the claim rather than to privacy.**
          // A grant that only worked with credentials would not be the grant the product
          // uses: Mail.tm's anonymous `/domains` call is unauthenticated, and the browser
          // tier asserts the same. Sending credentials would let a *cookie* satisfy the
          // request and hide a missing host permission behind one.
          const response = await fetch(url, {
            credentials: "omit",
            signal: AbortSignal.timeout(timeout),
          });
          return { granted: true, status: response.status };
        } catch (cause) {
          return { granted: false, status: null, error: String(cause) };
        }
      },
      /** Passed in rather than closed over: `evaluate` serialises the function, so a value captured from this module's scope would be undefined inside the worker. */
      [ENDPOINT, REQUEST_TIMEOUT_MS],
    );

    return { label, ...outcome };
  } finally {
    await context.close();
  }
}

async function main() {
  const root = mkdtempSync(join(tmpdir(), "spectre-live-permission-"));
  const results = [];

  try {
    for (const [index, testCase] of CASES.entries()) {
      // **A separate directory per case, each with its own profile.** Sharing a profile would let
      // the first case's installation answer the second case's request, which would make the
      // negative half incapable of failing.
      const directory = writeFixture(join(root, `case-${index}`), testCase.pattern);
      results.push({ ...testCase, actual: await attempt(directory, testCase.label) });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  let failed = false;
  for (const result of results) {
    const behaved = result.actual.granted === result.mustGrant;
    if (!behaved) failed = true;
    process.stdout.write(
      `${behaved ? "PASS" : "FAIL"}  ${result.label.padEnd(20)} ` +
        `${result.pattern.padEnd(26)} ` +
        `expected ${result.mustGrant ? "granted " : "refused  "}, ` +
        `got ${result.actual.granted ? `granted (HTTP ${result.actual.status})` : `refused (${result.actual.error})`}\n`,
    );
  }

  process.stdout.write(
    "\nThis is the only live network call in this repository. It establishes that the declared\n" +
      "host-permission pattern grants cross-origin access from a real privileged extension\n" +
      "context. It establishes nothing about `use it externally` and contacts no service that\n" +
      "was not already public.\n",
  );

  process.exit(failed ? 1 : 0);
}

await main();
