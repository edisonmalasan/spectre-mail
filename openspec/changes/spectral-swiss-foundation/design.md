# Design

Every decision below is stated with the alternative it beat and the reason. Where a
decision is a **measurement** rather than a preference it says so, and where a decision
**cannot** be verified by this change it says that too — including of itself.

---

## D1 — M7 is sliced, and this change is slice 1 and only slice 1

M7's own blocks name five separable things: a visual system, motion, the two accessibility
items, contrast/focus verification, and five website sections. That is more than one
milestone's worth of reviewable diff, and M5 and M6 were both sliced for the same reason.

**The split, and the order it is split in:**

| Slice | Subject | Why it is not in slice 1 |
|---|---|---|
| **1 — this change** | tokens, surfaces, typography, layout, accent, focus states, verification, CSS boundary rules | — |
| 2 — motion | materialize/disappear for new mailbox, incoming message, OTP appearance | needs something to animate |
| 3+ — website sections | the five blocks under *Website sections* | `Extension preview` is blocked on M8 |

**The ordering constraint is load-bearing, not tidiness.** Slice 1 ships **no animation**.
That is why slice 2 must carry `prefers-reduced-motion` **atomically with the motion it
governs**: an intermediate milestone containing animation with no opt-out would *introduce*
the problem `docs/ROADMAP.md` says M7 exists to solve — "shipping animation with no way to
opt out would introduce the problem rather than solve it." Splitting them would create
exactly that state. Keeping them whole is what makes the split safe.

---

## D2 — The token layer lives in `packages/ui`, not in `apps/web`

**Alternatives:** tokens in `apps/web/src/styles/tokens.css`; tokens in a root `styles/`;
tokens in `packages/ui` **as TypeScript objects** exported to a style injector.

**Chosen: `packages/ui`, as a `.css` file, consumed as an `exports` subpath.**

- The roadmap's approved design assigns design tokens to that package, and
  `packages/ui/src/index.ts` already says so: *"design tokens are applied from M7, not
  anticipated here."* The roadmap line the package's own doc comment cites is a **blocked**
  entry whose blocking reason is this milestone.
- `SHARED_PACKAGES` in `boundaries.test.ts` already contains `"ui"`, so the "shared packages
  never depend on the applications" rule already covers it. The package is not being
  invented here; it is being filled in.
- M8 is the second consumer. A palette in `apps/web` is moved the day `apps/extension`
  appears, and a moved palette is a diff nobody reviews.
- **Not TypeScript objects injected at runtime.** The tokens are static values, and a
  runtime injector would mean the rendered colour of a control exists only after JS has
  run — which makes the browser spec's job harder and the no-JS case unstyled. CSS custom
  properties resolve without script, and `color-scheme`/`prefers-color-scheme` handling is
  a few lines of CSS rather than a state machine in a provider-agnostic package.

**Cost, stated:** a `.css` `exports` subpath is a shape this workspace has not used before —
every `exports` entry points at `./src/index.ts`. `apps/web/tsconfig.json` must be able to
resolve it, and Vite must resolve it from a workspace member. If either fails, the fallback
is a relative import into `packages/ui/src/`, which works but forfeits the package boundary
and would be recorded as a decision rather than left implicit.

---

## D3 — No webfont, and this is a decision rather than a deferral

**This is the sharpest decision in the change, and it is measured on three axes.**

The roadmap names `Geist / Inter / similar grotesk` and `Geist Mono / JetBrains Mono /
IBM Plex Mono`. Naming a typeface is an invitation to `@import url("https://fonts.googleapis
.com/…")`, which is what that block of a design system usually turns into.

**Rejected, for three reasons that each stand alone:**

1. **It breaks a promoted requirement.** `build-and-verification` requires that a browser
   check *"SHALL contact no provider and no third-party origin."* The route handler in
   `apps/web/e2e/recorded-provider.ts` **denies every origin it has no recorded response
   for**, records the URL, and the suite asserts on that record. A font request would be
   denied and **all 6 specs would fail naming the font origin.** That is the property
   working, not a nuisance — but it means the milestone's most likely first draft breaks
   the repository's own gate, in a way that looks like an unrelated red suite.
