# Design

## Context

See `proposal.md` — Why. What follows is only the state that constrains the approach, and
it is measured, not recalled:

- **`MOTION` is declared and consumed by nothing.** `packages/ui/src/tokens.ts` holds
  `--duration-fast: 120ms`, `--duration-base: 200ms`, `--ease-standard:
  cubic-bezier(0.16, 1, 0.3, 1)`. `apps/web/src/styles.css` contains no `animation`, no
  `transition`, no `@keyframes` and no `prefers-reduced-motion` block, and its header
  comment says so as a deliberate absence.
- **The hooks the motion needs already exist.** Measured in the shipped stylesheet:
  `.address__value` (the address), `.inbox-row` (an inbox row), `.code` (a rendered
  verification code). Slice 1 added class hooks to twelve components and this slice needs
  none of them.
- **Inbox rows are keyed by message id** — `<li key={message.id}>` in `apps/web/src/Inbox.tsx`
  — and the inbox is **not** unmounted by opening a message: `apps/web/src/App.tsx` renders
  `MessageView` *after* `Inbox` and the comment there says why. So element identity survives
  both a re-render and a navigation.
- **The inbox polls.** `INBOX_POLL_PROMPT_MS = 5_000`, doubling per unchanged check to a
  30s ceiling (`packages/mailbox/src/cadence.ts`). Those are the product's own numbers;
  no provider limit was measured for the one provider a browser can reach.
- **`docs/DESIGN_SYSTEM.md`'s Motion table is generated** by
  `packages/ui/src/design-doc.ts`, and `packages/ui/src/design-doc.test.ts` asserts the
  generated region contains the sentence *"used by nothing"*. That test exists to stop a
  reader assuming motion tokens imply motion, and this change is what makes it false.
- **No boundary rule enforces literal design values.** Measured by reading
  `stylesheetViolations()` in `tests/architecture/boundaries.test.ts` on 2026-10-06: it
  applies `REMOTE_CSS_PATTERNS`, `FOCUS_SUPPRESSION_PATTERNS` and `collectUnresolvedTokens`,
  and nothing else. The categories `AGENTS.md` attributes to it — colour, radius, spacing
  step, type size, duration — are true of `apps/web/src/styles.css` when read (no hex, no
  `rgb()`, no named colour, no time value; the only length literals are `translateY(1px)`,
  `max-height: 28rem` and the one `@media (max-width: 34rem)`) and are **not** enforced.

## Goals / Non-Goals

**Goals:**

- One materialise, three entrances, every one of its values declared in the token layer.
- `prefers-reduced-motion: reduce` that removes the animation rather than shortening it,
  established as a property of every element on the page rather than of three selectors.
- Two instruments that can each fail for their own reason: a static check of what the
  stylesheet *declares*, and a Chromium check of what the page *resolves*.
- No movement of any test count except the two that must move.

**Non-Goals:**

- Exit animation. See D2.
- `transition` on hover, press, or anything else. See D9.
- Any claim about appearance. See D10.
- Any claim about Firefox or WebKit, consistent with the focus tier.
- A boundary rule for motion values. See D14.

## Decisions

### D1. This slice is CSS, and it changes no component

`docs/ROADMAP.md` puts both of M7's deferred accessibility items in this milestone because
*"both are CSS"*. Slice 1 honoured that; slice 2 honours it too, and the hooks it needs
already exist. Consequences that are load-bearing rather than incidental:

- `apps/web` stays at **113** unit tests. A movement would have meant a component changed,
  and would have to be explained before anything else was looked at.
- No `data-testid`, no element, no accessible name moves, so the boundary rule requiring
  every shipped spec to be collected, and the focus spec's traversal over the same control
  set, are unaffected by construction.
- The browser tier goes 12 specs to 13, and every existing spec is re-run **ten times**
  (see D15).

**Alternative considered — a hook that marks "this just arrived".** Rejected. It would be a
`className` on rows driven by a diff of the listing, which is runtime behaviour added so
that a CSS effect could fire; `animation` already fires on insertion, and a prop that
exists only to restart a style is the kind of coupling that later changes break silently.

### D2. Entry only. `disappear` is not delivered, and the reason is structural

