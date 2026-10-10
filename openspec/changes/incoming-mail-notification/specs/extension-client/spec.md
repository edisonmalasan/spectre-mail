# Spec Delta

Replaces one of `extension-client`'s six requirements, amends two, and adds five.

The first amendment is the one this capability's own text asks for: its *"A later milestone adds a
declared surface"* scenario requires the milestone that adds a forbidden surface to amend the
requirement rather than delete the assertion, and the notification is that surface.

The replacement is the no-polling requirement. It is **removed and re-added** rather than modified,
and the reason is recorded in the block itself: a `MODIFIED` block keeps the requirement's heading,
and this one's reads *"carries no polling until its lifetime is measured"* — a title that would
contradict the body it then carries. This is the same reason `verification-actions` removed rather
than modified. **What replaces it carries forward both clauses of the old one that still bind** — the
reconciliation with the shared cadence, and the prohibition on any document claiming a background
cadence this repository has not observed — so nothing is lost with the deletion.

The third amendment is a repair this change did not plan and found while reading the delta against
the spec: the popup requirement justifies its user-asked listing with *"because no background polling
exists in this milestone"*, and that reason is about to become false while its substance stays true. A
justification that has stopped being true is corrected in the change that makes it so, which is the
rule this repository applies to its own documents and which applies to a promoted spec for the same
reason.

**The arithmetic is stated here so it can be checked against the promotion rather than discovered
there.** `extension-client` goes **6 requirements to 10** — one removed, five added, two amended in
place — and **24 scenarios to 35**: the three the removed requirement carried come off, thirteen
arrive with the new requirements, and one more arrives with the amended popup. `spectre-storage` goes
**15 to 16** requirements and **51 to 57** scenarios. Across all capabilities the requirement total
moves **157 to 162** and the scenario total **478 to 495**. No other capability is touched, and
`apps/web`'s requirements are not among them.

## REMOVED Requirements

### Requirement: The background service worker carries no polling until its lifetime is measured

**Reason for removal.** The requirement existed to gate this change on a measurement, and the gate is
now discharged — but two of its three clauses still bind, so it is removed and **replaced rather than
dropped**, and the replacement carries both of them forward.

**The sentence that made it wrong is deleted rather than reworded.** It read that *"`chrome.alarms`
enforces a floor of its own"* and that *"the relationship between those facts has not been measured
in this repository"*. `alarms-packing-interval` measured it and **no floor was observed**: a 5 000 ms
alarm fired 24 times in 120 seconds at a mean spacing of 5 000 ms
(`docs/PROVIDERS.md` §4.1.1). A floor this repository cannot find cannot remain the stated reason a
polling loop is forbidden, and keeping it in a promoted spec would put a number nobody observed into
the record a future change reads.

**What is discharged and what is not.** The *"SHALL measure"* clause is satisfied and gone, because
the measurement exists and is recorded where this requirement said it would be. The
*"effective cadence SHALL be reconciled explicitly with the shared cadence"* clause and the *"no
document may claim a background polling cadence this repository has not observed"* clause **still
bind**, and both are carried into the requirement that replaces this one — the second as its own
scenario, because a rule that stops being asserted stops being true.

#### Scenario: The worker is inspected

- **WHEN** the extension's service worker source is read
- **THEN** it SHALL schedule no repeated provider request
- **AND** it SHALL create no alarm

#### Scenario: A change needs a background poll

- **WHEN** a change would place the polling session in a background context
- **THEN** the recorded measurement SHALL already exist
- **AND** the effective cadence SHALL be reconciled explicitly with the shared cadence rather than
  diverging from it silently

#### Scenario: The measurement has not been taken

- **WHEN** the service worker's lifetime has not been measured in this repository
- **THEN** no requirement may state what the worker can sustain
- **AND** no document may claim a background polling cadence this repository has not observed

## MODIFIED Requirements

### Requirement: The extension declares its non-goals as requirements rather than leaving them absent

The extension SHALL NOT declare a side panel, a one-time-code copy control, or a verification-link
control in this milestone, and each absence SHALL be asserted. A declared surface that renders
nothing or acts on nothing is fake UI, which this product does not ship: the side panel belongs to
the side-panel milestone and the remaining verification controls to the workflow milestone.

