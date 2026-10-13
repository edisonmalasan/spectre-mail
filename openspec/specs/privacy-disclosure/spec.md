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
state that an attribution obligation exists and SHALL **not** state that none does. Where no
terms page was located, the document SHALL say so.

Neither direction is available as a claim. **No terms page was located for Mail.tm** — verified
2026-10-02 and recorded in `docs/PROVIDERS.md` — and Guerrilla Mail publishes nothing this
repository found. `AGENTS.md`'s architecture rules already forbid citing provider terms that were
not verified, and that rule cuts both ways: **claiming no obligation is exactly as unsupported as
claiming one.**

#### Scenario: The document would resolve attribution in one direction

- **WHEN** the document states that a provider requires attribution
- **OR** the document states that no provider requires attribution
- **THEN** the check SHALL fail
- **AND** the check SHALL fail on the direction rather than on the wording

#### Scenario: The document states what was verified

- **WHEN** the document discusses attribution
- **THEN** it SHALL name Mail.tm's terms page as not located
- **AND** it SHALL name Guerrilla Mail's as nothing this repository found
- **AND** it SHALL NOT offer a resolution in place of the measurement

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
