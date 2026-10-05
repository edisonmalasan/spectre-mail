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
 * ## Three things this holds that the session does not
 *
 * The session layer takes **no storage dependency at all** — `mailbox-session`'s
 * purpose excludes it, and the boundary rule enforces it. So the read of what this
 * device has stored, the write of what the page goes on to hold, and the removal of
 * both all happen here. That gives the page three facts the session cannot have:
 *
 * - **`boot`** — whether the page knows yet what it has stored. It is what the page
 *   shows instead of the session while it does not, and it is the only thing standing
 *   between a failed read and a silently created mailbox.
 * - **`saving`** — whether the last write worked.
 * - **`localData`** — whether this device holds the record at all, which is what
 *   decides whether removal is offered and what the page says it keeps.
 *
 * **They are three fields rather than one union, because they are three axes.** `boot`
 * moves once, forwards, and only forward except on a retry; `saving` changes while a
 * mailbox is on screen; `localData` changes on the three occasions storage state is
 * confirmed. Folding them into one union would mean inventing states like
 * `{ boot: "started", saving: "failed", localData: "stored" }`, which is a union that
 * has to grow a row for every combination of three facts that rarely interact.
 *
 * `localData` is the one most likely to look derivable, and it is not — see its own
 * documentation for why neither `handed` nor `saving` can stand in for it.
 *
 * @module
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Mailbox } from "@spectre-mail/core";
import type { MailboxSession, SessionState } from "@spectre-mail/mailbox";
import { isReady } from "@spectre-mail/mailbox";

import type { WebsiteStorage } from "./storage";

/**
 * Whether the page knows what this device has stored.
 *
 * **`blocked` is a terminal answer about *this attempt*, not about the mailbox.** It
 * means the page could not read its own storage, so it has deliberately not asked the
 * session to do anything — creating a mailbox here is the one move that would destroy
 * the address the user came back for, because the next save would overwrite a record
 * this page never managed to look at.
 */
export type BootState =
  /** Reading. Nothing has been asked of the session, and no address can be shown. */
  | { readonly kind: "reading" }
  /** The read failed or could not be attempted. Nothing has been created. */
  | { readonly kind: "blocked"; readonly reason: string }
  /** The read succeeded; the session has been asked to adopt or create. */
  | { readonly kind: "started" };

/** Whether the mailbox the page holds has been stored. */
export type SaveState =
  | { readonly kind: "saved" }
  /** The last write was refused. The address on screen is real; the next reload is not promised. */
  | { readonly kind: "notSaved"; readonly reason: string };

/**
 * Whether this device currently holds SpectreMail's record of the mailbox.
 *
 * **A third fact, and it is neither `handed` nor `saving`.** The temptation was to
 * read it off one of those, and both readings are wrong:
 *
 * - `handed.current` is claimed *before* the write is awaited, to stop a second write
 *   racing the first. So it says a mailbox is spoken for, not that this device has it.
 *   Deriving this state from it would claim a mailbox the device does not have every
 *   time a write is refused.
 * - `saving` starts at `saved` whether or not anything has ever been stored, so it
 *   cannot tell "stored it" from "has nothing to store".
 *
 * So this is set only where storage state is **confirmed**: after a boot read that
 * returned a mailbox, after a save that resolved, and after a removal that resolved.
 * It is therefore never ahead of the truth — it can lag a write in flight, which is
 * the safe direction, and `saving` reports a refused write separately and in the same
 * breath.
 *
 * **It exists so the page can offer removal only where removal can act.** A clear
 * control on a device holding nothing is decorative, and the disclosure beside it
 * would have to lie in one direction or the other.
 */
export type LocalDataState = { readonly kind: "stored" } | { readonly kind: "none" };

