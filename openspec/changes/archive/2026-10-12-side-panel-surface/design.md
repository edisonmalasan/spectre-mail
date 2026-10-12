# Design

Ten decisions. Each one is a fork this change took **knowing** it took it, and each names the
alternative it rejected and the cost of that choice — because a design record that only says
what was chosen cannot be reviewed, and this repository's rule is that the cost of a decision is
part of the decision.

## D1 — The panel is a second document beside the popup, not a mode of it

`apps/extension/static/sidepanel.html`, built by the existing `vite build` as a second rollup
input, with its own React entry. **Not a query parameter, not a prop, not the same component
told which surface it is in.**

`vite.config.ts` already sets `emptyOutDir: false` precisely so the content script's build can
run after the popup's without erasing it — `AGENTS.md` records why. **The property this change
needs is the property that setting was added for**, so no build configuration changes and there
is no second build step to remember.

The alternative — one document told which surface it is — was rejected because it makes the
popup's own composition carry a branch for a surface that does not exist in the popup, and the
branch would have to decide every question differently: the popup's header is a copy control
for the address, the panel's header is the page's host. **A shared component with two headers is
two components wearing one file**, and `Popup.tsx` is already 568 lines of composition that
`Popup.test.tsx` holds.

## D2 — The message surface is extracted, and both surfaces compose it

`Popup.tsx` holds four private functions the panel needs identically: `MessageList`,
`OpenedMessageView`, `Codes` and `describeSender`, plus `fillSentence` and the `FillReport`
union. They move to `src/MessageSurface.tsx`; `Popup.tsx` and `Panel.tsx` both compose it.

**The alternative — the panel writes its own list — was rejected on the recorded defect this
repository already has.** The code controls carry a **decision table** (`in-page-fill`'s
requirements: not the top frame, a field that already holds text, exactly one empty candidate
versus several put to the user, prefer but never act). Two implementations of a decision table
drift, and the drift is invisible in a diff because each copy is locally correct. The same
reasoning put `CHANGED_DELIVERABLES` in one place rather than two, and the reason
`protocol.ts` is a module neither context imports.

**This is a refactor of the popup, and it is the change's largest risk to a count.** It will
move `Popup.test.tsx`, and the arithmetic is predicted in `tasks.md` rather than discovered at
the promotion. `Popup.tsx` must keep rendering exactly what it rendered — the extraction is a
move, not a rewrite, and the boundary rule that every class hook a client renders is selected
by a stylesheet is what catches an extraction that dropped one.

## D3 — The panel's current mailbox is the host's association, and the newest mailbox otherwise

The roadmap's context behaviour asks the panel to understand *"mailbox associated with current
hostname"*, and that is the whole premise of the milestone — *"make SpectreMail usable without
switching away from the active website"* — so a panel that showed this device's newest mailbox
on every page would be the product the milestone exists to replace.

So the panel resolves its mailbox the way `loadInsertableMailboxes` already resolves the one
the in-page affordance offers: **the mailbox this host was last used with, and the newest one
this device holds when there is no association or the association's mailbox is gone.** That
rule is stated once, in `packages/mailbox`'s caller-side helper, and both callers use it —
duplicating the rule is what D2 forbids.

**The alternative — always the newest — was rejected** because it makes the association
meaningless in the only surface that is always open beside the page, which would leave
`site-associations` recording something nothing ever reads.

## D4 — The host comes from the content script, and the answer is a hostname and nothing else

The panel asks the page's content script for its host over `chrome.tabs.sendMessage`. §4.6
measured that this reaches the script and returns its answer, and that `tab.url` is withheld
without `tabs`.

**Two sub-decisions sit inside this one and both are restrictions, not absences.**

**The answer is `location.hostname` and not `location.href`.** `site-associations` keys by the
exact hostname with no registrable-domain folding, and no requirement in this repository needs a
path. **A signup page's query string is where that page's tokens are** — a confirmation link, a
session id, a referral — so a panel reporting `href` would be holding one for every page it has
ever been docked beside, and storing none of it would be a promise about a data flow that did
not have to exist. The value is read from the browser's own global and never from the page's
DOM, so the answer requires no cooperation from the page and no permission to obtain it.

**The script answers or it does not, and "did not" must be reported rather than inferred.**
§4.6 measured the sharp half of this: a content script that **answers nothing** resolves, and a
resolution is indistinguishable from a script that is absent. **A panel that read an absent host
as an empty one would name no host and offer the newest mailbox as though it were the page's**,
which is the one wrong answer this milestone must never give. So the panel's host state is a
discriminated union over four observations — *answered with a hostname*, *answered with nothing
usable*, *refused because no script is there*, *not yet asked* — and only the first offers a
mailbox as being that page's.

## D5 — The panel follows a tab switch with `chrome.tabs.onActivated`, and no `tabs`

§4.6 measured that `chrome.tabs.onActivated` fires **to a context holding no `tabs`
permission**, and that the panel re-reported with reason `activated`. So the panel subscribes on
mount, re-asks the host, and re-resolves its mailbox — **with no reload, no new permission, and
no polling.**

**The alternative — re-reading on an interval, because `inbox.check` already exists and an
interval is simpler — was rejected on a measurement this repository has already paid for.** The
cadence is 5 000 ms while contents change, and §4.1.1 measured that concurrent alarms starve one
another. **A context-dependent line that only refreshes on a poll is stale by up to a full poll
interval at the moment the user switches tabs**, which is the exact moment the panel has to be
right.

`chrome.tabs.onActivated` is a new seam in `extension-platform.ts` rather than a direct
`chrome.tabs` call in the panel, **because that module is the single permitted reader of the
extension's platform global** and a boundary rule enforces it by name. A `tabs` reference
anywhere else fails the build — which is how "this panel holds no `tabs` permission" becomes a
property of the tree rather than a claim in a document.

## D6 — The panel is verified as a background tab, and whether that preserves the property is measured rather than assumed

§4.6 measured that Playwright adds **no `Page` for a docked panel**, and that opening
`sidepanel.html` as a tab runs the document and reads back — while `currentWindow` named **the
substitute's own tab**, so **the substitute as §4.6 measured it cannot test "which page am I
beside."**

**But §4.6 measured one arrangement and there is a second.** `in-page-fill.spec.ts` already
solves the popup's identical problem by opening `popup.html` as a second tab of the same window
and then **bringing the fixture page to front** — after which the popup's own
`chrome.tabs.query({ active: true, currentWindow: true })` names the fixture page. A panel
document opened as a tab and then **backgrounded** is the same arrangement, and by the same
mechanism its `currentWindow` should name the page that was brought to front.

**This is a prediction, and it is recorded as one.** `tasks.md` carries the measurement, and if
it is false the panel's context behaviour falls back to the unit tier alone and the limit is
stated in `AGENTS.md` rather than papered over. **A substitute that runs the document but cannot
reproduce the property it stands in for is a substitute for the rendering and nothing else**,
and the distinction has to be drawn at proposal time because after implementation the green run
makes them look identical.

What this substitute still cannot reach, and is not claimed to: **whether a person sees a
docked panel**, its width, how it is drawn, and **whether Chromium offers an entry point that
opens it at all** (D7).

## D7 — The toolbar button stays with the popup, and the panel's only entry point is unmeasured

`openPanelOnActionClick` is **not** set, and `action.default_popup` stays `popup.html`. The
spike's proposal decided this and nothing since has changed the reason: the popup holds the
entire verification workflow M10 slice 2 shipped — open a message, read its codes, `[ Fill ]` —
and taking the click would move it to a surface that did not exist.

**The consequence is a premise this repository cannot verify, and it is stated as one rather than
assumed.** With no `openPanelOnActionClick` and no extension action of its own, **the panel is
reachable only through Chromium's own side-panel entry point** — a platform affordance in a
browser UI, which nothing in this repository reads and which `docs/PROVIDERS.md` §4.6 did not
measure, because the spike opened the panel with `chrome.sidePanel.open()` from its own
launcher.

**A panel a person cannot open is exactly the fake surface the non-goals requirement forbids**,
so the premise is written down with the two routes that would discharge it, and the first route
is cheap:

