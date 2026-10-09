# Design

## Context

Three measured facts from the M0 spike era and this change's probe shape the approach; the
motivation is in `proposal.md` and the requirements are in `specs/`.

**1. This device holds one mailbox, and that is measurable.** Both adapters write the mailbox under
a single key — `EXTENSION_MAILBOX_KEY = "current"` in `packages/storage/src/chrome.ts` and
`CURRENT_MAILBOX_KEY = "current"` in `packages/storage/src/indexeddb.ts` — and
`apps/extension/src/content-script/create-mailbox.test.ts:336` already asserts `saveMailbox` is
called **twice** across two creations. So there is no place to put a second address today, and the
site map the roadmap specifies would be a map with one entry.

**2. `chrome.storage.onChanged` reaches a content script's isolated world.** Measured in Chromium
with a fixture extension (`C:\Users\Edison\AppData\Local\Temp\opencode\site-associations-probe\probe.mjs`):

| arm | reading |
| --- | --- |
| content script subscribes to `chrome.storage.onChanged` | **fires** on a service-worker write to `chrome.storage.local` |
| page world subscribes to the DOM `storage` event | **does not fire** for the same write |
| positive control | the content script read the value the worker wrote |
| control for the control | the page world's `chrome` is `undefined`, so the previous row's null is not evidence about subscriptions |

The DOM `storage` event and `chrome.storage.onChanged` have the same-sounding name and are different
mechanisms; only the second one works here. **Consequence: this slice needs no `sendMessage` seam
to the service worker at all.** Slice 2 needed one because a content script's `fetch` obeys the
**page's** CORS policy (`docs/PROVIDERS.md` §4.4); this slice only reads and writes the extension's
own storage, which a content script reaches on the `storage` permission alone.

**3. `location.hostname` is already the key this design wants, measured from inside the content
script.** On `https://PROBE.Invalid:8443` the content script reads `probe.invalid` — the port is
excluded and the value is **already lower-cased** — while `location.host` on the same page reads
`probe.invalid:8443`. So neither case-folding nor port-stripping is this layer's work, and no
public suffix list is shipped or needed for it.

**And one arm of that probe was wrong before it was re-run, which is why the limit below is stated
as measured.** The first version of arm 3 reported that a content script does not run in a
same-origin iframe, with `all_frames` unset. That reading was untrustworthy because nothing
established the child frame was inspectable. Re-run with the frame **proved loaded**
(`readyState: "complete"`), **proved inspectable** (a probe planted into the page was read back from
the child), then settled 500 ms — the absence held. The control is what turned it from an
observation into a measurement.

## Goals / Non-Goals

**Goals:**

- One record kind per contract, one narrowing function per record kind, and **one write path** for
  recording a mailbox.
- The extension's answer to "which mailbox" is **one answer**, with no second place able to disagree.
- The in-page control's accessible name carries the address it will insert, so no new surface inside
  somebody else's page is needed to expose the choice.
- No new delegation to the service worker, because measurement says none is needed.

**Non-Goals:**

- **A menu over this device's mailboxes inside a stranger's page.** Deliberate; see D4.
- **Any behaviour for the website.** It keeps one mailbox and its own IndexedDB adapter, and no
  requirement in `website-client` changes.
- **`all_frames: true`.** See D6.
- **A registrable-domain key.** No public suffix list is shipped; D5.
- **Any deletion of a single mailbox.** `clearAll` already means everything and is the only removal
  control; per-mailbox removal is not asked for by the roadmap's UX rules.
- **`extension-client` amendments.** Measured as unnecessary: no requirement it holds becomes false,
  and inventing one to justify a diff is the same defect this file exists to catch.

## Decisions

### D1 — Two new contracts beside `SpectreStorage`, not a wider one

`SpectreMailboxes` (`loadMailboxes`, `addMailbox`) and `SpectreSiteAssociations`
(`loadSiteMailboxId`, `saveSiteMailboxId`) are separate interfaces in separate files, beside
`contract.ts`.

**Alternative rejected: widen `SpectreStorage`.** One interface, one adapter pair, and the website's
IndexedDB adapter gains two operations it never calls — the exact argument `contract.ts` already
makes about itself ("a record with no consumer is a schema to migrate rather than a feature"). The
cost is concrete: `packages/storage`'s IndexedDB tests would need a mailbox-collection fixture and
site-association fixtures for a client that does not exist, and every future site-association field
would be an amendment to the contract the website depends on.

**Why the site association is not a field on the mailbox collection.** The two records answer
different questions, are written at different moments (creation vs. insertion), and have different
failure consequences: a stale association is ignored, a corrupt collection is skipped per member.
Bundling them would make one record kind's narrowing answer for the other's.

