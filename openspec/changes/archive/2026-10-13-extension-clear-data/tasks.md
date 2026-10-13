# Tasks

Nine groups. **Each group lands the tests and the documentation its own work calls for**, so a group
whose work needs neither carries neither. The last group is the things this change deliberately does
not do and the hand-offs it owes.

**Six properties are held from the first group to the last and are restated here so no group can be
read in isolation without them.** Any movement in the first four is a finding to explain before
anything else is looked at; the fifth is a defect; the sixth is a byte comparison.

| held at | what | why |
| --- | --- | --- |
| **125** | `apps/web` tests | the website already ships this control (`apps/web/src/LocalData.tsx`) and **this change touches it not at all** — it ports the website's *decision*, it does not write a second control |
| **38** | `packages/ui` tests | **adding a token, a class hook or a stylesheet rule is a failure of this change** (`design.md` D5). The region is `<section>`, `<h2>`, `<p>` and `className="control"`, and **all four are already selected by rules that exist** |
| **86** | `packages/storage` tests | **`clearAll` and its falsification already exist** — `chrome.ts:218`, `chrome.test.ts:235` and `:257`. This change adds a caller, not a guarantee |
| **166** | `packages/mailbox` tests | the panel reads what the session already produced and the removal reads no session member at all |
| **53** | architecture boundary assertions | **no rule is added** — every property below already has an instrument, named in 7.1 |
| **byte-identical** | `apps/extension/static/manifest.json` | zero new permissions, zero new manifest keys. SHA-256 `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`, re-measured at proposal — the same hash `panel-verification-state` recorded |

**`mailbox-session`, `in-page-integration`, `visual-system` and `page-composition` carry no delta in
this change**, and that is a decision rather than an omission: the control is inside a surface three
promoted requirements already describe, and `design.md` D5 is why no visual-system clause moves.

---

## 1. What the region says — `apps/extension/src/panel-copy.ts`

- [x] 1.1 Add **ten `PANEL_COPY` entries** for this control, each carrying the requirement sentence it
      serves beside it the way every existing entry does. The set is fixed here so a reviewer reads a
      list rather than diffing prose:

      | entry | shape | serves |
      | --- | --- | --- |
      | `removalHeading` | string | the region's `<h2>` |
      | `removalHoldsNothingYet` | string | the "nothing is kept on this device" shape |
      | `removalOffers` | string | the control that offers removal |
      | `removalConfirmWarning` | string | the irreversibility argument |
      | `removalConfirm` | string | the control that removes |
      | `removalKeep` | string | the control that backs out |
      | `removing` | string | while the removal is in flight |
      | `removalRefused(reason)` | **function of the platform's words** | a refusal |
      | `removalDone` | string | the removed shape |
      | `removalDoneMeans` | string | what removal is *not* |

      **Every one is `PANEL_COPY`, and the requirement's *"Every sentence the region shows SHALL be a
      `PANEL_COPY` entry"* is why.** **The file gains no new export** — `panel-copy.test.ts`'s
      *"exports nothing that could become a second table of what counts as a detection"* pins
      `Object.keys(panelCopy)` to exactly four names, so a new `PANEL_REMOVAL_KEYS` would fail an
      existing case and a new list is not what the requirement wants anyway.

- [x] 1.2 **`removalDoneMeans` states what was removed and what was not, in one sentence.** It says the
      removal took **this device's note of** the mailbox, that a later visit will not offer that
      address back, and that **the address still works until the provider discards it**. **It SHALL NOT
      say the address is gone, deleted, closed, or no longer exists** — and `PANEL_COPY.mailboxGone`
      (`"That address no longer exists."`) already exists for a *measured* claim about a provider
      reporting `expired`, so reusing its wording here would import a claim about a provider into a
      sentence about a storage area.

- [x] 1.3 **No entry names a host and no entry names a provider.** `resolve-for-host.ts` decides which
      mailbox a host means, and the host sentence three sections up already carries the host; a
      sentence in this region naming either would be the second spelling `design.md` D3 exists to
      prevent, and this region is read *beside* the host sentence.
      **No entry may carry the word *pending*, a percentage, a confidence value, or a claim that a
      message carries no verification** — not because this region is about messages but because
      `panel-copy.test.ts`'s forbidden-phrasing sweep already reads **every** `PANEL_COPY` entry
      (`everyPanelSentence`), so a new sentence that broke one of those four would turn an existing
      case red. **That is a property of the instrument and it is stated rather than rediscovered.**

- [x] 1.4 **Do not add an entry to `PANEL_CHOOSER_KEYS`.** It is pinned to exactly three names by two
      existing cases (`"declares exactly the three entries the chooser renders"` and `"adds no chooser
      key"`), **and the removal control is not a chooser entry** — it chooses nothing, and the reader
      that sweeps those three keys resolves each against an address this region never has.

## 2. The region — `apps/extension/src/Panel.tsx`

- [x] 2.1 Render a `<section aria-labelledby="panel-removal-heading">` holding the heading, the shape's
      own `<p>`, and — **in the stored shape only** — a `<button className="control">` offering
      removal. **In the confirmed shape the region holds the warning `<p>` and two `.control` buttons:
      the one that removes and the one that backs out** — copied from `LocalData.tsx:135`–`:172` for
      the shape and **not** from its wording, because every sentence here is `PANEL_COPY`'s (1.1).
      **No `className` beyond `control` is introduced** (`design.md` D5), and the region is preceded
      by a comment saying why, in `Panel.tsx`'s own idiom.

- [x] 2.2 **The control that removes exists only in the confirmed shape, and the confirmed shape is
      reached by a press on the offering control.** So a removal cannot happen on the first press —
      which is the requirement's *"the control that performs the removal SHALL exist only after a
      further explicit step"* and is **the property a case must be able to catch a mutation of**, not a
      property the DOM happens to have. Give the region a `data-testid` for the confirmed shape and one
      for the removed shape, **named rather than derived from the copy**, for `Panel.tsx:783`–`:788`'s
      reason: a test that follows the wording rewords itself quietly.

- [x] 2.3 **Three states, chosen by what is established — and the region is withheld entirely until the
      boot read has finished.** `LocalData.tsx:14`–`:35` is the model and its reasoning is the whole
      requirement's ninth scenario: *"a branch reachable on an unknown value is a branch that will
      eventually assert something unverified."* So: **boot not done → the region renders nothing at
      all**; boot done and `held.length > 0` → the offering shape; **the removal just happened → the
      removed shape, which is not the "nothing is kept" shape** — `LocalData.tsx:24`–`:29` says why
      and the distinction is the requirement's *"SHALL report that it holds nothing"* rather than a
      page that cannot tell whether the button worked.

- [x] 2.4 **A refusal is reported and the promise is broken in neither direction.** On a rejection the
      region carries a `role="alert"` sentence holding `removalRefused(reason)` with **`reason` being
      the platform's own words**, and it says **neither that the data remains nor that it is gone** —
      `LocalData.tsx:47`–`:59` argues why the second half matters: `chrome.storage`'s `clearAll` has
      **no queued-removal semantics at all** (`chrome.ts:218` records there is no `deleteDatabase`), so
      here a rejection *is* the whole answer and a sentence in either direction would be inventing it.

- [x] 2.5 **The mailbox is untouched by the removal.** Nothing in the removal path calls
      `session.destroy()`, `session.closeMessage()` or `session.close()`, and **no state that drives the
      inbox is reset.** Write that as a comment beside the removal callback, because the requirement's
      *"the mailbox SHALL remain on screen and its inbox SHALL remain usable"* is otherwise satisfied by
      accident and broken by a later change that tidies up.

## 3. The seam — `apps/extension/src/Panel.tsx`, `panel-main.tsx`, `storage.ts`

- [x] 3.1 **Add exactly one member to `PanelRecords`, and it is `clearAll`.** Named by what it removes
      rather than by the records it covers, and reached through the **singular** contract while the area
      holds four kinds (`design.md` D4). `loadMailboxes` and `loadSiteMailboxId` stay reads and **the
      type gains no write member at all**, so the requirement's *"SHALL write no storage record of that
      mailbox again"* is discharged by the type having no outlet — the property `Panel.tsx:221`–`:223`
      already claims and this change must not weaken.

- [x] 3.2 **`panel-main.tsx` passes it as `storage.records.stored.clearAll`**, bound as an arrow so it
      does not lose `this`, **and passes nothing else.** Do not widen `ExtensionRecords`
      (`storage.ts:68`–`:73`) and do not add a member there either: the four adapters and their
      documentation are correct today, and a fifth member would be a change `packages/storage` does not
      need and this change cannot justify.

- [x] 3.3 **A whole-area reader and an arbitrary-key planter, in
      `apps/extension/e2e/helpers/stored-mailbox.ts`**, exported beside the existing `readRaw` /
      `writeAndConfirm` pair rather than written a second time in a spec. `readWholeArea` returns **every
      key** the platform lists, and `plantUnrecognisedRecord` writes a key this build has no code for —
      `"a-record-from-another-build"`, the name `chrome.test.ts:258` already uses, so the two tiers
      plant the same thing. **The planter reads the write back** for the reason
      `seedMailboxCollection:333`–`:337` gives: a write and a read back make the write a precondition
      rather than a hope.

- [x] 3.4 **`readWholeArea` carries a positive control in its own case's use, not in itself.** A reader
      that answered `[]` for every device would satisfy 5.1's B3 for ever — **and a sweep matching
      nothing is the defect this repository records more often than any other** — so B3 asserts the
      planted record **is** listed *before* the removal and **is not** listed after it. **Both halves
      are asserted; one of them is the control.** This is the technique ported from
      `apps/web/e2e/storage.spec.ts:228`–`:256`, including its ordering rule: **plant after the
      mailbox is stored**, so a key-scoped removal would leave the planted key behind.

## 4. Unit cases

### 4.1 `apps/extension/src/Panel.test.tsx` — 44 → 53

