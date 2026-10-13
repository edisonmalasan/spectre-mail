# Design record — `extension-clear-data`

Every claim below was read out of the tree on 2026-10-13 rather than recalled. Where something is
**not** measured, this file says so in the same sentence as the claim it qualifies, because a
qualified claim read without its qualification is the defect this repository records most often.

**The change's whole shape is one sentence, and it is worth putting first because everything below is
a consequence of it: the operation already exists, is already implemented as the whole-area operation,
and is already falsified against an unrecognised record. The gap is that no shipped surface calls
it.** `SpectreStorage.clearAll()` (`packages/storage/src/contract.ts:141`) exists since M6 slice 3;
`packages/storage/src/chrome.ts:218`–`:220` implements it as `area.clear()` and says why in prose;
`packages/storage/src/chrome.test.ts:235` writes through **three** contracts and requires one removal
to clear all of them, asserting **the call** rather than the result because an empty area is what
both a whole-area clear and a delete-every-known-key produce; and `:257` plants
`"a-record-from-another-build"`. **So `packages/storage` is held at 86 in this change rather than
carrying a new test, and that is a measurement of what already exists rather than an omission.**

---

## D1 — The `extension-client` requirement is modelled on the website's and deliberately not copied from it

`website-client`'s *"The user can make this device forget the address"*
(`openspec/specs/website-client/spec.md:765`) is the model, and four of its clauses transfer
verbatim in substance: **the offer, the two-step confirmation, the honest report of a refusal, and
the address staying on screen and usable afterwards.** The last of those is the reason the removal is
not also a teardown, and it is the same reason `LocalData.tsx:206`–`:209` gives.

**Four website clauses do not transfer, and the third is the one that would have been a real defect.**

1. **"Removal SHALL NOT be undone by the page continuing to run"** and the scenario *"The page does
   not write the address back"*. A page keeps running after a removal and has a session, a storage
   seam and an effect that saves; the panel has none of the three in that path. **The claim is not
   dropped — it is discharged structurally** (`design.md` D4), which is a stronger discharge than a
   scenario and is stated as such in the delta rather than restated as a behavioural check.
2. **"The website's own description of what it stores SHALL be true of it, and SHALL NOT describe
   stored data as undeletable while offering no way to delete it."** The panel renders no description
   of what it stores, so this clause has nothing to govern here. **`extension-client`'s *"The
   extension declares its non-goals"* is the nearer analogue and needs no amendment** — the change
   adds a control inside a surface the extension already declares, which is the shape
   `panel-mailbox-choice` anticipated.
3. **The website's refusal copy about closing another tab.** `LocalData.tsx:144`–`:146` says *"If
   another SpectreMail tab is open, the removal may not go through yet — close it and try again"*,
   and that sentence is true **only** of `deleteDatabase`, whose blocked removal is *queued* and
   completes on its own. `packages/storage/src/chrome.ts:218` records that `chrome.storage` provides
   **no `deleteDatabase` and therefore no blocked-removal event**. **Copying that sentence into the
   extension would have told a person on a substrate that cannot produce the condition to go and close
   a tab, for a queueing behaviour that does not exist there.** The panel's refusal carries the
   platform's own words and says nothing about what is still there, in either direction.
4. **The panel is not a page, and one clause is about the page as a running thing.** A panel is a
   document Chromium closes and reopens beside whatever page a person is on; a removal it performed is
   not undone by its closing, and its closing does not complete one either. **So there is no clause
   here about a surface that keeps running, and none about one that stops.**

**What this change adds that the website's requirement has no clause for at all** is the second half
of the pair that makes the two requirements different surfaces: **the panel's removal covers four
record kinds over one shared area rather than one database**, and the popup, the in-page control and
the background wake all read that same area. `apps/extension/src/storage.ts:52`–`:66` already says
why `seen` is there at all — *"putting it on its own would mean a second `chrome.storage.local` handle
whose relationship to the other three nobody could see"* — and the removal is the other end of that
same argument.

---

## D2 — Two requirements are deliberately **not** amended, and both refusals have reasons rather than being omissions

This is the shape `panel-mailbox-choice`'s exploration recorded once: **two unrelated amendments to
one heading are the shape where an amendment gets attributed to the wrong assertion**, so the
decisions are recorded here rather than left for a reader to infer from the absence.

**1. `openspec/specs/spectre-storage/spec.md:646`, *"A record kind added by a later build is removed
by the same control"*. Nothing to amend — it is already satisfied, and it is satisfied by exactly the
thing this change adds.**

