/**
 * What can a side-panel-hosted document see, what does it cost, and can Playwright observe one?
 *
 * ## What requirement this discharges
 *
 * None, and that is the point. `side-panel-runtime-facts` is a **measurement spike**: it adds an
 * instrument and records what it observed, and `docs/PROVIDERS.md` §4.6 is written from the run
 * below rather than from a reading of Chrome's documentation. The two promoted requirements this
 * bears on — `extension-client`'s non-goals list and `in-page-integration`'s *"a code reaches the
 * page without a permission this extension does not already hold"* — stay true and unchanged; M11
 * slice 1 is the first change that amends one, and it will point here for the numbers.
 *
 * ## How to run it
 *
 *     node apps/extension/e2e/side-panel-runtime.mjs
 *
 * Exits `0` only when **every arm produced an observation**, and `1` otherwise. **"Measured nothing"
 * is the second**, copied from `notification-display.mjs`'s header for the reason given there: a run
 * whose arms all came back empty is indistinguishable from a probe that never loaded. **"Unmeasurable
 * on this Chromium" is reported as a third, distinct outcome** — not an error, not a pass — because a
 * headless Chromium with no panel UI refusing to dock a panel is a *result about the substrate* and
 * the same shape of result `notification-display.mjs` produced about a notification centre it could
 * not see.
 *
 * ## The arms
 *
 * | #  | arm                | question                                                    |
 * | -- | ------------------ | ----------------------------------------------------------- |
 * | 1  | the two-by-two     | what does each of four cells see, and does either entry alone make the API? |
 * | 2  | open outcome       | what did `open()` itself say?                                |
 * | 3  | panel report       | did the panel's document run, and what could it see?           |
 * | 4  | route (b)          | is `tab.url` readable without `tabs`, and with it?            |
 * | 5  | `sendMessage`      | can the panel reach the page beside it, and a page without one? |
 * | 6  | tab switch         | does the panel follow a tab switch, and on its own or asked?   |
 * | 7  | provider reach     | can an extension-hosted page fetch a provider origin?         |
 * | 8  | Playwright         | what does Playwright see of a docked panel — and the substitute? |
 *
 * **The control is what makes arms 2 to 8 mean anything.** If `chrome.sidePanel` is absent in the
 * control *and* in the base, then "the manifest made it exist" is false and every later arm is about
 * an API that is not there — which is the alarms probe's recorded lesson about a control that shares
 * the resource under measurement.
 *
 * ## Arm 1 is a two-by-two, and it was two cells for four
 *
 * Until `extension-permissions-review` added them, `VARIANTS` held one cell for each *corner of the
 * same question*: `control` declared neither the `sidePanel` permission nor a `side_panel` key, and
 * `base` declared both. The two cells in between — permission without the key, and key without the
 * permission — were never run, and `docs/PROVIDERS.md` §4.6 recorded the consequence as *"the
 * permission is one of the two and cannot be separated from them on this substrate"*. **That
 * sentence described the fixture.** `permission-only` and `key-only` are the two missing cells and
 * each differs from `base` in **one** entry; `control` still differs in **two** and is the
 * two-by-two's baseline rather than a controlled comparison against it, which is what the printed
 * table says beside it.
 *
 * **`key-only` is the cell the extension's manifest entry turns on**, and it is also the cell whose
 * fixture is most likely to be refused outright — a manifest naming `side_panel` with no permission
 * granting it is precisely the combination nobody had run. So a cell that fails to launch is recorded
 * as a row with **no reading**, and `readCell` counts it as not observed: **"did not report" is not
 * "the API was absent"**, and the verdict refuses to produce a finding through either a missing row
 * or a failing arm.
 *
 * ## Why the panel is measured by what it writes
 *
 * `design.md` D1. **Playwright adds no `Page` for a docked panel** — measured for the popup during
 * `in-page-fill` and unmeasured for the panel until now — so the panel cannot be looked at. The
 * panel writes into `chrome.storage.local` and the worker reads it back with `worker.evaluate(...)`,
 * the same handle `helpers/background-state.ts` already uses.
 *
 * **Arms 2 and 3 are D4's two observations and are never collapsed.** `open()` resolving says the
 * platform accepted a request; the panel's report says a document executed. A run holding only the
 * first would report a fact about a surface nothing had observed — the same gap as a resolved
 * callback being read as a displayed notification.
 *
 * ## Why it spells the two load flags instead of importing them
 *
 * `extensionFlags()` lives in `playwright.config.ts` and a plain `.mjs` script cannot import a
 * TypeScript module. Both existing probes spell them for the same reason, and a boundary rule checks
 * that every probe's spelled flags agree with `extensionFlags()` — so the duplication is falsifiable
 * rather than merely duplicated.
 *
 * ## Why it stages each variant under `test-results/`
 *
 * The fixtures are committed as **one base manifest and two fragments**, materialised per arm by a
 * shallow top-level merge (`design.md` D2). **The staged directories are what Chromium loads, and
 * they are written under `test-results/`** so a generated copy cannot go stale in the source tree and
 * be read as evidence about a later run — the failure `archive-bytes.mjs` recorded. **`test-results/`
 * is churned by this measurement**, so any later source fingerprint must exclude it by name.
 *
 * ## What this cannot establish, stated in the output as well as here
 *
 * It cannot observe a docked panel's pixels, its width, or whether a person saw one. It cannot
 * observe a headed desktop's panel UI, a Firefox or WebKit panel, or a packed extension. Arm 7
 * establishes **reachability of an origin**, not that a provider would serve a real request — the
 * body is never read.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

/** The Playwright version, read rather than written down. */
const PLAYWRIGHT_VERSION = createRequire(import.meta.url)("@playwright/test/package.json").version;

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/side-panel-probe", import.meta.url));
const RESULTS_DIR = fileURLToPath(new URL("../test-results", import.meta.url));

/** Where the worker publishes its probe surface. Must match `probe.js`. */
const PROBE_KEY = "__spectreSidePanelProbe";

/** The variants, and what each one exists to price. `base` is the control for `control`. */
const VARIANTS = ["control", "base", "permission-only", "key-only", "tabs"];

/**
 * The two-by-two, and which variant is which cell.
 *
 * **Four cells and one extra variant.** `tabs` is not a cell of this two-by-two — it varies a third
 * manifest entry and is priced by §4.6's route (b) — so the cell table is spelled out rather than
 * derived from `VARIANTS`, and the one spelling of "which variant is which cell" lives here instead
 * of in a reader four times.
 *
 * **The cell names name both axes, and the order is the order a reader reads the two-by-two in.**
 * `no-permission__with-key` is the cell `docs/PROVIDERS.md` §4.6 could not answer: the key alone,
 * with nothing granting it.
 */
