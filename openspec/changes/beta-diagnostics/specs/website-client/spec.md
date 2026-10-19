# Spec Delta

## ADDED Requirements

### Requirement: The page reports this session's outcomes, and persists none of them

The page SHALL report, to the person using it, **the outcomes of the session in progress**: whether a
mailbox was created, which provider code failed when one could not be, whether a message arrived,
and how long it took. It SHALL report **counts and outcomes only** — never an address, a message id,
a sender, a subject, a hostname, a URL, or any message content — and it SHALL **persist none of
them**.

**This requirement exists because the roadmap's beta goals ask for measurements, and the product's
own privacy claim says it keeps nothing outside two named areas.** The way both are true is that
**the measurements are per-session**: a count of what this session did is a fact about the session,
and it does not outlive it. **A measurement that does not outlive the session it happened in does not
need a place to be stored**, and this requirement is about the product holding no third area for it.

**The shape of what may be reported is named rather than left as an absence**, because a list of
prohibitions is a list somebody has to extend one incident at a time. A reported value SHALL be
**a count, a normalized outcome, or an elapsed duration**; and it SHALL NOT be **an address, a
message id, a sender, a subject, a hostname, a URL, a form, a field, or any content**.

**A duration and a timestamp are not the same kind of value**, and the difference is the reason a
duration is the one time-shaped value that may be reported: **a duration says how long a thing
took and cannot be placed on a calendar**, and a timestamp says exactly that.

**A message that has not arrived yet is not a failure**, and the page SHALL NOT report it as one.
**And a provider's normalized code is the fact; the response that carried it is not**, so the page
SHALL report the code and SHALL NOT report the provider's raw answer.

#### Scenario: The session's outcomes are reported

- **WHEN** a person asks the page what this session has done
- **THEN** it SHALL report a count for each outcome it observed
- **AND** it SHALL report a normalized provider code for each failure
- **AND** it SHALL report an elapsed duration for how long a message took to arrive

#### Scenario: The diagnostic is read for what it must not hold

- **WHEN** the page renders the diagnostic
- **THEN** no address, message id, sender, subject, hostname, URL, form, field or content SHALL appear
  in it
- **AND** every value it shows SHALL be a count, a normalized outcome, or an elapsed duration

#### Scenario: The session ends

- **WHEN** the page is closed, reloaded, or the session ends by any other means
- **THEN** nothing it reported SHALL remain on the device
- **AND** no record of it SHALL be written to any store, in any area

#### Scenario: A message has not arrived

- **WHEN** a message has not arrived and nothing has failed
- **THEN** the page SHALL NOT report that as a failure
- **AND** it SHALL NOT report an arrival time for a message that has not arrived