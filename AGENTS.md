# AGENTS.md



## Project overview



<!--

Describe the project explicitly. Do not make the agent guess the product,

architecture, purpose, or current state from repository files alone.



For brownfield, migration, preservation, reconstruction, or replacement

projects, describe what the existing implementation represents and what must

remain preserved during development.

-->



**SpectreMail** is a temporary-email product: a disposable address you can read
without leaving the page or the signup flow you were on, delivered as a website and a
browser extension over one shared provider abstraction.

This is a **greenfield** project, so there is no legacy implementation, no reference
oracle, and no migration sequence. What exists instead is a **measured** foundation:
the M0 spike probed `api.mail.tm` and `api.guerrillamail.com` live and recorded what
they actually do, and every architectural rule below is a consequence of a recorded
observation rather than of an assumption about how such an API ought to behave.

**M0-M5 are complete and M6 is in progress, but no user has ever seen this product.**
The website creates an address, lists what arrives in it, opens a message, and - since
M6 slice 2 - **keeps that address in the browser and offers it back on a reload**; **no
live browser run of it has ever been made**, so every acceptance claim below is a claim
about a function and about jsdom, not about a user's experience. That caveat is at its
sharpest for slice 2 and it is **unchanged by slice 3**: it is the first change that
would write anything to a user's disk, and `jsdom` implements no IndexedDB, so the real
storage path has been exercised by **no test at all**. `return to a recent mailbox` is
delivered by slice 2, and since slice 3 **this milestone has added its removal** - the
page offers a confirmed control that clears what this device holds. **Nothing about that
is a browser-tested claim**: `packages/storage`'s 44 tests run against
`fake-indexeddb` `6.2.5`, which **is not a browser**, and `createBrowserStorage()` - the
function a real page calls - is still **never executed by any test in the workspace**.
Slice 3 therefore closes the *product* gap and leaves the *verification* gap exactly
where slice 2 left it, and it is stated that way because a privacy control that has only
been checked against a fake is the claim most worth being careful about.

The current state, in dependency order:

- A provider capability layer (`packages/providers`) behind one `MailProvider`
  contract, with two measured adapters and a conformance suite driven entirely by
  recorded responses, so **no test contacts a live provider**.
- A normalized domain model (`packages/core`) that both adapters and every client
  agree on, holding **no** provider wire format.
- A pure message-parsing package (`packages/mail-parser`) that turns `Message.text`
  into readable text plus ranked one-time-code and verification-link detections, with
  **no network, no clock, and no AI**.
- A mailbox lifecycle and polling layer (`packages/mailbox`) that both clients
  consume, and that **adopts a stored mailbox** since M6 slice 2.
- A persistence layer (`packages/storage`) holding a real `SpectreStorage` contract,
  an IndexedDB adapter, and a browser entry point - **which the website now uses** and
  the extension does not.
- A website client (`apps/web`) that renders all of it, with **no styling** but with
  persistence.

The target state is two clients (website, extension) over that shared core. The
roadmap's next milestone is **M6, Website Hardening** — storage behind a shared
`SpectreStorage` contract, the privacy controls, and the error-state work. **M5 is
complete in scope**: all four of its slices are archived, and the three acceptance
lines it could not deliver itself (`copy the OTP`, `return to a recent mailbox`,
`clear local SpectreMail data`) are M10's and M6's, as `docs/ROADMAP.md`'s table now
records. Reading M5 as unfinished is what kept three blocked slices being selected;
that correction is recorded in the roadmap's Project Status block. The extension build
is M8 and the verification workflow (notifications, OTP copy/fill) is M10. Those
numbers come from `docs/ROADMAP.md` and must be read from there, not recalled: an
earlier draft of this file put storage at "M5–M6", which named a milestone from the
layer it felt should come next rather than the one the roadmap schedules.



---



## Stack



<!--

List it explicitly. Don't make the agent guess or infer from package.json,

go.mod, Dockerfiles, etc. alone.



Remove fields that do not apply and add project-specific fields when required.

Pin versions when exact versions matter.

-->



- Language(s): TypeScript `5.9.3` (verified). Strict mode plus
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, inherited by every
  workspace project from the shared `tsconfig.base.json`. ESM throughout.
  JavaScript `.mjs` remains only inside the disposable `tests/provider-spike/`
  harness, which is deliberately excluded from type checking because it is
  hand-rolled and has no types.

- Framework(s): React `19.3.0` with Vite `7.3.6` for the website client, verified
  building, type checking, linting, and serving. The extension client has **no
  framework and no Manifest V3 manifest** — it is a placeholder. The roadmap schedules
  the extension build for M8.

- Runtime(s): Node.js `v26.10.0` (verified).

- Frontend / client: `apps/web` creates a mailbox, renders its address, lists that
  mailbox's messages while polling for new ones, and opens one, reached through the
  shared session layer and **one** provider — Guerrilla Mail, for the measured CORS
  reason in `apps/web/src/provider-config.ts`. **That provider is configured by one
  list, and the factory derives from it.** `WEBSITE_PROVIDER_IDS` is the single source,
  the adapter registry beside it is typed `Record` over that list so an id with no
  adapter does not compile, and a boundary rule fails the build if a client's exported
  id list is never read as a value. Until M5 slice 4 the list documented an indirection
  that did not exist, so this is a corrected claim rather than an inherited one.
  **The website offers no provider selector, and `website-client` now requires that
  absence rather than merely permitting it**: the page names the provider it reaches,
  offers no control for choosing one, and does not describe the absence as missing or
  forthcoming. A control over one reachable option cannot act. It has
  **no styling**. Styling is
  absent by decision, not by omission; M7 owns it
  under the approved Spectral Swiss Utility direction, and markup written now would be
  markup M7 rewrites.
  **It keeps this device's address and can be made to forget it.** One mailbox is written
  to the browser's own storage and offered back on the next visit **after the provider
  confirms it**. M6 slice 3 added `LocalData`, a region of its own, which states what is
  kept and where and offers a **two-step confirmed removal** of the whole database - not
  of one key, so a record kind added later is removed with it. **The claim that no button
  anywhere deletes it, which this file carried through two earlier drafts, was true until
  this slice and is now false**; the sentence was **deleted rather than reworded**, and
  the comment beside it records why, because a stale claim that reads like a security
  guarantee is the most damaging kind of wrong on a page. The mailbox **stays on screen
  and stays usable** afterwards, and the page says a later visit will not offer it back -
  removal deletes this device's note of the address, not the address. A **refused**
  removal is reported as refused, in the platform's own words, and is forbidden from
  claiming either that the data is gone or that it is safe: a blocked removal stays
  **queued** and completes on its own once the holding connection closes, so both halves
  would be promises the product is about to break. The control is offered **only where it
  can act**, and the region renders **only once the boot read has finished** - before
  that the page knows nothing, and claiming nothing is kept would be a claim it cannot
  support. A stored address is **never** shown as working before
  the provider says so, and that is not caution: `docs/PROVIDERS.md` §3 records a dead
  Guerrilla Mail session answering `HTTP 200` with an empty inbox, so "nothing has
  arrived" and "this address is gone" are the same response. The page therefore
  distinguishes an address the provider confirmed from one it merely could not check, and
  says the second is unconfirmed rather than gone. The page deliberately displays **no polling interval** — the
  cadence is the product's own choice and no provider limit was measured for this
  provider, so a figure on screen would be an invention presented as a measurement;
  a provider's own verbatim limit statement *is* shown, attributed, with its scope
  disclaimed. `apps/extension` remains an empty placeholder. Visual design work starts
  at M7.
  **Opening a message displays what was found and acts on none of it.** `MessageView`
  renders the sender, subject, arrival time, readable text, the codes in the parser's
  rank order, and each link as text with its host visible. There is no copy control
  for a code and no `href` on a detected URL — **copying an OTP is M10**, and
  `AGENTS.md` is the authority for that, not the roadmap's acceptance list. Copying
  the **mailbox address** stays legal and a boundary rule says so. Confidence is
  never rendered as a number, and an unreadable message says so and offers a retry
  rather than reporting that it holds no code.

- Shared domain model: `packages/core` has real content since M2. It defines the
  normalized `Mailbox`, `MessageSummary`, `Message`, `VerificationCode`,
  `VerificationLink`, and discriminated `ProviderCredentials` types, plus the
  closed set of normalized error codes. It contains **no provider wire format and no
  runtime behaviour**: no adapter, no `MailProvider` contract, no mailbox lifecycle,
  no expiry evaluation, and no HTTP. It is consumed as TypeScript source and has no
  dependencies. **Unchanged by M3**, which consumes the model rather than widening
  it — no provider field name and no field added for a value no measurement
  produced.

- Provider layer: `packages/providers` has real behaviour since M3. It declares the
  `MailProvider` contract and implements it twice — a Mail.tm adapter and a
  Guerrilla Mail adapter — plus a provider manager, an injected transport seam, and
  one shared conformance suite both adapters pass. The contract has **no
  subscription method**, because no provider serves a push transport (five SSE paths
  and two WebSocket paths were probed; none connected). **89 tests**, of which 24 are
  the shared conformance suite run once per adapter. All are driven by recorded
  provider responses, so **no test contacts a live provider**. Its one workspace
  dependency is `@spectre-mail/core`.
- Message parsing: `packages/mail-parser` has real behaviour since M4. It is a
  **pure function of `Message.text`** - safe text extraction, one-time code detection,
  and verification-link detection - with **no network, no clock, and no AI**, which is
  what makes the whole milestone verifiable without contacting a provider.
  **149 tests** across 5 files: 23 extraction, 37 codes, 30 links, 11 composition, and
  48 driving a 14-fixture corpus end to end (28 of those generated, two per fixture, and
  20 hand-written).
  The corpus is **authored, not captured**: this repository has never received
  verification mail from any service, so every fixture carries a `synthetic: true`
  field, the two named after services carry an explicit statement that no mail from
  that service was received, and every address uses a reserved `.example`/`.test`
  domain. It proves **nothing about any real service's mail**, and it deliberately
  includes misleading messages, because a corpus of only verification mail cannot
  measure a false-positive rate.
  Two properties are worth knowing before changing any number here: a reducing shape
  is a **penalty, never an exclusion** (a copyright year is still returned, ranked
  last), and **no detection is ever reported as certain** (maximum `0.85` for a code,
  `0.70` for a link, by construction rather than by clamp alone).
  It must never gain a network call; `tests/architecture/boundaries.test.ts` asserts no
  module in it reaches the global `fetch`, and `corpus.test.ts` proves zero requests by
  observation with an instrumented transport. **No client consumes it yet.**

