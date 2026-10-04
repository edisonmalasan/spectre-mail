# Spec Delta

## MODIFIED Requirements

### Requirement: The session layer holds no framework, DOM, or storage state

The session layer SHALL be usable without a UI framework, without a DOM, and
without any persistence mechanism. It SHALL NOT import a rendering library, and
it SHALL NOT read or write storage, cookies, or the URL. It MAY be handed a
previously stored mailbox **as a value**, and SHALL treat it as untrusted input
rather than as one of its own.

**Note, recorded during proposal.** This is the requirement that decides where
the layer lives. The roadmap's shared-package list assigns "mailbox lifecycle"
and "mailbox manager" to `packages/core`, but `shared-domain-model`'s approved
purpose states it describes "the model and its invariants only" and excludes
lifecycle behaviour. A roadmap is a plan; an approved spec is a contract. Where
they disagree the contract wins, so the behaviour goes in its own package rather
than quietly widening `packages/core` from a type surface into a runtime one.

**Amendment, recorded during proposal (2026-10-05).** The first sentence of the
requirement now says the layer may be handed a stored mailbox as a value. It did
not need to before, because nothing recovered one. What it must **not** become is
a requirement to reach storage: the value arrives from whoever asked for it, and
the second sentence is unchanged so that remains true. This amendment was written
into this delta rather than left for the sync stage, because `openspec/specs/` is
the source of truth for what is required and the archived delta is the record of
what this change asked for — a gap between the two is an amendment recorded in the
wrong artifact.

#### Scenario: The package is imported without a browser

- **WHEN** the session layer's test suite runs
- **THEN** it SHALL pass in an environment with no DOM and no rendering framework
- **AND** no test SHALL require a browser, a network, or a provider

#### Scenario: A reload loses the session

- **GIVEN** a mailbox was created
- **WHEN** the client is reloaded and the session is handed nothing
- **THEN** the session SHALL NOT claim to have recovered that mailbox
- **AND** it SHALL open a new one or report none

**Amendment to this scenario, recorded during proposal (2026-10-05).** The
scenario's title is unchanged and deliberately so: it is still true, and it is
true of the case that matters most. What changed is the **GIVEN**, which now says
the session is handed nothing. That is the real shape of the condition — the
session layer cannot lose a mailbox it was never given, and a scenario phrased
only in terms of a reload reads as though reload were the cause. The cause is that
nobody offers a stored mailbox.

This is the scenario `design.md` D9 deferred rather than let go: adopting a stored
mailbox makes the unqualified form false, and an amendment recorded here means the
archive carries the reason it was false.

#### Scenario: A stored mailbox arrives as a value

- **WHEN** a caller hands the session a mailbox read from storage
- **THEN** the session SHALL accept it without reading or writing storage itself
- **AND** the session's own sources SHALL contain no storage API

## ADDED Requirements

### Requirement: A stored mailbox is adopted, never inferred

The session layer SHALL accept a stored mailbox only when a caller offers it one,
and SHALL NOT discover, guess, or reconstruct a mailbox on its own. It SHALL NOT
create a replacement mailbox on behalf of a caller that supplied one, and it SHALL
NOT report a mailbox as recovered that no caller supplied.

**Note, recorded during proposal.** The direction of travel here is the whole
point. A session that can find its own mailbox has storage, and a session that can
create its own replacement has decided what the user came back for. Both are the
failure this requirement names in advance: a restored address the user recognises,
quietly replaced by a different one, is worse than no recovery at all, because
the address is what they are about to paste into a third-party sign-up form.

The session is also where this is enforceable. If loading lived in the client, a
client that failed to read storage would reach for `open()` and no requirement
could tell the difference between a first visit and a failed recovery.

#### Scenario: The session is given a mailbox to adopt

- **WHEN** a caller hands the session a stored mailbox
- **THEN** the session SHALL attempt to adopt that mailbox
- **AND** it SHALL NOT create another mailbox instead

#### Scenario: The session is given nothing

- **WHEN** a caller hands the session no mailbox
- **THEN** the session SHALL create one when asked to
- **AND** it SHALL NOT present any address it did not receive from a provider

#### Scenario: Nothing is stored and no request has been made

- **WHEN** a session has been built and asked to do nothing yet
- **THEN** it SHALL report that it has not looked for anything
- **AND** it SHALL NOT report that it is creating a mailbox

### Requirement: An adopted mailbox is reconciled with its provider before it is presented

A stored mailbox SHALL be presented as the user's own only after the provider that
owns it has confirmed it, by a request that would fail for a mailbox the provider
no longer recognises. An empty inbox SHALL NOT count as that confirmation. A
mailbox the provider reports as gone SHALL be distinguishable from one that merely
could not be checked, and a stored mailbox SHALL NOT be discarded because a check
did not complete.

**Note, recorded during proposal.** This requirement exists because of a measured
provider behaviour, not a precaution. `docs/PROVIDERS.md` §3 records that an
unrecognised Guerrilla Mail session answers `HTTP 200` with an empty inbox and no
error, so "nothing has arrived" and "this address is gone" are the same response.
The provider adapter already tells them apart — it checks the session the response
carries — and this requirement exists so that a client cannot skip the check and
reach the same conclusion by looking at the message list.

That is why the confirmation has to be a *request*. Reading the stored record proves
only that this device once held a mailbox, which is not the same claim as that the
provider still has it.

The two failures are separate states rather than one state plus an error code
because they offer different things to the user. A mailbox the provider has dropped
cannot be retried into existence, so it offers a new address; one that could not be
checked may work on the next attempt, so it offers a retry. Making every client
compare an error code to recover that distinction would put the comparison in every
client instead of once.

#### Scenario: The provider confirms the mailbox

- **WHEN** the provider that owns a stored mailbox answers a request for it
- **THEN** the session SHALL present that mailbox as the user's own
- **AND** the inbox it reports SHALL be the inbox of that mailbox

#### Scenario: The provider answers with an empty inbox

- **WHEN** the provider reports no messages for a stored mailbox
- **THEN** the session SHALL NOT conclude from that alone that the mailbox is valid
- **AND** it SHALL rely on the provider's own account of the session

#### Scenario: The provider no longer recognises the mailbox

- **WHEN** the provider reports that a stored mailbox is gone
- **THEN** the session SHALL report that the address is gone
- **AND** it SHALL distinguish that from a check that did not complete

#### Scenario: The provider cannot be asked

- **WHEN** the request that would confirm a stored mailbox fails for any reason
- **THEN** the session SHALL report that it could not tell
- **AND** it SHALL NOT present the mailbox as confirmed
- **AND** it SHALL NOT discard what was stored

#### Scenario: Adoption is visible before it completes

- **WHEN** a caller hands the session a stored mailbox
- **THEN** the session SHALL report that it is checking it before the provider
      answers
- **AND** it SHALL NOT show an address it has not confirmed during that time