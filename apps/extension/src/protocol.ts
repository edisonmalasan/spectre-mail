/**
 * What one extension context may ask another, and what it may be told.
 *
 * ## Why this is its own module, and why neither context imports the other
 *
 * The background worker and the content script have to agree on two shapes, and the only thing
 * that makes agreement enforceable is **one file both of them read**. Putting the shapes beside
 * the worker would make the content script import the worker, and the content script is loaded by
 * Chromium as a single classic script whose bundle is built by a **different** Vite entry
 * (`vite.content.config.ts`). A cross-context import would drag the worker's composition — and
 * through it the provider adapters and the transport — into the script that runs on every page.
 *
 * **The inverse is worse.** Putting the shapes beside the content script would drag a React
 * component and a `document` into the background worker.
 *
 * ## What this module deliberately does not know
 *
 * **It carries no logic about what an answer means, only what shapes are admissible.** The
 * decision "is this answer one I can act on" is a single narrowing function, and it is the same
 * function on both sides — which is why a malformed reply cannot be interpreted differently
 * depending on which context received it.
 *
 * ## Why the answer is validated at all, when both sides are this product's own code
 *
 * **`chrome.runtime.sendMessage` answers with whatever the other side put there, untyped, and
 * "the other side" is not a fact about the code — it is a fact about the message channel.** A
 * page is arbitrary input to a content script; a content script is arbitrary input to a worker;
 * and a future context added in a later milestone becomes a third writer of this union without
 * anyone editing this file. A type annotation on the *request* alone would leave the *answer*
 * unchecked, and the answer is the half that reaches a person's form.
 *
 * **The narrowing returns `null` rather than throwing, and every unrecognised shape becomes
 * `null`.** A reply that is not one of these answers is not a *worse* answer, it is **no answer**,
 * and `no answer` is already a named state the page knows how to report honestly. Throwing here
 * would turn a malformed reply into an exception escaping into a document keypress handler on
 * somebody else's page.
 *
 * ## Why the answer carries the provider's words rather than this product's summary of them
 *
 * `provider-abstraction` requires throttling to be **surfaced, not silently retried**, and
 * `apps/web`'s limits region reports a provider's own verbatim statement with its scope
 * disclaimed. A summary written here would be a second thing that can disagree with the provider,
 * and the page would have no way to tell which of the two it was reading.
 *
 * @module
 */

/** Discriminates a request for the background context to create a mailbox. */
export const CREATE_MAILBOX_REQUEST_KIND = "spectre:create-mailbox";

/**
 * Discriminates a request for the background context to reconcile its schedule.
 *
 * **A second kind between the popup and the worker, and it exists because a browser case found that
 * the popup's own mailbox write reached no arming.** The popup creates a mailbox in its own context
 * and writes the collection itself (`Popup.tsx`), so the worker's arming — which hangs off the answer
 * to a *delegated* creation — never ran for the path a person actually uses. A device that had just
 * created an address sat with **no alarm at all** until the next browser start.
 *
 * **The request carries nothing**, for the same reason `CreateMailboxRequest` carries nothing: the
 * answering context reads its own storage rather than being told what the asking context believed.
 * A payload here would be a second copy of a fact the worker is about to look up, and the two could
 * disagree.
 */
export const RECONCILE_ALARM_REQUEST_KIND = "spectre:reconcile-alarm";

/**
 * Discriminates a request for a one-time code to be put into a page's own field.
 *
 * **A second kind on the same channel rather than a second channel**, because `design.md` D4
 * records that the one thing this needs is a tab id and a message, and both already exist. The
 * worker is not in this path at all, so the seam this travels over is `chrome.tabs.sendMessage`
 * from the popup to the content script, and the content script's own `runtime.onMessage`.
 */
export const FILL_CODE_REQUEST_KIND = "spectre:fill-code";

