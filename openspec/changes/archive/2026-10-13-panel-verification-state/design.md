# Design record — `panel-verification-state`

Every claim below was read out of the tree on 2026-10-12 rather than recalled. Where something is
**not** measured, this file says so in the same sentence as the claim it qualifies, because a
qualified claim read without its qualification is the defect this repository records most often.

---

## D1 — The reframed roadmap line is the requirement, and the original noun is the finding

`docs/ROADMAP.md`'s M11 *Context behavior* list now reads, at its fourth line:

> whether any message this mailbox holds carries a detected verification

and the Project Status block records why that line was rewritten rather than the change's word
quietly reinterpreted. **That record is not re-derived here.** What this change does is ship the
line the roadmap now states, and hold itself to the difference:

- **A fact, not a state.** The panel says what is in the mailbox. It does not say what is *waiting*.
- **Not a claim about the reader's attention.** *"You have not looked yet"* is not this product's
  business, and a panel that phrased its silence as the reader's oversight would be reporting the
  person's state rather than the mailbox's.
- **Not a prediction.** Nothing here says a code is coming.

**The word *pending* is not used anywhere in this change's artefacts, by design.** A product that
delivers against the roadmap's noun ratifies it, and the exploration's whole finding is that the
noun has no honest reading here.

---

## D2 — `ADDED` to `extension-client`, not `MODIFIED` on the panel requirement

**The decision: one new requirement, added. The panel requirement is not amended.**

Three reasons, and the first is the one that decides it:

1. **The block would be enormous and freshly changed.** The panel requirement
   (`extension-client` `:703`–`:843`) is **141 lines** and was amended by `panel-mailbox-choice`
   **yesterday** — it now carries an in-block amendment record, and three in-block rationale
   paragraphs. A `MODIFIED` block is the whole heading reproduced, so this change's diff would carry
   all of that verbatim and a reader reviewing it would have to diff two long blocks by eye to find
   the one sentence that changed. **That is the merge shape that gets an amendment attributed to the
   wrong assertion**, which is the same reason the 2026-10-12 exploration split M11's last item in
   two at all.
2. **The claim is separable and would be coherent alone.** "This surface states a verdict in its
   listing" is a requirement about a *listing's content*. It does not depend on the host naming
   clause, the chooser, or the transient-choice rule — it would read as a complete requirement for a
   surface that showed nothing else. Amending a requirement to add a separable claim makes the
   requirement a bag of unrelated obligations.
3. **It makes the arithmetic unambiguous.** `extension-client` +1 requirement and 0 modified, so
   **the promoted count moves by exactly the number of blocks.** The last three syncs in this
   repository each produced blocks that *replaced* rather than added, so the block count and the
   requirement delta disagreed each time, and `AGENTS.md` and `docs/ROADMAP.md` both now warn about
   it. **A reader who imports that expectation here would be wrong**, and the way to prevent that is
   to make the two figures coincide.
4. **The website already answers the question this requirement asks, and a `MODIFIED` block would
   have put two answers to one question in one requirement** — see **D14**. The panel requirement is
   the wrong home for a scheme `apps/web/src/InboxRow.tsx` has already settled and shipped.

**The cost is stated rather than argued away**: an `ADDED` block creates a requirement heading where
none existed, so `extension-client` grows one more heading for a reader to hold. That is the right
trade against a 141-line block that has already been rewritten once.

---

## D3 — The marker is read out of the listing the panel already holds

**The panel's listing already carries verdicts. Nothing in this change produces one.**

Read directly, on this tree:

- `packages/mailbox/src/state.ts:145` — `InboxListing.verdicts: ReadonlyMap<string, MessageVerdict>`,
  with the comment that **ids absent from it are `undetermined`, not `carriesNothing`**.
- `packages/mailbox/src/state.ts:84`–`:89` — the five-member `MessageVerdict` union.
- `packages/mailbox/src/inbox.ts:275`–`:282` — the verdict pass, **conditional on `readVerdicts`**,
  which only `check` sets.
- `packages/mailbox/src/inbox.ts:333`–`:341` — `verdictFrom`, which keeps code and link **apart**
  rather than collapsing them into "carries a verification".
- `openspec/specs/mailbox-session/spec.md:316` — the promoted requirement, headed *"A message is
  analysed once, and only when it is new"*, which **already obliges** the session to determine the
  verdict, to remember it so it is never determined twice, and to report it.

**So the panel's new marker is a rendering of a field the session already populated.** The
implementation is a lookup — **`verdictFor(listing.verdicts, message.id)`**, at
`packages/mailbox/src/state.ts:455`–`:459` — **defaulting to `undetermined`**, and its docstring
says why in the same sentence: *"a caller asking about a message the map has never heard of gets
'not known' rather than an accidental `undefined` it might treat as a negative answer."* That
default is exactly what this change wants (D5), and **the function is not written for this change** —
it was written so that a lookup could never produce an accidental negative.

