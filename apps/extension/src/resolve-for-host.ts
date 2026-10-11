/**
 * Which mailbox a host resolves to, stated once.
 *
 * ## Why this is a module rather than a second spelling inside `Panel.tsx`
 *
 * **`tasks.md` 5.6 asks for this and `design.md` D3 explains why**: the panel and the in-page
 * affordance both need "which address does this host get", and **two answers to one question is
 * how a product ends up showing one address in a panel and offering another beside the form.**
 * That is the same reasoning `design.md` D2 gives for extracting `MessageSurface.tsx`, and it is
 * the reason this file exists rather than a `Panel.tsx` branch.
 *
 * **The rule was a private closure in `content-script/controller.ts` until this change.** D3 says
 * the rule is "stated once, in `packages/mailbox`'s caller-side helper, and both callers use it" -
 * and it was not, so this module is what discharges that sentence rather than a second copy of it.
 * The controller now calls {@link resolveForHost} and its own behaviour is unchanged: its cases
 * still pass without being edited, which is the evidence that extracting it was a move.
 *
 * ## The rule itself, and each clause's reason
 *
 * **The mailbox this host was last used with, and the newest this device holds otherwise.** The
 * newest is the fallback because it is the answer this host *would* have received had no
 * association ever been recorded - so a page visited for the first time gets the address a person
 * created most recently, which is overwhelmingly the one they came here to use.
 *
 * **An association naming a mailbox this device no longer holds falls back to the newest too**,
 * for the reason `controller.ts` gave: the record is stale, and offering a mailbox the device
 * cannot find would offer to read something that does not exist here.
 *
 * **No host, no association.** A document with no host is not a site, so there is nothing to prefer
 * and nothing to record - `controller.ts` records that as a fact about the page rather than about
 * this rule, and it holds identically for a panel beside a page whose host could not be named.
 *
 * ## Why the caller still owns the reads, and the one rejection this module must not absorb
 *
 * **The reads stay with the caller, deliberately.** `controller.ts` owns what happens when the
 * *collection* read fails (remembered as `readFailed`, because offering to create on a device whose
 * contents are unknown would offer a second mailbox) and when the *lookup* fails (absorbed, because
 * a device that can list its mailboxes and cannot say which one this host used is not in doubt
 * about anything). **Neither decision is this module's** - they are about storage, not about
 * selection - and collapsing them here would make one caller inherit the other's storage policy.
 *
 * **So `recorded` is a value, not a promise.** A caller that has already absorbed a failed lookup
 * passes `null`, which this module reads as "nothing recorded" - the same answer the successful
 * empty read gives, and the right one in both cases.
 *
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

/**
 * The mailbox a host resolves to.
 *
 * **An id as well as an address, and the id is the reason** - this is the value `controller.ts`
 * already carried as its private `Insertable`. An address is not an id: the same address can be
 * reached through two providers' records, and a site association keyed on an address would not
 * survive a build that stored it twice. **A surface that needs only an address to display still
 * receives the id**, because this is the one value and two spellings of it would drift.
 */
export interface ResolvedMailbox {
  readonly address: string;
  readonly mailboxId: string;
}

/**
 * Which mailbox `host` resolves to, given what the device holds and what was recorded for it.
 *
 * @param held - Every mailbox this device holds, newest first. **Order is the caller's contract
 *   and this module's assumption**, which is why `loadInsertableMailboxes` returns the collection
 *   in that order and never merges the singular record into the middle of it.
 * @param host - The host to resolve, exactly as the platform spells it and with no
 *   registrable-domain folding - the key `site-associations` writes.
 * @param recorded - The mailbox id this host was last used with, or `null` when there is none or
 *   when the caller absorbed a failed lookup.
 * @returns The mailbox this host resolves to, or `null` when this device holds nothing at all. A
 *   `null` is **not** a failure: a caller that cannot read cannot tell that, and says so itself.
 */
export function resolveForHost(
  held: readonly Mailbox[],
  host: string,
  recorded: string | null,
): ResolvedMailbox | null {
  const newest = held[0] ?? null;

  if (newest === null) {
    return null;
  }

  // **No host, no association, and the newest is the answer** - see the module note.
  if (recorded === null || host.length === 0) {
    return { address: newest.address, mailboxId: newest.id };
  }

  const associated = held.find((mailbox) => mailbox.id === recorded);

  return associated === undefined
    ? { address: newest.address, mailboxId: newest.id }
    : { address: associated.address, mailboxId: associated.id };
}
