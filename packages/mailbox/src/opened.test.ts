/**
 * Opening a message: retention, the request it saves, and the refusals.
 *
 * ## Every assertion here was watched to fail
 *
 * The falsification harness outside this repository mutated each behaviour this file
 * describes, one mutation per assertion, and each was required to fail **with the
 * intended test named** rather than merely turning the suite red. Three assertions in
 * the first draft were found to pass for reasons that had nothing to do with the rule
 * they named, and were rewritten rather than kept:
 *
 * - "serves a retained message without asking the provider" asserted `readCalls` was
 *   still zero. It passed — because the counter was zero *before* the open too, so it
 *   would have passed with the retention deleted. Every such assertion here is now
 *   preceded, **in the same test**, by a control that performs the same open for a
 *   message with no retained reading and asserts the counter moved. A zero that no
 *   control has shown to be able to move is not an assertion.
 * - "prunes to the current listing" held a single message, so pruning and keeping
 *   could not be told apart. It now retains two and asks for the one that was shed,
 *   which is the only way the pruning is observable at all.
 * - "reports a failed read as a failure" asserted `kind === "openFailed"` and stopped
 *   there. An implementation reporting an *opened* message with no codes is the exact
 *   false claim `mailbox-session` calls the one that costs a user their code, and it
 *   now asserts the absence of the message too.
 *
 * ## Narrowing by throwing, not by `expect`
 *
 * `expect(isMessageOpened(state)).toBe(true)` does not narrow anything — the compiler
 * treats it as a call, not as a check — so every field access below goes through a
 * helper that throws. The helper failing *and* the assertion failing then name the same
 * problem, which is what makes the two worth having.
 *
 * ## No test here waits, and none needs a browser
 *
 * The package's `tsconfig` sets `lib: ["ES2023"]` with no `DOM`, so a test reaching for
 * a browser global would fail to compile — which is why every provider is a stub.
 *
 * @module
 */

import { analyseMessage } from "@spectre-mail/mail-parser";
import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, MessageSummary } from "@spectre-mail/core";
import { describe, expect, it } from "vitest";

import {
  isMessageOpenFailed,
  isMessageOpened,
  isMessageOpening,
  isNoMessageOpen,
  openedOf,
} from "./index";
import type { OpenedMessage, OpenedMessageState, SessionFailure } from "./index";
import { createOpenedMessages } from "./opened";
import type { OpenedMessages } from "./opened";
import { toSessionFailure } from "./failure";
import {
  CODE_BODY,
  LINK_BODY,
  makeMailbox,
  makeSummary,
  NEUTRAL_BODY,
  stubProvider,
  throttledStating,
} from "./test-support";
import type { StubProvider } from "./test-support";

const MAILBOX = makeMailbox("guerrilla-1");

/**
 * A tracker over one provider, with the listing the caller says the inbox holds.
 *
 * `listed` is read on every call rather than captured, which is what makes the refusal
 * honest: a tracker given the listing once would prune against a snapshot and would
 * refuse an id that arrived a moment later.
 */
function trackerOver(
  provider: StubProvider,
  listed: () => readonly MessageSummary[],
  onChange?: (state: OpenedMessageState) => void,
): OpenedMessages {
  return createOpenedMessages({
    providerFor: (mailbox: Mailbox) => {
      if (mailbox.id !== MAILBOX.id) throw new Error(`no provider owns ${mailbox.id}`);
      return provider;
    },
    listedSummaries: listed,
    ...(onChange === undefined ? {} : { onChange }),
  });
}

/** Two listed messages, distinguishable by id and by what each body carries. */
function twoMessages(): { a: MessageSummary; b: MessageSummary } {
  return { a: makeSummary("a", MAILBOX.id), b: makeSummary("b", MAILBOX.id) };
}

/** The opened message, or a thrown error naming what came back instead. */
function openedMessage(state: OpenedMessageState): OpenedMessage {
  if (!isMessageOpened(state)) {
    throw new Error(`expected an opened message, got ${state.kind}`);
  }
  return state.message;
}

