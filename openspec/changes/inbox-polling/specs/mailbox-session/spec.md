# Spec Delta

## ADDED Requirements

### Requirement: The session polls the current mailbox for messages

While a mailbox exists, the session SHALL offer to list its messages on a cadence,
and the caller SHALL be able to read the latest listing together with the mailbox
it belongs to. The session SHALL NOT poll when no mailbox exists, and SHALL NOT
continue polling a mailbox it no longer holds.

#### Scenario: A mailbox exists and a listing is requested

- **WHEN** the caller asks for the current listing
- **THEN** the session SHALL ask the provider that owns the mailbox, not another
- **AND** the result SHALL be the messages that provider reported

#### Scenario: No mailbox exists yet

- **WHEN** the caller asks for a listing before a mailbox has been created
- **THEN** the session SHALL report that there is nothing to list
- **AND** it SHALL NOT contact a provider to find out

#### Scenario: The mailbox is replaced

- **GIVEN** a mailbox was being polled
- **WHEN** a different mailbox is created
- **THEN** the previous mailbox's listing SHALL no longer be reported
- **AND** no request SHALL be made on behalf of the previous mailbox

### Requirement: The polling cadence is a stated choice, not an inferred limit

The session SHALL poll promptly while a mailbox's contents are changing and SHALL
reduce its frequency while they are not, up to a stated ceiling. It SHALL return to
the prompt interval as soon as anything changes. The session SHALL declare the
interval it is using as a named, exported value, SHALL hand that interval to the
caller's scheduler rather than choosing it silently, and SHALL NOT present it as a
rate the provider permits.

**Amended during the M5 slice 2 verification pass.** The clause originally read "SHALL
state the interval it is using", which is ambiguous between *stating it to its caller*
and *showing it to the user*. Those are different requirements, and they point in
opposite directions: `website-client` forbids the page displaying any interval at all.
The implementation states it in the first sense — the interval is an exported constant
whose rationale is documented, and the session passes it to the caller's scheduler —
and the amended wording above names both halves rather than leaving a reader to guess
which one was meant.

**Note, recorded during proposal.** No provider limit was measured for the provider
this website can reach: `docs/PROVIDERS.md` records Mail.tm's `GET /messages` at
`30; w=60` **measured unauthenticated only**, and Mail.tm is unreachable from a web
page in any case, while Guerrilla Mail publishes no limit and none was measured. The
interval here is therefore a product choice, and saying so in the requirement is the
point — a cadence presented as provider-sanctioned would be a number the product
invented and could not defend.

#### Scenario: Mail keeps arriving

- **GIVEN** a listing has changed since the previous check
- **WHEN** the next interval is chosen
- **THEN** the session SHALL use its prompt interval

#### Scenario: The inbox has been quiet

- **GIVEN** consecutive listings have not changed
- **WHEN** the next interval is chosen
- **THEN** the session SHALL lengthen the interval
- **AND** it SHALL NOT exceed the stated ceiling

#### Scenario: Something arrives after a quiet period

- **GIVEN** the interval had backed off to its ceiling
- **WHEN** a listing changes
- **THEN** the session SHALL return to the prompt interval immediately
- **AND** it SHALL NOT wait out the remaining backoff

### Requirement: A stated rate limit is obeyed and never converted into a schedule

When a provider states a rate limit or a retry delay, the session SHALL report that
statement verbatim and SHALL NOT schedule a request sooner than it allows. When a
provider states nothing, the session's own stated interval applies. A refused
request SHALL be reported rather than silently retried.

#### Scenario: The provider states a rate limit

- **WHEN** a response carries a rate-limit statement
- **THEN** the session SHALL report it unchanged
- **AND** the session SHALL NOT read a scope into it, such as what it is counted per

#### Scenario: The provider states nothing

- **WHEN** no rate-limit statement accompanies a response
- **THEN** the session's own stated interval SHALL continue to apply
- **AND** the session SHALL NOT conclude that no limit exists

#### Scenario: A request is refused as throttled

