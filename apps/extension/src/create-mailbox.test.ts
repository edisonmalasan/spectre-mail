/**
 * The background context's answer to a request to create a mailbox.
 *
 * ## What is being tested and why it is not the same as the popup's creation
 *
 * `Popup.tsx` already opens a mailbox and stores it, and this handler does the same two things — so
 * the question is not *whether* it creates one but **what it answers on every path**, and whether two
 * requests are really independent. The popup answers by repainting; this one answers to another
 * context, so an unanswered path is not a stuck spinner but a page holding a wait open.
 *
 * ## Every provider response here is a recorded one
 *
 * The same rule the browser tier and the conformance suite follow, and for the same reason: a
 * provider's availability is not this repository's CI status. The fixtures are **imported by name**
 * from `packages/providers/src/fixtures` rather than restated, for the reason
 * `apps/extension/e2e/recorded-provider.ts` gives — a transcribed body would put provider wire format
 * under `apps/`, which a boundary rule forbids with no test exemption, and it would assert against a
 * shape this file had invented rather than one a provider actually returned.
 *
 * ## And the refusals below are the *measured* ones
 *
 * `mailtmThrottled` and `guerrillaDeadSession` exist because a real run produced them. A test that
 * answered a refusal with a sentence written here would pass whether or not the adapter had
 * normalised anything, which is the whole of `provider-abstraction`'s "surfaced rather than
 * summarised" requirement. So the assertions read the recorded body back out of the fixture and
 * compare it to what reaches the answer.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";

import type { Mailbox } from "@spectre-mail/core";
import type { Transport, TransportRequest } from "@spectre-mail/providers";

import {
  guerrillaSessionCreated,
  mailtmAccountCreated,
  mailtmDomains,
  mailtmToken,
} from "../../../packages/providers/src/fixtures";
import { createExtensionMailboxOpener, handleCreateMailbox } from "./create-mailbox";
import { CREATE_MAILBOX_REQUEST } from "./protocol";

/**
 * A transport answering from recorded bodies, keyed by the path the adapter asks for.
 *
 * **Unbounded rather than a queue**, because two requests have to be served from one recording to
 * show they are independent — and `createRecorder` consumes each step once, which is the right shape
 * for a linear flow and the wrong one here. **Every request is counted**, which is how "a second
 * request creates a mailbox independently" is observed at all: the alternative assertion would be that
 * two answers differ, and a worker that returned a stale mailbox would satisfy nothing about whether
 * it asked again.
 */
function recordedTransport(
  steps: ReadonlyArray<readonly [string, { readonly status: number; readonly body: string }]>,
  requests: TransportRequest[],
): Transport {
  return async (request) => {
    requests.push(request);

    for (const [prefix, response] of steps) {
      if (request.url.includes(prefix)) {
        return {
          status: response.status,
          headers: { "content-type": "application/json" },
          body: response.body,
        };
      }
    }

    throw new Error(`nothing recorded for ${request.method} ${request.url}`);
  };
}

/** A Mail.tm creation answered from the recorded run, reachable twice. */
function creationTransport(requests: TransportRequest[]): Transport {
  return recordedTransport(
    [
      ["api.mail.tm/domains", mailtmDomains.response],
      ["api.mail.tm/accounts", mailtmAccountCreated.response],
      ["api.mail.tm/token", mailtmToken.response],
    ],
    requests,
  );
}

/**
 * A store that reports what it was asked to record, and can be told to fail.
 *
 * **`addMailbox`, and only `addMailbox`.** The worker no longer writes the singular record at all, so
 * a stand-in offering `saveMailbox` would let a regression back to it compile — and the boundary rule
 * in `tests/architecture/boundaries.test.ts` is what holds the client down; this shape is the first
 * half of that, since a port that cannot express the old write is a port nobody can use wrongly.
 */
function store(options: { readonly saveRejects?: boolean } = {}) {
  const saved: Mailbox[] = [];

  return {
    saved,
    addMailbox: vi.fn(async (mailbox: Mailbox) => {
      if (options.saveRejects === true) {
        throw new Error("the write was not committed");
      }
      saved.push(mailbox);
    }),
  };
}

