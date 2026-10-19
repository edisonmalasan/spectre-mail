# Mailbox history — design

## D1 — The session layer is already correct, and that is the measurement the plan turns on

`packages/mailbox/src/session.ts:482`:

```ts
async restore(stored) {
  return adopt(stored, inbox.check);
},
```

`restore` takes **whatever mailbox it is handed**. It does not ask whether that mailbox is the
newest, the current one, or the only one. `adopt` reconciles it against **the provider that owns
it**, maps `MAILBOX_EXPIRED` to `expired`, maps anything else to `restoreFailed`, and makes the
listing that reconciles the inbox's own first listing so a restored mailbox arrives already analysed.

**The roadmap's phrase is *"where the provider session still permits access"*, and the session layer
already distinguishes exactly the two ways that can fail** — an expired mailbox (`expired`) against one
whose provider cannot be checked at all (`restoreFailed`), and `StoredAddressUnchecked.tsx` already
renders the second in the product's own words.

**So M13's mailbox history needs no change to `packages/mailbox`, and that is a prediction the
apply stage must confirm rather than assume.** The two things that do not exist are the website's
half of the storage and any surface to return to a mailbox.

**This is why the change's plan has a falsifiable prediction in it at all**, and why the prediction
being *wrong* would be informative: if returning to an older mailbox turns out to need something
`adopt` does not do, then the requirement this change writes would be written against a session layer
that has to change, and the task list would have been short a stage.

## D2 — The requirement's own sentence is the thing being retracted, and it was a decision

`SpectreMailboxes`' promoted requirement says:

> *"the current mailbox is left where it is rather than replaced by the collection's head: the
> website's requirement names a single stored address, and **nothing here changes what the website
> does**."*

**That is not an observation about the code. It is a decision about where the product was going**,
written by `site-associations` when the collection existed to make the `hostname -> mailbox id` map
possible, and the website was deliberately left alone.

**The website is no longer to be left alone, so the sentence has to go — and a decision that has
been reversed cannot be left standing beside the reversal.** This is why the block is `MODIFIED` and
not accompanied by an `ADDED` sibling: `openspec/specs/` holding both *"nothing here changes what
the website does"* and a requirement about the website holding several mailboxes would be two
requirements saying opposite things, which is the shape this repository records as where an amendment
gets attributed to the wrong assertion.

**And the `MODIFIED` carries the amendment in its own body, with the date**, so the archived delta
and the promoted spec are the same blocks and the reversal is readable years later without the
commit history.

## D3 — The placement question is real, forbidden in one direction, and already answered in the other

`page-composition` says, in its own words:

> *"No region SHALL be added that has no heading of its own, and **no sixth region SHALL be added**."*

**So "recent mailboxes" cannot be a sixth region.** That is not a preference; the requirement
forbids it, and the reason is the roadmap's own five-section list plus the product's own line that
the product remains the main hero.

**The repository already contains the answer, for the surface immediately beside it.** `App.tsx`
renders:

```tsx
<main>
  <section aria-labelledby="product-heading" data-region="product">
    <Wordmark />
    ...
    <LocalData localData={localData} clearStored={clearStored} />
  </section>          {/* closes at :358 */}
  <Steps />
  <Reasons />
  <ExtensionPreview />
</main>
```

`LocalData` is the page's entire *"what this device keeps and how to make it forget"* surface, and it
is **not** a region. It is a component inside the product region, and its own comment states the
reason this change needs:

> *"It renders in **every session state** once the boot is done, because **what this browser remembers
> has nothing to do with what the session is doing** — a user looking at a creation failure with a
> stored address still needs to remove it."*

**That sentence is about removal. The same sentence is about returning**, and the reason is
structural rather than rhetorical: a person whose address could not be created, or whose inbox could
not be listed, still has other addresses on this device and still needs to reach one.

**So `page-composition` is untouched, and this design decision is recorded as a proposal-stage
finding rather than discovered at apply.** The falsifiable claim: after the change, `PAGE_ORDER`
still names five regions, and the browser tier's per-region sweeps still find five.

