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

**One code copy and two manifest fragments, not three directory copies — and the reason is a
defect rather than a preference.** The first version of this decision said each sibling would be an
*exact copy* of the fixture, which is what `notification-probe/` does. Copying there was cheap
because its `probe.js` is a notification attempt and a short control-only variant stood in for it.
**Copying here would put three copies of the panel-report code on disk**, and three copies of the
file under measurement is the shape this repository records as *"the arms are not comparable"* — one
edited and two stale measures three different programs and reports it as one variable.

So the committed tree is **one fixture and two fragments**: a `manifest.json` base, a `variants/`
directory holding `control.json` and `tabs.json`, and the one set of documents — `probe.js`,
`sidepanel.html`, `sidepanel.js`, `launcher.html`, `launcher.js`.

**Each fragment is a whole top-level replacement, never a merge of its contents.** `permissions` is
replaced wholesale rather than unioned, so a fragment cannot silently accumulate an entry the base
did not have. The merge is shallow over the top level and nothing else, and **task 1.4 merges each
fragment and diffs the result against the base**, which is what makes the merge a checkable
operation rather than a step a reader has to trust.

**And the first version of task 1.4's script failed on its first run, because a shallow merge
cannot delete.** It reported `control differs by ["permissions"]` where the decision required
`["permissions", "side_panel"]`: the fragment named only `permissions`, so `side_panel` was
inherited from the base intact. **A control that still declared a side panel would not have been a
control** — the arm it exists to run asks whether the platform grants a panel *without* the
permission, and a fixture that declares one answers that question by construction. Every later arm
would have been measured against a control that agreed with it.

So the merge carries **one deletion rule**, stated here because it is the only rule and a reader
implementing it differently would produce a green run about a different fixture: **a key whose value
is `null` removes the key.** A second rule came with it — **a key beginning with `_` is an
annotation for a person and never reaches the materialised manifest**, because a comment that
survives into a manifest is one refactor away from being load-bearing.

**A fixture that cannot be told apart from its control is the defect, and the check found it
before a single arm ran.** Both rules are asserted on their own in the script, so changing either is
a red run rather than a difference no arm reports.

**The materialised fixtures are written under `test-results/`**, for the reason
`notification-display.mjs`'s header gives for writing its PNG there: a generated copy under
`test-results/` cannot go stale and survive a run to be read as evidence about a later one.

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

**Measured, and this decision's own gap was demonstrated by this repository's fixture rather than by
the platform.** The first version of `sidepanel.html` carried **no `<script>` tag**, so every arm that
depends on the panel reported nothing while `open()` resolved and the launcher printed that the panel
had opened. **That is the exact failure this decision exists to catch, produced by the probe itself** —
and it is recorded here rather than only in §4.6 because a decision that is only ever tested against
a *hostile* platform is a decision whose failure mode has never been produced locally.

**And the API this decision would have used for a second opinion is not there.**
`chrome.sidePanel.getPanelState` is **`undefined` on this Chromium** while `open` and
`setPanelBehavior` are functions. **D4 therefore has no third observation on this substrate**, and
that is a finding about the measurement rather than a gap in it: had the driver relied on
`getPanelState`, it would have thrown on every arm and reported an instrument fault where the platform
is merely different. The absence is a **§4.6 row**, because a reader deciding whether to use it on
another Chromium needs to know it was looked for and not found.

**One instability is recorded rather than diagnosed.** Across the runs taken while recording §4.6,
**one run in six failed to dock the panel in either stage**; three consecutive re-runs produced four
panel reports each. **The instrument reported it correctly** — `MISS` arms, `answerable: false`,
exit `1` — which is D6 working, not a flake being tolerated. **No cause is claimed**, because none was
found, and a repeatability figure without a cause is a number rather than a finding.

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

