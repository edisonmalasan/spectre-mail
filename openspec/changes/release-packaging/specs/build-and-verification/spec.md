## ADDED Requirements

### Requirement: The repository states how a release is produced, and what each step does not establish

A document SHALL record the procedure a maintainer follows to produce a release candidate, and it
SHALL be the one place that procedure is written down. Every command it names SHALL be a command the
repository exposes, and the document SHALL state for each gate it names **what that gate establishes
and what it does not**.

**A procedure is not a checklist of green ticks, and the difference is measurable in this
repository.** `pnpm verify` runs with **no browser installed**; the browser suite runs with **no live
provider**; the provider adapters are driven by **recorded responses**; and no test here reads a
rendered pixel. **A release document that said "all checks pass" over those four gates would be
describing four different holes as one clean result**, which is the defect
`build-and-verification`'s own passing-run requirement exists to name.

**The document SHALL name every step that cannot be completed without a decision the repository
cannot make** — a place to deploy to, an account to publish under — and SHALL present them as
outstanding rather than as done. **A step recorded as outstanding is a record; a step omitted is an
assumption**, and the roadmap already carries both of this product's as product decisions.

**It SHALL NOT carry a version or a date as though either were generated.** The version lives in the
manifest a build reads, and a second copy of it in prose is the second spelling of a set this
repository records as a defect. **A step that has never been run SHALL be written as unverified
rather than as a pass.**

#### Scenario: A command the procedure names is not a command the repository exposes

- **WHEN** every command the document names is resolved against the repository's own scripts
- **THEN** a command that does not exist SHALL be reported by name
- **AND** the check SHALL read the scripts rather than a list of its own

#### Scenario: A step needs a decision the repository cannot make

- **WHEN** the procedure reaches a step that requires a deploy target or a publishing account
- **THEN** the document SHALL name that step as outstanding
- **AND** it SHALL NOT report the release as complete

#### Scenario: The document is read for a version

- **WHEN** the document is searched for a version number
- **THEN** it SHALL NOT carry one, because the built manifest is the only place a version lives
