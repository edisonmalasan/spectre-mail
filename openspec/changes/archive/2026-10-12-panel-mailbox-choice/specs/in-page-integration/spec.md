# Spec Delta

## MODIFIED Requirements

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
option as **which** mailbox a site resolves to, not as a menu over the others. **A person on a
site that has an association who wants a different existing mailbox has no control for it in this
affordance**; they create a new mailbox, which becomes the newest, and it is offered on the next
visit. **That is a real limit on "allow using", and it remains one for this affordance.**

**Amendment, recorded at proposal (2026-10-12), by `panel-mailbox-choice`. This limit's *milestone*
was stale and its scope was too wide; the limit itself did not change.** The text deferred this to a
named milestone on the grounds that *"a menu inside somebody else's page can be judged on its own
evidence instead of added as a side effect."* **That milestone has closed and no such change was
made**, so the deferral named a future that did not arrive and a reader would have gone looking for
it. **What the deferral did not say, and should have, is that the limit was never only about the
menu's evidence — it is also about whose page it goes on.** A panel is this extension's own
document and offers the choice; **this affordance is a control inside somebody else's page, and
there it still offers no way to choose among the mailboxes this device holds.** The scope is
therefore narrowed, not widened: the limit is now stated as this affordance's, and **no menu, no
control and no capability is added to the in-page surface by this change.**

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

#### Scenario: A person wants a different existing mailbox

- **WHEN** this device holds a mailbox it was not last used with on the site a field belongs to
- **THEN** the affordance SHALL offer only the mailbox that rule resolves to
- **AND** it SHALL offer no control to choose among the others
