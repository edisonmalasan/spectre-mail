# extension-client Specification

## Purpose

Records what the browser extension is, what it deliberately does not contain yet,
and how each of those claims is established.

The extension is the second consumer of every shared package this repository has, and it exists
to prove the abstraction survives a client that is not a web page. That is the whole argument
for building it: a layer that only one consumer uses has never been tested by a second caller,
so `apps/extension` reaching through the same `MailProvider`, `SpectreStorage`, and mailbox
session is evidence about those abstractions rather than about the extension.

**Its absences are requirements, which is the part worth stating.** There is no content script,
no side panel, no notification, and no one-time-code control, and each absence is asserted. A
declared surface that renders nothing is fake UI, which this product does not ship, and an
absence that is only an omission reads as an oversight and gets filled in by whatever change
touches the file next. Each one belongs to a named later milestone, and the requirement that
forbids it is amended by that milestone rather than deleted.

**The service worker's limits are the same shape, and they are measured rather than assumed.**
An MV3 background worker is idle-terminated and `chrome.alarms` has behaviour this repository
had not observed, so the worker carries no polling loop and creates no alarm. Both facts were
then measured in real Chromium and recorded in `docs/PROVIDERS.md` §4.1 — the worker was still
registered after a full 30 000 ms idle window, and `chrome.alarms` stored every requested period
unchanged down to 999.6 ms. **Neither measurement is a lifetime or a firing time**, and the
chrome.alarms packing interval remains the open question D1 still depends on.

**What nothing here establishes, stated at the top because a Purpose is read once and the
limits are what get forgotten.** Every provider response in the extension's browser tier is a
**recorded** one, so `use it externally` is unverified and a stored mailbox has never been
reconciled against a live session. **No test in either browser tier reads a rendered pixel's
colour or position**, so nothing in this capability says how the popup looks. And the extension
reaches a provider over a real privileged context, which the two host-permission halves in
`provider-abstraction` establish about the *declared pattern* — not about the signup flow.

## Requirements

### Requirement: The extension is a Chromium MV3 client over the shared packages

The extension SHALL be a Manifest V3 Chromium client that reaches every provider, the domain
model, the mailbox session, and persistence through the shared packages, and it SHALL NOT contain
its own copy of provider, parsing, mailbox-lifecycle, or storage behaviour. A second client
consuming the same abstraction is the deliverable this milestone exists to demonstrate, so a
behaviour implemented a second time under `apps/extension` SHALL fail the build rather than
diverge quietly.

Two clients reading the same packages are not thereby prevented from telling a visitor two
different stories about the same surface. Where one client **depicts** another's - a section of
the website describing this popup - the depiction's labels SHALL be labels this popup renders,
and a label it does not render SHALL fail the build.

**This is the requirement's existing rule pointed at a second place it can be broken.** The two
clients already share every package, and the package boundary is what keeps their _behaviour_
from diverging; nothing in it kept the website's _description_ of this popup from drifting away
from the popup. A depiction held against the popup's copy cannot drift unnoticed, because the
build fails when it does.

#### Scenario: The extension reaches a provider

- **WHEN** the extension creates a mailbox
- **THEN** it SHALL do so through the shared provider abstraction
- **AND** it SHALL NOT contain a provider wire format, a provider JSON field name, or a request
      path of its own

#### Scenario: A behaviour already in a package is reimplemented in the extension

- **WHEN** a file under `apps/extension` implements provider selection, message parsing, mailbox
      lifecycle, or storage access
- **THEN** the architecture boundary test SHALL fail
- **AND** the failure SHALL name the file and the behaviour

#### Scenario: The two clients diverge

- **WHEN** a change would make `apps/web` and `apps/extension` report the same situation
      differently
- **THEN** the divergence SHALL be resolved in a shared package rather than in either client

#### Scenario: One client depicts the other's surface

- **GIVEN** the website renders a section describing this popup
- **WHEN** the popup's declared copy renames or removes a label that section shows
- **THEN** the build SHALL fail and name the section and the label

#### Scenario: A depicted label is not the popup's

- **WHEN** the section describing this popup shows a label the popup does not render
- **THEN** the build SHALL fail and report that label by name

#### Scenario: The popup gains a surface

- **WHEN** a later milestone adds a popup region or control
- **THEN** the website's description of the popup SHALL be amended in that same change
- **AND** it SHALL NOT be left describing a popup that no longer exists in that form

### Requirement: The extension reaches Mail.tm first and Guerrilla Mail behind it

The extension SHALL declare its providers as a single named list in preference order, SHALL
prefer Mail.tm, and SHALL fall back to Guerrilla Mail when Mail.tm is unavailable. The list SHALL
be the client's configuration rather than documentation beside it: the factory SHALL derive from
the exported list, and the adapter registry SHALL be typed exhaustively over it, so a declared
provider with no adapter SHALL NOT compile.

**This client's list has two entries because two entries is what it can reach.** The website's
list is one entry long and states that keeping it so is a requirement, because a second entry
would claim redundancy a web page does not have. Here the redundancy is real: Mail.tm sends CORS
headers to its own origins only, so no compliant page can reach it, while an extension with host
permission can. That is a measured difference between two host environments, not a preference
about either provider.

