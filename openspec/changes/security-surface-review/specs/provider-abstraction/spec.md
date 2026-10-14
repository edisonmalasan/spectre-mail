# Spec Delta

## ADDED Requirements

### Requirement: A provider credential reaches the transport and this device's storage, and nothing else

A provider credential SHALL be used for exactly two purposes: **authenticating a
request to the provider that issued it**, and **being persisted in the storage record
of the mailbox it belongs to**. No surface this product ships — no message that
crosses a process boundary, no notification, no rendered string, no URL this product
builds — SHALL carry a credential field, and no credential SHALL appear in a value
this product writes to a place a person other than the one holding this device's
storage can read.

**This requirement is about where a credential may travel, not about how it is
stored.** `shared-domain-model` already requires that credentials be specific to one
provider and that a mailbox's provider and credentials agree; `provider-adapters`
already requires that they be captured in the provider's own session model, and that
the provider layer persist nothing. None of those says where a credential may *go*.

**The boundary this states is the one that holds today, and holding it is currently
carried by a comment.** A mailbox created inside a stranger's page is created by the
service worker, and the answer handed back to that page's content script carries the
address and the mailbox id — because the worker's own storage context already holds
the whole mailbox by the time the answer is built. **That is correct, and this
requirement exists so that the correctness is a property of the product rather than of
a reader having understood the code.** An answer widened to carry the mailbox, or a
notification built from a value that could contain one, would be a regression against
a stated obligation rather than a departure from an undocumented intention.

**A credential that must cross to the provider is not a leak, and the requirement
does not forbid it.** The request that presents it is the permitted destination. What
is forbidden is a credential arriving anywhere that is not that request or that
device's own record of the mailbox.

#### Scenario: The message kinds this extension sends are inspected

- **WHEN** every message kind this extension sends or receives is enumerated and
  narrowed through the reader that parses it
- **THEN** no kind's value SHALL carry a credential field
- **AND** a field named for a credential SHALL be present in none of them

#### Scenario: The shipped protocol declares no credential field

- **WHEN** every type this extension sends or receives is read
- **THEN** none of them SHALL declare a field that holds a credential
- **AND** the set of protocol types this repository ships SHALL be enumerable, so
  that a type added later is inside the same obligation rather than outside it

#### Scenario: A credential is persisted with the mailbox that owns it

- **WHEN** a mailbox is written to this device's storage
- **THEN** its credentials SHALL be written with it and nowhere else
- **AND** removing what this device holds SHALL remove those credentials with it,
  which `spectre-storage` already requires of every record kind

#### Scenario: A message is announced

- **WHEN** this extension raises a notification about a message
- **THEN** it SHALL carry the sender and the subject and no other field of the
  message, which `extension-client` already requires
- **AND** a value drawn from the mailbox record rather than from the message SHALL
  NOT appear in it

#### Scenario: A control is built from this device's mailbox

- **WHEN** any surface this extension renders is built
- **THEN** no value it displays SHALL be drawn from a mailbox's credentials
- **AND** the value it displays instead SHALL be the address, which is what a person
  needs and all a credential would tell them about someone else's account