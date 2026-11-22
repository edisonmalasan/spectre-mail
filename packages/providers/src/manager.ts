/**
 * The provider manager.
 *
 * Selects a provider **only when a mailbox is created**. After that a mailbox
 * belongs to the provider that made it, for life.
 *
 * The reporting problem is solved structurally rather than by discipline. M2
 * derives `Mailbox.provider` from the credential discriminant, so the mailbox
 * already says which provider served it. There is no flag for a caller to forget
 * to set, and a fallback cannot masquerade as the primary because a caller has no
 * way to learn which provider was *asked* — only which one *answered*. See
 * design.md D8.
 *
 * Fallback is bounded to one attempt per configured provider and confined to
 * creation. When every provider declines, the composition is a typed
 * {@link CreationFailure} carrying the deciding failure's normalized code rather
 * than an `Error` whose only detail is prose: a caller must be able to tell
 * "wait" from "service down" without parsing a sentence.
 *
 * @module
 */

import { isSpectreError, NormalizedErrorCode } from "@spectre-mail/core";
import type { Domain, Mailbox, ProviderId } from "@spectre-mail/core";

import type { MailProvider } from "./contract";

/** One configured provider's contribution to a bounded creation failure. */
export interface ProviderAttemptFailure {
  readonly provider: ProviderId;
  readonly code: NormalizedErrorCode;
  /** The provider's own words, verbatim, including any rate-limit statement. */
  readonly description: string;
}

/**
 * The typed failure thrown when every configured provider declined creation.
 *
 * **A composition is still a failure with a normalized code.** The previous version
 * threw a plain `Error` whose message held each provider's failure as prose, so the
 * `code` a client branches on survived in neither the value nor a field — only inside
 * a sentence. A caller that wanted to tell "wait" from "service down" had to parse
 * that sentence, which is the one recovery this architecture forbids. The deciding
 * failure's code is now carried on the object itself; every provider's own code is
 * carried in {@link providerFailures}, and the prose stays for a person to read.
 *
 * **It is still an `Error`.** Existing callers already catch an `Error` from a
 * manager with several providers and read its `message`; making the typed
 * composition an `Error` with added fields keeps that contract, rather than
 * silently changing the shape a client has always received. The fields are what
 * is new — `code`, `provider`, `providerFailures`, and `description` alongside the
 * inherited `message` — not the fact that it can be caught as an `Error`.
 */
export interface CreationFailure extends Error {
  /** The normalized code of the failure that decided the outcome (the last attempt). */
  readonly code: NormalizedErrorCode;
  /** The provider whose refusal decided the outcome. */
  readonly provider: ProviderId;
  /** Every attempt, named, in the order they were tried. */
  readonly description: string;
  /** Each provider's own normalized code and description, in attempt order. */
  readonly providerFailures: readonly ProviderAttemptFailure[];
  /**
   * The deciding failure, carried so even the `NETWORK_ERROR` variant satisfies
   * `isSpectreError` (which requires a `cause` on that code). An absent cause
   * would silently downgrade the composition back to prose at the session layer.
   */
  readonly cause: unknown;
}

export interface ProviderManager {
  /** The providers this manager may create a mailbox with, in preference order. */
  readonly available: readonly MailProvider[];
  /**
   * Create a mailbox, trying each provider in order.
   *
   * With a single provider, no fallback is attempted and the original failure is
   * rethrown unaltered. A manager that retried a provider the client cannot reach
   * would present a known limitation as redundancy.
   */
  createMailbox(domain?: Domain): Promise<Mailbox>;
  /**
   * The provider that owns `mailbox`.
   *
   * Never falls back. A mailbox read through a different provider would
   * authenticate with the wrong credentials.
   *
   * @throws {Error} If no configured provider matches the mailbox.
   */
  providerFor(mailbox: Mailbox): MailProvider;
}

/**
 * Build a manager over `providers`, in the order given.
 *
 * @throws {Error} If `providers` is empty or contains a duplicate provider id.
 */
