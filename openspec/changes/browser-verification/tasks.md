# Tasks

## 0. The repair this change now carries (D9, D10)

- [ ] 0.1 Replace the per-invocation unmount guard in `apps/web/src/useMailboxSession.ts`'s
      save effect with a **mounted ref**: a `useRef(true)` cleared by an effect that runs
      once on mount and cleans up once on unmount. **Leave `handed.current` exactly as it
      is** — it is claimed before the write is awaited, and it is what prevents the
      duplicate write its own comment documents.
- [ ] 0.2 Write the **unit regression test that holds the window open**, which is the part
      jsdom could not represent: a storage whose `saveMailbox` does not resolve until the
      test says so, an inbox transition published while the write is in flight, and then
      the release. The assertion is that the page reports holding the address afterwards.
- [ ] 0.3 Prove 0.2 can fail: mutate the guard back to the per-invocation flag and require
      the intended test to go red. A regression test never observed failing is not one.
- [ ] 0.4 Prove the browser tier's removal specs can fail for the **same reason** — revert
      0.1 in the built site and require the removal spec to go red naming the missing
      control. Without this, the browser tier is not yet known to cover this defect and its
      passing would be uninformative.
- [ ] 0.5 Delete `apps/web/e2e/zz-diagnostic.spec.ts`, keeping its **verbatim measurement**
      in `design.md` D9. It is an instrument, not a check: its assertions encode the
      defect, so shipping it would make the suite red on purpose.

## 1. Dependencies and configuration

- [x] 1.1 Add Playwright as a pinned dev dependency of `apps/web`, matching the version
      the spike already uses, and add the `pnpm-workspace.yaml` note recording that this
      is the first workspace dependency needing a browser download. Do **not** add
      `tests/provider-spike` to `packages:`.
- [x] 1.2 Add `test:browser` to the root `package.json`, running the browser suite
      against the built site. **It is not added to `verify`** (D3).
- [x] 1.3 Add `playwright.config.ts` with the preview-server base URL and the spec
      patterns, and gitignore Playwright's artefacts.
- [x] 1.4 Verify `pnpm verify` still exits 0 **with no browser installed**, and record
      that as the result rather than assuming it.

      **Measured, and the condition had to be reconstructed.** Chromium *is* installed
      on this machine — the M0 spike's `playwright install chromium` put it there on
      2026-10-01 — so the "no browser" condition could not be observed by doing nothing.
      It was reproduced by pointing `PLAYWRIGHT_BROWSERS_PATH` at an empty directory,
      which is the same thing from Playwright's side: no executable findable. Under
      that condition `pnpm verify` **exited 0**, 31 files and 647 tests, `dist` emitted.

      **And the structural fact, which is the stronger half.** Every script `verify`
      names was read: `typecheck`, `lint`, `format:check`, `test`, `build`. **None can
      reach a browser** — none mentions `playwright` or `browser`. A gate that cannot
      reference a browser cannot fail for want of one, so the empty-directory run above
      confirms the chain and the chain is what establishes the property.

      **One defect this stage wrote and caught in the same stage.** `playwright.config.ts`
      set `passWithNoTests: false`, copied from `vitest.config.ts`, and `tsc` rejected
      it with `TS2769`: `passWithNoTests` is **Vitest's option and Playwright has no such
      field**. The property wanted is real and is now Playwright's default rather than a
      flag — observed, not assumed, because Playwright exits non-zero with
      `No tests found` when `testDir` matches nothing. So the flag is deleted and the
      comment records that it was wrong. **This is the second time in this repository's
      history that `tsc` caught what a green run would not have**, after the
      `SpectreError` fixture missing a `cause` at 469/469.

## 2. The suite

- [ ] 2.1 Write the fixture-backed route handler: recorded provider responses from
      `packages/providers`, and every other external origin aborted **and reported by
      name** so a page reaching somewhere unrecorded fails rather than passing quietly.
