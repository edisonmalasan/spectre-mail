# Spec Delta

## ADDED Requirements

### Requirement: A diagnostic that persists nothing is not a record this device keeps

The document's enumeration of what this device keeps SHALL cover **every record kind the shipped
tree persists**, and a diagnostic that is never persisted SHALL NOT appear in it. The document SHALL
say **that a diagnostic exists and persists nothing**, and that statement SHALL be **checkable
against the tree** rather than asserted beside it.

**Why this is stated rather than left to the enumeration, and the reason is a gap the enumeration's
own check has never had to notice.** The *does not collect* list's last row claims *"No persisted
state anywhere outside the two areas named in sections 1 and 2"*, and grounds that claim in the
requirement that a client reaches persisted state only through the storage layer's contracts. **That
requirement does not say what the claim needs it to say** -- it names the layer, not the number of
kinds, and its own amendment added a second and a third record kind as their own contracts. **The
requirement permits exactly what the claim forbids**, and the grounding check cannot see the
difference, because it proves a pointer *resolves* and the requirement's own note says *"Grounding
is not completeness."* **This is not a completeness gap. It is a support gap**, and the check has
no shape for it.

**So the claim is made true rather than re-grounded, and the check that makes it true is of the
kind the tree can answer**: that **nothing the diagnostic holds is written to any store, in any
area**. A claim about the tree is checkable; a claim about what a requirement *ought* to say is not,
and **widening the grounding check to try would be a research project wearing a check's clothes.**

**A diagnostic is not a record kind, and the difference is the whole of it.** A record kind is
something the device keeps because the product needs it later; a diagnostic is a report of what
happened, which the product needs **now** and which the person reads **now**. **A thing that is
persisted is a record; a thing that is not is not**, and this requirement keeps that distinction
sharp in the document rather than leaving it to a reader to infer from the absence of a table row.

#### Scenario: The document names a diagnostic

- **WHEN** the document is read
- **THEN** it SHALL say that a diagnostic exists, that it reports counts and outcomes only, and that
  it is persisted nowhere
- **AND** the diagnostic SHALL NOT appear in the document's enumeration of records this device keeps

#### Scenario: A diagnostic is written to a store

- **WHEN** the shipped tree is inspected for a write of a diagnostic's value
- **THEN** the check SHALL fail and SHALL name the file and the value it found
- **AND** the check SHALL fail on the write rather than on the presence of a record kind

#### Scenario: The enumeration and the tree disagree

- **WHEN** the document enumerates the records this device keeps
- **THEN** every record kind the shipped tree persists SHALL appear in the enumeration
- **AND** every row of the enumeration SHALL correspond to something the tree persists