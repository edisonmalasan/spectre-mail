# Design — surface hierarchy

## Context

`proposal.md` carries the measurements. Four of them decide every choice below, so they are restated
here rather than cross-referenced:

- **The website sets nine `h2` at one size (22 px, weight 500)** and its address at the same size, so
  *`Why SpectreMail`* and *`Your address`* are typographically identical, and the note *`How long this
  address lasts`* is larger than *`Inbox`* (18 px).
- **The extension's popup sets the address at 16 px in `ink-secondary`** — the smallest, dimmest object
  on a 352 px surface — while its brand heading is 22 px weight 600, and its section labels are 12 px
  uppercase `ink-muted` (the treatment the website has never had).
- **The extension opens a message and renders none of it**: `OpenedMessage extends MessageSummary` and
  adds `readable`, `codes`, `links`; the view reads `codes` and `links` and discards `from`,
  `subject`, `receivedAt` and `readable`.
- **`text-transform: uppercase` reaches the accessibility tree**, measured in Chromium: every `h2` the
  probe uppercased came back from `Accessibility.getFullAXTree` with an upper-case name, and so did
  every region named by one.

## D1 — The defect is a missing role, not a wrong number

`DESIGN.md`'s Hierarchy section declares eight roles, and none of them is a region's name at a quiet
size. `Headline` is *"a region's name … a label on a working area"* — the record's own words — and it
is set at 22 px, which is the size the website's nine headings take and the reason nothing on the page
is subordinate. **So the record does not need a smaller number; it needs the role that says a region's
name is the quietest text in the system.**

The step exists on one client already and is not named anywhere. `apps/extension/src/styles.css` sets
`.popup h2, .panel h2` to `--type-xs`, `--weight-medium`, `--tracking-wide`, uppercase, and
`--ink-muted` — five declarations that no role in `DESIGN.md` describes and that no requirement names.
**A treatment that exists on one client, is absent from the record, and is not required is the same
defect as a token nobody reads**, and it is why the two clients could diverge in the first place.

So the change adds a **ninth role, `region-label`**, built from tokens the layer already declares —
`type-xs`, `weight-medium`, `leading-normal`, `tracking-wide` — and **declares no new token**. That
distinction is the load-bearing one: `design-record.test.ts`'s own doc block says the frontmatter's
shape is *role → property → value*, and the token layer's is *token name → value*. A role is a
decision about hierarchy; a token is a value. This change makes a hierarchy decision and needs no new
value to carry it, which is the prediction that falsifies the diagnosis if it is wrong: **a new token
would mean the defect was a missing value rather than a missing rank.**

The role is declared in two places, and that is the record's existing design rather than a new
duplication: `DESIGN.md`'s frontmatter and the test-owned `TYPE_ROLES` map in
`tests/architecture/design-record.test.ts`, asserted in both directions so a role in one and not the
other fails. **`tokens.ts` is untouched**, and `docs/DESIGN_SYSTEM.md`'s generated region re-renders
from `tokens.ts`, so it is untouched too.

### D1.1 — The fifth declaration does not survive, and the measurement is why

The role carries the four typographic properties every other role carries and the colour the prose
names. It does **not** carry `text-transform`, and that was decided by probing the platform rather
than by taste. Measured on the built website, one `h2` at a time, before and after a stylesheet added
the label step:

| read from | before | after |
| --- | --- | --- |
| `textContent` | `Ready` | `Ready` |
| `innerText` | `Ready` | `READY` |
| computed style | `text-transform: none` | `uppercase` |
| `Accessibility.getFullAXTree`, heading | `Ready` | `READY` |
| `Accessibility.getFullAXTree`, region named by it | `Ready` | `READY` |

**Chromium computes an accessible name from rendered text, so a case transformation in CSS renames
whatever it touches.** Every one of the website's nine `h2` names a region, so the label step with
uppercase would rename nine regions for assistive technology — and the extension's existing treatment
has already renamed five of its own, which nothing noticed because the extension's reader matches
names case-insensitively.

**There were two ways to keep the uppercase and both are worse than dropping it.** The first is to
make `sections.spec.ts`'s CDP reader compare names case-insensitively — **which is loosening the
strongest assertion in the repository to accommodate a style**, the direction this repository records
as a defect every time it appears. The second is to uppercase the visible text in the document rather
than in the stylesheet, which changes what every one of those names *is* and puts a typographic
decision into content.

