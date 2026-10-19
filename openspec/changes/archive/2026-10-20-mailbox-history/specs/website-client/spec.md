# Spec Delta

## ADDED Requirements

### Requirement: The page offers the mailboxes this device holds, and returns a person to one

The page SHALL offer **every mailbox this device holds, newest first**, and SHALL let a person
return to any of them. It SHALL render that offer **inside the product region** and SHALL NOT add a
region to the page for it, because `page-composition` forbids a sixth.

**A mailbox this device can no longer reach SHALL be offered as such, and SHALL NOT be offered as
though it worked.** The distinction is the one the shared session layer already draws — a mailbox the
provider has reported gone against one whose provider session could not be checked — **because the
roadmap's condition for offering one at all is *where the provider session still permits access*.**

**This surface SHALL render whatever the session is doing, for the reason `LocalData` already does.**
A person whose address could not be created, or whose inbox could not be listed, still has other
addresses on this device and still needs to reach one: **what this browser remembers has nothing to
do with what the session is doing.**

**No mailbox shall leave the list because a newer one was recorded.** `spectre-storage`'s contract
records that a mailbox recorded before a build *"stops being offered once this device records
another one"*, and **that is a footnote on an extension and a defect here** — this page's own
requirement is that a reload returns the user to the address they came back for, and an address that
silently leaves the list is a person losing one they recognised. **The provider's session lifetime
decides which of these mailboxes are still reachable; the product's own bookkeeping decides only
what is listed, and SHALL NOT decide what is kept.**

**What this requirement does not say.** It does not say how many mailboxes are kept, because no
provider in this repository has had its session lifetime measured and **a count of days would be a
figure this repository has not measured**. It does not say how the list looks.

#### Scenario: The page boots with several mailboxes held

- **WHEN** the page finishes its boot read and this device holds more than one mailbox
- **THEN** every mailbox held SHALL be offered, newest first
- **AND** the offer SHALL render inside the product region

#### Scenario: A person returns to one

- **WHEN** a person chooses a mailbox from the offer
- **THEN** the page SHALL bring that mailbox up and list it
- **AND** the page SHALL NOT create a new mailbox to do so

#### Scenario: The provider will not let the page reach a mailbox

- **WHEN** a mailbox the device holds is reported by its provider as gone
- **OR** its provider's session cannot be checked
- **THEN** the page SHALL say which of those two happened
- **AND** it SHALL NOT offer that mailbox as though it worked

#### Scenario: A newer mailbox is recorded

- **WHEN** this device records a mailbox newer than one it already held
- **THEN** every mailbox it held before SHALL still be offered
- **AND** the list SHALL still be ordered newest first

#### Scenario: The session is not in a state that shows an address

- **WHEN** the session reports a creation failure, or an inbox that could not be listed
- **THEN** the offer SHALL still render
- **AND** the reason it renders in that state SHALL be recorded beside the surface rather than left
  for a reader to infer