# Tasks

## 1. Dependencies and configuration

- [ ] 1.1 Add Playwright as a pinned dev dependency of `apps/web`, matching the version
      the spike already uses, and add the `pnpm-workspace.yaml` note recording that this
      is the first workspace dependency needing a browser download. Do **not** add
      `tests/provider-spike` to `packages:`.
- [ ] 1.2 Add `test:browser` to the root `package.json`, running the browser suite
      against the built site. **It is not added to `verify`** (D3).
- [ ] 1.3 Add `playwright.config.ts` with the preview-server base URL and the spec
      patterns, and gitignore Playwright's artefacts.
- [ ] 1.4 Verify `pnpm verify` still exits 0 **with no browser installed**, and record
      that as the result rather than assuming it.

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
