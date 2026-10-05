# Tasks

## 0. The repair this change now carries (D9, D10)

- [x] 0.1 Replace the per-invocation unmount guard in `apps/web/src/useMailboxSession.ts`'s
      save effect with a **mounted ref**: a `useRef(true)` cleared by an effect that runs
      once on mount and cleans up once on unmount. **Leave `handed.current` exactly as it
      is** — it is claimed before the write is awaited, and it is what prevents the
      duplicate write its own comment documents.
- [x] 0.2 Write the **unit regression test that holds the window open**, which is the part
      jsdom could not represent: a storage whose `saveMailbox` does not resolve until the
      test says so, an inbox transition published while the write is in flight, and then
      the release. The assertion is that the page reports holding the address afterwards.

      **The window is a `saveMailbox` that will not resolve until the test releases it**,
      so the write cannot finish before the transition can arrive. A storage that resolved
      on its own — which is what every existing test in this file injects — is what made
      the bug invisible, and 112 of them passed on a page whose removal control could not
      be reached. This is not a gap that more of the same tests would have closed; the
      substrate had to change.
- [x] 0.3 Prove 0.2 can fail: mutate the guard back to the per-invocation flag and require
      the intended test to go red. A regression test never observed failing is not one.

      **Measured as M8, and the summary is the interesting part: `1 failed | 112 passed`.**
      Reverting the guard fails **exactly one** test — the new one — and leaves the other
      112 green. That is the defect's signature stated as a number: this was never a
      coverage gap that a stricter assertion would have caught, it was a substrate that
      could not represent the failure. It also means the new test is not redundant with
      any existing one, which a passing test alone cannot tell you.
- [x] 0.4 Prove the browser tier's removal specs can fail for the **same reason** — revert
      0.1 in the built site and require the removal spec to go red naming the missing
      control. Without this, the browser tier is not yet known to cover this defect and its
      passing would be uninformative.
- [x] 0.5 Delete `apps/web/e2e/zz-diagnostic.spec.ts`, keeping its **verbatim measurement**
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

- [x] 2.1 Write the fixture-backed route handler: recorded provider responses from
      `packages/providers`, and every other external origin aborted **and reported by
      name** so a page reaching somewhere unrecorded fails rather than passing quietly.
- [x] 2.2 Prove the no-network property is real, not just configured: assert the handler
      observed the requests it intercepted, so a suite that never made a call cannot
      satisfy it vacuously.
- [x] 2.3 Boot: the page loads in a real browser, reads real IndexedDB through
      `createBrowserStorage()`, and offers back a stored mailbox **only after the provider
      confirms it**.
- [x] 2.4 Write: after the page stores a mailbox, read it back **through the platform's
      own API** rather than through the adapter, so the assertion is not satisfied by the
      same code that wrote it.
- [x] 2.5 Removal, the centre of this change: after the user asks the page to forget the
      address and the page reports success, `indexedDB.databases()` SHALL NOT contain the
      database (D6).
- [x] 2.6 Plant a store this build does not recognise, and require it gone afterwards
      (D8). This is the assertion that distinguishes `deleteDatabase` from
      `CURRENT_MAILBOX_KEY`.
- [x] 2.7 Record, in the suite's own output, the platform it ran against **and the
      substrate it does not speak for**.

      **6 specs, all passing, measured.** Chromium is the only engine configured, so
      every claim this tier makes is about what *Chromium* does with IndexedDB. It says
      nothing about Firefox or WebKit, whose IndexedDB implementations are separate code.
      The tier records that limit in its own output rather than leaving it to this file.

      **2.1 and 2.2 together establish a property this repository has never had before:
      the browser tier reaches no network.** Recorded responses come from
      `packages/providers` **imported by name**, never restated, so a fixture cannot
      drift from the adapter's own — and the provider-field-name boundary rule scans
      `apps/` with **no test exemption**, which this change predicted (D7) and which did
      in fact collide.

      **2.4's read-back goes through the platform's own `indexedDB` API**, not through
      the adapter. A read through the code that wrote it would verify that a write
      happened, not that the platform retained it — which is the entire question, given
      that `fake-indexeddb` and Chromium are separate implementations.

