# Tasks

## 1. The two missing cells

- [x] 1.1 **Add the two variant fragments, and only those two.**
      `apps/extension/e2e/fixtures/side-panel-probe/variants/permission-only.json` —
      `"permissions": ["sidePanel", "storage"], "side_panel": null`.
      `variants/key-only.json` — `"permissions": ["storage"]`.
      **Each differs from `base` in exactly one entry, and each carries the `_comment`
      annotation its two siblings carry**, because a fragment whose comment describes a
      different merge rule is worse than no comment. `permissions` is replaced wholesale
      and `null` deletes, so neither fragment can accumulate an entry the base lacked.

- [x] 1.2 **Add both names to `VARIANTS`, and nothing else in the driver's control flow.**
      `apps/extension/e2e/side-panel-runtime.mjs` line 101. **`base` is the identity and has
      no fragment file** — reading `variants/base.json` is what turned the base arm into a
      crash rather than a reading on this probe's first run. Both new names therefore need
      files.

- [x] 1.3 **Record the four cells as a table, not as prose about a comparison.**
      `docs/PROVIDERS.md` §4.6's first row currently reads as a single yes/no. **Replace it
      with the two-by-two**, because a row that says "the permission is one of the two and
      cannot be separated on them" is what four documents have carried forward.

- [x] 1.4 **State in the same table that `control` differs from `base` in two entries.**
      §4.6 already says so once, in prose. **A four-cell table read as four controlled pairs
      would be a new false claim created by the correction**, and the correction must not
      introduce the defect it is correcting.

## 2. The verdict, and the two recorded defects of the instrument that produces it

- [x] 2.1 **A cell that reports nothing is counted as *not observed*, never as *absent*.**
      §4.6 records a verdict that *"survived a total measurement failure"*: it was read
      from the API-presence stage, a different fixture load from the arms, so an arms stage
      that failed completely left the verdict positive. **Both new cells are API-presence
      cells, which is the stage that carries the defect.**

- [x] 2.2 **`answerable` is `false` whenever any of the four cells failed to report, and the
      run exits non-zero.** The shape `side-panel-runtime-facts` D6 established. **A verdict
      computed from a subset of its own cells is decoration.**

- [x] 2.3 **Record the rate, not a fix.** §4.6 records one run in six failing to dock the
      panel, cause undiagnosed. **A repeatability figure without a cause is a number rather
      than a finding**, so this task records what was measured and claims nothing about the
      cause. Run the probe **at least three times** and report the tally with its
      denominator; **a run whose output carries no cell report is `HARNESS-ERROR`, not a
      green.**

- [ ] 2.4 **Keep every run's log.** One red discarded is this repository's most repeated
      defect. If any cell fails to report, the log is retained and the failure is recorded
      **rather than reconciled away by re-running**.

## 3. The conditional branch, both directions, written down before the answer is known

- [x] 3.1 **If the cells show the key alone does not work without the permission:** keep the
      entry, and write the outcome sentence into the **change's delta** as a recorded
      apply-stage amendment naming the four cells. `manifest.json` is **unchanged**.

- [ ] 3.2 **If the cells show the key works without the permission:** remove `"sidePanel"`
      from `apps/extension/static/manifest.json` and from the expected list at
      `apps/extension/e2e/manifest.spec.ts:246`, and write **both** directions into the
      delta — the removal, and a scenario forbidding the shape from returning. **The
      product manifest changes in this direction and only this one**, so the diff is
      reviewable as a two-line change against a one-hundred-line amendment.

- [x] 3.3 **Either way, the amendment paragraph already in the delta stands unchanged.**
      Its claim is about what *was* measured before this change, and this change does not
      retroactively alter that. **Editing it to agree with the new answer would make the
      record say the correction was obvious in hindsight.**

## 4. The instrument, which is the part that outlives the change

- [x] 4.1 **Add a test-owned permission map to `manifest.spec.ts`.**
      `permission → the \`chrome.<name>\` call that reaches it, or the manifest key that earns
      it`. **It lives in the test file and nowhere else** — this repository has recorded twice
      that a rule a comment can satisfy is not a rule, and the failure it names is a module
      that only *describes* the coupling it lacks.

- [x] 4.2 **Assert it in both directions, and the second direction is the one that does not
      exist today.** `manifest.spec.ts` already fails when a permission is *added*
      (`toEqual` on the whole list). **What nothing catches is a permission added with
      nothing behind it**, so the new case scans shipped `apps/extension/src` for
      `chrome.<permission>` and requires every declared permission to be justified by a call
      **or** by a manifest key the map names.

