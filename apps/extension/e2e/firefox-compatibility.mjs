/**
 * The Firefox compatibility measurement — M14's first slice, and a **measurement** rather than a
 * test.
 *
 * ## What this is for
 *
 * The roadmap's M14 lists six things to adapt for Firefox — *manifest differences, browser
 * namespace differences, permissions, side-panel equivalent strategy, notification behavior, store
 * requirements* — and the first of them is the smallest-seeming. **Measured, it is not.**
 *
 * The extension's own configuration already says the tier is Chromium-only *"`--load-extension` is a
 * Chromium flag. No other engine here has it"*, and **this instrument asks whether Firefox is
 * reachable by any route this repository can reach at all.** Two routes were tried before this
 * file was written, and **both failed**: a profile carrying the add-on, and an unsigned XPI with
 * signatures not required. **This file tries the routes again, systematically, and reads Firefox's
 * own answer.**
 *
 * ## The four questions
 *
 * 1. **Can Firefox be made to install this extension at all**, and by what mechanism a build could
 *    rely on? **The order matters**: if Firefox cannot be reached, then *does Firefox accept the
 *    manifest* is unanswerable here, and the manifest work becomes guesswork about a platform this
 *    repository cannot observe.
 * 2. **Does Firefox accept the manifest as shipped**, and **which** of the manifest's three asks it
 *    refuses — the `sidePanel` permission, the `side_panel` key, or the `background.service_worker`?
 *    **An unknown permission is a manifest error rather than a missing feature**, so the three asks
 *    are three things to *decide* and not three adaptations.
 * 3. **Which of the extension's eleven platform capabilities Firefox's namespace covers**, and
 *    **with what shape** — because Firefox's `browser` namespace is promise-based and Chromium's
 *    `chrome` namespace is callback-based, so **a capability that exists in both can fail
 *    differently**, and a measurement that records only presence would miss every one of them.
 * 4. **The side panel's question**, which is a product decision rather than a compatibility shim.
 *
 * ## Why the reader is self-tested
 *
 * **Every answer here is read from Firefox's own record of the add-on**, and the first version of
 * the measurement read that record from the wrong path — `<profile>/extensions/extensions.json`
 * rather than `<profile>/extensions.json` — **and so reported *the add-on was not installed* for a
 * profile where the answer was simply not looked for.**
 *
 * **A reader that matches nothing reports the absence of the thing it looked for**, and that is the
 * shape this repository has recorded more than once. **So this file's reader is proved able to find
 * a record that IS there, before any absence is reported** — the self-test plants a record and
 * requires the reader to find it.
 *
 * ## How to run it
 *
 *     node apps/extension/e2e/firefox-compatibility.mjs
 *
 * **It is not in `package.json`'s scripts**, deliberately: a script name is an invitation, and this
 * one takes minutes per route and answers a question about a platform rather than about this
 * product. It is listed in `QUARANTINED_PROBES`, because **what is quarantined is the script** — a
 * measurement instrument rather than a test.
 *
 * ## What it establishes, and what it does not
 *
 * It establishes **what Firefox did, on this machine, on this build**, and **which route produced
 * that answer**.
 *
 * It establishes **nothing about whether this product should support Firefox.** That is a product
 * decision, and this file's job is to put the decision's inputs in front of whoever makes it.
 */

import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * **Playwright is resolved from the repository**, because this file is a workspace member and a
 * script that cannot resolve the runner it drives measures nothing.
 */
const require = createRequire(import.meta.url);
const { firefox } = require("@playwright/test");

const REPO = join(import.meta.dirname, "..", "..", "..");
const DIST = join(REPO, "apps", "extension", "dist");

// ---------------------------------------------------------------------------------------------
// The eleven capabilities the extension's seam exports, and the platform member each one needs.
//
// **The list is the module's own exports, read from the source rather than retyped**, so it cannot
// drift from what the product actually reaches for -- **and a second spelling of a set is the
// defect this repository records most often.**
// ---------------------------------------------------------------------------------------------

