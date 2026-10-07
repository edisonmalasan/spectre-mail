# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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