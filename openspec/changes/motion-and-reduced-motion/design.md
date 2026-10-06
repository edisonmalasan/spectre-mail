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

**Static, Node-side, in the spec: what the file says.** The browser spec runs in Node and
can read `apps/web/src/styles.css`. It asserts that no literal time value and no literal
`cubic-bezier(` appears anywhere in the file, and that the reduced-motion block's selector
list names **the same selectors** as the entrance block's.

That last one is the tripwire for the next entrance, and it is only cheap because D3 groups
the entrances. It is also **narrow on purpose**: it compares two lists this slice writes, so
it cannot see an animation declared in some future component rule. The general check is the
browser sweep below, and neither substitutes for the other.

The file-wide sweep is a text claim and stays a text claim: it is about the absence of a
spelling anywhere in a file, which the CSSOM would answer rule by rule and would have to be
asked a second time to be sure.

**Keyframes, Chromium, in the CSSOM: what the keyframes say.** The `@keyframes materialise`
block's frames are read from `document.styleSheets` rather than parsed out of the text,
because the CSSOM distinguishes the case the requirement turns on **exactly**: a frame
declared with the token reads back `blur(var(--blur))` and a frame declared with a literal
reads back `blur(6px)`. A text scan would have to decide that difference with a pattern; the
browser makes it. Frames are selected by **offset** (`0%`, `100%`), which is what Chromium
reports — see D12 for why `from` and `to` are the wrong keys.

**Empirical, Chromium, in the page: what the page resolves.** Under
`prefers-reduced-motion: no-preference`, each of the three elements' resolved
`animation-name`, `animation-duration` and `animation-timing-function` are compared against
a **probe element** the spec injects, whose own declarations are written entirely in terms of
`var(--duration-*)` and `var(--ease-standard)`. Durations are compared as parsed seconds
because Chromium shortens the leading zero on the token and not on the computed value; the
easing is compared as a whole string against the probe, because that is spelling-independent
in a way a comparison against the token is not. Under `reduce`, every element in the
document is swept and none may report a running animation.

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

**Amendment, recorded during apply (2026-10-06).** This decision was correct and the
implementation violated it, which is the only kind of finding worth this much space.
`packages/mailbox/src/inbox.ts` publishes `{ kind: "checking" }` before **every** listing,
that variant carried no listing at all, and `Inbox.tsx` rendered it as its own branch — so
every poll unmounted the list and rebuilt it, and the rebuilt row re-ran its entrance.
Measured in Chromium on the built page with a `MutationObserver`:

```text
5153ms DOM -[UL.inbox-rows]
5153ms DOM +[P.]
5156ms DOM -[P.]
5156ms DOM +[UL.inbox-rows]
5187ms START materialise on inbox-row
```

The spec caught it on its first run, which is the strongest argument for the identity
observable: a screenshot or a text assertion would have shown a correct-looking inbox
several times a minute. D17 is the repair.

### D12. Three assumptions, measured before any assertion was written

**Measured 2026-10-06**, Chromium via `apps/web`'s Playwright config, against a throwaway
spec that injected a probe `<style>` into the built page and was deleted in the same task.
Every figure below is what the browser reported, not what it was expected to report.

1. **Duration serialisation — holds, and needs no normalisation function.** An
   `animation-duration` declared as `var(--duration-base)` resolves to `"0.2s"`. Reading
   `--duration-base` off the live document element resolves to `".2s"` — Chromium also
   shortens the *token's own* leading zero, so the two strings differ and a string comparison
   would fail on a page that is entirely correct. **The comparison therefore parses both as
   seconds and compares numbers**, which is total over both spellings and is one expression
   rather than a hand-rolled serialiser.
2. **Easing serialisation — does NOT hold. The probe fallback is in force.** The token reads
   `cubic-bezier(.16, 1, .3, 1)` while the element's computed `animation-timing-function`
   reads `cubic-bezier(0.16, 1, 0.3, 1)`. Same function, different spelling, so a string
   comparison would report a defect that does not exist. As D12 anticipated, the comparison
   is now made against a **probe element** the spec injects using `var(--ease-standard)`: the
   product's resolved timing function is compared to the probe's, and the probe is the
   declaration that uses the token. That tests the **linkage** rather than the spelling,
   which is the property the requirement is about, and it is immune to normalisation on
   either side.