1. **`chrome.sidePanel.setOptions({ openPanelOnActionClick: true })`** — but that is D7's own
   trade the other way, and taking it means moving the popup's workflow or accepting that the
   toolbar reaches the panel and the popup is reachable only from the extensions menu. **It is
   recorded as a real option rather than dismissed, because the alternative is worse.**
2. **A second entry point inside the popup** — a button that calls `chrome.sidePanel.open()`,
   which **must** be a user gesture and the popup button is one. This costs a control the popup
   does not have today, and it puts the panel one click further away than a menu entry is.

**Neither is built in this slice, and the reason is that building either would be deciding this
on a guess.** If apply's measurement finds the platform entry point absent, that is a recorded
finding and a follow-up, not a silent addition.

## D8 — No new token, no new motion, no new boundary rule

`packages/ui` stays at **38**, which is the measurement that says this commitment was kept. The
panel uses the popup's declared values; a panel that needed its own would mean visual surface no
capability describes. A rise is not a defect here — **it is evidence the slice added something
the design did not account for**, and `tasks.md` names the count so the promotion cannot quietly
carry it.

No new boundary rule, and this is a decision with a reason rather than an omission: **a rule
added where an instrument already exists is not coverage.** The properties this change
introduces are each already held —

| property | the instrument that already holds it |
| --- | --- |
| every manifest surface is shipped and every declared path resolves | `manifest.spec.ts`, and the new `extension-client` scenario read against the built `dist` |
| every permission is one a shipped surface uses | the modified non-goals requirement's manifest scenario |
| every class hook a client renders is styled | the existing stylesheet-coverage rule, reached by the panel's own hooks |
| every `*.spec.ts` is collected by exactly one browser suite | the existing collection rule, reached by the new panel spec |
| the extension's platform global is read in one module | the existing confinement rule, reached by the new `extension-platform` seam |
| a new message kind is narrowed on both sides | `protocol.ts`'s own narrowing table, which every kind in that file has |

**If apply finds a property with no instrument, that is a task written individually and named**,
rather than a rule added on suspicion.

## D9 — The website is not changed, and the panel's copy is a module rather than a derivation

The website's `Extension preview` region depicts the **popup**, and the boundary assertion that
guards it resolves every label the region declares against `POPUP_COPY`. **The panel existing does
not imply the website should depict it** — what a visitor is shown about a second surface is a
composition decision, and making it here would let a depiction change read as a consequence of a
panel change. `apps/web` therefore stays at **125**, which is how this change shows it added
nothing to the website at all.

`panel-copy.ts` exists anyway, for the reason `popup-copy.ts` states for itself in its first
paragraph and the one that is *not* the website: **a claim is reviewable beside the requirement
it satisfies, and a test can read what the product says without scraping rendered text for it.**
The panel says four things a requirement in this delta makes promises about — that it names the
host, that it says when it cannot, that it reports a failed provider, that it says when the
mailbox is gone — and four sets of words kept inline in a component are four claims a reviewer
reads in their markup context rather than beside their requirement.

## D10 — The panel and the popup may both be open, and each owns its own session

Nothing prevents a person having the panel docked and the popup open at once, and each builds
its own session over the same provider. That is **two sessions polling one mailbox**, and it is
accepted rather than prevented.

**Preventing it would mean a shared session across extension contexts**, which means
`chrome.storage` coordination, a lock, and a teardown problem — for a case where the cost is a
duplicate listing request that each surface asked for on its own. `mailbox-session` owns no
persistence and no cross-context coordination, and widening it to solve a case neither surface
is broken in is exactly the speculative abstraction this repository's style rules forbid.

**It is named because it is a fact about cost, and a fact about cost with no number attached is
an assumption.** Each session polls on the shared cadence, so the worst case is the cadence
twice — which §4.1.1's finding about alarms applies to alarms, not to two document contexts, and
**nothing in this repository has measured two sessions against one provider.** If a future
change needs that number it must be measured, and this sentence is where the absence is
recorded.
## Amendments recorded at apply (2026-10-11)

### A1 — D6's prediction was measured, and it held

`tasks.md` 2.1 required this measurement before section 8's cases were written, and it is recorded
here first because **a green run after implementation makes a substitute for the rendering and a
substitute for the property look identical.**

**The instrument** was a `.mjs` outside the repository (`%LOCALAPPDATA%\Temp\opencode\sps\d6-panel-context.mjs`,
deleted afterwards), because a measuring script left in the root is something every later `pnpm lint`
has an opinion about. It staged a **copy** of the built `apps/extension/dist` plus one probe
document, because the shipped manifest declares no `side_panel` yet and the arrangement under test
is "an extension document in a tab" rather than a docked panel. `channel: "chromium"`, both
`--load-extension` and `--disable-extensions-except` with an **absolute** path.

**What it measured, and the readings:**

| reading | value | what it is |
| --- | --- | --- |
| manifest `permissions` | `["storage","alarms","notifications"]` | **no `tabs`**, unchanged |
| `chrome.permissions.contains({permissions:["tabs"]})` | `false` | the platform agrees with the file |
| the panel document ran as a tab | `data-probe="ran"` | **task 2.3**, established before anything else |
| panel tab **active** -> `currentWindow` names | its **own** tab | **the control**, and it reproduces §4.6's reading exactly |
| panel tab **backgrounded**, fixture page frontmost -> `currentWindow` names | a **different** tab | **the prediction** |
| that tab, sent `spectre:d6-probe` | `{"kind":"notActedOn"}` | it carries this extension's **content script** |
| `tab.url` from the panel, and from the worker | `null` for **every** tab | §4.6's withholding **reproduces** |
| the reported id, over three frontmost pages | moved away, moved **back**, moved to the panel's own | it **tracks** the frontmost page |

**D6 held, and `tasks.md` 2.2's condition did not fire.**

**Why the fixture page was identified without its URL, and that is the part worth keeping.**
Without `tabs`, Chromium withholds `url` **and** `title` from every context — the service worker
included — so the first version of this instrument asked the worker which tab was the fixture page
and got `null` for all three. **That is §4.6's measurement reproducing, not a new finding**, and it
is why the identification is by property instead:

1. **`sendMessage` answers only on a tab with a listener.** The shipped fill handler replies
   `notActedOn` to a message kind it does not recognise, so the named tab **answers** while the
   panel document's own tab does not — which names the tab without reading its URL.
2. **The id was required to move.** A reader that reported a constant would satisfy the two arms
   above on its own, because "not my own tab" is also what a frozen reader says. Bringing a third
   page (`about:blank`) forward moved the id away, bringing the fixture back moved it back, and
   bringing the panel back moved it to the panel's own tab. **Three moves, two returns.**

**What this establishes, narrowly.** That a backgrounded extension document reports the window's
active tab, that the tab it reports is the frontmost page rather than its own, and that a message
reaches **that page's** content script from a backgrounded document **with no `tabs` permission** —
which is exactly the seam `tasks.md` 3.4 builds on and why **no new transport is added.**

**What it does not establish, and the list is the point.**

- **Nothing about a docked panel.** A docked panel has no tab at all. §4.6 already recorded that
  Playwright adds **no `Page`** for one, so the browser tier cannot address it at all. **The
  substitute stands in for the rendering and for the tab-context property; it stands in nothing
  about presentation**, and `AGENTS.md` carries that beside §4.6's own limit.
- **Nothing about whether a person sees a docked panel**, its width, how it is drawn, or whether
  Chromium offers an entry point that opens one (**D7**). **A panel a person cannot open is the
  fake surface the non-goals requirement forbids**, and that risk is unchanged by this measurement.
- **Nothing about whether the panel may name the host.** That the panel *reaches* the page and that
  the page *answers with a hostname* are two different measurements, and the second one is
  `tasks.md` 3.2's, written against a requirement rather than against this run.

### A2 — Two defects in the instrument, recorded because the first one inverted the verdict

**The polarity defect is the one worth carrying, and it is a shape this repository has recorded
before.** The instrument reported **D6 FALSIFIED** on a run where **every diagnostic line printed
`true`** and the composed verdict printed `false`. The cause was a variable named `movedToBare` and
assigned `bareTabId === namedTabId` — so the name asserted the opposite of the value — and the
verdict line consumed it **without the negation its own print line applied**. Repaired by renaming it
for what it measures (`stillNamedFixture`, with `movedAwayToBare` derived), which removes the
ambiguity rather than correcting one call site.

