# Design

## Context

`in-page-fill` closed with this in its record:

> **Arrival notification.** It requires `alarms` and `notifications`, and it reverses
> `extension-client`'s committed no-polling rule. The reasoning and the measured reasons it was
> rejected are in `design.md` D2.

And that D2 gave three reasons, of which two were measurements that had not been taken:

> - **The two facts it would rest on are still unmeasured.** `measurement.spec.ts` established a
>   *bound* — the worker was still registered after a 30 000 ms idle window — and no termination
>   point. `alarm-floor.spec.ts` established what `chrome.alarms` **stores** (every period accepted
>   down to 999.6 ms) and explicitly not when Chromium **fires** it; Chrome's documented packing to
>   at most once per 30 seconds is unobserved here.
> - **It needs two permissions the manifest does not declare**, and this capability's own scenario
>   fails the build if the manifest requests a permission no shipped surface uses.

`alarms-packing-interval` took the second measurement. A 5 000 ms alarm fired 24 times in 120 s at a
mean spacing of 5 000 ms; a 30 000 ms alarm fired 4 times at a mean of 29 996 ms; **each measured
alone**, on Chromium `153.0.8010.12` under Playwright `1.63.0`, headless, unpacked, one run, one
machine.

So the floor `extension-client` asserted — *"`chrome.alarms` enforces a floor of its own"* — **is not
there on this substrate**, and a requirement that rests on a floor that does not exist cannot be
retained as written. This change replaces it with the thing that was measured.

## Goals / Non-Goals

**Goals**

- Tell the person using the extension that a message arrived in the mailbox it is watching.
- Spend **one** provider request per wake, and never fetch a message body.
- Announce nothing this device has already been told about.
- Keep the worker's retention property: nothing held between wakes.
- Stay inside the only provider budget this repository has measured.

**Non-Goals**

- Telling the person what the message **says**. The code is the product's job in the popup, not in a
  surface outside the browser.
- Watching more than one mailbox.
- Deciding what the extension watches, or offering a control for it.
- Anything that survives a click.

## Decisions

### D1 — The notification carries the sender and the subject, and never a code

This was put to the user and answered: **sender and subject only, never the code.** The reasoning
that decided it is the shape of the surface, and it is worth recording rather than re-litigating: a
notification is readable on a lock screen, in an OS notification centre, and through whatever pairing
the device has. Every one of those readers is **outside** the browser, and therefore outside every
privacy control this repository enforces — `clearAll`, the two-step removal, the refusal that may not
claim the data is gone. A one-time code is the single most sensitive value the product handles; its
entire protection today is that it is only ever reachable by an explicit user action in a surface the
user is looking at. Printing it somewhere else would not weaken that protection, it would remove it.

**Rejected: the code in the body.** This is what the roadmap sketches. It is one glance faster, and
the cost is a credential moved onto surfaces this product cannot audit, clear, or control.

**Rejected: the code behind a click-to-reveal.** Chromium gives an extension no way to hold a
notification's content back until an interaction, so the "reveal" would be a control in the popup
reached from a click that Chromium does not route here — which is D13.

**The consequence is the reason this slice is as small as it is.** `MessageSummary` carries no body,
by product principle — `packages/core` states that codes and links are absent from a summary *"on
purpose: listing a mailbox must not require fetching bodies"*. So a notification built from a summary
**cannot** contain a code, and the check that raises it **never opens a message and never runs
detection**. This is not a filter applied to a body nobody fetched. The property is structural, and it
is the reason the "what it never carries" requirement can be falsifiable at all: there is a mutation
that breaks it — call `openMessage` and build the body from the analysis — and it is caught by
asserting the request count.

### D2 — The gate is discharged, and what the measurement does *not* give us

`extension-client`'s requirement had a scenario gating exactly this: *"WHEN a change would place the
polling session in a background context THEN the recorded measurement SHALL already exist."* It does
now, and `docs/PROVIDERS.md` §4.1.1 is where it is recorded, which is where that requirement said it
would be.

