/**
 * The Guerrilla Mail adapter.
 *
 * Guerrilla is not a REST service. Every operation is the same endpoint with a
 * different `f` parameter, and the session travels in a **query string**.
 *
 * Three measured behaviours shape this file:
 *
 * - **The cookie is unusable.** The provider sends
 *   `Access-Control-Allow-Origin: *` with no `Access-Control-Allow-Credentials`,
 *   so a browser refuses to attach `PHPSESSID` cross-origin. The body-returned
 *   `sid_token` is the only session carrier that works from a web page. This
 *   adapter therefore persists that value and never reads a cookie.
 * - **A dead session is not rejected.** An unrecognised session answers `HTTP 200`
 *   with an empty list and no auth error, which makes it indistinguishable from an
 *   empty inbox. `listMessages` therefore cannot return an empty list without first
 *   checking the provider still recognises the session. See design.md D4.
 * - **The declared content type lies.** A measured message arrived with
 *   `content_type: "text"` and an HTML body. The body is carried as text and no
 *   markup field is emitted.
 *
 * @module
 */

import { NormalizedErrorCode, createMailbox, createMessageSummary } from "@spectre-mail/core";
import type { Mailbox, Message, MessageSummary, SpectreError } from "@spectre-mail/core";

import type { MailProvider, ProviderHealth, ProviderOperation } from "./contract";
import { readHeader } from "./transport";
import type { ProviderEnvironment } from "./environment";
import type { TransportRequest, TransportResponse } from "./transport";

const BASE_URL = "https://api.guerrillamail.com/ajax.php";

/**
 * Operations observed to work against this provider.
 *
 * Empty, and deliberately so. See `supports`.
 */
const SUPPORTED_OPERATIONS: ReadonlySet<ProviderOperation> = new Set<ProviderOperation>();

/* -- wire shapes, private to this adapter ----------------------------------- */

interface GuerrillaSession {
  readonly email_addr?: unknown;
  readonly sid_token?: unknown;
  readonly auth?: { readonly success?: unknown };
  readonly error?: unknown;
}

interface GuerrillaMessage {
  readonly mail_id?: unknown;
  readonly mail_from?: unknown;
  readonly mail_recipient?: unknown;
  readonly mail_subject?: unknown;
  readonly mail_date?: unknown;
  readonly mail_time?: unknown;
  readonly mail_read?: unknown;
  readonly mail_excerpt?: unknown;
}

interface GuerrillaListResponse {
  readonly email_addr?: unknown;
  readonly sid_token?: unknown;
  readonly list?: readonly GuerrillaMessage[];
  readonly error?: unknown;
}

interface GuerrillaFetchResponse {
  readonly mail_id?: unknown;
  readonly mail_from?: unknown;
  readonly mail_subject?: unknown;
  readonly mail_date?: unknown;
  readonly mail_time?: unknown;
  readonly content_type?: unknown;
  readonly mail_body?: unknown;
  /**
   * Present on failure. Measured only as an `error` key on a session response, so
   * it is declared here rather than assumed absent from a fetch response.
   */
  readonly error?: unknown;
}

