# Tasks

## 1. Make the fixtures say what was measured

- [x] 1.1 Repair `guerrillaLiveList`'s envelope in `packages/providers/src/fixtures.ts`:
      the listing echoes the address under `email`, and `email_addr` appears only on
      `get_email_address`. Leave the recorded `list` entry byte-identical.
- [x] 1.2 Correct that fixture's docblock. It currently claims *"the session's own
      address echoed back"* and *"the echoed address is the only evidence available"*,
      and both are false as written.
- [x] 1.3 Repair `guerrillaDeadSession` to the measured dead body: a top-level `error`
      string, `auth.success: true` with `error_codes: []`, and **no** `list` and **no**
      `sid_token`. Remove the two invented fields (`sid_token` and
      `auth.session_id: "expired"`) and correct the docblock, which claims *"an empty
      list, no `error`"*.
- [x] 1.4 Add `guerrillaEmptyLiveList`: the body captured on 2026-11-18 after deleting
      the provider's welcome message, with the address and token normalised to the
      file's own constants and the envelope otherwise verbatim — including `count: 0`
       as a number. Docblock begins `MEASURED` and names the capture date.

       **1.1—1.4 measured together**, because they are one edit to one file: the diff is
       **+58 / −11** across the three bodies, `guerrillaSessionCreated` is untouched
       (`createMailbox` reads it and it was already right), and `fixtures.test.ts`'s
       provenance scan moved **19 — 20** and is **3 of 3 green**. **The red these repairs
       produce is 1.5's**, which is why 1.5 was run before the adapter was touched: a
       fixture repair whose consequence is never measured is a change to a test's inputs
       with no statement about what the test now says.
- [x] 1.5 Run the providers suite **before touching the adapter** and record the red:
      which cases fail, on which assertion, and why the old code cannot pass them.
      `fixtures.test.ts` must still report every exported fixture labelled, with its
      count moved by one.

      **The command this task named runs nothing, and that is a defect in the task.**
      `pnpm --filter @spectre-mail/providers test` exits `0` and prints nothing, because
      that package declares only `typecheck` in its `package.json` — so a stage that read
      the exit code would have recorded a green that measured nothing. **The instrument
      is the root runner with a path filter**: `pnpm exec vitest run packages/providers`.
      Corrected here rather than reinterpreted in a report, for the reason this
      repository records about a task that names a number and is wrong about it.

      **Measured: `5 failed | 87 passed (92)` in `guerrilla.test.ts`**, and every one of
      the five is the same throw — `MAILBOX_EXPIRED` raised by `sessionIsLive` because
      the repaired `guerrillaLiveList` no longer carries `email_addr`:

      - `guerrilla adapter conformance > lists a mailbox's messages without their bodies`
      - `guerrilla adapter conformance > preserves a subject the provider sent empty`
      - `Guerrilla Mail adapter > carries no state between mailboxes through one adapter instance`
      - `Guerrilla Mail adapter > sends the session on every call that needs it`
      - `Guerrilla Mail adapter >` ``reads `mail_read: "0"` as unread``

      **`fixtures.test.ts` is 3 of 3 green and the package total is 92, unmoved**, which
      is the measurement that this task added a fixture and no case.

      **And the finding is not the five reds. It is the four greens.** Twenty-two cases
      passed, and four of them passed because they agree with the bug rather than with
      the provider: `treats a session reporting a different address as dead`,
      `matches the address case-insensitively` and `returns a genuinely empty list for a
      live session` each **hand-build a body carrying `email_addr`** (lines 154, 177 and
      200), a key no listing sends, so repairing the shared fixture could not reach them;
      and `reports a dead session as expired rather than as an empty inbox` reads the
      repaired dead fixture and still passes, but **on the absence of an address rather
      than on the measured `error`** — and its `toContain("empty inbox")` assertion is
      what holds the adapter's false description in place. Task 3.3 rewires all four.

      **The false statement, quoted from the failing run rather than described**: *"It
      answers an expired session with an empty inbox and no error, so the empty list is
      not evidence that the mailbox is empty."* The measured dead body carries an `error`
      and **no `list` at all**, so both halves of that sentence are false. `design.md`
      D10 names three statements; this is the fourth, and task 3.2 amends D10 to say so.

## 2. Reproduce it in the browser tier

