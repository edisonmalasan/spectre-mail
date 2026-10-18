# Spec Delta

## MODIFIED Requirements

### Requirement: The mailboxes this device can insert are a record kind of their own

The storage layer SHALL offer a contract for **the mailboxes this device holds**, distinct from
the one that holds the single current mailbox, and it SHALL report them newest first so that the
first is unambiguously the current one. Adding a mailbox SHALL be one operation against one record,
and a client SHALL NOT have to write two records to record a mailbox it was handed.

**Every platform a client reaches SHALL be served by an adapter for this contract.** A client that
holds a mailbox on a platform where only the single-mailbox record is writable SHALL NOT be left
with a contract it cannot use, and the reason an adapter is absent SHALL NOT be that no client
needed one.

**The current mailbox and the head of this collection SHALL agree, and a client SHALL NOT be able to
write them apart.**

**Amendment, recorded during sync (2026-10-18).** Two things change here, and both were found by
measuring what this repository had decided rather than by reading the requirement as a description.

**The first is a decision reversed.** This requirement previously ended with:

> *"the current mailbox is left where it is rather than replaced by the collection's head: the
> website's requirement names a single stored address, and **nothing here changes what the website
> does**."*

**That sentence was a decision about where the product was going**, written by `site-associations`
when the collection existed to make the `hostname -> mailbox id` mapping possible, and it is now
reversed: M13's release list carries *mailbox history* — *"Allow multiple recent mailboxes where the
provider session still permits access"* — and the website is the client that item is about. **A
decision that has been reversed cannot be left standing beside the reversal**, so it is withdrawn
rather than softened, and what replaces it is narrower and testable: **the head of this collection
and the mailbox the single-mailbox contract reports are the same mailbox**, so one read answers both
questions.

**The second is a word doing two jobs.** *Insertable* — what this contract's name says — is not
*listed*, and the scenario below has been carrying one meaning as both since the contract was
written. That was harmless while one client used it; with a website holding several mailboxes it is
not, because **a mailbox can be listed and not offerable and offerable and not listed**, and a rule
that says the first SHALL be insertable would, read the other way, say a website may stop listing an
address it still holds.

**And a consequence the amendment adds by removing the fiction.** This requirement's sibling requires
that removal not be satisfied by clearing only the records this build recognises, and that has been
proved with a **planted store this build does not recognise**. Once the single-mailbox store and
this collection's store both exist **in the shipped database**, the proof is the product's own shape
rather than a store planted beside it.

#### Scenario: A mailbox this device was handed

- **WHEN** a client records a mailbox on this device
- **THEN** one operation SHALL record it
- **AND** the mailbox SHALL be readable back through the same contract
- **AND** the head of this collection and the mailbox the single-mailbox contract reports SHALL be
  that mailbox

#### Scenario: Several mailboxes are held

- **WHEN** this device holds more than one mailbox
- **THEN** the contract SHALL report them newest first
- **AND** the first SHALL be the mailbox an insertion on a page would use

#### Scenario: This device also holds a mailbox from an earlier build

- **WHEN** the collection holds at least one mailbox and the single-mailbox record holds another
- **THEN** the collection's answer SHALL be the whole answer
- **AND** the earlier mailbox SHALL NOT be reported as insertable
- **AND** **that limit is about what a client offers as an address to use, and is not a statement
  that the mailbox has been removed or may be forgotten**
- **AND** a client listing what this device holds SHALL NOT narrow that list by the same rule, because
  **listed and insertable are different questions and a mailbox may answer one and not the other**

#### Scenario: Nothing is held

- **WHEN** this device holds no mailbox
- **THEN** the contract SHALL report an empty collection rather than a failure
- **AND** a failure to read SHALL still be reported as a failure

#### Scenario: The same mailbox is recorded twice

- **WHEN** a mailbox already held by this device is recorded again
- **THEN** it SHALL appear once in the collection
- **AND** it SHALL be reported as the newest

#### Scenario: A client holds a mailbox on a platform

- **WHEN** a client records a mailbox on a platform this repository serves
- **THEN** an adapter for this contract SHALL exist for that platform
- **AND** a client SHALL NOT be left unable to use a record kind the layer offers
- **AND** the reason an adapter is absent SHALL NOT be that no client needed one yet

#### Scenario: A mailbox was recorded before this build

- **WHEN** a device holds a mailbox that predates this collection
- **THEN** the record kind holding it SHALL be reachable for as long as the provider permits access
- **AND** a client offering what this device holds SHALL NOT lose the mailbox

#### Scenario: Removal is asked for

- **WHEN** a client asks the layer to remove what this device holds
- **THEN** both the single-mailbox record and this collection SHALL be removed
- **AND** the proof SHALL rest on stores this build creates rather than on a planted one alone