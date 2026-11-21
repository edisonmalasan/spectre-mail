# Design: m17-design-contract-migration

## Context

M16 evidence in `docs/ux-reference/` is the authority for the public free web surface: ten routes, a 4,281px home page, nine below-fold headings and a footer. SpectreMail currently renders a 900px product-only screen. `page-composition` and `visual-system` contain M7-era rules that would forbid the measured structure; the delta specs supersede only those rules and keep truthfulness, focus, contrast, tokens and reduced motion intact. The working product and the extension are not redesigned by this change.

## Goals / Non-Goals

**Goals:**
- Render the product first, then the measured information sections and footer in one declared order.
- Give each public route an implementation or a recorded approved deviation.
- Compare full-page reference and local screenshots at matched viewports with dynamic values masked.

**Non-Goals:**
- No proxy, backend, new provider, or new domain integration.
- No extension layout or behaviour change.
- No copyrighted reference prose or graphics; no remote fonts or images.
- No change to session, storage, security or privacy rules.

## Decisions

1. **Region inventory as data.** `PAGE_ORDER` in `apps/web/src/sections.ts` becomes the single declared order, extended from five to the full inventory; browser checks read it rather than a hardcoded list. Alternative — hardcoding new sections in JSX — was rejected because a count that lives only in markup is a count nothing checks.
2. **Original copy in dedicated modules.** Below-fold sections and footer live in small components beside `Steps`/`Reasons`, with original SpectreMail prose that preserves each measured section's informational role. Alternative — reusing reference text — was rejected by M17's own non-goal and the project's IP boundary.
3. **Product shell unchanged.** `Address`, `Inbox`, `MessageView`, toolbar and session rendering stay where they are; new sections are appended after them. Alternative — reflowing the product into the new sections — was rejected because it would rewrite a tested state machine for a composition change.
4. **Footer carries public navigation.** Route links use real in-app routes where implemented; external/premium/app destinations are rendered as text or omitted with a recorded deviation, never as dead controls.
5. **Motion stays measured.** `rotation` observed only on reference ads/spinners is recorded, not copied into product UI. The three product entrances and their reduced-motion stop remain.
6. **Comparison artifacts in `docs/ux-reference/captures/`.** Full-page PNGs at all five viewports, with a metadata file and a mask rationale. Alternative — pixel-diff score as the gate — was rejected by the roadmap.

## Risks / Trade-offs

- **Reference site changes** → captures are dated 2026-11-21; M21 re-audits and refreshes evidence rather than moving the target silently.
- **Large DOM addition may shift layout tests** → existing assertions pin the product's region names and testids, which are preserved; browser checks are retargeted to the declared inventory.
- **Protected prose** → all new copy is original; informational roles match, wording does not.
- **`pnpm verify` worker-timeout flake** → recorded, not rounded to green; `--no-file-parallelism` is the control run.

## Migration Plan

Proposal → specs → design → tasks → apply in slices (new components, inventory, footer, routes, comparison artifacts) → verification → spec sync → archive. Rollback is reverting the feature branch; no data migration is involved.

## Open Questions

None that would change specs or tasks. Whether a person accepts the finished visual result is M21's human judgement, recorded there rather than assumed here.
