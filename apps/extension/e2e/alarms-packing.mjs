/**
 * When does Chromium actually **fire** a recurring alarm?
 *
 * ## What requirement this discharges
 *
 * `extension-client` requires that a change placing the polling session in a background
 * context reconcile *the effective cadence* against the shared one, and `docs/PROVIDERS.md`
 * §4.1 measured only what `chrome.alarms` **stores** — every requested period accepted
 * verbatim, down to 999.6 ms. §5.2 still lists the packing interval as open, so M10's
 * incoming-mail notification has nothing to be honest about yet.
 *
 * ## How to run it
 *
 *     node apps/extension/e2e/alarms-packing.mjs
 *
 *     node apps/extension/e2e/alarms-packing.mjs --only ceiling   # one alarm, in isolation
 *     node apps/extension/e2e/alarms-packing.mjs --window 5000     # deliberately too short
 *
 * **Run it once per alarm.** Arming both at once measures something real — that they compete —
 * but it does not measure either one's cadence, and a run that cannot tell "the platform ignored
 * this alarm" from "the platform never let it run" is not a measurement of that alarm. See
 * `design.md` D8 for the numbers that made this a flag rather than a footnote.
 *
 * Exits `0` when it measured something and `1` when it could not — and **"measured
 * nothing" is the second**, because a run that observed no firings is indistinguishable from
 * a listener that never fired.
 *
 * ## It is not in `package.json`'s scripts, deliberately
 *
 * Same quarantine as `live-host-permission.mjs`, and enforced the same way: a boundary
 * assertion requires no runner to collect this file and no manifest to name it. The run
 * takes over two minutes because the window has to be long enough to tell two hypotheses
 * apart (see `WINDOW_MS` below), and paying that on every push to re-establish something
 * already recorded is a poor trade.
 *
 * ## Why it spells the two load flags instead of importing them
 *
 * `extensionFlags()` lives in `playwright.config.ts`, and **a plain `.mjs` script cannot
 * import a TypeScript module** — there is no `allowJs` in this workspace's tsconfig, and
 * adding one would change the typecheck surface of a shipped config to accommodate one
 * quarantined script. `live-host-permission.mjs` already spells them for the same reason,
 * which means this repository had two spellings and nothing asserting they agreed. Both are
 * now checked against `extensionFlags()` by a boundary rule, so the duplication is
 * **falsifiable rather than merely duplicated**.
 *
 * ## What it writes, and where
 *
 * A Chromium profile under `apps/extension/test-results/`, named after this process.
 * **That directory is churned by this measurement**, so any later source fingerprint must
 * exclude it by name — a fingerprint that swept it once reported 2930 changed files, every
 * one of them written by the measurement that was asking the question.
 *
 * ## What it establishes, and what it does not
 *
 * It establishes what this Chromium did on this machine, in this run, loaded unpacked.
 * It establishes nothing about a packed extension, another engine, or any provider — and
 * `unpacked` matters here rather than being a footnote: Chrome's documented 30-second
 * packing and its 30-second minimum period are documented for **published** extensions, and
 * M8's own floor measurement only succeeded because unpacked builds accept periods a
 * published one would refuse.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import {
  INBOX_POLL_CEILING_MS,
  INBOX_POLL_PROMPT_MS,
} from "../../../packages/mailbox/src/cadence.ts";

/** The Playwright version, read rather than written down. */
const PLAYWRIGHT_VERSION = createRequire(import.meta.url)("@playwright/test/package.json").version;

const PROBE_DIR = fileURLToPath(new URL("./fixtures/alarm-probe", import.meta.url));
const RESULTS_DIR = fileURLToPath(new URL("../test-results", import.meta.url));

/** The two alarm names this run owns. Every record is filtered to these. */
const PROMPT_ALARM = "spectre-packing-prompt";
const CEILING_ALARM = "spectre-packing-ceiling";