const CELLS = {
  "no-permission__no-key": "control",
  "no-permission__with-key": "key-only",
  "with-permission__no-key": "permission-only",
  "with-permission__with-key": "base",
};

/**
 * One cell's reading, and whether it read at all.
 *
 * **A cell that reported nothing is `observed: false` and its `api` is `null` — never `false`.**
 * §4.6 records a verdict that "survived a total measurement failure", and this function is the
 * repair in the direction the two new cells make necessary: they are API-presence cells, which is
 * the stage that carries the defect, so a cell whose worker never started must not be readable as
 * a cell that saw the API absent. **The two are the same shape of output to a reader and opposite
 * facts**, and `observed` is what tells them apart.
 */
function readCell(rows, variant) {
  const row = rows.find((candidate) => candidate.variant === variant);
  const value = row?.api?.hasSidePanelApi;
  const observed = typeof value === "boolean";

  return {
    variant,
    observed,
    api: value === undefined ? null : value,
    permissions: row?.api?.declaredPermissions ?? null,
    key: row?.api?.declaredSidePanelKey ?? null,
    failure: row?.failure ?? null,
  };
}

/** Every cell's reading, in the order `CELLS` declares them. */
function readCells(rows) {
  return Object.entries(CELLS).map(([cell, variant]) => ({ cell, ...readCell(rows, variant) }));
}

/**
 * One cell's API reading, or `false` when that cell reported nothing.
 *
 * **`false` for an unreported cell is the right answer here even though `readCell` refuses it**, and
 * the two are consistent: `decide()` has already returned `answerable: false` on any unreported
 * cell before either caller runs, so this function is only ever asked about four observed cells. The
 * `&&` in each caller is belt and braces rather than the mechanism - the mechanism is that an
 * unreported cell cannot reach a verdict at all.
 */
function cellApi(cells, name) {
  return cells.find((cell) => cell.cell === name)?.api === true;
}

/**
 * Print the two-by-two as a table, with every cell's own observation beside it.
 *
 * **The table is printed whether or not the run is answerable, and a cell that did not report says
 * so in its own column** rather than leaving a gap a reader fills with whatever the run concluded.
 * The old table in §4.6 is a single yes/no row, and it is what four documents carried forward as
 * though it described the platform; a table whose empty cell reads as an answer is that defect
 * again.
 */
function printCells(cells) {
  say(`\n[2x2] the side_panel key against the sidePanel permission`);

  const rows = [
    ["", "declared permissions", "side_panel key", "chrome.sidePanel"],
    ...cells.map((c) => [
      `cell ${c.cell}`,
      c.observed ? JSON.stringify(c.permissions) : "NOT OBSERVED",
      // **The key column says `present` or `absent`, never the key's own value.** The probe reports the
      // key as Chromium's own `side_panel` object, so `JSON.stringify` of it printed
      // `[object Object]` in the cell that matters most - the one cell whose whole question is whether
      // the key is there. A column that prints `[object Object]` beside a column that prints `present`
      // reads as a rendering fault, and a reader who works that out has spent attention on the answer.
      c.observed ? (c.key === null ? "absent" : "present") : "NOT OBSERVED",
      c.observed ? (c.api ? "present" : "undefined") : "NOT OBSERVED",
    ]),
  ];

  const widths = [0, 1, 2, 3].map((column) => Math.max(...rows.map((row) => row[column].length)));
  for (const [index, row] of rows.entries()) {
    say(`    ${row.map((cell, column) => cell.padEnd(widths[column])).join("  ")}`);
    if (index === 0) say(`    ${widths.map((width) => "-".repeat(width)).join("  ")}`);
  }

  for (const c of cells.filter((cell) => !cell.observed)) {
    say(`    cell ${c.cell} reported nothing, so it is NOT OBSERVED rather than "undefined"`);
    if (c.failure) say(`      ${c.failure}`);
  }
}

class HarnessError extends Error {}

const openContexts = new Set();
const workers = new Map();

async function closeAllContexts() {
  for (const context of openContexts) {
    await context.close().catch(() => {});
  }
  openContexts.clear();
  workers.clear();
}

function say(line = "") {
  process.stdout.write(`${line}\n`);
}

/**
 * Format a duration, and refuse anything that is not one.
 *
 * **The refusal is the point**, and it is `notification-display.mjs`'s helper unchanged: that file
 * printed `undefined ms` for three arms once, because `String(undefined).padStart(6, " ")` produces
 * a well-aligned column containing nothing. A formatter that renders absence in the shape of
 * presence is a formatter that hides absence.
 */
function ms(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HarnessError(`A duration was not a number: ${String(value)}.`);
  }
  return `${String(Math.round(value)).padStart(6, "0")} ms`;
}

/** Both load flags, spelled. See the header for why. */
function probeFlags(resolvedDir) {
  return [`--load-extension=${resolvedDir}`, `--disable-extensions-except=${resolvedDir}`];
}

/**
 * Materialise one variant over the base manifest.
 *
 * **Two rules, and the first exists because the check that verifies these fragments failed on its
 * first run** (`design.md` D2): a key whose value is `null` **deletes** it, because a shallow merge
 * cannot remove what the base already declared and a control that still declared `side_panel` would
 * not have been a control; and a key beginning with `_` is an annotation that never reaches the
 * manifest.
 *
 * **`permissions` is replaced wholesale and never unioned**, so a fragment cannot accumulate an entry
 * the base did not have — the arms are priced by what each one *does not* declare as much as by what
 * it does.
 */
function materialiseManifest(variant) {
  const base = JSON.parse(readFileSync(`${FIXTURE_DIR}\\manifest.json`, "utf8"));

  // **`base` is the identity, not a fragment.** It appears in `VARIANTS` because the control has to
  // be compared against something, and reading a `variants/base.json` that does not exist turned the
  // base arm into a crash rather than into a reading — which is the shape of run this repository has
  // recorded as "a failure that looks like a platform finding". **The first version of this run died
  // exactly there**, one arm after having already answered the control arm.
  if (variant === "base") return base;

  const fragment = JSON.parse(readFileSync(`${FIXTURE_DIR}\\variants\\${variant}.json`, "utf8"));
  const merged = { ...base };

  for (const [key, value] of Object.entries(fragment)) {
    if (key.startsWith("_")) continue;
    if (value === null) delete merged[key];
    else merged[key] = value;
  }

  return merged;
}

