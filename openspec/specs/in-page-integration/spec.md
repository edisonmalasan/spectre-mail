# in-page-integration Specification

## Purpose

Records the extension's behaviour **inside somebody else's page** — what it offers,
when, what it inserts, and how it is kept out of the page's own content.

This is the one surface in the product that a user does not open SpectreMail to see. Every other
region belongs to this product: a page it renders, a popup it owns, a mail client it built. A content
script is a control drawn inside a stranger's signup form, and that changes what has to be specified.
A control permanently attached to every email field on every page is the outcome this product's own UX
rules forbid, so these requirements are as much about **restraint** as about the insertion: at most
one affordance, on focus and nowhere else, only on an empty field, and only when this device already
holds an address to insert.

Two of them are not about this extension's own behaviour at all. One is that the inserted address must
become **the value the page's own code holds** rather than the value the field paints, because an
input assigned without reaching its framework's state renders as filled and submits as empty. The
other is that the control must be **unreachable by the page and by its cascade** — not hidden, but
isolate — which is why the requirements separate what the page can *address* from what the page's
*stylesheets* can *reach*, and why "separate" here is two requirements' worth of claim rather than
one.

**What none of it establishes.** No test in this repository reads a rendered pixel, so how the
affordance looks inside a real third party's page remains a human judgement — and the surface under
test belongs to a stylesheet this repository did not write. See this change's `design.md` D6 and D7.

## Requirements

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

### Requirement: The affordance inserts the address this device already holds

When the affordance is activated on an email field, the extension SHALL insert the address of a
mailbox already stored on this device into that field, and SHALL read that address through the
shared storage contract rather than by interpreting stored records itself. **The address the
control will insert SHALL be named by the control itself**, because this device may hold more than
one mailbox and an affordance that says only that it is SpectreMail no longer says which address it
is about to write into somebody else's page.

The extension SHALL NOT submit, press, or otherwise activate the form the field belongs to, and it
SHALL offer no affordance on a field that already holds text: a control that replaces what a user
has typed is a data-loss gesture, and refusing to appear is the answer that contains no ambiguity
about what was asked for.

**Amendment, recorded at proposal (2026-10-08), by `site-associations`.** This said **"the address
of the mailbox already stored on this device"**, which was singular because the device held exactly
one mailbox — measured, not assumed: both storage adapters write it under one key and a second
creation overwrites the first. **What is singular is now a choice rather than a fact.** The device
may hold several mailboxes, so the requirement states which one, and it states that the control says
which one. **Naming the address is the whole mechanism**: this change adds no list, no menu, and no
second control inside somebody else's page, so the accessible name is the only surface on which the
choice can be reported at all. A name that did not carry the address would leave the difference
between what the popup shows and what the page receives invisible to the person about to submit a
form to a stranger.

The two rules this requirement already carried — the form is never activated, and no affordance
appears over text somebody typed — are **unchanged**, and the second is the reason this design can
name an address at all: the control only ever appears over an empty field, so the address it names
is one the person is about to submit rather than one that would overwrite their own typing.

#### Scenario: The affordance is activated on an empty field

- **WHEN** the affordance is activated on an empty email field
- **THEN** the field SHALL hold the address of a mailbox stored on this device
- **AND** that address SHALL be one the control named before it was activated

#### Scenario: The control names the address it will insert

- **WHEN** an affordance is offered on an email field
- **THEN** its accessible name SHALL contain the address it will insert

#### Scenario: The field already holds text

- **WHEN** an email field holds text and takes focus
- **THEN** the extension SHALL offer no affordance for that field

#### Scenario: The form is not activated

- **WHEN** the affordance has inserted an address
- **THEN** the extension SHALL NOT have submitted the form the field belongs to
- **AND** the extension SHALL NOT have pressed a control belonging to it

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

A refusal the extension reports SHALL be reported as a refusal, in the report the provider's adapter
composed for it, and SHALL NOT be reported as a success or as an absence of mailboxes.

**Amendment, recorded during apply (2026-10-08), by in-page-mailbox.** This sentence previously
read *"in the words the provider used"*, and **it was false of the product this change shipped** -
found by the first browser run of the refusal case, which read the control's own name in a real
Chromium. The name is:

No configured provider could create a mailbox. then, per provider, <id>: <CODE> - <description>.

The provider's **raw response body is discarded upstream of this surface**: Mail.tm answered the
recorded throttled creation with Too many accounts created. Please wait and try again., the
adapter classified that as RATE_LIMITED, and the sentence a person reads is the adapter's own.
So a requirement demanding the provider's verbatim words would be demanding something no surface in
this product produces, and a case asserting it would fail against correct code.

What is replaced is not a weakening, and the difference is worth being precise about: the original
clause would have been satisfied by any prose at all, because nothing defined "the words the
provider used" in a checkable way. This one names three things a reader can go and look for - **which
provider**, **which normalised condition**, and **the condition stated in full** - and it keeps the
clause that mattered, which is that the page adds no summary of its own. Carrying the raw body
through instead would mean widening provider-abstraction's error contract, which is not this
change's business and which would have changed what every client shows.

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
- **AND** it SHALL report the refusal the extension composed, naming the provider that refused
- **AND** it SHALL NOT report a success

