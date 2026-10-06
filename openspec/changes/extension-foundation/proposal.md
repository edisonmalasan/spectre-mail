# Proposal

## Why

`apps/extension` is an empty placeholder with no MV3 manifest, and `docs/PROADMAP.md` schedules
the extension build at **M8**. Every layer beneath it already exists and is verified — the
provider abstraction, the shared domain model, the parser, the mailbox session, the storage
contract, the design tokens — so M8 is not building new product behaviour. It is **wiring a
second client onto the shared core**, which is the thing the whole `packages/` arrangement was
built to make possible and the thing nothing has yet proved.

**Three things this milestone therefore owes that no earlier milestone owed.**

1. **A second client, which is a real test of the abstraction rather than a second copy of it.**
   The roadmap's M8 gate is *"Do not duplicate provider logic inside the extension"*, and
   `provider-abstraction` already assigns this client a **different** provider setup from the
   website: **Mail.tm primary, Guerrilla Mail fallback**, against the website's single reachable
   provider. So the extension is the first client to exercise the fallback path at all, and the
   first to need a provider selector, which is the control `website-client` requires the website
   *not* to have and which only becomes meaningful here.
2. **The deferred live host-permission check, which this milestone now owns.** `README.md`
   records it as deferred to *"the milestone that owns extension and provider infrastructure"*,
   and `provider-abstraction` requires that *"a test SHALL exercise the declared pattern against
   the live provider origin to prove it grants access."* **M8 is that milestone.** The trap is
   measured — `https://api.mail.tm` is accepted into a manifest and silently grants nothing — and
   an extension that ships with the slash-less form looks correct and cannot reach its provider.
3. **An answer to a question this repository has never had to answer.** The website polls from a
   live tab. An MV3 background service worker is idle-terminated, and `packages/mailbox` polls on
   an injected `setTimeout`-style scheduler at `INBOX_POLL_PROMPT_MS = 5_000`. **Nothing in this
   repository has measured what that combination does**, and this milestone is the first place
   the question can be asked.

## What Changes

- **A real MV3 manifest**, with provider host permissions in the **wildcard path form**
  `https://api.mail.tm/*` and never `https://api.mail.tm`. This is the form the M0 spike measured
  and the one the M0 fixture already refuses to emit the broken spelling of.
- **A `chrome.storage` adapter implementing the existing `SpectreStorage` contract**, in
  `packages/storage` — the package whose own module note has named this adapter as its own M8
  work since it was written. It is **not** the IndexedDB adapter with a different global: the
  contract's module note says so, because `chrome.storage` has no transactions and the durability
  guarantee is restated per platform rather than implemented once.
- **The extension's provider configuration** — Mail.tm primary, Guerrilla Mail fallback —
  derived from a named id list through an adapter registry, exactly as `apps/web`'s is, so adding
  a provider stays a visible edit to one list rather than a change spread across call sites.
- **A toolbar popup** that can create a mailbox, copy the address, name the provider, report
  status, and show an inbox count — the roadmap's own first-extension-milestone list, over the
  shared session rather than a client-side reimplementation.
- **A build step.** `apps/extension` has none today, and its `tsconfig.json` carries
  `files: []`. An extension must ship bundled output, so this milestone adds one; the shared
  packages remain consumed as TypeScript source, as they are for the website.
- **The content script and the side panel are deliberately absent**, and **that absence is a
  requirement, not an omission** — the same treatment slice 3 gave the website's
  `Extension preview` section. M9 owns in-page integration and M11 owns the side panel; a
  content script that injects nothing and a side panel that renders nothing are fake UI.
- **The background service worker starts with no polling in it**, and this milestone **measures**
  the service worker's idle lifetime and the `chrome.alarms` floor in real Chromium before
  deciding where the session lives. See D1 — this is the decision that was deliberately not made
  silently.

## Capabilities

### New Capabilities

- `extension-client`: what the extension is, what it can already do, and the surfaces and
  behaviours it must **not** claim until the milestone that owns them lands.

### Modified Capabilities

- `spectre-storage`: a second implementation of `SpectreStorage` over `chrome.storage`, with the
  platform differences stated rather than papered over.
- `provider-abstraction`: this client reaches two providers with a preference order, which is the
  first use of the fallback path the contract already describes.
- `build-and-verification`: a second build target, and the browser tier's scope stated against
  the extension's own needs.

## Impact

- **`apps/extension/` gains real content** for the first time: a manifest, a build
  configuration, a service worker, and a popup. Its `tsconfig.json` loses `files: []`.
- **`packages/storage` gains a `chrome.storage` adapter** and the storage contract's
  documentation gains the platform differences it names but does not yet document.
- **`apps/web` is not modified.** The two clients share every package beneath them and nothing
  above them; that separation is the deliverable, not a side effect.
- **No provider adapter is added or changed.** Both adapters exist; the extension consumes them
  through the same `MailProvider` contract the website uses.
- **One new dependency class**: a bundler for the extension build. The website's Vite `7.3.6`
  is already in the lockfile and already permitted to run (`allowBuilds` in
  `pnpm-workspace.yaml`), so reuse is preferred over a new tool, and a genuinely new dependency
  would need its reason recorded here rather than discovered in the diff.
- **A live provider is contacted by exactly one test**, and it is quarantined from `pnpm verify`.
  Every other provider interaction in this repository is driven by recorded responses, and that
  does not change here.
- **Unchanged and still unverified**: `use it externally`, the live polling cadence against
  Mail.tm, Firefox and WebKit. This milestone closes the host-permission check and **no** other
  item on that list.