# Tasks

Nine groups. **Each group lands the tests and the documentation its own work calls for**, so a group
whose work needs neither carries neither. The last group is the things this change deliberately does
not do and the hand-offs it owes.

**Six properties are held from the first group to the last and are restated here so no group can be
read in isolation without them.** Any movement in the first four is a finding to explain before
anything else is looked at; the fifth is a defect; the sixth is a byte comparison.

| held at | what | why |
| --- | --- | --- |
| **125** | `apps/web` tests | the website already ships this control (`apps/web/src/LocalData.tsx`) and **this change touches it not at all** — it ports the website's *decision*, it does not write a second control |
| **38** | `packages/ui` tests | **adding a token, a class hook or a stylesheet rule is a failure of this change** (`design.md` D5). The region is `<section>`, `<h2>`, `<p>` and `className="control"`, and **all four are already selected by rules that exist** |
| **86** | `packages/storage` tests | **`clearAll` and its falsification already exist** — `chrome.ts:218`, `chrome.test.ts:235` and `:257`. This change adds a caller, not a guarantee |
| **166** | `packages/mailbox` tests | the panel reads what the session already produced and the removal reads no session member at all |
| **53** | architecture boundary assertions | **no rule is added** — every property below already has an instrument, named in 7.1 |
| **byte-identical** | `apps/extension/static/manifest.json` | zero new permissions, zero new manifest keys. SHA-256 `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`, re-measured at proposal — the same hash `panel-verification-state` recorded |

**`mailbox-session`, `in-page-integration`, `visual-system` and `page-composition` carry no delta in
this change**, and that is a decision rather than an omission: the control is inside a surface three
promoted requirements already describe, and `design.md` D5 is why no visual-system clause moves.

---

## 1. What the region says — `apps/extension/src/panel-copy.ts`

- [ ] 1.1 Add **ten `PANEL_COPY` entries** for this control, each carrying the requirement sentence it
      serves beside it the way every existing entry does. The set is fixed here so a reviewer reads a
      list rather than diffing prose:

      | entry | shape | serves |
      | --- | --- | --- |
      | `removalHeading` | string | the region's `<h2>` |
      | `removalHoldsNothingYet` | string | the "nothing is kept on this device" shape |
      | `removalOffers` | string | the control that offers removal |
      | `removalConfirmWarning` | string | the irreversibility argument |
      | `removalConfirm` | string | the control that removes |
      | `removalKeep` | string | the control that backs out |
      | `removing` | string | while the removal is in flight |
      | `removalRefused(reason)` | **function of the platform's words** | a refusal |
      | `removalDone` | string | the removed shape |
      | `removalDoneMeans` | string | what removal is *not* |

      **Every one is `PANEL_COPY`, and the requirement's *"Every sentence the region shows SHALL be a
      `PANEL_COPY` entry"* is why.** **The file gains no new export** — `panel-copy.test.ts`'s
      *"exports nothing that could become a second table of what counts as a detection"* pins
      `Object.keys(panelCopy)` to exactly four names, so a new `PANEL_REMOVAL_KEYS` would fail an
      existing case and a new list is not what the requirement wants anyway.

- [ ] 1.2 **`removalDoneMeans` states what was removed and what was not, in one sentence.** It says the
      removal took **this device's note of** the mailbox, that a later visit will not offer that
      address back, and that **the address still works until the provider discards it**. **It SHALL NOT
      say the address is gone, deleted, closed, or no longer exists** — and `PANEL_COPY.mailboxGone`
      (`"That address no longer exists."`) already exists for a *measured* claim about a provider
      reporting `expired`, so reusing its wording here would import a claim about a provider into a
      sentence about a storage area.

