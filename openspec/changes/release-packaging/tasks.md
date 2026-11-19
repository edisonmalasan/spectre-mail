# Tasks

> **Apply stage completed 2026-11-20.** All gates ran; every count below was re-measured from a
> reporter run rather than carried forward. The falsification pass is 9 of 9 arms caught by the
> assertion each was aimed at, with every mutated file restored byte-identically. The one task
> deliberately not completed is **9.4** — loading the packaged archive in the user's own Chrome —
> which is recorded as unverified rather than as passing, because a person judged nothing here and
> no extension profile belonging to the maintainer was available to this stage.

## 1. The extension's icon family

- [x] 1.1 `git mv apps/extension/static/icon.png apps/extension/static/icons/icon-128.png`, and record
      the file's SHA-256 **before** the move so "byte-identical" is a measurement rather than a claim.
      Measured: `4E1ED280FDA231BAD96DAFF375CEC5F7802D9CFE64E4585F5E965EF0BDAFF5A6` before and after
      the move; `git mv` recorded as a rename.
- [x] 1.2 Derive `icon-16.png`, `icon-32.png` and `icon-48.png` from `icon-128.png` with a throwaway
      script outside the repository (`derive-icons.ps1`, under the OpenCode temp directory). Each is
      a PNG of the declared dimension, 16/32/48/128, carries exactly two colours — transparent and
      the accent `255,90,63,208` (`#5a3fd0`) — and its opaque bounds are the 128's scaled, within one
      pixel.
- [x] 1.3 `apps/extension/static/manifest.json`: `icons` names all four and `action.default_icon`
      names `icons/icon-32.png`. Version stays `0.1.0`; the diff contains no other change.
- [x] 1.4 `apps/extension/src/notification.ts`: `NOTIFICATION_ICON_FILE` is `icons/icon-128.png`,
      with the comment recording that the notification and the manifest name one file.
- [x] 1.5 `notification.test.ts` and `extension-platform.test.ts`: all icon references repointed;
      `extensionAssetUrl("icons/icon-128.png")` resolves to
      `chrome-extension://measured/icons/icon-128.png` in the passing suite.
- [x] 1.6 `apps/extension/e2e/manifest.spec.ts`: the two `undefined` assertions replaced by the
      family being declared, every named file present, each a PNG of the declared size, each in the
      declared accent, and each drawn at the 128's geometry. The old assertions and the requirement
      that held them are named in the case's comment.

## 2. The build cleans its own output

- [x] 2.1 `apps/extension/scripts/clean.mjs`: one exported function with a default output directory
      and a direct-run guard; removes and recreates the directory.
- [x] 2.2 `apps/extension/package.json`: `build` is
      `node scripts/clean.mjs && vite build && vite build --config vite.content.config.ts`.
      `test:browser` unchanged. Root `verify` byte-identical.
- [x] 2.3 The false comment in `vite.config.ts` corrected to name the explicit clean step and the
      stale-artefact measurement behind it.
- [x] 2.4 The clean case uses a temporary directory, names no path under `apps/`, and proves the
      directory exists and is empty afterwards — plus a case reading the build script so removing
      the clean prefix goes red.

## 3. The archive

- [x] 3.1 `apps/extension/scripts/package.mjs`: dependency-free ZIP writer, fixed DOS timestamp,
      entries sorted with `manifest.json` first, paths relative to `dist/`, version read from the
      built manifest, named refusal when no build, writes `apps/extension/release/`.
- [x] 3.2 Named refusal for every literal filename the manifest declares that the build did not
      emit (worker, popup, side panel, every content script, every icon, default icon).
- [x] 3.3 `package` script added to `apps/extension` only; root scripts byte-identical.
- [x] 3.4 `.gitignore` names `apps/extension/release/`.
- [x] 3.5 `tests/architecture/packaging.test.ts`: independently written central-directory reader,
      local-header signature checks, independently computed CRC-32, byte comparison with the file on
      disk, and all six named cases plus the negative control and a build-script case (11 total).

## 4. The archive is an extension

- [x] 4.1 `apps/extension/e2e/packaged.spec.ts`: runs the packaging command, extracts with its own
      reader, launches the extracted directory through `extensionFlags()`, and requires the popup to
      render `PRODUCT_NAME`. Passed in the extension tier.
- [x] 4.2 The existing collection rule passes with the new spec present (no `boundaries.test.ts`
      change was needed; the rule is directory-driven).

## 5. The website's document

- [x] 5.1 `apps/web/index.html`: one description from `PRODUCT.md`'s Product Purpose and one inline
      `data:image/svg+xml` icon with `BRAND_MARK_PATH` as its `d`. The block sits *after* the title —
      an earlier placement moved the title from line 21 to 36 and reddened the brand audit by line,
      which is recorded in the comment.
