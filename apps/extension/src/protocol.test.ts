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

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { GuerrillaCredentials, MailTmCredentials } from "@spectre-mail/core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  CREATE_MAILBOX_REQUEST,
  CREATE_MAILBOX_REQUEST_KIND,
  fillCodeRequest,
  FILL_CODE_REQUEST_KIND,
  HOST_CONTEXT_REQUEST,
  HOST_CONTEXT_REQUEST_KIND,
  hostContextAnswer,
  isCreateMailboxRequest,
  isFillCodeRequest,
  isHostContextRequest,
  isReconcileAlarmRequest,
  readCreateMailboxAnswer,
  readFillCodeAnswer,
  readHostContextAnswer,
  RECONCILE_ALARM_REQUEST,
  RECONCILE_ALARM_REQUEST_KIND,
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

/**
 * The request the popup sends when it wants the worker to reconcile its own storage.
 *
 * **This block is here because the count said it was missing.** `protocol.test.ts` held **52** cases
 * before and after the notification slice added a third message kind — and the arithmetic gave the
 * reason away: `protocol.ts` gained `RECONCILE_ALARM_REQUEST`, `RECONCILE_ALARM_REQUEST_KIND` and
 * `isReconcileAlarmRequest`, and none of the three was read by a case. **Every other kind in this
 * file has its own narrowing table**, so the omission was not a decision — and a **moved count could
 * not have reported it**, because a count says how many and not which.
 *
 * **Why this guard earns the same table as the other two.** It is the one that decides whether the
 * worker reconciles on a message the channel delivered, and the channel is shared with every
 * extension the browser has. A guard returning `true` for any object would let an unrelated
 * extension's message arm this one's alarm.
 */
