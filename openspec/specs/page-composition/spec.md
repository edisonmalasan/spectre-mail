# page-composition Specification

## Purpose

Records what the page is *made of*, and which of those parts may be missing.

M7 slice 1 declared a token layer and slice 2 gave it motion, both of which constrain how
something looks. Neither constrains what is *on* the page or in what order — and composition is
where a page quietly goes wrong: a region nested inside another is not the region it was
called, a section that claims a capability the product lacks is a false statement in a place a
reader trusts, and a marketing region added for balance is the generic landing page the
approved direction forbids.

So the requirements here are about **which regions exist, what order they render in, and what a
section is allowed to say** — and they are deliberately not about appearance. No test in this
repository reads a rendered pixel, so nothing here claims to know whether any of it looks
right.

## Requirements

### Requirement: The page is five regions in a stated order

A client SHALL divide its page into **exactly five** regions, each with its own heading, and
SHALL render them in one stated order. The working product SHALL be one of those regions rather
than a hero placed above them, because the roadmap's own line is that the product itself remains
the main hero. No region SHALL be added that has no heading of its own, and no sixth region
SHALL be added.

**Note, recorded during proposal (2026-10-06).** _"Five regions in a stated order"_ and _"the
product is one of them"_ are both load-bearing, and the second is the one a landing-page
instinct gets wrong. The approved direction and `AGENTS.md`'s design rules both forbid the
generic shape — a giant centered hero copy above a badge and two CTAs — and the roadmap
independently says the product should remain the main hero. A composition that puts a
marketing hero above a working address would satisfy the word "hero" and violate the
sentence.

The order is a requirement rather than an implementation detail because it is the only thing
that makes the page's hierarchy checkable. Two compositions with the same five regions in a
different order are different products.

**Amendment, recorded during proposal (2026-10-07).** The count is now stated in the
requirement rather than only in its title. **The title has said "five" since `website-sections`
was promoted, while the page rendered four** — the fifth being `Extension preview`, held absent
by the next requirement. A count that lives only in a heading is a count nothing checks, and
this repository has recorded eleven instances of a check narrower than the rule it documents.
The count now lives in the same declared list the browser tier compares the built DOM against,
so the requirement and the DOM cannot disagree.

The amendment also closes the list. _"No region SHALL be added that has no heading of its own"_
permits a sixth well-headed region, and this page's whole discipline is that its sections come
from its approved direction rather than from a vacancy.

#### Scenario: The page renders

- **WHEN** a client renders the product page
- **THEN** it SHALL render its regions in the stated order
- **AND** it SHALL render exactly five of them
- **AND** every region SHALL be reachable by its own accessible name

#### Scenario: A region's heading is read

- **WHEN** a region's heading is inspected
- **THEN** it SHALL name what that region is for
- **AND** no region SHALL be announced by styling, position, or an unlabelled container

#### Scenario: A marketing hero is wanted

- **WHEN** the page is composed
- **THEN** no region above the working product SHALL exist solely to describe the product in
      words
- **AND** the product region SHALL be the first region a visitor meets

#### Scenario: A sixth region is wanted

- **WHEN** a composition would add a region beyond the five its approved direction names
- **THEN** the composition SHALL be refused rather than the region added
- **AND** no existing region SHALL be split to make room for it

### Requirement: A section states only what the product does

Every sentence a section states about SpectreMail SHALL correspond to something the product
does, and a section SHALL NOT claim a capability, a provider, a limit, or a licence the
repository does not hold. A section SHALL NOT describe absent work as missing or forthcoming,
and SHALL NOT name a figure the product cannot support.

**Note, recorded during proposal (2026-10-06).** This requirement is the direct consequence
of two measured decisions this change makes, and both would otherwise be invisible.

**The open-source footer is audited away.** The roadmap's fifth section is a
*Privacy/providers/open-source footer*. The repository carries **no `LICENSE` file** and
`gh repo view` reports **`licenseInfo: null`** — measured, 2026-10-06. A footer claiming the
project is open source would therefore be a claim the page cannot support, which is the same
class of wrong as the limits list's deleted storage bullet: a claim that reads as a
guarantee. The footer ships the privacy and provider facts, which are true, and says nothing
about licensing. `docs/ROADMAP.md` records the audit so a reader finds the reason rather than
the omission.

**The step sequence is real, and one word of it needed narrowing.** The roadmap's second
section is *Generate → Receive → Discard*. Generate and Receive are the product's behaviour.
"Discard" is **replace the address** and **forget it on this device** — both of which exist
as controls today — and **not** deleting a message, which the product cannot do and never
promised. A section that implied the third was deletion of mail would name a capability the
page does not have.

