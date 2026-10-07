# AGENTS.md

> **Current milestone state (reconciled against Git and OpenSpec 2026-10-08): M0-M8 are complete in
> scope, and M9's first slice is applied, verified and SYNCED; its archive follows.** M7's four
> slices are archived and M8
> (`extension-foundation`) is applied, verified, synced, and archived at
> `openspec/changes/archive/2026-10-07-extension-foundation/` - proposal **#75**, apply **#76**,
> sync **#77**. **M7 slice 4 (`extension-preview`) is applied, verified, synced and ARCHIVED** at
> `openspec/changes/archive/2026-10-07-extension-preview/` - proposal **#79** (`5062afa`), apply
> **#80** (`586d58a`), sync **#81** (`46ae462`), archive **#82**. **`in-page-address` (M9 slice 1)
> is applied, verified and synced** - proposal **#84**, apply **#85** - **and M9's slices 2
> (`in-page-mailbox`) and 3 (`site-associations`) have not begun.** **The sync promoted the delta,
> so the promoted specs now hold what it asked for:** `openspec validate --specs --strict` is
> **14 passed, 0 failed**, across **14 capabilities holding 143 requirements and 408 scenarios** -
> measured by counting `### Requirement:` and `#### Scenario:` across `openspec/specs/`, not
> transcribed. That is **13 → 14 capabilities, 136 → 143 requirements, 390 → 408 scenarios**: the
> fourteenth is `in-page-integration` at 7 requirements / 18 scenarios, and `extension-client` holds
> **6 requirements / 20 scenarios**, unchanged in requirement count because a `MODIFIED` delta
> replaces a block rather than adding one. **Each promoted block was verified byte-identical to the
> delta it came from, by copying the blocks programmatically rather than retyping them** - so
> identity is structural rather than a comparison performed afterwards.
>
> **Read the milestone sections below as history rather than as current state.** They are kept
> in the order the milestones happened and each records the measured counts as they stood at
> its own stage; the counts in **Setup & commands** are the current ones.



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

**M0-M6 are complete in scope, and M7 slice 1 is complete through its whole OpenSpec
lifecycle — proposal, apply, verification pass with repairs, sync, and archive. No user has
ever seen this product — but a real browser has.**
The website creates an address, lists what arrives in it, opens a message, and - since
M6 slice 2 - **keeps that address in the browser and offers it back on a reload**.
`browser-verification` has since run that page in **real Chromium against real IndexedDB**,
and **the first thing it found was that a requirement this file had been stating as
delivered was false there**: measured `records=1 claimsStored=0 offersRemoval=0` — the page
wrote the record and never concluded it had, so the removal control `website-client`
requires **was never offered at all**. 152 unit tests had passed against that page.
The cause was a per-invocation unmount guard in `useMailboxSession.ts` that the save
effect's **own cleanup** cleared when the inbox published a new `state` mid-write; it is
now a `mounted` ref, cleared only on a real unmount. **This sentence replaces the one that
said "no live browser run of it has ever been made"**, which was true until this change
and is now false.

**What is now browser-verified, narrowly.** The built page in **Chromium only**, with
provider traffic served from recorded responses: boot reads real IndexedDB through
`createBrowserStorage()`, a created mailbox is written and read back through the
platform's own API, adoption is offered only after the provider confirms it, and removal
leaves `indexedDB.databases()` empty — including a store this build does not recognise.
**37** browser test cases in **4** spec files as of M7 slice 4 - **34** as of slice 3 - **21** as of M7 slice 2 - **12** as of M7 slice 1 -
`pnpm test:browser`, its own CI job. **The motion spec found a product defect on its first run**
and then found a defect in *itself* on the change's falsification pass; both are recorded below
and in the change's `design.md` D17 and D18.

**What is still unverified, and the list is the point.** **`use it externally` remains
unverified** — a recorded provider is not a provider. **The live polling cadence remains
unobserved**: nothing here has watched a real provider respond to being polled every five
seconds. **The browser tier's first CI run *with this change's specs* failed**, on a defect
in its own traversal, in a spec `pnpm verify` had already passed — and finding that out
required checking, because the claim this replaces was wrong in **both** directions.

**Corrected by measurement, not by reading.** `gh run list` shows the `browser` job
executing from run `37374154930` on 2026-10-05 and **passing** in `37374154930`,
`37376921511`, `37377218976` and `37426170806` — the last on `main`, hours before this
branch. So the sentence this replaces, *"the browser tier has never run in CI; the job is
committed unexecuted"*, was **already false before this change began**. A first correction
was written here claiming the job *"ran in CI for the first time during this change"* —
**that is also false**, and it was retracted against the run list rather than kept because
it was the newer claim. **A correction is not evidence either.**
**The blocked-`deleteDatabase` semantics remain a `fake-indexeddb` measurement** — one
behaviour was checked against both substrates and they **agreed**, which is a result about
that behaviour and not a general licence. `fake-indexeddb` `6.2.5` **is not a browser**,
and `packages/storage`'s **44 tests** are unchanged and still run against it.

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
  an IndexedDB adapter, a browser entry point and a `chrome.storage` adapter — **which the
  website uses for its address and the extension uses for its own**, and **the extension uses
  from two different contexts**, which is the claim M9 slice 1 added a boundary rule for.
- A website client (`apps/web`) that renders all of it, with **persistence** and, since
  M7 slice 1, **the first styling in the product's history**.
- **An in-page client (`apps/extension/src/content-script/`), new at M9 slice 1**: it watches
  for an email field taking focus, offers a control inside a **shadow root**, and inserts the
  address **this device already holds**. **It reads `chrome.storage.local` directly** rather
  than asking the service worker — measured, not preferred: a content script injected with no
  `host_permissions` reaches the area on the `storage` permission alone, readable and
  writable, so the round trip this slice was designed to avoid is not needed and `activeTab`
  stays rejected. **It is a control inside somebody else's page, so two things follow that
  are worth stating rather than discovering.** Its styles live in the shadow root because the
  page's stylesheet can neither reach them nor be reached by them; and it acts on **nothing but
  the address**: **no provider is contacted from in-page**, no polling runs, and there is no
  copy, no side panel and no site association, because M9's slices 2 and 3 own those.
- A design-token layer (`packages/ui`) that both clients will consume, holding colour for
  **two declared schemes**, type, spacing, radius, two **measures**, and motion, and **no**
  layout and no component styles. **"No layout" is qualified, and the qualification was
  added by the verification pass because the sentence was false as it stood**: `METRICS`
  holds `measure-page` and `measure-prose`, which are line-length decisions and therefore
  layout decisions. What the layer does not hold is any position, grid, or breakpoint — the
  page's single `@media` query and its one grid are written in `apps/web/src/styles.css`,
  not named here. **And the correction is not a loosening**: a token layer that grew a
  `--grid-columns` would be the thing that ends it, and the honest form of "no layout" has
  to be able to survive one group of measure tokens existing.

The target state is two clients (website, extension) over that shared core. **M7 slice 1
(`spectral-swiss-foundation`) is applied, verified, synced, and archived** at
`openspec/changes/archive/2026-10-06-spectral-swiss-foundation/`, merged as proposal **#62**,
apply **#63**, verification-pass repair **#64**, sync **#65**. Its two claims are verified
by two different instruments, deliberately: **contrast** is pure WCAG arithmetic over two
hex values in `packages/ui/src/pairs.test.ts`, and **focus** is a **resolved** outline read
in real Chromium on the built page, compared against the same control unfocused. **No test reads a
rendered pixel's colour**, so how the product *looks* is still a human judgement and no
document in this repository claims otherwise.

**M7 slice 2 (`motion-and-reduced-motion`) is applied, verified, synced, and archived** at
`openspec/changes/archive/2026-10-07-motion-and-reduced-motion/`, merged as proposal **#67**,
apply **#68**, sync **#69**. **Its sync added nothing**, which is the state the amendment rule
exists to produce: every amendment was written into the change during apply, so the archived
delta and the promoted spec are the same requirement blocks — verified **verbatim, as whole
blocks and not by title**, with each archived copy re-checked after the archive rather than
trusted, because archiving is a move. `visual-system` went **5 → 8** requirements and
**14 → 24** scenarios; `mailbox-session` went **22 → 23** and **57 → 61**. `openspec list`
reports **No active changes**. It is also where the
sentence above
stopped being true — **"Motion is declared and used by nothing" was correct through slice 1 and
is deleted rather than reworded.** Three entrances now animate, on three hooks that already
existed (`.address__value`, `.inbox-row`, `.code`), each a single `@keyframes materialise`
whose **final frame is what the element already computes to** — which is what makes
`prefers-reduced-motion: reduce` a *removal* rather than a substitute timing, and why no fill
mode was needed. The block naming all three selectors sits **below** the entrances, and that
order is load-bearing: equal specificity means source order decides.

**M7 slice 3 (`website-sections`) is applied, verified, synced, and archived** at
`openspec/changes/archive/2026-10-07-website-sections/`, merged as proposal **#71**, Apply
**#72**, sync **#73**, archive **#74**. Its sync **added nothing beyond the delta**, the same
state slice 2 reached: every amendment was written **into the change** during apply, so the
delta and the promoted spec are the same requirement blocks — verified **verbatim, as whole
blocks and not by title**, **and re-verified against the archived copies after the archive**
rather than trusted, because archiving is a move: 7 blocks identical both times, and all 7
archived files byte-identical to their pre-archive originals by SHA-256. **`page-composition`
is a new capability** at **5 requirements / 14 scenarios** — the first to constrain what the
page *is made of* rather than what it does; `visual-system` went **8 → 9** and **24 → 28**, and
`website-client` **20 → 21** and **66 → 69**. `openspec list` reports **No active changes** and
`openspec validate --specs --strict` is **12 passed, 0 failed**.