2. **It breaks the product, independent of any test.** SpectreMail's page tells the user
   what is kept on their device and can be made to forget it. A page that fetches a font
   from a third-party origin on load hands that origin the visitor's IP address and
   User-Agent **before the visitor has done anything at all**, and no control on the page
   can prevent it. For this product specifically, that is a privacy defect in the product's
   own subject matter, and it would be shipped by a stylesheet.
3. **It adds a binary this milestone has not measured.** Committing WOFF2 files adds
   weight, a licence to track, and a build step for a font the design does not require.

**Chosen: a system grotesk stack and a system mono stack, declared as two tokens.**

The Swiss look is not a font file. It is the grid, the type scale, the weight contrast, the
tracking, and the whitespace — all of which slice 1 owns. Declaring the family **as a token**
means a later change can install Geist properly, self-hosted and preloaded, by editing two
lines. The seam exists on day one; the payload does not.

**Stated limit:** this establishes nothing about how SpectreMail looks with Geist. It
establishes that the tokens are the single place a family is named.

---

## D4 — `.css` joins `SOURCE_EXTENSIONS`, and every existing rule is re-proven

**Measured:** `SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]`. No `.css`.
Every directory-walking rule filters on it, so a stylesheet is invisible to all of them.

**Why extend the one list rather than add a CSS list:** this repository has recorded twice
that a *second spelling of a set* is the defect — the collection rule that resolved `apps/`
only, and the allowance constant two rules shared so widening one silenced the other. One
list, extended, has no second spelling.

**Why that is not sufficient on its own:** widening a scan is the recorded cause of a real
false positive here. `packages/providers` holds a recorded `set-cookie` response header from
the M0 spike, and when the storage rule was generalised from `packages/mailbox` to every
shared package it **immediately fired on that header** and read it as a cookie jar. CSS
files contain words those patterns match (`url(`, `--`, and, in a comment, anything at
all). So:

- **The obligation:** every existing rule is re-proven against the new extension with a
  deliberate violation, and the *absence* of a new false positive on the shipped
  stylesheets is asserted rather than assumed.
- **Comments are already stripped before matching**, which is why D6's rules read CSS with
  the same helper rather than a new one — a rule that cannot tell a declaration from a
  comment about that declaration is measuring the wrong thing. That lesson has been paid
  for twice in this file.

---

## D5 — Three new rules, all about CSS, each with its own limit stated

### D5a — No stylesheet reaches a third-party origin

Pattern: `@import` of an `http(s)` URL, and `url(http(s)://…)` anywhere in a shipped
stylesheet.

This is the mechanical form of D3 and the CSS analogue of the promoted no-network
requirement. Without it, D3 rests on a code review.

**Limit, stated in the rule:** it cannot see an asset loaded from **markup**. A
`<link href="https://fonts…">` in `index.html` is not a stylesheet, `index.html` is not a
`.tsx` file, and this rule is silent on it. So slice 1 also checks `index.html` — the one
markup file the page ships — for a remote `src`/`href`. **Both** are required; neither
covers the other.

### D5b — No stylesheet suppresses a focus indicator

Pattern: `outline: none`, `outline: 0`, `outline-width: 0`.

The roadmap says a focus indicator is *"never removed by a reset."* This is that sentence
as a gate.

**Limit, stated in the rule, and it is a real one:** `outline: 2px solid transparent`
defeats an indicator exactly as thoroughly as `outline: none` and **this rule does not
catch it**. The reason the browser spec is not optional is precisely this: only rendering
distinguishes a visible ring from a declared one. The rule catches the common accident; the
spec catches the class.

### D5c — Every `var(--x)` a stylesheet reads resolves to a declaration

Pattern: each `var(--name)` occurrence in any shipped stylesheet must have a matching
`--name:` declaration in the token layer **or** in the same file.

