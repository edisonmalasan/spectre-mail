# Spec Delta

## ADDED Requirements

### Requirement: The page reports this session's outcomes, and persists none of them

The page SHALL report, to the person using it, **the outcomes of the session in progress**: whether a
mailbox was created, which provider code failed when one could not be, whether a message arrived,
and how many arrived. It SHALL report **counts and outcomes only** — never an address, a message id,
a sender, a subject, a hostname, a URL, or any message content — and it SHALL **persist none of
them**.

**This requirement exists because the roadmap's beta goals ask for measurements, and the product's
own privacy claim says it keeps nothing outside two named areas.** The way both are true is that
**the measurements are per-session**: a count of what this session did is a fact about the session,
and it does not outlive it. **A measurement that does not outlive the session it happened in does not
need a place to be stored**, and this requirement is about the product holding no third area for it.

**The shape of what may be reported is named rather than left as an absence**, because a list of
prohibitions is a list somebody has to extend one incident at a time. A reported value SHALL be
**a count or a normalized outcome**; and it SHALL NOT be **an address, a
message id, a sender, a subject, a hostname, a URL, a form, a field, or any content**.

**Amendment, recorded during apply (2026-10-19).** The shape this requirement named was
**three** -- a count, a normalized outcome, **or an elapsed duration** -- and the third is
**withdrawn**.

**The reason is the page's own rule, and it was found by the page's own tests.** The website
forbids **any interval of the product's own** on the page, and the test that holds it says so in
its own words: *"The cadence is this product's own choice: no provider limit was measured for the
only provider a browser page can reach, so any figure here would be an invention presented as a
measurement."* **A report of how long the first message took to arrive is exactly such a
figure**, and the page's test caught it and named it.

**The shape is removed rather than kept and unused, because a shape with no consumer is a schema
to migrate rather than a feature** -- and the extension has no such rule and had never shown an
interval of its own either, so **a report would have been the first place the product showed a
figure of its own.** Mail arrival reliability is reported as **counts** -- listings received,
checks that could not be completed, messages that arrived -- which is what the goal asks for.

**And the report's own sentence changed for a second reason, which is the same kind of
collision.** The report said it was *"gone when you close the page"*, and the page **forbids the
word "gone"** in the state where a provider merely failed to answer, because a word that reads as
"gone" tells a person something false about the only copy of their address -- **and a test cannot
tell whose "gone" it is.** The sentence now says the report is *not kept anywhere*, which is the
same fact without the word.


**A message that has not arrived yet is not a failure**, and the page SHALL NOT report it as one.
**And a provider's normalized code is the fact; the response that carried it is not**, so the page
SHALL report the code and SHALL NOT report the provider's raw answer.

#### Scenario: The session's outcomes are reported

- **WHEN** a person asks the page what this session has done
- **THEN** it SHALL report a count for each outcome it observed
- **AND** it SHALL report a normalized provider code for each failure
- **AND** it SHALL report how many messages arrived

#### Scenario: The diagnostic is read for what it must not hold

- **WHEN** the page renders the diagnostic
- **THEN** no address, message id, sender, subject, hostname, URL, form, field or content SHALL appear
  in it
- **AND** every value it shows SHALL be a count or a normalized outcome

#### Scenario: The session ends

- **WHEN** the page is closed, reloaded, or the session ends by any other means
- **THEN** nothing it reported SHALL remain on the device
- **AND** no record of it SHALL be written to any store, in any area

#### Scenario: A message has not arrived

- **WHEN** a message has not arrived and nothing has failed
- **THEN** the page SHALL NOT report that as a failure
- **AND** it SHALL NOT report a message that has not arrived as though it had