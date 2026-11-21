# M21 — Full-site parity coverage matrix and handoff

Date: 2026-11-21. Baseline: M16 captures dated 2026-11-21 in `docs/ux-reference/captures/`.
Tree audited: `main` at `47fca1d` (M16-M20 merged). Status vocabulary: **PASS / FAIL / NOT VERIFIED / BLOCKED / APPROVED DEVIATION**. The denominator is the **full M16 free-web inventory**, not a selected subset.

**Read this before the rows:** 9 of the 10 route rows are **role-preserving APPROVED DEVIATIONS**, not delivered routes. A reasonable visitor does not find `/en/faq`, `/privacy-policy`, `/terms-of-service`, `/en/contact` or `/blog` in SpectreMail; their informational roles live in original on-page copy and `docs/PRIVACY.md`. The page is ~2,567px here against the reference's ~4,281px. This is a fidelity-within-scope reconstruction, **not route parity**, and the verdict below reflects that rather than hiding it behind per-row labels.

## A. Public routes (10/10 rows)

| M16 route                                 | Status             | Evidence                                                                                                                                                      |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/en/` home — hero, dashed panel, toolbar | APPROVED DEVIATION | `reference-desktop.png` vs `baseline-desktop.png`; product boundary geometry within ~8px, address field 448 vs 400px (mono needs width), no QR (out of scope) |
| `/en/change`                              | APPROVED DEVIATION | `route-status.md`; reference domain form is Premium-only, SpectreMail offers domain choice inside Change                                                      |
| `/en/faq`                                 | APPROVED DEVIATION | `route-status.md`; informational role in on-page explainer, no standalone route                                                                               |
| `/en/api`                                 | APPROVED DEVIATION | developer API outside no-backend scope, not linked as a working route                                                                                         |
| `/en/10minutemail`                        | APPROVED DEVIATION | same disposable-address role in one product surface                                                                                                           |
| `/en/email-generator`                     | APPROVED DEVIATION | same as above                                                                                                                                                 |
| `/privacy-policy`                         | APPROVED DEVIATION | `docs/PRIVACY.md` is authoritative; footer names Privacy as information                                                                                       |
| `/terms-of-service`                       | APPROVED DEVIATION | no SpectreMail terms route; truthful limits, no licence claim                                                                                                 |
| `/en/contact`                             | APPROVED DEVIATION | no send endpoint; footer names Contact as information                                                                                                         |
| `/blog`                                   | APPROVED DEVIATION | protected editorial prose; original article-style section preserves role                                                                                      |

## B. Working product flows

| Flow / state                                          | Status                       | Evidence                                                                                                                                                                                             |
| ----------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-visit address generation                        | PASS                         | website browser tier 48/48, `App.test.tsx`, `storage.spec.ts`                                                                                                                                        |
| Address single-line, stable on Copy                   | PASS                         | `surface-hierarchy.spec.ts`, `motion.spec.ts`, field geometry                                                                                                                                        |
| Copy from field and toolbar share one clipboard write | PASS                         | `clipboard.ts`, `App.test.tsx`                                                                                                                                                                       |
| Copy feedback 150ms fade, no layout shift             | PASS                         | `motion.spec.ts`, `docs/ux-reference/m18-motion-matrix.md`                                                                                                                                           |
| Refresh keeps inbox, no duplicate requests            | PASS                         | `Inbox.test.tsx`, `motion.spec.ts` row identity                                                                                                                                                      |
| Change guards stale responses, clears old messages    | PASS                         | `useMailboxSession.ts` generation token, `recovery.test.tsx`                                                                                                                                         |
| Delete device-side and truthful                       | PASS                         | `storage.spec.ts` `indexedDB.databases()` empty                                                                                                                                                      |
| Empty inbox illustrated state                         | PASS                         | `Inbox.tsx`, `EmptyInboxArt`, browser tier                                                                                                                                                           |
| Populated inbox and message reader                    | PASS                         | `MessageView.test.tsx`, `verification-actions.spec.ts`                                                                                                                                               |
| Code `482731` / link extraction                       | PASS (unit) / BLOCKED (live) | parser unit suite; live reception pending external sender                                                                                                                                            |
| Back to inbox, no stale row re-entrance               | PASS                         | `App.tsx` hidden-but-mounted inbox, `motion.spec.ts`                                                                                                                                                 |
| Saved mailbox restore after reload                    | PASS                         | `recovery.test.tsx`, live `--verify` restoredAddressMatches: true                                                                                                                                    |
| Provider errors, throttle, expiry                     | PASS                         | `provider` unit suites, failure-state browser cases                                                                                                                                                  |
| Responsive 5 viewports, no overflow                   | PASS                         | `responsive-a11y.spec.ts`, `visual-baselines.json`                                                                                                                                                   |
| Focus, contrast, reduced motion, CDP landmarks        | PASS                         | `focus.spec.ts`, `pairs.test.ts`, `sections.spec.ts`, `responsive-a11y.spec.ts`                                                                                                                      |
| Extension domain selection on a real domain           | PASS (live)                  | `live-domain-selection.mjs`, `cvbrg7mqc29d@euploading.com`                                                                                                                                           |
| Extension browser tier                                | PASS — 5/5 consecutive runs  | 109/109 on five consecutive full-tier runs after fixing the two precondition defects (a direct recorder read before capture, and a 5s default timeout on a live creation). See `m21-determinism.md`. |
| Real incoming email received and opened               | **BLOCKED**                  | no external sender; real mailbox prepared, `--verify` reports PENDING                                                                                                                                |
| Premium / authenticated / mobile-app routes           | APPROVED DEVIATION           | out of scope per M16, never faked                                                                                                                                                                    |

### Explicit rows for the remaining M16 inventory items

These rows were not itemised in the first matrix; an independent reviewer found the blanket claim
insufficient. They are recorded here rather than silently counted as passing.

| M16 row                                | Status                             | Evidence / reason                                                                                                                                                                                                                                                            |
| -------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S08 popovers / menus / dialogs         | NOT VERIFIED                       | QR and Copy effects were not observable in the reference session; `motion-spec.md` records NOT INSPECTED and no product dialog was measured                                                                                                                                  |
| I25 article link targets               | NOT VERIFIED                       | reference article links were enumerated but not followed; local info section uses plain text, not dead links                                                                                                                                                                 |
| I27 / I28 Premium domain form controls | APPROVED DEVIATION                 | reference form is Premium-only; out of scope, not faked                                                                                                                                                                                                                      |
| I29 contact Send                       | APPROVED DEVIATION                 | no send endpoint; footer names Contact as information, not a control                                                                                                                                                                                                         |
| I24 locale pages                       | APPROVED DEVIATION                 | 27 language routes are external/translation destinations, not in-scope free-web product flows                                                                                                                                                                                |
| M18 frame/video comparison gate        | PASS for the one observable effect | `m21-motion-frames.md`: controlled-replay samples at 0/37.5/75/112.5/150 ms match exactly (0/0.225/0.45/0.675/0.9). Screencasts still carry the screenshot-fallback limitation, so this is frame-level comparison rather than smooth video; no unobserved effect is claimed. |

## C. Architecture and process

| Item                                     | Status             | Evidence                                                                                                                                                                     |
| ---------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M17 OpenSpec migration archived          | PASS               | `archive/2026-11-21-m17-design-contract-migration/`, 9 files R100, 16 specs validate                                                                                         |
| No active changes                        | PASS               | `openspec list` → No active changes                                                                                                                                          |
| No delta-only headings in promoted specs | PASS               | grep over `openspec/specs/`                                                                                                                                                  |
| `pnpm verify` on final tree              | PASS               | exit 0, 1440 tests / 79 files                                                                                                                                                |
| Website / extension browser tiers        | PASS / recorded    | 48/48 website; extension 108–109/109 with isolated-passing flakes                                                                                                            |
| No proxy, backend, key, invented domain  | PASS               | code + `docs/superpowers/specs/2026-11-20-provider-domain-research.md`                                                                                                       |
| M18/M19/M20 OpenSpec lifecycle           | APPROVED DEVIATION | no spec-level behavior change: M17's only-observed-motion rule already governs M18; M19/M20 are verification-only. No change to archive; recorded rather than inventing one. |

## D. Handoff verdict

**PARTIALLY MET.** Every in-scope route and product flow now has an evidence row, but the
following mandatory rows remain and none is silently counted as a pass:

1. **BLOCKED — live reception**: a real incoming email has not been received and opened, because
   no external sender is configured. A fresh real mailbox is prepared at
   `yba0aw1769iq@euploading.com`; send the specified test message to it and re-run
   `node apps/extension/e2e/live-reception.mjs --verify`. The harness now keeps its state and
   browser profile in a dedicated gitignored `e2e/.live-reception/` directory rather than
   Playwright's `test-results/`: measured, a full 109-case extension-tier run no longer wipes the
   prepared mailbox, and `--verify` still reports `restoredAddressMatches: true` afterwards.
2. **NOT VERIFIED — human acceptance**: no test in this repository reads a rendered pixel's
   colour or position; a person must accept the finished experience.
3. **PASS — extension tier determinism**: the two precondition defects were fixed and five
   consecutive full-tier runs each reported 109/109 with exit 0 (`m21-determinism.md`).
4. **PASS for the one observable effect — M18 frame gate**: controlled-replay samples match at
   all five offsets (`m21-motion-frames.md`). The screencasts still carry the fallback limitation;
   no unobserved effect is claimed.
5. **Role-preserving deviations, not route parity**: 9 of 10 reference routes are represented by
   original on-page copy and `docs/PRIVACY.md`, not delivered as routes.

Rows 1 and 2 remain: they need an external sender and a human reviewer respectively. Rows 3 and 4
were independently actionable and are now closed with evidence rather than left as notes.

An independent reviewer confirmed the archive, spec validation (16/16), no delta-only headings,
live-vs-mock honesty, and the security/code surface; it found no Critical issue. It reached the
same PARTIALLY MET verdict with these tighter rows.
