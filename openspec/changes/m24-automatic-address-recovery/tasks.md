# Tasks — M24 Automatic Address Recovery

## 1. Spec and design (done in this proposal stage)

- [x] 1.1 Produce `proposal.md`, `design.md`, `tasks.md`, `.openspec.yaml` and the
      single `## MODIFIED Requirements` delta for `website-client`, carrying all
      seven earlier scenarios, the requirement text and both `2026-10-05`
      amendment notes byte-for-byte; verify with a whole-block comparison against
      the promoted spec that the only differences are the five specified edits.
- [x] 1.2 Add the M24 PROPOSED line to `docs/ROADMAP.md`'s `## Project Status`
      immediately after the M23 line, editing no other roadmap text and leaving
      `GOAL.md` and `GOAL-REPORT.md` untouched.
- [x] 1.3 Run `openspec validate m24-automatic-address-recovery --strict` and
      record its exact output.

## 2. Automatic recovery effect and once guard (`useMailboxSession.ts`)

- [x] 2.1 Add one effect in `apps/web/src/useMailboxSession.ts` that observes the
      session state and calls the existing `getNewAddress()` exactly once when it
      becomes `expired`, guarded by a per-hook-instance ref so a second
      publication of `expired` and StrictMode's double mount cannot issue two
      creates. Do not suppress deliberate `startFresh`, `retry` or `replace` runs.
- [x] 2.2 Verify with a unit test that the automatic path issues exactly one
      create, that the replacement is written to the store (wait on the stored
      record, not on the address appearing on screen), that a later visit returns
      to the replacement, and that no `clearAll` and no collection removal occurs.

## 3. Notice component and wiring removal

- [x] 3.1 Edit `apps/web/src/StoredAddressGone.tsx` to remove `onRetry` and
      `onReplace` from `StoredAddressGoneProps` and both `<button>` elements from
      the render. Keep the `expired-address` and `expired-explanation` testids and
      every sentence of the existing copy unchanged.
- [x] 3.2 Edit `apps/web/src/App.tsx`'s `expired` branch to render
      `<StoredAddressGone mailbox={state.mailbox} />` with no callbacks, and remove
      the now-unused `getNewAddress`/`retryBoot` wiring there only. Leave the
      `restoreFailed` branch with `StoredAddressUnchecked` and its two controls
      byte-identical.
- [x] 3.3 Verify with a focused render test that the gone screen exposes no
      button, no `role` and no click handler, and that the `restoreFailed` screen
      still renders both of its controls with unchanged copy.

## 4. Test rewrite (`apps/web/src/recovery.test.tsx`)

- [x] 4.1 Rewrite the six tests in the block starting at `recovery.test.tsx:1361`
      so they drive automatic behaviour: the replacement is created on arrival at
      `expired` with no activation; the single record is overwritten; the dead
      address and every other mailbox stay in the recent-mailbox collection; a
      later visit returns to the replacement; the create-in-progress state is
      shown while a create is held open; and the gone notice still names the dead
      address truthfully. Remove the three tests' dependence on clicking the
      deleted re-check button and the one on clicking "Get a new address".
- [x] 4.2 Add a StrictMode single-create case that renders the recovery path under
      `StrictMode` and asserts exactly one provider create (design D1).
- [x] 4.3 Add a no-buttons case asserting the gone screen renders no control that
      asks the user to choose between a new address and re-checking the saved one
      (design D3 and the retained *The user asks to check the saved address again
      after it was found gone* scenario, whose rewritten body forbids both
      controls and requires automatic replacement).
- [x] 4.4 Keep `expectNoTimingText()` coverage on both the gone and create paths,
      including the mailbox carrying an `expiresAt` timestamp with no provider
      signal behind it (design D5).

## 5. Falsification pass

- [x] 5.1 Apply each of the six arms named in `design.md` D7 and show it is caught
      by the assertion it was written for: remove the auto-effect (page stays on
      the gone screen), remove the once-ref (StrictMode double create), drop
      persistence (store never updated), re-add either button, clear the
      collection, and inject timing text.
- [x] 5.2 Record the catching assertion, a SHA-256 byte-identical restoration of
      every mutated file, and the conforming case passing after restoration.
      Report any survivor as "not caught" until the mutant itself has been read
      and shown to be a broken mutant; never weaken an assertion to make a
      mutation pass.

## 6. Verification

- [x] 6.1 Run `pnpm verify` with no browser installed and record its exact exit
      code and counts; a green run here covers neither browser tier.
- [x] 6.2 Run the website and extension browser tiers separately and sequentially,
      recording each tier's case count and exit code; name any red before
      attributing it and report a run with no tier summary as `HARNESS-ERROR`.
- [x] 6.3 Run `openspec validate m24-automatic-address-recovery --strict` and
      Prettier over the change's own files, recording exact output for both.

## 7. Independent verification

- [x] 7.1 Have a verifier compare the implementation against this change's
      proposal, design and spec delta rather than against the ticked boxes, and
      report any unresolved CRITICAL or WARNING finding before completion.
- [x] 7.2 Reconcile the roadmap's `Project Status` with Git and OpenSpec, changing
      the M24 line from PROPOSED to the stage actually reached by merged evidence
      and never claiming a stage that has not merged.

## 8. Spec sync and archive (orchestrator-owned handoff)

- [ ] 8.1 Promote the single `MODIFIED` block on its own branch and PR, re-count
      requirements, scenarios and capabilities by heading (expected **209 / 697 /
      17**, unchanged), and verify the promoted block is byte-identical to the
      delta block with all pre-existing scenarios and notes intact.
- [ ] 8.2 Archive with `--skip-specs` after sync is merged, verify archived files
      byte-identical against pre-archive digests and `openspec list` reporting no
      active changes; record any human-only blocker as `BLOCKED` or
      `NOT VERIFIED` rather than closing it.