- Client orchestration: `packages/mailbox` has real behaviour since M5 slice 1. It is
  the **fourth shared package**, and it exists because the roadmap's shared-package
  list assigns "mailbox lifecycle" to `packages/core` while `shared-domain-model`'s
  approved Purpose states that package describes "the model and its invariants only"
  and excludes lifecycle behaviour. A roadmap sentence cannot amend an approved spec,
  so a new package took the behaviour and `docs/ROADMAP.md`'s list was amended to
  match. It is **framework-free and DOM-free by compiler, not by convention**: its
  `tsconfig.json` sets `lib: ["ES2023"]` with no `"DOM"`, so `document`, `window`,
  and `location` fail to *compile*. That is the enforcement. **The compiler does
  not block everything the claim implies, and the limit is measured rather than
  assumed:** measured name by name on 2026-10-02, `navigator`, `localStorage`, and
  `sessionStorage` all compile there, because `@types/node` declares them, and
  `"types": []` does not exclude it. Node v26.10.0 additionally *defines*
  `navigator` and `sessionStorage` on `globalThis` at runtime. So "no DOM" and "no
  storage" are two separate properties, only the first of which the compiler
  enforces; a separate boundary rule forbids the second and states that it is the
  only thing doing so. The architecture scan for framework imports is likewise a
  supplementary backstop which states its own limits.
  **134 tests**, all driven by stub providers or the real Guerrilla adapter over a
  recording transport — no test contacts a provider, and no test needs a browser.
  It is consumed by the website now and by the extension at M8; placing it outside
  `apps/web` is what keeps that from becoming a rewrite.
  **M5 slice 2 gave it polling**, and the numbers in that cadence are the **product's
  own and are defended as such**: 5s while a mailbox's contents are changing, doubling
  per unchanged check, capped at 30s, declared in `cadence.ts` as exported constants
  with the reasoning attached. No provider limit was measured for the only provider a
  browser can reach — `docs/PROVIDERS.md` records Mail.tm's `30; w=60` **measured
  unauthenticated only** and Mail.tm is unreachable from a web page at all, while
  Guerrilla publishes nothing. So a limit a provider *does* declare is honoured as a
  **floor** rather than parsed into a schedule, a throttled listing **stops the loop**
  rather than retrying quietly, and the client must not call `destroy()` on unmount
  because React StrictMode would then never poll again.
  It holds **no persistence of its own** - a stored mailbox is handed to it as a value,
  which is the whole point of the boundary - and it never invents a mailbox
  lifetime. **M6 slice 2 gave it `restore`**, so adoption is
  `restore(stored: Mailbox | null)`: `null` is the first-visit path and it delegates to
  `open()` rather than running a parallel create, because two implementations of "create
  a mailbox" drift into first visits behaving differently from retries. A stored mailbox
  is reconciled by **one listing through the provider that owns it**, which is the
  request that decides the question; `MAILBOX_EXPIRED` becomes `expired`, anything else
  becomes `restoreFailed`, and success makes that listing the inbox's own first listing so
  a restored mailbox arrives already analysed. `SessionState` now has **seven** variants
  - `idle`, `creating`, `adopting`, `ready`, `expired`, `restoreFailed`, `failed` - and a
  session **starts at `idle`**. `restore` never saves; the client owns persistence
  entirely.
  **The cadence has never been exercised against a live provider**, and the
  website has **never been run in a real browser**; every assertion about either is
  about this repository's own logic. **No restored mailbox has ever been reconciled
  against a real Guerrilla Mail session**, which is the operation slice 2 added.
  **M5 slice 3 gave it ownership of the opened message**, in `opened.ts` and a
  `SessionState.opened` on both `ready` and `creating`. The design decision worth
  knowing is retention: the analysis the inbox's verdict pass already produced is
  **retained**, so clicking an already-read message costs **no** provider request.
  That is asserted over a recording transport with a positive control that does
  issue a request, so the zero is a measurement and not an inert assertion. Retention
  is pruned to the current listing — **except after a failed listing**, which taught
  it nothing and must not shed a reading. An id absent from the listing is refused
  locally with `MESSAGE_NOT_FOUND` and **no request at all**, because asking a
  provider about a message it never reported would be a request made on a guess. A
  failed read is retried on the next attempt rather than served from a cached failure,
  and it is **never** reported as `opened` with nothing found.

- Backend / server: none. Intentionally `$0` paid backend infrastructure; see
  `docs/PROVIDERS.md` for why a SpectreMail-operated proxy is not a permitted
  workaround for Mail.tm.

- Database / storage: **`packages/storage` has real behaviour since M6 slice 1, the
  website has used it since M6 slice 2, and M6 slice 3 gave it a removal.** It holds the
  `SpectreStorage` contract - `loadMailbox`, `saveMailbox`, and `clearAll` - an IndexedDB
  adapter behind it, and a `createBrowserStorage()` entry point, with **44 tests** (7 for
  the versioned stored record, 30 for the adapter, 7 for the browser entry point).
  **Two ways in, separately
  named**: `createIndexedDbStorage` takes a required `IDBFactory` and needs no global,
  while `createBrowserStorage()` reads `globalThis.indexedDB` and **throws where the
  platform provides none** - a store that quietly kept nothing would let a page report
  "nothing is saved on this device" on a device where saving is blocked. **What deletion
  there is**: `clearAll` is the **third** contract member and calls `deleteDatabase` -
  the **whole database**, deliberately, not `CURRENT_MAILBOX_KEY`. The narrow version
  would pass every test written against today's single record and would quietly stop
  clearing everything the moment a later build added a second record kind, so the adapter
  test plants a store this build does not recognise and requires it to go too. Removal is
  **idempotent**, and **a blocked removal rejects rather than waiting** - and the reason
  is *not* that it would hang, which is what an earlier draft of this file said and which
  was wrong. Measured properly, a blocked `deleteDatabase` is **queued**: it fires
  `onblocked`, a fresh `open` is blocked while it is pending, and **it completes on its
  own** once the holding connection closes. The real reason to report is that the wait
  ends when some *other* tab closes, which a page can neither cause nor predict. So
  rejecting does **not cancel** the removal, which is what forces the page's wording.
  `apps/web` has used all three since slice 3; the **extension's adapter is still
  later**, and `fake-indexeddb` **is not a browser**. Two
  properties are settled and worth knowing before anything is built on it:
  **`loadMailbox` returns `null` for "nothing stored" only** and every other failure
  rejects, because a read reported as absent would make a client believe it is a first
  visit, create a mailbox, and overwrite the user's stored identity; and a stored
  record this build cannot narrow is **neither surfaced nor deleted**. `IDBFactory` is a
  **required** option with no global default, and writes resolve on
  `transaction.oncomplete` rather than on request success. `fake-indexeddb` `6.2.5` is
  the test substrate and **is not a browser**.

- ORM / data access: none yet.

- Package manager: pnpm `12.6.0` (verified). A pnpm workspace **is** initialised,
  covering `apps/*` and `packages/*` with a single root lockfile. pnpm 12 blocks
  dependency build scripts by default; `esbuild` is allowed via `allowBuilds` in
  `pnpm-workspace.yaml`. `tests/provider-spike` is **deliberately not a workspace
  member** — see `docs/ARCHITECTURE.md`.

- Build tooling: Vite `7.3.6` with `@vitejs/plugin-react` `5.2.0` for the website,
  verified building to `apps/web/dist` and serving on `127.0.0.1:5173`.
  Shared packages are consumed **as TypeScript source** (each `exports` points at
  `./src/index.ts`), so there is no per-package build and no bundler at M1.
  **`pnpm build` builds the website only**; package correctness is established by
  `pnpm typecheck`, which is a separate gate. There is still no extension build
  step — that is M8.

- Testing: Vitest `3.2.7` at the workspace root, verified running **647 tests across
  31 files** via `pnpm test` (2026-10-05, after the M6 slice 3 apply stage), counted from
  a JSON reporter rather than read off a summary line:
  54 in `packages/core`, 89 in `packages/providers`, **149 in `packages/mail-parser`**,
  **153 in `packages/mailbox`** (19 of them adoption), **112 in `apps/web`** (108
  rendering, 4 provider configuration), **44 in `packages/storage`** (7 stored record,
  30 IndexedDB adapter, 7 browser entry point),
  and **46 architecture boundary assertions**.
  **The previous figures in this paragraph were wrong in two ways, and both were found
  by measuring rather than by reading**: it recorded `apps/web` at 96 when the real count
  was 108 before this slice, and it recorded 3 provider-configuration tests when there
  have been 4. The split was never checked against the file. Counts here are now taken
  from `--reporter=json` and grouped by project, so the next reader is measuring rather
  than adding up.
  `passWithNoTests` is **off** by design - a
  green run that inspects nothing is worse than no run. The `include` globs name
  `tests/architecture/**/*.test.ts`, `packages/*/src/**/*.test.ts`,
  `apps/*/src/**/*.test.ts`, and `apps/*/src/**/*.test.tsx` explicitly, so
  the root test command can never execute the spike harness. The package glob is
  deliberately package-shaped: a test placed at the repository root or under
  `tests/` outside `architecture/` is **silently skipped**, verified 2026-10-02 by
  observing the collected count stay unchanged with such a file present. An
  undiscovered test reads as covered, so a test that must run at the root belongs in
  the architecture glob.
  **The `apps/` globs were missing until M5 slice 1**, which reintroduced that exact
  failure one directory over: a client test was silently skipped, which reads as
  covered. The collection is now asserted — `boundaries.test.ts` resolves the
  configured globs against the real test files, so narrowing the list reports the
  uncovered file rather than passing. The global `environment` stays `"node"`; a
  client test opts into jsdom with a per-file `@vitest-environment jsdom` docblock,
  because setting jsdom globally would hand `packages/mailbox` a DOM its own
  `tsconfig` exists to withhold. `jsdom` `30.1.1` and `@testing-library/react`
  `16.3.3` are `apps/web` **dev** dependencies, added only because a requirement
  about what is *rendered* cannot be verified without a DOM.
  Also installed: a disposable Node.js probe harness at `tests/provider-spike/`
  (`node:test`-free, hand-rolled, self-tested at `pnpm spike:selftest`, 16/16
  passing). Playwright `1.63.0` is a **spike-only** dev dependency, outside the
  workspace, used for browser-context and MV3 probes. There is **no Playwright
  browser-automation test suite yet** — the live host-permission check remains deferred.

