/**
 * `@spectre-mail/ui` — reusable product UI.
 *
 * Owns: buttons, the mailbox card, the provider badge, the status dot, the
 * message row, the OTP component, the verification-link component, and the
 * design tokens.
 *
 * M1 (monorepo foundation) creates this file and nothing else. It deliberately
 * contains **no runtime behaviour, no components, and no exports**. See the note
 * in `packages/core/src/index.ts` for why a documented file with no behaviour is
 * the correct M1 state.
 *
 * **No visual design work happens at M1.** The approved visual direction is
 * Spectral Swiss Utility, and it is applied from M7, not anticipated here.
 * Creating tokens or a component now would produce styling that M7 rewrites and
 * would spend the milestone on polish the roadmap explicitly defers.
 *
 * Marketing-only website sections do not belong here. This package holds
 * product UI shared by the clients, not landing-page content.
 *
 * Boundary: this package must never import from `apps/web` or
 * `apps/extension`. Enforced by `tests/architecture/boundaries.test.ts`.
 */
export {};
