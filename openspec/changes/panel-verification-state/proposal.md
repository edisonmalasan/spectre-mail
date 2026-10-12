# The side panel states whether a message the mailbox holds carries a detected verification

## Why

`docs/ROADMAP.md`'s M11 section lists four lines of context behaviour, and the first three ship.
The fourth — written by the roadmap as *"whether verification mail is pending"* — is the last
unbuilt item on either of that milestone's two lists, and the 2026-10-12 exploration
**reframed rather than dropped** it:

> whether any message this mailbox holds carries a detected verification

The reframing is not a reinterpretation of the roadmap's word; it is the finding. **There is no
reading of *pending* this product can honestly satisfy.** The message arrives, it is read, the
verdict is in hand — nothing is outstanding, and the only thing resembling "pending" is the person
not having looked yet, which is a statement about their attention rather than about the mail.
Shipping under the roadmap's noun would answer a question nobody asked **and ratify the noun by
delivering against it instead of testing it.**

What the reframed line asks is a **fact**, and this change finds that the fact is already paid for:

- `mailbox-session` **already obliges** the session to determine whether a message carries a
  verification, to remember that verdict against the message so it is never determined twice, and to
  report it. The promoted requirement is headed *"A message is analysed once, and only when it is
  new"*.
- `Panel.tsx` **already calls `session.restore(record)`** — the full restore path, which adopts
  through the inbox's verdict pass — rather than the `restoreSummaries` the background wake uses.
- The verdicts ride on the listing type itself (`InboxListing.verdicts`), so a panel row can read one
  without a provider request, a body read, or a new seam.

**So this change is the whole of M11's last item, and it is close to free: zero new provider
requests, zero new storage, zero new message seams, zero new permissions, and a byte-identical
`apps/extension/static/manifest.json`.**

## What Changes

- **The side panel's listing states a message's verdict.** Each row carries a marking when the
  session has read that message and found a detected one-time code, a detected verification link, or
  both. The marking is read from the listing's own verdict map — the panel renders a fact the session
  already produced and does not determine anything itself.
- **The scheme is the website's, not this change's — and the panel ports it rather than deciding
  it.** `apps/web/src/InboxRow.tsx:79`–`:85` already renders this union with an **exhaustive marking
  record** over the whole union **including its empty case**, so a sixth verdict would fail to
  compile there. The panel's record is exhaustive for the same reason. **`apps/web` is not touched.**
  **One half is deliberately not ported:** the website's closed positive set exists to decide which
  rows get the accent **rule**, and this change adds no accent rule — so the set would be a second
  thing to keep in step with no consumer. `design.md` D14 records that narrowing and the clause it
  still serves.
- **A message the product could not read is marked on its own row, in words**, exactly as the
  website already does — and is **not** given the visual claim reserved for a known detection.
  `MessageVerdict` keeps `undetermined` and `carriesNothing` apart, and `state.ts` names collapsing
  them as *the one false claim in this product that costs a user the code they were waiting for*.
  **This reversed the first draft of this change, which put `undetermined` in a count instead; the
  reversal is recorded rather than edited away** (`design.md` D5, A6, A8), and it became available
  only once the marking was known to be panel-only.
- **The panel, and only the panel, gets the marking — through one optional prop whose default is
  off.** `MessageSurface.tsx` exists because `Popup.tsx` and `Panel.tsx` need the same list, and
  **both import the same `MessageList`** (`Panel.tsx:71`, `Popup.tsx:47`). A marking implemented in
  it without an opt-in **lands in the popup**, where a live promoted clause forbids exactly that.
  The prop carries **the panel's words** — the verdicts are already inside `state`, so passing the
  map as well would be a second source that can disagree with the rows it marks. `design.md` D11.
- **Nothing is persisted.** The verdict lives in the session's in-memory listing for as long as the
  panel is open. The change adds no stored record, no storage contract member, and no adapter.
- **No confidence is rendered as a number**, and the change does not claim the detection is certain.
  The parser caps a code at `0.85` and a link at `0.70` **by construction**, and `AGENTS.md` records
  that a reducing shape is a penalty and never an exclusion — so `carriesNothing` is a fact about a
  message that was read, not a proof that no code is in it.
