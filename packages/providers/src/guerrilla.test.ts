/**
 * Guerrilla Mail adapter tests.
 *
 * The shared conformance suite runs here exactly as it does for Mail.tm. Most of
 * what is specific to this adapter is about the session model and the dead-session
 * trap: a session the provider no longer honours still answers `HTTP 200`.
 *
 * @module
 */

import { NormalizedErrorCode } from "@spectre-mail/core";
import type { Mailbox } from "@spectre-mail/core";
import { describe, expect, it } from "vitest";

import type { ConformanceAdapter, ProviderConformance } from "./conformance";
import { runProviderConformance } from "./conformance";
import { countingClock, providerOnlyEnvironment } from "./environments";
import * as fixtures from "./fixtures";
import { FIXTURE_IDS } from "./fixtures";
import { createGuerrillaAdapter } from "./guerrilla";
import type { RecordedStep } from "./recorder";

const GUERRILLA = FIXTURE_IDS.guerrilla;

function build(steps: readonly RecordedStep[]): ConformanceAdapter {
  const environment = providerOnlyEnvironment(steps);
  return { adapter: createGuerrillaAdapter(environment), requests: environment.requests };
}

const CONFORMANCE: ProviderConformance = {
  provider: "guerrilla",
  build,
  create: [fixtures.guerrillaSessionCreated],
  list: [fixtures.guerrillaLiveList],
  fetch: [fixtures.guerrillaMessageFetched],
  messageId: GUERRILLA.messageId,
  deadSession: [fixtures.guerrillaDeadSession],
  // MEASURED, and identical to `deadSession`. Guerrilla has no credential-rejection
  // response: a session it no longer honours still answers `200`. So the dead-session
  // recording *is* this provider's credential-failure recording, and the adapter
  // reports it as `MAILBOX_EXPIRED`.
  //
  // Not an exemption and not a workaround — it is the only truthful answer. The
  // alternative was a synthetic `401`, which would have tested a status the provider
  // was never observed to send and implied a capability it may not have.
  authFailure: [fixtures.guerrillaDeadSession],
  throttled: [fixtures.guerrillaThrottled],
  expectedRateLimit: "100; w=60",
  unclassifiable: [fixtures.guerrillaUnclassifiable],
};

runProviderConformance(CONFORMANCE);

