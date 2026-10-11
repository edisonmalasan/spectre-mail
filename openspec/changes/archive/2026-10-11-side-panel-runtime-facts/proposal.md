# Proposal

## Why

`docs/ROADMAP.md` §17 — **M11, Side Panel + Mailbox Context** — is the earliest incomplete
milestone, and its design rests on four facts about Chromium that **nothing in this repository has
measured**. Two of them decide the shape of the change rather than a detail inside it:

> **Fact A.** *Can a side-panel context find the active tab at all?*
> `extension-platform.ts` answers that question today from a **popup** context — `findActiveTab()`
> calls `chrome.tabs.query({ active: true, currentWindow: true })`, measured on 2026-10-08 as
> needing no `tabs` permission, which is why M10 slice 2's fill ships without one. **A side panel
> is not a popup.** Whether `currentWindow` from a panel-hosted document resolves to the window the
> panel is docked beside, or to something else, is the difference between slice 1 having a premise
> and not having one.
>
> **Fact B.** *Can it learn the current **hostname**?*
> `docs/PROVIDERS.md` §4.2 records `tab.url` as **`undefined`** without the `tabs` permission.
> The roadmap's M11 context behaviour is written in terms of *"current tab hostname"* and *"mailbox
> associated with current hostname"* — and `site-associations` stores exactly that association, keyed
> by the exact `hostname`. So there are two routes and they are not equivalent in cost:
>
> | route                    | reaches the host by                          | cost                                                                 |
> | ------------------------ | -------------------------------------------- | -------------------------------------------------------------------- |
> | **ask the content script** | it already runs on every `http`/`https` page and knows `location.hostname` | **zero** new permissions; reuses a seam M10 slice 2 already measured |
> | add the `tabs` permission | reading `tab.url` directly                   | a promoted requirement in `in-page-integration` states the extension *"SHALL request no permission this extension did not already request"* |
>
> **Route (b) is not forbidden — it is forbidden *without an amendment*,** and the amendment path
> is well precedented. But deciding it on a guess would mean either an unnecessary permission or a
> requirement rewritten for a limitation nobody had checked.
>
> The other two facts are load-bearing for verification rather than for design, and they are the
> same shape:
>
> | fact | why it matters                                                                 |
> | ---- | ------------------------------------------------------------------------------- |
> | **C** | A side panel is **per-window and persists across tabs**, so *"which page am I beside"* is a **live** question and not a boot read. Whether `chrome.tabs.onActivated` reports to a context holding no `tabs` permission is unmeasured. |
> | **D** | **Playwright has no `Page` for a docked side panel.** This repository already recorded that for the popup (`chrome.action.openPopup()` **adds no Page**), and solved it by opening `popup.html` as a tab in the same window. Whether the same substitute works for a panel decides whether the browser tier can verify anything at all. |

**Chrome documents most of the answers.** `sidePanel` as a permission, `side_panel.default_path` as
a manifest key, `openPanelOnActionClick` as the toolbar behaviour, and *"the side panel remains open
when navigating between tabs"* are all in the reference. **This repository does not treat
documentation as measurement**, and the precedent for why is on file: §4.1's table has a column
reading *"What it does **not** establish"* beside every row, and `alarms-packing-interval` existed
as a separate change **only because** §4.1 had measured what the API *stores* and not what Chromium
*fires*. A documented answer recorded as a measured one would put a second, unfalsifiable source of
truth into the same document that exists to hold measurements.

So the next change is not a slice of M11. **It is the measurement, on its own, before any M11 slice
is proposed** — for the same reason `alarms-packing-interval` was: nobody should design a surface on
an assumption this repository already knows how to write down as an assumption.

## What Changes

- **A quarantined measurement script, `apps/extension/e2e/side-panel-runtime.mjs`**, with its own
  fixture extension under `apps/extension/e2e/fixtures/side-panel-probe/` and — following
  `notification-probe` — **a sibling `control/` fixture differing in exactly the two manifest
  entries under test.** The control is the arm that makes the others mean anything: if
  `chrome.sidePanel` is absent with *and* without the permission, "the permission made it exist" is
  false and the run has measured nothing.
