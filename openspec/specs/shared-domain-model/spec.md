# shared-domain-model Specification

## Purpose
Defines SpectreMail's own normalized domain vocabulary - mailbox, message,
credentials, verification code, verification link, and failure - so that both
clients, both provider adapters, storage, and the parser can agree on what these
things are without any of them depending on a provider's wire format.

This capability specifies the model and its invariants only. It deliberately does
not describe a provider adapter, an HTTP call, mailbox lifecycle behaviour, or the
mapping from a provider response onto these types: those belong to the provider
layer, which is the first component able to observe a real provider response. See
`provider-abstraction` for the behaviours this model exists to inherit.

## Requirements

### Requirement: The shared model contains no provider wire format

The shared domain types SHALL NOT contain any field whose name or shape is taken
from a provider's API. Provider-specific structure SHALL be confined to the
provider package and SHALL be translated at the boundary.

#### Scenario: The model is inspected for provider field names

- **WHEN** the shared domain types are read
- **THEN** no field SHALL be named after a provider's response field
- **AND** no type SHALL require a caller to supply a provider-shaped structure

#### Scenario: A provider response is normalized

- **WHEN** a provider returns a response in its own format
- **THEN** it SHALL be translated into the shared model before any client or
  shared package observes it
- **AND** the provider's own field names SHALL NOT need to survive that
  translation

> Measured basis: the provider field names that must not leak are recorded in
> `tests/architecture/boundaries.test.ts` and derived from the live responses in
> `docs/PROVIDERS.md`.

### Requirement: Credentials are specific to one provider

Provider credentials SHALL be a discriminated union keyed by provider, so that
credentials issued for one provider cannot be supplied for another. Each variant
SHALL name its fields in SpectreMail's own vocabulary rather than the provider's.

#### Scenario: Credentials for the wrong provider are supplied

- **WHEN** credentials issued for one provider are supplied where another
  provider's credentials are required
- **THEN** the mismatch SHALL be rejected
- **AND** the failure SHALL be reported as an authentication failure rather than
  retried or sent to the provider

#### Scenario: A session credential is stored

- **WHEN** a provider's session value is captured
- **THEN** it SHALL be the session identifier the provider returned in the
  response body
- **AND** it SHALL NOT be a cookie that the provider's CORS response prevents a
  browser from sending

> Measured basis: the Guerrilla Mail session must be the body-returned session
> identifier, not the `PHPSESSID` cookie, because the provider sends
> `Access-Control-Allow-Origin: *` with no
> `Access-Control-Allow-Credentials` (`docs/PROVIDERS.md`).

### Requirement: A mailbox's provider and credentials always agree

A mailbox SHALL NOT be representable in a state where its recorded provider
differs from the provider its credentials were issued for. The agreement SHALL be
maintained by the model rather than left to each caller's care.

#### Scenario: A mailbox is created

- **WHEN** a mailbox is constructed
- **THEN** its provider SHALL be determined by the credentials it carries
- **AND** a caller SHALL NOT be able to record a provider that contradicts them

#### Scenario: Credentials are read for a mailbox

- **WHEN** an operation authenticates using a mailbox
- **THEN** the credentials SHALL belong to the mailbox's recorded provider
- **AND** no operation SHALL authenticate against a provider the mailbox does not
  name

### Requirement: Expiry is recorded only from an observed signal

An optional mailbox expiry value SHALL be populated only from a signal the provider
actually reported. It SHALL NOT be derived from elapsed time, from a documented
retention period, or from any value the provider does not return. Its absence
SHALL be a normal state.

#### Scenario: No provider reports a lifetime

- **WHEN** a provider exposes no mailbox lifetime in any response
- **THEN** the mailbox SHALL carry no expiry value
- **AND** no countdown SHALL be derivable from the model

#### Scenario: A stored expiry is not a usable instant

- **GIVEN** a mailbox record read back from storage or a provider
- **WHEN** its expiry value is present but is not a finite number
- **THEN** the record SHALL be rejected as an invalid mailbox
- **AND** a human-readable duration SHALL NOT be accepted where an instant belongs
- **AND** an absent expiry SHALL remain valid, since absence is the normal state

#### Scenario: A provider reports that a session is unusable

- **WHEN** a provider signals that a mailbox's session or mailbox is gone
- **THEN** the mailbox's status SHALL reflect that observed condition
- **AND** the reason SHALL be the observed signal, not an elapsed-time threshold

> Measured basis: Mail.tm publishes a 7-day retention and states a mailbox lasts
> until deleted, but neither value appears in any API response and neither was
> measured live. Guerrilla exposes no equivalent value
> (`provider-abstraction`, *Mailbox lifetime is not assumed*).

### Requirement: A present message field may be empty

A message field the sender left blank SHALL be represented as an empty value
rather than as absent or as an error. Emptiness SHALL NOT be treated as
corruption, and a message with an empty required field SHALL still be
representable and presentable.

