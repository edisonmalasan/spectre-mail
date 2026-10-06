# Design

## Context

`apps/web` renders one `<main>` containing `<h1>`, a lead paragraph, then every session
variant's region, then `LocalData`, then the limits list. Slice 1 gave the page a token-backed
stylesheet with a single `--measure-page` column and one breakpoint; slice 2 gave it three
entrances on hooks that already existed.

The facts that shape the approach, all measured:

- **Roughly twenty assertions read a region by its accessible name** — `App.test.tsx` (875
  lines), `recovery.test.tsx` (983), `Inbox.test.tsx` (745). Seven `SessionState` variants,
  three `boot` values, two storage facts, four inbox states. Any rename or relocation is a
  simultaneous edit to twenty tests, and it reads as a regression.
- **Six literal values exist in `styles.css`** and are documented: `translateY(1px)`,
  `max-height: 28rem`, the single breakpoint `@media (max-width: 34rem)`,
  `grid-template-columns: 1fr auto`, `width: 100%`, `grid-template-columns: 1fr`. None is a
  colour, radius, spacing step, type size, or duration. A section's styles must not add a
  literal in those five categories.
- **The browser tier has 21 cases in 3 spec files** and every one of them finds a target by
  walking the live page. Adding sections changes the control set every walk sees — which is
  exactly the condition that made run `37446193779` red, when the control set grew mid-walk.
- **The repository has no `LICENSE` file** and `gh repo view` reports `licenseInfo: null`.

## Goals / Non-Goals

**Goals:**

- Four sections composed around the product, in a stated order, each with its own heading.
- Not one product accessible name changed.
- Every new declaration resolving to a token, with both scheme values declared.
- The `Extension preview` section **absent**, and that absence specified.

**Non-Goals:**

- **No product capability.** No new control, no new claim, no new state. This is composition.
- **No token-layer layout.** No `--grid-columns`, no breakpoint token (D4).
- **No licence claim, no `LICENSE` file.** Audited away (D3).
- **No mailbox-selection UI.** The pair is declared; nothing uses it (D7).
- **No appearance verification.** Nothing here can be asserted by reading a computed style, and
  this change does not pretend otherwise (D9).

## Decisions

### D1 — The product region is first, and the `Extension preview` section is absent

The roadmap lists *Live product hero* as section one and then says *"The product itself should
remain the main hero."* Those read as contradictory and are not: the resolution is that the
first region **is** the working product, given the page's first heading and its full width.

**Alternative rejected: a marketing hero above the product.** It satisfies the word "hero",
violates the sentence, and is the exact shape `AGENTS.md`'s design rules name first under
*Avoid* — giant centered hero copy with a badge and CTAs. Slice 1 already wrote a comment
saying the measure is *"not centred with a marketing hero's width"*; adding the hero would
contradict a decision slice 1 made and recorded.

**Alternative rejected: an `Extension preview` region marked not-yet-available.** `apps/
extension` is an empty placeholder with no manifest, so the preview would depict nothing. A
"coming soon" panel is also a claim the page cannot support — the same reasoning that makes
`website-client` require the *absence* of a provider selector to go undescribed. Absence,
specified.

### D2 — Sections are `App.tsx`'s children, and the composition is a map over data

Four new components, one `SECTIONS` array of `{ id, title, render }`, and `App.tsx` mapping it
after the product region. Each section renders `<section aria-labelledby>` with its own `<h2>`,
matching the nine regions already on the page.

**Alternative rejected: a `<Page>` layout component taking children.** It would put a
presentation concern in the middle of a file that is careful to say `Inbox.tsx` is
*"presentational and nothing else"* and every judgement belongs to the session. A data array
keeps the ordering **readable as an array**, which is what makes the stated order checkable at
all — a requirement naming an order is only enforced if the order is somewhere a reader can see.

### D3 — The footer carries the limits unchanged, and says nothing about licensing

The four limits bullets move verbatim from the mid-page region into the footer. The roadmap's
*open-source* item is **audited away**, and `docs/ROADMAP.md` records why.

