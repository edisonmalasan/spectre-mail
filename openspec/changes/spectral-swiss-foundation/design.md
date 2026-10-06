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

**The repair ran green in CI once, and that is all a green run is.** It is
mutation-falsified (§2.3), the tier passes locally, and **run `37442961830` carried the
repair and came back green** on a GitHub-hosted Linux runner — `verify`, `spike self-test` and
`browser` all SUCCESS. It is stated as a run id rather than as "CI is green", because a claim
about CI that outruns a run is the exact failure this repository's `spike self-test` notes
describe: four cancelled jobs with **no log archive at all**, and the JSON the only instrument
that could tell a starved runner queue from a hang.

**Corrected by D16.** That sentence read as though a green run verified the repair. A
subsequent run of the same suite on the same commit's successor — `37446193779` — was **red**,
on a defect the repair had not looked for, and it reproduces locally about **one run in three**.
So `37442961830` was green **once**, and the honest form of the claim is *"the repair reached a
green `browser` job"* rather than *"the repair is verified in CI"*. A passing run reports no
history, and **nothing in its own output could have said otherwise.**

Four limits are unchanged and none of them is the one that just closed:

- **Nothing about a live provider.** Every response is a recorded one.
- **Nothing about another engine.** Chromium only, on purpose — and repeatability on one
  engine is not coverage of the others.
- **Nothing about a blocked `deleteDatabase`.** The suite does not produce that event.
- **Nothing about how the page looks.** The specs read a computed style; nothing reads a
  rendered pixel.

---

## D15 � What the verification pass found, and the one that was not a document defect

**Recorded after the apply stage was merged, so these are findings against shipped code
rather than review notes.** The pass was run by a separate agent against `proposal.md`,
`design.md`, `tasks.md` and both deltas, and instructed not to treat a ticked box as
evidence. It returned one CRITICAL, five WARNINGs and a set of NOTEs. Every one is
resolved in this change; the shape of them is the reason they are recorded.

### D15a � The generated compliance table mislabelled every non-text pair

**The worst finding in the pass, and the one nothing would have caught by re-running
anything.** `LARGE_TEXT` and `NON_TEXT` are both WCAG `3:1`. They were exported as bare
numbers, so:

- `ContrastThreshold` was `typeof BODY_TEXT | typeof LARGE_TEXT | typeof NON_TEXT`, which is
  **`4.5 | 3 | 3`** � a union with one fewer member than it had names. Its doc comment called
  it *"a named union rather than a free number"*, which was the second false claim in the
  same file: it was not named, it was collapsed.
- `design-doc.ts` recovered a label by comparing values, in the order body, large, non-text.
  Because large is tested first and both are `3`, **every non-text pair in
  `docs/DESIGN_SYSTEM.md` was printed as `large text (3:1)`** � five focus-indicator rows and
  the `--accent`-on-tinted-surface row, plus `--line-strong` on every surface. The document
  asserted that focus indicators and control boundaries are held to the large-text standard.
  They are held to the non-text standard. The ratios printed beside the wrong label were
  correct.

**The suite was green throughout, and every test in it passed for a reason.** The
`ratio` assertions in `contrast.test.ts` pass identically on collapsed constants � `3` is
`3`. The pair-threshold test compares against the same constant the pair was declared with,
so a collapsed constant is self-consistent. The byte-identity test compares the renderer to
the committed document, and **both were wrong together**, so it agreed. That is three
independent-looking checks, none of which can distinguish *correct* from *consistently wrong*.

**The fix is that the standard carries its own name.**

```ts
export type ContrastStandard =
  | { readonly name: "body-text"; readonly ratio: 4.5 }
  | { readonly name: "large-text"; readonly ratio: 3 }
  | { readonly name: "non-text"; readonly ratio: 3 };
```

The union is discriminated on `name`, so the two 3:1 standards are distinguishable **by
construction**; the ratio is pinned to the name by the type, so a mislabelled threshold is a
compile error rather than a wrong cell; and `thresholdName` now prints what it was handed
rather than recovering a name by comparison. `meets()` takes the standard rather than its
ratio, so a caller cannot compare against a figure typed beside a name that means something
else.

**The assertion that would have caught it is the one that was missing**, and it is now in
`contrast.test.ts`: `expect(NON_TEXT.name).not.toBe(LARGE_TEXT.name)`, plus a check that the
rendered label is `"non-text (3:1)"`. It fails on the old constants � `.name` is `undefined`
on both. **Falsified**: reverting `thresholdName` to a value comparison turns the byte-identity
test red with `large text (3:1)` in the diff.

