# Spec Delta

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
