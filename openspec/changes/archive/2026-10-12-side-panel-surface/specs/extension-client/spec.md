# Spec Delta

Rewrites one of `extension-client`'s ten requirements in the class form it was reaching for,
and adds two for a surface this client has declared absent since M8.

**The rewrite is the interesting one, and it is a rewrite rather than a deletion because the
requirement's own second scenario asks for exactly that.** *"A later milestone adds a declared
surface → it SHALL amend this requirement in its own change rather than deleting the
assertion."* This is that milestone for the last item on its list, and the amendment the
scenario asks for turns out to be a change of **kind** rather than of list:

The list held three absences — a side panel, a one-time-code copy control, a
verification-link control. `in-page-fill` had already taken the fill control and left the
other two; `incoming-mail-notification` took the notification; **this change takes the side
panel, and it takes the copy and link controls with it**, because a panel beside the page
during a signup is where the roadmap's target experience puts `[ Copy ] [ Fill ]` and a
verification link, and a control shipped in one surface while another surface's requirement
declares it forbidden is the stale claim this repository has retracted four times for the
opposite direction. **Three removals from a three-item list leaves an empty list, and an
empty list makes the requirement vacuous** — it would assert nothing while reading as though
it did, which is the same shape as the retired-rule-without-its-requirement defect the
boundary tombstone in `tests/architecture/boundaries.test.ts` exists to prevent.

So the requirement is restated over the **class**: the extension SHALL NOT declare a surface it
does not ship, and a surface is now every surface key a manifest can carry plus every document
path it declares. That form is **not** narrower than the list it replaces — `options_ui`,
`devtools_page`, `chrome_url_overrides.newtab` and `side_panel` are all real manifest keys the
list never named, and all four would have passed a requirement that forbade three named
surfaces. **Every amendment this requirement has ever carried is kept inside it**, because the
chain is the record of *why* the list got shorter and a reader who finds only the class form
cannot tell that the side panel was ever absent at all.

## MODIFIED Requirements

### Requirement: The extension declares its non-goals as requirements rather than leaving them absent

The extension SHALL NOT declare a surface it does not ship. A surface is any key a manifest may
carry that gives a person somewhere to interact with this extension — an action, an options
page, a devtools page, a new-tab or history override, a side panel — and every document path
the manifest declares SHALL resolve to a file this client builds. Each declared surface SHALL be
named by a requirement in this specification, and each absence SHALL be asserted.

A declared surface that renders nothing or acts on nothing is fake UI, which this product does
not ship. An absence that is merely an omission reads as an oversight and is eventually filled
in by whatever change touches the file next. Asserting it makes the boundary deliberate, and
makes the milestone that does own the surface the only one that may add it.

**The form this requirement took before this change was a list of three named absences, and the
list is deleted rather than kept empty.** A requirement that forbids nothing asserts nothing
while reading as though it does, and **a vacuous assertion is a defect in the direction that
is easiest to miss** — nothing fails, no gate goes red, and the file still says the boundary
is deliberate. The list was replaced by the class it was an instance of, which is also
**broader than the list was**: `options_ui`, `devtools_page` and `chrome_url_overrides` are
manifest keys this requirement never named and would all have passed it.

**Every amendment this requirement has carried is kept, because the chain is the record.** A
reader who finds only the class form cannot tell that the side panel was ever declared absent,
and a future change that adds an options page deserves to know that three surfaces came off
this list by measurement rather than by a broadening of taste.

**Amendment, recorded at proposal (2026-10-07), by `in-page-address`.** The content script is no
longer on this list. This requirement's own second scenario required the in-page milestone to amend
this text rather than delete the assertion, and this is that amendment: **the content script comes
out and everything else stays on**, because the side panel, the notification and the verification
controls are still milestones that have not run. The assertion survives in the form that matters —
each remaining absence is still declared, and still asserted.

**The second scenario was generalised, and that is a change worth naming.** It read *"WHEN the
in-page milestone adds a content script"*, which described one event that has now happened and
therefore guards nothing afterwards. It now names the class of event, so the rule keeps applying to
the surfaces still on the list.

**Amendment, recorded at proposal (2026-10-10), by `in-page-fill`.** **The one-time-code fill
control comes off this list, and the one-time-code *copy* control stays on it.** That split is
deliberate and is the reason this amendment is not simply "the verification controls come off":
`in-page-fill` fills a code into a field and nothing else, so removing the whole phrase would leave
the extension declaring an absence that is no longer true — a control this product does not ship
described as forbidden, which is the same stale claim in the opposite direction. The remaining three
absences are still milestones that have not run, and each is still declared and still asserted.

**Amendment, recorded at proposal (2026-10-10), by `incoming-mail-notification`.** **The
notification comes off this list, and the other three stay on it.** The side panel, the
one-time-code copy control, and the verification-link control are still milestones that have not run,
and each is still declared and still asserted.

**The notification came off because it was the gate, and it is worth naming what discharged it.**
This list is not a preference list. `in-page-fill` declined the notification in its own design
record and gave reasons, one of which was that the two facts it would rest on were unmeasured.
`alarms-packing-interval` measured them and recorded the result in `docs/PROVIDERS.md` §4.1.1, which
is where the requirement this change removes says a measurement of a background cadence belongs.

