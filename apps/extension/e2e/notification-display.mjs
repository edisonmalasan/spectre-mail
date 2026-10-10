/**
 * Will Chromium display a notification from this extension, and does it insist on an icon?
 *
 * ## What requirement this discharges
 *
 * `incoming-mail-notification`'s `design.md` D12 names three branches and refuses to choose between
 * them by preference: ship nothing extra, ship an SVG, or ship a raster image. It cannot choose
 * because **the extension currently ships no icon of any kind** - `apps/extension/static/` contains
 * exactly one file, `manifest.json` - and nothing in this repository has ever called
 * `chrome.notifications`. This is the largest unmeasured assumption in the change, and `tasks.md`
 * 1.1 puts the measurement **before** the implementation rather than after it fails.
 *
 * Task 1.2 rides along: whether `notifications` and `alarms` are *granted* at install or require a
 * prompt is read through `chrome.permissions.getAll()` rather than assumed from the manifest, because
 * a declared permission and a granted one are different facts.
 *
 * ## How to run it
 *
 *     node apps/extension/e2e/notification-display.mjs
 *
 * Exits `0` when it measured every arm and `1` when it did not - **and "measured nothing" is the
 * second**, because a run whose arms all came back empty is indistinguishable from a probe that never
 * loaded.
 *
 * ## The arms, and why there are four rather than one
 *
 * | arm    | fixture                       | question                                     |
 * | ------ | ----------------------------- | -------------------------------------------- |
 * | control| `control/` - no `notifications`| is the API absent without the permission?     |
 * | none   | `notifications`, no `iconUrl`  | does a notification need an icon at all?      |
 * | svg    | `notifications`, `icon.svg`    | does an SVG satisfy it?                       |
 * | png    | `notifications`, `icon.png`    | does a raster image?                          |
 *
 * **The control is the arm that makes the other three mean anything.** If the API is absent in all
 * four, then "the permission made it exist" is false and the measurement has told us nothing about
 * icons. That is the alarms probe's own lesson: its first version armed two alarms at once, called
 * the competitor a positive control, and produced 0 firings for one of them - a control that shares
 * the resource under measurement is a confound.
 *
 * ## Three observations per arm, because one is a single hypothesis
 *
 * `create` resolving says the request was **accepted**. `onError` firing says it was **rejected**.
 * `getAll` containing the id says the platform believes it is **holding** one. D12's branches differ
 * in *which of these moves*, so a run recording only one could not choose between them. **A resolved
 * callback is not a displayed notification**, and the summary says so in those words.
 *
 * ## What this cannot establish, stated in the output as well as here
 *
 * **It cannot observe an operating system's notification centre, because there is not one.** Nothing
 * in this file can tell a person a notification appeared. The strongest claim it supports is about
 * acceptance and registration on this Chromium, headless and unpacked, in this run.
 *
 * ## Why it spells the two load flags instead of importing them
 *
 * `extensionFlags()` lives in `playwright.config.ts`, and a plain `.mjs` script cannot import a
 * TypeScript module. Both existing probes spell them for the same reason, and a boundary rule checks
 * that all three agree - so the duplication is falsifiable rather than merely duplicated.
 *
 * ## Why it copies the fixture instead of writing the PNG into it
 *
 * The PNG arm needs a real raster image and this repository ships no binary asset of any kind. It is
 * written **into a copy of the fixture under `test-results/`**, so the source tree gains nothing and a
 * stale generated file cannot survive a run to be read as evidence about a later one - the failure
 * `archive-bytes.mjs` recorded, where a restored source sat beside a two-seconds-older artefact.
 * **`test-results/` is churned by this measurement**, so any later source fingerprint must exclude it
 * by name: a sweep of it once reported 2930 changed files, every one written by the measurement.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import { chromium } from "@playwright/test";

/** The Playwright version, read rather than written down. */
const PLAYWRIGHT_VERSION = createRequire(import.meta.url)("@playwright/test/package.json").version;

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/notification-probe", import.meta.url));
const RESULTS_DIR = fileURLToPath(new URL("../test-results", import.meta.url));

/** The arms, in the order they run. `null` icon means the key is omitted, not sent empty. */
const ICON_ARMS = [null, "icon.svg", "icon.png"];

