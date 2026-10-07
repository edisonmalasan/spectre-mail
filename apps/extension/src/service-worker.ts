/**
 * The background service worker.
 *
 * ## What is deliberately not here: a polling loop
 *
 * `packages/mailbox` polls through an injected `MailboxScheduler`, and the website
 * drives it from a live tab at `INBOX_POLL_PROMPT_MS` — **5 000ms** — with a
 * `INBOX_POLL_CEILING_MS` of 30 000ms.
 *
 * An MV3 background service worker is **idle-terminated**, and `chrome.alarms` enforces
 * a floor of its own. So a session living here is a session that dies, and one living in
 * the popup dies whenever the popup closes, which is most of the time. **Neither is what
 * the shared layer assumes, and this repository has never measured which one is
 * survivable.**
 *
 * `design.md` D1 therefore defers the decision rather than guessing it: this worker
 * declares no alarm, schedules no repeated request, and the popup's inbox count comes
 * from a check the user asked for. The measurement — how long the worker actually
 * survives idle, and what period `chrome.alarms` accepts — is a deliverable of this
 * milestone, recorded in `docs/PROVIDERS.md` before anything decides where the session
 * lives.
 *
 * **Two absences asserted in `service-worker.test.ts` rather than left to review.** An
 * absence that is merely an omission reads as an oversight, and gets filled in by
 * whatever change next touches this file. Requiring the absence means the milestone that
 * owns the answer has to amend the requirement rather than quietly adding a loop.
 *
 * ## Why the worker exists at all, then
 *
 * Because it is what **grants the extension its cross-origin reach**. An MV3 extension
 * can fetch a host it holds permission for from any of its own contexts, but the *worker*
 * is what Chromium wakes to do background work, and it is the context whose lifetime is
 * in question. Declaring it now, empty of behaviour, is what makes the measurement
 * possible and what the manifest's `background` key names.
 *
 * @module
 */

/**
 * Nothing to do on install.
 *
 * **`skipWaiting` and `clients.claim` are deliberately not called.** They exist to make
 * a new version take over from a running one mid-session, and this worker holds no state
 * for a takeover to corrupt — there is no session in it yet. Adding them now would be
 * machinery for a case that cannot occur, and the kind of unnecessary permission-adjacent
 * behaviour M12's review asks about.
 */
self.addEventListener("install", () => {
  // Intentionally empty. See the note above.
});

/**
 * Nothing to do on activation.
 *
 * The M0 spike's disposable fixture called `clients.claim()` here, and that fixture's
 * whole job was to hold a permission open long enough to measure a fetch. This worker is
 * not that fixture, and claiming clients is a behaviour with consequences — it makes
 * already-open extension pages adopt this worker rather than their own — bought for no
 * reason this milestone can name.
 */
self.addEventListener("activate", () => {
  // Intentionally empty. See the note above.
});