/**
 * Stage one variant into a fresh directory and return its path.
 *
 * **`cpSync` for the documents and one written manifest**, so the committed `variants/` fragments are
 * not shipped inside the staged extension — Chromium loads a directory, and a staged tree carrying
 * a `variants/` folder would be a fixture nobody wrote.
 *
 * **The `documents/` subdirectory is copied as a tree rather than file by file.** The fixture splits
 * its three document scripts away from its service worker so `eslint.config.js` can declare each
 * context exactly — see that config's comment on why the union was not the answer — and copying the
 * six names individually would have had to learn that split twice, in a list that exists to catch
 * strays.
 */
function stageVariant(variant, label) {
  const staged = `${RESULTS_DIR}\\side-panel-probe-${variant}-${label}`;
  rmSync(staged, { recursive: true, force: true });
  mkdirSync(staged, { recursive: true });

  cpSync(`${FIXTURE_DIR}\\probe.js`, `${staged}\\probe.js`);
  cpSync(`${FIXTURE_DIR}\\documents`, `${staged}\\documents`, { recursive: true });
  writeFileSync(
    `${staged}\\manifest.json`,
    `${JSON.stringify(materialiseManifest(variant), null, 2)}\n`,
  );

  return staged;
}

/** The fixture page carrying the content script, and the origin it is served from. */
const CONTENT_PAGE_ORIGIN = "https://side-panel-fixture.invalid";

/**
 * Turn the arms into an answer, **or say that the question cannot be answered**.
 *
 * **The verdict is deliberately conservative**, for `notification-display.mjs`'s recorded reason: it
 * reports `answerable: false` unless the control saw the API **absent** and the base saw it
 * **present**. Without that pair, *"declaring the surface changes nothing"* is not a finding about
 * declarations — it is a finding about a run where nothing worked, and the two are identical in a
 * table.
 *
 * **The two refusals print different reasons**, because they are different failures: a control that
 * still sees the API means the measurement cannot price the declaration, while a base that never saw
 * it means there is nothing to price.
 *
 * **A third refusal was added because falsification arm F4 found the verdict reporting
 * `answerable: true` through a run in which every panel arm failed.** The two refusals above are both
 * read from the API-presence stage, which is a *different fixture load* from the arms — so an arms
 * stage that ran against a fixture without the API could fail completely while the verdict, reading
 * the other stage, stayed positive. **A verdict that survives a total measurement failure is
 * decoration.** The arms are therefore passed in and their observations counted here, rather than the
 * verdict being computed from the arms' absence and printed beside it.
 */
function decide(apiRows, cells, panelRun, observations) {
  const byVariant = Object.fromEntries(apiRows.map((row) => [row.variant, row]));
  const controlAbsent = byVariant.control?.api?.hasSidePanelApi === false;
  const basePresent = byVariant.base?.api?.hasSidePanelApi === true;

  // **The not-observed check comes FIRST, and it is this change's own addition.**
  //
  // The two refusals below each describe what a cell *saw*, so running them against a cell that
  // saw nothing produces a sentence about a measurement nobody took — the control arm reading
  // "still saw chrome.sidePanel" when the control's worker never started is a claim, not a
  // refusal. §4.6 records a verdict that survived a total measurement failure, and a refusal
  // that misreports *why* the run is inconclusive is the same defect wearing a smaller number.
  //
  // **Every cell that failed to report therefore names itself here**, and `observedCount < total`
  // in `main()` exits the run non-zero on the same fact — so a cell that reported nothing cannot
  // produce a verdict in either place.
  const missed = (observations ?? []).filter((o) => !o.observed).map((o) => o.arm);
  if (missed.length > 0) {
    return {
      answerable: false,
      reason:
        `${missed.length} arm(s) measured nothing, so no finding below would be attributable: ` +
        missed.join(", "),
    };
  }

  if (!basePresent) {
    return {
      answerable: false,
      reason:
        "the base fixture never saw chrome.sidePanel, so every later arm is about an API that is not there",
    };
  }
  if (!controlAbsent) {
    return {
      answerable: false,
      reason:
        "the control arm still saw chrome.sidePanel, so declaring the surface is not what makes the API exist and nothing below is attributable to it",
    };
  }
  if (!panelRun.answerable) {
    return { answerable: false, reason: panelRun.reason ?? "the panel arms did not run" };
  }

  return {
    answerable: true,
    // **The cell-derived answers, read from the four cells rather than re-derived from the fixture
    // materialiser.** Both of these are the question the extension's manifest entry turns on, and
    // both are read off the run's own output so a verdict cannot disagree with the table above it.
    //
    // `keyAloneEarnsTheApi` is the one the M12 permissions review is waiting for: it says whether
    // `side_panel` alone makes `chrome.sidePanel` exist. It is stated **for this Chromium, on this
    // machine, with this fixture** and nothing else - one engine, and the manifest entries staged by
    // a shallow merge rather than hand-written, both of which §4.6 already carries.
    keyAloneEarnsTheApi:
      cells.every((c) => c.observed) && cellApi(cells, "no-permission__with-key"),
    permissionAloneEarnsTheApi:
      cells.every((c) => c.observed) && cellApi(cells, "with-permission__no-key"),
    // **These four are the findings, read back from the arms rather than restated from the source.**
    // A verdict that re-derives its own conclusion from the code that produced it is not a verdict,
    // it is a copy.
    panelOpened: panelRun.results.openOutcome?.opened === true,
    panelRan: Boolean(panelRun.results.panelReport),
    hostnameWithoutTabs:
      panelRun.results.panelReport?.observations?.activeTabHostname?.value ?? null,
    hostnameWithTabs: panelRun.results.hostnameWithTabs ?? null,
    followedSwitchOnItsOwn:
      (panelRun.results.switch.afterSwitch?.sequence ?? -1) > (panelRun.results.switch.before ?? 0),
    reachedPageWithContentScript: panelRun.results.messages.positive?.answer?.reached === true,
    reachedPageWithout: panelRun.results.messages.negative?.answer?.reached === true,
    providerFetchAllowed: panelRun.results.provider?.answer?.ok === true,
    playwrightSawAPage: (panelRun.results.playwright?.added ?? []).length > 0,
    // **Recorded beside the verdict because the two are independent.** A run where the panel reported
    // and Playwright still saw no Page is the ordinary result; a run where the panel reported nothing
    // AND Playwright saw no Page establishes far less, and a reader should not have to diff two
    // sections of the output to learn which of the two they are looking at.
    panelReported: panelRun.results.panelReport !== null,
  };
}

/**
 * The limits, in the words the run prints them.
 *
 * **Printed rather than left in the header**, because `docs/PROVIDERS.md` §4.6 has to carry the same
 * sentences and a limit that exists only in a comment is a limit a reader of the output never sees.
 * Every one of these is a fact about *this substrate*, not about the panel API.
 */
