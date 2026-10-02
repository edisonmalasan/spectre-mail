/**
 * The shared conformance suite.
 *
 * One suite, every adapter. It asserts only on **normalized** results, never on
 * an adapter's internals, which differ by design: Mail.tm is Hydra with relative
 * resource URLs, Guerrilla is a parameter-dispatched endpoint with a session in a
 * query string. What must be identical is what comes out.
 *
 * **No per-provider exemption.** That is deliberate and is the reason the suite is
 * worth having: an exemption is the mechanism by which a conformance suite quietly
 * stops meaning anything. If a provider cannot satisfy a behaviour, then either
 * the behaviour is wrong or the provider is not viable - neither is fixed by
 * carving out an exception here. Where a provider genuinely has no measured
 * example of a condition, the recording is a **synthetic** one that is labelled as
 * such at its definition, because the point is to test *our* mapping of that
 * condition rather than to assert the provider produces it.
 *
 * @module
 */

import { NormalizedErrorCode, isSpectreError } from "@spectre-mail/core";
import type { Mailbox, MessageSummary, ProviderId, SpectreError } from "@spectre-mail/core";
import { describe, expect, it } from "vitest";

import type { MailProvider, ProviderOperation } from "./contract";
import type { RecordedStep } from "./recorder";
import type { TransportRequest } from "./transport";

/**
 * A fresh adapter plus the requests it made.
 *
 * The requests are returned rather than kept on a side channel because "the
 * throttled path issued exactly one request" is a core assertion here, and a suite
 * that could not see the requests would be asserting something it had not observed.
 */
export interface ConformanceAdapter {
  readonly adapter: MailProvider;
  readonly requests: readonly TransportRequest[];
}

/**
 * The recordings one provider needs to satisfy the suite.
 *
 * Supplied as data rather than hard-coded here, because the recordings are
 * provider-specific by nature. Everything asserted below is not.
 */
export interface ProviderConformance {
  readonly provider: ProviderId;
  /** Build a fresh adapter replaying `steps` in order. */
  readonly build: (steps: readonly RecordedStep[]) => ConformanceAdapter;
  /** Recordings for creating a mailbox that exists and holds one message. */
  readonly create: readonly RecordedStep[];
  /** Recordings for listing that mailbox. */
  readonly list: readonly RecordedStep[];
  /** Recordings for fetching that mailbox's message. */
  readonly fetch: readonly RecordedStep[];
  /** The message the recordings above contain, whose subject is empty. */
  readonly messageId: string;
  /** Recordings for a session the provider no longer honours. */
  readonly deadSession: readonly RecordedStep[];
  /** Recordings for a request the provider rejects on authentication. */
  readonly authFailure: readonly RecordedStep[];
  /** Recordings for a throttled mailbox creation. */
  readonly throttled: readonly RecordedStep[];
  /** The rate-limit header the throttled recording carries, verbatim. */
  readonly expectedRateLimit: string;
  /** Recordings for a failure matching no known condition. */
  readonly unclassifiable: readonly RecordedStep[];
}

const OPERATIONS: readonly ProviderOperation[] = ["deleteMessage", "destroyMailbox"];

/**
 * Provider field names that must not appear in a normalized value.
 *
 * Read from the measured wire formats in `docs/PROVIDERS.md`. Kept here because
 * this is the adapter's own contract with the shared model;
 * `tests/architecture/boundaries.test.ts` separately enforces the same rule
 * across the rest of the workspace.
 */
const WIRE_FIELD_NAMES: readonly string[] = [
  "@id",
  "hydra:member",
  "sid_token",
  "email_addr",
  "mail_id",
  "mail_body",
  "mail_from",
  "content_type",
  "ratelimit-policy",
  "check_email",
  "fetch_email",
  "get_email_address",
];