## D4 — The migration question is new, because the website is the first client to inherit it

The extension's requirement already records the answer it took:

> *"the single-mailbox contract is the **only** place a mailbox recorded by an earlier build can be
> found, and it is therefore consulted **only** while the collection is empty"*
>
> *"**a mailbox recorded before this build stops being offered once this device records another
> one** — still stored, still readable, but no longer in the list a client offers"*

**That second clause is a footnote on the extension and a defect on a website.** The website's
requirement — *"A reload returns the user to the address they came back for"* — is about a person
recognising an address they already had. **An address that silently leaves the list the moment a
second one is created is a person losing an address they recognised**, and the roadmap's wording for
this item is *"where the provider session still permits access"*, which is about the **provider**, not
about the product's own bookkeeping.

**So this change has to answer the question rather than inherit the answer**, and the two candidate
answers are genuinely different: *merge the singular record into the collection on first read*, or
*keep consulting it and show both*. The first is one write and no second place to look; the second
never loses anything and adds a rule that has to hold for as long as both records exist. **The
requirement this change writes should be whichever the apply stage can justify from what the adapter
can actually do**, and the proposal deliberately does not choose, because choosing here would be
choosing without the measurement.

## D5 — `clearAll` gets its first real proof, and it is worth naming

`spectre-storage` requires that removal *"SHALL NOT be satisfied by removing only the records this
build recognises"*, and its test **plants a store this build does not recognise** to prove it.

**A planted, unrecognised store is a weaker proof than a real second store the build does recognise**,
and after this change the website's IndexedDB database holds exactly that: a store for the single
current mailbox **and** a store for the collection, both created by this build.

**So `clearAll`'s strongest requirement stops being proved by a fiction and starts being proved by
the shipped shape of the product** -- and the test that proves it is the same test. **That is the
change's least visible and most valuable consequence**, and it is a consequence rather than a goal:
nothing about it is designed for, and it arrives because the database gains a second real store.

## D6 — Two records for one mailbox is the trap, and the extension already answered it

The collection's `addMailbox` documentation says why it is one operation:

> *"`chrome.storage` has **no transactions**. An implementation that recorded 'the current mailbox'
> and 'this mailbox is in the collection' as two writes could be interrupted between them, leaving the
> device holding an address its own collection does not know."*

**On the website the risk is not interruption but divergence**: `apps/web` writes the singular record
today, and if it also wrote the collection the two could name different mailboxes after a single
reload. **The extension's answer is a boundary rule** — `extensionSingularWriteViolations` forbids
every module in `apps/extension/src` from naming `saveMailbox` — and the website is now the **only**
remaining writer of that method in the workspace.

**So the question is whether the website stops writing it, and that is a real product decision with
a migration behind it.** The requirement this change writes should say which way, and the direction
that makes the collection's own documented property true — *"the first entry is the mailbox
`loadMailbox` reports as current"* — is the one where **one read answers both questions**. That
property is currently **false on the extension** and was **amended out of `spectre-storage` rather
than fixed**, because the extension's writes moved onto `addMailbox` and the singular record became
write-only-nothing. **M13 is the change that can make the property true everywhere, and the direction
it takes is worth stating in the requirement rather than leaving to whichever adapter is written
first.**

## D7 — What this change predicts, so the predictions are falsifiable

- **`packages/mailbox` is unmoved**, at **166**. D1's whole argument is that `restore` already takes
  any mailbox; a rise would mean the session layer needed something and the proposal was wrong.
- **`packages/providers`, `packages/core`, `packages/mail-parser` and `apps/extension` are unmoved.**
  The extension already holds a collection and already has its adapter.
- **`packages/storage` rises** — a new adapter and its cases.
- **`apps/web` rises**, and its browser tier rises: the new surface is on the built page.
- **`PAGE_ORDER` still names five regions** and `sections.spec.ts`'s per-region sweeps still find five.
- **`tests/architecture/boundaries.test.ts` rises by at most one**, if the website's singular-write
  answer needs a rule; and **its count moving is a finding either way**, because D6's direction
  decides whether a rule is needed or a rule is *removed*.
