# Tasks

Scope: M6 slice 2. Deliver `return to a recent mailbox` — the one M5 acceptance
line this milestone owns — by adopting a stored mailbox through the session and
wiring the website to it. See `proposal.md` for why, `design.md` for how, and
`specs/` for what is required.

## 1. The session states adoption makes necessary

- [x] 1.1 Add `idle`, `adopting`, `expired`, and `restoreFailed` to
      `SessionState`, with narrowing helpers alongside the existing three, and
      extract the new variants the way the existing ones were extracted
      (`state.ts`'s `Extract<>` pattern) rather than restated. Verify by a test
      that each helper narrows its own variant and refuses every other, so a
      helper written as `state.kind === "ready"` for a fourth variant cannot pass.
- [x] 1.2 Change `createMailboxSession`'s initial state to `idle`, and update
      every place that assumed the session begins `creating`. Verify with a test
      that a freshly built session reports `idle` and that `idle` says nothing is
      open — the same claim `creating` makes, which is why `opened` must be
      present on it.
- [x] 1.3 Give `expired` and `restoreFailed` the mailbox they are about, and give
      neither an inbox. Verify that a client reading `expired` finds no inbox to
      render, so the "inbox is empty" reading is unrepresentable rather than
      merely avoided: a test that an expired state has no `inbox` field at all.

## 2. Reconciliation through the owning provider

- [x] 2.1 Implement `restore(stored: Mailbox | null)` per `design.md` D1. On
      `null` it creates a mailbox and must go through the same path `open` does;
      verify with a test that `restore(null)` and `open()` produce the same states
      in the same order, so "first visit" and "retry" cannot drift apart.
- [x] 2.2 Implement adoption: report `adopting` **before** asking the provider, so
      a page can say it is checking rather than look frozen. Verify by reading the
      notification log synchronously after the call and before it settles, with a
      positive control that a compliant implementation produces one `adopting` —
      not zero, and not two.
- [x] 2.3 Reconcile by one listing through the mailbox's owning provider, per D3,
      and report `ready` carrying that listing rather than `notStarted`, so a
      restored mailbox does not immediately re-ask. Verify over a recording
      transport that adoption makes **exactly one** request and that the inbox
      arrives populated.
- [x] 2.4 Report `expired` when the provider answers `MAILBOX_EXPIRED`, and
      `restoreFailed` for every other failure. Verify each direction separately
      and prove they are not interchangeable: a test that asserts `expired` is
      **not** produced by a network failure, and one that asserts `restoreFailed`
      is **not** produced by an expiry — because the two states exist so no
      client has to compare an error code to tell them apart.
- [x] 2.5 Verify the empty-inbox trap directly: with a provider that answers a
      dead session as `200` and an empty list — the recorded Guerrilla behaviour
      from `docs/PROVIDERS.md` §3 — assert adoption reports `expired` and never
      `ready`. This is the single most important assertion in the change, and it
      must drive the real `sessionIsLive` path rather than a stub that returns
      `MAILBOX_EXPIRED` on request.
- [x] 2.6 Verify a failed reconciliation keeps the stored mailbox, by reading the
      adapter's raw store afterwards. Positive control: a record the build *can*
      narrow is still returned, so the assertion cannot pass by every read failing.
      **Deviation, recorded because the second half cannot be done as written.**
      `packages/mailbox` has no storage, so the "read the raw store afterwards" half
      belongs to `apps/web` — and `apps/web` **cannot read a real store back, because
      `jsdom` implements no IndexedDB**. What is asserted instead: the session keeps
      the mailbox in the failed state (`adoption.test.ts`), and the page performs **no
      write** when reconciliation is refused or when a fresh address is taken in its
      place (`recovery.test.tsx`). The positive control — a record this build *can*
      narrow is still returned — is a `packages/storage` property already covered by
      slice 1's seven stored-record tests. So the property is verified at both ends and
      **never end to end**, which is the same hole 6.3 records.
- [x] 2.7 Verify adoption never creates a replacement: over a transport, assert
      that restoring a live mailbox issues **no** `createMailbox` request, with a
      negative control that `restore(null)` does issue one.

## 3. The browser storage entry point

- [x] 3.1 Add a module to `packages/storage` exporting a browser-facing factory
      per `design.md` D6. It reads the platform's `indexedDB` **inside this
      layer** and hands it to `createIndexedDbStorage`. Verify by compiling it
      with `packages/storage`'s `DOM` lib and observing it succeed, and by
      asserting `apps/web`'s sources contain no `indexedDB` — read from disk by
      the same helper the boundary rules use, not by reading the diff.
      **The second half is now 3.4's rule rather than a separate assertion**, because
      3.4 generalises to every client anyway and a second assertion over `apps/web`
      alone would be the narrower version of the same rule — the nineteenth recorded
      instance of that mistake, caught before it shipped rather than after.
- [x] 3.2 Verify it reports unavailability rather than substituting a store: where
      the platform provides no `indexedDB`, it throws with a message naming the
      absence. Verify by constructing it with the global absent, which this
      repository can do because the global test environment is `"node"`, and by a
      negative control that a present global yields a working storage.
- [x] 3.3 Verify the injected rule is untouched: `createIndexedDbStorage` still
      requires an `IDBFactory` and still needs no global to be constructed. Add a
      test that constructs it with no global present, so a later reader relaxing
      the requirement sees a red test rather than a comment.
- [x] 3.4 Add the boundary assertion that a **client** names no platform storage
      API. The existing rules cover `packages/*`, and this is the first change
      that makes a client want to; extend the scope rather than relying on
      review. Verify with a probe planted in `apps/web` and one in a shared
      package, so the assertion covers both and each proves the other was not what
      caught it.

## 4. The client's boot and save

- [x] 4.1 Add `@spectre-mail/storage` to `apps/web`'s dependencies and run
      `pnpm install`. Verify the lockfile records the link and that
      `pnpm --filter @spectre-mail/web typecheck` exits 0.
- [x] 4.2 Compose the storage implementation in a new client module, so `App.tsx`
      does not build it inline. Verify it is constructed once, not per render, by
      a test that re-renders and asserts one construction — the same hazard
      `App.tsx`'s `useState` initialiser comment already records for the session.
- [x] 4.3 Extend the mount effect to read storage and then call `restore`, per D5.
      Verify with a StrictMode-shaped double mount that **one** storage read and
      **one** `restore` occur, for the reason the existing `opened` ref records:
      a second one against a rate-limiting provider is not a harmless duplicate.
- [x] 4.4 Implement the save rule from D4 — persist a `ready` mailbox the session
      was not handed — in exactly one place in the binding. Verify all three paths
      that must save: first visit, *Replace address*, and a retry after a failed
      creation. Verify the path that must **not**: adoption saves nothing, because
      the mailbox is already stored.
- [x] 4.5 Verify a failed storage read does not report "nothing is stored". A
      `loadMailbox` rejection must reach the page as a failure the user can see,
      and must not be caught and converted into `restore(null)`. This is the
      client-level half of the storage contract's `null`-means-one-thing
      requirement, and the conversion would reintroduce exactly the silent
      overwrite that requirement exists to prevent.

## 5. The page's states and copy

- [x] 5.1 Render `idle`, `adopting`, `expired`, and `restoreFailed` as distinct,
      labelled regions with their own prose, and update the *Each state is
      reachable* coverage to name all seven. Verify by `region` by accessible
      name, as the M5 slice 4 verification pass required — asserting on
      `visibleText()` was how two of three assertions came to be satisfied by
      unrelated copy.
- [x] 5.2 Write copy that is true in each state, and specifically that
      `restoreFailed` does **not** say the address is gone and `expired` does
      **not** present the address as usable. Verify with a negative assertion per
      state, since the whole reason these are separate states is that one piece of
      copy cannot honestly serve both.
- [x] 5.3 Offer the right action from each recoverable state: a new address from
      `expired`, a retry from `restoreFailed`, and — from `restoreFailed` — a way
      to start over without discarding what is stored, since a mailbox that merely
      could not be checked may still work. Verify each control is present and each
      does what it says.
- [x] 5.4 Update the page's own limits list, which currently states *"A reload
      discards this address. SpectreMail stores nothing on your device yet."* Both
      halves become false with this change. Verify by reading the rendered list,
      and add the honest replacement: what **is** stored, and that the privacy
      controls that delete it do not exist yet — which is the next slice, and
      saying so is better than implying this product offers deletion.

## 6. Verification

- [x] 6.1 Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
      `pnpm test`, `pnpm build`, and `pnpm verify`, reading every exit code from
      output and taking test counts from the reporter rather than adding them by
      hand. Record what each command proves and what it does not.
- [x] 6.2 Run a falsification pass over every assertion this change adds, with the
      harness outside the repository: each must be **observed to fail** with the
      intended test named, every mutated file restored byte-identical by hash, and
      restoration reported separately from the results. Count a mutation that
      stops the suite compiling as its own outcome, never as a catch. Carry the
      harness's refusal to run an ambiguous needle forward — it is what caught a
      renamed scenario at proposal time.
- [x] 6.3 Record what this change does **not** establish, in each document's own
      words: no live browser run has ever been made and this change is the first
      thing that would persist anything in one; `fake-indexeddb` is not a browser;
      no test contacts a provider; the polling cadence has still never run against
      a live provider; and a restored mailbox has never been reconciled against a
      real Guerrilla Mail session.
- [x] 6.4 Confirm `openspec validate mailbox-adoption --type change --strict`
      exits 0, and confirm the promoted `mailbox-session` reload scenario carries
      the amendment **in this delta**, so the archived delta and the promoted spec
      agree. Verify that agreement mechanically — by extracting every requirement
      and scenario title from both and comparing — rather than by reading them.
      **Validation exited 0 with the three apply-stage amendments in the delta. The
      mechanical comparison itself is deferred to the sync stage**, because the specs
      are not promoted yet and comparing a delta against a spec that does not contain
      it yet would report a gap that is the correct state of the world. The baseline
      to compare against, read from the promoted files rather than recalled: **9
      capabilities, 93 requirements, 232 scenarios**, of which `website-client` is 16
      requirements and 39 scenarios.

## 7. Docs

- [x] 7.1 Update `docs/ROADMAP.md`'s Project Status: slice 2's state, what it
      delivers, and the sentence that must be in it plainly — the privacy controls
      that delete stored data **do not exist yet**, so this milestone has added
      persistence without adding its removal. Update the M6 slice table and state
      plainly whether `return to a recent mailbox` is now delivered.
- [x] 7.2 Update `AGENTS.md`, `README.md`, and `docs/ARCHITECTURE.md` for the new
      operation, the new states, the browser entry point, and the client's new
      dependency. Verify the enforcement section names only rules that exist, and
      that the client-section claim "a reload discards the mailbox" is gone rather
      than left standing beside code that contradicts it.
- [x] 7.3 Verify no document in the repository still claims the website persists
      nothing. This is a mechanical check over the tracked markdown, not a reading
      exercise: `AGENTS.md`, `README.md`, `App.tsx`'s module note, and
      `useMailboxSession`'s module note all currently assert it, and a stale claim
      in a file a later session reads first is how a milestone gets re-implemented.