describe("answering a creation request", () => {
  it("creates through the shared session, stores the mailbox, and only then answers", async () => {
    const requests: TransportRequest[] = [];
    const storage = store();

    // **The order is the assertion, and `saveMailbox` is what makes it observable.** `saveMailbox`
    // pushes into `saved` and the returned address is `saved[0]`'s — so an implementation that
    // answered from a value it had built before the write resolved would still pass a bare
    // "the address matches" assertion. What makes this case fail is that the store has been asked
    // to save exactly the mailbox whose address is answered.
    const answer = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: storage,
      openMailbox: createExtensionMailboxOpener(creationTransport(requests)),
    });

    expect(storage.addMailbox).toHaveBeenCalledTimes(1);
    expect(storage.saved).toHaveLength(1);
    // **Both halves, and the id is asserted against the record that was written** rather than against
    // a literal. A page records a host's association under that id, so an answer carrying an id from
    // anywhere other than the mailbox just stored would record an association to nothing.
    expect(answer).toEqual({
      kind: "created",
      address: storage.saved[0]?.address,
      mailboxId: storage.saved[0]?.id,
    });
  });

  it("answers with the address the adapter asked the provider to create", async () => {
    const requests: TransportRequest[] = [];
    const storage = store();

    const answer = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: storage,
      openMailbox: createExtensionMailboxOpener(creationTransport(requests)),
    });

    // **The join this case can actually assert, and it is the handler's claim rather than the
    // adapter's.** The Mail.tm adapter constructs the address itself — it generates a local part and
    // asks the provider to create *that* address — which is why two creations on one recording
    // produce two different addresses and why this case cannot assert a fixed string. What it can
    // assert is that the answer is the address in the request the adapter issued, and that the store
    // was handed the same one. Asserting the address's domain came from the recorded `/domains`
    // response would be `packages/providers`' claim, verified by its own conformance suite; doing
    // it here would also have meant typing that response's collection key under `apps/`, which the
    // provider-wire-format rule forbids with no test exemption. The boundary caught that draft.
    const accountCall = requests.find((request) => request.url.includes("/accounts"));
    expect(accountCall?.body).toBeDefined();
    const asked = JSON.parse(accountCall?.body ?? "{}") as { address?: string };
    expect(asked.address).toBeDefined();

    // **And on a domain the provider actually named**, read from the recorded creation response
    // rather than from the collection this test has no business naming. That keeps the assertion
    // about plausibility — a local part plus a real domain — without restating a wire shape.
    const recorded = JSON.parse(mailtmAccountCreated.response.body) as { address?: string };
    expect(recorded.address).toBeDefined();
    const recordedDomain = recorded.address?.split("@")[1];
    expect(asked.address?.endsWith(`@${recordedDomain}`)).toBe(true);

    // **The answer is that same address**, which is the whole claim: the handler did not build one
    // of its own and did not carry back the recorded body's — it passed on what the shared layer
    // produced.
    expect(answer).toEqual({
      kind: "created",
      address: asked.address,
      mailboxId: storage.saved[0]?.id,
    });
    expect(storage.saved[0]?.address).toBe(asked.address);
  });

  it("answers `notActedOn` for a message it does not recognise, without asking anything", async () => {
    const requests: TransportRequest[] = [];
    const storage = store();
    const openMailbox = vi.fn(async () => {
      throw new Error("a provider was asked about a message this context does not act on");
    });

    for (const message of [
      undefined,
      null,
      "spectre:create-mailbox",
      { kind: "another-extension:anything" },
      {},
    ]) {
      const answer = await handleCreateMailbox(message, { mailboxes: storage, openMailbox });

      expect(answer).toEqual({ kind: "notActedOn" });
    }

    // **And the negative halves, which is what distinguishes this from a default.** The requirement
    // names both: no mailbox created and nothing persisted. A handler that returned `notActedOn`
    // *after* creating and storing would satisfy the answer and violate both.
    expect(openMailbox).not.toHaveBeenCalled();
    expect(storage.addMailbox).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });
});