3. **`prefers-reduced-motion` emulation — holds, without a reload.** After
   `page.emulateMedia({ reducedMotion: "reduce" })` on an already-loaded page, a probe
   element's `animation-name` went from `"probe-materialise"` to `"none"` and its
   `animation-duration` to `"0s"`, with the element still in the document and the URL
   unchanged. No reload, no navigation.

**Two further measurements, taken because the first probe returned something surprising and
a surprising result is not a fact until it is explained.**

- **The CSSOM *does* expose keyframe declarations faithfully, with `var()` intact** — and the
  first probe read an empty object. The cause was in the probe, not the browser: Chromium
  reports a keyframe's selector as `"0%"` and `"100%"`, never as the `from` and `to` this
  document had been written in terms of. Matching on `"from"` found nothing. This is the
  twenty-sixth recorded instance of a check narrower than the thing it read, and it was
  authored *and caught* inside this change, before any shipped assertion existed.
  The consequence is a design change rather than a spelling change: the keyframe half of D10
  is read from the **CSSOM**, keyed on offset, not parsed as text — and the CSSOM
  distinguishes the two cases exactly, reporting `blur(var(--blur))` for the token and
  `blur(6px)` for a literal. That is the distinction the requirement turns on, obtained
  without a text parse at all.
- **`AnimationEffect.getKeyframes()` does not carry `computedStyle` in this Chromium**, so
  the Web Animations API cannot be used to read a *resolved* keyframe value. Measured, and
  the route is therefore not used. The two frames it did return reported `offset: null` and
  `easing: "linear"`.
- **An element with no transition reports `transition-property: all` and
  `transition-duration: 0s`**, so a sweep asserting the second would pass on a page with no
  transitions whatsoever. D9 predicted exactly this and the measurement confirms it: the
  tripwire is real, and the requirement says nothing about transitions.

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

**Recorded during apply (2026-10-06): the new prose broke `pnpm format:check`, and only one
line of it.** The Motion prose above quotes the roadmap's own word as
`*"materialize/disappear"*`, and Prettier normalises asterisk emphasis to underscore emphasis.
So the emitter wrote a region that `pnpm format:check` rejected, while
`design-doc.test.ts` forbade hand-correcting the document the emitter had written — **two
gates disagreeing, which is only resolvable in the generator.** The emitter now writes
`_`…"_` and both are green: `prettier --check .` clean across the repository, and
`packages/ui`'s **38** tests pass with the region still byte-identical.

**This is worth recording as a shape rather than as an incident.** The slice's own byte-identity
test is what made the problem *visible* — without it, a `prettier --write` on the document would
have "fixed" the failure and left the generator emitting something no gate agreed with
afterwards. The alternative failure — loosening the byte-identity assertion so a formatter could
edit the document — would have removed the only instrument that notices a generator drifting from
its own output. **A generated artefact has two gates, not one, and the generator is where they
have to be reconciled.**

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

### D17. The inbox was torn down on every poll, and this slice is what found it

**Recorded during apply (2026-10-06).** Landing an entrance on `.inbox-row` made a
pre-existing defect impossible to ignore: the inbox list was destroyed and rebuilt on every
poll, so the entrance re-ran every five seconds for as long as the tab stayed open.

The cause spans two layers, and naming which is which is most of the value:

- **In the session**, `InboxState`'s `checking` variant carried no listing. It was the one
  variant that could leave a caller with nothing to show for the length of a request.
  `checkFailed` already kept the last known listing and `state.ts` gives the reason — *"a
  failed check is a condition of the inbox, not the loss of it"* — and that reason applies
  here with more force, because "is being checked" is a weaker reason to hide what is known
  than "the check failed". The two variants differed for no stated reason.
