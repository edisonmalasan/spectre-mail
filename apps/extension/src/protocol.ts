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
 * `null`.** A reply that is not one of these four is not a *worse* answer, it is **no answer**,
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

/** Discriminates the one request this extension's contexts exchange. */
export const CREATE_MAILBOX_REQUEST_KIND = "spectre:create-mailbox";

/** A request for the background context to create a mailbox on this device's behalf. */
export interface CreateMailboxRequest {
  readonly kind: typeof CREATE_MAILBOX_REQUEST_KIND;
}

/**
 * The one value sent for a creation request.
 *
 * **A constant rather than a literal at each call site**, so the two sides cannot disagree by
 * one being edited — which is the same reason `AFFORDANCE_LABEL` is exported from
 * `content-script/affordance.ts` rather than repeated in both tiers.
 */
export const CREATE_MAILBOX_REQUEST: CreateMailboxRequest = { kind: CREATE_MAILBOX_REQUEST_KIND };

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
  /** A mailbox was created, the provider confirmed it, and it is stored. `address` is usable. */
  | { readonly kind: "created"; readonly address: string }
  /** A provider refused. `description` is its own words, not a summary written here. */
  | { readonly kind: "refused"; readonly description: string }
  /** Created or refused, but this device could not be told, so there is no address to offer. */
  | { readonly kind: "notStored" }
  /** The message was not one this context acts on. Nothing was created and nothing persisted. */
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
      return address === null ? null : { kind: "created", address };
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