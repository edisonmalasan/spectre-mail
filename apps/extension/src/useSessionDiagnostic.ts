/**
 * The session's diagnostic, accumulated as the session goes.
 *
 * ## Why this is a hook and not a calculation in the component
 *
 * **Because a report of what happened cannot be derived from what is happening now.** The session
 * publishes `creating` and then `ready` or `failed`, and a component that rendered the report from
 * the current state would count a mailbox as created only while it is still created.
 *
 * So the states are **folded in as they arrive**, and the fold is the pure function in
 * `@spectre-mail/mailbox` -- **beside the `SessionState` it reads, and shared with the website**,
 * which folds the same function.
 *
 * ## Why this is a module of its own rather than three lines in the panel
 *
 * **Because the website has the same three lines, and the point of sharing the fold is that the two
 * clients cannot drift.** The fold is the logic; this is the wrapper. A wrapper duplicated is a
 * wrapper that can differ, and this one differs only in what it names -- so it is called
 * `useSessionDiagnostic` on both sides, and the difference is the package it imports.
 *
 * ## Why the count is state and not a ref
 *
 * **Because the report is read during render, and React's `react-hooks/refs` rule forbids reading
 * a ref there** -- the lint caught it, and the lint is right.
 *
 * ## Why the state is folded in once, and how that is guaranteed
 *
 * **Because React's `StrictMode` runs an effect twice on mount in development, and the count is what
 * a person is shown.**
 *
 * So the hook remembers the state it last folded in, and `isNewSessionState` decides whether the
 * one in hand is new. **The comparison is by identity, not by content**, because a session publishes
 * a new state object on each transition.
 *
 * **The remembered state is a ref here and not a field of the diagnostic**, because the diagnostic
 * must not hold a mailbox: a `SessionState` carries one, with its address and its credentials.
 *
 * @module
 */

import { useEffect, useRef, useState } from "react";

import type { SessionDiagnostic, SessionState } from "@spectre-mail/mailbox";
import {
  emptySessionDiagnostic,
  isNewSessionState,
  observeSessionState,
} from "@spectre-mail/mailbox";

/**
 * The session's diagnostic so far.
 *
 * @param state - The session's current state.
 * @returns What the session has done so far.
 */
export function useSessionDiagnostic(state: SessionState): SessionDiagnostic {
  // **State, because the report is read during render** -- and the lint that says so is right.
  const [diagnostic, setDiagnostic] = useState<SessionDiagnostic>(emptySessionDiagnostic);

  /** The state last folded in, so that one state is counted once. */
  const folded = useRef<SessionState | null>(null);

  useEffect(() => {
    // **One state, one count.** See this file's note: `StrictMode` runs an effect twice on mount,
    // and the count is what a person is shown.
    if (isNewSessionState(folded.current, state) === false) return;
    folded.current = state;
    setDiagnostic((previous) => observeSessionState(previous, state, Date.now()));
  }, [state]);

  return diagnostic;
}
