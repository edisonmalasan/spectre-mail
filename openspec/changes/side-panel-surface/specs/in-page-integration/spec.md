# Spec Delta

Amends one requirement and adds one, for the content script's second job.

**The amendment is a spelling that stopped guarding anything.** The permission requirement's
manifest scenario read *"WHEN the extension's manifest is read **after this change**"*, which
was honest while written by a change that was about to add no permission and reads as a claim
about a change that has been archived for four milestones. Generalised to the standing form it
was reaching for — *every permission the manifest requests SHALL be one a shipped surface
uses* — it becomes the clause that makes `sidePanel` honest, in the same direction
`incoming-mail-notification` recorded for `extension-client`'s identical clause: a permission
declared for a surface this extension does not ship is exactly what the form forbids.

**The added requirement is where the free route lives**, and it carries one clause this
milestone's design would otherwise have left implicit. §4.6 measured that the panel's
round trip returns whatever the content script puts in the answer, and a content script has
`location` in scope. **The question "how much of the page does this extension now know" is not
answered by the request being local — it is answered by what the answer is required to
contain.** So the requirement names the smallest value that satisfies the roadmap and forbids
the rest: a hostname, never a URL. A signup page's query string is where its tokens are, and
a panel that reported `location.href` would be holding one for every page it was docked beside.

## MODIFIED Requirements

### Requirement: A code reaches the page without a permission this extension does not already hold

Putting a code into a page SHALL NOT require this extension to hold a permission it does not already
hold, and SHALL NOT require anything from the page. The extension's manifest SHALL NOT gain a
permission in order to deliver a code, and the page SHALL NOT be asked for access, consent, or a
response of any kind.

This is a behavioural requirement rather than an implementation note because the failure it rules
out is invisible in a diff. A delivery that worked by asking the page for something would be a
delivery that works on some pages and fails on others for reasons the person cannot act on — which
is the same failure this capability already records for creation, and for the same underlying cause:
a request made in the page's own context obeys the **page's** policy rather than this extension's.

The extension's declared host reach SHALL remain the reach its shipped surfaces use. Reaching a page
this extension holds no host permission for is not a reach declaration, and a permission added to
make it one would be a permission this extension cannot name a user-facing feature for.

**The manifest scenario's clauses are generalised here, and the generalisation is not cosmetic:
it is what makes `sidePanel` honest.** That permission is added by a different milestone for a
different surface, and a requirement whose manifest clause is scoped to *"no permission this
extension did not already request"*, full stop, is a clause that goes red the next time any
surface needs one. The second clause — **every permission it requests SHALL be one a shipped
surface uses** — is the form that survives being applied twice, and it is the same clause
`extension-client`'s non-goals requirement carries for the same reason.

**The scenario's *heading* still reads "after this change", and it is kept rather than
reworded.** A `MODIFIED` block replaces the whole requirement, OpenSpec refuses a promotion that
drops a scenario the current spec still has, and **a requirement whose scenario names a change
that was archived four milestones ago is a small permanent cost for a rule that cannot be
silently narrowed.** Rewording the heading would be the cheaper reading only until the next
change modified this requirement and found the validator would not let it.

#### Scenario: The manifest is read after this change

- **WHEN** the extension's manifest is read
- **THEN** it SHALL request no permission this extension did not already request **in order to
  deliver a code**
- **AND** every permission it does request SHALL be one a shipped surface uses

#### Scenario: The page refuses cross-origin requests

- **WHEN** a page is served under a policy that refuses cross-origin requests
- **THEN** activating a code's control SHALL still put that code into the page's field

#### Scenario: The page is asked for nothing

- **WHEN** this extension puts a code into a page
- **THEN** it SHALL ask that page for nothing
- **AND** a page that would refuse any such request SHALL NOT prevent the fill

## ADDED Requirements

### Requirement: The content script reports the host it is beside, and nothing more of the page

The content script SHALL answer a host request from this extension with its own `location.hostname`
and with no other part of the page's location — not its href, not its pathname, not its query
string, not its origin — and it SHALL answer from what the browser has already given it rather than
by reading the page's DOM. A request it cannot answer SHALL be refused rather than answered with a
value it did not read.

**This is the free half of `docs/PROVIDERS.md` §4.6, and the free half is a restriction rather
than an absence.** `tab.url` is withheld to a panel holding no `tabs` permission, and the reason
the round trip costs nothing is that the answer already exists in this extension's own injected
code. **That makes what the answer contains a decision rather than a default**, and the smallest
value that satisfies the roadmap is a hostname: `site-associations` keys its map by the exact
hostname, and no requirement anywhere in this specification needs a path. A query string on a
signup page is where that page's tokens are, so an answer carrying one would hold a signup token
for every page this extension has ever been beside.

**The page is not asked.** The request is delivered to this extension's own script by
`chrome.tabs.sendMessage`, which §4.4 measured as the seam a content script can be reached
through without the page's policy applying to it, and nothing in it is observed, dispatched or
requested by the page.

**What cannot be detected is stated here rather than left to be discovered.** §4.6 measured that a
content script which **answers nothing** resolves, and a resolution is indistinguishable from a
script that is not there. So a wedged script cannot be told apart from an absent one by this
seam, and no requirement in this delta claims otherwise; what the caller owes is to report that
it could not confirm the host, which `extension-client` states at the other end.

#### Scenario: This extension asks the script for its host

- **WHEN** this extension's own context asks the content script for the host it is beside
- **THEN** the script SHALL answer with its own `location.hostname`
- **AND** it SHALL answer with no other part of the page's location
- **AND** it SHALL read nothing from the page to do so

#### Scenario: The script cannot answer

- **WHEN** this extension's own context asks the content script for its host and no answer arrives
- **THEN** the script SHALL NOT answer with a host it did not read
- **AND** the requester SHALL be told it could not confirm the host

#### Scenario: The page is asked for nothing

- **WHEN** this extension asks a content script for its host
- **THEN** it SHALL dispatch no event into the page
- **AND** it SHALL read no property of the page's DOM to answer
- **AND** a page that observes nothing SHALL still be answered

#### Scenario: The manifest is read for a host request

- **WHEN** the extension's manifest is read
- **THEN** it SHALL request no permission in order to name the host a content script is beside