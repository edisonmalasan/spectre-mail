/**
 * @vitest-environment jsdom
 *
 * The in-page surface's behaviour, driven through real DOM events.
 *
 * ## Why these are unit tests and not only browser cases
 *
 * The browser tier holds the claims that need a real page and a real framework. These hold the
 * ones that are about *this code's decisions* — which fields are recognised, and the three
 * refusals — because a unit test can reach every branch deliberately, including the branch where
 * the stored read **rejects**, which the browser tier cannot stage without a fake that fails.
 *
 * **`focusin`/`focusout` are dispatched by hand rather than by calling `element.focus()`**, so
 * the sequence under test is the one the platform produces: `focusout` on the old element, then
 * `focusin` on the new one. Driving `focus()` alone would skip the ordering that the controller's
 * deferred removal exists to handle, and would leave that branch unexercised.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Mailbox } from "@spectre-mail/core";
import { createMailbox } from "@spectre-mail/core";

import {
  AFFORDANCE_BUTTON_ATTRIBUTE,
  AFFORDANCE_CREATE_LABEL,
  AFFORDANCE_HOST_ATTRIBUTE,
  AFFORDANCE_LABEL,
} from "./content-script/affordance";
import { startInPageIntegration } from "./content-script/controller";
import { isEmailField } from "./content-script/email-field";
import { fakeRecords, settledBoot } from "./content-script/testing/fake-records";
import type { CreateMailboxAnswer } from "./protocol";

const ADDRESS = "kept@address.test";

/**
 * A stored mailbox carrying `address`.
 *
 * **`createMailbox`, and this was a defect the unit tier could not see.** The first version
 * wrote the object literal and cast it with `as Mailbox`, so it passed every assertion in
 * this file while naming a provider — `guerrillamail` — and a credential shape
 * — `{ kind, sidToken }` — that **no longer exist** in `packages/core`. Vitest does not
 * typecheck, so a fixture describing a model that was renamed years of milestones ago reads
 * as coverage. `pnpm typecheck` is what reported it, on the commit that added this file.
 */
function mailbox(address: string): Mailbox {
  return createMailbox({
    id: "unit-spec",
    address,
    createdAt: 0,
    credentials: { provider: "guerrilla", sessionId: "unit-spec-session" },
  });
}

function harness(
  options: {
    stored?: Mailbox | null;
    loadRejects?: boolean;
    createMailbox?: () => Promise<CreateMailboxAnswer>;
    onBlocked?: (reason: string) => void;
  } = {},
) {
  // **`replaceChildren()`, not `innerHTML = ""`** - see {@link field} for why no client file
  // in this repository builds or clears its DOM by markup.
  document.body.replaceChildren();

  const held = fakeRecords({
    mailboxes:
      options.stored === undefined
        ? [mailbox(ADDRESS)]
        : options.stored === null
          ? []
          : [options.stored],
    ...(options.loadRejects === undefined ? {} : { loadRejects: options.loadRejects }),
  });

  // **A default that answers `notActedOn` rather than nothing, so this file's own insertion cases
  // would fail if they ever dispatched a creation.** Every test below stores a mailbox, so the
  // creation path is unreachable here and `createMailbox` is never called; a default of
  // `undefined` would have made a bug that reached it a `TypeError` inside a `void`ed promise —
  // silent, because the harness discards it — where an answer is a value the test file can read.
  const createMailbox =
    options.createMailbox ?? (() => Promise.resolve<CreateMailboxAnswer>({ kind: "notActedOn" }));

  // **`onBlocked` is spread conditionally, not passed as `possibly undefined`.** This
  // workspace sets `exactOptionalPropertyTypes`, under which an optional property may be
  // absent but may not be present-and-undefined — so the first version did not compile, and
  // a conditional spread is the difference between "absent" and "explicitly nothing".
  const stop = startInPageIntegration({
    document,
    records: held.records,
    createMailbox,
    ...(options.onBlocked === undefined ? {} : { onBlocked: options.onBlocked }),
  });
  started.push(stop);

  // **`loadMailbox` is the collection's reader under its old name.** Several cases below assert on
  // *which host was consulted*, which is only reachable through the records; the alias keeps those
  // assertions readable instead of renaming them all for no gain.
  const loadMailbox = held.records.loadMailboxes;

  return { stop, loadMailbox, createMailbox, host, held };
}