## 3. Boundary corrections

- [x] 3.1 Widen `clientStorageApiViolations()` to exempt test files **by kind** rather
      than by the spelling `.test.tsx?`, so a `*.spec.ts` under `apps/` is the test its
      documented rule already says it is (D5).
- [x] 3.2 Give that rule a probe planted in **every** app directory, reported by name,
      and only then a claim that it reports nothing — the shape slice 1 drove it to.
- [x] 3.3 Extend the collection rule so every shipped **browser** spec must be matched by
      the browser suite's configured patterns, with roots taken from the directory
      contents on disk rather than a list.
- [x] 3.4 Prove 3.3 by narrowing the browser suite's patterns and observing the
      uncovered spec named. **Both narrowing forms are exercised, because they fail for
      different reasons** — an empty `testDir` leaves the directory claim unmatched, a
      `testMatch` matching nothing leaves the pattern claim unmatched — and a rule that
      handled only one would have been checked against the mutation its author tried
      first.

      #### One defect 3.3 shipped with and caught in the same stage

      **The parser compiled the regex literal's delimiters as pattern text.** The
      `testMatch` capture is a literal — `/…/flags` — and handing it straight to
      `new RegExp` makes the slashes characters to match, so the compiled pattern
      requires a literal `/` immediately after its own end anchor and is therefore
      **unsatisfiable**. Measured, not reasoned about: the first version reported
      `apps/web/e2e/storage.spec.ts (no browser suite collects it)` for a suite that
      collects it.

      **Why this one is worth more than an ordinary bug:** the failure presented as a
      *real coverage gap*, not as a broken parser. A rule that is wrong in the direction
      of reporting more than is true is the dangerous direction — it cries wolf, and the
      natural response to a crying wolf is to delete the rule. A greedy `.*` capture, the
      obvious alternative spelling, is wrong in the same direction for a different reason:
      it runs past the literal and latches onto a `/` inside a later comment. So the
      capture is **anchored to one line**, which is not a style preference — a regex
      literal cannot span one — and the comment says so.

      **And the unparseable-configuration case is deliberately a report, not a skip.** A
      config the rule cannot read is returned as *a suite that collects nothing*, so every
      spec is named. Skipping it would make the rule pass in exactly the case where it has
      stopped working — the shape this file has been wrong in four separate times.

## 4. Falsification pass

- [x] 4.1 Run deliberate mutations for **every** assertion added in sections 2 and 3, and
      require each to be caught **by the intended test**, with the named failure recorded.
- [x] 4.2 Treat `nocompile`, `green`, no-op, and wrong-catch as **distinct outcomes**,
      never as passes. Record any mutation that is genuinely unfalsifiable as
      unfalsifiable rather than counting it.
