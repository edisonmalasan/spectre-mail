# Tasks

**Read `design.md` D6 before starting group 3.** This change's deliverable is an instrument, so the
tasks that matter most are the ones proving the instrument *can* report a wrong answer — the repo
has recorded an instrument answering confidently and wrongly four separate times, and one of them
printed `undefined ms` for three arms without a single run going red.

## 1. Fixtures — three of them, one variable each

- [ ] 1.1 Create `apps/extension/e2e/fixtures/side-panel-probe/manifest.json` declaring `sidePanel`, `storage`, `side_panel.default_path`, a background worker, and the two provider host patterns; verify by reading it that every entry beyond MV3 boilerplate is one D8 names, and that its `description` states why the fixture holds rights the product does not
- [ ] 1.2 Create `side-panel-probe/control/` as an exact copy differing in **exactly two** entries — no `sidePanel` permission and no `side_panel` key — and verify by reading both manifests side by side that nothing else differs
- [ ] 1.3 Create `side-panel-probe/tabs/` as an exact copy differing in **exactly one** added entry, `tabs`; verify the same way
- [ ] 1.4 Verify the three-way claim mechanically rather than by reading: a script that parses all three manifests and reports which keys differ from the base, asserting the differences are `{permissions: −sidePanel, −side_panel}` for `control/` and `{permissions: +tabs}` for `tabs/`; run it from the temp directory, **not** committed — a diff check committed beside the fixtures would be a second thing to keep in step with them

## 2. The probe surface and the readback channel

- [ ] 2.1 Create `side-panel-probe/probe.js`, a service worker that publishes a probe surface on its own global and reflects the platform from `globalThis` — no `@types/chrome` exists in this package and `stored-mailbox.ts` gives the reason at length; verify by reading it that no API is spelled directly
- [ ] 2.2 Create `side-panel-probe/sidepanel.html` and its script, which publish a report of what the panel-hosted document can see into `chrome.storage.local` under one key; verify by reading the record back through the worker's own API in a first driver run
- [ ] 2.3 Create `side-panel-probe/launcher.html` carrying one button whose handler calls `chrome.sidePanel.open({ tabId })` for its own window — **the gesture D3 requires**, and the reason `openPanelOnActionClick` is not used instead; verify a Playwright `click()` on it satisfies the platform's gesture requirement rather than merely appearing to
- [ ] 2.4 Verify the surface readback works end to end before any measurement is trusted: a run that reads the worker's surface and the storage key back through `worker.evaluate(...)`, the same handle `background-state.ts` uses — **a channel that does not read anything back makes every later arm's empty answer ambiguous**

## 3. The driver, and the honesty of its exit code

- [ ] 3.1 Create `apps/extension/e2e/side-panel-runtime.mjs` with the load flags **spelled** rather than imported — `extensionFlags()` is TypeScript and a plain `.mjs` cannot import it, exactly as the two existing probes record; verify the boundary rule covering flag agreement still passes with this file added
- [ ] 3.2 Give the driver the notification probe's `ms()`-equivalent: a duration formatter that **throws** rather than rendering a non-number, because `String(undefined).padStart(6,"0")` is how three arms once reported `undefined ms` with nothing red
- [ ] 3.3 Implement the exit code of D6 — `0` only when **every** arm produced an observation, `1` when any arm came back empty, and a distinct printed outcome for *"unmeasurable on this substrate"* that is neither an answer nor a silent pass; verify by enumerating the arms the run claims and requiring the count to match
- [ ] 3.4 Implement the conservative verdict function: `answerable: false` unless the control arm established the API's **presence**, on the alarms probe's recorded lesson that a control sharing the resource under measurement is a confound; verify a verdict computed against a control reporting absence comes back `answerable: false`

## 4. The arms

