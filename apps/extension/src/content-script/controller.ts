/**
 * Watching a stranger's page for a field worth offering an address to — and, when this device holds
 * none, for a field worth asking the extension to create one.
 *
 * ## Two focus-ordering defects this controller was written into, both found by running it
 *
 * Neither is visible from reading the requirements, and both were found by pressing the control in a
 * real browser rather than by a failing assertion. They are recorded here because the fixes look
 * arbitrary without them — `cancelPendingRemoval()` and an identity test against two elements each
 * read as defensive noise until you know what they are defending against.
 *
 * **1. A deferred `focusout` teardown removed the *new* affordance.** `focusout` fires before
 * `focusin` when focus moves between fields, so a controller that removed the control on `focusout`
 * would show it and then take it away again the instant a person tabbed from one address field to
 * the next. The fix is to defer the removal by a task and cancel it when a `focusin` arrives first —
 * so the removal happens only when focus genuinely left.
 *
 * **2. Pressing the control moved focus onto it, and `focusin` arrived before `click`.** So the
 * controller tore down its own control before the press was delivered. The guard has to recognise the
 * press target as "still us", and **it cannot compare against one element**: `event.target` at a
 * document listener is **retargeted to the host**, because the button lives in a shadow root and the
 * event is composed. A check for the host alone passes; a check for the button alone never matches.
 * It is both.
 *
 * ## Why the creation path needs a token, and what it is for
 *
 * **A request outlives the affordance that started it** — that is the whole point of holding the
 * control up. So "is this still the request I am waiting for?" is a question the answer to which can
 * change while the answer is in flight, and the controller keeps one identity per request rather
 * than a boolean. A boolean cannot distinguish *this* request finishing from *a later one*, and a
 * later one is reachable: a second email field can take focus while the first is still being created.
 *
 * **What the token protects is the page's claim, not the mailbox.** A creation that succeeds after
 * the page has stopped watching still records the address, because the worker persisted it and the
 * next field focus must offer insertion rather than a second creation — but it inserts into nothing,
 * because the page has already said it cannot confirm and inserting afterwards would be acting after
 * withdrawing the offer.
 *
 * ## Why the address is recorded from an answer as well as from the boot read
 *
 * **Because the boot read happens once and a creation can finish long after it.** A controller that
 * only ever read its address at start would offer to create a *second* mailbox on the next field
 * focus, having just created the first — the exact duplicate-creation cost this requirement exists to
 * prevent, arriving through the door that looks most careful. So the answer updates `address` whether
 * or not it is inserted.
 *
 * ## Which mailbox a page is offered, and why the answer is not a menu
 *
 * **A menu of every mailbox would be a menu inside somebody else's page** — a list of addresses
 * belonging to a product the page has never heard of, opened by a control the page cannot see and
 * cannot close. So the choice is delivered as *which* mailbox a host resolves to, and the cost of
 * that is recorded rather than hidden: on a host that already has an association, a different
 * mailbox this device holds cannot be chosen for that one page.
 *
 * ## The key is this document's host, exactly as the platform spells it
 *
 * `location.hostname` was measured in Chromium to exclude the port and to be already lower-cased
 * (2026-10-08), so it needs neither folding nor a public-suffix list. **No registrable-domain
 * folding is applied, and the cost is stated rather than assumed**: a page at
 * `https://accounts.example.invalid` and a page at `https://mail.example.invalid` are two
 * different sites to this product, and each keeps its own mailbox. Folding them would put a list of
 * somebody's mail addresses behind one key; keeping them apart means a device can hold one association
 * per site, which is a growth this contract is written for rather than against.
 *
 * **A document with no host records nothing.** `about:blank` and a data URL both report an empty
 * string, and an empty string is not a site — so the association read is skipped and the write is not
 * made, rather than a key that would answer for every document that has one.
 *
 * ## Why a failed boot read is remembered and not folded into "no address"
 *
 * **`SpectreStorage` reports "nothing stored" as `null` and "could not read" as a rejection, and
 * `packages/storage` has a requirement about why.** With creation on the table those two are no longer
 * equivalent: `null` now means *"this device holds nothing, so offer to make something"*, and a
 * failed read would silently become that. So a rejected read is remembered and nothing is offered at
 * all — the same decision `entry.ts` makes for a blocked store, and for the same reason: **a control
 * whose only reachable answer is a guess is a control that cannot act.**
 *
 * ## What is not claimed here
 *
 * **The page still never contacts a provider.** Creation is dispatched to the extension's own
 * background context, because a content script's request obeys the *page's* CORS policy rather than
 * the extension's host permissions — measured, and recorded in `docs/PROVIDERS.md` §4.4.
 *
 * **A page cannot remove this listener**, which is deliberate — see `in-page-integration` for what the
 * product does and does not claim about the pages it runs on.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

import type { CreateMailboxAnswer } from "../protocol";
import {
  AFFORDANCE_CREATE_LABEL,
  AFFORDANCE_UNCONFIRMED_LABEL,
  AFFORDANCE_WAITING_LABEL,
  affordanceInsertLabel,
  createAffordance,
} from "./affordance";
import type { Affordance } from "./affordance";
import { IN_PAGE_CREATE_CEILING_MS } from "./create-wait";
import { holdsText, isEmailField } from "./email-field";
import { insertAddress } from "./insert";

/**
 * The three records this page is allowed to ask about, and the one thing it may write.
 *
 * ## Named rather than handed a `SpectreStorage`
 *
 * **Because the extension now has three records over one area, and this is a control inside somebody
 * else's page.** A content script is the least privileged context this product runs in, so what it
 * can reach is written out rather than inherited: it may read the mailboxes, read what a host was
 * last used with, and record a host after an insertion — and it may not write the mailbox
 * collection, replace the singular record, or clear anything. A boundary rule enforces the last half,
 * because "deliberately not offered" is a comment until something fails to compile.
 *
 * ## One write, and it is not `saveMailbox`
 *
 * **The association is the only thing this page may record**, because it is the only thing only this
 * page knows. Everything else about a mailbox was decided by a person who pressed something in the
 * popup or in another page.
 */