- Infra / deploy: none. A GitHub Actions workflow exists at `.github/workflows/ci.yml`
  and runs the same root commands a maintainer runs, with no divergent flags. It
  **ran green on 2026-10-02** (run `36935477321`; the `verify` and
  `spike self-test` jobs both SUCCESS), which also confirms the pinned action
  majors and Node version resolve on a clean Linux runner.
  Action majors were looked up rather than assumed — an earlier draft of this
  workflow named checkout `v5`, setup-node `v6`, and action-setup `v4`, and all
  three were wrong. It has never yet been made to *fail*, so its ability to catch
  a regression is unproven.
  No deployment, hosting, or release pipeline exists or is planned for V1.

- External services: `https://api.mail.tm` and `https://api.guerrillamail.com`.
  Both are exercised live by the M0 spike. See `docs/PROVIDERS.md` for measured
  behaviour, rate limits, and terms.

- Specification workflow: OpenSpec `1.13.2` (verified CLI version)

- Optional later infrastructure: none. Any own-domain mail infrastructure is
  explicitly a M15 decision, not a V1 requirement.



<!--

For migration / brownfield projects, additional fields may include:



- Legacy server:

- Legacy storage:

- Legacy client:

- Modern client:

- Compatibility layer:

- Target server:

- Target database:

-->



## Frontend design skills



The installed Taste skills under `.agents/skills/` define durable frontend design and implementation guidance for this project.



### Required skill usage



For frontend, UI, UX, visual-design, or styling work, use the installed skills in this order:



1. `design-taste-frontend`
   - Use as the default frontend design-quality and anti-slop baseline.
   - Apply its rules for hierarchy, spacing, composition, visual consistency, responsive behavior, accessibility, and avoidance of generic AI-generated UI patterns.
   - Use it for every nontrivial frontend design or redesign task.



2. `minimalist-ui`
   - Use as SpectreMail's primary visual-style skill.
   - Favor restrained composition, strong typography, generous negative space, clear information hierarchy, minimal decoration, and functional interfaces.
   - Keep the interface quiet, precise, trustworthy, technical, and product-focused.



3. `industrial-brutalist-ui`
   - Use only as a **secondary structural influence**, not as SpectreMail's full visual style.
   - Borrow compatible Swiss / International Style qualities such as strong grids, typographic hierarchy, asymmetrical balance, precise alignment, crisp borders, and confident structural contrast.
   - Do **not** let this skill turn SpectreMail into a harsh, intentionally ugly, cyberpunk, hacker-themed, or full-brutalist interface.
   - When this skill conflicts with `minimalist-ui`, the approved SpectreMail design direction, or the project design system, prefer the restrained SpectreMail direction.



4. `full-output-enforcement`
   - Use for frontend implementation tasks to ensure requested work is complete rather than partially scaffolded.
   - Do not leave placeholder sections, fake UI, TODO-only implementations, unfinished interactions, omitted responsive states, or knowingly broken visual states unless the active task explicitly scopes them out.
   - Complete the requested slice end-to-end while still respecting Change scope and OpenSpec boundaries.



### SpectreMail visual direction



The approved project visual direction is **Spectral Swiss Utility**.



Use:



- Swiss / International Typographic Style as the structural foundation.
- Minimalism as the dominant visual treatment.
- Strong modular grids and deliberate alignment.
- Large, clean grotesk typography for primary interface text.
- Monospace typography selectively for email addresses, OTP codes, provider state, and technical metadata.
- Generous whitespace and restrained density.
- Thin or precise borders instead of heavy depth effects.
- A mostly neutral palette with one restrained spectral-violet accent.
- Functional Bento-like grouping only where real application state benefits from modular blocks, such as inboxes, mailbox lists, or provider status.
- Subtle materialize/disappear motion for mailbox creation, incoming messages, and OTP appearance.
- Clear interaction states, keyboard focus, responsive behavior, and accessible contrast.



Avoid:



- Generic AI-SaaS landing-page composition.
- Purple mesh gradients, decorative gradient blobs, or unrelated color accents.
- Giant centered hero copy with a badge, two generic CTA buttons, and three equal feature cards by default.
- Excessive rounded cards, pills, floating glass panels, or glassmorphism.
- Putting every piece of content inside a card.
- Decorative dashboards, fake graphs, fake statistics, or fake product UI.
- Fake terminals, Matrix/cyberpunk styling, glitch effects, or stereotypical hacker aesthetics.
- Cartoon-ghost overload or novelty decoration that reduces trust.
- Random floating shapes, decorative status dots, meaningless labels, and ornamental section numbering.
- Heavy shadows, excessive 3D effects, or animation without functional purpose.
- Inconsistent radius, spacing, border, typography, or color systems.
- Copying a Taste skill's stylistic extremes when they conflict with the approved SpectreMail identity.



### Design authority and conflicts



For frontend design decisions, use this precedence:



1. Explicit user/task requirements.
2. Approved active OpenSpec design requirements.
3. `docs/DESIGN_SYSTEM.md` and other approved project design documentation when present.
4. Existing approved SpectreMail UI patterns.
5. `design-taste-frontend`.
6. `minimalist-ui`.
7. Compatible structural guidance from `industrial-brutalist-ui`.



`full-output-enforcement` governs implementation completeness, not product scope. It must never be used to expand an OpenSpec change, add unrelated features, or override Change scope.



Taste skills do not override architecture, security, privacy, testing, provider, Git/PR, OpenSpec, or repository-boundary rules in this file.



Do not manually edit the installed generated skill files under `.agents/skills/`; update or replace skills through their supported installation/update workflow.



---



## Architecture rules



<!--

Define durable architectural constraints here.



Keep rules explicit. Do not rely on the agent to infer architectural boundaries

from the current implementation alone.



Replace the placeholders below with project-specific architecture rules.

Remove only rules that genuinely do not apply.

-->



- Follow the project's primary architectural sequence: **provider adapter → shared domain model → parser → storage → client**, in that order, because each layer is only useful once the one below it exists and is verified. Do not build a layer ahead of the one it consumes.

- Do not rewrite multiple major system boundaries simultaneously unless the approved change explicitly requires it.

- Client code must depend on the shared abstraction, never directly on a provider adapter or a low-level wire format.

- Separate a definition from the state derived from it: a `MailProvider` capability list describes what a provider offers, while `supports()` is the runtime query a caller uses to read it.

- Standard HTTPS/JSON is the default for ordinary request/response APIs. Add WebSockets or another real-time transport only for genuinely real-time behavior — and only after the transport is **measured to work**, since Mail.tm advertises SSE and serves none.

- Reference material may live outside the runtime, but it must never silently become a runtime dependency. Concretely: `tests/provider-spike/` is disposable research and is **deliberately not a workspace member**, so it can never be imported by application code. `tests/architecture/boundaries.test.ts` asserts no workspace file references it.

- Keep transport, domain logic, persistence, and presentation boundaries explicit.

- Do not bypass an established abstraction merely because direct access is easier.

- All temporary-mail provider access goes through the provider abstraction. Presentation code must never interpret a provider's HTTP response or contain a provider JSON field name. See the `provider-abstraction` capability.

- Provider roles are assigned per client, not globally. The website uses Guerrilla Mail only; the extension uses Mail.tm primary with Guerrilla Mail fallback. Do not add a provider to a client whose environment cannot legally or technically reach it.

- **Never proxy a provider API.** Do not relay a provider through a SpectreMail-operated server, or any other intermediary, to work around a provider's CORS policy or origin restriction. This is a policy of the product, not a terms-compliance judgement: Mail.tm grants no CORS to third-party origins, so the correct response is to exclude it from the website, not to add a backend. Note that no Mail.tm terms page could be located, so no terms-derived justification may be cited for any provider decision.

- **Do not cite provider terms that were not verified.** Where a provider's terms could not be located, do not quote them, do not rely on them for an architectural decision, and do not assume a required obligation is absent. Mail.tm publishes **no terms page** (verified 2026-10-02); attribution, resale, and quota obligations are therefore all unverified in both directions.

- Do not trust a provider's declared message content type, and never render raw message content as HTML. Guerrilla Mail was measured returning `content_type: "text"` with an HTML body, and its real delivered message arrived as raw HTML. Only Mail.tm's delivered message has been observed as plain text, so the plain-text case is **not** evidence that Mail.tm's content typing is trustworthy either.

- Do not depend on a provider push transport that has not been verified against the live API. Mail.tm advertises SSE and serves none; message retrieval is adaptive polling.

- Surface provider throttling to the user rather than silently retrying or queueing. Mail.tm caps account creation at `1; w=60`.

- Do not assume a mailbox or session has a known lifetime, and do not derive a countdown from provider documentation. Mail.tm publishes a 7-day message retention and states a mailbox lasts until deleted, but neither value appears in any API response and neither was measured live; Guerrilla publishes nothing equivalent. Expiry must follow an observed signal, never an elapsed guess.

- Extension manifest host permissions for provider origins must use the wildcard path form (`https://api.example.com/*`). A slash-less pattern (`https://api.example.com`) is silently a no-op and must be covered by a test that exercises the declared pattern.

- Avoid shared mutable global state unless explicitly required and documented.

- Cross-cutting services must stay focused on their defined responsibility.



<!--

Keep or adapt this example for authoritative systems.

Remove it if the project does not use an authoritative server.

-->



```python

# Good: client sends intent.

perform_action(actor_id, action_id, target_id)



# Bad: client dictates authoritative outcome.

apply_client_state(resource=999999, progress=5000)

```



---



## Setup & commands



<!--

Document commands that were actually executed successfully for this repository.



Do not invent commands.



Replace every placeholder below with verified commands as the project develops.

Delete sections that genuinely do not apply.

-->



Current entry point:



```bash

pnpm dev:web

```