**`Panel.tsx` is expected to change by one prop and no behaviour**, and that is the design's point:
the alternative — the panel reading a body itself to decide a row — would spend a provider request
per message to recompute an answer already in hand, which is the shape `MessageSurface.tsx`'s own
note at `:136`–`:140` already refuses.

### The listing is also read after a **failed** check, and that is retention rather than staleness

`MessageSurface.tsx:149`–`:151` renders the listing for **two** variants of `InboxState` — `checked`
**and** `checkFailed` — and `checkFailed` carries the **last known** listing, verdicts included. So
the marking renders from a listing that may have been determined on an earlier check.

**This is the session's own promoted behaviour and not the staleness D8 prohibits.** `mailbox-session`'s
requirement headed *"A message is analysed once, and only when it is new"* is precisely what keeps a
retained verdict from being re-determined, and the retention is deliberate: `inbox.ts:67` says it is
*"only ever called on success, which is what makes the retention's pruning honest"*. **A verdict
retained for the life of one session is the requirement working; a verdict written to storage is a
different thing and is forbidden** — the delta's *"a later occasion"* means a later panel, a later
session, or a later build, never a later check inside the session that determined it.

**It is recorded because a reader will ask it**, and because the honest answer is that the session's
retention and this change's marking are the same decision seen from two ends: **the marking renders
the session's answer, whenever the session has one.** The delta carries it as the scenario *"A check
failed and the last known listing is shown"*, and `tasks.md` 4.1e stages the `checkFailed` arm for
exactly this reason — including the arm that would mark every retained row unreadable, which is the
**reverse** false claim.

---

## D4 — What the panel **already pays**, and what the background wake was repaired for

**This is the change's central economic fact and it was read, not assumed.**

`Panel.tsx:406` calls `void session.restore(record)` — **the full restore path**, which reconciles
the stored mailbox through one listing **with** the verdict pass, and not through `restoreSummaries`,
which lists without it. `Popup.tsx:142` calls `session.restore(stored)` too.

The cost of that, and it is real: **one listing plus one body read per message the mailbox holds,
on adoption.** The panel pays it today, before this change, and the verdicts are simply thrown away
at the rendering edge.

**The background wake is the counter-example, and it is what makes the panel's position a property
rather than a preference.** `apps/extension/src/background-check.ts:175` declares

```ts
export type WakeSession = Pick<MailboxSession, "restoreSummaries" | "destroy">;
```

— a **type-level** statement, and its own note at `:165` calls it *"a repair rather than a
preference"*. The measured cost of getting this wrong, as recorded in `inbox.ts:100`–`:106` and in
`incoming-mail-notification`'s design record:

- a wake listing through `check` cost **one listing request plus one body read per message**, and
  **re-read them on every wake**, because each wake built a fresh tracker that remembers what it has
  read only for its own lifetime;
- against Mail.tm's `GET /messages` budget of **`30; w=60`** that is **twenty-four requests a minute
  at one message and over the whole budget at two**.

**And the repair was not only about cost: `incoming-mail-notification` rejected codes out of
notification bodies outright**, because `MessageSummary` carries no body and the wake's session
exposes only `restoreSummaries` and `destroy` — so *"reads no body"* is a property of that type
rather than a promise. A wake has **no consumer for a verdict**; the panel has exactly one.

**Therefore: this change adds zero provider requests, and that is a measurement rather than a
prediction** — the requests are already spent by a call `Panel.tsx` makes today. Task 6.2 makes the
count an assertion in the browser tier, because a design note saying "free" is not an instrument.

---

## D5 — `undetermined` is stated **on its own row**, in words — and this change reversed its own earlier answer

**This is a judgement call, and the first answer this change wrote was wrong. The reversal
is recorded rather than edited away, because a proposal that quietly swaps an answer is a proposal
whose reader cannot tell which of its positions were considered.**

### What this change first proposed, and why it is not what ships

The first draft of this record put `undetermined` **in a count** above or beside the listing, and put
the marker on the row for the three positive verdicts only. The argument was:

> *a marker means "this one carries something", and a marker that also meant "this one could not be
> looked at" would put two different epistemic qualities in one visual channel and make the marker
> itself unreadable.*

**That argument is sound and the conclusion does not follow from it**, because it treats **text and
accent as one channel when the shipped code treats them as two.** `apps/web/src/InboxRow.tsx` marks
`undetermined` **in words, on the row**, and *separately* withholds the **accent rule** from it. The
distinction the first draft missed is that the row's *words* and the row's *visual claim* are two
different instruments answering two different questions:

- **words** answer *"what does the session know about this message?"* — so `undetermined` gets them,
  because saying *"This message could not be read, so what it carries is unknown"* **names the
  uncertainty rather than asserting or denying anything**;
- **the accent rule** answers *"is something known to be in this message?"* — so only the three
  positives get it, because a rule beside a row **is a claim that something is in it**
  (`InboxRow.tsx:28`–`:35`).

### What ships instead, and it is the website's answer, not a new one

| verdict | what was observed | the row's **words** | the row's **accent rule** |
| --- | --- | --- | --- |
| `carriesCode` / `carriesLink` / `carriesCodeAndLink` | read; a detection was found | **yes**, naming which | **yes** |
| `carriesNothing` | **was** read; no detection was found | **no** — the empty string | **no** |
| `undetermined` | **was never read** | **yes**, naming that it could not be read | **no** |

