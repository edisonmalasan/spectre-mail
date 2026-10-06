# Design

## Context

M8 is the first milestone whose subject is a **second client** rather than a new layer. Every
package beneath it exists and is verified; what has never existed is a proof that those packages
can be consumed by something other than `apps/web`. That is the change's real deliverable, and
most of what follows is about not breaking it.

The measured facts this design rests on, all recorded in `docs/PROVIDERS.md` and
`tests/provider-spike/`:

| Fact | Consequence for M8 |
| --- | --- |
| Mail.tm sends `Access-Control-Allow-Origin` only to its own origins | Unreachable from a **web page**; reachable from an extension with host permission. This is why the two clients have different provider setups, and it is not a preference. |
| `https://api.mail.tm` is accepted into a manifest and **grants nothing** | Host permissions use the wildcard path form. A slash-less manifest ships looking correct and fails every request with an opaque `TypeError`. |
| No push transport connects — five SSE paths, two WebSocket paths | Polling is the only option, here as on the website. |
| An unrecognised Guerrilla session answers `HTTP 200` with an empty inbox | The adapter's dead-session check is load-bearing, and "no mail" must never be read as "the address is gone". |
| Neither provider publishes a polling limit that governs this client | `INBOX_POLL_PROMPT_MS` and `INBOX_POLL_CEILING_MS` remain the product's own numbers. M8 does not get to invent a measured one. |

## Goals / Non-Goals

**Goals**

- A manifest that is correct in the one way that is measured to be silently wrong if it is not.
- A second implementation of `SpectreStorage` that serves the same contract without pretending
  the platforms are the same.
- The extension's provider configuration derived from one list, reaching two providers in
  preference order — the first exercise of the fallback path.
- A popup that creates, copies, names, reports, and counts, over the shared session.
- **A measurement** of the service worker's lifetime and the `chrome.alarms` floor, recorded in
  `docs/PROVIDERS.md`, before any decision is taken about where the session lives.
- The deferred live host-permission check, performed against the live provider.

**Non-Goals**

- **The content script.** M9 owns in-page integration.
- **The side panel.** M11 owns it.
- **Any polling in the background service worker.** D1.
- **Notifications, OTP copy/fill, verification-link opening.** M10.
- **Site association (`hostname → mailbox`).** M9, with the content script.
- **A provider selector in the popup.** The popup names the provider it used and the one it fell
  back to. A control that can only ever show one state is the control `website-client` already
  forbids the website from shipping; the extension's case for one arrives with M10's workflow,
  where choosing is a user action rather than a disclosure.
- **Styling work.** The popup consumes `packages/ui` tokens and is otherwise unstyled
  composition. M7's visual pass was the website's; the extension's is a later slice and this
  change does not pretend otherwise.

## Decisions

### D1 — The background service worker starts with no polling, and the lifetime is measured first

**The problem.** `packages/mailbox` polls through an injected `MailboxScheduler` and the website
drives it from a live tab. `INBOX_POLL_PROMPT_MS` is **5 000ms** and the ceiling is **30 000ms**.
An MV3 background service worker is idle-terminated — nominally after 30 seconds of inactivity —
and `chrome.alarms` has its own floor, historically **1 minute**, relaxed in later Chromium
versions for unpacked extensions only in some cases. So a session living in the service worker is a
session that **dies**, and one living in the popup dies whenever the popup closes, which is most
of the time. Neither is what the shared layer assumes, and the roadmap does not say which to
choose.

**The options, recorded so the decision is legible later:**

| Option | Cost |
| --- | --- |
| Service worker owns the session, `chrome.alarms` drives it | The effective cadence **cannot** be the shared layer's 5s prompt delay. The mismatch must be an explicit reconciliation, never a silent divergence. |
| Popup owns the session | Unchanged shared layer, but the mailbox goes stale when the popup closes — and M11's side panel exists precisely because the popup is not enough. |
| Offscreen document holds the session | Sidesteps termination, but a persistent hidden document is a real cost to decide deliberately. |
| **Defer; measure first** | The popup ships without polling, and the measurement decides the next slice. |

