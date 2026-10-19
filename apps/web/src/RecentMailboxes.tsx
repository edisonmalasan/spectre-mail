/**
 * The mailboxes this device holds, and the way back to one.
 *
 * ## Why this renders in every session state, and the sentence that already says why
 *
 * `LocalData` renders inside the product region, beside this component, and its own comment
 * states the reason this component exists:
 *
 * > *"It renders in **every session state** once the boot is done, because **what this browser
 * > remembers has nothing to do with what the session is doing** - a user looking at a creation
 * > failure with a stored address still needs to remove it."*
 *
 * **That sentence is about removal. The same sentence is about returning**, and the reason is
 * structural rather than rhetorical: a person whose address could not be created, or whose inbox
 * could not be listed, still has other addresses on this device and still needs to reach one.
 *
 * ## Why it is not a region, and that is a requirement rather than a preference
 *
 * `page-composition` says, in its own words: *"No region SHALL be added that has no heading of
 * its own, and **no sixth region SHALL be added**."* A sixth region for recent mailboxes would
 * forbid itself. `App` therefore renders this **inside** the product section, beside `LocalData`,
 * and `PAGE_ORDER` still names five regions - which is `design.md` D3's falsifiable claim.
 *
 * ## Why a mailbox this page cannot reach is marked, and how the mark is worded
 *
 * The roadmap's condition for offering a mailbox at all is *"where the provider session still
 * permits access"*, and **the page cannot answer that question for a mailbox it is not holding**.
 * What it *can* answer is what the provider said about the one it did ask about, and the session
 * layer already draws exactly the two answers: `expired` against `restoreFailed`.
 *
 * **So the two sentences below are the sentences `StoredAddressGone` and `StoredAddressUnchecked`
 * already render, taken from them rather than invented here.** A second wording for the same two
 * facts is the defect this page has avoided three times, and `RecentMailboxes.test.tsx` asserts
 * the containment by rendering both components - because the alternative, a shared module holding
 * the two strings, needed those two components edited, which was outside this change's write
 * scope.
 *
 * ## Why nothing here says how long an address lasts, and that is the whole reason
 *
 * **No count of days, no expiry, and no retention number appears anywhere in this component**, and
 * it is recorded beside the surface rather than left for a reader to infer: *no provider in this
 * repository has had its session lifetime measured.* `docs/PROVIDERS.md` records what Mail.tm
 * publishes and Guerrilla Mail publishes nothing, and a figure on this page would be an invention
 * presented as a measurement - the same failure the page's polling cadence and its provider limits
 * already avoid by naming what was measured and showing nothing where nothing was.
 *
 * "Recent" here means **what the provider still permits**, which is a fact about the provider. A
 * page that listed "the last 30 days" would be making that claim on the provider's behalf.
 *
 * ## Why nothing leaves the list because a newer address was recorded
 *
 * `SpectreMailboxes`' own requirement records, as a footnote on the extension, that *"a mailbox
 * recorded before this build stops being offered once this device records another one"*. **On the
 * extension that is a footnote; on a page whose product is "come back to the address you came back
 * for", an address silently leaving the list is a person losing one they recognised.** So this
 * surface shows every mailbox the collection holds, in the collection's own order, and the adapter
 * is what preserves the rest.
 *
 * @module
 */

import { useEffect, useState } from "react";

import type { Mailbox } from "@spectre-mail/core";

import type { WebsiteMailboxes } from "./storage";
import type { LocalDataState } from "./useMailboxSession";

/**
 * What the provider said about a mailbox this page asked about.
 *
 * **`gone` and `unchecked` are the session's own two answers, not new vocabulary.** They map one
 * to one onto `SessionState`'s `expired` and `restoreFailed`, and they are keyed by mailbox id so
 * a page that has checked one mailbox does not mark the others.
 *
 * **A mailbox with no entry is not claimed to work.** It is offered plainly, because the page has
 * not asked the provider about it and inventing an answer would be the fabrication this product
 * exists to avoid. What the requirement forbids is offering a mailbox *reported* unreachable as
 * though it did.
 */
export type UnreachableVerdict = Readonly<Record<string, "gone" | "unchecked">>;

/**
 * What the provider said about an address it no longer recognises.
 *
 * **The first sentence of `StoredAddressGone`, verbatim.** Exported rather than written into the
 * markup so the containment this change depends on is a thing a test can compare instead of a
 * thing a reader has to check.
 */
export const RECENT_ADDRESS_GONE =
  "Guerrilla Mail does not recognise this address any more, so it will not receive mail.";

