# Tasks

## 1. Record kinds and their narrowing

- [x] 1.1 Add the mailbox-collection and site-association record shapes to
  `packages/storage/src/record.ts` — `SPECTRE_COLLECTION_VERSION`, a collection whose members are
  existing `StoredMailboxRecord` values, and an association map — with one narrowing function each,
  reusing `readStoredMailboxRecord` for every member. Verify: a unit test shows a collection whose
  second member cannot be narrowed still returns its first and leaves both in storage.

  **Two amendments, both recorded in `design.md` as D9, and both found by the mutation list rather
  than by a failing test.** `record.ts` gained `prependStoredMailbox(record, mailbox)` because the
  first `addMailbox` rebuilt the collection from the **narrowed** list and so deleted a member it
  could not read — the exact loss `readStoredMailboxRecord`'s contract exists to prevent.
  `StoredMailboxCollection.mailboxes` is therefore typed `readonly unknown[]`, because a spec that
  cannot narrow a member must still be able to hand it back. `readStoredSiteAssociations` validates
  **no key shape at all**, and the tests plant IPv6 literals, punycode labels and IDN-like keys and
  require every one of them back: **the platform's spelling of a host is the key, and a reader that
  rejected a spelling would stop answering for a host Chromium is on right now.**
- [x] 1.2 Add `packages/storage/src/mailboxes.test.ts` and
  `packages/storage/src/site-associations.test.ts` covering newest-first order, the current entry
  being the head, an empty device reporting an empty collection rather than a failure, a read
  failure being reported as a failure, a repeated mailbox appearing once as the newest, an exact-host
  key, two hosts sharing a parent domain staying separate, and an un-narrowable entry being neither
  returned nor deleted. Verify: `pnpm test` is green and each requirement scenario in the delta has
  at least one case that names it.

## 2. Contracts and the chrome adapter

- [x] 2.1 Add `SpectreMailboxes` and `SpectreSiteAssociations` beside `contract.ts`, exporting them
  from the package index, with no IndexedDB adapter for either. Verify: `apps/web`'s IndexedDB
  adapter has gained no member, and `pnpm typecheck` is green.

  **One thing this task did not anticipate: the package also gained an export subpath.** The
  falsification harness's boundary controls need to plant violations in a *copy* of the extension's
  tree and read them back with the product's own reader, and reaching that reader through the
  package index would have made the control depend on the module it is planting a defect into. So
  `./testing` resolves to `src/testing/chrome-area.ts` and is imported as
  `@spectre-mail/storage/testing` — **a shipped subpath rather than a test-only path alias**, and the
  reason is that the harness is not the only thing that must read a record without going through a
  writer.
- [x] 2.2 Add the `chrome.storage` adapter for both contracts beside `chrome.ts`, and a case proving
  a record written through one contract is gone after `clearAll` reached through `SpectreStorage` —
  the cross-contract removal scenario the single-record build could not write. Verify: that case
  fails when `clearAll` is narrowed to the one key it recognises.
- [x] 2.3 Add the boundary assertion that no module outside `packages/storage/src/chrome-platform.ts`
  names the extension's platform global, and that the extension's create path writes no singular
  mailbox key, each with a control that fires when its own form is violated. Verify: both controls
  go red under their mutations.

  **The platform-global half already existed** — slice 1 wrote it, and it is what forced
  `chrome-platform.ts` to be renamed. What is **new** here is `extensionSingularWriteViolations`: no
  module in `apps/extension/src` may name `saveMailbox`, with comments stripped and test files
  exempt. Its control plants the forbidden identifier in a **disposable copy of the tree**, because a
  control that edits the shipped source to test the rule is a control that has to be edited back.
  Boundaries went **56 → 57**.

## 3. The extension reads and writes the collection

