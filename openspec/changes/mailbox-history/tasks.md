# Mailbox history — tasks

## 1. Records

- [ ] 1.1 Record in `design.md`'s apply section, **with measurement rather than assertion**, that
      `MailboxSession.restore()` already takes any mailbox — `session.ts:482` delegating to
      `adopt(stored, inbox.check)` — and that `adopt` already distinguishes `expired` from
      `restoreFailed`. **This is the measurement the plan turns on, and §7.1's prediction fails if
      it is wrong.**
- [ ] 1.2 Record that `App.tsx` renders `LocalData` at `:356` **inside** the `product` section that
      closes at `:358`, with its own comment *"what this browser remembers has nothing to do with what
      the session is doing"* — **the placement precedent and its stated reason.**
- [ ] 1.3 Record `page-composition`'s clause *"no sixth region SHALL be added"* verbatim, and that
      this change does not amend it.
- [ ] 1.4 Record **which of the two migration answers the adapter's capabilities justify**, with the
      measurement behind the choice, and **not** the choice made in the abstract.

## 2. The storage adapter

- [ ] 2.1 An **IndexedDB** adapter for `SpectreMailboxes`, beside the `chrome.storage` one, in
      `packages/storage/src/`.
- [ ] 2.2 It SHALL satisfy the contract's stated guarantees: **newest first**, a **second record of a
      mailbox this device already holds moves it to the front rather than adding a copy**, and a
      **partially built value is never handed out**.
- [ ] 2.3 It SHALL NOT read or write the single-mailbox record, because
      **`spectre-storage`'s amended requirement says the head and that record agree and a client may
      not write them apart** — and one adapter doing both would make the agreement a property of that
      adapter rather than of the layer.
- [ ] 2.4 Add the case that **plants the shipped database's second store** and requires `clearAll` to
      remove it, so the removal requirement's proof stops being a planted fiction and becomes the
      product's own shape.
- [ ] 2.5 Cases for every one of the contract's narrowing rules, **run against the same narrowing
      code the single-mailbox adapter uses** — a value this build cannot narrow is neither surfaced
      nor deleted, and a second adapter is a second place that could differ.

## 3. The website

- [ ] 3.1 The website's storage module reaches the collection, through **the one module** that
      already is "this page's only route to the storage layer" — a second route is a second answer to
      "where does this page keep its mailboxes" and the boundary rule would no longer tell which
      mattered.
- [ ] 3.2 The boot read resolves **one mailbox, not two**, and **a failure to read the collection is
      not reported as "this device holds none"** — `spectre-storage` already makes *"no stored
      mailbox"* and *"could not be read"* different results, and the collection's own contract repeats
      it.
- [ ] 3.3 The surface renders **inside the product region**, beside `LocalData`, and **renders in
      every session state once the boot is done** — including a creation failure and a failed inbox
      check.
- [ ] 3.4 Choosing a mailbox **returns to it** through `restore`, and **does not create one**. The
      creation path and the return path stay two paths.
- [ ] 3.5 A mailbox the provider has reported gone and one whose provider session could not be checked
      are **said differently**, in the page's own words, reusing the vocabulary
      `StoredAddressGone.tsx` and `StoredAddressUnchecked.tsx` already render — **no second
      vocabulary for the same two facts.**
- [ ] 3.6 **No mailbox leaves the list because a newer one was recorded.** This is the limit
      `SpectreMailboxes`' own requirement records as a footnote on the extension, and it is a defect
      here.
- [ ] 3.7 No count of days, no expiry, and no retention number appears anywhere in the surface, and
      **the reason is recorded beside it**: no provider in this repository has had its session
      lifetime measured.

## 4. One write, and the trap it avoids

- [ ] 4.1 Decide **which record the website writes**, and record the decision with its migration
      consequence. `apps/web` is now **the only** module in the workspace that writes `saveMailbox`.
- [ ] 4.2 If the singular write is what stays, add or point at the boundary rule that keeps the two
      records from being written apart by a future edit, and **state whether the collection's
      documented property — *the first entry is the mailbox `loadMailbox` reports as current* — is
      then true**.