const LIMITS = [
  "a docked panel is not a rendered pixel: nothing here reads its appearance, width or drawing",
  "this Chromium is headless, so whether a person would see a docked panel here is unmeasured",
  "one engine on one machine; nothing here says anything about Firefox, WebKit or a packed extension",
  "arm 7 establishes that the request was ALLOWED and answered 200 - it does not establish that any",
  "  provider would serve a real mailbox request, and the response body is never read",
  "the arms are not independent: one fixture is loaded per stage, so a platform that remembered state",
  "  across loads would not be distinguishable from one that did not",
  "the two-by-two is four cells of ONE Chromium on one machine, and each cell's manifest is a shallow",
  "  merge over a fixture rather than a hand-written manifest - so it prices those two entries on this",
  "  fixture, and says nothing about another engine, another Chrome release, or a manifest authored",
  "  by hand. The `tabs` variant is NOT one of the four cells: it varies a third entry and is priced",
  "  by route (b) below.",
];

/**
 * Serve the fixture origin from memory, on a reserved `.invalid` host.
 *
 * **A reserved host is used so a stray request can never leave the machine**, and the document is
 * fulfilled by Playwright's own router rather than by a server, for the same reason
 * `in-page.spec.ts` does it — the route is what makes the page exist at all, and an arm that depended
 * on DNS resolving would measure the machine's network rather than the platform.
 *
 * **The route is scoped to this one origin**, so the provider-origin arm below is untouched by it: a
 * route matching `**` would have answered the question arm 7 is asking.
 */