Starts the website client on `http://127.0.0.1:5173`. Verified 2026-10-02: it
returned HTTP 200 serving the application, and `/src/main.tsx` was confirmed to
return Vite-transformed JSX, so the server really serves the app rather than a
static shell.

The website creates a mailbox, renders its address, lists that mailbox's messages
while polling for new ones, opens one, and - since M6 slice 2 - **reads its own storage
first and offers a stored address back after the provider confirms it**. It has **no
styling** - that is M7 - and since M6 slice 3 it **offers a two-step confirmed control
that makes this browser forget that address**, with the mailbox left on screen and the
page saying a later visit will not offer it back. `LocalData.tsx` is the only new
component; the limits bullet that said no button could delete the stored address was
**removed rather than reworded**, because it became false the moment the button landed.
The remaining stated limit is styling, not an unfinished screen. The
page's provider configuration is reachable and testable without a network
(`apps/web/src/provider-config.test.ts`), but **nothing has been verified against the
live Guerrilla Mail API from a browser**, so no claim is made about what a real page
does on a real network - and in particular **no claim is made about how a real
provider responds to being polled every five seconds**, because that has never been
run. **Nor has the removal been run in a browser**: `jsdom` implements no IndexedDB, so
the whole delete path a user would take is exercised only against `fake-indexeddb`, which
is not a browser. The polling loop is asserted by reading the delay the scheduler was
asked for, which proves the cadence this repository computes and nothing about a
provider's tolerance.
There is still no extension build step; `pnpm dev:extension` does not exist and
must not be documented until M8 creates it.



Current dependency manifest / install command:


```bash

pnpm install

```

The root `package.json` is the workspace manifest. It installs `apps/*` and
`packages/*` from the single root `pnpm-lock.yaml`.

`tests/provider-spike/` is **deliberately not a workspace member**, so the root
install does not install it. To install and run the spike separately:



```bash

pnpm --dir tests/provider-spike install
pnpm --dir tests/provider-spike exec playwright install chromium

```



Current baseline syntax / compile check:



```bash

# Parses every spike module without executing it. This is a syntax check only.
node --check tests/provider-spike/src/run.mjs
node --check tests/provider-spike/src/probe-runner.mjs
node --check tests/provider-spike/src/probes/mailtm.mjs
node --check tests/provider-spike/src/probes/guerrilla.mjs
node --check tests/provider-spike/src/probes/browser.mjs
node --check tests/provider-spike/src/probes/delivery.mjs
node --check tests/provider-spike/src/probes/cors-headers.mjs
node --check tests/provider-spike/src/senders/smtp.mjs
node --check tests/provider-spike/src/senders/index.mjs
node --check tests/provider-spike/src/browser/extension-fixture.mjs
node --check tests/provider-spike/src/report.mjs
node --check tests/provider-spike/src/selftest.mjs

```

Verified 2026-10-01: all 12 spike modules parse.

**This proves the spike parses. It proves nothing about behaviour, and nothing at
all about providers.**

It is now only the spike's lowest-level check. Since M1 there are real workspace
gates; see the workspace verification gates entry below. This block remains because
the spike is outside the workspace and so is not covered by them.



<!--

Optional project/runtime installation prerequisite.



Removed: SpectreMail has no prerequisite beyond the toolchain documented above
(Windows 11, Node.js v26.10.0, pnpm 12.6.0). There is no database, no container
runtime, no OS-level package, and no cloud CLI in the path to any gate in this
repository. Playwright's Chromium download is a prerequisite of the **disposable**
spike only, is already listed as its own verified step, and is deliberately outside
the workspace so a contributor who never runs it needs nothing.

-->



Important:



- The supported development/runtime environment is **Windows 11, Node.js v26.10.0, pnpm 12.6.0** (all verified 2026-10-01).

- Executed dependency/package consistency checks, both verified: `pnpm install` at the
  root (2026-10-02, lockfile committed and unchanged after re-installing with exact
  pins) and `pnpm --dir tests/provider-spike install --frozen-lockfile` (2026-10-02).

- Run risky, state-mutating, legacy, or preservation checks in an appropriate disposable environment when required.

- No verified automated test, lint, type-check, build, or runtime command exists unless
  it is explicitly listed in this section. A CI workflow is **not** a substitute for a
  locally verified command: a green CI run proves the command works on a clean Linux
  runner, which is a different fact from it working on this machine.

- Do not invent commands in this file.

- When new tooling is added, update this section only with commands that were actually executed successfully.

- Document what each verification command proves and what it explicitly does ****not**** prove.

- Do not convert a successful syntax/build command into a claim that behavior or tests passed.



<!--

Add verified project-specific tool commands below.



Repeat the following pattern for each important tool, validator, migration

utility, generator, test suite, asset processor, schema checker, etc.



Do not retain examples that do not apply to the project.

-->



### Verified project tool: M0 provider spike harness



Verified on `Windows 11 / Node.js v26.10.0 / pnpm 12.6.0` on 2026-10-01:



```bash

pnpm --dir tests/provider-spike install
pnpm --dir tests/provider-spike exec playwright install chromium
pnpm --dir tests/provider-spike spike:selftest
pnpm --dir tests/provider-spike spike
pnpm --dir tests/provider-spike spike:interactive

```



See `tests/provider-spike/README.md` for the harness contract and outcome
vocabulary, and `docs/PROVIDERS.md` for the findings a run produced.



These commands establish the measured behaviour of `api.mail.tm` and
`api.guerrillamail.com`, including the mailbox lifecycles, CORS reachability from
a real web page and a real MV3 extension context, advertised rate limits, and the
absence of any real-time transport. `spike:selftest` additionally establishes the
harness's own contract: the four outcome classes, that a failing probe never
aborts a run, and that both run artifacts are written.



Real external delivery **has** since been verified on both providers, in
`spike:interactive` run `2026-10-01T18-08-41-251Z`, where a maintainer-sent message
was observed on each live mailbox. A bare `spike` run still records both delivery
checks as `unverified`, because it has no sender and cannot observe inbound mail
unattended — that is the expected result, not a regression.

The non-interactive `spike` command does **not** by itself establish delivery,
long-run mailbox or session expiry, or any product behaviour, because no product
exists. Mail.tm's FAQ publishes a 7-day message retention and states a mailbox lasts
until deleted, but neither value appears in its API, and neither the retention nor
the lifetime was measured live. The spike is disposable and must never be imported
by an application.



Exit codes: `0` when no probe failed, `1` when at least one probe failed.
`unsupported` and `unverified` are findings, not failures, and never change the
exit code — but they are never reported as passes.



### Verified project tool: OpenSpec



Verified on `Windows 11` on 2026-10-01:



```bash

openspec --version                       # 1.13.2
openspec validate m0-provider-spike --strict
openspec status --change m0-provider-spike
```



See `openspec/` and `.agents/skills/openspec-*` for the workflow and artifact
format.



These commands establish that the active change's planning artifacts exist, are
internally consistent, and satisfy the schema's validation rules.



They do **not** establish that the implementation matches the change. Validation
is a static check over `proposal.md`, the spec delta, `design.md`, and
`tasks.md`. Only reading the implementation and the recorded run evidence
establishes that.

**One gotcha, verified 2026-10-02.** Between a change's sync stage and its
archive stage, the bare name matches both the change and the promoted spec, and
validation refuses to guess:

```bash

openspec validate shared-domain-model --strict
# Ambiguous item 'shared-domain-model' matches both a change and a spec.

openspec validate shared-domain-model --type change --strict   # Change ... is valid
openspec validate shared-domain-model --type spec --strict     # Specification ... is valid
openspec validate --specs --strict                             # all promoted specs
```

This window is expected rather than a fault; `openspec archive` closes it. Do not
respond by deleting the promoted spec to make the bare name resolve again.

**Archive must run with `--skip-specs` when a sync stage already promoted the delta**,
or the requirements are applied twice. Verified at M4: the sync stage had already
written `openspec/specs/mail-parsing/spec.md`, so archive was run as

```bash

openspec archive mail-parsing-engine --skip-specs --yes

```

It reported `Task status: Complete`, moved the change to
`openspec/changes/archive/2026-10-02-mail-parsing-engine/` with its `.openspec.yaml`,
`proposal.md`, `design.md`, `tasks.md`, and its delta under `specs/`, and left
`openspec validate --specs --strict` at **6 passed, 0 failed**. `openspec status` then
reported `No active changes`, which is the correct end state for a completed milestone.

This establishes that the archive moved the change and did not corrupt the promoted
specs.

**Whether the archived delta and the promoted spec differ is a property of the
milestone, not a fixed rule — and the difference is a symptom of which artifact was
edited, not a property of archiving.**

Verified at **M4**: extracting everything from the first `### Requirement:` in each file
and comparing gave **9 requirements in both**, but **28 scenarios in the archived delta
against 31 in the promoted spec**. The three extra scenarios were the ones the
verification pass added, and they were written into the **promoted spec** at the sync
stage rather than back into the change's delta. A reader comparing the two would find a
gap there.

Verified at **M5 slice 3**, and it came out the other way: **6 requirements and 16
scenarios in both** for `mailbox-session`, **4 and 10** for `website-client` — every
delta title present in the promoted spec, checked mechanically rather than by reading.
The reason is that this repository's own rule says *"if implementation reveals a missing
or incorrect requirement, update the change instead of silently diverging"*, so slice 3's
task 6.2 required its two apply-stage amendments to be written **into the delta**, with
the reason attached, and they are there — `**Amendment, recorded during apply
(2026-10-03).**` inside two of its requirements. Nothing was left for the sync stage to
add, so there is no gap.

So the rule that generalizes is the opposite of the one M4's numbers suggest: **a gap
between the archived delta and the promoted spec means an amendment was recorded in the
wrong artifact.** `openspec/specs/` is the source of truth for what is required, and the
archived delta is the record of what the change asked for — and when a verification pass
strengthens the second, it must strengthen the *change*, or the archive will ship a
delta that understates its own milestone.



### Verified project tool: baseline syntax check



Verified on `Windows 11 / Node.js v26.10.0` on 2026-10-01:



