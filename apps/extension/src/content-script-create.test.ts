/**
 * @vitest-environment jsdom
 *
 * Creating an address from inside somebody else's page, driven through real DOM events.
 *
 * ## Why this is a separate file from `content-script.test.ts`
 *
 * **Because one of that file's cases had to be inverted, and inverting it there would have made the
 * inversion invisible.** It asserted *"offers nothing when this device holds no stored mailbox"* — a
 * refusal, and the second of the two `entry.ts` names. Creating an address from a page makes that
 * case an *offer*, so the assertion had to reverse. A file whose history reads "this control offers
 * nothing with nothing stored" and whose current case says the opposite is a file that will be
 * misread by the next person, and the browser tier cannot check the reversal because it exercises
 * the inserting path. So the creating controller gets its own file, and the inverted case lives
 * there with the rest of them.
 *
 * ## What only this tier can reach, and why the browser tier is not a substitute
 *
 * **The refusals and the branches in between.** `notStored`, `notActedOn`, a rejected seam, a field
 * that acquired text mid-request, and — the one the browser tier cannot stage at all — **the wait
 * passing**. That last one needs a request held open for longer than a person would wait, and the
 * recorded provider serves its answers immediately. Here the ceiling is the product's own constant
 * (imported, never hand-picked — see `create-wait.ts` for why), and fake timers make passing it a
 * settled fact rather than a race.
 *
 * ## And the case that exists because the first draft got it wrong
 *
 * **The late answer.** After the wait passes and nothing was found, the page has already told a
 * person it could not confirm — and a request the page has stopped waiting on may still be answered,
 * because a provider round trip is not bounded by anything this product decided. Inserting at that
 * point would be acting after withdrawing the offer. The requirement did not name this case when the
 * change was proposed; it was added to the delta during apply, and the amendment is recorded in the
 * change's `design.md`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Mailbox } from "@spectre-mail/core";
import { createMailbox } from "@spectre-mail/core";

import {
  AFFORDANCE_BUTTON_ATTRIBUTE,
  AFFORDANCE_CREATE_LABEL,
  AFFORDANCE_HOST_ATTRIBUTE,
  AFFORDANCE_UNCONFIRMED_LABEL,
  AFFORDANCE_WAITING_LABEL,
} from "./content-script/affordance";
import { IN_PAGE_CREATE_CEILING_MS } from "./content-script/create-wait";
import { startInPageIntegration } from "./content-script/controller";
import type { CreateMailboxAnswer } from "./protocol";

const ADDRESS = "created@address.test";

/** A stored mailbox carrying `address`. Built by the shared model, never by a literal. */
function mailbox(address: string): Mailbox {
  return createMailbox({
    id: "create-spec",
    address,
    createdAt: 0,
    credentials: { provider: "guerrilla", sessionId: "create-spec-session" },
  });
}