/*
 * **There is deliberately no settle constant here.** The first version declared `SETTLE_MS` beside
 * the arms and never used it, because the wait that matters belongs to the worker that makes the
 * request - `errorSettleMs` is published on the probe surface and *read back*, so the driver cannot
 * report a settle time the worker did not actually wait. **A second spelling of that number is the
 * drift this repository keeps paying for**, and `eslint` reporting an assigned-but-never-used
 * constant here is the same shape `verification-actions` recorded when a retired boundary rule left
 * its fixture behind.
 */

class HarnessError extends Error {}

const openContexts = new Set();

async function closeAllContexts() {
  for (const context of openContexts) {
    await context.close().catch(() => {});
  }
  openContexts.clear();
}

function say(line = "") {
  process.stdout.write(`${line}\n`);
}

/**
 * Format a duration, and refuse anything that is not one.
 *
 * **The refusal is the point.** `String(undefined).padStart(6, "0")` produces `"      "` - a
 * well-aligned column containing nothing - which is how this file printed `undefined ms` for three
 * arms without any run going red. A formatter that renders absence in the same shape as presence is
 * a formatter that hides absence.
 */
function ms(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HarnessError(`A duration was not a number: ${String(value)}.`);
  }
  return `${String(Math.round(value)).padStart(6, "0")} ms`;
}

function probeFlags(resolvedDir) {
  return [`--load-extension=${resolvedDir}`, `--disable-extensions-except=${resolvedDir}`];
}

// ---------------------------------------------------------------------------
// A PNG, written here rather than committed.
//
// Four functions and one buffer of output is cheaper than the first binary asset this repository
// would own, and a throwaway fixture is not a place to put one. `node:zlib` is already a dependency
// of the toolchain, so this adds none.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/**
 * A `SIZE`x`SIZE` opaque RGBA PNG.
 *
 * **Every pixel is the same colour on purpose** - the measurement asks whether a valid raster image
 * is accepted, and a gradient would only add a way for this to be wrong for a reason that has nothing
 * to do with the question.
 */