```bash

node --check tests/provider-spike/src/run.mjs
node --check tests/provider-spike/src/probe-runner.mjs
node --check tests/provider-spike/src/probes/mailtm.mjs
node --check tests/provider-spike/src/probes/guerrilla.mjs
node --check tests/provider-spike/src/probes/browser.mjs
node --check tests/provider-spike/src/probes/delivery.mjs
node --check tests/provider-spike/src/probes/cors-headers.mjs
node --check tests/provider-spike/src/senders/smtp.mjs
node --check tests/provider-spike/src/report.mjs
node --check tests/provider-spike/src/selftest.mjs

```



These commands establish that every spike module parses as ESM.



They do **not** establish any behaviour, correctness, or provider fact.

They also do not cover the workspace. Since M1 the real gates are `pnpm typecheck`,
`pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build`; see the workspace
verification gates entry below. This block remains because the spike is outside the
workspace and is therefore not covered by them.



### Verified project tool: workspace verification gates

Verified on `Windows 11 / Node.js v26.10.0 / pnpm 12.6.0` on 2026-10-02, and
**re-verified after `.gitattributes` was added.** All exited `0` on an LF working
tree, which `.gitattributes` now enforces on every platform — see the third
limitation below, because this result was once false on Windows.



```bash

pnpm install
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm verify

```

These are the six commands the roadmap's M1 acceptance criteria name, plus
`pnpm verify`, which runs typecheck, lint, format check, test, and build in
sequence. All exited `0`.

Observed results, re-verified after the M4 verification repair, again after the
M5 slice 1 apply stage, again after its independent verification repairs (all on
2026-10-02), after the M5 slice 2 verification repairs, again after the M5 slice 3
verification repairs, again after the M5 slice 4 apply stage, and again after the
M6 slice 1 apply stage, again after the M6 slice 2 apply stage, and again after the
M6 slice 3 apply stage, all on 2026-10-03
through 2026-10-05:

```text
pnpm typecheck     8 of 8 workspace projects run tsc --noEmit
pnpm lint          exit 0
pnpm format:check  All matched files use Prettier code style
pnpm test          31 files, 647 tests passed
pnpm build         vite 7.3.6, dist emitted
pnpm verify        exit 0
```

**One environment note, because `pnpm lint` failed to launch cleanly once and the
distinction matters.** On 2026-10-05 `pnpm lint` printed a PowerShell
`NativeCommandError` wrapper around `eslint .` while **exiting `0`**, and once exited
`-1` with no output. Running `node node_modules/eslint/bin/eslint.js .` directly
exited `0` with no findings, and `pnpm verify` — which runs lint in sequence — exited
`0` throughout. The exit code is the fact and the wrapper is PowerShell noise, but a
`-1` with no output is not a pass and was re-run rather than assumed.

These commands establish that the workspace is internally consistent: every
package and app type checks under the shared strict config, lints, is formatted,
passes its unit tests and the architecture boundary assertions, and that the
website builds.

They do **not** establish that any provider behaves as its adapter claims against
the **live** service. Every test in `packages/providers` runs from **recorded**
responses, so the suite proves this repository's mapping of a provider's wire format
and nothing about the provider's current behaviour. A provider renaming a field
would leave this suite green. Fixture refresh against `docs/PROVIDERS.md` is a
deliberate diff, not something CI does. The same limit now applies to the client, and
it has **widened twice**: `apps/web`'s 96 tests render against a **stub provider** or a
recording transport, so they prove the page composes the abstraction correctly and say
**nothing** about whether a real browser reaches Guerrilla Mail successfully. **No live
browser run has ever been made**, so every component in the website — including
`MessageView`, added at slice 3 — has been seen by jsdom and by nothing else. **Nor has
the polling cadence ever run against a live provider**: `packages/mailbox`'s cadence
assertions read the delay the scheduler was asked for, and nothing in this repository has
observed what a real provider does when a real page polls it every five seconds.

**M6 slice 2 widened that limit into a hole rather than a caveat, and it is stated here
because `pnpm test` cannot detect it.** `jsdom` implements no IndexedDB, so
`createBrowserStorage()` — the function a real page actually calls — has **never been
executed by any test in the workspace**. The client suites inject a `SpectreStorage`, and
substituting `fake-indexeddb` would substitute a fake rather than a browser. So the
suite proves that the page's boot, save, and every error branch compose correctly around
the contract, and proves **nothing at all** about the IndexedDB path a user's browser
would take. **No stored mailbox has ever been reconciled against a live Guerrilla Mail
session**, which is the operation slice 2 added, so both halves of reload recovery are
untested end to end.

**Slice 3 did not close that hole, and the reason it could not is worth stating plainly
rather than leaving the reader to assume the number of tests grew the coverage.** The
removal is the *first* operation in this repository whose correctness depends on
IndexedDB semantics `fake-indexeddb` may not share — specifically on what a **blocked**
`deleteDatabase` does, which was **measured** against the fake and is not a browser
measurement. `packages/storage`'s 30 adapter tests drive real `onblocked` events from a
real held-open connection, and they establish the adapter's behaviour and the queued
semantics recorded above. They establish **nothing** about a browser's behaviour, and
`createBrowserStorage()` is still executed by **no test in the workspace**. So the
sequence a user's browser actually takes — page boots, reads, creates, writes, then
deletes the whole database — has never run anywhere in this repository. **A privacy
control verified only against a fake is the claim in this repository least entitled to
confidence**, and 44 storage tests do not change that.

**`pnpm test` and `pnpm typecheck` catch different defects, and this repository has
now been bitten by that in both directions.** Vitest does not typecheck, so a
`SpectreError` fixture missing a required `cause` left the suite green at 469/469
while `pnpm typecheck` exited 1 — and tasks were ticked in the meantime. Conversely,
`tsc` cannot see a vacuous assertion, a rule narrower than its documented rule, or a
comment describing behaviour that is not there. **Neither gate is a substitute for
the other, and "the tests pass" is not a claim about the types.**

Four specific limitations worth not misreading:

- **`pnpm build` builds the website only.** Shared packages are consumed as
  TypeScript source, so there is nothing to emit for them. Package correctness is
  established by `pnpm typecheck`, which is a separate gate. Do not read a
  successful `pnpm build` as "the packages compiled".
- **`pnpm test` is non-vacuous by construction, and that was verified.** Each of
  the M1 assertions was proven able to fail by deliberately introducing the
  violation and observing a non-zero exit: a package importing an app, a provider
  field name under `apps/`, a provider adapter identifier outside
  `packages/providers`, a workspace reference to the spike, and the spike added as
  a workspace member. A run with the test directory removed was also confirmed to
  exit `1`, because `passWithNoTests` is off. The M1 independent verification
  pass then found that two of those assertions were **narrower than the rule they
  claimed to enforce**, and widened them: the import rule had missed dynamic
  `import("…")` and bare side-effect `import "…"`, and the adapter rule had been
  scoped to `packages/` and `apps/` so a root-level or `tests/` module could name
  an adapter freely. Both widened cases were then proven to fail. An assertion that
  passes for the wrong reason is not a passing assertion.
- **The count reached 44 boundary assertions at M5 slice 1, which added seven, and its
  independent verification pass found five defects in them.** (44 is that milestone's
  figure; the current one is **46**, below.) The
  adapter-confinement rule was **re-scoped**, which is the first recorded instance of
  an assertion being *broader* than its documented rule rather than narrower: it also
  forbade `createProviderManager` and `createFetchTransport` outside
  `packages/providers`, which left `MailProvider` and `ProviderManager` with no way
  to be instantiated outside the package declaring them. The rule now separates two
  entitlements — naming an *adapter* (a client's `provider-config.ts`, plus test
  files) and naming the *composition seam* (that module and `transport.ts`) — and
  **strips comments before matching**, because it had been reading raw text and fired
  on `packages/mailbox`'s own explanation of what it deliberately does not do. That is
  the **third** time a check here has fired on its own documentation; it was fixed by
  stripping comments, not by rewording the prose until the rule went quiet. New rules:
  no framework import in `packages/mailbox`, no storage/cookie/URL API in it, no markup
  escape hatch under `apps/`, and an assertion that **every** shipped test is
  **collected** rather than silently skipped.

  **The verification pass then found that three of those new rules were wrong on
  arrival**, which is why the seven became nine, and why the record matters more than
  the count:

  - The framework rule **matched only three of four import forms**, missing a bare
    side-effect `import "react";` — so its single control, which used the form the
    author happened to pick, passed while the gap was open. That is the **fifteenth**
    recorded instance of a check narrower than its rule and the **fourth** in this one
    change. Fixed with a control **per form** plus a negative control.
  - The collection rule resolved `apps/` only. Deleting the package glob dropped the
    suite from 365 tests to 40 with a **green exit** — `passWithNoTests: false` did not
    help, because three files still ran. A rule named for the client's tests that
    checked only the client's tests reads as general and is not.
  - The framework rule claimed the compiler blocked `navigator`. **It does not.**
    Measured name by name: `window`, `document`, and `location` are rejected;
    `navigator`, `localStorage`, and `sessionStorage` compile, and Node v26.10.0
    *defines* `navigator` and `sessionStorage` at runtime. So the storage rule is the
    **only** thing holding the storage half, and it says so. Five documents carried the
    false claim and were corrected.
  - Two more: a **dead allowance** naming `packages/mailbox` for a seam it never calls
    (removed, since a list nothing exercises cannot fail), and `expectedPackages`
    omitting `mailbox` while being named for the roadmap's list.
