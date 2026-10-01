/**
 * `@spectre-mail/storage` — persistence contracts and platform adapters.
 *
 * Owns: the shared `SpectreStorage` interface, the web IndexedDB adapter, and
 * the extension storage adapter.
 *
 * M1 (monorepo foundation) creates this file and nothing else. It deliberately
 * contains **no runtime behaviour and no exports**. See the note in
 * `packages/core/src/index.ts` for why a documented file with no behaviour is
 * the correct M1 state.
 *
 * The `SpectreStorage` contract is M5/M6. What it must handle is already
 * constrained by measurement: an expired Guerrilla session is reported as an
 * empty inbox with no auth error, so "no messages" and "session gone" are
 * indistinguishable at the storage layer. A contract that stores only a message
 * list cannot represent that, which is why the interface is worth specifying
 * carefully rather than defaulting. See `docs/PROVIDERS.md` §3.
 *
 * Boundary: this package must never import from `apps/web` or
 * `apps/extension`. Enforced by `tests/architecture/boundaries.test.ts`.
 */
export {};
