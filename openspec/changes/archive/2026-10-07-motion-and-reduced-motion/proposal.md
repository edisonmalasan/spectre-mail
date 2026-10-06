# Proposal

## Why

`docs/ROADMAP.md` gives M7 a Motion block and gives the same milestone an accessibility
requirement that no earlier milestone could deliver: honour `prefers-reduced-motion: reduce`
and make the motion **stop** rather than merely shorten. M7 slice 1 left this half of the
milestone in a deliberately awkward state — it declared `--duration-fast`, `--duration-base`
and `--ease-standard` in the token layer, consumed them with nothing, and said so in
`docs/DESIGN_SYSTEM.md` and in `apps/web/src/styles.css` so that no reader could mistake a
motion token for a live one.

That state is the debt this change pays. Its whole point is that the reduced-motion fix has
to land **with** the motion it governs, and slice 1 refused to ship either without the
other. It is now the only thing between M7 and a milestone whose motion claims are
asserted rather than described.

There is a second reason, found by reading the page rather than the roadmap: the inbox
polls every five seconds, so *any* animation on an inbox row is a motion that can repeat
without the user doing anything. The three entrances the roadmap names have to be built so
that a row already on the page is never re-animated by a later poll, or the product would
flicker five times a minute for as long as the page is open. That property is a
requirement here rather than a detail, and it is the reason this change is worth its own
slice instead of a paragraph in slice 3.

## What Changes

- **`MOTION` gains two declared values** — the blur distance and the rise distance the
  roadmap's materialise is specified in (`blur 6px → 0`, `translateY 4px → 0`). They are
  declared rather than reused from `--space-1`, because `--space-1` is read by many layout
  rules and changing it for layout reasons would silently change the motion.
- **`apps/web/src/styles.css` gains one `@keyframes` block and three declarations.** The
  mailbox address, an inbox row, and a rendered verification code each materialise once:
  opacity `0 → 1`, the declared blur to `0`, the declared rise to `none`. The two singular
  moments use `--duration-base` and the inbox row uses `--duration-fast`, because rows
  arrive in bursts and a queue of half-materialised rows reads as lag.
- **`apps/web/src/styles.css` gains one `@media (prefers-reduced-motion: reduce)` block**
  that removes the animation from those three hooks. Not a shorter duration, not a
  `0.01ms` trick: no animation at all, so "stopped" is the literal rendering rather than a
  duration small enough to be called stopped.
- **No component, element, accessible name, or `data-testid` changes.** Every hook the
  motion needs already exists, so `apps/web`'s 113 unit tests are unaffected and this slice
  is CSS plus tokens plus one browser spec.
- **`docs/DESIGN_SYSTEM.md`'s generated Motion region stops saying the tokens are unused**,
  and a `packages/ui` test that asserted that sentence changes with the behaviour it
  described — recorded in the delta, not weakened silently.
- **`apps/web/e2e/motion.spec.ts` is a new browser spec** that establishes four things by
  measurement: the three entrances carry the declared durations and easing; under
  `reduce`, **no element on the page** reports a running animation; under `no-preference`
  the same three do, so the previous claim cannot be satisfied by motion simply being
  absent; and a row already on the page survives a later identical poll as the *same
  element*, with no animation started on it.
- **`AGENTS.md`'s claim that a boundary rule enforces literal design values in a shipped
  stylesheet is corrected.** Measured on 2026-10-06, no rule does: `stylesheetViolations()`
  covers a remote origin, a removed focus indicator, and an undeclared custom property, and
  nothing else. The categories are true of `apps/web/src/styles.css` today (measured by
  reading the file) and are not enforced. That correction is in scope because this slice is
  what makes the **duration** category load-bearing.

### What this change does not deliver, and names rather than implies

- **No exit animation.** The roadmap's phrase is *"materialize/disappear motion"*, and only
  the first half ships. An element React has unmounted is gone before any transition can
  run; delivering the second half needs either a JS exit lifecycle or View Transitions,
  which is new runtime behaviour outside a CSS slice and would need its own verification.
- **No `transition`.** `.control:hover` and `.control:active` still change instantly. The
  roadmap's Motion block names three entrances and this delivers those three; hover
  transitions are a fourth thing the roadmap does not ask for.
- **Nothing about how the motion looks.** The spec reads computed values and the Web
  Animations API in Chromium. It never reads a rendered pixel, so "the materialise is
  tasteful" remains a human judgement, exactly as it is for focus and contrast.
- **No claim about any browser but Chromium**, for the same reason the focus tier makes
  none.

## Capabilities

### New Capabilities

None. This change adds requirements to a capability slice 1 created; it does not introduce
a new one, and a separate `motion` capability would split one subject — an animation and
the preference that governs it — across two documents that would then have to agree.

### Modified Capabilities

- `visual-system`: two requirements are **added**. One governs what the motion is — the
  three entrances the roadmap names, its declared geometry, and its duration and easing
  read from the token layer. The other governs `prefers-reduced-motion`, including the
  positive control that keeps the first requirement falsifiable. No existing requirement is
  amended: *"The design tokens are declared once and read from one place"* enumerates
  colour, type family, type scale, spacing step, radius and border width, and **duration is
  not among them**, so that requirement is silent on motion rather than false about it.
  Extending its enumeration would assert a clause no rule enforces, which is the failure
  shape its own `Note` warns about.

## Impact

- `packages/ui/src/tokens.ts` — two values in `MOTION`, and the comment that says they are
  used by nothing replaced.
- `packages/ui/src/tokens.css`, `docs/DESIGN_SYSTEM.md` — both generated; each already has
  its own byte-identity assertion and both are re-emitted by this change.
- `packages/ui/src/design-doc.ts`, `packages/ui/src/design-doc.test.ts` — the generated
  Motion prose is rewritten, and the test that asserts the old sentence changes to assert
  the new one.
- `apps/web/src/styles.css` — one `@keyframes`, three `animation` declarations, one reduced
  motion block, and a header comment that currently says *"No animation and no transition"*
  and is therefore false the moment this lands.
- `apps/web/e2e/motion.spec.ts` — new. The boundary rule that requires every shipped
  `*.spec.ts` to be collected by the browser suite and by nothing else covers it on
  arrival; the browser tier goes 12 specs to 13.
- `AGENTS.md`, `docs/ROADMAP.md`, `docs/DESIGN_SYSTEM.md` — the Project Status cursor, the
  M7 slice table's slice 2 row, and the corrected enforcement claim.
- **No** component, provider, storage, mailbox, parser, extension, or CI change.