**M7 slice 4 is applied, verified, synced and archived, so M7's exit criteria are met in scope and
M7 is closed**, and this file
does not say otherwise. It was taken rather than carried forward because M8 removed its only block:
an unbuilt `apps/extension` would have made the section fake UI, and with a manifest, a worker and a
popup it is simply work. **The section ships a depiction that renders no interactive element at
all** - not a `<button>`, not a `<a>`, not a `role`, and not a disabled version of one - because a
`Copy address` control inside a picture of a popup would be a control on the page that does nothing
when pressed, which is the same defect `extension-client` removed from the popup itself. **The two
whole-page sweeps `sections.spec.ts` used to enforce its absence were rescoped per region** rather
than deleted, each with a negative control planting the forbidden word into the running page, and a
new case reads Chromium's accessibility tree **at the region's own DOM object** over CDP to require
that nothing inside it is operable. **`packages/ui` is untouched at 38 tests**, which is the
measurement that matters: a rise would have meant the preview had introduced visual surface no
capability describes. **Its sync promoted four blocks and moved the counts by one requirement and
nine scenarios** — `page-composition` **5 → 6** and **14 → 20**, `extension-client` **6 → 6** and
**17 → 20** — each verified byte-identical against its delta, **and re-verified against the
archived copies after the move**, because archiving is a move and a move is the operation most
likely to quietly drop a file. **All six archived files are SHA-256 identical to their pre-archive
originals.**

**And the defect slice 3's own work produced is worth more than the sections.** The first version
put the footer **inside `<main>`**, and `App.test.tsx` **passed** — Testing Library maps `footer`
to `contentinfo` unconditionally. Chromium, asked over CDP's `Accessibility.getFullAXTree`,
reported **`sectionfooter` with zero `contentinfo` landmarks**: zero, while jsdom said one. That
is the **twenty-ninth** instance in this repository of a substitute platform hiding a defect the
real platform names, and the first one a change made *after* `website-client` recorded the
lesson. The footer is a sibling of `<main>` now, and `sections.spec.ts` reads the tree through
CDP **and plants the nesting into the running page as its own negative control** — without which
a reader answering `contentinfo` for any page at all would satisfy every landmark assertion in
the file.

**It is also the slice whose own browser spec found a product defect on its first run**, and
the finding is worth more than the feature. `InboxState`'s `checking` variant carried no
listing, so it was the one variant that could leave a client with nothing to show for the
length of a request, and `Inbox.tsx` rendered it as its own branch — **every poll unmounted
the inbox list and rebuilt it**. Measured in Chromium on the built page, with a
`MutationObserver`:

```text
5153ms DOM -[UL.inbox-rows]
5153ms DOM +[P.]
5156ms DOM -[P.]
5156ms DOM +[UL.inbox-rows]
5187ms START materialise on inbox-row
```

So the row re-materialised **every five seconds, for as long as the tab stayed open** — and
focus inside the list was destroyed, hover and text selection were lost, and the flash was
already visible to a user who had asked for no motion at all. `checkFailed` already kept the
last known listing and `state.ts` gives the reason — *"a failed check is a condition of the
inbox, not the loss of it"* — so `checking` now keeps it too, through one helper shared with
`refusalOf`. **This widened the change to a second capability**, and that was a real fork put
to the user rather than decided silently: `Inbox.tsx` disclaims judging what is true, so the
alternative was a client-side cache duplicating what the session already owns.

**Nothing about how the motion looks is verified, and the list is the point.** The browser
spec reads a **computed style** and an **event log**: it asserts that each entrance's
`animation-name`, `animation-duration` and `animation-timing-function` resolve to declared
tokens; that a `MutationObserver`-free element-identity marker survives a second identical
listing; and that `prefers-reduced-motion` changes what an element resolves to **without a
reload**. **No test reads a rendered pixel**, so whether the blur and the rise look right is
still a human judgement, and a human opening the page is the only instrument for it.

**M6, Website Hardening, is complete in scope**: its three slices are archived, and its
fourth candidate was **audited rather than built** — three of its four items were already
delivered and specified, and its two genuinely undelivered accessibility items (`visible
focus states`, `reduced-motion handling`) are CSS that M7's own Accent and Motion blocks
already place inside M7, so no fourth change was opened. **One of those two has now
landed**, at M7 slice 1: every interactive control draws a visible focus indicator, and it
is asserted rather than claimed. `reduced-motion handling` has **not**, and M7 slice 2 is
where it is owed. `docs/ROADMAP.md`'s slice table
records the audit with a file or a promoted requirement named for every claim. **The
earlier sentence in this file — "the roadmap's next milestone is M6, Website Hardening —
storage behind a shared `SpectreStorage` contract, the privacy controls, and the
error-state work" — was deleted rather than reworded**, because the error-state work it
named was already delivered by M3 and M5 and never owed by M6. **That audit also leaned on
a promoted requirement header which no longer exists** — *"This milestone builds structure,
not visual design"* — and M7's sync **renamed and amended it**, removing its
"SHALL NOT have introduced a design token or theme system" clause, which became false the
day slice 1 landed. The audit's conclusion is unaffected and `docs/ROADMAP.md` now says so
explicitly rather than quoting a heading that has been replaced.
**M6's first live browser run was delivered by `browser-verification`**, which closed the
real IndexedDB path and found the defect recorded above; it got its own change because at
the time there was no browser-automation suite in this repository. **One thing it did not
close: `use it externally`** and the unobserved polling cadence, and neither does anything
in M7. **M5 is complete in scope**: all four of its slices are archived, and the three
acceptance lines it could not deliver itself (`copy the OTP`, `return to a recent mailbox`,
`clear local SpectreMail data`) are M10's and M6's, as `docs/ROADMAP.md`'s table now
records. Reading M5 as unfinished is what kept three blocked slices being selected; that
correction is recorded in the roadmap's Project Status block. The extension build is M8
and the verification workflow (notifications, OTP copy/fill) is M10. Those numbers come
from `docs/ROADMAP.md` and must be read from there, not recalled: an earlier draft of this
file put storage at "M5–M6", which named a milestone from the layer it felt should come
next rather than the one the roadmap schedules.



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

- Framework(s): React `19.3.0` with Vite `7.3.6` for **both** clients, verified building,
  type checking, linting, and serving. The extension client is React **and** has a real
  Manifest V3 manifest, an unpacked `dist` that Chromium loads, **36** browser cases, and
  **25** unit tests for the content script alone — as of M9 slice 1. It was a placeholder with
  **no framework and no manifest** until M8, and that sentence is **deleted rather than
  reworded** because it became false the moment `static/manifest.json` landed. **Its entry points
  were a popup only, and that sentence is deleted too: M9 slice 1 added a content script**, so
  there is still no side panel and no options page, and **each of those two remaining absences is
  a requirement** (M11 owns the side panel), because a declared surface that renders nothing is
  fake UI. **The content script is built by its own `vite build`**, because a content script is
  loaded by Chromium as a single classic script: an `import` in it is a runtime failure on every
  page rather than a build warning, so `dist/content-script.js` carries no module specifier and
  needs no second file — asserted against the **built** artefact, not the source.

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
  forthcoming. A control over one reachable option cannot act. **It is styled, since M7
  slice 1, and every value it uses comes from the token layer.** `packages/ui/src/tokens.ts`
  is the single source; `packages/ui/src/tokens.css` is **generated** from it and
  `tokens-css.test.ts` asserts the committed stylesheet is byte-for-byte what its source
  renders, and **not one colour, radius, spacing step, type size, or duration is a literal
  in `apps/web/src/styles.css`** — a **measurement**, repeated by inspection on 2026-10-06,
  and since M7 slice 2 only its three motion-related categories are asserted, by the browser
  tier rather than by a boundary rule (see Setup & commands for exactly what each one does).
  **It moves, since M7 slice 2, on three hooks it already had.** `.address__value`,
  `.inbox-row` and `.code` each carry one `@keyframes materialise` whose `to` frame is
  the value the element already computed to, which is what lets
  `prefers-reduced-motion: reduce` be a **removal** — the block below the entrances sets
  `animation: none`, and no fill mode is needed anywhere. **Entry motion is what shipped,
  and only entry motion**: the roadmap's word was *"materialize/disappear"*, and an element
  React has unmounted is gone before any exit transition could run, so nothing here claims
  a disappearance. There is **no `transition` in the stylesheet at all**, deliberately, and
  the browser tier carries that as a tripwire rather than the requirement claiming it.
  The claims this
  establishes are narrow and are stated so: the page's colours are declared values with
  computed ratios, its controls are reachable with a **resolved** outline this product
  drew, and each entrance's `animation-name`, `animation-duration` and
  `animation-timing-function` resolve to a declared token. **It establishes nothing about
  how any of it looks** — no test in this repository reads a rendered pixel's colour, and
  none reads a rendered pixel's position either, so whether the blur and the rise read as
  right is a human judgement. The line above's "**no styling**" sentence was true
  through M6 and is **deleted rather than reworded**; styling is absent at slice 3's
  successor for a different reason, recorded there.
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
  disclaimed. **The sentence that said `apps/extension` "remains an empty placeholder" became
  false at M8 and is deleted rather than reworded** - it now holds a manifest, a worker, and a
  popup. **The reason the M7 `Extension preview` section was absent has since changed twice over,
  and the second change is why the section is here:** it was first blocked on an unbuilt client,
  then **unbuilt work on a client that existed**, and now it is built. **The section describes the
  popup and acts on nothing** - seven labels the popup itself renders, no interactive element of
  any kind, no provider named, and no capability the extension has declared absent (no content
  script, no side panel, no notification, no code copy or fill) and no polling interval, since the
  popup's count comes from a check somebody asked for.
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
  later**. `fake-indexeddb` **is not a browser**, and it remains the substrate for all
  44 of these tests — but **one of its behaviours has now been corroborated by Chromium**
  through the browser tier: that removing "everything this device holds" means
  `deleteDatabase` and not clearing `CURRENT_MAILBOX_KEY`. That is a fact about that
  behaviour, established by deliberately breaking it and watching both tiers go red.
  The blocked-`deleteDatabase` semantics above have **no** such corroboration. Two
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
  **`pnpm build` builds the website only** (as of M7); package correctness is established by
  `pnpm typecheck`, which is a separate gate. **`pnpm build` builds both clients as of M8** —
  `pnpm --filter @spectre-mail/web build && pnpm --filter @spectre-mail/extension build`, with
  `build:web` and `build:extension` for one at a time. **The sentence that said "There is still
  no extension build step — that is M8" became false at M8 and is deleted rather than
  reworded.**

