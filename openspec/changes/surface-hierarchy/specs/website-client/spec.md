# Spec Delta

## MODIFIED Requirements

### Requirement: The address is presented as text the user can take

The address SHALL be rendered as selectable text in a form that identifies it as
an address, and the website SHALL offer a way to place it on the clipboard. If the
clipboard cannot be written, the website SHALL say so rather than appear to have
succeeded.

Where the surface is narrower than the address, the address SHALL break at its `@` rather than
inside its local part or inside its domain, and the break opportunity SHALL NOT insert a
character into the value the user takes.

**Amendment, recorded during proposal (2026-10-28), by `surface-hierarchy`.** Measured on the built
page at 390 px: the address rendered as `randomuser123456@sharklasers.c` / `om`. The cause is not the
string — `.address__value` was `display: inline-block`, so it shrank to its content and then broke at
the container's edge under `overflow-wrap: anywhere`. **A domain split across two lines is a domain a
person copies wrong**, which is why the break is required rather than preferred.

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

#### Scenario: The address is wider than the surface

- **WHEN** the surface is narrower than the address
- **THEN** the address SHALL break at its `@`
- **AND** the domain SHALL remain on one line where it fits
- **AND** the text the user takes SHALL be the address with nothing inserted and nothing removed

### Requirement: The inbox lists the current mailbox's messages

The website SHALL present the current mailbox's messages as a list, and each row
SHALL show the sender, the subject, when it arrived, and whether the provider
reported it unread. A message with an empty subject or an empty sender SHALL still
be listed.

A row SHALL take the width of the list it is in. The measure that caps a line of prose SHALL NOT
cap a row of fields.

**Note, recorded during proposal.** The empty-field rule is not defensive
programming, it is a measurement: a real Guerrilla message arrived with an empty
subject while its sender and body were present (`docs/PROVIDERS.md`, run
`2026-10-01T18-08-41-251Z`). A list row that hid such a message would hide the very
mail this product exists to deliver.

**Amendment, recorded during proposal (2026-10-28), by `surface-hierarchy`.** The design record says
two things three sentences apart: that paragraphs and list items cap at 62 characters, and that the
inbox row is its own two-column grid. Both are true of the shipped page and they collide — a row
**is** a list item. Measured, the row was 534.75 px inside a 688 px list, and the timestamp column
took 169 px of it, which is 32 % of the row for one verbatim ISO instant. **A measure caps a line of
text; a row of fields is not a line of text**, so the measure keeps every subject it has and loses the
one it was never written for. The instant stays verbatim, because `InboxRow.tsx` records that an ISO
instant is unambiguous in every locale and is what lets a row's contents be asserted without pinning
one.

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

#### Scenario: A row spans its list

- **WHEN** the inbox lists a message
- **THEN** the row SHALL occupy the full width of the list
- **AND** the prose measure SHALL NOT constrain it
