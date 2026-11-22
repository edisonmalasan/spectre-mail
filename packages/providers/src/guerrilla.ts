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
 * - **A dead session is not rejected, but it is not silent either.** An unrecognised
 *   session answers `HTTP 200` with a top-level `error` string and **no `list` key at
 *   all**, and it still reports `auth.success: true`, so the auth flag is not a
 *   liveness signal. `listMessages` therefore reads the measured signals before it
 *   returns a list. See design.md D4 and D10.
 * - **The declared content type lies.** A measured message arrived with
 *   `content_type: "text"` and an HTML body. The body is carried as text and no
 *   markup field is emitted.
 *
 * @module
 */

import { NormalizedErrorCode, createMailbox, createMessageSummary } from "@spectre-mail/core";
import type { Domain, Mailbox, Message, MessageSummary, SpectreError } from "@spectre-mail/core";

import type { CapabilityAnswer, MailProvider, ProviderHealth, ProviderOperation } from "./contract";
import { readHeader } from "./transport";
import type { ProviderEnvironment } from "./environment";
import type { TransportRequest, TransportResponse } from "./transport";

const BASE_URL = "https://api.guerrillamail.com/ajax.php";

/**
 * The provider's declared answer for each operation.
 *
 * Deletion was never observed in the measured surface, so it is `unobserved`,
 * not `absent`: an unmeasured capability must not become a claim that the
 * provider cannot do it. A domain API genuinely does not exist here — the
 * address is assigned server-side and the "domain list" on the provider's site
 * is a rendered widget, not an API — so the two domain operations are `absent`.
 * Restoring a session was not measured at this adapter and stays `unobserved`.
 */
const CAPABILITY_ANSWERS: Readonly<Record<ProviderOperation, CapabilityAnswer>> = {
  deleteMessage: "unobserved",
  destroyMailbox: "unobserved",
  listDomains: "absent",
  createOnChosenDomain: "absent",
  restoreSession: "unobserved",
};

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
  /**
   * A whole-seconds timestamp the welcome message carries when it has no date.
   * Declared rather than assumed absent, and only ever read as a fallback.
   */
  readonly mail_timestamp?: unknown;
  readonly mail_read?: unknown;
  readonly mail_excerpt?: unknown;
}

/**
 * The keys this adapter reads from a `check_email` response.
 *
 * `email`, not `email_addr`: measured on 2026-11-18, the listing echoes the session's
 * address under `email`, while `email_addr` appears only on `get_email_address`. A
 * listing that carried no address at all would still be declared here as `unknown`,
 * because the adapter treats an absent address as no evidence either way.
 */
interface GuerrillaListResponse {
  readonly email?: unknown;
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
  readonly mail_timestamp?: unknown;
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

  /**
   * The message's arrival instant, or `null` when the provider gave nothing usable.
   *
   * Never `0`: zero is a real instant in 1970, not an absence. The welcome message
   * has no `mail_date`/`mail_time`, so a finite whole-seconds `mail_timestamp` is
   * the one fallback that does not invent an instant. A day without a clock is kept
   * at UTC midnight, which the old comment called "the honest floor"; that is a
   * claim about the day the provider did send, not a fabrication out of nothing.
   */
  function toReceivedAt(date: unknown, time: unknown, timestamp: unknown): number | null {
    if (typeof date === "string" && date.length > 0) {
      const day = Date.parse(`${date}T00:00:00Z`);
      if (!Number.isNaN(day)) {
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
    }
    // Second choice: a genuine whole-seconds value from the provider. Anything
    // non-finite, negative or zero is not a usable instant and stays null.
    if (typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0) {
      const millis = timestamp * 1_000;
      if (Number.isFinite(millis)) {
        return millis;
      }
    }
    return null;
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
      receivedAt: toReceivedAt(member.mail_date, member.mail_time, member.mail_timestamp),
      unread: member.mail_read === "0",
    });
  }

  /**
   * Whether the provider still recognises this session.
   *
   * The trap is that a dead session answers `HTTP 200` rather than an error status, so
   * without this check it would be reported as an empty inbox. Three signals were
   * measured on 2026-11-18 and only these are used:
   *
   * - a top-level `error` string, which the dead body carries and a live body does not;
   * - a `list` that is not an array, because a live listing always carries one even
   *   when it is empty, and the dead body carries no `list` key at all;
   * - an echoed address that is present and disagrees with the mailbox's own.
   *
   * **An absent address is not evidence of death.** `auth.success` is `true` in the
   * dead body too, and `count` was measured as the string `"0"` on a one-message
   * listing and the number `0` on an empty one, so neither is read here.
   *
   * This is best-effort detection of one known trap, not proof of liveness.
   */
  function sessionIsLive(body: GuerrillaListResponse, mailbox: Mailbox): boolean {
    // An explicit error key is the clearest signal available, and the dead body carries
    // one: "Please call get_email_address or set_email_user first".
    if (typeof body["error"] === "string") {
      return false;
    }
    // A live listing always carries `list`, even when it is empty. A body without one
    // is not a listing this adapter knows how to read.
    if (!Array.isArray(body["list"])) {
      return false;
    }
    // The listing echoes the session's address under `email`. A present address that
    // disagrees is the one signal that catches a session pointed at another mailbox.
    const reported = body["email"];
    if (typeof reported === "string" && reported.length > 0) {
      return reported.toLowerCase() === mailbox.address.toLowerCase();
    }
    // No address at all. Measured on every live body seen so far, but its absence is
    // not evidence of death: the two signals above already decided the question, and
    // treating an absent address as death is what made every live mailbox look expired.
    return true;
  }

  return {
    id: "guerrilla",
    displayName: "Guerrilla Mail",

    supports(operation: ProviderOperation) {
      // One declared table, read by operation. "Not observed" is not "does not
      // exist": SpectreMail will not call an operation it has never seen succeed,
      // but it must not tell a person the provider is incapable of it either.
      // docs/PROVIDERS.md §3 is where that uncertainty lives.
      return CAPABILITY_ANSWERS[operation];
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

    async listDomains(): Promise<Domain[]> {
      // Guerrilla assigns a random address itself and publishes no domain API.
      // Returning an empty list is the honest answer; inventing or hardcoding a
      // domain would offer a mailbox this provider cannot create.
      return [];
    },

    async createMailbox(_domain?: Domain): Promise<Mailbox> {
      // The optional domain is deliberately ignored: this provider chooses the
      // address, and a caller-supplied name has no meaning to it.
      void _domain;
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
            "session with HTTP 200 and no list, so this answer is not an empty inbox " +
            "and the mailbox's contents are unknown.",
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
        receivedAt: toReceivedAt(body.mail_date, body["mail_time"], body["mail_timestamp"]),
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