**So the panel states `undetermined` on its own row, in the marking channel, and no count ships.**
The `carriesNothing` row is the only silent one, and that silence is the honest one: it is the single
verdict that means *"we looked, and there was nothing"*.

**Why the count was dropped rather than kept alongside.** A count of undetermined messages answers a
question nobody asked — *"how many?"* — while the row answers *"which?"*, and **which is the one that
lets a person go and read the message.** A count is strictly less information than the marking it
would have supplemented, and it would have put a second idiom beside the first: the website says it
per row, and this change would have said it per row *and* per count. **The count survived only in one
place: it is the thing the first draft should have asked the website about, and it was not.**

**The `undetermined` default in `verdictFor` is what makes this correct on a partial listing.** A
message id absent from the map is *not* `carriesNothing`; it is a message the product has not judged
(`state.ts:455`–`:459`). So a listing that arrives before the verdict pass finishes produces words
saying so on those rows, **and cannot produce a false negative.**

### The panel gets words and **no** accent rule, and that is a consequence rather than a gap

`apps/web` marks its rows with an accent **rule**; the panel's rows have no such rule and **this
change does not add one.** Three reasons, in order:

1. **It would be a new token, and `packages/ui` is held at 38.** An accent rule on the panel's rows
   is a visual claim this change's delta does not ask for.
2. **A class hook would be a stylesheet obligation.** The boundary rule requires every class hook a
   client renders to be selected by a stylesheet, so an accent rule means a new hook, a new rule, and
   the tokens to write it in.
3. **The words carry the claim on their own**, which `InboxRow.tsx:13`–`:19` argues for in three
   reasons: a screen reader announces it, it survives a monochrome display, and it survives the
   stylesheet.

**The node is a `<p>`, and that is a mechanism rather than a preference.** `styles.css:150`–`:151`
already declares `.popup p, .panel p` — `margin: 0; color: var(--ink-secondary)` — so a paragraph in
the panel's listing is styled by a rule that exists today, **and `styles.css` gains no rule at all.**
`Panel.tsx`'s root carries `className="panel"` at `:510`, `:523`, `:588` and `:589`, so the selector
matches. The marking therefore renders **no new class hook**; it carries a `data-testid` instead,
which is how the existing rows are read by the browser tier (`data-testid="message-list"` at
`MessageSurface.tsx:154`) and which is **not** a stylesheet obligation — the boundary rule reads
`className`, so an unstyled `data-testid` cannot fail it.

**And this is what unlocks the reversal.** Putting the words in the marking channel only became
*available* once the marking was known to be **panel-only** (D11): with one shared `MessageList` and
no opt-in, every word the panel renders would also render in the popup, and the popup's marking
channel would then hold `undetermined` — which is what made the first draft's *"two epistemic
qualities in one visual channel"* worry look like a real constraint. **It was an artefact of the
shared component, not of the channel.** With the default off, the panel is the only surface that has
a marking at all, so **the website's answer about `undetermined` ports without qualification** — what
is *not* ported is named immediately below, and it is a different thing.

### What is *not* ported, and why that is a narrowing rather than an omission

`InboxRow.tsx`'s closed set `CARRIES_VERIFICATION` is **not** ported, and its own docstring says why
it cannot be ported without its other half. Read at `:28`–`:35` and `:60`–`:67`: the three positive
verdicts are named *"because including them would put the accent rule beside a row whose message could
not be read"* — **the set's only consumer is the accent rule**, and this change adds none (above). A
named set with no consumer is a second thing to keep in step, which is the reason
`panel-copy.ts` exists in the first place. **So the panel ports the exhaustive marking record and not
the set that feeds a visual rule it does not have** — see **D14**.

---

## D6 — No confidence is rendered, and the reason is two facts about the parser

Two measured facts about `packages/mail-parser`, both read on this tree, and together they make a
number **unrenderable rather than merely unfashionable**:

