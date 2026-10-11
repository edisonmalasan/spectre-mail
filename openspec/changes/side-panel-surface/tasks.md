# Tasks

## 1. Baseline — measure it, do not carry it forward

- [x] 1.1 Record `pnpm test`'s per-project counts from a `--reporter=json` run grouped by
      project, on this branch, before any file is written. **Every count in this file that names
      one is either "must not move" or "predicted with its arithmetic shown"** — none is
      transcribed from a previous milestone.
- [x] 1.2 Record `pnpm test:browser`'s two tier counts the same way, and the SHA-256 of
      `apps/extension/static/manifest.json`, which task 5.1 changes.
- [x] 1.3 Confirm `pnpm verify` exits `0` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory. **This is the gate the spike's own CI job exists to protect and it must be true
      before the first file is written**, so a red run later is attributable.

## 2. Measure the D6 prediction before anything depends on it

- [x] 2.1 Open the built `sidepanel.html` as a second tab of the extension profile's window,
      bring the fixture page to front, and read what `chrome.tabs.query({ active: true,
      currentWindow: true })` names **from the panel document**. §4.6 measured the substitute
      with the panel document **as the active tab** and recorded that it cannot answer the
      question; D6 predicts that **backgrounding it** can. **Record the result either way, in
      this change's `design.md`, before section 8's cases are written.**
- [ ] 2.2 If the prediction is false, stop and record it. The panel's context behaviour then has
      **no browser-tier coverage**, and that goes into `AGENTS.md`'s limits beside §4.6's own
      rather than being discovered by a reader who counts specs.
- [x] 2.3 Confirm the panel document **runs at all** when served as a tab — and note that this is
      §4.6's first recorded instrument defect repeating itself: a `sidepanel.html` with no
      `<script>` tag reported silence while `open()` resolved. **The first assertion written
      against the panel must be that it reports, not that it renders.**

## 3. The content script's half

- [x] 3.1 Add `HOST_CONTEXT_REQUEST` and its answer to `protocol.ts`, with a narrowing function
      beside every other kind's, and its own entry in the narrowing table `protocol.test.ts`
      already keeps. **A kind in that file with no case was recorded once already** —
      `RECONCILE_ALARM_REQUEST` was read by nothing while every sibling kind had a table — so
      the test is part of the implementation, not a follow-up.
- [x] 3.2 The answer carries a hostname and nothing else. The script reads its own
      `location.hostname` and **no property of the page's DOM**; the requirement forbids `href`,
      pathname, query string and origin, and a case plants a page whose `location` is
      distinguishable from its DOM content so the two sources cannot be confused.
- [x] 3.3 The script **refuses rather than answering with a value it did not read.** A case
      drives a request whose answer is missing and requires no host rather than a falsy one.
- [x] 3.4 Confirm the panel-as-requester half against §4.6's measurement rather than re-deriving
      it: the request goes out over `sendToTab`, which already exists, and **no new transport is
      added**.

## 4. The platform seam

- [x] 4.1 Add `onTabActivated` to `extension-platform.ts`, beside `onAlarmFired` and
      `onBrowserStart`, returning its unsubscribe the way the others do.
- [x] 4.2 Its reader is written through the module's existing reflective `chrome` read. **The
      existing confinement rule is the instrument**: if the panel referenced `chrome.tabs`
      directly the rule reports it by name, which is how "this client holds no `tabs`
      permission" becomes a property of the tree rather than a sentence in a document.
- [x] 4.3 Cases cover: a subscriber is called with the activated tab; unsubscribing stops it; and
      **a platform with no `chrome.tabs.onActivated` is reported rather than thrown**, in the
      same shape `readAlarmPlatform` and `readNotificationPlatform` already use.

## 5. The surface

- [x] 5.1 `static/manifest.json` gains exactly two entries: the `sidePanel` permission and a
      `side_panel` key. **Those two entries and nothing else are what §4.6's control fixture
      differed in**, so the necessity of each was measured. Record the new file's SHA-256 and
      the diff against the baseline from 1.2.