- [x] 3.1 Extend `apps/extension/src/storage.ts` with the two areas and export the two new contracts
  alongside the existing one. Verify: the module's own tests stay green and `pnpm typecheck` passes.

  **One area, three reads.** `ExtensionRecords { stored, mailboxes, associations }` rather than
  three independent seams, and the boot read is a single `Promise.all`. The alternative — handing the
  controller three separate readers — would have let it read one record after the page had already
  decided on another, and this slice's whole subject is a decision made from three records at once.
- [x] 3.2 Move the extension's create path onto `addMailbox`, so a mailbox this device was handed is
  recorded by exactly one operation, and read "your address" as the collection's head. Verify: the
  existing creation tests pass with their expectations changed to the collection, and a case shows
  two creations produce two entries rather than one.

  **"Your address" is `loadMailboxes()[0]`, and there is no separate current-mailbox record** — the
  collection's order *is* the current-ness. A second record saying which one is current would have
  been a third thing to keep consistent with two, on a device with no transaction.
- [x] 3.3 Prove `service-worker.test.ts` and `protocol.ts` are untouched by this slice: no new message
  type, no new worker case, both counts unchanged from the baseline. Verify: the counts are read from
  the test run rather than asserted from memory.

  **`service-worker.test.ts` is 5, unchanged, and `protocol.ts` gained no message *type* — but it did
  gain a field**, `mailboxId` on the `created` variant of `CreateMailboxAnswer`, validated in
  `readCreateMailboxAnswer`. Without it the content script could record an association for a mailbox
  it had just created but could not name, and the next visit on that host would fall back to the
  newest. That amendment is recorded on the delta's requirement and in `design.md`.

## 4. The in-page control prefers this site's mailbox

- [x] 4.1 Add `affordanceInsertLabel(address)` beside `AFFORDANCE_LABEL` in
  `apps/extension/src/content-script/affordance.ts`, keeping the creation wording distinguishable
  from the insertion wording, and change no other surface in the shadow root. Verify: a case reads
  the control's accessible name and requires it to contain the address it will insert.

  **`affordanceInsertLabel(address)` is `${AFFORDANCE_LABEL}: ${address}`, and `AFFORDANCE_LABEL`
  stays exported** as the prefix rather than being replaced. Three spec files, the in-page helper and
  the popup's own copy all spell the control's name, and a constant only the function reads is a
  constant the specs cannot use to tell an insertion from a creation.
- [x] 4.2 Teach `controller.ts` to read the collection and the association on focus, prefer the
  association's mailbox when this device still holds it, and fall back to the collection's head.
  Verify: controller cases cover a host with an association, a host without one, a host whose
  recorded mailbox is gone, and a record that cannot be read.

  **The host is read once, at boot, and the decision is derived on focus.** `resolveForThisHost()`
  takes the host as a value rather than reading `location` itself, so a case can ask the question
  directly — and **the one case that reads a page's own host and no other** is the catcher for three
  of the mutation list's key-shape entries.

  **`settledBoot()` replaced 119 `await Promise.resolve()` sites across the two controller test
  files**, and drains **four** turns rather than one: the creation offer settles on turns 0–2 and the
  insertion offer from turn 3. A helper whose turn count is a guess would be the recorded
  `precondition` defect wearing a different hat, so the durable half is **a control case** in
  `content-script-associations.test.ts` — one that waits far longer and requires the same answer.

  **One case was added after the falsification run, because the delta asked for something the code
  did not do.** The scenario *"The association cannot be read at all"* was in the delta before a line
  of it was written, and both reads shared one `Promise.all` — so a failed lookup took down the whole
  boot read and offered **nothing**, where the requirement says the newest. **The requirement was
  right**: the collection read decides whether this device holds anything, and the lookup decides
  only which of them this host was last used with. So the lookup's rejection is now absorbed at the
  call, and `resolveForThisHost` carries the only `.catch` in the file that is not remembered as a
  failure. `fakeRecords` gained `loadSiteRejects`, because the existing `loadRejects` fails both
  reads and a case written against it would have passed against the defect as well as against the
  fix. Two mutations hold it down — the catch removed, and the catch widened to the collection read
  — and the second is caught by the two cases carrying the blocked-read arm, so the repair does not
  delete the rule it sits beside. `design.md` records why twenty-one mutations and three browser
  blocks had all passed against a tree carrying this.
