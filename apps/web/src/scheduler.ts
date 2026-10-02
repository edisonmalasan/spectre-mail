/**
 * The browser's scheduler, for the session to be given.
 *
 * **This is where the timer lives.** `packages/mailbox` holds none, and cannot be
 * made to: its `tsconfig` withholds the `DOM` lib, which rejects `window` and
 * `document` but says nothing about `setTimeout`, because `@types/node` declares it
 * exactly as it declares `navigator`. So the clock is passed in, and this is the
 * only place in the client where a real timer is armed.
 *
 * ## Why it is not the global by default
 *
 * `createMailboxSession` takes its scheduler as a **required** parameter, so there
 * is no code path that works only when a test happens to have replaced a global. A
 * package whose behaviour is really the test runner's cannot be verified; this one
 * can be driven step by step with no time passing at all.
 *
 * @module
 */

import type { Cancel, MailboxScheduler } from "@spectre-mail/mailbox";

/**
 * The scheduler the website hands its session.
 *
 * `window.setTimeout` rather than the bare global, because the bare global is
 * ambiguous about what it resolves against and an explicit receiver says which one is
 * meant. The handle is cleared through the same receiver for the same reason.
 */
export const webScheduler: MailboxScheduler = {
  schedule(afterMs, run): Cancel {
    const handle = window.setTimeout(run, afterMs);
    return () => {
      window.clearTimeout(handle);
    };
  },
};
