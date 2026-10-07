# Spec Delta

## MODIFIED Requirements

### Requirement: The background service worker carries no polling until its lifetime is measured

The extension's background service worker SHALL be declared and SHALL contain no polling loop in
this milestone, and this absence SHALL be asserted. The extension's shared mailbox session polls on
an injected scheduler with a five-second prompt delay and a thirty-second ceiling, while an MV3
background service worker is idle-terminated and `chrome.alarms` enforces a floor of its own. The
relationship between those facts has not been measured in this repository, so no polling may be
built on an assumption about it.

The milestone SHALL measure, in real Chromium, how long the worker survives idle and what period
`chrome.alarms` accepts, and SHALL record both in the provider documentation before any decision
is taken about which context owns the session.

**Amendment, recorded at proposal (2026-10-08), by `in-page-mailbox`.** The worker is no longer
empty, so "contains no polling loop" needed a companion: the worker now performs **work on
request**, and the property that has to survive that is not *emptiness* but **retention**. An
idle-terminated worker that holds a session between events holds one that may be terminated holding
it. So this requirement now also forbids the worker from keeping anything after it has answered —
no session, no mailbox, no scheduled work — which is a stricter and more useful rule than the
emptiness it replaces, and it is the rule the on-request handler was designed to satisfy. The
existing measurement obligations are unchanged: the recorded 30-second idle bound and the round-trip
measurement this change adds are both **bounds, not a lifetime**, and neither licenses a cadence.

#### Scenario: The worker is inspected

- **WHEN** the extension's service worker source is read
- **THEN** it SHALL schedule no repeated provider request
- **AND** it SHALL create no alarm

#### Scenario: The worker has answered

- **WHEN** the extension's service worker has answered a request
- **THEN** it SHALL hold no session, no mailbox, and no scheduled work from it

#### Scenario: A second request arrives after a first has been answered

- **WHEN** a mailbox-creation request is made after an earlier one has been answered
- **THEN** the worker SHALL create a mailbox for it independently of the earlier request
- **AND** it SHALL NOT reuse the earlier request's mailbox

#### Scenario: A change needs a background poll

- **WHEN** a change would place the polling session in a background context
- **THEN** the recorded measurement SHALL already exist
- **AND** the effective cadence SHALL be reconciled explicitly with the shared cadence rather than
  diverging from it silently

#### Scenario: The measurement has not been taken

- **WHEN** the service worker's lifetime has not been measured in this repository
- **THEN** no requirement may state what the worker can sustain
- **AND** no document may claim a background polling cadence this repository has not observed

## ADDED Requirements

### Requirement: The background worker creates a mailbox on request and persists it before answering

The extension's background service worker SHALL answer a request to create a mailbox by performing
that creation through the shared mailbox session and the shared provider abstraction rather than by
its own logic, and SHALL persist the created mailbox before it answers. It SHALL persist only after
the provider has confirmed the mailbox, because a mailbox stored before the provider confirmed it
would be offered back as though it worked, and this repository has measured a provider answering
`HTTP 200` for a session that does not exist.

The worker SHALL answer on **every** path a request can take, including a provider's refusal and a
failure to persist, because a context that answers on the paths it controls and not on the others
turns a fault into a request that never returns. An answer the worker did not send SHALL NOT be
presented as a refusal: the worker never having answered is a different fact, and it is the page's
to report, not the worker's to have invented.

#### Scenario: A creation request is made

- **WHEN** the extension's background worker receives a request to create a mailbox
- **THEN** it SHALL create that mailbox through the shared mailbox session
- **AND** it SHALL persist the mailbox before answering
- **AND** its answer SHALL carry the created address

#### Scenario: The provider refuses the creation

- **WHEN** the provider refuses a mailbox creation the worker asked for
- **THEN** the worker SHALL answer with a refusal
- **AND** it SHALL carry the provider's own words for the refusal
- **AND** it SHALL persist no mailbox

#### Scenario: Persisting the created mailbox fails

- **WHEN** the worker created a mailbox and storing it failed
- **THEN** the worker SHALL answer that the mailbox could not be stored
- **AND** it SHALL NOT answer that an address is available

#### Scenario: A request the worker does not recognise

- **WHEN** the worker receives a message it does not act on
- **THEN** it SHALL NOT create a mailbox
- **AND** it SHALL NOT persist anything

### Requirement: The extension's platform global is reached through one module

The extension SHALL read its own platform's global — the object through which it reaches its local
storage area and its own background context — from **exactly one module**, and every other module
SHALL reach it through that one. Two contexts in this extension is what makes the claim a boundary
rather than a note: with one context the natural spelling is a global read wherever it is needed, and
with two the natural mistake is two copies of that read kept in agreement by hand.

The requirement names one module rather than a permitted count, because a count is a number that
grows without anybody deciding anything. **A list of allowed readers, added to, is the mechanism by
which a boundary stops being one** — and this repository has already had a rule fire on the only
correct import in the codebase, which is what the single-name form prevents.

#### Scenario: The extension's modules are read for the platform global

- **WHEN** every module in the extension is read
- **THEN** exactly one of them SHALL reach the platform's global
- **AND** every other module SHALL reach it only through that one

#### Scenario: A second module reaches the global

- **WHEN** a module other than the single permitted one reaches the platform's global
- **THEN** the extension's architecture assertions SHALL fail

#### Scenario: Two extension contexts need the platform

- **WHEN** both the extension's popup and its content script need the platform
- **THEN** both SHALL reach it through the same single module
- **AND** neither SHALL contain its own copy of that read