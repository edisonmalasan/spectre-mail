# DELTA

## MODIFIED Requirements

### Requirement: The extension declares its non-goals as requirements rather than leaving them absent

The extension SHALL NOT declare a side panel, a notification, a one-time-code copy or fill control,
or a verification-link control in this milestone, and each absence SHALL be asserted. A declared
surface that renders nothing or acts on nothing is fake UI, which this product does not ship: the
side panel belongs to the side-panel milestone and the verification workflow to the workflow
milestone.

An absence that is merely an omission reads as an oversight and is eventually filled in by
whatever change touches the file next. Asserting it makes the boundary deliberate, and makes the
milestone that does own the surface the only one that may add it.

**Amendment, recorded at proposal (2026-10-07), by `in-page-address`.** The content script is no
longer on this list. This requirement's own second scenario required the in-page milestone to amend
this text rather than delete the assertion, and this is that amendment: **the content script comes
out and everything else stays on**, because the side panel, the notification and the verification
controls are still milestones that have not run. The assertion survives in the form that matters —
each remaining absence is still declared, and still asserted.

**The second scenario was generalised, and that is a change worth naming.** It read *"WHEN the
in-page milestone adds a content script"*, which described one event that has now happened and
therefore guards nothing afterwards. It now names the class of event, so the rule keeps applying to
the surfaces still on the list.

#### Scenario: The manifest is read

- **WHEN** the extension's manifest is read
- **THEN** it SHALL declare no side panel
- **AND** it SHALL declare the content script its in-page surface needs
- **AND** it SHALL request no permission that no shipped surface uses

#### Scenario: A later milestone adds a declared surface

- **WHEN** a milestone adds a surface this requirement forbids
- **THEN** it SHALL amend this requirement in its own change rather than deleting the assertion
