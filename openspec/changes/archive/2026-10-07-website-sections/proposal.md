# Proposal

## Why

M7 slice 1 built the token layer and slice 2 built the motion, but the page is still one
undifferentiated column: the working product and everything a visitor needs to know about it
share a single scroll with no hierarchy. The roadmap lists five website sections and a Swiss
direction that a flat column cannot express. Three of the five are deliverable now; the
`Extension preview` is blocked on M8 and a preview of an extension with no manifest would be
fake UI.

## What Changes

- **The page gains four sections around the product it already runs.** The product stays the
  hero, per the roadmap's own line — no marketing hero is added above the address.
- **A `Why SpectreMail` section**, carrying only claims this repository can substantiate.
- **A `Generate → Receive → Discard` section** describing the three steps the page performs,
  naming the provider rather than a generic "mail service".
- **A footer** carrying the privacy and provider facts. The roadmap names an *open-source*
  footer; **this change ships no licence claim**, because the repository carries no `LICENSE`
  file and GitHub reports `licenseInfo: null`. The roadmap's item is audited away rather than
  satisfied by a claim the page cannot support — the same treatment M6 gave its fourth slice.
- **Three Accent-block surfaces land here**, the ones slice 1 deliberately deferred because
  nothing on the page existed to carry them: the **brand mark**, the **primary action**, and
  **a selected mailbox row**.
- **No new product capability.** No claim, control, region, or assertion of behaviour that
  did not already exist. The change is composition and copy over a working page.

## Capabilities

### New Capabilities

- `page-composition`: how the page is divided into sections, what each one is for, and the
  rules that keep a section from asserting what the product cannot do.

### Modified Capabilities

- `website-client`: the existing "What this page can and cannot do" limits list moves into the
  footer, and the page gains a section order it must not contradict.
- `visual-system`: three Accent-block surfaces gain a defined appearance, and `measure-page`
  stops being the only width on the page.

## Impact

- `apps/web/src/`: new section components, a `sections` composition in `App.tsx`, and
  `styles.css` rules — all reading declared tokens, no literals beyond the six the stylesheet
  already documents.
- `packages/ui/`: new colour pair declarations if the new surfaces introduce one; both schemes
  declared, both contrast-checked by the existing `pairs.test.ts`.
- `docs/ROADMAP.md`: slice 3's row, the cursor, and an audit of the *open-source* footer item.
- **No package, provider, storage, or API change. No new dependency.** The page loads no
  third-party asset, and nothing here may introduce one — the brand mark is an inline SVG the
  product draws, not a fetched file.