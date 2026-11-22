# Spec Delta

## MODIFIED Requirements

### Requirement: A provider is identified, not inferred

The set of providers SHALL be a closed, explicitly enumerated set. A provider
identity SHALL travel with the data it produced, so that stored records remain
interpretable and a stored mailbox can be routed to the client that may use it.

A domain SHALL additionally carry provider-sourced provenance: the time the
provider made the domain known, the runtime through which that provider can be
reached, the provider's own lifecycle or status value, and the capability flags
the provider declared for that domain. A supported runtime SHALL be recorded only
from a source that can establish it — a provider-reported interface signal or the
client's own configured provider list — and SHALL NOT be inferred from a domain's
spelling or from another provider's data. A free/premium distinction SHALL exist
only where a provider actually reported one; where no such signal exists the
distinction SHALL be absent and SHALL NOT be inferred from price, name, or
another provider's data.

#### Scenario: A stored mailbox is read later

- **WHEN** a mailbox record is read from storage in a later session
- **THEN** its provider SHALL be recorded, not re-derived from current defaults
- **AND** a provider the client may not reach SHALL still be identifiable, so its
  absence can be reported rather than hidden

#### Scenario: An unrecognised provider identifier is encountered

- **WHEN** a stored record names a provider the model does not define
- **THEN** the situation SHALL be treated as an error condition
- **AND** it SHALL NOT be silently coerced to a known provider

#### Scenario: A domain carries its provider-sourced provenance

- **GIVEN** a provider that reports a discovery time, a lifecycle status and an
  interface through which its domains can be used
- **WHEN** one of its domains enters the shared model
- **THEN** those reported values SHALL travel with the domain
- **AND** the domain SHALL remain bound to the provider that reported them

#### Scenario: No provider reports a premium distinction

- **WHEN** a provider supplies a domain without a free/premium signal
- **THEN** the model SHALL leave any premium distinction unset
- **AND** no client SHALL present that domain as premium, or as free by
  inference, on the strength of another provider's data
