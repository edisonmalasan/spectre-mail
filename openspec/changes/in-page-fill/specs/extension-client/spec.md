# Spec Delta

Amends two of `extension-client`'s six requirements and adds none.

The first amendment is the one this capability's own text asks for: its *"A later milestone adds a
declared surface"* scenario requires the milestone that adds a forbidden surface to amend the
requirement rather than delete the assertion, and the one-time-code fill control is that surface.

The second is the popup's mailbox section, which currently reports a **count** and discards
everything else about what it found.

## MODIFIED Requirements

### Requirement: The extension declares its non-goals as requirements rather than leaving them absent

The extension SHALL NOT declare a side panel, a notification, a one-time-code copy control, or a
verification-link control in this milestone, and each absence SHALL be asserted. A declared surface
that renders nothing or acts on nothing is fake UI, which this product does not ship: the side
panel belongs to the side-panel milestone and the verification workflow to the workflow
milestone.

An absence that is merely an omission reads as an oversight and is eventually filled in by
whatever change touches the file next. Asserting it makes the boundary deliberate, and makes the
milestone that does own the surface the only one that may add it.

**Amendment, recorded at proposal (2026-10-07), by `in-page-address`.** The content script is no
longer on this list. This requirement's own second scenario required the in-page milestone to amend
this text rather than delete the assertion, and this is that amendment: **the content script comes
out and everything else stays on**, because the side panel, the notification and the verification
controls are still milestones that have not run. The assertion survives in the form that matters —
each remaining absence is still declared, and still asserted.

**The second scenario was generalised, and that is a change worth naming.** It read *"WHEN the
in-page milestone adds a content script"*, which described one event that has now happened and
therefore guards nothing afterwards. It now names the class of event, so the rule keeps applying to
the surfaces still on the list.

**Amendment, recorded at proposal (2026-10-10), by `in-page-fill`.** **The one-time-code fill
control comes off this list, and the one-time-code *copy* control stays on it.** That split is
deliberate and is the reason this amendment is not simply "the verification controls come off":
this change fills a code into a field and nothing else, so removing the whole phrase would leave
the extension declaring an absence that is no longer true — a control this product does not ship
described as forbidden, which is the same stale claim in the opposite direction. The remaining
three absences are still milestones that have not run, and each is still declared and still
asserted.

**The manifest clause of the first scenario becomes load-bearing rather than incidental.** It
already read *"it SHALL request no permission that no shipped surface uses"*, and this change ships
a surface that reaches a page it holds no permission for. That is only consistent because the
delivery needs no permission at all: `design.md` D1 records the measurement, and the scenario fails
if a later change answers the reach question by adding a permission instead.

#### Scenario: The manifest is read

- **WHEN** the extension's manifest is read
- **THEN** it SHALL declare no side panel
- **AND** it SHALL declare the content script its in-page surface needs
- **AND** it SHALL request no permission that no shipped surface uses

#### Scenario: A later milestone adds a declared surface

- **WHEN** a milestone adds a surface this requirement forbids
- **THEN** it SHALL amend this requirement in its own change rather than deleting the assertion

### Requirement: The extension's popup performs its first milestone's actions over the shared session

The extension's popup SHALL create a mailbox, copy the mailbox address, name the provider it used,
report the provider's status, show the messages in the mailbox rather than only how many there are,
and show the one-time codes detected in a message the user opened — and each SHALL be performed
through the shared mailbox session rather than by the popup's own logic. The listing SHALL come from
an explicit check the user asked for, because no background polling exists in this milestone.

**The popup SHALL NOT indicate that a message carries a verification until it has opened that
message.** A listing carries no detection, by construction rather than by omission:
`packages/core` states that codes and links are absent from a message summary *"on purpose: listing
a mailbox must not require fetching bodies"*. So the count the popup showed before is the whole of
what a listing can support, and a marker the listing cannot carry would be a guess about a message
nobody has read.

**Opening a message SHALL be the only way a code becomes available, and it SHALL cost a provider
request only while this session has not already analysed that message.** The shared session retains
the analysis of a message it has opened, which is what makes a second visit to the same message
free; a popup that opened every message in a listing to discover which one carried a code would
spend a provider request per message to learn something the listing structurally cannot say.

**The popup SHALL report what the page answered, and SHALL NOT report a code as filled when no page
confirmed it.** The page the code was sent to is somebody else's document, and a delivery this
extension could not confirm is not a delivery.

The popup SHALL NOT offer a provider selector. The extension reaches two providers, so a selector
becomes meaningful here in a way it is not on the website — but at this milestone choosing is not a
user action, it is a disclosure, and a control that can only report which provider answered is a
control that cannot act. The popup names the provider and, where a fallback occurred, names the
one it fell back from.

#### Scenario: The popup is opened

- **WHEN** a user opens the popup
- **THEN** it SHALL offer to create a mailbox, and SHALL name the provider it will reach
- **AND** it SHALL NOT offer a control for choosing a provider

#### Scenario: A mailbox exists

- **WHEN** the popup holds a mailbox
- **THEN** it SHALL offer to copy the address
- **AND** it SHALL show the provider that mailbox belongs to
- **AND** it SHALL show a count of messages obtained from a check the user asked for

#### Scenario: The provider is failing

- **WHEN** the popup asks the shared session for provider status
- **THEN** it SHALL render what the session reports
- **AND** it SHALL NOT render a status it computed itself

#### Scenario: A check has listed messages

- **WHEN** a check the user asked for returned messages
- **THEN** the popup SHALL render those messages
- **AND** it SHALL NOT indicate that any of them carries a verification

#### Scenario: A message is opened

- **WHEN** the user opens a listed message and it carries a one-time code
- **THEN** the popup SHALL render that code
- **AND** it SHALL offer a control that puts that code into the open page's one-time-code field

#### Scenario: A message is opened a second time

- **WHEN** the user opens a message this session has already opened
- **THEN** the popup SHALL render its codes
- **AND** no provider request SHALL be made to obtain them

#### Scenario: The page does not confirm

- **WHEN** a code was sent to a page and no page confirmed it
- **THEN** the popup SHALL report that it could not confirm the code was filled
- **AND** it SHALL NOT report the code as filled
