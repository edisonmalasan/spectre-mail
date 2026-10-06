# Spec Delta

## ADDED Requirements

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