# Spec Delta

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

#### Scenario: A field is not an email field

- **WHEN** an element that is not an input identifying itself as an email field takes focus
- **THEN** the extension SHALL offer no affordance for it

### Requirement: The affordance offers no address this device does not hold

The affordance SHALL be offered only when this device holds a stored mailbox address to insert, or
holds none and the person is offered the creation of one, and it SHALL never offer an address this
device does not hold and has not caused to exist. **The two cases are different offers and the
control's own wording SHALL distinguish them**, because one inserts something already held and the
other asks a provider for something that does not yet exist.

**Amendment, recorded at proposal (2026-10-08), by `in-page-mailbox`.** This is the amendment the
previous version of this requirement **required** rather than merely permitted: it stated that the
milestone adding creating a mailbox from a page *"SHALL amend this requirement rather than leaving
the empty case unaddressed"*, and left a scenario asserting that obligation. This change discharges
it: the empty case is now stated. **The obligation scenario is generalised rather than retired**,
for the same reason `extension-client`'s equivalent scenario was when the content script arrived —
it named one event that has now happened and would therefore guard nothing afterwards, and this
product's own UX rules call for further offers (a recently-used address, an address belonging to
this site) that the same rule has to keep applying to. The justification for refusing to show a
control with nothing to insert still stands unchanged: a control whose only reachable answer is that
there is no address yet is a control that cannot act. What changed is that the empty case now has
an action, rather than having none.

#### Scenario: This device holds no mailbox

- **WHEN** an email field takes focus and this device holds no stored mailbox
- **THEN** the extension SHALL offer an affordance for that field
- **AND** that affordance SHALL offer to create an address rather than to insert one

#### Scenario: This device holds a mailbox

- **WHEN** an email field takes focus and this device holds a stored mailbox
- **THEN** the extension SHALL offer an affordance that inserts the address it holds
- **AND** it SHALL NOT describe that affordance as creating anything

#### Scenario: A milestone adds creating an address from a page

- **WHEN** a change extends what the affordance offered on an email field may do
- **THEN** it SHALL amend this requirement rather than leaving the new case unstated

**The title of the scenario above is not what it says, and that is deliberate.** It is the title the
previous version of this requirement gave its obligation scenario, kept because the archive gate
matches requirement and scenario blocks by **title**, so replacing the title is read as *dropping*
the scenario. The rule underneath it is the generalised one, because the previous wording named a
single event that has now happened and would guard nothing afterwards — and this product's own UX
rules call for further offers (a recently-used address, an address belonging to this site) that the
same rule has to keep applying to. **A scenario left verbatim would have been vacuous forever, and a
vacuous scenario reads as coverage**, which is the direction this repository has repeatedly recorded
as the worse one. A title that lags its body is visible; a scenario that asserts nothing is not.

## ADDED Requirements

### Requirement: The affordance creates an address for this device when it holds none

When the affordance offered for a device holding no stored mailbox is activated, the extension SHALL
ask its own background context to create a mailbox, SHALL hold the affordance up until that request
has been answered, and on an answer carrying an address SHALL insert that address into the field in
the same way a stored address is inserted, so that the property this capability already requires of
an insertion holds for a created one.

The extension SHALL NOT ask a provider for a mailbox more than once for a single outstanding
request: while a request is outstanding the affordance SHALL be disabled against further activation.
**Two requests would create two mailboxes at a provider, and one of them would be discarded** — a
consequence with a cost outside this product and no way to undo it, which is why the outstanding
request is a thing a person cannot start a second of.

A field that already holds text SHALL still be refused while this offer is up, exactly as it is for
an insertion, and no created address SHALL be inserted into a field that has acquired text in the
meantime.

#### Scenario: A device holding no mailbox focuses an empty field

- **WHEN** an empty email field takes focus on a device holding no stored mailbox
- **THEN** the extension SHALL offer an affordance that offers to create an address
- **AND** activating it SHALL cause the extension to ask its own background context to create a mailbox

#### Scenario: The request is outstanding

- **WHEN** a request to create a mailbox has been made and no answer has arrived
- **THEN** the affordance SHALL report that it is waiting for an address
- **AND** activating it again SHALL cause no second mailbox to be requested

#### Scenario: An address comes back

- **WHEN** a request to create a mailbox is answered with an address
- **THEN** the field SHALL hold that address
- **AND** the page's own code SHALL read back that address as the field's value
- **AND** the affordance SHALL be removed

#### Scenario: The field acquired text while the request was outstanding

- **WHEN** a request to create a mailbox is answered with an address
- **AND** the field it was offered for has acquired text in the meantime
- **THEN** the extension SHALL insert nothing into that field

