# Branding check

## 1. The headline: the domain is taken, and DNS says it is free

**`spectremail.com` is REGISTERED. It has been since 2020-06-03, it expires 2027-06-03, it was last
changed 2026-08-17, and it has no nameservers at all.**

**The way that was nearly missed is the transferable part, so it leads rather than footnotes.** A
resolver asked whether the domain is available answers _yes_, and answers it confidently, because it
cannot resolve the domain at all: `Invoke-WebRequest` returns _"No such host is known"_ and
`Resolve-DnsName` returns no A record. **Every conventional availability check is built on one of
those two answers, so every one of them reports a registered domain as free.**

The registry's own RDAP endpoint answers `HTTP 200`, and it answers the question that was actually
asked:

| field             | value      |
| ----------------- | ---------- |
| registration date | 2020-06-03 |
| expiry date       | 2027-06-03 |
| last changed      | 2026-08-17 |
| nameservers       | **none**   |

**Two instruments disagreed and the disagreement was the result.** This is the fifth recorded
instance in this repository of _a substitute platform answering about the wrong question_, and the
first where the substitute was **DNS itself**. RDAP answers the question that was asked; a resolver
answers a different one - does this resolve? - and answers it without hesitating.

**This is the review's one loss, and it is the one a temporary-mail product cannot do without.** Every
operational check came back clean (§2), so the name itself stands: what is taken is the `.com`, and
choosing a domain is M13's decision, not a branding question.

## 2. The six checks, each with its instrument, its control, and its date

**Every row below was measured on 2026-10-16 against the sources themselves** - not against a search
engine's summary of them. **The control column is not decoration: it is what decides whether a
reported zero is a finding.** A reader whose control query did not resolve cannot distinguish
"nothing is there" from "I found nothing", and a zero from such a reader is the absence of a
measurement.

| check                                                                                    | instrument                                                           | control                                                                                      | measured on | result                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name collision — GitHub, npm, PyPI, crates.io, RubyGems, Packagist, Docker Hub, Mastodon | HTTP against each platform's own "does this identifier exist" answer | a known-taken identifier on each platform, which returned that platform's own "taken" answer | 2026-10-16  | clear — all eight answer their own "this does not exist"                                                                                                                                                                                                                                                                                              |
| Firefox Add-ons search                                                                   | the addons.mozilla.org add-on list, read whole                       | the same list read for a control name that is published                                      | 2026-10-16  | clear — 0 of 924 add-ons carry the name in a name or a slug                                                                                                                                                                                                                                                                                           |
| Chrome Web Store search                                                                  | the real search page in real Chromium, driven by Playwright          | `1password`, which rendered 9 cards with their names read                                    | 2026-10-16  | clear — the store's own sentence, "No search results"                                                                                                                                                                                                                                                                                                 |
| domain check                                                                             | the registry's own RDAP endpoint                                     | DNS: `Invoke-WebRequest` and `Resolve-DnsName`, which both report it free                    | 2026-10-16  | loss — registered 2020-06-03, expires 2027-06-03, last changed 2026-08-17, no nameservers                                                                                                                                                                                                                                                             |
| basic trademark risk check                                                               | `tmsearch.uspto.gov`, driven through its own search box              | `SPECTRE`, which certainly has filings                                                       | 2026-10-16  | unmeasured — the control never resolved: the page printed both `170 results` and `0 results` for the same query, and later refused to load `#searchbar` across four attempts. EUIPO's eSearch has no documented exact-word route, TMview's endpoint closes the socket, and WIPO's Global Brand Database is behind an anti-bot proof-of-work challenge |
| social handle check                                                                      | HTTP against each platform's own identifier answer                   | a known-taken handle on each platform                                                        | 2026-10-16  | unmeasured — two of the ten could not be read at all. Bluesky answers `400` on a known-good control handle. Product Hunt returns `HTTP 200` carrying exactly 16 occurrences of the query for a nonsense query, so its search page echoes the query rather than answering it. The other eight are in the first row                                     |

**Three of the six checks produced no measurement, and this document attaches no verdict to any of
them.** A "basic trademark risk check" that cannot be run from here is recorded as unmeasured rather
than reported as a pass. This is the same rule this repository already applies to provider terms it
could not verify, and it is the reason the review's headline is the `.com` and not a clean bill of
health.

### 2.1 The checks this review could not measure

