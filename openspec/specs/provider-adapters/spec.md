# provider-adapters Specification

## Purpose

Defines the provider layer: the single contract every temporary-mail provider is
reached through, the two adapters that implement it, how a provider's failures
become SpectreMail's closed error vocabulary, and the conformance suite that any
adapter — present or future — must pass.

## Requirements

### Requirement: Every provider is reached through one contract

SpectreMail SHALL expose a single mailbox contract that both providers implement.
No caller SHALL need to know which provider served it. The contract SHALL NOT
declare a push-transport subscription method.

#### Scenario: A client lists messages without knowing the provider

- **WHEN** a client asks a mailbox for its messages
- **THEN** it SHALL receive normalized message summaries regardless of which
  provider created the mailbox
- **AND** it SHALL NOT need to branch on the provider

#### Scenario: A provider offers no push transport

- **GIVEN** a provider that advertises an event-stream transport but serves none
- **WHEN** the contract is declared
- **THEN** it SHALL NOT include a subscription method
- **AND** messages SHALL arrive by the caller polling
- **AND** no caller SHALL be left awaiting a subscription that never delivers

> Measured basis: five SSE candidate paths and two WebSocket candidates were
> probed and none connected; `GET /messages/events` returns `406` for
> `Accept: text/event-stream` and `404` for every format it does accept
> (`docs/PROVIDERS.md` §2).

### Requirement: A provider response is translated before anything observes it

A provider's own response structure SHALL be interpreted only inside its adapter.
No object crossing the contract SHALL carry a provider's field names, and no
caller SHALL be able to distinguish which provider produced a value other than by
asking which provider it asked.

#### Scenario: A provider returns its own naming

- **WHEN** an adapter receives a response in the provider's format
- **THEN** it SHALL translate it into the shared model
- **AND** the translated value SHALL NOT retain the provider's field names
- **AND** no caller SHALL need to interpret or derive meaning from a provider's
  identifiers

> **AMENDED DURING SYNC, after implementation.** The original wording was "the
> provider's identifiers SHALL NOT be required by any caller", which turned out to
> be **unsatisfiable** rather than merely unmet.
>
> A fetch-by-id API needs the provider's own id: a message is fetched by the id the
> provider issued. Mail.tm additionally hydrates a **relative** `@id`
> (`/accounts/{id}`) which is measured to be the only correct thing to delete
> against, so that resolved resource URL is stored as `Mailbox.id`. Both are the
> provider's identifiers, and a caller must carry them back to use them.
>
> Demanding otherwise would have meant synthesising SpectreMail-owned identifiers and
> a lookup table mapping them to provider ones - persistence, which is the storage
> milestone's job, for a rule that would not have improved any caller's outcome.
>
> The amendment keeps the requirement's actual purpose and drops the part that
> cannot hold. What the implementation **does** guarantee is that a caller treats
> these values as opaque handles and never interprets them. Verified by inspection
> rather than by a mechanism: nothing in the workspace reads `mailbox.id` or a
> message id except the adapter that issued it. That is recorded as a fact about
> today's code, **not** as enforcement - a boundary assertion that no caller parses
> an identifier cannot distinguish parsing from passing, so it would be a check
> narrower than the rule it claimed to enforce.

#### Scenario: A third provider is added later

- **WHEN** a new provider is integrated
- **THEN** it SHALL require a new adapter only
- **AND** it SHALL NOT require a change to any client or to the shared model

### Requirement: Every provider failure becomes a normalized error

Any failure an adapter encounters SHALL be reported using the closed normalized
error vocabulary. A provider's own status codes, error bodies, and vocabulary
SHALL NOT cross the adapter boundary. Where a provider's condition cannot be
classified, the provider's own description SHALL be preserved rather than
discarded.

#### Scenario: A provider rejects the supplied credentials

- **WHEN** an authenticated request fails because the credentials are not accepted
- **THEN** the adapter SHALL report an authentication failure
- **AND** it SHALL NOT report it as an unclassified provider error

