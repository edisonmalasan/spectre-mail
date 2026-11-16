# Spec Delta

## ADDED Requirements

### Requirement: An opened message shows the message

When a message is opened, a surface of this client SHALL show that message's sender, subject,
arrival time and readable text, and SHALL present the codes and verification links detected in it
after those fields. The readable text SHALL be rendered as text and SHALL NOT be interpreted as
markup. Opening a message SHALL NOT gain a control the surface did not already offer.

**Note, recorded during proposal (2026-10-28), by `surface-hierarchy`.** No requirement in this
capability named a message's own fields. The closest said a person who opens a message SHALL see
*"the one-time codes detected in that message"*, and the shipped view satisfied it exactly while
showing **none** of the four fields: `OpenedMessage` extends `MessageSummary` and adds `readable`,
`codes` and `links`, and the view read `codes` and `links` and discarded `from`, `subject`,
`receivedAt` and `readable`. **A surface that satisfies its requirement while showing nobody the
message is the requirement's fault**, and that is why this is an addition rather than a restyle.

**One requirement and not three, because both surfaces render one component.** `MessageSurface.tsx`'s
`OpenedMessageView` serves the popup and the panel, so "a message shows its own fields" is one
sentence about one component. Amending the popup's and the panel's requirements instead would state
one claim three times, and a `MODIFIED` block replaces its whole requirement — which would make the
popup's requirement cover the sender as well as the code, and force it to carry *"opening a message
SHALL be the only way a code becomes available"* forward under a heading that no longer describes it.

**`readable` is rendered as text and nothing else.** `OpenedMessage`'s own doc block records that it
is markup-free by construction and that the body as received is retained nowhere, and this
capability's *"renders provider-supplied content as text"* already binds every surface. The view
gains no parser call, no `dangerouslySetInnerHTML` and no new dependency: the field it renders was
produced by the extraction the shared session already ran.

#### Scenario: A message is opened

- **WHEN** a person opens a message on a surface of this client
- **THEN** the surface SHALL show the message's sender, subject, arrival time and readable text
- **AND** it SHALL present the detected codes and verification links after those fields

#### Scenario: A message's text is rendered

- **WHEN** the message's readable text contains something that looks like markup
- **THEN** it SHALL be shown as text
- **AND** it SHALL NOT be interpreted as markup, a link, or a control

#### Scenario: An opened message arrived with no subject

- **WHEN** the message a person opened has an empty subject
- **THEN** the surface SHALL still show its sender and arrival time
- **AND** it SHALL NOT present the message as empty

#### Scenario: Every surface that opens a message

- **WHEN** the popup opens a message and the panel opens the same message
- **THEN** both SHALL show the same four fields
- **AND** neither SHALL gain a control the surface did not already offer

### Requirement: A message row is a row of fields, not a line of prose

Each message in a mail list of this client SHALL be a row that occupies the width of the list it is
in, SHALL carry no list marker, and SHALL set the sender, the subject, the time and the verdict as
distinct fields rather than as one wrapped line.

**Note, recorded during proposal (2026-10-28), by `surface-hierarchy`.** Measured on the built popup,
a message rendered as a bare `<li>` with no rule selecting it: `display: list-item`,
`list-style-type: disc`, 65 px wide. **A bullet beside a message is a marker that says the list is a
list and nothing about the message**, and at 65 px the row's four fields had no column to sit in — so
the time and the verdict had nowhere to go except after the subject on the same line, where a long
subject pushed them off the row.

**The verdict word gains a column, and it gains nothing else.** This capability already requires
that a row's marking not depend on colour alone, and `panel-verification-state` says in terms that
*"this requirement adds no accent rule"* — so the grid is what gives the marking a position, and the
marking keeps the plain ink it already had.

**Amendment, recorded during apply (2026-11-01), by `surface-hierarchy`.** The paragraph above said
*"the verdict word keeps its accent and gains a column"*, **and the first half is false**: the
extension's marking has never carried an accent, and the promoted requirement one capability over
says so explicitly. **The sentence was written from the website's row, where the unread state is
accented, and copied to a surface whose marking is a sentence in plain ink.** It is corrected rather
than deleted, because the grid's justification is the same claim either way and a reader comparing
the two rows should find the difference stated rather than discover it.

#### Scenario: A mailbox holds messages

- **WHEN** a surface lists the messages in a mailbox
- **THEN** each message SHALL be a row spanning the width of the list
- **AND** no row SHALL carry a list marker
- **AND** the sender, the subject, the time and the verdict SHALL each occupy their own field

#### Scenario: A subject is longer than its field

- **WHEN** a row's subject is longer than the field it sits in
- **THEN** the subject SHALL wrap inside its own field
- **AND** the time and the verdict SHALL stay in their own fields rather than follow the subject

### Requirement: A surface states its subject before its account of the session

A surface of this client SHALL present its own subject before any account of what happened during
the session, and SHALL offer a control that removes what this device holds after the content it
would remove.

**Note, recorded during proposal (2026-10-28), by `surface-hierarchy`.** Measured on the built
surfaces: the popup rendered the diagnostic report **first** — 234 px, on a surface already 863 px
tall in a 760 px viewport — and the address fourth, while the panel rendered the same component
**last** and `Panel.tsx` records why: *"it is the only section here that is about the session rather
than about the device or the page."* **One component, two placements, and the one that contradicts
the reason written for it is the surface a person opens to copy an address.**