- [x] 4.3 **Read the shipped sources, not a list, and strip comments first.**
      The finding this change is built on is that the one occurrence of `sidePanel` in
      `apps/extension/src` is **inside a doc comment**. A scan that does not strip comments
      would report that as a justification. **Stripping comments is what makes this case
      falsifiable** — and it is the same repair `M5 slice 1` made to a rule that was firing on
      its own documentation, except that here the comment would have silenced the rule
      rather than tripped it.

- [x] 4.4 **The four counts this change turns on must not move.**
      `packages/ui` **38**, `packages/storage` **86**, `apps/web` **125**, and the
      architecture boundary count **53**. **No boundary rule is added** — `manifest.spec.ts`
      already owns half this property, and *a rule added where an instrument already exists
      is not coverage*. **A rise in the boundary count is a declared failure of this change**,
      not a coverage improvement.

## 5. Falsification

- [x] 5.1 **Mutate each new fragment to declare what its cell must not declare, and the cell
      must move.** `permission-only.json` given a `side_panel` key, and `key-only.json` given
      the permission. **A cell that does not move when its own staged manifest changes is
      measuring nothing**, and that is the failure the recorded first run of this probe
      already made once — `sidepanel.html` had no `<script>`, so every dependent arm
      reported nothing while `open()` resolved and the launcher printed *opened*.

- [x] 5.2 **The positive control must be a cell that *did* report.** Without one, an
      instrument that reports nothing passes as "the API was absent".

- [x] 5.3 **The mapping's case fails two-sidedly, and a control survives.**
      A probe permission in the manifest with no map entry **and** no call → reported by
      name. The same permission with a shipped `chrome.<name>` call and no map entry →
      also reported, because the map is the assertion and not a fallback. **A mapping entry
      for a permission the manifest no longer declares → unaffected**, because a control
      surviving a mutation is the control working.

- [x] 5.4 **Restoration SHA-256 per mutated file against a digest taken *before* the
      mutation.** Not against `HEAD`, and not against a digest taken after the mutation —
      a post-mutation digest matches on both sides and certifies a file carrying none of the
      change. **`git checkout --` is not a restore**: it reverts to `HEAD`, destroying the
      change, and exits 0.

- [x] 5.5 **The instrument lives outside the repository and is deleted.** Four temporary
      scripts in the repository root have failed `pnpm lint` on a past archive stage, and a
      measuring instrument is not a shipped file.

## 6. Gates

- [x] 6.1 **`pnpm verify` three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory**, each exit `0`. Three because two reds at this stage of past changes were
      both real and neither was a flake: `format:check` on files committed earlier in the
      change without Prettier having run, and `lint` on the harness itself.

- [x] 6.2 **Record `pnpm test` from a `--reporter=json` run grouped by project, not read off
      a summary line.** The standing figures are `packages/ui` 38, `packages/storage` 86,
      `apps/web` 125, `apps/extension` 465, boundary **53**. **`apps/extension` is the only
      one that may move, and only by the cases this change adds.**

- [x] 6.3 **`pnpm test:browser` repeated with a stated denominator.** **40 website and 98
      extension on every run that produced a measurement**, and a run with no tier summary
      is `HARNESS-ERROR`.

      > **Corrected in place at the orchestrator's verification (2026-10-13), and the
      > correction is stated here rather than reinterpreted away.** This task as proposed
      > read _"This change adds **no** browser case — the probe is quarantined and neither
      > tier collects it — so **40 website and 97 extension**"_. **Both halves were wrong,
      > and they were wrong together**: task 4.1 mandates a case in `manifest.spec.ts`,
      > which the extension's browser suite *does* collect, so 97 was the count from
      > *before* this change. One requirement cannot be satisfied with the other, and the
      > browser tier is the only tier where the map can be asserted at all, because the
      > case reads the **built** `dist` manifest beside the shipped `apps/extension/src`.
      > §8.2 records the contradiction as the apply stage found it; **this is the
      > repository's recorded precedent for the repair** — a task that names a number and
      > is wrong about it is corrected where it stands, rather than left to be
      > reconciled by a later reader.

- [ ] 6.4 **`openspec validate --specs --strict` and `openspec validate <change> --type
      change --strict`**, and the re-count by heading across `openspec/specs/` **taken after
      the archive rather than carried into it.** Baseline is **168 requirements and 544
      scenarios across 14 capabilities**; this change's delta adds **0 requirements and 1
      scenario** in `extension-client` (14 → 14, 74 → 75), because a `MODIFIED` block
      *replaces* rather than adds.