/**
 * **The module's own exported capabilities, read out of its source rather than retyped here.**
 *
 * **A second spelling of a set is the defect this repository records most often**, and a list of
 * eleven names typed into a probe is exactly that — **it would drift from the product the first
 * time the product gained a capability.** So the list below is *checked* against the module's own
 * exports, and the instrument reports any name on either side that the other does not carry.
 */
const exportedCapabilities = (source) =>
  [...source.matchAll(/export function (\w+)\(/g)].map((match) => match[1]);

const PLATFORM_MODULE = join(REPO, "apps", "extension", "src", "extension-platform.ts");

/**
 * Each capability, the platform member it needs, and **how it may be probed**.
 *
 * **`"call"` means a read-only call whose return shape is recorded** — a Promise or not — because
 * **the shape is the half that is easy to miss**: a capability that exists in both namespaces can
 * **fail differently** in them.
 *
 * **`"present"` means the member is an event object or a call with a side effect**, so only its
 * presence is recorded — **and nothing here writes anything.**
 */
const CAPABILITIES = [
  { name: "readChromeLocalArea", member: "storage.local", probe: "call", call: "get" },
  { name: "sendToBackground", member: "runtime.sendMessage", probe: "present" },
  { name: "onExtensionMessage", member: "runtime.onMessage", probe: "present" },
  { name: "findActiveTab", member: "tabs.query", probe: "call", call: "query" },
  { name: "sendToTab", member: "tabs.sendMessage", probe: "present" },
  { name: "onTabActivated", member: "tabs.onActivated", probe: "present" },
  {
    name: "readNotificationPlatform",
    member: "notifications.getAll",
    probe: "call",
    call: "getAll",
  },
  { name: "extensionAssetUrl", member: "runtime.getURL", probe: "call", call: "getURL" },
  { name: "readAlarmPlatform", member: "alarms.getAll", probe: "call", call: "getAll" },
  { name: "onBrowserStart", member: "runtime.onStartup", probe: "present" },
  { name: "onAlarmFired", member: "alarms.onAlarm", probe: "present" },
];

// ---------------------------------------------------------------------------------------------
// A minimal ZIP writer.
//
// **An XPI is a ZIP**, and this script must build one without a dependency -- **and a measuring
// instrument that cannot produce its own fixture measures nothing.** The entries are *stored*, not
// deflated, which Firefox accepts.
// ---------------------------------------------------------------------------------------------

/** The CRC-32 of a buffer, in the form a ZIP entry carries. */
function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

/** A ZIP archive holding the given files, at the archive's root. */
function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [name, contents] of files) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, "utf8");
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // the version needed
    local.writeUInt16LE(0, 6); // the flags
    local.writeUInt16LE(0, 8); // stored, not deflated
    local.writeUInt16LE(0, 10); // the modification time
    local.writeUInt16LE(0x21, 12); // the modification date -- 1980-01-01
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // no extra field

    chunks.push(local, nameBytes, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4); // the version that made it
    header.writeUInt16LE(20, 6); // the version needed
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0x21, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    header.writeUInt16LE(0, 30); // no extra field
    header.writeUInt16LE(0, 32); // no comment
    header.writeUInt16LE(0, 34); // no disk number
    header.writeUInt16LE(0, 36); // no internal attributes
    header.writeUInt32LE(0, 38); // no external attributes
    header.writeUInt32LE(offset, 42);
    central.push(header, nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }

  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBytes, end]);
}

// ---------------------------------------------------------------------------------------------
// Firefox's own record of the add-on.
//
// **The record is at the profile's ROOT** — `<profile>/extensions.json` — and not inside
// `extensions/`. **The first version of this measurement looked in the wrong place**, and the
// wrong place reported an absence that was merely unlooked-for.
// ---------------------------------------------------------------------------------------------

