# Branding check — tasks

## 1. Records

- [ ] 1.1 Record the six roadmap checks in `docs/BRANDING.md`, each with the instrument
      that ran it, the control that proved the instrument, the date, and what was **not**
      measured.
- [ ] 1.2 Record the domain result from the **registry's RDAP endpoint**, with the
      registration date, the expiry date, the last-changed date and the absence of
      nameservers.
- [ ] 1.3 Record the **disagreement** between RDAP and every DNS-based availability check,
      as the change's headline finding rather than as a footnote.
- [ ] 1.4 Record the three checks that produced **no measurement**, each with the
      reproduction and the reason, and with no verdict attached to any of them.
- [ ] 1.5 Record the name's cost in the shipped tree: **108** occurrences across **49**
      files, **58** after comments are stripped, **30** inside string and template
      literals across **16** files.
- [ ] 1.6 Record the surface map: the **eight** places the product names itself, each
      named by file and line, and which of them already reads one value.
- [ ] 1.7 Record the **two independent readings** of the two files the comment stripper
      could not vouch for, so the rendered count is not carrying an unmeasured number.
- [ ] 1.8 Record the company directory's description of the `.com` holder as **that
      source's description**, and not as a fact — including that its one testable claim,
      that the domain resolves, is the claim the registry contradicted.

## 2. The exported value

- [ ] 2.1 Export the public name from `packages/ui`, as a single named value.
- [ ] 2.2 Record in the module's documentation **why** it lives there, quoting the
      package's own rule about what is shared by definition, and naming `packages/core`
      as considered and rejected with its approved Purpose as the reason.
- [ ] 2.3 Add the value's own cases in `packages/ui`, including one that fails if the
      value is empty or is not a single word with no surrounding whitespace — **a
      published name with a stray space is a defect no other check here would see.**

## 3. The website's surfaces

- [ ] 3.1 `Wordmark.tsx` renders the exported value rather than a literal.
- [ ] 3.2 `apps/web/index.html`'s `<title>` carries the exported value, and **the way it
      is written is checked by reading the file**, because no module imports a build
      input.
- [ ] 3.3 The wordmark's existing requirement coverage is **not** disturbed: the product
      region still takes its name from its heading, and a test that read the exported
      value would move with it.

## 4. The extension's surfaces

- [ ] 4.1 `Popup.tsx`'s heading renders the exported value in **all three** places, and
      the map's entry for the popup is falsifiable in that direction — one reference is
      the claim, three is the measurement.
- [ ] 4.2 `panel-copy.ts`'s title is derived from the exported value, and **the panel's
      three renderings are left exactly as they are**, because that is the pattern the
      other surfaces are adopting.
- [ ] 4.3 `manifest.json`'s `name` and `action.default_title` both carry the exported
      value, and **a case relates the two fields to each other**, which is the property
      no existing check sees.
- [ ] 4.4 `popup.html` and `sidepanel.html`'s `<title>` elements carry the exported
      value.
- [ ] 4.5 **No copy string containing the name is changed.** `"SpectreMail could not read
      its own storage"`, `"Use SpectreMail"` and
      `"Guerrilla Mail is asking SpectreMail to slow down"` are correct and stay.

## 5. The instrument

- [ ] 5.1 `tests/architecture/branding-audit.test.ts` holds the surface map — surface,
      file, line, how it is rendered, and how it is read — as **test-owned data**, not a
      scan for the string. `design.md`'s D2 gives three reasons, and the third is that a
      scan fires on `apps/web/e2e/sections.spec.ts`'s own planted negative control.
- [ ] 5.2 Every surface in the map is checked to render the one value, and **a surface
      that renders a different name is reported by name**.
- [ ] 5.3 The map is checked to be **exhaustive in both directions**: a place the tree
      names the product as the product and the map does not name is reported by name.
