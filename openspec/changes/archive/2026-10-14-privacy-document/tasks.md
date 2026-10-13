# Tasks: privacy document

## 1. Baseline — measure before writing anything

- [x] 1.1 Read the shipped tree and record, as a measurement rather than a reading: every
      `chrome.storage.local` key the adapters own, the website's IndexedDB database and store,
      the built manifest's `permissions` and `host_permissions`, each client's configured
      provider list, and every shipped surface that reaches `clearAll`. Record the digests of
      `apps/web/src/styles.css` and `apps/extension/static/manifest.json` **before** any edit,
      because `design.md` D10 predicts both byte-identical.
- [x] 1.2 Record the counts this change predicts must not move: `packages/ui` **38**,
      `apps/web` **125**, `apps/extension` **465**, `packages/storage` **86**, and
      `boundaries.test.ts` **53** — counted from a `--reporter=json` run grouped by project and
      from Playwright's own collection list, **not** read from a document.
- [x] 1.3 Record what is **verified** about attribution, from `docs/PROVIDERS.md` only, and
      record the absence as an absence. Do not resolve it.
- [x] 1.4 Record the current wording of the three surfaces that already carry a
      privacy-adjacent claim — `apps/web`'s `LIMITS`, `apps/web`'s `LocalData.tsx`, and
      `apps/extension`'s `Panel.tsx` — so the agreement check compares against what they say
      today rather than against a paraphrase written later.

## 2. The document

- [x] 2.1 Write `docs/PRIVACY.md` covering all six of M12's items, in the order the roadmap
      names them. Lead with the hostname association (`design.md` D1), because it is the record
      whose omission would make the document's existence misleading.
- [x] 2.2 Include the enumerated declarations the instrument reads — the storage records, the
      provider origins per client, and the *does not collect* list — as **declared lists**, so
      they are read as data rather than matched as prose.
- [x] 2.3 Give every *does not collect* entry a support pointer, and record in the document's
      own text that grounding is **not** completeness (`design.md` D9). The document SHALL say
      so; a limit the reader must infer is a limit the document does not have.
- [x] 2.4 State attribution in neither direction, naming both absences (`design.md` D6).
- [x] 2.5 State the removal as a two-step control over the **whole area**, and that it deletes
      this device's note of the address rather than the address.
- [x] 2.6 State the lifecycle figures as published-versus-measured, and confirm the forbidden
      sentence of `docs/ROADMAP.md` §29 appears **nowhere** in the document.
- [x] 2.7 Do **not** claim legal sufficiency and do **not** name a hosting URL
      (`design.md` D11).

## 3. The instrument

- [x] 3.1 Create `tests/architecture/privacy-disclosure.test.ts`. It is a **new file**, not more
      cases in `boundaries.test.ts`, and the reason is recorded in `design.md` D2.
- [x] 3.2 Write the **test-owned map**, not a scan (`design.md` D3). Every enumerable claim is
      compared against a constant imported from the code that owns it; no claim is matched by
      pattern. `tabs` is the standing proof that a pattern-based absence check over the manifest
      reports a false failure.
- [x] 3.3 Assert **both directions** for every enumerable claim (`design.md` D4): a record that
      exists and is not named, and a name that exists in the document and in no adapter.
- [x] 3.4 Assert the **positive control first** — that the map agrees with the shipped tree —
      before any negative assertion. A map that agrees with nothing satisfies every
      negative-only assertion in the file.
- [x] 3.5 Carry the **negative control** for the forbidden §29 sentence: plant it into a copy of
      the document and require the same reader to report it. Required, not optional.
- [x] 3.6 Carry a resolvable-pointer check for every *does not collect* entry, with the
      document itself rejected as a support.
- [x] 3.7 Assert the three surfaces' agreement — the footer sentence, `LocalData.tsx` and
      `Panel.tsx` — **from outside all three**, so a drift in any one is caught by something
      that is not that surface.
- [x] 3.8 Confirm no reader in the file matches a claim by pattern, and record that the file
      shares no reader with `boundaries.test.ts`. A tool that also checks its own work cannot
      report its own defect; the independence here is structural rather than a promise.

## 4. Wiring

- [x] 4.1 Link `docs/PRIVACY.md` from `README.md`, and revise the README's three privacy bullets
      so they do not contradict the document. **No client surface gains a link**
      (`design.md` D5), so `styles.css` stays byte-identical.
- [x] 4.2 Confirm `apps/web/src/styles.css` and `apps/extension/static/manifest.json` are
      byte-identical to their task 1.1 digests.