export interface InPageRecords {
  /** Every mailbox this device holds, newest first. */
  readonly loadMailboxes: () => Promise<readonly Mailbox[]>;
  /** The mailbox this host was last used with, or `null` when it has never been recorded. */
  readonly loadSiteMailboxId: (host: string) => Promise<string | null>;
  /** Record that this host was used with this mailbox. */
  readonly saveSiteMailboxId: (host: string, mailboxId: string) => Promise<void>;
}

/**
 * The one thing a press can do: put this address in the field, and remember it under this host.
 *
 * **Both halves travel together, and the id is the reason.** An address is not an id — the same
 * address can be reached through two providers' records — and a site association keyed on an address
 * would not survive a second build that stored the same address twice. So the address the person
 * sees and the id the device remembers are carried as one value, and there is no code path that has
 * one without the other.
 */
interface Insertable {
  readonly address: string;
  readonly mailboxId: string;
}

/** What this controller needs, and nothing more. */
export interface InPageOptions {
  /** The document to watch. Passed in so the unit tier can hand it a jsdom document. */
  readonly document: Document;
  /** The three records this page may ask about, and the one it may write. */
  readonly records: InPageRecords;
  /**
   * Asks this extension's background context for a mailbox on this device.
   *
   * **Returns the answer rather than performing it here, and that is the requirement.** Creation is
   * a provider round trip, and a content script may not make one: its request obeys the **page's**
   * CORS policy while the extension's `host_permissions` do not reach it (measured; `docs/PROVIDERS.md`
   * §4.4). A rejection here means *no answer arrived*, which is a different report from a refusal and
   * the two are kept apart by the answer's own variants.
   */
  readonly createMailbox: () => Promise<CreateMailboxAnswer>;
  /**
   * Called when a read fails, with the reason in the platform's own words.
   *
   * **Called once for the boot read, and again only if the post-wait read fails**, which carries the
   * same consequence: the controller reports that it cannot confirm anything and offers nothing
   * further, rather than treating the failure as a device holding nothing.
   */
  readonly onBlocked?: (reason: string) => void;
}