**Why:** an undeclared custom property makes `var()` compute to the property's initial
value at computed-value time. For a colour that means **the declaration silently does
nothing**. `--colour-accent` spelled with British spelling against a declared
`--color-accent` renders an element with no accent and **no error anywhere** — it builds,
it type checks, every test passes, and the defect is a pixel. A screenshot review catches it
only if someone is looking at that element on purpose.

**Limit:** it proves the property is *declared*, not that the declaration is *reachable*.
A token declared inside a selector that never matches is still declared.

---

## D6 — Contrast and focus are two claims, because they are two kinds of claim

The roadmap's note says both *"are properties of rendered pixels."* **That is true of focus
and false of contrast**, and treating them alike is the mistake the note invites.

| | Contrast | Focus visibility |
|---|---|---|
| What it actually is | arithmetic over two colours | a property of what the compositor draws |
| Instrument | `relativeLuminance()` / `contrastRatio()` — a pure function | `getComputedStyle` on a focused control in Chromium |
| Right tier | `packages/ui` unit test | `apps/web/e2e` Playwright spec |
| What it would be wrong in | jsdom: no layout, but also **no need** — jsdom is not the limitation | jsdom: **returns no resolved outline**, so a unit test there would assert on a declaration, not on a ring |

A contrast check in a browser would be theatre — the browser does not compute the ratio, the
test does; the browser only supplies the two colour strings. A focus check in jsdom would be
**a check that cannot fail for the reason it exists**, which this repository has already
learned is worse than no check at all.

**The browser spec's shape:** focus each interactive control by keyboard, read the resolved
outline, and require it to be present, non-zero, and distinguishable from the surrounding
surface. Driving it by **keyboard** rather than `.focus()` in script is deliberate: the
indicator that matters is the one a keyboard user gets.

---

## D7 — The `website-client` amendment is written into the delta now

`website-client`'s requirement *"This milestone builds structure, not visual design"* reads:

> - **THEN** it SHALL build and serve
> - **AND** the milestone SHALL NOT have introduced a design token or theme system

The second clause is false the day this change lands. **It is modified here, with the reason
attached**, rather than left to be discovered during sync.

The clause that survives is carried forward verbatim: *"none SHALL be conveyed by colour
alone."* It was already true — `InboxRow`'s `MARKING` record names each verdict in text —
and slice 1 makes it **hard to keep**, because the accent is about to appear on active
status. The accent must reinforce a word, never replace it. No verdict label is removed,
restyled into a dot, or made optional.

---

## D8 — Class hooks are added; no component is restructured

Slice 1 adds `className` to the existing elements and **changes nothing else**: no element
added, removed, or reordered, no accessible name altered, no `data-testid` touched.

- 113 unit tests and 6 browser specs read accessible names and `data-testid`. Structure is
  load-bearing for all of them, and structure buys nothing a stylesheet does not.
- The class hooks *are* the stylesheet's API. Keeping them in the markup means the
  stylesheet never needs a selector that reaches into structure it should not depend on,
  and the diff is reviewable as two halves: hooks, then rules that use only hooks.
- Recorded precedent for what happens otherwise: M5 slice 1 found a client test **silently
  skipped** by a glob. Markup churn is where a green suite stops meaning what it says.

---

## D9 — The five website sections are deferred, and one is blocked on M8

The roadmap lists five sections and says *"Keep marketing compact"* and *"The product itself
should remain the main hero."* Slice 1 ships none of them.

- **`Extension preview` is blocked on M8.** `apps/extension` is an empty placeholder and M8
  builds it. A preview of an extension that does not exist is, in `AGENTS.md`'s own words,
  *"fake product UI"* — and this project's rule against inventing capability claims is the
  same rule that has governed every provider statement since M0. It is recorded as
  **blocked**, not deferred, because its blocker is a milestone.