**An arm written that way reports a correct configuration as broken, and the obvious repair is to
delete the thing that was right** — so the finding is recorded beside the reading rather than the
reading being re-run until it came out green. The re-run was on the repaired instrument, and the
readings were identical before and after the repair.

**The second defect was a hang, and hangs report nothing.** The negative arm sent a message to an
`about:blank` tab and **its callback never fired** — twice, past a 420 s ceiling, with the verdict
never printed. Two repairs: the probe now races a page-side deadline so an unanswered callback
becomes a recorded outcome instead of a hang, and the **movement loop replaced the negative arm
outright** — three frontmost pages is *stronger* evidence than one negative, because it shows the
reader discriminating rather than merely differing once. A leaked `chromium.launchPersistentContext`
is what turns a failing run into a hanging one, so the context is closed in a `finally` and a
watchdog exits the process rather than letting the run be killed, which would also report nothing.

**And the arm that would have been kept was the weaker one.** The negative arm was written to prove
the `sendMessage` discriminator separates two tabs; it is the arm that hung. **The arm that
established the property — the movement loop — is the one that survived**, and the note is here
because the reasoning for dropping an arm is as much a part of the measurement as its output.

### A3 — Every scenario in both deltas, and the case that carries it (`tasks.md` 6.1, 6.2)

**The rule this section exists to satisfy:** a scenario with no named case is an omission, and an
omission is recorded rather than left for a reader to infer from the case count. **Two are recorded
below, and they are recorded as omissions rather than papered over with a case that cannot fail.**

#### `extension-client` — *The extension declares its non-goals as requirements rather than leaving them absent* (MODIFIED)

| scenario | case |
| --- | --- |
| The manifest is read | **RECORDED OMISSION — see below** |
| A later milestone adds a declared surface | **RECORDED OMISSION — see below** |
| A declared path resolves to nothing | `e2e/manifest.spec.ts` — *"every document path the manifest names is a file this build emitted"* (new) |

#### `extension-client` — *The side panel renders the mailbox this device holds, beside the page rather than in place of it* (ADDED)

| scenario | case |
| --- | --- |
| The panel is opened | `src/Panel.test.tsx` — *"lists what the last check found and opens the one that is pressed"*; `e2e/side-panel.spec.ts` — *"lists messages and shows the code in one a person opens"* (new) |
| This device holds no mailbox | `src/Panel.test.tsx` — *"offers to create when this device holds nothing, and names no address as being that page's"*; `e2e/side-panel.spec.ts` — *"offers to create when this device holds nothing, and names no address as its own"* (new) |
| A message is opened in the panel | `src/Panel.test.tsx` — *"shows the codes and links of a message opened in the panel"*; `e2e/side-panel.spec.ts` — *"lists messages and shows the code in one a person opens"* (new) |
| A provider is failing | `src/Panel.test.tsx` — *"reports a provider failure rather than an empty listing"* |
| The mailbox is gone | `src/Panel.test.tsx` — *"says an address that no longer receives mail rather than reporting an empty inbox"* |
| Several mailboxes are held | `src/Panel.test.tsx` — *"names the mailboxes this device holds, and only mailboxes it holds"*; `e2e/side-panel.spec.ts` — *"names the mailbox this device last used on that host, and the other one it holds"* (new) |

#### `extension-client` — *The side panel names the page it is beside, and reports when it cannot* (ADDED)

| scenario | case |
| --- | --- |
| The panel is opened beside a page | `src/Panel.test.tsx` — *"names the host the page beside it reported, and the mailbox last used on it"*; `e2e/side-panel.spec.ts` — *"names the host of the page beside it, and that host is the page's own"* (new) |
| The active tab changes | `src/Panel.test.tsx` and `e2e/side-panel.spec.ts` — *"asks the newly active tab again when the tab changes, with no reload"* |
| No answer arrives | `src/Panel.test.tsx` — *"says it cannot name a page that answered nothing, and offers no mailbox as that page's"* |
| The panel is beside a page this extension does not reach | `src/Panel.test.tsx` — *"distinguishes a page that ran and reported nothing usable from one that never answered"* and *"says it cannot name a page this extension does not reach, and the rest keeps working"*; `e2e/side-panel.spec.ts` — *"says it cannot name a page this extension does not reach, and the rest keeps working"* (new) |
| The manifest is read for the panel's host | `e2e/manifest.spec.ts` — *"requests no permission in order to name the page beside the panel"* (new) |

#### `in-page-integration` — *A code reaches the page without a permission this extension does not already hold* (MODIFIED)

| scenario | case |
| --- | --- |
| The manifest is read after this change | `e2e/manifest.spec.ts` — *"requests no permission in order to name the page beside the panel"* (new) |
| The page refuses cross-origin requests | `e2e/in-page-create.spec.ts` — *"reaches the provider from a page whose own policy forbids cross-origin requests"* (pre-existing, unchanged) |
| The page is asked for nothing | `e2e/in-page.spec.ts` — *"the page's own queries cannot see the control"* and *"leaves nothing behind once it has acted"* (pre-existing, unchanged) |

#### `in-page-integration` — *The content script reports the host it is beside, and nothing more of the page* (ADDED)

| scenario | case |
| --- | --- |
| This extension asks the script for its host | `src/content-script-host-context.test.ts` — *"answers the host request with its own location's hostname"* (new); `e2e/side-panel.spec.ts` — *"names the host of the page beside it, and that host is the page's own"* (new) |
| The script cannot answer | `src/content-script-host-context.test.ts` — *"refuses rather than answering a request that is not this one"* (new) |
| The page is asked for nothing | `src/content-script-host-context.test.ts` — *"is given no document, so reading the page's DOM is not possible here"*, *"reads hostname and no other part of the location"*, *"does not touch the document this module is running inside"*, *"dispatches no event into the page to answer"* (new) |
| The manifest is read for a host request | `e2e/manifest.spec.ts` — *"requests no permission in order to name the page beside the panel"* (new) |

#### The two omissions, stated rather than papered over

**1. *"The manifest is read"* — *"every surface it declares SHALL be named by a requirement in this
specification."*** No case carries this, and **no case can carry it before the sync stage.** The
requirement is about `this specification`, so an assertion would have to read the delta file that
sync is going to promote from — a test that passes because a delta is complete and fails because a
delta has a requirement missing is a test of the planning artifact, not of the product, and it would
go red the moment a later milestone added a surface and no delta came with it. **The instrument is
`openspec validate` plus the sync-stage diff review, and both are run in this change** (§9.5). The
change's own contribution to the requirement is the surface: this delta names the side panel in two
requirements, and `manifest.spec.ts`'s *"names a side panel, and the document that build emits"*
holds the half that is about the build.

**2. *"A later milestone adds a declared surface."*** This scenario is an **amendment clause**: it
says what the requirement means when a future change adds a surface, and it is carried by the MODIFIED
delta block itself. There is no runtime event to stage, because the event is *another change*
repeating what this one does. **Naming no case is the correct answer, and saying so is what keeps a
reader from counting 23 of 25 and inferring two were forgotten.**

**A count that says 23 is therefore a count of scenarios with a runtime case, and this table is why
that number is not 25.**

### A4 — `tasks.md` 5.3 is a MOVE, and it was proved behaviourally rather than argued

**The claim is that `MessageSurface.tsx` is `Popup.tsx`'s message half *moved*, so a repair to one
cannot silently diverge from the other.** "Moved" is the kind of word a diff appears to settle and
does not: the two files are textually different after any reformatting, and a reader asked to verify
the move by reading is being asked to do the thing a tool does.