- [ ] 2.2 Prove the no-network property is real, not just configured: assert the handler
      observed the requests it intercepted, so a suite that never made a call cannot
      satisfy it vacuously.
- [ ] 2.3 Boot: the page loads in a real browser, reads real IndexedDB through
      `createBrowserStorage()`, and offers back a stored mailbox **only after the provider
      confirms it**.
- [ ] 2.4 Write: after the page stores a mailbox, read it back **through the platform's
      own API** rather than through the adapter, so the assertion is not satisfied by the
      same code that wrote it.
- [ ] 2.5 Removal, the centre of this change: after the user asks the page to forget the
      address and the page reports success, `indexedDB.databases()` SHALL NOT contain the
      database (D6).
- [ ] 2.6 Plant a store this build does not recognise, and require it gone afterwards
      (D8). This is the assertion that distinguishes `deleteDatabase` from
      `CURRENT_MAILBOX_KEY`.
- [ ] 2.7 Record, in the suite's own output, the platform it ran against **and the
      substrate it does not speak for**.

## 3. Boundary corrections

- [ ] 3.1 Widen `clientStorageApiViolations()` to exempt test files **by kind** rather
      than by the spelling `.test.tsx?`, so a `*.spec.ts` under `apps/` is the test its
      documented rule already says it is (D5).
- [ ] 3.2 Give that rule a probe planted in **every** app directory, reported by name,
      and only then a claim that it reports nothing — the shape slice 1 drove it to.
- [ ] 3.3 Extend the collection rule so every shipped **browser** spec must be matched by
      the browser suite's configured patterns, with roots taken from the directory
      contents on disk rather than a list.
- [ ] 3.4 Prove 3.3 by narrowing the browser suite's patterns and observing the
      uncovered spec named.

## 4. Falsification pass

- [ ] 4.1 Run deliberate mutations for **every** assertion added in sections 2 and 3, and
      require each to be caught **by the intended test**, with the named failure recorded.
- [ ] 4.2 Treat `nocompile`, `green`, no-op, and wrong-catch as **distinct outcomes**,
      never as passes. Record any mutation that is genuinely unfalsifiable as
      unfalsifiable rather than counting it.
- [ ] 4.3 Restore every mutated file and verify byte-identity by SHA-256, reported
      separately from the catch results.

## 5. CI

- [ ] 5.1 Add a browser job that installs Chromium and runs `pnpm test:browser`, with its
      own timeout so it cannot slow or fail the `verify` job.
- [ ] 5.2 Confirm the workflow still runs the same root commands a maintainer runs, with
      no divergent flags.

## 6. Documentation, correcting only what this change makes false

- [ ] 6.1 `AGENTS.md`: the storage-path claims. **Delete** each sentence that became
      false rather than rewording it (D7), and keep every claim that is still unverified —
      `use it externally`, the live cadence, and the fact that the suite reaches no
      network.
- [ ] 6.2 `README.md`: the same corrections, plus the verification-tiers table if it has
      one.
- [ ] 6.3 `docs/ROADMAP.md`: the Project Status block, recording what the run
      established and what it did not, with counts **measured** from a reporter rather
      than transcribed.
- [ ] 6.4 Record the verified Playwright version and the exact commands, and what each
      one proves **and does not prove**.

## 7. Gates

- [ ] 7.1 `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`,
      `pnpm verify` — all exit 0, with `pnpm test` still 647 across 31 files unless the
      boundary work changes it.
- [ ] 7.2 `pnpm test:browser` exits 0, **run**, with the result recorded.
- [ ] 7.3 `openspec validate browser-verification --type change --strict` and
      `openspec validate --specs --strict` both exit 0.

## 8. Sync and archive

- [ ] 8.1 At the sync stage, promote all three deltas by **copying** delta text into
      `openspec/specs/`, and verify agreement **byte for byte** rather than by title.
- [ ] 8.2 Archive with `--skip-specs`, since the sync stage has already promoted the
      deltas.