- [x] 4.3 Restore every mutated file and verify byte-identity by SHA-256, reported
      separately from the catch results.

      **8 of 8 mutations caught by the intended assertion.** Every restore byte-identical,
      SHA-256 verified, and reported separately from the catch result — because a restore
      that silently failed would make every later mutation suspect.

      | # | Mutation | Tier | Outcome | Caught by | Restore |
      |---|---|---|---|---|---|
      | M1 | Revert 0.1's guard to per-invocation scope (the original defect) | browser | `caught` | 3 removal specs red | byte-identical |
      | M8 | The same revert, **unit tier only** | unit | `caught` | `still knows it stored the mailbox when a listing lands mid-write`, and **only** it: `1 failed / 112 passed` | byte-identical |
      | M2 | Narrow `isTestFile` back to `.test.tsx?` | unit | `caught` | `keeps storage, cookies, and the URL out of every client` | byte-identical |
      | M3 | Over-widen `isTestFile` to `return true` | unit | `caught` | that test **and** `catches a platform store or the URL in a client…` | byte-identical |
      | M4 | Clear only `CURRENT_MAILBOX_KEY` instead of deleting the database (D8's alternative) | **both** | `caught` | 8 unit tests (`fake-indexeddb`) **and** 2 browser specs | byte-identical |
      | M5 | Narrow `playwright.config.ts`'s `testDir` to `./__narrowed__` | unit | `caught` | `collects every browser spec, and never as a unit test` | byte-identical |
      | M6 | Narrow `testMatch` to `/.*\.__narrowed__\.ts$/` | unit | `caught` | same | byte-identical |
      | M7 | Add `apps/*/e2e/**/*.spec.ts` to Vitest's `include` | unit | `caught` | same, **by the unit-side assertion** | byte-identical |

      **M1 and M8 are the same revert run against two tiers, and both are here because
      they answer different questions.** M1 asks whether the browser tier covers this
      defect at all, without which its passing would be uninformative. M8 asks whether a
      fix can be pinned by a test needing no browser, which is what lets the next
      contributor catch a regression in seconds instead of minutes. Neither implies the
      other.

      **M7 is attributed to the unit-side assertion by name, not inferred from the test
      title.** Both halves of that requirement live in one test, so a title match would not
      say which fired. Re-run in isolation, the failure message is
      `a browser spec must not be collected as a unit test: expected [ 'apps/web/e2e/storage.spec.ts' ] to deeply equal []`.
      **The expected side effect was deliberately not filtered out of the record:** adding
      that Vitest glob also makes Vitest *collect* the spec, and `@playwright/test` throws
      at import time outside a Playwright runner. That error is collateral evidence of the
      same defect.

      ### Two harness defects this pass found, both recorded because both produced a
      ### false green

      **`pnpm.cmd` cannot be spawned from Node on this machine** (`EINVAL spawnSync`). The
      first harness version invoked `pnpm` anyway. It produced empty output, and the
      outcome logic read "no failing titles" as **green** — reporting mutations as uncaught
      when nothing had run. This is the M5 slice 4 trap again, in a different coat: a run
      that broke collection was read as a check that did not catch anything. Fixed by
      invoking `node` directly, and — the part that matters — by adding
      **`harness-error`**: an output with neither a passed nor a failed count is now
      reported as "the check produced no result — NOT a pass and NOT a green run". A check
      that did not run is not a check that passed.

      **M4's first version was a behavioural no-op.** It read `globalThis.__keyOnly`,
      which nothing ever sets, so `deleteDatabase` still ran and the suite stayed green.
      That is a mutation that changed nothing reported as a check that did not catch
      anything — **the same conflation, and the reason `no-op` is a distinct outcome
      rather than a note.** The replacement genuinely clears the one record and leaves the
      database, which is the alternative `design.md` D8 names.

      ### One measurement this pass produced that is worth more than the catch

      **M4 was caught by both tiers independently.** The question the browser tier exists
      to answer — *does a real browser agree with `fake-indexeddb` about whether removing
      "one key" also removes "everything the record kind does not recognise"?* — now has
      an answer for this behaviour: **the substitute agreed with the platform.** That is a
      positive result for `fake-indexeddb` on this point and it does **not** generalise.
      It says nothing about the blocked-`deleteDatabase` semantics recorded in
      `packages/storage`, which remain a `fake-indexeddb` measurement and not a browser
      measurement, and nothing about any other behaviour the fake might not share.

      ### Unfalsifiable, recorded rather than counted

      **The suite's no-network property is a property of its handler, not of a mutation
      target.** Aborting every unrecorded origin cannot be mutated into passing while the
      page still works, because a page reaching an unrecorded origin *is* the failure. The
      load-bearing assertion is the positive control — that the handler observed the
      requests it intercepted — so a suite that made no call at all cannot satisfy it
      vacuously. There is no mutation that distinguishes "the page made no request" from
      "the handler works", because the former is the absence of the thing being verified.
      It is not counted as coverage, and the absence is a fact about the property rather
      than a gap in the suite.

## 5. CI

- [x] 5.1 Add a browser job that installs Chromium and runs `pnpm test:browser`, with its
      own timeout so it cannot slow or fail the `verify` job.
- [x] 5.2 Confirm the workflow still runs the same root commands a maintainer runs, with
      no divergent flags.

      **The job is a sibling of `verify`, not a stage after it**, so its 20-minute budget
      is its own and cannot consume `verify`'s 15. Its only command is
      `pnpm test:browser`, the same command a maintainer runs; `--with-deps` on the
      Chromium install is OS library provisioning and asserts nothing.

      **The comment records what this job does not establish, in the file a reader reaches
      for when a run goes red or green:** a live provider, `use it externally`, and how a
      real provider responds to being polled every five seconds all remain unverified. A
      CI job whose name reads `browser` invites the opposite assumption, and the suite's
      own no-network assertion is the correction — it is checked, so the limit is measured
      rather than asserted in prose.

      **This job did not work on its first run, and what happened is recorded rather
      than smoothed over.** It **failed at 20m19s**, killed by its own timeout, and the
      only line it produced was `The operation was canceled.` — 19m35s inside
      `pnpm test:browser`, with **no output at all**.

      #### The CI hang, diagnosed: five runs, two wrong theories, and the cause

**This is the longest debugging record in the change and it is kept whole, because
every wrong turn was reasonable and each was killed by a measurement rather than by
argument.**

##### What the symptom was

Five runs of the `browser` job printed `Running 6 tests using 1 worker` and then produced
nothing useful for 19m35s, 29m34s, and more. Five runs, and **the tests were never the
problem.**

##### Wrong theory 1 — the budget

Raising the job ceiling 20 → 30 was expected to let the step fail on its own terms and
name itself. It did not: the second run was silent for **29m34s**. **The second silence
being _longer_ refutes the budget hypothesis by measurement** — a hang that scales with
the budget given it is indefinite, not slow. Twenty minutes spent pushing a bigger number
at it.

##### Wrong theory 2 — Chromium could not launch

The per-step ceilings (5 for the install, **measured at 24 seconds**; 10 for the suite,
with the job's 25 as a backstop) made the job name itself. Two repairs followed:

- **A direct launch probe on the runner itself.** Chromium **started in 250ms**,
  evaluated JavaScript, and exited 0. `/dev/shm` there is **7.9G**.
- So `--disable-dev-shm-usage` and `--no-sandbox` were added, described at the time as
  "a hypothesis with a measurement behind it, not a confirmed diagnosis."

**That hypothesis was refuted by the next run: the same symptom, unchanged.** Both flags
have since been **removed**, and `--no-sandbox` in particular is a sandboxing boundary
this repository forbids weakening without an explicit requirement. Flags added for a
cause that turned out not to exist are still flags, and a conditional-looking repair that
was never conditional would have left every future run of the tier with an unsandboxed
browser.

##### The measure that broke it, and it was not the tests

Running the suite with **`--reporter=list`** made the hang report itself. Two lines in
one log, and together they are the whole finding:

```text
✓  6 [chromium] › e2e/storage.spec.ts:268:3 › the page still works after the removal… (205ms)
##[error]The action 'Diagnose suite hang' has timed out after 8 minutes.
```

**All 6 specs passed in 2.6 seconds, and then nothing — no `6 passed` summary line ever
printed.** And the following step failed with:

```text
Error: http://127.0.0.1:4173/ is already used, make sure that nothing is running on the
port/url or set reuseExistingServer:true in config.webServer.
```

**So the tests were never the problem, and the missing summary was never evidence about
them.** Playwright hangs shutting the **webServer** down. `pnpm preview` spawns `vite`
as a *child of pnpm*, so killing the process Playwright spawned kills the wrapper and
**orphans the real server**, which goes on holding both the inherited stdout pipe and
port 4173 — the second symptom above, which is what finally named the mechanism.

**The repair is to invoke `vite` directly** (`node node_modules/vite/bin/vite.js
preview …`), so **Playwright owns the process it started** and there is no wrapper whose
death could orphan anything.

#### Two method lessons, recorded because each cost a full cycle

**A missing summary line is not evidence until the reporter is ruled out.** With
`CI=true` Playwright selects the **dot** reporter, which prints progress **without
newlines**; the step was killed, and **a kill discards buffered output**. So four runs of
"no test output" were **the reporter, not the hang** — and this file read that absence as
a finding, then built a browser-launch theory on it. The suite carried a 60s per-test
timeout that *should* have printed a failure; it was buffered and lost with everything
else. **Line-oriented output was what turned the hang into evidence.**

**A diagnostic must be able to fail for the reason it exists.** The first version of the
diagnostic step ran *before* the build and died in two seconds on
`The directory "dist" does not exist. Did you build your project?` — a failure of its own
premises, costing an 11-minute cycle and saying nothing about the hang. It now builds
first, and the step is deleted entirely now that the cause is known.

**Local cost of the fix: none, and it was measured.** `pnpm test:browser` — the
maintainer's command, no flags — exits 0 in **7s wall** with `6 passed (4.0s)`. The
`webServer` change is confined to how the preview server is spawned and alters no
assertion.

##### Confirmed in CI

**The `browser` job passes: `6 passed (3.9s)`, whole job green in 58 seconds.** That is
the first green run after five hangs, and it is the confirmation the fix predicted — the
`6 passed` summary line is now printed, which is the exact line whose absence exposed
the cause.

##### A separate failure that is NOT this change, and how it was told apart

`spike self-test` was cancelled on four runs. That job is **untouched by this change** —
no browser, no Playwright, no `apps/web` code, and it takes **26 seconds** when it runs.
It was still investigated rather than dismissed, because a red check on a PR is a red
check.

**The API is what distinguishes it, and the signature is unambiguous.** Every one of those
runs reports **`runner_name: ""` and `steps: 0`**, and the run's log archive is a
**22-byte empty zip**. A job that starts and then hangs uploads *partial* logs and
records its steps; one that **never received a runner** has neither. One rerun waited
**1215 seconds** in queue before its own `timeout-minutes: 10` expired — which is
precisely where the repeated **15m0s** duration comes from, and which is why the job
"takes" 15 minutes while doing nothing at all.

**This is GitHub-hosted runner capacity being exhausted, not a defect in anything under
test**, and no edit to this repository can fix it. It is recorded rather than left
unexplained because **a job reporting `cancelled` with no logs is indistinguishable from
a hang unless you read the job JSON** — and this change had already spent five runs
building a theory out of missing output.

## 6. Documentation, correcting only what this change makes false

- [x] 6.1 `AGENTS.md`: the storage-path claims. **Delete** each sentence that became
      false rather than rewording it (D7), and keep every claim that is still unverified —
      `use it externally`, the live cadence, and the fact that the suite reaches no
      network.

      **Four deletions, each with the sentence it removed named beside it**, because a
      deletion a reader cannot trace looks like an oversight. The removed claims were:
      *`createBrowserStorage()` is never executed by any test in the workspace*; *the real
      storage path has been exercised by no test at all*; *the sequence a user's browser
      actually takes has never run anywhere in this repository*; and *a privacy control
      verified only against a fake is the claim in this repository least entitled to
      confidence*. **The last of those was the most important sentence the document held
      about its own work**, and its removal is the point of the change rather than a loss
      of caution — which is why the deletion records that rather than just performing it.

      **Three claims were kept, and each one is still true.** No stored mailbox has ever
      been reconciled against a **live** Guerrilla Mail session. The blocked-
      `deleteDatabase` semantics remain a `fake-indexeddb` measurement, because the
      browser suite does not produce that event. And `pnpm verify` runs with no browser
      installed — measured with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory.
      The one behaviour the two substrates were shown to **agree** on is recorded as a fact
      about that behaviour, with an explicit line that it is not a licence for the fake.
- [x] 6.2 `README.md`: the same corrections, plus the verification-tiers table if it has
      one.

      **The tier table was already stale before this change and said so in the
      correction.** It read 545 tests across 26 files with 42 boundary assertions — figures
      from two milestones earlier, in the document whose whole job is to state what is
      verified. That is the **third** time a count in this repository has been found
      unmeasured rather than wrong, and the correction now says that a number nobody
      re-ran is a number nobody checked. The table gained a `pnpm test:browser` row, and
      `pnpm verify`'s row now carries the measured no-browser condition rather than
      implying it.
- [x] 6.3 `docs/ROADMAP.md`: the Project Status block, recording what the run
      established and what it did not, with counts **measured** from a reporter rather
      than transcribed.

      **The cursor now names `browser-verification` as applied and moves the "next
      eligible objective" text into a block headed by what the run actually found**, with
      the still-unverified list attached to it. Three separate places in this file said a
      real browser run would close three claims; **two of those three did not close**,
      because the tier is offline by design, and each of those places is corrected rather
      than left to look forward to a closure that was never coming.

      **Counts, measured:** 649 tests / 31 files / **47** boundary assertions; `apps/web`
      113; `packages/storage` 44. The **6 browser specs are excluded from the 649 on
      purpose** and the document says why — adding them would misreport what
      `pnpm test` covers. The pre-`browser-verification` figures are marked
      **superseded rather than deleted**, because "647" was true and a reader comparing
      two documents needs to know which of the two numbers is current.
- [x] 6.4 Record the verified Playwright version and the exact commands, and what each
      one proves **and does not prove**.

      **Playwright `1.63.0`**, verified on `Windows 11 / Node.js v26.10.0 / pnpm 12.6.0`
      on 2026-10-06. `AGENTS.md` gains a `Verified project tool: the browser tier` entry
      carrying `pnpm test:browser`, the Chromium-only scope, the `vite preview` origin, and
      a **what-it-does-not-establish list of five items** — recorded there because a CI job
      whose name reads `browser` invites the opposite assumption, and the suite's own
      no-network assertion is the correction rather than prose.

      **The Chromium install command is recorded with its reason for being
      `--dir apps/web`**: pnpm does not put a workspace member's binaries on the root's
      `PATH`, and that is the kind of detail a reader otherwise rediscovers by failing.

## 7. Gates

- [x] 7.1 `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`,
      `pnpm verify` — all exit 0, with `pnpm test` still 647 across 31 files unless the
      boundary work changes it.

      **649 across 31 files, not 647** — the boundary work changed it, by exactly the one
      assertion the new rule adds. `pnpm verify` exited **0** and was run with
      `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, so the "no browser
      required" property is re-measured after the change rather than inherited from
      before it.
- [x] 7.2 `pnpm test:browser` exits 0, **run**, with the result recorded.

      **6 passed, exit 0.** Roughly 3.3s warm, ~3.1m cold.
- [x] 7.3 `openspec validate browser-verification --type change --strict` and
      `openspec validate --specs --strict` both exit 0.

      `Change 'browser-verification' is valid`; specs **9 passed, 0 failed**. The delta
      carries **11 requirements and 29 scenarios** across four capabilities —
      `browser-verification` 5/12, `build-and-verification` 3/7, `spectre-storage` 1/3,
      `website-client` 2/7 — counted mechanically for task 8.1's byte-level comparison
      rather than transcribed. `openspec status --change` reports **4/4 artifacts
      complete**.

## 8. Sync and archive

- [ ] 8.1 At the sync stage, promote all three deltas by **copying** delta text into
      `openspec/specs/`, and verify agreement **byte for byte** rather than by title.
- [ ] 8.2 Archive with `--skip-specs`, since the sync stage has already promoted the
      deltas.