- **In the client**, `Inbox.tsx` rendered `checking` as its own branch, so a different
  subtree meant a different element tree, and a different element tree means an unmount.

**Why the session and not a client-side cache.** This was a genuine fork and it was put to
the user rather than decided silently. `Inbox.tsx` states that it is *"presentational and
nothing else"* and that *"every judgement about what is true belongs to the session"*. A
`useRef` holding the last non-`checking` state would have been a smaller diff — it keeps
the change inside `apps/web` and touches no shared contract — but it would make the list's
identity a fact the **presentation layer remembers**, duplicating what the session already
owns, and it would put a what-is-true judgement in the one layer that disclaims having one.
The cost of the chosen repair is that the change now spans two capabilities and adds a
requirement to `mailbox-session`. That is the cost, stated rather than absorbed.

**The client half is a tree-shape requirement, and that is the part that is easy to get
wrong.** `checked` and `checking` must produce the same elements at the same indices, with
the re-checking sentence **appended**:

```tsx
<InboxRows … />                              // index 0, in both states
<p data-testid="inbox-cadence-note">…</p>     // index 1, in both states
{inbox.kind === "checking" ? <p … /> : null} // appended, so it cannot shift the others
```

A sentence placed *before* the list would move the `<ul>` to a new index, and a node at a
new index is a node React rebuilds — which is the remount this decision exists to prevent.
So the placement is a correctness requirement, not a layout preference, and the assertion
that proves it is element identity rather than appearance (D11).

**Three assertions carry this, and each covers a layer that the others cannot:**

| Assertion | Layer | What only it can catch |
| --- | --- | --- |
| `packages/mailbox` — `checking` carries the previous messages *and* verdicts | session | A session that drops the listing, with a client that would render it correctly |
| `apps/web` — the row is the same DOM node across a held-open second check | client | A correct session whose client still rebuilds the list |
| `motion.spec.ts` — the marker survives a second listing in Chromium | built page | Both of the above, on what a user receives |

The `apps/web` assertion needs the second listing **held open**, and that is not
bookkeeping: a stub that resolves in the same microtask publishes `checking` and then
`checked` before React renders, so both updates batch into one render and the intermediate
state never reaches the DOM. A test asserting on `checking` without a gate would be
asserting on something else — the first version of it did, and passed.

**Two instances of this repository's recurring defect were authored here and caught here**,
and both are in the browser spec's CSS walker — the third and fourth recorded instances:

1. The prelude was carried in one variable and read when the block closed, by which time
   the block's own children had cleared it. Every rule came back with an empty selector, so
   the test failed reporting *no rules* rather than the wrong ones.
2. Fixed with a parallel stack, the *selector* was still read at close time — now it read
   the block's declarations instead of its prelude.
3. Fixed again, the selector was read **after** `flush()`, which empties `prelude` into the
   enclosing block. Top-level rules survived, because `flush()` is a no-op at depth zero, so
   this presented as "the media query's rule has no selector" rather than as "no rule has a
   selector" — and only a nested rule could reveal it.

Each one under-reported, which is the direction that invites deleting a check rather than
fixing it. The walker is now a stack of preludes captured at open time, and the test
asserts that **neither** filter came back empty, so a walker that loses its own nesting
fails loudly instead of reporting a clean sheet.

### D18. The identity assertion was reading the row before the defect existed, and holding the listing is the repair

**Recorded during apply (2026-10-06), by the falsification pass.** The browser test that
carries D11's claim — *"a row already on the page is not re-materialised by a later poll"* —
**passed on a build that rebuilt the row on every poll.** The mutation that exposed it is
D17's own defect reintroduced one element earlier: inserting the re-checking `<p>` *above*
`<InboxRows>` rather than after it, so the `<ul>` sits at a new index and React rebuilds
the row while a check is in flight.

The cause is a precondition, and it is the same shape as the two preconditions the focus
traversal already failed on:

- The test waited for the recorded handler to be **asked** for a second listing.
- `recorded-provider.ts` pushes the URL onto `served` **before** `route.fulfill` returns,
  so "asked" is true while the page has not yet been handed an answer.