- [x] 2.1 Run the website browser tier with the repaired fixtures and the unfixed
      adapter. Record which case goes red and on what — the tier that observed the
      defect live must be able to see it offline.

      **Measured: `15 failed | 43 passed (58)` in 3.6 minutes**, and every one of the
      fifteen is the same defect wearing fifteen hats. `restore()` lists once, the
      adapter throws `MAILBOX_EXPIRED`, and the page renders the gone-state, so
      `getByTestId("ready")` never appears (4 `mailbox-history`, 1 `storage`) and no
      `.inbox-row` ever renders (5 `motion`, 1 `surface-hierarchy`, 3
      `verification-actions`, and 1 `focus` case that never reaches its one-time-code
      control because there is no message to open).

      **This is a clean A/B and not a claim about the tier.** PR #201's `browser` job
      was green on the **unrepaired** fixtures; the only thing that changed between that
      green and this red is `packages/providers/src/fixtures.ts`. So the tier that
      observed the defect live on 2026-11-18 can see the same defect offline, which is
      the precondition for trusting it after the repair.

      **The tier was run alone rather than through the root command.** `pnpm
      test:browser` chains the two tiers with `&&`, so the website's red would have
      prevented the extension tier from running at all — and task 2.2 would then have
      reported a number it never measured. `pnpm --filter @spectre-mail/web test:browser`
      after `pnpm build` and `pnpm --filter @spectre-mail/extension build:fixture`.
- [x] 2.2 Run the extension browser tier and record whether any case reaches the
      Guerrilla listing path. If none does, say so rather than implying coverage: the
      extension's fallback failure is inferred from shared code.

      **Measured: `10 failed | 96 passed (106)` in 5.6 minutes — and the answer to this
      task's question is yes.** The extension does reach the Guerrilla listing path, so
      its failure here is observed rather than inferred from shared code:

      - `popup.spec.ts:237` — *falls back to Guerrilla Mail and names it, not the
        provider it preferred* — fails at `:253` on `locator(".popup__address")` with
        *element(s) not found*, expecting the measured `GUERRILLA_ADDRESS`;
      - `popup.spec.ts:496` — *the popup's hierarchy > makes the address the largest
        datum* — same locator, same absence;
      - **seven** `side-panel.spec.ts` cases under *what the panel states about a message
        nobody opened*, plus *the panel's hierarchy > gives a message four fields*, all
        failing inside `createHere` (`side-panel.spec.ts:532`) waiting for
        `locator(".panel__address")` to match `/@/` for its full 30 000 ms ceiling.

      **The 30-second ceiling is why the tier took 5.6 minutes rather than seconds**, and
      it is worth naming rather than leaving as a slow run: nine of the ten failures wait
       out a budget before reporting an element that never arrived. **No case was edited to
       make this pass** — the repair belongs to the adapter and task 3 is where it lands.

       **And the same count came back a second time for a different reason, which is the
       finding this section exists for.** After task 3 landed, the tier went red again at
       `10 failed | 96 passed (106)` in **6.0 minutes** — the same count, the same
       duration, and **not the same defect**. The first red was `MAILBOX_EXPIRED` on the
       listing. The second was **creation** failing with `UNKNOWN_PROVIDER_ERROR`, because
       this tier's own script table answered *every* Guerrilla URL with `guerrillaLiveList`,
       and that body carried `email_addr` only while the fixture was wrong.

       **A count that matches is not a cause that matches**, and nothing in the summary line
       could tell the two apart — not the count, not the duration, not the failing case
       names, which were identical. **What separated them was reading the popup's own
       accessibility snapshot**, which said *"Addresses this session created: 0"* and named
       `UNKNOWN_PROVIDER_ERROR` where the first red had shown a mailbox reported gone. Task
       2.3 is that repair.

