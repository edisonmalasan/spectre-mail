/**
 * The side-panel probe's worker.
 *
 * ## What it is for
 *
 * Four questions have never been asked of a panel context by this repository, and each of them has
 * a branch where the answer decides whether M11's side panel can be built at all:
 *
 *   (a) can a panel-hosted document find the active tab,
 *   (b) can it learn the host the page is on, and at what permission cost,
 *   (c) does it follow a tab switch without the `tabs` permission,
 *   (d) what Playwright can observe about a docked panel.
 *
 * `chrome.sidePanel` is reachable only from a context whose manifest declares the `sidePanel`
 * permission and a `side_panel` key, so a measurement needs a worker of its own. This is exactly the
 * arrangement `notification-probe/probe.js` uses for `chrome.notifications` and `alarm-probe` for
 * `chrome.alarms`, for the same reason: **the instrument that answers a question may need rights the
 * product must not have yet.** The shipped extension holds neither permission, and D9 requires that
 * it does not acquire them through this change.
 *
 * ## Why it is plain ESM JavaScript rather than TypeScript
 *
 * Because **it is not built.** Nothing compiles `e2e/fixtures/`, and a fixture that had to go
 * through a build to exist would be one more thing that can be stale when the measurement runs - the
 * exact failure `archive-bytes.mjs` recorded, where the sources were restored and the artefact two
 * seconds older survived.
 *
 * ## Why the platform is spelled directly and not reflected from `globalThis`
 *
 * `apps/extension/src` has no `@types/chrome`, so shipped code reaches the platform through
 * `Reflect.get(globalThis, "chrome")` in `extension-platform.ts`. **That reasoning does not reach a
 * fixture.** The boundary rule confining the platform global is `chromeGlobalViolationsIn(join(APPS_DIR,
 * "extension", "src"))` - `apps/extension/src` and nothing else - and the three existing fixtures
 * all spell `chrome.*` directly. Reflecting here would be ceremony against a rule never pointed at
 * this file, and it would leave this the fourth fixture written in a different style from the other
 * three.
 *
 * ## What this worker publishes, and why on `self`
 *
 * The driver reads this surface with `worker.evaluate(...)`, the same handle
 * `helpers/background-state.ts` already uses for the shipped worker. **The driver and this worker
 * are in different processes**, which is what makes this a readback rather than a function call, and
 * is why task 2.4 requires the channel to be proven before any arm is trusted: **a channel that
 * reads nothing back makes every later arm's empty answer ambiguous** - absent API, absent panel,
 * and broken readback all print the same thing.
 *
 * ## Why the panel's report is written to `chrome.storage.local` and not returned
 *
 * Because the panel is **a different document in a different context**, and the worker may be asleep
 * while it loads. A panel report that had to survive the document that wrote it, and be read back
 * afterwards from a surface the driver already owns, cannot be confused with the worker's own
 * answers. The alarms probe records the opposite choice and the reason it was right there - every
 * value resolved before the driver read it - and this probe has one value that does not resolve
 * before the driver would read it: **the panel's**, because nothing knows when the panel loaded.
 *
 * ## What it deliberately does not do
 *
 * It does not decide whether a panel was **seen**. Nothing here can observe a docked panel's pixels,
 * and a headless Chromium has no side panel UI at all. Task 4.6 runs the recorded substitute and
 * says so in the run's own output rather than in a comment.
 */

const PROBE_KEY = "__spectreSidePanelProbe";

/**
 * Where a panel-hosted document publishes its report.
 *
 * **`storage` is declared so this survives the document that wrote it.** A report held in a panel's
 * own `globalThis` would be unreachable the moment that document unloaded, which is the normal case
 * for a panel beside a page that navigates - and the run's arm (d) needs the panel's first report to
 * outlive its own window.
 */
const PANEL_REPORT_KEY = "__spectreSidePanelPanelReport";

/** Where the launcher's own outcome is published, so "the gesture was accepted" is not an inference. */
const LAUNCH_REPORT_KEY = "__spectreSidePanelLaunchReport";

/** A panel report carries the fixture page's origin, so the driver can tell one visit from the next. */
const RUN_ID_KEY = "__spectreSidePanelRunId";

/** One serial number, so a second read of the panel is not indistinguishable from the first. */
let reportSequence = 0;

/**
 * Whether this context has the API at all, read rather than inferred from the manifest.
 *
 * **This is arm (a)'s first observation and D4's control requirement.** A declared permission and an
 * API that exists are different facts, and this repository does not cite one for the other. The
 * control variant declares neither `sidePanel` nor `side_panel`, so `hasSidePanelApi` is the reading
 * that makes every later arm attributable.
 */
function apiReport() {
  const sidePanel = chrome.sidePanel;

  return {
    hasSidePanelApi: typeof sidePanel !== "undefined",
    hasOpen: typeof sidePanel?.open === "function",
    hasGetPanelState: typeof sidePanel?.getPanelState === "function",
    hasSetPanelBehavior: typeof sidePanel?.setPanelBehavior === "function",
    hasTabsApi: typeof chrome.tabs !== "undefined",
    hasWindowsApi: typeof chrome.windows !== "undefined",
    declaredPermissions: chrome.runtime.getManifest().permissions ?? [],
    declaredSidePanelKey: chrome.runtime.getManifest().side_panel ?? null,
  };
}

/** Read the run id the driver set before opening anything, so a report can be attributed to an arm. */
async function runId() {
  const held = await chrome.storage.local.get(RUN_ID_KEY);
  return held[RUN_ID_KEY] ?? null;
}

