/**
 * What this browser remembers, and the one control that makes it forget.
 *
 * ## Why this is its own region and not a line in the limits list
 *
 * The limits list states what the page *cannot* do, and it did say the honest thing
 * here: that the address is kept on this device and no button deletes it. Adding a
 * button to that sentence would have produced a list item with a control in it, and a
 * `<ul>` of claims is the wrong shape for something a user acts on.
 *
 * The move is also the honest one. What this page does with local data is no longer a
 * limit — it is a capability, and capabilities belong where they can be used.
 *
 * ## Why the control appears only where it can act
 *
 * A "clear saved data" button on a device holding nothing is decorative, and the
 * sentence beside it would have to lie in one direction or the other: either it claims
 * something is stored when nothing is, or it offers to remove something that is not
 * there. So the region has three shapes, chosen by what is actually known:
 *
 * - something is stored — say what, say where, offer the removal;
 * - nothing is stored — say so, offer nothing;
 * - the page removed it just now — say what that means for a reload.
 *
 * **The third shape is not the second.** They are both true at the same instant and
 * they answer different questions: one is what a *visit* will find, the other is what
 * the user just did. A page that showed only "nothing is saved here" after someone
 * confirmed a removal would leave the user unable to tell whether the button had
 * worked.
 *
 * ## Why the page renders none of this until the boot has finished
 *
 * The component has three shapes and each needs something *established* first. `App`
 * renders it only once `boot` is `started`, because during the read the page knows
 * neither that something is stored nor that nothing is — and picking the `none` branch
 * from an unestablished value produces "Nothing is kept in this browser" on a page that
 * has not looked yet.
 *
 * That is worth naming because it is the fourth time this page has made a claim from a
 * value it had not established: it once gated the session on `boot === "started"`,
 * which made `SessionState`'s `idle` unreachable and therefore unsatisfiable; then the
 * gate that replaced it was "anything but blocked", which rendered *this* region during
 * the read. The failure is the same each time and it is a shape, not a slip — a branch
 * reachable on an unknown value is a branch that will eventually assert something
 * unverified.
 *
 * ## What a refusal is allowed to say — two things it may not say
 *
 * A removal blocked by another connection stays **queued**: it finishes on its own
 * once the holding connection closes. So when the platform refuses, the page may say
 * the removal **did not happen** — true at the moment it is told — and it may say
 * nothing about what is still there, in either direction.
 *
 * It may **not** say the data is still saved. The platform is already committed to
 * finishing that removal, and a promise that the product is about to break is worse
 * than no promise. It may **not** say the data has been removed, because it has not.
 * The copy below is therefore a three-way exclusion, and the assertions are on both
 * negatives rather than on the sentence, because a sentence can be reworded while the
 * claim stays wrong.
 *
 * ## Why the confirmation is two steps
 *
 * It is irreversible, and the address is very often the one a sign-up in progress is
 * waiting on. Creating a replacement does not recover it: anything already sent to the
 * old address is lost, and the sign-up that was waiting for it cannot be completed.
 *
 * **It is an inline second step rather than a native `confirm()`** — a native dialog
 * cannot be styled, is suppressed in some contexts, and cannot be driven by this
 * repository's tests, so asserting the product's behaviour around it would mean
 * asserting nothing.
 *
 * ## Why the page offers nothing at all when storage is blocked
 *
 * `App` renders this region only where `boot` is not `blocked`. A page that could not
 * read its own storage does not know whether it holds anything, and "Nothing is saved
 * in this browser" is then a claim it cannot support — which is the same failure in a
 * new place that `spectre-storage`'s "a read reported as absent means a client will
 * believe it is a first visit" requirement exists to prevent. `BootFailure` already
 * says what is actually true: it could not check.
 *
 * @module
 */

import { useState } from "react";

import type { LocalDataState } from "./useMailboxSession";