- **`Live product hero` needs no work here.** On this page the hero *is* the mailbox: the
  roadmap's sentence says the product remains the main hero, and it is the page's only real
  content. Slice 1 styles it; nothing is added to it.
- The footer (`Privacy/providers/open-source footer`) is the one block that could be built
  without claiming anything untrue, and it is eligible for a later M7 slice.

**No copy is written in this slice.** Marketing prose asserting things the product does not
do is the failure mode this repository has spent six milestones refusing.

---

## D10 — The two accessibility items are split, not bundled

M6's audit moved `visible focus states` and `reduced-motion handling` into M7. Slice 1
delivers **focus states**; it does **not** deliver reduced-motion.

A focus ring is a **static style**, and the roadmap already places `focus state` in the
Accent block. Reduced-motion governs **animation**, and slice 1 ships none — so a
`prefers-reduced-motion` block here would be a claim about behaviour that does not exist.
It arrives in slice 2 with the motion, per D1.

The result is that **no state of this repository ever contains animation without its
opt-out**, which is the property the roadmap cares about.

---

## D11 — `packages/ui` gains tokens, not components, and the reason is M8

The roadmap's package note lists buttons, mailbox card, provider badge, status dot, message
row, OTP component, and verification-link component as `packages/ui`'s. Slice 1 moves
**none** of them.

- It would be a six-component refactor across the files 113 tests assert on, inside a change
  whose subject is a colour palette. That is the "while I am here" work `AGENTS.md` forbids.
- **M8 is the first second consumer, and it is the change that can measure whether the
  extraction was right.** Moving components into a shared package before anything needs them
  shared risks freezing an API shape no second client ever agreed to. Tokens are different:
  a palette is shared by definition, and its interface is data rather than behaviour.

Recorded here so it reads as a decision with an owner, not as work quietly forgotten.

---

## D12 — What this change still does not establish

Written at proposal time, and **re-checked at apply** — a limit that is true at proposal and
false after implementation is a limit nobody recorded.

- **Nothing about how SpectreMail looks.** No test reads a pixel's colour. The palette is
  arithmetic and the focus ring is a computed style; **appearance** is still a human
  judgement, and this change does not automate it.
- **Nothing about Geist, or any named typeface.** D3 declines to install one.
- **Nothing about Firefox or WebKit.** One engine, on purpose, for the reason
  `browser-verification` recorded: adding a project per engine turns "verified" into
  "verified somewhere" without adding evidence.
- **`prefers-color-scheme` is honoured but not user-switchable.** There is no toggle; the
  scheme follows the system. A toggle is a control, and a control is a feature, and M7 slice 1
  is not a feature milestone.
- **No claim about a live provider.** Unchanged by this change, and worth restating because
  a milestone that adds a stylesheet is a good place to quietly forget it: `use it
  externally` and the live polling cadence remain unverified.
- **Nothing about `data-testid` being absent.** This was written into the apply stage's
  evidence notes by mistake — the client holds **67** of them and held them before. What is
  true, and verified mechanically rather than read, is that **no `data-testid` value and no
  `aria-labelledby` value was added, removed, or altered**. The false form of a claim is
  recorded here because it is the kind that reads as a security property and is not one.
- **Nothing about a failure state being identifiable with colour removed.** 3.1.5's
  requirement that no verdict, status, or error is distinguishable only by colour is
  satisfied by the **regions' own wording and structure**, and that wording is asserted by
  `apps/web`'s existing tests. No test renders the page with the colour removed and checks
  the words still carry it.

## D13 — Three amendments recorded during apply (2026-10-06)

This repository's rule is that an amendment is written into the change rather than added at
sync, so these live here and not in a changelog.

### D13a — The accent is used in five declarations, not exactly the six named surfaces

Task 3.1.4 said the accent appears on the roadmap's six surfaces and nowhere else. That is
**false against the file**, and it was found by counting `var(--accent)` and
`var(--ink-accent)` rather than by reading the stylesheet:

| Declaration | Surface | On the roadmap's list |
| --- | --- | --- |
| `.inbox-row--carries` `border-inline-start` | a row carrying a verification marking | yes — active status |
| `.inbox-row__verdict` `color` | the marking's own words | yes — active status |
| `.code` `color` + `border` | a detected one-time code | yes — verification codes |
| `:focus-visible` `outline` | every focusable control | yes — focus state, and `--focus` is the same hex as `--accent` in both schemes |
| **`.link__host` `color`** | **the host of a detected verification link** | **no** |

**Two of the six have no home on the page yet**: *primary action* (there is no
`.control--primary`, because no control on this page is a primary action) and *brand mark*
(the wordmark is set in `--ink-primary`). Both arrive with slice 3's sections. Neither is
stubbed: a primary button that does nothing yet is fake UI, and an accent-coloured wordmark
with no brand to mark is decoration.

`.link__host` is a **reading**, not compliance. `packages/mail-parser` returns verification
*links* as a first-class result beside codes, so the direction's "verification codes" is
read as covering the family; a reader who reads that item literally deletes this one
declaration. Recorded as a reading so that it can be disagreed with.

**`docs/ROADMAP.md`'s slice table was corrected to say this too**, because a slice table
claiming "the six named surfaces" is the same false claim one file over.

### D13b — The twenty-second instance of an assertion narrower than its rule, in this change's own code

Deleting the `:focus-visible` rule from `styles.css` left all five focus specs **green**. The
specs asserted an indicator was present and that `outlineStyle !== "none"`, and with the
product's own rule gone Chromium's user-agent stylesheet supplies `outline: auto`, which
satisfies both.

That is the defect class this repository has recorded twenty-one times, and it is the
**first time the change that introduced the check also caught it**. The specs now require
`expect.soft(focused.style).not.toBe("auto")` — so a ring the browser invented cannot
satisfy a claim about a ring this product drew — and the reasoning sits beside the assertion
rather than in a document nobody reads.

### D13c — The falsification harness produced two false greens, and both were repaired

Both are recorded because a harness that reports green on a mutation that never applied is
worse than no harness: it files a dead check as coverage.

- A `to` written as an **array of lines** was read as an array of separate edits. One
  mutation reported seventeen `noop`s and then a `green` — a mutation recorded as surviving
  because its own text had failed to apply. The three shapes of `to` are now told apart by
  element type.
- A **line-anchored** edit missed a fourth `.inbox-row` selector inside a `@media` block, so
  the tree was only partly mutated and the result was reported green. A missing edit site now
  records `noop` **and skips the run** rather than running a half-mutated tree.

Final: **25 of 25 caught by the intended assertion**, restoration verified by SHA-256 with
**0 mismatches**. `nocompile`, `green`, `wrongcatch`, `noop`, `harness-error`, and
`build-failed` are each their own outcome and none is ever reported as a pass.

A third defect is worth one line because it was not in the harness: the first check of
`data-testid` invariance was a PowerShell pipeline whose `git grep -o` pattern had its
`[^"]*` stripped before `git` saw it. Both sides came back empty, `Compare-Object` on two
empty lists is vacuously equal, and it printed `IDENTIAL` having compared nothing. The
check now counts and **refuses to compare two empty sets**.

## D14 — A CI run carrying this change's specs was red, and two claims about it were false

PR #63 ran `37439940701`: `verify` and `spike self-test` green, **`browser` failed**, 10 of 11
specs passing.

**First, the claims — because two of the three were false and the instrument that settled
both was a log query.** This repository carried the sentence that the `browser` job *"has
never run in CI; the job is committed unexecuted"*. It was **false before this change
began**: `gh run list` shows the job executing and **passing** in `37374154930`,
`37376921511`, `37377218976` and `37426170806`, the last on `main` on 2026-10-06, hours
before this branch. A first correction was then written into `AGENTS.md`, `README.md` and
the roadmap asserting the job *"ran in CI for the first time during this change"* — **also
false** — and it was retracted against the same run list.

