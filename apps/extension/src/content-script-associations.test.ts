/**
 * @vitest-environment jsdom
 *
 * Which mailbox a page is offered, and what the device remembers about that page.
 *
 * ## Why this file exists beside `content-script.test.ts` rather than inside it
 *
 * The behaviour here is not about focus, markup, or the three refusals — it is about a **keyed
 * lookup and a write**, and it is the part of the in-page surface that can be exercised entirely
 * without a browser. One file per question keeps each file's `beforeEach` describing its own
 * subject: `content-script.test.ts` sets up fields, and this one sets up *two mailboxes and a map
 * of hosts*.
 *
 * ## Every case reads the host from the platform rather than naming it
 *
 * `document.location.hostname` is the value the product keys on, and this file asserts against
 * whatever the platform reports rather than against a literal. A test that hard-coded `"localhost"`
 * would pass on a jsdom configured differently and would then be testing a host the product never
 * sees. **The one case that could be hard-coded is the one that most needs not to be**: the key is
 * the exact host, and a literal here would let a change that lower-cased, trimmed, or suffixed it
 * still pass on this machine.
 */

import { afterEach, describe, expect, it } from "vitest";

import type { Mailbox } from "@spectre-mail/core";
import { createMailbox } from "@spectre-mail/core";

import {
  AFFORDANCE_BUTTON_ATTRIBUTE,
  AFFORDANCE_CREATE_LABEL,
  AFFORDANCE_HOST_ATTRIBUTE,
  affordanceInsertLabel,
} from "./content-script/affordance";
import { startInPageIntegration } from "./content-script/controller";
import { fakeRecords, settledBoot } from "./content-script/testing/fake-records";
import type { FakeRecords, FakeRecordsOptions } from "./content-script/testing/fake-records";
import type { CreateMailboxAnswer } from "./protocol";

/** A stored mailbox, built by the shared model and never by a literal — see `content-script.test.ts`. */
function mailbox(id: string, address: string): Mailbox {
  return createMailbox({
    id,
    address,
    createdAt: 0,
    credentials: { provider: "guerrilla", sessionId: `${id}-session` },
  });
}

/** The host the product would key on, read from the platform rather than assumed. */
const HOST: string = document.location.hostname;

/** The newest mailbox this device holds, and the older one an association can point at. */
const NEWEST = mailbox("newest", "newest@address.test");
const OLDER = mailbox("older", "older@address.test");

const started: Array<() => void> = [];

afterEach(() => {
  while (started.length > 0) {
    started.pop()?.();
  }
  document.body.replaceChildren();
});

/** An email input, described rather than written as markup — the boundary rule under `apps/`. */
function emailField(): HTMLInputElement {
  const created = document.createElement("input");
  created.setAttribute("type", "email");
  created.setAttribute("name", "email");
  document.body.append(created);
  return created;
}

