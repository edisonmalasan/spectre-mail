# Tasks

## 1. The extension's icon family

- [ ] 1.1 `git mv apps/extension/static/icon.png apps/extension/static/icons/icon-128.png`, and record
      the file's SHA-256 **before** the move so "byte-identical" is a measurement rather than a claim.
- [ ] 1.2 Derive `icon-16.png`, `icon-32.png` and `icon-48.png` from `icon-128.png` with a throwaway
      script outside the repository. Verify each is a PNG of the declared dimensions, and that every
      one carries the accent colour `#5a3fd0` and no colour the 128 does not carry.
- [ ] 1.3 `apps/extension/static/manifest.json`: add `icons` naming all four, and
      `action.default_icon` naming one of them. **Version stays `0.1.0`**, and the diff is checked to
      contain no other change.
- [ ] 1.4 `apps/extension/src/notification.ts`: `NOTIFICATION_ICON_FILE` becomes
      `icons/icon-128.png`, with the comment corrected to say why the notification and the manifest
      name one file.
- [ ] 1.5 `apps/extension/src/notification.test.ts` and `apps/extension/src/extension-platform.test.ts`:
      repoint the three icon filename references. `extensionAssetUrl("icons/icon-128.png")` must
      resolve to `chrome-extension://measured/icons/icon-128.png`.
- [ ] 1.6 `apps/extension/e2e/manifest.spec.ts`: replace the two assertions that require
      `manifest.icons`/`action.default_icon` to be `undefined` with assertions that the family is
      declared, that every named file exists in `dist`, that each is a PNG of the declared size, and
      that each carries the declared accent. **The two old assertions are named in the case's comment
      with the requirement that held them**, so a reader can see what replaced what.

## 2. The build cleans its own output

- [ ] 2.1 `apps/extension/scripts/clean.mjs`: one exported function taking the output directory
      (defaulting to `apps/extension/dist`), and a direct-run guard. It removes the directory and
      recreates it empty, so a build that follows writes into a directory that exists.
- [ ] 2.2 `apps/extension/package.json`: `build` becomes
      `node scripts/clean.mjs && vite build && vite build --config vite.content.config.ts`.
      **`test:browser` is unchanged** and still runs the package's own build.
- [ ] 2.3 Correct the comment in `apps/extension/vite.config.ts` that claims *"Each build cleans its
      own kind of output instead"* — it did not, and D7 records the measurement.
- [ ] 2.4 Unit case: a temporary directory with a planted file is emptied by the clean function, and
      the directory exists afterwards. **The case names no path under `apps/`**, so no test touches
      the shipped output.

## 3. The archive

- [ ] 3.1 `apps/extension/scripts/package.mjs`: a dependency-free ZIP writer using
      `node:zlib`'s `deflateRawSync`. Fixed DOS timestamp, entries sorted by name, stored paths
      relative to `dist/`, `manifest.json` first. It reads the version from the **built manifest**,
      refuses with a named path when `dist/manifest.json` is absent, and writes
      `apps/extension/release/spectre-mail-<version>.zip`.
- [ ] 3.2 It refuses, naming the entry, when the manifest declares a literal filename the build did
      not emit (`background.service_worker`, `action.default_popup`, `side_panel.default_path`,
      every `content_scripts[].js`, every `icons` value, `action.default_icon`).
- [ ] 3.3 `apps/extension/package.json`: add `package`. **No root script changes**, and `verify` is
      checked to be byte-identical.
- [ ] 3.4 `.gitignore`: add `apps/extension/release/`.
- [ ] 3.5 `tests/architecture/packaging.test.ts`: a reader written **independently of the writer**
      that walks the central directory, checks each local header's signature, recomputes every
      CRC-32 from the decompressed bytes, and compares the content with the file on disk. Cases:
      `manifest.json` at the root; every declared filename present; the version equal to the
      built manifest's; two runs byte-identical; no output → refusal naming the path; a planted
      missing entry point reported by name. **A negative control** plants a central directory the
      reader cannot parse and requires an empty result to be reported as such rather than as a pass.

## 4. The archive is an extension

- [ ] 4.1 `apps/extension/e2e/packaged.spec.ts` (one case): run the packaging command, extract the
      archive with the test's own reader, launch the extracted directory with `extensionFlags()`,
      and require the popup document to render the product's name. **A green run establishes that
      the archive's contents load as an extension**, not merely that they are a ZIP.
- [ ] 4.2 That spec is collected by the extension's `playwright.config.ts` `testDir` and by nothing
      else, which the existing collection rule asserts.

## 5. The website's document

- [ ] 5.1 `apps/web/index.html`: add exactly one `<meta name="description">`, written from
      `PRODUCT.md`'s Product Purpose, and one `<link rel="icon" href="data:image/svg+xml,…">` whose
      path data is `BRAND_MARK_PATH`. The comment block gains the reason the icon is data rather
      than a file.