#### Scenario: A section makes a claim

- **WHEN** a section states something about the product
- **THEN** that statement SHALL correspond to behaviour the product has
- **AND** a visitor acting on it SHALL not be misled about what SpectreMail does

#### Scenario: A claim names a licence

- **WHEN** the page is composed
- **THEN** no region SHALL state that the project is open source, or name a licence
- **AND** the omission SHALL be recorded in the roadmap rather than left as a gap

#### Scenario: A claim names work that does not exist yet

- **WHEN** a capability is not built
- **THEN** no region SHALL describe it as missing or forthcoming
- **AND** no region SHALL carry a placeholder for it

#### Scenario: A claim names a figure

- **WHEN** a region states a number
- **THEN** that number SHALL be one the product can support
- **AND** it SHALL NOT be an interval, a rate, a count, or a comparison the product has not
      measured

### Requirement: The product's own regions are not marketing regions

The working product — the address, the inbox, the message view, and the local-data control —
SHALL keep its own regions and its own accessible names. Adding sections SHALL NOT move a
product region into a marketing one, SHALL NOT rename a product control, and SHALL NOT change
which session or storage state renders where.

**Note, recorded during proposal (2026-10-06).** The page has **seven** `SessionState`
variants, three `boot` values, two storage facts, and four inbox states, each rendering its own
heading and its own prose. That is roughly twenty assertions in `App.test.tsx`,
`recovery.test.tsx`, and `Inbox.test.tsx` that read a region by its accessible name. Composition work that
renamed or relocated one of those would break all of them — and the breakage would look like a
regression rather than a decision, which is why the rule is written as *unchanged* rather than
*unchanged in wording*.

The requirement is also a guard against the failure this repo keeps recording: a layout change
made "while here" that alters an accessible name and leaves every test still green because
each one looked for the new name it was just given.

#### Scenario: A product region renders

- **WHEN** a session, boot, storage, or inbox state renders
- **THEN** the region it renders SHALL keep its existing accessible name
- **AND** the control it offers SHALL keep its existing accessible name

#### Scenario: A section is added

- **WHEN** a new region is introduced around the product
- **THEN** no existing product region SHALL be renamed, moved into a marketing region, or
      dropped
- **AND** every state the product could reach SHALL remain reachable on the page

#### Scenario: A product control is restyled

- **WHEN** a control the product offers is given the accent or a different shape
- **THEN** its accessible name and its effect SHALL be unchanged
- **AND** it SHALL remain operable by keyboard

### Requirement: A section is composed of declared values and no others

Every colour, radius, spacing step, type size, measure, and duration a section uses SHALL be a
value the token layer declares. A section SHALL NOT introduce a layout primitive the token
layer does not declare — a column count, a breakpoint, or a position — and the page's grid and
breakpoint SHALL be written in the client rather than named as design tokens.

**Note, recorded during proposal (2026-10-06).** The last clause restates a boundary
`packages/ui`'s own documentation already records and this milestone already tests: **"no
layout" is qualified**, because `METRICS` holds `measure-page` and `measure-prose`, which are
line-length decisions and therefore layout decisions. What the token layer does not hold is any
position, grid, or breakpoint. Four sections need a multi-column arrangement, and the
qualification is stated here so that a `--grid-columns` token cannot arrive by being asked for
in the same change that needed it.

#### Scenario: A section is styled

- **WHEN** a shipped stylesheet styles a section
- **THEN** its colours, radii, spacing steps, type sizes, measures, and durations SHALL be
      references to declared tokens
- **AND** every `var()` it reads SHALL resolve

#### Scenario: A section needs a grid

- **WHEN** a section requires columns or a breakpoint
- **THEN** the arrangement SHALL be written in the client's own stylesheet
- **AND** the token layer SHALL NOT gain a token for it

### Requirement: The section set is not invented by this slice

The sections a client renders SHALL be the ones its approved direction names, and a section
whose subject does not exist SHALL be absent rather than represented. A client SHALL NOT add a
section to fill space, and SHALL NOT render a preview, sample, or illustration of something the
product has not built.

A section whose subject **is** built SHALL render it, and a section depicting another surface of
this product SHALL depict **only what that surface does**: it SHALL name no capability the
depicted surface lacks, and SHALL offer no control that acts on nothing.

**Note, recorded during proposal (2026-10-06).** The roadmap's five sections are: _Live product
hero_, _Generate → Receive → Discard_, _Why SpectreMail_, _Extension preview_, and _Privacy/
providers/open-source footer_. **Four are deliverable at this slice and one is not.**

