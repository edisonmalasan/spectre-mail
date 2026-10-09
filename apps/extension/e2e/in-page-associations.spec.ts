/**
 * Which mailbox a page is offered, in a real browser, on a page that is not ours.
 *
 * ## What makes these cases worth the browser tier
 *
 * `content-script-associations.test.ts` covers the decision, and it can do so because it hands the
 * controller a fake. **The two claims here are the ones a fake cannot make.**
 *
 * - **The key is `location.hostname`, and this suite proves what that is on a real page.** A unit
 *   case can only assert that the controller asked for a string; it cannot show that the string
 *   Chromium hands it is the same on `https://` and on `http://`, that it excludes a port, or that
 *   it is already lower-cased. Those are facts about the platform, and a substitution would have
 *   invented them.
 * - **The write reaches the device through the platform.** Reading the association back out of
 *   `chrome.storage` *inside the worker's own context* is what distinguishes "the page recorded
 *   it" from "the page believes it recorded it".
 *
 * ## Seeding is a precondition, and it is always before navigation
 *
 * The controller reads its records **once, at boot**, and the boot read now spans **two** records.
 * A spec that navigated first and seeded after would be testing a controller that had already
 * decided, and would report the absence of the right control as a product defect. Every helper
 * here writes and then reads the key back, because a write whose completion was never awaited is
 * the recorded cause of a late arrival.
 *
 * ## No provider is contacted
 *
 * Nothing here creates a mailbox: every case either offers an insertion or, where it needs an
 * empty device, offers creation and never presses it. The recorded-provider harness belongs to
 * `in-page-create.spec.ts`.
 *
 * @module
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import {
  affordanceButton,
  blurField,
  focusField,
  framedAffordanceCount,
  installStorageListener,
  openFixturePage,
  pageWorldReachesExtensionApis,
  plantAndRemoveFramedAffordance,
  storageEventsSeen,
  waitForFramedFixture,
} from "./helpers/in-page-fixture";
import {
  clearStoredMailbox,
  clearStoredMailboxBeforeNavigation,
  FIXTURE_HOST,
  INSERT_LABEL,
  readSiteAssociations,
  readSiteMap,
  SECOND_ADDRESS,
  SECOND_INSERT_LABEL,
  SECOND_MAILBOX,
  seedMailboxCollection,
  seedSiteAssociation,
  seedStoredMailbox,
  STORED_ADDRESS,
  STORED_MAILBOX,
} from "./helpers/stored-mailbox";

let extension: LaunchedExtension;

test.beforeAll(async () => {
  extension = await launchExtension();
});

test.afterAll(async () => {
  await extension?.close();
});

/**
 * Seed this device's two records, then open the fixture.
 *
 * **Two arguments with defaults rather than three positional ones**, because the two axes these
 * cases vary are independent: `mailboxes` is what the device holds and `associations` is what it
 * remembers about hosts. A positional signature would make "two mailboxes, no associations" read
 * as `undefined, SECOND_MAILBOX`.
 *
 * **Both halves are explicit at the call site** - `[]` for "holds nothing", `{}` for "remembers
 * nothing" - rather than defaulted. A spec that writes `[]` is making a claim; a spec that omits it
 * is accepting whatever a default says.
 */
async function openWith(
  mailboxes: readonly (typeof STORED_MAILBOX)[],
  associations: Readonly<Record<string, string>>,
  origin?: string,
): Promise<Page> {
  await clearStoredMailboxBeforeNavigation(extension);
  await seedMailboxCollection(extension, mailboxes);
  await seedSiteAssociation(extension, associations);
  return openFixturePage(extension.context, origin);
}

