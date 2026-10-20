# extension-client Specification

## Purpose

Records what the browser extension is, what it deliberately does not contain yet,
and how each of those claims is established.

The extension is the second consumer of every shared package this repository has, and it exists
to prove the abstraction survives a client that is not a web page. That is the whole argument
for building it: a layer that only one consumer uses has never been tested by a second caller,
so `apps/extension` reaching through the same `MailProvider`, `SpectreStorage`, and mailbox
session is evidence about those abstractions rather than about the extension.

**Its absences are requirements, which is the part worth stating.** There is no content script,
no side panel, no notification, and no one-time-code control, and each absence is asserted. A
declared surface that renders nothing is fake UI, which this product does not ship, and an
absence that is only an omission reads as an oversight and gets filled in by whatever change
touches the file next. Each one belongs to a named later milestone, and the requirement that
forbids it is amended by that milestone rather than deleted.

**The service worker's limits are the same shape, and they are measured rather than assumed.**
An MV3 background worker is idle-terminated and `chrome.alarms` has behaviour this repository
had not observed, so the worker carries no polling loop and creates no alarm. Both facts were
then measured in real Chromium and recorded in `docs/PROVIDERS.md` §4.1 — the worker was still
registered after a full 30 000 ms idle window, and `chrome.alarms` stored every requested period
unchanged down to 999.6 ms. **Neither measurement is a lifetime or a firing time**, and the
chrome.alarms packing interval remains the open question D1 still depends on.

**What nothing here establishes, stated at the top because a Purpose is read once and the
limits are what get forgotten.** Every provider response in the extension's browser tier is a
**recorded** one, so `use it externally` is unverified and a stored mailbox has never been
reconciled against a live session. **No test in either browser tier reads a rendered pixel's
colour or position**, so nothing in this capability says how the popup looks. And the extension
reaches a provider over a real privileged context, which the two host-permission halves in
`provider-abstraction` establish about the *declared pattern* — not about the signup flow.

## Requirements

### Requirement: The extension is a Chromium MV3 client over the shared packages

The extension SHALL be a Manifest V3 Chromium client that reaches every provider, the domain
model, the mailbox session, and persistence through the shared packages, and it SHALL NOT contain
its own copy of provider, parsing, mailbox-lifecycle, or storage behaviour. A second client
consuming the same abstraction is the deliverable this milestone exists to demonstrate, so a
behaviour implemented a second time under `apps/extension` SHALL fail the build rather than
diverge quietly.

Two clients reading the same packages are not thereby prevented from telling a visitor two
different stories about the same surface. Where one client **depicts** another's - a section of
the website describing this popup - the depiction's labels SHALL be labels this popup renders,
and a label it does not render SHALL fail the build.

**This is the requirement's existing rule pointed at a second place it can be broken.** The two
clients already share every package, and the package boundary is what keeps their _behaviour_
from diverging; nothing in it kept the website's _description_ of this popup from drifting away
from the popup. A depiction held against the popup's copy cannot drift unnoticed, because the
build fails when it does.

#### Scenario: The extension reaches a provider

- **WHEN** the extension creates a mailbox
- **THEN** it SHALL do so through the shared provider abstraction
- **AND** it SHALL NOT contain a provider wire format, a provider JSON field name, or a request
      path of its own

#### Scenario: A behaviour already in a package is reimplemented in the extension

- **WHEN** a file under `apps/extension` implements provider selection, message parsing, mailbox
      lifecycle, or storage access
- **THEN** the architecture boundary test SHALL fail
- **AND** the failure SHALL name the file and the behaviour

#### Scenario: The two clients diverge

- **WHEN** a change would make `apps/web` and `apps/extension` report the same situation
      differently
- **THEN** the divergence SHALL be resolved in a shared package rather than in either client

#### Scenario: One client depicts the other's surface

- **GIVEN** the website renders a section describing this popup
- **WHEN** the popup's declared copy renames or removes a label that section shows
- **THEN** the build SHALL fail and name the section and the label

#### Scenario: A depicted label is not the popup's

- **WHEN** the section describing this popup shows a label the popup does not render
- **THEN** the build SHALL fail and report that label by name

#### Scenario: The popup gains a surface

- **WHEN** a later milestone adds a popup region or control
- **THEN** the website's description of the popup SHALL be amended in that same change
- **AND** it SHALL NOT be left describing a popup that no longer exists in that form

### Requirement: The extension reaches Mail.tm first and Guerrilla Mail behind it

The extension SHALL declare its providers as a single named list in preference order, SHALL
prefer Mail.tm, and SHALL fall back to Guerrilla Mail when Mail.tm is unavailable. The list SHALL
be the client's configuration rather than documentation beside it: the factory SHALL derive from
the exported list, and the adapter registry SHALL be typed exhaustively over it, so a declared
provider with no adapter SHALL NOT compile.

**This client's list has two entries because two entries is what it can reach.** The website's
list is one entry long and states that keeping it so is a requirement, because a second entry
would claim redundancy a web page does not have. Here the redundancy is real: Mail.tm sends CORS
headers to its own origins only, so no compliant page can reach it, while an extension with host
permission can. That is a measured difference between two host environments, not a preference
about either provider.

#### Scenario: The extension creates a mailbox

- **WHEN** the extension creates a mailbox
- **THEN** it SHALL prefer Mail.tm
- **AND** it SHALL fall back to Guerrilla Mail when Mail.tm is unavailable
- **AND** it SHALL report which provider it used

#### Scenario: A fallback occurs

- **WHEN** Mail.tm cannot be reached and the extension falls back to Guerrilla Mail
- **THEN** the extension SHALL report the provider it actually used rather than the one it
  preferred
- **AND** it SHALL NOT describe a fallback as a success against the preferred provider

#### Scenario: A provider is added to the list

- **WHEN** a provider id is added to the exported list with no adapter beside it
- **THEN** the client SHALL NOT compile

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

**Amendment, recorded at proposal (2026-10-12), by `panel-mailbox-choice`. This milestone adds a
control and amends nothing else, and the manifest clause is what says so is allowed.** A
milestone that had added a permission would be the case this requirement's second scenario is
about: it would have had to amend this text, and this text would have had to explain where the
permission's necessity came from — because `docs/PROVIDERS.md` is where a measurement of a
platform's cost belongs, and a cost measured for one capability is not a cost measured for the
next. **This change requests no permission, adds no manifest key and no document path, and its
control reads storage the panel already reads.** So the record this requirement keeps is that a
milestone working inside an already-declared surface did not need to touch the manifest at all,
which is the shape the clause asks for and **the opposite of the shape that would have required
an amendment here.** Nothing is deleted, and no absence is asserted that is not true.

**Amendment, recorded at proposal (2026-10-13), by `extension-permissions-review`. This
requirement's manifest clause is about permissions, and its wording does not reach the one entry
the extension actually declares.** The clause reads *"it SHALL request no permission that no
shipped surface uses"*, and **`sidePanel` is reached by no shipped call** — the sole occurrence of
the token under `apps/extension/src` is the word *"sidepanel"* inside a doc comment in
`panel-main.tsx`, and a word differing from the token by case is not a call. It is earned, if at
all, by the `side_panel` **manifest key**. **So the clause either already forbids this entry or
fails to reach it, and nobody has had to say which** — and a clause whose reach is unknown cannot
be relied on by the milestone whose job is to remove an unearned permission. The scenario below is
what makes it say which, and it is added here rather than at the next amendment because **a gap in
a boundary this requirement owns is this requirement's own defect**, not the next change's.

