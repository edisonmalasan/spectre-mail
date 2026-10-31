# Spec Delta

## MODIFIED Requirements

### Requirement: The accent reaches a brand mark, a primary action, and a selected mailbox

The accent SHALL appear on three surfaces the direction names and that slice 1 deferred because
nothing on the page existed to carry them: a **brand mark**, a **primary action**, and a
**selected mailbox**. Each SHALL be declared as a token-backed pair, SHALL meet its declared
threshold in both colour schemes, and SHALL NOT be the only difference between a selected and
an unselected element.

**Note, recorded during proposal (2026-10-06).** Slice 1's own note records that it applied the
accent to *"the surfaces of the Accent block that exist on this page today"* and named these
three as deferred. Two of them are now decided by measurement of what the page actually
offers, and the decisions are recorded because the direction named the surfaces and not their
subjects.

**The brand mark is a drawn glyph, not an asset.** "Subtle geometric branding" with the accent,
inline SVG the product itself renders — because `build-and-verification` requires a browser
check to reach no third-party origin, and a brand mark delivered as a font, a file, or an
image request would break a promoted requirement and hand a third party the visitor's IP on
page load. The same reasoning `visual-system`'s *page loads no third-party asset* already
records for typefaces.

**The primary action is the control that completes the page's own job, and that is `Copy
address`. Amendment, recorded during proposal (2026-10-28), by `surface-hierarchy`.** This
paragraph previously fixed the subject as `Replace address`, on the reasoning that it was *"the
only forward control on the page"*. **That measures a control's direction and not its job.** The
page exists to hand a person an address; the control that completes that purpose is the one that
puts the address where the person needs it, and replacing the address abandons the purpose rather
than finishing it. Measured on the built page: `Replace address` carried the accent while `Copy
address` — the control the address requirement exists to offer — was a plain bordered one.

**`Replace address` does not disappear and does not become quiet enough to miss.** It keeps its
border and its position; what it loses is the claim to be the page's primary action. Dressing a
control as primary that is not the page's primary action is the fake-UI failure the design rules
name, and the earlier reading of *forward* is that same error reached from the other side.

**"Selected mailbox" now has a home, and the note that said it had none is why nothing asked.
Amendment, recorded during proposal (2026-10-28), by `surface-hierarchy`.** This paragraph
previously recorded the surface as absent — *"the website renders exactly one mailbox at a time
and offers no list to select from"* — and that was true when it was written. `mailbox-history`
(M13) then added *Addresses this browser remembers*, and it marks the mailbox the page is about
with `This is the address on this page.` in place of a control. **So the scenario went from
unsatisfiable to unmet, and the note is why nothing noticed: a note that says a scenario has no
home is a note that stops the scenario being asked.** The mark is carried today by text and by a
structural difference — the marked entry is the only one with no control — and by no accent. This
change puts the accent on it, so both halves of the scenario are satisfied.

#### Scenario: A brand mark renders

- **WHEN** the page renders its brand mark
- **THEN** the mark SHALL carry the accent
- **AND** it SHALL be rendered by the product itself, with no request to any origin

#### Scenario: A primary action renders

- **WHEN** the page offers the control that completes its own job
- **THEN** that control SHALL carry the accent
- **AND** its accessible name and its effect SHALL be unchanged by the treatment

#### Scenario: A mailbox is selected

- **WHEN** a client renders a mailbox the user has selected
- **THEN** the selection SHALL be carried by the accent
- **AND** it SHALL also be carried by text, a shape, or a structural difference
- **AND** the page SHALL NOT add a mailbox list to justify the surface

#### Scenario: A new pair is declared

- **WHEN** a colour pair is declared for any of these three surfaces
- **THEN** it SHALL meet its threshold in both colour schemes
- **AND** both scheme values SHALL be declared rather than derived from each other

## ADDED Requirements

### Requirement: A region's name is quieter than the data the region presents

A client SHALL name a region at a declared label step, and a datum the region exists to present
SHALL be set above that step. The label step SHALL be declared in the design record as a named type
role, SHALL be built from tokens the layer already declares, and SHALL differ from the data it
labels by more than colour alone. A stylesheet SHALL NOT apply a case transformation that changes a
region's accessible name.

**Note, recorded during proposal (2026-10-28), by `surface-hierarchy`.** The record declared eight
type roles and none of them was a region's name at a quiet size. `Headline` is *"a region's name …
a label on a working area"* — the record's own words — at 22 px, which is the size the website's
nine `h2` take and the reason nothing on that page is subordinate. **So the defect was a missing
role rather than a wrong number**, and the amendment adds the ninth role, `region-label`, built from
`type-xs`, `weight-medium`, `leading-normal` and `tracking-wide`.

**The step already existed on one client and was named nowhere.** `apps/extension/src/styles.css`
set `.popup h2, .panel h2` to a quiet label treatment that no role described and no requirement
named. **A treatment that exists on one client, is absent from the record, and is required nowhere
is the same defect as a token nobody reads**, and it is why the two clients could diverge.

**The case transformation the extension used is dropped, and the measurement is why.** Chromium
computes an accessible name from rendered text, so `text-transform: uppercase` renames whatever it
touches: measured on the built website with the label step injected, every `h2` came back from
`Accessibility.getFullAXTree` upper-cased while `textContent` stayed title-case. Every one of those
headings names a region, so the transformation would rename nine regions for assistive technology —
and the extension's existing treatment had already renamed five of its own, which nothing noticed
because that client's reader matches names case-insensitively. **The step is size, weight, leading,
tracking and colour, and it is still subordinate by four independent signals.**

#### Scenario: A region names itself quietly

- **WHEN** a client renders a named region
- **THEN** the region's name SHALL resolve to the declared label role
- **AND** it SHALL be smaller than the datum the region exists to present
- **AND** the difference SHALL NOT be carried by colour alone

#### Scenario: Two clients name a region

- **WHEN** the website and the extension each render a region's name
- **THEN** both SHALL resolve to the same declared values
- **AND** neither SHALL declare a value of its own for the step

#### Scenario: The address is the largest datum on its surface

- **WHEN** a surface shows a mailbox address
- **THEN** the address SHALL be the largest text that surface sets
- **AND** it SHALL be set at a step the layer declares for it rather than at a region's size

#### Scenario: A stylesheet would rename a region

- **WHEN** a client's stylesheet declares a case transformation on a region's name
- **THEN** the region's accessible name SHALL equal its text content
- **AND** no case transformation SHALL be applied to it
