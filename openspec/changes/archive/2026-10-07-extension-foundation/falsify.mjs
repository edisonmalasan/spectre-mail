/**
 * M8 falsification harness — `extension-foundation` §10.
 *
 * ## What this is for
 *
 * A count of caught mutations proves nothing without **what** they were, and this
 * repository has five recorded instances of an assertion narrower than the rule it
 * documented, four of them authored and caught inside the change that introduced them.
 * So the record is per-mutation: the intended test, the outcome, and the restoration.
 *
 * ## The recorded defects this harness exists to avoid, all of them paid for
 *
 * 1. **A mutation whose own text failed to apply reports as a survivor, and as a
 *    pass.** (`S01` on M7 slice 3: a regex that matched nothing, so "nothing failed"
 *    was filed as evidence the assertion was too weak.) **Every edit is verified to
 *    have landed by re-reading the file and requiring the marker**, and an edit that
 *    did not land is `noop` and **skips the run entirely**.
 * 2. **A failed build fell through into the run and was overwritten with `green`.**
 *    (M7 slice 3's worst.) **A mutation touching built source rebuilds, and a failed
 *    build is `nocompile` with no run at all** — the browser must never be served the
 *    *previous* `dist` while the tally claims the mutation survived.
 * 3. **Restoring a source file is not restoring what the browser serves.** `dist/` was
 *    built two seconds before the restore. **The loop rebuilds at the end and reports
 *    a failed rebuild** rather than exiting quietly, because the state outlives the run
 *    and the next person inherits a red suite against a defect nobody wrote.
 * 4. **Unit-tier failing "titles" were file paths**, so an expectation naming a test
 *    *title* could never match. **The whole failing line is captured.**
 * 5. **`pnpm.cmd` cannot be spawned from Node on this machine** (`EINVAL spawnSync`),
 *    and the first harness read empty output as "no failing titles" and reported two
 *    mutations as uncaught when nothing had run. **This harness invokes `node`
 *    directly** and reports `harness-error` when an output contains neither a passed
 *    nor a failed count.
 * 6. **The count pattern must not match the file count.** `Test Files  5 passed` sits
 *    directly above `Tests  114 passed`, and `/(\d+)\s+passed/` matches the wrong one.
 *    **Counts are read off Vitest's own `Tests` line** and Playwright's `N passed`.
 * 7. **A survivor means "the assertion did not catch this", never "the assertion is
 *    too weak", until the mutant has been read.** Every survivor is listed for reading.
 *
 * ## Usage
 *
 *   node falsify.mjs            # all mutations
 *   node falsify.mjs S03 S07    # a subset, by id
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Strip ANSI escapes.
 *
 * **This function is here because the first run of this harness reported 8 of 12
 * mutations as `harness-error`.** Vitest prints `Tests [22m[39m [1m[32m726 passed`,
 * so a pattern anchored on `^\s*Tests\s+\d+` never matches — and every mutation read as
 * "the runner printed neither a passed nor a failed count". That is the recorded
 * S01 defect one level down: **an instrument that measured less than the sentence
 * beside it**, and it would have been easy to read as "these assertions are
 * unfalsifiable" rather than "this pattern cannot see the output".
 *
 * The lesson is recorded next to the function rather than in the tally, because the
 * tally would have shown 8/12 failures and the reader would have drawn the wrong
 * conclusion from a number that looked like evidence.
 */
// The escape character is the SUBJECT of this function, not a mistake in it.
// `no-control-regex` exists to catch an accidental literal inside a pattern; here the
// literal is what is being matched on purpose. Suppressing it any other way -- by
// filtering output line-by-line, or by reading counts with a looser pattern -- is how
// the eight `harness-error` outcomes this function exists to prevent came about.
// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g;
const stripAnsi = (s) => s.replace(ANSI, "");

/** Run a command, returning combined output and the exit code. Never throws. */
function run(command, args, cwd = ROOT) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "" },
  });
  return {
    code: result.status,
    out: stripAnsi(`${result.stdout ?? ""}\n${result.stderr ?? ""}`),
    spawnError: result.error ? String(result.error) : null,
  };
}

/**
 * Vitest: read the `Tests` line, never `/(\d+)\s+passed/` which matches the file count.
 *
 * **Not anchored to the line start**, and that is deliberate: after stripping ANSI the
 * summary line still begins with whitespace and the two summaries sit adjacent, so the
 * discriminator is the `Tests` / `Test Files` label rather than position.
 */
