# Spec Delta

## ADDED Requirements

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