**Cost, stated rather than discovered:** three contracts means a caller wanting everything reaches
three interfaces. That is what `clearAll`'s single meaning is for (D3).

### D2 — The collection stores *records*, not `Mailbox` values

`{ version: 1, mailboxes: StoredMailboxRecord[] }` — each member is the **same versioned record the
single-mailbox path uses**, narrowed by the **same** `readStoredMailboxRecord`.

**Alternative rejected: store `Mailbox[]` and narrow each member against the domain type.** Fewer
moving parts, and it is what a first reading suggests. It is also the amplification the amended
narrowing requirement exists to prevent: a member that fails to narrow must not take its siblings
with it, and reusing the mailbox narrowing is what makes that a property rather than a hope. The
third alternative — one unreadable member makes the whole record unusable, matching the existing
single-record rule — was rejected because the blast radius changes from *one address* to *every
address on the device*.

### D3 — `clearAll` is not duplicated onto the new contracts

Removal stays on `SpectreStorage`, and the requirement gains a scenario the single-record build could
not have written: **a record planted through a different contract** is gone after a removal the
calling contract has no operation for. Both `chrome.storage` (`area.clear()`) and IndexedDB
(`deleteDatabase`) already satisfy it, so no implementation change is needed — **which is precisely
why the scenario is the test that matters**: the requirement was written when it was untestable in
this form, and this is the build that can test it.

**Alternative rejected: give the collection its own `clearAll`.** Two removal operations on the same
area is a question with no good answer ("which one is the privacy control?"), and `packages/storage`
already argues against a generic bag of operations.

### D4 — The preference is expressed by the control's name, not by a menu

The affordance offers **one** control. Its accessible name is the address it will insert
(`affordanceInsertLabel(address)`), so on a host with an association it names that mailbox's address
and elsewhere it names the newest. No list, no disclosure, no second button.

**Alternatives rejected:**

- *A menu in the shadow root.* It is the honest reading of "allow using: current mailbox / new
  mailbox / recently used mailbox for that site" as three **choices**, and it is a new interactive
  surface inside a page this product does not control, whose appearance **no gate in this repository
  can check**. Slice 4 already deleted a depiction from the website for rendering nothing operable;
  adding a control here would be the same defect in the opposite direction, with no measurement to
  catch it.
- *Repeated activation cycling through mailboxes.* Untestable as a user-facing "allow using", and it
  mutates on every press, including presses meant to insert.

**The limit this accepts, stated in the requirement rather than only here:** on a host that has an
association, a person cannot choose a *different existing* mailbox. They create one, which becomes the
newest, and it is offered next time. Recorded for M10, where a menu can be judged on its own
evidence.

### D5 — The key is `location.hostname`, exact, and never derived

**Alternative rejected: fold on the last two labels.** With no public suffix list, that maps
`login.example.co.uk` and `example.co.uk` to the same key and merges a login page into an unrelated
site — and the person who hit it cannot undo it. Two keys is the safer wrong answer and is recorded
in the requirement.

### D6 — `all_frames` stays unset, and that is a decision rather than an omission

Adding `all_frames: true` would reach an email field inside a same-origin iframe, which the measured
absence says this build misses. **The reason to leave it off is that the key would then be the
*frame's* host**: any page could embed a frame and have this device associate a mailbox with a host
the page merely renders, so a site could shape what this device offers on another host. The browser
tier gets a case asserting the iframe is not reached, so the limit is observed rather than assumed.

### D7 — The content script writes the association; the service worker is untouched

The content script knows the insertion happened and knows the host; the worker knows neither. Slice 1
already established that a content script with no `host_permissions` reaches `chrome.storage.local`
on the `storage` permission alone, readable **and writable**. So `protocol.ts` gains **no** message
type, and `service-worker.test.ts` is required to stay at 5.

**Alternative rejected: delegate the write to the worker**, for symmetry with slice 2. It would add a
seam, a message, and a case for a capability the measurement says exists.

### D8 — Reading the collection is one call, and "current" is derived, not stored

The popup's "your address" becomes `loadMailboxes()[0]`, and creation writes through `addMailbox`
only. **The singular `SpectreStorage.loadMailbox` is left in place for the website and is no longer
the extension's source of truth** — the alternative, writing both records, has no transaction on
`chrome.storage` and can leave the device holding an address its own collection does not know.

**Cost, recorded:** the extension now holds two mailbox records until the website is migrated, and
`apps/extension`'s storage seam has two areas. One is written by nobody in the extension; the
alternative — deleting it — would break a stored mailbox an existing user came back for, so the
honest order is *write the collection, keep reading the old record until M10 retires it*, and the
extension's create path is the only place that writes either.

