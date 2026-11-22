# provider-catalog Specification

## Purpose

Defines how SpectreMail obtains, qualifies and presents provider-sourced domain
catalog data, keeps three truth claims apart, binds answers to their requests, and
lets a person choose a domain without making an unverified promise.

## Requirements

### Requirement: Domain catalog entries are aggregated without losing their origin

A catalog SHALL expose the time at which the provider data it holds was fetched.
When catalogs from several providers are combined, every offered entry SHALL keep
the identity of the provider that supplied it. Entries with the same spelling from
different providers SHALL NOT be collapsed into one interchangeable option; the
aggregation policy SHALL preserve provider identity for every offered entry and
SHALL be recorded in this change's design record. An entry SHALL be offered only
when the client can reach that provider and the provider reported the entry as
usable for the interface in question. An entry reported as retired, private,
expired or otherwise ineligible SHALL NOT be offered.

#### Scenario: Two providers report the same domain spelling

- **GIVEN** two catalog entries with the same domain spelling from different providers
- **WHEN** the catalogs are combined for a client that can reach both providers
- **THEN** each offered entry SHALL remain bound to the provider that supplied it
- **AND** the two entries SHALL NOT be presented as interchangeable

#### Scenario: A catalog is read after a refresh

- **WHEN** a client reads a catalog and its fetch time
- **THEN** the fetch time SHALL be observable with the entries it describes
- **AND** the catalog SHALL NOT claim a completeness the provider did not report

#### Scenario: A domain belongs to a provider the client cannot reach

- **GIVEN** a catalog entry whose provider is not configured for this client
- **WHEN** the client builds its usable domain list
- **THEN** that entry SHALL be filtered out
- **AND** it SHALL NOT be replaced by an entry from a different provider

### Requirement: Catalog availability, provisioning and delivery are three separate claims

The product SHALL distinguish three claims: a domain is available in a provider's
catalog; a mailbox has been provisioned and confirmed by its provider; and real
external mail has been received at that address. Provisioning SHALL NOT be
claimed before the provider's own confirmation semantics have been satisfied.
Delivery SHALL be reported as `LIVE DELIVERY NOT VERIFIED` until an external
sender has been observed, and a recorded fixture, a successful create, or an
empty-inbox read SHALL NOT be presented as delivery evidence.

#### Scenario: A provider confirms a mailbox

- **WHEN** a provider returns the confirmation its own protocol requires for a
  created mailbox
- **THEN** the mailbox SHALL be reported as provisioned
- **AND** it SHALL NOT be reported as having received mail

#### Scenario: No external sender exists

- **GIVEN** a provisioned mailbox with no observed external sender
- **WHEN** the client reports what it knows about delivery
- **THEN** the state SHALL be `LIVE DELIVERY NOT VERIFIED`
- **AND** that state SHALL NOT be counted as a passed delivery claim

#### Scenario: A recorded response is replayed

- **WHEN** a test or a client serves a recorded provider response
- **THEN** the observation SHALL be labelled as recorded
- **AND** it SHALL NOT upgrade any address to delivery-verified

### Requirement: Catalog fetches are bounded, fresh and honestly incomplete

A catalog fetch SHALL follow provider pagination only up to a declared bound.
When that bound is reached, or the provider reports further pages, the catalog
SHALL report the result as incomplete rather than as the whole inventory. A
refresh policy SHALL be declared with its rationale, and a failed refresh SHALL
not be cached as a successful one. Domain counts SHALL be reported as a dated
snapshot from a named provider and SHALL NOT be summed across providers into one
inventory figure. A provider that exposes no domain API SHALL contribute an empty
catalog rather than one inferred from a rendered page.

#### Scenario: Pagination exceeds the bound

- **GIVEN** a provider whose catalog has more pages than the declared bound
- **WHEN** the catalog finishes a fetch
- **THEN** it SHALL report the fetch as truncated
- **AND** it SHALL NOT present the partial list as a complete inventory

#### Scenario: A refresh fails

- **WHEN** a catalog refresh fails
- **THEN** the failure SHALL NOT be cached as a successful fetch
- **AND** the previously fetched entries SHALL remain labelled with their own
  fetch time

#### Scenario: Counts from two providers are combined

- **WHEN** a client reports how many domains it offers
- **THEN** each count SHALL be attributed to its provider and fetch time
- **AND** the counts SHALL NOT be added into a single total

#### Scenario: A provider exposes no domain API

- **GIVEN** a provider with no documented, provider-supported domain listing
- **WHEN** its catalog is built
- **THEN** it SHALL contribute no entries
- **AND** no list rendered by the provider's own website SHALL be used as one

### Requirement: Domain selection is automatic or manual, bounded and accessible

Where a client offers domain choice, it SHALL offer an Automatic option and, only
when more than one usable domain exists, a manual choice. Automatic SHALL choose
only from compatible, provider-confirmed options. A failed manual choice SHALL be
reported concisely and SHALL allow a retry or another selection; the client SHALL
NOT silently substitute a different domain. While a choice is in flight the
control SHALL coalesce repeated presses and discard out-of-order answers; the
previous working mailbox SHALL remain until the provider confirms the replacement,
and a successful replacement SHALL clear the previous reader selection. A
domain-choice control SHALL NOT be a provider selector. Adding it SHALL NOT add a
region, change the four actions, add a configuration card or domain counter,
introduce a token or a motion, remove a control from the tab order, or reduce the
touch target of an existing control.

#### Scenario: More than one usable domain exists

- **GIVEN** a client with more than one usable domain from reachable providers
- **WHEN** the client offers domain choice
- **THEN** Automatic SHALL be offered first
- **AND** manual choices SHALL be limited to those usable domains

#### Scenario: A manually chosen domain fails

- **WHEN** a provider declines a manually chosen domain
- **THEN** the client SHALL say the choice failed without substituting another
  domain
- **AND** it SHALL allow a retry or another selection

#### Scenario: Two presses arrive before the first answer

- **GIVEN** a domain-change control that has been pressed twice before the first
  answer arrives
- **WHEN** the two answers arrive out of order
- **THEN** only one creation SHALL have been requested
- **AND** the older answer SHALL NOT replace the newer mailbox

#### Scenario: A replacement succeeds

- **WHEN** the provider confirms a replacement mailbox
- **THEN** the previous mailbox SHALL be shown only up to that confirmation
- **AND** the opened-message selection from the previous mailbox SHALL be cleared

#### Scenario: The page composition is inspected

- **WHEN** the rendered surface with domain choice is compared with the declared
  composition
- **THEN** the five regions and the four actions SHALL be unchanged
- **AND** no new region, token, motion, configuration card or domain counter
  SHALL have been added, and the control SHALL remain keyboard reachable