/**
 * The affordance's host element, wherever it currently is.
 *
 * **A query rather than a captured reference**, so every assertion asks the *document* what
 * it holds right now. A captured node would still be readable after `remove()`, and an
 * assertion built on one would pass on a control the page no longer had — which is the
 * direction that matters for every absence assertion in this file.
 */
function host(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${AFFORDANCE_HOST_ATTRIBUTE}]`);
}

/** The platform's own ordering: out of the old field, into the new one. */
function focusField(field: HTMLElement): void {
  field.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  field.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
}

function blurField(field: HTMLElement): void {
  field.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

/**
 * How a field under test is described.
 *
 * **Attributes, and `value` as a property**, because that is what the product reads:
 * `isEmailField` reads `getAttribute("type")`, `getAttribute("autocomplete")`, and the
 * `name`/`id` pair, while `holdsText` reads `.value`. A fixture that set them the other way
 * round would exercise a path no real page takes.
 */
interface FieldSpec {
  readonly tag?: "input" | "button";
  readonly type?: string;
  readonly name?: string;
  readonly id?: string;
  readonly autocomplete?: string;
  readonly value?: string;
  readonly text?: string;
}

/**
 * Add one element to the document, described rather than written as markup.
 *
 * **No `innerHTML` and no `insertAdjacentHTML`, and that is a boundary rule rather than a
 * preference.** `website-client` forbids rendering untrusted content as markup anywhere under
 * `apps/`, and unlike the storage rules that one **exempts no test files** — it scans every
 * source file it finds. So the first version of this harness, which built its fields from HTML
 * strings, reported three violations of a shipped requirement and failed
 * `pnpm test` for doing so.
 *
 * **The two available repairs were weakening the rule or stopping the markup, and the second
 * is right on its own terms.** These tests are about a controller that watches focus; HTML
 * parsing is not what they are about, and describing the element states its signals outright
 * rather than hiding them inside a string. A reader can now see that the `username` case sets
 * a `name` and nothing else.
 */
function field(spec: FieldSpec = {}): HTMLElement {
  const created = document.createElement(spec.tag ?? "input");

  for (const attribute of ["type", "name", "id", "autocomplete"] as const) {
    const declared = spec[attribute];
    if (declared !== undefined) {
      created.setAttribute(attribute, declared);
    }
  }

  // **The property, not the attribute.** For an `<input>`, the `value` content attribute sets
  // the *default* value; `.value` is what `holdsText` reads and what a page writes.
  if (spec.value !== undefined && created instanceof HTMLInputElement) {
    created.value = spec.value;
  }

  if (spec.text !== undefined) {
    created.textContent = spec.text;
  }

  document.body.append(created);
  return created;
}

/** The ordinary email field most of this file focuses. */
const EMAIL: FieldSpec = { type: "email", name: "email" };

/**
 * Every controller this file starts, so each one is torn down.
 *
 * **This is not hygiene, it is the only reason these tests mean anything.** jsdom's
 * `document` is shared by every test in the file, and a controller attaches listeners to it.
 * The first version of this harness discarded `stop`, so each test left a live controller
 * behind: a test asserting *"no affordance with nothing stored"* was satisfied by the wrong
 * thing, because a **previous** test's controller — which had an address — answered the focus
 * event. It failed in *both* directions from the same cause, which is what made it a while:
 * one test found a stray affordance it should not have, and another found none because a
 * previous controller's deferred removal had torn it down.
 *
 * A leak across tests is the same defect as a leak across page loads, and it is invisible in
 * production only because production creates one controller per page.
 */
const started: Array<() => void> = [];

afterEach(() => {
  while (started.length > 0) {
    started.pop()?.();
  }
  // **`replaceChildren()`, not `innerHTML = ""`** - the same rule as the fixture builder
  // above, for the same reason: clearing by markup is a markup escape hatch.
  document.body.replaceChildren();
});

describe("recognising an email field", () => {
  it.each([
    ["type=email", { type: "email" }, true],
    ["autocomplete naming email", { type: "text", autocomplete: "email" }, true],
    ["name identifying email", { type: "text", name: "emailAddress" }, true],
    ["id identifying email", { type: "text", id: "user-email" }, true],
    ["a username field", { type: "text", name: "username" }, false],
    // **A button carrying an email signal, and that is the whole row.** The first version was
    // `{ tag: "button", type: "button", text: "go" }`, with nothing email-shaped on it — so it
    // was refused by the *other two* signals failing, and deleting the `tagName` guard entirely
    // left it green. The case was a proxy: it named the `tagName` check and never reached it.
    // `email-field.ts` states the reason the guard exists in exactly these terms — "a
    // `<button autocomplete="email">` is a button" — and this row is now that button.
    [
      "a button naming email",
      { tag: "button", type: "button", text: "go", autocomplete: "email" },
      false,
    ],
    // **A field with nothing set at all**, which the HTML-string version of this table could
    // not express: `<input />` parses to an input with no attributes, and the pair of
    // `"an input with no type"` cases above already differ only by `name` and `id`.
    ["an unnamed, untyped input", {}, false],
  ] as const)("treats %s as an email field", (_label, spec, expected) => {
    expect(isEmailField(field(spec as FieldSpec))).toBe(expected);
  });
});

describe("the affordance appears on focus, and only then", () => {
  it("offers nothing while no field holds focus", async () => {
    const { host } = harness();
    await settledBoot();
    expect(host()).toBeNull();
  });

  it("offers the affordance when an empty email field takes focus", async () => {
    const { host } = harness();
    await settledBoot();
    focusField(field(EMAIL));
    expect(host()).not.toBeNull();
  });

  it("offers nothing for a field that is not an email field", async () => {
    const { host } = harness();
    await settledBoot();
    focusField(field({ type: "text", name: "username" }));
    expect(host()).toBeNull();
  });

  it("removes the affordance when the field loses focus", async () => {
    const { host } = harness();
    await settledBoot();
    const target = field(EMAIL);
    focusField(target);
    blurField(target);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host()).toBeNull();
  });

  it("shows exactly one affordance when focus moves between two fields", async () => {
    harness();
    await settledBoot();
    focusField(field(EMAIL));
    focusField(field({ type: "email", name: "email" }));
    // **A settled task, not a bare `await`.** The teardown is deferred by one `setTimeout`,
    // so reading immediately would observe the moment before the bug fired — and that moment
    // has the right answer. The whole claim is about what survives the deferred removal, so
    // the read has to come after it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelectorAll(`[${AFFORDANCE_HOST_ATTRIBUTE}]`)).toHaveLength(1);
  });
});

describe("the two refusals", () => {
  // **Renamed rather than deleted, and the change is the point.** Before `in-page-mailbox` this
  // case asserted "offers nothing when this device holds no stored mailbox" — a refusal, and the
  // second of the two the module note names. **It is no longer a refusal:** a device holding nothing
  // is precisely the case a page may be offered creation on, and the delta's requirement names it.
  // The assertion is therefore inverted rather than weakened, and it now also reads the label,
  // because two controls being offered is the whole risk — one that inserts and one that creates
  // differ only by name.
  it("offers to create an address, and says so, when this device holds no stored mailbox", async () => {
    const { host } = harness({ stored: null });
    await settledBoot();
    await settledBoot();
    focusField(field(EMAIL));
    expect(host()).not.toBeNull();
    expect(host()?.shadowRoot?.textContent).toContain(AFFORDANCE_CREATE_LABEL);
    // **And not the inserting label.** A single label for both offers would be true of neither:
    // the person pressing the button is the only one who can tell inserting something held from
    // asking a provider for something that does not exist.
    expect(host()?.shadowRoot?.textContent).not.toContain(AFFORDANCE_LABEL);
  });

  it("offers nothing on a field that already holds text", async () => {
    const { host } = harness();
    await settledBoot();
    focusField(field({ type: "email", name: "email", value: "someone@example.com" }));
    expect(host()).toBeNull();
  });

  it("offers the affordance on a field holding only whitespace", async () => {
    // **This case exists because a mutation removed `trim()` and nothing caught it.**
    //
    // Every other case in this file puts an address in the field, and an address has no
    // surrounding whitespace — so `value !== ""` passes every one of them. That is the
    // twenty-first instance of a check narrower than its rule, authored here and caught here:
    // `holdsText` documents that it trims, and no assertion held it to its own comment.
    //
    // **And the direction of the assertion is the whole case.** Removing `trim()` makes a field
    // holding spaces count as a field holding text, so the affordance *disappears*. The
    // assertion therefore has to be that the control is **offered**, or the case would pass on
    // the mutation it exists to catch.
    //
    // **The repaired file had this inverted.** After the reconstruction recorded in `design.md`
    // it asserted `host()` was null — which is the answer the *mutant* gives, and which
    // therefore fails against the conforming implementation. The requirement's wording settles
    // which side the whitespace falls on: it refuses a field that "already holds **text**", and
    // `"   "` is not text a person typed; `holdsText`'s own comment says the same thing. Both
    // the code and the requirement say *offered*, so the assertion was the defect.
    //
    // **`type="text"` and not `type="email"`, and that is the second half of the fix — measured,
    // not chosen.** An `<input type="email">` runs the value **sanitization algorithm**, and
    // assigning `"   "` to one leaves `""`: the field is empty before a line of this product runs,
    // so `trim()` was never load-bearing *here* and removing it changed nothing. **This case was
    // therefore incapable of failing**, while its own comment claimed it existed for precisely the
    // mutation it missed. A `type="text"` field recognised through `name="email"` keeps all three
    // spaces — measured, and reported by the throwaway probe recorded in `design.md`.
    const { host } = harness();
    await settledBoot();
    focusField(field({ type: "text", name: "email", value: "   " }));
    expect(host()).not.toBeNull();
  });

  it("does not insert over text typed between focus and press", async () => {
    const { host } = harness();
    await settledBoot();
    const target = field(EMAIL) as HTMLInputElement;
    focusField(target);

    // The page writes to the field after the affordance is already showing.
    target.value = "typed-by-the-user@example.com";

    const button = host()?.shadowRoot?.querySelector(`[${AFFORDANCE_BUTTON_ATTRIBUTE}]`);
    (button as HTMLButtonElement).click();

    expect(target.value).toBe("typed-by-the-user@example.com");
  });
});

describe("a blocked read is not an absent address", () => {
  it("reports the rejection rather than treating it as nothing stored", async () => {
    const onBlocked = vi.fn();
    harness({ loadRejects: true, onBlocked });
    await settledBoot();
    await settledBoot();
    expect(onBlocked).toHaveBeenCalledWith("the read failed");
  });

  // **This case stopped being about insertion alone, and that is why it is still here.**
  // `in-page-mailbox` made a missing address mean "this device holds nothing", so a rejected
  // read would have been folded into that and offered a creation control. It must not be: the
  // controller cannot tell whether a mailbox exists, and creating a second one on top of an
  // unreadable store is a cost nobody agreed to. **So a read that failed produces neither offer**,
  // and the assertion that there is no control is now the only thing separating "blocked" from
  // "empty" that a test can observe — `readFailed` is private, and this is its whole observable.
  it("still offers nothing, because it neither holds nor can confirm an address", async () => {
    const { host } = harness({ loadRejects: true });
    await settledBoot();
    await settledBoot();
    focusField(field(EMAIL));
    expect(host()).toBeNull();
  });
});

describe("activating the affordance", () => {
  it("fills the field, dispatches both events, and does not submit the form", async () => {
    const { host } = harness();
    await settledBoot();

    const submitted = vi.fn();
    const form = document.createElement("form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitted();
    });
    const target = document.createElement("input");
    target.type = "email";
    form.append(target);
    document.body.append(form);

    const seen: string[] = [];
    target.addEventListener("input", () => seen.push("input"));
    target.addEventListener("change", () => seen.push("change"));

    focusField(target);

    const button = host()?.shadowRoot?.querySelector(`[${AFFORDANCE_BUTTON_ATTRIBUTE}]`);
    expect(button).not.toBeNull();
    // **The button's own type, asserted rather than assumed.** An injected <button> inside a
    // form defaults to type="submit", which would submit it.
    expect((button as HTMLButtonElement).type).toBe("button");
    (button as HTMLButtonElement).click();

    expect(target.value).toBe(ADDRESS);
    expect(seen).toEqual(["input", "change"]);
    expect(submitted).not.toHaveBeenCalled();
  });

  it("removes the affordance once it has acted", async () => {
    const { host } = harness();
    await settledBoot();
    const target = field(EMAIL) as HTMLInputElement;
    focusField(target);
    const button = host()?.shadowRoot?.querySelector(`[${AFFORDANCE_BUTTON_ATTRIBUTE}]`);
    (button as HTMLButtonElement).click();
    expect(host()).toBeNull();
  });

  it("survives the focus that pressing it moves, and still inserts", async () => {
    const { host } = harness();
    await settledBoot();
    const target = field(EMAIL) as HTMLInputElement;
    focusField(target);

    const button = host()?.shadowRoot?.querySelector(
      `[${AFFORDANCE_BUTTON_ATTRIBUTE}]`,
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    // **The platform's real press order, measured in Chromium** (`docs/PROVIDERS.md` §4.2):
    // `mousedown`, `focusout` on the field, **`focusin`**, `mouseup`, `click`. The focus
    // arrives first, and a controller that tears itself down on `focusin` removes the control
    // before the click lands.
    //
    // **`composed: true`, and this is the line that makes the test mean anything.** A
    // `FocusEvent` defaults to `composed: false`, so the first version of this test dispatched
    // an event that **never left the shadow root at all** — the document listener was never
    // called, the affordance was still on the page because nothing had happened, and the case
    // passed green. A test that dispatches an event the platform would never deliver is the
    // recorded shape of an assertion narrower than its rule.
    //
    // **And the target is the host, not the button.** The same measurement shows a
    // document-level listener receiving this event with `event.target` retargeted to the
    // shadow host. That is what the controller is compared against, so the test asserts the
    // retargeting rather than assuming it — a guard written against `event.target ===
    // button` would pass here and fail in the browser, which is exactly what happened.
    target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    button?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    expect(host()).not.toBeNull();

    button?.click();

    expect(target.value).toBe(ADDRESS);
  });

  it("sees the affordance's focus retargeted to its host, not its button", async () => {
    const { host } = harness();
    await settledBoot();
    focusField(field(EMAIL));

    const button = host()?.shadowRoot?.querySelector(`[${AFFORDANCE_BUTTON_ATTRIBUTE}]`);
    expect(button).not.toBeNull();

    // **The retargeting itself, asserted rather than assumed.** This is the fact the
    // controller's guard is written against, and it is the fact a first repair of that guard
    // got wrong: it compared `event.target` with the *button*, passed here, and failed in the
    // browser. An assertion that only pins the *behaviour* would have gone on passing while the
    // reason for it was wrong.
    const seen: Element[] = [];
    const listener = (event: Event): void => {
      seen.push(event.target as Element);
    };
    document.addEventListener("focusin", listener);
    button?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    document.removeEventListener("focusin", listener);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(host());
    expect(seen[0]).not.toBe(button);
  });

  it("does not confuse its own control for another field's", async () => {
    const { host } = harness();
    await settledBoot();
    focusField(field(EMAIL));

    // **Identity, not selector.** The guard compares the focus target with the live
    // affordance's own host and button; a guard written as "is this inside a shadow root?" or
    // "does this carry the affordance attribute?" would also exempt a control belonging to a
    // different field, which is the one case that must keep tearing down.
    const stray = document.createElement("button");
    stray.setAttribute(AFFORDANCE_BUTTON_ATTRIBUTE, "");
    document.body.append(stray);

    stray.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(host()).toBeNull();
  });

  it("labels the control, and keeps the label out of the page's own text", async () => {
    const { host } = harness();
    await settledBoot();
    focusField(field(EMAIL));
    expect(host()?.shadowRoot?.textContent).toContain(AFFORDANCE_LABEL);
    expect(document.body.textContent).not.toContain(AFFORDANCE_LABEL);
  });
});

describe("stopping the integration", () => {
  it("removes the affordance and stops listening", async () => {
    const { stop, host } = harness();
    await settledBoot();
    focusField(field(EMAIL));
    expect(host()).not.toBeNull();

    stop();
    expect(host()).toBeNull();

    focusField(field(EMAIL));
    expect(host()).toBeNull();
  });
});
