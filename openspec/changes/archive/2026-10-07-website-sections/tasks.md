# Tasks

**Amendments recorded during apply are in `design.md` under _Amendments recorded during apply
(2026-10-07)_ (`A1`–`A11`). Three tasks below are ticked but were corrected by measurement,
and each says so at the point of the tick rather than being quietly reinterpreted.**

## 1. Proposal stage

- [x] 1.1 Record the two user decisions verbatim in `design.md` — footer claims no licence (D3),
      `Replace address` is the primary action (D6)
- [x] 1.2 Record the *Extension preview* absence as a requirement, not an omission (D1)
- [x] 1.3 Validate: `openspec validate website-sections --type change --strict` → `Change
      'website-sections' is valid`

## 2. Record the baseline before any edit

- [x] 2.1 `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` at an empty directory — **694 tests in
      35 files**; the three client totals from Vitest's own JSON reporter are
      **`App.test.tsx` 32, `recovery.test.tsx` 36, `Inbox.test.tsx` 25**
- [x] 2.2 Read the shipped `styles.css` and count the literals, **stating the scan's method**
      — see the correction in `A5`: the "six" this task named was measured without stripping
      multi-line comments, and the number that carries meaning is that **zero** literals are a
      colour, radius, spacing step, type size, or duration
- [x] 2.3 `pnpm test:browser` once, to confirm the 21-case suite is green before the change

## 3. The token layer

- [x] 3.1 ~~Add the brand-mark and primary-action pairs to `SCHEMES`~~ — **corrected by `A1`:
      both already existed**, `accent`/`surface-page` and `accent`/`surface-accent` from slice 1.
      The token genuinely new to this change is **`--ink-on-accent`**, declared in both schemes
      because measurement showed **no ink in the palette reaches 4.5:1 on `--accent`**
- [x] 3.2 ~~Add the selected-mailbox pair~~ — **corrected by `A1`: it already existed.** D7's
      deferral and its destination (M8/M11) are recorded in `docs/ROADMAP.md`
- [x] 3.3 Declare the new pair in `pairs.ts` so `pairs.test.ts` checks it in both schemes
- [x] 3.4 Regenerate `tokens.css` and `docs/DESIGN_SYSTEM.md` from the **generator**, never by
      hand; both byte-identity assertions pass
- [x] 3.5 ~~the count rises by exactly the new pair checks~~ — **corrected by `A3`:
      `pairs.test.ts` is table-driven, so a new pair adds no test. `packages/ui` is 38 before
      and after.** Recorded because a task that predicts a count and is wrong is worse than one
      that does not predict

## 4. Section content

- [x] 4.1 `apps/web/src/sections.ts`: the four sections' copy as data (D11)
- [x] 4.2 Every claim in `sections.ts` traced to something this repository holds (D8) —
      recorded in a comment beside the claim, not left implicit
- [x] 4.3 The steps section's third step reads *replace the address and forget it on this
      device*, and **not** delete a message (D8)
- [x] 4.4 The footer carries the limits **verbatim** from the previous list, plus the pointer at
      the `LocalData` region (D3)
- [x] 4.5 **No sentence in `sections.ts` names a licence, a second provider, or an unsupported
      figure** — a reader with no other context can check each one; asserted in the browser tier

## 5. Components and composition

- [x] 5.1 Four section components, each `<section aria-labelledby>` with its own `<h2>`,
      matching the regions already on the page
- [x] 5.2 The brand mark as an **inline** SVG carrying the accent — no file, no font, no image
      request (D5). **The assertion was a proxy until `A7` forced it to measure requests**
- [x] 5.3 `App.tsx` renders the sections after the product region; no product region renamed,
      relocated, or dropped (D2)
- [x] 5.4 The limits region moves to the footer. **Corrected by `A2`: it moves *out of*
      `<main>`**, because a `<footer>` inside `<main>` is not a `contentinfo` landmark
- [x] 5.5 `Replace address` takes the filled accent treatment; every other control keeps its
      outline treatment, and `LocalData`'s removal keeps its destructive framing (D6)
- [x] 5.6 `apps/web` client totals **unchanged at 114** — measured from Vitest's JSON reporter,
      as 2.1 recorded them

## 6. Styles

