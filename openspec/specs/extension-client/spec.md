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