- [x] 2.3 Repair the extension tier's script table so creation is answered with the
      **creation** body. **Added during apply**, because task 1.1 revealed it: the table
      held one entry for the whole Guerrilla host, and it was correct only while the
      listing fixture carried a key no listing sends.

      `apps/extension/e2e/recorded-provider.ts:164` was
      `[GUERRILLA_AJAX, recorded(guerrillaLiveList)]` — one prefix for every operation.
      `createMailbox` reads `email_addr` and `sid_token`, so a creation request answered
      with a *listing* succeeded by accident; once 1.1 removed the invented `email_addr`
      it failed as *"Guerrilla Mail returned no address for a new mailbox"*, and every
      fallback case reported `UNKNOWN_PROVIDER_ERROR`.

      **The repair is a third branch in the seam that already told operations apart**, not
      a new mechanism: `GUERRILLA_CREATE_OPERATION` is named beside the listing and read
      operations, and the branch answers `get_email_address` with
      `guerrillaSessionCreated`. **`SCRIPT`'s bare-host entry is deliberately left alone**,
      because it is the documented default for an *unstaged* body read — the
      `carriesNothing` verdict depends on a read being answered by a listing that has no
      body field — so keying `SCRIPT` by operation would have broken that default.
      The seam's own docblock said *"two operations"* and is corrected to three: that
      sentence went stale the moment creation needed the same treatment, which is the
      same class of prose this change exists to correct.

      **Measured: `106 passed (1.5m)`**, from `10 failed | 96 passed (6.0m)`. The six
      minutes were eight 30-second ceilings in `createHere` waiting for an address that
      could never be created — which is why the duration was identical on both reds
      and could not distinguish them either.

      **The website's table already did this**, and that is what makes the extension's an
      outlier rather than a convention: `apps/web/e2e/recorded-provider.ts:73—74` keys
      `get_email_address` and `check_email` to their own fixtures. **The two fixtures name
      the same address and the same token**, so this repair changed *which body answers*
      and nothing a person would see — which is why the tier's own assertions needed
      no edit.

## 3. Repair the adapter

- [x] 3.1 Rewrite `sessionIsLive` in `packages/providers/src/guerrilla.ts` to the
      measured signals: a top-level `error` string, a `list` that is not an array, and
      an echoed address that is present and disagrees. An absent address is **not**
      evidence of death. Keep `GuerrillaListResponse` honest about which keys it reads.

      **Done, and the shape is three checks in one order.** An `error` string is
      answered first because it is the clearest signal the provider sends; a `list`
      that is not an array is answered next, because a live listing always carries one
      even when it is empty; and an echoed address decides only when it is present,
      with an absent address returning `true`. `GuerrillaListResponse` now declares
      `email` rather than `email_addr`, with a docblock that says why: measured
      2026-11-18, `email_addr` appears only on `get_email_address`.

      **`createMailbox` still reads `email_addr` and that is correct** — it reads the
      creation response, which is the one call that sends the key. The bug was not that
      the adapter knew the key; it was that the liveness check asked the listing for a
      key only creation sends.
- [x] 3.2 Correct the shipped statements that repeat the refuted shape. **Five, not the
      three this task first named** — the module docblock (`guerrilla.ts:14–18`), the
      function docblock (`:220–237`), the comment in `guerrilla.test.ts:138–148`, the
      `MAILBOX_EXPIRED` description (`:363–366`), and the comment beside the
      conformance dead-session case (`conformance.ts:284–290`).

      **The two the task did not name were found by searching for the phrase rather
      than by reading the list**, and `design.md` D10 is amended to five with that
      recorded. The description mattered most: it said the provider answers *"with an
      empty inbox and no error"*, which is false in both halves, and it is the sentence
      a person reads when their own mailbox is reported gone. It now ends *"not an empty
      inbox and the mailbox's contents are unknown"*, and `guerrilla.test.ts:149`
      asserts `toContain("no longer recognises")` so the old sentence cannot come back.

      **A sweep of `packages/`, `apps/`, `tests/`, `docs/` and `openspec/` for the same
      phrase found eight further occurrences, reported rather than edited**:
      `packages/mailbox/src/session.ts:62`, `adoption.test.ts:10` and `:296`,
      `packages/storage/src/contract.ts:53`, `packages/storage/src/index.ts:29`,
      `apps/extension/src/Popup.tsx:229`, `apps/extension/src/panel-copy.ts:178`,
      `apps/web/src/App.tsx:39`, plus three promoted requirements, of which
      `provider-adapters/spec.md:186` is the one this change's delta replaces at sync.

      **Two of those eight stopped being out of scope, and the reason is the test for
      it**: `adoption.test.ts` went red under the repaired adapter, so it is task 3.5.
      **A fixture the fix reds is in scope by definition**, whatever the sweep that found
      it concluded before the fix existed. **Six files and three requirements remain
      reported and unedited**, and `session.ts:62` is the one a reader will meet first.
