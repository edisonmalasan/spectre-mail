# website-client Specification

## Purpose

Describes what the SpectreMail website must do on a user's first visit and every
visit after: reach a provider it can actually use, hand the user a working
temporary address, and tell the truth about the address's status and lifetime.

*Provenance: the change delta's `## Purpose`, copied verbatim.*

This milestone's scope is stated here rather than inferred from the tree, because
the most likely way to get it wrong is to build too much: **M5 is structure, not
appearance.** The visual system, design tokens, and layout belong to M7, and
markup written now would be markup that milestone rewrites. The requirement that
says so is the last one, and it is a requirement rather than a note so that
skipping it is a visible violation rather than an unstated preference.

## Requirements

*Appended at the rowser-verification sync stage (2026-10-05). The two requirements below are byte-identical to that change delta's ADDED block — checked mechanically, not by reading. Nothing above this line was touched.*

### Requirement: The website reaches Guerrilla Mail and no other provider

The website SHALL configure exactly one provider, Guerrilla Mail, and SHALL NOT
configure Mail.tm, offer it as a fallback, or probe for it. It SHALL offer no
control for choosing a provider, and SHALL NOT present that absence as a missing
or forthcoming feature.

**Note, recorded during proposal.** Mail.tm sends CORS headers only to its own
origins, so no compliant web page can reach it — measured, not assumed. A
SpectreMail-operated backend to relay it is explicitly forbidden by
`provider-abstraction`. Configuring it here would therefore produce a runtime
failure whose cause the user could not see and could do nothing about. The
extension's Mail.tm-primary policy is unchanged; this is a client-configuration
fact, not a verdict on the provider.

#### Scenario: The website page loads

- **WHEN** a page of the website is served and its provider configuration is read
- **THEN** exactly one provider SHALL be configured
- **AND** it SHALL be Guerrilla Mail
- **AND** no request SHALL be made to any other provider's origin

#### Scenario: The provider selector is present

- **WHEN** the website renders a provider selector
- **THEN** it SHALL offer no provider that the website cannot reach
- **AND** its absence SHALL NOT be presented as a missing feature

#### Scenario: The website is displayed

- **WHEN** the website is displayed in any state
- **THEN** it SHALL offer no control for choosing a provider
- **AND** it SHALL name the provider it reaches
- **AND** it SHALL NOT describe the absence as missing or forthcoming

#### Scenario: A second provider becomes reachable from a web page

- **GIVEN** the website is configured with exactly one provider
- **WHEN** a second provider is added to the website's configuration
- **THEN** the change SHALL be confined to that configuration
- **AND** no part of the website's presentation SHALL need to change
- **AND** the website SHALL reach only providers it can actually access

**Amendment, recorded during apply planning (2026-10-04).** Two scenarios are
added. Both address claims that were previously made only in code comments, where
nothing could check them.

**The website is displayed** exists because *The provider selector is present* has
a `WHEN` that never holds — the website renders no selector, so the scenario
constrains nothing today. The test that noticed this recorded the consequence
precisely: "A conditional scenario with nothing asserting the condition is the
shape that hides a whole slice: nobody can tell whether the selector was
forgotten, deliberately deferred, or quietly removed." It also stated that it was
"expected to be **replaced**" when the selector slice landed, "and the replacement
is the honest thing to do — this one would otherwise start failing and someone
would delete it."

That replacement was **not** made, and the reason is worth recording.
`openspec validate --strict` refuses a `MODIFIED` block that omits a scenario the
current spec still has, on the grounds that a modified requirement replaces the
whole block. Re-reading the conditional scenario against that constraint showed the
refusal was right: its clauses are a correct rule for *any* client that renders a
selector, including the extension at M8. Deleting it would have removed a genuine
forward constraint to tidy a title. So it stays, unedited, as the rule for a
client that has a selector to render — and the new scenario states what is true of
the website today, which is that it offers no control and names the one provider it
reaches.

That last clause is the substantive change. A page which merely omits a selector
leaves a reader unable to tell whether one was forgotten; naming Guerrilla Mail
makes the single-provider dependency the *known limitation* `provider-abstraction`
requires it to be recorded as, rather than presented as redundancy.

**A second provider becomes reachable from a web page** has no predecessor, and
addresses a requirement the website was failing. `provider-abstraction`'s scenario
*A client has only one provider* already requires that "adding a second provider
SHALL remain additive through the abstraction, not require a rewrite". That clause
was true of the abstraction and **false of the website's configuration**:
`WEBSITE_PROVIDER_IDS` was documented as making "adding a provider ... a visible
edit to one list", while `createWebsiteProviderManager` never read it and
constructed the adapter directly, so a second provider had to be added in two
places. The existing test asserted the coupling that did not exist, and its own
comment conceded "the two constants must be changed together, so that is now said
rather than implied".