**What it establishes.** A 5 000 ms alarm fires about every 5 000 ms on this substrate, so a
background wake at the shared cadence is a real event rather than an aspiration. Chrome's documented
packing of recurring alarms to at most once per 30 seconds **was not observed here** — which is a
finding, not a failure to reproduce, and it is deliberately not reconciled in either direction.

**What it does not establish, and the limit is load-bearing.** The worker's idle lifetime is still a
**120 000 ms bound, not a figure** — the measurement stopped watching at two minutes, not because the
worker stopped. So the design cannot assume a worker survives; it must be correct whether the worker
was woken, restarted cold, or started for the first time in an hour. **That is why nothing is held
between wakes** (D5) and **why the alarm is reconciled rather than trusted** (D10). A design that
relied on the worker being alive would be relying on the one number this repository explicitly does
not have.

### D3 — Exactly one alarm, because two alarms starve each other

The same measurement produced a finding this change must be built around rather than merely not
violate: **armed together, the 5 000 ms and 30 000 ms alarms produced 24 and 0 firings in 120 s.**
The slower alarm was **never scheduled**, not scheduled late. `docs/PROVIDERS.md` §4.1.1 records it,
and §5.2 carries it as an open gap because nothing here says what causes it.

So the extension gets **one alarm**, with one name, and the requirement says so. This is not tidiness:
a second alarm is not a second feature here, it is the **only** way this extension could stop
notifying. Any future surface that wants its own period — a throttle check, a housekeeping sweep —
has to be folded into this wake rather than given its own alarm, and that is written into the
requirement so the next change reads it rather than rediscovers it by starving this one.

**This inverts the instrument's own positive control**, which is worth recording because it is the
second time here that a control turned out to be a confound: the measurement's first version armed
both alarms at once, reasoning that a concurrent alarm is a control the platform must keep firing. It
is a control, and it is also a competitor.

### D4 — The period is imported, never restated

The alarm's period is `INBOX_POLL_PROMPT_MS` from `packages/mailbox/src/cadence` — 5 000 ms —
imported at the point of use. The no-polling requirement's scenario asked that *"the effective cadence
SHALL be reconciled explicitly with the shared cadence rather than diverging from it silently"*, and
**importing is the reconciliation**: there is no second place for the number to live, so it cannot
drift. A literal `5000` would be a divergence waiting for the cadence to change.

**What the period costs, against the only budget measured.** One listing per wake at 5 000 ms is
**12 requests a minute**. `docs/PROVIDERS.md` records `GET /messages` as `30; w=60` and marks it
**"unauthenticated only — the authenticated policy was not separately measured"**. Twelve is inside
thirty, so the product is inside the only budget this repository has evidence for. It is **not**
inside a budget anyone has demonstrated a provider tolerating under load, and the requirement records
that rather than rounding it to "within limits".

### D5 — Each wake restores, lists once, and releases

`create-mailbox.ts` already established the shape this copies: build a session per event, do the one
thing, and `destroy()` it in a `finally`. The background check is the same shape with a different
call — `restore(storedMailbox)` instead of `open()`.

**`packages/mailbox` is not changed.** `restore()` already does exactly one listing **through the
provider that owns the mailbox** and returns the listing inside its `ready` state. The worker needs
that listing and then needs to stop, and `destroy()` releases the scheduler, so the poll this session
would otherwise schedule is cancelled before the wake ends. One wake, one request — and the assertion
for it is a **request count**, which is the instrument that already caught `in-page-fill`'s
`close()` defect.

**Rejected: a session held in the worker between wakes.** It would make the 120 000 ms bound load-
bearing, and it is the one number here that is explicitly not a figure. It would also break the
retention property `create-mailbox.ts` already asserts, for no gain: the listing a wake needs is one
request either way.

**Rejected: calling the provider's `listMessages` directly, skipping the shared layer.** It is
permitted — clients may reach the provider abstraction — and it would be one line shorter. It is
rejected because reconciliation is not the adapter's job: `restore()` is what turns a dead Guerrilla
session into `expired` rather than into an empty inbox, and §3 of the provider documentation records
that trap as a real response this repository has seen. Reimplementing the check would put a second,
weaker answer to *"is this mailbox still alive?"* into the code.

