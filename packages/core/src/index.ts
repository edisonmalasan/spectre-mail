/**
 * `@spectre-mail/core` — SpectreMail's normalized product vocabulary.
 *
 * Owns: the shared domain types, mailbox lifecycle, provider selection, provider
 * health, the mailbox manager, message normalization, error normalization, and
 * expiration logic.
 *
 * **M2 (shared domain model) gives this package its first real content**: the
 * normalized types below. The behaviour that acts on them — mailbox lifecycle,
 * expiry evaluation, and the mapping from provider HTTP responses onto the
 * normalized error codes — is **not** here yet. That belongs to later milestones,
 * and specifically to the provider layer, which is the first thing able to observe a
 * real provider response.
 *
 * What this package deliberately does **not** contain:
 *
 * - No provider wire format. Every field name here is SpectreMail's own. A measured
 *   provider field name must never appear in this package; `tests/architecture/`
 *   asserts it for apps and this is the same rule by construction.
 * - No `MailProvider` contract. That is the provider layer's milestone, and it is
 *   deliberately not anticipated here — inventing it before any provider has been
 *   measured would freeze a guess.
 * - No OTP or verification-link detection. `packages/mail-parser` detects; this
 *   package describes the result.
 *
 * The package is consumed **as TypeScript source** (see its `exports`), so there is
 * no build step for it. Package correctness is established by `pnpm typecheck`; a
 * successful `pnpm build` builds the website only and says nothing about this
 * package.
 *
 * @module
 */

export { PROVIDER_IDS, isProviderId, assertProviderId } from "./provider";
export type { ProviderId } from "./provider";

export {
  assertGuerrillaCredentials,
  assertMailTmCredentials,
  credentialsProvider,
} from "./credentials";
export type { GuerrillaCredentials, MailTmCredentials, ProviderCredentials } from "./credentials";

export { createMailbox, isMailboxGone, withMailboxStatus } from "./mailbox";
export type { Mailbox, MailboxInit, MailboxStatus } from "./mailbox";

export { isMailbox } from "./invariants";
export type { AssertProviderAgreement, CredentialsProvider } from "./invariants";

export { assertConfidence, createMessageSummary, isValidConfidence } from "./message";
export type { Message, MessageSummary, VerificationCode, VerificationLink } from "./message";

export {
  NORMALIZED_ERROR_CODES,
  NormalizedErrorCode,
  isNormalizedErrorCode,
  isSpectreError,
} from "./errors";
export type { SpectreError } from "./errors";
