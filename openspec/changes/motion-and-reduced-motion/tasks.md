# Tasks

## 1. Measure the instrument before writing an assertion against it

- [x] 1.1 Record the three D12 assumptions as measurements, in `design.md`, before any
      assertion exists: what Chromium reports for an `animation-duration` declared as
      `200ms`; what it reports for `animation-timing-function` declared as
      `cubic-bezier(0.16, 1, 0.3, 1)`; and whether `page.emulateMedia({ reducedMotion })`
      changes a loaded page's resolved `animation-name` **without a reload**. Verify by a
      throwaway spec run against the current build, and delete the throwaway afterwards so
      no uncollected or duplicate spec ships.
- [x] 1.2 If assumption 2 does not round-trip, apply the D12 fallback — compare the product's
      resolved easing against a probe element the spec injects using `var(--ease-standard)` —
      and record the amendment **in this change's `design.md`**, naming which assumption
      failed and what replaced it. Verify the amendment states the reason, not the outcome.

## 2. The two declared values

- [x] 2.1 Add `blur: "6px"` and `rise: "4px"` to `MOTION` in `packages/ui/src/tokens.ts`,
      placed **before** the durations (D4), with a comment that says they are motion
      distances rather than layout and why `--space-1` was not reused. Verify `pnpm typecheck`
      passes.
- [x] 2.2 Replace the `MOTION` doc comment's *"used by nothing in this slice"* with the
      position after this change, and verify it no longer claims a state the file does not
      describe.
- [x] 2.3 Re-emit `packages/ui/src/tokens.css` **in the same commit** as 2.1 and verify
      `packages/ui/src/tokens-css.test.ts` passes — it asserts the committed stylesheet is
      byte-for-byte what `tokens.ts` renders, so a stale stylesheet fails here rather than in
      the browser.

## 3. The generated design document

- [x] 3.1 Rewrite the Motion prose emitted by `packages/ui/src/design-doc.ts` so it states
      what the motion is, that `prefers-reduced-motion: reduce` removes it, and that this
      slice delivers entrance only (D2, D9). Verify it still carries both the declared values
      and their tokens.
- [x] 3.2 Change `packages/ui/src/design-doc.test.ts`'s *"states every motion token's being
      unused, since that is the slice-2 constraint"* to assert the opposite, keeping its
      purpose — a reader must be able to tell from the table what a motion token does — and
      verify it now also names `--blur` and `--rise`.
- [x] 3.3 Re-emit the generated region of `docs/DESIGN_SYSTEM.md` and verify
      `design-doc.test.ts`'s byte-identity assertion passes.
- [x] 3.4 Edit the **static** prose outside the generated region — the *"Motion. Declared,
      used by nothing"* exclusion-list entry — by hand, and verify the region markers and the
      surrounding prose are untouched by the emitter.
- [x] 3.5 Add to the generated region's own *"What is verified, and what is not"* prose that
      the motion checks read computed values and never a rendered pixel, so how the
      materialise looks stays a human judgement (D10).

## 4. The stylesheet

- [x] 4.1 Add one `@keyframes materialise` whose `from` declares `opacity: 0`, a `filter`
      using `var(--blur)` and a `transform` using `var(--rise)`, and whose `to` declares
      `opacity: 1`, `blur(0)` and `none` — the three `to` values being exactly what the
      elements already compute to (D6). Verify no fill mode is declared and say why in the
      comment.
- [x] 4.2 Add the three `animation` declarations as **one grouped selector list** over
      `.address__value`, `.inbox-row` and `.code` (D3, D5), taking every duration from
      `var(--duration-*)` and the easing from `var(--ease-standard)`. Verify the row takes
      `--duration-fast` and the other two take `--duration-base`.
      **Amended during apply:** shipped as **two** rules — `.address__value, .code` and
      `.inbox-row` — because the two groups take different durations, and one block plus an
      override would have split the governing declaration away from the comment that explains
      the split. The requirement never named a single block, so this is a narrower reading of
      “one list”, not a different one.
- [x] 4.3 Add the `@media (prefers-reduced-motion: reduce)` block **after** 4.2, naming the
      same three selectors and setting `animation: none` (D7). Verify the source order is the
      one the decision requires and that the comment records that it is load-bearing.
- [x] 4.4 Replace the header comment's *"No animation and no transition"* bullet, and
      reconcile its *"nothing here moves on its own"* sentence so it distinguishes a motion the
      product chose on its own cadence from mail arriving (D13). Verify no other header
      sentence became false.
      **Extended during apply:** reconciled a second time once D17 landed, because after that
      repair the product's own cadence provably no longer moves the inbox at all — a stronger
      statement than the one this bullet now makes.
