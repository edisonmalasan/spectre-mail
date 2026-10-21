# Spec Delta

## ADDED Requirements

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