- [x] 4.3 Write the association after a successful insertion and nowhere else, keyed on
  `location.hostname`. Verify: a case shows an insertion records the association and that merely
  offering the control records nothing, and a case shows two hostnames sharing a parent domain
  resolving separately.

  **Four rules that had to be decided rather than inherited.** The write happens **only after a real
  insertion** — a failed write is *not* reported to the page, because a page told "remembered" about
  something that was not is worse than a page told nothing. A document with no host (`""`) reads and
  writes no association, so a `file://` or `about:blank` document cannot poison the map with an
  empty key. A **stale** association — one naming a mailbox this device no longer holds — is
  **ignored and left in place**, replaced only by an insertion with a different mailbox: deleting it
  would mean this product discarded a note it could still be wrong about. And **no PSL folding**: the
  key is the exact `location.hostname`, so `a.example.com` and `b.example.com` stay apart.

  **The recorded limit, and it is a decision rather than an omission**: on a host that already has
  an association, a *different existing* mailbox cannot be chosen for it. There is no menu, and a
  control over one reachable option cannot act — so the three-way choice this feature could have had
  is delivered as *which* mailbox a host resolves to.
- [x] 4.4 Add cases for the two rules that stay: no affordance over a field holding text, and the
  form is never activated by an insertion. Verify: both are cases the existing tier already carries
  for the previous version of this behaviour and are re-run against the new preference.

  **Both are re-runs, and that is the finding rather than an absence.** The field-holding-text case
  was already there and now runs against a controller that resolves its address from three records
  instead of one — **a rule that survives a change to the thing it guards is exactly the property
  worth asserting, and the existing case asserts it without being edited to.**

## 5. Browser tier

- [x] 5.1 Add `apps/extension/e2e/in-page-associations.spec.ts` over the fixture page: insert on a host
  with no association, return to it and require the same address; insert on a second host and require
  each host to resolve to the mailbox it was used with; require the control's accessible name to
  carry the address; require the insertion to be gone from `chrome.storage.local` while both new
  records are present. Verify: the suite is collected by the extension's Playwright config and by
  nothing else — the boundary rule requires that and fails by name.

  **The file is named `in-page-associations.spec.ts`, not `site-association.spec.ts` as this task
  first wrote it, and the plural is the point**: the same-host-means-one-mailbox reading, the
  cross-host separation, the singular record this slice has to keep reading, and the two limits are
  one subject — *which mailbox this page is offered* — and naming the file for the write alone would
  have implied the other ten cases were about something else.

  **Ten cases, and the requirement's own claims are split across three existing files rather than
  duplicated here.** "The insertion is gone from `chrome.storage.local` while both new records are
  present" is a case in `in-page-create.spec.ts`, and "a second creation is a second mailbox" is
  there too; both were edited rather than copied, because a case that exists in two files is two
  cases that can disagree. `popup.spec.ts` carries the persistence half from the popup's own side.
- [x] 5.2 Add the two limit cases: a same-origin iframe's email field is **not** reached with
  `all_frames` unset, established with a control that proves the frame loaded and is inspectable
  before its absence is read; and the page world has no `chrome`, so the absence of a DOM `storage`
  event is evidence about the DOM event rather than about a missing subscription. Verify: each
  control fails when its mechanism is removed.

  **The second half of this task was wrong as written, and the platform corrected it during apply.**
  It asked for "the page world has no `chrome`", and **Chromium hands an ordinary web page a
  `chrome` object** carrying the long-deprecated `loadTimes`, `csi` and `app` properties — measured,
  not assumed. **A global's presence is not its content.** The case now requires the page to reach
  none of the three namespaces this product actually uses — `storage`, `runtime` and `alarms` — which
  is the claim the isolation property really makes. The amendment is recorded in `design.md`'s
  falsification section rather than here, because it is a finding about the platform and this file is
  a list of work.

  **The first half gained a second control the task did not ask for, and the task's own control was
  not enough on its own.** "The frame is loaded and inspectable" is proved by planting the
  affordance's hook inside the frame and seeing it counted; the top frame of the same page is then
  required to *get* an affordance, because a case asserting an absence inside a frame passes
  perfectly well on a build whose content script has stopped running altogether.