- **The extension's browser tier stays at 98.** Nothing under `apps/extension/e2e/` changes.

## D8 — What this change cannot establish, stated rather than smoothed over

- **Nothing about a real provider.** "Where the provider session still permits access" is decided by
  the provider's own session lifetime, **which no test in this repository exercises**, and the change
  must therefore present the distinction the session layer already draws rather than predict which
  mailboxes fall on which side of it.
- **No retention policy is invented.** "Recent" is bounded by reachability, and a count of days would
  be a figure this repository has not measured.
- **Nothing about what a list of addresses should look like.** That is a visual judgement, and no
  test in this repository reads a rendered pixel.
- **`packages/storage`'s `fake-indexeddb` is still not a browser**, so the new adapter's IndexedDB
  behaviour is proved against a substrate and, where the existing removal requirement says so, against
  Chromium through the browser tier.
- **The migration answer is not chosen here**, and D4 says why: it is a decision the adapter's
  capabilities should justify, and a proposal that picked it would be picking without measuring.
## D9 - Apply-stage record: what was measured, and the two answers this stage had to choose

**Recorded 2026-10-19, on `feat/mailbox-history`.** Everything below is a measurement or a
decision with its measurement beside it.

### D9.1 - D1's prediction held, and it was checked before a line was written

`packages/mailbox/src/session.ts:482` is `async restore(stored) { return adopt(stored, inbox.check); }`,
`adopt` reconciles the mailbox it is handed against the provider that owns it, maps
`MAILBOX_EXPIRED` to `expired` at `:429` and everything else to `restoreFailed` at `:436`, and
`restore(null)` delegates to `open()` so a first visit is the same path rather than a parallel one.
**Nothing in this change touched `packages/mailbox`, and its count is unmoved at 166** - re-counted
from a `--reporter=json` run grouped by project, not carried forward.

**One thing `adopt` does that the design did not name**, and it is why the return path needed no
session change: adopting **makes the reconciliation listing the inbox's own first listing**
(`:400`), so a returned mailbox arrives already analysed and costs one provider request rather than
two.

### D9.2 - The migration answer, and the measurement it rests on

**Chosen: one write, in one transaction over both object stores.** The boot read answers from the
collection's head and consults the singular record **only while the collection is empty**.

**The measurement is about what the platform can do, not about what the product prefers.** Measured
against this repository's own substrate (`fake-indexeddb` `6.2.5`) before any code was written:

```text
abort  -> abort  { one: [],  two: [] }      // a transaction over both stores rolls BOTH back
commit -> complete { one: ["wrote A"], two: ["wrote B"] }
upgrade to 2 while a version-1 connection is open -> blocked
upgrade to 2 with no other connection           -> success
```

**That is why the extension's answer is not inherited.** `SpectreMailboxes`' requirement records the
extension consulting the singular record *"only while the collection is empty"*, and D4 read that as
a rule this repository had to re-decide. It is not a decision: it is what `chrome.storage` forces,
because `addMailbox`'s own documentation says *"chrome.storage has no transactions"*. **IndexedDB
can**, so the rule is unnecessary here and **no rule was added** - a scan for a disagreement the
database already refuses would be decoration.

**So D6's stated direction is the one taken, and the property is true**: the head of the collection
and the mailbox `loadMailbox` reports are the same mailbox, because one transaction writes both.
`indexeddb-mailboxes.test.ts` reads both stores back through the platform rather than through the
adapter and asserts they never disagree.

**And the singular write stays**, which is the other half of task 4.1 and the reason a carve-out was
not needed anywhere. Writing only the collection leaves a stored record naming a mailbox the device
has stopped using, so the two records disagree on disk and anything reading the singular record
directly is reading a stale answer. Writing only the singular record means a page listing what this
device holds has nothing to list after the first visit. Both are recorded beside
`createIndexedDbMailboxRecords`, with the measurement that made the third option unnecessary.