**And the second argument is typographic rather than mechanical.** The names this role carries are not
all short. On the extension they are `Inbox`, `Messages`, `Provider status`; on the website they are
`What happens, in order`, `Why SpectreMail`, `The extension, in this browser`, and `What this page can
and cannot do` — **twenty-nine characters at `0.08em` tracking**. Wide-tracked uppercase is idiomatic
for a one- or two-word label and poor for a five-word phrase: the tracking that makes `INBOX` breathe
makes `THE EXTENSION, IN THIS BROWSER` a line of caps to be scanned rather than read. **A role that is
right for one client's names and wrong for the other's is not a shared role.**

So the step is size, weight, leading, tracking and colour. **It is still subordinate by four
independent signals**, and the browser tier asserts all four rather than the case.

### D1.2 — What the uppercase was hiding

Dropping it exposes the heading above the address, and the heading is a provider **id**:

```tsx
// apps/extension/src/Popup.tsx
<h2 id="address-heading">{mailbox.provider}</h2>          // renders "mailtm"

// apps/extension/src/Panel.tsx
<h2 id="panel-address-heading">{PANEL_COPY.addressHeading(record.provider)}</h2>
```

`mailbox.provider` and `record.provider` are ids — `mailtm`, `guerrilla`. **Rendered in caps they read
as a brand; rendered in sentence case they read as a slug.** The uppercase was load-bearing for a copy
defect, which is the one thing a treatment must never be.

## D2 — The surface names the provider, and the name already exists

`panel-copy.ts`'s `addressHeading` documents itself as *"It names the provider rather than this
surface's own name"* — and it is handed an id. **The module's own test cannot see it**: `PROVIDERS` in
`panel-copy.test.ts` is `["Mail.tm", "Guerrilla Mail"]`, so the fixture supplies exactly the shape
production does not. `provider-config.ts` already carries the contrary reading for the same claim, one
sentence over: its test asserts of the create heading that *"it is a name, not an id"*, and it reads
that name from `manager.available[0].displayName` rather than writing a literal, because
`packages/providers` owns it.

**So this is a defect the requirements did not catch, and it needs a requirement rather than only a
restyle.** `extension-client` says the popup SHALL *"name the provider it used"* and its scenario says
it *"SHALL show the provider that mailbox belongs to"*; the panel SHALL *"name the provider it
reached"* and *"name the provider that served it"*. **An identifier does name the provider** — which
is why the existing wording is satisfied and why a restyle alone would be a claim nothing holds: the
next surface would render `mailtm` and pass. The capability therefore gains one `ADDED` requirement
stating that the name is the one the provider abstraction declares, and the code follows it.

The repair is two functions beside the one that already reads a display name:

```ts
export function providerDisplayNames(manager: ProviderManager): Readonly<Record<string, string>>
export function providerDisplayName(names: Readonly<Record<string, string>>, id: string): string
```

`providerDisplayNames` folds `manager.available` into `id → displayName`; `providerDisplayName`
answers with the map's entry, and **the id itself where the map has none**, because a stored mailbox
outlives the build that recorded it: `SpectreStorage` keeps a record it cannot narrow rather than
deleting it, so a mailbox whose provider this build no longer offers must still be nameable, and the
id is the only thing left to name it with. That fallback is stated rather than silent, and it is
covered by a case.

**The map is built where the manager already lives, and the surfaces receive the map rather than the
manager.** Both take `providerNames: Readonly<Record<string, string>>`, supplied by each composition
root from its own manager — `App.tsx` builds one and `panel-main.tsx` builds one, and each already
passes `primaryProviderName` from it for exactly this reason: *"one manager object supplies both
halves, so this panel cannot be told one provider's name while its session was handed another."*

**The prop is the map and not a callback, and it is required rather than defaulted.** A callback would
be a function built per render for two lookups; a default of `{}` would let a composition root forget
it and render identifiers with every test still green, which is the defect being repaired. The
fallback lives inside `providerDisplayName`, where one case exercises it.

## D3 — The address is a datum, and the sentence that made it a heading is deleted

`DESIGN.md` says: *"The **address** is set in monospace at the headline step, and a **code** is
monospace at the title step, because a readout is set in the family that says this is a value at the
size its position on the page has earned."* The sentence is internally consistent and it produced the
page's central defect: the address took the size of the thing that labels a region, because the
record's only size above body that a readout could take was the heading's.