### D9 — A write that cannot read what it would replace refuses, and the error says why

**Recorded during apply (2026-10-09), and it is the decision the mutation list exists for.**

`addMailbox` and `saveSiteMailboxId` both read before they write. That read is not a validation
step that can be skipped for the common case — it is the only thing standing between a write and the
deletion `record.ts` forbids elsewhere: an envelope this build cannot narrow must not be
**overwritten**, because overwriting is how an unreadable member is lost.

The first implementation of `addMailbox` passed its own tests and was wrong anyway. It rebuilt the
collection from the **narrowed** list, so one member it could not read was silently dropped on the
next write — the exact loss `record.ts` refuses to perform. The repair is
`prependStoredMailbox(record, mailbox)`: it reads the collection **as stored**, keeps every member
including the ones it cannot narrow, and puts the new mailbox at the front. `StoredMailboxCollection.mailboxes`
is therefore typed `readonly unknown[]` rather than a list of records, because a spec that cannot
narrow a member must still be able to hand it back.

**Two refusals, both before the write, both naming the record and the key.** `saveSiteMailboxId`
additionally refuses an empty host and an empty id, for the same reason the singular record does: an
empty key is not a site, and an empty id is not a mailbox, and writing either would produce a record
this build cannot use and cannot explain. The cost is recorded rather than traded away: **a device
whose association record became unreadable by a downgrade gets no new associations at all**, which is
a visible failure in exchange for never losing one it cannot read.

**Amendment, recorded during apply (2026-10-09).** The write is built from the record **as stored**,
not from the narrowed map — `...(raw.sites ?? {})` rather than `...readStoredSiteAssociations(raw)`. The
distinction is that narrowing has already dropped what it could not read, so spreading *that* deletes
exactly what the narrowing went to the trouble of preserving. The spread is over a freshly copied
object, so the object written shares no reference with the one that was read.

## Falsification

Twenty-one deliberate violations, **21 of 21 caught by the intended assertion**,
with `wrongcatch`, `green`, `nocompile` and `noop` all zero, restoration verified by SHA-256 for
every mutated file, and `dist/` rebuilt from the restored source. 16 unit entries and
5 browser entries.

