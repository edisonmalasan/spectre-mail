# in-page-integration

## ADDED Requirements

### Requirement: The extension offers an address inside an email field, on focus and not otherwise

The extension SHALL declare a content script that recognises an email field, SHALL offer its
affordance when such a field takes focus, and SHALL NOT offer it anywhere else. A field SHALL be
recognised as an email field only from signals this requirement names — an `input` whose `type` is
`email`, whose `autocomplete` names an email, or whose `name` or `id` identifies one as an email
field — and no other element SHALL be offered an affordance.

The affordance SHALL be the only one on the page at any time: it SHALL belong to the field that has
focus, and it SHALL be removed when that field loses focus. At most one affordance SHALL exist, and
none SHALL exist while no email field holds focus, because a control permanently attached to every
email field on every page is the outcome the product's own UX rules forbid.

#### Scenario: An email field takes focus

- **WHEN** an empty email field on an ordinary page takes focus
- **AND** this device holds a stored mailbox
- **THEN** the extension SHALL offer its affordance for that field

#### Scenario: No field holds focus

- **WHEN** a page containing email fields is loaded and no field holds focus
- **THEN** the extension SHALL offer no affordance on that page

#### Scenario: Focus leaves the field

- **WHEN** the focused email field loses focus
- **THEN** the affordance for that field SHALL be removed
- **AND** no affordance SHALL remain on the page

#### Scenario: A second field takes focus

- **WHEN** an email field takes focus while another field's affordance is shown
- **THEN** the extension SHALL show an affordance for the newly focused field
- **AND** it SHALL show no affordance for the other field

#### Scenario: A field is not an email field

- **WHEN** an element that is not an input identifying itself as an email field takes focus
- **THEN** the extension SHALL offer no affordance for it

### Requirement: The affordance inserts the address this device already holds

When the affordance is activated on an email field, the extension SHALL insert the address of the
mailbox already stored on this device into that field, and SHALL read that address through the
shared storage contract rather than by interpreting stored records itself.

The extension SHALL NOT submit, press, or otherwise activate the form the field belongs to, and it
SHALL offer no affordance on a field that already holds text: a control that replaces what a user
has typed is a data-loss gesture, and refusing to appear is the answer that contains no ambiguity
about what was asked for.

#### Scenario: The affordance is activated on an empty field

- **WHEN** the affordance is activated on an empty email field
- **THEN** the field SHALL hold the address of the mailbox stored on this device

#### Scenario: The field already holds text

- **WHEN** an email field holds text and takes focus
- **THEN** the extension SHALL offer no affordance for that field

#### Scenario: The form is not activated

- **WHEN** the affordance has inserted an address
- **THEN** the extension SHALL NOT have submitted the form the field belongs to
- **AND** the extension SHALL NOT have pressed a control belonging to it

*One scenario's coverage is narrower than its wording, and the gap is measured rather than
assumed.* *The form is not activated* has two halves, and they are carried in different tiers for
a reason the browser tier cannot override. The **negative** half — no form was submitted — is held
by the unit tier, which can read a submit event because it owns the document. The browser tier
cannot falsify it: the affordance's `type="button"` is load-bearing **because** the control removes
itself from the document on press, so by the time activation behaviour would give it a form owner
**there is no form owner left to give it one**. So the in-page case asserts the requirement
**positively** instead, by planting a real submit button in the same form and requiring that *it*
fires when the control is pressed. **A case asserting an absence is trivially satisfied by a page
that refuses everything**, and that positive control is what makes this case capable of failing at
all.

### Requirement: The inserted address becomes the value the page's own state holds

The inserted address SHALL become the value the page's own code holds for that field, not only the
value the field paints. An input whose value is assigned without reaching its framework's state
renders as filled and submits as empty, so the address SHALL be inserted in a way a controlled
component observes, and the events the page's own input handling listens for SHALL be dispatched.

Which events are dispatched SHALL be stated rather than assumed, and both an `input` and a `change`
event SHALL be dispatched, because the frameworks that observe a controlled input and the libraries
that observe a plain one do not read the same event.

