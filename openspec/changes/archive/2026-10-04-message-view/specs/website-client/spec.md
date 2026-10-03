# Spec Delta

## ADDED Requirements

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