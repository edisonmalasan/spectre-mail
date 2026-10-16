# Branding check — design

## D1 — Nothing is renamed, and the document says so as a decision with a date

The six checks were run. Every operational check came back clean and the `.com` is held. A
change whose review concludes *"the name stands"* is still a change, and the temptation is to
record nothing and move the cursor.

**The record is the deliverable, because a check whose verdict is not written down will be
re-litigated by the next reader who cannot see the six checks were ever run.** Nobody in this
repository's history has run them, there is no artefact, and `docs/ROADMAP.md`'s status line
still says the name is a codename. A verdict with no artefact is a claim.

## D2 — The instrument is a map of surfaces, not a scan for the string

**The naive rule for this change is a scan: forbid the literal `SpectreMail` outside one
exported value.** It cannot work, for three reasons, and each is a reason this repository has
already recorded somewhere else.

**It cannot tell the name from a sentence.** `"SpectreMail could not read its own storage"`
(`popup-copy.ts:31`) and `"Guerrilla Mail is asking SpectreMail to slow down"`
(`MailboxFailure.tsx:37`) both contain the name and neither is the name. A scan that requires
every occurrence to *equal* the constant fails on correct copy; a scan that only requires every
occurrence to *contain* it passes on a rename that missed half the surfaces. **The property is
about eight places where the product names itself, and it is not expressible as a property of
occurrences.**

**It would fire on the tests' own fixtures.** `apps/web/e2e/sections.spec.ts:457` plants
`"A SpectreMail extension is on its way."` into the running page as a negative control. That is
the **fifth** recorded instance of this shape — a scan reporting a file for content the file
holds *about the scan* — and the fourth is `security-surface-review`'s D1, which chose a
test-owned map for exactly this reason.

**So: a test-owned map of surface → expected rendered value, asserted in both directions.**
Every surface in the map must render the one name, and every place in the shipped tree where
the product names itself as the product must be in the map. That is the `privacy-disclosure`
shape, which is already the precedent in this repository for "named exhaustively, and in both
directions".

## D3 — The name is one exported value in `packages/ui`, and the package's own doc decides it

This change did not choose the package by taste. `packages/ui/src/index.ts` already states the
rule that settles it:

> *"Moving components into a shared package before anything needs them shared risks freezing an
> API shape no second client ever agreed to. **Tokens are different: a palette is shared by
> definition and its interface is data, not behaviour.**"*

**A product name is shared by definition** — two clients, three build inputs — **and it has no
shape to freeze**, because it is a string. So the sentence that defers *components* does not
defer a *constant*, and the sentence that justifies the palette justifies the name beside it.

`packages/core` was considered and rejected: its approved Purpose is *"the model and its
invariants only"*, and a brand name is neither a model nor an invariant.

## D4 — The panel already ships the pattern the other seven surfaces should adopt

This is why D2 is a small change and not a new convention.

`panel-copy.ts:57` holds `title: "SpectreMail"` as a copy constant, and `Panel.tsx` renders
`{PANEL_COPY.title}` in **three** places — one value, three renderings, already correct.
**Ten lines away, `Popup.tsx` spells the same heading as a bare literal three times**, in the
same directory as a `popup-copy.ts` that exists.

So the requirement is not "this repository should centralise its product name". It is **"the
extension's surfaces render the one public name"**, and the pattern to copy is one this
repository already wrote. A requirement that generalises an existing correct instance is
narrower, falsifiable and harder to misread than one that asks for a new idea.

## D5 — The three build inputs are read from disk, because nothing imports them

`manifest.json`, `index.html`, `popup.html` and `sidepanel.html` are **build inputs**. No module
imports them, so "renders the one name" cannot be checked by importing a constant and comparing.
It is checked by **reading the file** and comparing its content.

That is a different mechanism from the other four surfaces and the requirement says so. **A
build input that no module imports is exactly where a rename is most likely to be missed** — it
is not in the TypeScript graph, so a reviewer editing components will never see it.