1. **Confidence is capped by construction, not by clamp.** `detect-codes.ts:102` sets
   `MAX_CONFIDENCE = 0.85` with the comment that it is *"reachable by construction: `BASE +
   KEYWORD + SOLE = 0.85`"* — **no set of rules can reach 1.0**, so the maximum is a property of the
   scoring, not a safety rail added afterwards. `detect-links.ts:40` and `:54` do the same at
   `0.70`. `AGENTS.md` records this as *"no detection is ever reported as certain"*.
2. **A reducing shape is a penalty, never an exclusion.** A copyright year is still **returned**,
   ranked last. So `carriesNothing` means *"read whole, nothing ranked above the penalty floor"* —
   **not** *"there is provably no code in this message"*.

**Consequences written into the requirement:** the panel SHALL NOT render a confidence value or a
percentage, and its wording SHALL NOT assert that a message carries no verification — **it says what
the session found.** A row reading *"no verification"* would be a stronger claim than any
specification in this repository supports, and it would be false of the `0.85`-capped detection that
exists in every message.

---

## D7 — The link half has a **measured false negative**, and the requirement does not claim otherwise

`packages/mail-parser/src/extract.ts:470` recovers anchors from **`a` elements with an `href`**.
A verification destination delivered as **plain text** is therefore not recovered as a link.

**This was measured in this repository, not theorised**: `verification-actions`' browser case
shipped a synthetic body carrying the destination as plain text and the page reported *"No
verification link was found in this message"* on a message whose readable text plainly contained
the URL. `AGENTS.md` records it, and `fixtures.ts` names it.

**Two consequences for this change:**

- **The requirement does not say "finds every verification".** It says the panel states what the
  **session determined**, and the session's answer has a known blind spot.
- **A false negative here does not produce a false claim.** The message's verdict is
  `carriesNothing`-or-`carriesCode`, which is a statement about **the analysis**, not about the
  message. **This is the strongest argument for the requirement's phrasing:** the moment the wording
  became *"this message carries no verification"*, this blind spot would become a false statement
  the product makes. Wording is load-bearing here, not stylistic.

**This blind spot is `mail-parsing`'s behaviour and is out of this change's scope.** It is named so
nobody discovers it through the panel.

---

## D8 — The verdict is in memory only, and this change **SHALL NOT** persist one

**Decision: no stored verdict. No new contract member, no new adapter, no new key.**

The reasoning, and it is the same reasoning `site-associations` used for the mailbox collection:

- The verdict is a **function of a body the provider may change**, of a **parser version**, and of
  **what this device has asked for**. A stored verdict would outlive all three.
- Persisting it would mean a panel opened tomorrow reports a verdict computed by a parser that has
  since changed, with no way to know it is stale. **A stale marker is worse than no marker**, because
  it is read as current.
- Nothing asks for persistence. The roadmap's line is about **the panel**'s context, and a panel
  that is closed has no context to be stale about.

**So `packages/storage` is held at 86 tests and `spectre-storage` is untouched** — and that is a
decision, not an omission. `tasks.md` 3.3 and 7.4 make both falsifiable rather than asserted in a
design note.

---

## D9 — The host-property reading is rejected on **falsifiability**, and its cost was not the deciding factor

**The rejected reading:** *"a page beside the panel is asking for a code right now"* — i.e. a
property of the **host**.

**Stated honestly first: this reading is the more expensive one, and it costs more in ways this
change cannot fund.**

- It needs `tabs`, which `docs/PROVIDERS.md` §4.6 measured comes with the ability to **read across
  every window**, and `extension-client`'s host-naming requirement was explicitly designed to avoid
  (`the side panel names the page it is beside` — *"SHALL NOT obtain the host by … requesting a
  permission it does not already hold"*).
- It needs a mailbox check per page, on a panel that resolves a host on every tab change.

**Cost, then, pointed the same way as the decision. The deciding factor is different, and saying it
was cost would be a weaker argument than the one available:**

> **No instrument in this repository can produce the fact.**

Playwright adds **no `Page` for a docked panel at all** — `AGENTS.md` records the page count rising
only by the launcher's own page. The substitute this repository uses is opening the panel document
**as a tab**, and a tab-hosted document is **its own active tab**, so it cannot answer *"which page
am I beside"* — **which is that reading's entire defining fact.**

**A green browser tier would be silence rather than evidence there**, and a browser case that passed
for the wrong reason is a shape this repository has recorded more than once. Shipping an unverifiable
claim to look responsive is worse than shipping the narrower true one.

**The mailbox reading has none of this problem** — *"a message this mailbox holds was found to carry
a code"* is a property of the mailbox, is true identically whether the panel is docked or a tab, and
is assertable in the unit tier, the browser tier, and by reading the type.

**A residual that is recorded rather than glossed:** `openPanelOnActionClick` is unset, so **whether
a person can reach this panel at all has never been measured** — Chromium's own side-panel entry
point is UI no instrument here reads. That uncertainty is about **reach**, not about the correctness
of what is rendered once reached, and it does not change this decision.

---

## D10 — **Two** comments this change falsifies, both **comment-only** and neither load-bearing

The comment states:

> **`MessageSummary` carries no codes and no links, on purpose** … So a row *cannot* say a message
> carries a verification, and **`extension-client` forbids a surface** from indicating that one does.

**Two of its three claims are correct and the third is broader than the spec.**

- *"carries no codes and no links, on purpose"* — **correct.** `packages/core` states it on purpose:
  listing must not require fetching bodies.
- *"a row cannot say a message carries a verification"* — **correct for a `MessageSummary`.** But it
  is **not** true of the *listing*, which after the verdict pass carries `verdicts` — see D3.
- *"extension-client forbids **a surface**"* — **false as written.** The clause reads ***The popup
  SHALL NOT** indicate that a message carries a verification until it has opened that message*
  (`:270`), inside a requirement headed *"The extension's **popup** performs its first milestone's
  actions over the shared session"* (`:250`), with the scenario *"A check has listed messages"*
  (`:312`). **A search of the promoted specs returns exactly two clauses of this shape and both name
  the popup.**

**The popup's own rationale is about carrying, not about surfaces**, which is what makes the panel
legitimate rather than merely unregulated:

> "the count the popup showed before is the whole of what a listing can support, and a marker the
> listing cannot carry would be a guess about a message nobody has read."

**The panel's listing does carry it.** The popup's reasoning is sound and does not reach here.

**Why the correction is not load-bearing.** The clause this change adds is **positive** — the panel
*states* the verdict. The panel does not need a permission, so no one has to read the old comment to
learn it may proceed. **The comment is corrected because it is wrong, and correcting it in the same
change that makes it wrong is what keeps the next reader from reading it as a rule.** It is carried
as a task with its own Verify clause (`tasks.md` 5.1) precisely because a comment-only edit is the
easiest kind of change to skip.

### The second one is this change's own finding: `inbox.ts:105`–`:106`

The same note in `packages/mailbox/src/inbox.ts` — the one that records why `restoreSummaries` exists
at all — ends:

> …and **`apps/web/src/Inbox.tsx` is the only caller in this repository that reads a verdict at
> all.**

**This change makes that false**, in the same commit, and it is the sentence a future reader would
quote back at the wake's cost. The correction names the panel as the second caller and keeps the
measured arithmetic intact, because the arithmetic is about the wake's **repeating** cost and the
panel is destroyed with its surface (D4).

**It is comment-only, and that is what keeps `packages/mailbox` held at 166 tests** — a comment is
not a test, and `tasks.md` 5.2 makes the diff's comment-only-ness the assertion rather than trusting
this sentence.

---

## D11 — `MessageList` is **one component serving both surfaces**, and that is what forces the opt-in

**This is the constraint that shapes the implementation, and it is a live promoted prohibition rather
than a style preference.**

`MessageSurface.tsx` **exists precisely because both surfaces need the same list.** Its own module
docstring says so (`:6`): *"**`Popup.tsx` held these four components module-private, and the panel
needs them identically.**"* And both import the same one:

- `apps/extension/src/Panel.tsx:71` — `import { MessageList, OpenedMessageView } from "./MessageSurface";`
- `apps/extension/src/Popup.tsx:47` — the same line.

**So a verdict marker implemented inside `MessageList` lands in the popup**, and the popup is
exactly where `extension-client` says:

> **The popup SHALL NOT** indicate that a message carries a verification until it has opened that
> message. *(`:270`, inside a requirement headed "The extension's **popup** performs its first
> milestone's actions over the shared session", with the scenario "A check has listed messages".)*

**The naive implementation violates a promoted requirement.** That is the finding, and it is why the
requirement this change adds is **positive** rather than merely *unprohibited* — D12.

### The mechanism: one optional prop carrying the panel's **words**, and **its default is off**

```ts
/** A surface's words for a verdict. Every kind is listed, including the one that renders nothing. */
type VerdictWording = Readonly<Record<MessageVerdict["kind"], string>>;