describe("the request the popup sends to have the worker reconcile its own storage", () => {
  it("is a payload-free literal, so nothing can ride on it by accident", () => {
    // **`toEqual` against an object with no fields, rather than `toMatchObject`.** A wake
    // reconciles *this device's* stored mailbox and is told nothing about which; a payload here
    // would be a mailbox id travelling from the popup into the worker, and this assertion is the
    // one that says it cannot.
    expect(RECONCILE_ALARM_REQUEST).toEqual({ kind: "spectre:reconcile-alarm" });
    expect(RECONCILE_ALARM_REQUEST.kind).toBe(RECONCILE_ALARM_REQUEST_KIND);
    expect(Object.keys(RECONCILE_ALARM_REQUEST)).toEqual(["kind"]);
  });

  it.each([
    ["the request this module exports", RECONCILE_ALARM_REQUEST, true],
    ["the same shape spelled by hand", { kind: "spectre:reconcile-alarm" }, true],
    // **Extra fields are still this request**, for the reason the create case above gives — and here
    // it is more than a convention, because the worker's own answer reads no field but `kind`.
    [
      "the same discriminant carrying more fields",
      { kind: "spectre:reconcile-alarm", page: 1 },
      true,
    ],
    ["the create request, which is a different kind", CREATE_MAILBOX_REQUEST, false],
    ["the fill request, which is a different kind", { kind: FILL_CODE_REQUEST_KIND }, false],
    ["another extension's request", { kind: "someone-else:something" }, false],
    ["no discriminant at all", { page: 1 }, false],
    ["a string", "spectre:reconcile-alarm", false],
    ["nothing at all", undefined, false],
    ["null", null, false],
  ])("is recognised in %s: %s", (_label, value, expected) => {
    expect(isReconcileAlarmRequest(value)).toBe(expected);
  });

  it("names a kind no other request in this module names", () => {
    // **The negative half, and the reason the table above can be read at all.** A guard matching
    // nothing would answer `false` for every row and this file would be green — so the positive
    // rows are pinned to the constant the *sending* side imports, and this pins that constant to a
    // string neither side may spell differently, and to a value none of its siblings already holds.
    //
    // **`toBe(true)` on a `every` over four kinds reads as a strange assertion**, so the reason is
    // written here: two kinds sharing a string would make both guards accept each other's messages,
    // and a third arm of the worker's own dispatch would become reachable from the wrong request.
    expect(RECONCILE_ALARM_REQUEST_KIND).toBe("spectre:reconcile-alarm");
    const kinds = [
      CREATE_MAILBOX_REQUEST_KIND,
      RECONCILE_ALARM_REQUEST_KIND,
      FILL_CODE_REQUEST_KIND,
      // **The fourth kind, and this list is the instrument that keeps all four disjoint.** It was
      // three for four milestones, and adding a kind without adding it here would leave the property
      // it exists for — that no two guards accept each other's messages — asserted over three of
      // four kinds, which is the shape of a check that reads as general and is not.
      HOST_CONTEXT_REQUEST_KIND,
    ];
    expect(kinds).toHaveLength(4);
    expect(new Set(kinds).size).toBe(4);
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

/**
 * The host request and its answer — the pair `design.md` D4 built the free route out of.
 *
 * **Every case in this block is written against a property rather than against a spelling**, because
 * the two failures this milestone must never produce are both invisible in a diff: naming a host
 * nobody read, and naming a host that is not a hostname.
 */
describe("the host request the panel sends to the page beside it", () => {
  it("is a payload-free literal, so nothing can ride on it by accident", () => {
    // **The keys are read rather than the string.** A request carrying a tab id or a URL would make
    // this test the place a second copy of a resolved fact is checked — and a request whose payload
    // disagreed with the tab the caller actually asked would report the wrong page's host.
    expect(HOST_CONTEXT_REQUEST).toEqual({ kind: "spectre:host-context" });
    expect(HOST_CONTEXT_REQUEST.kind).toBe(HOST_CONTEXT_REQUEST_KIND);
    expect(Object.keys(HOST_CONTEXT_REQUEST)).toEqual(["kind"]);
  });

  it.each([
    ["the request this module exports", HOST_CONTEXT_REQUEST, true],
    ["the same shape spelled by hand", { kind: "spectre:host-context" }, true],
    ["the same discriminant carrying more fields", { kind: "spectre:host-context", tab: 9 }, true],
    ["the create request", CREATE_MAILBOX_REQUEST, false],
    ["the reconcile request", RECONCILE_ALARM_REQUEST, false],
    ["the fill request", { kind: FILL_CODE_REQUEST_KIND }, false],
    ["a fill request carrying a code", fillCodeRequest("493028"), false],
    ["another extension's request", { kind: "someone-else:something" }, false],
    ["no discriminant at all", { tab: 9 }, false],
    ["a string", "spectre:host-context", false],
    ["nothing at all", undefined, false],
    ["null", null, false],
  ])("is recognised in %s: %s", (_label, value, expected) => {
    expect(isHostContextRequest(value)).toBe(expected);
  });

  /**
   * The cross-guard table, and the reason it exists rather than three assertions that already pass.
   *
   * **Each guard already has a table above, and those tables are not enough.** Every one of them
   * feeds values to the guard it is about, so a guard widened to admit any value carrying a
   * discriminant would pass all three — while the content script answered a fill request with a
   * hostname and a creation request with a hostname. **This table drives every guard over every
   * kind**, so the property asserted is the one that actually matters: *no two guards accept each
   * other's messages.*
   *
   * **And it needs no table of expected answers**, because the expectation is derived from the
   * value's own discriminant — so a guard and this table cannot both be wrong in a way that agrees.
   */
  it.each([
    ["create", isCreateMailboxRequest, CREATE_MAILBOX_REQUEST_KIND],
    ["reconcile", isReconcileAlarmRequest, RECONCILE_ALARM_REQUEST_KIND],
    ["fill", isFillCodeRequest, FILL_CODE_REQUEST_KIND],
    ["host", isHostContextRequest, HOST_CONTEXT_REQUEST_KIND],
  ] as const)("the %s guard admits only its own kind", (_name, guard, ownKind) => {
    for (const value of [
      HOST_CONTEXT_REQUEST,
      CREATE_MAILBOX_REQUEST,
      RECONCILE_ALARM_REQUEST,
      fillCodeRequest("493028"),
      { kind: "someone-else:something" },
    ] as const) {
      const kindOf = (value as { readonly kind: string }).kind;
      expect(`${ownKind} admits ${kindOf}: ${guard(value)}`).toBe(
        `${ownKind} admits ${kindOf}: ${kindOf === ownKind}`,
      );
    }
  });
});

describe("the answer this extension's own script gives about the page it is beside", () => {
  it.each([
    [
      "a hostname the browser produced",
      "signup.example.test",
      { kind: "host", host: "signup.example.test" },
    ],
    // **The whole point of this case, and the reason the answer is built by a function.** A `document
    // with no host` — `about:blank`, a `file://` page — gives an empty `location.hostname`, and an
    // answer carrying `""` would be a panel that had named a page and had nothing to show for it.
    ["an empty hostname", "", { kind: "unconfirmed" }],
    ["nothing at all", undefined, { kind: "unconfirmed" }],
    ["null", null, { kind: "unconfirmed" }],
    ["a non-string", 42, { kind: "unconfirmed" }],
  ])("answers %s", (_label, host, expected) => {
    expect(hostContextAnswer(host)).toEqual(expected);
  });

  it("admits every variant the script writes", () => {
    expect(readHostContextAnswer({ kind: "host", host: "signup.example.test" })).toEqual({
      kind: "host",
      host: "signup.example.test",
    });
    expect(readHostContextAnswer({ kind: "unconfirmed" })).toEqual({ kind: "unconfirmed" });
  });

  /**
   * The permissive control, for the reason the fill narrower's carries: **a narrower answering
   * `null` for everything would pass every refusal row below** and this file would be green.
   */
  it("admits a well-formed answer carrying more than the union declares", () => {
    expect(readHostContextAnswer({ kind: "host", host: "a.example.test", tab: 9 })).toEqual({
      kind: "host",
      host: "a.example.test",
    });
  });

  it("hands back a hostname verbatim, so no folding, trimming or lowercasing is applied", () => {
    // **The exact string, and why a normalising narrower would be a defect.** `site-associations`
    // keys its map by the exact hostname with no registrable-domain folding, so `a.example.com` and
    // `b.example.com` stay apart — and a reader that lower-cased or trimmed would report a host the
    // association map has no record of, which is the "no mailbox was last used here" branch of a
    // host that *was*.
    const host = "Signup.Example.TEST";
    expect(readHostContextAnswer(hostContextAnswer(host))).toEqual({ kind: "host", host });
  });

  it.each([
    // **The one this milestone must never produce: an answer claiming a host it did not read.**
    ["a host answer with no host", { kind: "host" }],
    ["a host answer with an empty host", { kind: "host", host: "" }],
    ["a host answer whose host is not a string", { kind: "host", host: 42 }],
    ["a fill answer", { kind: "filled" }],
    ["a creation answer", { kind: "created", address: "a@b.test", mailboxId: "m" }],
    ["an answer with no discriminant", { host: "a.example.test" }],
    ["a bare string", "host"],
    ["undefined — which is what a page with no script of this extension's produces", undefined],
    ["null", null],
    ["a number", 0],
    ["a boolean", true],
    ["an array carrying a discriminant", [{ kind: "host", host: "a" }]],
  ])("reports no answer for %s", (_label, value) => {
    expect(readHostContextAnswer(value)).toBeNull();
  });
});

/* ------------------------------------------------------------------------------------------------
 * Where a provider credential may travel.
 *
 * ## Why this block is here, and what it is not
 *
 * `provider-abstraction` now requires that a provider credential reach **exactly two places**: the
 * transport request of the provider that issued it, and the storage record of the mailbox it belongs
 * to. It says so because that boundary **was already correct and was carried by a comment** - the
 * comment above `CreateMailboxAnswer` explaining why a creation answer carries an address and an id
 * rather than the whole mailbox. A comment does not fail a gate and does not survive an editing of
 * the type it explains, so this block turns it into a property.
 *
 * **It is a test-owned map and not a scan**, per `design.md` D1, and the reason is this file's own:
 * a scan of `apps/extension/src` for `credentials` fires on **this file's own forbidden-field
 * list**, which is the fourth recorded instance of that shape. A boundary rule was rejected for a
 * second reason - the property is not structural. It is about what a *value* may contain as it
 * crosses a message boundary, and a rule can only see which module may import which.
 *
 * ## The three directions, and the order they run in
 *
 * **The positive control is the first case.** A detector that returns nothing satisfies every
 * absence claimed below it, so the first case hands it an object carrying a credential field and
 * requires the name back (`design.md` D2, task 2.3). The order is the instrument.
 *
 * **Forward** - every kind's own well-formed value, narrowed through the reader that decides it,
 * carries no credential field. **The narrowing must return something**, because a reader answering
 * `null` for everything would pass the forward direction while reading nothing.
 *
 * **Reverse** - no type this module exports declares a member named for a credential. This is the
 * direction the forward direction cannot reach: a reader is a *parser*, and a field it does not
 * return is invisible to it. **An assertion aimed at a reader cannot see what the reader skips.**
 *
 * **And enumerability, in both directions and at both levels.** Every exported type name is
 * compared with this map's type names, and every variant a union declares is compared with the
 * values the map carries for it. A type or a kind added without a row therefore **fails** rather
 * than being skipped - which is the direction `design.md`'s risk section says this design had to get
 * right.
 *
 * ## The field names come from `packages/core`, twice, and the two must agree
 *
 * `design.md` D3 rejects a retyped list, and this repository has recorded that shape three times -
 * most sharply when the adapter-identifier rule listed three exports **that did not exist** and so
 * guarded nothing while the suite stayed green. So the names are read from
 * `packages/core/src/credentials.ts` through the TypeScript parser, **and** written out as literals
 * that `satisfies` the real types, **and the two are required to agree in both directions**.
 *
 * The second route earns its place on its own: `satisfies` fails to compile on a field added to a
 * variant and on a field the variant does not declare, and **this file is inside
 * `apps/extension/tsconfig.json`, so that is a `pnpm typecheck` failure rather than a note.** The
 * first route is what brings a new name into the obligation at runtime. Neither alone would do both.
 *
 * **What is excluded, and why it is derived rather than declared.** `provider` is a member of both
 * variants and is not a secret - it is the discriminant `credentialsProvider()` exists to read. The
 * rule is therefore *"declared by exactly one variant"*, computed from the same parse, rather than
 * a hardcoded exemption list that a third variant would silently outgrow.
 *
 * ## What this block does not establish
 *
 * It does not establish anything about a **notification**, a **rendered string** or a **built URL**:
 * those are three of the requirement's five destinations and none of them is a protocol type, so
 * what holds them is `MessageSummary`'s own shape and the requirements that already name them. It
 * establishes nothing about what is **stored** either - `packages/storage` is untouched by this
 * change and its tests are unmoved, which is the measurement rather than a promise.
 * ---------------------------------------------------------------------------------------------- */

/** The repository root, resolved the way `boundaries.test.ts` resolves it. */
const REPO_ROOT = process.cwd();

/** The module whose protocol this block reads, and the credential declarations it reads them beside. */
const PROTOCOL_SOURCE_PATH = "apps/extension/src/protocol.ts";
const CREDENTIALS_SOURCE_PATH = "packages/core/src/credentials.ts";

/**
 * How deep {@link credentialFieldsIn} walks a value before it stops.
 *
 * **A bound rather than a proof, and it exists for cycles.** A value that contains itself would
 * otherwise recurse for ever, so the walk is depth-limited; every value this map carries is two
 * levels deep at most, so the limit is not what holds the result below.
 */
const CREDENTIAL_SCAN_DEPTH = 8;

/** One protocol type, the reader that decides it, and one well-formed value per variant it declares. */
interface ProtocolEntry {
  /** The type exactly as `protocol.ts` declares it. Compared with the parsed export list. */
  readonly type: string;
  /** The reader that decides whether a value on the message channel is one of these. */
  readonly reader: (value: unknown) => unknown;
  /** One well-formed value per variant, written out rather than built from the type under test. */
  readonly values: readonly unknown[];
}

/** What a parsed type declaration admits. Read from the AST rather than guessed from its name. */
interface DeclaredShape {
  /** Every property signature the declaration names, across all of its variants. */
  readonly members: readonly string[];
  /** The `kind` literal of each variant. Empty for an interface, whose discriminant is a constant. */
  readonly kindLiterals: readonly string[];
  /** How many shapes it admits: `1` for an interface, one per union member for a union. */
  readonly variants: number;
}

/**
 * Every **exported** type declaration in a source file, as a shape per type name.
 *
 * **The TypeScript parser rather than a pattern, and the reason is the one defect this repository
 * pays for most often.** A declaration read by regular expression cannot tell a comment from a
 * declaration, and cannot tell an interface from a union without reading the body - which is the
 * difference between *"one shape"* and *"four shapes"*, and the difference between an enumerability
 * check that holds and one that holds over a third of the types. `boundaries.test.ts` already reads
 * declarations this way for the same reason, and `typescript` is a workspace dev dependency because
 * `pnpm typecheck` cannot run without it.
 */
function declaredShapesIn(source: string): Map<string, DeclaredShape> {
  const file = ts.createSourceFile("read.ts", source, ts.ScriptTarget.Latest, true);
  const shapes = new Map<string, DeclaredShape>();

  // **`canHaveModifiers` first, and it is a narrowing rather than a courtesy.** `Node` does not
  // carry a `modifiers` property; only the declaration kinds that can, and the API that reads it
  // requires the question to have been answered. Written the other way round the property is a cast.
  const isExported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

  /** The property names a type literal declares. */
  const memberNames = (members: readonly ts.TypeElement[]): string[] =>
    members.flatMap((member) =>
      ts.isPropertySignature(member) && ts.isIdentifier(member.name) ? [member.name.text] : [],
    );

  for (const statement of file.statements) {
    if (!isExported(statement)) {
      continue;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      shapes.set(statement.name.text, {
        members: memberNames(statement.members),
        kindLiterals: [],
        variants: 1,
      });
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      // **A union is enumerated; anything else is admitted as a shape with no variants.** Nothing this
      // module exports is an alias of a non-union today, so this arm has no case of its own - and it
      // is written to report `0` rather than to guess, so an alias added later is a row this block
      // would have to be taught about rather than one it silently accepts.
      const variants = ts.isUnionTypeNode(statement.type)
        ? statement.type.types.filter(ts.isTypeLiteralNode)
        : [];

      shapes.set(statement.name.text, {
        members: variants.flatMap((variant) => memberNames(variant.members)),
        kindLiterals: variants.flatMap((variant) =>
          variant.members.flatMap((member) => {
            if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) {
              return [];
            }
            if (member.name.text !== "kind" || !member.type || !ts.isLiteralTypeNode(member.type)) {
              return [];
            }
            const literal = member.type.literal;
            return ts.isStringLiteral(literal) ? [literal.text] : [];
          }),
        ),
        variants: variants.length,
      });
    }
  }

  return shapes;
}

/**
 * The credential variants, read from `packages/core`, as one member set per variant.
 *
 * **Only declarations that declare a member of their own, and that filter is the first defect this
 * block's own first run found.** `credentials.ts` exports three type declarations and not two:
 * `ProviderCredentials` is the *union* of the other two, so it declares no member and — read as a
 * variant — contributes an **empty** field set. Every question of the form "declared by every
 * variant" is then false for every field, so the shared-discriminant rule below excluded nothing and
 * `provider` was classified as a credential field.
 *
 * **It is recorded because the failure was quiet in the worst direction.** `CREDENTIAL_FIELDS` came
 * out *correct* anyway — an empty set adds no counts — so the only symptom was in the second
 * constant, one case away. **A wrong answer reached through an omission looks exactly like a wrong
 * answer reached through a value**, and the case that named it was the one asserting the omission
 * list was non-empty. The filter is therefore stated as a property ("declares members of its own")
 * rather than as a skip list, so a variant that is an alias rather than an interface is still read.
 */
function credentialVariantFields(): Map<string, ReadonlySet<string>> {
  const shapes = declaredShapesIn(readFileSync(join(REPO_ROOT, CREDENTIALS_SOURCE_PATH), "utf8"));
  return new Map(
    [...shapes]
      .filter(([, shape]) => shape.members.length > 0)
      .map(([type, shape]) => [type, new Set(shape.members)]),
  );
}

/**
 * The field names that hold a credential, **derived rather than declared**.
 *
 * The rule is *"declared by exactly one variant"*, so `provider` - which both variants declare, and
 * which `credentialsProvider()` exists to read - is not a credential field while `accountId`,
 * `accessToken` and `sessionId` are. **A hardcoded exemption list would be the opposite of D3**: it
 * is a list somebody has to update when a third variant arrives, and a list that is not updated is
 * a list that names a field as safe.
 */
const CREDENTIAL_FIELDS: ReadonlySet<string> = (() => {
  const variants = [...credentialVariantFields().values()];
  const counts = new Map<string, number>();
  for (const fields of variants) {
    for (const field of fields) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, count]) => count === 1).map(([field]) => field));
})();