**The manifest clause of that scenario became load-bearing again, and this time in the other
direction.** It reads *"it SHALL request no permission that no shipped surface uses"*, and
`in-page-fill` recorded that it became load-bearing because its delivery needed no permission at all.
**This change is the other case.** `alarms` and `notifications` were added for the same reason, and
this clause is what makes them honest: a permission declared for a surface this extension does not
ship is exactly what it forbids, and each is traceable to a requirement in this delta that could not
be met without it.

**Amendment, recorded at proposal (2026-10-11), by `side-panel-surface`.** **The last three
absences come off, and the list is replaced by the class above.** The side panel, the
one-time-code copy control and the verification-link control are all shipped by this change, in
one surface — a panel docked beside the page is the only place a user mid-signup can read a
code and put it in the field beside it, which is the roadmap's target experience verbatim.
Shipping a control in one surface while this requirement declares it forbidden in another is
**the stale claim in the opposite direction**, and this repository has retracted four of those
already.

**What the side panel's permission is then, under a requirement that forbids unearned ones.**
`sidePanel` is added, and it is the **second** manifest entry this requirement has seen go on
(`alarms` and `notifications` were the first). Its necessity was measured rather than assumed:
`docs/PROVIDERS.md` §4.6 records that `chrome.sidePanel` is **`undefined`** in a fixture
declaring neither it nor a `side_panel` key, present in a sibling control differing in
exactly those two entries, and that the permission is one of the two and cannot be separated
from them on this substrate. The entry is therefore traceable to the requirement below that
cannot be met without it, which is what the manifest clause asks for.

#### Scenario: The manifest is read

- **WHEN** the extension's manifest is read
- **THEN** it SHALL declare no surface it does not ship
- **AND** every document path it declares SHALL resolve to a file this client builds
- **AND** every surface it declares SHALL be named by a requirement in this specification
- **AND** it SHALL request no permission that no shipped surface uses

#### Scenario: A later milestone adds a declared surface

- **WHEN** a milestone adds a surface this requirement forbids
- **THEN** it SHALL amend this requirement in its own change rather than deleting the assertion

#### Scenario: A declared path resolves to nothing

- **WHEN** the built extension is listed
- **THEN** every document path the manifest names SHALL be among the files it emitted
- **AND** a path naming a file the build does not emit SHALL be reported by name

## ADDED Requirements

### Requirement: The side panel renders the mailbox this device holds, beside the page rather than in place of it

The extension SHALL ship a side panel that names the mailbox this device would hand a visitor,
lists that mailbox's messages, opens one and shows the one-time codes and verification links
detected in it, offers a control that puts a detected code into the page beside the panel and a
control that puts a detected value on the clipboard, names the mailboxes this device holds most
recently, and names the provider it reached — each performed through the shared mailbox session
rather than by the panel's own logic.

The panel SHALL offer a mailbox only where one exists, and SHALL report a provider failure and
an expired mailbox rather than showing an empty inbox for either. **The panel is a second place
to do what the popup already does and not a second way of doing it**: the same session, the same
parser, the same delivery seam. A panel that reimplemented any of that would be a second client
inside one client, and the boundary rule that forbids reimplementing a shared package's behaviour
already applies here.

A control the panel offers SHALL act on the message, code or link it is beside. **A panel that
renders a caption is the same defect `page-composition` forbids on the website** — a depicted
control that would act on nothing — and the reason that rule exists applies verbatim to a
shipped surface rather than a depiction of one.

#### Scenario: The panel is opened

- **WHEN** the side panel is opened
- **THEN** it SHALL name the mailbox this device would hand a visitor
- **AND** it SHALL list that mailbox's messages
- **AND** it SHALL name the provider it reached

#### Scenario: This device holds no mailbox

- **WHEN** the panel is opened on a device holding no mailbox
- **THEN** it SHALL offer to create one
- **AND** it SHALL offer no mailbox to read

#### Scenario: A message is opened in the panel

- **WHEN** a person opens a message from the panel's listing
- **THEN** it SHALL show the codes and links the parser detected in it
- **AND** each code SHALL carry a control that puts it on the clipboard
- **AND** each code SHALL carry a control that puts it into the page beside the panel
- **AND** each link SHALL carry the destination's host beside the control that opens it

#### Scenario: A provider is failing

- **WHEN** the provider this client reaches first cannot be reached
- **THEN** the panel SHALL name the provider that served it
- **AND** it SHALL report the failure rather than show an empty listing

#### Scenario: The mailbox is gone

- **WHEN** the provider reports that this mailbox no longer exists
- **THEN** the panel SHALL say so
- **AND** it SHALL not offer to read it

#### Scenario: Several mailboxes are held

- **WHEN** this device holds more than one mailbox
- **THEN** the panel SHALL name the most recent ones
- **AND** every mailbox it names SHALL be one this device holds

### Requirement: The side panel names the page it is beside, and reports when it cannot