- [ ] 4.3 If the collection write is what stays, **the singular write is removed rather than left in
      place**, and the boundary rule that forbids it in the extension **widens to the whole
      workspace** rather than gaining a website carve-out. **A carve-out for the client that owns the
      rule is the shape this repository has already repaired twice.**

## 5. Verification

- [ ] 5.1 `pnpm verify` **three times**, exit 0, `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory
      created and measured **empty immediately before and after**.
- [ ] 5.2 `pnpm test:browser` repeated with a stated denominator; **a run carrying no tier summary is
      `HARNESS-ERROR`, never a pass**; **a red with no name is not a finding** — capture its title or
      record it unattributed, and **do not round it away**.
- [ ] 5.3 `pnpm test` from a `--reporter=json` run **grouped by project**.
- [ ] 5.4 The browser tier gains cases for: **every held mailbox is on the built page**, **choosing one
      returns to it without a create**, **a mailbox the provider will not serve is said differently
      from one that could not be checked**, **a newer mailbox does not remove an older one from the
      page**, and **the offer is still there under a creation failure**.
- [ ] 5.5 A case that **plants an extra mailbox into the page's own storage** and requires the page to
      offer it — **the assertion's own fixture must not be a mailbox the page can only offer because
      the case put it there**, so the negative direction names what must **not** be offered.

## 6. Falsification

- [ ] 6.1 **Pre-mutation** SHA-256 digests of every file mutated; every violation caught **by the
      assertion aimed at it**; `wrongcatch`, `green`, `noop`, `nocompile`, `harness-error` all zero.
- [ ] 6.2 Include a violation that **makes the two records name different mailboxes**, because that is
      the trap `addMailbox`'s own documentation is written against and the only way to know the
      instrument sees it.
- [ ] 6.3 Include a violation that **drops an older mailbox from the page's list**, which is §3.6's
      whole content.
- [ ] 6.4 Include a violation that **offers a mailbox the provider will not serve as though it
      worked**, and one that **reports the two unreachable cases identically**.
- [ ] 6.5 The instrument lives **outside the repository** and is deleted afterwards; `dist/` rebuilt
      from restored source, and a failed rebuild reported rather than exited quietly.

## 7. Predictions, so that they are falsifiable

- [ ] 7.1 **`packages/mailbox` is unmoved, at 166.** `restore` already takes any mailbox, so a rise
      means the session layer needed something and D1's argument was wrong.
- [ ] 7.2 `packages/providers`, `packages/core`, `packages/mail-parser` and `apps/extension` are
      **unmoved**.
- [ ] 7.3 `packages/storage` and `apps/web` **rise**, and `apps/web`'s browser tier rises with them.
- [ ] 7.4 **`PAGE_ORDER` still names five regions** and `sections.spec.ts`'s per-region sweeps still
      find five — `page-composition` is untouched and this is the claim.
- [ ] 7.5 `tests/architecture/boundaries.test.ts` moves by **at most one**, and **its count moving is
      a finding either way**, because §4's direction decides whether a rule is added or removed.
- [ ] 7.6 The extension's browser tier stays at **98**; nothing under `apps/extension/e2e/` changes.

## 8. Deliberately not done, and why

- [ ] 8.1 **No sixth region**, because `page-composition` forbids one and `LocalData` is the
      precedent.
- [ ] 8.2 **No change to `packages/mailbox`** unless §7.1 fails, and if it fails **the prediction is
      corrected in place and the extra stage is named**.
- [ ] 8.3 **No retention number**, no expiry, and no invented provider session lifetime.
- [ ] 8.4 **No visual judgement encoded.** Nothing here reads a rendered pixel, so whether the list
      reads well is a human's call.
- [ ] 8.5 **`AGENTS.md` and `docs/ROADMAP.md` are not written by this stage** — they are the root
      orchestrator's and the sync stage's, and the standing figures this change's gate results will
      move are theirs to correct.
- [ ] 8.6 **`docs/PRIVACY.md` is not rewritten by this stage.** It enumerates what this device keeps,
      and this change adds a record kind — **which makes it a document the apply stage must be told
      about**, and the instruction that the enumeration is checked by
      `privacy-disclosure.test.ts` is the thing that will say so. If that suite goes red on a
      disclosure this change adds, **the disclosure is the change's work and not a stale document.**