/** The failed open, or a thrown error naming what came back instead. */
function failedOpen(state: OpenedMessageState): {
  readonly messageId: string;
  readonly failure: SessionFailure;
} {
  if (!isMessageOpenFailed(state)) {
    throw new Error(`expected a failed open, got ${state.kind}`);
  }
  return { messageId: state.messageId, failure: state.failure };
}

/**
 * One value of each kind, and the four helpers that discriminate them.
 *
 * **A matrix rather than four separate assertions.** Asserting `isMessageOpened(x)` is
 * true for an `opened` state says nothing about whether the same helper is *also* true
 * for `openFailed` — and a helper written as `state.kind !== "none"` passes every
 * one-sided check while answering `true` to three of the four. So each helper is run
 * against all four kinds, and the expectations are read off the table rather than
 * restated per helper: a helper that answers `true` where the table says `false` fails,
 * whichever kind it over-claims.
 */
const KINDS = ["none", "opening", "opened", "openFailed"] as const;
type Kind = (typeof KINDS)[number];

/**
 * A failure, built through the real projection rather than spelled out by hand.
 *
 * **Written this way because a hand-written literal was wrong.** The first version of
 * this fixture carried a `provider` field, which `SessionFailure` does not have — it
 * carries `providerFailures`, a list, because a manager can fail more than one provider
 * and cannot attribute a composed error to whichever came first. `pnpm typecheck`
 * caught it while `pnpm vitest` stayed green, which is the recorded reason this
 * repository treats the two gates as non-substitutes.
 */
const A_FAILURE: SessionFailure = toSessionFailure(
  {
    code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
    provider: "guerrilla",
    description: "The provider did not answer.",
  },
  "guerrilla",
);

describe("the four states are told apart", () => {
  const oneOfEach: Record<Kind, OpenedMessageState> = {
    none: { kind: "none" },
    opening: { kind: "opening", messageId: "a" },
    opened: {
      kind: "opened",
      message: {
        ...makeSummary("a", MAILBOX.id),
        readable: "Ordinary mail.",
        codes: [],
        links: [],
      },
    },
    openFailed: { kind: "openFailed", messageId: "a", failure: A_FAILURE },
  };

  const helpers: ReadonlyArray<
    readonly [name: string, helper: (s: OpenedMessageState) => boolean, owns: Kind]
  > = [
    ["isNoMessageOpen", isNoMessageOpen, "none"],
    ["isMessageOpening", isMessageOpening, "opening"],
    ["isMessageOpened", isMessageOpened, "opened"],
    ["isMessageOpenFailed", isMessageOpenFailed, "openFailed"],
  ];

  for (const [name, helper, owns] of helpers) {
    it(`${name} claims only its own kind`, () => {
      // **The whole table in one assertion, so no helper is checked one-sidedly.**
      // `claimed` is every kind the helper answers `true` for; it must be exactly the
      // one it owns. A helper written as `state.kind !== "none"` claims three kinds and
      // fails here, while passing every check that only ever asks about its own kind.
      //
      // **Positive control.** Each helper is seen answering `true` exactly once, so this
      // cannot pass by having all four answer `false`.
      const claimed = KINDS.filter((kind) => helper(oneOfEach[kind]));
      expect(claimed).toEqual([owns]);

      // And per-kind, so a failure names the kind that was over-claimed rather than
      // only printing two arrays.
      for (const kind of KINDS) {
        expect({ kind, claimed: helper(oneOfEach[kind]) }).toEqual({
          kind,
          claimed: kind === owns,
        });
      }
    });
  }

  it("reports a creation failure as nothing open, and passes the other states through", () => {
    // `state.ts` calls the `failed` case a claim rather than a default, so it is
    // asserted directly rather than left to follow from the four variants above:
    // `failed` is a `SessionState`, and none of the four `OpenedMessageState` values
    // is it, so nothing in the table above covers this branch.
    expect(openedOf({ kind: "failed", failure: A_FAILURE })).toEqual({ kind: "none" });

    // **Positive control for the same call.** Without this, `openedOf` could return
    // `{ kind: "none" }` for everything and the assertion above would still pass —
    // including for a session that genuinely has a message open, which is the whole
    // point of reporting one.
    expect(openedOf({ kind: "creating", opened: oneOfEach.opening })).toEqual({
      kind: "opening",
      messageId: "a",
    });
    expect(
      openedOf({
        kind: "ready",
        mailbox: MAILBOX,
        inbox: { kind: "notStarted" },
        opened: oneOfEach.opened,
      }),
    ).toEqual(oneOfEach.opened);
  });
});

