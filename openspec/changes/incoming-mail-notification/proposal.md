# Proposal

## Why

`in-page-fill`'s design record closed by naming this as the option it declined, with three reasons
and two of them measured: *"Arrival notification. It requires `alarms` and `notifications`, and it
reverses `extension-client`'s committed no-polling rule."*

Both reasons are now gone. `alarms-packing-interval` measured what `chrome.alarms` **fires** rather
than only what it stores — a 5 000 ms alarm fired 24 times in 120 s at a mean spacing of 5 000 ms,
with **no packing** — so the floor `extension-client` assumed ("`chrome.alarms` enforces a floor of
its own") is not there, and a background wake is something this repository has watched happen rather
than something it inferred. The other half of that requirement's gate, *"The recorded measurement
SHALL already exist"*, is discharged by the same run.

So the product still cannot tell a person that the mail they are waiting for has arrived. A visitor
who installed SpectreMail to get through a signup pastes an address into a form, switches back to
their inbox, and **waits**, with no signal that anything happened. This change gives the extension
that signal, restricted to what the product can honestly claim without reading a message body: **a
notification naming the sender and the subject of a message that arrived since the last check.**

**The notification never carries a one-time code.** That was put to the user and decided, and the
reason is the shape of the surface rather than a preference: a notification is readable on a lock
screen, in an OS notification centre, and on a paired desktop or wearable — every one of them outside
the browser this product's privacy controls govern. A code that appears there has left every boundary
this repository can enforce, for a glance that the popup already offers one click away.

That decision has a consequence worth stating because it is what makes the slice small: **a
notification needs no message body.** `MessageSummary` carries no body at all, by design
(`packages/core`: *"listing a mailbox must not require fetching bodies"*), so the check this change
adds **never opens a message, never runs detection, and never sees a code** — not because it refuses
to show one, but because the one request it makes cannot return one.

## What Changes

- **The background service worker creates exactly one `chrome.alarms` alarm**, armed when this device
  first holds a mailbox and re-checked on every browser startup rather than assumed to have survived.
- **Each wake restores the watched mailbox from stored credentials, takes one listing, and releases
  everything.** One provider request per wake. Nothing is retained in a context whose lifetime this
  repository has measured as a **bound** and not a figure.
- **A message id this device has not seen before raises one notification** carrying the sender and
  the subject, and nothing else.
- **A first check raises nothing.** It records what is already there as the baseline, so installing
  the extension on a device with an old mailbox produces no burst of notifications for mail that
  arrived before the extension existed.
- **A check that fails, or a mailbox the provider says is gone, raises nothing.** The second clears
  the alarm, because a mailbox that no longer receives mail cannot produce the thing the alarm exists
  to report.
- **The watched mailbox is the one this device would hand a visitor** — the head of the existing
  newest-first collection, read through the same function the in-page control already uses. No new
  notion of "most recently used" is introduced.
- **`extension-client`'s declared absence of a notification is amended**, in the form that absence's
  own scenario requires of the milestone that adds it. The side panel, the one-time-code copy
  control, and the verification-link control **stay on that list**.
- **`extension-client`'s no-polling requirement is removed and replaced** rather than amended, because
  a `MODIFIED` block keeps its heading — *"carries no polling until its lifetime is measured"* — and
  that title would contradict the body it then carries. Two of its three clauses still bind and both
  are carried into the replacement: the reconciliation with the shared cadence, and the prohibition on
  any document claiming a background cadence this repository has not observed.
- **`extension-client`'s popup requirement is amended too**, and this one was found by reading the
  delta against the spec rather than planned: it justifies its user-asked listing with *"because no
  background polling exists in this milestone"*, and that reason becomes false the moment this change
  lands while the rule it supports stays true.
- **`packages/storage` gains one record kind** — the message ids this device has already been told
  about, per mailbox — with a `chrome.storage` adapter only and no IndexedDB adapter, for the same
  reason the other two extension-only record kinds have none: a contract the website cannot use is
  not one the website should be made to hold.
- **`static/manifest.json` gains `alarms` and `notifications`**, and the capability's own manifest
  scenario fails the build if either is declared and unused.

**Deliberately not in this change**, named because each is a thing a reader could reasonably expect
here and its absence would otherwise read as an oversight:

- **A click on the notification does nothing.** Chromium offers no stable way for an extension to
  open its own popup, and opening a tab to the popup is not the same surface. The limit is recorded
  in the requirements rather than left to be discovered by someone clicking one.
- **The popup gains no notification control.** What the extension watches, and whether it watches at
  all, are not the roadmap's question, and a control here would be the second surface deciding what
  the in-page control already decides.
- **No side panel, no code copy control, no verification-link control.** All three stay on
  `extension-client`'s declared-absence list, and `in-page-fill` is why that list has been split
  rather than emptied.

## Capabilities

### New Capabilities

None. `extension-client` owns what the extension is and the background context is part of it;
`spectre-storage` owns what this device keeps. A new capability would split a surface the repository
has deliberately kept whole.

### Modified Capabilities

- `extension-client`: the declared-absence requirement is amended to take the notification off the
  list; the no-polling requirement is **removed and replaced** by one that describes the single alarm
  the worker owns, keeps both clauses that still bind, and deletes the sentence naming a `chrome.alarms`
  floor this repository measured and did not find; the popup requirement is amended so its
  user-asked-listing rule survives the arrival of a background one; and five requirements are added —
  the one alarm and the retention, what a notification carries, what it never carries, what the first
  check does, what a failed check does, and which mailbox is watched.
- `spectre-storage`: one requirement is added for the record kind this needs, with the two clauses
  every record kind here carries — a read failure is never reported as an absence, and a write leaves
  entries it cannot read in place.

## Impact

**Code.** `packages/storage` gains `seen-messages.ts` and a `chrome` adapter beside the two it
already has; `apps/extension/src` gains a notification module and an alarm-lifecycle module beside
`service-worker.ts`, and `service-worker.ts` gains the two listeners that are currently
**intentionally empty**; `protocol.ts` is untouched, because nothing here is a message between
contexts.

**Unchanged, and named because each was the obvious place to look.** `packages/mailbox` is not
touched: `restore()` already performs one listing through the provider that owns a mailbox and hands
the listing back in its state, so the one request this slice needs is a call the shared layer already
makes. `packages/ui` is untouched — no new token and no new motion, so its count must not move.
`apps/web` is untouched. `docs/PROVIDERS.md` §4.1.1 gains the **notification-icon** measurement this
slice has to take, because no icon ships today and whether Chromium accepts a notification without one
is not something this repository has observed.

**Risk, and it is the largest of any slice so far.** Three things are assumed rather than measured,
and each is named here rather than left to be discovered through the browser:

- **That Chromium will display a notification at all from an unpacked, headless-loaded extension.**
  `chrome.notifications` has never been called in this repository, and the extension ships **no icon
  file of any kind** — `static/` holds nothing but `manifest.json`. A notification that cannot be
  created must be **reported**, not assumed shown, and that requirement is written before the
  implementation exists rather than after it fails.
- **That 5 000 ms is a defensible cadence against a live provider.** `GET /messages` is `30; w=60`
  and **that was measured unauthenticated only**, on a provider whose authenticated policy was never
  measured, and **Mail.tm is the extension's primary provider**. Twelve requests a minute sits inside
  the only budget ever measured here, and that is a statement about a number, not a demonstration
  that a provider tolerates it.
- **That a person's mail arriving should be announced by their own browser without asking.** The user
  was offered an explicit opt-in and chose the automatic form, with the scope narrowed to one mailbox.
  The scope is the mitigation; it is not proof the shape is right, and the requirements say so.