- The page publishes `checking` when the request goes out and `checked` when it comes
  back. The defect exists only during `checking`.
- So the marker was read **before the fact**, and passed.

**This is the twenty-sixth recorded instance of this repository's recurring defect and the
third recorded *precondition*.** The other two were the focus traversal's settle wait and its
control-count wait, both caught by their own positive controls. The property is the same each
time: a precondition decides *when* to measure, so a weak one does not fail — it measures the
wrong moment and reports green.

**The repair is to *wait for that state* before reading the marker**, with a ceiling taken from
the cadence the session declares (D21). That alone is what makes the assertion true: measured
with the rebuild defect applied and the hold removed, the suite still catches it — **4 runs, 4
caught**. The first version of the repair was described here as though the hold were the
repair, and that was wrong.

**The hold is what makes the wait reliable, and that is a separate and smaller claim.** With
no hold, the page occasionally renders `checking` for long enough that the wait is satisfied
anyway and occasionally is not: removing the gate entirely is caught in **2 of 3** runs rather
than 3 of 3. So the hold buys the last third of a flaky read, and it is kept for that reason
and described as that, rather than credited with catching a defect it does not need to catch.
It required two changes to support code, both of which are worth stating because each is a
decision rather than a convenience:

- `RecordedProviderOptions.listingGate` became **a function of the one-based listing
  count** rather than a single promise. `storage.spec.ts` holds the *first* listing;
  `motion.spec.ts` holds the *second*. A single promise cannot hold one request while
  answering another, and a promise released all at once cannot hold one listing at all. The
  per-call shape is **the same one `apps/web/src/Inbox.test.tsx` already uses** through its
  `holdListing` stub gate — two tiers holding a listing open is one idea, and two spellings
  of it is the defect `open-mailbox.ts` exists to prevent.
- `deferred()` moved out of `storage.spec.ts` and into `recorded-provider.ts`, because two
  copies of "a promise I can release" is that same defect in its smallest dress.

**And the gate is self-policing, which is what makes it a precondition rather than a sleep.**
The test now *requires* the re-checking sentence to become visible before it reads the
marker. If the gate stopped working the wait times out and the test fails; it cannot fall
through to a reading taken at an arbitrary moment. Two mutations hold that property down, one
removing the gate and one holding the wrong listing — an off-by-one in each direction — and
both are caught by this test's own title.

### D19. `notStarted` and an empty `checking` render the same component on purpose, so no visible assertion can tell them apart

**Recorded during apply (2026-10-06), by the same falsification pass.** The mutation that
collapses `CheckingInbox` and `EmptyInbox` into one component — so a mailbox nobody has
looked at reports "no mail has arrived" — **is caught, but not by the test this change named
for it, and not every run.** Measured over five runs of `Inbox.test.tsx` with the mutation
applied: *`keeps the address on screen while the inbox is still being checked` failed in
five of five*, and *`says it is checking before any listing has completed` failed in four
of five*.

The reason is a decision, not a defect. `Inbox.tsx` returns `<CheckingInbox />` for
`notStarted` **and** for a `checking` with nothing learned, and the comment above it says
so: they are the same fact, so they say the same words. Both states therefore render the
identical element, `data-testid="inbox-checking"`, and **no assertion on what is on the
page can distinguish them** — the mutation is invisible until the render happens to land in
`checking` rather than `notStarted`.

Two consequences, and both are the point of recording this:

- **The mutation record names the catcher that never missed, first.** That is why M13's
  intended titles lead with *keeps the address on screen while the inbox is still being
  checked*. An attribution that names a test which catches the defect four times in five is
  an attribution that will one day report a green as a catch.
- **The named test is not wrong, only insufficient on its own.** It asserts the sentence and
  the two sentences it must not be, which is the requirement. Awaiting the element would not
  help: the element is present either way. Making the two states distinguishable *visibly*
  would contradict the design decision recorded above, so the honest repair is in the
  mutation record rather than in the suite.

### D20. The falsification harness read five test *files* as five tests

