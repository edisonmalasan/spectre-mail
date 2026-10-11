# Tasks

## 1. Baseline — measure it, do not carry it forward

- [ ] 1.1 Record `pnpm test`'s per-project counts from a `--reporter=json` run grouped by
      project, on this branch, before any file is written. **Every count in this file that names
      one is either "must not move" or "predicted with its arithmetic shown"** — none is
      transcribed from a previous milestone.
- [ ] 1.2 Record `pnpm test:browser`'s two tier counts the same way, and the SHA-256 of
      `apps/extension/static/manifest.json`, which task 5.1 changes.
- [ ] 1.3 Confirm `pnpm verify` exits `0` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory. **This is the gate the spike's own CI job exists to protect and it must be true
      before the first file is written**, so a red run later is attributable.

## 2. Measure the D6 prediction before anything depends on it

- [ ] 2.1 Open the built `sidepanel.html` as a second tab of the extension profile's window,
      bring the fixture page to front, and read what `chrome.tabs.query({ active: true,
      currentWindow: true })` names **from the panel document**. §4.6 measured the substitute
      with the panel document **as the active tab** and recorded that it cannot answer the
      question; D6 predicts that **backgrounding it** can. **Record the result either way, in
      this change's `design.md`, before section 8's cases are written.**
- [ ] 2.2 If the prediction is false, stop and record it. The panel's context behaviour then has
      **no browser-tier coverage**, and that goes into `AGENTS.md`'s limits beside §4.6's own
      rather than being discovered by a reader who counts specs.
- [ ] 2.3 Confirm the panel document **runs at all** when served as a tab — and note that this is
      §4.6's first recorded instrument defect repeating itself: a `sidepanel.html` with no
      `<script>` tag reported silence while `open()` resolved. **The first assertion written
      against the panel must be that it reports, not that it renders.**

## 3. The content script's half

- [ ] 3.1 Add `HOST_CONTEXT_REQUEST` and its answer to `protocol.ts`, with a narrowing function
      beside every other kind's, and its own entry in the narrowing table `protocol.test.ts`
      already keeps. **A kind in that file with no case was recorded once already** —
      `RECONCILE_ALARM_REQUEST` was read by nothing while every sibling kind had a table — so
      the test is part of the implementation, not a follow-up.
- [ ] 3.2 The answer carries a hostname and nothing else. The script reads its own
      `location.hostname` and **no property of the page's DOM**; the requirement forbids `href`,
      pathname, query string and origin, and a case plants a page whose `location` is
      distinguishable from its DOM content so the two sources cannot be confused.
- [ ] 3.3 The script **refuses rather than answering with a value it did not read.** A case
      drives a request whose answer is missing and requires no host rather than a falsy one.
- [ ] 3.4 Confirm the panel-as-requester half against §4.6's measurement rather than re-deriving
      it: the request goes out over `sendToTab`, which already exists, and **no new transport is
      added**.

## 4. The platform seam

- [ ] 4.1 Add `onTabActivated` to `extension-platform.ts`, beside `onAlarmFired` and
      `onBrowserStart`, returning its unsubscribe the way the others do.
- [ ] 4.2 Its reader is written through the module's existing reflective `chrome` read. **The
      existing confinement rule is the instrument**: if the panel referenced `chrome.tabs`
      directly the rule reports it by name, which is how "this client holds no `tabs`
      permission" becomes a property of the tree rather than a sentence in a document.
- [ ] 4.3 Cases cover: a subscriber is called with the activated tab; unsubscribing stops it; and
      **a platform with no `chrome.tabs.onActivated` is reported rather than thrown**, in the
      same shape `readAlarmPlatform` and `readNotificationPlatform` already use.

## 5. The surface

- [ ] 5.1 `static/manifest.json` gains exactly two entries: the `sidePanel` permission and a
      `side_panel` key. **Those two entries and nothing else are what §4.6's control fixture
      differed in**, so the necessity of each was measured. Record the new file's SHA-256 and
      the diff against the baseline from 1.2.
- [ ] 5.2 `sidepanel.html` and `apps/extension/src/panel-main.tsx`, with `vite.config.ts` gaining
      one rollup input. **`emptyOutDir: false` is what makes this safe and it is already there**;
      confirm the popup's and the content script's outputs still exist after a build.
- [ ] 5.3 Extract `MessageList`, `OpenedMessageView`, `Codes`, `describeSender`, `fillSentence`,
      `CopyState` and `FillReport` into `src/MessageSurface.tsx`. **This is a move and not a
      rewrite**: `Popup.tsx` must render exactly what it rendered, and the stylesheet-coverage
      boundary rule is what catches a hook that was dropped in the move.
