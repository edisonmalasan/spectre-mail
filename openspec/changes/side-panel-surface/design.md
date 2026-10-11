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