- [x] 4.3 Update `docs/ROADMAP.md`'s Project Status — root-owned, and the archive PR number for
      `extension-permissions-review` is filled in there by `gh pr view` (**#137**, merged
      `2b3ee7d`), never predicted. **Done by the root orchestrator at this stage**, together with
      `AGENTS.md`'s milestone block and cursor. The cursor moves to **M12's security review**,
      and the entry states plainly that **M12 is not thereby closed**: its section lists five items
      and the security review and the branding check were never among the three tracked ones.

## 5. Falsification

- [x] 5.1 Run deliberate violations **against the instrument**, not only the product: a key
      removed from the map, a key added to the map that no adapter owns, the map's package list
      narrowed, the forbidden-sentence reader made permissive, the pointer check made to accept
      the document, the per-client origin split flattened. Record each outcome.
- [x] 5.2 Record `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` counts, and
      require all of them to be **zero** for a counted result.
- [x] 5.3 Restore every mutated file and verify restoration by **SHA-256 against a digest taken
      before the mutation**, per file, and report restoration separately from catching.
- [x] 5.4 Rebuild `dist/` after restoration, and delete the instrument's working files from
      outside the repository. A measuring instrument is not a shipped file, and one left in the
      root becomes something every future `pnpm lint` has an opinion about.
- [x] 5.5 Record any mutation that did not compile, or that was a **broken mutant**, as evidence
      rather than as a caught violation. A survivor means *"the assertion did not catch this"*,
      never *"the assertion is too weak"*, until the mutant has been read and shown to be the
      thing it claims.

## 6. Gates

- [x] 6.1 `pnpm verify`, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory **verified
      empty**, and record the entry count that makes "empty" a measurement.
- [x] 6.2 `pnpm verify` at least three times. A run's own output reports no history, and this
      repository has had twelve runs of which one was red and unattributed.
- [x] 6.3 `pnpm test:browser`, repeated with a stated denominator. A run carrying **no** tier
      summary is `HARNESS-ERROR` and is not counted as a pass.
- [x] 6.4 `openspec validate privacy-document --type change --strict`, and
      `openspec validate --specs --strict`.
- [x] 6.5 Re-measure every figure in `design.md` D10 from a fresh run and report the
      comparison. **A rise in any predicted-unmoved figure is a finding about this change**,
      and is recorded as one rather than reconciled.

## 7. Records

- [x] 7.1 Record in `design.md` any decision taken during apply that the proposal did not
      anticipate, **inside the change** rather than only in a commit message.
- [x] 7.2 Record in `tasks.md` every gate run with its exit status and what it does and does not
      establish.
- [x] 7.3 Record any predicted-unmoved figure that moved, with the count it moved by and the
      cause, **correcting the prediction in place** rather than reinterpreting it.
## Verification record

**Measured 2026-10-14 on `feat/privacy-document` at `86c2296`, this working tree, one machine.
Every figure below was re-measured from a run rather than carried forward from the apply-stage
report.**

### 8. The headline: `pnpm test` was **red on the shipped tree**

The apply-stage report said the new file's 22 cases all passed on a first run. It never ran
`pnpm test`. `pnpm test` was **red**, at `boundaries.test.ts` -> *"confines provider adapters to
`packages/providers`"*, with **six** violations all naming
`tests/architecture/privacy-disclosure.test.ts` -- **three** identifier hits and **three**
`create*Adapter` pattern hits.