export interface MailboxSessionBinding {
  /** What to render. Never a promise; never partially built. */
  readonly state: SessionState;
  /** Whether the page knows what it has stored yet. */
  readonly boot: BootState;
  /** Whether the mailbox it holds has been written. */
  readonly saving: SaveState;
  /** Whether this device holds SpectreMail's record of the mailbox. */
  readonly localData: LocalDataState;
  /**
   * Remove everything this device holds.
   *
   * **Returns the promise rather than swallowing it, so the caller owns the outcome.**
   * A rejection here is the platform's reason — a second tab holding the database, a
   * refused request — and a page that swallowed it would have to report the removal as
   * having worked.
   *
   * **It rejects; it does not leave the caller waiting for a queued removal.**
   * Reporting a blocked removal is the only available answer, because the wait ends
   * when some other tab closes. It is not a cancellation either: the platform may
   * still complete the removal afterwards, which is why the page's wording is
   * constrained and no read-back is attempted here.
   */
  readonly clearStored: () => Promise<void>;
  /** Ask again whether this device has something stored. What a blocked page offers. */
  readonly retryBoot: () => void;
  /** Create a mailbox for now, leaving whatever is stored untouched. */
  readonly startFresh: () => void;
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

export function useMailboxSession(
  session: MailboxSession,
  store: WebsiteStorage,
): MailboxSessionBinding {
  const [state, setState] = useState<SessionState>(() => session.current());
  // **`reading` is the initial value rather than something set in the effect body.** A
  // `setState` there would be a second render pass before anything had been learned,
  // and `react-hooks/set-state-in-effect` exists for a reason.
  const [boot, setBoot] = useState<BootState>({ kind: "reading" });
  const [saving, setSaving] = useState<SaveState>({ kind: "saved" });
  // **`none` initially, and that is a fact rather than a placeholder.** Before the
  // boot resolves nothing is known, and `none` is the only honest answer for a device
  // that has not been read yet — which is also why the page offers no removal during
  // the read and never on the strength of this value alone.
  const [localData, setLocalData] = useState<LocalDataState>({ kind: "none" });

  const opened = useRef(false);
  /**
   * The id of the mailbox this page was *handed*, if any.
   *
   * **This is the whole save rule, and it is one comparison.** The page stores a
   * `ready` mailbox whose id is not the one it was handed, which covers exactly the
   * three paths that must save — a first visit (handed nothing), *Replace address*
   * (handed the old one), and a retry after a failed creation (handed nothing) — and
   * excludes the one that must not: adoption, where the mailbox is already stored and
   * writing it again would be a request-free no-op whose only purpose would be to make
   * a bug elsewhere look correct.
   *
   * **Updated after a successful write** so a re-render does not write the same record
   * again on every session transition — the inbox polls five times a second.
   */
  const handed = useRef<string | null>(null);

  /**
   * Whether the page that started a write is still on screen.
   *
   * **A ref on the component, not a flag on an effect invocation — and that scope is
   * the whole point of it.** This existed as `let current = true` inside the save
   * effect, cleared by that effect's own cleanup. That is a correct protection against
   * a `setState` after unmount, scoped to the wrong thing: the cleanup also runs when
   * the effect **re-runs**, and the save effect depends on `state`, which is a new
   * object on every inbox transition. So a listing landing while a real IndexedDB
   * write was still in flight cleared the guard, the resolved write found it false, and
   * the success branch that records the write as confirmed was skipped. Because the
   * mailbox is already claimed in `handed`, no later invocation could set it either —
   * so the page wrote the record and never knew it had, and the removal control
   * `website-client` requires was never offered.
   *
   * **Measured, in a browser, and only there:** `records=1 claimsStored=0
   * offersRemoval=0`. The unit suite injects a storage whose `saveMailbox` resolves
   * immediately, so the write finishes before the listing lands and the bug has no
   * window to appear in. 152 tests passed on a page whose privacy control could not be
   * reached.
   *
   * Unmount is a property of the component; a re-render is not an unmount. Hence the
   * scope.
   */
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Whether this page load should write the mailbox it holds.
   *
   * **A ref, because it is a decision rather than a state.** Nothing renders it and
   * nothing reads it twice; the one thing a reader needs is *why a new mailbox might
   * deliberately not be stored*, which `startFresh` says and this names.
   *
   * `true` on every path except `startFresh`, and set back to `true` by both `retry`
   * and `replace` — a user who took a fresh address without replacing their record and
   * then chose to replace it has changed their mind, and the page should not keep
   * honouring the earlier decision.
   */
  const persist = useRef(true);

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

  /**
   * Create a mailbox **without** storing it, keeping whatever is already stored.
   *
   * **This is the control the `restoreFailed` state exists to offer**, and the reason
   * it cannot be `replace` is the whole design. `restoreFailed` means the provider
   * could not be asked whether the stored mailbox still works — which is not the same
   * claim as saying it does not. Overwriting the record on the strength of one failed
   * request would destroy the only copy of an address that may be perfectly alive.
   *
   * **And `expired` offers the same control, for a different reason.** There the
   * provider *did* say the mailbox is gone, so nothing is lost by moving on — the
   * record is already worthless — but the user is not asked to decide that. Both
   * states reach it; the reasoning behind each is different and neither belongs on the
   * page.
   */
  const startFresh = useCallback(() => {
    persist.current = false;
    run(() => session.open());
  }, [run, session]);

  /**
   * Read what is stored, then ask the session to adopt or create.
   *
   * **The `catch` is the requirement, not defensive coding.**
   * `spectre-storage` reserves `null` for "nothing stored" and rejects for everything
   * else, because a read reported as absent would make this page believe it was a
   * first visit, create a mailbox, and overwrite the record it never managed to read.
   * Catching that rejection and passing `null` on is the exact conversion the contract
   * exists to prevent, so the failure ends the boot and reaches the page instead.
   */
  const startBoot = useCallback(async () => {
    if (store.kind === "blocked") {
      setBoot({ kind: "blocked", reason: store.reason });
      return;
    }

    let stored: Mailbox | null;
    try {
      stored = await store.storage.loadMailbox();
    } catch (cause) {
      setBoot({ kind: "blocked", reason: describe(cause) });
      return;
    }

    handed.current = stored?.id ?? null;
    setLocalData(stored === null ? { kind: "none" } : { kind: "stored" });
    setBoot({ kind: "started" });
    await session.restore(stored);
  }, [session, store]);

  const retryBoot = useCallback(() => {
    // **Back to `reading` first, and this was a bug.** Without it the page kept
    // rendering `BootFailure` -- "SpectreMail cannot check what it has saved" -- for
    // the whole of a second attempt it was in the middle of making, and only swapped
    // to the real answer when the read finally landed. A user who clicked *Check
    // again* and saw the same refusal would conclude the retry had not been tried,
    // which is the opposite of what the control did.
    setBoot({ kind: "reading" });
    void startBoot();
  }, [startBoot]);

  const retry = useCallback(() => {
    persist.current = true;
    run(() => session.open());
  }, [run, session]);

  const replace = useCallback(() => {
    // **Persist, unlike `startFresh`.** Replacing an address is a decision to make this
    // the one that comes back on the next reload, and the restored-mailbox scenario in
    // `website-client` requires exactly that. A user who replaced and reloaded would
    // otherwise be handed the address they had just decided to discard.
    persist.current = true;
    run(() => session.replace());
  }, [run, session]);

  const checkInbox = useCallback(() => {
    void session.checkInbox();
  }, [session]);

  /**
   * Remove everything this device holds, through the contract.
   *
   * **No re-save guard was added here, and the reason is the interesting part.** The
   * save effect already returns early when `mailboxId === handed.current`, so after a
   * removal the polling that follows does not rewrite the address — no `persist`-style
   * ref is needed, and adding one would have been a second mechanism doing a job the
   * first already does. That claim is asserted by counting saves across several inbox
   * transitions after a removal, because a comparison nobody tests stops being true
   * when somebody edits it.
   *
   * **`handed` is deliberately left alone.** It names the mailbox this load was
   * *handed*, which is a historical fact and stays true: the page was handed that
   * mailbox, and it is still holding it. Clearing it would make the next write of that
   * same mailbox look like a change and store it again — the exact re-save this
   * operation exists to prevent.
   *
   * **Nothing is read back afterwards**, and that is measured rather than stylistic:
   * while a removal is blocked, a fresh `open` is blocked too, so an attempt to verify
   * would hang rather than answer.
   */
  const clearStored = useCallback(async () => {
    // **A blocked store removes nothing, so there is nothing to remove.** The page
    // never offers the control in that state, and this keeps the promise honest if
    // something calls it anyway rather than reaching into a union that has no
    // storage on it.
    if (store.kind !== "ready") return;

    await store.storage.clearAll();
    setLocalData({ kind: "none" });
  }, [store]);

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
    // **No `setState` in this effect body** — the initial state is already `reading`.
    //
    // The `opened` ref exists because of StrictMode, which mounts, unmounts, and
    // remounts an effect in development. Without it, the double invocation would
    // create **two** mailboxes on every page load in dev and silently throw one away
    // — against a provider that rate-limits account creation, that is not a harmless
    // duplicate.
    //
    // **The guard now covers the whole boot, not just `open()`.** Before adoption the
    // guard protected one provider request; it now protects a storage read *and* the
    // request, and the read is the one that matters most — a second read racing the
    // first could deliver a second `restore` after the first had already created a
    // mailbox.
    //
    // There is deliberately **no cancellation flag** in the cleanup. A cleanup that
    // marked the result stale would strand StrictMode's remount: the second pass
    // returns early because `opened` is set, and nothing would ever deliver the
    // state. React discards a `setState` on an unmounted component without warning,
    // so the only thing a guard would buy here is the bug.
    if (opened.current) return;
    opened.current = true;
    void startBoot();
  }, [startBoot]);

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
    //
    // **Gated on `boot` having started**, because before it has there is no mailbox to
    // list, and a call here would be `checkInbox` against `idle` — which reports
    // `notStarted` and, more to the point, would be a client asking a question before
    // it knows whether it has a mailbox at all.
    if (mailboxId === null || boot.kind !== "started") return;
    void session.checkInbox();
  }, [boot.kind, session, mailboxId]);

  /**
   * Store the mailbox this page holds, when it is not the one it was handed.
   *
   * **One effect, one comparison, and it is keyed on the mailbox's id.** Keying on the
   * state object would write on every inbox transition, which at the polling cadence is
   * a write several times a second; keying on the id means one write per mailbox, which
   * is what "persist the mailbox it holds" asks for.
   */
  useEffect(() => {
    if (mailboxId === null || boot.kind !== "started") return;
    if (mailboxId === handed.current) return;
    if (!persist.current) return;
    if (!isReady(state)) return;
    // **Narrowed rather than cast.** `boot.kind === "started"` already implies this —
    // a blocked store never starts the boot, so there is nothing to save — but the
    // compiler cannot see that the two conditions are the same one, and writing
    // `store.storage` on the union is an error. A cast would silence it; the extra
    // check states the dependency the type cannot infer.
    if (store.kind !== "ready") return;

    // **Claimed before the write is awaited, not after it resolves.** It was updated in
    // the success callback first, and the page wrote the same record twice: the save
    // effect depends on the state object, the inbox publishes a transition every few
    // seconds, and any transition arriving between the call and its resolution started
    // a second write with `handed` still pointing at the old value. Two records, one
    // mailbox, and a test asserting a count would have been the only place it showed.
    //
    // **So a failed write is not retried, and that is the deliberate consequence.**
    // Retrying on every inbox transition would mean retrying a full disk several times
    // a second for as long as the page is open. The page says the address was not
    // stored, which is the fact a user needs; a silent retry loop is not a service
    // SpectreMail should offer against a device that has said no.
    handed.current = mailboxId;

    void store.storage.saveMailbox(state.mailbox).then(
      () => {
        // **Guarded against an unmount, and not against a re-render.** A `setState`
        // after unmount is discarded by React without warning, so this guard is not
        // load-bearing for React's sake — it is load-bearing because the failure
        // branch below changes something the user can see, and because writing after
        // teardown is a call on a tree that no longer exists. What it must not do is
        // answer a different question, which is what the previous per-invocation
        // `current` flag did: the save effect depends on `state`, an inbox transition
        // produces a new `state` object, and the effect's cleanup therefore withdrew
        // this guard while a real write was still in flight. The write then resolved to
        // silence, the page never learned it had stored anything, and the removal
        // control was never offered. `mounted` is scoped to the component instead.
        if (!mounted.current) return;
        setSaving({ kind: "saved" });
        // **Only on success.** `handed.current` was already claimed above, so the
        // device is *spoken for*; this is where it becomes *known to be there*. A
        // refused write leaves `localData` alone, so the page keeps declining to offer
        // removal of something it cannot confirm it has — and `saving` says why.
        setLocalData({ kind: "stored" });
      },
      (cause: unknown) => {
        // **Reported, not swallowed.** A page that saved quietly would leave the user
        // believing reload recovery works on a device where it does not, which is the
        // same class of claim the whole recovery path exists to avoid.
        if (!mounted.current) return;
        setSaving({ kind: "notSaved", reason: describe(cause) });
      },
    );

    return undefined;
  }, [boot.kind, state, mailboxId, store]);

  return {
    state,
    boot,
    saving,
    localData,
    clearStored,
    retryBoot,
    startFresh,
    retry,
    replace,
    checkInbox,
    openMessage,
    closeMessage,
  };
}

/**
 * Turn whatever was thrown into a sentence the page can show.
 *
 * **A storage failure has no normalized code to map to**, because
 * `spectre-storage` reports it as a rejection rather than as a value. That is the right
 * design and it leaves nothing to normalize *to*; inventing a code here would be
 * inventing an error vocabulary for a layer that deliberately has none.
 */
function describe(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) return cause.message;
  return String(cause);
}