The side panel SHALL name the host of the page docked beside it, SHALL say which mailbox this
device last used on that host, and SHALL re-read both when the active tab changes. It SHALL NOT
obtain the host by asking the page, by asking the user, or by requesting a permission it does
not already hold, and it SHALL state that it cannot name the page rather than infer a host when
no answer arrives.

The host is the one fact a panel cannot read for itself: `docs/PROVIDERS.md` §4.6 records that
`tab.url` and `tab.title` come back `undefined` to a panel holding no `tabs` permission, and
that the `tabs` permission would read them at the cost of being able to read across every
window. **A panel that names a host it did not confirm is the failure this requirement exists
to prevent**, because the mailbox it would then offer is another site's mailbox and a code
delivered beside the wrong form is a code in somebody else's account.

**The route is the content script, and it is chosen because it is free rather than because it
is available.** The content script already runs on the page and already knows its own
`location.hostname`; asking it costs one round trip and no permission, where `tabs` costs one
manifest entry and a permanent broadening of what this extension can read. §4.6 measured both
readings.

#### Scenario: The panel is opened beside a page

- **WHEN** the side panel is opened beside a page
- **THEN** it SHALL name that page's host
- **AND** it SHALL name the mailbox this device last used on that host, or say it holds none

#### Scenario: The active tab changes

- **WHEN** the active tab changes while the panel is open
- **THEN** the panel SHALL report the host of the page now beside it
- **AND** it SHALL do so without a reload and without a permission it did not already hold

#### Scenario: No answer arrives

- **WHEN** no host is answered for the page beside the panel
- **THEN** the panel SHALL say it cannot name that page
- **AND** it SHALL offer no mailbox as being that page's
- **AND** it SHALL offer to create a mailbox, because a mailbox created while the page is unnamed is recorded against no host at all
- **AND** it SHALL NOT claim that this device holds no mailbox, because a device beside a page this panel cannot name may hold one, several, or none

**Amendment, recorded during apply (2026-10-11).** This scenario and *"The panel is beside a page this
extension does not reach"* **name one panel state and two reasons for reaching it**, and the
implementation collapses them: `Panel.tsx`'s `shown` memo returns `{ kind: "unnamed" }` for **every**
reading that is not `named`, so the page that answered nothing usable (`unanswered`) and the page with
no script of this extension's (`refused`) are the same state as far as creation is concerned.

**So the two scenarios specify creation identically, and that was a decision rather than an omission.**
Left silent here, a promoted spec would permit an implementation that offers creation beside a refused
page and withholds it beside an unanswered one — **and the panel cannot make that choice**, because
both arms reach the same branch. **Silence is not prohibition, and a spec that leaves one arm of one
state silent is the same hole the other scenario's *"the rest of the panel SHALL continue to work"*
was**: it reads as a permission and permits a distinction the product does not have.

**The two scenarios are still distinct, because the host *line* is distinct** — one says the page did
not say which host it is on and the other says no script of this extension's runs here, and that
difference is real, observable, and measured (§4.6 recorded that a content script answering nothing
**resolves**, so "ran and had nothing to give" and "never answered at all" are genuinely different
faults). **What does not differ is what the panel may offer beside either**, and the delta now says so
in both places rather than in one.

#### Scenario: The panel is beside a page this extension does not reach

- **WHEN** the page beside the panel has no script of this extension's
- **THEN** the panel SHALL say it cannot name that page
- **AND** it SHALL offer no mailbox as being that page's
- **AND** it SHALL offer to create a mailbox, because a mailbox created while the page is unnamed is recorded against no host at all
- **AND** it SHALL NOT claim that this device holds no mailbox, because a device beside a page this panel cannot name may hold one, several, or none

**Amendment, recorded during apply (2026-10-11).** The clause this scenario carried — *"the rest of the
panel SHALL continue to work"* — **named nothing**, and it was the whole reason the panel needed a
product decision rather than an implementation: a sentence that says everything else keeps working is
satisfied by a panel that renders a heading, one line about not being able to name the page, and
**nothing a person can act on**, which is the fake-UI defect this repository treats as structural on
a surface the manifest points at.

**The four clauses above are therefore the decision, stated as requirements rather than as prose.**
The mailbox stays withheld and a create control is offered, because **a newly created mailbox belongs
to no host**, and offering one is not the wrong-context hazard the requirement exists to prevent; and
the "this device holds no address" sentence stays gated on the resolved-and-empty arm alone, because
beside a page this panel cannot name **that sentence is false** — the device may hold any number, and
the fault is that *this panel* cannot read which.

**The option rejected, recorded because a reader should be able to disagree with the decision rather
than re-derive it:** withholding creation beside an unnamed page, i.e. gating the control on `none`
exactly as the neighbouring clause is gated. **The orchestrator decided against it.** The reason it
was rejected is that the withholding produces a surface that can do nothing, and the reason it was
considered at all is that it is the more conservative reading of a hazard-clause. `design.md` A17
carries the same record with the decision attributed.

#### Scenario: The manifest is read for the panel's host

- **WHEN** the extension's manifest is read
- **THEN** it SHALL request no permission in order to name the page beside the panel