Its own amendment note (recorded by `site-associations`, 2026-10-08) says this requirement was
written in the abstract *"while one record kind existed, with nothing to test it against"*, and that
the test it added is *"the one that could not have been written before: a record planted through **a
different contract**, which the contract doing the removing has no operation for"*. **That test exists
at `chrome.test.ts:235` and it already covers what this change's removal does** — the panel reaches
removal through the single-record contract's `clearAll` and the panel names no other contract, which
is this requirement's second scenario word for word.

**Amending a satisfied requirement to add a client that now satisfies it would be the wrong edit for
two reasons.** It would make a diff that reads as though the guarantee needed strengthening when the
guarantee never moved, and it would put a *surface* — the panel — into a requirement whose subject is
what removal *covers*. **The requirement that needed to say something about a surface says so, and
says it in `extension-client`.**

**2. `:288`, *"What this device holds can be removed on request"*. It obliges the contract, and the
contract has obliged it since M6 slice 3.**

Read it: *"The storage contract SHALL offer a way to remove everything this device holds, and that
operation SHALL mean everything… Removal SHALL be reached through the storage contract, like every
other operation on what this device holds."* **Every clause is about the contract's surface area and
none is about a client.** It never claimed a client offers a control; before this change the panel
section of this file held the honest sentence that none did, and this change's second `MODIFIED` block
is what removes it.

**Widening it would put a client behaviour inside the storage layer, and there is a second reason
against it that is about the file itself.** `packages/storage` is framework-free, DOM-free and has
**no client in it at all** — `LocalData.tsx` and `Panel.tsx` both reach `clearAll` as an injected
seam. A requirement saying *"a client SHALL offer this"* would be a requirement about something the
capability does not contain, and the next reader would look for the client here.

**What replaces the old sentence at `:702`–`:709`, then, is not a widened contract requirement.** It
is `extension-client`'s new requirement, and the `spectre-storage` prose is corrected to stop
*denying* that a removal exists while continuing to say nothing about how one is offered.

---

## D3 — Why the "message ids" requirement is `MODIFIED` rather than left alone or removed

**It cannot be left alone, and the reason is specific rather than general: its prose is a claim about
the absence of a control, and this change is that control.** `:702`–`:709` reads *"The extension ships
no control that removes it… a person who installs the extension and later wants these ids gone has no
surface that offers it. That gap is pre-existing for the extension's other two record kinds and is not
closed here."* Three clauses, all false on landing: the control exists, the gap is closed, and **the
gap was pre-existing for the extension's other *three* record kinds, not two.**

That last one is worth stating plainly because it is the kind of number that survives a paragraph
rewrite. `apps/extension/src/storage.ts:68`–`:73` holds **four** kinds over one area — `stored`,
`mailboxes`, `associations`, `seen` — so the sentence understated by one even before this change
wrote it. **The replacement paragraph therefore names the four kinds rather than carrying the number
forward**, because a number in prose about a list the same prose does not enumerate is exactly the
defect this repository records most often, and because the count is the only part of the old paragraph
that could not simply be deleted.

**It cannot be removed, and the reason is that this requirement is about a contract that is alive.**
It is the requirement for `SpectreSeenMessages`: keyed by mailbox id, a write leaves another
mailbox's entries alone, a record that cannot be narrowed is neither returned nor deleted, and a
`chrome.storage` adapter exists with no IndexedDB one. **None of that is about removal and all of it
is still true, still shipped, and still needing a home.** A `REMOVED` block would have deleted five
live scenarios to fix one false paragraph — and `panel-verification-state`'s D1 records that a
requirement removed for containing one obsolete clause is the shape where the requirement's real
subject disappears with it.

**So: the whole block is reproduced, the false paragraph is replaced, every scenario is carried
verbatim, and nothing is added about *how* removal behaves.** The reason for that last restraint is
D2's second half — the confirmation, the refusal vocabulary and the wording are a client capability,
and the whole-area property belongs to two requirements that already say it. **Three blocks are
promoted and one requirement is added**, because two `MODIFIED` blocks each *replace* rather than
add — the usual arithmetic here, and worth stating so a reader expecting three new requirements is
wrong about the total.

---

## D4 — `PanelRecords` gains exactly one member, and it is a removal rather than a write

`PanelRecords` (`apps/extension/src/Panel.tsx:89`–`:94`) has **two** members today, both reads:

```ts
export interface PanelRecords {
  readonly loadMailboxes: () => Promise<readonly Mailbox[]>;
  readonly loadSiteMailboxId: (host: string) => Promise<string | null>;
}
```

**There is no write member, and `Panel.tsx:221`–`:223` says so as a design claim**: *"Nothing here is
written anywhere, and the requirement's 'SHALL NOT be recorded' is discharged by the type having no
outlet: this state is never handed to a seam, never given a mailbox id for a host, and `PanelRecords`
has no write member at all."*

