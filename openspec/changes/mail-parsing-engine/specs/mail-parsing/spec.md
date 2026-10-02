# Spec Delta

## Purpose

Turns untrusted message content into readable text, and finds the one-time codes
and verification links in it that are the reason a user opened a temporary mailbox.

## ADDED Requirements

### Requirement: Untrusted content becomes readable text, never markup

Message content arriving from a provider SHALL be reduced to readable text before
anything interprets it. Markup SHALL NOT be emitted for a client to render, so that
rendering it unsafely is not a decision any call site can make. Content that is not
prose SHALL be removed rather than shown as text.

#### Scenario: A message body contains markup

- **WHEN** a message body contains HTML markup
- **THEN** the readable text SHALL contain the visible content only
- **AND** no tag SHALL appear in the readable text
- **AND** no field SHALL be produced that invites the result to be rendered as
  markup

#### Scenario: A message body carries script or style content

- **GIVEN** a message body whose markup contains script or style content
- **WHEN** the readable text is produced
- **THEN** that content SHALL NOT appear in the readable text
- **AND** it SHALL NOT be offered as a detection candidate

> Measured basis: Guerrilla Mail was measured declaring `content_type: "text"` while
> delivering an HTML body, and the real delivered message arrived as raw HTML
> (`docs/PROVIDERS.md` §3). The declared type is not evidence either way, which is
> why the extraction must not consult it.

#### Scenario: A value is hidden behind HTML entities

- **WHEN** a message body encodes characters as HTML entities
- **THEN** the readable text SHALL contain the decoded characters
- **AND** a detection spanning those characters SHALL be found

#### Scenario: A message body is plain text already

- **WHEN** a message body contains no markup
- **THEN** the readable text SHALL preserve its content
- **AND** no detection SHALL be lost by the extraction

### Requirement: Link destinations are recovered together with their anchor text

Where a message body contains a link, the parser SHALL recover both the destination
and the text a reader would click, because detection depends on the wording a person
sees rather than on the address alone. A destination whose scheme is not a web
address SHALL NOT be surfaced as something a user can follow.

#### Scenario: A message contains a link

- **WHEN** a message body contains a link with visible text
- **THEN** the destination and the visible text SHALL both be recovered
- **AND** the visible text SHALL be recoverable even when the destination is split
  across markup or is entity-encoded

#### Scenario: A destination is not a web address

- **GIVEN** a message body containing a destination whose scheme is not `http` or
  `https`
- **WHEN** links are detected
- **THEN** that destination SHALL NOT be surfaced as a followable link
- **AND** it SHALL NOT be reduced to a text form that appears followable

#### Scenario: A link's destination is shown without re-parsing it

- **WHEN** a link is surfaced as a verification link
- **THEN** it SHALL carry the destination's host
- **AND** a caller SHALL NOT need to parse the address to label it

### Requirement: A one-time code is detected from the message text alone

A one-time code SHALL be detected without any network request, any provider, and any
model of the sending service. Detection SHALL be a function of the text alone, so the
same message always yields the same result. Confidence SHALL be **raised** by wording
that indicates a code is present and **lowered** by wording that indicates the value
means something else.

#### Scenario: A value appears beside verification wording

- **GIVEN** a message containing a four-to-eight digit value
- **WHEN** wording nearby indicates a verification, confirmation, or authentication
  code
- **THEN** that value SHALL be reported as a code candidate
- **AND** its confidence SHALL be higher than the same value reported from a message
  without such wording

#### Scenario: A value resembles something that is not a code

- **GIVEN** a message containing a four-to-eight digit value that reads as a price, a
  date, a phone number, an order number, a tracking number, or a postal code
- **WHEN** codes are detected
- **THEN** that value's confidence SHALL be lower than an unqualified value of the
  same shape elsewhere in the same message
- **AND** lowering SHALL NOT by itself remove the value from consideration

#### Scenario: The same message is parsed twice

- **WHEN** the same message content is parsed more than once
- **THEN** every reported code, link, and confidence SHALL be identical
- **AND** no outcome SHALL depend on the clock, the network, or a previous parse

### Requirement: Every plausible candidate is surfaced, ranked, and deduplicated

Detection SHALL return every candidate it cannot rule out, ordered by confidence, and
SHALL NOT collapse them to a single winner. Two messages may both contain something
that looks like a code, and choosing one silently removes the user's only chance to
tell them apart.

#### Scenario: A message contains several candidates

- **WHEN** a message contains more than one value that could be a code
- **THEN** each SHALL be reported
- **AND** they SHALL be ordered by confidence, highest first
- **AND** the result SHALL NOT name one of them as the answer

