# Design

## Context

The four facts this change measures are named in `proposal.md`; what shapes the **approach** is
three constraints that are already settled and worth reading together, because together they
determine what the instrument can look like.

**1. Playwright cannot see an extension surface that is not a page, and this repository has
already paid for learning that.** `chrome.action.openPopup()` **adds no Page** (recorded during
`in-page-fill`), and the popup's real docked window has therefore never been observed — only a
`popup.html` opened as a tab in the same window, with the fixture page brought to front. The same
is true, unmeasured, of a docked side panel. **So the panel cannot be measured by looking at it.**
Whatever it reports about itself has to arrive through a channel the driver already has.

**2. The worker *is* that channel, and the third probe already uses it.**
`notification-display.mjs` publishes a "probe surface" onto the extension's own service worker and
reads it back with `worker.evaluate(...)` — the same object handle the browser tier's
`background-state.ts` uses. That handle survives the panel being invisible, because **the panel and
the worker are the same extension**: a panel-hosted document can write to `chrome.storage.local`, and
the worker can read it. This is the same seam the content script uses (§4.2: *read and write on the
`storage` permission alone*), and §4.2 already establishes that a fixture's own worker can report on
what the platform gave it.

**3. `chrome.sidePanel.open()` requires a user gesture** — documented, and the kind of thing this
repository measures rather than trusts. A Playwright `click()` **is** a user gesture, and the
existing suite already drives the popup that way.

## Goals / Non-Goals

**Goals:**

- Answer, or record as unmeasurable **on this Chromium**, the questions listed in `proposal.md` —
  with an arm for each, so an absent answer is distinguishable from a probe that never loaded.
- Produce a **written result** in `docs/PROVIDERS.md` §4.6 with the same
  *"What it does **not** establish"* column every other table in §4 carries.
- Leave M11 slice 1 able to choose between *"ask the content script"* and *"add a permission"*
  **from a measurement**, and leave the browser tier's viability for a panel **recorded** rather
  than hoped for.

**Non-Goals** (restating `proposal.md`'s scope would add nothing; these are the design-level
boundaries):

- **No answer about how a panel looks, how wide it is, or whether a person sees it.** Nothing here
  reads a rendered pixel, and the docked panel is the fourth instance of this repository's standing
  limit rather than a new one.
- **No decision** about which context owns the mailbox session, whether the panel contacts a
  provider itself, or how many slices M11 has.
- **No premise written down as a fact.** Where Chrome's documentation and the measurement disagree,
  the measurement wins and the disagreement is recorded in the same table.

## Decisions

### D1 — The panel is measured by what it *writes*, and the worker is the surface that reads it back

**Decision.** The panel document publishes its findings into `chrome.storage.local`; the driver
reads them with `worker.evaluate(...)`, exactly as `notification-display.mjs` reads its probe
surface.

**Alternative considered — give the panel a `Page`.** `sidepanel.html` opened as a tab would be a
real page Playwright could drive, and it would measure a real extension page running real code.

**Rejected**, for the reason `notification-display.mjs` records in its own header: **that is the
popup substitute, and a substitute cannot answer the question.** A tab-hosted panel document is not
docked beside anything, so `chrome.windows.getCurrent()` and
`chrome.tabs.query({active:true, currentWindow:true})` would report the substitute's own tab — which
is *precisely the fact under measurement*. Using it as the primary instrument would answer "which
tab does a panel context name?" with the question's own premise baked in.

**The substitute is still run, as its own arm, and what it preserves is recorded.** That is fact D:
it is the only route by which the browser tier could verify a panel's *behaviour* at all, so M11
slice 1 needs to know what it is buying. Its arm is labelled a substitute in the output, in the same
words `in-page-fill`'s header uses for the popup.

### D2 — Three fixtures, one variable each, and the control that makes the others mean anything

**Decision.** `side-panel-probe/` plus two siblings, each varying **one fact** about the base —
and the two facts are named, because *"one variable"* is not the same claim as *"one line of JSON"*:

| fixture    | varies from the base                                        | the arm it exists to answer                         |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------- |
| `base/`    | —                                                            | is `chrome.sidePanel` present at all?                |
| `control/` | the surface is **not declared**: no `sidePanel` permission and no `side_panel` key — **one variable, two lines**, because Chromium requires both before the API exists | is the API absent without it declared? |
| `tabs/`    | one entry added: `tabs`                                      | does reading the active tab's URL cost a permission? |

**Why the control is not optional.** This is `notification-display.mjs`'s recorded lesson, stated
there as *"the alarms probe's own lesson: its first version armed two alarms at once, called the
competitor a positive control, and produced 0 firings for one of them — a control that shares the
resource under measurement is a confound."* **If `chrome.sidePanel` is absent in all three, then
"the permission made it exist" is false and the run has measured nothing about anything else** — the
other seven questions would then be about an API that is not there.