- **M5 slice 4 added five more, and one assertion in the client suite that shipped
  with a defect found by the slice's own falsification pass.** The new rule requires a
  client's exported provider-id list to be **read as a value**, not merely declared.
  It exists because `apps/web`'s `WEBSITE_PROVIDER_IDS` documented itself as making
  "adding a provider ... a visible edit to one list rather than a change spread across
  call sites" while `createWebsiteProviderManager` never read it — so
  `provider-abstraction`'s clause that adding a second provider "SHALL remain additive
  through the abstraction" was true of the abstraction and **false of the client**.
  The rule strips comments first, which inverts the earlier lesson rather than
  repeating it: there, a comment had to be *ignored* so prose could not fail a rule;
  here, prose must not be able to *satisfy* one, because a module that only describes
  the coupling it lacks is exactly the defect. Controls are one per form and none is
  gathered — the pre-change factory shape, a list named only in a comment, a
  configuration declaring no list, and a positive control proving the declaration and
  the `typeof` derivation are not violations.

  The defect this slice authored is the **seventeenth** recorded instance of a check
  narrower than its rule, and the first one this repository wrote and then caught. The
  state-coverage test asserted `visibleText()` contained "Guerrilla Mail"; making that
  line conditional on the `ready` state left the suite **green**, because the
  `creating` state already says "Asking Guerrilla Mail for a new address" and the
  `failed` state names the provider in its own explanation. Two of three assertions
  were satisfied by unrelated text. Both now read the limits `region` by its
  accessible name.

  **The harness was wrong before the test was, and that is the part worth keeping.**
  Its first mutation for that case opened a JSX paren without closing it, so the suite
  failed to *collect* — and the harness reported "suite stayed GREEN", because it
  looked for failing test titles and found none. A non-zero exit with no named failure
  is now a distinct outcome rather than a pass, because counting a broken mutation as
  a catch is how a dead case gets filed as coverage. 8 of 8 mutations are now caught by
  the intended assertion, with restoration reported separately and verified by
  SHA-256.
- **M6 slice 1 added two, and its falsification pass found six defects in what this
  change authored — including the eighteenth instance of a check narrower than its
  rule.** The storage-API rule was generalised from `packages/mailbox` to every shared
  package, and the generalisation was *measured* rather than preferred: it immediately
  reported a real false positive in `packages/providers`, which holds a recorded
  `set-cookie` response header from the M0 spike and was being read as a cookie jar. So
  a hyphen now counts as a word character in that pattern, with the cost stated in the
  rule — no JavaScript global is written with one, and `document.cookie` is matched by
  the property alternative regardless. A pattern narrowed by a change, which is why the
  narrowing is one of the 27 mutations.

  Four mutations then left the suite green, all with one cause: **a control that calls
  the scan *function* is not a control on the *rule*.** Each rule's assertion is
  *negative* — no shared package reaches a store — so narrowing its package list to
  `["mailbox"]`, to `[]`, or shortening its scan loop all leave it satisfied, because
  every package it stopped scanning happens to be clean. Three attempts to catch that
  with a control placed elsewhere in the file also stayed green. The fix was to remove
  the surface rather than write a better control: each scan function takes **no package
  argument**, so there is no second spelling of the list to narrow; the shared-package
  list is checked against the **directory contents on disk**, so a package added
  without appearing in it fails rather than being silently exempt; and each rule asserts
  its positive and negative halves **in one test through one call site** — a probe
  planted in every package the rule must scan, which the rule must report *by name*,
  and only after that a claim that it reports nothing.

  Three further defects came from controls that computed their own expectations out of
  the value under test: one derived its expected package list by filtering out the
  allowance constant, so widening the allowance moved both sides and the rule silently
  stopped guarding `packages/core`; another filtered probe hits by *file name*, which
  also matched probes planted in other packages, so a form the rule genuinely missed was
  satisfied by an unrelated package's violation; and the two rules shared one allowance
  constant, so widening the storage-API allowance also silenced the *import* rule and
  reported through the wrong test. All three are recorded in the change's `design.md`.
  **27 of 27 mutations are now caught by the intended assertion**, restoration reported
  separately and verified by SHA-256, and `nocompile` counted as its own outcome.
- **M6 slice 2 added two more, bringing the count to 46, and its falsification pass
  found three defects — one of them in an assertion this change wrote, and one of them
  a mutation that was a no-op and so found a misleading comment instead.** The new rule
  is the first **client-scoped** boundary in this repository: until slice 2 no rule
  mentioned `apps/` for anything but provider identifiers, because no client wanted to
  reach a store. `apps/web` now does, through `createBrowserStorage()`, so a client
  naming `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`, `caches`,
  `location`, `history`, or a bare `navigator` fails the build. It carries exactly one
  carve-out, `navigator.clipboard`, which `Address.tsx` uses and which copying the
  mailbox address requires — so **the carve-out is load-bearing on shipped code, not
  only on a fixture**, and dropping it is one of the mutations.

  It took the same shape slice 1's rules were driven to, for the same reason. The scan
  function takes **no argument** — an argument would be a second spelling of which apps
  to scan — and its roots are checked against the **directory contents on disk**, so a
  new client is covered by being created rather than by being listed. Line-level
  filtering was tried and rejected before the negative lookahead: filtering lines that
  mention the clipboard would have silenced the rule by accident on any line whose
  comment mentioned storage. The rule covers `apps/extension` even though that directory
  has no `src/`, because a rule scoped to the only client that exists today is invisible
  until M8 creates the second one.

  The three defects were each a different way of being wrong. **The retry assertion was
  satisfied by the bug it was written for** — it checked only the state after the retry
  landed, which the buggy code also reached, so a mutation that stopped the page saying
  "checking" mid-retry stayed green; it now holds the attempt open and inspects the page
  while the read is out. **"Built once, not per render" was a comment**, so
  `useWebsiteStorage` now takes the builder and the claim is asserted on object identity
  across three renders — counting reads would not have caught it, because the boot is
  guarded and would read once regardless. And **the mutation that was a no-op** aimed at
  `inbox: listing` in `restore` and left the suite green, because `withInbox` reads the
  tracker's own state for the `ready` branch; the comment beside that field described
  the redundancy as a deliberate choice and implied a guarantee the line never provided,
  so it now states plainly that the field is required only by the type and that what
  actually delivers a pre-analysed inbox is reusing `inbox.check`'s own result. **31 of
  31 mutations caught by the intended assertion**, restoration verified by SHA-256, and
  one further mutation is **recorded as unfalsifiable rather than counted** — see below.
- **One branch is deliberately unfalsifiable, and saying so is the point.**
  `restore` reports rather than casts the case where the inbox tracker returns neither a
  listing nor a failure, because `InboxState` has four variants and the compiler cannot
  rule out the other two. Replacing that throw with a guess leaves the suite green,
  because `inbox.check` handed a mailbox cannot return `notStarted` (only when handed no
  mailbox) or `checking` (only as a transitional publish it has moved past before its
  promise resolves). It is therefore not covered by a test and does not claim to be. A
  branch no assertion can reach is not a gap in the suite, and filing it as coverage
  would be the same error in the other direction.
- **`pnpm test` proved a third check of that same shape was vacuous, and the fix
  was to delete the gap rather than to add an exemption.** The adapter-identifier
  rule listed `MailTmProvider`, `GuerrillaMailProvider`, and `SpectreMailProvider`
  — **none of which existed**. M3 named its exports `createMailTmAdapter` and
  `createGuerrillaAdapter`, so the rule stayed green while guarding nothing; a list
  of identifiers nothing references cannot fail. That is the **fourth** time this
  repository shipped a check narrower than the rule it documented (M1: the import
  pattern and this rule's scope; M2: the wire-format scope, then a type assertion
  that resolved to `never` for every input). M3 widened the list to the real
  exports and added a shape match for `create*Adapter`.
- **M3's falsification pass ran 16 deliberate violations and all were caught, with
  every file restored byte-identical.** Nine targeted the boundary and contract
  rules (a `subscribe` member, a push-transport name, a module-level `fetch`, a
  bare `fetch(` call, an adapter exported outside its package, an adapter-shaped
  identifier, a wire field name in `packages/core`, one in `apps/web`, and an
  adapter alias in the shared index). Seven reverted a behaviour the specs
  **require** — the Guerrilla dead-session check, the verbatim rate-limit header,
  the throttle path, the empty-subject preservation, the absence of a markup field,
  fallback honesty, and expiry invention — and each produced a red suite naming the
  matching test. One case initially went red on an assertion other than the intended
  one; it was re-run in isolation until the correct test was confirmed to be the
  one that failed, because "the suite went red" is not the same claim as "this test
  catches this defect".
- **Two M3 checks initially fired on their own documentation.** The contract test
  asserted the absence of `subscribe` and the source contained the word in prose
  explaining why it is absent; the `fetch` rule matched `fetch(` inside a doc
  comment. Both were fixed by stripping comments before matching, not by rewording
  the documentation until the rule went quiet — a rule that cannot tell a
  declaration from a comment about that declaration is measuring the wrong thing.
- **`format:check` is sensitive to working-tree line endings, and was silently
  broken on Windows until `.gitattributes` existed.** `.prettierrc.json` pins
  `"endOfLine": "lf"`, but with no `.gitattributes` the working-tree line ending
  fell to each contributor's `core.autocrlf`. Stock Git for Windows ships
  `core.autocrlf=true` (set in the system gitconfig, not by any local override), so
  a Windows checkout materialised CRLF and `format:check` failed on 34 files with
  `pnpm verify` exiting `1` — while CI on Linux stayed green, because `autocrlf`
  is inert there. Found by the independent verification pass, not by any test,
  because every gate that executes code passed. `.gitattributes` (`* text=auto
  eol=lf`) now makes LF a committed fact and overrides a contributor's local
  setting. **Keep that file. Do not remove it on the belief that "git handles line
  endings".** Note that adding it does not repair an existing working tree; the
  tracked files must be re-checked out.

See `docs/ARCHITECTURE.md` for what each boundary is for, and
`openspec/specs/build-and-verification/spec.md` for the contract these commands
implement.




<!--

Duplicate the "Verified project tool" section as required.



Examples of things that may deserve separate entries:



- unit tests

- integration tests

- E2E/browser checks

- schema generation

- schema validation

- API contract validation

- migration checks

- asset registry tools

- asset conversion tools

- replay tools

- state-diff tools

- data normalization tools

- content validation

- protocol catalog validation

- code generation

- static analysis

- package integrity checks

- deployment validation

-->



---



## Code style



<!--

Keep durable repository-wide style rules here.

Add language/framework-specific rules when needed.

-->



- Prefer small domain modules over giant dispatchers or god objects.

- Use explicit names and domain types; avoid untyped dictionaries/objects crossing modern domain boundaries.

- Keep transport, domain logic, persistence, and presentation separate.

- Prefer pure functions for reusable calculations where practical.

- Handle failures explicitly; never silently swallow exceptions.

- Do not leave dead compatibility code after its replacement is verified and the related migration explicitly retires it.

- Use consistent import conventions in new application packages.

- Keep scenes/components/modules focused; do not create giant global managers.

