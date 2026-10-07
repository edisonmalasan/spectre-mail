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

### D3 — The depiction's labels are imported from the popup's copy, and only the subset that can be depicted

`Popup.tsx`'s `COPY` moves to an exported module, and `sections.ts` imports the specific entries
it depicts. **It does not import the whole constant**, for a reason worth stating: `COPY` holds
function-valued entries (`count(n)`, `checkFailed(n)`) and one string carrying a substitution
token (`reaching: "Asking {provider} first"`). A depiction cannot render `"Asking {provider}
first"` — that is a template the popup resolves against a live provider name, and a preview
printing the token would be a broken string on a marketing page.

So the depicted entries are **declared by name** in `sections.ts`, and the boundary assertion
resolves each name against the popup's exported copy and requires the result to be a string
containing no `{` token. Three failure modes are therefore caught by one rule and reported by
name: a renamed label, a label turned into a function, and a label that became a template.

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

## Migration Plan

None. No stored state, no schema, no data. The page's region list grows by one and every product
region keeps its accessible name.

## Open Questions

None that would change the specs, the approach, or the task breakdown.