## 6. Falsification and full-suite record

- [x] 6.1 Run the falsification harness **from outside the repository** against every new assertion:
  each must be shown able to fail, the conforming case must still pass, restoration must be verified
  by SHA-256 per file, and the built `dist` must be rebuilt from the restored source. Verify: the
  table lands in this change's `design.md` under `## Falsification`, with `nocompile`, `noop`,
  `wrongcatch` and `harness-error` reported as their own outcomes rather than as survivors.

  **Twenty-one entries, 21 of 21 caught by the intended assertion**, `wrongcatch` / `green` /
  `nocompile` / `noop` / `harness-error` all zero, restoration verified 21/21, final rebuild `ok`.
  Sixteen unit and five browser. The table found **three** things reading the code would not: a
  browser case that could not fail because it seeded what it asserted, a unit file with no case for
  the write at all, and a limit case reading the wrong document's listener — all three recorded in
  `design.md` under the findings.

  **A fourth falsification ran against the sync tooling rather than the product, and it is NOT
  counted in the twenty-one above** — different instrument, different stage, and folding it in would
  make one number mean two things. Preparing the sync stage found that `promote.mjs` would write the
  delta-only `## ADDED Requirements` heading **into** a promoted requirement block, because a block
  was closed at the next requirement heading but never at a section heading; promoting on a
  throwaway copy produced one at `spectre-storage` line 518 and another at `in-page-integration`
  line 165. **The second script caught it and the first could not**, which is the finding: the
  promoter and the verifier share no reader and neither imports the other, so the broken one had no
  way to mark its own homework. After the fix, **8 of 8 blocks byte-identical**, no delta-only marker
  anywhere under `openspec/specs/`, and four controls held it — reinstating the broken reader
  restored the corruption in both capabilities, mutating one clause of one promoted block made
  `verify` exit `1`, restoring it made `verify` exit `0`, and promoting twice was refused rather than
  silently doubling a block. **The real `openspec/specs/` was confirmed untouched before and after
  every one of those runs.** Recorded in `design.md`.
