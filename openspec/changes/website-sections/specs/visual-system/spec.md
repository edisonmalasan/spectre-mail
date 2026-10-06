# Spec Delta

## ADDED Requirements

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

**The primary action is `Replace address`, and the reason is that it is the only forward
control on the page.** The direction names a "primary action"; the website has **no submit** —
it creates an address on load — so the one control that moves a visitor forward is the one
that replaces the address. Dressing a control as primary that is not the page's primary action
would be the fake-UI failure the design rules name, and inventing a submit button the product
does not need would be worse.

**"Selected mailbox" has no home on this page, and that is a recorded non-delivery rather
than an omission.** The website renders exactly one mailbox at a time and offers no list to
select from; a mailbox list is M8's popup and M11's side panel. So the third surface lands as
a **declared and contrast-checked pair that nothing on this page uses yet**, and
`docs/ROADMAP.md` records the deferral. Shipping an unused pair is honest; shipping a
fake selection UI to justify a token is not.

#### Scenario: A brand mark renders

- **WHEN** the page renders its brand mark
- **THEN** the mark SHALL carry the accent
- **AND** it SHALL be rendered by the product itself, with no request to any origin

#### Scenario: A primary action renders

- **WHEN** the page offers its forward control
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