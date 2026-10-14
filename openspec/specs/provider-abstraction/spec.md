# provider-abstraction Specification

## Purpose
Defines the `provider-abstraction` capability: the boundary every temporary-mail
provider adapter sits behind, the corrected per-client provider roles that M0
measured, and the provider constraints that later capabilities must inherit
rather than rediscover.

## Requirements

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

The website SHALL use Guerrilla Mail as its only provider in V1. The extension SHALL use Mail.tm as
its primary provider with Guerrilla Mail as fallback. No client SHALL reach a provider that its
runtime environment cannot legally and technically reach, and no client SHALL reach a provider
through a SpectreMail-operated proxy or any other intermediary.

The two assignments are different because the two host environments are different, and that
difference is measured rather than chosen: Mail.tm sends `Access-Control-Allow-Origin` only to its
own origins, so no compliant web page can reach it, while an extension holding host permission for
the origin can. The website's single-provider configuration is therefore a limit of its
environment rather than a preference about Mail.tm, and the extension's two-provider configuration
is a capability of its own rather than a claim that either provider is better.

**A client's provider list is its configuration, and a client that reaches more than one provider
SHALL name them in preference order and report which one actually served a request.** A client
that falls back and reports the preferred provider has told the user something false about where
their mail is going.

#### Scenario: The extension selects a provider

- **WHEN** the extension creates a mailbox
- **THEN** it prefers Mail.tm
- **AND** falls back to Guerrilla Mail when Mail.tm is unavailable

#### Scenario: The website selects a provider

- **WHEN** the website creates a mailbox
- **THEN** it uses Guerrilla Mail
- **AND** it does not attempt Mail.tm, whose API grants no CORS header to a
  third-party origin, and because SpectreMail does not proxy provider APIs
- **AND** it SHALL NOT offer a control for choosing a provider, because it has exactly one
  reachable provider and a control that cannot act misreports the choice as unavailable

#### Scenario: A client has only one provider

- **WHEN** a client supports exactly one provider, as the website does in V1
- **THEN** its single-provider dependency SHALL be recorded as a known limitation
  rather than presented as redundancy
- **AND** adding a second provider SHALL remain additive through the abstraction,
  not require a rewrite

#### Scenario: A provider is unreachable from a client's environment

- **WHEN** a provider cannot be reached from the environment a client runs in,
  as Mail.tm cannot be reached from a web page
- **THEN** that client SHALL exclude it
- **AND** it SHALL NOT add a SpectreMail-operated backend or any other intermediary to relay it
- **AND** the reason SHALL be recorded in `docs/PROVIDERS.md`
- **AND** a measured reason SHALL cite the run that observed it, while an
  unverified reason SHALL be labelled "unverified" with **no** run claimed

### Requirement: Provider APIs are never proxied

SpectreMail SHALL NOT relay a provider API through a SpectreMail-operated server
or any other intermediary in order to bypass a provider's CORS policy or origin
restriction. This is a policy of the product and does not depend on any provider's
terms.

#### Scenario: A provider is unreachable from the browser

- **WHEN** a provider cannot be called directly from a web page
- **THEN** that provider SHALL be excluded from the website
- **AND** no backend proxy SHALL be introduced to reach it

#### Scenario: A relay would technically work

- **WHEN** an intermediary could make a provider callable from the website
- **THEN** it SHALL still be rejected
- **AND** the affected surface SHALL be reduced instead

> Measured basis: Mail.tm's API returns no CORS header to a third-party origin
> (`docs/PROVIDERS.md` §1). No architectural decision rests on provider terms:
> Mail.tm publishes **no terms page** (`/terms` → 404) and its FAQ is silent on
> proxying, resale, and attribution, so no terms-derived justification for
> excluding it may be cited — see `docs/PROVIDERS.md` §2.

### Requirement: Declared message content type is not trusted

Message rendering SHALL NOT rely on a provider's declared content type. Raw
message content SHALL be treated as untrusted input and SHALL NOT be rendered as
HTML.

#### Scenario: A provider declares plain text and delivers HTML

