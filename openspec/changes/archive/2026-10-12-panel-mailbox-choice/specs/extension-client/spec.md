# Spec Delta

## MODIFIED Requirements

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
