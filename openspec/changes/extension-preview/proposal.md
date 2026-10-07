# Proposal

## Why

`docs/ROADMAP.md` names five sections for the website's page, and the fourth — *Extension
preview* — has never shipped. It was blocked on `apps/extension`, which was an empty directory
with no Manifest V3 manifest, and `page-composition` turned that block into a **requirement**:
the section is *absent by requirement*, and the browser tier asserts both halves of the absence
("no region previews the extension" and "the page does not describe the absence as missing or
forthcoming").

M8 (`extension-foundation`) built `apps/extension`: a real MV3 client with a manifest Chromium
loads, a popup that creates a mailbox over the shared session, and a browser tier of its own.
**The block is cleared, so the absence is now the false claim.** `page-composition`'s own note
says *"it is M7 slice 4's subject and slice 4 is blocked on M8"* — that sentence is what this
change makes untrue, and it is amended here rather than left standing.

## What Changes

- **The `Extension preview` section is added** as the page's fourth region, between *Why
  SpectreMail* and the footer, which is the position the roadmap's five-section list gives it.
- **It is a description, not a picture of a picture.** No screenshot, no image file, no webfont:
  the schematic is drawn from the page's own markup and tokens, for the same measured reason
  the brand mark is an inline `<svg>` rather than `public/mark.svg`.
- **It renders no interactive element at all.** No button, no link, no input. This is the
  `extension-client` rule *"a declared surface that renders nothing or acts on nothing is fake
  UI"* applied to the website: a preview containing a `Copy address` button that does nothing is
  a control that misreports, and this repository has refused that shape three times.
- **It offers no way to obtain the extension, and says why in one present-tense sentence.** The
  repository has no release pipeline, no store listing, and no signed artifact; a download link
  would be a promise the product cannot keep, and a section that previews an extension and
  silently offers no route to it is the same failure in the other direction.
- **Every region label it shows is checked against the extension popup's own copy.** A boundary
  assertion imports the popup's copy and requires the preview's labels to be drawn from it, so a
  preview that drifts from the popup it previews fails the build rather than rotting quietly.
  This is `extension-client`'s *"the two clients diverge"* requirement, which already owns
  cross-client drift, pointed at a second place it can happen.
- **Two existing browser assertions are rescoped rather than deleted.**
  `sections.spec.ts` asserts today that the page text contains no `\bextension\b` and no
  `mail.tm`. Both become false the moment this section ships, and both are **scoped** rather
  than removed: the page may name the extension in the preview region only, and may name Mail.tm
  only as the *extension's* provider — never as the page's.
- **It adds no design token, no new motion, and no accent surface.** `visual-system` is
  therefore untouched: motion stays at three materialisations and the accent stays on the three
  surfaces the Accent block names.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `page-composition`: **"The section set is not invented by this slice"** is amended. Its
  current scenario forbids *any* region previewing the extension, and its note records the M8
  block as current. Both are replaced: a section whose subject **is** built is required rather
  than forbidden, and the standing rule — a section states only what the product does — gains the
  preview's two new obligations (no control it cannot act through, no claim of a surface the
  extension does not have). **"The page is five regions in a stated order"** gains an explicit
  count clause: the requirement's *title* has said "five" since slice 3 while four regions
  rendered, and this change is what makes the title true.
- `extension-client`: **"The extension is a Chromium MV3 client over the shared packages"** gains
  a scenario for the website's preview, which is a second surface through which the two clients
  can report the same situation differently.

`website-client`, `visual-system`, and `build-and-verification` are deliberately untouched, and
`tasks.md` records why each was considered and left alone.

## Impact

- **New:** `apps/web/src/ExtensionPreview.tsx`, its unit test, its browser cases in
  `apps/web/e2e/sections.spec.ts`, and one boundary assertion in
  `tests/architecture/boundaries.test.ts`.
- **Changed:** `apps/web/src/sections.ts` (`PAGE_ORDER`, `REGION_HOOKS`, and the preview's copy
  as data), `apps/web/src/App.tsx` (render the region between `Reasons` and `PageFooter`),
  `apps/web/src/styles.css` (every class the new component renders), and
  `apps/extension/src/Popup.tsx` (its copy exported rather than module-private, so the boundary
  assertion reads the popup's real strings instead of scraping them).
- **Not changed:** the provider layer, the mailbox session, storage, the token layer, the
  extension's behaviour, and every product region and control on the page. No product region's
  accessible name moves, and no test asserting one is edited.
- **Counts this change expects to move, and expects the others to hold:** `apps/web`'s unit
  count rises; `apps/extension`'s does not; `packages/*` do not; the browser tier's website
  count rises and the extension's holds at 16.