/**
 * Discriminates a request for the host of the page this script is beside.
 *
 * **A fourth kind on the same channel, and it travels the same seam as the fill does not.**
 * `design.md` D4 measures it: the panel asks the page's own content script over
 * `chrome.tabs.sendMessage`, because `tab.url` is withheld to a panel holding no `tabs` permission
 * while the content script already has the answer in `location`. **So this request needs no payload
 * and no new transport** - the requester names a tab by asking {@link
 * ../extension-platform!findActiveTab}, and the message itself asks the same question every time.
 *
 * **It carries nothing, and that is the point rather than an omission.** A request carrying the tab
 * it meant to ask about would be a second copy of a fact the caller already resolved, and the two
 * could disagree - which is the reason `CREATE_MAILBOX_REQUEST` and `RECONCILE_ALARM_REQUEST` carry
 * nothing either.
 */
export const HOST_CONTEXT_REQUEST_KIND = "spectre:host-context";

/** A request for the background context to create a mailbox on this device's behalf. */
export interface CreateMailboxRequest {
  readonly kind: typeof CREATE_MAILBOX_REQUEST_KIND;
}

/**
 * A request for the host of the page the answering script is beside.
 *
 * **One discriminant and nothing else, for the same reason {@link ReconcileAlarmRequest} has one
 * member:** the host is a fact about the document the script is already in, so asking a script to
 * send it would be asking it to report something it was handed. `protocol.test.ts` reads this
 * interface's keys rather than trusting this comment.
 */
export interface HostContextRequest {
  readonly kind: typeof HOST_CONTEXT_REQUEST_KIND;
}

/** A request for the background context to reconcile the schedule it holds for this device. */
export interface ReconcileAlarmRequest {
  readonly kind: typeof RECONCILE_ALARM_REQUEST_KIND;
}

/**
 * The one value sent for a reconciliation request.
 *
 * **A constant rather than a literal at each call site**, for the reason
 * {@link CREATE_MAILBOX_REQUEST} gives: the two sides cannot disagree by one of them being edited.
 * **Its having no other field is the point**, and `protocol.test.ts` reads its keys rather than
 * trusting this comment.
 */
export const RECONCILE_ALARM_REQUEST: ReconcileAlarmRequest = {
  kind: RECONCILE_ALARM_REQUEST_KIND,
};

/**
 * The one value sent for a creation request.
 *
 * **A constant rather than a literal at each call site**, so the two sides cannot disagree by
 * one being edited — which is the same reason `AFFORDANCE_LABEL` is exported from
 * `content-script/affordance.ts` rather than repeated in both tiers.
 */
export const CREATE_MAILBOX_REQUEST: CreateMailboxRequest = { kind: CREATE_MAILBOX_REQUEST_KIND };

/**
 * The one value sent for a host request.
 *
 * **A constant, for the reason {@link CREATE_MAILBOX_REQUEST} is one and {@link fillCodeRequest} is
 * a function:** this request carries no payload, so there is nothing for the two sides to disagree
 * about but the spelling of the kind.
 */
export const HOST_CONTEXT_REQUEST: HostContextRequest = { kind: HOST_CONTEXT_REQUEST_KIND };

/**
 * Everything the background context can answer, and nothing it cannot.
 *
 * **Four variants, and the shape of the union is the claim.** Each refusal is a *named* variant
 * carrying what is known, so a caller cannot read an absence as a failure or a failure as a
 * success. `notStored` and `notActedOn` are separate because they are different facts: one says
 * a mailbox may exist but this device has no note of it, the other says nothing was asked of a
 * provider at all.
 */
export type CreateMailboxAnswer =
  /**
   * A mailbox was created, the provider confirmed it, and it is stored. `address` is usable.
   *
   * **`mailboxId` is carried with it, and that is an amendment recorded during apply.** The answering
   * context already has the whole mailbox — `addMailbox` was awaited before this answer was built — so
   * the id is in hand and costs nothing to send. It is needed because the page records which mailbox a
   * host was last used with, and an address is not an id: the same address reached through two
   * providers' spellings is still one record, and a lookup keyed on the address would find neither.
   * The alternative was a second read of the collection in the content script after every creation,
   * which is a round trip on a stranger's page to recover a value the reply was already built beside.
   */
  | { readonly kind: "created"; readonly address: string; readonly mailboxId: string }
  /** A provider refused. `description` is its own words, not a summary written here. */
  | { readonly kind: "refused"; readonly description: string }
  /** Created or refused, but this device could not be told, so there is no address to offer. */
  | { readonly kind: "notStored" }
  /** The message was not one this context acts on. Nothing was created and nothing persisted. */
  | { readonly kind: "notActedOn" };

