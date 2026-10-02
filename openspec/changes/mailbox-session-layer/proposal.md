# Proposal

## Why

M0–M4 built a measured foundation — a provider abstraction with two adapters, a
normalized domain model, and a pure parser — and **no user has ever seen any of it.**
`apps/web` renders a status page that says it has no mailbox feature, which is the
correct state for M1 but means four milestones of verified infrastructure serve
nothing.

M5 is the first user-facing milestone. It cannot start where the layers do, because
there is no home for the logic that turns them into an experience. The roadmap's
shared-package list assigns "mailbox lifecycle" and "mailbox manager" to
`packages/core`, but `shared-domain-model`'s approved purpose states it describes
"the model and its invariants only" and explicitly excludes lifecycle behaviour.
The two cannot both be true, and the roadmap is a plan while the spec is an
approved contract.

So the first slice of M5 has to settle where client-side orchestration lives before
it can write a line of it. Doing that inside `apps/web` would mean rewriting it in
M8 when the extension needs the same behaviour.

## What Changes

- **Add `packages/mailbox`**, a framework-free mailbox session layer that owns the
  orchestration neither `apps/web` nor a future `apps/extension` should hold:
  creating a mailbox through the provider manager, replacing it, reporting provider
  health, and exposing the normalized error a caller must show. It has **no React,
  no DOM, and no storage.**
- **Replace the website's status page with a real page** that creates a mailbox on
  load and shows the resulting address with a copy action.
- **The website configures Guerrilla Mail and only Guerrilla Mail.** Mail.tm grants
  no CORS to third-party origins, measured, so configuring it here would produce a
  runtime failure whose cause is invisible to the user. The extension's
  Mail.tm-primary policy is unchanged and is not this change's business.
- **No persistence.** M5a introduces no storage package; a reload creates a new
  address. IndexedDB arrives at M6, and this limitation is stated rather than
  designed around.
- **No polling, no inbox, no message view.** Those are the remaining M5 slices.
  This change establishes the session layer and proves a user can reach a working
  address.
- **No visual design.** M7 owns the Spectral Swiss pass. This change builds correct
  structure, semantics, and accessible names, and deliberately nothing to be thrown
  away by M7.

## Capabilities

### New Capabilities

- `mailbox-session`: Framework-free mailbox session orchestration — creating,
  replacing, and describing a mailbox through the provider abstraction, with
  provider health, normalized failure, and the boundary that keeps provider and
  framework concerns out.
- `website-client`: What the website client must do and must not do — its provider
  configuration, the auto-create first-run flow, address presentation, and the
  honest states a user can be shown.

### Modified Capabilities

- None. `provider-abstraction`, `provider-adapters`, `shared-domain-model`, and
  `mail-parsing` are all **consumed** unchanged. This change widens no existing
  requirement and contradicts none; if applying it turns out to require a change to
  one of them, that is a finding to record rather than a licence to edit.

## Impact

- **New package** `packages/mailbox`, depending on `@spectre-mail/core` and
  `@spectre-mail/providers` only. It must not gain a React or DOM dependency, and
  its own test suite must not need a browser.
- **`apps/web`** gains a dependency on `@spectre-mail/mailbox` and
  `@spectre-mail/providers`, and replaces `App.tsx`'s status page with a component
  tree that consumes the session.
- **Workspace** gains the new package in `packages/*`; the Vitest include glob
  already covers `packages/*/src/**/*.test.ts`, so no tooling change is expected.
- **`tests/architecture/boundaries.test.ts`** must be widened to cover the new
  package, including a rule that `packages/mailbox` imports no framework. That
  widening is itself a falsification target.
- **Not affected:** `packages/core`, `packages/mail-parser`, both adapters, the M0
  spike, CI, and `docs/PROVIDERS.md`.