/**
 * How long to watch, and **why that long**.
 *
 * Two hypotheses, and the window has to separate them:
 *
 * - **No packing.** The prompt alarm fires every {@link INBOX_POLL_PROMPT_MS}, so a window
 *   of `W` yields about `W / 5000` firings.
 * - **Packed.** Neither alarm fires more than once per 30 s, so the same window yields about
 *   `W / 30000` firings — **and the prompt and ceiling alarms become indistinguishable**,
 *   which is itself the finding a packed platform would produce.
 *
 * Two independent lower bounds, and the larger one is the honest one:
 *
 * 1. {@link FIRINGS_NEEDED} firings under the *slower* hypothesis. A cadence characterised
 *    by two or three samples is not characterised — `INBOX_POLL_CEILING_MS` is a third of a
 *    minute, so four firings is already two minutes of watching.
 * 2. {@link SEPARATION_NEEDED} extra firings under the faster one, so the two counts are not
 *    close enough that jitter could read as agreement.
 *
 * **Derived rather than chosen**, because a window picked to be "long enough" is the
 * recorded defect with a bigger number: nothing then says how much bigger is enough, or
 * what the number was chosen against.
 */
const FIRINGS_NEEDED = 4;
const SEPARATION_NEEDED = 6;

/** Firings per millisecond under each hypothesis, for the prompt alarm. */
const RATE_UNPACKED = 1 / INBOX_POLL_PROMPT_MS;
const RATE_PACKED = 1 / INBOX_POLL_CEILING_MS;

const SEPARATION_WINDOW_MS = Math.ceil(SEPARATION_NEEDED / (RATE_UNPACKED - RATE_PACKED));
const CHARACTERISATION_WINDOW_MS = FIRINGS_NEEDED * INBOX_POLL_CEILING_MS;
const WINDOW_MS = Math.max(SEPARATION_WINDOW_MS, CHARACTERISATION_WINDOW_MS);

/** How often the idle phase samples the worker's liveness. */
const IDLE_POLL_MS = 2_000;

/**
 * The two flags Chromium needs to load an unpacked extension, spelled rather than imported.
 *
 * **Both, and both of them measured rather than looked up** — see `extensionFlags()` in
 * `playwright.config.ts` for the four ways this was got wrong first. `--load-extension`
 * alone loads nothing; a relative path loads nothing; and none of it reports an error.
 */
function probeFlags(resolvedDir) {
  return [
    `--load-extension=${resolvedDir}`,
    `--disable-extensions-except=${resolvedDir}`,
    "--no-first-run",
  ];
}

/** A profile directory for this process, so two concurrent runs cannot share one. */
function profileFor(label) {
  return `${RESULTS_DIR}/alarms-packing-${label}-${process.pid}`;
}

function say(line = "") {
  console.log(line);
}

/**
 * Every context this run has opened, so the error path can close them.
 *
 * **A measurement that hangs is a worse outcome than one that fails.** A context left open
 * keeps Node's event loop alive, so the process prints its error and then sits there — which
 * is the shape this repository records as "a check that did not run is not a check that
 * passed", with the added sting that it had already printed a verdict. The error path in
 * `main` closes these before it reports.
 */
const openContexts = new Set();

async function closeAllContexts() {
  const closing = [...openContexts].map((context) => context.close().catch(() => undefined));
  openContexts.clear();
  await Promise.all(closing);
}

/** Report a measurement this run could not take, and why it is not a result. */
class HarnessError extends Error {}

function ms(value) {
  return `${value} ms`;
}

/**
 * Load the probe fixture and wait for its worker.
 *
 * **Fails loudly rather than returning nothing** — a probe that loaded no worker would
 * otherwise produce a run with zero firings, which the classifier below would have to treat
 * as a finding about the platform.
 */
async function launchProbe(profileDir) {
  if (!existsSync(PROBE_DIR)) {
    throw new HarnessError(
      `The alarms probe fixture is missing at ${PROBE_DIR}. Without it this measurement ` +
        `cannot run, and it cannot be substituted by adding "alarms" to the shipped ` +
        `manifest — see alarm-floor.spec.ts for why that would be the wrong repair.`,
    );
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    args: probeFlags(PROBE_DIR),
  });
  openContexts.add(context);

  let worker = context.serviceWorkers()[0];
  if (!worker) {
    try {
      worker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    } catch (cause) {
      await context.close();
      throw new HarnessError(
        `The probe fixture registered no service worker: ${String(cause)}. Both flags and ` +
          `an absolute path are required — see extensionFlags() in playwright.config.ts.`,
      );
    }
  }

  await context.newPage();
  return { context, worker };
}

