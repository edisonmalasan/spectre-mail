# Mailbox history

## Why

**M12 is closed in scope, so M13 is next, and exactly one item on either of its release lists has
not shipped.** Measured against the roadmap's own lists:

| M13 release item | state |
| --- | --- |
| standalone temporary mailbox, Guerrilla Mail, OTP detection, verification-link detection, privacy controls, Spectral Swiss UI | shipped, M4–M7 |
| popup, content-script email integration, OTP notifications, copy/fill flow, side panel, local site mapping | shipped, M8–M11 |
| **mailbox history** | **not shipped** |

`docs/ROADMAP.md`'s own definition of it is one line: *"Allow multiple recent mailboxes where the
provider session still permits access."* **The website holds exactly one mailbox today**, and the
collection that would let it hold several **already exists** — `SpectreMailboxes` — with the note
that it has a `chrome.storage` adapter and **no IndexedDB one**, deliberately, because *"a record
with no consumer is a schema to migrate rather than a feature."*

**M13 is the change that gives it a consumer, and the sentence that has to be retracted is the
reason this is a change and not a task.**

## What Changes

- **MODIFIED** `spectre-storage` — *The mailboxes this device can insert are a record kind of their
  own* — because the collection **gains the website's IndexedDB adapter**, and because the
  requirement currently says, in its own words:

  > *"the current mailbox is left where it is rather than replaced by the collection's head: the
  > website's requirement names a single stored address, and **nothing here changes what the website
  > does**."*

  **That sentence is now false, and it was written as a decision rather than as an observation.**
- **ADDED** `website-client` — the page offers **the mailboxes this device holds**, returns a person
  to one, and **never offers a mailbox it can no longer reach as though it could**.

**`page-composition` is deliberately untouched, and that is the load-bearing decision.** Its
requirement says **"no sixth region SHALL be added"**, so a sixth region for recent mailboxes would
forbid itself. The repository already answers this for the surface immediately beside it —
`LocalData` renders at `App.tsx:356` **inside** the `product` section, which closes at `:358` — and
its own comment states the reasoning this change needs: *"what this browser remembers has nothing to
do with what the session is doing."*

**One `ADDED` and one `MODIFIED`, so the promoted requirement count moves by exactly one.**

## The measurement that decides the scope

**`MailboxSession.restore()` already takes whatever mailbox it is handed.** `session.ts:482` is
`async restore(stored) { return adopt(stored, inbox.check); }` — it reconciles that mailbox against
the provider that owns it, maps `MAILBOX_EXPIRED` to `expired` and anything else to `restoreFailed`,
and distinguishes an **expired** mailbox from one whose provider session **cannot be checked**, which
is *precisely* the roadmap's phrase *"where the provider session still permits access."*

**So the session layer needs no change at all.** The website cannot reach the collection, and the
website has no surface for it. **`packages/mailbox` is predicted to be unmoved**, and that is the
measurement this change's plan turns on.

## The limit this change must not reproduce

`SpectreMailboxes`' own requirement records a cost of the extension's design, in these words:

> *"**a mailbox recorded before this build stops being offered once this device records another
> one**"*

**On the extension that is a footnote. On a website whose product is *"come back to the address you
came back for"*, a saved address silently leaving the list is a user-visible loss**, and the
roadmap's wording is about provider access, not about being dropped from a list. So the website's
slice must answer the migration question **for the first time in this repository**, and the
extension's answer — *consult the singular record only while the collection is empty* — is a starting
point rather than a decision this change inherits.

## What ships

| file | role |
| --- | --- |
| `packages/storage/src/` | an IndexedDB adapter for the collection, beside the one `chrome.storage` already has |
| `apps/web/src/` | the boot read, the surface, and the return-to-one path |
| `tests/architecture/` | the boundary between "one write records a mailbox" and "the website may not hold two records for it" |

## What this change deliberately does not do

- **It does not add a sixth region**, because `page-composition` forbids one and the existing
  `LocalData` placement is the precedent.
- **It does not change the session layer**, because it already does what the roadmap asks.
- **It does not invent a retention policy.** "Recent" is bounded by what the provider will still let
  the product reach, which is a fact about the provider and not a number this repository picks.