/**
 * The notification probe's **control** worker.
 *
 * ## What it is for
 *
 * Its sibling declares `notifications` and this one does not, and **the whole measurement rests on
 * that difference meaning something.** If `chrome.notifications` were undefined in both, the
 * positive arm would be showing a property of headless Chromium rather than of the permission -
 * which is precisely the confusion the alarms probe recorded when its first version armed two alarms
 * at once and called the competitor a positive control. **A control must not merely run; it must
 * be able to fail.**
 *
 * So this file reports exactly one fact - **is the API present** - and reports it rather than
 * throwing, because a worker that threw would look identical to a worker that loaded.
 *
 * ## Why it declares `storage` when it uses nothing
 *
 * So that the **only** difference between this manifest and its sibling's is `notifications`. A
 * control that differed in two ways could not attribute the sibling's result to either one, and the
 * second difference would be the one nobody noticed.
 *
 * ## The empty `install`/`activate` listeners
 *
 * Present for the same reason they are present in the sibling and in `alarm-probe`: a worker with no
 * listeners reads as broken, and a reader who has to work out whether its silence is meaningful has
 * been handed a second question.
 */

const PROBE_KEY = "__spectreNotificationControl";

self[PROBE_KEY] = {
  /**
   * Whether `chrome.notifications` exists here, and whether it has the members a caller needs.
   *
   * **Both halves are reported and neither is derived from the other**, because `typeof
   * chrome.notifications === "object"` with a missing `create` would be a control that passed while
   * proving nothing.
   */
  selfReport() {
    const api = typeof chrome.notifications === "undefined" ? null : chrome.notifications;
    return {
      hasNotificationsApi: api !== null,
      hasCreate: typeof api?.create === "function",
      hasGetAll: typeof api?.getAll === "function",
      hasOnError: typeof api?.onError?.addListener === "function",
      declaredPermissions: chrome.runtime.getManifest().permissions ?? [],
    };
  },
};

self.addEventListener("install", () => {
  // Intentionally empty. See the note above.
});

self.addEventListener("activate", () => {
  // Intentionally empty.
});
