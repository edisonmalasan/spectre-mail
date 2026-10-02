/**
 * The Mail.tm adapter.
 *
 * Mail.tm is an API Platform / Hydra service: responses are JSON-LD, collections
 * arrive as `hydra:member`, and resource URLs come back as a **relative** `@id`.
 * All of that is interpreted here and nowhere else.
 *
 * Two measured behaviours shape this file and are worth stating before the code:
 *
 * - `POST /accounts` advertises `ratelimit-policy: 1; w=60`. One mailbox per
 *   minute. Creation therefore rejects with a throttled error rather than
 *   retrying, and `GET /domains` is `30; w=60` unauthenticated — which is why the
 *   domain is fetched once per creation rather than once per operation. See
 *   design.md D6.
 * - No push transport exists. See `./contract.ts` for why there is no
 *   subscription method to implement.
 *
 * @module
 */

import { NormalizedErrorCode, createMailbox, createMessageSummary } from "@spectre-mail/core";
import type { Mailbox, Message, MessageSummary, SpectreError } from "@spectre-mail/core";

import type { MailProvider, ProviderHealth, ProviderOperation } from "./contract";
import type { CredentialSourceEnvironment } from "./environment";
import { readHeader } from "./transport";
import type { TransportRequest, TransportResponse } from "./transport";

const BASE_URL = "https://api.mail.tm";

/**
 * Re-exported for callers that already import this module.
 *
 * The type itself lives in `./environment.ts` because the Guerrilla adapter needs
 * it too, and exporting it from the Mail.tm adapter would make the dependency
 * direction an accident rather than a decision.
 */
export type { CredentialSourceEnvironment as ProviderEnvironment } from "./environment";

/* -- wire shapes, private to this adapter ----------------------------------- */

interface HydraDomain {
  readonly domain?: unknown;
}

interface HydraDomains {
  readonly "hydra:member"?: readonly HydraDomain[];
}

interface HydraAccount {
  readonly "@id"?: unknown;
  readonly id?: unknown;
  readonly address?: unknown;
}

interface HydraMessage {
  readonly id?: unknown;
  readonly subject?: unknown;
  readonly from?: { readonly address?: unknown; readonly name?: unknown };
  readonly createdAt?: unknown;
  readonly seen?: unknown;
  readonly text?: unknown;
}

interface HydraCollection<T> {
  readonly "hydra:member"?: readonly T[];
}

interface HydraToken {
  readonly token?: unknown;
}

/* -- the adapter ------------------------------------------------------------- */