test.describe("which mailbox a page is offered", () => {
  test("offers the mailbox this host was last used with, not the newest", async () => {
    // **Newest first in the record, and the *older* one offered anyway.** The whole feature is the
    // difference between these two answers, so a case that offered the newest on a host that has
    // an association would pass every assertion below except the one about the value.
    const page = await openWith([STORED_MAILBOX, SECOND_MAILBOX], {
      [FIXTURE_HOST]: SECOND_MAILBOX.id,
    });

    await focusField(page, "react-input");

    await expect(affordanceButton(page)).toHaveText(SECOND_INSERT_LABEL);
  });

  test("inserts the address that host was last used with", async () => {
    // **The label and the inserted value in one case.** They are built by different code - the
    // label by `affordanceInsertLabel`, the insertion by the controller - and a control that
    // announced one address and wrote another into somebody's form is the worst outcome this
    // feature has, so it is asserted as a pair rather than as two halves elsewhere.
    const page = await openWith([STORED_MAILBOX, SECOND_MAILBOX], {
      [FIXTURE_HOST]: SECOND_MAILBOX.id,
    });

    await focusField(page, "react-input");
    await affordanceButton(page).click();

    await expect(page.locator("#react-input")).toHaveValue(SECOND_ADDRESS);
    expect(await page.locator('[data-readback="react-input"]').textContent()).toBe(SECOND_ADDRESS);
  });

  test("offers the newest when this host has no association recorded", async () => {
    // **An empty association map, and the device holds both.** Every other host in the map is
    // absent, so the only reason the newest is offered is that no host matched.
    const page = await openWith([STORED_MAILBOX, SECOND_MAILBOX], {});

    await focusField(page, "react-input");

    await expect(affordanceButton(page)).toHaveText(INSERT_LABEL);
  });

  test("does not offer another host's mailbox", async () => {
    // **A recorded association for a different host, and the newest is offered anyway.** This is
    // the case that a registrable-domain key would fail, and the one that decides whether the
    // feature keeps pages apart or folds a whole internet's worth of them together.
    const page = await openWith([STORED_MAILBOX, SECOND_MAILBOX], {
      "somewhere-else.invalid": SECOND_MAILBOX.id,
    });

    await focusField(page, "react-input");

    await expect(affordanceButton(page)).toHaveText(INSERT_LABEL);
  });

  test("resolves the same mailbox on http and https, because the key is the host", async () => {
    // **The platform's own naming, and the case the unit tier cannot write.** Both pages are
    // served from `in-page.invalid`; only the scheme differs. `location.hostname` excludes the
    // scheme, so one association serves both - and a key built from anything fuller would make
    // the plain-http page fall back to the newest while the other served the older.
    //
    // **Seeded once and read twice**, deliberately: there is no seeding between the two opens, so
    // the second page can only reach this answer by consulting the first page's record.
    const page = await openWith([STORED_MAILBOX, SECOND_MAILBOX], {
      [FIXTURE_HOST]: SECOND_MAILBOX.id,
    });
    await focusField(page, "react-input");
    await expect(affordanceButton(page)).toHaveText(SECOND_INSERT_LABEL);

    const plain = await openFixturePage(extension.context, "http://in-page.invalid");
    await focusField(plain, "react-input");

    await expect(affordanceButton(plain)).toHaveText(SECOND_INSERT_LABEL);
  });
});