- [ ] 5.4 `panel-copy.ts`, holding every sentence the panel can say. A case reads each of the
      four claims D9 names and requires the string that makes it to be one a requirement in this
      delta governs.
- [ ] 5.5 `Panel.tsx`. The boot read distinguishes **nothing stored** from **could not read**,
      exactly as `Popup.tsx` does — a read reported as absent makes a person with a stored
      address believe they have none, and offers to overwrite the one they came back for.
- [ ] 5.6 The panel's current mailbox is the host's association when there is one and the newest
      otherwise (D3), **resolved through the same helper the in-page affordance uses** rather
      than a second spelling of that rule.
- [ ] 5.7 The host state is a discriminated union over the four observations D4 names, and **only
      the first offers a mailbox as being that page's.** A case drives each of the other three
      and requires that no association-shaped claim is on screen.
- [ ] 5.8 The panel creates a mailbox by **delegating to the worker**, the way the in-page
      affordance does — §4.4 measured that a content script's own `fetch` obeys the page's CORS
      policy, and a panel-hosted document is an extension page, so it may fetch directly
      (§4.6). **That measurement cuts the other way here**, and the reason for delegating anyway
      is written on the code: one context contacts the provider, so the reach a provider grants
      this extension is the reach declared in one manifest and not two paths that can diverge.

## 6. The requirements, read back against the code

- [ ] 6.1 For each scenario in `specs/extension-client/spec.md`, name the case that carries it.
      **A scenario with no named case is an omission and must be recorded as one**, not left to
      the promotion.
- [ ] 6.2 The same for `specs/in-page-integration/spec.md`'s added requirement.
- [ ] 6.3 The non-goals requirement's new scenario — **every document path the manifest declares
      resolves to a file the build emits** — is read against the built `dist`, not the source
      tree. A rule that reads source would pass a build that emitted nothing.
- [ ] 6.4 Read the two amended requirement blocks in the promoted specs **against the code as
      written**, not against this delta. A delta that says the right thing and a spec that says
      something else is the same defect as an implementation that says something else.

## 7. Falsification

- [ ] 7.1 Run deliberate violations against **every new assertion**, with the instrument outside
      the repository, restoration verified by SHA-256 per mutated file, and `dist/` rebuilt from
      the restored source.
- [ ] 7.2 At minimum, one violation per property in D8's table, aimed at the instrument named
      there — **including a violation that makes the existing rules report the panel's own files**,
      because "the rule reaches new code" is only established by watching it fail on new code.
- [ ] 7.3 Record every violation that survives, and **read the mutant before filing it**. A
      survivor means "the assertion did not catch this", never "the assertion is too weak", until
      the mutant has been shown to be the thing it claims. Three that were broken mutants are
      recorded in this repository's own history and all three read as coverage gaps on the page.
- [ ] 7.4 Watch for the **polarity** defect, which appeared once in this repository's own harness:
      an arm written as "this line must be present" reports a correct configuration as broken
      when the line is removed. Every arm states what its mutation should cause.

## 8. The browser tier

- [ ] 8.1 `apps/extension/e2e/side-panel.spec.ts`, collected by the extension's suite **and by
      nothing else** — the existing collection rule covers this, and its own negative control
      says the rule fires for an uncollected spec.
- [ ] 8.2 The first case is the one from 2.3: **the panel reports.** Before any assertion about
      what it says.
- [ ] 8.3 The context cases ride the arrangement measured in section 2. **If section 2 falsified
      D6, these cases are removed rather than rewritten against something that does not
      reproduce the property.**
- [ ] 8.4 A case that the panel requests **no origin the suite did not script**, matching
      `popup.spec.ts`.
- [ ] 8.5 The same class-hook sweep the other extension specs run, against the panel's markup.

## 9. Gates

- [ ] 9.1 `pnpm verify` — **three times, and every one of them counted.** The reds this
      repository has recorded at this stage were `format:check` on files edited since Prettier
      last ran and `lint` on the falsification harness itself; both are real and both were fixed
      rather than tolerated.
- [ ] 9.2 `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory.
- [ ] 9.3 `pnpm test:browser`, then **ten consecutive runs in one block**, on a tree whose source
      files are fingerprinted before and after. **A measurement taken while the tree is moving is
      not a measurement**, and the fingerprint must exclude `apps/extension/test-results/`, which
      the measurement itself churns — a fingerprint that cannot tell a source file from an
      artefact the run creates reports a change every time.
- [ ] 9.4 Account for every moved test count by arithmetic from the 1.1 baseline, naming each
      new file and each edited file. **A count that moved for no stated reason is a defect in the
      record, and the promotion is where it surfaces.**
- [ ] 9.5 `openspec validate side-panel-surface --strict` and `openspec validate --specs --strict`
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