**Decision: defer, and measure.** The two questions — how long the worker actually survives idle
in real Chromium, and what `chrome.alarms` will actually accept in this Chromium — are
**empirical**, and this repository does not answer an empirical question with a recollection of
documentation. The change therefore **builds the worker, declares it in the manifest, and puts no
polling in it**, and a requirement states that absence so it cannot quietly become an omission.

**What this costs.** The popup shows a mailbox it has created and a status it has read, and its
inbox count comes from an **explicit user-triggered check** rather than a background loop. That is
a real reduction in what the popup does, and the roadmap's "basic inbox count" is satisfied by a
count the user asked for. The alternative — shipping a loop whose lifetime nobody in this
repository has measured, against a provider with no published limit — is the failure mode this
repository has recorded itself avoiding twenty-nine times.

**Why not decide it in this change anyway.** Because the answer is a measurement, and a
measurement taken after the architecture is built is a measurement of the architecture that was
built. Deferring costs one slice of polling. Guessing costs the wrong architecture plus the
measurement that shows it was wrong.

### D2 — The `chrome.storage` adapter lives in `packages/storage`, not in `apps/extension`

**Decision.** The adapter is added beside the IndexedDB one, in the package whose own module note
has said since it was written that the extension's `chrome.storage` adapter is M8's work.

Three reasons, in order of weight:

1. **The boundary rule already says so.** `tests/architecture/boundaries.test.ts` forbids any file
   under `apps/` from naming a platform storage API, with one carve-out for
   `navigator.clipboard`. An adapter inside `apps/extension` would need a second carve-out for
   `chrome.storage`, which is a rule weakened to accommodate a placement.
2. **`packages/storage` is the one package whose `tsconfig` declares `DOM`**, because it is the
   only one whose job is to speak to a platform API. A second client needs a second platform, and
   putting both adapters in one package keeps that justification singular and true.
3. **The website would otherwise grow a sibling.** `apps/web` would import an extension adapter,
   or the adapter would be copied. Either is the duplication M8's gate forbids, one layer down.

**The platform differences are documented, not smoothed over.** `chrome.storage` has **no
transactions**, so `saveMailbox` resolves on the platform's confirmation of the individual write
rather than on a transaction commit, and that difference is stated in the adapter's own
documentation. `clearAll` calls `chrome.storage.clear()` — the **whole area**, not one key, for
the reason the contract already gives and which is a **stronger** fit here than it was for
IndexedDB: there is no `deleteDatabase` and no `onblocked`, so the blocked-removal semantics
`fake-indexeddb` recorded do not arise at all. That is a platform difference that makes the
contract **easier** to satisfy, and it is recorded rather than left for someone to rediscover.

### D3 — The provider list is named, and the fallback is the first it will exercise

**Decision.** `EXTENSION_PROVIDER_IDS = ["mail-tm", "guerrilla"] as const`, with the adapter
registry typed `Record<ExtensionProviderId, …>` exactly as `apps/web`'s is.

The `Record` over a finite literal union is what makes the list a configuration rather than a
comment: adding an id without an adapter beside it **does not compile**. The existing boundary
rule requires the list to be **read as a value** by the factory, which exists because
`apps/web`'s once documented a coupling it did not have.

**This is the first client where fallback can actually happen**, and that is worth stating
precisely: the website's list is one long and `provider-config.ts` says to keep it that way,
because two entries would claim redundancy the website does not have. Here redundancy is real —
Mail.tm is unreachable from a page and reachable from an extension — so the list has two entries
and each means something.

### D4 — The live host-permission check is quarantined from `pnpm verify`

**Decision.** One test contacts a live provider, and it does not run in `pnpm verify`, `pnpm test`,
or the browser tier.