- [x] 4.5 Run `pnpm test` and verify `apps/web` is still **113** tests, the boundary count is
      still **51** (D14 adds no rule), and `packages/ui` moved only in the tests 3.2 changed.
      A movement anywhere else is a change to explain before anything else is looked at.
      **Result: 113, 51 and 38 all confirmed, then superseded.** The stylesheet work alone moved
      nothing, exactly as this task predicted. `apps/web` went to **114** and `packages/mailbox`
      to **155** only because of 6.8–6.10 below, and both movements are explained there rather
      than being left as a number in a log.

## 5. The static half of the browser spec

- [x] 5.1 Create `apps/web/e2e/motion.spec.ts` with the declaration assertions from D10:
      the `from` and `to` frames' properties, every `animation` duration and easing read from
      a token, **no literal time value and no literal `cubic-bezier(` anywhere in the file**,
      and the reduced-motion block's selector list naming the same selectors as the entrance
      block's. Verify each assertion fails when its own declaration is mutated (group 7).
- [x] 5.2 Record beside the selector-list assertion that it is **narrow on purpose** — it
      compares two lists this slice writes and cannot see an animation declared elsewhere —
      and name the browser sweep as the general check (D10). Verify the comment is not the
      only thing asserting it: the sweep in 6.3 must be able to fail without it.

## 6. The empirical half of the browser spec

- [x] 6.1 Under `no-preference`, assert each of the three elements resolves the declared
      `animation-name`, the declared duration (compared against the token **read off the live
      page**, D10) and the declared easing. Verify the comparison is relative: changing the
      token moves both sides, while a literal duration in the stylesheet fails.
- [x] 6.2 Under `reduce`, assert each of the three elements resolves `animation-name: none`,
      and that each renders in its resting appearance.
- [x] 6.3 Under `reduce`, **sweep every element in the document** and assert none reports a
      running animation. Record beside it that the `transition-duration` half is a tripwire
      that is vacuous today because this slice declares no transition (D9), and that it is
      there so the day one exists the sweep reports rather than the requirement becoming
      silently true.
- [x] 6.4 The positive control for 6.2 and 6.3: assert under `no-preference` that the sweep
      **does** find running animations and names the three hooks. Verify 6.2 and 6.3 are
      unsatisfiable by the absence of motion — deleting the entrances from the stylesheet must
      turn 6.3 **green and 6.4 red**, which is the only shape in which 6.3 means anything.
- [x] 6.5 Assert `page.emulateMedia` changes a loaded page's resolved `animation-name` with no
      reload, and that the entrances follow it both ways (the third scenario of the reduced
      motion requirement).
- [x] 6.6 Element identity (D11): set a marker property on an inbox row's DOM node, wait for a
      **second** listing that reports the same messages and no others, then assert the marker
      is still on that row and no animation started on it. Verify the mutation that gives
      rows a fresh key makes the marker vanish and this assertion go red.
      **Extended during apply (D17):** the marker is a **JS property** rather than a
      `dataset` attribute. Both were measured on the built page before the repair and both
      survived — and both vanished together when the row was rebuilt — but React reconciles
      attributes, so a property is the one reading that can only go red because the node
      changed. The wait for the second listing also moved onto the recorded provider traffic
      rather than a timer.
- [x] 6.7 Assert that opening a message and returning leaves every row undisturbed — verified
      first by reading `App.tsx`, which renders `MessageView` **after** `Inbox` so the inbox is
      never unmounted. If that turns out not to hold, this scenario is **removed and recorded**
      in the delta rather than asserted.
      **Verified, and asserted rather than assumed.** `App.tsx` renders `MessageView` *after*
      `Inbox` rather than in place of it, both unconditionally, so opening a message does not
      unmount the inbox. The browser spec checks that on the built page **under no-preference**,
      because the same navigation under `reduce` would start nothing whether or not the inbox
      survived — an assertion satisfied by the absence of motion is not an assertion.

## 6A. The repair the browser spec forced

**Recorded during apply (2026-10-06).** Added as its own group because these tasks were not in
the proposal and did not exist when it was written: 6.6's assertion **failed on the first run
of the browser tier**, and what it found was a defect in the product rather than in the spec.
D17 carries the reasoning and the measurement.

- [x] 6A.1 Change `InboxState`'s `checking` variant to carry the last known `listing`, and
      record in `state.ts` why the reasoning `checkFailed` already used applies here too.
      Verify `packages/mailbox` typechecks and its existing tests still pass.
- [x] 6A.2 Extract the “last thing actually learned” listing into one helper shared by the
      `checking` publish and `refusalOf`, so the two cannot drift, and verify `refusalOf`
      behaves **identically** — no rate limit carried forward that was not stated for the
      current moment.
