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
it SHALL NOT read or write storage, cookies, or the URL.

**Note, recorded during proposal.** This is the requirement that decides where
the layer lives. The roadmap's shared-package list assigns "mailbox lifecycle"
and "mailbox manager" to `packages/core`, but `shared-domain-model`'s approved
purpose states it describes "the model and its invariants only" and excludes
lifecycle behaviour. A roadmap is a plan; an approved spec is a contract. Where
they disagree the contract wins, so the behaviour goes in its own package rather
than quietly widening `packages/core` from a type surface into a runtime one.

#### Scenario: The package is imported without a browser

- **WHEN** the session layer's test suite runs
- **THEN** it SHALL pass in an environment with no DOM and no rendering framework
- **AND** no test SHALL require a browser, a network, or a provider

#### Scenario: A reload loses the session

- **GIVEN** a mailbox was created
- **WHEN** the client is reloaded
- **THEN** the session SHALL NOT claim to have recovered that mailbox
- **AND** it SHALL open a new one or report none

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
*Provenance: slice 1 promoted 7 requirements and 14 scenarios; slice 2 (`inbox-polling`)
promoted 7 more with 18 scenarios, for 14 requirements and 32 scenarios. Every
requirement title and scenario title in the delta survived the merge, checked
mechanically rather than by reading — a manual merge is exactly where a scenario
quietly disappears.*

*Two requirements carry amendment or retitling notes from slice 2's verification pass.
Both are kept rather than tidied away. The cadence requirement's "SHALL state the
interval" was ambiguous between stating it to the caller and showing it to the user,
and those point in opposite directions because the website forbids displaying any
interval. The scheduler requirement assumed a `now()` the seam no longer has, and its
title named that absent capability. A spec that has been quietly reinterpreted is worse
than one that says it was.*