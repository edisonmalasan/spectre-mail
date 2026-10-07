# Design

## Context

The page's regions are declared as data in `apps/web/src/sections.ts` (`PAGE_ORDER`,
`REGION_HOOKS`, `REASONS`, `STEPS`, `LIMITS`), rendered by one component per region, and
compared against the built DOM by the browser tier in `apps/web/e2e/sections.spec.ts`. Four
regions render today: `product`, `steps`, `reasons`, `footer`. The fifth the roadmap names,
`Extension preview`, is held absent by `page-composition` and asserted absent in two places in
`sections.spec.ts` (no `\bextension\b` in page text; no `mail.tm` in page text).

The thing to depict now exists. `apps/extension` is a Manifest V3 client whose popup
(`apps/extension/src/Popup.tsx`) renders three regions after a mailbox exists — address, provider
status, inbox — each with a heading and controls, over the shared mailbox session. Its copy is a
module-private `COPY` constant.

Three existing rules constrain what a depiction may be, and all three were written against a
different failure:

- `visual-system`'s _"the page loads no third-party asset"_ plus the browser tier's
  _"the brand mark is drawn by the page, and requests nothing to draw it"_ — the built page must
  fetch **no image and no font file at all**, asserted over every URL the page requested.
- `extension-client`'s _"a declared surface that renders nothing or acts on nothing is fake UI"_.
- `website-client`'s reasoning for the absent provider selector: a control over one reachable
  option cannot act, and offering it misreports the choice as available.

There is no distribution channel. No store listing, no release workflow, no signed artifact;
`pnpm build` emits an unpacked `dist`. As with the missing `LICENSE` file, that is a fact the
page cannot paper over.

## Goals / Non-Goals

**Goals:**

- Render the roadmap's fifth region in the position the roadmap gives it, between _Why
  SpectreMail_ and the footer.
- Make every sentence of it traceable to a promoted requirement, as `sections.ts` already
  requires of every other region.
- Make the depiction's labels **structurally** equal to the popup's, so drift fails the build.
- Leave `visual-system`, `website-client`, the provider layer, the session, storage, the token
  layer, and the extension's own behaviour untouched.

**Non-Goals:**

- Any distribution story. No download, no store link, no version, no install control.
- Describing M9's in-page insertion, M10's notifications and code workflow, or M11's side panel.
  Each is a requirement in `extension-client` that those surfaces are **absent**, and a page
  sentence about any of them would be the "coming soon" panel this repository has refused twice.
- A screenshot, a mock-up rendered by hand, or any depiction containing a control.

## Decisions

### D1 — The depiction is drawn from markup, and it fetches nothing

The preview renders the popup's regions as ordinary elements styled from the page's own tokens.

Rejected: a **screenshot**. It is the ordinary way to preview a UI and it is unavailable here —
the built page must request no image or font file, so shipping one means weakening an assertion
this change has no business weakening, and a raster of a UI nobody has run is a picture that is
wrong the moment the popup moves. Rejected: an **`.svg` file under `public/`**, for the reason
`sections.ts` already records for the brand mark — it is a same-origin request the tier's route
handler would have to be taught to record, and an asset fetch the page does not record is exactly
what that handler exists to catch.

### D2 — The depiction renders no interactive element, and says it is a depiction

No `<button>`, no `<a>`, no `<input>`, no `role="button"`, not even a disabled control.

This is the load-bearing decision, and it is stricter than it first looks. A **disabled** button
still announces as a button, still occupies the place a control occupies, and still tells a
visitor the popup has a control that does nothing — the exact defect M8 recorded when it removed
the popup's own provider selector. A `role="button"` on a `<div>` is the same lie with the
appearance of markup discipline. So the popup's controls appear as their **labels**, in text, in
a bordered `<figure>` whose `<figcaption>` names what the figure is.

The alternative — prose alone, no figure — was rejected because the roadmap asked for a preview
and a paragraph about an extension is not one. The alternative of handing the reader the real
popup is impossible: the popup needs a session and `chrome.storage`, and running it on the page
would mean shipping a second copy of the extension's runtime.

The figure is **not** `aria-hidden`. Its labels are content a visitor can read, and hiding text
that is visible to a sighted reader is an accessibility defect, not a fix.

### D3 — The depiction's labels are held against the popup's copy and checked, not imported

`Popup.tsx`'s `COPY` moves to an exported module, and `sections.ts` declares, **per depicted
label**, the popup copy key it must equal — `{ key: "copy", label: "Copy address" }`. A boundary
assertion resolves each key against the popup's exported copy and requires the two to be the same
string. Three failure modes are caught by that one rule, and each is reported by name: a renamed
label, a label turned into a function of the count, and a label that became a `{token}` template.

