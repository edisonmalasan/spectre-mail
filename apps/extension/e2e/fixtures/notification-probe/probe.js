/**
 * The notification probe's worker.
 *
 * ## What it is for
 *
 * `chrome.notifications` is reachable only from a context whose manifest declares the
 * `notifications` permission, and the shipped extension deliberately does not. So a measurement
 * needs a worker of its own, and this file is it - exactly the arrangement `alarm-probe/probe.js`
 * uses for `chrome.alarms`, and for the same reason: **the instrument that answers a question may
 * need rights the product must not have.**
 *
 * **It exists because the icon question is unobserved, and it is the largest assumption in
 * `incoming-mail-notification`.** The extension ships no icon of any kind - `static/` holds only
 * `manifest.json` - and whether Chromium will display a notification from an unpacked extension at
 * all, and whether it insists on an `iconUrl`, is not something this repository has ever asked.
 * `design.md` D12 names three branches and this worker is what chooses between them.
 *
 * ## Why it is plain ESM JavaScript rather than TypeScript
 *
 * Because **it is not built.** Nothing compiles `e2e/fixtures/`, and a fixture that had to go
 * through a build to exist would be one more thing that can be stale when the measurement runs -
 * the exact failure `archive-bytes.mjs` recorded, where the sources were restored and the artefact
 * two seconds older survived.
 *
 * ## Why `create` being called is not the observation
 *
 * **`chrome.notifications.create` takes a callback, and a resolved callback is a weak signal.** It
 * reports that the request was *accepted*, not that anything was shown, and a platform that accepted
 * a request it cannot display would resolve the same callback. So every attempt here records
 * **three** things - what the callback resolved, whether `onError` fired, and whether the
 * notification id appears in `chrome.notifications.getAll()` - because the second and third can
 * disagree with the first and the disagreement is the finding.
 *
 * **The third is the one that could be vacuous**, which is why this worker carries a reader control
 * of its own: `listOne` is also called with an id that was never created. A reader that answered for
 * every id would satisfy every "it was displayed" claim above it for ever.
 *
 * ## Why the record is written at all
 *
 * The driver collects what this worker returns directly, so nothing here needs to outlive the run.
 * It is published on `self` rather than written to `chrome.storage.local` because **there is
 * nothing asynchronous to survive a worker termination** - unlike the alarms probe, every value
 * this one produces is resolved before the driver reads it. Recording a lesson that does not apply
 * would be the same padding this repository records elsewhere as noise.
 *
 * ## What it deliberately does not do
 *
 * It does not decide whether a notification was **seen**. Nothing in this file or the driver can
 * observe an operating system's notification centre, and a headless Chromium has none. The strongest
 * claim this measurement supports is therefore about *acceptance and registration*, and the driver
 * says so in its own output rather than letting a reader infer display from a resolved callback.
 */

/** Where this worker publishes its probe surface, so the driver never has to spell it twice. */
const PROBE_KEY = "__spectreNotificationProbe";

/**
 * How long to wait after a callback resolves before believing nothing else is coming.
 *
 * `onError` is documented as firing around the creation attempt rather than strictly before the
 * callback, so reading errors immediately after the callback can observe a clean sheet for a
 * notification that failed a moment later. This is a **bounded wait**, not a synchronization, and
 * the driver records the value it used so a reader can see how much this could have missed.
 */
const ERROR_SETTLE_MS = 1_500;

/** What every attempt is titled, so an id in `getAll()` can be told apart from anything else. */
const TITLE = "SpectreMail probe";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Every id this worker created, so cleanup does not depend on the driver remembering them.
 *
 * **Tracked here rather than passed back one at a time**, because an id the driver forgot to clear
 * would sit in `getAll()` and be reported by the next arm as one of its own.
 */
const created = new Set();

/** Clear one notification, and report whether the platform had it. Used as a reader control too. */
function clearOne(id) {
  return new Promise((resolve) => {
    try {
      chrome.notifications.clear(id, (wasCleared) => {
        created.delete(id);
        resolve({ id, wasCleared: Boolean(wasCleared), threw: null });
      });
    } catch (cause) {
      created.delete(id);
      resolve({ id, wasCleared: null, threw: String(cause) });
    }
  });
}

/** Every notification id the platform currently holds. */
function listAll() {
  return new Promise((resolve) => {
    try {
      chrome.notifications.getAll((all) => {
        // **`getAll` hands back an object keyed by id.** Reading it as anything else would make
        // `in` answer for a key that is not there, so it is normalised here rather than in the
        // driver, and the driver reads `Object.keys`.
        resolve({ ids: Object.keys(all ?? {}), threw: null });
      });
    } catch (cause) {
      resolve({ ids: [], threw: String(cause) });
    }
  });
}

