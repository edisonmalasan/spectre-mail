# Tasks

## 1. The contract gains a removal operation

- [x] 1.1 Add `clearAll(): Promise<void>` to `SpectreStorage` in
      `packages/storage/src/contract.ts`, documented to mean *everything this device
      holds* and not only the records this build recognises, and update the module
      note that says the contract has two operations. Verify by `pnpm typecheck`,
      which must now fail in every implementation that has not supplied it.
- [x] 1.2 Record in the contract's documentation that the operation reaches the whole
      database rather than one key, with the reason: a control the user was told
      clears all of it must not preserve a record kind a later build adds. Verify by
      reading the requirement in
      `openspec/changes/privacy-controls/specs/spectre-storage/spec.md` and confirming
      the documentation states the same thing in the same terms.

## 2. The adapter removes the database

- [x] 2.1 Implement `clearAll` in `packages/storage/src/indexeddb.ts` as
      `deleteDatabase`, resolving on the request's success and rejecting on its error.
      Verify by a test asserting a read after a successful removal finds nothing.
- [x] 2.2 Reject on `onblocked` rather than awaiting, mirroring `openDatabase`'s
      handling of the same event, with a message naming another open connection as the
      cause. Verify by a test that drives `onblocked` and asserts the promise rejects;
      assert it does not wait, by racing the rejection against a timer rather than by
      timing out on it.
- [x] 2.3 Prove the removal takes the whole database rather than the one key this
      build knows: create a second object store by hand, remove, reopen, and assert
      the unrecognised store is gone. Verify that test fails against an implementation
      that deletes only `CURRENT_MAILBOX_KEY` — that is the positive control which
      makes it worth having.
- [x] 2.4 Cover the remaining spec branches in `indexeddb.test.ts`: removal with
      nothing stored succeeds; a refused removal is reported as a failure and leaves
      what was stored intact; storing and reading again after a removal works.
      Verify by `pnpm test` in `packages/storage`.
- [x] 2.5 Widen the adapter's *"exposes exactly the two operations"* assertion to
      three and rename it, recording in its comment that the check caught this change
      rather than being adjusted to accommodate it (D12). Verify by deliberately
      removing `clearAll` from the returned object and observing that test fail.
- [x] 2.6 Cover the browser entry point delegating removal in `browser.test.ts`, and
      verify by `pnpm test`. Note in the change record that this test still does not
      execute against a real browser's IndexedDB, and that no test here will.

## 3. The binding learns what this device holds

- [x] 3.1 Add `localData: { kind: "stored" } | { kind: "none" }` and a
      `clearStored()` to `MailboxSessionBinding` in
      `apps/web/src/useMailboxSession.ts`. Set it only where storage state is
      confirmed — after a successful boot read, after a successful save, after a
      removal — and not from the `handed` ref, which is claimed before the write is
      awaited and would claim a mailbox the device does not have when a write fails
      (D7). Verify by a test asserting `none` after a refused save while `saving`
      reports `notSaved`.
- [x] 3.2 Implement `clearStored` to call through the contract and reject with the
      platform's reason, narrowing a blocked store without offering the control. Do
      not catch. Verify by a test asserting the rejection reaches the caller.
- [x] 3.3 Implement `clearAll` in the website's `storage-stub.ts` and in every
      `SpectreStorage` double in `recovery.test.tsx`, recording clears so the client
      suite can assert the call reached the contract. Verify by `pnpm typecheck`,
      which fails until each is supplied.

## 4. The page offers removal and reports it honestly

- [x] 4.1 Add a local-data region to `apps/web/src/App.tsx`, rendered in every
      session state, stating what is kept, that it is in this browser only, and —
      replacing the current text that says no button can delete it — that it can be
      removed. Verify by a test asserting the region does not claim stored data is
      undeletable.
- [x] 4.2 Implement the control with its two-step confirmation (D8) and its own
      pending, cleared, and failed states. Offer it only when `localData` is
      `stored`; when it is `none`, say nothing is kept on this device and offer
      nothing. Verify by tests for each of the three states.
- [x] 4.3 Keep the mailbox on screen after a removal, keep the inbox usable, and say
      that a later visit will not offer this address back (D5). Verify by a test
      asserting the address is still rendered and the inbox still listed after a
      removal.
- [x] 4.4 Show a refused removal as a refusal with the platform's reason, never as a
      removal (D9). Verify by a test asserting the page does not describe the data as
      removed after a rejected `clearAll`.

## 5. A removal survives the page continuing to run

