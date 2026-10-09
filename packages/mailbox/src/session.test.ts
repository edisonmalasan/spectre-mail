/**
 * Mailbox session tests.
 *
 * Every test here drives a stub provider, so the suite needs no network, no
 * browser, no DOM, and no provider. That is a requirement of the change, not a
 * convenience: the package's `tsconfig` sets `lib: ["ES2023"]` with no `DOM`, so
 * a test reaching for a browser global would fail to compile.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";
import { createGuerrillaAdapter, createProviderManager } from "@spectre-mail/providers";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  createMailboxSession,
  isCreating,
  isFailed,
  isIdle,
  isReady,
  isMessageOpened,
  openedOf,
  verdictFor,
} from "./index";
import type { MailboxSession, MessageVerdict, SessionState } from "./index";
import {
  BOTH_BODY,
  CODE_BODY,
  FIXED_NOW,
  makeMailbox,
  makeSummary,
  manualScheduler,
  recordingTransport,
  stubProvider,
  throttled,
  unreachable,
} from "./test-support";
import type { ManualScheduler, StubProvider } from "./test-support";

/**
 * Task 1.4's Verify clause, as a permanent assertion rather than a one-off observation.
 *
 * The clause reads "*an `InMemoryOpenedMessage`-free stub that lacks the member fails to
 * typecheck, so the interface is genuinely required of an implementation rather than
 * optional*". The first attempt at observing that was a falsification harness mutation
 * that deleted the member from the interface and ran `tsc` — and it reported success
 * with **zero compiler errors**, because removing a member from an interface cannot break
 * the class that still implements it. The harness had looked for the member's *name* in
 * the compiler's output and found it in the implementation instead. A check that passes
 * for the wrong reason is worse than no check, so it was replaced by this:
 *
 * **`@ts-expect-error` is bidirectional.** The directive says "there is an error on this
 * line"; if the member ever became optional, the assignment would become legal, the
 * directive would be unused, and `pnpm typecheck` would fail **naming the unused
 * directive**. So the assertion is load-bearing in both directions and is checked by a
 * gate this repository already runs — Vitest cannot see it at all, which is precisely
 * why the clause named `tsc`.
 */
describe("the session interface", () => {
  it("requires the members that open and close a message", () => {
    type WithoutOpenMessage = Omit<MailboxSession, "openMessage">;
    type WithoutCloseMessage = Omit<MailboxSession, "closeMessage">;

    // @ts-expect-error — `openMessage` is required, so a session without it is not one.
    const cannotOpen: MailboxSession = null as unknown as WithoutOpenMessage;
    // @ts-expect-error — and the same for closing one, which is a session with no way out.
    const cannotClose: MailboxSession = null as unknown as WithoutCloseMessage;

    // **Both casts are lies on purpose, and nothing here is asserted at runtime.** The
    // claim lives entirely in the two directives above; this is the smallest runtime
    // assertion that keeps them from being read as dead code. If either member were ever
    // dropped from the interface *entirely*, `Omit` would silently succeed and the
    // directives would fail — which is the other direction, and the reason this is worth
    // having rather than a comment.
    expect([cannotOpen, cannotClose]).toEqual([null, null]);
  });
});