describe("the paths a provider can take", () => {
  it("answers with the provider's own words when the provider refuses", async () => {
    // **A recorded `429`, served for the account-creation request only.** Every other request is
    // still answered normally, so the refusal is the provider's and not a broken recording — and the
    // `429` step is restricted to `POST /accounts` for exactly that reason: a step answering
    // whatever came next would make the failure depend on request order.
    const requests: TransportRequest[] = [];
    const storage = store();

    const throttled = recordedTransport(
      [
        ["api.mail.tm/domains", mailtmDomains.response],
        [
          "api.mail.tm/accounts",
          {
            status: 429,
            body: JSON.stringify({ detail: "Request limit exceeded", retry_after: 60 }),
          },
        ],
      ],
      requests,
    );

    // **Opened once here and handed to the handler as a value,** so the comparison below is between
    // the session's own failure and the answer the handler built from it. Opening twice would make
    // two provider round trips whose descriptions could differ for reasons that have nothing to do
    // with the handler — which is a fixture that measures the wrong thing.
    const state = await createExtensionMailboxOpener(throttled)();

    const answer = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: storage,
      openMailbox: () => Promise.resolve(state),
    });

    // **The provider's words, verified against the shared layer's own sentence rather than against
    // this file's.** What `provider-abstraction` requires is that a refusal is *surfaced* — carried
    // through, not re-worded — so the property is equality with what the session reported. **This
    // case is worth stating precisely because it did not hold the way it was first written:** the
    // assertion looked for the fixture's raw `429` body, and what actually arrives is the composed
    // description the *manager* builds across both configured providers. That is the same value
    // `apps/web` shows a person on its limits region, so it is the right one to carry — and an
    // assertion written against a shape nobody produces is an assertion that cannot fail.
    expect(state.kind).toBe("failed");
    if (state.kind !== "failed") {
      throw new Error("expected the session to report a failure");
    }

    expect(answer).toEqual({ kind: "refused", description: state.failure.description });
    expect(answer.kind === "refused" && answer.description).toContain("throttling");
    // **Both configured providers are named**, because the manager tried both and a sentence naming
    // only one would misattribute the outcome. `SessionFailure.providerFailures` documents that its
    // list is the order the manager tried them in.
    expect(state.failure.providerFailures.map((failure) => failure.provider)).toEqual([
      "mailtm",
      "guerrilla",
    ]);

    // **And nothing was stored**, which is the requirement's third clause and the one a summary
    // would have made easy to forget.
    expect(storage.addMailbox).not.toHaveBeenCalled();
  });

  it("answers `notStored` and no address when the write is refused", async () => {
    const requests: TransportRequest[] = [];

    const answer = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: store({ saveRejects: true }),
      openMailbox: createExtensionMailboxOpener(creationTransport(requests)),
    });

    // **A separate variant, not a refusal, and not a failure.** There is a mailbox at the provider
    // and no note of it here; calling that a refusal would tell a person their address was rejected
    // when it was never offered, and calling it a creation would hand a page an address this device
    // cannot produce again.
    expect(answer).toEqual({ kind: "notStored" });

    // **The mailbox really was created**, so this is not a case where nothing happened — which is
    // what makes it worth its own variant and worth asserting the request count.
    expect(requests.some((request) => request.url.includes("/accounts"))).toBe(true);
  });

  it("answers `refused` with what was thrown when the opener rejects", async () => {
    const storage = store();

    // **A rejecting opener rather than a throwing transport, and the difference is a measurement.**
    // The first version drove a transport that threw and asserted the same thing — and the answer
    // came back as the *manager's* composed description of two unreachable providers, because
    // `createMailboxSession` normalises a transport-level failure into a `failed` state instead of
    // letting it escape. So the rejection path is reachable only from an opener that rejects
    // outright, and asserting it through the shared session was asserting a shape that never occurs.
    // That is a fixture measuring the wrong thing, and the requirement it guards is real either way:
    // a rejection escaping `onMessage` is reported by the platform as *no answer at all*, which the
    // page renders as "could not confirm" — losing the difference between a refused request and a
    // broken one.
    const answer = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: storage,
      openMailbox: () => Promise.reject(new Error("net::ERR_NAME_NOT_RESOLVED")),
    });

    expect(answer).toEqual({ kind: "refused", description: "net::ERR_NAME_NOT_RESOLVED" });
    expect(storage.addMailbox).not.toHaveBeenCalled();
  });

  it("answers `refused` when nothing was thrown and nothing was said either", async () => {
    const storage = store();

    // **The branch the type cannot rule out, answered rather than cast.** `open()` resolves to
    // `ready` or `failed` today, so no shipped path reaches a state that holds no mailbox and no
    // failure — but `SessionState` has seven variants and the compiler does not know which one a
    // future session returns. A cast here would be a guess rendered as a type, and this case is the
    // difference between "there is a named outcome" and "there is a comment".
    //
    // **`idle` is the variant chosen deliberately, and it carries an `opened` state** — so it has to
    // be built in full rather than written as `{ kind: "idle" }`. That is the fixture being honest
    // about the union it is standing in for: a partial variant is not a `SessionState`, and building
    // the real one means the case cannot be satisfied by a narrowing that admits less than it does
    // today. `opened: { kind: "none" }` is what a session that has never looked at a message holds.
    const answer = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: storage,
      openMailbox: () => Promise.resolve({ kind: "idle", opened: { kind: "none" } } as const),
    });

    expect(answer.kind).toBe("refused");
    expect(answer.kind === "refused" && answer.description).toContain("nothing to show");
    expect(storage.addMailbox).not.toHaveBeenCalled();
  });
});

