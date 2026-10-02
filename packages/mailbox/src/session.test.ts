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
import { describe, expect, it } from "vitest";

import { createMailboxSession, isCreating, isFailed, isReady } from "./index";
import {
  FIXED_NOW,
  makeMailbox,
  recordingTransport,
  stubProvider,
  throttled,
  unreachable,
} from "./test-support";

describe("createMailboxSession", () => {
  describe("the state it reports", () => {
    it("starts as creating, and says so rather than inventing a mailbox", () => {
      const session = createMailboxSession(createProviderManager([stubProvider("guerrilla")]));

      expect(session.current()).toEqual({ kind: "creating" });
      expect(isCreating(session.current())).toBe(true);
      expect(isReady(session.current())).toBe(false);
      expect(isFailed(session.current())).toBe(false);
    });

    it("carries no field belonging to another variant", () => {
      const session = createMailboxSession(createProviderManager([stubProvider("guerrilla")]));

      // A `ready` state must not also carry a `failure`, and a `failed` state must
      // not carry a `mailbox`. A union built as three loose shapes would pass every
      // other test in this file and still let a client read `state.mailbox` off a
      // failure.
      const ready = session.open();
      expect(Object.keys(session.current())).toEqual(["kind"]);

      return ready.then(() => {
        expect(Object.keys(session.current()).sort()).toEqual(["kind", "mailbox"]);
      });
    });

    it("narrows each variant through its own helper", async () => {
      const session = createMailboxSession(createProviderManager([stubProvider("guerrilla")]));

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
      const session = createMailboxSession(createProviderManager([provider]));

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
      );

      const state = await session.open();

      if (!isFailed(state)) throw new Error("expected a failed state");
      expect(state.failure.description).toBe("Rate limited; try again shortly.");
    });
  });

  describe("replacing the mailbox", () => {
    it("returns a new state and leaves the previous one unchanged", async () => {
      const provider = stubProvider("guerrilla");
      const session = createMailboxSession(createProviderManager([provider]));

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
      const session = createMailboxSession(createProviderManager([provider]));

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
      const session = createMailboxSession(createProviderManager([primary, fallback]));

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
      const session = createMailboxSession(createProviderManager([primary, fallback]));

      await session.open();
      await session.health();

      expect(primary.healthCalls).toBe(1);
      expect(fallback.healthCalls).toBe(0);
    });
  });

  describe("which providers a client offers", () => {
    it("offers only what it was configured with", async () => {
      const session = createMailboxSession(createProviderManager([stubProvider("guerrilla")]));

      expect(session.providers.map((provider) => provider.id)).toEqual(["guerrilla"]);
    });

    it("keeps two clients' configurations apart", async () => {
      const website = createMailboxSession(createProviderManager([stubProvider("guerrilla")]));
      const extension = createMailboxSession(
        createProviderManager([stubProvider("mailtm"), stubProvider("guerrilla")]),
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
      const session = createMailboxSession(createProviderManager([configured]));

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
      const session = createMailboxSession(createProviderManager([primary, fallback]));

      const state = await session.open();
      if (!isReady(state)) throw new Error("expected a ready state");

      expect(session.providerFor(state.mailbox)).toBe(primary);
    });

    it("refuses a mailbox from a provider it was not configured with", () => {
      const session = createMailboxSession(createProviderManager([stubProvider("guerrilla")]));
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
      const session = createMailboxSession(createProviderManager([provider]));

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
      const session = createMailboxSession(createProviderManager([adapter]));
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

    it("cannot be given a transport at all", () => {
      // The absence is the guarantee. `createMailboxSession`'s only parameter is a
      // manager, so there is no parameter through which a transport could be
      // supplied - this assertion documents that and would fail to compile if a
      // second parameter were added.
      expect(createMailboxSession).toHaveLength(1);
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

      const state = await createMailboxSession(empty).open();

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
      await expect(createMailboxSession(empty).health()).rejects.toThrow(/no provider configured/i);
    });
  });
});
