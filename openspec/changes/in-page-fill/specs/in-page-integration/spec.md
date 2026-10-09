# Spec Delta

Amends two of `in-page-integration`'s twelve requirements, renames a third, and adds four.

The rename is recorded rather than chosen: `MODIFIED` is matched against the promoted spec by exact
header text, so a broadened requirement under a new heading matches nothing and apply leaves the old
one behind. `openspec validate --strict` reports that as **information** while calling the delta
valid — the same shape `spectral-swiss-foundation` recorded — so the pair below is required for
correctness and not for validation.

The four additions are the in-page half of a code this product's website can already act on. They
are written as what is observable on the page rather than as how the delivery reaches it, because
`design.md` D1's measurement is about the platform and a requirement naming a platform API would
fail any correct implementation that used another.

## RENAMED Requirements

- FROM: `### Requirement: The inserted address becomes the value the page's own state holds`
- TO: `### Requirement: An inserted value becomes the value the page's own state holds`

**Recorded, because the reason the title changed is the reason the body changed.** The property is
one property — *what the page's own code reads back* — and this change gives it a second caller. A
title naming the address would have been false of the code the moment the code was inserted, which
is the same defect this capability already records once: a heading that lags its own body is
visible, and one that has quietly stopped applying is not.

## MODIFIED Requirements

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

**Amendment, recorded at proposal (2026-10-08), by `in-page-mailbox`.** The removal rule gains one
exception, and the exception is narrow on purpose. Creating a mailbox is a round trip that takes
longer than a person takes to tab to the next field, so a control removed the instant focus left
would take away the only place the answer could be reported — and the field it belongs to would be
one the user had already left. So while an answer this extension asked for is still outstanding the
affordance SHALL remain, and SHALL be removed once that answer arrives. **This does not make the
control persistent**: the exception lasts exactly as long as one outstanding request and no longer,
and nothing here permits a control to survive a settled request.

**Amendment, recorded at proposal (2026-10-10), by `in-page-fill`.** **This requirement governs the
*email* affordance, and a code delivered into a one-time-code field is not one.** The whole
requirement is scoped to a field that identifies itself as an email field, and a one-time-code field
does not; the focus rule, the one-affordance rule, and the removal rule are all about a control
drawn next to a field a person is typing an address into.

The amendment is recorded because the alternative reading is the dangerous one. *"At most one
affordance SHALL exist, and none SHALL exist while no email field holds focus"* read across the
whole page would forbid the thing this change adds, and a reader applying it that way would have to
choose between two requirements of this same capability. It does not read that way: the delivery
specified below happens on an explicit activation of a control in this extension's own popup, into
a field the page marks as a one-time-code field, and it leaves no control on the page at all.

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

#### Scenario: Focus leaves while an answer is outstanding

- **WHEN** the focused email field loses focus
- **AND** an answer to a request this extension made for that field is still outstanding
- **THEN** the affordance SHALL remain until that answer arrives
- **AND** it SHALL be removed once that answer has arrived

#### Scenario: A second field takes focus

- **WHEN** an email field takes focus while another field's affordance is shown
- **THEN** the extension SHALL show an affordance for the newly focused field
- **AND** it SHALL show no affordance for the other field
#### Scenario: Focus arrives elsewhere while an answer is outstanding

- **WHEN** an answer to a request this extension made is still outstanding
- **AND** focus arrives at any other element on the page
- **THEN** the extension SHALL leave the outstanding affordance in place
- **AND** it SHALL offer no affordance for the newly focused element

**Amendment, recorded during apply (2026-10-08), by in-page-mailbox.** This scenario was **not in
the proposal**, and the browser tier found the product doing the opposite on its first run. The
proposal's exception lived only in the *removal* rule, so tabbing away appeared to be handled - and
it is, until the arriving focus does something. **Focusing anything runs the same handler as
focusing the field the request was made for**, and every branch of it either removes the control or
builds a new one. So a person who pressed *Create* and then tabbed to the next input lost the only
place the answer could be reported, on every one of those paths.

**The second bullet is the half that is easy to leave out, and it is a claim about a control that
would not work.** While a request is outstanding this device holds no address — address is still
`null` — so any affordance built for the newly focused field would offer *creation*, and creating a
second time is refused while the first is out. The person would be shown a button whose only
reachable behaviour is to report a provider failure by doing nothing, which is the outcome this
same capability names as the reason to offer nothing at all. So while an answer is outstanding the
extension offers nothing new anywhere on the page.

**It is not a licence to persist.** Every path that settles a request clears it, including the one
that reports nothing, so the control cannot outlive a settled request - which is what the
requirement's own last sentence requires and what the scenario above already covers.

#### Scenario: A field is not an email field

- **WHEN** an element that is not an input identifying itself as an email field takes focus
- **THEN** the extension SHALL offer no affordance for it

