# visual-system

The exactly-three-motion rule is superseded by an only-observed-motion rule.

## MODIFIED Requirements

### Requirement: Motion is three materialisations, timed by the token layer

A client SHALL reproduce only motion that a reference capture actually observed. The product
entrances already measured — the mailbox address, a message arriving in the inbox, and a
rendered verification code — SHALL remain single entrances resolving to the element's resting
appearance. A continuous animation that the reference showed only on advertising or spinner
elements is recorded as observed but SHALL NOT be introduced into product UI without its own
justification. Every duration, easing function, blur distance, and rise distance a product
entrance uses SHALL be a value the token layer declares, and no shipped stylesheet SHALL name a
duration, an easing function, or a motion distance literally. Where a reference effect was not
observable, its specification SHALL say UNKNOWN rather than invent a timing.

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
