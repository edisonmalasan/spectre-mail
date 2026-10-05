# Spec Delta

## ADDED Requirements

### Requirement: The user can make this device forget the address

Where this device holds an address, the website SHALL offer a way to remove it, and
SHALL say what removing it means. Removal SHALL be confirmed before it happens,
SHALL be reported honestly whatever its outcome, and SHALL NOT be undone by the
page continuing to run.

A user's decision to forget SHALL take precedence over persisting the mailbox the
page holds: while the user asks for nothing further, the page SHALL NOT write the
address back. A mailbox the user afterwards asks for SHALL be stored, because that
is a new decision rather than a continuation of the one they withdrew.

Where this device holds nothing, the website SHALL NOT offer removal and SHALL say
that nothing is kept. The website's own description of what it stores SHALL be true
of it, and SHALL NOT describe stored data as undeletable while offering no way to
delete it.

**Note, recorded during proposal (2026-10-05).** This requirement is the second
half of the promise *A reload returns the user to the address they came back for*,
and it is deliberately a separate requirement rather than an amendment to that one.
That requirement is about returning to a stored address; this one is about declining
to, and their failure modes are opposite — one risks losing an address, the other
risks silently writing one back. Folding them together would have made the
precedence between them implicit, and the precedence is the whole question. A user
who clears their data and then watches the page put the address back has been told
the truth and then had it taken away.

**Confirmation is a requirement rather than a nicety** because removal is
irreversible and the address is very often the one a sign-up in progress is waiting
on. Creating a replacement does not recover it: anything already sent to the old
address is lost, and the sign-up that was waiting for it cannot be completed. That
asymmetry is the whole argument, and it is the reason this is a two-step control
rather than a single button.

**The page keeps the mailbox on screen after removal, and that is not a
convenience.** The mailbox exists at the provider; what was removed is this
device's note of it. Discarding a live inbox because the user asked their browser to
forget an address would trade a privacy action for a data loss, and the user would
have asked for neither.

**Removal reaching the contract is already enforced architecturally.** No client may
name a platform storage API, and that boundary rule covers `deleteDatabase` as it
covers `indexedDB`, so a page cannot bypass the contract this removes through. What
the rule cannot enforce is the behavioural half — that the page does not write the
address back afterwards — because that is a comparison inside the page rather than a
named API. It is therefore a scenario here and not a boundary rule.

**Amendment, recorded during apply (2026-10-05).** The scenario *This device holds
nothing* presupposes that the page knows what the device holds, and it does not say what
the page may claim before it knows. That gap was found by implementing it: the region was
first rendered whenever storage was merely *available*, so during the boot read it
rendered its "nothing is kept" branch on a page that had not looked yet — a claim it
could not support, and the same failure `spectre-storage` exists to prevent, one layer
up. The added scenario names the third state, and the page resolves it by **withholding
the region entirely** rather than by inventing a fourth shape: the session's own region
is already saying a read is in flight, so nothing is left unsaid. This is the **fourth**
time this page has made a claim from a value it had not established, and the pattern is
worth more than any one instance — a branch reachable on an unknown value will eventually
assert something unverified.

#### Scenario: The page holds an address

- **WHEN** the page is displayed and this device holds an address
- **THEN** it SHALL offer a way to remove it

#### Scenario: Removal is confirmed before it happens

- **WHEN** the page offers removal
- **THEN** removal SHALL require an explicit further step
- **AND** nothing SHALL be removed before that step is taken

#### Scenario: The user removes their local data

- **WHEN** the user confirms removal
- **THEN** everything this device held SHALL be removed
- **AND** the page SHALL report that it was removed

#### Scenario: What removal means is stated

- **WHEN** removal has happened
- **THEN** the page SHALL say the address will not be offered again on a later visit

#### Scenario: The address stays usable

- **WHEN** removal has happened
- **THEN** the address SHALL remain on screen
- **AND** the mailbox's inbox SHALL remain usable

#### Scenario: The page does not write the address back

- **WHEN** removal has happened and the user does nothing further
- **THEN** the page SHALL NOT store that address again

#### Scenario: The user then asks for a new address

- **WHEN** removal has happened and the user asks for a different address
- **THEN** that address SHALL be stored

#### Scenario: Removal is refused

- **WHEN** removal fails
- **THEN** the page SHALL say it did not happen
- **AND** it SHALL NOT describe the data as removed

#### Scenario: This device holds nothing

- **WHEN** the page is displayed and this device holds no address
- **THEN** it SHALL offer no removal
- **AND** it SHALL say nothing is kept on this device

#### Scenario: What the page knows is not yet established

- **WHEN** the page has not established whether this device holds an address
- **THEN** it SHALL NOT say that something is kept
- **AND** it SHALL NOT say that nothing is kept

#### Scenario: The page's account of its own storage is checked

- **WHEN** the page describes what it stores and where
- **THEN** it SHALL NOT describe that stored data as something it cannot delete
- **AND** any statement about removal SHALL match what the page offers