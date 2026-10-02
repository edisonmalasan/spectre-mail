import { defineConfig } from "vitest/config";

/**
 * Root Vitest config.
 *
 * The `include` list is explicit and does NOT use a broad glob. That is
 * deliberate. `tests/provider-spike/` contains a hand-rolled probe harness whose
 * entry points are `run.mjs` and `selftest.mjs`; a broad `tests/**` glob would
 * either pick up nothing useful or, once the harness is touched, accidentally
 * execute a live provider probe as part of `pnpm test`. The spike is verified by
 * its own self-test, run via `pnpm spike:selftest`.
 *
 * The second entry was added at M2, when `packages/core` gained real tests, and is
 * what lets M3's adapter tests live beside the adapters:
 *
 *   tests/architecture/, any depth   cross-cutting repository boundary assertions
 *   any shared package's src, any depth   unit tests beside the code they cover
 *
 * The package entry is deliberately **package-shaped**: it globs the src directory
 * of each workspace package, rather than every test file in the repository. A stray
 * test placed at the repository root or under `tests/` would therefore be
 * **silently skipped** — an undiscovered test is worse than no test, because it
 * reads as covered. A test that must run at the root belongs in the first entry.
 *
 * The third entry was added at M5 slice 1, when the website gained its first
 * rendered states and the requirements to verify ("WHEN the page is in its
 * creating, ready, or failed state, THEN each SHALL be rendered as distinct,
 * labelled content") can only be checked against a real render.
 *
 *   any app's src, any depth   client rendering tests
 *
 * Two things about this one are deliberate and are both falsified by a test:
 *
 * 1. **It was missing before.** Until this entry existed, a test under `apps/` was
 *    **silently skipped** - exactly the failure mode the package-shaped glob above
 *    was designed to avoid, reintroduced one directory over. The same test now
 *    runs; `tests/architecture/boundaries.test.ts` asserts an app test is
 *    collected rather than skipped, so a future narrowing of this list cannot
 *    quietly drop client coverage again.
 * 2. **The global `environment` stays `"node"`.** A client test opts into jsdom
 *    with a `@vitest-environment jsdom` docblock on the file. Setting jsdom
 *    globally would give `packages/mailbox` a DOM it must not have, quietly
 *    weakening the one guarantee that its `tsconfig` is what stops it reaching
 *    for `document`.
 *
 * The glob is written here rather than quoted in this comment on purpose. The
 * pattern contains the two-character sequence that closes a block comment, so
 * transcribing it into prose terminated the comment early and `pnpm lint` failed
 * with a parse error at this line.
 *
 * **The two must never be merged into one glob, and this list must never become
 * `tests/**`.** Those are different mechanisms that happen to both mention tests:
 *
 * - This Vitest `include` decides which files `pnpm test` executes.
 * - The `packages` globs in `pnpm-workspace.yaml` decide which directories are
 *   workspace members.
 *
 * The spike is excluded from the *workspace*, and that exclusion is the only reason
 * "product code must never import the spike" is structurally impossible rather than
 * merely documented. Adding `tests/` to the workspace globs would pull the spike's
 * Playwright dependency graph into every root install and make it importable — the
 * one change that would undo M1's central boundary decision. Widening this file's
 * `include` has no such effect, which is exactly why the two must be reasoned about
 * separately. See `design.md` D8 in the `shared-domain-model` change.
 *
 * `passWithNoTests` is off, so a run that collects nothing fails rather than
 * reporting success. That is what makes the glob above a real assertion: a typo in
 * it cannot quietly reduce coverage to nothing. See
 * `openspec/specs/build-and-verification/spec.md`.
 */
export default defineConfig({
  test: {
    include: [
      "tests/architecture/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.tsx",
    ],
    // Kept `node`. A client test opts into jsdom with a per-file
    // `@vitest-environment jsdom` docblock; see the note above.
    environment: "node",
    // Intentionally not set to true. A test run that finds no tests must fail.
    passWithNoTests: false,
  },
});