- **WHEN** a listing is refused because the provider is throttling
- **THEN** the failure SHALL be reported to the caller
- **AND** it SHALL NOT be retried without the caller asking again

### Requirement: Polling follows what the caller can see

The caller SHALL be able to tell the session whether anything is currently
displaying the inbox. The session SHALL NOT poll while the caller reports nothing is
displaying it, and SHALL resume when told the inbox is visible again.

#### Scenario: Nothing is displaying the inbox

- **WHEN** the caller reports that the inbox is not being displayed
- **THEN** the session SHALL make no listing request
- **AND** it SHALL NOT schedule one

#### Scenario: The inbox becomes visible again

- **WHEN** the caller reports the inbox is visible
- **THEN** the session SHALL check for a listing without waiting out a previous
  quiet-period interval

### Requirement: A message is analysed once, and only when it is new

The session SHALL determine whether a message carries a verification by reading that
message, and SHALL remember that verdict against the message so it is never
determined twice for the same message. Listing a mailbox SHALL NOT require reading
messages that a previous listing already covered.

#### Scenario: A message appears that has not been seen

- **WHEN** a listing reports a message the session has not determined before
- **THEN** the session SHALL read that message once
- **AND** it SHALL report whether a verification was found

#### Scenario: A message reappears in a later listing

- **WHEN** a later listing reports a message already determined
- **THEN** the session SHALL NOT read it again
- **AND** it SHALL report the verdict it already holds

#### Scenario: Several messages arrive at once

- **WHEN** one listing reports several messages not previously seen
- **THEN** each SHALL be read at most once
- **AND** a message that could not be read SHALL be reported as undetermined rather
  than as carrying no verification

### Requirement: A failed check is not a lost mailbox

When a listing fails, the session SHALL report the failure as a condition of the
inbox and SHALL continue to report the mailbox itself, unchanged and usable. A
failed listing SHALL NOT be reported as an empty inbox.

#### Scenario: The listing request fails

- **WHEN** listing the mailbox's messages fails
- **THEN** the session SHALL still report the mailbox
- **AND** it SHALL report the failure as a condition of the inbox

#### Scenario: The provider returns nothing at all

- **WHEN** a listing returns no messages
- **THEN** the session SHALL report an inbox with no messages
- **AND** it SHALL NOT report that as a failure

### Requirement: The session is given its clock, and reaches no timer itself

The session SHALL obtain the passage of time and any scheduling primitive from its
caller, and SHALL NOT read a clock, a timer, or a global of any kind for itself.
The caller SHALL be able to run a session without any real time passing.

**Note, recorded during the M5 slice 1 verification pass.** `packages/mailbox`'s
`tsconfig` omits the `DOM` lib, which rejects `window`, `document`, and `location`
at compile time. It does **not** reject a timer: `@types/node` declares `setTimeout`
in exactly the way it declares `navigator`, which that pass measured. So the missing
`DOM` lib cannot be relied on to keep a scheduler out of this package, and the
injected clock is what actually does it.

#### Scenario: The session runs with no real time passing

- **WHEN** the session is driven by a caller supplying the scheduler
- **THEN** it SHALL schedule and observe intervals without waiting for them
- **AND** the caller SHALL determine every instant of the sequence: the session asks
  what time it is not at all, so the caller states what has elapsed by choosing when
  to honour each scheduled delay

**Amended during the M5 slice 2 verification pass.** The second clause originally read
"the caller SHALL be able to state exactly what time it is at every step", which
assumed the seam carried `now()`. `design.md`'s D2 records the narrowing to a
scheduler-only seam, so the session holds no notion of the current instant and there is
nothing for the caller to state. The amended wording keeps the requirement's actual
intent — the caller controls the sequence completely — and states it in terms the
implementation has. This is the one clause in the delta that a reader following D2
could not have predicted, so the reason is recorded rather than left implicit.

#### Scenario: The session reaches for a timer of its own

- **WHEN** the session's sources are scanned for a clock or timer global
- **THEN** none SHALL be found