### D6 — The watched mailbox is the head of the collection, and no new notion is invented

The user chose: **watch only the most recently used mailbox.** This repository has no such notion,
and the temptation was to add one — a `lastUsedAt` field, a second ordering.

It is not added, because an existing function already answers a question one step short of it and is
already the authority: **`loadInsertableMailboxes(records)`** returns the collection newest-first and
is what the popup renders, what the in-page control offers for a host with no association, and what
the worker writes to. Using its head means **the mailbox the background check watches is the mailbox
this device would hand a visitor**, and the "which address does this device have" answer stays
computed in one place rather than a fourth.

**The gap between "newest" and "most recently used" is real and is recorded.** The collection is
prepended on **write**, so a mailbox that was created and never inserted sits at the head. The cost
is that such a mailbox is watched rather than the one last used, and the mitigation is that the head
is the newest mailbox, which is the one a person most likely wants watched. `storage.ts` already
records the sharper version of this limit — a mailbox recorded before this build stops being
insertable once the device records another — and this change does not make it better or worse.

**Why one mailbox and not all, in numbers.** Twelve requests a minute per mailbox (D4). Two is
twenty-four, still inside the measured thirty; **three is thirty-six, outside it** — on a provider
whose authenticated limit was never measured. One mailbox is the only scope this repository can
justify from evidence, and watching all of them would have required a measurement this slice has no
way to take.

### D7 — The first check raises nothing, and that is the difference between a signal and a burst

A device that installs this extension over a mailbox with forty unread messages would otherwise get
forty notifications inside one wake, for mail that arrived before the extension existed.

**So a check that finds no prior record records the current listing and notifies nothing.** The
baseline is the feature, not an edge case: it is what makes "arrived since the last check" true
rather than "is present". The cost is honest and small — **mail that arrived between installing the
extension and the first wake is never announced**, and it is visible in the popup, which is where a
message is read anyway.

**The record is pruned to the current listing on every check**, which keeps it bounded by the mailbox
rather than by the device's history, and **it is written only when the set actually changes** — a
`chrome.storage.local` write every five seconds forever, for a mailbox that has received nothing,
would be a cost with no product behind it.

**The pruning has a stated cost.** A message that leaves a listing and later returns is new to this
device again and is announced again. Providers list newest-first and this repository has never seen a
message leave and come back, so the arm is recorded as a trade rather than measured.

### D8 — The seen ids are a record kind in `packages/storage`, not a raw key in the client

A fourth value has to survive a wake, and the question is only where it lives. `apps/extension/src/storage.ts`
states the rule this repository holds: *"The adapter stays in `packages/storage`; the client hands it
a platform"*, and `tests/architecture/boundaries.test.ts` fails the build if a client names
`localStorage`, `cookies`, `indexedDB` or the rest. `chrome.storage` is not on that list, but the
note's reasoning is about the **adapter** being in the package, and a raw key read and write inside
the client would put a second answer to *"what is a usable stored record"* next to one the package
already owns.

So the record is a contract — **`SpectreSeenMessages`**, two members, keyed by mailbox id — with a
`chrome.storage` adapter only. **No IndexedDB adapter**, for the reason `SpectreMailboxes` and
`SpectreSiteAssociations` have none and the reason `contract.ts` gives: *"a record with no consumer
is a schema to migrate rather than a feature."* The website holds no seen ids and this change gives
it none.

### D9 — A failed check raises nothing, and a mailbox that is gone clears the alarm

Two different facts, and the difference is what `restore()` already distinguishes.

- **`restoreFailed`** — the provider could not be asked, or answered something unusable. The wake
  raises nothing and **changes nothing**, including the record: a check that failed must not shrink
  the set of ids this device knows about, or the next successful check would announce every message
  it had already announced. The alarm stays.
- **`expired`** — the provider says the mailbox is gone. The wake raises nothing and **clears the
  alarm**, because a mailbox that no longer receives mail cannot produce the event the alarm exists to
  report, and leaving it armed is an indefinite background request against a mailbox nothing will ever
  fill. **The stored mailbox is left exactly where it is** — this slice adds no removal control, and
  "the provider says it is gone" is not this product's business to act on beyond stopping.

