# The side panel offers removal of what this device holds, and says what that removed

## Why

`docs/ROADMAP.md`'s **M12 — Release Hardening** section lists nine things to review, and the ninth is
`clear-data behavior`. Nine of them are audits; **this is the one that is a gap in the product rather
than a question about it**, and the gap is not a suspicion — it is written into a promoted requirement:

> **The extension ships no control that removes it.** The website's two-step removal reaches its own
> IndexedDB store and this contract has no adapter there, so a person who installs the extension and
> later wants these ids gone has no surface that offers it. **That gap is pre-existing for the
> extension's other two record kinds and is not closed here**; closing it is a control on a surface
> this change does not touch.
>
> — `openspec/specs/spectre-storage/spec.md:702`–`:709`, inside the requirement headed *"The message
> ids this device has been told about are a record kind of their own"*

Verified in the tree at proposal, rather than taken on trust:

- `apps/extension/src/storage.ts:68`–`:73` — the extension keeps **four** record kinds over one
  `chrome.storage.local` area: `stored`, `mailboxes`, `associations`, `seen`.
- **No shipped extension module removes any data.** The only `.clear(` under `apps/extension/src` is
  `alarms.ts:81`, which clears an *alarm*; every other match is a test file or a DOM `remove()`.
- The **website** has had this control since M6 slice 3 (`apps/web/src/LocalData.tsx`), so a person
  who clears their data on the website is told *"The address above still works until the provider
  discards it"* and a person who clears their data on the extension is told nothing at all, because
  there is nowhere to press.