#### Scenario: A message contains no candidate

- **WHEN** a message contains no value that could be a code
- **THEN** no code SHALL be reported
- **AND** the absence SHALL NOT be reported as a failure

#### Scenario: The same value appears more than once

- **WHEN** the same code value appears several times in one message
- **THEN** it SHALL be reported once
- **AND** the single report SHALL keep the highest confidence observed for it

### Requirement: A verification link is detected from wording, not from address shape

Whether a link looks like a verification link SHALL be decided by the text a reader
sees and the wording around it. It SHALL NOT be decided by the shape of the address,
because a large share of links in ordinary mail have addresses that mention
verification-shaped words for reasons that have nothing to do with verification.

#### Scenario: Link wording asks the reader to verify

- **GIVEN** a message containing a link whose visible text or surrounding wording asks
  the reader to verify, confirm, activate, authenticate, validate, sign in, or follow
  a magic link
- **WHEN** verification links are detected
- **THEN** that link SHALL be reported
- **AND** its confidence SHALL be higher than a link with no such wording

#### Scenario: A link's address contains a verification-shaped word

- **GIVEN** a message containing a link whose **address** contains such a word while
  neither its visible text nor its surrounding wording does
- **WHEN** verification links are detected
- **THEN** confidence SHALL NOT be raised on that basis

#### Scenario: An ordinary transactional link is present

- **GIVEN** a message containing only ordinary links, such as an unsubscribe or a
  preferences link
- **WHEN** verification links are detected
- **THEN** none of them SHALL be reported as a verification link

**Note, recorded during apply.** This scenario is the reason `design.md` D6 was amended
to scope itself to code candidates. D6 requires that no threshold discards a candidate
whose confidence is low, which read as applying to links too — and this scenario
requires that an ordinary link is *not reported at all*. Both cannot hold unless the
link case is a gate rather than a cut-off.

It is a gate, and specifically not a threshold, because there is no constant in it. The
roadmap defines a verification link by the wording around it, so a link whose wording
names nothing is an ordinary link rather than a weak verification link. No score is
computed for it and therefore none is discarded. The distinction matters because a
threshold that discards a wrongly-computed score is a tuning risk, and this has no score
to tune.

#### Scenario: A link is introduced by the paragraph above it

- **GIVEN** a message containing a link that is the only content of its own block, and a
  preceding block whose wording asks the reader to verify, confirm, activate,
  authenticate, validate, or sign in
- **WHEN** verification links are detected
- **THEN** that link SHALL be reported
- **AND** a link that is **not** the only content of its own block SHALL NOT be reported on
  the strength of the paragraph above alone

**Note, recorded during apply.** Added because the very common template puts the
introducing sentence in its own paragraph and the button in the next one, which makes
them different blocks. The password-reset fixture is exactly that: "Or confirm the reset
from this device:" above a link reading "Reset password", whose own text names no
verification wording. Under the rule as first proposed the link was not reported at all,
and a password reset is the single most useful link such a message contains.

The second clause is the narrowing, and it is what keeps the rule from reporting an
unsubscribe link sitting under a verification sentence. The asymmetry with code
detection is deliberate: a code candidate borrows the block above only when its own
block is nothing but the code, while a link borrows only when it is the only content of
its block. `detect-links.test.ts` records the case where the window cannot tell the
difference — a link followed by more of its own sentence — as a stated limit rather than
leaving the rule's reach wider than its documentation admits.

### Requirement: No detection is reported as certain

No detection SHALL be reported with a confidence of certainty, however strong the
evidence. Wording is evidence, not proof, and a product that says "this is your code"
about the wrong number teaches a user to trust a detector that cannot be sure.

#### Scenario: A message matches every signal

- **GIVEN** a message whose candidate is beside the strongest possible wording and
  matches every rule
- **WHEN** it is reported
- **THEN** its confidence SHALL still be below certainty
- **AND** a reader SHALL be able to see that the detection is a judgement

#### Scenario: Confidence is expressed in the shared model's range

- **WHEN** any detection is reported
- **THEN** its confidence SHALL be within the inclusive range the shared model defines
- **AND** it SHALL be a number a caller can order and compare

### Requirement: Detection never causes a side effect

Detecting a link SHALL NOT fetch it, open it, resolve it, or cause any request to the
address it names. A user who has not chosen to follow a link SHALL NOT have done so by
having their mail read.

#### Scenario: A message contains a verification link