describe("Guerrilla Mail adapter", () => {
  it("carries no state between mailboxes through one adapter instance", async () => {
    // The counterpart to the Mail.tm case. Here the state a caching adapter would
    // keep is the session token, and the consequence would be worse: reading one
    // mailbox's mail through another mailbox's session, which is both a data leak
    // and a silent misreport of whose mail this is.
    const environment = providerOnlyEnvironment([
      fixtures.guerrillaSessionCreated,
      {
        response: {
          status: 200,
          headers: {},
          // The recording must echo the SECOND mailbox's own address under `email`,
          // which is the key a listing sends. Reusing the first mailbox's recording
          // made the liveness check reject it - which is that check working
          // correctly, and the reason a fixture for a second mailbox cannot be a copy
          // of the first.
          body: JSON.stringify({
            email: "someone.else@sharklasers.com",
            sid_token: "second-session-token",
            list: [],
          }),
        },
      },
      fixtures.guerrillaLiveList,
    ]);
    const adapter = createGuerrillaAdapter(environment);

    const first = await adapter.createMailbox();
    const second: Mailbox = {
      ...first,
      id: "second-session",
      address: "someone.else@sharklasers.com",
      credentials: { provider: "guerrilla", sessionId: "second-session-token" },
    };

    await adapter.listMessages(second);

    // The first mailbox's token must appear in neither the URL nor the path of the
    // later request.
    const request = environment.requests[1];
    expect(new URL(request?.url ?? "").searchParams.get("sid_token")).toBe("second-session-token");
    expect(request?.url).not.toContain(GUERRILLA.sessionId);

    await adapter.listMessages(first);
    expect(new URL(environment.requests[2]?.url ?? "").searchParams.get("sid_token")).toBe(
      GUERRILLA.sessionId,
    );
  });

  it("carries the session in the query string, never as a cookie", async () => {
    const environment = providerOnlyEnvironment([fixtures.guerrillaSessionCreated]);

    const mailbox = await createGuerrillaAdapter(environment).createMailbox();

    const [request] = environment.requests;
    expect(request?.url).toContain("f=get_email_address");
    // The *establishing* call cannot carry a session — there is none yet. It is the
    // token the response returns, not one the request sends, that starts the session.
    expect(new URL(request?.url ?? "").searchParams.has("sid_token")).toBe(false);
    // The provider does send `PHPSESSID`, but `Access-Control-Allow-Origin: *` with
    // no `Access-Control-Allow-Credentials` means a browser refuses to attach it
    // cross-origin. The body token is the only carrier that works from a web page.
    expect(mailbox.credentials).toEqual({ provider: "guerrilla", sessionId: GUERRILLA.sessionId });
    expect(JSON.stringify(mailbox)).not.toContain("PHPSESSID");
  });

  it("sends the session on every call that needs it", async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([fixtures.guerrillaLiveList]);

    await createGuerrillaAdapter(environment).listMessages(mailbox);

    expect(new URL(environment.requests[0]?.url ?? "").searchParams.get("sid_token")).toBe(
      GUERRILLA.sessionId,
    );
  });

  it("reports a dead session as expired rather than as an empty inbox", async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([fixtures.guerrillaDeadSession]);

    const error = await capture(() => createGuerrillaAdapter(environment).listMessages(mailbox));

    // The measured trap, and the whole reason the liveness check exists. The
    // recording answers `HTTP 200`, carries a top-level `error` and **no `list` at
    // all**, and leaves `auth.success` at `true`. Without the check the missing list
    // would read as an empty array, and the user would be told their mailbox has no
    // mail for an address that once had some.
    expect(error?.code).toBe(NormalizedErrorCode.MAILBOX_EXPIRED);
    // The description must not repeat the shape the measurement refuted. It used to
    // say the provider answers "with an empty inbox and no error", which is false in
    // both halves: the measured dead body carries an error and no list. `no longer
    // recognises` is the claim the adapter can support, and this assertion is what
    // stops the old sentence coming back.
    expect(error?.description).toContain("no longer recognises");
  });

  it("treats a session reporting a different address as dead", async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([
      {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({
            email: "someone.else@example.invalid",
            sid_token: GUERRILLA.sessionId,
            list: [],
          }),
        },
      },
    ]);

    const error = await capture(() => createGuerrillaAdapter(environment).listMessages(mailbox));

    // Same status, same empty list, different address. Returning `[]` here would be
    // exactly the data-loss trap, just with a subtler trigger.
    expect(error?.code).toBe(NormalizedErrorCode.MAILBOX_EXPIRED);
  });

  it("matches the address case-insensitively, since providers are inconsistent about it", async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([
      {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({
            email: GUERRILLA.address.toUpperCase(),
            sid_token: GUERRILLA.sessionId,
            list: [],
          }),
        },
      },
    ]);

    const summaries = await createGuerrillaAdapter(environment).listMessages(mailbox);

    // Address comparison is not case-sensitive, so an uppercased echo must not be
    // mistaken for a dead session — that would expire a working mailbox.
    expect(summaries).toEqual([]);
  });

  it("returns a genuinely empty list for a live session", async () => {
    const mailbox = await createMailbox();
    // The captured empty body, not a hand-built one. Measured 2026-11-18: a live
    // session with nothing in it answers `list: []` **and** an echoed address **and**
    // no `error`, while the dead body carries an error and no `list` at all. A
    // hand-built body cannot show that difference, because whoever writes it decides
    // what the difference is - which is how this case stayed green while the fixture
    // it should have been reading was wrong.
    const environment = providerOnlyEnvironment([fixtures.guerrillaEmptyLiveList]);

    const summaries = await createGuerrillaAdapter(environment).listMessages(mailbox);

    // The other half of the requirement. Without this, "expired" would be
    // indistinguishable from "correctly empty", and the liveness check would be
    // unfalsifiable.
    expect(summaries).toEqual([]);
  });

  it("keeps a live session alive when the listing names no address at all", async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([
      {
        response: {
          status: 200,
          headers: {},
          body: JSON.stringify({ list: [], sid_token: GUERRILLA.sessionId }),
        },
      },
    ]);

    const summaries = await createGuerrillaAdapter(environment).listMessages(mailbox);

    // **The inversion this change exists for.** The adapter used to require an echoed
    // address and call anything without one dead, so once the fixture stopped carrying
    // a key no listing sends, every live mailbox was reported expired. An absent
    // address is not evidence of death: the error and the list already decided the
    // question, and this body carries neither of the signals that mean dead.
    expect(summaries).toEqual([]);
  });

  it("does not read the provider's declared content type", async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([fixtures.guerrillaMessageFetched]);

    const message = await createGuerrillaAdapter(environment).getMessage(
      mailbox,
      GUERRILLA.messageId,
    );

    // The recording says `content_type: "text"` and delivers an HTML body. The body
    // is carried as text regardless, because the declared type has been measured
    // disagreeing with the content.
    expect(message.text).toContain("<pre>");
    expect(message.text).toContain("493028");
    expect(Object.keys(message).some((key) => /html|content_type|markup/i.test(key))).toBe(false);
  });

  it("keeps an empty subject rather than discarding the message", async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([fixtures.guerrillaMessageFetched]);

    const message = await createGuerrillaAdapter(environment).getMessage(
      mailbox,
      GUERRILLA.messageId,
    );

    // Measured: a real delivered message arrived with an empty subject while its
    // sender and body were present. Treating emptiness as absence would throw away
    // a message that genuinely arrived.
    expect(message.subject).toBe("");
    expect(message.from).toBe("sender@example.invalid");
    expect(message.text.length).toBeGreaterThan(0);
  });

  it('reads `mail_read: "0"` as unread', async () => {
    const mailbox = await createMailbox();
    const environment = providerOnlyEnvironment([fixtures.guerrillaLiveList]);

    const [summary] = await createGuerrillaAdapter(environment).listMessages(mailbox);

    // The provider sends a string `"0"`, not a boolean. A loose `!summary.mail_read`
    // would invert it and mark every unread message read.
    expect(summary?.unread).toBe(true);
  });

  it("reports deletion operations as unsupported, because none was observed", () => {
    const adapter = createGuerrillaAdapter(providerOnlyEnvironment([]));

    // Both `false` because SpectreMail will not call an operation never seen to
    // succeed. This is **unverified**, not proven: "not observed" is not "does not
    // exist", and a future probe observing one working would change this.
    expect(adapter.supports("deleteMessage")).toBe(false);
    expect(adapter.supports("destroyMailbox")).toBe(false);
  });

  it("reports a transport failure as a network error", async () => {
    const adapter = createGuerrillaAdapter({
      transport: () => Promise.reject(new Error("offline")),
      now: countingClock(),
    });

    const error = await capture(() => adapter.createMailbox());

    expect(error?.code).toBe(NormalizedErrorCode.NETWORK_ERROR);
  });

  it("reports health as ok for a reachable provider", async () => {
    const adapter = createGuerrillaAdapter(
      providerOnlyEnvironment([fixtures.guerrillaSessionCreated]),
    );

    await expect(adapter.checkHealth()).resolves.toMatchObject({
      provider: "guerrilla",
      status: "ok",
    });
  });

  it("reports health as unavailable when unreachable, without throwing", async () => {
    const adapter = createGuerrillaAdapter({
      transport: () => Promise.reject(new Error("offline")),
      now: countingClock(),
    });

    // Health is polled to decide what to show, so throwing here would break the
    // caller's render rather than inform it.
    await expect(adapter.checkHealth()).resolves.toMatchObject({ status: "unavailable" });
  });

  it("refuses to act on a mailbox holding another provider's credentials", async () => {
    const adapter = createGuerrillaAdapter(providerOnlyEnvironment([]));
    const foreign: Mailbox = {
      id: "session",
      address: "someone@example.invalid",
      provider: "mailtm",
      status: "active",
      createdAt: Date.parse("2026-10-02T12:00:00.000Z"),
      credentials: { provider: "mailtm", accountId: "/accounts/x", accessToken: "t" },
    };

    await expect(adapter.listMessages(foreign)).rejects.toThrow(/mailtm/);
  });
});

async function createMailbox(): Promise<Mailbox> {
  return createGuerrillaAdapter(
    providerOnlyEnvironment([fixtures.guerrillaSessionCreated]),
  ).createMailbox();
}

async function capture(operation: () => Promise<unknown>) {
  try {
    await operation();
    return undefined;
  } catch (cause) {
    return cause as { code?: string; [key: string]: unknown };
  }
}
