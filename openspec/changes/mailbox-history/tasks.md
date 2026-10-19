# Mailbox history — tasks

## 1. Records

- [x] 1.1 Record in `design.md`'s apply section, **with measurement rather than assertion**, that
      `MailboxSession.restore()` already takes any mailbox — `session.ts:482` delegating to
      `adopt(stored, inbox.check)` — and that `adopt` already distinguishes `expired` from
      `restoreFailed`. **This is the measurement the plan turns on, and §7.1's prediction fails if
      it is wrong.**
      — `design.md` **D9.1**, with the line numbers `:482`, `:429`, `:436` and `:400`.
- [x] 1.2 Record that `App.tsx` renders `LocalData` at `:356` **inside** the `product` section that
      closes at `:358`, with its own comment *"what this browser remembers has nothing to do with what
      the session is doing"* — **the placement precedent and its stated reason.**
      — `design.md` **D9.5**, and the measurement that the page renders **five** regions with the
      surface added.
- [x] 1.3 Record `page-composition`'s clause *"no sixth region SHALL be added"* verbatim, and that
      this change does not amend it.
      — `design.md` **D3** already holds it verbatim; **D9.5** records that it was confirmed and not
      amended, and `apps/web/src/RecentMailboxes.tsx` quotes it in its own module note.
- [x] 1.4 Record **which of the two migration answers the adapter's capabilities justify**, with the
      measurement behind the choice, and **not** the choice made in the abstract.
      — `design.md` **D9.2**: **one write, one transaction over both stores**, because a transaction
      over two stores rolls both back and the extension's "consult the singular only while the
      collection is empty" is a consequence of `chrome.storage` having no transactions, measured.

## 2. The storage adapter

- [x] 2.1 An **IndexedDB** adapter for `SpectreMailboxes`, beside the `chrome.storage` one, in
      `packages/storage/src/`.
      — `packages/storage/src/indexeddb-mailboxes.ts`, `createIndexedDbMailboxes`.
- [x] 2.2 It SHALL satisfy the contract's stated guarantees: **newest first**, a **second record of a
      mailbox this device already holds moves it to the front rather than adding a copy**, and a
      **partially built value is never handed out**.
      — through the shared `prependStoredMailbox` and `readStoredMailboxRecord`; falsified by
      **M05** (a second record copies rather than moves, and the list stops being newest first),
      **M08** (a hand-written reader hands out a member it cannot narrow) and **M06** (the narrowing
      on the way in is dropped), each caught by the assertion it was aimed at.
- [x] 2.3 It SHALL NOT read or write the single-mailbox record, because
      **`spectre-storage`'s amended requirement says the head and that record agree and a client may
      not write them apart** — and one adapter doing both would make the agreement a property of that
      adapter rather than of the layer.
      — the case *"reads and writes only its own store"*; the collection adapter is given the other
      store's name only so the shipped database's shape does not depend on which operation ran first.
- [x] 2.4 Add the case that **plants the shipped database's second store** and requires `clearAll` to
      remove it, so the removal requirement's proof stops being a planted fiction and becomes the
      product's own shape.
      — two cases, because the planted one still deserves its control:
      `indexeddb.test.ts` *"removes the collection's own store…"* and
      `indexeddb-mailboxes.test.ts` *"removes the collection's own store…"*. Falsified by **M09**,
      which makes the removal delete only the key the single-mailbox adapter holds.
      **It found a fixture-name collision** — see `design.md` **D9.4**.
- [x] 2.5 Cases for every one of the contract's narrowing rules, **run against the same narrowing
      code the single-mailbox adapter uses** — a value this build cannot narrow is neither surfaced
      nor deleted, and a second adapter is a second place that could differ.
      — and **M08 replaced the shared narrowing with a second hand-written one** that hands out a
      member it cannot narrow; it was caught by the case named for it, and by seven siblings.
      **The first version of that arm was a broken mutant** — it read the envelope without the
      optional chain, so it threw on an absent envelope and failed five unrelated cases. **The
      instrument's `wrongcatch` class is how a broken mutant is told apart from a survivor**, and
      the arm was repaired rather than recorded.

