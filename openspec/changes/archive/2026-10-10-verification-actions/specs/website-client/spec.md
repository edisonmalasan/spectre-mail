# website-client Specification Delta

## REMOVED Requirements

### Requirement: This slice shows what it found and does not act on it

**Reason for removal.** Every clause of this requirement is a prohibition, and this slice
delivers two of the three things it prohibits. Nothing of it survives to be restated.

It was not left standing as a `MODIFIED` block, and the reason is worth recording rather
than tidying away. A `MODIFIED` block keeps the requirement's **heading**, and that heading
reads *"shows what it found and does not act on it"* - so a modified version would carry a
title stating the exact opposite of what the requirement then says. A heading that
contradicts its own body is worse than no requirement, because a reader scanning titles
believes the title. Removing it and adding the rule that replaces it states both halves
honestly: the page used to act on nothing, and now it acts only when asked.

**What replaces it.** `A detection is acted on only when the user asks` carries the whole
of the surviving property - that rendering a message follows nothing and copies nothing -
and `A detected one-time code can be put on the clipboard` and
`A detected verification link is opened only by the user` carry the two new actions.

#### Scenario: A message is open

- **WHEN** a message showing codes or links is open
- **THEN** no copy control SHALL be offered for a code
- **AND** no detected link SHALL be followed by rendering the message

#### Scenario: A detected link is shown

- **WHEN** the page shows a verification link found in a message
- **THEN** it SHALL be shown as text
- **AND** the destination host SHALL be visible

**Note, recorded at this slice's proposal.** The removed requirement also carried the
conflict between two sources that `design.md` D4 records: `docs/ROADMAP.md`'s M5
acceptance criteria list "copy the OTP" as something a user must be able to do in M5, while
`AGENTS.md` assigns "OTP copy/fill" to the verification workflow milestone. **This slice
resolves that conflict in the roadmap's favour and not `AGENTS.md`'s**, and says so here
rather than leaving the resolution to be inferred from a deleted block.

The reason is that the conflict was never between two capabilities but between a *plan* and
a *schedule*. A roadmap milestone's acceptance criteria are the conditions that milestone is
allowed to be considered done; re-scheduling a criterion to a later milestone is a planning
decision, and this slice makes it deliberately, in the open, rather than leaving
`docs/ROADMAP.md` claiming M5 ships a copy control that M5 did not ship and did not need to.
The criteria list is **not** edited - a plan's exit conditions are not amended from inside
the slice that finally discharges them - and the deletion above is the record of what was
owed and when it arrived.

## MODIFIED Requirements

### Requirement: The page's limits are stated in its footer

The list of what the page can and cannot do SHALL be rendered in the page's footer rather than
in a region between the product and the end of the page, and SHALL keep its current content:
which provider it reaches, what it does with messages, that it copies a code only when
asked and opens a link only when asked, and that no server is involved. The footer SHALL
state the same facts, and SHALL NOT drop a limit to make room for a section.

**Note, recorded during proposal (2026-10-06).** The limits list is **not** being removed or
shortened, and this requirement says so in terms that can be checked rather than in terms that
can be admired. Its bullets are each a measurement or a promoted requirement: the provider
is the measured CORS one from `provider-config.ts`, the code-and-link sentence was `website-
client`'s own *"This slice shows what it found and does not act on it"* — a requirement this
slice **removes**, so this note names it as it stood on 2026-10-06 — and the no-server
sentence is the architecture rule that SpectreMail never proxies a provider. Moving them to a
footer is a placement change; the claims travel with them intact.

The reason the placement changes at all is that the list reads as an apology in the middle of
a page. As a footer it reads as a specification, which is what it is.

