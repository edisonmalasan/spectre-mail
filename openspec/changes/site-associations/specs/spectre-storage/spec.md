# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

#### Scenario: A mailbox this device was handed

- **WHEN** a client records a mailbox on this device
- **THEN** one operation SHALL record it
- **AND** the mailbox SHALL be readable back through the same contract

#### Scenario: Several mailboxes are held

- **WHEN** this device holds more than one mailbox
- **THEN** the contract SHALL report them newest first
- **AND** the first SHALL be the mailbox the single-mailbox contract reports as current

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
