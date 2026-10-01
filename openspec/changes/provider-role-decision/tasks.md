# Tasks

## 1. Specify the corrected provider roles

- [ ] 1.1 Record the per-client provider roles as a requirement, with the scenario that the website uses Guerrilla Mail only and the extension uses Mail.tm primary with Guerrilla Mail fallback
- [ ] 1.2 Record that a provider unreachable from a client environment is excluded from that client, with the reason recorded rather than worked around
- [ ] 1.3 Record that the website has no provider fallback in V1 as a known limitation, so it is not silently treated as a defect later

## 2. Specify the provider abstraction

- [ ] 2.1 Require mailbox lifecycle operations to go through a provider abstraction and forbid provider JSON knowledge in presentation components
- [ ] 2.2 Require a multi-provider client to select its fallback inside the abstraction and present one mailbox contract

## 3. Specify the compliance boundary

- [ ] 3.1 Require that provider APIs are never proxied, including the case where a relay would technically work but the provider's terms forbid it
- [ ] 3.2 Record that Mail.tm is excluded from the website because it grants no CORS to third-party origins and forbids proxying, citing `docs/PROVIDERS.md`

## 4. Specify the measured provider constraints

- [ ] 4.1 Require that declared content type is not trusted and raw HTML is never rendered, covering the measured case where plain text arrived as HTML
- [ ] 4.2 Require that a message with an empty subject or sender is still presented, covering the measured empty-envelope case
- [ ] 4.3 Require adaptive polling rather than an unverified push transport, covering the measured absence of any working Mail.tm SSE or WebSocket path
- [ ] 4.4 Require surfaced throttling rather than silent retry, covering the measured `1; w=60` account-creation limit
- [ ] 4.5 Require the wildcard extension host-permission form with a test that exercises the declared pattern, covering the measured silent no-op of a slash-less pattern
- [ ] 4.6 Forbid assuming a mailbox TTL, covering the measured absence of one on both providers

## 5. Project documentation

- [ ] 5.1 Update the roadmap `Project Status` to record that the provider-role decision is specified rather than only decided, and point at the change
- [ ] 5.2 Update `docs/PROVIDERS.md` to record that the roles it measured are now specified behaviour, and link the spec delta
- [ ] 5.3 Update `README.md` so the architecture section reflects the per-client provider roles rather than a single global provider ordering
- [ ] 5.4 Update `AGENTS.md` architecture rules with the no-proxying boundary and the provider-abstraction boundary, since both are durable repository-wide constraints
- [ ] 5.5 Verify every claim added to documentation traces to a run cited in `docs/PROVIDERS.md`, and that no unverified item is worded as a pass

## 6. Verification

- [ ] 6.1 Run `openspec validate provider-role-decision --strict`
- [ ] 6.2 Independently verify each scenario is falsifiable and that no requirement merely restates a preference
- [ ] 6.3 Confirm no requirement demands behaviour that M0 measured as impossible
- [ ] 6.4 Confirm the spec introduces no implementation code, matching the stated non-goals