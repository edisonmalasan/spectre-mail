# visual-system Specification

## Purpose

Records what a stylesheet owes once this repository has one. Until M7 the page had no
design system at all, so there was nothing for a requirement to constrain: a palette
declared in twenty places is not drift, it is the only thing that exists yet.

## Requirements

### Requirement: The design tokens are declared once and read from one place

Colour, type family, type scale, spacing step, radius, and border width SHALL each be
declared exactly once, in a token layer shared by every client. No stylesheet outside that
layer SHALL name a colour, a radius, a spacing step, or a type size directly, and every
`var()` a shipped stylesheet reads SHALL resolve to a declaration.

**Note, recorded during proposal (2026-10-06).** The third clause is not a style
preference. An undeclared custom property makes `var()` compute to the initial value at
computed-value time, so `--colour-accent` declared nowhere against a token spelled
`--color-accent` renders an element **with no accent and no error anywhere**. It builds,
it type checks, every test passes, and the defect is a single pixel on one control. That
is the same failure shape as the removal control that shipped and was measured absent: a
claim nothing in the repository could read.

#### Scenario: A stylesheet reads a token

- **WHEN** a shipped stylesheet styles a property whose value is a design decision
- **THEN** it SHALL reference the token for that decision
- **AND** it SHALL NOT name a colour, radius, spacing step, or type size literally

#### Scenario: A stylesheet reads a token that is not declared

- **WHEN** a shipped stylesheet reads a custom property that no token layer or stylesheet
      declares
- **THEN** the build SHALL fail, naming the stylesheet and the property
- **AND** the failure SHALL occur before the page is served

#### Scenario: A second client needs the palette

- **WHEN** a client other than the website is built
- **THEN** it SHALL read the same token layer
- **AND** no palette value SHALL be restated in that client

### Requirement: The page loads no third-party asset

No stylesheet the product ships SHALL reference a remote origin, and the product's markup
SHALL declare no remote `src` or `href`. Where a typeface is wanted it SHALL be named as a
token over fonts the platform already provides, or shipped with the product.

**Note, recorded during proposal (2026-10-06).** Three reasons, each of which stands
without the others. A remote font **breaks a promoted requirement**: `build-and-verification`
requires a browser check to contact no third-party origin, the browser route handler denies
every origin it has no recorded response for, and a font request would fail every spec in
the suite. It **breaks the product**: a page whose stated subject is what is
kept on this device hands a third party the visitor's IP address and User-Agent on load,
before the visitor has done anything, and no control on the page can prevent it. And it
**adds a binary** this milestone has not measured.

The approved direction names a typeface. Naming one is an instruction about where a family
is *declared*, not a requirement to fetch it.

#### Scenario: A stylesheet references an asset

- **WHEN** a shipped stylesheet references any external resource
- **THEN** the build SHALL fail, naming the stylesheet and the URL

#### Scenario: The markup references an asset

- **WHEN** the product's markup declares a `src` or `href` resolving to another origin
- **THEN** the build SHALL fail, naming the file and the URL

#### Scenario: The page is served and inspected for what it requested

- **WHEN** the built page is loaded and every request it made is recorded
- **THEN** it SHALL have requested only the page's own resources
- **AND** no third-party origin SHALL appear in that record

### Requirement: State is never carried by colour alone

Where a control or region conveys a state, that state SHALL be carried by text, a shape, a
symbol, or a structural difference as well as by colour. No verdict, status, or error
SHALL be distinguishable only by the colour applied to it.

**Note, recorded during proposal (2026-10-06).** This requirement already existed for
`website-client` before this change, and it stays true there. It is restated here because
this milestone makes it **hard to keep**: the accent is about to appear on active status,
and an accent that recolours a verdict without naming it would satisfy the visual direction
and break a requirement that predates it. Reinforcing a word is the intent. Replacing one
is the failure.

#### Scenario: A message carries a verification

- **WHEN** an inbox row is marked as carrying a one-time code or a verification link
- **THEN** it SHALL say so in text
- **AND** the accent SHALL NOT be the only difference between it and a row that does not

#### Scenario: A region reports an error

- **WHEN** a region states that something failed
- **THEN** it SHALL state what failed and what to do about it in words
- **AND** no styling SHALL be required to perceive that it failed