function readVitestCounts(out) {
  const tests = out.match(/\bTests\s+(?:(\d+)\s+failed\s*\|?\s*)?(\d+)\s+passed/);
  const files = out.match(/\bTest Files\s+(?:(\d+)\s+failed\s*\|?\s*)?(\d+)\s+passed/);
  const passed = tests ? Number(tests[2]) : null;
  const failed = tests && tests[1] !== undefined ? Number(tests[1]) : 0;
  const fPassed = files ? Number(files[2]) : null;
  const fFailed = files && files[1] !== undefined ? Number(files[1]) : 0;
  if (passed === null && fPassed === null) return null;
  return { passed, failed, filesPassed: fPassed, filesFailed: fFailed };
}

/** Playwright: `N passed`, optionally with `M failed`. */
function readPlaywrightCounts(out) {
  const passed = out.match(/(\d+)\s+passed/);
  const failed = out.match(/(\d+)\s+failed/);
  const p = passed ? Number(passed[1]) : null;
  const f = failed ? Number(failed[1]) : 0;
  if (p === null) return null;
  return { passed: p, failed: f };
}

/**
 * Failing test **titles**.
 *
 * The whole line is captured on purpose: `/FAIL\s+(\S+)/` matches a file path and
 * nothing else, so an expectation naming a title could never match it — which is how
 * three M6 mutations were reported as caught by expectations that had only ever
 * matched because they named files.
 */
function failingLines(out) {
  const lines = [];
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(FAIL|✘|✗|×|·|×)/.test(line) || />\s+.*(Error|expected)/.test(line)) {
      if (line.length > 3 && !/^\s*$/.test(line)) lines.push(line);
    }
    if (/^\s*(FAIL|✘)\s/.test(line) || /\bFAIL\b/.test(line)) lines.push(line);
  }
  return [...new Set(lines)];
}

/** Every `›` / `>` delimited title Playwright prints for a failure. */
function playwrightFailingTitles(out) {
  const titles = new Set();
  for (const m of out.matchAll(/^\s*\d+\)\s+(.+)$/gm)) titles.add(m[1].trim());
  for (const m of out.matchAll(/^\s*(?:FAIL|✘)\s+\S+\s*[›>]\s*(.+)$/gm)) titles.add(m[1].trim());
  return [...titles];
}

const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Files the mutation touches, and whether they are *built* (so `dist` must be rebuilt). */
const BUILT_PREFIXES = [
  "apps/extension/src/",
  "apps/extension/static/",
  "apps/extension/popup.html",
  "apps/web/src/",
];

/**
 * Mutations.
 *
 * `find` is an exact-string anchor; `replace` may be a string or an array of lines.
 * `marker` must appear in the file after the edit, or the run is skipped as `noop`.
 */