**Why this is recorded rather than quietly fixed.** Both false claims were written in the
register this repository already distrusts: confident, specific, and about something a
reader would have no way to check without a log query. The narrower claim, *"the first run
carrying these specs was red"*, is the one that survives, and it is narrower because a log
query produced it. **A correction is not evidence**, and neither is the correction of a
correction.

**Then the defect.** The failing spec reported `names.some((name) =>
name.includes("Clear saved data"))` as `false`, while `names.length > 0` and
`names.some(… "Copy address")` both passed. It did **not reproduce** on the machine that
wrote it, across repeated runs at two workers.

**The defect was in the spec, and it was found by reading rather than by rerunning.**
`focusableNames()` enumerated the focusable set filtered by `getClientRects()`, while
`outlineAt()` and `focusIsAt()` indexed `document.querySelectorAll(selector)` **unfiltered**.
Any element matching the selector with no layout box shifted every later reading by one and
pushed the tail of the list off the end — which is exactly the observed signature: head
correct, tail missing, length non-zero. The fix is **one place that decides which elements
count**, handing out the index that reaches the element it counted, rather than two places
that could disagree.

### D14a — The repair was green three times before a mutation could catch it

This is the part worth keeping, and it is the **twenty-third** recorded instance of an
assertion that cannot fail.

1. With the split reintroduced as mutation **M27**, the suite passed. Nothing on the page as
   shipped is unrenderable, so the filtered position and the element index are identical and
   the two indexings cannot be told apart.
2. So the spec plants a `display: none` control — **after** the walk. Green: a probe added
   once the walk is over shifts nothing.
3. Planted by **appending** to `body`. Still green, and caught only by a *different* test
   that happened to plant its own probe earlier in the document — a `wrongcatch`, which is
   why the harness attributes a catch to the test it named.
4. Planted by **prepending**, so it precedes every real control. **Still green.** The
   enumeration's `name` was correct — it came from the same read — so every name-based
   assertion passed, while `outlineAt()` read a *different* element's outline. A wrong
   control's outline still looks focused or unfocused, so every indicator assertion passed
   too.

**What finally made it falsifiable was asserting the invariant that was actually violated.**
A reading's name is read from the element its outline was read from, so
`focus.unfocused.name === focus.name` holds **only** if the enumeration and the readers agree
about which element an index addresses. One assertion, and the mutation is caught by the
intended test.

**Two controls came out of this and both are now in the spec**: a control with no layout box
must be dropped by the filter, asserted **before** the walk so the two indexings genuinely
disagree during it; and a **renderable** added control must be named by `describeDrift`,
because `expect(drift).toEqual([])` is satisfied by a reporter that reports nothing.

### D14b — What this establishes, and what it does not

The `browser` job is **repeatable in CI** — it has run and passed on GitHub-hosted runners
since 2026-10-05 — and this change's specs met it **red**, in a spec `pnpm verify` had
already passed. That is the second time this repository has had a real instrument find
something a unit suite was green about, and the reason the browser tier is a separate runner
with its own CI job rather than a folder inside `pnpm test`.

**The repair is now verified in CI, and the run id is the claim.** It is mutation-falsified
(§2.3), the tier passes locally, and **run `37442961830` carried the repair and came back
green** on a GitHub-hosted Linux runner — `verify`, `spike self-test` and `browser` all
SUCCESS. It is stated as a run id rather than as "CI is green", because a claim about CI
that outruns a run is the exact failure this repository's `spike self-test` notes describe:
four cancelled jobs with **no log archive at all**, and the JSON the only instrument that
could tell a starved runner queue from a hang.

Four limits are unchanged and none of them is the one that just closed:

- **Nothing about a live provider.** Every response is a recorded one.
- **Nothing about another engine.** Chromium only, on purpose — and repeatability on one
  engine is not coverage of the others.
- **Nothing about a blocked `deleteDatabase`.** The suite does not produce that event.
- **Nothing about how the page looks.** The specs read a computed style; nothing reads a
  rendered pixel.
