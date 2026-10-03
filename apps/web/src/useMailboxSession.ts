/**
 * The React binding for a mailbox session.
 *
 * Deliberately thin. It mirrors a `SessionState` into component state and
 * nothing else: it holds no address, derives no expiry, and keeps no timer. Every
 * judgement about what to show belongs to the session or to the page, so a second
 * client can render the same state with a different view without this logic
 * having to be rewritten.
 *
 * **It subscribes rather than re-reading the value.** Slice 1 read the state once and
 * then again when `open` settled, which was the whole truth of the matter while a
 * mailbox was the only thing that existed. Now the state moves on a timer — every
 * inbox transition, including the move into `checking` — so a binding that refreshed
 * only when a call of its own settled would render a mailbox whose inbox it had not
 * looked at since the page loaded.
 *
 * **It does not call `destroy()` on unmount.** React's StrictMode unmounts and
 * remounts the same component with the *same* session instance, so a cleanup that
 * destroyed the session would leave the remounted page looking alive and never
 * polling again. Unmount reports the inbox invisible instead, which is reversible and
 * stops the loop; see `MailboxSession.destroy` for who that is for.
 *
 * **No storage, no recovery.** A remount starts a new session. Mail.tm publishes a
 * message retention and says a mailbox lasts until deleted, but neither value
 * appears in any API response, so nothing here could be persisted truthfully even if
 * persistence existed — it is M6's work and its decision to make.
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
  /** Ask for the mailbox's messages now. What the inbox's own retry calls. */
  readonly checkInbox: () => void;
  /** Open a message from the inbox. User-initiated: a row is a button. */
  readonly openMessage: (messageId: string) => void;
  /** Close whatever is open. What the message view's return control calls. */
  readonly closeMessage: () => void;
}

export function useMailboxSession(session: MailboxSession): MailboxSessionBinding {
  const [state, setState] = useState<SessionState>(() => session.current());
  const opened = useRef(false);

  const run = useCallback((operation: () => Promise<SessionState>) => {
    // Show "creating" before awaiting, not after. Reading the new state only once the
    // promise settles leaves the previous mailbox on screen while the next one is
    // being fetched, which is a lie about what the user is looking at. The promise's
    // own result is deliberately not used: the session reports every transition
    // through `subscribe`, and setting state here as well would deliver the same
    // value twice.
    // **`opened: { kind: "none" }` rather than leaving it out, and that is the point of
    // `SessionState` carrying the field on `creating`.** A previous version pushed
    // `{ kind: "creating" }` with no opened state at all, which the compiler rejected —
    // correctly, because it is the exact rendering bug the field exists to prevent: the
    // client would have shown the previous mailbox's open message beside "creating your
    // address". The `creating` state has to say what is open as loudly as `ready` does,
    // because a client rendering either reads one field.
    setState({ kind: "creating", opened: { kind: "none" } });
    void operation();
  }, []);

  const retry = useCallback(() => {
    run(() => session.open());
  }, [run, session]);

  const replace = useCallback(() => {
    run(() => session.replace());
  }, [run, session]);

  const checkInbox = useCallback(() => {
    void session.checkInbox();
  }, [session]);

  // **Deliberately not awaiting.** The session publishes `opening` before it asks the
  // provider and `opened` when the read lands, both through `subscribe`, so this
  // binding's state updates on its own. Awaiting here and setting state from the result
  // would deliver the same value twice - the mistake the module note already records
  // for `run`.
  const openMessage = useCallback(
    (messageId: string) => {
      void session.openMessage(messageId);
    },
    [session],
  );

  const closeMessage = useCallback(() => {
    session.closeMessage();
  }, [session]);

  useEffect(() => {
    // **No `setState` in this effect body.** The initial state is already `creating`,
    // so setting it again would be a no-op that triggers a second render pass —
    // which is exactly what the `react-hooks/set-state-in-effect` rule is for.
    //
    // The `opened` ref exists because of StrictMode, which mounts, unmounts, and
    // remounts an effect in development. Without it, the double invocation would
    // create **two** mailboxes on every page load in dev and silently throw one away
    // — against a provider that rate-limits account creation, that is not a harmless
    // duplicate.
    //
    // There is deliberately **no cancellation flag** in the cleanup. A cleanup that
    // marked the result stale would strand StrictMode's remount: the second pass
    // returns early because `opened` is set, and nothing would ever deliver the
    // state. React discards a `setState` on an unmounted component without warning,
    // so the only thing a guard would buy here is the bug.
    if (opened.current) return;
    opened.current = true;
    void session.open();
  }, [session]);

  // Subscribed rather than read: see the module note. `subscribe` delivers the
  // current state on the way in, so this cannot render one render behind.
  useEffect(() => session.subscribe(setState), [session]);

  const mailboxId = state.kind === "ready" ? state.mailbox.id : null;

  useEffect(() => {
    // **One listing, asked for by the client; the cadence after that is the
    // session's.** Without it the page would say "checking" forever, because the
    // session polls a mailbox it has been asked about and nothing had asked. Keyed on
    // the mailbox's id rather than on the state object, so a re-render producing an
    // equal-but-new state does not ask again — and a replaced mailbox does.
    if (mailboxId === null) return;
    void session.checkInbox();
  }, [session, mailboxId]);

  return { state, retry, replace, checkInbox, openMessage, closeMessage };
}