describe("createMailboxSession", () => {
  it("runs with no DOM available, which is the environment the package targets", () => {
    // `mailbox-session`'s "The package is imported without a browser" scenario: the
    // suite SHALL pass in an environment with no DOM and no rendering framework.
    //
    // **The environment was a claim rather than a test until now.** The package's
    // own suite is plain Node — `vitest.config.ts` sets the global `environment` to
    // `"node"` precisely so this package is not handed a DOM — but nothing asserted
    // it, so the guarantee rested on a config value with no check attached. If the
    // global environment were ever switched to `jsdom`, every test here would still
    // pass, and the package would quietly acquire a DOM it is meant not to have.
    //
    // This asserts the ambient globals directly rather than trusting the config: a
    // jsdom default would make each of these defined.
    //
    // **And the node-only claim is the one the compiler does not make.** Measured name
    // by name on 2026-10-02: this package's `lib: ["ES2023"]` rejects `window`,
    // `document`, and `location` at *compile* time, and rejects nothing else that
    // matters here. It does **not** reject `navigator`, `localStorage`, or
    // `sessionStorage`, which `@types/node` declares — and Node v26.10.0 additionally
    // defines `navigator` and `sessionStorage` on `globalThis` at runtime. So "no
    // DOM" and "no storage" are two separate properties here, and only the first is
    // enforced by the compiler.
    //
    // The globals are read reflectively rather than referenced, because a **runtime**
    // claim needs a runtime check and a direct property access could not be written
    // at all: this package's `lib: ["ES2023"]` rejects `globalThis.document` at
    // compile time, which is the primary enforcement and is not available here.
    // `Reflect.get` reaches a global the type system does not declare.
    for (const name of ["document", "window", "location", "indexedDB", "caches", "history"]) {
      expect(Reflect.get(globalThis, name), `${name} should not exist here`).toBeUndefined();
    }

    // **Node is not empty, and that is precisely why the boundary rule exists.**
    // Measured on Node v26.10.0 while writing this assertion: `navigator` is defined
    // on `globalThis` as an object, and `sessionStorage` is defined experimentally.
    // `@types/node` declares both, so they *compile* here and they *exist* at runtime.
    // Nothing about the absence of a DOM prevents this package from reaching for
    // either — the compiler will not stop it and the environment will not either.
    //
    // The only thing that stops it is the explicit rule in
    // `tests/architecture/boundaries.test.ts`. So the absence of a DOM is **not** by
    // itself a no-storage guarantee, and this assertion says so rather than implying
    // that it is.
    //
    // (`localStorage` and `sessionStorage` are deliberately *not* read here: Node
    // emits an `ExperimentalWarning` on access without `--localstorage-file`, and a
    // test that printed that warning on every run would be a test people learn to
    // ignore. Their absence is not asserted; their use in this package is forbidden
    // by rule instead, which is the check that does not need the global.)
    expect(Reflect.get(globalThis, "navigator"), "Node provides navigator").toBeTypeOf("object");
  });

  describe("the state it reports", () => {
    it("starts idle, and does not claim to be creating a mailbox it has not been asked for", () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        manualScheduler(),
      );

      // **`idle` rather than `creating`, and this assertion was `creating` until
      // adoption arrived.** The test was not wrong when it was written and it was not
      // weakened to pass: the session's first act used to be creating a mailbox, so
      // `creating` described a session that had been built and asked nothing. Its
      // first act is now to be handed a stored mailbox or told there is none, and a
      // session that has not been asked anything is not creating one — a page
      // rendering before it has asked would say it is asking the provider for a new
      // address while it is asking its own storage. The promoted `mailbox-session`
      // scenario this serves is *Nothing is stored and no request has been made*.
      expect(session.current()).toEqual({ kind: "idle", opened: { kind: "none" } });
      expect(isIdle(session.current())).toBe(true);
      // **The negative half, which is the half that matters.** `isCreating` false is
      // the assertion; a test that only checked the `kind` string would pass against
      // an implementation that reported `idle` while every helper still said creating.
      expect(isCreating(session.current())).toBe(false);

      // **`opened: { kind: "none" }` from the very first state, and that is the claim
      // being made.** Slice 3 added `opened` to `SessionState`, and the question this
      // assertion answers is whether a session that has opened nothing says so from the
      // moment it exists. A state with no `opened` field would be a state a client has
      // to special-case, and it is the state a client renders *while a mailbox is
      // being replaced* - which is exactly when the previous mailbox's message must
      // already be gone from the screen.
      expect(openedOf(session.current())).toEqual({ kind: "none" });
      expect(isReady(session.current())).toBe(false);
      expect(isFailed(session.current())).toBe(false);
    });

    it("carries no field belonging to another variant", async () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        manualScheduler(),
      );

      // A `ready` state must not also carry a `failure`, and a `failed` state must
      // not carry a `mailbox`. A union built as three loose shapes would pass every
      // other test in this file and still let a client read `state.mailbox` off a
      // failure.
      const ready = session.open();
      // `kind` and `opened`, not `kind` alone: `opened` belongs to `creating` and to
      // `ready` and to neither `failed`, and the point of the whole assertion is that
      // no variant carries a field from another. `opened` is spelled out rather than
      // omitted so that adding it here cannot pass unnoticed.
      expect(Object.keys(session.current()).sort()).toEqual(["kind", "opened"]);
      expect(Object.keys(session.current())).not.toContain("mailbox");

      await ready;
      // Four keys now, not three: `inbox` arrived with slice 2 and `opened` with slice
      // 3, and each belongs to `ready` and only to `ready`, which is what the next
      // assertion is for. Written as an exact set rather than a subset so that a
      // `failure` key appearing here - the original defect this test exists for -
      // cannot pass by being unmentioned.
      expect(Object.keys(session.current()).sort()).toEqual(["inbox", "kind", "mailbox", "opened"]);
      expect(Object.keys(session.current())).not.toContain("failure");

      // **The `failed` variant's key set was never checked.** This test asserted
      // two of the three variants and a *different* test elsewhere asserted
      // `"mailbox" in state` for the third, so task 1.2's "no state carries a field
      // belonging to another variant" was never actually established for the variant
      // where it would matter most — the one a client is most tempted to read a
      // mailbox off. Asserting the exact key set closes it: a `failed` state with a
      // `mailbox` key fails here whatever else is true about it.
      const failing = createMailboxSession(
        createProviderManager([stubProvider("guerrilla", { failWith: unreachable() })]),
        manualScheduler(),
      );
      await failing.open();

      const failedKeys = Object.keys(failing.current()).sort();
      expect(failedKeys).toEqual(["failure", "kind"]);
      expect(failedKeys).not.toContain("mailbox");
    });

    it("narrows each variant through its own helper", async () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        manualScheduler(),
      );

      const state = await session.open();

      expect(isReady(state)).toBe(true);
      if (!isReady(state)) throw new Error("expected a ready state");
      expect(state.mailbox.address).toContain("@mail.example");
    });
  });

  describe("opening a session", () => {
    it("reports the mailbox the manager returned, unchanged", async () => {
      const supplied = makeMailbox("guerrilla-1");
      const provider = stubProvider("guerrilla", { mailbox: supplied });
      const session = createMailboxSession(createProviderManager([provider]), manualScheduler());

      const state = await session.open();

      if (!isReady(state)) throw new Error("expected a ready state");
      // Identity, not just shape: a session that reconstructed the mailbox from its
      // fields would be synthesising an address, which the requirement forbids.
      expect(state.mailbox).toBe(supplied);
      expect(state.mailbox.address).toBe("guerrilla-1@mail.example");
      expect(state.mailbox.createdAt).toBe(FIXED_NOW);
    });

    it("reports a failure rather than a mailbox when creation fails", async () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla", { failWith: unreachable() })]),
        manualScheduler(),
      );

      const state = await session.open();

      if (!isFailed(state)) throw new Error("expected a failed state");
      expect(state.failure.code).toBe(NormalizedErrorCode.PROVIDER_UNAVAILABLE);
      // No mailbox key at all, rather than one holding undefined: a client reading
      // `state.mailbox` off a failure should get a type error, not a nullish value
      // that flows onward.
      expect("mailbox" in state).toBe(false);
    });

    it.each([
      [NormalizedErrorCode.RATE_LIMITED, throttled()],
      [NormalizedErrorCode.PROVIDER_UNAVAILABLE, unreachable()],
      [
        NormalizedErrorCode.MAILBOX_EXPIRED,
        {
          code: NormalizedErrorCode.MAILBOX_EXPIRED,
          provider: "guerrilla" as const,
          description: "The mailbox is gone.",
        },
      ],
      [
        NormalizedErrorCode.AUTH_FAILED,
        {
          code: NormalizedErrorCode.AUTH_FAILED,
          provider: "guerrilla" as const,
          description: "The credentials were refused.",
        },
      ],
    ])("reports %s as its own code, not a generic one", async (expected, failure) => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla", { failWith: failure })]),
        manualScheduler(),
      );

      const state = await session.open();

      if (!isFailed(state)) throw new Error("expected a failed state");
      // The code, never a message string. A test asserting `message` contains
      // "rate" would pass for any failure whose prose happened to use the word,
      // which is the same defect found in `packages/providers`'s manager tests.
      expect(state.failure.code).toBe(expected);
    });

    it("keeps the provider's own description", async () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla", { failWith: throttled() })]),
        manualScheduler(),
      );

      const state = await session.open();

      if (!isFailed(state)) throw new Error("expected a failed state");
      expect(state.failure.description).toBe("Rate limited; try again shortly.");
    });
  });

  describe("replacing the mailbox", () => {
    it("returns a new state and leaves the previous one unchanged", async () => {
      const provider = stubProvider("guerrilla");
      const session = createMailboxSession(createProviderManager([provider]), manualScheduler());

      const first = await session.open();
      const second = await session.replace();

      // The first state is held by the caller and must still describe what it
      // described. An in-place mutation - the obvious implementation - rewrites
      // `first.mailbox`, and a client that stored the previous state to compare
      // would silently be reading the new mailbox under the old identity.
      if (!isReady(first) || !isReady(second)) throw new Error("expected ready states");
      expect(first).not.toBe(second);
      expect(first.mailbox).not.toBe(second.mailbox);
      expect(first.mailbox.address).toBe("guerrilla-1@mail.example");
      expect(second.mailbox.address).toBe("guerrilla-2@mail.example");
      expect(session.current()).toBe(second);
    });

    it("reaches the provider once per replacement", async () => {
      const provider = stubProvider("guerrilla");
      const session = createMailboxSession(createProviderManager([provider]), manualScheduler());

      await session.open();
      await session.replace();

      expect(provider.createCalls).toBe(2);
      expect(provider.created).toHaveLength(2);
    });
  });

  describe("provider health", () => {
    it("reports the provider's own status unchanged", async () => {
      const session = createMailboxSession(
        createProviderManager([
          stubProvider("guerrilla", { health: { provider: "guerrilla", status: "unavailable" } }),
        ]),
        manualScheduler(),
      );

      const health = await session.health();

      expect(health).toEqual({ provider: "guerrilla", status: "unavailable" });
    });

    it("keeps a rate limit verbatim and states no scope for it", async () => {
      const session = createMailboxSession(
        createProviderManager([
          stubProvider("guerrilla", {
            health: { provider: "guerrilla", status: "throttled", rateLimit: "1; w=60" },
          }),
        ]),
        manualScheduler(),
      );

      const health = await session.health();

      // Verbatim, byte for byte. Nothing may rewrite it into "1 request", split it,
      // or attach a scope: the header states a limit and a window and nothing about
      // what it is counted per. Whether `1; w=60` is per-IP or per-account was never
      // verified, so any scope here would be an invention.
      expect(health.rateLimit).toBe("1; w=60");
      expect(Object.keys(health).sort()).toEqual(["provider", "rateLimit", "status"]);
    });

    it.each(["ok", "throttled", "unavailable"] as const)("passes %s through", async (status) => {
      const session = createMailboxSession(
        createProviderManager([
          stubProvider("guerrilla", { health: { provider: "guerrilla", status } }),
        ]),
        manualScheduler(),
      );

      expect((await session.health()).status).toBe(status);
    });

    it("asks the first configured provider before any mailbox exists", async () => {
      // The positive control for the requirement's "SHALL NOT report a state
      // derived from a mailbox that does not exist": there is no mailbox, and the
      // session still answers with a real provider's own status rather than
      // inventing one or refusing.
      const primary = stubProvider("guerrilla", {
        health: { provider: "guerrilla", status: "ok" },
      });
      const fallback = stubProvider("mailtm", {
        health: { provider: "mailtm", status: "unavailable" },
      });
      const session = createMailboxSession(
        createProviderManager([primary, fallback]),
        manualScheduler(),
      );

      const health = await session.health();

      expect(health.provider).toBe("guerrilla");
      expect(primary.healthCalls).toBe(1);
      // Not the fallback: with no mailbox there is no owner, and asking the
      // fallback would be reaching for a second provider to answer a question the
      // first could answer.
      expect(fallback.healthCalls).toBe(0);
    });

    it("asks the owning provider once a mailbox exists", async () => {
      const primary = stubProvider("guerrilla");
      const fallback = stubProvider("mailtm");
      const session = createMailboxSession(
        createProviderManager([primary, fallback]),
        manualScheduler(),
      );

      await session.open();
      await session.health();

      expect(primary.healthCalls).toBe(1);
      expect(fallback.healthCalls).toBe(0);
    });
  });

  describe("which providers a client offers", () => {
    it("offers only what it was configured with", async () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        manualScheduler(),
      );

      expect(session.providers.map((provider) => provider.id)).toEqual(["guerrilla"]);
    });

    it("keeps two clients' configurations apart", async () => {
      const website = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        manualScheduler(),
      );
      const extension = createMailboxSession(
        createProviderManager([stubProvider("mailtm"), stubProvider("guerrilla")]),
        manualScheduler(),
      );

      await website.open();
      await extension.open();

      // Neither inherited the other's. The package must not assume the website's
      // single-provider shape, or the extension's two-provider one.
      expect(website.providers.map((provider) => provider.id)).toEqual(["guerrilla"]);
      expect(extension.providers.map((provider) => provider.id)).toEqual(["mailtm", "guerrilla"]);
    });

    it("never probes a provider it was not given", async () => {
      const configured = stubProvider("guerrilla");
      const session = createMailboxSession(createProviderManager([configured]), manualScheduler());

      await session.open();

      // No health call, no check. A session that verified its provider was reachable
      // on open would add a request the requirement does not describe.
      expect(configured.healthCalls).toBe(0);
    });
  });

  describe("a mailbox belongs to one provider for life", () => {
    it("routes a call to the provider the mailbox names", async () => {
      const primary = stubProvider("mailtm");
      const fallback = stubProvider("guerrilla");
      const session = createMailboxSession(
        createProviderManager([primary, fallback]),
        manualScheduler(),
      );

      const state = await session.open();
      if (!isReady(state)) throw new Error("expected a ready state");

      expect(session.providerFor(state.mailbox)).toBe(primary);
    });

    it("refuses a mailbox from a provider it was not configured with", () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        manualScheduler(),
      );
      const foreign: Mailbox = makeMailbox("mailtm-1", "mailtm");

      // The mismatch must be *reported*, not silently substituted. Serving a Mail.tm
      // mailbox through a Guerrilla adapter would authenticate with the wrong
      // credentials, so the honest answer is to name the mismatch.
      expect(() => session.providerFor(foreign)).toThrow(/mailtm/);
      expect(() => session.providerFor(foreign)).toThrow(/guerrilla/);
    });
  });

  describe("failures that stay specific", () => {
    it("never retries a throttled failure on its own", async () => {
      const provider = stubProvider("guerrilla", { failWith: throttled() });
      const session = createMailboxSession(createProviderManager([provider]), manualScheduler());

      await session.open();
      await session.open();

      // Exactly one call per `open`. A retry inside `open` would show as a second
      // call for a single `open`, and `provider-abstraction` requires throttling be
      // surfaced to the user rather than silently retried.
      expect(provider.createCalls).toBe(2);
    });

    it("surfaces one provider's own failure rather than a wrapper", async () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla", { failWith: throttled() })]),
        manualScheduler(),
      );

      const state = await session.open();

      if (!isFailed(state)) throw new Error("expected a failed state");
      // The stub's own code, not an aggregate invented for one member.
      expect(state.failure.code).toBe(NormalizedErrorCode.RATE_LIMITED);
      expect(state.failure.rateLimit).toBe("1; w=60");
      expect(state.failure.providerFailures).toEqual([
        {
          provider: "guerrilla",
          code: NormalizedErrorCode.RATE_LIMITED,
          description: "Rate limited; try again shortly.",
        },
      ]);
    });

    it("names every provider that failed when several are configured", async () => {
      const session = createMailboxSession(
        createProviderManager([
          stubProvider("mailtm", { failWith: throttled("mailtm") }),
          stubProvider("guerrilla", { failWith: unreachable("guerrilla") }),
        ]),
        manualScheduler(),
      );

      const state = await session.open();

      if (!isFailed(state)) throw new Error("expected a failed state");
      // Both named. With more than one provider the manager's composed error is the
      // answer, because it names each provider that failed and no single provider's
      // failure can. The code degrades to `UNKNOWN_PROVIDER_ERROR` rather than
      // borrowing one member's, because attributing the pair to whichever happened to
      // be first would be a claim the evidence does not support.
      expect(state.failure.code).toBe(NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR);
      expect(state.failure.description).toContain("mailtm");
      expect(state.failure.description).toContain("guerrilla");

      // Both are listed, and **neither is attributed**. This is the distinction the
      // field's documentation draws: naming the providers that were tried is not
      // naming the one that failed, and a client that rendered `providerFailures`
      // as "guerrilla failed with UNKNOWN" would be asserting something nobody
      // knows. Each entry is explicitly unattributable.
      expect(state.failure.providerFailures.map((failure) => failure.provider)).toEqual([
        "mailtm",
        "guerrilla",
      ]);
      expect(state.failure.providerFailures.map((failure) => failure.code)).toEqual([
        NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
        NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
      ]);
    });

    it("does not attribute a composed failure to whichever provider came first", async () => {
      const session = createMailboxSession(
        createProviderManager([
          stubProvider("mailtm", { failWith: throttled("mailtm") }),
          stubProvider("guerrilla", { failWith: unreachable("guerrilla") }),
        ]),
        manualScheduler(),
      );

      const state = await session.open();
      if (!isFailed(state)) throw new Error("expected a failed state");

      // `RATE_LIMITED` is a real, structured code that one of these providers
      // genuinely produced. Borrowing it as the aggregate would tell a user to wait
      // when one of the two causes was "could not be reached" — and the rate-limit
      // header that came with it has been consumed by the manager. The measured
      // header is deliberately absent here rather than carried up from the member
      // that had one.
      expect(state.failure.code).not.toBe(NormalizedErrorCode.RATE_LIMITED);
      expect(state.failure.rateLimit).toBeUndefined();
    });

    it("does not parse prose to recover a code it was not given", async () => {
      // A failure that carries no structured code must not have one recovered from
      // its message. If a rule reads `UNKNOWN_PROVIDER_ERROR` out of the text
      // "Rate limited" it would be guessing, and it would fail silently and
      // permanently the first time the wording changed.
      const session = createMailboxSession(
        createProviderManager([
          {
            ...stubProvider("guerrilla"),
            createMailbox: () =>
              Promise.reject(new Error("Rate limited; try again in 60 seconds.")),
          },
        ]),
        manualScheduler(),
      );

      const state = await session.open();

      if (!isFailed(state)) throw new Error("expected a failed state");
      expect(state.failure.code).toBe(NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR);
      expect(state.failure.description).toContain("Rate limited");
    });
  });

  describe("the requests it makes", () => {
    it("adds no request of its own to what the provider makes", async () => {
      const recorder = recordingTransport();
      const adapter = createGuerrillaAdapter({
        transport: recorder.transport,
        now: () => FIXED_NOW,
      });

      // **Positive control first.** The *same two operations* driven straight
      // through a real adapter, so a zero below means "the session added none"
      // rather than "the recorder never worked". Without this, a transport that
      // silently recorded nothing would make every assertion here pass.
      await adapter.createMailbox().catch(() => undefined);
      await adapter.checkHealth().catch(() => undefined);
      const directRequests = recorder.requests;
      expect(directRequests.length).toBeGreaterThan(0);

      recorder.reset();
      const session = createMailboxSession(createProviderManager([adapter]), manualScheduler());
      await session.open();
      await session.health().catch(() => undefined);

      // **Equal, not zero.** The adapter legitimately makes requests; the session is
      // not the thing that makes them. If the session issued even one request of its
      // own this count would be `directRequests.length + 1`.
      expect(recorder.requests).toHaveLength(directRequests.length);

      // And the same requests, to the same origins, in the same order - so the
      // session is not reaching somewhere the adapter would not have.
      expect(recorder.requests).toEqual(directRequests);
    });

    /**
     * How a recorded request is answered, so the polling path can be driven.
     *
     * **These bodies name provider wire fields, and they are in a test file for that
     * reason.** The first draft put them in `test-support.ts`, which the
     * wire-format rule scans like any other shipped source - the rule exempts
     * `.test.ts` because a test has to be able to name what it exercises, and
     * `test-support.ts` is not one. It caught them, correctly.
     *
     * Recorded shapes, not invented ones: these are the fields
     * `packages/providers` reads out of a Guerrilla `get_email_address` response and
     * out of an empty fetch. The empty list is also *meaningful* - a bare `{ list: [] }`
     * is what a measured Guerrilla answer means for a session it no longer
     * recognises, so the adapter refuses it, and the test lets it.
     */
    function guerrillaAnswer(url: string): {
      status: number;
      headers: Record<string, string>;
      body: string;
    } {
      return url.includes("f=get_email_address")
        ? {
            status: 200,
            headers: {},
            body: JSON.stringify({
              email_addr: "recorder@mail.example",
              sid_token: "token-recorded",
            }),
          }
        : { status: 200, headers: {}, body: JSON.stringify({ list: [] }) };
    }

    it("adds no request of its own to what the provider makes while polling", async () => {
      // **The polling path, which the test above did not reach.** It drove `open` and
      // `health` only, so the entire loop added by slice 2 was invisible to the count -
      // and the boundary scan that would otherwise have covered it was pointed at two
      // other packages. Found by the independent verification pass: a `fetch` inside
      // `createInboxTracker` turned no assertion red.
      //
      // The same shape as the test above, over the operations the loop performs, with
      // the same positive control first - a recording transport that recorded nothing
      // would make every assertion here pass.
      const recorder = recordingTransport({ respond: guerrillaAnswer });
      const adapter = createGuerrillaAdapter({
        transport: recorder.transport,
        now: () => FIXED_NOW,
      });
      const scheduler = manualScheduler();

      // The same three operations straight through the adapter: create, list, list.
      // A recorded response that creates a real mailbox, because **a session that never
      // opened has nothing to poll** - its `checkInbox` would legitimately make no
      // request and the assertion below would pass for the wrong reason.
      const mailbox = await adapter.createMailbox();
      // Each list is refused by the adapter — a bare `{ list: [] }` is what a measured
      // Guerrilla answer means for a session it no longer recognises, and refusing it
      // is that adapter's job. **The request is what this test counts**, and it was
      // made either way; letting the rejection escape would only stop the test before
      // it compared anything.
      await adapter.listMessages(mailbox).catch(() => undefined);
      await adapter.listMessages(mailbox).catch(() => undefined);
      const directRequests = recorder.requests;
      expect(directRequests).toHaveLength(3);

      recorder.reset();
      const session = createMailboxSession(createProviderManager([adapter]), scheduler);
      await session.open();
      await session.checkInbox();
      // And one turn of the loop, so the *scheduled* path is covered as well as the
      // caller-driven one. `manualScheduler`-style driving: the test decides when.
      await scheduler.run();

      expect(recorder.requests).toEqual(directRequests);
    });

    /**
     * How a recorded request is answered when the mailbox genuinely holds a message.
     *
     * **A second responder rather than a parameterised `guerrillaAnswer`.** The
     * polling test above depends on the empty list — a bare `{ list: [] }` is what a
     * measured Guerrilla answer means for a session it no longer recognises — so
     * teaching that responder to return a message would have quietly removed the case
     * that makes the adapter's refusal worth testing. Two responders, each shaped by
     * what it is for.
     *
     * **A message leaves the listing by being replaced, not by the list emptying.**
     * The first version of this responder answered a departure with `{ list: [] }`, and
     * the adapter refused it — with `MAILBOX_EXPIRED`, and with a description that is
     * the clearest statement in the codebase of why it refuses: an empty answer is not
     * evidence that a mailbox is empty. So a departure is modelled as a different
     * message arriving, which is what a departure looks like in a recording.
     *
     * Field names are the ones the adapter reads: `mail_id` as a **number**, because
     * Guerrilla sends it as one and the adapter has a guard for the string form; a
     * `mail_date`/`mail_time` pair rather than a timestamp, because the provider sends
     * the day and the clock separately and no timezone.
     */
    function guerrillaMessageAnswer(url: string): {
      status: number;
      headers: Record<string, string>;
      body: string;
    } {
      const member = (id: number) => ({
        mail_id: id,
        mail_from: `sender-${id}@mail.example`,
        mail_subject: `Recorded subject ${id}`,
        mail_date: "2026-09-02",
        mail_time: "12:00:00",
        mail_read: "1",
      });

      if (url.includes("f=get_email_address")) {
        return {
          status: 200,
          headers: {},
          body: JSON.stringify({
            email_addr: "recorder@mail.example",
            sid_token: "token-recorded",
          }),
        };
      }
      if (url.includes("f=check_email")) {
        const ids = servedListings.shift() ?? [];
        return {
          status: 200,
          headers: {},
          // **`email_addr` is not decoration.** The adapter reads a listing without it
          // as a dead session — `MAILBOX_EXPIRED` — because a provider that no longer
          // recognises a session still echoes a token back and nothing else. A first
          // draft of this responder omitted it and the failure surfaced as an expired
          // mailbox rather than as the fixture mistake it was.
          body: JSON.stringify({
            email_addr: "recorder@mail.example",
            list: ids.map((id) => member(id)),
          }),
        };
      }
      // `fetch_email` names the message it was asked for and answers with that one's
      // body, so two messages in one mailbox are distinguishable and a control may
      // read them in any order.
      const asked = /email_id=(\d+)/.exec(url)?.[1];
      const id = asked === undefined ? 0 : Number(asked);
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({
          list: [{ ...member(id), mail_body: CODE_BODY, content_type: "text" }],
        }),
      };
    }

    /** The message ids each successive `check_email` reports, in order. */
    let servedListings: number[][] = [];

    it("adds no request of its own to what the provider makes while opening", async () => {
      // **The opened path, which neither of the two tests above reached.** They drove
      // `open`, `health`, and the loop; slice 3 added a third path that reaches the
      // provider, and a `fetch` inside `openMessage` would have turned no assertion
      // red. Same shape as those two, and for the same reason: a recording transport
      // that recorded nothing would make every assertion below pass.
      //
      // **The sequence makes the first message leave the listing and come back**, which
      // is the only shape in which opening spends a request at all: the inbox's verdict
      // for a message is sticky, so one that never left its reading is served from
      // memory and this test would prove nothing about the fetched path.
      const plan = [[1000001], [1000002], [1000001, 1000002]];
      servedListings = plan.map((listing) => [...listing]);
      const recorder = recordingTransport({ respond: guerrillaMessageAnswer });
      const adapter = createGuerrillaAdapter({
        transport: recorder.transport,
        now: () => FIXED_NOW,
      });
      const scheduler = manualScheduler();

      // ---- Positive control: the same operations straight through the adapter. -----
      const mailbox = await adapter.createMailbox();
      const firstListing = await adapter.listMessages(mailbox);
      expect(firstListing).toHaveLength(1);
      const messageId = firstListing[0]!.id;
      await adapter.getMessage(mailbox, messageId); // the inbox's verdict
      const secondListing = await adapter.listMessages(mailbox);
      await adapter.getMessage(mailbox, secondListing[0]!.id); // the replacement's verdict
      await adapter.listMessages(mailbox); // both listed again
      await adapter.getMessage(mailbox, messageId); // opening the one that had been shed
      const directRequests = recorder.requests;
      // Seven: one create, three listings, and three reads.
      expect(directRequests).toHaveLength(7);
      expect(recorder.requests.filter((each) => each.includes("f=fetch_email"))).toHaveLength(3);

      recorder.reset();
      servedListings = plan.map((listing) => [...listing]);
      const session = createMailboxSession(createProviderManager([adapter]), scheduler);
      await session.open();
      await session.checkInbox();
      await session.checkInbox();
      await session.checkInbox();

      const opened = await session.openMessage(messageId);
      expect(opened.kind).toBe("opened");

      // **Equal, in order, to the same origins.** A session that reached anywhere the
      // adapter would not have shows up here as an extra or a changed line, and one
      // that issued a request of its own on top of the adapter's shows up as a longer
      // list.
      expect(recorder.requests).toEqual(directRequests);
      // **Three** `fetch_email` requests: the inbox's two verdicts, and the one open
      // that had to fetch. Stated so the equality above is not the only thing standing
      // between this test and an implementation that silently did less.
      expect(recorder.requests.filter((each) => each.includes("f=fetch_email"))).toHaveLength(3);
    });

    it("cannot be given a transport at all", () => {
      // The absence is the guarantee: there is no parameter through which a
      // transport could be supplied.
      //
      // **`Function.length` is not enough on its own, and this comment previously
      // claimed otherwise.** It counts parameters only up to the first one with a
      // default, so a second *defaulted* parameter — `transport: unknown = undefined`
      // — left `length` at 1 and this assertion green, with the full 365-test suite
      // green alongside it. The previous version of this comment said a second
      // parameter "would fail to compile", which is not true either: a defaulted
      // one compiles fine.
      //
      // So the seam is checked by *reading the signature* rather than by measuring
      // its arity. A defaulted parameter is still a parameter, and a source check
      // sees it. The arity assertion is kept alongside as a cheap second signal,
      // not as the guarantee it used to be described as.
      //
      // **Now two parameters, and the second one is guarded the same way.** Polling
      // arrived in slice 2 and a scheduler is a genuine second parameter - but it is
      // the same class of hazard, so the rule widens rather than the check relaxing:
      // a `Transport` is refused in *either* position, and the scheduler may not be
      // defaulted either. A default would reach for the global `setTimeout`, which
      // `@types/node` declares in exactly the way this package's missing `DOM` lib
      // fails to stop, so a default would be a path that only ever runs in a browser.
      const source = readFileSync(new URL("./session.ts", import.meta.url), "utf8");
      const declaration = source.match(/export function createMailboxSession\(([^)]*)\)/);
      expect(declaration).not.toBeNull();

      // The manager, then the scheduler, and nothing else. A `Transport` anywhere in
      // this parameter list is the exact shape of the defect this guards.
      const parameters = (declaration?.[1] ?? "")
        .split(",")
        .map((parameter) => parameter.trim())
        .filter((parameter) => parameter.length > 0);
      expect(parameters).toHaveLength(2);
      expect(parameters[0]).toContain("manager");
      expect(parameters[1]).toContain("scheduler");
      expect(declaration?.[1] ?? "").not.toMatch(/transport/i);

      // Neither may be defaulted. `Function.length` would not notice, and the
      // signature check would not either unless it said so out loud.
      for (const parameter of parameters) {
        expect(parameter).not.toMatch(/=/);
      }

      // And the declaration really is two-parameter, so the check above is not
      // reading a comment or a second overload.
      expect(createMailboxSession).toHaveLength(2);
    });
  });

  describe("when no provider is configured", () => {
    it("reports a failure rather than a mailbox that does not exist", async () => {
      // `createProviderManager` refuses an empty list, so this hand-rolled manager is
      // the only way to reach the state. A session built over one must still fail
      // with something a user could be shown rather than throwing something raw.
      const empty = {
        available: [],
        createMailbox: () =>
          Promise.reject(new Error("No configured provider could create a mailbox.")),
        providerFor: () => {
          throw new Error("unreachable");
        },
      };

      const state = await createMailboxSession(empty, manualScheduler()).open();

      expect(isFailed(state)).toBe(true);
      if (!isFailed(state)) throw new Error("expected a failed state");
      expect(state.failure.code).toBe(NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR);
    });

    it("reports a readable failure when health is asked with nothing configured", async () => {
      const empty = {
        available: [],
        createMailbox: () => Promise.reject(new Error("unused")),
        providerFor: () => {
          throw new Error("unused");
        },
      };

      // `health()` is async, so an unconfigured session *rejects* rather than throwing
      // synchronously. Asserting with `expect(fn).toThrow` here would pass on a
      // promise that never settled, which is why the earlier version of this
      // assertion was written that way and failed for the wrong reason.
      await expect(createMailboxSession(empty, manualScheduler()).health()).rejects.toThrow(
        /no provider configured/i,
      );
    });
  });

  /**
   * `subscribe` arrived with polling and is what makes a moving session renderable.
   *
   * **These four tests did not exist when the method was written.** The website's
   * binding was the only caller, so the contract was exercised only through a
   * component that happened to need it - which would not have caught a defect that
   * only some callers hit. The third is the sharpest of them and is written for the
   * exact reason it is here.
   */
  describe("being told what changed", () => {
    /** A session over a stub, plus every state a listener was handed. */
    function observed() {
      const scheduler = manualScheduler();
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        scheduler,
      );
      const seen: SessionState[] = [];
      const stop = session.subscribe((next) => seen.push(next));
      return { session, scheduler, seen, stop };
    }

    it("tells a new subscriber what the session holds right now", () => {
      const { seen } = observed();

      // Without this, a subscriber that arrived after the state had already moved would
      // render one transition behind for as long as it lived. `idle` rather than
      // `creating`, for the reason the sibling test records: the state a subscriber is
      // handed on the way in is the state the session actually holds, and it has not
      // been asked to create anything.
      expect(seen).toEqual([{ kind: "idle", opened: { kind: "none" } }]);
    });

    it("tells a subscriber about the move into checking, before the provider answers", async () => {
      const { session, seen } = observed();
      await session.open();

      seen.length = 0;
      const pending = session.checkInbox();
      // Read **synchronously**, before awaiting: the whole point of the transition is
      // that it happens while the request is still in flight, so a test that awaited
      // first would never see it.
      expect(seen.map((state) => (isReady(state) ? state.inbox.kind : state.kind))).toEqual([
        "checking",
      ]);

      await pending;
    });

    it("keeps telling the other listeners when one unsubscribes itself", async () => {
      // React unsubscribes on every effect cleanup, from inside the notification, and
      // Set iteration is defined to tolerate removing the entry currently being
      // visited — so this assertion is **not** what the copy-on-iterate is for. It is
      // kept because a subscriber that vanishes mid-notification is the shape of the
      // hazard, and a future edit that swapped the copy for something else should have
      // to think about this test rather than discover it in production.
      const scheduler = manualScheduler();
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        scheduler,
      );

      const second: string[] = [];
      let stopFirst = (): void => undefined;
      const first = session.subscribe(() => {
        stopFirst();
      });
      session.subscribe((next) => second.push(next.kind));
      stopFirst = first;

      await session.open();

      expect(second.length).toBeGreaterThan(0);
    });

    it("does not call a listener that subscribed during the notification it is in", async () => {
      // **This is what the copy is actually for.** Iterating the live `Set` means an
      // entry added during the loop is visited by that same loop — so a listener that
      // subscribes another is called twice for one notification: once re-entrantly
      // from inside the loop, and once from `subscribe`'s own delivery of the current
      // state.
      //
      // This is reachable from React, where a `setState` in one subscriber can mount a
      // component whose effect subscribes. Whether React flushes that synchronously
      // depends on the version and the update's priority; that it *can* is enough, and
      // a `Set` iterator's treatment of entries added mid-loop is not something to
      // leave to chance.
      //
      // **The subscription happens on the second notification, not the first.** The
      // first version of this test subscribed from inside `subscribe`'s own immediate
      // delivery — which is not inside any `setState` loop — so no loop was running and
      // the mutation it was written for did nothing at all. The counter is what puts
      // the subscription inside a notification.
      const scheduler = manualScheduler();
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        scheduler,
      );

      const late: string[] = [];
      let notifications = 0;
      session.subscribe(() => {
        notifications += 1;
        if (notifications !== 2) return;
        session.subscribe((next) => late.push(next.kind));
      });

      await session.open();

      // Exactly two: the delivery `subscribe` makes on the way in, and the transition
      // to `ready` that follows it. The `creating` transition itself is *not* among
      // them, because the subscription happened during it — which is the whole point.
      expect(late).toEqual(["creating", "ready"]);
    });

    it("stops telling a listener once it has unsubscribed", async () => {
      const { session, seen, stop } = observed();

      stop();
      seen.length = 0;
      await session.open();

      expect(seen).toEqual([]);
    });
  });

  /**
   * Slice 3: opening a message through the session.
   *
   * Every test here drives a stub provider, so none of it contacts a provider or needs
   * a browser — and none of it says anything about how either measured provider behaves
   * when a real page opens a real message. What it does say is that the wiring holds:
   * the retention the inbox's read fills, the pruning the listing drives, the mailbox
   * change that has to clear both, and the states a client reads.
   */
  describe("opening a message through the session", () => {
    /** A ready session over one mailbox holding `summaries`, with `bodies`. */
    function readySession(
      provider: StubProvider,
      scheduler: ManualScheduler,
    ): Promise<MailboxSession> {
      const session = createMailboxSession(createProviderManager([provider]), scheduler);
      return session.open().then(() => session);
    }

    /** The verdict map of a checked or failed inbox, failing loudly if there is none. */
    function inboxVerdicts(session: MailboxSession): ReadonlyMap<string, MessageVerdict> {
      const state = session.current();
      if (!isReady(state)) throw new Error(`expected a ready session, got ${state.kind}`);
      const inbox = state.inbox;
      if (inbox.kind !== "checked" && inbox.kind !== "checkFailed") {
        throw new Error(`expected a listing, got ${inbox.kind}`);
      }
      return inbox.listing.verdicts;
    }

    it("reports nothing open before anything has been asked for", async () => {
      const session = await readySession(stubProvider("guerrilla"), manualScheduler());

      expect(openedOf(session.current())).toEqual({ kind: "none" });
      // And on the state a client actually reads, not only through the helper — the
      // helper could be reading a field the client does not have.
      const state = session.current();
      if (!isReady(state)) throw new Error(`expected ready, got ${state.kind}`);
      expect(state.opened).toEqual({ kind: "none" });
    });

    it("reports that a message is being opened, before the provider answers", async () => {
      // **Written because the requirement was verified one layer too low.**
      //
      // The `mailbox-session` delta says "*the session* SHALL report that the message is
      // being opened before the provider has answered", and the only test of that was in
      // `opened.test.ts`, asserting the *tracker's* own `onChange`. Nothing observed
      // `opening` on `session.current()` or through `subscribe`. The two are separate
      // code paths — the session republishes through `withOpened` — so a change there
      // that stopped publishing the intermediate state would have left the suite green
      // while a real user never saw "Reading this message…".
      //
      // Found by the independent verification pass. It is a *coverage* gap rather than a
      // defect: the behaviour was correct, and this test is what makes it correct rather
      // than merely correct today.
      const summary = makeSummary("a", "mailbox");
      const provider = stubProvider("guerrilla", {
        messages: {
          summaries: [summary],
          bodies: { a: CODE_BODY },
          // **The verdict pass fails, which is what leaves nothing retained.** A message
          // the inbox read successfully is served from memory and takes the fast path,
          // which deliberately publishes no `opening` — there is nothing to wait for. So
          // reaching the path that *does* wait needs a message with no retained reading,
          // and an unreadable one is the realistic way to get there: the user clicks retry.
          //
          // **Two entries, because the last one repeats.** A queue of `[unreachable()]`
          // fails *every* read — which is the shape `readFailsWith` was built for, and why
          // its own documentation says so. The retry here needs the second read to
          // succeed, or this test would be about a message that never becomes readable and
          // the `opening` transition would be the only thing worth asserting.
          readFailsWith: [unreachable(), undefined],
        },
      });
      const session = createMailboxSession(createProviderManager([provider]), manualScheduler());
      const seen: SessionState[] = [];
      session.subscribe((next) => seen.push(next));
      await session.open();

      await session.checkInbox();
      // The premise, asserted: nothing was retained, so the open below must fetch.
      expect(provider.reads).toEqual(["a"]);

      /** The `opened` kind of each state a subscriber was told about. */
      const openedKinds = (): string[] =>
        seen.map((state) => (state.kind === "failed" ? "none" : state.opened.kind));

      seen.length = 0;
      const pending = session.openMessage("a");

      // **Read synchronously, before awaiting.** The whole point of the transition is
      // that it happens while the request is in flight; a test that awaited first would
      // see only the settled state and pass for the wrong reason.
      //
      // **The count is half the assertion.** `["opening", "opening"]` is what this saw
      // before `onChange` stopped wrapping `withOpened` in a second `setState`: one
      // subscriber, told the same thing twice, because `withOpened` publishes and its
      // caller published again. A React client re-rendered per notification, so this was
      // a real defect rather than a cosmetic one — and it was invisible to every
      // assertion that asked only *what* the session reported, never *how often*.
      expect(openedKinds()).toEqual(["opening"]);
      // And `current()` agrees with what the subscriber was told.
      expect(openedOf(session.current())).toEqual({ kind: "opening", messageId: "a" });

      const settled = await pending;
      expect(settled.kind).toBe("opened");
      // **One notification per change, end to end.**
      expect(openedKinds()).toEqual(["opening", "opened"]);
      // The retry is the second read of one body.
      expect(provider.reads).toEqual(["a", "a"]);
    });

    it("opens a message the inbox already read, without a second read", async () => {
      // **The one read, not two.** The inbox's verdict pass read this body to decide
      // whether it carries a code; opening it must not spend a request to recompute an
      // answer already in hand.
      const summary = makeSummary("a", "mailbox");
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [summary], bodies: { a: CODE_BODY } },
      });
      const session = await readySession(provider, manualScheduler());

      await session.checkInbox();
      // The verdict pass reads once. Nothing else has read anything.
      expect(provider.reads).toEqual(["a"]);

      const state = session.current();
      if (!isReady(state)) throw new Error(`expected ready, got ${state.kind}`);
      const opened = await session.openMessage("a");

      expect(opened.kind).toBe("opened");
      // **Asserted on the session's own state too**, because `openMessage` resolving
      // with a message while `current()` still says `none` would be a client that
      // renders nothing after a successful click.
      const after = session.current();
      if (!isReady(after)) throw new Error(`expected ready, got ${after.kind}`);
      expect(after.opened.kind).toBe("opened");
      expect(provider.reads).toEqual(["a"]);
    });

    it("keeps a message open across a later inbox check", async () => {
      // **Written because a mutation proved nothing asserted this, and because the
      // first version of this comment got the mechanism wrong.**
      //
      // Two republish paths exist when the inbox moves, and they are not the same:
      //
      // - `withInbox`, which reads `opened.state`, called only from `open()` — once
      //   at the start of a replacement and once with its result.
      // - the inbox tracker's `onChange`, `setState({ ...state, inbox: next })`, which
      //   is what every poll tick goes through.
      //
      // A first draft of this test mutated `withInbox` to report `{ kind: "none" }`, on
      // the reasoning that it is the function that publishes `opened`. That mutation
      // turned no test red, and the reason is worth recording: **the poller does not
      // go through `withInbox` at all.** The path that can actually drop an open message
      // is the spread inside `onChange`, and it is right only because it spreads `state`
      // rather than rebuilding the object, so `opened` rides along untouched. Rewrite it
      // as an explicit literal and every tick would close the message on screen — with
      // no provider error and no user action.
      //
      // So the mutation that matters targets `onChange`, and this test is what it lands
      // on. It is the recorded sixth instance in this repository of a check narrower
      // than the rule it documented, and the first found by aiming a mutation at a line
      // rather than at a requirement — which is also how that mutation came to be aimed
      // at the wrong line in the first place.
      const summary = makeSummary("a", "mailbox");
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [summary], bodies: { a: CODE_BODY } },
      });
      const session = await readySession(provider, manualScheduler());

      await session.checkInbox();
      const opened = await session.openMessage("a");
      if (opened.kind !== "opened") throw new Error(`expected opened, got ${opened.kind}`);

      // **A later successful check**, which is the path that republishes with the
      // tracker's state — not a second open, which is a different code path entirely
      // (`withOpened`) and would have passed either way.
      await session.checkInbox();

      const state = session.current();
      if (!isReady(state)) throw new Error(`expected ready, got ${state.kind}`);
      expect(state.opened.kind).toBe("opened");
      if (state.opened.kind !== "opened") {
        throw new Error(`expected opened, got ${state.opened.kind}`);
      }
      expect(state.opened.message.id).toBe(summary.id);

      // **And the same through a scheduled turn**, because the loop calls the same
      // republish on its own initiative — a caller-driven check and a scheduled one are
      // the same assertion here, and saying so keeps the next change honest.
      await session.checkInbox();
      const scheduled = session.current();
      if (!isReady(scheduled)) throw new Error(`expected ready, got ${scheduled.kind}`);
      expect(scheduled.opened.kind).toBe("opened");
    });

    it("shows the codes and links the inbox already found", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [makeSummary("a", "mailbox")], bodies: { a: BOTH_BODY } },
      });
      const session = await readySession(provider, manualScheduler());

      await session.checkInbox();
      const opened = await session.openMessage("a");

      if (opened.kind !== "opened") throw new Error(`expected opened, got ${opened.kind}`);
      expect(opened.message.codes.map((code) => code.value)).toEqual(["492187"]);
      expect(opened.message.links.map((link) => link.hostname)).toEqual(["verify.example"]);
    });

    it("refuses an identifier the mailbox does not list, and asks no provider", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [makeSummary("a", "mailbox")], bodies: { a: CODE_BODY } },
      });
      const session = await readySession(provider, manualScheduler());

      await session.checkInbox();
      const before = provider.readCalls;

      const opened = await session.openMessage("not-a-message-here");

      expect(opened.kind).toBe("openFailed");
      expect(provider.readCalls).toBe(before);
    });

    it("clears what is open when the mailbox is replaced", async () => {
      const summary = makeSummary("a", "mailbox");
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [summary], bodies: { a: CODE_BODY } },
      });
      const session = await readySession(provider, manualScheduler());
      await session.checkInbox();
      await session.openMessage("a");

      const before = session.current();
      if (!isReady(before)) throw new Error(`expected ready, got ${before.kind}`);
      expect(before.opened.kind).toBe("opened");
      const readsBefore = provider.readCalls;

      await session.open();

      // **The hazard `design.md` D1 exists to prevent.** Message ids are
      // provider-scoped, so the new mailbox could list a message with the same id and
      // the previous mailbox's body would be shown beside it. One owner makes the
      // mailbox change clear it for free; a client-held selection would have to
      // remember, and `useMailboxSession` is a binding that deliberately holds no
      // judgements of its own.
      const after = session.current();
      if (!isReady(after)) throw new Error(`expected ready, got ${after.kind}`);
      expect(after.opened).toEqual({ kind: "none" });

      // And the retention went with it: the same id on the new mailbox is read, not
      // served from the previous mailbox's reading.
      await session.checkInbox();
      await session.openMessage("a");
      expect(provider.readCalls).toBeGreaterThan(readsBefore);
    });

    it("says nothing is open while a replacement is being created", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [makeSummary("a", "mailbox")], bodies: { a: CODE_BODY } },
      });
      const session = await readySession(provider, manualScheduler());
      await session.checkInbox();
      await session.openMessage("a");

      // **Mid-flight, not after.** The `creating` state is the one a client renders
      // while the request is in the air, and it is exactly when the previous mailbox's
      // message must already be off the screen — a user who watched the old message
      // vanish a second after the button was pressed has seen a lie.
      const pending = session.open();
      const during = session.current();

      expect(during.kind).toBe("creating");
      expect(openedOf(during)).toEqual({ kind: "none" });

      await pending;
    });

    it("closes whatever is open, on request", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [makeSummary("a", "mailbox")], bodies: { a: CODE_BODY } },
      });
      const session = await readySession(provider, manualScheduler());
      await session.checkInbox();
      await session.openMessage("a");

      session.closeMessage();

      const state = session.current();
      if (!isReady(state)) throw new Error(`expected ready, got ${state.kind}`);
      expect(state.opened).toEqual({ kind: "none" });
    });

    it("closes nothing that was never open, harmlessly", async () => {
      const session = await readySession(stubProvider("guerrilla"), manualScheduler());

      session.closeMessage();

      // **Called on unmount by a page that never opened anything** — an effect
      // cleanup does not know whether the user got as far as opening a message, and a
      // second call must not throw or leave a state behind.
      session.closeMessage();
      expect(openedOf(session.current())).toEqual({ kind: "none" });
    });

    /**
     * **Closing a message does not make the session forget it, and this case holds the wiring.**
     *
     * `opened.test.ts` proves the tracker keeps its reading across a close; nothing proved the
     * *session* called that method rather than the one that discards. The case above it asserted
     * only the published state, which both methods produce — which is how `closeMessage` reaching
     * `reset` stayed invisible to the whole unit tier while costing a provider request every time
     * somebody closed a message and opened it again. Found by `in-page-fill`'s browser case,
     * counting `/messages/{id}` requests in recorded traffic.
     *
     * **Counted on the provider rather than on the session**, because the defect was never in what
     * the session reported: both methods report the same thing, and only one of them is expensive.
     */
    it("re-opens a message it closed without asking the provider for it again", async () => {
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [makeSummary("a", "mailbox")], bodies: { a: CODE_BODY } },
      });
      const session = await readySession(provider, manualScheduler());
      await session.checkInbox();

      await session.openMessage("a");
      expect(provider.readCalls).toBe(1);

      session.closeMessage();
      const again = await session.openMessage("a");

      // **The positive control is the count above**, established before the close, so a session
      // that simply never reads anything would be caught here rather than by the zero below.
      expect(provider.readCalls).toBe(1);
      if (!isMessageOpened(again)) {
        throw new Error(`expected an opened message, got ${again.kind}`);
      }
      expect(again.message.id).toBe("a");
    });

    it("reads again once a message has left the listing and come back", async () => {
      // **The one path where opening costs a request, and it is a deliberate one.**
      // The inbox's verdict for a message is sticky — slice 2's requirement says it
      // survives — so a message that leaves the listing and returns is *not* re-read
      // for its verdict. Its retention was shed, though, because a body is neither
      // cheap nor idempotent. Opening it therefore reads, which is the correct
      // trade and is worth having a test that says so.
      const a = makeSummary("a", "mailbox");
      const provider = stubProvider("guerrilla", {
        messages: {
          summaries: [a],
          bodies: { a: CODE_BODY },
          listings: [[a], [], [a]],
        },
      });
      const scheduler = manualScheduler();
      const session = await readySession(provider, scheduler);

      await session.checkInbox();
      await session.openMessage("a");
      expect(provider.reads).toEqual(["a"]);

      // `a` leaves.
      await session.checkInbox();
      // And comes back. The verdict is already known, so this listing reads nothing.
      await session.checkInbox();
      expect(provider.reads).toEqual(["a"]);

      const before = provider.readCalls;
      const opened = await session.openMessage("a");

      expect(opened.kind).toBe("opened");
      expect(provider.readCalls).toBe(before + 1);
    });

    it("keeps a verdict for a message its reading has shed", async () => {
      const a = makeSummary("a", "mailbox");
      const provider = stubProvider("guerrilla", {
        messages: { summaries: [a], bodies: { a: CODE_BODY }, listings: [[a], []] },
      });
      const session = await readySession(provider, manualScheduler());

      await session.checkInbox();
      expect(verdictFor(inboxVerdicts(session), "a")).toEqual({
        kind: "carriesCode",
      });

      await session.checkInbox();

      // **Asymmetric on purpose: the cheap half is kept, the expensive half is shed.**
      // A verdict is one word and already the answer; a readable body is neither. If a
      // future change sheds both, this fails — and if it keeps both, the
      // request-count assertion in the previous test fails.
      expect(verdictFor(inboxVerdicts(session), "a")).toEqual({
        kind: "carriesCode",
      });
    });

    it("keeps its readings when a listing fails, because it learned nothing", async () => {
      // **Both of this fixture's details were wrong before the independent verification
      // pass pointed at them, and the test still passed.** `listFailsWith` takes
      // precedence over `listings` and its queue's last entry repeats, so
      // `listings: [[a], []]` with `listFailsWith: [undefined, unreachable()]` means
      // *listing one succeeds and listings two and three both fail* — the empty listing
      // at index 1 was never served. The comments described the opposite sequence: the
      // second check emptying the mailbox, the third failing.
      //
      // Worse, nothing asserted that the listing failed. Deleting `listFailsWith`
      // entirely would have left every assertion here green, because a second listing
      // serving `[a]` prunes to `[a]` and sheds nothing either way — so the test could
      // not tell the rule it names from the rule that shares its fixture. The premise is
      // now asserted, which is what makes the read count at the bottom mean anything.
      const a = makeSummary("a", "mailbox");
      const provider = stubProvider("guerrilla", {
        messages: {
          summaries: [a],
          bodies: { a: CODE_BODY },
          // **One listing entry, and it is served once.** The queue above succeeds on the
          // first check and fails on every one after, which is the shape this test is
          // about. There is no second `listings` entry because none is ever reached.
          listings: [[a]],
          listFailsWith: [undefined, unreachable()],
        },
      });
      const session = await readySession(provider, manualScheduler());

      await session.checkInbox();
      // The verdict pass read the one message, and its analysis is what would be shed.
      expect(provider.reads).toEqual(["a"]);

      await session.checkInbox();

      // **The premise, asserted.** Pruning against a listing that was never received
      // would shed readings for a mailbox the product merely failed to ask.
      const failed = session.current();
      if (!isReady(failed)) throw new Error(`expected ready, got ${failed.kind}`);
      expect(failed.inbox.kind).toBe("checkFailed");
      if (failed.inbox.kind !== "checkFailed") {
        throw new Error(`expected checkFailed, got ${failed.inbox.kind}`);
      }
      // **And the listing is still reported**, because a failed check learned nothing
      // about what arrived — only that the product does not know right now.
      expect(failed.inbox.listing.messages.map((each) => each.id)).toEqual([a.id]);

      const before = provider.readCalls;
      const opened = await session.openMessage("a");

      // Served from the reading the failed check did not discard, with no request.
      expect(opened.kind).toBe("opened");
      expect(provider.readCalls).toBe(before);
    });
  });
});