- [ ] 5.2 `tests/architecture/document-metadata.test.ts`: exactly one description, one sentence,
      non-empty, not the product's name alone; the icon is a `data:image/svg+xml` URI; **its path
      data equals the imported `BRAND_MARK_PATH`**; a mutant document with a different path is
      reported by name. **The reader is self-tested** against a fixture carrying no description and
      against one carrying two, so a reader matching nothing cannot pass.
- [ ] 5.3 `apps/web/e2e/document.spec.ts` (new, three cases): the served document's description is
      the one the file declares; the icon element is present after the app has rendered; and **the
      page requests no image and no font file with an icon declared** — the existing
      `sections.spec.ts` property, re-asserted in the file that adds the icon.

## 6. The release procedure

- [ ] 6.1 `docs/RELEASE.md`: the procedure, the four gates with **what each does not establish**, the
      two steps that need a decision this repository cannot make (a deploy target; a publishing
      account), the artefact command and where it writes, and the steps that have never been run —
      each written as unverified rather than as a pass. **No version and no generated date.**
- [ ] 6.2 `tests/architecture/release-record.test.ts`: every command the document names is resolved
      against the repository's own `package.json` scripts, **read from disk rather than listed in the
      test**; the document names both outstanding decisions; the document carries no semver literal;
      and a planted command that does not exist is reported by name.
- [ ] 6.3 `docs/RELEASE.md` is added to whatever list `branding-audit.test.ts` and
      `provider-terms.test.ts` read, **if and only if** those lists are by-directory discovery rather
      than by hand; a hand list is left alone and the omission recorded, because a document added to
      a hand list is a second spelling of a set.

## 7. Documentation corrections

- [ ] 7.1 `README.md`: the capability table's total **190 / 629 → 196 / 652**, and the four stale rows
      corrected (`provider-adapters` 12 / 32, `extension-client` 22 / 101, `visual-system` 10 / 32,
      `website-client` 26 / 90). Re-count every row from `openspec/specs/` rather than transcribing
      these figures.
- [ ] 7.2 `README.md`: the *"No deployment, hosting, or release pipeline exists or is planned for V1"*
      sentence corrected to separate **no artefact** (false once this change lands) from **no deploy
      or publish job** (still true), in the same paragraph rather than by deletion.
- [ ] 7.3 `docs/ROADMAP.md`: the `guerrilla-liveness-detection` archive note gains PR **#204** from
      `gh pr view 204`, and the Project Status cursor names `release-packaging`.
- [ ] 7.4 `AGENTS.md`: the Testing block's icon/archive facts and the standing totals, **only for
      figures this change moves**, each re-measured from a reporter run.

## 8. Falsification

- [ ] 8.1 One arm per new assertion, run against the shipped tree, with every mutated file restored
      and verified by SHA-256. At minimum: an icon size deleted from `dist`; `manifest.icons` removed;
      `action.default_icon` naming a fifth file; the notification repointed at a file the build does
      not carry; the description deleted; the icon's path data changed by one character; the archive
      given a `dist/` prefix; the archive's version typed rather than read; the entry order made
      filesystem-dependent; the clean step removed from `build`; a command in `docs/RELEASE.md`
      renamed to one that does not exist.
- [ ] 8.2 Each arm names **the assertion it is aimed at**, and an arm caught by a different assertion
      is reported as a `wrongcatch` rather than counted.
- [ ] 8.3 Any arm that survives is read before it is recorded: a broken mutant and a mutation that did
      not apply are **not** evidence, and each is recorded as such.

## 9. Gates

- [ ] 9.1 `pnpm verify` — run at least three times, on a frozen tree, with
      `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory. Record every exit code, including a
      red.
- [ ] 9.2 `pnpm test:browser` — both tiers. Record the case counts and confirm the two pre-existing
      totals moved only by the cases this change adds.
- [ ] 9.3 `openspec validate release-packaging --strict`.
- [ ] 9.4 Load the **packaged archive's extracted contents** in the user's Chrome, unpacked, and
      report what a person would see. **If this cannot be done, it is recorded as unverified rather
      than as passing.**

## 10. Record what moved

- [ ] 10.1 Every count that moved, reconciled per package: unit tests, architecture cases, browser
      cases per tier and per file, and `boundaries.test.ts`.
- [ ] 10.2 Every count that did **not** move, where its not moving is the measurement — in particular
      `packages/`, `apps/web`'s unit tier and the provider/adapter packages, which this change does
      not touch.
- [ ] 10.3 What the change does not establish, stated in the same words `design.md` D11 uses rather
      than softened.
