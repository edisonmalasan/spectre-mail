# Security

This document is M12's security review. For each of the nine areas the roadmap
asks the product to review, it names **the requirement that governs that area**,
**the file that requirement is in**, **the instrument that enforces it**, and **a
verdict**.

It is **not** a threat model and not a penetration test. Nothing here says what
an attacker would try. It says which stated obligations this product holds, and
which instrument would notice if it stopped holding one.

It is also **not** a legal document, and it is **not** a provider terms review —
that is M12's separate provider review, which has not been started. See [What
this audit does not establish](#7-what-this-audit-does-not-establish).

## The nine areas

The nine areas below are **the roadmap's**, in the roadmap's order and the
roadmap's spelling, counted from `docs/ROADMAP.md`'s fenced block rather than
recalled. **That file said "eight" until 2026-10-14**, and the count was wrong.

A check in `tests/architecture/security-audit.test.ts` resolves every citation
in the table below against the specifications as they stand, and reports one
that resolves to nothing by name. **The audit's own claims are therefore checked
rather than asserted beside the tree** — which is the point, because an audit
that cannot go stale is not a document, it is a claim.

| area                     | verdict                          | requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | instrument                                                                                                               |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| provider credentials     | **open — closed by this change** | `shared-domain-model` — _Credentials are specific to one provider_ (`openspec/specs/shared-domain-model/spec.md:41`); `provider-adapters` — _Credentials are captured in the provider's own session model_ (`openspec/specs/provider-adapters/spec.md:233`); `provider-abstraction` — _A provider credential reaches the transport and this device's storage, and nothing else_ (`openspec/changes/security-surface-review/specs/provider-abstraction/spec.md:5`)                                                                                       | `apps/extension/src/protocol.test.ts`, a test-owned map of every message kind to whether it may carry a credential field |
| extension permissions    | **closed by its own change**     | `extension-client` — _The extension declares its non-goals as requirements rather than leaving them absent_ (`openspec/specs/extension-client/spec.md:130`)                                                                                                                                                                                                                                                                                                                                                                                             | `apps/extension/e2e/manifest.spec.ts`, a test-owned permission map asserted in both directions                           |
| storage boundaries       | closed                           | `spectre-storage` — _The platform storage API is named only inside this layer_ (`openspec/specs/spectre-storage/spec.md:247`)                                                                                                                                                                                                                                                                                                                                                                                                                           | `tests/architecture/boundaries.test.ts`, four rules                                                                      |
| message rendering        | **open — closed by this change** | `website-client` — _The website renders no provider data as markup and no provider field_ (`openspec/specs/website-client/spec.md:225`); `shared-domain-model` — _Message bodies are carried as untrusted text_ (`openspec/specs/shared-domain-model/spec.md:143`); `provider-adapters` — _Message bodies are carried as untrusted text_ (`openspec/specs/provider-adapters/spec.md:209`); `extension-client` — _The extension renders provider-supplied content as text_ (`openspec/changes/security-surface-review/specs/extension-client/spec.md:5`) | `tests/architecture/boundaries.test.ts`, _"keeps a markup escape hatch out of every client"_                             |
| URL handling             | closed                           | `mail-parsing` — _Link destinations are recovered together with their anchor text_ (`openspec/specs/mail-parsing/spec.md:66`)                                                                                                                                                                                                                                                                                                                                                                                                                           | `packages/mail-parser/src/detect-links.ts`; `packages/mail-parser/src/detect-links.test.ts`                              |
| content-script injection | closed                           | `in-page-integration` — _The affordance is separate from the page it is injected into_ (`openspec/specs/in-page-integration/spec.md:243`); `in-page-integration` — _The content script reports the host it is beside, and nothing more of the page_ (`openspec/specs/in-page-integration/spec.md:873`)                                                                                                                                                                                                                                                  | `apps/extension/e2e/in-page.spec.ts`; `apps/extension/src/content-script.test.ts`                                        |
| site mapping             | closed                           | `spectre-storage` — _A site association is a record kind of its own, keyed by an exact host_ (`openspec/specs/spectre-storage/spec.md:629`); `privacy-disclosure` — _The hostname association is stated plainly and SHALL NOT be described as nothing_ (`openspec/specs/privacy-disclosure/spec.md:148`)                                                                                                                                                                                                                                                | `packages/storage/src/site-associations.test.ts`; `tests/architecture/privacy-disclosure.test.ts`                        |
| notification content     | closed                           | `extension-client` — _A message that arrives raises a notification naming its sender and its subject_ (`openspec/specs/extension-client/spec.md:541`)                                                                                                                                                                                                                                                                                                                                                                                                   | `apps/extension/src/notification.test.ts`; `apps/extension/e2e/background-check.spec.ts`                                 |
| clear-data behavior      | **closed by its own change**     | `spectre-storage` — _What this device holds can be removed on request_ (`openspec/specs/spectre-storage/spec.md:288`); `website-client` — _The user can make this device forget the address_ (`openspec/specs/website-client/spec.md:765`); `extension-client` — _The side panel offers to remove what this device holds, and says what that removed_ (`openspec/specs/extension-client/spec.md:1157`)                                                                                                                                                  | `apps/extension/src/panel-copy.test.ts`; `apps/extension/e2e/side-panel.spec.ts`                                         |

## 1. The two open areas

### 1.1 provider credentials — nothing governed where a credential may go

This is the finding that made the review worth running.

`chrome.storage.local` holds a provider credential alongside each mailbox record,
and `docs/PRIVACY.md` names it. **No requirement anywhere in this repository said
where a credential may travel.** The boundary that keeps it correct was a code
comment explaining why a creation answer carries an address and an id rather than
the whole mailbox — **a true comment, and a comment is not a requirement**: it
does not fail a gate, it does not survive an editing of the type it explains, and
nothing here would notice its erosion.

**What already existed was adjacent and not the same question.**
`shared-domain-model` requires credentials to be specific to one provider, and
`provider-adapters` requires them to be captured in the provider's own session
model and that the provider layer persist nothing. **None of those says where a
credential may _go_.**

**This change adds the requirement that does**: `provider-abstraction` now states
that a credential reaches the provider transport that issued it and the mailbox
record on this device, and no message, notification, rendered string or built URL
carries one. **The boundary already held, and holding it is now a property of the
product rather than of a reader having understood the code** — which is why this
change ships **no production edit** and only the instrument.

**A credential that must cross to its provider is not a leak.** The request that
presents it is the permitted destination.

**What a credential is, is not said here.** `docs/PRIVACY.md:27` names what the
`current` record holds and §1 of that document states the rest of what this device
keeps. **This document links to that line rather than restating it**, because
three surfaces already keep their own wording about what is stored and a fourth
copy is a fourth thing to drift. **What this document adds is the question the
privacy document cannot answer: not _what_ is stored, but _where a stored value
may travel_.** Those are different questions, and a document that answered the
second with the first would be answering the wrong one.

### 1.2 message rendering — enforced for every client, stated for one

**Nothing is unsafe today, and the sentence that says so has to be the true
one.**

A boundary rule in `tests/architecture/boundaries.test.ts` keeps a markup escape
hatch out of **every** client, and it fires on this extension's files — so the
property is already enforced. **A rule that fires without a requirement behind it
is a rule whose removal nobody would notice**, because the document that
justified it named the other client and not this one.

So the property is now stated for the extension too, as a third and fourth place
it is written down: `website-client` for the website, and
`shared-domain-model` and `provider-adapters` both carrying _"Message bodies are
carried as untrusted text"_ for the model and the adapters. **It is written down
per client because that is where the defect would be** — a requirement filed
under another client's capability would attribute it to the wrong assertion.

**The extension renders provider content in two shipped surfaces**, the popup and
the side panel, and neither is a standalone document: they share one message
surface. That is recorded rather than left for a reader to discover, because a
shared component serving two surfaces is the shape where one surface's
requirement can be satisfied by the other's implementation.

## 2. The two areas closed by their own archived changes

**These do not reopen here, and the review says which change closed each rather
than leaving a reader to assume all nine were re-litigated.**

- **extension permissions** was closed by **`extension-permissions-review`**
  (archived at `openspec/changes/archive/2026-10-14-extension-permissions-review/`).
  Its instrument is a test-owned permission map in
  `apps/extension/e2e/manifest.spec.ts`, asserted **both** ways — the direction
  that matters being _a permission declared with nothing behind it_.
- **clear-data behavior** was closed by **`extension-clear-data`** (archived at
  `openspec/changes/archive/2026-10-13-extension-clear-data/`). Its instrument
  reaches the whole-area removal through the `SpectreStorage` contract and names
  none of the keys the platform area holds.

**Reopening either is not what this item asks for.** A security review that
re-litigated a closed area would produce a document whose rows nobody could
distinguish from findings.

## 3. How to read a row

A row's **requirement** column is a set of citations, each of them
`capability` — _the heading as it stands_ — (`file:line`). The heading is the
thing that resolves; **the line number is there because a heading alone is not a
citation a reader can open**, and it is measured at write time rather than
recalled.

A row's **instrument** column names where the property is actually held. **An
instrument is what would notice if the property stopped holding**, and a row with
no instrument is a row with no evidence behind it.

**Every backticked token in that column is a repository-relative path that has to
exist**, and a row with no token in it has no instrument behind it. That is a
deliberate narrowness rather than an accident of formatting: naming a _constant_
in this column would read as a locator and could not be opened, so the column
names files and nothing else.

A row's **verdict** is one of three things, and the distinction is the review's
output rather than its input:

- **closed** — a requirement governed the area before this review, and an
  instrument holds it.
- **closed by its own change** — an archived change closed it, and this review
  does not reopen it.
- **open — closed by this change** — the review found the area had **no
  requirement governing the question the roadmap asked**, states that in its own
  words, and adds one.

## 4. What this audit does not claim about its own instrument

**The instrument resolves citations. It does not check that a requirement still
says what it said.** A row whose requirement was _weakened_ rather than renamed
resolves perfectly. **Citation rot is the failure mode this instrument bounds and
not the only one**, and a reader who takes a green run as "the audit is still
true" is reading more than the run established.

**An area with no requirement governing it does not fail the check.** That row is
the audit's finding, so a check that failed on one would be useless precisely when
the audit had something to report.

**A cited line number is checked for being near its heading, not for being
correct.** The window is declared in the test and is a bound, not a proof.

## 5. Areas this audit does not cover

Named so a reader does not have to infer them from absence:

- **A threat model.** No row says what an attacker would try.
- **A provider terms review.** M12's separate item, unstarted.
- **Any live provider.** Every provider response in this repository is a
  recorded one, and nothing here changes that.
- **A host-page attack.** The platform's own isolation between a content script
  and a page is recorded as measured in `docs/PROVIDERS.md` §4.4; this review
  neither repeats nor extends it.
- **Anything about the law.** No jurisdiction has been considered.

## 6. Areas closed before this review began

The remaining five closed rows were not closed by this review either — each was
closed by a change written to close something else:

- **storage boundaries** by `site-associations`, which needed the rule as much as
  the security review does.
- **URL handling** by `mail-parser`, which restricted the schemes because a
  parser that surfaced a `javascript:` destination was a parser defect.
- **content-script injection** by `in-page-address` and `in-page-host-context`.
- **site mapping** by `site-associations` and `privacy-document`.
- **notification content** by `incoming-mail-notification`.

**That is the review's second finding, and it is the reason the verdicts differ
from what the roadmap expected**: most of M12's security work was already done,
by changes written for other gaps that happened to close these too.

## 7. What this audit does not establish

Restated from the top because it is the claim most likely to be read as broader
than it is:

- **No attacker model, no penetration test.**
- **No claim about provider terms**, in either direction. `privacy-document` D7
  already established that a terms review does not block this item.
- **No legal sufficiency.** A document that enumerates obligations is not a
  compliance artefact and this one does not make itself into one.
- **Nothing about a live provider.** Every provider response behind these
  requirements is a recorded one.
- **Nothing about how any surface looks.** No test in this repository reads a
  rendered pixel, and a security audit that claimed otherwise would be claiming
  something no instrument here could establish.