The requirement states this as the property it is — what the page's own code reads back — and
`design.md` D4 holds the mechanism, because a requirement naming one setter would fail any correct
implementation that used a different one.

#### Scenario: A controlled input receives the address

- **WHEN** the affordance inserts an address into an input whose value is held by its framework
- **THEN** the page's own code SHALL read back that address as the field's value

#### Scenario: A plain input receives the address

- **WHEN** the affordance inserts an address into an input with no framework holding its value
- **THEN** the field's own value SHALL be that address

#### Scenario: The page observes the insertion

- **WHEN** the affordance inserts an address
- **THEN** an `input` event SHALL reach the page
- **AND** a `change` event SHALL reach the page

### Requirement: The affordance is separate from the page it is injected into

The affordance SHALL be rendered so that the page's own styles do not determine how it appears, and
so that it is not part of the page's ordinary content. A page's cascade can hide, displace, or bury
an injected control for reasons that are not defects in this extension, and a control that reads as
page content is a control a page can mistake for its own.

These are two properties rather than one, and both SHALL hold: the page's document text SHALL NOT
grow the affordance's label, and no rule in the page's own stylesheets SHALL apply to the
affordance's elements.

#### Scenario: The page's own text is read

- **WHEN** the affordance is showing on a page
- **THEN** the page's own document text SHALL NOT contain the affordance's label

#### Scenario: The page's own styles are read

- **WHEN** a page's own stylesheet sets styles on every element it can reach
- **THEN** those rules SHALL NOT apply to the affordance's elements

### Requirement: The affordance offers no address this device does not hold

The affordance SHALL be offered only when this device holds a stored mailbox address to insert, and
SHALL NOT be offered when it holds none. A control whose only reachable answer is that there is not
an address yet is a control that cannot act, which this product does not ship.

This requirement records the **current** subject of the in-page surface, and the milestone that adds
creating a mailbox from a page SHALL amend it rather than finding a control already present and
leaving its empty case unaddressed.

*The second scenario below is an obligation on a later change rather than a behaviour this one
exhibits, and it is stated in full anyway.* **A requirement cannot be tested for what a future
change must do to it**, and a scenario asserting only today's behaviour would leave the empty case
free to be forgotten by the milestone that makes it reachable. **The spec records what is required
and the suite records what was observed**, and those are different claims — so the scenario is
stated, and no test claims it.

#### Scenario: This device holds no mailbox

- **WHEN** an email field takes focus and this device holds no stored mailbox
- **THEN** the extension SHALL offer no affordance for that field

#### Scenario: A milestone adds creating an address from a page

- **WHEN** a change adds the ability to create a mailbox from an email field
- **THEN** it SHALL amend this requirement rather than leaving the empty case unstated

### Requirement: The content script is one file the platform can load

The content script SHALL be emitted as a single self-contained script that the extension platform
loads without resolving any module specifier and without loading a second file. A content script
that imports a bare specifier, or that depends on a chunk, throws before its first line, and the
failure is invisible in every other gate.

#### Scenario: The emitted content script is inspected

- **WHEN** the built extension's content script is read
- **THEN** it SHALL contain no import of a module specifier
- **AND** it SHALL not depend on any second emitted file

### Requirement: The declared host reach is the reach the shipped surfaces use

The extension SHALL declare host reach that a shipped surface uses, and SHALL NOT declare host
reach beyond it: every host pattern declared for the content script SHALL be a pattern that
content script actually matches, and every pattern that content script matches SHALL be declared.
The reason this is a requirement rather than a review is that a broad content-script match pattern
and a broad host permission are both invisible in a diff that shows only their names, and a
permission no surface uses is the one a reviewer deletes rather than the one they question.

#### Scenario: The manifest and the content script are compared

- **WHEN** the manifest's declared host reach is compared with what the content script matches
- **THEN** neither SHALL name reach the other does not

#### Scenario: A host pattern is added

- **WHEN** a host pattern is declared that no shipped surface matches
- **THEN** the extension's browser suite SHALL fail
