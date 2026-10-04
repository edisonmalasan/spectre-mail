/**
 * The browser-facing way to build a {@link SpectreStorage}.
 *
 * ## Why this exists rather than a client passing `window.indexedDB`
 *
 * `spectre-storage`'s promoted requirement says **no client and no shared package**
 * other than this layer may name a platform storage API. Slice 1 made that true and
 * left it untested from the client side, because nothing in the repository needed a
 * client to reach a store. M6 slice 2 is the first thing that does: the website has a
 * mailbox to persist and a real IndexedDB to persist it in.
 *
 * So there were three options and two of them were wrong.
 *
 * **A client passing `window.indexedDB`** would make the requirement false on the
 * change that first exercised it, which is the worst possible time to discover that a
 * rule has been outgrown.
 *
 * **Weakening the requirement to "no *shared* package"** — which is what the enforced
 * boundary rule actually scans — would have been the tempting repair, and it is the
 * one this module exists to avoid. It matches today's enforcement, and in exchange it
 * leaves every client free to reach for a different store the first time one is
 * inconvenient. A boundary that says "not in the shared packages" is a boundary around
 * the code that happens to be shared, not around the decision.
 *
 * **This module** names the platform API in the one layer the requirement permits, so
 * both the requirement and the injected-adapter rule stand exactly as slice 1 wrote
 * them.
 *
 * ## Why it throws where the platform has nothing
 *
 * The alternative is an implementation that stores nothing, and that is the failure
 * `contract.ts`'s "`null` means exactly one thing" requirement exists to prevent, one
 * layer up. A client handed a storage that silently keeps nothing would read `null`,
 * believe it was a first visit, create a mailbox, and report "there is nothing saved
 * here" on a device where persistence is merely *unavailable*. Both claims would be
 * false and neither would be visible. An exception at construction time is the only
 * outcome that cannot be mistaken for a fact about the user's stored data.
 *
 * ## Why `createIndexedDbStorage` keeps its required factory
 *
 * Because the alternative is a default that compiles everywhere and runs only in a
 * browser — the exact hazard its own option documentation records, measured rather
 * than assumed (`globalThis.indexedDB` compiles in every package in this workspace,
 * DOM lib or not). Two entry points, separately named: the injected one stays
 * testable against `fake-indexeddb` with no platform present at all, and this one says
 * out loud that it needs a browser.
 *
 * @module
 */

import { createIndexedDbStorage } from "./indexeddb";
import type { SpectreStorage } from "./contract";

/**
 * The names this layer uses, which a client has no reason to know and no way to
 * choose.
 *
 * **Deliberately not parameters.** `createIndexedDbStorage` exposes both because a
 * caller naming them is making a policy decision about where data lives. A client
 * building "the storage for this website" is not making such a decision — it wants
 * *a* storage — and an argument it could vary is an argument a client will eventually
 * vary, at which point this stops being one entry point and becomes a second storage
 * contract.
 */
const DATABASE_NAME = "spectre-mail";
const STORE_NAME = "mailbox";

/**
 * Build a {@link SpectreStorage} backed by this environment's own IndexedDB.
 *
 * ## What it reads, and where
 *
 * `globalThis.indexedDB`, read **inside this module**. The property is read through
 * `Reflect.get` rather than `globalThis.indexedDB` for one reason that is worth more
 * than it looks: a direct property access on a type that declares the property
 * compiles under this package's `DOM` lib whether or not anything defines it at
 * runtime, so a missing platform becomes `undefined` passed straight into an adapter
 * that will fail later with a message about transactions. Reading it reflectively makes
 * the absence a value this function can *test*, which is the whole job here.
 *
 * ## The platform this expects
 *
 * Anything providing `IDBFactory`: a browser, or `fake-indexeddb` installed on the
 * global. It does not check which, and it should not — "is this a real browser" is not
 * a question this layer can answer honestly, and a check would only ever be a list of
 * user-agent strings going stale.
 *
 * @returns A working storage over the platform's IndexedDB.
 *
 * @throws {Error} If the environment provides no `indexedDB`. Reported here, at
 * construction, rather than as a storage that quietly stores nothing — see the module
 * note.
 */
export function createBrowserStorage(): SpectreStorage {
  const provided: unknown = Reflect.get(globalThis, "indexedDB");

  if (provided === undefined || provided === null) {
    throw new Error(
      "This environment provides no IndexedDB, so SpectreMail cannot store anything here. " +
        "That is reported rather than worked around: a storage that kept nothing would let " +
        'a client report "nothing is saved on this device" when the truth is that saving ' +
        "is unavailable.",
    );
  }

  // **Narrowed by a runtime check, and the check is the only one.** `IDBFactory` is a
  // DOM interface, so the compiler cannot verify that an arbitrary value is one, and a
  // cast is the honest way to say so — provided the *absence* case, which is the one a
  // user experiences, was handled above rather than being left to a constructor.
  return createIndexedDbStorage({
    indexedDB: provided as IDBFactory,
    databaseName: DATABASE_NAME,
    storeName: STORE_NAME,
  });
}
