/**
 * @vitest-environment jsdom
 *
 * Putting a one-time code into a page's field — the module behind *"A code the user has seen can
 * reach the open page's field on one activation"*.
 *
 * ## What this tier is for, given the browser tier holds a real page and a real framework
 *
 * **Every branch here is a decision this module makes, and each one is reachable only by arranging
 * a page.** The browser tier can show one qualifying field being filled against React 19; it cannot
 * reach "two fields qualified and the person has not chosen", "the only field already holds text",
 * "this document is not the top one", or "the person dismissed it" without planting the exact
 * markup and then reading a popup that does not exist in that run. So the whole decision table is
 * here, and the browser tier holds the one case that proves the table was reached at all.
 *
 * ## Every answer here is a *fact about a page*, and the facts are checked together
 *
 * **Asserting the answer without asserting what the page now holds would let most of these cases
 * pass.** A handler that answered `filled` and wrote nothing, or answered `noField` and filled a
 * field anyway, satisfies a test that reads only the discriminant. Each case below therefore reads
 * **both** the answer and every qualifying field's own value, because the answer is a claim and the
 * value is the thing the claim is about.
 *
 * ## The top-frame case is here for a stated reason
 *
 * **`all_frames` is unset in the shipped manifest, so no browser case can reach it** — a content
 * script never runs in a frame in this build. The requirement still asks for the rule, and a rule
 * nothing can falsify is a rule nobody has tested. So `view` is an option rather than something
 * read from the global, and this file supplies a window that is not its own top. See
 * `content-script/fill.ts`'s note on why that option exists.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFieldChoice,
  FIELD_CHOICE_DISMISS_ATTRIBUTE,
  FIELD_CHOICE_DISMISS_LABEL,
  FIELD_CHOICE_HOST_ATTRIBUTE,
  FIELD_CHOICE_OPTION_ATTRIBUTE,
  FIELD_CHOICE_PREFERRED_SUFFIX,
} from "./content-script/affordance";
import { startInPageFill } from "./content-script/fill";
import { CREATE_MAILBOX_REQUEST, fillCodeRequest } from "./protocol";

const CODE = "493028";

/** Build an input and put it in the document. */
function field(attributes: Readonly<Record<string, string>>): HTMLInputElement {
  const element = document.createElement("input");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  document.body.append(element);
  return element;
}

/**
 * A field whose own state is kept outside it, the way a framework keeps it.
 *
 * **`input` is the only event that updates it**, which is the whole point: a value written without
 * announcing it leaves the state empty and the field submitting nothing. This is a stand-in for
 * React's controlled input rather than a claim about React — the browser tier drives the real thing
 * against React 19, and this file drives the same *shape* so every branch can be reached.
 */
function controlled(attributes: Readonly<Record<string, string>>): {
  readonly input: HTMLInputElement;
  readonly state: () => string;
} {
  const input = field(attributes);
  let held = "";
  input.addEventListener("input", () => {
    held = input.value;
  });
  return { input, state: () => held };
}

/** A window that is not its own top, which is the one shape a browser case cannot produce here. */
function framedWindow(): Window {
  return { top: {} } as unknown as Window;
}

/** Start a fill against this document, in the top-level window unless told otherwise. */
function start(overrides?: { readonly view?: Window | null }) {
  return startInPageFill({
    document,
    view: overrides === undefined ? window : (overrides.view ?? null),
  });
}

/** Every value on the page, by field, so a case can read what the page now holds. */
function values(...fields: readonly HTMLInputElement[]): readonly string[] {
  return fields.map((element) => element.value);
}

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("filling the one field that qualifies", () => {
  it("writes the code and says it did", async () => {
    const only = field({ autocomplete: "one-time-code" });

    await expect(start().handle(fillCodeRequest(CODE))).resolves.toEqual({ kind: "filled" });

    expect(only.value).toBe(CODE);
  });

  /**
   * **The renamed requirement's second caller, and the case that makes it one requirement.**
   *
   * `An inserted value becomes the value the page's own state holds` is now about a code as well as
   * an address, and this is the half that only a code can falsify: a page that reads its own state
   * back after the insertion must find the code, and a write that set the property without
   * announcing it would leave the field painted and the state empty.
   */
  it("reaches the page's own state, not only the field's value", async () => {
    const controlledCode = controlled({ autocomplete: "one-time-code" });

    await start().handle(fillCodeRequest(CODE));

    // **Both readings, because they are different failures.** A setter that failed would leave both
    // empty; an announcement that failed would leave the field painted and the state empty, which is
    // the failure `insert.ts` exists to prevent and the one this repository measured on React 19.
    expect(controlledCode.input.value).toBe(CODE);
    expect(controlledCode.state()).toBe(CODE);
  });

  it("announces the change as a person typing would", async () => {
    const only = field({ autocomplete: "one-time-code" });
    const seen: string[] = [];
    for (const type of ["input", "change"]) {
      only.addEventListener(type, () => {
        seen.push(type);
      });
    }

    await start().handle(fillCodeRequest(CODE));

    // **`input` then `change`, in that order** — a set comparison would pass on an implementation
    // that dispatched them the other way round, which is the order a form's dirty tracking reads.
    expect(seen).toEqual(["input", "change"]);
  });

  it("sends the code verbatim", async () => {
    const only = field({ autocomplete: "one-time-code" });

    await start().handle(fillCodeRequest("493028"));

    // **No trimming, no reformatting, no digits-only check.** The provider issued this string and
    // the page will submit it; a code altered in transit is a code the provider never issued.
    expect(only.value).toBe("493028");
  });
});

