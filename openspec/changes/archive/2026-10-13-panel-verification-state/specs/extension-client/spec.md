# extension-client — delta

## ADDED Requirements

### Requirement: The side panel states, per message, whether a detected verification was found in it

The side panel SHALL state, for each message in the listing of the mailbox the panel view is about,
whether that message was determined to carry a detected one-time code, a detected verification link,
or both. The statement SHALL be derived from the shared session's own listing and SHALL NOT be
computed by the panel from anything else.

**The panel SHALL distinguish a message the session has read and found to carry nothing from a
message it has not been able to read.** These are different claims about the mailbox and the panel
SHALL NOT render them identically: a message carrying a detected verification SHALL carry a marking in
its listing row naming what was detected, a message read and found to carry none SHALL carry no
marking, **and a message the session has not determined SHALL carry a marking on its own row stating
that it could not be read.** A listing that has not been determined in full SHALL NOT be reported as a
mailbox holding no detected verification.

**The marking SHALL be text naming what was determined, and a message the session has not determined
SHALL NOT be presented as carrying a detection.** A marking that asserted the presence of a
verification for a message nobody read would send a person to look for a code that was never found,
which is the one false claim this product exists to avoid.

**The panel SHALL NOT render a confidence value, a percentage, or a claim that a message carries no
verification.** What the session found is not what a message contains: the parser's confidence is
capped by construction rather than by a clamp, and a message that reduces a detection's score is
still returned rather than excluded. The panel's wording therefore reports **what the session
determined** and never certifies what the message holds.

**The panel SHALL NOT obtain this state any other way.** It SHALL NOT read a message body itself,
SHALL NOT make a provider request to determine it, and SHALL reach it only through the shared
session's listing. **A panel that read bodies to decide a row would spend a provider request per
message to recompute an answer the session already holds** — which is the waste
`background-check.ts`'s use of `restoreSummaries` exists to avoid, recorded there as a measured
repair.

**Nothing about this state SHALL be stored.** The panel SHALL write no stored verdict, no new
storage record and no preference, and a statement made on one occasion SHALL NOT be offered on a
later occasion as though it were current. **A stored verdict would outlive the body, the parser that
produced it and the request that asked for it, and a stale marking is read as a current one.**

**This clause is about surviving the session, not about the session's own retention.** The shared
session already holds an analysis against a message so that it is never determined twice, and keeps a
last known listing when a check fails; a statement made from what that session holds is the session
doing what it is required to do. **A later occasion is a later panel, a later session or a later
build** — and a message the session *did* read SHALL NOT be marked as unreadable merely because the
check after it failed.

**Amendment of record at proposal (2026-10-12), by `panel-verification-state`. This requirement is
ADDED rather than folded into *"The side panel renders the mailbox this device holds, beside the page
rather than in place of it"*, and the reason is that a reader must be able to review this change's
sentence separately.** The panel requirement is 141 lines and was amended the previous day, so a
`MODIFIED` block would carry all of it verbatim and this change's own words would have to be found by
diffing two long blocks by eye — the shape in which an amendment gets attributed to the wrong
assertion. The claim is also separable: it is about a listing's content and depends on none of the
host-naming, mailbox-choosing or transient-choice clauses.

**The promoted specs forbid no such statement anywhere in this repository, and this requirement is
positive rather than permissive anyway.** Exactly two clauses forbid a surface from indicating a
verification and **both name the popup** — *"The popup SHALL NOT indicate that a message carries a
verification until it has opened that message"*, inside a requirement headed *"The extension's popup
performs its first milestone's actions over the shared session"*, with its scenario *"A check has
listed messages"*. **A panel is therefore not forbidden, and not being forbidden is not being
permitted** — so the permission is stated here rather than inferred from an absence.

**The two surfaces render one component, which is why this clause has to be positive in the sharpest
possible way.** `MessageSurface.tsx` exists because `Popup.tsx` and `Panel.tsx` need the same list,
and both import the same `MessageList` — so a marking implemented in it **reaches the popup**, whose
prohibition and whose *"A check has listed messages"* scenario describe exactly the state it would be
rendered in. **A marking on a listing SHALL be produced only for a surface that asks for it, and a
surface that does not ask SHALL render its listing exactly as it does without this requirement.** The
absence of the marking is the default and not an exception, so a surface that never asks for one
cannot acquire one by omission.

**The popup's own reasoning is about carrying rather than about surfaces, and it does not reach
this requirement.** It reads that *"the count the popup showed before is the whole of what a listing
can support, and a marker the listing cannot carry would be a guess about a message nobody has
read."* **The panel's listing does carry it:** `packages/mailbox` determines the verdict, holds it
against the message so it is never determined twice, and reports it on the listing type itself —
which the promoted requirement headed *"A message is analysed once, and only when it is new"* already
obliges. The marking is a fact the session produced, not a guess about a message nobody read.

**The scheme is the website's, not this change's.** `apps/web` already renders this union with an
**exhaustive marking for every verdict including the empty one**, and it already marks a message it
could not read **in words on that row** while withholding the visual claim reserved for the positives.
**The panel states the same thing the same way**, because two clients rendering one shared union
differently is the divergence a closed record exists to prevent. **What the panel does not take is
the website's closed set of positive verdicts, which exists to decide which rows draw an accent
rule: this requirement adds no accent rule, and a named set with no consumer is a second thing to
keep in step.** The clause it served — that an undetermined message is not presented as carrying a
detection — is met here by the marking itself, which names that the message could not be read.

#### Scenario: A message carries a detected verification

- **WHEN** a message in the mailbox the panel is about was determined to carry a detected one-time code or a detected verification link
- **THEN** the panel SHALL mark that message's row
- **AND** the marking SHALL name which was detected rather than naming both

#### Scenario: A message was read and carries nothing

- **WHEN** a message in the mailbox the panel is about was read whole and no verification was detected in it
- **THEN** the panel SHALL carry no marking on that message's row
- **AND** the panel SHALL NOT state that the message carries no verification

#### Scenario: A message could not be determined

- **WHEN** a message in the mailbox the panel is about has not been determined
- **THEN** that message's row SHALL carry a marking stating that the message could not be read
- **AND** that row SHALL NOT be marked as carrying a detected verification
- **AND** the panel SHALL NOT report it as a message it determined carries nothing

#### Scenario: The listing is not yet determined in full

- **WHEN** the panel's listing holds messages whose verdicts are not all determined
- **THEN** the panel SHALL NOT state that the mailbox holds no detected verification

#### Scenario: A check failed and the last known listing is shown

- **WHEN** the panel shows a listing the session determined on an earlier check
- **THEN** each row SHALL carry the marking that listing's own verdicts give it
- **AND** a row whose message was read SHALL NOT be marked as a message that could not be read

#### Scenario: The panel states what the session holds

- **WHEN** the panel states a message's verdict
- **THEN** it SHALL read that verdict from the shared session's own listing
- **AND** it SHALL make no provider request of its own to determine it
- **AND** it SHALL read no message body of its own

#### Scenario: Nothing is stored

- **WHEN** the panel states what the session determined about a message
- **THEN** the extension SHALL write no stored verdict and no new storage record
- **AND** a later occasion SHALL NOT offer that statement as though it were current without
  determining it again
