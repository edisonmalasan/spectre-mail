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

**Amendment, recorded at proposal (2026-10-20).** The third scenario below is
the one the repository's own architecture suite does not satisfy, and it is
recorded here rather than left to be discovered.

**The exclusion a reader applies is a check, and a check narrower in scope than
the rule it documents is a failure of this capability.** The architecture suite's
reader-side exclusion was a filename *shape*, and it matched three of the twenty-three
stems the writing side actually stages: it did not match a staged name whose
case differs, one whose extension it does not name, or one whose name carries no
marker word at all. **The suite's own reader was therefore narrower than the
rule it documented, and nothing reported it.**

**And a result SHALL NOT depend on the machine rather than on the tree.** A test run
whose outcome is a function of the machine's load has measured nothing, and **a green that means
only that the machine was idle is a claim about nothing** -- which is the same defect as the red
one above, read from the other side. **A wait establishes a precondition and an assertion measures
a property**, and **a budget is not a wait**: where the assertion's own question is expensive to
ask, the wait SHALL establish the precondition by a cheaper question and the assertion SHALL then
ask its question once, rather than the budget being enlarged until the expensive question fits.

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
- **AND** **a reader's exclusion of a shape SHALL count as such a check**, and
  SHALL be measured against the set of names the writing side stages rather than
  against a pattern for what those names might look like

#### Scenario: A failure that does not measure a property is not a result

- **GIVEN** a test run reports a failure
- **THEN** the failure SHALL name the property it measured
- **AND** **a failure that appears and disappears without the tree changing SHALL NOT be reported as
  a result**, because a red that means only that the machine was busy is worse than no red at all

#### Scenario: A pass that depends on the machine is not a result

- **GIVEN** a test run reports success
- **THEN** the success SHALL NOT be a function of the machine's load
- **AND** **a pass that appears and disappears without the tree changing SHALL NOT be reported as
  a result**, because a green that means only that the machine was idle is a claim about nothing

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

### Requirement: A shipped security audit's claims are checked against the tree

This repository SHALL ship a security audit that names, for each area it reviews, the
requirement that governs that area and the instrument that enforces it, and every
claim the audit makes about a requirement SHALL be resolvable against the
specifications as they stand.

**A security audit that cannot go stale is not a document; it is a claim.** Every
figure in this repository's ledgers has at some point been carried forward for a
milestone without being re-measured, and the audit's claims are the same kind of
figure: a citation of a requirement heading, in a document nothing has to update when
that heading is renamed or removed. **A reader arriving at a stale citation cannot
tell it is stale**, which is the specific failure this requirement exists to prevent.

The audit's rows SHALL each resolve to a requirement that exists, and a citation
that resolves to nothing SHALL be reported rather than skipped — **a sweep matching
nothing satisfies every claim above it, and the exemption is then indistinguishable
from a pattern that stopped firing.** This repository has recorded that shape as its
most repeated instrument defect, and this instrument is built to fail in the
direction it is aimed at.

**The audit is not required to be complete, and the requirement says so.** It states
what a shipped audit owes a reader, not that every area of the product is covered by
one. An area with no requirement governing it is a row with no requirement in it, and
**that row is the finding** — so the instrument resolves citations and does not
require every area to have one.

#### Scenario: The audit's citations are resolved

- **WHEN** every requirement the audit cites is resolved against the specifications
- **THEN** each SHALL resolve to a heading that exists in a capability this
  repository ships
- **AND** a citation that resolves to nothing SHALL be reported by name rather than
  skipped

#### Scenario: The audit's own reader can fail

- **WHEN** a citation naming a requirement that does not exist is introduced into the
  audit
- **THEN** the check SHALL report it
- **AND** the reader the check uses SHALL itself be exercised against a citation
  known to resolve, so that a reader which resolves nothing cannot pass by finding
  nothing

#### Scenario: An area has no requirement governing it

- **WHEN** an area of the review carries no requirement and no instrument
- **THEN** the audit SHALL say so for that area
- **AND** the check SHALL still pass, because an uncovered area is a finding the audit
  reports rather than a defect in the audit

#### Scenario: A requirement is renamed

- **WHEN** a cited requirement heading is renamed and the citation is not
- **THEN** the check SHALL fail and name the citation
- **AND** the fix SHALL be the citation rather than the exemption, because an audit
  that stops being checked is one that stops being true without saying so

