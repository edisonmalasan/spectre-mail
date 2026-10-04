/**
 * Where the website's stored mailbox comes from.
 *
 * ## Why this is a module and not a line in `App.tsx`
 *
 * Two reasons, and the second is the one that would have been missed.
 *
 * **The page has to know whether its own storage exists before it does anything
 * else**, and that answer is a *value* rather than an object: either a working
 * `SpectreStorage` or a reason it could not build one. `createBrowserStorage` throws
 * where the platform provides no IndexedDB, which is the correct behaviour and the
 * reason `packages/storage` chose it — a storage that quietly kept nothing would let
 * the page report *"nothing is saved on this device"* on a device where saving is
 * blocked. So the throw has to be caught, and a catch that lives inline in a
 * component is a catch nobody can test without rendering the whole page.
 *
 * **The boundary rule has to have something to point at.** `spectre-storage` says no
 * client may name a platform storage API, and `tests/architecture/boundaries.test.ts`
 * now enforces that across `apps/`. This module is the one place in the website that
 * reaches for the storage layer at all; a second one would be a second answer to
 * "where does this page keep its mailbox", and the rule above could no longer tell
 * which of them mattered.
 *
 * ## What the website will not do here
 *
 * It will not choose *which* store to use. The database and object-store names belong
 * to `packages/storage`, deliberately — a client naming them would be making a policy
 * decision about where a user's address lives, and an argument it could vary is an
 * argument a client will eventually vary.
 *
 * @module
 */

import { createBrowserStorage } from "@spectre-mail/storage";
import type { SpectreStorage } from "@spectre-mail/storage";

/**
 * The website's storage, or the reason there is none.
 *
 * **`blocked` covers both "this browser cannot store anything" and "the read
 * failed", and it is deliberately one variant.** They are different problems with
 * different fixes, and the page's copy names which one it hit — but both mean the
 * same thing to the boot: **this page cannot tell whether it has a mailbox, so it must
 * not create one.** A page that reported them as the same condition would still be
 * correct about that; a page that treated either as "nothing is stored" would destroy
 * the address the user came back for.
 */
export type WebsiteStorage =
  | { readonly kind: "ready"; readonly storage: SpectreStorage }
  | { readonly kind: "blocked"; readonly reason: string };

/**
 * Build the website's storage, reporting an absent platform rather than throwing.
 *
 * **The catch here is the whole point of the function.** `createBrowserStorage`
 * throws on purpose, and the alternative to catching it is a React render that throws,
 * which shows the user a blank page and says nothing about why. The reason travels
 * with the value instead, so the page can render it.
 *
 * @param build The factory to call. A parameter rather than a direct call so a test
 * can drive the unavailable case without uninstalling anything from the global
 * object — which is what makes this function's failure branch testable at all, since
 * the test environment does have a way to install a platform and removing it again
 * from module scope is the kind of shared mutable state this repository avoids.
 * Defaults to the real factory, so production passes nothing.
 */
export function createWebsiteStorage(
  build: () => SpectreStorage = createBrowserStorage,
): WebsiteStorage {
  try {
    return { kind: "ready", storage: build() };
  } catch (cause) {
    return { kind: "blocked", reason: describeCause(cause) };
  }
}

/**
 * Turn whatever was thrown into a sentence a page can show.
 *
 * **Not a wrapper and not a code.** A storage failure has no normalized error code,
 * because `spectre-storage`'s contract reports it as a rejection rather than as a
 * value — which is right, and means there is nothing here to normalize *to*. Inventing
 * one would be inventing an error vocabulary for a layer that deliberately has none.
 */
function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) return cause.message;
  return String(cause);
}