/**
 * Where the probe said it writes.
 *
 * **Read from the worker rather than restated here.** A second spelling would read an empty
 * record, and an empty record is indistinguishable from an alarm that never fired — the
 * silent-drift shape this repository records more than once.
 */
async function recordKeyOf(worker) {
  const key = await worker.evaluate(() => self.__spectreAlarmRecordKey);
  if (typeof key !== "string" || key.length === 0) {
    throw new HarnessError(
      `The probe worker did not publish a record key (read ${String(key)}), so the record ` +
        `cannot be located. That is an instrument fault, not a platform finding.`,
    );
  }
  return key;
}

/** Read the stored record. The same reader is used for every phase, deliberately. */
function readRecord(worker, key) {
  return worker.evaluate(async (k) => {
    const stored = await chrome.storage.local.get(k);
    return Array.isArray(stored[k]) ? stored[k] : [];
  }, key);
}

async function clearRecord(worker, key) {
  await worker.evaluate((k) => chrome.storage.local.set({ [k]: [] }), key);
}

/** Wall-clock gaps between consecutive firings of one alarm, and how many there were. */
function spacingOf(entries) {
  const times = entries.map((entry) => entry.at).sort((a, b) => a - b);
  const gaps = times.slice(1).map((at, index) => at - times[index]);
  return { count: times.length, firstAt: times[0], lastAt: times[times.length - 1], gaps };
}

/**
 * One alarm's line, including **how long it took to fire first**.
 *
 * The first-firing latency is reported separately from the spacing because a background
 * poller cares about both and they answer different questions: spacing says how often it
 * runs once running, and latency says how long after a decision to arm it the first check
 * happens. A cadence characterised by spacing alone can hide an alarm that waits a minute
 * to begin — which is exactly what a `>=` 30 s period would do.
 */
/**
 * Report one alarm's observed spacing.
 *
 * **The requested period is deliberately not a parameter.** It is printed once, in the header,
 * by import from `packages/mailbox` — so a reader comparing the two is comparing a restated
 * constant with the constant itself, and the summary line below pairs them from the same source.
 * A copy of the period printed beside the measurement would be a second place to be wrong.
 */
function reportAlarm(name, spacing, createdAt) {
  if (spacing.count === 0) {
    say(`  ${name}  0 firing(s) — no firing observed in the window`);
    return;
  }
  const latency = createdAt === undefined ? undefined : spacing.firstAt - createdAt;
  say(
    `  ${name}  ${spacing.count} firing(s), first ${latency === undefined ? "?" : ms(latency)} ` +
      `after creation, spacing ${describeSpread(spacing.gaps)}`,
  );
  if (spacing.gaps.length > 0) {
    say(
      `    first gaps  ${spacing.gaps
        .slice(0, 6)
        .map((gap) => ms(gap))
        .join(", ")}`,
    );
  }
}

/**
 * The mean of a non-empty list of gaps.
 *
 * **There is no empty case here, deliberately.** An earlier version of the summary computed its
 * own mean inline and divided an empty array when an alarm fired once, printing `NaN ms`. Two
 * callers share this function now, so the guard lives in both of them rather than here: a helper
 * that silently returned `NaN` for an empty list would let the next caller forget the check, and
 * the check is the whole of the fix.
 */
function meanOf(gaps) {
  return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
}

function describeSpread(gaps) {
  if (gaps.length === 0) return "no gap to describe";
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  return `min ${ms(min)}, mean ${ms(meanOf(gaps))}, max ${ms(max)}`;
}