- [ ] 1.3 **No entry names a host and no entry names a provider.** `resolve-for-host.ts` decides which
      mailbox a host means, and the host sentence three sections up already carries the host; a
      sentence in this region naming either would be the second spelling `design.md` D3 exists to
      prevent, and this region is read *beside* the host sentence.
      **No entry may carry the word *pending*, a percentage, a confidence value, or a claim that a
      message carries no verification** — not because this region is about messages but because
      `panel-copy.test.ts`'s forbidden-phrasing sweep already reads **every** `PANEL_COPY` entry
      (`everyPanelSentence`), so a new sentence that broke one of those four would turn an existing
      case red. **That is a property of the instrument and it is stated rather than rediscovered.**

- [ ] 1.4 **Do not add an entry to `PANEL_CHOOSER_KEYS`.** It is pinned to exactly three names by two
      existing cases (`"declares exactly the three entries the chooser renders"` and `"adds no chooser
      key"`), **and the removal control is not a chooser entry** — it chooses nothing, and the reader
      that sweeps those three keys resolves each against an address this region never has.

## 2. The region — `apps/extension/src/Panel.tsx`

- [ ] 2.1 Render a `<section aria-labelledby="panel-removal-heading">` holding the heading, the shape's
      own `<p>`, and — **in the stored shape only** — a `<button className="control">` offering
      removal. **In the confirmed shape the region holds the warning `<p>` and two `.control` buttons:
      the one that removes and the one that backs out** — copied from `LocalData.tsx:135`–`:172` for
      the shape and **not** from its wording, because every sentence here is `PANEL_COPY`'s (1.1).
      **No `className` beyond `control` is introduced** (`design.md` D5), and the region is preceded
      by a comment saying why, in `Panel.tsx`'s own idiom.

- [ ] 2.2 **The control that removes exists only in the confirmed shape, and the confirmed shape is
      reached by a press on the offering control.** So a removal cannot happen on the first press —
      which is the requirement's *"the control that performs the removal SHALL exist only after a
      further explicit step"* and is **the property a case must be able to catch a mutation of**, not a
      property the DOM happens to have. Give the region a `data-testid` for the confirmed shape and one
      for the removed shape, **named rather than derived from the copy**, for `Panel.tsx:783`–`:788`'s
      reason: a test that follows the wording rewords itself quietly.

- [ ] 2.3 **Three states, chosen by what is established — and the region is withheld entirely until the
      boot read has finished.** `LocalData.tsx:14`–`:35` is the model and its reasoning is the whole
      requirement's ninth scenario: *"a branch reachable on an unknown value is a branch that will
      eventually assert something unverified."* So: **boot not done → the region renders nothing at
      all**; boot done and `held.length > 0` → the offering shape; **the removal just happened → the
      removed shape, which is not the "nothing is kept" shape** — `LocalData.tsx:24`–`:29` says why
      and the distinction is the requirement's *"SHALL report that it holds nothing"* rather than a
      page that cannot tell whether the button worked.

- [ ] 2.4 **A refusal is reported and the promise is broken in neither direction.** On a rejection the
      region carries a `role="alert"` sentence holding `removalRefused(reason)` with **`reason` being
      the platform's own words**, and it says **neither that the data remains nor that it is gone** —
      `LocalData.tsx:47`–`:59` argues why the second half matters: `chrome.storage`'s `clearAll` has
      **no queued-removal semantics at all** (`chrome.ts:218` records there is no `deleteDatabase`), so
      here a rejection *is* the whole answer and a sentence in either direction would be inventing it.

- [ ] 2.5 **The mailbox is untouched by the removal.** Nothing in the removal path calls
      `session.destroy()`, `session.closeMessage()` or `session.close()`, and **no state that drives the
      inbox is reset.** Write that as a comment beside the removal callback, because the requirement's
      *"the mailbox SHALL remain on screen and its inbox SHALL remain usable"* is otherwise satisfied by
      accident and broken by a later change that tidies up.

## 3. The seam — `apps/extension/src/Panel.tsx`, `panel-main.tsx`, `storage.ts`