- [x] 5.1 Assert that after a removal, inbox transitions do not store the address
      again, and that a mailbox the user subsequently asks for *is* stored (D6, and
      the spec's precedence clause). Verify by a test counting saves across several
      inbox transitions after a removal, with a positive control in the same file that
      does issue a save — otherwise a stub that never saves would satisfy it.
- [x] 5.2 Confirm no re-save guard was added to make this true: the existing
      id-comparison should already be doing it. Verify by reading `useMailboxSession.ts`
      and recording in the change that no `persist`-style ref was introduced for
      removal, with the reason.

## 6. Falsification

- [x] 6.1 Run a mutation against every assertion this change added, confirming each is
      caught **by the assertion it was written for**, with the failing test named. A
      mutation that leaves the suite green is a defect in the assertion, not a pass;
      a mutation that leaves the suite uncollectable is a broken mutation and is
      reported as its own outcome. Record the count and the restoration check by
      SHA-256.
- [x] 6.2 Deliberately include the two mutations that matter most and confirm they are
      caught: an implementation that deletes only the known key instead of the
      database, and a save path that re-writes a cleared address.

## 7. Documentation

- [x] 7.1 Annotate the Privacy controls block in `docs/ROADMAP.md` with a dated note
      mapping its three named controls onto what this data model can act on, stating
      that `Clear mailbox history` has no referent because no message history is
      persisted, and why one control was shipped rather than three (D4). Move slice 3
      in the M6 slice table to applied.
- [x] 7.2 Correct the several statements in `AGENTS.md` and `README.md` that no button
      anywhere deletes stored data, replacing them with what is now true and with what
      remains untrue — that the website has still never been run in a real browser, so
      the IndexedDB path is still unexercised end to end.
- [x] 7.3 Record the counts actually observed — tests per package and boundary
      assertions in total — and update only the numbers that were measured.

## 8. Verification

- [x] 8.1 Run the full gate set — `pnpm install`, `pnpm typecheck`, `pnpm lint`,
      `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm verify` — and record exit
      codes with what each proves and what it does not.
- [x] 8.2 Run `openspec validate privacy-controls --type change --strict` and
      `openspec validate --specs --strict`.
- [x] 8.3 Review the full diff against the deltas, comparing the implementation to the
      change's own artifacts rather than to the ticked boxes, and record any deviation
      as an amendment **in the delta** rather than leaving it for the sync stage.

## 6a. Falsification results, recorded 2026-10-05

18 edits, run through `C:\Users\Edison\AppData\Local\Temp\opencode\falsify-privacy.mjs`
(outside the repository, so a failure cannot leave a mutated file in the tree it audits).
**17 caught by the intended assertion**, and restoration verified by SHA-256 for all 18.

Five outcomes were kept distinct, because two of them are how a dead case gets filed as
coverage: `nocompile` (the edit failed to build, which says nothing about the assertion),
`green` (the assertion did not fail, which is a defect rather than a pass), and
`wrongcatch` (the suite went red somewhere other than the intended test).

The 18th edit is a **control**: a comment reworded, expected to stay green, and it does.
Without it, "17 caught" would only show that the harness notices an edit.

### The two mutations task 6.2 named

- **deletes only the known key** — reimplemented as deleting a *different* database, since
  a real `store.delete(CURRENT_MAILBOX_KEY)` would need `openDatabase` and the branch is
  the same. Caught by `removes a store this build does not recognise, not only the key it
  stores`.
- **a save path that re-writes a cleared address** — the id-comparison removed. Caught by
  `does not write the address back after a removal, however many checks follow`.

### One mutation stayed green, and it found a real gap

`reject(new Error("Removing the database failed."))` — replacing the adapter's
`request.error ?? …` **fallback** — left the suite green.

The cause was not a narrow assertion. It was that **the fallback branch had no test at
all**: every existing `deleteFails` sets an `error`, so the right-hand side of that `??`
was reachable and unguarded, and its wording could be replaced with anything. That is the
twentieth recorded instance of a check narrower than its rule, and the first one this
slice found.

Fixed by adding `deleteFailsSilently()` to the stub and
`names what failed, when the platform fails without saying why`, which asserts the message
names the operation, the thing, **and the database** — a user with two SpectreMail
origins open cannot otherwise tell which one is refusing. `packages/storage` is 44 tests.

**The first run then reported `wrongcatch`** for that mutation, and that was the harness
working rather than failing: the assertion I had aimed it at
(`says what caused a refusal, in terms the user can act on`) drives a **blocked**
removal and never reaches the `onerror` fallback at all. The mutation was correct and my
target was wrong.

### A flaky suite, found by the control and not by the tests

The comment-only control failed intermittently — about one run in three — which is
impossible for a comment. It exposed **two tests waiting on the wrong thing**, both of
which asserted on state a promise callback sets *after* the visible state settles:

- `offers a removal once it has stored something` waited for `ready`, but `ready` is
  published when the mailbox exists while `localData` becomes `stored` only in the
  `saveMailbox` success callback — a later turn of the microtask queue. The page is
  briefly "Ready" while holding nothing, and it says so.
- `says nothing that contradicts what the page does` in `App.test.tsx`, on the new
  `/holding this address/i` assertion, for the same reason.

Both now wait on `local-data-stored`, which is the observation that establishes the
precondition. **30 consecutive runs of `apps/web` afterwards: 0 red.**

This is worth recording beyond the two fixes, because the shape is a property of the
binding rather than of the tests: a binding publishes what the **user** sees from the
**session**, and what the **device** holds arrives from a promise afterwards, so a wait
on the first cannot observe the second.

## 9. Sync and archive

- [x] 9.1 At the sync stage, promote both deltas by **copying** delta text into
      `openspec/specs/`, not by retyping it.
- [x] 9.2 Correct `spectre-storage`'s `Purpose` in the promoted spec, which still
      claims the capability is delivered but not consumed and was made false by slice 2
      (D10). A delta's `## Purpose` is ignored for an existing capability, so this
      must be edited directly.
- [x] 9.3 Verify delta and promoted spec agree **mechanically** — every requirement
      and scenario title in the delta present in the promoted spec — and report the
      count checked.

      **Done, and the check was then made stronger than the task asked for.** Title
      agreement was verified first: 20 delta titles checked (2 requirements, 18
      scenarios), **0 missing**. But title agreement is a weak check — a hand-typed
      paraphrase keeps the heading and loses the text — so a second script compares each
      delta block **byte for byte** against the promoted spec and reports the first
      differing line when they differ. **2 verbatim, 0 divergent, 0 absent.** Both
      scripts live outside the repository, in the temp directory.
- [ ] 9.4 Archive with `--skip-specs`, since the sync stage has already promoted the
      deltas, and update the roadmap cursor.