**The instrument lives outside the repository.** `C:\Users\Edison\AppData\Local\Temp\opencode\site-associations-falsify\`,
because `extension-preview`'s pass failed on exactly this point: a measuring script left in the
repository root is something every future `pnpm lint` has an opinion about.

| id | tier | defect | outcome | caught by |
| --- | --- | --- | --- | --- |
| `S01` | unit | `addMailbox` overwrites an envelope it cannot narrow — the deletion D9 refuses. | caught-by-intended-assertion | createChromeMailboxes > leaves a record it cannot read in place rather than replacing it |
| `S02` | unit | Recording a mailbox this device already holds appends a second copy of it. | caught-by-intended-assertion | createChromeMailboxes > moves a mailbox this device already holds rather than keeping the copy it cannot read |
| `S03` | unit | Recording one mailbox silently deletes an older one this build cannot read — the loss found while choosing this mutation list, and the reason `prependStoredMailbox` exists. | caught-by-intended-assertion | createChromeMailboxes > keeps a member it cannot read when it records a new mailbox |
| `S04` | unit | The reader validates the shape of a host key, so an IPv6 literal or a punycode label stops resolving. | caught-by-intended-assertion | createChromeSiteAssociations > answers for keys a host pattern would reject, because the platform's spelling is the key |
| `S05` | unit | `saveSiteMailboxId` replaces an association envelope it cannot narrow. | caught-by-intended-assertion | createChromeSiteAssociations > leaves a record it cannot read in place rather than replacing it |
| `S06` | unit | The write is rebuilt from the narrowed map, so recording one host deletes another host's unreadable entry. | caught-by-intended-assertion | createChromeSiteAssociations > keeps a key it cannot read out of the answer and out of the record |
| `S07` | unit | Two records share one key, so either write destroys the other. | caught-by-intended-assertion | building the extension's records > keeps each record under its own key, so one record's write is not another's |
| `E01` | browser | The key carries the scheme, so one host resolves to a different mailbox per scheme. | caught-by-intended-assertion | [chromium] › e2e\in-page-associations.spec.ts:155:3 › which mailbox a page is offered › resolves the same mailbox on http and https, because the key is the host |
| `E01b` | unit | The key carries the scheme, so one host resolves to a different mailbox per scheme. | caught-by-intended-assertion | choosing the mailbox a page is offered > asks about this page's own host and no other |
| `E01c` | unit | `location.host` instead of `location.hostname`, which includes the port — and so splits one site across every port it is served on. | caught-by-intended-assertion | choosing the mailbox a page is offered > asks about this page's own host and no other |
| `E02` | unit | A host's recorded mailbox is ignored, so every page is offered the newest. | caught-by-intended-assertion | choosing the mailbox a page is offered > offers the mailbox this host was last used with, and inserts that one |
| `E03` | unit | The host is asked but never told, so the association is never written and the next visit starts over. | caught-by-intended-assertion | choosing the mailbox a page is offered > records the mailbox it inserted, under this host |
| `E04` | unit | The control announces an offer without naming the address it would insert. | caught-by-intended-assertion | naming the address in the control > names the address it inserts, and keeps it out of the page's own text |
| `E05` | unit | The two records are merged, so an address the person moved on from is offered again and the collection's order is lost. | caught-by-intended-assertion | the mailboxes this device could insert > answers the collection when it holds anything, and never asks the other record |
| `E06` | unit | The singular record answers alone, so a device that created a mailbox after this change is offered one address forever. | caught-by-intended-assertion | the mailboxes this device could insert > falls back to the singular record when the collection is empty |
| `E07` | unit | A created answer's id is read off its address, so a host record is keyed by the wrong value. | caught-by-intended-assertion | narrowing an answer > reports no answer for a created answer with no mailbox id |
| `E08` | unit | The extension's own source names `saveMailbox` — the write the widened seam forbids it. | caught-by-intended-assertion | architecture boundaries > stops the extension writing the record it only reads |
| `B01` | browser | The association is never written, so the device's own `chrome.storage` holds no host record after an insertion. | caught-by-intended-assertion | [chromium] › e2e\in-page-associations.spec.ts:177:3 › what the device remembers afterwards › records the mailbox it inserted, under this host |
| `B02` | browser | An association is written once and never replaced, so a stale entry outlives the insertion that should have corrected it. | caught-by-intended-assertion | [chromium] › e2e\in-page-associations.spec.ts:217:3 › what the device remembers afterwards › replaces a stale association, and only once something is inserted |
| `L01` | browser | `all_frames` is set, so the content script is injected into every frame — and an affordance now appears beside a field inside somebody else's iframe. | caught-by-intended-assertion | [chromium] › e2e\in-page-associations.spec.ts:282:3 › the two limits that stay › reaches a same-origin iframe's field with nothing, because all_frames is unset |
| `L02` | browser | The insertion is mirrored into `localStorage`, so the page's own `storage` listener hears about an address it was never told about. | caught-by-intended-assertion | [chromium] › e2e\in-page-associations.spec.ts:308:3 › the two limits that stay › gives the page's own storage listener nothing, and the listener demonstrably works |

### What the table found that reading the code would not

**One browser case could not fail, and it was the case named for the claim it was supposed to carry.**
`records the mailbox it inserted, under this host` **seeded** the association it then asserted: the
seed made the controller offer `STORED_MAILBOX`, the press inserted it, and the assertion read back
the value the seed had already written. Mutation `B01` — the write removed outright — left it green.
**It asserted that the device *holds* an id while naming the claim that the device *records* an
insertion, and those are the same claim only when nothing put that id there first.** The repair
seeds a *neighbouring* host instead and asserts the key is **absent before the press**, which is a
precondition rather than a second assertion: a poll that starts satisfied passes immediately on a
controller that never wrote anything. That is the **eighth** recorded instance of an assertion
narrower than the rule it documents, and the **eighth** recorded *precondition* defect where the
two overlap — `AGENTS.md` carries a "fifth" and a "sixth" and this entry follows the higher total
rather than reconciling a history it did not write.

**The unit tier had no case for the write at all, by the same mechanism.** Two cases read
`held.saves`, and both were about *which* mailbox was chosen and about a stale record being left
alone — their save assertion rode along on cases that would pass without it. A case for the write on
its own was written. **A defect caught in the browser tier and nowhere else is a fact about the tier,
not about the suite**, and the cost of learning it was two table entries and a browser run each.

### Task 5.2's two limit cases, and both of them found something

These were authored last, and each one is an **absence** — the one claim shape a broken instrument
satisfies for free. Both carry their own control, established before the absence is read.

**One of them read the wrong document, and the platform rule that says so was written in its own
comment and then applied backwards.** `L02` mirrors the insertion into `localStorage`, and the case
that claims "the page's own `storage` listener hears nothing" installed its listener **on the page
that performs the write**. A `storage` event is delivered to *other* same-origin documents and never
to the writer, so the mutation left the case **green** for the same reason a page cannot hear itself
type. The repair installs listeners on **both** documents, proves the neighbour hears nothing of the
control write, and then reads the **neighbour's** listener after the insertion — the only place a
write from this page can be observed. **A correct note and an incorrect assertion are produced by the
same mistake**, and the mutation is what separated them.

**The other corrected a claim the platform had already contradicted.** The case asserted
`"chrome" in globalThis === false` for the page's world, on the reasoning that a content script's
isolated world means the page cannot see the extension's platform global. **Chromium answered
`true`** — a web page does get a `chrome` object, carrying the long-deprecated `loadTimes`, `csi` and
`app` properties. **A platform global's *presence* is not its *content*.** The case now names the
three namespaces this product actually uses — `storage`, `runtime` and `alarms` — and requires all
three to be absent from the page. Listing three rather than testing a wildcard is deliberate: a
wildcard would be satisfied by a *new* extension API appearing without anyone deciding the page
should get it.

**And `all_frames` is now proved behaviourally rather than only from the manifest.** `L01` sets it,
and the iframe case goes red. The case carries two controls of its own — the frame proves it is
loaded by carrying the affordance's hook and being seen carrying it, and the **top frame of the same
page still gets an affordance** — so it cannot pass on a build whose content script had stopped
running altogether, which is the defect an absence assertion is most likely to hide.

### Three predictions in the mutation list were wrong, and all three are recorded on their entries

- **`E01b` predicted the unit tier could not see a wrong key shape.** All seven cases in
  `content-script-associations.test.ts` went red: the fake records are keyed by an exact string, and a
  scheme-qualified key simply misses. The entry is a counted mutation now.
- **`E01c` predicted the unit tier could not tell `location.host` from `location.hostname`.** A
  case failed immediately, because **Vitest's jsdom environment defaults to `http://localhost:3000`**
  and so `host` carries a port there. The substitute platform had a port in it the whole time and the
  prediction was made by reasoning about `document.location` instead of reading it.
