# SpectreMail

Temporary email for the web and the browser.

SpectreMail gives you a disposable email address you can read without leaving the
page or the signup flow you were on. It exists as a website and as a browser
extension, both talking to the same provider abstraction.

**There is no product yet.** This repository currently contains the architecture,
the toolchain, and the measured provider research that the product will be built
on. See [Current status](#current-status).

---

## Current status

| Milestone                         | State                                                                       |
| --------------------------------- | --------------------------------------------------------------------------- |
| M0 — Provider compatibility spike | complete (gate satisfied — see below)                                       |
| M1 — Monorepo foundation          | complete and archived                                                       |
| M2 — Shared domain model          | complete and archived                                                       |
| M3 — Provider layer               | complete and archived                                                       |
| M4 — Mail parsing engine          | complete and archived                                                       |
| M5 — Website core MVP             | complete in scope — 4 slices archived; 3 acceptance lines are M6's or M10's |
| M6 — Website hardening            | complete in scope — 3 slices archived; a 4th was audited, not built         |
| M7 — Spectral Swiss visual system | complete in scope — 4 slices archived                                       |
| M8 — Extension foundation         | complete in scope — applied, verified, synced, archived                     |
| M9 - In-page email integration    | complete in scope - all 3 slices applied, verified, synced, archived        |
| M10–M15                           | not started                                                                 |

| Capability spec          | Requirements | State                               |
| ------------------------ | -----------: | ----------------------------------- |
| `provider-abstraction`   |            9 | live                                |
| `monorepo-foundation`    |            5 | live                                |
| `build-and-verification` |           10 | live                                |
| `shared-domain-model`    |            9 | live                                |
| `provider-adapters`      |           12 | live                                |
| `mail-parsing`           |            9 | live                                |
| `mailbox-session`        |           23 | live                                |
| `website-client`         |           21 | live                                |
| `spectre-storage`        |           15 | live — **consumed by both clients** |
| `visual-system`          |            9 | live                                |
| `page-composition`       |            6 | live                                |
| `browser-verification`   |            5 | live                                |
| `extension-client`       |            6 | live                                |
| `in-page-integration`    |           12 | live                                |

`mailbox-session` and `website-client` were promoted at M5's sync stages, and
`spectre-storage` at M6 slice 1's. **Fourteen capabilities, 151 requirements and 446
scenarios**, counted by `### Requirement:` and `#### Scenario:` across `openspec/specs/`
rather than carried over from a previous claim — this repository has published a wrong
total five times, and the last one was caught only because the count was re-derived
rather than re-read. **This table had fallen five milestones behind** — it read nine
capabilities and 99 requirements, and stopped at M6 — so it is corrected here by
measurement rather than by editing the five milestone rows into place by hand.

**`spectre-storage` is no longer "consumed by no client".** That was true at slice 1 and
false from slice 2, which adopted a stored mailbox and from slice 3, which uses all three
contract members — `loadMailbox` at boot, `saveMailbox` for a mailbox the page was not
handed, and `clearAll` when a user asks this device to forget the address. **The removal
is now also exercised in a real browser**, alongside the 44 tests that run against
`fake-indexeddb`; the verification-tiers note below says which claims each tier
establishes.

`provider-adapters` was promoted at the sync stage of the `provider-layer` change, and
`mail-parsing` at the sync stage of the `mail-parsing-engine` change — 9 requirements
and 31 scenarios, three of which were added by its verification pass.

The website **creates a mailbox, renders its address, lists that mailbox's messages
while polling for new ones, opens one, keeps the address so a reload brings it
back, and lets you make this browser forget it again.** That is what a user can see
work. **It is styled**, from the token layer in `packages/ui` — and what that sentence
can honestly claim is narrower than it sounds: every colour the page uses is a declared
value whose contrast is asserted as a WCAG ratio in both light and dark schemes, and every
control is keyboard-reachable with a focus indicator this product drew, checked by reading
the **resolved** outline in a real browser. **No test reads a rendered pixel's colour**, so
whether it _looks_ right is a judgement no gate here can make. Motion arrives on three
entrances and is a **removal** under `prefers-reduced-motion: reduce`, not a substitute
timing — checked against a resolved duration in a real browser, again not against a pixel.

**And the extension client now offers a mailbox inside somebody else's page.** Its content
script watches for an email field taking focus, offers a control in a shadow root the
page's stylesheet cannot reach, and inserts the address **this device already holds**.
When the device holds none, it offers to **make** one and **delegates the request to the
service worker** — measured, not preferred: a content script's `fetch` obeys the **page's**
CORS policy while the extension's `host_permissions` do not reach it, so the provider is
contacted from exactly one context.

**Which address it offers now depends on the page, and that is this device's own record
rather than anything the page says.** After a real insertion the extension writes
`location.hostname -> mailbox id` into `chrome.storage.local`; a later visit to that host
is offered the mailbox it was last used with, and any other host is offered the newest one
this device holds. **The key is the exact `hostname`** — no registrable-domain folding, so
`a.example.com` and `b.example.com` stay apart — and the association is written **only**
after an insertion actually lands, never merely because a control was offered.

**Four limits are stated here rather than discovered later.** A host that already has an
association cannot have a _different existing_ mailbox chosen for it: there is **no menu**
inside a stranger's page, and a control over one reachable option cannot act. A **stale**
association naming a mailbox this device no longer holds is ignored and left in place,
replaced only by an insertion with a different one. And **the popup still shows one address
and offers no way to change which** — the collection exists so the in-page control can
choose; no chooser has been put in front of a person yet.

The fourth is the cost of that second mailbox record during the transition below: **an address
this device recorded before this build stays stored and stays readable, but it stops being
offered once this device records a new one.** The two records are deliberately never merged,
because nothing in this release can show a second address to choose from.

**The extension holds two mailbox records during this transition, and only one is written.**
`spectre-storage`'s singular contract stays for the website and is read-only for the
extension; the extension's create path writes the new collection and nothing else, and a
boundary assertion fails the build if any module in `apps/extension/src` names `saveMailbox`.

**What none of that establishes is how it looks inside a
real third party's page**, which is a human judgement and the task that asks for it is left
unticked rather than answered by an agent opening a page.

**The website persists a mailbox and removes it on request, and it has now run in a real
browser.** It reads its
own IndexedDB before it asks the provider for anything, offers a stored address back only
once the provider confirms it, writes back a mailbox it was not handed, and offers a
two-step confirmed removal of everything this device holds.

**A real browser ran that page and found a shipped requirement was false there.** The page
wrote the record but never concluded it had, so the removal control was never offered —
measured `records=1 claimsStored=0 offersRemoval=0` in Chromium, while 152 unit tests
passed. The cause was an unmount guard scoped to one effect invocation, which that
effect's own cleanup cleared whenever the inbox published new state mid-write. It is fixed,
pinned by a unit regression test that holds a write open, and now covered in real Chromium
by `pnpm test:browser` (Playwright `1.63.0`, now 81 cases across 10 spec files, its own
CI job).

**And a CI run carrying this page's new specs went red on 2026-10-06** — see below.

Three limits belong in the same breath, and none of them is the one that closed. **No
stored mailbox has ever been reconciled against a live Guerrilla Mail session** - the
browser suite serves _recorded_ provider responses, so it reconciles against a recording,
and `use it externally` stays unverified. **The blocked-removal semantics are still only a
`fake-indexeddb` measurement**, because the browser suite does not produce that event. And
**only Chromium was run** — on one machine and on GitHub-hosted Linux runners, which is
repeatability rather than coverage. What the
browser tier did corroborate is narrow but real: removing "everything this device holds"
means deleting the whole database rather than clearing one key, and **Chromium and
`fake-indexeddb` agreed on that** - established by breaking it and watching both tiers go
red. That is a fact about that behaviour, not a general licence for the fake.

**`packages/storage` exists and the website uses it.** `loadMailbox`, `saveMailbox`, and
`clearAll`, behind an IndexedDB adapter with 44 tests, and reachable two ways: an
injected factory for tests and `createBrowserStorage()` for a page. `clearAll` deletes the
**whole database** rather than the one key it stores, deliberately: the narrow version
would pass every test written against today's single record and would silently stop
clearing everything once a second record kind existed. Two properties are
settled and worth knowing before anything is built on it: **`null` means "nothing
stored" and every failure rejects**
rather than reporting an absence, because a read reported as absent would make a client
believe this is a first visit, create a mailbox, and overwrite the user's stored
identity; and a record this build cannot narrow is **neither returned nor deleted** by
`loadMailbox`.

**Opening a message displays what was found and acts on none of it.** The view shows
the sender, subject, arrival time, readable text, the one-time codes in the parser's
own rank order, and each detected link as plain text with its host visible. There is
no copy control for a code and no link that follows itself — that is the verification
workflow, which `AGENTS.md` places at M10, and copying the **mailbox address** stays
legal because the roadmap's own acceptance criteria require it. Confidence is never
rendered as a number, and a message that could not be read says exactly that and offers
a retry rather than reporting that it holds no code.

**The polling interval is this product's own choice and the page says so by showing no
number.** No provider limit was measured for the only provider a browser can reach —
`docs/PROVIDERS.md` records Mail.tm's `30; w=60` **measured unauthenticated only**,
and Mail.tm is unreachable from a web page at all — so a figure on screen would be an
invention presented as a measurement. A limit a provider _does_ declare is honoured as
a floor rather than turned into a schedule, a throttled listing stops the loop rather
than retrying quietly, and polling stops when nothing is displaying the page.

**No live browser run of the website has ever been made.** Every component in it has
been seen by jsdom and by nothing else, including the message view, so no claim here
is a claim about what a real page looks like or does. Nothing has been verified against
the **live** Guerrilla Mail API from a browser. The website's 77 tests render against a
stub provider or a recording transport, which establishes that the page composes the
abstraction correctly and says nothing about whether a real browser reaches that
provider successfully — and the polling cadence has never been exercised against a
live provider at all, so nothing here establishes how a real provider responds to a
page asking every five seconds.

`packages/core` holds SpectreMail's **normalized domain model** — mailbox, message,
credentials, verification code, verification link, and a closed set of normalized
error codes. It is real, tested code, and it deliberately contains **no provider wire
format and no runtime behaviour**: a provider's field name does not appear anywhere
in it.

`packages/providers` holds the **`MailProvider` contract** and its two adapters —
Mail.tm and Guerrilla Mail — plus one shared conformance suite both must pass with
no per-provider exemption. It is real, tested code, and **no test in it contacts a
live provider**: every test replays recorded provider responses, so the suite
establishes this repository's mapping of a measured wire format and nothing about
either provider's current behaviour.

The website now consumes it, through **one provider only** — Guerrilla Mail, chosen
for the measured CORS reason below. Mail.tm is deliberately _not_ configured for the
website; it remains reachable from the extension, where host permissions make it
legally and technically reachable. That one provider is configured by a single
exported list the factory derives from, so adding a provider is one edit rather than
a spread, and a build fails if that list is ever declared and never read. **The
website offers no provider selector**, and that is a requirement rather than a
missing feature: a control over one reachable option cannot act, so the page names
the provider it reaches instead.

`packages/mail-parser` turns a message body into **readable text plus ranked
detections** — one-time codes and verification links. It is a pure function of
`Message.text`: no network, no clock, no AI, so the same message always yields the
same answer. That matters for a product that tells a user "this is your code", and
it is why the milestone was verifiable without contacting a provider.

It **never renders anything and never opens a link.** There is no markup field to
misuse, and reading a message has no side effect. Nothing it reports is ever
presented as certain — the evidence is wording, and wording is a signal, not proof.

Its 149 tests are driven by a 14-message corpus that is **written, not captured**:
this repository has never received verification mail from any service, so every
fixture says so, and the ones named after services say so explicitly. The corpus
deliberately includes misleading mail — newsletters, order confirmations full of
numbers that are not codes — because a suite of only verification messages cannot
measure a false-positive rate. It establishes how this parser handles mail it was
authored against, and **nothing about any real service's mail.**

Also still a capability rather than a feature: **no client consumes it yet.**

### The one thing you should know

SpectreMail has **no backend and will never proxy a provider API.**

Mail.tm — one of the two providers — sends CORS headers only to its own origins.
A normal web page therefore cannot reach it. There is a tempting fix: stand up a
server and relay the request. SpectreMail does not do that, and the reason is
product policy rather than a terms judgement: the correct response to a provider
that will not serve a web page is to not use it on the web page.

This is why the two clients have different providers, and it is a measured fact,
not a preference:

| Client    | Providers                                | Why                                                                 |
| --------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Website   | Guerrilla Mail only                      | Mail.tm is unreachable from a web page. No fallback in V1.          |
| Extension | Mail.tm primary, Guerrilla Mail fallback | A Chromium extension holds host permissions, so both are reachable. |

Provider availability is **per client**, not global. Both adapters are built in
`packages/providers`, and a client is configured with the providers its own runtime
can actually reach — a manager holding one provider does not pretend a fallback
exists.

---

## Architecture

```text
apps/web  ────────┐
                  ├──> packages/*
apps/extension ───┘
```

Six shared packages, each with one responsibility:

| Package                     | Owns                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `@spectre-mail/core`        | The normalized domain model and its invariants — mailbox, message, credentials, closed error codes, types                |
| `@spectre-mail/providers`   | The Mail.tm and Guerrilla Mail adapters — the only place provider code may live                                          |
| `@spectre-mail/mail-parser` | Safe text extraction, OTP detection, verification-link detection                                                         |
| `@spectre-mail/mailbox`     | The mailbox session: opening, replacing, retrying, and reporting provider health                                         |
| `@spectre-mail/storage`     | The `SpectreStorage` contract and the web IndexedDB adapter - **built at M6 slice 1, used by the website since slice 2** |
| `@spectre-mail/ui`          | Reusable product UI and design tokens                                                                                    |

`packages/mailbox` is **framework-free and DOM-free by compiler rather than by
convention**: its `tsconfig.json` sets `lib: ["ES2023"]` with no `"DOM"`, so `window`,
`document`, and `location` fail to compile there. That is why placing the session
outside `apps/web` is not premature abstraction — it is what keeps the extension from
becoming a rewrite.

**The compiler's reach has a measured limit, and it is worth knowing before
relying on it.** It does **not** reject `navigator`, `localStorage`, or
`sessionStorage` — `@types/node` declares all three, and `"types": []` does not
exclude them — and Node v26.10.0 additionally defines `navigator` and
`sessionStorage` on `globalThis` at runtime. So the missing `DOM` lib removes the
DOM and **not** storage; the second half of that boundary is held by an explicit
rule in `tests/architecture/boundaries.test.ts` rather than by a compiler option.

**That rule now covers every shared package, not just `packages/mailbox`, and a second
rule holds the direction from the other side.** The first was written when the answer
to "which packages must not reach a store" happened to be one name long, and the
generalisation was measured rather than preferred: it immediately reported a real false
positive in `packages/providers`, which holds a recorded `set-cookie` response header
from the M0 spike. So a hyphen now counts as a word character in that pattern, with the
cost stated in the rule — no JavaScript global is written with one. The second rule says
no shared package may import `@spectre-mail/storage` at all, keeping the platform API
reachable only from a client, and a third says the storage layer itself may depend on
`@spectre-mail/core` and nothing else.

The boundaries are enforced by a test, not just documented — **44 assertions** in
`pnpm test`. They fail if a package imports an app, if a file outside
`packages/providers` contains a provider JSON field name, if a provider adapter is
implemented or re-exported outside `packages/providers`, if a module in
`packages/mail-parser` or `packages/mailbox` reaches the global `fetch` instead of
its injected transport, if `packages/mailbox` imports a UI framework **in any of the
four import forms**, if **any shared package but the storage layer** reaches a global
store, cookie jar, or URL, if a shared package imports the storage layer in **any of the
six import forms**, if the storage layer gains a runtime dependency, if `apps/`
inserts untrusted values as markup, and if **any** shipped test is not actually
collected by the test runner.

Each rule states its own limits in the source, and each was proven able to fail. That
last clause is not a formality: this repository has now recorded **eighteen** instances
of a check that was narrower or broader than the rule it documented while staying
green, including rules that fired on their own documentation, rules whose single
positive control proved only the case its author thought of, and a rule that is
structurally unfalsifiable because its assertion is negative — no shared package
reaches a store today, so narrowing its package list leaves it satisfied.

Full detail, including why each rule exists: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Repository structure

```text
apps/
  web/                 Vite + React website client — creates a mailbox, shows its address
  extension/           Chromium MV3 client — a popup, a service worker, and a content script
                       that offers your address inside a page and can ask the worker to make one
packages/
  core/                normalized domain model
  providers/           provider adapters
  mail-parser/         message content interpretation
  mailbox/             the mailbox session
  storage/             persistence contracts and adapters
  ui/                  reusable product UI
docs/
  ARCHITECTURE.md      where code lives and why
  PROVIDERS.md         measured provider evidence
  ROADMAP.md           the milestone plan
openspec/
  specs/               live capability specs
  changes/             active and archived changes
tests/
  architecture/        boundary enforcement
  provider-spike/      the M0 measurement harness — NOT a workspace member
```

### `tests/provider-spike/` is disposable

The M0 spike is **not** a pnpm workspace member. It keeps its own lockfile. This
makes "product code must never import the spike" structurally impossible rather
than a documented rule.

It is not deleted: it is the reproducible evidence behind `docs/PROVIDERS.md`, which
must be re-runnable before release.

---

## Setup

Requires Node.js `v26.10.0` and pnpm `12.6.0` — the versions this repository is
verified against.

```bash
pnpm install
```

That installs the workspace. It does **not** install the spike. To run the spike:

```bash
pnpm --dir tests/provider-spike install
```

**The browser tier needs a Chromium download, and nothing else does.** `pnpm install`
resolves `@playwright/test` but downloads no browser:

```bash
pnpm --dir apps/web exec playwright install chromium
```

`pnpm test:browser` is the only command that requires it. `pnpm verify` must keep working
without one, and that is verified rather than assumed.

---

## Verified commands

Every command below was actually executed and passed. Nothing else is verified yet.
**The six gate commands were last run on 2026-10-06**; the spike commands on
2026-10-02. The counts in the table are taken from a JSON reporter rather than read off
a summary line — an earlier version of this table said 545 across 26 files with 42
boundary assertions, which was stale by two milestones and had simply never been
re-measured. **A number nobody re-ran is a number nobody checked.**

These results were reached **after** a defect was found and fixed. An independent
verification pass discovered that `pnpm format:check` and `pnpm verify` were
failing on Windows — the environment this project supports — because the
repository pinned `endOfLine: "lf"` for Prettier without shipping a
`.gitattributes`, so Git checked files out as CRLF. CI stayed green throughout,
because `core.autocrlf` does nothing on Linux. `.gitattributes` now makes LF a
committed fact; see [`.gitattributes`](.gitattributes). The lesson is recorded
here rather than quietly dropped: **a green CI run is not evidence that a gate
works on your machine.**

**There are two test tiers, and they are not interchangeable.** The unit tier runs
sources under Node and jsdom; the browser tier runs the **built** page in real Chromium
against real IndexedDB. One runner is not allowed to claim the other's work, and a
boundary assertion enforces that in both directions.

| Command                              | What it proves                                                                                                                                                                                                                                                                                                               | What it does **not** prove                                                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                       | The workspace resolves and installs from the committed lockfile.                                                                                                                                                                                                                                                             | That a browser is installed — `pnpm install` resolves Playwright but downloads none.                                                                                                                                                                              |
| `pnpm typecheck`                     | All 8 workspace projects type check under the shared strict config.                                                                                                                                                                                                                                                          | That the types are useful — that is what the tests are for.                                                                                                                                                                                                       |
| `pnpm lint`                          | ESLint passes.                                                                                                                                                                                                                                                                                                               | Type correctness; `pnpm typecheck` owns that.                                                                                                                                                                                                                     |
| `pnpm format:check`                  | Prettier passes on the files this repository governs.                                                                                                                                                                                                                                                                        | That historical documents are formatted; those are deliberately excluded.                                                                                                                                                                                         |
| `pnpm test`                          | 691 tests across 35 files pass, including 51 architecture boundary assertions.                                                                                                                                                                                                                                               | Product behaviour against a **live** provider. Every provider test replays recorded responses, and `jsdom` implements no IndexedDB.                                                                                                                               |
| `pnpm test:browser`                  | 12 specs pass in **Chromium**: the built page reads and writes real IndexedDB through `createBrowserStorage()`, a confirmed removal leaves `indexedDB.databases()` empty, and every control the page offers is keyboard-reachable with a focus indicator whose **resolved** outline differs from the same control unfocused. | Anything about a live provider — every provider response is a recorded one. Nor about Firefox or WebKit, nor a blocked removal, nor how a real provider tolerates five-second polling. **Nor about how the page looks**: no test reads a rendered pixel's colour. |
| `pnpm build`                         | The website builds with Vite.                                                                                                                                                                                                                                                                                                | That packages emit anything — they are consumed as TypeScript source, so there is nothing to emit.                                                                                                                                                                |
| `pnpm dev:web`                       | The website dev server starts and serves the app on `127.0.0.1:5173`.                                                                                                                                                                                                                                                        | That a real browser can reach Guerrilla Mail.                                                                                                                                                                                                                     |
| `pnpm spike:selftest`                | The M0 harness records outcomes correctly and writes its artifacts.                                                                                                                                                                                                                                                          | Anything about real providers — it issues zero network requests.                                                                                                                                                                                                  |
| `pnpm verify`                        | typecheck + lint + format + test + build all pass in sequence, **with no browser installed** — measured by pointing `PLAYWRIGHT_BROWSERS_PATH` at an empty directory.                                                                                                                                                        | The browser tier. It is deliberately not run here, because `build-and-verification` requires `verify` to work without one.                                                                                                                                        |
| `openspec validate --specs --strict` | The live capability specs are internally consistent.                                                                                                                                                                                                                                                                         | That the implementation matches them.                                                                                                                                                                                                                             |

### What the browser tier is, and what it is not

It is **offline by construction**: provider traffic is intercepted and served from
recorded responses imported by name from `packages/providers`, and any other origin is
aborted **and reported by name**, so a page reaching somewhere unrecorded fails loudly
rather than passing quietly.

That makes it a real browser and **not** a real product test. What it cannot establish:
that a live provider answers as recorded (`use it externally` stays unverified), how a
real provider reacts to being polled every five seconds, what Firefox or WebKit do with
IndexedDB, or what a blocked removal does — it does not produce that event. It runs on
**one engine**, on one machine and on GitHub-hosted Linux runners. See below.

**Its first local run found a shipped defect, and that is the argument for it.** In Chromium,
the page wrote the mailbox and never learned it had — `records=1 claimsStored=0
offersRemoval=0` — so the removal control this README has described as working **was
never offered at all**, while 152 unit tests passed. 44 tests against
`fake-indexeddb` could not have found it, because they cannot represent a write that
stays in flight while the inbox publishes new state.

**A later CI run found a different defect, in the suite rather than the page.** On
2026-10-06, run `37439940701`: `verify` green, `spike self-test` green, **`browser` red**,
10 of 11 specs passing. The focus traversal enumerated the focusable set filtered by
`getClientRects()` while its readers indexed the **unfiltered** list, so any control with
no layout box shifted every later reading and truncated the end of the list — reported as
`Clear saved data` missing while `Copy address` was present. It did **not reproduce
locally**, across repeated runs at two workers; it was diagnosed by reading.

**And the run after the repair went red again, which is the more useful fact.** Run
`37442961830` was green on all three jobs. Run `37446193779` was red on the `browser` job
again, on the drift reporter that same repair added — the page gained its inbox row _after_
the walk had begun. It reproduces locally about **one run in three**, so the green run was
luck rather than a property, and **a passing run reports no history**: nothing in its own
output could have said. The fix is a precondition rather than a retry — wait until the
control list has held for five consecutive reads, and fail loudly if it never does. 10
consecutive local runs now pass.

**`pnpm verify` was green the whole time.** 689 unit tests and 51 boundary assertions, all
passing on the very commit that carried the defect. That is the whole argument for a
second runner: one suite cannot report coverage it did not execute.

### What M0 established

Delivery was observed on **both** providers in spike run `2026-10-01T18-08-41-251Z`.

Still unverified, and stated as such:

- **Long-run mailbox and session expiry.** Mail.tm publishes a 7-day message
  retention and states a mailbox lasts until deleted, but neither value appears in
  any API response and neither was measured live. No countdown may be derived from
  documentation.
- **Delivery reputation.** Proven from one sender. Providers that commonly
  blocklist disposable domains are untested.
- **Mail.tm's terms.** No terms page could be located. No attribution, resale, or
  quota obligation may be asserted _or denied_ until real terms are found.

Measurements, with the exact observations, are in
[`docs/PROVIDERS.md`](docs/PROVIDERS.md).

---

## Deferred verification

**The live host-permission check has not been performed.**

The measured fact stands: `https://api.mail.tm/*` is the required wildcard form, and
a host permission declared as `https://api.mail.tm` **silently grants nothing**.
A manifest using the slash-less form would fail with no error, which is the kind of
trap that is invisible until a user reports a feature that "just doesn't work."

The test that exercises the declared pattern against the live provider needs an
**extension**, and one now exists. Browser-test infrastructure does too — Playwright
runs both clients — but the browser tier deliberately intercepts provider traffic, so it
is the wrong tool anyway: this check is _about_ reaching a live provider. It is therefore
**deferred to the milestone that owns provider infrastructure**, and it is the one live call
this repository contains: `apps/extension/e2e/live-host-permission.mjs`, **quarantined from
all three suites** and held out by an architecture boundary assertion.

No result is claimed for it. The trap cannot be hit by accident either, because
`manifest.spec.ts` reads the **built** manifest and asserts the wildcard path form against
the pattern's own rule.

### Still unverified after the first real browser run

The browser tier closed the storage-path gap and **did not close these**:

- **`use it externally`** — the page has never been used against a live provider, and no
  stored mailbox has ever been reconciled against a live Guerrilla Mail session.
- **The live polling cadence** — nothing has observed what a real provider does when a
  real page polls it every five seconds. The cadence assertions read the delay the
  scheduler was asked for.
- **A blocked removal** — still a `fake-indexeddb` measurement; the browser suite does not
  produce that event.
- **Other browsers** — Chromium only, on one machine and on GitHub-hosted Linux runners.
  Repeatable is not the same as covered.
- **The browser tier in CI** — the job hung on its first five runs, and the cause was
  **measured** rather than guessed. Chromium was healthy throughout: it launched on the same
  runner in 250ms. The hang was this repository's own `webServer` command wrapping `vite`
  in `pnpm`, which left the real server orphaned on Playwright's shutdown and holding the
  port. Fixed by invoking `vite` directly, and the job passes in **58 seconds** — it has
  been green on GitHub-hosted runners since run `37374154930`. Two repairs spent on the
  wrong theory first — a bigger timeout, then `--disable-dev-shm-usage --no-sandbox` — are
  recorded in `AGENTS.md` because both were reasonable and both were refuted by
  measurement. **The first run carrying the new focus specs was red**, for the reason
  described above, and the run after the repair was red again for a second reason — two
  defects, both in the specs, neither in the page. See above.

---

## Development workflow

`main` is the integration branch. Planned work never goes directly onto `main`.
Every OpenSpec stage uses its own remote branch and a pull request, merged with a
**merge commit** — not squash, not rebase.

Branch naming is by technical scope:

```text
docs/<scope>-proposal      proposal / planning artifacts
feat/<scope>               feature implementation
fix/<scope>                bug fix
refactor/<scope>           behaviour-preserving restructuring
test/<scope>               tests or technical validation
docs/<scope>-spec-sync     syncing a delta spec back to the main specs
chore/archive-<scope>      archiving a completed change
```

Commits use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

### OpenSpec

Nontrivial behavioural and architectural changes are specified before they are
implemented. The cycle is:

```text
Explore -> Propose -> Apply -> Verify -> Sync -> Archive
```

```bash
openspec list                            # active changes
openspec status --change <name>          # artifact progress
openspec validate <name> --strict        # artifact consistency
openspec validate --specs --strict       # live capability specs
```

### Relationship to the roadmap

`docs/ROADMAP.md` is the **program-level plan**: fifteen milestones from the
provider spike to a public beta. It owns the `Project Status` ledger.

OpenSpec changes are **bounded implementation units**, not milestones. The roadmap
says _what_ the program does and in what order; an OpenSpec change specifies _how_
one coherent piece of it behaves. The roadmap is the plan, OpenSpec is the
specification, and the capability specs under `openspec/specs/` are the
behavioural source of truth when the two disagree.

---

## Privacy model

SpectreMail reads disposable mailboxes and nothing else.

- **No backend.** No SpectreMail-operated server, and no proxying of provider APIs.
- **No account.** There is no sign-up and no user record.
- **Client-side storage.** Mailboxes persist in IndexedDB on the web and extension
  storage in the extension, behind a shared contract. Storage is the client's, not
  the provider's and not ours.

Temporary addresses are disposable by design. Anything sent to one is readable by
whoever holds the address, so it must never be used for anything that matters.

---

## License

No license has been chosen yet. All rights reserved until one is.
