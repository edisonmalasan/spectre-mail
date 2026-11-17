## MODIFIED Requirements

### Requirement: A dead session is never reported as an empty mailbox

An adapter SHALL distinguish a mailbox that is genuinely empty from one whose
session the provider no longer honours. Liveness SHALL be decided from signals the
provider is measured to send, and the absence of a field SHALL NOT be treated as
evidence that a session is dead unless that absence is itself measured to mean it.
Where a provider reports an unusable session without a recognised-session status,
the adapter SHALL detect that condition and report it rather than returning an
empty result.

#### Scenario: A stored Guerrilla session has expired

- **GIVEN** a provider that answers an unrecognised session with a success status,
  an `error` string and no message list
- **WHEN** messages are requested for a mailbox using that session
- **THEN** the adapter SHALL detect the session is no longer honoured
- **AND** it SHALL report an expired or unusable mailbox
- **AND** it SHALL NOT return an empty message list

#### Scenario: A mailbox is genuinely empty

- **WHEN** a valid session is polled and the provider returns no messages
- **THEN** the adapter SHALL report an empty list
- **AND** the empty result SHALL NOT be reported as a session failure

#### Scenario: A live listing carries no address

- **GIVEN** a live session whose listing carries a message list and no address
  field
- **WHEN** messages are requested for a mailbox using that session
- **THEN** the adapter SHALL report the messages the listing carries
- **AND** it SHALL NOT report the session as expired

#### Scenario: A live listing echoes a different address

- **GIVEN** a listing whose echoed address differs from the mailbox's own address
- **WHEN** messages are requested for a mailbox using that session
- **THEN** the adapter SHALL report an expired or unusable mailbox
- **AND** it SHALL NOT return the listing as that mailbox's messages

> Measured basis: a live Guerrilla listing echoes the mailbox address under
> `email` and never carries `email_addr`, which appears only on
> `get_email_address`. An empty live listing is `{"list":[],"email":…}`; an
> unrecognised session is
> `{"error":"Please call get_email_address or set_email_user first"}` with no
> `list` at all (`docs/PROVIDERS.md` §4.5, re-measured 2026-11-18). `auth.success`
> is `true` in both shapes and cannot decide liveness, and `count` was measured as
> `"0"` on a one-message listing and `0` on an empty one, so it cannot either.
>
> **Amendment, recorded at proposal (2026-11-18).** The expired scenario's GIVEN
> read *"and an empty message list"*. The measured dead body carries no `list` at
> all, so the scenario now says what was measured; the requirement's property is
> unchanged, and the two scenarios that predate this amendment are carried forward
> by title and body.
