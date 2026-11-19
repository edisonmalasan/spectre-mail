# Proposal

## Why

The roadmap's own completion definition for M13 measures two criteria as **unmet**: *"Website is
publicly usable"* and *"Browser extension is publicly usable"*. Both are unmet for the same reason —
**nothing here produces something a person could be handed** — and §33.2 records the measurement:

- no deployment, hosting, or release job exists anywhere in the repository;
- no hosting configuration exists for `apps/web`;
- no store listing, no packaged artefact, and no packaging command exist for `apps/extension`.

**Two of those are product decisions and one of them is not.** A website has to be deployed
*somewhere* and an extension has to be published *under somebody's account*; this repository cannot
choose either, and §33.2 records both as decisions rather than as gaps. **What it can settle is the
artefact**: the thing that gets uploaded, the mark it carries, and the procedure that produces it.
None of that needs an account, and all of it is missing.

Measured on 2026-11-20, on `main` at `e6c1899`:

- **`apps/extension/static/manifest.json` declares no `icons` key**, so Chromium draws this product
  with a generic placeholder in the toolbar, on the extensions page, and in a store listing. The
  extension ships exactly one raster icon, `static/icon.png`, and it is reachable **only** from a
  notification — a clause `extension-client` *requires*, written when an icon had one consumer.
- **No command produces an archive.** `apps/extension/package.json`'s scripts end at `test:browser`,
  the root's end at `verify`, and a zip with `manifest.json` at its root — the only shape a store
  accepts — is produced nowhere.
- **`apps/web/index.html` declares a `<title>` and nothing else**: no description, so a search result
  and a link preview have nothing to show but the name; and no icon, so a tab shows a placeholder.
- **`docs/` carries nine records and no release procedure** — `ARCHITECTURE`, `BETA`, `BRANDING`,
  `BROWSERS`, `DESIGN_SYSTEM`, `PRIVACY`, `PROVIDERS`, `ROADMAP`, `SECURITY`. A maintainer asking
  *"what do I run, and what does each gate actually establish?"* has to reconstruct the answer from
  `AGENTS.md` and six change archives.

**And one requirement must be amended rather than worked around.** `extension-client` requires
`manifest.icons`/`action.default_icon` to stay `undefined`, so the placeholder is not an omission —
it is a promoted requirement. A change that added icons without amending it would put a specification
and a manifest in direct contradiction, which is the one thing `openspec/specs/` exists to prevent.

## What Changes

**1. The extension ships one icon family, and the manifest declares it.** The product's mark at
**16, 32, 48 and 128** pixels under `static/icons/`, with the 128 being the file this extension
already ships, **byte-identical**. `manifest.icons` names all four; `action.default_icon` names one
of them rather than a fifth file; the notification keeps naming a raster PNG and now names the 128
member of the same family. **`extension-client`'s notification requirement is MODIFIED** so the
clause that required the manifest to stay blank is replaced rather than contradicted, with every one
of its six scenarios carried forward.

**2. One command packages the built extension into an archive a store accepts.** `manifest.json` at
the archive's root, every literal filename the manifest declares inside it, the version read from the
built manifest rather than typed, and **byte-identical output across two runs** so a rebuild diff
means something. The archive is a build output, ignored by Git, and the command refuses rather than
writing an empty archive when there is no build to package.

**3. The website's document states what the page is and carries the mark its tab shows.** One
description, written from `PRODUCT.md`'s own purpose sentence, and one icon declared as an inline
`data:image/svg+xml` URI whose path data **is** the page's own `BRAND_MARK_PATH`. **Data rather than
a file, because the page is required to draw its mark without fetching anything** — an icon file
would be the request that property forbids, and a second drawing of the mark would be a set spelled
twice.

**4. `docs/RELEASE.md` records the procedure, and what each step does not establish.** Which commands
to run, what each gate establishes and what it does not, which steps need a decision this repository
cannot make, and which steps have never been run. It names no version of its own.

**No new capability is introduced**, and no client's behaviour changes. Nothing here deploys, hosts,
publishes, or opens an account.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-client` — **MODIFIED**: the notification requirement's icon clause, replaced with the
  family that now exists. **ADDED**: the icon family the manifest declares, and the archive a store
  accepts.
- `website-client` — **ADDED**: the document's description and the mark its tab shows.
- `build-and-verification` — **ADDED**: the release procedure document, and what it is required to
  say about the gates and the steps it cannot complete.

## Impact

**Shipped files.**

- `apps/extension/static/manifest.json` — gains `icons`, gains `action.default_icon`, version
  unchanged at `0.1.0`.
- `apps/extension/static/icons/icon-{16,32,48,128}.png` — new; `static/icon.png` moves to
  `icons/icon-128.png` by `git mv` and is **byte-identical**.
- `apps/extension/src/notification.ts` — `NOTIFICATION_ICON_FILE` becomes `icons/icon-128.png`.
- `apps/extension/scripts/package.mjs` — new; a dependency-free ZIP writer, no new dependency.
- `apps/extension/package.json` — one `package` script. The root keeps `verify` exactly as it is,
  because **verification SHALL NOT produce a release artefact**.
- `.gitignore` — names the packaging output directory.
- `apps/web/index.html` — a description and an icon, both as build inputs, held to the page's own
  values by an instrument.
- `docs/RELEASE.md` — new.

**Tests.**

- `tests/architecture/packaging.test.ts` — new. Opens the archive with a **separately written
  reader** that parses the central directory rather than reusing the writer's code.
- `tests/architecture/release-record.test.ts` — new. Resolves the document's commands against the
  repository's own scripts, and reads what it claims about the gates.
- `apps/extension/e2e/manifest.spec.ts` — the two assertions that require `manifest.icons` and
  `action.default_icon` to be `undefined` are replaced by the family's assertions, plus the icon
  files' presence and their accent.
- `apps/extension/src/notification.test.ts`, `apps/extension/src/extension-platform.test.ts` — the
  icon filename and its resolved URL.
- `apps/web/e2e/document.spec.ts` — new. Reads the built document, and re-asserts the no-image,
  no-font request property **with an icon declared**.

**Documentation.** `README.md`'s capability table is corrected — it reads **190 / 629** and four of
its fifteen rows are stale; the promoted tree is **196 / 652** — and its *"no release pipeline
exists"* sentence is corrected rather than left to become false. `docs/ROADMAP.md`'s archive note for
`guerrilla-liveness-detection` gains PR **#204** from `gh pr view`, and its Project Status cursor
names this change.

**What this does not do.** It does not choose a host, open a store account, add a CI release job, or
claim either client is publicly usable. **A packaged archive and a deployed site are different
claims**, and only the first is this change's.