#### Scenario: A message arrives with no subject

- **WHEN** a delivered message has an empty subject and a present sender and body
- **THEN** the message SHALL be representable with an empty subject
- **AND** its absence SHALL NOT mark it corrupt or undelivered

#### Scenario: A field is genuinely unavailable

- **WHEN** a value was never provided by the provider
- **THEN** its absence SHALL be distinguishable from an empty value
- **AND** an absent optional field SHALL NOT be silently rendered as a placeholder
  value

> Measured basis: a real message on the Guerrilla mailbox arrived with an empty
> subject while its sender and body were present (run
> `2026-10-01T18-08-41-251Z`).

### Requirement: Message bodies are carried as untrusted text

A message body SHALL be carried as text. The model SHALL NOT carry a field whose
only purpose is to supply markup, so that no consumer can render a provider's
output as HTML by reading a field that invites it.

#### Scenario: A message contains markup

- **WHEN** a message body contains HTML markup
- **THEN** the markup SHALL be preserved only as text content
- **AND** the model SHALL NOT expose it in a form a renderer would treat as
  markup

#### Scenario: A provider declares a plain-text content type

- **WHEN** a provider declares plain text and delivers a markup body
- **THEN** the delivered content SHALL still be carried as untrusted text

### Requirement: Failures are expressed as a closed set of normalized codes

A provider failure SHALL be expressed as one of a fixed, closed set of normalized
codes, so that consumers branch on SpectreMail's vocabulary rather than on a
provider's HTTP status. A failure SHALL carry the provider it came from and the
underlying cause, and an unrecognised provider failure SHALL have its own code
rather than being mapped to a guess.

#### Scenario: A provider rejects credentials

- **WHEN** a provider rejects credentials for a mailbox
- **THEN** the failure SHALL carry the authentication-failure code
- **AND** it SHALL NOT be reported as success

#### Scenario: A provider signals throttling

- **WHEN** a provider throttles a request
- **THEN** the failure SHALL carry the rate-limited code
- **AND** it SHALL be distinguishable from a generic network failure

#### Scenario: A provider responds successfully with an error payload

- **GIVEN** a provider answers with a success status while its body reports a
  session or mailbox as unusable
- **THEN** the failure SHALL be recognised as a failure
- **AND** it SHALL NOT be treated as a successful response

#### Scenario: A failure names a provider the model does not define

- **WHEN** a failure carries a provider identifier outside the closed provider set
- **THEN** the failure SHALL be treated as invalid rather than accepted
- **AND** it SHALL NOT be attributed to a known provider

#### Scenario: A failure omits a field its code requires

- **GIVEN** a failure whose code requires an additional field, such as the message
  id for a missing message or the operation name for an unsupported one
- **WHEN** that field is absent or of the wrong type
- **THEN** the value SHALL be rejected as a valid failure
- **AND** a consumer that narrows on the code SHALL NOT be given a missing field

#### Scenario: A failure matches no known condition

- **WHEN** a provider fails in a way that matches no normalized code
- **THEN** the failure SHALL carry the unknown-provider-error code
- **AND** it SHALL retain the provider's own description for diagnosis

> Measured basis: a dead Guerrilla session answers HTTP 200 with an `error` key
> and no message list, while `auth.success` remains `true`; after a Mail.tm
> mailbox is deleted, deletion returns 204 and every follow-up request returns 401
> (`docs/PROVIDERS.md`).

### Requirement: Verification confidence is a bounded number

A detected verification code or verification link SHALL carry a confidence value
in the inclusive range zero to one. A value outside that range SHALL be rejected
where it enters the model rather than being stored and relied upon.

#### Scenario: A detection reports its confidence

- **WHEN** a verification code or link is added to a message
- **THEN** it SHALL carry a confidence value within zero to one inclusive

#### Scenario: A confidence value is out of range

- **WHEN** a value below zero or above one is offered for a detection
- **THEN** it SHALL be rejected at that point
- **AND** it SHALL NOT be stored on the model

> Detection itself is `packages/mail-parser`'s responsibility and is out of scope
> for this milestone. This requirement constrains the value's shape, because
> core's product principle is that detection is deterministic and does not depend
> on a model.

### Requirement: A provider is identified, not inferred

The set of providers SHALL be a closed, explicitly enumerated set. A provider
identity SHALL travel with the data it produced, so that stored records remain
interpretable and a stored mailbox can be routed to the client that may use it.

#### Scenario: A stored mailbox is read later

- **WHEN** a mailbox record is read from storage in a later session
- **THEN** its provider SHALL be recorded, not re-derived from current defaults
- **AND** a provider the client may not reach SHALL still be identifiable, so its
  absence can be reported rather than hidden

#### Scenario: An unrecognised provider identifier is encountered

- **WHEN** a stored record names a provider the model does not define
- **THEN** the situation SHALL be treated as an error condition
- **AND** it SHALL NOT be silently coerced to a known provider