async function serveFixtureOrigin(context) {
  await context.route(`${CONTENT_PAGE_ORIGIN}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body:
        "<!doctype html><html><head><title>side panel probe fixture</title></head>" +
        '<body><p id="fixture">fixture page</p></body></html>',
    }),
  );
}

/**
 * Launch one probe extension and confirm its worker published a surface.
 *
 * **The surface is never returned.** `worker.evaluate` serialises its result across the boundary, so
 * reading `self[KEY]` yields a plain snapshot and every function on it is `undefined` — which is what
 * the first version of `notification-display.mjs` did, and it failed with
 * `surface.selfReport is not a function` rather than with a platform finding. Every call therefore
 * names its method **inside** the page.
 */
async function launchWorker(dir, label) {
  const context = await chromium.launchPersistentContext(
    `${RESULTS_DIR}\\side-panel-profile-${label}`,
    {
      channel: "chromium",
      args: probeFlags(dir),
    },
  );
  openContexts.add(context);

  let worker = context.serviceWorkers()[0];
  if (!worker) {
    try {
      worker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    } catch (cause) {
      throw new HarnessError(
        `${label} registered no service worker: ${String(cause)}. Both flags and an absolute ` +
          `path are required - see extensionFlags() in playwright.config.ts.`,
      );
    }
  }

  // **The handle is checked by its own keys rather than by truthiness**, because a JSON snapshot of
  // a real surface would also be truthy — and the arms would then each fail individually, pointing
  // the reader at the platform instead of at this instrument.
  const methods = await worker.evaluate((property) => {
    const surface = self[property];
    return surface === undefined ? null : Object.keys(surface).sort();
  }, PROBE_KEY);

  if (methods === null) {
    throw new HarnessError(
      `${label} published no probe surface at self["${PROBE_KEY}"], so nothing can be asked of it. ` +
        `That is an instrument fault, not a platform finding.`,
    );
  }

  workers.set(label, worker);
  return { context, worker, methods };
}

function workerOf(label) {
  const found = workers.get(label);
  if (!found) throw new HarnessError(`No probe worker was recorded for "${label}".`);
  return found;
}

/**
 * Call one method on a published probe surface, from inside the page.
 *
 * **The key arrives as data**, because a per-arm spelled-out `self.__…` string would be the second
 * spelling of where a probe lives, and this repository's own record is that a second spelling drifts.
 */
async function callProbe(worker, method, argument) {
  const result = await worker.evaluate(
    async ([property, name, payload]) => {
      const surface = self[property];
      if (!surface || typeof surface[name] !== "function") {
        return { __missingMethod: name, __published: surface ? Object.keys(surface).sort() : null };
      }
      return surface[name](payload);
    },
    [PROBE_KEY, method, argument ?? null],
  );

  if (result !== null && typeof result === "object" && "__missingMethod" in result) {
    throw new HarnessError(
      `The probe surface published no method "${result.__missingMethod}" - it has ` +
        `${JSON.stringify(result.__published)}. That is an instrument fault, not a platform finding.`,
    );
  }
  return result;
}

/**
 * Read a value the worker published on its surface, rather than a method's return.
 *
 * **Used only for plain values**, for the reason `notification-display.mjs` reads its settle
 * constant this way: the number the run reports is the number the worker actually holds, rather than
 * a copy written down in the driver that could drift from it.
 */
function readConstant(worker, name) {
  return worker.evaluate(
    ([property, key]) => {
      const surface = self[property];
      return surface ? surface[key] : undefined;
    },
    [PROBE_KEY, name],
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait until the panel has published a report with a sequence above `since`.
 *
 * **Polled rather than slept for**, and that is the difference between a wait and a guess: a fixed
 * sleep reports "no report arrived" for a panel that arrived a moment later, and the two are
 * indistinguishable in the output.
 *
 * **The ceiling is the worker's own published constant**, never a number chosen here, for the
 * reason this repository has recorded about every hand-picked constant: a number picked in a probe
 * is a number picked to be large enough.
 */
async function waitForPanelReport(worker, since, ceilingMs) {
  const deadline = Date.now() + ceilingMs;
  let last = await callProbe(worker, "panelReport");

  while (Date.now() < deadline) {
    if (last && last.sequence > since) return { report: last, waitedMs: null, timedOut: false };
    await sleep(100);
    last = await callProbe(worker, "panelReport");
  }

  return { report: last, waitedMs: ceilingMs, timedOut: true };
}

/** Summarise one panel report's observations into lines a person reads. */
function printReport(report, indent = "    ") {
  if (!report) {
    say(`${indent}panel report        (none published)`);
    return;
  }
  const o = report.observations ?? {};
  say(`${indent}panel origin        ${report.panelOrigin}`);
  say(`${indent}sequence / reason   ${report.sequence} / ${report.reason}`);
  say(`${indent}hears activation    ${report.canHearTabActivation}`);
  const render = (label, observation) => {
    const value = observation?.value;
    const shown = value === undefined ? "undefined" : JSON.stringify(value);
    const withheld = observation?.withheld === true ? "  (withheld)" : "";
    const threw = observation?.threw ? `  (threw ${observation.threw})` : "";
    say(`${indent}${label.padEnd(20)}${shown}${withheld}${threw}`);
  };
  render("windows.getCurrent", o.window);
  render("tabs.getCurrent", o.currentTab);
  render("tabs.query count", o.queriedTabs);
  render("active tab id", o.activeTabId);
  render("active tab url", o.activeTabUrl);
  render("active tab hostname", o.activeTabHostname);
  render("active tab title", o.activeTabTitle);
}

function describeEnvironment() {
  return {
    playwright: PLAYWRIGHT_VERSION,
    channel: "chromium",
    loadedAs: "unpacked",
    headless: true,
  };
}

/**
 * Open two fixture tabs in one window and bring the content-script page to the front.
 *
 * **The second tab is `about:blank` on purpose.** The fixture's `content_scripts.matches` covers only
 * the `http` and `https` schemes, so an `about:blank` document is the only page this run reaches that
 * carries no content script — and D4 names it as the arm that must still produce a report. A second
 * `https` page would have a content script and would answer, which is the opposite of the arm.
 *
 * **The content-script page is brought to front deliberately**, because `currentWindow`'s active tab
 * is what the panel is asked to name and the driver chooses it.
 */
async function stageTabs(context) {
  await serveFixtureOrigin(context);

  const content = await context.newPage();
  await content.goto(`${CONTENT_PAGE_ORIGIN}/`, { waitUntil: "domcontentloaded" });

  const bare = await context.newPage();
  await bare.goto("about:blank", { waitUntil: "domcontentloaded" });

  await content.bringToFront();

  return { content, bare };
}

// ---------------------------------------------------------------------------

/**
 * Arm 1: what each staged manifest gives the worker, for every variant.
 *
 * **A variant that cannot be launched is recorded as a row with no reading, and the stage carries on.**
 * This is the change that added two cells, and a cell's fixture is the one thing a platform can
 * refuse outright - a manifest naming `side_panel` with no permission granting it is the exact
 * combination §4.6 never ran, so **its worker failing to start is a plausible result rather than a
 * surprise.** Letting that throw out of the loop would abandon the other four variants and produce a
 * run with no reading at all, which is the recorded "measured nothing" outcome arriving through a
 * different door. So the failure is captured beside the reading it replaced, and `readCell` counts it
 * as not observed - which `decide()` then refuses to produce a verdict through.
 *
 * **`HarnessError` and anything else are both caught**, because the point is that the run reports
 * *which* cell did not read and keeps going, and a fixture that crashed the driver would report
 * nothing at all.
 */
async function runApiPresence(label) {
  const rows = [];

  for (const variant of VARIANTS) {
    try {
      const staged = stageVariant(variant, `${label}-api`);
      const name = `${variant}-api`;
      await launchWorker(staged, name);

      const worker = workerOf(name);
      const api = await callProbe(worker, "apiReport");
      rows.push({ variant, api });

      say(`\n[api presence] variant: ${variant}`);
      say(`    declared permissions   ${JSON.stringify(api.declaredPermissions)}`);
      say(`    declared side_panel    ${JSON.stringify(api.declaredSidePanelKey)}`);
      say(`    chrome.sidePanel       ${api.hasSidePanelApi ? "present" : "undefined"}`);
      say(`    .open available        ${api.hasOpen}`);
      say(`    .getPanelState         ${api.hasGetPanelState}`);
      say(`    .setPanelBehavior      ${api.hasSetPanelBehavior}`);
    } catch (cause) {
      const failure = `${variant}: ${String(cause)}`;
      rows.push({ variant, api: null, failure });

      say(`\n[api presence] variant: ${variant}`);
      say(`    DID NOT REPORT         ${String(cause)}`);
      say(
        `    → recorded as NOT OBSERVED, which is not the same as "chrome.sidePanel is undefined"`,
      );
    }
  }

  return rows;
}

/**
 * The arms that need a panel: gesture, panel report, route (b), sendMessage, tab switch, provider.
 *
 * **One window, reused, and one panel per variant** — a second `open()` in the same window would be
 * ambiguous about whether it re-opened or was already open, and D4's two observations are only
 * meaningful against a known starting state.
 */
async function runPanelArms(label, apiRows) {
  // **Rows carry their reading under `api` now, because a row may carry none** — the API-presence
  // stage records a fixture that failed to launch as a row with `api: null`, so every reader here
  // has to go through the same property rather than half of them reading `row.hasSidePanelApi` and
  // finding it absent for two different reasons.
  const apiByVariant = Object.fromEntries(apiRows.map((row) => [row.variant, row.api]));
  const basePresent = apiByVariant.base?.hasSidePanelApi === true;
  const controlAbsent = apiByVariant.control?.hasSidePanelApi === false;

  say(`\n[control] base sees chrome.sidePanel: ${basePresent}`);
  say(`[control] control sees chrome.sidePanel: ${controlAbsent ? "absent" : "PRESENT"}`);

  if (!basePresent) {
    say(
      `\n  Every later arm is about an API the base fixture does not have. Recorded as\n` +
        `  UNMEASURABLE-ON-SUBSTRATE rather than answered.`,
    );
    return { answerable: false, reason: "the base fixture did not see chrome.sidePanel" };
  }
  if (!controlAbsent) {
    say(
      `\n  The control still sees chrome.sidePanel, so the manifest is not what makes the API\n` +
        `  exist and the arms below measure nothing. Recorded as UNANSWERABLE.`,
    );
    return { answerable: false, reason: "the control arm still saw chrome.sidePanel" };
  }

  const staged = stageVariant("base", `${label}-panel`);
  const { context, worker } = await launchWorker(staged, `base-panel`);
  const ceiling = await readConstant(worker, "PANEL_REPORT_WAIT_MS");

  if (typeof ceiling !== "number") {
    throw new HarnessError(
      `The worker published no PANEL_REPORT_WAIT_MS; this run has no ceiling.`,
    );
  }

  const windows = await stageTabs(context);
  const results = {
    openOutcome: null,
    panelReport: null,
    messages: {},
    switch: {},
    provider: null,
  };

  // --- arm 2 and 3: open outcome and panel report, recorded separately -----------------
  //
  // **The gesture is a real `click()` on a real button in a real extension page**, which is what
  // satisfies the platform's user-gesture requirement (design.md D3). It is not `openPanelOnActionClick`,
  // which the proposal records as decided against.
  const runId = `${label}-base`;
  await callProbe(worker, "setRunId", runId);

  const launcher = await context.newPage();
  await launcher.goto(`chrome-extension://${await extensionId(context)}/documents/launcher.html`, {
    waitUntil: "domcontentloaded",
  });
  await launcher.bringToFront();
  // **The launcher is brought to front so the click lands there**, then the content page is brought
  // back to front immediately after: the panel must open beside the content page, not beside itself,
  // and `chrome.sidePanel.open({ windowId })` targets the window rather than the tab, so the window
  // is what the driver fixes and the active tab is what the panel reports.
  await launcher.click("#open");
  const launchOutcome = await launcher.textContent("#outcome");
  await windows.content.bringToFront();

  const opened = await callProbe(worker, "launchReport");
  results.openOutcome = { launcherText: launchOutcome, ...opened };
  say(`\n[arm 2] open() outcome`);
  say(`    launcher says         ${JSON.stringify(launchOutcome)}`);
  say(`    chrome.sidePanel.open  ${opened?.api ? "called" : "NOT PRESENT"}`);
  say(`    opened                ${JSON.stringify(opened?.opened ?? null)}`);
  say(`    refused because       ${JSON.stringify(opened?.reason ?? null)}`);
  say(`    threw                 ${JSON.stringify(opened?.threw ?? null)}`);

  const first = await waitForPanelReport(worker, 0, ceiling);
  results.panelReport = first.report;
  say(`\n[arm 3] panel's own report`);
  printReport(first.report);
  if (first.timedOut) {
    say(`    (no report after ${ms(first.waitedMs)}; the panel document did not run)`);
  }

  // --- arm 5: sendMessage, positive and negative ------------------------------------
  const positive = await callProbe(worker, "askPanel", "messageActiveTab");
  results.messages.positive = positive;
  say(`\n[arm 5a] panel -> active tab (which HAS a content script)`);
  say(`    panel answered worker  ${positive?.delivered}`);
  say(`    tabId                 ${JSON.stringify(positive?.answer?.tabId ?? null)}`);
  say(`    reached the tab       ${positive?.answer?.reached}`);
  say(`    reply                 ${JSON.stringify(positive?.answer?.reply ?? null)}`);

  // **The negative arm is driven by switching the active tab**, not by messaging a remembered id,
  // because the id is only correct if the driver's model of the window is correct — and this run
  // measures the panel's model, not the driver's.
  await windows.bare.bringToFront();
  const bareWait = await waitForPanelReport(worker, results.panelReport?.sequence ?? 0, ceiling);
  results.panelReport = bareWait.report;
  const negative = await callProbe(worker, "askPanel", "messageActiveTab");
  results.messages.negative = negative;
  say(`\n[arm 5b] panel -> active tab (which has NO content script)`);
  say(`    panel answered worker  ${negative?.delivered}`);
  say(`    tabId                 ${JSON.stringify(negative?.answer?.tabId ?? null)}`);
  say(`    reached the tab       ${negative?.answer?.reached}`);
  say(`    reply                 ${JSON.stringify(negative?.answer?.reply ?? null)}`);
  say(`    refused because       ${JSON.stringify(negative?.answer?.reason ?? null)}`);
  // **The shape is named rather than asserted**, because the first version of this line said "a
  // refusal here is the answer" and the second version named a different shape without re-reading
  // which field held it — the same report printed `delivered: true` and an error message in the same
  // run, because `delivered` meant "the panel answered the worker" and the refusal lived beside it.
  const shape =
    negative?.answer?.reached === false
      ? "REJECTED"
      : negative?.answer?.reply
        ? "RESOLVED WITH A REPLY"
        : "RESOLVED WITH NOTHING";
  say(`    shape                 ${shape}`);
  if (shape === "REJECTED") {
    say(
      `    → the call REFUSED rather than resolving empty. A panel can therefore detect "no content`,
    );
    say(
      `      script on this page" — but only because the platform rejected, not because it said so.`,
    );
  }

  // --- arm 6: driven tab switch, three reads ------------------------------------------
  //
  // **The sequence is read BEFORE the switch, and the wait is against that reading.** The first
  // version read it afterwards, which meant the wait was already satisfied by the report arm 5b's own
  // question had caused — so "the panel followed the tab switch" was answered with a report that had
  // nothing to do with the switch. The reading it printed carried `reason: messageActiveTab`, which
  // is the question arm 5b had asked, and nothing on the page said so.
  //
  // This is the same class as the recorded `motion.spec.ts` defect, where a gate read its marker
  // after the handler had already been asked rather than while the request was in flight: **a wait
  // whose precondition is already satisfied measures nothing and reports success.** It is also the
  // D5 property itself — the whole claim is *re-evaluation*, and a report that arrived before the
  // switch is not one.
  const beforeSwitch = await callProbe(worker, "panelReportCount");
  await windows.content.bringToFront();
  const switchWait = await waitForPanelReport(worker, beforeSwitch, ceiling);
  results.switch.before = beforeSwitch;
  results.switch.afterSwitch = switchWait.report;
  say(`\n[arm 6] driven tab switch`);
  say(`    sequence before       ${beforeSwitch}`);
  say(
    `    report after switch   sequence=${switchWait.report?.sequence ?? "(none)"} reason=${switchWait.report?.reason ?? "(none)"}`,
  );
  if (!switchWait.report || switchWait.timedOut) {
    say(`    the panel published nothing new within ${ms(ceiling)}`);
    say(`    → it did NOT follow the switch on its own; it can only be asked.`);
  } else {
    say(
      `    → it re-reported on its own, with reason "${switchWait.report.reason}"${switchWait.report.reason === "activated" ? " (the onActivated listener fired)" : " (NOT the listener - something else caused it)"}`,
    );
    printReport(switchWait.report);
  }

  const askedSequence = await callProbe(worker, "panelReportCount");
  await callProbe(worker, "askPanel", "reread");
  const askedWait = await waitForPanelReport(worker, askedSequence, ceiling);
  results.switch.afterAsked = askedWait.report;
  say(
    `    after an explicit ask sequence=${askedWait.report?.sequence ?? "(none)"} reason=${askedWait.report?.reason ?? "(none)"}`,
  );

  // --- arm 7: provider reach ---------------------------------------------------------
  const provider = await callProbe(worker, "askPanel", "reachProvider");
  results.provider = provider;
  say(`\n[arm 7] extension-hosted document -> provider origin`);
  say(`    delivered             ${provider?.delivered}`);
  say(
    `    url                   ${JSON.stringify(provider?.answer?.url ?? provider?.reason ?? null)}`,
  );
  say(
    `    ok / status           ${JSON.stringify(provider?.answer?.ok ?? null)} / ${JSON.stringify(provider?.answer?.status ?? null)}`,
  );
  say(`    threw                 ${JSON.stringify(provider?.answer?.threw ?? null)}`);
  say(`    (the body is never read; this arm is about whether the request was ALLOWED)`);

  return { answerable: true, results, ceilingMs: ceiling, panelReportWaitMs: ceiling };
}

