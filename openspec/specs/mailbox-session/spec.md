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