This scenario states the requirement so the configuration can be made to satisfy
it, rather than merely documented as not violating it. The alternative — keeping
the comment and calling the requirement satisfied — is the same defect this
repository has recorded seven times: a check narrower than the rule it documents.

### Requirement: The website creates a mailbox without asking

On load the website SHALL look for a mailbox this device has stored, and SHALL
create one only when there is none. It SHALL present the address without
requiring an account, a sign-up step, an email address of the user's own, or any
other information from the user.

**Note, recorded during proposal.** Unchanged in what it forbids: no account, no
sign-up, no information asked for. What changed is the word *on load*, which used
to mean "create", and now means "look, then create if there is nothing".

**Amendment, recorded during proposal (2026-10-05).** Written into this delta
rather than added at the sync stage, so the archived record of what this change
asked for and the promoted spec agree exactly.

#### Scenario: A first-time visitor arrives

- **WHEN** the website is opened for the first time on a device
- **THEN** a mailbox SHALL be created
- **AND** its address SHALL be presented
- **AND** no form SHALL have been required first

#### Scenario: A returning visitor arrives

- **WHEN** the website is opened on a device that has a stored mailbox
- **THEN** the website SHALL NOT create a mailbox
- **AND** it SHALL present the stored address once the provider confirms it

#### Scenario: Creation is still in progress

- **WHEN** the page has loaded but no mailbox has been created yet
- **THEN** the website SHALL say so
- **AND** it SHALL NOT display a placeholder address, an example address, or any
      address it did not receive from the provider

#### Scenario: Looking for a stored address is still in progress

- **WHEN** the page has loaded and has not yet learned whether a mailbox is stored
- **THEN** the website SHALL say it is checking
- **AND** it SHALL NOT display any address

### Requirement: The address is presented as text the user can take

The address SHALL be rendered as selectable text in a form that identifies it as
an address, and the website SHALL offer a way to place it on the clipboard. If the
clipboard cannot be written, the website SHALL say so rather than appear to have
succeeded.

#### Scenario: The user copies the address

- **WHEN** the user activates the copy action
- **THEN** the address SHALL be placed on the clipboard unchanged
- **AND** the website SHALL confirm the copy happened

#### Scenario: The clipboard refuses

- **WHEN** the copy action is used and the clipboard is unavailable or refused
- **THEN** the website SHALL report that the copy did not happen
- **AND** the address SHALL remain visible and selectable

#### Scenario: The address is read aloud

- **WHEN** a screen reader reaches the address
- **THEN** the element SHALL be exposed as text rather than as an image or an
  unlabelled control
- **AND** the copy action SHALL have a name that says what it copies

### Requirement: The website never claims a mailbox lifetime it cannot know

The website SHALL NOT display a countdown, an expiry time, or a remaining lifetime
derived from a creation time or a documented limit. Absent an expiry the provider
itself reported, the website SHALL say the lifetime is unknown.

**Note, recorded during proposal.** `provider-abstraction` already requires that
mailbox lifetime not be assumed, and this states the consequence for the screen a
user reads. Mail.tm publishes a 7-day retention and says a mailbox lasts until
deleted, but neither value appears in any API response and neither was measured
live; Guerrilla publishes nothing equivalent. A countdown computed from either
would be a number the product invented, and it would be wrong in the one direction
that costs a user a verification code.

#### Scenario: The created mailbox carries no expiry

- **WHEN** the website receives a mailbox with no expiry the provider reported
- **THEN** it SHALL state that the lifetime is unknown
- **AND** it SHALL NOT display a countdown or a number of minutes remaining

#### Scenario: The provider does report an expiry

- **WHEN** the website receives a mailbox carrying a provider-reported expiry
- **THEN** it MAY display that expiry
- **AND** it SHALL attribute it to the provider rather than present it as
  SpectreMail's guarantee

### Requirement: A failure is visible and retryable

When the website cannot obtain an address it SHALL say so in the user's terms,
name the condition when it is known, and offer a way to try again. It SHALL NOT
show an empty address, an example address, or a silent failure.

#### Scenario: The provider refuses

- **WHEN** mailbox creation fails
- **THEN** the website SHALL state that no address could be created
- **AND** it SHALL offer a retry
- **AND** it SHALL NOT display any address

#### Scenario: The provider is throttled

- **WHEN** mailbox creation fails for rate-limit reasons
- **THEN** the website SHALL say the provider is asking it to slow down
- **AND** it SHALL NOT retry automatically on the user's behalf

### Requirement: The website renders no provider data as markup and no provider field

The website SHALL render untrusted message and provider content as text only, and
SHALL NOT contain a provider's JSON field name or interpret a provider's response.

#### Scenario: The website sources are inspected

- **WHEN** every file under the website client is scanned
- **THEN** no provider JSON field name SHALL be found in it
- **AND** no file SHALL contain a provider adapter identifier

#### Scenario: The page renders