/**
 * A request for one particular one-time code to be put into a page's field.
 *
 * **`code` is carried rather than implied,** because a delivery that asked for *a* code and the
 * page chose which would be a second decision made on somebody else's page. The popup named this
 * code to the person, so this is the code.
 */
export interface FillCodeRequest {
  readonly kind: typeof FILL_CODE_REQUEST_KIND;
  readonly code: string;
}

/**
 * The value sent for a fill, and **a function rather than a constant**.
 *
 * **A constant would be a request with no code in it**, and the constant's own reason for existing
 * — one spelling both sides read — is already spent on `CREATE_MAILBOX_REQUEST`, whose request has
 * no payload. This one does.
 *
 * @param code - The code the person activated a control for. It is sent verbatim: a code this
 *   product altered is a code the provider did not issue.
 */
export function fillCodeRequest(code: string): FillCodeRequest {
  return { kind: FILL_CODE_REQUEST_KIND, code };
}

/**
 * Whether `value` is a fill request carrying a code this extension would put into a page.
 *
 * **A check on the payload as well as the discriminant, and the reason is which end this is read
 * at.** This runs inside the content script, on whatever the message channel delivered — a page is
 * arbitrary input to a content script, and the content script's own message channel is reachable
 * from every extension page this extension has. **A request whose `code` is absent is refused
 * rather than narrowed to a request with no code in it**, because the only thing this request does
 * is carry that code, and a narrowing that admitted it would insert `undefined` into somebody's
 * signup form.
 */
export function isFillCodeRequest(value: unknown): value is FillCodeRequest {
  return readKind(value) === FILL_CODE_REQUEST_KIND && readText(value, "code") !== null;
}

/**
 * Everything a page can answer about a code it was sent, and nothing it cannot.
 *
 * **Six variants, and the shape of the union is the claim.** Each is a *distinct fact about the
 * page*, because the popup has one line to report it with and a person reading it has to be able
 * to act on the difference. `filled` is the only one that says the code went somewhere.
 *
 * **`notActedOn` is the shape the creation union already has**, kept deliberately: a content
 * script always receives this extension's own recognised requests, so the variant is unreachable
 * from a browser case and is exercised by unit cases instead — and it is what an unrecognised
 * message becomes, so a message nobody acts on can never be reported as something else.
 */
export type FillCodeAnswer =
  /** The code is now the field's value, and the page's own code reads it back. */
  | { readonly kind: "filled" }
  /** More than one field qualified and the person has not chosen yet, so nothing was filled. */
  | { readonly kind: "asked" }
  /** No field on this page is a one-time-code field. Nothing was placed anywhere. */
  | { readonly kind: "noField" }
  /** The only qualifying field already holds text, so nothing was inserted into it. */
  | { readonly kind: "fieldHoldsText" }
  /** This document is not the page's top-level one, so nothing was filled from it. */
  | { readonly kind: "notTopFrame" }
  /** The message was not one this context acts on. Nothing was placed anywhere. */
  | { readonly kind: "notActedOn" };

/**
 * Whether `value` is a request this extension acts on.
 *
 * **Checks the discriminant and nothing else, because there is nothing else.** A request is a
 * single literal field; anything stricter would be guarding a shape that cannot yet exist, and
 * anything looser would let a message with a matching `kind` through — which is exactly what
 * happens to every extension message the browser itself routes here.
 */
export function isCreateMailboxRequest(value: unknown): value is CreateMailboxRequest {
  return readKind(value) === CREATE_MAILBOX_REQUEST_KIND;
}

/**
 * Whether `value` is the reconciliation request this extension acts on.
 *
 * **The same question as {@link isCreateMailboxRequest}, asked of a second discriminant, and the
 * two guards must not overlap.** The worker's own dispatch reaches every one of this file's guards,
 * so a message that satisfied two of them would be taken by whichever branch it reached first — and
 * a create request that also armed the alarm would put a second copy of the same mailbox in
 * front of a person who asked for one.
 *
 * **Only `kind` is checked, and the reason is that there is nothing else to check.** The request
 * carries no payload, so a stricter guard would be guarding a shape that cannot yet exist, and a
 * looser one would admit every extension message the browser itself routes here — an unrelated
 * extension's word arming this one's schedule. Checking a discriminant cannot misread a different
 * kind: `readKind` compares against a literal, so the two guards are disjoint by construction
 * rather than by ordering.
 *
 * @param value - Whatever the message channel delivered. Untyped by construction.
 */
