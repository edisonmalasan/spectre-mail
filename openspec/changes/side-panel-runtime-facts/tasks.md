# Tasks

**Read `design.md` D6 before starting group 3.** This change's deliverable is an instrument, so the
tasks that matter most are the ones proving the instrument *can* report a wrong answer — the repo
has recorded an instrument answering confidently and wrongly four separate times, and one of them
printed `undefined ms` for three arms without a single run going red.

**Two amendments were recorded during apply and are at the foot of this file.** Task 2.1 and the
fixture shape behind tasks 1.2–1.4 both changed once the repository was read, and neither change is
a silent divergence — each is written down with its reason, as `AGENTS.md` requires.

## 1. Fixtures — one base and two manifest fragments

- [x] 1.1 Create `apps/extension/e2e/fixtures/side-panel-probe/manifest.json` declaring `sidePanel`, `storage`, `side_panel.default_path`, a background worker, and the two provider host patterns; verify by reading it that every entry beyond MV3 boilerplate is one D8 names, and that its `description` states why the fixture holds rights the product does not
- [x] 1.2 Create `side-panel-probe/variants/control.json`, a partial manifest whose only key is `permissions`, holding `[storage]` and nothing else, and carrying no `side_panel` key at all; verify by materialising it over the base that the result differs in exactly two lines
- [x] 1.3 Create `side-panel-probe/variants/tabs.json`, a partial manifest whose only key is `permissions`, holding `[sidePanel, storage, tabs]`; verify the same way
- [x] 1.4 Verify the three-way claim mechanically rather than by reading: a script that materialises each variant over the base — a shallow `Object.assign` — and reports which top-level keys differ, requiring `control` to differ by `permissions` and `side_panel` and `tabs` by `permissions` alone; run it from the temp directory, **not** committed — a diff check committed beside the fixtures would be a second thing to keep in step with them

## 2. The probe surface and the readback channel

- [x] 2.1 Create `side-panel-probe/probe.js`, a service worker that publishes a probe surface on its own global and **spells the platform directly**; verify by reading it that it matches `notification-probe/probe.js`'s idiom and that nothing under `apps/extension/src` was touched
- [x] 2.2 Create `side-panel-probe/sidepanel.html` and its script, which publish a report of what the panel-hosted document can see into `chrome.storage.local` under one key; verify by reading the record back through the worker's own API in a first driver run
- [x] 2.3 Create `side-panel-probe/launcher.html` carrying one button whose handler calls `chrome.sidePanel.open({ tabId })` for its own window — **the gesture D3 requires**, and the reason `openPanelOnActionClick` is not used instead; verify a Playwright `click()` on it satisfies the platform's gesture requirement rather than merely appearing to
- [x] 2.4 Verify the surface readback works end to end before any measurement is trusted: a run that reads the worker's surface and the storage key back through `worker.evaluate(...)`, the same handle `background-state.ts` uses — **a channel that does not read anything back makes every later arm's empty answer ambiguous**

## 3. The driver, and the honesty of its exit code

- [x] 3.1 Create `apps/extension/e2e/side-panel-runtime.mjs` with the load flags **spelled** rather than imported — `extensionFlags()` is TypeScript and a plain `.mjs` cannot import it, exactly as the two existing probes record; verify the boundary rule covering flag agreement still passes with this file added
- [x] 3.2 Give the driver the notification probe's `ms()`-equivalent: a duration formatter that **throws** rather than rendering a non-number, because `String(undefined).padStart(6,"0")` is how three arms once reported `undefined ms` with nothing red
- [x] 3.3 Implement the exit code of D6 — `0` only when **every** arm produced an observation, `1` when any arm came back empty, and a distinct printed outcome for *"unmeasurable on this substrate"* that is neither an answer nor a silent pass; verify by enumerating the arms the run claims and requiring the count to match
- [x] 3.4 Implement the conservative verdict function: `answerable: false` unless the control arm established the API's **presence**, on the alarms probe's recorded lesson that a control sharing the resource under measurement is a confound; verify a verdict computed against a control reporting absence comes back `answerable: false`

