# Design

## Context

Three measured facts from the M0 spike era and this change's probe shape the approach; the
motivation is in `proposal.md` and the requirements are in `specs/`.

**1. This device holds one mailbox, and that is measurable.** Both adapters write the mailbox under
a single key — `EXTENSION_MAILBOX_KEY = "current"` in `packages/storage/src/chrome.ts` and
`CURRENT_MAILBOX_KEY = "current"` in `packages/storage/src/indexeddb.ts` — and
`apps/extension/src/content-script/create-mailbox.test.ts:336` already asserts `saveMailbox` is
called **twice** across two creations. So there is no place to put a second address today, and the
site map the roadmap specifies would be a map with one entry.

**2. `chrome.storage.onChanged` reaches a content script's isolated world.** Measured in Chromium
with a fixture extension (`C:\Users\Edison\AppData\Local\Temp\opencode\site-associations-probe\probe.mjs`):

| arm | reading |
| --- | --- |
| content script subscribes to `chrome.storage.onChanged` | **fires** on a service-worker write to `chrome.storage.local` |
| page world subscribes to the DOM `storage` event | **does not fire** for the same write |
| positive control | the content script read the value the worker wrote |
| control for the control | the page world's `chrome` is `undefined`, so the previous row's null is not evidence about subscriptions |

The DOM `storage` event and `chrome.storage.onChanged` have the same-sounding name and are different
mechanisms; only the second one works here. **Consequence: this slice needs no `sendMessage` seam
to the service worker at all.** Slice 2 needed one because a content script's `fetch` obeys the
**page's** CORS policy (`docs/PROVIDERS.md` §4.4); this slice only reads and writes the extension's
own storage, which a content script reaches on the `storage` permission alone.

**3. `location.hostname` is already the key this design wants, measured from inside the content
script.** On `https://PROBE.Invalid:8443` the content script reads `probe.invalid` — the port is
excluded and the value is **already lower-cased** — while `location.host` on the same page reads
`probe.invalid:8443`. So neither case-folding nor port-stripping is this layer's work, and no
public suffix list is shipped or needed for it.

**And one arm of that probe was wrong before it was re-run, which is why the limit below is stated
as measured.** The first version of arm 3 reported that a content script does not run in a
same-origin iframe, with `all_frames` unset. That reading was untrustworthy because nothing
established the child frame was inspectable. Re-run with the frame **proved loaded**
(`readyState: "complete"`), **proved inspectable** (a probe planted into the page was read back from
the child), then settled 500 ms — the absence held. The control is what turned it from an
observation into a measurement.

## Goals / Non-Goals

**Goals:**

- One record kind per contract, one narrowing function per record kind, and **one write path** for
  recording a mailbox.
- The extension's answer to "which mailbox" is **one answer**, with no second place able to disagree.
- The in-page control's accessible name carries the address it will insert, so no new surface inside
  somebody else's page is needed to expose the choice.
- No new delegation to the service worker, because measurement says none is needed.

**Non-Goals:**

- **A menu over this device's mailboxes inside a stranger's page.** Deliberate; see D4.
- **Any behaviour for the website.** It keeps one mailbox and its own IndexedDB adapter, and no
  requirement in `website-client` changes.
- **`all_frames: true`.** See D6.
- **A registrable-domain key.** No public suffix list is shipped; D5.
- **Any deletion of a single mailbox.** `clearAll` already means everything and is the only removal
  control; per-mailbox removal is not asked for by the roadmap's UX rules.
- **`extension-client` amendments.** Measured as unnecessary: no requirement it holds becomes false,
  and inventing one to justify a diff is the same defect this file exists to catch.

## Decisions

### D1 — Two new contracts beside `SpectreStorage`, not a wider one

`SpectreMailboxes` (`loadMailboxes`, `addMailbox`) and `SpectreSiteAssociations`
(`loadSiteMailboxId`, `saveSiteMailboxId`) are separate interfaces in separate files, beside
`contract.ts`.

**Alternative rejected: widen `SpectreStorage`.** One interface, one adapter pair, and the website's
IndexedDB adapter gains two operations it never calls — the exact argument `contract.ts` already
makes about itself ("a record with no consumer is a schema to migrate rather than a feature"). The
cost is concrete: `packages/storage`'s IndexedDB tests would need a mailbox-collection fixture and
site-association fixtures for a client that does not exist, and every future site-association field
would be an amendment to the contract the website depends on.

**Why the site association is not a field on the mailbox collection.** The two records answer
different questions, are written at different moments (creation vs. insertion), and have different
failure consequences: a stale association is ignored, a corrupt collection is skipped per member.
Bundling them would make one record kind's narrowing answer for the other's.

**Cost, stated rather than discovered:** three contracts means a caller wanting everything reaches
three interfaces. That is what `clearAll`'s single meaning is for (D3).

### D2 — The collection stores *records*, not `Mailbox` values

`{ version: 1, mailboxes: StoredMailboxRecord[] }` — each member is the **same versioned record the
single-mailbox path uses**, narrowed by the **same** `readStoredMailboxRecord`.

**Alternative rejected: store `Mailbox[]` and narrow each member against the domain type.** Fewer
moving parts, and it is what a first reading suggests. It is also the amplification the amended
narrowing requirement exists to prevent: a member that fails to narrow must not take its siblings
with it, and reusing the mailbox narrowing is what makes that a property rather than a hope. The
third alternative — one unreadable member makes the whole record unusable, matching the existing
single-record rule — was rejected because the blast radius changes from *one address* to *every
address on the device*.

### D3 — `clearAll` is not duplicated onto the new contracts

