# Proposal

## Why

M12 requires that every extension permission answer *"What user-facing feature requires this?"*
and that anything unnecessary be removed. Three of the four declared permissions can answer that
from shipped code today. **The fourth cannot, and the reason it cannot is that the measurement
behind it is half-finished**: `docs/PROVIDERS.md` §4.6 compared a fixture declaring neither the
`sidePanel` permission nor a `side_panel` key against one declaring **both**, concluded that the two
"cannot be separated on this substrate", and that sentence has been carried forward ever since as
though it described a limit of the platform. **It describes two cells of a two-by-two that were
never run.**

## What Changes

- **Complete the two-by-two.** `apps/extension/e2e/side-panel-runtime.mjs` stages
  `VARIANTS = ["control", "base", "tabs"]` — none, both, both-plus-`tabs`. The two missing cells
  are *permission without the key* and *key without the permission*. Both are constructible with
  the staging machinery the probe already has (`permissions` replaced wholesale; a `null` value
  deletes a key). **This change runs them and records the answer.**
- **Correct a claim that is currently stronger than its evidence.** `extension-client`'s
  non-goals requirement states `sidePanel`'s necessity *"was measured rather than assumed"*. Two
  of four cells were measured. **That sentence is true of the other three permissions and overstated
  for this one**, and this change amends it to say what was measured.
- **Close the specification gap the case exposes.** The requirement's manifest clause reads *"it
  SHALL request no permission that no shipped surface uses"*. `sidePanel` is reached by **no
  shipped call** — the sole occurrence of the token under `apps/extension/src` is the word
  *"sidepanel"* inside a doc comment in `panel-main.tsx`. It is earned, if at all, by a **manifest
  key**. **The clause does not say whether that counts**, and an `ADDED` scenario makes it say.
- **Remove the permission if the measurement says it is removable**, which is M12's directive
  rather than this change's preference. The branch is declared in `design.md` before the
  measurement runs, so the change's size is bounded either way.
- **Leave an instrument, not a note.** The per-permission answer is asserted where a permission can
  be added silently — `manifest.spec.ts` hard-codes the list in one direction only, and nothing
  checks the other.

## Capabilities

### New Capabilities

None. **A review's output is a corrected requirement and a falsifiable check, not a new surface**,
and `extension-client` already owns every claim about what the manifest declares.

### Modified Capabilities

- `extension-client`: the *"The extension declares its non-goals as requirements rather than
  leaving them absent"* requirement. Two parts move, and **which part moves is decided by the
  measurement rather than by this proposal**: the amendment chain gains a correction to the
  `sidePanel` necessity claim either way, and the requirement's scenarios gain one making explicit
  that a permission earned by a manifest key rather than by a call is a case the clause covers.

## Impact

**Read-only until the probe runs.** This change's product surface is the manifest, and it changes
only if the measurement says `sidePanel` is unnecessary.

- `apps/extension/e2e/side-panel-runtime.mjs` — two variants added to `VARIANTS`; quarantined,
  outside both test tiers.
- `docs/PROVIDERS.md` §4.6 — the "cannot be separated" limit is resolved into a four-cell table, or
  replaced by a narrower limit.
- `apps/extension/static/manifest.json` — **conditional**, on the measurement's outcome.
- `apps/extension/e2e/manifest.spec.ts` — the hard-coded permission list, **conditional** on the
  same outcome.
- `openspec/specs/extension-client/spec.md` — one `MODIFIED` block, unconditional.

**Not in scope.** The privacy document (M12 item three), the security review (item one), and the
provider-terms re-check (item four). M12 item two is this change; the others are separate.
