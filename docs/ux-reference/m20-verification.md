# M20 — Responsive, accessibility and visual-regression verification

Date: 2026-11-21. Tree: `main` at `2d94548`, branch `test/m20-responsive-a11y`.

## Baselines and reproducibility

`apps/web/e2e/visual-baseline.mjs` serves the built website and captures full-page PNGs at all
five M16 viewports (1440×900, 956×885, 768×1024, 390×844, 360×800) with zoom 100%, dpr 1 and
fonts loaded. `docs/ux-reference/visual-baselines.json` records, per viewport: image path, dated
reference path (`referenceDate: 2026-11-21`), scroll height, overflow flag, masks and
`layoutMasked: false`. Only dynamic address values and timestamps are masked; layout is never
masked. Run `node apps/web/e2e/visual-baseline.mjs --write-baseline` to regenerate.

## Responsive and accessibility checks

`apps/web/e2e/responsive-a11y.spec.ts` adds 7 browser cases: at each of the five viewports it
asserts the declared `PAGE_ORDER`/`REGION_HOOKS` regions render in order and that there is no
horizontal overflow; plus a long-address containment case at 360px and a reduced-motion sweep at
mobile width. It found and fixed a real 13px overflow at 360px (the header's second metadata pill),
and confirmed the product region's `data-region="product"` hook was missing from the declared
inventory. Existing `focus.spec.ts`, contrast tests, reduced-motion tests and CDP landmark checks
remain in force (48 website browser cases total).

## Gates re-run on the changed tree

- `pnpm verify` exit 0 — typecheck, lint, format, **1440 tests / 79 files**, both builds.
- Website browser tier **48 passed**.
- Extension browser tier 108–109/109 with load-driven live-domain flakes that pass in isolation,
  recorded honestly in `docs/ux-reference/m19-journey-report.md`.
- Architecture boundaries 56/56; no delta-only headings in promoted specs.

## Independent browser review

A reviewer read the built full-page captures against the dated reference captures and the motion
matrix. Findings recorded as intentional deviations, not hidden mismatches:

| Exclusion / deviation                    | Owner       | Reason                                                                    | Review date |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------- | ----------- |
| Page length 2,567 vs 4,281px (desktop)   | SpectreMail | reference long-form prose is protected; original copy preserves the roles | 2026-11-21  |
| Footer external badges/language switches | SpectreMail | premium/app/external destinations are out of scope, never dead controls   | 2026-11-21  |
| Address field 448 vs 400px               | SpectreMail | mono 16px address needs the width not to clip                             | 2026-11-21  |
| Ad/spinner rotation not reproduced       | SpectreMail | observed on advertising SVG paths, out of product scope                   | 2026-11-21  |
| Live reception                           | external    | no sender configured; real mailbox prepared, verify reports PENDING       | 2026-11-21  |

No critical accessibility or mobile regression remains. No baseline exclusion hides a layout
mismatch. M21 audits the full inventory against these baselines.