## 4. The arms

- [x] 4.1 Arm **API presence** across all three variants, read from the base worker and read again from the control worker; verify the control reports `undefined` while the base reports present — **if all three report absent, stop and record that instead, because every later arm would then be about an API that is not there**
- [x] 4.2 Arm **D4's two observations**: the outcome of the `open()` call itself, and the panel's own report read back from storage; verify both are recorded separately and that a run holding only the first is reported as having measured nothing
- [x] 4.3 Arm **what a panel-hosted document sees**: `chrome.windows.getCurrent()`, `chrome.tabs.query({active:true, currentWindow:true})`, and `tab.url` — run against the base variant and again against the tabs variant, so the cost of route (b) is measured rather than argued; verify the two runs are reported side by side and not collapsed
- [x] 4.4 Arm **`sendMessage` to the active tab**, including the arm against a window whose active tab carries **no content script**, so "the panel cannot reach this page" is a recorded answer and not a hang; verify the no-content-script arm completes and says so
- [x] 4.5 Arm **D5's driven tab switch**: switch the fixture window's active tab, then read the panel's report **a second time**, and report the pair; verify the second read is what proves the panel re-evaluated rather than a listener being registered
- [x] 4.6 Arm **the substitute**, `sidepanel.html` opened as a tab in the fixture window with the content-script page brought to front — the recorded popup substitute, run here because it decides whether M11's browser tier can verify a panel at all; verify its output is labelled a substitute in the run's own text, not only in a comment
- [x] 4.7 Run every arm and capture the output **verbatim** to a file outside the repository; verify by reading that file back rather than reconstructing any value from memory — this repository has recorded counts transcribed rather than measured three times

## 5. Falsifying the instrument

- [x] 5.1 Break the panel's report write — have `sidepanel.js` publish nothing — and require the run to **exit non-zero reporting that it measured nothing**, rather than reporting an empty observation; verify the run's exit code, not just its prose
- [x] 5.2 Break the readback — have `probe.js` publish a surface whose report key never resolves — and require the same non-zero exit; verify it, because a broken readback and a broken write produce the same empty output from the driver's point of view and only one of them is the driver's own fault
- [x] 5.3 Point the driver at the **control variant** alone and require every arm to report `answerable: false`; **this is the negative control the whole run rests on**, and a run that answered anything under the control would invalidate every other arm
- [x] 5.4 Restore each fixture file from a SHA-256 digest taken before the falsification edits and verify restoration, reporting restoration **separately** from measurement — the recorded `archive-bytes` defect is a run reporting a tree that is not the one it claims to have measured
- [x] 5.5 Delete any throwaway spec or script the falsification wrote inside the repository before continuing; verify by fingerprint over source files that group 6's run is on a tree no measurement left behind

## 6. Recording the result

- [x] 6.1 Write `docs/PROVIDERS.md` **§4.6** from the captured output, one table row per arm, and **require every row to carry its own "What it does not establish" entry** — that column is why §4 exists and a row without one is the failure §4.1's format was built to prevent
- [x] 6.2 Add a §5.2 row for whatever the run leaves open, and state **which** arms closed it; closing one gap is not the same act as having none, and `alarms-packing-interval`'s replacement row is the precedent
- [x] 6.3 Touch §6 only if a finding actually moves a roadmap consequence, and quote the finding rather than its implication
- [x] 6.4 Record the run's own limits in §4.6's prose in the same words the script prints them — the panel is not a rendered pixel, a docked panel is not a page Playwright can see, and headless Chromium is not a desktop

## 7. Quarantine and the repository gates

