# Design

## The gap, in one sentence

**Every part of this product that a person could be handed is missing, and the one that is
explicitly forbidden is forbidden by a requirement that was right when it was written.** Measured on
`main` at `e6c1899`: the extension's manifest declares no icons, no command produces an archive, the
website's document declares nothing but its title, and `docs/` holds no release procedure — while
`extension-client` *requires* `manifest.icons` to stay `undefined`.

## D1 — The placeholder icon is a promoted requirement, so it is amended rather than worked around

`extension-client`'s notification requirement ends its second apply-stage amendment with *"and
`manifest.icons`/`action.default_icon` staying `undefined`, so the icon is reachable only from a
notification"*. That was a correct reading while an icon had exactly one consumer, and it is quoted
in `manifest.spec.ts` as the pair of assertions that hold it.

**A change that added icons without touching that sentence would leave `openspec/specs/` forbidding
what `static/manifest.json` does.** That is the one failure mode this repository treats as worse than
a defect, because the specification is the source of truth a later reader reconciles against. So the
block is **`MODIFIED`**: the clause is replaced in the body, an amendment note records what it read
before and why it changed, and **all six scenarios are carried forward byte for byte** — the block in
the delta is the promoted block with that one clause replaced, extracted programmatically rather
than retyped.

**The property the old clause held is kept rather than traded.** What it protected was *"the icon a
notification is given is a real raster file the build carries, and a build without it fails"*. That
is now stated as: the notification's icon is a member of the family the manifest declares, the built
output carries every member, and the browser suite fails naming a missing one. **The file is the same
file**; only its reachability changed.

## D2 — One family, four sizes, one directory, and the 128 is the shipped file

The extension already ships `static/icon.png`: 128×128, 307 bytes, two colours, the accent from the
token layer. It is **moved**, by `git mv`, to `static/icons/icon-128.png`, and the three smaller
sizes are derived from it.

**Why four and not one.** Three surfaces ask for three different sizes — a toolbar (16/32), an
extensions page (48), and a listing (128) — and a 128 scaled down by the platform is a different
image from one drawn at the size it is shown. Chromium accepts a single size and scales it; that is
the behaviour this change declines, because the product's mark is three rectangles and a scaled-down
three-rectangle glyph is exactly the case where nearest-neighbour artefacts are visible.

**Why one directory, and what a second icon would cost.** `manifest.icons` naming
`icons/icon-128.png` and `NOTIFICATION_ICON_FILE` naming something else would be the second spelling
of a set — this repository's most-recorded defect — and the two would drift the first time the mark
changed. `NOTIFICATION_ICON_FILE` becomes `icons/icon-128.png`, which is **the same file**
`manifest.icons` names at 128.

**What this does not claim.** Nothing here says a person judged the derived sizes. The 16 is a
nearest-neighbour-ish reduction of a three-rectangle glyph; what is asserted is that each file is a
PNG of the declared dimensions, that every one carries the accent the token layer declares, and that
one missing is reported by name. **The 128 is byte-identical to what shipped**, which is what makes
this a move rather than a redraw.

**How the smaller sizes are produced is recorded rather than hidden.** They are generated once, by a
throwaway script using `System.Drawing` on this machine, and committed. **No build step regenerates
them**, because a generated icon whose generator is not in the repository is an artefact nobody can
reproduce — and putting an image pipeline in the build would add a dependency for four static files.
The cost is stated: if the mark changes, the four files are redrawn by hand and the instrument that
compares colours and sizes is what notices a partial update.

## D3 — The website's icon is a data URI, because the page is required to draw without fetching

`apps/web/e2e/sections.spec.ts` asserts that the built page requests **no image and no font file**,
by filtering every recorded URL on `/\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|eot)$/i`. That
case exists because the brand mark must be *drawn*, and it was written after a proxy assertion
survived a mutation: `<image href="/mark.svg">` inside the `<svg>` is not an `<img>`.

**So a favicon file would make that case fail, and that is the case being right.** A tab icon fetched
from `/favicon.svg` is a request made in order to draw something, which is the exact property the
case holds. **The document therefore declares `data:image/svg+xml,…`** — a URI the browser decodes
without a request — and the existing case is not edited.

**A data URI is stricter than `visual-system` requires, not looser.** `visual-system` forbids a
third-party asset and permits the page's own resources; a data URI requests nothing at all. And
`visual-system` already describes the mark as *"a drawn glyph, not an asset"*, which is the same
sentence in the other direction.

