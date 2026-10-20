# privacy-disclosure Specification

## Purpose

Records what SpectreMail keeps, what it reaches, and what it does not collect -- and
holds the three surfaces that restate those facts to one document instead of to each
other.

Every other capability in this repository describes a behaviour: a mailbox is created
without asking, a provider is never proxied, an address survives a reload. None of
them accumulates. **This product keeps five records across two storage areas, and the
count only rose with each milestone that added a surface**, so the risk here is not a
false claim in a document but a record that was added to the code and to no document
at all -- which is what happened with `site-mailboxes`, the only browsing-adjacent
record this product keeps and the one no document had named.

The second thing this capability exists to prevent is drift between a document and
the tree. A privacy document is prose somebody edits without running anything, so
unless every enumerable claim in it is compared against a constant the code itself
exports, the document is a promise with nothing holding it. That is why the claim is
**agreement in both directions** rather than a document that exists.

## Requirements

### Requirement: The privacy document is one document, and every claim in it resolves to the shipped tree

`docs/PRIVACY.md` SHALL be the one canonical statement of what this product keeps, reaches and
does not collect, SHALL be published in this repository, and SHALL be linked from `README.md`.
Every claim it states SHALL be resolvable to something this repository can verify by running an
assertion, and the document SHALL NOT state a claim that no shipped surface, promoted requirement
or recorded measurement supports.

The document is one document rather than several because the failure this change exists to end is
**three surfaces restating two sentences each with nothing holding them to one another.**
`page-composition` already requires the page's footer to ship *"the privacy and provider facts,
which are true"*, and those facts are two strings while the product keeps **five** records.

**Note, recorded during proposal (2026-10-14).** The record that makes this a requirement rather
than a nicety is `chrome.storage.local`'s `site-mailboxes` key: a mapping from a `hostname` to a
mailbox id, written at `apps/extension/src/content-script/controller.ts:348` and **only after an
insertion lands**. It is the only browsing-adjacent record the product keeps, it persists until
the whole storage area is removed, and **no document in this repository named it** — `README.md`
stopped at three bullets and `docs/ROADMAP.md` §29 at the single word `local-first`.

#### Scenario: The document is published and reachable from the project

- **WHEN** a reader opens this repository
- **THEN** `docs/PRIVACY.md` SHALL state what the product keeps, reaches and does not collect
- **AND** `README.md` SHALL link to it
- **AND** the document SHALL NOT be the only place any of those facts is written down

#### Scenario: A claim in the document has nothing behind it

- **WHEN** the document states a claim about what this product does
- **THEN** that claim SHALL correspond to a shipped surface, a promoted requirement in
  `openspec/specs/`, or a measurement recorded in `docs/PROVIDERS.md`
- **AND** a claim the document cannot resolve SHALL NOT appear in the document

### Requirement: What this device keeps is named exhaustively, and in both directions

The document SHALL name **every** key the shipped storage adapters own, and SHALL name no key
that no shipped adapter owns. The check SHALL run in both directions, and it SHALL read the key
list from the constants the adapters export rather than from a copy written beside it.

Both directions are required because they fail differently and one of them has no instance in
this repository yet. **A key the document omits** is a record the product keeps and does not
disclose. **A key the document names that nothing owns** is a stale name left behind after a
rename, and it is the likelier of the two, because a privacy document is prose that gets edited
without anything being run.

#### Scenario: A storage key exists and the document omits it

- **WHEN** a shipped storage adapter owns a key the document does not name
- **THEN** the check SHALL fail and SHALL name the key
- **AND** the document SHALL NOT be considered correct until it names it

#### Scenario: The document names a key nothing owns

- **WHEN** the document names a key no shipped adapter writes
- **THEN** the check SHALL fail and SHALL name the key
- **AND** the reader SHALL NOT report agreement while a named key has no owner

#### Scenario: Every key is named in both directions

