# Proposal: m17-design-contract-migration

## Why

M16 measured the real Temp Mail free web page on 2026-11-21: a **4,281px** full page with a hero, a four-button toolbar, an inbox, nine below-fold editorial sections and a 266px footer, across ten public no-account routes. SpectreMail renders a **900px single screen** with only three headings and no footer or public routes. Promoted requirements currently *forbid* that structure: `page-composition` mandates exactly five regions and no sixth, and `visual-system` mandates exactly three animations. Those requirements were true for M7's approved direction but now contradict the approved M16–M21 parity programme. They must be superseded by an approved change, not silently ignored.

## What Changes

- **BREAKING** replace the "exactly five regions / no sixth" rule with a reference-derived region inventory: the working product remains first, followed by the measured below-fold information sections and the footer; each region has its own heading and the order is declared once.
- **BREAKING** replace "motion is exactly three materialisations" with "only observed motion SHALL be reproduced": product entrances remain token-timed; a reference-observed continuous rotation (2,000ms linear infinite on reference ad/spinner elements) is recorded, not copied into product UI unless separately justified.
- Reconstruct the full public page in `apps/web`: below-fold sections with original SpectreMail copy, a footer, and the public no-account routes discovered in M16, preserving branding, provider truthfulness and the existing working product.
- Keep all colour/type/spacing tokens single-source; no remote asset; focus and reduced motion preserved.
- Add repeatable matched-viewport screenshot comparison for the full page (M17 deliverable).

## Capabilities

### New Capabilities
- `public-site-parity`: the public no-account free page structure, routes and footer, their order and their evidence-backed mapping, independent of the working product's state machine.

### Modified Capabilities
- `page-composition`: region count/order rule superseded by the M16 inventory; keep the truthfulness and token rules.
- `visual-system`: motion rule superseded by "only observed motion"; keep focus, contrast, no-remote-asset and token rules.
- `website-client`: the footer requirement broadened from a limits list to the reference-derived footer; the no-provider-badge rule stays.
- `build-and-verification`: full-page matched-viewport comparison added as a verification deliverable for M17–M20.

## Impact

`apps/web/src/App.tsx`, new section/footer components and styles, `packages/ui` tokens only if a measured value needs declaring, website browser specs, `docs/DESIGN_SYSTEM.md` generated region, `docs/ux-reference/` evidence. No backend, no proxy, no new provider, no extension layout change. Archived OpenSpec changes and `docs/PROVIDERS.md` untouched.
