# M18 — Motion and microinteraction parity: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans`. Steps use checkbox tracking.

**Goal:** reproduce only the motion M16/M18 actually observed in the reference, with a frame/video comparison matrix and no invented timing.

**Architecture:** add a single token-backed Copy tooltip fade (150ms linear, opacity 0 → 0.9, fill backwards), keep the three existing product entrances and reduced-motion stop, and add a repeatable motion-capture procedure. No layout or provider changes.

**Tech Stack:** TypeScript/React, CSS custom properties, Vitest, Playwright, OpenCode Browse recording.

**Spec:** `docs/ux-reference/motion-spec.md`, `openspec/specs/visual-system/spec.md`, `docs/ROADMAP.md` §M18.

## Global constraints

- Reproduce only observed animation; record UNKNOWN where the reference could not be read.
- Every duration/easing/distance must be a declared token; no literal in client CSS.
- `prefers-reduced-motion: reduce` removes all animation; it does not shorten it.
- No layout shift from feedback; no stale message from a prior mailbox.
- No proxy, backend, new provider, or extension redesign.

## Review Focus

- Copy feedback must fade without resizing the field or moving the toolbar (regression: earlier in-flow status did resize it).
- A repeated Copy press must restart the fade, not be swallowed by an unchanged state string.
- Reduced motion must remove the fade and the three entrances on the same page.
- The reference fade is 150ms linear opacity 0→0.9; a hand-picked constant would be a guess, so it must be a declared token.
- The ad/spinner `rotation` is reference-observed but out of product scope; it must not be copied into product UI.

## Tasks

### Task 1: Declare the observed tooltip timing as tokens

**Files:** `packages/ui/src/tokens.ts`, generated `packages/ui/src/tokens.css`, `docs/DESIGN_SYSTEM.md`.

- [ ] 1.1 Add `MOTION` entries for the observed feedback duration `150ms` and easing `linear`, with a comment recording the 2026-11-21 measurement and its source (tooltip `tooltip fade bs-tooltip-bottom show`, opacity 0→0.9, fill backwards).
- [ ] 1.2 Regenerate `tokens.css` and `docs/DESIGN_SYSTEM.md` through their existing emit scripts; run `tokens-css` and `design-doc` tests.
- [ ] 1.3 Verify the emitted files are byte-identical to a fresh generation (no hand edits).

### Task 2: Copy feedback tooltip fade (TDD)

**Files:** `apps/web/src/styles.css`, `apps/web/e2e/motion.spec.ts`, `apps/web/src/App.test.tsx`.

- [ ] 2.1 Write a failing browser test: after activating in-field Copy, a fixed toast carries a one-shot animation whose name resolves to the declared keyframes, duration 150ms, easing linear, and whose final opacity is 0.9; the address field's bounding box is unchanged before/after. Run it red.
- [ ] 2.2 Implement `@keyframes spectre-tooltip-fade { from { opacity: 0 } to { opacity: 0.9 } }` and apply it to `.toast` with the declared duration/easing/fill, keeping the toast fixed and out of flow. Include `.toast` in the reduced-motion stop list.
- [ ] 2.3 Verify the browser test green and existing focus/contrast/motion suites green.
- [ ] 2.4 Add a unit assertion that a second Copy press restarts the toast (sequence state already implemented) and that reduced motion produces no animation.

### Task 3: Motion comparison artifacts and matrix

**Files:** `docs/ux-reference/motion-matrix.md`, `docs/ux-reference/captures/` recordings.

- [ ] 3.1 Capture paired reference/local recordings of Copy, refresh, Change, message open/back and the reduced-motion state using the Browse recorder and Playwright; where the recorder falls back to still frames, record that as a limitation rather than claiming video.
- [ ] 3.2 Write a motion matrix with one row per observable effect: reference capture, local capture, extracted measurement, PASS/FAIL/UNKNOWN. Record the reference ad rotation as OBSERVED/OUT-OF-SCOPE and the unreadable keyframes as UNKNOWN.
- [ ] 3.3 Confirm no high-severity motion discrepancy is labelled complete.

### Task 4: Verification and delivery

- [ ] 4.1 Run `pnpm verify`, website browser tier and extension browser tier on the changed tree.
- [ ] 4.2 Independent code/motion review; fix Critical/Important findings.
- [ ] 4.3 OpenSpec delta if any requirement changes beyond M17's only-observed-motion rule; otherwise record that no new spec is needed.
- [ ] 4.4 Update the roadmap: M18 complete in scope, cursor M19; branch/PR/merge.
