/**
 * Stubs shared by this package's tests.
 *
 * A stub provider rather than a real adapter on purpose: `packages/providers`
 * already proves what a real adapter does with a recorded response, and
 * duplicating a fixture here would create a second copy of a provider's wire
 * format that could drift from the first with nothing noticing.
 *
 * Mailboxes are built with `core`'s own `createMailbox`, not by writing the object
 * literal out here, so these tests go through the same invariant-enforcing
 * constructor an adapter does rather than around it.
 *
 * @module
 */

import { createMailbox, NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, ProviderId, SpectreError } from "@spectre-mail/core";
import type { MailProvider, ProviderHealth } from "@spectre-mail/providers";

/** A fixed instant, so no assertion in this package depends on the wall clock. */
export const FIXED_NOW = Date.parse("2026-10-02T12:00:00.000Z");

export interface StubOptions {
  /** A fixed mailbox to return instead of a generated one. */
  readonly mailbox?: Mailbox;
  /** What `createMailbox` rejects with, when it should fail. */
  readonly failWith?: SpectreError;
  /** What `checkHealth` resolves to. */
  readonly health?: ProviderHealth;
}

export interface StubProvider extends MailProvider {
  /** Every mailbox this stub was asked to create, in order. */
  readonly created: readonly Mailbox[];
  /** How many times `createMailbox` was called. */
  readonly createCalls: number;
  /** How many times `checkHealth` was called. */
  readonly healthCalls: number;
}

/** A mailbox whose address is derived from `id`, so a test can tell them apart. */
export function makeMailbox(id: string, provider: ProviderId = "guerrilla"): Mailbox {
  return createMailbox({
    id,
    address: `${id}@mail.example`,
    createdAt: FIXED_NOW,
    credentials:
      provider === "guerrilla"
        ? { provider: "guerrilla", sessionId: `session-${id}` }
        : { provider: "mailtm", accountId: `account-${id}`, accessToken: `token-${id}` },
  });
}

/**
 * A mailbox with a provider-reported expiry.
 *
 * Exists so the "renders an expiry when the provider reports one" control has
 * something real to render. A synthetic `.example` address, so no test in this
 * repository can be mistaken for a real address.
 */
export function makeMailboxExpiringAt(id: string, expiresAt: number): Mailbox {
  return createMailbox({
    id,
    address: `${id}@mail.example`,
    createdAt: FIXED_NOW,
    expiresAt,
    credentials: { provider: "guerrilla", sessionId: `session-${id}` },
  });
}

/** A throttled failure carrying a measured rate-limit value, verbatim. */
export function throttled(provider: ProviderId = "guerrilla"): SpectreError {
  return {
    code: NormalizedErrorCode.RATE_LIMITED,
    provider,
    description: "Rate limited; try again shortly.",
    rateLimit: "1; w=60",
  };
}

/** An unreachable provider. */
export function unreachable(provider: ProviderId = "guerrilla"): SpectreError {
  return {
    code: NormalizedErrorCode.PROVIDER_UNAVAILABLE,
    provider,
    description: "The provider could not be reached.",
  };
}

/**
 * A stub provider with call counts.
 *
 * `supports` returns `false` for everything: neither provider was measured to
 * offer either destructive operation, and a stub that claimed otherwise would let
 * a test pass on a capability no adapter has.
 */
export function stubProvider(id: ProviderId, options: StubOptions = {}): StubProvider {
  const created: Mailbox[] = [];
  let createCalls = 0;
  let healthCalls = 0;

  return {
    id,
    displayName: id,
    created,
    get createCalls() {
      return createCalls;
    },
    get healthCalls() {
      return healthCalls;
    },
    supports: () => false,
    checkHealth: async () => {
      healthCalls += 1;
      return options.health ?? { provider: id, status: "ok" };
    },
    createMailbox: async () => {
      createCalls += 1;
      const mailbox = options.mailbox ?? makeMailbox(`${id}-${createCalls}`, id);
      created.push(mailbox);
      if (options.failWith !== undefined) {
        throw options.failWith;
      }
      return mailbox;
    },
    listMessages: () => Promise.resolve([]),
    getMessage: () => Promise.reject(new Error("unused")),
  };
}

/**
 * A transport that records every URL it is asked to fetch.
 *
 * `requests` is a **snapshot, not a live view** - see `recordingTransport` for why
 * that distinction is the whole point of this helper.
 */
export interface RecordingTransport {
  /** A copy of the requests recorded so far. */
  readonly requests: readonly string[];
  /** The adapter-facing transport function. */
  readonly transport: (
    request: import("@spectre-mail/providers").TransportRequest,
  ) => Promise<import("@spectre-mail/providers").TransportResponse>;
  reset: () => void;
}

/**
 * A transport that records the URLs it is asked for and answers `503`.
 *
 * The `503` is deliberate. The tests using this assert only on **which requests
 * were made**, so an adapter's ability to read a body cannot make them pass or
 * fail by accident, and no provider's response format has to be written here.
 *
 * **`requests` is a getter that hands back a copy, and that is load-bearing.**
 * It was previously the live array, so `const before = recorder.requests` aliased
 * it, `reset()` emptied the alias in place, and the comparison after the reset was
 * the array against itself - which passes no matter how many requests the session
 * made. That is not a hypothetical: the mutation that doubled the number of
 * mailbox creations went undetected through exactly that route, on the one
 * assertion guarding `mailbox-session`'s "reaches no network directly".
 *
 * A snapshot removes the whole class rather than the one mistake: any value a test
 * holds is detached from the recorder, so `reset()` cannot retroactively change
 * what "before" meant. Returning a fresh array on every read is the fix; a comment
 * asking callers to spread it would be a rule someone forgets.
 */
export function recordingTransport(): RecordingTransport {
  const requests: string[] = [];

  return {
    get requests(): readonly string[] {
      return [...requests];
    },
    transport: (request) => {
      requests.push(`${request.method} ${request.url}`);
      return Promise.resolve({ status: 503, headers: {}, body: "" });
    },
    reset: () => {
      requests.length = 0;
    },
  };
}