#### Scenario: A provider no longer honours an already-issued credential

- **GIVEN** a credential that was accepted earlier and is refused now
- **WHEN** the provider cannot distinguish that from a credential it never
  accepted
- **THEN** the adapter SHALL report the condition that leaves the mailbox
  unusable, rather than instructing the user to check a credential they never
  entered
- **AND** it SHALL NOT assert which of the two conditions occurred

> **AMENDED DURING SYNC, after measurement.** This scenario did not exist when the
> requirement was written. It was added because the original wording turned out to
> be unsatisfiable for at least one provider without guessing.
>
> Measured: Mail.tm answers `401` for a **refused credential** and for a **deleted
> mailbox** with the *same* body. Deletion answers `204` and the next request
> answers `401` (`docs/PROVIDERS.md` §2). A single status cannot separate them, so
> an adapter that satisfied the original scenario literally would have to report an
> authentication failure for a mailbox that no longer exists - telling someone who
> never entered a credential to check it.
>
> The split is therefore by **where in the exchange** the refusal happens, which is
> observable, rather than by which cause the provider is concealing. On the token
> exchange the credentials genuinely were refused, so the condition is an
> authentication failure. On a request carrying an already-issued token, the mailbox
> is unusable, which is what the user needs to be told.

#### Scenario: A requested item does not exist

- **WHEN** a request names a message or mailbox the provider does not have
- **THEN** the adapter SHALL report a distinct not-found condition
- **AND** it SHALL NOT be conflated with an authentication failure, because the
  two call for different responses

#### Scenario: A failure matches no known condition

- **WHEN** a provider fails in a way the adapter cannot classify
- **THEN** the adapter SHALL report an unclassified provider failure
- **AND** the provider's own description of the failure SHALL be preserved

### Requirement: Provider throttling is surfaced with the provider's own signal

When a provider throttles a request, the adapter SHALL report a throttled
condition carrying the provider's rate-limit signal verbatim. It SHALL NOT retry
silently, queue indefinitely, or invent a retry interval the provider did not
state. A rate-limit signal that does not state its scope SHALL NOT be interpreted
as per-IP or per-account.

#### Scenario: Mailbox creation is throttled

- **WHEN** a mailbox creation request is throttled by the provider
- **THEN** the adapter SHALL report a throttled condition
- **AND** it SHALL carry the provider's rate-limit header unchanged
- **AND** the caller SHALL be able to tell the user when a retry may be attempted

#### Scenario: The provider publishes a throttling policy

- **GIVEN** a provider advertising a limit of one mailbox creation per sixty
  seconds
- **WHEN** a second creation is attempted inside that window
- **THEN** the adapter SHALL report the throttle rather than forcing the request
- **AND** the product SHALL NOT present creation as instantaneous

> Measured basis: `POST /accounts` advertises `ratelimit-policy: 1; w=60`
> (`docs/PROVIDERS.md` §2). The header does not state its scope, so "per IP" is an
> inference and is not specified as behaviour.

### Requirement: A dead session is never reported as an empty mailbox

An adapter SHALL distinguish a mailbox that is genuinely empty from one whose
session the provider no longer honours. Where a provider reports an unusable
session without signalling an error, the adapter SHALL detect that condition and
report it rather than returning an empty result.

#### Scenario: A stored Guerrilla session has expired

- **GIVEN** a provider that answers an unrecognised session with a success status
  and an empty message list
- **WHEN** messages are requested for a mailbox using that session
- **THEN** the adapter SHALL detect the session is no longer honoured
- **AND** it SHALL report an expired or unusable mailbox
- **AND** it SHALL NOT return an empty message list

#### Scenario: A mailbox is genuinely empty

- **WHEN** a valid session is polled and the provider returns no messages
- **THEN** the adapter SHALL report an empty list
- **AND** the empty result SHALL NOT be reported as a session failure