**Alternative rejected: claim open source anyway.** No `LICENSE`, `licenseInfo: null`. A
public repository with no licence is not open source, and the page's whole posture is stating
only what is true. This is the deleted-storage-bullet failure: a claim that reads as a
guarantee.

**Alternative rejected: add a licence in this change.** Choosing a licence is the user's
decision and is not composition work. Offered as a separate question and declined here.

**Alternative rejected: state "public repository, no licence yet".** True at merge, and the
same stale-claim shape: it must be rewritten the day a licence lands, on a marketing page, by
whoever remembers.

### D4 — The section grid is written in `styles.css`, not in the token layer

`packages/ui` documents *"Not layout (that is a client's business — two clients lay out
differently)"*, and `AGENTS.md` records the qualification: `METRICS` holds `measure-page` and
`measure-prose`, which are line-length decisions and therefore layout decisions. What the layer
does not hold is a position, a grid, or a breakpoint.

So: a two-column arrangement for the steps and the reasons, written with
`grid-template-columns` in `styles.css`, reusing the page's **existing** breakpoint rather than
adding a second one. A `--grid-columns` token would be the thing that ends the layer's stated
scope, and it must not arrive in the same change that first wanted it.

### D5 — The brand mark is an inline SVG the product draws

"Subtle geometric branding" as a small drawn glyph beside the wordmark, carrying the accent.
Inline, no file, no `@font-face`, no image request.

**Alternative rejected: an SVG file in `public/`.** A same-origin request is not a *third-party*
origin, so `build-and-verification`'s no-third-party requirement would survive it — but the
browser suite's route handler **aborts and reports any origin it has no recorded response
for**, and a fetch the browser makes for an asset the page does not record is exactly the
failure that handler exists to catch. Inline has no request to record.

### D6 — The primary action is `Replace address`, and nothing else is dressed up

The direction names a "primary action". The website has no submit — it creates an address on
load — so the only control that moves a visitor forward is the one that replaces the address.
It takes a filled accent treatment. Every other control keeps the outline treatment it has.

**Alternative rejected: invent a submit.** A button that submits nothing, or a second "New
address" beside "Replace address" doing the same thing, is fake UI.

**Alternative rejected: make `LocalData`'s removal the primary action.** It is destructive, and
a destructive control wearing the product's most emphatic treatment is a design error
regardless of what the Accent block says.

**Alternative rejected: split the treatment into primary and secondary.** Offered to the user
as a real fork and declined — the page has one forward action, so a hierarchy between two
forward-looking controls would be invented.

### D7 — The selected-mailbox pair is declared, checked, and unused

The direction names "selected mailbox". The website renders one mailbox and offers no list; a
mailbox list is M8's popup and M11's side panel. So the pair is declared as tokens in both
schemes and checked by the existing `pairs.test.ts`, and **nothing on the page uses it yet**.
`docs/ROADMAP.md` records the deferral and where it lands.

**Alternative rejected: build a mailbox list to justify the token.** That is M11's subject,
delivered early, and would be a list of one item.

### D8 — Copy is drafted from the requirement it satisfies, and each sentence is checkable

The `Why SpectreMail` section's reasons are each traceable to something this repository holds:
no account needed (the product creates an address on load), the address is kept in this
browser and can be made to forget it (`spectre-storage`, and the removal control), no server
and no relay (an architecture rule), one provider reached from a browser (`provider-config.ts`).
The steps section names **Guerrilla Mail**, not "a mail service", and its third step is
*replace the address and forget it on this device* — **not** deleting a message, which the
product cannot do.

**This is why "Discard" needed narrowing.** The roadmap's word is `Discard`, and a reader
would take it as "delete the mail". The page must not claim a capability it lacks.

### D9 — What this change can and cannot verify, decided before the first test is written

**Verifiable, and asserted here:**

