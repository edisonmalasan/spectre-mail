# Spec Delta

## ADDED Requirements

### Requirement: The polling cadence states the provider guidance it was measured against

The session's polling cadence SHALL state, for each provider it reaches, **the published guidance
that cadence was chosen against**, quoted verbatim and attributed, or SHALL state that no such
guidance was located and name the paths that were tried. A provider that publishes qualitative
guidance without publishing a figure SHALL be recorded as **having published guidance**, and SHALL
NOT be recorded as having published nothing.

**This requirement exists because the cadence's basis was an absence that was never checked.** The
cadence — 5 seconds while a mailbox's contents are changing, doubling per unchanged check, capped at
30 seconds — was chosen with the record stating that **no provider limit had been measured for the
only provider a browser can reach, because that provider publishes nothing.** The one provider is
Guerrilla Mail, and **its API document publishes two sentences this repository had not read:**

> *"Note: The API may be rate limited, **but we do not publish our rate limits**."*
>
> *"**The client should not check email too many times as to not overload the server.**"*

**The first confirms the record and the second is new**, and it is addressed to **a client** — which
is what this product is. **Recording that provider as publishing nothing is therefore false, and the
cadence was selected against a false statement about what its own provider publishes.**

**What this requirement does not require is a slower cadence, and that is deliberate.** A
qualitative prohibition is not a limit, this repository does not invent figures it has not measured,
and **the cadence has never been run against a live provider at all** — so nothing here says what
five seconds costs anybody. What is required is that the basis be stated, so that a maintainer reads
the provider's own sentence beside the number this product chose rather than reading silence.

**The mechanism already exists.** The website's footer renders a provider's verbatim limit statement
with its scope disclaimed; **only the second provider's quote was missing**, and this requirement is
what stops it being missing again silently.

#### Scenario: The cadence's basis is read

- **WHEN** the cadence is stated
- **THEN** each provider it reaches SHALL be named with the published guidance that cadence was
  chosen against, quoted verbatim and attributed
- **AND** the citation SHALL name where that guidance was read

#### Scenario: A provider publishes no figure but does publish guidance

- **WHEN** a provider publishes qualitative guidance and no figure
- **THEN** the record SHALL quote the guidance
- **AND** it SHALL NOT record that the provider publishes nothing

#### Scenario: A provider publishes nothing that was found

- **WHEN** no guidance was located for a provider
- **THEN** the record SHALL name the paths that were tried and their results
- **AND** it SHALL NOT assert a figure for that provider's tolerance