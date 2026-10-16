# Spec Delta

## ADDED Requirements

### Requirement: No provider decision rests on a terms claim this repository has not read at the provider's own served path

A claim about a provider's terms SHALL name a path the provider **served**, and SHALL NOT be
founded on a path that returned nothing. A path that was probed and not served SHALL be recorded as
**a path that was probed**, and SHALL NOT be recorded as a document that does not exist.

**This requirement exists because the distinction has already cost a wrong sentence.**
`docs/PROVIDERS.md` cites `https://mail.tm/terms` returning `404` as the basis for *no terms page
exists*, **while citing `https://mail.tm/en/faq/` returning `200` in the next line** — so this
repository knew the site prefixes its real paths and probed an unprefixed one anyway. Re-measured,
`https://mail.tm/en/privacy/` serves a **Privacy Policy** where `https://mail.tm/privacy` does not.

**The conclusion that Mail.tm serves no terms survived that re-measurement, and the method did
not.** A `404` on a guessed path is evidence that *that path* is not served. It is not evidence
about the site, and **a rule founded on one is a rule founded on an inference from a fact.**

**The standing rule that provider terms which were not verified may not be cited cuts both ways, and
this requirement is its positive half.** Not citing an unread term is necessary; **recording an
unread absence as though it had been read is the same error in the other direction.** A provider's
privacy policy that refers to *"terms of service"* while every route tried for one returns `404` is
a document referring to something this repository has not found, and neither its presence nor its
absence may be asserted.

#### Scenario: A claim is founded on a path that was probed

- **WHEN** a document states what a provider's terms say, require, permit or omit
- **THEN** it SHALL name the path the claim was read from
- **AND** a path that returned no document SHALL be recorded as a path that was probed

#### Scenario: A probed path is recorded as an absence

- **WHEN** a document states that a provider publishes no terms page
- **THEN** it SHALL name the paths that were tried, and each of their results
- **AND** it SHALL NOT present the result of one tried path as a statement about the provider

#### Scenario: A document refers to something not found

- **WHEN** a provider's published document refers to a document this repository has not located
- **THEN** the record SHALL say the document was not located
- **AND** it SHALL NOT state that the obligation is absent
- **AND** it SHALL NOT state that the obligation is present

#### Scenario: A decision would cite a terms claim

- **WHEN** an architectural or product decision rests on what a provider's terms say
- **THEN** the decision SHALL cite a claim that was read at a served path
- **AND** a decision that cannot cite one SHALL be recorded as the repository's own policy rather
  than as a terms judgement