function readAddonRecord(profile) {
  const candidates = [
    join(profile, "extensions.json"),
    join(profile, "extensions", "extensions.json"),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf8"));
      return { record: parsed, path: candidate };
    } catch {
      // **A record that does not parse is not a record**, and the next candidate may be.
    }
  }
  return { record: { addons: [] }, path: null };
}

/**
 * **The reader's self-test: it SHALL find a record that IS there.**
 *
 * **This is the arm that would have caught the wrong path**, and it runs **before** any absence is
 * reported -- because **an absence reported by a reader that cannot find a presence is not a
 * measurement.**
 */
function selfTestTheReader() {
  const probe = mkdtempSync(join(tmpdir(), "ff-reader-"));
  const planted = {
    schemaVersion: 36,
    addons: [{ id: "planted@example.com", uuid: "planted-uuid" }],
  };
  writeFileSync(join(probe, "extensions.json"), JSON.stringify(planted), "utf8");
  const found = readAddonRecord(probe);
  rmSync(probe, { recursive: true, force: true });

  const ok = found.record.addons?.[0]?.uuid === "planted-uuid";
  console.log(`  ${ok ? "PASS" : "FAIL"}  the reader finds a record that is there`);
  console.log(`  ${ok ? "PASS" : "FAIL"}  the reader reports the path it read`);
  return ok && found.path !== null;
}

// ---------------------------------------------------------------------------------------------
// The manifest variants.
//
// **Each is a whole manifest**, because **the shipped manifest cannot be edited in place** -- an
// unknown permission is a manifest error, and the question is *which* of the three asks Firefox
// refuses. **So the three asks are removed one at a time from a whole manifest, and the `bare`
// variant is the positive control**: **Firefox must accept *something*, or no arm of the bisection
// can conclude anything about the manifest.**
// ---------------------------------------------------------------------------------------------

const SHIPPED = JSON.parse(
  readFileSync(join(REPO, "apps", "extension", "static", "manifest.json"), "utf8"),
);

const clone = (value) => JSON.parse(JSON.stringify(value));

/** The shipped manifest with the `sidePanel` permission removed. */
const withoutSidePanelPermission = clone(SHIPPED);
withoutSidePanelPermission.permissions = withoutSidePanelPermission.permissions.filter(
  (permission) => permission !== "sidePanel",
);

/** The shipped manifest with the `side_panel` key removed. */
const withoutSidePanelKey = clone(SHIPPED);
delete withoutSidePanelKey.side_panel;

/** The shipped manifest with an event page in place of the service worker. */
const withEventPage = clone(SHIPPED);
withEventPage.background = { scripts: ["service-worker.js"] };

/** The shipped manifest with all three asks adapted. */
const firefoxShaped = clone(SHIPPED);
firefoxShaped.permissions = firefoxShaped.permissions.filter(
  (permission) => permission !== "sidePanel",
);
delete firefoxShaped.side_panel;
firefoxShaped.background = { scripts: ["service-worker.js"] };

/** **The positive control**: the smallest manifest Firefox could possibly accept. */
const bare = {
  manifest_version: 3,
  name: "SpectreMail",
  version: "0.1.0",
  description: "A disposable email address you can read without leaving the page you are on.",
  permissions: ["storage"],
  background: { scripts: ["service-worker.js"] },
};

/**
 * **The same manifest with a gecko add-on id.**
 *
 * **Firefox requires an explicit add-on id for an MV3 extension**, and the manifest the product
 * ships **has none** — so this arm exists to separate two very different findings: *Firefox refuses
 * this manifest* and *Firefox refuses any extension that does not name itself*.
 */
const GECKO_ID = { gecko: { id: "spectre-mail@example.com" } };

const bareWithGeckoId = { ...clone(bare), browser_specific_settings: clone(GECKO_ID) };
const firefoxShapedWithGeckoId = {
  ...clone(firefoxShaped),
  browser_specific_settings: clone(GECKO_ID),
};
const shippedWithGeckoId = { ...clone(SHIPPED), browser_specific_settings: clone(GECKO_ID) };

