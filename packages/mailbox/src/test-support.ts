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

import { createMailbox, createMessageSummary, NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox, MessageSummary, ProviderId, SpectreError } from "@spectre-mail/core";
import type { MailProvider, ProviderHealth } from "@spectre-mail/providers";

import type { MailboxScheduler } from "./clock";

/**
 * A fixed instant, so no assertion in this package depends on the wall clock.
 *
 * Written with `Date.UTC` rather than `Date.parse` for a boundary reason rather than
 * a stylistic one: the clock scan in `tests/architecture/boundaries.test.ts` matches
 * `Date.parse` because a package that parses a timestamp out of a string is one step
 * from deciding how long a mailbox has been alive, which is exactly the inference
 * `provider-abstraction` forbids. `Date.UTC` is date arithmetic - it reads no clock
 * and returns the same number forever - so a fixture can pin an instant without
 * giving the package a way to ask what time it is.
 */
export const FIXED_NOW = Date.UTC(2026, 9, 2, 12, 0, 0);

export interface StubOptions {
  /** A fixed mailbox to return instead of a generated one. */
  readonly mailbox?: Mailbox;
  /** What `createMailbox` rejects with, when it should fail. */
  readonly failWith?: SpectreError;
  /** What `checkHealth` resolves to. */
  readonly health?: ProviderHealth;
  /** What the mailbox holds, and whether listing it should fail. */
  readonly messages?: StubMessages;
}

/** What a stub's mailbox holds. */
export interface StubMessages {
  /** What `listMessages` reports, in order. Default: an empty mailbox. */
  readonly summaries?: readonly MessageSummary[];
  /**
   * Bodies by message id.
   *
   * An id with no entry here makes `getMessage` reject. That is the shape a stub
   * needs for "the listing worked but this one body could not be read", which is a
   * different condition from "the listing failed" and produces a different verdict.
   */
  readonly bodies?: Readonly<Record<string, string>>;
  /**
   * What `listMessages` rejects with, when listing should fail.
   *
   * A **single** error fails every call; a **queue** of them is consulted one entry
   * per call, where `undefined` means "succeed this time". The queue is what makes
   * "fails once, then recovers" expressible, which is the shape both the throttle
   * floor and a transient network failure need in order to be tested at all.
   */
  readonly listFailsWith?: SpectreError | readonly (SpectreError | undefined)[];
  /**
   * A non-`SpectreError` throw from `listMessages`.
   *
   * No adapter produces one - every adapter throws a structured `SpectreError` - so
   * this exists solely to cover the session's handling of a throwable it cannot
   * recognise. That branch is defensive code, and defensive code with no test is
   * code whose behaviour nobody knows.
   */
  readonly listThrows?: unknown;
  /**
   * Swap the listing from one call to the next.
   *
   * Needed because a stub with a fixed listing can never show mail *arriving*, and
   * an inbox whose contents never change is exactly the case where a poller's
   * backoff and reset logic is untested. Given as a queue; the last entry repeats
   * once the queue runs out, so a test can describe "empty, then one message" without
   * saying what happens afterwards.
   */
  readonly listings?: readonly (readonly MessageSummary[])[];
}

export interface StubProvider extends MailProvider {
  /** Every mailbox this stub was asked to create, in order. */
  readonly created: readonly Mailbox[];
  /** How many times `createMailbox` was called. */
  readonly createCalls: number;
  /** How many times `checkHealth` was called. */
  readonly healthCalls: number;
  /** How many times `listMessages` was called. */
  readonly listCalls: number;
  /** The message ids `getMessage` was asked for, in order. A copy on every read. */
  readonly reads: readonly string[];
  /**
   * The mailbox ids `listMessages` was asked about, in order.
   *
   * A copy on every read, for the same reason `reads` is one. This is the only way a
   * test can see *which mailbox* a request was made on behalf of, which is what
   * "no request for the mailbox it discarded" actually means - counting calls would
   * pass just as happily if every one of them were for a mailbox already thrown away.
   */
  readonly listedFor: readonly string[];
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
  return throttledStating("1; w=60", provider);
}

