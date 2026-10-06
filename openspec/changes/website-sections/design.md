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