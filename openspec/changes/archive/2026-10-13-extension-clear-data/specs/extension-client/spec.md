# extension-client — delta

## ADDED Requirements

### Requirement: The side panel offers to remove what this device holds, and says what that removed

Where the side panel has established that this device holds something, it SHALL offer a way to
remove it and SHALL say what removing it means. **The offer SHALL require an explicit further step
before anything is removed, and the control that performs the removal SHALL exist only in that
confirmed state** — a panel whose removal control was present before the further step would make the
confirmation a formality. Removal SHALL be reported honestly whatever its outcome.

**Removal SHALL remove everything this device holds, and it SHALL reach that through the shared
storage contract's whole-area operation rather than by naming the records this build recognises.**
The extension keeps four record kinds over one `chrome.storage.local` area — the single stored
mailbox, the collection of mailboxes, the site associations, and the message ids this device has been
told about — and the panel names none of them. **A removal that removed only the records the panel
knew by name would pass every test written against those four**, and the record kind it left behind
is precisely the kind a person asking to be forgotten would be asking about.

**After a completed removal the panel SHALL report that it holds nothing for SpectreMail**, rather
than continuing to render an inventory this device no longer has. **What the panel's copy states is
that removal deleted _this device's note of_ the mailbox**, and it SHALL NOT claim that the address is
gone: the mailbox exists at the provider, and this product is not the provider's authority on when it
discards one. **The mailbox SHALL remain on screen and its inbox SHALL remain usable afterwards**, and
the panel SHALL NOT write that mailbox back into storage while the person does nothing further.

**Removal SHALL be reached only through the contract**, and the panel's record type SHALL gain no
member that writes. A surface that could both remove and record is a surface whose write-back the
next change could add without this requirement noticing; the property that the panel does not restore
what a person removed is discharged by the type having no outlet, not by a scan for the absence of
one.

**Every sentence the region shows SHALL be a `PANEL_COPY` entry.** That module exists so a claim is
reviewable beside the requirement it serves and a test can read what the panel says without scraping
rendered text for it, and a sentence written inline in the component is a claim a reviewer reads in
its markup context rather than beside its requirement.

**Note, recorded at proposal (2026-10-13), by `extension-clear-data`.** This requirement is `ADDED`
to `extension-client` and is deliberately **not** a copy of `website-client`'s *"The user can make this
device forget the address"*, though that requirement is the model for four of its clauses: `design.md`
D1 names the four website clauses that do not transfer and why. **Two are absent rather than
rewritten** — the panel renders no description of what it stores, so the website's *"SHALL NOT
describe stored data as undeletable while offering no way to delete it"* clause has nothing to govern
here and `extension-client`'s *"The extension declares its non-goals"* is the nearer analogue; and the
website's refusal copy about closing another tab is a claim about `deleteDatabase`'s blocked-removal
queueing, which **this substrate cannot produce at all** (`packages/storage/src/chrome.ts:218` records
that `chrome.storage` provides no `deleteDatabase` and therefore no blocked-removal event).

**And the gap this closes is written into a promoted requirement**, at
`openspec/specs/spectre-storage/spec.md:702`–`:709`: *"The extension ships no control that removes
it… That gap is pre-existing for the extension's other two record kinds and is not closed here."* Both
halves of that sentence are false the moment this control ships, and the prose is corrected by the
second `MODIFIED` block in this change's `spectre-storage` delta rather than left standing.

#### Scenario: This device holds something

- **WHEN** the panel is displayed and it has established that this device holds something
- **THEN** it SHALL offer a way to remove it
- **AND** it SHALL NOT offer that way before the boot read has established anything

#### Scenario: Removal is confirmed before it happens

- **WHEN** the panel offers removal
- **THEN** the control that performs the removal SHALL exist only after a further explicit step
- **AND** nothing SHALL be removed before that step is taken
- **AND** the further step SHALL be a region this panel renders rather than a dialog the platform owns

#### Scenario: The confirmed removal takes everything

- **WHEN** the further step is taken
- **THEN** everything this device held SHALL be removed through the storage contract's whole-area
      operation
- **AND** it SHALL NOT be removed by naming the record kinds this build recognises
- **AND** a record kind written through a contract the panel never named SHALL be removed with it

#### Scenario: The panel reports holding nothing afterwards

- **WHEN** removal has happened
- **THEN** the panel SHALL report that it holds nothing for SpectreMail
- **AND** it SHALL offer no further removal

#### Scenario: What removal means is stated

- **WHEN** removal has happened
- **THEN** the panel SHALL say that what was removed is this device's note of the mailbox
- **AND** it SHALL NOT state or imply that the address itself is gone
- **AND** it SHALL say the address still works until the provider discards it

#### Scenario: The mailbox stays shown and is not written back

- **WHEN** removal has happened and the person does nothing further
- **THEN** the mailbox SHALL remain on screen
- **AND** its inbox SHALL remain usable
- **AND** the extension SHALL write no storage record of that mailbox again

#### Scenario: Removal is refused

- **WHEN** removal fails
- **THEN** the panel SHALL say it did not happen
- **AND** it SHALL NOT describe the data as removed
- **AND** it SHALL NOT state that the data remains

#### Scenario: This device holds nothing

- **WHEN** the panel is displayed and this device holds nothing
- **THEN** it SHALL offer no removal
- **AND** it SHALL say that nothing is kept on this device

#### Scenario: What the panel knows is not yet established

- **WHEN** the panel has not established whether this device holds anything
- **THEN** it SHALL NOT say that something is kept
- **AND** it SHALL NOT say that nothing is kept