**Amendment, recorded during apply (2026-10-07). This decision originally said the website
_imports_ the entries, and that was wrong.** It assumed an import across the client boundary was
available and harmless. Both halves were checked, and neither holds:

- `apps/web/tsconfig.json` includes `src`, `e2e`, `vite.config.ts`, and
  `playwright.config.ts` — and nothing else, so a cross-client import would be the **first
  shipped-source dependency between the two clients** in this repository. The website's build
  would then fail wherever `apps/extension/src` is absent, which couples two deliverables that
  exist precisely to be independent.
- No shipped source file in either client imports across to the other today. The single
  cross-directory import is `apps/extension/src/provider-config.test.ts` reading `packages/` — a
  test reading a package, which is the sanctioned direction. **So this would not have been a
  repetition of an existing shape; it would have been the one that invented it.**

The inversion needs none of that, and it is **not a weaker check**. Both failure directions still
fail the build: a popup rename leaves the website's literal matching no popup value, and a website
that invents a label holds a value the popup does not render. What it costs is a duplicated
string under an enforced equality rather than one shared string, and what it buys is that the
website's build graph does not acquire the extension's source tree.

It also keeps the correspondence **named**, which the import does not: the rule can report that
the extension's `copy` is now `Copy the address` while the website's preview still shows
`Copy address`, which is the scenario's *failure SHALL name the section and the label*.

The website deliberately keeps only the **placeholder-free** entries. `reaching` is the one
template — `"Asking {provider} first"` is resolved against a live provider name before the popup
renders it, and a depiction printing the token would put `{provider}` on a marketing page — and
`count`/`checkFailed` are functions of the count with no string to show. All three are refused by
the same assertion, from the extension's own data rather than from a filter written here.

Rejected: **hand-written labels plus review.** This is the drift the requirement exists to stop —
a depiction assembled from strings the popup does not own is correct on the day it is written and
silently wrong after the next popup change. Rejected: **a shared package holding the popup's
copy.** It would be a fifth shared package owned by one client, and the popup's strings are that
client's UI, not a shared abstraction — `AGENTS.md`'s rule against speculative abstractions, with
the added cost that every shared package is a boundary every rule then has to know about.
Rejected: **a rule scanning `Popup.tsx`'s source text for each label.** It is the instrument this
repository has repeatedly caught being a proxy — an assertion narrower than the rule it
documents, and a rename that moved a string between two files would satisfy it while the popup
stopped rendering it.

### D4 — The preview names no provider

The extension reaches Mail.tm first and Guerrilla Mail behind it, and that is true. The preview
does not say so.

The reason is an existing guard rather than a preference. `sections.spec.ts` asserts the page
contains no `mail.tm`, and its comment gives the reason: _"the page reaches one, for the reason
`provider-config.ts` records, and a footer implying redundancy would be the loudest false claim
available."_ That guard is a good one and rescoping it to carve out a region would trade a
whole-page invariant for a paragraph that gains little: which provider answered is a resilience
detail, while what the popup _does_ — create, copy, name what answered, count what arrived — is
what a visitor is deciding about.

### D5 — The preview states the distribution limit, and offers no control

One present-tense sentence says the extension is built in this repository and that there is no
published download.

Rejected: a **download or store link.** There is nothing behind it, so it is the broken promise
`page-composition` already forbids for a licence, and a link that 404s is worse than no link.
Rejected: **saying nothing about distribution**, which was the earlier draft's position. A region
that previews an extension and says nothing about obtaining it reads as an oversight, and this
repository's own position is that an absence left undescribed is what gets filled in by whatever
change touches the file next. The sentence is present tense about a fact the repository holds — no
release workflow exists — and it names no milestone, so it is not absent work described as
missing.

### D6 — No token, no motion, no accent surface

The depiction uses the page's existing surfaces and the existing type scale. It introduces **no**
animation, because `visual-system` says motion is three materialisations and a fourth entrance
would have to amend that requirement for a static figure; it introduces **no** accent surface,
because `visual-system` names the three the Accent block requires and the figure is a
description of something else. `visual-system` is therefore untouched, and the browser tier's
existing literal sweeps over the built stylesheet cover the new rules for free.

The forced consequence: the boundary rule _"uses every class hook a client renders"_ means every
class the new component renders must have a rule in `styles.css`, or the build fails. That is
the rule working, not an obstacle.

### D7 — The two existing assertions are rescoped, and each keeps a negative control

`\bextension\b` and `mail.tm` do not go away; each becomes _"no region other than the preview
names this"_. A rescoped assertion that can no longer fail is worse than the one it replaces, so
each rescoped form is paired with a control that plants the forbidden word in a **different**
region and requires the reader to report it. The provider assertion is scoped by
`data-region`, which is the hook the region order is already read through.

### D8 — `Popup.tsx`'s copy moves to its own module