- **WHEN** the website renders
- **THEN** no value received from a provider SHALL be inserted as markup
- **AND** untrusted content SHALL be escaped by the rendering layer rather than
  pre-rendered to HTML by the client

### Requirement: The page is built with correct structure, accessible names, and states

The website SHALL present a working page with correct structure, accessible names,
and states, and SHALL apply the approved visual system through the shared token
layer rather than through values restated at each use.

**Amendment, recorded during proposal (2026-10-06).** This requirement previously read
*"This milestone builds structure, not visual design"* and required that the milestone
*"SHALL NOT have introduced a design token or theme system."* **That clause became false the
day this change landed**, which is the reason the requirement is modified here rather than
left to be discovered at sync. A requirement that outlives its own falsification is worse
than one that dies with it, because it reads as a live constraint on work that has already
been approved.

**What the amendment does not do.** It does not weaken the requirement the clause
protected. Correct structure, accessible names, and reachable labelled states are the same
obligations, and the scenario requiring every state to be rendered as distinct labelled
content **carries forward unchanged** — including its clause that no state be conveyed by
colour alone, which `visual-system` now also requires and which this milestone makes hard
to keep, because the accent is about to appear on active status.

The original notes are retained, because they record why the structure was built this way
and that reasoning is not superseded by adding a stylesheet to it.

**Original note, recorded during proposal.** The reason this requirement exists is that
markup written before the design milestone is markup the design milestone rewrites, and
that has not become less true by the milestone gaining states.

**Amendment, recorded during proposal (2026-10-05).** The state-coverage scenario below
now names the states recovery adds. It listed three, and a page that could reach five more
while its coverage requirement named three would be a page whose states nothing had
claimed to check.

**Second amendment, recorded during apply (2026-10-05).** That list was itself incomplete,
and the implementation is what showed it: it named six of the seven states and omitted
`creating`, which is the state a first-time visitor actually sees for the whole of the
provider request. A coverage requirement that omits the most-observed state on the page is
worse than the three-state version it replaced, because it reads as exhaustive and would
have let `creating` ship unrendered. The enumeration is now all seven, in the order a page
passes through them.

#### Scenario: The page is built

- **WHEN** the website's production build runs
- **THEN** it SHALL build and serve
- **AND** every design value it renders SHALL come from the shared token layer
- **AND** no design value SHALL be restated at a point of use

#### Scenario: Each state is reachable

- **WHEN** the page is looking for a stored address, is creating a mailbox, is
      checking a stored one, has a ready mailbox, could not create one, could not
      check the stored one, or has found the stored one is gone
- **THEN** each SHALL be rendered as distinct, labelled content
- **AND** none SHALL be conveyed by colour alone

### Requirement: The inbox lists the current mailbox's messages

The website SHALL present the current mailbox's messages as a list, and each row
SHALL show the sender, the subject, when it arrived, and whether the provider
reported it unread. A message with an empty subject or an empty sender SHALL still
be listed.

**Note, recorded during proposal.** The empty-field rule is not defensive
programming, it is a measurement: a real Guerrilla message arrived with an empty
subject while its sender and body were present (`docs/PROVIDERS.md`, run
`2026-10-01T18-08-41-251Z`). A list row that hid such a message would hide the very
mail this product exists to deliver.

#### Scenario: The mailbox has messages

- **WHEN** the inbox is displayed for a mailbox with messages
- **THEN** each message SHALL appear as its own row
- **AND** each row SHALL name the sender, the subject, the time, and the unread state

#### Scenario: A message arrived with no subject

- **WHEN** a message the provider reported has an empty subject
- **THEN** it SHALL still appear in the list
- **AND** its row SHALL NOT be blank in place of the subject

#### Scenario: The mailbox has no messages

- **WHEN** the provider reports no messages
- **THEN** the inbox SHALL say the mailbox is empty
- **AND** it SHALL NOT present that as a failure

#### Scenario: The inbox has not been checked yet

- **WHEN** the inbox is displayed before any listing has completed
- **THEN** the website SHALL say it is checking
- **AND** it SHALL NOT present that as an empty mailbox

### Requirement: A message carrying a verification is marked as one

The website SHALL mark a message that the session determined carries a one-time
code or a verification link, and SHALL NOT mark one that was not determined to
carry either. An undetermined message SHALL NOT be presented as carrying nothing.

#### Scenario: A message carries a code

- **WHEN** the session determined a message carries a one-time code
- **THEN** the row SHALL be marked as carrying one
- **AND** the marking SHALL NOT depend on colour alone

#### Scenario: A message carries nothing

- **WHEN** the session determined a message carries neither a code nor a link
- **THEN** the row SHALL NOT be marked

#### Scenario: A message could not be determined

- **WHEN** the session could not read a message it saw listed
- **THEN** the row SHALL say so
- **AND** it SHALL NOT say the message carries nothing

### Requirement: The address survives anything the inbox does