- **WHEN** a message declares a plain-text content type but its body contains HTML
- **THEN** the HTML is NOT rendered as markup
- **AND** the message remains readable as text

#### Scenario: A message omits a field the sender left blank

- **WHEN** an inbound message has an empty subject or an empty sender
- **THEN** it SHALL still be presented
- **AND** its absence SHALL NOT be treated as corruption or a delivery failure

> Measured basis: a real message on the Guerrilla mailbox arrived with an **empty
> subject** while its sender and body were present (run `2026-10-01T18-08-41-251Z`).
> An empty **sender** was not measured on any provider, so this scenario covers the
> general case rather than a second observation.

### Requirement: Message retrieval uses adaptive polling

Message retrieval SHALL use adaptive polling. SpectreMail SHALL NOT depend on an
SSE, WebSocket, or other push transport that a provider does not actually serve.

#### Scenario: A provider advertises a push transport but serves none

- **WHEN** a provider's documentation describes an SSE or WebSocket transport
- **THEN** the application SHALL NOT open a subscription to it
- **AND** messages SHALL arrive through polling
- **AND** a client SHALL NOT be left waiting on a subscription that never delivers

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

The extension's manifest SHALL declare provider host permissions in the wildcard path form, and a
test SHALL exercise the declared pattern against the live provider origin to prove it grants
access.

**The test SHALL also exercise the slash-less form and require it to fail**, in the same run and
against the same origin. A check that fetches once and passes would also pass on some
configurations regardless of the declared pattern, so the negative half is what makes the result
evidence about the pattern rather than about the network.

**The live check SHALL NOT run in the unit suite, the browser suite, or `pnpm verify`.** Every
other provider interaction in this repository is driven by recorded responses, and that property
is what makes those suites deterministic and offline. The live check SHALL run from its own
opt-in script, and its result — pass or fail — SHALL be recorded in the provider documentation.

**What the check establishes, and what it does not.** It establishes that the **declared pattern**
grants cross-origin access from a real privileged extension context. It does **not** establish that
the product works end to end against a live provider: the whole signup flow, and a stored mailbox
reconciled against a live session, remain unverified by it.

#### Scenario: A slash-less host permission is declared

- **WHEN** a host permission omits a path, such as `https://api.example.com`
- **THEN** it SHALL be rejected, because it silently grants no access
- **AND** the wildcard path form, such as `https://api.example.com/*`, SHALL be
  used instead

#### Scenario: The declared pattern is checked against the live provider

- **WHEN** the host-permission check runs
- **THEN** the wildcard form as declared in the manifest SHALL succeed
- **AND** the slash-less form SHALL fail in the same run
- **AND** neither result SHALL be asserted by any test in `pnpm verify`

#### Scenario: The manifest is checked without a network

- **WHEN** the unit suite reads the built manifest
- **THEN** every provider host permission SHALL match the wildcard path form
- **AND** this SHALL be verified without contacting any provider

### Requirement: Mailbox lifetime is not assumed

SpectreMail SHALL NOT assume a mailbox or session has a known lifetime, and SHALL
NOT derive a countdown from provider documentation. Expiry SHALL be driven by an
observed signal rather than an elapsed guess.

#### Scenario: A mailbox is considered expired

- **WHEN** a client marks a mailbox expired
- **THEN** it SHALL be because the provider reported the session or mailbox as
  unusable, or because a request failed in a way that identifies the mailbox as
  gone
- **AND** it SHALL NOT be because an assumed elapsed time was exceeded

#### Scenario: A provider publishes a retention period

- **WHEN** a provider documents how long it stores messages
- **THEN** the client SHALL NOT present a countdown to that horizon, because the
  per-message horizon is not discoverable through the API
- **AND** message disappearance SHALL still be handled as an observed outcome

> Measured basis: Mail.tm publishes a 7-day message retention and states a mailbox
> "stays valid until you delete it yourself" (`docs/PROVIDERS.md` §2), but neither
> value appears in any API response, so neither can be discovered programmatically.
> No provider value is verified against the live API — no probe held a mailbox or a
> message open past either horizon. Guerrilla exposes no equivalent published value.

### Requirement: Provider terms are not assumed