- **The questions the script asks**, all recorded rather than assumed:
  - is `chrome.sidePanel` present in the worker, and absent in the control?
  - does `chrome.sidePanel.open()` **resolve in headless**, from a real click, with no `Page` for
    the panel it opened?
  - from a panel-hosted document, what does `chrome.windows.getCurrent()` report, and what does
    `chrome.tabs.query({ active: true, currentWindow: true })` name — the panel's own tab, the
    fixture page, or nothing?
  - is `tab.url` readable there, with and without `tabs`?
  - can the panel `chrome.tabs.sendMessage` that tab and get a reply, and does `chrome.tabs`
    report `notActedOn` when the page has no content script (a `chrome://` document)?
  - does `chrome.tabs.onActivated` fire to a context holding no `tabs` permission?
  - can an extension-hosted page reach a **provider origin** directly, or must it delegate to the
    worker the way a content script does? (§4.4 measured the content-script half and this is the
    panel half of the same question.)
  - what does Playwright observe about a docked panel **at all**, and what does the `sidepanel.html`
    -as-a-tab substitute preserve?
- **The result recorded in `docs/PROVIDERS.md` §4.6**, with §5.2 gaining a row for anything the
  answer leaves open, and §6 touched only if a finding moves a roadmap consequence.
- **One name added to `QUARANTINED_PROBES`** in `tests/architecture/boundaries.test.ts`. That list
  is the whole of the opt-out, which is why it is a list; the existing assertion that every probe's
  spelled load flags agree with `extensionFlags()` covers the fourth for free.

**Explicitly not in scope:** no product code, no `static/manifest.json` change, no permission, no
message kind, no panel document, no decision about which context owns the session, and **no
amendment to the two promoted requirements this measurement bears on.** This change makes decisions
*possible*; it does not make them.

**One decision is already made, and it is recorded here so the measurement is not pointed at a
question that has already been answered.** The toolbar button stays with the popup. `openPanelOnActionClick`
is **not** taken, because `action.default_popup` is `popup.html` and the popup today holds the
entire verification workflow M10 slice 2 shipped — open a message, read its codes, `[ Fill ]`.
Taking the click would mean moving that workflow to a surface that does not exist yet. So the panel
is reached through Chromium's own side-panel entry point, and the measurement records what that
entry point is actually worth rather than assuming it.

**This change declares `skip_specs: true`.** It changes no product behaviour — it adds an instrument
and records what it observed. Every requirement it bears on already exists and stays true; the
reasoning, requirement by requirement, is in `.openspec.yaml` rather than here. **Inventing a delta
to satisfy validation would add a requirement describing a platform's behaviour, which is precisely
what the requirements being satisfied exist to prevent.**

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None, for the reason given above and recorded in `.openspec.yaml`: this is the measurement those
requirements already call for, and recording it changes none of them.

## Impact

- **New:** `apps/extension/e2e/side-panel-runtime.mjs`, and
  `apps/extension/e2e/fixtures/side-panel-probe/` — a `manifest.json`, a `probe.js`, a
  `sidepanel.html` and `control/`. The fixture declares `sidePanel`, `storage` and the two provider
  host patterns **because the probe needs them**, and its `manifest.json` says so in its own
  description, as `notification-probe`'s does: *the instrument that answers a question may need
  rights the product does not have yet.*
- **`apps/extension/static/manifest.json` is not touched.** This is the second spike in a row whose
  fixture exists precisely so the shipped manifest need not carry an instrument's rights, and the
  boundary rule above is why that is cheap.
- **No effect on any test count.** `pnpm test` and `pnpm verify` must be unchanged, and `pnpm
  verify` must still pass with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory. A probe is
  quarantined from all three runners precisely so it can be.
- **No effect on CI.** The instrument is not added to the routine browser suite, for the same
  reason `notification-display.mjs` is not: re-establishing something already recorded should not
  add minutes to every run.
- **`docs/PROVIDERS.md`** §4.6, §5.2 and possibly §6.
- **No requirement changes anywhere**, which is what makes the *next* change — M11 slice 1 — the
  first in this milestone to amend one.