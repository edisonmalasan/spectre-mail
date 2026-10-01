# Spec Delta

## Purpose

Defines the `build-and-verification` capability: the toolchain the repository
verifies itself with, the single set of root commands that constitute a passing
check, and the requirement that a passing check asserts something. This exists
because a green command that inspects nothing is worse than no command — it
reads as coverage and is trusted as such.

## ADDED Requirements

### Requirement: Verification is invoked through root commands

Install, build, type check, lint, format check, and test SHALL be invocable
through documented commands at the repository root, and those commands SHALL
cover every workspace member.

#### Scenario: A maintainer verifies the repository

- **WHEN** a maintainer runs the documented verification commands from the
  repository root
- **THEN** every workspace package and app SHALL be type checked and linted
- **AND** the website SHALL build
- **AND** the result SHALL not depend on which directory the command was run from

#### Scenario: A new package is added

- **WHEN** a package is added under `packages/`
- **THEN** the root type check and lint commands SHALL cover it without being
  edited to name it

#### Scenario: A command is run in CI

- **WHEN** the CI workflow verifies a change
- **THEN** it SHALL run the same root commands a maintainer runs locally
- **AND** it SHALL NOT reimplement the checks with different flags

#### Scenario: A maintainer verifies on the declared supported platform

- **GIVEN** a check's result depends on something outside the command itself,
  such as the working-tree line ending, the shell, or the filesystem
- **THEN** that dependency SHALL be pinned by a committed configuration file
  rather than inherited from each contributor's local Git or editor settings
- **AND** the same command SHALL produce the same result on the declared
  supported platform and on the CI runner
- **AND** a recorded result SHALL NOT depend on whether the working tree
  happened to be freshly written by the implementer

*Added by the M1 verification pass.* This scenario exists because the capability
as originally specified was satisfiable while a documented gate was broken. The
repository pinned Prettier's `endOfLine: "lf"` without a `.gitattributes`, so the
result depended on `core.autocrlf`: `pnpm verify` exited 1 on Windows and 0 in CI.
The original wording covered the *directory* a command runs from but not the
platform, so a green CI run could coexist with a permanently red local gate — and
the recorded result looked universal because it had no stated precondition.

### Requirement: A passing test run asserts something

The test command SHALL fail when an asserted property is violated. A test
command that succeeds with no tests, or with tests that cannot fail, does not
satisfy this capability.

#### Scenario: The test suite is empty

- **WHEN** no test files are present
- **THEN** the test command SHALL report failure or explicitly declare that no
  tests ran
- **AND** it SHALL NOT exit successfully as though coverage were achieved

#### Scenario: An architecture boundary is violated

- **WHEN** a package imports an app, or an app contains a provider field name
- **THEN** the test command SHALL fail
- **AND** the failure SHALL identify the file and the violated rule

#### Scenario: An assertion passes for the wrong reason

- **GIVEN** a test command reports success
- **THEN** each assertion it contains SHALL have been observed to fail when the
  prohibited condition is deliberately introduced
- **AND** a check that is narrower in scope than the rule it documents SHALL be
  treated as a failure of this capability, not as a passing check

*Added by the M1 verification pass.* Two of M1's seven assertions were green
while enforcing less than their documented rule: the import check matched only
`from "…"`, so dynamic and bare side-effect imports escaped it, and the adapter
check was scoped to `packages/` and `apps/`, so a root-level or `tests/` module
could name a provider adapter freely. Nothing detected this, because the tests
were being credited with a rule they did not carry.

### Requirement: Toolchain configuration is shared, not duplicated

Type checking configuration SHALL be defined once in a base configuration that
every package and app extends. Packages SHALL NOT weaken the shared strictness
to make their own type check pass.

#### Scenario: A package adds a compiler option

- **WHEN** a package needs an option the base configuration does not set
- **THEN** it SHALL be added in the package's extending config only if genuinely
  package-specific
- **AND** a relaxation of a shared strictness rule SHALL be justified in review

#### Scenario: Strictness drifts between packages

- **GIVEN** two packages have materially different strictness settings
- **THEN** the difference SHALL be deliberate and recorded
- **AND** it SHALL NOT be an unnoticed per-package default

### Requirement: Dependencies are pinned to resolved versions

Every dependency and dev dependency SHALL be recorded at an exact resolved
version, so a recorded version is a fact about the repository's dependency tree
rather than a claim about what a registry would return later.

#### Scenario: A version is recorded in documentation

- **WHEN** a tool version appears in `AGENTS.md` or the README
- **THEN** it SHALL be the version actually installed and verified in this
  repository
- **AND** it SHALL NOT be quoted from memory or from an external source

#### Scenario: The workspace is installed on another machine

- **WHEN** a clean install runs from the committed lockfile
- **THEN** it SHALL resolve the same versions as the verified local tree

### Requirement: The website development server starts

A documented command SHALL start the website development server, and that
command SHALL be verified to actually serve the site rather than only to be
defined.

#### Scenario: The development command is verified

- **WHEN** the development server is started during M1 verification
- **THEN** it SHALL be confirmed to respond and serve the application
- **AND** a command that exists but fails to start SHALL NOT be reported as met

### Requirement: Deferred verification is recorded, not silently dropped

A verification that cannot be performed because its infrastructure does not yet
exist SHALL be recorded with the milestone that owns it. It SHALL NOT be
reported as passing, and it SHALL NOT be satisfied by building throwaway
production code.

#### Scenario: A check needs infrastructure that does not exist

- **WHEN** a required check depends on a component that has not been built, such
  as a live browser-extension provider check
- **THEN** it SHALL be recorded as deferred against the milestone that will own
  the component
- **AND** the known measured fact it depends on SHALL still be recorded
- **AND** no passing result SHALL be claimed for it

#### Scenario: The infrastructure later appears

- **WHEN** the milestone that owns the component is implemented
- **THEN** the deferred check SHALL be performed and its real result recorded
