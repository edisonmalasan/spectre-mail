# Tasks — M23 Expired Mailbox Recovery

## 1. Clear the provider-confirmed-dead record

- [ ] 1.1 On the session's `expired` state, remove the dead stored record through
      `SpectreStorage.clearAll()` and reset the handed-record comparison, keeping
      the mailbox value in component state for this page load; verify with a
      focused `useMailboxSession`/`App` test that a boot which reports `expired`
      leaves storage empty and that a later boot no longer reports a stored gone
      address.
- [ ] 1.2 Replace the storage claim in `StoredAddressGone.tsx` so the gone screen
      states that the stale record was cleared; verify the rendered sentence by
      reading its own test id and by a negative control that plants the old
      sentence and fails the assertion.

## 2. Get a new address persists the replacement

- [ ] 2.1 Add a dedicated handler for the gone screen's "Get a new address"
      control that creates through `session.open()` with persistence enabled, and
      wire `App.tsx:186–191`'s `onReplace` to it; verify a unit test observing the
      storage contract that the replacement is written once and that a later
      boot offers the replacement rather than the dead address.
- [ ] 2.2 Leave `startFresh` and the `restoreFailed` control pair untouched;
      verify with the existing `StoredAddressUnchecked` tests that a failed check
      still reports "what is saved on this device has not been changed", removes
      nothing and creates no replacement.

## 3. Check the saved address again asks about the same mailbox

- [ ] 3.1 Route the gone screen's "Check the saved address again" control through
      the existing `startBoot` restore step using the mailbox held by the
      `expired` state, never through `session.open()`; verify with a focused test
      that the provider receives a restore for that exact mailbox and that no
      create request is made.
- [ ] 3.2 Cover all three outcomes of that re-check: provider confirms the same
      mailbox live (same address presented and re-persisted), provider again
      reports it gone (stays on the gone screen without a second removal), and
      provider cannot be asked (inconclusive report with no claim that the
      device's record is intact); verify each as its own named test reading the
      rendered state and the storage calls.

## 4. No lifetime or timing mechanism

- [ ] 4.1 Confirm no countdown, expiry field, timer or new polling interval was
      introduced and that clearance is driven only by the provider's dead-session
      signal; verify by inspecting the change's diff and by the existing cadence
      tests remaining unchanged.

## 5. Falsification pass

- [ ] 5.1 For every new assertion above, apply a deliberate violation and show it
      is caught by the assertion it was written for, including: both controls
      wired to `startFresh` again, persistence disabled on the new-address
      handler, no removal on `expired`, a re-check that calls `session.open()`, a
      re-check that discards the mailbox, and the old "nothing was deleted" copy
      on the gone screen; record the catching assertion, a byte-identical SHA-256
      restoration of every mutated file, and the conforming case passing.
- [ ] 5.2 Report any survivor as "not caught" until the mutant itself has been
      read and shown to be a broken mutant rather than a coverage gap; do not
      weaken an assertion to make a mutation pass.

## 6. Verification

- [ ] 6.1 Run `pnpm verify` with no browser installed and record its exact exit
      code and counts; a green run here does not cover either browser tier.
- [ ] 6.2 Run the website and extension browser tiers separately and sequentially,
      recording each tier's case count and exit code; name any red before
      attributing it and report a run with no tier summary as `HARNESS-ERROR`.
- [ ] 6.3 Run `openspec validate m23-expired-mailbox-recovery --strict` and
      Prettier over the change's own files, recording exact output for both.

## 7. Independent review

- [ ] 7.1 Have a verifier compare the implementation against this change's
      proposal, design and spec delta rather than against the ticked boxes, and
      report any unresolved CRITICAL or WARNING finding before completion.
- [ ] 7.2 Reconcile the roadmap's Project Status with Git and OpenSpec after the
      review, recording the change's lifecycle transition without claiming a
      stage that has not merged.

## 8. Spec sync and archive (orchestrator-owned handoff)

- [ ] 8.1 Promote the delta on its own branch and PR, re-count requirements and
      scenarios by heading, and verify each promoted `MODIFIED` block is
      byte-identical to its delta block with every pre-existing scenario intact.
- [ ] 8.2 Archive with `--skip-specs` after sync is merged, verify archived files
      byte-identical against pre-archive digests and `openspec list` reporting no
      active changes; record any human-only blocker as `BLOCKED` or
      `NOT VERIFIED` rather than closing it.
