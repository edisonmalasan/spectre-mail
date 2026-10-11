/**
 * Where the extension's stored mailbox comes from.
 *
 * ## The one file in this client that names `chrome.storage`
 *
 * `spectre-storage` says no client may name a platform storage API, and
 * `tests/architecture/boundaries.test.ts` enforces that across `apps/`. **This module
 * does not break that rule, and the reason is worth being exact about**, because it
 * looks like an exception and is not.
 *
 * The rule's list is DOM stores and cookie jars — `localStorage`, `sessionStorage`,
 * `indexedDB`, `caches`, `cookies`, `location`, `history`, `navigator` — none of which
 * an extension context has. `chrome.storage` is **not a DOM API**: it exists only inside
 * an extension, so naming it is not a client reaching past this layer into a browser
 * global, it is the client supplying the platform the layer needs.
 *
 * That distinction is load-bearing. The alternative — putting
 * `createChromeStorage({ area: chrome.storage.local })` inside `apps/extension` and
 * loosening the client rule to allow it — is the repair `packages/storage/src/browser.ts`
 * rejects in prose: a rule weakened to match what is actually scanned stops being a
 * boundary around the decision and becomes a boundary around the code that happens to
 * comply. **The adapter stays in `packages/storage`; the client hands it a platform.**
 *
 * ## Why the storage is a value, not an object the popup just calls
 *
 * `createChromeStorage` cannot throw where the platform is present, but a *read* can
 * reject, and `SpectreStorage` deliberately reports "nothing stored" as `null` and
 * "could not read" as a rejection. A popup that collapsed those would tell a user who
 * came back for their address that they had none — the exact failure the contract's
 * "`null` means exactly one thing" requirement exists to prevent. So the boot result is a
 * discriminated value carrying which of the two happened.
 *
 * @module
 */

import {
  createChromeMailboxes,
  createChromeSeenMessages,
  createChromeSiteAssociations,
  createChromeStorage,
} from "@spectre-mail/storage";
import type {
  ChromeStorageArea,
  SpectreMailboxes,
  SpectreSeenMessages,
  SpectreSiteAssociations,
  SpectreStorage,
} from "@spectre-mail/storage";

import type { Mailbox } from "@spectre-mail/core";

/**
 * The four record kinds this client keeps, over one platform area.
 *
 * **`stored` is the singular record, and it is read rather than written.** `site-associations` moved
 * every write in this client onto {@link SpectreMailboxes.addMailbox}, and a device that already
 * had a mailbox before this build has it in `stored` and nowhere else. So this client reads both and
 * writes one: see {@link loadInsertableMailboxes} for how the answer to "which address can this
 * device insert" is computed, and why it is computed once rather than in three places.
 *
 * **`seen` arrived with `incoming-mail-notification`, and the other three have no consumer for it.**
 * It records which message ids this device has been told about for a mailbox, and **nothing else
 * reads it**: the popup does not, the content script does not, and `loadInsertableMailboxes` does
 * not. It is here because it is a record kind this client keeps over the same area, and putting it
 * on its own would mean a second `chrome.storage.local` handle whose relationship to the other three
 * nobody could see.
 */
export interface ExtensionRecords {
  readonly stored: SpectreStorage;
  readonly mailboxes: SpectreMailboxes;
  readonly associations: SpectreSiteAssociations;
  readonly seen: SpectreSeenMessages;
}

/**
 * The extension's storage, or the reason there is none.
 *
 * **`blocked` covers both "this context has no storage" and "the read failed", and it
 * is deliberately one variant** — the same decision `apps/web` makes for the same
 * reason. They are different problems with different fixes, but both mean the same thing
 * to the popup: **it cannot tell whether it has a mailbox, so it must not create one.**
 */
export type ExtensionStorage =
  | { readonly kind: "ready"; readonly records: ExtensionRecords }
  | { readonly kind: "blocked"; readonly reason: string };

