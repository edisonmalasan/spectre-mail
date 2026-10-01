# Design: monorepo foundation

## Context

M1 must satisfy six acceptance criteria — `pnpm install`, `build`, `test`,
`typecheck`, `lint`, and `dev:web` — against a repository that currently has no
package manifest at the root, no TypeScript, and no build. The roadmap fixes the
directory structure and the package responsibilities but leaves the tooling
mechanism open, so the decisions below are mine to make and are recorded here
because a later session would otherwise have to reverse-engineer them.

The binding constraints, from `docs/ROADMAP.md` and
`openspec/specs/provider-abstraction/spec.md`:

- The structure is `apps/web`, `apps/extension`, `packages/{core,providers,
  mail-parser,storage,ui}`, `docs`, `tests`.
- Shared packages must never import from the apps.
- No React component may understand a provider's JSON.
- Provider-specific code outside `packages/providers` requires explicit
  justification.
- The M0 spike must never be imported by an application.

## Goals / Non-Goals

**Goals**

- Every acceptance criterion passes for a real reason, not a vacuous one.
- The architecture boundaries become mechanically enforced, not documented.
- Toolchain choices are minimal and individually justified, so M2 does not
  inherit machinery nobody asked for.

**Non-Goals**

- Any product behaviour. The domain model is M2, the provider contract is M3.
- Extension build tooling, which the roadmap schedules for M8.
- Visual design, which begins at M7.

## Decisions

### 1. The M0 spike stays outside the workspace

`pnpm-workspace.yaml` lists `apps/*` and `packages/*` only. The spike keeps its
own `package.json` and its own `pnpm-lock.yaml`.

**Why not absorb it.** Absorbing looks tidier and the roadmap's status note
allows either "retired or absorbed". Three reasons against:

- It carries `playwright@1.63.0` as a dev dependency. Inside the workspace, every
  `pnpm install` at the root pulls Playwright's package graph for contributors
  who will never run the spike.
- It would gain a `typecheck` and `lint` obligation it cannot meaningfully meet,
  because it is hand-rolled `.mjs` with no types — producing either permanent
  suppressions or a permanently failing gate.
- The roadmap's constraint is that product code must not import the spike.
  Workspace exclusion makes that **structurally impossible**. Documentation makes
  it a rule someone can violate. The stronger guarantee is worth a slightly
  untidy directory.

It is not deleted. It is the reproducible evidence behind `docs/PROVIDERS.md`,
which the roadmap requires be re-runnable before release. Retiring it is M3's
decision, once real adapters exist to replace it.

**Consequence to record:** the root `test` script must not sweep `tests/` blindly,
or it will execute the spike's harness. The boundary test is scoped explicitly.

### 2. Internal packages are consumed as TypeScript source

Each package's `package.json` points `exports` at `./src/index.ts`. There is no
per-package build step, and no bundler.

**Why.** A package build layer means choosing a bundler, a `tsc` emit strategy,
declaration output, and a watch mode — four decisions that exist to serve code
that does not exist yet. Vite compiles workspace TypeScript directly, so
source-consumption works today with zero extra machinery.

**Consequence.** `pnpm build` builds only what has something to build:
`apps/web`. Package correctness is established by `pnpm typecheck`, which is a
separate acceptance criterion. This is stated plainly rather than hidden behind
a `build` script that quietly does nothing.

**Revisit when:** a package must be consumed by something that is not Vite — a
Node script, a test runner with different resolution, or a published artifact.
That is the moment to add a real build, and it is a deliberate future change
rather than a retrofit.

### 3. Placeholder modules are empty of behaviour, and say so

Each package has a `src/index.ts` containing a file-level comment naming its
responsibility and stating that M1 creates no behaviour. No stub functions, no
placeholder exports, no `throw new Error("not implemented")`.

**Why.** This is the line AGENTS.md's `full-output-enforcement` rule would
otherwise push me across. That rule governs completeness of a *requested slice*;
it explicitly must not expand scope. Here the requested slice is the containers
and the rules, so a stub mailbox manager would be scope creep dressed as
thoroughness — and it would be dead code that M2 must delete.

**Why a file at all, rather than an empty directory.** `tsc` fails with "No
inputs were found" on a project with no source, so an empty package cannot be
typechecked at all. A single documented file makes the typecheck gate real.

**Consequence.** `packages/providers/src/index.ts` must not export a provider
interface yet. The `MailProvider` contract belongs to M3's spec, and inventing
it here would front-run a decision that has not been made.

### 4. The boundary test is the point of the test runner

`tests/architecture/boundaries.test.ts` asserts the roadmap's rules against the
real tree:

- no package imports from `apps/*`;
- no file under `apps/*` contains a provider JSON field name;
- no file outside `packages/providers` references a provider adapter identifier;
- the spike is not reachable from any workspace package.

**Why.** Two of the `provider-abstraction` requirements are currently
unenforceable prose. "No presentation component contains a provider JSON field
name" is exactly the kind of rule that survives review for a long time and is
violated once, under deadline, by someone who did not know it existed. A test
costs about forty lines and makes it fail loudly instead.

**Why this is in scope for M1 rather than M3.** The rule protects the repository
from the moment code starts landing, which is M2. A test added in M3 would have
allowed M2 to violate it first. The roadmap's M1 goal is explicitly to stop
"feature code spread[ing] into the wrong locations".

**On the provider-field-name check.** It matches a fixed list of field names
measured from both providers' responses, recorded in `docs/PROVIDERS.md`. It is
a known-weak heuristic — a variable may legitimately share a name — so it is
scoped to `apps/*`, where provider wire format has no legitimate reason to
appear, and it reports the offending file and line rather than just failing.
It is a tripwire, not a proof of absence.

### 5. Lint, format, and test stay separate commands

`pnpm lint` runs ESLint. `pnpm format:check` runs Prettier. `pnpm test` runs
Vitest. CI runs all three.

**Why not fold Prettier into `lint`.** They answer different questions and fail
for different reasons. Folding them makes a formatting failure look like a code
defect, and makes `lint` unusable as a pre-commit hook on files that are
correctly formatted but not yet lint-clean. The roadmap lists them as separate
tasks, so they get separate commands.

### 6. The extension is a placeholder, not a shell

`apps/extension` gets a `package.json` and a `README.md`. It gets **no**
`manifest.json`, no service worker, and no build step.

**Why.** The roadmap schedules the extension build for M8 and M1's own task list
says only "create placeholder `apps/extension`", with a `README.md` explaining
that extension work starts after the website core is stable. A manifest with
placeholder permissions would be worse than nothing: it would look like a
working extension, and host permissions are the exact area where M0 measured a
silent-failure trap. An absent manifest cannot mislead.

The placeholder is a workspace member so it is structurally present, typechecked,
and visible to the boundary test — but with no source, it contributes no build
output.

### 7. Versions are pinned to what actually resolved

Dependencies are installed with caret ranges, then the resolved versions are read
from the lockfile and written back as exact pins, and the install is repeated to
confirm the pins resolve to the same tree.

**Why.** `AGENTS.md` says to pin versions where exact versions matter, and to
record only what was verified. A version written from memory or from a blog post
is unverified. Reading the lockfile makes every recorded version a fact about
this repository's actual dependency tree.

## Risks / Trade-offs

- **The boundary test will produce false positives.** A file in `apps/web` may
  legitimately use a variable named `list` or `error`, which are on the measured
  provider-field list. Accepted: the failure names the file and line, and fixing
  it means renaming a local variable. The alternative is a weaker test that
  misses real leakage. The list is deliberately the measured fields only, not a
  broad word list.
- **`pnpm build` builds only the website.** Packages are not emitted. Accepted and
  documented in the README, because the alternative is a build layer for code
  that does not exist. Revisit at the first non-Vite consumer.
- **ESLint and Prettier can disagree.** Both are configured; Prettier owns
  formatting, ESLint is configured not to reformat. A file can still be
  Prettier-clean and ESLint-clean only if both pass, and CI runs both.
- **The workspace has no tests beyond the boundary test.** `pnpm test` is
  thin at M1 by definition. It is not vacuous, but it is not coverage, and the
  README says so.
- **Playwright stays outside the workspace**, so `pnpm install` at the root will
  not install it. Anyone wanting to re-run the spike must install in that
  directory explicitly. This is recorded in the README and in `AGENTS.md`.

## Migration Plan

Additive. No existing behaviour changes: the spike keeps working exactly as
documented, because it is not touched and not made a workspace member. The only
modification to an existing file is `.gitignore`, which gains workspace-specific
entries.

Rollback is `git revert` of the merge commit. Nothing depends on this change
yet, because no product code exists.

## Open Questions

- **Should packages be published, or always internal?** Every current consumer is
  in-repo, so internal. If a package is ever needed outside the repo, it needs a
  real build and a publish pipeline. Deferred until a real consumer exists.
- **Which package owns the boundary test?** It is placed in `tests/architecture`
  as a root-run test rather than inside a package, because it asserts a property
  of the whole repository and belongs to no single package. Revisit if the
  workspace test strategy changes.
- **Does the extension need its own lint overrides for MV3 globals?** It has no
  source yet, so the question cannot be answered without inventing code.
  Deferred to M8.
