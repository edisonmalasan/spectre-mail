# Branding check

## Why

M12's exit criteria carry one line that no change has ever satisfied: **public branding has
been validated.** The roadmap names six checks for it, none of which has been run, and the
product has been called `SpectreMail` on every surface since M0 while the roadmap's own status
line says the name *"remains a codename until final naming/brand checks are complete"*.

The six checks were run on 2026-10-16, against live sources rather than against a search
engine's summary of them, and the result is not the shape the roadmap anticipated. **Every
operational check came back clean — GitHub, npm, PyPI, crates.io, RubyGems, Packagist, Docker
Hub, Mastodon, all 924 Firefox add-ons and the Chrome Web Store carry no name collision — and
the one thing that is taken is the one thing a mail product cannot do without.**

`spectremail.com` is **registered**, since 2020-06-03, renewed 2026-08-17, and held. A company
directory lists a business of that name at that address describing itself as *"a cloud-based
email management app"* whose features include **private domains, token assignment to emails,
mailbox creation and syncing, message control and email statistics** — the same category this
product occupies.

What makes that finding worth more than the fact is the way it was nearly missed. **The domain
has no nameservers.** A resolver asked whether `spectremail.com` is available answers *yes*,
because it cannot resolve it; only the registry's own RDAP endpoint answers that it is
registered. Two instruments disagreed and the disagreement was the result: *a domain
registered with no nameservers resolves nowhere, and every availability check built on DNS
reports it as free.*

## What Changes

- **ADDED** `website-client` — the public name is one exported value and the website's two
  surfaces that render it render that value.
- **ADDED** `extension-client` — the extension's surfaces render the one public name, and the
  manifest's two name fields agree with each other and with it.
- **ADDED** `build-and-verification` — a shipped branding review names every surface the public
  name reaches, exhaustively and in both directions.

**No requirement is `MODIFIED` and none is `REMOVED`, so the promoted requirement count moves by
exactly three.** That is the sixth change in this repository to reach that shape.

**Nothing is renamed.** The measured finding is that the name stands: no store, no registry and
no handle collision was found, and the one loss — the `.com` — is a domain decision the roadmap
does not ask about and that no check can make for us. What ships instead is the record and the
instrument that makes *"public branding should be updated cleanly"* a property of the tree
rather than an aspiration, so that the next reader can re-run the checks instead of inheriting
a claim.

## What ships

| file | role |
| --- | --- |
| `docs/BRANDING.md` | the six roadmap checks, each with the instrument that ran it, the control that proved the instrument, the date, and what was **not** measured |
| `tests/architecture/branding-audit.test.ts` | resolves the review's surface table against the tree, in both directions |
| `apps/extension/src/panel-copy.ts`, `apps/extension/src/popup-copy.ts`, `apps/extension/src/content-script/affordance.ts` | read the one name value rather than spelling it |

## What this change deliberately does not do

- **It does not rename anything.** See above.
- **It does not state a trademark position.** Three of the six roadmap checks produced **no
  measurement**, and §4 of the document says so. A "basic trademark risk check" that cannot be
  run from here is recorded as unmeasured rather than reported as clear — the same rule this
  repository already applies to provider terms it could not verify.
- **It does not choose a domain.** That is M13's decision and it is not a branding question.