test.describe("what the device remembers afterwards", () => {
  test("records the mailbox it inserted, under this host", async () => {
    // **Read back out of `chrome.storage` inside the worker's own context**, and not inferred from
    // the label. The recorded lesson from `in-page-create.spec.ts` is that waiting for something
    // to appear on a surface does not wait for the write behind it, so this polls the *record*.
    //
    // **A different host is seeded, and this host is seeded with nothing.** The first version of this
    // case seeded `FIXTURE_HOST` with the mailbox the press would insert, and then asserted that
    // same id afterwards - so the value was already there and the assertion could not fail. The
    // falsification pass found it by removing the write outright (mutation `B01`) and reading the
    // green. **It asserted the device *holds* an id while naming the device *recording* an
    // insertion, and those are only the same claim when nothing put that id there first.** Seeding a
    // neighbour instead also proves the write *adds a key* rather than being the first thing that
    // ever wrote the record.
    const page = await openWith([STORED_MAILBOX, SECOND_MAILBOX], {
      "somewhere-else.invalid": SECOND_MAILBOX.id,
    });

    await focusField(page, "react-input");
    await expect(affordanceButton(page)).toHaveText(INSERT_LABEL);

    // **The precondition, and the reason the poll below is an assertion.** Read with no waiting:
    // the claim is that this host has no entry *yet*, and waiting for it would let a slow write
    // still land before the absence was established.
    expect((await readSiteMap(extension))[FIXTURE_HOST]).toBeUndefined();

    await affordanceButton(page).click();

    // **The map the device now holds, read through the product's own reader** - which is the only
    // thing that can say which member of the envelope holds it. See `readSiteMap` for why the first
    // version of this assertion, which spelled the member out, reported a mismatch on a record
    // holding exactly what it was seeded with.
    await expect
      .poll(async () => (await readSiteMap(extension))[FIXTURE_HOST], { timeout: 5000 })
      .toBe(STORED_MAILBOX.id);

    // **And the neighbour is untouched**, because a write that replaced the whole map would satisfy
    // the line above while losing every other host this device remembers.
    expect((await readSiteMap(extension))["somewhere-else.invalid"]).toBe(SECOND_MAILBOX.id);
  });

  test("replaces a stale association, and only once something is inserted", async () => {
    // **A record pointing at a mailbox this device no longer holds.** The two halves are separate
    // claims and are asserted in order: the stale entry is *ignored* when the offer is made, and
    // *replaced* only after an insertion. A controller that rewrote it on the way past would be
    // performing a write nobody asked for, on a record it had already decided was wrong.
    const page = await openWith([STORED_MAILBOX], {
      [FIXTURE_HOST]: "a-mailbox-this-device-no-longer-holds",
    });

    await focusField(page, "react-input");

    // **The stale id is ignored, so the newest is offered.**
    await expect(affordanceButton(page)).toHaveText(INSERT_LABEL);

    // **And left exactly where it was**, read immediately after the offer and with no polling: the
    // claim is that *nothing was written*, so waiting for it would let a slow write still land.
    expect((await readSiteMap(extension))[FIXTURE_HOST]).toBe(
      "a-mailbox-this-device-no-longer-holds",
    );

    await affordanceButton(page).click();

    await expect
      .poll(async () => (await readSiteMap(extension))[FIXTURE_HOST], { timeout: 5000 })
      .toBe(STORED_MAILBOX.id);
  });
});

test.describe("the singular record, on a device that predates this change", () => {
  test("still inserts the address a device held before this change", async () => {
    // **The fallback, end to end, on a real page.** The compatibility case is the reason the
    // singular record is read at all: somebody who installed this extension before this change has
    // exactly one mailbox, in the singular record and nowhere else. A device holding nothing else
    // and no association must still be offered that address.
    //
    // **Seeded through `seedStoredMailbox`, not through the collection**, so the two records are
    // never both present and the case cannot pass on the collection's answer.
    await clearStoredMailboxBeforeNavigation(extension);
    await seedStoredMailbox(extension);
    await seedSiteAssociation(extension, {});
    const page = await openFixturePage(extension.context);

    await focusField(page, "react-input");
    await affordanceButton(page).click();

    await expect(page.locator("#react-input")).toHaveValue(STORED_ADDRESS);
  });

  test("prefers the collection when a device holds both, so the older record cannot shadow it", async () => {
    // **Both records written, and the newer one wins.** The alternative - merging the two records -
    // is what the product does not do: a merged list has no order the two records were written in
    // common with, and a merged list would also re-insert an address somebody had moved on from.
    await clearStoredMailboxBeforeNavigation(extension);
    await seedStoredMailbox(extension);
    await seedMailboxCollection(extension, [STORED_MAILBOX, SECOND_MAILBOX]);
    await seedSiteAssociation(extension, { [FIXTURE_HOST]: SECOND_MAILBOX.id });
    const page = await openFixturePage(extension.context);

    await focusField(page, "react-input");

    await expect(affordanceButton(page)).toHaveText(SECOND_INSERT_LABEL);
  });
});

