# mailbox-session Specification

## Purpose

Turns the provider abstraction into the sequence a client actually performs —
creating a mailbox, replacing it, asking whether its provider is answering — so
that two clients can share one implementation instead of each writing their own
and diverging.

*Provenance: the first paragraph is the change delta's `## Purpose`, copied
verbatim. The rest was added at the sync stage, 2026-10-02, after the verification
pass showed that reading this capability as pure behaviour would understate it.*

This capability specifies the session's observable contract and nothing about how
it is built. Where it constrains the implementation — no framework, no DOM, no
storage, no transport, no second provider — the constraint is itself part of what
another client may rely on, because it is what lets the extension adopt this
package without a rewrite. Those limits are therefore requirements here rather
than implementation notes in a design document.

**One of those limits is not enforced the way a reader would assume, and the
difference is measured rather than asserted.** Removing the `DOM` lib from the
package's `tsconfig` makes `window`, `document`, and `location` fail to
*compile*. It does **not** reject `navigator`, `localStorage`, or
`sessionStorage` — `@types/node` declares all three and `"types": []` does not
exclude them — and Node v26 additionally *defines* `navigator` and
`sessionStorage` at runtime. So "no DOM" is a compiler guarantee and "no storage"
is not; the storage half rests entirely on an explicit boundary rule. A session
layer that quietly persisted itself through `localStorage` would have compiled,
typechecked, linted, and passed every other rule in this repository.

## Requirements

### Requirement: A mailbox is created through the provider abstraction

The session layer SHALL obtain every mailbox from the configured provider manager
and SHALL NOT construct a mailbox itself, derive its address, or hold a provider's
session token in any form the provider abstraction does not already expose.

#### Scenario: A session is opened

- **WHEN** a client opens a session
- **THEN** the mailbox it reports SHALL be one the provider manager returned
- **AND** the session SHALL NOT have synthesised an address, an identifier, or a
  creation time

#### Scenario: No provider is configured

- **WHEN** a session is opened with no provider available
- **THEN** the session SHALL report a failure
- **AND** it SHALL NOT report a mailbox that does not exist

### Requirement: The session layer holds no framework, DOM, or storage state

The session layer SHALL be usable without a UI framework, without a DOM, and
without any persistence mechanism. It SHALL NOT import a rendering library, and
it SHALL NOT read or write storage, cookies, or the URL. It MAY be handed a
previously stored mailbox **as a value**, and SHALL treat it as untrusted input
rather than as one of its own.

**Note, recorded during proposal.** This is the requirement that decides where
the layer lives. The roadmap's shared-package list assigns "mailbox lifecycle"
and "mailbox manager" to `packages/core`, but `shared-domain-model`'s approved
purpose states it describes "the model and its invariants only" and excludes
lifecycle behaviour. A roadmap is a plan; an approved spec is a contract. Where
they disagree the contract wins, so the behaviour goes in its own package rather
than quietly widening `packages/core` from a type surface into a runtime one.

**Amendment, recorded during proposal (2026-10-05).** The first sentence of the
requirement now says the layer may be handed a stored mailbox as a value. It did
not need to before, because nothing recovered one. What it must **not** become is
a requirement to reach storage: the value arrives from whoever asked for it, and
the second sentence is unchanged so that remains true. This amendment was written
into this delta rather than left for the sync stage, because `openspec/specs/` is
the source of truth for what is required and the archived delta is the record of
what this change asked for — a gap between the two is an amendment recorded in the
wrong artifact.

#### Scenario: The package is imported without a browser

- **WHEN** the session layer's test suite runs
- **THEN** it SHALL pass in an environment with no DOM and no rendering framework
- **AND** no test SHALL require a browser, a network, or a provider

#### Scenario: A reload loses the session

- **GIVEN** a mailbox was created
- **WHEN** the client is reloaded and the session is handed nothing
- **THEN** the session SHALL NOT claim to have recovered that mailbox
- **AND** it SHALL open a new one or report none

**Amendment to this scenario, recorded during proposal (2026-10-05).** The
scenario's title is unchanged and deliberately so: it is still true, and it is
true of the case that matters most. What changed is the **GIVEN**, which now says
the session is handed nothing. That is the real shape of the condition — the
session layer cannot lose a mailbox it was never given, and a scenario phrased
only in terms of a reload reads as though reload were the cause. The cause is that
nobody offers a stored mailbox.

This is the scenario `design.md` D9 deferred rather than let go: adopting a stored
mailbox makes the unqualified form false, and an amendment recorded here means the
archive carries the reason it was false.

#### Scenario: A stored mailbox arrives as a value