- [x] 3.3 Rewrite the unit cases: the empty-live case drives `guerrillaEmptyLiveList`
      rather than a hand-built body, the different-address case uses `email`, and a
      case is added for a listing that names no address at all and must stay live.

      **Done, and one case was found that the task did not name.** `carries no state
      between mailboxes through one adapter instance` hand-built a second mailbox body
      with `email_addr`, so it failed for the same reason the fixture did; it now sends
      `email`. **A task that names the fixtures and not the inline bodies is a task that
      names half the problem** — the sweep for `email_addr` in the test file is what found
      it, and it is the reason the pre-fix run went red at five cases rather than four.

      **Measured before the fix: `5 failed | 87 passed (92)`.** The five were the
      conformance cases *lists a mailbox's messages without their bodies* and
      *preserves a subject the provider sent empty*, plus *carries no state between
      mailboxes*, *sends the session on every call that needs it* and *reads
      `mail_read: "0"` as unread*. **And four cases stayed green that should not have,
      which is the finding rather than a footnote**: three hand-built `email_addr`
      inline, and the dead-session case passing on absence-of-address while its
      `toContain("empty inbox")` assertion held the false description in place.

      **Measured after: `93 passed (7 files)`**, one more than the pre-fix 92 by exactly
      the new case, with `pnpm --filter @spectre-mail/providers typecheck` at exit `0`.
      The instrument is `pnpm exec vitest run packages/providers`: **`pnpm --filter
      @spectre-mail/providers test` does not exist** — that package declares only
      `typecheck`, so the command exits `0` and runs nothing. Task 1.5 was corrected in
      place for the same reason, and a green exit code from a script that does not exist
      is the shape this repository records as a check that did not run.
- [x] 3.4 Confirm the conformance dead-session case still reaches `MAILBOX_EXPIRED`
      and the `authFailure` slot still satisfies its own case, which asserts only that
      a rejected credential is neither success nor `MESSAGE_NOT_FOUND`.

      **Confirmed by reading the assertions rather than by reading the green**, and both
      are stronger than this task's wording:

      - the dead-session case asserts `expect(result).toBeDefined()` (`:293`) and
        `expect(result?.code).toBe(NormalizedErrorCode.MAILBOX_EXPIRED)` (`:298`), so it
        cannot pass on an unclassified provider error or on a throttle;
      - the `authFailure` slot asserts the error is defined, that `error.provider` names
        the provider (`:240`), and that the code is in a **two-code allowlist** of
        `AUTH_FAILED` or `MAILBOX_EXPIRED` (`:241–243`) — not merely *"not success
        and not `MESSAGE_NOT_FOUND`"*, which is how this task described it. **The
        assertion is stronger than the task, which is the harmless direction**, and the
        two-code shape is deliberate: `:226–233` records that Mail.tm answers a deleted
        mailbox and a bad token identically, so forcing one code here would tell a
        person to check a credential they never entered.

      **The dead-session case's own comment was one of the five statements corrected in
      3.2**, because it described the measured body as *"an empty inbox"*. A conformance
      comment is shipped prose in the same sense the adapter's is: it is the text the
      next adapter author reads before writing their own liveness check.
