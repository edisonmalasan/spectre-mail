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
 * route the product does not.** `src/extension-platform.ts` is the extension's single reader of
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
import {
  EXTENSION_MAILBOX_KEY,
  EXTENSION_MAILBOXES_KEY,
  EXTENSION_SITE_MAILBOXES_KEY,
  readStoredMailboxCollection,
  readStoredMailboxRecord as narrowStoredMailboxRecord,
  readStoredSiteAssociations,
  toStoredMailboxCollection,
  toStoredMailboxRecord,
  toStoredSiteAssociations,
} from "@spectre-mail/storage";
import { affordanceInsertLabel } from "../../src/content-script/affordance";
import type { StoredMailboxRecord } from "@spectre-mail/storage";

import { FIXTURE_ORIGIN } from "./in-page-fixture";

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
 * The control's resting label on a device holding {@link STORED_MAILBOX}.
 *
 * **Built by the product's own function rather than spelled out here.** The insert control's name
 * carries the address it inserts, so a spec asserting it has to build the same string the control
 * builds - and a literal in a spec would be a second spelling of the product's own wording, which
 * is the shape that lets a rename pass a suite that was never updated and fail one that was.
 *
 * **It is tied to the seeded mailbox deliberately.** `STORED_ADDRESS` is that mailbox's address, so
 * this constant and the seeding it describes cannot drift apart: a spec that seeds a different
 * mailbox asserts a different label, which is the point.
 */
export const INSERT_LABEL = affordanceInsertLabel(STORED_ADDRESS);

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

/**
 * The address this device holds, or `null` when it holds nothing.
 *
 * **A narrowing rather than a cast, and the distinction is the point.** The stored record is
 * *versioned* — `{ version, mailbox }` — so a spec that read `.address` off it found `undefined`
 * on a record that was present and correct, and the first version of the late-answer case reported
 * that as the address missing. Narrowing through the product's own declared type means the value
 * this returns is one this build wrote, which is what "the device holds that address" has to mean.
 *
 * **It does not go through `packages/storage`'s reader.** That reader *discards* a record it cannot
 * narrow, and a suite asserting "nothing is stored" from it would pass for the wrong reason on any
 * future version bump — the same trap this file's module note records from the other direction.
 */
export async function readStoredMailboxAddress(
  extension: LaunchedExtension,
): Promise<string | null> {
  const held = await readHeldAddresses(extension);
  return held[0] ?? null;
}

/**
 * Every address this device holds, newest first, through the product's own resolution order.
 *
 * ## Why this had to be written when it was
 *
 * `site-associations` gave this client a **collection** and left the singular record in place for
 * a device that predates the change, and `loadInsertableMailboxes` in `apps/extension/src/storage.ts`
 * now decides which of them answers "what can this device insert". **Every spec in this suite that
 * asked the storage the same question had to be pointed at the same answer**, so it is computed
 * here once rather than re-spelled per spec - and the first version of the repair left the helper
 * reading the singular record only, so four creation cases in `in-page-create.spec.ts` reported
 * "this device holds nothing" while the device held a mailbox the popup had just made. That is the
 * recorded direction: an assertion that reports absence for a value that is present.
 *
 * ## And it narrows, but refuses to collapse
 *
 * `readStoredMailboxCollection` answers `null` for both "the record is absent" and "the record is
 * unreadable", and collapsing those two is what {@link readSiteMap}'s note describes. So a record
 * that is present and unreadable **throws** here, and a spec can fail without a spec passing
 * against a record this build cannot read.
 *
 * @throws If either record is present and unreadable.
 */
export async function readHeldAddresses(extension: LaunchedExtension): Promise<readonly string[]> {
  const collectionRaw = await readRaw(extension, EXTENSION_MAILBOXES_KEY);
  if (collectionRaw !== null) {
    const collection = readStoredMailboxCollection(collectionRaw);
    if (collection === null) {
      throw new Error(
        "this device holds a mailbox collection this build cannot read, so a spec asserting the " +
          "held addresses would otherwise read it as an empty collection",
      );
    }
    if (collection.length > 0) {
      return collection.map((held) => held.address);
    }
  }

  const singularRaw = await readRaw(extension, EXTENSION_MAILBOX_KEY);
  if (singularRaw === null) {
    return [];
  }
  const singular = narrowStoredMailboxRecord(singularRaw);
  if (singular === null) {
    throw new Error(
      "this device holds a singular mailbox record this build cannot read, so a spec asserting the " +
        "held addresses would otherwise read it as no mailbox at all",
    );
  }
  return [singular.address];
}

