# Tasks

## 1. The two missing cells

- [ ] 1.1 **Add the two variant fragments, and only those two.**
      `apps/extension/e2e/fixtures/side-panel-probe/variants/permission-only.json` —
      `"permissions": ["sidePanel", "storage"], "side_panel": null`.
      `variants/key-only.json` — `"permissions": ["storage"]`.
      **Each differs from `base` in exactly one entry, and each carries the `_comment`
      annotation its two siblings carry**, because a fragment whose comment describes a
      different merge rule is worse than no comment. `permissions` is replaced wholesale
      and `null` deletes, so neither fragment can accumulate an entry the base lacked.

- [ ] 1.2 **Add both names to `VARIANTS`, and nothing else in the driver's control flow.**
      `apps/extension/e2e/side-panel-runtime.mjs` line 101. **`base` is the identity and has
      no fragment file** — reading `variants/base.json` is what turned the base arm into a
      crash rather than a reading on this probe's first run. Both new names therefore need
      files.

- [ ] 1.3 **Record the four cells as a table, not as prose about a comparison.**
      `docs/PROVIDERS.md` §4.6's first row currently reads as a single yes/no. **Replace it
      with the two-by-two**, because a row that says "the permission is one of the two and
      cannot be separated on them" is what four documents have carried forward.

- [ ] 1.4 **State in the same table that `control` differs from `base` in two entries.**
      §4.6 already says so once, in prose. **A four-cell table read as four controlled pairs
      would be a new false claim created by the correction**, and the correction must not
      introduce the defect it is correcting.

## 2. The verdict, and the two recorded defects of the instrument that produces it

- [ ] 2.1 **A cell that reports nothing is counted as *not observed*, never as *absent*.**
      §4.6 records a verdict that *"survived a total measurement failure"*: it was read
      from the API-presence stage, a different fixture load from the arms, so an arms stage
      that failed completely left the verdict positive. **Both new cells are API-presence
      cells, which is the stage that carries the defect.**

- [ ] 2.2 **`answerable` is `false` whenever any of the four cells failed to report, and the
      run exits non-zero.** The shape `side-panel-runtime-facts` D6 established. **A verdict
      computed from a subset of its own cells is decoration.**

- [ ] 2.3 **Record the rate, not a fix.** §4.6 records one run in six failing to dock the
      panel, cause undiagnosed. **A repeatability figure without a cause is a number rather
      than a finding**, so this task records what was measured and claims nothing about the
      cause. Run the probe **at least three times** and report the tally with its
      denominator; **a run whose output carries no cell report is `HARNESS-ERROR`, not a
      green.**

- [ ] 2.4 **Keep every run's log.** One red discarded is this repository's most repeated
      defect. If any cell fails to report, the log is retained and the failure is recorded
      **rather than reconciled away by re-running**.

## 3. The conditional branch, both directions, written down before the answer is known

- [ ] 3.1 **If the cells show the key alone does not work without the permission:** keep the
      entry, and write the outcome sentence into the **change's delta** as a recorded
      apply-stage amendment naming the four cells. `manifest.json` is **unchanged**.

- [ ] 3.2 **If the cells show the key works without the permission:** remove `"sidePanel"`
      from `apps/extension/static/manifest.json` and from the expected list at
      `apps/extension/e2e/manifest.spec.ts:246`, and write **both** directions into the
      delta — the removal, and a scenario forbidding the shape from returning. **The
      product manifest changes in this direction and only this one**, so the diff is
      reviewable as a two-line change against a one-hundred-line amendment.

- [ ] 3.3 **Either way, the amendment paragraph already in the delta stands unchanged.**
      Its claim is about what *was* measured before this change, and this change does not
      retroactively alter that. **Editing it to agree with the new answer would make the
      record say the correction was obvious in hindsight.**

## 4. The instrument, which is the part that outlives the change

- [ ] 4.1 **Add a test-owned permission map to `manifest.spec.ts`.**
      `permission → the \`chrome.<name>\` call that reaches it, or the manifest key that earns
      it`. **It lives in the test file and nowhere else** — this repository has recorded twice
      that a rule a comment can satisfy is not a rule, and the failure it names is a module
      that only *describes* the coupling it lacks.

- [ ] 4.2 **Assert it in both directions, and the second direction is the one that does not
      exist today.** `manifest.spec.ts` already fails when a permission is *added*
      (`toEqual` on the whole list). **What nothing catches is a permission added with
      nothing behind it**, so the new case scans shipped `apps/extension/src` for
      `chrome.<permission>` and requires every declared permission to be justified by a call
      **or** by a manifest key the map names.