- [x] 7.1 Add `"side-panel-runtime.mjs"` to `QUARANTINED_PROBES` in `tests/architecture/boundaries.test.ts` with a comment naming why it is quarantined, in the same shape as the three beside it; verify `pnpm test tests/architecture` passes and that the existing assertions — filename, no suite collects it, no manifest names it, and the **flag agreement** check — cover this probe **without a line being added for them**
- [x] 7.2 Verify `pnpm verify` exits `0` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and that `pnpm test` reports the **same total and file count** as before this change, measured from `--reporter=json` grouped by project rather than read off a summary line
- [x] 7.3 Verify `pnpm test:browser` still reports **40 website and 67 extension** cases — the fixture directories are not collected by any suite, and the boundary rule requiring every shipped `*.spec.ts` to be collected by exactly one browser suite is what proves it
- [x] 7.4 Verify `apps/extension/static/manifest.json` is byte-identical to its pre-change digest, and that no file under `apps/extension/src/` was modified — **the cheapest possible check that this change stayed a measurement**
- [x] 7.5 Run `openspec validate side-panel-runtime-facts --type change --strict`, and re-read `AGENTS.md` and `docs/ROADMAP.md` for any statement this change makes false; correct the statement rather than the requirement if one is found

---

## Amendments recorded at apply

**Amendment to tasks 1.2–1.4 and `design.md` D2 (2026-10-11).** Both originally said each variant
would be an **exact copy** of the fixture directory, which is what `notification-probe/` does.
Copying is cheap there because its `probe.js` is a notification attempt and a short control-only
variant can stand in for it. **Copying here would put three copies of the panel-report code on
disk**, and three copies of the file under measurement is the shape this repository records as the
arms not being comparable: one edited and two stale measures three different programs and reports it
as one variable. The committed tree is therefore **one fixture and two partial manifests** under
`variants/`, merged over the base by a shallow `Object.assign`, with the materialised fixtures written
under `test-results/` for the reason `notification-display.mjs`'s header gives for its PNG.

**Amendment to task 2.1 (2026-10-11).** It originally required the fixture to reach the platform
through `Reflect` from `globalThis`, on the reasoning `stored-mailbox.ts` gives about there being no
`@types/chrome` in this package. **That reasoning does not reach a fixture.** The boundary rule
confining the platform global is `chromeGlobalViolationsIn(join(APPS_DIR, "extension", "src"))` —
`apps/extension/src` and nothing else — and both existing fixtures spell `chrome.*` directly and
have done since they were written. Requiring reflection here would be ceremony against a rule never
pointed at this file, and it would leave the fourth fixture the only one of the four written in a
different style from the other three. Task 4.1's wording was corrected with it, since it repeated
the same claim about the same reads.

**Amendment to group 7 and `design.md` D10—D11 (2026-10-11).** Group 7 was written as though
quarantining a probe were one list entry, and it was not. Two of the four tasks in it were **false
on arrival** and were found by the gates rather than by reading:

- **7.1 assumed the boundary suite would pass once the name was listed.** It did not. Adding the
  name made the *script* correct and did nothing about the directory the script *writes*: this
  probe stages a fixture into `apps/extension/test-results/`, and the storage rule reported the
  staged copy for the `chrome.storage.local` calls its own source is written with. **The source
  copy was already exempt** — it lives in a suite's `testDir` — **so the same file was judged
  twice, once correctly and once wrongly, with only the directory differing.** `test-results` is
  now in `SKIP_DIRECTORIES` beside `dist`, `build` and `coverage`, which already carry that
  definition, with a control pair holding it down. See D10.
- **No task in this file anticipated a lint failure at all**, because tasks 2.1–2.4 described
  the fixture as files rather than as the three contexts they run in. `pnpm lint` reported
  `document is not defined` on `launcher.js`: `eslint.config.js` gives a file one environment, and
  the block covering `e2e/fixtures/**` declares a **service worker** because the first fixture was
  one. **Declaring the union was the fix that looks right and is not** — it would have taught
  three existing worker fixtures that `document` exists. The fixture now keeps its document scripts
  under `documents/` and the config matches that shape. See D11.

**Both were found by a gate failing on a tree nobody had broken**, which is the shape this
repository records as the boundary suite earning its place. **Neither was found by any test**, and
a group of tasks that assumed four files would need editing turned out to need six.
