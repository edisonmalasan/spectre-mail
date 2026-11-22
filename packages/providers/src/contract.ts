/**
 * The provider contract.
 *
 * One interface, two implementations. Everything a caller can do to a mailbox is
 * here, and nothing here mentions a provider's wire format.
 *
 * **There is deliberately no subscription method.** The roadmap's contract target
 * included `subscribe?(mailbox, listener)`. Measured reality: five SSE candidate
 * paths and two WebSocket candidates were probed and none connected;
 * `GET /messages/events` returns `406` for `Accept: text/event-stream` and `404`
 * for every format its negotiator accepts, while Mail.tm's own marketing copy
 * claims SSE is available (`docs/PROVIDERS.md` §2).
 *
 * An optional method is still a method. A caller that checks for it and finds it
 * absent still has to handle absence, so declaring it optional would grant
 * permission to write code that has never run against a real provider. Removing it
 * forces the polling shape, which is the only shape that works. See design.md D1.
 *
 * @module
 */

import type { Domain, Mailbox, Message, MessageSummary, ProviderId } from "@spectre-mail/core";

/**
 * An operation a provider may or may not offer.
 *
 * Named rather than inferred from the interface's keys so that "which operations
 * does this provider support" is a question with a typed answer rather than a
 * property lookup that returns `undefined` at every call site. The domain-selection
 * operations are added here so a client reads the adapter's declared answer rather
 * than testing a provider identifier.
 */
export type ProviderOperation =
  "deleteMessage" | "destroyMailbox" | "listDomains" | "createOnChosenDomain" | "restoreSession";

/**
 * A provider's answer to "can you do this operation".
 *
 * A boolean cannot say why an answer is negative, and conflating "nobody measured
 * it" with "we know it is impossible" bakes an unmeasured claim into a user-facing
 * message. The three answers are therefore distinct:
 *
 * - `observed` — the operation was seen to work on this provider.
 * - `unobserved` — nobody measured it working; this is not proof of impossibility.
 * - `absent` — the provider is known not to offer it (for example, no domain API).
 *
 * Every adapter answers every operation; an unreported capability is never
 * silently turned into a false one. See design.md D1 and the amended
 * `provider-adapters` scenario about an absent operation recorded as unobserved.
 */
export type CapabilityAnswer = "observed" | "unobserved" | "absent";

/**
 * A domain listing together with whether the fetch was bounded before the
 * provider's inventory was exhausted.
 *
 * A partial list presented as a whole inventory is a false claim about a
 * provider, so the completeness signal travels with the entries it describes.
 */
export interface DomainListing {
  readonly domains: readonly Domain[];
  /**
   * `true` when a declared page bound was reached or the provider still
   * advertised a next page, `false` when the walk ended on its own.
   */
  readonly truncated: boolean;
}

/**
 * A provider's answer to "can you serve requests right now".
 *
 * Deliberately not a `SpectreError`: health is a state a caller polls, not a
 * failure to be thrown. A provider that is merely throttled is reachable.
 */
export interface ProviderHealth {
  readonly provider: ProviderId;
  readonly status: "ok" | "throttled" | "unavailable";
  /**
   * The provider's advertised rate-limit header, verbatim, when it sent one.
   *
   * Never parsed. The header states a limit and a window and nothing about what it
   * is per; `1; w=60` for Mail.tm account creation does not say "per IP". Reading a
   * scope into it would put an inference into the product. See design.md D6.
   */
  readonly rateLimit?: string;
  /** The provider's own account of the condition, when it gave one. */
  readonly detail?: string;
}

/**
 * Everything SpectreMail can ask of a provider.
 *
 * Implementations MUST NOT retain state between calls. Each operation is driven
 * solely by its arguments, so a mailbox restored from storage works after a
 * restart with nothing remembered. See the requirement *The provider layer does
 * not persist anything*.
 */
export interface MailProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  /**
   * How this provider's support for `operation` is known.
   *
   * Required rather than inferred from the presence of an optional method: an
   * optional method whose absence surfaces only as `undefined` is a runtime trap
   * at every call site, and "can I do this?" is a question every caller must ask
   * before invoking. The answer is a {@link CapabilityAnswer}, not a boolean, so
   * an unmeasured capability stays visibly unmeasured. See design.md D9.
   */
  supports(operation: ProviderOperation): CapabilityAnswer;

  checkHealth(): Promise<ProviderHealth>;

  /**
   * List the domains this provider can actually create a mailbox on.
   *
   * The list is provider-sourced and may be empty: a provider that assigns an
   * address itself (Guerrilla Mail) has no domain API and exposes none. An empty
   * list is an honest answer, not a failure, and a client must be able to say
   * "automatic" rather than offer a domain it cannot serve. Values must be
   * discovered from the provider's API — no hardcoded production domain names
   * belong in a client, an adapter, or a catalog.
   */
  listDomains(): Promise<Domain[]>;

  /**
   * List domains together with whether the fetch was truncated.
   *
   * Optional only so a provider with no domain API and an existing stub need not
   * invent an answer. A caller that needs the completeness signal MUST use
   * `catalog.ts`'s guarded path, which falls back to `listDomains()` and reports
   * an unknown completeness rather than claiming one. A provider that implements
   * this method and `listDomains()` MUST answer both from the same source.
   */
  listDomainListing?(): Promise<DomainListing>;

  /**
   * Create a new mailbox, optionally on a chosen domain.
   *
   * The argument is optional so a provider that assigns addresses itself keeps
   * working unchanged. A provider that accepts one uses the value's `name`; passing
   * a domain that belongs to another provider is a caller error and must not be
   * silently applied to this one.
   *
   * NOT instantaneous for every provider. Mail.tm advertises
   * `ratelimit-policy: 1; w=60` on account creation, so this rejects with a
   * throttled `SpectreError` carrying that header rather than retrying. See
   * design.md D6.
   */
  createMailbox(domain?: Domain): Promise<Mailbox>;

  /**
   * List a mailbox's messages.
   *
   * Implementations MUST NOT report a genuinely empty inbox for a session the
   * provider no longer honours. Guerrilla answers an unrecognised session with
   * `HTTP 200` and an empty list, so a dead session and an empty mailbox are
   * indistinguishable unless the adapter checks explicitly. See design.md D4.
   */
  listMessages(mailbox: Mailbox): Promise<MessageSummary[]>;

  getMessage(mailbox: Mailbox, messageId: string): Promise<Message>;

  /** Present only when {@link supports} reports `"deleteMessage"`. */
  deleteMessage?(mailbox: Mailbox, messageId: string): Promise<void>;

  /** Present only when {@link supports} reports `"destroyMailbox"`. */
  destroyMailbox?(mailbox: Mailbox): Promise<void>;
}
