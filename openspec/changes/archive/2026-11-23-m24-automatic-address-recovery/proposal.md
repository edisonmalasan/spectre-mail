# Proposal: M24 — Automatic Address Recovery

## Why

Measured 2026-11-22 in the promoted `website-client` requirement *A reload returns
the user to the address they came back for*: when the provider definitively
reports the saved mailbox gone, the screen at
`apps/web/src/StoredAddressGone.tsx` offers two buttons — *Get a new address*
(`onReplace`) and *Check the saved address again* (`onRetry`) — and
`apps/web/src/App.tsx:187–193` wires them to `getNewAddress` and `retryBoot`. The
user's request is to remove that choice. A definitive `expired` answer is the
provider's own signal that the address cannot receive mail, so asking a person to
decide what to do next adds a step that cannot change the answer. The page SHALL
create **and persist** a replacement on its own, with no user activation.

This applies **only** to the definitive `expired` state. The separate
`restoreFailed` screen (`apps/web/src/StoredAddressUnchecked.tsx`) keeps its two
controls: a provider that could not be asked has not said the address is dead, so
automatically overwriting a possibly-live stored address would destroy the very
thing the user came back for. That path, its component and its spec scenario are
explicitly out of scope and unchanged.

## What Changes

- Remove the choice from the gone screen: `StoredAddressGone.tsx` becomes a
  non-interactive notice with no `onRetry`/`onReplace` props and no buttons,
  keeping the `expired-address` and `expired-explanation` testids and all copy.
- Fire a single automatic recovery effect in `apps/web/src/useMailboxSession.ts`
  when the session reaches `expired`. It runs once per page load, guarded by a ref
  so React StrictMode's double effect invocation cannot issue two creates against
  a rate-limited provider.
- Reuse the existing `getNewAddress` handler so persistence semantics do not
  change: `saveMailbox` overwrites `CURRENT_MAILBOX_KEY` and adds the replacement
  to the recent-mailbox collection in the storage layer's one transaction. Nothing
  is cleared or deleted, and the dead address stays in the recent-mailbox
  collection as the record of what the provider reported gone.
- Remove the now-unused `StoredAddressGone` prop wiring from `App.tsx`. The
  `restoreFailed` branch and its `StoredAddressUnchecked` control pair stay
  byte-identical.
- Introduce no countdown, timer, interval, expiry field or lifetime guess.
- Rewrite the six recovery tests in `apps/web/src/recovery.test.tsx` for automatic
  behaviour, add a StrictMode single-create case and a no-buttons case, and keep
  no-timing-text coverage; then run a falsification pass, full verification, both
  browser tiers, independent review, spec sync and archive.

No provider, adapter, package, storage, extension, workflow, `AGENTS.md` or
`docs/PROVIDERS.md` change is part of this proposal.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `website-client`: exactly one `MODIFIED` block for *A reload returns the user to
  the address they came back for*. Its seven earlier scenarios, requirement text
  and both `2026-10-05` amendment notes are carried forward byte-for-byte; the
  M23 amendment note is replaced by an m24 note; the gone scenario's third clause
  and the bodies of the two M23-added scenarios are rewritten. Those two scenario
  **headings are retained verbatim** because OpenSpec's whole-block replacement
  rule forbids dropping or renaming scenarios in a `MODIFIED` block, while their
  bodies now state the opposite of the old user-choice behaviour. No scenario is
  added or removed, so requirement and scenario deltas are both 0: the promoted
  tree stays at **209 / 697 / 17**.

## Impact

- **Code:** `apps/web/src/useMailboxSession.ts`, `apps/web/src/StoredAddressGone.tsx`,
  `apps/web/src/App.tsx` and `apps/web/src/recovery.test.tsx`. No new package.
- **Specs:** one capability, one `MODIFIED` block.
- **Unchanged:** `restoreFailed` behaviour and copy, the recent-mailbox collection,
  all stored data, the shared packages, the extension, the provider adapters,
  `docs/PROVIDERS.md`, `AGENTS.md`, the workflow and the archived changes.
- **Explicit non-goals:** no data deletion, no `clearAll`, no countdown, timer or
  expiry guess, no new provider, no new storage contract, no live-provider
  verification, and no rewriting of earlier milestone history.