/** A deferred value, so a request can be held open for as long as a case needs it. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function harness(options: { readonly stored?: Mailbox | null } = {}) {
  document.body.replaceChildren();

  const stored = options.stored === undefined ? null : options.stored;
  const loadMailbox = vi.fn(async (): Promise<Mailbox | null> => stored);
  const createMailbox = vi.fn(async (): Promise<CreateMailboxAnswer> => ({ kind: "notActedOn" }));

  const stop = startInPageIntegration({
    document,
    storage: { loadMailbox },
    createMailbox,
  });
  started.push(stop);

  return { stop, loadMailbox, createMailbox, host, button, field, focus };
}

/** The affordance's host element, read from the document every time. */
function host(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${AFFORDANCE_HOST_ATTRIBUTE}]`);
}

/** The control, as the button it is — read through the shadow root every time. */
function button(): HTMLButtonElement | null {
  return host()?.shadowRoot?.querySelector(
    `[${AFFORDANCE_BUTTON_ATTRIBUTE}]`,
  ) as HTMLButtonElement | null;
}

/** An empty email field, appended to the document and focused with the platform's own event pair. */
function field(): HTMLInputElement {
  document.body.replaceChildren();
  const created = document.createElement("input");
  created.setAttribute("type", "email");
  created.setAttribute("name", "email");
  document.body.append(created);
  created.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

  return created;
}

/** Focus left the field, as the platform delivers it. */
function blur(target: HTMLElement): void {
  target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

/**
 * Every controller this file starts, so each one is torn down.
 *
 * **jsdom's `document` is shared by every test in the process** and a controller attaches listeners
 * to it, so a leaked one answers a later case's focus events with a state from an earlier case.
 * `content-script.test.ts` records this defect in detail; the same teardown discipline applies here,
 * and it is also what guarantees no ceiling timer outlives its case.
 */
const started: Array<() => void> = [];

afterEach(() => {
  while (started.length > 0) {
    started.pop()?.();
  }
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("offering to create an address", () => {
  it("offers creation when this device holds nothing, and names it as creation", async () => {
    const { createMailbox } = harness();
    await Promise.resolve();
    await Promise.resolve();

    const target = field();

    expect(host()).not.toBeNull();
    expect(button()?.textContent).toBe(AFFORDANCE_CREATE_LABEL);
    expect(button()?.disabled).toBe(false);
    expect(createMailbox).not.toHaveBeenCalled();
    expect(target.value).toBe("");
  });

  it("asks the background context when it is activated, and inserts what comes back", async () => {
    const { createMailbox } = harness();
    await Promise.resolve();
    await Promise.resolve();

    const target = field();
    const seen: string[] = [];
    target.addEventListener("input", () => seen.push("input"));
    target.addEventListener("change", () => seen.push("change"));

    createMailbox.mockResolvedValue({ kind: "created", address: ADDRESS });
    button()?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(createMailbox).toHaveBeenCalledTimes(1);
    // **The page's own code reads the value back, and both events are dispatched** — the same
    // property `extension-client` requires of an insertion, and required here explicitly because a
    // created address reaches the field by a second code path. A page that listens for `input`
    // would otherwise watch an address arrive that it never heard about.
    expect(target.value).toBe(ADDRESS);
    expect(seen).toEqual(["input", "change"]);
    expect(host()).toBeNull();
  });
});

describe("while a request is outstanding", () => {
  it("reports that it is waiting, and disables itself against a second activation", async () => {
    const answer = deferred<CreateMailboxAnswer>();
    const { createMailbox } = harness();
    await Promise.resolve();
    await Promise.resolve();

    field();
    createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    expect(button()?.textContent).toBe(AFFORDANCE_WAITING_LABEL);
    expect(button()?.disabled).toBe(true);
    // **`aria-busy` as well, and the two are not redundant.** `disabled` is what stops a second
    // request reaching the extension at all; `aria-busy` is what tells a screen reader the control
    // is working rather than merely unavailable, which is the half a guard in the handler cannot
    // provide.
    expect(button()?.getAttribute("aria-busy")).toBe("true");

    // **Two further activations, not one.** A guard in the handler would satisfy a single press; the
    // requirement is that a person cannot start a second request, and a person presses twice.
    button()?.click();
    button()?.click();
    await Promise.resolve();
    expect(createMailbox).toHaveBeenCalledTimes(1);

    answer.resolve({ kind: "created", address: ADDRESS });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  it("keeps the control when focus leaves, and removes it once the answer arrives", async () => {
    const answer = deferred<CreateMailboxAnswer>();
    const { createMailbox } = harness();
    await Promise.resolve();
    await Promise.resolve();

    const target = field();
    createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    blur(target);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // **The requirement's exception, and its two halves.** Focus leaving a field normally removes
    // the control within a task; while an answer is outstanding it must not — and it must still be
    // gone the moment the answer lands, or the exception would have become persistence.
    expect(host()).not.toBeNull();

    answer.resolve({ kind: "created", address: ADDRESS });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(target.value).toBe(ADDRESS);
    expect(host()).toBeNull();
  });

  it("inserts nothing into a field that acquired text, and still records the address", async () => {
    const answer = deferred<CreateMailboxAnswer>();
    const { createMailbox } = harness();
    await Promise.resolve();
    await Promise.resolve();

    const target = field();
    createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    // **The page writes while the request is out** — an autofill, a password manager, the person.
    target.value = "typed-by-the-user@example.com";

    answer.resolve({ kind: "created", address: ADDRESS });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(target.value).toBe("typed-by-the-user@example.com");

    // **And the address is recorded even though nothing was inserted.** This is the half that is
    // easy to leave out and expensive to: the mailbox exists and is stored, so a controller that
    // only learned the address by inserting it would offer to create a *second* mailbox on the next
    // field focus. The next case is where that is observed.
    blur(target);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = field();
    expect(second.value).toBe("");
    expect(host()).not.toBeNull();
    expect(button()?.textContent).not.toBe(AFFORDANCE_CREATE_LABEL);
  });
});

describe("an answer that carries no address", () => {
  it.each([
    ["notStored", { kind: "notStored" } as const],
    ["notActedOn", { kind: "notActedOn" } as const],
  ])(
    "reports that it could not confirm on %s, and lets a person ask again",
    async (_label, answer) => {
      const { createMailbox } = harness();
      await Promise.resolve();
      await Promise.resolve();

      field();
      createMailbox.mockResolvedValue(answer);
      button()?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(button()?.textContent).toBe(AFFORDANCE_UNCONFIRMED_LABEL);
      expect(button()?.disabled).toBe(false);
      expect(button()?.getAttribute("aria-busy")).toBeNull();

      // **A second request, and the requirement states the cost of permitting it.** Two requests
      // could create two mailboxes at a provider; the alternative leaves somebody who has been told
      // nothing with no way forward. So the control is offered again and the fact is not hidden.
      createMailbox.mockResolvedValue({ kind: "created", address: ADDRESS });
      button()?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(createMailbox).toHaveBeenCalledTimes(2);
    },
  );

  it("reports the provider's own words on a refusal", async () => {
    const { createMailbox } = harness();
    await Promise.resolve();
    await Promise.resolve();

    field();
    createMailbox.mockResolvedValue({
      kind: "refused",
      description: "Mail.tm is throttling this request while creating a mailbox.",
    });
    button()?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // **Verbatim, and as the control's accessible name.** There is no error region on somebody
    // else's page and no toast, so the button's name is the only surface a person has — and a
    // summary written here would be a second thing that can disagree with the provider.
    expect(button()?.textContent).toBe(
      "Mail.tm is throttling this request while creating a mailbox.",
    );
    expect(button()?.textContent).not.toContain("unconfirmed");
    expect(button()?.disabled).toBe(false);
  });

  it("reports nothing as failed when the request itself rejects", async () => {
    const onBlocked = vi.fn();
    document.body.replaceChildren();
    const createMailbox = vi.fn(() => Promise.reject(new Error("the message channel is gone")));
    const stop = startInPageIntegration({
      document,
      storage: { loadMailbox: async () => null },
      createMailbox,
      onBlocked,
    });
    started.push(stop);
    await Promise.resolve();
    await Promise.resolve();

    field();
    button()?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // **`notActedOn` rather than a refusal, and the two are kept apart end to end.** A rejected
    // seam means no answer arrived, which is a different fact from a provider refusing, and the
    // copy is different: one says nothing was observed, the other says the provider used these
    // words. `entry.ts` maps an unreachable background context onto the same variant for the same
    // reason.
    expect(button()?.textContent).toBe(AFFORDANCE_UNCONFIRMED_LABEL);
    expect(onBlocked).toHaveBeenCalledWith("the message channel is gone");
  });
});

describe("when the wait passes", () => {
  /** Hold a request open, and let the product's own ceiling pass — the constant, never a number. */
  function holdOpen() {
    const answer = deferred<CreateMailboxAnswer>();
    const opened = harness();
    return { ...opened, answer };
  }

  it("reads what this device holds, and inserts it when a mailbox is there", async () => {
    vi.useFakeTimers();

    const { answer, createMailbox, loadMailbox } = holdOpen();
    await Promise.resolve();
    await Promise.resolve();

    const target = field();
    createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    // **The mailbox appears only in storage, after the wait has passed** — which is exactly the
    // situation the requirement describes: the worker stored it and its answer never came back.
    loadMailbox.mockResolvedValue(mailbox(ADDRESS));

    await vi.advanceTimersByTimeAsync(IN_PAGE_CREATE_CEILING_MS);
    await Promise.resolve();
    await Promise.resolve();

    expect(target.value).toBe(ADDRESS);
    expect(host()).toBeNull();
    expect(createMailbox).toHaveBeenCalledTimes(1);
  });

  it("reports that it could not confirm when nothing is held, and stays offered", async () => {
    vi.useFakeTimers();

    const { answer, createMailbox } = holdOpen();
    await Promise.resolve();
    await Promise.resolve();

    const target = field();
    createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(IN_PAGE_CREATE_CEILING_MS);
    await Promise.resolve();
    await Promise.resolve();

    // **The sentence says what was observed and nothing else.** Not "failed" — nothing failed that
    // was observed. Not "no mailbox was created" — a mailbox may well exist, and this page cannot
    // see it. And the control stays available, because a person who has been told nothing needs a
    // way forward.
    expect(button()?.textContent).toBe(AFFORDANCE_UNCONFIRMED_LABEL);
    expect(button()?.disabled).toBe(false);
    expect(host()).not.toBeNull();
    expect(target.value).toBe("");

    createMailbox.mockResolvedValue({ kind: "created", address: ADDRESS });
    button()?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(createMailbox).toHaveBeenCalledTimes(2);
    expect(target.value).toBe(ADDRESS);
  });

  it("keeps the control disabled across the read that follows the wait", async () => {
    vi.useFakeTimers();

    const { answer, createMailbox, loadMailbox } = holdOpen();
    await Promise.resolve();
    await Promise.resolve();

    field();
    createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    // **The read is held open, so the control is observed mid-read.** This is the window in which
    // "could not confirm" appearing would leave a person one press away from a second request while
    // the first may still succeed — the requirement's own scenario permits the offer to remain, and
    // what is not permitted is a *startable* second request while the first is unresolved.
    const read = deferred<Mailbox | null>();
    loadMailbox.mockReturnValue(read.promise);

    await vi.advanceTimersByTimeAsync(IN_PAGE_CREATE_CEILING_MS);
    await Promise.resolve();

    expect(button()?.disabled).toBe(true);

    read.resolve(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(button()?.disabled).toBe(false);
  });

  it("acts on nothing when a late answer arrives after the wait already passed", async () => {
    vi.useFakeTimers();

    const { answer, createMailbox, loadMailbox } = holdOpen();
    await Promise.resolve();
    await Promise.resolve();

    const target = field();
    createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    loadMailbox.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(IN_PAGE_CREATE_CEILING_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(button()?.textContent).toBe(AFFORDANCE_UNCONFIRMED_LABEL);

    // **The answer lands last, and by then the page has withdrawn its offer.** The mailbox is real
    // and stored — the worker persisted it before answering — so the address is recorded; what must
    // not happen is writing it into the field afterwards. This is the case the requirement did not
    // name when the change was proposed and the delta now does.
    answer.resolve({ kind: "created", address: ADDRESS });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(target.value).toBe("");

    // **And the next field focus offers the address that now exists** rather than a second creation.
    // That is the reason the address is recorded even though nothing was inserted.
    //
    // **Fake timers, and the reason the other cases below do not use them.** This case awaits a real
    // `setTimeout(resolve, 0)` to let the controller's deferred removal run, and that timer never
    // fires under `vi.useFakeTimers()` — so the first version of this case timed out at five seconds
    // having asserted nothing at all. A passing assertion set was not reached; the *timeout* was the
    // only evidence it produced, and it would have read as a product defect rather than a fixture
    // one had the diagnosis gone the other way.
    blur(target);
    await vi.advanceTimersByTimeAsync(0);
    const second = field();
    expect(second.value).toBe("");
    expect(button()?.textContent).not.toBe(AFFORDANCE_CREATE_LABEL);

    button()?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(second.value).toBe(ADDRESS);
    // **One request for the whole sequence** — the late answer was recorded rather than replayed.
    expect(createMailbox).toHaveBeenCalledTimes(1);
  });
});

describe("stopping the integration while a request is out", () => {
  it("clears the wait, so no read of storage happens afterwards", async () => {
    vi.useFakeTimers();

    const answer = deferred<CreateMailboxAnswer>();
    const opened = harness();
    await Promise.resolve();
    await Promise.resolve();

    field();
    opened.createMailbox.mockReturnValue(answer.promise);
    button()?.click();
    await Promise.resolve();

    const readsBefore = opened.loadMailbox.mock.calls.length;
    opened.stop();

    await vi.advanceTimersByTimeAsync(IN_PAGE_CREATE_CEILING_MS * 2);
    await Promise.resolve();

    // **A timer that outlived its controller would read this device's storage after teardown.**
    // That is harmless in production and not in a page that navigates away, and it is invisible to
    // every assertion above — so the teardown is what is being tested here, not the wait.
    expect(opened.loadMailbox.mock.calls).toHaveLength(readsBefore);
    expect(host()).toBeNull();
  });
});
