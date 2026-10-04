# Tasks

Scope: M6 slice 1. Give `@spectre-mail/storage` the contract M6's Storage block
describes and one implementation of it, behind a boundary that holds for every
package rather than for one. See `proposal.md` for why, `design.md` for how, and
`specs/spectre-storage/spec.md` for what is required.

## 1. Package wiring

- [x] 1.1 Add `@spectre-mail/core` as a workspace dependency of
      `packages/storage` and run `pnpm install`. Verify the workspace lockfile
      records the link and `pnpm --filter @spectre-mail/storage typecheck` runs.
      *Verified 2026-10-05: the lockfile records `link:../core`, and
      `pnpm --filter @spectre-mail/storage typecheck` exits 0.*
- [x] 1.2 Add `fake-indexeddb` as a dev-only dependency, per `design.md` D7, and
      run `pnpm install`. Verify `pnpm test` collects the package's test file and
      that the dependency appears in no `dependencies` block of any workspace
      manifest.
      *Verified 2026-10-05: `fake-indexeddb@6.2.5` appears only under
      `packages/storage`'s `devDependencies` and in the lockfile's `devDependencies`
      for that package; `pnpm test` collects `packages/storage/src/record.test.ts`
      and `packages/storage/src/indexeddb.test.ts`.*
- [x] 1.3 Confirm `packages/storage/tsconfig.json` keeps `DOM` and
      `DOM.Iterable`, and record *why* it is the one package that has them: it is
      the only package whose job is to speak to a platform API. Verify the claim
      by compiling a `window` reference in `packages/mailbox` and observing it
      fail there and succeed here, rather than by reading the file.
      *Verified 2026-10-05 by compilation: `export const probe: typeof window = window;`
      fails with `TS2304` in `packages/mailbox` (exit 1) and compiles in
      `packages/storage` (exit 0). Both probes were removed afterwards; `git status`
      carries neither.*

## 2. The contract and the stored record

- [x] 2.1 Write `packages/storage/src/contract.ts` with the `SpectreStorage`
      contract per `design.md` D1: `loadMailbox()` and `saveMailbox(mailbox)`, and
      nothing else. Verify the interface has exactly those two members, by a test
      that counts them rather than by reading the file — a contract that has grown
      a third operation is the change a reader would not notice.
      *Verified: `indexeddb.test.ts` › "exposes exactly the two operations the
      contract declares" counts `Object.getOwnPropertyNames` on a value typed
      `SpectreStorage` and asserts the set is exactly `loadMailbox`/`saveMailbox`.*
- [x] 2.2 Write `packages/storage/src/record.ts`: the versioned envelope, its
      current version as a named exported constant, and the read path that narrows
      an `unknown` record through `isMailbox` from `@spectre-mail/core`, per
      `design.md` D4. Verify by test that a record whose `credentials.provider`
      contradicts its `provider` is not returned, that a non-record is not
      returned, and that a record carrying an unknown version is not returned.
      *Verified: three tests in `record.test.ts`, plus the adapter's own
      end-to-end refusal for the version case.*
- [x] 2.3 Verify the non-deletion rule (`design.md` D3) with a test that reads a
      record the build cannot narrow, then reads storage again and observes the
      record still there. Verify the assertion has a positive control: a record
      the build *can* narrow must still be returned, so the test cannot pass
      because every read fails.
      *Verified: `indexeddb.test.ts` › "refuses to return a record it cannot
      narrow, and leaves it in place" reads the raw store directly to confirm the
      bytes are untouched, and the conforming case is covered by "returns a saved
      mailbox, credentials and all" — so the test cannot pass by every read
      failing.*
- [x] 2.4 Verify the "nothing stored" and "could not be read" distinction
      (`specs/spectre-storage/spec.md`) with two separate tests, and verify each
      can fail alone: one that a readable store with no record reports absence
      rather than failure, and one that an unreadable store reports a failure
      rather than absence.
      *Verified, and each proven able to fail alone: four tests split the two
      directions, and the falsification pass mutated `loadMailbox` into
      `try { … } catch { return null; }` and observed the three failure-direction
      tests go red while the absence-direction tests stayed green.*

## 3. The IndexedDB adapter

