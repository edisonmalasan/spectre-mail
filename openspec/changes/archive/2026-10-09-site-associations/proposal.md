# Proposal

## Why

The roadmap's site mapping is `hostname -> mailbox ID`, and its UX rules offer a person three
things they may use: **the current mailbox**, **a new mailbox**, and **the mailbox they last used on
that site**. Slices 1 and 2 delivered the first two. The third cannot be delivered at all today, and
the reason is measurable rather than a matter of taste:

**This product stores exactly one mailbox per device.** `SpectreStorage` has `loadMailbox` and
`saveMailbox` in the singular, `saveMailbox` overwrites, and both adapters write it under one key
(`EXTENSION_MAILBOX_KEY = "current"`, `CURRENT_MAILBOX_KEY = "current"`). Two creations in a row are
two writes to the same key, which `create-mailbox.test.ts` already asserts by expecting
`saveMailbox` twice. So a `hostname -> mailbox ID` map written today could only ever name the one
mailbox this device holds, and would go stale the moment a second was created — **the roadmap's site
mapping presumes something the product does not have.**

That makes this slice a storage change before it is a client change, and it is the contract question
`docs/ROADMAP.md` already flagged: `packages/storage/src/contract.ts` says it "has room for one of"
M6's **five** named record kinds — mailboxes, provider credentials, preferences, a message-metadata
cache, provider health — and **a site association is not one of the five**, so the contract's own
scope statement has to be answered rather than stretched.

## What Changes

- **`packages/storage` gains a second and a third contract**, beside `SpectreStorage` rather than
  inside it: one for **the mailboxes this device can insert** and one for **which of them a site was
  last used with**. Each is served by a `chrome.storage` adapter and by **no IndexedDB adapter**,
  because the extension is the only client that consumes either and the contract's own note argues
  that "a record with no consumer is a schema to migrate rather than a feature".
- **`SpectreStorage`'s "one contract" and "both adapters" requirements are amended**, because both
  name a single contract and a fixed pair of adapters, and both become false the moment a second
  record kind exists.
- **Every record kind is narrowed by exactly one function, shared by every adapter that serves it.**
  The collection stores each mailbox as the **same versioned record the mailbox itself uses**, so a
  member this build cannot read is skipped rather than taking every sibling with it.
- **`clearAll` keeps its meaning.** It already empties the whole area on `chrome.storage` and the
  whole database on IndexedDB, so a record kind added here is removed with it — and that is now a
  requirement about **two** record kinds rather than one, with a test that plants a record the
  calling contract does not know about.
- **The extension's answer to "which mailbox" becomes one answer.** The collection is the only place
  mailboxes are written, and the newest member is the current one; the popup and the in-page control
  both read it, so there is no second place that could disagree.
- **The in-page control prefers the site's mailbox** when this device still holds it, and **names the
  address it will insert** — one control, its accessible name carrying which mailbox, and no menu.
- **An association is written only after an address was actually inserted** on that site, so the
  record is evidence of a person's action rather than of a page load.
- **The site key is the top frame's `location.hostname`**, measured rather than recalled: it excludes
  the port and is already lowercased by the platform, and no registrable-domain folding is applied
  because this repository ships no public suffix list.

## Capabilities

### New Capabilities

None. This change is about behaviour inside two capabilities that already exist, and inventing a
third to hold it would give a reader somewhere to look for a requirement that describes nothing this
change delivers.

### Modified Capabilities

- `spectre-storage`: the contract's **plural** — a mailbox collection and a site association, each
  with its own narrowing and its own adapter where a client consumes it; the **one contract** clause
  becomes the storage layer's contracts; **"both adapters narrow through the same code"** becomes
  per-record-kind narrowing; and `clearAll` is restated as covering **every** record kind the device
  holds.
- `in-page-integration`: the affordance's label **names the address it will insert**, because with
  several mailboxes "Use SpectreMail" no longer says which one; the control **prefers the mailbox
  this site was last used with** when this device still holds it; an association naming a mailbox
  this device cannot hand back **is not offered and is not silently repaired**; and the key is the
  **exact** `location.hostname` with no suffix folding.

## Impact

**New behaviour is confined to the extension.** The website keeps its singular mailbox and its own
IndexedDB adapter, and **no requirement in `website-client` changes** — which is a measurable claim,
not an intention, and one the browser tier's existing storage cases would notice.

- `packages/storage`: two contracts, two `chrome.storage` adapters, two record kinds in the shared
  narrowing module, and their unit tests.
- `apps/extension/src`: the storage seam, the popup's read of "your address", the worker's write on
  creation, the content script's controller (collection read, association read, association write,
  labelled address), and `affordance.ts`'s label constants.
- **No new delegation to the service worker, and that is measured rather than preferred.** Probe:
  `chrome.storage.onChanged` **does** reach a content script's isolated world when the worker writes
  `chrome.storage.local`, while the DOM `storage` event — a different mechanism with the same-sounding
  name — does not. So this slice needs no `sendMessage` seam at all, where slice 2 needed one for the
  provider request. The measurement is why the change is smaller than slice 2 and not an oversight.
- Tests: two new unit files in `packages/storage`, cases in the extension's controller and popup
  suites, and a new browser spec in `apps/extension/e2e/`.
- **No new design token and no new motion**, so `packages/ui` must still be 38 tests — the same
  measurement `in-page-address` and `in-page-mailbox` used.

## Declared limits, recorded rather than discovered

- **A same-site iframe's email field is not reached.** `all_frames` stays unset, and probe arm 3
  measured that the content script does not run in a same-origin iframe. Adding it would let any page
  claim any hostname's association, because the key would be the frame's host — which is a reason to
  leave it off rather than a gap to close.
- **No public suffix list, so `login.example.co.uk` and `example.co.uk` are two keys.** Recorded
  rather than papered over; a registrable-domain key needs a list this product does not ship.
- **The popup is not a list of mailboxes.** It shows the newest, while the in-page control may insert
  a different one on a site that has an association — which is why the control names its address.
- **Nothing here reads a rendered pixel.** Whether the affordance, now carrying an address, reads as
  right inside somebody else's page is a human judgement and is left to one.
