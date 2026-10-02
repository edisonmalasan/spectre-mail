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

import { createMailboxSession, isCreating, isFailed, isReady } from "./index";
import type { SessionState } from "./index";
import {
  FIXED_NOW,
  makeMailbox,
  manualScheduler,
  recordingTransport,
  stubProvider,
  throttled,
  unreachable,
} from "./test-support";

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
    it("starts as creating, and says so rather than inventing a mailbox", () => {
      const session = createMailboxSession(
        createProviderManager([stubProvider("guerrilla")]),
        manualScheduler(),
      );

      expect(session.current()).toEqual({ kind: "creating" });
      expect(isCreating(session.current())).toBe(true);
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
      expect(Object.keys(session.current())).toEqual(["kind"]);

      await ready;
      // Three keys now, not two: `inbox` arrived with slice 2 and belongs to `ready`
      // and only to `ready`, which is what the next assertion is for. Written as an
      // exact set rather than a subset so that a `failure` key appearing here - the
      // original defect this test exists for - cannot pass by being unmentioned.
      expect(Object.keys(session.current()).sort()).toEqual(["inbox", "kind", "mailbox"]);
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
      // render one transition behind for as long as it lived.
      expect(seen).toEqual([{ kind: "creating" }]);
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
});