- [x] 3.1 Implement `createIndexedDbStorage` with its `IDBFactory` as a
      **required** option per `design.md` D6, creating the database and its object
      store on open. Verify by test that the adapter can be constructed with no
      global `indexedDB` present at all, so the required-option claim is a
      property of the signature and not of the environment.
      *Verified: the global environment is `"node"` for this file, so no
      `indexedDB` exists; "needs no global IndexedDB to be constructed at all"
      constructs the adapter and drives it through a full round trip. The falsification
      pass also swapped the injected factory for `globalThis.indexedDB` and observed
      the round-trip tests fail.*
- [x] 3.2 Implement the read path over the store and verify a round trip: a saved
      mailbox is returned by a later load with every field intact, including its
      credentials.
      *Verified, field by field rather than by comparing the object to itself —
      including `credentials`, and a second test asserting nothing is stored
      outside the one key the contract declares.*
- [x] 3.3 Implement the write path so it resolves on transaction completion rather
      than request success, per `design.md` D5. Verify with a test that observes
      the resolution point — an aborted transaction must reject, and must not
      resolve-then-fail.
      *Verified: both directions are observed *at the resolution point* with a
      stub factory that fires the request's `success` first and the transaction's
      `complete` later, asserting the promise is still pending in between. Also
      proven to hold against real `fake-indexeddb` semantics, where "has the value
      on disk by the time the save resolves" reads the raw store immediately after
      the save resolves.*
- [x] 3.4 Implement the failure paths: a database that cannot be opened, a
      rejected request, an aborted transaction, and a version change that blocks
      an upgrade. Verify each is driven by the test itself rather than asserted by
      inspection, per the last scenario in `specs/spectre-storage/spec.md`.
      *Verified: each is driven by a stub event (`openBlocked`, `requestFails`,
      `transactionCompletes`/`requestFails` on the transaction), plus two
      `fake-indexeddb` cases that the platform itself produces — a database newer
      than this build, and a store that cannot be read. `onversionchange` is
      covered separately by asserting the connection is closed.*
- [x] 3.5 Replace `packages/storage/src/index.ts`'s M1 docblock, whose claim that
      the file "contains no runtime behaviour and no exports" stops being true
      here, and export the package's public surface from it. Verify no statement
      in the replaced docblock survives as false — read the diff, do not grep for
      a phrase.
      *Verified by reading the diff: the docblock's two claims are both gone —
      there is no sentence about a file that holds no behaviour and no exports,
      and the file now re-exports the contract, the record helpers, and the
      adapter factory. Nothing was added that the diff does not show.*

## 4. Boundary rules

- [x] 4.1 Generalise the existing mailbox storage rule to every shared package,
      per `design.md` D8, and state in the rule's comment that the compiler does
      not enforce it — measured, not assumed. Verify with a control that injects a
      storage global into a **different** package than the one the old rule
      covered, so the generalisation is shown to be broader than what it replaced
      rather than accidentally equal to it.
      *Verified: the probe is planted in `packages/core`, which the old rule never
      scanned, and the generalisation is asserted per package. Generalising it
      also surfaced a real false positive — `providers`' recorded `set-cookie`
      fixture — which forced a narrowing of the pattern, recorded in `design.md`'s
      Verification findings with its cost stated.*
- [x] 4.2 Add the reverse rule: no shared package may depend on
      `@spectre-mail/storage`. Verify with a probe that declares the dependency in
      a shared package and observes it reported, and confirm the control passes
      when the dependency is absent — an assertion nothing exercises cannot fail.
      *Verified, with the gap this rule's controls first had recorded and fixed: a
      control that called the pattern directly left two mutations green, and a
      filename filter let a probe in one package satisfy a form the rule missed in
      another. Both are described in `design.md`. **What it does not check:** the
      dependency declared in a `package.json`, only the specifier a module imports —
      stated in the rule's own comment, since a manifest-level fact is pnpm's to
      refuse.*
- [x] 4.3 Verify `packages/storage` itself declares no dependency on
      `packages/providers`, `packages/mailbox`, or any app, and record the check.
      This is the direction that keeps the platform API inside one package.
      *Verified: the manifest is read and its `dependencies` compared to exactly
      `["@spectre-mail/core"]`, with a precondition that the block is non-empty so
      an empty read cannot pass without having compared anything, and a second
      assertion that no name appears in both `dependencies` and `devDependencies`.*