**Why it belongs in this change rather than a later one.** `docs/DESIGN_SYSTEM.md` is the
document a future client reads before styling, and the sync stage is about to promote
`visual-system` into `openspec/specs/` as the authority on colour. A promoted requirement
carrying a mislabelled compliance table is worse than no requirement: it is the sentence a
reader cites without re-deriving.

### D15b � The declared pair list omitted a surface the stylesheet paints

`styles.css` paints `--surface-danger` on `.region--alert` and `.notice--danger`. Four
`--focus` pairs were declared � against page, raised, sunken and accent � and none against
danger. The delta requirement holds **in fact**, because no focusable control sits on
`--surface-danger` today: `.control` paints its own opaque `--surface-raised`, so the ring
lands there. The declaration was incomplete rather than wrong.

It is now declared, with the reason attached rather than only the number: **no focusable
control sits on one today, and a surface the stylesheet can paint is a surface a future
control can end up on.** Measured `6.07` light and `6.24` dark. **Falsified**: raising the
threshold turns `pairs.test.ts` red naming the pair. No test count moved � the per-pair
assertions loop inside one fixed test, which is worth stating because a count that does not
move when a declaration grows is itself the thing to check.

### D15c � A false claim in `AGENTS.md` about the shipped stylesheet, twice

This file said **no literal value appears in `apps/web/src/styles.css`**, twice. Literals do
appear: `translateY(1px)`, `max-height: 28rem`, `1fr auto`, `width: 100%`, and
`@media (max-width: 34rem)`. The claim that is true and that the boundary rule enforces is
narrower � **not one colour, radius, spacing step, type size, or duration** � and
`styles.css`'s own header comment, `tasks.md` and `README.md` already said it correctly. So
the defect was two sentences in `AGENTS.md` claiming more than the code, on a property whose
whole value is that a reader can check it. Both are corrected, and the correction states the
literals rather than quietly dropping the word, because a reader who finds `28rem` and a file
that promised no literals will distrust every other sentence in it.

**The interesting part is why the overclaim survived review.** It is *easier* to read
"no literal" than the five categories, it is the sentence a design-system document wants to
say, and no test could refute it � a boundary rule for the five categories is satisfied by a
file that also contains `28rem`. **A check narrower than its rule is normally the defect; here
the check was right and the prose was the defect**, which is the shape worth remembering.

### D15d � Three evidence lines that described something other than what was measured

- **`tasks.md` 1.1.3 said "Four scale groups, and no fifth."** There are five; the fifth is
  `METRICS`, holding `measure-page` and `measure-prose`. An evidence line that undercounts its
  own artefact is how "no fifth" survives a change that added one.
- **`tasks.md` 1.2.1 said `packages/ui`'s `tsconfig.json` sets no `"DOM"`.** It sets
  `"DOM"`. This matters more than a stale count, because `packages/mailbox` withholds DOM by
  compiler and this repository treats that as the strong form of the property � so a reader
  would have believed this package had the same guarantee. **It does not**, and the corrected
  line says which form applies: `mailbox`'s is enforced by `tsc`, this one is evidenced by
  tests that would notice a browser being read.
- **`tasks.md` 4.2 said every changed line in `apps/web/src` is a `className` insertion.**
  Checked hunk by hunk against `53f5f2c`: twelve components are hook insertions only, but
  `main.tsx` adds two stylesheet imports, `InboxRow.tsx` adds the `CARRIES_VERIFICATION` set
  that keeps `carriesNothing` and `undetermined` unmarked, and `styles.css` is a new file.
  **None of the three adds, removes, or reorders an element, alters an accessible name, or
  touches a `data-testid`** � which is what 4.2 requires � but *"add nothing else"* is not
  *"changed nothing else"*, and the evidence line said the latter.

### D15e � A rule whose scope was narrower than it read, and the assertion that now holds it

`design-doc.test.ts` asserts the `.ts` extension on relative imports in three named files �
and its pattern matches `import � from` and **not** `export � from`. Four re-exports exist and
all four are in `index.ts`, which is correctly outside the emitter's run-time graph, so
nothing is unguarded today. But a rule a reader cannot place is a rule they will either
extend wrongly or ignore.

Rather than widen it � an assertion about a module no command resolves is decoration � the
scope is now **asserted**. A second test walks `packages/ui/src/` from the directory, and
fails if any module holding a relative re-export is inside the scanned set, or if any module
outside it imports relatively. **So a gap in the pattern becomes a red test instead of an
omission**, and a new file is covered by being created rather than by being listed.
**Falsified**: planting a relative `export � from` in the scanned `pairs.ts` turns it red
naming the file and the reason.