- Testing: Vitest `3.2.7` at the workspace root, verified running **765 tests across
  42 files** via `pnpm test` (2026-10-08, at `in-page-address`'s apply stage, with
  `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory), counted from a
  JSON reporter **grouped by project** rather than read off a summary line:
  54 in `packages/core`, 89 in `packages/providers`, **149 in `packages/mail-parser`**,
  **155 in `packages/mailbox`**, **120 in `apps/web`**,
  **54 in `packages/storage`** (7 stored record, 30 IndexedDB adapter, 7 browser entry
  point, **10 `chrome.storage` adapter**),
  **50 in `apps/extension`** (**25** in `content-script.test.ts`, **8** in `Popup.test.tsx`,
  **9** in `provider-config.test.ts`, **3** in `service-worker.test.ts`, **5** in
  `popup-copy.test.ts`),
  **38 in `packages/ui`**, and **56 architecture boundary assertions**.
  **`in-page-address` moved `apps/extension` 25 → 50 and the boundary count 54 → 56, and moved
  nothing else.** **Every other total is identical to the baseline it recorded before proposing,
  and `packages/ui` stayed at 38 for the fourth time** - which is the measurement that mattered,
  because this slice adds a control inside a third party's page and `design.md` D7 commits it to
  **no new token and no new motion**: a rise would have meant visual surface no capability
  describes. **The two new boundary assertions are one rule: the extension's platform global is
  confined to a single module.** The pattern matches the bare identifier `chrome` *including inside
  string literals*, because `Reflect.get(globalThis, "chrome")` - the reflective spelling the
  shipped code uses - contains no `chrome` token outside quotes, so a pattern skipping strings
  would leave the only form this repository writes unguarded, silently. **The single permitted
  module had to be renamed** for it: while it was called `chrome-platform.ts` the rule fired on
  `import … from "./chrome-platform"` and reported two violations of the very requirement that
  mandates that import, and the fix chosen was the file, not a carve-out - a pattern exempted for
  any specifier containing the word would exempt a future one that reached the global.
  **`extension-preview` moved `apps/web` 114 → 120, `apps/extension` 20 → 25, and the boundary
  count 53 → 54, and moved nothing else.** The six client cases are the new region's own file;
  the five extension cases are the popup copy's exported module, and **`Popup.test.tsx` stayed at
  8** because the copy *moved* rather than changed - a string changing here would have shown as a
  movement there. **The one boundary assertion requires every label the website depicts to be a
  string the popup renders**, reported by name in both drift directions.
  **`packages/ui` stayed at 38 and that is the number that mattered most in this paragraph**,
  because `design.md` D6 committed this change to adding no token and no motion; a rise would have
  meant the preview had introduced visual surface no capability describes. Every package is
  untouched.
  **`pnpm verify` was run three times at this stage, not once, and the two reds found real
  things**: `format:check` failed on three files committed earlier in the change without Prettier
  having been run over them, and `lint` failed on the falsification harness itself - four temporary
  scripts in the repository root, which were **deleted rather than fixed**, since a measuring
  instrument is not a shipped file.
  **The paragraph below is `M8`'s and is kept because the deltas are only readable
  against each other.**
  **`M8` moved `packages/storage` 44 → 54, `apps/extension` 0 → 20, and the boundary count
  51 → 53, and moved nothing else.** The two new boundary assertions are the live-check
  quarantine rule and the rule stopping a client restating a value `packages/providers` owns.
  **`apps/web` was required to stay at 114 and did**, which is the same check M7 slice 1 used
  to show styling had moved no element: a movement there would have meant the website changed,
  and M8 has no business changing it.
  **The paragraph below is `M7 slice 2`'s and is kept because the deltas are only readable
  against each other.**
  **`M7 slice 2` moved `packages/mailbox` 153 → 155 and `apps/web` 113 → 114, and moved
  nothing else.** The two mailbox tests are the requirement that a check in flight keeps
  what is already known and the unit-tier half of the row-identity claim; the client test is
  the matching assertion that the row element on screen is the same node while a further
  check runs. **`packages/ui` stayed at 38 and the boundary count stayed at 51, and the
  second is a decision rather than an omission** — D14 records why no rule was added for
  literal motion values, and the requirement is enforced in the browser tier against a
  resolved duration instead. `packages/core`, `packages/providers`, `packages/mail-parser`
  and `packages/storage` are untouched by this slice.
  **`packages/ui` went 36 → 38 at slice 1 and the two tests are not that slice's own
  work** — the
  verification pass found that the generated compliance table mislabelled every non-text
  pair, and one test asserts the standard's name survives two standards sharing a ratio
  while the other asserts the emitter's file exclusion is honest. Both are recorded under
  `design.md` D15; a count that moves after a change is merged is a count that was wrong
  before somebody measured it again.
  **`At slice 1` `apps/web` was 113 and that was the number that mattered most in that
  paragraph.** M7
  slice 1 adds `className` to twelve components and changes **no** element, no accessible
  name, and no `data-testid`, so the client suite's count is **required** to be unchanged; a
  movement would have meant markup moved and would have to be explained before anything else
  was looked at. The boundary count went 47 → 51 for the four new CSS rules, and
  `packages/storage`, `providers`, `mail-parser`, `mailbox`, and `core` are untouched.
  **The two preceding figures in this paragraph are the previous stage's**, and they are
  kept here rather than replaced so that the deltas are readable: 649 across 31 with 47
  boundary was the `browser-verification` measurement, where `apps/web` went 112 → 113 for
  the regression test that holds a write open across an inbox transition and the boundary
  count went 46 → 47 for the rule requiring every shipped browser spec to be collected by
  the browser suite and by nothing else.
  **The previous figures in this paragraph were wrong in two ways, and both were found
  by measuring rather than by reading**: it recorded `apps/web` at 96 when the real count
  was 108 before this slice, and it recorded 3 provider-configuration tests when there
  have been 4. The split was never checked against the file. Counts here are now taken
  from `--reporter=json` and grouped by project, so the next reader is measuring rather
  than adding up.
  **Those counts cover one tier only.** There are now **three runners**: Playwright
  `1.63.0` in **two configurations**.
  **The website's tier: 37 test cases in 4 spec files** in `apps/web/e2e/` - `storage.spec.ts` (**6**,
  count **unchanged by M7 slice 1**), `focus.spec.ts` (**6**, added by slice 1),
  `motion.spec.ts` (**9**, added by slice 2) and `sections.spec.ts` (**16**, added by slice 3
  and **13 → 16 at slice 4**, whose three new cases are the non-operable depiction read from
  Chromium's own accessibility tree at the region's own node, the labels-are-the-popup's-own
  case, and the declared-absent-capability case - **and whose only two edited cases are the two
  whole-page sweeps slice 4 rescoped per region**, each now carrying a negative control).
  That the storage six kept their count is
  the evidence styling changed no behaviour that tier already covered: had a `className`
  altered a control's role or accessible name, one of those six would have stopped finding
  its target. **Slice 2's nine are new cases in a new file, so nothing that tier already
  covered was replaced** — and the one storage spec that changed at all (`storage.spec.ts`)
  changed only its gate's spelling, with its assertions untouched. **A "13 specs" figure
  appears in this change's own `tasks.md` and was a miscount** — 12 cases predate slice 2
  and the motion file adds nine — corrected against Playwright's own "Running 21 tests".
  **The extension's tier: 16 cases in 4 spec files** in `apps/extension/e2e/` — `manifest.spec.ts`
  (**6**), `popup.spec.ts` (**8**), `measurement.spec.ts` (**1**) and `alarm-floor.spec.ts`
  (**1**), added by M8. **Both are run by the one documented `pnpm test:browser`**, which
  builds both clients and then runs the website's tier followed by the extension's.
  **The extension's tier has its own `playwright.config.ts` and its own `testDir`, and a
  boundary rule requires every shipped `*.spec.ts` to be collected by a browser suite **and
  by exactly one** — with one per-client negative control, because a rule that watched only
  `apps/web` would have passed with all sixteen of the extension's specs uncollected.**
  It is a separate suite because two tiers execute
  different code against different platforms, and a single runner claiming both would let
  a browser-free `pnpm test` report as covering a browser suite — a boundary rule asserts
  they are disjoint in both directions.
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
  passing). Playwright `1.63.0` is **now a workspace dev dependency of `apps/web`**,
  matching the version the spike already used, because the browser tier needs it; the
  spike's own copy stays outside the workspace and is still not imported by
  application code. **There is still no Playwright suite for the M0 spike's own
  live host-permission check** — that probe remains deferred, and the new suite is
  offline by design and does not cover it.

- Infra / deploy: none. A GitHub Actions workflow exists at `.github/workflows/ci.yml`
  and runs the same root commands a maintainer runs, with no divergent flags. It
  **ran green on 2026-10-02** (run `36935477321`; the `verify` and
  `spike self-test` jobs both SUCCESS), which also confirms the pinned action
  majors and Node version resolve on a clean Linux runner.
  Action majors were looked up rather than assumed — an earlier draft of this
  workflow named checkout `v5`, setup-node `v6`, and action-setup `v4`, and all
  three were wrong. It has never yet been made to *fail*, so its ability to catch
  a regression is unproven.
  **A third job, `browser`, was added by `browser-verification`: it installs Chromium
  and runs `pnpm test:browser`, as a sibling of `verify` with its own timeout.** It is
  **not** folded into `pnpm verify` or into the `verify` job, because
  `build-and-verification` requires `pnpm verify` to run with no browser installed and
  that is verified — with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and
  by reading every script `verify` names.
  **That job hung five times and the cause is now measured, and it was this repository's
  own `webServer` command.** Five runs produced `Running 6 tests using 1 worker` and then
  silence. Two repairs were spent on the wrong theory and are recorded because each was
  reasonable: raising the job ceiling 20 → 30 was **measured to be useless** (the second
  silence was *longer*, 29m34s, which refutes "merely slow" and establishes an
  indefinite hang), and `--disable-dev-shm-usage --no-sandbox` was **measured false** —
  Chromium launched on the same runner in **250ms** and `/dev/shm` there is **7.9G**.

  **What finally diagnosed it was per-step ceilings, because a job-level one names no
  step.** Under them the job printed the finding the earlier kills had destroyed: **all
  6 specs passing in 2.6 seconds, then no `6 passed` summary line at all**, and the
  following step failing with `http://127.0.0.1:4173/ is already used`. So the tests
  were never the problem and **the summary's absence was never evidence about them** —
  Playwright hangs shutting the webServer *down*. `pnpm preview` spawns `vite` as a
  child, so killing what Playwright spawned kills the wrapper and orphans the real
  server, which then holds the inherited stdout pipe open and port 4173. The fix is to
  **invoke `vite` directly**, so Playwright owns the process it started.

  **Two lessons are recorded because both cost real time.** With `CI=true` Playwright
  picks the **dot** reporter, which prints progress without newlines, and a killed step
  discards it — so *four runs of missing test output were the reporter, not a hang*. And
  a diagnostic is only worth its cycle if it can fail for the reason it exists: the first
  version ran before the build and died in two seconds on `dist` not existing. **The
  `browser` job passes in 58 seconds.**

  **And it has since been run repeatedly and passed**, which was checked rather than
  assumed, because this file previously carried a claim that the job *"has never run in
  CI"* and that claim was false: runs `37374154930`, `37376921511`, `37377218976` and
  `37426170806` (2026-10-05/06) each show a `browser` job with `conclusion: success`.
  **The first run of that job hung five times, and it has been green on GitHub-hosted
  runners ever since** — the 58-second figure above is a CI measurement, not a local one.

  **`spike self-test` is cancelled for an unrelated reason, and the JSON is the only
  instrument that says so.** That job is untouched by this change — no browser, no
  Playwright, 26 seconds when it runs — yet it was cancelled on four runs, each at almost
  exactly 15 minutes with **no log archive at all** (a 22-byte empty zip). The API is
  what distinguishes this from a hang: **`runner_name` is empty and `steps` is 0**, so the
  job **never received a runner**. One rerun waited **1215 seconds** in queue before its
  own 10-minute `timeout-minutes` expired, which is exactly where the repeated 15-minute
  duration comes from. **This is GitHub-hosted runner capacity being exhausted**, not a
  defect in anything under test — recorded because a job reporting `cancelled` with no
  logs is indistinguishable from a hang unless you read the JSON.

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
first and offers a stored address back after the provider confirms it**. Since M6 slice 3 it
**offers a two-step confirmed control that makes this browser forget that address**, with
the mailbox left on screen and the page saying a later visit will not offer it back.
`LocalData.tsx` is the only new component; the limits bullet that said no button could
delete the stored address was **removed rather than reworded**, because it became false the
moment the button landed. **It is styled as of M7 slice 1**, and that sentence's former
form - *"It has **no** styling - that is M7"* - was true through M6 and is **deleted rather
than reworded**. **What the styling changes here is worth stating precisely, because
"styled" is the weakest claim in this file**: the page's colours are **declared** values
whose pairs are asserted as WCAG ratios in both schemes; every control is keyboard-reachable
with a **resolved** outline this product drew, read in real Chromium on the **built** page;
and not one colour, radius, spacing step, type size, or duration is written as a literal in
`styles.css`, so every colour and size it uses is one a test can name. **The narrower
wording replaced a false one**: this file said *no literal value appears in `styles.css`*,
and literals do appear. **Measured 2026-10-06 by scanning the shipped stylesheet with
comments stripped: six**, and this file's previous sentence named five of them correctly —
`translateY(1px)` (303), `max-height: 28rem` (458), the single breakpoint
`@media (max-width: 34rem)` (653), `grid-template-columns: 1fr auto` (344) and
`width: 100%` (346) — plus a sixth the previous sentence missed, `grid-template-columns: 1fr`
(666). **A first draft of this correction claimed the last two "are gone, reworded out with
this sentence", which was false**; they are in the file, and the reason the draft got it
wrong is that its scan pattern covered `px|rem|em|ch|vh|vw|ms|s` and so counted three
lengths while the paragraph talked about six literals. **The pattern's coverage is stated
because a measurement that silently measures less than the sentence beside it is the same
defect as a check that is narrower than its rule.**

Those six are lengths, fractions, percentages and `auto` — **not one of them is a colour, a
radius, a spacing step, a type size or a duration**. That is precisely why a blanket "no
literal" rule would be wrong rather than merely broad: it would fire on six legitimate
declarations and still say nothing about the five categories above.

**"A boundary rule enforces the categories above and not the rest" was false, and it was
false in the direction that reads like a guarantee.** `stylesheetViolations()` in
`tests/architecture/boundaries.test.ts` was read on 2026-10-06 and it applies exactly three
things: the three `REMOTE_CSS_PATTERNS` (`@import` of a URL, `@import` of a bare string, a
`url()` pointing at an origin), the two `FOCUS_SUPPRESSION_PATTERNS` (`outline: none|0` and
`outline-width: 0`), and `collectUnresolvedTokens`, which requires every `var(--…)` in the
stylesheet to resolve against the token layer or a local declaration. **No rule anywhere in
this repository checks that a colour, a radius, a spacing step or a type size is a declared
token.** Those four categories are **measured, not asserted** — and a claim broader than its
own rule is the defect this file exists to catch, not a nicety, so the sentence is deleted
and the measurement it was standing in for is stated in its place.

**Two of the categories gained a real assertion in M7 slice 2, in the browser tier and not in
a boundary rule.** `apps/web/e2e/motion.spec.ts` reads the **built** stylesheet and requires
that it name no duration, no easing function and no motion distance literally. That is a
different instrument from a boundary rule: it runs on what a browser actually loaded, and
it covers exactly the three categories motion introduces. **The remaining three — colour,
radius, type size — are still only measured**, and this file now says so instead of implying
otherwise.
**None of that is a claim about appearance.** A human opening this page is the
only thing that can say whether it looks right, and no gate in this repository stands in for
that. The
page's provider configuration is reachable and testable without a network
(`apps/web/src/provider-config.test.ts`), but **nothing has been verified against the
live Guerrilla Mail API from a browser**, so no claim is made about what a real page
does on a real network - and in particular **no claim is made about how a real
provider responds to being polled every five seconds**, because that has never been
run. The polling loop is asserted by reading the delay the scheduler was
asked for, which proves the cadence this repository computes and nothing about a
provider's tolerance.

**The sentence this replaces said the removal had never been run in a browser. It has,
and it found the control was not there.** `jsdom` implements no IndexedDB, so the whole
delete path a user would take used to be exercised only against `fake-indexeddb`; the
browser tier now runs it against real Chromium and real IndexedDB, via
`pnpm test:browser`. Two claims survive unchanged: **the live provider is still not
involved** — every provider response is a recorded one — and **the blocked-removal
semantics are still only a `fake-indexeddb` measurement**, because the browser suite
does not produce that event.
**There is now a third build in the extension's chain, and it is not optional.**
`pnpm --filter @spectre-mail/extension build` runs `vite build` for the popup, then
`vite build --config vite.content.config.ts` for the content script — **and the content build
must be able to run after the popup build without erasing it**, which is why
`vite.config.ts` sets `emptyOutDir: false`. **That setting has a cost worth stating rather than
discovering: no build ever removes an artefact a previous build emitted.** A stale
`content-script.bundle.js` survived a restored source *and* a correct rebuild beside it during
this change's falsification pass, and was read as evidence about a mutation long after it was
built. **`pnpm test:browser` removes `dist/` before building**, and that is the only place the
repository does so.

`pnpm dev:extension` still does not exist, and is not documented, because nothing in this
repository has run the extension from a dev server.



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

**The root install now brings a browser requirement with it for the first time.**
`@playwright/test` `1.63.0` is a dev dependency of `apps/web`, so `pnpm install` resolves
the package but downloads **no browser**: `pnpm test:browser` needs

```bash

pnpm --dir apps/web exec playwright install chromium

```

which is why `pnpm verify` is untouched by any of this — it must keep working with no
browser present. `--dir apps/web` rather than plain `playwright`, because pnpm does not
put a workspace member's binaries on the root's `PATH`.



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



### Verified project tool: the browser tier

Verified on `Windows 11 / Node.js v26.10.0 / pnpm 12.6.0` on 2026-10-06, and again on
2026-10-07 for both tiers:

```bash

pnpm test:browser

```

Playwright `1.63.0`, **two configurations, 9 spec files and 73 test cases** - **Chromium
only**. The command builds **both** clients, then the in-page fixture, and then runs the two
suites in order: the website's **37** in `apps/web/e2e/`, and the extension's **36** in
`apps/extension/e2e/`.

**The website's 4 spec files and 37 cases** - `storage.spec.ts`
(**6**), `focus.spec.ts` (**6**, added by M7 slice 1), `motion.spec.ts` (**9**, added by
M7 slice 2) and `sections.spec.ts` (**16**; **13** added by M7 slice 3 and **three** added by
M7 slice 4). The
command serves `apps/web/dist` with `vite preview` on
`http://127.0.0.1:4173` with `--strictPort`, because the page under test is the **built**
`<App />` with no props - the page a user receives, not a composition mounted by a test.

**Slice 4's three, and the one thing about them worth carrying.** They are: the depiction exposes
**nothing operable**, read from Chromium's accessibility tree **at the region's own DOM object**
over CDP's `Accessibility.queryAXTree` rather than from `getFullAXTree` - a whole-tree read cannot
answer *"does this region expose anything operable"* without substituting this repository's
judgement about which buttons belong elsewhere, so the scoping is the platform's; every label the
**built** preview shows is one the popup itself renders, read from the served page and checked
against `POPUP_COPY` so the chain declared → rendered → the popup's own value is whole rather
than a proxy; and the preview names no capability the extension has declared absent and no
polling interval. **The two whole-page sweeps slice 3 used to enforce the section's *absence*
were rescoped per region rather than deleted**, each with a negative control planting the
forbidden word into the running page - without which a sweep matching nothing would satisfy every
assertion above it, and the exemption would be indistinguishable from a pattern that had silently
stopped firing. **The extension's 16 did not move**, which is the check that this change did not
touch the extension client.

**The extension's 5 spec files and 36 cases** - `manifest.spec.ts` (**9**; **6** added by M8 and
**three** by `in-page-address`), `popup.spec.ts` (**8**), `in-page.spec.ts` (**17**, added by
`in-page-address`), `measurement.spec.ts` (**1**) and `alarm-floor.spec.ts` (**1**).
**It has no `webServer` at all**, which is not an omission: it loads `apps/extension/dist`
as an unpacked extension through `chromium.launchPersistentContext`. **Two flags and an
absolute path are all it takes, and this was measured by getting it wrong four ways** —
`--load-extension` alone loads nothing, a **relative** path silently loads nothing,
`channel: "chromium"` alone loads nothing, and a headed window loads nothing either. **No
error message says any of this**, so `apps/extension/playwright.config.ts` exports one
`extensionFlags()` helper that every spec calls rather than each spelling them.
`--user-data-dir` must **not** also be passed as an argument alongside
`launchPersistentContext`'s first parameter.