The roadmap's phrase is *"materialize/disappear motion"*. Only the first half ships.

An element React has unmounted is **no longer in the document**, so no CSS transition or
animation can run on it. There is no CSS-only way to animate an exit: `transitionend` fires
on a node you no longer own, `@starting-style` and `animation` both require the node to
exist, and `allow-discrete: transition-behavior` is the same requirement with extra steps.
Delivering the second half means either a JS exit lifecycle — hold the node, wait for the
animation, then remove it, which is a real state machine in `packages/mailbox`'s client
wiring — or the View Transitions API, which is Chromium-only and would make the page's
motion untestable in any engine this repository does not already refuse to claim.

Both are new runtime behaviour. Neither is what this milestone's accessibility requirement is
about, and both would need their own verification. So the scope is entry, and the
proposal, this decision and `docs/ROADMAP.md`'s slice row all say so in the same words.

### D3. Three entrances, three existing hooks, one keyframes block

`.address__value`, `.inbox-row`, `.code` — one shared `@keyframes materialise`, and one
grouped selector list carrying the three `animation` declarations.

Grouping them matters more than it looks (D7): the reduced-motion block must name the same
selectors, and if the two lists are adjacent and declared together, adding a fourth entrance
and forgetting the reduce list is a visible omission rather than a silent one.

**Alternative considered — three keyframes blocks.** Rejected: three entrances sharing one
geometry is the same decision three times, and the only thing that differs between them is
duration, which the `animation` shorthand already carries.

### D4. `--blur` and `--rise` are declared, not borrowed from `--space-1`

`--space-1` is `0.25rem`, which is **exactly** the roadmap's 4px rise, so reusing it would
have added no token at all. It is still wrong: `--space-1` is read by roughly a dozen
layout rules, so a change made to a spacing step for layout reasons would silently move the
motion, and the design document would then describe a motion nobody chose.

Both are declared in `MOTION`, in `px`, because they are optical offsets rather than
typographic or layout measures and because the roadmap specifies them as pixels. They go at
the **front** of `MOTION`, before the durations: a reader meeting `blur(var(--blur))` inside
a keyframes block wants the value before the timing.

This is the second time the token layer's "not layout" clause has had to survive a new kind
of value — slice 1's verification pass added the qualification for the two `measure-*`
tokens, and this is the same qualification meeting a motion distance. The argument is the
same and it holds: at rest the transform is `none` and the filter is absent, so neither
value affects where anything is. They are what an element *does on the way in*, not what it
*is*.

### D5. Duration assignment: `--duration-base` for the singular moments, `--duration-fast` for the row

The mailbox address and a verification code are single, isolated events, and both are things
a person reads. `--duration-base` (200ms) gives the blur time to resolve into something
legible rather than snapping.

An inbox row arrives in bursts. At `--duration-base`, five messages arriving together would
be five half-materialised rows for 200ms, and a burst would read as the page being slow —
which is the opposite of what the effect is for. `--duration-fast` (120ms) is still twelve
frames at 60Hz, enough for the blur to be seen, and short enough that a burst settles.

Both declared tokens are therefore used, and the mapping has a reason rather than an
assignment.

### D6. No fill mode, and that is what makes removal safe

`@keyframes materialise` goes `from { opacity: 0; filter: blur(var(--blur)); transform:
translateY(var(--rise)); }` to `to { opacity: 1; filter: blur(0); transform: none; }` — and
each of those three `to` values is **what the element's own declarations already are**.
`.address__value`, `.inbox-row` and `.code` declare no `opacity`, no `filter` and no
`transform`, so they compute to `opacity: 1`, `filter: none` (identical rendering to
`blur(0px)`) and `transform: none`.

So with the default `animation-fill-mode: none`, **finishing the animation and having no
animation at all are the same rendering**. That is the whole reason the reduced-motion block
can be `animation: none` and be correct rather than a compromise, and it is why no fill mode
is declared: a fill mode would pin the final frame explicitly and make the two states differ
again.

This is also the argument that makes `filter: blur(0)` in the `to` frame redundant-but-true:
it is written because a keyframe block whose last frame omits a property is interpolating
from the initial value, not from the element's own declaration, and relying on that would
make the two states differ.