/**
 * What the provider did not say about an address it could not be asked about.
 *
 * **The first sentence of `StoredAddressUnchecked`, verbatim** - and deliberately *not* its
 * closing half, *"what is saved on this device has not been changed"*, which is true of the stored
 * record and would be a false thing to assert about an older address in a list.
 */
export const RECENT_ADDRESS_UNCHECKED = "This says only that the check did not complete.";

export interface RecentMailboxesProps {
  /** The collection this device holds, or the reason there is none. */
  readonly held: WebsiteMailboxes;
  /**
   * The mailbox the session is on, or `null` while it holds none.
   *
   * **Read for one purpose: to withhold the control on the address already on screen.** A list
   * that offers "use this address" for the address being used is a control that cannot do anything,
   * which is the same fake-UI defect `extension-client` removed from the popup.
   */
  readonly current: Mailbox | null;
  /** What the provider said about the mailboxes this page has asked about. */
  readonly unreachable: UnreachableVerdict;
  /**
   * The page's own storage state, and the value this list re-reads on.
   *
   * **The dependency is the value rather than its `kind`, and that is deliberate.** `useMailboxSession`
   * replaces this with a fresh object exactly where it confirms storage state - after a boot read, after
   * a write that resolved, after a removal - and that is precisely the moment the device's contents may
   * have changed. A dependency on `kind` would re-read on a first visit's `none -> stored` and then never
   * again, so replacing an address would leave the list showing the one that was replaced.
   */
  readonly storageState: LocalDataState;
  /**
   * Return to a mailbox this device holds.
   *
   * **A navigation, not a creation.** `App` hands this the session, and the session's `restore` is what
   * reconciles a named mailbox against the provider that owns it; the creation path and the return path
   * stay two paths, because a return that quietly created an address would strand anything already sent
   * to the old one.
   */
  readonly onReturnTo: (mailbox: Mailbox) => void;
}

/** What the collection read found. Three answers, and the middle one is the requirement. */
type HeldState =
  /** The read is out. Nothing is claimed in either direction. */
  | { readonly kind: "reading" }
  /** This device holds none. An absence, and never a failure. */
  | { readonly kind: "empty" }
  /**
   * The read failed.
   *
   * **A third answer rather than the two the contract's own note warns about.** Reporting a failed read
   * as "this device holds none" is the conversion `Spectre-storage` reserves `null` to prevent: a page
   * that believed it was a first visit would create a mailbox and overwrite the address the user came
   * back for. So this is its own state, it says what went wrong, and it says nothing about what is
   * stored.
   */
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "held"; readonly mailboxes: readonly Mailbox[] };

