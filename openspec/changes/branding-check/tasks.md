# Branding check — tasks

## 1. Records

- [x] 1.1 Record the six roadmap checks in `docs/BRANDING.md`, each with the instrument
      that ran it, the control that proved the instrument, the date, and what was **not**
      measured.
- [x] 1.2 Record the domain result from the **registry's RDAP endpoint**, with the
      registration date, the expiry date, the last-changed date and the absence of
      nameservers.
- [x] 1.3 Record the **disagreement** between RDAP and every DNS-based availability check,
      as the change's headline finding rather than as a footnote.
- [x] 1.4 Record the three checks that produced **no measurement**, each with the
      reproduction and the reason, and with no verdict attached to any of them.
- [x] 1.5 Record the name's cost in the shipped tree: **108** occurrences across **49**
      files, **58** after comments are stripped, **30** inside string and template
      literals across **16** files.
- [x] 1.6 Record the surface map: the **eight** places the product names itself, each
      named by file and line, and which of them already reads one value.
- [x] 1.7 Record the **two independent readings** of the two files the comment stripper
      could not vouch for, so the rendered count is not carrying an unmeasured number.
- [x] 1.8 Record the company directory's description of the `.com` holder as **that
      source's description**, and not as a fact — including that its one testable claim,
      that the domain resolves, is the claim the registry contradicted.

## 2. The exported value

- [x] 2.1 Export the public name from `packages/ui`, as a single named value.
- [x] 2.2 Record in the module's documentation **why** it lives there, quoting the
      package's own rule about what is shared by definition, and naming `packages/core`
      as considered and rejected with its approved Purpose as the reason.
- [x] 2.3 Add the value's own cases in `packages/ui`, including one that fails if the
      value is empty or is not a single word with no surrounding whitespace — **a
      published name with a stray space is a defect no other check here would see.**

## 3. The website's surfaces

- [x] 3.1 `Wordmark.tsx` renders the exported value rather than a literal.
- [x] 3.2 `apps/web/index.html`'s `<title>` carries the exported value, and **the way it
      is written is checked by reading the file**, because no module imports a build
      input.
- [x] 3.3 The wordmark's existing requirement coverage is **not** disturbed: the product
      region still takes its name from its heading, and a test that read the exported
      value would move with it.

## 4. The extension's surfaces

- [x] 4.1 `Popup.tsx`'s heading renders the exported value in **all three** places, and
      the map's entry for the popup is falsifiable in that direction — one reference is
      the claim, three is the measurement.
- [x] 4.2 `panel-copy.ts`'s title is derived from the exported value, and **the panel's
      three renderings are left exactly as they are**, because that is the pattern the
      other surfaces are adopting.
- [x] 4.3 `manifest.json`'s `name` and `action.default_title` both carry the exported
      value, and **a case relates the two fields to each other**, which is the property
      no existing check sees.
- [x] 4.4 `popup.html` and `sidepanel.html`'s `<title>` elements carry the exported
      value.
- [x] 4.5 **No copy string containing the name is changed.** `"SpectreMail could not read
      its own storage"`, `"Use SpectreMail"` and
      `"Guerrilla Mail is asking SpectreMail to slow down"` are correct and stay.

## 5. The instrument

- [x] 5.1 `tests/architecture/branding-audit.test.ts` holds the surface map — surface,
      file, site, how it is rendered, and how it is read — as **test-owned data**, not a
      scan for the string. `design.md`'s D2 gives three reasons, and the third is that a
      scan fires on `apps/web/e2e/sections.spec.ts`'s own planted negative control.
- [x] 5.2 Every surface in the map is checked to render the one value, and **a surface
      that renders a different name is reported by name**.
- [x] 5.3 The map is checked to be **exhaustive in both directions**: a place the tree
      names the product as the product and the map does not name is reported by name.
- [x] 5.4 The reader that decides whether an occurrence is the name or copy that contains
      it is a **self-tested reader**, with its first case a known-rendering occurrence and
      its second a known-copy occurrence, so it cannot pass by matching nothing.
- [x] 5.5 Every reader in the file is falsified by a `--self-test` **before** its tally
      is taken, and a run with no summary reports `harness-error` rather than a count.
- [x] 5.6 The review's own claims are checked: every surface it names exists, every
      check it reports carries a date, and **every check it reports as unmeasured carries
      no verdict**.
- [x] 5.7 The file self-tests for pattern-freeness and for **sharing no reader** with
      `tests/architecture/boundaries.test.ts` or with
      `tests/architecture/privacy-disclosure.test.ts`.

## 6. Falsification