- [x] 4.1 **Nine cases**, one per region claim a DOM can settle, each named for the scenario it
      carries rather than for the widget:

      | # | case | settles |
      | --- | --- | --- |
      | 1 | offers a way to remove what this device holds | the offering shape, and **that the control which removes is not on the page** |
      | 2 | offers no removal and says nothing is kept on a device that holds nothing | the empty shape |
      | 3 | withholds the whole region until the boot read has finished — **and neither kept nor not-kept is said** | the ninth scenario, reached by holding `loadMailboxes` open |
      | 4 | removes nothing before the further step, **and the control that removes exists only in the confirmed shape** | the second scenario, asserted on both halves |
      | 5 | a confirmed removal reaches the contract's whole-area operation **and no other member** | `clearAll` called once; the two reads still reads |
      | 6 | reports holding nothing afterwards and offers no further removal | the fourth scenario |
      | 7 | keeps the mailbox on screen and usable, and writes it back nowhere | the sixth scenario, including `records.clearAll` not being called again |
      | 8 | states that this device's note was removed and that the address still works | the fifth scenario, and that no sentence claims gone |
      | 9 | reports a refused removal as one, and in neither direction about the data | the seventh scenario, **driven by a rejecting `clearAll`** |

      **Case 5 is the one that cannot be satisfied by a DOM.** Four keys checked after the fact would
      pass against a removal that deleted them by hand; **asserting the operation is what the
      requirement says** — and the reason is `chrome.test.ts:251`–`:254`'s, which is that an empty area
      is what both a whole-area clear and a delete-every-known-key produce. **Case 9 is the only one
      that reaches the refusal, and it is unit-only on purpose** — see 5.1.

- [x] 4.2 **Case 3's precondition is established, not timed.** Hold the boot read open with a deferred
      the test resolves itself, **then assert the region's absence while it is held**, rather than
      reading the page immediately after mount — which is the weak-precondition defect this repository
      has recorded three times, every time authored and caught by the change that found it.

- [x] 4.3 **`Popup.test.tsx` stays 25 and no case in it is edited.** The region is a panel concern and
      the popup renders none of it. A movement there would mean the popup grew a removal control, which
      is the fake-UI defect `page-composition` forbids.

### 4.2 `apps/extension/src/panel-copy.test.ts` — 12 → 17

- [x] 4.4 **Five cases, all about the sentences:**

      | # | case | settles |
      | --- | --- | --- |
      | 1 | every one of the ten new entries resolves to real words, and the function-valued one is called with a reason | **a renamed entry leaves every sweep reading nothing** |
      | 2 | the ten entries are spelled out **literally** here and are each present in `PANEL_COPY_KEYS`, and the other direction too | a typo exempting an entry that is not there |
      | 3 | **no entry claims the address is gone**, read over **every** `PANEL_COPY` sentence and not only the new ten — with **one negative control planted into a new entry and one into an existing one** | *"the mailbox is gone"* reworded into a removal sentence |
      | 4 | the removed shape and the empty shape say **different sentences**, and the removed shape's carries the mailbox's address nowhere | the two being collapsed, `LocalData.tsx:24`–`:29`'s defect |
      | 5 | the panel's own forbidden-phrasing sweep covers the new entries — **the existing case does this already**, so this is a case asserting the *enumeration grew*, not a new sweep | a second sweep where one exists |

- [x] 4.5 **Case 3's pattern is named, not a bare alternation, and its control is the sentence it
      forbids** — `panel-copy.test.ts`'s own `FORBIDDEN` shape, and the same reason: a sweep reporting
      *which* forbidden claim and *where* is one a reader can act on. **Do not exempt any new entry by
      hand**, because a hand exemption with no rule behind it is the defect `panel-copy.ts`'s own note
      about the *No verification link* wording records.

## 5. Browser cases

### 5.1 `apps/extension/e2e/side-panel.spec.ts` — 20 → 28

