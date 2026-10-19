# Spec Delta

## ADDED Requirements

### Requirement: The extension reports its own outcomes on the same terms, and names the conflicts it can see

The extension SHALL report, to the person using it, **the outcomes of the session in progress**,
under the same terms the website reports its own: **counts and normalized outcomes only, never an
address, a message id, a sender, a subject, a hostname, a URL, or content**, and **persisted
nowhere**.

**The extension has one outcome the website does not, and the product already knows it.** The
in-page recogniser answers with its own vocabulary — a field was filled, no field was found, the
field already held text, the frame was not the top one, the request was not its own — and **that
answer is exactly the "email-field injection failures" the roadmap's beta goals ask for.** It is
already produced, already normalized, and **already says why**, which is the whole of what a
failure count is worth.

**The extension can also see a UI conflict, and it can see only part of one.** Its own control lives
in a **shadow root**, and a shadow root is exactly what lets a page's stylesheet reach a control —
so the extension can read that control's visibility from inside the root and report that a conflict
happened. **It cannot say whose it was**, because the page's stylesheet is the page's business and a
diagnostic naming a selector would be holding a piece of the page. **A measurement and a fingerprint
are different things, and this one is a measurement.**

**The extension's stored records are unaffected by this requirement.** A mailbox, a site
association and a seen-message id are **records the product keeps for the product's own reasons**;
a diagnostic is a report of what happened, and the two are not the same kind of thing.

#### Scenario: The in-page outcome is reported

- **WHEN** a person asks the extension what this session has done
- **THEN** it SHALL report the in-page recogniser's own answer for each attempt — a field filled, no
  field found, the field already held text, the frame was not the top one
- **AND** it SHALL report a count for each of those answers

#### Scenario: A conflict is visible

- **WHEN** the extension's own control is not visible on the page it is beside
- **THEN** the extension SHALL report that a conflict happened
- **AND** it SHALL NOT report which rule on the page caused it

#### Scenario: The diagnostic is read for what it must not hold

- **WHEN** the extension renders the diagnostic
- **THEN** no address, message id, sender, subject, hostname, URL or content SHALL appear in it
- **AND** every value it shows SHALL be a count or a normalized outcome

#### Scenario: The session ends

- **WHEN** the extension's session ends
- **THEN** nothing it reported SHALL remain on the device
- **AND** no record of it SHALL be written to any store, in any area
- **AND** the extension's own stored records SHALL be unaffected