**The sentence is deleted rather than reworded**, and the reason is the same one this repository
records for a retired rule: keeping it and adding a caveat beside it would leave the record asserting
two things about one value. What replaces it is a rule: **the address is the largest datum on the
surface that shows it**, at `type-2xl`, which is the declared step that has been unused since the
layer was written. A code stays at `type-xl` (the `code` role) because a code is read *inside* an
opened message and the message's subject is the reading surface's principal datum.

This is where the website and the extension are the same decision in two directions. The website
over-sets the address to the size of a label; the popup under-sets it below the brand. **Both are
repaired by one rule, and neither client's fix is a separate judgement.**

## D4 — The accent follows the job, and a note that said a scenario was vacuous stopped it being asked

`visual-system` fixes the primary action as `Replace address`, and the Note gives the reason: it is
*"the only control that moves a visitor forward"*. **Measured, that is true and it is the wrong
question.** A page whose purpose is to hand a person an address has one control that completes that
purpose, and replacing the address abandons the purpose rather than finishing it. The shipped page
filled `Replace address` with the accent and left `Copy address` — the control its own address
requirement exists to offer — as a plain bordered one.

The requirement is **`MODIFIED` rather than reinterpreted**, because the Note names the subject
explicitly and a restyle that left the specification naming `Replace address` would put the promotion
at odds with the page. Its second scenario's `WHEN` is reworded from *"the page offers its forward
control"* to *"the page offers the control that completes its own job"*, because *forward* is the word
the old subject was chosen by; the rest of the scenario — the accent, and that the accessible name and
the effect are unchanged — is carried forward verbatim.

**`Replace address` does not disappear and does not become quiet enough to miss.** It keeps its border
and its position; what it loses is the claim to be the page's primary action. De-emphasising it is the
point: it is the one control on the page that discards something.

### D4.1 — The third surface has a home now, and the note that said it had none is why nobody looked

The same requirement's third surface — *a selected mailbox* — carries this note: *"'Selected mailbox'
has no home on this page, and that is a recorded non-delivery rather than an omission. The website
renders exactly one mailbox at a time and offers no list to select from."* **That was true when it was
written and it is false now**: `mailbox-history` (M13) added *Addresses this browser remembers* and
marks the mailbox the page is about — `RecentMailboxes.tsx` computes `isCurrent` and renders
`This is the address on this page.` in place of a control.

Measured against the requirement's own scenario, the mark is carried by **text and by a structural
difference** — the marked entry is the only one with no control — and **not by the accent**. So the
scenario went from unsatisfiable to unmet, and the note is why nothing noticed: **a note that says a
scenario has no home is a note that stops the scenario being asked.** The surface arrived, the note
stayed, and the requirement's own explanation is the reason the gap was invisible.

The amendment repairs both halves: the note states that the surface now exists, and the accent reaches
the mark. **One class hook and one colour on an entry the page already draws**, using the declared
`ink-accent` pair the verdict words already use — no new token, no new control, no new region.

**What this does not settle**: the side panel's chooser offers every mailbox this device holds,
including the one it is showing, and marks none of them. That is a third surface with a third answer
and it is recorded in `proposal.md` rather than repaired here.

## D5 — The prose measure applies to prose, and a row of fields is not prose

`DESIGN.md` says, three sentences apart: *"paragraphs and list items cap at 62 characters"*, and *"the
inbox row is its own two-column grid — the content in `1fr`, the timestamp in `auto`"*. Both are true
of the shipped page and they collide: a mail row **is** a `li`, so the prose measure claims it, and
measured the row is 534.75 px inside a 688 px list. The `auto` column then resolves to 169 px for a
verbatim ISO instant, which is **32 % of the row**.

**The qualification is written into the record rather than worked around in CSS**: a measure caps a
line of text; a row of fields is not a line of text, and a row takes the width of the list it sits in.
The prose measure keeps every subject it has — paragraphs, a message body, a list of prose — and loses
the one it was never written for.

The instant itself stays verbatim, because `InboxRow.tsx` records the decision and M7 re-affirmed it:
an ISO instant is unambiguous in every locale and it is what lets a row's contents be asserted without
pinning a locale. **This change does not format a time.** It gives the time the width its content
needs and gives the sender and the subject everything else.

## D6 — The address breaks at its `@`, and the break opportunity is an element rather than a character

