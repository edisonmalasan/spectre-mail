# Spec Delta

## Purpose

Records one property the website did not hold, found by running it in a browser rather
than in a substitute for one.

## ADDED Requirements

### Requirement: What the page reports about its storage survives a re-render during a write

The website's report of whether it holds an address SHALL be established by a **completed
write**, and SHALL NOT be withdrawn by a re-render, an inbox transition, or any other
state change occurring while that write is still in flight.

A page that has written a record and does not know it has written one is a page that
cannot offer the removal `website-client` requires of it, because the removal control is
reachable only from the knowledge that something is stored. **The two requirements are
one requirement in practice**, and the failure is invisible from the storage layer,
which behaved correctly.

**Note, recorded during apply (2026-10-05).** This requirement exists because the
requirement it protects shipped and was then measured false on the platform a user runs
on. The browser tier added by this change reported, verbatim,
`databases=["spectre-mail"] records=1 claimsStored=0 offersRemoval=0`: the record was
written, and the page did not know it.

The cause was a guard that conflated two different things. It existed to prevent a
`setState` after unmount, and it was scoped to a single effect **invocation** rather than
to the component — so the effect's own cleanup, run when the inbox published a new state
object mid-write, withdrew the guard before the write resolved, and the success branch
that records the write as confirmed was skipped. Unmount is a property of the
component. A re-render is not an unmount.

#### Scenario: A re-render arrives while the write is still in flight

- **GIVEN** the page is writing the mailbox it holds and the write has not resolved
- **WHEN** the inbox publishes a state transition, re-rendering the page
- **THEN** the page SHALL still report holding the address once the write resolves
- **AND** it SHALL offer the removal `website-client` requires

#### Scenario: The page is asked to report before the write has finished

- **WHEN** the page has begun a write that has not resolved
- **THEN** it SHALL NOT report holding the address yet
- **AND** it SHALL report it once the write resolves, whatever else happened meanwhile

#### Scenario: The component is genuinely unmounted mid-write

- **WHEN** the page is torn down while a write is in flight
- **THEN** the resolved write SHALL NOT update state on a page that no longer exists
- **AND** the guard that achieves this SHALL NOT be withdrawn by a re-render

### Requirement: Deferred and recorded work is not reported as delivered

Where an implementation reveals that an approved requirement is not met, the change
SHALL record that requirement as **not met**, with the measurement that shows it, and
SHALL NOT present the surrounding work as though the requirement were satisfied.

An unmet requirement found during implementation is not an inconvenience to be absorbed
into the change's own success. It is the most valuable thing an implementation stage can
find, and recording it as a note inside a green result is the one treatment that loses
it.

#### Scenario: A requirement is found unmet during implementation

- **GIVEN** an approved requirement the change's own verification exercises
- **WHEN** that verification finds the requirement is not met
- **THEN** the requirement SHALL be recorded as not met, with the measurement
- **AND** the change's plan SHALL be amended rather than the requirement worked around

#### Scenario: The requirement is met after the repair

- **WHEN** the defect is repaired
- **THEN** a check SHALL observe the repaired behaviour on the platform the user runs on
- **AND** it SHALL be a check that would have failed before the repair

#### Scenario: A substitute platform hid the defect

- **GIVEN** a property asserted only against a substitute for the platform users run on
- **WHEN** the property is exercised on the platform itself
- **THEN** a disagreement SHALL be recorded as a defect in the product
- **AND** it SHALL NOT be dismissed as a difference between the substitute and the
        platform

#### Scenario: The substitute is what was wrong

- **WHEN** the platform's behaviour and the substitute's disagree
- **THEN** the platform's behaviour SHALL be the one treated as correct
- **AND** the substitute SHALL NOT be carried forward as the thing that was verified