/**
 * The same names written out as literals, for the compiler to hold rather than the parser.
 *
 * **`satisfies` is what makes this route earn its place.** A field added to a variant fails to
 * compile here (the literal is no longer assignable), and a field the variant does not declare fails
 * too (excess property checking). **`Object.keys` reads them back at runtime**, so the two routes are
 * compared over real strings rather than one over a parse and one over a type the compiler erased.
 */
const CREDENTIAL_FIELDS_AS_LITERALS: readonly string[] = [
  ...Object.keys({
    provider: "mailtm",
    accountId: "",
    accessToken: "",
  } satisfies MailTmCredentials),
  ...Object.keys({ provider: "guerrilla", sessionId: "" } satisfies GuerrillaCredentials),
];

/** The member names every credential variant declares, which the discriminant rule above excludes. */
const SHARED_CREDENTIAL_FIELDS: ReadonlySet<string> = (() => {
  const variants = [...credentialVariantFields().values()];
  return new Set([...(variants[0] ?? [])].filter((field) => variants.every((v) => v.has(field))));
})();

/**
 * Every credential field name reachable from `value`, at any depth.
 *
 * **Own enumerable properties, walked rather than read at the top level**, because the requirement is
 * about a value that *carries* a credential: one nested inside an object is carried just as surely
 * as one beside it. The sort makes the failure message stable, which matters because this function's
 * result is compared with `toEqual` in a direction where order noise would read as a defect.
 */
