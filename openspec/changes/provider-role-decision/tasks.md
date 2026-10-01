# Tasks

## 1. Specify the corrected provider roles

- [x] 1.1 Record the per-client provider roles as a requirement, with the scenario that the website uses Guerrilla Mail only and the extension uses Mail.tm primary with Guerrilla Mail fallback — *spec.md, "Provider roles are assigned per client, not globally"*
- [x] 1.2 Record that a provider unreachable from a client environment is excluded from that client, with the reason recorded rather than worked around
- [x] 1.3 Record that the website has no provider fallback in V1 as a known limitation — **added during apply.** The verifier found this lived only in `design.md` prose, which does not survive sync into `openspec/specs/`. It is now the scenario "A client has only one provider".

## 2. Specify the provider abstraction

- [x] 2.1 Require mailbox lifecycle operations to go through a provider abstraction and forbid provider JSON knowledge in presentation components
- [x] 2.2 Require a multi-provider client to select its fallback inside the abstraction and present one mailbox contract

## 3. Specify the compliance boundary

- [x] 3.1 Require that provider APIs are never proxied, including the case where a relay would technically work — **reworded during apply.** Originally justified by quoted Mail.tm terms; those quotations could not be located, so the rule now rests on product policy and says so.
- [x] 3.2 Record that Mail.tm is excluded from the website because it grants no CORS to third-party origins, citing `docs/PROVIDERS.md` — **reworded during apply.** The measured CORS fact alone excludes it; no terms claim is made.

## 4. Specify the measured provider constraints

- [x] 4.1 Require that declared content type is not trusted and raw HTML is never rendered, covering the measured case where plain text arrived as HTML
- [x] 4.2 Require that a message with a blank field is still presented — **corrected during apply.** The original task said "empty subject or sender"; only the **subject** was measured empty. The sender arrived present. The scenario now covers the general case and states the measured basis.
- [x] 4.3 Require adaptive polling rather than an unverified push transport, covering the measured absence of any working Mail.tm SSE or WebSocket path
- [x] 4.4 Require surfaced throttling rather than silent retry, covering the measured `1; w=60` account-creation limit — **scope corrected during apply.** The header does not state whether the window is per IP; "per IP" was an inference and is withdrawn across all documents.
- [x] 4.5 Require the wildcard extension host-permission form with a test that exercises the declared pattern, covering the measured silent no-op of a slash-less pattern
- [x] 4.6 Forbid assuming a mailbox TTL — **corrected during apply.** Mail.tm's FAQ publishes a 7-day message retention and states a mailbox lasts until deleted. Neither value is in the API and neither was measured live. The requirement now forbids deriving a countdown from documentation.

## 5. Project documentation

- [x] 5.1 Update the roadmap `Project Status` to record that the provider-role decision is specified rather than only decided, and point at the change
- [x] 5.2 Update `docs/PROVIDERS.md` to record that the roles it measured are now specified behaviour, and link the spec delta
- [x] 5.3 Update `README.md` so the architecture section reflects the per-client provider roles rather than a single global provider ordering
- [x] 5.4 Update `AGENTS.md` architecture rules with the no-proxying boundary and the provider-abstraction boundary, since both are durable repository-wide constraints — **extended during apply** with a rule against citing unverified provider terms, and with the TTL rule corrected
- [x] 5.5 Verify every claim added to documentation traces to a run cited in `docs/PROVIDERS.md`, and that no unverified item is worded as a pass — **this task failed on first pass and drove the corrections below.** The verifier found three unsourced claims, which are now fixed rather than annotated.

## 5A. Verification findings, corrected during apply

- [x] 5A.1 Withdraw the quoted Mail.tm terms. `/terms` returns **404** and the FAQ is silent on proxying, resale, attribution, and quota. No probe ever captured terms, so no run artifact records them. The quotations are removed from `docs/PROVIDERS.md` and replaced with the URLs and retrieval date actually checked. **No architectural decision had depended on them** — the measured CORS result already excluded Mail.tm from the website.
- [x] 5A.2 Add a rule that unverified provider terms may not be cited, and may not be assumed absent in either direction
- [x] 5A.3 Correct the empty-sender claim in `docs/PROVIDERS.md`, `design.md`, and the spec delta. The run artifact shows `from` present and `subject` empty; the document had them the other way round, contradicting its own quoted block four lines earlier.
- [x] 5A.4 Correct the TTL claim. Mail.tm publishes a 7-day message retention and a no-expiry mailbox statement; the "neither provider advertises a TTL" wording across five files was wrong, and "exposes" versus "advertises" is now used deliberately.
- [x] 5A.5 Withdraw the unevidenced "per IP" rate-limit scope everywhere it appears
- [x] 5A.6 Correct `AGENTS.md`, which still claimed delivery was unverified while four other files recorded it as verified on both providers
- [x] 5A.7 Note that `GET /messages`' `30; w=60` was measured **unauthenticated only**, and that run `2026-10-01T18-18-42-250Z` recorded a real `429`

## 6. Verification

- [x] 6.1 Run `openspec validate provider-role-decision --strict` — passes
- [x] 6.2 Independently verify each scenario is falsifiable and that no requirement merely restates a preference — **done.** Found: one non-falsifiable process rule ("verified before anything depends on it"), which was reworded to be about the implementation's behaviour, and one scenario conditional on an unverifiable premise, which was removed.
- [x] 6.3 Confirm no requirement demands behaviour that M0 measured as impossible — confirmed; the CORS exclusion is the only such case and is consistent
- [x] 6.4 Confirm the spec introduces no implementation code, matching the stated non-goals — confirmed; the branch touches only `.md` files

## Open items carried forward, not resolved here

- **Mail.tm's terms do not exist publicly.** Until located, no attribution, resale,
  or quota obligation may be asserted or denied. This blocks any commercial claim.
- **The Guerrilla dead-session trap got no requirement.** Five of six measured
  constraints became requirements; this one was deferred to the mailbox capability.
  Recorded in `design.md` so the omission is deliberate rather than accidental.
- **The live-provider test required by 4.5** depends on M1 test infrastructure that
  does not exist yet, and the disposable spike may not be imported by an
  application. Whoever plans M1 tests must solve this.