**`in-page.spec.ts`'s 17 cases need a page, and it is served by Playwright's own router rather than
by a file server** — on a reserved `.invalid` origin, with the extension loaded on **every** request.
**That choice is a measured one about a real platform rule, not a simplification.** A content script
runs in the **isolated world**, so its `globalThis` is not the page's: the first version of the probe
read a page global and got `null` on every arm, *including one read before any insertion that should
have been the empty string*, and drew the exact inverse of the right conclusion. So the fixture
publishes React's state into the **document**, which is the one channel a content script and a page
genuinely share. **`StrictMode` is deliberately absent** — the probe measured each dispatched event
arriving *twice*, and using it would make the browser tier assert a doubled list with nothing to do
with the product.

**Two of the 17 are worth naming because they are evidence that was missing.** One requires the
content script to run on a **plain-http** page, because `content_scripts.matches` declares both
schemes and until this pass **every case ran over `https`** — half the declared reach was
unexercised. And one compares `host_permissions` against the origins the suite actually scripts,
derived from the recorded provider's own table rather than retyped, because **adding
`https://example.com/*` to the manifest used to leave every case green** while declaring reach no
shipped surface reaches.

**What it establishes.** That the shipped page, in real Chromium, reads real IndexedDB
through `createBrowserStorage()`, writes a created mailbox and reads it back **through
the platform's own API**, offers a stored address back only after the provider confirms
it, and — after a confirmed removal — leaves `indexedDB.databases()` empty, including a
store this build does not recognise. **And, since M7 slice 1, that every interactive
control the page offers is keyboard-reachable and shows a focus indicator whose resolved
outline — style, width, and colour — is present, non-zero, in the accent the token layer
declares, and **different from the same control unfocused**. That last clause is the one
that does the work: it is what makes a permanent outline fail, and therefore what stops a
ring the browser invented from satisfying a claim about a ring this product drew.