- [x] 3.5 Repair `packages/mailbox/src/adoption.test.ts`, which this change's fix made
      red. **Added during apply rather than proposed**, because 3.2 reported that file as
      out-of-scope prose and a fixture the fix reds is in scope by definition.

      **Measured: `pnpm verify` was red on all three runs at `7 failed / 1415 passed
      (1422)`, identical each run** — which is the evidence that it is not the recorded
      `onTaskUpdate` flake, because a flake does not produce the same seven names three
      times. One cause: `deadSession(url)` answered `{ list: [] }` for `f=check_email`,
      and under the measured rule that body is a **live empty listing**, so `restore`
      returned `ready` where the case expected `expired`.

      **The bodies now say what was measured, and the harness answers setup creation
      separately.** `deadSession` returns the measured dead body (`error`, no `list`,
      `auth.success: true`); `liveEmptyInbox` echoes `email` with `count: 0` and no
      `email_addr`; `liveInboxWithOneMessage` echoes `email` and reproduces the measured
      `count: "0"` **string**, which is the shape that forbids any adapter reading
      `count`. `createsAddress` keeps `email_addr`, because creation is the one call that
      sends it.

      **The first repair broke twelve cases, and the failure named the harness rather
      than the product**: `Guerrilla Mail returned no address for a new mailbox`, because
      every responder answered *every* URL and `createMailbox()` had been succeeding only
      because the live bodies happened to carry `email_addr`. `guerrillaMail()` now
      answers `get_email_address` itself, so **the operation a body answers is named once**
      rather than in a branch each responder could forget — the same repair the
      extension's recording seam needed at task 2.3, arriving one layer down.

      **Five statements moved with the fakes**, because a repaired body under a docblock
      describing the old one is the defect this change exists for: the module docblock's
      *"empty list and no error"*, `liveEmptyInbox`'s claim that *"`email_addr` … is the one
      thing that separates this body from `deadSession`"*, `deadSession`'s *"a bare `{ list:
      [] }`"*, the positive-control comment's *"both bodies are `HTTP 200` with an empty
      `list`"*, and the trap comment's *"an empty list and no error"*.

      **Measured after: `172 passed (6 files)`, unmoved** — the repair changed fakes and
      prose, not cases, which is the same result `incoming-mail-notification` recorded for
      a change that repaired a note rather than an assertion.

      **And one case title moved, which is the only thing in this file that is not fakes
      or prose.** *"does not call an expiry something it could not tell"* asserted
      `isExpired(state)` on `deadSession`, and under the **old** fixture that name was
      defensible — `deadSession` was a bare `{ list: [] }`, the ambiguous shape the old
      rule guessed at. **The repaired body carries the provider's own `error` and no
      `list`, so the adapter *can* tell**, and a case named for a guess would have gone on
      asserting the right outcome for a reason the measurement removed. It is now
      *"reports a session the provider has disowned as an expiry, not as a failure to
      ask"*. **The title did not move the count** — `172` before and after — which is the
      measurement that a rename happened rather than a case.
- [x] 3.6 Repair `packages/mailbox/src/session.test.ts`'s two listing responders, which
      carried the same refuted shape **while green**.

      **This one was not red, and that is why it is worth recording.** Its
      `guerrillaMessageAnswer` listing carried `email_addr: "recorder@mail.example"`, which
      equals the mailbox's own address, so the *old* rule was satisfied **by the fixture**
      and the case passed. Its `guerrillaAnswer` listing was a bare `{ list: [] }` whose
      rejection was swallowed by `.catch(() => undefined)` — a rejection path no body can
      reach, reading as coverage.

      **Measured, by restoring the old `email_addr` rule and running `packages/mailbox`
      with the tree otherwise unchanged: 11 failed.** Reverting only the message
      responder's `email` back to `email_addr`, under the same old rule, gives **10**, and
      the one that stops being caught is *adds no request of its own to what the provider
      makes while opening*. **So that case could not fail for the reason it exists until
      the fixture was corrected** — this repository's most-recorded defect, found here by a
      sweep rather than by a red.

      Both responders now carry `email`, `sid_token` and `auth`, and the three comments
      that described the old rule were rewritten rather than trimmed: the one that called
      `email_addr` *"not decoration"* also said the provider *"still echoes a token back and
      nothing else"* on a dead session, which the measurement refutes in both clauses.

      **The measurement was taken twice for that reason.** One run says the repaired
      fixture is load-bearing; only the second says the *repair* is what made it so, and a
      single arm cannot distinguish a case that already caught the old rule from one that
      caught it because its body changed.

## 4. Falsification