const VARIANTS = [
  { name: "bare-with-gecko-id", note: "the positive control, named", manifest: bareWithGeckoId },
  {
    name: "firefox-shaped-with-gecko-id",
    note: "all three asks adapted, and named",
    manifest: firefoxShapedWithGeckoId,
  },
  {
    name: "shipped-with-gecko-id",
    note: "the shipped manifest, named",
    manifest: shippedWithGeckoId,
  },
  { name: "bare", note: "the positive control, unnamed", manifest: bare },
  { name: "firefox-shaped", note: "all three asks adapted", manifest: firefoxShaped },
  {
    name: "shipped-minus-sidePanel-permission",
    note: "one ask removed",
    manifest: withoutSidePanelPermission,
  },
  { name: "shipped-minus-side_panel-key", note: "one ask removed", manifest: withoutSidePanelKey },
  { name: "shipped-with-event-page", note: "one ask adapted", manifest: withEventPage },
  { name: "shipped", note: "the manifest as the product ships it", manifest: SHIPPED },
];

// ---------------------------------------------------------------------------------------------
// The routes.
// ---------------------------------------------------------------------------------------------

/**
 * **Route one: the profile carries the add-on, with the record hand-written.**
 *
 * **This route is what a repository would reach for first**, because it is the cheapest.
 */
async function routeProfile(manifest) {
  const profile = mkdtempSync(join(tmpdir(), "ff-profile-"));
  const extensionsDir = join(profile, "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  writeFileSync(
    join(extensionsDir, "extensions.json"),
    JSON.stringify({
      schemaVersion: 36,
      marker: "WRITTEN-BY-THIS-MEASUREMENT",
      addons: [
        {
          id: "spectre-mail@example.com",
          path: DIST,
          location: "temporary-addon",
          active: true,
          signedState: "signed",
          userDisabled: false,
          appDisabled: false,
          foreignInstall: true,
        },
      ],
    }),
    "utf8",
  );
  return { profile, manifest, mechanism: "a profile carrying the add-on" };
}

/**
 * **Route two: an unsigned XPI, with signatures not required.**
 *
 * **This is the route a developer would take**, and the one a build could rely on — and it is the
 * route the manifest is *inside*, so it is the only route that can answer the manifest's question.
 */
async function routeXpi(manifest) {
  const profile = mkdtempSync(join(tmpdir(), "ff-xpi-"));
  const extensionsDir = join(profile, "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  writeFileSync(
    join(profile, "user.js"),
    [
      'user_pref("xpinstall.signatures.required", false);',
      'user_pref("extensions.autoDisableScopes", 0);',
      'user_pref("extensions.enabledScopes", 15);',
      'user_pref("xpinstall.signatures.enforced", false);',
      "",
    ].join("\n"),
    "utf8",
  );

  // **The extension's own build with the manifest swapped for this variant's.**
  const files = [];
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory)) {
      const absolute = join(directory, entry);
      const relative = prefix === "" ? entry : `${prefix}/${entry}`;
      if (statSync(absolute).isDirectory()) walk(absolute, relative);
      else if (entry !== "manifest.json") files.push([relative, readFileSync(absolute)]);
    }
  };
  walk(DIST, "");
  files.unshift(["manifest.json", JSON.stringify(manifest, null, 2)]);

  writeFileSync(join(extensionsDir, "spectre-mail@example.com.xpi"), buildZip(files));
  return { profile, manifest, mechanism: "an unsigned XPI with signatures not required" };
}

// ---------------------------------------------------------------------------------------------
// The capability probe, run in the extension's own context.
// ---------------------------------------------------------------------------------------------