MessageList({ state, onOpen, verdictWording })   // verdictWording absent => no marking at all
```

- **`Popup.tsx:314` passes nothing** and therefore renders exactly what it renders today — the
  component gains the *capacity* and does not exercise it.
- **`Panel.tsx:754` passes `verdictWording`**, the exhaustive record from `panel-copy.ts`.
- **The default is `off`, and that direction is the requirement.** A popup that forgets to pass the
  prop must be silent. A prop defaulting to *on* would make the **forbidden** behaviour the default
  and the allowed one the exception, so the failure mode of a future refactor would be a **spec
  violation** rather than a missing feature.

**Why the prop carries the panel's words and not the verdicts map.** The verdicts are **already
inside `state`** — `MessageSurface.tsx:155` reads `state.listing.messages`, and `listing.verdicts`
sits beside them (`state.ts:144`–`:145`). So the panel passes **nothing it owns and the component
lacks**: each row's verdict is read with `verdictFor(state.listing.verdicts, message.id)`, and the
**only** thing that has to cross the surface boundary is the wording. **Passing the map instead would
create a second source that can disagree with the rows it marks** — a panel handed the wrong
mailbox's map would mark rows with another mailbox's verdicts, and nothing would report it.

**Why the words are the panel's and not the shared module's.** `panel-copy.ts`'s module docstring
says it plainly: *"**The message surface's words.** The listing, the codes, the delivery reports and
the link labels are `POPUP_COPY`'s, in `MessageSurface.tsx`, because both surfaces render the same
facts about the same mailbox."* **These are not the same fact on both surfaces** — the popup is
forbidden to render them — so they are the **panel's** words, exactly as `CodeClipboardActions` is
*"a caller-supplied object rather than a string in `POPUP_COPY`"* for *"the control is the panel's
and not the popup's"* (`MessageSurface.tsx:54`–`:58`). And `popup-copy.ts`'s own rule — *"a depiction
can only show a string, so a function-valued entry is one no depiction may claim to render"* — has
the same cousin for a string: **a panel-only sentence placed in `POPUP_COPY` is one the website's
depiction could claim the popup renders, and the popup does not.**

**Why the prop and not a panel-only wrapper component.** A wrapper forks the list — a second copy of
the decision table `panel-mailbox-choice`'s D2 forbids, and the two would drift on exactly the
question this change is about. **The prop is the idiom this file already uses**: at `:210`–`:215`,
`OpenedMessageView` takes `clipboard` and `links` as *absent-for-the-popup* props, with the note that
*"a surface that does not ask for an affordance does not get one"* — **not a disabled control and not
a hidden one**, because an inert control is the fake-UI defect `page-composition` forbids.
**`verdictWording` is the `links` precedent exactly**: `links` is a record of labels the caller owns
(`:233`) and its absence is what keeps the popup free of them; `verdictWording` is a record of
wording the caller owns and its absence is what keeps the popup free of *those*.

### The popup cannot opt in even by accident, and that is asserted rather than argued

A future "consistency" pass could add `verdictWording` to the popup's call site. **That is a
requirement violation, and it is caught by a case rather than by review** (`tasks.md` 4.2): one case
stages the same mailbox on **both** surfaces and requires a marking on the panel and **none in the
popup**. A case that checked only the panel would pass with the prop defaulting to on.

---

## D12 — The requirement is **positive**, and D11 is the strongest reason for it

**The change adds a clause that says the panel states the verdict. It does not rely on the absence of
a prohibition as its permission.**

The first draft of this record gave one reason: a search of the promoted specs found **no clause**
forbidding a surface other than the popup from indicating a verification, so the panel is not
forbidden — and **not being forbidden is not being permitted.**

**That reason stands, and D11 supplies a second one that is stronger because it is not about absence
at all.** The prohibition that exists **does** name a surface, that surface **renders the very
component** this change must modify, and the prohibition's scenario — *"A check has listed
messages"* — **is the state the panel is in.** So:

- an **omission** in the spec could have permitted this, and silence is not consent;
- **and the nearest applicable clause, read to its surface, points the other way for the popup.**

A positive clause is therefore not tidiness. It is the only thing that distinguishes *this surface
may say it* from *this surface may not*, in a component both surfaces share.

So the `ADDED` requirement carries:

- **the positive clause** — the panel *states* it, with named scenarios;
- **the popup's prohibition left untouched and inapplicable to the panel**, with **D11's shared-
  component fact recorded inside the block** — so a reader who arrives at the new requirement and
  asks *"does anything forbid this?"*, or *"where is the popup?"*, finds both answers in the same
  file rather than reconstructing them;
- **the wording discipline** — *states what the session determined*, never *certifies what the
  message contains*, per D6 and D7.

---

## D13 — The popup pays for verdicts it **cannot** render, and **cannot be shown to be rendering any**

`Popup.tsx:142` calls `session.restore(stored)` — **the full path, with the verdict pass**.

**Can the popup be shown to be rendering verdicts today? No, and the reason is structural rather than
incidental: `MessageList` takes no verdict.** Its props today are `{ state, onOpen }` and nothing
else — it reads `state.listing.messages` and `message.from`/`message.subject`/`message.id` off each
summary, and `MessageSummary` carries no code and no link. **So the popup holds verdicts in its
session and the shared component has no channel to render them through.** There is **no violation
today**, and that is now established rather than assumed — which is what D11 turns on, because D11's
whole risk is a component gaining the channel.

**The finding therefore stands and is stronger than the first draft made it.** The popup **spends one
body read per message** on a verdict it structurally cannot render — the same waste
`background-check.ts` was repaired for, **at a smaller scale**: the popup is destroyed with its
window rather than repeating on every wake, so D4's `30; w=60` arithmetic does not apply.

**Recorded rather than fixed, and the reason is scope:** switching the popup to `restoreSummaries`
would change a surface this delta does not describe, **in the one product area with a live
prohibition**, on the strength of an optimisation. **It is also now obvious that D11 and this finding
push the same way**: the popup should neither *pay* for a verdict nor be *able* to render one, and
`restoreSummaries` plus an absent prop achieves both. `tasks.md` 7.4 makes it a reported finding for
the orchestrator rather than a silent edit.

---

## D14 — The website already ships half of this scheme, so the panel **ports** what is portable and
## explains what is not

**`apps/web/src/InboxRow.tsx:59`–`:85` is the marking decision, already written, already reasoned
and already shipped:**

```ts
const CARRIES_VERIFICATION: ReadonlySet<MessageVerdict["kind"]> = new Set([
  "carriesCode", "carriesLink", "carriesCodeAndLink",
]);

