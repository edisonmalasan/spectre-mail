/**
 * The React binding for a mailbox session.
 *
 * Deliberately thin. It mirrors a `SessionState` into component state and
 * nothing else: it holds no address, derives no expiry, and keeps no timer. Every
 * judgement about what to show belongs to the session or to the page, so a second
 * client can render the same state with a different view without this logic
 * having to be rewritten.
 *
 * **No storage, no recovery.** A remount starts a new session. Mail.tm publishes a
 * message retention and says a mailbox lasts until deleted, but neither value
 * appears in any API response, so nothing here could be persisted truthfully even
 * if persistence existed — it is M6's work and its decision to make.
 *
 * @module
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { MailboxSession, SessionState } from "@spectre-mail/mailbox";

export interface MailboxSessionBinding {
  /** What to render. Never a promise; never partially built. */
  readonly state: SessionState;
  /** Open a mailbox, or try again after a failure. Always user-initiated. */
  readonly retry: () => void;
  /** Discard the current mailbox and create another. */
  readonly replace: () => void;
}

export function useMailboxSession(session: MailboxSession): MailboxSessionBinding {
  const [state, setState] = useState<SessionState>(() => session.current());
  const opened = useRef(false);

  const run = useCallback((operation: () => Promise<SessionState>) => {
    // Show "creating" before awaiting, not after. Reading the new state only once
    // the promise settles leaves the previous mailbox on screen while the next one
    // is being fetched, which is a lie about what the user is looking at.
    setState({ kind: "creating" });
    void operation().then(setState);
  }, []);

  const retry = useCallback(() => {
    run(() => session.open());
  }, [run, session]);

  const replace = useCallback(() => {
    run(() => session.replace());
  }, [run, session]);

  useEffect(() => {
    // **No `setState` in this effect body.** The initial state is already `creating`,
    // so setting it again would be a no-op that triggers a second render pass -
    // which is exactly what the `react-hooks/set-state-in-effect` rule is for.
    //
    // The `opened` ref exists because of StrictMode, which mounts, unmounts, and
    // remounts an effect in development. Without it, the double invocation would
    // create **two** mailboxes on every page load in dev and silently throw one
    // away — against a provider that rate-limits account creation, that is not a
    // harmless duplicate.
    //
    // There is deliberately **no cancellation flag** in the cleanup. A cleanup that
    // marked the result stale would strand StrictMode's remount: the second pass
    // returns early because `opened` is set, and nothing would ever deliver the
    // state. React discards a `setState` on an unmounted component without warning,
    // so the only thing a guard would buy here is the bug.
    if (opened.current) return;
    opened.current = true;
    void session.open().then(setState);
  }, [session]);

  return { state, retry, replace };
}