`provider-abstraction` requires that *"a test SHALL exercise the declared pattern against the live
provider origin to prove it grants access."* This milestone is the one `README.md` deferred it to,
so the requirement is owed here and closing it is a deliverable.

**Why quarantine rather than integrate.** Every other provider interaction in this repository is
driven by **recorded** responses, and that is a property the whole suite rests on: no test contacts
a live provider, so the suite is deterministic, offline, and free. Folding one live call into it
would make the whole suite depend on a third party's uptime and rate limit, and would mean
`pnpm verify` fails when Mail.tm is down — which is a fact about Mail.tm, not about this code. The
check runs from its **own** script, is **opt-in**, and its result is recorded in
`docs/PROVIDERS.md` whether it passes or fails.

**What it proves and what it does not.** It proves the **declared pattern** grants cross-origin
access from a real privileged extension context — the thing the slash-less form silently fails. It
does **not** prove `use it externally`: that is the whole signup flow against a real service, and
this is one request from one origin.

**The negative half is the part that matters.** A test that fetches once and passes would also pass
with the slash-less pattern on some configurations. So the check runs **both forms**: the wildcard
form must succeed **and** the slash-less form must fail, in the same run, against the same origin.
A check that cannot fail for the reason it exists is not a check, and that is the thirtieth
instance of that shape in this repository.

### D5 — The browser tier's scope is stated, not widened silently

**Decision.** The extension gets **its own** spec directory and its own runner configuration, and
the existing rule requiring every `*.spec.ts` to be collected by exactly one browser suite is
**extended** to cover it rather than satisfied by the existing `apps/web` suite.

Two things force this. First, `pnpm test:browser` builds the website and serves `apps/web/dist` —
an extension is not a page, and loading one requires a **persistent context** with
`--load-extension`, which is a different Playwright API from `chromium.launch`. Second, the
existing collection rule resolves the configured globs from `playwright.config.ts`; adding a second
suite means **two** configurations to read, and a rule that reads one of them would pass unchanged
while the other collected nothing — which is exactly the silent-skip failure M5 slice 1 recorded
in `packages/` and `browser-verification` recorded again in `apps/`.

The extension's suite runs in **Chromium only**, for the same reason the website's does: adding a
project per engine would turn "verified" into "verified somewhere" without adding evidence.

## Risks / Trade-offs

- **A manifest is a promise.** Shipping one makes the extension installable, and an installable
  extension with a broken permission ships looking correct — which is the entire trap. Mitigated
  by D4's negative half, and by the wildcard form being asserted in the **unit** tier too, so the
  cheap check does not need a browser to run.
- **The popup does less than the roadmap's list suggests.** D1's consequence. Recorded rather than
  hidden: the inbox count is user-triggered, not ambient.
- **A second client is a second place for the abstractions to leak.** Mitigated by the boundary
  rules, which are **widened** rather than satisfied — the collection rule reads both
  configurations, and the client storage rule already covers `apps/extension` today despite it
  having no source.
- **Bundling adds a build step and possibly a dependency.** Preferred path is the Vite already in
  the lockfile at `7.3.6` and already permitted by `allowBuilds`. A genuinely new tool would need
  its reason recorded in `proposal.md`, because a bundler is the kind of dependency that arrives
  silently and then owns the build.

## Migration Plan

None. This is greenfield: there is no legacy extension to migrate and no existing user of one.

## Open Questions

- **Where the session lives** — D1 defers this to a measurement in this change and a decision in
  the next. The measurement is a deliverable, not a best effort.
- **Whether `chrome.alarms` in this Chromium accepts a 30-second period.** Also a measurement.
  It is recorded rather than assumed because the floor has changed across Chromium versions and
  this repository's rule is that a number it cannot defend is not printed.
- **Whether the popup needs `chrome.tabs` or `chrome.scripting`.** Not requested here; the content
  script is M9's, and a permission nothing uses is one M12's permissions review would remove.