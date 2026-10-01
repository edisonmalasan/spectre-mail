# Establish the monorepo foundation

## Why

There is no application. The repository contains a disposable measurement
harness, two specification documents, and no build, no type checking, no tests,
and no CI. Every future change would otherwise be the first change to decide
where code lives, which tool owns it, and how it is verified — and those
decisions made implicitly, under time pressure, are how provider code ends up
inside a React component.

The roadmap anticipated exactly this. M1's goal is stated as "create a clean
repository before feature code spreads into the wrong locations", and the
architecture section fixes the boundaries in advance: shared packages own
product logic and provider code, the two apps are clients, and packages must
never import from apps. None of that is enforced by anything today. It exists
only as prose in `docs/ROADMAP.md`.

Two specific risks make this worth doing before any feature code:

- **Provider leakage.** The `provider-abstraction` capability forbids
  presentation code from containing a provider JSON field name. That is a
  requirement with no mechanism behind it. A boundary test makes it falsifiable
  from the first commit rather than discovered during M3 review.
- **Vacuous verification.** A workspace with no test files makes `pnpm test`
  pass without checking anything, which is worse than having no test command,
  because it reads as coverage. M1's acceptance criteria include a passing
  test run, so the run must actually assert something.

## What Changes

- **Initialise a pnpm workspace** covering `apps/*` and `packages/*`, with a
  single root lockfile.
- **Create the planned structure**: `apps/web` as a working Vite + React site,
  `apps/extension` as a documented placeholder, and the five shared packages
  `core`, `providers`, `mail-parser`, `storage`, `ui`.
- **Keep the M0 spike outside the workspace.** It stays at
  `tests/provider-spike/` with its own lockfile and is not a workspace member,
  so product code cannot import it even by accident. The prohibition becomes
  structural instead of advisory.
- **Add shared TypeScript configuration** with one base config that every
  package and app extends, so strictness cannot drift per package.
- **Add linting, formatting, and a test runner** — ESLint, Prettier, Vitest.
- **Add a boundary test** that enforces the roadmap's architecture rules:
  packages never import apps, apps never contain provider JSON field names, and
  provider-specific code lives only in `packages/providers`. This is what makes
  `pnpm test` meaningful at M1.
- **Add root scripts** so verification is invoked identically everywhere, and a
  **CI workflow** that runs exactly those scripts.
- **Add the `monorepo-foundation` and `build-and-verification` capability
  specs**, so the structure and the verification contract are specified rather
  than implied by whatever the first feature happens to do.
- **Record the deferred live host-permission test** as a requirement owned by
  the provider/extension milestone, without building it here.
- **Progressively complete `AGENTS.md`** with the toolchain facts M1 actually
  establishes, and only those.

## Non-Goals

- **No product behaviour.** No mailbox, no provider adapter, no message
  parsing, no storage, no UI component. M1 creates the containers and the
  rules; M2 and M3 fill them. Every placeholder module is empty of behaviour by
  design, and says so in its own source.
- **No extension implementation.** No `manifest.json`, no service worker, no
  extension build step. The roadmap schedules the extension build for M8. M1
  creates the directory and the explanation of why it is empty.
- **No website UI or visual design.** No components beyond the framework's
  starter, no styling, no Taste-skill application. Visual work begins at M7,
  and applying design tooling now would produce UI that M7 rewrites.
- **No deployment, hosting, or release pipeline.** CI verifies; it does not
  publish.
- **No new provider, and no change to the provider roles.** Mail.tm stays
  primary for the extension and Guerrilla Mail for the website, as specified in
  `openspec/specs/provider-abstraction/spec.md`.
- **No deletion of the spike.** It is the reproducible evidence behind
  `docs/PROVIDERS.md`, which must be re-runnable before release. M1 isolates it;
  retiring it is M3's decision once real adapters exist.
