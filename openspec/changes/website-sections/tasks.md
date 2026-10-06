# Tasks

## 1. Proposal stage

- [ ] 1.1 Record the two user decisions verbatim in `design.md` — footer claims no licence (D3),
      `Replace address` is the primary action (D6)
- [ ] 1.2 Record the *Extension preview* absence as a requirement, not an omission (D1)
- [ ] 1.3 Validate: `openspec validate website-sections --type change --strict`

## 2. Record the baseline before any edit

- [ ] 2.1 `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` at an empty directory; record the test
      count and the three client test totals (`App.test.tsx`, `recovery.test.tsx`,
      `Inbox.test.tsx`) — **these totals are the tripwire for D10's rename risk**
- [ ] 2.2 Read the shipped `styles.css` and count the literals; confirm **six** and confirm
      none is a colour, radius, spacing step, type size, or duration
- [ ] 2.3 `pnpm test:browser` once, to confirm the 21-case suite is green before the change

## 3. The token layer

- [ ] 3.1 Add the brand-mark and primary-action pairs to `SCHEMES`, **both schemes declared**,
      no value derived from the other
- [ ] 3.2 Add the selected-mailbox pair, declared and unused, with its destination in the
      comment (D7)
- [ ] 3.3 Declare each pair in `pairs.ts` so `pairs.test.ts` checks it in both schemes
- [ ] 3.4 Regenerate `tokens.css` and `docs/DESIGN_SYSTEM.md` from the **generator**, never by
      hand; both byte-identity assertions pass
- [ ] 3.5 `pnpm --dir packages/ui test` — the count rises by exactly the new pair checks and
      nothing else

## 4. Section content

- [ ] 4.1 `apps/web/src/sections.ts`: the four sections' copy as data (D11)
- [ ] 4.2 Every claim in `sections.ts` traced to something this repository holds (D8) —
      recorded in a comment beside the claim, not left implicit
- [ ] 4.3 The steps section's third step reads *replace the address and forget it on this
      device*, and **not** delete a message (D8)
- [ ] 4.4 The footer carries the four limits **verbatim** from the current list, plus the
      storage sentence pointing at the `LocalData` region (D3)
- [ ] 4.5 **No sentence in `sections.ts` names a licence, a second provider, or an unsupported
      figure** — a reader with no other context must be able to check each one

## 5. Components and composition

- [ ] 5.1 Four section components, each `<section aria-labelledby>` with its own `<h2>`,
      matching the nine regions already on the page
- [ ] 5.2 The brand mark as an **inline** SVG carrying the accent — no file, no font, no image
      request (D5)
- [ ] 5.3 `App.tsx` renders `SECTIONS` after the product region; **no product region renamed,
      relocated, or dropped** (D2)
- [ ] 5.4 The limits region moves to the footer; nothing else in `App.tsx` changes
- [ ] 5.5 `Replace address` takes the filled accent treatment; every other control keeps its
      outline treatment, and `LocalData`'s removal keeps its destructive framing (D6)
- [ ] 5.6 `pnpm --dir apps/web test` — **the three client test totals from 2.1 are unchanged**
      unless a stated reason is recorded

## 6. Styles

- [ ] 6.1 Section styles in `apps/web/src/styles.css`, every value a declared token
- [ ] 6.2 The two-column arrangement written with `grid-template-columns`, reusing the
      **existing** breakpoint and adding no second one (D4)
- [ ] 6.3 No new `--grid-columns`, no breakpoint token, no position token in `packages/ui`
- [ ] 6.4 `collectUnresolvedTokens` passes — every `var()` resolves
- [ ] 6.5 The literal count is unchanged at **six**, and the scan's coverage is stated beside its
      result

## 7. Verification

- [ ] 7.1 `pnpm verify` green, with `PLAYWRIGHT_BROWSERS_PATH` at an empty directory
- [ ] 7.2 `prettier --check .` clean
- [ ] 7.3 `openspec validate --specs --strict` and `--type change --strict`

## 8. Browser tier

- [ ] 8.1 Add cases to `apps/web/e2e/`: the stated order read from the DOM; the accent on all
      three surfaces resolved from a computed style; no region naming a licence or a second
      provider; `traffic.denied` empty
- [ ] 8.2 Assert the five-category literal scan against the **built** stylesheet
- [ ] 8.3 **Re-establish the control-set precondition** this change widens, with its own
      positive control — a control that gains a layout box after the walk begins must fail the
      wait (D10)
- [ ] 8.4 Assert `Replace address` kept its accessible name and its effect under the new
      treatment (D6)
- [ ] 8.5 **Ten consecutive full-suite runs, every case passing.** A suite green four times in
      ten has told us nothing — this is the twenty-eighth-instance defect
- [ ] 8.6 Record the browser case total in `AGENTS.md` and `docs/ROADMAP.md` from Playwright's
      own `Running N tests` line, **not** by addition

## 9. Falsification

- [ ] 9.1 Mutate each new assertion and observe it **fail**, with the intended test named
- [ ] 9.2 `nocompile`, `green`, `wrongcatch`, `noop`, and `harness-error` are distinct outcomes,
      never passes (D20 of slice 2)
- [ ] 9.3 A positive control per assertion **form** — a positive control that uses the form the
      author happened to pick is not a control
- [ ] 9.4 Verify restoration by SHA-256 for every mutated file
- [ ] 9.5 Mutations aimed at the **preconditions**, not only the assertions: a wait too short
      and a wait too long, each caught by its own positive control

## 10. Documents

- [ ] 10.1 `docs/ROADMAP.md`: slice 3's row, the cursor, and **the open-source footer audit**
      (D3)
- [ ] 10.2 `docs/ROADMAP.md`: the selected-mailbox surface's deferral and its destination (D7)
- [ ] 10.3 `AGENTS.md`: counts measured, and the **explicit statement that nothing here
      verifies how the page looks** (D9)
- [ ] 10.4 Every amendment recorded **in this change**, never added at sync

## 11. Independent verification

- [ ] 11.1 Compare the implementation against `proposal.md`, the deltas, `design.md`, and
      `tasks.md` — not against the ticked boxes
- [ ] 11.2 Open the page in a real browser and **look at it**
- [ ] 11.3 Report every CRITICAL and WARNING; do not close the change with any unresolved