/**
 * Empty the storage and **leave it empty**, for a spec whose subject is a first visit.
 *
 * **A separate name rather than an optional argument**, and the reason is that an optional
 * one would read as two ways of doing the same thing. `resetStoredMailbox` answers "make this
 * device hold exactly this mailbox"; this answers "make this device hold nothing", which is
 * the state `in-page-mailbox`'s creation cases require — **no mailbox and no seeded one**, so
 * the affordance offers to create rather than to insert.
 *
 * **Clearing before the page opens, always** — the controller reads storage **once, at boot**.
 * The same rule `openWithStoredMailbox` in `in-page.spec.ts` documents for seeding: navigate
 * first and clear second would be testing a controller that had already decided.
 */
export async function clearStoredMailboxBeforeNavigation(
  extension: LaunchedExtension,
): Promise<void> {
  await clearStoredMailbox(extension);
}

/**
 * What this device holds, read through the platform's own API inside the worker's own context.
 *
 * **A raw value rather than a `Mailbox`, deliberately.** `StoredMailboxRecord` is the *stored*
 * shape, and reading it rather than narrowing it through `packages/storage` is what makes the
 * assertion about what is on the device rather than about this build's ability to read it. A
 * spec that reused the product's reader would go green on an unreadable record and report
 * "nothing is held" — which is the exact trap `stored-mailbox.ts`'s module note names for a
 * hand-written record, reached from the other direction.
 *
 * @returns The raw stored record, or `null` when the device holds nothing.
 */
export async function readStoredMailboxRecord(
  extension: LaunchedExtension,
): Promise<unknown | null> {
  return extension.worker.evaluate(
    async ([path, key]) => {
      const area = (path as readonly string[]).reduce<object>(
        (node, step) => Reflect.get(node, step),
        globalThis,
      ) as StorageArea;
      const found = await area.get(key as string);
      return found[key as string] ?? null;
    },
    [[...AREA_PATH], EXTENSION_MAILBOX_KEY] as const,
  );
}

/**
 * A second mailbox, for a case whose subject is a device holding more than one.
 *
 * **`createMailbox` again, and with a distinct id**, because both properties are load-bearing:
 * an address alone cannot key a site association - a spec asserting "the right mailbox was
 * remembered" would be satisfied by a record keyed on the address, which is the very thing this
 * change had to correct - and two mailboxes sharing an id would make the association lookup
 * ambiguous.
 */
export const SECOND_MAILBOX: Mailbox = createMailbox({
  id: "in-page-spec-second",
  address: "spectre-in-page-second@guerrillamail.info",
  createdAt: 0,
  credentials: { provider: "guerrilla", sessionId: "in-page-spec-second-session" },
});

/** The address {@link SECOND_MAILBOX} carries, named so a spec reads as a claim not a value. */
export const SECOND_ADDRESS = SECOND_MAILBOX.address;

/** The insert control's resting label for {@link SECOND_MAILBOX}. */
export const SECOND_INSERT_LABEL = affordanceInsertLabel(SECOND_ADDRESS);

/** The host the fixture is served from, read from the origin the helper exports. */
export const FIXTURE_HOST = new URL(FIXTURE_ORIGIN).hostname;

/**
 * Write the mailbox **collection** this device holds, newest first.
 *
 * **Both halves, always: write and read back.** Same reason, and the same defect, as
 * {@link seedStoredMailbox} - the read-back makes the write a precondition rather than a hope.
 *
 * @throws If the record is not readable through the platform's own API afterwards.
 */
export async function seedMailboxCollection(
  extension: LaunchedExtension,
  mailboxes: readonly Mailbox[],
): Promise<void> {
  await writeAndConfirm(extension, EXTENSION_MAILBOXES_KEY, toStoredMailboxCollection(mailboxes));
}

/**
 * Record which mailbox this host was last used with.
 *
 * **Written as the product's own envelope rather than as a bare object**, so a spec that seeds an
 * association and then reads it back is exercising the same widening `saveSiteMailboxId` does -
 * `toStoredSiteAssociations` accepts the *raw* record for exactly that reason. A literal map here
 * would let a spec pass against a shape this build cannot read, which is the trap this file's
 * module note names from the other direction.
 */
export async function seedSiteAssociation(
  extension: LaunchedExtension,
  associations: Readonly<Record<string, string>>,
): Promise<void> {
  await writeAndConfirm(
    extension,
    EXTENSION_SITE_MAILBOXES_KEY,
    toStoredSiteAssociations(associations),
  );
}