**The manifest carries the name twice, in two different keys, and nothing requires them to
agree.** `name` is the extension's listing name in the store; `action.default_title` is the
toolbar tooltip. They are the same string today by coincidence of authorship, and a rename that
changed one and not the other would ship a store listing named one thing and a toolbar named
another — with every test in the repository green, because no test can see a store listing.

## D6 — Three of the six checks produced no measurement, and that is what the document records

The roadmap asks for a **basic trademark risk check**, a **social handle check** and a
**Chrome Web Store search**. Measured:

| check | instrument | result |
| --- | --- | --- |
| Chrome Web Store | the real page in real Chromium, driven by Playwright | **0 results.** The store's own sentence: *"No search results"*. Control `1password` rendered **9 cards** with names read, so the reader can see results when there are any. |
| Trademarks | `tmsearch.uspto.gov` driven through its own search box | **NO MEASUREMENT.** The control `SPECTRE` — which certainly has filings — never resolved: the page printed both `170 results` and `0 results` for the same query, and later refused to load `#searchbar` at all across four attempts. EUIPO's eSearch has no documented exact-word route, TMview's endpoint closes the socket, and WIPO's Global Brand Database is behind an anti-bot proof-of-work challenge. |
| Social handles | HTTP against each platform's own "does this identifier exist" answer | **Partial.** GitHub, npm, PyPI, crates.io, RubyGems, Packagist, Docker Hub and Mastodon all answer `404` — each platform's own "this does not exist". **Bluesky answers `400` on a known-good control handle, so it is no measurement.** Product Hunt returns `HTTP 200` with **exactly 16 occurrences of the query string for a nonsense query**, so its search page is echoing the query rather than answering it — **no measurement.** |

**A control that does not resolve means the reader is not established, and an unestablished
reader's zero is not a finding — it is the absence of a measurement.** The trademark and social
checks are therefore recorded as unmeasured, with the reproduction, and **the document forbids
itself a green tick for them.**

This is the same rule this repository already applies to provider terms it could not verify, and
it is why the review's *headline* is the `.com` and not a clean bill of health.

## D7 — The finding that was nearly missed, and it is the transferable part

`spectremail.com` returns **no A record**. `Invoke-WebRequest` answers *"No such host is
known"*, `Resolve-DnsName` answers no A record, and a conventional availability check built on
either would report the domain as **available**.

The registry's own RDAP endpoint answers **HTTP 200**: registered **2020-06-03**, expires
**2027-06-03**, last changed **2026-08-17**, **no nameservers**.

**A domain registered with no nameservers resolves nowhere, so every availability check built on
DNS reports it as free.** The two instruments disagreed and the disagreement was the result.
RDAP answers the question that was asked; a resolver answers a different one, and answers it
confidently.

This is the fifth recorded instance of the shape *"a substitute platform answering about the
wrong question"*, and the first one where the substitute was **DNS itself**.

## D8 — What the change predicts, so that the predictions are falsifiable

- **`packages/storage` stays at 86** with an empty `git diff --stat`. **Its name occurrence is
  prose inside two error messages**, and this change touches neither.
- **`packages/mailbox`, `packages/providers` and `packages/core` are unmoved.**
- **`tests/architecture/boundaries.test.ts` stays at 53.** Three properties are introduced and
  every one of them already has an instrument or gets one here; **a rule added where an
  instrument exists is not coverage.**
- **`packages/ui` rises**, because the exported name and its own cases live there.
- **`apps/web` and `apps/extension` both rise**, because the popup's three literals become one
  reference and their tests change with them.

**The count that matters is not any of those. It is the surface map: eight surfaces today, and
the requirement is falsifiable in both directions — remove a surface from the map and a case
fails, and add one to the tree without adding it to the map and a case fails.**

## D9 — What this change cannot establish, stated rather than smoothed over

- **No trademark position of any kind.** Three of the six checks produced no measurement. A
  reader who wants one needs a professional search, which is not a build step.
- **Nothing about the `.com` holder.** The company directory's description is a **secondary
  source**, and its one claim this repository could test — that the domain resolves — the
  registry contradicted in the way described in D7. Its *other* claims, including that it is
  "a cloud-based email management app", are unverified and are cited as its description rather
  than as a fact.