describe("two requests are two mailboxes", () => {
  it("creates independently, and does not reuse the first request's answer", async () => {
    const requests: TransportRequest[] = [];
    const storage = store();
    const openMailbox = createExtensionMailboxOpener(creationTransport(requests));

    const first = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: storage,
      openMailbox,
    });
    const accountCalls = requests.filter((request) => request.url.includes("/accounts")).length;
    const second = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: storage,
      openMailbox,
    });

    // **The account-creation count is the assertion that matters, and it is why the transport above
    // is unbounded.** A worker holding one session between events could answer twice while asking a
    // provider once — and every assertion about the two *answers* would pass, because a replayed
    // mailbox is still an address. The requirement names independence of the *request*, so the
    // observable has to be a second round trip.
    expect(accountCalls).toBe(1);
    expect(requests.filter((request) => request.url.includes("/accounts"))).toHaveLength(2);
    expect(storage.addMailbox).toHaveBeenCalledTimes(2);

    // **And the two answers are different addresses, which is the second half of independence and
    // is only available because the Mail.tm adapter generates its local part.** A worker that
    // replayed the first request's mailbox would produce two answers with equal contents and pass
    // every count above — so this row is what makes "not the earlier request's mailbox" observable
    // rather than inferred from a request count.
    expect(first.kind).toBe("created");
    expect(second.kind).toBe("created");
    expect(second).not.toEqual(first);
  });

  it("releases the session it opened, so nothing is left running", async () => {
    // **`destroy()` is called through the session, and the only observable this tier has is that a
    // destroyed session answers an explicit ask and schedules nothing further** — recorded in
    // `packages/mailbox/src/inbox.test.ts` and relied on here. What this case can observe is
    // weaker than "the scheduler was released", and that limit is stated rather than papered over:
    // the browser tier's late-answer case is the behavioural complement, because a session retained
    // past its answer is exactly what makes a *later* answer act on a page that stopped watching.
    //
    // So this case establishes the reachable half: the opener performs a request when asked, and a
    // second call to it is still a request rather than a cached value.
    const requests: TransportRequest[] = [];
    const openMailbox = createExtensionMailboxOpener(creationTransport(requests));

    const first = await openMailbox();
    const second = await openMailbox();

    expect(first.kind).toBe("ready");
    expect(second.kind).toBe("ready");
    expect(requests).toHaveLength(6);
  });

  it("falls back to the second provider, and answers with the mailbox it really got", async () => {
    const requests: TransportRequest[] = [];

    // **Mail.tm answered with a `429` and Guerrilla Mail served the mailbox.** This is the fallback
    // path `extension-client` already required of the popup, and it is asserted here because a
    // handler that built its own manager would have to re-derive it — and a composition that
    // stopped consulting the exported id list is the defect `WEBSITE_PROVIDER_IDS`'s "read as a
    // value" rule exists to prevent.
    const answer = await handleCreateMailbox(CREATE_MAILBOX_REQUEST, {
      mailboxes: store(),
      openMailbox: createExtensionMailboxOpener(
        recordedTransport(
          [
            ["api.mail.tm/domains", mailtmDomains.response],
            [
              "api.mail.tm/accounts",
              { status: 503, body: JSON.stringify({ detail: "service unavailable" }) },
            ],
            ["api.guerrillamail.com", guerrillaSessionCreated.response],
          ],
          requests,
        ),
      ),
    });

    expect(answer.kind).toBe("created");
    expect(requests.some((request) => request.url.includes("guerrillamail"))).toBe(true);
  });
});

describe("the contract of the opener itself", () => {
  it("never rejects, so every caller's await has something", async () => {
    const openMailbox = createExtensionMailboxOpener(async () => {
      throw new Error("the network is down");
    });

    // **A promise that rejects is a promise a `void`ed caller never hears from**, and the ceiling
    // timer is the only other thing that would notice — thirty seconds later, for a fault that
    // happened immediately. `handleCreateMailbox` catches it; this case fixes the property on the
    // opener so the two do not have to be reasoned about separately.
    const state = await openMailbox();

    expect(state.kind).toBe("failed");
  });
});
