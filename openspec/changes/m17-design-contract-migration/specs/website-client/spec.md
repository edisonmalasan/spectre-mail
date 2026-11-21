# website-client

The footer requirement is broadened to the M16 public navigation and route set.

## MODIFIED Requirements

### Requirement: The page's limits are stated in its footer

The page's footer SHALL render the product's truthful limits and provider attribution, and
SHALL carry the public navigation and language/route links the M16 reference inventory records,
using original SpectreMail copy. It SHALL NOT claim a licence, an independent mail server, or a
capability the product does not hold, and SHALL NOT name a provider the website cannot reach as
if it were available.

**Note, recorded during proposal (2026-10-06).** The limits list is **not** being removed or
shortened, and this requirement says so in terms that can be checked rather than in terms that
can be admired. Its bullets are each a measurement or a promoted requirement: the provider
is the measured CORS one from `provider-config.ts`, the code-and-link sentence was `website-
client`'s own *"This slice shows what it found and does not act on it"* — a requirement this
slice **removes**, so this note names it as it stood on 2026-10-06 — and the no-server
sentence is the architecture rule that SpectreMail never proxies a provider. Moving them to a
footer is a placement change; the claims travel with them intact.

The reason the placement changes at all is that the list reads as an apology in the middle of
a page. As a footer it reads as a specification, which is what it is.

**Amendment, recorded at this slice's proposal (2026-10-09).** Two corrections to the note
above, both because a promoted spec must not carry a claim its own text contradicts. Its
**count** read *four* bullets while `apps/web/src/sections.ts`'s `LIMITS` holds **five** and
the note then enumerated **three** of them — the storage sentence is deliberately absent, and
`LIMITS`' own documentation says why — so the count is replaced by no count at all, and the
code-and-link cross-reference is stated in the past tense because the requirement it names is
removed by this same change. **A cross-reference that reads as live and points at a
requirement this change deleted is the same defect as a sentence in the footer that stopped
being true**, and this repository has now found that defect in three separate documents
about one bullet. The count was wrong before this change and was carried forward silently
through four syncs, which is the whole argument for checking arithmetic at promotion rather
than only when a number is being published.

The paragraph the delta dropped from this requirement is **restored** rather than lost. It
is not superseded — the placement rationale stands unchanged by two actions being permitted —
and the rule that a `MODIFIED` block must preserve what the delta does not mention applies to
prose as much as to scenarios, because `openspec validate` enforces only the scenarios and
would not have reported the loss. **A validator that cannot see the defect is not a reason to
ship it.**

**Amendment, recorded at this slice's proposal (2026-10-09).** The code-and-link sentence
changes and the rest of this requirement does not. The third bullet used to read that the
page *"does not copy codes or follow links for you"*, which named
`This slice shows what it found and does not act on it` as its basis. **That bullet became
false the moment this slice's copy control and link shipped**, and a false sentence printed
in a footer is the worst kind of stale claim this repository has: it is the one place a
visitor reads what the product will not do.

The bullet is therefore **reworded rather than dropped**, and the count stays five. The
requirement's own clause - *"no limit SHALL be dropped to make room for a section"* - does
not cover this case, and pretending it does would be reading the rule to suit the change: the
bullet was not dropped for space, it was dropped because it had become untrue. What the
clause does forbid, and what this amendment keeps forbidding, is a limit being **removed**
while its subject is still true.

The replacement sentence names the same two actions the requirement now permits and the same
condition the requirement now imposes - the user's asking - so the footer states a limit
rather than a capability. **A page that says what it will not do on its own is more
trustworthy than one that lists what it can do**, and this product's direction is restraint,
so the footer keeps stating the boundary rather than switching to advertising the new
controls.

#### Scenario: The limits are read

- **WHEN** a visitor reads the page's footer
- **THEN** it SHALL state which provider the page reaches and that no other
- **AND** it SHALL state that the page copies a code and follows a link only when asked
- **AND** it SHALL state that no server is involved and no provider request is relayed

#### Scenario: A section needs the space

- **WHEN** a section is added to the page
- **THEN** no limit SHALL be dropped from the footer
- **AND** no limit SHALL be reworded into something the product cannot support

#### Scenario: The storage claim is placed

- **WHEN** the footer states what this device keeps
- **THEN** it SHALL point to the region that offers the removal control
- **AND** it SHALL NOT restate a guarantee about storage that the region itself owns