- **`E07` predicted the compiler would reject reading an id off an address.** It compiled and was
  caught — `readText` returns `string | null` and the existing `=== null` guard absorbs it. Declared
  `nocompile` before it was run and reported as a `MISMATCH` rather than folded into the table.

**And the `evidence` class ended up empty**, which is the finding rather than an absence: two entries
were declared as measurements of a tier's blindness and **both were falsified by their own runs**. A
third candidate was **dropped rather than filled in**, because inventing an evidence row is the same
error as inventing a green one — it would put a claim about a tier's limits into this table on the
strength of reasoning instead of a run.

### One rule the mutation list did not cover, falsified separately afterwards

The **twenty-first** entry in the table is `extensionSingularWriteViolations`. Writing the
browser-tier helper's exemption turned out to be a **twenty-second** rule change, and it was found
by `pnpm verify` rather than by the harness — recorded here because the harness's tally does not
cover it and a table of 21 that silently omitted a rule would be worse than a table of 23.

`apps/extension/e2e/helpers/in-page-fixture.ts` installs a `storage` listener **inside the fixture
page** and reads `event.storageArea`, which is the positive control for a claim about the
product's mechanism being invisible to a page. `clientStorageApiViolations()` fired on it.

**The fix is not a carve-out on `localStorage`,** because that would have permitted the exact thing
the requirement forbids, in shipped code, everywhere. It is an exemption for **the browser tier's
own directory**, read out of each suite's `playwright.config.ts` by the existing `browserSuites()`
helper rather than written down here — so **an unparseable configuration yields a path no file is
under, and the rule reports**, which is the direction the sibling collection rule fails in.

**Two mutations, both caught by the intended assertion, restoration SHA-256 verified:**

| id | tier | defect | outcome | caught by |
| --- | --- | --- | --- | --- |
| `B02` | unit | The exemption is widened to "skip every file in a client" — the classic over-broad allowance. | caught-by-intended-assertion | keeps storage, cookies, and the URL out of every client > the rule should report each client that must be scanned |
| `B03` | unit | The exemption's prefix is shortened by one segment, so it covers the **parent** of every suite's `testDir` — the shipped client root. | caught-by-intended-assertion | keeps storage, cookies, and the URL out of every client > one directory above a suite's testDir is shipped client code, not its harness |

**`B03` is the reason the second control exists.** The first assertion — a probe *inside* `testDir`
goes unreported — is satisfied by an exemption that skips too much, so on its own it would have
green-lit `B03`. The pair is the file's standing rule: **an exemption asserted from one side is a
hole until it is asserted from the other.**

