/**
 * Mailbox.
 *
 * A mailbox is the product's own record of a working disposable address, plus the
 * credentials needed to keep working it. It is deliberately not a provider
 * response: nothing in this module may be recognised as wire format.
 *
 * The interesting constraint here is the relationship between `provider` and
 * `credentials`. The roadmap specifies both fields on `Mailbox`, but specifies
 * nothing connecting them - and M3's provider contract reads credentials straight
 * off the mailbox. Left alone, that permits a mailbox that claims one provider and
 * carries another provider's credentials, which is a wrong-provider authentication
 * attempt that TypeScript would not catch. See `./invariants.ts` for how this
 * module closes that, and `design.md` D1 for why the fix does not make `Mailbox`
 * generic.
 *
 * @module
 */

import type { ProviderCredentials } from "./credentials";
import type { ProviderId } from "./provider";

/**
 * What SpectreMail believes about a mailbox's usability.
 *
 * All three values describe an **observed** condition:
 *
 * - `active` - the mailbox was created and has not been observed to fail.
 * - `expired` - the provider reported the mailbox or its session as unusable, or a
 *   request failed in a way that identified the mailbox as gone.
 * - `unavailable` - the mailbox exists but could not be reached for a reason that
 *   is not an expiry, such as the provider being unreachable or throttling.
 *
 * There is no status derived from elapsed time. See the `expiresAt` documentation
 * below for why that distinction is enforced rather than merely intended.
 */
export type MailboxStatus = "active" | "expired" | "unavailable";

/**
 * The arguments accepted when constructing a mailbox.
 *
 * Note what is *absent*: `provider`. The caller supplies credentials and the
 * provider is derived from them. That is the whole point - the two cannot disagree
 * because only one of them is ever supplied.
 */
export interface MailboxInit {
  readonly id: string;
  readonly address: string;
  readonly createdAt: number;
  /**
   * An observed expiry instant, in epoch milliseconds.
   *
   * Populate this **only** from a signal the provider actually reported. It must
   * never be derived from elapsed time, from a documented retention period, or from
   * any value the provider does not return. Absence is a normal, expected state.
   *
   * The measured reason this rule is stated so forcefully: Mail.tm publishes a
   * 7-day message retention and says a mailbox stays valid until deleted, but
   * **neither value appears in any API response** and neither was verified against
   * the live API. Guerrilla publishes no equivalent value. So any `expiresAt` this
   * product ever holds will, in practice, be one SpectreMail observed - never one
   * SpectreMail inferred. `provider-abstraction` requires the same under *Mailbox
   * lifetime is not assumed*.
   *
   * Because `exactOptionalPropertyTypes` is enabled, an unset expiry must be
   * **omitted** rather than written as `expiresAt: undefined`. That is deliberate:
   * it makes "not known" unrepresentable as anything other than absence.
   */
  readonly expiresAt?: number;
  readonly credentials: ProviderCredentials;
}

/**
 * A working disposable address, and the credentials that keep it working.
 *
 * The shape is exactly the roadmap's, unchanged. The invariants are enforced by
 * construction and by the types in `./invariants.ts`, not by widening this type.
 */
export interface Mailbox {
  readonly id: string;
  /**
   * Always equal to `credentials.provider`.
   *
   * Read it for branching and for reporting. Do not supply it independently - use
   * {@link createMailbox}, which derives it.
   */
  readonly provider: ProviderId;
  readonly address: string;
  readonly createdAt: number;
  /** See {@link MailboxInit.expiresAt} for the rules governing this field. */
  readonly expiresAt?: number;
  readonly credentials: ProviderCredentials;
  readonly status: MailboxStatus;
}

/**
 * Construct a mailbox whose provider is derived from its credentials.
 *
 * The single supported construction path, and the reason a mailbox cannot record a
 * provider that contradicts the credentials it carries. Status starts at `active`
 * because a freshly created mailbox has not been observed to fail; changing it is
 * a later, observed transition.
 */
export function createMailbox(init: MailboxInit): Mailbox {
  return {
    id: init.id,
    provider: init.credentials.provider,
    address: init.address,
    createdAt: init.createdAt,
    ...(init.expiresAt === undefined ? {} : { expiresAt: init.expiresAt }),
    credentials: init.credentials,
    status: "active",
  };
}

/**
 * Return a copy of `mailbox` with an updated status.
 *
 * A transition carries no timestamp and no reason. That is intentional: the
 * product records *that* a condition was observed, and the cause is captured by the
 * normalized error that reported it. Storing an elapsed time here is precisely the
 * inference `expiresAt` forbids.
 */
export function withMailboxStatus(mailbox: Mailbox, status: MailboxStatus): Mailbox {
  return { ...mailbox, status };
}

/**
 * Whether `mailbox` has been observed to be unusable because it is gone.
 *
 * A convenience for the common branch. It reads the observed `status` only, and
 * never computes expiry from `createdAt`.
 */
export function isMailboxGone(mailbox: Mailbox): boolean {
  return mailbox.status === "expired";
}
