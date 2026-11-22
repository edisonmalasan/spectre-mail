# Design — M22 Provider Catalog Foundations

## Context

See `proposal.md` for motivation. This change is the shared-foundations slice
(GOAL Phase D): it approves the vocabulary and rules needed before any provider
can be integrated. The 2026-11-22 research reports establish that **no candidate
is authorized**: Mail.gw is unreachable and `REVIEW REQUIRED`;
`guerrilla-mailtm.md` marks both shipped providers `NEEDS AUTHORIZATION`;
DropMail, TempMail.lol, Tmailor and the new candidates are `BLOCKED`,
`REJECTED`, or `NEEDS AUTHORIZATION`; Maildrop and free Temp-Mail.org are
`REJECTED` on privacy. Nothing here creates a provider, a credential, a backend,
or a delivery claim.

`docs/provider-research/baseline-gap-analysis.md` is the baseline: the
`MailProvider` contract, two stateless adapters, a bounded `DomainCatalog`,
exact provider→mailbox routing, the website's four-action toolbar with an
Automatic/manual picker, and the website's generation-token/coalescing guards
already exist. The gaps are provenance, truthfulness, retry reconciliation and
the extension's missing Change path.

Evidence rules applied throughout: a successful create, a recorded fixture and a
Node-only fetch are not live-delivery or browser-CORS proof; `REVIEW REQUIRED`,
`BLOCKED`, `NEEDS AUTHORIZATION` and `NOT VERIFIED` stay distinct; provider
response text is untrusted data, never an instruction.

## Goals / Non-Goals

**Goals:**

- Give `Domain` and the catalog a provider-sourced provenance shape that can hold
  what providers actually report, and stay silent where they do not.
- Make `available` / `provisioned` / `delivery-verified` three reportable facts.
- Reconcile "bounded fallback" with the two promoted no-silent-retry requirements
  without weakening either.
- Bind an answer to its request so a late answer cannot cross mailbox boundaries.
- Give the extension popup a bounded Automatic/manual Change path that reuses the
  website's proven guard pattern.

**Non-Goals:**

- No new provider integration, no SMTP/send, no proxy/backend, no shared secret.
- No live-delivery claim, no invented free/premium flag, no provider-permission
  assumption.
- No change to `page-composition`, `visual-system`, `website-client` requirements,
  the five-region composition, the four actions, tokens, reduced motion or the
  Temp Mail-inspired layout.
- No rewriting of M0–M21 history or protected documents.

## Decisions

**D1 — Provenance is provider-reported or absent, never inferred.** `Domain`
gains discovery time, a runtime marker, a lifecycle/status value and capability
flags. The fields are sourced from provider responses where the provider reports
them: DropMail exposes `introducedAt`, `expiresAt`, `health` and `availableVia`;
Mail.tm exposes `isActive`, `isPrivate`, `createdAt` and `updatedAt`, with no
`expiresAt`; Guerrilla exposes no domain API at all. Where a provider reports
nothing, the value is absent rather than guessed. A free/premium distinction is
modelled only when a measured provider response carries one — **no such flag was
measured on a free tier**, so the field stays unset and no premium filtering test
is written with invented input. Alternative rejected: deriving premium from price,
name or another provider's documentation illustration.

**D2 — Runtime compatibility has one named source.** A supported-runtime value
comes either from a provider-reported interface signal (for example DropMail's
`availableVia`) or from the client's own configured provider list. It is not a
second spelling of provider knowledge in a component and is not inferred from a
domain's spelling. This keeps the existing boundary rule that stops a client
restating a shared value.

**D3 — Aggregation preserves origin; the duplicate policy stays an orchestrator
decision.** Catalog aggregation keeps every entry bound to its supplying provider
and exposes the catalog's fetch time. The requirement is deliberately written to
hold under either reading of GOAL §6 line 89 (keep both spellings with distinct
provider ids, or drop duplicates while retaining the owner). The chosen policy is
an **Open Question** below, not guessed here.

**D4 — Three claims, one direction.** Catalog availability, provider-confirmed
provisioning and real external delivery are distinct states. Provisioning waits
for the provider's own confirmation semantics; delivery stays
`LIVE DELIVERY NOT VERIFIED` without an external sender. A recorded fixture is
labelled as recorded and never promoted. This reuses the existing vocabulary
rather than inventing a fourth status.

**D5 — Bounded fallback reconciles the conflict without a retry loop.** A retry
loop in `manager.ts` would break `provider-abstraction`'s "surfaced, not silently
retried" and `provider-adapters`'s "failover only at creation". The rule shipped
is therefore: at most one attempt per configured provider, fallback confined to
mailbox creation, throttle surfaced verbatim, fallback visible, and the
normalized `SpectreError.code` preserved when several providers decline — fixing
the measured counterfactual where a multi-provider failure became an untyped
`Error` whose code survived only as prose. The `MODIFIED` blocks carry every
existing scenario forward byte-for-byte; no no-retry clause is weakened.