A mailbox that exists SHALL remain on screen with its address whether or not the
inbox could be listed. A failed check SHALL be reported as a condition of the inbox
and SHALL NOT replace, hide, or invalidate the address, and the address SHALL remain
selectable throughout.

#### Scenario: Checking for mail fails

- **WHEN** listing the mailbox's messages fails
- **THEN** the website SHALL still show the address
- **AND** it SHALL say the inbox could not be checked
- **AND** it SHALL NOT show an error in place of the address

#### Scenario: The inbox recovers

- **WHEN** a later listing succeeds after a failed one
- **THEN** the website SHALL show the messages
- **AND** it SHALL NOT continue to claim the inbox cannot be checked

### Requirement: The website's inbox states no cadence it cannot support

The website SHALL NOT display a polling interval, a refresh countdown, or a claim about
how often **SpectreMail chose** to check or what it believes it is permitted to check.
Where the website tells the user that checking happens, it SHALL describe the behaviour
rather than quote a rate.

A provider's own rate-limit statement, quoted verbatim and attributed to the provider,
is **not** such a claim and is not forbidden here: it is evidence the website received
rather than a number SpectreMail picked, and suppressing it would mean inventing a
plausible limit in its place. What the website SHALL NOT do is attach a scope to such a
statement — a window it read from the provider's header is a floor the product applies
to itself, not a permission the provider granted.

**Amended during the M5 slice 2 verification pass.** This clause originally forbade any
display of a "provider rate", and the implementation displays a provider's verbatim
`ratelimit-policy` statement beside the throttling annotation. That is a genuine
conflict between two clauses of this change as originally written — `mailbox-session`
requires the statement be reported verbatim and unparsed — and it was resolved by
narrowing this clause to the numbers the *product* chooses, rather than by dropping a
statement a user needs in order to understand why their mailbox stopped updating. The
resolution is recorded here because a spec that has been quietly reinterpreted is
worse than one that was amended.

#### Scenario: The inbox is on screen

- **WHEN** the inbox is displayed
- **THEN** no interval, countdown, or rate SpectreMail chose SHALL be shown
- **AND** the checking behaviour SHALL be described without a number

### Requirement: The mailbox is checked again when the page is looked at

When the page becomes visible again after having been hidden, the website SHALL ask
for a listing promptly rather than waiting out an interval that elapsed unseen.

#### Scenario: The page was hidden and returns

- **WHEN** the page becomes visible after having been hidden
- **THEN** the website SHALL request a listing
- **AND** it SHALL NOT display an interval it is waiting out

#### Scenario: The page is hidden

- **WHEN** the page becomes hidden
- **THEN** the website SHALL report that nothing is displaying the inbox
- **AND** it SHALL NOT request listings

### Requirement: A message can be opened and read without leaving the page

The website SHALL let a user open a message from the inbox and read it on the same page,
and SHALL show its sender, its subject, when it arrived, its readable text, the codes
found in it, and the links found in it. A message the provider reported with an empty
sender or an empty subject SHALL still be openable and readable. The message body SHALL
be rendered as text and never as markup.

#### Scenario: The inbox has messages

- **WHEN** the inbox is displayed with messages in it
- **THEN** each message SHALL be openable
- **AND** an openable message SHALL be reachable by keyboard

#### Scenario: A message is opened

- **WHEN** the user opens a message
- **THEN** its sender, subject, arrival time, readable text, codes, and links SHALL be
  shown
- **AND** the inbox SHALL remain reachable so the user can go back

#### Scenario: The opened message was reported with empty fields

- **WHEN** the opened message has an empty sender or an empty subject
- **THEN** it SHALL still be readable
- **AND** each empty field SHALL say it was empty rather than being blank

#### Scenario: The message body contains markup

- **WHEN** the body a provider returned contained markup
- **THEN** it SHALL be shown as text
- **AND** no markup in it SHALL be interpreted

### Requirement: The page never reports a message it could not read as empty

Where the session could not read a message, the website SHALL say so in words distinct
from a message that was read and held nothing. It SHALL offer to try again, and a
request to open a message SHALL be a user-initiated request with a visible outcome.

#### Scenario: A message cannot be read

- **WHEN** the session reports that a message could not be read
- **THEN** the page SHALL say the message could not be read
- **AND** it SHALL NOT say the message contains no code or no link
- **AND** a retry SHALL be offered

#### Scenario: A message is being opened

- **WHEN** a message is being opened
- **THEN** the page SHALL say it is being read
- **AND** it SHALL NOT show a message with no content in place of it

### Requirement: The page states that its detections can be wrong

Where the page shows codes or links found in a message, it SHALL present them as
ranked candidates and SHALL state that they may be wrong. It SHALL NOT display a
confidence as a number or as a percentage, because the parser produces a judgement
traceable to a published rule rather than a probability.

#### Scenario: A message has candidates

- **WHEN** the page shows a code or a link found in a message
- **THEN** the finding SHALL be labelled as something the page's reading may have got
  wrong
