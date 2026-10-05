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
substrate, and the measurement is the reason this requirement forbids waiting:
`deleteDatabase` fires `onblocked` when another connection holds the database, and
**it does not complete afterwards even once that connection closes**. A
implementation that awaited the request would therefore hang rather than report. The
adapter's `openDatabase` already rejects on `onblocked` for exactly the same
reason, and the two paths now behave alike.

That measurement is a statement about `fake-indexeddb`, which is not a browser. It
is recorded as the reason the blocked path is exercised rather than trusted, not as a
claim about what a real browser does — a real browser queues the delete and
completes it when the connections close, which is precisely the behaviour an
implementation may not *rely* on without being able to observe it.

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
- **AND** it SHALL NOT wait indefinitely for the block to clear
- **AND** what was stored SHALL remain stored

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