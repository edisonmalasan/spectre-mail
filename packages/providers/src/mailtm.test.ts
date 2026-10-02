/**
 * Mail.tm adapter tests.
 *
 * Runs the shared conformance suite, then adds the Mail.tm-specific behaviours the
 * shared suite cannot express — the ones that depend on Hydra's relative resource
 * URLs, on the `seen`/`unread` inversion, or on the distinction between a rejected
 * credential and a deleted mailbox.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";
import { describe, expect, it } from "vitest";

import type { ConformanceAdapter, ProviderConformance } from "./conformance";
import { runProviderConformance } from "./conformance";
import { countingClock, stubEnvironment } from "./environments";
import * as fixtures from "./fixtures";
import { FIXTURE_IDS } from "./fixtures";
import { createMailTmAdapter } from "./mailtm";
import type { RecordedStep } from "./recorder";

const MAILTM = FIXTURE_IDS.mailtm;

function build(steps: readonly RecordedStep[]): ConformanceAdapter {
  const environment = stubEnvironment(steps);
  return { adapter: createMailTmAdapter(environment), requests: environment.requests };
}

const CONFORMANCE: ProviderConformance = {
  provider: "mailtm",
  build,
  create: [fixtures.mailtmDomains, fixtures.mailtmAccountCreated, fixtures.mailtmToken],
  list: [fixtures.mailtmMessageList],
  fetch: [fixtures.mailtmMessageFetched],
  messageId: MAILTM.messageId,
  deadSession: [fixtures.mailtmGoneAfterDelete],
  authFailure: [fixtures.mailtmBadCredentials],
  throttled: [fixtures.mailtmThrottled],
  expectedRateLimit: "1; w=60",
  unclassifiable: [fixtures.mailtmUnclassifiable],
};

runProviderConformance(CONFORMANCE);

describe("Mail.tm adapter", () => {
  it("discovers its domain before creating an account", async () => {
    const environment = stubEnvironment([
      fixtures.mailtmDomains,
      fixtures.mailtmAccountCreated,
      fixtures.mailtmToken,
    ]);

    await createMailTmAdapter(environment).createMailbox();

    // `GET /domains` is `30; w=60` unauthenticated while `POST /accounts` is
    // `1; w=60`. Discovering a domain per operation would spend the unauthenticated
    // window and get a creation throttled for a reason that has nothing to do with
    // the advertised limit.
    expect(environment.requests.map((r) => r.url)).toEqual([
      "https://api.mail.tm/domains?page=1",
      "https://api.mail.tm/accounts",
      "https://api.mail.tm/token",
    ]);
  });

  it("stores the hydrated resource URL as the mailbox id", async () => {
    const mailbox = await createMailbox();

    // Hydra returns `@id` **relative** (`/accounts/{id}`). Following it is the
    // documented requirement; the absolute form is resolved once, here.
    expect(mailbox.id).toBe(MAILTM.resourceUrl);
    expect(mailbox.id).not.toContain("@id");
  });

  it("deletes against the hydrated resource URL rather than a built path", async () => {
    const mailbox = await createMailbox();
    const environment = stubEnvironment([fixtures.mailtmDeleted]);

    await createMailTmAdapter(environment).destroyMailbox!(mailbox);

    const [request] = environment.requests;
    expect(request?.url).toBe(MAILTM.resourceUrl);
    expect(request?.method).toBe("DELETE");

    // **This assertion cannot tell a followed `@id` from a hand-built path**, and
    // no test on this fixture can. For Mail.tm the hydrated resource URL happens to
    // be `https://api.mail.tm/accounts/{uuid}`, which is byte-identical to what a
    // constructed path would produce.
    //
    // Recorded rather than papered over. What is actually guaranteed is that the
    // mailbox id *is* the value the provider returned in `@id`, asserted in the
    // previous test — so the adapter has nothing else to build a path from. If
    // Mail.tm ever changes its URL shape, the delete path follows automatically
    // because nothing in the adapter reconstructs it. A test asserting
    // "did not build the path" would be asserting an unobservable distinction.
  });

  it("exchanges the generated password for a token, never storing it", async () => {
    const environment = stubEnvironment([
      fixtures.mailtmDomains,
      fixtures.mailtmAccountCreated,
      fixtures.mailtmToken,
    ]);

    const mailbox = await createMailTmAdapter(environment).createMailbox();

    const tokenRequest = environment.requests[2];
    expect(tokenRequest?.url).toBe("https://api.mail.tm/token");
    expect(JSON.parse(tokenRequest?.body ?? "{}")).toEqual({
      address: mailbox.address,
      // The password is sent and then dropped: it is a creation artefact, never a
      // stored credential, because a mailbox is kept working with the token.
      password: expect.any(String),
    });
    expect(JSON.stringify(mailbox)).not.toContain("password");
    expect(mailbox.credentials.provider === "mailtm" && mailbox.credentials.accessToken).toBe(
      MAILTM.token,
    );
  });

  it("inverts the provider's `seen` into the model's `unread`", async () => {
    const environment = stubEnvironment([fixtures.mailtmMessageList]);

    const mailbox = await createMailbox();
    const [summary] = await createMailTmAdapter(environment).listMessages(mailbox);

    // The recording carries `seen: false`, so the message is unread. Getting this
    // backwards would mark every new message read and suppress the badge.
    expect(summary?.unread).toBe(true);
  });

  it("leaves `unread` absent when the provider says nothing about it", async () => {
    const environment = stubEnvironment([
      {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({
            "hydra:member": [
              { id: "no-seen-field", from: { address: "a@b.invalid" }, subject: "x" },
            ],
          }),
        },
      },
    ]);

    const mailbox = await createMailbox();
    const [summary] = await createMailTmAdapter(environment).listMessages(mailbox);

    // `unread?: boolean` distinguishes "provider said nothing" from "provider said
    // read". Defaulting to `false` would quietly claim the message was read.
    expect(summary?.unread).toBeUndefined();
  });

  it("reports a 401 on a bearer request as an expired mailbox, not bad credentials", async () => {
    const environment = stubEnvironment([fixtures.mailtmGoneAfterDelete]);

    const mailbox = await createMailbox();
    const error = await capture(() => createMailTmAdapter(environment).listMessages(mailbox));

    // Measured: deletion answers 204 and the next authenticated request answers 401.
    // Reporting "check your credentials" to someone who never entered any would
    // send them to the wrong cause.
    expect(error?.code).toBe(NormalizedErrorCode.MAILBOX_EXPIRED);
  });

  it("reports a 401 on the token exchange as an authentication failure", async () => {
    const environment = stubEnvironment([
      fixtures.mailtmDomains,
      fixtures.mailtmAccountCreated,
      fixtures.mailtmBadCredentials,
    ]);

    const error = await capture(() => createMailTmAdapter(environment).createMailbox());

    // Same status code, different meaning: here the credentials really were
    // refused, because this is where they are validated.
    expect(error?.code).toBe(NormalizedErrorCode.AUTH_FAILED);
  });

  it("reports a rejected generated address as unclassified, keeping the provider's reason", async () => {
    const environment = stubEnvironment([fixtures.mailtmDomains, fixtures.mailtmValidationFailure]);

    const error = await capture(() => createMailTmAdapter(environment).createMailbox());

    // NOT `UNSUPPORTED_OPERATION`. A `422` means Mail.tm refused the address we
    // generated, not that the provider lacks the capability — reporting it as an
    // unsupported operation would tell the user no provider can create a mailbox,
    // which is false. The distinction matters because one is the user's problem and
    // the other is ours.
    expect(error?.code).toBe(NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR);
    expect(error?.description).toContain("not a valid email address");
  });

  it("names the operation when Mail.tm does not serve one", async () => {
    // SYNTHETIC: Mail.tm was never observed answering 501. The mapping is what is
    // under test, not the provider's willingness to produce this status.
    const environment = stubEnvironment([
      { response: { status: 501, headers: {}, body: "Not Implemented" } },
    ]);

    const mailbox = await createMailbox();
    const error = await capture(() => createMailTmAdapter(environment).listMessages(mailbox));

    expect(error?.code).toBe(NormalizedErrorCode.UNSUPPORTED_OPERATION);
    // Named, because the code exists to say *which* operation is missing so a
    // caller can offer an alternative rather than reporting a dead end.
    expect(
      error?.code === NormalizedErrorCode.UNSUPPORTED_OPERATION ? error.operation : undefined,
    ).toContain("listing messages");
  });

  it("reports an unknown message as not found, carrying its id", async () => {
    const environment = stubEnvironment([fixtures.mailtmUnknownMessage]);

    const mailbox = await createMailbox();
    const error = await capture(() =>
      createMailTmAdapter(environment).getMessage(mailbox, "00000000-0000-0000-0000-000000000000"),
    );

    expect(error?.code).toBe(NormalizedErrorCode.MESSAGE_NOT_FOUND);
    // Not-found and auth-failure call for different responses, so they must not be
    // conflated, and the id is needed to say which message is missing.
    expect(
      error?.code === NormalizedErrorCode.MESSAGE_NOT_FOUND ? error.messageId : undefined,
    ).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("reports mailbox deletion as supported, because it was observed", async () => {
    const adapter = createMailTmAdapter(stubEnvironment([]));

    expect(adapter.supports("destroyMailbox")).toBe(true);
  });

  it("reports a transport failure as a network error, not a provider error", async () => {
    const adapter = createMailTmAdapter({
      transport: () => Promise.reject(new Error("CORS rejected")),
      randomToken: (length) => "a".repeat(length),
      now: countingClock(),
    });

    const error = await capture(() => adapter.createMailbox());

    // A rejected fetch is not a provider answering with an error status, and
    // conflating them would report a provider outage when the client could not
    // reach it at all.
    expect(error?.code).toBe(NormalizedErrorCode.NETWORK_ERROR);
  });

  it("reports health as throttled when the provider says so", async () => {
    const adapter = createMailTmAdapter(stubEnvironment([fixtures.mailtmThrottled]));

    const health = await adapter.checkHealth();

    expect(health.status).toBe("throttled");
    expect(health.rateLimit).toBe("1; w=60");
  });

  it("reports health as unavailable when the provider is unreachable", async () => {
    const adapter = createMailTmAdapter({
      transport: () => Promise.reject(new Error("offline")),
      randomToken: (length) => "a".repeat(length),
      now: countingClock(),
    });

    // Health must never throw: a client polls it to decide what to show.
    await expect(adapter.checkHealth()).resolves.toMatchObject({ status: "unavailable" });
  });

  it("refuses to act on a mailbox holding another provider's credentials", async () => {
    const adapter = createMailTmAdapter(stubEnvironment([]));
    const foreign: Mailbox = {
      id: "https://api.mail.tm/accounts/x",
      address: "someone@example.invalid",
      provider: "guerrilla",
      status: "active",
      createdAt: Date.parse("2026-10-02T12:00:00.000Z"),
      credentials: { provider: "guerrilla", sessionId: "s" },
    };

    // Awaited, not called synchronously: the guard sits inside an async method, so
    // `expect(() => ...).toThrow()` would find nothing to catch and pass for the
    // wrong reason. That is the exact shape of a false green.
    await expect(adapter.listMessages(foreign)).rejects.toThrow(/guerrilla/);
  });
});

async function createMailbox(): Promise<Mailbox> {
  const environment = stubEnvironment([
    fixtures.mailtmDomains,
    fixtures.mailtmAccountCreated,
    fixtures.mailtmToken,
  ]);
  return createMailTmAdapter(environment).createMailbox();
}

async function capture(operation: () => Promise<unknown>) {
  try {
    await operation();
    return undefined;
  } catch (cause) {
    return cause as { code?: string; [key: string]: unknown };
  }
}