/**
 * The control's own condition, which is not the page's.
 *
 * **Separate from `localData` on purpose.** `localData` is a fact about the device;
 * this is a fact about what the user has done in the last few seconds. Folding them
 * together would give the binding a fourth axis to carry a field the component owns,
 * and would make "the device holds a record" and "the user just removed it" mutually
 * exclusive states of one value that are in fact simultaneously true.
 */
type ClearState =
  /** Nothing has been asked for. The control offers itself. */
  | { readonly kind: "idle" }
  /** The control is waiting for a second step. Nothing has been removed. */
  | { readonly kind: "confirming" }
  | { readonly kind: "clearing" }
  /** It was removed, and the page is saying what that means. */
  | { readonly kind: "removed" }
  /** It was not removed. `reason` is the platform's own words. */
  | { readonly kind: "refused"; readonly reason: string };

export interface LocalDataProps {
  /** Whether this device holds SpectreMail's record of the mailbox. */
  readonly localData: LocalDataState;
  /**
   * Remove it.
   *
   * **Returns a promise that rejects on failure, and this component does not swallow
   * it.** A page that reported a removal as having worked is the one outcome a privacy
   * control may not produce, and the only thing preventing it is the refusal arriving
   * here.
   */
  readonly clearStored: () => Promise<void>;
}

export function LocalData({ localData, clearStored }: LocalDataProps) {
  const [clear, setClear] = useState<ClearState>({ kind: "idle" });

  if (localData.kind === "stored") {
    return (
      <section aria-labelledby="local-data-heading">
        <h2 id="local-data-heading">What this browser remembers</h2>

        <p data-testid="local-data-stored">
          This browser is holding this address so a reload can bring it back. Nothing is sent
          anywhere to do it, and there is no copy of it on a server.
        </p>

        {clear.kind === "confirming" && (
          // **Both actions are named for what they do, and the destructive one is not
          // the default focus.** "Keep it" being second means a keyboard user who tabs
          // past the confirm lands somewhere safe.
          <div data-testid="local-data-confirmation">
            <p>
              Removing this cannot be undone. The address stays on screen and still works, but a
              reload will not bring it back.
            </p>
            <p>
              If another SpectreMail tab is open, the removal may not go through yet — close it and
              try again.
            </p>
            <button
              type="button"
              onClick={() => {
                setClear({ kind: "clearing" });
                void clearStored().then(
                  () => {
                    setClear({ kind: "removed" });
                  },
                  (cause: unknown) => {
                    setClear({
                      kind: "refused",
                      reason: cause instanceof Error ? cause.message : String(cause),
                    });
                  },
                );
              }}
            >
              Remove it
            </button>
            <button type="button" onClick={() => setClear({ kind: "idle" })}>
              Keep it
            </button>
          </div>
        )}

        {clear.kind === "refused" && (
          <p data-testid="local-data-refused">It was not removed. {clear.reason}</p>
        )}

        {clear.kind !== "confirming" && (
          <button
            type="button"
            disabled={clear.kind === "clearing"}
            onClick={() => setClear({ kind: "confirming" })}
          >
            Clear saved data
          </button>
        )}
      </section>
    );
  }

  if (clear.kind === "removed") {
    return (
      <section aria-labelledby="local-data-heading">
        <h2 id="local-data-heading">What this browser remembers</h2>
        {/* **The consequence is stated, because the mailbox is still on screen and a
            user who cleared it deserves to know what still works and what does not.**
            It says a reload will not bring *this* address back — not that the address
            is gone, which would be false: the provider still has it. */}
        <p data-testid="local-data-removed">
          Removed. This browser is not holding this address any more, so a reload will not bring
          this address back. The address above still works until the provider discards it.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="local-data-heading">
      <h2 id="local-data-heading">What this browser remembers</h2>
      <p data-testid="local-data-empty">
        Nothing. This browser is not holding an address for SpectreMail.
      </p>
    </section>
  );
}
