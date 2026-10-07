/**
 * The alarm probe's worker.
 *
 * ## It exists only so a worker scope exists
 *
 * `chrome.alarms` is reachable only from a context whose manifest declares the `alarms`
 * permission. The shipped extension does not, deliberately. So the measurement needs a
 * worker of its own, and this file is it: **no listener, no schedule, no behaviour.**
 * `alarm-floor.spec.ts` drives `chrome.alarms` from inside it.
 *
 * Written as plain ESM JavaScript rather than TypeScript because **it is not built.**
 * Nothing compiles `e2e/fixtures/`, and a fixture that had to go through a build to
 * exist would be one more thing that can be stale when the measurement runs — the exact
 * failure `archive-bytes.mjs` recorded, where the sources were restored and the artefact
 * two seconds older survived.
 */

self.addEventListener("install", () => {
  // Intentionally empty. This worker is a scope, not a program.
});

self.addEventListener("activate", () => {
  // Intentionally empty.
});
