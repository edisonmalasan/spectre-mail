/**
 * An in-memory stand-in for what this device holds, for the unit tier.
 *
 * ## Why it is one module and not two harnesses
 *
 * `content-script.test.ts` and `content-script-create.test.ts` both drive `startInPageIntegration`,
 * and `site-associations` gave the controller three record operations instead of one. Copying the
 * stand-in into both would have produced two fakes that could disagree about the one behaviour every
 * assertion here depends on — that a mailbox this device does not hold is never inserted — which is
 * the failure mode a fake is least able to catch about itself.
 *
 * ## What it is not
 *
 * **It is not the `chrome.storage` adapter.** It does not version anything, narrow anything, or
 * refuse to replace a record it cannot read; those are `packages/storage`'s claims and they are
 * asserted there against the platform's own shape. This fake answers questions, and it answers them
 * by returning exactly what the caller asked it to hold — including the failures, which is why
 * `loadRejects` and `saveRejects` exist rather than being left to a thrown `TypeError` inside a
 * `void`ed promise.
 *
 * @module
 */

import { vi } from "vitest";
import type { Mock } from "vitest";

import type { Mailbox } from "@spectre-mail/core";

import type { InPageRecords } from "../controller";

export interface FakeRecordsOptions {
  /** The mailboxes this device holds, newest first. An empty list means it holds none. */
  readonly mailboxes?: readonly Mailbox[];
  /** Hosts already recorded, keyed by host exactly as the browser reports it. */
  readonly associations?: Readonly<Record<string, string>>;
  /** Make every read reject, for the arm where "could not read" must not read as "holds nothing". */
  readonly loadRejects?: boolean;
  /**
   * Make **only** the association read reject, for the arm where a preference that cannot be read
   * must still leave the device able to offer an address.
   *
   * **Separate from `loadRejects`, and that separation is the point of the arm.** `loadRejects`
   * fails both reads at once, which is the case where this device cannot say what it holds and so
   * offers nothing. Failing only the lookup is a different fact: the device can say exactly what it
   * holds, and the one thing it cannot say is which of those the site was last used with — so the
   * newest is a founded answer rather than a guess. **One flag for both arms would have made the
   * second arm unreachable**, which is the recorded shape of a fake quietly narrowing the question
   * it exists to ask.
   */
  readonly loadSiteRejects?: boolean;
  /** Make every association write reject, for the arm where a lost write changes nothing visible. */
  readonly saveRejects?: boolean;
  /**
   * Replace the collection reader entirely, for an arm that needs to *hold a read open*.
   *
   * **A hold, and not a value, because the arms that need it are about the window.** A read that
   * resolves immediately cannot be observed while it is out, and observing the page during a read is
   * the only way to catch a control that is actionable while a request is still unresolved.
   */
  readonly loadOverride?: () => Promise<readonly Mailbox[]>;
}

export interface FakeRecords {
  /** What to hand the controller. */
  readonly records: InPageRecords;
  /** The collection reader, as a mock, so a case can hold it open. */
  readonly loadMailboxes: Mock<() => Promise<readonly Mailbox[]>>;
  /** The association reader, as a mock. */
  readonly loadSiteMailboxId: Mock<(host: string) => Promise<string | null>>;
  /** The association writer, as a mock. */
  readonly saveSiteMailboxId: Mock<(host: string, mailboxId: string) => Promise<void>>;
  /** The mailboxes this device holds, mutable so a case can simulate a worker that wrote one. */
  readonly mailboxes: Mailbox[];
  /** The recorded hosts, mutable so a case can assert on what was written. */
  readonly associations: Record<string, string>;
  /** Every host asked about, in order. An empty list means the controller never consulted one. */
  readonly reads: string[];
  /** Every association written, in order. */
  readonly saves: Array<{ readonly host: string; readonly mailboxId: string }>;
}

/**
 * Let the controller's boot read finish, so a case can act on the answer it settled on.
 *
 * ## A counted number of turns, and the count is derived rather than chosen
 *
 * The boot path is `resolveForThisHost()` — an async function with exactly **one** `await` — whose
 * settled result is handed to **one** `.then` that assigns what the control will insert. An
 * already-resolved promise runs its first continuation on the next turn of the microtask queue and
 * the next after that, so the assignment lands on turn three. This flushes four; the surplus turn is
 * so that adding one link inside the controller does not silently become this file's second thing to
 * update.
 *
 * **Three was measured, not derived.** A probe asked the page what it offered after each of seven
 * turns and read `Create` on turns 0–2 and `Use SpectreMail: …` from turn 3, which is why two flushes
 * read the *pre-settled* state rather than the answer. The probe was a temporary file and is not in
 * this repository — a measuring instrument left in the tree is something every later `pnpm lint` has
 * an opinion about. `content-script-associations.test.ts` carries the durable half of it.
 *
 * ## It is one place on purpose, and that is the whole point
 *
 * Each case used to flush a single turn of its own. When `site-associations` added the association
 * read, the count in the product went from one turn to three while the number in twenty-odd tests
 * stayed at one — and the failure surfaced as "the control offered to create instead of insert",
 * which reads like a product defect and is a timing accident. **The number now lives in exactly one
 * function, next to the derivation, instead of in every case.**
 *
 * `content-script.test.ts` carries the control for it: one case asserts that a single turn is *not*
 * enough, so this function cannot quietly become a no-op and let every case pass for the wrong reason.
 *
 * @returns Nothing; it resolves once the queue has drained the boot chain.
 */
export async function settledBoot(): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) {
    await Promise.resolve();
  }
}

/** A stand-in for `InPageRecords` over plain values. */
export function fakeRecords(options: FakeRecordsOptions = {}): FakeRecords {
  const mailboxes = [...(options.mailboxes ?? [])];
  const associations: Record<string, string> = { ...(options.associations ?? {}) };
  const reads: string[] = [];
  const saves: Array<{ host: string; mailboxId: string }> = [];

  const loadMailboxes = vi.fn(async (): Promise<readonly Mailbox[]> => {
    if (options.loadOverride !== undefined) {
      return options.loadOverride();
    }
    if (options.loadRejects) {
      throw new Error("the read failed");
    }
    return [...mailboxes];
  });

  const loadSiteMailboxId = vi.fn(async (host: string): Promise<string | null> => {
    reads.push(host);
    if (options.loadRejects) {
      throw new Error("the read failed");
    }
    // **After `loadRejects`, and deliberately.** A flag that fails both reads makes the second arm
    // unreachable, and a flag that fails only this one must not be pre-empted by the broader one -
    // the order is what makes `loadRejects` mean "everything" and `loadSiteRejects` mean "the
    // lookup", which is the only way the two arms can be told apart by the fake rather than by the
    // name of the option.
    if (options.loadSiteRejects) {
      throw new Error("the lookup failed");
    }
    return associations[host] ?? null;
  });

  const saveSiteMailboxId = vi.fn(async (host: string, mailboxId: string): Promise<void> => {
    if (options.saveRejects) {
      throw new Error("the write failed");
    }
    saves.push({ host, mailboxId });
    associations[host] = mailboxId;
  });

  return {
    records: { loadMailboxes, loadSiteMailboxId, saveSiteMailboxId },
    loadMailboxes,
    loadSiteMailboxId,
    saveSiteMailboxId,
    mailboxes,
    associations,
    reads,
    saves,
  };
}
