# Tasks

## 1. The contract gains a removal operation

- [ ] 1.1 Add `clearAll(): Promise<void>` to `SpectreStorage` in
      `packages/storage/src/contract.ts`, documented to mean *everything this device
      holds* and not only the records this build recognises, and update the module
      note that says the contract has two operations. Verify by `pnpm typecheck`,
      which must now fail in every implementation that has not supplied it.
- [ ] 1.2 Record in the contract's documentation that the operation reaches the whole
      database rather than one key, with the reason: a control the user was told
      clears all of it must not preserve a record kind a later build adds. Verify by
      reading the requirement in
      `openspec/changes/privacy-controls/specs/spectre-storage/spec.md` and confirming
      the documentation states the same thing in the same terms.

## 2. The adapter removes the database

- [ ] 2.1 Implement `clearAll` in `packages/storage/src/indexeddb.ts` as
      `deleteDatabase`, resolving on the request's success and rejecting on its error.
      Verify by a test asserting a read after a successful removal finds nothing.
- [ ] 2.2 Reject on `onblocked` rather than awaiting, mirroring `openDatabase`'s
      handling of the same event, with a message naming another open connection as the
      cause. Verify by a test that drives `onblocked` and asserts the promise rejects;
      assert it does not wait, by racing the rejection against a timer rather than by
      timing out on it.
- [ ] 2.3 Prove the removal takes the whole database rather than the one key this
      build knows: create a second object store by hand, remove, reopen, and assert
      the unrecognised store is gone. Verify that test fails against an implementation
      that deletes only `CURRENT_MAILBOX_KEY` — that is the positive control which
      makes it worth having.
- [ ] 2.4 Cover the remaining spec branches in `indexeddb.test.ts`: removal with
      nothing stored succeeds; a refused removal is reported as a failure and leaves
      what was stored intact; storing and reading again after a removal works.
      Verify by `pnpm test` in `packages/storage`.
- [ ] 2.5 Widen the adapter's *"exposes exactly the two operations"* assertion to
      three and rename it, recording in its comment that the check caught this change
      rather than being adjusted to accommodate it (D12). Verify by deliberately
      removing `clearAll` from the returned object and observing that test fail.
- [ ] 2.6 Cover the browser entry point delegating removal in `browser.test.ts`, and
      verify by `pnpm test`. Note in the change record that this test still does not
      execute against a real browser's IndexedDB, and that no test here will.

## 3. The binding learns what this device holds

- [ ] 3.1 Add `localData: { kind: "stored" } | { kind: "none" }` and a
      `clearStored()` to `MailboxSessionBinding` in
      `apps/web/src/useMailboxSession.ts`. Set it only where storage state is
      confirmed — after a successful boot read, after a successful save, after a
      removal — and not from the `handed` ref, which is claimed before the write is
      awaited and would claim a mailbox the device does not have when a write fails
      (D7). Verify by a test asserting `none` after a refused save while `saving`
      reports `notSaved`.
- [ ] 3.2 Implement `clearStored` to call through the contract and reject with the
      platform's reason, narrowing a blocked store without offering the control. Do
      not catch. Verify by a test asserting the rejection reaches the caller.
- [ ] 3.3 Implement `clearAll` in the website's `storage-stub.ts` and in every
      `SpectreStorage` double in `recovery.test.tsx`, recording clears so the client
      suite can assert the call reached the contract. Verify by `pnpm typecheck`,
      which fails until each is supplied.

## 4. The page offers removal and reports it honestly

- [ ] 4.1 Add a local-data region to `apps/web/src/App.tsx`, rendered in every
      session state, stating what is kept, that it is in this browser only, and —
      replacing the current text that says no button can delete it — that it can be
      removed. Verify by a test asserting the region does not claim stored data is
      undeletable.
- [ ] 4.2 Implement the control with its two-step confirmation (D8) and its own
      pending, cleared, and failed states. Offer it only when `localData` is
      `stored`; when it is `none`, say nothing is kept on this device and offer
      nothing. Verify by tests for each of the three states.
- [ ] 4.3 Keep the mailbox on screen after a removal, keep the inbox usable, and say
      that a later visit will not offer this address back (D5). Verify by a test
      asserting the address is still rendered and the inbox still listed after a
      removal.
- [ ] 4.4 Show a refused removal as a refusal with the platform's reason, never as a
      removal (D9). Verify by a test asserting the page does not describe the data as
      removed after a rejected `clearAll`.

## 5. A removal survives the page continuing to run

- [ ] 5.1 Assert that after a removal, inbox transitions do not store the address
      again, and that a mailbox the user subsequently asks for *is* stored (D6, and
      the spec's precedence clause). Verify by a test counting saves across several
      inbox transitions after a removal, with a positive control in the same file that
      does issue a save — otherwise a stub that never saves would satisfy it.
- [ ] 5.2 Confirm no re-save guard was added to make this true: the existing
      id-comparison should already be doing it. Verify by reading `useMailboxSession.ts`
      and recording in the change that no `persist`-style ref was introduced for
      removal, with the reason.

## 6. Falsification

- [ ] 6.1 Run a mutation against every assertion this change added, confirming each is
      caught **by the assertion it was written for**, with the failing test named. A
      mutation that leaves the suite green is a defect in the assertion, not a pass;
      a mutation that leaves the suite uncollectable is a broken mutation and is
      reported as its own outcome. Record the count and the restoration check by
      SHA-256.
- [ ] 6.2 Deliberately include the two mutations that matter most and confirm they are
      caught: an implementation that deletes only the known key instead of the
      database, and a save path that re-writes a cleared address.

## 7. Documentation

- [ ] 7.1 Annotate the Privacy controls block in `docs/ROADMAP.md` with a dated note
      mapping its three named controls onto what this data model can act on, stating
      that `Clear mailbox history` has no referent because no message history is
      persisted, and why one control was shipped rather than three (D4). Move slice 3
      in the M6 slice table to applied.
- [ ] 7.2 Correct the several statements in `AGENTS.md` and `README.md` that no button
      anywhere deletes stored data, replacing them with what is now true and with what
      remains untrue — that the website has still never been run in a real browser, so
      the IndexedDB path is still unexercised end to end.
- [ ] 7.3 Record the counts actually observed — tests per package and boundary
      assertions in total — and update only the numbers that were measured.

## 8. Verification

- [ ] 8.1 Run the full gate set — `pnpm install`, `pnpm typecheck`, `pnpm lint`,
      `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm verify` — and record exit
      codes with what each proves and what it does not.
- [ ] 8.2 Run `openspec validate privacy-controls --type change --strict` and
      `openspec validate --specs --strict`.
- [ ] 8.3 Review the full diff against the deltas, comparing the implementation to the
      change's own artifacts rather than to the ticked boxes, and record any deviation
      as an amendment **in the delta** rather than leaving it for the sync stage.

## 9. Sync and archive

- [ ] 9.1 At the sync stage, promote both deltas by **copying** delta text into
      `openspec/specs/`, not by retyping it.
- [ ] 9.2 Correct `spectre-storage`'s `Purpose` in the promoted spec, which still
      claims the capability is delivered but not consumed and was made false by slice 2
      (D10). A delta's `## Purpose` is ignored for an existing capability, so this
      must be edited directly.
- [ ] 9.3 Verify delta and promoted spec agree **mechanically** — every requirement
      and scenario title in the delta present in the promoted spec — and report the
      count checked.
- [ ] 9.4 Archive with `--skip-specs`, since the sync stage has already promoted the
      deltas, and update the roadmap cursor.