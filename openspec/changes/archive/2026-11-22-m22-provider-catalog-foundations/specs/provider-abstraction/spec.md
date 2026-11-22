# Spec Delta

## MODIFIED Requirements

### Requirement: Provider throttling is surfaced, not silently retried

When a provider throttles a request, SpectreMail SHALL surface the condition to
the client rather than silently retrying or queueing indefinitely.

#### Scenario: Account creation is rate limited

- **WHEN** a mailbox creation request is throttled by the provider
- **THEN** the user is told the request was throttled and when it may be retried
- **AND** the application does not loop or queue silently in the background

This requirement does not forbid a bounded, visible fallback among configured
providers at the moment of mailbox creation. Each provider SHALL be attempted at
most once, the throttling signal SHALL still be surfaced with the provider's own
description, and no attempt SHALL be repeated in the background. Bounded fallback
is a different action from retrying one provider, and the prohibition on silent
retry is not weakened by it.

#### Scenario: A bounded fallback is visible, not a silent retry

- **WHEN** creation falls back to another configured provider after a throttle
- **THEN** the fallback SHALL be visible to the user
- **AND** the throttling signal SHALL still be surfaced verbatim
- **AND** no provider SHALL be attempted a second time in the background

## ADDED Requirements

### Requirement: A catalog or creation answer is bound to its request and mailbox

Every catalog listing and mailbox-creation answer SHALL carry the identity of the
request that produced it and the provider and session that answered it. An answer
SHALL be applied only when those identities match the request the caller is still
awaiting; a late answer from an older request SHALL be discarded rather than
replacing a newer mailbox or resurrecting a reader selection that was cleared.
Every mailbox and message request SHALL be routed to the exact provider and
session that created it, without a fallback to another provider. A domain SHALL
be used only with the provider that supplied it.

#### Scenario: A late answer arrives after a newer one

- **GIVEN** two creation requests in flight, the older one answered last
- **WHEN** the older answer arrives
- **THEN** it SHALL be discarded rather than replacing the newer mailbox
- **AND** it SHALL NOT restore a reader selection that the newer request cleared

#### Scenario: A domain from one provider is offered to another

- **GIVEN** a domain discovered through one provider's catalog
- **WHEN** a client attempts to create with a different provider using that domain
- **THEN** the attempt SHALL be refused
- **AND** no provider SHALL be treated as the owner of another provider's domain

#### Scenario: A mailbox requests under its own provider and session

- **WHEN** a stored mailbox is listed, read, checked or replaced
- **THEN** every request SHALL go to the provider and session recorded with that
  mailbox
- **AND** no fallback provider SHALL be consulted for an existing mailbox