Removal stays on `SpectreStorage`, and the requirement gains a scenario the single-record build could
not have written: **a record planted through a different contract** is gone after a removal the
calling contract has no operation for. Both `chrome.storage` (`area.clear()`) and IndexedDB
(`deleteDatabase`) already satisfy it, so no implementation change is needed — **which is precisely
why the scenario is the test that matters**: the requirement was written when it was untestable in
this form, and this is the build that can test it.

**Alternative rejected: give the collection its own `clearAll`.** Two removal operations on the same
area is a question with no good answer ("which one is the privacy control?"), and `packages/storage`
already argues against a generic bag of operations.

### D4 — The preference is expressed by the control's name, not by a menu

The affordance offers **one** control. Its accessible name is the address it will insert
(`affordanceInsertLabel(address)`), so on a host with an association it names that mailbox's address
and elsewhere it names the newest. No list, no disclosure, no second button.

**Alternatives rejected:**

- *A menu in the shadow root.* It is the honest reading of "allow using: current mailbox / new
  mailbox / recently used mailbox for that site" as three **choices**, and it is a new interactive
  surface inside a page this product does not control, whose appearance **no gate in this repository
  can check**. Slice 4 already deleted a depiction from the website for rendering nothing operable;
  adding a control here would be the same defect in the opposite direction, with no measurement to
  catch it.
- *Repeated activation cycling through mailboxes.* Untestable as a user-facing "allow using", and it
  mutates on every press, including presses meant to insert.

**The limit this accepts, stated in the requirement rather than only here:** on a host that has an
association, a person cannot choose a *different existing* mailbox. They create one, which becomes the
newest, and it is offered next time. Recorded for M10, where a menu can be judged on its own
evidence.

### D5 — The key is `location.hostname`, exact, and never derived

**Alternative rejected: fold on the last two labels.** With no public suffix list, that maps
`login.example.co.uk` and `example.co.uk` to the same key and merges a login page into an unrelated
site — and the person who hit it cannot undo it. Two keys is the safer wrong answer and is recorded
in the requirement.

### D6 — `all_frames` stays unset, and that is a decision rather than an omission

Adding `all_frames: true` would reach an email field inside a same-origin iframe, which the measured
absence says this build misses. **The reason to leave it off is that the key would then be the
*frame's* host**: any page could embed a frame and have this device associate a mailbox with a host
the page merely renders, so a site could shape what this device offers on another host. The browser
tier gets a case asserting the iframe is not reached, so the limit is observed rather than assumed.

### D7 — The content script writes the association; the service worker is untouched

The content script knows the insertion happened and knows the host; the worker knows neither. Slice 1
already established that a content script with no `host_permissions` reaches `chrome.storage.local`
on the `storage` permission alone, readable **and writable**. So `protocol.ts` gains **no** message
type, and `service-worker.test.ts` is required to stay at 5.

**Alternative rejected: delegate the write to the worker**, for symmetry with slice 2. It would add a
seam, a message, and a case for a capability the measurement says exists.

### D8 — Reading the collection is one call, and "current" is derived, not stored

The popup's "your address" becomes `loadMailboxes()[0]`, and creation writes through `addMailbox`
only. **The singular `SpectreStorage.loadMailbox` is left in place for the website and is no longer
the extension's source of truth** — the alternative, writing both records, has no transaction on
`chrome.storage` and can leave the device holding an address its own collection does not know.

**Cost, recorded:** the extension now holds two mailbox records until the website is migrated, and
`apps/extension`'s storage seam has two areas. One is written by nobody in the extension; the
alternative — deleting it — would break a stored mailbox an existing user came back for, so the
honest order is *write the collection, keep reading the old record until M10 retires it*, and the
extension's create path is the only place that writes either.

## Risks / Trade-offs

- **A collection grows without bound** → `chrome.storage.local` holds 10 MB by default in an MV3
  extension's own area, and this product creates mailboxes one at a time on a person asking for
  them. No cap is added, because a cap needs a policy (which mailbox to drop? the oldest is the one
  a site association may name) and the requirement would have to guess. Recorded as an open
  question rather than a rule.
- **Two records for the extension's mailbox until M10** → the extension's writes are traceable to
  `addMailbox` in one call site, and a boundary assertion that the extension's create path writes no
  singular mailbox key makes the duplication observable rather than folklore.
- **A stale association is honoured forever** → the requirement says the opposite: a mailbox this
  device no longer holds is **not offered**, so the worst case is that the record is ignored. The
  record is left in place deliberately (D-level reasoning in the requirement).
- **The label now contains an address, so it is longer** → inside a stranger's field, the control is
  positioned beside the field and could overflow a narrow layout. Nothing in this repository can
  measure that; recorded as a limit, not solved.
- **`packages/ui` must stay at 38 tests** → a rise would mean the label work introduced visual
  surface no capability describes. The shadow root's stylesheet is self-contained and already
  carries literals, so a label length needs no new token — but the count is the check that says so.

## Migration Plan

None in the deploy sense: there is no server, no schema version shared with any other build, and no
data this product has not already written. Concretely:

1. The extension starts writing the collection on creation. Existing users' singular record is
   **never migrated** — it is still read by nothing in the extension once the create path switches,
   so an existing user who has never created a mailbox in the new build sees an empty collection and
   is offered creation, which is the same offer they see with no mailbox at all.
2. `clearAll` removes both, on both substrates, without a migration step.
3. Rollback is removing the extension's new code: the singular record is untouched by it, so a
   rollback restores the previous read path with the previous data intact.

## Open Questions

- **Should the collection have a cap, and if so what happens to an association naming the mailbox a
  cap would drop?** Answerable at M10 without changing these specs, because no requirement here
  depends on the collection being unbounded — only on the first entry being the current one.
- **Does M10 want the popup to show the whole collection?** The specs here deliberately say nothing
  about the popup's list, so a later change can add one without amending this one.