**This table is the list, and it is a table rather than a sentence because the instrument has to compare
it with the one above in both directions.** A reader that only asked "does any row say unmeasured and
also say a verdict" could not fail: a row carrying a verdict does not say unmeasured, so the two
conditions can never both hold of one row. **That was measured, not argued** - an arm that gave an
unmeasured row the verdict `clear` left the whole suite green. Declaring the list as data is what makes
the claim falsifiable in both directions.

| check                      | why the control did not resolve                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| basic trademark risk check | the control `SPECTRE`, which certainly has filings, never resolved: the page printed both `170 results` and `0 results` for the same query, and later refused to load `#searchbar` across four attempts. EUIPO's eSearch has no documented exact-word route, TMview's endpoint closes the socket, and WIPO's Global Brand Database is behind an anti-bot proof-of-work challenge |
| social handle check        | eight of the ten platforms answered their own "this does not exist", **and two could not be read at all**: Bluesky answers `400` on a known-good control handle, and Product Hunt returns `HTTP 200` carrying exactly 16 occurrences of the query for a nonsense query, so its search page echoes the query rather than answering it                                             |

**The social handle check is recorded as unmeasured in full rather than partly clear**, and the reason
is worth stating plainly: **eight platforms answered, and a check is not eight-tenths measured.** A
reader whose control did not resolve cannot distinguish "nothing is there" from "I found nothing" on the
two it could not read, so the honest figure for the check as a whole is no figure. **The eight clean
answers stay in the first row of the check table, where they belong, and are not folded into a partial
verdict for a check that did not complete.**

## 3. What the company directory says about the holder, attributed to that directory

**A company directory lists a business of that name at that address, describing itself as "a
cloud-based email management app" whose features include private domains, token assignment to emails,
mailbox creation and syncing, message control, and email statistics.** That is **the directory's
description of a business it lists** - a secondary source, quoted as that source's description and
not as a measurement of anything. Nothing else here has been verified about it.

**And its one testable claim is the claim the registry contradicted.** The directory implies a live
site at that address; the registry says the domain has **no nameservers**, which is a statement that
nothing serves it. Those two cannot both be current, and the registry is the authority on the domain
while the directory is an authority on nothing. **Its remaining claims - the category, the feature
list, the ownership - are unverified, and are recorded here as one directory's words.**

## 4. Nothing is renamed

**The measured finding is that the name stands.** No store, no registry and no handle collision was
found across every check that could be read. The single loss is the `.com`, and **a domain is not a
branding question**: the roadmap schedules domain selection at M13, and no check run here can make
that decision for it.

So this change renames nothing. What it ships is **the record** - so that the next reader can re-run
the six checks instead of inheriting a claim - and **the instrument** that makes _"public branding
should be updated cleanly"_ a property of the tree rather than an aspiration.

## 5. The surface map: every place the product names itself as the product

**Eight surfaces, thirteen sites, eleven rows.** A surface is one thing a person can see or a store can
read - a heading is **one** surface rendered in several branches, which is the convention
`design.md` D4 already used when it counted `panel-copy.ts` plus three `Panel.tsx` renderings as one.
**Rows and surfaces are different numbers and both are true**: a surface rendered by a second mechanism
gets a second row, and the value's own declaration is a row that is not a surface a person sees at all.

**Every site below carries the exported value** `@spectre-mail/ui` publishes as `PRODUCT_NAME`.
`tests/architecture/branding-audit.test.ts` resolves this table against the tree in **both**
directions: every site here must carry the value, and every place in the shipped tree that carries it
must be here.