**And, since M7 slice 2, three things about motion.** That each entrance's
`animation-name`, `animation-duration` and `animation-timing-function` resolve to a
**declared token**; that under `prefers-reduced-motion: reduce` **no element carries an
animation at all** while the same sweep finds every one of them without the preference,
**without a reload**; and that **a row already on the page is the same DOM node through a
later poll** — element identity, read as a marker set on the node. That last one is **read while a
check is genuinely in flight**, waited for rather than timed: the marker is only read once the
page is observably in `checking`, with the ceiling taken from `INBOX_POLL_CEILING_MS` —
**imported from `packages/mailbox/src/cadence`**, not hand-picked, because a number chosen to
be large enough is the recorded defect with a bigger constant. `RecordedProviderOptions.listingGate`
is **a function of the one-based listing count** so a spec can hold one listing while answering
another, matching the `holdListing` gate `apps/web/src/Inbox.test.tsx` already used, and
`deferred()` moved into `recorded-provider.ts` so two specs cannot hold a listing open by two
different spellings. **The hold is a reliability measure and not the repair** — measured with
the rebuild defect applied and the hold removed, the suite still catches it in 4 runs of 4; what
catches it is the wait. The hold takes a flaky 2-of-3 read to a dependable one. See the change's
`design.md` D18 and D21.

**And, since M7 slice 3, thirteen cases about the page's composition** — and **one of them is
the most important assertion in the browser tier.** `sections.spec.ts` reads **Chromium's own
accessibility tree over CDP's `Accessibility.getFullAXTree`**, not a role query, because a role
query is the instrument that lied: **Testing Library maps `footer` to `contentinfo`
unconditionally, so the first version of this change shipped a `<footer>` inside `<main>` and
`App.test.tsx` passed.** Chromium reported **`sectionfooter` with zero `contentinfo` landmarks**
— zero, while jsdom said one. That is the **twenty-ninth** instance in this repository of a
substitute platform hiding a defect the real platform names, and the first one a change made
*after* `website-client` recorded the lesson.

So the footer is a sibling of `<main>`, and the file carries **the defect as its own negative
control**: it plants the nesting into the *running* page and requires the same reader to report
the landmark gone. Without that, a reader that answered `contentinfo` for any page at all would
satisfy every landmark assertion in the file.

The other twelve read the stated region order from the built DOM, resolve the accent on its
three surfaces from computed styles, require **no region to name a licence or a second
provider**, and sweep the **built** stylesheet for literals in the five categories.

**And one assertion there was a proxy until a mutation found it.** *"The brand mark is drawn by
the page"* asserted `page.locator("img").count() === 0`, which **survived** replacing the inline
`<path>` with `<image href="/mark.svg">`: an `<image>` inside an `<svg>` is not an `<img>`, and
the request was same-origin, which `recorded-provider.ts` `continue()`d **without recording it**.
The assertion is now the thing it names — the mark must *be* an inline `<svg>` drawing a
`<path>`, with no `<image>`/`<use>`, **and** the page must have requested **no image or font
file at all**, so a webfont is caught too. `ProviderTraffic` now carries **every** URL the page
requested whatever its origin. Both halves were falsified separately.

**And, since M8, the extension's tier.** That the built `dist` loads as an unpacked
extension in a real Chromium; that **Chromium parses its manifest to the same host permissions
the file declares** — accepted, which is **not** the same as *granted*, and the difference is
stated in the case that reads it: every provider response here is fulfilled by the harness, so
**nothing in this tier exercises a grant**, and the only observable of one is a cross-origin
`fetch` succeeding, which is the quarantined M0 probe; that `chrome.storage` round-trips a
created mailbox back through the
platform's own API; that **fallback works** — Mail.tm answering 503, Guerrilla Mail serving
the mailbox, and the popup naming the provider that actually served it; that the popup
requests **no origin the tier did not script**; that the popup's stylesheet names **no colour,
radius, spacing step, type size or duration** in the **served** sheet; that a **user-asked**
inbox check reaches the provider and nothing polls on its own; that the service worker survived
a **30 000 ms** idle window; and that `chrome.alarms` stores every requested period unchanged.

**Three extension findings are worth carrying because each is a platform behaviour that
silently produces nothing.** Loading an unpacked extension needs `--load-extension=<ABS>` **and**
`--disable-extensions-except=<ABS>` together, with an absolute path; **every other combination
tried loads nothing and reports no error.** Waiting for the address to appear on the popup does
**not** wait for the `saveMailbox` write, so specs poll the stored record instead.
**`chrome.storage` survives a new browser context in the same profile**, so every spec must clear
it or inherit the previous one's mailbox.

**What it does not establish, and this list is the point:**

- **Nothing about how the page looks.** The focus specs read a **computed style**, the
  contrast specs read **WCAG arithmetic**, and since slice 3 the composition specs read the
  **DOM**, a **computed style**, and **Chromium's accessibility tree**. None of those is a
  rendered pixel: no test in this repository reads a rendered pixel's **colour or position**,
  so whether a section is balanced, whether the grid reads as three columns, and whether the
  hero's hierarchy works are all **outside every gate here**. All of them are exact about what
  they measure and silent about whether the result is *good*, and no document in this
  repository claims otherwise. **A human opening the page is the only instrument for that,
  and it is `tasks.md` 11.2 — deliberately left unticked, because an agent opening the page is
  not the judgement the task asks for.**
- **Nothing about how the popup looks either, and this is the same fourth limit rather
  than a new one.** The extension's specs read the **built manifest**, the **DOM**, a
  **served stylesheet**, and an **accessibility-free** Chromium extension context. None of
  those is a rendered pixel, so **no test in either tier reads a rendered pixel's colour or
  position**, and `tasks.md` **12.1** — "load the extension in a real browser and look at it"
  — is **deliberately left unticked** in this change. An agent opening a popup is not the
  judgement the task asks for.
- **Nothing about a service worker's actual lifetime.** The measurement is a **bound**, not a
  figure: the worker was alive when the 30 000 ms window closed, so the termination point is
  unmeasured and no document here claims one.
- **Nothing about when `chrome.alarms` fires.** The suite establishes what the API
  **stores**; Chrome's documented **packing** of recurring alarms to at most once per 30 seconds
  is a separate behaviour this repository has still not observed. `docs/PROVIDERS.md` §4.1
  records both halves, and the second is the open question `extension-foundation`'s D1 leaves.
- **Nothing about a live provider — in either tier.** Every provider response is a
  **recorded** one, imported by name from `packages/providers`, and any other origin is
  aborted **and reported by name**; the extension's tier additionally asserts that it
  **requests no origin it did not script**. `use it externally` remains unverified, and a
  stored mailbox has still never been reconciled against a live Guerrilla Mail session. The
  one live call in this repository is `apps/extension/e2e/live-host-permission.mjs`, which is
  **quarantined from all three suites** and enforced by a boundary assertion.
- **Nothing about how a real provider tolerates being polled.** The cadence assertions
  read the delay the scheduler was asked for; no live provider has been polled here.
- **Nothing about Firefox or WebKit.** One engine is configured, on purpose: adding a
  project per engine would turn "verified" into "verified somewhere" without adding
  evidence about the claim.
- **Nothing about a blocked `deleteDatabase`.** The suite does not produce that event, so
  the queued-removal semantics remain a `fake-indexeddb` measurement.