- [ ] 4.1 Arm **API presence** across all three fixtures, reading `chrome.sidePanel` reflectively; verify the control arm reports `undefined` while `base/` reports present — **if all three report absent, stop and record that instead, because every later arm would then be about an API that is not there**
- [ ] 4.2 Arm **D4's two observations**: the outcome of the `open()` call itself, and the panel's own report read back from storage; verify both are recorded separately and that a run holding only the first is reported as having measured nothing
- [ ] 4.3 Arm **what a panel-hosted document sees**: `chrome.windows.getCurrent()`, `chrome.tabs.query({active:true, currentWindow:true})`, and `tab.url` — run in `base/` and again in `tabs/`, so the cost of route (b) is measured rather than argued; verify the two runs are reported side by side and not collapsed
- [ ] 4.4 Arm **`sendMessage` to the active tab**, including the arm against a window whose active tab carries **no content script**, so "the panel cannot reach this page" is a recorded answer and not a hang; verify the no-content-script arm completes and says so
- [ ] 4.5 Arm **D5's driven tab switch**: switch the fixture window's active tab, then read the panel's report **a second time**, and report the pair; verify the second read is what proves the panel re-evaluated rather than a listener being registered
- [ ] 4.6 Arm **the substitute**, `sidepanel.html` opened as a tab in the fixture window with the content-script page brought to front — the recorded popup substitute, run here because it decides whether M11's browser tier can verify a panel at all; verify its output is labelled a substitute in the run's own text, not only in a comment
- [ ] 4.7 Run every arm and capture the output **verbatim** to a file outside the repository; verify by reading that file back rather than reconstructing any value from memory — this repository has recorded counts transcribed rather than measured three times

## 5. Falsifying the instrument

- [ ] 5.1 Break the panel's report write — have `sidepanel.js` publish nothing — and require the run to **exit non-zero reporting that it measured nothing**, rather than reporting an empty observation; verify the run's exit code, not just its prose
- [ ] 5.2 Break the readback — have `probe.js` publish a surface whose report key never resolves — and require the same non-zero exit; verify it, because a broken readback and a broken write produce the same empty output from the driver's point of view and only one of them is the driver's own fault
- [ ] 5.3 Point the driver at the `control/` fixture alone and require every arm to report `answerable: false`; **this is the negative control the whole run rests on**, and a run that answered anything under the control would invalidate every other arm
- [ ] 5.4 Restore each fixture from a SHA-256 digest taken before the falsification edits and verify restoration, reporting restoration **separately** from measurement — the recorded `archive-bytes` defect is a run reporting a tree that is not the one it claims to have measured
- [ ] 5.5 Delete any throwaway spec or script the falsification wrote inside the repository before continuing; verify by fingerprint over source files that group 6's run is on a tree no measurement left behind

## 6. Recording the result

- [ ] 6.1 Write `docs/PROVIDERS.md` **§4.6** from the captured output, one table row per arm, and **require every row to carry its own "What it does not establish" entry** — that column is why §4 exists and a row without one is the failure §4.1's format was built to prevent
- [ ] 6.2 Add a §5.2 row for whatever the run leaves open, and state **which** arms closed it; closing one gap is not the same act as having none, and `alarms-packing-interval`'s replacement row is the precedent
- [ ] 6.3 Touch §6 only if a finding actually moves a roadmap consequence, and quote the finding rather than its implication
- [ ] 6.4 Record the run's own limits in §4.6's prose in the same words the script prints them — the panel is not a rendered pixel, a docked panel is not a page Playwright can see, and headless Chromium is not a desktop

## 7. Quarantine and the repository gates

- [ ] 7.1 Add `"side-panel-runtime.mjs"` to `QUARANTINED_PROBES` in `tests/architecture/boundaries.test.ts` with a comment naming why it is quarantined, in the same shape as the three beside it; verify `pnpm test tests/architecture` passes and that the existing assertions — filename, no suite collects it, no manifest names it, and the **flag agreement** check — cover this probe **without a line being added for them**
- [ ] 7.2 Verify `pnpm verify` exits `0` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and that `pnpm test` reports the **same total and file count** as before this change, measured from `--reporter=json` grouped by project rather than read off a summary line
- [ ] 7.3 Verify `pnpm test:browser` still reports **40 website and 67 extension** cases — the fixture directories are not collected by any suite, and the boundary rule requiring every shipped `*.spec.ts` to be collected by exactly one browser suite is what proves it
- [ ] 7.4 Verify `apps/extension/static/manifest.json` is byte-identical to its pre-change digest, and that no file under `apps/extension/src/` was modified — **the cheapest possible check that this change stayed a measurement**
- [ ] 7.5 Run `openspec validate side-panel-runtime-facts --type change --strict`, and re-read `AGENTS.md` and `docs/ROADMAP.md` for any statement this change makes false; correct the statement rather than the requirement if one is found