- **AND** no confidence value SHALL appear as a number

#### Scenario: A message holds no candidates

- **WHEN** a message was read and no code or link was found in it
- **THEN** the page SHALL say so as a finding rather than leaving the absence to be
  inferred from an empty area

### Requirement: This slice shows what it found and does not act on it

The website SHALL NOT offer a control that copies a code, and SHALL NOT render a
detected link in a form that follows it. A link SHALL be shown as text with the
destination host visible. Copying a code, opening a verification link, filling a code
into a form, and notification are the verification workflow, which the roadmap
schedules at a later milestone; this milestone displays findings only.

**Note, recorded during proposal.** This requirement resolves a conflict between two
sources. `docs/ROADMAP.md`'s M5 acceptance criteria list "copy the OTP" as something a
user must be able to do in M5, while `AGENTS.md` assigns "OTP copy/fill" to the
verification workflow milestone, whose user actions include `Copy code`, `Fill code`,
and `Open verification link`. The roadmap's acceptance criteria are deliberately **not
edited by this change** — a plan's exit conditions are not amended from inside a slice —
and this requirement names the later milestone that delivers the criterion instead. The
reasoning is recorded in `design.md` D4.

#### Scenario: A message is open

- **WHEN** a message showing codes or links is open
- **THEN** no copy control SHALL be offered for a code
- **AND** no detected link SHALL be followed by rendering the message

#### Scenario: A detected link is shown

- **WHEN** the page shows a verification link found in a message
- **THEN** it SHALL be shown as text
- **AND** the destination host SHALL be visible

*Provenance: slice 1 promoted 7 requirements and 15 scenarios; slice 2
(`inbox-polling`) promoted 5 more with 12 scenarios; slice 3 (`message-view`) promoted 4
more with 10 scenarios; slice 4 (`provider-reachability`) **modified** an existing
requirement rather than adding one, adding 2 scenarios to it, for 16 requirements and 39
scenarios. Every requirement title and scenario title in the delta survived the merge,
checked mechanically rather than by reading.*

*Slice 4 modified a requirement in place, and the reason is the same class of
defect this file keeps recording: a requirement whose scenario could not fire. `The provider
selector is present` read "WHEN the website renders a provider selector", and the website
renders none, so the `WHEN` never held and the scenario constrained nothing. An
unconditional scenario was **added** rather than the conditional one rewritten, and not
only because `openspec validate --strict` refuses a `MODIFIED` block that omits a scenario
the promoted spec still has. Re-reading the conditional scenario against that refusal showed
the refusal was right: its clauses are a sound rule for any client that renders a selector,
including the extension at M8. Deleting it to tidy a title would have removed a real forward
constraint to make a validator quiet, which is the wrong trade.*

*The added scenario requires the page to name the provider it reaches, and that clause is the
substantive one. A page which merely omits a selector leaves a reader unable to tell whether
one was forgotten; naming it makes the single-provider dependency the known limitation
`provider-abstraction` requires it to be recorded as, rather than presented as redundancy.*

*The second added scenario has no predecessor and addresses a requirement the website was
failing. `provider-abstraction` already requires that "adding a second provider SHALL remain
additive through the abstraction, not require a rewrite", and that was true of the abstraction
and **false of the client's configuration**: `WEBSITE_PROVIDER_IDS` documented itself as making
"adding a provider ... a visible edit to one list", while `createWebsiteProviderManager` never
read it. The existing test asserted the coupling that did not exist, and its own comment
conceded "the two constants must be changed together, so that is now said rather than implied".
Two claims are enforced now that were previously only in comments: a build fails when a client
exports a provider-id list it never reads as a value, and an id declared with no adapter beside
it does not compile.*

*Slice 1's own provenance footer claimed "7 requirements and 14 scenarios" here. The
delta had **15**. That is the third arithmetically-wrong published count in this
repository — M4 published 26 generated corpus tests where the fixture count made 28 —
and the third to sit in a promoted spec as a provenance claim rather than in a
test. Both earlier instances were found while doing arithmetic for something else;
this one was found because this sync counted the previous slice's delta instead of
trusting the number already written down. **A provenance line asserting a count is
still a claim, and claims need checking.** The correction is stated here rather than
applied silently, so a reader comparing this file with the archived delta sees why the
figure moved.*

*One requirement carries an amendment note from slice 2's verification pass, and it is
the only place in this repository where two clauses of one change contradicted each
other: this one forbade showing any "provider rate", while `mailbox-session` requires a
provider's limit statement be reported verbatim — and the implementation shows
`1; w=60` beside the throttling annotation. It was resolved by narrowing this clause to
the numbers the *product* chooses. Suppressing evidence the page received would have
meant inventing a plausible limit in its place, and a user told nothing would not
understand why their mailbox stopped updating.*

