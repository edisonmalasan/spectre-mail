# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: A passing test run asserts something

The test command SHALL fail when an asserted property is violated. A test
command that succeeds with no tests, or with tests that cannot fail, does not
satisfy this capability.

**Amendment, recorded at proposal (2026-10-20).** The third scenario below is
the one the repository's own architecture suite does not satisfy, and it is
recorded here rather than left to be discovered.

**The exclusion a reader applies is a check, and a check narrower in scope than
the rule it documents is a failure of this capability.** The architecture suite's
reader-side exclusion was a filename *shape*, and it matched three of the seven
shapes the writing side actually stages: it did not match a staged name whose
case differs, one whose extension it does not name, or one whose name carries no
marker word at all. **The suite's own reader was therefore narrower than the
rule it documented, and nothing reported it.**

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