**And the control's own first draft read its own message.** `hit.includes("__harness-probe.ts")`
also matches `__outside-harness-probe.ts`, because one name contains the other — so the
unreported-inside assertion passed on the reported-outside violation. The filter is now
slash-anchored. **A substring is not a name**, and this file has already recorded a rule that
reported the wrong file for the right reason.

### One divergence found by reading the delta against the code, and it was the code that was wrong

**The scenario "The association cannot be read at all" was in the delta before a line of it was
written, and the implementation did not do it.** `resolveForThisHost()` asked both records inside one
`Promise.all`, so a rejected lookup rejected the **whole** boot read — which set `readFailed`,
which means "this device cannot say what it holds", which means **offer nothing at all**. So a
device holding three mailboxes and one broken preference offered a person no address, and the
requirement says it SHALL offer the newest.

**The requirement is right and the implementation was wrong, and the reason is that the two reads
are not the same kind of question.** The collection read decides *whether this device holds
anything*; its failure is exactly what `readFailed` is for, because offering to create on a device
whose contents are unknown would offer a second mailbox. The lookup decides only *which* of the
mailboxes it holds this host was last used with — and a device that can say "here they are, newest
first" and cannot say "this host used one of them" is not in doubt about anything. The newest is
founded, and it is the answer this host would have received had no association ever been recorded.

**The fix is one `.catch(() => null)` on the lookup, and it is the only rejection in the file that
is absorbed rather than remembered** — which is why it carries a note saying so. Absorbing the
*collection* read's rejection as well would have been the obvious over-correction, and a mutation
doing exactly that is in the table: it is caught by the two cases in `content-script.test.ts` that
carry the blocked-read arm, so the repair does not quietly delete the rule it sat next to.

**And no unit case could have found it, because no unit case failed.** The scenario needed a case
whose *only* failure is the lookup, and the fake had one flag that failed both reads: `loadRejects`.
A case written against that flag would have asserted "offers nothing" and passed — on the buggy
implementation and on a correct one alike, because a correct implementation for the wrong reason
looks identical from here. `fakeRecords` gained `loadSiteRejects` for it, and the reason is written
on the option: **one flag for both arms makes the second arm unreachable.**

**It was found by reading the delta against the code, not by any run.** That is worth recording
plainly, because twenty-one mutations and three blocks of browser runs had all passed against a
tree carrying a requirement its own delta stated and its own implementation did not. **A suite can
be green about a claim nothing asserts**, and the instrument that finds it is a person comparing
what was asked for with what was built.

### A second divergence, and this one was falsified by a rule the same change added

The `spectre-storage` delta's scenario said the collection's first entry **"SHALL be the mailbox the
single-mailbox contract reports as current"**. **Measured on 2026-10-09, over the real
`chrome.storage` adapters and the repository's own fake area, on a device that recorded two mailboxes
through this build**:

```text
collection=["newest","older"]  first="newest"  single=null
keys=["get(mailboxes)","set(mailboxes)","get(mailboxes)","set(mailboxes)","get(mailboxes)","get(current)"]
```

So the clause is false in the strongest way available: the single-mailbox contract has **no answer
at all**, because D8 moved every write in this client onto `addMailbox` and the singular key is never
written. It also names a pairing no adapter has — the website's only adapter serves the singular
record and has **no collection adapter at all**, so on the website there is nothing to compare with.

**The requirement is not weakened; the pairing is.** The newest *is* unambiguously the mailbox an
insertion would use, which the requirement's own prose already says and which
`loadInsertableMailboxes` is the one place required to answer. What cannot hold is the cross-check
against a second contract, and the reason it is not implemented is **one write and not two** — the
paragraph above the scenario forbids exactly that, and `chrome.storage` has no transaction that
would make two writes atomic.

**And the change's own boundary rule falsified the reason the code gave for not merging.** D8's
`extensionSingularWriteViolations` forbids every module in `apps/extension/src` from naming
`saveMailbox`, which means the singular record can only have been written by a build that predates
the collection — it is **strictly older** than every member, by construction. `loadInsertableMailboxes`
said a merge would "call a newest-first order a fact about a list the two records were written in no
common order", and that is false: the order is known, and a merge would have been
`[...collection, singular]` deduplicated by id. **The note and the test comment carrying it are
corrected.**

**The decision itself stands, on a different and honest reason: nothing in this milestone can show a
second entry.** The popup renders one address, the in-page control names one, and the worker creates
one. Merging would put a second element in a list with no surface to put it on, and would add a
branch for a singular read that fails while the collection is in hand — a failure that would
otherwise cost the device an address it can read perfectly well.