- **Nothing about how the in-page affordance looks inside a real third party's page — and this
  limit is larger than the usual one, because the surface under test is somebody else's CSS.**
  The 17 in-page cases read the **DOM**, a **resolved computed style**, the page's own
  `querySelectorAll`, and the **real React 19** state the field holds. None of those is a
  rendered pixel, and the fixture is **hostile by construction** — it links
  `button { display: none !important }` precisely so that "the page's styles do not reach the
  control" is not satisfied for free. That proves the shadow root **isolates**; it says nothing
  about whether the control reads as right, legible or un-ugly in a page nobody here designed.
  **`tasks.md` 10.1 — load the extension on a real site and look at it — is deliberately left
  unticked**, because an agent opening a page is not the judgement the task asks for.
- **Nothing about any browser other than the one that ran.** Chromium, on **one machine**
  (Windows 11) and on GitHub-hosted Linux runners. It is now repeatable — the `browser` job
  has run and **passed** in CI since run `37374154930` (2026-10-05) — but repeatability on
  one engine is not coverage of the others, and adding a project per engine would turn
  "verified" into "verified somewhere" without adding evidence about the claim.

**Two tool hazards, both of which produced a false green before being fixed.**

`pnpm.cmd` **cannot be spawned from Node** on this machine (`EINVAL spawnSync`). The
falsification harness invoked `pnpm` anyway, got empty output, and its logic read "no
failing titles" as **green** — reporting two mutations as uncaught when nothing had run.
It now invokes `node` directly and reports **`harness-error`** when an output contains
neither a passed nor a failed count. A check that did not run is not a check that passed.

`passWithNoTests` is **Vitest's option, not Playwright's**, and `tsc` rejected it with
`TS2769` when it was copied across. The property wanted is real and is Playwright's
default instead: it exits non-zero with `No tests found` when `testDir` matches nothing.

**Where the suite lives, and why that is not arbitrary.** It is in `apps/web/e2e/`
because **`tests/` is not typechecked** — it has no `tsconfig`, and `pnpm -r` covers
workspace members only — so a suite there would run while its types were never checked.
It also puts the specs under `apps/web/tsconfig.json`, which was widened to include
`e2e`, `vite.config.ts`, and `playwright.config.ts`.



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

**After archiving, `openspec validate <change> --type change --strict` fails — and the
message reads like data loss.** Verified 2026-10-05 at M6 slice 3: it reports
*"Change must have at least one delta. No deltas found."* on an archived change whose
deltas are present, complete, and byte-identical to the promoted specs. **Measured, not
inferred:** the identical error appears for `mailbox-adoption`, archived in an earlier
session, so it is OpenSpec 1.13.2's behaviour for a change that is no longer active.
`openspec list` and `openspec status` both report no active changes, which is the correct
end state.

The checks that still mean something **after** an archive are `openspec validate --specs
--strict` and a **byte-for-byte** comparison of each archived delta block against the
promoted spec — compare the *whole block*, not its title, because a hand-typed paraphrase
keeps the heading and loses the text. Re-run that comparison against the **archived
copies**: archiving is a move, and a move is the operation most likely to quietly drop a
file.

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
M6 slice 3 apply stage, again after the `browser-verification` apply stage, and again after
the M7 slice 1 apply stage and its verification-pass repair, and again at M9 slice 1's
apply stage on **2026-10-08**:

```text
pnpm typecheck     9 of 9 workspace projects run tsc --noEmit
pnpm lint          exit 0
pnpm format:check  All matched files use Prettier code style
pnpm test          42 files, 765 tests passed
pnpm build         vite 7.3.6, dist emitted for BOTH clients
pnpm verify        exit 0
```

**`pnpm verify` was run six times at M9 slice 1's apply stage, and the two reds are named rather
than the sixth counted.** **The first was red, on two things, and neither was a flake.**
`format:check` failed
on the two files this change's falsification repairs had edited — a gate nobody had run between
two rounds of test edits — and `lint` reported **three `react-refresh/only-export-components`
warnings** on the in-page fixture, a file that had never been linted because it did not exist.
**The fourth was red again, on `format:check` alone**, for the same reason and on a file this
change had edited a third time — which is the point of running the gate rather than assuming it:
**the count of files Prettier rejects is not a fixed property of the change, it is a count of
edits made since Prettier last ran.** **A warning is not a failure, and `pnpm lint` still exited
`0`** on the first run, so that part is recorded as a fact
about a red gate rather than about a rule: the fixture is a **build entry point**, it has no
exports *because nothing imports it*, and the rule's premise — that a module is also a component
library — is not true of it. **The fix was a config block scoped to `e2e/fixtures/` by shape,
not a file-level suppression**, so a second entry-point fixture is covered by existing rather
than by remembering.

**`pnpm test:browser` was run thirty consecutive times at this stage, in three blocks of ten,
counting failures: 30 passed, 0 failed, 36 cases on every run.** The precedent in this file is one
run in three failing on a weak precondition, and a first green run is a fact about one execution — so
ten, and then ten more, because **the second block exists for a reason worth recording**: a
comment-only correction landed between the first two, and rather than reason about whether that
invalidated the first block, a second block was run from scratch. **The third block is on the tree
being committed, with one exception stated rather than smoothed over** — a comment in
`boundaries.test.ts` was corrected *during* it. **That file is a Vitest file and the browser tier
never reads it**, and the correction is a comment, so what was under test did not change; **but a
block described as frozen while a file moved underneath it is the same claim this file has retracted
twice**, so the exception is recorded rather than relied upon.

**`pnpm verify` was run three times at `extension-preview`'s apply stage, and "All exited `0`"
above is the third run, not the first.** That is worth recording because the two reds were real
and neither was a flake: the first failed **`format:check`** on three files committed earlier in
the same change without Prettier having been run over them - a gate nobody had run between two
commits - and the second failed **`lint`** on the falsification harness itself, four temporary
scripts in the repository root. **They were deleted rather than fixed**, on the grounds that a
measuring instrument is not a shipped file and a measuring instrument left in the root becomes
something every future `pnpm lint` has an opinion about.

**`pnpm build` emitting two lines is M8's, and it is the first time that block's property
has changed since it was written.** The project count went **8 → 9** for `apps/extension`,
and the build now emits `apps/web/dist` **and** `apps/extension/dist`. **A maintainer
reading the old figure would conclude the extension is not built**, so the line is corrected
here rather than left to look like a typo.

**And `pnpm verify` was run three times on this change, not once — twice green and once
`exit 1`, and the red one found something no test could.** The first run failed
`pnpm typecheck` on `packages/storage/src/chrome.test.ts`, which passed every unit test it
had: `createMailbox` derives `Mailbox.provider` from the credential discriminant, and the
fixture was also passing it explicitly. **Vitest does not typecheck**, which this file has
recorded twice; what is new here is the count moving on it — a fixture shape that fails
`tsc` while passing every assertion written against it.

**Below is `M7 slice 3`'s figure of 35 files and 694 tests, kept because the delta is only
readable against it.**

```text
pnpm test          35 files, 694 tests passed
pnpm build         vite 7.3.6, dist emitted
pnpm verify        exit 0
```

**694 is slice 2's figure and it is also slice 3's, and the second time it did not move is
worth stating.** Measured from `--reporter=json` grouped by project, slice 3 leaves `packages/core`
54, `packages/providers` 89, `packages/mail-parser` 149, `packages/mailbox` 155, `apps/web` 114,
`packages/storage` 44, `packages/ui` 38 and the architecture boundaries **51** — **every total
identical to the baseline it recorded before proposing.** Two reasons, and both are structural
rather than luck: **`pairs.test.ts` is table-driven, so declaring a new contrast pair adds no
test**, and slice 3 added **no unit test at all** — all thirteen new cases are in the browser tier,
because every claim the change makes is about the built page's structure.

**A task predicted the `packages/ui` count would rise and was wrong**, and it is corrected in
`tasks.md` in place rather than reinterpreted: a task that names a number and is wrong about it
is worse than one that does not name a number.


**The paragraphs above this one are slice 2's, kept because the deltas are only readable
against each other.** `691` was the figure at slice 1's verification-pass repair and `694`
was slice 2's, the difference being slice 2's two new mailbox tests and one new client test.
Slice 2's `pnpm verify` also exited `1` on its first run, on `format:check`, for a reason worth
recording: the Motion prose the generated design document carries quotes the roadmap's own word
as `*materialize/disappear*`, and Prettier normalises asterisk emphasis to underscore emphasis
— so the emitter wrote a region `format:check` rejected while the byte-identity assertion
forbade hand-correcting it. **Two gates disagreeing is only resolvable in the generator**, the
emitter now writes underscore emphasis, and `prettier --check .` is clean across the repository
with `packages/ui`'s **38** tests still passing. See that change's `design.md` D13.

**`pnpm test:browser` is deliberately absent from that block and has its own entry
below.** It is not run by `pnpm verify`, and listing it here would make the two claims
inconsistent: this block's property is that every gate in it runs with **no browser
installed**, and that was measured by pointing `PLAYWRIGHT_BROWSERS_PATH` at an empty
directory.

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
deliberate diff, not something CI does. The same limit applies to the client:
`apps/web`'s 114 tests render against a **stub provider** or a recording transport, so
they prove the page composes the abstraction correctly and say **nothing** about whether
a real browser reaches Guerrilla Mail successfully. **Nor has the polling cadence ever run
against a live provider**: `packages/mailbox`'s cadence assertions read the delay the
scheduler was asked for, and nothing in this repository has observed what a real provider
does when a real page polls it every five seconds.

**The four paragraphs this replaces are deleted rather than reworded, because each became
false the moment a real browser ran the page.** They said, in substance:
`createBrowserStorage()` is executed by **no test in the workspace**; `jsdom`'s lack of
IndexedDB leaves the real storage path with **no test at all**; the sequence a user's
browser actually takes — page boots, reads, creates, writes, then deletes the whole
database — **has never run anywhere in this repository**; and *a privacy control verified
only against a fake is the claim in this repository least entitled to confidence*. All
four were true through M6 slice 3 and all four are false now. The last was the most
important sentence this file held about its own work, and **its removal is the point of
the change rather than a loss of caution**.

**What replaced them, and what did not.** The browser tier now runs that exact sequence in
**Chromium**: boot reads real IndexedDB through `createBrowserStorage()`, a created mailbox
is written and read back **through the platform's own API** rather than through the
adapter, and removal leaves `indexedDB.databases()` empty. **It found a real defect on its
first run** — `records=1 claimsStored=0 offersRemoval=0`, the removal control never
offered — which is the strongest evidence in this repository that the hole was a hole, and
the reason 44 storage tests were never going to find it.

