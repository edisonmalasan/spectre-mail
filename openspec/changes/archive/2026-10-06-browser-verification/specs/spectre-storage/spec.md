# Spec Delta

## ADDED Requirements

### Requirement: Removal is observed in a browser, not only against a test substitute

The removal operation SHALL be observed on the platform a user's browser actually
provides, and what that observation established SHALL be recorded. Asserting against a
substitute for IndexedDB establishes this repository's mapping onto that substitute and
nothing more; the claim worth making is about the platform.

The substitute remains in the suite, because it drives real `onblocked` events from a real
held-open connection and does so without a browser. **What changes is the record, not the
test count**: the substitute's agreement with a browser is now a measured thing rather
than an assumption, and a requirement that says which is which is the durable form of
that.

**Note, recorded during proposal (2026-10-05).** This requirement exists because the
privacy control this milestone shipped is the claim in this repository least entitled to
confidence. It deletes a user's address on request, it was verified only against a
substitute, and it shipped anyway — correctly, since the alternative was shipping nothing
and a control that has never been run is better than no control provided the gap is named.
Naming it is what this requirement does.

#### Scenario: Removal on the platform itself

- **WHEN** removal is exercised in a real browser
- **THEN** the database SHALL no longer exist on the device afterwards
- **AND** the observation SHALL be recorded against this requirement

#### Scenario: The substitute's agreement is stated

- **WHEN** this requirement describes what removal does
- **THEN** it SHALL state that the substitute agrees with the platform on the observed
        behaviour
- **AND** it SHALL NOT present the substitute alone as establishing the platform's
        behaviour

#### Scenario: The substitute diverges from the platform

- **WHEN** the substitute and the platform are observed to disagree
- **THEN** the platform's behaviour SHALL be the one recorded as correct
- **AND** the substitute's behaviour SHALL NOT be treated as authoritative