const MARKING: Readonly<Record<MessageVerdict["kind"], string>> = {
  carriesCode: "Contains a one-time code.",
  carriesLink: "Contains a verification link.",
  carriesCodeAndLink: "Contains a one-time code and a verification link.",
  carriesNothing: "",
  undetermined: "This message could not be read, so what it carries is unknown.",
};
```

Three properties of that code are why it settles this change rather than merely informing it:

1. **The record is exhaustive over the union, including the empty case** — `carriesNothing: ""` is
   written out, because *"the row shows no marking' is a deliberate outcome here rather than a
   missing case."* **Adding a sixth verdict to the union would fail to compile here**, which is the
   type doing the work the test would otherwise have to. **The panel's record is exhaustive too, and
   for the same reason.**
2. **The marking is text, and `InboxRow.tsx:13`–`:19` gives three reasons**: a screen reader
   announces it, it survives a monochrome display, and it survives the stylesheet.
3. **The set is closed and named**, and its docstring (`:59`–`:67`) gives its reason: *"Naming the
   three positive verdicts makes the omission a decision rather than an oversight"* — and the other
   docstring says what the omission is protecting. At `:28`–`:35`: *"`carriesNothing` and
   `undetermined` are **not** marked … **a rule beside a row is a claim that something is in it.**"*

### What ports, and what does not, and the third item is the reason

- **Ports: the exhaustive marking record**, in `panel-copy.ts` as the panel's own words (D11), over
  the same union, including the empty case. `apps/web` is **untouched** — this is a port of a decided
  thing across a shared type, and **two clients rendering one union differently is exactly the
  divergence a closed record exists to prevent.**
- **Does not port: `CARRIES_VERIFICATION`.** Its only consumer is the accent rule, and this change
  adds no accent rule (D5). **A named set with no consumer is a second thing to keep in step**, which
  is the reason `panel-copy.ts` exists at all — and shipping it would import a structure whose own
  docstring explains a visual rule the panel does not have. **This is recorded as a narrowing rather
  than quietly dropped**, because "the delta mirrors the website" is exactly the kind of phrase a
  reader takes to mean *line for line*.
- **The requirement clause the closed set served is still met.** The delta says a message the session
  has not determined *"SHALL NOT be presented as carrying a detection"*; the exhaustive record
  discharges it in words (`undetermined` names that the message could not be read, `carriesNothing`
  renders nothing), and `tasks.md` 6.2 makes the removal of that wording a named falsification arm.
  **If a future slice adds a visual claim to the panel's rows, the closed set becomes load-bearing
  and this narrowing must be revisited then** — recorded so the next change inherits the reason rather
  than having to rediscover it.

**This is also a fourth argument for `ADDED` over `MODIFIED` (D2):** the panel requirement is not the
home of a scheme `apps/web` has already settled, and folding the port into a 141-line block about
host naming and mailbox choice would put a decided decision where nobody will look for it.

---

## Alternatives considered and rejected

### A1 — Amend the existing panel requirement (`MODIFIED`)

Rejected in **D2**: a 141-line block changed yesterday, a separable claim, and a block/delta
arithmetic that would be unambiguous here and has been misleading three times recently.

### A2 — The host-property reading: *"a code is waiting for this page"*

Rejected in **D9**: unfalsifiable with any instrument in this repository. Its cost also pointed away
from it, and that is **not** the deciding factor.

### A3 — Persist the verdict so the panel can state it before any read

Rejected in **D8**: a stale marker is read as current, and the verdict is a function of a body, a
parser version, and what has been asked for. Costs a storage contract member and buys a claim that
can be wrong.

### A4 — Fold `undetermined` into "no verification"

Rejected in **D5**: it is the one false claim in this product that costs a user the code they were
waiting for, in `state.ts`'s own words.

### A5 — Render the confidence as a number to be honest about the cap

Rejected in **D6**: the cap is a property of the scoring, and a number beside a row would invite it
to be read as a probability, which the ranking is not.

### A6 — **REVERSED.** Render `undetermined` in the marking channel

**This alternative was rejected in the first draft of this record and is now what ships.** The
rejection rested on *"it puts two epistemic qualities in one visual channel"*, and that reasoning
described the code correctly — but the first draft had not read `apps/web/src/InboxRow.tsx`, and the
shipped code separates what the reasoning had merged: **the row's words and the row's accent rule are
two instruments**, and the website puts `undetermined` in the first and withholds it from the second.

**A rejected alternative that turns out to be right is recorded as reversed rather than deleted**
(D5). Deleting it would leave a reader unable to tell whether it had been considered.

### A7 — A second listing component for the panel

Rejected in **D11**: it is a second copy of a decision table, and the popup/panel split is already
solved in this file by two absent props.

### A8 — A count of undetermined messages, in addition to the per-row marking

Rejected in **D5**: a count answers *"how many?"* while the row answers *"which?"*, and **which is
the one that lets a person go and read the message.** It is strictly less information than the marking
it would supplement, and it would put a second idiom beside the first — the website says it per row,
and this change would have said it per row *and* per count.

---

## What is deliberately not verified by this change

Recorded here so the Verify clause of a task cannot be read as covering them.

- **Nothing about how a person reaches this panel.** `openPanelOnActionClick` is unset and Chromium's
  own side-panel entry point is UI no instrument in this repository reads (D9).
- **Nothing about how the panel looks.** No test in this repository reads a rendered pixel's colour
  or position. **The marking is verified as DOM, text and accessible name** — and the panel's marking
  is *words only*, with no accent rule, so there is no visual claim to look at (D5).
- **Nothing about a real provider.** Every provider response in both tiers is a recorded one.
- **Nothing about which real services deliver verifications in which shape**, including the
  `<a href>`-only blind spot in D7. **This repository has never received verification mail from any
  service.**

---

## Amendments recorded at apply (2026-10-13)

**Decisions taken during apply that are not derivable from D1–D14. The measurements, the
falsification table and the held-property counts are in `tasks.md`'s
`## Amendments recorded at apply`, and are cross-referenced rather than repeated here.**