export function runProviderConformance(conformance: ProviderConformance): void {
  const { provider } = conformance;

  const create = async (): Promise<Mailbox> =>
    (await conformance.build(conformance.create)).adapter.createMailbox();

  const list = async (mailbox: Mailbox): Promise<MessageSummary[]> =>
    (await conformance.build(conformance.list)).adapter.listMessages(mailbox);

  // Named `readMessage`, not `fetch`. `tests/architecture/boundaries.test.ts` asserts
  // no bare `fetch(` in this package, because a global reference there would bypass
  // the injected transport and make the suite contact a live provider. A local
  // helper is harmless, but calling it `fetch` would mean either a false positive or
  // a suppression comment — and a suppression is how the next real global reference
  // slips through.
  const readMessage = async (mailbox: Mailbox) =>
    (await conformance.build(conformance.fetch)).adapter.getMessage(mailbox, conformance.messageId);

  describe(`${provider} adapter conformance`, () => {
    it("identifies itself by a provider the shared model knows", () => {
      const { adapter } = conformance.build([]);
      expect(adapter.id).toBe(provider);
      expect(adapter.displayName.length).toBeGreaterThan(0);
    });

    it("creates a mailbox whose provider matches its own credentials", async () => {
      const mailbox = await create();

      expect(mailbox.provider).toBe(provider);
      // The correlation is the point of deriving `provider` from the credential
      // discriminant in M2, and this is the first code that produces real
      // mailboxes, so it is asserted where it first matters.
      expect(mailbox.credentials.provider).toBe(provider);
      expect(mailbox.address).toContain("@");
      expect(mailbox.status).toBe("active");

      // No expiry is ever computed. A countdown derived from an assumed lifetime
      // is exactly what `provider-abstraction` forbids.
      expect(mailbox.expiresAt).toBeUndefined();
    });

    it("carries no provider field name out of the adapter", async () => {
      const serialized = JSON.stringify(await create());

      for (const forbidden of WIRE_FIELD_NAMES) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it("answers optional-operation support as a question, not an exception", () => {
      const { adapter } = conformance.build([]);

      for (const operation of OPERATIONS) {
        expect(typeof adapter.supports(operation)).toBe("boolean");
      }
    });

    it("lists a mailbox's messages without their bodies", async () => {
      const mailbox = await create();
      const summaries = await list(mailbox);

      expect(summaries.length).toBeGreaterThan(0);
      for (const summary of summaries) {
        expect(summary.id.length).toBeGreaterThan(0);
        expect(summary.mailboxId).toBe(mailbox.id);
        expect(Number.isNaN(summary.receivedAt)).toBe(false);
        // Required but possibly empty, so only the type is asserted here.
        expect(typeof summary.subject).toBe("string");
        expect(typeof summary.from).toBe("string");
        // Listing must not require fetching a body.
        expect("text" in summary).toBe(false);
      }
    });

    it("preserves a subject the provider sent empty", async () => {
      const mailbox = await create();
      const target = (await list(mailbox)).find((s) => s.id === conformance.messageId);

      expect(target).toBeDefined();
      // Required-but-possibly-empty. A model treating emptiness as absence would
      // discard a message that genuinely arrived.
      expect(target?.subject).toBe("");
      expect(target?.from).not.toBe("");
    });

    it("carries a body as text and emits no markup field", async () => {
      const mailbox = await create();
      const message = await readMessage(mailbox);

      expect(message.text.length).toBeGreaterThan(0);

      // Every key must be one the shared model defines. Asserting the *allowed
      // set* rather than an exact set is deliberate: `fromName` and `unread` are
      // genuinely optional, so an exact list would fail or pass depending on
      // whether a recording happened to include them. A field the model does not
      // define is the thing worth catching — an added `html` or `content` is an
      // invitation to render untrusted provider output.
      const allowed = new Set([
        "id",
        "mailboxId",
        "from",
        "fromName",
        "subject",
        "receivedAt",
        "unread",
        "text",
        "verificationCodes",
        "verificationLinks",
      ]);

      for (const key of Object.keys(message)) {
        expect(allowed.has(key)).toBe(true);
      }

      // Spelled out separately because the failure message should name the field
      // rather than say "some key was not allowed".
      expect(
        Object.keys(message).filter((key) => /html|markup|body|content|richtext/i.test(key)),
      ).toEqual([]);
    });

    it("never reports a rejected credential as success or as a missing message", async () => {
      const mailbox = await create();
      const { adapter } = conformance.build(conformance.authFailure);

      const error = await capture(() => adapter.listMessages(mailbox));

      // Which code this is, the provider decides, and the suite deliberately does
      // not overrule it.
      //
      // For Mail.tm the two situations are genuinely indistinguishable: measured,
      // a deleted mailbox and a bad token **both** answer `401` with the same body.
      // Forcing `AUTH_FAILED` here would make the adapter tell a user to check
      // their credentials for a mailbox that no longer exists — advice for a
      // credential the user never entered and cannot change. So the suite asserts
      // the codes a provider can honestly reach, and the adapter's choice between
      // them is asserted in that adapter's own tests, where the measured evidence
      // for it can be cited.
      //
      // What is asserted here is the part that must hold everywhere: the rejection
      // is reported, it names this provider, and it is not a not-found — a caller
      // must not be told to go looking for a message that is really a credential
      // problem.
      expect(error).toBeDefined();
      expect(error?.provider).toBe(provider);
      expect([NormalizedErrorCode.AUTH_FAILED, NormalizedErrorCode.MAILBOX_EXPIRED]).toContain(
        error?.code,
      );
    });

    it("reports throttling with the provider's own header, unparsed", async () => {
      const { adapter } = conformance.build(conformance.throttled);

      const error = await capture(() => adapter.createMailbox());

      expect(error?.code).toBe(NormalizedErrorCode.RATE_LIMITED);
      // Verbatim. The header states a limit and a window and nothing about what it
      // is per, so `1; w=60` never becomes "per IP" anywhere in this product.
      expect(rateLimitOf(error)).toBe(conformance.expectedRateLimit);
    });

    it("makes exactly one request when throttled", async () => {
      const { adapter, requests } = conformance.build(conformance.throttled);

      const error = await capture(() => adapter.createMailbox());

      expect(error?.code).toBe(NormalizedErrorCode.RATE_LIMITED);
      // The assertion that catches a silent retry loop: two requests where one was
      // expected is the shape of the bug this requirement exists for.
      expect(requests).toHaveLength(1);
    });

    it("keeps the provider's own account of an unclassifiable failure", async () => {
      const mailbox = await create();
      const { adapter } = conformance.build(conformance.unclassifiable);

      const error = await capture(() => adapter.listMessages(mailbox));

      expect(error?.code).toBe(NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR);
      // Required, not optional, on that code. Discarding it would leave the failure
      // undiagnosable and the code useless.
      expect(descriptionOf(error).length).toBeGreaterThan(10);
    });

    it("never reports a dead session as a successful empty inbox", async () => {
      const mailbox = await create();
      const { adapter } = conformance.build(conformance.deadSession);

      // The requirement is about the *absence* of a result, not about a specific
      // code. A provider that honours no session may say so by rejecting, or - the
      // measured Guerrilla case - by answering an empty inbox; the adapter's job is
      // to make the second case an error. So the assertion is that no adapter ever
      // returns a successful empty list here, and it is not written with a branch
      // that can pass by doing nothing.
      const result = await capture(() => adapter.listMessages(mailbox));

      expect(result).toBeDefined();
      // A specific code is asserted, not just "something failed". The point is that
      // the condition is *about the mailbox being unusable*: an adapter that mapped
      // a dead session to an unclassified provider error, or to a throttle, would
      // tell the user to wait or to try again rather than to create a new mailbox.
      expect(result?.code).toBe(NormalizedErrorCode.MAILBOX_EXPIRED);
    });
  });
}

/**
 * Run `operation`, returning the normalized error it produced, or `undefined` if
 * it succeeded.
 *
 * Rethrows anything that is not a {@link SpectreError}. A plain `Error` escaping
 * an adapter is a defect in that adapter, and silently absorbing it here would
 * let the suite report a clean run over a broken one.
 */
async function capture(operation: () => Promise<unknown>): Promise<SpectreError | undefined> {
  try {
    await operation();
    return undefined;
  } catch (cause) {
    if (isSpectreError(cause)) {
      return cause;
    }
    throw cause;
  }
}

function rateLimitOf(error: SpectreError | undefined): string | undefined {
  return error?.code === NormalizedErrorCode.RATE_LIMITED ? error.rateLimit : undefined;
}

function descriptionOf(error: SpectreError | undefined): string {
  return error?.code === NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR ? error.description : "";
}