- [x] 5.2 `sidepanel.html` and `apps/extension/src/panel-main.tsx`, with `vite.config.ts` gaining
      one rollup input. **`emptyOutDir: false` is what makes this safe and it is already there**;
      confirm the popup's and the content script's outputs still exist after a build.
- [x] 5.3 Extract `MessageList`, `OpenedMessageView`, `Codes`, `describeSender`, `fillSentence`,
      `CopyState` and `FillReport` into `src/MessageSurface.tsx`. **This is a move and not a
      rewrite**: `Popup.tsx` must render exactly what it rendered, and the stylesheet-coverage
      boundary rule is what catches a hook that was dropped in the move.
- [x] 5.4 `panel-copy.ts`, holding every sentence the panel can say. A case reads each of the
      four claims D9 names and requires the string that makes it to be one a requirement in this
      delta governs.
- [x] 5.5 `Panel.tsx`. The boot read distinguishes **nothing stored** from **could not read**,
      exactly as `Popup.tsx` does — a read reported as absent makes a person with a stored
      address believe they have none, and offers to overwrite the one they came back for.
- [x] 5.6 The panel's current mailbox is the host's association when there is one and the newest
      otherwise (D3), **resolved through the same helper the in-page affordance uses** rather
      than a second spelling of that rule.
- [x] 5.7 The host state is a discriminated union over the four observations D4 names, and **only
      the first offers a mailbox as being that page's.** A case drives each of the other three
      and requires that no association-shaped claim is on screen.
- [x] 5.8 The panel creates a mailbox by **delegating to the worker**, the way the in-page
      affordance does — §4.4 measured that a content script's own `fetch` obeys the page's CORS
      policy, and a panel-hosted document is an extension page, so it may fetch directly
      (§4.6). **That measurement cuts the other way here**, and the reason for delegating anyway
      is written on the code: one context contacts the provider, so the reach a provider grants
      this extension is the reach declared in one manifest and not two paths that can diverge.

## 6. The requirements, read back against the code

- [x] 6.1 For each scenario in `specs/extension-client/spec.md`, name the case that carries it.
      **A scenario with no named case is an omission and must be recorded as one**, not left to
      the promotion.
- [x] 6.2 The same for `specs/in-page-integration/spec.md`'s added requirement.
- [x] 6.3 The non-goals requirement's new scenario — **every document path the manifest declares
      resolves to a file the build emits** — is read against the built `dist`, not the source
      tree. A rule that reads source would pass a build that emitted nothing.
- [x] 6.4 Read the two amended requirement blocks in the promoted specs **against the code as
      written**, not against this delta. A delta that says the right thing and a spec that says
      something else is the same defect as an implementation that says something else.

## 7. Falsification

- [x] 7.1 Run deliberate violations against **every new assertion**, with the instrument outside
      the repository, restoration verified by SHA-256 per mutated file, and `dist/` rebuilt from
      the restored source.
- [x] 7.2 At minimum, one violation per property in D8's table, aimed at the instrument named
      there — **including a violation that makes the existing rules report the panel's own files**,
      because "the rule reaches new code" is only established by watching it fail on new code.
- [x] 7.3 Record every violation that survives, and **read the mutant before filing it**. A
      survivor means "the assertion did not catch this", never "the assertion is too weak", until
      the mutant has been shown to be the thing it claims. Three that were broken mutants are
      recorded in this repository's own history and all three read as coverage gaps on the page.
- [x] 7.4 Watch for the **polarity** defect, which appeared once in this repository's own harness:
      an arm written as "this line must be present" reports a correct configuration as broken
      when the line is removed. Every arm states what its mutation should cause.

## 8. The browser tier

- [x] 8.1 `apps/extension/e2e/side-panel.spec.ts`, collected by the extension's suite **and by
      nothing else** — the existing collection rule covers this, and its own negative control
      says the rule fires for an uncollected spec.
- [x] 8.2 The first case is the one from 2.3: **the panel reports.** Before any assertion about
      what it says.