- [x] 6.2 Run `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and
  `pnpm test:browser` in **three blocks of ten consecutive runs**, recording failures rather than
  passes. Verify: every block's tally is written down.

  **`pnpm verify` was run three times with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory,
  and all three exited `0` at 891 tests across 51 files.**

  **The browser tier was run in three blocks of ten: 30 runs, 30 passed, 0 failed, 37 website and 56
  extension cases on every run** - and then block 1 was run a **fourth** time, so **40 completed runs
  in total, all green**. The fourth exists because the tree moved while the third was going.

  **And two blocks were abandoned, and how many runs that cost is a measurement an earlier draft of
  this note got wrong.** It claimed six discarded runs; the captured output of the two killed blocks
  shows **two and zero**. One was stopped after **2** completed green runs, when reading the delta
  against the code found the unreadable-lookup divergence; the other was stopped after **0**
  completed runs, before its first finished, when the README's limit list and a stranded
  documentation block still needed changing. **Two discarded runs, not six** - and the number that
  was written down before the output was re-read is the reason it is recorded at all.

  **Why a fourth block ran at all.** Between the third block and the fourth, three **documentation**
  files changed and nothing else: `AGENTS.md`, `design.md`, `tasks.md`. That is a fingerprint
  comparison over every tracked and untracked source file rather than an assurance, and it names
  exactly those three paths while reporting no source, test or configuration file changed. It is
  still worth establishing that the block could not have been affected by them, and it was: **no
  Vitest file and no browser spec reads `openspec/` or `AGENTS.md`** - every match in the tree is a
  prose reference inside a comment - and neither build lists `AGENTS.md` as an input. **So 10 of the
  40 runs are on the exact tree being committed and 30 are on a tree differing from it in three
  documentation files**, which is stated rather than rounded to "all 40".

  **The instrument itself was wrong first, and it is recorded because a tally and an exit code
  disagreed.** The block script printed its tally and fell off the end, so a **completed** block came
  back `exit 1` with no explanation — and so did an **aborted** one. Two different outcomes, one
  number. It now prints each run's `status` and `error` beside its cases and **exits on the tally it
  reported**, so an exit code that disagrees with the tally is a fact about the tally rather than a
  thing to be interpreted. **Block 1 was then re-run under the corrected instrument rather than
  credited from the run whose exit code nobody could read**, which is why every block is
  measured the same way rather than two of them one way and one another.
- [x] 6.3 Record the measured test counts grouped by project from a `--reporter=json` run, and
  confirm `packages/ui` is still 38 and the architecture boundary count moved by exactly the
  assertions added here. Verify: the baseline is measured in a `git worktree` at the merge base
  rather than transcribed from a previous stage.

  **The baseline was measured in a `git worktree` at `7755131`, installed offline and run with the
  same reporter**, and it is **845 tests across 47 files** — `apps/extension` 130, `apps/web` 120,
  `packages/core` 54, `packages/mail-parser` 149, `packages/mailbox` 155, `packages/providers` 89,
  `packages/storage` 54, `packages/ui` 38, boundaries 56. This change is now **891 across 51**:
**`packages/storage` 54 → 78**, **`apps/extension` 130 → 151**, boundaries **56 → 57**, and nothing
else moved. `apps/extension`'s twenty-one are `content-script` 25, `protocol` 28,
`extension-platform` 21, `content-script-create` 17, `create-mailbox` 11, `storage` 9,
`provider-config` 9, `Popup` 8, **`content-script-associations` 9**, `popup-copy` 5,
`service-worker` 5, `scheduler` 4 — **and the ninth of those is the case added under 4.2 after the
falsification run**, which is why the figure is 151 rather than the 150 measured before it.

  | project | baseline | now | moved by |
  | --- | --- | --- | --- |
  | `packages/storage` | 54 | **78** | +24, two new files |
  | `apps/extension` | 130 | **151** | +21, two new files |
  | architecture boundaries | 56 | **57** | +1 (`extensionSingularWriteViolations`) |
  | `apps/web` | 120 | **120** | **unchanged, and required** |
  | `packages/ui` | 38 | **38** | **unchanged, and required** |
  | everything else | — | — | unchanged |

  **The two unmoved numbers are the measurement this slice's plan turned on.** `packages/ui` at 38
  for the sixth time means no new token and no new motion, and `apps/web` at 120 means this slice
  added a capability to the extension without reaching into the website — which is also why
  `apps/web`'s IndexedDB adapter gained no member, as 2.1 required.

## 7. Documentation

- [x] 7.1 Bring `AGENTS.md` current: the milestone block, the framework and testing paragraphs, the
  browser-tier entry, and the new limits — including that this slice needs no worker delegation and
  why. Verify: every count in the file comes from the run recorded in 6.3.

  **The testing paragraph carries the per-file split from the JSON run, the two required unmoved
  numbers (`apps/web` 120, `packages/ui` 38) with what each one proves, and the ninth
  `content-script-associations` case with the reason the count moved after the falsification run.**
  The browser-tier entry carries **93 cases in 11 files** and the 37/56 split, **the three aborted
  runs and why they are not in the thirty**, and the instrument defect that made a completed block
  and an aborted one report the same exit code. Both divergences and the falsified merge rationale
  are recorded, and **the correction to `AGENTS.md`'s own falsified claim is in place rather than
  left for a reader to find**: the earlier draft said three blocks of browser runs had passed
  against the tree carrying the divergence, and no block had completed.
- [x] 7.2 Bring `README.md` and `docs/ROADMAP.md` current, including the M9 slice 3 entry and the
  totals, and record the popup's one-mailbox limit. Verify: no count is transcribed.

  **The roadmap's slice-3 entry was carrying the merge rationale this change's own boundary rule
  falsified — "merging would let the older record shadow the collection's order" — and it is
  corrected in place** rather than left standing in three places while the source note was fixed.
  `ROADMAP.md`'s totals block was checked and **left alone on purpose**: its `+5 / +30` belongs to
  **M8's `extension-foundation`**, not to this change, and correcting it would have been editing
  another milestone's recorded history because a grep matched its heading.
- [x] 7.3 Leave a `## Deliberately unticked` section in this file naming the one task this change
  owes a human: opening a real page with the extension loaded and looking at the control. Verify: the
  section exists and the task is unticked.