- Limit module-level singletons and mutable global state to genuine cross-cutting concerns, and document each one. In this repository the rule is enforced by behaviour rather than by review: `packages/mail-parser` is required to be a pure function of its input, and `analyse.test.ts` proves it by parsing the same body in between two others and asserting the results are unchanged. `packages/providers` adapters are required to hold no state between calls, asserted one test per adapter by driving a single instance across two mailboxes with different credentials.

- Match the existing formatter/linter conventions when they are already established.

- Prefer existing project abstractions over introducing parallel competing patterns.

- Avoid speculative abstractions that are not needed by the active task.

- Keep public interfaces small and explicit.

- Prefer composition over deep inheritance unless the framework or domain clearly benefits from inheritance.

- Keep framework-specific code at system boundaries where practical rather than spreading it through domain logic.



---



## Testing



- Every migrated or replaced legacy behavior must have a captured fixture or equivalent behavioral evidence before replacement when parity matters.

- Prefer golden fixtures containing `request`, `before`, `response`, and `after` state when applicable.

- Bug fixes require a regression test when the affected system has test infrastructure.

- Server-authoritative actions must test invalid ownership, insufficient resources, duplicate requests, stale revisions, and invalid state where applicable.

- Runtime/asset changes must not reintroduce retired or prohibited runtime dependencies.

- Run every relevant available check before finishing.

- Do not claim tests passed unless they were actually run.

- If a required check cannot be run, report exactly why.

- Never convert “code compiles” into “tests pass.”

- Test behavior at the narrowest useful layer first, then add integration/E2E coverage where system boundaries matter.

- Do not weaken existing tests simply to make a change pass.

- Do not delete failing tests without determining whether the implementation or the test is wrong.

- When a test is intentionally changed because behavior changed, ensure the approved requirement/specification supports that change.

- Verification evidence must distinguish automated tests, static checks, manual inspection, runtime checks, and inferred conclusions.



---



## Boundaries — do not touch



<!--

Keep universal safety boundaries and add project-specific protected areas.



For preservation projects, explicitly list source material that must never be

destroyed merely because replacements exist.

-->



- Never delete original/reference/source material merely because a replacement exists unless its retirement is explicitly approved.

- Never overwrite raw source assets during conversion; write generated/converted/runtime assets separately.

- Never silently drop unknown legacy/data fields during migration; preserve them for migration analysis when applicable.

- Never manually edit generated files under `.agents/skills/`.

- Never commit `.env`, `.env.*`, credentials, tokens, private keys, or production secrets.

- Never hardcode production secrets.

- Never package prohibited/retired runtimes or dependencies into the final application.

- Do not modify reference/legacy behavior merely to make modern implementation easier; document and reproduce it first when parity is required.

- Never modify generated artifacts by hand when a canonical generator owns them.

- Never bypass security boundaries for convenience.

- Never weaken authentication, authorization, validation, sandboxing, permission checks, or trust boundaries without explicit requirements.

- Never delete user data, migration data, production data, or preservation material as part of ordinary feature work.

- Do not modify CI/CD, deployment, infrastructure, security, or repository governance unless the active task requires it.

- Do not touch these without the active task explicitly requiring it: `.agents/skills/` (generated), `.github/workflows/` (CI), `docs/PROVIDERS.md` (the recorded measurement every provider decision cites), and anything under `openspec/changes/archive/`.



---



## Change scope



- Make the smallest coherent change that satisfies the active task/OpenSpec change.

- Do not perform unrelated refactors or cleanup.

- Do not modify unrelated files.

- Do not upgrade dependencies without a concrete reason.

- Do not reorganize existing files during feature work unless the active change requires it.

- Use `git mv` when relocating preserved repository files where practical.

- Preserve existing behavior unless the task or approved spec explicitly changes it.

- Do not alter unrelated product behavior during parity, migration, or focused feature work.

- Prefer one domain/vertical slice at a time.

- Avoid “while I am here” changes.

- Separate required cleanup from optional cleanup.

- When additional work is discovered outside scope, record/report it rather than silently expanding the current change.

- Do not broaden an OpenSpec change simply because related opportunities are discovered during implementation.



---



## Delivery order

SpectreMail has **no migration sequence**: it is a greenfield build, so there is no
legacy system being replaced and no staged compatibility layer to construct. The
phasing that exists is delivery phasing, and it is owned by docs/ROADMAP.md, not by
this file.

The one rule worth restating here, because it is the one most likely to be broken by
an agent trying to be efficient:

    Take the earliest incomplete milestone in docs/ROADMAP.md.
        -> finish it through its full OpenSpec lifecycle
        -> then take the next one.

Do not begin M6's storage contract because M5's is half done, and do not add the
extension manifest early because the roadmap schedules it at M8. A milestone is
established only by the scope its own OpenSpec change allows; shipping a feature ahead
of its milestone produces code no requirement describes and no verification pass will
check.

The roadmap's Project Status block is the cursor. It is a progress ledger rather than
a source of behavioural truth — openspec/specs/ is that — so reconcile it against
Git, OpenSpec, and the repository before trusting a value written in a previous session.

---

## Git / PR workflow



`main` is the integration branch. Never perform planned work directly on `main`.



Every repository-mutating OpenSpec stage must use a remote branch and PR. Local-only working branches are not allowed.



### Branch naming



Branch names describe the technical work, not the raw OpenSpec change name.



- Proposal/docs: `docs/<technical-scope>-proposal`

- Feature: `feat/<technical-scope>`

- Fix: `fix/<technical-scope>`

- Refactor: `refactor/<technical-scope>`

- Tests/validation: `test/<technical-scope>`

- Technical spike: `spike/<technical-scope>`

- Spec sync: `docs/<technical-scope>-spec-sync`

- Archive: `chore/archive-<technical-scope>`



Examples:



- `docs/<technical-scope>-proposal`

- `feat/<technical-scope>`

- `fix/<technical-scope>`

- `docs/<technical-scope>-spec-sync`

- `chore/archive-<technical-scope>`



Do not use the OpenSpec change ID as the branch name unless it is also the clearest technical description.



### Branch lifecycle



Before starting any repository-mutating stage:



1. Check `git status`.

2. Switch to `main`.

3. Pull the latest `origin/main`.

4. Create a new branch from the updated `main`.

5. Immediately push the new branch to `origin` and set upstream tracking.

6. Only then begin modifying files.



Never leave active repository work only on a local branch.



Recommended pattern:



    git switch main

    git pull --ff-only origin main

    git switch -c <branch-name>

    git push -u origin <branch-name>



### OpenSpec Git lifecycle



#### Explore



`/openspec-explore` is normally read-only.



If no repository files change, no branch or PR is required.



If exploration intentionally modifies tracked documentation, treat it as a normal repository-mutating stage and use a branch + PR.



#### Propose



For `/openspec-propose`:



1. Start from updated `main`.

2. Create a technical proposal branch such as `docs/<scope>-proposal`.

3. Immediately push the branch to `origin`.

4. Create/update the OpenSpec proposal, design, specs, tasks, and roadmap status.

5. Review the diff.

6. Commit using Conventional Commits.

7. Push all proposal commits to the remote branch.

8. Open a PR into `main`.

9. After required checks pass, merge the PR using a ****merge commit****.

10. Delete the merged local and remote branch.

11. Return to `main` and pull the merged result before starting Apply.



Proposal artifacts should be committed and pushed so the exact remote PR diff can be reviewed.



Do not reuse the proposal branch for Apply.



#### Apply



For `/openspec-apply-change`:



1. Ensure the proposal PR has already been merged.

2. Return to `main`.

3. Pull the latest `origin/main`.

4. Create a new implementation branch from `main`.

5. Immediately push the new branch to `origin`.

6. Apply only the approved OpenSpec tasks.

7. Commit coherent implementation steps using Conventional Commits.

8. Push commits regularly to the remote branch.

9. Run all required verification.

10. Review the final diff and test results.

11. Open or update the PR into `main`.

12. Merge after required checks pass.

13. Merge using a ****merge commit****.

14. Delete the merged local and remote branch.

15. Return to updated `main`.



Do not reuse the proposal branch for Apply.



Do not begin Sync or Archive from an unmerged Apply branch.



#### Sync



If `/openspec-sync` modifies repository files:



1. Ensure the Apply PR has already been merged.

2. Return to `main` and pull latest `origin/main`.

3. Create `docs/<scope>-spec-sync`.

4. Immediately push it to `origin`.

5. Run the approved OpenSpec sync.

6. Review the diff.

7. Commit using Conventional Commits.

8. Push the commit(s).

9. Open a PR into `main`.

10. Merge using a ****merge commit**** after required checks pass.

11. Delete the local and remote branch.

12. Return to updated `main`.



Skip this stage when no spec synchronization is required.



#### Archive



For `/openspec-archive`:



1. Archive only after Apply and any required Sync are merged.

2. Return to `main`.

3. Pull latest `origin/main`.

4. Create `chore/archive-<technical-scope>`.

5. Immediately push the branch to `origin`.

6. Run the OpenSpec archive workflow.

7. Update Project Status, roadmap references, and archive links where required.

8. Review the diff.

9. Commit using Conventional Commits.

10. Push the archive commit(s).

11. Open a PR into `main`.

12. Merge after required checks pass.

13. Merge using a ****merge commit****.

14. Delete the local and remote branch.

15. Return to `main` and pull latest `origin/main` before beginning the next roadmap phase.



### Commit conventions



Use Conventional Commits:



- `feat:` new product capability

- `fix:` bug fix

- `refactor:` behavior-preserving restructuring

- `test:` tests or technical validation

- `docs:` documentation/specification

- `chore:` repository/tooling/archive maintenance



Examples:



- `docs: propose <technical scope>`

- `test: add <technical validation>`

- `feat: add <product capability>`

- `fix: prevent <bug>`

- `docs: sync <technical scope> requirements`

- `chore: archive <technical scope>`



Keep commits coherent and scoped.



Do not bundle unrelated changes into one commit.



### PR / merge conventions



- Every Propose, Apply, Sync, and Archive stage that changes repository files must go through a PR into `main`.

- Never silently commit completed stage work directly to `main`.

- Keep one coherent OpenSpec stage per branch.

- Open the PR from the remote branch, not from local-only work.

