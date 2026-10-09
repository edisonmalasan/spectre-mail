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

A client SHALL reach its own persisted state only through the storage layer's contracts.
No client and no shared package other than the storage layer SHALL name a platform
storage API, and no shared package SHALL depend on the storage layer.

**Amendment, recorded at proposal (2026-10-08), by `site-associations`.** This requirement
said **"the storage contract"**, in the singular, and this change makes that false: a second and a
third record kind are added beside `SpectreStorage` rather than inside it. **The boundary it draws is
unchanged and is the half that mattered** — a client still reaches persisted state only through this
layer, and no client and no shared package names a platform storage API — so the amendment is to the
**number of contracts**, not to the exclusion. `packages/storage/src/contract.ts` is the reason the
change needed asking about at all: it says the contract "has room for one of" M6's **five** named
record kinds, and **a site association is not one of the five**, so a sixth kind could not be added
under this requirement's own scope statement without answering it.

**Why the new kinds get their own contracts rather than widening this one, recorded because the
alternative compiles.** Widening `SpectreStorage` would have been one interface instead of three,
and it would have required both adapters to implement the new operations — so the website's IndexedDB
adapter would gain a record kind it never reads or writes. That is the argument this contract already
makes about itself: "a record with no consumer is a schema to migrate rather than a feature." A
contract with a narrower name and one consumer is a smaller thing to keep correct than a wider one
with two, so the plural is the honest form.

**Note, recorded during proposal (M6 slice 1).** This requirement is where the workspace's
storage boundary stops being a property of one package. `packages/mailbox` omits the
`DOM` library from its `tsconfig`, which rejects `window`, `document`, and
`location` at compile time — but it does **not** reject `localStorage`,
`sessionStorage`, or `navigator`, because `@types/node` declares all three and
`"types": []` does not exclude them. That was measured, and recorded in
`mailbox-session`'s `Purpose`. So the exclusion here is enforced by a check, not
by the compiler, and the check covers every package rather than the one whose
compiler configuration happened to be noticed.

#### Scenario: A client persists what it knows

- **WHEN** a client reads or writes SpectreMail's own state
- **THEN** it SHALL do so through one of the storage layer's contracts
- **AND** no platform storage API SHALL be named outside the storage layer

#### Scenario: The shared packages are inspected for a storage API

- **WHEN** every shared package's sources are scanned for a platform storage API
- **THEN** none SHALL be found outside the storage layer

#### Scenario: A shared package is asked to persist something

- **WHEN** a shared package outside the storage layer declares a dependency on it
- **THEN** the dependency SHALL be reported as a violation

#### Scenario: A record kind is added to the layer

- **WHEN** a further record kind is given its own contract in the storage layer
- **THEN** a client SHALL still reach it only through that contract
- **AND** no client SHALL be required to implement an operation it does not use

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

Each record kind SHALL be validated and versioned through **one** narrowing function, and every
adapter serving that kind SHALL use it rather than a parse of its own, so a record no adapter can
read is neither surfaced nor deleted by any of them. A stored mailbox is a user's identity on a
device: a read reported as absent would make a client believe it is a first visit, create a new
mailbox, and overwrite the address the user came back for, with no error anywhere in the product.

**Amendment, recorded at proposal (2026-10-08), by `site-associations`.** This said **"Both
adapters SHALL validate and version the stored record"**, which names two adapters and one record.
Both halves are now false, and neither is false in the same way. **Two adapters is now a property of
one record kind rather than of the layer**: the two new kinds are served by the `chrome.storage`
adapter alone, because the extension is their only client, so a rule written for a fixed pair would
either force an IndexedDB adapter nobody uses or stop describing what exists. **One record is now
one of several**, and the rule that survives is *one narrowing function per kind, shared by every
adapter serving it* — which is the property the pair was an instance of.

**And one consequence is worth stating because it is the opposite of this requirement's usual
worry.** Where a single record fails to narrow, the whole record is unusable, and the existing note
records why that is the safe direction. A **collection** makes that unsafe: one unreadable member
would take every sibling with it, so the amplification has to be designed out rather than accepted.
Each mailbox in the collection is therefore stored as the **same versioned record the mailbox itself
uses**, and one member this build cannot narrow is **skipped while its siblings survive** — and
**skipped, not deleted**, because deleting on a failed narrow is the irreversible data loss the
existing note already refuses.

