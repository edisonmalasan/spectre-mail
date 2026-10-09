/**
 * The request/answer contract both contexts read, and the narrowing the answer side depends on.
 *
 * ## Why this file exists at all, when both sides are this product's own code
 *
 * **Because "the other side" is not a fact about the code — it is a fact about the channel.**
 * `chrome.runtime.sendMessage` delivers whatever was put there, untyped, and the message bus is
 * shared with every extension the browser has: `onMessage` listeners on one worker receive messages
 * from sources this repository does not control. A type annotation on the *request* is therefore a
 * statement about a caller that does not exist yet, while the *answer* is the half that reaches
 * somebody's signup form.
 *
 * ## What these cases are for, stated as the failure they prevent
 *
 * **Every case below is a shape that would put an address into a form, or a claim onto a stranger's
 * page, that nothing observed.** `created` with no address is the shape a later edit would most
 * plausibly produce by making one field optional, and a narrowing that accepted it would type
 * `undefined` into a required field. `undefined` is the shape a closed worker answers with, and
 * treating it as anything but *no answer* is how "could not confirm" would turn into "failed".
 *
 * ## And the negative half, which is what makes the positive half mean anything
 *
 * **The last case is a control: a reader that matched nothing would answer `null` for every row
 * above and this file would be green.** It exists because this repository's most repeated defect is a
 * check narrower than its rule, and a narrowing function's failure mode is silence — an instrument
 * that answers "no answer" confidently and wrongly for every well-formed input is worse than one that
 * declines.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";

import {
  CREATE_MAILBOX_REQUEST,
  CREATE_MAILBOX_REQUEST_KIND,
  fillCodeRequest,
  FILL_CODE_REQUEST_KIND,
  isCreateMailboxRequest,
  isFillCodeRequest,
  readCreateMailboxAnswer,
  readFillCodeAnswer,
} from "./protocol";

describe("the request both contexts agree on", () => {
  it("is a single literal the sending side cannot spell differently", () => {
    // **The constant, and why the assertion is on the object rather than on a string.** Both sides
    // import this value; if one of them wrote the string itself, a rename would compile on that side
    // and fail here instead — which is the intended direction, because a request the worker does not
    // recognise is answered `notActedOn` and nothing else happens.
    expect(CREATE_MAILBOX_REQUEST).toEqual({ kind: "spectre:create-mailbox" });
    expect(CREATE_MAILBOX_REQUEST.kind).toBe(CREATE_MAILBOX_REQUEST_KIND);
  });

  it.each([
    ["the request this module exports", CREATE_MAILBOX_REQUEST, true],
    ["the same shape spelled by hand", { kind: "spectre:create-mailbox" }, true],
    // **A request carrying extra fields is still this request**, and that is deliberate: the channel
    // carries whatever a sender put there, so refusing a message because it said more than it had to
    // would make a future extension of the payload a breaking change in a place nobody would look.
    ["the same discriminant with more fields", { kind: "spectre:create-mailbox", page: 1 }, true],
    ["another extension's request", { kind: "someone-else:something" }, false],
    ["no discriminant at all", { page: 1 }, false],
    ["a string", "spectre:create-mailbox", false],
    ["nothing at all", undefined, false],
    ["null", null, false],
  ])("is recognised in %s: %s", (_label, value, expected) => {
    expect(isCreateMailboxRequest(value)).toBe(expected);
  });
});

describe("narrowing an answer", () => {
  it("admits every variant this product writes", () => {
    expect(
      readCreateMailboxAnswer({
        kind: "created",
        address: "made@address.test",
        mailboxId: "made-at-provider",
      }),
    ).toEqual({
      kind: "created",
      address: "made@address.test",
      mailboxId: "made-at-provider",
    });
    expect(readCreateMailboxAnswer({ kind: "refused", description: "429" })).toEqual({
      kind: "refused",
      description: "429",
    });
    expect(readCreateMailboxAnswer({ kind: "notStored" })).toEqual({ kind: "notStored" });
    expect(readCreateMailboxAnswer({ kind: "notActedOn" })).toEqual({ kind: "notActedOn" });
  });

  it.each([
    ["a created answer with no address", { kind: "created" }],
    [
      "a created answer whose address is not a string",
      { kind: "created", address: 7, mailboxId: "m" },
    ],
    // **An empty address, and the reason it is refused rather than admitted.** A `""` would satisfy
    // every other check on the variant, be typed as a `string`, and be written into somebody's form
    // as an empty value that looked filled. There is no provider that answers creation with one.
    ["a created answer with an empty address", { kind: "created", address: "", mailboxId: "m" }],
    // **An address and no id, and it is refused rather than admitted with a blank id.** The page
    // records which mailbox a host was last used with, and an answer it cannot key that record by is
    // an address it can insert but never remember — the one shape the caller has no honest report
    // for, so it becomes "no answer" and the page says it could not confirm.
    ["a created answer with no mailbox id", { kind: "created", address: "made@address.test" }],
    ["a created answer whose id is not a string", { kind: "created", address: "m", mailboxId: 7 }],
    ["a created answer with an empty id", { kind: "created", address: "m", mailboxId: "" }],
    ["a refusal with no description", { kind: "refused" }],
    ["a refusal whose description is not a string", { kind: "refused", description: {} }],
    ["a refusal with an empty description", { kind: "refused", description: "" }],
    // **A variant nobody writes.** The union is closed on purpose, so this is the shape a future
    // edit to the worker's answer would produce on one side only.
    ["a variant this product does not write", { kind: "somethingElse" }],
    ["an answer with no discriminant", { address: "made@address.test" }],
    ["a bare string", "created"],
    ["undefined", undefined],
    ["null", null],
    ["a number", 0],
    ["a string carrying JSON", '{"kind":"created","address":"made@address.test"}'],
  ])("reports no answer for %s", (_label, value) => {
    // **`null`, and not a throw.** A reply nobody recognised is not a *worse* answer, it is no
    // answer — and "no answer" is already a named state the page reports without claiming anything
    // happened. Throwing here would raise inside a document keypress handler on a page this product
    // does not own, which is the one place in this product where an uncaught error is cheapest to
    // avoid and most expensive to cause.
    expect(readCreateMailboxAnswer(value)).toBeNull();
  });

  it("reads its fields off the discriminant it matched, not off a prototype", () => {
    // **`Object.create` with a matching prototype, so a property *is* reachable and yet no own
    // field was sent.** `Reflect.get` walks the prototype chain, so this is the honest statement of
    // what the narrowing does: it reads what the value can produce. A reply this product never sends
    // is not a shape worth refusing more strictly, and a stricter reader would have needed a
    // `hasOwn` check whose only effect would be to refuse a `structuredClone`d answer — which
    // arrives with own fields anyway, so the check would guard nothing reachable.
    const inherited = Object.create({
      kind: "created",
      address: "inherited@address.test",
      mailboxId: "inherited-id",
    }) as object;

    expect(readCreateMailboxAnswer(inherited)).toEqual({
      kind: "created",
      address: "inherited@address.test",
      mailboxId: "inherited-id",
    });
  });

  it("answers `created` for an answer the worker would never send but a page cannot invent", () => {
    // **The control for the whole table above, and it is deliberately the permissive direction.**
    // Two narrowing functions that both answered `null` for every input would pass every row of
    // those tables. This one has to answer `null` *only* for what it refuses — so the rows that
    // assert a refusal are paired with rows asserting an admission of the same variant, and a
    // reader that refused everything fails these.
    const admitted = readCreateMailboxAnswer({
      kind: "created",
      address: "made@address.test",
      mailboxId: "made-at-provider",
      extra: "a field the union does not declare",
    });

    expect(admitted).toEqual({
      kind: "created",
      address: "made@address.test",
      mailboxId: "made-at-provider",
    });
  });
});

/**
 * ## The fill pair, and why it is a separate pair rather than a second answer variant
 *
 * **It travels in the opposite direction and answers different questions.** Creation asks the
 * worker for something and the answer carries a provider's words; a fill asks a page to do
 * something and every answer is a fact about somebody else's document. Folding them into one union
 * would produce a type every member of which a context could read but none of which it could mean.
 */
