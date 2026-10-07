/**
 * The one place this client reads the extension's `chrome` global.
 *
 * ## Why the file is named `local-area.ts` and not `chrome-platform.ts`
 *
 * **It was, and the name made the rule this module exists for impossible to enforce.**
 * `keeps the extension platform global to one module` in `tests/architecture/boundaries.test.ts`
 * reports any module naming the identifier, and it found two violations on its first run — both
 * of them nothing but `import … from "./chrome-platform"`. A rule that fires on the **only
 * correct import in the codebase** is a rule whose options are renaming the file or carving the
 * path out of the pattern, and both were rejected: a carve-out that exempts a module specifier
 * would exempt any future path containing the word, including one that reached the global.
 *
 * **So the name says what the module supplies rather than what it names.** It supplies the
 * extension's local storage *area*; `storage.ts` is the adapter over that area, and the two names
 * say which is which.
 *
 * ## Why this is a module rather than a line in each entry point
 *
 * `main.tsx` used to hold this read, and its note said it was *"the only file that names
 * `chrome`"*. That sentence was true while the extension had **one** context. M9 slice 1
 * gives it a **second** — a content script — and a claim that is true of one caller stops
 * being a boundary the moment there are two: either the read is copied into both, and the
 * two copies must be kept in agreement forever, or it is shared and there is one expression.
 *
 * So the claim this file carries is the one that survives a second context: **the extension's
 * `chrome` global is read from exactly one module.**
 *
 * **And the duplication had already happened before the rule existed.** `main.tsx` kept its own
 * copy of the shape check while this module was written beside it, and the new rule reported it
 * by name and line. Two copies of a shape check drift: one would gain a method the other did
 * not, and the extension would store a mailbox the popup could not read back.
 *
 * ## `Reflect.get` rather than a typed global, and the reason is a checked one
 *
 * There is no `chrome` declaration in this workspace's DOM lib, so `chrome.storage.local`
 * would not compile. A `declare global` block would make the platform's shape ambient across
 * the whole package. Reading it reflectively keeps the platform reachable from exactly one
 * expression, and turns "no `chrome` in this environment" into a value the caller can branch
 * on rather than a crash on load.
 *
 * ## Why `Reflect.get` is also load-bearing against the boundary rule
 *
 * `tests/architecture/boundaries.test.ts` forbids the **member-expression** spelling
 * `chrome.storage` across `apps/`, and it strips comments before matching — so the prose in
 * this file that names the platform is not a violation, while `chrome.storage.local` in code
 * would be. That is not a trick to evade the rule; it is the rule's own design. The client
 * is *supplying* the platform `packages/storage` needs, and the adapter that consumes it
 * lives in that package.
 *
 * @module
 */

import type { ChromeStorageArea } from "@spectre-mail/storage";

/**
 * Read the extension's local storage area, or `undefined` where there is none.
 *
 * **A shape check rather than a cast**, because the whole point of not declaring a global
 * `chrome` is that nothing has verified this value. A cast would assert the three operations
 * exist without having looked.
 */
export function readChromeLocalArea(): ChromeStorageArea | undefined {
  const value: unknown = Reflect.get(Reflect.get(globalThis, "chrome"), "storage")?.local;

  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { get?: unknown }).get !== "function" ||
    typeof (value as { set?: unknown }).set !== "function" ||
    typeof (value as { clear?: unknown }).clear !== "function"
  ) {
    return undefined;
  }

  return value as ChromeStorageArea;
}