- [x] 5.2 `tests/architecture/document-metadata.test.ts`: one-description/sentence checks, data-URI
      check, path-data equality with the imported `BRAND_MARK_PATH`, and reader self-tests against
      zero and two descriptions (3 cases).
- [x] 5.3 `apps/web/e2e/document.spec.ts`: the three cases, all passing in the website tier.

## 6. The release procedure

- [x] 6.1 `docs/RELEASE.md`: the five sections, each gate with what it does not establish, both
      outstanding decisions, the artefact command and its output path, and the steps never run —
      no version, no date.
- [x] 6.2 `tests/architecture/release-record.test.ts`: commands resolved against scripts read from
      disk, both decisions named, no semver literal, and a planted-command control (3 cases).
- [x] 6.3 Both `branding-audit.test.ts` and `provider-terms.test.ts` use **hand lists**, so per the
      task `docs/RELEASE.md` is deliberately **not** added to either; adding it would be a second
      spelling of a set. The omission is recorded here rather than the hand lists widened.

## 7. Documentation corrections

- [x] 7.1 `README.md` capability table re-counted from `openspec/specs/`: 196 requirements / 652
      scenarios across 15 capabilities, with the four stale rows corrected. Done in the proposal PR.
- [x] 7.2 `README.md` release sentence corrected to separate the artefact (now produced) from the
      deploy/publish job (still absent). Done in the proposal PR.
- [x] 7.3 `docs/ROADMAP.md` archive note carries PR **#204** from `gh pr view 204`, and the cursor
      names `release-packaging`. Done in the proposal PR.
- [x] 7.4 `AGENTS.md` standing testing figure re-measured to 1439 across 80 files, architecture
      breakdown to 176, and both browser tiers updated to 61 / 109 — each with the prior figure kept
      as history.

## 8. Falsification

- [x] 8.1 Nine arms run against the shipped tree, each with the mutation applied and confirmed,
      the file restored, and the restore verified byte-identically by SHA-256. Arms: an icon size
      deleted from `dist`; `manifest.icons` removed; `action.default_icon` naming a fifth file; the
      notification repointed at a file the build does not carry; the description deleted; the icon's
      path data changed by one character; the archive given a `dist/` prefix; the version typed
      rather than read; a command in `docs/RELEASE.md` renamed to one that does not exist. A tenth
      case — removing the clean step from `build` — is held by an assertion that reads the build
      script itself.
- [x] 8.2 Every arm named the assertion it was aimed at; all nine were caught by that assertion,
      with `wrongcatch` and `green` both zero.
- [x] 8.3 No arm survived, so none needed the broken-mutant reading; the two harness defects found
      during the pass (a `sha()` that could not read a deleted file, and Playwright's CLI resolved
      from the workspace root rather than the package) were in the instrument, fixed, and the arms
      re-run — not counted as product evidence.

## 9. Gates

- [x] 9.1 `pnpm verify` — **three runs, all exit `0`**, on a frozen tree with
      `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory measured to hold **0 entries**. Every run
      reported `Test Files 80 passed`, `Tests 1439 passed`, and `All matched files use Prettier code
      style!`. Two further `pnpm test` runs (1439/1439) and two full browser-tier runs preceded the
      gates; no red appeared in this stage.
- [x] 9.2 `pnpm test:browser` — both tiers: **61 website**, **109 extension**. Movement accounted
      for: website +3 (`document.spec.ts`), extension +3 (`packaged.spec.ts` +1, `manifest.spec.ts`
      +2). No other spec file moved.
- [x] 9.3 `openspec validate release-packaging --strict` → valid.
- [ ] 9.4 Load the packaged archive's extracted contents in the **user's** Chrome, unpacked, and
      report what a person would see. **Not completed and recorded as unverified**: this stage had
      no maintainer Chrome profile, and an agent opening a page is not the judgement the task asks
      for. The browser tier does establish that Chromium loads the extracted contents and renders
      the popup's name; it reads no rendered pixel.

## 10. Record what moved

- [x] 10.1 Reconciled per project from a `--reporter=json` run: 1439 total = 500 `apps/extension` +
      176 `tests/architecture` + 149 `packages/mail-parser` + 143 `apps/web` + 172
      `packages/mailbox` + 103 `packages/storage` + 93 `packages/providers` + 54 `packages/core` +
      49 `packages/ui`. Browser: 61 website / 109 extension; `boundaries.test.ts` unmoved at 56;
      the collection rule passes with the new specs present.
- [x] 10.2 Every shared package is unmoved, and `apps/web`'s and `apps/extension`'s unit tiers are
      unmoved — the measurement that this change adds no client or shared-package behaviour.
- [x] 10.3 What this change does not establish is carried verbatim in `design.md` D11 and in
      `docs/RELEASE.md` §§4–5, and is not softened here.