describe("the fill request the popup and a content script agree on", () => {
  it("is built by a function, because this request carries a payload and a constant cannot", () => {
    // **The contrast with `CREATE_MAILBOX_REQUEST` is the assertion.** That one is a constant
    // because its payload is empty; a constant here would be a request with no code in it, and the
    // reader below would refuse it — which is the correct behaviour for the wrong reason.
    expect(fillCodeRequest("493028")).toEqual({
      kind: "spectre:fill-code",
      code: "493028",
    });
    expect(fillCodeRequest("493028").kind).toBe(FILL_CODE_REQUEST_KIND);
  });

  it("sends the code verbatim, so a shortened or trimmed code cannot be delivered", () => {
    // **The provider issued this string**, and a code this product altered is not the code the
    // provider issued. Trimming is the change a future "tidier" edit would most plausibly make,
    // and it is the one that would be invisible.
    expect(fillCodeRequest("  493028\n").code).toBe("  493028\n");
  });

  it.each([
    ["the request this module builds", fillCodeRequest("493028"), true],
    ["the same shape spelled by hand", { kind: "spectre:fill-code", code: "493028" }, true],
    [
      "a request carrying more than it needs",
      { kind: "spectre:fill-code", code: "1", tab: 4 },
      true,
    ],
    // **The three refusals that matter, and each is a shape a plausible edit produces.** Making
    // `code` optional is the first; a page's own script reaching the message channel and sending
    // the discriminant alone is the second; an empty string is the third, because it satisfies a
    // length check nowhere and would be inserted as a value that looks filled and submits empty.
    ["a request with no code", { kind: "spectre:fill-code" }, false],
    ["a request whose code is not a string", { kind: "spectre:fill-code", code: 493028 }, false],
    ["a request whose code is empty", { kind: "spectre:fill-code", code: "" }, false],
    // **The creation request, unchanged.** Two kinds on one channel is exactly the arrangement
    // `design.md` D4 chose, and the content script sees both; a reader that admitted either kind
    // for the other would insert an address where a code was asked for.
    ["the creation request", CREATE_MAILBOX_REQUEST, false],
    ["another extension's request", { kind: "someone-else:something", code: "1" }, false],
    ["a bare string", "spectre:fill-code", false],
    ["nothing at all", undefined, false],
    ["null", null, false],
  ])("is recognised in %s: %s", (_label, value, expected) => {
    expect(isFillCodeRequest(value)).toBe(expected);
  });
});