- **WHEN** every key the adapters own is named in the document
- **AND** every key the document names is owned by an adapter
- **THEN** the check SHALL report agreement
- **AND** the agreement SHALL be asserted **before** any failure above is claimed

### Requirement: What providers receive is the measured origin set, and each client states which of them it reaches

The document SHALL name every provider origin a shipped client reaches, read from the built
extension manifest's `host_permissions` and from each client's configured provider list rather
than written beside them. The document SHALL state which client reaches which origin, and the
page's own provider sentence SHALL agree with it.

The per-client split is not incidental and SHALL NOT be flattened. **The website reaches
Guerrilla Mail and not Mail.tm**, because Mail.tm sends `Access-Control-Allow-Origin` only to its
own origins — measured live in the M0 spike and recorded in `docs/PROVIDERS.md` — while the
extension reaches both. A document that names one origin set for the product states something
true of neither client.

#### Scenario: The document names an origin no client reaches

- **WHEN** the document names an origin that is in no `host_permissions` entry and in no client's
  configured provider list
- **THEN** the check SHALL fail and SHALL name the origin

#### Scenario: The manifest gains an origin the document omits

- **WHEN** the built manifest gains a `host_permissions` origin
- **AND** the document does not name it
- **THEN** the check SHALL fail and SHALL name the origin

#### Scenario: The page's provider sentence disagrees with the document

- **WHEN** the page's own provider sentence names an origin the website's provider list does not
  carry
- **THEN** the check SHALL fail and SHALL quote both the sentence and the document's entry

### Requirement: What SpectreMail does not collect is a list whose every entry is grounded outside the document

The document's *does not collect* list SHALL have one entry per claim, and each entry SHALL carry a
pointer to the thing that supports it — a measurement in `docs/PROVIDERS.md`, a promoted
requirement in `openspec/specs/`, or an architecture rule in `AGENTS.md`. **The pointer SHALL
resolve**, and **the document itself SHALL NOT be an acceptable pointer.**

This requirement is deliberately narrower than proving the absence of shipped surface, and that
limit SHALL be stated rather than left for a reader to infer. It establishes that each claim is
**grounded**, not that the list is **complete**; a change may add the stronger check, and this one
records that it did not.

The self-reference prohibition is the operative clause. **A document supporting its own claim is
the exact shape this change exists to end**, so a claim whose only support is a sentence elsewhere
in the same file fails.

#### Scenario: An entry's support does not exist

- **WHEN** an entry names a support that this repository does not carry
- **THEN** the check SHALL fail and SHALL quote the entry and the missing support

#### Scenario: An entry is supported only by the document

- **WHEN** an entry's support is another part of `docs/PRIVACY.md`
- **THEN** the check SHALL fail
- **AND** the check SHALL fail on that reason rather than passing because the sentence exists

### Requirement: The hostname association is stated plainly and SHALL NOT be described as nothing

The document SHALL state that this product retains a mapping from a page's **hostname** to a
mailbox identifier, that it is written **only after an insertion lands** and never because a
control was offered, that it names the **hostname alone with no registrable-domain folding**, and
that it is removed with the rest of the storage area rather than on its own. The document SHALL NOT
describe the product as keeping no record that names a site.

The claim is stated in this shape because each of the four qualifiers is a decision already made
and already specified — `in-page-integration` holds the insertion-only rule and the exact-hostname
rule, `spectre-storage` holds the removal — and **a disclosure that omitted them would be
accurate in its outline and misleading in its detail.** A reader told only *"we remember which
sites you used a SpectreMail address on"* would reasonably assume `example.com` and
`mail.example.com` are one site, and would not know that no query string is retained, which is the
reason `location.hostname` was chosen.

#### Scenario: The document states what the extension keeps

- **WHEN** the document states what the extension keeps on this device
- **THEN** it SHALL name the hostname-to-mailbox-identifier mapping
- **AND** it SHALL state that only the hostname is retained

#### Scenario: The document describes the product as recording no site

