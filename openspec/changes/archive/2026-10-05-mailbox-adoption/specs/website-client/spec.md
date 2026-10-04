# Spec Delta

## MODIFIED Requirements

### Requirement: The website creates a mailbox without asking

On load the website SHALL look for a mailbox this device has stored, and SHALL
create one only when there is none. It SHALL present the address without
requiring an account, a sign-up step, an email address of the user's own, or any
other information from the user.

**Note, recorded during proposal.** Unchanged in what it forbids: no account, no
sign-up, no information asked for. What changed is the word *on load*, which used
to mean "create", and now means "look, then create if there is nothing".

**Amendment, recorded during proposal (2026-10-05).** Written into this delta
rather than added at the sync stage, so the archived record of what this change
asked for and the promoted spec agree exactly.

#### Scenario: A first-time visitor arrives

- **WHEN** the website is opened for the first time on a device
- **THEN** a mailbox SHALL be created
- **AND** its address SHALL be presented
- **AND** no form SHALL have been required first

#### Scenario: A returning visitor arrives

- **WHEN** the website is opened on a device that has a stored mailbox
- **THEN** the website SHALL NOT create a mailbox
- **AND** it SHALL present the stored address once the provider confirms it

#### Scenario: Creation is still in progress

- **WHEN** the page has loaded but no mailbox has been created yet
- **THEN** the website SHALL say so
- **AND** it SHALL NOT display a placeholder address, an example address, or any
      address it did not receive from the provider

#### Scenario: Looking for a stored address is still in progress

- **WHEN** the page has loaded and has not yet learned whether a mailbox is stored
- **THEN** the website SHALL say it is checking
- **AND** it SHALL NOT display any address

### Requirement: This milestone builds structure, not visual design

The website SHALL present a working page with correct structure, accessible names,
and states. It SHALL NOT apply the approved visual system, design tokens, or a
layout system, because the design milestone owns those and building them here
would produce markup that milestone rewrites.

**Note, recorded during proposal.** Unchanged. The reason this requirement exists
is that markup written now is markup the design milestone rewrites, and that has
not become less true by the milestone gaining states.

**Amendment, recorded during proposal (2026-10-05).** The state-coverage scenario
below now names the states recovery adds. It listed three, and a page that could
reach five more while its coverage requirement named three would be a page whose
states nothing had claimed to check.

**Second amendment, recorded during apply (2026-10-05).** That list was itself
incomplete, and the implementation is what showed it: it named six of the seven
states and omitted `creating`, which is the state a first-time visitor actually
sees for the whole of the provider request. A coverage requirement that omits the
most-observed state on the page is worse than the three-state version it replaced,
because it reads as exhaustive and would have let `creating` ship unrendered. The
enumeration is now all seven, in the order a page passes through them.

#### Scenario: The page is built

- **WHEN** the website's production build runs
- **THEN** it SHALL build and serve
- **AND** the milestone SHALL NOT have introduced a design token or theme system

#### Scenario: Each state is reachable

- **WHEN** the page is looking for a stored address, is creating a mailbox, is
      checking a stored one, has a ready mailbox, could not create one, could not
      check the stored one, or has found the stored one is gone
- **THEN** each SHALL be rendered as distinct, labelled content
- **AND** none SHALL be conveyed by colour alone

## ADDED Requirements

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