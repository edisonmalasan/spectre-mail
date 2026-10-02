# Spec Delta

## ADDED Requirements

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