- Use ****merge commits only**** for OpenSpec and development PRs.

- Do ****not**** squash merge.

- Do ****not**** rebase merge.

- Preserve branch topology and individual branch commits in Git history.

- When using GitHub CLI, merge with:



      gh pr merge <PR_NUMBER> --merge --delete-branch



- Do not use:



      gh pr merge <PR_NUMBER> --squash



  or:



      gh pr merge <PR_NUMBER> --rebase



- Do not replace the default GitHub merge-commit title unless there is a specific reason.

- Prefer preserving the normal GitHub merge message, for example:



      Merge pull request #123 from owner/feat/<technical-scope>



- Delete local and remote branches only after the PR has successfully merged.

- The PR and merge commit are the permanent historical record after branch deletion.

- Never begin the next OpenSpec stage from an unmerged branch.

- After every merge, switch back to `main` and update it from `origin/main` before creating the next branch.



### Expected OpenSpec branch flow



For one OpenSpec change, the normal flow is:



    main

      │

      ├── docs/<scope>-proposal

      │      ↓ push remote immediately

      │      ↓ /openspec-propose

      │      ↓ commit + push

      │      ↓ PR

      │      ↓ merge commit

      │

      ├── feat|spike|test/<scope>

      │      ↓ push remote immediately

      │      ↓ /openspec-apply-change

      │      ↓ implementation

      │      ↓ verification

      │      ↓ commit + push

      │      ↓ PR

      │      ↓ merge commit

      │

      ├── docs/<scope>-spec-sync

      │      ↓ only if sync is required

      │      ↓ /openspec-sync

      │      ↓ PR

      │      ↓ merge commit

      │

      └── chore/archive-<scope>

             ↓ /openspec-archive

             ↓ update roadmap/status

             ↓ PR

             ↓ merge commit

             ↓ delete branch

             ↓ return to updated main



### Git safety



- Check `git status` before significant work.

- Inspect `git diff` before every commit.

- Inspect the final diff before opening a PR.

- Never discard existing user changes.

- Never force-push unless explicitly authorized.

- Never use destructive Git operations unless explicitly authorized.

- Never rewrite history unless explicitly authorized.

- Never merge a PR with failing required checks unless explicitly authorized.

- Never claim a branch was pushed, a PR was opened, or a merge occurred unless it actually happened.



---



## Source of truth



When deciding what the project should do, use this order:



1. Explicit user/task requirements

2. Approved active OpenSpec change

3. `openspec/specs/`

4. Recorded reference/legacy behavior or golden fixtures when applicable

5. Existing implementation and architecture

6. Tests

7. Repository documentation

8. Agent assumptions



When sources conflict, investigate the conflict. Do not silently invent a resolution.



For preservation/parity work, observed reference behavior is evidence; an accidental implementation difference is not automatically an improvement.



<!--

If the project is greenfield and has no legacy/reference behavior, adapt item 4

to the appropriate project authority, for example:



4. Approved product/design/API contracts



Do not silently alter the precedence without documenting it here.

-->



---



## Existing / brownfield project rules



<!--

Keep this section for any existing project.



Replace project-specific file/path examples with the repositories' important

implementation surfaces.

-->



Before modifying an existing capability:



- Inspect its implementation.

- Search the implementation surfaces that matter: `packages/*/src/` for shared code, `apps/*/src/` for clients, `tests/architecture/boundaries.test.ts` for the enforced boundaries, and `docs/PROVIDERS.md` before any provider-shaped change.

- Read the relevant OpenSpec spec/change.

- Check `openspec/changes/` for active work.

- Identify the current request → state mutation → response/output behavior.

- Capture or locate behavioral fixtures before replacing existing behavior when parity matters.

- Do not assume undocumented means unused.

- Do not rewrite working systems merely because they are unfamiliar.

- Classify obscure systems explicitly as implemented, parity-verified, retired, deprecated, experimental, or out-of-scope.

- Identify consumers before changing public interfaces.

- Search for tests, documentation, migrations, fixtures, generated code, and external contracts connected to the capability.

- Preserve backwards compatibility when required by the active specification.

- Distinguish accidental implementation details from externally observable behavior before reproducing them.



---



## Spec-driven development — OpenSpec



This project uses OpenSpec for nontrivial behavioral and architectural changes.



Expected structure:



    openspec/

    ├── config.yaml

    ├── specs/

    └── changes/



Rules:



- Check `openspec/changes/` before starting nontrivial implementation.

- Continue an existing relevant change instead of creating a duplicate.

- Read the relevant `openspec/specs/` capability before modifying it.

- Create/propose a change before implementing new nontrivial behavior when no appropriate change exists.

- Keep implementation aligned with the active change's requirements, design, and tasks.

- If implementation reveals a missing or incorrect requirement, update the change instead of silently diverging.

- Do not expand an active change with unrelated work.

- Sync approved behavior back into main specs and archive completed changes using the installed OpenSpec workflow.

- Do not manually edit generated `.agents/skills/`; use `openspec update` when regeneration is required.



Typical workflow:



    Explore → Propose → Apply → Verify → Sync → Archive



Use exploration for investigation only; it is not permission to implement.



OpenSpec owns feature requirements and change artifacts. This file owns durable repository-wide engineering rules.



---



## Implementation workflow

Adapted from the migration/reconstruction template, as that template instructs for
greenfield projects. SpectreMail has no reference implementation to reconstruct, but
it does have a hard verification discipline that this preserves.

For each feature or milestone slice:

    1. Inspect the current implementation and the related OpenSpec artifacts.

    2. Identify the interfaces, state, and dependencies involved.

    3. Locate behavioural evidence. For provider work this means recorded responses
       and docs/PROVIDERS.md; for parsing work it means the authored corpus. If no
       evidence exists, say so in the change rather than inventing it.

    4. Read or create the OpenSpec change before writing code.

    5. Implement the smallest complete behaviour.

    6. Add or update tests with the implementation, not after it.

    7. Run the falsification pass: prove each new assertion can fail, and prove the
       conforming case still passes.

    8. Run every workspace gate and record what it proves and what it does not.

    9. Update the roadmap's Project Status and the documentation in AGENTS.md,
       README.md, and docs/ with observed counts only.

    10. Inspect the diff and report the checks actually run.

Do not declare a milestone complete until its exit criteria are met, its full
OpenSpec lifecycle has run, and the verification pass has compared the
implementation against the change's artifacts rather than against the ticked boxes.

---



## Orchestration mode



For nontrivial OpenSpec changes, the root Codex agent acts as the orchestrator.



- Use real Codex subagents when work can be divided into concrete, independent tasks without overlapping file ownership.

- The root orchestrator owns the active OpenSpec artifacts and task status.

- Implementation subagents must not independently edit `proposal.md`, `design.md`, specs, or `tasks.md` unless explicitly assigned that responsibility.

- Assign each worker a bounded task, owned files/directories, requirements, dependencies, and required verification.

- Do not parallelize tasks that depend on unfinished interfaces or behavior.

- Do not have multiple agents edit the same files unless intentionally coordinated.

- Worker agents must report files changed, checks run, results, and unresolved concerns.

- The root orchestrator must review worker diffs/results before accepting them.

- After implementation, use a separate verification pass or verifier subagent to compare the actual implementation against the active OpenSpec artifacts.

- Do not trust checked task boxes as evidence; inspect the implementation.

- Run OpenSpec strict validation and the installed OpenSpec verification workflow before considering the change complete.

- Any unresolved CRITICAL verification issue blocks completion.

- Any unresolved WARNING blocks completion unless explicitly accepted by the user or active specification.

- If verification fails, create bounded repair tasks, delegate when useful, then rerun verification.

- Only the root orchestrator may declare the OpenSpec change complete.

- Worker subagents should not spawn additional subagents unless the root explicitly authorizes nested delegation.



### Subagent



- Default to at most two active subagents per root session.

- Preferred roles are:

  1. implementation agent

  2. verification agent

- The root agent remains the orchestrator and owns OpenSpec artifacts, architectural decisions, integration, and final acceptance.

- Do not spawn additional agents merely because work can technically be parallelized.

- Prefer sequential delegation when the verifier depends on implementation output.

- Spawn additional agents beyond this default only when the task has clearly independent workstreams and the expected benefit outweighs duplicated context/token cost.

- Give subagents only the context necessary for their assigned task; do not require every subagent to rediscover the entire repository.



### OpenSpec bootstrap and resume



The root orchestrator must support both bootstrap and resume workflows.



Before creating a new OpenSpec change:



- Inspect `openspec/changes/` and the project status recorded in the development roadmap.

- If a relevant active change already exists, resume it instead of creating a duplicate.

- If a completed but unverified or unarchived change exists, finish its verification/lifecycle before creating another dependent change.

- If no active change exists, use the development roadmap and current repository state to determine the smallest coherent next change.

- Use OpenSpec exploration before proposing a new change when repository investigation, existing/reference behavior, architecture, dependencies, or scope need confirmation.

- Exploration must not implement code.

- After exploration is sufficiently resolved, create the change with the installed OpenSpec propose workflow.

- Validate the generated change before implementation.

- Do not create an OpenSpec change for the entire development roadmap. The roadmap is the program-level plan; OpenSpec changes are bounded implementation units.

- Do not skip ahead to a later roadmap milestone while required exit criteria or dependencies of the current milestone remain incomplete.

- Default to completing one OpenSpec change per orchestration run unless the user explicitly requests continuous milestone execution.



### Development roadmap ownership



The development roadmap contains a root-orchestrator-owned `Project Status` block.



- Only the root orchestrator may update the roadmap's `Project Status` block.

- Implementation and verification subagents must not modify the roadmap unless explicitly assigned.

- Treat the status block as a progress ledger, not as the behavioral source of truth.

- OpenSpec specs and active change artifacts remain the source of truth for specified behavior.

- Repository implementation and tests provide implementation evidence.

- Reconcile the roadmap status against Git, OpenSpec, and the repository before trusting stale status from a previous session.

- Update project status whenever the active change enters a meaningful lifecycle transition: proposed, implementing, verifying, blocked, verified, archived, or completed.

- Record blockers and unresolved verification findings rather than hiding them.

- After archiving a verified change, update the roadmap cursor to the next eligible objective but do not automatically begin that change unless the current orchestration request allows it.