> Measured basis: an unrecognised Guerrilla session token returns `HTTP 200` with
> no auth error and an empty inbox, making a dead session indistinguishable from
> an empty one unless it is checked explicitly (`docs/PROVIDERS.md` §3).

### Requirement: Mailbox expiry follows an observed signal

An adapter SHALL NOT report a mailbox as expired because an assumed lifetime was
elapsed. Expiry SHALL be reported only when the provider indicates the session or
mailbox is unusable, or when a request fails in a way that identifies the mailbox
as gone. An adapter SHALL NOT derive a countdown from a provider's published
retention period.

#### Scenario: A provider publishes a retention period

- **WHEN** a provider documents how long it stores messages
- **THEN** no expiry value SHALL be derived from that published period
- **AND** messages disappearing is handled as an observed outcome

#### Scenario: The provider reports the mailbox as gone

- **WHEN** a request fails in a way that identifies the mailbox as deleted
- **THEN** the adapter SHALL report the mailbox as expired
- **AND** the condition SHALL be distinguishable from a transient failure

### Requirement: Message bodies are carried as untrusted text

An adapter SHALL NOT use a provider's declared content type to decide how a body
is carried, and SHALL NOT emit a field inviting a caller to render a message as
markup. A body containing markup SHALL be carried as text. A required field the
sender left blank SHALL be carried as an empty value rather than dropped or
treated as corruption.

#### Scenario: A provider declares plain text and delivers HTML

- **WHEN** a message declares a plain-text content type but its body contains HTML
- **THEN** the adapter SHALL carry the body as text
- **AND** it SHALL NOT mark the body as renderable markup

#### Scenario: A message has an empty subject

- **WHEN** an inbound message has an empty subject
- **THEN** the adapter SHALL still return it
- **AND** the empty subject SHALL NOT be treated as a delivery failure

> Measured basis: a real Guerrilla message arrived with `content_type: "text"` and
> an HTML body, and with an empty subject while its sender and body were present
> (`docs/PROVIDERS.md` §3, run `2026-10-01T18-08-41-251Z`).

### Requirement: Credentials are captured in the provider's own session model

An adapter SHALL capture a mailbox's credentials using SpectreMail's normalized
credential shape, never a provider's wire field names. Where a provider issues a
session through more than one channel, the adapter SHALL use the channel that
works from the client's runtime environment, and SHALL NOT depend on a cookie the
client cannot send.

#### Scenario: A provider issues both a cookie and a body token

- **WHEN** a provider sets a session cookie but also returns a session token in
  the response body, and its cross-origin policy prevents the cookie being sent
- **THEN** the adapter SHALL persist the body-returned token
- **AND** it SHALL NOT require the cookie

#### Scenario: Credentials are stored

- **WHEN** a mailbox's credentials are persisted
- **THEN** they SHALL use the normalized credential shape
- **AND** no provider wire field name SHALL appear in them

### Requirement: Optional capabilities are discoverable, not assumed

Not every provider supports every operation. The contract SHALL allow an adapter
to omit an operation it cannot perform, and a caller SHALL be able to determine
whether a given provider supports an optional operation before invoking it.

#### Scenario: A provider cannot delete a mailbox

- **GIVEN** a provider with no endpoint for deleting a mailbox
- **WHEN** the adapter is declared
- **THEN** the mailbox-deletion operation SHALL be absent from it
- **AND** a caller SHALL be able to detect the absence before attempting it

#### Scenario: A caller requires an unsupported operation

- **WHEN** a caller invokes an operation the chosen adapter does not implement
- **THEN** the absence SHALL be reported as an unsupported operation
- **AND** it SHALL name the operation that was requested

#### Scenario: An absent operation is recorded as unobserved

- **GIVEN** a provider on which an operation was never seen to work
- **WHEN** its absence is reported
- **THEN** the report SHALL distinguish "not observed" from "known not to exist"
- **AND** the product SHALL NOT assert a provider capability nobody measured