### Requirement: Every interactive control has a focus indicator that is visible

Every control a user can operate by keyboard SHALL show a focus indicator when focused.
The indicator SHALL be visible against every surface it can appear on, SHALL use the
accent, and SHALL NOT be removed by any reset or override the product ships. Focus SHALL be
verifiable where the indicator exists, which is in rendered pixels.

**Note, recorded during proposal (2026-10-06).** A declared ring and a visible ring are
different claims, and only one of them is worth making. `getComputedStyle` in `jsdom`
returns no resolved outline, so a check there would assert on a declaration and pass on a
control no user can see. The check is therefore a browser check, driving focus by keyboard
rather than by script, because the indicator that matters is the one a keyboard user gets.

#### Scenario: A control is reached by keyboard

- **WHEN** a user tabs to any interactive control on the page
- **THEN** that control SHALL render a focus indicator
- **AND** the indicator SHALL differ from the same control unfocused

#### Scenario: A stylesheet removes a focus indicator

- **WHEN** a shipped stylesheet suppresses an outline, by `none`, by zero, or by zero
      width
- **THEN** the build SHALL fail, naming the stylesheet and the declaration

#### Scenario: An indicator is declared but cannot be seen

- **WHEN** a focus indicator is declared in a colour or weight that is indistinguishable
      from the surface behind it
- **THEN** the browser check SHALL fail
- **AND** no unit test over the declaration SHALL be offered in place of it

### Requirement: Declared colour pairs meet WCAG AA in both colour schemes

Every foreground-and-background pair the product declares for text SHALL meet a contrast
ratio of at least 4.5:1, and every pair it declares for a boundary, an indicator, or text
of at least 18.66px bold or 24px SHALL meet at least 3:1. Both colour schemes SHALL be
checked, and a scheme SHALL NOT be added by inverting the other.

**Note, recorded during proposal (2026-10-06).** This is arithmetic, so it is checked as
arithmetic. A relative-luminance function over the token values is a pure function and
needs no browser, no DOM, and no rendered page; putting it in a browser check would be
theatre, because the browser supplies colour strings and the test supplies the ratio.

#### Scenario: A pair is declared

- **WHEN** the token layer declares a foreground-and-background pair for text
- **THEN** the declared ratio SHALL be at least 4.5:1 in each colour scheme

#### Scenario: A pair fails

- **WHEN** a declared pair falls below its threshold
- **THEN** the test run SHALL fail, naming the pair and both ratios

#### Scenario: The dark scheme is added

- **WHEN** a dark scheme is declared alongside the light one
- **THEN** every declared pair SHALL meet its threshold in that scheme too
- **AND** the scheme SHALL NOT be produced by filtering or inverting the other

### Requirement: Motion is three materialisations, timed by the token layer

A client SHALL animate exactly the moments the roadmap's Motion block names — the mailbox
address, a message arriving in the inbox, and a rendered verification code — and no other.
Each SHALL be a single entrance that resolves to the element's resting appearance, and
every duration, easing function, blur distance, and rise distance it uses SHALL be a value
the token layer declares. No shipped stylesheet SHALL name a duration, an easing function,
or a motion distance literally.

**Note, recorded during proposal (2026-10-06).** *"Resolves to the element's resting
appearance"* is load-bearing and is the reason the entrances need no fill mode. If the
element's own declarations already equal the animation's final frame, then removing the
animation and finishing it are the **same rendering**, which is what makes the
reduced-motion requirement below implementable as removal rather than as a substitute
timing. The alternative — an animation whose resting state is *not* its final frame —
cannot be switched off at all without either a fill mode or a second set of declarations
that contradict it.

The blur and rise distances are declared in the token layer rather than borrowed from the
spacing scale. `--space-1` happens to be `4px`, which is exactly the roadmap's rise, and
using it would have meant adding no token at all — but `--space-1` is read by many layout
rules, so a change made for layout reasons would silently move the motion.

#### Scenario: A mailbox address is created

- **WHEN** a client renders the mailbox address
- **THEN** it SHALL materialise it, once, from no opacity through the declared blur and the
      declared rise to the address's own appearance
- **AND** the duration and easing function it resolves to SHALL be the ones the token layer
      declares

#### Scenario: A message arrives in the inbox