- [x] 8.3 The context cases ride the arrangement measured in section 2. **If section 2 falsified
      D6, these cases are removed rather than rewritten against something that does not
      reproduce the property.**
- [x] 8.4 A case that the panel requests **no origin the suite did not script**, matching
      `popup.spec.ts`.
- [x] 8.5 The same class-hook sweep the other extension specs run, against the panel's markup.

## 9. Gates

- [x] 9.1

      **Run 1 `exit 0`, run 2 `exit 0`, run 3 `exit 0`**, at `61 test files` and `1182 tests`,
      each with `All matched files use Prettier code style!`. The empty-browser run below is a
      fourth, reported separately.

      **And the reds this repository records at a gate are real, so the honest figure is not
      `three green`.** Two gates failed **during** this task and were fixed rather than
      tolerated: `typecheck` on `e2e/manifest.spec.ts` (`TS2352` — the `content_scripts` element
      was typed for one key and two readers cast it for two different tuple types, and
      `expect(x).toBeDefined()` does not narrow `x | undefined` under
      `noUncheckedIndexedAccess`); `lint` on `react-hooks/set-state-in-effect` at the panel's
      host-resolve effect; three `react-refresh/only-export-components` warnings cleared by
      un-exporting three helpers that had no consumer outside their own file; and
      `format:check` rejecting **two** files edited since Prettier last ran over them.

      **One further `pnpm verify` went red afterwards and was not identified** — `1 failed | 60
      passed`, with the failing file discarded by the wrapper's own summary filter. Fifteen
      subsequent unit runs were green. See `design.md` A16: the claim is *a red was seen and not
      reproduced*, not *the suite is flaky*, because no cause was measured.
      repository has recorded at this stage were `format:check` on files edited since Prettier
      last ran and `lint` on the falsification harness itself; both are real and both were fixed
      rather than tolerated.
- [x] 9.2

      **`exit 0`** at `61 test files` / `1182 tests`, with `PLAYWRIGHT_BROWSERS_PATH` pointed at
      a directory this session created empty and then verified held **0 entries** — so the claim
      is the one `AGENTS.md` asks for: **the unit tier's gates run with no browser installed**.
      The directory was removed afterwards and its absence confirmed.
- [x] 9.3

      **A first block of ten reported `passed=9 failed=1 harness-error=0`** and the second
      reported **`passed=10 failed=0 harness-error=0`**, both at `website=40` (5 files) and
      `extension=78` (9 files), and **both with the 478-file SHA-256 source fingerprint
      unchanged** across its window (`apps/extension/test-results/` excluded, so the comparison
      is not defeated by the profiles the runs themselves write).

      **The red is reported rather than dropped, and so is the instrument defect.** The block
      script kept a three-line grep of a red run's output and discarded the rest; the red was not
      reproduced in **22 further runs** (a dedicated 12-iteration loop, then the second
      ten-run block), and the script was rewritten to keep every run's full output before the
      second block ran. See `design.md` A15.
      files are fingerprinted before and after. **A measurement taken while the tree is moving is
      not a measurement**, and the fingerprint must exclude `apps/extension/test-results/`, which
      the measurement itself churns — a fingerprint that cannot tell a source file from an
      artefact the run creates reports a change every time.