#### Scenario: A stored record is read

- **WHEN** any adapter reads a record of a kind it previously wrote
- **THEN** it SHALL return what the other adapter for that kind would return
- **AND** it SHALL use that kind's shared narrowing rather than a platform-specific parse

#### Scenario: A record this build cannot narrow is found

- **WHEN** a stored record fails to narrow
- **THEN** no adapter SHALL surface it
- **AND** no adapter SHALL delete it

#### Scenario: One member of a collection cannot be narrowed

- **WHEN** a stored collection holds one member this build cannot narrow among members it can
- **THEN** the members it can narrow SHALL still be returned
- **AND** the member it cannot SHALL be left in place rather than removed

#### Scenario: A second adapter appears for a kind

- **WHEN** an adapter is added for a record kind that already has one
- **THEN** it SHALL use that kind's existing narrowing function
- **AND** a second parser for the same kind SHALL be reported as a violation

### Requirement: The mailboxes this device can insert are a record kind of their own

The storage layer SHALL offer a contract for **the mailboxes this device holds**, distinct from the
one that holds the single current mailbox, and it SHALL report them newest first so that the first is
unambiguously the current one. Adding a mailbox SHALL be one operation against one record, and a
client SHALL NOT have to write two records to record a mailbox it was handed.

**Why a collection rather than a second mailbox field, recorded because the reason is the product's
own.** This product stores **one** mailbox per device: both adapters write it under one key, and a
second creation overwrites the first, which `create-mailbox.test.ts` already asserts by expecting
the save called twice. That is right for the website, which is one page holding one address, and it
is what makes a `hostname -> mailbox ID` mapping meaningless — **the roadmap's site mapping presumes
more than one mailbox per device, and a map written against one can only ever name it.** So the
collection is added rather than the mapping being narrowed to fit, and the current mailbox is left
where it is rather than replaced by the collection's head: the website's requirement names a single
stored address, and nothing here changes what the website does.

**One write, and that is not only a convenience.** `chrome.storage` has no transactions, so a design
that wrote "the current mailbox" and "the mailbox is in the collection" as two operations could leave
the device holding an address its own collection does not know. One record removes the question, and
the requirement says so because the cost of finding out otherwise is a client that offers an address
nothing can account for.

**Amendment, recorded during apply (2026-10-09).** Two things are added here, and both were found by
reading this delta against the code after twenty-one mutations and a green `pnpm verify` had already
passed against it.

**The single-mailbox record is read but not written, and the collection is not merged with it.**
Every write in the extension moved onto `addMailbox`, so a device that recorded its mailboxes
through this build has them in the collection and **nowhere else**. Two consequences are now stated
rather than left for a reader to derive: the single-mailbox contract is the **only** place a mailbox
recorded by an earlier build can be found, and it is therefore consulted **only** while the
collection is empty; and **a mailbox recorded before this build stops being offered once this device
records another one** — still stored, still readable, and no longer insertable, because no surface
in this milestone can present a second address to choose from. Merging the two records is refused
because a merged second entry would sit in a list with no surface to put it on, while costing every
read a second lookup; it becomes right the day a surface lists them.

**The newest is unambiguously the current one, and it is stated without naming a second contract
because the two contracts cannot be compared.** The requirement text above already carries that
phrase; what is removed is the pairing. **The reason is one write and not two**: writing both
records is what the paragraph above refuses, and `chrome.storage` has no transaction that would make
two writes atomic.

#### Scenario: A mailbox this device was handed

- **WHEN** a client records a mailbox on this device
- **THEN** one operation SHALL record it
- **AND** the mailbox SHALL be readable back through the same contract

#### Scenario: Several mailboxes are held

- **WHEN** this device holds more than one mailbox
- **THEN** the contract SHALL report them newest first
- **AND** the first SHALL be the mailbox an insertion on a page would use

#### Scenario: This device also holds a mailbox from an earlier build

- **WHEN** the collection holds at least one mailbox and the single-mailbox record holds another
- **THEN** the collection's answer SHALL be the whole answer
- **AND** the earlier mailbox SHALL NOT be reported as insertable