**Why three and not two.** The `tabs` arm is the one that **prices** the decision slice 1 has to
make. Without it the probe can report *"`tab.url` is `undefined` here"* and stop, leaving
route (b)'s cost unmeasured. With it, `tabs/` reports the same query against a `tabs`-holding
fixture, and the two routes are **compared by the instrument rather than argued in the design.**

**One variable at a time, so a difference is attributable — and the control's two lines are the
honest form of that, not an exception to it.** A third sibling carrying the `sidePanel` permission
*without* the `side_panel` key would isolate the two, and it is deliberately **not** built: M11 is
going to declare both, because a panel nobody can open is not a panel, so the useful question is
*"does declaring the surface work"* and not *"which of its two declarations does the work."* Building
the isolation arm anyway would answer a question nobody asked while leaving the one that was asked
two arms deeper.

### D3 — The gesture comes from a click on the fixture's own extension page

**Decision.** The fixture ships a small extension page (`launcher.html`) carrying one button. The
driver opens it as a tab, clicks the button, and the page calls `chrome.sidePanel.open({ tabId })`
for the window it is in.

**Alternative considered — `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.**
It needs no gesture at all, so it looks simpler.

**Rejected for two reasons, and the second is a decision already taken.** First, it is triggered by
a **toolbar click**, which Playwright cannot perform — so the probe would have to be *believed* about
the step that matters most. Second, and decisively: **that flag is the toolbar fork, and
`proposal.md` records it decided the other way.** The toolbar button stays with the popup, which
holds M10 slice 2's entire shipped workflow. A probe that turned the flag on to make itself work
would be measuring a configuration the product has chosen against.

**The launcher page is a fixture, not a product surface.** It is a button that exists only so a
platform requirement can be satisfied by something Playwright can click, and its `manifest.json`
description says so in the same words `notification-probe`'s does.

### D4 — "Did the panel open" and "what did the panel see" are two different observations, and a run that has only the second is a run that measured nothing

**Decision.** The probe records **both**:

- the **outcome of the `open()` call itself** — resolved, rejected, or thrown — which is the
  platform saying the panel was opened;
- the **panel's own report**, read back from `chrome.storage.local`, which is the panel saying it ran.

**Why they cannot be collapsed.** `notification-display.mjs` records the distinction this
repository cares about most: *a resolved callback is not a displayed notification*, and
`getAll()` holding an id is **registration, not a person seeing one**. The identical gap exists here
one level up — **a panel that opened is not a panel whose document executed**, and a run that
recorded only the first would report a fact about a surface nothing had yet observed.

**And the case that separates them is the one that matters for slice 1.** A panel that opens against
a window with no content script must still produce a report, saying so. If the driver recorded only
`open()` resolving, that arm would be indistinguishable from a working panel — and *"the panel cannot
say which page it is beside"* is the failure mode slice 1's whole design turns on.

### D5 — A tab switch is **driven**, not waited for, and read back as a *second* report

**Decision.** After the first report is read, the driver switches the fixture window's active tab
and reads the panel's report **again**.

**Why.** Chrome documents that a side panel *"remains open when navigating between tabs"* — which
means **"which page am I beside" is a live question and not a boot read.** That is the whole of
fact C, and it is the property that decides whether slice 1 can be a panel that reads once or a
panel that follows.

**Why a second read rather than a listener assertion.** The panel registering a
`chrome.tabs.onActivated` listener and *handling* the event are different facts, exactly as
`notification-display.mjs`'s three observations per arm are different facts. A report written **in
the handler** is the panel telling us it re-evaluated; a listener registered and never firing would
produce no second record at all, which is the shape this repository records as a green run that
measured nothing.

### D6 — The exit code says *measured*, and the arm list says *which*

**Decision.** `0` only when every arm produced an observation; `1` otherwise — **and "measured
nothing" is the second**, copied from `notification-display.mjs`'s header for the reason given
there: *a run whose arms all came back empty is indistinguishable from a probe that never loaded.*

**And "unmeasurable on this Chromium" is a distinct outcome from "absent".** If a docked panel
cannot be opened in headless Chromium at all, the run reports that as a **finding about the
substrate**, exits non-zero because it measured nothing, and §4.6 records it. **That is still a
result** — it is the same result `notification-display.mjs` produced about a notification centre it
could not see — and the alternative, exiting `0` on empty arms, is the false green this repository
has now written down three times.

### D7 — The result goes in a **new** §4.6, not appended to §4.1 or §4.2

**Decision.** `docs/PROVIDERS.md` gains **§4.6, Side-panel facts**, with its own table and its own
*"What it does **not** establish"* column.

**Why not §4.1.** §4.1 is *"MV3 runtime facts"* about the **service worker** — its idle survival,
`chrome.alarms`. §4.2 is *"Content-script facts"*. **A side panel is a third context**, and folding
it into either would put a row in a table whose subject it is not — which is how a measurement stops
being findable by the person who needs it.

**And the subsection discipline already in §4 is the precedent**: §4.3 exists because §4.2's own
probe stated a gap, §4.4 because a *deciding* question had to be answered before a design was
written, §4.5 because the notification slice needed facts nobody had. **§4.6 is the fourth of that
shape, and it is written the day the measurement is taken rather than reconstructed afterwards.**

### D8 — The fixture's rights are declared in its own `manifest.json` description

**Decision.** `side-panel-probe/manifest.json` declares `sidePanel`, `storage`, `tabs` and the two
provider host patterns, and its `description` field states **why**, in the words
`notification-probe`'s already uses: *the instrument that answers a question may need rights the
product does not have yet.*

**Why this is a design decision and not a copy.** The shipped manifest requests
`["storage", "alarms", "notifications"]`. A probe whose fixture silently acquired `sidePanel` and
`tabs` would make the *next* change's cost invisible — and `in-page-integration` holds a promoted
requirement precisely because *"a permission no surface uses is the one a reviewer deletes rather
than the one they question."* **The fixture is where a permission gets measured so that the shipped
manifest never has to carry it**, and that only stays true while the fixture says so out loud.

### D9 — `static/manifest.json` is not touched, and that is what makes this the cheap half of the decision

**Decision.** No product code, no manifest edit, no permission, no message kind.

**Why it is worth stating rather than assumed.** Two spikes in a row now measure rights the shipped
manifest deliberately lacks (`alarms-packing.mjs` staged `alarms` + `storage`;
`notification-display.mjs` staged `notifications`). **The pattern is the finding**: this repository
has a mechanism for learning what a new surface needs *without* declaring it first, and every
future surface decision should be expected to route through it rather than around it.

## Risks / Trade-offs

- **Chromium may refuse to dock a panel in headless mode**, in which case `open()` rejects and
  every panel-hosted question is unmeasurable here. → This is **the expected shape of the result,
  not a failure of it** (D6). It is recorded in §4.6 as a substrate limit alongside
  `notification-display.mjs`'s, and M11 slice 1 designs against *what was measured*, which then
  includes *"and we could not see a docked panel"*. The substitute arm (D1) still runs, so the
  browser tier's viability is answered even when the platform's presentation is not.

- **A fixture that behaves differently from the product in any particular beyond the entry under
  test** would make every arm suspect. → Fixtures differ from the shipped manifest **only** in the
  entries listed in D2, and each sibling is one entry from its parent rather than a separate design.
  `notification-probe`'s header states the principle: *"a fixture that had to differ from the
  product's manifest in every particular would be a fixture nobody could reason about."*

- **A probe that answers confidently and wrongly is worse than one that declines to answer** —
  recorded four times in this repository, including an instrument that printed `undefined ms` for
  three arms without a single run going red. → D6's exit code, D4's two observations, D2's control,
  and the notification probe's own `ms()` helper refusing to format a non-number all exist for this,
  and the new script follows each of them rather than inventing an approach.

- **Recording measurements this change has not taken.** → `docs/PROVIDERS.md` §4.6 is written at
  **apply** time, from the run's output, and every row carries what it does not establish. §5.2 gains
  a row for whatever the run leaves open, because **closing one gap is not the same act as having
  none** — the replacement row that `alarms-packing-interval` left behind is the precedent.

- **This change promotes nothing, so a reader may assume nothing was learned.** → `.openspec.yaml`
  says why in full, and `proposal.md` names the two promoted requirements that stay true and unchanged.
  The next change is the first in M11 to amend one, and it will point here for the numbers.

## Migration Plan

None. Nothing shipped changes; the only new committed file reachable by any runner is one `.mjs`
name added to `QUARANTINED_PROBES`, and that rule fails the build if any runner ever collects it.

**Rollback** is deleting the probe script, its fixture directory and one list entry.

## Open Questions

- **Whether a side panel is subject to any suspension policy**, and therefore whether slice 2's
  "a persistent inbox beside the page" is a promise a panel can keep. Deferrable: no requirement
  depends on the answer yet, it does not change this change's approach, and it is a §4.6 row rather
  than a design branch — **unless** slice 2's polling design turns out to rest on it, in which case
  it is measured before slice 2 is proposed, by this same instrument.
- **Whether the panel and the worker can both be alive and both polling the same mailbox** — the
  shape §4.1.1's starvation finding makes worth asking before slice 2 exists. Also deferrable, and
  for the same reason: it is a §4.6 row now and a design decision at slice 2, not a blocker here.