- [x] 9.4

      **Baseline 1.1 was `1093` across `58` files; the tree now measures `1182` across `61`,**
      read from a `--reporter=json` run grouped by project rather than transcribed.

      `apps/extension` **330 → 419 (+89)**: `protocol.test.ts` 64 → **101** (+37, the host
      request and answer members, the guard, the reader and the narrowing table),
      `extension-platform.test.ts` 64 → **70** (+6, `onTabActivated`), `Panel.test.tsx` **new**
      **24**, `content-script-host-context.test.ts` **new 12**,
      `content-script-handlers.test.ts` **new 10**. **Every other extension file is unmoved
      at its baseline count**, including `Popup.test.tsx` **25** and `popup-copy.test.ts` **5** —
      which is the measurement that carries task 5.3, because `MessageSurface.tsx` was a *move*
      and a string changing in either direction would have shown as a movement in both.

      **Four of the five unmoved totals are the point of this task.** `apps/web` is still
      **125** — zero files changed under `apps/web/`, checked with
      `git status --porcelain -- apps/web` returning nothing. `packages/ui` is still **38** for
      the eleventh time, because `design.md` D8 commits this change to **no new token and no new
      motion**. `packages/storage` is still **86**, `packages/mailbox` still **166**,
      `packages/providers` still **92**, `packages/core` still **54**, `packages/mail-parser`
      still **149**. **`tests/architecture` is still 53** — task 8.5 was discharged by the
      existing `unstyledClassHooks()` rule, so no rule was added, and **53 staying at 53 while
      seven unstyled hooks were found and repaired is the measurement that says the decision was
      right**: a rule added where an instrument already exists is not coverage.

      **`Panel.test.tsx` is 24 and not the 23 §7's falsification measured**, because the
      falsification pass found a real gap and the repair added a case. **A count that moves once
      a suite has been falsified is a count that was measuring a tree before its last repair**,
      and it is stated here rather than left for the next reader to reconcile.
      new file and each edited file. **A count that moved for no stated reason is a defect in the
      record, and the promotion is where it surfaces.**
- [x] 9.5

      **`Change 'side-panel-surface' is valid`** and **`Totals: 14 passed, 0 failed (14 items)`**
      — the latter still 14 capabilities, which is what a change that promotes nothing until its
      own sync must show. The three `INFO` lines about requirement text over 500 characters are
      `design.md` prose about long requirements and are pre-existing to this change.
      — the latter must still be **14 passed, 0 failed**, since this change modifies specs and
      promotes nothing until its own sync.

## 10. Deliberately left unticked

- [ ] ~~10.1 Open the extension in a real browser with the panel docked and look at it.~~ An
      agent opening a panel is not the judgement the task asks for, and **no instrument in this
      repository reads a rendered pixel's colour or position** — so this stays unticked for the
      same reason `extension-preview`'s 12.1 and `verification-actions`' 7.2 did.
- [ ] ~~10.2 Measure whether Chromium offers an entry point that opens a panel this extension
      owns (D7).~~ This is **not a human-judgement task and it is not left unticked by choice**:
      it is blocked on a platform UI that Playwright exposes no handle for, and it is recorded as
      an open premise in `design.md` D7 with the two routes that would discharge it.
- [ ] ~~10.3 Confirm a person can reach the panel at all in a headed browser.~~ Same as 10.1 and
      10.2, and the reason it is listed rather than omitted is that a reader counting this list
      should be able to see **which of the three is blocked by the platform and which by the
      absence of a human.**
## Amendments recorded at apply (2026-10-11)

### Verification-pass repairs

**Three bounded repairs requested after `e7d6c32` was accepted. `proposal.md` was not edited.**

- [x] 11.1 Gate the create control on `shown.kind !== "named"` rather than `=== "none"`, so creation
      is offered beside a page this panel cannot name (**the orchestrator's decision**, recorded with
      the option rejected in `design.md` A17).
- [x] 11.2 Give the unnamed page its own copy variant, so no host-specific word is rendered beside a
      page whose host is unknown. `PANEL_COPY.createForHost` is unchanged and still used beside a
      named host.
- [x] 11.3 **Not widen `PANEL_COPY.noMailboxHeld`**, which stays gated on `none`, and say why in the
      code: beside an unnamed page *"this device has no address yet"* is false. Left the `held` list
      at `held.length > 1` alone, as instructed.
- [x] 11.4 Five cases in `Panel.test.tsx` (**24 → 29**): creation offered and delegated to the
      background context; no mailbox offered as being that page's; no claim that this device holds
      nothing; the copy names no host; and **both unnamed arms in one case** — the fifth was added
      with 11.11 and is the only one that holds both `unanswered` and `refused`.