- [x] 4.1 Run arms A1–A7 from `design.md` and record the assertion each was caught by.
      Run A8 and record it as a survivor that is the designed result, not as a hole.

      **Measured: the control was green at `93 of 93`, A1–A4 and A7 were caught, and
      A5 and A6 SURVIVED.** The table in `design.md` now carries what the run measured
      rather than what the proposal predicted, because **two of its seven catcher
      entries were wrong**:

      - A1 — **8 failed**, named by *returns a genuinely empty list for a live session*
        and *keeps a live session alive when the listing names no address at all*, plus
        six cases that read `guerrillaLiveList`.
      - A2 — **4 failed**, named by *reports a dead session as expired rather than as
        an empty inbox* and the conformance case *never reports a dead session as a
        successful empty inbox*.
      - A3 — **6 failed**: the two dead-session cases and **four live cases**, three of
        which carry no `auth` block at all and are therefore expired by the mutant.
      - A4 — **1 failed**, exactly *treats a session reporting a different address as
        dead*. The cleanest attribution in the table.
      - A5 and A6 — **0 failed, 93 of 93 green.**
      - A7 — **1 failed**, *declares MEASURED or SYNTHETIC on every exported fixture*.
      - A8 — **0 failed**, which is the designed survivor and not a hole.

      **The two survivors are one finding, and it is structural.** The measured dead
      body carries a top-level `error` *and* no `list` at the same time, and the `error`
      check is answered first, so no mutation of the `list` check is ever reached by a
      body the provider has been observed to send. **The `error` check subsumes the
      `list` check for every measured body, so the three signals are not independently
      falsifiable.** That is not a gap against the requirement — its only dead-session
      scenario names both signals together — and it was **not repaired by inventing a
      body to make the arm fail**, because a fixture composed to satisfy an arm is the
      artifact this change exists to remove. The check stays as a defensive second
      signal and the record says plainly that no measured body isolates it.

      **A3 produced a second finding.** Keying on `auth.success` does not merely miss
      death — `auth.success` is `true` in the dead body too — **it also expires live
      listings that omit `auth`**, which is why three inline bodies joined the failure
      list. A signal that is `true` in both states and absent in a third is worse than
      no signal, and the arm shows both halves.

      **A1's browser half was already measured, and on the tree rather than on a copy.**
      Tasks 2.1 and 2.2 ran both browser tiers *before* the adapter was touched — that
      tree **was** the A1 mutant — at **15 failed / 43 passed** website and **10 failed /
      96 passed** extension. A copied mutation is a weaker instrument than the shipped
      defect, so it was not re-run there.
- [x] 4.2 Restore every mutated file byte-identically against a SHA-256 taken before
      the first mutation, and rebuild `dist/` if the browser tier was involved.

      **Every mutated file was restored from an in-memory copy of its pre-mutation
      bytes, and its SHA-256 was recomputed after every arm and once more after the
      last.** The final check reported all digests identical, and **nothing was restored
      from Git** — a restore from a commit would have discarded this branch's
      uncommitted work, which is the recorded defect of a file restored from a commit.

      **`pnpm build` was then run from the restored source at exit `0`**, and both
      bundles were read rather than assumed: `apps/extension/dist/chunks/storage.js` and
      `apps/web/dist/assets/index-DyipqRiU.js` each contain *"no longer recognises"*, the
      repaired `MAILBOX_EXPIRED` description. **A mutation that reaches a build artefact
      outlives the source restore that undid it**, and no SHA-256 covers `dist/`.

## 5. Documentation

- [x] 5.1 Append the dated correction under `docs/PROVIDERS.md` §3's
      *"HTTP 200, no auth error, empty inbox"* line. Keep the original line; do not
      edit §5.1, which already records the correct shapes.

      **The diff is `23 0` in one hunk at line 441, which is the measurement that the
      original line survived.** The M0 summary is untouched; the correction is inserted
      beneath it and names both refuted halves: there *is* an auth field and `auth.success`
      is `true` in the dead body, and the dead body carries no `list` at all rather than an
      empty one. It then records the 2026-11-18 measurement the M0 run did not have — a
      live listing echoes the address under `email`, `email_addr` appears only on
      `get_email_address` — and the three signals the adapter now uses.

      **§5.1 is byte-identical and merely moved by 23 lines**, and that is established by
      the shape of the diff rather than by re-reading it: a pure insertion with **zero
      deletions** cannot have altered a line it did not touch. §5.1's own sentence
      *"the usable signals are the `error` key and the absence of `list`"* is the record
      this change's `error` and `list` checks were written from, and it was right.
- [x] 5.2 Record in this file that `docs/PROVIDERS.md` was edited by an explicit task,
      which is the do-not-touch condition the repository requires.

      **The condition is satisfied by task 5.1 and by nothing else.** `AGENTS.md`'s
      do-not-touch list names `docs/PROVIDERS.md` as *the recorded measurement every
      provider decision cites*, and requires the active task to say so explicitly before
      it is edited; 5.1 does, and this entry records it. **No other path on that list is
      touched**: `git status` at this stage names only `docs/PROVIDERS.md`,
      `apps/extension/e2e/recorded-provider.ts`, `packages/providers/src/*` and this
      change's own artifacts — nothing under `.agents/skills/`, `.github/workflows/` or
      `openspec/changes/archive/`.