- [x] 6.1 Run every deliberate violation this change introduced and require each to be
      caught **by the assertion it was aimed at**. `wrongcatch`, `green`, `noop`,
      `nocompile` and `harness-error` all zero.
- [x] 6.2 Take restoration digests **before** the first mutation, not after, and verify
      every mutated file against them by SHA-256.
- [x] 6.3 Rebuild `dist/` from the restored source, and report a failed rebuild rather
      than exiting quietly.
- [x] 6.4 The instrument lives **outside the repository** and is deleted afterwards. A
      measuring script left in the root is something every future `pnpm lint` has an
      opinion about, and `extension-preview`'s `pnpm verify` failed on exactly that.
- [x] 6.5 The instrument resolves `pnpm`, `vite` and `playwright` from the package that
      owns each. **Measured on 2026-10-16:** `playwright` and `playwright-core` are not
      hoisted out of `apps/web` by pnpm and fail to resolve by name; `@playwright/test`
      resolves and is the correct answer.
- [x] 6.6 Include at least one violation that **changes a control query's expected
      outcome**, because a reader whose control never fails is the failure mode this
      change's D6 is about.

## 7. Predictions, so that they are falsifiable

- [x] 7.1 `packages/storage` stays at **86** with an **empty** `git diff --stat`. Its two
      occurrences are prose inside error messages, and this change touches neither.
      **CONFIRMED**: 86 across 7 files, and `git diff --stat -- packages/storage` empty.
- [x] 7.2 `packages/mailbox`, `packages/providers` and `packages/core` are **unmoved**.
      **CONFIRMED**: 166, 92 and 54, identical to the measured baseline, and
      `git diff --stat` over all three empty.
- [x] 7.3 `tests/architecture/boundaries.test.ts` stays at **53**. Three properties are
      introduced and each has an instrument already or gets one here; **a rule added where
      an instrument exists is not coverage**. **CONFIRMED**: 53, counted by reading the
      suite's own source through the TypeScript parser rather than by typing the number.
- [x] 7.4 `packages/ui` **rises**, and `apps/web` and `apps/extension` **both rise**.
      **HALF CONFIRMED, HALF CORRECTED** — `packages/ui` rose **38 → 42**; `apps/web`
      stayed at **125** and `apps/extension` stayed at **487**. This change adds no test to
      either client: the value's own cases live in `packages/ui` and the instrument is in
      `tests/architecture`. The prediction was wrong about both clients and the correction
      is the measurement above.
- [x] 7.5 The surface map is **eight** surfaces, and the requirement is falsifiable in
      both directions. **CORRECTED**: eight **surfaces** is right and was measured, but
      they are **eleven rows** and **thirteen sites**, because the exhaustive scan found
      three places the proposal's table did not name — `main.tsx`'s popup heading,
      `panel-main.tsx`'s panel heading, and the value's own declaration. See
      `design.md` D10.
- [x] 7.6 **Zero production behaviour changes.** Every edit is a name becoming a
      reference, and no gate may report a behavioural difference as a consequence.
      **CONFIRMED**: `apps/extension/static/manifest.json`, `Panel.tsx` and every package
      outside `packages/ui` are byte-unchanged, `pnpm test:browser` is 5 of 5 then 2 of 2
      green at 40 website and 98 extension, and `git diff --stat` over
      `apps/extension/src/Panel.tsx` and the manifest is empty.

## 8. Deliberately not done, and why

- [x] 8.1 **No rename.** The measured finding is that the name stands; the loss is the
      `.com`, and choosing a domain is M13's decision and is not a branding question.
- [x] 8.2 **No trademark position of any kind.** Three of the six checks produced no
      measurement and the review says so. This repository's own rule — do not cite terms
      that were not verified — applies to a mark as much as to a provider.
- [x] 8.3 **No claim about who holds the `.com`.** The directory's description is cited
      as that source's description, and its one testable claim is the one the registry
      contradicted.
- [x] 8.4 **`visual-system` is not touched.** The name lives in `packages/ui` and no
      requirement in that capability constrains it today; widening a M7 capability for a
      value it does not govern needs a measurement this change does not have. Recorded as
      a gap.
- [x] 8.5 **No `tsconfig.json` is added to `tests/architecture/`.** That is the standing
      limit on what `pnpm verify` establishes there, and adding one would move every
      future gate's typecheck scope.
- [x] 8.6 **`docs/ROADMAP.md`, `AGENTS.md` and `openspec/specs/` are not written by the
      implementation stage.** They are the root orchestrator's and the sync stage's.

## 9. Apply-stage record