*Slice 3 promoted a requirement that resolves a conflict between two sources rather
than between two clauses: `docs/ROADMAP.md`'s M5 acceptance criteria list copying the OTP
as something a user must be able to do in M5, while `AGENTS.md` assigns OTP copy/fill to
the verification workflow milestone. The requirement here names the later milestone that
delivers the criterion, and `docs/ROADMAP.md`'s acceptance list is deliberately **not**
edited — a plan's exit conditions are not amended from inside a slice. A reader who finds
the roadmap claiming M5 ships a copy control will find this requirement explaining why it
does not.*

*That requirement is enforced by two build-failing boundary rules rather than by a
code review, and **both rules were found narrower than the clause they enforce**: the
clipboard rule matched neither `clipboard.write([new ClipboardItem(...)])` nor a
word-bounded `code` in an identifier such as `otpCode`, so it answered `false` on exactly
the forms a developer would most plausibly use. Both were widened with a control per form.
The limits that remain are stated in the rule's own source: an identifier spelled
`secret` is not caught, and neither is a `select()` followed by the user pressing Ctrl+C,
which reaches no clipboard API and is indistinguishable from selecting the mailbox
address, whose copying stays legal.*

### Requirement: A reload returns the user to the address they came back for

The website SHALL offer the mailbox this device stored on a previous visit, and
SHALL persist the mailbox it holds so a later visit can offer it again. It SHALL
NOT present a stored mailbox until the provider has confirmed it, SHALL NOT
present one address while another is the user's, and SHALL NOT discard a stored
mailbox because a check did not complete.