- the stated order — read from the DOM in the browser tier;
- every product accessible name **unchanged** — the existing ~20 assertions, which must stay
  green untouched, plus a count that a rename would move;
- every `var()` in the section stylesheet resolves — the existing `collectUnresolvedTokens`;
- no literal colour, radius, spacing step, type size, or duration — the same measurement
  slice 2 applied to three motion categories, extended to five;
- the new pairs' contrast in both schemes — `pairs.test.ts`, arithmetic, no browser;
- the accent's three surfaces resolve to the declared accent token — a computed style;
- **no request to any origin beyond the page's own** — the existing route handler, with
  `traffic.denied` asserted empty.

**Not verifiable, and named as such:** whether the composition **looks** right. No test in
this repository reads a rendered pixel's colour, and none reads a rendered pixel's position.
The strongest available checks are element order, computed styles, and contrast arithmetic —
three instruments that are silent about whether the result is good. **A human opening the page
is the only instrument for that, and it is recorded in the spec so a reader counting scenarios
does not read the gap as an oversight.**

### D10 — The browser suite's control-set precondition is the thing most at risk

Slice 1's repair waits for the control list to hold for five consecutive 100ms reads, because
a walk of Tab presses is long enough to fall inside the window where a control gains a layout
box. **Four sections add controls**, so that window is *wider* on this change than on the one
that needed the repair.

The wait is therefore a **precondition this change re-establishes rather than assumes**, and it
carries its own positive control — a control that gains a layout box after the walk begins must
fail the wait. A check that cannot fail for the reason it exists is not a check, and that is
this repository's most repeated finding.

### D11 — Section copy lives in one module, and every sentence is reviewable as copy

`apps/web/src/sections.ts` holds the reasons, the steps, and the footer's limits as data. Copy
in data rather than JSX means a claim can be read in one place and checked against what the
product does, without reading markup.

## Risks / Trade-offs

- **A rename slips through and ~20 tests are edited to match** → the count is recorded before
  and after (`App.test.tsx`, `recovery.test.tsx`, `Inbox.test.tsx` test totals), and any
  movement without a stated reason fails the change rather than being accepted as churn.
- **The browser suite's control-set walk goes red intermittently**, as it did on run
  `37446193779` → D10; the precondition and its positive control are part of this change's
  tasks, and ten consecutive local runs are required before the branch is offered for merge.
- **Section copy drifts into marketing claims** → D8, and the browser tier asserts that no
  region names a licence, a provider other than the measured one, or an unsupported figure.
- **A literal creeps into `styles.css`** → the five-category scan, in the browser tier against
  the **built** stylesheet, as slice 2 did for three motion categories.
- **The unused selected-mailbox pair reads as dead code** → it is a declared design decision
  with a recorded destination (M8/M11), not an orphan; a reader who objects can see D7.
- **The composition is judged by someone other than a machine and may be wrong** → unmitigable
  by design, and named rather than papered over.
---

## Amendments recorded during apply (2026-10-07)

**Every item here is a correction to a decision or a task above, written into this change
rather than added at sync.** A gap between an archived delta and a promoted spec means an
amendment was recorded in the wrong artifact, and this repository's own rule is that the
change is strengthened when verification strengthens it.

### A1 — D7 was scoped wrong, and measurement found it before any test did

D7 promised to *declare* the brand-mark and selected-mailbox pairs. **Measured, both already
existed.** `accent`/`surface-page` and `accent`/`surface-accent` are in `pairs.ts` from slice 1,
because a selected mailbox is a marked `accent` control on a `surface-accent` plate and the
brand mark is an `accent` shape on the page. Declaring them again would have been a second
copy of a pair that exists.

**What was genuinely new, and it was not in D7 at all:** **no ink in the palette reaches 4.5:1
on `--accent` in either scheme.** Measured with this package's own contrast function, not
asserted. So `--ink-on-accent` (`#ffffff` / `#0e0e11`) was declared and paired at `BODY_TEXT`.
D7's promise is narrowed to that, and its rejected alternative stands.