/**
 * A throttled failure whose statement is `statement`.
 *
 * Written as its own constructor rather than by spreading `throttled()` because
 * `rateLimit` exists on only some members of the `SpectreError` union, so spreading
 * one and overriding the field widens the result to a shape no member has.
 */
export function throttledStating(
  statement: string,
  provider: ProviderId = "guerrilla",
): SpectreError {
  return {
    code: NormalizedErrorCode.RATE_LIMITED,
    provider,
    description: "Rate limited; try again shortly.",
    rateLimit: statement,
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
  const reads: string[] = [];
  const listedFor: string[] = [];
  let createCalls = 0;
  let healthCalls = 0;
  let listCalls = 0;

  const messages = options.messages ?? {};

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
    get listCalls() {
      return listCalls;
    },
    get reads(): readonly string[] {
      return [...reads];
    },
    get listedFor(): readonly string[] {
      return [...listedFor];
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
    listMessages: async (mailbox) => {
      listCalls += 1;
      listedFor.push(mailbox.id);

      if (messages.listThrows !== undefined) throw messages.listThrows;

      const failure = refusalFor(messages.listFailsWith, listCalls);
      if (failure !== undefined) throw failure;

      const queue = messages.listings;
      if (queue !== undefined && queue.length > 0) {
        const index = Math.min(listCalls - 1, queue.length - 1);
        return [...(queue[index] ?? [])];
      }
      return [...(messages.summaries ?? [])];
    },
    getMessage: async (mailbox, messageId) => {
      reads.push(messageId);
      const body = messages.bodies?.[messageId];
      if (body === undefined) {
        throw new Error(`no body recorded for ${messageId}`);
      }

      const summary = (messages.summaries ?? []).find((candidate) => candidate.id === messageId);
      const base = summary ?? makeSummary(messageId, mailbox.id);

      // The detector fields are filled the way an adapter fills them - from the
      // parser, over the message's own text - so a fixture cannot present a verdict
      // the parser would not have produced.
      return { ...base, text: body, verificationCodes: [], verificationLinks: [] };
    },
  };
}

/**
 * Which refusal, if any, the `callNumber`-th listing should throw.
 *
 * One entry per call, with the last entry repeating - so a test can say "fails once,
 * then succeeds" by writing two entries and never has to describe what happens
 * afterwards.
 */
function refusalFor(
  declared: SpectreError | readonly (SpectreError | undefined)[] | undefined,
  callNumber: number,
): SpectreError | undefined {
  if (declared === undefined) return undefined;
  if (!Array.isArray(declared)) return declared as SpectreError;

  const index = Math.min(callNumber - 1, declared.length - 1);
  return declared[index];
}

/**
 * A synthetic message summary.
 *
 * Built with `core`'s own `createMessageSummary`, so a test fixture goes through the
 * same invariant-enforcing constructor an adapter does rather than around it. The
 * address is a reserved `.example` domain: nothing in this repository can be mistaken
 * for a real message, and nothing here was captured from a real service.
 */
export function makeSummary(
  id: string,
  mailboxId = "mailbox",
  overrides: Partial<MessageSummary> = {},
): MessageSummary {
  return createMessageSummary({
    id,
    mailboxId,
    from: `sender-${id}@mail.example`,
    subject: `Subject for ${id}`,
    receivedAt: FIXED_NOW,
    ...overrides,
  });
}

/**
 * A synthetic message body for a message that carries nothing verifiable.
 *
 * Written out rather than generated so a fixture intended to be negative cannot
 * accidentally contain a code-shaped number.
 */
export const NEUTRAL_BODY = "Hello. This message is ordinary correspondence.";

/** A body whose only interesting content is a one-time code. */
export const CODE_BODY = "Your verification code is 492187. It expires in 10 minutes.";

/** A body carrying only a verification link. */
export const LINK_BODY =
  '<p>Confirm your address: <a href="https://verify.example/confirm?t=abc123">Verify email address</a></p>';

/**
 * A body carrying both, which is the ordinary shape of verification mail.
 *
 * Separate from {@link CODE_BODY} and {@link LINK_BODY} so a test can tell a verdict
 * that noticed the link from one that did not.
 */
export const BOTH_BODY = `${CODE_BODY} ${LINK_BODY}`;

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
 * Nothing in this file names a provider's wire format, and `test-support.ts` is where
 * that is enforced rather than asserted.
 *
 * **The polling test's recorded answers were written here first, and the wire-format
 * rule caught them** - `get_email_address`, `email_addr`, `sid_token`, `list` are all
 * provider field names, and `test-support.ts` is not a `.test.ts` file so the rule's
 * test exemption does not cover it. That is the rule working exactly as intended: a
 * helper shared by tests is still shipped source, and a provider field name in it
 * would be a wire format in a package that has no business holding one.
 *
 * The answers therefore live in `session.test.ts`, which is the only file that uses
 * them and which the rule exempts for the same reason every other test is exempt: a
 * test has to be able to name what it is exercising.
 */

/**
 * A scheduler that runs nothing until a test says so.
 *
 * **The point of it is that no test waits.** The real alternatives are both bad:
 * fake timers make a test's outcome depend on the runner's timer implementation, and
 * real waits make correctness a function of how slow the machine is. Here a test
 * asserts *which* delay was asked for and then decides when to honour it, so the
 * cadence is checked as a number rather than inferred from elapsed time.
 *
 * `scheduled` is a snapshot for the same reason `requests` is: a test that captures
 * it before an action and compares it after must not be holding a live array that
 * the action appends to.
 */
export interface ManualScheduler extends MailboxScheduler {
  /** The delays asked for so far, in order. A copy on every read. */
  readonly scheduled: readonly number[];
  /** The delay asked for most recently, or `undefined` if nothing is pending. */
  readonly lastDelay: number | undefined;
  /** How many callbacks are currently pending. */
  readonly pending: number;
  /** Run the pending callback, and wait for the whole chain it starts. */
  run(): Promise<void>;
  /** How many times `run` has been called, whether or not anything was pending. */
  readonly runs: number;
}

export function manualScheduler(): ManualScheduler {
  const delays: number[] = [];
  let queue: (() => void)[] = [];
  let runs = 0;

  return {
    get scheduled(): readonly number[] {
      return [...delays];
    },
    get lastDelay(): number | undefined {
      return delays.at(-1);
    },
    get pending(): number {
      return queue.length;
    },
    get runs(): number {
      return runs;
    },

    schedule(afterMs, run) {
      delays.push(afterMs);
      queue.push(run);
      // A handle that removes this exact entry, so cancelling one of several pending
      // callbacks leaves the others alone - and so cancelling twice is harmless,
      // because the requirement for `Cancel` promises exactly that.
      let cancelled = false;
      return () => {
        if (cancelled) return;
        cancelled = true;
        queue = queue.filter((queued) => queued !== run);
      };
    },

    async run() {
      runs += 1;
      const next = queue.shift();
      if (next === undefined) return;

      // **Awaited, rather than drained by guessing.** `MailboxScheduler` types the
      // callback as `() => void`, so the promise it actually returns is invisible at
      // the type level - and the alternative, awaiting a fixed number of
      // `Promise.resolve()`s, is a guess at how many `await`s deep the poller is. That
      // guess was wrong while this file was being written: four cadence assertions
      // read state from *before* the request they had just triggered, because three
      // microtask turns were not enough. Awaiting the real promise makes it exact,
      // and it stays exact if the poller's internals change.
      await (next as () => unknown)();
    },
  };
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
export function recordingTransport(
  options: {
    /**
     * How to answer a recorded request. Omitted means the bare `503` above, which is
     * the right default for a test whose session never successfully opens.
     */
    readonly respond?: (url: string) => {
      status: number;
      headers: Record<string, string>;
      body: string;
    };
  } = {},
): RecordingTransport {
  const requests: string[] = [];

  return {
    get requests(): readonly string[] {
      return [...requests];
    },
    transport: (request) => {
      requests.push(`${request.method} ${request.url}`);
      return Promise.resolve(
        options.respond === undefined
          ? { status: 503, headers: {}, body: "" }
          : options.respond(request.url),
      );
    },
    reset: () => {
      requests.length = 0;
    },
  };
}