- **The counts are a property of this tree on this date.** Domains expire; stores and handles are
  claimed and released. The document carries the date on every figure for that reason, and the
  review is a record of one day rather than a standing clearance.
- **`openspec/specs/visual-system` says nothing about the name**, so the requirement is filed
  against the two clients that render it. Widening `visual-system` would be a fourth capability
  for a value it does not constrain today, and this change has no measurement that would
  justify it. Recorded as a gap, not filled.
- **`tests/architecture/` has no `tsconfig.json` and is not a workspace member**, so
  `pnpm typecheck` checks neither architecture file. That is the standing limit on what
  `pnpm verify` establishes here and it is not repaired here.
---

# Apply-stage record

_Recorded 2026-10-16 during the implementation of this change on `feat/branding-check`. Everything
below is a measurement taken at this stage, and every figure was re-measured rather than carried._

## D10 — The surface map was **eleven rows**, not eight, and the three extras are this change's finding

**D8's prediction of eight surfaces is right about surfaces and wrong about rows, and the difference is
the whole finding of task 5.3.** The exhaustive scan the instrument runs found three places the
proposal's table did not name:

| the missing site | what it is | why the table missed it |
| --- | --- | --- |
| `apps/extension/src/main.tsx:81` | the popup's `<h1>` in the branch taken when this client's storage could not be read | the table counted `Popup.tsx`'s three headings and never asked who else renders one |
| `apps/extension/src/panel-main.tsx:117` | the panel's `<h1>` in the same branch, rendering the value **directly** rather than through `PANEL_COPY` | the table said the panel's title is `panel-copy.ts`'s constant, which is true of `Panel.tsx` and not of the panel's entry module |
| `packages/ui/src/name.ts:55` | the value's own declaration | a map of *surfaces* has no row for where the name is **declared** |

**So: eight surfaces, thirteen sites, eleven rows, and `SURFACE_COUNT = 11`.** Rows and surfaces are
different numbers and both are true; the document states the convention rather than leaving a reader to
infer which one the count means.

**The declaration is a row because the requirement's operative clause is that the name is declared
*exactly once*.** A second declaration is a rename that half happened, and a map of renderings could not
see one.

**Both `main.tsx` and `panel-main.tsx` were outside the implementation stage's stated write scope, and
both were put to the root orchestrator before either was edited** — the finding, the two lines, and the
reason the requirement could not hold without them. The scope was extended. Recording that is the point: an
agent that quietly widened its own scope to make a gate green has done the thing this change exists to
prevent.

## D11 — `tsconfig.base.json` needed one line, and the first consumer of `packages/ui`'s entry point found it

**The five imports this change added are the first consumers any client has ever had of
`@spectre-mail/ui`'s TypeScript entry point** — today a client imports only `@spectre-mail/ui/tokens.css`.
With them added, `apps/web` and `apps/extension` typechecked red:

```
../../packages/ui/src/pairs.ts(31,73): error TS5097: An import path can only end with a '.ts'
extension when 'allowImportingTsExtensions' is enabled.
```

**Cause, measured by stashing the change rather than argued:** `pairs.ts`, `design-doc.ts` and
`tokens-css.ts` deliberately use explicit `.ts` specifiers so `node scripts/emit-design-doc.ts` resolves
them, `packages/ui/tsconfig.json` is the only project enabling `allowImportingTsExtensions`, and
`index.ts` re-exports `./pairs` — so any client importing the barrel compiles that file under its own
tsconfig.

**The fix is one line in `tsconfig.base.json`**, authorised by the root orchestrator: every project
already sets `noEmit: true`, which is TypeScript's other precondition for the flag. `packages/ui`'s own
copy stays, because its comment records why the emitters need it.

**`pairs.ts` could not be changed instead**, and the reason is a test rather than a preference:
`design-doc.test.ts:217-230` requires the `.ts` extensions, and the emitters would stop running.

