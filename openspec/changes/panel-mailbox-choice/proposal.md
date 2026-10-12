# Proposal

## Why

`docs/ROADMAP.md` §17 lists **`recent mailboxes`** among the things M11's side panel
displays, and `docs/ROADMAP.md`'s Project Status block records what is still owed after
M11 slice 1: **"Recent mailboxes" is displayed and not offered.** The shipped panel renders
`panel-held` — every mailbox this device holds, newest first — as an inert `<ul>` of
`<span>` addresses (`apps/extension/src/Panel.tsx:540-551`), **with no control on any of
them.** It is a list a person can read and not one they can choose from, so the panel can
only ever show the host's association or the newest address, and `side-panel-surface`'s D3
— *"a panel showing 'simply the newest' would name the wrong mailbox for a page"* — is
permanent rather than the exception it was designed to be.

**This is an amendment and not a defect repair, and that distinction is the proposal's
first claim.** `extension-client`'s requirement says the panel SHALL **"name the mailboxes
this device holds most recently"** (`openspec/specs/extension-client/spec.md:690-691`),
and its scenario *"Several mailboxes are held"* requires only that the panel *"SHALL name
the most recent ones"* and *"every mailbox it names SHALL be one this device holds"*
(`:739-743`). **Inert `<span>` text satisfies both sentences exactly as written.** The
code conforms, and this change makes the requirement say what a product decision the
roadmap already made should have made it say. Filing it as a repair would put a false
sentence in the promoted spec — that something shipped broken — and this repository has
retracted four claims of that shape already.

## What Changes

- **The held list becomes a control.** Each mailbox the device holds becomes an individual
  choice, and choosing one makes **that** mailbox the mailbox this panel view is about.
  The list is still newest first, still a list, and still names only mailboxes this device
  holds — a chooser that offered anything else would be a new defect, not the removal of
  one.
- **The choice is TRANSIENT, and this is the decision the change turns on.** It survives a
  re-resolution of **the same** host, resets when the **host changes**, and **writes
  nothing**. The rejected alternative — a *recorded* choice writing
  `location.hostname -> mailbox id` — is recorded in full in `design.md` D2, because the
  reason for rejecting it is not obvious and a reviewer deserves to disagree with a stated
  reason rather than re-derive it: `in-page-integration:563-567` says an association is
  written **only after an address was inserted**, and the panel never inserts anything. A
  recorded panel choice would be a second writer for a contract whose entire justification
  is that insertion is the one act that *confirms* a pairing. **A choice records an
  intention, not a use.**
- **`resolveForHost` stays the single selection rule.** It is shared by the content script
  and the panel and `apps/extension/src/resolve-for-host.ts:78` is where that is stated. A
  chooser selects *which mailbox this panel view is about*; it must not become a second
  spelling of host→mailbox resolution, and `design.md` D3 records the shape that keeps it
  from doing so.
- **No new permission.** The chooser reads the same `PanelRecords.loadMailboxes` seam the
  panel already holds (`Panel.tsx:76`) and writes nothing at all, so
  `extension-client`'s non-goals requirement — *"it SHALL request no permission that no
  shipped surface uses"* — stays satisfied by the same manifest as before. **This change
  adds zero manifest entries**, and that is a property `tasks.md` makes falsifiable rather
  than a hope.
- **Three requirements are MODIFIED across two capabilities**, and one collision between
  two existing clauses is made **visible in the delta** rather than resolved silently:
  - `extension-client`'s panel requirement currently reads *"A control the panel offers
    SHALL act on the message, code or link it is beside."* **That does not cover a mailbox
    chooser, because a chooser is beside no message, code or link.** The delta widens the
    clause and says why, in the delta, so a reviewer sees the collision rather than
    discovering it after promotion.
  - `extension-client`'s non-goals requirement is re-argued rather than touched: the panel
    is now a **named shipped surface**, scenario *"A later milestone adds a declared
    surface"* requires this milestone to **amend** rather than delete, and no permission is
    requested — **which is the thing that has to stay true.**
  - `in-page-integration`'s *"The control prefers the mailbox this site was last used
    with"* carried a deferral note naming **M10** as the milestone at which a menu could be
    judged on its own evidence (`:533-539`). **M10 is closed and no such change was made.**
    The note's *limit* is still true **for the in-page affordance**; only its *milestone* is
    stale. The delta narrows the note's scope — the panel now offers the choice, the
    in-page control still does not — and **does not widen into an `in-page-integration`
    feature.**
- **One comment is corrected, and nothing else in `packages/storage` changes.**
  `loadInsertableMailboxes` (`packages/storage`, reached through
  `apps/extension/src/storage.ts:137`) deliberately does **not** merge the pre-collection
  singular record into the collection, and the note giving that reason says **"Merging
  becomes right the day a surface lists them"** — **and this is that day.** The panel is
  now that surface, so the stated reason is false. This change **corrects the comment and
  does not implement the merge**, because a merge changes what the **content script**
  offers, which is a different capability's observable behaviour for a different surface.
  Shipping a comment whose stated reason is false is the defect this edits away; shipping
  the merge would be a scope this slice does not have. `design.md` D7 records the lapse and
  names the merge as **the next thing this slice unblocks**.

## What this change does not do

Each of these is a decision with a reason, not an omission:

- **No measurement spike, because there is nothing to measure.** Every fact this change
  rests on is already in the tree: the panel exists, the held list renders, the resolution
  rule is one named module, and the chooser needs no reach the panel does not already have.
  `side-panel-runtime-facts` measured §4.6 for slice 1 precisely because a Chromium
  capability's cost was unknown; **nothing here has an unknown cost**, so a spike would be
  an artifact nobody needed. This is stated so a reader does not go looking for one.
- **The singular-record merge is not implemented.** See above; `design.md` D7.
- **No `pending verification` concept.** *"Whether verification mail is pending"* is the
  other item M11 still owes, it has **no representation at all** anywhere in
  `apps/extension/src`, and it is **not** a variation on this change: a listing carries no
  body, so a marker of that kind is a guess about a message nobody has read. It is the
  next slice.
- **No menu inside somebody else's page.** `in-page-integration`'s deferral note survives
  with its milestone corrected and its limit intact.
- **Nothing under `apps/web/` changes**, at all. `apps/web` stays at **125** tests and
  `packages/ui` at **38** — recorded in `tasks.md` as properties to hold with the
  arithmetic that accounts for any movement, not as hopes.
- **No new design token and no new motion.** A rise in `packages/ui` would mean visual
  surface no capability describes.
- **No new boundary rule.** The boundary count stays at **53**. Every property this change
  introduces already has an instrument, and **a rule added where an instrument already
  exists is not coverage.**

## Capabilities

### New Capabilities

None. A chooser inside a surface that already has a capability is that capability's
requirement changing, and a new capability for it would split one product's requirements
across two places for no gain.

### Modified Capabilities

- **`extension-client`** — two requirements. The panel requirement changes *names* to
  *offers*, and its *"a control the panel offers"* clause is widened so a chooser is
  covered by it rather than silently outside it. The non-goals requirement is re-argued
  for a milestone that adds nothing to the manifest.
- **`in-page-integration`** — one requirement. The preference requirement's deferral note
  names a milestone that has closed; its scope is narrowed so it states the limit that is
  still true, of the in-page affordance, and stops implying the panel shares it.

### Examined and left alone

Stated because an unreported examination and an unread one are indistinguishable to a
reader:

- **`mailbox-session`** — *"A listing for a caller that displays nothing reads no message
  body"* (`:827`) was **read rather than assumed**. The panel calls `session.restore()`,
  which reconciles through the path that reads verdicts, and the panel **displays** that
  listing through `MessageList`. The requirement's discriminator is whether the caller
  renders the listing, and this one does, so it belongs to *"A caller that displays the
  inbox asks for one"* and **is unaffected**. No delta.
- **`mail-parsing`, `page-composition`, `website-client`** — nothing this change does
  reaches a parser, a page composition, or the website. No delta.

## Impact

- **Changed in `apps/extension/src/`:** `Panel.tsx` (the held list becomes controls; a
  transient selection state; the mailbox the panel view is about), `panel-copy.ts` (the
  chooser's own strings and whatever the selection state says about itself), and
  `Panel.test.tsx` re-pointed where it read `panel-held` as text.
- **Comment-only, no behaviour change:** the note on `loadInsertableMailboxes` in
  `apps/extension/src/storage.ts`, whose stated reason for not merging is now false.
  **`packages/storage` itself changes nothing** — no source, no test, no adapter.
- **Re-pointed in the browser tier:** `apps/extension/e2e/side-panel.spec.ts` reads
  `panel-held` in four places (`:211`, `:240`, `:244`, `:510`), and `:244` reads it
  through `.allTextContents()` on `.panel__held-address` — **which a button cannot be**,
  so that case is a re-point rather than an edit. New cases carry the chooser's own
  claims.
- **`data-testid="panel-address"` interacts with the selection state and the change says
  how.** `Panel.tsx:478-484` carries a comment stating that an "address absent from the
  page" assertion cannot hold beside `panel-held`, and the section is guarded on
  `shown.kind === "named"`. **A person who has chosen a different mailbox beside a named
  host is still on a named host**, so the guard must stay `named` and the *address* it
  shows must become the chosen one — which is what makes `panel-address` the panel view's
  claim rather than the resolution rule's output. `design.md` D4 states the rule; `tasks.md`
  names the cases that hold it, including the positive control that a chooser beside an
  **unnamed** page changes nothing, because there is no host to be choosing against.
- **A real divergence found during exploration is recorded and not resolved here.**
  `apps/extension/src/MessageSurface.tsx:128-134` asserts that **`extension-client` forbids
  a surface** from indicating that a message carries a verification, read as a class-wide
  rule; `extension-client:252-257` says *"**The popup** SHALL NOT indicate…"*, read as
  surface-specific. **The code comment and the requirement text disagree today.** It belongs
  to the *"whether verification mail is pending"* item — M11's next slice — because
  resolving it means deciding whether the panel may carry a pending marker, which is a
  question about that item and not about a mailbox chooser. `design.md` D8 records it as a
  finding and leaves it open on purpose.
- **Counts that must hold, and are the plan's own instrument:** `apps/web` **125**
  (unchanged — this is how the change shows it touched no website at all); `packages/ui`
  **38**, for the eleventh time; the architecture boundary count **53**, unchanged, because
  no property here lacks an instrument. `tasks.md` gives the arithmetic that accounts for
  every movement it predicts, and any count it cannot account for is a finding rather than
  a rounding.
- **`pnpm verify` must pass with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
  directory**, and `pnpm test:browser` must carry the re-pointed panel cases through the
  one command that runs both tiers.
