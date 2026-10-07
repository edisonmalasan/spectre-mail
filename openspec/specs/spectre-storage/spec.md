# spectre-storage Specification

## Purpose

Gives clients one place to persist what SpectreMail knows about their own mailbox,
behind a single contract, so a reload can return a user to the address they were
using — and so a record read back from a device is treated as untrusted input
rather than as a value the product once wrote.

*Provenance: the first paragraph is the change delta's `## Purpose`, copied
verbatim at the sync stage, 2026-10-05. Nothing else was added then, because that
change's delta carried ADDED requirements only and modified none.*

**Correction, recorded at the M6 slice 3 sync stage (2026-10-05).** Two sentences
below this note were true when written and are not now, and they were corrected
**here rather than in a delta**. A `## Purpose` in a delta is ignored for a
capability that already exists, so a delta that tries would ship a correction
nobody applies — which is the general rule this repository now states rather than
discovers a second time.

This capability specifies the storage contract and the properties a client may
rely on. **It deliberately says nothing about *which* records a future slice will
persist**, because M10's verification workflow still owns that decision. That
sentence used to name M6's privacy controls alongside it, and to add that a
contract written ahead of them *"would carry operations no requirement
describes."* That reasoning has spent itself: `clearAll` is now an operation here
and a requirement describes it.

**This capability is delivered and consumed.** The website reached it at slice 2,
which is why this note used to say the opposite — it read *"delivered but not
consumed"*, with the reason given that no client read or wrote the layer. Slice 2
made that false, and slice 3 used all three operations: `loadMailbox` at boot,
`saveMailbox` for a mailbox the page was not handed, and `clearAll` when a user
asks this device to forget the address. The product now persists something.

`mailbox-session` still carries *A reload loses the session*, and that is now true
for the reason it was amended to state: the session is handed nothing. Adoption is
the client's, and this capability is where the value it hands over comes from.

## Requirements

*Appended at the rowser-verification sync stage (2026-10-05). The requirement below is byte-identical to that change delta's ADDED block — checked mechanically, not by reading. Nothing above this line was touched.*

### Requirement: Persistence is reached through one contract

A client SHALL reach its own persisted state only through the storage contract.
No client and no shared package other than the storage layer SHALL name a platform
storage API, and no shared package SHALL depend on the storage layer.

**Note, recorded during proposal.** This requirement is where the workspace's
storage boundary stops being a property of one package. `packages/mailbox` omits
the `DOM` library from its `tsconfig`, which rejects `window`, `document`, and
`location` at compile time — but it does **not** reject `localStorage`,
`sessionStorage`, or `navigator`, because `@types/node` declares all three and
`"types": []` does not exclude them. That was measured, and recorded in
`mailbox-session`'s `Purpose`. So the exclusion here is enforced by a check, not
by the compiler, and the check covers every package rather than the one whose
compiler configuration happened to be noticed.

#### Scenario: A client persists what it knows

- **WHEN** a client reads or writes SpectreMail's own state
- **THEN** it SHALL do so through the storage contract
- **AND** no platform storage API SHALL be named outside the storage layer

#### Scenario: The shared packages are inspected for a storage API

- **WHEN** every shared package's sources are scanned for a platform storage API
- **THEN** none SHALL be found outside the storage layer

#### Scenario: A shared package is asked to persist something

- **WHEN** a shared package outside the storage layer declares a dependency on it
- **THEN** the dependency SHALL be reported as a violation

### Requirement: A stored record is versioned

Every stored record SHALL carry a schema version. A record whose version this
build does not understand SHALL NOT be handed back as a mailbox.

**Note, recorded during proposal.** Versioning exists so that a later build can
tell "written by an older version" apart from "not a mailbox at all". Without it,
every record written before a schema change arrives as corruption, and the only
available response is to discard it.

#### Scenario: A record this build wrote is read back

- **WHEN** a record written by this build is read
- **THEN** its version SHALL be recognised
- **AND** the mailbox SHALL be returned

#### Scenario: A record carries an unknown version

- **WHEN** a record read from storage carries a version this build does not know
- **THEN** it SHALL NOT be returned as a mailbox
- **AND** it SHALL NOT be treated as an error

### Requirement: A stored record is validated before it is handed back

A record read from storage is untrusted input and SHALL be validated against the
shared model's own invariants before it is returned as a mailbox. A record that
does not satisfy them SHALL NOT be returned, and SHALL NOT be deleted by the read.

