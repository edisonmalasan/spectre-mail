# Spec Delta

## MODIFIED Requirements

### Requirement: The affordance inserts the address this device already holds

When the affordance is activated on an email field, the extension SHALL insert the address of a
mailbox already stored on this device into that field, and SHALL read that address through the
shared storage contract rather than by interpreting stored records itself. **The address the
control will insert SHALL be named by the control itself**, because this device may hold more than
one mailbox and an affordance that says only that it is SpectreMail no longer says which address it
is about to write into somebody else's page.

The extension SHALL NOT submit, press, or otherwise activate the form the field belongs to, and it
SHALL offer no affordance on a field that already holds text: a control that replaces what a user
has typed is a data-loss gesture, and refusing to appear is the answer that contains no ambiguity
about what was asked for.

**Amendment, recorded at proposal (2026-10-08), by `site-associations`.** This said **"the address
of the mailbox already stored on this device"**, which was singular because the device held exactly
one mailbox — measured, not assumed: both storage adapters write it under one key and a second
creation overwrites the first. **What is singular is now a choice rather than a fact.** The device
may hold several mailboxes, so the requirement states which one, and it states that the control says
which one. **Naming the address is the whole mechanism**: this change adds no list, no menu, and no
second control inside somebody else's page, so the accessible name is the only surface on which the
choice can be reported at all. A name that did not carry the address would leave the difference
between what the popup shows and what the page receives invisible to the person about to submit a
form to a stranger.

The two rules this requirement already carried — the form is never activated, and no affordance
appears over text somebody typed — are **unchanged**, and the second is the reason this design can
name an address at all: the control only ever appears over an empty field, so the address it names
is one the person is about to submit rather than one that would overwrite their own typing.

#### Scenario: The affordance is activated on an empty field

- **WHEN** the affordance is activated on an empty email field
- **THEN** the field SHALL hold the address of a mailbox stored on this device
- **AND** that address SHALL be one the control named before it was activated

#### Scenario: The control names the address it will insert

- **WHEN** an affordance is offered on an email field
- **THEN** its accessible name SHALL contain the address it will insert

#### Scenario: The field already holds text

- **WHEN** an email field holds text and takes focus
- **THEN** the extension SHALL offer no affordance for that field

#### Scenario: The form is not activated

- **WHEN** the affordance has inserted an address
- **THEN** the extension SHALL NOT have submitted the form the field belongs to
- **AND** the extension SHALL NOT have pressed a control belonging to it

## ADDED Requirements

### Requirement: The control prefers the mailbox this site was last used with

Where this device holds a mailbox that was **last used on the site the field belongs to**, the
affordance SHALL offer that mailbox in preference to any other mailbox this device holds, and
SHALL insert it. Where it holds none for this site, the affordance SHALL offer the newest mailbox
it holds, which is the same answer it gave before this change.

A site SHALL be identified by the **exact** host the browser reports for the page the field belongs
to, with no parent-domain folding and no leading `www.` removed, so a mailbox used on
`login.example.co.uk` is not offered on `example.co.uk`. **A key derived from anything other than
the browser's own value SHALL NOT be used**, because this repository ships no public suffix list and
a rule that guesses one merges hosts a person told apart.

**Why "last used" and not "the first one that matches", recorded because it is the difference between
a map and a guess.** The association names one mailbox per host, and the record is written when an
address is inserted rather than when the page is visited. So a host resolves to exactly one answer,
and a host that was never used with one resolves to the newest mailbox rather than to whichever
mailbox happened to be stored first.

**And the preference is what "allow using: the mailbox this site was last used with" means here,
stated plainly because the roadmap's wording is a list of three.** This change delivers that third
option as **which** mailbox a site resolves to, not as a menu over the others. A person on a site
that has an association who wants a different existing mailbox has no control for it; they create a
new mailbox, which becomes the newest, and it is offered on the next visit. **That is a real limit
on "allow using", and it is recorded here rather than left to be discovered at M10**, when a menu
inside somebody else's page can be judged on its own evidence instead of added as a side effect.

#### Scenario: This site has a mailbox of its own

- **WHEN** an email field takes focus on a host this device holds a mailbox for
- **THEN** the affordance SHALL name and insert that mailbox

#### Scenario: This site has no mailbox of its own

- **WHEN** an email field takes focus on a host this device holds no mailbox for
- **THEN** the affordance SHALL name and insert the newest mailbox this device holds
- **AND** the answer SHALL be the same one a site with no association has always received

#### Scenario: Two hosts that share a parent domain

- **WHEN** a mailbox was last used on `login.example.co.uk`
- **THEN** a field on `example.co.uk` SHALL be offered the newest mailbox instead

#### Scenario: The host is read rather than derived

- **WHEN** the key for a site is determined
- **THEN** it SHALL be the host the browser reports for that page
- **AND** no other spelling of that host SHALL be used as a key

### Requirement: An association is recorded by an insertion, and one that cannot be honoured is not offered

A host SHALL be associated with a mailbox **only after an address was inserted** on that host, and
SHALL NOT be associated merely because a field took focus or because the affordance was shown. The
association therefore records something a person did rather than something a page did.

Where a recorded association names a mailbox this device **no longer holds**, the extension SHALL
NOT offer that mailbox, SHALL NOT offer a different mailbox under that host's name, and SHALL NOT
repair, overwrite, or delete the record while offering the field. It SHALL offer the same answer
this site would have received had no association been recorded, and it SHALL leave the unreadable
record in place.

**Why an insertion and not a view, recorded because the alternative is a record of page loads.** A
page can make an email field take focus by script, so an association written on focus would let any
site on the internet decide which mailbox this device offers on a host it merely mentions in a
frame. Writing it on the insertion puts the record behind the one action a person took, and it makes
the stored key mean what its name says.

**Why a stale association is ignored rather than repaired, recorded because either repair looks
tidy.** The id in the record names a mailbox that existed on some earlier visit and does not now —
this product has no deletion, so the honest causes are a storage area that was emptied and a record
this build cannot read. Overwriting it with the newest mailbox would destroy the association the next
time this device is at that host with no mailbox to name, and the person would find the host had
silently changed what it inserts. Deleting it would be the irreversible half of the same decision:
the record is unreadable, not proven wrong. So the requirement is the narrow one — offer nothing
this device does not hold — and the record stays.

#### Scenario: An address is inserted on a host

- **WHEN** the affordance inserts an address on a host
- **THEN** that host SHALL resolve to that mailbox on a later visit to it

#### Scenario: A field takes focus

- **WHEN** the affordance is offered on a host this device holds no mailbox for
- **THEN** no association SHALL be recorded for that host

#### Scenario: The recorded mailbox is gone

- **WHEN** a host's recorded mailbox is one this device no longer holds
- **THEN** the affordance SHALL offer the newest mailbox this device holds instead
- **AND** the recorded association SHALL be left in place

#### Scenario: The association cannot be read at all

- **WHEN** the association record cannot be read
- **THEN** the affordance SHALL offer the newest mailbox this device holds
- **AND** the failure SHALL NOT be reported as "this site's mailbox"