function credentialFieldsIn(value: unknown): string[] {
  const found = new Set<string>();

  const walk = (candidate: unknown, depth: number): void => {
    if (depth >= CREDENTIAL_SCAN_DEPTH || typeof candidate !== "object" || candidate === null) {
      return;
    }
    for (const key of Object.keys(candidate)) {
      if (CREDENTIAL_FIELDS.has(key)) {
        found.add(key);
      }
      walk((candidate as Record<string, unknown>)[key], depth + 1);
    }
  };

  walk(value, 0);
  return [...found].sort();
}

/** The `kind` a value carries, read without narrowing it. */
function discriminantOf(value: unknown): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, "kind") : undefined;
}

/**
 * Every protocol type this extension sends or receives, the reader that decides each, and one
 * well-formed value per variant.
 *
 * **Seven types, and the count is the reverse direction's job rather than this comment's.** Nothing
 * here is a hardcoded subset of the module: the case below compares this list with what
 * `protocol.ts` actually exports, in both directions, so a type added without a row fails.
 *
 * **The values are written out rather than built from the types they stand for**, per the decision
 * recorded at `Panel.test.tsx:862`: an assertion built from the constant under test moves with it.
 * A value assembled as `{ kind: "created", ... } satisfies CreateMailboxAnswer` would compile for as
 * long as the variant exists and would stop saying anything the day a field was added - which is
 * exactly the day the assertion matters.
 */