- **WHEN** the document states that this product keeps nothing that names a site
- **THEN** the check SHALL fail
- **AND** the reader SHALL NOT report agreement on that text

#### Scenario: The document omits the association entirely

- **WHEN** the mapping exists in a shipped adapter
- **AND** the document does not name it
- **THEN** the check SHALL fail and SHALL name the key the mapping is written under

### Requirement: Provider attribution is stated in neither direction

The document SHALL state what was verified about attribution for each provider, and SHALL **not**
state that an attribution obligation exists and SHALL **not** state that none does. Where a
provider's terms were read, the document SHALL quote what they do and do not say about attribution;
where no terms page was located, the document SHALL say so and name the paths that were tried.

Neither direction is available as a claim. **No terms page was located for Mail.tm** — every route
tried returned nothing, at both an unprefixed and a locale-prefixed shape — and **Guerrilla Mail
publishes Terms of Service at `/tos`, linked from its own homepage, which were read on 2026-10-16
and which contain no attribution clause.**

**This requirement is MODIFIED rather than re-ADDED, and the amendment is recorded during sync
(2026-10-16).** Its previous body said *"Guerrilla Mail publishes nothing this repository found"*,
**and that is now measured false** — the provider publishes a terms page, an API document, and a
privacy section, at paths this repository did not look at. **The requirement's own rule is what
makes the amendment necessary rather than optional**: it forbids recording an unread absence as
though it had been read, and this repository had recorded one. **Adding a neighbouring requirement
instead of amending this one would have left `openspec/specs/` holding two requirements that
contradict each other**, which is the shape in which an amendment gets attributed to the wrong
assertion.

**What the amendment does not do is resolve attribution.** A terms page that contains no attribution
clause is not a permission and not a prohibition; it is a document that does not mention the
subject, and **the difference between that and a document that grants a permission is the difference
between reading a document and reading an absence into it.**

`AGENTS.md`'s architecture rules forbid citing provider terms that were not verified, and that rule
cuts both ways: **claiming no obligation is exactly as unsupported as claiming one** — and so is
claiming that a provider publishes nothing.

#### Scenario: The document would resolve attribution in one direction

- **WHEN** the document states that a provider requires attribution
- **OR** the document states that no provider requires attribution
- **THEN** the check SHALL fail
- **AND** the check SHALL fail on the direction rather than on the wording

#### Scenario: A provider's terms were read and are silent on attribution

- **WHEN** the document discusses attribution for a provider whose terms were read
- **THEN** it SHALL state that the terms were read, name where they were read, and record that they
  do not mention attribution
- **AND** it SHALL NOT offer that silence as a permission or as a prohibition

#### Scenario: The document states what was verified

- **WHEN** the document discusses attribution
- **THEN** it SHALL name Mail.tm's terms as not located, and name the paths that were tried
- **AND** it SHALL name Guerrilla Mail's terms as **read**, and name where they were read
- **AND** it SHALL NOT offer a resolution in place of the measurement

**The third clause of this scenario previously read "it SHALL name Guerrilla Mail's as nothing this
repository found", and that clause is what this `MODIFIED` exists to correct.** A `MODIFIED` block
replaces the whole requirement, so the scenario is carried forward here in full and amended rather
than dropped — **the alternative would have been to leave it in the promoted spec beside an amended
body that contradicts it**, which is the shape in which two requirements say opposite things and
neither is noticed. `openspec validate` refuses that substitution, and its refusal is the recorded
reason the scenario came forward at all.

### Requirement: How a person makes this device forget is stated as a control, not as a promise

The document SHALL state that **both** clients offer a two-step confirmed removal, that the first
press removes nothing, and that what is removed is **the whole storage area rather than a named
key** — including a record kind a later build adds. The document SHALL state that removal deletes
**this device's note of the address and not the address**, and it SHALL report a refused removal as
refused rather than as either success or safety.

#### Scenario: The removal is described as removing a named key

- **WHEN** the document states what a removal deletes
- **THEN** it SHALL state that the whole area is removed
- **AND** it SHALL NOT enumerate the keys as the set that is deleted

