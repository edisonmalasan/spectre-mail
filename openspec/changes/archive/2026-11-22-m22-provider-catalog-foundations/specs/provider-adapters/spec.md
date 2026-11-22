# Spec Delta

## MODIFIED Requirements

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

The typed capability surface SHALL also answer, before any call is made, whether
a provider can list domains, create a mailbox on a domain chosen from that list,
and restore an already-issued session. A client SHALL NOT answer those questions
by testing a provider identifier; it SHALL read the answer the adapter declared.
Where a capability was never observed, the answer SHALL say it is unobserved
rather than known to be absent, consistent with the scenario above.

#### Scenario: Domain catalog capabilities are discoverable

- **WHEN** a caller asks which provider can list domains, create on a chosen
  domain, or restore an already-issued session
- **THEN** each answer SHALL come from the contract's typed capability surface
- **AND** no client SHALL decide capability by testing a provider identifier

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

A fallback is **bounded** and **visible**: each configured provider SHALL be
attempted at most once during one creation, the throttle SHALL be surfaced with
the provider's own signal, and no attempt SHALL be repeated silently in a
background loop. When every configured provider declines, the reported failure
SHALL retain the normalized error code of the failure that decided the outcome,
rather than being replaced by an untyped composition that describes the failures
only in prose.

#### Scenario: A fallback attempt is bounded and visible

- **GIVEN** more than one configured provider
- **WHEN** creation falls back after one provider declines
- **THEN** each configured provider SHALL be attempted at most once
- **AND** the fallback SHALL be reported to the user rather than retried silently

#### Scenario: Bounded fallback preserves the normalized failure

- **GIVEN** several configured providers each declining creation
- **WHEN** the client exhausts its bounded fallback attempts
- **THEN** the reported failure SHALL carry a normalized error code
- **AND** it SHALL NOT be an untyped error whose only failure detail is prose