### A1. A falsification harness must never run `boundaries.test.ts` in parallel

**D15. This is a constraint on how any measurement of this repository is run, and it was measured by
being violated.**

`tests/architecture/boundaries.test.ts`'s positive controls **plant files into the real working
tree**, and two of them **edit tracked files in place** — `apps/web/index.html` and `package.json`.
**Four concurrent `pnpm test` processes therefore delete each other's probes mid-read**, every run
goes red with `ENOENT`, and the race **loses restores**, leaving the planted probes behind in a dirty
tree that then reads as a product defect on the next run.

**Why it belongs in design rather than in a note.** The generalisation is already stated at the top of
this file's own history — *"a test placed outside a collected glob is silently skipped"*, and
*"a sweep matching nothing satisfies every assertion above it for ever"*. **This is the same class
one level up: an instrument whose failure mode is a corrupted tree rather than a red assertion**, and
nothing in the suite can report it, because the suite is the thing doing the corrupting. **A repair is
deliberately not proposed**: one serial run never collides, so the correct response is a constraint
on the harness, and a block that violates it is a defect in the block. Both tracked files were
restored and verified byte-identical to `HEAD` after it was found.

### A2. The Panel case's load-sensitivity is recorded as a finding, and repairing it is declined

**D16. This is the tenth recorded precondition defect in this repository and the first one this change
measured but chose not to fix.**