**A throttled listing stops the loop rather than retrying quietly**, which is `packages/mailbox`'s
existing rule and is why a `429` here produces silence rather than a faster loop.

**Rejected: a notification saying the check failed.** The failure mode is a notification every five
seconds saying nothing arrived and could not be checked, which is noise with a privacy cost and no
product behind it. The honest place for a failure is the popup, which already renders one.

### D10 — The alarm is reconciled on startup, because nothing measured says it persists

`alarms-packing-interval` established that its **record** — a list appended in `chrome.storage.local`
— survives a full browser restart. **It did not establish that an alarm does**, and this repository
is not going to assume it in the one place where assuming it would mean a product that silently stops
working after a reboot.

So `chrome.runtime.onStartup` **reconciles**: if this device holds a mailbox and no alarm exists, one
is created. If the device holds none, none is created.

**The two listeners `service-worker.ts` already carries empty are `install` and `activate`, and this
change does not fill them.** `onStartup` is a **third** listener the worker does not have today, and
the distinction is load-bearing rather than tidy: `install` and `activate` fire once, when the
extension is installed or updated, and neither is a moment at which a device's stored mailboxes can
be assumed readable. `onStartup` fires **per browser start**, which is exactly the event whose
aftermath is unmeasured.

The note above those two empty listeners says that an absence that is merely an omission *"is
eventually filled in by whatever change touches the file next."* **This is that change, and it
deliberately leaves them empty**, and says so in the note rather than leaving a future reader to
guess whether the emptiness was noticed or forgotten.

**Cost of getting it wrong in the other direction:** the reconcile is idempotent and cheap, and it runs
at most once per browser start. It cannot double the alarm, because creation is conditional on the
alarm being absent.

### D11 — The no-polling requirement is removed and re-added, and the two clauses that still bind are named

The delta **removes** the requirement and **adds** its replacement, rather than modifying it, and the
reason is the one `verification-actions` recorded: a `MODIFIED` block keeps the requirement's
**heading**, and this one reads *"carries no polling until its lifetime is measured"* — a title that
would state the opposite of what the requirement then says. A heading that contradicts its own body is
worse than no heading, because a reader scanning titles believes the title.

**What makes this a removal rather than a modification is not only the heading.** The requirement's
clauses divide three ways, and the third is what decides it:

- *"The milestone SHALL measure … and SHALL record both in the provider documentation before any
  decision is taken about which context owns the session"* — **discharged and gone**, and gone
  because the measurement exists rather than because it was inconvenient.
- *"The relationship between those facts has not been measured in this repository, so no polling may
  be built on an assumption about it"* — **false as written**. There is no floor, so the sentence
  asserting one must not survive into a promoted spec. This is the same correction `AGENTS.md`
  requires when a claim becomes false: deleted rather than reworded.
- *"the effective cadence SHALL be reconciled explicitly with the shared cadence"* (D4) and *"no
  document may claim a background polling cadence this repository has not observed"* (D2) — **still
  bind**, and both are carried into the replacement.

So the requirement is **REMOVED and re-ADDED** with a new heading — *"The background service worker
owns exactly one alarm and holds nothing between its wakes"* — a body written around what is true,
and both surviving clauses carried over. Dropping it outright would have discarded two rules that
still have teeth.

**The count arithmetic is predicted here so the promotion can be checked against it rather than
discovered there.** `extension-client` goes **6 → 10 requirements** — one removed, five added, two
amended in place — and **24 → 37 scenarios**: the three the removed requirement carried come off,
fifteen arrive with the five new requirements, and one more arrives with the amended popup. Over all
fourteen capabilities the totals move **157 → 162 requirements** and **478 → 497 scenarios**.
`spectre-storage` goes **15 → 16** and **51 → 57**. **These are predictions and are checked by
counting headings after the sync, not by reading them back off this paragraph.** This paragraph has
now been wrong twice, and both times in the same direction and by one or two scenarios, so the rule
is worth more than the number:

