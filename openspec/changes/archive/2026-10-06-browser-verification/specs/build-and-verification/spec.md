# Spec Delta

## ADDED Requirements

### Requirement: A second verification tier runs a real browser, separately from the first

The repository SHALL provide a documented command that drives the website in a real
browser, and it SHALL be **separate from the aggregate verification command**. The
aggregate command SHALL continue to run without a browser installed, because a gate that
cannot run on a contributor's machine is a gate whose result nobody waits for.

The browser command SHALL be invoked by CI, so a regression in what only a browser can
observe fails the build rather than being discovered later.

#### Scenario: A maintainer verifies in a browser

- **WHEN** a maintainer runs the documented browser command from the repository root
- **THEN** it SHALL build the website and drive the built page in a real browser
- **AND** the result SHALL not depend on which directory the command was run from

#### Scenario: The aggregate verification runs without a browser

- **WHEN** the aggregate verification command runs on a machine with no browser installed
- **THEN** it SHALL succeed provided the other checks pass
- **AND** it SHALL NOT require a browser download

#### Scenario: A change that only a browser can observe

- **WHEN** a change is proposed to a pull request
- **THEN** CI SHALL run the browser command as its own check

### Requirement: A browser check issues no network request and says so

A check that drives a browser SHALL NOT contact a provider or any third-party origin
unless it is explicitly declared as a live check, and a live check SHALL NOT be part of
the routine verification a change is expected to pass.

This is a property to preserve rather than an accident to avoid. Every check in this
repository runs from recorded responses, which is what makes a red run diagnosable: it
means the repository's own behaviour changed. A browser check that reached a third party
would be the one check whose result could not say that.

#### Scenario: The browser check runs

- **WHEN** the browser command runs as part of routine verification
- **THEN** it SHALL contact no provider and no third-party origin
- **AND** provider responses it uses SHALL already be committed to the repository

#### Scenario: A live check is ever wanted

- **WHEN** a check would need to reach a live provider to establish its claim
- **THEN** it SHALL be recorded as live rather than added to routine verification
- **AND** the claim it would establish SHALL NOT be reported as established until it runs

### Requirement: The test-substrate boundary is explicit about which substrate is which

Where a property is established on a test substrate that is **not** the platform a user
runs on, the requirement asserting that property SHALL name the substrate and SHALL NOT
present the substrate's agreement with the platform as established.

A substrate that behaves differently from the platform is not a hypothetical concern. It
has already happened once in this repository: a probe built in a way that could not observe
the platform's real behaviour produced a confident and false claim, and it was caught only
because a test written afterwards disagreed with it.

#### Scenario: A property is established only on a substitute platform

- **WHEN** a requirement's property is asserted only against a substitute for the
        platform users run on
- **THEN** the requirement SHALL name that substitute
- **AND** it SHALL NOT state that the platform's behaviour is established

#### Scenario: Both substrates are available

- **WHEN** a property has been established on a substitute and later on the platform itself
- **THEN** the record SHALL state that the platform's behaviour was observed directly
- **AND** it SHALL NOT carry forward the substitute as the thing that was verified