- **WHEN** a message containing a verification link is parsed
- **THEN** no request SHALL be made to the link's destination
- **AND** no request SHALL be made to any other address derived from the message

#### Scenario: A link's destination is unreachable

- **GIVEN** a message containing a link to a host that does not resolve
- **WHEN** the message is parsed
- **THEN** the link SHALL still be reported with its host
- **AND** the failure to resolve SHALL NOT affect the reported result

### Requirement: Parsing consumes the shared model and does not widen it

Detections SHALL be reported using the shared model's existing verification code and
verification link shapes. This change SHALL NOT add a field, a confidence scale, or an
identifier that the shared model does not already define.

#### Scenario: A code is reported

- **WHEN** a one-time code is detected
- **THEN** it SHALL be reported as the shared model's verification code, carrying its
  value and its confidence
- **AND** no additional field SHALL be required to understand it

#### Scenario: A message is parsed

- **WHEN** a message is parsed
- **THEN** the result SHALL consist only of values the shared model already defines
- **AND** the shared model SHALL NOT require a change to accept any of them

### Requirement: Detection is measured against a fixed corpus that includes misleading mail

Detection SHALL be verifiable against a fixed corpus of message shapes that includes
both the mail the product exists for and the mail that most resembles it without being
it. A corpus of only verification messages cannot measure a false-positive rate,
because every candidate in it would be a true one.

#### Scenario: The corpus covers the expected verification shapes

- **WHEN** the corpus is inspected
- **THEN** it SHALL contain short codes, long codes, several codes in one message,
  markup-heavy mail, plain mail, magic-link mail, a password-reset message, and
  services that use several different verification shapes
- **AND** each fixture SHALL state the candidates it is expected to yield

#### Scenario: The corpus contains misleading mail

- **WHEN** the corpus is inspected
- **THEN** it SHALL contain a transactional confirmation carrying numbers that are not
  codes, and ordinary bulk mail in which no digit run is a code
- **AND** each such fixture SHALL state what it is expected to yield
- **AND** for a fixture containing no true code, no reported candidate SHALL score at or
  above what a true code scores for equivalent wording

#### Scenario: A fixture's expectation is stated as an exact ordered list

- **WHEN** a fixture states its expectation
- **THEN** it SHALL state the expected candidates in report order, not as an unordered
  set
- **AND** it SHALL state the numbers it genuinely yields rather than the numbers it would
  be preferable to yield

**Note, recorded during apply.** This scenario was added because the wording above it was
**unsatisfiable as first written**. It required that a bulk-mail fixture carry "none" —
no candidates at all — and the implementation cannot honour that. A newsletter's only
digit run is its copyright year, and a year is one of the *reducing* shapes rather than
an excluding one, so `2026` is returned, ranked last. Honouring the original wording
would have required the parser to drop a digit run, which the same specification forbids
in the "Every plausible candidate is surfaced" requirement.

So the requirement is now the property that is actually true and actually worth holding:
**in a fixture with no true code, nothing ranks as high as a true code does.** That is
the false-positive measurement, and unlike a count of zero it is achievable without
lying about the parser. The corpus states `["2026"]` for the newsletter, and
`corpus.test.ts` asserts both that the year is last and that it scores below a real code.

**This is the sixth recorded instance of a check narrower than the rule it documented**
(this milestone's seventh, counting the phone shape recorded in `design.md` D4). The
lesson is unchanged and worth restating because the recurrence is the point: a
requirement that describes an outcome no honest implementation can produce gets satisfied
by making the implementation dishonest, or by quietly dropping the requirement. Neither
is acceptable, and the fix is to rewrite the requirement to the property that is both
true and valuable.

#### Scenario: A fixture's expectation changes

- **WHEN** a change alters what a fixture yields
- **THEN** the fixture's stated expectation SHALL be updated in the same change
- **AND** a difference between the two SHALL be visible in a review rather than
  discovered later as a silent discrepancy

#### Scenario: A fixture is shaped like a named service's mail

- **WHEN** a fixture is named for a service
- **THEN** it SHALL carry a field declaring it synthetic
- **AND** its note SHALL state that this repository has never received mail from that
  service
- **AND** a fixture SHALL NOT reference a resolvable host

**Note, recorded during apply.** Added because the two `-style-` fixtures name real
services, and a fixture named `github-style-verification` invites a future maintainer to
read it as a capture. M0 received a provider welcome message and one maintainer-sent
message; it received no verification mail from any service, so nothing in the corpus has
provenance, and the naming is the thing that could be misread. The check is on a field
rather than a comment because a comment can be deleted without a failing test.