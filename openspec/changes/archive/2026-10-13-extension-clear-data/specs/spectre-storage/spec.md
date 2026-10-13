# spectre-storage — delta

## MODIFIED Requirements

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

**There are two substrates this operation reaches, and this requirement was written about one of
them.** The single-mailbox record is kept in IndexedDB by the website and in a `chrome.storage`
area by the extension, and both adapters implement the same contract member. **A requirement whose
only scenario says "the database SHALL no longer exist" cannot be satisfied by an observation of a
storage area at all** — there is no database there to cease existing — so leaving this requirement
IndexedDB-only would leave every observation of the extension's removal unrecorded, which is the
defect this requirement exists to prevent. **The two substrates are named separately rather than
merged into one sentence**, because a claim written for one of them and satisfied by the other is the
shape this repository has recorded most often, and because a merge would have to invent a single
word for *"the platform's own listing is empty"* that neither platform uses.

**What this amendment does not do is claim the two substrates behave alike.** They differ, and the
difference is recorded by the requirement headed *"A chrome.storage adapter serves the same contract,
and its differences are stated"* — `chrome.storage` has no transactions, no `deleteDatabase`, and
therefore no blocked-removal event, so `clearAll` there removes the whole area. **No scenario about a
blocked removal is added for that substrate**, because a case that cannot be produced on a platform
would be a claim about nothing; and **the substitute's agreement is not asserted to be total.** The
agreement recorded for IndexedDB is the one this file already names. The agreement recorded for the
extension's substrate is narrower and is stated as what it is: **a record kind this build does not
recognise is planted in the substitute and is absent from the platform's own listing after a
removal, on both.**

#### Scenario: Removal on the platform itself

- **WHEN** removal is exercised in a real browser
- **THEN** the database SHALL no longer exist on the device afterwards
- **AND** the observation SHALL be recorded against this requirement

#### Scenario: Removal on the platform that holds the extension's records

- **WHEN** removal is exercised in a real browser against the `chrome.storage` area
- **THEN** the platform's own listing of that area SHALL hold no key afterwards
- **AND** that SHALL include a record kind this build does not recognise
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

**Amendment, recorded at proposal (2026-10-13), by `extension-clear-data`.** One scenario added and
one paragraph added; the three existing scenarios are carried verbatim and none was reworded. **The
IndexedDB scenario above is the one that established the platform observation this requirement
demands, and it is untouched because the observation it records still stands.** The added scenario is
the same claim about the second substrate, phrased in that substrate's own vocabulary — an area with
keys rather than a database with stores — because the alternative was a single sentence wearing both
substrates' clothes.

### Requirement: The message ids this device has been told about are a record kind of their own

The storage layer SHALL offer a contract for **the message ids a client has already reported for one
mailbox**, keyed by that mailbox's id. Reading a mailbox with nothing recorded SHALL report the
absence as an absence rather than as a failure, and the same distinction between *"nothing recorded"*
and *"could not be read"* that the single-mailbox contract requires SHALL hold here. A write SHALL
leave every entry it cannot read in place, and SHALL leave alone every entry belonging to a mailbox
other than the one being written.

**Why this is a contract and not a key read inside a client, recorded because it looks like the
smaller change.** `apps/extension/src/storage.ts` states the rule this repository holds - *"the
adapter stays in `packages/storage`; the client hands it a platform"* - and
`tests/architecture/boundaries.test.ts` fails the build when a client names a platform store. A raw
key read and write inside the client would put a second answer to *"what is a usable stored record"*
beside one this package already owns, and the two would drift.

**A `chrome.storage` adapter only, and no IndexedDB adapter, for the reason this file already gives
for the other two extension-only record kinds.** The website holds no reported ids and this change
gives it none, so an IndexedDB adapter would be an operation no page calls - and a record with no
consumer is a schema to migrate rather than a feature.

**Keyed by mailbox id rather than by host or by nothing at all, because the answer is about a
mailbox.** The ids mean nothing without the mailbox they were seen in: a list carried under a single
key would have to be emptied whenever this device watched a different mailbox, which would make every
new mailbox announce everything already in it. Keying by mailbox also means a stale entry is ignored
rather than misinterpreted - the same shape `SpectreSiteAssociations` gives a stale association.

**What this record kind does not have is now a removal, and it is reached through a contract this
requirement does not name.** The extension once shipped no control that removed this record kind, and
neither did it remove any of the extension's other three - the absence was recorded here as a
pre-existing gap belonging to a later change, and the side panel now carries the removal. **This
requirement still says nothing about how that removal is offered.** A client offering a control is a
client capability, and the one that now does is `extension-client`'s *"The side panel offers to remove
what this device holds, and says what that removed"*, where the confirmation, the reporting and the
wording live. **What this requirement says is only that the record kind is covered when removal
happens at all**, and it is covered because removal reaches the whole area through the single-record
contract's `clearAll` rather than through a member of this contract: the requirement headed *"A record
kind added by a later build is removed by the same control"* covers this kind, and it is **not**
amended to enumerate it, because a control that named four kinds by hand would be the narrower
implementation that same requirement exists to forbid.

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

**Amendment, recorded at proposal (2026-10-13), by `extension-clear-data`.** The sixth paragraph —
*"What this record kind does not have, stated rather than left for a reader to discover"* — is
**replaced**, and the replacement is what a `MODIFIED` block rather than a `REMOVED` one buys: the
requirement's contract, its scenarios and its reasoning all stand, and only the paragraph that had
become false is rewritten.

**The paragraph being replaced asserted two claims that are now false, and both are claims about the
absence of a control rather than about this contract.** It said *"The extension ships no control that
removes it"*, and the side panel now ships one. It said *"That gap is pre-existing for the extension's
other two record kinds and is not closed here"*, and both halves of that sentence are now wrong —
the gap is closed, and **the count was stale even before this change**: the extension keeps **four**
record kinds over one area (`apps/extension/src/storage.ts:68`–`:73`), so it is three others rather
than two. **The count was wrong inside the very block this change replaces, which is why the
replacement names the four kinds rather than carrying the number forward** — a number in prose about
a list the same prose does not enumerate is the defect this repository records most often.

**Nothing was added to this requirement about *how* removal behaves**, deliberately. The two-step
confirmation, the honest reporting of a refusal and the wording that says the address is not gone are
`extension-client`'s, because they are a client capability; and the whole-area property is
*"What this device holds can be removed on request"*'s and *"A record kind added by a later build is
removed by the same control"*'s, both of which already say it. **Duplicating either here would put a
client behaviour inside the storage layer, and would create a second place to keep in step.**
