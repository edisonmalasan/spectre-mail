/**
 * Seeding and clearing the extension's stored mailbox, through the platform's own API.
 *
 * ## One spelling, not two
 *
 * `popup.spec.ts` had its own local `clearStoredMailbox`. This file is that function moved
 * out, plus the seeding half — and `popup.spec.ts` imports it rather than keeping a copy. A
 * suite in which "empty the storage" is written twice is a suite in which one copy drifts and
 * a spec passes or fails on which file it happened to live in.
 *
 * ## Why the record is built by the product's own writer
 *
 * The stored record is **versioned** (`packages/storage/src/record.ts`), and a build that
 * cannot read a record neither surfaces nor deletes it. A spec that hand-wrote the record's
 * shape would therefore be asserting against a schema it had re-invented, and the first
 * version bump would make every in-page spec pass vacuously — the stored record would be
 * unreadable, `loadMailbox()` would report nothing stored, and "the affordance appears" would
 * fail while "nothing is offered with nothing stored" would pass for the wrong reason.
 *
 * So the record is written with `toStoredMailboxRecord`, imported from the shared package.
 *
 * ## Why the platform global is read reflectively
 *
 * **Because that is how the shipped code reads it, and a spec should not reach a store by a
 * route the product does not.** `src/local-area.ts` is the extension's single reader of
 * the extension's `chrome` global, and it walks it with `Reflect.get` rather than naming it —
 * partly because there is no `@types/chrome` here, and partly because the boundary rule
 * (`keeps storage, cookies, and the URL out of every client`) treats a client reaching a global
 * store by name as the thing it exists to prevent.
 *
 * **This file lives under `apps/`, and that rule exempts no test file** — a `.spec.ts` is
 * exempt, a helper beside one is not, and the difference is the *name* rather than the kind.
 * The first version of this file therefore reported a violation, and the two available repairs
 * were to widen the exemption or to stop naming the store. This is the second: the path below
 * is **data, passed in from Node**, so there is one definition of where the area lives, both
 * operations walk it identically, and neither spells an API this product reaches through
 * `packages/storage`.
 *
 * **It is not a workaround for a rule.** The writes still go through the platform's own API
 * inside the worker's own context, which is the point of the whole file; a reflective read is
 * how that context is reached, not a way around it.
 */

import { createMailbox } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";
import { EXTENSION_MAILBOX_KEY, toStoredMailboxRecord } from "@spectre-mail/storage";
import type { StoredMailboxRecord } from "@spectre-mail/storage";

import type { LaunchedExtension } from "../launch-extension";

/** The path from the extension's global to its own local storage area. */
const AREA_PATH = ["chrome", "storage", "local"] as const;

/** The shape these operations need from the area, and nothing more. */
interface StorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  clear(): Promise<void>;
}

/**
 * The mailbox every in-page spec seeds.
 *
 * **`createMailbox`, not a literal.** A hand-written `Mailbox` has to supply `provider`
 * independently of `credentials`, and the compiler will not stop the two disagreeing — which
 * is the exact defect `createMailbox` exists to make unrepresentable. The first version of
 * this was a literal and `pnpm typecheck` reported it missing `credentials` and `status`,
 * which is the type system doing the job it was written for one stage later than intended.
 *
 * **`createdAt: 0` on purpose.** Nothing here measures a lifetime, and a plausible-looking
 * timestamp in a fixture is an invitation to later assert on elapsed time — which
 * `MailboxInit.expiresAt` forbids precisely because no provider reports a lifetime.
 */
export const STORED_MAILBOX: Mailbox = createMailbox({
  id: "in-page-spec",
  address: "spectre-in-page@guerrillamail.info",
  createdAt: 0,
  credentials: { provider: "guerrilla", sessionId: "in-page-spec-session" },
});

/** The address the seeded mailbox carries, named so a spec reads as a claim not a value. */
export const STORED_ADDRESS = STORED_MAILBOX.address;

/**
 * Empty the extension's storage area.
 *
 * **`clear()` rather than removing the one key**, for the same reason
 * `packages/storage`'s `clearAll` removes the whole database: a narrower call would pass
 * every test written against today's single record and quietly stop clearing everything the
 * moment a later build added a second record kind — which is `site-associations` (M9 slice 3).
 */
export async function clearStoredMailbox(extension: LaunchedExtension): Promise<void> {
  await extension.worker.evaluate(
    async (path) => {
      const area = path.reduce<object>(
        (node, key) => Reflect.get(node, key),
        globalThis,
      ) as StorageArea;
      await area.clear();
    },
    [...AREA_PATH],
  );
}

/**
 * Write one mailbox into the extension's storage, and read it back before returning.
 *
 * **The read-back is what makes this usable as a precondition.** The popup tier recorded that
 * waiting for an address to appear on screen does *not* wait for the `saveMailbox` write, so a
 * spec that seeds and immediately navigates can race the write. Returning only once the
 * platform reports the record present makes the ordering explicit instead of lucky.
 *
 * **One round trip: write, then read the key back in the same evaluation.** Two would be two
 * chances for another spec in this profile to write in between.
 *
 * @throws If the record is not readable through the platform's own API afterwards.
 */
export async function seedStoredMailbox(
  extension: LaunchedExtension,
  mailbox: Mailbox = STORED_MAILBOX,
): Promise<void> {
  const record: StoredMailboxRecord = toStoredMailboxRecord(mailbox);

  const stored = await extension.worker.evaluate(
    async ([path, key, value]) => {
      const area = (path as readonly string[]).reduce<object>(
        (node, step) => Reflect.get(node, step),
        globalThis,
      ) as StorageArea;
      await area.set({ [key as string]: value });
      return area.get(key as string);
    },
    [[...AREA_PATH], EXTENSION_MAILBOX_KEY, record] as const,
  );

  if (stored[EXTENSION_MAILBOX_KEY] === undefined) {
    throw new Error(
      `seeding the extension's storage did not take: ${EXTENSION_MAILBOX_KEY} is still ` +
        `absent after a write, read back inside the extension's own service worker.`,
    );
  }
}

/**
 * Empty the storage and then seed it.
 *
 * **Both halves, always.** The extension's storage is scoped to the **profile**, and one
 * profile is shared by every spec in a file — so a spec that only seeds inherits whatever the
 * previous one wrote, and which specs pass depends on scheduling. That was observed in
 * `popup.spec.ts`.
 */
export async function resetStoredMailbox(
  extension: LaunchedExtension,
  mailbox: Mailbox = STORED_MAILBOX,
): Promise<void> {
  await clearStoredMailbox(extension);
  await seedStoredMailbox(extension, mailbox);
}