### Requirement: A shipped branding review names every surface the public name reaches, and says which of its checks it could not measure

A document that publishes the result of a branding review SHALL name every shipped surface
the public name reaches, and SHALL state for each check it reports whether the check was
measured, by what instrument, and with what control that instrument was shown to work. A
check that produced no measurement SHALL be recorded as unmeasured and SHALL NOT be
reported as a clear result.

**This requirement exists because the review's verdict is only as good as the evidence
under it, and both halves of that are checkable.** The roadmap's branding item has never
been run, so there was no document and no evidence; the review that runs it is shipped
with both.

**The surface list is the part that can be checked against the tree, and it is checked in
both directions.** Every surface the review names must exist and render the one public
name, and every place the shipped tree names the product as the product must be in the
review's list. This is the shape `privacy-disclosure` already requires of what a device
keeps, and it is what stops a document from being right about the surfaces it happened to
mention.

**The external checks cannot be checked against the tree at all, and the requirement says
so rather than pretending otherwise.** A registry's answer about a domain, a store's
answer about an extension and a trademark register's answer about a mark are measurements
of the world on a date. **No test in this repository can re-run them, and an instrument
that claimed to would be a check that could not fail.** They are therefore carried in
prose, each with its instrument and its control.

**A control is not decoration; it is what decides whether a reported zero is a finding.**
A reader whose control query did not resolve is a reader that cannot distinguish "nothing
is there" from "I found nothing", and a zero from such a reader is the absence of a
measurement. **This repository has recorded a check reporting a collection failure as
green, a rate reader reporting nothing as measured, and a mutation that did not apply
passing a comparison it never performed** — every one of them a zero produced by a reader
rather than by the thing measured. **The review SHALL therefore state, for each check,
whether its control resolved, and SHALL report a check with an unresolved control as
unmeasured.**

#### Scenario: The review is checked against the tree

- **WHEN** the review's surface list is compared with the shipped tree
- **THEN** every surface it names SHALL exist and SHALL render the exported public name
- **AND** every place the tree names the product as the product SHALL appear in the
  review's list
- **AND** a disagreement in either direction SHALL be reported by name

#### Scenario: A check's control did not resolve

- **WHEN** the review reports a check whose control query produced no readable result
- **THEN** that check SHALL be recorded as unmeasured
- **AND** it SHALL NOT be reported as a clear result or as a passed check

#### Scenario: The review's verdict is read

- **WHEN** the review states the outcome of the branding review
- **THEN** it SHALL carry the date the measurements were taken
- **AND** it SHALL state which checks were not measured and why they could not be

#### Scenario: A measurement is quoted from a source

- **WHEN** the review reports what a registry, a store or a directory said
- **THEN** it SHALL name the instrument that asked and the control that proved the
  instrument worked
- **AND** a figure taken from a secondary summary SHALL be attributed to that summary
  rather than presented as a measurement

### Requirement: The architecture suites do not share a mutable corpus

The repository's architecture suites SHALL NOT read a corpus that another suite mutates while the
read is in progress. **Where a suite stages a file into the tree a rule reads, the staged file's
name SHALL come from one shared vocabulary, and every reader that walks the tree SHALL skip every
name that vocabulary carries, before touching the filesystem.**

**Why the name, and not a shape, is what is matched.** A shape-based exclusion is a guess about the
forms a future staged file might take, and this repository has recorded the defect that guess
becomes: *"a rule per probe is a rule that is easy to forget, and a probe nobody adds to this file
is a probe whose cost nobody has reasoned about."* **A shared vocabulary is not a guess** — the
suite that stages a file takes its name from the vocabulary, and the suite that reads skips the
vocabulary, **so the two cannot disagree about what a staged file is called.**

**And the vocabulary SHALL be spelled once.** A pattern spelled in two places is a pattern that will
be repaired in one of them, and **this repository has recorded that a second spelling of a set is the
defect.**

**And the vocabulary SHALL be complete, and that SHALL be checkable.** The check SHALL compare the
names the suites stage against the vocabulary, **and it SHALL report a staged name the vocabulary
does not carry** — because a vocabulary nothing checks is a list that drifts.

#### Scenario: A staged file is never read by another suite