#### Scenario: Nothing is held

- **WHEN** this device holds no mailbox
- **THEN** the contract SHALL report an empty collection rather than a failure
- **AND** a failure to read SHALL still be reported as a failure

#### Scenario: The same mailbox is recorded twice

- **WHEN** a mailbox already held by this device is recorded again
- **THEN** it SHALL appear once in the collection
- **AND** it SHALL be reported as the newest

### Requirement: A site association is a record kind of its own, keyed by an exact host

The storage layer SHALL offer a contract for **which mailbox a site was last used with**, keyed by
the site's **exact** host as the browser reports it. The key SHALL NOT be folded to a registrable
domain, a parent domain, or a name with a leading `www.` removed, because no public suffix list is
shipped and a rule that guesses one merges sites a person told apart. Reading an association for a
site with none SHALL report the absence as an absence rather than as a failure, and the same
distinction between "nothing recorded" and "could not be read" that the single-mailbox contract
requires SHALL hold here.

**Why the key is the platform's own spelling, recorded because it was measured.** A content script
reading its own page's location reports a **host name with no port and already lower-cased** —
measured in Chromium, where `https://PROBE.Invalid:8443` reads as `probe.invalid` from inside the
content script, while `location.host` on the same page reads `probe.invalid:8443`. So neither
case-folding nor port-stripping is this layer's work, and **a key derived from anything other than
that value would be a second spelling of a host**, which is the same mistake as two spellings of a
storage key.

**And what the fold would cost, stated rather than left open.** Without a public suffix list,
`login.example.co.uk` and `example.co.uk` are **two keys**, so a person who used both hosts sees no
shared history between them. The alternative — folding on the last two labels — maps both to
`example.co.uk` and would merge a login page into an unrelated site, which is a worse answer than
two keys and is not repairable by the person who hit it.

#### Scenario: A site has been used with a mailbox

- **WHEN** a client records that a site was used with a mailbox
- **THEN** reading that site back SHALL return the mailbox recorded for it
- **AND** the value SHALL be reachable without reading the whole collection

#### Scenario: A site has not been used

- **WHEN** a client reads a site with no recorded association
- **THEN** the contract SHALL report that no association is recorded
- **AND** it SHALL NOT report a failure

#### Scenario: The read cannot be completed

- **WHEN** the association record cannot be read
- **THEN** the contract SHALL report a failure
- **AND** it SHALL NOT report the absence of an association

#### Scenario: Two hosts that share a parent domain

- **WHEN** associations are recorded for `login.example.co.uk` and for `example.co.uk`
- **THEN** each SHALL be readable under its own key
- **AND** neither SHALL be readable under the other's

#### Scenario: A record that cannot be narrowed

- **WHEN** a stored association record holds an entry this build cannot read
- **THEN** the contract SHALL NOT return that entry
- **AND** it SHALL NOT delete it

### Requirement: A record kind added by a later build is removed by the same control

Removal SHALL remove **every** record kind this device holds, including a kind whose contract the
caller of the removal does not use and a kind a later build adds. A caller SHALL be able to reach
removal through one contract and have it cover records written through another, and this SHALL hold
for the single current mailbox, for the collection of mailboxes this device holds, and for a site
association.

**Amendment, recorded at proposal (2026-10-08), by `site-associations`.** The existing removal
requirement already says a removal "SHALL NOT be implemented by removing only the records this build
recognises" and gives the reason — a record kind added by a later build would survive a control the
user was told clears all of it. **That requirement is not amended, and this is what it was for**: the
claim was made while one record kind existed, in the abstract, with nothing to test it against, and
this is the build that makes it concrete. The narrower implementation it warns about — clearing the
one key this build knows — would pass every test written against a single record kind, and the test
this adds is the one that could not have been written before: a record planted through **a different
contract**, which the contract doing the removing has no operation for.

#### Scenario: Removal is asked for through one contract

- **WHEN** a caller removes everything through one storage contract
- **THEN** a record written through a different contract SHALL be gone
- **AND** the caller SHALL NOT have had to name that other contract

#### Scenario: A record kind this build does not know about

- **WHEN** a record of a kind this build does not recognise is present
- **THEN** removal SHALL remove it as well
- **AND** it SHALL NOT be removed by naming its key
