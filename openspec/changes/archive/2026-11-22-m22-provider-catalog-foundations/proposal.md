# Proposal: M22 — Provider Catalog Foundations

## Why

`docs/GOAL.md` §6–§8 asks for sustainable provider and domain diversity built on
truthful, provider-sourced data. The 2026-11-22 provider research found **no
candidate authorized for integration**: every candidate is `BLOCKED`,
`REJECTED`, or `NEEDS AUTHORIZATION`, and both shipped providers are
`NEEDS AUTHORIZATION` (`docs/provider-research/*.md`). Adding a provider now
would guess at permission the research explicitly did not establish.

`docs/provider-research/baseline-gap-analysis.md` found that the repository has
the *shape* the goal asks for, but not the vocabulary: `Domain` carries no
discovery time, supported runtime, lifecycle status or capability flags; the
catalog hides its fetch time and has no cross-provider aggregation rule;
"available / provisioned / delivered" is not a modelled distinction; bounded
retry conflicts with promoted no-silent-retry requirements; and the extension
popup has no Change path. Foundations must be approved before any dependent
provider integration can be specified truthfully.

## What Changes

- Add provider-sourced provenance to the shared `Domain` model: discovery time,
  supported runtime, lifecycle/status, and capability flags. A free/premium
  distinction is stored **only** where a provider actually reports one — no
  measured free-tier provider does, so no premium claim is invented.
- Make catalog provenance observable: expose its fetch time, aggregate catalogs
  without collapsing identically spelled domains from different providers into
  one interchangeable entry, filter by runtime compatibility, and report a
  truncated pagination as incomplete rather than as a whole inventory.
- Model three separate claims — `available in provider catalog`,
  `mailbox provisioned by the provider`, and `LIVE DELIVERY NOT VERIFIED` — so a
  created address is never shown as delivered and a recorded fixture never
  becomes delivery evidence.
- Reconcile bounded fallback with the existing rules: at most one attempt per
  provider, fallback confined to mailbox creation, throttle surfaced verbatim,
  never a silent retry loop, and the normalized error code preserved across a
  multi-provider failure.
- Bind catalog and creation answers to the request that produced them: exact
  provider/session routing, a late answer from an older request cannot replace a
  newer mailbox, and a domain from one provider is never used by another.
- Add the minimal Automatic/manual domain-selection UX to the extension popup,
  reusing the website's stability pattern: coalesced presses, a generation
  token, previous mailbox preserved on failure, reader cleared after a
  successful Change, and accessibility/reduced-motion guards. The website's
  existing picker, five-region composition, four actions, tokens and
  Temp Mail-inspired layout are preserved unchanged.

**BREAKING (type-level):** adding required provenance fields to `Domain` changes
a shared interface; every construction site must be updated (the compiler
enforces this). There is no user-visible behaviour break.

## Capabilities

### New Capabilities

- `provider-catalog`: provider-sourced domain catalog provenance, aggregation and
  freshness; the truthful availability/provisioning/delivery distinction;
  request-bound answers with stale-response isolation; and the minimal
  Automatic/manual domain-selection contract with stability and accessibility
  guards.

### Modified Capabilities

- `shared-domain-model`: the provider-identity requirement gains explicit
  provider-sourced `Domain` provenance fields (free/premium only where reported).
- `provider-adapters`: optional capabilities gain domain-listing,
  chosen-domain-creation and restore flags; bounded fallback is visible and
  preserves the normalized error code.
- `provider-abstraction`: throttling is reconciled with bounded visible fallback;
  a new requirement binds catalog and creation answers to their request and
  mailbox.

## Impact

- **Code:** `packages/core` (`Domain`), `packages/providers` (`contract`,
  `catalog`, adapters, fixtures, conformance tests), `packages/mailbox`
  (session/state tri-state and request identity), `apps/web` and
  `apps/extension` (selection UX and copy modules). No new package.
- **Specs:** one new capability and three modified capabilities; every `MODIFIED`
  block carries all existing scenarios forward byte-for-byte.
- **Unchanged:** `page-composition`, `visual-system`, `website-client` requirements,
  the four actions, the five-region composition, declared tokens, reduced-motion
  behaviour and the Temp Mail-inspired layout.
- **Explicit non-goals:** no new provider integration (all candidates need
  authorization or are blocked), no SMTP/send, no proxy/backend, no shared
  secret, no fake delivery state, no rewriting M0–M21 history.
- **Evidence limits:** no live delivery is verified here; no provider permission
  is assumed; no browser-CORS or extension-host-permission claim is inferred from
  a Node fetch or a recorded fixture.
