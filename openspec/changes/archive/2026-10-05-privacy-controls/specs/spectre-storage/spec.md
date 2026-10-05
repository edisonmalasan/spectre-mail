# Spec Delta

## ADDED Requirements

### Requirement: What this device holds can be removed on request

The storage contract SHALL offer a way to remove everything this device holds, and
that operation SHALL mean *everything*. It SHALL NOT be implemented by removing only
the records this build recognises, because a record kind added by a later build
would then survive a control the user was told clears all of it.

Removal SHALL be reported as a failure rather than waited on when the platform
blocks it, and SHALL be reported as complete only once the platform has committed
it. Removing when nothing is stored SHALL succeed rather than report a failure,
because the outcome the user asked for is the state they are already in.

Removal SHALL be reached through the storage contract, like every other operation
on what this device holds.

**Note, recorded during proposal (2026-10-05).** The clause that removal means
*everything* is the one worth defending, because the alternative compiles and looks
correct. Deleting the one key this build knows about is a smaller function than
deleting the database, it passes every test written against today's single record,
and it produces a privacy control that quietly stops being one the moment a second
record kind appears — with no failing test, because nothing tested the guarantee.
Removing the whole database instead also removes anything a future version wrote,
which is what the words on the button mean.

The blocked case was measured rather than assumed, on this repository's own test
substrate, and the measurement corrected the reason this requirement gives for
reporting instead of waiting. `deleteDatabase` fires `onblocked` when another
connection holds the database; while the removal is pending **a fresh read cannot
complete either**, and **once the holding connection closes the queued removal goes
through on its own.**

So reporting is not a substitute for waiting — it is the only available answer,
because the wait ends when some *other* tab closes, which a page can neither cause
nor predict. And because the refusal does not cancel the queued removal, a refusal
may say that nothing was removed and may **not** say that the data remains: a moment
after the refusal it may be gone. A caller that told the user "your address is still
saved" would be promising something the platform is already in the middle of
breaking.

**Amendment, recorded during apply (2026-10-05).** This note originally claimed a
blocked delete "does not complete afterwards even once the blocking connection
closes", and the blocked scenario below carried a matching clause requiring that what
was stored remain stored. Both were written from a probe whose promise had already
resolved on `onblocked`, so it could not have observed the request afterwards; the
claim was an artifact of how the probe was built rather than a property of the
platform. Writing the tests found it, because the test asserting that the record
survived a refusal failed by finding it gone. The clause requiring that what was
stored remain stored is therefore **removed** — it was not merely imprecise but
false, and the scenario now states the property that is actually observable.

Idempotence is measured rather than assumed too: deleting a database that does not
exist succeeds. Without that, a user who cleared their data twice, or cleared on a
device that stored nothing, would meet an error for having achieved what they asked
for.

#### Scenario: Everything held on the device is removed

- **WHEN** removal is requested
- **THEN** everything this device holds SHALL be removed
- **AND** anything held under a record kind this build does not recognise SHALL be
      removed with it

#### Scenario: Removal is reported complete only once it has happened

- **WHEN** removal reports success
- **THEN** a read immediately afterwards SHALL find nothing stored

#### Scenario: Nothing is stored

- **WHEN** removal is requested and nothing is stored
- **THEN** it SHALL succeed
- **AND** it SHALL NOT report a failure

#### Scenario: Another connection blocks removal

- **WHEN** the platform blocks removal because another connection holds the data
- **THEN** it SHALL report a failure
- **AND** it SHALL NOT wait for the block to clear
- **AND** it SHALL NOT report that anything was removed
- **AND** it SHALL NOT state that what was stored remains stored

#### Scenario: Removal fails

- **WHEN** removal is refused or does not complete
- **THEN** it SHALL report a failure
- **AND** it SHALL NOT report that nothing is stored

#### Scenario: The device is used again afterwards

- **WHEN** something is stored after a successful removal
- **THEN** it SHALL be stored
- **AND** a later read SHALL return it

#### Scenario: Removal is reached without the contract

- **WHEN** every client and every shared package outside the storage layer is
      inspected for a way to remove stored data
- **THEN** none SHALL be found
- **AND** no platform storage API SHALL be named outside the storage layer