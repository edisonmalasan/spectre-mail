# build-and-verification Specification

## Purpose

Defines the `build-and-verification` capability: the toolchain the repository
verifies itself with, the single set of root commands that constitute a passing
check, and the requirement that a passing check asserts something. This exists
because a green command that inspects nothing is worse than no command — it
reads as coverage and is trusted as such.

## Requirements

*Appended at the rowser-verification sync stage (2026-10-05). The three requirements below are byte-identical to that change delta's ADDED block — checked mechanically, not by reading. Nothing above this line was touched.*

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

**A deferral names the milestone that owns it, and that milestone's arrival discharges the
deferral rather than renewing it.** The live host-permission check was deferred to "the milestone
that owns extension and provider infrastructure", and when that milestone is implemented the check
SHALL be performed and its real result recorded — whatever that result is. A deferral carried
forward past the milestone that owned it is not a deferral; it is a requirement nobody is reading,
and it is the state this rule exists to prevent.

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

#### Scenario: The owning milestone passes without performing it

- **WHEN** the milestone that owned a deferred check completes without performing
  it
- **THEN** the deferral SHALL be reported as undischarged
- **AND** it SHALL NOT be renewed against a later milestone without saying why

### Requirement: A second verification tier runs a real browser, separately from the first

The repository SHALL provide a documented command that drives the website in a real
browser, and it SHALL be **separate from the aggregate verification command**. The
aggregate command SHALL continue to run without a browser installed, because a gate that
cannot run on a contributor's machine is a gate whose result nobody waits for.

The browser command SHALL be invoked by CI, so a regression in what only a browser can
observe fails the build rather than being discovered later.

**Each client that needs a browser SHALL have its own suite and its own runner configuration.** A
client that is not a web page cannot be driven by a command that serves a web page's build output,
so the extension's suite loads the built extension into a real extension context instead. The two
suites SHALL NOT collect each other's specs, and every shipped browser spec SHALL be collected by
exactly one of them — a spec no suite collects reads as coverage while verifying nothing, which is
the same failure as a unit test placed where the runner's globs do not reach it.

The collection rule SHALL read each runner's configuration rather than a hard-coded path, so
narrowing a suite's test directory or match pattern is reported instead of passing.

#### Scenario: A maintainer verifies in a browser

- **WHEN** a maintainer runs the documented browser command from the repository root
- **THEN** it SHALL build the website and drive the built page in a real browser
- **AND** the result SHALL not depend on which directory the command was run from

#### Scenario: The aggregate verification runs without a browser

- **WHEN** the aggregate verification command runs on a machine with no browser installed
- **THEN** it SHALL succeed provided the other checks pass
- **AND** it SHALL NOT require a browser download

#### Scenario: A change that only a browser can observe

- **WHEN** a change is proposed to a pull request
- **THEN** CI SHALL run the browser command as its own check

#### Scenario: A second client needs a browser

- **WHEN** a client that is not a web page gains browser-driven specs
- **THEN** it SHALL have its own suite loading that client in its own real context
- **AND** the shipped-spec collection rule SHALL require each spec to be collected by exactly one
  suite

#### Scenario: A suite is narrowed to collect nothing

- **WHEN** a suite's test directory or match pattern is emptied while its specs remain on disk
- **THEN** the collection rule SHALL report it by name
- **AND** it SHALL NOT pass because the spec files are still present

### Requirement: A browser check issues no network request and says so

A check that drives a browser SHALL NOT contact a provider or any third-party origin
unless it is explicitly declared as a live check, and a live check SHALL NOT be part of
the routine verification a change is expected to pass.

This is a property to preserve rather than an accident to avoid. Every check in this
repository runs from recorded responses, which is what makes a red run diagnosable: it
means the repository's own behaviour changed. A browser check that reached a third party
would be the one check whose result could not say that.

#### Scenario: The browser check runs

- **WHEN** the browser command runs as part of routine verification
- **THEN** it SHALL contact no provider and no third-party origin
- **AND** provider responses it uses SHALL already be committed to the repository

#### Scenario: A live check is ever wanted

- **WHEN** a check would need to reach a live provider to establish its claim
- **THEN** it SHALL be recorded as live rather than added to routine verification
- **AND** the claim it would establish SHALL NOT be reported as established until it runs

### Requirement: The test-substrate boundary is explicit about which substrate is which

Where a property is established on a test substrate that is **not** the platform a user
runs on, the requirement asserting that property SHALL name the substrate and SHALL NOT
present the substrate's agreement with the platform as established.

A substrate that behaves differently from the platform is not a hypothetical concern. It
has already happened once in this repository: a probe built in a way that could not observe
the platform's real behaviour produced a confident and false claim, and it was caught only
because a test written afterwards disagreed with it.

#### Scenario: A property is established only on a substitute platform

- **WHEN** a requirement's property is asserted only against a substitute for the
        platform users run on
- **THEN** the requirement SHALL name that substitute
- **AND** it SHALL NOT state that the platform's behaviour is established

#### Scenario: Both substrates are available

- **WHEN** a property has been established on a substitute and later on the platform itself
- **THEN** the record SHALL state that the platform's behaviour was observed directly
- **AND** it SHALL NOT carry forward the substitute as the thing that was verified

### Requirement: Each client has its own build, and the root build reports each one

The repository SHALL expose a build command per client, and the root `build` command SHALL invoke
each of them. A client SHALL be buildable on its own, because the aggregate verification command
has to build each client without the other's output and without a browser installed.

The root `build` SHALL NOT report success for a client it did not build. The shared packages are
consumed as TypeScript source, so a successful build already says nothing about them; with two
build targets, a build that covers one and silently skips the other turns that sentence into a
false claim about a client rather than about the packages.

A client that must ship bundled output — an extension loads plain files and cannot resolve a bare
module specifier at runtime — SHALL declare its bundler, and a bundler not already in the
lockfile SHALL be recorded with its reason rather than arriving in a diff.

#### Scenario: The full gate runs

- **WHEN** a maintainer runs the root verification command
- **THEN** it SHALL type check, lint, format check, test, and build every client
- **AND** it SHALL succeed with no browser installed

#### Scenario: A client is built on its own

- **WHEN** a single client's build command runs
- **THEN** it SHALL emit that client's output
- **AND** it SHALL NOT require another client's build output

#### Scenario: A client produces no output

- **WHEN** a client's build emits nothing
- **THEN** the root build SHALL fail
- **AND** it SHALL NOT report success for that client

#### Scenario: A bundler is added

- **WHEN** a client needs a bundler not already in the lockfile
- **THEN** the reason SHALL be recorded
- **AND** a bundler already present SHALL be preferred over a new tool