- [ ] 3.1 **Add exactly one member to `PanelRecords`, and it is `clearAll`.** Named by what it removes
      rather than by the records it covers, and reached through the **singular** contract while the area
      holds four kinds (`design.md` D4). `loadMailboxes` and `loadSiteMailboxId` stay reads and **the
      type gains no write member at all**, so the requirement's *"SHALL write no storage record of that
      mailbox again"* is discharged by the type having no outlet — the property `Panel.tsx:221`–`:223`
      already claims and this change must not weaken.

- [ ] 3.2 **`panel-main.tsx` passes it as `storage.records.stored.clearAll`**, bound as an arrow so it
      does not lose `this`, **and passes nothing else.** Do not widen `ExtensionRecords`
      (`storage.ts:68`–`:73`) and do not add a member there either: the four adapters and their
      documentation are correct today, and a fifth member would be a change `packages/storage` does not
      need and this change cannot justify.

- [ ] 3.3 **A whole-area reader and an arbitrary-key planter, in
      `apps/extension/e2e/helpers/stored-mailbox.ts`**, exported beside the existing `readRaw` /
      `writeAndConfirm` pair rather than written a second time in a spec. `readWholeArea` returns **every
      key** the platform lists, and `plantUnrecognisedRecord` writes a key this build has no code for —
      `"a-record-from-another-build"`, the name `chrome.test.ts:258` already uses, so the two tiers
      plant the same thing. **The planter reads the write back** for the reason
      `seedMailboxCollection:333`–`:337` gives: a write and a read back make the write a precondition
      rather than a hope.

- [ ] 3.4 **`readWholeArea` carries a positive control in its own case's use, not in itself.** A reader
      that answered `[]` for every device would satisfy 5.1's B3 for ever — **and a sweep matching
      nothing is the defect this repository records more often than any other** — so B3 asserts the
      planted record **is** listed *before* the removal and **is not** listed after it. **Both halves
      are asserted; one of them is the control.** This is the technique ported from
      `apps/web/e2e/storage.spec.ts:228`–`:256`, including its ordering rule: **plant after the
      mailbox is stored**, so a key-scoped removal would leave the planted key behind.

## 4. Unit cases

### 4.1 `apps/extension/src/Panel.test.tsx` — 44 → 53

- [ ] 4.1 **Nine cases**, one per region claim a DOM can settle, each named for the scenario it
      carries rather than for the widget:

      | # | case | settles |
      | --- | --- | --- |
      | 1 | offers a way to remove what this device holds | the offering shape, and **that the control which removes is not on the page** |
      | 2 | offers no removal and says nothing is kept on a device that holds nothing | the empty shape |
      | 3 | withholds the whole region until the boot read has finished — **and neither kept nor not-kept is said** | the ninth scenario, reached by holding `loadMailboxes` open |
      | 4 | removes nothing before the further step, **and the control that removes exists only in the confirmed shape** | the second scenario, asserted on both halves |
      | 5 | a confirmed removal reaches the contract's whole-area operation **and no other member** | `clearAll` called once; the two reads still reads |
      | 6 | reports holding nothing afterwards and offers no further removal | the fourth scenario |
      | 7 | keeps the mailbox on screen and usable, and writes it back nowhere | the sixth scenario, including `records.clearAll` not being called again |
      | 8 | states that this device's note was removed and that the address still works | the fifth scenario, and that no sentence claims gone |
      | 9 | reports a refused removal as one, and in neither direction about the data | the seventh scenario, **driven by a rejecting `clearAll`** |

      **Case 5 is the one that cannot be satisfied by a DOM.** Four keys checked after the fact would
      pass against a removal that deleted them by hand; **asserting the operation is what the
      requirement says** — and the reason is `chrome.test.ts:251`–`:254`'s, which is that an empty area
      is what both a whole-area clear and a delete-every-known-key produce. **Case 9 is the only one
      that reaches the refusal, and it is unit-only on purpose** — see 5.1.

- [ ] 4.2 **Case 3's precondition is established, not timed.** Hold the boot read open with a deferred
      the test resolves itself, **then assert the region's absence while it is held**, rather than
      reading the page immediately after mount — which is the weak-precondition defect this repository
      has recorded three times, every time authored and caught by the change that found it.