/** Wait, but give up rather than hang. A check that did not run is not a check that ran. */
function waitBounded(durationMs, ceilingMs, label) {
  let timer;
  const ceiling = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new HarnessError(`${label} passed its ${ms(ceilingMs)} ceiling without finishing`)),
      ceilingMs,
    );
  });
  const work = new Promise((resolve) => setTimeout(resolve, durationMs));
  return Promise.race([work, ceiling]).finally(() => clearTimeout(timer));
}

/**
 * Phase 0 — prove the reader reads, before any reading is trusted.
 *
 * **The control exists because a run that observes nothing has two indistinguishable
 * causes.** A listener that never fired, and a reader pointed at the wrong key. Without
 * this, "no firings observed" is a conclusion rather than a symptom.
 */
async function controlTheReader(worker, key) {
  const planted = { at: Date.now(), name: "spectre-packing-control", workerId: "control" };
  await worker.evaluate(
    async ([k, entry]) => chrome.storage.local.set({ [k]: [entry] }),
    [key, planted],
  );
  const readBack = await readRecord(worker, key);
  const found = readBack.some((entry) => entry.name === planted.name);
  await clearRecord(worker, key);
  if (!found) {
    throw new HarnessError(
      `The reader did not return a record planted directly into storage. Either the reader ` +
        `is pointed somewhere other than where the probe writes, or the probe's own write ` +
        `path is broken. Both are instrument faults; neither is a platform finding.`,
    );
  }
  say("  reader control   PASS  a planted record was read back through the same reader");
}

/** Phase 1 — create both alarms, watch, and classify what the platform did. */
async function measurePacking(worker, key, windowMs, selected) {
  await clearRecord(worker, key);

  const ALARMS = [
    { name: PROMPT_ALARM, requestedMs: INBOX_POLL_PROMPT_MS },
    { name: CEILING_ALARM, requestedMs: INBOX_POLL_CEILING_MS },
  ];
  const created = ALARMS.filter((alarm) => selected.includes(alarm.name));

  // **Stamped before the create call, not after.** The latency it produces is the answer a
  // background poller actually needs, and stamping it afterwards would quietly report the gap
  // between "created" and "we noticed" rather than the one between "armed" and "fired".
  const createdAt = Date.now();
  await worker.evaluate(
    async (specs) => {
      for (const spec of specs) {
        chrome.alarms.create(spec.name, { periodInMinutes: spec.requestedMs / 60_000 });
      }
    },
    created.map((alarm) => ({ name: alarm.name, requestedMs: alarm.requestedMs })),
  );

  const startedAt = Date.now();
  await waitBounded(windowMs, windowMs + 15_000, "the packing window");
  const elapsed = Date.now() - startedAt;

  const record = await readRecord(worker, key);
  const promptEntries = record.filter((entry) => entry.name === PROMPT_ALARM);
  const ceilingEntries = record.filter((entry) => entry.name === CEILING_ALARM);
  const otherEntries = record.filter(
    (entry) => entry.name !== PROMPT_ALARM && entry.name !== CEILING_ALARM,
  );

  const prompt = spacingOf(promptEntries);
  const ceiling = spacingOf(ceilingEntries);
  const workerIds = [...new Set(record.map((entry) => entry.workerId))];

  say();
  say(`  watched for      ${ms(elapsed)}`);
  const spacings = {
    [PROMPT_ALARM]: prompt,
    [CEILING_ALARM]: ceiling,
  };
  for (const alarm of ALARMS) {
    if (created.includes(alarm)) {
      reportAlarm(alarm.name, spacings[alarm.name], createdAt);
    } else {
      say(`  ${alarm.name}  NOT CREATED in this run (--only ${selected.join(" ")})`);
    }
  }
  say(`  distinct workers seen  ${workerIds.length}`);
  if (otherEntries.length > 0) {
    say(`  unrelated firings seen  ${otherEntries.length} (ignored)`);
  }

  return { prompt, ceiling, workerIds, elapsed, createdAt };
}

/**
 * Phase 2 — how long the worker actually survives with nothing to do.
 *
 * **A separate profile, and no `chrome.alarms` call at all.** An alarm left behind from the
 * packing phase would wake the worker and make this measurement describe the alarm rather
 * than idleness — which is exactly the mistake of inferring a lifetime from a run that had
 * something to do.
 */
