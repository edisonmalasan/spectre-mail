# Proposal

## Why

M12's **security review** is the largest thing in the milestone that has never been
started, and the roadmap has carried it as an unopened item since the milestone was
written. It names nine areas to review. Audited against the shipped tree on
2026-10-14, **seven of the nine are already required and instrumented**, one is
enforced for every client but stated for only one, and **one — provider credentials —
has neither a requirement nor an instrument anywhere in this repository.**

That last one is the finding, and it is worth stating in its own terms.
`chrome.storage.local` holds a provider **session token** under `current` and again
under `mailboxes`; `docs/PRIVACY.md:27` says so in one line and moves on. **No
requirement anywhere says where a credential may go.** The boundary that keeps it
correct today is a code comment: `apps/extension/src/protocol.ts:160` explains that
`CreateMailboxAnswer` carries an address and an id because the worker's own storage
context already has the whole mailbox. That is a true and well-reasoned comment, and
**a comment is not a requirement** — it does not fail a gate, it does not survive an
editing of the type it explains, and nothing in this repository would notice its
erosion.

The comparison that makes this a finding rather than a nitpick: `privacy-document`,
one milestone item earlier, made **`site-mailboxes`** — a hostname to mailbox-id map —
the headline of the privacy review, on the grounds that it is the only
browsing-adjacent record this product keeps and no document had named it.
**A provider session token is a strictly more sensitive record, it is kept on the same
device, and no review has looked at it.**

## What Changes

- **A shipped audit: `docs/SECURITY.md`.** Each of the roadmap's nine areas, named as
  the roadmap names it, with the requirement that governs it and the instrument that
  enforces it, each cited by file and heading, and each carrying a verdict. **The
  audit's value is that it can go stale, so it is not left as prose** — see the third
  capability below.
- **A requirement that a credential reaches the provider transport and this device's
  storage, and no other surface** (`provider-abstraction`). Enforced against the
  shipped tree by a **test-owned map of every protocol message kind to whether it may
  carry a credential field, asserted in both directions**, with a positive control —
  the instrument shape `extension-permissions-review` and `privacy-document` each
  arrived at independently.
- **A requirement that the extension renders provider content as text only**
  (`extension-client`). The property is already enforced for **every** client by the
  boundary rule *"keeps a markup escape hatch out of every client"*, and the website's
  own requirement names only the website; the extension renders the same
  provider-supplied sender and subject in two surfaces with no requirement stating
  the property. **This is recorded as the second of the nine areas' verdicts rather
  than presented as a defect** — nothing is unsafe today, and the sentence that says
  so has to be the true one.
- **A requirement that the audit's claims are checked rather than asserted**
  (`build-and-verification`). Every requirement `docs/SECURITY.md` cites SHALL resolve
  to a heading that still exists, and the document's per-area rows SHALL each resolve.
  **This is the instrument for the audit itself**, and it exists because of a defect
  this repository has already paid for twice: a ledger figure went stale for a whole
  milestone because no change had to touch it to record itself.

**No production code changes.** The prediction is that the credential boundary already
holds and this change ships **zero edits under `apps/*/src` and `packages/*/src`**,
which is falsifiable — if a credential had been crossing a surface, the change would
have to repair it and the prediction would be wrong.

## Capabilities

### New Capabilities

None. Every property this change states belongs to a capability that already exists,
and **a new capability would be a place to put one requirement**, which is not what
this repository has ever done.

### Modified Capabilities

- `provider-abstraction`: **ADDED** — a provider credential reaches the provider
  transport and this device's storage, and no other surface.
- `extension-client`: **ADDED** — the extension renders provider-supplied content as
  text and inserts no provider value as markup.
- `build-and-verification`: **ADDED** — a shipped security audit's claims are checked
  against the tree, not asserted beside it.

## Impact

- **New**: `docs/SECURITY.md`.
- **Modified (tests only)**: `apps/extension/src/protocol.test.ts` gains the
  credential map; `tests/architecture/security-audit.test.ts` is new and resolves the
  audit's citations.
- **Unchanged**: every file under `apps/*/src` and `packages/*/src` outside the two
  test files above; `packages/storage`; `docs/PRIVACY.md`; `apps/extension/static/manifest.json`.
- **Not touched**: the permissions review and the clear-data behaviour are two of the
  nine areas and are **closed by their own archived changes**. They do not reopen here,
  and `docs/SECURITY.md` says why rather than leaving the reader to assume the nine
  were all re-litigated.