## 6. Gates

- [x] 6.1 `pnpm verify` — record the exit code and the test count, run on a frozen
      tree. Run it three times; a single green is a fact about one execution.

      **Three runs, `0`, `0`, `0`.** The third reported `Test Files 77 passed (77)` and
      `Tests 1422 passed (1422)`, `Duration 27.15s` — **the same 1422 / 77 the JSON
      reporter gives in 8.1, so the two instruments agree rather than one being quoted
      twice.** All three ran after the last product, fixture and document write and
      after the live-verification server was stopped, so nothing was edited underneath
      a run; the `[vitest-worker]: Timeout calling "onTaskUpdate"` shape this repository
      records did not appear in any of them, and **no red was observed at all, which is
      stated rather than counted as a property** — three greens are three executions.

      **A fourth run was then taken on the tree that carries the task-3.5 title repair,
      and exited `0` at the same `77 passed (1422)`.** It is recorded as a fourth rather
      than folded into the three because the three ran before that repair: **the tree the
      first three measured is not the tree this branch ships**, and a gate reported as
      covering a tree it did not run on is the defect this ledger exists to avoid. The
      paragraph you are reading was written after the fourth run, so the fourth run's tree
      differs from the shipped tree in **this file only** — which no test reads, and which
      is stated rather than left for a reader to assume the paragraph was present.
- [x] 6.2 `pnpm test:browser` — record the website and extension counts.

      **Measured after `pnpm build` and `pnpm --filter @spectre-mail/extension build:fixture`
      both exited `0`: website `58 passed (13.3s)` and extension `106 passed (1.6m)`, each
      exit `0`.** The two tiers were run **separately** rather than through the chained
      `pnpm test:browser`, because the extension's own script is `playwright test` with no
      build of its own: a chain that failed before the extension's build would run the old
      bundle against the new source and report a green about an artefact nobody rebuilt.
      Both totals are **unmoved**, which is the measurement — this change repaired a
      fixture body both tiers read and added no case to either.
- [x] 6.3 `openspec validate guerrilla-liveness-detection --strict`.

      **`Change 'guerrilla-liveness-detection' is valid`, exit `0`.** Run again after the
      task-8 writes, so the artifact validated is the one this branch ships.

## 7. Live verification in the user's Chrome

- [x] 7.1 Rebuild, serve, and create a fresh Guerrilla mailbox in the user's browser.
      Confirm the page lists the mail that arrives instead of reporting the address
      gone.

      **Done in the user's own Chrome, against `http://127.0.0.1:4173` served from the
      repaired `dist`, with the real `api.guerrillamail.com` — no recorded response and
      no route interception.** A fresh mailbox reached `Ready` and the page listed what
      had arrived:

      > **Inbox** — *Open Welcome to Guerrilla Mail* · `no-reply@guerrillamail.com` ·
      > *Welcome to Guerrilla Mail* · `1970-01-01T00:00:00.000Z` · *Read*

      **That is the defect arm and it is the whole finding.** The same listing carries the
      address under `email`, which the old `sessionIsLive` never read, so this exact page
      in this exact state used to report the address gone. The timestamp shown is the
      provider's own `mail_timestamp: 0` rendered as the epoch, which is a provider fact
      and not a client bug.
- [x] 7.2 Confirm the empty arm against the live provider: with the inbox empty, the
      page says the inbox is empty and does not say the address is gone.

      **Measured on the same live session, and the body is what makes it an arm rather
      than a screenshot.** `f=check_email` with the mailbox empty answered `200` with
      keys `list, email, alias, ts, sid_token, count, users, stats, auth`, `list: []`,
      `email: "yzffewiv@guerrillamailblock.com"`, `count: 0` **as a number**, `error`
      absent and `auth.success: true`. The page rendered:

      > **Ready** — *Your address is below. Nothing was required to create it.*
      > **Inbox** — *No mail has arrived at this address yet.*

      and it stayed there across the polls that followed. **This is the body the old rule
      could not tell from death only because it looked for a field that is not there**;
      `guerrillaEmptyLiveList` is this recording, normalised, and it re-measured
      byte-identically in key set and in the type of `count`.