One `pnpm verify` run went red on `Panel.test.tsx > names the mailbox this page resolves to and the
provider that served it`, with the panel still on *"Asking that page which host it is on…"* — the wait
released the case before `resolveThePage` had published anything. **The rate on every clean
instrument is 0 in 66 runs** (60 serial unloaded, 6 serial under 6 CPU burners); the case appeared in
8 of 20 runs **only** under four concurrent `pnpm test` processes, which is the condition D15 shows
corrupts the tree and so is not a measurement of this case.

**Why declining is the decision and not an omission.** **A threshold change is excluded first**, and
on the recorded grounds rather than on taste: raising `findByRole`'s timeout does not establish the
precondition, it buys time, and **it is this repository's own recorded defect with a larger number**.
**The isolation shape is known and does not fit**, which is the part worth recording: the file's own
ninth precondition repair (`Panel.test.tsx:521`) waits on `panel-host` no longer saying *"asking"*,
and that signal is **strictly earlier** than what this case asserts on, because `resolveThePage` calls
`setReading` at `Panel.tsx:269` **before** `await records.loadSiteMailboxId(...)` at `:276`. **Copying
the sibling's repair would have been a repair that looks like the recorded one and is not it.**

**Then two independent reasons the change is declined rather than deferred.** **The case and the
code path it exercises are untouched by this change** — the `Panel.test.tsx` hunks are at 31–47,
111–123 and 1755+, and `Panel.tsx`'s are an import, one prop and a comment. **And a repair whose
failure cannot be reproduced on demand cannot be falsified**, which is the same rule that makes a
branch no assertion can reach unfalsifiable rather than uncovered. **The finding is therefore
recorded here and in `tasks.md` A7, and the case is left exactly as it shipped.**

### A3. Task 3.4's Verify clause contradicted task 5.2, and the clause is amended rather than the task

**D17. Recorded because two halves of one task file were allowed to disagree, and the obvious repair
was the wrong one.**

3.4's Verify required `git diff --stat` over `packages/mailbox` **and** `packages/storage` to be
**empty**, while 5.2 edits `packages/mailbox/src/inbox.ts` in this same change. **Deleting 5.2's edit
to satisfy 3.4 would have satisfied the clause by leaving a false claim standing in the source**, so
the clause is the part that is corrected: `packages/storage` empty, and `packages/mailbox`
**comment-only with an empty behavioural diff** — which is 5.2's own clause already, so 3.4 defers
to it instead of restating a weaker version.

**The principle is the one this file keeps restating, in the direction that costs something:** *when
a task's Verify clause is unsatisfiable, the clause is the defect.* A clause that can only be met by
breaking another task is not a strict check, it is an instruction to break one.

### A4. M9 is a green the suite is built to produce, and it is not counted as a catch

**D18. One falsification arm edits a comment, and no assertion in either tier reads a comment.**

It is filed as `green, predicted` and excluded from the caught count. **A survivor means the assertion
did not catch it, never that the assertion is too weak, until the mutant has been read and shown to
be the thing it claims** — and this one is a comment, read and shown. **The prediction is recorded
rather than the outcome**, because a green predicted before the run is a measurement and a green
explained afterwards is a rationalisation.