## 3. The website

- [x] 3.1 The website's storage module reaches the collection, through **the one module** that
      already is "this page's only route to the storage layer" — a second route is a second answer to
      "where does this page keep its mailboxes" and the boundary rule would no longer tell which
      mattered.
      — `apps/web/src/storage.ts` gains `createWebsiteMailboxes` / `useWebsiteMailboxes`: a second
      **hook**, not a second **module**, and the second value rather than a second field on
      `WebsiteStorage` because `storage-stub.ts` is a shipped module outside this change's write
      scope. Both reasons recorded beside the prop.
- [x] 3.2 The boot read resolves **one mailbox, not two**, and **a failure to read the collection is
      not reported as "this device holds none"** — `spectre-storage` already makes *"no stored
      mailbox"* and *"could not be read"* different results, and the collection's own contract repeats
      it.
      — `createIndexedDbMailboxRecords.loadMailbox` **refuses** rather than answering, and its case is
      the one that plants a singular record holding a real mailbox beside a collection this build
      cannot read. Falsified by **M10**, which reports that unreadable collection as none held.
- [x] 3.3 The surface renders **inside the product region**, beside `LocalData`, and **renders in
      every session state once the boot is done** — including a creation failure and a failed inbox
      check.
      — `App.tsx`, immediately after `LocalData`; the browser tier's *"...is still there when an
      address the user asked for could not be created"*, and the page-level case beside it.
- [x] 3.4 Choosing a mailbox **returns to it** through `restore`, and **does not create one**. The
      creation path and the return path stay two paths.
      — `App.returnToMailbox` calls `session.restore`; the browser case counts
      `f=get_email_address` requests, because **both paths put an address on screen and only the count
      tells them apart**. Falsified by **M11**, which makes the return path call `open`.
- [x] 3.5 A mailbox the provider has reported gone and one whose provider session could not be checked
      are **said differently**, in the page's own words, reusing the vocabulary
      `StoredAddressGone.tsx` and `StoredAddressUnchecked.tsx` already render — **no second
      vocabulary for the same two facts.**
      — `RECENT_ADDRESS_GONE` and `RECENT_ADDRESS_UNCHECKED` are exported constants, and a case
      **renders both components** and requires containment. Falsified by **M04**, which put the
      unchecked sentence where the gone one was. **M04 is only catchable because the texts are
      compared and not only the two markers** — a component rendering the same sentence under both
      `data-testid`s satisfies a structural check perfectly.
- [x] 3.6 **No mailbox leaves the list because a newer one was recorded.** This is the limit
      `SpectreMailboxes`' own requirement records as a footnote on the extension, and it is a defect
      here.
      — the list is the collection's own contents in the collection's own order; falsified by **M02**
      in the unit tier and **B01** in the browser tier, both of which render only the head.
- [x] 3.7 No count of days, no expiry, and no retention number appears anywhere in the surface, and
      **the reason is recorded beside it**: no provider in this repository has had its session
      lifetime measured.
      — the reason is the component's own module note; the property is swept over the whole surface by
      *"states no number about how long an address lasts"* (a count, a duration, and the words a
      retention policy would use).

## 4. One write, and the trap it avoids

- [x] 4.1 Decide **which record the website writes**, and record the decision with its migration
      consequence. `apps/web` is now **the only** module in the workspace that writes `saveMailbox`.
      — **Both, in one transaction**, by `createIndexedDbMailboxRecords`. The two rejected answers are
      recorded with their consequence beside the code; see `design.md` **D9.2**.
- [x] 4.2 If the singular write is what stays, add or point at the boundary rule that keeps the two
      records from being written apart by a future edit, and **state whether the collection's
      documented property — *the first entry is the mailbox `loadMailbox` reports as current* — is then
      true**.
      — **The singular write stays, and no rule was added.** A transaction spanning two object stores
      refuses the disagreement, so a scan for it would be a rule about a property the database already
      enforces. **The property is true**, and the proof is a case that reads both stores back through
      the platform. `boundaries.test.ts` is **unmoved at 53**, and that is the measurement this
      decision turned on. Falsified by **M01**, which makes the singular record name the collection's
      previous head while the collection names the new one, and was caught by the case named for
      exactly that.