- [x] 5.2 **Eight cases, one per browser-observable scenario.** Each reuses `stage()` and the file's
      existing readers; **no second copy of the staging order** — `in-page-fill.spec.ts`'s
      `open-mailbox.ts` exists for exactly that, and a selector duplicated is no better than a helper.

      | # | case | observable |
      | --- | --- | --- |
      | B1 | offers a way to remove what this device holds, **and the control that removes is not on the page** | the DOM, both halves |
      | B2 | removes nothing until the further step is taken — **read from the platform's own area, not from the DOM** | `readWholeArea` before and after the first press |
      | B3 | a confirmed removal empties the area **including a record this build does not recognise** | `readWholeArea` empty, **and the planted key listed before it** (3.4's control) |
      | B4 | reports holding nothing afterwards and offers no further removal | the DOM |
      | B5 | keeps the mailbox on screen and **its inbox usable** after the removal — *retitled at apply; the amendment is at 6.1* | the DOM, **and a listing the panel's own cadence produced with nobody asking** |
      | B6 | states what was removed and that the address still works — **and its reader carries a positive and a negative control** | the DOM, read by a scoped reader |
      | B7 | costs **no provider request** and reaches no origin the tier did not script | `traffic`, the file's existing idiom |
      | B8 | offers no removal and says nothing is kept on a device that holds nothing | the DOM, from a plain `stage()` — the device is empty because `afterEach` clears it |

- [x] 5.3 **B2 is the one written against a recorded precondition defect, and it is the case the
      change most needs.** Reading the DOM for "nothing was removed" is satisfied by a panel that never
      removed anything on either press, so B2 asks **the platform** and asserts it twice — once after
      the offering press, once after the confirming press. **The second assertion is the control for
      the first**: a reader answering "empty" for every device would pass the first and fail the second.
      This is `site-associations`' *"a poll that starts satisfied passes immediately on a controller
      that never wrote anything"*, in a browser tier.

- [x] 5.4 **B6's reader is scoped to the removed region's own `data-testid`** rather than a page-wide
      text search, **because the address is on the page three sections up** — the same defect
      `showingLine`'s note records, where a `getByText` on an address resolved to three elements and a
      `toHaveCount(1)` failed on a panel that was entirely correct. Its two controls: **a planted
      sentence claiming the address is gone must be reported**, and **the reader must return the shipped
      sentence unmodified** — so a reader that returned every paragraph cannot pass B6 for the wrong
      reason.

- [x] 5.5 **Two scenarios are unit-only, and the reasons are recorded rather than left to look like
      coverage.** *Removal is refused*: **the browser tier has no way to make a real
      `chrome.storage.local` reject a clear**, so a case for it would have to lie about the platform —
      which is the recorded shape of *"a case would have to lie about the sender"* that
      `in-page-integration` records as deliberate non-coverage. *What the panel knows is not yet
      established*: the boot read is a real asynchronous read of a real area and **there is no window
      in which to catch it**, so a case for it would be a case about a race. **Both are carried by
      4.1's cases 3 and 9**, and the count 20 → 28 is **seven scenarios plus B7 and B3's control half**,
      which is the arithmetic stated rather than rounded to eight scenarios.

- [x] 5.6 **`manifest.spec.ts` stays 12 and no case in it is edited.** The manifest is byte-identical
      (table above), and `manifest.spec.ts:246` hard-codes the four permissions. A movement there would
      mean this change added a permission, which is the thing the requirement forbids.

## 6. Falsification

- [x] 6.1 **Every deliberate violation is caught by the assertion aimed at it.** Run the table below
      through a harness and report `caught` / `wrongcatch` / `green` / `noop` / `nocompile` /
      `harness-error` — **all five counters besides `caught` must be zero.** `wrongcatch` is a failure
      named by another assertion: one naming **an assertion about the same property** is an attribution
      to fix, and one naming **an unrelated assertion** is the real defect. `nocompile` counts as its
      own outcome, because a mutation that cannot compile is not evidence about an assertion.

      | arm | mutation | aimed at |
      | --- | --- | --- |
      | V01 | the region renders the confirming control before the further step | 4.1 #4, B1 |
      | V02 | the confirming control's press handler removed | **4.1 #5**, B2 — *amended, see below* |
      | V03 | removal implemented as four `remove()` calls rather than `clearAll` | **B3 alone** — *amended, see below* |
      | V04 | the panel names `chrome.storage.local` directly | **the boundary rule**, not a case — and that is the point (7.1) |
      | V05 | `removalDoneMeans` reworded to claim the address is gone | 4.2 #3, B6 |
      | V06 | the removed shape replaced by the "nothing is kept" shape | 4.1 #6, B4 |
      | V07 | the removal path also tears the mailbox down | 4.1 #7, B5 |
      | V08 | a rejection rendered through `removalDone` | 4.1 #9 |
      | V09 | the region rendered before the boot read has finished | 4.1 #3 |
      | V10 | the offering control rendered on a device holding nothing | 4.1 #2, B8 |
      | V11 | **a stylesheet rule or a class hook added for the region** | **the boundary rule and the `packages/ui` count, not a case** |

      **Amendment, recorded at apply (2026-10-13): V02's and V03's declared unit catchers were both
      wrong, and both corrections were made against a measurement rather than an argument.**

      **V02's real unit catcher is 4.1 #5, not #4 — and #4 passing is the correct answer, not a hole.**
      The declared catcher was *"removes nothing before the further step, and the control that removes
      exists only in the confirmed shape"*, and deleting the confirming control's handler cannot affect
      either half of it: the control is still absent before the further step, and it is still present in
      the confirmed shape. What deleting the handler *does* break is 4.1 #5 — *"a confirmed removal
      reaches the contract's whole-area operation and no other member"* — because the removal never
      reaches `clearAll` at all. **So the declared name was a case about the control's existence while
      the mutation was about what the control does**, and a reader expecting #4 to go red would have met
      a green and concluded the suite was weak.

      **V03's only catcher is B3, and the unit tier provably cannot see it — so the declaration's
      "and 4.1 #5" is deleted rather than left to be explained.** The four `remove()` calls are spelled
      *behind* `clearAll`, in `panel-main.tsx`: `PanelRecords` still receives one `clearAll`, called once,
      with no other member touched, which is **exactly what 4.1 #5 asserts**. The unit seam is the
      contract, and the mutation leaves the contract identical while changing what the adapter does
      behind it — **which is the whole reason B3 exists**, since only the platform's own area can tell a
      whole-area clear from four hand-deleted known keys (`chrome.test.ts:251`–`:254`, quoted at 4.1).
      **The unit run reporting `passed` under V03 is therefore the tier working, not a gap**, and it is
      filed the same way 6.3 files a mutation that renders identically: **a green here is the designed
      result**, and filing it as a survivor would credit the unit tier with a discrimination it does not
      have.

      **The mutation needed a cast to be expressible, and that is a finding rather than a formality.**
      `ChromeStorageArea` declares `get`, `set` and `clear` — **no `remove`** — so spelling four
      `remove()` calls through the typed seam does not compile, and the arm was written through
      `readChromeLocalArea()` with an `as unknown as { remove }`. **The storage package's own contract is
      what makes the hand-deleted-keys shape unreachable in typed code**, which is a stronger guarantee
      than B3's assertion and is recorded here because `nocompile` is a first-class outcome in 6.1: this
      arm compiled only by escaping the type that forbids it.

      **Amendment, recorded at apply (2026-10-13): V07 came back `green` on the browser tier, and that
      green was a real gap rather than a broken mutant — so B5 was repaired and V07 re-run.**

      **B5 as first written asserted the address, the listing and the row were all still on screen after
      the removal, and V07 passed all three.** V07 adds `session.destroy()` to the removal path, and
      `packages/mailbox`'s own suite states the consequence as a measured fact — `inbox.test.ts`'s
      *"answers an explicit ask after being destroyed, but schedules nothing further"*. **So a destroyed
      session keeps rendering the last address and the last listing it was given**, and a frozen inbox is
      indistinguishable from a live one through the DOM. **The requirement's word is *usable* and the
      case was asserting *present*** — the recorded *"an assertion narrower than the rule it
      documents"*, and this change's own instance of it, found by the arm rather than by review.

      **B5 now also waits for a listing nobody asked for, and that is the only observable that separates
      the two.** An explicit press would settle nothing, because a destroyed session answers one; only a
      request the panel made on its own can. The count is read *after* the row is on screen and *before*
      the removal, with `expect(listingsBefore).toBeGreaterThan(0)` beside it — **so a wait for "more
      than zero listings" cannot be satisfied by the adoption's own listing arriving late**, which is
      `site-associations`' *"a poll that starts satisfied passes immediately on a controller that never
      wrote anything"* arriving in a third tier.

      **The ceiling is `INBOX_POLL_CEILING_MS + INBOX_POLL_PROMPT_MS`, and the addition is deliberate.**
      `INBOX_POLL_CEILING_MS` is *"the longest this package will wait between checks"*, so a wait of
      exactly that length races the check it is waiting for — `motion-and-reduced-motion` recorded that
      defect precisely, its repair's ceiling red in six runs of ten because the wait and the poll were
      the same length. **Both terms are imported**, so no number here was picked to be large enough, and
      the measured cost is **7.4 s and 9.8 s on two consecutive unmutated runs** against that 35 s bound.

      **The repair was falsified in both directions, and its first attempt failed in the direction that
      looks like a defect in the product.** The reader first counted Guerrilla `check_email` calls, and
      B5 is staged with a plain `stage()` — so the extension's **primary** provider is Mail.tm, the
      panel lists through Mail.tm, and the repaired assertion sat at `Received: 0` for 30 s **on the
      unmutated tree**. **A reader pointed at the wrong provider is the same defect as a `-g` pointed at
      the wrong case**: it runs, reports a confident number, and the number is about something else. The
      repair reads Mail.tm's `/messages?page=1` — the spelling `in-page-fill.spec.ts` already uses, and
      whose reason `recorded-provider.ts:147` carries: the route table lists `/messages/{id}` **before**
      the collection so the item route cannot shadow it, and a filter loose enough to match both would
      count every body read as a listing. **V07 was then re-run against the repaired case and caught by
      the new assertion alone**, at `Expected: > 1, Received: 1`.

      **The harness itself was wrong twice before it measured any of this, and both defects are ones this
      repository has recorded elsewhere.** It reached Playwright through
      `pnpm --filter … test:browser -- -g "<title>"`, and **the `--` was forwarded as a literal argument
      while `cmd.exe /s` stripped both quotes off the title** — so every browser arm ran the full
      97-case tier, the `n !== 1` guard fired, and all seven were filed `harness-error`. **Those runs
      had measured something, but not the declared catcher, so they were discarded rather than credited.**
      The repair ran Playwright's own CLI through `node` so argv is passed directly and a title cannot be
      re-split on the way — the same fix as the recorded `pnpm.cmd` `EINVAL spawnSync` hazard. The second
      defect was then in the harness's own summary parser: it demanded **both** a `passed` and a `failed`
      line, and Playwright's line reporter omits `passed` entirely when nothing passed — **so the one
      outcome this harness exists to produce read as an instrument defect**, which is `in-page-fill`'s
      recorded *"harness-error while the same run's output is full of failing assertions naming the right
      case"*. The parser now requires the four counters to **add up to the number collected**, which holds
      in both directions and so cannot be satisfied by a summary that was never printed.

      **Amendment, recorded at apply (2026-10-13): two assertions shipped in a shape their own comments
      contradicted, and both were found by reading rather than by any gate — which is recorded as the
      kind of thing a falsification pass does not find.**

      **4.1 #3 ended with an assertion that was a literal duplicate of the one above it**, under a
      comment claiming *"a stronger statement than 'the region is absent' — an empty `<section>` would
      satisfy the queries above"*. **It would not have: a duplicated assertion is the query above.** The
      replacement asserts what the comment names — that the panel has decided **nothing** — by naming the
      four shapes' own testids rather than the region's absence. **A prefix sweep would have read that
      absence as the claim**, because `offering` and `holdsNothing` carry no testid on their `<section>`
      at all (`REMOVAL_TESTID` is a `Partial` record for exactly that reason, `Panel.tsx:278`) and put
      `panel-removal-offer` *inside* it — **the same "a sweep that matches nothing satisfies the claim
      above it" shape, reached here by a sweep that would have matched the wrong things.**

      **B6's positive control said it was *"asserted as an equality rather than as a containment"* while
      both of its lines used `toContain`**, the second re-asserting the containment already made two
      lines above. **A correct note and an incorrect assertion are produced by the same mistake**, and
      only a reader holding both could have said so. It now asserts `toEqual` over the region's own
      **paragraph list**, read through `removalRegionParagraphs`. **That is the one distinction a
      whole-region string cannot make**: `innerText` answers *what does the region say* and cannot tell
      *returned the two sentences* from *returned something containing them*, nor catch a reader that
      trimmed or reworded inside a paragraph, nor a region carrying a third paragraph. 5.4's two controls
      are therefore a **negative** one — a planted *"the address is gone"* must be reported — and a
      **positive** one that is finally the equality its comment described.

      **Amendment, recorded at apply (2026-10-13): the repairs above invalidated two rows of this
      table, and that is recorded here rather than left for a reader to notice.**

      **V09's declared catcher is 4.1 #3, and V05's declared catchers are 4.2 #3 and B6 — all three
      were rewritten by the amendment above.** A falsification row says which assertion caught the
      mutation **as it was when the mutation ran**, so **once the assertion changes, the row
      describes an assertion that no longer exists**, and the catch it reports is evidence about the
      *old* one. **Only V07 was re-run after its repair**, and it is re-run above precisely because
      that is the one row whose catcher changed and was re-measured. **V09 and V05 were not.**

      **The repair is to re-run the whole table against the shipped tree rather than the two
      affected rows**, because two rows re-run in isolation read as *"the two at risk were checked"*
      while the other nine go unverified against a tree they were never measured on after the last
      edit to it — **and a table is a claim about one tree, so it is only quotable if every row in
      it came from the same tree.**

      **It is also the cheaper instrument for the alternative.** Re-running V09 and V05 alone is two
      mutations and two runs; re-running the table is eleven, of which four are boundary-only and
      cost no browser time at all. **A count of rows is not a count of risk, and the row that looked
      safest — V09, the bluntest mutation in the table, 26 failures — was one of the two whose
      catcher had been rewritten.**

      **The verdict this replaces was a single block run before those repairs, and it is reported
      below as superseded rather than corrected in place.**

      **Amendment, recorded at apply (2026-10-13): V04 and V11 were both caught, both by boundary
      rules rather than by any case, and both are counted as caught.**

      The table above declares each of them *"the boundary rule, not a case — and that is the point"*,
      and the run bears that out: V04 (naming `chrome.storage.local` directly) is reported by
      *"keeps storage, cookies, and the URL out of every client"*, and V11 (a class hook or a
      stylesheet rule added for the region) is reported by *"uses every class hook a client renders"*.
      Neither was reported by a unit or browser case, and **neither was expected to be** — which is
      the whole content of 7.1, the section asserting that every property this change introduces
      already had an instrument.

      **So they are caught rather than filed as survivors, and the distinction is the one 6.1 draws
      for `wrongcatch`.** A survivor means *no assertion reported this defect*; V04 and V11 were both
      reported, by an assertion that exists for exactly this class of defect and names the offending
      file. **A falsification record that filed them as survivors because no unit case named them
      would be reporting a coverage gap this change does not have** — and would be reporting it in
      the direction that reads as rigour, since "the boundary rules caught it" is a sentence that
      looks like coverage being found rather than like a number being inflated.

      **V11 is the arm that makes this worth stating rather than filing quietly**, because a class
      hook added for the region would move `packages/ui`'s count, and the count is this change's
      declared failure (`design.md` D5). A mutation that reported *through the count* would be
      measured by reading a total rather than by running anything; the rule that actually caught it
      reports **by name**, which is why the arm has a catcher at all.

- [x] 6.3 **One arm is recorded as evidence and not counted: "the sentences live in `PANEL_COPY`
      rather than inline in `Panel.tsx`."** No mutation can prove where a string literal lives, and the
      arm that moves a sentence inline **compiles and renders identically** — so a green run would be
      *correct*, not a survivor. **The same treatment a branch no assertion can reach gets**, because
      reporting twelve of twelve would mean something weaker than it appeared to. The property is
      carried by review plus the pinned export list (1.1), and that is what it is.

- [x] 6.4 **Restore every mutated file and prove it.** SHA-256 per mutated file against a digest taken
      before the mutation, **and rebuild `dist/` from the restored source** — `in-page-fill` recorded a
      restored `fill.ts` beside a `dist/` still holding the last mutation, read afterwards as evidence
      about a mutation two minutes gone. **The instrument lives outside the repository and is deleted
      when the run finishes**: `extension-preview`'s pass failed `pnpm lint` on four temporary scripts
      in the root, and a measuring instrument left in the root is something every future `pnpm lint`
  has an opinion about.

- [x] 6.5 **The whole table re-run against the shipped tree, and three findings that are about the
      arms rather than about the assertions.** The amendment above commits to re-running the table
      rather than the two affected rows; this is that run, and it is reported as eleven rows with
      three measurements that did not come out the way the row predicted.

      | arm | mutation actually applied | declared catcher | outcome | the assertion that failed |
      | --- | --- | --- | --- | --- |
      | V01 | `Panel.tsx` — the confirming pair also renders in the `offering` shape | 4.1 #4, B1 | **caught** | **both**: 4.1 #4 (`Panel.test.tsx:2438`) and its sibling 4.1 #1 (`:2283`), plus B1 (`toHaveCount(0)` → `1` for `panel-removal-confirm`) |
      | V02 | `Panel.tsx` — the confirming control's `onClick` no longer calls `removeEverything()` | 4.1 #5 (amended), B2 | **caught** | **both**: 4.1 #5 at the shared helper's `findByTestId("panel-removal-removed")`, and B2's control assertion (`toEqual([])` → three keys and the planted one) |
      | V03 | already run, on this tree, before this pass | B3 alone (amended) | **caught** | B3 at `side-panel.spec.ts:2232` (recorded by the run that measured it) |
      | V04 | `Panel.tsx` — `removeEverything` reads `chrome.storage.local` | the boundary rule | **caught** | *"keeps storage, cookies, and the URL out of every client"* (`boundaries.test.ts:2831`) |
      | V05 | `panel-copy.ts` — `removalDoneMeans` reworded to *"The address is gone."* | 4.2 #3, B6 | **caught** | **both**: 4.2 #3 (`panel-copy.test.ts:754`, *"a claim that the address is gone"*) and B6 (`toMatch(/still works/iu)`) |
      | V06 | `Panel.tsx` — the `removed` shape renders `removalHoldsNothingYet` | 4.1 #6, B4 | **caught** | **both**: 4.1 #6 (`Panel.test.tsx:2480`) and B4 (`toContainText`) |
      | V07 | `Panel.tsx` — the removal path calls `session.destroy?.()` | 4.1 #7, B5 | **caught** | **B5 alone**, at its repaired assertion: `Expected: > 1, Received: 1` after the 35 s ceiling. **The unit tier was green — see below** |
      | V08 | `Panel.tsx` — a rejection sets `removed` instead of the platform's words | 4.1 #9 | **caught** | **4.1 #9 and nothing else** (`Unable to find role="alert"`) |
      | V09 | `Panel.tsx` — **both** boot gates defeated, so the region renders before the read lands | 4.1 #3 | **caught** | 4.1 #3 (`Panel.test.tsx:2367`, the region's own `<h2>` was on the page) — **but see below: no single-site mutation reaches it** |
      | V10 | `Panel.tsx` — the empty device is put in the `offering` shape | 4.1 #2, B8 | **caught** | **both**: 4.1 #2 (the *nothing is kept* sentence absent) and B8 (`toBeVisible`) |
      | V11 | `Panel.tsx` — `className="panel__removal"` added to the region's `<section>` | the boundary rule and the `packages/ui` count | **caught** | *"uses every class hook a client renders"* (`boundaries.test.ts:3528`), **by name**. **`packages/ui` stayed at 38 and passed** — the count did not move, which is the point the V11 amendment above makes |

      **`wrongcatch` 0, `green` 0, `noop` 0, `nocompile` 0, `harness-error` 0.** Every arm ran both of its
      declared tiers where it has two; the seven browser arms this pass ran each collected **exactly
      one** case, read off Playwright's own JSON report, because a `-g` naming a case the file does not
      carry would report nothing — and a harness that cannot tell that from a pass is the recorded
      *"harness-error while the same run's output is full of failing assertions naming the right case"*.
      Playwright's CLI was invoked through `node` so the title reaches argv intact, and no two
      `test:browser` runs overlapped.

      **Three arms did not measure what their row names, and all three are recorded rather than
      reworded into a pass.**

      **V09's row names a property the panel holds in two places, so no single-site mutation of the
      removal shape can falsify its declared catcher — and the row did not say which site it meant.**
      The region is withheld before the boot read by **two independent gates**: `Panel.tsx:657`'s
      `{ kind: "unknown" }` and `Panel.tsx:713`'s whole-panel early return. Measured, in that order:
      defeating **only** `:657` left **53 of 53 green** — the case passes because the panel returns a
      different tree, not because the shape is `unknown`; defeating **only** `:713` left 4.1 #3 green
      too (`:657` withholds the region on its own) and was reported instead by *"never asks the page
      for a host before it knows what this device holds"*, which is a different property. **Defeating
      both is what "the region rendered before the boot read has finished" actually is**, and that is
      the mutation the row above carries and the one 4.1 #3 catches. **So the catcher is sound and the
      row's mutation site was underspecified** — a row that names a defect rather than a site is
      quotable only when the reader can find the site, and this one could not be falsified without
      reading `Panel.tsx` to discover there are two gates rather than one.

      **V07's first spelling failed four cases for a reason that was the stub and not the panel.**
      `session.destroy()` is a real member (`packages/mailbox/src/session.ts:169`), and `Panel.test.tsx`'s
      `stubSession` carries no `destroy` — so the faithful spelling threw a `TypeError` **inside the
      removal's own `try`**, the region fell into the refusal shape, and cases 5, 6, 7 and 8 all failed
      at the *same* shared helper's wait rather than at their own assertions. That is an arm measuring
      the fixture. Re-spelled as `session.destroy?.()` — same intent, no throw — **the whole unit tier
      was green**, which is the amendment above's recorded result reached independently, and **B5's
      repaired listing-count assertion caught it alone**. The unit tier's blindness here is not a gap in
      case 4.1 #7; it is that case's own comment — a destroyed session keeps rendering what it was last
      given, so nothing in `jsdom` can see the difference.

      **V04's first spelling was not a violation the declared rule can see, and the reason is that the
      rule excludes member access on purpose.** `(globalThis as …).chrome.storage` puts a `.`
      immediately before `chrome`, and `CLIENT_STORAGE_API_PATTERN`'s lookbehind is `(?<![\w.$-])` — so
      that spelling was reported by *"keeps the extension platform global to one module"* and **not** by
      the declared rule. Re-spelled as a bare `chrome.storage.local` read, **the declared rule fired**
      (`boundaries.test.ts:2831`), **and two assertions of the platform-global rule fired beside it** —
      the same property asserted more broadly, which 6.1's vocabulary classes as an attribution to note
      rather than a `wrongcatch`.

      **V02's five unit failures are one property reached five times, and the row should say so.** Four
      of the five are cases that cannot complete a removal at all and fail inside the shared
      `removeEverything` helper; the fifth (4.1 #9) presses the control directly and finds no alert.
      **A catcher that names the control's behaviour, and a set of cases that all depend on the control
      behaving, is not five wrong catchers** — and the row's amended catcher, 4.1 #5, is the one among
      them whose own assertions are reachable.

      **Restoration, measured rather than asserted.** Two files were mutated — `Panel.tsx`
      (`8c22df4c76a91de46313946fbfe7146569a2461e4c8767f11806c79922273895`) and `panel-copy.ts`
      (`49ea6abb7d6de20fb0768815d33ceb3688ba17ea69cdc013952088122f23afbb`) — and both carry those
      digests again after the run, restored by the inverse edit and checked with `Get-FileHash`, never
      with `git checkout` or `git stash`. `panel-main.tsx` was not touched by the ten arms of this pass
      but **was** mutated and restored by the V03 run that preceded them, and it still carries its V03
      digest `7de44ccee2f1c79cc08456bf3dfbcd0a6a1879ef9bc7ee6c056674c3e4d1a120` — **which 6.6 records
      is a fact that had to be re-established after a restore destroyed the file, not a fact that was
      never in doubt.** **`apps/extension/static/manifest.json`
      is byte-identical at `313e1bc735ef01df0dead8d28d0e6a0318f23f4f6b6b3d0645f97c2d52392ea3`**, and
      `dist/` was rebuilt from the restored source. `pnpm verify` exited **0** once: **62 files, 1228
      tests**, `packages/storage` **86**, `packages/ui` **38**, boundary assertions **53**, and
      `git status --short` shows the same eight modified files the change started with. The instrument
      lived in `%TEMP%\opencode\` and is deleted; **nothing this pass ran is inside the repository.**

- [x] 6.6 **The restore mechanism was wrong once in this change, and it destroyed uncommitted work —
      so 6.4's digest check is what caught it, and the correction is that the digest must be taken
      before the mutation and the restore must be the inverse edit.**

      **V03's restore was `git checkout -- apps/extension/src/panel-main.tsx`,** which is the
      conventional way to undo a mutation and is exactly the wrong way to undo **this** one. The
      change's eight modified files are **uncommitted**, so `git checkout --` reverts the file to
      **HEAD** — which carries no `clearAll` member at all, because `panel-main.tsx`'s edit *is* the
      wiring this change adds. **The restore did not fail loudly: `git checkout` exits 0 and prints
      nothing, and the next command in the sequence read a digest and compared it.**

      **The digest check is the whole of the defence, and it is the part 6.4 already required.** Taken
      *before* the mutation the file is `7de44ccee2f1c79cc08456bf3dfbcd0a6a1879ef9bc7ee6c056674c3e4d1a120`;
      after the `git checkout` it is `ee025970db642c540492718e453645b4ee5e3ac66446259861b9bc40f8ff03ad`.
      **A digest taken after the mutation would have been `ee025970` for both**, and the file would have
      been reported restored while carrying none of the change.

      **Recovery was not complete on the first attempt, and only the digest said so.** The block was
      re-applied from the transcript of the earlier read, and the SHA came back `0c16e2b104bc9ae5d8ee
      31338f7818a7a356cc50a6bd05134b4861c212509feb` — **not** `7de44cee`. The line count matched
      exactly (86 → 105 LF, so the structure was right), and a diff read at that point looks finished.
      The difference was **one word inside the comment block**: `loadSiteMailboxId` where the original
      said `readSiteMailboxId`, a same-length substitution that no line count and no structural check
      can see. **Correcting that single word returned `7de44cee` exactly.** **A restore verified by
      reading the file is a restore believed, and a restore verified against a pre-mutation digest is
      a restore proved** — and they differ here on a token that carries no behaviour at all.

      **So the recorded rule, and it is a change to 6.4 rather than a case in this table:** the
      restore mechanism is **the inverse edit**, never `git checkout` and never `git stash`, and a
      `git status --porcelain` that comes back *empty* for a file this change modifies is the signature
      of the failure rather than of tidiness. This is `in-page-fill`'s recorded *"restoring a source
      file is not restoring what the browser serves"* in a **new direction** — that one restored the
      source and left the build holding the last mutation; **this one restored neither, and reported
      success while doing it**, because the mechanism it used cannot report a partial failure. **A
      restore step whose own command exits 0 whether or not it worked needs its digest to be read, not
      assumed.**

      **The tree is whole, and "whole" is measured rather than asserted:** `panel-main.tsx` is back at
      `7de44cee…`, `Panel.tsx` at `8c22df4c…`, `panel-copy.ts` at `49ea6abb…`,
      `apps/extension/static/manifest.json` at `313e1bc7…`, `apps/extension/src/styles.css` at
      `d93a2ff1…`, `dist/` rebuilt from restored source, `git status --short` showing **the same eight
      modified files**, and `pnpm verify` re-run **after** every restore and exit **0** at **62 files /
      1228 tests** — **which is the fifth measurement of this tree at that total**, so the falsification
      arms left no residue a gate can see.

## 7. Boundaries

- [x] 7.1 **No boundary rule is added, and the count stays at 53.** Every property this change
      introduces already has an instrument, and here they are **by name** — a property without a named
      instrument is a property nobody has checked:

      | property | the instrument that already holds it |
      | --- | --- |
      | the panel names no platform store, and reaches removal through the contract | *"keeps storage, cookies, and the URL out of every client"* — reports by name, its only exemption being the browser tier's own `testDir` read out of each suite's config |
      | `Panel.tsx` names no platform global at all | *"keeps the extension platform global to one module"* — `Panel.tsx` reads `chrome` only through `extension-platform.ts`, before and after this change |
      | the extension writes no mailbox record from anywhere in `src/` | *"stops the extension writing the record it only reads"* — **and, stronger than the rule, `PanelRecords` has no write member** (3.1) |
      | no class hook is rendered that no rule selects | *"uses every class hook a client renders"* — the rule that reported two unstyled hooks during `in-page-fill` |
      | no stylesheet literal, no removed focus indicator, every `var(--…)` resolves | *"keeps a remote origin and a removed focus indicator out of a shipped stylesheet"* and its unresolved-token scan |
      | every new panel sentence is held to the no-percentage / no-confidence / no-*pending* / no-"carries no verification" rule | `panel-copy.test.ts`'s *"carries no forbidden phrasing…"*, which reads **every** `PANEL_COPY` entry rather than a declared subset |
      | the copy module has not grown a second decision table | `panel-copy.test.ts`'s *"exports nothing that could become a second table"*, pinning `Object.keys(panelCopy)` to four names |
      | the new browser spec is collected, and by nothing else | *"collects every browser spec, and never as a unit test"* |
      | the new unit cases are collected rather than silently skipped | *"collects every test this repository ships"* |
      | the region escapes no markup | *"keeps a markup escape hatch out of every client"* |
      | the panel reaches no provider of its own, and restates no shared value | *"stops a client restating a value a shared package already owns"* and the provider-id-list rule — B7 is the behavioural half |

      **53 staying at 53 while the tree gains a control is the measurement this group exists to
      report.** A rule added where an instrument already exists is not coverage — it is a second thing
      to keep in step, and `incoming-mail-notification` reached the same result for the same reason.

## 8. Gates, repeated runs, and the counts

- [x] 8.1 **`pnpm verify` exits 0, three times, with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory.** Three is the number this repository runs at an apply stage and the reason is
      recorded: the gate that catches a file edited since Prettier last ran is `format:check`, and it
      does not catch it on the first run.

      **Amendment, recorded at apply (2026-10-13): one `pnpm verify` run in this change was red, on a
      case this change did not write — and the first measurement of it was wrong in the direction that
      would have put the blame here.**

      **The red was `Panel.test.tsx` *"names the mailbox this page resolves to and the provider that
      served it"*, failing `findByRole("heading", { name: "guerrilla" })` with
      `TestingLibraryElementError: Unable to find role="heading"`** after the default **1000 ms**. The
      dumped DOM is the whole finding: `boot.done` is **true** (the full panel rendered rather than
      `PANEL_COPY.booting`), the inbox is populated, and `panel-host` still reads *"Asking that page
      which host it is on…"*. So the boot read finished and **`reading` was still `"asking"`** — and
      `shown` is `reading`-derived (`Panel.tsx:481`), which is why the address section is absent.
      **The case is the first in the file**, and the chain it waits on is four awaits deep *behind* the
      boot read: `records.loadMailboxes()` → the effect that fires once `boot.done` flips →
      `findActiveTab()` → `sendToTab()`. A `findByRole` on its very first invocation in a process pays
      for the accessible-name machinery too, and **1000 ms is the assertion's budget, not a ceiling
      anybody chose.**

      **It is pre-existing, and that was measured at the merge-base rather than asserted.** A detached
      worktree at `7e7fd81` — this change's proposal merge, with none of its work present — was
      installed offline and `Panel.test.tsx` run **ten consecutive times in each tree**, the two
      measured separately and sequentially, reading the case's own identity from a `--reporter=json`
      report rather than from an exit code:

      | tree | runs | failed that case | total cases |
      | --- | --- | --- | --- |
      | **this change's tree** | **10** | **0** | 53 |
      | **`7e7fd81`, this change absent** | **10** | **2** (runs 9 and 10) | 44 |

      **Both reds are that same case, with the same assertion, on the tree without this change's work
      in it** — which is what makes it pre-existing rather than merely unexplained.

      **And these twenty runs carry the caveat the paragraph three below ends up recording about
      themselves**, which is stated here rather than left for a reader to connect: **this block did not
      assert it was alone in the tree, and evidence found later shows another runner was on this
      machine at this period** (see the discarded three `pnpm verify` runs below). So the two rows above
      are **ten runs each, on a machine whose load was not held equal or recorded**, and **they are the
      reason the difference is not attributed rather than a measurement that could attribute one.**

      **What this measurement does establish, and it is one thing: `noreport=0` on every one of the
      twenty runs.** Every run produced a parseable `--reporter=json` report, so **not one run was a
      `harness-error`** — a rate quoted out of a report the runner never wrote would be the recorded
      *"a check that did not run is not a check that passed"*, and it is stated here because the tally
      above is only as good as the reports behind it. **The case counts were also read from those
      reports and are 53 here and 44 at the baseline**, which is the measurement that 4.1's nine and
      4.2's five actually landed rather than landed somewhere else.

      **What it does not establish is that this change made the case more reliable, and the difference
      is NOT attributed.** Two reds in ten and none in ten is not a significant difference at this
      sample size; the two series were run **separately and sequentially rather than interleaved**, so
      **system load — the very thing a timing race is decided by — was not recorded for either and was
      not held equal**; and the mechanism is a first-case race whose chain (`loadMailboxes` → the
      `boot.done` effect → `findActiveTab` → `sendToTab`) has **no arm in it a removal region could
      reach**. **The change adds nine cases after line 2185 and removes nothing from the mount path.**
      So the honest reading is two-sided and deliberately narrow: **this change did not make it worse,
      and this change did not make it better.** *"My change fixed a pre-existing flake" would be the
      same class of inference this repository refuses everywhere else — two measurements taken at
      different times under unknown load do not establish causation.

      **The earlier pair of figures this amendment replaces was not comparable and was wrong.** They
      read *"2 of 5 on this tree, 1 of 8 at the baseline"*, which would have put the fault here. **Five
      runs of an event this rare cannot carry that, and the two denominators differed**, so the
      comparison was between two sampling errors. **The corrected figures are the ten-over-ten above.**
      **A rate quoted from a denominator set by when I happened to notice the failure is the recorded
      *"a count nobody re-ran is a count nobody checked" defect**, and the correction is written into
      the change rather than left in a session summary.

      **A second red, three times over, and every one of them was this machine's fault rather than
      the tree's — so the three runs are discarded rather than reconciled.**

      A later block of three came back `exit=1`, `exit=1`, `exit=1`. **Read as a result it would say
      this change does not verify**, and it says something else entirely. Runs 1 and 2 were red on the
      same pre-existing case above. **Run 3 was red for a reason that cannot be this change at all:**
      twelve failures in `tests/architecture/boundaries.test.ts`, among them
      `ENOENT: no such file or directory, open 'apps\web\src\__spike-probe.ts'` and
      `AssertionError: a globalThis.fetch reference in packages/mailbox should be caught: expected []
      to not deeply equal []`.

      **`__spike-probe.ts` is a control this repository's own boundary suite plants and deletes**, so
      that `ENOENT` is two runners disagreeing about a file that is supposed to exist only for the
      duration of one assertion. **Investigation found the second runner: a process parented to the
      agent harness, not to this change's scripts, was issuing its own `pnpm lint` / `vitest` commands
      against the same working tree at the same time.** Its own output — `=== lint ===` and a spawned
      `eslint .` — was captured while the block below was mid-flight.

      **So those three reds measure the machine, not the code — and the correction below narrows that
      claim to the run it belongs to rather than leaving it covering all three.**

      **The repair is to the instrument, not to the code, and it makes the next block self-evidencing.**
      `verify` is re-run by a block that **asserts it is alone in the tree before each run** —
      matching any `node`/`pnpm`/`cmd` process whose command line names `spectre-mail`, `eslint`,
      `vitest` or `prettier` — and **prints that verdict beside each exit code**. **A run that shares
      the tree is labelled `CONTAMINATED` rather than counted**, because a green produced alongside a
      second runner is as untrustworthy as the red one: the same two runs that ENOENT a planted probe
      could equally pass one by accident.

      **This is `in-page-fill`'s recorded "a measurement taken while the tree is moving is not a
      measurement", reached through a different door** — the tree was not being *edited*, it was being
      *read by two runners*, which is the same class of error and would have been just as wrong to
      report. **The three discarded runs are not reconciled and not averaged into anything.**

      **An earlier draft of this paragraph claimed the three shared one cause. That is falsified, and
      the correction is in the change rather than left in a session summary.** It read *"CPU
      contention is exactly what decides whether a 1000 ms `findByRole` budget holds"*, applied to
      both the `Panel.test.tsx` reds and the boundary reds. **A later block, whose runs *assert they
      are alone in the tree*, produced the `Panel.test.tsx` red on a run that carried no competing
      process at all** — `exit=1 [ALONE]`, one failure, `Tests 1 failed | 1227 passed (1228)`, and
      `Unable to find role="heading" and name "guerrilla"`.

      **So contention explains the boundary `ENOENT` and does not explain the panel red.** One
      paragraph covering three reds with one mechanism was the recorded *"a count that reads as
      coverage"*, in its newest form: **two unrelated defects were being told one story because a
      single sentence covered both.** The boundary reds are this machine's; the panel red is not,
      and the panel case's own record says so.

      **And this change's diff provably does not touch the chain that case waits on — measured, not
      argued.** `git diff HEAD -- apps/extension/src/Panel.tsx` yields seven hunks, at `@@49`,
      `@@108`, `@@241`, `@@316`, `@@599`, `@@860` and `@@938`, and **not one of them covers the boot
      effect, `setReading`, `resolveThePage`, or the `if (!boot.done)` render gate at line 713.** The
      only added `boot.done` in the whole diff is inside the new `removal` view function, which is a
      derived value and gates nothing. **The gate and its effect are baseline code**: `git show
      7e7fd81:apps/extension/src/Panel.tsx` already carries `const [boot, setBoot]`, the
      `loadMailboxes()` boot effect, and `if (!boot.done) {`. **A structural argument the diff can
      settle is worth more than a rate ten runs either way can attribute**, and this one settles
      cleanly.

      **Amendment, recorded at apply (2026-10-13): this change's own guard was falsified by the run
      that carried it, and the guard is repaired rather than the observation dropped.**

      The block above samples for other runners **once, before `pnpm verify` starts**, and labels the
      run `[ALONE]` on that reading. A later run printed **`verify 1 (uncontended): exit=1`** and was
      then found to carry two boundary failures of the same family:
      `ENOENT … 'apps\web\src\__owned-probe.ts'` and `ENOENT … 'apps\web\__uncovered.spec.ts'`.
      **Those are planted controls, and they were read after they had been deleted — which is the
      shared-tree race, on a run the guard had already certified as clean.**

      **So a single sample before a five-minute run is a point-in-time reading and not a
      precondition.** This is the recorded *"a check that is only ever cleared can be deleted and
      nothing fails"* in its mirror form: a precondition **too rarely taken** is as wrong as one too
      weakly asserted, and here it failed in the more dangerous direction, because it **certified a
      contended run as uncontended** rather than discarding one.

      **The repair is to sample continuously and to let the evidence override the label.** The guard
      is now a concurrent sampler polling every three seconds for the whole run, and a run is
      reported **`CONTENDED` if the other runner is seen at any point inside its window** — so the
      verdict is the union of every sample rather than the best one. The block also **names the
      `ENOENT` target of any boundary failure in its own line**, so a planted control that went
      missing reads as what it is instead of as two unrelated test names.

      **Three different planted controls are now recorded going missing across the incidents** —
      `__spike-probe.ts`, `__owned-probe.ts`, `__uncovered.spec.ts` — **and that is what makes the
      shared-tree reading a finding rather than one bad filename.** A defect with three unrelated
      names is three runs of one cause; **the same `ENOENT` text three times would have been one
      defect to go and fix.**

      **And the repair immediately paid for itself in the direction nobody wants, which is why it is
      recorded rather than left as a working detail.** Its first run printed
      **`verify 1 [CONTENDED (13 samples)] exit=0`** — **thirteen sampled moments inside a 42-second
      run at which another runner was live in this tree, and the run was green anyway.**

      **So contamination produces *both* colours, and neither of them is evidence.** The reds are
      `ENOENT` on a planted control and a budget-missed `findByRole`; the green is a full
      1228/1228 obtained while thirteen samples say the tree was shared. **A green from a shared tree
      is no more trustworthy than a red from one, and the recorded reason is the same two lines
      above**: the same two runs that ENOENT a planted control could equally **pass one by accident**,
      by one deleting the probe the other was about to read and the other never needing it.

      **That symmetry is the finding.** Every red in this change's `verify` history has been
      attributed away to the machine on the strength of contention being *possible* — and this is the
      run that shows contention is not merely possible but **routinely present and routinely benign**.
      **A defence that explains every failure and predicts no success is not a defence**, and had
      this run been the last one collected, the temptation to read five reds as five findings would
      have been very hard to resist. **Only an uncontended run settles it, which is why the block
      now waits rather than accepting the green.**

      **The case itself is reported and not repaired, and that is a decision rather than an omission.**
      The case belongs to `side-panel-surface`'s M11 slice 1, the requirement is not this change's, and
      the repair — an explicit `waitFor` on the host sentence before the role query, or a case that
      waits on the panel having decided something — belongs with the case that has the wrong budget.
      **Editing it from inside a change whose own falsification record is already long would also mean a
      green `pnpm verify` run that this change produced by moving a threshold**, which is the one repair
      this repository's own history most often retracts. **What is owed and is stated rather than
      assumed: the case's `1000 ms` is unguarded, and the guard is a wait, not a larger number** —
      `motion-and-reduced-motion`'s recorded *"a wait and a poll of the same length race each other"*
      is the reason the number is not simply raised.

- [x] 8.2 **`pnpm test:browser` runs ten consecutive times in one block, and the tally is reported
      with the denominator: `passed=N failed=0 harness-error=0` out of **10**, at `website=40` and
      `extension=97` on every run that produced a measurement.** A run printing **no tier summary is
      reported as `HARNESS-ERROR` rather than as `passed`** and the block exits non-zero on that count —
      `pnpm test:browser` is `build && build:fixture && web tier && extension tier`, so a run with no
      tier summary never reached Playwright and counting it would be counting a run that did not run.

      **Amendment, recorded at apply (2026-10-13): this block shipped with the verify-only browser
      directive still set in it, and all ten runs were `HARNESS-ERROR` for that reason alone.**

      `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory is how 8.1's claim is *earned* — it is
      how `pnpm verify` is proved to run with **no browser installed**. **It is the wrong value for
      the browser tier, which needs the binary**, and it was carried over from the verify block
      because both scripts set the same variable on line 5 and nobody compared the two. Every run
      then failed identically at `browserType.launch`:

      ```
      Error: browserType.launch: Executable doesn't exist at
      …\empty-browsers\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe
      ```

      **So the ten `HARNESS-ERROR`s measure nothing about the product** — not contention, not the
      tree, not the tier. Reported as `harness-error=10 out of 10` rather than as ten passes, because
      **the parser was built to refuse a run that never reached Playwright and this is the case it
      exists for.**

      **And that is the part worth keeping: the instrument's value was demonstrated by the defect it
      caught.** The reconciling parser saw `Running-lines=1` where two tiers must appear, and said so
      instead of reading the `3 passed` line that *was* there — **a parser that had accepted "found a
      passed line" would have reported 3/40 as a partial run and a green.** **The check is only
      meaningful if it can fail**, and this is the first time this block's has.

      **The repair is one line and a comment stating why the variable is absent rather than merely
      unset**, because the correct value for this block is "whatever Playwright defaults to" and the
      wrong value is one that looks deliberate. **Two scripts setting the same variable for opposite
      purposes is the whole defect**, and the comment is the only thing that stops the next one.

      **Amendment, recorded at apply (2026-10-13): the same block then discarded five runs that had
      genuinely passed — the mirror of that defect, and the more dangerous direction.**

      After the browser path was repaired, five runs came back `exit=1` with
      `Running-lines=2 passed-lines=2 failed-lines=1` — and the verdict was `HARNESS-ERROR`,
      *"did not reconcile"*. **They had passed.** The reconciler required one `failed` line per tier,
      and **Playwright omits `failed` entirely when nothing failed** — so a missing counter was read
      as an unreconcilable run rather than as zero. **Five real measurements were thrown away.**

      **This is the same bug the Node harness had already been repaired for in the opposite
      direction** — there Playwright omits `passed` when nothing passes — **and it was reintroduced by
      porting the logic to PowerShell rather than porting the repair.** A missing counter is zero in
      both directions; the gate now pads every counter array to the tier count before summing, and
      only the presence of the `Running N tests` lines is a hard requirement.

      **It is recorded as the more dangerous of the two because of how each one looks.** The earlier
      defect reported eighteen outcomes it had not measured — a loud number. **This one produced a
      clean `harness-error=10 out of 10` report over runs that had passed**, which reads as rigour
      and is a false negative. **Discarding evidence is harder to notice than inventing it**, and a
      harness biased toward `HARNESS-ERROR` is one whose tally can never over-claim.

      **The parser is now validated offline against four inputs before any block is spent on it** —
      a real clean run and a synthetic all-pass **accepted**, a synthetic `3 failed / 37 passed`
      **accepted and flagged**, and **two negative controls — one tier started instead of two, and
      counters that do not sum — both rejected.** **A parser that has only ever agreed with a green
      run has not been shown that it can fail**, which is the same lesson the first reconciliation
      earned the hard way.

      **And the one red run that was a red rather than a discarded pass is attributed failure by
      failure, because "contention" is not an attribution.** Run 5's five failures split into **two
      mechanisms with their own error text**: three cases failing on `The in-page fixture is not
      built: …fixtures\in-page\dist\fixture.js does not exist`, and two on
      `IO error: MANIFEST-000001: Unable to create sequential file (ChromeMethodBFE: 7::NewSequentialFile::4)`.
      **The first is the other runner's `build:fixture` deleting `dist/` mid-run** — which this
      repository already records as its own behaviour, that `pnpm test:browser` *removes `dist/`
      before building*. **The second is Chromium failing to create its IndexedDB manifest under
      contention.**

      **One of the five is one of this change's own new cases**, so the claim is not *"the failures
      were all elsewhere"* — it is that **the error is a platform IO failure at file creation, not an
      assertion about what the panel rendered.** That distinction is narrower than it looks and is
      stated rather than leaned on.

      **Amendment, recorded at apply (2026-10-13): 8.2 is left UNTICKED, and the reason is two
      intermittent failures in this change's own browser cases that no attribution explains.**

      The tally across every block attempted is **11 passed, 0 failed, 2 harness-error, 9 aborted** —
      at `website=40` and `extension=97` on every run that produced a measurement. **That is not ten
      consecutive green runs, and the box stays empty.** Two runs went red on assertions inside cases
      this change authored, and **neither has an explanation I can stand behind**:

      **B1 — `offers a way to remove what this device holds, and the control that removes is not on
      the page` — once in ~18 runs.** `panel-removal-confirm` resolved to **1 element for all 14 polls
      of a 5 s timeout**, i.e. the panel rendered its *confirmed* shape with no press. `confirming`
      begins `useState(false)` at `Panel.tsx:335` and only `setConfirming(true)` moves it, so **a
      click happened that this case did not make.**

      **The obvious explanations were checked and each is false, which is why the cause is recorded as
      unknown rather than guessed.** The case's own two assertions are **not** both satisfiable at
      once — `removalOffers` and `removalConfirm` share no substring, so `getByRole` cannot match the
      confirm button under the offer name, and both assertions are sound individually. `stage()` opens
      a **fresh** panel page per case and `afterEach` closes it, so no prior case's page is reused.
      **So the panel changed shape between two adjacent assertions with no click of its own, and I
      cannot say why.** Inventing a mechanism here would be the one thing worse than an unexplained
      red: it would read as a diagnosis and stop the next reader looking.

      **B5 — `keeps the mailbox on screen and its inbox usable after the removal` — observed failing
      outside this change's own runs.** `expect(listingsMade(...)).toBeGreaterThan(1)` received `1`
      within the full 35 s ceiling, i.e. **no listing nobody asked for arrived at all.** This is the
      same assertion V07 falsified before it was repaired, and the repair (wait for a listing
      *nobody asked for*, read after the row is on screen) **held in all 11 of this change's passing
      runs** — so this is not a reverted repair but a **second, independent way the same wait can come
      up short.** It was observed in a run that was **not** mine: `apps/extension/test-results/` had
      been reset by another process between my last run and the inspection, and the surviving
      `error-context.md` names B5 rather than B1.

      **Two cases in this change's own tier, failing intermittently for reasons this record does not
      establish, is the finding — and it is why the browser tier is not claimed green over ten
      consecutive runs.** Both are **timing-shaped**: one waits for a state transition that should not
      have happened, the other waits for a poll that did not arrive. **A withheld claim is the correct
      response to a red I cannot explain, and relaxing either case's threshold to make the box tick
      would convert a finding into a green.

      **Amendment, recorded at apply (2026-10-13, later the same day): the block this amendment says was
      missing now exists, so 8.2 is ticked — and the B1/B5 finding above is neither withdrawn nor
      explained, because a ten-run block does not do either.**

      The tally the amendment above laments was **11 passed, 0 failed, 2 harness-error, 9 aborted**,
      which is **not ten consecutive**. Two blocks were then run on a tree whose source files were
      fingerprinted before and after, and the second is the one 8.2 asks for:

      | block | passed | failed | not-counted | source files changed during the block | `website` / `extension` |
      | --- | --- | --- | --- | --- | --- |
      | **1** | **9** | **0** | **1** (`PARTIAL-TIER`) | **0** | 40 / 97 on all 9 measured runs |
      | **2** | **10** | **0** | **0** | **0** | 40 / 97 on **every** run |

      **Twenty attempts, nineteen measured green, one that measured only one tier.** Both blocks'
      logs are retained separately, because the first block's run 4 is evidence and discarding it
      would be the recorded *"its output had to be thrown away rather than reconciled"*.

      **What run 4 of block 1 was, and it is a machine condition on a case this change does not
      touch.** The **website** tier ran its 40 cases, 39 passed, and
      `verification-actions.spec.ts` *"the anchor draws a focus indicator this product declared, and
      only while focused"* failed on **`page.goto: net::ERR_NO_BUFFER_SPACE` at `127.0.0.1:4173`** —
      a socket-buffer condition, not an assertion about what a page rendered. Because that tier went
      red, `pnpm test:browser` short-circuited and **the extension tier never started**: one `Running`
      line instead of two. **So the run is honestly `PARTIAL-TIER` rather than `harness-error`** — it
      measured a tier and lost the other, which is not the same as having measured nothing, and the
      first instrument's vocabulary could not say so.

      **The instrument change is recorded because changing an instrument after it has produced a
      result is the thing this repository does not do quietly.** The first block was scored in the
      older two-word vocabulary; the second adds `PARTIAL-TIER` for a run printing **exactly one**
      tier summary. **The tally's behaviour is unchanged in the property that matters** — such a run
      is still counted in `harness-error`, still never `passed`, and still exits the block non-zero —
      so the refinement cannot turn a red into a green, which is the only direction an instrument
      change is allowed to move.

      **The throttle this machine saw is also not attributed.** `TIME_WAIT` **107**, `Established`
      **104**, no competing `test:browser`/`playwright`/`vitest` process on the host — **so the counts
      are modest and no concurrent runner explains it**, and the error text names an OS resource
      condition rather than a product signal. **A single occurrence at ~1 in 20 across 20 attempts is
      consistent with a transient**, and saying so is not the same as saying the next block will
      clear it: **the block that cleared it is reported as the block that cleared it, and no rate is
      quoted from a denominator set by when a failure was noticed.**

      **And the B1/B5 finding above is untouched by any of this, which is the whole reason the tick is
      worded narrowly.** Tick 8.2 asserts **one thing**: *that a block of ten consecutive runs was
      executed on a frozen tree at `website=40` and `extension=97`, and that its tally is this.* It
      asserts **nothing** about the tier being reliably green. **B1 — `panel-removal-confirm` present
      with no press of its own — has been seen once in ~18 runs, and B5's unarrived listing has been
      seen once outside this change's runs; ten consecutive greens do not disprove a 1-in-18 event
      (roughly even odds at this sample), so both remain open, unexplained, and worth watching.**
      **Nothing in this amendment relaxes a threshold, and a case that had to be softened to make the
      box tick would be the finding destroyed** — which is why the tick rests on a block that happened
      rather than on an assertion that was weakened.

      **And 8.3's rule was never exercised, so it stays empty rather than ticked.** Its condition is
      *"if the block is stopped because a source file changed"* — **the fingerprint reported `0` in
      both blocks**, so the rule did not fire and a tick would credit a safeguard that was never
      triggered.**

- [ ] 8.3 **If the block is stopped because a source file changed, the block is stopped and not
      resumed.** `in-page-fill` recorded two discarded blocks for exactly this: a discarded series kept
      running against a tree being edited underneath it, and its output had to be thrown away rather
      than reconciled. **A measurement taken while the tree is moving is not a measurement.**

- [x] 8.4 **The predicted deltas, to be re-measured from `--reporter=json` grouped by project and not
      read off a summary line:**

      | tier | from | to | how |
      | --- | --- | --- | --- |
      | `apps/extension` unit | **451** | **465** | 4.1's nine + 4.2's five = **+14**; `Panel.test.tsx` 44 → 53 and `panel-copy.test.ts` 12 → 17, and every other extension file unmoved |
      | extension browser tier | **89** | **97** | 5.1's eight cases, all in `side-panel.spec.ts` (20 → 28); the other nine spec files unmoved |
      | `apps/web` | **125** | **125** | no file under `apps/web` is touched |
      | `packages/ui` | **38** | **38** | **a movement is this change's failure** (D5) |
      | `packages/storage` | **86** | **86** | no file under `packages/storage` is touched, and `git diff --stat` over that package must be empty |
      | `packages/mailbox` | **166** | **166** | the removal reads no session member |
      | boundary assertions | **53** | **53** | 7.1 |
      | `manifest.json` | — | **byte-identical** | SHA-256 as in the table at the top |

- [x] 8.5 **The promoted counts, predicted and to be re-measured at sync rather than carried forward:
      167 → 168 requirements and 534 → 544 scenarios** across the same 14 capabilities. The
      requirement arithmetic is `+1`; **the block count is three**, because two `MODIFIED` blocks each
      *replace* rather than add - the usual shape here, and stated so a reader expecting three new
      requirements is wrong about the total. The scenario arithmetic is `+9` in `extension-client`,
      `+1` in the first `spectre-storage` block, and `+0` in the second. **Counted by heading
      (`### Requirement:` / `#### Scenario:`) across `openspec/specs/` after the promotion, never
      transcribed** - and re-counted after the archive, because archiving is a move and a move is the
      operation most likely to quietly drop a file.

      **Measured at sync (2026-10-13), by heading across the tree after the promotion:
      167 → 168 requirements and 534 → 544 scenarios, across the same 14 capabilities. Both
      predictions hold exactly** — `+1` requirement against three promoted blocks, and `+10` scenarios.
      `extension-client` went **13 → 14** requirements and its scenarios by **`+9`**; `spectre-storage`
      held at **16** requirements — **which is the arithmetic working rather than a discrepancy**, since
      both of its blocks replaced — and moved its scenarios by `+1`. **The second `spectre-storage`
      block's `+0` was also measured, not assumed**: its promoted copy went from 6 scenarios to 6.

      **All three promoted blocks were verified byte-identical to their deltas by an independently
      written reader, and the rehearsal that found two defects happened on a throwaway copy of
      `openspec/` before the real tree was touched** — which is the reason it is in this repository's
      workflow at all, and both defects were in the instruments:

      - **The promoter compared a character offset against a line index** while deciding which section
        a block sat under, so every block read as `UNKNOWN` — **and it refused to place a block it
        could not classify, rather than guessing.** That refusal is the property worth keeping: an
        instrument that stops is recoverable, and one that guessed would have put a `MODIFIED` block
        somewhere plausible and wrong.
      - **The verifier searched for its heading *with* the leading newline**, so the promoted-side
        offset pointed at that newline and the forward boundary scan found **its own heading** and
        sliced an empty block — reporting **three blocks differing, all with a 0-character promoted
        side.** It **exited non-zero and said `VERIFIER FAILED`**, which is why the defect was a typo
        and not a false green. **A shared reader would very likely have produced a pass here**, and
        that is the whole argument for the independence being structural rather than a promise.

      **A third defect was mine and was in the check I ran *before* either instrument existed**: a
      one-liner testing whether the `ADDED` requirement already existed in the promoted spec reported
      **`present=True`**, on a heading the spec does not contain. **The literal search and the
      requirement list both say it is absent** — 13 requirements before, none of them this one — so
      `ADDED` was correct and a real promotion was not skipped. **The check was wrong, not the
      change**, and had it been trusted it would have produced a sync that silently dropped the one
      requirement this change exists to add. **A reader that reports something for the wrong reason is
      worse than no reader at all, and this one did not even have a failure mode to inspect.**

## 9. What this change deliberately does not do

- [x] 9.1 **The armed background alarm survives a removal, and this change does not clear it.**
      `design.md` D7 states what it costs (a wake, not a provider request — an emptied area answers
      `no-mailbox` before anything is requested), what it retains (**a name and a period, not an
      address, so it is not a privacy exposure and must not be counted as one**), and what is
      unmeasured. **The panel therefore reaches no alarm platform**, and `extension-client`'s alarm
      requirement is **not** amended to permit it. **This is a finding for the M12 review**, recorded
      so it is not discovered by a person after pressing the button.

- [x] 9.2 **The `sidePanel` permission finding is not settled here** (`design.md` D8). No shipped module
      names `sidePanel`, the manifest declares both it and `side_panel.default_path`, and
      `docs/PROVIDERS.md` §4.6 measured the permission on a control differing in **both** — so
      separating them needs an instrument this repository does not have. **The manifest is unchanged
      and `manifest.spec.ts:246` is unchanged**, so the requirement's *"it SHALL request no permission
      that no shipped surface uses"* currently has an entry traceable to no shipped code. **Recorded,
      not resolved, and not a slice.**

- [x] 9.3 **The "what SpectreMail does not collect" privacy document is a separate slice** — M12 item
      three, a document rather than a control. Writing it before the extension can act on its own data
      would publish a claim about a gap this change is closing.

- [x] 9.4 **Nothing about a rendered pixel is measured, and nothing about reaching the panel is.**
      `Panel.test.tsx` reads a DOM and the browser cases read a served area through the platform's own
      API. **No test in this repository reads a rendered pixel's colour or position**, and the region
      is deliberately styled by rules that already existed (`design.md` D5) — so whether it *looks*
      right is a human judgement no gate stands in for. **With `openPanelOnActionClick` unset the panel
      is reachable only through Chromium's own side-panel entry point**, `docs/PROVIDERS.md` §4.6
      records that Playwright adds **no `Page` for a docked panel at all**, and the cases open the
      panel document **as a tab** — **a substitute, and one that cannot answer "which page am I
      beside."** Both are recorded there and unchanged by this change.

## 10. The archive stage

Recorded after the move rather than before it, which is the honest order for one of these sections:
the archive has to have run for anything below to be a statement about an archive.

- [x] 10.1 **The archive ran, and it moved rather than rewrote.** `openspec archive
      extension-clear-data --skip-specs --yes` reported success and moved the change to
      `openspec/changes/archive/2026-10-13-extension-clear-data/`. **A command reporting success is
      not the claim worth making about a move** — the operation most likely to quietly drop or
      rewrite a file is the one that only relocates paths, so every file was compared by SHA-256
      between its `HEAD` path (`openspec/changes/extension-clear-data/…`, i.e. the bytes as
      committed by the sync stage) and its archived path:

      | file | bytes | pre-archive SHA-256 | post-archive SHA-256 | verdict |
      | --- | --- | --- | --- | --- |
      | `design.md` | 22182 | `f9fdd7110a226f2d…` | `f9fdd7110a226f2d…` | identical |
      | `proposal.md` | 15012 | `1382a83b0f75549b…` | `1382a83b0f75549b…` | identical |
      | `specs/extension-client/spec.md` | 6611 | `aac3dd06c0956c87…` | `aac3dd06c0956c87…` | identical |
      | `specs/spectre-storage/spec.md` | 11477 | `56ad7141a74b52eb…` | `56ad7141a74b52eb…` | identical |
      | `tasks.md` | 88137 | `4cbb6993c31e90df…` | `4cbb6993c31e90df…` | identical |

      **5 tracked, 5 identical, 0 differ, 0 dropped, 0 added.** No file exists at the destination
      that did not exist at the source, so the move added nothing. See **10.7** for the one
      qualification on this table.

- [x] 10.2 **`--skip-specs` was required, and its effect was measured rather than assumed.** The
      sync stage (PR **#132**) already promoted the delta, so running the archive without the flag
      would apply the same requirements twice. **`git diff HEAD -- openspec/specs` afterwards is
      empty** — not "small", not "only the three blocks", **empty**: a promoted spec touched by the
      archive would have shown there, and `--skip-specs` leaving the directory alone is the claim
      being made.

- [x] 10.3 **All three promoted blocks are byte-identical to their ARCHIVED deltas, re-read after
      the move.** Re-verified with the sync stage's independently written verifier — which shares
      no reader and no code with the promoter, so a defect in one cannot be inherited by the other
      — against `openspec/changes/archive/2026-10-13-extension-clear-data/specs/…`:

      | capability | kind | block | lines | verdict |
      | --- | --- | --- | --- | --- |
      | `extension-client` | `ADDED` | *"The side panel offers to remove what this device…"* | 110 | byte-identical |
      | `spectre-storage` | `MODIFIED` | *"Removal is observed in a browser, not only again…"* | 76 | byte-identical |
      | `spectre-storage` | `MODIFIED` | *"The message ids this device has been told about…"* | 98 | byte-identical |

      **Blocks compared: 3. Byte-identical: 3.** Compared as whole blocks and not by title, because
      a hand-typed paraphrase keeps the heading and loses the text — and **re-run against the
      archived copies rather than trusted**, because archiving is a move and a move is the operation
      most likely to leave a reader reading the file it started from.

- [x] 10.4 **The counts were re-counted after the move rather than carried into it.** Counting
      `### Requirement:` and `#### Scenario:` by heading across `openspec/specs/` in the working tree
      after the archive: **168 requirements, 544 scenarios, 14 capabilities** — unmoved by the
      archive, which is what a move should show. `openspec validate --specs --strict` is
      **14 passed, 0 failed** and `openspec list` reports **No active changes**.

      **The baseline for that comparison is 167 and 534, not the 166 and 527 this repository's own
      ledger carried**, and the difference is this stage's finding rather than an arithmetic
      correction: `panel-verification-state`'s sync (PR **#126**, merged `b569ff6`) promoted one
      `ADDED` requirement carrying seven scenarios in `extension-client`, moving the tree to
      167/534. **That change recorded the figure correctly in its own narrative; what was stale was
      the standing headline at the top of the Project Status block, which no change has to touch in
      order to record itself and which is the one a reader copies.** This stage's first draft of the
      archive entry inherited the stale headline and published **+2 requirements and +17 scenarios**
      where the tree says **+1 and +10** — and every individual sentence in it was about *this*
      change and was true. **A stale headline is worse than no headline, because it is the one
      number a reader does not think to re-derive.** The headline is now corrected, and it carries
      its own baseline so the next reader can check it rather than trust it.

- [x] 10.5 **`.openspec.yaml` is absent from this change, and the archive did not drop it.** Every
      peer carries one — `2026-10-13-panel-verification-state`, `2026-10-12-panel-mailbox-choice`
      and `2026-10-12-side-panel-surface` all hold `schema: spec-driven` plus a `created:` date, and
      this change holds none. **The cause is *not* the archive**, and this stage checked rather than
      assumed it: `git ls-tree -r HEAD -- openspec/changes/extension-clear-data` lists **five**
      files and `.openspec.yaml` is not among them, so it was already absent from the change as the
      sync stage committed it. **It was lost at proposal, not at archive** — which is a different
      defect from the one `side-panel-runtime-facts`'s archive is recorded for having dropped, and
      conflating the two would blame a stage that did nothing. **It is recorded, not hand-repaired,
      because the canonical generator owns that file**: writing one by hand would make an archived
      change differ from its siblings in a way no instrument here can then explain.

- [x] 10.6 **The byte-identity instrument was wrong before it was right, and the failure mode is the
      one this repository keeps recording.** The first version compared **text**, taking the
      pre-archive side through `git cat-file | Out-String` and the post-archive side through
      `File.ReadAllText`, and reported **5 of 5 `DIFFERS`** on a move that changed nothing:
      `Out-String` re-wraps line endings and appends a newline, so the two sides were hashed under
      **different conventions** and every file looked changed. **A byte-identity check that hashes
      two different conventions is an assertion narrower than its rule — except that this one
      pointed at the archive rather than at itself**, and the direction that matters is the one that
      cries wolf: a reader who believed it would have reported a clean move as five corrupted files
      and gone looking for a bug in `openspec`. The repair is **raw bytes on both sides**, with
      git's output redirected through `cmd` so nothing decodes and re-encodes on the way out.
      **It then reported 5 identical, and the only thing that changed was the instrument.**

- [x] 10.7 **One qualification on 10.1, stated rather than left for a reader to find.** The digests
      in 10.1 were taken **before** this section was appended, and this section is appended to
      `tasks.md`. **The `tasks.md` this stage ships is therefore the one file in the move whose
      bytes no longer match the table above**, by design and after measurement. The table's claim is
      about *the move*, and it was measured immediately after the move; a deliberate, recorded edit
      afterwards does not falsify it, but **leaving the table unqualified beside a file that no
      longer matches it would be the exact defect this repository records as "a verification
      performed at one moment, stated as a property of the tree".** The other four files are
      byte-identical to their pre-archive originals in the shipped tree, and this line is the only
      reason a reader can tell which numbers to trust.
