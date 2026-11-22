# Tasks — M23 Expired Mailbox Recovery

## 1. Get a new address persists the replacement

- [ ] 1.1 Add a dedicated handler for the gone screen's "Get a new address"
      control that creates through `session.open()` with persistence enabled, and
      wire `App.tsx:186–191`'s `onReplace` to it; verify with a unit test observing
      the storage contract that the replacement is written once, that a later
      boot offers the replacement rather than the dead address, and that the
      recent-mailbox collection is still present (`saveMailbox` writes both in one
      transaction at `packages/storage/src/indexeddb-mailboxes.ts:399–438`).
- [ ] 1.2 Leave `startFresh` and the `restoreFailed` control pair untouched;
      verify with the existing `StoredAddressUnchecked` tests that a failed check
      still reports "what is saved on this device has not been changed", removes
      nothing and creates no replacement, and that `StoredAddressGone`'s copy is
      unchanged.

## 2. Check the saved address again asks about the same mailbox

- [ ] 2.1 Wire the gone screen's "Check the saved address again" control to the
      existing `retryBoot` path, which re-reads the stored record and calls
      `session.restore(stored)`; verify with a focused test that the provider
      receives a restore for that exact mailbox, no create request is made, and
      the stored record is not discarded.
- [ ] 2.2 Cover all three outcomes of that re-check: provider confirms the same
      mailbox live (same address presented), provider again reports it gone
      (truthful gone state stays), and provider cannot be asked (ordinary
      inconclusive state with its existing copy and semantics); verify each as
      its own named test reading the rendered state and the storage calls.

## 3. No lifetime or timing mechanism

- [ ] 3.1 Confirm no countdown, expiry field, timer or new polling interval was
      introduced and that a replacement is persisted only after the provider's
      dead-session signal; verify by inspecting the change's diff and by the
      existing cadence tests remaining unchanged.

## 4. Falsification pass

- [ ] 4.1 For every new assertion above, apply a deliberate violation and show it
      is caught by the assertion it was written for, including: both controls
      wired to `startFresh` again, persistence disabled on the new-address
      handler, a re-check that calls `session.open()`, and a re-check that
      discards the stored mailbox; record the catching assertion, a byte-identical
      SHA-256 restoration of every mutated file, and the conforming case passing.
- [ ] 4.2 Report any survivor as "not caught" until the mutant itself has been
      read and shown to be a broken mutant rather than a coverage gap; do not
      weaken an assertion to make a mutation pass.

## 5. Verification

- [ ] 5.1 Run `pnpm verify` with no browser installed and record its exact exit
      code and counts; a green run here does not cover either browser tier.
- [ ] 5.2 Run the website and extension browser tiers separately and sequentially,
      recording each tier's case count and exit code; name any red before
      attributing it and report a run with no tier summary as `HARNESS-ERROR`.
- [ ] 5.3 Run `openspec validate m23-expired-mailbox-recovery --strict` and
      Prettier over the change's own files, recording exact output for both.

## 6. Independent review

- [ ] 6.1 Have a verifier compare the implementation against this change's
      proposal, design and spec delta rather than against the ticked boxes, and
      report any unresolved CRITICAL or WARNING finding before completion.
- [ ] 6.2 Reconcile the roadmap's Project Status with Git and OpenSpec after the
      review, recording the change's lifecycle transition without claiming a
      stage that has not merged.

## 7. Spec sync and archive (orchestrator-owned handoff)

- [ ] 7.1 Promote the delta on its own branch and PR, re-count requirements and
      scenarios by heading, and verify each promoted `MODIFIED` block is
      byte-identical to its delta block with every pre-existing scenario intact.
- [ ] 7.2 Archive with `--skip-specs` after sync is merged, verify archived files
      byte-identical against pre-archive digests and `openspec list` reporting no
      active changes; record any human-only blocker as `BLOCKED` or
      `NOT VERIFIED` rather than closing it.
