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