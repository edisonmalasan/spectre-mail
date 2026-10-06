# SpectreMail Development Roadmap

> **Status:** Draft approved for implementation planning  
> **Repository:** `edisonmalasan/spectre-mail`  
> **Architecture:** Monorepo — website + extension + shared packages  
> **Initial delivery strategy:** Website first, extension immediately after the shared core is stable  
> **Initial infrastructure target:** $0 paid backend infrastructure  
> **Website provider:** Guerrilla Mail — the only provider reachable from a browser web page  
> **Extension providers:** Mail.tm (primary) + Guerrilla Mail (fallback) — roles changed by M0, see `Project Status`
> **Visual direction:** Spectral Swiss Utility  
> **Current public name status:** `SpectreMail` is a project codename until final naming/brand checks are complete

---

## Project Status

> This block is the root orchestrator's progress ledger. It is **not** the behavioral
> source of truth — `openspec/specs/` and the active OpenSpec change artifacts are.
> Reconcile this block against Git and OpenSpec before trusting it in a later session.
>
> `openspec/specs/` holds **ten** capabilities: `provider-abstraction` (promoted
> from `provider-role-decision`), `monorepo-foundation` (M1), `shared-domain-model`
> (M2), `provider-adapters` (M3), `mail-parsing` (M4), `build-and-verification`
> (M1), `mailbox-session` (M5 slice 1), `website-client` (M5 slice 1),
> `spectre-storage` (M6 slice 1), and **`browser-verification`** (new, promoted at the
> `browser-verification` sync stage). Counted mechanically at that stage and again after
> the archive, they hold **110 requirements and 300 scenarios** in total.
>
> **That figure was stale twice before the last correction**, and the drift was the same
> shape both times: a promotion landed and the count was not moved. It read 93
> requirements and 232 scenarios, which was the figure at slice 1's sync — so it missed
> all of slice 2 (four requirements added, three amended) *and* all of slice 3 (two
> requirements, eighteen scenarios). Counting is now re-run mechanically at every sync
> rather than transcribed, and **re-run once more after the archive**, because archiving
> is a move and a move is the operation most likely to drop a file.
>
> M0's own capability spec was archived with
> `--skip-specs` deliberately: it specifies a harness that M1/M3 must delete, so
> landing it would create permanent spec debt for disposable scaffolding.

**Roadmap cursor:** **M6 - Website Hardening, complete in scope and closed out;
`browser-verification` applied, verified, synced, and archived. M7 - Spectral Swiss Design
Pass - slice 1 (`spectral-swiss-foundation`) is APPLIED and awaiting its verification pass.
The next eligible objective after it is M7 slice 2, which is motion and
`prefers-reduced-motion`; slice 3 is the five website sections; slice 4, the
`Extension preview`, is blocked on M8.**
Slice 1 (`spectre-storage`) and slice 2
(`mailbox-adoption`) are both applied, verified, synced, and **archived** at
`openspec/changes/archive/2026-10-05-spectre-storage/` and
`openspec/changes/archive/2026-10-05-mailbox-adoption/`. Slice 1 merged as Apply
**#46** / sync **#47**; slice 2 as Apply **#50** / sync **#51**. **Slice 3
(`privacy-controls`) is applied, verified, synced, and archived** at
`openspec/changes/archive/2026-10-05-privacy-controls/`; its proposal merged as **#53**,
its Apply as **#54**, its sync as **#55**. **`browser-verification` is archived** at
`openspec/changes/archive/2026-10-06-browser-verification/`; its proposal merged as
**#58**, its Apply as **#59**, its sync as **#60**. `spectral-swiss-foundation`'s proposal
merged as **#62**; its Apply is the stage this block was written at.
`openspec list` reported **No active changes** before that proposal and reports the one
active change now.

**The archive was checked rather than assumed, because archiving is a move.** All four
delta files survived it, and each delta's ADDED block was then compared
**byte for byte against the promoted spec** — against the *archived* copies, not the
pre-archive ones, since a move is where a file is most likely to be quietly lost. All
four verbatim, and `openspec validate --specs --strict` reports **10 passed, 0 failed**.
The archive ran with `--skip-specs` because the sync stage had already promoted all four
files; without it the delta would have been applied twice. `openspec validate
browser-verification --type change --strict` now **fails** with *"Change must have at
least one delta"* — the documented OpenSpec 1.13.2 behaviour for an archived change, and
not data loss, as the same message appears for every previously archived change here.

**M6's code scope is now complete, and this was established by auditing rather than by
building.** Slice 4's four items — error states, security, accessibility, and pausing
polling when the page is hidden — were checked against the tree before any change was
opened, and **three were already delivered and already specified**; the fourth's two
undelivered accessibility items are CSS, which this milestone's own promoted requirement
excludes (*"This milestone builds structure, not visual design"*) and which M7's Accent
and Motion blocks already place inside M7. **No fourth change was opened**, and the
audit is recorded under M6's slice table with a file or a promoted requirement named for
every claim. `packages/storage` holds **44 tests** and the workspace runs **649 across
31 files**, counted from a JSON reporter.

### `browser-verification`: the first real browser run, and what it found