### D7. `prefers-reduced-motion` is a media query placed after the entrances, and the placement is load-bearing

The block is pure CSS. No script reads the preference, which means there is no JS path to
test and no opportunity for the preference to be honoured on one code path and not another.

```css
@media (prefers-reduced-motion: reduce) {
  .address__value,
  .inbox-row,
  .code {
    animation: none;
  }
}
```

Same specificity as the entrance rules, so source order decides, so the block must come
**after** them. Moving it above would leave the entrances animating under a reduced-motion
preference — the exact defect the milestone exists to prevent, introduced by reordering two
blocks. The requirement's "no element reports a running animation" scenario is what catches
it, and the positive control is what stops that scenario from passing because the entrances
do not animate at all.

`animation: none` rather than a duration. The widely published workaround for this problem is
`0.01ms`, which is not a stop: it is an animation that finishes before a frame is composited,
so it makes a claim about timing rather than about the page. Removal is the only form whose
result reads back — an element with no animation reports none.

### D8. No `will-change`

`will-change: transform, opacity, filter` on `.inbox-row` would promote a compositing layer
per row, permanently, on a list that grows for as long as the page is open and can hold a
whole mailbox. The animation is 120ms and runs once per row; the promotion would outlive it
by minutes. Omitted, with the cost recorded: the first frame of each entrance may be
unaccelerated, which for a 120ms opacity-and-blur is not perceptible and was not measured
either way.

### D9. No `transition`, which means the reduce block has nothing else to govern

`.control:hover` and `.control:active` change instantly today and continue to. The roadmap
names three entrances; this delivers those three. Adding hover transitions would be a fourth
piece of motion the roadmap does not ask for, and the requirement would then have to govern
something this slice does not assert about.

The consequence is stated rather than hidden: the reduced-motion block governs
`animation` only, so **the requirement about transitions would be vacuous today**. It is
deliberately not written into this delta as a live claim. A later slice that adds a
transition inherits the obligation, and the browser spec's sweep asserts
`transition-duration` as a tripwire precisely so that the day someone adds one, the sweep
starts reporting rather than the requirement silently becoming true.

### D10. Two instruments, chosen because they measure different things

**Static, Node-side, in the spec: what the stylesheet declares.** The browser spec runs in
Node and can read `apps/web/src/styles.css`. It asserts that the `@keyframes materialise`
`from` frame declares `opacity: 0` and references `var(--blur)` and `var(--rise)`; that the
`to` frame declares `opacity: 1`, `blur(0)` and `none`; that every `animation` declaration
in the motion section takes its duration from `var(--duration-*)` and its easing from
`var(--ease-standard)`; that no literal time value and no literal `cubic-bezier(` appears
anywhere in the file; and that the reduced-motion block's selector list names **the same
selectors** as the entrance block's.

That last one is the tripwire for the next entrance, and it is only cheap because D3 groups
the entrances. It is also **narrow on purpose**: it compares two lists this slice writes, so
it cannot see an animation declared in some future component rule. The general check is the
browser sweep below, and neither substitutes for the other.

**Empirical, Chromium, in the page: what the page resolves.** Under
`prefers-reduced-motion: no-preference`, each of the three elements' resolved
`animation-name`, `animation-duration` and `animation-timing-function` are compared against
the values the **token layer declares on that page** — read with
`getComputedStyle(document.documentElement).getPropertyValue(...)`, the same instrument
`apps/web/e2e/focus.spec.ts` already uses for `--focus`. Under `reduce`, every element in
the document is swept and none may report a running animation.

**What neither instrument establishes.** Neither reads a rendered pixel. Both are exact about
what they read and silent about whether the materialise is any good. `packages/ui`'s contrast
tests are WCAG arithmetic and the focus specs read a computed outline; this is the third
instance of the same shape, and the limit belongs in `docs/DESIGN_SYSTEM.md`'s "What is
verified, and what is not" section rather than only in this file.