**Three limits survive, and none of them is the one that closed:**

- **No stored mailbox has ever been reconciled against a live Guerrilla Mail session.**
  Still true. The tier serves **recorded** provider responses, so it reconciles against a
  recording. This is what `use it externally` would close and it remains open.
- **The blocked-`deleteDatabase` semantics remain a `fake-indexeddb` measurement.** Still
  true. `packages/storage`'s 30 adapter tests drive real `onblocked` events from a real
  held-open connection and establish the adapter's behaviour and the queued semantics
  recorded above; the browser tier does not produce that event, so it does not corroborate
  them. **One** behaviour was now checked against both substrates and the two **agreed** —
  that removal takes the whole database rather than one key. That is a fact about that
  behaviour and **not a general licence** for the fake.
- **The browser tier is repeatable in CI, and it went red on this change.** It has executed
  and **passed** since run `37374154930` (2026-10-05), most recently `37426170806` on `main`.
  Run `37439940701` (2026-10-06, PR #63) is the **first run carrying this change's specs**,
  and it was **red**: `verify` green, `spike self-test` green, **`browser` failed** with 10
  of 11 specs passing. The failure was a defect **in a spec of this change's own** — the
  traversal enumerated the focusable set filtered by `getClientRects()` while its readers
  indexed the unfiltered list, so a control with no layout box shifted every later reading
  and truncated the tail. It did not reproduce locally across repeated runs. Repaired,
  mutation-falsified, and passing locally — and then **run `37442961830` carried the repair
  and came back green** on a GitHub-hosted Linux runner: `verify`, `spike self-test` and
  `browser` all SUCCESS.

  **And that green run was luck, which is the part worth keeping.** Run `37446193779`, on the
  next commit, was **red again** — this time on the drift reporter the repair itself added,
  firing correctly: the page's control set gained the inbox row *after* the walk had begun,
  because `ready` renders a few hundred milliseconds before the row has a layout box and a
  walk of Tab presses is long enough to fall inside that window. **It reproduces locally
  about one run in three**, so the green above was a fact about one execution rather than a
  property of the suite, and the sentence it replaced — *the repair is verified in CI* — was
  broader than the evidence. **A passing run reports no history, so nothing in its own output
  could have said otherwise; the only instrument that could catch this is re-running.**
  The fix is a precondition the spec now establishes rather than assumes: wait until the
  control list has **held for five consecutive 100ms reads**, or throw reporting what it last
  saw. **The first version of that wait required two agreeing reads and its own positive
  control caught it** — a control that gains a box 150ms in is missed by a 200ms window, so
  two agreeing reads is a delay with a comparison in it, not a precondition. The post-walk
  drift assertion is **unchanged**: the wait is a precondition, the drift check is the
  property, and neither substitutes for the other. **10 consecutive local runs, 12 passed, 0
  failed**, against roughly one in three failing before. See `design.md` D16.

  **And slice 2's Apply run was green on its first attempt, which is the other half of the
  same record.** Run `37479366534` (2026-10-06, PR **#68**) carried `motion-and-reduced-motion`'s
  nine new specs and all three jobs passed — `verify` 49s, `spike self-test` 31s, `browser`
  **59s**. **This is recorded because it runs against the pattern above, not as a reversal of
  it**: the two reds were a defect in a spec and a weak precondition, and slice 2's apply stage
  **authored two of its own and caught both before the push**. A first CI run that is green is
  a fact about one execution and says nothing about repeatability — **slice 1's first run
  carrying its specs was red twice**, and its tenth local run was the evidence, not its green
  one. Neither green run reads a rendered pixel: `verify` is a browser-free tier and `browser`
  reads computed styles, element identity, and real IndexedDB. The sync run `37498430362`
  (PR **#69**) passed the same three jobs.

  **And slice 4's Apply run was green on its first attempt too — and this one had a falsification
  pass behind it, which is the difference worth recording.** Runs `37596230069` (Apply, PR
  **#80**), `37597429311` (sync, PR **#81**) and `37598252464` (archive, PR **#82**) all passed all
  three jobs on the first attempt, and **all three carried the same 37 website cases** — so this is
  three executions of one suite on two runners, which is the most repeatability evidence this
  repository holds about any browser change.
  **It is recorded against the same pattern rather than as a reversal of it**: a first CI run that
  is green is a fact about one execution, slice 1's was red twice for three separate reasons, and
  **the only instrument that has ever distinguished the two is re-running** — which is why this
  paragraph names three runs instead of one.
  What is different is
  where the work happened — slice 4's browser cases were authored, mutation-tested to 16 of 18
  caught, and had **two whole-page assertions found false by their own change before the push**,
  which is why `Accessibility.queryAXTree` exists and why both rescoped sweeps ship a negative
  control. **The three new cases read a served stylesheet, a built DOM, and Chromium's
  accessibility tree at one region's own node, and none of them is a rendered pixel**, so the same
  fourth limit applies unchanged.

  **This is the strongest evidence yet for the two-tier split.** `pnpm verify` was green
  throughout, on this machine, on the commit that carried the defect — **689** unit tests
  and 51 boundary assertions, all passing, while a spec `pnpm verify` never reads held a bug.
  (691 is the current count; 689 is what that commit actually ran.)

**M7 slice 1 added a fourth limit to that list, and it is the only one about
appearance.** `packages/ui`'s 38 tests and the six focus specs between them establish
that **every declared colour pair meets its declared threshold in both schemes** and that
**every control is reachable with a resolved outline this product drew**. Neither reads a
rendered pixel. **So "the styling is verified" would be a false summary of both**, and
`docs/DESIGN_SYSTEM.md` carries the same list in full rather than letting a reader infer
coverage from the word "verified". This is a different shape from the other three limits:
those are about a **platform** never being reached (a live provider, another engine, a real
blocked `deleteDatabase`), and this one is about a **judgement** never being made by a
machine. A human opening the page is the only instrument for it, and building one is M7
slice 3's subject, not a missing test.

**The change's own falsification record, because a count of caught mutations proves
nothing without what they were.** **29 of 29 deliberate violations were caught by the
*intended* assertion, with restoration verified by SHA-256**, across both tiers. Six
results are worth keeping:

- **Deleting the `:focus-visible` rule left the focus specs green.** They asserted an
  indicator was present and not `none`, and with the product's own rule gone Chromium's
  user-agent stylesheet supplies `outline: auto`, which passes. That is the **twenty-second
  recorded instance of an assertion narrower than the rule it documented** — and, unlike the
  previous twenty-one, this one was authored *and caught* by the change that introduced it.
  The specs now assert `expect.soft(focused.style).not.toBe("auto")`, with the reasoning
  recorded beside the assertion rather than in a changelog nobody reads.
- **A hand-edited generated artefact and a changed generator are different mutations and
  need different attributions.** `packages/ui` has two projections of `tokens.ts` —
  `tokens.css` and the tables in `docs/DESIGN_SYSTEM.md` — and each has its own
  byte-identity assertion. Proving only that changing the *source* breaks something would
  not distinguish a test reading `tokens.ts` from one reading the other file.
- **The harness itself produced a false green twice, and both were repaired rather than
  explained.** A `to` that is an **array of lines** was read as an array of separate
  edits, so one mutation reported seventeen `noop`s and then a `green` — a mutation
  recorded as surviving because its own text had failed to apply. And a mutation using a
  line-anchored edit missed a fourth `.inbox-row` selector inside a `@media` block, so the
  tree was only partly mutated and the result was reported as green. A missing edit site
  now records `noop` **and skips the run**, and the three shapes of `to` are told apart by
  element type.
- **The repair for the CI defect was green three times before it could fail, and that is
  the twenty-third instance.** The traversal's defect was two places disagreeing about
  which element an index addresses. Fixing it — one function deciding what counts — passed
  the suite when the split was **reintroduced**, because nothing on the shipped page is
  unrenderable. Planting a probe **after** the walk changed nothing; planting it by
  **appending** changed nothing, because a probe after every control shifts nothing; and
  **prepending** it still passed, because the enumeration's *names* were right while its
  *outlines* came from the wrong element, and a wrong control's outline still looks focused
  or unfocused. What finally made it falsifiable was asserting the invariant that was
  actually violated: a reading's name is read from the element its outline was read from,
  so `focus.unfocused.name === focus.name` holds only if the two agree. **A property no
  mutation can break is not a property**, and three greens in a row is what finding that out
  costs when the assertion is aimed at the file instead of at the property.
- **The twenty-fourth and twenty-fifth instances were both *preconditions* rather than
  assertions, which is the shape worth carrying forward.** A precondition decides *when* to
  start measuring, so a weak one does not fail — it measures the wrong thing and passes.
  The first (recorded above) asserted the enumeration and the readers agreed about which
  element an index addressed. The second was the settle wait the second red run forced: it
  required **two agreeing reads 100ms apart**, and its own positive control — a control that
  gains a layout box 150ms in — failed it, because 200ms of agreement is a delay with a
  comparison in it rather than a precondition. **Both were authored and caught inside this
  change.** The checks most likely to be too weak are the ones that decide when to measure.

**M7 slice 2 (`motion-and-reduced-motion`) ran 16 deliberate violations: 15 counted and caught
by the intended assertion, restoration verified by SHA-256 for every mutated file, and a
sixteenth recorded as evidence rather than counted.** Its own count is unremarkable; what it
found was not, and four results are worth carrying:

- **The twenty-sixth instance, and the third recorded *precondition* — and this one the
  slice authored, caught, and repaired itself.** (Two more followed: the fix's ceiling, which
  was red 6 times in 10, is the twenty-seventh and twenty-eighth. All four are preconditions.)
  The browser test carrying D11's claim
  ("a row already on the page is not re-materialised by a later poll") **passed on a build
  that rebuilt the row on every poll.** It waited for the recorded handler to be *asked* for a
  second listing, and `recorded-provider.ts` pushes onto `served` *before* `route.fulfill`, so
  the marker was read while the page had not yet published `checking` — that is, **before the
  defect existed**. The repair holds the listing open, which required making
  `RecordedProviderOptions.listingGate` **a function of the one-based listing count**
  (`storage.spec.ts` holds the first, `motion.spec.ts` the second — one promise cannot do both)
  and moving `deferred()` into `recorded-provider.ts` so two specs cannot hold a listing open by
  two spellings. **The gate is self-policing**: the test *requires* the re-checking sentence to
  become visible before reading the marker, so a gate that stopped working fails the wait rather
  than passing a reading taken at an arbitrary moment. Two mutations hold that down — the gate
  removed, and the gate holding the wrong listing — and both are caught by this test's own title.
- **A mutation the test this change *named* for it caught in only 4 of 5 runs.** Collapsing
  `CheckingInbox` into `EmptyInbox` — so a mailbox nobody has looked at reports "no mail has
  arrived" — is invisible to *any* assertion on what is on the page, because `notStarted` and an
  empty `checking` **render the same component by design** (`Inbox.tsx` says so: they are the
  same fact, so they say the same words). Measured over five runs: the catcher that **never
  missed** is *keeps the address on screen while the inbox is still being checked*; the named one
  missed once. **The mutation record now leads with the catcher that never missed**, because an
  attribution naming a test that catches a defect four times in five will one day report a green
  as a catch.
- **The harness itself was wrong before the tests were, and it was wrong the same way as
  everything else in this list.** It counted with `/(\d+)\s+passed/` matched anywhere in the
  output, and Vitest prints `Test Files  5 passed (5)` immediately above `Tests  114 passed
  (114)` — so it reported **five tests** for every `apps/web` run and for every `packages/ui`
  run, the same file count and the same wrong answer. It did not manufacture a false green,
  because the failed count came from the same pattern and a failing run prints its own summary,
  but **an instrument that answers confidently and wrongly is worse than one that declines to
  answer.** Counts are now read off Vitest's own `Tests` line, and a run with no summary line is
  `harness-error`. A second defect in the same function: `compileSignals` carried a `|nocompile`
  alternative, so any output containing that *word* read as "the runner never collected a test".
- **The fix's ceiling was red in 6 of 10 consecutive full-suite runs, and the cause was
  arithmetic.** The repair above replaced a poll that carried an explicit 30-second ceiling
  with a web-first assertion on Playwright's **5-second default** — and the session schedules
  its *second* check `INBOX_POLL_PROMPT_MS`, **5 000ms**, after the first. The wait and the
  poll were the same length. The four green runs were luck, and **a suite green four times in
  ten has told us nothing**, which is why task 8.2 asks for ten rather than one. The fix is to
  import `INBOX_POLL_CEILING_MS` from `packages/mailbox/src/cadence` rather than pick a number
  big enough: a hand-picked constant is the recorded defect with a larger number, and it drifts
  the first time the cadence changes. **That is the twenty-eighth instance, and the fourth
  precondition — of which three were authored by the change that found them.**
- **The obvious inference about the held listing was wrong twice in one session, and both
  corrections came from measuring rather than from reasoning.** Removing the hold is caught in
  **2 of 3** runs, which reads like "the hold is load-bearing". It is not: applying the
  rebuild defect *and* removing the hold together is caught in **4 runs of 4**, so **the wait
  for the `checking` state is what catches the defect and the hold only makes the wait
  dependable**. A first draft of the design record credited the hold with the repair, and a
  first draft of the experiment script printed its conclusion with the two branches swapped.
  Because removing a hold is a *mechanism* mutation rather than a forbidden defect, it is
  **recorded as evidence and not counted** — the same treatment a branch no assertion can
  reach gets, and reporting 16 of 16 would have meant something weaker than it appeared to.

**M7 slice 3 (`website-sections`) ran 22 deliberate violations: 22 of 22 caught by the intended
assertion**, with `wrongcatch`, `green`, `nocompile`, `noop` and `harness-error` **all zero**,
restoration SHA-256 verified for every mutated file, and `dist/` rebuilt from the restored
source. **Every one of the thirteen new tests is in the browser tier and `pnpm test` did not move
at all** — 694 in 35 files, `apps/web` 114, `packages/ui` 38, boundaries 51, every total
identical to the baseline. **`pairs.test.ts` is table-driven, so a new pair adds no test**, which
is a task that predicted the count would rise and was wrong; it is corrected in place rather
than reinterpreted.

**Six defects in the falsification *harness*, and the second is the one worth carrying.**

- **The worst: a failed build fell through into the Playwright run and was overwritten with
  `green`.** Two mutations did not compile, the browser was served the previous `dist/`, the
  intended test passed, and both were filed as survivors — **when neither mutation had ever
  run.** The detail line said *"the build failed, so the mutation never reached the browser"*
  while the tally beside it said the mutation survived: **evidence against the number printed in
  the same breath as the evidence for it**, which is the shape a reader is most likely to
  believe. The guard is now structural — no build, no run, and the outcome is `nocompile`.
- **Restoring a source file is not restoring what the browser serves.** Restoration is
  SHA-verified per file and every file *was* genuinely restored, while `dist/` still held the
  last mutation — built **two seconds before** the restore. **No SHA covers a build artefact, and
  the state outlives the run**: the next person gets a red suite against a defect nobody wrote,
  with a clean tree to explain it. The loop now rebuilds at the end and reports a failed
  rebuild rather than exiting quietly.
- **The unit tier's failing "titles" were file paths.** `/FAIL\s+(\S+)/` captures the path and
  nothing else, so a `expect` naming a test **title** could never match and a working assertion
  was reported as a `wrongcatch`. Three expectations had only ever matched because they named
  files. The whole line is captured now, and every failing case is written into the record so an
  attribution can be read rather than trusted.
- **An assertion this change wrote was a duplicate of one that already existed.** A mutation
  appeared to show `packages/ui` had no guard requiring every colour to be accounted for. It did
  — *"accounts for every colour token between the three lists"*. **The mutation that appeared to
  demonstrate the gap did not compile**, so the harness read it as green and filed a survivor,
  and the conclusion drawn from it was wrong in the most expensive direction available. The
  duplicate was deleted and the count stayed at 38. **A mutation that cannot compile is not
  evidence about an assertion.**
- **Three "survivors" were broken mutants, and one was an edit that added the defect without
  removing the correct code** — S03 produced *two* `<PageFooter />` elements, one misplaced and
  one still correct, so `contentinfo` was legitimately still 1. Another selected
  `.region--alert`, a class `LocalData` does not render, so it matched nothing. **A survivor means
  "the assertion did not catch this", never "the assertion is too weak", until the mutant has
  been read and shown to be the thing it claims.**
- **The one real coverage gap, and it was a proxy.** `"the brand mark is drawn by the page"`
  asserted an `<img>` count of zero, which an `<image>` inside an `<svg>` satisfies. Fixed on
  both sides, above. **And the existing boundary rule caught three class hooks** — `product`,
  `section--steps`, `section--reasons` — rendered with nothing in `styles.css` matching them,
  two of them invented so two sibling sections would look symmetric in markup. **They were
  deleted, not styled**: `data-region` is the hook those sections are identified by, and a hero
  needs no rule of its own to be first on the page.

**D10's premise was measured false rather than assumed.** It named the browser suite's
control-set precondition as the thing most at risk, on the theory that new sections add controls.
**They add none** — the three new regions contain no interactive element, and the only control
this change restyles already existed. `focus.spec.ts`'s walk, its settle precondition and its
six cases are therefore unchanged.

**One deliberate non-coverage, recorded rather than left to look like coverage.** The scenario
*"a new message arrives, so that row materialises"* is **not coverable with recorded
fixtures**, because the handler serves the same listing on every poll and no new row can ever
appear. The other half of the requirement — an existing row is *not* re-materialised — is
covered, in both tiers. This is stated in the spec's module doc so a reader counting scenarios
does not read the missing one as an oversight.

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
  figure; the current one is **47**, below.) The
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
- **`browser-verification` added one, bringing the count to 47, and found the
  twenty-first instance of a check narrower than its rule — plus one of its own that
  shipped wrong on arrival.** The new rule requires every shipped `*.spec.ts` to be
  **collected by the browser suite and by nothing else**: a spec no suite collects reads
  as coverage while verifying nothing, which is the M5 slice 1 silent-skip failure
  arriving through a door one directory over. It is a **second** collection rule beside
  the unit one, which was the point: two runners mean two ways for a test to be
  uncollected, and one rule cannot guard both.

  Its roots come from the **directory contents on disk**, and — the part that made it
  worth writing — from **parsing `playwright.config.ts` rather than asserting a literal
  path**. A rule checking that specs sit under a hard-coded `apps/web/e2e` would pass
  unchanged after someone narrowed `testDir` to an empty directory, which is the one
  event it exists to catch. A configuration it cannot read is returned as *a suite that
  collects nothing*, so it reports; skipping would make it pass in exactly the case
  where it has stopped working.

  **The twenty-first instance was `isTestFile`, in the rule slice 2 added.** It matched
  `.test.tsx?` while its documented rule said *test files*, so the browser tier's own
  `*.spec.ts` was read as shipped source and would have been scanned for `localStorage`
  and `indexedDB` — the rule would have reported the suite for the substrate it exists
  to test. Widened to a pattern matching `test` **and** `spec`, and the fix is only
  credible because
  the exemption is tested **both ways**: controls plant `__exempt.spec.ts` *and*
  `__exempt.test.ts` beside a probe the rule must still report, so an over-wide exemption
  fails the half that is supposed to fire rather than passing unnoticed.

  **And the new rule shipped with a parser bug, caught by running it.** The `testMatch`
  capture is a regex *literal*, and handing `/…/flags` straight to `new RegExp` compiles
  the slashes as pattern text — producing a pattern that requires a literal `/` after
  its own end anchor and can therefore never match. The failure presented as
  `apps/web/e2e/storage.spec.ts (no browser suite collects it)` for a suite that
  collects it. **A rule that is wrong in the direction of reporting *more* than is true
  is the dangerous direction**, because it cries wolf and the natural response to a
  crying wolf is to delete it. Both narrowing forms are now mutation-tested separately,
  since an empty `testDir` and an empty `testMatch` fail for different reasons.
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