const MUTATIONS = [
  {
    id: "S01",
    tier: "extension-browser",
    claim: "The built manifest declares host permissions in the wildcard path form.",
    intended:
      "manifest.spec.ts > declares every host permission in the wildcard path form",
    file: "apps/extension/static/manifest.json",
    find: '"https://api.mail.tm/*"',
    replace: '"https://api.mail.tm"',
    marker: '"https://api.mail.tm"',
  },
  {
    id: "S02",
    tier: "extension-browser",
    claim: "The manifest requests no permission no shipped surface uses.",
    intended: "manifest.spec.ts > requests no permission no shipped surface uses",
    file: "apps/extension/static/manifest.json",
    find: '"permissions": ["storage"]',
    replace: '"permissions": ["storage", "alarms"]',
    marker: '"alarms"',
  },
  {
    id: "S03",
    tier: "extension-browser",
    claim: "The manifest declares no content script and no side panel.",
    intended: "manifest.spec.ts > declares no content script and no side panel",
    file: "apps/extension/static/manifest.json",
    find: '"action": {',
    replace:
      '"content_scripts": [{ "matches": ["https://api.mail.tm/*"], "js": ["injected.js"] }],\n  "action": {',
    marker: "content_scripts",
    /**
     * **The first version of this mutant named `probe.js`, and it was a broken mutant.**
     *
     * Chromium refuses to load an extension whose declared content script file does not
     * exist, so `manifest.spec.ts`'s `beforeAll` threw and every test in the file failed —
     * including the one this mutation was aimed at, which was therefore never reached.
     * That filed a `wrongcatch` whose real content was "the mutant broke the product".
     *
     * The recorded rule is *a survivor means the assertion did not catch this, never that
     * the assertion is too weak, until the mutant has been read* — and it applies
     * symmetrically to a wrong-catch. So the mutant is repaired so that the extension
     * still loads and the intended assertion is the only thing left to fail.
     */
    plantFiles: [{ path: "apps/extension/static/injected.js", content: "// mutant\n" }],
  },
  {
    id: "S04",
    tier: "extension-browser",
    claim: "The popup names the provider it will reach and offers no control over it.",
    intended: "popup.spec.ts > names the provider it will reach and offers no way to change it",
    file: "apps/extension/src/Popup.tsx",
    find: "{COPY.reaching.replace(\"{provider}\", primaryProviderName)}",
    replace: "{COPY.reaching.replace(\"{provider}\", \"Some Other Provider\")}",
    marker: "Some Other Provider",
  },
  {
    id: "S05",
    tier: "extension-browser",
    claim: "The inbox count comes from a check the user asked for, and only then.",
    intended: "popup.spec.ts > answers a user-asked inbox check, and only when asked",
    file: "apps/extension/src/Popup.tsx",
    // **A `setInterval`, not an `onMouseEnter`.** The spec waits 1 500ms with the popup
    // open and asserts no provider request appeared. An `onMouseEnter` mutation would
    // not fire in a headless run with no pointer movement, so it would be a mutation
    // that cannot fail for the reason it exists — the recorded "a control that does
    // nothing" defect. A timer at 1 000ms is inside the spec's own wait window.
    find: 'onClick={() => void session.checkInbox()}',
    replace:
      'onClick={() => void session.checkInbox()}\n      {...({ ref: () => setInterval(() => void session.checkInbox(), 1_000) } as object)}',
    marker: "setInterval",
  },
  {
    id: "S06",
    tier: "extension-browser",
    claim:
      "The popup's stylesheet names no colour, radius, spacing step, type size or duration literally.",
    intended:
      "popup.spec.ts > names no colour, radius, spacing step, type size or duration literally",
    file: "apps/extension/src/styles.css",
    find: ".popup h2 {",
    // border-radius, not outline-offset -- and the first choice was informative.
    // The first mutant added an `outline-offset: 7px` and came back GREEN. The tempting
    // conclusion is that the sweep is too weak. It is not: the sweep tests five NAMED
    // categories, and outline-offset is a length in none of them, so the mutant
    // introduced a literal outside the rule's stated scope. That is M7 slice 3's recorded
    // S03 lesson in a new shape -- three survivors were broken mutants, and one had been
    // read as a coverage gap. A green run is evidence only after the mutant is read.
    replace: ".popup h2 {\n  border-radius: 3px;",
    marker: "border-radius: 3px;",
  },
  {
    id: "S07",
    tier: "unit",
    claim: "The background service worker schedules no repeated provider request.",
    intended: "service-worker.test.ts > schedules no repeated provider request and creates no alarm",
    file: "apps/extension/src/service-worker.ts",
    find: 'self.addEventListener("activate", () => {',
    replace:
      'self.addEventListener("activate", () => {\n  setInterval(() => void probePoll(), 5_000);',
    marker: "setInterval",
  },
  {
    id: "S08",
    tier: "unit",
    claim: "The background service worker creates no alarm.",
    intended: "service-worker.test.ts > schedules no repeated provider request and creates no alarm",
    file: "apps/extension/src/service-worker.ts",
    find: 'self.addEventListener("install", () => {',
    replace:
      'self.addEventListener("install", () => {\n  chrome.alarms.create("probe", { periodInMinutes: 0.0833 });',
    marker: "chrome.alarms.create",
  },
  {
    id: "S09",
    tier: "unit",
    claim: "`clearAll` removes the whole area, including a key this build does not recognise.",
    intended: "chrome.test.ts > removes the whole area, including a key this build does not recognise",
    file: "packages/storage/src/chrome.ts",
    find: "    async clearAll() {\n      await area.clear();\n    },",
    replace:
      "    async clearAll() {\n      // **MUTATION S09: remove the one key this build knows about.**\n" +
      "      await area.remove(EXTENSION_MAILBOX_KEY);\n    },",
    marker: "MUTATION S09",
  },
  {
    id: "S10",
    tier: "unit",
    claim: "A read failure is a rejection, never an absence.",
    intended: "chrome.test.ts > reports nothing stored as null, and a read failure as a rejection",
    file: "packages/storage/src/chrome.ts",
    find: "    const stored = await area.get(EXTENSION_MAILBOX_KEY);",
    replace:
      "    // **MUTATION S10: a failed read is reported as nothing stored.**\n" +
      "    let stored: unknown;\n" +
      "    try {\n" +
      "      stored = await area.get(EXTENSION_MAILBOX_KEY);\n" +
      "    } catch {\n" +
      "      return undefined;\n" +
      "    }",
    marker: "MUTATION S10",
  },
  {
    id: "S11",
    tier: "unit",
    claim: "The announced provider name is read from the manager, not written out.",
    intended:
      "boundaries.test.ts > stops a client restating a value a shared package already owns",
    file: "apps/extension/src/provider-config.ts",
    find: "  return first.displayName;",
    replace: '  return "Mail.tm";',
    marker: 'return "Mail.tm"',
  },
  {
    id: "S12",
    tier: "extension-browser",
    claim: "A mailbox is reported under the provider that actually served it, not the preferred one.",
    intended:
      "popup.spec.ts > falls back to Guerrilla Mail and names it, not the provider it preferred",
    // **On `Popup.tsx`, not on the spec.** Mutating the spec would prove the spec can
    // fail, which is not the claim; the claim is that the *product* names the provider
    // that served the mailbox, so the defect goes into the component — and specifically
    // into the heading that reports `mailbox.provider`, which is the value the spec
    // reads. Replacing it with the *preferred* provider's name is the exact mistake the
    // requirement exists to forbid: a popup claiming the user's mail lives at a provider
    // that never answered.
    file: "apps/extension/src/Popup.tsx",
    find: '<h2 id="address-heading">{mailbox.provider}</h2>',
    replace: '<h2 id="address-heading">{primaryProviderName}</h2>',
    marker: '<h2 id="address-heading">{primaryProviderName}</h2>',
  },
  {
    id: "S13",
    tier: "unit",
    claim: "A save resolves only after the platform has accepted the write.",
    intended: "chrome.test.ts > resolves a save only after the platform accepted the write",
    // **Re-targeted from the first attempt, and the reason is the finding.**
    //
    // The first S13 wrapped `loadMailbox` in a try/catch that turned any failure into
    // `null`, aimed at "surfaces neither a wrong-version record nor a corrupt one". It was
    // caught -- by a *different* test ("reports nothing stored as null, and a read failure
    // as a rejection"), which makes it a `wrongcatch` rather than a catch by the intended
    // assertion.
    //
    // **Reading it says the mutant was not the defect it was aiming at.** The failing
    // test's fixture is an `area.get` that rejects, so a catch around the *whole* load is
    // exactly that test's defect, and the narrower requirement was merely covered
    // incidentally. So this mutant is replaced by one that touches only the write path.
    file: "packages/storage/src/chrome.ts",
    find: "      await area.set({ [EXTENSION_MAILBOX_KEY]: record });",
    replace:
      "      // **MUTATION S13: the save is reported before the platform accepted it.**\n" +
      "      void area.set({ [EXTENSION_MAILBOX_KEY]: record });",
    marker: "MUTATION S13",
  },
  {
    id: "S14",
    tier: "unit",
    claim: "The live host-permission check is run by no script and no suite.",
    intended: "boundaries.test.ts > runs the live host-permission check nowhere, deliberately",
    file: "package.json",
    find: '"spike:selftest": "pnpm --dir tests/provider-spike spike:selftest",',
    replace:
      '"spike:selftest": "pnpm --dir tests/provider-spike spike:selftest",\n    "test:live-permission": "node apps/extension/e2e/live-host-permission.mjs",',
    marker: "test:live-permission",
  },
  {
    id: "S15",
    tier: "unit",
    claim: "Every shipped browser spec is collected by exactly one browser suite.",
    intended: "boundaries.test.ts > collects",
    // **Widening the website suite's `testDir` is the right mutant here, and the reason
    // matters.** The rule this change extended exists because a spec no runner collects
    // reads as coverage while verifying nothing -- and the extension's specs are the ones
    // that could newly fall into that hole. Making the website's suite reach
    // `apps/extension/e2e` too produces the inverse defect: **two suites collecting one
    // spec**, which is what the rule's "and by nothing else" half names.
    file: "apps/web/playwright.config.ts",
    find: '  testDir: "./e2e",',
    replace: '  testDir: ["../extension/e2e", "./e2e"],',
    marker: "../extension/e2e",
  },
  {
    id: "S16",
    tier: "unit",
    claim: "A client that reaches chrome.storage in code is reported by name.",
    intended:
      "boundaries.test.ts > catches a platform store or the URL in a client, in every spelling but the clipboard",
    // **The member removed, not the whole rule.** Narrowing the scan loop or the package
    // list is the recorded M6 slice 1 mistake -- every package it stopped scanning
    // happened to be clean, so the suite stayed green. Removing one member is the exact
    // one-line change this widening must make load-bearing, and it is the change the
    // rule's own new control fails on.
    file: "tests/architecture/boundaries.test.ts",
    find: "|caches|chrome\\s*\\.\\s*storage\\b)(?![\\w$-])",
    replace: "|caches)(?![\\w$-])",
    marker: "|caches)(?![\\w$-])",
  },
  {
    id: "S17",
    tier: "unit",
    claim: "No client file names an internal storage API in user-facing copy.",
    intended:
      "boundaries.test.ts > keeps storage, cookies, and the URL out of every client",
    // **The copy defect the widening actually found**, restored verbatim. This is the
    // mutation that proves the rule fires on a *string literal* rather than only on a
    // declaration -- which is the claim separating this repair from the
    // reword-the-prose-until-the-rule-goes-quiet failure this file records three times.
    file: "apps/extension/src/storage.ts",
    find: '"This browser will not let SpectreMail store anything here, so nothing can be " +',
    replace:
      '"This extension context provides no chrome.storage, so SpectreMail cannot store " +\n        "anything here. " +',
    marker: "provides no chrome.storage",
  },
];