**Amendment, recorded during apply (2026-10-08), by in-page-mailbox.** The third bullet previously
read *\"the provider's own words\"*, for the reason the requirement above records: no surface in this
product carries a provider's raw body, and the adapter's own condition report is what reaches the
page. **Both providers must have refused for this branch to be reachable at all**, because the
extension's manager prefers Mail.tm and falls back - so the case that exercises it stages two
refusals, one of which (guerrillaThrottled) is **synthetic**: no 429 was ever observed from
Guerrilla Mail. What the browser tier establishes is that a refusal reaches the page when no
provider could serve the request, and nothing about what any single provider does when it refuses.

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

### Requirement: The control prefers the mailbox this site was last used with

Where this device holds a mailbox that was **last used on the site the field belongs to**, the
affordance SHALL offer that mailbox in preference to any other mailbox this device holds, and
SHALL insert it. Where it holds none for this site, the affordance SHALL offer the newest mailbox
it holds, which is the same answer it gave before this change.

A site SHALL be identified by the **exact** host the browser reports for the page the field belongs
to, with no parent-domain folding and no leading `www.` removed, so a mailbox used on
`login.example.co.uk` is not offered on `example.co.uk`. **A key derived from anything other than
the browser's own value SHALL NOT be used**, because this repository ships no public suffix list and
a rule that guesses one merges hosts a person told apart.

**Why "last used" and not "the first one that matches", recorded because it is the difference between
a map and a guess.** The association names one mailbox per host, and the record is written when an
address is inserted rather than when the page is visited. So a host resolves to exactly one answer,
and a host that was never used with one resolves to the newest mailbox rather than to whichever
mailbox happened to be stored first.

**And the preference is what "allow using: the mailbox this site was last used with" means here,
stated plainly because the roadmap's wording is a list of three.** This change delivers that third
option as **which** mailbox a site resolves to, not as a menu over the others. A person on a site
that has an association who wants a different existing mailbox has no control for it; they create a
new mailbox, which becomes the newest, and it is offered on the next visit. **That is a real limit
on "allow using", and it is recorded here rather than left to be discovered at M10**, when a menu
inside somebody else's page can be judged on its own evidence instead of added as a side effect.

#### Scenario: This site has a mailbox of its own

- **WHEN** an email field takes focus on a host this device holds a mailbox for
- **THEN** the affordance SHALL name and insert that mailbox

#### Scenario: This site has no mailbox of its own

- **WHEN** an email field takes focus on a host this device holds no mailbox for
- **THEN** the affordance SHALL name and insert the newest mailbox this device holds
- **AND** the answer SHALL be the same one a site with no association has always received

#### Scenario: Two hosts that share a parent domain

- **WHEN** a mailbox was last used on `login.example.co.uk`
- **THEN** a field on `example.co.uk` SHALL be offered the newest mailbox instead

#### Scenario: The host is read rather than derived

- **WHEN** the key for a site is determined
- **THEN** it SHALL be the host the browser reports for that page
- **AND** no other spelling of that host SHALL be used as a key

### Requirement: An association is recorded by an insertion, and one that cannot be honoured is not offered

A host SHALL be associated with a mailbox **only after an address was inserted** on that host, and
SHALL NOT be associated merely because a field took focus or because the affordance was shown. The
association therefore records something a person did rather than something a page did.

Where a recorded association names a mailbox this device **no longer holds**, the extension SHALL
NOT offer that mailbox, SHALL NOT offer a different mailbox under that host's name, and SHALL NOT
repair, overwrite, or delete the record while offering the field. It SHALL offer the same answer
this site would have received had no association been recorded, and it SHALL leave the unreadable
record in place.

**Why an insertion and not a view, recorded because the alternative is a record of page loads.** A
page can make an email field take focus by script, so an association written on focus would let any
site on the internet decide which mailbox this device offers on a host it merely mentions in a
frame. Writing it on the insertion puts the record behind the one action a person took, and it makes
the stored key mean what its name says.

**Why a stale association is ignored rather than repaired, recorded because either repair looks
tidy.** The id in the record names a mailbox that existed on some earlier visit and does not now —
this product has no deletion, so the honest causes are a storage area that was emptied and a record
this build cannot read. Overwriting it with the newest mailbox would destroy the association the next
time this device is at that host with no mailbox to name, and the person would find the host had
silently changed what it inserts. Deleting it would be the irreversible half of the same decision:
the record is unreadable, not proven wrong. So the requirement is the narrow one — offer nothing
this device does not hold — and the record stays.

#### Scenario: An address is inserted on a host

- **WHEN** the affordance inserts an address on a host
- **THEN** that host SHALL resolve to that mailbox on a later visit to it

#### Scenario: A field takes focus

- **WHEN** the affordance is offered on a host this device holds no mailbox for
- **THEN** no association SHALL be recorded for that host

#### Scenario: The recorded mailbox is gone

- **WHEN** a host's recorded mailbox is one this device no longer holds
- **THEN** the affordance SHALL offer the newest mailbox this device holds instead
- **AND** the recorded association SHALL be left in place

#### Scenario: The association cannot be read at all

- **WHEN** the association record cannot be read
- **THEN** the affordance SHALL offer the newest mailbox this device holds
- **AND** the failure SHALL NOT be reported as "this site's mailbox"