**This is the third recorded instance of a gap that exists only because nothing had yet asked the
question** — `side-panel-runtime-facts`' two never-run cells, `extension-permissions-review`'s "cannot be
separated" claim, and now an export nobody imported. **A package with no consumer of its entry point is a
package whose entry point has never been compiled by a consumer.**

## D12 — Four defects the falsification pass found in the instrument, and what each one cost

**The tally is 11 arms caught by the assertion each was aimed at, with `wrongcatch`, `green`, `noop`,
`nocompile` and `harness-error` all zero**, every file restored byte-identical against a pre-mutation
digest, and `dist/` rebuilt from the restored source. One arm is recorded as evidence rather than
counted, and it is named in the table below. Four defects are worth carrying forward because each
produced a confident wrong answer first.

### D12.1 — A reader that compared an identifier's **name** against the **value** it holds

`nameSitesIn` matched `node.text === PRODUCT_NAME`, where `PRODUCT_NAME` is the imported **string**. The
identifier in the tree is *named* `PRODUCT_NAME`, so the comparison was between two unrelated strings, was
false on every file, and **the reader reported the tree as carrying none of the value on every declared
site.** The failure read as a product defect — which is the direction this repository records most often.
**The export's own name is now its own constant**, `VALUE_NAME`, and the note beside it says why the two
are not one.

### D12.2 — A reader that renamed the file it was parsing

`copyTitleReadsIn` and `copyTitleLinesIn` called `ts.createSourceFile("reads.ts", …)`. **TypeScript
decides whether a source contains JSX from the file name**, so `Panel.tsx` parsed as TypeScript returned
three renderings of `{PANEL_COPY.title}` as three property accesses **whose receiver was an empty
identifier** — and the reader reported three renderings of nothing, with a count. **A reader that renames
its input can silently change the language it is reading**, and the failure reads as an absence rather
than as a defect. Both readers now take the file's real path.

### D12.3 — A direction whose **name** promised more than its **key** could express

Both directions keyed a site on `file` and `line`. An arm that changed a heading from rendering the
reference to spelling the name out **kept its line number**, so the drift direction reported nothing and
the arm came back `wrongcatch`. **A coordinate is not an identity**: what makes a site what it is includes
how it carries the name, so the key carries the form, and a declared-form-to-tree-form table holds the
whole of the translation. The direction is now named "in the declared way" because that is what it
checks.

### D12.4 — An assertion that **could not fail**, found by an arm aimed at a control query

The unmeasured check originally read: some row begins with `unmeasured`, and no row beginning with
`unmeasured` carries a verdict word. **Those two conditions can never both hold of one row** — a row
carrying a verdict does not begin with `unmeasured` — so the second could only fire on a result cell
reading `unmeasured … clear …`, which is a sentence nobody writes. **An arm that gave an unmeasured row
the verdict `clear` left the whole suite green.**

**The repair was the claim rather than the check**: the review now carries a **table of the checks it
could not measure**, and the case compares that table with the check table in both directions. Moving a
check out of the list, or giving its result cell a verdict, reports it by name. **This is task 6.6's shape
exactly** — a reader whose control never fails is the failure mode D6 is about, and here the control was
the instrument's own.

## D13 — Two more findings, one of which is in this repository's own shipped code

**8 of the 108 substring occurrences are the identifier `SpectreMailboxes`** — the storage contract's own
type name, which begins with the product's name. **A substring count of the product's name is therefore
not a count of the product's name**, and the name itself appears **100 times** before this change and
**96** after. This is D2's third reason, measured in the tree D2 was written about.

**The recorded 58 is right and the reader that produced it is wrong, which is the more useful half.** The
stripper removes line comments and block comments and holds no state for a string literal, and read
against a classification reader it is **wrong on three of the 49 files** — `Panel.tsx`,
`MailboxLifetime.tsx` and `Wordmark.tsx`, where a JSX comment container holds the name and its
block-comment pass runs past it. **Its errors cancelled and it landed on the correct total.** So the total
is a measurement and the reader is not established, which is the same shape as the unmeasured rows in the
review's own check table.