/** Where each tier runs and how it is read. */
const TIERS = {
  unit: {
    run: () => run(join("node_modules", "vitest", "vitest.mjs"), ["run"]),
    counts: readVitestCounts,
    titles: failingLines,
  },
  "extension-browser": {
    build: () => {
      const web = run(join("node_modules", "vite", "bin", "vite.js"), ["build"], join(ROOT, "apps", "web"));
      if (web.code !== 0) return { ok: false, out: web.out };
      const ext = run(join("node_modules", "vite", "bin", "vite.js"), ["build"], join(ROOT, "apps", "extension"));
      return { ok: ext.code === 0, out: web.out + ext.out };
    },
    run: () =>
      run(join("node_modules", "@playwright", "test", "cli.js"), ["test"], join(ROOT, "apps", "extension")),
    counts: readPlaywrightCounts,
    titles: playwrightFailingTitles,
  },
  "web-browser": {
    build: () => {
      const web = run(join("node_modules", "vite", "bin", "vite.js"), ["build"], join(ROOT, "apps", "web"));
      return { ok: web.code === 0, out: web.out };
    },
    run: () =>
      run(join("node_modules", "@playwright", "test", "cli.js"), ["test"], join(ROOT, "apps", "web")),
    counts: readPlaywrightCounts,
    titles: playwrightFailingTitles,
  },
};

