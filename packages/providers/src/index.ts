/**
 * `@spectre-mail/providers` — provider adapters.
 *
 * Owns: the Mail.tm adapter, the Guerrilla Mail adapter, and any future
 * SpectreMail-operated provider. This is the **only** location where provider
 * wire format and provider-specific code may live.
 *
 * **M3 (provider layer) gives this package its first behaviour**: the
 * `MailProvider` contract, two adapters implementing it, the shared conformance
 * suite they must both pass, and the manager that picks one at mailbox creation.
 *
 * What this package deliberately does **not** contain:
 *
 * - **No subscription method.** Measured: five SSE paths and two WebSocket paths
 *   were probed and none connected, while Mail.tm's marketing copy claims SSE is
 *   available. See `contract.ts` and design.md D1.
 * - **No storage.** Adapters return values and retain nothing between calls, so a
 *   mailbox restored from storage works after a restart.
 * - **No parsing.** A body arrives as untrusted text and is carried as text.
 *   Stripping markup, extracting URLs, and detecting OTP codes is `mail-parser`'s
 *   job.
 * - **No polling loop.** Adapters surface the provider's rate-limit signal; the
 *   cadence belongs to the client, which is the only layer that knows whether a
 *   tab is visible.
 * - **No client wiring.** Nothing under `apps/` references this package yet.
 *
 * Both providers are built here regardless of which client uses them. Availability
 * is a client concern, not a reason to omit an adapter: the website uses
 * Guerrilla Mail only, the extension uses Mail.tm primary with Guerrilla Mail
 * fallback, per `openspec/specs/provider-abstraction/spec.md`.
 *
 * The package is consumed **as TypeScript source** (see its `exports`), so there
 * is no build step for it. Package correctness is established by `pnpm typecheck`;
 * a successful `pnpm build` builds the website only and says nothing about this
 * package.
 *
 * Boundary: no file outside this package may reference an adapter, and no file
 * under `apps/` may contain a provider JSON field name. Enforced by
 * `tests/architecture/boundaries.test.ts`.
 *
 * @module
 */

export type { MailProvider, ProviderHealth, ProviderOperation } from "./contract";

export type { Transport, TransportMethod, TransportRequest, TransportResponse } from "./transport";
export { createFetchTransport, readHeader } from "./transport";

export type { ProviderEnvironment } from "./mailtm";
export { createMailTmAdapter } from "./mailtm";

export { createGuerrillaAdapter } from "./guerrilla";

export type { ProviderManager } from "./manager";
export { createProviderManager } from "./manager";

export { deleteMessage, destroyMailbox } from "./operations";