At 390 px the address renders as `randomuser123456@sharklasers.c` / `om`. The cause is measured and it
is not the string: `.address__value` is `display: inline-block`, so it shrinks to its content and then
breaks at the container's edge under `overflow-wrap: anywhere`. At `type-2xl` the content is wider
still, so leaving this alone would make the defect worse rather than merely keep it.

**The repair is a block that fills its container plus one `<wbr>` after the `@`.** A block line-fills
and breaks at the last opportunity before overflow, which is the `@`; the domain stays whole because it
fits, and `overflow-wrap: anywhere` remains as the fallback for a domain that does not.

**A zero-width space would have been the shorter fix and is rejected**, because it is a character in
the value: a person selecting the address by hand would copy a string that is not the address. `<wbr>`
is a break opportunity with no text content, so `textContent`, an accessible name, a clipboard write
from state, and a test that reads the element's text are all unchanged. **The element is chosen because
it is not content**, and that is the test: any fix that changes what the address *is* to make it wrap
better is fixing the rendering by breaking the thing rendered.

## D7 — The opened message is a requirement gap, and the requirement is where it is repaired

No `extension-client` requirement names a message's own fields. The closest says a person who opens a
message SHALL see *"the one-time codes detected in that message"*, and the shipped view satisfies it
exactly. **A surface that satisfies its requirement while showing nobody the message is the
requirement's fault** — the same shape `mailbox-history` recorded when a document went stale because
the instrument watched an entry point no client used.

**One `ADDED` requirement for this claim, and no `MODIFIED` block anywhere in this capability's
delta.** Three further `ADDED` blocks carry the row, the order and the provider's own name, and none
of them amends an existing requirement — so the capability grows by four requirements and every one of
its seventeen existing requirement blocks is byte-identical after this change. The first
shape considered was two amendments — the popup's requirement and the panel's — plus a shared
addition, and it was rejected for three reasons that are each a defect this repository records by
name:

- **It would state one claim three times.** Both surfaces render one component,
  `OpenedMessageView`, so "a message shows its sender, subject, arrival time and readable text" is one
  sentence about one component. Three spellings of a set is the defect this repository records most
  often, and a delta is where it is cheapest to avoid.
- **A `MODIFIED` block replaces its whole requirement**, so amending the popup's codes clause to also
  be about the sender would make one requirement cover two subjects — and it would have to carry
  *"Opening a message SHALL be the only way a code becomes available"* forward under a heading that no
  longer describes it.
- **Nothing in either existing requirement is wrong.** Both are satisfied by the shipped view. A gap
  is repaired by an addition; an amendment is for a claim that has to change.

So the capability gains one requirement stating what an opened message shows **on any surface of this
client**, and the popup's and panel's existing requirements are untouched.

**`readable` is rendered as text and nothing else.** `OpenedMessage`'s own doc block says it is
*"markup-free by construction … the body as received is not retained anywhere"*, and
`extension-client`'s *"renders provider-supplied content as text"* already binds every surface. The
view gains no parser call, no `dangerouslySetInnerHTML`, and no new dependency: the field it renders
was produced by the extraction the shared session already ran.

**The opened message gains no control it does not have.** The popup still renders no clipboard control
beside a code and no links; the panel still renders both. What changes is what a person can *read*,
not what they can *do*, and a change that added the popup's clipboard control here would be
`MessageSurface.tsx`'s D2 being rewritten by a UI change.

## D8 — A surface states its subject before its diagnosis, and offers removal after what it removes

The popup renders the diagnostic report **first** (234 px, a fifth of a surface that is already 863 px
tall in a 760 px viewport) and the address fourth. The panel renders **the same component last**, and
`Panel.tsx` records why: *"it is the only section here that is about the session rather than about the
device or the page."* **One component, two placements, and one of them contradicts the reason written
for it** — and the one that contradicts the reason is the surface a person opens to copy an address.

The rule is stated once for the client: **a surface states its own subject first and its account of
what happened last**, because the account is about the session and every other region is about the
thing the person came for. That places the popup's report after the address, the inbox and the opened
message, and leaves the panel's where it already is.

The panel's removal section is the mirror case and it is measured too: **`panel-removal-heading` is the
third block on the surface, above the inbox** (86 px at position 3 of 6), and its heading is *"What
this device keeps"* over a control that lists nothing kept. **A destructive control above the thing it
would destroy is a control offered before a person has seen what is at stake.** It moves below the
inbox and the opened message.

