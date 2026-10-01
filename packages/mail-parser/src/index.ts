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
 * returning `content_type: "text"` with an HTML body, and a real delivered
 * message arriving as raw HTML. This package is therefore the boundary that
 * turns untrusted provider content into plain text, and it must never emit
 * markup for a client to render. See `docs/PROVIDERS.md` §3.
 *
 * OTP and verification-link detection are M10.
 *
 * Boundary: this package must never import from `apps/web` or
 * `apps/extension`. Enforced by `tests/architecture/boundaries.test.ts`.
 */
export {};