- **WHEN** a caller hands the session a mailbox read from storage
- **THEN** the session SHALL accept it without reading or writing storage itself
- **AND** the session's own sources SHALL contain no storage API

### Requirement: The session layer reaches no network directly

Every provider request SHALL be made by the provider adapter. The session layer
SHALL NOT perform a request, construct a URL, or read a response body, and it
SHALL NOT be given a transport.

#### Scenario: The package is inspected for a request

- **WHEN** the session layer's sources are scanned for a request primitive
- **THEN** none SHALL be found

### Requirement: Provider health is reported, never inferred

The session SHALL report provider health as the provider states it, and SHALL NOT
derive a status, a rate-limit scope, or an expiry from elapsed time, a documented
limit, or the absence of an answer.

#### Scenario: The provider answers its own health question

- **WHEN** health is requested and the provider reports a status
- **THEN** the session SHALL report that provider's status unchanged

#### Scenario: The provider sends a rate-limit header

- **WHEN** the provider reports health with a rate limit
- **THEN** the session SHALL report that value verbatim
- **AND** it SHALL NOT state what the limit is counted per

#### Scenario: Health is requested before any mailbox exists

- **WHEN** health is requested and no mailbox has been created
- **THEN** the session SHALL report the provider's own status
- **AND** it SHALL NOT report a state derived from a mailbox that does not exist

### Requirement: A failure is reported as a normalized code

Every failure the session reports SHALL carry one of the shared model's
normalized error codes, and SHALL retain the provider's own description. The
session SHALL NOT collapse a failure into a generic message that loses which
condition occurred.

#### Scenario: The provider refuses for rate-limit reasons

- **WHEN** creating a mailbox fails because the provider is throttled
- **THEN** the reported failure SHALL carry the rate-limited code
- **AND** it SHALL NOT be retried automatically

#### Scenario: Every configured provider fails

- **WHEN** mailbox creation fails for more than one configured provider
- **THEN** the reported failure SHALL identify each provider that failed
- **AND** with a single configured provider the reported failure SHALL be that
  provider's own failure rather than a wrapper around it

### Requirement: A mailbox belongs to one provider for life

A mailbox SHALL be read only through the provider that created it, and the
session SHALL NOT offer to serve a mailbox through any other provider or fall back
to one.

#### Scenario: A mailbox is read

- **WHEN** a client acts on a mailbox
- **THEN** the session SHALL route the call to the provider named by that mailbox

#### Scenario: The owning provider is not configured

- **WHEN** a mailbox names a provider this client did not configure
- **THEN** the session SHALL report that the mailbox cannot be served
- **AND** it SHALL NOT substitute another provider

### Requirement: Which providers a client offers is the client's decision

The session layer SHALL be configured with the providers its host can actually
reach and SHALL NOT add, discover, or probe a provider that was not configured.
The website's configuration and the extension's are separate, and the session
layer SHALL NOT assume either.

#### Scenario: A client is configured with one provider

- **WHEN** a session is opened
- **THEN** only the configured provider SHALL be offered
- **AND** no other provider SHALL be contacted, probed, or named as a fallback

#### Scenario: Two clients use different providers

- **GIVEN** one client configured with a single provider and another with two
- **WHEN** both open a session
- **THEN** each SHALL offer exactly the providers it was configured with
- **AND** neither SHALL inherit the other's

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

### Requirement: The session is given its scheduler, and reaches no timer itself

The session SHALL obtain every scheduling primitive from its caller, and SHALL NOT
read a clock, a timer, or a global of any kind for itself. The caller SHALL be able to
run a session without any real time passing.

**Retitled during the M5 slice 2 verification pass**, from "The session is given its
clock" — the seam carries no clock. `design.md`'s D2 records the narrowing to a
scheduler-only `MailboxScheduler { schedule }`, and a requirement whose title names a
capability the interface does not have is a requirement a reader will look for.

**Note, recorded during the M5 slice 1 verification pass.** `packages/mailbox`'s
`tsconfig` omits the `DOM` lib, which rejects `window`, `document`, and `location`
at compile time. It does **not** reject a timer: `@types/node` declares `setTimeout`
in exactly the way it declares `navigator`, which that pass measured. So the missing
`DOM` lib cannot be relied on to keep a scheduler out of this package, and the
injected scheduler is what actually does it.

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

#### Scenario: A message is closed

- **GIVEN** a message was open
- **WHEN** the caller asks for it to be closed
- **THEN** the session SHALL report that nothing is open
- **AND** asking to close a message that was never open SHALL change nothing

#### Scenario: The session is discarded while a message is being read

