/**
 * `@spectre-mail/providers` — provider adapters.
 *
 * Owns: the Mail.tm adapter, the Guerrilla Mail adapter, and any future
 * SpectreMail-operated provider. This is the **only** location where provider
 * wire format and provider-specific code may live.
 *
 * M1 (monorepo foundation) creates this file and nothing else. It deliberately
 * contains **no runtime behaviour and no exports**. See the note in
 * `packages/core/src/index.ts` for why a documented file with no behaviour is
 * the correct M1 state.
 *
 * The `MailProvider` contract is specified by milestone M3. It is not declared
 * here. Declaring it now would fix the interface before the measured provider
 * behaviour that constrains it has been reviewed against a real adapter.
 *
 * The provider roles this package must respect are specified in
 * `openspec/specs/provider-abstraction/spec.md`: the website uses Guerrilla
 * Mail only, and the extension uses Mail.tm primary with Guerrilla Mail
 * fallback. Both providers are built here regardless of which client uses them;
 * availability is a client concern, not a reason to omit an adapter.
 *
 * Boundary: no file outside this package may reference a provider adapter, and
 * no file under `apps/` may contain a provider JSON field name. Enforced by
 * `tests/architecture/boundaries.test.ts`.
 */
export {};
