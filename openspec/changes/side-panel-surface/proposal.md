# Proposal

## Why

`docs/ROADMAP.md` §17 — **M11, Side Panel + Mailbox Context** — is the earliest incomplete
milestone. `side-panel-runtime-facts` was proposed and applied specifically so that this
milestone's first slice would be designed on four **measured** facts rather than on four
assumptions about a Chromium API (`docs/PROVIDERS.md` §4.6). Those measurements are recorded,
and one of them is a **choice this repository has to make rather than a question it has to
ask**.

The choice is the one the spike left open. The roadmap's M11 context behaviour is written in
terms of *"current tab hostname"* and *"mailbox associated with current hostname"*, and
`site-associations` stores exactly that association, keyed by the exact `hostname` with no
registrable-domain folding. So the panel cannot know which mailbox belongs to the page it is
docked beside until it knows the page's host. §4.6 priced three routes and **two of them
cost something**:

| route                                  | reaches the host by                                                       | measured cost                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **`chrome.tabs.sendMessage` round trip** | the content script already runs on the page and knows its own `location.hostname` | **zero new permissions**; one round trip; depends on a content script being there     |
| the `tabs` permission                  | reading `tab.url` directly                                                | **one manifest entry**, and a broadening of what this extension can read across **every window** |

**This change takes the round trip.** The decision was made by the maintainer after §4.6 was
recorded, and the reason it is the free route is not that it is cheaper — it is that
`in-page-integration` carries a promoted requirement, *"A code reaches the page without a
permission this extension does not already hold"*, whose manifest scenario makes **every
permission this extension requests** traceable to a user-facing feature. Adding `tabs` to read
one hostname on one page is a permission declared for an implementation convenience, and the
route that achieves the same thing with **no new permission at all** makes that amendment
unnecessary.

So the interesting part of this change is **not** the panel. It is that the panel's one
context-dependent line is the only line in the roadmap's `Display:` list that needed a
measurement, and the measurement made the answer free. Everything else the panel shows —
mailbox, inbox, new messages, one-time codes, verification links, recent mailboxes, provider
state — already exists in this client and already has a requirement behind it.

**One thing about the panel is not measurable by anything in this repository, and the slice
proceeds anyway.** §4.6 measured that `chrome.sidePanel.open()` resolves, that the panel
document then runs, and that Playwright adds **no `Page` for a docked panel**. It did **not**
measure **whether a person can reach the panel without this extension opening it**, because
that entry point belongs to Chromium's own UI, which no instrument here can read. The
decision to leave `openPanelOnActionClick` unset — recorded in the spike's proposal and still
in force, because the toolbar button belongs to the popup and the popup holds the entire
verification workflow M10 slice 2 shipped — means **the panel's first open depends on a
platform affordance this repository has not measured.** That is named as a premise rather than
assumed, and `design.md` records the two measured-if-it-fails routes.

## What Changes

- **A second document in this client.** `apps/extension/sidepanel.html` and its entry point
  `apps/extension/src/panel-main.tsx`, built by the same `vite build` that already builds the
  popup and then the content script. **The popup's build chain already has this property** —
  `vite.config.ts` sets `emptyOutDir: false` so a second entry does not erase the first — so
  no build configuration changes.
- **`apps/extension/static/manifest.json` gains exactly two entries**: the `sidePanel`
  permission and a `side_panel` key naming the panel document. **These are the two entries the
  spike's control fixture differed in and nothing else**, so the permission this slice adds is
  the one whose necessity was measured rather than assumed: with neither, `chrome.sidePanel`
  is `undefined`.
- **A new document surface with its own copy module**, `apps/extension/src/panel-copy.ts`,
  beside `popup-copy.ts` and for **one third of the reason that module exists**: the website's
  `Extension preview` region is derived from the popup's copy by a boundary assertion, and
  the panel's copy needs no such derivation because **this slice does not depict the panel on
  the website** (see *What this change does not do*). The module exists so a panel string is
  reviewable beside the requirement it satisfies and a test can read what it says without
  scraping rendered text — which is `popup-copy.ts`'s own stated reason for being data.
- **A new message kind on the existing `protocol.ts` seam**, `HOST_CONTEXT_REQUEST`, whose
  answer carries the content script's own `hostname` or a refusal. **It goes on the seam M10
  slice 2 already measured** — `chrome.tabs.sendMessage` from an extension context to a content
  script — rather than a new transport, and `protocol.ts` stays the one file both sides read.