## 5. Verification

- [x] 5.1 Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
      `pnpm test`, `pnpm build`, and `pnpm verify`. Verify every command's exit
      code is read from output, and that test counts come from the reporter rather
      than being added by hand — this roadmap has published arithmetically-wrong
      totals three times.
      *Verified 2026-10-05. `pnpm verify` exit 0: 8 of 8 projects typecheck, eslint
      exit 0, `All matched files use Prettier code style`, **28 files / 574 tests**
      passed (read from the reporter), vite build emitted `dist`. Counts from the
      reporter: storage 27, architecture 44, and the prior totals unchanged. One
      note: `pnpm lint` printed a `NativeCommandError` wrapper once while exiting
      0, and was re-run to confirm — the exit code is the fact, not the wrapper.*
- [x] 5.2 Run a falsification pass over every assertion this change adds, with the
      harness kept outside the repository: each new assertion must be **observed
      to fail** with the intended test named, and every mutated file restored
      byte-identical by hash. Verify restoration is reported separately from the
      results, and that a mutation which stops the suite compiling is recorded as
      a distinct outcome rather than counted as a catch.
      *Verified 2026-10-05: the harness lives at
      `%LOCALAPPDATA%/Temp/opencode/falsify-storage.mjs`, outside the repository, and
      **27 of 27 mutations caught**, `green 0`, `nocompile 0`, and **0 caught by a
      test other than the intended one**. Restoration is asserted by SHA-256 after
      every mutation and any mismatch throws; the report line for it is separate
      from the per-mutation outcomes. The three outcomes are counted separately, and
      the harness **refused to run** a mutation whose needle appeared twice rather
      than silently replacing the first. Six defects this change authored were found
      and fixed; all six are recorded in `design.md`'s Verification findings.*
- [x] 5.3 Record what this change does **not** establish, in each document's own
      words: `fake-indexeddb` is not a browser, no live browser run of the website
      has ever been made, no test contacts a provider, and `pnpm build` builds the
      website only. Verify each statement appears where a reader of that document
      would look for it.
      *Verified by reading each updated section: `AGENTS.md` (testing, setup, and
      the new package entry), `README.md`, `docs/ARCHITECTURE.md`,
      `docs/ROADMAP.md`'s Project Status and M6 block, and `design.md`'s Risks
      section. Each states what the tests prove and what they do not.*
- [x] 5.4 Confirm `openspec validate spectre-storage --type change --strict`
      exits 0, and record that no promoted spec was modified — `mailbox-session`'s
      *A reload loses the session* scenario is deferred to the slice that delivers
      recovery, per `design.md` D9.
      *Verified 2026-10-05: `Change 'spectre-storage' is valid`, exit 0. The
      change's Capabilities block adds one capability and modifies none, so no
      promoted spec is touched by this slice — promoting a `mailbox-session`
      amendment here would describe an adopt path that does not exist yet.*

## 6. Docs

- [x] 6.1 Record M6's slice breakdown in `docs/ROADMAP.md` so every
      persistence/recovery/privacy responsibility M5 and M6 both mention is
      assigned to exactly one slice, and the M5 acceptance table's three
      storage-dependent lines each name the M6 slice that delivers them. Verify no
      responsibility appears under two milestones.
      *Verified: the M6 block lists the slices, and the M5/M6 reconciliation keeps
      `copy the OTP` at M10 while the two storage-dependent lines now name their M6
      slice. No responsibility is written under both milestones.*
- [x] 6.2 Update the roadmap's Project Status block: the cursor stays on M6, and
      the block records that slice 1 (`spectre-storage`) is in progress with what
      it does and does not deliver. Verify the block states plainly that no client
      consumes the package yet, so a later session does not read the package's
      existence as persistence shipping.
      *Verified: the block says the package has behaviour and is not consumed by
      any client, in those words, and `packages/storage` appears in
      `apps/web`'s dependency list nowhere.*
- [x] 6.3 Update `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, and the
      shared-package table for the package's new behaviour and the two new
      boundary rules. Verify the enforcement section names only rules that exist.
      *Verified: `AGENTS.md`'s package entry and testing counts, `README.md`'s
      shared-package list, and `docs/ARCHITECTURE.md`'s storage boundary. The
      enforcement section names 44 assertions, which is the number the reporter
      prints.*