const CAPABILITY_PROBE = (capabilities) => {
  const resolve = (namespace, member) =>
    member
      .split(".")
      .reduce((held, part) => (held === undefined ? undefined : held[part]), namespace);

  const record = (namespaceName, namespace) => {
    const out = {};
    for (const capability of capabilities) {
      const target = resolve(namespace, capability.member);
      const entry = { present: target !== undefined && target !== null, shape: "unknown" };
      if (capability.probe === "call" && entry.present && typeof target === "function") {
        try {
          const returned =
            capability.call === "get"
              ? target([])
              : capability.call === "getURL"
                ? target("/")
                : capability.call === "query"
                  ? target({ active: true, currentWindow: true })
                  : target();
          entry.shape =
            returned && typeof returned.then === "function" ? "promise" : "not-a-promise";
        } catch (error) {
          entry.shape = `threw: ${String(error).split("\n")[0].slice(0, 80)}`;
        }
      }
      out[capability.name] = entry;
    }
    return out;
  };

  return {
    browserNamespace: typeof globalThis.browser,
    chromeNamespace: typeof globalThis.chrome,
    browser: record("browser", globalThis.browser),
    chrome: record("chrome", globalThis.chrome),
  };
};

// ---------------------------------------------------------------------------------------------
// The run.
// ---------------------------------------------------------------------------------------------

async function installAndReport(variant, route) {
  const { profile } = await route(variant.manifest);
  const outcome = {
    variant: variant.name,
    note: variant.note,
    mechanism: null,
    installed: false,
    uuid: null,
    capabilities: null,
  };

  try {
    const context = await firefox.launchPersistentContext(profile, {
      headless: true,
      timeout: 120000,
    });
    outcome.mechanism = "Firefox started";

    const { record, path } = readAddonRecord(profile);
    const addon = (record.addons ?? []).find((entry) => entry.id === "spectre-mail@example.com");
    outcome.recordPath = path === null ? "(no record)" : path.replace(profile, "<profile>");
    outcome.addonFound = addon !== undefined;
    outcome.uuid = addon?.uuid ?? null;
    outcome.appDisabled = addon?.appDisabled ?? null;
    outcome.signedState = addon?.signedState ?? null;
    outcome.installed = Boolean(addon?.uuid);
    /** **How many add-ons Firefox's own record holds**, and **whether it is still the one this
     * script wrote** — because a record Firefox rewrote is a record Firefox *looked at*. */
    outcome.recordAddonCount = (record.addons ?? []).length;
    outcome.recordIsMine = JSON.stringify(record).includes("WRITTEN-BY-THIS-MEASUREMENT");

    /**
     * **Whether the preference this route set actually took effect.**
     *
     * **Firefox writes the preferences it ended up with into `prefs.js`**, and the route's whole
     * premise is one preference — `xpinstall.signatures.required` — being off. **So a route
     * whose preference did not take is a route that never had a chance**, and that is a fact
     * about the route rather than about Firefox. **It is read from Firefox's own file, not
     * assumed from the file this script wrote.**
     */
    const prefsPath = join(profile, "prefs.js");
    if (existsSync(prefsPath)) {
      const prefs = readFileSync(prefsPath, "utf8");
      const required = prefs.match(
        /user_pref\("xpinstall\.signatures\.required",\s*(true|false)\)/,
      );
      outcome.signaturesRequired = required === null ? "(not present)" : required[1];
    } else {
      outcome.signaturesRequired = "(no prefs.js)";
    }

    if (outcome.installed) {
      const page = await context.newPage();
      const url = `moz-extension://${addon.uuid}/popup.html`;
      try {
        await page.goto(url, { timeout: 30000 });
        outcome.pageUrl = url;
        outcome.capabilities = await page.evaluate(CAPABILITY_PROBE, CAPABILITIES);
      } catch (error) {
        outcome.pageError = String(error).split("\n")[0];
      }
    }

    await context.close();
  } catch (error) {
    outcome.mechanism = `Firefox refused to start: ${String(error).split("\n")[0]}`;
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }

  return outcome;
}

console.log("=== 0. the reader's self-test");
if (!selfTestTheReader()) {
  console.log("");
  console.log("HARNESS-ERROR: the reader could not find a record that was planted, so no absence");
  console.log("  reported below would be a measurement.");
  process.exit(2);
}