**The paragraph above this one overstated its evidence, and the correction is narrower than it
looks.** It records that `sidePanel`'s necessity *"was measured rather than assumed"*, citing
`docs/PROVIDERS.md` §4.6's control-and-probe comparison — and **two of that comparison's four
cells were measured**: a fixture declaring neither the permission nor the `side_panel` key, and one
declaring both. *Permission without the key* and *key without the permission* were never run, and
the probe's own `VARIANTS` list shows three entries where four cells are needed. **What was
established is therefore narrower than the sentence says: that `chrome.sidePanel` exists when both
entries are declared and does not when neither is.** **This is not a defect attributed to the
milestone that added the entry** — that milestone recorded what had been measured and said plainly
what could not be separated on this substrate, which is a different claim from claiming it had been
settled. **It is a fixture with two cells unwritten, carried across four later changes as though
the platform forbade the measurement**, and the two missing cells are two lines of a staged manifest
in an instrument this repository already owns.

**Amendment, recorded at apply (2026-10-13), by `extension-permissions-review`. The two cells the
previous paragraph says were never run have now been run, and they separate the two entries: the
`sidePanel` permission is what makes `chrome.sidePanel` exist, and the `side_panel` key is not.**
Four cells were measured on this Chromium, in a service-worker context, each staged from one fixture
manifest by a shallow top-level merge and each differing from the `with-permission__with-key` corner
in exactly one entry:

| cell | `sidePanel` permission | `side_panel` key | `chrome.sidePanel` |
|---|---|---|---|
| `no-permission__no-key` | absent | absent | **`undefined`** |
| `no-permission__with-key` | absent | present | **`undefined`** |
| `with-permission__no-key` | present | absent | **present** |
| `with-permission__with-key` | present | present | **present** |

**The entry stays, and `manifest.json` is unchanged by this change.** The cell that decided it is
`no-permission__with-key`: **the key alone does not work**, so the permission is not redundant
because the key is present beside it. **The other cell matters just as much and is the one nobody had
run**: `with-permission__no-key` shows the permission alone is *sufficient* — the API exists, and
`open` and `setPanelBehavior` are functions, with no `side_panel` key declared anywhere in that
manifest. So of the two entries, **the permission is the one that earns the API and the key is the
one that tells Chromium which document to mount** — they are not interchangeable and neither is
redundant, which is the fact the two-cell comparison could not express.

**This is not a defect attributed to the milestone that added the entry.** `side-panel-surface`
recorded what it had measured and said plainly what could not be separated on this substrate; that
is a different claim from claiming it had been settled, and the entry was traceable to the
requirement below that cannot be met without a panel. **What was wrong was the fixture — two cells
of a two-by-two that were never written — and it was wrong for four changes after the entry landed.**

