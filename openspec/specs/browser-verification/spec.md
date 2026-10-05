# browser-verification Specification

## Purpose

Runs the built website in a real browser, against the platform storage a user's browser
actually provides, as a verification tier the repository can require to keep passing — so
that claims about persistence and about the storage a page uses stop resting on a test
substrate that is not a browser.

## Requirements

*Provenance: created at the `browser-verification` sync stage (2026-10-05) by copying
that change's delta verbatim. The `## Purpose` is the delta's `## Purpose`, and every
requirement below is byte-identical to its delta block — checked mechanically rather
than by reading.*

### Requirement: The browser suite drives the built website, not an approximation of it

The browser suite SHALL run the website's **built** output rather than a test-only
substitute, and SHALL drive it in a real browser process. A suite that mounts the
components directly would verify a composition the shipped page does not use, since the
page's own entry point builds its provider manager and its storage itself.

A browser spec SHALL NOT be collected by the unit test runner. The two tiers execute
different code against different platforms, and one runner claiming both would report a
browser-free run as covering a browser suite.

#### Scenario: The suite serves the built site

- **WHEN** the browser suite runs
- **THEN** the page under test SHALL be the website's build output
- **AND** it SHALL be served over HTTP rather than driven from a component harness

#### Scenario: A browser spec is not executed as a unit test

- **WHEN** the unit test runner collects its files
- **THEN** no browser spec SHALL be among them
- **AND** the browser suite SHALL still report a failure when no spec was executed

### Requirement: The suite issues no network request

The browser suite SHALL contact no provider and no third-party origin. Provider traffic
SHALL be served from responses already committed to this repository, and the suite SHALL
fail if a request would have left the machine.

**This is a property of the suite rather than a limit on it.** Every other test in this
repository runs from recorded responses, and a suite that contacted a provider would be
the single test whose result depended on a third party's availability — a red run that
could not say whether the product broke or the provider did. It would also make the
suite's result unreproducible, and a check nobody can reproduce is a check nobody
trusts.

#### Scenario: A provider request is intercepted

- **WHEN** the page under test requests a provider
- **THEN** the request SHALL NOT reach the network
- **AND** a recorded response SHALL be served instead

#### Scenario: The page attempts to reach an origin the suite does not serve

- **WHEN** the page under test requests an origin the suite has no recorded response for
- **THEN** the request SHALL fail
- **AND** the suite SHALL report which origin was unexpected

### Requirement: The storage a page actually uses is verified in a real browser

The browser suite SHALL exercise the storage entry point the website itself calls, and
SHALL assert on **state observable on the device afterwards** — whether the database still
exists — rather than only on what a call returned. A call that resolves successfully and
leaves its data behind is the failure mode this exists to catch, and no assertion about a
return value can see it.

This SHALL cover the whole path a user's browser takes: reading on load, writing a mailbox,
and **removing everything on request**.

#### Scenario: The page reads what a previous visit stored

- **WHEN** the page is loaded in a real browser against a device holding a stored mailbox
- **THEN** it SHALL read that mailbox through the storage the page itself builds
- **AND** it SHALL offer it back only after the provider confirms it

#### Scenario: What the page stores is observable on the device

- **WHEN** the page stores a mailbox
- **THEN** the stored record SHALL be present in the platform's own storage afterwards
- **AND** reading it back through the platform SHALL return that record

#### Scenario: What the page removed is observable to be gone

- **WHEN** the user asks the page to forget the address and the page reports success
- **THEN** the database SHALL no longer exist on the device
- **AND** no record this build wrote SHALL remain readable

#### Scenario: A removal this build does not recognise is removed too

- **GIVEN** the device holds a record the page's build does not recognise
- **WHEN** the user asks the page to forget the address
- **THEN** that record SHALL be gone from the device afterwards

### Requirement: A browser spec cannot be silently skipped

Every browser spec the repository ships SHALL be executed by the browser suite, and the
repository SHALL assert that. A spec that no runner collects reads as coverage while
verifying nothing, which is the same defect as a test that cannot fail.

This rule SHALL cover browser specs wherever they are placed, rather than only where the
first one was put. A rule that watches one directory is invisible in a second one until
something is added there.

#### Scenario: A browser spec is placed outside the suite's own directory

- **WHEN** a browser spec is added
- **THEN** the repository SHALL fail unless the browser suite is configured to collect it

#### Scenario: The collection configuration is narrowed

- **WHEN** the browser suite's file patterns are narrowed so a shipped spec is no longer
        matched
- **THEN** the repository SHALL fail and name the uncovered spec

### Requirement: What the browser tier establishes is stated, not assumed

The repository SHALL record what the browser tier proves **and what it does not**, and a
claim it does not establish SHALL NOT be reported as established by it. In particular,
using an address on a third-party site, and a provider's tolerance of this page's polling
cadence, require a real third-party sign-up and cannot be established by a suite that
issues no network request.

#### Scenario: A claim remains unverified after the suite passes

- **WHEN** the browser suite passes
- **THEN** any claim it does not establish SHALL still be recorded as unverified
- **AND** it SHALL NOT be reported as established

#### Scenario: The result is stated with its limits

- **WHEN** the browser suite's result is recorded
- **THEN** it SHALL name the platform it ran against
- **AND** it SHALL name the substrate it does not speak for