- [ ] 4.3 **`Popup.test.tsx` stays 25 and no case in it is edited.** The region is a panel concern and
      the popup renders none of it. A movement there would mean the popup grew a removal control, which
      is the fake-UI defect `page-composition` forbids.

### 4.2 `apps/extension/src/panel-copy.test.ts` — 12 → 17

- [ ] 4.4 **Five cases, all about the sentences:**

      | # | case | settles |
      | --- | --- | --- |
      | 1 | every one of the ten new entries resolves to real words, and the function-valued one is called with a reason | **a renamed entry leaves every sweep reading nothing** |
      | 2 | the ten entries are spelled out **literally** here and are each present in `PANEL_COPY_KEYS`, and the other direction too | a typo exempting an entry that is not there |
      | 3 | **no entry claims the address is gone**, read over **every** `PANEL_COPY` sentence and not only the new ten — with **one negative control planted into a new entry and one into an existing one** | *"the mailbox is gone"* reworded into a removal sentence |
      | 4 | the removed shape and the empty shape say **different sentences**, and the removed shape's carries the mailbox's address nowhere | the two being collapsed, `LocalData.tsx:24`–`:29`'s defect |
      | 5 | the panel's own forbidden-phrasing sweep covers the new entries — **the existing case does this already**, so this is a case asserting the *enumeration grew*, not a new sweep | a second sweep where one exists |

- [ ] 4.5 **Case 3's pattern is named, not a bare alternation, and its control is the sentence it
      forbids** — `panel-copy.test.ts`'s own `FORBIDDEN` shape, and the same reason: a sweep reporting
      *which* forbidden claim and *where* is one a reader can act on. **Do not exempt any new entry by
      hand**, because a hand exemption with no rule behind it is the defect `panel-copy.ts`'s own note
      about the *No verification link* wording records.

## 5. Browser cases

### 5.1 `apps/extension/e2e/side-panel.spec.ts` — 20 → 28