- [x] 6A.3 Add the `mailbox-session` delta requirement, with the measurement in it rather
      than only in `design.md`, and note that it is an **added requirement for a capability
      this change otherwise would not have touched**.
- [x] 6A.4 Restructure `Inbox.tsx` so `checked` and `checking` produce the same elements at
      the same indices, with the re-checking sentence **appended**, and delete the module
      doc's now-false “there is no stylesheet at this milestone” claim rather than leaving it.
- [x] 6A.5 Add the session-level pair: `checking` carries the previous messages **and
      verdicts**, and a first check carries neither. **A pair, not one test** — a `checking`
      that always carried an empty listing would satisfy the first half alone.
- [x] 6A.6 Add the client-level assertion that the row is the **same DOM node** across a
      second check, holding the second listing open through a per-call gate on the stub.
      Verify the gate is necessary: without it the two publishes batch into one render and the
      test asserts on something else.
- [x] 6A.7 Amend `inbox.test.ts`’s key-set assertion, recording in the test why `checking`
      grew a field rather than silently moving the expectation. Verify the assertion's *form*
      is unchanged — exact key sets, no leaks.
- [x] 6A.8 Verify the repair against the built page with `motion.spec.ts`, and confirm the
      browser spec now passes 9 of 9 with `packages/mailbox` at 155, `apps/web` at 114 and
      the boundary count still 51.
- [x] 6A.9 Extend `openFreshMailbox` with an `onDocumentLoaded` hook, because `ready` is
      **measured** to arrive before the inbox renders — so a recorder installed afterwards can
      miss the entrance it exists to record. A hook and not a second copy of the navigation.

## 7. Falsification

- [ ] 7.1 For every assertion added in groups 2 through 6, introduce the violation, observe
      a non-zero exit, and confirm the **intended** test is the one that failed — a suite that
      goes red is not the same claim as this test catching this defect. Record `nocompile`,
      `green`, `wrongcatch`, `noop`, `harness-error` and `build-failed` as the distinct
      outcomes they are, never as passes.
- [ ] 7.2 Write the harness so that output containing neither a passed nor a failed count is
      `harness-error`, and invoke `node` directly rather than `pnpm.cmd` — the latter cannot
      be spawned from Node on this machine and produced two mutations reported as uncaught
      while reading green. Verify the harness can fail for the reason it exists by planting a
      known violation first.
- [ ] 7.3 Verify restoration by SHA-256 for every mutated file, reported separately from
      whether the mutation was caught.

## 8. Integration

- [ ] 8.1 Run `pnpm verify` and verify exit `0`, with `PLAYWRIGHT_BROWSERS_PATH` pointed at an
      empty directory so the claim that the workspace gates need no browser stays true.
- [ ] 8.2 Run `pnpm test:browser` **ten consecutive times**, verifying 13 specs collected and
      passing every time (D15). A red run is a defect in this change until shown otherwise: the
      focus traversal's settle precondition is already known to be the shape that can break,
      and `transform` on a row is exactly the input it has not seen.
- [ ] 8.3 Confirm no test in either tier contacts a live provider and no test reaches any
      origin the recorded handler does not have a response for; report the suite's own denied
      origin record rather than assuming it was empty.

## 9. Documents

- [ ] 9.1 Correct `AGENTS.md`'s *"A boundary rule enforces the categories above and not the
      rest"*, which measured false on 2026-10-06 by reading `stylesheetViolations()`: it
      applies `REMOTE_CSS_PATTERNS`, `FOCUS_SUPPRESSION_PATTERNS` and
      `collectUnresolvedTokens`, and nothing else. State that the categories are measured of
      `apps/web/src/styles.css` and **unasserted**, and name the three length literals that
      make a blanket rule wrong (D14).
- [ ] 9.2 Update `AGENTS.md`'s Frontend bullet and the `docs/ROADMAP.md` M7 slice row for
      motion: what now animates, that `prefers-reduced-motion` governs it, that **no test reads
      a rendered pixel**, and that entry motion is what shipped.
- [ ] 9.3 Update `docs/ROADMAP.md`'s Project Status cursor to M7 slice 3 and record, by file,
      this slice's counts: the browser tier at 13 specs, `apps/web` at 113, `packages/ui` at
      whatever 3.2 moved it to, the boundary count at 51 with **no rule added**, and the
      observed CI runs — never a CI claim before a run reports it.
- [ ] 9.4 Re-read `AGENTS.md`'s stale-claim sentences against the change and delete rather
      than reword any that this slice made false; a stale claim that reads like a guarantee is
      the most damaging kind of wrong on a page.