- [x] 11.5 Amend the delta at `specs/extension-client/spec.md` in *"beside a page this extension does
      not reach"* so it **names** creation rather than saying only *"the rest of the panel SHALL
      continue to work"*.
- [x] 11.6 Falsify every new assertion. **Nine arms: eight caught by the assertion aimed at, one a
      logically identical rewrite recorded as evidence and not counted** — and of the eight, one is
      caught by a positive control rather than by the assertion it was first declared against.
      Restorations SHA-256 verified; the instrument outside the repository and deleted.
- [x] 11.7 **Repair a vacuous absence assertion this repair authored** — `queryByTestId` returns
      `null` when no element carries the id, so *"no address section"* was satisfied by the section
      having no id. Positive control added in the arm where the section *is* shown.
- [x] 11.8 **Measure what holds the guard the case names**, rather than assert it: `tsc --noEmit` exits
      `1` with `TS2339` when the `shown` memo's early return is removed, while the unit tier reports
      the same mutation `caught` — because `pnpm test` does not typecheck. `design.md` A18.
- [x] 11.9 One bounded attempt at the two unreproduced reds in A15/A16: **10 × `pnpm test:browser` and
      5 × `pnpm test`** through a capturing instrument that records the full output, the **name** of
      any failing case, and the exit code, with `apps/extension/test-results/` excluded from the
      source fingerprint. Result recorded as a rate with its denominator.
- [x] 11.10 Record — **not fix** — that `apps/web/e2e/sections.spec.ts:939-949`'s comment is false in
      its clause *"no side panel are built (M9 and M11 own them)"* while the assertion still passes.
      `apps/web` is zero files in this change. `design.md` A19.
- [x] 11.11 Close the **sibling** unnamed scenario too — **the orchestrator's second decision**. I
      amended only the scenario named in repair 1 and reported that leaving `"No answer arrives"`
      silent would permit an implementation offering creation for a refused page and withholding it
      for an unanswered one, which `Panel.tsx:276`'s single `{ kind: "unnamed" }` makes impossible.
      Both scenarios now say the same four things about creation; **the two host-line wordings stay
      distinct**, and `design.md` A17 records why that distinction lives in the copy and not in what
      the panel offers.

**No task in this pass is left unticked.** The four unticked boxes are unchanged: **2.2**, whose
condition never fired (its prediction held, so nothing it asks for was done), and **10.1, 10.2,
10.3**, which are struck through because a human judgement and two platform handles are what they ask
for and no agent run supplies either.

### The apply-stage amendments

**Section 1 was measured before the first file was written**, so a red run later is attributable to
this change rather than to a tree that was already broken. The figures: **1093 unit tests across 58
files** from a `--reporter=json` run grouped by project — `apps/extension` 330, `apps/web` 125,
`packages/core` 54, `packages/mail-parser` 149, `packages/mailbox` 166, `packages/providers` 92,
`packages/storage` 86, `packages/ui` 38, `tests/architecture` 53 — with `numFailedTests: 0`; the
browser tier at **40 website and 67 extension cases**; `manifest.json` SHA-256
`ae14f1a3e7f9049ff9ef94cb1ee6080ef291b1cf4ed931b39721cd207f6dcb78`; and `pnpm verify` exiting `0`
with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory.

**Task 2.2 is deliberately left unticked rather than ticked as satisfied.** It is conditional — *if
the prediction is false* — and the prediction **held**, so nothing it asks for was done. Ticking it
would assert an action this change did not take, and the unticked box is the record that the
fallback clause was never needed. **What 2.2 would have required is stated in `design.md` A1** so a
reader who wants the falsified branch still has it: no browser-tier coverage, and the limit beside
§4.6's own in `AGENTS.md`.

**Task 2.1's result is in `design.md` A1**, including the two defects in the instrument — one of
which **reported the prediction false while every one of its own diagnostic lines printed true**, and
is the recorded instance of a polarity error in which the obvious repair is to delete the thing that
was right.
