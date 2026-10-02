/**
 * Whether anything is displaying the inbox, reported to the session.
 *
 * The session polls on a cadence and can be told to stop. **It cannot work out
 * whether to stop on its own**, and the reason is worth stating rather than coding
 * around: the shared package has no way to observe a tab, and giving it one would put
 * a browser assumption into the layer the extension also depends on. So visibility is
 * reported from the client, which is the layer that can actually see.
 *
 * A hidden tab is not polled at all. A check the user cannot see is cost with no
 * possible benefit, and against a provider that publishes no rate limit it is cost
 * against a budget nobody has stated.
 *
 * **Unmount reports invisible rather than destroying the session.** React's
 * StrictMode remounts the same component with the same session instance, so a
 * cleanup that destroyed the session would leave the remounted page looking alive and
 * never polling again. Reporting invisible stops the loop and is reversible.
 *
 * @module
 */

import { useEffect } from "react";

import type { MailboxSession } from "@spectre-mail/mailbox";

/** Whether the document is currently shown. `"hidden"` is the only hidden value. */
function isVisible(): boolean {
  return document.visibilityState !== "hidden";
}

export function useInboxVisibility(session: MailboxSession): void {
  useEffect(() => {
    const report = (): void => {
      session.reportInboxVisible(isVisible());
    };

    // Reported once on mount, not only on change: a page loaded into a background
    // tab must not start polling before anything says it is being looked at.
    report();

    document.addEventListener("visibilitychange", report);
    return () => {
      document.removeEventListener("visibilitychange", report);
      session.reportInboxVisible(false);
    };
  }, [session]);
}