#### Scenario: A page holds a one-time-code field and nothing is asked for

- **WHEN** a page holds a field identifying itself as a one-time-code field
- **AND** the user has not activated anything in this extension
- **THEN** the extension SHALL offer no affordance for that field
- **AND** it SHALL place nothing in that field

### Requirement: An inserted value becomes the value the page's own state holds

An inserted value SHALL become the value the page's own code holds for that field, not only the
value the field paints. An input whose value is assigned without reaching its framework's state
renders as filled and submits as empty, so the value SHALL be inserted in a way a controlled
component observes, and the events the page's own input handling listens for SHALL be dispatched.

Which events are dispatched SHALL be stated rather than assumed, and both an `input` and a `change`
event SHALL be dispatched, because the frameworks that observe a controlled input and the libraries
that observe a plain one do not read the same event.

The requirement states this as the property it is — what the page's own code reads back — and
`design.md` D4 holds the mechanism, because a requirement naming one setter would fail any correct
implementation that used a different one.

**The address and the code are one property with two callers, and this requirement is where that is
said.** It was written for the address and its title named the address; this change inserts a second
kind of value through the same mechanism, so the property is restated over *any value this extension
inserts* rather than a second requirement restating it for codes. Two requirements claiming one
mechanism is how the two drift apart.

**The two address scenarios keep their original titles, and the reason is a validator behaviour worth
recording rather than a preference.** `openspec validate --strict` refuses a `MODIFIED` block that
**omits a scenario the current spec still has, matched by title** — so renaming *"A controlled input
receives the address"* to *"…receives an inserted value"* is reported as dropping it, even though
the requirement it sits in was itself renamed in this same delta and the rename is declared
directly above. The first draft generalised those two titles and `validate` exited `1` on it.

So the address keeps its scenarios and the code gets **its own two**, rather than one generic pair.
That is the better outcome anyway and not only the permitted one: the property is one property, and
the cases that hold it down are the ones that reach it through each caller's own path — a case
asserting the address path says nothing about whether the code path was wired to it at all, which is
the way a shared mechanism becomes two mechanisms without anybody noticing.

#### Scenario: A controlled input receives the address

- **WHEN** the affordance inserts an address into an input whose value is held by its framework
- **THEN** the page's own code SHALL read back that address as the field's value

#### Scenario: A plain input receives the address

- **WHEN** the affordance inserts an address into an input with no framework holding its value
- **THEN** the field's own value SHALL be that address

#### Scenario: The page observes the insertion

- **WHEN** this extension inserts a value
- **THEN** an `input` event SHALL reach the page
- **AND** a `change` event SHALL reach the page

#### Scenario: A controlled input receives a code

- **WHEN** this extension puts a one-time code into an input whose value is held by its framework
- **THEN** the page's own code SHALL read back that code as the field's value

#### Scenario: A plain input receives a code

- **WHEN** this extension puts a one-time code into an input with no framework holding its value
- **THEN** the field's own value SHALL be that code

## ADDED Requirements

### Requirement: A one-time-code field is recognised only from signals this capability names

A field SHALL be recognised as a one-time-code field only from signals this requirement names, and
no other element SHALL be treated as one. The signals SHALL be: an `input` whose `autocomplete`
declares a one-time code; an `input` whose `name` or `id` identifies one as a code, verification,
or one-time-password field; and an `input` whose `inputmode` declares a numeric entry **together
with** such a name or id.

**The numeric `inputmode` alone SHALL NOT be sufficient**, and that restriction is the load-bearing
half. A numeric keypad is what a page asks for on a quantity, a price, a card number, a telephone
number and a postcode, so a field carrying only that signal is a field this extension must leave
alone: filling a discount code into a quantity box is a data-entry error with a visible result and
no way for the person to notice before submitting.

Where more than one signal applies to a field, the field that **declares** a one-time code through
`autocomplete` SHALL be preferred over one that is only inferred from its name, because a page that
states the purpose of a field is telling the truth about it in the one way a machine can read.

#### Scenario: A field declares a one-time code

- **WHEN** a page holds an empty input whose `autocomplete` declares a one-time code
- **THEN** the extension SHALL recognise that input as a one-time-code field

#### Scenario: A field is named as a code

- **WHEN** a page holds an empty input whose `name` or `id` identifies it as a code, verification,
      or one-time-password field
- **THEN** the extension SHALL recognise that input as a one-time-code field

#### Scenario: A numeric field is named as nothing

- **WHEN** a page holds an input that requests numeric entry and whose `name` and `id` identify it
      as no kind of code
- **THEN** the extension SHALL NOT recognise that input as a one-time-code field

#### Scenario: A field is not an input

- **WHEN** an element that is not an input identifies itself as a one-time-code field
- **THEN** the extension SHALL NOT treat it as one