### Requirement: Creating an address does not depend on the page's own permission to reach a provider

The creation of a mailbox SHALL be performed by the extension in a context the extension itself
controls, and SHALL NOT be performed by the page's own context. A page's own restrictions on
cross-origin requests SHALL NOT determine whether an address can be created for it, and the
extension SHALL NOT require the page to grant it anything, and SHALL NOT read anything from the page
to perform the creation.

This is a behavioural requirement rather than an implementation note because the two properties look
alike and behave oppositely. A content script's own request to a provider is subject to **the
page's** policy on cross-origin requests, and the extension's declared host permissions do not
change that; a request made by the extension's own background context is not. A product that
created mailboxes where its control is drawn would work on some pages and fail on others for reasons
its user cannot act on and its own permissions cannot fix.

#### Scenario: A page forbids cross-origin requests

- **WHEN** a page is served under a policy that refuses cross-origin requests to the provider origin
- **THEN** activating the affordance SHALL still reach the provider
- **AND** an address SHALL be created

#### Scenario: The page cannot be asked for permission

- **WHEN** the extension creates an address inside a page
- **THEN** it SHALL ask that page for nothing
- **AND** a page that would refuse any such request SHALL not prevent the creation

### Requirement: The page reports only what something confirmed

The page SHALL NOT report a creation as failed when no answer to the request arrived, and SHALL NOT
report that no mailbox was created, because nothing observed either. When its wait for an answer
passes with no answer, the page SHALL re-read this device's stored mailbox, and SHALL act on what
that read returns: a mailbox stored there SHALL be treated as the created address and inserted, and
the absence of one SHALL be reported as an outcome this page could not confirm rather than as a
failure.

A refusal the extension reports SHALL be reported as a refusal, in the words the provider used, and
SHALL NOT be reported as a success or as an absence of mailboxes.

**A person may press again after an unconfirmed outcome, and the extension SHALL let them.** The
alternative leaves somebody who has been told nothing with no way forward, and the possibility that a
second request creates a second mailbox at a provider is the cost of that: it is stated here rather
than prevented, because preventing it would mean refusing a request the person is entitled to make
on the strength of a report the extension has already told them is unconfirmed.

#### Scenario: An answer arrives

- **WHEN** a request to create a mailbox is answered
- **THEN** the page SHALL insert the address the answer carries
- **AND** it SHALL report nothing as failed

#### Scenario: The wait passes and a mailbox was stored

- **WHEN** the page's wait for an answer passes with no answer
- **AND** this device holds a stored mailbox
- **THEN** the page SHALL insert that address
- **AND** it SHALL report nothing as failed

#### Scenario: The wait passes and nothing was stored

- **WHEN** the page's wait for an answer passes with no answer
- **AND** this device holds no stored mailbox
- **THEN** the page SHALL report that it could not confirm an address was created
- **AND** it SHALL NOT report that no mailbox was created
- **AND** its affordance SHALL remain available for a further request

#### Scenario: The provider refuses

- **WHEN** the extension answers that the provider refused the request
- **THEN** the page SHALL report a refusal
- **AND** it SHALL report the provider's own words for it
- **AND** it SHALL NOT report a success

#### Scenario: An answer arrives after the wait already passed

- **WHEN** the page's wait for an answer passes with no answer
- **AND** this device holds no stored mailbox
- **AND** the extension then answers that a mailbox was created
- **THEN** the page SHALL insert nothing
- **AND** it SHALL report nothing further
- **AND** it SHALL record the created address as this device's mailbox
- **AND** a later field focus SHALL offer that address rather than a further creation

**Amendment, recorded during apply (2026-10-08), by `in-page-mailbox`.** This scenario was **not in
the proposal**, and the proposal's own scenarios had a hole: "the wait passes and nothing was stored"
ends with the page reporting that it could not confirm and its affordance remaining available, and
nothing said what happens when the request is answered *afterwards*. That is not a corner — a provider
round trip is not bounded by anything this product decided, which is the entire reason the wait has a
ceiling, so the late answer is the case the ceiling exists to create. Two behaviours were written
during apply and are now stated here because they are product decisions rather than implementation
detail. **The page inserts nothing, having already withdrawn its offer** — inserting afterwards would
be acting on a control the page had already said it could not stand behind. **And it records the
address anyway**, because the worker persists a mailbox *before* it answers (D3), so the mailbox is
real and is this device's; a controller that learned the address only by inserting it would offer to
create a **second** mailbox on the next field focus, which the cost clause above already treats as
the price of permitting a further request.