function solidPng(size, [r, g, b]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(6, 9); // colour type: truecolour with alpha
  header.writeUInt8(0, 10); // compression
  header.writeUInt8(0, 11); // filter
  header.writeUInt8(0, 12); // interlace

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let row = 0; row < size; row += 1) {
    const base = row * (1 + size * 4);
    raw.writeUInt8(0, base); // filter type 0 (None) for every scanline
    for (let column = 0; column < size; column += 1) {
      const pixel = base + 1 + column * 4;
      raw.writeUInt8(r, pixel);
      raw.writeUInt8(g, pixel + 1);
      raw.writeUInt8(b, pixel + 2);
      raw.writeUInt8(255, pixel + 3);
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Copy the fixture somewhere disposable and put the generated PNG beside the committed SVG.
 *
 * **`copyFileSync` for files and `cpSync` for the directory**, because the fixture now has a
 * subdirectory (the control) and copying it file by file would mean a second list of what belongs to
 * it - a second place for the fixture's contents to drift.
 */
function stageFixture(label) {
  const staged = `${RESULTS_DIR}\\notification-probe-${label}`;
  rmSync(staged, { recursive: true, force: true });
  cpSync(FIXTURE_DIR, staged, { recursive: true });
  writeFileSync(`${staged}\\icon.png`, solidPng(128, [111, 92, 201]));
  return staged;
}

/** Copy the control's own directory, so the two arms are loaded from unrelated paths. */
function stageControl(label) {
  const staged = `${RESULTS_DIR}\\notification-control-${label}`;
  rmSync(staged, { recursive: true, force: true });
  cpSync(`${FIXTURE_DIR}\\control`, staged, { recursive: true });
  return staged;
}

/**
 * Launch one probe extension and confirm its worker published a surface.
 *
 * **The surface is never returned.** `worker.evaluate` serialises its result across the boundary, so
 * reading `self[KEY]` yields a plain snapshot and every function on it is `undefined` - which is
 * what the first version of this function did, and it failed with
 * `surface.selfReport is not a function` rather than with a platform finding. Every call therefore
 * names its method **inside** the page, via the closures below.
 */
async function launchWorker(dir, label, key) {
  const context = await chromium.launchPersistentContext(`${RESULTS_DIR}\\profile-${label}`, {
    channel: "chromium",
    args: probeFlags(dir),
  });
  openContexts.add(context);

  let worker = context.serviceWorkers()[0];
  if (!worker) {
    try {
      worker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    } catch (cause) {
      await context.close();
      throw new HarnessError(
        `${label} registered no service worker: ${String(cause)}. Both flags and an absolute ` +
          `path are required - see extensionFlags() in playwright.config.ts.`,
      );
    }
  }

  await context.newPage();

  // **The handle is checked by its own keys rather than by truthiness**, because a JSON snapshot of
  // a real surface would also be truthy - and the arms would then each fail individually, pointing
  // the reader at the platform instead of at this instrument.
  const methods = await worker.evaluate((property) => {
    const surface = self[property];
    return surface === undefined ? null : Object.keys(surface).sort();
  }, key);

  if (methods === null) {
    await context.close();
    throw new HarnessError(
      `${label} published no probe surface at self["${key}"], so nothing can be asked of it. ` +
        `That is an instrument fault, not a platform finding.`,
    );
  }

  workers.set(label, worker);

  return { context, worker, key, methods };
}

/**
 * The worker handle for a label.
 *
 * **Kept in a map rather than looked up again**, because `launchWorker` is the only place that knows
 * how to find a worker, and a second lookup is a second place for the two to disagree about which
 * worker answered.
 */
const workers = new Map();
function workerOf(label) {
  const found = workers.get(label);
  if (!found) {
    throw new HarnessError(`No probe worker was recorded for "${label}".`);
  }
  return found;
}

/**
 * Call one method on a published probe surface, from inside the page.
 *
 * **Two arguments, not one closure over `key`.** The key arrives as data because a closure would
 * capture it fine here but the alternative - a per-arm spelled-out `self.__…` string - is the second
 * spelling of where a probe lives, and the repository's own record is that a second spelling drifts.
 */
async function callProbe(worker, key, method, argument) {
  const result = await worker.evaluate(
    async ([property, name, payload]) => {
      const surface = self[property];
      if (!surface || typeof surface[name] !== "function") {
        return { __missingMethod: name, __published: surface ? Object.keys(surface).sort() : null };
      }
      return surface[name](payload);
    },
    [key, method, argument ?? null],
  );

  // **Raised here rather than returned**, because a marker object handed back to an arm would be
  // read as that arm's finding: `declaredPermissions` would be `undefined` and the run would report
  // "the manifest declares nothing", which is a statement about a fixture nobody wrote.
  if (result !== null && typeof result === "object" && "__missingMethod" in result) {
    throw new HarnessError(
      `The probe surface published no method "${result.__missingMethod}" - it has ` +
        `${JSON.stringify(result.__published)}. That is an instrument fault, not a platform finding.`,
    );
  }
  return result;
}

/**
 * What this run was, so the numbers above have a substrate attached.
 *
 * **`channel: "chromium"` rather than the bundled build, and unpacked rather than installed**, both
 * named because both are load-bearing: `manifest.spec.ts` measures the manifest Chromium *parses*,
 * which is a different fact again from a notification it displays.
 */
function describeEnvironment() {
  return {
    playwright: PLAYWRIGHT_VERSION,
    channel: "chromium",
    loadedAs: "unpacked",
    headless: true,
  };
}

// ---------------------------------------------------------------------------

async function runControl(label) {
  const { key } = await launchWorker(
    stageControl(label),
    `control-${label}`,
    "__spectreNotificationControl",
  );

  const report = await callProbe(workerOf(`control-${label}`), key, "selfReport");
  say(`\n[control] no \`notifications\` permission`);
  say(`  declared permissions     ${JSON.stringify(report.declaredPermissions)}`);
  say(`  chrome.notifications      ${report.hasNotificationsApi ? "present" : "undefined"}`);
  say(`  .create available         ${report.hasCreate}`);

  return { ...report };
}

async function runIcons(label) {
  const dir = stageFixture(label);
  const label2 = `probe-${label}`;
  const { worker, key } = await launchWorker(dir, label2, "__spectreNotificationProbe");

  const report = await callProbe(worker, key, "selfReport");
  const held = await callProbe(worker, key, "permissions");
  const settleMs = await worker.evaluate((property) => self[property].errorSettleMs, key);

  say(`\n[probe] \`notifications\` declared`);
  say(`  declared permissions     ${JSON.stringify(report.declaredPermissions)}`);
  say(`  chrome.notifications      ${report.hasNotificationsApi ? "present" : "undefined"}`);
  say(`  granted permissions      ${JSON.stringify(held.permissions)}`);
  say(`  .onError available       ${report.hasOnError}`);

  if (!report.hasOnError) {
    // **Said before the arms, not after them.** With no rejection channel, "no errors" is not a
    // result the arms produced - it is the absence of the instrument that would have produced one,
    // and printing it as `0 errors` beside three green arms would read as corroboration.
    say(
      `\n  NOTE: this Chromium has no chrome.notifications.onError, so "accepted" and "registered"\n` +
        `        are the only two observations available and a silent failure is indistinguishable\n` +
        `        from one that worked. Every arm below is reported under that limit.`,
    );
  }

  const results = [];

  for (const iconUrl of ICON_ARMS) {
    const id = `spectre-probe-${iconUrl === null ? "none" : iconUrl.replace(/\W+/g, "-")}`;
    const started = Date.now();
    const arm = await callProbe(worker, key, "attempt", { id, iconUrl });
    // **Read from `arm`, which is what is reported.** The first version printed `outcome.elapsedMs`
    // after building a *different* object carrying the timing, so every arm reported `undefined ms`
    // and the run carried on: an instrument that answers confidently and wrongly is worse than one
    // that declines to answer, and `undefined ms` beside a green arm is exactly that shape.
    const outcome = { ...arm, elapsedMs: Date.now() - started };
    results.push(outcome);

    if (typeof outcome.elapsedMs !== "number") {
      throw new HarnessError(`arm "${outcome.iconUrl}" reported no elapsed time.`);
    }

    say(`\n  arm: iconUrl = ${outcome.iconUrl}`);
    say(
      `    callback resolved      ${JSON.stringify(outcome.resolvedId)}${outcome.callbackThrew ? ` (threw ${outcome.callbackThrew})` : ""}`,
    );
    say(
      `    onError events         ${outcome.hasOnError ? (outcome.errors.length === 0 ? "none" : JSON.stringify(outcome.errors)) : "(no error channel)"}`,
    );
    say(`    id appears in getAll   ${outcome.isListed}`);
    say(`    elapsed                ${ms(outcome.elapsedMs)}`);

    await callProbe(worker, key, "clearOne", id);
  }

  // **The reader control, and it is the last thing the run does.**
  //
  // A reader that answered for every id would satisfy every `isListed: false` above it, and a
  // `getAll` that always returns an object would report an absent notification as present. So this
  // asks the same reader about an id nothing ever created. Without it, "the icon arm did not
  // register" is a claim about a reader that has never been shown to say no.
  //
  // **It also reads `getAll` a second time, after every arm was cleared.** A reader that reported
  // the *current* ids correctly would then have to show an empty set, which distinguishes "reads the
  // platform" from "returns whatever the last create left behind".
  const afterCleanup = await callProbe(worker, key, "listAll");
  const neverCreated = afterCleanup.ids.some((id) => id.startsWith("spectre-probe-never-created"));
  say(
    `\n  after cleanup           getAll holds ${afterCleanup.ids.length} id(s): ${JSON.stringify(afterCleanup.ids)}`,
  );
  say(
    `  reader control           an id never created ${neverCreated ? "APPEARED" : "did not appear"}`,
  );

  return {
    selfReport: report,
    grantedPermissions: held.permissions,
    permissionsApi: held.api,
    settleMs,
    arms: results,
    readerControl: {
      idsAfterCleanup: afterCleanup.ids,
      neverCreatedAppeared: neverCreated,
      threw: afterCleanup.threw,
    },
  };
}

/**
 * Turn the four arms into the answer D12 asked for, **or say that it cannot be answered**.
 *
 * **The verdict function is deliberately conservative.** It reports `answerable: false` unless the
 * control saw the API absent and the probe saw it present, because without that pair "the icon made
 * no difference" is not a finding about icons - it is a finding about a run where nothing worked, and
 * the two look identical in a table.
 */
function decide(control, probe) {
  const controlAbsent = control.hasNotificationsApi === false;
  const probePresent = probe.selfReport.hasNotificationsApi === true;

  if (!controlAbsent || !probePresent) {
    return {
      answerable: false,
      reason: !controlAbsent
        ? "the control arm still saw chrome.notifications, so the permission is not what makes it exist and the icon arms measure nothing"
        : "the probe arm did not see chrome.notifications, so every icon arm below is a run where nothing worked",
    };
  }

  const accepted = probe.arms.filter(
    (arm) => arm.resolvedId !== null && arm.callbackThrew === null,
  );
  const registered = probe.arms.filter((arm) => arm.isListed);

  const byIcon = Object.fromEntries(
    probe.arms.map((arm) => [
      arm.iconUrl,
      {
        accepted: arm.resolvedId !== null && arm.callbackThrew === null,
        registered: arm.isListed,
        errors: arm.errors.map((error) => error.message),
      },
    ]),
  );

  const noneAccepted = byIcon["(none)"].accepted;
  const noneRegistered = byIcon["(none)"].registered;

  let branch;
  if (noneRegistered) {
    branch = "no-icon-file-ships";
  } else if (noneAccepted) {
    branch = "no-icon-file-ships-but-the-callback-overstates-it";
  } else if (byIcon["icon.svg"].registered) {
    branch = "svg-ships";
  } else if (byIcon["icon.png"].registered) {
    branch = "raster-ships";
  } else {
    branch = "unresolved";
  }

  return {
    answerable: true,
    branch,
    acceptedCount: accepted.length,
    registeredCount: registered.length,
    byIcon,
    hasOnError: probe.selfReport.hasOnError,
    note:
      "Registered means the platform's own getAll() holds the id. That is not a person seeing a " +
      "notification: this Chromium is headless and has no notification centre to look at.",
  };
}

async function main() {
  if (!existsSync(FIXTURE_DIR)) {
    throw new HarnessError(
      `The notification probe fixture is missing at ${FIXTURE_DIR}. Without it this measurement ` +
        `cannot run, and it cannot be substituted by adding "notifications" to the shipped manifest ` +
        `before a decision has been made about what ships with it.`,
    );
  }

  mkdirSync(RESULTS_DIR, { recursive: true });

  const label = String(process.pid);
  const control = await runControl(label);
  const probe = await runIcons(label);
  const verdict = decide(control, probe);

  say(`\n${"=".repeat(72)}`);
  say(`environment   ${JSON.stringify(describeEnvironment())}`);
  say(`playwright    ${PLAYWRIGHT_VERSION}`);
  say(`settle        ${probe.settleMs} ms between create and reading errors`);
  say(`${"=".repeat(72)}`);
  say(`\nverdict`);
  say(`  answerable   ${verdict.answerable}`);
  say(`  branch       ${verdict.branch ?? "(none)"}`);
  if (verdict.reason) {
    say(`  reason       ${verdict.reason}`);
  } else {
    say(`  accepted     ${verdict.acceptedCount}/${probe.arms.length}`);
    say(`  registered   ${verdict.registeredCount}/${probe.arms.length}`);
    say(
      `  error channel ${verdict.hasOnError ? "onError present" : "ABSENT - no rejection observable"}`,
    );
    for (const [icon, outcome] of Object.entries(verdict.byIcon)) {
      say(`  ${icon.padEnd(12)} accepted=${outcome.accepted} registered=${outcome.registered}`);
    }
    say(`\n  ${verdict.note}`);
  }
  say(`\n  files staged under ${RESULTS_DIR}`);

  await closeAllContexts();

  if (!verdict.answerable) {
    say(`\nHARNESS-INCONCLUSIVE: the arms did not establish the question.`);
    process.exitCode = 1;
  }
}

try {
  await main();
  // **A generated file that survived into the source tree would be read as evidence about a later
  // run**, so the staging directories are left in place but named for this process, and the tree is
  // checked for stray artefacts before exiting.
  const strays = readdirSync(FIXTURE_DIR).filter((name) => name.endsWith(".png"));
  if (strays.length > 0) {
    say(`\nHARNESS-ERROR: ${strays.join(", ")} was written into the source fixture.`);
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