**The instrument** was outside the repository (`%LOCALAPPDATA%\Temp\opencode\sps-move\`, deleted
with the rest). `HEAD`'s `Popup.tsx` was copied verbatim to `__baseline-popup.tsx` — a **rename and
nothing else**, so the copy carries `HEAD`'s bytes — and both components were rendered side by side
across a **15-state matrix** plus one interaction that presses a control. **16 of 16 rows produced
byte-identical `container.innerHTML`.**

**And the instrument was falsified before it was trusted**, which is the only reason the 16 mean
anything: mutating `{mailbox.address}` to `{mailbox.id}` in the **baseline** turned **10 of the 16
rows red** and left **6 passing** — the six being the states that render no address at all. **An
instrument that reports 16 of 16 identical and would also have reported 6 of 6 identical** measures
nothing, and this is the recorded shape one more time: *the emptiness of a sweep and the sameness of
a comparison look identical from the output.*

**The instrument lives outside the repository so it cannot contaminate §9's counts** — a temporary
`.tsx` under `apps/extension/src/` would have been collected by the Vitest globs and would have
appeared in `pnpm test` as a file no requirement describes.

### A5 — D3 misnames the helper, and the name is what a reader will look for

**D3 says the resolution rule lives in *a shared helper*, and that is the rule; the helper is
`resolveForHost`, and D3 never gives its name.** Written out, D3's rule is *"one helper, two
callers"* — `Panel.tsx` and `content-script/controller.ts` — and both call the **same export** of
`resolve-for-host.ts`. **One spelling of the rule, so the panel and the in-page control cannot
disagree about which mailbox a host was last used with**, which is the entire reason D3 asks for a
helper rather than for two implementations that agree today.

**The measurement note that belongs with it:** an earlier grep for callers used a `**/*.tsx` glob and
found **one** call site, because the second is in a `.ts` file. **A caller search whose glob
excludes the extension the second caller is written in reports a shared helper with one caller**, and
that is a finding about the search rather than about the code. Both globs are required.

### A6 — Two names the type does not force, and why they are what they are

**`busy: boolean` became `busyOf(mailbox)` and `copyOf(code)`.** Both surfaces ask *"is this one
thing already doing something?"* and a boolean parameter says yes, which invites a caller to compute
it and a reader to check it. The functions answer it where the answer lives, and the panel and the
popup pass the same object rather than two parallel booleans that can disagree.

**`pageLocation`, not `location`.** The boundary rule `keeps storage, cookies, and the URL out of
every client` forbids a client naming the bare identifier `location`, which is right. **The rename is
not what holds the property and neither was the rule**: a *property* access was already invisible to
that lexical pattern, because its lookbehind excludes `location` preceded by a dot — which is how
`controller.ts` reads `watched.location` today with no exemption. **What holds it is the
`Pick<Location, "hostname">` in the parameter type**, so *"reads no property of the page's DOM"* is a
property of the shape of the function rather than a promise about its body. **The name is still
worth changing, for the reason the file says: naming a parameter after the global it happens to carry
reads as though the module reached that global, and it does not.**

### A7 — The suite's own first run found a real defect, and it is recorded here rather than as a green run

`Panel.test.tsx`'s first execution was **16 of 22 red**, and every red had the same cause:
`Panel.tsx` read `state.opened` directly, so a session with no message opened produced
`"opened" in state` answering `false` and `state.opened` answering `undefined` — and the panel
rendered a message section over nothing. **The repair is the two lines the popup already had**
(`const opened = "opened" in state ? state.opened : null;` and an `opened !== null` guard), taken
from `Popup.tsx` rather than invented, because `MessageSurface.tsx` is that popup's half and the two
surfaces must not differ on a guard.

**It is recorded because the defect was found by the tier that could see it and by nothing else, and
because the repair is one this change's own §7 later re-falsified** — see A9, third item, where
removing the `opened !== null` half of the guard leaves the suite green, which means **the guard is
held by an assertion this change had to add after the mutation rather than before it.**

### A8 — A recorded tool hazard in this repository is wrong, and it is corrected here rather than left to mislead the next reader

`AGENTS.md` carries, in its browser-tier hazard list, that **`chrome.tabs.sendMessage` to a tab with
no content script never calls back**. **Measured on this change: it does.** A `sendMessage` to a tab
holding `about:blank` — a document this extension injects nothing into — returned in about **1 ms**
with `stage: "called back"`, `waitedMs: 1`, and `reply` **`undefined`**. `extension-platform.ts`
resolves only from its callback, so a platform that stayed silent would leave the panel asking for
ever.

**This matters beyond the instrument, because it is what makes a requirement arm reachable.** The
*No answer arrives* scenario — and the distinction between *a page that ran and reported nothing
usable* and *one that was never answered* — is **only observable if the platform calls back with
nothing.** A platform that stayed silent would make those two indistinguishable and the four-way
`HostReading` union untestable from a real browser. `e2e/side-panel.spec.ts` uses an `about:blank`
tab for exactly this reason, and the reason is measured rather than chosen.

### A9 — The falsification pass found three defects in assertions this change wrote

**Twenty-seven deliberate violations, twenty-seven caught, every restoration SHA-256 byte-identical,
`dist/` rebuilt from restored source, and the instrument outside the repository and deleted.** Three
arms were green on the first run and all three were read before being filed, and **all three were
real gaps rather than broken mutants:**

**1. *"Dispatches no event into the page to answer"* could not observe the most obvious dispatch.**
Its listener was on `window`, in the capture phase, and `new Event(...)` dispatched on `document`
**does not reach `window`** — a non-bubbling event dispatched at the document has no propagation
path left to travel. **The instrument was a capture listener on one node of the page, claiming to
cover the page.** It now listens on `window` **and** `document`, and its positive control dispatches
**once per route the reader claims to cover**, each asserted individually, because one probe
satisfies the reader for whichever route happens to work and says nothing about the other three.

**2. *"Asks the background context to create rather than contacting a provider itself"* asserted a
count.** Sending the worker a reconcile request instead leaves exactly one message in the log, so
`toHaveLength(1)` and the no-delivery assertion both passed while the panel asked for the wrong
thing entirely. **The title named *"to create"* and the case carried *"to the background".** It now
asserts the request kind, **spelled by hand rather than imported from `protocol.ts`**, because an
assertion built from the constant under test moves with it.

**3. *"Lists what the last check found and opens the one that is pressed"* asserted only what a press
does.** Removing the panel's `opened !== null` guard left a case with no message open rendering the
message section, and every assertion still passed — because the assertion it had was about the press.
**A press makes its own effect true, so the state before it has to be asserted on its own.** Both
sides of the press are now asserted.

**And one green was a broken mutant, recorded rather than counted.** The arm offering a mailbox
while no page has been named was first declared against the browser case that stages **a device
holding nothing**, where the mutant's `held.length === 0` guard is exactly what the fixture
satisfies — **the two versions are logically identical on that input, and green is correct.** The arm
was re-declared against the case that seeds two mailboxes and switches to an unreachable page, which
is the same requirement staged where the mutation is observable, and it is caught there. **A survivor
means the assertion did not catch this, never that the assertion is too weak, until the mutant has
been read and shown to be the thing it claims.**

**And three attributions were wrong rather than three assertions, which is the distinction this
repository keeps drawing.** The discriminant arm was declared against the narrowing table and was
caught by three cases in the *same* `describe` that spell the kind **by hand** — because **the table's
expectation is derived from the constant under test, so a uniformly renamed discriminant satisfies it
perfectly.** That is not a gap in the table: the table's claim is that no two guards accept each
other's messages, and a uniform rename does not break that. **Two arms were re-declared against the
titles the runs actually named**, and both failures were assertions about the same property.

**The harness was wrong three times before it measured anything, which is the record this file keeps
making.** `browserReport` returned a bare `caught` on any non-zero exit, so the attribution check had
no title to compare against and **filed five genuine catches as `wrongcatch`** — a classification the
instrument could not support, which is worse than none. The permission arms' mutation sites did not
exist because `prettier` keeps `permissions` on one line, so both were filed `noop` and skipped
rather than silently half-applied. And a **PowerShell console codepage rendered this change's own
`U+FFFD`-free em dashes as mojibake**, which cost a check: the files were verified byte-clean
(`U+FFFD count: 0`, em dash count 9) rather than assumed corrupted. **A display that mangles a file
is not a file that is damaged**, and the instrument that says so is four lines.

### A10 — `apps/web` carries a forbidden-word list this change has made stale, and it is reported rather than fixed

`apps/web/e2e/sections.spec.ts` asserts that the extension preview "names no capability the
extension has declared absent", and its forbidden list contains **`"side panel"`** and `"side bar"`.
**This change makes the side panel a declared surface**, so the list is now stale in the direction
that reads like a guarantee: a reader would take the case as evidence the extension still declares no
side panel.

**It is reported rather than repaired, and the reason is scope rather than difficulty.** `apps/web`
is **zero files** for this change — the count is required to stand at 125 and it does — and editing
a website spec to accommodate an extension change would be a change no requirement in either delta
asks for. **The repair belongs to whichever change next touches `extension-preview`'s depiction**, and
until then this sentence is the record. **A forbidden-word list that has gone stale is not a silent
defect; a stale list with nobody reading it is.**

### A11 — `tasks.md` 6.4: the two amended blocks read against the promoted specs, and one phrase narrowed

**The amended blocks were read in `openspec/specs/`, not in this delta**, because that is the point
of the task: a delta that says the right thing and a promoted spec that says something else is the
same defect as an implementation that says something else.

**`extension-client` — the non-goals requirement.** The promoted text still reads *"The extension
SHALL NOT declare a side panel, a one-time-code copy control, or a verification-link control in this
milestone"*, and the delta replaces that list with the class. Against the code:

| promoted/delta clause | the code |
| --- | --- |
| declare no surface it does not ship | four surfaces declared — popup, service worker, content script, side panel — **all four ship**; no `options_ui`, no `devtools_page`, no `chrome_url_overrides` |
| every document path resolves to a file this client builds | `manifest.spec.ts` — read against the **built `dist`**, with `expect(declared.length).toBe(4)` so a manifest that declared nothing cannot satisfy it |
| every surface named by a requirement in this specification | the side panel is named by the ADDED requirement below; **the omission recorded in A3 is this clause**, and the instrument is `openspec validate` plus this read |
| no permission no shipped surface uses | `storage` (content script, popup, panel), `alarms` (worker), `notifications` (worker), `sidePanel` (panel) — four permissions, four shipped surfaces |

**`in-page-integration` — the permission requirement.** The promoted spec's manifest scenario reads
*"it SHALL request no permission this extension did not already request"*, full stop, and the delta
generalises it. Against the code: **the manifest gained exactly one permission and it is not for
delivering a code** — `sidePanel` exists so the surface exists, and the delivery path gained nothing,
which is the requirement's own test. `host_permissions` is untouched, so *"the declared host reach
SHALL remain the reach its shipped surfaces use"* holds literally.

**One phrase in the delta is narrower than it reads, and it is recorded rather than edited.** The
2026-10-11 amendment says the panel is *"the only place a user mid-signup can read a code and put it
in the field beside it, which is the roadmap's target experience **verbatim**."* The second clause is
true: `docs/ROADMAP.md`'s target-experience diagram is a registration page's verification-code field
beside a panel showing `Verification code`, `583291`, `[ Copy ] [ Fill ]`. **The first clause is also
true — the copy control and the link list are panel-only optional props, so `Popup.tsx` renders no
copy button and no anchor at all.** What is *not* verbatim is the **wording**: the panel says `Read`,
`Copy code 493028` and `Fill in code 493028`, where the diagram says `Copy` and `Fill`. **"Verbatim"
attaches to the experience and not to the strings, and a reader who takes it as the latter would
start a change rewriting `PANEL_COPY` to match an ASCII diagram.**

### A12 — `tasks.md` 8.5 is discharged by an instrument that already existed, not by a new case

**The task names "the same class-hook sweep the other extension specs run". Read, the other extension
specs do not run one** — `popup.spec.ts` runs a token sweep (*"names no colour, radius, spacing step,
type size or duration literally"*), which is a different property about a different file.

**The instrument for this property is `tests/architecture/boundaries.test.ts`'s `unstyledClassHooks()`,
which reports a hook as `<file>: \`<hook>\` is rendered but no stylesheet selects it`.** It scans
`apps/*/src/**` for class names a component renders and requires a stylesheet to select each, so it
covered `Panel.tsx` and `MessageSurface.tsx` from the moment those files existed. **It earned its
place on this tree rather than in theory**: `in-page-fill` recorded that it failed on a shipped tree
for two hooks a client rendered and no stylesheet named, and **no test in this repository would ever
have said so.**

**So 8.5 is satisfied by that rule and by no new browser case, and the boundary count standing at 53
is the measurement that says so** — seven panel hooks were styled in tokens the popup already used,
and the count did not move because the property already had an instrument. **A rule added where an
instrument already exists is not coverage**, and §9.4's arithmetic names the count as unmoved for
exactly this reason.

### A13 — The falsification pass caught **two of its own catches**, which is the finding worth the most here

**The first round's tally was `27 of 27`, and it was wrong for two arms.** §9's `pnpm verify` then went
red three times running on the same two assertions, and that is how the two were found: **the clean
tree was not clean, and a permanently-failing case makes every mutation of its own file look caught.**

**The two were `U08` and `U15`.** Both had been filed `caught`. Both were caught by a case that was
**already red before the mutation was applied**, so neither catch was evidence about a mutation at
all. **A catcher that was failing before the mutation is not a catcher** — and it is the recorded
shape one more time, in a direction this repository had recorded from the other side (*"a mutation
that cannot compile is not evidence about an assertion"*). **Here a mutation that was never measured
was filed as a catch**, which is the same defect wearing a different hat.

**The cause of the two reds was a repair I made in the wrong place, and both repairs were themselves
wrong before they were wrong:**

**1. *The absence assertion went into a case whose fixture cannot satisfy it.* `U15` removed the
panel's `opened.kind !== "none"` guard. I added `expect(queryByTestId("message-list")).toBeNull()` to
*"lists what the last check found and opens the one that is pressed"* — and that case's fixture
**already has a message open**, so the assertion was false on arrival.** I had also read the wrong
half of the guard: the mutation removes the `kind` check, not the `!== null` one, so even a correctly
placed assertion on that case's state would have been satisfied.

**2. *The assertion then pointed at the wrong element, twice.* `message-list` is the **inbox
listing**, not the opened message — so asserting it absent asserts that a working panel is broken.
And once moved to a correct case, the remaining assertions (`code-list`, `link-list`) **still could not
see the mutation**, because `OpenedMessageView` renders **nothing at all** for the `none` variant: no
codes, no links, no subject. **The mutation's only observable is an empty heading inside a region.**
**The guard controls the region, so the region is what is now asserted** — `data-testid="panel-message"`
on the section, and the case stages both halves of the guard (`opened` absent, and `opened.kind ===
"none"`).

**3. *The event instrument could only ever see one event type.* `U08` dispatches
`new Event("spectre-host-read")` into the page. `U08`'s case registered a capture-phase listener for
**one hard-coded type**, so the mutation was invisible — and my first repair, **adding a second
capture-phase listener on `document`**, could not catch it either, for the same reason.**

**That is the fifth recorded instance of *an assertion narrower than the rule it documents*, and the
first one in a case whose entire subject is being an instrument.** Worse, the repair **broke the
case's own positive control**: a document-targeted dispatch is seen by *both* listeners, so the control
recorded two entries and failed — which is why `U08` then read as `caught`. **The broken control
caught the mutation that the broken instrument missed.** Two wrong things, one of which hid the other.

**The instrument now patches `EventTarget.prototype.dispatchEvent`**, because the claim is about
**every** event type rather than about a list somebody wrote down, and **the positive control
dispatches three distinct types across three routes, each asserted individually.**

**4. *And the patched prototype still missed a route.* In jsdom `window` carries an **own**
`dispatchEvent`, so it does not resolve to `EventTarget.prototype`'s — the first run of the repaired
case recorded the document probe and the element probe and **silently lost the window one**. A reader
that patched the prototype reported a route it claimed to cover while observing nothing there.
`window.dispatchEvent` is patched and restored too, **and the restoration is asserted rather than
assumed**, because a patch left in place makes every later case in this file report dispatches it
never made.

**The whole unit set was then re-run against a tree verified green first** — `1182 passed (61 files)`
before any mutation — and **19 of 19 arms caught with every restoration SHA-256 byte-identical.** The
19 re-run is the table; the 27 is not.

**And `U15` needed a fifth attribution correction** after that, because the arm named a case the
mutation does not touch. **Five attributions were wrong and no assertion was, once the whole set was
re-measured on a green tree** — which is the distinction worth keeping from this round.

### A14 — Three gates failed on things only they can see, which is the recorded reason each of them exists

**`pnpm typecheck` — `e2e/manifest.spec.ts`.** Every browser case in that file passed while `tsc`
reported `TS2352`: the `content_scripts` element was typed `{ js: string[] }[]`, and two readers cast
it to two different tuple types. **Widening it to an array broke one of those casts**, so the repair
was to describe **both** keys the file reads (`{ js: string[]; matches: string[] }[]`) and delete both
casts. **A second failure in the same repair is the recorded `noUncheckedIndexedAccess` shape**:
`expect(x).toBeDefined()` does not narrow `x | undefined`, so a reader that throws is the right shape
for a manifest that declares nothing.

**`pnpm lint` — `react-hooks/set-state-in-effect` on `Panel.tsx`.** The effect that asks the page for
its host calls `resolveThePage()`, which reaches `setReading`, and the rule reports the bare call.
**The repair is the async IIFE this repository already uses for exactly this** — `Popup.tsx`'s boot
effect and this file's own boot effect both use it — and the reason is recorded beside it: **nothing is
deferred that was not already deferred**, because `resolveThePage` awaits the page's answer before it
touches any state. **The two forms differ in how the rule reads them and not in what the panel does**,
and saying so is what keeps the repair from looking like a trick played on a linter.

**`pnpm lint` — three `react-refresh/only-export-components` warnings** on `Panel.tsx`,
`MessageSurface.tsx` (twice). All three exports had **no consumer outside their own file**, so they
are now module-private. **`tasks.md` 5.3 names `describeSender` and `fillSentence` as part of what
moved into `MessageSurface.tsx`, and it does not require them to be exported** — the move is about
where the code lives, not about what it publishes. **`pnpm lint` exits `0` either way** (a warning is
not a failure, and the recorded precedent is `in-page-address`'s three fixture warnings), so this is
tidiness rather than a gate — recorded because it is a *new* warning count and the file's rule is that
a new warning is not nothing.

**`pnpm format:check` — two files.** `manifest.spec.ts` and `side-panel.spec.ts`, both edited after
Prettier last ran over them. **The count of files Prettier rejects is a count of edits made since
Prettier last ran, not a fixed property of the change.**

### A15 — A browser run went red once in thirty-four, and **my own block instrument threw away the only evidence**

**The block reported `passed=9 failed=1 harness-error=0`, at `website=40` and `extension=78` on every
run that measured anything, with a SHA-256 fingerprint over 478 source files unchanged across the
window.** The single line it kept from the red run was
`Error: expect(received).toBe(expected) // Object.is equality`, `1 failed`, `exit 1`.

**Then twelve further runs in a dedicated re-run loop and then a fresh ten-run block were green: 22
green against one red, and the red was never reproduced.**

**The instrument is the finding.** The first version of `browser-block.ps1` printed each run's
status, its tier-summary count and a **three-line grep of the red run's output** — and then the loop
moved on. **A tally is not a diagnosis.** Because the red did not reproduce, that one line is now
the whole record, and it names a matcher (`toBe`) without naming a spec or a case, which is the
recorded shape of *"a recorded observation about the wrong test is worse than none"* one level up.

**The block now writes every run's full output to a file and keeps the red ones**, which is the
repair — **and it is the fourth recorded instance of the same defect in this repository's measuring
instruments, in a script whose entire job is to report a rate.** Three of the four are recorded in
`AGENTS.md`: a fingerprint that could not tell a source file from a Playwright profile, a block whose
tally and exit code were two outcomes wearing one number, and a runner that counted a run which had
never reached Playwright. **A measuring instrument is not a shipped file, and it is not exempt from
the properties the shipped files are held to.**

**What is claimed and what is not.** Claimed: on this tree, over 34 consecutive full-suite runs, 33
were green at `website=40` / `extension=78` and **one was red, unreproduced, with its diagnosis
discarded by the instrument**. Not claimed: that the suite is stable. **One red in thirty-four is a
rate and not a fact about a case**, and the honest position is that a defect is suspected in this
tree and unidentified — **which is a different position from "the suite is flaky", because that word
names a cause and this names none.**

**And the recorded precedent is the reason this is filed rather than dropped.** `AGENTS.md` carries
run `37446193779`, red on the drift reporter, reproducing locally about **one run in three**, and
carries the sentence *"a passing run reports no history, so nothing in its own output could have said
otherwise; the only instrument that could catch this is re-running"* — and the sentence beside it,
*"30 consecutive local runs did not find a defect that CI found on a slower machine"*. **Thirty-four
runs is past the point at which the previous defect would have been caught and well short of the point
at which a one-in-thirty-four rate is characterised rather than counted.**

### A16 — A second red in the same shape, and the shared cause is my own instruments

**`pnpm verify` went red once in five** on this tree — `Test Files 1 failed | 60 passed (61)` — and
the command's own filter printed the summary **without the failing file**. **Fifteen subsequent unit
tier runs were green**: one bare `pnpm test`, one `pnpm verify`, and then a ten-iteration loop that
writes every run's full output to disk. The red was never reproduced.

**It is the same defect as `A15` and the same cause, which is what makes it worth a second entry
rather than a footnote.** Three of this session's measuring instruments printed a *count* where they
should have printed a *name*: the ten-run browser block kept a three-line grep, the `pnpm verify`
wrapper filtered on summary patterns, and the unit-tier loop was only written after the red. **The
instrument is not a shipped file and it is not exempt from the properties the shipped files are held
to** — and in both cases the discarded evidence was discarded by a script written *specifically* to
keep evidence.

**What is claimed.** On this tree, in this session: **one red in five `pnpm verify` runs and one red
in thirty-four full-suite browser runs, neither reproduced, neither identified, both with their
failing title discarded by the instrument that saw them.** What is *not* claimed: that either suite
is flaky. **"Flaky" names a cause and neither red has one**, and this repository's recorded position
is that a defect is *suspected and unidentified* — which is a weaker and more accurate claim than
"flaky" and a stronger one than "green".

**One hypothesis is recorded and explicitly not measured**, because naming an unmeasured cause is the
recorded defect in the other direction: the browser red and this one both followed long stretches of
Playwright runs on the same machine, so *machine load starving a timing-sensitive assertion* is
available as an explanation. **Nothing was measured that would support it** — no process listing was
taken during a red run, because no instrument here was in a position to take one. **A hypothesis kept
because it is available is the same shape as a correlation kept because it is convenient.**

**And the practical consequence is stated rather than left for the next reader: a future red on this
tree should be captured with the whole run's output, not with a summary line**, and the two loop
scripts under `%LOCALAPPDATA%\Temp\opencode\` are deleted with the rest of the instrument rather than
kept for that purpose — **which is the recorded rule that a measuring instrument is not a shipped
file, applied to the instrument that would have caught the next one.**

### A17 — Creation beside a page the panel cannot name, and the option that was rejected

**The orchestrator decided this, not the implementation.** I had left it open deliberately: the delta's
clause was *"the rest of the panel SHALL continue to work"*, which names nothing, and a surface that
renders nothing operable is the fake-UI defect this repository treats as structural — so it was a
product decision rather than one to be taken silently beside the code.

**What was implemented.** The create control is gated on `shown.kind !== "named"` rather than
`=== "none"`, so it is offered in both unnamed-page arms; the mailbox itself stays withheld; and
`PANEL_COPY.noMailboxHeld` **stays gated on `none`** and was deliberately not widened, because
beside a page this panel cannot name *"this device has no address yet"* is **false** — the device may
hold one, several, or none, and the fault is that *this panel* cannot read which. The `held` list at
`held.length > 1` is independent of `shown.kind` and was left alone.

**Why the control is offered there, and it is not the same claim as the hazard.** The requirement
withholds a mailbox from being offered **as being that page's**. A mailbox created while the page is
unnamed is **recorded against no host at all**, so offering one is not the wrong-context hazard the
requirement guards against — and the panel is not going to guess a host for it later.

**The option rejected, so a reviewer can disagree with the decision rather than re-derive it:**
withholding creation beside an unnamed page — gating the control on `none` exactly as the
neighbouring clause is gated. **It was considered because it is the more conservative reading of a
hazard-clause**, and rejected because it produces a surface that can do nothing at all.

**And one consequence recorded rather than left implicit.** Creating beside an unnamed page does not
change `shown.kind`, so **the control stays offered afterwards** — a person may want a second address,
and nothing about that page became knowable. **No requirement says whether it should**, so this is a
statement of what the implementation does rather than a claim that it is right.

**The copy is a separate string, and the reason is that the two are different claims.**
`PANEL_COPY.createForHost` may leave the host unsaid because the host is named three lines above it.
There is **no host to leave unsaid** beside an unnamed page, and a sentence reading as though there
were would be the same defect in the other direction — a panel inventing a host for a page it just
said it could not identify. So `createForUnnamedPage` says what the address *is* rather than what it
is *for*: *"Create an address, not tied to that page."*

**The sibling scenario was closed too, and that was the orchestrator's second decision.** The delta
carried **two** unnamed-page scenarios — *"No answer arrives"* (`unanswered`) and *"The panel is beside
a page this extension does not reach"* (`refused`) — and this repair amended **only the second**, the
one the orchestrator named. **I reported the asymmetry rather than widening the edit**, and the
orchestrator decided the second one closes as well.

**Why it is the same hole rather than a stylistic preference.** `shown` returns
`{ kind: "unnamed" }` for **every** reading that is not `named`, so both reasons reach **one branch**
and creation is gated on `shown`. A promoted spec that mandates creation in one scenario and is silent
in the other **permits an implementation that offers creation for a refused page and withholds it for
an unanswered one — and the panel cannot make that choice.** **Silence is not prohibition**, so the
spec would read as a permission, describing a distinction the product does not have. Both scenarios now
say the same four things about creation.

**The host *line* is where the distinction lives, and it is kept.** `cannotNameHost` and
`noScriptHere` stay separate strings, because *"ran and had nothing usable"* and *"never answered at
all"* are genuinely different faults — §4.6 measured that a content script answering nothing
**resolves**, so a refused answer and no answer at all are not the same event. **What does not differ
is what the panel may offer beside either**, and the two scenarios remain separate because what the
panel *says* differs even though what it *offers* does not.

**And one case holds both arms at once, because a case per arm would let one rot.** *"Offers creation
beside either kind of page it cannot name"* mounts both readings in a single test and requires the two
host lines to **differ**, so the loop cannot pass by running one fixture twice. Its falsifier is
recorded in A18: reintroducing the distinction the amendment forbids — gating on
`reading.kind !== "refused"` — is caught by that case **and by nothing else in the group**, because
every other case in it mounts only the unanswered arm.

### A17b — The two-arm case, and why its falsifier is the amendment's whole content

**Gating the create control on `reading.kind !== "refused"` — reinstating exactly the distinction the
amendment forbids, so a refused page loses the control while an unanswered one keeps it — is caught by
*"offers creation beside either kind of page it cannot name"* and by nothing else in the group**,
because every other case in it mounts only the unanswered arm. **A case per arm would have left that
defect invisible**, which is why the delta hole and the case are closed in the same pass rather than
the case being added after the amendment had been reviewed.

**The case's own control is falsifiable too.** Making the page that answered nothing *report* as a
page with no script collapses the two readings into one, and the case must fail — **on the per-arm
wording**, which is the assertion saying the arms are genuinely different, rather than on the
inequality alone. **That arm is not this case's sole holder**, though: it also fails a pre-existing
case that names the distinction directly, so it is recorded as a second catcher rather than credited
as the only one.

**Two smaller findings from writing it, each recorded because it would have produced a confusing red
rather than an honest one.** The two arms need `cleanup()` between them — **two `render` calls in one
test leave two containers in the document**, `screen` queries across all of them, and the second
`findByRole` fails with *"found multiple elements"* rather than with anything about the product;
`afterEach(cleanup)` cannot help because it runs once at the end. And the fixtures differ only in
whether `hostAnswer` is supplied at all, since **§4.6 measured that a page this extension does not
reach produces a callback receiving `undefined`**, which `readHostContextAnswer` reads as a refusal
rather than as an empty host — so the "refused" arm is produced by **omission**, and a reader has to
be told that or the two rows look interchangeable.

### A18 — What the falsification pass found in A17's cases, including one vacuous assertion

**Nine arms: eight caught by the assertion each was aimed at, and one a logically identical
rewrite recorded as evidence and not counted.** Every restoration was SHA-256 verified per file and
the tree was green before the first arm ran — the recorded precondition, and the reason §7's first
round filed two false catches. **One of the eight is caught by a control rather than by the assertion
it was first declared against, and that is recorded below rather than filed as what it was.**

**The finding that mattered: the absence assertion could not fail.** *"Still offers no mailbox as
being that page's"* asserts `queryByTestId("panel-address")` is `null`, and **`queryByTestId` returns
`null` when no element carries the id** — so a panel that rendered the section with the id deleted,
with the section deleted, or that rendered nothing at all, satisfies it equally. Deleting
`data-testid="panel-address"` left the whole suite green. That is this repository's recorded
*narrower than its rule* shape and it was authored by this change. **The repair is a positive control
in the arm where the section *is* shown** — and the re-run of that arm reports a `wrongcatch`, because
it is caught by the control rather than by the absence case. **An arm naming an assertion the
mutation cannot reach will one day report a green as a catch**, and the re-declaration is recorded
rather than the run being filed as what it was.

**A second arm proved the guard that case names is unreachable by mutation at all**, and green was the
correct result: rewriting `{shown.kind === "named" && record !== undefined && (` to
`{record !== undefined && (` changes nothing on any input, because `record` is `undefined` unless
`shown.kind === "named"`. Recorded as evidence and **not counted**, which is the recorded rule applied
to itself: a survivor means *"the assertion did not catch this"*, never *"the assertion is too
weak"*, until the mutant has been read and shown to be the thing it claims.

**So what actually holds the hazard closed was then measured rather than asserted.** The early return
in the `shown` memo is the guard that matters, and removing it was predicted to be `nocompile`. **That
prediction was wrong, and it is recorded as a prediction that was wrong rather than kept because it
was newer:** the unit tier reported the mutation `caught`. The reason is that **`pnpm test` does not
typecheck** — it transforms with esbuild, which strips types without checking them — so a `nocompile`
outcome is one this instrument *cannot produce*, and the honest reading of that run is neither
"the compiler holds this guard" nor "the compiler does not": **it is that the instrument was never
asked the question.** Asked directly, `tsc --noEmit` over `apps/extension` **exits 1** on the
mutation with `TS2339: Property 'host' does not exist on type 'HostReading'`, and the tree was
restored byte-identical. So the guard is held by the **type**, which is the same category as
`provider-config.ts`'s `primaryProviderName` and is stated here as a measured fact rather than an
assertion that a case enforces something.

**And a third arm's attribution was wrong in the ordinary way** — resolving a mailbox for an unnamed
page is caught by the two `restore` cases, because `record` feeds `restore`, and not by the address
section's guard. **A catcher naming an assertion about a different property is an attribution to
fix**, and it is re-declared rather than credited to the case that happened to go red.

**The instrument itself was wrong first, on its first run, and it is the recorded shape.** Its count
detector was `/\b\d+\s+(passed|failed)\b/`, and **the character immediately before `1186` in Vitest's
summary is the `m` of the escape sequence `[32m`** — so the `\b` between `m` and `1` is not a word
boundary, the match failed, and a **perfectly green run of 1186 tests was filed `harness-error`**. It
refused to proceed, which was safe; **it was safe for the wrong reason**, and a detector that has to
know about the reporter's colouring is a detector the reporter can defeat. The repair strips ANSI and
anchors on the summary line's own shape — and anchors on **`Tests`**, not either summary, because
Vitest prints `Test Files 61 passed` immediately above `Tests 1186 passed` and a detector accepting
either reads a *file* count as a *test* count, which is the earlier recorded defect reintroduced by
the rewrite. **`AGENTS.md` already records that detector being fixed once; it was broken again here in
the opposite direction, and the fix was applied to the pattern that had been fixed before.**

### A19 — `apps/web/e2e/sections.spec.ts` still passes, and its comment is now false

**Recorded, not fixed — `apps/web` is zero files in this change.** The comment at
`sections.spec.ts:939-949` says that the sweep forbids words naming capabilities *that no side panel
are built (M9 and M11 own them)*. **M11 is this change, so that clause is false as of this commit**,
while the assertion it annotates is unaffected: the list at line 950 is about the **website** naming
capabilities, and this change added a panel to the **extension**, so the sweep still passes and still
guards the real defect — a label the website shows about a surface it does not have.

**The precedent for leaving it is set once already.** `incoming-mail-notification` merged as `6b80914`
and **never touched this file**, though `"notification"` is on the same forbidden list and the
notification shipped — so a stale comment on that list is not a novel state for this repository.

**It is retired by the website-preview change rather than here**, because the list becomes true again
the moment the website depicts the panel — and `D9` commits `apps/web` to no change at all for this
milestone, so a comment claiming this change made the list stale would itself be the claim that had to
be withdrawn later. **Recording it is the honest alternative to silently editing a file the change
promised not to touch.**

### A20 — The red hunt: green 15 of 15, and the instrument that could not read five of them

**The orchestrator ran this measurement, not the implementation agent.** It was launched twice and
yielded on twice; it was then executed at the orchestrator's hand, and **every run in this section was
produced there**. That is stated first because a reader counting 15 green runs would otherwise
attribute them to the agent whose instrument is the subject of the second half of this section, and
**an agent claiming runs it did not execute is the exact defect `build-and-verification` exists to
prevent.** Task **11.9** was ticked for several turns while no such measurement existed — it claimed a
rate with its denominator and there was no rate — and is kept ticked now **only because the
measurement below exists.** The tick was *unticked in spirit* in the interim and the honest state was
recorded rather than defended.

**The measurement, on `a8fce77`, and its precondition first.** Source fingerprint **492 files, digest
`f38e88c1e7fb0ec4aeb38d5f00ba47eab99b68d87a7f52f5d3062b5ddaa0b737`, identical before and after** — no
source moved while the measurement ran, **and that is what makes these runs comparable to each other and
to the fingerprint `e7d6c32` was accepted on.** Two earlier launches of this same instrument were killed
part-way through (`browser-01`, `EXIT=-1`) precisely because they were measuring a tree that was about
to change, and **a measurement taken while the tree is moving is not a weak measurement, it is not a
measurement** — so those two partial runs are discarded rather than reconciled, and the fingerprint is
recomputed per launch rather than carried forward.

- **`pnpm test:browser` × 10 — 10 passed, 0 red**, `website=40` and `extension=78` on **every** run.
- **`pnpm test` × 5 — 5 passed**, **61 files / 1187 tests** on every run.
- **`pnpm verify` × 3, plus a fourth with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory —
  exit 0 each**, 61 files / 1187 tests and three Vite builds each.
- **`--reporter=json` grouped by project:** `apps/extension` **424**, `apps/web` **125**,
  `packages/ui` **38**, `tests/architecture` **53**, `core` **54**, `providers` **92**,
  `mail-parser` **149**, `mailbox` **166**, `storage` **86** — **total 1187.**

**So: 15 of 15 green, plus 4 of 4 `verify` green, on a tree whose source did not move.** The
per-project figures are the confirmation of the arithmetic predicted from `e7d6c32`'s baseline of
**1182 total / 419 extension** — `apps/extension` **419 + 5 = 424** and **1182 + 5 = 1187**, with the
61-file count unmoved because no test file was added, only five cases appended to one. **The
`1186` that appears in A18's account of the instrument's own first run is an earlier tree and is not a
figure for this commit**; it is left in A18 because A18 is describing what the instrument printed on
the day it was written, and it is named here so no reader carries it forward as a count.

**Two findings are worth more than the tally, and both are about the instrument rather than about the
product.**

**The verdict was wrong and the capture was right, which is the shape the repair depends on.** The
instrument's own tally printed **`{"passed":10,"harness-error":5}`**, and `hunt/runs` held five files it
had reported as unreadable. **All five were green runs.** **Measured against the captured files rather
than taken from the account of them, the mechanism is not the one first recorded, and the difference is
in the bytes.** In `unit-01.txt` the word `Tests` is **contiguous and intact** — the six bytes are
`54 65 73 74 73`, ASCII `Tests` — and the escape bytes sit **after** it, between the word and the count:
`Tests <ESC> <ESC><ESC>1187 passed<ESC><ESC><ESC>`. So `\s+` cannot match across them, because an
escape byte is not whitespace, and a detector anchoring on `Tests\s+1187` **fails on a line that is
present and correct.**

**Three details of the first account are contradicted by the files, and they are recorded because each
one would have sent a reader to the wrong repair:**

- **There are no carriage returns in the captures at all** — `0x0D` appears **zero** times in
  `unit-01.txt`. The live progress output does overwrite with carriage returns, but **the redirection
  did not preserve them**, so the file on disk carries no `CR` to explain anything.
- **There are no CSI sequences either** — an `ESC` immediately followed by `[` occurs **zero** times,
  across **968** escape bytes that are all bare and unpaired. So the line is not carrying
  `[2m[1m[32m`-style colour runs at all.
- **Therefore stripping "the CSI sequences themselves, `ESC [ … letter`" does not repair this file, and
  that was measured rather than assumed**: applying exactly that stripper removes **0** sequences and
  `Tests\s+1187` **still fails**. **What does work is stripping the bare `ESC` bytes themselves** —
  sequence-form first, then every remaining `ESC` — after which all five runs recover
  **`Test Files 61 passed` / `Tests 1187 passed`** and the tally's `harness-error: 5` becomes
  **`passed: 15, harness-error: 0`**. **A repair prescribed from a summary of the failure rather than
  from the failing bytes can be the wrong repair and still sound exactly right**, and this one was
  caught only because the captured files were read before being deleted.

**The measurement survives its own instrument's misreading because every run's full output was written
to disk before anything was judged**, and that is the repair working as designed: **the defect was in
the verdict, not in the capture.** Had the block kept only a summary — which is exactly what A15 records
the earlier instrument doing, and the reason these five runs would have been lost **entirely** — then 15
green runs would have been reported as 10 green and 5 unknown. **A measurement whose verdict is
unreliable and whose capture is complete is recoverable; the reverse is not, and the distinction is what
"capture the whole run" was for.** **And the exit code was already in the record and already said so** —
all five `harness-error` entries carry **`"exit": 0`**, so the instrument held a green run's own verdict
*in the same object* as its claim that the run was unreadable, and **reported the claim.**

**And this is the sixth instance of this repository's most-recorded instrument defect, and it is the
sharpest of the six — because it was predicted in the same report that shipped it.** A18 records my own
conclusion: *"a detector that has to know about the reporter's colouring is a detector the reporter can
defeat."* **The prediction was right, and the instrument contradicted it in the same sitting** — not
merely by being defeated by the reporter's colouring this time, but by being defeated by the
reporter's **cursor control**, which is the same category of problem wearing a different byte. **An
instrument named for a failure mode does not thereby stop having it**, and a prediction recorded in an
amendment is a claim about the world, not a fix.

**And a second reader failed on these same files, for the same root cause and in a different way — which
is recorded because two independently written readers failing on one cause is the finding, and because
the second failure shows what the first one would have looked like if it had gone the other way.** A
reader that strips **only the `ESC` byte**, leaving the parameter bytes behind, turns a colour run into
the literal text `[22m`, so `Tests` is followed by `[2m[1m[32m` before the number and the extraction
reports **no `Tests` line on a file that has one**. **Measured on these captures, the two readers differ
in which half they keep: this one keeps the sequence and drops the escape, the instrument's keeps the
escape and drops the sequence — and one root cause produces both, which is reading a reporter's output
without handling its control bytes.** **The repair that satisfies both is to strip the bare `ESC` bytes
last**, after the sequence form, **because a bare-`ESC` strip alone leaves parameter text behind and a
CSI-only strip alone leaves the escapes.** **Neither reader was wrong about the product; both were wrong
about the text, and a reader that reports a confident negative about a document it has not decoded is
this repository's recorded defect in its purest form.**

**What this section does not establish, unchanged from A15/A16.** **15 green runs on one machine is not
a diagnosis.** The A15/A16 reds — 1 in 34 browser runs and 1 in 5 `pnpm verify` — are **still
suspected rather than identified**, because **their failing titles were discarded by the runner** and
this hunt caught none, which is consistent with either a rate below this block's resolution or with a
cause this block never provoked. **Machine-load starvation remains an unmeasured hypothesis and is not
recorded as an explanation.** No product code was changed to chase either red, and nothing in this
section should be read as a claim that the reds are now closed — **it is a bound on this tree, over
this window, on this machine.**