## Deliberately unticked

**Looking at the control inside a real third party's page, with the extension loaded.** Every case
in this change reads a DOM, a resolved computed style, a `chrome.storage` record read through the
platform's own API, or a count of affordances in a frame. **None of those is a rendered pixel, and
the fixture page is hostile by construction** - it links `button { display: none !important }` so
that "the page's styles do not reach the control" is not satisfied for free. That proves the shadow
root **isolates**. It says nothing about whether the control reads as right, legible, or un-ugly in a
page nobody here designed, and no number in this change is evidence about that.

**It is left unticked because an agent opening a page is not the judgement the task asks for** - the
same reason slice 1 and slice 2 left their equivalent unticked. Ticking it here would turn the
third milestone whose headline claim is *which mailbox this site gets* into a change whose only
unverified surface is stated as verified.

## Not covered, and recorded rather than left to look like coverage

- **No unit case exercises a tier's blindness**, and that is a measurement rather than an absence.
  Two entries were declared as such and **both were falsified by their own runs**: the unit tier
  *does* catch a wrong key shape (all seven cases went red), and it *does* distinguish
  `location.host` from `location.hostname`, because **Vitest's jsdom environment defaults to
  `http://localhost:3000`** and so `host` carries a port there. A third candidate was **dropped
  rather than filled in**, because inventing an evidence row is the same error as inventing a green
  one.
- **`chrome.storage.onChanged` reaching a content script's isolated world is a probe result, not a
  case.** D7 rests on it and the browser suite carries the *consequence* - the page's own `storage`
  listener hears nothing - with a working positive control, but the reach itself is asserted nowhere
  in either tier. The probe lives outside the repository with the rest of the measurement.
- **A host that has an association cannot have a different existing mailbox chosen for it.** That is
  the recorded limit of delivering the three-way choice as *which* mailbox a host resolves to, and no
  case tries to exercise the alternative because the product does not offer it.
- **A mailbox recorded before this build stops being insertable once this device records another
  one.** The collection is never merged with the single-mailbox record, so the earlier mailbox is
  still stored and still readable while the collection is empty and is not offered afterwards. **The
  stated reason for not merging was measured false and is corrected** — the two records are *not*
  unordered, because the boundary rule forbidding `saveMailbox` in this client makes the singular
  record strictly older — and the decision now rests on the honest reason: nothing in this milestone
  can show a second entry. The scenario **"This device also holds a mailbox from an earlier build"**
  was added to the delta so a promoted spec carries the limit, and the existing case in
  `storage.test.ts` already covers it exactly — a collection of two with a third mailbox in the
  singular record, answering with the collection alone and never asking the second — so **no new case
  was written for it**, because a second case for the same arm is how a suite grows a number that
  reads as coverage.
- **No live provider is contacted anywhere in this change**, and no mailbox is created in the
  browser tier: every case either offers an insertion against a seeded record or offers creation and
  never presses it.