# Producing a SpectreMail release candidate

This is the one place the release procedure is written. It records **what the repository can produce
and verify by itself**, and **what still needs a decision the repository cannot make**. It deliberately
carries no version and no generated date: the version a release candidate carries is read from the
built manifest, and a second copy of it in prose would be the second spelling of a set this repository
records as a defect.

A release candidate is **not** a published product. The archive and the built site are artefacts a
person can be handed; deployment and listing are separate steps, recorded as outstanding below.

## 1. Install and run the repository's own gates

```text
pnpm install
pnpm verify
pnpm test:browser
pnpm spike:selftest
```

Run in that order, on a clean checkout. `pnpm verify` runs typecheck, lint, format check, the unit
and architecture suites, and both client builds in sequence. `pnpm test:browser` builds both clients,
builds the in-page fixture, and runs the website tier and then the extension tier in real Chromium.
`pnpm spike:selftest` proves the disposable provider harness's own contract; it is separate from the
workspace and is deliberately not a dependency of any product gate.

**What these establish.** The workspace is internally consistent: every project type checks under
the shared strict config, lints, is formatted, and passes its unit and architecture tests; both
clients build; the built website and extension behave in Chromium as the browser suites assert; and
the spike harness can still tell a failed probe from a passing one.

**What they do not establish, and each is a different hole.**

- `pnpm verify` runs with **no browser installed**. It is a browser-free tier, and it is kept that
  way deliberately; a green `verify` says nothing about what Chromium does with the built output.
- The browser tier reaches **no live provider**. Every provider response is a recording imported from
  `packages/providers`, and any origin the tier did not script is reported by name. A provider that
  changed its wire format would leave both tiers green. In particular, **the polling cadence has
  never been observed against a live provider**, and no stored mailbox has been reconciled against a
  live Guerrilla Mail session.
- The adapters are driven by **recorded responses**, so the suite proves this repository's mapping
  of a provider's wire format and nothing about the provider's current behaviour.
- **No test here reads a rendered pixel.** Focus, contrast, motion and composition are asserted as
  computed styles, accessibility-tree reads, DOM reads and WCAG arithmetic. Whether any surface
  _looks_ right is a human judgement, and a human opening the page is the only instrument for it.
- Nothing here is verified on a browser other than Chromium, on a headed desktop, or against a real
  clipboard. Each limit is recorded in `AGENTS.md`'s browser-tier section rather than implied by a
  green run.

**The gate's own flake is recorded rather than rounded away.** The unit suite has produced a
`[vitest-worker]: Timeout calling "onTaskUpdate"` with every test passing. A red that appears and
disappears without the tree changing is a red that means nothing; re-run before attributing it.

## 2. Produce the extension archive

```text
pnpm --filter @spectre-mail/extension package
```

The command reads `dist/manifest.json`, refuses if the build is absent (naming the path), refuses if
the manifest names a file the build did not emit (naming the entry), and writes
`apps/extension/release/spectre-mail-<version>.zip`. The version in that filename is the built
manifest's, not a value typed into the command. The archive has `manifest.json` at its root, carries
every literal filename the manifest declares, and is byte-identical across two runs over unchanged
output. `apps/extension/release/` is ignored by Git: an archive is a hand-off, not a committed file.

**What this establishes.** The ZIP is well formed, its contents agree with the build output, and
Chromium can load the extracted contents as an extension and render the popup — the last point is the
one browser case in `apps/extension/e2e/packaged.spec.ts`, which runs the command and launches what
it produces.

**What it does not establish.** A store accepting an upload, a signed or notarised package, a real
listing page, or a person installing it. No store has been contacted by anything in this repository.

## 3. Produce the website's static output

```text
pnpm build:web
```

`apps/web/dist` is the static site. It is served as static files by whichever host is chosen in step
4; there is no server-side component and no application backend.

**What this establishes.** The page builds from the checked-in sources with the same command the
browser tier uses, and the document carries the description and the inline mark the architecture and
browser cases read.

**What it does not establish.** That the site is reachable from anywhere. No deployment has been run
by this repository, and the local dev server is not a host.

## 4. The two steps that need a decision this repository cannot make

These are **outstanding**, not done, and this document does not report the release as complete while
either remains open.

1. **Where the website is deployed.** `apps/web/dist` has to be served by a host somebody chooses and
   controls. The roadmap records this as a product decision. Until a target exists there is no URL,
   no DNS and no verification that the built page works on a real host.
2. **Whose developer account publishes the extension.** The archive in step 2 has to be uploaded under
   a Chrome Web Store developer account somebody owns. The roadmap records this as a product
   decision. Until an account exists there is no listing, no store review, and no public
   distribution.

A step omitted is an assumption; a step named as outstanding is a record. Both are named here so no
reader can mistake an artefact for a publication.

## 5. What has never been run

- **The packaged archive has not been submitted to a store.** Step 2 ends at a file and a local
  Chromium load.
- **The static site has not been deployed.** Step 3 ends at a directory.
- **No live provider has been used from either client.** Every test response is recorded.
- **No person has judged how any surface looks.** No test reads a rendered pixel.

Each is written as unverified rather than as a pass, because a procedure that called an unrun step a
success would be describing a hole as a green tick — the defect `build-and-verification`'s
passing-run requirement exists to name.