**Task 4.2's question - is the collection's documented property true? - answered: yes, on this
client.** It was **false on the extension**, and `site-associations` amended it out of the spec
rather than fixing it. This is the change that makes it true where the website is concerned.

### D9.3 - `SPECTRE_DATABASE_VERSION` moved, and the cost is measured rather than described

Adding an object store requires a version-change transaction, so **`SPECTRE_DATABASE_VERSION` is 2**.
The note it replaced said *"a record added to a store needs no IDB upgrade"* - true of a **value**,
and read here as covering a **store**, which it does not. Corrected in place.

**The cost, measured above and reproduced in the design's own header: while a second connection holds
version 1 open, the upgrade reports `onblocked` and completes nothing.** A visitor with an old
SpectreMail tab open therefore sees `BootFailure` rather than a slower page. The alternative - a
second database - would have kept the version at 1 and produced **two databases for one product**,
which is the shape `clearAll`'s requirement is about.

**Two consequences that are edits to existing tests rather than to product behaviour, and both are
recorded rather than absorbed.** `indexeddb.test.ts` had four version literals (`factory, 2`) that
became `SPECTRE_DATABASE_VERSION + 1` - without them the planted store was never created, because an
open at the current version fires no upgrade, and the case hung rather than failing. `storage.spec.ts`'s
`plantUnrecognisedStore(page, name, 1)` became `SPECTRE_DATABASE_VERSION`, and **its own control**
("the store existed before the removal") is what turns that from a silent no-op into a failure.

### D9.4 - A fixture-name collision, caught by the control this repository insists on

`indexeddb.test.ts`'s own `STORE` constant is `"mailboxes"` - **the same string this build now uses
for the collection's store**. The first version of the new removal case declared two stores with that
one name, the platform created one, and the case's control caught it. **A case whose fixture collides
with the product's naming is a case that can pass for the wrong reason**, and the control is the only
thing that noticed.

### D9.5 - The page-level design decisions, and the two the design did not name

**The surface is a component inside the product region, beside `LocalData`, not a region** - D3's
answer, unchanged and confirmed: `document.querySelectorAll("[data-region]").length` is **5** on the
built page and `mailbox-history.spec.ts` asserts it.

**It renders nothing when this device holds none**, and that is a decision rather than an omission:
`LocalData` already states that this device keeps nothing, in the page's own words, beside the
control that changes it. **A second sentence for the same fact is the defect this page has repaired
before**, and an empty offer has nothing to say.

**It re-reads when the page's storage state is re-confirmed**, which is the moment a replacement
lands. The dependency is the `LocalDataState` **value**, not its `kind`, because
`useMailboxSession` replaces it with a fresh object exactly where it confirms storage state. A
dependency on `kind` would read once on a first visit and never again, so *Replace address* would
leave the list showing the address it replaced.

**And it does not read at all once `localData` is `none` - which is a defect the browser tier caught
and the unit tier could not have.** The first version re-read after a confirmed removal, which
re-opened the database the user had just asked to be deleted: `indexedDB.databases()` still listed
`spectre-mail` after *Clear saved data*, and **two existing cases in `storage.spec.ts` went red**. The
repair is to treat the boot's confirmed absence as an established answer rather than asking the
platform a question about a database that was supposed to be gone. **A unit test has no platform to
leave anything behind on** - this is the recorded shape of a defect only one tier can find, found by
the tier that has the platform.

### D9.6 - Two things this stage found that the proposal did not name

**The requirement's creation-failure scenario is only reachable through *Replace address*.** A boot
that fails to create is a boot that found nothing stored, and a device that holds an address never
takes that path. So "the offer still renders under a creation failure" is a statement about the
**replacement** failing, not the boot. `RecentMailboxes.test.tsx` and `mailbox-history.spec.ts` both
drive it that way, and each says why.

