# Tasks: m17-design-contract-migration

## 1. Region inventory and declared order

- [x] 1.1 Extend `apps/web/src/sections.ts` `PAGE_ORDER` from the five-region list to the M16-derived inventory: `product`, `overview`, `articles`, `explainer`, `footer` (names are SpectreMail's own; order follows M16). Keep the list as the single source read by browser checks.
- [x] 1.2 Add a failing browser assertion that the declared inventory's regions render in order and that every region has its own accessible heading. Run it red, then implement.
- [x] 1.3 Update `App.test.tsx`/browser tests that pinned exactly five regions to the new inventory by reading `PAGE_ORDER`, not a literal count.

## 2. Below-fold information sections

- [x] 2.1 Add `apps/web/src/PageSections.tsx` (or focused siblings) rendering the measured sections with **original SpectreMail copy**: a lead explainer, Popular Articles-style curated links to public routes, and the long-form informational blocks corresponding to M16's H2 titles. No reference prose verbatim, no marketing cards, no provider badges.
- [x] 2.2 Give each section a stable `data-region` and its own heading; style with existing tokens and no remote asset.
- [x] 2.3 Add a browser check that no new section renders an interactive control that does nothing (no fake buttons/links).

## 3. Footer and public navigation

- [x] 3.1 Add `apps/web/src/PageFooter.tsx` after `<main>` with truthful limits, attribution and in-app route links from the footer inventory; external/premium/app destinations are text, not dead controls.
- [x] 3.2 Keep `role=contentinfo` and the "what this page can and cannot do" accessible name pinned by existing tests.
- [x] 3.3 Update `website-client` footer assertions to read the new content while preserving the no-licence/no-own-server rules.

## 4. Public routes

- [x] 4.1 For each of the ten M16 routes, record `implemented` or `approved deviation` in a new `docs/ux-reference/route-status.md`. Implement the in-app informational routes that can reuse the shared shell and original copy; do not fake premium or external destinations.
- [x] 4.2 Add a browser smoke test for each implemented route; no route renders a misleading control.

## 5. Full-page visual comparison

- [x] 5.1 Add a repeatable capture procedure/script producing reference and local full-page PNGs at all five M16 viewports with dynamic address/timestamp masking and capture metadata.
- [x] 5.2 Produce the M17 comparison artifacts and a ranked mismatch log; fix major untracked structural mismatches or record an approved deviation with reason.

## 6. Verification and delivery

- [x] 6.1 Run `pnpm verify`, website browser tier and extension browser tier on the changed tree; record exact outputs including any worker-timeout flake.
- [x] 6.2 Run the OpenSpec verify workflow, sync promoted specs and archive the change through the repository branch/PR flow.
- [x] 6.3 Update `docs/ROADMAP.md` Project Status: M17 complete in scope, cursor M18.

