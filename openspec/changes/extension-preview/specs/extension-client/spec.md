# Spec Delta

## MODIFIED Requirements

### Requirement: The extension is a Chromium MV3 client over the shared packages

The extension SHALL be a Manifest V3 Chromium client that reaches every provider, the domain
model, the mailbox session, and persistence through the shared packages, and it SHALL NOT contain
its own copy of provider, parsing, mailbox-lifecycle, or storage behaviour. A second client
consuming the same abstraction is the deliverable this milestone exists to demonstrate, so a
behaviour implemented a second time under `apps/extension` SHALL fail the build rather than
diverge quietly.

Two clients reading the same packages are not thereby prevented from telling a visitor two
different stories about the same surface. Where one client **depicts** another's — a section of
the website describing this popup — the depiction's labels SHALL be the depicted surface's own
declared copy, and a label this popup does not render SHALL fail the build.

**This is the requirement's existing rule pointed at a second place it can be broken.** The two
clients already share every package, and the package boundary is what keeps their _behaviour_
from diverging; nothing in it kept the website's _description_ of this popup from drifting away
from the popup. A depiction assembled from the popup's own strings cannot drift, because there is
nothing in it to drift from.

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