**Why the duration is compared relatively rather than against a literal.** If the spec
asserted `animationDuration === "0.2s"`, it would pin the token layer's value a second time
and would go red if someone changed it — which is a legitimate change and would make the
spec a place where the roadmap's numbers are restated. Reading the token off the live page
and comparing means the spec fails only when the stylesheet stops *using* the token, which
is the property. The declared values are already pinned by `packages/ui/src/tokens-css.test.ts`
and by the token layer's own byte-identity assertion; pinning them again in a browser adds a
third copy of the same fact and no new evidence.

### D11. Element identity, not appearance, is what proves an entrance ran once

"No row is re-materialised by a later poll" cannot be checked by looking: a settled row and
a row that re-materialised look identical once the animation is over. The observable is the
**element**. The spec sets a marker property on a row's DOM node, waits for a second listing
that reports nothing new, and asserts the marker is still on the row — because a node that
was removed and re-created cannot carry it.

This is the same move as the focus spec's assertion that a reading's name comes from the
element its outline came from: **assert the invariant that was actually violated, not a
proxy for it.** A visual check would have passed for a page that recreated every row on
every poll, which is precisely the defect the requirement exists to prevent.

It is also falsifiable in the right direction: the mutation that gives each row a fresh key
makes the marker vanish and the assertion goes red, and no mutation can make it green while
the marker is still there.

### D12. Three assumptions to measure before any assertion is written

Recorded here as assumptions because they are **not yet measured**, and this repository does
not write an assertion against an instrument it has not used:

1. **Duration serialisation.** Chromium reports `animation-duration` resolved from `200ms`
   as `"0.2s"`. The comparison needs a `ms`→`s` normalisation in the spec, and the
   normalisation is three lines and has to be right for the comparison to mean anything.
2. **Easing serialisation.** That `cubic-bezier(0.16, 1, 0.3, 1)` round-trips through
   computed style in that exact spelling. If Chromium re-serialises it (say as
   `cubic-bezier(0.16, 1, 0.3, 1)` with different spacing, or numerically normalised), the
   assertion compares strings and has to compare the right thing — or compare against a
   **probe element** the spec injects using `var(--ease-standard)`, which is relative and
   immune to serialisation.
3. **`prefers-reduced-motion` emulation.** That `page.emulateMedia({ reducedMotion })`
   re-evaluates a live page's media queries **without a reload**, which the third scenario
   of the reduced-motion requirement depends on.

**Fallback if (2) is not a clean round-trip:** the probe-element comparison above. It is
strictly better where it applies — it compares the product's resolved easing against a
declaration that uses the token, so it tests the linkage and not the spelling. If
measurement shows the probe approach is the only sound one, the assertion is rewritten to
use it and **this decision is amended in the change**, not silently in the diff.

Each of the three is measured first, and a failed assumption produces an amendment here
rather than an assertion bent to fit the instrument.

### D13. What changes in the generated document, and one test that changes with it

`packages/ui/src/design-doc.ts` emits the Motion section separately from the other groups,
*because* that section carries prose the loop cannot attach to one row of five. That prose
today is *"Declared and used by nothing in this slice."* It becomes a statement of what the
motion is and that `prefers-reduced-motion` removes it.

`packages/ui/src/design-doc.test.ts`'s *"states every motion token's being unused, since
that is the slice-2 constraint"* changes to assert the opposite, and it changes because the
behaviour it describes changed — this is the recorded case of a test being intentionally
changed, authorised by this delta rather than weakened to accommodate a diff. The test's
**purpose** survives unchanged: a reader finding `--duration-base` in a design contract
should be able to tell from the table what it does. It just no longer says "nothing".

`apps/web/src/styles.css`'s header bullet — *"No animation and no transition"* — is false
the moment this lands and is replaced with the position after this slice. So is the
sentence *"nothing here moves on its own"*: the inbox row now moves when mail arrives, which
is not "on its own" but is close enough that the sentence needs to distinguish **the page's
own cadence** from **the user's mail arriving**, and the honest form does.

`AGENTS.md`'s sentence *"A boundary rule enforces the categories above and not the rest"* is
**false**, measured on 2026-10-06 by reading `stylesheetViolations()`, and is corrected to
say the categories are measured and unasserted. This is not a new recorded instance of a
check being narrower than its rule — no check claims those categories. It is the adjacent
defect: a **document** broader than the enforcement that backs it, found by reading the rule
rather than by trusting the document, and corrected here because this slice is what makes the
duration category load-bearing.