> **AMENDED DURING SYNC, after implementation.** The requirement above was
> satisfiable in principle and was nevertheless **unimplemented** - the
> verification pass found that invoking an absent optional method raised
> `TypeError: provider.destroyMailbox is not a function`.
>
> A `TypeError` is not a normalized error. Any layer that knows only the closed
> error vocabulary cannot catch it, present it, or recover from it, and it names the
> implementation detail rather than the operation the caller asked for. The
> original scenario states the outcome but not that it must be *reachable through
> the guarded path*, and nothing made it reachable. This scenario makes that
> explicit.
>
> The second half records why the wording of the reported absence matters.
> Guerrilla's `supports()` answers `false` for both deletion operations because
> neither was observed in the measured surface - **not** because deletion was
> proven impossible there. Reporting "this provider cannot delete mailboxes" would
> bake an unmeasured claim into a user-facing message, and the next probe observing
> deletion working would then contradict the product's own words.

### Requirement: Every adapter passes one shared conformance suite

Adapters SHALL be verified by a single conformance suite that is not
provider-specific, so that adding an adapter means writing its adapter rather
than writing its own definition of correct. The suite SHALL run from recorded
provider responses rather than live network calls, so that a conformance run is
deterministic and cannot fail because a third party is unavailable.

#### Scenario: A second adapter is added

- **WHEN** a new provider adapter is implemented
- **THEN** it SHALL pass the same conformance suite as the existing adapters
- **AND** no adapter-specific exemption SHALL be added to the suite

#### Scenario: The conformance suite runs

- **WHEN** the default verification gate runs
- **THEN** every adapter SHALL be exercised against recorded responses
- **AND** the run SHALL NOT depend on network reachability

#### Scenario: A provider's behaviour changes

- **WHEN** a provider alters a response shape
- **THEN** the recorded responses SHALL be refreshed deliberately
- **AND** the change SHALL be visible in the diff rather than absorbed silently

### Requirement: Failover applies only to mailbox creation

When a client supports more than one provider, selection of a provider SHALL be
confined to the point where a mailbox is created. An existing mailbox SHALL
remain bound to the provider that created it for the rest of its life, and a
fallback provider SHALL NOT be presented as though it were the primary.

#### Scenario: The primary provider fails to create a mailbox

- **WHEN** the primary provider cannot create a mailbox and the client supports a
  fallback
- **THEN** the client SHALL try the fallback provider
- **AND** the resulting mailbox SHALL be identified as belonging to the fallback

#### Scenario: A mailbox already exists

- **WHEN** an existing mailbox is read
- **THEN** the provider that created it SHALL be used
- **AND** no attempt SHALL be made to fall back to another provider

#### Scenario: A client has a single provider

- **WHEN** a client supports exactly one provider
- **THEN** no failover SHALL be attempted
- **AND** the limitation SHALL remain recorded rather than being presented as
  redundancy

#### Scenario: A fallback is used

- **WHEN** a mailbox was created by a fallback provider
- **THEN** its provider SHALL be reported as the fallback
- **AND** it SHALL NOT be reported as the primary provider's result

### Requirement: The provider layer does not persist anything

An adapter SHALL return domain values and SHALL NOT write to storage, cache
credentials, or retain a session between calls. Persistence is the concern of the
capability that owns storage, and an adapter that cached would make a stored
mailbox's provider untrustworthy.

#### Scenario: An adapter is called twice

- **WHEN** the same adapter is used to create or read a mailbox across separate
  calls
- **THEN** it SHALL NOT retain state from the earlier call
- **AND** each call SHALL be driven solely by the arguments it was given

#### Scenario: A mailbox is used after a restart

- **GIVEN** a mailbox restored from storage
- **WHEN** an operation is performed on it
- **THEN** the adapter SHALL authenticate using the credentials supplied with
  that mailbox
- **AND** it SHALL NOT depend on anything it remembered earlier