### D15f � What the pass found that was right

Its verdicts on 8.2 and 8.3 were **pass**: all nine D12 limits still hold, and every deferred
item has a named owner � slice 2 (motion with `prefers-reduced-motion`), slice 3 (the five
sections), M8 (the extension, and `Extension preview` recorded as blocked on it), M10 (OTP
copy/fill). The two accent surfaces with no home on the page yet are **recorded, not
stubbed**, which is the outcome 8.3 exists to distinguish from a placeholder.

**The one limit the pass could not test is unchanged and is restated rather than resolved:**
nothing here says how SpectreMail looks. Its largest finding was a mislabelled number in a
generated table, and it found that by reading code against artifacts. A number is a machine's
subject; whether a restrained column and a hairline rule read as *trustworthy* is not, and no
gate in this repository stands in for the judgement.

---

## D16 � A green CI run that was luck, and the precondition it was green by accident of

### D16a � What happened

The repair for run `37439940701` shipped in `592d03c` and **run `37442961830` came back
green** on all three jobs. This change recorded that as *"the fact this sentence waited
for"*, and it was **not a fact about the suite**. It was a fact about one run.

Run `37446193779`, carrying the verification-pass repair, was **red** again � and this time
the failure was the **drift reporter the repair itself added** doing exactly its job:

```text
position 1 was "Back to the inbox" (index 1), now "Open Message with no subject. �" (index 1)
position 2 was "Replace address"  (index 2), now "Back to the inbox"        (index 2)
position 3 was "Clear saved data"  (index 3), now "Replace address"        (index 3)
position 4 appeared: "Clear saved data"
```

**Read as a diff rather than as a failure, that is one element inserted above index 1** � the
inbox row gaining a layout box after the walk had already begun. It reproduces locally on
**roughly one run in three**, which is why `37442961830` passing was luck rather than a
property.

### D16b � What it is not

**It is not the product's control set being unstable.** Read eight times a second apart with
nothing touching it, the list is identical every time. The window is between the `ready` state
rendering and the inbox row being laid out, and a walk's worth of Tab presses is long enough
to fall inside it. Nothing in `apps/web` changed to cause this; the cause is a precondition
the spec asserted rather than established.

### D16c � The fix, and the part that matters more

`settledFocusableControls()` waits until the control list has **held for five consecutive
100ms reads** before the walk begins, and **throws** if it never does � reporting the list it
last saw. A bounded loop that returned its last read on timeout would leave every caller
believing the page had settled.

**The first version of that wait was wrong, and its own positive control caught it.** It
required two agreeing reads 100ms apart. The control plants a control that gains a layout box
**150ms** in, so the first two reads agree without it and a two-read wait returns a list that
does not contain it:

```text
Error: the wait returned before the late control appeared
1 failed | 5 passed
```

**That is the second time in this change that a precondition was narrower than the property
it stood for** � and like the traversal repair, it was authored here and caught here. The
lesson is the specific one: **two agreeing reads is not evidence of settledness, it is a delay
with a comparison in it.** The window has to be a duration chosen against the observed failure,
and the observed failure was seconds, not 200ms.

**And the honest limit, which is why the drift assertion was not weakened to compensate.** No
duration makes this certain � on a slower runner the row could appear after the window closes.
What the wait buys is that the common case is covered. What **guarantees** the reading is the
post-walk drift check, which is unchanged and still fails the spec if the set moved while it
was being read. **The two are not substitutes: one is a precondition, one is the property.**

**Measured after**: **10 consecutive local runs, 12 passed, 0 failed**, against roughly one in
three failing before.

### D16d � The falsification

**M29** replaces the agreement count with "return on the first comparison". Caught by the
intended assertion � *the wait returned before the late control appeared* � naming the
control it missed. **29 of 29** deliberate violations are now caught by the assertion written
for them.

### D16e � What a green run is, restated

`37442961830` was green and this document recorded it as the repair being verified. It was
**green once**, on a suite with an intermittent failure, and the record did not say so because
nothing in the run's output could say so � a passing run reports no history.

**The only instrument that could have caught it was re-running**, and the repository's own
rule already says a green CI run is not evidence of much: it is a claim about one execution. The
sentence this replaces, that the repair is *"verified in CI"*, is corrected below to name the
run **and** the fact that a subsequent run of the same suite on a slower machine was red.