async function measureIdleLifetime(context, windowMs) {
  const startedAt = Date.now();
  const samples = [];
  let lastSeen = null;
  let firstGone = null;

  while (Date.now() - startedAt < windowMs) {
    const alive = context.serviceWorkers().length > 0;
    const at = Date.now() - startedAt;
    samples.push({ at, alive });
    if (alive) {
      lastSeen = at;
    } else if (firstGone === null) {
      firstGone = at;
    }
    await waitBounded(IDLE_POLL_MS, IDLE_POLL_MS + 5_000, "an idle poll");
  }

  say();
  if (firstGone === null) {
    say(
      `  idle lifetime    STILL PRESENT at the final sample, ${ms(windowMs)} into idleness. ` +
        `This is a BOUND, not a figure: the measurement stopped watching and the worker did ` +
        `not stop.`,
    );
    return { kind: "bound", boundMs: windowMs, lastSeen };
  }

  say(
    `  idle lifetime    ABSENT by the sample at ${ms(firstGone)}, after being present at ` +
      `${ms(lastSeen)}. That is a figure, bounded by the ${ms(IDLE_POLL_MS)} sampling interval.`,
  );
  return { kind: "figure", figureMs: firstGone, lastSeen };
}

/** Human-readable header, so a pasted output says what produced it. */
function describeEnvironment(context) {
  say("chrome.alarms packing measurement");
  say(`  node                 ${process.version}`);
  say(`  playwright           ${PLAYWRIGHT_VERSION}`);
  say(`  chromium             ${context.browser()?.version() ?? "unknown"}`);
  say(`  mode                 headless, extension loaded unpacked`);
  say(
    `  shared cadence       prompt ${ms(INBOX_POLL_PROMPT_MS)}, ceiling ${ms(INBOX_POLL_CEILING_MS)}`,
  );
  say();
  say("window derivation");
  say(
    `  separation       ${SEPARATION_NEEDED} firings at ${RATE_UNPACKED - RATE_PACKED} per ms ` +
      `=> ${ms(SEPARATION_WINDOW_MS)}`,
  );
  say(
    `  characterisation ${FIRINGS_NEEDED} firings under the packed hypothesis => ` +
      `${ms(CHARACTERISATION_WINDOW_MS)}`,
  );
  say(`  chosen          ${ms(WINDOW_MS)}`);
  say(
    `  predicted       unpacked: ${Math.round(WINDOW_MS * RATE_UNPACKED)} prompt firings; ` +
      `packed: ${Math.round(WINDOW_MS * RATE_PACKED)}`,
  );
  say();
}