export function RecentMailboxes({
  held,
  current,
  unreachable,
  storageState,
  onReturnTo,
}: RecentMailboxesProps) {
  const [state, setState] = useState<HeldState>({ kind: "reading" });

  /**
   * Whether this device holds nothing the page's own read found.
   *
   * **Asked before the read is attempted, and the reason is a measurement rather than an
   * optimisation.** The page's storage state is set from the *boot's* read, which is refused rather than
   * reported empty - so `none` is an established absence, not an unestablished one. And skipping the read
   * when it is `none` is what keeps a **confirmed removal** from immediately re-creating the database
   * the user just asked to be deleted: `indexedDB.databases()` still listed `spectre-mail` after a removal
   * in the browser tier, because this surface re-opened it a moment later. A privacy control that leaves a
   * database behind is the outcome `spectre-storage`'s removal requirement exists to prevent, and the
   * browser tier caught it rather than a unit test - which could not have, because the unit tier has no
   * platform to leave anything behind on.
   */
  const holdsNothing = storageState.kind === "none";

  useEffect(() => {
    // **Nothing is read where the platform provides no store**, and nothing is claimed either. A page
    // that cannot reach this device's records does not know whether it holds any.
    if (held.kind !== "ready") return;

    // **Nor is anything read once this device holds nothing**, for the reason above.
    if (holdsNothing) return;

    /**
     * **A local cancellation flag, scoped to this effect invocation.**
     *
     * The save-once defect `useMailboxSession` documents was a guard cleared by the effect's own
     * cleanup while a write was in flight, and it was scoped to the invocation rather than to the
     * component. This read is not a write and there is no ref to hang one off, so the question is
     * different and simpler: the only thing a stale result could do is overwrite a newer one, and
     * `setState` after unmount is discarded by React without warning.
     */
    let cancelled = false;

    void held.mailboxes.loadMailboxes().then(
      (mailboxes) => {
        if (cancelled) return;
        setState(mailboxes.length === 0 ? { kind: "empty" } : { kind: "held", mailboxes });
      },
      (cause: unknown) => {
        if (cancelled) return;
        setState({ kind: "unreadable", reason: describe(cause) });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [held, holdsNothing, storageState]);

  // **Where the platform has no store, the page says so once and this surface says nothing.** `BootFailure`
  // is already on screen in that case, and a second region claiming to hold addresses would be a claim the
  // page cannot support.
  if (held.kind !== "ready") return null;

  /**
   * **Nothing held, nothing rendered.**
   *
   * `LocalData` already states that this device keeps nothing, in the page's own words, beside the control
   * that changes it. A second sentence for the same fact is the defect this page has repaired before, and
   * an empty offer has nothing to say anyway. **The second clause is what a confirmed removal reaches**,
   * and it is why this check is not only about an empty collection: the removal control changes the page's
   * storage state, and the surface has to stop offering without asking the platform a question.
   */
  if (state.kind === "empty" || holdsNothing) return null;

  if (state.kind === "unreadable") {
    return (
      <section className="region region--alert" aria-labelledby="recent-mailboxes-heading">
        <h2 id="recent-mailboxes-heading">Addresses this browser remembers</h2>
        <p data-testid="recent-unreadable">
          This browser could not say which addresses it is holding, so none are offered here.
          Nothing was changed. {state.reason}
        </p>
      </section>
    );
  }

  return (
    <section className="region" aria-labelledby="recent-mailboxes-heading">
      <h2 id="recent-mailboxes-heading">Addresses this browser remembers</h2>

      {state.kind === "reading" && (
        <p data-testid="recent-reading">Checking what is stored here.</p>
      )}

      {state.kind === "held" && (
        <>
          {/*
            **One sentence, and it states no interval.** The mailbox a person came back for may or may not
            still work; that is a question for the provider, not for this page, and asking is what the
            controls below do.
          */}
          <p data-testid="recent-held">
            This browser is holding {state.mailboxes.length === 1 ? "one address" : "addresses"} you
            have used here. Each one is offered whatever the provider still lets it reach, so choose
            one to bring it up.
          </p>
          <ul>
            {state.mailboxes.map((mailbox) => {
              const verdict = unreachable[mailbox.id];
              const isCurrent = current !== null && current.id === mailbox.id;

              return (
                <li key={mailbox.id}>
                  <p>
                    <code>{mailbox.address}</code>
                  </p>

                  {verdict === "gone" && (
                    <p className="notice notice--danger" data-testid={`recent-gone-${mailbox.id}`}>
                      {RECENT_ADDRESS_GONE}
                    </p>
                  )}

                  {verdict === "unchecked" && (
                    <p className="notice" data-testid={`recent-unchecked-${mailbox.id}`}>
                      {RECENT_ADDRESS_UNCHECKED}
                    </p>
                  )}

                  {isCurrent ? (
                    // **No control, and its absence is the claim.** The address is on screen and working,
                    // or the session's own region is already saying why it is not.
                    <p data-testid={`recent-current-${mailbox.id}`}>
                      {verdict === undefined
                        ? "This is the address on this page."
                        : "This is on this page."}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="control"
                      data-testid={`recent-return-${mailbox.id}`}
                      onClick={() => {
                        onReturnTo(mailbox);
                      }}
                    >
                      {/**
                       * **Two labels, and the second is the one that matters.** A mailbox the provider has
                       * said it no longer recognises is not offered as though it worked, so its control asks
                       * rather than claims — which is the control `StoredAddressGone` already offers for the
                       * same fact.
                       *
                       * **And the second label is unreachable on the built page today, which is measured
                       * rather than assumed.** The page asks the provider about exactly one mailbox — the one
                       * the session holds — so the only mailbox it can mark is the one it is on, and that
                       * entry carries no control at all. The branch is left in because it is the one that
                       * would speak correctly if a surface ever marked a mailbox the page is not on, and
                       * what is asserted today is the mechanism that is actually in force: the marked entry
                       * carries no control. See the change's `design.md` D9.8.
                       */}
                      {verdict === undefined ? "Use this address" : "Check this address again"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * Turn whatever was thrown into a sentence the page can show.
 *
 * **A storage failure has no normalized code to map to**, because `spectre-storage` reports it as a
 * rejection rather than as a value — which is the right design and leaves nothing to normalize *to*.
 */
function describe(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) return cause.message;
  return String(cause);
}
