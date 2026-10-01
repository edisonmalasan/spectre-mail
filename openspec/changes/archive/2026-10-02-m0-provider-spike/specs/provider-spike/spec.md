# Spec Delta

## Purpose

Defines the disposable provider compatibility spike that proves, with reproducible tooling and recorded evidence, whether real temporary-mail providers can deliver the mailbox lifecycle SpectreMail depends on in the target browser environments, and requires that the resulting findings replace roadmap assumptions rather than confirm them.

## ADDED Requirements

### Requirement: Provider lifecycle coverage

The spike SHALL exercise, against the real provider APIs, the mailbox lifecycle operations SpectreMail depends on, and SHALL record a distinct pass/fail/unverified outcome for each one rather than aborting the run at the first failure.

The covered operations SHALL include address or domain discovery, mailbox creation, mailbox authentication or session establishment, message listing, message fetch, mailbox or message deletion where the provider supports it, provider error handling, and real-time or push transport behaviour.

#### Scenario: A provider operation fails unexpectedly

- **WHEN** an individual lifecycle probe fails or errors
- **THEN** the spike records that probe as failed with the observed error
- **AND** the remaining probes for that provider still run
- **AND** the overall spike run completes and reports a summary

#### Scenario: A provider does not support an operation

- **WHEN** a provider does not implement an operation the spike probes for
- **THEN** the spike records the operation as unsupported for that provider
- **AND** the finding document states the limitation explicitly

#### Scenario: A provider offers no equivalent of a probed operation

- **WHEN** no endpoint exists for a probed capability such as real-time delivery
- **THEN** the spike records the absence as a verified negative finding
- **AND** the finding document records what was probed and what was returned

### Requirement: Real external message delivery

The spike SHALL attempt to deliver a genuine external email into a freshly created mailbox and observe it arriving through the provider's own message-listing and message-fetch operations.

Delivery SHALL be attempted through a sender that can actually deliver mail. When no delivering sender is available to the spike, the outcome SHALL be recorded as unverified with the reason stated, and the spike SHALL support an interactive mode that prints a live address and waits for a maintainer-sent message so the check can still be completed.

#### Scenario: No delivering sender is configured

- **WHEN** the spike runs without a configured sender capable of delivering mail
- **THEN** real-delivery checks are recorded as unverified rather than passed
- **AND** the reported reason names the missing capability
- **AND** no probe is recorded as successful that did not observe a real inbound message

#### Scenario: A sender is configured and delivery succeeds

- **WHEN** a delivering sender is configured and a real external message is sent to the created address
- **THEN** the spike observes the message through the provider's message-listing operation
- **AND** the spike fetches the message and records the observed sender, subject, and a redacted body excerpt

#### Scenario: Interactive delivery mode

- **WHEN** the spike is run in interactive mode
- **THEN** the created address is printed for the maintainer to send to
- **AND** the spike polls for an inbound message until one arrives or the configured timeout elapses

#### Scenario: Interactive mode times out

- **WHEN** the interactive timeout elapses with no inbound message
- **THEN** real-delivery is recorded as unverified with the timeout stated
- **AND** the created address is preserved in the report so the check can be repeated

### Requirement: Browser environment verification

The spike SHALL execute provider request probes from a real normal web page and from a real Chromium extension context, in addition to any non-browser environment, so that browser-context feasibility is measured in an actual browser rather than inferred from response headers.

#### Scenario: Provider is called from a normal web page

- **WHEN** a provider request is issued from an ordinary page origin
- **THEN** the spike records whether the browser permitted the request and the observed response
- **AND** a blocked request is recorded as blocked, not as a provider failure

#### Scenario: Provider is called from an extension context

- **WHEN** a provider request is issued from a loaded Chromium extension context that holds host permissions for the provider
- **THEN** the spike records whether the extension context permitted the request
- **AND** the result is recorded separately from the normal-page result so the two environments are never conflated

#### Scenario: CORS preflight is required

- **WHEN** a provider request would be non-simple, such as one sending a JSON body or an authorization header
- **THEN** the spike records the outcome of the preflight separately from the outcome of the actual request

### Requirement: Findings are recorded, not assumed

The spike SHALL produce a provider findings document that records observed endpoints, authentication and session models, browser and CORS restrictions, rate limits, expiration behaviour, real-time behaviour, observed failure modes, fallback viability, and provider terms that affect the product.

Findings SHALL be derived from the spike's recorded results. Where a step is unverified, the document SHALL say so rather than presenting a planning assumption as a confirmed result.

#### Scenario: A roadmap assumption is contradicted by an observation

- **WHEN** an observation contradicts an assumption recorded in the roadmap
- **THEN** the findings document records the observation as the outcome
- **AND** the roadmap records the contradiction and its effect on later milestones
- **AND** the roadmap's original assumption is not silently retained

#### Scenario: A check could not be executed

- **WHEN** a required check is skipped, blocked, or incomplete
- **THEN** the findings document lists it under an explicit unverified or blocked heading
- **AND** the reason and the consequence for the product are stated

### Requirement: Provider rate-limit discipline

The spike SHALL stay within provider-request budgets and SHALL NOT execute against real provider APIs on every routine repository operation.

#### Scenario: Spike is run repeatedly

- **WHEN** the spike is executed more than once in short succession
- **THEN** provider account-creation calls are limited to respect the provider's documented creation rate limit
- **AND** the spike reports rate-limit responses as an observed provider behaviour instead of retrying indefinitely

#### Scenario: Routine development operation

- **WHEN** a developer runs routine repository commands such as install, lint, or typecheck
- **THEN** no real provider request is issued

### Requirement: Spike isolation and honesty

The spike SHALL be isolated from production product code, SHALL NOT be imported by any application, and SHALL NOT contain logic that later milestone work would be tempted to reuse as a provider implementation.

#### Scenario: Spike code is later replaced by a real provider adapter

- **WHEN** a production provider adapter is implemented
- **THEN** the adapter does not import from the spike directory
- **AND** the spike is either removed or clearly marked as historical when the roadmap reaches that point

#### Scenario: Spike run summary is reported

- **WHEN** a spike run finishes
- **THEN** the summary reports counts of passed, failed, unsupported, and unverified checks
- **AND** the summary does not describe an unverified check as a success

#### Scenario: A probe cannot run because of the harness rather than the provider

- **WHEN** a probe's own preconditions are not met, such as polling a mailbox whose
  credentials were revoked before the probe ran
- **THEN** the probe SHALL NOT record the outcome as a provider limitation or as
  `unverified`, because both misrepresent a harness fault as a provider finding
- **AND** it SHALL report the outcome as a harness fault that identifies the
  precondition which was violated
- **AND** it SHALL abort promptly rather than consuming its whole timeout against a
  resource that cannot produce the awaited result

> Added after implementation. Real delivery was first recorded as `unverified` for
> both providers because the spike deleted the Mail.tm mailbox before polling it
> and advertised a stale Guerrilla address. An `unverified` outcome for a harness
> fault is indistinguishable from a genuine provider gap, and would have been
> written up as one. See `docs/PROVIDERS.md` §5.1.
