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
 * The second entry was added at M2, when `packages/core` gained real tests:
 *
 *   tests/architecture/, any depth   cross-cutting repository boundary assertions
 *   any shared package's src, any depth   unit tests beside the code they cover
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
    include: ["tests/architecture/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    environment: "node",
    // Intentionally not set to true. A test run that finds no tests must fail.
    passWithNoTests: false,
  },
});