An absence that is merely an omission reads as an oversight and is eventually filled in by whatever
change touches the file next. Asserting it makes the boundary deliberate, and makes the milestone
that does own the surface the only one that may add it.

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

**The manifest clause of the first scenario becomes load-bearing again, and this time in the other
direction.** It reads *"it SHALL request no permission that no shipped surface uses"*, and
`in-page-fill` recorded that it became load-bearing because its delivery needed no permission at all.
**This change is the other case.** `alarms` and `notifications` are added, and this clause is what
makes them honest: a permission declared for a surface this extension does not ship is exactly what
it forbids, and each of the two is traceable to a requirement in this delta that could not be met
without it.

#### Scenario: The manifest is read

- **WHEN** the extension's manifest is read
- **THEN** it SHALL declare no side panel
- **AND** it SHALL declare the content script its in-page surface needs
- **AND** it SHALL request no permission that no shipped surface uses

#### Scenario: A later milestone adds a declared surface

- **WHEN** a milestone adds a surface this requirement forbids
- **THEN** it SHALL amend this requirement in its own change rather than deleting the assertion

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

## ADDED Requirements

### Requirement: The background service worker owns exactly one alarm and holds nothing between its wakes

The extension's background service worker SHALL create **exactly one** `chrome.alarms` alarm, SHALL arm
it when this device first holds a mailbox, and SHALL re-check it on every browser start rather than
assume it survived. Its period SHALL be the shared session's prompt delay, **taken from
`packages/mailbox`'s cadence at the point of use rather than restated**, so there is no second place
for the number to live.

The worker SHALL hold nothing between wakes. Each wake SHALL build its own session, take one listing,
and release that session before the wake ends.

**"Exactly one" is a measurement, and it is why this is a requirement rather than a preference.**
Armed together on Chromium `153.0.8010.12`, a 5 000 ms and a 30 000 ms alarm produced **24 and 0
firings in 120 seconds** — the slower one was never scheduled, not scheduled late
(`docs/PROVIDERS.md` §4.1.1). A second alarm in this extension is therefore not a second feature; it
is the only way this extension could stop notifying at all.

**The period was reconciled against the shared cadence by taking it from there, which is what
"reconciled explicitly" means here.** A literal would be a silent divergence waiting for the cadence
to change. The cost is stated rather than assumed: one listing per wake at that period is **twelve
provider requests a minute**, against a `GET /messages` budget of `30; w=60` which
`docs/PROVIDERS.md` records as **measured unauthenticated only, with the authenticated policy never
separately measured**. Twelve is inside the only budget this repository has evidence for; that is a
statement about a number, not a demonstration that a provider tolerates it.

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

### Requirement: A message that arrives raises a notification naming its sender and its subject

The extension SHALL raise one notification for each message in the watched mailbox whose id this
device has not already been told about, and that notification SHALL carry **the sender and the
subject, and no other value from the message**.

**The notification SHALL NOT carry a one-time code, and that is structural rather than a filter.** A
notification is readable on a lock screen, in an operating system's notification centre, and through
device pairing — every one of them outside the browser, and therefore outside every privacy control
this product enforces. A `MessageSummary` carries no body at all, by product principle
(`packages/core`: *"listing a mailbox must not require fetching bodies"*), so a notification built
from a summary **cannot** contain a code, and the check that raises it **never opens a message**.

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

- **WHEN** the platform answers a `create` with a null id
- **THEN** the wake SHALL NOT record that message as one this device has been told about
- **AND** a later wake SHALL raise it again

#### Scenario: A notification is raised without the shipped icon

- **WHEN** a notification is raised without the raster icon this extension ships
- **THEN** the platform SHALL be asked for a notification it does not hold
- **AND** no requirement above is satisfied by the callback resolving

#### Scenario: A build whose output carries no icon

- **WHEN** the built extension output does not carry the shipped icon file
- **THEN** the build SHALL fail
- **AND** no notification requirement above is claimed to be met

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

#### Scenario: This device has watched nothing yet

- **WHEN** a check finds no record for the watched mailbox
- **THEN** it SHALL raise no notification for the messages that listing returned
- **AND** it SHALL record those message ids

#### Scenario: The listing has not changed

- **WHEN** a check finds the same set of message ids it already held
- **THEN** it SHALL raise no notification
- **AND** it SHALL not rewrite the record

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