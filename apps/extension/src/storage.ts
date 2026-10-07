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

import { createChromeStorage } from "@spectre-mail/storage";
import type { ChromeStorageArea, SpectreStorage } from "@spectre-mail/storage";

/**
 * The extension's storage, or the reason there is none.
 *
 * **`blocked` covers both "this context has no storage" and "the read failed", and it
 * is deliberately one variant** — the same decision `apps/web` makes for the same
 * reason. They are different problems with different fixes, but both mean the same thing
 * to the popup: **it cannot tell whether it has a mailbox, so it must not create one.**
 */
export type ExtensionStorage =
  | { readonly kind: "ready"; readonly storage: SpectreStorage }
  | { readonly kind: "blocked"; readonly reason: string };

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
 * @param build - Overrides the adapter factory. A parameter so a test can drive the
 *   unavailable case without a `chrome` global to remove.
 */
export function createExtensionStorage(
  area: ChromeStorageArea | undefined,
  build: (options: { area: ChromeStorageArea }) => SpectreStorage = createChromeStorage,
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
    return { kind: "ready", storage: build({ area }) };
  } catch (cause) {
    return { kind: "blocked", reason: describeCause(cause) };
  }
}

/** Turn whatever was thrown into a sentence the popup can show. */
function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) return cause.message;
  return String(cause);
}