const CREDENTIAL_BOUNDARY: readonly ProtocolEntry[] = [
  {
    type: "CreateMailboxRequest",
    reader: isCreateMailboxRequest,
    values: [CREATE_MAILBOX_REQUEST],
  },
  {
    type: "ReconcileAlarmRequest",
    reader: isReconcileAlarmRequest,
    values: [RECONCILE_ALARM_REQUEST],
  },
  {
    type: "FillCodeRequest",
    reader: isFillCodeRequest,
    values: [fillCodeRequest("493028")],
  },
  {
    type: "HostContextRequest",
    reader: isHostContextRequest,
    values: [HOST_CONTEXT_REQUEST],
  },
  {
    type: "CreateMailboxAnswer",
    reader: readCreateMailboxAnswer,
    values: [
      { kind: "created", address: "made@address.test", mailboxId: "made-at-provider" },
      { kind: "refused", description: "429" },
      { kind: "notStored" },
      { kind: "notActedOn" },
    ],
  },
  {
    type: "FillCodeAnswer",
    reader: readFillCodeAnswer,
    values: [
      { kind: "filled" },
      { kind: "asked" },
      { kind: "noField" },
      { kind: "fieldHoldsText" },
      { kind: "notTopFrame" },
      { kind: "notActedOn" },
    ],
  },
  {
    type: "HostContextAnswer",
    reader: readHostContextAnswer,
    values: [{ kind: "host", host: "signup.example.test" }, { kind: "unconfirmed" }],
  },
];