**The cost is recorded rather than solved**, because solving it is a surface this milestone does not
have: **a mailbox recorded before this build stops being insertable once this device records
another one.** It is still stored and still readable through the singular contract; it is simply no
longer offered. That limit is now a scenario in the delta rather than only a note in a source file,
so a promoted spec carries it.

**Both divergences were found by the same instrument — a reader comparing the delta with the code —
and neither by a run.** That is now two for two in this change, and the second was found while the
third of three browser blocks was still going, which is the point recorded above: a block measuring a
tree that is about to change is not evidence about the tree that gets committed.

### Seven defects in the instrument itself, and six were the same mistake

**The mistake was a script asserting something about the world it had not read.** A `$`-prefixed
code span in prose, a non-greedy capture, an environment variable applied where it did not belong, a
reporter name resolved by someone else's loader, prose written inside a template literal, and a
compiler asked about a format it does not parse are six spellings of one failure: the instrument had
an expectation and reported an outcome without checking the expectation held.

- **The generator duplicated the artifact it was generating.** The first version of the script that
  writes this section inserted it with a **string** replacement, and `String.prototype.replace`
  interprets `$&`, `` $` `` and `$'` inside a string replacement. The result was a `design.md` of
  **515 lines where 347 were intended**, with every heading appearing twice — and it looked
  plausible, because a heading count with pairs in it reads like a document with subsections rather
  than like a failed edit. The repair is a **function** replacement, which disables all three. **A
  `$`-prefixed code span inside prose is enough to do it**, and this file is nothing but prose.
- **A non-greedy capture against an optional trailing group.** `vitestFailures` read
  `^\s*(?:x|FAIL)\s+(.*?)(?:\s+\d+\s*ms)?\s*$`, and every `detail` came back as a single word —
  `the`, `naming`, `choosing`. The assertion still *matched*, because matching ran against the whole
  line, so a correct outcome was reached through a broken reader. **An instrument that answers
  confidently and wrongly is worse than one that declines to answer**, and only readable attributions
  make a `wrongcatch` distinguishable from a mis-parse.
- **The empty browser path was applied to browser runs.** `run()` set
  `PLAYWRIGHT_BROWSERS_PATH` unconditionally, because that setting is what proves `pnpm verify` works
  with no browser installed — so three browser mutations ran against a directory holding no Chromium
  and came out `harness-error — no pass/fail summary`. **Three identical answers are an instrument
  measuring its own environment.**
- **`--reporter=default` does not resolve from this context.** Playwright resolves its own default
  reporter's name through `require.resolve` from inside `playwright/lib/cli`, which throws
  `Cannot find module 'default'` before a single test is collected. `--reporter=list` works.
- **The case prose was written inside a quoting construct of its own.** The script that inserts the
  two limit cases held them in a template literal, and the prose mentions a fenced code block — so
  the literal ended early and the script died with `Cannot access 'toAnchor' before initialization`.
  **The prose is the part that must be able to say whatever it needs to say**, so it now lives in a
  `.txt` beside the script and is read from there.
- **A JSON file has no `tsc` opinion, and reporting one would have measured nothing.** `L01` mutates
  `static/manifest.json`, so the harness's per-mutation typecheck was pointed at the extension
  project — which says nothing about JSON. It now reports "nothing to check" for a `.json` path and
  relies on the build, because `static/` is copied into `dist/` and the browser loads that copy.
  **`nocompile` must mean "the compiler refused", never "the compiler was never asked".**
- **And the tree was nearly restored with `git checkout`.** A debug step reverted a mutation with
  `git checkout -- apps/extension/src/content-script/controller.ts` — on a file whose entire
  slice-3 implementation was **uncommitted**, so the restore was correct for the file `git` knew
  about and catastrophic for the one it did not. **Reaching for a VCS restore on a working tree
  that was never committed is the operation most likely to look harmless.** The file was rebuilt from
  the two copies that survived: the intact `dist/content-script.js`, which the harness had rebuilt
  from the restored source minutes earlier, and the tests, which were never touched. The code came
  back; the prose was rewritten, and a reader comparing that file to the propose-stage diff is
  comparing against a file that was never committed.

### The sync tool shipped a bug that would have written a delta-only marker into a promoted spec

**Found while preparing the sync stage rather than during it, and it is the most consequential
instrument defect in this change** — because the file it lives in was written *believing* the same
defect had already been found and fixed.

`promote.mjs` copies each delta requirement block into the promoted spec. Its block reader ended a
block at the next `### Requirement:` heading and not at the next `## ` heading, so in a delta file
the `## ADDED Requirements` heading was swallowed into the block above it. The script's own header
claimed this was fixed: the reader was changed to "only open a block inside a section", on the
reasoning that this "closes it at the next section for free".