Both are the same sentence about order rather than two layout opinions, which is why they are one
`ADDED` requirement in `extension-client` and not two.

**`page-composition` is not amended and no region moves.** It governs the website's five regions and
their order, and this change relocates nothing at that level: the nine `h2` sections live *inside*
`data-region="product"`, and the extension has no regions in that sense at all. **A sixth region is
not added, no region is renamed, no control is renamed, and no state-to-region mapping changes** —
which is why the ~20 assertions that read a region by its accessible name are expected to pass
unchanged, and a movement in any of them is evidence this change did something it did not declare.

## D9 — What is not done, and why each is a different change

- **The website's four non-product regions are untouched.** `steps`, `reasons`, `extension` and
  `footer` are 44 % of the document between them, and their share of the page is a **composition**
  question — whether the explanation belongs below the product at all — that this change records and
  does not answer. Restyling them here would spend the hierarchy decision on regions the diagnosis did
  not find defective, and shrinking them is a decision about the page's argument, not its scale.
- **`RecentMailboxes`' own composition is untouched.** It gains the accent on its current entry,
  because a promoted requirement names that surface; it gains no grid, no measure and no heading of
  its own. Its unboxed list is measured in the proposal and is not restyled here.
- **The in-page control is untouched.** It renders in a shadow root with a hardcoded stylesheet that
  cannot read custom properties; bringing it into the hierarchy is a real question with a real answer
  (adopted custom properties on `:host`), and it is a fourth surface with its own integration rules.
  Its literal accent is recorded in the proposal as a finding rather than repaired.
- **The report's vocabulary is untouched.** `diagnostic.ts` renders `The address could not be created
  (MAILBOX_EXPIRED)` — a normalized code, in a person's face. Repairing it is eight sentences and a
  requirement about what the report says, not an arrangement.
- **No copy is rewritten.** Every label, every warning and every explanation keeps its words; the
  change moves type, space, grids, order, one control's treatment, and supplies the display name a
  copy function already documents that it takes.

## D10 — What this establishes, and what it does not

**Establishes**: that a region's name is smaller than the data it labels on both clients, that a
stylesheet does not rename a region for assistive technology, that the address is the largest datum on
each surface that shows one, that the accent is on the control that completes the page's job and on
the mark on a selected mailbox, that a mail row takes the width of its list, that the address breaks at
its `@` rather than inside its domain at a narrow width, that an opened message shows its sender,
subject, arrival time and readable text on both extension surfaces, that a surface's subject precedes
its diagnosis, that the panel's removal control follows what it would remove, and that the surface
names the provider the way the provider names itself. Each is asserted in the tier that can observe it
— computed styles and geometry in the browser tier, DOM order and accessible names in the unit tier —
and each assertion is named in `tasks.md` with the mutation that must turn it red.

**Does not establish**:

- **Nothing about whether any of it looks right.** No test in this repository reads a rendered pixel's
  colour or position. The measurements are boxes, computed styles and DOM order; whether the result
  reads as right is a human judgement, and the screenshots that produced the diagnosis are not a gate.
- **Nothing about a real provider, a real clipboard, a popup a person clicked, or a side panel a
  person docked.** The extension's surfaces are driven at their own viewport sizes as tabs, which is
  the substitute `in-page-fill`'s D10 already records.
- **Nothing about the four non-product regions**, beyond the share of the page they take.
- **Nothing about a second engine, a high-contrast mode, or a zoom level.** Chromium, one machine.
- **Nothing about `region-label` being the right size for every language.** The labels are English and
  `tracking-wide` on a longer translated string is untested; this repository has one locale.
- **Nothing about which provider a stored mailbox belongs to when this build does not offer that
  provider.** The fallback names it by id, and no case exercises a real such mailbox — only a recorded
  one with an id no adapter declares.

**Two predictions that falsify the diagnosis if they fail**, stated before the work so they cannot be
adjusted after it:

1. **No new token is declared.** Every value the hierarchy needs — `type-xs`, `type-xl`, `type-2xl`,
   `ink-muted`, `ink-accent`, `tracking-wide`, `weight-medium` — is already in the layer. A new token
   means D1 was wrong about the defect being a missing rank.
2. **`packages/ui`'s test count does not move.** The change adds a role to a document and no value to
   the layer, and `design-record.test.ts` is table-driven over roles and colours, so a ninth role adds
   no case. A rise in `packages/ui` would mean a value moved.