- **The first draft said 34 scenarios** and was wrong by exactly the scenario the popup amendment
  adds.
- **The second said 35** and was wrong by two, because the D12 measurement turned one failure
  scenario into three. That is not a slip in arithmetic: it is what *happened* — the scenario count
  is downstream of the requirement text, and the requirement text moved when a measurement falsified
  a clause in it.

**So the number is recomputed whenever the requirements change rather than carried forward**, which
is the only part of this paragraph that is not arithmetic.

### D12 — The icon, and the measurement that decides between three branches

**The extension ships no icon.** `static/` contains exactly one file, `manifest.json`; the manifest
declares no `icons` and no `action.default_icon`, so the toolbar has been showing Chromium's default
this whole time. `chrome.notifications.create` takes an `iconUrl`, and **whether it will display a
notification without one on this platform is not something this repository has observed.**

Three branches, and the branch is chosen by a measurement rather than by preference:

1. **Chromium accepts the notification without an icon** → nothing ships, and the notification works.
2. **Chromium refuses, and an SVG suffices** → ship one SVG in `static/`, referenced from the
   notification only. `manifest.icons` stays untouched: how the toolbar looks is not this slice's
   business, and changing it would be visual surface no capability describes.
3. **Chromium refuses, and needs a raster image** → ship a small PNG in `static/`, referenced from
   the notification only.

**In every branch, a notification that cannot be created is reported rather than assumed shown.**
**This paragraph was written before the measurement and it was wrong in two directions, so it is
replaced rather than reworded.** It said `chrome.notifications` "reports failure through an error
callback and fires `onError`". Measured on 2026-10-11: **`chrome.notifications.onError` does not
exist on this Chromium at all**, so the platform reports nothing, in either direction. The
defect it was guarding against is real and the guard is still owed — a wake that assumed success
would record a message as announced and tell nobody, which is the exact failure `in-page-fill` found
in a control that removed itself from the page without telling its caller — but the clause naming
the mechanism is deleted, because naming a mechanism no test can reach is how a requirement stops
describing anything. What replaces it is below, and it is the *observed* signal rather than a
documented one.

### D12 (amended during apply, 2026-10-11) — "The measurement chose the branch, and the branch is a raster image"

**Measured with `apps/extension/e2e/notification-display.mjs`**, quarantined, three consecutive runs
identical. Four arms — a control and three icons — and the control is the one that makes the other
three mean anything: if the API were absent in all four, "the icon made no difference" would have been
a fact about a run where nothing worked.

| arm                  | manifest                   | `create` callback | in `getAll()`? |
| -------------------- | -------------------------- | ----------------- | -------------- |
| **control**          | no `notifications`         | *(API undefined)* | —              |
| no icon              | `notifications`            | **resolves**      | **no**         |
| `icon.svg`           | `notifications`            | **resolves `null`** | no            |
| `icon.png`           | `notifications`            | **resolves**      | **yes**        |

Four things follow, and three of them were not available before the measurement ran.

1. **The permission is what makes the API exist.** The control's `chrome.notifications` is
   `undefined`; the probe's is present. And it is **granted at install, with no prompt** — read
   through `chrome.permissions.getAll()` rather than inferred from the manifest, because a declared
   permission and a granted one are different facts and this repository does not cite one for the
   other. `alarms` was already known to behave this way from `alarm-floor.spec.ts`.

2. **Branch 1 is false, and false in the worst direction: it overstates.** A notification with **no
   icon** resolves its callback with the requested id and registers **nothing**. So the callback is
   **not** a success signal, and the design that treated it as one is the finding rather than the
   detail. This is why the icon is load-bearing below.

3. **An SVG is refused outright**, with the callback resolving `null` — the one arm where the
   platform's own answer is unambiguous. Branch 2 is out.

4. **`chrome.notifications.onError` does not exist here.** Not "did not fire": the member is
   `undefined`, and a worker that added a listener to it threw
   `Cannot read properties of undefined (reading 'addListener')` before creating anything at all.

**So branch 3: a raster PNG ships in `static/`, referenced from the notification only.**
`manifest.icons` stays untouched — how the toolbar looks is not this slice's business, and changing
it would be visual surface no capability describes.