**Decision.** The base declares `sidePanel`, `storage`, a content script, and the two provider host
patterns; its `description` field states **why**, in the words `notification-probe`'s already uses:
*the instrument that answers a question may need rights the product does not have yet.*

**`tabs` is not on that list, and the reason is D2's amendment.** It was in the first version of
this decision, written while the variants were three directory copies and the base carried every
permission any arm needed. With one base and two fragments, **`tabs` is the `tabs` variant's whole
point** — declaring it on the base would have made the arms D2 exists to price indistinguishable,
and the list would have been accurate about the file and misleading about the measurement.

**Two of the entries are not rights at all, and both are here for a named reason.** The content
script exists because `proposal.md` asks whether a panel can `chrome.tabs.sendMessage` the page
beside it, and that question has no answer without a page that answers; the provider host patterns
exist because the same list asks whether an extension-hosted page can reach a provider origin
directly rather than delegating to the worker the way a content script must (§4.4 measured the
content-script half). **Neither is a permission the shipped extension is being asked to take**, and a
reader checking this list against the product's should find the difference is the whole design.

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

### D10 — A quarantined probe's *artefact* is still an artefact, and the boundary rule had to learn it

**Found at apply, group 7, by the boundary suite failing on the shipped tree** — and the suite was
right and the tree was not wrong. Adding this probe to `QUARANTINED_PROBES` made its name correct;
it did nothing about the directory the probe *writes*. `side-panel-runtime.mjs` stages its fixture
into `apps/extension/test-results/`, because a materialised `manifest.json` per variant is the whole
mechanism behind D2's merge rules, and Playwright's output directory is the one place the
repository already has for exactly that. **That directory is gitignored and nothing ships from it.**

**So the storage rule reported a staged copy of `e2e/fixtures/side-panel-probe/sidepanel.js` for
the `chrome.storage.local` calls its own source is written with** — and the source copy is *already
exempt*, because it lives in a browser suite's `testDir`. **The same file was therefore judged twice,
once correctly and once wrongly, with only the difference between them being which directory it
sat in.** That is the **third recorded instance of this repository's "an artefact the measurement
itself creates" defect**, and the first two were both in the *instrument* rather than the *rule*:
the block-runner fingerprint that reported 2 930 changed files, and the `dist/` that outlived a
restore. **The recurring shape is the same in all three: something that cannot tell a file it should
read from a file it created reports on every run, which reads as busy rather than as broken** — and
the natural response to a crying wolf is to delete the rule.

**The repair is the definition `dist`, `build` and `coverage` already carry**, so `test-results` is
added to `SKIP_DIRECTORIES` with its reason attached rather than exempted inside one rule. **It was
not added as a carve-out inside `clientStorageApiViolations`**, because that function takes no
argument and the repository has already paid once for a rule's second spelling of what it scans:
M6 slice 1's falsification rewrote a call site to narrow a package list and the suite stayed green.

**And a skip nobody has watched fire is a hole, so the control is a pair.** A probe inside
`apps/extension/test-results/` must go **un**reported — load-bearing on a real artefact, because the
run stages a copy there on every execution — and a probe in `apps/extension/test-results-src/`, whose
name *contains* the skipped one, must still be **reported**, which is what distinguishes a
whole-path-segment match from a substring one. **`test-results-src` rather than `testResults` or
`test_results`,** because a normalising implementation is a different defect that a camelCase
spelling would pass for the right reason. Both arms were run: removing the entry is caught, and
turning the walk into a substring test is caught.

**`SKIP_DIRECTORIES` feeds three call sites, so one entry covers all three**, and the browser-spec
collection rule beside it now cannot require collection of a `.spec.ts` inside an output directory.
That is correct — nothing there is shipped — and it is stated rather than discovered later, because
a skip that quietly widens one rule while narrowing another is the shape of a change that reads as
one line.

### D11 — A fixture spanning three contexts declares each one exactly, and the config's merge semantics are why