**Recorded during apply (2026-10-06).** The first harness counted with
`/(\d+)\s+passed/` matched anywhere in the output, and Vitest's summary prints
`Test Files  5 passed (5)` immediately above `Tests  114 passed (114)`. It therefore
reported **5** for every `apps/web` run, and would have reported 5 for every
`packages/ui` run — same file count, same wrong answer.

It did not manufacture a false green in the end, because the failed count was read with the
same pattern and a failing run prints its own summary. But it is the same defect this
repository keeps recording, **in the instrument rather than in the product**: a harness that
answers confidently and wrongly is worse than one that declines to answer. Counts are now
read off Vitest's own `Tests` line, and a run with no summary line is `harness-error`
rather than either verdict.

A second, smaller defect in the same function: `compileSignals` carried a `|nocompile`
alternative, so any output containing the word — including a harness log line — was read as
"the runner never collected a test". It is removed.

### D21. The repair in D18 was red in six of ten runs, and the fix is not a bigger number

**Recorded during apply (2026-10-06), by task 8.2's ten consecutive runs — which is the
only reason it was found.** D18's wait for the re-checking sentence used Playwright's
default 5-second timeout. Ten consecutive full-suite runs gave **4 green and 6 red**, every
red on that one line, every red with the same message: *the page entered a check in flight —
element(s) not found*.

The cause is the cadence, and it is arithmetic rather than a race in the ordinary sense. The
session backs off while nothing changes, and the **second** check is scheduled
`INBOX_POLL_PROMPT_MS` — **5 000ms** — after the first. That is exactly the default timeout,
so the wait and the poll were the same length and the outcome depended on which finished
first. **The four green runs were luck, not a property**, and a suite that is green four
times in ten has told us nothing.

**The fix is to size the wait from the number the product declares, not from a number chosen
to be large enough.** `INBOX_POLL_CEILING_MS` is imported from `packages/mailbox/src/cadence`
— by relative path into the source, following `recorded-provider.ts`, because this tier
resolves shared code that way and a bare package specifier would ask Playwright to compile
inside `node_modules`. It is the *ceiling* rather than the prompt value because the ceiling
is the one the session promises never to exceed, which makes exceeding it a failure instead
of a race. **Raising a timeout to a hand-picked number would have been the recorded defect
with a larger constant**: it would make the wait longer without making it meaningful, and it
would drift the first time the cadence changed.

**What this cost, and why it is worth more than the fix.** The defect was introduced *by the
repair* — the previous version of the test waited on `listingsServed(traffic)` with an
explicit 30-second ceiling, and replacing that poll with a web-first assertion silently
dropped the ceiling. A repair that removes the bound an earlier version had is a repair that
has to be re-measured from scratch, and the repo's own ten-run requirement existed for
exactly this.

**And it is the fourth recorded *precondition* in this repository**, after the focus
traversal's settle wait, its control-count wait, and D18's. All four decided *when* to
measure. **Three of the four were authored by the change that found them.** The shape to
carry forward is unchanged and is now better supported than when it was first written: a
precondition needs both a thing to wait for *and* a ceiling that means something.

**One mutation here is a mechanism rather than a defect, and it is recorded that way instead
of engineered into determinism.** Removing the hold entirely (M15) is caught in **2 of 3**
runs, and the one green is a fact rather than a mystery: with nothing held, the page
occasionally renders `checking` long enough for the wait to be satisfied anyway, and with no
other defect present the reading correctly passes. **A mutation that removes a mechanism is not
a defect the requirements forbid**, so a green there is not a missed requirement. **It is
therefore recorded as evidence about reliability and is not counted among the caught
mutations** — the same treatment this repository gives a branch no assertion can reach.
Counting it would report 16 of 16 and mean something weaker than 15 of 15 plus a measurement.

**The load-bearing question was asked directly rather than inferred from M15**, because the
obvious inference was wrong twice in one session. Applying the rebuild defect *and* removing
the hold together answers it: **4 runs, 4 caught**. The defect is caught without the hold, so
the hold is **not** load-bearing. **What catches it is waiting for the `checking` state**, and
the hold only makes that wait dependable. The first draft of D18 credited the hold with the
repair and a first draft of the experiment script printed its own conclusion with the branches
swapped; both were corrected against the measurement rather than kept because they were the
newer claim.