**The three-branch list above is retained as the record of what was undecided**, because it is what
the measurement was for. What replaces it operationally is below.

**The icon is mandatory in every notification, and that is the repair for point 2.** The only arm
that resolved without registering is the arm with no icon, so "optionally include an icon" is not a
style question here — it is the difference between the platform reporting a notification and
silently producing nothing while the callback says it worked. The requirement therefore names the
icon as required, and **the built `dist/` is required to carry the file**, so the failing arm is
unreachable by construction rather than improbable by discipline. `manifest.spec.ts` holds that half,
against the built artefact rather than the source tree.

**What the requirement's failure clause is, given that there is no error channel.** The one
observed rejection signal is a `create` callback resolving **`null`** — the SVG arm, and the arm a
missing icon is closest to. So: a null callback does not advance the seen-record, and a later wake
raises the message again. **The requirement does not name `onError`, does not name `getAll`, and
does not claim the callback is sufficient** — the first does not exist here, the second is a second
provider request per notification for evidence this repository has no need to gather at runtime, and
the third is false as point 2 shows.

**Three limits on this measurement, stated because the requirement leans on it.**

- **It cannot observe display.** Nothing here can tell a person a notification appeared: the browser
  is headless and has no notification centre. `getAll()` holding an id is *registration*, and
  registration is the strongest observable available — it is what separated the arms — but it is not
  a sighting.
- **It cannot observe a headed desktop**, where the notification may be presented, suppressed by
  focus settings, or dropped for want of a notification centre. Every number above is headless,
  unpacked, on one engine, one machine.
- **It cannot observe what happens with no notification service at all** — the case where a request
  is accepted and nothing is ever shown, which is exactly where a null callback would be the only
  available signal and this measurement cannot produce it.

### D13 — What the notification deliberately cannot do

**Clicking it does nothing.** Chromium offers an extension no stable way to open its own popup —
`chrome.action.openPopup()` exists, needs a user gesture in a context the extension does not control,
and this repository has already measured that it **adds no Playwright page**, so there is no
instrument here for it either. Opening `popup.html` as a tab is a different surface with a different
size, and shipping it would be fake UI in the exact way `extension-client` describes.

**The consequence is stated rather than hidden: a person learns that something arrived and must open
the popup to act on it.** That is one click, it is the surface the rest of the extension's answers
already live on, and it is honest about what a notification can do.

## Risks / Trade-offs

- **Two assumptions ship unmeasured**, each with a named owner task and neither discovered through
  the browser: that 5 000 ms is tolerable to a provider whose authenticated limit was never measured
  (D4), and that announcing mail automatically is the shape a person wants (D6, D7).
  **The third is retired, and it is retired by measurement rather than by argument:** D12's
  unmeasured arm — "that Chromium displays notifications from this extension at all" — was measured
  on 2026-10-11 and the answer is yes *with a raster icon and no other way*. **What replaced it is
  narrower and is not the same claim: that the platform *registers* the notification on a **headless,
  unpacked, single-engine** run is measured, and that a person **sees** one is not, because nothing
  in this repository can observe a notification centre.**
- **The seen-record can advance on a notification nobody saw.** The only observed rejection signal is
  a null `create` callback, and a request accepted by a platform with no notification service
  returns something else. That is the residual of D12's point 2 and it is named rather than closed.
- **The watched mailbox can be the wrong one** — the head is the newest written, not the last used
  (D6).
- **Mail arriving before the first wake is never announced** (D7).
- **A message that leaves and returns is announced twice** (D7).
- **One mailbox is watched, so a second mailbox is silent.** This is the rate-limit arithmetic and it
  is a deliberate refusal to guess (D6), but a person holding two addresses will experience it as the
  feature not working.
- **`packages/storage` gains a third contract with no IndexedDB adapter**, so the layer's test count
  moves and `apps/web` does not — which is the arithmetic that shows the website was not touched.
- **Nothing here is a claim about how the notification looks.** No test in this repository reads a
  rendered pixel, and a system notification is rendered by the operating system rather than by this
  product at all.