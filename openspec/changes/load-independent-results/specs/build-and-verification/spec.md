# Spec Delta

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