- [ ] 5.2 **Eight cases, one per browser-observable scenario.** Each reuses `stage()` and the file's
      existing readers; **no second copy of the staging order** — `in-page-fill.spec.ts`'s
      `open-mailbox.ts` exists for exactly that, and a selector duplicated is no better than a helper.

      | # | case | observable |
      | --- | --- | --- |
      | B1 | offers a way to remove what this device holds, **and the control that removes is not on the page** | the DOM, both halves |
      | B2 | removes nothing until the further step is taken — **read from the platform's own area, not from the DOM** | `readWholeArea` before and after the first press |
      | B3 | a confirmed removal empties the area **including a record this build does not recognise** | `readWholeArea` empty, **and the planted key listed before it** (3.4's control) |
      | B4 | reports holding nothing afterwards and offers no further removal | the DOM |
      | B5 | keeps the mailbox on screen and its inbox rendering after the removal | the DOM |
      | B6 | states what was removed and that the address still works — **and its reader carries a positive and a negative control** | the DOM, read by a scoped reader |
      | B7 | costs **no provider request** and reaches no origin the tier did not script | `traffic`, the file's existing idiom |
      | B8 | offers no removal and says nothing is kept on a device that holds nothing | the DOM, from a plain `stage()` — the device is empty because `afterEach` clears it |

- [ ] 5.3 **B2 is the one written against a recorded precondition defect, and it is the case the
      change most needs.** Reading the DOM for "nothing was removed" is satisfied by a panel that never
      removed anything on either press, so B2 asks **the platform** and asserts it twice — once after
      the offering press, once after the confirming press. **The second assertion is the control for
      the first**: a reader answering "empty" for every device would pass the first and fail the second.
      This is `site-associations`' *"a poll that starts satisfied passes immediately on a controller
      that never wrote anything"*, in a browser tier.

- [ ] 5.4 **B6's reader is scoped to the removed region's own `data-testid`** rather than a page-wide
      text search, **because the address is on the page three sections up** — the same defect
      `showingLine`'s note records, where a `getByText` on an address resolved to three elements and a
      `toHaveCount(1)` failed on a panel that was entirely correct. Its two controls: **a planted
      sentence claiming the address is gone must be reported**, and **the reader must return the shipped
      sentence unmodified** — so a reader that returned every paragraph cannot pass B6 for the wrong
      reason.

- [ ] 5.5 **Two scenarios are unit-only, and the reasons are recorded rather than left to look like
      coverage.** *Removal is refused*: **the browser tier has no way to make a real
      `chrome.storage.local` reject a clear**, so a case for it would have to lie about the platform —
      which is the recorded shape of *"a case would have to lie about the sender"* that
      `in-page-integration` records as deliberate non-coverage. *What the panel knows is not yet
      established*: the boot read is a real asynchronous read of a real area and **there is no window
      in which to catch it**, so a case for it would be a case about a race. **Both are carried by
      4.1's cases 3 and 9**, and the count 20 → 28 is **seven scenarios plus B7 and B3's control half**,
      which is the arithmetic stated rather than rounded to eight scenarios.

- [ ] 5.6 **`manifest.spec.ts` stays 12 and no case in it is edited.** The manifest is byte-identical
      (table above), and `manifest.spec.ts:246` hard-codes the four permissions. A movement there would
      mean this change added a permission, which is the thing the requirement forbids.

## 6. Falsification

- [ ] 6.1 **Every deliberate violation is caught by the assertion aimed at it.** Run the table below
      through a harness and report `caught` / `wrongcatch` / `green` / `noop` / `nocompile` /
      `harness-error` — **all five counters besides `caught` must be zero.** `wrongcatch` is a failure
      named by another assertion: one naming **an assertion about the same property** is an attribution
      to fix, and one naming **an unrelated assertion** is the real defect. `nocompile` counts as its
      own outcome, because a mutation that cannot compile is not evidence about an assertion.

      | arm | mutation | aimed at |
      | --- | --- | --- |
      | V01 | the region renders the confirming control before the further step | 4.1 #4, B1 |
      | V02 | the confirming control's press handler removed | 4.1 #4, B2 |
      | V03 | removal implemented as four `remove()` calls rather than `clearAll` | **B3**, and 4.1 #5 |
      | V04 | the panel names `chrome.storage.local` directly | **the boundary rule**, not a case — and that is the point (7.1) |
      | V05 | `removalDoneMeans` reworded to claim the address is gone | 4.2 #3, B6 |
      | V06 | the removed shape replaced by the "nothing is kept" shape | 4.1 #6, B4 |
      | V07 | the removal path also tears the mailbox down | 4.1 #7, B5 |
      | V08 | a rejection rendered through `removalDone` | 4.1 #9 |
      | V09 | the region rendered before the boot read has finished | 4.1 #3 |
      | V10 | the offering control rendered on a device holding nothing | 4.1 #2, B8 |
      | V11 | **a stylesheet rule or a class hook added for the region** | **the boundary rule and the `packages/ui` count, not a case** |

- [ ] 6.2 **V04 and V11 are counted as caught by a *rule*, not by a case, and that is the reported
      finding rather than a caveat on it.** Both are the properties `tasks.md` 7.1 says already have an
      instrument. **A rule that reports is a catch**, and a falsification record that files them as
      survivors because no unit case named them would be reporting coverage this change does not have.

- [ ] 6.3 **One arm is recorded as evidence and not counted: "the sentences live in `PANEL_COPY`
      rather than inline in `Panel.tsx`."** No mutation can prove where a string literal lives, and the
      arm that moves a sentence inline **compiles and renders identically** — so a green run would be
      *correct*, not a survivor. **The same treatment a branch no assertion can reach gets**, because
      reporting twelve of twelve would mean something weaker than it appeared to. The property is
      carried by review plus the pinned export list (1.1), and that is what it is.

- [ ] 6.4 **Restore every mutated file and prove it.** SHA-256 per mutated file against a digest taken
      before the mutation, **and rebuild `dist/` from the restored source** — `in-page-fill` recorded a
      restored `fill.ts` beside a `dist/` still holding the last mutation, read afterwards as evidence
      about a mutation two minutes gone. **The instrument lives outside the repository and is deleted
      when the run finishes**: `extension-preview`'s pass failed `pnpm lint` on four temporary scripts
      in the root, and a measuring instrument left in the root is something every future `pnpm lint`
  has an opinion about.

## 7. Boundaries

- [ ] 7.1 **No boundary rule is added, and the count stays at 53.** Every property this change
      introduces already has an instrument, and here they are **by name** — a property without a named
      instrument is a property nobody has checked:

      | property | the instrument that already holds it |
      | --- | --- |
      | the panel names no platform store, and reaches removal through the contract | *"keeps storage, cookies, and the URL out of every client"* — reports by name, its only exemption being the browser tier's own `testDir` read out of each suite's config |
      | `Panel.tsx` names no platform global at all | *"keeps the extension platform global to one module"* — `Panel.tsx` reads `chrome` only through `extension-platform.ts`, before and after this change |
      | the extension writes no mailbox record from anywhere in `src/` | *"stops the extension writing the record it only reads"* — **and, stronger than the rule, `PanelRecords` has no write member** (3.1) |
      | no class hook is rendered that no rule selects | *"uses every class hook a client renders"* — the rule that reported two unstyled hooks during `in-page-fill` |
      | no stylesheet literal, no removed focus indicator, every `var(--…)` resolves | *"keeps a remote origin and a removed focus indicator out of a shipped stylesheet"* and its unresolved-token scan |
      | every new panel sentence is held to the no-percentage / no-confidence / no-*pending* / no-"carries no verification" rule | `panel-copy.test.ts`'s *"carries no forbidden phrasing…"*, which reads **every** `PANEL_COPY` entry rather than a declared subset |
      | the copy module has not grown a second decision table | `panel-copy.test.ts`'s *"exports nothing that could become a second table"*, pinning `Object.keys(panelCopy)` to four names |
      | the new browser spec is collected, and by nothing else | *"collects every browser spec, and never as a unit test"* |
      | the new unit cases are collected rather than silently skipped | *"collects every test this repository ships"* |
      | the region escapes no markup | *"keeps a markup escape hatch out of every client"* |
      | the panel reaches no provider of its own, and restates no shared value | *"stops a client restating a value a shared package already owns"* and the provider-id-list rule — B7 is the behavioural half |

      **53 staying at 53 while the tree gains a control is the measurement this group exists to
      report.** A rule added where an instrument already exists is not coverage — it is a second thing
      to keep in step, and `incoming-mail-notification` reached the same result for the same reason.

## 8. Gates, repeated runs, and the counts

- [ ] 8.1 **`pnpm verify` exits 0, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory.** Three is the number this repository runs at an apply stage and the reason is
      recorded: the gate that catches a file edited since Prettier last ran is `format:check`, and it
      does not catch it on the first run.

- [ ] 8.2 **`pnpm test:browser` runs ten consecutive times in one block, and the tally is reported
      with the denominator: `passed=N failed=0 harness-error=0` out of **10**, at `website=40` and
      `extension=97` on every run that produced a measurement.** A run printing **no tier summary is
      reported as `HARNESS-ERROR` rather than as `passed`** and the block exits non-zero on that count —
      `pnpm test:browser` is `build && build:fixture && web tier && extension tier`, so a run with no
      tier summary never reached Playwright and counting it would be counting a run that did not run.

- [ ] 8.3 **If the block is stopped because a source file changed, the block is stopped and not
      resumed.** `in-page-fill` recorded two discarded blocks for exactly this: a discarded series kept
      running against a tree being edited underneath it, and its output had to be thrown away rather
      than reconciled. **A measurement taken while the tree is moving is not a measurement.**

- [ ] 8.4 **The predicted deltas, to be re-measured from `--reporter=json` grouped by project and not
      read off a summary line:**

      | tier | from | to | how |
      | --- | --- | --- | --- |
      | `apps/extension` unit | **451** | **465** | 4.1's nine + 4.2's five = **+14**; `Panel.test.tsx` 44 → 53 and `panel-copy.test.ts` 12 → 17, and every other extension file unmoved |
      | extension browser tier | **89** | **97** | 5.1's eight cases, all in `side-panel.spec.ts` (20 → 28); the other nine spec files unmoved |
      | `apps/web` | **125** | **125** | no file under `apps/web` is touched |
      | `packages/ui` | **38** | **38** | **a movement is this change's failure** (D5) |
      | `packages/storage` | **86** | **86** | no file under `packages/storage` is touched, and `git diff --stat` over that package must be empty |
      | `packages/mailbox` | **166** | **166** | the removal reads no session member |
      | boundary assertions | **53** | **53** | 7.1 |
      | `manifest.json` | — | **byte-identical** | SHA-256 as in the table at the top |

- [ ] 8.5 **The promoted counts, predicted and to be re-measured at sync rather than carried forward:
      167 → 168 requirements and 534 → 544 scenarios** across the same 14 capabilities. The
      requirement arithmetic is `+1`; **the block count is three**, because two `MODIFIED` blocks each
      *replace* rather than add — the usual shape here, and stated so a reader expecting three new
      requirements is wrong about the total. The scenario arithmetic is `+9` in `extension-client`,
      `+1` in the first `spectre-storage` block, and `+0` in the second. **Counted by heading
      (`### Requirement:` / `#### Scenario:`) across `openspec/specs/` after the promotion, never
      transcribed** — and re-counted after the archive, because archiving is a move and a move is the
      operation most likely to quietly drop a file.

## 9. What this change deliberately does not do

- [ ] 9.1 **The armed background alarm survives a removal, and this change does not clear it.**
      `design.md` D7 states what it costs (a wake, not a provider request — an emptied area answers
      `no-mailbox` before anything is requested), what it retains (**a name and a period, not an
      address, so it is not a privacy exposure and must not be counted as one**), and what is
      unmeasured. **The panel therefore reaches no alarm platform**, and `extension-client`'s alarm
      requirement is **not** amended to permit it. **This is a finding for the M12 review**, recorded
      so it is not discovered by a person after pressing the button.

- [ ] 9.2 **The `sidePanel` permission finding is not settled here** (`design.md` D8). No shipped module
      names `sidePanel`, the manifest declares both it and `side_panel.default_path`, and
      `docs/PROVIDERS.md` §4.6 measured the permission on a control differing in **both** — so
      separating them needs an instrument this repository does not have. **The manifest is unchanged
      and `manifest.spec.ts:246` is unchanged**, so the requirement's *"it SHALL request no permission
      that no shipped surface uses"* currently has an entry traceable to no shipped code. **Recorded,
      not resolved, and not a slice.**

- [ ] 9.3 **The "what SpectreMail does not collect" privacy document is a separate slice** — M12 item
      three, a document rather than a control. Writing it before the extension can act on its own data
      would publish a claim about a gap this change is closing.

- [ ] 9.4 **Nothing about a rendered pixel is measured, and nothing about reaching the panel is.**
      `Panel.test.tsx` reads a DOM and the browser cases read a served area through the platform's own
      API. **No test in this repository reads a rendered pixel's colour or position**, and the region
      is deliberately styled by rules that already existed (`design.md` D5) — so whether it *looks*
      right is a human judgement no gate stands in for. **With `openPanelOnActionClick` unset the panel
      is reachable only through Chromium's own side-panel entry point**, `docs/PROVIDERS.md` §4.6
      records that Playwright adds **no `Page` for a docked panel at all**, and the cases open the
      panel document **as a tab** — **a substitute, and one that cannot answer "which page am I
      beside."** Both are recorded there and unchanged by this change.
