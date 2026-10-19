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

**Amendment, recorded during apply (2026-10-19).** This requirement previously carried a clause
about **a UI conflict** — the extension's control living in a shadow root, and the control being
able to tell that it is not visible on the page it is beside.

**That clause is withdrawn, and the reason is a channel rather than a difficulty.** The content
script is the only party that can see its own control, and **the extension has no existing message
kind that asks it about anything but the host it is beside or a field to fill.** Adding one is a
protocol change, and **a protocol change is a different change from this one** — the same argument
`mailbox-history` used when it recorded that the browser tier could not produce a provider
delivery this repository has never received.

**The measurement is real and the gap is recorded rather than dropped.** The conflict is
**partly collectable** — the control can see that it is not visible — and `docs/BETA.md` says so,
in the *"what is not collected and why"* section, with what would be needed to collect it. **A goal
recorded as unmeasured with its reason is a goal the next reader can pick up; a goal quietly
dropped is a goal that looks collected.**

**And a second amendment, recorded during apply (2026-10-19): the shape is two, not three.** The
shared definition this requirement names once carried **an elapsed duration** as a third kind, and
it is withdrawn. **The website's page forbids any interval of the product's own** -- its own test
says so: *"any figure here would be an invention presented as a measurement"* -- **and the panel
had never shown one either**, so **a report would have been the first place the product showed a
figure of its own.** The shape is removed rather than kept and unused, **because a shape with no
consumer is a schema to migrate rather than a feature.**

**The extension's stored records are unaffected by this requirement.** A mailbox, a site
association and a seen-message id are **records the product keeps for the product's own reasons**;
a diagnostic is a report of what happened, and the two are not the same kind of thing.

#### Scenario: The in-page outcome is reported

- **WHEN** a person asks the extension what this session has done
- **THEN** it SHALL report the in-page recogniser's own answer for each attempt — a field filled, no
  field found, the field already held text, the frame was not the top one
- **AND** it SHALL report a count for each of those answers


#### Scenario: The diagnostic is read for what it must not hold

- **WHEN** the extension renders the diagnostic
- **THEN** no address, message id, sender, subject, hostname, URL or content SHALL appear in it
- **AND** every value it shows SHALL be a count or a normalized outcome

#### Scenario: The session ends

- **WHEN** the extension's session ends
- **THEN** nothing it reported SHALL remain on the device
- **AND** no record of it SHALL be written to any store, in any area
- **AND** the extension's own stored records SHALL be unaffected