async function main() {
  const windowArgIndex = process.argv.indexOf("--window");
  const rawWindow = windowArgIndex === -1 ? undefined : process.argv[windowArgIndex + 1];
  const requested = rawWindow === undefined ? undefined : Number(rawWindow);

  // A `--window` with no value, or with a non-number, must not silently become `NaN` and then
  // an instant "wait": that would report a completed run having watched for nothing.
  if (windowArgIndex !== -1 && (!Number.isFinite(requested) || requested <= 0)) {
    throw new HarnessError(
      `--window was given ${rawWindow === undefined ? "no value" : `"${rawWindow}"`}, which is ` +
        `not a positive number of milliseconds. A watch that lasts no time cannot measure a ` +
        `cadence.`,
    );
  }

  const windowMs = requested === undefined ? WINDOW_MS : requested;

  // `--only <prompt|ceiling>` runs a single alarm in isolation.
  //
  // **This flag exists because the first run's two-alarm design was a confound.** Both alarms
  // were created at once, on the reasoning that a concurrent alarm is a positive control — one
  // the platform must keep firing. It is a control, and it is also a second thing competing for
  // the platform's attention, and a measurement cannot tell those two roles apart. The first
  // run produced exactly the shape that ambiguity predicts: the 5 000 ms alarm fired 24 times
  // on the nose, and the 30 000 ms alarm fired not at all in 120 s. Running each alone is what
  // separates "the platform ignored it" from "the platform never let it run".
  const onlyArgIndex = process.argv.indexOf("--only");
  const onlyRaw = onlyArgIndex === -1 ? undefined : process.argv[onlyArgIndex + 1];
  const known = { prompt: PROMPT_ALARM, ceiling: CEILING_ALARM };
  if (onlyRaw !== undefined && !Object.hasOwn(known, onlyRaw)) {
    throw new HarnessError(
      `--only was given "${onlyRaw}", which is not one of: ${Object.keys(known).join(", ")}. ` +
        `Silently running something else would be a run that reported on a measurement nobody ` +
        `asked for.`,
    );
  }
  const selected = onlyRaw === undefined ? Object.values(known) : [known[onlyRaw]];

  const packingProfile = profileFor("packing");
  const idleProfile = profileFor("idle");

  say();

  const first = await launchProbe(packingProfile);
  describeEnvironment(first.context);

  if (Number.isFinite(requested) && requested < WINDOW_MS) {
    say(
      `  NOTE  a window of ${ms(requested)} was requested, below the ${ms(WINDOW_MS)} this ` +
        `derivation produces. Fewer than ${FIRINGS_NEEDED} firings under the packed ` +
        `hypothesis is not a characterisation of it.`,
    );
    say();
  }

  const key = await recordKeyOf(first.worker);

  say("phase 0  reader control");
  await controlTheReader(first.worker, key);

  say();
  say(`phase 1  recurring alarms${onlyRaw === undefined ? "" : `  (isolated: ${onlyRaw})`}`);
  const packing = await measurePacking(first.worker, key, windowMs, selected);

  const { count: promptCount } = packing.prompt;
  const { count: ceilingCount } = packing.ceiling;
  // Only the alarms this run actually created decide whether anything fired.
  const createdCounts = selected.map((name) =>
    name === PROMPT_ALARM ? promptCount : ceilingCount,
  );
  if (createdCounts.every((count) => count === 0)) {
    throw new HarnessError(
      `None of the created alarms fired within ${ms(windowMs)}, although the reader control ` +
        `passed immediately before. A platform that fires nothing is a finding; a reader that ` +
        `sees nothing is a fault, and the control is what tells them apart. An alarm created ` +
        `and never firing is reported here as a fault of the run rather than as "the platform ` +
        `packs to infinity".`,
    );
  }

  const unread = selected.filter((name) =>
    name === PROMPT_ALARM ? promptCount === 0 : ceilingCount === 0,
  );

  say();
  say("  reading");
  if (unread.length === 0) {
    say(
      `    Every created alarm fired. The spacing reported above is the answer, read against the ` +
        `periods asked for.`,
    );
  } else if (selected.length === 1) {
    say(
      `    The single alarm created in this isolated run fired ${createdCounts[0]} time(s). ` +
        `Nothing else was competing for the platform's scheduler, so this is free of the ` +
        `two-alarm confound the first run could not rule out.`,
    );
  } else {
    say(
      `    Only one of the two concurrent alarms fired. A second alarm competing for the same ` +
        `scheduler is one explanation and this run cannot distinguish it from the platform ` +
        `choosing not to fire the other, which is why --only exists.`,
    );
  }
  if (packing.workerIds.length > 1) {
    say(
      `    The worker was reloaded ${packing.workerIds.length - 1} time(s) during the run, so ` +
        `the spacing above includes wakes of a fresh worker and not only of a long-lived one.`,
    );
  }

  // Phase 3 — persistence, proved by closing the browser entirely.
  say();
  say("phase 3  does the record outlive the worker");
  await first.context.close();
  const reopened = await launchProbe(packingProfile);
  const afterRestart = await readRecord(reopened.worker, key);
  const recordedBeforeClose = promptCount + ceilingCount;

  // **At least, not exactly.**
  //
  // The first version of this check compared for equality and reported FAIL on a run whose
  // record was perfectly intact — because the alarms are still armed. They persist in the
  // profile, so they keep firing across the close and the reopen, and the record is a target
  // that moves while it is being compared to a snapshot of it. The claim being tested is that
  // *nothing is lost*, so the comparison is `>=`, and **any surplus is reported rather than
  // treated as noise** — a surplus is a firing that happened while the browser was shut, which
  // is a fact about alarm persistence rather than about this check.
  const grew = afterRestart.length - recordedBeforeClose;
  const survived = afterRestart.length >= recordedBeforeClose;

  say(`  entries before closing the browser  ${recordedBeforeClose}`);
  say(`  entries after a full browser restart  ${afterRestart.length}`);
  say(`  verdict  ${survived ? "PASS — nothing lost" : "FAIL — entries were lost"}`);
  if (grew > 0) {
    say(
      `  note      the record GREW by ${grew} while the browser was shut. The alarms are ` +
        `still armed after a restart, so this is evidence that a recurring alarm survives ` +
        `both a worker reload and a browser restart — not a discrepancy.`,
    );
  }

  if (!survived) {
    throw new HarnessError(
      `The record did not survive closing the browser: ${afterRestart.length} entries after ` +
        `a restart against ${recordedBeforeClose} before. A record held in a worker's memory ` +
        `would look like an alarm that stopped firing, which is the exact confusion this ` +
        `measurement exists to avoid.`,
    );
  }
  await reopened.context.close();

  say();
  say("phase 2  worker idle lifetime, no alarm created in this phase");
  const idle = await launchProbe(idleProfile);
  const lifetime = await measureIdleLifetime(idle.context, windowMs);
  await idle.context.close();

  say();
  say("summary");
  // **Both headline results at the end, because this output is what gets quoted.**
  //
  // A run whose two findings live in two places 600 lines apart forces whoever pastes it to
  // reconstruct the run, and a reconstructed run is one where the second finding quietly
  // disappears. The idle result was assigned and unused until this block existed, which lint
  // reported as a dead binding — and the correct repair was to *use* it, not to drop it.
  const headline = selected
    .map((name) => {
      const spacing = name === PROMPT_ALARM ? packing.prompt : packing.ceiling;
      const requested = name === PROMPT_ALARM ? INBOX_POLL_PROMPT_MS : INBOX_POLL_CEILING_MS;
      const label = `  ${name.padEnd(24)} requested ${ms(requested)}  ->  `;
      if (spacing.count === 0) return `${label}no firing observed`;
      // **One firing has no gap, and a gap count of zero is not a mean of anything.**
      //
      // This line shipped as `fired every NaN ms over 1 firings` and *was not caught by lint,
      // by the reader control, or by the run's exit code* — it printed a number with confidence.
      // A summary that divides an empty array is an instrument that answers wrongly rather than
      // one that declines, and the whole point of a summary is that a reader pastes it without
      // reading it. So the degenerate case is stated rather than computed.
      if (spacing.gaps.length === 0) {
        const first =
          packing.createdAt === undefined ? "?" : ms(spacing.firstAt - packing.createdAt);
        return (
          `${label}${spacing.count} firing(s), first at ${first} after creation ` +
          `— no interval yet, one firing cannot describe a cadence`
        );
      }
      return `${label}fired every ${ms(meanOf(spacing.gaps))} over ${spacing.count} firings`;
    })
    .join("\n");
  say(headline);
  say(
    `  ${"worker idle lifetime".padEnd(24)} no alarm armed    ->  ` +
      (lifetime.kind === "figure"
        ? `gone by ${ms(lifetime.figureMs)} (bound by the ${ms(IDLE_POLL_MS)} sampling interval)`
        : `still present at ${ms(lifetime.boundMs)}  [BOUND, not a figure]`),
  );

  say();
  say("  These are observations from one run on one substrate, not platform guarantees.");
  say("  Chromium loaded unpacked; nothing here says what a packed extension does.");
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  say();
  say(`HARNESS-ERROR  ${error instanceof HarnessError ? error.message : String(error)}`);
  say("  This run measured nothing. It is not a result about the platform.");
  process.exitCode = 1;
} finally {
  // **Closed before the process is allowed to end, on both paths.** See `openContexts`.
  await closeAllContexts();
}