Cause, replicated in both directions and recorded as `design.md` **D13**: `stripComments` in the
boundary suite has **no state for a regular-expression literal**, so the backtick inside this file's
original `/[*_`]/g` opened a template string, desynchronised the reader for the rest of the file,
and caused the **doc comment naming the three adapter identifiers** to be read as code. The cause
was repaired here (`replaceAll` with string arguments puts no quote character inside a pattern), the
red gate with it, and the underlying reader defect is **recorded for the root orchestrator and not
closed**, because `boundaries.test.ts` is outside this change's write scope.

### 9. Falsification — re-run on the final tree, with a durable log

Harness self-test **5/5** before any tally was trusted. 17 arms, all mutating
`tests/architecture/privacy-disclosure.test.ts`.

| counter | value |
| --- | --- |
| `caught` | **16** |
| `wrongcatch` | **0** |
| `green` | **1** (F17, declared in advance as evidence and **not counted**) |
| `noop` | **0** |
| `nocompile` | **0** |
| `harness-error` | **0** |

**Restoration, reported separately from catching:** all 17 arms restored, verified **per file** by
SHA-256 against a digest taken **before** the mutation; **files still differing: 0**. The clean run
after restoration was green.

**F17 is the one `green`, and it was read before being recorded rather than counted as a survivor.**
It removes `removalDoneMeans` **and** updates `PANEL_REMOVAL_COPY_KEY_COUNT` to `9`. The count
guards a *silent* edit; a **deliberate** edit is a decision, and a decision is caught by nothing.
That is what `design.md` D14 says, and this arm is its measurement.

**F13 is the one arm that found a real gap.** Deleting `removalDoneMeans` from the panel list alone
left the whole file green: `expect.arrayContaining` is a **subset** assertion, the per-key loop
covered one key fewer, and the specification-relevant sentence is read from `PANEL_COPY` **by
name** -- so the check and the mutation were each individually correct and together proved nothing.
Repair: a declared count asserted **before** the loop it governs. **F16 had the same property** and
was found by reading rather than by mutation, and repaired the same way.

### 10. Gates

| gate | runs | result | what it does **not** establish |
| --- | --- | --- | --- |
| `pnpm build` | 1 | **exit 0** -- `apps/web/dist` **and** `apps/extension/dist` emitted | Nothing about behaviour; the build compiles what is there |
| `pnpm verify` | **3** | **exit 0, 0, 0** -- `Test Files 63 passed (63)`, `Tests 1250 passed (1250)`, `format:check` clean | Nothing about a live provider; nothing about a browser, by construction |
| `pnpm test:browser` | **3** | **exit 0** on all three -- `Running 40 tests` / `40 passed` and `Running 98 tests` / `98 passed` on **every** run | A green browser run is not a claim about repeatability beyond three executions; `HARNESS-ERROR` count **0** |
| `openspec validate privacy-document --type change --strict` | 1 | **`Change 'privacy-document' is valid`**, exit 0 | A static check over the artifacts. **It does not establish that the implementation matches the change** |
| `openspec validate --specs --strict` | 1 | **`Totals: 14 passed, 0 failed (14 items)`**, exit 0 | Same limit |

**The empty-browser path is a measurement, not a claim.** `PLAYWRIGHT_BROWSERS_PATH` was pointed at
`%TEMP%\opencode\none`, verified to hold **0 entries**, so "no browser installed" is counted rather
than asserted.

**No run is called a flake.** No red run of `pnpm verify` occurred on this tree, so nothing needed
that label; had one occurred it would have been recorded as **unattributed**, never as a flake.

### 11. D10's predictions, re-measured from fresh runs

| what | predicted | measured | comparison |
| --- | --- | --- | --- |
| `packages/ui` | 38 | **38** | unmoved |
| `apps/web` | 125 | **125** | unmoved -- and the load-bearing one: it is what distinguishes *"the document and the page agree"* from *"the page was edited until it matched"* |
| `apps/extension` | 465 | **465** | unmoved |
| `packages/storage` | 86, diff empty | **86**, `git diff --stat -- packages/storage` **empty** | unmoved |
| `boundaries.test.ts` | 53 | **53** | unmoved |
| `apps/web/src/styles.css` | byte-identical | `472A383D...C0FC4662` | identical to the task 1.1 digest |
| `apps/extension/static/manifest.json` | byte-identical | `313E1BC7...D52392EA3` | identical to the task 1.1 digest |
| `openspec/specs/extension-client` | 14 / 75 | **14 / 75** | unmoved |

**No predicted-unmoved figure moved, so `design.md` D10 is corrected nowhere and nothing here is
reinterpreted.** The promoted tree re-counted by heading after this work is **168 requirements and
545 scenarios across 14 capabilities**, which is also unmoved -- **required**, because the delta is
one `ADDED` section in a **new** capability (`privacy-disclosure`, 8 requirements / 19 scenarios) and
modifies nothing. Promotion is the sync stage's business, not this one's.

**The total `pnpm test` figure is 1250 across 63 files, of which `privacy-disclosure.test.ts` is 22
and `boundaries.test.ts` is 53.** Every per-project count came from a `--reporter=json` run grouped
by project, never read off a summary line and never transcribed from a document.

### 12. Two limits recorded rather than fixed

- **`tests/architecture/` has no `tsconfig.json`**, so neither `boundaries.test.ts` nor this change's
  instrument is covered by `pnpm typecheck`. This is the repository's own recorded fact and it is
  **not repaired here** -- adding one is a root-orchestrator decision that would move the typecheck
  scope of every future gate.
- **`stripComments` still cannot read a regex literal** (`design.md` D13). The cause is removed from
  this file; the capability is not added to that one, because that file is out of this change's write
  scope. **A future file that puts a backtick inside a regex literal will take a green gate red with
  a cause that reads as correct.**