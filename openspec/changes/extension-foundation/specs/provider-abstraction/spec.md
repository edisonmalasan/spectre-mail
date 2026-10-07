# Spec Delta

## MODIFIED Requirements

### Requirement: Provider roles are assigned per client, not globally

The website SHALL use Guerrilla Mail as its only provider in V1. The extension SHALL use Mail.tm as
its primary provider with Guerrilla Mail as fallback. No client SHALL reach a provider that its
runtime environment cannot legally and technically reach, and no client SHALL reach a provider
through a SpectreMail-operated proxy or any other intermediary.

The two assignments are different because the two host environments are different, and that
difference is measured rather than chosen: Mail.tm sends `Access-Control-Allow-Origin` only to its
own origins, so no compliant web page can reach it, while an extension holding host permission for
the origin can. The website's single-provider configuration is therefore a limit of its
environment rather than a preference about Mail.tm, and the extension's two-provider configuration
is a capability of its own rather than a claim that either provider is better.

**A client's provider list is its configuration, and a client that reaches more than one provider
SHALL name them in preference order and report which one actually served a request.** A client
that falls back and reports the preferred provider has told the user something false about where
their mail is going.

#### Scenario: The extension selects a provider

- **WHEN** the extension creates a mailbox
- **THEN** it prefers Mail.tm
- **AND** falls back to Guerrilla Mail when Mail.tm is unavailable

#### Scenario: The website selects a provider

- **WHEN** the website creates a mailbox
- **THEN** it uses Guerrilla Mail
- **AND** it does not attempt Mail.tm, whose API grants no CORS header to a
  third-party origin, and because SpectreMail does not proxy provider APIs
- **AND** it SHALL NOT offer a control for choosing a provider, because it has exactly one
  reachable provider and a control that cannot act misreports the choice as unavailable

#### Scenario: A client has only one provider

- **WHEN** a client supports exactly one provider, as the website does in V1
- **THEN** its single-provider dependency SHALL be recorded as a known limitation
  rather than presented as redundancy
- **AND** adding a second provider SHALL remain additive through the abstraction,
  not require a rewrite

#### Scenario: A provider is unreachable from a client's environment

- **WHEN** a provider cannot be reached from the environment a client runs in,
  as Mail.tm cannot be reached from a web page
- **THEN** that client SHALL exclude it
- **AND** it SHALL NOT add a SpectreMail-operated backend or any other intermediary to relay it
- **AND** the reason SHALL be recorded in `docs/PROVIDERS.md`
- **AND** a measured reason SHALL cite the run that observed it, while an
  unverified reason SHALL be labelled "unverified" with **no** run claimed

### Requirement: Extension host permissions use the wildcard path form

The extension's manifest SHALL declare provider host permissions in the wildcard path form, and a
test SHALL exercise the declared pattern against the live provider origin to prove it grants
access.

**The test SHALL also exercise the slash-less form and require it to fail**, in the same run and
against the same origin. A check that fetches once and passes would also pass on some
configurations regardless of the declared pattern, so the negative half is what makes the result
evidence about the pattern rather than about the network.

**The live check SHALL NOT run in the unit suite, the browser suite, or `pnpm verify`.** Every
other provider interaction in this repository is driven by recorded responses, and that property
is what makes those suites deterministic and offline. The live check SHALL run from its own
opt-in script, and its result — pass or fail — SHALL be recorded in the provider documentation.

**What the check establishes, and what it does not.** It establishes that the **declared pattern**
grants cross-origin access from a real privileged extension context. It does **not** establish that
the product works end to end against a live provider: the whole signup flow, and a stored mailbox
reconciled against a live session, remain unverified by it.

#### Scenario: A slash-less host permission is declared

- **WHEN** a host permission omits a path, such as `https://api.example.com`
- **THEN** it SHALL be rejected, because it silently grants no access
- **AND** the wildcard path form, such as `https://api.example.com/*`, SHALL be
  used instead

#### Scenario: The declared pattern is checked against the live provider

- **WHEN** the host-permission check runs
- **THEN** the wildcard form as declared in the manifest SHALL succeed
- **AND** the slash-less form SHALL fail in the same run
- **AND** neither result SHALL be asserted by any test in `pnpm verify`

#### Scenario: The manifest is checked without a network

- **WHEN** the unit suite reads the built manifest
- **THEN** every provider host permission SHALL match the wildcard path form
- **AND** this SHALL be verified without contacting any provider