- **WHEN** one architecture suite stages a file into the tree another suite walks
- **THEN** the walking suite SHALL NOT read it
- **AND** it SHALL skip it by name, **before** touching the filesystem, so that the deletion of a
  staged file cannot turn the skip into a failure to read

#### Scenario: A staged name the vocabulary does not carry is reported

- **GIVEN** a suite stages a file under a name the shared vocabulary does not carry
- **THEN** the completeness check SHALL report that name
- **AND** the check SHALL NOT pass by finding no violation, because a staged file nothing reports is
  a staged file the vocabulary does not know about

#### Scenario: The vocabulary is spelled once

- **WHEN** the shared vocabulary is consulted
- **THEN** every suite that stages or skips SHALL consult the same one
- **AND** **no second copy of the set of staged names SHALL exist**, because a second spelling is a
  set that will be repaired in one place only

#### Scenario: A suite that stages and re-walks carries a time budget

- **WHEN** a suite stages a file and then walks a whole tree
- **THEN** it SHALL carry a per-test budget above the default
- **AND** that budget SHALL be one shared decision, **not one file's private copy of it**
- **AND** **a timeout SHALL NOT be reported as a failure of a property the assertion does not
  measure**, because a timeout means only that the machine was busy

### Requirement: The architecture suite leaves the tree it reads unchanged

The repository's architecture suites SHALL NOT leave the tree they read modified, **under any
outcome**, and a run that is interrupted SHALL leave nothing behind.

**Why the property is about the tree and not about the rules.** A suite that proves a rule by
mutating a shipped file and undoing the mutation in a `finally` has made the tree's state depend on
whether the process was killed, **and the tree's state is what every later run reads.** A later run
that finds the previous run's artefact is red about the previous run, and **a red that is about a
previous run is not a measurement of anything.**

**And the artefacts this property covers are tracked files.** A staged probe left behind is a new
file, and a shipped file left mutated is **a modification that can be committed** — the website's own
markup, or the repository's root manifest.

**Why a `finally` is not enough.** A `finally` runs when a test ends normally or by throwing; **it
does not run when the worker is killed for exceeding its timeout**, and the mutation is on disk
across the timeout. **So the safety SHALL NOT depend on the cleanup running** — the tree a suite
reads SHALL be a tree the suite cannot have written.

**And the rules that walk the tree SHALL skip the suite's own staged files, and a control SHALL ask
for an exception for the one it staged.** A staged file that the rules report as a violation makes
a leftover fatal to the next run, **and a control that proves a rule by calling something other than
the rule proves nothing about the rule.**

#### Scenario: A suite that stages a violation leaves the tree unchanged

- **WHEN** an architecture suite runs, whether it passes or fails
- **THEN** every tracked file's content SHALL be **byte-identical** to what it was before the run
- **AND** no file SHALL have been added to the tree and left behind
- **AND** the comparison SHALL be made **against Git** rather than against a remembered value

#### Scenario: A shipped file is never written by a test

- **GIVEN** a rule that proves itself by mutating a shipped file
- **THEN** the mutation SHALL land on a **disposable copy** of the tree
- **AND** the shipped file SHALL NOT be written at all, **so that a run killed between the mutation
  and its cleanup leaves the shipped file exactly as it was**

#### Scenario: An interrupted run leaves nothing behind

- **GIVEN** a run that is killed while a rule is proving itself
- **THEN** the tree SHALL be **unchanged** afterwards
- **AND** **the safety SHALL NOT depend on the cleanup having run**, because a cleanup that a kill
  prevents is not a cleanup

#### Scenario: A leftover staged file does not make the next run red

- **GIVEN** a staged file left behind by an earlier run
- **THEN** the rules that walk the tree SHALL NOT report it as a violation
- **AND** **a control SHALL still be able to prove the rule finds its own staged violation**, by
  asking the rule for an exception for that one file — **and the exception SHALL be a member of the
  shared vocabulary, so the check that says the vocabulary is complete still covers it**

#### Scenario: The suite's footprint is checked from outside the suite

- **WHEN** the architecture suite's footprint on the tree is checked
- **THEN** the check SHALL run **outside the suite**, because a check that runs inside the thing it
  checks runs after the damage
- **AND** it SHALL report **the paths that changed**, not a count