### D14. No new boundary rule, and why that is the right call rather than the lazy one

This repository enforces prose with `tests/architecture/boundaries.test.ts`, and the obvious
move is to add a rule forbidding literal motion values in a shipped stylesheet. It is not
added, for a reason worth stating:

The rule would have to *parse* `styles.css` to know which declarations are animations. There
is no CSS parser in the workspace, so it would be a regex over source text, matching
declaration syntax it does not fully understand. This file has twenty-five recorded
instances of a check narrower than the rule it documented, and four of them were regexes
that missed a syntactic form — the framework-import rule matching three of four `import`
forms is the clearest. A hand-rolled CSS scanner added to a milestone whose subject is
adding motion would be a new, untested parser introduced by the change least able to justify
it.

Instead the requirement is enforced **where the value actually is**: the browser spec
compares each element's resolved duration against the token the page declares, so a literal
`300ms` in the stylesheet fails a test rather than passing a rule. That is a stronger
instrument than a text scan — it catches a literal *and* an indirect substitution — and it
reaches the second client for free at M8, when the second client's page is in the browser
tier. A rule would have had to be extended by hand per client, which is the exact defect
shape the collection rules were re-scoped to remove.

What the static half *does* cover is `apps/web/src/styles.css`, and the requirement's
scenario says "a shipped stylesheet" rather than naming the file. That gap is stated here
rather than papered over: a second client is uncovered until M8, exactly as `packages/ui`'s
own second-client scenario is.

### D15. Risk to the focus tier, which is already known to be intermittent

The focus spec's traversal waits for the control set to hold for five consecutive 100ms
reads, and it went red in CI once for a control that gained a layout box mid-walk. This slice
puts a `transform` and a `filter` on `.inbox-row`, and `translateY` changes a row's
`getBoundingClientRect()` during its entrance. That does not change `getClientRects()`
length, so the traversal's filter is unaffected — **but that is reasoning, not measurement**,
and this repository does not accept a reason where a run will do.

So: **ten consecutive local runs of `pnpm test:browser` after this change, with all 13 specs
collected and passing**, against the roughly one-in-three failure rate the settle fix
reduced. A red run is a defect in this change until shown otherwise, exactly as
`design.md` D16 of slice 1 required.

### D16. Rollback

Reverting the apply commit restores a page with no motion and the previous stylesheet header
— a state that already shipped and was verified. There is no data, no schema, no migration,
and no stored record involved, so there is nothing to roll back *except* code. The only
ordering concern is that `packages/ui/src/tokens.css` and `docs/DESIGN_SYSTEM.md` are
generated and must be re-emitted in the same commit as `tokens.ts` and `design-doc.ts`, or
the two byte-identity assertions fail — which is the intended behaviour and is why both files
are named in the same task.

## Risks / Trade-offs

- **A blur on text is a legibility cost for 120–200ms.** Accepted: the effect is the roadmap's
  own, the resting state is fully legible, and the reduced-motion path removes it entirely.
  Mitigation is D6 — the resting appearance is the final frame, so nothing is left mid-effect.
- **Motion the product chose, for mail the user did not.** `.inbox-row` animates because
  something arrived, which is user-caused, but it happens on a cadence the product chose.
  Mitigation is the third requirement and D11; it is the reason that requirement exists.
- **The static assertion compares two selector lists this slice writes** (D10) and is blind to
  an animation declared elsewhere. Mitigation is the browser sweep, which is general. The
  narrowness is recorded rather than hidden.
- **Three assumptions about the instrument are unmeasured** (D12). Mitigation is to measure
  before asserting and to amend this document rather than the assertion if one fails.
- **The reduced-motion sweep passes vacuously on `transition`** today (D9). Mitigation is
  that the requirement does not claim transitions, and the sweep carries the tripwire so the
  day it stops being vacuous it says so.

## Open Questions

None. Each of the three in D12 is answerable by measurement at apply without changing the
requirements, the approach, or the task breakdown, so it is recorded there rather than
deferred to here — a question in this section is one somebody would have to guess at, and
guessing at an instrument is what D12 exists to prevent.