/**
 * The mailboxes this device could insert on a page, newest first.
 *
 * ## Why one function answers it, and not three callers
 *
 * The popup, the in-page control, and the worker each need "the address this device holds", and each
 * was going to reach for a different record: the popup for the collection, the content script for
 * the collection, and the worker for whatever it had just written. Three answers to one question is
 * how a product ends up showing an address in one place and offering another. So the answer is
 * computed here and nowhere else.
 *
 * ## The collection first, the singular record second, and the reason is what there is to show
 *
 * A collection that holds anything is the whole answer. Only when it holds **nothing** is the
 * singular record consulted — that is the state of a device that installed this extension before
 * this change, and dropping it would tell someone who came back for their address that they had
 * none. Their address is still stored; it is simply in an older record.
 *
 * ## The two are never merged, and the first reason given for that was wrong
 *
 * An earlier version of this note said a merge would "call a newest-first order a fact about a list
 * the two records were written in no common order". **That reason is false, and this change's own
 * rules are what falsified it**: `extensionSingularWriteViolations` forbids every module in this
 * client from naming `saveMailbox`, so the singular record can only have been written by a build
 * that predates the collection. It is **strictly older** than every member — by construction rather
 * than by inference — and a merge would have been `[...collection, singular]` with the newer first,
 * deduplicated by id.
 *
 * **So the objection was never the order. It is that nothing in this milestone can show a second
 * entry.** The popup renders one address, the in-page control names one, and the worker creates
 * one. A merged second element would sit in a list with no surface to put it on, while costing
 * every call a second read and adding a branch for a singular read that fails with a collection
 * already in hand — a failure that would otherwise cost the device an address it can read perfectly
 * well. Merging becomes right the day a surface lists them, and it would have been wrong to do it
 * before.
 *
 * ## The limit this leaves, stated rather than left for the next reader to find
 *
 * **A mailbox recorded before this build stops being insertable once this device records another
 * one.** It is still stored, and the singular record still answers for it whenever the collection is
 * empty; but a device that upgraded and then created a second address can insert only the newer, and
 * nothing in this milestone lets a person ask for the older. That is the cost of the decision above,
 * and it is recorded because the alternative — a merge with no surface to show it — buys nothing a
 * person can reach. `spectre-storage`'s collection requirement carries it as a scenario rather than
 * only here.
 *
 * @returns The mailboxes, or an empty list when this device holds none. An empty list is **not** a
 *   failure: a read that fails rejects, so a caller can still tell "holds nothing" from "could not
 *   be read", and that difference decides whether creation may be offered.
 */
export async function loadInsertableMailboxes(
  records: ExtensionRecords,
): Promise<readonly Mailbox[]> {
  const held = await records.mailboxes.loadMailboxes();

  if (held.length > 0) {
    return held;
  }

  const stored = await records.stored.loadMailbox();
  return stored === null ? [] : [stored];
}

/**
 * Build the extension's storage, reporting an absent platform rather than throwing.
 *
 * **The area is a parameter rather than read from a global here**, for the reason the
 * rest of this repository passes its platform in: a global read would compile in any
 * environment and run only in production, and this function's failure branch is exactly
 * the branch a test needs to reach.
 *
 * @param area - The platform area to adapt. Production passes
 *   `chrome.storage.local`.
 * @param build - Overrides the adapter factories. A parameter so a test can drive the
 *   unavailable case without a `chrome` global to remove, and so one test can drive all three
 *   contracts from a single call — which is the only way a test could ever see them disagree.
 */
export function createExtensionStorage(
  area: ChromeStorageArea | undefined,
  build: (options: { area: ChromeStorageArea }) => ExtensionRecords = buildAllRecords,
): ExtensionStorage {
  if (area === undefined) {
    return {
      kind: "blocked",
      // **The copy names no platform API, and a boundary rule is what made that true.**
      //
      // **The first version read** `"This extension context provides no chrome.storage,
      // so SpectreMail cannot store anything here."` **Widening the client storage rule
      // to cover `chrome.storage` then reported this line** - and the report is correct
      // about the *code* being absent while pointing at a genuine defect that is not
      // about code at all: a user in a popup has no idea what `chrome.storage` is, and
      // `apps/web`'s equivalent message comes from `describeCause(cause)`, which reports
      // the platform's own words and names no internal API.
      //
      // **This is not the reword-the-prose-until-the-rule-goes-quiet failure** this
      // repository records three times over, and the difference is worth stating: the
      // rule fired on a **string literal**, not on a declaration, and what it found was
      // copy leaking an internal identifier to an end user. Removing the identifier is
      // the fix. The rule is still doing its job - it is the seam's own prose, kept
      // below, that explains the `chrome.storage` spelling the code deliberately avoids.
      reason:
        "This browser will not let SpectreMail store anything here, so nothing can be " +
        "remembered on this device. That is reported rather than worked around: a store " +
        'that kept nothing would let the popup report "nothing is saved here" when the ' +
        "truth is that saving is unavailable.",
    };
  }

  try {
    return { kind: "ready", records: build({ area }) };
  } catch (cause) {
    return { kind: "blocked", reason: describeCause(cause) };
  }
}

/**
 * Build all four records over one area.
 *
 * **One area, four adapters, and they are built together on purpose.** Two of them would be over
 * separate areas otherwise, and a client that could read its mailboxes from one store and its site
 * associations from another would have to reason about a split this product never creates.
 */
function buildAllRecords(options: { area: ChromeStorageArea }): ExtensionRecords {
  return {
    stored: createChromeStorage(options),
    mailboxes: createChromeMailboxes(options),
    associations: createChromeSiteAssociations(options),
    seen: createChromeSeenMessages(options),
  };
}

/** Turn whatever was thrown into a sentence the popup can show. */
function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) return cause.message;
  return String(cause);
}