export function createProviderManager(providers: readonly MailProvider[]): ProviderManager {
  if (providers.length === 0) {
    throw new Error(
      "A provider manager needs at least one provider. A client with none cannot create a mailbox.",
    );
  }

  const byId = new Map<string, MailProvider>();
  for (const provider of providers) {
    if (byId.has(provider.id)) {
      throw new Error(
        `Provider "${provider.id}" was configured twice. Each provider may appear once, ` +
          `otherwise the preference order is ambiguous.`,
      );
    }
    byId.set(provider.id, provider);
  }

  return {
    available: providers,

    async createMailbox(domain?: Domain): Promise<Mailbox> {
      const attempts: ProviderAttemptFailure[] = [];
      let lastCause: unknown;
      let lastProvider: MailProvider | undefined;

      for (const provider of providers) {
        // A chosen domain belongs to one provider. Offering it to another would
        // construct an address on a service that does not own the name; skip those
        // rather than let a fallback silently switch providers. This is also what
        // binds a catalog answer to the provider that supplied it: a domain from
        // provider A is never handed to provider B, even as a "fallback".
        if (domain !== undefined && domain.provider !== provider.id) continue;
        lastProvider = provider;
        try {
          // Each configured provider is asked at most once. There is no inner
          // loop, no backoff and no queued retry: a throttle is answered to the
          // caller and the next provider is a different provider, not a second
          // attempt at the same one.
          return await provider.createMailbox(domain);
        } catch (cause) {
          lastCause = cause;
          attempts.push({
            provider: provider.id,
            code: isSpectreError(cause) ? cause.code : NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
            description: describe(cause),
          });
        }
      }

      // **No configured provider owns a chosen domain: refuse, never substitute.**
      // Reaching here means every provider was skipped by the domain check, so no
      // provider was asked. Throwing `lastCause` here would throw `undefined`, which
      // is neither an answer nor a failure a client can branch on. This is the
      // manager half of "a domain from one provider is offered to another": the
      // request is refused and no provider is treated as the owner.
      if (lastProvider === undefined) {
        const owner = domain?.provider ?? providers[0]?.id;
        const description =
          domain === undefined
            ? "No configured provider could be asked to create a mailbox."
            : `The domain "${domain.name}" belongs to "${domain.provider}", which this client is not configured for. It was not offered to another provider.`;
        throw {
          code: NormalizedErrorCode.UNSUPPORTED_OPERATION,
          provider: owner ?? "guerrilla",
          description,
          operation: "createMailbox",
        };
      }

      // **With one configured provider, the failure is rethrown as it was.**
      //
      // This was the documented intent all along - the comment this replaces said
      // "the throw below is the original error, unaltered" - and the code did not
      // do it. Every failure was funnelled into a composed `Error` whose message
      // embedded each provider's failure as text, so a `SpectreError`'s `code`
      // survived nowhere. The existing test, named "preserves a single provider's
      // failure as the cause it was", asserted only that a description *substring*
      // survived, so it stayed green while the code was destroyed.
      //
      // It matters because the code is the part a client cannot reconstruct. The
      // message is prose; `RATE_LIMITED` versus `PROVIDER_UNAVAILABLE` versus
      // `AUTH_FAILED` decides whether a user is told to wait, told the service is
      // down, or told to try again later. A caller handed only the wrapper would
      // have to recover it by parsing that prose, which is the one recovery this
      // architecture forbids outright.
      if (providers.length === 1) {
        throw lastCause;
      }

      // **Several providers declined. The composition is typed, not prose-only.**
      // Every provider's own normalized code travels in `providerFailures`, and the
      // failure that decided the outcome — the last attempt, after which no provider
      // remains — supplies the aggregate `code` and `provider`. A caller can branch
      // on that code without reconstructing it from a sentence, while the composed
      // description still names every provider for a person to read.
      const deciding = attempts[attempts.length - 1];
      const description = `No configured provider could create a mailbox.\n${attempts
        .map((attempt) => `  - ${attempt.provider}: ${attempt.description}`)
        .join("\n")}`;
      throw Object.assign(new Error(description), {
        code: deciding?.code ?? NormalizedErrorCode.UNKNOWN_PROVIDER_ERROR,
        provider: lastProvider.id,
        description,
        providerFailures: attempts,
        // The deciding failure, so a `NETWORK_ERROR` composition still satisfies
        // `isSpectreError` and is not degraded to `String(cause)` downstream.
        cause: lastCause,
      }) as CreationFailure;
    },

    providerFor(mailbox: Mailbox): MailProvider {
      const owner = byId.get(mailbox.provider);
      if (owner === undefined) {
        throw new Error(
          `This mailbox belongs to "${mailbox.provider}", which this client is not ` +
            `configured for. Configured: ${providers.map((p) => p.id).join(", ")}. ` +
            `A mailbox is never served by a provider other than the one that created it.`,
        );
      }
      return owner;
    },
  };
}

function describe(cause: unknown): string {
  if (isSpectreError(cause)) {
    const limit =
      cause.code === NormalizedErrorCode.RATE_LIMITED && cause.rateLimit !== undefined
        ? ` (rate limit: ${cause.rateLimit})`
        : "";
    return `${cause.code}${cause.description.length > 0 ? ` - ${cause.description}` : ""}${limit}`;
  }
  return cause instanceof Error ? cause.message : String(cause);
}
