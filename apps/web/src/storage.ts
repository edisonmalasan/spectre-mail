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
 * ## Why the collection is a second hook and not a second route
 *
 * `mailbox-history` gave this page a second record kind, and it reaches the storage
 * layer through **this module** — the same one, which is the point. `useWebsiteMailboxes`
 * is a second *hook* rather than a second module, so the boundary rule still has exactly
 * one place to point at in `apps/web`, and the page still asks one question of one file.
 *
 * **It is a separate value rather than a second field on {@link WebsiteStorage}, and the
 * reason is `storage-stub.ts`.** That module builds a `WebsiteStorage` to hand the page
 * in a test, and it is a *shipped* module — not a `.test.tsx` — so a required third
 * field would have put this change's write scope over a file it was told not to touch.
 * Two values, each built by the same factory shape and each refusing rather than
 * storing nothing, is what the scope allowed and nothing about the product needed more.
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

import { useState } from "react";

import { createBrowserMailboxRecords, createBrowserMailboxes } from "@spectre-mail/storage";
import type { SpectreMailboxes, SpectreStorage } from "@spectre-mail/storage";

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
 * The website's single-mailbox storage, over this environment's own IndexedDB.
 *
 * ## Why the *paired* factory and not `createBrowserStorage`
 *
 * **One write records a mailbox in two record kinds**, and the requirement is that the head of the
 * collection and the mailbox the single-mailbox contract reports are the same mailbox. That is held by
 * a transaction spanning both object stores, and the only thing in the workspace that can open one is
 * `createBrowserMailboxRecords`.
 *
 * **The singular write stays, and that is the decision rather than the default.** Dropping it would
 * leave a stored record naming a mailbox this device has stopped using, so the two records would
 * disagree on disk and anything reading the singular record directly would be reading a stale answer.
 * Dropping the collection write instead would mean a page listing what this device holds has nothing to
 * list after the first visit. So both are written, together, by the factory above — and the rule the
 * extension needs for the same question is **not** needed here, because the platform refuses the
 * disagreement rather than a scan having to look for it.
 *
 * **Not `createBrowserStorage` any more, and that is a real change to this module's default.** It
 * still exists and is still tested; what changed is that the website no longer uses it, so the
 * duplication between the two browser entry points has one consumer instead of two.
 *
 * @throws {Error} If the environment provides no `indexedDB`, which
 *   {@link createWebsiteStorage} turns into a reported value rather than a blank page.
 */
export function websiteStorage(): SpectreStorage {
  return createBrowserMailboxRecords().storage;
}

/**
 * Build the website's storage, reporting an absent platform rather than throwing.
 *
 * **The catch here is the whole point of the function.** The browser entry point
 * throws on purpose, and the alternative to catching it is a React render that throws,
 * which shows the user a blank page and says nothing about why. The reason travels
 * with the value instead, so the page can render it.
 *
 * @param build The factory to call. A parameter rather than a direct call so a test
 * can drive the unavailable case without uninstalling anything from the global
 * object — which is what makes this function's failure branch testable at all, since
 * the test environment does have a way to install a platform and removing it again
 * from module scope is the kind of shared mutable state this repository avoids.
 * Defaults to {@link websiteStorage}, so production passes nothing.
 */
export function createWebsiteStorage(build: () => SpectreStorage = websiteStorage): WebsiteStorage {
  try {
    return { kind: "ready", storage: build() };
  } catch (cause) {
    return { kind: "blocked", reason: describeCause(cause) };
  }
}

/**
 * The website's storage, built once for the life of the component.
 *
 * **A hook rather than a plain call, and the reason is that the "once" has to be
 * testable.** `App` builds a session in a `useState` initialiser for the same reason
 * and records the hazard in a comment; a comment is not a test. Passing the builder in
 * makes the construction *countable*, so the claim can be falsified — and a factory
 * called in a component body would be reconstructed on every render, which would also
 * re-read the store, because the boot's dependency is the storage.
 *
 * **Not conditional.** `App` calls this unconditionally and then chooses between the
 * result and an injected one, because a hook called only when a prop is absent is a
 * hook whose call order changes with its props — which is the failure React's rules
 * exist to prevent. Since {@link createWebsiteStorage} never throws, calling it in a
 * test environment with no IndexedDB is harmless: the result is `blocked`, and the
 * caller ignores it.
 *
 * @param build Overrides the factory. A parameter so a test can count constructions
 * without a platform to construct from; production passes nothing.
 */
export function useWebsiteStorage(build?: () => SpectreStorage): WebsiteStorage {
  const [store] = useState(() => createWebsiteStorage(build));
  return store;
}

/**
 * The mailboxes this device holds, or the reason there is none.
 *
 * **`blocked` covers both "this browser cannot store anything" and "the collection could not be
 * read", and it is deliberately one variant** for the reason {@link WebsiteStorage}'s is: both mean
 * the same thing to the surface — **this page cannot say what this device holds, so it offers
 * nothing**. A surface that offered an address it could not read would be offering something the
 * page cannot support, which is the failure `spectre-storage`'s `null` clause exists to prevent.
 */
export type WebsiteMailboxes =
  | { readonly kind: "ready"; readonly mailboxes: SpectreMailboxes }
  | { readonly kind: "blocked"; readonly reason: string };

/**
 * Build the website's mailbox collection, reporting an absent platform rather than throwing.
 *
 * **The same shape as {@link createWebsiteStorage} and for the same reason**: the browser entry point
 * refuses rather than quietly storing nothing, and a refusal nobody catches is a blank page.
 */
export function createWebsiteMailboxes(
  build: () => SpectreMailboxes = createBrowserMailboxes,
): WebsiteMailboxes {
  try {
    return { kind: "ready", mailboxes: build() };
  } catch (cause) {
    return { kind: "blocked", reason: describeCause(cause) };
  }
}

/**
 * The website's mailbox collection, built once for the life of the component.
 *
 * **A hook for the reason {@link useWebsiteStorage} is one, applied to the collection**: a factory
 * called in a component body would be constructed on every render, and constructing this one re-reads
 * nothing but does re-check the platform — so the "once" is what makes the construction countable.
 *
 * **Not conditional**, and `App` calls it whether or not a `mailboxes` prop arrived: a hook called only
 * when a prop is absent is a hook whose call order changes with its props, which is the failure React's
 * rules exist to prevent. `createWebsiteMailboxes` never throws, so calling it in a test environment
 * with no IndexedDB is harmless — the result is `blocked` and the caller ignores it.
 *
 * @param build Overrides the factory. A parameter so a test can supply a collection without a
 *   platform to construct from; production passes nothing.
 */
export function useWebsiteMailboxes(build?: () => SpectreMailboxes): WebsiteMailboxes {
  const [held] = useState(() => createWebsiteMailboxes(build));
  return held;
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
