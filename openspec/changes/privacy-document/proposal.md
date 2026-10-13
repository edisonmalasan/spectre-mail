# Privacy document

## Why

M12 asks for a published privacy document covering six things, and one of them is already
**required by a promoted requirement that has nothing to point at**.

`page-composition`'s *"A section states only what the product does"* records that the roadmap's
fifth section is a *Privacy/providers/open-source footer*, audits the open-source half away
(this repository has no `LICENSE` and `gh repo view` reports `licenseInfo: null`), and then says
what the rest must be:

> The footer ships the privacy and provider facts, which are true, and says nothing about
> licensing.

So the page must already ship privacy and provider facts. **They are true, and they are two
sentences** — `LIMITS` names *one* provider and asserts *no server is involved* — while the
product keeps **four** `chrome.storage.local` keys on the extension side and one IndexedDB
store on the website side. **There is no canonical document those facts are derived from, so
nothing can be wrong about it and nothing keeps it from becoming wrong.**

This is the same shape `extension-clear-data` was taken for: **the gap is recorded inside a
promoted requirement rather than merely suspected.**

## The finding that makes this more than a document

Measured on the shipped tree, not read from prose:

| what is stored | where | named by any document? |
|---|---|---|
| `current` — one mailbox record | `chrome.storage.local` | no |
| `mailboxes` — newest-first collection | `chrome.storage.local` | no |
| **`site-mailboxes` — `hostname` → mailbox id** | `chrome.storage.local` | **no** |
| `seen-messages` — ids already announced | `chrome.storage.local` | no |
| `mailbox` store, key `current` | IndexedDB (website) | no |

**The third row is the change.** `site-mailboxes` is a **set of hostnames at which a SpectreMail
address was inserted** — written at `content-script/controller.ts:348`, and *only* after an
insertion lands, never because a control was offered. It is the only browsing-adjacent record
the product keeps, it persists until the whole storage area is removed, and **no document in this
repository names it.** `README.md`'s privacy section says *No backend / No account /
Client-side storage* and stops; `docs/ROADMAP.md` §29 says the state is `local-first`; and
neither mentions that the extension remembers which sites an address was used on.

**A privacy document that omits the one record that looks like browsing history is worse than no
privacy document**, because its presence implies the omission was considered.

## What ships

1. **`docs/PRIVACY.md`** — the published document, covering all six of M12's items.
2. **A new capability `privacy-disclosure`** — the first in this repository to constrain what the
   product *claims about itself* rather than what it does. One requirement per M12 item, each
   written so the shipped tree can falsify it.
3. **An instrument**, in `tests/architecture/privacy-disclosure.test.ts` — the document read
   against the tree, **asserted in both directions**, which is the direction that does not exist
   yet and is the one that matters.

## Design decisions, with the reasoning attached

**The instrument is a new file, not more cases in `boundaries.test.ts`.** Two reasons, and the
second is the one that matters. A document-vs-tree check is a *different kind* of rule from a
code-structure rule, and — more concretely — `boundaries.test.ts` is at **53** and the
permissions review established this session that **a rule added where an instrument already
exists is not coverage**; adding to a file whose count other documents quote would move that
count for a change that added no boundary at all.

**A test-owned map, not a scan.** Carried straight from the permissions review's D6, because the
same reasoning applies to a document. A scan over `docs/PRIVACY.md` would match anything
containing a plausible origin; the check needs a **map from each enumerable claim to the shipped
evidence**, and it needs to fail **both ways** — a key the document omits *and* a key the
document names that does not exist.

**The footer gains no link, and neither does the popup or the panel.** A link in either client is
a new interactive control, and a new control in this repository draws a **new focus rule** — a
`styles.css` edit, which would break the "no new CSS rule" prediction below. The requirement is
instead that the surfaces **which already state these facts agree with the document**, checked by
the instrument. That is the honest relationship: one document, several restatements, and a check
that the restatements have not drifted.

**Attribution is stated in neither direction.** M12 lists *provider attribution* as a required
item, and **no terms page was located for Mail.tm** (verified 2026-10-02) while Guerrilla
publishes nothing this repository found. So the document states *what was verified* and names the
absence. **Claiming no obligation is exactly as unsupported as claiming one**, and the
architecture rules already forbid citing provider terms that were not verified.

**Roadmap §29's forbidden claim is enforced with a negative control.** §29 says explicitly *do
not claim: "Messages never leave your device." That is false while third-party providers receive
the mail. A sweep matching nothing satisfies every assertion above it, so the check plants the
forbidden sentence into a copy of the document and requires the same reader to report it.

## Predictions this change turns on

Every one of these is a claim that must hold, and each is the measurement rather than a
promise. **A rise in any of them is a finding about this change, not about the count.**

| what | predicted | why it is the measurement |
|---|---|---|
| `packages/ui` | **38** | no token, no class hook, no CSS rule |
| `apps/web/src/styles.css` | **byte-identical** | the footer gains no link, so no new control to focus |
| `apps/extension/static/manifest.json` | **byte-identical** | nothing about the manifest changes |
| `packages/storage` | **86**, `git diff --stat` empty | the document names the keys; it does not change them |
| `apps/web` | **125** | no new client assertion — the agreement is checked from `tests/architecture` |
| `apps/extension` | **465** | no extension source change at all |
| `boundaries.test.ts` | **53** | the check is a new file, so no boundary rule is added |
| `README.md` | one added link | the only shipped change outside `docs/` |

**`apps/web` staying at 125 is the load-bearing one.** It is what distinguishes "the document and
the page agree" from "the page was rewritten to match the document", and a rise would mean the
agreement was bought with a new client assertion rather than checked where the facts are.

## What this deliberately does not do

- **It does not change what is stored.** Nothing is added to or removed from either store, and
  no key is renamed. This change makes the existing records visible.
- **It does not resolve M12's other three items** — the security review, the provider review, or
  the branding check. The provider review is *adjacent* and this change does not wait for it:
  see `design.md` D7.
- **It does not claim the document is legally sufficient.** No jurisdiction has been considered
  and no compliance regime named; the document states facts about this product and stops.
- **It does not add a hosting page, a domain, or a public URL.** The document is published in
  the repository, because a hosted privacy page is a distribution decision M13 owns.
- **It does not touch the extension's surfaces' copy.** `LocalData.tsx` and `Panel.tsx` keep
  their own wording; the requirement is agreement, not a shared string.