export function createMailTmAdapter(environment: CredentialSourceEnvironment): MailProvider {
  const { transport, randomToken, now } = environment;

  async function request(
    method: TransportRequest["method"],
    path: string,
    options: { readonly token?: string; readonly body?: unknown } = {},
  ): Promise<TransportResponse> {
    const headers: Record<string, string> = { accept: "application/ld+json" };
    if (options.token !== undefined) {
      headers["authorization"] = `Bearer ${options.token}`;
    }
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const request_: TransportRequest = {
      url: `${BASE_URL}${path}`,
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    };

    try {
      return await transport(request_);
    } catch (cause) {
      // A throw from the transport is a transport failure: offline, DNS, or a
      // CORS rejection. Distinct from a provider answering with an error status,
      // which arrives as a normal response carrying a body worth reading.
      throw mailTmError(NormalizedErrorCode.NETWORK_ERROR, `Could not reach Mail.tm: ${path}`, {
        cause,
      });
    }
  }

  function mailTmError(
    code: SpectreError["code"],
    description: string,
    extra: { readonly rateLimit?: string; readonly cause?: unknown } = {},
  ): SpectreError {
    switch (code) {
      case NormalizedErrorCode.RATE_LIMITED:
        return {
          code,
          provider: "mailtm",
          description,
          ...(extra.rateLimit === undefined ? {} : { rateLimit: extra.rateLimit }),
          ...(extra.cause === undefined ? {} : { cause: extra.cause }),
        };
      default:
        return {
          code,
          provider: "mailtm",
          description,
          ...(extra.cause === undefined ? {} : { cause: extra.cause }),
        } as SpectreError;
    }
  }

  /**
   * Turn a failed response into a normalized error.
   *
   * The rate-limit header is captured verbatim and never parsed. It states a limit
   * and a window and nothing about what it is per; `1; w=60` does not say "per IP".
   *
   * `mode` exists because a `401` means two different things depending on where it
   * happened, and collapsing them would send a reader to the wrong cause. On the
   * token exchange the credentials were genuinely refused. On any request carrying
   * an already-issued token, the mailbox is gone - measured: deletion answers `204`
   * and the very next request answers `401`.
   *
   * A corrupted token in storage produces the same `401`, and reporting it as an
   * expired mailbox is still the right answer: in both cases the mailbox cannot be
   * used and a new one must be created. Reporting "check your credentials" to
   * someone who never entered any would be the misleading outcome.
   */
  function classify(
    response: TransportResponse,
    context: string,
    mode: "anonymous" | "exchange" | "bearer",
  ): SpectreError {
    const advertised = readHeader(response, "ratelimit-policy");

    if (response.status === 429) {
      return mailTmError(
        NormalizedErrorCode.RATE_LIMITED,
        `Mail.tm is throttling this request while ${context}.`,
        { ...(advertised === undefined ? {} : { rateLimit: advertised }) },
      );
    }

    if (response.status === 401 || response.status === 403) {
      return mode === "bearer"
        ? mailTmError(
            NormalizedErrorCode.MAILBOX_EXPIRED,
            `Mail.tm no longer accepts this mailbox's token while ${context}. The ` +
              `mailbox has most likely been deleted or has expired on the provider's side.`,
          )
        : mailTmError(
            NormalizedErrorCode.AUTH_FAILED,
            `Mail.tm rejected the credentials while ${context}.`,
          );
    }

    if (response.status === 404) {
      return mailTmError(
        NormalizedErrorCode.MESSAGE_NOT_FOUND,
        `Mail.tm has no such resource while ${context}.`,
      );
    }

    if (response.status === 405 || response.status === 501) {
      // Only reached for an operation Mail.tm does not serve. The operation is named
      // because this code's whole purpose is to say *which* one, so a caller can
      // offer an alternative instead of just reporting a dead end.
      return {
        code: NormalizedErrorCode.UNSUPPORTED_OPERATION,
        provider: "mailtm",
        description: `Mail.tm does not offer the operation required to ${context}.`,
        operation: context,
      };
    }

    // Unclassifiable. The provider's own account is kept, because this code exists
    // precisely for conditions we could not classify, and discarding its description
    // would leave the failure undiagnosable.
    //
    // A `422 ConstraintViolationList` lands here on purpose. It means Mail.tm
    // rejected *our* generated payload - an address it would not accept - which is
    // not the provider lacking a capability. Reporting `UNSUPPORTED_OPERATION` would
    // tell the user this provider cannot create a mailbox, which is false and would
    // send them looking for a different provider instead of reporting a defect in
    // the generated address.
    return mailTmError(
      NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
      `Mail.tm returned ${response.status} while ${context}: ${response.body.slice(0, 300)}`,
    );
  }

  function parseJson(response: TransportResponse): Record<string, unknown> {
    try {
      return JSON.parse(response.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  function bearerOf(mailbox: Mailbox): string {
    if (mailbox.credentials.provider !== "mailtm") {
      throw new Error(
        `Expected Mail.tm credentials but this mailbox carries ${mailbox.credentials.provider} credentials.`,
      );
    }
    return mailbox.credentials.accessToken;
  }

  async function fetchDomain(): Promise<string> {
    const response = await request("GET", "/domains?page=1");
    if (response.status !== 200) {
      throw classify(response, "discovering an available domain", "anonymous");
    }
    const body = parseJson(response) as HydraDomains;
    const domain = body["hydra:member"]?.[0]?.domain;
    if (typeof domain !== "string" || domain.length === 0) {
      throw mailTmError(
        NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
        "Mail.tm returned no active domain, so no address can be constructed.",
      );
    }
    return domain;
  }

  async function exchangeToken(address: string, password: string): Promise<string> {
    const response = await request("POST", "/token", { body: { address, password } });
    if (response.status !== 200) {
      throw classify(response, "exchanging credentials for a token", "exchange");
    }
    const token = (parseJson(response) as HydraToken).token;
    if (typeof token !== "string" || token.length === 0) {
      throw mailTmError(
        NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
        "Mail.tm accepted the credentials but returned no token.",
      );
    }
    return token;
  }

  function toSummary(member: HydraMessage, mailbox: Mailbox): MessageSummary {
    return createMessageSummary({
      id: typeof member.id === "string" ? member.id : "",
      mailboxId: mailbox.id,
      from: typeof member.from?.address === "string" ? member.from.address : "",
      ...(typeof member.from?.name === "string" ? { fromName: member.from.name } : {}),
      subject: typeof member.subject === "string" ? member.subject : "",
      receivedAt: toEpochMillis(member.createdAt),
      // Inverted on purpose: the provider reports `seen`, the model reports `unread`.
      // Absent rather than defaulted, because `unread?: boolean` distinguishes "the
      // provider said nothing" from "the provider said read", and defaulting to
      // `false` would quietly claim the latter.
      ...(typeof member.seen === "boolean" ? { unread: !member.seen } : {}),
    });
  }

  return {
    id: "mailtm",
    displayName: "Mail.tm",

    supports(operation: ProviderOperation): boolean {
      // Both were observed live: message deletion is not in the measured surface,
      // but mailbox deletion is (`DELETE /accounts/{id}` -> 204). Stating this as a
      // lookup rather than a method presence keeps the answer in one place.
      return operation === "destroyMailbox";
    },

    async checkHealth(): Promise<ProviderHealth> {
      try {
        const response = await request("GET", "/domains?page=1");
        const advertised = readHeader(response, "ratelimit-policy");
        if (response.status === 200) {
          return { provider: "mailtm", status: "ok" };
        }
        if (response.status === 429) {
          return {
            provider: "mailtm",
            status: "throttled",
            ...(advertised === undefined ? {} : { rateLimit: advertised }),
          };
        }
        return { provider: "mailtm", status: "unavailable", detail: `status ${response.status}` };
      } catch {
        return { provider: "mailtm", status: "unavailable", detail: "unreachable" };
      }
    },

    async createMailbox(): Promise<Mailbox> {
      const domain = await fetchDomain();
      const localPart = randomToken(12);
      const password = randomToken(20);
      const address = `${localPart}@${domain}`;

      const created = await request("POST", "/accounts", {
        body: { address, password },
      });
      if (created.status !== 201 && created.status !== 200) {
        // A 422 here is a validation rejection of the generated address. Reported
        // as an unsupported operation rather than a generic failure, because the
        // operation named is the one that cannot be carried out as specified.
        throw classify(created, "creating a mailbox", "anonymous");
      }

      const account = parseJson(created) as HydraAccount;
      const resourceId = account["@id"];
      if (typeof resourceId !== "string" || resourceId.length === 0) {
        throw mailTmError(
          NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
          "Mail.tm created an account but returned no resource URL.",
        );
      }

      const token = await exchangeToken(address, password);

      return createMailbox({
        // The hydrated resource URL, not the bare uuid. Hydra returns `@id`
        // relative, and deletion must follow it; a hand-built `/accounts/{id}`
        // looks right and is the wrong call if the provider ever changes its path.
        id: `${BASE_URL}${resourceId.startsWith("/") ? "" : "/"}${resourceId}`,
        address,
        createdAt: now(),
        credentials: { provider: "mailtm", accountId: resourceId, accessToken: token },
      });
    },

    async listMessages(mailbox: Mailbox): Promise<MessageSummary[]> {
      const response = await request("GET", "/messages?page=1", { token: bearerOf(mailbox) });
      if (response.status !== 200) {
        throw classify(response, "listing messages", "bearer");
      }
      const body = parseJson(response) as HydraCollection<HydraMessage>;
      return (body["hydra:member"] ?? []).map((member) => toSummary(member, mailbox));
    },

    async getMessage(mailbox: Mailbox, messageId: string): Promise<Message> {
      const response = await request("GET", `/messages/${encodeURIComponent(messageId)}`, {
        token: bearerOf(mailbox),
      });
      if (response.status !== 200) {
        const error = classify(response, "fetching a message", "bearer");
        throw error.code === NormalizedErrorCode.MESSAGE_NOT_FOUND
          ? { ...error, messageId }
          : error;
      }

      const member = parseJson(response) as HydraMessage;
      const summary = toSummary(member, mailbox);

      // The body is carried as text and nothing else. Mail.tm returns both `text`
      // and `html`, and the declared content type has been measured lying, so the
      // only field that crosses the contract is the text one. No markup field is
      // emitted, which makes "render it as HTML" impossible rather than discouraged.
      const text = typeof member.text === "string" ? member.text : "";

      return {
        ...summary,
        text,
        // Detection is `packages/mail-parser`'s job, not this adapter's. Empty here
        // means "not yet detected", not "there are none".
        verificationCodes: [],
        verificationLinks: [],
      };
    },

    async destroyMailbox(mailbox: Mailbox): Promise<void> {
      // Deletes against the mailbox's own resource URL. See `createMailbox` for why
      // that is the hydrated `@id` rather than a constructed path.
      const response = await transport({
        url: mailbox.id,
        method: "DELETE",
        headers: { authorization: `Bearer ${bearerOf(mailbox)}` },
      }).catch((cause: unknown) => {
        throw mailTmError(
          NormalizedErrorCode.NETWORK_ERROR,
          "Could not reach Mail.tm to delete the mailbox.",
          {
            cause,
          },
        );
      });

      if (response.status === 204 || response.status === 200) {
        return;
      }
      if (response.status === 401 || response.status === 403) {
        throw mailTmError(
          NormalizedErrorCode.MAILBOX_EXPIRED,
          "Mail.tm no longer accepts this mailbox's token, so it has most likely " +
            "already been deleted. Observed live: deletion answers 204 and every " +
            "later request answers 401.",
        );
      }
      if (response.status === 404) {
        // Already gone. Observed live: deletion returns 204 and every later request
        // answers 401, so a 404 here means somebody got there first. Reporting it
        // as an authentication failure would send a reader to the wrong cause.
        throw mailTmError(
          NormalizedErrorCode.MAILBOX_EXPIRED,
          "Mail.tm no longer has this mailbox, so it is already deleted.",
        );
      }
      throw classify(response, "deleting the mailbox", "bearer");
    },
  };
}

/**
 * Parse a provider timestamp into epoch milliseconds.
 *
 * Returns `0` for anything unusable rather than `NaN`. A `NaN` would reach the
 * model and then a UI as "Invalid Date", which reads as a product fault rather
 * than as a field this provider happened not to send.
 */
function toEpochMillis(value: unknown): number {
  if (typeof value !== "string" || value.length === 0) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
