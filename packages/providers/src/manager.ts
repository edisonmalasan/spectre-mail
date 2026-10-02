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
 * @module
 */

import type { Mailbox } from "@spectre-mail/core";

import type { MailProvider } from "./contract";

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
  createMailbox(): Promise<Mailbox>;
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

    async createMailbox(): Promise<Mailbox> {
      const failures: string[] = [];

      for (const provider of providers) {
        try {
          return await provider.createMailbox();
        } catch (cause) {
          // Every provider is tried, including when there is only one, so the
          // recorded failure is the provider's own rather than a wrapper's. With a
          // single provider this loop runs once and the throw below is the
          // original error, unaltered.
          failures.push(`${provider.id}: ${describe(cause)}`);
        }
      }

      throw new Error(
        `No configured provider could create a mailbox.\n${failures.map((f) => `  - ${f}`).join("\n")}`,
      );
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
  if (typeof cause === "object" && cause !== null && "code" in cause && "provider" in cause) {
    const record = cause as { code?: unknown; description?: unknown };
    return `${String(record.code)}${typeof record.description === "string" ? ` - ${record.description}` : ""}`;
  }
  return cause instanceof Error ? cause.message : String(cause);
}