| surface                                 | file                                  | site                     | rendered                                                                                 | read by                                                                           |
| --------------------------------------- | ------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| the public name's own declaration       | `packages/ui/src/name.ts`             | line 55                  | the exported declaration, as the only place the tree holds the name itself               | the TypeScript parser reads the declaration, and requires there to be exactly one |
| website document title                  | `apps/web/index.html`                 | line 21                  | the document's title element                                                             | the file is read, because no module imports a build input                         |
| website wordmark                        | `apps/web/src/Wordmark.tsx`           | line 58                  | the product region's heading, as a reference                                             | the TypeScript parser reads the heading's expression                              |
| extension listing name                  | `apps/extension/static/manifest.json` | key name                 | the manifest's listing name                                                              | the file is parsed as JSON                                                        |
| extension toolbar tooltip               | `apps/extension/static/manifest.json` | key action.default_title | the manifest's toolbar tooltip                                                           | the file is parsed as JSON                                                        |
| popup document title                    | `apps/extension/popup.html`           | line 13                  | the document's title element                                                             | the file is read, because no module imports a build input                         |
| panel document title                    | `apps/extension/sidepanel.html`       | line 13                  | the document's title element                                                             | the file is read, because no module imports a build input                         |
| popup heading                           | `apps/extension/src/Popup.tsx`        | lines 252, 264, 272      | three headings, one per return branch, each a reference                                  | the TypeScript parser reads each heading's expression                             |
| popup heading, storage-not-ready branch | `apps/extension/src/main.tsx`         | line 81                  | a fourth popup heading, in the branch taken when this client's storage could not be read | the TypeScript parser reads the heading's expression                              |
| panel heading                           | `apps/extension/src/panel-copy.ts`    | key title                | the panel's copy constant, rendered by `Panel.tsx` at lines 716, 729 and 794             | the TypeScript parser reads the property's initializer                            |
| panel heading, storage-not-ready branch | `apps/extension/src/panel-main.tsx`   | line 117                 | a fourth panel heading, in the branch taken when this client's storage could not be read | the TypeScript parser reads the heading's expression                              |

**The site column is a vocabulary, not prose**, so that `tests/architecture/branding-audit.test.ts` can
read it rather than infer it: `line N` is a one-based line, `lines N, N, N` is several, and
`key a.b` is a dotted path into a JSON document. **A site column written as a sentence would leave
the table's central claim unchecked**, which is the whole reason the instrument exists.

**The last two rows and the first are this change's own findings, and they are the reason the table has
eleven rows for eight surfaces.** The proposal's table named eight files and lines and **missed all
three**: the popup's heading is rendered **four** times, not three; the panel's is rendered in **two
mechanisms** rather than one, because `Panel.tsx` renders `PANEL_COPY.title` three times and
`panel-main.tsx` renders the value directly as a different component the copy object does not reach; and
the value's own declaration was not named at all. **It is in the table because the requirement's
operative clause is that the name is declared _exactly once_** - a second declaration is a rename that half
happened, and a table that omitted the declaration could not see one.

**The exhaustive scan that found all three is the same one the instrument runs, and it is the reason the
requirement is written as a direction rather than as a sentence.**

**One surface was already correct before this change, and it is the pattern the other seven adopted.**
`panel-copy.ts` held the name as a copy constant that `Panel.tsx` rendered in three places - one value,
three renderings - while `Popup.tsx` spelled the same heading as a bare literal three times in one
component, beside a `popup-copy.ts` that already exists. **What changed in `panel-copy.ts` is what it
reads and not how it is written**, and the three `Panel.tsx` renderings were left exactly as they were.

**What is deliberately not in this table** is every sentence that merely _mentions_ the name:
`"Use SpectreMail"`, `"Create a SpectreMail address"`, `"SpectreMail could not read its own storage"`,
`"Guerrilla Mail is asking SpectreMail to slow down"`, and the two `packages/storage` error messages.
**Those are correct copy, they are in the modules that own them, and coupling them to one rename
would be a cost with no gain.** This is why the table is a table and not a search: the property is
about eight places where the product names itself, and **it is not expressible as a property of
string occurrences** - which `design.md` D2 argues at length, and which the browser tier's own
planted fixture at `apps/web/e2e/sections.spec.ts:457` demonstrates.

## 6. The name's cost in this tree

**Measured on 2026-10-16, over the shipped tree: files under `apps/` and `packages/`, excluding
test files, excluding `e2e/`, excluding `node_modules/`, `dist/` and `test-results/`.**

| what was counted                             | before this change          | after this change           |
| -------------------------------------------- | --------------------------- | --------------------------- |
| occurrences of the name as a substring       | **108** across **49** files | **104** across **46** files |
| of those, inside string or template literals | **30** across **16** files  | **30** across **17** files  |
| of those, inside JSX text                    | 20                          | 14                          |
| of those, inside comments                    | 50 across 30 files          | 52 across 30 files          |
| **after comments are stripped**              | **58**                      | **52**                      |
| of those, the identifier `SpectreMailboxes`  | 8                           | 8                           |

**Three findings in that table, and the second is the one that matters.**