- **Two comments this change falsifies are corrected, both comment-only.** `MessageSurface.tsx:128`–`:134`
  states that `extension-client` *"forbids **a surface** from indicating that one does"*, which is
  broader than the promoted spec: the two clauses that forbid it **both name the popup**, inside a
  requirement headed *"The extension's **popup** performs…"*. And `packages/mailbox/src/inbox.ts:105`–`:106`
  says **`apps/web/src/Inbox.tsx` is the only caller that reads a verdict at all**, which is false the
  moment this change lands. The first was left here by `panel-mailbox-choice` for the slice that ships
  the indicator; the second is this proposal's own finding.

## What this change does not do

- **It does not make the panel's judgement about the page beside it.** The rejected reading was
  *"a page beside the panel is asking for a code right now"*, and **no instrument in this repository
  can produce that fact**: Playwright adds **no `Page` for a docked panel at all**, and the
  substitute this repository uses — opening the panel document as a tab — cannot answer *"which page
  am I beside"*, because a tab-hosted document is its own active tab. **A green browser tier would be
  silence rather than evidence there.** `design.md` D9 records that cost was *not* the deciding factor.
- **It does not change the popup, and it cannot be changed into one by accident.** `MessageList` gains
  the *capacity* and the popup does not exercise it; `popup.spec.ts` is unchanged at 8 cases and one
  new browser case stages the same mailbox on both surfaces.
- **It does not add an accent rule, a class hook, a stylesheet rule or a token.** The marking is
  words, which is what `InboxRow.tsx:13`–`:19` argues for and what keeps `packages/ui` at 38.
- **It does not persist a verdict, and does not add a storage contract member.**
  `packages/storage` is untouched at 86 tests.
- **It does not add a boundary rule.** The boundary count is held at **53**, and the properties this
  change introduces are each named in `tasks.md` 3.3 beside the instrument that already holds them.
- **It does not render confidence, a percentage, or a certainty**, and it does not say a message is
  free of verifications.

## Capabilities

- `extension-client` — **one `ADDED` requirement.** It is added rather than folded into the panel
  requirement `panel-mailbox-choice` amended yesterday; `design.md` D2 gives the four reasons and D12
  the reading of the popup clause that makes the addition necessary rather than tidy.
- `mailbox-session` — **untouched.** The session already produces, holds and reports the verdict;
  this change reads it. `packages/mailbox` is held at 166 tests. **This is the strongest held
  property in the change**: the work is to surface a fact an existing requirement already produces.
- `spectre-storage` — **untouched.** `packages/storage` is held at 86 tests.

## Impact

- **Requirements affected:** `extension-client` +1 requirement, **0 requirements modified**, and
  **0 requirements removed**. Because the only block is an `ADDED` one, the block count and the
  requirement delta are the same figure — which is **not** true of the last three syncs in this
  repository and is stated here so a reader does not import the other expectation.
- **Scenarios added:** 7, in the one new requirement. **Measured at sync, not predicted here.**
- **Promoted counts after sync** would stand at **167 requirements** across the same **14
  capabilities** (from **166**), and the scenario figure is what the sync measures.
- **Source touched:** `apps/extension/src/MessageSurface.tsx` (the shared listing, opt-in),
  `apps/extension/src/panel-copy.ts` (the sentences), and **one prop at `Panel.tsx:754`**. The
  panel's own component is expected to need **no behavioural change at all** — which is the point
  of `design.md` D3.
- **Tests added:** `apps/extension/e2e/side-panel.spec.ts` **13 → 20**, derived case by case from the
  delta's scenarios **and** its shared-component clause in `tasks.md` 4.1, plus unit cases in
  `apps/extension/src/Panel.test.tsx`. **`apps/web` held at 125**, **`packages/ui` held at 38**,
  **`packages/storage` held at 86**, **`packages/mailbox` held at 166**, **boundary held at 53**.
- **Manifest:** `apps/extension/static/manifest.json` byte-identical, SHA-256
  `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`, re-measured at proposal.