**Task 1.7 named two files the comment stripper could not vouch for. Measurement says otherwise, and the
correction is in `docs/BRANDING.md` §6.1**: on `LocalData.tsx` and `useMailboxSession.ts` the two readers
**agree** (2 of 3 and 0 of 4), and the three files the stripper actually fails on are the three above.

**Two readers were wrong while producing that table, and both defects are recorded because each produced
a confident answer.** The first took comments as the complement of every node's span and reported **zero
comments in `LocalData.tsx`** — a file that opens a JSDoc carrying the name on line 109 — because
`getStart()` skips leading trivia, so a JSDoc above an interface member sits inside its interface's span.
**It was wrong in the direction that makes a file look clean**, which is the direction a document then
quotes. The second used the scanner's comment ranges and **bucketed everything left over as code**, and
the leftover was 11 occurrences of which only 8 were code: the other 3 were JSX comment containers.
**A reader with a residual bucket hides its own blind spot.** The reader that shipped assigns a kind to
every occurrence and counts the ones it cannot classify; that count is **0**.

## D14 — The gates, each measured

| gate | result |
| --- | --- |
| `pnpm verify` ×3, with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory created and measured empty immediately before and immediately after | **exit 0, 0, 0**; browser directory **0 entries before and 0 after** |
| `pnpm verify` ×3 again, after the falsification pass | **exit 0, 0, 0**; browser directory **0 before, 0 after** |
| `pnpm test:browser` | **5 of 5 green**, then **2 of 2 green** after the falsification pass, every run at **40 website and 98 extension**. The reader classifies a run with fewer than two tier summaries as `HARNESS-ERROR`, and reads no count out of the summary parentheses — which hold a **duration** (`11.6s`, `1.1m`) |
| `pnpm test`, counted from a `--reporter=json` run **grouped by project** | **1308 passed, 0 failed across 66 files**, against a baseline measured the same way at **1290 across 64** |
| `openspec validate branding-check --strict` | **valid** |
| `pnpm prettier --check .` | **clean** |
| `git diff --stat` over `packages/storage`, `packages/mailbox`, `packages/providers`, `packages/core`, `Panel.tsx`, `manifest.json` | **empty in every case** |

**The per-project figures, measured not transcribed**, and the baseline is a `git stash` of this change
measured with the same reporter:

| project | baseline | after |
| --- | --- | --- |
| `packages/ui` | 38 across 4 files | **42 across 5** |
| `apps/web` | 125 across 6 | **125 across 6** |
| `apps/extension` | 487 across 21 | **487 across 21** |
| `packages/storage` | 86 across 7 | **86 across 7** |
| `packages/mailbox` | 166 across 5 | **166 across 5** |
| `packages/providers` | 92 across 7 | **92 across 7** |
| `packages/core` | 54 across 6 | **54 across 6** |
| `tests/architecture` | 93 across 3 | **107 across 4** |
| **total** | **1290 across 64** | **1308 across 66** |

**`apps/extension` is 487, and `AGENTS.md` carries both 487 and 465 for it.** The 487 is what this change
measured on the pre-change tree; the 465 is what the same file's security-review paragraph claims. **The
per-file list in that file's Testing block sums to 487**, so the narrative figure is the stale one. **It is
not corrected here** — task 8.6 says `AGENTS.md` is not written by this stage — and it is reported rather
than left, because a reader who copies the stale figure computes this change's delta wrong.