**The duplication this creates is held by an instrument rather than by hope.** The SVG path data now
exists twice — `BRAND_MARK_PATH` in `apps/web/src/sections.ts` and the literal inside
`index.html` — and a build input cannot import a module. `tests/architecture/document-metadata.test.ts`
reads the document, decodes the data URI, and requires its path data to **equal** the imported
constant; a second drawing that happens to look similar fails. That is the same arrangement the
title already has with `PRODUCT_NAME`, and it is the only arrangement available for a file no module
reads.

**Why not inject the icon at build time from the constant.** A Vite HTML transform would make the
document's content depend on a plugin, and the repository's own rule for the title is the opposite:
spell it in the file and hold the file to the value by reading it. A transform would also make the
shipped document unreadable as the artefact a browser receives.

## D4 — The description is written from `PRODUCT.md`, and the instrument checks form rather than truth

The description is one sentence, and its source is `PRODUCT.md`'s Product Purpose: *"SpectreMail gives
a person a temporary email address and lets them read what arrives at it, so they can complete a step
that demands an email without disclosing a real one."* The shipped sentence is a compression of that,
not a new claim.

**An instrument cannot check whether a sentence is true, and this change does not pretend one can.**
What `document-metadata.test.ts` checks is: exactly one `<meta name="description">`; non-empty
content; not equal to the product's name alone; **one sentence**; and no exclamation mark. Those are
properties of the shape of a description. **Whether it is a good sentence is a human judgement, and
it is recorded as one** — no test in this repository reads a rendered pixel or judges copy.

**Why not hold the description to an exported constant as well.** The title has a constant because the
name is *shared* — the extension's popup, panel and manifest all render it. A description has one
consumer, the document, so a constant no module reads would be a record with no consumer, and the
repository's own rule for `SpectreMailBoxes` was that a record with no consumer is a schema to
migrate rather than a feature.

## D5 — The archive is written by a dependency-free ZIP writer, and read by a separately written reader

A store accepts one shape: a ZIP whose root holds `manifest.json`. Producing it needs a ZIP writer,
and the options were measured rather than assumed:

- **`Compress-Archive`** is PowerShell. It does not exist in CI's Linux runner and it prefixes a
  directory. **It would produce a valid archive on this machine and nowhere else.**
- **`archiver` / `adm-zip`** is a new dependency for a step that runs once per release. The build
  requirement prefers a tool already in the lockfile.
- **Node's `zlib` plus the ZIP container by hand** is ~150 lines, has no dependency, and is
  **deterministic** in a way a library's defaults are not.

**Determinism is a requirement, not a nicety**, and it is where a hand-rolled writer earns its place:
a library writes each entry's DOS timestamp from the file's mtime, so two runs over the same build
output produce different bytes. **The writer writes a fixed timestamp** and sorts entries by name, so
two runs are byte-identical. **The one limit is stated**: byte-identity is claimed across two runs on
the same machine and the same `zlib`; it is not a claim about two different zlib builds.

**The reader shares no code with the writer**, because a tool that checks its own work cannot report
its own defect — the rule this repository learned when a promoter logged a deletion it never
performed. `packaging.test.ts` parses the **central directory**, checks every local header's
signature, **recomputes each CRC-32 from the decompressed bytes**, inflates with
`zlib.inflateRawSync`, and compares the result to the file on disk. **A reader that could not parse a
central directory would report no entries, so the case plants one and requires it to be found.**

## D6 — The archive is proved to be an extension, in a browser, and not only to be a valid ZIP

A valid ZIP is not an extension. The difference matters because the failure is silent in the
direction this repository cares about: Chromium reports **no error** when an extension fails to load,
which is recorded twice in this repository's history.

So the extension's browser tier gains one case that **runs the packaging command, extracts the
archive, and loads the extracted directory as an unpacked extension** — then reads the built popup's
document. That is the only instrument that answers *"is this archive the product?"* rather than
*"are these bytes a ZIP?"*. **Extraction is done by the test's own reader**, so the archive is read
twice by two independent readers: once by the unit-tier parser and once here.

**What it does not establish.** Nothing about a store's review, signing, or the Chrome Web Store's
own validation. Nothing about a headed browser. It establishes that the archive's contents load.

## D7 — The build cleans its own output, because an archive made the stale-output defect load-bearing