- **WHEN** a listing reports a message that is not already on the page
- **THEN** the client SHALL materialise that message's row, once, with the same three
      properties
- **AND** it SHALL NOT materialise any row that was already on the page

#### Scenario: A verification code is rendered

- **WHEN** a client renders a detected verification code
- **THEN** it SHALL materialise the code, once, with the same three properties

#### Scenario: The motion's own values are read from somewhere else

- **WHEN** a shipped stylesheet declares an animation
- **THEN** every duration and easing function in that declaration SHALL be a reference to a
      declared motion token
- **AND** the blur distance and rise distance in any keyframes block SHALL be references to
      declared motion tokens
- **AND** no literal duration, easing function, or motion distance SHALL appear in that
      stylesheet

### Requirement: `prefers-reduced-motion: reduce` stops the motion rather than shortening it

Where a user has asked for reduced motion, a client SHALL remove the animation from every
element that would otherwise animate, so that no animation runs. It SHALL NOT achieve that
by substituting a shorter duration, a null duration, or a transition, and it SHALL NOT read
the preference in script.

**Note, recorded during proposal (2026-10-06).** *"Stop rather than shorten"* is the
roadmap's own wording and it is a stronger requirement than it first looks. A duration of
`0.01ms` — the workaround published widely for this problem — is not a stop; it is an
animation that finishes before a single frame can be composited, which is a claim about
timing rather than about the page. Removal is the only form whose result can be read back:
an element with no animation reports none, and that is what the positive control below is
written against.

The positive control is not optional bookkeeping. "No element animates under reduced
motion" is satisfied by a page that animates nothing at all, and the first version of this
requirement — had it been written without the control — would have been a test that could
not fail. The requirement therefore states both halves, because the second half is what
gives the first its meaning.

#### Scenario: The preference is set and the page is rendered

- **WHEN** a client renders a page under `prefers-reduced-motion: reduce`
- **THEN** no element on that page SHALL report a running animation
- **AND** the mailbox address, an inbox row, and a verification code SHALL each render in
      their resting appearance with no animation attached

#### Scenario: The preference is not set

- **WHEN** a client renders a page with no reduced-motion preference
- **THEN** the mailbox address, an inbox row, and a verification code SHALL each report the
      declared animation with its declared duration
- **AND** this SHALL hold on the same page, in the same run, as the case above, so that the
      claim about reduced motion cannot be satisfied by the absence of motion

#### Scenario: The preference changes while the page is open

- **WHEN** the preference changes
- **THEN** the page's animations SHALL follow it without a reload being required

### Requirement: An entrance runs once, and never again for the same element

A materialisation SHALL be tied to the appearance of the element it animates, not to a
period. An element already on the page SHALL NOT be re-materialised by anything the user
did not cause — a repeated listing, a re-render, a state change, or the passage of time —
and SHALL NOT be replaced by a new element in order to be animated again.

**Note, recorded during proposal (2026-10-06).** This requirement exists because the
inbox polls, and because a CSS animation runs when an element is first rendered rather than
when something changes. A page that animates every row would therefore re-materialise its
whole inbox on a cadence the product chose, several times a minute, for as long as the tab
stays open — which is the motion the design direction's own *"nothing here moves on its
own"* rule was written to exclude, and it would do it to a user who asked for nothing.
The way to make this fail loudly rather than quietly is to observe **element identity**
rather than appearance: a marker set on a row before a later listing must still be on that
row's element afterwards, because a replaced element cannot carry it.

#### Scenario: A later listing reports nothing new

- **WHEN** a listing is served while the page is open
- **AND** it reports the messages already on the page and no others
- **THEN** each of those rows SHALL be the same element it was before the listing
- **AND** no animation SHALL start on it

#### Scenario: A new message arrives

- **WHEN** a listing reports a message that is not already on the page
- **THEN** that row's materialisation SHALL run
- **AND** the rows already on the page SHALL be undisturbed

#### Scenario: The user opens a message and comes back

- **WHEN** a user opens a message and returns to the inbox
- **THEN** no row on the page SHALL be re-materialised by that navigation