- [x] 4.3 If the collection write is what stays, **the singular write is removed rather than left in
      place**, and the boundary rule that forbids it in the extension **widens to the whole
      workspace** rather than gaining a website carve-out.
      — **Not the branch this change took**, and the reason is recorded: writing only the collection
      leaves a singular record naming a mailbox this device has stopped using, so the two disagree on
      disk. **So the widening was not needed — and had it been, it would have been blocked**, because
      `useMailboxSession.ts:451` names `saveMailbox` and is outside this change's write scope. That is
      reported rather than discovered later; see the report's blocker section.

## 5. Verification

- [x] 5.1 `pnpm verify` **three times**, exit 0, `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory
      created and measured **empty immediately before and after**.
      — **0, 0, 0**, with the directory **0 entries** before run 1, **0 entries** between the runs,
      and **0 entries** after run 3.
- [x] 5.2 `pnpm test:browser` repeated with a stated denominator; **a run carrying no tier summary is
      `HARNESS-ERROR`, never a pass**; **a red with no name is not a finding** — capture its title or
      record it unattributed, and **do not round it away**.
      — **10 runs: 10 passed, 0 failed, 0 `HARNESS-ERROR`.** Every run carried both tier summaries —
      the website's **48** and the extension's **98** — and every run exited `0`.
      **The run before this stage's, recorded here because a red with no name is not a finding and a
      red with a name is**: **10 runs: 9 passed, 0 failed, 1 `HARNESS-ERROR`**, the harness red
      **named** as `storage.spec.ts:230 › … a removal leaves nothing behind …`, failing `page.goto`
      with **`net::ERR_NO_BUFFER_SPACE`** — a socket-exhaustion error on the machine, not a product
      assertion — and it did not reproduce in the other nine. Recorded, not rounded away.
- [x] 5.3 `pnpm test` from a `--reporter=json` run **grouped by project**.
      — **1351 across 69 files**, exit `0`: `packages/core` 54, `packages/providers` 92,
      `packages/mail-parser` 149, **`packages/mailbox` 166**, `packages/storage` **103**, `apps/web`
      **140**, `packages/ui` 42, `apps/extension` **487**, `tests/architecture` **118** — of which
      `boundaries.test.ts` is **53**. The one rise over the previous stage's **1350** is this stage's
      own new unit case.
- [x] 5.4 The browser tier gains cases for: **every held mailbox is on the built page**, **choosing one
      returns to it without a create**, **a mailbox the provider will not serve is said differently
      from one that could not be checked**, **a newer mailbox does not remove an older one from the
      page**, and **the offer is still there under a creation failure**.
      — `apps/web/e2e/mailbox-history.spec.ts`, **8 cases**; the website tier is **48** (40 + 8). The
      eighth was added by the falsification pass: *"the address the provider reported gone carries
      no control that claims it works"* — see `design.md` **D9.8**.
- [x] 5.5 A case that **plants an extra mailbox into the page's own storage** and requires the page to
      offer it — **the assertion's own fixture must not be a mailbox the page can only offer because
      the case put it there**, so the negative direction names what must **not** be offered.
      — every case plants through `indexedDB` itself. **Two negatives**: an address this device has
      never held is not offered, and **a mailbox this device stopped holding is no longer offered**
      after a confirmed removal — which is the negative that makes the other six evidence about
      storage rather than about markup.

## 6. Falsification

- [x] 6.1 **Pre-mutation** SHA-256 digests of every file mutated; every violation caught **by the
      assertion aimed at it**; `wrongcatch`, `green`, `noop`, `nocompile`, `harness-error` all zero.
      — **13 of 13 arms caught by the assertion each was aimed at**, with those five all zero. Every
      mutated file restored **byte-identically after every arm** (13 of 13), and the website rebuilt
      from the restored source at the end. **The instrument itself was wrong three times first**,
      each of the recorded shapes, and each is in `design.md` **D9.9**: the mutation reader refused
      a valid mutation (**the self-test caught it**), the self-test read its own flag as a
      positional, and **the browser reader did not descend into Playwright's nested suites and
      reported a mutation the tier had failed in five specs as `green`** — the fifth recorded
      instance of a reader that read zero cases in most of the files it was pointed at. **And one
      arm was a broken mutant**, caught by the instrument's own `wrongcatch` class, and repaired
      rather than recorded. The self-test is **12 of 12**.
- [x] 6.2 Include a violation that **makes the two records name different mailboxes**, because that is
      the trap `addMailbox`'s own documentation is written against and the only way to know the
      instrument sees it.
      — **M01**, caught by *"never lets the two records name different mailboxes"*. The mutation makes
      the singular record name the collection's **previous** head while the collection names the new
      one, so the two disagree about a mailbox rather than one of them merely being absent.
- [x] 6.3 Include a violation that **drops an older mailbox from the page's list**, which is §3.6's
      whole content.
      — **M02** in the unit tier and **B01** in the browser tier, caught by *"keeps an older mailbox
      on the page when a newer one has been recorded"* and by *"every mailbox on the device is on the
      built page, newest first, inside the product region"*. The browser tier is the half that
      matters here: the unit tier asserts about a component and the browser tier asserts about the
      page a person receives.
- [x] 6.4 Include a violation that **offers a mailbox the provider will not serve as though it
      worked**, and one that **reports the two unreachable cases identically**.
      — **M03** and **M04**, each caught by the case named for its claim. **M04 is only catchable
      because the texts are compared and not only the two markers** — a component rendering the same
      sentence under both `data-testid`s satisfies a structural check perfectly. **And a third arm,
      B03, removes the guard that withholds the control on the address the page is on**, so the
      entry for a mailbox the provider reported gone carries a control again; it is caught by the
      new browser case *"the address the provider reported gone carries no control that claims it
      works"*.
      — **One arm was withdrawn, and the reason is a measurement rather than a repair**: `B02`
      mutated the control's **second** label and came out `green` in the browser tier, because that
      label is **unreachable on the built page** — see `design.md` **D9.8**. The same violation is
      caught by the unit tier's `M03`, so it is falsifiable; the arm is withdrawn rather than kept
      as a green row, and the requirement's clause is asserted where it is reachable instead.
- [x] 6.5 The instrument lives **outside** the repository and is deleted afterwards; `dist/` rebuilt
      from restored source, and a failed rebuild reported rather than exited quietly.
      — `C:\Users\Edison\AppData\Local\Temp\opencode\`; every mutated file restored and its digest
      re-verified after **every** arm; the final `pnpm build` is reported rather than assumed — and
      **it is reported by the instrument's own exit code**, because a completed run and an abandoned
      one must not carry the same number.
- [x] 6.6 The instrument's own readers are **self-tested**, and the self-test holds them down.
      — **12 of 12**, and **two of the twelve are there because the instrument had already got them
      wrong**: the mutation reader's round trip (which refused a valid growing replacement) and the
      browser reader's descent into a nested suite (which had reported a mutation the tier had failed
      in five specs as `green`). **A reader that is wrong in the direction of reporting less is the
      dangerous direction**, because it looks like a pass.

## 7. Predictions, so that they are falsifiable

- [x] 7.1 **`packages/mailbox` is unmoved, at 166.** `restore` already takes any mailbox, so a rise
      would mean the session layer needed something and D1's argument was wrong.
      — **CONFIRMED: 166, unmoved.** D1's argument held, and the apply stage added a return path the
      session had never been asked for. **The return path needed no session change at all**, and
      `packages/mailbox` was not edited.
- [x] 7.2 `packages/providers`, `packages/core`, `packages/mail-parser` and `apps/extension` are
      **unmoved**.
      — **CONFIRMED**: 92, 54, 149 and **487**. Every one re-counted from the same JSON run.
- [x] 7.3 `packages/storage` and `apps/web` **rise**, and `apps/web`'s browser tier rises with them.
      — **CONFIRMED**: `packages/storage` 86 → **103**, `apps/web` 125 → **140**, website browser tier
      40 → **48**. The arithmetic accounts for it: 17 = 16 new adapter cases + 1 new case in
      `indexeddb.test.ts`; 15 = the new `RecentMailboxes.test.tsx`; 8 = the new browser file.
      **The browser file is not collected by the unit runner**, so it does not appear in the unit
      count at all — which is the recorded reason the two tiers are counted separately.
- [x] 7.4 **`PAGE_ORDER` still names five regions** and `sections.spec.ts`'s per-region sweeps still
      find five — `page-composition` is untouched and this is the claim.
      — **CONFIRMED**: `sections.spec.ts` unmodified and green, `PAGE_ORDER` unmodified, and the built
      page renders **five** `[data-region]` elements with the surface added — asserted by the browser
      tier, not only by a page-level case.
- [x] 7.5 `tests/architecture/boundaries.test.ts` moves by **at most one**, and **its count moving is a
      finding either way**, because §4's direction decides whether a rule is added or removed.
      — **UNMOVED at 53**, and the count not moving is the finding: §4's direction made a rule
      unnecessary, because a transaction already refuses what a rule would scan for.
- [x] 7.6 The extension's browser tier stays at **98**; nothing under `apps/extension/e2e/` changes.
      — **CONFIRMED: 98** on every one of the ten browser-tier runs, and `apps/extension` unmoved at
      **487**.

## 8. Deliberately not done, and why

- [x] 8.1 **No sixth region**, because `page-composition` forbids one and `LocalData` is the
      precedent.
- [x] 8.2 **No change to `packages/mailbox`** unless §7.1 fails, and if it fails **the prediction is
      corrected in place and the extra stage is named**.
      — §7.1 held, so nothing was corrected here.
- [x] 8.3 **No retention number**, no expiry, and no invented provider session lifetime.
- [x] 8.4 **No visual judgement encoded.** Nothing here reads a rendered pixel, so whether the list
      reads well is a human's call.
- [x] 8.5 **`AGENTS.md` and `docs/ROADMAP.md` are not written by this stage** — they are the root
      orchestrator's and the sync stage's, and the standing figures this change's gate results will
      move are theirs to correct.
- [ ] 8.6 **`docs/PRIVACY.md` is not rewritten by this stage.** It enumerates what this device keeps,
      and this change adds a record kind — **which makes it a document the apply stage must be told
      about**, and the instruction that the enumeration is checked by
      `privacy-disclosure.test.ts` is the thing that will say so. If that suite goes red on a
      disclosure this change adds, **the disclosure is the change's work and not a stale document.**
      — **NOT DONE, AND THIS IS THE BLOCKER. The document is now stale and the stage could not
      repair it.** Section 2 says *"The website keeps **one** kind of record, in IndexedDB"* and
      declares one row, and this change makes the website create **two** object stores.
      **The honest disclosure was written and the instrument rejected it** — `one declared row:
      expected 2 to be 1` at `privacy-disclosure.test.ts:1071` — and **the document was restored
      byte-identically afterwards**, so the measurement left the tree as it found it.
      **Two stalenesses are in the suite, and neither is the one this stage first named**: the
      observer runs `createBrowserStorage()`, an entry point `apps/web` no longer uses; **and its
      `transaction(store)` stub takes a string, while the paired adapter opens one transaction over
      two stores** — so the array is recorded as one element and `observed.stores[0]` is an array
      rather than a store name. **A control refuted the first hypothesis**: firing `onupgradeneeded`
      changes nothing, because the paired adapter *reads* both stores rather than creating them at
      upgrade time. **So the suite and the document have to move together** — two rows in the
      document, two rows required by the case, and a stub that accepts a list of store names — and
      **all three are in a file outside this stage's write scope**. The edit was reverted and the
      document left as it is, which is a choice: a red suite is worse than a stale document the
      root can see. See `design.md` **D9.7** and **D9.10**.