#### Scenario: The extension creates a mailbox

- **WHEN** the extension creates a mailbox
- **THEN** it SHALL prefer Mail.tm
- **AND** it SHALL fall back to Guerrilla Mail when Mail.tm is unavailable
- **AND** it SHALL report which provider it used

#### Scenario: A fallback occurs

- **WHEN** Mail.tm cannot be reached and the extension falls back to Guerrilla Mail
- **THEN** the extension SHALL report the provider it actually used rather than the one it
  preferred
- **AND** it SHALL NOT describe a fallback as a success against the preferred provider

#### Scenario: A provider is added to the list

- **WHEN** a provider id is added to the exported list with no adapter beside it
- **THEN** the client SHALL NOT compile

### Requirement: The extension declares its non-goals as requirements rather than leaving them absent

The extension SHALL NOT declare a content script, a side panel, a notification, a one-time-code
copy or fill control, or a verification-link control in this milestone, and each absence SHALL be
asserted. A declared surface that renders nothing or acts on nothing is fake UI, which this
product does not ship: in-page integration belongs to the in-page milestone, the side panel to
the side-panel milestone, and the verification workflow to the workflow milestone.

An absence that is merely an omission reads as an oversight and is eventually filled in by
whatever change touches the file next. Asserting it makes the boundary deliberate, and makes the
milestone that does own the surface the only one that may add it.

#### Scenario: The manifest is read

- **WHEN** the extension's manifest is read
- **THEN** it SHALL declare no content script and no side panel
- **AND** it SHALL request no permission that no shipped surface uses

#### Scenario: A later milestone adds a declared surface

- **WHEN** the in-page milestone adds a content script
- **THEN** it SHALL amend this requirement in its own change rather than deleting the assertion

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

#### Scenario: The worker is inspected

- **WHEN** the extension's service worker source is read
- **THEN** it SHALL schedule no repeated provider request
- **AND** it SHALL create no alarm

#### Scenario: A change needs a background poll

- **WHEN** a change would place the polling session in a background context
- **THEN** the recorded measurement SHALL already exist
- **AND** the effective cadence SHALL be reconciled explicitly with the shared cadence rather than
  diverging from it silently

#### Scenario: The measurement has not been taken

- **WHEN** the service worker's lifetime has not been measured in this repository
- **THEN** no requirement may state what the worker can sustain
- **AND** no document may claim a background polling cadence this repository has not observed

### Requirement: The extension's popup performs its first milestone's actions over the shared session

The extension's popup SHALL create a mailbox, copy the mailbox address, name the provider it used,
report the provider's status, and show an inbox count — and each SHALL be performed through the
shared mailbox session rather than by the popup's own logic. The inbox count SHALL come from an
explicit check the user asked for, because no background polling exists in this milestone.

The popup SHALL NOT offer a provider selector. The extension reaches two providers, so a selector
becomes meaningful here in a way it is not on the website — but at this milestone choosing is not a
user action, it is a disclosure, and a control that can only report which provider answered is a
control that cannot act. The popup names the provider and, where a fallback occurred, names the
one it fell back from.

#### Scenario: The popup is opened

- **WHEN** a user opens the popup
- **THEN** it SHALL offer to create a mailbox, and SHALL name the provider it will reach
- **AND** it SHALL NOT offer a control for choosing a provider

#### Scenario: A mailbox exists

- **WHEN** the popup holds a mailbox
- **THEN** it SHALL offer to copy the address
- **AND** it SHALL show the provider that mailbox belongs to
- **AND** it SHALL show a count of messages obtained from a check the user asked for

#### Scenario: The provider is failing

- **WHEN** the popup asks the shared session for provider status
- **THEN** it SHALL render what the session reports
- **AND** it SHALL NOT render a status it computed itself

### Requirement: The extension ships its own browser-verification tier

The extension's browser tests SHALL run in a suite that loads the built extension into a real
Chromium extension context, and every shipped extension spec SHALL be collected by that suite and
by no other suite. The website's browser suite SHALL NOT collect extension specs, and the
extension's SHALL NOT collect website specs, because a spec no suite collects reads as coverage
while verifying nothing.

The collection rule SHALL read the extension's runner configuration rather than a hard-coded
path, so narrowing its test directory is reported instead of passing.

#### Scenario: A spec is added

- **WHEN** a browser spec is added under the extension's suite
- **THEN** the architecture boundary test SHALL require it to be collected
- **AND** it SHALL report the file by name when no configured suite collects it

#### Scenario: The extension's suite is narrowed to nothing

- **WHEN** the extension's test directory or match pattern is emptied
- **THEN** the collection rule SHALL report that the suite collects nothing
- **AND** it SHALL NOT pass because the specs are still present on disk

#### Scenario: An extension spec is added to the website's suite

- **WHEN** an extension spec is collected by the website's browser suite
- **THEN** the architecture boundary test SHALL fail
