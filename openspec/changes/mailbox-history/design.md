# Mailbox history — design

## D1 — The session layer is already correct, and that is the measurement the plan turns on

`packages/mailbox/src/session.ts:482`:

```ts
async restore(stored) {
  return adopt(stored, inbox.check);
},
```

`restore` takes **whatever mailbox it is handed**. It does not ask whether that mailbox is the
newest, the current one, or the only one. `adopt` reconciles it against **the provider that owns
it**, maps `MAILBOX_EXPIRED` to `expired`, maps anything else to `restoreFailed`, and makes the
listing that reconciles the inbox's own first listing so a restored mailbox arrives already analysed.

**The roadmap's phrase is *"where the provider session still permits access"*, and the session layer
already distinguishes exactly the two ways that can fail** — an expired mailbox (`expired`) against one
whose provider cannot be checked at all (`restoreFailed`), and `StoredAddressUnchecked.tsx` already
renders the second in the product's own words.

**So M13's mailbox history needs no change to `packages/mailbox`, and that is a prediction the
apply stage must confirm rather than assume.** The two things that do not exist are the website's
half of the storage and any surface to return to a mailbox.

**This is why the change's plan has a falsifiable prediction in it at all**, and why the prediction
being *wrong* would be informative: if returning to an older mailbox turns out to need something
`adopt` does not do, then the requirement this change writes would be written against a session layer
that has to change, and the task list would have been short a stage.

## D2 — The requirement's own sentence is the thing being retracted, and it was a decision

`SpectreMailboxes`' promoted requirement says:

> *"the current mailbox is left where it is rather than replaced by the collection's head: the
> website's requirement names a single stored address, and **nothing here changes what the website
> does**."*

**That is not an observation about the code. It is a decision about where the product was going**,
written by `site-associations` when the collection existed to make the `hostname -> mailbox id` map
possible, and the website was deliberately left alone.

**The website is no longer to be left alone, so the sentence has to go — and a decision that has
been reversed cannot be left standing beside the reversal.** This is why the block is `MODIFIED` and
not accompanied by an `ADDED` sibling: `openspec/specs/` holding both *"nothing here changes what
the website does"* and a requirement about the website holding several mailboxes would be two
requirements saying opposite things, which is the shape this repository records as where an amendment
gets attributed to the wrong assertion.

**And the `MODIFIED` carries the amendment in its own body, with the date**, so the archived delta
and the promoted spec are the same blocks and the reversal is readable years later without the
commit history.

## D3 — The placement question is real, forbidden in one direction, and already answered in the other

`page-composition` says, in its own words:

> *"No region SHALL be added that has no heading of its own, and **no sixth region SHALL be added**."*

**So "recent mailboxes" cannot be a sixth region.** That is not a preference; the requirement
forbids it, and the reason is the roadmap's own five-section list plus the product's own line that
the product remains the main hero.

**The repository already contains the answer, for the surface immediately beside it.** `App.tsx`
renders:

```tsx
<main>
  <section aria-labelledby="product-heading" data-region="product">
    <Wordmark />
    ...
    <LocalData localData={localData} clearStored={clearStored} />
  </section>          {/* closes at :358 */}
  <Steps />
  <Reasons />
  <ExtensionPreview />
</main>
```

`LocalData` is the page's entire *"what this device keeps and how to make it forget"* surface, and it
is **not** a region. It is a component inside the product region, and its own comment states the
reason this change needs:

> *"It renders in **every session state** once the boot is done, because **what this browser remembers
> has nothing to do with what the session is doing** — a user looking at a creation failure with a
> stored address still needs to remove it."*

**That sentence is about removal. The same sentence is about returning**, and the reason is
structural rather than rhetorical: a person whose address could not be created, or whose inbox could
not be listed, still has other addresses on this device and still needs to reach one.

**So `page-composition` is untouched, and this design decision is recorded as a proposal-stage
finding rather than discovered at apply.** The falsifiable claim: after the change, `PAGE_ORDER`
still names five regions, and the browser tier's per-region sweeps still find five.

## D4 — The migration question is new, because the website is the first client to inherit it

The extension's requirement already records the answer it took:

> *"the single-mailbox contract is the **only** place a mailbox recorded by an earlier build can be
> found, and it is therefore consulted **only** while the collection is empty"*
>
> *"**a mailbox recorded before this build stops being offered once this device records another
> one** — still stored, still readable, but no longer in the list a client offers"*