### A2 — the footer defect: a substitute platform hid it and the platform named it

**The first version of this change put the footer inside `<main>`.** `App.test.tsx` passed.
Testing Library maps `footer` to `contentinfo` unconditionally, so `getByRole("contentinfo")`
was green on a role **no user ever receives**.

Chromium, asked directly over CDP's `Accessibility.getFullAXTree`:

```text
roles: RootWebArea=1  main=1  sectionfooter=1  region=4
contentinfo landmarks exposed: 0
```

**Zero, while jsdom said one.** Repaired by making the footer a sibling of `<main>` (a fragment
wrapper in `App.tsx`), re-measured as `contentinfo=1  region=5`.

**This is the twenty-ninth instance in this repository of a substitute platform hiding a defect
that the real one names**, and the first one a change wrote *after* learning the lesson in
`website-client`. Two existing assertions had to move from `region` to `contentinfo` — recorded
here because a test moved for a reason that is not visible in the diff.

**`apps/web/e2e/sections.spec.ts` now reads Chromium's tree through CDP rather than a role
query, and carries the defect as its own negative control**: it plants the nesting into the
running page and requires **the same reader** to report the landmark gone. Without that, a reader
returning `contentinfo` for any page would pass every landmark assertion in the file.

### A3 — task 3.5 was wrong: `packages/ui`'s count does not rise

The task said the count "rises by exactly the new pair checks". **`pairs.test.ts` is
table-driven, so a new pair adds no test at all.** Measured: `packages/ui` is **38** before and
after, `apps/web` **114**, boundaries **51**, `pnpm test` **694** in 35 files — every total
identical to the baseline. All thirteen new tests are in the **browser** tier (21 → 34).

### A4 — an assertion this change wrote was a duplicate of one that already existed

A falsification mutation appeared to show `packages/ui` had no guard requiring every colour to
be accounted for. It did: *"accounts for every colour token between the three lists"*.

**The mutation that appeared to demonstrate the gap did not compile.** Deleting a pair entry
left a dangling `{`, Vitest reported `Failed Suites 2` above a line reading `Tests  18 passed`
with no failed-tests line anywhere, and the harness read that as **green** and filed it as a
survivor. **A mutation that cannot compile is not evidence about an assertion.** The duplicate
I wrote was deleted and `packages/ui` stayed at 38.

### A5 — task 6.5's "unchanged at six" was the wrong claim, and the scan's method matters

Measured over `styles.css` with comments stripped: **14 declarations / 15 literal tokens**, and
**zero** of them a colour, radius, spacing step, type size, or duration. This change added two
`grid-template-columns`, two `grid-row: auto`, and one `margin-inline: auto` — **all layout**.

**The task's own figure was not a safe baseline.** `AGENTS.md` records six, measured with a
pattern that did not strip multi-line comments; re-measured the same way, `120ms`, `0.01ms` and
`0s` appear in prose in `styles.css` and are not declarations. **A measurement that silently
measures more than the sentence beside it is the same defect as a check narrower than its
rule**, so the count is now reported with its method and the requirement is stated against the
five categories — which is what the requirement was ever about.

### A6 — three "survivors" were broken mutants, not weak assertions

Three of this change's mutations survived first and each was the harness's or the mutant's fault:

- **S03** first did not compile (a stray `</>`). Its second version compiled and reported green
  because it produced **two** `<PageFooter />` — one misplaced, one still correct, so
  `contentinfo` was legitimately still 1. **An edit that adds the defect without removing the
  correct code leaves a page that is not the defect at all.**
- **S11** first added the fill to a `:hover` rule, which the rest-state assertion correctly does
  not see. Its second version made it a rest-state rule selecting `.region--alert` — a class
  **`LocalData` does not render** — so it matched nothing.
- **S15** reworded a limit rather than removing it.

**A survivor means "the assertion did not catch this", never "the assertion is too weak", until
the mutant has been read and shown to be the thing it claims.**

### A7 — one real coverage gap, and the proxy that hid it