- [ ] 4.3 **Read the shipped sources, not a list, and strip comments first.**
      The finding this change is built on is that the one occurrence of `sidePanel` in
      `apps/extension/src` is **inside a doc comment**. A scan that does not strip comments
      would report that as a justification. **Stripping comments is what makes this case
      falsifiable** — and it is the same repair `M5 slice 1` made to a rule that was firing on
      its own documentation, except that here the comment would have silenced the rule
      rather than tripped it.

- [ ] 4.4 **The four counts this change turns on must not move.**
      `packages/ui` **38**, `packages/storage` **86**, `apps/web` **125**, and the
      architecture boundary count **53**. **No boundary rule is added** — `manifest.spec.ts`
      already owns half this property, and *a rule added where an instrument already exists
      is not coverage*. **A rise in the boundary count is a declared failure of this change**,
      not a coverage improvement.

## 5. Falsification

- [ ] 5.1 **Mutate each new fragment to declare what its cell must not declare, and the cell
      must move.** `permission-only.json` given a `side_panel` key, and `key-only.json` given
      the permission. **A cell that does not move when its own staged manifest changes is
      measuring nothing**, and that is the failure the recorded first run of this probe
      already made once — `sidepanel.html` had no `<script>`, so every dependent arm
      reported nothing while `open()` resolved and the launcher printed *opened*.

- [ ] 5.2 **The positive control must be a cell that *did* report.** Without one, an
      instrument that reports nothing passes as "the API was absent".

- [ ] 5.3 **The mapping's case fails two-sidedly, and a control survives.**
      A probe permission in the manifest with no map entry **and** no call → reported by
      name. The same permission with a shipped `chrome.<name>` call and no map entry →
      also reported, because the map is the assertion and not a fallback. **A mapping entry
      for a permission the manifest no longer declares → unaffected**, because a control
      surviving a mutation is the control working.

- [ ] 5.4 **Restoration SHA-256 per mutated file against a digest taken *before* the
      mutation.** Not against `HEAD`, and not against a digest taken after the mutation —
      a post-mutation digest matches on both sides and certifies a file carrying none of the
      change. **`git checkout --` is not a restore**: it reverts to `HEAD`, destroying the
      change, and exits 0.

- [ ] 5.5 **The instrument lives outside the repository and is deleted.** Four temporary
      scripts in the repository root have failed `pnpm lint` on a past archive stage, and a
      measuring instrument is not a shipped file.

## 6. Gates

- [ ] 6.1 **`pnpm verify` three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory**, each exit `0`. Three because two reds at this stage of past changes were
      both real and neither was a flake: `format:check` on files committed earlier in the
      change without Prettier having run, and `lint` on the harness itself.

- [ ] 6.2 **Record `pnpm test` from a `--reporter=json` run grouped by project, not read off
      a summary line.** The standing figures are `packages/ui` 38, `packages/storage` 86,
      `apps/web` 125, `apps/extension` 465, boundary **53**. **`apps/extension` is the only
      one that may move, and only by the cases this change adds.**

- [ ] 6.3 **`pnpm test:browser` repeated with a stated denominator.** This change adds **no
      browser case** — the probe is quarantined and neither tier collects it — so
      **40 website and 97 extension on every run that produced a measurement**, and a run
      with no tier summary is `HARNESS-ERROR`. **A count that moves here is a finding about
      something this change did not name.**

- [ ] 6.4 **`openspec validate --specs --strict` and `openspec validate <change> --type
      change --strict`**, and the re-count by heading across `openspec/specs/` **taken after
      the archive rather than carried into it.** Baseline is **168 requirements and 544
      scenarios across 14 capabilities**; this change's delta adds **0 requirements and 1
      scenario** in `extension-client` (14 → 14, 74 → 75), because a `MODIFIED` block
      *replaces* rather than adds.

## 7. What this change deliberately does not do

- [ ] 7.1 **The privacy document is not written here** (M12 item three). It is **unblocked**
      by `extension-clear-data` and remains its own change.

- [ ] 7.2 **The `tabs` permission is not added.** §4.6 measured `tab.url` withheld without
      it and read with it, and `side-panel-surface` chose the free route. **M12's review is
      about removing unearned permissions, not adding earned ones**, and re-deciding a
      settled route is not this change's business.

- [ ] 7.3 **The alarm that survives a removal is not cleared.** `extension-clear-data` D7
      records that the panel reaches no alarm platform and that the residual is named. **A
      permission review is not a place to settle it**, and §4.5 measured `alarms` as granted
      at install with no prompt.

- [ ] 7.4 **Nothing about a rendered pixel, a headed desktop, or another engine.** One
      Chromium, headless, on one machine — unchanged from §4.6's own limits, and this change
      adds no engine.

- [ ] 7.5 **A human looking at the extension is not an instrument.** If the panel stops
      appearing when the permission is removed, **§4.6 already records that this Chromium is
      headless and that `open()` resolving and the document running are two smaller facts than
      a person seeing one.** No gate here can answer that and none will be cited as if it
      could.
