## ADDED Requirements

### Requirement: A listing for a caller that displays nothing reads no message body

The shared session SHALL offer a listing that reports what a mailbox holds **without reading any
message body**, and that listing SHALL be the path a caller takes when nothing it produces is
displayed.

**The distinction is one of consumers rather than of effort.** A listing that renders rows needs each
message's verdict, and a verdict needs a body: the inbox tracker reads each id it has not already read
so the row can carry a word. **A caller that renders nothing cannot act on a verdict** — there is no
row, no label and no screen — so every body such a caller pays for is a request whose result it
discards.

**That was measured, and the measurement is a shape rather than a figure.** In Chromium on 2026-10-11,
a background wake listing a mailbox holding **one** message cost **two** provider requests — the
listing, and that message's body — and **a second wake over the same mailbox cost the same two**, so
the cost did not converge. The tracker remembers which bodies it has read only for the life of the
session it belongs to, and that session was built fresh for each wake; **every wake therefore re-read
every body the mailbox held, for as long as the extension was installed**. Against Mail.tm's
`GET /messages` budget of `30; w=60`, that is twenty-four requests a minute at one message and more
than the whole budget at two, and `docs/PROVIDERS.md` records that budget as **measured
unauthenticated only**, with the authenticated policy never separately measured.

**The caller that found it had no use for any of it.** `apps/web` is the only caller in this
repository that reads a verdict map, so every one of those requests bought the extension nothing.

**The listing this requirement adds SHALL go through the same reconciliation as any other**, so a
mailbox the provider reports gone is reported **gone** rather than as an empty inbox, and a throttled
provider is never reported as a mailbox that has gone.

**It SHALL be a second named entry point rather than an option on the listing that renders.** One
implementation with a flag reading `readVerdicts: false` would be a boolean every future caller has to
know the meaning of, at a call site with nothing to say what it is for; two names say it at the point
of use, and the shared reconciliation is reached by delegating rather than by reimplementing it — the
same reasoning `restore` gives for delegating the first visit to `open`.

#### Scenario: A caller that displays nothing lists a mailbox

- **WHEN** a caller asks the session for a listing it does not display
- **THEN** the session SHALL report the mailbox's message summaries
- **AND** it SHALL contact the provider once
- **AND** it SHALL read no message body

#### Scenario: The mailbox is gone

- **WHEN** the provider reports that mailbox gone while such a listing is taken
- **THEN** the session SHALL report the mailbox expired
- **AND** it SHALL NOT report it as an empty inbox

#### Scenario: The provider refuses the listing

- **WHEN** the provider refuses such a listing
- **THEN** the session SHALL report that it could not tell
- **AND** it SHALL NOT report the mailbox as gone

#### Scenario: A caller that displays the inbox asks for one

- **WHEN** a caller asks for a listing it does display
- **THEN** the session SHALL read the body of each message it has not already read
- **AND** the verdict map it reports SHALL hold a reading for each of them