**Returning to a mailbox re-records it, and the list reorders.** `useMailboxSession`'s save effect is
keyed on "a mailbox whose id is not the one this page was handed", which is exactly what a return is,
and `addMailbox`'s contract says a mailbox this device already holds **moves to the front**. So the
address a person just chose becomes the newest, which is the same answer as "the address a reload
will bring back". That was not designed for; it is what the two existing contracts say when a return
happens, and it is recorded here rather than left to be discovered as a surprise.

### D9.7 - What this stage did not do, and one blocker it could not clear inside its write scope

**`docs/PRIVACY.md` is now wrong and this stage could not fix it.** Section 2 says *"The website keeps
**one** kind of record, in IndexedDB"* and declares one row, and this change makes the website create
**two** object stores.

**The disclosure was attempted and the instrument rejected it**, which is the finding. Making the row
honest turns `privacy-disclosure.test.ts` red:

```text
the website's declared record agrees with what its adapter asks the platform for
  -> one declared row: expected 2 to be 1
```

**And the instrument is looking at the wrong adapter.** `observeWebsiteRecord()` runs
`createBrowserStorage()` (`:719`), which `apps/web` **no longer uses** - the website's entry point is
now `websiteStorage()`, the paired adapter. So the suite reports one object store where the product
creates two, and its document row is checked against an adapter that is no longer on the page's path.
Both files are outside this stage's write scope, so the edit was reverted and the blocker is reported
rather than worked around. **Two stale claims shipped by one change, one of them in an instrument** -
and the instrument's own case name is *"agrees with what its adapter asks the platform for"*.

**This section was measured again, and one of its claims was wrong.** **D9.10** re-ran the
disclosure, restored the document byte-identically, and **refuted the "the observer cannot see a
store created at upgrade" explanation** with a control. **The two stalenesses that are actually in
the suite are that it observes an entry point the website no longer uses, and that its
`transaction(store)` stub takes a string while the paired adapter opens one transaction over two
stores.** D9.10 is the record; this section is kept because it is where the blocker was first
found, and **a correction is recorded next to the claim it corrects rather than in place of it.**

**`page-composition` is untouched and `PAGE_ORDER` still names five regions.**
**`boundaries.test.ts` is unmoved at 53**, and that is the measurement task 4.2 and 7.5 turned on:
the agreement between the two records is held by a transaction, so a rule would have been decoration
where an instrument already exists.

### D9.8 - The control's second label is unreachable on the built page, and the mechanism that is
actually in force was asserted nowhere

**Recorded 2026-10-20, on `feat/mailbox-history`, by the falsification pass.**

`RecentMailboxes` offers a mailbox with one of two labels:

```tsx
{verdict === undefined ? "Use this address" : "Check this address again"}
```

**The second label cannot appear on the built page**, and the reason is structural rather than
accidental:

- **`App` asks the provider about exactly one mailbox** - the one the session holds. `unreachable` is
  therefore a map with **at most one entry**, and it names that mailbox.
- **`RecentMailboxes` withholds the control on the mailbox the session is on**, for the reason its own
  prop's note gives: a control to pick the address already on screen cannot do anything, which is the
  fake-UI defect `extension-client` removed from the popup.
- **So the mailbox that can be marked is exactly the mailbox that never gets a control.**

**The mechanism actually in force is therefore the absence of a control**, and the second label is
belt-and-braces. **The two overlap, and the reachable one is the one doing the work** - and, before
this stage, **the reachable one was asserted nowhere**: the browser tier proved the *mark* was
there, and the unit tier's case covered the label by rendering the component directly with a prop
combination `App` does not produce - `current: null` together with a mark on another mailbox.

**So the requirement's clause - *"SHALL NOT offer that mailbox as though it worked"* - is now
asserted where it is reachable**: a unit case and a browser case that require the marked entry to
carry **no control at all**, and a falsification arm that removes the guard withholding it. **The
requirement held under every reachable mutation even before this**, because the reachable mechanism
covers the unreachable one - but a property no assertion holds is not a property, and the delta's
central clause had no case behind it.