/** Set the run id. The driver calls this once per arm, before the gesture. */
function setRunId(value) {
  return chrome.storage.local.set({ [RUN_ID_KEY]: value });
}

/** How many times a panel has reported, so a second read is distinguishable from the first. */
async function panelReportCount() {
  const held = await chrome.storage.local.get(PANEL_REPORT_KEY);
  return held[PANEL_REPORT_KEY]?.sequence ?? 0;
}

/**
 * The panel's report, as the worker read it.
 *
 * **Read through the worker's own API rather than from the driver**, so the storage round trip the
 * answer depends on is the same round trip the extension's own code would make. The driver reading
 * `chrome.storage` directly would prove the driver can read storage, not that the worker's answer is
 * reachable.
 */
async function panelReport() {
  const held = await chrome.storage.local.get(PANEL_REPORT_KEY);
  return held[PANEL_REPORT_KEY] ?? null;
}

/** The launcher's outcome, or `null` when nothing has reported. */
async function launchReport() {
  const held = await chrome.storage.local.get(LAUNCH_REPORT_KEY);
  return held[LAUNCH_REPORT_KEY] ?? null;
}

/** Forget every record this probe wrote, so one arm cannot be reported as another's. */
function reset() {
  reportSequence = 0;
  return chrome.storage.local.remove([PANEL_REPORT_KEY, LAUNCH_REPORT_KEY]);
}

/**
 * Read the panel's own state for a window, where the platform offers the query.
 *
 * **`getPanelState` is a separate question from `open` succeeding**, and D4 requires both to be
 * recorded: an extension can be told its panel opened while the platform reports the window closed.
 */
function panelState(windowId) {
  return new Promise((resolve) => {
    if (typeof chrome.sidePanel?.getPanelState !== "function") {
      resolve({ api: false, state: null, threw: null });
      return;
    }
    try {
      chrome.sidePanel.getPanelState({ windowId }, (state) => {
        resolve({ api: true, state: state ?? null, threw: null });
      });
    } catch (cause) {
      resolve({ api: true, state: null, threw: String(cause) });
    }
  });
}

/**
 * Open the panel, and record what the call itself said.
 *
 * **The return value is arm (d)'s "panel opened" observation and it is recorded on its own.** The
 * panel's own report is the "panel saw" observation, and D4 requires the two to be separate fields
 * in the run's output: a run holding only the first would be satisfied by a platform that accepted
 * an `open()` and mounted nothing, which is the recorded failure of a resolved callback being read
 * as an observation.
 */
function openPanel({ windowId, tabId }) {
  return new Promise((resolve) => {
    if (typeof chrome.sidePanel?.open !== "function") {
      resolve({ api: false, opened: null, threw: null, reason: "no chrome.sidePanel.open" });
      return;
    }
    try {
      chrome.sidePanel.open({ windowId, tabId }, () => {
        // **Read through `chrome.runtime.lastError` rather than the callback's argument**, because
        // this API's callback takes no value and the failure would otherwise be silent. A worker
        // that reported success here would be reading an absence of evidence as evidence.
        const lastError = chrome.runtime.lastError;
        resolve({
          api: true,
          opened: lastError ? null : true,
          threw: null,
          reason: lastError?.message ?? null,
        });
      });
    } catch (cause) {
      resolve({ api: true, opened: null, threw: String(cause), reason: null });
    }
  });
}

/** Bump and hand back the panel-report sequence, so a second read is provably a second read. */
function nextReportSequence() {
  reportSequence += 1;
  return reportSequence;
}

/**
 * Ask the panel to do something, and return what it said.
 *
 * **`chrome.runtime.sendMessage` is the only channel from here to the panel**, and it reaches every
 * extension context including one Playwright has no handle for - which is what makes D5's third read
 * possible at all.
 *
 * **An empty or missing panel is an answer here rather than a throw.** `sendMessage` rejects with
 * *"Could not establish connection"* when nothing is listening, and that rejection **is the reading
 * for every arm where the panel did not load**: the distinction between "the panel refused" and
 * "there was no panel" is the distinction D4 exists to keep.
 */
async function askPanel(action, payload) {
  try {
    const answer = await chrome.runtime.sendMessage({ action, payload: payload ?? null });
    return { delivered: true, answer: answer ?? null, reason: null, threw: null };
  } catch (cause) {
    const lastError = chrome.runtime.lastError;
    return {
      delivered: false,
      answer: null,
      reason: lastError?.message ?? null,
      threw: lastError ? null : String(cause),
    };
  }
}

/**
 * How long to wait for a panel report that is expected to arrive.
 *
 * **Published on the probe surface rather than written down in the driver**, for the reason
 * `notification-display.mjs` records in its own header: a second spelling of a settle time is a
 * number that drifts from the one it is supposed to describe, and the driver here would be
 * reporting a wait it never made.
 *
 * **It is a bounded wait and not a synchronisation**, and the value is printed in the run's output
 * so a reader can see how much a late panel could have been missed by.
 */
const PANEL_REPORT_WAIT_MS = 5_000;

self[PROBE_KEY] = {
  PROBE_KEY,
  PANEL_REPORT_KEY,
  LAUNCH_REPORT_KEY,
  RUN_ID_KEY,
  PANEL_REPORT_WAIT_MS,
  apiReport,
  askPanel,
  launchReport,
  nextReportSequence,
  openPanel,
  panelReport,
  panelReportCount,
  panelState,
  reset,
  runId,
  setRunId,
};

self.addEventListener("install", () => {
  // Intentionally empty. This worker is a scope with a probe surface, not a product.
});

self.addEventListener("activate", () => {
  // Intentionally empty.
});
