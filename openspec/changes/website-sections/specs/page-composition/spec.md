# Spec Delta

## ADDED Requirements

### Requirement: The page is five regions in a stated order

A client SHALL divide its page into regions, each with its own heading, and SHALL render them
in one stated order. The working product SHALL be one of those regions rather than a hero
placed above them, because the roadmap's own line is that the product itself remains the main
hero. No region SHALL be added that has no heading of its own.

**Note, recorded during proposal (2026-10-06).** *"Five regions in a stated order"* and *"the
product is one of them"* are both load-bearing, and the second is the one a landing-page
instinct gets wrong. The approved direction and `AGENTS.md`'s design rules both forbid the
generic shape — a giant centered hero copy above a badge and two CTAs — and the roadmap
independently says the product should remain the main hero. A composition that puts a
marketing hero above a working address would satisfy the word "hero" and violate the
sentence.

The order is a requirement rather than an implementation detail because it is the only thing
that makes the page's hierarchy checkable. Two compositions with the same five regions in a
different order are different products.

#### Scenario: The page renders

- **WHEN** a client renders the product page
- **THEN** it SHALL render its regions in the stated order
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

**Note, recorded during proposal (2026-10-06).** The roadmap's five sections are: *Live product
hero*, *Generate → Receive → Discard*, *Why SpectreMail*, *Extension preview*, and *Privacy/
providers/open-source footer*. **Four are deliverable at this slice and one is not.**
`Extension preview` is slice 4's subject and slice 4 is **blocked on M8**: `apps/extension` is
an empty placeholder with no Manifest V3 manifest, so a preview of it is a picture of a
product that does not exist. It is absent, and that absence is a requirement rather than an
omission — a page carrying a "coming soon" panel for the extension would be a promise the
product has not made and cannot keep.

#### Scenario: The extension does not exist yet

- **WHEN** the page is composed
- **THEN** no region SHALL preview, describe, or represent the extension
- **AND** the page SHALL NOT describe that region's absence as missing or forthcoming

#### Scenario: A section has nothing true to say

- **WHEN** a named section's subject is not built
- **THEN** that region SHALL be absent
- **AND** no other region SHALL be added in its place