**Found at apply, group 7, by `pnpm lint` — the same gate that `extension-preview`'s falsification
harness failed, for the same class of reason.** `eslint.config.js` gives a file **one** environment,
and the block covering `e2e/fixtures/**/*.{js,mjs,cjs}` declares a **service worker**, because the
first fixture to need one (`alarm-probe`) was a worker. `side-panel-probe` is a worker *and* a side
panel document *and* a launcher document *and* a content script, so its three document scripts were
linted as workers and `pnpm lint` reported `document is not defined` on `launcher.js` — correctly.

**The fix that looks right and is not: declaring the union.** `{ ...serviceworker, ...browser }`
would have silenced both errors, and it would have done it by **teaching
`alarm-probe/probe.js`, `notification-probe/probe.js` and `notification-probe/control/probe.js`
that `document` is defined** — the exact "wrong environment" failure the worker block's own comment
records having avoided. **Three worker fixtures would have stopped being told they are workers**,
in a configuration nobody was editing, with a green `pnpm lint` and no diff anywhere near them.

**So the fixture makes the split in its own layout**, and the environment is then matched by shape:
the three document scripts move under `documents/`, beside `probe.js` rather than among it. **A
second mixed fixture is then covered by existing rather than by remembering** — the same reason the
two blocks above are matched by shape — and a file moved into `documents/` needs no configuration
edit to be linted as a page.

**And the exclusion in the worker block is load-bearing rather than decorative, which was checked
rather than believed.** Flat config **merges** `languageOptions.globals` across every matching
config object, so a `documents/` block declared after the worker block would hand these files the
worker globals too — **the union back, reintroduced implicitly by a merge**, which is the least
visible way to reintroduce it and the reason `ignores: ["**/e2e/fixtures/**/documents/**"]` sits on
the worker block rather than being left to the later one. Both directions were run: removing the
`documents/` block reports `document is not defined` again, and **removing the `ignores` line makes
`importScripts` ACCEPTED in a document script** — which is the proof that the merge is real, and it
is a pass for the mutation and not a failure of it.

**That second arm was recorded as a survivor on its first run, and the survivor was the harness's
error rather than the configuration's.** It was written with L1's polarity — *this global must be
rejected* — when L2's claim is the opposite one: *removing this line changes the answer*. **An arm
with the wrong polarity reports a correct configuration as broken**, which is the most expensive
direction for a falsification harness to be wrong in, because the obvious repair is to delete the
configuration that was right.

**The relocation was then measured, not assumed.** The driver's `stageVariant` copied six file
names individually, so it learned the split a second time in a list whose job is catching strays; it
now copies the `documents/` tree. **Every value in the verdict is unchanged after the move** —
`answerable: true`, all nine arms observed, both hostname readings identical — which is the check
that a restructure of a green instrument is the one that matters.

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

**Rollback** is deleting the probe script and its fixture directory, reverting the two boundary
edits named in **D10**, and removing one list entry. **That is two files and a list, not one list
entry** — the sentence this replaces said "one list entry" and was true when written, and became
false the moment a quarantined probe's staged fixture reached a boundary rule. **A rollback plan that
was written before the change was applied is a prediction about the change's blast radius**, and the
prediction to distrust is the one that says *small*.

## Open Questions

- **Whether a side panel is subject to any suspension policy**, and therefore whether slice 2's
  "a persistent inbox beside the page" is a promise a panel can keep. Deferrable: no requirement
  depends on the answer yet, it does not change this change's approach, and it is a §4.6 row rather
  than a design branch — **unless** slice 2's polling design turns out to rest on it, in which case
  it is measured before slice 2 is proposed, by this same instrument.
- **Whether the panel and the worker can both be alive and both polling the same mailbox** — the
  shape §4.1.1's starvation finding makes worth asking before slice 2 exists. Also deferrable, and
  for the same reason: it is a §4.6 row now and a design decision at slice 2, not a blocker here