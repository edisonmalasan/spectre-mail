/**
 * The extension's scheduler, for the session to be given.
 *
 * ## Why this exists even though nothing polls yet
 *
 * `createMailboxSession` takes its scheduler as a **required** parameter, so there is no
 * code path that works only when a test happens to have replaced a global. This module
 * supplies the real one.
 *
 * **It being present does not mean the session uses it.** Per `design.md` D1 the popup
 * has no ambient polling: nothing calls `reportInboxVisible(true)`, so the session's
 * inbox tracker stays idle and never schedules. The scheduler exists because the session
 * cannot be built without one — and `service-worker.test.ts` asserts the *worker* arms no
 * timer, which is a different claim from this one.
 *
 * ## Why the bare global is not used
 *
 * `window.setTimeout` rather than the bare global, for the reason
 * `apps/web/src/scheduler.ts` gives: the bare global is ambiguous about what it resolves
 * against, and an explicit receiver says which one is meant.
 *
 * @module
 */

import type { Cancel, MailboxScheduler } from "@spectre-mail/mailbox";

/** The scheduler the extension hands its session. */
export const extensionScheduler: MailboxScheduler = {
  schedule(afterMs, run): Cancel {
    const handle = window.setTimeout(run, afterMs);
    return () => {
      window.clearTimeout(handle);
    };
  },
};