**The label branch is left in place**, and the reason is recorded rather than assumed: removing it
would be a change to the surface this change was not asked to make, and it is the branch that would
speak correctly if a future surface ever marked a mailbox the page is not on. **What was wrong was
not the branch; it was the absence of a case for the branch that is reachable.**

### D9.9 - The falsification pass, and the three defects the instrument had before it measured anything

**The instrument lives outside the repository** and was deleted after the pass. **Thirteen arms,
thirteen caught by the assertion each was aimed at**, with `wrongcatch`, `green`, `noop`, `nocompile`
and `harness-error` **all zero**, every mutated file restored **byte-identically** after **every**
arm, and the website rebuilt from the restored source at the end.

**Four defects in the instrument or in an arm, and the third is the one worth carrying.**

- **The mutation reader refused a valid mutation.** Its first version asserted that the old text was
  *absent* from the mutated file - which is wrong for a replacement that grows the text, because the
  new text then contains the old one. **The self-test caught it** (*"a growing replacement is
  applied"* failed), and the repair is to ask the question actually being asked - *is the mutated file
  exactly the original with this one replacement?* - rather than a proxy for it. **A check that is
  wrong in the direction of refusing a valid mutation is a check that silently shrinks what the
  instrument can measure.**
- **The self-test read its own flag as a positional.** The first version read `argv[2]`, which
  resolves `--self-test` as the directory to work in. **The first argument that is not a flag** is
  the rule, and it is now how the file finds it.
- **The browser reader did not descend into Playwright's nested suites, and it reported a mutation
  the tier had failed in five specs as `green`.** Playwright's JSON report puts a `test.describe`
  block in a **nested** `suites` array, and the file-level suite's own `specs` array holds only the
  specs that are *not* inside a `describe` - so the reader saw **none** of the seven specs in
  `mailbox-history.spec.ts`, every one of which is inside a `describe`. **A reader that is blind to
  a shape answers the wrong question confidently**, and the shape it was blind to was the shape this
  change's own browser cases live in. The repair is to walk the tree, and the self-test now plants
  a nested suite to hold the reader down - **which is the fifth recorded instance in this repository
  of a reader that read zero cases in most of the files it was pointed at.**
- **One arm was a broken mutant, and the instrument's own `wrongcatch` class is how it was told
  apart from a survivor.** `M08` was written to narrow the collection by a second hand-written
  reader, and its first version read the envelope without the optional chain - so it **threw** on an
  absent envelope and failed five unrelated cases rather than the one it was aimed at. **A
  `wrongcatch` is the signature of a mutant that is not the thing it claims**, and the arm was
  repaired and re-run rather than recorded as a survivor.

**And one arm was withdrawn, after being run.** `B02` mutated the control's second label and came
out `green` in the browser tier. **The mutant was read and it is what it claims** - it applies, it
is in the built output, and the tier ran - and the reason is the measurement in **D9.8**: the label
is unreachable on the built page, so the browser tier cannot see it. **The violation is not
unfalsifiable** - the same mutation is caught by the unit tier's arm, and it is caught there for
the right reason. **The arm is withdrawn rather than kept as a green row**, and the requirement's
clause is asserted where it is reachable instead.

**A browser arm aimed at the two records naming different mailboxes was not run**, and the limit is
the one the browser file's own note records: the recorded corpus can produce **one** address for a
`f=get_email_address` request, so the causal write cannot be produced there without fabricating a
provider delivery this repository has never received. **The causal write is proved where it can be
honest** - in `packages/storage`, through the platform rather than through the adapter.

### D9.10 - The privacy disclosure, measured a second time, and the two stalenesses that are in the
suite rather than in the document

**Recorded 2026-10-20.** `docs/PRIVACY.md` section 2 says *"The website keeps **one** kind of record,
in IndexedDB"* and declares one row, and this change makes the website create **two** object
stores. **The document is therefore stale**, and the instruction that says the disclosure is this
change's work rather than a stale document is right.

**The honest disclosure was written and the instrument rejected it**, and the message is exact:

```text
the website's declared record agrees with what its adapter asks the platform for
  -> one declared row: expected 2 to be 1        (privacy-disclosure.test.ts:1071)
```

**The document was restored byte-identically afterwards** - the digest before and the digest after
are the same - so the measurement left the tree as it found it.

**And the first attempt at that disclosure produced a DIFFERENT failure, which is worth recording
because it nearly sent the report the wrong way.** The first edit re-wrote the table's header row
as well as adding a row, so the document ended up with **two tables** carrying that header, and
the suite failed one assertion earlier: *"declares 2 tables with the header ... exactly one is
required"*. **A measurement that reports a difference for the wrong reason is worse than no
measurement**, and the fix was to add the row without touching the header, which is what the
product's shape actually requires.

**Two stalenesses in the suite, and neither of them is the one this stage first named.** The first
version of this record said the observer *"cannot see a store created at upgrade"*, and **a control
refuted it**:

```text
1. the observer as the suite writes it, against createBrowserStorage()
   { databases: [ 'spectre-mail' ], stores: [ 'mailbox' ], keys: [ 'current' ] }
2. the same observer, pointed at the PAIRED entry point the website actually uses
   { databases: [ 'spectre-mail' ], stores: [ [ 'mailbox', 'mailboxes' ], 'mailbox', 'mailboxes' ],
     keys: [ 'current', 'mailboxes' ] }
3. the CONTROL: the same reader, with `onupgradeneeded` fired
   { ... identical to 2 ... }
```

**The control is the finding.** Firing the upgrade changes nothing, because **the paired adapter
*reads* both stores in one transaction** rather than creating them at upgrade time - so an observer
pointed at it sees both either way. **The upgrade was never the reason.** The two real stalenesses
are:

1. **The observer runs `createBrowserStorage()`** (`:719`), an entry point **`apps/web` no longer
   uses** - the website's entry point is now `websiteStorage()`, the paired adapter. So the suite's
   case is about a path the product has left.
2. **The observer's `transaction(store)` stub takes a string**, and the paired adapter opens **one
   transaction over two stores**. The array is therefore recorded as **one element**, and
   `observed.stores[0]` is an **array** rather than a store name - so the case's own comparison
   against `observed.stores[0]` would compare a name with an array.

**So the suite and the document have to move together**: the document needs two rows, the case has
to require two rows, **and the observer's stub has to accept a list of store names** - otherwise
re-pointing it at the website's real adapter produces a failure that compares a store name with an
array, which is a worse message than the one above rather than a better one.

**All three are in `tests/architecture/privacy-disclosure.test.ts`, which is outside this stage's
write scope.** The document was left as it is and the edit reverted, which is a choice and not an
oversight: a red suite is a worse outcome than a stale document the root can see, and **the root
can see it because it is written down here.**

### D9.11 - A rare red in the branding audit, named and not reproduced, and the mechanism not
established

**Recorded 2026-10-20.** One full `pnpm test` run in this stage failed in
`tests/architecture/branding-audit.test.ts` — *"no place in the shipped tree carries the name
without being declared"* — and **did not reproduce in sixteen subsequent runs on this branch, nor
in eight on `main`**. The JSON reporter's message for it was unreadable, so the failing
*assertion* is not known, only the failing *case*.

**Nothing in this change is in that suite's path.** The audit's corpus is `apps/` and `packages/`,
and this change adds files to `apps/web/src` and `packages/storage/src` without adding a place that
carries the product's name as a **whole value** — the reader's rule, and the reason the new files
carry it only inside longer sentences.

**The audit's own file records the shape of the race**: it walks the same tree that
`boundaries.test.ts` stages and deletes files in, and it repairs that by excluding probe files
**by name**. **And a direct probe of the two shipped files that suite mutates —
`apps/web/index.html` and the root `package.json` — turned the audit red in 0 of 24 attempts**, so
**that is not the mechanism and the mechanism is not established.**

**So the record is what it is: a named red, rare, not reproduced, with its mechanism unknown.**
**It is reported rather than rounded away, and the two suites it could be are not this stage's to
change.**