**Proposed** (merged **#58**), **applied** (**#59**), **synced** (**#60**), and
**archived** at `openspec/changes/archive/2026-10-06-browser-verification/`. It is not
product code; it is the thing that would close a set of long-standing unproven claims,
and **closing them is what it did — except that it found a bug first.**

**The finding, and it invalidates a claim this file has been making.** In real Chromium
the page **wrote the mailbox and never concluded it had**: measured
`records=1 claimsStored=0 offersRemoval=0`. The removal control `website-client` requires
— *"the user can make this device forget the address"* — **was never offered at all**,
while **152 unit tests passed**. `packages/storage`'s 44 tests could not have found it:
`fake-indexeddb` resolves a write immediately, so there is no window in which a listing can
land mid-write.

The cause was a per-invocation unmount guard in `useMailboxSession.ts`, cleared by the
save effect's **own cleanup** whenever the inbox published a new `state` object. The guard
is now a `mounted` ref cleared only on a real unmount, and `handed.current` was
deliberately left alone — it is correct, and it is exactly why no later invocation could
recover. **The change was widened during apply to carry this repair** (D9/D10), and the
proposal's claim that no shipped source file is edited was **withdrawn rather than
reworded**.

**Two claims closed, one partly:**

- **`createBrowserStorage()` is now executed by a test** — 6 Playwright specs against the
  built page in real Chromium and real IndexedDB. Boot, save, read-back through the
  platform's own API, confirmed adoption, and a removal that leaves
  `indexedDB.databases()` empty including a store this build does not recognise.
- **One `fake-indexeddb` behaviour was corroborated by Chromium**: removal means
  `deleteDatabase`, not clearing `CURRENT_MAILBOX_KEY`. Established by breaking it and
  watching both tiers go red — 8 unit tests and 2 browser specs. **That is a fact about
  that behaviour, not a general licence for the fake.**

**Still unverified after the run, and this list is the deliverable as much as the specs
are:**

- **`use it externally`.** The suite is **offline by design**: provider traffic is served
  from recorded responses imported by name from `packages/providers`, and any other
  origin is aborted **and named**. No stored mailbox has ever been reconciled against a
  live Guerrilla Mail session.
- **The live polling cadence.** Nothing has observed what a real provider does when a
  real page polls it every five seconds.
- **The blocked-`deleteDatabase` semantics.** Still a `fake-indexeddb` measurement; the
  browser suite does not produce that event.
- **Other browsers.** Chromium only.
- **The browser tier in CI — now closed, and it is the one item on this list that was
  resolved rather than merely recorded.** The job hung on **five** runs and the cause is
  now
  **measured**: it was this repository's own `webServer` command. `pnpm preview` spawns
  `vite` as a child, so Playwright's shutdown killed the wrapper, orphaned the real
  server, and then blocked on the pipe that orphan still held. Fixed by invoking `vite`
  directly, and **the job now passes in 58 seconds**. **The record worth keeping is the
  two wrong theories**, each reasonable and each refuted by measurement rather than
  argument: raising the job ceiling 20 → 30 (the second silence was **longer** at
  29m34s, so it is an indefinite hang, not a slow one), and
  `--disable-dev-shm-usage --no-sandbox` (**Chromium launched on the same runner in
  250ms** and `/dev/shm` there is 7.9G). What actually found it was **per-step
  ceilings**, because a job-level one names no step: those printed the finding the
  earlier kills had destroyed — **all 6 specs passing in 2.6 seconds and then no summary
  line**, with the next step reporting port 4173 still held. **Two further lessons are
  recorded because both cost a cycle**: with `CI=true` Playwright's **dot reporter**
  prints progress without newlines and a kill discards it, so four runs of missing test
  output were the *reporter* and never a hang; and the first diagnostic ran before the
  build, dying in two seconds on a missing `dist` — a diagnostic that cannot fail for
  the reason it exists is worse than none. **The job is green: 58 seconds, and a later run
  1m35s.** A third item left this list as a consequence of the debugging rather than of
  the change: `spike self-test` was cancelled on four runs while the browser job was being
  fixed, and it is **green in 30–37 seconds** now that runner capacity freed up, which is
  the confirmation that it was never this change's code. It is described below anyway,
  because the way it presented is worth not misreading a second time.
- **`spike self-test` was cancelled on four runs, and it was not this change's code.**
  That job is untouched by `browser-verification` — no browser, no Playwright,
  and it takes 26 seconds when it runs. Every one of those runs reports
  **`runner_name` empty and `steps: 0`** from the API, and a **22-byte empty log
  archive**: the job **never received a runner and never executed a step**. One rerun sat
  in queue for **1215 seconds** before its own 10-minute `timeout-minutes` expired,
  which is where the repeated exact 15m duration comes from. **This is GitHub-hosted
  capacity for this repository being exhausted, not a defect in anything under test**.
  **It now passes in 30–37 seconds**, which is what confirmed the reading after the fact.
  It is kept on this list because a job that reports `cancelled` with **no logs at all**
  looks exactly like a hang and is not one — **the job JSON is the only instrument that
  distinguishes them**, and this change had already spent five runs theorising from
  missing output before anyone checked it.

**Two boundary collisions were predicted before they happened and both landed**, which is
the record worth keeping: the `apps/`-scoped storage-API rule saw test code naming a
storage API (fixed by `isTestFile`, the **twenty-first** instance of a check narrower than
its rule), and the provider-field-name rule saw test code under `apps/` (fixed by a
`tests/`-exemption where the rule could not honestly have one). A **third** rule was added
rather than adjusted: every shipped `*.spec.ts` must be collected by the browser suite
and by nothing else, with roots read from `playwright.config.ts` — **47 boundary
assertions** now, and **8 of 8 mutations caught by the intended assertion**.

**What slice 3's proposal measured before proposing anything.** It holds one record
kind under one key in one database, and **no message history or metadata cache is
persisted anywhere** - the inbox lives in memory in `packages/mailbox`. So the
Privacy controls block's three named controls map onto **one** operation:
`Forget mailbox` and `Clear all local SpectreMail data` are the same removal today,
and `Clear mailbox history` **has no referent**. Shipping three buttons where two are
identical and one does nothing would be a fake capability, and inventing a history
store so a button could delete it would create user data in order to destroy it. One
control is proposed, named for what it does. `IDBFactory.deleteDatabase` was also
probed on this repository's own substrate, and **the proposal's first reading of that
probe was wrong**: it claimed a blocked delete never completes, when a blocked delete
is in fact *queued* — it cannot finish while another tab holds the database, it blocks
reads meanwhile, and it goes through as soon as that tab closes. The reason a removal
must be **reported rather than waited on** is therefore not a hang; it is that the
wait ends on a condition the page cannot cause, and a refusal is not a cancellation,
so the page must never tell a user their data is still there after one. Corrected in
the change's apply stage, with the amendment recorded in the delta.

**Slice 3's apply stage found three defects in its own work, and the third is the one
that generalises.** The falsification pass reported **17 of 17 mutations caught by the
intended assertion**, with a deliberate comment-only control staying green — that control
is what proved the harness notices an *assertion* rather than an edit. One mutation was
green at first, and the cause was not a narrow check: the adapter's
`request.error ?? …` **fallback branch had no test at all**, so its wording could be
replaced with anything. That is the twentieth instance in this repository of a check
narrower than its rule. But the control *also* failed intermittently — impossible for a
comment — which exposed two tests waiting on the wrong thing: they synchronised on `ready`
while asserting on state that only settles in the `saveMailbox` **success callback**, a
later turn of the microtask queue. **A binding publishes what the user sees from the
session, and what the device holds arrives from a promise afterwards, so a wait on the
first cannot observe the second.** Both now wait on the storage region; 30 consecutive
runs were green afterwards.

**Slice 2 delivers `return to a recent mailbox`, and that acceptance line is now met.**
The website reads its own storage before it asks the provider for anything, hands the
session what it found, and writes back a mailbox it was **not** handed. Adoption
reconciles through the provider that owns the address, so a stored mailbox is only ever
presented once the provider confirms it.

That leaves M6's acceptance list with **two of four met**: `return to a recent mailbox`
with slice 2, and `clear local SpectreMail data` **with slice 3, which is now applied**
— one control, because the other two names in that block have no referent or name the
same removal; the mapping is annotated at the slice table below. The remaining two —
`use it
externally` and the security and accessibility items — are unchanged and still
undelivered. **Two of four is not a milestone half-finished by accident**; it is the
point at which this milestone stops being about storage and starts being about
everything M6 grouped that is not storage.

**Slice 3's numbers as of 2026-10-05, superseded by the block below.** At slice 3 the
workspace ran **647 tests across 31 files**, of which **46 were architecture boundary
assertions** - **unchanged by slice 3, which added no boundary rule**:
`CLIENT_STORAGE_API_PATTERN` already forbids a client naming `indexedDB`, and `clearAll` is
reached through the contract, so there was no new way to break. 54 in `packages/core`, 89
in `packages/providers`, 149 in `packages/mail-parser`,
**153 in `packages/mailbox`** (19 of them adoption), **112 in `apps/web`** (108 rendering,
4 provider configuration), **44 in `packages/storage`** (7 stored record, 30 IndexedDB
adapter, 7 browser entry point), and 46 boundary. Counts come from `--reporter=json`
grouped by project, not added by hand. **The `apps/web` figures in this block were
wrong before this correction** - it said 96, and 3 provider-configuration tests, where
the real pre-slice count was 108 and 4. That is the second time this repository has
recorded a count it had not measured, which is why the source changed from a summary
line to a JSON report grouped by project. `pnpm install`, `pnpm typecheck`, `pnpm lint`,
`pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm verify` all exited 0.

### Numbers as measured 2026-10-06 after `browser-verification`'s apply stage

**649 tests across 31 files, of which 47 are architecture boundary assertions.**
54 in `packages/core`, 89 in `packages/providers`, 149 in `packages/mail-parser`,
**153 in `packages/mailbox`** (19 of them adoption), **113 in `apps/web`**,
**44 in `packages/storage`** (7 stored record, 30 IndexedDB adapter, 7 browser entry
point), 47 boundary. Counts come from `--reporter=json` grouped by project, not added by
hand.

**The two movements are both this change's, and neither is cosmetic.** `apps/web`
112 → 113 for the regression test that holds a write open across an inbox transition —
the write no existing test could hold open, which is why 112 of them passed on a page
whose privacy control did not exist. Boundary 46 → 47 for the rule requiring every
shipped browser spec to be collected by the browser suite and by nothing else. **There is
now a second test tier** — 6 Playwright specs in `apps/web/e2e/`, run by
`pnpm test:browser`, **not** in `pnpm verify`, with its own CI job. **Those 6 are not in
the 649** and adding them to it would misreport what `pnpm test` covers.
`pnpm test:browser` exited 0, 6 passed. The gate commands all exited 0, and `pnpm verify`
was additionally verified **with no browser installed** by pointing
`PLAYWRIGHT_BROWSERS_PATH` at an empty directory.

### Current numbers, measured 2026-10-06 at `spectral-swiss-foundation`'s apply stage

**689 tests across 35 files, of which 51 are architecture boundary assertions.** 54 in
`packages/core`, 89 in `packages/providers`, 149 in `packages/mail-parser`, 153 in
`packages/mailbox`, **113 in `apps/web`**, 44 in `packages/storage`, **36 in `packages/ui`**
(12 contrast, 11 pairs, 5 generated-stylesheet, 8 design document), 51 boundary. Counted
from `--reporter=json` grouped by project, not added by hand.

**`apps/web` is 113 and that is the load-bearing number in this paragraph.** The slice adds
`className` to twelve components and changes no element, no accessible name, and no
`data-testid`, so the client suite's count is **required** to be unchanged. A movement would
have meant markup moved, and it would have to be explained before anything else was looked
at. It is unchanged. Boundary 47 → **51** for the four new rules; `packages/storage`, the
provider layer, the parser, the session layer, and the domain model are all untouched.

**The second tier moved, and it moved in the direction the claim required.** **11** Playwright
specs in `apps/web/e2e/`, up from 6: the six storage specs are **unchanged in count**, and
five focus specs were added. That the existing six kept their count is the evidence that
styling changed no behaviour the browser tier already covered — had adding `className`
altered a control's role or its accessible name, one of those six would have stopped
finding its target.

**25 of 25 deliberate violations were caught by the intended assertion, with restoration
verified by SHA-256**, across both tiers. Three of those mutations are worth naming
because each one changed an assertion rather than merely breaking a suite:

- **Deleting the `:focus-visible` rule left the suite green.** The focus specs assert that
  an indicator is present and non-`none`, and with the product's own rule gone Chromium's
  user-agent stylesheet draws `outline: auto` — which passes. The specs now assert
  `expect.soft(focused.style).not.toBe("auto")` as well, so a ring the browser invented
  cannot satisfy a claim about a ring this product drew. **This is the twenty-second
  recorded instance of an assertion narrower than the rule it documented**, and the first
  one this change authored and then caught.
- **A fourth `.inbox-row` selector, inside a `@media` block, was missed** by a
  line-anchored mutation, which reported `green` for a mutation that had not been fully
  applied. The harness gained `replaceAll`, and a mutation that cannot apply now records
  `noop` and skips its run rather than running the tree half-mutated.
- **`renderDesignDoc()` emitting a line array was read by the harness as a list of
  separate edits**, producing seventeen `noop` rows and then a `green` — a mutation
  reported as surviving because its own text had failed to apply. The harness now
  discriminates the three forms of `to` by element type.

**What this slice does not establish, and the list is the point.** **How SpectreMail
looks** — no test reads a rendered pixel's colour, so the palette is arithmetic and the ring
is a computed style, and both are silent about whether the result is *good*. **Firefox and
WebKit** — one engine, deliberately. **`use it externally`** — the browser tier still serves
recorded provider responses, so a stored mailbox has still never been reconciled against a
live Guerrilla Mail session. **The live polling cadence** — unchanged. **Blocked
`deleteDatabase`** — still a `fake-indexeddb` measurement. **Motion** — declared, used by
nothing, arriving at slice 2 with `prefers-reduced-motion` attached.

**Where slice 2's requirements now live.** Four were added and three amended, promoted
at the sync stage and now in `openspec/specs/`. `openspec validate --specs --strict`
reports **9 passed, 0 failed**; `openspec status` reports **No active changes**. The
delta and the promoted specs were compared mechanically rather than by reading, and
**all 34 requirement and scenario titles in the delta are present in the promoted
files**: **0 missing**. That comparison is the check this repository needed, because M4
shipped a milestone whose archived delta and promoted spec disagreed — the amendments
had been written into the promoted spec at the sync stage and never back into the
change. Slice 2's three apply-stage amendments are in the delta, so this archive does
not repeat that. Promoted totals move from 93 requirements and 232 scenarios to **97 and
253**.

**Where slice 3's requirements now live.** Two were added — one to `spectre-storage` and
one to `website-client` — promoted at this sync stage and now in `openspec/specs/`.
`openspec validate --specs --strict` reports **9 passed, 0 failed**. The promotion was
done by a script that copies each delta block **verbatim**, and then checked **byte for
byte** rather than by title: title agreement is the weaker check and a hand-typed
paraphrase would keep the heading while losing the text. Both blocks are verbatim, **0
divergent, 0 absent**. Promoted totals move from 97 requirements and 253 scenarios to
**99 and 271**.

**`spectre-storage`'s `Purpose` was corrected here rather than through the delta, and
that is a rule rather than an exception.** It read *"delivered but not consumed"* with
the reason given that no client read or wrote the layer — true when written, false since
slice 2 — and it claimed the contract names no operation, which slice 3 ended. A
`## Purpose` inside a delta is **ignored** for a capability that already exists, so a
delta that carried the correction would have shipped one nobody applied. The correction
is dated in the promoted file and says why it landed there.

**This milestone added persistence, and slice 3 added its removal.** The sentence that
stood here in the previous stage — *"no control anywhere that deletes it"* — was true
when written and is now false, so it is **deleted rather than reworded**, which is the
same treatment the page's own limits bullet received. What replaced it is the narrower
truth worth carrying: the product stores a mailbox in a user's browser, offers a
two-step confirmed removal of the whole database, and **that removal has never been run
in a browser at all**.

**The archive ran with `--skip-specs`, and the flag was checked against the artifacts
rather than assumed to have worked.** All six survive the move — `.openspec.yaml`,
`proposal.md`, `design.md`, `tasks.md`, and both capability deltas — and the delta blocks
were re-compared against the promoted specs **after** the move, not before. Archiving is a
move, and a move is the operation most likely to quietly drop a file or truncate one, and
the artifacts that survive are exactly the ones a later reader will trust: `design.md`
records why each decision was made, and the delta records what the change asked for. **2
verbatim, 0 divergent, 0 absent** against the archived copies. `openspec validate --specs
--strict` still reports **9 passed, 0 failed**, so the flag did what it exists to do:
promote nothing a second time.

The archive reported **28/29 tasks**, and the one incomplete was **9.4 — this archive
itself**. It was ticked in the archived copy rather than left, because a task list
sitting permanently one short reads as an oversight rather than as the stage that was
running when the list was read.

**`openspec validate privacy-controls --type change --strict` now fails, and the reason
is worth measuring rather than reading.** It reports *"Change must have at least one
delta. No deltas found."* — which reads like the archive dropped them. It did not: both
delta files are present with their headers and 18 scenarios between them, and both match
the promoted specs byte for byte. **The same error appears for `mailbox-adoption`,**
archived a session earlier and verified at the time, so it is OpenSpec 1.13.2's behaviour
for a change that is no longer active rather than anything about this change. `openspec
list` and `openspec status` both report **no active changes**, which is the state a
finished slice is supposed to leave behind. **The checks that still mean something after
an archive are `openspec validate --specs --strict` and the byte-for-byte delta
comparison** — not a re-validation of the archived change.

**What slice 2 does not establish, and the list is longer than it was after slice 1.**
No page under test has ever run in a **real browser**, and this is the first change that
would persist anything in one. `jsdom` implements no IndexedDB, so the real
`createBrowserStorage` path is exercised by no test at all - the client suites inject a
store, and `fake-indexeddb` is a fake rather than a browser. No test contacts a live
provider, and **a restored mailbox has never been reconciled against a real Guerrilla
Mail session**, which is the whole operation this slice added. The polling cadence has
still never run against a live provider. The falsification pass covered **31 mutations,
31 caught by the intended assertion**, every mutated file restored byte-identical by
SHA-256; one further mutation was **recorded as unfalsifiable rather than counted**,
because `inbox.check` handed a mailbox cannot return the two states that branch guards,
so no test can reach it.

**The archive ran with `--skip-specs`, because the sync had already promoted the
delta.** That is the documented reason the flag exists and the fourth time this
repository has needed it. Its effect was verified rather than assumed: the promoted spec
was compared against the archived delta **mechanically**, by extracting every
requirement and scenario title from each — 7 and 17 in both, same order, no title on
either side alone — and `openspec validate --specs --strict` reports **9 passed, 0
failed**.

**One arithmetic error was caught in this block while recording the above, and it is
worth naming rather than quietly fixing.** The first draft of the M6 section restated
M5's `website-client` count as *20 requirements / 39 scenarios*. It is **16 / 39** —
slice 4 promoted a `MODIFIED` requirement, which adds scenarios without changing how
many requirements the file has. That is the **fourth** wrong total this roadmap has
published, and it was found by counting the promoted files rather than by re-reading a
previous footer's claim, which is the only reason it was found at all.

**M6 slice 1's numbers as of 2026-10-05, kept as that slice's snapshot.** The workspace
ran **574 tests across 28 files**, of which **44 were architecture boundary assertions**:
54 in `packages/core`, 89 in `packages/providers`, 149 in `packages/mail-parser`,
134 in `packages/mailbox`, **77 in `apps/web`** (74 rendering, 3 provider configuration),
**27 in `packages/storage`** (7 for the stored record, 20 for the IndexedDB adapter), and
44 boundary. Counts are read from the reporter, not added by hand. `pnpm install`,
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, and
`pnpm verify` all exited 0.

**No client consumed the package when slice 1 was archived, and this is kept as that
slice's record rather than corrected into the present tense.** `packages/storage` had
real behaviour and nothing read it; a reload discarded the mailbox, `return to a recent
mailbox` was undelivered, and no privacy control existed. Slice 1 delivered the seam a
client could be wired against, not persistence. **Slice 2 is what wired it**, and the
cursor above is the current statement.

**What slice 1 is evidence for.** That a `SpectreStorage` contract can be stated, stored,
and read back under two conditions this repository can test without a browser:
**absence and failure are different answers**, and a value is narrowed through `core`'s
own `isMailbox` on both the way in and the way out. Its two boundary rules were proved
falsifiable — **27 of 27 mutations caught**, each by the intended test, every mutated
file restored byte-identical by SHA-256 — and **six defects this change authored were
found by that pass and fixed**, all recorded in the change's `design.md`.

**What slice 1 is not evidence for.** `fake-indexeddb` **is not a browser**: a green
suite against it says nothing about a real IndexedDB implementation. No live browser run
of the website has ever been made. No test in this repository contacts a provider.
`pnpm build` builds the website only and says nothing about this package, which is
consumed as TypeScript source and established by `pnpm typecheck`.

---

**Roadmap history: M5 - Website Core MVP. All four slices are complete and
archived** (`mailbox-session-layer`, PRs #28–#32; `inbox-polling`, PRs #33–#36;
`message-view`, PRs #37–#40; `provider-reachability`, PRs #41–#44 — propose, apply and
verify, sync, archive: four PRs each, as every stage has been). The promoted
capabilities hold **`mailbox-session` at 20 requirements / 48 scenarios** and
**`website-client` at 16 / 39** — slice 3 contributed 6 + 16 and 4 + 10, and slice 4
promoted a `MODIFIED` requirement, which took the second file from 37 scenarios to 39
while leaving its requirement count at 16.

Those counts were **recounted from the requirements rather than carried over from the
previous footer's own claim.** This roadmap has published arithmetically-wrong counts
three times, one of them in a promoted spec's provenance line, so slice 2's figures were
re-derived before being extended — 7 + 14 and 7 + 18 for `mailbox-session`, 7 + 15 and
5 + 12 for `website-client`, all of which verify exactly.

**M5 has no buildable slice left, and the next objective was M6 — Website Hardening.**
That is a move of the cursor, and it is not M5 being skipped. Three of M5's four
remaining slices were blocked by milestones scheduled **after** it, and the fourth is
resolved by the `provider-reachability` change, which declined to ship a provider
selector rather than shipping one that cannot act:

| remaining slice | status | the file that establishes it |
| --- | --- | --- |
| provider selector | **resolved**, slice 4 | `website-client` now requires no selector, and the naming of the one provider reached |
| theme | blocked | `packages/ui/src/index.ts` – design tokens are applied from M7, not anticipated here |
| mailbox history | blocked | **now M6 slice 2** — the `SpectreStorage` contract arrived at M6 slice 1 (2026-10-05) and *nothing reads it yet*, so the history slice still has nothing to persist through |
| clear-data | **M6's own** | M6's Privacy controls list `Clear all local SpectreMail data` verbatim |

*Recorded 2026-10-04:* this block previously read "Four of its slices remain — and
the next objective is M5 slice 4. M5 remains the earliest incomplete milestone, which
is the rule that selects it." That was the delivery-order rule pointing at a milestone
it could not advance, three times over. A cursor that cannot move is not a cursor.

*Corrected 2026-10-03:* the archive commit recorded slice 2's PRs as #33–#37. There
were four of them, #33–#36. A range written from a plan rather than from
`gh pr list` is still a claim, and claims need checking.

**Slice 3's numbers as of 2026-10-03, kept as that milestone's snapshot.** The
workspace ran **537 tests across 26 files**, of which **37 were architecture boundary
assertions**: 54 in `packages/core`, 89 in `packages/providers`, 149 in
`packages/mail-parser`, **134 in `packages/mailbox`**, **74 in `apps/web`** (71
rendering, 3 provider configuration), 37 boundary. The website
now lists a mailbox's messages, polls it, **and opens one**; it has **no styling and
no persistence** — a reload still discards the mailbox, because storage is M6.

**Slice 4's numbers as of 2026-10-04, kept as that milestone's snapshot.** The workspace
runs **545 tests across 26 files**, of which **42 are architecture boundary
assertions**: 54 in `packages/core`, 89 in `packages/providers`, 149 in
`packages/mail-parser`, 134 in `packages/mailbox`, **77 in `apps/web`** (74 rendering,
3 provider configuration), 42 boundary. `pnpm install`, `pnpm typecheck`, `pnpm lint`,
`pnpm format:check`, `pnpm test`, `pnpm build`, and `pnpm verify` all exited 0, and
`openspec validate provider-reachability --type change --strict` exited 0. The count is
per-file summed from a JSON reporter rather than added by hand, after this roadmap
published arithmetically-wrong totals three times.

**What slice 4 is evidence for.** That a client's exported provider-id list is the
configuration rather than documentation beside one, and that the website ships no
provider selector **as a requirement** rather than by omission. Both are falsifiable:
8 of 8 deliberate mutations were caught by the intended assertion, with every mutated
file restored byte-identical by hash.

**Lifecycle.** Apply merged as **#42**, sync as **#43**, and the change is **archived**
at `openspec/changes/archive/2026-10-04-provider-reachability/` with
`--skip-specs --yes`; `openspec status` now reports **No active changes**. The sync
promoted a `MODIFIED` requirement into `openspec/specs/website-client/spec.md` — 16
requirements, 39 scenarios, up from 37 — and all four of the delta's scenario titles
were verified present in the promoted file **mechanically**, by comparing titles and
counting, not by reading. `openspec validate --specs --strict` reports **8 passed, 0
failed**.

**The archived delta and the promoted spec's requirement block are byte-identical**,
which is the check M4's numbers argue for. Whether they differ is a property of *which
artifact an amendment was written into*: a gap means the amendment was recorded in the
wrong place, because `openspec/specs/` is the source of truth for what is required and
the archived delta is the record of what the change asked for. Slice 4's amendments
were written into the delta during propose, so there is nothing left for the sync to
add and the two agree exactly — the same outcome as slice 3, for the same reason.

*Recorded because the archive verification harness damaged a file it could not restore,
and the guard that prevents a repeat is the useful part.* `openspec archive` **moves**
the change rather than copying it, so `openspec/changes/archive/<date>-<change>/` is
**untracked** from that moment until something is committed. A mutation run against the
archived delta therefore cannot be undone with `git checkout --`, which fails with
"pathspec did not match any file(s) known to git". The run that proved the delta-loss
check fires left a `#### Scenario: A placeholder` in the archived delta. Recovering it
took **two wrong attempts before a correct one**:

1. `git show <commit>:<path> > file` through PowerShell returned the right content with
   **93 CRLF line endings**, so the file came back byte-wrong.
2. Piping that through node preserved the content but not the endings either, because
   PowerShell had already rewritten them before node saw them.

Only `execFileSync("git", ["show", ...])` returning a Buffer and writing that Buffer
unchanged restored the file — verified by SHA-256 against the pre-run hash. The harness
now **refuses to mutate any path git does not track** and says why. Recovering text
through a shell redirect on Windows is not recovering bytes.

**What slice 4 is still not evidence for.** No live browser run has been made, every
provider interaction in every test still replays a recording, the polling cadence has
still never run against a live provider, and `pnpm test` is still not a claim about
types — it went green here while `pnpm typecheck` failed on a `SpectreError` fixture
missing a required `cause`.

*Corrected 2026-10-04:* slice 4's propose commit message says the change has **19
tasks across five groups**. It has **15** — 4, 3, 3, 3, 2 — verified by counting the
checkboxes in `tasks.md` rather than by recalling the plan. That is the **fourth**
recorded wrong count published by this repository, after three in earlier footers, and
it is left uncorrected in place because the commit is merged and rewriting it would
cost more than the record is worth. Counting a plan is still a claim, and this
repository has now been wrong about one four times.

**Slice 3, and the three things it is actually evidence for.** The website now opens a
message: `MessageView` renders the sender, subject, arrival time, readable text, the
codes in the parser's own rank order, and each detected link as text with its host
visible. Three limits are properties of the slice rather than omissions, and each is
enforced rather than merely intended — a boundary rule fails the build if a client
copies a **code**, and a separate rule fails it if a detected URL becomes an `href`.
Copying the **mailbox address** stays legal, because the roadmap's own acceptance
criteria require it, and a rule broad enough to forbid it was the mistake that scoped
this one. Confidence is never rendered as a number. And a message that could not be
read says exactly that, offers a retry, and **never** says it holds no code — the one
false claim that costs a user the thing they came for.

**The falsification pass: 40 mutations across three harnesses, 40 matched, 0 unmatched,
and every mutated file restored byte-identical.** Round 3 exists because a repair is
the least trustworthy code in a change — written late, in response to a finding. Two
of the four things the harness surfaced were **defects in the implementation**, not
gaps in a test. The first was found by a test written for a different reason: the
opened tracker's `onChange` wrapped its own publisher in a second `setState`, so every
subscriber was told the same thing **twice** on every opened-state change, and a React
client re-rendered per notification. The second was `B2` reporting NOT CAUGHT, and the
gap was real — nothing asserted that an open message survives a poll tick.

**The verification pass found eight defects, and they are worth more than the slice.**
Two are this repository's recurring shape in new clothing. The "acts on a finding"
boundary rule was **narrower** than the requirement in two ways:
`clipboard.write([new ClipboardItem(...)])` matched neither of its two patterns, so a
whole family of the standard API was invisible, and a word-bounded `code` cannot match
`otpCode` or `foundCode`, so the pattern answered `false` on exactly the names a
developer would most plausibly use. And the listing-failure test **asserted no premise
at all** — deleting its failure fixture left it green, because a second listing
serving the same message sheds nothing either way, so it could not tell the rule it
names from a neighbour sharing its fixture. The per-form controls for two rules were
loops that stop at the first failure, so a rule broken three ways produced one name;
they now gather every missed form and assert the set empty.

**One check was invalid rather than narrow.** The clause for the new interface member
asked for a stub lacking it to fail to compile. The first attempt deleted the member and
read `tsc`'s output for the name: **zero** errors, because removing a member cannot
break the class that still implements it, and the name was found in the implementation
instead. It is now a bidirectional `@ts-expect-error`, whose control makes the member
optional and requires `tsc` to report the directive going unused. `pnpm test` cannot see
that assertion at all, which is precisely why the clause named `tsc`.

**Surfaced, not absorbed.** `new Date(receivedAt).toISOString()` throws a `RangeError`
on a non-finite `receivedAt`. It arrived with slice 2, its honest home is `core`, which
owns the field, and fixing it here would widen the change past its scope — so it is
recorded rather than taken.

**Slice 3's sync and archive, and one thing the archive got wrong first.** The sync
promoted ten requirements and twenty-six scenarios, every one `ADDED`, and checked the
merge **mechanically** with a script kept outside the repository — "a manual merge is
exactly where a scenario quietly disappears." The first provenance needle did not match,
because it carried quotes around a quoted phrase the file does not quote; the guard fired
**before the first write**, because an earlier draft of the tool validated inside its
write loop and would have left one capability half-merged the moment the other's needle
failed. The tool also appends, so a second run would have silently duplicated all ten
requirements — it now refuses, and that refusal was **observed** with both files
byte-identical by hash.

The archive needed `--skip-specs`, because the sync had already promoted the delta, and
its effect was checked on three counts an exit code cannot show: both promoted specs are
**hash-identical before and after** (`F7843D6F~` and `41F52950~` unchanged), the archived
files are **renames with zero content change** (git reports `R100` on five of six, and
`R086` on `tasks.md` — the 14+ being the tick and the ledger written before archiving),
and `openspec status` reports **No active changes**.

**The first archive run reported `Task status: 35/36` and warned about an incomplete
task**, because 6.4 was still unticked at the moment it ran — so it froze a ledger that
was not yet true, and the command's own warning was the only thing that said so. The
archive directory was removed, 6.4 was ticked against the three observations above, and
the command re-run, so the archived copy records **36/36** rather than a shortfall that
no longer exists. Worth recording because the correction means deleting a directory the
tool had just written: it had never been committed or pushed, and no promoted spec was
touched at any point.
**Two claims about this slice that are not claims about the product.** The component
has **never been seen by anything but jsdom** — **no live browser run of the website
has ever been made** — and the `opened` state is asserted over a stub provider or a
recording transport, so nothing here says what a real provider does when a real page
opens a real message. The polling cadence still has **never run against a live
provider**. And `pnpm test` is not a claim about types: a hand-written
`SessionFailure` carrying a `provider` field, where the real type carries
`providerFailures` as a list, left the suite green and failed `pnpm typecheck`.

**Two criticals came out of slice 2's independent verification pass, and both are worth
more than the features.** First, **`pnpm typecheck` was red while `pnpm test` was green
at 469/469** — a `SpectreError` fixture omitted a required `cause`, and Vitest does not
typecheck, so the suite passed and tasks 5.7 and 6.1 sat ticked while the repository's
own aggregate gate was failing. Second, **the global-`fetch` rule never covered
`packages/mailbox`**: it scanned the two packages that could plausibly want a
transport, and slice 2 added a polling loop to a third, which is precisely the code
whose temptation is to reach for `fetch` directly — while `inbox.ts`'s own module
comment claimed the rule "now covers these modules too". The rule now covers the
package, with a positive control **per fetch form**, and the behavioural half of the
same requirement was extended to drive `checkInbox()` and one turn of the loop over a
recording transport. That transport had to be taught to answer with a real mailbox
first: a session that never opened has nothing to poll, so the "no request of its own"
assertion would have passed for the wrong reason.

**The falsification pass: 39 mutations, 35 caught on the first run, 4 not caught, all
four repaired and re-verified.** One of the four is the finding most worth carrying
forward, because it is not a test gap at all: a scheduled callback that captured the
mailbox instead of reading it at fire time is **not** a defect, because `reset` both
cancels the pending schedule and clears the field — removing either guard alone leaves
the other, and only removing both let a discarded mailbox be listed. The code comment
was rewritten to say exactly that rather than to credit a single mechanism. The other
three were genuine gaps: a cadence test whose four listings had lengths 2, 3, 2, 2, so a
comparison of *length* reached the same verdict as a comparison of *identity* and
passed holding the very defect it was written for; a listener test whose scenario
`Set` iteration is **defined** to tolerate, so it exercised nothing; and a view that
could have dropped the messages a previous check learned with nothing to catch it.

**Two delta clauses were amended rather than reinterpreted, and that is a first for
this roadmap.** `mailbox-session` required the caller to "state exactly what time it is
at every step", which assumed a `now()` that D2's scheduler-only seam removed; and
`website-client` forbade showing any "provider rate", which contradicted the *other*
delta's requirement that a provider's limit statement be reported verbatim — and the
implementation does show `1; w=60`. Both were narrowed to what the implementation can
defend, with the reason written into the delta itself and a new test asserting the
distinction directly: the provider's statement appears, attributed and with its scope
disclaimed, while the no-duration assertions still hold on that very page.

**Slice 1's sync added no scenario to either capability — 7 requirements and 29
scenarios in, 29 out** — and that is the point worth recording: its verification
pass found eleven defects and every one of them was in a *test*, a *rule*, or a
*document*. The contract it was checking turned out to be sound. A sync that had to
change a requirement would have meant the pass had missed something, and a
mechanical delta-to-spec comparison (script kept outside the repository) is what
establishes that nothing was quietly dropped in the manual merge.
Tasks 1.1–5.6 are all ticked, the last on the rule that a task box is not evidence.

**Slice 2 exists because a temporary mailbox that never shows mail is not worth
having**, and because it is the first slice that must state a request cadence. That
cadence could not be derived from measurement, and the proposal says so rather than
producing a confident number: `docs/PROVIDERS.md` records Mail.tm's `GET /messages`
at `30; w=60` **measured unauthenticated only**, and Mail.tm is unreachable from a
web page at all, while Guerrilla Mail publishes no limit and none was measured. So
the interval is a stated product choice (5s while mail is arriving, doubling per
quiet check, capped at 30s), the poller honours any limit a provider *does* declare
as a floor rather than parsing it into a schedule, and polling stops when the client
says nothing is displaying the inbox. **It has never been run against a live
provider**, which the proposal states rather than leaves for a reader to assume.
**M5 is being delivered as a sequence of bounded changes rather than one**, and the
first settles where client-side orchestration lives. The roadmap's shared-package
list had no home for it: it assigned "mailbox lifecycle" and "mailbox manager" to
`packages/core`, but `shared-domain-model`'s approved purpose states that capability
describes "the model and its invariants only" and excludes lifecycle behaviour. A
roadmap is a plan; an approved spec is a contract; where they disagree the contract
wins. So the behaviour goes in a **new framework-free `packages/mailbox`** rather
than widening `packages/core` from a type surface into a runtime one, and rather
than being written inside `apps/web` where M8's extension would have to rewrite it.
This change also **amends this roadmap's own shared-package list**, in the same
change, rather than leaving the document to disagree with the tree.
**Two architecture-rule defects were found while applying it, and both are recorded in
the change's `design.md` as D9 and D10.** The provider manager destroyed a single
provider's failure `code` by re-wrapping it in an `Error` whose message carried the
code only as prose, and a test asserting a *substring* stayed green while it did —
rethrow the original failure object when exactly one provider is configured. The
adapter-confinement rule was **broader than its stated intent**, forbidding
`createProviderManager` and `createFetchTransport` outside `packages/providers` and so
leaving `MailProvider` impossible to instantiate outside its own package; it was
re-scoped to separate *implementing/re-exporting* an adapter from *naming* one, and it
**fired on its own documentation**, the third time in this repository that has
happened — fixed by stripping comments before matching, not by rewording the prose
until the rule went quiet.
**Falsification at apply:** 38 mutation attempts, 31 recorded `CAUGHT` with the
intended test named, every file restored byte-identical. Two real gaps were found that
way (a vacuous mutual-exclusion assertion in the website's state test, and a first fix
for it that was itself wrong), 5 were faults in the harness rather than findings, and a
dead branch in `normalize` was found by inspection rather than by the pass — the
record in `design.md` does not credit the pass with it.

**The independent verification pass then found eleven defects in the slice's own
verification, and this is the part worth carrying forward.** The apply-stage record
claimed the assertions were falsified; several were falsifiable *in principle* and had
never actually been tried. Concretely:

- **The load-bearing assertion of the whole slice was vacuous.** The test proving
  `mailbox-session`'s "reaches no network directly" held an **alias** of the
  recorder's live array, so `reset()` emptied the alias and the comparison was the
  array against itself. A mutation making the session issue an extra request passed.
  The recorder now returns a snapshot, which removes the class rather than the
  mistake.
- **A tautology in the client**, `expect(x.trim()).toBe(x.trim())`, was the *only*
  coverage for "the address is exposed as text".
- **Five of eight failure codes had no render test**, so the claim that each branch is
  a different instruction was untested — replacing three branches' copy with another
  branch's kept the suite green.
- **Two scenarios were uncovered**: a reload losing the session, and the conditional
  provider-selector one, whose `WHEN` never fires and so had nothing asserting it.
- **Three boundary rules were wrong on arrival** — see `AGENTS.md`; the framework rule
  matched three of four import forms, the collection rule checked only `apps/`, and
  five documents claimed the compiler blocked `navigator` when it does not.
- **Two claims in this change's own documents were false**: `design.md` said the
  website had no DOM test (it now has 33), and the recording-transport zero was
  described as a measurement while it compared an array with itself.

**Re-verification:** 21 further mutation attempts against the repaired assertions, 19
`CAUGHT`, every file restored byte-identical. The 2 that were not are recorded with
their reasons in `design.md` — one is statically unreachable and is the compiler's
guarantee rather than a test's, and one was a no-op mutation. Two earlier
`NOT-CAUGHT` results were faults in the mutations and were re-authored.

**Result for slice 1: 382 tests across 21 files, 23 boundary assertions, `pnpm verify`
exit 0.** (Those were slice 1's figures. The workspace now runs **545 tests across 26
files** with **42** boundary assertions — see the Project Status cursor above.)
**Still not established, as of slice 3:** that a real browser reaches Guerrilla Mail.
**No live browser run of the website has ever been made** — every component in it has
been seen by jsdom and by nothing else, including `MessageView`. Every provider
interaction in every test replays a recording, so nothing here says what a real
provider does when a real page opens a real message. The polling cadence has **never
run against a live provider**. And `pnpm test` is not a claim about types — this
repository has been bitten in both directions, and slice 3 was no exception.
**M5's slices:** the inbox with polling was slice 2, the message view slice 3, and the
provider line slice 4 (`provider-reachability`), which settled the selector. History,
theme, and clear-data are not M5's to build – each depends on a later milestone, and
the acceptance table below names which.
**Slice 3's sync and archive have merged**, so the gate that held the next slice is open.
*Corrected 2026-10-04:* this line previously read "No slice of M5 may begin until slice
3's sync and archive have merged". That was true when written, and a **lifted barrier
left in place is worse than no barrier**, because it still reads as one — it would have
sent the next session looking for a merge that had already happened.
*Corrected 2026-10-02:* an earlier revision of this line named the next milestone
"Storage Contracts". That was wrong, and it is worth recording why, because it is the
same failure this repository keeps meeting in a different costume — **naming a
milestone from the layer it felt should come next rather than from the roadmap.**
IndexedDB storage is **M6** ("Website Hardening"), and M5 is the first user-facing
experience: auto-created mailbox, address shown, copy, receive, open, read the OTP.
Storage arrives a milestone later because M5's mailbox history is in-memory, which is
a real limitation and is stated in the M5 acceptance criteria rather than designed
around here.
**M4 completed its
full lifecycle**: propose PR #22 (`ef56f33`), apply PR #23 (`7742545`), verification
repairs PR #24 (`8260cef`), sync PR #25 (`6c9c1e2`), archive PR #26, archived at
`openspec/changes/archive/2026-10-02-mail-parsing-engine/` with its delta promoted to
`openspec/specs/mail-parsing/spec.md` - **9 requirements, 31 scenarios** - of which
**three scenarios were added by the verification pass** because it found real
requirement gaps rather than merely implementation defects.

**The archived delta and the promoted spec therefore differ, and the difference was
measured rather than assumed.** Extracting from the first `### Requirement:` in each
file and comparing: **9 requirements in both, 28 scenarios in the archived delta against
31 in the promoted spec**. The three extra are the verification pass's. They were
written into the promoted spec at sync rather than back into the change's delta,
because the change was already applied and its delta is the record of what it
originally proposed. So `openspec/specs/` is the source of truth for what is
**required**, and the archived delta is the record of what the change **asked for** -
a real gap, and one a later reader should read as "the verification pass strengthened
this" rather than "the archive lost something".
**The M4 verification pass found a defect that had been green since M3 and one that
was a stated capability with nothing behind it.** The architecture `fetch` rule passed
`pattern.source` to a helper doing a literal substring match, so it searched for the
text `(?<![\w.$])fetch\s*\(` — which appears in no source file. **Only
`globalThis.fetch` was ever matched; a bare `await fetch(url)` was invisible to it.**
That was the main form, and three documents had claimed it was proven able to fail. The
`date` reducing shape was published in `design.md` D4 as one of eight shapes, and
deleting it left all 291 tests green, because the one input where it fired also matched
`phone` and `year` and the penalty cap hid the difference. Both are the same defect
class as the eight before them, and the first is a **ninth instance** - worse than the
others, because it predates the milestone that documented it. Six warnings were repaired
with it, including a published test count that was arithmetically wrong (14 fixtures × 2
generated tests is 28, not 26) and four `D4` shape descriptions that overstated their own
reach. **307 tests across 18 files** after the repairs; no published confidence constant
was changed. (That figure was M4's. The workspace now runs **545 tests across 26 files**
— see the Project Status cursor above.)
**M4's implementation found three defects in its own design before any of it was
verified**, and all three are recorded in the change rather than quietly fixed:
the phone-number reducing shape was **structurally incapable** of detecting a phone
number and was penalising every 7- and 8-digit code instead; same-block association
**could not rank the two message shapes the roadmap names** (a code in its own
paragraph, a code beneath a heading), which forced a narrow widening recorded in
`design.md` D3 and D8; and a link introduced by the sentence in the paragraph above it
was **missed entirely**, which is how the password-reset fixture lost its most useful
link. A fourteenth corpus fixture was added beyond the roadmap's thirteen because
without it none of that was measured.
**M3 completed its
full lifecycle**: propose PR #17 (`7f20877`), apply PR #18 (`fe54b22`),
verification repairs PR #19 (`ede63bb`), sync PR #20 (`ffdaa13`), archive PR #21,
archived at `openspec/changes/archive/2026-10-02-provider-layer/` with its delta
promoted to `openspec/specs/provider-adapters/spec.md` - 12 requirements,
30 scenarios - and **three of those scenarios amended during sync** after the
implementation revealed the original wording to be unsatisfiable.

M2's lifecycle was propose PR #12, apply PR #13, verification repairs PR #14, sync
PR #15, archive PR #16 (`49b1bfa`), archived at
`openspec/changes/archive/2026-10-02-shared-domain-model/`.

M3 added a capability, not a feature. **No client consumes `packages/providers`**, so
the site and the spike were untouched by it and no test can assert a user-visible
outcome. `openspec validate --specs --strict` reports **5 passed, 0 failed**, and
**no active OpenSpec change remains**.

**The M3 verification pass found two requirement scenarios with no implementation
behind them, after apply had ticked every box.** Recorded because the pattern is
the point: ticking a task is not the same as implementing its verification clause.

1. **CRITICAL.** *Optional capabilities are discoverable, not assumed* requires an
   unsupported operation to be reported as `UNSUPPORTED_OPERATION` naming the
   operation. Nothing implemented it. Invoking `guerrilla.destroyMailbox(...)`
   raised `TypeError: provider.destroyMailbox is not a function` - not a
   `SpectreError`, so no layer knowing only the closed error vocabulary could
   catch, present, or recover from it. Repaired by
   `packages/providers/src/operations.ts`; proven load-bearing twice.
2. **CRITICAL, and structurally invisible.** *The provider layer does not persist
   anything* had **no behavioural test**. Every test in the package built a fresh
   adapter per call, so an adapter that cached the first mailbox's credentials
   would have passed all 80 tests - the cache would never be read by a test handing
   over a different mailbox. Repaired with one test per adapter driving a single
   adapter instance across two mailboxes; both proven load-bearing by injecting a
   real cache into each adapter.

   The first injection attempt was itself defective - it assigned the token before
   returning it, so behaviour was unchanged and the new test passed while a
   *different* test failed. A mutation that does not introduce the defect proves
   nothing about the assertion it is meant to test.

### M3 decisions, recorded so M4 builds against them rather than re-deciding

- **The contract has no subscription method at all** - not optional, absent.
  Measured: five SSE candidate paths and two WebSocket candidates were probed and
  none connected. `GET /messages/events` answers `406` for
  `Accept: text/event-stream` and `404` for every format its negotiator accepts,
  while Mail.tm's marketing copy claims SSE is available. An optional method is
  still a method: a caller that checks for it and finds it absent still has to
  handle absence. Messages arrive by the caller polling.
- **Transport is constructor-injected; there is no module-level `fetch` in
  `packages/providers`**, asserted by `tests/architecture/boundaries.test.ts`.
  Neither a web page nor an MV3 service worker lets a test intercept `fetch`, so
  without the seam verifying an adapter means contacting a third party and the
  suite fails whenever that provider is down or rate-limiting - turning their
  availability into this repository's CI status.
- **Credentials are generated client-side inside the adapter**, via an injected
  random source, and the domain is fetched once per creation because `GET /domains`
  is `30; w=60` while `POST /accounts` is `1; w=60`.
- **The dead-session check is provider-specific and mandatory.** Guerrilla's
  liveness test is whether the response still names the mailbox's own address,
  because a session it no longer honours answers `HTTP 200` with an empty list, no
  `error`, and `auth.success` still `true`. Best-effort detection of one known
  trap, not proof of liveness.
- **Mail.tm deletion follows the hydrated `@id`** - measured **relative**
  (`/accounts/{id}`), resolved to absolute once and stored as `Mailbox.id` - never
  a constructed path.
- **Rate-limit headers are captured verbatim onto `RATE_LIMITED` and never
  parsed.** `1; w=60` states a limit and a window and nothing about what it is per.
  Whether that limit is per-IP or per-account **remains unverified** and no product
  code asserts either.
- **The manager is consulted only at creation.** Fallback honesty is structurally
  guaranteed because M2 derives `Mailbox.provider` from the credential
  discriminant, so a Guerrilla mailbox cannot be reported as a Mail.tm one.
- **`deleteMessage` and `destroyMailbox` are optional, plus a required
  `supports(operation)`**, so absence is discoverable as a question rather than an
  exception. Neither was observed to work on Guerrilla; that is **unverified**, not
  proven unsupported.
- **An unclassifiable failure keeps the provider's own description** and becomes
  `UNKNOWN_PROVIDER_ERROR`. A `422` is deliberately *not* `UNSUPPORTED_OPERATION`:
  it means Mail.tm refused the address we generated, not that the provider lacks a
  capability, and the difference decides whether the user or we own the fault.

**Two of these replaced assumptions in the M3 task plan, and the reason is
recorded rather than quietly corrected.** The plan asserted a Mail.tm bearer `401`
means bad credentials; measurement says a deleted mailbox and a bad token **both**
answer `401` with the same body, so the adapter reports `MAILBOX_EXPIRED` and the
shared conformance suite accepts either code - demanding one specific code would
force it to tell a user to check a credential they never entered. The plan also
mapped a validation rejection to an unsupported operation, which would have been
confidently false.

**M3 findings, recorded during apply and during verification:**

- **A fourth check narrower than its documented rule.** The boundary test's
  provider-adapter list held `MailTmProvider`, `GuerrillaMailProvider`, and
  `SpectreMailProvider` - **none of which had ever existed**. M3's exports are
  `createMailTmAdapter` and `createGuerrillaAdapter`, so the rule stayed green
  while guarding nothing: a list of identifiers nothing references cannot fail.
  Widened to the real exports plus a `create*Adapter` shape match. This is the
  third milestone in a row to produce one (M1 twice, M2 twice), which is why the
  falsification pass is a task rather than a habit.
- **Two new checks initially fired on their own documentation** - the contract test
  matched the word `subscribe` in the prose explaining its absence, and the `fetch`
  rule matched `fetch(` inside a doc comment. Both fixed by stripping comments
  before matching, not by rewording prose until the rule went quiet.
- **A test written to be falsifiable stayed vacuous on the first attempt.** The
  initial proof run showed the suite green after adding a `subscribe` member,
  which proved no check existed for it. The absence of a member is not observable
  at runtime, so the check is now a source scan *and* a compile-time assertion -
  `pnpm typecheck` fails if `subscribe` becomes a key of `MailProvider`.
- **16 deliberate violations, all caught**, every file restored byte-identical:
  nine against boundary and contract rules, seven reverting a required behaviour.
  One of the nine came back **green**, because the assertion did not yet exist. A
  check that does not exist cannot be falsified, so it has to be written before the
  pass rather than after it.
- **Recorded rather than repaired, so it is a decision and not an oversight.**
  `Mailbox.id` for Mail.tm is the absolute provider resource URL, and a message id
  is the provider's own - so provider identifiers *are* required by one call, which
  reads against the delta's "provider identifiers SHALL NOT be required by any
  caller". Not repaired because `Mailbox.id` is M2's design and deletion depends on
  the adapter holding the provider's own resource URL. The realised risk is a
  caller *parsing* that value, and nothing in the workspace does.
- **Recorded rather than repaired: the delta's auth wording needs amending at
  sync.** "A provider rejects the supplied credentials SHALL be reported as an
  authentication failure" holds only where the condition is decidable. Mail.tm
  answers `401` for a refused credential *and* for a deleted mailbox, with the same
  body, so a bearer `401` reports `MAILBOX_EXPIRED` and only the token exchange
  reports `AUTH_FAILED`. The requirement must distinguish those two moments.

**Still unverified after M3, and deliberately so:** the live MV3 host-permission
check; whether Mail.tm's `1; w=60` is per-IP or per-account; whether Guerrilla
supports deletion at all; Guerrilla's real mailbox lifetime; and whether the
recorded fixtures still match the live providers. **No test contacts a live
provider**, so the suite proves this repository's mapping of a wire format and
nothing about a provider's current behaviour.

**Verification found a gate that was failing and being recorded as passing.** On
Windows - the environment `AGENTS.md` declares supported - `pnpm format:check`
failed on 34 files and `pnpm verify` exited `1`. Cause: `.prettierrc.json` pins
`endOfLine: "lf"` but the repository shipped no `.gitattributes`, so the
working-tree line ending came from `core.autocrlf`, which stock Git for Windows
sets to `true` in the system gitconfig. CI stayed green across three runs because
`autocrlf` is inert on Linux. Fixed by `.gitattributes` (`* text=auto eol=lf`).

Worth preserving as a process lesson: **every gate that executes code passed.**
The defect was only visible by reading the recorded results against the declared
environment. That is precisely what an independent verification pass is for, and
it is why task 8.11 exists rather than being a formality.

The same pass also found two boundary assertions that were **narrower than the
rule they claimed to enforce** - the import rule missed dynamic and bare
side-effect imports, and the adapter rule was scoped so root-level and `tests/`
modules could name an adapter freely. Both are widened and the previously
escaping cases are now proven to fail.

**OpenSpec change:** `monorepo-foundation`, now archived at
`openspec/changes/archive/2026-10-02-monorepo-foundation/` - proposed 2026-10-02
(PR #7); apply PR #8 (`5ad51d7`); verification repairs PR #9 (`41da7b2`); sync PR
#10 (`f69ab38`); archive PR #11. Establishes the pnpm workspace, the planned
structure, shared TypeScript configuration, linting, formatting, a test runner, CI,
and root commands, and adds the `monorepo-foundation` and `build-and-verification`
capabilities. Both are **live** in `openspec/specs/` alongside `provider-abstraction`.
All three validate strict: 5, 6, and 9 requirements respectively.

The sync also **amended the `build-and-verification` delta** with two scenarios,
because the defect it exposed was a gap in the requirement rather than only in the
implementation:

- *A maintainer verifies on the declared supported platform.* A check whose
  result depends on anything outside the command itself - the working-tree line
  ending, the shell, the filesystem - SHALL have that pinned by a committed
  config rather than inherited from each contributor's local settings. The
  original wording covered the *directory* a command runs from but not the
  platform, which is precisely how a green CI run coexisted with a permanently
  red local gate.
- *An assertion passes for the wrong reason.* Each assertion SHALL have been
  observed to fail when its prohibited condition is introduced, and a check
  narrower than the rule it documents is a failure of this capability rather
  than a passing check.

`provider-role-decision` is archived at
`openspec/changes/archive/2026-10-02-provider-role-decision/` (PRs #4, #5, #6),
and M0's `m0-provider-spike` is archived at
`openspec/changes/archive/2026-10-02-m0-provider-spike/` (PR #2).

| Milestone | State | Notes |
|---|---|---|
| M0 Provider Compatibility Spike | **archived** | Real external delivery observed on **both** providers. Provider roles decided. Long-run expiry still unverified (no provider exposes a TTL in its API). Gate satisfied. |
| Provider-role specification | **archived** | Documentation and specification only. No product code. `provider-abstraction` is a live capability spec: 9 requirements, 18 scenarios. |
| M1 Monorepo Foundation | **archived** | Change `monorepo-foundation` archived as `2026-10-02-monorepo-foundation` (PRs #7-#11). Structure and tooling only: no product behaviour, no extension build, no visual design. A verification pass found a failing format gate that was being recorded as passing; repaired and proven from a clean clone. Three live capability specs. |
| M2 Shared Domain Model | **archived** | First milestone to add product code. Adds a **Vitest** include entry for package tests, deliberately not a **workspace** glob change - that separation is what keeps the M0 spike structurally unimportable, and it was re-proven after the change. 54 unit tests in `packages/core`; 7 boundary assertions. |

**M2 design decisions, recorded so M3 builds against them rather than re-deciding:**

1. `Mailbox` stays **monomorphic**. The roadmap's shape carries both `provider`
   and `credentials` with nothing correlating them, and M3's contract reads
   credentials off the mailbox. Agreement is enforced at a single construction entry
   point that derives `provider` from the credential discriminant. Making
   `Mailbox` generic was rejected: it would force a type parameter through M3's
   provider contract, storage, and every React prop to buy a correlation available
   once at construction.
2. Credentials are **discriminated and normalised**: `accountId`/`accessToken`
   and `sessionId`, never a provider's own field name.
3. `expiresAt` is retained but **observed-only**. No provider reports a mailbox
   lifetime in any API response, so absence is the normal case and the field must
   never be computed.
4. `confidence` stays a plain `number` with a specified `0..1` range, validated
   where a detection enters the model. Branding it now would buy nothing observable
   while nothing produces these values.
5. Required message fields **may be empty strings**; absence stays distinguishable
   from emptiness.

**M2 falsification found two checks that were green while not doing their job.**

1. The provider-wire-format scan was scoped to `apps/` only, so `packages/core` - the
   package whose entire purpose is to be free of it - was uncovered. Scope widened to
   every workspace package except `packages/providers` and `*.test.ts`. The widened
   scan immediately caught one real violation, a comment in `packages/mail-parser`
   quoting a provider field name; the comment was reworded rather than the rule
   narrowed.
2. `MailboxProviderAgreement` rejected a mismatched literal as designed - and also
   rejected every well-formed mailbox, resolving to `never`. The cause is structural:
   a non-generic `Mailbox` stores credentials as the whole union, and a union never
   `extends` a single provider literal. The first falsification run looked green
   because the bad literal *was* rejected, for the wrong reason. Replaced by a generic
   `AssertProviderAgreement<T>` with distribution suppressed, and the negative proof was
   re-run with a **positive control** added - four negative cases cannot distinguish a
   strict assertion from a useless one.

That is now three times this repository has produced a check narrower or broader than
the rule it documented. The habit it produces is the point: prove each assertion can
fail, and prove the correct case still passes.

**M3 added a fourth and a fifth.** The adapter-identifier rule named three
identifiers that never existed, so it could not fail (fixed in `Project Status`
above). And the very first M3 falsification run came back **green** after adding a
`subscribe` member to the contract - proving no check existed for the requirement
M3 had just written. A check that does not exist cannot be falsified, so it has to
be written before the pass, not after.

| M3 | complete (archived) | `provider-layer` |
| M4 | **complete (archived)** | `mail-parsing-engine` |
| M5 | **complete in scope** - slices 1-4 archived; its three remaining acceptance lines are M6's or M10's | `mailbox-session-layer` (slice 1), `inbox-polling` (slice 2), `message-view` (slice 3), `provider-reachability` (slice 4) |
| M6-M15 | not started | - |

**OpenSpec lifecycle stage:** M0, the provider-role change, M1's foundation change,
M2's `shared-domain-model`, M3's `provider-layer`, M4's `mail-parsing-engine`, M5
slice 1's `mailbox-session-layer`, slice 2's `inbox-polling`, slice 3's `message-view`
and slice 4's `provider-reachability`
**are all complete (propose -> apply -> verify -> sync -> archive)**. `mailbox-session-layer`
was archived at `openspec/changes/archive/2026-10-02-mailbox-session-layer/` with its two
promoted specs already written by the sync stage, so the archive ran with `--skip-specs` -
running it without that flag would have applied the same requirements twice. Slice 2's
`inbox-polling` was archived the same way, and so was slice 3's `message-view`, at
`openspec/changes/archive/2026-10-04-message-view/`. Slice 4's
`provider-reachability` was archived at
`openspec/changes/archive/2026-10-04-provider-reachability/`, also with
`--skip-specs`, and its `MODIFIED` requirement was promoted by the sync stage as
**PR #43** (apply: **#42**).

**A `MODIFIED` sync is verified by a different command than an `ADDED` one**, and
getting that wrong looks like a validator bug rather than a mistake. After slice 4's
sync, `openspec validate provider-reachability --type spec --strict` failed with
`ENOENT` - correctly, because the change modified an existing capability instead of
promoting a new one, so there is no `openspec/specs/provider-reachability/`. The
verification that applies is `openspec validate website-client --type spec --strict`,
which passes, alongside `openspec validate --specs --strict` at **8 passed, 0 failed**.
`AGENTS.md` documents the *other* half of this gotcha - a bare name matching **both** a
change and a promoted spec, resolved with `--type`; this is its mirror, and the rule
that resolves it is to ask which capability the change named rather than what the
change is called.

**No active change.** Task 8.11 - the independent vacuity check - was the step that surfaced the
defect above, and is ticked because the check was performed and it found something.
M3's own verification pass found two more, and **M4's verification pass found two
CRITICAL and six warnings**, so the task keeps earning its place on a schedule that has
now surfaced a defect in four consecutive milestones.

**One of M4's verification scenarios is a rule for writing future specs**, and it is the
change's most transferable result: *every reducing shape must be reachable on its own.*
The `date` shape was published as one of eight while being invisible, because the only
input where it fired also matched `phone` and `year` and the penalty cap hid the
difference. `design.md` D4 had already named that hazard in its own words, and `date`
was the sentence's unheeded example.

**M4's falsification pass found two more, and both are the same failure in a new
shape.** The first was the total-penalty cap test, which asserted that a candidate
matching three reducing shapes scores the same as one matching two. With the cap
deleted, both scores fell through zero and clamped to the same floor, so **the equality
still held and the suite stayed green** - the assertion survived deletion of the exact
thing it was written to pin down. Every earlier instance in this repository was a rule
failing to cover a case; this one was a case covered by a comparison that could not tell
the right reason for equality from a wrong one. The second was the newsletter corpus
expectation, rewritten during apply because it demanded a result the parser is forbidden
from producing.

**Next required change:** finish `mail-parsing-engine` (verify, sync, archive).

**M1 as built, for the next milestone's benefit:**

- The M0 spike is **deliberately outside the workspace** (`pnpm-workspace.yaml`
  lists `apps/*` and `packages/*` only). It keeps its own lockfile, and root
  `pnpm install` does not install it. This makes "product code must never import
  the spike" structurally impossible rather than documented. **M2 and M3 must not
  add `tests/` to the workspace globs.** The spike is not deleted; retiring it is
  M3's decision once real adapters exist.
- Shared packages are consumed **as TypeScript source** (`exports` points at
  `./src/index.ts`). There is no per-package build and no bundler, so
  `pnpm build` builds the website only and package correctness is established by
  `pnpm typecheck`. Revisit when a non-Vite consumer appears.
- `packages/providers` **is** implemented as of M3: the `MailProvider` contract,
  the Mail.tm and Guerrilla Mail adapters, the shared conformance suite, the
  provider manager, and the injected transport seam. Both adapters pass the same
  conformance suite with **no per-provider exemption** - an exemption is the
  mechanism by which a conformance suite quietly stops meaning anything.
- The remaining placeholder packages contain no behaviour and no stub exports:
  storage (M6) and UI (M7+). Exactly as the roadmap schedules them. **M5 is Website
  Core MVP and contains no storage package** — it is the first user-facing milestone
  and its mailbox history is in-memory by design of the milestone ordering.
- The architecture boundaries are enforced by `tests/architecture/boundaries.test.ts`,
  not merely documented. Each assertion was proven able to fail. **Any new code
  must keep it passing** - in particular, no provider JSON field name may appear
  outside `packages/providers`, provider adapter identifiers and
  adapter-shaped identifiers may only appear there, and no module in
  `packages/providers` may reach the global `fetch`.
- `vitest.config.ts` scopes `include` to `tests/architecture/**/*.test.ts` and
  `packages/*/src/**/*.test.ts`, and leaves `passWithNoTests` off. The package glob
  is deliberately package-shaped: a test at the repository root or under `tests/`
  outside `architecture/` is **silently skipped**, verified by observing the
  collected count unchanged with such a file present. Never widen either glob to
  `tests/**`, or the root test command could begin executing the spike harness.

**Open items carried forward:**

- **Mail.tm publishes no terms page** (verified 2026-10-02). No attribution,
  resale, or quota obligation may be asserted or denied until real terms are
  located. See `docs/PROVIDERS.md` section 2.
- **The live host-permission check is deferred, not done.** The measured fact
  stands: `https://api.mail.tm/*` is the required wildcard form and
  `https://api.mail.tm` silently grants nothing. The check needs extension and
  browser-test infrastructure that does not exist, so it is recorded against the
  milestone that owns that infrastructure. M1 claimed no result for it and built
  no throwaway production code to satisfy it. `apps/extension` has no manifest at
  all, which is why the trap cannot currently be hit.
- **CI is green but unexercised against real change.** `.github/workflows/ci.yml`
  ran green on 2026-10-02 (run `36935477321`; `verify` and `spike self-test`
  both SUCCESS), which confirms it works on a clean Linux runner with the pinned
  Node and action versions. It has never yet been made to *fail*, so its
  ability to catch a regression is unproven. Treat the first real red run as
  unverified behaviour.
- **The Guerrilla dead-session trap has no requirement.** It is deliberately
  deferred to the mailbox-lifecycle capability, not overlooked. Note that
  `packages/storage/src/index.ts` records why the `SpectreStorage` contract must
  be able to represent "session gone" distinctly from "no messages".
- **Delivery reputation is proven from one sender.** Providers that commonly
  blocklist disposable domains are untested.

**Open items carried forward into M1 and beyond:**

- **Mail.tm publishes no terms page** (verified 2026-10-02). No attribution,
  resale, or quota obligation may be asserted or denied until real terms are
  located. See `docs/PROVIDERS.md` §2.
- **The live host-permission check is deferred, not done.** The measured fact
  stands: `https://api.mail.tm/*` is the required wildcard form and
  `https://api.mail.tm` silently grants nothing. The check that exercises it
  needs extension and test infrastructure that does not exist, so it is recorded
  against the milestone that owns that infrastructure. M1 must not claim a result
  for it, and must not build throwaway production code to satisfy it.
- **The Guerrilla dead-session trap has no requirement.** It is deliberately
  deferred to the mailbox-lifecycle capability, not overlooked.
- **Delivery reputation is proven from one sender.** Providers that commonly
  blocklist disposable domains are untested.

**Last updated:** 2026-10-02

**Evidence:** `docs/PROVIDERS.md`, produced from spike run
`2026-10-01T18-08-41-251Z` — 36 probes: 26 passed, 6 failed, 3 unsupported,
1 unverified, **including a real external message observed on both providers**.
Re-run the spike before relying on any of it; provider behaviour and terms
change.

### Planning assumptions that M0 disproved

These are recorded because the roadmap below still contains them in several
places. **The observed behaviour wins.** Do not build later milestones on the
original assumption.

| Roadmap assumption | Observed reality |
|---|---|
| Mail.tm is the primary provider for the website | `api.mail.tm` sends `Access-Control-Allow-Origin` only to `https://mail.tm` and `https://api.mail.tm`. A page on our own domain **cannot read it at all**, verified in a real browser. SpectreMail does not proxy provider APIs to work around an origin restriction, so there is no workaround by policy. Mail.tm is currently **extension-only**. |
| Guerrilla Mail is the fallback, usable where technically reliable | Inverted. Guerrilla Mail works from a normal web page *and* an extension; it is the only provider the website can use today. |
| "Generate mailbox: 1 action or automatic", "Open app → usable email: a few seconds" | Mail.tm returns `ratelimit-policy: 1; w=60` on `POST /accounts` — **one mailbox per 60s window**. The header does not state its scope, so "per IP" was inferred and is not evidenced. Seconds-long generation is not achievable on Mail.tm. |
| "SSE subscription if stable" (M3) and "SSE where reliable" (M6) | Mail.tm has **no working real-time transport**. Five SSE candidate paths returned 404/406 and no WebSocket accepted a connection, despite the provider's marketing claiming SSE. **Adaptive polling is the only option.** |
| Extension requests host permissions for the provider | Silent-failure trap, measured: `https://api.mail.tm` is accepted into the manifest and grants **nothing**; `https://api.mail.tm/*` works. The extension must use the `/*` form and must test it. |
| Mailbox expiry has a knowable TTL | **Unmeasured.** Mail.tm's FAQ publishes a 7-day message retention and a no-expiry mailbox statement, but neither value appears in its API and neither was verified live; Guerrilla publishes nothing equivalent. `MailboxStatus: expired` must still follow an observed signal. |
| A harness that reports `unverified` is reporting a provider limitation | **False, and it bit us.** Run `2026-10-01T17-35-14-033Z` reported both delivery checks `unverified` because of two defects in the spike itself: the Mail.tm mailbox was deleted (token revoked → `GET /messages` returns `401`) before delivery polled it, and the Guerrilla address printed to the maintainer was stale after `set_email_user`. Neither was a provider behaviour. Fixed, with an abort-on-`401` guard. |
| A real external verification message can be observed during the spike without a maintainer-supplied credential | **Resolved by maintainer action.** Run `2026-10-01T18-08-41-251Z` observed a real message on both providers. No credential-free *sender* exists, so this always required one manual send. |

### Decision: provider roles (2026-10-02)

Recorded because M0 disproved the roadmap's provider assignment and a
maintainer decision was required to continue.

```text
website:
Guerrilla Mail only

extension:
Mail.tm (primary) + Guerrilla Mail (fallback)
```

Rationale: `api.mail.tm` grants CORS only to its own origins, and its terms
forbid proxying, so no compliant design lets a SpectreMail web page read it.
Mail.tm remains fully functional from an MV3 extension context, where host
permissions bypass CORS, so it stays in scope for the extension. The website
ships on the single provider it can actually reach rather than on a proxy.

Consequences for later milestones:

- The website's provider adapter surface is Guerrilla-only in V1. It must still
  go through the same provider abstraction, so adding a second web-capable
  provider later is additive, not a rewrite.
- The extension carries the provider-fallback logic. The website has no
  fallback path until a second web-reachable provider exists.
- Mail.tm attribution is an **extension-only** obligation **if** it exists. No
  attribution term could be verified (see `docs/PROVIDERS.md` §2), so this is
  carried as an open item, not a requirement.
- Mail.tm's `POST /accounts` limit of 1 per 60s window caps extension mailbox
  creation throughput and must be surfaced, not silently retried.

This decision is now **specified** as behaviour, not just recorded here, by the
`provider-abstraction` capability (`openspec/specs/provider-abstraction/spec.md`).
It states the roles above, plus the measured constraints M0 found — untrustworthy
content type, no working push transport, `1; w=60` account-creation throttling, the
wildcard host-permission form, and the absent mailbox TTL. M3 and the client
capabilities must be written against that spec rather than against the superseded
assumption above.

### M0 gate status

> **Do not begin full UI work until Mail.tm successfully completes the complete
> receive-mail lifecycle.**

**Gate satisfied.** Run `2026-10-01T18-08-41-251Z` observed a real external email
arrive on **both** providers: Mail.tm at `spikemupulgy6gkia@uberip.com` (subject
"TEST", body "TEST M0") and Guerrilla Mail at
`spikemupull2b4vd@guerrillamailblock.com` (body "test m0", delivered as raw
HTML). The complete receive-mail lifecycle is therefore proven with a real
message, not inferred.

This gate was previously reported as **unsatisfied** because the delivery probes
were structurally incapable of passing. Two harness defects caused that — the
Mail.tm mailbox was deleted before delivery polled it (revoking the token), and
the Guerrilla address printed to the maintainer was stale after a rename. Both
were measured against the live API, both are fixed, and both poll loops now abort
and report a harness fault when their own preconditions are unmet — using the
signal each provider actually returns: `401` for Mail.tm, and an `error` key with
no `list` for Guerrilla, whose `auth.success` is `true` even when the session is
dead. These guards are provider-specific and must not be generalised to a provider
that has not been measured the same way. See `docs/PROVIDERS.md` §5.1.

**What remains open.** Long-run expiry is unmeasured for both providers.
Mail.tm's FAQ publishes a 7-day message retention and a no-expiry mailbox statement,
but neither value is in its API and neither was measured live, so
`MailboxStatus: expired` must still follow an observed signal rather than a
horizon. And delivery is proven from a single sender; reputation with providers that
commonly blocklist disposable domains is untested. Both are now carried into the
`provider-abstraction` spec rather than treated as settled.

### Additional provider facts that change later milestones

- **Guerrilla sessions are `sid_token` based, not cookie based.** The provider
  sets `PHPSESSID` but sends `Access-Control-Allow-Origin: *` with no
  `Access-Control-Allow-Credentials`, so a browser cannot send the cookie
  cross-origin. The body-returned `sid_token` is the only workable carrier.
  Persist the token, never a cookie.
- **An unrecognised Guerrilla session is not rejected.** It returns `200` with
  an empty inbox and no auth error, so an expired stored session is
  indistinguishable from a genuinely empty mailbox. The core mailbox manager
  must detect this explicitly.
- **Guerrilla message bodies are raw HTML** while declaring `content_type:
  "text"`. Declared content type must never be trusted; raw HTML must never be
  rendered.
- **mail.tm's terms could not be located.** No terms page exists and the FAQ is
  silent on attribution, resale, proxying, and quota. Whether an attribution
  obligation exists is therefore **unknown**, not "required" and not "absent".
  Anything depending on it is blocked until the real terms are found.

---

## 1. Product Direction

SpectreMail is an accountless temporary-email product designed around one core promise:

> **Temporary email without interrupting what you're doing.**

The standalone website will prove and expose the mailbox engine. The browser extension will become the differentiated product by allowing users to generate disposable addresses, receive verification messages, detect OTPs, and continue signup flows without repeatedly switching tabs.

The project must be built so that the website and extension are **two clients of the same shared SpectreMail core**, not two separate implementations.

The long-term target interaction is:

```text
Website asks for an email
        ↓
User chooses SpectreMail
        ↓
Temporary address is inserted
        ↓
Website sends a verification email
        ↓
SpectreMail receives it
        ↓
OTP or verification link is detected
        ↓
User copies/fills the code
        ↓
Signup continues
```

---

## 2. Core Product Principles

1. **No SpectreMail account required in V1**
   - No login
   - No OAuth
   - No cloud profile
   - No personal email required

2. **Local-first SpectreMail state**
   - Mailbox metadata
   - Provider credentials/session data
   - Recent mailbox history
   - User settings
   - Future site-to-mailbox mapping in the extension

3. **Provider-independent architecture**
   - Mail.tm and Guerrilla Mail must sit behind adapters
   - UI components must never directly depend on provider-specific response formats
   - Future providers must be replaceable without rewriting the product

4. **Safe email handling**
   - Incoming email is untrusted
   - Do not render raw provider HTML directly
   - Prefer safe text extraction for V1
   - Do not load remote email images by default
   - No attachments in V1

5. **Useful without AI**
   - OTP detection must be deterministic
   - Verification-link detection must be deterministic
   - AI is not a dependency for core functionality

6. **Minimal permissions**
   - The extension should request only permissions required by active features

7. **No disposable-domain evasion**
   - If a website rejects a temporary-email domain, SpectreMail reports it
   - SpectreMail will not attempt to bypass or conceal temp-mail restrictions

8. **Website-first, not website-only**
   - The website exists to prove the mail engine and provide standalone value
   - The browser extension is the long-term differentiation

---

## 3. Repository Architecture

The project should use one monorepo:

```text
spectre-mail/
│
├── apps/
│   ├── web/
│   └── extension/
│
├── packages/
│   ├── core/
│   ├── providers/
│   ├── mail-parser/
│   ├── storage/
│   └── ui/
│
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md
│   ├── PROVIDERS.md
│   ├── PRIVACY.md
│   └── DESIGN_SYSTEM.md
│
├── tests/
│   └── fixtures/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── .gitignore
├── LICENSE
└── README.md
```

### Dependency rule

```text
apps/web ───────┐
                ├──→ packages/*
apps/extension ─┘
```

Shared packages must never import from `apps/web` or `apps/extension`.

### Shared packages

#### `packages/core`

Owns the normalized domain model and its invariants:

```text
normalized mailbox / message / credentials types
normalized error codes
credential construction
```

**Amended at M5 slice 1.** This list previously read "mailbox lifecycle", "provider
selection", "provider health", "mailbox manager", and "expiration logic". Those are
**runtime behaviour**, and `shared-domain-model`'s approved Purpose states this
capability describes "the model and its invariants only". Where a plan and an approved
spec disagree, the spec wins — so the behaviour moved to `packages/mailbox` below
rather than widening `core` from a type surface into a runtime one. This amendment is
made in the same change that moved the behaviour, so the roadmap does not sit here
disagreeing with the tree.

#### `packages/mailbox`

Owns client-side orchestration over the shared model. Added at M5 slice 1; polling and
per-message verdicts added at slice 2.

```text
mailbox session lifecycle (open / replace / retry)
provider health reporting
creation-failure normalization
inbox polling — adaptive cadence, throttle handling, per-message verdicts
```

It is **framework-free and DOM-free by compiler, not by convention**: its
`tsconfig.json` sets `lib: ["ES2023"]` with no `"DOM"`, so `window`, `document`, and
`location` fail to compile there. Placing it outside `apps/web` is what keeps M8's
extension from becoming a rewrite.

**The compiler's reach stops short of storage, and that limit was measured rather
than assumed.** An earlier revision of this line claimed `navigator` was blocked too.
Probing `tsc` name by name on 2026-10-02: `window`, `document`, `location`,
`indexedDB`, `caches`, and `history` are rejected, while `navigator`,
`localStorage`, and `sessionStorage` **compile** — `@types/node` declares them, and
`"types": []` does not exclude them. Node v26.10.0 additionally *defines* `navigator`
and `sessionStorage` at runtime. So a session that persisted itself would have
compiled and passed every other gate; the storage half is now held by a separate
boundary rule, which is the only thing holding it.

As implemented (verified 2026-10-02, `pnpm verify` exit 0, **34 tests**): the session
state is an immutable discriminated union — `creating`, `ready`, `failed` — rather
than a mailbox plus a loading flag, because those two can disagree and a
disagreement is a rendering bug no unit test writes itself. It performs **no request
of its own** (asserted by a recording transport, with a positive control that drives
the same operations through the real Guerrilla adapter so the zero is a measurement),
holds **no persistence** (M6), and **never invents
a mailbox lifetime** — no provider reports one in any API response and none was
measured live.

#### `packages/providers`

Owns provider-specific code:

```text
MailTmProvider
GuerrillaMailProvider
future SpectreMailProvider
```

#### `packages/mail-parser`

Owns:

```text
safe text extraction
OTP detection
verification-link detection
message classification helpers
```

**As implemented in M4** (verified 2026-10-02, `pnpm verify` exit 0, **149 tests** in
the package): `extract.ts` (safe text plus each link's destination, visible text, and
the wording around it), `detect-codes.ts`, `detect-links.ts`, `scoring.ts`, `analyse.ts`,
and `fixtures/corpus.ts`. Detection is a **pure function of `Message.text`** - no
network, no clock, no AI, so it is fully verifiable offline.

Three findings from M4 that change what a reader should assume, all recorded in the
change:

- **The corpus is authored, not captured.** This repository has never received
  verification mail from any service. Every fixture carries a `synthetic: true` field
  and a note saying so; the two named after services carry an explicit statement that
  no mail from that service was received. All addresses use `.example`/`.test`.
- **No detection is reported as certain.** The maximum is `0.85` for a code and `0.70`
  for a link, by construction rather than by clamp alone.
- **A reducing shape is a penalty, never an exclusion.** A copyright year, an order
  number, and a price are all still *returned*, ranked last. A newsletter therefore
  yields one low-ranked candidate rather than none, and the requirement was amended
  during apply because it had demanded the impossible.

**No client consumes this package yet** — nothing user-visible depends on the parser.
That changed at M5 slice 1 in the other direction: `apps/web` now creates a mailbox
and renders its address, consuming `providers` and `mailbox`. The parser still has no
consumer, because reading a message is a later slice. `apps/extension` has no
manifest.

#### `packages/storage`

Owns shared storage contracts and platform adapters:

```text
SpectreStorage interface
Web IndexedDB adapter
Extension storage adapter
```

#### `packages/ui`

Owns reusable product UI:

```text
buttons
mailbox card
provider badge
status dot
message row
OTP component
verification-link component
design tokens
```

Do not move marketing-only website sections into the shared UI package.

---

## 4. Recommended Initial Tooling

### Workspace

- pnpm workspaces
- TypeScript
- ESLint
- Prettier
- Vitest
- Playwright for browser-level tests

### Website

- React
- TypeScript
- Vite

### Extension

- React
- TypeScript
- Manifest V3
- Prefer a modern extension build framework if it clearly improves Chrome/Firefox maintainability
- Do not add a heavy framework before extension work actually begins

### Root scripts target

```bash
pnpm dev
pnpm dev:web
pnpm dev:extension
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Initially:

```bash
pnpm dev
```

should run the website.

---

# 5. Milestone Overview

| Milestone | Name | Primary Outcome |
|---|---|---|
| M0 | Provider Compatibility Spike | Prove real incoming mail works in target browser environments |
| M1 | Monorepo Foundation | Establish repository structure and tooling |
| M2 | Shared Domain Model | Define provider-independent mailbox/message types |
| M3 | Provider Layer | Implement Mail.tm + Guerrilla adapters (website: Guerrilla; extension: both) |
| M4 | Mail Parsing Engine | OTP + verification-link detection |
| M5 | Website Core MVP | Working temporary mailbox website |
| M6 | Website Hardening | Storage, errors, accessibility, security |
| M7 | Spectral Swiss Design Pass | Apply approved visual system |
| M8 | Extension Foundation | Manifest V3 shell + shared package reuse |
| M9 | In-Page Email Integration | "Use SpectreMail" inside email fields |
| M10 | Verification Workflow | Notifications + OTP copy/fill |
| M11 | Side Panel + Mailbox Context | Persistent inbox beside webpages |
| M12 | Release Hardening | Security, permissions, tests, docs |
| M13 | Public Beta | Website + Chromium extension |
| M14 | Cross-Browser Expansion | Firefox + Edge |
| M15 | Post-Beta Evaluation | Decide next provider/infrastructure direction |

---

# 6. M0 — Provider Compatibility Spike

## Goal

Before building the full application, prove that the provider workflows we are planning are reliable enough for both the website and future extension.

This milestone is deliberately ugly and temporary. It is a technical experiment, not product UI.

## Required tests

### Mail.tm

Verify:

```text
fetch available domains
create mailbox
authenticate mailbox
list messages
fetch message
receive a real external verification email
delete mailbox if supported
handle provider errors
test realtime/SSE behavior
```

### Guerrilla Mail

Verify:

```text
create or obtain session
obtain temporary address
preserve required session/cookie state
list incoming mail
fetch a message
receive a real external verification email
confirm expiration/session behavior
observe browser/CORS/cookie limitations
```

### Browser environments

Run the tests from:

```text
normal web page
Chrome extension context
```

Firefox may be tested later unless trivial to include now.

## Deliverables

```text
docs/PROVIDERS.md
tests/provider-spike/
```

The provider document should record:

```text
working endpoints
auth/session model
known limits
browser restrictions
message expiration behavior
mailbox expiration behavior
fallback considerations
provider terms that affect the product
```

## Gate

**Do not begin full UI work until Mail.tm successfully completes the complete receive-mail lifecycle.**

Guerrilla Mail may remain a fallback-only implementation if browser restrictions prevent parity.

> **M0 result (2026-10-02).** The browser-restriction outcome landed on the
> *opposite* provider from what this gate anticipated: Mail.tm works fully from a
> Chromium extension and is **unreachable from a normal web page**, while
> Guerrilla Mail works from both. The "complete receive-mail lifecycle" half of
> this gate is now **verified** — run
> `2026-10-01T18-08-41-251Z` observed a real external message on both providers.
> **The gate is satisfied.** The provider roles were re-decided as a result; see
> *Decision: provider roles* in `Project Status`.

If Guerrilla Mail proves unreliable in the website environment:

```text
website:
Mail.tm only initially

extension:
Mail.tm + Guerrilla where technically reliable
```

Do not introduce a fragile proxy merely to force equal behavior.

---

# 7. M1 — Monorepo Foundation

## Goal

Create a clean repository before feature code spreads into the wrong locations.

## Tasks

- Initialize pnpm workspace
- Create `apps/web`
- Create placeholder `apps/extension`
- Create shared package directories
- Add TypeScript base config
- Add linting
- Add formatting
- Add test runner
- Add CI workflow
- Add root scripts
- Add `.editorconfig`
- Add `.gitignore`
- Add basic README
- Add product documentation directory

## Expected structure

```text
apps/web
apps/extension
packages/core
packages/providers
packages/mail-parser
packages/storage
packages/ui
docs
tests
```

## Extension placeholder

Before extension development starts:

```text
apps/extension/README.md
```

should explain:

```text
Extension implementation starts after the website core is stable.
Reusable logic must not be placed under apps/web.
```

## Acceptance criteria

```text
pnpm install        succeeds
pnpm build          succeeds
pnpm test           succeeds
pnpm typecheck      succeeds
pnpm lint           succeeds
pnpm dev:web        starts website
```

---

# 8. M2 — Shared Domain Model

## Goal

Define SpectreMail's own normalized data model before implementing providers.

## Required types

```ts
type ProviderId =
  | "mailtm"
  | "guerrilla";

type MailboxStatus =
  | "active"
  | "expired"
  | "unavailable";

type Mailbox = {
  id: string;
  provider: ProviderId;
  address: string;
  createdAt: number;
  expiresAt?: number;
  credentials: ProviderCredentials;
  status: MailboxStatus;
};

type MessageSummary = {
  id: string;
  mailboxId: string;
  from: string;
  fromName?: string;
  subject: string;
  receivedAt: number;
  unread?: boolean;
};

type Message = MessageSummary & {
  text: string;
  verificationCodes: VerificationCode[];
  verificationLinks: VerificationLink[];
};

type VerificationCode = {
  value: string;
  confidence: number;
};

type VerificationLink = {
  url: string;
  hostname: string;
  confidence: number;
};
```

Provider credentials must be a discriminated type so Mail.tm tokens and Guerrilla sessions are never mixed.

## Required normalized errors

```text
PROVIDER_UNAVAILABLE
RATE_LIMITED
MAILBOX_EXPIRED
AUTH_FAILED
NETWORK_ERROR
MESSAGE_NOT_FOUND
UNSUPPORTED_OPERATION
UNKNOWN_PROVIDER_ERROR
```

## Gate

No React component may ever need to understand Mail.tm JSON or Guerrilla Mail JSON directly.

---

# 9. M3 — Provider Layer

## Goal

Implement each provider behind one contract.

## Contract target

> **As implemented by M3 (`openspec/changes/provider-layer`).** The `subscribe?`
> member below is **absent from the real contract, not optional**, and
> `supports(operation)` was added. Both differences are deliberate; see the
> M3 decisions in `Project Status`.

```ts
interface MailProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  checkHealth(): Promise<ProviderHealth>;

  createMailbox(): Promise<Mailbox>;

  listMessages(
    mailbox: Mailbox
  ): Promise<MessageSummary[]>;

  getMessage(
    mailbox: Mailbox,
    messageId: string
  ): Promise<Message>;

  deleteMessage?(
    mailbox: Mailbox,
    messageId: string
  ): Promise<void>;

  destroyMailbox?(
    mailbox: Mailbox
  ): Promise<void>;

  // Added by M3. Both optional members above are queried through this, so
  // "can this provider delete a mailbox?" is a compile-time-checkable question
  // rather than a call that may throw.

  supports(operation: ProviderOperation): boolean;
}
```

## Mail.tm adapter

> **M0 constraints (2026-10-01).** Two items below are not implementable as
> written and must be revised in the M3 OpenSpec change:
>
> - `POST /accounts` is limited to **1 per 60s window** (scope not stated)
>   (`ratelimit-policy: 1; w=60`). Mailbox generation cannot be automatic and
>   instant; the product needs explicit rate-limit handling in the UI, not just
>   in the adapter.
> - **SSE does not exist.** No SSE or WebSocket endpoint is available, so
>   `subscribe?` cannot be implemented for Mail.tm. Polling is the only option.
>
> **M3 resolved this by deleting the member from the contract** rather than
> declaring it and leaving it unimplemented. An optional method is still a method:
> every caller has to check for it and handle its absence, which would have left a
> dead branch in every client and an implied promise that a push transport might
> appear later. The measurement is not "SSE is unstable", it is "SSE does not
> exist", and the honest encoding of that is a contract with no such method.
> A compile-time assertion and a source scan both fail if `subscribe` is ever
> reintroduced.
>
> Mail.tm is also currently **unreachable from a normal web page** — see
> `Project Status` and `docs/PROVIDERS.md`.

Implement:

```text
domain discovery
mailbox creation
authentication token handling
message listing
message fetch
mailbox deletion
health checks
rate-limit handling
SSE subscription if stable   → not available; polling only
```

**Delivered by M3**, with two additions the measured behaviour forced:

```text
credentials generated client-side     (the provider issues no address, and a
                                       password is required then exchanged)
deletion follows the hydrated @id     (measured RELATIVE — /accounts/{id} —
                                       resolved once, never a constructed path)
```

The `1; w=60` limit is captured **verbatim** and never parsed: it states a limit and
a window and nothing about what it is per, so "per IP" appears nowhere in this
product. Whether that limit is per-IP or per-account remains **unverified**.

## Guerrilla Mail adapter

> **M0 constraint (2026-10-01).** Session persistence must store the
> body-returned `sid_token`, **not** the `PHPSESSID` cookie: the provider sends
> `Access-Control-Allow-Origin: *` with no
> `Access-Control-Allow-Credentials`, so a browser cannot send the cookie
> cross-origin. Session expiration must also be detected explicitly, because an
> unrecognised session returns `200` with an empty inbox rather than an error.
> See `docs/PROVIDERS.md`.

Implement:

```text
session creation
cookie/session persistence
address lifecycle
message listing
message fetch
session expiration handling
health checks
rate-limit/error handling
```

**Delivered by M3.** The dead-session check tests whether the response still names
the mailbox's own address, since an unrecognised session answers `200` with no
`list`, no `error`, and `auth.success` still `true` - a mailbox with mail would
otherwise be reported as empty, which is silent data loss. It is best-effort
detection of one known trap, **not** proof of liveness.

Deletion operations are **not implemented**: neither was observed in the measured
surface. `supports()` therefore answers `false`, which records **unverified** - "not
observed" is not "does not exist" - rather than asserting a provider fact nobody
measured.

## Provider manager

Automatic mode:

```text
try Mail.tm
    ↓
success → create mailbox
    ↓
failure
    ↓
short retry
    ↓
failure again
    ↓
mark degraded
    ↓
try Guerrilla Mail
```

> **Revised by M3.** The `short retry` step is **absent**. The provider-adstraction
> capability requires throttling to be surfaced rather than silently retried, and a
> retry loop here would spend a quota the provider is already refusing to extend.
> The manager tries each provider exactly once and reports the failures it saw.

Important:

> Failover applies only when creating a new mailbox.

Existing mailboxes must remain attached to the provider that created them.

**Delivered by M3.** This is structural rather than a convention: M2 derives
`Mailbox.provider` from the credential discriminant, so a Guerrilla mailbox cannot
be reported as a Mail.tm one even by mistake. With a single configured provider -
the website's case - the manager attempts exactly once and **does not pretend a
fallback exists**.

## Acceptance criteria

| Criterion | State after M3 |
| --- | --- |
| Both adapters pass the same provider contract tests | **Met.** One shared conformance suite, run once per adapter, with no per-provider exemption. 24 of the 80 package tests are those two runs. |
| Provider-specific objects stay inside adapter code | **Met.** Enforced by the wire-format boundary scan, whose scope was widened at M2 and widened again at M3 to match adapter-shaped identifiers. |
| Automatic mode can choose/fallback without UI changes | **Met at the package level; no UI exists.** The manager selects and falls back, and a single-provider configuration is reported honestly. Whether any UI needs changing is not yet observable, since no client consumes this package. |
| Manual provider selection is possible | **Not met, and not in M3's scope.** Selection is a presentation concern with no client to present it in. Deferred to the milestone that wires `apps/` to this package; recording it as met would be a claim about code that does not exist. |

---

# 10. M4 — Mail Parsing Engine

## Goal

Make incoming mail useful without AI.

## Safe message processing pipeline

```text
provider message
      ↓
normalize
      ↓
extract safe text
      ↓
extract URLs
      ↓
detect OTP candidates
      ↓
detect verification links
      ↓
render SpectreMail data model
```

## OTP detection V1

Prioritize:

```text
4–8 digit codes
```

Boost confidence near words such as:

```text
verification
verify
security code
OTP
one-time
authentication
confirmation
confirm
login code
```

Reduce confidence for values resembling:

```text
prices
dates
phone numbers
order numbers
tracking numbers
postal codes
```

## Verification-link detection

Inspect link text and nearby wording for:

```text
verify
verification
confirm
activate
login
magic
authentication
validate
```

Never silently open a detected link.

Always show destination hostname.

## Fixture suite

Add realistic test messages for:

```text
4-digit OTP
6-digit OTP
8-digit OTP
multiple numeric candidates
HTML-heavy mail
plain-text mail
magic-link mail
order-confirmation mail with misleading numbers
newsletter
password reset
GitHub-style verification
Discord-style verification
generic SaaS verification
```

## Acceptance target

- High detection rate on known verification fixtures
- Low false-positive rate on ordinary transactional email
- Multiple candidates are surfaced instead of pretending certainty

---

# 11. M5 — Website Core MVP

## Goal

Create the first complete user-facing SpectreMail experience.

## First-run flow

```text
open website
    ↓
automatic provider selection
    ↓
create mailbox
    ↓
show address
    ↓
copy address
    ↓
receive mail
    ↓
see message
    ↓
open message
    ↓
copy OTP / open verification link
```

## Required UI

### Header

```text
SpectreMail
provider status
theme
settings
```

### Active mailbox

```text
temporary address
copy
new address
provider
status
expiration
```

### Inbox

```text
sender
subject
time
verification badge
unread state
```

### Message view

```text
sender
subject
safe text
verification codes
verification links
```

### Mailbox history

Allow multiple recent mailboxes where the provider session still permits access.

## V1 features

- Auto-create mailbox
- Copy address
- New mailbox
- Provider selector
- Automatic provider mode
- Inbox refresh
- Realtime update when stable
- Open message
- OTP extraction
- Verification links
- Expiration state
- Local mailbox history
- Clear local data
- Theme toggle

## Explicitly excluded

```text
attachments
outgoing mail
reply
forwarding
user accounts
cloud sync
AI
paid features
custom domains
own mail infrastructure
```

## Acceptance criteria

A user must be able to:

```text
open SpectreMail
receive a working address
use it externally
receive a real message
find the OTP
copy the OTP
return to a recent mailbox
clear local SpectreMail data
```

without registering for SpectreMail.

**Which slice delivers each line, because this list names capabilities and not
milestones.** A capability appearing here does not mean the milestone M5 delivers it on
its own, and one line in particular is delivered elsewhere:

| Line | Delivered by |
| --- | --- |
| `open SpectreMail`, `receive a working address` | M5 slice 1 — `mailbox-session-layer` (archived) |
| **`use it externally`** | **M5 slice 1 delivers the address; using it on a third-party site is UNVERIFIED** — and it stays UNVERIFIED. `browser-verification` ran the page in a real browser but **deliberately offline**, serving recorded provider responses, so the claim is unchanged rather than narrowed. Closing it needs a **live** provider, which is a product decision, not a test |
| `receive a real message` | M5 slice 2 — `inbox-polling` (archived) |
| `find the OTP` | M5 slice 3 — `message-view` (archived) |
| **`copy the OTP`** | **M10, the verification workflow** — see below |
| `return to a recent mailbox` | **M6 slice 2** - the storage contract is slice 1, and nothing reads it yet; M5's history slice depends on that contract |
| `clear local SpectreMail data` | **M6's Privacy controls, which list it verbatim** — see below |

**`copy the OTP` is M10's, and that is a decision rather than an oversight.**
`AGENTS.md` assigns "OTP copy/fill" to the verification workflow, and M10's own "User
actions" block lists `Copy code`, `Fill code`, and `Open verification link`. M5's
message view **displays** the codes and links it found and acts on neither — no copy
control, and no link that follows itself. The reasoning is in the `message-view`
change's `design.md` D4, and the short form is that `AGENTS.md`'s sentence is a
*correction* — the same file records an earlier draft of it naming a milestone from the
layer that felt like it should come next rather than the one this roadmap schedules —
and that deferring a capability needs no amendment while absorbing one would.
**This list is deliberately left unedited**, because a plan's exit conditions are not
amended from inside a slice; the table names the slice instead.

**`use it externally` had no delivery record until 2026-10-04, and that is worth
recording rather than tidying.** The table mapped seven of the eight lines; `use it
externally` was simply absent, which is how a reader would have concluded the line was
delivered. It is **not** verified. M5 slice 1 delivers an address that is created,
rendered and copyable, and the page has been seen by jsdom and by nothing else – **no
live browser run of the website has ever been made**, and no third-party signup has
ever been driven against it. So the address is *produced*; whether a real service
accepts it and delivers to it is exactly the claim no test in this repository makes.

**`clear local SpectreMail data` is M6's, and the table previously said otherwise.**
It read "M5's clear-data slice, over M6's storage", which had two milestones claiming
one line – and M6 is the one that lists it. M6's Privacy controls block contains
`Clear all local SpectreMail data` **verbatim**, alongside `Forget mailbox` and `Clear
mailbox history`. M5's V1 feature list has a "Clear local data" entry that duplicates
it; the duplicate is left in place above rather than deleted, because removing a line
from a plan's feature list is a different kind of edit from naming which milestone
delivers it. `return to a recent mailbox` moves with it: M6's Storage block lists
`mailboxes`, so history has nothing to persist until M6's contract exists.

---

# 12. M6 — Website Hardening

## Goal

Make the website safe and reliable enough to become the reference implementation for the extension.

## Storage

Implement IndexedDB-backed storage for:

```text
mailboxes
provider credentials
preferences
message metadata cache
provider health
```

## Privacy controls

Add:

```text
Forget mailbox
Clear mailbox history
Clear all local SpectreMail data
```

## Error states

Normalize user-facing messages.

Examples:

```text
Provider is temporarily unavailable.
This mailbox has expired.
Too many requests. Retrying shortly.
Can't reach the mail provider.
This message is no longer available.
```

Do not expose raw stack traces or raw API response objects.

## Security

- No raw HTML rendering
- No email JavaScript execution
- No automatic remote image loading
- No attachment handling
- Validate all URLs before presentation
- Sanitize all visible provider-originated strings

## Accessibility

Target:

```text
keyboard navigation
visible focus states
semantic controls
screen-reader labels
sufficient contrast
reduced-motion handling
```

## Performance

Avoid polling unnecessarily.

Prefer:

```text
SSE where reliable
adaptive polling otherwise
pause inbox activity when page is hidden where appropriate
```

> **M0 result (2026-10-01).** No provider offers SSE. Mail.tm's real-time
> endpoints are absent (all candidate paths `404`/`406`; no WebSocket accepts a
> connection). **Design for adaptive polling as the only transport**, and treat
> "SSE where reliable" as dead rather than aspirational. See
> `docs/PROVIDERS.md`.

## Slices

**M6 is delivered as bounded slices, and the breakdown exists because two milestones
mention the same responsibilities.** M5's acceptance list carries `return to a recent
mailbox` and `clear local SpectreMail data`, and both depend on this milestone's
Storage and Privacy controls blocks. Left alone that is one responsibility written
under two milestones, which is how a milestone gets read as finished when it is not.
Each slice therefore owns exactly one of them, and the table is the assignment.

| Slice | Change | Owns | State |
| --- | --- | --- | --- |
| 1 | `spectre-storage` | The `SpectreStorage` contract and its IndexedDB adapter, delivered **with no client**, so the seam existed before anything was wired to it | applied, verified, archived |
| 2 | `mailbox-adoption` | `MailboxSession.restore`, the four new session states, and website reload recovery - `return to a recent mailbox` | applied, verified, archived |
| 3 | `privacy-controls` | Privacy controls, verbatim from the block above. **Nothing deletes stored data until this lands.** | applied, verified, synced, archived |
| 4 | **none opened** | Error states, security, accessibility, and pausing polling when hidden — **audited on 2026-10-05 and found already delivered**, with two accessibility items belonging to M7. No change was opened; see the annotation below. | audited, re-scoped, no build |

**Slice 1 amends no promoted requirement, and that is a decision rather than an
omission.** `mailbox-session`'s scenario *"A reload loses the session"* becomes false
the moment a client adopts a stored mailbox - which slice 2 does and slice 1 does not.
Promoting that amendment here would ship a spec describing a path that does not exist.
The conflict is recorded in the change's `design.md` (D9) and the amendment is written
into the delta **in slice 2**, so the archive carries it.

**What slice 1 did not deliver, stated plainly at the time.** No client read or wrote
the package. A reload discarded the mailbox, `return to a recent mailbox` was
undelivered, and no privacy control existed. The package's existence was not persistence
shipping - it was the seam that lets a client be wired against a tested contract rather
than against an untested guess, the same choice M4 made for the parser. **Two of those
three sentences became false with slice 2**; the third has not, and slice 3 is what
makes it false.

**Slice 3 mapped this milestone's three named controls onto one, and that is a decision
rather than a shortfall (annotated 2026-10-05, at the apply stage).** The Privacy
controls block names three: `Forget mailbox`, `Clear mailbox history`, and `Clear local
SpectreMail data`. The data model has room for exactly one of them.

- **`Forget mailbox`** and **`Clear local SpectreMail data`** name **the same thing** -
  what this device holds - and ship as **one** control.
- **`Clear mailbox history` has no referent at all.** No message history is persisted:
  the inbox is in-memory state inside `packages/mailbox` and is rebuilt by listing
  through the provider on every visit. There is nothing on the device to delete, so the
  control would be decorative — and a button that reports success while removing nothing
  is worse than no button, because it teaches a user to believe a claim that is false.

**Shipping three buttons was rejected**: two of them would have been byte-identical and
the third inert, which is fake UI. **Creating a history store so the third button had
something to delete was rejected more firmly** - inventing a record kind in order to
delete it is a feature built to justify a button, and it would put mail content on a
user's disk for the first time in this product's history to service a control nobody
asked to exist. `docs/ARCHITECTURE.md` and the change's `design.md` (D4) carry the
reason; this block is where a reader comparing the milestone's text against what shipped
will look first.

**What slice 3 delivered, and the limit that came with it.** `clearAll` on the
`SpectreStorage` contract, the whole IndexedDB database rather than the one key it
stores, behind a two-step confirmation in the page's own `LocalData` region. **The
removal has never been run in a browser** - `jsdom` implements no IndexedDB and the
adapter's tests run against `fake-indexeddb`, which is not a browser - so the product gap
is closed while the verification gap from slice 2 stands unchanged.

**Slice 4 was audited instead of built, and three of its four items were already
delivered (2026-10-05).** That audit is why no fourth change exists, and it is recorded
here in full because a reader comparing this milestone's text against what shipped will
look here first. Every claim below is a **file or a promoted requirement**, not an
inference:

- **Pausing polling when the page is hidden — delivered and specified.**
  `apps/web/src/useInboxVisibility.ts` subscribes to `visibilitychange`, and
  `Inbox.test.tsx` drives it against real events (redefining `visibilityState`, because
  jsdom's is read-only). The promoted requirement *The mailbox is checked again when the
  page is looked at* carries both scenarios: hidden requests nothing, and visible-again
  asks promptly without displaying an interval.
- **Error states — delivered and specified.** Ten `NormalizedErrorCode` members.
  `MailboxFailure.tsx` and `InboxCheckFailed.tsx` each render eight with distinct
  messages, and a test asserts that *every* code is covered **so that none falls to a
  default branch**. Six user-distinguishable codes are asserted to read differently from
  one another, with the throttle singled out. Nothing user-facing renders `.stack` or a
  raw response object; the three `String(cause)` sites format a non-`Error` cause, and it
  is the message that reaches the user.
- **Security — enforced by architecture rather than by new code.** `dangerouslySetInnerHTML`
  and `innerHTML` are forbidden under `apps/` by a boundary assertion.
  `packages/mail-parser`'s `detect-links.ts` allow-lists `http:` and `https:` and drops
  `javascript:`, `data:`, and protocol-relative destinations, with tests for each. A
  detected URL is rendered **as text with its host visible and no `href`**, so there is
  nothing to click into. No remote image loading and no attachment handling, because the
  client loads no resource at all: there is no `<img>`, no `createObjectURL`, no `src=`.
  No provider field name appears under `apps/`.
- **Accessibility, structurally — delivered.** Native `<button>` throughout, with no
  custom key handling and no `div`-as-button, so keyboard navigation needs no code.
  14 `aria-*` attributes across five components, 13 of them labels; regions are
  `<section aria-labelledby>` and `<main>`.

**The two items that are genuinely undelivered are `visible focus states` and
`reduced-motion handling`, and both are CSS.** There is **no stylesheet in the
workspace**, and M6's own promoted requirement says this milestone *"builds structure,
not visual design."* Slice 4 delivering them would write the product's first CSS under a
milestone that disclaims appearance. **Both were moved to M7, and the move invents no
ownership**: M7's accent block already lists `focus state` among the places the accent
should appear, and M7's Motion block defines the animation that a reduced-motion
preference has to govern. M6 disclaims appearance and M7 owns it, so this is where the
two items already lived.

**What M6 therefore owed was not code, and that is what the cursor above named.** Three
long-standing unproven claims were to be closed by **one thing this repository had never
done: running the website in a real browser.** `use it externally` was unverified
because no live browser run and no third-party signup had ever been driven. The storage
path a user's browser takes — boot, read, create, write, then delete the whole database —
had never run anywhere, because `jsdom` implements no IndexedDB. And **no claim existed
about what a provider does when a real page polls it every five seconds.**

**`browser-verification` has now run, and the record is more useful than the plan was.**
The storage path closed, **and it was found broken on arrival**: the page wrote the
mailbox and never concluded it had, so the removal control was never offered. That was a
shipped requirement this roadmap had been reporting as delivered. The other two claims did
**not** close, for a reason worth naming rather than treating as a shortfall: the tier is
**offline by design**, serving recorded provider responses. A browser run cannot close
`use it externally` unless it is also allowed to reach a live provider, and that is a
product decision about sending real mail to a third-party site — not a test.

**The predicted boundary consequence is what makes this worth recording.** Bringing a
suite inside the workspace was flagged as a decision with its own consequences, and **both
predicted collisions landed**: the `apps/`-scoped storage-API rule saw test code naming
`indexedDB`, and the provider-field-name rule saw test code under `apps/`. The first was
a check narrower than its rule — the **twenty-first** such instance here — fixed by
exempting tests by *kind* rather than by the spelling `.test.tsx?`, and fixed with
controls that plant both spellings so an over-wide exemption fails the half that is
supposed to fire.

---

# 13. M7 — Spectral Swiss Design Pass

## Goal

Apply the approved visual direction after the core workflow is functional.

## Direction

**Spectral Swiss Utility**

Primary characteristics:

```text
strong Swiss-style grid
minimal interface
large clean typography
monospace technical details
thin borders
few shadows
generous whitespace
restrained spectral-violet accent
subtle geometric branding
materialize/disappear motion
```

## Suggested visual system

### Surfaces

```text
warm off-white light background
near-black dark background
neutral surfaces
high-contrast text
subtle borders
```

### Accent

Use a restrained spectral violet rather than neon hacker green.

The accent should primarily appear on:

```text
active status
verification codes
selected mailbox
primary action
focus state
brand mark
```

## Typography

Primary:

```text
Geist / Inter / similar grotesk
```

Technical:

```text
Geist Mono / JetBrains Mono / IBM Plex Mono
```

Use monospace for:

```text
email addresses
OTP values
provider diagnostics
technical metadata
```

## Motion

Use motion to support the "spectre" concept:

```text
opacity 0 → 1
blur 6px → 0
translateY 4px → 0
```

for:

```text
new mailbox
incoming message
OTP appearance
```

Avoid:

```text
heavy gradients
glitch effects
Matrix-style visuals
cartoon ghost overload
large neon hacker aesthetics
```

**Two accessibility requirements are this milestone's, not M6's (added 2026-10-05).**
M6's Accessibility block lists `visible focus states` and `reduced-motion handling`
among its targets, and **neither is deliverable there**: both are CSS, the workspace
contains no stylesheet, and M6's own promoted requirement says it *"builds structure,
not visual design."* The audit that found this is recorded under M6's slice table. Both
items already sit inside this milestone's own blocks — `focus state` is listed in the
Accent block above, and the Motion block above is exactly the animation a reduced-motion
preference has to govern — so this paragraph **records ownership rather than moving
anything**:

- **Visible focus states.** Every interactive control gets a focus indicator that is
  visible against both surfaces, never removed by a reset, and uses the accent. Until this
  milestone, the product has no stylesheet at all, so `outline: none` is not in play and
  no control currently shows a focus ring of the product's own making.
- **Reduced-motion handling.** Honour `prefers-reduced-motion: reduce`, and make the
  three Motion transitions above stop rather than merely shorten under it. M7 is the
  milestone that *adds* motion, so M7 is the milestone that must make it optional —
  shipping animation with no way to opt out would introduce the problem rather than solve
  it.

**Contrast and focus visibility are not currently verified, and the reason is narrower
than it was.** There **is** now a browser suite — `browser-verification` added one — so
"there is no browser-automation suite in the workspace" is no longer true and this sentence
is corrected rather than kept. What remains true is that **nothing in it asserts a
computed colour or a rendered focus ring**: contrast and focus visibility are properties
of rendered pixels, and the suite verifies behaviour over IndexedDB rather than appearance.
M7 is where CSS arrives, and a stylesheet is what makes these assertions possible to
write.

## Slices

**M7 is delivered as bounded slices, and the breakdown exists because this milestone mixes
two different kinds of work.** The Direction, Suggested visual system, Typography, and
Motion blocks are one thing: a shared, token-level foundation with claims that can be
asserted as arithmetic. The Website sections block is another: five compositions whose
correctness is a judgement about composition, not a ratio. Put in one change, the second
kind would have been reviewed by the standards of the first and would have passed.

| Slice | Change | Owns | State |
| --- | --- | --- | --- |
| 1 | `spectral-swiss-foundation` | The token layer in `packages/ui`, the page's structural stylesheet, the accent on the surfaces of the Accent block that **exist on this page today** (active status, verification codes, focus state — *primary action* and *brand mark* arrive with the sections in slice 3, and one further use, a detected link's host, is a recorded reading rather than a listed item), **visible focus states**, and the checks that can be asserted about either — contrast as WCAG arithmetic, focus as a resolved outline in a real browser | applied |
| 2 | not opened | **Motion**, and `prefers-reduced-motion: reduce` governing it. The three transitions named above arrive here | not started |
| 3 | not opened | The **five website sections** below. Composition work, on a foundation slice 1 has already fixed | not started |
| 4 | **blocked** | The **`Extension preview`** section, below | **blocked on M8** |

**Slice 1's boundary is the split between "held to a threshold" and "looks right", and it
is drawn by what an assertion can measure.** Every colour pair it declares is checked as a
ratio in `packages/ui/src/pairs.test.ts`, in **both** schemes; every focus indicator is
checked by reading the **resolved** outline in real Chromium and comparing it against the
same control unfocused. **Nothing in slice 1 reads a rendered pixel's colour**, so how
SpectreMail looks remains a human judgement, and no document in this repository claims
otherwise. Slice 3 is where that judgement is exercised, which is also why slice 3 exists as
a separate change: it is the slice where "correct" and "good" stop being the same question.

**Motion is deliberately not in slice 1, and the reason is ordering rather than caution.**
The motion tokens are **declared in slice 1 and used by nothing**, and
`docs/DESIGN_SYSTEM.md` says so in the generated table itself — a reader finding
`--duration-base` in a design contract would reasonably assume something moves. Shipping
animation in slice 1 would have meant shipping it *without* `prefers-reduced-motion`, which
is the specific defect this milestone exists to prevent: the fix for reduced motion has to
land with the motion, never after it.

**Slice 4 is blocked, and it is blocked rather than deferred.** The `Extension preview`
section would render a screenshot or a description of an extension that **does not exist** —
`apps/extension` is an empty placeholder and the manifest is M8's. A preview section for a
missing thing is fake UI, and this repository's own rule about a button that reports success
while removing nothing applies to it exactly: a section that depicts a product the user
cannot obtain teaches a falsehood more effectively than an absent one. **Owner: M8.**

**What slice 1 changed outside the styling.** One promoted requirement, and it is a
**rename plus a modification**: `website-client`'s *"This milestone builds structure, not
visual design"* is renamed and amended, because that sentence is false the moment CSS
exists. The replacement states what the page now offers rather than what it once omitted.
It is carried in the delta as an explicit `## RENAMED Requirements` FROM/TO pair so the
promotion is mechanical and no sentence is left behind describing a milestone that has
passed. **No other capability's requirement was amended** — in particular `visual-system` is
**added** by this slice rather than changed, so this milestone ships a new capability
instead of quietly rewriting a promoted one.

## Website sections

Keep marketing compact:

```text
1. Live product hero
2. Generate → Receive → Discard
3. Why SpectreMail
4. Extension preview
5. Privacy/providers/open-source footer
```

The product itself should remain the main hero.

---

# 14. M8 — Extension Foundation

## Goal

Create a Chromium Manifest V3 extension that reuses the shared SpectreMail core.

## Required surfaces

```text
background service worker
toolbar popup
content script
side panel
extension storage adapter
```

## First extension milestone

The popup should already support:

```text
create mailbox
copy address
view provider
view status
basic inbox count
```

using the same provider/core packages as the website.

## Gate

Do not duplicate provider logic inside the extension.

No files like:

```text
apps/extension/src/api/mailtm.ts
```

should exist if the logic belongs in `packages/providers`.

> **M0 requirement discovered (2026-10-01).** Host permissions **must** use the
> wildcard-path match pattern — `https://api.mail.tm/*`, never
> `https://api.mail.tm`. The slash-less form is accepted into the manifest and
> then grants nothing, so every cross-origin fetch fails with an opaque
> `TypeError: Failed to fetch` and the extension ships looking correct while
> being unable to reach the provider. This was measured, not assumed, and must
> be covered by a test. See `docs/PROVIDERS.md`.

---

# 15. M9 — In-Page Email Integration

## Goal

Create the first browser-native SpectreMail advantage.

## Behavior

When an email input receives focus:

```text
Email
┌────────────────────────────┐
│                            │
└────────────────────────────┘

👻 Use SpectreMail
```

Clicking should:

```text
create or select mailbox
insert address
fire the appropriate input/change events
preserve compatibility with React/Vue-controlled inputs
associate the mailbox with the current site
```

## UX rules

- Do not permanently overlay every email field
- Prefer appearing on focus or explicit user interaction
- Never overwrite existing text without user action
- Allow using:
  - current mailbox
  - new mailbox
  - recently used mailbox for that site

## Site mapping

Store locally:

```text
hostname → mailbox ID
```

Example:

```text
reddit.com → mailbox-123
example.com → mailbox-456
```

This becomes a core extension-specific feature.

---

# 16. M10 — Verification Workflow

## Goal

Complete the browser-native verification flow.

## Incoming mail notification

When likely verification mail arrives:

```text
SpectreMail
Verification code received from example.com

583291
```

## User actions

Support:

```text
Copy code
Open SpectreMail
Fill code
Open verification link
```

## Fill-code rules

- Never silently fill codes
- Require explicit user action
- Prefer detected OTP inputs
- If multiple possible inputs exist, ask the user
- Do not auto-submit forms

## Verification-link rules

- Show destination hostname
- Require explicit user action
- Open in a new tab unless product testing proves another behavior clearly better

---

# 17. M11 — Side Panel + Mailbox Context

## Goal

Make SpectreMail usable without switching away from the active website.

## Side panel

Display:

```text
current mailbox
site association
inbox
new messages
OTP
verification links
recent mailboxes
provider state
```

## Target experience

```text
registration page        SpectreMail side panel
────────────────────     ─────────────────────────
email field              ghost83@...
password field           Inbox

verification code        Example.com
[      ]                  Verification code
                           583291
                          [ Copy ] [ Fill ]
```

## Context behavior

The side panel should understand:

```text
current tab hostname
mailbox associated with current hostname
current mailbox provider
whether verification mail is pending
```

No cloud account is required.

---

# 18. M12 — Release Hardening

## Goal

Prepare website and extension for public beta.

## Security review

Review:

```text
provider credentials
extension permissions
storage boundaries
message rendering
URL handling
content-script injection
site mapping
notification content
clear-data behavior
```

## Permissions review

Every extension permission must answer:

> What user-facing feature requires this?

Remove anything unnecessary.

## Provider review

Before release:

- Re-check Mail.tm API terms
- Re-check Guerrilla Mail API terms
- Re-check rate limits
- Re-check attribution requirements
- Re-check whether public extension distribution is compatible with provider policies

Provider terms may change; do not rely permanently on planning-stage assumptions.

## Privacy documentation

Publish a clear privacy document covering:

```text
what SpectreMail stores locally
what providers receive
what SpectreMail does not collect
how users clear data
provider attribution
message lifecycle limitations
```

## Branding check

Before public release, validate final public name.

`SpectreMail` remains a codename until:

```text
name collision check
domain check
Chrome Web Store search
Firefox Add-ons search
GitHub search
basic trademark risk check
social handle check
```

If the name changes, architecture/package names may remain internal temporarily but public branding should be updated cleanly.

---

# 19. M13 — Public Beta

## Website release

Ship:

```text
standalone temporary mailbox
Guerrilla Mail
OTP detection
verification-link detection
mailbox history
privacy controls
Spectral Swiss UI
```

> **M0 result (2026-10-01) + decision (2026-10-02).** "Mail.tm" was removed from
> the website release list. `api.mail.tm` grants CORS only to its own origins and
> SpectreMail does not proxy provider APIs, so a SpectreMail web page never reads it. The
> website ships on Guerrilla Mail alone; Mail.tm stays extension-primary. See
> *Decision: provider roles* in `Project Status`. The website has no provider
> fallback until a second web-reachable provider exists.

## Chromium extension release

Ship:

```text
popup
content-script email integration
OTP notifications
copy/fill flow
side panel
local site mapping
```

## Beta goals

Collect:

```text
mailbox creation success
mail arrival reliability
OTP detection accuracy
provider failure rates
extension compatibility issues
email-field injection failures
site-specific UI conflicts
```

Do not optimize around vanity metrics yet.

---

# 20. M14 — Cross-Browser Expansion

## Firefox

Adapt:

```text
manifest differences
browser namespace differences
permissions
side-panel equivalent strategy
notification behavior
store requirements
```

## Edge

Chromium compatibility should make this relatively straightforward after Chrome stabilizes.

## Shared-extension rule

Do not fork the extension into completely separate Chrome/Firefox repositories.

Keep platform-specific differences behind small compatibility layers.

---

# 21. M15 — Post-Beta Evaluation

## Goal

Decide whether SpectreMail should remain provider-powered or begin owning infrastructure.

Evaluate:

```text
active users
provider reliability
domain rejection rates
provider policy risk
mail volume
support burden
abuse patterns
extension retention
site-integration value
operating cost projections
```

## Possible outcomes

### Outcome A — Continue provider-powered

If:

```text
providers remain reliable
terms remain compatible
usage remains manageable
```

continue improving the product layer.

### Outcome B — Add another provider

If one provider degrades:

```text
MailTmProvider
GuerrillaProvider
ThirdProvider
```

without changing UI architecture.

### Outcome C — Begin own infrastructure

Only if product traction justifies it:

```text
SpectreMailProvider
      ↓
our API
      ↓
our database
      ↓
mail-routing infrastructure
      ↓
our domain
```

This is intentionally not a V1 requirement.

---

# 22. Testing Strategy

## Unit tests

Required for:

```text
OTP detection
verification-link detection
provider normalization
expiry calculations
provider fallback logic
error normalization
storage serialization
```

## Provider contract tests

Every provider must pass equivalent behavior tests:

```text
createMailbox
listMessages
getMessage
health check
expiration handling
```

Optional methods should clearly report unsupported behavior.

## Integration tests

Test real provider lifecycles periodically.

Do not run destructive/high-volume integration tests on every local save.

## Browser tests

Website:

```text
create mailbox
copy address
switch mailbox
open message
copy OTP
clear data
```

Extension:

```text
detect email field
inject SpectreMail affordance
fill email
open popup
receive notification
fill OTP
open side panel
```

---

# 23. CI Gates

Every pull request should eventually require:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Later add:

```text
web Playwright smoke tests
extension smoke tests
provider contract tests with safe mocks
```

Real third-party provider integration tests should be scheduled or explicitly triggered to avoid flaky PRs and accidental API abuse.

---

# 24. Branch and Commit Strategy

## Stable branch

```text
main
```

## Feature branches

Examples:

```text
feat/m0-provider-spike
feat/monorepo-foundation
feat/mailtm-provider
feat/guerrilla-provider
feat/mail-parser
feat/web-mailbox
feat/web-inbox
feat/extension-foundation
feat/email-field-integration
feat/otp-fill
```

## Suggested commit style

```text
chore: initialize SpectreMail monorepo
docs: add architecture and roadmap
test: add provider compatibility spike
feat(providers): add Mail.tm adapter
feat(providers): add Guerrilla Mail adapter
feat(core): add normalized mailbox model
feat(parser): add OTP detector
feat(web): add mailbox creation flow
fix(extension): restore React-controlled email input
```

Avoid a giant first commit containing the entire product.

---

# 25. Pull Request Expectations

Every meaningful PR should answer:

```text
What changed?
Why does this belong in this layer?
What tests were added?
What user flow changes?
Does this introduce new provider coupling?
Does this introduce new extension permissions?
Does this add storage?
Does this affect privacy/security?
```

Provider-specific code outside `packages/providers` requires explicit justification.

---

# 26. Scope-Control Rules

These rules exist to prevent SpectreMail from becoming a generic email platform.

## V1 non-goals

Do not build:

```text
sending email
replying
forwarding
attachments
SMTP hosting
custom domains
SpectreMail accounts
social login
cloud synchronization
AI summaries
AI inbox assistant
premium plan
mobile app
mass account creation
CAPTCHA bypass
trial-abuse tooling
domain-block bypass
disposable-domain evasion
```

A feature should only enter V1 if it materially improves:

```text
get disposable address
receive verification message
find verification information
continue browsing workflow
```

---

# 27. UX Success Criteria

The website should aim for:

```text
Open app → usable email:
a few seconds

Generate mailbox:
1 action or automatic

Copy address:
1 action

See verification code:
immediately highlighted after message arrival

Account creation required:
0
```

The extension should aim for:

```text
Focused email field → disposable address:
1–2 actions

Incoming verification → code copied:
1 action

Incoming verification → code filled:
1 explicit action

Tab switching required:
ideally 0
```

---

# 28. Engineering Success Criteria

Early technical targets:

| Metric | Initial Goal |
|---|---:|
| Healthy-provider mailbox creation success | >95% |
| Incoming message display success | >95% |
| OTP recognition on fixture suite | >90% |
| False OTP suggestions | Low enough not to confuse users |
| Shared provider logic duplicated in apps | 0 |
| SpectreMail accounts required | 0 |
| Paid backend required for MVP | 0 |
| Raw email HTML rendered unsafely | 0 |

These are development targets, not public guarantees.

---

# 29. Privacy Model

SpectreMail should be transparent:

```text
SpectreMail state:
local-first

Incoming mail:
received by selected third-party mail provider

SpectreMail account:
none

Browsing-history database:
none

Ad injection:
none

User-data sale:
none

Analytics:
none initially
```

Do not claim:

> Messages never leave your device.

That is false while third-party providers receive the mail.

Prefer:

> SpectreMail does not require an account and keeps its own mailbox state locally. Incoming mail is processed by the temporary-email provider powering the address.

---

# 30. Provider Independence Exit Strategy

The project should always preserve this evolution path:

```text
V1

Web / Extension
      ↓
SpectreMail Core
      ↓
Mail.tm / Guerrilla
```

Later:

```text
Web / Extension
      ↓
SpectreMail Core
      ↓
SpectreMailProvider
      ↓
our infrastructure
```

The success of this roadmap depends on **never letting provider-specific implementation leak into the product UI**.

---

# 31. Recommended Development Order

The actual order of work should be:

```text
M0  Provider spike
 ↓
M1  Monorepo
 ↓
M2  Domain model
 ↓
M3  Provider layer
 ↓
M4  Parser
 ↓
M5  Functional website
 ↓
M6  Harden website
 ↓
M7  Apply Spectral Swiss design
 ↓
M8  Extension shell
 ↓
M9  Email-field integration
 ↓
M10 Verification workflow
 ↓
M11 Side panel
 ↓
M12 Release hardening
 ↓
M13 Public beta
 ↓
M14 Cross-browser
 ↓
M15 Evaluate own infrastructure
```

The most important sequencing rule is:

> **Do not spend significant time polishing the marketing website before real incoming email works reliably.**

---

# 32. Immediate Next Action

The next implementation task is:

## `M0 — Provider Compatibility Spike`

Create a small technical test harness that proves:

### Mail.tm

```text
create mailbox
receive real email
list message
open message
```

from both:

```text
normal web app
Chrome extension context
```

### Guerrilla Mail

Repeat the same lifecycle while documenting:

```text
session requirements
cookie behavior
expiration
browser restrictions
failure modes
```

At the end of M0, update:

```text
docs/PROVIDERS.md
```

with the actual findings.

Only then proceed to full repository scaffolding and production implementation.

---

# 33. Roadmap Completion Definition

SpectreMail's initial roadmap is considered successfully completed when:

```text
✓ Website is publicly usable
✓ Browser extension is publicly usable
✓ No SpectreMail account is required
✓ Guerrilla Mail works as the website provider
✓ Mail.tm works as the extension's primary provider
✓ Guerrilla fallback works in the extension where technically viable
✓ Provider-specific code is isolated
✓ OTP detection works reliably
✓ Verification links are safely exposed
✓ Browser email-field integration works
✓ Incoming verification notifications work
✓ Side panel provides usable inbox context
✓ Data remains local-first
✓ Privacy behavior is documented
✓ Public branding has been validated
✓ Architecture still permits future own-domain infrastructure
```

At that point the next roadmap should be based on real usage rather than assumptions.

---

## Final Rule

When choosing between:

```text
more features
```

and:

```text
making the disposable-email + verification workflow faster and more reliable
```

choose the second.

SpectreMail should win by making temporary email feel native to the browser, not by becoming a full email client.