export function createGuerrillaAdapter(environment: ProviderEnvironment): MailProvider {
  const { transport, now } = environment;

  function sessionOf(mailbox: Mailbox): string {
    if (mailbox.credentials.provider !== "guerrilla") {
      throw new Error(
        `Expected Guerrilla credentials but this mailbox carries ${mailbox.credentials.provider} credentials.`,
      );
    }
    return mailbox.credentials.sessionId;
  }

  async function call(
    operation: string,
    params: Readonly<Record<string, string>> = {},
    sessionId?: string,
  ): Promise<TransportResponse> {
    const url = new URL(BASE_URL);
    url.searchParams.set("f", operation);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    // The session travels in the query string, never as a cookie. See the module
    // note: the provider's CORS response makes the cookie unusable from a browser.
    if (sessionId !== undefined && sessionId.length > 0) {
      url.searchParams.set("sid_token", sessionId);
    }

    const request: TransportRequest = { url: url.toString(), method: "GET", headers: {} };

    try {
      return await transport(request);
    } catch (cause) {
      throw {
        code: NormalizedErrorCode.NETWORK_ERROR,
        provider: "guerrilla",
        description: `Could not reach Guerrilla Mail while ${operation}.`,
        cause,
      } satisfies SpectreError;
    }
  }

  function parse(response: TransportResponse): Record<string, unknown> {
    try {
      return JSON.parse(response.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Turn a failed response into a normalized error.
   *
   * Guerrilla gives less to work with than Mail.tm: no hydra error body, no distinct
   * status per condition. What it does send is a rate-limit header, and it is
   * captured verbatim for the same reason as Mail.tm's — the value is the evidence,
   * and the header states no scope, so nothing here infers one.
   *
   * The measured behaviour that makes this adapter's liveness check necessary is
   * that a dead session answers `200`, so it never reaches here at all.
   */
  function classify(response: TransportResponse, context: string): never {
    const advertised = readHeader(response, "ratelimit-policy");

    if (response.status === 429) {
      throw {
        code: NormalizedErrorCode.RATE_LIMITED,
        provider: "guerrilla",
        description: `Guerrilla Mail is throttling this request while ${context}.`,
        ...(advertised === undefined ? {} : { rateLimit: advertised }),
      } satisfies SpectreError;
    }

    if (response.status === 404 || response.status === 410) {
      throw {
        code: NormalizedErrorCode.MESSAGE_NOT_FOUND,
        provider: "guerrilla",
        description: `Guerrilla Mail has no such resource while ${context}.`,
        messageId: context,
      } satisfies SpectreError;
    }

    throw {
      code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
      provider: "guerrilla",
      description: `Guerrilla Mail answered ${response.status} while ${context}: ${response.body.slice(0, 300)}`,
    } satisfies SpectreError;
  }

  function toEpochMillis(date: unknown, time: unknown): number {
    if (typeof date !== "string" || date.length === 0) {
      return 0;
    }
    // Guerrilla returns `YYYY-MM-DD` plus a separate `HH:MM:SS`. The provider sends
    // no timezone, and inventing one would place the message in the wrong hour. The
    // date at UTC midnight is the honest floor: the day is known, the instant is not.
    const day = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(day)) {
      return 0;
    }
    if (typeof time !== "string") {
      return day;
    }
    const clock = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time);
    if (clock === null) {
      return day;
    }
    return (
      day + Number(clock[1]) * 3_600_000 + Number(clock[2]) * 60_000 + Number(clock[3]) * 1_000
    );
  }

  function toSummary(member: GuerrillaMessage, mailbox: Mailbox): MessageSummary {
    return createMessageSummary({
      // Coerced rather than checked for `string`, because the provider sends this as
      // a **number** (`mail_id: 1000000`). An `isString` guard would silently produce
      // an empty id, and a message with no id cannot be fetched — so the message
      // would list and then be unreachable.
      id: toIdentifier(member.mail_id),
      mailboxId: mailbox.id,
      from: typeof member.mail_from === "string" ? member.mail_from : "",
      subject: typeof member.mail_subject === "string" ? member.mail_subject : "",
      receivedAt: toEpochMillis(member.mail_date, member.mail_time),
      unread: member.mail_read === "0",
    });
  }

  /**
   * Whether the provider still recognises this session.
   *
   * The measured trap: an unrecognised session returns `HTTP 200` with an empty
   * list and no error, so "no messages" and "dead session" look identical. The only
   * signal available is whether the response still names the mailbox's own address.
   *
   * This is best-effort detection of one known trap, not proof of liveness.
   */
  function sessionIsLive(body: GuerrillaListResponse, mailbox: Mailbox): boolean {
    // An explicit error key is the clearest signal available.
    if (typeof body["error"] === "string") {
      return false;
    }
    const reported = body["email_addr"];
    if (typeof reported === "string" && reported.length > 0) {
      return reported.toLowerCase() === mailbox.address.toLowerCase();
    }
    // No address at all alongside a token means the provider did not recognise the
    // session. A dead session still echoes a token back.
    return false;
  }

  return {
    id: "guerrilla",
    displayName: "Guerrilla Mail",

    supports(operation: ProviderOperation): boolean {
      // Nothing observed. Neither deletion operation appears in the measured surface.
      //
      // "Not observed" is not "does not exist". This returns `false` because
      // SpectreMail will not call an operation it has never seen succeed, not
      // because the provider has been proven unable to serve it — the honest
      // position is that deletion is **unverified**, and `docs/PROVIDERS.md` §3 is
      // where that uncertainty lives. If a future probe observes either operation
      // working, adding it here is a one-line change.
      return SUPPORTED_OPERATIONS.has(operation);
    },

    async checkHealth(): Promise<ProviderHealth> {
      try {
        const response = await call("get_email_address");
        const advertised = readHeader(response, "ratelimit-policy");
        if (response.status !== 200) {
          return {
            provider: "guerrilla",
            status: "unavailable",
            detail: `status ${response.status}`,
          };
        }
        const body = parse(response);
        if (typeof body["error"] === "string") {
          return { provider: "guerrilla", status: "unavailable", detail: body["error"] };
        }
        if (advertised !== undefined) {
          return { provider: "guerrilla", status: "throttled", rateLimit: advertised };
        }
        return { provider: "guerrilla", status: "ok" };
      } catch {
        return { provider: "guerrilla", status: "unavailable", detail: "unreachable" };
      }
    },

    async createMailbox(): Promise<Mailbox> {
      const response = await call("get_email_address");
      if (response.status !== 200) {
        classify(response, "creating a mailbox");
      }

      const body = parse(response) as GuerrillaSession;
      if (typeof body.error === "string") {
        throw {
          code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
          provider: "guerrilla",
          description: `Guerrilla Mail could not create a mailbox: ${body.error}`,
        } satisfies SpectreError;
      }

      const address = body.email_addr;
      const token = body.sid_token;
      // Both are checked before either is used, because `createMailbox` below
      // stores the token as the mailbox's id as well as its credential. Returning a
      // mailbox whose id is `""` would produce one that cannot be listed.
      if (typeof address !== "string" || address.length === 0) {
        throw {
          code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
          provider: "guerrilla",
          description: "Guerrilla Mail returned no address for a new mailbox.",
        } satisfies SpectreError;
      }
      if (typeof token !== "string" || token.length === 0) {
        throw {
          code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
          provider: "guerrilla",
          description: "Guerrilla Mail returned no session token for a new mailbox.",
        } satisfies SpectreError;
      }

      return createMailbox({
        id: token,
        address,
        createdAt: now(),
        // The body-returned token, never `PHPSESSID`. Persisting the cookie would
        // produce a mailbox that cannot be used from a browser, which is the only
        // environment the website runs in.
        credentials: { provider: "guerrilla", sessionId: token },
      });
    },

    async listMessages(mailbox: Mailbox): Promise<MessageSummary[]> {
      const response = await call("check_email", { seq: "0" }, sessionOf(mailbox));
      if (response.status !== 200) {
        classify(response, "listing messages");
      }

      const body = parse(response) as GuerrillaListResponse;

      // The trap. Without this, a dead session and an empty inbox are the same
      // result, and the user is shown "no mail" for an address that has mail. The
      // symptom would not appear until days later, to someone waiting for a code
      // that already arrived and was dropped.
      if (!sessionIsLive(body, mailbox)) {
        throw {
          code: NormalizedErrorCode.MAILBOX_EXPIRED,
          provider: "guerrilla",
          description:
            "Guerrilla Mail no longer recognises this session. It answers an expired " +
            "session with an empty inbox and no error, so the empty list is not " +
            "evidence that the mailbox is empty.",
        } satisfies SpectreError;
      }

      return (body.list ?? []).map((member) => toSummary(member, mailbox));
    },

    async getMessage(mailbox: Mailbox, messageId: string): Promise<Message> {
      const response = await call("fetch_email", { email_id: messageId }, sessionOf(mailbox));
      if (response.status !== 200) {
        classify(response, `fetching message ${messageId}`);
      }

      const body = parse(response) as GuerrillaFetchResponse;
      if (typeof body["error"] === "string") {
        throw {
          code: NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
          provider: "guerrilla",
          description: `Guerrilla Mail could not fetch the message: ${body["error"]}`,
        } satisfies SpectreError;
      }

      const summary = createMessageSummary({
        id: typeof body.mail_id === "string" ? body.mail_id : messageId,
        mailboxId: mailbox.id,
        from: typeof body.mail_from === "string" ? body.mail_from : "",
        // Required but possibly empty: a real delivered message arrived with an
        // empty subject while its sender and body were present. Dropping it would
        // discard a message that genuinely arrived.
        subject: typeof body.mail_subject === "string" ? body.mail_subject : "",
        receivedAt: toEpochMillis(body.mail_date, body["mail_time"]),
      });

      // `content_type` is present in the response and is deliberately not read.
      // Measured: it said `"text"` while the body was HTML. Trusting it would mean
      // either mislabelling the body or carrying a second, markup-shaped field.
      // Neither happens: there is one field, it is text, and nothing downstream can
      // choose to render it.
      const text = typeof body.mail_body === "string" ? body.mail_body : "";

      return { ...summary, text, verificationCodes: [], verificationLinks: [] };
    },
  };
}

/**
 * Render a provider identifier as a string.
 *
 * Guerrilla sends `mail_id` as a JSON **number** while every other identifier in
 * this package arrives as a string. `String(value)` normalises it, and the empty
 * result for an absent value keeps a missing id visible rather than rendering it
 * as `"undefined"` — which would look like a real id and fail confusingly on fetch.
 */
function toIdentifier(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

/** Nothing follows the adapter: see the module note for why. */