M16 — the hold applied to the *first* listing rather than the second, an off-by-one in the
other direction — is caught **3 of 3**, which shows the call number is what selects the listing
rather than that some gate is present.

### D22. What "no live provider" rests on, stated as a structure and not as a scan

**Recorded during apply (2026-10-06), answering task 8.3.** The claim is that no test in
either tier contacts a live provider, and that no test reaches any origin the recorded
handler has no response for. It is worth being precise about what carries it, because
"the suite never asked the internet" is the kind of sentence that reads as a measurement
and is actually an argument:

- **In the browser tier the answer is structural, and the structure is in
  `recorded-provider.ts`.** The handler installs `page.route("**/*", …)`, so it sees
  every request the page makes; it `continue()`s only the site's own origin — compared
  against `SITE_ORIGIN` from `playwright.config.ts`, not against `page.url()`, which is
  `about:blank` on the first document request — and **aborts every other origin,
  recording the URL**. There is no path from a page under test to a live provider that
  does not pass through that branch.
- **What each response *is* is a named import, not a restatement.** The three fixtures
  come from `packages/providers/src/fixtures` by name, which is also why no provider
  wire-format field appears anywhere under `apps/`.
- **In the unit tier there is no network at all.** Every test renders against a stub
  provider or drives a recording transport, and `packages/mail-parser`'s corpus test
  proves zero requests by observing an instrumented transport.

**The denied-origin record is reported rather than assumed empty, and the honest report
names how many tests read it.** Three tests assert it directly — two in
`storage.spec.ts`, one in `motion.spec.ts` (added by this slice, which brought its own
traffic handle and therefore its own assertion) — and each asserts
`expect(traffic.denied).toEqual([])`. **The other eighteen do not assert it, and this
slice did not add assertions to them.** That is not a gap in the claim: a denied request
is an aborted request, so the page under test receives no answer and the test asserting
what the page shows fails. The structural guarantee is the primary instrument and the
three direct reads are the ones that would name the origin rather than merely fail.

**What this does not establish, and it is the same list as everywhere else in this
change.** `use it externally` remains unverified, a stored mailbox has still never been
reconciled against a live Guerrilla Mail session, and **nothing here has watched a real
provider respond to being polled every five seconds.** A handler that answers from
recordings is precisely an instrument that cannot answer those questions.

## Risks / Trade-offs

- **A blur on text is a legibility cost for 120–200ms.** Accepted: the effect is the roadmap's
  own, the resting state is fully legible, and the reduced-motion path removes it entirely.
  Mitigation is D6 — the resting appearance is the final frame, so nothing is left mid-effect.
- **Motion the product chose, for mail the user did not.** `.inbox-row` animates because
  something arrived, which is user-caused, but it happens on a cadence the product chose.
  Mitigation is the third requirement and D11; it is the reason that requirement exists.
  **This was measured to be violated before D17 repaired it**, which is the strongest
  statement this risk list can carry: the requirement was not decorative, and the test that
  enforces it is the only thing that noticed.
- **The browser tier's size grew by nine cases on a cadence-driven page, and this slice's
  own repair was red in six of ten runs (D21).** Accepted with the measurement attached
  rather than smoothed over: the ten-run requirement is in task 8.2 precisely because a
  single green run reports no history, and the pre-existing ~1-in-3 focus flake is a
  standing cost of the tier rather than something this slice introduced. **What this slice
  did introduce was a fourth precondition, and it is recorded as one.**
- **The change now spans two capabilities** (`visual-system` and `mailbox-session`) and
  touches `packages/mailbox`, which slice 2 otherwise would not have. Accepted with the
  fork recorded in D17 and the user's decision attached; the alternative was a client-side
  cache that contradicted `Inbox.tsx`'s own stated contract. **A reader who disagrees now
  has the reasoning and the measurement**, which is the part that was missing when this was
  found.
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