**Amendment, recorded at this slice's proposal (2026-10-09).** Two corrections to the note
above, both because a promoted spec must not carry a claim its own text contradicts. Its
**count** read *four* bullets while `apps/web/src/sections.ts`'s `LIMITS` holds **five** and
the note then enumerated **three** of them — the storage sentence is deliberately absent, and
`LIMITS`' own documentation says why — so the count is replaced by no count at all, and the
code-and-link cross-reference is stated in the past tense because the requirement it names is
removed by this same change. **A cross-reference that reads as live and points at a
requirement this change deleted is the same defect as a sentence in the footer that stopped
being true**, and this repository has now found that defect in three separate documents
about one bullet. The count was wrong before this change and was carried forward silently
through four syncs, which is the whole argument for checking arithmetic at promotion rather
than only when a number is being published.

The paragraph the delta dropped from this requirement is **restored** rather than lost. It
is not superseded — the placement rationale stands unchanged by two actions being permitted —
and the rule that a `MODIFIED` block must preserve what the delta does not mention applies to
prose as much as to scenarios, because `openspec validate` enforces only the scenarios and
would not have reported the loss. **A validator that cannot see the defect is not a reason to
ship it.**

**Amendment, recorded at this slice's proposal (2026-10-09).** The code-and-link sentence
changes and the rest of this requirement does not. The third bullet used to read that the
page *"does not copy codes or follow links for you"*, which named
`This slice shows what it found and does not act on it` as its basis. **That bullet became
false the moment this slice's copy control and link shipped**, and a false sentence printed
in a footer is the worst kind of stale claim this repository has: it is the one place a
visitor reads what the product will not do.

The bullet is therefore **reworded rather than dropped**, and the count stays five. The
requirement's own clause - *"no limit SHALL be dropped to make room for a section"* - does
not cover this case, and pretending it does would be reading the rule to suit the change: the
bullet was not dropped for space, it was dropped because it had become untrue. What the
clause does forbid, and what this amendment keeps forbidding, is a limit being **removed**
while its subject is still true.

The replacement sentence names the same two actions the requirement now permits and the same
condition the requirement now imposes - the user's asking - so the footer states a limit
rather than a capability. **A page that says what it will not do on its own is more
trustworthy than one that lists what it can do**, and this product's direction is restraint,
so the footer keeps stating the boundary rather than switching to advertising the new
controls.

#### Scenario: The limits are read

- **WHEN** a visitor reads the page's footer
- **THEN** it SHALL state which provider the page reaches and that no other
- **AND** it SHALL state that the page copies a code and follows a link only when asked
- **AND** it SHALL state that no server is involved and no provider request is relayed

#### Scenario: A section needs the space

- **WHEN** a section is added to the page
- **THEN** no limit SHALL be dropped from the footer
- **AND** no limit SHALL be reworded into something the product cannot support

#### Scenario: The storage claim is placed

- **WHEN** the footer states what this device keeps
- **THEN** it SHALL point to the region that offers the removal control
- **AND** it SHALL NOT restate a guarantee about storage that the region itself owns

## ADDED Requirements

### Requirement: A detection is acted on only when the user asks

Opening a message SHALL copy nothing, follow nothing, and submit nothing. Rendering a
message — including rendering a code or a link — SHALL NOT be the cause of a clipboard
write, a navigation, or a form submission.

The two controls this slice adds are reachable only by an explicit user action, and this
requirement is what makes that a property of the page rather than of the two components
that happen to implement it. **It is stated separately from the two action requirements
below because those two describe what the page does when asked, and this one describes
what it does when nobody asks** — a claim the removed requirement used to carry as a
prohibition, and which would otherwise have been retired with it.

#### Scenario: A message is opened and read

- **WHEN** a user opens a message carrying codes and links
- **THEN** nothing SHALL be copied to the clipboard
- **AND** the page SHALL NOT navigate anywhere
- **AND** no form SHALL be submitted

#### Scenario: A message stays open

- **WHEN** an open message remains on screen without further interaction
- **THEN** the page SHALL NOT act on any detection it carries

### Requirement: A detected one-time code can be put on the clipboard