#### Scenario: The document describes removal as deleting the address

- **WHEN** the document states what a removal leaves behind
- **THEN** it SHALL state that the address itself continues to exist at the provider
- **AND** the check SHALL fail if the document claims the address is deleted

### Requirement: Message lifecycle limitations state the measurement and its absence

The document SHALL state what was measured about message retention and about how long an address
lives, and SHALL distinguish a provider's **published** figure from one **measured live**. The
document SHALL **not** claim that messages never leave the device, and the check for that claim
SHALL carry a negative control that plants the sentence into a copy of the document and requires
the same reader to report it.

The forbidden sentence is named by `docs/ROADMAP.md` §29, which says the claim is false while
third-party providers receive the mail. The negative control is not optional: **a sweep matching
nothing satisfies every assertion above it**, and this repository has earned that sentence four
separate times.

#### Scenario: The document states the retention figure as measured

- **WHEN** the document states how long a provider keeps a message
- **THEN** it SHALL distinguish the provider's published figure from what was measured
- **AND** it SHALL NOT present a published figure as this repository's measurement

#### Scenario: The document claims messages never leave the device

- **WHEN** the forbidden sentence is planted into a copy of the document
- **THEN** the same reader SHALL report it
- **AND** the reader SHALL be required to be able to fail before its absence is claimed

### Requirement: A diagnostic that persists nothing is not a record this device keeps

The document's enumeration of what this device keeps SHALL cover **every record kind the shipped
tree persists**, and a diagnostic that is never persisted SHALL NOT appear in it. The document SHALL
say **that a diagnostic exists and persists nothing**, and that statement SHALL be **checkable
against the tree** rather than asserted beside it.

**Why this is stated rather than left to the enumeration, and the reason is a gap the enumeration's
own check has never had to notice.** The *does not collect* list's last row claims *"No persisted
state anywhere outside the two areas named in sections 1 and 2"*, and grounds that claim in the
requirement that a client reaches persisted state only through the storage layer's contracts. **That
requirement does not say what the claim needs it to say** -- it names the layer, not the number of
kinds, and its own amendment added a second and a third record kind as their own contracts. **The
requirement permits exactly what the claim forbids**, and the grounding check cannot see the
difference, because it proves a pointer *resolves* and the requirement's own note says *"Grounding
is not completeness."* **This is not a completeness gap. It is a support gap**, and the check has
no shape for it.

**So the claim is made true rather than re-grounded, and the check that makes it true is of the
kind the tree can answer**: that **nothing the diagnostic holds is written to any store, in any
area**. A claim about the tree is checkable; a claim about what a requirement *ought* to say is not,
and **widening the grounding check to try would be a research project wearing a check's clothes.**

**A diagnostic is not a record kind, and the difference is the whole of it.** A record kind is
something the device keeps because the product needs it later; a diagnostic is a report of what
happened, which the product needs **now** and which the person reads **now**. **A thing that is
persisted is a record; a thing that is not is not**, and this requirement keeps that distinction
sharp in the document rather than leaving it to a reader to infer from the absence of a table row.

#### Scenario: The document names a diagnostic

- **WHEN** the document is read
- **THEN** it SHALL say that a diagnostic exists, that it reports counts and outcomes only, and that
  it is persisted nowhere
- **AND** the diagnostic SHALL NOT appear in the document's enumeration of records this device keeps

#### Scenario: A diagnostic is written to a store

- **WHEN** the shipped tree is inspected for a write of a diagnostic's value
- **THEN** the check SHALL fail and SHALL name the file and the value it found
- **AND** the check SHALL fail on the write rather than on the presence of a record kind

#### Scenario: The enumeration and the tree disagree

- **WHEN** the document enumerates the records this device keeps
- **THEN** every record kind the shipped tree persists SHALL appear in the enumeration
- **AND** every row of the enumeration SHALL correspond to something the tree persists
