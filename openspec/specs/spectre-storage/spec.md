# spectre-storage Specification

## Purpose

Gives clients one place to persist what SpectreMail knows about their own mailbox,
behind a single contract, so a reload can return a user to the address they were
using — and so a record read back from a device is treated as untrusted input
rather than as a value the product once wrote.

*Provenance: the first paragraph is the change delta's `## Purpose`, copied
verbatim at the sync stage, 2026-10-05. Nothing else was added, because this
capability's delta carried ADDED requirements only and modified none.*

This capability specifies the storage contract and the properties a client may
rely on. It deliberately says nothing about which records a future slice will
persist, because M6's privacy controls and M10's verification workflow own those
decisions and a contract written ahead of them would carry operations no
requirement describes.

**This capability is delivered but not consumed.** The layer and its IndexedDB
adapter exist and are verified, and no client reads or writes them, so the
product does not yet persist anything. `return to a recent mailbox` belongs to the
slice that adopts a stored mailbox, which is why `mailbox-session` still carries
*A reload loses the session* and this capability does not amend it.

## Requirements

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
