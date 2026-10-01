# Spec Delta

## Purpose

Defines the `provider-abstraction` capability: the boundary every temporary-mail
provider adapter sits behind, the corrected per-client provider roles that M0
measured, and the provider constraints that later capabilities must inherit
rather than rediscover.

## ADDED Requirements

### Requirement: Providers are reached only through a provider abstraction

Mailbox lifecycle operations SHALL be performed through a provider abstraction.
No component outside that abstraction SHALL interpret a provider's HTTP response,
and no presentation component SHALL contain knowledge of a provider's JSON shape.

#### Scenario: A provider adapter is implemented

- **WHEN** a temporary-mail provider is integrated
- **THEN** the adapter translates between that provider's wire format and the
  abstraction's domain types
- **AND** no React component or view model contains a provider JSON field name
- **AND** adding a second provider to a client requires a new adapter rather than
  a change to that client's presentation or domain logic

#### Scenario: Two providers must serve the same client

- **WHEN** a client supports more than one provider
- **THEN** the fallback is selected inside the provider abstraction
- **AND** the client observes one mailbox contract regardless of which provider
  served it

### Requirement: Provider roles are assigned per client, not globally

The website SHALL use Guerrilla Mail as its only provider in V1. The extension
SHALL use Mail.tm as its primary provider with Guerrilla Mail as fallback. No
client SHALL reach a provider that its runtime environment cannot legally and
technically access.

#### Scenario: The website selects a provider

- **WHEN** the website creates a mailbox
- **THEN** it uses Guerrilla Mail
- **AND** it does not attempt Mail.tm, whose API grants no CORS header to a
  third-party origin and whose terms forbid proxying

#### Scenario: The extension selects a provider

- **WHEN** the extension creates a mailbox
- **THEN** it prefers Mail.tm
- **AND** falls back to Guerrilla Mail when Mail.tm is unavailable
- **AND** the fallback is not silently presented as the primary provider's result

#### Scenario: A provider is unreachable from a client's environment

- **WHEN** a provider cannot be reached from a given client environment for legal
  or technical reasons
- **THEN** that client SHALL NOT be built against it
- **AND** the reason SHALL be recorded rather than worked around by a relay

### Requirement: Provider APIs are never proxied

SpectreMail SHALL NOT relay a provider API through a SpectreMail-operated server
or any other intermediary in order to bypass a provider's CORS policy, origin
restriction, or terms of service.

#### Scenario: A provider is unreachable from the browser

- **WHEN** a provider cannot be called directly from a web page
- **THEN** that provider SHALL be excluded from the website
- **AND** no backend proxy SHALL be introduced to reach it

#### Scenario: A relay would technically work

- **WHEN** an intermediary could make a provider callable from the website
- **THEN** it SHALL still be rejected if the provider's terms forbid it
- **AND** the affected surface SHALL be reduced instead

### Requirement: Declared message content type is not trusted

Message rendering SHALL NOT rely on a provider's declared content type. Raw
message content SHALL be treated as untrusted input and SHALL NOT be rendered as
HTML.

#### Scenario: A provider declares plain text and delivers HTML

- **WHEN** a message declares a plain-text content type but its body contains HTML
- **THEN** the HTML is NOT rendered as markup
- **AND** the message remains readable as text

#### Scenario: A message omits its subject or sender

- **WHEN** an inbound message has an empty subject or an empty sender
- **THEN** it SHALL still be presented
- **AND** its absence SHALL NOT be treated as corruption or a delivery failure

### Requirement: Message retrieval uses adaptive polling

Message retrieval SHALL use adaptive polling. SpectreMail SHALL NOT depend on an
SSE, WebSocket, or other push transport that a provider does not actually serve.

#### Scenario: A provider advertises SSE but serves none

- **WHEN** a provider's marketing describes a real-time transport
- **THEN** the transport SHALL be verified against the live API before anything
  depends on it
- **AND** retrieval SHALL fall back to polling if it is absent

#### Scenario: Polling a mailbox

- **WHEN** a mailbox is awaiting new messages
- **THEN** it SHALL be polled at an interval that respects the provider's
  advertised rate limit
- **AND** the interval SHALL back off when the provider signals throttling

### Requirement: Provider throttling is surfaced, not silently retried

When a provider throttles a request, SpectreMail SHALL surface the condition to
the client rather than silently retrying or queueing indefinitely.

#### Scenario: Account creation is rate limited

- **WHEN** a mailbox creation request is throttled by the provider
- **THEN** the user is told the request was throttled and when it may be retried
- **AND** the application does not loop or queue silently in the background

### Requirement: Extension host permissions use the wildcard path form

The extension's manifest SHALL declare provider host permissions in the wildcard
path form, and a test SHALL exercise the declared pattern against the live
provider origin to prove it grants access.

#### Scenario: A slash-less host permission is declared

- **WHEN** a host permission omits a path, such as `https://api.example.com`
- **THEN** it SHALL be rejected, because it silently grants no access
- **AND** the wildcard path form, such as `https://api.example.com/*`, SHALL be
  used instead

### Requirement: Mailbox lifetime is not assumed

SpectreMail SHALL NOT assume a mailbox or session has a known lifetime. No
provider currently advertises a TTL, so expiry SHALL be driven by an observed
signal rather than a guessed duration.

#### Scenario: A mailbox is considered expired

- **WHEN** a client marks a mailbox expired
- **THEN** it SHALL be because the provider reported the session or mailbox as
  unusable, or because a request failed in a way that identifies the mailbox as
  gone
- **AND** it SHALL NOT be because an assumed elapsed time was exceeded

### Requirement: Provider attribution obligations are per client

Where a provider requires attribution or branding, that obligation SHALL be
discharged in every client that uses the provider, and SHALL NOT be assumed to
be covered elsewhere in the product.

#### Scenario: Only one client uses a provider

- **WHEN** a provider requires attribution and is used by only one client
- **THEN** that client SHALL carry the attribution
- **AND** the obligation SHALL not be treated as satisfied by another client's
  implementation