Measured on the same surfaces, the mirror case: the panel's removal section was the third block of
six, above the inbox, headed *"What this device keeps"* over a control that lists nothing kept.
**A destructive control above the thing it would destroy is a control offered before a person has
seen what is at stake.**

**Both are one claim about order, which is why they are one requirement.** The account of a session
is about the session; every other region is about the thing the person came for, and the thing a
person came for comes first. The panel's report is already last and does not move.

#### Scenario: The popup reports an outcome

- **WHEN** the popup renders its account of what happened during the session
- **THEN** it SHALL follow the address, the inbox and any opened message
- **AND** it SHALL NOT precede the surface's own subject

#### Scenario: The panel reports an outcome

- **WHEN** the panel renders the same account
- **THEN** it SHALL follow the address, the inbox and any opened message

#### Scenario: The panel offers removal

- **WHEN** the panel offers to remove what this device holds
- **THEN** the control SHALL follow the inbox and any opened message
- **AND** it SHALL NOT precede the content it would remove

#### Scenario: A surface has nothing to report

- **WHEN** no account of the session can be rendered yet
- **THEN** the surface SHALL present its own subject first
- **AND** it SHALL NOT reserve the account's position with an empty region

### Requirement: A surface names a provider the way the provider names itself

A surface of this client SHALL name a provider by the display name the provider abstraction declares
for it. Where this build declares no display name for the provider a stored mailbox belongs to, the
surface SHALL name that provider by its identifier rather than rendering nothing or a placeholder.

**Note, recorded during proposal (2026-10-28), by `surface-hierarchy`.** The popup and the panel each
headed their address region with `mailbox.provider` and `record.provider` — **identifiers, not
names**: the built surfaces rendered `mailtm`. `panel-copy.ts`'s `addressHeading` documents itself as
*"it names the provider rather than this surface's own name"*, and it was handed an id; its own test
could not see it, because the fixture supplies `["Mail.tm", "Guerrilla Mail"]`, which is exactly the
shape production does not.

**The name already exists and the client must not restate it.** `MailProvider.displayName` is
declared in `packages/providers` and both adapters set it, and `primaryProviderName` reads it for the
create heading — *"one manager object supplies both halves, so this panel cannot be told one
provider's name while its session was handed another."* The reading this requirement makes explicit
is that the *same* rule holds for the mailbox's own provider, which is a different provider from the
one this client reaches first whenever the fallback served the mailbox.

**The fallback is stated rather than silent.** A stored mailbox outlives the build that recorded it,
and `SpectreStorage` keeps a record it cannot narrow rather than deleting it, so a mailbox whose
provider this build no longer offers must still be nameable — the identifier is the only thing left
to name it with.

#### Scenario: A surface names a provider this build offers

- **WHEN** a surface names the provider that served the mailbox it is showing
- **THEN** it SHALL render the display name the abstraction declares for that provider
- **AND** the name it renders SHALL be that value rather than the provider's identifier

#### Scenario: A stored mailbox names a provider this build does not offer

- **WHEN** a stored mailbox belongs to a provider no adapter in this build declares
- **THEN** the surface SHALL render that provider's identifier
- **AND** it SHALL NOT render nothing, an empty heading, or a placeholder

### Requirement: The address breaks at its `@` on a surface narrower than it

A surface of this client SHALL render the mailbox address as one selectable value, and where that
surface is narrower than the address, the address SHALL break at its `@` rather than inside its local
part or inside its domain. The break opportunity SHALL NOT insert a character into the value the
surface copies.

**Note, recorded during apply (2026-11-01), by `surface-hierarchy`.** Measured on the built popup: the
address box is **304 px** wide (`22rem` less `--space-5` on each side) and the recorded Guerrilla
address is **32 characters**, which at `--type-base`'s **16 px** is about **307 px** — so **the
shipped surface already broke inside the domain**, at a size *smaller* than the one this change gives
it. **This requirement was added during apply for that reason**: the defect is pre-existing, raising
the address to the headline step only makes it legible, and a change that enlarged an address without
requiring it to break correctly would have shipped a bigger version of the same fault. A domain split
across two lines is a domain a person copies wrong, and this is the surface whose whole purpose is
handing somebody an address.

**The website's requirement states the same rule, and the two are not one requirement.** The
website's *"The address is presented as text the user can take"* is about a page, and this client's
surfaces are two other documents with their own copy controls. **One sentence per client is this
repository's shape**, and the shared reading is in `visual-system`'s *"the address is the largest
datum on its surface"* rather than duplicated here.

**A `<wbr>` and not a zero-width space.** A `U+200B` in the string is a character in the value the
clipboard receives, and this repository has recorded what a substituted character costs: the address
a person pastes into a signup form must be the address the provider issued. `<wbr>` is a break
opportunity with no text node, so the copied value is byte-identical to the stored one — and
`AddressText` is one component so the popup and the panel cannot disagree about where the break goes.

#### Scenario: A surface is narrower than the address

- **WHEN** a surface renders an address wider than the space it has
- **THEN** the address SHALL break at its `@`
- **AND** the domain SHALL remain on one line where it fits
- **AND** the text the surface copies SHALL be the address with nothing inserted and nothing removed

#### Scenario: An address holds no `@`

- **WHEN** a surface renders a value that carries no `@`
- **THEN** it SHALL render the value whole
- **AND** it SHALL NOT break it at a position the value does not contain

#### Scenario: Both surfaces render the same address

- **WHEN** the popup and the panel render the same mailbox's address
- **THEN** both SHALL break it at the same position
- **AND** both SHALL copy the same value