**Amendment, recorded during proposal (2026-10-07).** M8 built `apps/extension`, and **the
sentences of that note which described the extension as an unbuilt placeholder, and slice 4 as
blocked on it, are deleted rather than reworded** — each became false when the manifest landed
and a reworded version would read as current state. The standing rule above the note is
unchanged, and it is why this is an amendment rather than a removal: a section whose subject
does not exist is still absent rather than represented, and a preview of something the product
has not built is still forbidden. What changed is that the extension **is** built, so _Extension
preview_ is now **required** rather than forbidden, and its absence would be the omission this
rule exists to prevent.

**The obligations this amendment adds are the ones a depiction of a real surface can fail, and
each is a defect this repository has already refused elsewhere.** A depiction naming a
capability its subject lacks is a page claiming the product does something it does not — the
same class as the deleted "no button anywhere deletes it" claim, and as the open-source footer
claim the repository cannot support. A depiction offering a control the depicted surface does
not offer is worse than a false name, because it is **actionable**: a preview containing a
`Copy address` button does nothing when pressed, which is precisely `extension-client`'s _"a
declared surface that renders nothing or acts on nothing is fake UI"_ and precisely the "a control
that cannot act" reasoning `website-client` applies to the absent provider selector.

#### Scenario: The extension does not exist yet

- **GIVEN** no Manifest V3 client exists in this repository
- **WHEN** the page is composed
- **THEN** no region SHALL preview, describe, or represent the extension
- **AND** the page SHALL NOT describe that region's absence as missing or forthcoming

**This scenario's title is retained and its condition made explicit rather than deleting it.** It
was written when the condition held unconditionally, and its two clauses are a correct rule for
any client whose extension is absent — which is the same reasoning that kept
`website-client`'s *"The provider selector is present"* scenario alive with a `WHEN` that never
holds. Its title is now a **given** rather than a description of the world, so the rule it states
is a forward constraint instead of a record of a past state, and a milestone that removes
`apps/extension` would have it enforced rather than silently contradicting a page that still
previews one.

#### Scenario: A section's subject is built

- **WHEN** the page is composed and a named section's subject exists in this repository
- **THEN** that region SHALL be rendered
- **AND** the composition SHALL NOT record its absence as an omission

#### Scenario: A section has nothing true to say

- **WHEN** a named section's subject is not built
- **THEN** that region SHALL be absent
- **AND** no other region SHALL be added in its place

#### Scenario: A section depicts another surface

- **WHEN** a section describes a surface this product does build
- **THEN** it SHALL name no capability that surface does not have
- **AND** every capability it names SHALL be one that surface is required to provide

#### Scenario: A depicted control would act on nothing

- **WHEN** a section depicts a control belonging to the surface it describes
- **THEN** the depiction SHALL render no interactive element
- **AND** the page SHALL offer the visitor nothing that appears operable and is not

### Requirement: A depicted surface's labels are the surface's own

A section depicting another surface of this product SHALL show only labels that surface renders,
and that correspondence SHALL be checked rather than reviewed. A label the depicted surface does
not render SHALL fail the build.

This requirement exists because the alternative is a picture that rots. A depiction maintained
by hand is correct on the day it is written and silently wrong after the next change to the
surface - and a wrong depiction is worse than none, because a visitor reading it learns
something false about a product that does exist.

**Amendment, recorded during apply (2026-10-07).** This requirement first read that a depicting
section *"SHALL derive its labels from that surface's own declared copy"*, and that wording
prescribed the mechanism rather than the guarantee. It does not, and prescribing it would have
been wrong: deriving by import means one client importing the other's source, and no shipped
source file in either client does that today. The requirement states the **property** - only
labels the surface renders, checked rather than reviewed - and leaves the mechanism to
`design.md`, which records the choice and the two failure directions it still catches. A
requirement naming an import would fail whenever a correct implementation found a different
route to the same guarantee, and would then be "fixed" by editing the requirement instead of the
code.

#### Scenario: The depicted surface's copy changes

- **GIVEN** a section showing labels from another surface's declared copy
- **WHEN** that surface renames or removes a label the section shows
- **THEN** the build SHALL fail
- **AND** the failure SHALL name the section and the label

#### Scenario: A label is added that the depicted surface does not render

- **WHEN** a section shows a label the depicted surface does not render
- **THEN** the build SHALL fail
- **AND** the failure SHALL report the label rather than the section's existence