export function isReconcileAlarmRequest(value: unknown): value is ReconcileAlarmRequest {
  return readKind(value) === RECONCILE_ALARM_REQUEST_KIND;
}

/**
 * Whether `value` is the host request this extension acts on.
 *
 * **The same question {@link isCreateMailboxRequest} and {@link isReconcileAlarmRequest} ask, of a
 * third discriminant, and it is checked on the content script's own message channel.** That channel
 * is reached by every extension message the browser routes here, so a guard that admitted anything
 * wider than the discriminant would let an unrelated extension's word make this script report its
 * host. **Three guards that are each one `readKind` comparison cannot overlap**, because `readKind`
 * compares against a literal string - disjointness is structural here rather than a property of the
 * order they are tried in.
 *
 * @param value - Whatever the message channel delivered. Untyped by construction.
 */
export function isHostContextRequest(value: unknown): value is HostContextRequest {
  return readKind(value) === HOST_CONTEXT_REQUEST_KIND;
}

/**
 * Narrow an untrusted reply to an answer, or `null` where there is none to be had.
 *
 * **Every field is checked, not only the discriminant.** A reply of `{"kind":"created"}` with no
 * `address` is the shape a future edit would most plausibly produce by making a field optional,
 * and narrowing it to `created` would put `undefined` into somebody's signup form. Each variant
 * carries a payload, so each payload is verified — and `null` is what a caller already knows how
 * to report as "could not confirm".
 *
 * @param value - Whatever the message channel delivered. Untyped by construction.
 * @returns The answer, or `null` when the value is not one this extension can act on.
 */
export function readCreateMailboxAnswer(value: unknown): CreateMailboxAnswer | null {
  const kind = readKind(value);

  switch (kind) {
    case "created": {
      const address = readText(value, "address");
      const mailboxId = readText(value, "mailboxId");
      // **Both payloads are required, and the id is required rather than defaulted.** An answer with
      // an address and no id would be an address this page could insert but not remember, which is the
      // one state the caller has no honest report for — so it is refused and becomes "no answer".
      return address === null || mailboxId === null
        ? null
        : { kind: "created", address, mailboxId };
    }
    case "refused": {
      const description = readText(value, "description");
      return description === null ? null : { kind: "refused", description };
    }
    // **The two payload-free variants are admitted on their discriminant alone**, which is not a
    // shortcut: a payload-free variant cannot carry a wrong payload, and demanding one would
    // reject the correct answer.
    case "notStored":
    case "notActedOn":
      return { kind };
    default:
      // **Every other shape, including `undefined`, a thrown error, a string and a number.** An
      // instrument that answers confidently and wrongly is worse than one that declines.
      return null;
  }
}

/**
 * Narrow an untrusted reply about a delivery to an answer, or `null` where there is none.
 *
 * **Payload-free variants admitted on their discriminant alone**, for the same reason the creation
 * narrower's are: a payload-free variant cannot carry a wrong payload, and demanding one would
 * reject the correct answer. The one variant carrying a payload is {@link FillCodeAnswer} `filled`,
 * which carries none — so **every variant of this union is payload-free, and that is a claim about
 * the union rather than an accident of this function.** A future variant that does carry a payload
 * has to add its check here, and the union's shape is what makes that visible in review.
 *
 * @param value - Whatever the message channel delivered from the page. Untyped by construction.
 * @returns The answer, or `null` when the value is not one this extension can act on.
 */
export function readFillCodeAnswer(value: unknown): FillCodeAnswer | null {
  const kind = readKind(value);

  switch (kind) {
    case "filled":
    case "asked":
    case "noField":
    case "fieldHoldsText":
    case "notTopFrame":
    case "notActedOn":
      return { kind };
    default:
      // **Every other shape, including `undefined`, an exception, a string and a number.** A reply
      // this extension does not recognise is **no answer**, and the popup already has a named
      // report for no answer: it cannot confirm the code was filled.
      return null;
  }
}