- [x] 6.1 Section styles in `apps/web/src/styles.css`, every value a declared token
- [x] 6.2 The two arrangements written with `grid-template-columns`, reusing the **existing**
      breakpoint and adding no second one (D4)
- [x] 6.3 No new `--grid-columns`, no breakpoint token, no position token in `packages/ui`;
      asserted in the browser tier against the resolved custom properties
- [x] 6.4 `collectUnresolvedTokens` passes — every `var()` resolves
- [x] 6.5 ~~The literal count is unchanged at six~~ — **corrected by `A5`: it is 14
      declarations / 15 tokens, because this change added two grids and two centred blocks, and
      every one is a layout value. Zero are in the five categories the requirement names**

## 7. Verification

- [x] 7.1 `pnpm verify` green with `PLAYWRIGHT_BROWSERS_PATH` at an empty directory — 694 tests
      in 35 files, build emitted
- [x] 7.2 `prettier --check .` clean — it was **not** on the first run; six new files needed
      formatting, which is why the gate is ticked only after the second
- [x] 7.3 `openspec validate --specs --strict` → **11 passed, 0 failed**; and
      `--type change --strict` → valid

## 8. Browser tier

- [x] 8.1 Cases in `apps/web/e2e/sections.spec.ts`: the stated order read from the DOM; the
      accent on all three surfaces resolved from a computed style; no region naming a licence
      or a second provider; `traffic.denied` empty
- [x] 8.2 Assert the five-category literal scan against the **built** stylesheet, with the
      `:root` premise asserted first so the token strip cannot under-report
- [x] 8.3 ~~Re-establish the control-set precondition this change widens~~ — **`A9`: the premise
      is measured false. The sections add no interactive element**, so `focus.spec.ts`'s walk
      and its settle precondition are unchanged and its six cases kept their count
- [x] 8.4 Assert `Replace address` kept its accessible name under the new treatment (D6), and
      that the treatment reaches no other control
- [x] 8.5 **Ten consecutive full-suite runs, every case passing** — **measured: 34 passed on
      each of ten, zero failures**
- [x] 8.6 Record the browser case total in `AGENTS.md` and `docs/ROADMAP.md` from Playwright's
      own `Running 34 tests` line, **not** by addition

## 9. Falsification

- [x] 9.1 Mutate each new assertion and observe it **fail**, with the intended test named —
      **22 of 22, no survivor**
- [x] 9.2 `nocompile`, `green`, `wrongcatch`, `noop`, and `harness-error` are distinct outcomes,
      never passes. **Six instrument defects found and repaired on the way — `A10`**
- [x] 9.3 A positive control per assertion **form** — the landmark reader's is a built-in
      negative control that plants the defect into the running page, and the brand-mark
      assertion's two halves were falsified **separately** (`A7`)
- [x] 9.4 Verify restoration by SHA-256 for every mutated file — verified, and `A10`'s sixth
      defect is why **the build is restored too**, since no SHA covers `dist/`
- [x] 9.5 Mutations aimed at the **preconditions**, not only the assertions — the tree reader's
      precondition is what S03 falsifies. **This file adds no wait**, so there was no settle
      time to shorten or lengthen, and the task's premise did not hold; recorded rather than
      ticked as though it did

## 10. Documents

- [x] 10.1 `docs/ROADMAP.md`: slice 3's row, the cursor, and **the open-source footer audit**
      (D3)
- [x] 10.2 `docs/ROADMAP.md`: the selected-mailbox surface's deferral and its destination (D7)
- [x] 10.3 `AGENTS.md`: counts measured, and the **explicit statement that nothing here
      verifies how the page looks** (D9)
- [x] 10.4 Every amendment recorded **in this change** — `design.md` `A1`–`A11`, none deferred
      to sync

## 11. Independent verification

- [x] 11.1 Compare the implementation against `proposal.md`, the deltas, `design.md`, and
      `tasks.md` — **not against the ticked boxes.** Three tasks were found wrong by that
      comparison and corrected in place (`3.1`, `3.2`, `3.5`, `6.5`, `8.3`)
- [ ] 11.2 Open the page in a real browser and **look at it**
- [ ] 11.3 Report every CRITICAL and WARNING; do not close the change with any unresolved