**The arithmetic accounts for all eighteen**: `packages/ui` **+4** (the value's own cases) and
`tests/architecture` **+14** (the instrument), **+4 and +14 = +18**, and **64 + 2 = 66** files.
**`boundaries.test.ts` is 53, counted by reading that suite's own source through the TypeScript parser**
rather than by typing the number, which is task 7.3's claim made by the suite rather than by a note.

## D15 — The falsification table

**`wrongcatch`, `green`, `noop`, `nocompile` and `harness-error` are all zero.** The harness lives outside
the repository, self-tests its own readers before any tally is taken, and refuses to run when that
self-test fails — which it did once, on its own ninth case, and the repair was the case.

| arm | file | assertion it was aimed at | outcome |
| --- | --- | --- | --- |
| A01 | `packages/ui/src/name.ts` | the value is one word with no surrounding whitespace | **caught** |
| A02 | `apps/extension/src/Popup.tsx` | every declared site is a place the tree still carries the name, in the declared way | **caught** |
| A03 | `apps/extension/src/panel-copy.ts` | every declared surface renders the one public name | **caught** |
| A04 | `apps/extension/static/manifest.json` | the manifest's two name fields are the same string | **caught** |
| A05 | `apps/web/index.html` | every declared surface renders the one public name | **caught** |
| A06 | `apps/extension/src/Panel.tsx` | the panel's three renderings of the copy constant are left in place | **caught** |
| A12 | `apps/extension/src/App.tsx` | no place in the shipped tree carries the name without being declared | **caught** |
| A07 | `tests/architecture/branding-audit.test.ts` | the name-or-copy reader classifies a known rendering and a known sentence | **caught** — **task 6.6**: a control query whose expected outcome flips |
| A08 | `docs/BRANDING.md` | every check carries a date | **caught** — **task 6.6**: a control's expected value ceases to be a date |
| A09 | `docs/BRANDING.md` | a check declared unmeasured carries no verdict | **caught** — **task 6.6**, and this arm is what found D12.4 |
| A10 | `tests/architecture/branding-audit.test.ts` | every declared site is a place the tree still carries the name | **caught** |
| A11 | `packages/ui/src/name.ts` | — | **evidence**: a reformat that changes no behaviour, 1308 passed. Recorded rather than counted, per the rule that a survivor means the assertion did not catch this and never that the assertion is too weak |

**Five arms came back `noop`, `wrongcatch` or `green` on earlier runs, and every one of them was a defect
in the harness rather than in the product.** They are recorded because the pattern is the point:

- **Three `noop`s: one ambiguous anchor and two absent ones.** The ambiguous anchor was `Panel.tsx`'s
  heading, which occurs **three times**; the absent ones were markdown table cells that **Prettier had
  re-padded** after the anchors were written. **A mutation that did not apply is not evidence**, and the
  harness refused to report a catch rather than inventing one.
- **One `wrongcatch`, A02, twice.** The first version aimed it at the unmapped direction; the mutation is
  on a site the map still declares, so the unmapped direction correctly stayed quiet and the drift
  direction should have spoken — and could not, which is D12.3.
- **One `green`, A09**, which is D12.4 and the most useful result in the table.

**The harness's own self-test failed on its first run, and it was the reader's case that was wrong.** Its
ninth case compared a file's digest with itself across a comma expression, so the left-hand reading was
taken while the file was still changed — a self-test comparing a thing to itself and reporting FAIL for a
reader that was right. **The repair was the case and not the reader**, which is the rule this repository
applies to a survivor.

**One instrument hazard this stage produced in itself, and it is the one task 6.4 names.** The first
invocation passed `--self-test` **before** the positional arguments, so the harness resolved its temporary
directory to the **repository root** and wrote its scratch file there. `git status` showed it, it was
deleted, and **`pnpm lint` and `pnpm verify` never saw it** — which is luck rather than design, and the
reason the check is `git status` and not "did anything look wrong".

## D16 — What this stage did not establish

- **`tests/architecture/` has no `tsconfig.json`**, so `pnpm typecheck` checks neither this change's
  instrument nor the other two. D9 records the limit; this stage records that it is still standing and
  that nothing here was repaired on the strength of this change.
- **The external checks were not re-run.** `docs/BRANDING.md` is a record of 2026-10-16 and this stage
  added no network access. The instrument checks what the document claims about the tree, and nothing else.
- **No surface was read in a browser.** The values are checked by reading files and by parsing source; no
  test here reads a rendered pixel, so whether any surface *looks* right is still a human judgement, which
  is the same fourth limit `pnpm test:browser` carries for every other change in this repository.