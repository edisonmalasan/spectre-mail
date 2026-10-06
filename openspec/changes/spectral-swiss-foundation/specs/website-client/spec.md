# Spec Delta

## Purpose

Amends the one requirement in this capability that this milestone falsifies, and nothing
else. Nineteen other requirements in `website-client` are untouched by a stylesheet.

## RENAMED Requirements

- FROM: `### Requirement: This milestone builds structure, not visual design`
- TO: `### Requirement: The page is built with correct structure, accessible names, and states`

**Recorded, because the tool forced it and the forcing is the point.** This rename was
**not written as a stylistic choice.** The first draft carried the new text under a new
header in `MODIFIED` and no `RENAMED` pair, and `openspec validate --strict` reported the
delta as *valid* while printing, as information:

```text
Archive would refuse this delta: website-client MODIFIED failed for header
"### Requirement: The page is built with correct structure, accessible names, and
states" - not found
```

Read as a warning and ignored, this would have passed review. What it actually reports is
that `MODIFIED` is matched against the **existing** spec by exact header text, so a renamed
header matches nothing; and OpenSpec's own apply guard states the rule directly — *"when a
rename exists, MODIFIED must reference the NEW header"*. Without the pair below, apply
would have left **both** the old requirement and the new one in the promoted spec, and the
old one's heading is a claim this milestone falsifies.

The generalisable lesson, which is not specific to this change: **a delta that renames
must state the rename**, and the failure mode is a silent duplicate rather than an error.

## MODIFIED Requirements

### Requirement: The page is built with correct structure, accessible names, and states

The website SHALL present a working page with correct structure, accessible names, and
states, and SHALL apply the approved visual system through the shared token layer rather
than through values restated at each use.

**Amendment, recorded during proposal (2026-10-06).** This requirement previously read
*"This milestone builds structure, not visual design"* and required that the milestone
*"SHALL NOT have introduced a design token or theme system."* **That clause became false the
day this change landed**, which is the reason the requirement is modified here rather than
left to be discovered at sync. A requirement that outlives its own falsification is worse
than one that dies with it, because it reads as a live constraint on work that has already
been approved.

**What the amendment does not do.** It does not weaken the requirement the clause
protected. Correct structure, accessible names, and reachable labelled states are the same
obligations, and the scenario requiring every state to be rendered as distinct labelled
content **carries forward unchanged** — including its clause that no state be conveyed by
colour alone, which `visual-system` now also requires and which this milestone makes hard
to keep, because the accent is about to appear on active status.

The original notes are retained, because they record why the structure was built this way
and that reasoning is not superseded by adding a stylesheet to it.

**Original note, recorded during proposal.** The reason this requirement exists is that
markup written before the design milestone is markup the design milestone rewrites, and
that has not become less true by the milestone gaining states.

**Amendment, recorded during proposal (2026-10-05).** The state-coverage scenario below
now names the states recovery adds. It listed three, and a page that could reach five more
while its coverage requirement named three would be a page whose states nothing had
claimed to check.

**Second amendment, recorded during apply (2026-10-05).** That list was itself incomplete,
and the implementation is what showed it: it named six of the seven states and omitted
`creating`, which is the state a first-time visitor actually sees for the whole of the
provider request. A coverage requirement that omits the most-observed state on the page is
worse than the three-state version it replaced, because it reads as exhaustive and would
have let `creating` ship unrendered. The enumeration is now all seven, in the order a page
passes through them.

#### Scenario: The page is built

- **WHEN** the website's production build runs
- **THEN** it SHALL build and serve
- **AND** every design value it renders SHALL come from the shared token layer
- **AND** no design value SHALL be restated at a point of use

#### Scenario: Each state is reachable

- **WHEN** the page is looking for a stored address, is creating a mailbox, is
      checking a stored one, has a ready mailbox, could not create one, could not
      check the stored one, or has found the stored one is gone
- **THEN** each SHALL be rendered as distinct, labelled content
- **AND** none SHALL be conveyed by colour alone
