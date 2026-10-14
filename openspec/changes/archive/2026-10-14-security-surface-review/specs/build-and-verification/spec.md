# Spec Delta

## ADDED Requirements

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