- [x] 7.3 Record the page's own text and the provider bodies observed. Appearance is
      not in scope and no test here reads a pixel.

      **Three states were observed, and the third is the one that says the rule is not
      merely permissive.** A genuinely dead stored address (`zhepimcj@…`, hours old)
      answered with the dead body and the page said *"Your saved address is gone"* —
      *"Guerrilla Mail does not recognise this address any more, so it will not receive
      mail."* A live listing with one message said `Ready` and listed it. An empty live
      listing said `Ready` and *"No mail has arrived at this address yet."* **So the
      change does not turn every Guerrilla answer into "alive"**: the same build, in the
      same browser, still reports a real death as a death, which is what the old rule
      could not do for a live address.

      **Two things were read out of the running page rather than out of storage, and
      both are recorded because the first version of this note would have been wrong.**
      The session token was taken from the page's own `performance` entries, because
      *Get a new address* is `startFresh` and **deliberately does not persist** — so
      reading IndexedDB found the previous, dead record and would have reported the
      fresh mailbox as never written. The provider's empty body was then read through
      that token and compared against the fixture. **A verification that read storage
      would have measured the wrong mailbox and called it a defect in the save path.**

      **Not established:** how any of it looks. No test in this repository reads a
      rendered pixel and none was written here; the text above is text, and whether the
      page reads as right is a human judgement this task does not claim to have made.

## 8. Record what moved

- [x] 8.1 Re-measure `pnpm test` per package and reconcile the delta case by case.

      **Measured from a fresh `--reporter=json` run grouped by file, not read off a summary
      line: 1422 tests across 77 files**, and the delta against the standing ledger is
      **one case, in one package**:

      | package | before | after | movement |
      | --- | --- | --- | --- |
      | `packages/providers` | 92 | **93** | `guerrilla.test.ts` 27 → 28 |
      | `packages/mailbox` | 172 | **172** | none — `adoption.test.ts` 24, `session.test.ts` 56 |
      | `packages/core` | 54 | **54** | none |
      | `packages/mail-parser` | 149 | **149** | none |
      | `packages/storage` | 103 | **103** | none |
      | `packages/ui` | 49 | **49** | none |
      | `apps/web` | 143 | **143** | none |
      | `apps/extension` | 500 | **500** | none |
      | `tests/architecture` | 159 | **159** | none — `boundaries.test.ts` still 56 |

      **`packages/mailbox` holding at 172 is the number this change had to earn.** Two of
      its files were repaired — `adoption.test.ts`'s fakes and `session.test.ts`'s two
      responders — and **a repaired fixture that moved a count would have meant a case was
      added rather than a body corrected**, which is the difference between covering a
      defect and describing it. **`boundaries.test.ts` holding at 56 is the second**: this
      change adds no boundary rule, because the property it repairs is about what the
      adapter *reads*, and a rule sees imports and spellings rather than bodies.
- [x] 8.2 Record the browser tier's per-file counts.

      **Measured with `playwright test --list --reporter=json` on each tier and attributed
      to each case's enclosing `file`, then corroborated by a full run of each tier.**
      Website **58 in 9 files** — `diagnostic` 3, `focus` 6, `mailbox-history` 10,
      `motion` 9, `primary-action` 1, `sections` 16, `storage` 6, `surface-hierarchy` 4,
      `verification-actions` 3. Extension **106 in 10 files** — `alarm-floor` 1,
      `background-check` 2, `in-page-associations` 12, `in-page-create` 8, `in-page-fill` 8,
      `in-page` 17, `manifest` 13, `measurement` 1, `popup` 13, `side-panel` 31. **Every
      per-file figure is identical to the standing list**, which is the same claim 8.1 makes
      one tier down: a fixture repair moved no case.
- [x] 8.3 State what this change does not establish, from `design.md` D9, without
      softening it.

      **Restated, and none of the five is closed by this stage.** Whether the provider
      changed shape or M0 mis-transcribed the body is **unknown and not guessed** — the
      spike stored summaries and both `email_addr` hits in its runs are creation responses.
      The extension's Guerrilla fallback was **not** observed failing live; it shares the
      adapter, and the popup and panel still need a manual unpacked load. `fixtures.test.ts`
      checks that a label is **present and first**, not that a recording matches the
      provider. A dead body that also carries an empty `list` **was never measured**, so
      whether the provider can produce one is unknown. And **nothing here reads a rendered
      pixel** — the observation that started this change was a page's text, and the fix is
      verified by behaviour rather than appearance.