*Provenance: slice 1 (`spectral-swiss-foundation`) promoted 5 requirements with 14
scenarios; slice 2 (`motion-and-reduced-motion`) promoted 3 more with 10 scenarios, for 8
requirements and 24 scenarios. Every requirement block and every scenario block in the delta
survived the merge byte-for-byte, compared as whole blocks rather than by title — a
hand-typed paraphrase keeps the heading and loses the text, which is the one failure a
manual merge of a spec delta cannot be trusted not to commit.*

*This capability's third requirement was **violated by the implementation that shipped it**,
and the violation was found by this change's own browser check rather than by a test
written for it. Landing an entrance on `.inbox-row` made the pre-existing defect visible:
`InboxState`'s `checking` variant carried no listing, so every poll removed the inbox list
and rebuilt it, and the rebuilt row re-ran its entrance every five seconds for as long as
the tab stayed open. The repair is specified in `mailbox-session` as *A check in progress
keeps the messages the last check learned*, and it is recorded here because a reader of this
spec alone would otherwise have no reason to know the requirement above was not satisfied
from the first commit. What the browser check established is element identity and resolved
computed styles; **nothing about whether the motion looks right**, which remains a human
judgement.*

*One scenario's coverage is narrower than its wording, and the gap is deliberate rather
than an oversight.* *A new message arrives* has two halves. The second — that a row already
on the page is not disturbed — is covered in both tiers, by element identity read through a
later poll. The first is **not coverable with recorded fixtures**: the recorded handler serves
the same listing on every poll, so no new row can ever appear. The scenario is stated in
full anyway, because the spec records what is required and the test records what was
observed, and those are different claims.*

### Requirement: The accent reaches a brand mark, a primary action, and a selected mailbox

The accent SHALL appear on three surfaces the direction names and that slice 1 deferred because
nothing on the page existed to carry them: a **brand mark**, a **primary action**, and a
**selected mailbox**. Each SHALL be declared as a token-backed pair, SHALL meet its declared
threshold in both colour schemes, and SHALL NOT be the only difference between a selected and
an unselected element.

**Note, recorded during proposal (2026-10-06).** Slice 1's own note records that it applied the
accent to *"the surfaces of the Accent block that exist on this page today"* and named these
three as deferred. Two of them are now decided by measurement of what the page actually
offers, and the decisions are recorded because the direction named the surfaces and not their
subjects.

**The brand mark is a drawn glyph, not an asset.** "Subtle geometric branding" with the accent,
inline SVG the product itself renders — because `build-and-verification` requires a browser
check to reach no third-party origin, and a brand mark delivered as a font, a file, or an
image request would break a promoted requirement and hand a third party the visitor's IP on
page load. The same reasoning `visual-system`'s *page loads no third-party asset* already
records for typefaces.

**The primary action is `Replace address`, and the reason is that it is the only forward
control on the page.** The direction names a "primary action"; the website has **no submit** —
it creates an address on load — so the one control that moves a visitor forward is the one
that replaces the address. Dressing a control as primary that is not the page's primary action
would be the fake-UI failure the design rules name, and inventing a submit button the product
does not need would be worse.

**"Selected mailbox" has no home on this page, and that is a recorded non-delivery rather
than an omission.** The website renders exactly one mailbox at a time and offers no list to
select from; a mailbox list is M8's popup and M11's side panel. So the third surface lands as
a **declared and contrast-checked pair that nothing on this page uses yet**, and
`docs/ROADMAP.md` records the deferral. Shipping an unused pair is honest; shipping a
fake selection UI to justify a token is not.

#### Scenario: A brand mark renders

- **WHEN** the page renders its brand mark
- **THEN** the mark SHALL carry the accent
- **AND** it SHALL be rendered by the product itself, with no request to any origin

#### Scenario: A primary action renders

- **WHEN** the page offers its forward control
- **THEN** that control SHALL carry the accent
- **AND** its accessible name and its effect SHALL be unchanged by the treatment

#### Scenario: A mailbox is selected

- **WHEN** a client renders a mailbox the user has selected
- **THEN** the selection SHALL be carried by the accent
- **AND** it SHALL also be carried by text, a shape, or a structural difference
- **AND** the page SHALL NOT add a mailbox list to justify the surface

#### Scenario: A new pair is declared

- **WHEN** a colour pair is declared for any of these three surfaces
- **THEN** it SHALL meet its threshold in both colour schemes
- **AND** both scheme values SHALL be declared rather than derived from each other
