/**
 * The gesture page for `chrome.sidePanel.open()`.
 *
 * ## Why the outcome is written to storage rather than read from the page
 *
 * **Because the driver can read the page and this makes the two independent.** The `data-testid`
 * paragraph is what a reader of the run's output would believe, and the storage record is what the
 * worker's readback returns; if they disagree, one of them is stale. They are recorded separately
 * for the same reason D4 records "panel opened" and "panel saw" separately.
 *
 * ## Why the error is read rather than assumed
 *
 * `open()` takes a callback that carries no value, and a failed open surfaces only through
 * `chrome.runtime.lastError`. **A page that ignored `lastError` would render "opened" for a call the
 * platform refused**, which is precisely the recorded failure of a resolved callback being read as
 * an observation - and here it would be worse, because the page would then look like the panel's own
 * report arrived after it.
 */

const LAUNCH_REPORT_KEY = "__spectreSidePanelLaunchReport";

const button = document.getElementById("open");
const outcome = document.getElementById("outcome");

/**
 * Describe the window this page is in, so the driver does not have to guess what it clicked.
 *
 * **`chrome.windows.getCurrent()` needs no permission**, so this works in the control variant too,
 * which is what makes it usable as the one reading available when `chrome.sidePanel` is absent.
 */
async function currentWindow() {
  try {
    const current = await chrome.windows.getCurrent();
    return current ? { id: current.id, type: current.type, focused: current.focused } : null;
  } catch (cause) {
    return { threw: String(cause) };
  }
}

button.addEventListener("click", async () => {
  const window = await currentWindow();

  let opened = null;
  let threw = null;
  let reason = null;
  let api = typeof chrome.sidePanel?.open === "function";

  if (!api) {
    reason = "chrome.sidePanel.open is not present in this context";
    outcome.textContent = reason;
  } else {
    try {
      opened = await new Promise((resolve) => {
        chrome.sidePanel.open({ windowId: window.id }, () => {
          const lastError = chrome.runtime.lastError;
          resolve(lastError ? null : true);
        });
      });
      if (opened === null) {
        reason = chrome.runtime.lastError?.message ?? "open() reported no error and opened nothing";
        outcome.textContent = `refused: ${reason}`;
      } else {
        outcome.textContent = "opened";
      }
    } catch (cause) {
      threw = String(cause);
      reason = threw;
      outcome.textContent = `threw: ${threw}`;
    }
  }

  // **Written even on the failing paths.** A gesture that opened nothing is an observation, and a
  // driver that could only see success would report "the panel did not open" for a call that was
  // never made - which is what "measured nothing" looks like from the outside.
  await chrome.storage.local.set({
    [LAUNCH_REPORT_KEY]: {
      api,
      opened,
      threw,
      reason,
      window,
      // **`performance.now()` rather than `Date.now()`**, because the driver cares about the order
      // of the launch and the panel's first report and a wall clock is not comparable across two
      // contexts without a shared epoch assumption.
      at: Math.round(performance.now()),
      outcomeText: outcome.textContent,
    },
  });
});
