# Spec Delta

## ADDED Requirements

### Requirement: Opening a message is a state, not a flag

While a mailbox holds messages, the session SHALL report what is open — nothing,
opening, opened, or a failure to open — and a caller SHALL be able to ask for any
message in the current listing to be opened. The session SHALL hold this on its own
state rather than leaving a caller to pair a selected identifier with a result of its
own, so that a mailbox change cannot leave one mailbox's message on screen beside
another mailbox's address.

#### Scenario: Nothing is open

- **WHEN** a mailbox has been listed and no message has been asked for
- **THEN** the session SHALL report that nothing is open

#### Scenario: A message is opened

- **WHEN** the caller asks for a message in the current listing
- **THEN** the session SHALL report that the message is being opened before the
  provider has answered
- **AND** it SHALL report the opened message once the read has succeeded

#### Scenario: The mailbox is replaced while a message is open

- **GIVEN** a message was open
- **WHEN** a different mailbox is created
- **THEN** the session SHALL report that nothing is open
- **AND** the previously opened message SHALL NOT be reported for the new mailbox

### Requirement: A message already read is not read again

The session SHALL retain what it learned when it read a message for the inbox's
verdict, and SHALL open a retained message without asking the provider for it again.
The retention SHALL be limited to the messages of the current listing, so it cannot
grow for as long as a session lives, and SHALL be discarded when the mailbox is
replaced. A message the session has not retained SHALL be fetched and analysed when it
is asked for.

**Note, recorded during proposal.** Detection is deterministic — `mail-parsing`
guarantees the same body always yields the same codes, links, and confidences — so a
second read of a message already in memory has no correctness benefit at all and costs
one provider request. Retention is bounded to the listing rather than kept forever,
because a verdict is cheap and idempotent while a body is neither; the inbox's verdict
cache remains sticky and only the expensive part is shed.

#### Scenario: A message the session already read

- **GIVEN** a message the session read while producing the inbox's verdict
- **WHEN** the caller asks for that message to be opened
- **THEN** the session SHALL report it without asking the provider for it again

#### Scenario: A message the session has not read

- **GIVEN** a message the session has no retained reading of
- **WHEN** the caller asks for it to be opened
- **THEN** the session SHALL read it from the provider that owns the mailbox

#### Scenario: A message is no longer in the listing

- **GIVEN** a retained reading of a message the current listing no longer contains
- **WHEN** the next listing arrives
- **THEN** the retained reading SHALL be discarded
- **AND** the inbox's verdict for it SHALL be kept

### Requirement: A message that cannot be read is not an empty message

A read that fails SHALL be reported as a failure carrying a normalized code, and SHALL
never be reported as a message that was opened and held nothing. Where a message was
previously unreadable, a later request to open it SHALL attempt the read again rather
than refusing on the strength of the earlier failure.

#### Scenario: The provider refuses to return the message

- **WHEN** the provider cannot return a message the caller asked for
- **THEN** the session SHALL report the failure with a normalized code
- **AND** the session SHALL NOT report an opened message with nothing in it

#### Scenario: A message was unreadable and is then readable

- **GIVEN** an earlier attempt to read a message failed
- **WHEN** the caller asks for that message again
- **THEN** the session SHALL attempt the read again
- **AND** it SHALL report the message if this read succeeds

### Requirement: An identifier the listing does not contain is refused locally

A request to open an identifier that is not in the current listing SHALL be refused with
`MESSAGE_NOT_FOUND` without contacting any provider, because the session cannot know
that such an identifier belongs to the mailbox it is holding.

#### Scenario: An unknown identifier is asked for

- **WHEN** the caller asks to open an identifier the current listing does not contain
- **THEN** the session SHALL report `MESSAGE_NOT_FOUND`
- **AND** no provider SHALL be contacted

### Requirement: An opened message is readable text and detections, not a body

The session SHALL report an opened message as the fields a listing already carries,
the message's readable text, and the codes and links found in it, using the shared
model's own code and link types. It SHALL NOT report the message body as received, and
SHALL provide no field a renderer could mistake for markup to interpret.

**Note, recorded during proposal.** This is why the opened message is its own type
rather than the model's `Message` with `text` replaced. `Message.text` is documented as
the body as received, and that body **is** an HTML document in the one measured case:
Guerrilla declared a plain-text content type and delivered an HTML body (`docs/
PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`). Naming the extracted text `readable`
is the property that makes the safe path the only one available.

#### Scenario: A message is opened

- **WHEN** a message is opened successfully
- **THEN** its readable text SHALL be markup-free
- **AND** its codes and links SHALL be the shared model's code and link types
- **AND** no field SHALL carry the body as received

### Requirement: The session reaches no network directly to open a message

Reading a message SHALL go through the provider that owns the mailbox, and the session
SHALL reach no network itself on this path. This SHALL hold for the retained case as
well as the fetched one: a path that costs no request because it does not need one is
still a path through the abstraction.

#### Scenario: The opened path is inspected for a request

- **WHEN** the session's sources are scanned for a reach for the global `fetch`
- **THEN** none SHALL be found
- **AND** every provider call on this path SHALL go through an injected `MailProvider`

#### Scenario: A retained message is opened

- **WHEN** a message the session already read is opened
- **THEN** no provider SHALL be contacted