## 7. What this change deliberately does not do

- [x] 7.1 **The privacy document is not written here** (M12 item three). It is **unblocked**
      by `extension-clear-data` and remains its own change.

- [x] 7.2 **The `tabs` permission is not added.** §4.6 measured `tab.url` withheld without
      it and read with it, and `side-panel-surface` chose the free route. **M12's review is
      about removing unearned permissions, not adding earned ones**, and re-deciding a
      settled route is not this change's business.

- [x] 7.3 **The alarm that survives a removal is not cleared.** `extension-clear-data` D7
      records that the panel reaches no alarm platform and that the residual is named. **A
      permission review is not a place to settle it**, and §4.5 measured `alarms` as granted
      at install with no prompt.

- [x] 7.4 **Nothing about a rendered pixel, a headed desktop, or another engine.** One
      Chromium, headless, on one machine — unchanged from §4.6's own limits, and this change
      adds no engine.

- [x] 7.5 **A human looking at the extension is not an instrument.** If the panel stops
      appearing when the permission is removed, **§4.6 already records that this Chromium is
      headless and that `open()` resolving and the document running are two smaller facts than
      a person seeing one.** No gate here can answer that and none will be cited as if it
      could.

## 8. Apply-stage record (2026-10-13)

**Appended, and nothing above this line is edited or re-ticked** — no box in sections 1-7 was ticked
by this stage, and the orchestrator owns them. What follows is what was measured, one prediction that
turned out to be wrong, and the gate results as they stand.

### 8.1 Branch 3.1, decided by the `key-only` cell

**The cells show the key alone does not work without the permission** (`chrome.sidePanel` is
`undefined` with the `side_panel` key present and the permission absent), so `sidePanel` stays,
`apps/extension/static/manifest.json` is **byte-identical**, and the outcome went into the **delta** as
a recorded apply-stage amendment naming all four cells. **Branch 3.2 did not happen**, so the
two-line removal it described did not happen either. **Task 3.3's paragraph is untouched.**

### 8.2 **Task 6.3's number is wrong, and the change contradicts itself about it**

6.3 says _"This change adds **no** browser case - the probe is quarantined and neither tier collects
it - so **40 website and 97 extension** on every run"_. **Task 4.1 mandates a case in
`manifest.spec.ts`, which the extension's browser suite collects.** One requirement cannot be
satisfied with the other, and the browser tier is where the map can be asserted at all, because the
case reads the **built** `dist` manifest beside the shipped `apps/extension/src`.

**Measured: 40 website and 98 extension**, on 9 of 10 runs. **97 is the count before this change**,
and the honest reading of 6.3 is that it was written while the probe work was the whole of it. **This
is recorded rather than edited**, because a task corrected in place by the stage that proved it wrong
is a task whose correction cannot be re-derived from the file.

### 8.3 Falsification, both tiers