The export is what lets D3's assertion read the popup's real strings rather than scraping source.
It is a move, not a rewrite: `Popup.tsx` imports what it used to declare, and no string changes.
`apps/extension`'s test count is **required to stay at 20**, which is the evidence the move
changed nothing an existing assertion depends on — the same use M7 slice 1 made of `apps/web`'s
count.

## Risks / Trade-offs

- **[The figure can still read as fake UI to a visitor who does not read the caption]** → the
  figure carries a caption naming it as a description, the controls appear as text rather than as
  control-shaped elements, and the browser tier asserts the preview subtree contains **no**
  focusable element and no `button` or `link` role in Chromium's own accessibility tree. That
  last instrument is the one that caught `<footer>` inside `<main>` reading as no landmark, and it
  is the instrument this claim needs.
- **[D3's rule catches a renamed label only if the preview names it]** → the reverse direction is
  also a failure mode, and it is deliberately **not** asserted: the popup may gain a control the
  preview does not mention, because a description need not be exhaustive. That is a judgement, it
  is recorded here rather than dressed as coverage, and the *scenario* _"The popup gains a
  surface"_ puts the obligation on the change that adds it.
- **[The preview's prose will age]** → every sentence is data in `sections.ts` beside the
  `Basis:` note naming the requirement it rests on, which is the arrangement the other three
  regions already use and the one a reviewer reads top to bottom.
- **[Nothing here verifies how the section looks]** → unchanged and extended: no test in this
  repository reads a rendered pixel's colour or position, and the browser tier reads the DOM,
  Chromium's accessibility tree, and the served stylesheet. A human opening the page is the only
  instrument, and `tasks.md` leaves that unticked rather than claiming it.
- **[Rescoping two assertions is the shape most likely to produce a quiet weakening]** → each
  rescoped assertion ships with a negative control that must fire, and the falsification pass is
  required to demonstrate the control failing before the assertion is believed.

## The falsification record

**18 deliberate violations were run: 16 caught by the intended assertion, 2 recorded as evidence
and not counted, and 0 in `green`, `wrongcatch`, `noop`, `nocompile` or `harness-error` at the
end.** Restoration of every mutated file is SHA-256 verified, and `dist/` is rebuilt after every
restore and again at the end - a restored source file is not a restored build artefact, and the
artefact outlives the run.

The 16 that are counted:

| id  | what was broken                                                | caught by                                                       |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| S01 | a depicted label the popup does not render                      | the boundary rule, naming both values                           |
| S02 | a popup copy entry renamed on the website side                 | the boundary rule, by name                                       |
| S03 | an entry that is a function of its arguments                   | the boundary rule, naming the entry                              |
| S04 | an entry that became a `{token}` template                      | the boundary rule, naming the entry and the token               |
| U01 | the depiction renders a real `<button>`                        | _renders no interactive element, by markup_                      |
| U02 | a depicted label carries `role="button"`                       | _renders no interactive element, by role_                        |
| U03 | the component renders only each region's first label           | _renders every depicted label, and the label is what it prints_ |
| U04 | the figure has no caption                                      | _announces the depiction as a figure_                            |
| U05 | the depiction is concealed with `aria-hidden`                  | _announces the depiction as a figure_                            |
| U06 | the preview names a provider the website cannot reach          | _names no provider_                                              |
| B01 | a region other than the preview mentions the extension         | _only the preview region mentions the extension_                 |
| B02 | the preview names a second provider                            | _no region names a licence, and the page says which it reaches_ |
| B03 | a depicted label is not one the popup renders                  | _every label the built preview shows is one the popup renders_   |
| B04 | the depiction gains a control                                   | _no element inside the preview exposes an operable role_         |
| B05 | the preview names a declared-absent capability                 | _the preview names no capability the extension has absent_       |
| B06 | the preview states a polling interval                           | the same case, on its cadence assertion                         |

**The two that are not counted**, because the suite staying green is the correct result rather
than a gap:

- **E01 - the preview stops depicting one of the popup's labels entirely.** Nothing requires the
  preview to be exhaustive: the requirement is that every label it shows is one the popup renders.
  Adding a popup control and declining to depict it is permitted behaviour, and asserting otherwise
  would make every popup label a two-file change for no gain in honesty. The obligation on that
  case is `extension-client`'s scenario _"The popup gains a surface"_. **This is the risk recorded
  above, observed rather than assumed.**
- **E02 - a depicted label is declared against the wrong popup copy key.** The client suite stays
  green and the **boundary** suite goes red by name. That split is exactly what D3's amendment was
  written for: the website deliberately holds its own label strings, so nothing inside `apps/web`
  can see a correspondence that is wrong, and the assertion that owns it is the boundary rule's.
  It is here so the run does not record it as a survivor, and so a reader can see the client tier
  is silent **by design rather than by omission**.

**Five defects were in the harness before they were in the tests, and every one is a shape this
repository has recorded before.** They are worth the space because each produced a confidently
wrong answer rather than a loud failure:

1. **Playwright's `list` reporter marks a failure with `x`, not `not ok`.** The first run therefore
   reported five browser mutations as `wrongcatch` with an *empty* list of failing titles, while
   every one of them had been caught by the intended case. **A `wrongcatch` whose failing list is
   empty is the instrument's signature, not a test result** - and a red suite with no named failure
   is exactly what the recorded lesson says must be a distinct outcome rather than a pass.
2. **Vitest reports a failing title as `describe > it`**, so an exact match against the `it` title
   never matched and five unit mutations read as `wrongcatch` while naming the intended case in
   plain sight. The comparison is now a suffix match, and the failing titles are written into the
   record so an attribution can be read rather than trusted.
3. **A deletion could never be confirmed as having landed.** The landing check required a non-empty
   replacement string to be findable afterwards, so a mutation that *removes* text was filed
   `noop` - reported as never having run. **Two of the eighteen mutations were deletions and both
   were filed that way.** This is the `noop` class reproduced inside the instrument meant to detect
   it, and it is the sharpest instance of the pattern in this change: **a check that could not fail
   was reporting a result.**
4. **Two mutations were broken, and a broken mutant is not evidence.** `U01` replaced an `<li>`
   opening tag with `<button>` and left the `</li>` closing it, so the file did not compile and the
   outcome was `nocompile` - it never tested whether the non-interactive assertions fire on a
   control that *is* present. `B01` added an unrendered field to a data object, so the page's text
   never changed and the sweep correctly stayed green; it was testing nothing. Both were rebuilt as
   mutations that do what they claim, and the harness now supports multi-edit mutations for exactly
   this reason.
5. **The rescope could not be expressed as a change of regular expression.** A whole-page sweep has
   no way to exempt one region, which is what forced `regionTexts()` to exist. The exemption is a
   **named set of region hooks**, not a pattern: a check whose scope is a pattern is a check whose
   scope can be widened silently by the next person who finds the pattern inconvenient.

**One limit of the rescoping was found by running it rather than by reading it.** The `mail.tm`
sweep's negative control was needed for a reason that is not obvious from the assertion:
`Guerrilla Mail` is in the footer, and the word-bounded licence sweep above it passes over the
substring _mit_, so a sweep matched loosely would report regions it has no business reporting. The
control pins the opposite direction - the sweep must fire on the name it exists to catch - because
a rule that fires on the wrong thing is indistinguishable from a rule that does not fire at all.

**What the run does not establish.** No assertion here reads a rendered pixel's colour or
position, so every statement about this section is exact about what it measures and silent about
whether the result is good. `tasks.md` 6.1 is left unticked for that reason.

## The sync stage's own check, and the defect in it

The sync promoted four requirement blocks and re-checked each one **byte-for-byte** against its
delta rather than by title, because a hand-typed paraphrase keeps the heading and loses the text.
All four are identical; `page-composition` went **5 → 6** requirements and **14 → 20** scenarios,
`extension-client` **6 → 6** and **17 → 20**, and the suite total went **135 → 136** requirements
and **381 → 390** scenarios.

**The comparison was wrong on its first run, and it was wrong in the direction that produces a
false alarm.** Its block splitter ended a requirement at the next `### Requirement:` and at
nothing else, so a delta's `## ADDED Requirements` heading was swallowed into the block above it.
The promoted spec was correct throughout; the check reported `"The section set is not invented by
this slice"` as differing by two lines, and the two lines were the delta's own section heading.

**This is the third recorded instance of a defect in a harness being found by running the harness
rather than by reading it**, and it is the shape this repository keeps meeting in its
highest-value place: a measuring instrument that is *nearly* right produces a **confident wrong
answer**, and the two repairs this time — the splitter now stops at any `## ` heading, and the
delta parser that writes the promotion had been handling that heading correctly all along — mean
the two halves of the same operation disagreed. **A disagreement between two readers of one
artifact is worth more than either reader's verdict**, because it is the only evidence available
that at least one is wrong.

The checker was run from **outside the repository tree**, not deleted. That is the difference from
the four scripts deleted during apply, and it is deliberate: `pnpm lint` rejects `.cjs` in the
root on `@typescript-eslint/no-require-imports`, so a file left there would be something every
future lint has an opinion about — but the check has to be **re-runnable after the archive**,
because archiving is a move and a move is the operation most likely to quietly drop a file. A
one-shot instrument that cannot be re-run is worth less than the finding it produced.

## Migration Plan

None. No stored state, no schema, no data. The page's region list grows by one and every product
region keeps its accessible name.

## Open Questions

None that would change the specs, the approach, or the task breakdown.