/**
 * Route (b): the same panel report read from a `tabs`-holding fixture.
 *
 * **It is its own launch, not a permission added to the running one** — a permission cannot be added
 * to a loaded extension, and a run that reported "with `tabs`" from the same worker would be
 * reporting the wrong extension.
 */
async function runTabsVariant(label) {
  const staged = stageVariant("tabs", `${label}-tabs`);
  const { context, worker } = await launchWorker(staged, `tabs-panel`);
  const ceiling = await readConstant(worker, "PANEL_REPORT_WAIT_MS");

  const content = await context.newPage();
  await serveFixtureOrigin(context);
  await content.goto(`${CONTENT_PAGE_ORIGIN}/`, { waitUntil: "domcontentloaded" });

  const launcher = await context.newPage();
  await launcher.goto(`chrome-extension://${await extensionId(context)}/documents/launcher.html`, {
    waitUntil: "domcontentloaded",
  });
  await launcher.bringToFront();
  await launcher.click("#open");
  await content.bringToFront();

  const report = await waitForPanelReport(worker, 0, ceiling);
  say(`\n[arm 4] route (b): a fixture holding \`tabs\``);
  printReport(report.report);
  if (report.timedOut) {
    say(`    (no report after ${ms(report.waitedMs)})`);
  }

  return report.report;
}