**That second clause is a footnote on the extension and a defect on a website.** The website's
requirement — *"A reload returns the user to the address they came back for"* — is about a person
recognising an address they already had. **An address that silently leaves the list the moment a
second one is created is a person losing an address they recognised**, and the roadmap's wording for
this item is *"where the provider session still permits access"*, which is about the **provider**, not
about the product's own bookkeeping.

**So this change has to answer the question rather than inherit the answer**, and the two candidate
answers are genuinely different: *merge the singular record into the collection on first read*, or
*keep consulting it and show both*. The first is one write and no second place to look; the second
never loses anything and adds a rule that has to hold for as long as both records exist. **The
requirement this change writes should be whichever the apply stage can justify from what the adapter
can actually do**, and the proposal deliberately does not choose, because choosing here would be
choosing without the measurement.

## D5 — `clearAll` gets its first real proof, and it is worth naming

`spectre-storage` requires that removal *"SHALL NOT be satisfied by removing only the records this
build recognises"*, and its test **plants a store this build does not recognise** to prove it.

**A planted, unrecognised store is a weaker proof than a real second store the build does recognise**,
and after this change the website's IndexedDB database holds exactly that: a store for the single
current mailbox **and** a store for the collection, both created by this build.

**So `clearAll`'s strongest requirement stops being proved by a fiction and starts being proved by
the shipped shape of the product** -- and the test that proves it is the same test. **That is the
change's least visible and most valuable consequence**, and it is a consequence rather than a goal:
nothing about it is designed for, and it arrives because the database gains a second real store.

## D6 — Two records for one mailbox is the trap, and the extension already answered it

The collection's `addMailbox` documentation says why it is one operation:

> *"`chrome.storage` has **no transactions**. An implementation that recorded 'the current mailbox'
> and 'this mailbox is in the collection' as two writes could be interrupted between them, leaving the
> device holding an address its own collection does not know."*

**On the website the risk is not interruption but divergence**: `apps/web` writes the singular record
today, and if it also wrote the collection the two could name different mailboxes after a single
reload. **The extension's answer is a boundary rule** — `extensionSingularWriteViolations` forbids
every module in `apps/extension/src` from naming `saveMailbox` — and the website is now the **only**
remaining writer of that method in the workspace.

**So the question is whether the website stops writing it, and that is a real product decision with
a migration behind it.** The requirement this change writes should say which way, and the direction
that makes the collection's own documented property true — *"the first entry is the mailbox
`loadMailbox` reports as current"* — is the one where **one read answers both questions**. That
property is currently **false on the extension** and was **amended out of `spectre-storage` rather
than fixed**, because the extension's writes moved onto `addMailbox` and the singular record became
write-only-nothing. **M13 is the change that can make the property true everywhere, and the direction
it takes is worth stating in the requirement rather than leaving to whichever adapter is written
first.**

## D7 — What this change predicts, so the predictions are falsifiable

- **`packages/mailbox` is unmoved**, at **166**. D1's whole argument is that `restore` already takes
  any mailbox; a rise would mean the session layer needed something and the proposal was wrong.
- **`packages/providers`, `packages/core`, `packages/mail-parser` and `apps/extension` are unmoved.**
  The extension already holds a collection and already has its adapter.
- **`packages/storage` rises** — a new adapter and its cases.
- **`apps/web` rises**, and its browser tier rises: the new surface is on the built page.
- **`PAGE_ORDER` still names five regions** and `sections.spec.ts`'s per-region sweeps still find five.
- **`tests/architecture/boundaries.test.ts` rises by at most one**, if the website's singular-write
  answer needs a rule; and **its count moving is a finding either way**, because D6's direction
  decides whether a rule is needed or a rule is *removed*.
- **The extension's browser tier stays at 98.** Nothing under `apps/extension/e2e/` changes.

## D8 — What this change cannot establish, stated rather than smoothed over

- **Nothing about a real provider.** "Where the provider session still permits access" is decided by
  the provider's own session lifetime, **which no test in this repository exercises**, and the change
  must therefore present the distinction the session layer already draws rather than predict which
  mailboxes fall on which side of it.
- **No retention policy is invented.** "Recent" is bounded by reachability, and a count of days would
  be a figure this repository has not measured.
- **Nothing about what a list of addresses should look like.** That is a visual judgement, and no
  test in this repository reads a rendered pixel.
- **`packages/storage`'s `fake-indexeddb` is still not a browser**, so the new adapter's IndexedDB
  behaviour is proved against a substrate and, where the existing removal requirement says so, against
  Chromium through the browser tier.
- **The migration answer is not chosen here**, and D4 says why: it is a decision the adapter's
  capabilities should justify, and a proposal that picked it would be picking without measuring.