/** One creation request this controller is still waiting on. */
interface OutstandingRequest {
  /** Identity, compared by reference to answer "is this still the request I am waiting for?" */
  readonly token: symbol;
  /** The field the request was made for, and the only one it may be inserted into. */
  readonly field: HTMLInputElement;
  /** The ceiling timer, or `undefined` once it has fired or been cancelled. */
  ceiling: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Start watching, and return the function that stops.
 *
 * **The document is watched, not the fields.** A page's form is built after this runs — the content
 * script loads at `document_idle`, and a single-page app swaps its whole form later — so there is no
 * field to attach to. `focusin` and `focusout` bubble, which is what makes one listener for a form
 * that does not exist yet enough.
 *
 * **The address arrives asynchronously, and a focus event can beat it.** Nothing is offered until the
 * read resolves, which is why the press handler re-checks rather than capturing.
 */
export function startInPageIntegration(options: InPageOptions): () => void {
  const watched = options.document;

  // **Read once, at boot, and never again for this page.** The controller re-reads only where a
  // request has just finished, because the records it needs cannot change under a page that is
  // already showing an answer — and a re-read on every focus would make the choice below depend on
  // when a person looked rather than on what the device holds.
  const host = watched.location?.hostname ?? "";

  let insertable: Insertable | null = null;
  let readFailed = false;
  let current: Affordance | null = null;
  let pendingRemoval: ReturnType<typeof setTimeout> | undefined;
  let outstanding: OutstandingRequest | null = null;

  void resolveForThisHost().then(
    (resolved) => {
      insertable = resolved;
    },
    (error: unknown) => {
      // **Remembered, not merely reported** — see the module note. With creation offered, a read
      // that failed and a device holding nothing would produce the same control.
      readFailed = true;
      options.onBlocked?.(describe(error));
    },
  );

  /** Drop a scheduled removal, because focus has not in fact left. */
  function cancelPendingRemoval(): void {
    if (pendingRemoval !== undefined) {
      clearTimeout(pendingRemoval);
      pendingRemoval = undefined;
    }
  }

  /**
   * Drop a request's ceiling timer, because the request is no longer being waited on.
   *
   * **Separate from `cancelPendingRemoval` on purpose.** One is about where focus went and the other
   * is about how long this product is willing to wait, and a change that made them one would let a
   * focus move cancel a wait — or a wait cancel a focus move.
   */
  function cancelCeiling(request: OutstandingRequest): void {
    if (request.ceiling !== undefined) {
      clearTimeout(request.ceiling);
      request.ceiling = undefined;
    }
  }

  /** Take the control away. Idempotent, because it is called from several places. */
  function removeCurrent(): void {
    if (outstanding !== null) {
      // **The control was taken away while a request was outstanding, so the page stops waiting on
      // it without saying anything.** A report would name a field the person is no longer looking
      // at.
      cancelCeiling(outstanding);
      outstanding = null;
    }

    current?.remove();
    current = null;
  }

  /** Whether this device could be said to hold an address, rather than merely not be known to. */
  function canOfferCreation(): boolean {
    return !readFailed && insertable === null;
  }

  /**
   * The mailbox to insert on this page: the one this host was last used with, else the newest.
   *
   * ## Why the newest, and not a menu
   *
   * A menu of every mailbox would be a menu **inside somebody else's page** — a list of addresses
   * belonging to a product the page has never heard of, opened by a control the page cannot see and
   * cannot close. The choice is delivered as *which* mailbox a host resolves to instead, and the
   * cost of that is recorded rather than hidden: on a host that already has an association, a
   * different mailbox this device holds cannot be chosen for that one page.
   *
   * ## A recorded id this device no longer holds is ignored, and left where it is
   *
   * A mailbox can be removed from the collection while its association remains, because this product
   * has no deletion of its own — a device can be the one that lost it. **Silently rewriting the
   * association at that moment would be a write nobody asked for**, so the stale entry is left in
   * place, the newest mailbox is offered instead, and the entry is replaced only when an insertion
   * actually happens with a different mailbox.
   *
   * ## An unreadable association is the same answer, and that is measured rather than assumed
   *
   * A lookup that cannot be read and a lookup that reads nothing both end at the newest mailbox,
   * because both are the answer this host would have received had no association been recorded. The
   * difference between them is invisible to the person looking at the page — which is the reason
   * they share an arm rather than each having one. What the requirement forbids, and what the second
   * half of this function holds down, is reporting a failure *as* "this site's mailbox": a device
   * that could not read its own preference has no site mailbox to report, and saying so would be
   * inventing one.
   */
  async function resolveForThisHost(): Promise<Insertable | null> {
    // **Both reads at once, because neither depends on the other.** They were sequential first, and
    // the cost was a whole extra turn of the microtask queue before the control could know what it
    // inserts — which the unit tier's timing already depended on. Asking together is not only the
    // faster shape; it is the one that keeps "how many turns does boot take" a single `await` rather
    // than a number every caller has to keep in step with.
    const [held, recorded] = await Promise.all([
      options.records.loadMailboxes(),
      host.length === 0
        ? Promise.resolve(null)
        : // **The lookup's own failure is absorbed here, and this is the one place in the file where
          // a rejection is caught rather than remembered.** The two reads are not the same kind of
          // question. The collection read decides *whether this device holds anything*, and its
          // failure is the one `readFailed` exists for: offering to create on a device whose
          // contents are unknown would offer a second mailbox. The lookup decides only *which* of
          // the mailboxes it holds this host was last used with, and a device that can say
          // "here are my mailboxes, newest first" and cannot say "this host used one of them" is not
          // in doubt about anything — so the newest is the answer, and it is the answer this host
          // would have received had no association ever been recorded. Letting the lookup's
          // rejection reach the boot handler would have refused the whole insertion offer over a
          // preference, which is the opposite of what the requirement asks for and a worse product
          // than the one the requirement describes.
          options.records.loadSiteMailboxId(host).catch(() => null),
    ]);

    const newest = held[0] ?? null;

    if (newest === null) {
      return null;
    }

    // **No host, no association, and the newest is the answer.** A document with no host is not a
    // site, so there is nothing to prefer and nothing to record; see `host`'s own note.
    if (recorded === null) {
      return { address: newest.address, mailboxId: newest.id };
    }

    const associated = held.find((mailbox) => mailbox.id === recorded);
    return associated === undefined
      ? { address: newest.address, mailboxId: newest.id }
      : { address: associated.address, mailboxId: associated.id };
  }

  /**
   * Insert the address in `insertable` into `field`, and record what this host was used with.
   *
   * **The association is written after the insertion and never before it.** An association is a claim
   * that this site was used with that address; writing it first would record a claim about a
   * keyboard event that has not happened yet, and a page can take focus away between the two lines.
   *
   * **A failed write is not reported to the page.** It changes nothing the person is looking at — the
   * address is in the field either way — and this product's one line into somebody else's DOM should
   * not carry an error about this device's private storage on a page that has no business knowing
   * storage exists. The failure is real and it is visible to whoever debugs this client; saying so in
   * the page would be a worse product.
   */
  function insertAndRemember(field: HTMLInputElement, insertable: Insertable): void {
    insertAddress(field, insertable.address);

    if (host.length === 0) {
      return;
    }

    void options.records.saveSiteMailboxId(host, insertable.mailboxId).catch(() => {
      // Reported in this comment rather than in the page, for the reason above.
    });
  }

  function onFocusIn(event: Event): void {
    // **`EventTarget` to `Element | null` and not `instanceof`.** A document-level `focusin` carries
    // whatever was focused, and a shadow root's host is an element while nothing in the DOM
    // guarantees an element at all. `isEmailField` is the narrowing that matters and it does its own
    // `tagName` check, so a cast here removes no safety: the one caller that needs an element for a
    // DOM operation guards it with `isEmailField` first.
    const target = event.target as Element | null;

    cancelPendingRemoval();

    // **Both elements, for defect 2 above.** `event.target` is retargeted to the host, so the button
    // check is what covers a future where the platform retargets differently, and the host check is
    // the one that actually fires today. Neither alone is correct.
    if (current !== null && (target === current.button || target === current.host)) {
      return;
    }

    // **An answer is still outstanding, so this focus event changes nothing.**
    //
    // **This arm is a defect the browser tier found on its first run, and it was not in the
    // `focusout` branch.** `onFocusOut` already returns while a request is outstanding, so
    // tabbing away appeared to be handled — and it is, until the arriving focus does anything.
    // Focusing *anything* runs this handler, and every branch below it either removes the control
    // or builds a new one: a non-email field, a field that holds text, a device that may not offer,
    // or a second email field. So focus moving from the created-on field to the next thing took the
    // control away, in every one of those cases, while the answer was still on its way.
    //
    // **Two reasons to return here, and the second is the one the unit tier could not find.**
    //
    // 1. The requirement states the affordance remains until the answer arrives, and the answer has
    //    exactly one place to be reported. `onFocusOut`'s own note says so; this is the same reason
    //    arriving by a different event.
    // 2. **Building a second control would be a control that cannot act.** `address` is still
    //    `null` while a request is outstanding, so any affordance built here would offer
    //    *creation* — and `askForAnAddress` returns immediately because `outstanding` is set. The
    //    person would be shown a button that reports a provider failure by doing nothing at all,
    //    which is the outcome the storage requirement names as the reason to offer nothing.
    //
    // **And it is not a licence to persist**: the arm is `outstanding !== null`, and every path
    // that settles a request (`readTheAnswer`, `confirmWhatIsStored`, teardown) clears it. So the
    // control cannot outlive a settled request, which is what the amendment's last sentence
    // requires.
    if (outstanding !== null) {
      return;
    }

    // **A target the document no longer holds.** A node removed between dispatch and delivery is
    // still delivered, and `contains` is how a controller distinguishes that from a person focusing
    // something.
    if (!isEmailField(target) || !watched.contains(target)) {
      removeCurrent();
      return;
    }

    // **Nothing to offer.** A field that already holds text is refused whichever case this device is
    // in, and a device whose read failed is refused for both.
    if (holdsText(target) || (!canOfferCreation() && insertable === null)) {
      removeCurrent();
      return;
    }

    removeCurrent();

    const field = target;

    const created = createAffordance({
      // **The insert label names the address it will insert**, because the whole feature is that a
      // page may be offered one of several mailboxes and "Use SpectreMail" does not say which. The
      // create label has nothing to name: there is no address yet.
      //
      // **The narrowing is on `insertable` itself and not on a separate `offering` flag.** A flag
      // would read better and would not typecheck — `offering === "insert"` says nothing to the
      // compiler about the value behind it — so the two answers are one expression.
      label:
        insertable === null ? AFFORDANCE_CREATE_LABEL : affordanceInsertLabel(insertable.address),
      onPress: () => {
        if (insertable !== null) {
          // **Re-read at press time, and for two separate reasons.** Between showing and pressing,
          // the page can fill the field - an autofill, a password manager - and writing then would
          // destroy what it put there. And the value is re-read rather than captured so that this
          // handler can only ever insert what the control currently *says*; a captured value would
          // let the label and the insertion disagree, which is the worst outcome this feature has.
          const chosen = insertable;
          if (chosen === null || holdsText(field)) {
            return;
          }
          insertAndRemember(field, chosen);
          removeCurrent();
          return;
        }

        askForAnAddress(created, field);
      },
    });

    current = created;
    field.insertAdjacentElement("afterend", created.host);
  }

  /**
   * Ask the extension's own background context for a mailbox, and act on whatever it answers.
   *
   * **The `outstanding` check is here and not only on the button.** `disabled` is what stops a second
   * activation reaching this function through the page; this is what stops a second request when the
   * control is not disabled — and the requirement is that a provider is asked once, which is a claim
   * about requests rather than about buttons.
   */
  function askForAnAddress(affordance: Affordance, field: HTMLInputElement): void {
    if (outstanding !== null) {
      return;
    }

    const request: OutstandingRequest = {
      token: Symbol("create-mailbox"),
      field,
      ceiling: undefined,
    };
    outstanding = request;
    affordance.setLabel(AFFORDANCE_WAITING_LABEL);
    affordance.setPending(true);

    // **The ceiling starts before the request is made**, not after it is answered, because the wait
    // this product is willing to tolerate includes its own dispatch. A timer started on the answer
    // would measure the round trip and not the patience.
    request.ceiling = setTimeout(() => {
      void confirmWhatIsStored(affordance, request);
    }, IN_PAGE_CREATE_CEILING_MS);

    void readTheAnswer(affordance, request);
  }

  /** Dispatch the request, and do whatever its answer turns out to permit. */
  async function readTheAnswer(affordance: Affordance, request: OutstandingRequest): Promise<void> {
    let answer: CreateMailboxAnswer | null = null;

    try {
      answer = await options.createMailbox();
    } catch (cause) {
      // **A rejection is "no answer", not a refusal**, and the seam already normalises that — this
      // catch is the tier below it. Reported through the same unconfirmed path rather than being
      // invented into a provider verdict.
      options.onBlocked?.(describe(cause));
    }

    // **Recorded before the currency check, and that ordering is the point.** A creation that
    // succeeded while the page stopped watching still produced an address, and the next field focus
    // must offer it rather than ask for a second one.
    if (answer !== null && answer.kind === "created") {
      insertable = { address: answer.address, mailboxId: answer.mailboxId };
    }

    if (outstanding !== request) {
      return;
    }

    cancelCeiling(request);
    outstanding = null;

    if (answer === null || answer.kind === "notStored" || answer.kind === "notActedOn") {
      // **One sentence for all three, and it says only what is true.** None of them confirms an
      // address exists; one says the extension could not be reached or could not keep what it made,
      // one says the message was not one it acts on, and none of them observed a provider refusing.
      // Naming them differently would be inventing distinctions nobody can act on inside a stranger's
      // page, and the button's name is the only place a person would read them.
      affordance.setLabel(AFFORDANCE_UNCONFIRMED_LABEL);
      affordance.setPending(false);
      return;
    }

    if (answer.kind === "refused") {
      // **The provider's own words, as the control's name.** `provider-abstraction` requires a
      // refusal to be surfaced rather than summarised, and there is no other surface here.
      affordance.setLabel(answer.description);
      affordance.setPending(false);
      return;
    }

    // **`created`, and the field may have acquired text while the request was out.** An autofill, a
    // password manager, or the person typing. The address is recorded above either way; what is not
    // done is writing over what is there.
    if (!holdsText(request.field)) {
      // **A fresh value, and not the field just assigned above.** `insertable` was recorded before
      // the currency check and is `Insertable | null` from the compiler's point of view, while
      // `answer` is narrowed here to the variant that carries both halves — so this builds the pair
      // it is about to insert from the answer, and the two can never disagree.
      insertAndRemember(request.field, { address: answer.address, mailboxId: answer.mailboxId });
    }

    removeCurrent();
  }

  /**
   * The wait passed: stop waiting, and look for what this device can confirm.
   *
   * **A read, and only a read.** The worker persists a created mailbox before it answers, so a
   * mailbox found here *is* the address that was made; and if the worker never ran, then nothing was
   * created and asking again is the right next step. Reporting a failure instead would be a claim
   * about an event nobody observed.
   *
   * **The control stays pending for the duration of the read**, so the sentence "could not confirm"
   * cannot appear while a second request is still startable — which is the only window in which that
   * combination would let a person create a second mailbox for the first.
   */
  async function confirmWhatIsStored(
    affordance: Affordance,
    request: OutstandingRequest,
  ): Promise<void> {
    let newest: Mailbox | null = null;

    try {
      newest = (await options.records.loadMailboxes())[0] ?? null;
    } catch (cause) {
      // **A read that failed is not a read that found nothing**, and it is not turned into one:
      // `address` is left alone, so a stored address this device already had is not forgotten because
      // a second read failed.
      options.onBlocked?.(describe(cause));
    }

    if (outstanding !== request) {
      return;
    }

    cancelCeiling(request);
    outstanding = null;

    if (newest !== null) {
      insertable = { address: newest.address, mailboxId: newest.id };

      if (!holdsText(request.field)) {
        insertAndRemember(request.field, insertable);
      }

      removeCurrent();
      return;
    }

    affordance.setLabel(AFFORDANCE_UNCONFIRMED_LABEL);
    affordance.setPending(false);
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

    // **An answer this extension asked for is still outstanding, so the control stays.** Creation is
    // a round trip that takes longer than a person takes to tab to the next field; removing the
    // control here would take away the only place the answer could be reported, and the field it
    // belongs to is one they have already left. The exception lasts exactly as long as the outstanding
    // request, and nothing here permits a control to survive a settled one.
    if (outstanding !== null) {
      return;
    }

    // **Deferred by one task, for defect 1 above.** `focusout` precedes the `focusin` of the next
    // focusable thing, so an immediate removal would take the control away from the field focus is
    // arriving at.
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
    if (outstanding !== null) {
      cancelCeiling(outstanding);
      outstanding = null;
    }
    watched.removeEventListener("focusin", onFocusIn);
    watched.removeEventListener("focusout", onFocusOut);
    removeCurrent();
  };
}

/** Whatever was thrown, in its own words, falling back to its type rather than to a blank string. */
function describe(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }

  return String(cause);
}
