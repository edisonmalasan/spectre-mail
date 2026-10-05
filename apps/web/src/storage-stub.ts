/**
 * A storage to hand the page in a test.
 *
 * ## Why this is a shipped module and not inside a test file
 *
 * `App.test.tsx` and `MessageView.test.tsx` both render the whole page, and both need
 * a storage, and a `describe`-local copy in each would be two definitions of one
 * fixture — the duplication this repository has been bitten by before, in
 * `packages/mailbox/src/failure.ts`. `jsdom-suite-budget.ts` is the same kind of shared
 * test-only module and is the precedent for it not being a `.test.ts` file.
 *
 * ## Why the page needs one at all
 *
 * `createBrowserStorage` throws where the platform provides no IndexedDB, which is the
 * correct behaviour and also means **`jsdom` cannot supply one**. So a page rendered
 * without a `storage` prop in a test shows the blocked-storage region rather than a
 * mailbox — which is right, and which would have made every existing page assertion
 * fail for a reason that has nothing to do with what they check. Each of them passes
 * `EMPTY_STORE`, which is the honest description of a device with nothing stored: the
 * page creates a mailbox, exactly as it did before recovery existed.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";
import type { SpectreStorage } from "@spectre-mail/storage";

import type { WebsiteStorage } from "./storage";

/** What the page was handed, so a test can assert on what it wrote. */
export interface StubStore {
  readonly storage: WebsiteStorage;
  /** Every mailbox the page saved, in order. */
  readonly saves: readonly Mailbox[];
  /** How many times the page read. */
  readonly loadCount: () => number;
  /**
   * How many times the page asked for everything to be removed.
   *
   * **A count and not just a flag**, for the reason `saves` is a list: a page that
   * removed twice would satisfy a boolean, and "does not write the address back" is a
   * claim about how *often* the page touches the store after a removal rather than
   * about whether it ever does.
   */
  readonly clearCount: () => number;
}

export interface StubStoreOptions {
  /** What a read returns. Omitted means `null` — nothing stored. */
  readonly stored?: Mailbox | null;
  /** Make the read throw this. A rejection is the storage contract's other answer. */
  readonly loadThrows?: unknown;
  /** Make the write throw this. */
  readonly saveThrows?: unknown;
  /** Make the removal throw this. */
  readonly clearThrows?: unknown;
}

/**
 * A storage that reports what the page did with it.
 *
 * **Saves are recorded rather than replaced**, so a test can assert both that a write
 * happened and what was written — a page that stored a different mailbox than it
 * displayed would satisfy a count and not a record.
 *
 * **It models removal, and deliberately does not model writes into reads.** It did
 * not model anything until removal arrived, and modelling the write too — keeping a
 * `current` record that a save updates — broke **30 tests in `App.test.tsx`** at once.
 * The cause is `EMPTY_STORE` below: it is one shared instance, so the first test whose
 * page saves a mailbox leaves a record every later test reads. The module note here
 * already named that hazard, and this is the evidence for it — the leak was invisible
 * only because the stub previously answered every read with the same value.
 *
 * So a removal is modelled, because that is what this change is about and it is safe:
 * nothing clicks removal in a rendering test, and the flag is per-`stubStore`. A write
 * is recorded in `saves`, which is what every test that cares asserts on.
 */
export function stubStore(options: StubStoreOptions = {}): StubStore {
  const saves: Mailbox[] = [];
  let loads = 0;
  let clears = 0;
  let removed = false;

  const storage: SpectreStorage = {
    async loadMailbox(): Promise<Mailbox | null> {
      loads += 1;
      if (options.loadThrows !== undefined) throw options.loadThrows;
      // **A removal wins over the fixture's starting value**, so a test can observe the
      // device after the page has removed what it was handed.
      if (removed) return null;
      return options.stored ?? null;
    },
    async saveMailbox(mailbox: Mailbox): Promise<void> {
      if (options.saveThrows !== undefined) throw options.saveThrows;
      saves.push(mailbox);
    },
    async clearAll(): Promise<void> {
      if (options.clearThrows !== undefined) throw options.clearThrows;
      clears += 1;
      removed = true;
    },
  };

  return {
    storage: { kind: "ready", storage },
    saves,
    loadCount: () => loads,
    clearCount: () => clears,
  };
}

/**
 * A device with nothing stored.
 *
 * **One shared instance, deliberately.** A page that saved into it would leak between
 * tests, and that would be a real cross-test failure rather than a confusing one — so
 * every test that wants to assert on writes builds its own with {@link stubStore}, and
 * this is only for tests that care about rendering.
 */
export const EMPTY_STORE: WebsiteStorage = stubStore().storage;

/** A reason shaped like a thrown one, for the storage layer's failure paths. */
export function storageFailure(message: string): Error {
  return new Error(message);
}