- **GIVEN** a message is being opened and the provider has not yet answered
- **WHEN** the session is destroyed
- **THEN** the read SHALL resolve rather than hang or reject
- **AND** no opened message SHALL be published afterwards

#### Scenario: A message is open when a replacement mailbox begins

- **GIVEN** a message was open
- **WHEN** a replacement mailbox begins being created
- **THEN** the session SHALL report that nothing is open
- **AND** it SHALL do so from that transition, not only once the new mailbox is ready

**Amendment, recorded during apply (2026-10-03).** The proposal's first requirement
covered opening and mailbox replacement, and was silent on two behaviours the
implementation could not avoid:

- **Closing.** The client needs a way back, and `design.md` D5 puts it behind a button
  rather than a router. A "way back" with no requirement would be the one piece of this
  slice's navigation invented outside the delta.
- **A read in flight when the session is discarded.** Not a choice: a provider request
  already sent cannot be recalled, so the only real question is whether its late answer
  is published. `destroy()` already made this true for the inbox, and opening a message
  added a second request path that needed the same rule rather than its own.
- **Cleared at the start of the replacement, not the end.** The mailbox-replacement
  scenario above says the session reports nothing open once a different mailbox exists.
  Read literally that is satisfied by clearing at the end, which leaves the previous
  mailbox's message on screen for the whole duration of the request — a user who
  pressed "new address" would watch the old message sit there under the new one being
  created. The third scenario states the earlier moment the implementation actually
  clears at.

The implementation initially cleared at the end and cleared without notifying: `reset()`
set the tracker's internal state and never called `onChange`, so `closeMessage()` left
the session still reporting a message as open. That was found by a test reading the
*session's* state rather than the tracker's own, and `reset()` now publishes whenever
the reported state changes — and only then, so that a mailbox replacement does not emit
a transition whose value is the one already on screen.

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

#### Scenario: A listing fails

- **GIVEN** retained readings of the current listing
- **WHEN** a listing attempt fails
- **THEN** the retention SHALL NOT be pruned
- **AND** the retained readings SHALL still be openable without a provider request

**Amendment, recorded during apply (2026-10-03).** The scenario above says pruning
happens "when the next listing arrives", which does not say what happens when that
listing *fails*. The implementation prunes only on a successful one, and the reason is
that a failure teaches nothing: pruning against a listing that was never received would
shed every retained reading on a single transient provider error, so the next successful
check would re-read every message in the mailbox. That is the same request cost D2
exists to avoid, reached by a different route, and it would be invisible in every test
whose stub does not fail a listing on demand.

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

*Provenance: slice 1 promoted 7 requirements and 14 scenarios; slice 2 (`inbox-polling`)
promoted 7 more with 18 scenarios; slice 3 (`message-view`) promoted 6 more with 16
scenarios, for 20 requirements and 48 scenarios. Every requirement title and scenario
title in the delta survived the merge, checked mechanically rather than by reading
— a manual merge is exactly where a scenario quietly disappears.*

*Two requirements carry amendment or retitling notes from slice 2's verification pass.
Both are kept rather than tidied away. The cadence requirement's "SHALL state the
interval" was ambiguous between stating it to the caller and showing it to the user,
and those point in opposite directions because the website forbids displaying any
interval. The scheduler requirement assumed a `now()` the seam no longer has, and its
title named that absent capability. A spec that has been quietly reinterpreted is worse
than one that says it was.*

*Two requirements carry amendments recorded during slice 3's apply stage, and both are
kept in the promoted text rather than tidied into the requirement they qualify. The
first is `Opening a message is a state, not a flag`: the proposal's version was silent
on closing, on a read in flight when the session is discarded, and on when a replaced
mailbox's open message is cleared. Read literally, `WHEN a different mailbox is created`
is satisfied by clearing at the *end* of creation, which leaves the previous mailbox's
message on screen for the whole duration of the request — so the requirement now states
the earlier moment the implementation clears at. The second is `A message already read is
not read again`, whose scenario said pruning happens "when the next listing arrives"
without saying what a listing that *fails* does. The implementation prunes only on a
successful one, because a failure teaches nothing: pruning against a listing never
received would shed every retained reading on a single transient provider error, which is
the request cost the requirement exists to avoid reached by a different route.*

*The implementation of the first amendment initially cleared at the end and cleared
without notifying — `reset()` set the tracker's internal state and never called
`onChange`, so `closeMessage()` left the session still reporting a message as open. A test
reading the *session's* state rather than the tracker's own found it, and `reset()` now
publishes whenever the reported state changes, and only then, so a mailbox replacement
does not emit a transition whose value is already on screen. The same slice found the
tracker notifying twice per change by wrapping its publisher in a second `setState`, which
only an assertion about *how often* the session reports could see. Both are recorded here
because a spec that says only what the final code does would leave the defect invisible.*

