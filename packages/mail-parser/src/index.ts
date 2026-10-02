/**
 * `@spectre-mail/mail-parser` — message content interpretation.
 *
 * Owns: safe text extraction, OTP detection, verification-link detection, and
 * message classification helpers.
 *
 * M1 (monorepo foundation) creates this file and nothing else. It deliberately
 * contains **no runtime behaviour and no exports**. See the note in
 * `packages/core/src/index.ts` for why a documented file with no behaviour is
 * the correct M1 state.
 *
 * Safe extraction is not an optional concern here. M0 measured Guerrilla Mail
 * declaring a plain-text content type while delivering an HTML body, and a real
 * delivered message arriving as raw HTML. This package is therefore the boundary
 * that turns untrusted provider content into plain text, and it must never emit
 * markup for a client to render. The exact field name is recorded in
 * `docs/PROVIDERS.md` §3 rather than quoted here, because no shared package may
 * name a provider's wire fields - a rule `tests/architecture/` enforces from M2.
 *
 * OTP and verification-link detection are M10.
 *
 * Boundary: this package must never import from `apps/web` or
 * `apps/extension`. Enforced by `tests/architecture/boundaries.test.ts`.
 */
export {};