**Six arms caught by the assertion each was aimed at; one control correctly unaffected; one positive
control green; `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` all zero**; every mutated
file restored to a **SHA-256 digest taken before the mutation** (not `HEAD`, not a post-mutation
digest); `git checkout --` never used; `dist/` rebuilt from restored source after every arm that fed
it; the harness in `%TEMP%\opencode\` and **deleted**. Arms 1-2 falsify the two new cells (task 5.1),
arm 3 is the positive control 5.2 asks for, arms 4-6 are task 5.3 in all three of its directions, and
arms 7-8 falsify the comment-stripping task 4.3 calls load-bearing — one per comment form. Full table
in `docs/PROVIDERS.md` §4.6.

**The instrument was wrong twice before it measured anything** (design.md D14), and the second defect
is the recorded `dist/`-outlives-the-restoration one, committed by the instrument that exists to catch
it. **The control is what exposed it.**

### 8.4 The four counts did not move

`packages/ui` **38**, `packages/storage` **86**, `apps/web` **125**, boundary assertions **53** —
measured from a `--reporter=json` run grouped by project, not read off a summary line.
`apps/extension` is **465**, unmoved, and **that is the measurement task 6.2 asks for**: the only case
this change adds is in the browser tier, which no Vitest glob collects, so the unit total is _required_
to be identical. **Total 1228 across 62 files**, identical to the baseline. **No boundary rule was
added** — `manifest.spec.ts` already owned half the property, and a rule added where an instrument
already exists is not coverage.

### 8.5 Gates, as measured — including what the machine did to them

| gate | result |
|---|---|
| `pnpm verify` (x3, `PLAYWRIGHT_BROWSERS_PATH` at an empty directory) | **3 runs exited `0`** after `format:check` was repaired. Six further runs exited `1` — see below |
| `pnpm test --reporter=json` | **1228 in 62 files**, exit `0` |
| `pnpm test:browser` | **9 of 10 runs green, every one at 40 website and 98 extension** |
| `openspec validate --specs --strict` | **14 passed, 0 failed** |
| `openspec validate extension-permissions-review --type change --strict` | **valid** |
| re-count by heading across `openspec/specs/` | **168 requirements, 544 scenarios, 14 capabilities** — `extension-client` 14 / 74, unmoved by this change, as predicted for a `MODIFIED` block |

**The first three `verify` runs were red on `format:check`** — three files this change wrote, with
Prettier not yet run over them. **That is the recorded reason the gate is run three times**, and it
was repaired rather than counted.

**The machine was under sustained external load for the rest of it** — another project on the same
box ran `turbo typecheck` and then `turbo run test` throughout, with sampled CPU at **84-92%** and
`verify`'s wall time between **106s and 581s** against roughly 50s uncontended. Six reds, named:

- **`Panel.test.tsx` "names the mailbox this page resolves to and the provider that served it"** — a
  1-second `findByRole` wait — **four times**. **0 failures in 10 runs of that file alone.**
- **`service-worker.test.ts` "names the alarm in the one module that owns it..."** — once.
- **`apps/web/src/recovery.test.tsx` "offers a removal once it has stored something"** — once.
- **One run had `1228 passed` and still exited `1`**: Vitest's own
  `[vitest-worker]: Timeout calling "onTaskUpdate"`, a runner RPC timeout with a green test result.

**None of these can be this change, and the argument is structural rather than correlational**: the
diff adds only `apps/extension/e2e/**`, two probe fixtures, `docs/PROVIDERS.md` and this change's own
artifacts — and the Vitest globs are `tests/architecture/**`, `packages/*/src/**` and `apps/*/src/**`,
so **nothing this change wrote is collected by `pnpm test` at all.** A browser case in a file this
change does not touch (`in-page-fill.spec.ts`, `Received: 2` where one listing was expected — **the
background-wake race AGENTS.md already records for this tier**) accounts for the one browser red.

**These are recorded as findings about the machine, not repaired and not hidden, and no load-induced
red is counted toward the three greens.** A quiet machine was not obtainable here and that limit is
part of the result.

### 8.6 Not done, and left where it belongs

- **No task box is ticked**, and `openspec/specs/` is untouched — the delta promotes nothing yet, and
  this stage does not sync.
- **No boundary rule was added or edited**, including `QUARANTINED_PROBES` — the probe is already
  named there (design.md D9), and the count staying at **53** is the measurement.
- **The privacy document (7.1), `tabs` (7.2), the surviving alarm (7.3), a headed browser and another
  engine (7.4), and a human looking at the extension (7.5) are all untouched** and none is claimed.

## 9. Orchestrator verification record (2026-10-13)

**Twenty-six of twenty-nine boxes are ticked, and the three that are not are named here rather than
left as bare unticked boxes** — because an unticked box with no reason is indistinguishable from a
task nobody looked at, which is the exact failure this repository records about its own headline
figures.

- **2.4 is open because a log was lost.** The task asks that every run's log be kept, and **one
  probe log was overwritten by its own re-run.** No cell failed to report in any of the four runs,
  so the task's stated trigger never fired — but the log is gone regardless, and **the shortfall is
  recorded rather than ticked away on the grounds that the condition it guards against did not
  occur.** A rule that holds only when its failure is already visible is not a rule.
- **3.2 is open because its branch was not taken.** The cells decided 3.1 (§8.1). Ticking 3.2 would
  assert that a manifest removal happened, and **`manifest.json` is byte-identical**.
- **6.4 is open because half of it belongs to the archive stage.** Both `validate` commands ran and
  passed (§8.5), but the task also asks for the re-count **after the archive rather than carried
  into it**, and there is no archive yet. The baseline for that re-count is recorded now:
  **168 requirements, 544 scenarios, 14 capabilities.**

### 9.1 Gates the orchestrator ran, measured and not carried forward

| gate | result |
|---|---|
| `pnpm verify` × 8, default `PLAYWRIGHT_BROWSERS_PATH` | **8/8 green**, 1228/1228, 62/62 files |
| `pnpm verify` × 3, `PLAYWRIGHT_BROWSERS_PATH` at an **empty directory** (0 entries, counted) | **3/3 green** — this is 6.1's stated condition, measured here and not inherited |
| `pnpm test:browser` × 5 | **5/5 green, 40 website / 98 extension on every run**, 0 harness-error |
| `pnpm test --reporter=json`, grouped by project | `packages/ui` **38**, `packages/storage` **86**, `apps/web` **125**, `apps/extension` **465**, boundary **53**, total **1228** |
| `openspec validate --specs --strict` | **14 passed, 0 failed** |
| `openspec validate extension-permissions-review --type change --strict` | **valid** |
| the committed probe, re-run by the orchestrator | exit `0`, **13/13 observations**, `answerable: true`, `key alone false` / `permission alone true` |

### 9.2 One red in twelve, and it can never be named

**An early `pnpm verify` run exited `1` with `Tests 1 failed | 1227 passed (1228)`**, and **the
failing test's name was destroyed by my own harness**, which piped the run through
`Select-Object -Last 6`. It did not reproduce in the **eleven** runs since. **It is therefore
recorded as one unattributed red in twelve and explicitly not called a flake** — a flake is a
failure with a name and no cause, and this is a failure with neither.

**The harness has since been rewritten so that cannot recur**, and the rewrite is itself the
recorded finding: Vitest writes its summary to **stderr with SGR codes around every token**, so the
literal text is `Tests<ESC>[22m<ESC>[39m  1228 passed (1228)` and a regex written against clean text
never matches. **My first reader did not strip ANSI and reported five green runs as five
`HARNESS-ERROR`s** — the correct verdict for a run it could not read, applied to five runs it had
measured perfectly well. **The repair was in the reader, never in the tally.**

**The repaired reader was then falsified before its tally was trusted, and its self-test found two
defects on its first run — both mine, both in the test data or the harness's structure rather than
in the reader's logic:**

- **A literal ESC byte typed into the source became `\x1b[`**, so `${E}[2m` rendered as `\x1b[[2m`
  and the strip regex, which expects one `[`, matched nothing. **The reader was right and the test
  data was wrong**, and the self-test is what told them apart, because the same reader parsed the
  clean-text case correctly. Fixed with `String.fromCharCode(27)`, which no editor or copy-paste
  can re-bracket.
- **`--self-test` printed all six verdicts and then died** with `ReferenceError: results is not
  defined`, because my `else` block closed before the tally. **A self-test that crashes after
  reporting its verdicts is worse than one that reports nothing**, because the verdicts above it
  look complete and readable.

**Final: 6/6 self-test cases, including "a run that never reached Vitest reads as HARNESS-ERROR" and
"a red is NAMED".**

### 9.3 The same reader defect, independently, in the browser harness

**A separate harness for `pnpm test:browser` made the same class of mistake on its first run, and
it is recorded because two instruments failing the same way is a fact about the way they were
written.** It read Playwright's `40 passed (10.9s)` as `40 passed (37)` — **assuming the
parentheses held a count when they hold a duration** — so **four green runs reported as four
`HARNESS-ERROR`s.** Repaired, extracted into `readTiers`, and given its own **6/6 self-test** whose
first case is the exact `(10.9s)` / `(1.0m)` shape that broke it.

**It also had a label defect found by looking rather than by running**: it numbered runs `i + 1`
while naming their logs `browser-${i}.log`, so every run's label disagreed with its own filename by
one. **The tallies were right and the labels were not**, which is the one direction in which that
defect is survivable — and it was repaired anyway, because an instrument whose two labels disagree
cannot be quoted in an argument later.

### 9.4 Three corrections the orchestrator made to the subagent's documents

**All three were the same error in three files: substituting "does a module spell `chrome.<name>`"
for the requirement's "no shipped surface _uses_".** Measured independently with a region-tracker
over comment-stripped source: **`chrome.alarms` in `service-worker.test.ts:100` is the only
`chrome.<name>` occurrence in code anywhere under `apps/extension/src`** — and it sits in a
forbidden-token list, so it is not a use. **The other seventy are all inside comments** (14 in
`extension-platform.ts`, 9 in `storage.ts`). Shipped code reaches the platform through
`Reflect.get(globalThis, "chrome")` with member names as strings.

- `design.md`'s Context table, which answered "yes" on three rows.
- `manifest.spec.ts`'s `stripComments` comment, which described the scan as finding "no
  `chrome.<name>` at all".
- `docs/PROVIDERS.md` §4.6's arms 7 and 8.

**`tabs` is the standing proof that the map, not a scan, is the assertion**: it is read twice in
shipped code and deliberately undeclared. A scan-based rule would have demanded it.