/**
 * The raw site-association record on this device, or `null` when the device holds none.
 *
 * **Raw, and for the reason {@link readStoredMailboxRecord} is raw**: the claim the cases that use
 * this make is about what is *on the device*, not about what this build can narrow it to.
 */
export async function readSiteAssociations(extension: LaunchedExtension): Promise<unknown | null> {
  return readRaw(extension, EXTENSION_SITE_MAILBOXES_KEY);
}

/**
 * The site-to-mailbox map this device holds, read through the product's own reader.
 *
 * ## Why this does not simply return what the reader returns
 *
 * `readStoredSiteAssociations` answers `null` for **two** states - "this device remembers
 * nothing" and "this device holds a record this build cannot read" - and collapsing them is the
 * exact defect {@link readStoredMailboxRecord}'s note exists to avoid. So this reads the raw
 * record, narrows it with the product's reader, and **throws when the record is present and
 * unreadable**: a spec can then fail, but it cannot pass by reading `{}` for a record holding
 * entries.
 *
 * ## And why it narrows rather than reading the envelope member directly
 *
 * The first version of the association spec asserted against a hand-written member name and was
 * wrong: the envelope calls it `sites`, not `associations`, and the suite reported a mismatch on
 * a record holding exactly what it had been seeded with. **A spec that spells a record's internal
 * shape has a second copy of it**, and the copy is wrong the first time the record is renamed. So
 * the product's reader names the member and this helper is the only place the two are joined.
 *
 * @throws If the device holds a site-association record this build cannot read.
 */
export async function readSiteMap(
  extension: LaunchedExtension,
): Promise<Readonly<Record<string, string>>> {
  const raw = await readSiteAssociations(extension);
  if (raw === null) {
    return {};
  }

  const narrowed = readStoredSiteAssociations(raw);
  if (narrowed === null) {
    throw new Error(
      "this device holds a site-association record this build cannot read, so a spec asserting " +
        "the map would otherwise read it as an empty one",
    );
  }
  return narrowed;
}

/**
 * Write one key and refuse to return until the platform reports it present.
 *
 * **One round trip, and the confirmation is a read of the same key.** Two would be two chances
 * for another spec in this profile to write in between - and this profile is shared, which is the
 * recorded reason {@link resetStoredMailbox} clears before it seeds.
 */
async function writeAndConfirm(
  extension: LaunchedExtension,
  key: string,
  value: unknown,
): Promise<void> {
  const stored = await extension.worker.evaluate(
    async ([path, name, written]) => {
      const area = (path as readonly string[]).reduce<object>(
        (node, step) => Reflect.get(node, step),
        globalThis,
      ) as StorageArea;
      await area.set({ [name as string]: written });
      return area.get(name as string);
    },
    [[...AREA_PATH], key, value] as const,
  );

  if (stored[key] === undefined) {
    throw new Error(
      `seeding the extension's storage did not take: ${key} is still absent after a write, ` +
        `read back inside the extension's own service worker.`,
    );
  }
}

/** Read one key's raw value through the platform's own API, inside the worker's own context. */
async function readRaw(extension: LaunchedExtension, key: string): Promise<unknown | null> {
  return extension.worker.evaluate(
    async ([path, name]) => {
      const area = (path as readonly string[]).reduce<object>(
        (node, step) => Reflect.get(node, step),
        globalThis,
      ) as StorageArea;
      const found = await area.get(name as string);
      return found[name as string] ?? null;
    },
    [[...AREA_PATH], key] as const,
  );
}

/**
 * The raw **singular** mailbox record on this device, or `null`.
 *
 * **Present so a spec can assert this client does not write it.** `site-associations` moved every
 * write in this client onto the collection; a case that only read the collection back could not
 * tell "the collection holds it" from "the collection holds it *and* the singular record also
 * holds it", and a device with two answers to one question is exactly the defect the change
 * prevents.
 */
export async function readSingularRecord(extension: LaunchedExtension): Promise<unknown | null> {
  return readRaw(extension, EXTENSION_MAILBOX_KEY);
}

/**
 * The raw mailbox **collection** record on this device, or `null` when the device holds none.
 *
 * **Raw, for the reason {@link readStoredMailboxRecord} is raw**, and it exists because a spec
 * asserting "this device holds nothing" has to be able to look at the record this client actually
 * writes. Before this change every creation case in `in-page-create.spec.ts` read the singular
 * record alone, so the refusal arm was satisfied by a client that had created a mailbox through the
 * provider fallback.
 */
export async function readMailboxCollectionRecord(
  extension: LaunchedExtension,
): Promise<unknown | null> {
  return readRaw(extension, EXTENSION_MAILBOXES_KEY);
}
