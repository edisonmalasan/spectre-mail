# Tasks

## 1. Workspace foundation

- [x] 1.1 Create `pnpm-workspace.yaml` covering `apps/*` and `packages/*`, with a
      comment recording that `tests/provider-spike` is deliberately excluded and why
- [x] 1.2 Create the root `package.json` with `private: true`, the workspace
      scripts, and pinned dev dependencies
- [x] 1.3 Create `tsconfig.base.json` with the shared strict settings every
      package and app extends
- [x] 1.4 Add `.editorconfig`
- [x] 1.5 Extend `.gitignore` with workspace-specific entries, leaving the
      existing spike entries intact

## 2. Shared packages

- [x] 2.1 Create `packages/core` — `package.json`, `tsconfig.json` extending the
      base, and a `src/index.ts` placeholder that states its responsibility and
      contains no behaviour
- [x] 2.2 Create `packages/providers` the same way
- [x] 2.3 Create `packages/mail-parser` the same way
- [x] 2.4 Create `packages/storage` the same way
- [x] 2.5 Create `packages/ui` the same way
- [x] 2.6 Confirm no placeholder exports a stub, and that no package imports
      another package it does not need

## 3. Applications

- [x] 3.1 Create `apps/web` as a working Vite + React site that builds, lints,
      type checks, and serves from `pnpm dev:web`
- [x] 3.2 Create `apps/extension` as a placeholder only: `package.json` and a
      `README.md` recording that extension work starts after the website core is
      stable and that reusable logic must not be placed under `apps/web`
- [x] 3.3 Confirm `apps/extension` has no `manifest.json`, no service worker, and
      no build step, since the roadmap schedules those for M8

## 4. Tooling

- [x] 4.1 Configure ESLint with a flat config covering TypeScript and React
- [x] 4.2 Configure Prettier, with ESLint configured not to reformat
- [x] 4.3 Configure Vitest at the root, scoped so it does not execute the spike
- [x] 4.4 Add root scripts: `build`, `typecheck`, `lint`, `format`,
      `format:check`, `test`, `dev:web`
- [x] 4.5 Pin every dependency to the version that actually resolved in the
      lockfile, then re-install and confirm the tree is unchanged

## 5. Boundary enforcement

- [x] 5.1 Write the boundary test asserting no package imports an app
- [x] 5.2 Extend it to assert no file under `apps/` contains a measured provider
      JSON field name, reporting file and line
- [x] 5.3 Extend it to assert no file outside `packages/providers` references a
      provider adapter identifier
- [x] 5.4 Extend it to assert the spike is unreachable from any workspace member
- [x] 5.5 Prove the test can fail — deliberately introduce each violation,
      confirm a non-zero exit, then revert
- [x] 5.6 Confirm the test command fails rather than passes when no tests run

## 6. CI

- [x] 6.1 Add a GitHub Actions workflow running install, typecheck, lint,
      format check, and test
- [x] 6.2 Add the website build to CI
- [x] 6.3 Confirm CI invokes the same root commands as a maintainer, with no
      divergent flags
- [x] 6.4 Pin the CI runtime versions to the verified local versions

## 7. Documentation

- [x] 7.1 Add `docs/ARCHITECTURE.md` recording the boundaries, which package owns
      what, and why the spike is outside the workspace
- [x] 7.2 Rewrite `README.md` to cover only verified current facts: what
      SpectreMail is, current status, structure, provider roles, setup, verified
      commands, workflow, and the OpenSpec and roadmap relationships
- [x] 7.3 Document what each command proves **and does not prove**, per
      `AGENTS.md`
- [x] 7.4 Record the deferred live host-permission check against the milestone
      that owns extension and provider infrastructure, without claiming a result
- [x] 7.5 Update the `AGENTS.md` Stack section with only the tools and versions
      actually installed and verified
- [x] 7.6 Update the `AGENTS.md` Setup & Commands section with only commands
      actually run successfully
- [x] 7.7 Do not fill any `AGENTS.md` field whose verification does not yet exist

## 8. Verification

- [x] 8.1 `pnpm install` succeeds from a clean state
- [x] 8.2 `pnpm typecheck` succeeds
- [x] 8.3 `pnpm lint` succeeds
- [x] 8.4 `pnpm format:check` succeeds
- [x] 8.5 `pnpm test` succeeds **and** was proven able to fail
- [x] 8.6 `pnpm build` succeeds
- [x] 8.7 `pnpm dev:web` starts and actually serves the site, verified by
      requesting it rather than by observing the command exist
- [x] 8.8 Re-run the M0 spike self-test to confirm it still passes, since the
      workspace change must not have disturbed it
- [x] 8.9 Confirm the spike is still not a workspace member and its own install
      still works
- [x] 8.10 `openspec validate monorepo-foundation --strict` passes
- [x] 8.11 Independently verify no acceptance criterion is satisfied vacuously