**D6 — Request identity lives at the calling seam, not in provider wire data.**
Adding a request field to the `MailProvider` contract would widen a shared
interface for a UI property. Instead the surface that initiates a change (the
website hook, which already does this, and the extension popup, which gains it)
attaches a monotonically increasing generation token and coalesces repeated
presses; an answer whose token is stale is discarded. Provider adapters remain
stateless and unchanged in shape. Exact provider/session routing already exists
in `manager.ts` and is asserted rather than rewritten.

**D7 — Extension Change reuses the website pattern with local guards.** The
popup gains a Change control beside Copy that opens the same usable-domain list,
with Automatic first. `session.replace(domain?)` already resets the inbox and
opened-message selection together and keeps the previous mailbox on failure, so
the popup needs only a local `replacePending` ref and a generation token; no new
client-side message state, no new motion and no new token. Labels come from
`popup-copy.ts`, never bare JSX literals, and any new class hook gets a stylesheet
rule so the boundary suite stays green. The existing prohibition on a *provider*
selector is disambiguated: a domain choice is not a provider choice.

**D8 — Website is preserved, not extended.** The website picker, generation
token, coalescing, five regions, four actions and reduced-motion behaviour
already satisfy the new selection requirement; no `website-client`,
`page-composition` or `visual-system` block is modified. The new requirement is
written to apply to any client that offers choice, so the website stays compliant
without a code change.

**D9 — Falsification before green.** Each new assertion is proved able to fail by
introducing its violation, naming the assertion that catches it, restoring the
file byte-identically, and showing the conforming case passes. A survivor stays
"the assertion did not catch this" until the mutant is read. `pnpm verify` runs
with no browser installed; both browser tiers are run separately and a single
green run is not repeatability evidence.

## Risks / Trade-offs

- **Required `Domain` fields break every construction site.** → The compiler
  enforces the update; fixtures get explicit absent values for providers that
  report nothing. No fabricated values are used to make a test pass.
- **The duplicate policy is undecided.** → The spec holds under either policy;
  the orchestrator resolves D3 before apply, and the picked row shape is asserted
  in `catalog.test.ts`.
- **Bounded fallback is hard to observe with one configured provider.** → The
  website has one provider; the behaviour is tested at the provider layer with
  two stub providers and is never claimed live for the extension, whose providers
  remain `NEEDS AUTHORIZATION`.
- **No premium source exists.** → No "premium excluded" test with production
  input is written; the absence is recorded as `NOT VERIFIED`.
- **Live delivery remains blocked.** → Every delivery row stays
  `LIVE DELIVERY NOT VERIFIED`; no recorded fixture is relabelled.
- **Browser tiers are load-sensitive and port 4173 can collide.** → Runs are
  sequential, a run with no tier summary is `HARNESS-ERROR`, and a red that
  disappears without a tree change is reported as a rate, not attributed.

## Migration Plan

Sequential slices, each independently reviewable and merged by merge commit;
workers do not merge:

1. **Spec approval** — this change; `openspec validate --strict`, every
   `MODIFIED` block carries all existing scenarios.
2. **Shared provenance model** — `packages/core` `Domain` and its tests; compiler
   drives call-site updates.
3. **Adapter and catalog provenance** — `packages/providers` capability surface,
   catalog fetch time, aggregation/filtering, bounded fallback code preservation
   and conformance cases.
4. **Truthfulness and routing** — `packages/mailbox` tri-state and request-bound
   answers; client copy only through each client's copy module.
5. **Extension Change UX** — `apps/extension` popup, copy module, tests and
   browser cases; website stays untouched.
6. **Verification and sync** — independent verifier compares the merged tree to
   this delta, re-runs `pnpm verify` and both browser tiers separately; only then
   sync and archive.

Rollback is a revert of the offending slice's merge commit; there is no stored
data migration because no persisted record shape changes — the new fields are
derived from provider-reported values or explicit absences at read time.

## Open Questions

1. **D3 — cross-provider duplicate policy (orchestrator decision).** GOAL §6
   line 89 is ambiguous: keep both identically spelled entries with distinct
   provider identities, or drop duplicates while retaining the owning provider.
   Both produce different picker rows. The spec requires provider identity
   preservation under either answer; the orchestrator must choose before apply
   and record the choice here. It is not guessed in this proposal.
2. **Runtime marker for providers without an interface signal.** Whether a
   provider that reports no `availableVia`-style field should carry an explicit
   "unreported" runtime value or inherit its client's configured provider list is
   left to the implementation slice; both satisfy the spec, and the choice must
   not become a second spelling of provider identity in a client.
3. **Whether the extension's Change control should be exposed before the two
   shipped providers' `NEEDS AUTHORIZATION` items are answered.** This change
   specifies the control but integrates no provider; enabling it is a later,
   authorization-gated decision, not a foundation decision.