Both Vite configs set `emptyOutDir: false`, and the popup config's comment says *"Each build cleans
its own kind of output instead"* — **which neither build does.** The setting disables cleaning, and no
step anywhere removes a previous artefact. `AGENTS.md` records the consequence as a measured defect:
a stale `content-script.bundle.js` survived a restored source **and** a correct rebuild beside it, and
was read as evidence about a mutation long after it was built.

**Until now the cost was a confusing local tree.** With an archive it becomes a shipped file: the
packager reads `dist/`, and `dist/` may hold a chunk no current build emits. **A release that ships
yesterday's bundle is worse than one that refuses.**

So the extension's `build` script gains a clean step before the two Vite builds, and
`vite.content.config.ts` keeps `emptyOutDir: false` because it runs second and must not delete the
popup's output. The clean is a function with the directory as a parameter, so a unit case can point
it at a temporary directory, plant a file, and require the file to be gone — **without a test ever
touching the shipped `dist`**. The comment that claims a clean that does not happen is corrected
rather than deleted.

## D8 — Packaging is not part of `verify`, and the artefact is not committed

`pnpm verify` runs **with no browser installed** and is the gate every change runs. A packaging step
inside it would: write a file nobody verified, make the gate depend on the order of two builds, and
change what `verify` means for every future change. **So packaging is a client-local command and
nothing else.** The archive directory is named in `.gitignore`, because a committed build output is a
second copy of the product that no gate re-derives.

**The archive's filename carries the version, and the version is read from the built manifest.** That
is the only place a version exists in this repository; a second copy in a script, a document or a
filename typed by hand would be the second spelling of a set. The command derives
`spectre-mail-<version>.zip` from the manifest it reads, so the artefact names itself with the value
the store will read.

## D9 — `docs/RELEASE.md` is a procedure that says what each gate does not establish

The document is not a checklist. It is the answer to *"what do I run, and what does a green run
mean?"* — which today can only be reconstructed from `AGENTS.md` plus six archives.

**It names four gates and their holes**, because each is a different hole and a single sentence
would collapse them: `pnpm verify` runs without a browser; the browser tiers run without a live
provider; the adapters are driven by recorded responses; and no test reads a rendered pixel. **A
procedure that reported all four as "passing" would be describing four absences as one clean
result**, which is the defect `build-and-verification` names.

**It names the two steps this repository cannot take** — a deploy target and a publishing account —
as outstanding, which is how §33.2 already records them. **And it carries no version and no date as
though either were generated**: the version is the built manifest's, and a date in a procedure is
true only on the day it was written.

`release-record.test.ts` resolves every command the document names against the repository's own
`package.json` scripts, so a renamed script cannot leave the procedure naming a command that does not
exist. **The check reads the scripts rather than a list of its own**, which is the rule
`manifest.spec.ts`'s permission map already follows.

## D10 — README and the roadmap are corrected because the change is measured against them

Three figures this change relies on are stale in `README.md`, and one archive PR number is unwritten
in `docs/ROADMAP.md`:

- the capability table says **190 / 629**; the promoted tree is **196 / 652**;
- four rows are behind: `provider-adapters` 12 / 30 → **12 / 32**, `extension-client` 17 / 86 →
  **22 / 101**, `visual-system` 9 / 28 → **10 / 32**, `website-client` 26 / 88 → **26 / 90**;
- `docs/ROADMAP.md` says the archive PR number for `guerrilla-liveness-detection` is unfilled, and
  `gh pr view 204` reports it merged.

**And the README sentence *"No deployment, hosting, or release pipeline exists or is planned for
V1"* becomes false in one direction and stays true in another**, so it is corrected rather than
deleted: a packaging command and a release procedure **will** exist, and no deployment, hosting or
publishing job will. **A sentence that conflates "no artefact" with "no deploy" would have to be
rewritten twice otherwise**, and the second rewrite is how a document ends up claiming a pipeline it
does not have.

## D11 — What this does not establish

- **Nothing about a store's acceptance.** The archive's shape is checked against the platform's
  documented requirements and against Chromium loading its contents; **no archive here has been
  submitted to the Chrome Web Store**, and the criteria a review applies are not reproducible.
- **Nothing about how the icons look.** No test reads a rendered pixel. The sizes, the PNG structure
  and the accent are measured; whether the 16 reads as the mark is a human judgement.
- **Nothing about the deployed website.** There is still no host, no deploy and no URL.
- **Nothing about a signed or published extension.** There is no developer account and no listing.
- **Nothing about the `extension-client` requirement's other five scenarios changing.** They are
  carried forward; the promotion is the instrument that proves it.
