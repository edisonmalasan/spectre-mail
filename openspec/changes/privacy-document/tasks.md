# Tasks: privacy document

## 1. Baseline — measure before writing anything

- [ ] 1.1 Read the shipped tree and record, as a measurement rather than a reading: every
      `chrome.storage.local` key the adapters own, the website's IndexedDB database and store,
      the built manifest's `permissions` and `host_permissions`, each client's configured
      provider list, and every shipped surface that reaches `clearAll`. Record the digests of
      `apps/web/src/styles.css` and `apps/extension/static/manifest.json` **before** any edit,
      because `design.md` D10 predicts both byte-identical.
- [ ] 1.2 Record the counts this change predicts must not move: `packages/ui` **38**,
      `apps/web` **125**, `apps/extension` **465**, `packages/storage` **86**, and
      `boundaries.test.ts` **53** — counted from a `--reporter=json` run grouped by project and
      from Playwright's own collection list, **not** read from a document.
- [ ] 1.3 Record what is **verified** about attribution, from `docs/PROVIDERS.md` only, and
      record the absence as an absence. Do not resolve it.
- [ ] 1.4 Record the current wording of the three surfaces that already carry a
      privacy-adjacent claim — `apps/web`'s `LIMITS`, `apps/web`'s `LocalData.tsx`, and
      `apps/extension`'s `Panel.tsx` — so the agreement check compares against what they say
      today rather than against a paraphrase written later.

## 2. The document

- [ ] 2.1 Write `docs/PRIVACY.md` covering all six of M12's items, in the order the roadmap
      names them. Lead with the hostname association (`design.md` D1), because it is the record
      whose omission would make the document's existence misleading.
- [ ] 2.2 Include the enumerated declarations the instrument reads — the storage records, the
      provider origins per client, and the *does not collect* list — as **declared lists**, so
      they are read as data rather than matched as prose.
- [ ] 2.3 Give every *does not collect* entry a support pointer, and record in the document's
      own text that grounding is **not** completeness (`design.md` D9). The document SHALL say
      so; a limit the reader must infer is a limit the document does not have.
- [ ] 2.4 State attribution in neither direction, naming both absences (`design.md` D6).
- [ ] 2.5 State the removal as a two-step control over the **whole area**, and that it deletes
      this device's note of the address rather than the address.
- [ ] 2.6 State the lifecycle figures as published-versus-measured, and confirm the forbidden
      sentence of `docs/ROADMAP.md` §29 appears **nowhere** in the document.
- [ ] 2.7 Do **not** claim legal sufficiency and do **not** name a hosting URL
      (`design.md` D11).

## 3. The instrument

- [ ] 3.1 Create `tests/architecture/privacy-disclosure.test.ts`. It is a **new file**, not more
      cases in `boundaries.test.ts`, and the reason is recorded in `design.md` D2.
- [ ] 3.2 Write the **test-owned map**, not a scan (`design.md` D3). Every enumerable claim is
      compared against a constant imported from the code that owns it; no claim is matched by
      pattern. `tabs` is the standing proof that a pattern-based absence check over the manifest
      reports a false failure.
- [ ] 3.3 Assert **both directions** for every enumerable claim (`design.md` D4): a record that
      exists and is not named, and a name that exists in the document and in no adapter.
- [ ] 3.4 Assert the **positive control first** — that the map agrees with the shipped tree —
      before any negative assertion. A map that agrees with nothing satisfies every
      negative-only assertion in the file.
- [ ] 3.5 Carry the **negative control** for the forbidden §29 sentence: plant it into a copy of
      the document and require the same reader to report it. Required, not optional.
- [ ] 3.6 Carry a resolvable-pointer check for every *does not collect* entry, with the
      document itself rejected as a support.
- [ ] 3.7 Assert the three surfaces' agreement — the footer sentence, `LocalData.tsx` and
      `Panel.tsx` — **from outside all three**, so a drift in any one is caught by something
      that is not that surface.
- [ ] 3.8 Confirm no reader in the file matches a claim by pattern, and record that the file
      shares no reader with `boundaries.test.ts`. A tool that also checks its own work cannot
      report its own defect; the independence here is structural rather than a promise.

## 4. Wiring

- [ ] 4.1 Link `docs/PRIVACY.md` from `README.md`, and revise the README's three privacy bullets
      so they do not contradict the document. **No client surface gains a link**
      (`design.md` D5), so `styles.css` stays byte-identical.
- [ ] 4.2 Confirm `apps/web/src/styles.css` and `apps/extension/static/manifest.json` are
      byte-identical to their task 1.1 digests.
- [ ] 4.3 Update `docs/ROADMAP.md`'s Project Status — root-owned, and the archive PR number for
      `extension-permissions-review` is filled in there by `gh pr view` (**#137**, merged
      `2b3ee7d`), never predicted.

## 5. Falsification

- [ ] 5.1 Run deliberate violations **against the instrument**, not only the product: a key
      removed from the map, a key added to the map that no adapter owns, the map's package list
      narrowed, the forbidden-sentence reader made permissive, the pointer check made to accept
      the document, the per-client origin split flattened. Record each outcome.
- [ ] 5.2 Record `wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` counts, and
      require all of them to be **zero** for a counted result.
- [ ] 5.3 Restore every mutated file and verify restoration by **SHA-256 against a digest taken
      before the mutation**, per file, and report restoration separately from catching.
- [ ] 5.4 Rebuild `dist/` after restoration, and delete the instrument's working files from
      outside the repository. A measuring instrument is not a shipped file, and one left in the
      root becomes something every future `pnpm lint` has an opinion about.
- [ ] 5.5 Record any mutation that did not compile, or that was a **broken mutant**, as evidence
      rather than as a caught violation. A survivor means *"the assertion did not catch this"*,
      never *"the assertion is too weak"*, until the mutant has been read and shown to be the
      thing it claims.

## 6. Gates

- [ ] 6.1 `pnpm verify`, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory **verified
      empty**, and record the entry count that makes "empty" a measurement.
- [ ] 6.2 `pnpm verify` at least three times. A run's own output reports no history, and this
      repository has had twelve runs of which one was red and unattributed.
- [ ] 6.3 `pnpm test:browser`, repeated with a stated denominator. A run carrying **no** tier
      summary is `HARNESS-ERROR` and is not counted as a pass.
- [ ] 6.4 `openspec validate privacy-document --type change --strict`, and
      `openspec validate --specs --strict`.
- [ ] 6.5 Re-measure every figure in `design.md` D10 from a fresh run and report the
      comparison. **A rise in any predicted-unmoved figure is a finding about this change**,
      and is recorded as one rather than reconciled.

## 7. Records

- [ ] 7.1 Record in `design.md` any decision taken during apply that the proposal did not
      anticipate, **inside the change** rather than only in a commit message.
- [ ] 7.2 Record in `tasks.md` every gate run with its exit status and what it does and does not
      establish.
- [ ] 7.3 Record any predicted-unmoved figure that moved, with the count it moved by and the
      cause, **correcting the prediction in place** rather than reinterpreting it.