describe("narrowing what a page answered about a code", () => {
  it("admits every variant a content script writes, on their discriminants alone", () => {
    for (const kind of [
      "filled",
      "asked",
      "noField",
      "fieldHoldsText",
      "notTopFrame",
      "notActedOn",
    ] as const) {
      expect(readFillCodeAnswer({ kind })).toEqual({ kind });
    }
  });

  /**
   * The control for the table above, in the **permissive** direction.
   *
   * A narrower that answered `null` for everything would pass every refusal row below and this
   * file would be green — which is the recorded failure of a narrowing function, whose failure
   * mode is silence. So an answer carrying a field the union does not declare is still admitted,
   * and a refused shape has to be refused for its own reason.
   */
  it("admits a well-formed answer that carries more than the union declares", () => {
    expect(readFillCodeAnswer({ kind: "filled", field: "code", tab: 9 })).toEqual({
      kind: "filled",
    });
  });

  it.each([
    // **A variant nobody writes.** The union is closed on purpose, and a content script in a later
    // milestone answering with a kind the popup has no copy for is the shape that would otherwise
    // reach a person as a blank line.
    ["a variant this product does not write", { kind: "filledTwice" }],
    // **The creation answer, unchanged** — a content script that answered the creation question
    // would be read as a delivery that did something.
    ["a creation answer", { kind: "created", address: "a@b.test", mailboxId: "m" }],
    ["an answer with no discriminant", { filled: true }],
    ["a bare string", "filled"],
    ["undefined", undefined],
    ["null", null],
    ["a number", 0],
    ["a boolean", true],
    ["an array carrying a discriminant", [{ kind: "filled" }]],
  ])("reports no answer for %s", (_label, value) => {
    expect(readFillCodeAnswer(value)).toBeNull();
  });
});