describe("the four refusals", () => {
  /**
   * **The emptiness check, and it is at the moment of filling rather than of recognition.**
   *
   * The field qualifies on its `autocomplete`, and the browser autofilled it afterwards. Writing
   * here would destroy what the person — or their password manager — put there, and no
   * confirmation stands between them and the loss.
   */
  it("inserts nothing into a field that already holds text, and says why", async () => {
    const filled = field({ autocomplete: "one-time-code" });
    filled.value = "already here";

    await expect(start().handle(fillCodeRequest(CODE))).resolves.toEqual({
      kind: "fieldHoldsText",
    });

    // **The page's state is asserted as well as the answer**, because the answer is a claim.
    expect(filled.value).toBe("already here");
  });

  /**
   * **Two fields qualify, one of them already holds text, and the empty one is filled unasked.**
   *
   * **The emptiness filter runs *before* the count, and this is the case that says so.** Asking a
   * person to choose between a field they have already filled and the only field they could mean is
   * asking a question with one answer — and the field they filled is precisely the evidence that the
   * other one is the one they want. The first version of this case asserted `asked`, and the run
   * said `filled`: the assertion contradicted the comment written beside it.
   */
  it("fills the only empty one of two, and leaves the filled one alone", async () => {
    const used = field({ name: "used_code" });
    used.value = "typed by hand";
    const free = field({ name: "otp" });

    await expect(start().handle(fillCodeRequest(CODE))).resolves.toEqual({ kind: "filled" });

    expect(values(used, free)).toEqual(["typed by hand", CODE]);
    // **And no control was drawn**, because a control offering a choice of one is a control that
    // cannot act on the answer.
    expect(document.querySelector(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`)).toBeNull();
  });

  it("reports no field when the page has none this extension will write into", async () => {
    const username = field({ name: "username" });
    const email = field({ type: "email", name: "email" });
    const discount = field({ name: "discount_code" });

    await expect(start().handle(fillCodeRequest(CODE))).resolves.toEqual({ kind: "noField" });

    expect(values(username, email, discount)).toEqual(["", "", ""]);
  });

  it("refuses a document that is not the top-level one", async () => {
    const framed = field({ autocomplete: "one-time-code" });

    await expect(start({ view: framedWindow() }).handle(fillCodeRequest(CODE))).resolves.toEqual({
      kind: "notTopFrame",
    });

    // **Nothing written, in a document that holds a perfectly good field.** The order is the point:
    // checking the fields first would make this answer depend on a coincidence in somebody else's
    // markup, and one page would then have two correct answers.
    expect(framed.value).toBe("");
  });

  it("refuses a document belonging to no window at all", async () => {
    const orphan = field({ autocomplete: "one-time-code" });

    await expect(start({ view: null }).handle(fillCodeRequest(CODE))).resolves.toEqual({
      kind: "notTopFrame",
    });

    expect(orphan.value).toBe("");
  });
});

describe("messages this context does not act on", () => {
  it("acts on nothing when the message is not a fill request", async () => {
    const only = field({ autocomplete: "one-time-code" });

    await expect(start().handle({ kind: "someone-else:something", code: "1" })).resolves.toEqual({
      kind: "notActedOn",
    });

    expect(only.value).toBe("");
  });

  /**
   * **The creation request travels over the same channel, and this is where the two kinds meet.**
   *
   * A handler that narrowed on the discriminant's *presence* rather than its value, or that acted
   * on anything carrying a payload, would put a mailbox request into a signup form's code field.
   */
  it("acts on nothing when handed a creation request", async () => {
    const only = field({ autocomplete: "one-time-code" });

    await expect(start().handle(CREATE_MAILBOX_REQUEST)).resolves.toEqual({ kind: "notActedOn" });

    expect(only.value).toBe("");
  });

  it("acts on nothing at all, for every unrecognised shape", async () => {
    const only = field({ autocomplete: "one-time-code" });

    for (const request of [undefined, null, "spectre:fill-code", 0, {}, [fillCodeRequest(CODE)]]) {
      await expect(start().handle(request)).resolves.toEqual({ kind: "notActedOn" });
    }

    expect(only.value).toBe("");
  });
});

describe("asking which field, when several qualify", () => {
  /** Two qualifying fields and the asking control the delivery produced. */
  async function askWithTwo(): Promise<{
    readonly first: HTMLInputElement;
    readonly second: HTMLInputElement;
    readonly host: HTMLElement;
  }> {
    const first = field({ name: "verification_code" });
    const second = field({ name: "otp" });
    await expect(start().handle(fillCodeRequest(CODE))).resolves.toEqual({ kind: "asked" });
    const host = document.querySelector(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`);
    if (host === null) {
      throw new Error("the asking control was not attached");
    }
    // **`host` is read through `shadowRoot` by every case above,** so the narrowing is here rather
    // than at each call site — and it is a narrowing rather than a cast, because `querySelector`
    // answers `Element` and the control's own interface says `HTMLElement`.
    return { first, second, host: host as HTMLElement };
  }

  it("fills nothing until the person chooses", async () => {
    const { first, second } = await askWithTwo();

    // **The claim, before any press.** A control that filled on arrival would be a control that
    // acted on somebody else's page while they were still reading their mail.
    expect(values(first, second)).toEqual(["", ""]);
  });

  it("puts the fields themselves to the person, each named by the page", async () => {
    const { host } = await askWithTwo();

    const options = Array.from(
      host.shadowRoot?.querySelectorAll(`[${FIELD_CHOICE_OPTION_ATTRIBUTE}]`) ?? [],
    ).map((element) => element.textContent);

    // **The page's own names, in the page's order.** A control offering "field 1" and "field 2" would
    // answer a question nobody asked, and a control offering a *count* would not answer it at all.
    expect(options).toEqual(["Fill in verification_code", "Fill in otp"]);
  });

  it("says which code it is asking about", async () => {
    const { host } = await askWithTwo();

    expect(host.shadowRoot?.textContent).toContain(`Put the code ${CODE}`);
  });

  it("marks the field the page declares, and not the one it only implies", async () => {
    const implied = field({ name: "verification_code" });
    const declared = field({ autocomplete: "one-time-code" });
    await start().handle(fillCodeRequest(CODE));

    const host = document.querySelector(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`);
    const options = Array.from(
      host?.shadowRoot?.querySelectorAll(`[${FIELD_CHOICE_OPTION_ATTRIBUTE}]`) ?? [],
    );

    // **The preference is stated, not applied.** A control that silently filled the declared field
    // would be acting unasked, and one that silently reordered the list would make the list's order
    // mean something other than what the person sees on the page.
    expect(options[0]?.textContent).toBe("Fill in verification_code");
    expect(options[1]?.textContent).toContain(FIELD_CHOICE_PREFERRED_SUFFIX);
    expect(values(implied, declared)).toEqual(["", ""]);
  });

  it("fills the chosen field and takes the control down", async () => {
    const { first, second, host } = await askWithTwo();

    const options = Array.from(
      host.shadowRoot?.querySelectorAll(`[${FIELD_CHOICE_OPTION_ATTRIBUTE}]`) ?? [],
    ) as HTMLButtonElement[];
    options[1]?.click();

    // **The chosen field and not the first one**, which is the whole question the control asks.
    expect(values(first, second)).toEqual(["", CODE]);
    // **And the control is gone**, so nothing outlives its answer.
    expect(host.isConnected).toBe(false);
  });

  it("gives a person a way to refuse, and fills nothing when they take it", async () => {
    const { first, second, host } = await askWithTwo();

    const dismiss = host.shadowRoot?.querySelector(`[${FIELD_CHOICE_DISMISS_ATTRIBUTE}]`);
    expect(dismiss?.textContent).toBe(FIELD_CHOICE_DISMISS_LABEL);
    (dismiss as HTMLButtonElement).click();

    expect(values(first, second)).toEqual(["", ""]);
    expect(host.isConnected).toBe(false);
  });

  it("keeps one control on the page however many codes are sent", async () => {
    // **One instance, and that is the point.** A second `start()` would be a second module instance
    // with its own `pending`, so the two controls it drew could not know about each other — the
    // requirement is about the page, and `entry.ts` starts exactly one of these per document. The
    // first version of this case started a second instance to send the second code and counted two
    // hosts, which is a true statement about the harness and a false one about the product.
    const fill = start();
    const first = field({ name: "verification_code" });
    field({ name: "otp" });

    await expect(fill.handle(fillCodeRequest(CODE))).resolves.toEqual({ kind: "asked" });
    const asked = document.querySelector(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`);

    await expect(fill.handle(fillCodeRequest("111111"))).resolves.toEqual({ kind: "asked" });

    // **A second question replaces the first rather than joining it.** Two controls offering two
    // codes on one page is a page where nothing is chosen.
    expect(document.querySelectorAll(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`)).toHaveLength(1);
    expect(asked?.isConnected).toBe(false);
    // **And the replacement carries the new code**, so the control on screen is not the stale one.
    expect(fill.pending()?.host.shadowRoot?.textContent).toContain("111111");
    expect(first.value).toBe("");
  });

  it("reports no control on the page once one has been answered", async () => {
    const fill = start();
    expect(fill.pending()).toBeNull();

    // **Two fields, so a control is actually drawn.** The first version of this case asserted the
    // control's presence after a delivery into an empty document, where there was nothing to ask
    // about and `pending` was null for the right reason.
    field({ name: "verification_code" });
    field({ name: "otp" });
    await expect(fill.handle(fillCodeRequest(CODE))).resolves.toEqual({ kind: "asked" });
    expect(fill.pending()).not.toBeNull();

    const dismiss = fill.pending()?.dismiss as HTMLButtonElement | undefined;
    dismiss?.click();

    // **The module's own reference cleared as well as the node**, so a later delivery cannot find a
    // control whose listeners are gone.
    expect(fill.pending()).toBeNull();
    expect(document.querySelector(`[${FIELD_CHOICE_HOST_ATTRIBUTE}]`)).toBeNull();
  });

  it("clears its own reference when a choice is taken, not only when one is refused", async () => {
    const fill = start();
    const first = field({ name: "verification_code" });
    const second = field({ name: "otp" });

    await fill.handle(fillCodeRequest(CODE));
    const options = Array.from(
      fill.pending()?.host.shadowRoot?.querySelectorAll(`[${FIELD_CHOICE_OPTION_ATTRIBUTE}]`) ?? [],
    ) as HTMLButtonElement[];
    options[1]?.click();

    expect(fill.pending()).toBeNull();
    expect(values(first, second)).toEqual(["", CODE]);
  });
});

describe("submitting nothing", () => {
  /**
   * **Every control this module puts on a page is `type="button"`, and every write is a value.**
   *
   * A control that submitted the form would be this product deciding a person's signup is complete.
   * So the form's own `submit` listener and the page's submit button's activation listener are both
   * installed here and neither is ever reached — which is a claim about the whole module, not about
   * one line.
   */
  it("sends no submit event and presses no control in the form", async () => {
    const form = document.createElement("form");
    document.body.append(form);
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    form.append(submitButton);

    const onSubmit = vi.fn();
    const onClick = vi.fn();
    form.addEventListener("submit", onSubmit);
    submitButton.addEventListener("click", onClick);

    const code = field({ autocomplete: "one-time-code" });
    form.append(code);

    await expect(start().handle(fillCodeRequest(CODE))).resolves.toEqual({ kind: "filled" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    // **And the code is there anyway**, so the absence of a submit is not the absence of a fill.
    expect(code.value).toBe(CODE);
  });

  it("submits nothing when the person is asked, and presses only what they pressed", async () => {
    const onSubmit = vi.fn();
    document.body.addEventListener("submit", onSubmit);

    // **The fields are here to be *not* filled:** this case presses the control the product draws,
    // not the one the module would draw for itself, so what it asserts is that pressing a choice
    // button submits nothing. Its own fields stay empty because these options choose nothing.
    field({ name: "verification_code" });
    field({ name: "otp" });
    const control = createFieldChoice({
      code: CODE,
      options: [
        { label: "one", preferred: false, choose: () => undefined },
        { label: "two", preferred: false, choose: () => undefined },
      ],
    });
    document.body.append(control.host);

    const options = Array.from(
      control.host.shadowRoot?.querySelectorAll(`[${FIELD_CHOICE_OPTION_ATTRIBUTE}]`) ?? [],
    ) as HTMLButtonElement[];

    // **The type is what the platform reads to decide whether a press submits**, so it is asserted
    // on every control this module draws rather than inferred from the absence of a submit.
    for (const button of [...options, control.dismiss]) {
      expect(button.type).toBe("button");
    }

    options[0]?.click();

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