const wanted = process.argv.slice(2);
const selected = wanted.length
  ? MUTATIONS.filter((m) => wanted.includes(m.id))
  : MUTATIONS;

if (selected.length === 0) {
  console.error(`no mutation matched ${wanted.join(", ")}`);
  process.exit(1);
}

const results = [];

for (const mutation of selected) {
  const tier = TIERS[mutation.tier];
  const path = join(ROOT, mutation.file);
  const before = sha(path);
  const original = readFileSync(path, "utf8");
  const find = mutation.find;
  if (!original.includes(find)) {
    results.push({ ...mutation, outcome: "noop", detail: "anchor not present in the file" });
    console.log(`${mutation.id}  NOOP  anchor absent: ${mutation.file}`);
    continue;
  }
  writeFileSync(path, original.replace(find, mutation.replace), "utf8");

  // **Extra files a mutant needs in order to be a *valid* mutant.**
  //
  // A mutant that cannot load is not a weak assertion; it is a broken product, and every
  // test then fails for a reason unrelated to the claim. `plantFiles` exists so such a
  // mutant can be repaired rather than filed -- the recorded rule cuts both ways: *a
  // survivor means the assertion did not catch this, never that the assertion is too
  // weak, until the mutant has been read*, and the mirror image is that a wrongcatch does
  // not mean the assertion is misattributed until the mutant has been read either.
  const planted = [];
  for (const plant of mutation.plantFiles ?? []) {
    const plantPath = join(ROOT, plant.path);
    writeFileSync(plantPath, plant.content, "utf8");
    planted.push(plantPath);
  }

  // **A missing edit site is `noop` and skips the run** — the recorded S01 defect.
  const landed = readFileSync(path, "utf8");
  const landedOk =
    landed.includes(mutation.marker) && landed !== original && sha(path) !== before;
  if (!landedOk) {
    rmSync(join(ROOT, "node_modules", ".m8-backup"), { force: true });
    writeFileSync(path, original, "utf8");
    results.push({ ...mutation, outcome: "noop", detail: "edit did not land" });
    console.log(`${mutation.id}  NOOP  edit did not land`);
    continue;
  }

  let outcome;
  let detail = "";

  // **No build, no run, and the outcome is `nocompile`.** The browser must never be
  // served the previous `dist` while the tally claims the mutation survived.
  if (tier.build && BUILT_PREFIXES.some((p) => mutation.file.startsWith(p))) {
    const built = tier.build();
    if (!built.ok) {
      writeFileSync(path, original, "utf8");
      results.push({ ...mutation, outcome: "nocompile", detail: "build failed; no run" });
      console.log(`${mutation.id}  NOCOMPILE  build failed; the mutation never reached the runner`);
      continue;
    }
  }

  const run1 = tier.run();
  if (run1.spawnError) {
    outcome = "harness-error";
    detail = run1.spawnError;
  } else {
    const counts = tier.counts(run1.out);
    if (counts === null) {
      outcome = "harness-error";
      detail = "no summary line: the runner printed neither a passed nor a failed count";
    } else if (counts.failed === 0) {
      outcome = "green";
      detail = `${String(counts.passed)} passed, 0 failed`;
    } else {
      const titles = tier.titles(run1.out);
      const needle = mutation.intended.split(" > ")[1].toLowerCase();
      const hit = titles.some((t) => t.toLowerCase().includes(needle));
      outcome = hit ? "caught" : "wrongcatch";
      // **Every failing title is written into the record, not a truncated sample.** An
      // attribution a reader has to trust is an attribution that will eventually be wrong
      // (M6 slice 4), and the full list is what makes a `wrongcatch` readable rather than
      // merely counted.
      detail = hit
        ? `caught by "${mutation.intended}"`
        : `failed, but not by the intended test.\n           intended: ${mutation.intended}\n           failing:  ${titles.length === 0 ? "(no title captured)" : titles.join("\n                     ")}`;
    }
  }

  // Restore, and verify by SHA rather than by copying back and hoping.
  writeFileSync(path, original, "utf8");
  for (const plantPath of planted) rmSync(plantPath, { force: true });
  const restored = sha(path) === before;
  results.push({ ...mutation, outcome, detail, restored });
  console.log(
    `${mutation.id}  ${outcome.toUpperCase().padEnd(12)} ${restored ? "restored" : "RESTORE FAILED"}  ${detail}`,
  );
}

/**
 * **Rebuild from restored source.** The build artefact outlives the run: without this
 * the next reader gets a red suite against a defect nobody wrote, with a clean tree.
 */
let rebuildOk = true;
for (const tierName of new Set(selected.map((m) => m.tier))) {
  const tier = TIERS[tierName];
  if (!tier.build) continue;
  const built = tier.build();
  if (!built.ok) rebuildOk = false;
}

const tally = {};
for (const r of results) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;
const unrestored = results.filter((r) => r.restored === false);

console.log("\n--- tally ---");
for (const [k, v] of Object.entries(tally).sort()) console.log(`${String(v).padStart(3)}  ${k}`);
console.log(`${String(results.length).padStart(3)}  total`);
console.log(`rebuild from restored source: ${rebuildOk ? "ok" : "FAILED"}`);
if (unrestored.length) console.log(`UNRESTORED: ${unrestored.map((r) => r.id).join(", ")}`);

void readdirSync;