**The 108 is not 108 occurrences of the name.** **Eight of them are the identifier
`SpectreMailboxes`** - the storage contract's own type name, which merely begins with the product's
name. A substring count of the product's name therefore counts a TypeScript type, and it is the third
recorded instance in this repository of a reader answering about something other than what it was
asked about. **The name itself appears 100 times before this change and 96 after.** Nothing is
renamed, so nothing needed to be: this is a property of the measurement, and it is the reason a
substring count is not a count of the name.

**The 58 is right and the reader that produced it is wrong, which is the more useful half.** The
figure came from a stripper that removes `//` and `/* */` and holds **no state for a string literal
and none for a regular-expression literal**. Read against a classification reader - TypeScript node
kinds for strings, templates, JSX text and identifiers, then the scanner's own comment ranges, then a
character state machine for whatever those two decline - that stripper is **wrong on three of the 49
files and right on 46**: `Panel.tsx`, `MailboxLifetime.tsx` and `Wordmark.tsx`, where a `{/* … */}`
comment container holds the name and the stripper's block-comment pass runs past it. **Its errors
cancelled: it over-removed in some files and under-removed in others and landed on the correct
total.** So the total is a measurement and the reader is not established, which is the same shape as
§2's unmeasured rows and the reason it is recorded here rather than presented as settled.

### 6.1 The two files recorded twice

**`apps/web/src/LocalData.tsx` and `apps/web/src/useMailboxSession.ts` are recorded with two
independent readings each**, because a single reader agreeing with itself is not evidence.

| file                                | occurrences | the comments-only stripper leaves | the classification reader leaves | which, and why                                                                            |
| ----------------------------------- | ----------- | --------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/web/src/LocalData.tsx`        | 3           | **2**                             | **2**                            | 1 is inside the JSDoc above `localData` at line 109; 2 are JSX text, at lines 145 and 218 |
| `apps/web/src/useMailboxSession.ts` | 4           | **0**                             | **0**                            | all 4 are inside comments, at lines 82, 113, 296 and 448                                  |

**The two readers agree on both files, and the recorded disagreement is elsewhere** - the three files
in the paragraph above. **That correction is the point of recording these two twice**: the review had
named these two as the files the stripper could not vouch for, and the measurement says the stripper
vouches for both and fails on three others.

**Two readers were wrong while producing this, and both defects are recorded because each produced a
confident answer.**

**The first took comments as the complement of every node's span, and reported zero comments in
`LocalData.tsx`** - a file that opens a JSDoc carrying the name on line 109. `getStart()` skips
leading trivia, so a JSDoc above an interface member sits inside its interface's span. **The reader
was wrong in the direction that makes a file look clean**, which is the direction a document then
quotes.

**The second used the scanner's own comment ranges and bucketed everything left over as code** - and
the leftover was 11 occurrences of which only 8 were code. The other 3 were JSX comment containers
that `forEachChild` reports as a `JsxExpression` with no expression, so no comment range came back for
them. **A reader with a residual bucket cannot be trusted, because the bucket hides the reader's own
blind spot.** The reader that produced the table above assigns a kind to every occurrence and counts
the ones it cannot classify; that count is **0**, and a non-zero one would be the reader reporting
its own defect rather than a figure to publish.

## 7. What this review does not establish

- **No trademark position of any kind.** Three of the six checks produced no measurement (§2). A reader
  who wants one needs a professional search, and that is not a build step.
- **Nothing about the `.com`'s holder.** §3 is one directory's description, and its one testable claim
  is the one the registry contradicted.
- **Nothing about whether the name is a good name.** Every figure here is about collisions and about
  this repository's own copy. Judgement is not a measurement and this document makes none.
- **The counts are a property of this tree on these dates.** §6 is a measurement of the shipped tree
  as it stood, and a later surface or a copy string moves it. Every figure carries its date for that
  reason.
- **The external checks cannot be re-run by any test in this repository.** A registry's answer, a
  store's answer and a directory's listing are measurements of the world on a date, and
  `tests/architecture/branding-audit.test.ts` checks only what this document claims about the tree. **An
  instrument that claimed to re-run them would be a check that could not fail.**
- **`openspec/specs/visual-system` says nothing about the name.** The requirement is filed against the
  two clients that render it; widening a M7 capability for a value it does not constrain would be a
  fourth capability for something nothing measures. Recorded as a gap.