/** The protocol type names this map declares, as a set. */
function mappedTypeNames(): Set<string> {
  return new Set(CREDENTIAL_BOUNDARY.map((entry) => entry.type));
}

/** The protocol type names `protocol.ts` actually exports, as a set. */
function exportedTypeNames(): Set<string> {
  return new Set(
    declaredShapesIn(readFileSync(join(REPO_ROOT, PROTOCOL_SOURCE_PATH), "utf8")).keys(),
  );
}

describe("where a provider credential may travel", () => {
  it("reports a credential field when it is handed one, before any absence is claimed", () => {
    // **The first case in the block, and its position is the instrument rather than the formatting.**
    // Every case below this one asserts that a credential field is *absent*, and a detector that
    // returned nothing at all would satisfy all of them. So it is shown a field first, and the
    // planted values are read through the same function the absence cases call.
    //
    // **Three shapes, because "a field somewhere" and "a field at the top level" are different
    // abilities.** A top-level field is what a reader that looked at `Object.keys(value)` and stopped
    // would see; a nested one is what a reader that never walked would miss; and the planted value
    // carrying *two* credential fields is what proves the result is a set rather than a boolean.
    const mailTm = { provider: "mailtm", accountId: "acct", accessToken: "token" } as const;
    const nested = { kind: "created", address: "a@b.test", payload: mailTm };
    const several = { accessToken: "token", sessionId: "session" };

    // **Both names, and the reason is worth stating because the first version asserted one.** A
    // Mail.tm credential has *two* secret fields, `accountId` and `accessToken`, and only the token
    // is the obvious one. `provider` is beside them in the same object and is **not** reported — which
    // is the shared-discriminant rule below holding, shown in the first case rather than only in the
    // one that derives it.
    expect(credentialFieldsIn(mailTm)).toEqual(["accessToken", "accountId"]);
    expect(credentialFieldsIn(nested)).toEqual(["accessToken", "accountId"]);
    expect(credentialFieldsIn(several)).toEqual(["accessToken", "sessionId"]);

    // And the negative half of the same reader, so the three above are evidence rather than decoration.
    expect(credentialFieldsIn({ kind: "created", address: "a@b.test" })).toEqual([]);
    expect(credentialFieldsIn({ provider: "guerrilla" })).toEqual([]);
    expect(credentialFieldsIn(null)).toEqual([]);
    expect(credentialFieldsIn("a string")).toEqual([]);

    // **The set is not empty, so the three above are not vacuous.** Derived from the parse rather than
    // declared, so this count is also the parse having found something.
    expect(
      CREDENTIAL_FIELDS.size,
      "no credential field name was read from packages/core",
    ).toBeGreaterThan(0);
  });

  it("reads the same credential field names by parse and by type, in both directions", () => {
    // **Two routes, compared over real strings.** The parse is what brings a new field into the
    // obligation at runtime; the literals are what make `tsc` fail when a variant gains or loses one.
    // **Neither alone would do both**, which is why the agreement is asserted rather than one of the
    // two routes being preferred.
    const fromType = new Set(
      CREDENTIAL_FIELDS_AS_LITERALS.filter((field) => !SHARED_CREDENTIAL_FIELDS.has(field)),
    );

    expect(
      [...CREDENTIAL_FIELDS].filter((field) => !fromType.has(field)),
      "field names the parse reads and the literals do not carry",
    ).toEqual([]);
    expect(
      [...fromType].filter((field) => !CREDENTIAL_FIELDS.has(field)),
      "field names the literals carry and the parse does not read",
    ).toEqual([]);

    // **The discriminant is excluded by a rule rather than by a list, and the exclusion is non-empty.**
    // A rule with nothing to exclude would mean every member of every variant is a secret, which is
    // not what this package declares.
    expect(SHARED_CREDENTIAL_FIELDS.size, "no field is shared by every credential variant").toBe(1);

    // **The control, in the direction that matters.** A parse that found nothing would satisfy both
    // assertions above - an empty set is a subset of anything - so a field is planted into a **copy**
    // of `packages/core`'s source and the same derivation is required to bring it in.
    const source = readFileSync(join(REPO_ROOT, CREDENTIALS_SOURCE_PATH), "utf8");
    const planted = source.replace(
      "  readonly sessionId: string;",
      "  readonly sessionId: string;\n  readonly mailboxPassword: string;",
    );
    expect(planted, "the planted field was not planted into the copy").not.toBe(source);

    const shapes = declaredShapesIn(planted);
    const counts = new Map<string, number>();
    for (const shape of shapes.values()) {
      for (const field of shape.members) {
        counts.set(field, (counts.get(field) ?? 0) + 1);
      }
    }
    const plantedFields = new Set(
      [...counts].filter(([, count]) => count === 1).map(([field]) => field),
    );

    expect(
      [...plantedFields].filter((field) => !CREDENTIAL_FIELDS.has(field)),
      "the planted field is not reported by the derivation the assertions above use",
    ).toEqual(["mailboxPassword"]);
  });

  it.each(
    CREDENTIAL_BOUNDARY.flatMap((entry) =>
      entry.values.map((value) => [entry.type, entry.reader, value] as const),
    ),
  )("%s carries no credential field in the value this extension sends", (_type, reader, value) => {
    // **The narrowing has to return something first.** A reader answering `null` for every input
    // would make every `credentialFieldsIn` below trivially empty, and this block has already paid
    // for that shape once - a narrowing function's failure mode is silence, which is why the tables
    // above it pair every refusal with an admission.
    const narrowed = reader(value);

    expect(narrowed, `${_type} refused its own well-formed value`).not.toBeNull();
    expect(credentialFieldsIn(narrowed), `a credential field in what ${_type} carries`).toEqual([]);
  });

  it("declares no credential field in any type this module ships", () => {
    // **The direction the forward direction cannot reach.** Every case above narrows a value through a
    // reader; a reader is a *parser*, and a member it does not return is invisible to it. So this
    // reads the **declarations**, which is the only place a field that nothing reads would appear.
    const credentialFieldsInTypes = new Map<string, string[]>();

    for (const [type, shape] of declaredShapesIn(
      readFileSync(join(REPO_ROOT, PROTOCOL_SOURCE_PATH), "utf8"),
    )) {
      const found = shape.members.filter((member) => CREDENTIAL_FIELDS.has(member));
      if (found.length > 0) {
        credentialFieldsInTypes.set(type, found);
      }
    }

    expect(
      [...credentialFieldsInTypes].map(
        ([type, members]) => `${type} declares ${members.join(", ")}`,
      ),
      "protocol types declaring a credential field",
    ).toEqual([]);
  });

  it("reports a credential field when one is planted into a copy of the protocol", () => {
    // **The control for the case above.** A parse that returned no shapes at all would satisfy it,
    // because an empty map produces an empty list. So a field is planted into a **copy** of
    // `protocol.ts` and the same reader is required to report it - through the same derivation the
    // case above calls, rather than through a second use of the parse.
    const source = readFileSync(join(REPO_ROOT, PROTOCOL_SOURCE_PATH), "utf8");
    const planted = source.replace(
      '  | { readonly kind: "host"; readonly host: string }',
      '  | { readonly kind: "host"; readonly host: string; readonly sessionId: string }',
    );
    expect(planted, "the planted field was not planted into the copy").not.toBe(source);

    const found: string[] = [];
    for (const [type, shape] of declaredShapesIn(planted)) {
      for (const member of shape.members) {
        if (CREDENTIAL_FIELDS.has(member)) {
          found.push(`${type}.${member}`);
        }
      }
    }

    // **Containment rather than the whole array, and the repair is a falsification run rather than a
    // preference.** This read `toEqual(["HostContextAnswer.sessionId"])`, which binds the control to
    // the *absence of every other* credential declaration in `protocol.ts` - a property it is not about
    // and cannot hold. Planting `readonly sessionId: string` onto a **different** variant of a
    // **different** union is caught by the case above, and this one went red beside it with a failure
    // message naming the planted type, which reads as though the reader had missed the plant. **A
    // control that fails for a reason other than the one it was written for is not a control**, and the
    // two assertions are the same property here: the reader reports what the reader reads.
    expect(found, "the planted field is not reported by the reader the case above uses").toContain(
      "HostContextAnswer.sessionId",
    );

    // **Non-vacuity, and it is a count rather than a comparison** because `toContain` on an empty array
    // already fails - this arm says so explicitly, so a reader that returns nothing is named as such
    // rather than as a missing plant.
    expect(
      found.length,
      "the reader this control is aimed at reported nothing at all, so the containment above is empty",
    ).toBeGreaterThan(0);
  });

  it("maps every protocol type this module exports, in both directions", () => {
    // **The enumerability check, and it is the direction `design.md`'s risk section says this design
    // had to get right.** A type added to `protocol.ts` without a row here would be **outside** the
    // forward direction entirely, and an instrument that skips what it has not been told about is
    // indistinguishable from one that found nothing to say.
    const mapped = mappedTypeNames();
    const exported = exportedTypeNames();

    expect(
      [...exported].filter((type) => !mapped.has(type)),
      "protocol types this module ships that this map does not cover",
    ).toEqual([]);
    expect(
      [...mapped].filter((type) => !exported.has(type)),
      "types this map covers that this module no longer exports",
    ).toEqual([]);
  });

  it("carries one value per variant every union declares, in both directions", () => {
    // **Enumerability one level down.** The type-name check above says every type is covered; this
    // says every **kind** inside a covered type is too. `notActedOn` is the reason both halves are
    // needed rather than one: it is a variant of two different unions, so a map keyed on the
    // discriminant alone would hold one row where this holds two - and the second is the one that
    // would go missing.
    const shapes = declaredShapesIn(readFileSync(join(REPO_ROOT, PROTOCOL_SOURCE_PATH), "utf8"));

    for (const entry of CREDENTIAL_BOUNDARY) {
      const shape = shapes.get(entry.type);

      expect(shape, `this module no longer exports ${entry.type}`).toBeDefined();
      expect(
        entry.values.length,
        `${entry.type} declares ${shape?.variants ?? 0} variants and this map carries ${
          entry.values.length
        } values`,
      ).toBe(shape?.variants);

      // **An interface's discriminant is a constant reference and not a literal, so it has no kind
      // list to be compared against — and that is a fact to assert rather than a case to skip.**
      // `CreateMailboxRequest` declares `readonly kind: typeof CREATE_MAILBOX_REQUEST_KIND`, so the
      // parser reads no literal from it and both lists would be *empty and therefore equal* while
      // proving nothing. The second arm below says the declaration admits exactly one shape, which is
      // what "no kind list" means here; the discriminant it must carry is already pinned by the
      // forward direction, because each request guard admits one discriminant and no other.
      const declared = new Set(shape?.kindLiterals ?? []);
      if (declared.size === 0) {
        expect(
          shape?.variants,
          `${entry.type} declares no kind literal and admits more than one shape, so this reader cannot enumerate it`,
        ).toBe(1);
        continue;
      }

      const carried = entry.values.map((value) => String(discriminantOf(value)));

      // **Both directions, and the second is the one a variant added later breaks.**
      expect(
        [...declared].filter((kind) => !carried.includes(kind)),
        `kinds ${entry.type} declares that this map carries no value for`,
      ).toEqual([]);
      expect(
        carried.filter((kind, at) => carried.indexOf(kind) !== at || !declared.has(kind)),
        `kinds this map carries for ${entry.type} that it does not declare`,
      ).toEqual([]);
    }
  });
});