Where a provider's terms could not be located or read, SpectreMail SHALL NOT cite
them as a justification for any decision, in documentation or in code. It SHALL
also not assume a required obligation is absent.

#### Scenario: A provider publishes no terms

- **WHEN** a provider's terms cannot be located
- **THEN** no architectural decision SHALL be justified by them
- **AND** any obligation depending on them SHALL be recorded as an open item
  rather than asserted in either direction

#### Scenario: A verified attribution obligation applies to one client

- **WHEN** a **verified** provider term requires attribution and the provider is
  used by only one client
- **THEN** that client SHALL carry the attribution
- **AND** the obligation SHALL not be treated as satisfied by another client's
  implementation

> Measured basis: Mail.tm has **no terms page** (`https://mail.tm/terms` → 404) and
> its FAQ contains no proxy, resale, attribution, or quota terms, verified
> 2026-10-02. **No attribution obligation is asserted here**, because none could be
> verified — this scenario applies only once a real term is located. An earlier
> revision of this change quoted Mail.tm terms forbidding proxying, reselling, and
> requiring attribution; those quotations could not be found and are withdrawn.
> See `docs/PROVIDERS.md` §2.

### Requirement: A provider credential reaches the transport and this device's storage, and nothing else

A provider credential SHALL be used for exactly two purposes: **authenticating a
request to the provider that issued it**, and **being persisted in the storage record
of the mailbox it belongs to**. No surface this product ships — no message that
crosses a process boundary, no notification, no rendered string, no URL this product
builds — SHALL carry a credential field, and no credential SHALL appear in a value
this product writes to a place a person other than the one holding this device's
storage can read.

**This requirement is about where a credential may travel, not about how it is
stored.** `shared-domain-model` already requires that credentials be specific to one
provider and that a mailbox's provider and credentials agree; `provider-adapters`
already requires that they be captured in the provider's own session model, and that
the provider layer persist nothing. None of those says where a credential may *go*.

**The boundary this states is the one that holds today, and holding it is currently
carried by a comment.** A mailbox created inside a stranger's page is created by the
service worker, and the answer handed back to that page's content script carries the
address and the mailbox id — because the worker's own storage context already holds
the whole mailbox by the time the answer is built. **That is correct, and this
requirement exists so that the correctness is a property of the product rather than of
a reader having understood the code.** An answer widened to carry the mailbox, or a
notification built from a value that could contain one, would be a regression against
a stated obligation rather than a departure from an undocumented intention.

**A credential that must cross to the provider is not a leak, and the requirement
does not forbid it.** The request that presents it is the permitted destination. What
is forbidden is a credential arriving anywhere that is not that request or that
device's own record of the mailbox.

#### Scenario: The message kinds this extension sends are inspected

- **WHEN** every message kind this extension sends or receives is enumerated and
  narrowed through the reader that parses it
- **THEN** no kind's value SHALL carry a credential field
- **AND** a field named for a credential SHALL be present in none of them

#### Scenario: The shipped protocol declares no credential field

- **WHEN** every type this extension sends or receives is read
- **THEN** none of them SHALL declare a field that holds a credential
- **AND** the set of protocol types this repository ships SHALL be enumerable, so
  that a type added later is inside the same obligation rather than outside it

#### Scenario: A credential is persisted with the mailbox that owns it

- **WHEN** a mailbox is written to this device's storage
- **THEN** its credentials SHALL be written with it and nowhere else
- **AND** removing what this device holds SHALL remove those credentials with it,
  which `spectre-storage` already requires of every record kind

#### Scenario: A message is announced

- **WHEN** this extension raises a notification about a message
- **THEN** it SHALL carry the sender and the subject and no other field of the
  message, which `extension-client` already requires
- **AND** a value drawn from the mailbox record rather than from the message SHALL
  NOT appear in it

#### Scenario: A control is built from this device's mailbox

- **WHEN** any surface this extension renders is built
- **THEN** no value it displays SHALL be drawn from a mailbox's credentials
- **AND** the value it displays instead SHALL be the address, which is what a person
  needs and all a credential would tell them about someone else's account