- **A new platform seam in `extension-platform.ts`**, `onTabActivated`, because §4.6 measured
  that `chrome.tabs.onActivated` fires **to a context holding no `tabs` permission** and the
  panel re-reported with reason `activated`. This is the reason the panel follows a tab switch
  with no new permission, and the code says so.
- **`extension-client` gains two requirements and amends one; `in-page-integration` gains one
  and amends one.** The amendments are the two this slice was told to make as amendments
  rather than as deletions, and **neither deletes an assertion**:
  - `extension-client`'s **non-goals** requirement listed three forbidden surfaces. This
    slice removes the last meaningful one, which would leave the requirement vacuous — **and a
    vacuous assertion is a defect, not a completed cleanup.** It is rewritten in the class
    form it was reaching for: the extension SHALL NOT declare a surface it does not ship,
    where *a surface* is now every manifest surface key and every declared document path, and
    the amendment chain (content script, fill control, notification, **side panel**) is
    recorded in the requirement rather than deleted from it.
  - `in-page-integration`'s **permission** requirement carried the scenario *"the manifest is
    read after **this change**"* — a spelling that guards nothing once this change is
    archived. It is generalised to the standing form, *"every permission it requests SHALL be
    one a shipped surface uses"*, which **is** what makes `sidePanel` honest, exactly as
    `incoming-mail-notification` recorded for the other one.

### What this change does not do

These are decisions, not omissions, and each has a reason a reader would otherwise have to
re-derive:

- **The `tabs` permission is not taken.** See above — the free route exists and was measured.
- **`openPanelOnActionClick` is not taken, and the toolbar button stays with the popup.** The
  popup holds the verification workflow M10 slice 2 shipped; taking the click would move that
  workflow to a surface that does not exist yet. Recorded in the spike's proposal and unchanged
  since.
- **The website's `Extension preview` region is not changed.** It depicts the popup, and the
  boundary assertion that guards it resolves every label the region declares against
  `POPUP_COPY`. Depicting a second surface is a **composition** decision about what a visitor
  is shown, it is not implied by the surface existing, and doing it here would make a
  depiction change read as a consequence of a panel change.
- **No new design token and no new motion.** `design.md` D8 commits this change to it, and
  `packages/ui` staying at 38 is the measurement that says the commitment was kept. A rise
  would mean visual surface no capability describes.
- **No new boundary rule.** Every property this change introduces either already has an
  instrument or needs none, and **a rule added where an instrument already exists is not
  coverage.** `tasks.md` names which existing rule holds each property.

## Capabilities

### New Capabilities

None. The panel is a second surface of a client that already has a capability, and a new
capability for it would split one product's requirements across two places for no gain.

### Modified Capabilities

- **`extension-client`** — the non-goals requirement is rewritten in class form; two
  requirements are added for the panel's content and for its page context.
- **`in-page-integration`** — the permission requirement's manifest scenario is generalised
  from a change-scoped spelling to a standing one; one requirement is added for the content
  script's host report.

## Impact

- **New, in `apps/extension/src/`:** `sidepanel.html`'s entry `panel-main.tsx`, the component
  `Panel.tsx`, the copy module `panel-copy.ts`, the host-context half of `protocol.ts`, the
  tab-activation half of `extension-platform.ts`, and a `SidePanelSpec` type where the current
  `PopupProps` surface is not reusable as it stands.
- **Changed:** `static/manifest.json` (two entries), `apps/extension/vite.config.ts` (one
  rollup input), and the two spec files.
- **Counts that must hold, and are the plan's own instrument:** `apps/web` **125** —
  unchanged, which is how this change shows it added nothing to the website; `packages/ui`
  **38**, for the tenth time; the boundary count, which must move **only** if a property has
  no instrument and no other test proves it, and `tasks.md` names any such case individually
  rather than leaving it to the diff.
- **`pnpm verify` must pass with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory**,
  and `pnpm test:browser` must carry the new panel spec through the same command that runs
  both tiers.
- **`docs/PROVIDERS.md` is not written by this change.** §4.6 is a measurement record and this
  is a product change; a new measurement belongs in a spike, and if apply produces one it goes
  in a `## Amendment, recorded at apply` block in this change's own `design.md` rather than
  into §4.6 behind the instrument that took it.