- [x] 9.1 **Two files were written that this task list's write scope did not name**, and
      both were authorised by the root orchestrator before the edit was made. See
      `design.md` D10 and D11 for what each one was and why the requirement could not hold
      without it.
- [x] 9.2 The falsification table, the gate results and the two instrument defects the
      falsification pass found are recorded in `design.md` under "Apply-stage record".
## 10. Sync-stage record (2026-10-16)

### 10.1 One requirement figure was amended **before** it was promoted

`extension-client`'s new requirement said the extension names the product in **six** surfaces,
two of them components. **It is eight, four of them components**, and the two extra are
``main.tsx:81`` and `panel-main.tsx:117` — a heading in the branch taken when that client's own
storage could not be read, in each of the two composition roots.

**The source of the wrong figure was the root orchestrator's own measured table**, not the
instrument. The map's reverse direction found both places; the root's reading had listed the
files it had read.

**This is why the amendment was written into the delta rather than into the promoted spec.** A
requirement's count is a claim about the tree, and promoting a claim the apply stage had already
disproved would put a false figure into `openspec/specs/` permanently. Writing it into the delta
is the recorded practice, and it is why an archived delta and a promoted spec are the same blocks.
The amendment is in the delta with its reason, so the archive carries the correction too.

### 10.2 The promotion, and the two instruments that made it

Three `ADDED` blocks, no `MODIFIED` and no `REMOVED`. Re-counted by heading **after** the
promotion rather than carried forward:

    179 requirements / 577 scenarios / 15 capabilities
 -> 182 requirements / 589 scenarios / 15 capabilities

  website-client           23 -> 24    75 -> 79
  extension-client         15 -> 16    79 -> 83
  build-and-verification   11 -> 12    32 -> 36

Rehearsed in full on a throwaway copy of `openspec/` before the real tree. The promoter and the
verifier **share no reader and no function**: the promoter walks lines with a state machine and
ends a block at the next `### Requirement:` **or** any `## `, while the verifier splits whole text
by regex. Git's own diff is the independent confirmation that nothing existing was touched:
`git diff --numstat -- openspec/specs` is **59/0, 81/0, 65/0** — three files, **zero deletions**.

### 10.3 One instrument defect, and it is the second time this repository has made it

The verifier's `--self-test` failed on its first run with `ENOENT` naming
`.../--self-test/changes/branding-check/specs/build-and-verification/spec.md`. **It had read the
openspec root as `process.argv[2]`, so with the flag passed first it resolved its own flag as a
directory.**

The repair reads the first argument that is not a flag, and the self-test was then run in **both**
argument orders — `--self-test <root>` and `<root> --self-test` — with the same **4/4** each time.
**Running it in both orders is the falsification of the fix rather than a demonstration of it**,
because the defect was exactly that the order mattered.

**The same mistake has now been made twice in this repository, by two instruments written on
different days for different changes** — the apply stage's falsification harness last session, and
this one. It is recorded here rather than fixed in silence, because the second instance is the
evidence that "we fixed it once" is not the same as "it cannot happen again".

### 10.4 The promoter's guard, falsified separately

Run twice, the second run **exited 1** with
`REFUSING: website-client already carries a requirement headed "The public name is one exported
value, ..."` and left all three specification files **SHA-256 unchanged** — because an `ADDED`
block landing on a heading that already exists is a silent replacement wearing the name of an
addition.

### 10.5 Root-owned figures corrected here

`AGENTS.md`'s standing test figure is **1308 across 66**, measured from a `--reporter=json` run
**grouped by project**: `packages/ui` **38 → 42**, `tests/architecture` **93 → 107**,
`packages/storage` still **86**, `apps/web` still **125**, `apps/extension` still **487**, and
**`boundaries.test.ts` still 53**.

**`packages/ui` is no longer 38, and that ends a figure this file had carried through nine
milestones.** The package's count was held steady by nine consecutive changes each of which
declared it would add no token and no motion, and **a figure that stops moving for that long is
indistinguishable from a figure nobody re-ran**. It was re-measured here and it had moved.

### 10.6 The browser tier, and a red with no name

`pnpm test:browser` was run **thirteen** times: **twelve green at 40 website and 98 extension,
and one red** which failed the extension tier 1-of-98 and did not reproduce in twelve subsequent
runs. **The reader written to name the failing case matched nothing**, so the red is
**unattributed**.

It is *consistent with* the two pre-existing unattributed reds in `security-surface-review`'s
`tasks.md` 6.4, and **consistent with is not an attribution**. It is recorded as a red this
change produced and cannot explain, which is the honest description, and it is not counted as a
pass.
