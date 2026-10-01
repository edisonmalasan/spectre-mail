/**
 * `@spectre-mail/core` — normalized product logic.
 *
 * Owns: mailbox lifecycle, provider selection, provider health, the mailbox
 * manager, message normalization, error normalization, expiration logic, and the
 * shared domain types.
 *
 * M1 (monorepo foundation) creates this file and nothing else. It deliberately
 * contains **no runtime behaviour and no exports**. A single documented file
 * exists so the package has a TypeScript input, because `tsc` fails with "No
 * inputs were found" on a project with no source — without it the package
 * could not be type checked at all, and the type check gate would be vacuous.
 *
 * The domain model that belongs here (Mailbox, MessageSummary, Message,
 * VerificationCode, VerificationLink, the normalized error codes) is specified
 * by milestone M2. The `MailProvider` contract is M3. Neither is stubbed here:
 * a placeholder that throws is dead code the owning milestone must delete, and
 * inventing the contract now would front-run a decision not yet made.
 *
 * Boundary: this package must never import from `apps/web` or `apps/extension`.
 * That rule is enforced by `tests/architecture/boundaries.test.ts`, not by
 * convention.
 */
export {};