*This spec now holds two requirements about the same rule on different paths: `The
session layer reaches no network directly` from slice 1, and `The session reaches no network
directly to open a message` from slice 3. They are not a duplicated requirement and neither
was retitled into the other, because the second exists for a reason the first could not
cover — opening a message has two paths, a retained one and a fetched one, and a path
that costs no request because it does not need one is still a path through the
abstraction. Reading them as one would drop that clause.*

### Requirement: A stored mailbox is adopted, never inferred

The session layer SHALL accept a stored mailbox only when a caller offers it one,
and SHALL NOT discover, guess, or reconstruct a mailbox on its own. It SHALL NOT
create a replacement mailbox on behalf of a caller that supplied one, and it SHALL
NOT report a mailbox as recovered that no caller supplied.

**Note, recorded during proposal.** The direction of travel here is the whole
point. A session that can find its own mailbox has storage, and a session that can
create its own replacement has decided what the user came back for. Both are the
failure this requirement names in advance: a restored address the user recognises,
quietly replaced by a different one, is worse than no recovery at all, because
the address is what they are about to paste into a third-party sign-up form.

The session is also where this is enforceable. If loading lived in the client, a
client that failed to read storage would reach for `open()` and no requirement
could tell the difference between a first visit and a failed recovery.

#### Scenario: The session is given a mailbox to adopt

- **WHEN** a caller hands the session a stored mailbox
- **THEN** the session SHALL attempt to adopt that mailbox
- **AND** it SHALL NOT create another mailbox instead

#### Scenario: The session is given nothing

- **WHEN** a caller hands the session no mailbox
- **THEN** the session SHALL create one when asked to
- **AND** it SHALL NOT present any address it did not receive from a provider

#### Scenario: Nothing is stored and no request has been made

- **WHEN** a session has been built and asked to do nothing yet
- **THEN** it SHALL report that it has not looked for anything
- **AND** it SHALL NOT report that it is creating a mailbox

### Requirement: An adopted mailbox is reconciled with its provider before it is presented

A stored mailbox SHALL be presented as the user's own only after the provider that
owns it has confirmed it, by a request that would fail for a mailbox the provider
no longer recognises. An empty inbox SHALL NOT count as that confirmation. A
mailbox the provider reports as gone SHALL be distinguishable from one that merely
could not be checked, and a stored mailbox SHALL NOT be discarded because a check
did not complete.

**Note, recorded during proposal.** This requirement exists because of a measured
provider behaviour, not a precaution. `docs/PROVIDERS.md` §3 records that an
unrecognised Guerrilla Mail session answers `HTTP 200` with an empty inbox and no
error, so "nothing has arrived" and "this address is gone" are the same response.
The provider adapter already tells them apart — it checks the session the response
carries — and this requirement exists so that a client cannot skip the check and
reach the same conclusion by looking at the message list.

That is why the confirmation has to be a *request*. Reading the stored record proves
only that this device once held a mailbox, which is not the same claim as that the
provider still has it.

The two failures are separate states rather than one state plus an error code
because they offer different things to the user. A mailbox the provider has dropped
cannot be retried into existence, so it offers a new address; one that could not be
checked may work on the next attempt, so it offers a retry. Making every client
compare an error code to recover that distinction would put the comparison in every
client instead of once.

#### Scenario: The provider confirms the mailbox

- **WHEN** the provider that owns a stored mailbox answers a request for it
- **THEN** the session SHALL present that mailbox as the user's own
- **AND** the inbox it reports SHALL be the inbox of that mailbox

#### Scenario: The provider answers with an empty inbox

- **WHEN** the provider reports no messages for a stored mailbox
- **THEN** the session SHALL NOT conclude from that alone that the mailbox is valid
- **AND** it SHALL rely on the provider's own account of the session

#### Scenario: The provider no longer recognises the mailbox

- **WHEN** the provider reports that a stored mailbox is gone
- **THEN** the session SHALL report that the address is gone
- **AND** it SHALL distinguish that from a check that did not complete

#### Scenario: The provider cannot be asked

- **WHEN** the request that would confirm a stored mailbox fails for any reason
- **THEN** the session SHALL report that it could not tell
- **AND** it SHALL NOT present the mailbox as confirmed
- **AND** it SHALL NOT discard what was stored

#### Scenario: Adoption is visible before it completes

- **WHEN** a caller hands the session a stored mailbox
- **THEN** the session SHALL report that it is checking it before the provider
      answers
- **AND** it SHALL NOT show an address it has not confirmed during that time
