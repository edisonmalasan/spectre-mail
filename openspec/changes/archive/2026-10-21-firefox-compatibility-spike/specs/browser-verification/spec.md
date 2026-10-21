# Spec Delta

## MODIFIED Requirements

### Requirement: What the browser tier establishes is stated, not assumed

The repository SHALL record what the browser tier proves **and what it does not**, and a
claim it does not establish SHALL NOT be reported as established by it. In particular,
using an address on a third-party site, and a provider's tolerance of this page's polling
cadence, require a real third-party sign-up and cannot be established by a suite that
issues no network request.

**And the engine SHALL be named, per engine.** A claim about an engine SHALL be
made by naming the engine that established it, and **a second engine SHALL add a second set of
claims rather than widening the first** -- because *"verified in Chromium and Firefox"* is a
phrase that means *"verified somewhere"*, and adding a project per engine turns *"verified"*
into *"verified somewhere"* without adding evidence about the claim.

**And an engine the tier cannot reach SHALL be named as unreachable.** It SHALL NOT be omitted,
and it SHALL NOT be called unsupported: **unreachable is a fact about this repository's
automation, and unsupported is a claim about the product**, and the two are not the same
statement.

**And a measurement of a route is a measurement of that route.** Where a platform's behaviour
was established by reaching it through one route, the record SHALL say so, **because a route that
failed is evidence about the route and not about the platform.**

#### Scenario: A claim remains unverified after the suite passes

- **WHEN** the browser suite passes
- **THEN** any claim it does not establish SHALL still be recorded as unverified
- **AND** it SHALL NOT be reported as established

#### Scenario: The result is stated with its limits

- **WHEN** the browser suite's result is recorded
- **THEN** it SHALL name the platform it ran against
- **AND** it SHALL name the substrate it does not speak for

#### Scenario: A second engine adds a second set of claims

- **GIVEN** the browser tier runs against more than one engine
- **THEN** each claim SHALL name the engine that established it
- **AND** the second engine's claims SHALL be stated separately from the first's

#### Scenario: An engine the tier cannot reach is named as unreachable

- **GIVEN** an engine the browser tier's automation cannot reach
- **THEN** the record SHALL name that engine as unreachable
- **AND** it SHALL NOT call that engine unsupported, and SHALL NOT omit it

#### Scenario: A platform was reached by one route only

- **GIVEN** a platform's behaviour was established by reaching it through one route
- **THEN** the record SHALL say so
- **AND** a route that failed SHALL NOT be carried as evidence about the platform