**That reasoning is false, and it is the second time this exact mistake has been made here.** Refusing
to *open* a block outside a section says nothing about *closing* a block that is already open: `mode`
does change at the section heading, but the open block then runs on to the next `### Requirement:` —
which now sits inside the new section — and absorbs the heading whole. Opening is not closing.

Measured on 2026-10-09, promoting this change on a throwaway copy of the repository:

```text
spectre-storage promoted spec: 676 lines
line 518: ## ADDED Requirements      <-- a delta-only marker, between two promoted requirements
line 165: ## ADDED Requirements      <-- and the same in in-page-integration
verify: 8 blocks checked, 6 byte-identical
PROBLEMS: in-page-integration "The affordance inserts the address this device already holds" DIFFERS
          spectre-storage       "A stored record narrowed on the way out, whatever the platform" DIFFERS
```

A promoted spec has `## Purpose` and `## Requirements` and no sections to add to, so that heading
would have shipped **inside a requirement block**, where a reader of the promoted spec would find a
marker that means nothing there and a requirement that silently lost nothing anybody noticed.

**What caught it was the second script, and only the second script.** `verify.mjs` was written with
a deliberately different reader — section first, then requirement inside a section — precisely so it
would not inherit the promoter's blind spot. That independence is structural rather than a claim:
neither file imports the other, and all four reader functions (`splitBlocks`, `promotedBlocks`,
`blocksFromDelta`, `blocksFromSpec`) are separately defined. **A promoter that also verified itself
could not have reported its own defect**, which is the whole argument for the two scripts.

The fix closes a block at a section heading explicitly, rather than by a property of when blocks may
open. Re-measured after the fix: **8 blocks checked, 8 byte-identical**, and no
`## (MODIFIED|ADDED|REMOVED) Requirements` line anywhere under `openspec/specs/`.

**The repair was falsified in both directions rather than assumed.** Reinstating the broken reader
brought the corruption back in **both** capabilities and `verify` reported both differences; mutating
one clause of one promoted block made `verify` exit `1` and restoring it made `verify` exit `0`; and
promoting twice is **refused** with `ADDED block is already promoted` rather than silently doubling a
block. All four controls ran against a copy of `openspec/` in a temp directory, and the real
`openspec/specs/` was confirmed unchanged (`git status --porcelain` empty) before and after every run —
including the first, which is how a dry run proved to be a dry run rather than an argument that it
was one.

## Risks / Trade-offs

- **A collection grows without bound** → `chrome.storage.local` holds 10 MB by default in an MV3
  extension's own area, and this product creates mailboxes one at a time on a person asking for
  them. No cap is added, because a cap needs a policy (which mailbox to drop? the oldest is the one
  a site association may name) and the requirement would have to guess. Recorded as an open
  question rather than a rule.
- **Two records for the extension's mailbox until M10** → the extension's writes are traceable to
  `addMailbox` in one call site, and a boundary assertion that the extension's create path writes no
  singular mailbox key makes the duplication observable rather than folklore.
- **A stale association is honoured forever** → the requirement says the opposite: a mailbox this
  device no longer holds is **not offered**, so the worst case is that the record is ignored. The
  record is left in place deliberately (D-level reasoning in the requirement).
- **The label now contains an address, so it is longer** → inside a stranger's field, the control is
  positioned beside the field and could overflow a narrow layout. Nothing in this repository can
  measure that; recorded as a limit, not solved.
- **`packages/ui` must stay at 38 tests** → a rise would mean the label work introduced visual
  surface no capability describes. The shadow root's stylesheet is self-contained and already
  carries literals, so a label length needs no new token — but the count is the check that says so.

## Migration Plan

None in the deploy sense: there is no server, no schema version shared with any other build, and no
data this product has not already written. Concretely:

1. The extension starts writing the collection on creation. Existing users' singular record is
   **never migrated** — it is still read by nothing in the extension once the create path switches,
   so an existing user who has never created a mailbox in the new build sees an empty collection and
   is offered creation, which is the same offer they see with no mailbox at all.
2. `clearAll` removes both, on both substrates, without a migration step.
3. Rollback is removing the extension's new code: the singular record is untouched by it, so a
   rollback restores the previous read path with the previous data intact.

## Open Questions

- **Should the collection have a cap, and if so what happens to an association naming the mailbox a
  cap would drop?** Answerable at M10 without changing these specs, because no requirement here
  depends on the collection being unbounded — only on the first entry being the current one.
- **Does M10 want the popup to show the whole collection?** The specs here deliberately say nothing
  about the popup's list, so a later change can add one without amending this one.