- [ ] 5.4 The reader that decides whether an occurrence is the name or copy that contains
      it is a **self-tested reader**, with its first case a known-rendering occurrence and
      its second a known-copy occurrence, so it cannot pass by matching nothing.
- [ ] 5.5 Every reader in the file is falsified by a `--self-test` **before** its tally
      is taken, and a run with no summary reports `harness-error` rather than a count.
- [ ] 5.6 The review's own claims are checked: every surface it names exists, every
      check it reports carries a date, and **every check it reports as unmeasured
      carries no verdict**.
- [ ] 5.7 The file self-tests for pattern-freeness and for **sharing no reader** with
      `tests/architecture/boundaries.test.ts` or with
      `tests/architecture/privacy-disclosure.test.ts`.

## 6. Falsification

- [ ] 6.1 Run every deliberate violation this change introduced and require each to be
      caught **by the assertion it was aimed at**. `wrongcatch`, `green`, `noop`,
      `nocompile` and `harness-error` all zero.
- [ ] 6.2 Take restoration digests **before** the first mutation, not after, and verify
      every mutated file against them by SHA-256.
- [ ] 6.3 Rebuild `dist/` from the restored source, and report a failed rebuild rather
      than exiting quietly.
- [ ] 6.4 The instrument lives **outside the repository** and is deleted afterwards. A
      measuring script left in the root is something every future `pnpm lint` has an
      opinion about, and `extension-preview`'s `pnpm verify` failed on exactly that.
- [ ] 6.5 The instrument resolves `pnpm`, `vite` and `playwright` from the package that
      owns each. **Measured on 2026-10-16:** `playwright` and `playwright-core` are not
      hoisted out of `apps/web` by pnpm and fail to resolve by name; `@playwright/test`
      resolves and is the correct answer.
- [ ] 6.6 Include at least one violation that **changes a control query's expected
      outcome**, because a reader whose control never fails is the failure mode this
      change's D6 is about.

## 7. Predictions, so that they are falsifiable

- [ ] 7.1 `packages/storage` stays at **86** with an **empty** `git diff --stat`. Its two
      occurrences are prose inside error messages, and this change touches neither.
- [ ] 7.2 `packages/mailbox`, `packages/providers` and `packages/core` are **unmoved**.
- [ ] 7.3 `tests/architecture/boundaries.test.ts` stays at **53**. Three properties are
      introduced and each has an instrument already or gets one here; **a rule added where
      an instrument exists is not coverage**.
- [ ] 7.4 `packages/ui` **rises**, and `apps/web` and `apps/extension` **both rise**.
- [ ] 7.5 The surface map is **eight** surfaces, and the requirement is falsifiable in
      both directions.
- [ ] 7.6 **Zero production behaviour changes.** Every edit is a name becoming a
      reference, and no gate may report a behavioural difference as a consequence.

## 8. Deliberately not done, and why

- [ ] 8.1 **No rename.** The measured finding is that the name stands; the loss is the
      `.com`, and choosing a domain is M13's decision and is not a branding question.
- [ ] 8.2 **No trademark position of any kind.** Three of the six checks produced no
      measurement and the review says so. This repository's own rule — do not cite terms
      that were not verified — applies to a mark as much as to a provider.
- [ ] 8.3 **No claim about who holds the `.com`.** The directory's description is cited
      as that source's description, and its one testable claim is the one the registry
      contradicted.
- [ ] 8.4 **`visual-system` is not touched.** The name lives in `packages/ui` and no
      requirement in that capability constrains it today; widening a M7 capability for a
      value it does not govern needs a measurement this change does not have. Recorded as
      a gap.
- [ ] 8.5 **No `tsconfig.json` is added to `tests/architecture/`.** That is the standing
      limit on what `pnpm verify` establishes there, and adding one would move every
      future gate's typecheck scope.
- [ ] 8.6 **`docs/ROADMAP.md`, `AGENTS.md` and `openspec/specs/` are not written by the
      implementation stage.** They are the root orchestrator's and the sync stage's.