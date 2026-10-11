# Spec Delta

Adds one requirement to `spectre-storage`, for the record kind the extension's background check needs
to survive between wakes.

## ADDED Requirements

### Requirement: The message ids this device has been told about are a record kind of their own

The storage layer SHALL offer a contract for **the message ids a client has already reported for one
mailbox**, keyed by that mailbox's id. Reading a mailbox with nothing recorded SHALL report the
absence as an absence rather than as a failure, and the same distinction between *"nothing recorded"*
and *"could not be read"* that the single-mailbox contract requires SHALL hold here. A write SHALL
leave every entry it cannot read in place, and SHALL leave alone every entry belonging to a mailbox
other than the one being written.

**Why this is a contract and not a key read inside a client, recorded because it looks like the
smaller change.** `apps/extension/src/storage.ts` states the rule this repository holds — *"the
adapter stays in `packages/storage`; the client hands it a platform"* — and
`tests/architecture/boundaries.test.ts` fails the build when a client names a platform store. A raw
key read and write inside the client would put a second answer to *"what is a usable stored record"*
beside one this package already owns, and the two would drift.

**A `chrome.storage` adapter only, and no IndexedDB adapter, for the reason this file already gives
for the other two extension-only record kinds.** The website holds no reported ids and this change
gives it none, so an IndexedDB adapter would be an operation no page calls — and a record with no
consumer is a schema to migrate rather than a feature.

**Keyed by mailbox id rather than by host or by nothing at all, because the answer is about a
mailbox.** The ids mean nothing without the mailbox they were seen in: a list carried under a single
key would have to be emptied whenever this device watched a different mailbox, which would make every
new mailbox announce everything already in it. Keying by mailbox also means a stale entry is ignored
rather than misinterpreted — the same shape `SpectreSiteAssociations` gives a stale association.

**What this record kind does not have, stated rather than left for a reader to discover.** **The
extension ships no control that removes it.** The website's two-step removal reaches its own IndexedDB
store and this contract has no adapter there, so a person who installs the extension and later wants
these ids gone has no surface that offers it. That gap is pre-existing for the extension's other two
record kinds and is not closed here; closing it is a control on a surface this change does not touch.
The requirement below therefore says nothing about removal, and the general clause in *"A record kind
added by a later build is removed by the same control"* covers this kind when a removal surface
exists — which is why that requirement is **not** amended here to enumerate it.

#### Scenario: Messages have been reported for a mailbox

- **WHEN** a client records the message ids it has reported for a mailbox
- **THEN** reading that mailbox back SHALL return those ids
- **AND** the ids for another mailbox SHALL NOT be returned

#### Scenario: Nothing has been recorded for that mailbox

- **WHEN** a client reads a mailbox with no recorded ids
- **THEN** the contract SHALL report that nothing is recorded
- **AND** it SHALL NOT report a failure

#### Scenario: The read cannot be completed

- **WHEN** the record cannot be read
- **THEN** the contract SHALL report a failure
- **AND** it SHALL NOT report the absence of a record

#### Scenario: This device now watches a different mailbox

- **WHEN** a client writes the ids for one mailbox while ids are recorded for another
- **THEN** the other mailbox's ids SHALL be left exactly as they were

#### Scenario: A record that cannot be narrowed

- **WHEN** a stored record holds an entry this build cannot read
- **THEN** the contract SHALL NOT return that entry
- **AND** it SHALL NOT delete it

#### Scenario: The contract is offered to a client that would not use it

- **WHEN** the contract's adapters are listed
- **THEN** a `chrome.storage` adapter SHALL exist
- **AND** no IndexedDB adapter SHALL exist for it