**What the four cells do not establish, and what the trace required by the scenario below therefore
records.** Each cell's reading is the **API's existence in a service worker**, so this says that
`chrome.sidePanel.open()` is unreachable from the worker without the permission — **and it says
nothing about whether Chromium would mount a panel document in a window if a person opened one by
some other route with the key alone**, which was not measured because no instrument here can see a
panel dock (`docs/PROVIDERS.md` §4.6's limits). One engine, one machine, one fixture, and a staged
merge rather than a hand-authored manifest.

#### Scenario: The manifest is read

- **WHEN** the extension's manifest is read
- **THEN** it SHALL declare no surface it does not ship
- **AND** every document path it declares SHALL resolve to a file this client builds
- **AND** every surface it declares SHALL be named by a requirement in this specification
- **AND** it SHALL request no permission that no shipped surface uses

#### Scenario: A later milestone adds a declared surface

- **WHEN** a milestone adds a surface this requirement forbids
- **THEN** it SHALL amend this requirement in its own change rather than deleting the assertion

#### Scenario: A milestone adds a control to a surface it already declares

- **WHEN** a milestone adds a control inside a surface the manifest already names
- **THEN** the extension SHALL request no permission that the control did not already require
- **AND** the manifest SHALL be unchanged unless a requirement in this specification needs a change

#### Scenario: A declared path resolves to nothing

- **WHEN** the built extension is listed
- **THEN** every document path the manifest names SHALL be among the files it emitted
- **AND** a path naming a file the build does not emit SHALL be reported by name

#### Scenario: A permission is earned by a manifest key rather than by a call

- **GIVEN** the manifest declares a permission no shipped module calls
- **WHEN** that permission is traced to the thing it is for
- **THEN** the trace SHALL name the manifest key the permission is for and the requirement that
      key serves
- **AND** the trace SHALL record what was measured about that key without the permission, including
      the case where nothing could be measured
- **AND** a declared permission naming neither a `chrome.<name>` call nor a manifest key SHALL
      fail the build and be reported by name


<!-- Copied verbatim from `openspec/specs/extension-client/spec.md` by script. The
     amendment paragraph is spliced at one named anchor required to be unique; the
     ADDED scenario is appended at the block's end, which the script asserts is the
     line its append assumes. Block SHA-256 before the splice was
     b2c3ed1edad64197b73db5c0e71c8e31867562a781fd120eadf0cfeb13945c96
     and after it is 2509c0bd9f7a9bee4ba8126ca588218e9cb07d7537c57a90564de5f2a9ed1b60
     The two additions are the amendment paragraph and one ADDED scenario; every other
     line is byte-identical to the promoted spec. -->

### Requirement: The extension's popup performs its first milestone's actions over the shared session

The extension's popup SHALL create a mailbox, copy the mailbox address, name the provider it used,
report the provider's status, show the messages in the mailbox rather than only how many there are,
and show the one-time codes detected in a message the user opened — and each SHALL be performed
through the shared mailbox session rather than by the popup's own logic. The listing SHALL come from
an explicit check the user asked for, and a background check SHALL NOT populate the popup.

**Amendment, recorded at proposal (2026-10-10), by `incoming-mail-notification`.** This requirement
justified its user-asked listing with *"because no background polling exists in this milestone"*, and
that reason stops being true the moment this change lands. **The reason is replaced and the rule is
not weakened.** The listing still comes from a check the user asked for, and now for a reason that
survives the arrival of a background one: **a background check reports to a notification and holds no
state between wakes, so it cannot reach a popup that is not open.** A popup filled from a background
listing would also be spending a provider request the user did not ask to spend.

**The clause this replaces was deleted rather than reworded, and that is the rule.** A reason that
has become false is not a reason with a correction; keeping the sentence and adding a caveat beside
it is how a promoted spec ends up asserting two contradictory things about the same control.

**The popup SHALL NOT indicate that a message carries a verification until it has opened that
message.** A listing carries no detection, by construction rather than by omission:
`packages/core` states that codes and links are absent from a message summary *"on purpose: listing
a mailbox must not require fetching bodies"*. So the count the popup showed before is the whole of
what a listing can support, and a marker the listing cannot carry would be a guess about a message
nobody has read.

**Opening a message SHALL be the only way a code becomes available, and it SHALL cost a provider
request only while this session has not already analysed that message.** The shared session retains
the analysis of a message it has opened, which is what makes a second visit to the same message
free; a popup that opened every message in a listing to discover which one carried a code would
spend a provider request per message to learn something the listing structurally cannot say.

**The popup SHALL report what the page answered, and SHALL NOT report a code as filled when no page
confirmed it.** The page the code was sent to is somebody else's document, and a delivery this
extension could not confirm is not a delivery.

The popup SHALL NOT offer a provider selector. The extension reaches two providers, so a selector
becomes meaningful here in a way it is not on the website — but at this milestone choosing is not a
user action, it is a disclosure, and a control that can only report which provider answered is a
control that cannot act. The popup names the provider and, where a fallback occurred, names the
one it fell back from.

#### Scenario: The popup is opened

- **WHEN** a user opens the popup
- **THEN** it SHALL offer to create a mailbox, and SHALL name the provider it will reach
- **AND** it SHALL NOT offer a control for choosing a provider

#### Scenario: A mailbox exists

- **WHEN** the popup holds a mailbox
- **THEN** it SHALL offer to copy the address
- **AND** it SHALL show the provider that mailbox belongs to
- **AND** it SHALL show a count of messages obtained from a check the user asked for

#### Scenario: The provider is failing

- **WHEN** the popup asks the shared session for provider status
- **THEN** it SHALL render what the session reports
- **AND** it SHALL NOT render a status it computed itself

#### Scenario: A check has listed messages

- **WHEN** a check the user asked for returned messages
- **THEN** the popup SHALL render those messages
- **AND** it SHALL NOT indicate that any of them carries a verification

#### Scenario: A message is opened

- **WHEN** the user opens a message from the popup
- **THEN** the popup SHALL show the one-time codes detected in that message
- **AND** it SHALL cost a provider request only while this session has not already analysed it

#### Scenario: A message is opened a second time

- **WHEN** the user opens a message this session has already analysed
- **THEN** the popup SHALL show the same codes
- **AND** it SHALL cost no provider request

#### Scenario: The page does not confirm

- **WHEN** a code was sent to a page that did not confirm receiving it
- **THEN** the popup SHALL NOT report the code as filled

#### Scenario: A background check has listed messages

- **WHEN** a background check has listed messages while the popup is closed
- **THEN** the popup SHALL NOT show that listing until the user asks for a check of its own
### Requirement: The extension ships its own browser-verification tier

The extension's browser tests SHALL run in a suite that loads the built extension into a real
Chromium extension context, and every shipped extension spec SHALL be collected by that suite and
by no other suite. The website's browser suite SHALL NOT collect extension specs, and the
extension's SHALL NOT collect website specs, because a spec no suite collects reads as coverage
while verifying nothing.

The collection rule SHALL read the extension's runner configuration rather than a hard-coded
path, so narrowing its test directory is reported instead of passing.

#### Scenario: A spec is added

- **WHEN** a browser spec is added under the extension's suite
- **THEN** the architecture boundary test SHALL require it to be collected
- **AND** it SHALL report the file by name when no configured suite collects it

#### Scenario: The extension's suite is narrowed to nothing

- **WHEN** the extension's test directory or match pattern is emptied
- **THEN** the collection rule SHALL report that the suite collects nothing
- **AND** it SHALL NOT pass because the specs are still present on disk

#### Scenario: An extension spec is added to the website's suite

- **WHEN** an extension spec is collected by the website's browser suite
- **THEN** the architecture boundary test SHALL fail
### Requirement: The background service worker owns exactly one alarm and holds nothing between its wakes

The extension's background service worker SHALL create **exactly one** `chrome.alarms` alarm, SHALL arm
it when this device first holds a mailbox, and SHALL re-check it on every browser start rather than
assume it survived. Its period SHALL be the shared session's prompt delay, **taken from
`packages/mailbox`'s cadence at the point of use rather than restated**, so there is no second place
for the number to live.

The worker SHALL hold nothing between wakes. Each wake SHALL build its own session, take one listing,
**read no message body**, and release that session before the wake ends.

**"Exactly one" is a measurement, and it is why this is a requirement rather than a preference.**
Armed together on Chromium `153.0.8010.12`, a 5 000 ms and a 30 000 ms alarm produced **24 and 0
firings in 120 seconds** — the slower one was never scheduled, not scheduled late
(`docs/PROVIDERS.md` §4.1.1). A second alarm in this extension is therefore not a second feature; it
is the only way this extension could stop notifying at all.

**The period was reconciled against the shared cadence by taking it from there, which is what
"reconciled explicitly" means here.** A literal would be a silent divergence waiting for the cadence
to change.

**The cost is measured rather than assumed, and the first version of this paragraph was wrong in the
direction that matters.** It read *"one listing per wake at that period is twelve provider requests a
minute"*. Measured in Chromium on 2026-10-11 by counting what one wake costs on the wire: **two**
requests, for a mailbox holding **one** message — the listing, and a read of that message's body — and
**a second wake over the same mailbox cost the same two**, so the figure was not converging. The
listing went through the shared session's verdict pass, which reads each body it has not already read;
the wake builds a fresh session, the tracker remembers what it has read only for the life of that
session, and so **every wake re-read every body the mailbox held, for as long as the extension was
installed**.

**Against a `GET /messages` budget of `30; w=60` — which `docs/PROVIDERS.md` records as measured
unauthenticated only, with the authenticated policy never separately measured — twenty-four a minute
is inside the only budget this repository has evidence for and thirty-six is not**, and the general
shape was one listing plus one body read per message in the listing. That is a background loop paying
for a verdict every five seconds that **the extension has no consumer for**: `apps/web` is the only
caller in this repository that reads a verdict map.

**So the wake lists without reading bodies**, and the cost stated here is **one provider request per
wake whatever the mailbox holds** — twelve a minute, inside the only budget this repository has
evidence for. That remains a statement about a number, not a demonstration that a provider tolerates
it.

**Re-checking on start is not belt-and-braces, and the difference is which thing was measured.** The
measurement that discharged the removed requirement's gate established that a *record* in
`chrome.storage.local` survives a full browser restart. **It did not establish that an alarm does.**
The one number this repository holds for the worker's idle lifetime is a **120 000 ms bound and not a
figure** — the measurement stopped watching, the worker did not stop. So nothing here may rely on a
worker being alive, and nothing here may rely on an alarm outliving a reboot.

#### Scenario: The worker is inspected

- **WHEN** the extension's service worker source is read
- **THEN** it SHALL create exactly one alarm, under one name
- **AND** it SHALL take the period it gives that alarm from the shared session's cadence rather than
  a number written beside it
- **AND** it SHALL retain nothing from one wake to the next

#### Scenario: A second alarm is proposed

- **WHEN** a later change would give this extension a second alarm
- **THEN** it SHALL fold that work into the existing wake rather than arm a second alarm
- **AND** it SHALL record that the alternative was measured and was found to starve the slower alarm

#### Scenario: The browser starts

- **WHEN** the browser starts and this device holds a mailbox and no alarm
- **THEN** it SHALL create the alarm
- **AND** WHEN this device holds no mailbox, it SHALL create none

#### Scenario: A claim about the cadence is written

- **WHEN** any document states a background polling cadence
- **THEN** that cadence SHALL be one this repository has observed `chrome.alarms` firing at
- **AND** no document SHALL state a floor for `chrome.alarms` that this repository has not measured

#### Scenario: A wake is measured

- **WHEN** a wake is run in a real Chromium and the provider requests it costs are counted
- **THEN** it SHALL cost one request, whether or not the listing it returned held messages
- **AND** a later wake over the same mailbox SHALL cost one request as well, so the cost is a
  per-wake constant rather than something the first wake pays and the rest avoid
- **AND** the count SHALL name the request it counted rather than assert only a total

**And this scenario is the reason the cost paragraph above can say what it says.** It was written
after the measurement that contradicted that paragraph, and its third clause is the one a count of a
single wake would have missed — **the first run of its case read the count as soon as it went above
zero and failed with two requests where one was expected**, which is a figure a reader could easily
call "the first wake pays for the analysis". Counting across **two** wakes is what turned that into
"the cost does not fall", which is the defect.

### Requirement: A message that arrives raises a notification naming its sender and its subject

The extension SHALL raise one notification for each message in the watched mailbox whose id this
device has not already been told about, and that notification SHALL carry **the sender and the
subject, and no other value from the message**.

**The notification SHALL NOT carry a one-time code, and that is structural rather than a filter.** A
notification is readable on a lock screen, in an operating system's notification centre, and through
device pairing — every one of them outside the browser, and therefore outside every privacy control
this product enforces. A `MessageSummary` carries no body at all, by product principle
(`packages/core`: *"listing a mailbox must not require fetching bodies"*), so a notification built
from a summary **cannot** contain a code, and the check that raises it **reads no message body at
all**.

**And that half was measured, because the first version of it was a promise about intentions rather
than about requests.** It read *"the check that raises it never opens a message"*, which was true of
`openMessage` and silent about everything else: the wake's listing went through the shared session's
verdict pass, which reads each body it has not already read, so a wake had already fetched the very
body whose code it was declining to put on a lock screen. `mailbox-session`'s listing-without-bodies
requirement is what closes it, and the browser case that counts a wake's requests is what found it.

**Every notification SHALL carry the shipped raster icon, and that is load-bearing rather than
decorative.** Measured on 2026-10-11 against this Chromium, unpacked and headless: a notification
created with **no `iconUrl` resolves its callback and registers nothing**, so the callback reports
success for a notification the platform does not hold. An `iconUrl` naming an SVG is **refused
outright**, the callback resolving `null`. Only a raster image both resolves and is registered. The
icon is therefore the difference between the platform holding a notification and silently producing
none, and a build whose output does not carry the file SHALL fail rather than ship notifications the
platform is refusing.

**A notification that could not be created SHALL be reported, and SHALL NOT advance what this device
has been told.** The platform's only observed rejection signal is a `create` callback resolving
**`null`**, so that is what the wake reads. **This requirement names no error event, because there is
none to name:** `chrome.notifications.onError` does not exist on the Chromium measured, so a
requirement resting on it would describe a channel no implementation could ever observe — and a
wake that assumed success would record a message as announced and tell nobody, the same defect
`in-page-fill` found in a control that removed itself from the page without telling its caller. The
property is that the set of ids this device holds grows **only** on a notification the platform
answered for, so one that failed is raised again by a later wake rather than swallowed.

**The callback alone is not evidence, and the requirement does not claim it is.** It resolved for an
arm that registered nothing, which is why the icon is mandatory above rather than preferred. This
capability makes no claim about a notification having been **seen**: nothing in this repository can
observe an operating system's notification centre, and `create` answering is a smaller fact than
that.

#### Scenario: A message this device has not seen arrives

- **WHEN** a check finds a message whose id is not among the ids this device was last told about
- **THEN** it SHALL raise one notification naming that message's sender and subject
- **AND** it SHALL name no other value from that message

#### Scenario: The notification is examined for a code

- **WHEN** a notification raised by a check is read
- **THEN** no one-time code detected in that mailbox SHALL appear in it

#### Scenario: A notification cannot be created

- **WHEN** the platform answers a `create` with a null id, or throws rather than answering
- **THEN** the wake SHALL NOT record that message as one this device has been told about
- **AND** a later wake SHALL raise it again
- **AND** it SHALL report the message as one it did not announce, rather than report that nothing
  happened

**Amendment, recorded during apply (2026-10-11).** **Two clauses were added, and both were added
because a test failed against a product that was otherwise correct.**

**A `create` that throws is the same answer as one that resolves `null`.** `docs/PROVIDERS.md` §4.5
measured no error channel on this Chromium — `chrome.notifications.onError` does not exist — so the
only observed refusal is the callback's own value. **A throw is the one shape a callback-based API
can refuse in**, and treating it as an unhandled fault would leave the message unrecorded for the
opposite reason to the one that matters: the record would advance only if the failure happened to be
a value.

**The wake reports the message as one it did not announce.** The outcome union originally had a
single `quiet` arm, reached whenever the id set was unchanged — **which is exactly the state a
refused notification produces**, because a refused message is not recorded and the set therefore did
not change. So a wake the platform had just refused a notification for reported *"nothing happened"*
while having happened, and the retry the first clause depends on depended on the caller being told.
`quiet` is therefore split into `unchanged` (nothing was asked of the platform and the set is the
same) and `pruned` (nothing was asked of the platform and the set shrank), and an arm claims
notifications were raised **when something was attempted**, not when something succeeded. **An arm
claiming a notification was raised when none was is the same defect as a record that advanced on a
refused one**, and only the second of the two was visible when this requirement was written.

#### Scenario: The notification could not be raised and the record did not change

- **WHEN** every message in a listing has already been announced and a notification is refused
- **THEN** the wake SHALL raise no notification
- **AND** it SHALL not rewrite the record, because replacing it with itself is not a change

#### Scenario: A notification is raised without the shipped icon

- **WHEN** a notification is raised without the raster icon this extension ships
- **THEN** the platform SHALL be asked for a notification it does not hold
- **AND** no requirement above is satisfied by the callback resolving

#### Scenario: A build whose output carries no icon

- **WHEN** the built extension output does not carry the shipped icon file
- **THEN** the extension's browser suite SHALL fail
- **AND** no notification requirement above is claimed to be met

**Amendment, recorded during apply (2026-10-11).** **"The build SHALL fail" became "the extension's
browser suite SHALL fail", and the reason is that the build cannot fail here.**

`vite build` copies `static/` verbatim and checks nothing about its contents, so an icon missing from
the output is not a build failure — **and the icon cannot be missing from a build that succeeded**,
because the two are the same directory copy. The first version of this clause would therefore have
been satisfied by a build script nobody writes: it described a gate that does not exist, which is the
same shape as a boundary rule enforcing a rule that was retired.

The claim is enforced where it can be, by `manifest.spec.ts` **reading the emitted artefact**: the
PNG signature and its `IEND` chunk, so a truncated write and an HTML error page served in its place
are both refused, and `manifest.icons`/`action.default_icon` staying `undefined`, so the icon is
reachable only from a notification. **A test in the browser tier is the right instrument rather than
a convenient one** — the failure this exists to catch is silent by measurement (§4.5: the callback
resolves and the platform registers nothing), so nothing short of reading the artefact and reading
the registration would ever notice it.

### Requirement: A check with nothing to compare against establishes a baseline and raises nothing

A check that finds **no prior record** for the watched mailbox SHALL record what is present and SHALL
raise no notification. A check SHALL advance what this device has been told about **only when that set
changed**, and SHALL keep only the ids present in the listing it just took.

**The baseline is the feature, not an edge case.** Without it, a device installing this extension over
a mailbox holding forty messages would receive forty notifications in one wake, for mail that arrived
before the extension existed. *"Arrived since the last check"* has to be true rather than *"is
present"*, and this is what makes it true. **The price is stated rather than hidden:** mail that
arrived between installing the extension and its first wake is never announced, and is visible in the
popup, which is where a message is read anyway.

**The record is pruned to the current listing and is written only when it changed**, so it stays
bounded by the mailbox rather than by this device's history, and an unchanged mailbox costs no write.
The trade that buys it is also stated: **a message that leaves a listing and later returns is new to
this device again and is announced again.**

**Amendment, recorded during apply (2026-10-11).** **The prune clause is qualified where the listing
is empty, because the record kind cannot express it — and the divergence is recorded here rather than
discovered later as a surprise.**

The clause above reads *"SHALL keep only the ids present in the listing it just took"*, and for a
mailbox that has been **emptied** the implementation cannot do that. `SpectreSeenMessages`'s
`saveSeenMessageIds` **refuses an empty list**, and refusing is the right behaviour at the contract
level: `loadSeenMessageIds` answers `null` for a mailbox it has no entry for, so storing `[]` would
give one fact — *this device has an entry and it is empty* — **two spellings**, and a reader could
not tell a mailbox that was emptied from one that was never watched.

So **a mailbox that empties keeps whatever it had recorded**, and the qualification is a property of
the record rather than a gap in the check. **The cost is stated rather than assumed:** the stale ids
cost nothing, because the clause above already accepts that a message which leaves a listing and later
returns is announced again — a stale id in the record is exactly the state that trade describes, held
one wake earlier. **The alternative — a seen-record that can be empty — was rejected because it would
have put an ambiguity into the one contract that answers "has this device been told about this?"**,
and the wake answers that question with `null` for absence.

**This is why the empty listing is answered before the record is read at all.** A wake over an empty
mailbox has nothing to baseline, nothing to announce, and nothing to write, so it costs **one listing
and no storage traffic whatsoever** — and an implementation that read the record first would have had
to decide what to do with a record it could not shorten.

#### Scenario: This device has watched nothing yet

- **WHEN** a check finds no record for the watched mailbox
- **THEN** it SHALL raise no notification for the messages that listing returned
- **AND** it SHALL record those message ids

#### Scenario: The listing has not changed

- **WHEN** a check finds the same set of message ids it already held
- **THEN** it SHALL raise no notification
- **AND** it SHALL not rewrite the record

#### Scenario: The mailbox has been emptied

- **WHEN** a check takes a listing holding no messages at all
- **THEN** it SHALL raise no notification
- **AND** it SHALL not read or rewrite the record
- **AND** a later check finding those messages again SHALL raise notifications for them

### Requirement: A check that fails raises nothing, and a mailbox the provider has reported gone stops the check

A check the provider could not answer SHALL raise no notification and SHALL change nothing this device
has been told about. A check whose mailbox the provider has reported gone SHALL raise no notification,
SHALL clear the alarm, and SHALL leave the stored mailbox exactly where it is.

**A failed check SHALL NOT shrink the set of ids this device holds.** A check that failed must not
make the next successful check announce every message it has already announced, which is the failure
this clause exists to prevent.

**A mailbox the provider reports gone is a different fact from a check that failed**, and the two are
distinguished by the shared session rather than by this client: it reports `restoreFailed` for the
first and `expired` for the second. Clearing the alarm is right for the second and wrong for the
first — a mailbox that no longer receives mail cannot produce the event the alarm exists to report,
while a provider that could not be reached will be reachable again.

**This slice adds no removal control.** A stored mailbox the provider no longer honours is left
exactly where it is, because *"the provider says it is gone"* is not this product's to act on beyond
stopping the check, and a record removed on a provider's word alone would be a device acting on a
guess.

#### Scenario: The provider cannot be reached

- **WHEN** a check cannot obtain a listing
- **THEN** it SHALL raise no notification
- **AND** it SHALL leave what this device has been told about unchanged
- **AND** the alarm SHALL remain

#### Scenario: The provider reports the mailbox is gone

- **WHEN** a check reports that the watched mailbox no longer exists
- **THEN** it SHALL raise no notification
- **AND** it SHALL clear the alarm
- **AND** it SHALL not remove the stored mailbox

### Requirement: The background check watches one mailbox, and it is the one this device would hand a visitor

The background check SHALL watch **one** mailbox per wake, and that mailbox SHALL be the one this
device would offer for a host it holds no association for. The choice SHALL be read through the same
function the popup and the in-page control already use, so the mailbox the background check watches
is the mailbox a visitor is handed.

**One mailbox is a rate-limit decision, stated as arithmetic rather than as a preference.** One
listing per wake is twelve requests a minute per mailbox. Two is twenty-four, still inside the
measured thirty; **three is thirty-six, outside it** — on a provider whose authenticated limit was
never measured. Watching every mailbox this device holds would have required a measurement this
change has no way to take.

**The head of that collection is the newest mailbox *written*, which is one step short of *most
recently used*, and the gap is recorded rather than closed.** A mailbox created and never inserted
sits at the head, so that mailbox is watched rather than the one last used. Closing the gap would
mean a second ordering on a record this repository deliberately keeps with one.

#### Scenario: A wake begins

- **WHEN** a wake takes a listing
- **THEN** it SHALL list exactly one mailbox
- **AND** it SHALL be the mailbox the in-page control would offer for a host with no association

#### Scenario: This device holds several mailboxes

- **WHEN** this device holds more than one mailbox
- **THEN** a wake SHALL make one listing request and not one request per mailbox

### Requirement: The side panel renders the mailbox this device holds, beside the page rather than in place of it

The extension SHALL ship a side panel that names the mailbox this device would hand a visitor,
lists that mailbox's messages, opens one and shows the one-time codes and verification links
detected in it, offers a control that puts a detected code into the page beside the panel and a
control that puts a detected value on the clipboard, **offers the mailboxes this device holds
most recently, each as a control that makes that mailbox the mailbox this panel view is about**,
and names the provider it reached — each performed through the shared mailbox session rather
than by the panel's own logic.

The panel SHALL offer a mailbox only where one exists, and SHALL report a provider failure and
an expired mailbox rather than showing an empty inbox for either. **The panel is a second place
to do what the popup already does and not a second way of doing it**: the same session, the same
parser, the same delivery seam. A panel that reimplemented any of that would be a second client
inside one client, and the boundary rule that forbids reimplementing a shared package's behaviour
already applies here.

**A control the panel offers SHALL act on the message, code or link it is beside, or — where it
is beside none of those — on the mailbox the panel is currently showing.** **A panel that renders
a caption is the same defect `page-composition` forbids on the website** — a depicted control
that would act on nothing — and the reason that rule exists applies verbatim to a shipped surface
rather than a depiction of one.

**Amendment, recorded at proposal (2026-10-12), by `panel-mailbox-choice`. This is an amendment
and not a repair, and the difference is the claim.** The requirement previously read *names*, and
the shipped panel *conformed to it*: the mailboxes this device holds were rendered as an inert
list of text with no control on any of them, and *"names"* is exactly what an inert list of
addresses does. **Nothing shipped broken, and a delta that said otherwise would put a false
sentence in the promoted spec.** What was wrong was the requirement — it described a list a
person could read where `docs/ROADMAP.md`'s M11 section says **display: recent mailboxes**, and
a panel that can only ever show the host's association or the newest address is the outcome
`side-panel-surface`'s design record named as the thing this milestone exists to avoid. So
*names* becomes *offers*, and the change is an amendment with the code conforming throughout.

**The clause about what a control acts on is widened in the same amendment, and the collision is
named here rather than left for the next reader to find.** It read *"A control the panel offers
SHALL act on the message, code or link it is beside"*, which **does not cover a mailbox chooser,
because a chooser is beside no message, no code and no link.** Left unamended, the panel would
have gained a control this requirement did not describe — and **an undescribed control is the
fake-UI defect one level up**: a boundary that stops covering the thing it exists to cover is
worse than the defect it was written for, because it reads as covered. The widened clause adds
the one other thing a panel control can act on, **and only that**: choosing among the mailboxes
this device holds is an action on the panel's own subject matter, not on any message beside it.

**The choice is transient, and that is stated as a requirement rather than left to an
implementation.** A chosen mailbox SHALL survive a re-resolution of the same host, SHALL be
discarded when the host changes, and **SHALL NOT be recorded anywhere**. The panel SHALL write
no host association, no mailbox preference and no record of the choice, and the choice a person
makes here **SHALL NOT** change what any other surface of this extension offers for any host.

**Why transient rather than recorded, because the recorded option was considered and rejected
rather than overlooked.** An association is written when an address is *inserted* on a host, and
that rule is the whole justification for the record's shape: a page can make a field take focus
by script, so a pairing recorded on a view would let any site on the internet decide which
mailbox this device offers on a host it merely mentions. **A panel choice is not a view either,
but it is an intention, and no insertion follows it.** Recording it would make a second writer
for a contract whose safety rests on there being exactly one, and it would mean that a person
merely looking at a list of addresses had changed what this device will offer on that host
tomorrow. **A choice is remembered until the page changes; a use is remembered because somebody
used it.**

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
- **THEN** the panel SHALL offer the most recent ones, most recent first
- **AND** every mailbox it offers SHALL be one this device holds
- **AND** each one SHALL be a control that can act, rather than text

#### Scenario: A person chooses a mailbox

- **WHEN** a person chooses one of the offered mailboxes
- **THEN** the panel SHALL show that mailbox's messages
- **AND** the panel SHALL say which mailbox it is showing
- **AND** the other mailboxes it holds SHALL remain offered

#### Scenario: A chosen mailbox is still there

- **WHEN** the panel resolves the same host again while a mailbox a person chose is still selected
- **THEN** the panel SHALL continue to show that chosen mailbox

**This scenario's `WHEN` was reworded at proposal, and the reason is recorded in `design.md` D10
rather than left as an apparent stylistic choice.** It read *"while a chosen mailbox is held"*, and
**held** already means *this device stores a mailbox* throughout this specification and throughout
this repository — it is the variable `held` in `Panel.tsx`, which is the result of
`loadMailboxes()`. The clause therefore named **a condition about storage** where the requirement
is about **a choice being in effect**, and **a panel with no chooser at all could satisfy it**: with
no choice ever made, `resolveForHost` returns the host's association or the newest mailbox, and a
panel would pass whenever the mailbox a person would have chosen happened to be that one. The
clause now names the selection, so the scenario can only be met by a panel holding one.

#### Scenario: The page beside the panel changes

- **WHEN** the host beside the panel changes
- **THEN** the panel SHALL return to the rule that resolves a host to a mailbox
- **AND** it SHALL offer no mailbox as being the new host's that the rule does not name

#### Scenario: A person chooses beside a page the panel cannot name

- **WHEN** the panel cannot name the host beside it
- **THEN** the mailboxes this device holds SHALL remain offered
- **AND** choosing among them SHALL change only which mailbox this panel view is about
- **AND** the panel SHALL NOT offer any mailbox as being that page's

#### Scenario: Nothing is recorded

- **WHEN** a person chooses a mailbox in the panel
- **THEN** the extension SHALL write no host association and no mailbox preference
- **AND** what any other surface of this extension offers for that host SHALL be unchanged

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

### Requirement: The side panel states, per message, whether a detected verification was found in it

The side panel SHALL state, for each message in the listing of the mailbox the panel view is about,
whether that message was determined to carry a detected one-time code, a detected verification link,
or both. The statement SHALL be derived from the shared session's own listing and SHALL NOT be
computed by the panel from anything else.

**The panel SHALL distinguish a message the session has read and found to carry nothing from a
message it has not been able to read.** These are different claims about the mailbox and the panel
SHALL NOT render them identically: a message carrying a detected verification SHALL carry a marking in
its listing row naming what was detected, a message read and found to carry none SHALL carry no
marking, **and a message the session has not determined SHALL carry a marking on its own row stating
that it could not be read.** A listing that has not been determined in full SHALL NOT be reported as a
mailbox holding no detected verification.

**The marking SHALL be text naming what was determined, and a message the session has not determined
SHALL NOT be presented as carrying a detection.** A marking that asserted the presence of a
verification for a message nobody read would send a person to look for a code that was never found,
which is the one false claim this product exists to avoid.

**The panel SHALL NOT render a confidence value, a percentage, or a claim that a message carries no
verification.** What the session found is not what a message contains: the parser's confidence is
capped by construction rather than by a clamp, and a message that reduces a detection's score is
still returned rather than excluded. The panel's wording therefore reports **what the session
determined** and never certifies what the message holds.

**The panel SHALL NOT obtain this state any other way.** It SHALL NOT read a message body itself,
SHALL NOT make a provider request to determine it, and SHALL reach it only through the shared
session's listing. **A panel that read bodies to decide a row would spend a provider request per
message to recompute an answer the session already holds** — which is the waste
`background-check.ts`'s use of `restoreSummaries` exists to avoid, recorded there as a measured
repair.

**Nothing about this state SHALL be stored.** The panel SHALL write no stored verdict, no new
storage record and no preference, and a statement made on one occasion SHALL NOT be offered on a
later occasion as though it were current. **A stored verdict would outlive the body, the parser that
produced it and the request that asked for it, and a stale marking is read as a current one.**

**This clause is about surviving the session, not about the session's own retention.** The shared
session already holds an analysis against a message so that it is never determined twice, and keeps a
last known listing when a check fails; a statement made from what that session holds is the session
doing what it is required to do. **A later occasion is a later panel, a later session or a later
build** — and a message the session *did* read SHALL NOT be marked as unreadable merely because the
check after it failed.

**Amendment of record at proposal (2026-10-12), by `panel-verification-state`. This requirement is
ADDED rather than folded into *"The side panel renders the mailbox this device holds, beside the page
rather than in place of it"*, and the reason is that a reader must be able to review this change's
sentence separately.** The panel requirement is 141 lines and was amended the previous day, so a
`MODIFIED` block would carry all of it verbatim and this change's own words would have to be found by
diffing two long blocks by eye — the shape in which an amendment gets attributed to the wrong
assertion. The claim is also separable: it is about a listing's content and depends on none of the
host-naming, mailbox-choosing or transient-choice clauses.

**The promoted specs forbid no such statement anywhere in this repository, and this requirement is
positive rather than permissive anyway.** Exactly two clauses forbid a surface from indicating a
verification and **both name the popup** — *"The popup SHALL NOT indicate that a message carries a
verification until it has opened that message"*, inside a requirement headed *"The extension's popup
performs its first milestone's actions over the shared session"*, with its scenario *"A check has
listed messages"*. **A panel is therefore not forbidden, and not being forbidden is not being
permitted** — so the permission is stated here rather than inferred from an absence.

**The two surfaces render one component, which is why this clause has to be positive in the sharpest
possible way.** `MessageSurface.tsx` exists because `Popup.tsx` and `Panel.tsx` need the same list,
and both import the same `MessageList` — so a marking implemented in it **reaches the popup**, whose
prohibition and whose *"A check has listed messages"* scenario describe exactly the state it would be
rendered in. **A marking on a listing SHALL be produced only for a surface that asks for it, and a
surface that does not ask SHALL render its listing exactly as it does without this requirement.** The
absence of the marking is the default and not an exception, so a surface that never asks for one
cannot acquire one by omission.

**The popup's own reasoning is about carrying rather than about surfaces, and it does not reach
this requirement.** It reads that *"the count the popup showed before is the whole of what a listing
can support, and a marker the listing cannot carry would be a guess about a message nobody has
read."* **The panel's listing does carry it:** `packages/mailbox` determines the verdict, holds it
against the message so it is never determined twice, and reports it on the listing type itself —
which the promoted requirement headed *"A message is analysed once, and only when it is new"* already
obliges. The marking is a fact the session produced, not a guess about a message nobody read.

**The scheme is the website's, not this change's.** `apps/web` already renders this union with an
**exhaustive marking for every verdict including the empty one**, and it already marks a message it
could not read **in words on that row** while withholding the visual claim reserved for the positives.
**The panel states the same thing the same way**, because two clients rendering one shared union
differently is the divergence a closed record exists to prevent. **What the panel does not take is
the website's closed set of positive verdicts, which exists to decide which rows draw an accent
rule: this requirement adds no accent rule, and a named set with no consumer is a second thing to
keep in step.** The clause it served — that an undetermined message is not presented as carrying a
detection — is met here by the marking itself, which names that the message could not be read.

#### Scenario: A message carries a detected verification

- **WHEN** a message in the mailbox the panel is about was determined to carry a detected one-time code or a detected verification link
- **THEN** the panel SHALL mark that message's row
- **AND** the marking SHALL name which was detected rather than naming both

#### Scenario: A message was read and carries nothing

- **WHEN** a message in the mailbox the panel is about was read whole and no verification was detected in it
- **THEN** the panel SHALL carry no marking on that message's row
- **AND** the panel SHALL NOT state that the message carries no verification

#### Scenario: A message could not be determined

- **WHEN** a message in the mailbox the panel is about has not been determined
- **THEN** that message's row SHALL carry a marking stating that the message could not be read
- **AND** that row SHALL NOT be marked as carrying a detected verification
- **AND** the panel SHALL NOT report it as a message it determined carries nothing

#### Scenario: The listing is not yet determined in full

- **WHEN** the panel's listing holds messages whose verdicts are not all determined
- **THEN** the panel SHALL NOT state that the mailbox holds no detected verification

#### Scenario: A check failed and the last known listing is shown

- **WHEN** the panel shows a listing the session determined on an earlier check
- **THEN** each row SHALL carry the marking that listing's own verdicts give it
- **AND** a row whose message was read SHALL NOT be marked as a message that could not be read

#### Scenario: The panel states what the session holds

- **WHEN** the panel states a message's verdict
- **THEN** it SHALL read that verdict from the shared session's own listing
- **AND** it SHALL make no provider request of its own to determine it
- **AND** it SHALL read no message body of its own

#### Scenario: Nothing is stored

- **WHEN** the panel states what the session determined about a message
- **THEN** the extension SHALL write no stored verdict and no new storage record
- **AND** a later occasion SHALL NOT offer that statement as though it were current without
  determining it again

### Requirement: The side panel offers to remove what this device holds, and says what that removed

Where the side panel has established that this device holds something, it SHALL offer a way to
remove it and SHALL say what removing it means. **The offer SHALL require an explicit further step
before anything is removed, and the control that performs the removal SHALL exist only in that
confirmed state** — a panel whose removal control was present before the further step would make the
confirmation a formality. Removal SHALL be reported honestly whatever its outcome.

**Removal SHALL remove everything this device holds, and it SHALL reach that through the shared
storage contract's whole-area operation rather than by naming the records this build recognises.**
The extension keeps four record kinds over one `chrome.storage.local` area — the single stored
mailbox, the collection of mailboxes, the site associations, and the message ids this device has been
told about — and the panel names none of them. **A removal that removed only the records the panel
knew by name would pass every test written against those four**, and the record kind it left behind
is precisely the kind a person asking to be forgotten would be asking about.

**After a completed removal the panel SHALL report that it holds nothing for SpectreMail**, rather
than continuing to render an inventory this device no longer has. **What the panel's copy states is
that removal deleted _this device's note of_ the mailbox**, and it SHALL NOT claim that the address is
gone: the mailbox exists at the provider, and this product is not the provider's authority on when it
discards one. **The mailbox SHALL remain on screen and its inbox SHALL remain usable afterwards**, and
the panel SHALL NOT write that mailbox back into storage while the person does nothing further.

**Removal SHALL be reached only through the contract**, and the panel's record type SHALL gain no
member that writes. A surface that could both remove and record is a surface whose write-back the
next change could add without this requirement noticing; the property that the panel does not restore
what a person removed is discharged by the type having no outlet, not by a scan for the absence of
one.

**Every sentence the region shows SHALL be a `PANEL_COPY` entry.** That module exists so a claim is
reviewable beside the requirement it serves and a test can read what the panel says without scraping
rendered text for it, and a sentence written inline in the component is a claim a reviewer reads in
its markup context rather than beside its requirement.

**Note, recorded at proposal (2026-10-13), by `extension-clear-data`.** This requirement is `ADDED`
to `extension-client` and is deliberately **not** a copy of `website-client`'s *"The user can make this
device forget the address"*, though that requirement is the model for four of its clauses: `design.md`
D1 names the four website clauses that do not transfer and why. **Two are absent rather than
rewritten** — the panel renders no description of what it stores, so the website's *"SHALL NOT
describe stored data as undeletable while offering no way to delete it"* clause has nothing to govern
here and `extension-client`'s *"The extension declares its non-goals"* is the nearer analogue; and the
website's refusal copy about closing another tab is a claim about `deleteDatabase`'s blocked-removal
queueing, which **this substrate cannot produce at all** (`packages/storage/src/chrome.ts:218` records
that `chrome.storage` provides no `deleteDatabase` and therefore no blocked-removal event).

**And the gap this closes is written into a promoted requirement**, at
`openspec/specs/spectre-storage/spec.md:702`–`:709`: *"The extension ships no control that removes
it… That gap is pre-existing for the extension's other two record kinds and is not closed here."* Both
halves of that sentence are false the moment this control ships, and the prose is corrected by the
second `MODIFIED` block in this change's `spectre-storage` delta rather than left standing.

#### Scenario: This device holds something

- **WHEN** the panel is displayed and it has established that this device holds something
- **THEN** it SHALL offer a way to remove it
- **AND** it SHALL NOT offer that way before the boot read has established anything

#### Scenario: Removal is confirmed before it happens

- **WHEN** the panel offers removal
- **THEN** the control that performs the removal SHALL exist only after a further explicit step
- **AND** nothing SHALL be removed before that step is taken
- **AND** the further step SHALL be a region this panel renders rather than a dialog the platform owns

#### Scenario: The confirmed removal takes everything

- **WHEN** the further step is taken
- **THEN** everything this device held SHALL be removed through the storage contract's whole-area
      operation
- **AND** it SHALL NOT be removed by naming the record kinds this build recognises
- **AND** a record kind written through a contract the panel never named SHALL be removed with it

#### Scenario: The panel reports holding nothing afterwards

- **WHEN** removal has happened
- **THEN** the panel SHALL report that it holds nothing for SpectreMail
- **AND** it SHALL offer no further removal

#### Scenario: What removal means is stated

- **WHEN** removal has happened
- **THEN** the panel SHALL say that what was removed is this device's note of the mailbox
- **AND** it SHALL NOT state or imply that the address itself is gone
- **AND** it SHALL say the address still works until the provider discards it

#### Scenario: The mailbox stays shown and is not written back

- **WHEN** removal has happened and the person does nothing further
- **THEN** the mailbox SHALL remain on screen
- **AND** its inbox SHALL remain usable
- **AND** the extension SHALL write no storage record of that mailbox again

#### Scenario: Removal is refused

- **WHEN** removal fails
- **THEN** the panel SHALL say it did not happen
- **AND** it SHALL NOT describe the data as removed
- **AND** it SHALL NOT state that the data remains

#### Scenario: This device holds nothing

- **WHEN** the panel is displayed and this device holds nothing
- **THEN** it SHALL offer no removal
- **AND** it SHALL say that nothing is kept on this device

#### Scenario: What the panel knows is not yet established

- **WHEN** the panel has not established whether this device holds anything
- **THEN** it SHALL NOT say that something is kept
- **AND** it SHALL NOT say that nothing is kept

### Requirement: The extension renders provider-supplied content as text

The extension SHALL render every value that came from a provider — a sender, a
subject, a readable message body, a detected code, a detected link and its host — as
text, and SHALL insert none of them into the page as markup.

**This requirement exists because the property is already enforced and was not
stated.** A boundary rule in `tests/architecture/boundaries.test.ts` keeps a markup
escape hatch out of **every** client, and it fires on this extension's files. **A rule
that fires without a requirement behind it is a rule whose removal nobody would
notice**, because the document that justified it names the other client and not this
one.

The website states the same property for itself in `website-client`, and
`shared-domain-model` and `provider-adapters` both state that message bodies are
carried as untrusted text. **This is the third place that property is written down,
which is the point rather than the problem**: it is written down per client, because a
client that stopped rendering provider content as text would be a defect in that
client, and a requirement filed under another client's capability would attribute it
to the wrong assertion.

The extension renders provider content in **two** shipped surfaces and neither is a
standalone document: the popup and the side panel share one message surface. **That is
recorded here rather than left for a reader to discover**, because a shared component
serving two surfaces is the shape where one surface's requirement can be satisfied by
the other's implementation.

#### Scenario: The extension's sources are inspected

- **WHEN** every file under the extension client is scanned
- **THEN** no file SHALL contain a markup escape hatch
- **AND** the scan SHALL cover every file under the client rather than a named
  subset, so that a new surface is covered by being created

#### Scenario: A message is shown in the popup or the panel

- **WHEN** the extension renders a sender, a subject, a message body, a detected
  code or a detected link
- **THEN** each SHALL appear as text content of an element
- **AND** no value received from a provider SHALL be inserted as markup

#### Scenario: A detected link is offered

- **WHEN** a detected verification link is rendered
- **THEN** its destination SHALL be one the parser has already restricted to `http`
  and `https`, which `mail-parsing` already requires
- **AND** the extension SHALL NOT widen that set at the point of rendering

#### Scenario: The control is rendered inside somebody else's page

- **WHEN** the content script renders its address control inside a third party's
  document
- **THEN** that control SHALL render its own content as text as well
- **AND** it SHALL NOT place a value received from a provider into the page as
  markup

### Requirement: The extension's surfaces render the one public name, and its manifest's two name fields agree

Every extension surface that names the product SHALL render the exported public name,
and the two distinct name fields in the extension's manifest SHALL both carry that value.

**The extension names the product in eight surfaces, and they are checked by two different
mechanisms because they are two different kinds of thing.** Four are **build inputs** —
the manifest's `name`, the manifest's `action.default_title`, the popup's document title
and the side panel's document title — and no module imports any of them. Four are
**components**: the popup's heading, the side panel's heading, and one heading in each of
the two composition roots, in the branch taken when that client's own storage could not be
read.

**Amendment, recorded during apply (2026-10-16).** This said *six* surfaces and *two*
components. The extra two are `main.tsx` and `panel-main.tsx`, each rendering a heading as
a bare literal in the storage-not-readable branch, and **the root orchestrator's own
measurement is the source of the wrong figure** — the table this delta was written from
listed the files it had read and did not read these two. The requirement's own instrument
found them from the other direction: every place the shipped tree holds the name must be
declared, and two places were not declared. **The count in a requirement is a measurement,
and this one was a reading**, which is the difference this repository has recorded most
often.

**The side panel already does this and is the pattern the other seven should adopt.**
`panel-copy.ts` holds the name as a copy constant and the panel renders it in three
places, so **one value renders three times**. Ten lines away, in the same directory, the
popup's heading is spelled as a bare literal **three times in one component**, beside a
`popup-copy.ts` that already exists. **A requirement that generalises an instance this
repository already got right is narrower and harder to misread than one asking for a new
idea**, and this is that requirement.

**The manifest's two name fields are separate obligations, and nothing in this repository
currently relates them.** `name` is the extension's listing name — the text the store
shows and the text that identifies the published extension — and `action.default_title` is
the toolbar tooltip. **They are the same string today by coincidence of authorship.** A
change that renamed one and not the other would publish a listing named one thing beside a
toolbar named another, and **every test in this repository would stay green**, because no
test can read a store listing.

**These build inputs are exactly where a rename is most likely to be missed.** They are
not in the TypeScript graph, so a change that updates components and copy is not required
to see them.

**What this requirement does not say.** It does not say every occurrence of the name in a
shipped file is the name. `"SpectreMail could not read its own storage, so it will not
create an address"` is copy that is correct, and `"Use SpectreMail"` is a control label
whose text is a phrase about the product rather than the product's name. **The property is
about the surfaces where the product names itself**, and it is checked against a declared
map of those surfaces rather than by a scan for the string — a scan would also fire on the
browser tier's own planted fixtures, which is a failure mode this repository has recorded
five times.

#### Scenario: The popup and the panel are rendered

- **WHEN** the popup renders its heading and the panel renders its heading
- **THEN** each SHALL render the exported public name
- **AND** no shipped extension component SHALL hold the name as a bare literal in place
  of that value

#### Scenario: A build input is checked

- **WHEN** the manifest and the two extension HTML documents are read from disk
- **THEN** the manifest's `name` and the manifest's `action.default_title` SHALL both be
  the exported public name
- **AND** both documents' `<title>` elements SHALL be the exported public name
- **AND** the check SHALL read each file, because no module imports a build input

#### Scenario: The two manifest name fields disagree

- **WHEN** the manifest's listing name and its toolbar tooltip are not the same string
- **THEN** that SHALL be reported by name
- **AND** the report SHALL name both fields rather than report a count

#### Scenario: An extension surface names the product and the map does not

- **WHEN** the shipped extension names the product as the product from a place the map
  does not name
- **THEN** that place SHALL be reported by name
- **AND** the report SHALL distinguish a surface that renders the name from a copy
  string or a control label that contains it

### Requirement: The extension reports its own outcomes on the same terms, and names the conflicts it can see

The extension SHALL report, to the person using it, **the outcomes of the session in progress**,
under the same terms the website reports its own: **counts and normalized outcomes only, never an
address, a message id, a sender, a subject, a hostname, a URL, or content**, and **persisted
nowhere**.

**The extension has one outcome the website does not, and the product already knows it.** The
in-page recogniser answers with its own vocabulary — a field was filled, no field was found, the
field already held text, the frame was not the top one, the request was not its own — and **that
answer is exactly the "email-field injection failures" the roadmap's beta goals ask for.** It is
already produced, already normalized, and **already says why**, which is the whole of what a
failure count is worth.

**Amendment, recorded during apply (2026-10-19).** This requirement previously carried a clause
about **a UI conflict** — the extension's control living in a shadow root, and the control being
able to tell that it is not visible on the page it is beside.

**That clause is withdrawn, and the reason is a channel rather than a difficulty.** The content
script is the only party that can see its own control, and **the extension has no existing message
kind that asks it about anything but the host it is beside or a field to fill.** Adding one is a
protocol change, and **a protocol change is a different change from this one** — the same argument
`mailbox-history` used when it recorded that the browser tier could not produce a provider
delivery this repository has never received.

**The measurement is real and the gap is recorded rather than dropped.** The conflict is
**partly collectable** — the control can see that it is not visible — and `docs/BETA.md` says so,
in the *"what is not collected and why"* section, with what would be needed to collect it. **A goal
recorded as unmeasured with its reason is a goal the next reader can pick up; a goal quietly
dropped is a goal that looks collected.**

**And a second amendment, recorded during apply (2026-10-19): the shape is two, not three.** The
shared definition this requirement names once carried **an elapsed duration** as a third kind, and
it is withdrawn. **The website's page forbids any interval of the product's own** -- its own test
says so: *"any figure here would be an invention presented as a measurement"* -- **and the panel
had never shown one either**, so **a report would have been the first place the product showed a
figure of its own.** The shape is removed rather than kept and unused, **because a shape with no
consumer is a schema to migrate rather than a feature.**

**The extension's stored records are unaffected by this requirement.** A mailbox, a site
association and a seen-message id are **records the product keeps for the product's own reasons**;
a diagnostic is a report of what happened, and the two are not the same kind of thing.

#### Scenario: The in-page outcome is reported

- **WHEN** a person asks the extension what this session has done
- **THEN** it SHALL report the in-page recogniser's own answer for each attempt — a field filled, no
  field found, the field already held text, the frame was not the top one
- **AND** it SHALL report a count for each of those answers


#### Scenario: The diagnostic is read for what it must not hold

- **WHEN** the extension renders the diagnostic
- **THEN** no address, message id, sender, subject, hostname, URL or content SHALL appear in it
- **AND** every value it shows SHALL be a count or a normalized outcome

#### Scenario: The session ends

- **WHEN** the extension's session ends
- **THEN** nothing it reported SHALL remain on the device
- **AND** no record of it SHALL be written to any store, in any area
- **AND** the extension's own stored records SHALL be unaffected