**That is what this change has to protect, and it is why the member added is `clearAll` and not
something shaped like a save.** `panel-mailbox-choice`'s requirement is *"the selection … SHALL NOT be
recorded anywhere"*, and the way this repository discharges an absence is structurally wherever it
can be — `extensionSingularWriteViolations` for the singular record, the no-DOM `tsconfig` for
`packages/mailbox`, the `ChromeStorageArea` parameter for the extension's platform. **A `PanelRecords`
with a write member would be a surface whose write-back the next change could add without any of those
rules noticing**, and the property would survive only as a test.

**And the member is named by what it removes rather than by the records it covers.** Not
`removeMailboxes`, not `clearStoredMailbox` — `clearAll`, because that is the contract member's own
name and the contract's own meaning, and a name listing four record kinds would be the narrower
implementation `chrome.ts:218`'s own note warns against. `panel-main.tsx` passes it as
`storage.records.stored.clearAll` — **through the singular contract, while the area holds four kinds**
— which is precisely the shape `chrome.test.ts:235` was written for.

**Nothing else on the interface moves.** `loadMailboxes` stays a read, `loadSiteMailboxId` stays a
read, and **the panel writes nothing after a removal either** — which is why the requirement's *"the
extension SHALL write no storage record of that mailbox again"* is a structural property and not a
scenario the panel could pass by luck.

---

## D5 — The region uses only four hooks, all of which a rule already selects, and adding a fifth is a declared failure of this change

**`packages/ui` is held at 38 tests and the region adds no token, no class hook and no stylesheet
rule.** The region is a `<section>`, an `<h2>`, `<p>`s, and `<button className="control">`. Every one
of those is already selected by a rule that exists:

| hook | selected by | tokens it reaches for |
| --- | --- | --- |
| `.panel section` | `apps/extension/src/styles.css:128` | `--space-3`, `--space-4`, `--width-hairline`, `--line-subtle` |
| `.panel h2` | `:141` | `--type-xs`, `--weight-medium`, `--tracking-wide`, `--ink-muted` |
| `.panel p` | `:151` | `--ink-secondary` |
| `.control` | `:203` | `--surface-raised`, `--line-strong`, `--radius-md`, `--space-2`, `--space-4` |

**The precedent is in the panel already, and it is the same argument.** `Panel.tsx:715`–`:718` renders
the chooser's trailing sentence as *"A bare `<p>` and no new class hook, because `.panel p` already
styles it and **a hook nothing selects differently would be a rule added for its own sake**."* The same
sentence applies here, and the rule that would catch it is one that already exists —
`boundaries.test.ts`'s *"uses every class hook a client renders"*, which is the instrument that earned
its place during `in-page-fill` by reporting two hooks the popup rendered with nothing selecting them.

**What this costs is stated rather than hidden: the region cannot be made prettier, and it will not
be.** No test in this repository reads a rendered pixel's colour or position, so the control's
appearance is a human judgement no gate stands in for — **and a judgement a human can only make by
opening a panel they may not be able to reach at all** (below). The decision is that a control this
change adds is styled by rules that already exist rather than by a rule added for it, because a rule
added for it is visual surface no capability describes and a `packages/ui` test that moved would have
meant exactly that.

---

## D6 — The "observed in a browser" requirement is amended rather than left IndexedDB-only, because as written it cannot be satisfied by the observation this change makes

`openspec/specs/spectre-storage/spec.md:388` opens *"The removal operation SHALL be observed on the
platform a user's browser actually provides"* — which is about **the** removal operation, not the
website's. **Its only removal scenario says *"the database SHALL no longer exist on the device
afterwards"*, and `chrome.storage` has no database.** The requirement as written therefore **cannot be
satisfied by an observation of the extension's removal at all** — not "is ambiguous about it",
cannot.

**Leaving it is the defect this requirement exists to prevent, in its own words.** It exists because
*"the privacy control this milestone shipped is the claim in this repository least entitled to
confidence… it was verified only against a substitute, and it shipped anyway… Naming it is what this
requirement does."* **A second client reaching the same contract through a second substrate, with the
second substrate observed by nobody, is the same hole one layer over** — and it would be invisible,
because the requirement would still be satisfied by the IndexedDB scenario standing alone.

**What the amendment does and does not claim, since that is where an amendment of this shape usually
goes wrong.** It **adds one scenario** and **adds one paragraph**, and it carries all three existing
scenarios **verbatim**. It does **not** claim the two substrates behave alike — `chrome.storage` has no
transactions, no `deleteDatabase` and no blocked-removal event, which
`:428`'s own requirement already records as platform differences. It does **not** add a
blocked-removal scenario for the second substrate, because **a case a platform cannot produce is a
claim about nothing**; `chrome.test.ts:222`–`:233` asserts the adapter *rejects* when the platform
refuses, which is a different thing from IndexedDB's *queued* removal and is recorded as such. And it
does **not** widen *"the substitute's agreement is stated"* into a general licence: **the agreement
recorded for IndexedDB is the one this file already names, and the agreement for the extension's
substrate is narrower** — a record kind this build does not recognise is planted in the substitute and
is absent from the platform's own listing afterwards, on both.