The website SHALL offer a control that places a detected one-time code on the clipboard,
and SHALL offer **one per detected code** rather than a single control acting on whichever
code the page judges most likely. Each control SHALL have a name that says which code it
copies, and the copied value SHALL be the detected value unchanged. If the clipboard
cannot be written, the website SHALL say so rather than appear to have succeeded, and the
code SHALL remain visible and selectable.

**Note, recorded at this slice's proposal.** This requirement mirrors the mailbox-address
copy requirement in the same capability almost clause for clause — unchanged value, a
confirmation, a reported refusal, a control whose name says what it copies — and the
mirroring is deliberate rather than convenient. **The address control was built first and
is the only place in this product that has already answered the hard question this control
raises**, which is what a page does when the clipboard refuses. Answering it a second way
would give the page two failure vocabularies for one platform behaviour.

**Why one control per code, stated because it looks like a worse interface.** A single
"copy code" control would be less to read and would copy whichever candidate the page ranked
first. But `mail-parsing` guarantees that no detection is ever reported as certain, and
`website-client` already requires the page to say its detections may be wrong — so the page
cannot know which candidate the user wants, and a control that resolves that question on
the user's behalf is the page guessing at the one thing it has just told the user it cannot
know. **The ranking still orders the list; it does not choose from it.**

#### Scenario: A code is copied

- **WHEN** the user activates the copy control for a detected code
- **THEN** that code SHALL be placed on the clipboard unchanged
- **AND** the website SHALL confirm the copy happened
- **AND** the control's accessible name SHALL name the code it copies

#### Scenario: The clipboard refuses a code

- **WHEN** a code's copy control is used and the clipboard is unavailable or refused
- **THEN** the website SHALL report that the copy did not happen
- **AND** the code SHALL remain visible and selectable

#### Scenario: Two codes are detected

- **WHEN** a message carries two or more detected codes
- **THEN** each SHALL have its own copy control
- **AND** no control SHALL copy a code the user did not ask for

### Requirement: A detected verification link is opened only by the user

The website SHALL render a detected verification link as a link the user can activate,
with the destination host visible. Activating it SHALL open it in a new tab, and the page
SHALL NOT open a detected link by any means other than the user activating it.

The rendered link SHALL carry `rel="noopener noreferrer"`, and the page SHALL NOT fetch,
preload, or beacon a detected URL.

**Note, recorded at this slice's proposal.** Two clauses here are requirements rather than
implementation notes because each one is a way this could go wrong that a review would not
catch by reading.

`rel="noopener"` because a new tab opened without it hands the opened page a
`window.opener` reference back to SpectreMail, which is a cross-origin page the user never
chose to be related to. `noreferrer` because the same link would otherwise send this
temporary-mailbox page's URL to the destination as a `Referer` — and **this page's URL
carries a mailbox address**, so the leak is the one piece of this product's data a user has
an interest in not handing to an unrelated site. Neither is a hardening convention here;
each is the specific consequence of what this particular page holds.

The no-fetch clause exists because "show a link" and "contact a link's host" are different
things, and rendering a message is the moment a naive implementation would reach out. It is
stated because the same page is already under a rule that forbids a client reaching a global
store, and this is the same class of claim about a side effect of reading.

#### Scenario: A detected link is shown

- **WHEN** the page shows a verification link found in a message
- **THEN** it SHALL be rendered as a link the user can activate
- **AND** the destination host SHALL be visible
- **AND** the link SHALL open in a new tab
- **AND** the link SHALL carry `rel="noopener noreferrer"`

#### Scenario: A message carrying a link is opened

- **WHEN** a message carrying a verification link is opened
- **THEN** the page SHALL NOT navigate to the link
- **AND** the page SHALL NOT request the link's host

#### Scenario: The user activates a link

- **WHEN** the user activates a rendered verification link
- **THEN** the link SHALL open in a new tab
- **AND** the page itself SHALL NOT navigate