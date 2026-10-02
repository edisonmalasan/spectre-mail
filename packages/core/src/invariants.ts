/**
 * Type-level invariants for the domain model.
 *
 * These are assertions, not runtime checks. They exist because TypeScript cannot
 * stop a caller from hand-writing an object literal, and because the relationship
 * between a mailbox and its credentials is exactly the kind of thing that is
 * correct in every code path anyone tests and wrong in the one nobody does.
 *
 * Each assertion here is paired with a test that proves it actually rejects a
 * violation. An assertion that cannot fail is documentation with extra steps -
 * which is the failure mode the M1 verification pass found twice.
 *
 * @module
 */

import type { ProviderCredentials } from "./credentials";
import type { Mailbox } from "./mailbox";

/**
 * The provider that a set of credentials was issued for.
 *
 * Extracted as a type so mailbox agreement can be expressed as a lookup rather
 * than an `extends` chain that has to be rewritten every time a provider is added.
 */
export type CredentialsProvider<C extends ProviderCredentials> = C["provider"];

/**
 * Accepts a value only if its `provider` matches the provider its credentials
 * were issued for; resolves to `never` otherwise.
 *
 * What this rules out: `{ provider: "guerrilla", credentials: <Mail.tm
 * credentials> }`. Without it that object satisfies `Mailbox` perfectly, and the
 * first symptom would be an authentication failure against the wrong provider -
 * far from the line that caused it.
 *
 * **Why this is generic over the candidate rather than written as
 * `MailboxProviderAgreement`.** The first version of this type was a
 * non-generic alias applied to `Mailbox` itself. It looked right and rejected a
 * mismatched literal - but so did every well-formed mailbox. It resolved to
 * `never` unconditionally, because a non-generic `Mailbox` stores its
 * credentials as the whole `ProviderCredentials` union, and a union can never
 * `extends` a single provider literal. So it proved nothing while passing, which
 * is the exact failure this repository has now hit three times.
 *
 * Inferring both `P` and `C` from the candidate is what makes the comparison
 * meaningful: for a literal, `P` and `C` are both concrete, so the check is
 * decidable. Applied to `Mailbox` itself it still resolves to `Mailbox`,
 * because there the union extends the union.
 *
 * A caveat worth stating plainly: this is a compile-time guarantee, so it holds for
 * values that flow through typed code. It cannot stop a literal assembled from
 * `unknown` data, such as a record parsed out of storage. Narrowing that with
 * {@link isMailbox} remains necessary, and the two are complementary rather than
 * alternatives.
 */
export type AssertProviderAgreement<T extends { provider: unknown; credentials: unknown }> = [
  T,
] extends [{ provider: infer P; credentials: infer C }]
  ? // Both sides are wrapped in tuples on purpose. A bare T extends ... would
    // distribute over each member of the credential union and then demand that a
    // union extend one specific literal, which is never true - the second version
    // of this type rejected every well-formed mailbox while appearing to work.
    [C] extends [{ provider: P }]
    ? T
    : never
  : never;

/**
 * Narrow an untrusted value to a {@link Mailbox}, checking the one invariant that
 * cannot be expressed in the type alone.
 *
 * The type system guarantees the fields; only a runtime check can confirm that a
 * value arriving from storage, a provider, or a future migration has a `provider`
 * that agrees with its `credentials`. Use this at the boundary where untrusted data
 * enters the model.
 *
 * @returns The value as a `Mailbox`, or `null` if it is not a usable mailbox.
 */
export function isMailbox(value: unknown): value is Mailbox {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Mailbox>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.address !== "string" ||
    typeof candidate.createdAt !== "number" ||
    typeof candidate.provider !== "string" ||
    !isMailboxStatus(candidate.status)
  ) {
    return false;
  }

  const credentials = candidate.credentials;
  if (typeof credentials !== "object" || credentials === null) {
    return false;
  }

  // The invariant a type cannot carry across an untyped boundary.
  if (credentials.provider !== candidate.provider) {
    return false;
  }

  if (credentials.provider === "mailtm") {
    const mailTm = credentials as { accountId?: unknown; accessToken?: unknown };
    return typeof mailTm.accountId === "string" && typeof mailTm.accessToken === "string";
  }

  if (credentials.provider === "guerrilla") {
    const guerrilla = credentials as { sessionId?: unknown };
    return typeof guerrilla.sessionId === "string";
  }

  // An unknown provider is never coerced to a known one.
  return false;
}

/**
 * Narrow an untrusted value to a {@link MailboxStatus}.
 *
 * Kept local rather than imported to avoid a runtime cycle: `mailbox.ts` is the
 * module that defines `Mailbox`, and having it depend on a validator that depends
 * on it would be circular. The list is duplicated from the union deliberately, so
 * that adding a status forces a decision in both places.
 */
function isMailboxStatus(value: unknown): value is Mailbox["status"] {
  return value === "active" || value === "expired" || value === "unavailable";
}