**A privacy control that one client has and the other does not is the shape M12's `clear-data
behavior` line is naming**, and the extension is the client that holds *more* kinds over *more*
surface: four records rather than one, and a `chrome.storage.local` area shared with the popup, the
in-page control and the background wake.

### What this change does **not** have to build, and that is the finding

The orchestrator's constraint was to check whether `packages/storage` must change. **It must not, and
the reason is that M6 slice 3 and `extension-foundation` between them already built every part of
this:**

- `SpectreStorage.clearAll()` exists — `packages/storage/src/contract.ts:141`.
- The `chrome.storage` adapter **already implements it as `area.clear()`** —
  `packages/storage/src/chrome.ts:218`–`:220`, whose own note gives the reason verbatim: *"The whole
  area, and for the same reason the IndexedDB adapter deletes the whole database — deleting
  `EXTENSION_MAILBOX_KEY` would be the smaller function, would pass every test written against
  today's single record, and would quietly stop clearing everything the moment a later build added a
  second record kind."*
- **The planted-unknown-record falsification already exists too**, twice over:
  `chrome.test.ts:235` writes through three *different* contracts and requires one removal to clear
  them all, and `chrome.test.ts:257` plants `"a-record-from-another-build"`. The first even asserts
  the **call** rather than the result — *"An empty area is what both a whole-area clear and a
  delete-every-known-key produce, so the result alone cannot tell the two apart."*
- `spectre-storage:646`'s requirement *"A record kind added by a later build is removed by the same
  control"* already obliges removal to cover records written through a contract the remover never
  names. **It is satisfied today and needs no amendment** — `design.md` D2 argues why.

**So the gap is exactly one thing: no shipped surface calls an operation that already exists and is
already verified.** That is why `packages/storage` is held at **86** in this change rather than
carrying a new test, and it is stated here rather than discovered at apply.

## What Changes

- **The side panel offers removal, in the extension's own words.** A region — the website's shape,
  not a new one — that says what this device holds and offers to remove it. Every sentence is a
  `PANEL_COPY` entry beside the requirement it serves, which is that module's stated reason for
  existing.
- **Removal is two steps and irreversible, because the address is often the one a sign-up in progress
  is waiting on.** The website's `LocalData.tsx:61`–`:69` argues it and the argument transfers
  verbatim: creating a replacement does not recover anything already sent to the old address.
  **It is an inline second step rather than a native `confirm()`**, for the website's stated reason —
  a native dialog cannot be styled and cannot be driven by this repository's tests.
- **The whole area goes, through the contract, on the one operation that already means "everything".**
  The panel reaches `records.stored.clearAll()` and nothing else. **A panel that removed the four keys
  it knows by name would pass every test written against those four** — which is why the browser case
  plants a record this build does not recognise rather than checking four known keys.
- **The panel's copy says what removal is and is not.** It deletes *this device's note of* the
  mailbox. The website already handles the hard half of this — removal deletes this device's note, not
  the address, and the mailbox stays usable on screen (`LocalData.tsx:206`–`:209`). **The extension's
  equivalent is that the panel holds nothing afterwards**, and the copy states that the mailbox still
  exists at the provider. **Nothing here claims an address is gone.**
- **`PanelRecords` gains one member and it is a removal, not a write.** The interface has no write
  member today and `Panel.tsx:221`–`:223` says so deliberately — *"Nothing here is written anywhere,
  and the requirement's 'SHALL NOT be recorded' is discharged by the type having no outlet."* **That
  type is what makes "the panel does not write the address back" a property rather than a hope**, and
  the one member added is the opposite of a write. `design.md` D4.
- **Two `spectre-storage` amendments, and both are corrections rather than additions.** The prose at
  `:702`–`:709` becomes false the moment the control lands and is replaced; and the requirement that
  says removal *"SHALL be observed on the platform a user's browser actually provides"* gains the
  second substrate, because leaving it IndexedDB-only would leave the new observation unrecorded —
  which is the defect that requirement exists to prevent. `design.md` D3 and D6 argue each.

## The falsifiable claim, in one sentence

> **After the panel's control is confirmed, the whole `chrome.storage.local` area is empty —
> including a record this build does not recognise and including a record written through a contract
> the panel never named — and the panel then reports holding nothing, with the mailbox still shown.**

## What this change does not do

Four things, each named so the change's boundary is on the record rather than inferred:

- **The `sidePanel` permission finding is not this slice, and it cannot be settled offline.** Verified
  at proposal: **no shipped module under `apps/extension/src` names `sidePanel` at all** — the panel
  is reached through `side_panel.default_path`. So the fourth entry in `manifest.spec.ts:246` is
  traceable to no shipped code, which is exactly what that requirement's *"it SHALL request no
  permission that no shipped surface uses"* clause forbids. **But `docs/PROVIDERS.md` §4.6 measured
  it on a control differing in the permission *and* the `side_panel` key together** — *"the permission
  is one of the two and cannot be separated from them on this substrate"* — so removing it or keeping
  it needs a Chromium carrying the key **without** the permission. **That instrument does not exist
  and this change does not build one.** It is a finding for a review, not a slice.
- **The "what SpectreMail does not collect" privacy document is a separate slice.** It is item three
  of M12's *privacy documentation* list and it is a document, not a control. Writing it before the
  extension can act on its own data would publish a claim about a gap this change is closing.
- **Provider terms and rate limits are not re-checked.** M12 lists them; every one needs live network
  and `docs/PROVIDERS.md` is a file this change does not touch.
- **Branding is not validated.** M12's branding check needs a name-collision search, a domain check
  and store searches. It needs a web search and it is not this slice.

## Capabilities

- `extension-client` — **one `ADDED` requirement.** The control is a client capability, and its home
  is beside the three side-panel requirements `side-panel-surface`, `panel-mailbox-choice` and
  `panel-verification-state` added. **`website-client`'s *"The user can make this device forget the
  address"* is the model and is not copied verbatim** — the panel is not a page and several of its
  clauses are about a tab that can close. `design.md` D1.
- `spectre-storage` — **two `MODIFIED` requirements, zero added, zero removed.**
  1. *"Removal is observed in a browser, not only against a test substitute"* — **amended rather than
     left**, because its first sentence is about *"the removal operation"* and its only scenario is
     IndexedDB-worded (*"the database SHALL no longer exist"*). `chrome.storage` has no database, so
     the requirement as written **cannot be satisfied by this change's observation at all** — and the
     file's own idiom for exactly this case is the heading *"A stored record narrowed on the way out,
     **whatever the platform**"*. One scenario added, the IndexedDB one carried verbatim.
  2. *"The message ids this device has been told about are a record kind of their own"* — **amended
     because its prose becomes false.** Its `:702`–`:709` paragraph asserts the absence of a control,
     and *"That gap … is not closed here"* is a claim this change deletes. Replaced, not removed: the
     requirement's own reasoning for why it says nothing about removal is kept and corrected.
     `design.md` D3.
  **The requirement at `:646` is deliberately NOT amended**, and that is a decision with a reason
  rather than an omission — `design.md` D2.
- **`spectre-storage`'s requirement at `:288`, *"What this device holds can be removed on request"*,
  is deliberately NOT amended either.** It obliges *the contract* to offer the way, which it does and
  has since M6 slice 3. It never claimed a client offers a control, and widening it to say so would put
  a client behaviour inside the storage layer — `design.md` D2.

## Impact

- **Requirements affected:** `extension-client` **+1**; `spectre-storage` **2 modified, 0 added, 0
  removed**. **Three blocks promoted, one requirement added** — the block count and the requirement
  delta are different figures, and **that is the usual shape here: two `MODIFIED` blocks each
  replace rather than add.**
- **Promoted counts after sync** would stand at **168 requirements** across the same **14
  capabilities**, and **544 scenarios** — from **167 and 534**, both **re-counted by heading across
  `openspec/specs/` at proposal** rather than transcribed. **The scenario figure is predicted here
  (9 new in `extension-client`, 1 added to `spectre-storage`, none added by the second `MODIFIED`
  block) and is to be re-measured at sync**, which is what this repository does.
- **Source touched:** `apps/extension/src/panel-copy.ts` (the sentences), `Panel.tsx` (the region, its
  state and one interface member), `panel-main.tsx` (passing the member). **`Panel.tsx`'s provider
  path, host-naming, mailbox chooser and session handling are untouched.**
- **Tests added:** `apps/extension/e2e/side-panel.spec.ts` **20 → 28**, one case per browser-observable
  scenario, derived in `tasks.md` 5.1. Plus unit cases in `apps/extension/src/Panel.test.tsx` and
  `apps/extension/src/panel-copy.test.ts`. **`apps/extension` unit 451 → 465** (derived per file in
  `tasks.md` 4.1–4.2). **Extension browser tier 89 → 97.**
- **Held, and re-measured at proposal from `--reporter=json` grouped by project — not off a summary
  line, and not taken from `AGENTS.md`:**

  | held at | what | why |
  | --- | --- | --- |
  | **125** | `apps/web` tests | the website already ships this control; touching it is scope creep |
  | **38** | `packages/ui` tests | **adding a token, a class hook or a stylesheet rule is a failure of this change.** The region uses `<section>`, `<h2>`, `<p>` and `className="control"`, and **all four hooks are already selected by rules that exist** — `apps/extension/src/styles.css:128` (`.panel section`), `:141` (`.panel h2`), `:151` (`.panel p`) and `:203` (`.control`), each of which already reaches for tokens rather than literals (`design.md` D5) |
  | **86** | `packages/storage` tests | **`clearAll` and its falsification already exist** (`chrome.ts:218`, `chrome.test.ts:235`/`:257`) |
  | **166** | `packages/mailbox` tests | the panel reads what the session already produced |
  | **53** | architecture boundary assertions | **no rule is added** — each property already has an instrument, named in `tasks.md` 7.1 |
  | **byte-identical** | `apps/extension/static/manifest.json` | zero new permissions, zero new manifest keys |

- **Manifest:** byte-identical, SHA-256 `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`,
  re-measured at proposal. **This is the same hash `panel-verification-state` recorded**, which is
  the arithmetic that a milestone adding a control inside an already-declared surface adds no manifest
  entry — and `extension-client`'s *"The extension declares its non-goals"* requirement carries an
  amendment from `panel-mailbox-choice` that anticipated **this exact shape** and needs no further
  amendment.

## What none of this measures

- **Nothing about how the panel looks.** `Panel.test.tsx` reads a DOM; the browser cases read a
  **served** area through the platform's own API. No test in this repository reads a rendered pixel,
  and **adding a stylesheet rule — the only way this control could be made prettier — is declared a
  failure of the change**, so the control is deliberately styled by rules that already existed.
- **Nothing about a person reaching the panel.** With `openPanelOnActionClick` unset the panel is
  reachable only through Chromium's own side-panel entry point, and `docs/PROVIDERS.md` §4.6 records
  that Playwright adds **no `Page` for a docked panel at all**. The browser cases open the panel
  document as a tab, which **is a substitute and cannot answer "which page am I beside"** — recorded
  there and unchanged by this change.
- **Nothing about the extension's remaining footprint after removal.** See `design.md` D7: the armed
  background alarm is **not** cleared by this change, and the residual is named rather than glossed.