**Note, recorded during proposal.** The non-deletion is deliberate. Deleting a
record this build cannot read looks tidy and is irreversible data loss caused by a
code bug rather than by anything the user did — a model that gains a field would
otherwise destroy every stored mailbox the first time it ran. The record stays
readable by a build that understands it, and M6's privacy controls delete it when
the user asks.

#### Scenario: A well-formed record is read

- **WHEN** a record read from storage satisfies the model's invariants
- **THEN** the storage layer SHALL return it as a mailbox

#### Scenario: A record's credentials contradict the mailbox

- **WHEN** a record names one provider and carries another provider's credentials
- **THEN** it SHALL NOT be returned as a mailbox

#### Scenario: A record is not a mailbox

- **WHEN** a record read from storage does not satisfy the model's invariants
- **THEN** it SHALL NOT be returned as a mailbox
- **AND** reading it SHALL NOT remove it from storage

### Requirement: The storage layer hands back the model's own values and adds nothing

The storage layer SHALL store and return values of the shared model's own types,
and SHALL NOT store or return a provider's wire record. It SHALL persist only what
a caller handed it, and SHALL NOT add, infer, or derive a field — in particular it
SHALL NOT record a mailbox expiry, a cadence, or a provider status it did not
observe.

**Note, recorded during proposal.** `provider-adapters` already requires that
persisted credentials use the normalized credential shape and that no provider
wire field name appear in them, under *Credentials are captured in the provider's
own session model*. Returning the model's own `Mailbox` — which carries its
credentials inline — satisfies that requirement by construction rather than by a
second rule restating it.

#### Scenario: A mailbox is persisted and read back

- **WHEN** a mailbox is saved and then loaded
- **THEN** the loaded value SHALL be a mailbox of the shared model
- **AND** it SHALL carry the normalized credential shape
- **AND** no provider wire field name SHALL appear in the stored record

#### Scenario: A record arrives without a field the model requires

- **WHEN** a caller saves a value the model does not describe
- **THEN** the storage layer SHALL NOT persist it
- **AND** it SHALL NOT infer a value to complete it

### Requirement: "No stored mailbox" and "could not be read" are different results

A read SHALL report the absence of a stored mailbox as exactly that, and SHALL
report a failure to read as a failure. It SHALL NOT report a failed read as an
absent mailbox, and a failed read SHALL NOT change what is stored.

**Note, recorded during proposal.** This is the storage-layer form of the trap
`docs/PROVIDERS.md` §3 records: a dead Guerrilla session answers `HTTP 200` with
an empty inbox and no error, so "nothing there" and "nothing could be read" are
indistinguishable unless the product says which happened. Applied to storage the
consequence is worse than a wrong-looking inbox: a read reported as "nothing
stored" makes a client believe this is a first visit, create a new mailbox, and
overwrite the address the user came back for — with no error anywhere.

#### Scenario: Nothing has been stored

- **WHEN** a read finds no stored mailbox and the storage itself is readable
- **THEN** it SHALL report that no mailbox is stored
- **AND** it SHALL NOT report a failure

#### Scenario: The storage cannot be read

- **WHEN** a read fails because the store could not be opened, or its transaction
      did not complete
- **THEN** it SHALL report a failure
- **AND** it SHALL NOT report that no mailbox is stored

#### Scenario: A read fails after something was stored

- **WHEN** a read fails while a mailbox is stored
- **THEN** the stored mailbox SHALL remain stored
- **AND** a later successful read SHALL return it

### Requirement: A write is reported saved only once it is durable

A write SHALL NOT be reported as complete before the platform has committed it,
and a failure to commit SHALL be reported as a failure.

#### Scenario: The write commits

- **WHEN** a write is committed
- **THEN** it SHALL be reported as saved
- **AND** a read immediately afterwards SHALL return what was saved

#### Scenario: The write does not commit

- **WHEN** a write is rejected or its transaction is aborted
- **THEN** it SHALL be reported as a failure
- **AND** it SHALL NOT be reported as saved

### Requirement: The contract is verified without a browser, a network, or a provider

The contract SHALL have at least one implementation, that implementation SHALL be
exercised by the default verification gate, and the run SHALL NOT require a real
browser, a real network, or a provider.

#### Scenario: The verification gate runs

- **WHEN** the workspace's default verification gate runs
- **THEN** the storage implementation SHALL be exercised
- **AND** no step SHALL require a browser, a network, or a provider

#### Scenario: A failure the platform reports is exercised

