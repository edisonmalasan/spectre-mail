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
- **AND** it SHALL offer a way to get a new address

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

**Amendment, recorded during proposal (2026-11-22), by `m23-expired-mailbox-recovery`,
revised after orchestrator review the same day.** Everything above this paragraph
is the promoted requirement carried forward byte-for-byte, including all seven
scenarios and both earlier amendment notes. Two scenarios are added below, one
for each control on the gone screen. The general claim in the first paragraph
that the page "SHALL persist the mailbox it holds so a later visit can offer it
again" was false on the expired-replacement path: `apps/web/src/App.tsx:186–191`
wired both controls of `StoredAddressGone` to `startFresh`, and
`apps/web/src/useMailboxSession.ts:379–382` made that path create a new mailbox
without persisting it, so a later visit read the same dead record. **No record is
cleared or deleted by this change.** Persisting the replacement overwrites the
single record and preserves the recent-mailbox collection in one transaction
(`packages/storage/src/indexeddb-mailboxes.ts:399–438`); the first draft's
automatic `clearAll` was rejected because it deleted the whole area, including
data the user never asked to remove. A user who takes no action will therefore
see the truthful gone state again on a later visit, which is correct because the
provider did say that address is dead. The scenario *The stored address could
not be checked* is deliberately left unchanged: a provider that could not be
asked is not a provider that said the mailbox was gone, so nothing is discarded
there and the existing clause stays true.

#### Scenario: The user asks for a new address after the saved one was found gone

- **WHEN** the user activates the control that offers a new address on the gone
      screen
- **THEN** a new mailbox SHALL be created
- **AND** it SHALL be persisted as the mailbox this device returns to
- **AND** a later visit SHALL offer the replacement rather than the dead address
- **AND** no mailbox held in this device's recent-mailbox collection SHALL be
      removed by the recovery

#### Scenario: The user asks to check the saved address again after it was found gone

- **WHEN** the user activates the control that offers to check the saved address
      again
- **THEN** the existing re-boot and restore path SHALL ask the provider that owns
      that same stored mailbox about it again
- **AND** no new mailbox SHALL be created and the stored record SHALL NOT be
      discarded
- **AND** if that provider confirms it, the same mailbox SHALL be presented as
      the user's own
- **AND** if that provider again reports it gone, the page SHALL remain on the
      gone screen
- **AND** if that provider cannot be asked, the page SHALL report that it could
      not tell, with the inconclusive state's existing meaning and copy unchanged

### Requirement: The website never claims a mailbox lifetime it cannot know

The website SHALL NOT display a countdown, an expiry time, or a remaining lifetime
derived from a creation time or a documented limit. Absent an expiry the provider
itself reported, the website SHALL say the lifetime is unknown.

**Note, recorded during proposal.** `provider-abstraction` already requires that
mailbox lifetime not be assumed, and this states the consequence for the screen a
user reads. Mail.tm publishes a 7-day retention and says a mailbox lasts until
deleted, but neither value appears in any API response and neither was measured
live; Guerrilla publishes nothing equivalent. A countdown computed from either
would be a number the product invented, and it would be wrong in the one direction
that costs a user a verification code.

#### Scenario: The created mailbox carries no expiry

- **WHEN** the website receives a mailbox with no expiry the provider reported
- **THEN** it SHALL state that the lifetime is unknown
- **AND** it SHALL NOT display a countdown or a number of minutes remaining

#### Scenario: The provider does report an expiry

- **WHEN** the website receives a mailbox carrying a provider-reported expiry
- **THEN** it MAY display that expiry
- **AND** it SHALL attribute it to the provider rather than present it as
  SpectreMail's guarantee

**Amendment, recorded during proposal (2026-11-22), by `m23-expired-mailbox-recovery`.**
The requirement and its two scenarios above are carried forward byte-for-byte.
One scenario is added. It exists because persisting a replacement is a change in
what the device stores, and it must not be mistaken for a statement about how
long mailboxes last. Measured on the UI reference temp-mail.org on 2026-11-22,
its FAQ says an address is valid *"until you delete it or until the service
changes the domain list"*, its live API returns no `expires` field, and its token
JWT has `iat` but no `exp`: there is no fixed lifetime to copy. No countdown,
timer, interval, or invented duration is introduced by this change.

#### Scenario: A replaced record is not a lifetime

- **WHEN** the website persists a replacement for a stored mailbox its provider
      reported gone
- **THEN** the persistence SHALL follow that provider's signal alone
- **AND** it SHALL NOT be derived from a creation time, a documented lifetime, a
      countdown, or an interval
- **AND** no fixed mailbox lifetime SHALL be introduced by the change