function host(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${AFFORDANCE_HOST_ATTRIBUTE}]`);
}

function button(): HTMLButtonElement | null {
  return host()?.shadowRoot?.querySelector(`[${AFFORDANCE_BUTTON_ATTRIBUTE}]`) ?? null;
}

function start(options: FakeRecordsOptions): { held: FakeRecords; target: HTMLInputElement } {
  document.body.replaceChildren();
  const held = fakeRecords(options);

  const stop = startInPageIntegration({
    document,
    records: held.records,
    createMailbox: (): Promise<CreateMailboxAnswer> => Promise.resolve({ kind: "notActedOn" }),
  });
  started.push(stop);

  const target = emailField();
  return { held, target };
}

describe("choosing the mailbox a page is offered", () => {
  it("offers the mailbox this host was last used with, and inserts that one", async () => {
    const { held, target } = start({
      // **Newest first, because that is the order the collection promises** — and the point of the
      // case is that the *older* entry is chosen anyway.
      mailboxes: [NEWEST, OLDER],
      associations: { [HOST]: OLDER.id },
    });
    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(button()?.textContent).toBe(affordanceInsertLabel(OLDER.address));

    button()?.click();

    expect(target.value).toBe(OLDER.address);
    expect(held.saves).toEqual([{ host: HOST, mailboxId: OLDER.id }]);
  });

  it("offers the newest when this host has no association recorded", async () => {
    const { held, target } = start({ mailboxes: [NEWEST, OLDER] });
    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    // **The lookup happened and found nothing, which is not the same as no lookup.** A case that
    // only asserted the inserted address would pass against a controller that never consulted a
    // host — and that controller would offer the newest on every site forever, which is the
    // behaviour this feature exists to replace.
    expect(held.reads).toEqual([HOST]);

    button()?.click();

    expect(target.value).toBe(NEWEST.address);
  });

  it("asks about this page's own host and no other", async () => {
    // **Two hosts are recorded, and only one may be consulted.** The failure this guards is a key
    // built from something other than this document's host — a registrable domain, a port, a
    // suffix — each of which would fold pages together that the product is meant to keep apart.
    const { held } = start({
      mailboxes: [NEWEST],
      associations: { "somewhere-else.test": NEWEST.id, [HOST]: NEWEST.id },
    });
    await settledBoot();

    expect(held.reads).toEqual([HOST]);
    expect(held.reads).not.toContain("somewhere-else.test");
  });

  it("records the mailbox it inserted, under this host", async () => {
    // **Its own case, rather than a third assertion bolted onto one above.**
    //
    // The two cases below that read `held.saves` are about *which* mailbox was chosen and about a
    // stale record being left alone; their save assertion rides along on a case that would still
    // pass without it. A mutation that removed the write outright therefore left this file's only
    // unit coverage of it untouched — recorded by the falsification pass as `E03`, declared `caught`,
    // and observed green. **A defect caught in the browser tier and nowhere else is a fact about
    // the tier, not about the suite**, and three entries in the table is what finding it out cost.
    const { held, target } = start({ mailboxes: [NEWEST, OLDER] });
    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    button()?.click();

    expect(target.value).toBe(NEWEST.address);
    expect(held.saves).toEqual([{ host: HOST, mailboxId: NEWEST.id }]);
  });

  it("offers the newest when the association cannot be read at all", async () => {
    // **The delta's "The association cannot be read at all", and it is a case of its own rather than
    // a variant of the stale one above.**
    //
    // Those two look alike and are not: the stale case reads the record and finds an id this device
    // does not hold, while this one cannot read the record at all. **A single case cannot cover
    // both**, because the defect this one guards is a rejection escaping into the boot read — and a
    // controller that read the record successfully would never take that path, so the case would
    // pass on exactly the implementation that is wrong.
    const { held, target } = start({
      mailboxes: [NEWEST, OLDER],
      associations: { [HOST]: OLDER.id },
      // **The lookup alone.** `loadRejects` would fail the collection read too, and then "offers
      // nothing" would be the correct answer — so a case using the broader flag would pass against
      // a controller that has the bug and fail against one that does not.
      loadSiteRejects: true,
    });
    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    // **The newest, and not the older one the unreadable record names.** A controller that offered
    // the older mailbox here would be reporting an association it could not read, which is the one
    // thing the requirement forbids by name.
    expect(button()?.textContent).toBe(affordanceInsertLabel(NEWEST.address));

    // **And it asked.** A controller that swallowed the lookup's failure without consulting it
    // satisfies the label assertion too.
    expect(held.reads).toEqual([HOST]);

    button()?.click();

    expect(target.value).toBe(NEWEST.address);
  });

  it("ignores a recorded mailbox this device no longer holds, and leaves the record in place", async () => {
    const { held, target } = start({
      mailboxes: [NEWEST],
      associations: { [HOST]: "removed-somewhere-else" },
    });
    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(button()?.textContent).toBe(affordanceInsertLabel(NEWEST.address));

    // **Still exactly what it was, before anything was inserted.** Rewriting a stale entry on the
    // way past would be a write nobody asked for, on a device that may not even hold the mailbox any
    // more; the entry is replaced when an insertion actually happens, and not before.
    expect(held.associations[HOST]).toBe("removed-somewhere-else");
    expect(held.saves).toEqual([]);

    button()?.click();

    expect(target.value).toBe(NEWEST.address);
    expect(held.saves).toEqual([{ host: HOST, mailboxId: NEWEST.id }]);
  });
});

describe("naming the address in the control", () => {
  it("names the address it inserts, and keeps it out of the page's own text", async () => {
    const { target } = start({ mailboxes: [NEWEST], associations: { [HOST]: NEWEST.id } });
    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(button()?.textContent).toBe(`Use SpectreMail: ${NEWEST.address}`);

    // **The shadow root is the only place it may appear.** A control whose label were rendered into
    // the page would be a stranger's page reading a disposable address out loud, and this case is
    // what holds the line between the two.
    expect(document.body.textContent).not.toContain(NEWEST.address);
  });
});

describe("a write that does not happen", () => {
  it("still inserts, because the person asked for the address and not for the bookkeeping", async () => {
    const { held, target } = start({
      mailboxes: [NEWEST],
      associations: { [HOST]: NEWEST.id },
      saveRejects: true,
    });
    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    button()?.click();
    await settledBoot();

    expect(target.value).toBe(NEWEST.address);
    expect(held.saves).toEqual([]);
  });
});

describe("the flush these cases depend on", () => {
  it("offers to create before the read has settled, and the mailbox after it has", async () => {
    // **The control for `settledBoot`, and it is the reason that function is not a habit.**
    //
    // Every case above waits for `settledBoot()` before acting, and a flush that drained nothing
    // would leave them all passing — so the question "does this function do anything" needs a case
    // that can fail. This one asserts both states of the *same* page: the offer before the flush
    // and the offer after it, which differ. A flush that became a no-op would make the second
    // assertion read the first state and go red.
    //
    // ## The first state is a real behaviour, and it predates this change
    //
    // **A page focused before the boot read settles is offered creation**, because a device that
    // holds nothing and a device whose answer has not arrived are the same thing to a control that
    // has to decide now — and creation is an offer that can act, so it is not a control that lies.
    // This is unchanged by `site-associations`: the stored answer was already read asynchronously
    // and the offer was already made before it arrived. **It is written down here because it reads
    // as a defect from the outside** — a button that says "Create" on a device that holds an
    // address — and a reader meeting it in the suite for the first time should find it explained
    // rather than infer that the boot read is racing.
    const { target } = start({ mailboxes: [NEWEST], associations: { [HOST]: NEWEST.id } });

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(button()?.textContent).toBe(AFFORDANCE_CREATE_LABEL);

    // **Focus leaves, so the offer is withdrawn and the next focus asks again** — which is how the
    // settled answer gets a chance to reach the page at all.
    target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

    await settledBoot();

    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(button()?.textContent).toBe(affordanceInsertLabel(NEWEST.address));
  });
});
