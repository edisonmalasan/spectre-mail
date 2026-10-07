/**
 * The extension's scheduler, for the session to be given.
 *
 * ## Why this exists even though nothing polls
 *
 * `createMailboxSession` takes its scheduler as a **required** parameter, so there is no code path
 * that works only when a test happens to have replaced a global. This module supplies the real one.
 *
 * **It being present does not mean the session uses it.** Per `design.md` D1 the popup has no
 * ambient polling: nothing calls `reportInboxVisible(true)`, so the session's inbox tracker stays
 * idle and never schedules. `service-worker.test.ts` asserts the *worker* arms no timer, which is a
 * different claim from this one — and the worker's opener in `create-mailbox.ts` builds a session
 * only to call `open()` on it, which schedules nothing either.
 *
 * ## `globalThis.setTimeout`, and why the receiver is spelled out at all
 *
 * **This module used to call `window.setTimeout`, and a background service worker has no `window`**
 * — so the scheduler the worker must be given threw at call time. It compiled, every existing test
 * reached it only from the popup, and no assertion covered the case; that is the whole of how the
 * defect survived, and it is recorded in `docs/PROVIDERS.md` §4.4 because the platform fact behind
 * it is the durable part.
 *
 * **`globalThis` rather than the bare `setTimeout`,** and the reason is the one
 * `apps/web/src/scheduler.ts` gives for naming its receiver: the bare global is ambiguous about
 * what it resolves against, and an explicit receiver says which one is meant. Here the ambiguity
 * is sharper than it looks — in an extension these are **three different global objects** (a popup's
 * window, a content script's isolated world's, and a worker's), and only `globalThis` names the one
 * the caller is actually running in.
 *
 * @module
 */

import type { Cancel, MailboxScheduler } from "@spectre-mail/mailbox";

/** The scheduler the extension hands its session. */
export const extensionScheduler: MailboxScheduler = {
  schedule(afterMs, run): Cancel {
    const handle = globalThis.setTimeout(run, afterMs);
    return () => {
      globalThis.clearTimeout(handle);
    };
  },
};
