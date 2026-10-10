/**
 * The alarms probe's worker.
 *
 * ## What it is for
 *
 * `chrome.alarms` is reachable only from a context whose manifest declares the `alarms`
 * permission, and the shipped extension deliberately does not. So a measurement needs a
 * worker of its own, and this file is it. `alarm-floor.spec.ts` asks it what the API
 * *stores*; `alarms-packing.mjs` asks it what Chromium *fires*.
 *
 * **Those are different questions and the second is the one that was open.** A stored
 * period is a value the API accepted; a firing is an event the platform delivered. No
 * amount of reading `getAll()` answers the second.
 *
 * Written as plain ESM JavaScript rather than TypeScript because **it is not built.**
 * Nothing compiles `e2e/fixtures/`, and a fixture that had to go through a build to
 * exist would be one more thing that can be stale when the measurement runs — the exact
 * failure `archive-bytes.mjs` recorded, where the sources were restored and the artefact
 * two seconds older survived.
 *
 * ## Why this worker has behaviour, when it used to have none
 *
 * **The earlier version of this file said it was "a scope, not a program", and that was
 * true of it.** It now records firings, so that sentence is corrected here rather than
 * left describing a file that no longer matches it. What did *not* change is the
 * quarantine: this fixture ships no user-facing surface, and the `install`/`activate`
 * listeners below are still empty — the worker is still a scope, it simply also keeps a
 * record now.
 *
 * ## Why the record lives in `chrome.storage.local` and not in an array
 *
 * **This is the decision the measurement turns on.** If the worker is terminated between
 * two firings, a module-scope array is silently truncated — and a truncated record looks
 * exactly like *"the alarm stopped firing"*, which is a completely different finding that
 * would be written down as a measurement. So the record is persisted, where a worker
 * restart cannot take it with it.
 *
 * That is the whole reason the fixture's manifest also declares `storage`. It is still a
 * throwaway fixture: **the instrument that answers a question may need rights the product
 * must not have**, and `static/manifest.json` declares `["storage"]` alone.
 *
 * ## Why each firing carries the identity of the worker that saw it
 *
 * `WORKER_ID` is generated at module scope, so every fresh worker load has its own, and
 * a run can tell a platform *cadence* apart from a platform *lifecycle*: "the alarm fired
 * every 30 s" and "the alarm fired every 5 s but the worker was terminated and the next
 * delivered event arrived at 30 s" produce different records under this stamp and the same
 * record without it.
 */

/** Where the firings are accumulated. Namespaced so it cannot collide with anything real. */
const RECORD_KEY = "spectre.alarmsPacking.record";

/**
 * This worker load's identity, fixed for the life of the load.
 *
 * **At module scope, deliberately, and not inside the listener** — a listener that
 * generated its own id would stamp every firing with the same value and record nothing
 * about restarts, which is the one thing the stamp exists to show.
 */
const WORKER_ID = crypto.randomUUID();

/**
 * The record's storage key, published so the driver never has to restate it.
 *
 * **A second spelling of this key in the measuring script would be a second thing that can
 * drift**, and the drift would be silent: a wrong key reads an empty record, which looks
 * exactly like an alarm that never fired. So the writer tells the reader where it wrote.
 */
self.__spectreAlarmRecordKey = RECORD_KEY;

self.addEventListener("install", () => {
  // Intentionally empty. This worker is a scope, not a program.
});

self.addEventListener("activate", () => {
  // Intentionally empty.
});

chrome.alarms.onAlarm.addListener((alarm) => {
  const at = Date.now();
  void chrome.storage.local.get(RECORD_KEY).then((stored) => {
    const record = Array.isArray(stored?.[RECORD_KEY]) ? stored[RECORD_KEY] : [];
    return chrome.storage.local.set({
      [RECORD_KEY]: [...record, { at, name: alarm.name, workerId: WORKER_ID }],
    });
  });
});