- **WHEN** the implementation's failure paths are verified
- **THEN** each SHALL be driven by the verification gate itself
- **AND** no failure path SHALL be asserted only by inspection

### Requirement: The platform storage API is named only inside this layer

The storage layer SHALL provide the way a browser client obtains a working
storage implementation, and that entry point SHALL read the platform's own storage
API from inside this layer. No client and no shared package SHALL name a platform
storage API. Where the platform does not provide one, this layer SHALL report that
rather than substitute a different store or proceed without persistence.

**Note, recorded during proposal.** The existing requirement already says no client
may name a platform storage API, and this change is the first thing that would
make a client want to. The website's adapter needs a real `IDBFactory`, and
`createIndexedDbStorage` deliberately has no global default — its design recorded
that a default reaching for a platform timer or store is a path that compiles
happily and only runs in production.

So the tension was real: either the client names `indexedDB` and the requirement
becomes false, or the requirement is quietly weakened to "no *shared* package". The
second option was rejected because it would leave the client free to reach for a
different store the moment one was inconvenient. The resolution is a second entry
point that names the platform API in the one layer allowed to, which leaves both
the requirement and the injected-adapter rule exactly as they were.

#### Scenario: A browser client builds its storage

- **WHEN** a browser client asks this layer for a storage implementation
- **THEN** this layer SHALL supply one without the client naming a storage API
- **AND** the client's own sources SHALL contain no platform storage API

#### Scenario: The platform provides no storage

- **WHEN** a client asks for a storage implementation where the platform provides
      none
- **THEN** this layer SHALL report that storage is unavailable
- **AND** it SHALL NOT return an implementation that stores nothing

#### Scenario: The browser entry point is exercised

- **WHEN** the storage implementation for a browser is verified
- **THEN** it SHALL be exercised by the default verification gate
- **AND** that exercise SHALL NOT require a real browser

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

### Requirement: A chrome.storage adapter serves the same contract, and its differences are stated

`packages/storage` SHALL provide a `chrome.storage` adapter implementing `SpectreStorage`, and
it SHALL live beside the IndexedDB adapter rather than inside a client. The boundary rule that
forbids any file under `apps/` from naming a platform storage API SHALL NOT gain a carve-out for
it, because a carve-out would weaken a rule to accommodate a placement that does not need it.

The adapter's platform differences SHALL be documented rather than smoothed over. `chrome.storage`
has no transactions, so a write is confirmed by the platform's completion of that individual write
rather than by a transaction commit, and the durability the contract promises is delivered by that
confirmation. `chrome.storage` provides no `deleteDatabase` and therefore no blocked-removal event,
so `clearAll` removes the **whole** storage area — which satisfies the contract's "everything this
device holds" requirement more directly than the IndexedDB adapter can, and SHALL be recorded as a
platform difference rather than left to be discovered.

#### Scenario: A client needs persistence

- **WHEN** the extension needs to store or read a mailbox
- **THEN** it SHALL do so through the shared contract
- **AND** it SHALL NOT name `chrome.storage` itself

#### Scenario: A write is awaited

- **WHEN** `saveMailbox` resolves
- **THEN** the platform SHALL have confirmed the write
- **AND** the adapter's documentation SHALL state that this confirmation is per-write rather than
  transactional, because the platform has no transaction

#### Scenario: Everything local is removed

- **WHEN** `clearAll` is called
- **THEN** the whole storage area SHALL be emptied, including any key a later build adds
- **AND** it SHALL NOT remove only the key this build recognises

#### Scenario: A client would rather own the adapter

- **WHEN** an adapter for a platform store is placed under `apps/`
- **THEN** the architecture boundary test SHALL fail
- **AND** the rule SHALL NOT gain a client-level exemption for it

### Requirement: A stored record narrowed on the way out, whatever the platform

Both adapters SHALL validate and version the stored record through the **same** narrowing code, so
a record neither platform can read is neither surfaced nor deleted by either. A stored mailbox is
a user's identity on a device: a read reported as absent would make a client believe it is a first
visit, create a new mailbox, and overwrite the address the user came back for, with no error
anywhere in the product.

#### Scenario: A stored record is read

- **WHEN** either adapter reads what it previously wrote
- **THEN** it SHALL return the same mailbox the other adapter would return for that record
- **AND** it SHALL use the shared narrowing rather than a platform-specific parse

#### Scenario: A record this build cannot narrow is found

- **WHEN** a stored record fails to narrow
- **THEN** neither adapter SHALL surface it as a mailbox
- **AND** neither adapter SHALL delete it