**Note, recorded during proposal.** This is the roadmap's `return to a recent
mailbox` acceptance line, which M5 recorded as blocked on the storage contract and
which now has one.

Two of its clauses are about what the website must *not* do, and they are the
clauses worth having in a requirement rather than only in the design. Presenting an
unconfirmed address risks handing the user an address they cannot receive at, at
the moment they are about to paste it somewhere. Discarding a stored mailbox on an
incomplete check means one dropped network request costs the user the address they
came back for.

Persisting the mailbox the page holds — rather than only the one it created — is
what makes replacing an address work: a user who replaces a mailbox and reloads
should return to the replacement.

#### Scenario: The user returns to a stored address

- **WHEN** the page loads with a stored mailbox the provider confirms
- **THEN** the address SHALL be presented as the user's own
- **AND** that mailbox's inbox SHALL be listed

#### Scenario: The user replaces the address and comes back

- **WHEN** the page holds a mailbox that was not created by the current page load
      and the user replaces it
- **THEN** the replacement SHALL be stored
- **AND** a later visit SHALL offer the replacement rather than the original

#### Scenario: The stored address is gone

- **WHEN** the provider reports that the stored mailbox no longer exists
- **THEN** the page SHALL say the address is gone
- **AND** it SHALL NOT show that address as one the user can receive mail at
- **AND** it SHALL offer a way to get a new address

#### Scenario: The stored address could not be checked

- **WHEN** the page could not determine whether the stored mailbox still exists
- **THEN** the page SHALL say it could not tell
- **AND** it SHALL offer a way to try again
- **AND** it SHALL NOT state that the address is gone
- **AND** it SHALL NOT discard what was stored

#### Scenario: The page cannot read its own storage

- **WHEN** the page fails to read what it has stored
- **THEN** it SHALL NOT report that nothing is stored
- **AND** it SHALL NOT create a mailbox on that basis
- **AND** it SHALL say it could not check
- **AND** it SHALL offer a way to try again

**Amendment, recorded during apply (2026-10-05).** The last two lines are new. As
written the scenario forbade two failures and required nothing, which is a
requirement a page can satisfy by rendering nothing at all — and rendering
nothing is the most likely implementation of a page whose storage read threw,
because there is no mailbox to render. `spectre-storage`'s contract already makes
the read a rejection rather than a `null` precisely so this page can *say*
something; the scenario did not ask it to.

#### Scenario: The page cannot write what it has

- **WHEN** the page holds a mailbox and fails to store it
- **THEN** it SHALL say so
- **AND** it SHALL NOT claim the address will be here after a reload

**Amendment, recorded during apply (2026-10-05).** This scenario did not exist,
and its absence was found by the implementation rather than by review: the save
rule the change introduces has a failure path, and nothing in the delta described
what a page may do with it. A page that saved silently would leave the user
believing reload recovery works on a device where it does not, which is the same
class of claim as the one this requirement exists to prevent — asserting something
about stored data that is not true.

#### Scenario: A stored mailbox is offered and a new one is created

- **WHEN** the page presents a restored mailbox
- **THEN** it SHALL NOT also present a different address as the user's

### Requirement: The user can make this device forget the address

Where this device holds an address, the website SHALL offer a way to remove it, and
SHALL say what removing it means. Removal SHALL be confirmed before it happens,
SHALL be reported honestly whatever its outcome, and SHALL NOT be undone by the
page continuing to run.

A user's decision to forget SHALL take precedence over persisting the mailbox the
page holds: while the user asks for nothing further, the page SHALL NOT write the
address back. A mailbox the user afterwards asks for SHALL be stored, because that
is a new decision rather than a continuation of the one they withdrew.

Where this device holds nothing, the website SHALL NOT offer removal and SHALL say
that nothing is kept. The website's own description of what it stores SHALL be true
of it, and SHALL NOT describe stored data as undeletable while offering no way to
delete it.

**Note, recorded during proposal (2026-10-05).** This requirement is the second
half of the promise *A reload returns the user to the address they came back for*,
and it is deliberately a separate requirement rather than an amendment to that one.
That requirement is about returning to a stored address; this one is about declining
to, and their failure modes are opposite — one risks losing an address, the other
risks silently writing one back. Folding them together would have made the
precedence between them implicit, and the precedence is the whole question. A user
who clears their data and then watches the page put the address back has been told
the truth and then had it taken away.

**Confirmation is a requirement rather than a nicety** because removal is
irreversible and the address is very often the one a sign-up in progress is waiting
on. Creating a replacement does not recover it: anything already sent to the old
address is lost, and the sign-up that was waiting for it cannot be completed. That
asymmetry is the whole argument, and it is the reason this is a two-step control
rather than a single button.

**The page keeps the mailbox on screen after removal, and that is not a
convenience.** The mailbox exists at the provider; what was removed is this
device's note of it. Discarding a live inbox because the user asked their browser to
forget an address would trade a privacy action for a data loss, and the user would
have asked for neither.

**Removal reaching the contract is already enforced architecturally.** No client may
name a platform storage API, and that boundary rule covers `deleteDatabase` as it
covers `indexedDB`, so a page cannot bypass the contract this removes through. What
the rule cannot enforce is the behavioural half — that the page does not write the
address back afterwards — because that is a comparison inside the page rather than a
named API. It is therefore a scenario here and not a boundary rule.

**Amendment, recorded during apply (2026-10-05).** The scenario *This device holds
nothing* presupposes that the page knows what the device holds, and it does not say what
the page may claim before it knows. That gap was found by implementing it: the region was
first rendered whenever storage was merely *available*, so during the boot read it
rendered its "nothing is kept" branch on a page that had not looked yet — a claim it
could not support, and the same failure `spectre-storage` exists to prevent, one layer
up. The added scenario names the third state, and the page resolves it by **withholding
the region entirely** rather than by inventing a fourth shape: the session's own region
is already saying a read is in flight, so nothing is left unsaid. This is the **fourth**
time this page has made a claim from a value it had not established, and the pattern is
worth more than any one instance — a branch reachable on an unknown value will eventually
assert something unverified.

#### Scenario: The page holds an address

- **WHEN** the page is displayed and this device holds an address
- **THEN** it SHALL offer a way to remove it

#### Scenario: Removal is confirmed before it happens

- **WHEN** the page offers removal
- **THEN** removal SHALL require an explicit further step
- **AND** nothing SHALL be removed before that step is taken

#### Scenario: The user removes their local data

- **WHEN** the user confirms removal
- **THEN** everything this device held SHALL be removed
- **AND** the page SHALL report that it was removed

#### Scenario: What removal means is stated

- **WHEN** removal has happened
- **THEN** the page SHALL say the address will not be offered again on a later visit

#### Scenario: The address stays usable

- **WHEN** removal has happened
- **THEN** the address SHALL remain on screen
- **AND** the mailbox's inbox SHALL remain usable

#### Scenario: The page does not write the address back

- **WHEN** removal has happened and the user does nothing further
- **THEN** the page SHALL NOT store that address again

#### Scenario: The user then asks for a new address

- **WHEN** removal has happened and the user asks for a different address
- **THEN** that address SHALL be stored

#### Scenario: Removal is refused

- **WHEN** removal fails
- **THEN** the page SHALL say it did not happen
- **AND** it SHALL NOT describe the data as removed

#### Scenario: This device holds nothing

- **WHEN** the page is displayed and this device holds no address
- **THEN** it SHALL offer no removal
- **AND** it SHALL say nothing is kept on this device

#### Scenario: What the page knows is not yet established

- **WHEN** the page has not established whether this device holds an address
- **THEN** it SHALL NOT say that something is kept
- **AND** it SHALL NOT say that nothing is kept

#### Scenario: The page's account of its own storage is checked

- **WHEN** the page describes what it stores and where
- **THEN** it SHALL NOT describe that stored data as something it cannot delete
- **AND** any statement about removal SHALL match what the page offers

### Requirement: What the page reports about its storage survives a re-render during a write

The website's report of whether it holds an address SHALL be established by a **completed
write**, and SHALL NOT be withdrawn by a re-render, an inbox transition, or any other
state change occurring while that write is still in flight.

A page that has written a record and does not know it has written one is a page that
cannot offer the removal `website-client` requires of it, because the removal control is
reachable only from the knowledge that something is stored. **The two requirements are
one requirement in practice**, and the failure is invisible from the storage layer,
which behaved correctly.

**Note, recorded during apply (2026-10-05).** This requirement exists because the
requirement it protects shipped and was then measured false on the platform a user runs
on. The browser tier added by this change reported, verbatim,
`databases=["spectre-mail"] records=1 claimsStored=0 offersRemoval=0`: the record was
written, and the page did not know it.

The cause was a guard that conflated two different things. It existed to prevent a
`setState` after unmount, and it was scoped to a single effect **invocation** rather than
to the component — so the effect's own cleanup, run when the inbox published a new state
object mid-write, withdrew the guard before the write resolved, and the success branch
that records the write as confirmed was skipped. Unmount is a property of the
component. A re-render is not an unmount.

#### Scenario: A re-render arrives while the write is still in flight

- **GIVEN** the page is writing the mailbox it holds and the write has not resolved
- **WHEN** the inbox publishes a state transition, re-rendering the page
- **THEN** the page SHALL still report holding the address once the write resolves
- **AND** it SHALL offer the removal `website-client` requires

#### Scenario: The page is asked to report before the write has finished

- **WHEN** the page has begun a write that has not resolved
- **THEN** it SHALL NOT report holding the address yet
- **AND** it SHALL report it once the write resolves, whatever else happened meanwhile

#### Scenario: The component is genuinely unmounted mid-write

- **WHEN** the page is torn down while a write is in flight
- **THEN** the resolved write SHALL NOT update state on a page that no longer exists
- **AND** the guard that achieves this SHALL NOT be withdrawn by a re-render

### Requirement: Deferred and recorded work is not reported as delivered

Where an implementation reveals that an approved requirement is not met, the change
SHALL record that requirement as **not met**, with the measurement that shows it, and
SHALL NOT present the surrounding work as though the requirement were satisfied.

An unmet requirement found during implementation is not an inconvenience to be absorbed
into the change's own success. It is the most valuable thing an implementation stage can
find, and recording it as a note inside a green result is the one treatment that loses
it.

#### Scenario: A requirement is found unmet during implementation

- **GIVEN** an approved requirement the change's own verification exercises
- **WHEN** that verification finds the requirement is not met
- **THEN** the requirement SHALL be recorded as not met, with the measurement
- **AND** the change's plan SHALL be amended rather than the requirement worked around

#### Scenario: The requirement is met after the repair

- **WHEN** the defect is repaired
- **THEN** a check SHALL observe the repaired behaviour on the platform the user runs on
- **AND** it SHALL be a check that would have failed before the repair

#### Scenario: A substitute platform hid the defect

- **GIVEN** a property asserted only against a substitute for the platform users run on
- **WHEN** the property is exercised on the platform itself
- **THEN** a disagreement SHALL be recorded as a defect in the product
- **AND** it SHALL NOT be dismissed as a difference between the substitute and the
        platform

#### Scenario: The substitute is what was wrong

- **WHEN** the platform's behaviour and the substitute's disagree
- **THEN** the platform's behaviour SHALL be the one treated as correct
- **AND** the substitute SHALL NOT be carried forward as the thing that was verified

### Requirement: The page's limits are stated in its footer

The list of what the page can and cannot do SHALL be rendered in the page's footer rather than
in a region between the product and the end of the page, and SHALL keep its current content:
which provider it reaches, what it does with messages, that it does not copy codes or follow
links, and that no server is involved. The footer SHALL state the same facts, and SHALL NOT
drop a limit to make room for a section.

**Note, recorded during proposal (2026-10-06).** The limits list is **not** being removed or
shortened, and this requirement says so in terms that can be checked rather than in terms that
can be admired. Its four bullets are each a measurement or a promoted requirement: the provider
is the measured CORS one from `provider-config.ts`, the code-and-link sentence is `website-
client`'s own *"This slice shows what it found and does not act on it"*, and the no-server
sentence is the architecture rule that SpectreMail never proxies a provider. Moving them to a
footer is a placement change; the claims travel with them intact.

The reason the placement changes at all is that the list reads as an apology in the middle of
a page. As a footer it reads as a specification, which is what it is.

#### Scenario: The limits are read

- **WHEN** a visitor reads the page's footer
- **THEN** it SHALL state which provider the page reaches and that no other
- **AND** it SHALL state that the page does not copy codes or follow links
- **AND** it SHALL state that no server is involved and no provider request is relayed

#### Scenario: A section needs the space

- **WHEN** a section is added to the page
- **THEN** no limit SHALL be dropped from the footer
- **AND** no limit SHALL be reworded into something the product cannot support

#### Scenario: The storage claim is placed

- **WHEN** the footer states what this device keeps
- **THEN** it SHALL point to the region that offers the removal control
- **AND** it SHALL NOT restate a guarantee about storage that the region itself owns
