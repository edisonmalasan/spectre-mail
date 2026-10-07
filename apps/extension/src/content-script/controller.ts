/**
 * Watching a stranger's page for a field worth offering an address to.
 *
 * ## Two focus-ordering defects this controller was written into, both found by running it
 *
 * Neither is visible from reading the requirements, and both were found by pressing the control
 * in a real browser rather than by a failing assertion. They are recorded here because the
 * fixes look arbitrary without them — `cancelPendingRemoval()` and an identity test against two
 * elements each read as defensive noise until you know what they are defending against.
 *
 * **1. A deferred `focusout` teardown removed the *new* affordance.** `focusout` fires before
 * `focusin` when focus moves between fields, so a controller that removed the control on
 * `focusout` would show it and then take it away again the instant a person tabbed from one
 * address field to the next. The fix is to defer the removal by a task and cancel it when a
 * `focusin` arrives first — so the removal happens only when focus genuinely left.
 *
 * **2. Pressing the control moved focus onto it, and `focusin` arrived before `click`.** So the
 * controller tore down its own control before the press was delivered. The guard has to
 * recognise the press target as "still us", and **it cannot compare against one element**:
 * `event.target` at a document listener is **retargeted to the host**, because the button lives
 * in a shadow root and the event is composed. A check for the host alone passes; a check for the
 * button alone never matches. It is both.
 *
 * ## What is not claimed here
 *
 * **The address is read once, at start, and never re-read.** This slice's requirement is that an
 * already-stored address is offered; a mailbox created while the page stays open belongs to
 * slice 2, and a slice that silently watched for it would be doing slice 2's work in a place no
 * requirement describes.
 *
 * **A page cannot remove this listener**, which is deliberate — see `in-page-integration` for
 * what the product does and does not claim about the pages it runs on.
 *
 * @module
 */

import type { SpectreStorage } from "@spectre-mail/storage";

import { createAffordance } from "./affordance";
import type { Affordance } from "./affordance";
import { holdsText, isEmailField } from "./email-field";
import { insertAddress } from "./insert";

/** What this controller needs, and nothing more — one read, at start. */
export interface InPageOptions {
  /** The document to watch. Passed in so the unit tier can hand it a jsdom document. */
  readonly document: Document;
  /** The stored mailbox's reader. `saveMailbox` and `clearAll` are deliberately not offered. */
  readonly storage: Pick<SpectreStorage, "loadMailbox">;
  /**
   * Called when the read fails, with the reason in the platform's own words.
   *
   * **Called once, and the controller carries on with no address**, which is the same decision
   * `entry.ts` makes for a blocked store. A read that failed is not a mailbox that holds
   * nothing, so nothing is offered — but reporting nothing at all would leave a person staring
   * at an empty space where a control should have been.
   */
  readonly onBlocked?: (reason: string) => void;
}

/**
 * Start watching, and return the function that stops.
 *
 * **The document is watched, not the fields.** A page's form is built after this runs — the
 * content script loads at `document_idle`, and a single-page app swaps its whole form later —
 * so there is no field to attach to. `focusin` and `focusout` bubble, which is what makes one
 * listener for a form that does not exist yet enough.
 *
 * **The address arrives asynchronously, and a focus event can beat it.** Nothing is offered
 * until the read resolves, which is why the press handler re-checks `address` rather than
 * capturing it.
 */
export function startInPageIntegration(options: InPageOptions): () => void {
  const watched = options.document;

  let address: string | null = null;
  let current: Affordance | null = null;
  let pendingRemoval: ReturnType<typeof setTimeout> | undefined;

  void options.storage.loadMailbox().then(
    (mailbox) => {
      address = mailbox?.address ?? null;
    },
    (error: unknown) => {
      options.onBlocked?.(error instanceof Error ? error.message : String(error));
    },
  );

  /** Drop a scheduled removal, because focus has not in fact left. */
  function cancelPendingRemoval(): void {
    if (pendingRemoval !== undefined) {
      clearTimeout(pendingRemoval);
      pendingRemoval = undefined;
    }
  }

  /** Take the control away. Idempotent, because it is called from three places. */
  function removeCurrent(): void {
    current?.remove();
    current = null;
  }

  function onFocusIn(event: Event): void {
    // **`EventTarget` to `Element | null` and not `instanceof`.** A document-level
    // `focusin` carries whatever was focused, and a shadow root's host is an element while
    // nothing in the DOM guarantees an element at all. `isEmailField` is the narrowing that
    // matters and it does its own `tagName` check, so a cast here removes no safety: the one
    // caller that needs an element for a DOM operation guards it with `isEmailField` first.
    const target = event.target as Element | null;

    cancelPendingRemoval();

    // **Both elements, for defect 2 above.** `event.target` is retargeted to the host, so the
    // button check is what covers a future where the platform retargets differently, and the
    // host check is the one that actually fires today. Neither alone is correct.
    if (current !== null && (target === current.button || target === current.host)) {
      return;
    }

    // **A target the document no longer holds.** A node removed between dispatch and
    // delivery is still delivered, and `contains` is how a controller distinguishes that from a
    // person focusing something.
    if (!isEmailField(target) || !watched.contains(target)) {
      removeCurrent();
      return;
    }

    // **Nothing to offer, or something already there.** Both remove whatever control is up
    // rather than leaving a stale one beside a different field.
    if (holdsText(target) || address === null) {
      removeCurrent();
      return;
    }

    removeCurrent();

    const field = target;
    const created = createAffordance(() => {
      // **Re-checked at press time.** Between showing and pressing, the page can fill the field
      // — an autofill, a password manager — and writing then would destroy what it put there.
      if (address === null || holdsText(field)) {
        return;
      }
      insertAddress(field, address);
      removeCurrent();
    });

    current = created;
    field.insertAdjacentElement("afterend", created.host);
  }

  function onFocusOut(event: Event): void {
    const target = event.target as Element | null;

    // **Focus moving to the control's own host is not focus leaving**, so nothing is scheduled.
    if (current !== null && target instanceof HTMLElement && target.contains(current.host)) {
      return;
    }

    if (!isEmailField(target)) {
      return;
    }

    // **Deferred by one task, for defect 1 above.** `focusout` precedes the `focusin` of the
    // next focusable thing, so an immediate removal would take the control away from the field
    // focus is arriving at.
    cancelPendingRemoval();
    pendingRemoval = setTimeout(() => {
      pendingRemoval = undefined;
      removeCurrent();
    }, 0);
  }

  watched.addEventListener("focusin", onFocusIn);
  watched.addEventListener("focusout", onFocusOut);

  return () => {
    cancelPendingRemoval();
    watched.removeEventListener("focusin", onFocusIn);
    watched.removeEventListener("focusout", onFocusOut);
    removeCurrent();
  };
}