/**
 * Create one notification and record three independent observations of the outcome.
 *
 * **The three are recorded together on purpose.** A single observation is a single hypothesis:
 * "the callback resolved" says the request was accepted, `onError` says it was rejected, and
 * `getAll` says the platform believes it is holding one. D12's three branches differ in which of
 * these moves, so a run that recorded only one of them could not choose between them.
 */
async function attempt(request) {
  const { id, iconUrl } = request;

  /** Errors seen for this attempt, and for any other id, so a stray can be told from ours. */
  const seen = [];

  // **`onError` is looked up rather than assumed, because this run has already found it absent.**
  //
  // `chrome.notifications.onError` is documented for the callback API, and on the Chromium this
  // measurement ran against it is **undefined** - so a worker that added a listener to it threw
  // `Cannot read properties of undefined (reading 'addListener')` before creating anything. That
  // absence is a finding about the platform, not a defect in the fixture, so it is recorded on the
  // attempt and the attempt proceeds.
  //
  // **The consequence is stated rather than papered over**: with no `onError` there is no
  // rejection channel, so "accepted" and "registered" are the only two observations available, and
  // a silent failure is indistinguishable from a notification that worked. The driver says so.
  const hasOnError = typeof chrome.notifications.onError?.addListener === "function";
  const onError = (errorId, error) => {
    seen.push({
      id: errorId ?? null,
      message: error?.message ?? String(error),
    });
  };
  if (hasOnError) {
    chrome.notifications.onError.addListener(onError);
  }

  const options = { type: "basic", title: TITLE, message: "probe", iconUrl };
  if (iconUrl === null) {
    // **The absent-icon arm has to omit the key rather than send an empty one.** `iconUrl: ""` is a
    // different request from no `iconUrl`, and an arm that cannot express the thing it is measuring
    // measures a neighbour of it.
    delete options.iconUrl;
  }

  let resolved = null;
  let threw = null;
  try {
    resolved = await new Promise((resolve) => {
      chrome.notifications.create(id, options, (createdId) => resolve(createdId ?? null));
    });
  } catch (cause) {
    threw = String(cause);
  }

  await sleep(ERROR_SETTLE_MS);
  if (hasOnError) {
    chrome.notifications.onError.removeListener(onError);
  }

  const listed = await listAll();
  created.add(id);

  return {
    id,
    iconUrl: iconUrl === null ? "(none)" : iconUrl,
    hasOnError,
    resolvedId: resolved,
    callbackThrew: threw,
    errors: seen,
    listedIds: listed.ids,
    listedThrew: listed.threw,
    isListed: listed.ids.includes(id),
  };
}

/**
 * What this context can see about itself, read rather than assumed.
 *
 * **`chrome.permissions.getAll()` is the instrument for task 1.2**, and it is read here rather than
 * inferred from the manifest: a declared permission and a granted one are different facts, and this
 * repository does not cite one for the other.
 */
function selfReport() {
  const declared = chrome.runtime.getManifest().permissions ?? [];
  const granted = chrome.permissions.getAll
    ? { api: true, value: null }
    : { api: false, value: null };

  return {
    hasNotificationsApi: typeof chrome.notifications !== "undefined",
    hasCreate: typeof chrome.notifications?.create === "function",
    hasGetAll: typeof chrome.notifications?.getAll === "function",
    hasClear: typeof chrome.notifications?.clear === "function",
    // **Recorded because this run measured it absent**, and a caller that assumed an error channel
    // existed would write a rejection path this Chromium can never take.
    hasOnError: typeof chrome.notifications?.onError?.addListener === "function",
    hasPermissionsApi: granted.api,
    declaredPermissions: declared,
    // **Left unresolved on purpose.** `getAll` is asynchronous and this function is synchronous, so
    // the driver reads permissions through `permissions()` below rather than having a placeholder
    // here that looks like an answer.
    grantedPermissions: null,
    createdIds: [...created],
  };
}

async function permissions() {
  if (!chrome.permissions?.getAll) {
    return { api: false, permissions: null, origins: null };
  }
  const held = await chrome.permissions.getAll();
  return {
    api: true,
    permissions: [...(held.permissions ?? [])].sort(),
    origins: [...(held.origins ?? [])].sort(),
  };
}

self[PROBE_KEY] = {
  attempt,
  clearOne,
  listAll,
  permissions,
  selfReport,
  errorSettleMs: ERROR_SETTLE_MS,
};

self.addEventListener("install", () => {
  // Intentionally empty. This worker is a scope with a probe surface, not a product.
});

self.addEventListener("activate", () => {
  // Intentionally empty.
});
