# Tasks

Scope: M6 slice 1. Give `@spectre-mail/storage` the contract M6's Storage block
describes and one implementation of it, behind a boundary that holds for every
package rather than for one. See `proposal.md` for why, `design.md` for how, and
`specs/spectre-storage/spec.md` for what is required.

## 1. Package wiring

- [ ] 1.1 Add `@spectre-mail/core` as a workspace dependency of
      `packages/storage` and run `pnpm install`. Verify the workspace lockfile
      records the link and `pnpm --filter @spectre-mail/storage typecheck` runs.
- [ ] 1.2 Add `fake-indexeddb` as a dev-only dependency, per `design.md` D7, and
      run `pnpm install`. Verify `pnpm test` collects the package's test file and
      that the dependency appears in no `dependencies` block of any workspace
      manifest.
- [ ] 1.3 Confirm `packages/storage/tsconfig.json` keeps `DOM` and
      `DOM.Iterable`, and record *why* it is the one package that has them: it is
      the only package whose job is to speak to a platform API. Verify the claim
      by compiling a `window` reference in `packages/mailbox` and observing it
      fail there and succeed here, rather than by reading the file.

## 2. The contract and the stored record

- [ ] 2.1 Write `packages/storage/src/contract.ts` with the `SpectreStorage`
      contract per `design.md` D1: `loadMailbox()` and `saveMailbox(mailbox)`, and
      nothing else. Verify the interface has exactly those two members, by a test
      that counts them rather than by reading the file — a contract that has grown
      a third operation is the change a reader would not notice.
- [ ] 2.2 Write `packages/storage/src/record.ts`: the versioned envelope, its
      current version as a named exported constant, and the read path that narrows
      an `unknown` record through `isMailbox` from `@spectre-mail/core`, per
      `design.md` D4. Verify by test that a record whose `credentials.provider`
      contradicts its `provider` is not returned, that a non-record is not
      returned, and that a record carrying an unknown version is not returned.
- [ ] 2.3 Verify the non-deletion rule (`design.md` D3) with a test that reads a
      record the build cannot narrow, then reads storage again and observes the
      record still there. Verify the assertion has a positive control: a record
      the build *can* narrow must still be returned, so the test cannot pass
      because every read fails.
- [ ] 2.4 Verify the "nothing stored" and "could not be read" distinction
      (`specs/spectre-storage/spec.md`) with two separate tests, and verify each
      can fail alone: one that a readable store with no record reports absence
      rather than failure, and one that an unreadable store reports a failure
      rather than absence.

## 3. The IndexedDB adapter

- [ ] 3.1 Implement `createIndexedDbStorage` with its `IDBFactory` as a
      **required** option per `design.md` D6, creating the database and its object
      store on open. Verify by test that the adapter can be constructed with no
      global `indexedDB` present at all, so the required-option claim is a
      property of the signature and not of the environment.
- [ ] 3.2 Implement the read path over the store and verify a round trip: a saved
      mailbox is returned by a later load with every field intact, including its
      credentials.
- [ ] 3.3 Implement the write path so it resolves on transaction completion rather
      than request success, per `design.md` D5. Verify with a test that observes
      the resolution point — an aborted transaction must reject, and must not
      resolve-then-fail.
- [ ] 3.4 Implement the failure paths: a database that cannot be opened, a
      rejected request, an aborted transaction, and a version change that blocks
      an upgrade. Verify each is driven by the test itself rather than asserted by
      inspection, per the last scenario in `specs/spectre-storage/spec.md`.
- [ ] 3.5 Replace `packages/storage/src/index.ts`'s M1 docblock, whose claim that
      the file "contains no runtime behaviour and no exports" stops being true
      here, and export the package's public surface from it. Verify no statement
      in the replaced docblock survives as false — read the diff, do not grep for
      a phrase.

## 4. Boundary rules

- [ ] 4.1 Generalise the existing mailbox storage rule to every shared package,
      per `design.md` D8, and state in the rule's comment that the compiler does
      not enforce it — measured, not assumed. Verify with a control that injects a
      storage global into a **different** package than the one the old rule
      covered, so the generalisation is shown to be broader than what it replaced
      rather than accidentally equal to it.
- [ ] 4.2 Add the reverse rule: no shared package may depend on
      `@spectre-mail/storage`. Verify with a probe that declares the dependency in
      a shared package and observes it reported, and confirm the control passes
      when the dependency is absent — an assertion nothing exercises cannot fail.
- [ ] 4.3 Verify `packages/storage` itself declares no dependency on
      `packages/providers`, `packages/mailbox`, or any app, and record the check.
      This is the direction that keeps the platform API inside one package.

## 5. Verification

- [ ] 5.1 Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
      `pnpm test`, `pnpm build`, and `pnpm verify`. Verify every command's exit
      code is read from output, and that test counts come from the reporter rather
      than being added by hand — this roadmap has published arithmetically-wrong
      totals three times.
- [ ] 5.2 Run a falsification pass over every assertion this change adds, with the
      harness kept outside the repository: each new assertion must be **observed
      to fail** with the intended test named, and every mutated file restored
      byte-identical by hash. Verify restoration is reported separately from the
      results, and that a mutation which stops the suite compiling is recorded as
      a distinct outcome rather than counted as a catch.
- [ ] 5.3 Record what this change does **not** establish, in each document's own
      words: `fake-indexeddb` is not a browser, no live browser run of the website
      has ever been made, no test contacts a provider, and `pnpm build` builds the
      website only. Verify each statement appears where a reader of that document
      would look for it.
- [ ] 5.4 Confirm `openspec validate spectre-storage --type change --strict`
      exits 0, and record that no promoted spec was modified — `mailbox-session`'s
      *A reload loses the session* scenario is deferred to the slice that delivers
      recovery, per `design.md` D9.

## 6. Docs

- [ ] 6.1 Record M6's slice breakdown in `docs/ROADMAP.md` so every
      persistence/recovery/privacy responsibility M5 and M6 both mention is
      assigned to exactly one slice, and the M5 acceptance table's three
      storage-dependent lines each name the M6 slice that delivers them. Verify no
      responsibility appears under two milestones.
- [ ] 6.2 Update the roadmap's Project Status block: the cursor stays on M6, and
      the block records that slice 1 (`spectre-storage`) is in progress with what
      it does and does not deliver. Verify the block states plainly that no client
      consumes the package yet, so a later session does not read the package's
      existence as persistence shipping.
- [ ] 6.3 Update `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, and the
      shared-package table for the package's new behaviour and the two new
      boundary rules. Verify the enforcement section names only rules that exist.
