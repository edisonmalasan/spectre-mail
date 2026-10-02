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

### Requirement: The website reaches Guerrilla Mail and no other provider

The website SHALL configure exactly one provider, Guerrilla Mail, and SHALL NOT
configure Mail.tm, offer it as a fallback, or probe for it.

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

### Requirement: The website creates a mailbox without asking

On load the website SHALL create a mailbox and present its address, without
requiring an account, a sign-up step, an email address of the user's own, or any
other information from the user.

#### Scenario: A first-time visitor arrives

- **WHEN** the website is opened for the first time on a device
- **THEN** a mailbox SHALL be created
- **AND** its address SHALL be presented
- **AND** no form SHALL have been required first

#### Scenario: Creation is still in progress

- **WHEN** the page has loaded but no mailbox has been created yet
- **THEN** the website SHALL say so
- **AND** it SHALL NOT display a placeholder address, an example address, or any
  address it did not receive from the provider

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

### Requirement: This milestone builds structure, not visual design

The website SHALL present a working page with correct structure, accessible names,
and states. It SHALL NOT apply the approved visual system, design tokens, or a
layout system, because the design milestone owns those and building them here
would produce markup that milestone rewrites.

#### Scenario: The page is built

- **WHEN** the website's production build runs
- **THEN** it SHALL build and serve
- **AND** the milestone SHALL NOT have introduced a design token or theme system

#### Scenario: Each state is reachable

- **WHEN** the page is in its creating, ready, or failed state
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
*Provenance: slice 1 promoted 7 requirements and 15 scenarios; slice 2
(`inbox-polling`) promoted 5 more with 12 scenarios, for 12 requirements and 27
scenarios. Every requirement title and scenario title in the delta survived the merge,
checked mechanically rather than by reading.*

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