/**
 * Everything this extension's own script can say about the page it is beside, and nothing else.
 *
 * **Two variants, and the second one is not a failure - it is the answer.** `design.md` D4: a script
 * that answers nothing **resolves**, and a resolution is indistinguishable from a script that is
 * not there, so a caller that read an absent host as an empty one would offer the newest mailbox as
 * though it were the page's. `unconfirmed` is what the script says when its own `location` gave it
 * nothing usable, and it is deliberately **different from no answer at all** - which is what
 * `readHostContextAnswer` returns for a reply that is not one of these.
 *
 * **`host` is a hostname and never a URL, and the type is where that is enforced.** `site-associations`
 * keys its map by the exact hostname with no registrable-domain folding, and **a signup page's query
 * string is where that page's tokens are** - so an answer carrying a path would hold a signup token
 * for every page this extension has ever been beside. A union that could carry a path is a union a
 * future edit would widen without noticing.
 */
export type HostContextAnswer =
  /** The script read its own `location.hostname` and this is it, verbatim. */
  | { readonly kind: "host"; readonly host: string }
  /** The script is beside a page whose location gave it no host to name. Nothing was inferred. */
  | { readonly kind: "unconfirmed" };

/**
 * The answer this extension's own script gives about the host it is beside.
 *
 * **A function, and the reason is that the refusal has to live beside the answer.** The alternative -
 * a constant for the host case and a literal at the refusal site - is two spellings of a decision
 * this repository has already recorded going wrong twice: the side panel naming a host it did not
 * confirm is the one wrong answer this milestone must never give, and it would be reached by a call
 * site that forgot the empty check rather than by a missing type.
 *
 * @param host - Whatever the browser's own `location.hostname` produced, including nothing at all.
 * @returns The answer. **Never a host this function was not given**, so an absent or non-string
 *   `location` becomes `unconfirmed` rather than an empty hostname dressed as a reading.
 */
export function hostContextAnswer(host: unknown): HostContextAnswer {
  return typeof host === "string" && host.length > 0
    ? { kind: "host", host }
    : { kind: "unconfirmed" };
}

/**
 * Narrow an untrusted reply about the host beside this panel, or `null` where there is none.
 *
 * **A reply carrying an empty `host` is refused rather than admitted**, and the reason is the same
 * one {@link readCreateMailboxAnswer} gives for requiring both of `created`'s payloads: an answer
 * this extension cannot use is not a worse answer, it is **no answer**, and `no answer` is a state
 * the panel already has a named report for - *"it could not name that page"*. Admitting it would
 * put a panel into a state where it had a host and nothing to say about it.
 *
 * @param value - Whatever the message channel delivered. Untyped by construction.
 * @returns The answer, or `null` when the value is not one this extension can act on.
 */
export function readHostContextAnswer(value: unknown): HostContextAnswer | null {
  const kind = readKind(value);

  switch (kind) {
    case "host": {
      const host = readText(value, "host");
      return host === null ? null : { kind: "host", host };
    }
    // **Payload-free, admitted on its discriminant alone**, for the reason the other narrowers give.
    case "unconfirmed":
      return { kind };
    default:
      // **Every other shape, including `undefined` - which is what a page with no script of this
      // extension's produces.** `docs/PROVIDERS.md` §4.6 measured that reading, and collapsing it
      // here is what lets the panel say it cannot name the page rather than naming the newest
      // mailbox as though it belonged to it.
      return null;
  }
}

/** The `kind` of a value, or `undefined` where there is none — without narrowing the value. */
function readKind(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return Reflect.get(value, "kind");
}

/** A string field of `name`, or `null` where it is absent or is not a string. */
function readText(value: unknown, name: string): string | null {
  // **Called only after `readKind` matched a literal `kind` string**, so the value is an object by
  // that point — but `readKind` does not narrow `value`, because narrowing is what it exists to
  // avoid. The check is here rather than in `readKind` because `readText` is the only place that
  // asks for a field, and one guard on the two call sites would be a second thing to keep in step
  // with the union.
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const text: unknown = Reflect.get(value, name);

  return typeof text === "string" && text.length > 0 ? text : null;
}
