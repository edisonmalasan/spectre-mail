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
 * At M1 this suite contains the architecture boundary test and nothing else.
 * That is a real assertion, not an empty pass: `passWithNoTests` is left OFF, so
 * a run with no test files fails rather than reporting success. See
 * `openspec/changes/monorepo-foundation/specs/build-and-verification/spec.md`.
 */
export default defineConfig({
  test: {
    include: ["tests/architecture/**/*.test.ts"],
    environment: "node",
    // Intentionally not set to true. A test run that finds no tests must fail.
    passWithNoTests: false,
  },
});