/** Arm 8: what Playwright can see of a docked panel, and what the tab substitute preserves. */
async function runPlaywrightArm(label) {
  const staged = stageVariant("base", `${label}-pw`);
  const { context, worker } = await launchWorker(staged, `base-pw`);
  const ceiling = await readConstant(worker, "PANEL_REPORT_WAIT_MS");

  const content = await context.newPage();
  await serveFixtureOrigin(context);
  await content.goto(`${CONTENT_PAGE_ORIGIN}/`, { waitUntil: "domcontentloaded" });

  const before = context.pages().map((page) => page.url());
  const launcher = await context.newPage();
  await launcher.goto(`chrome-extension://${await extensionId(context)}/documents/launcher.html`, {
    waitUntil: "domcontentloaded",
  });
  await launcher.bringToFront();
  await launcher.click("#open");
  await content.bringToFront();

  const report = await waitForPanelReport(worker, 0, ceiling);
  const after = context.pages().map((page) => page.url());

  // **The observation is the page LIST, not a search for the panel**, and the launcher's own page is
  // removed before the list is read.
  //
  // **The first version counted every added page, including the one the driver itself opened**, and
  // reported `Playwright saw a Page: true` in a run whose own output one line earlier said the panel
  // had published nothing. The launcher's URL is subtracted here rather than filtered by a
  // `sidepanel.html` test in the verdict, because the whole question is *which* page was added and a
  // filter that only removed the launcher would still have let a fixture page through.
  const added = after.filter(
    (url) => !before.includes(url) && !url.endsWith("/documents/launcher.html"),
  );

  say(`\n[arm 8] what Playwright sees of a docked panel`);
  say(`    pages before open()   ${before.length}`);
  say(`    pages after open()    ${after.length}`);
  say(`    pages added (not the launcher) ${JSON.stringify(added)}`);
  say(
    `    panel reported        ${report.report ? `yes (sequence ${report.report.sequence})` : "NO"}`,
  );
  // **The conclusion is printed only when the reading supports it.** The first version of this line
  // was an unconditional "the panel ran; Playwright still has no Page for it" — a claim about a
  // measurement printed beside the measurement that did not make it, which is the recorded shape of a
  // run whose text contradicts its own data. It stood there through a whole run in which the panel
  // had published nothing at all.
  if (report.report && added.every((url) => !url.includes("documents/sidepanel.html"))) {
    say(`    → the panel ran; Playwright still has no Page for it. The two are not in conflict.`);
  } else if (report.report) {
    say(
      `    → a Page WAS added for the panel, which contradicts what this repository measured for`,
    );
    say(`      the popup during in-page-fill. Treat this run's readback before drawing from it.`);
  } else {
    say(
      `    → the panel published nothing, so this arm establishes ONLY that open() added no Page.`,
    );
    say(`      Whether a panel was mounted at all is NOT established by this line.`);
  }

  // --- the substitute, run as its own arm and labelled as one -----------------------
  //
  // **A tab-hosted panel document is not docked beside anything**, so the window and active-tab
  // readings below are the *substitute's own tab* and are labelled as such — this is the popup
  // substitute `in-page-fill` recorded, and running it here is what tells M11 slice 1 what the
  // browser tier could buy (design.md D1).
  const substitute = await context.newPage();
  await substitute.goto(
    `chrome-extension://${await extensionId(context)}/documents/sidepanel.html`,
    {
      waitUntil: "domcontentloaded",
    },
  );
  const substituteReport = await waitForPanelReport(worker, report.report?.sequence ?? 0, ceiling);

  say(`\n[arm 8b] SUBSTITUTE: sidepanel.html opened as a tab`);
  printReport(substituteReport.report, "    ");
  say(`    this reading is the SUBSTITUTE's own window and tab, NOT a docked panel's.`);
  say(`    what it preserves: the panel code ran, and the storage readback works.`);
  say(`    what it does not: "which page am I beside" — it reports its own tab by construction.`);

  return {
    pagesBefore: before,
    pagesAfter: after,
    added,
    launcherPageCount: after.length - before.length,
    panelReported: Boolean(report.report),
    substitute: substituteReport.report,
  };
}

/** The extension's own id, read from its worker, so no URL is spelled out twice. */
async function extensionId(context) {
  const worker = context.serviceWorkers()[0];
  return worker.evaluate(() => chrome.runtime.id);
}

// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(FIXTURE_DIR)) {
    throw new HarnessError(
      `The side-panel probe fixture is missing at ${FIXTURE_DIR}. Without it this measurement ` +
        `cannot run, and it cannot be substituted by adding "sidePanel" to the shipped manifest ` +
        `before a decision has been made about what ships with it.`,
    );
  }
  mkdirSync(RESULTS_DIR, { recursive: true });

  const label = String(process.pid);

  say(`side-panel-runtime — what a panel context can see, and what it costs\n`);
  say(`environment   ${JSON.stringify(describeEnvironment())}`);
  say(`playwright    ${PLAYWRIGHT_VERSION}`);

  // --- arm 1: API presence across all three variants ---------------------------------
  const apiRows = await runApiPresence(label);

  // --- arms 2, 3, 5, 6, 7 (base fixture) and 4 (tabs fixture) -------------------------
  const panelRun = await runPanelArms(label, apiRows);
  const tabsReport = panelRun.answerable ? await runTabsVariant(label) : null;

  // --- arm 8: Playwright's view, and the substitute ----------------------------------
  const playwrightArm = panelRun.answerable ? await runPlaywrightArm(label) : null;

  // **The later stages are folded back into the base run's own result before the verdict is
  // computed**, so `decide()` reads every arm from one object rather than being handed a mixture of
  // a run's internals and two separate returns. A verdict assembled from three sources is a verdict
  // whose three sources can disagree about what happened.
  if (panelRun.answerable) {
    panelRun.results.hostnameWithTabs = tabsReport?.observations?.activeTabHostname?.value ?? null;
    panelRun.results.playwright = playwrightArm;
  }

  // --- the two-by-two, and then the verdict --------------------------------------------
  //
  // **Printed before the arms tally and read by it.** The cells are four of the observations below,
  // so a cell that reported nothing shows up as a `MISS` line *and* as `NOT OBSERVED` in the table —
  // two independent readers of the same fact, which is what stops a reader treating one of them as
  // decorative.
  const cells = readCells(apiRows);
  printCells(cells);

  const observations = [];
  // **The aggregate reads rows *with a reading*, not rows.** `apiRows.length === VARIANTS.length`
  // was true for a run in which every fixture failed to launch, because a captured failure is
  // still a row — and this is the same "an absence of data read as an observation" defect the cell
  // rows above were added to stop. `tabs` is the one variant no cell covers, so the aggregate is
  // what keeps it in the tally rather than being dropped from it.
  observations.push({ arm: "api presence", observed: apiRows.every((row) => row.api !== null) });
  for (const cell of cells) {
    observations.push({ arm: `2x2 cell ${cell.cell} (${cell.variant})`, observed: cell.observed });
  }
  observations.push({
    arm: "open outcome",
    observed: Boolean(panelRun.results?.openOutcome),
  });
  observations.push({
    arm: "panel report",
    observed: Boolean(panelRun.results?.panelReport),
  });
  observations.push({ arm: "route (b) with tabs", observed: Boolean(tabsReport) });
  observations.push({
    arm: "sendMessage positive",
    observed: panelRun.results?.messages?.positive?.answer?.reached === true,
  });
  observations.push({
    arm: "sendMessage negative",
    observed: typeof panelRun.results?.messages?.negative?.answer?.reached === "boolean",
  });
  observations.push({
    arm: "tab switch",
    // **The arm is observed only when the panel produced a report NEWER than the one it had before
    // the switch.** `afterSwitch` is assigned on every path, including the timed-out one where it
    // holds the report that was already there — so `!== undefined` would have been satisfied by a run
    // in which the panel never re-reported, which is the exact branch route (c) exists to detect.
    observed:
      (panelRun.results?.switch?.afterSwitch?.sequence ?? -1) >
      (panelRun.results?.switch?.before ?? Number.MAX_SAFE_INTEGER),
  });
  observations.push({
    arm: "provider reach",
    observed: typeof panelRun.results?.provider?.answer?.attempted === "boolean",
  });
  observations.push({ arm: "Playwright view", observed: playwrightArm !== null });

  const observedCount = observations.filter((o) => o.observed).length;
  const total = observations.length;
  const verdict = decide(apiRows, cells, panelRun, observations);

  say(`\n${"=".repeat(72)}`);
  say(`arms observed   ${observedCount}/${total}`);
  for (const o of observations) {
    say(`  ${o.observed ? "ok  " : "MISS"} ${o.arm}`);
  }
  say(`${"=".repeat(72)}`);

  say(`\nverdict`);
  say(`  answerable                  ${verdict.answerable}`);
  if (!verdict.answerable) {
    say(`  reason                      ${verdict.reason}`);
  } else {
    say(`  --- the two-by-two, computed from the four cells above ---`);
    say(`  side_panel key alone          ${verdict.keyAloneEarnsTheApi}`);
    say(`  sidePanel permission alone    ${verdict.permissionAloneEarnsTheApi}`);
    say(`  --- the panel arms ---`);
    say(`  panel opened                ${verdict.panelOpened}`);
    say(`  panel's document ran        ${verdict.panelRan}`);
    say(`  hostname WITHOUT tabs        ${JSON.stringify(verdict.hostnameWithoutTabs)}`);
    say(`  hostname WITH tabs           ${JSON.stringify(verdict.hostnameWithTabs)}`);
    say(`  follows a tab switch alone  ${verdict.followedSwitchOnItsOwn}`);
    say(`  reached page with script     ${verdict.reachedPageWithContentScript}`);
    say(`  reached page without script ${verdict.reachedPageWithout}`);
    say(`  provider fetch allowed      ${verdict.providerFetchAllowed}`);
    say(`  Playwright saw a Page       ${verdict.playwrightSawAPage}`);
    say(`  panel reported at all       ${verdict.panelReported}`);
  }

  say(`\nwhat this does NOT establish`);
  for (const limit of LIMITS) {
    say(`  - ${limit}`);
  }

  await closeAllContexts();

  if (observedCount < total || !verdict.answerable) {
    say(
      `\nHARNESS-INCONCLUSIVE: ${observedCount}/${total} arms observed` +
        `${verdict.answerable ? "" : ", and the verdict is unanswerable"}.`,
    );
    process.exitCode = 1;
  } else {
    say(`\nAll arms produced an observation. The limits above are part of the result.`);
  }
}

try {
  await main();
  // **A generated file that survived into the source tree would be read as evidence about a later
  // run**, so the source fixture is checked against the exact set of files it is supposed to hold.
  //
  // **The list is spelled out rather than filtered by extension.** `notification-display.mjs` checks
  // for `*.png` because its only stray is a PNG; this run stages whole *directories* and manifests, so
  // a stray here is most likely a `manifest.json` a failed write left behind — and a filter that
  // exempts `manifest.json` by name would pass with a staged manifest sitting in the source.
  const EXPECTED = ["documents", "manifest.json", "probe.js", "variants"];
  const strays = readdirSync(FIXTURE_DIR)
    .filter((name) => !EXPECTED.includes(name))
    .sort();
  if (strays.length > 0) {
    say(
      `\nHARNESS-ERROR: the source fixture holds files this run did not write: ${strays.join(", ")}`,
    );
    process.exitCode = 1;
  }
} catch (cause) {
  await closeAllContexts();
  if (cause instanceof HarnessError) {
    say(`\nHARNESS-ERROR: ${cause.message}`);
    process.exitCode = 1;
  } else {
    say(`\nHARNESS-ERROR: ${String(cause)}`);
    process.exitCode = 1;
  }
}
