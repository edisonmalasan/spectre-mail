# Spec Delta

## MODIFIED Requirements

### Requirement: The website reaches Guerrilla Mail and no other provider

The website SHALL configure exactly one provider, Guerrilla Mail, and SHALL NOT
configure Mail.tm, offer it as a fallback, or probe for it. It SHALL offer no
control for choosing a provider, and SHALL NOT present that absence as a missing
or forthcoming feature.

**Note, recorded during proposal.** Mail.tm sends CORS headers only to its own
origins, so no compliant web page can reach it — measured, not assumed. A
SpectreMail-operated backend to relay it is explicitly forbidden by
`provider-abstraction`. Configuring it here would therefore produce a runtime
failure whose cause the user could not see and could do nothing about. The
extension's Mail.tm-primary policy is unchanged; this is a client-configuration
fact, not a verdict on the provider.

#### Scenario: The website page loads

- **WHEN** a page of the website is served and its provider configuration is read
- **THEN** exactly one provider SHALL be configured
- **AND** it SHALL be Guerrilla Mail
- **AND** no request SHALL be made to any other provider's origin

#### Scenario: The provider selector is present

- **WHEN** the website renders a provider selector
- **THEN** it SHALL offer no provider that the website cannot reach
- **AND** its absence SHALL NOT be presented as a missing feature

#### Scenario: The website is displayed

- **WHEN** the website is displayed in any state
- **THEN** it SHALL offer no control for choosing a provider
- **AND** it SHALL name the provider it reaches
- **AND** it SHALL NOT describe the absence as missing or forthcoming

#### Scenario: A second provider becomes reachable from a web page

- **GIVEN** the website is configured with exactly one provider
- **WHEN** a second provider is added to the website's configuration
- **THEN** the change SHALL be confined to that configuration
- **AND** no part of the website's presentation SHALL need to change
- **AND** the website SHALL reach only providers it can actually access

**Amendment, recorded during apply planning (2026-10-04).** Two scenarios are
added. Both address claims that were previously made only in code comments, where
nothing could check them.

**The website is displayed** exists because *The provider selector is present* has
a `WHEN` that never holds — the website renders no selector, so the scenario
constrains nothing today. The test that noticed this recorded the consequence
precisely: "A conditional scenario with nothing asserting the condition is the
shape that hides a whole slice: nobody can tell whether the selector was
forgotten, deliberately deferred, or quietly removed." It also stated that it was
"expected to be **replaced**" when the selector slice landed, "and the replacement
is the honest thing to do — this one would otherwise start failing and someone
would delete it."

That replacement was **not** made, and the reason is worth recording.
`openspec validate --strict` refuses a `MODIFIED` block that omits a scenario the
current spec still has, on the grounds that a modified requirement replaces the
whole block. Re-reading the conditional scenario against that constraint showed the
refusal was right: its clauses are a correct rule for *any* client that renders a
selector, including the extension at M8. Deleting it would have removed a genuine
forward constraint to tidy a title. So it stays, unedited, as the rule for a
client that has a selector to render — and the new scenario states what is true of
the website today, which is that it offers no control and names the one provider it
reaches.

That last clause is the substantive change. A page which merely omits a selector
leaves a reader unable to tell whether one was forgotten; naming Guerrilla Mail
makes the single-provider dependency the *known limitation* `provider-abstraction`
requires it to be recorded as, rather than presented as redundancy.

**A second provider becomes reachable from a web page** has no predecessor, and
addresses a requirement the website was failing. `provider-abstraction`'s scenario
*A client has only one provider* already requires that "adding a second provider
SHALL remain additive through the abstraction, not require a rewrite". That clause
was true of the abstraction and **false of the website's configuration**:
`WEBSITE_PROVIDER_IDS` was documented as making "adding a provider ... a visible
edit to one list", while `createWebsiteProviderManager` never read it and
constructed the adapter directly, so a second provider had to be added in two
places. The existing test asserted the coupling that did not exist, and its own
comment conceded "the two constants must be changed together, so that is now said
rather than implied".

This scenario states the requirement so the configuration can be made to satisfy
it, rather than merely documented as not violating it. The alternative — keeping
the comment and calling the requirement satisfied — is the same defect this
repository has recorded seven times: a check narrower than the rule it documents.