**Two substrates, two scenarios, and the reason they are not one sentence** is that a claim written
for one substrate and satisfied by the other is the shape this repository has recorded most often, and
because a single sentence would have to invent a word for *"the platform's own listing is empty"* that
neither platform uses. The file's own idiom for exactly this case is the heading *"A stored record
narrowed on the way out, **whatever the platform**"* — **one requirement, platform-specific
scenarios.**

---

## D7 — The residual this change does **not** clear: the armed background alarm survives removal

**`clearAll` removes a storage area. It does not clear an alarm, and nothing in the shipped extension
does either.**

`alarms.ts:81`'s `clearBackgroundAlarm` is reached from exactly one place — `service-worker.ts:180`,
wired as the wake's `clearAlarm`, and `background-check.ts` calls it **only** for the `expired` arm,
*"because a provider's word about a mailbox is not this product's authority to delete the user's
record of it"*. The other path, `reconcileBackgroundAlarm`, returns `false` **without clearing**
anything when `holdsMailbox` answers false (`alarms.ts:126`–`:130`): *"Held none, held one, and no arm
either way"* is about whether to **arm**, and the docstring says why — *"a device holding no mailbox
gets no alarm at all"* — which is a claim about a device that never had one.

**So after a person removes everything, the alarm armed when the mailbox was written stays armed, and
this change does not stop it.** Named honestly, three separate facts:

- **What it costs is a wake, not a request.** `createBackgroundCheck` asks
  `loadInsertableMailboxes(records)[0] ?? null`, an emptied area answers `[]`, so `watched` is `null`
  and `runBackgroundCheck` returns `{ kind: "no-mailbox" }` **before any provider request and before
  any notification** (`background-check.ts:190`–`:192`).
- **What it retains is a name and a period, not an address.** `BACKGROUND_ALARM_NAME` is
  `"spectre-background-check"` and the period is `INBOX_POLL_PROMPT_MS / 60_000` — **so this residual
  is not a privacy exposure and must not be counted as one.** It is a wake every five seconds on a
  device that asked to be forgotten.
- **What is not measured is how long it lasts and whether anything else ever clears it.**
  `docs/PROVIDERS.md` §4.1.1 measured the worker's **idle bound**, not a lifetime, and §4.1.2 measured
  **one listing plus one body read per message, re-read on every wake** — a figure this change does
  not revisit. **No case in this change observes the alarm after a removal, and none should be written
  that would claim it does.**

**Why it is not fixed here rather than deferred with a shrug.** Clearing it from the panel would mean
the panel reaches `chrome.alarms`, and `alarms.ts` is the extension's one platform seam reached through
`extension-platform.ts`; a removal control that also disarms a background check is two capabilities in
one press, and `extension-client`'s alarm requirement (*the worker arms it; the popup asks for it*,
never the panel) would have to be amended to permit it. **The honest disposition is that this is a
finding for the M12 review, recorded here rather than discovered by a person after pressing the
button** — the same disposition the `sidePanel` permission finding gets in the proposal, for the same
reason: **it needs an instrument this repository does not have, and a slice is not that instrument.**

### D8 — The `sidePanel` permission finding is recorded, not settled

Not cited by the proposal's design list and not part of the delta, so recorded here in one paragraph
rather than left as a note someone re-derives: **no shipped module under `apps/extension/src` names
`sidePanel` at all** — the panel is reached through `side_panel.default_path` — while
`static/manifest.json` declares **both** the `"sidePanel"` permission (`:7`) and the
`side_panel.default_path` key (`:10`–`:11`), and `manifest.spec.ts:246` hard-codes
`["storage", "alarms", "notifications", "sidePanel"]`. **`extension-client`'s *"it SHALL request no
permission that no shipped surface uses"* therefore has an entry traceable to no shipped code.**

**It cannot be settled on this substrate, and the reason is a measurement rather than caution.**
`docs/PROVIDERS.md` §4.6 measured the permission on a control differing in the permission *and* the
`side_panel` key together — *"the permission is one of the two and cannot be separated from them on
this substrate"* — so separating them needs a Chromium carrying the key **without** the permission.
**That instrument does not exist and this change does not build one.** It is item nine of M12's
`clear-data behavior` review and it belongs to the review, not to a slice that adds a control.