#### Scenario: Two fields qualify and one declares itself

- **WHEN** two inputs qualify as one-time-code fields
- **AND** one of them declares a one-time code through `autocomplete`
- **THEN** the declared one SHALL be preferred over the one identified only by name or id

### Requirement: A code reaches a page only on the user's activation, and never the form

A one-time code SHALL be put into a page's field **only** when the user activates a control naming
that code, and no field SHALL be filled at any other time — not when the page loads, not when the
field takes focus, not when a message arrives, and not when this extension notices anything. A
field that acquires a value nobody asked for is a form submitted with a code the person never read.

The extension SHALL NOT submit the form the field belongs to, SHALL NOT press a control belonging to
it, and SHALL NOT activate it by any other means. **Filling a field and submitting it are different
acts with different consequences**, and the second one commits the person to a stranger's account
with a value this extension chose.

**Nothing SHALL be filled into a field that already holds text**, for the reason this capability
already gives for the address: a control that replaces what a user has typed is a data-loss gesture,
and refusing is the answer that contains no ambiguity about what was asked for.

#### Scenario: Nothing has been activated

- **WHEN** a page holds a one-time-code field and the user activates nothing in this extension
- **THEN** the field SHALL be left as the page delivered it

#### Scenario: A message arrives while the page is open

- **WHEN** a page is open and this extension learns of a message carrying a code
- **THEN** no one-time-code field on that page SHALL be filled

#### Scenario: The user activates a code

- **WHEN** the user activates the control for a code the popup named
- **THEN** the one-time-code field on the page SHALL hold that code

#### Scenario: The form is not activated

- **WHEN** this extension has put a code into a field
- **THEN** it SHALL NOT have submitted the form the field belongs to
- **AND** it SHALL NOT have pressed a control belonging to it

#### Scenario: The field already holds text

- **WHEN** a code is sent to a page and the field it would fill already holds text
- **THEN** the extension SHALL insert nothing into that field

### Requirement: Several qualifying fields are put to the user rather than chosen

Where more than one field on a page qualifies as a one-time-code field and the extension cannot
prefer one by the signals this capability names, the extension SHALL ask the person which field to
fill and SHALL NOT choose one. **A page with several qualifying fields is a page whose author
expected more than one**, and a page that splits a code across two boxes is a page where the wrong
one is a wrong answer rather than a near miss.

Asking SHALL be done in this extension's own surface on the page, and the options put to the person
SHALL be the fields themselves rather than a count or a guess at an index. **No field SHALL be
filled until the person has chosen**, because the asking is not a confirmation step after a decision
has already been taken.

#### Scenario: Exactly one field qualifies

- **WHEN** a page holds exactly one field recognised as a one-time-code field
- **THEN** the extension SHALL put the code into that field without asking which field to use

#### Scenario: Several fields qualify

- **WHEN** a page holds more than one field recognised as a one-time-code field
- **AND** no one of them is preferred by the signals this capability names
- **THEN** the extension SHALL put those fields to the person
- **AND** it SHALL fill no field until the person has chosen one

#### Scenario: Several fields qualify and one is preferred

- **WHEN** a page holds more than one field recognised as a one-time-code field
- **AND** one of them is preferred by the signals this capability names
- **THEN** the extension SHALL put the preferred field to the person for confirmation rather than
      fill it unasked

### Requirement: A code reaches the page without a permission this extension does not already hold

Putting a code into a page SHALL NOT require this extension to hold a permission it does not already
hold, and SHALL NOT require anything from the page. The extension's manifest SHALL NOT gain a
permission in order to deliver a code, and the page SHALL NOT be asked for access, consent, or a
response of any kind.

This is a behavioural requirement rather than an implementation note because the failure it rules
out is invisible in a diff. A delivery that worked by asking the page for something would be a
delivery that works on some pages and fails on others for reasons the person cannot act on — which
is the same failure this capability already records for creation, and for the same underlying cause:
a request made in the page's own context obeys the **page's** policy rather than this extension's.

The extension's declared host reach SHALL remain the reach its shipped surfaces use. Reaching a page
this extension holds no host permission for is not a reach declaration, and a permission added to
make it one would be a permission this extension cannot name a user-facing feature for.

#### Scenario: The manifest is read after this change

- **WHEN** the extension's manifest is read
- **THEN** it SHALL request no permission this extension did not already request
- **AND** every permission it does request SHALL be one a shipped surface uses

#### Scenario: The page refuses cross-origin requests

- **WHEN** a page is served under a policy that refuses cross-origin requests
- **THEN** activating a code's control SHALL still put that code into the page's field

#### Scenario: The page is asked for nothing

- **WHEN** this extension puts a code into a page
- **THEN** it SHALL ask that page for nothing
- **AND** a page that would refuse any such request SHALL NOT prevent the fill