test.describe("the two limits that stay", () => {
  test("reaches a same-origin iframe's field with nothing, because all_frames is unset", async () => {
    // **The control, and it runs first.** The frame proves *it* is loaded and inspectable by
    // carrying the affordance's own hook and being seen carrying it - a reader that could not see
    // the frame's light DOM would report `0` with or without the extension doing anything here.
    const page = await openWith([STORED_MAILBOX], {});

    await waitForFramedFixture(page);

    const frame = page.frameLocator("#framed");
    await frame.locator("#frame-input").focus();

    const seen = await plantAndRemoveFramedAffordance(page);
    expect(seen.planted).toBe(1);
    expect(seen.removed).toBe(0);

    // **And the top frame, on the same page, at the same moment, does get one.** Without this the
    // case would pass on a build whose content script had stopped running altogether, which is
    // the defect an absence assertion is most likely to hide.
    await focusField(page, "react-input");
    await expect(affordanceButton(page)).toHaveText(INSERT_LABEL);
    await blurField(page);

    // **Now the claim.** Nothing is injected into the frame, so its field is reached by nothing.
    expect(await framedAffordanceCount(page)).toBe(0);
  });

  test("gives the page's own storage listener nothing, and the listener demonstrably works", async () => {
    // **The page can reach none of this extension's namespaces**, read before any absence. A
    // content script runs in an isolated world. Chromium still hands a web page a `chrome` object
    // carrying the long-deprecated `loadTimes`, `csi` and `app` properties, so the *presence* of
    // the global is not the claim - the absence of `storage`, `runtime` and `alarms` is. The first
    // version of this case asserted `"chrome" in globalThis === false` and the platform answered
    // `true`; a global's presence is not its content, and the fix was to measure rather than keep
    // asserting the wrong thing.
    const page = await openWith([STORED_MAILBOX], {});

    expect(await pageWorldReachesExtensionApis(page)).toEqual([]);

    // **Two pages, two listeners, and the asymmetry is the whole experiment.**
    //
    // A `storage` event is delivered to *other* same-origin documents, never to the one that made
    // the write. So a listener on the page that performs the write is the wrong instrument - the
    // first version of this case put it there and the mutation that mirrors the insertion into
    // `localStorage` left it **green**, for the same reason a page cannot hear itself type.
    // Reading the **neighbour's** listener is what makes the claim testable, and the neighbour is
    // here for that reason and no other.
    const neighbour = await openFixturePage(extension.context);

    await installStorageListener(page);
    await installStorageListener(neighbour);

    // **The positive control, and it is a real event from the platform.** The neighbour writes;
    // this page hears it. Nothing in this suite dispatched anything.
    await neighbour.evaluate(() => localStorage.setItem("spectre-control", "written"));
    await expect.poll(async () => (await storageEventsSeen(page)).length).toBeGreaterThan(0);

    // **And the neighbour hears nothing of that same write**, because a document does not receive
    // its own. Read as a precondition: without it, the absence below could be satisfied by the
    // neighbour's listener never having worked.
    expect(await storageEventsSeen(neighbour)).toEqual([]);

    // **The absence, on the neighbour, over the extension's own write.** Insert, which records a
    // host association in the device's `chrome.storage.local` and - under mutation `L02` - mirrors
    // the address into `localStorage` from this page. The record is polled back first so the write
    // is *known* to have happened before its absence is read; waiting for nothing is what made the
    // recorded `in-page-create.spec.ts` case read `null` on CI.
    await focusField(page, "react-input");
    await expect(affordanceButton(page)).toHaveText(INSERT_LABEL);
    await affordanceButton(page).click();

    await expect
      .poll(async () => (await readSiteMap(extension))[FIXTURE_HOST], { timeout: 5000 })
      .toBe(STORED_MAILBOX.id);

    // **Two claims, and both are absences over a listener proven to work.** The neighbour has
    // heard nothing since its own write, and this page has heard nothing but the control's.
    expect(await storageEventsSeen(neighbour)).toEqual([]);
    expect(await storageEventsSeen(page)).toHaveLength(1);
  });
});

test.describe("a device holding nothing", () => {
  test("offers to create, and remembers nothing about this host until an insertion lands", async () => {
    // **No mailboxes, no associations** - the first-visit state on a device that has created
    // nothing. The control still appears, because creation is an offer that can act; and the
    // association record must still be absent afterwards, because **nothing was inserted** and a
    // record pointing at nothing would be a claim about a mailbox that does not exist.
    //
    // **Not pressed**, and that is the point: pressing it would send a message this tier does not
    // answer, which is what `in-page-create.spec.ts` is for.
    await clearStoredMailbox(extension);
    const page = await openFixturePage(extension.context);

    await focusField(page, "react-input");

    await expect(affordanceButton(page)).toBeVisible();
    expect(await readSiteAssociations(extension)).toBeNull();
  });
});
