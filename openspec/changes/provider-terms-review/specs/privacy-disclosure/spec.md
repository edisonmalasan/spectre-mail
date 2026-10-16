# Spec Delta

## MODIFIED Requirements

### Requirement: Provider attribution is stated in neither direction

The document SHALL state what was verified about attribution for each provider, and SHALL **not**
state that an attribution obligation exists and SHALL **not** state that none does. Where a
provider's terms were read, the document SHALL quote what they do and do not say about attribution;
where no terms page was located, the document SHALL say so and name the paths that were tried.

Neither direction is available as a claim. **No terms page was located for Mail.tm** — every route
tried returned nothing, at both an unprefixed and a locale-prefixed shape — and **Guerrilla Mail
publishes Terms of Service at `/tos`, linked from its own homepage, which were read on 2026-10-16
and which contain no attribution clause.**

**This requirement is MODIFIED rather than re-ADDED, and the amendment is recorded during sync
(2026-10-16).** Its previous body said *"Guerrilla Mail publishes nothing this repository found"*,
**and that is now measured false** — the provider publishes a terms page, an API document, and a
privacy section, at paths this repository did not look at. **The requirement's own rule is what
makes the amendment necessary rather than optional**: it forbids recording an unread absence as
though it had been read, and this repository had recorded one. **Adding a neighbouring requirement
instead of amending this one would have left `openspec/specs/` holding two requirements that
contradict each other**, which is the shape in which an amendment gets attributed to the wrong
assertion.

**What the amendment does not do is resolve attribution.** A terms page that contains no attribution
clause is not a permission and not a prohibition; it is a document that does not mention the
subject, and **the difference between that and a document that grants a permission is the difference
between reading a document and reading an absence into it.**

`AGENTS.md`'s architecture rules forbid citing provider terms that were not verified, and that rule
cuts both ways: **claiming no obligation is exactly as unsupported as claiming one** — and so is
claiming that a provider publishes nothing.

#### Scenario: The document would resolve attribution in one direction

- **WHEN** the document states that a provider requires attribution
- **OR** the document states that no provider requires attribution
- **THEN** the check SHALL fail
- **AND** the check SHALL fail on the direction rather than on the wording

#### Scenario: A provider's terms were read and are silent on attribution

- **WHEN** the document discusses attribution for a provider whose terms were read
- **THEN** it SHALL state that the terms were read, name where they were read, and record that they
  do not mention attribution
- **AND** it SHALL NOT offer that silence as a permission or as a prohibition

#### Scenario: The document states what was verified

- **WHEN** the document discusses attribution
- **THEN** it SHALL name Mail.tm's terms as not located, and name the paths that were tried
- **AND** it SHALL name Guerrilla Mail's terms as **read**, and name where they were read
- **AND** it SHALL NOT offer a resolution in place of the measurement

**The third clause of this scenario previously read "it SHALL name Guerrilla Mail's as nothing this
repository found", and that clause is what this `MODIFIED` exists to correct.** A `MODIFIED` block
replaces the whole requirement, so the scenario is carried forward here in full and amended rather
than dropped — **the alternative would have been to leave it in the promoted spec beside an amended
body that contradicts it**, which is the shape in which two requirements say opposite things and
neither is noticed. `openspec validate` refuses that substitution, and its refusal is the recorded
reason the scenario came forward at all.