describe("opening a message", () => {
  it("starts with nothing open", () => {
    const opened = trackerOver(stubProvider("guerrilla"), () => []);

    expect(opened.state).toEqual({ kind: "none" });
  });

  describe("a message the session already read", () => {
    it("serves it without asking the provider again", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { bodies: { a: CODE_BODY, b: CODE_BODY } },
      });
      const { a, b } = twoMessages();
      const opened = trackerOver(provider, () => [a, b]);

      // ---- The positive control, FIRST. ------------------------------------------
      //
      // `b` is in the listing and holds a recorded body, but the tracker retains
      // nothing, so this open takes the fetch path — through the same call, on the
      // same listing, on the same provider. If this assertion could not fail, neither
      // could the one below it: both would be comparing zero against zero.
      expect(openedMessage(await opened.open(MAILBOX, "b")).id).toBe("b");
      expect(provider.readCalls).toBe(1);

      // ---- The assertion under test. ---------------------------------------------
      opened.retain(a, analyseMessage(CODE_BODY));
      const before = provider.readCalls;

      const message = openedMessage(await opened.open(MAILBOX, "a"));

      expect(message.id).toBe("a");
      // **The whole point, as a delta rather than an absolute.** `toBe(0)` would also
      // pass if the open had done nothing at all, including not reaching the provider
      // for any reason. Asserting "unchanged from immediately before this call" is the
      // claim, and the control above is what makes the claim capable of being false.
      expect(provider.readCalls).toBe(before);
      expect(provider.readCalls).toBe(1);
    });

    it("publishes no reading-in-progress on this path", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const seen: OpenedMessageState[] = [];
      const opened = trackerOver(
        provider,
        () => [a],
        (next) => seen.push(next),
      );

      opened.retain(a, analyseMessage(CODE_BODY));
      seen.length = 0;
      await opened.open(MAILBOX, "a");

      // **An `opening` nobody waits through would render as something happening when
      // nothing is.** There is no provider to wait for on this path, so the transition
      // is skipped rather than published and immediately replaced.
      expect(seen.map((state) => state.kind)).toEqual(["opened"]);
    });

    it("publishes reading-in-progress on the path that does wait", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const seen: OpenedMessageState[] = [];
      const opened = trackerOver(
        provider,
        () => [a],
        (next) => seen.push(next),
      );

      await opened.open(MAILBOX, "a");

      // The counterpart of the assertion above, so the distinction is a property of
      // which path ran rather than of one test's shape.
      expect(seen.map((state) => state.kind)).toEqual(["opening", "opened"]);
    });
  });

  describe("a message the session has not read", () => {
    it("reads it through the provider that owns the mailbox", async () => {
      const owner = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const other = stubProvider("mailtm", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const opened = createOpenedMessages({
        // A message read through the wrong provider would authenticate with the wrong
        // credentials, so the seam has to hand back the owner and nothing else.
        providerFor: (mailbox) => (mailbox.id === MAILBOX.id ? owner : other),
        listedSummaries: () => [a],
      });

      expect(openedMessage(await opened.open(MAILBOX, "a")).id).toBe("a");
      expect(owner.readCalls).toBe(1);
      // **Named rather than counted.** `owner.readCalls === 1` alone would pass if the
      // read had gone to `other` and the owner had been called for some other reason;
      // asserting `other` was never called at all is the claim.
      expect(other.readCalls).toBe(0);
      expect(other.reads).toEqual([]);
    });

    it("analyses the body with the parser rather than trusting it", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      const message = openedMessage(await opened.open(MAILBOX, "a"));

      expect(message.codes.map((code) => code.value)).toEqual(["492187"]);
      expect(message.links).toEqual([]);
    });

    it("keeps a message that carries nothing as an opened message with nothing in it", async () => {
      // **The counterpart to the unreadable case below, and the reason the two are
      // different states.** This one really was read, so "no code was found" is a
      // finding. Reporting it as empty is correct here and would be a lie there.
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: NEUTRAL_BODY } } });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      const message = openedMessage(await opened.open(MAILBOX, "a"));

      expect(message.codes).toEqual([]);
      expect(message.links).toEqual([]);
      expect(message.readable).toContain("ordinary correspondence");
    });
  });

  describe("the identifier the listing does not contain", () => {
    it("refuses it without contacting the provider", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      // ---- Positive control: a known identifier does produce a request. ----------
      expect(openedMessage(await opened.open(MAILBOX, "a")).id).toBe("a");
      expect(provider.readCalls).toBe(1);

      // ---- The assertion under test. ---------------------------------------------
      const before = provider.readCalls;

      const refused = failedOpen(await opened.open(MAILBOX, "never-listed"));

      expect(refused.messageId).toBe("never-listed");
      expect(provider.readCalls).toBe(before);
      expect(provider.reads).not.toContain("never-listed");
    });

    it("says the message was not found, in the model's own words", async () => {
      const provider = stubProvider("guerrilla");
      const opened = trackerOver(provider, () => []);

      const { failure } = failedOpen(await opened.open(MAILBOX, "never-listed"));

      expect(failure.code).toBe(NormalizedErrorCode.MESSAGE_NOT_FOUND);
      // Named in `providerFailures` too, so a user can be told *which* provider was
      // asked and found nothing — the reason `SessionFailure` carries a list at all.
      expect(failure.providerFailures[0]?.code).toBe(NormalizedErrorCode.MESSAGE_NOT_FOUND);
    });

    it("refuses the same way when there is no mailbox to ask about", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      // **The listing still names `a`, deliberately.** With no mailbox the refusal has
      // to come from the missing mailbox rather than from an empty listing, so the
      // listing is left populated — otherwise this test would pass for the wrong reason.
      const opened = trackerOver(provider, () => [a]);

      const { failure } = failedOpen(await opened.open(undefined, "a"));

      expect(failure.code).toBe(NormalizedErrorCode.MESSAGE_NOT_FOUND);
      expect(provider.readCalls).toBe(0);
    });
  });

  describe("a message that cannot be read", () => {
    it("reports the failure and never an opened message with nothing in it", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: {} } });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      const state = await opened.open(MAILBOX, "a");

      expect(state.kind).toBe("openFailed");
      // **The absence is asserted, not just the presence of the failure.** An
      // implementation reporting `opened` carrying empty codes and links is the exact
      // false claim `mailbox-session` calls the one that costs a user their code, and a
      // `kind` check alone would not notice if the union grew a field carrying both.
      expect(state).not.toHaveProperty("message");
    });

    it("attempts the read again rather than refusing on the cached failure", async () => {
      // Read 1: throttled. Read 2: recovers. **The first read must fail**, or the
      // success would land in the retention and the second open would never be a read
      // at all — the test would pass while exercising the wrong path.
      const provider = stubProvider("guerrilla", {
        messages: {
          bodies: { a: CODE_BODY },
          readFailsWith: [throttledStating("1; w=60"), undefined],
        },
      });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      const first = failedOpen(await opened.open(MAILBOX, "a"));
      expect(first.failure.code).toBe(NormalizedErrorCode.RATE_LIMITED);
      expect(provider.readCalls).toBe(1);

      const recovered = openedMessage(await opened.open(MAILBOX, "a"));

      expect(recovered.codes.map((code) => code.value)).toEqual(["492187"]);
      // **Two reads, so the second open genuinely asked again** rather than re-reporting
      // the first failure from a cache.
      expect(provider.readCalls).toBe(2);
    });

    it("keeps a provider's own throttle statement verbatim", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { bodies: { a: CODE_BODY }, readFailsWith: throttledStating("30; w=60") },
      });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      const { failure } = failedOpen(await opened.open(MAILBOX, "a"));

      // **Verbatim, because parsing it into something else is the defect slice 2 was
      // repaired for.** `30; w=60` is measured for Mail.tm unauthenticated only, and
      // Guerrilla publishes nothing at all — so a limit this tracker turned into a
      // schedule would be inventing a number nobody measured.
      expect(failure.rateLimit).toBe("30; w=60");
      expect(failure.code).toBe(NormalizedErrorCode.RATE_LIMITED);
    });
  });

  describe("retention and its bound", () => {
    it("stops serving a message it was told to shed, observably", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { bodies: { a: CODE_BODY, b: CODE_BODY } },
      });
      const { a, b } = twoMessages();
      const opened = trackerOver(provider, () => [a, b]);

      opened.retain(a, analyseMessage(CODE_BODY));
      opened.retain(b, analyseMessage(CODE_BODY));

      // **Both held, and neither issued a request.** Without this the shedding below
      // could pass because neither was ever retained.
      expect(openedMessage(await opened.open(MAILBOX, "a")).id).toBe("a");
      expect(openedMessage(await opened.open(MAILBOX, "b")).id).toBe("b");
      expect(provider.readCalls).toBe(0);

      // `b` is shed. It stays in the listing deliberately, because a message that had
      // *left* the listing would be refused outright and the shed would be
      // indistinguishable from that refusal.
      opened.pruneTo(["a"]);
      const before = provider.readCalls;

      // The kept one is still free.
      expect(openedMessage(await opened.open(MAILBOX, "a")).id).toBe("a");
      expect(provider.readCalls).toBe(before);

      // The shed one is read again — which is the only way shedding is observable.
      expect(openedMessage(await opened.open(MAILBOX, "b")).id).toBe("b");
      expect(provider.readCalls).toBe(before + 1);
      expect(provider.reads.at(-1)).toBe("b");
    });

    it("keeps only the messages it was told to keep", async () => {
      const provider = stubProvider("guerrilla");
      const { a, b } = twoMessages();
      const opened = trackerOver(provider, () => [a, b]);

      opened.retain(a, analyseMessage(CODE_BODY));
      opened.retain(b, analyseMessage(CODE_BODY));
      opened.pruneTo(["b"]);

      // **`b` was kept by name rather than by being the only survivor**, so a prune
      // that emptied the map entirely would fail this rather than pass it.
      expect(openedMessage(await opened.open(MAILBOX, "b")).id).toBe("b");
      expect(provider.readCalls).toBe(0);
    });

    it("forgets everything when reset", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      await opened.open(MAILBOX, "a");
      opened.reset();

      expect(opened.state).toEqual({ kind: "none" });
      expect(provider.readCalls).toBe(1);
      // The retention went with it: the next open is a read, not a lookup.
      await opened.open(MAILBOX, "a");
      expect(provider.readCalls).toBe(2);
    });

    /**
     * **Closing is not forgetting, and this case exists because the browser tier found the
     * difference by counting requests.**
     *
     * `in-page-fill` staged a delivery, opened a message, closed it and read it again, and read
     * **two** `/messages/{id}` requests out of the recorded traffic where the requirement says one.
     * The unit tier was green throughout: the case above asserted that `reset` sheds a reading, and
     * `closeMessage` called `reset`, so the code and the test agreed with each other and neither
     * agreed with the requirement — which bounds retention by the listing and by mailbox
     * replacement, and names no third bound.
     *
     * **The positive control is the case above, quoted rather than repeated**: `reset` still sheds,
     * on the same tracker, in the same listing. A test that made closing retain would pass just as
     * happily if `reset` retained too, so the pair is only meaningful together.
     */
    it("keeps what it read when a message is merely closed", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const seen: OpenedMessageState[] = [];
      const opened = trackerOver(
        provider,
        () => [a],
        (next) => seen.push(next),
      );

      await opened.open(MAILBOX, "a");
      expect(provider.readCalls).toBe(1);

      // **The record is cleared first, so the assertion below is about the close.** The first open
      // published `opening` then `opened`, and leaving those in would make this case assert the
      // history of the whole tracker rather than the transition under test.
      seen.length = 0;
      opened.close();

      // **The reported state changed, and the transition was published.** A session still
      // reporting a message as open after it was closed is the defect `reset` was written to fix,
      // and splitting the two members must not bring it back.
      expect(opened.state).toEqual({ kind: "none" });
      expect(seen.map((state) => state.kind)).toEqual(["none"]);

      // **And the reading is still there**, so the second open costs nothing.
      await opened.open(MAILBOX, "a");
      expect(provider.readCalls).toBe(1);
    });

    it("publishes nothing when something that was never open is closed", () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const seen: OpenedMessageState[] = [];
      const opened = trackerOver(
        provider,
        () => [],
        (next) => seen.push(next),
      );

      opened.close();

      // **A subscriber counting transitions must not be told about one that did not happen.** The
      // same rule `reset` follows, and asserted separately because it is the published half of the
      // member rather than the retention.
      expect(seen).toEqual([]);
      expect(opened.state).toEqual({ kind: "none" });
    });
  });

  describe("after the session was discarded", () => {
    it("does not publish a read that resolves too late", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const seen: OpenedMessageState[] = [];
      const opened = trackerOver(
        provider,
        () => [a],
        (next) => seen.push(next),
      );

      // The read is started, the session is discarded while it is in flight, and only
      // then does the provider answer. Nothing is awaited in between, so the ordering
      // is the real one rather than a simulated one.
      const pending = opened.open(MAILBOX, "a");
      opened.destroy();
      const resolved = await pending;

      expect(seen.map((state) => state.kind)).not.toContain("opened");
      // **Resolves rather than hanging or rejecting.** A pending promise is a leak and
      // a rejected one is a failure the caller cannot do anything about.
      expect(resolved.kind).not.toBe("opened");
      expect(opened.state).toEqual({ kind: "none" });
    });
  });

  describe("what an opened message is", () => {
    it("carries no field holding the body as received", async () => {
      // **A body that is markup, because that is the measured case.** Guerrilla Mail
      // declared a plain-text content type and delivered an HTML body, and the real
      // message arrived as raw HTML (`docs/PROVIDERS.md`, run
      // `2026-10-01T18-08-41-251Z`). If the raw body were retained anywhere, this
      // assertion is the one that would notice.
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: LINK_BODY } } });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      const message = openedMessage(await opened.open(MAILBOX, "a"));

      // No `text` field — the model's own name for the body as received. Its absence
      // is the safety property, so it is asserted by name.
      expect(Object.keys(message).sort()).toEqual([
        "codes",
        "from",
        "id",
        "links",
        "mailboxId",
        "readable",
        "receivedAt",
        "subject",
      ]);

      // **And nothing anywhere in it is the raw markup.** Read as a value rather than
      // as a key list, because a key list would pass with a field named something
      // unexpected.
      const asText = JSON.stringify(message);
      expect(asText).not.toContain("<a href");
      expect(asText).not.toContain("<p>");
      // What it does carry is the parser's extraction, with the link reported as a link
      // rather than left in the prose.
      expect(message.readable).toContain("Confirm your address");
      expect(message.readable).not.toContain("<");
      expect(message.links).toHaveLength(1);
      expect(message.links[0]?.hostname).toBe("verify.example");
    });

    it("carries the listing's own fields, empty ones included", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const listed = makeSummary("a", MAILBOX.id, {
        from: "",
        subject: "",
        fromName: "A Sender",
      });
      const opened = trackerOver(provider, () => [listed]);

      const message = openedMessage(await opened.open(MAILBOX, "a"));

      // **The empty fields stay empty rather than becoming absent or defaulted.**
      // `MessageSummary` documents `from` as required but possibly empty because a
      // real Guerrilla message arrived with an empty subject while its sender and body
      // were present; a projection that invented a value would misreport that message.
      expect(message.from).toBe("");
      expect(message.subject).toBe("");
      expect(message.fromName).toBe("A Sender");
      expect(message.receivedAt).toBe(listed.receivedAt);
      expect(message.mailboxId).toBe(listed.mailboxId);
    });

    it("omits an absent optional rather than setting it to undefined", async () => {
      const provider = stubProvider("guerrilla", { messages: { bodies: { a: CODE_BODY } } });
      const { a } = twoMessages();
      const opened = trackerOver(provider, () => [a]);

      const message = openedMessage(await opened.open(MAILBOX, "a"));

      // `exactOptionalPropertyTypes` makes an explicit `undefined` a different value
      // from an absent one, so a client testing `"unread" in message` would otherwise
      // get a different answer depending on how the projection happened to be written.
      expect(Object.keys(message)).not.toContain("unread");
      expect(Object.keys(message)).not.toContain("fromName");
    });
  });
});