console.log("");
console.log("=== 0.5 the eleven capabilities, checked against the product's own source");
const moduleExports = exportedCapabilities(readFileSync(PLATFORM_MODULE, "utf8"));
const listed = CAPABILITIES.map((capability) => capability.name);
const uncovered = moduleExports.filter((name) => !listed.includes(name));
const extra = listed.filter((name) => !moduleExports.includes(name));
console.log(`  the platform module exports ${moduleExports.length}: ${moduleExports.join(", ")}`);
console.log(`  this instrument lists ${listed.length}`);
if (uncovered.length > 0 || extra.length > 0) {
  console.log(`  HARNESS-ERROR: the instrument and the module disagree.`);
  if (uncovered.length > 0)
    console.log(`    the module exports this probe does not list: ${uncovered.join(", ")}`);
  if (extra.length > 0)
    console.log(`    this probe lists what the module does not export: ${extra.join(", ")}`);
  console.log("  **A list typed twice is a second spelling of a set, and it drifts.**");
  process.exit(2);
}
console.log("  the two lists agree, name for name.");

console.log("");
console.log("=== 1. the routes, each manifest variant over the route that can reach an install");
const outcomes = [];
for (const variant of VARIANTS) {
  // **The XPI route, for every variant.** It is the only route whose manifest is inside the
  // add-on, so it is the only one that can answer the manifest's question.
  const outcome = await installAndReport(variant, routeXpi);
  outcomes.push(outcome);
  console.log(
    `  ${outcome.installed ? "INSTALLED" : "not installed"}  ${variant.name.padEnd(34)} ${outcome.uuid ?? "(no uuid)"}  record holds ${outcome.recordAddonCount} add-on(s)  signatures.required=${outcome.signaturesRequired}`,
  );
}

// **The profile route, once, for the positive control** — because **a route that fails is a fact
// about that route and not about Firefox**, and this route's failure has a measured cause:
// **Firefox rewrites its own record at startup, so a hand-written one is discarded.**
{
  const outcome = await installAndReport(VARIANTS[0], routeProfile);
  outcomes.push(outcome);
  console.log(
    `  ${outcome.installed ? "INSTALLED" : "not installed"}  ${"profile route, positive control".padEnd(34)} ${outcome.uuid ?? "(no uuid)"}  the record is still this script's own: ${outcome.recordIsMine}`,
  );
}

const installed = outcomes.filter((outcome) => outcome.installed);
console.log("");
console.log(`=== 2. the result: ${installed.length} of ${outcomes.length} arms installed`);

if (installed.length > 0) {
  const best = installed[0];
  console.log("");
  console.log(`=== 3. the eleven capabilities, in ${best.variant}'s own context`);
  console.log(`  browser namespace: ${best.capabilities.browserNamespace}`);
  console.log(`  chrome namespace:  ${best.capabilities.chromeNamespace}`);
  console.log("");
  console.log("  capability                        browser                     chrome");
  for (const capability of CAPABILITIES) {
    const b = best.capabilities.browser[capability.name];
    const c = best.capabilities.chrome[capability.name];
    console.log(
      `  ${capability.name.padEnd(32)} ${(b.present ? "present" : "ABSENT").padEnd(9)} ${b.shape.padEnd(16)} ${(c.present ? "present" : "ABSENT").padEnd(9)} ${c.shape}`,
    );
  }
} else {
  console.log("");
  console.log("=== 3. the eleven capabilities: NOT MEASURABLE HERE");
  console.log("  No variant installed, so no extension context existed to probe.");
  console.log(
    "  **That is a measurement of this machine's reach, not of Firefox's capabilities.**",
  );
}

console.log("");
console.log("=== 4. the record");
writeFileSync(
  join(tmpdir(), "firefox-compatibility-report.json"),
  JSON.stringify({ outcomes, capabilities: CAPABILITIES }, null, 2),
  "utf8",
);
console.log(`  written to ${join(tmpdir(), "firefox-compatibility-report.json")}`);
