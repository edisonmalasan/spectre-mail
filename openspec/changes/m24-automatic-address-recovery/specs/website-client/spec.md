# Spec Delta

## MODIFIED Requirements

### Requirement: A reload returns the user to the address they came back for

The website SHALL offer the mailbox this device stored on a previous visit, and
SHALL persist the mailbox it holds so a later visit can offer it again. It SHALL
NOT present a stored mailbox until the provider has confirmed it, SHALL NOT
present one address while another is the user's, and SHALL NOT discard a stored
mailbox because a check did not complete.

**Note, recorded during proposal.** This is the roadmap's `return to a recent
mailbox` acceptance line, which M5 recorded as blocked on the storage contract and
which now has one.

Two of its clauses are about what the website must *not* do, and they are the
clauses worth having in a requirement rather than only in the design. Presenting an
unconfirmed address risks handing the user an address they cannot receive at, at
the moment they are about to paste it somewhere. Discarding a stored mailbox on an
incomplete check means one dropped network request costs the user the address they
came back for.

Persisting the mailbox the page holds — rather than only the one it created — is
what makes replacing an address work: a user who replaces a mailbox and reloads
should return to the replacement.

#### Scenario: The user returns to a stored address

- **WHEN** the page loads with a stored mailbox the provider confirms
- **THEN** the address SHALL be presented as the user's own
- **AND** that mailbox's inbox SHALL be listed

#### Scenario: The user replaces the address and comes back

- **WHEN** the page holds a mailbox that was not created by the current page load
      and the user replaces it
- **THEN** the replacement SHALL be stored
- **AND** a later visit SHALL offer the replacement rather than the original

#### Scenario: The stored address is gone

- **WHEN** the provider reports that the stored mailbox no longer exists
- **THEN** the page SHALL say the address is gone
- **AND** it SHALL NOT show that address as one the user can receive mail at
- **AND** the page SHALL obtain a replacement automatically, without requiring an
      activation
- **AND** it SHALL persist the replacement as the address this device returns to
- **AND** it SHALL NOT offer a control to re-check the dead address

#### Scenario: The stored address could not be checked

- **WHEN** the page could not determine whether the stored mailbox still exists
- **THEN** the page SHALL say it could not tell
- **AND** it SHALL offer a way to try again
- **AND** it SHALL NOT state that the address is gone
- **AND** it SHALL NOT discard what was stored

#### Scenario: The page cannot read its own storage

- **WHEN** the page fails to read what it has stored
- **THEN** it SHALL NOT report that nothing is stored
- **AND** it SHALL NOT create a mailbox on that basis
- **AND** it SHALL say it could not check
- **AND** it SHALL offer a way to try again

**Amendment, recorded during apply (2026-10-05).** The last two lines are new. As
written the scenario forbade two failures and required nothing, which is a
requirement a page can satisfy by rendering nothing at all — and rendering
nothing is the most likely implementation of a page whose storage read threw,
because there is no mailbox to render. `spectre-storage`'s contract already makes
the read a rejection rather than a `null` precisely so this page can *say*
something; the scenario did not ask it to.

#### Scenario: The page cannot write what it has

- **WHEN** the page holds a mailbox and fails to store it
- **THEN** it SHALL say so
- **AND** it SHALL NOT claim the address will be here after a reload

**Amendment, recorded during apply (2026-10-05).** This scenario did not exist,
and its absence was found by the implementation rather than by review: the save
rule the change introduces has a failure path, and nothing in the delta described
what a page may do with it. A page that saved silently would leave the user
believing reload recovery works on a device where it does not, which is the same
class of claim as the one this requirement exists to prevent — asserting something
about stored data that is not true.

#### Scenario: A stored mailbox is offered and a new one is created

- **WHEN** the page presents a restored mailbox
- **THEN** it SHALL NOT also present a different address as the user's

**Amendment, recorded during proposal (2026-11-23), by
`m24-automatic-address-recovery`.** Everything above this paragraph is the
promoted requirement carried forward byte-for-byte, including all seven earlier
scenarios and both `2026-10-05` amendment notes. **The user decided to remove
the choice.** When the provider has definitively said the stored address is gone,
the "Your saved address is gone" screen no longer asks the person to pick between
a new address and re-checking the dead one; the page acts on the provider's answer
instead. The two-button gone screen is replaced by automatic persistence through
the existing `getNewAddress` handler, which creates through `session.open()` with
persistence enabled, so the save effect writes the replacement over the stale
single record and adds it to the recent-mailbox collection in the storage layer's
one transaction. **Nothing is cleared and nothing is deleted.** No `clearAll` runs
and no mailbox is removed: the dead address stays in the recent-mailbox collection
as the record of what the provider reported gone, and every other record this
device holds survives untouched. The scenario *The stored address could not be
checked* — the `restoreFailed` path — and all earlier scenarios and notes are
carried forward byte-for-byte and are explicitly out of scope: a provider that
could not answer is not a provider that said the address is gone, so no automatic
replacement happens there and that screen keeps its two controls. **Both headings
below are retained verbatim only because OpenSpec's whole-block replacement rule
forbids dropping or renaming scenarios in a `MODIFIED` block.** Their bodies now
state the opposite of the old user-choice behaviour: no activation is required and
neither control is rendered. No countdown, timer, interval, expiry field, or
lifetime derived from a creation time is introduced; expiry continues to follow
the provider's own signal alone.

#### Scenario: The user asks for a new address after the saved one was found gone

- **WHEN** the provider reports the stored mailbox gone
- **THEN** a new mailbox SHALL be created without user activation
- **AND** it SHALL be persisted as the mailbox this device returns to
- **AND** a later visit SHALL offer the replacement rather than the dead address
- **AND** no mailbox held in the recent-mailbox collection SHALL be removed

#### Scenario: The user asks to check the saved address again after it was found gone

- **WHEN** the provider reports the stored mailbox gone
- **THEN** the page SHALL NOT render the "Get a new address" control
- **AND** it SHALL NOT render the "Check the saved address again" control
- **AND** the replacement SHALL start automatically, without user activation