`"the brand mark is drawn by the page"` survived replacing the inline `<path>` with
`<image href="/mark.svg">`. Two reasons, both proxies:

- it asserted `page.locator("img").count() === 0`, and an `<image>` inside an `<svg>` is not
  an `<img>`;
- `recorded-provider.ts` `continue()`d the site's own origin without recording it, so a real
  same-origin request was invisible to `traffic.denied`.

**The assertion was a proxy for the thing it names.** Repaired on both sides: the mark must now
*be* an inline `<svg>` drawing with a `<path>` and containing no `<image>`/`<use>`, and
`ProviderTraffic` carries **every** URL the page requested whatever its origin, with the
assertion filtering by file extension so a **webfont** is caught too. Both halves were
falsified **separately** — the structural half removed, the request record still caught
`/mark.svg`.

### A8 — three class hooks removed rather than three rules invented

The existing boundary rule *"uses every class hook a client renders"* caught `product`,
`section--steps`, and `section--reasons`: hooks rendered with nothing in `styles.css` matching
them, two of them invented so two sibling sections would look symmetric in markup. **They were
deleted, not styled.** `data-region` is the hook those sections are identified by, and a hero
needs no rule of its own to be first on the page.

### A9 — D10's premise was measured false, and the control set does not change

D10 named the browser suite's control-set precondition as the thing most at risk, on the theory
that new sections add controls. **They add none.** The three new regions contain no interactive
element; the only control this change restyles is `Replace address`, which already existed.
`focus.spec.ts`'s walk and its settle precondition are therefore **unchanged**, and its six
cases kept their count.

### A10 — three instrument defects in the falsification harness

The harness reports outcomes, so its own defects have to be recorded with the same weight as
the code's. Six, in total across this change and slice 2's:

1. **`webServer.command` does not build**, so mutating the browser tier's subject and invoking
   Playwright directly served a **stale `dist/`.** Twenty of twenty-two mutations were reported
   as survivors when the tests had never seen the mutation. **A check pointed at a build that
   does not contain the defect looks exactly like twenty assertions that are too weak.**
2. **A failed build fell through into the Playwright run and was overwritten with `green`.**
   The detail line said *"the build failed, so the mutation never reached the browser"* while
   the tally said the mutation survived. **Evidence against it printed in the same breath as
   evidence for it** — the most dangerous shape an instrument defect can take.
3. **A bare argument to `playwright test` is a file filter, not a title filter**, so a title was
   read as a path and `expected: 0, unexpected: 0` read as green.
4. **The unit tier's failing "titles" were file paths.** `/FAIL\s+(\S+)/` captures the path and
   nothing else, so a `expect` naming a test *title* could never match and a working assertion
   was reported as a `wrongcatch`. Three expectations only ever matched because they named
   files. Now the whole line is captured and **every failing case is written into the record**
   so an attribution can be read rather than trusted.
5. **Restoring a source file is not restoring what the browser serves.** Restoration is
   SHA-verified per file and every file was genuinely restored — while `dist/` still contained
   the last mutation, built two seconds before the restore. **No SHA covers a build artefact**,
   and the state outlives the run. The loop now rebuilds at the end and reports a failed rebuild
   rather than exiting quietly.
6. **A transient Windows sharing violation on the restore write** left `pairs.ts` mutated in the
   working tree. Writes now retry, and a failed restoration is reported loudly rather than
   counted as a result.

**Final record: 22 of 22 caught by the intended assertion**, with `wrongcatch`, `green`,
`nocompile`, `noop` and `harness-error` all **zero**, restoration SHA-256 verified for every
mutated file, and `dist/` rebuilt from the restored source.

### A11 — the ten-run requirement, and what it is not

**Ten consecutive full browser-suite runs: 34 passed on each, zero failures.** Recorded because
a suite green four times in ten has told this repository nothing before — the twenty-eighth
instance. **What it does not establish:** that the suite is fast, that it is portable, or
anything about how the page looks.
