# Tasks

## 1. The popup's copy becomes an importable declaration (design.md D8)

- [ ] 1.1 Move `Popup.tsx`'s module-private `COPY` into an exported `apps/extension/src/popup-copy.ts`, importing it back where it was declared, and verify `apps/extension`'s unit count is **unchanged at 20** and `pnpm --filter @spectre-mail/extension typecheck` passes. **A count that moves here means a string changed**, and no string may change in this move.
- [ ] 1.2 Add a unit test asserting the exported copy's string-valued entries contain no `{` substitution token unless they are the one template entry, and verify it fails when a new template entry is added without being declared. This is what makes design.md D3's "no `{` token" clause a check rather than a comment.
- [ ] 1.3 Verify `pnpm test` reports `apps/extension` at 20 with `Popup.test.tsx` still at 8, read from `--reporter=json` and grouped by project rather than off a summary line.

## 2. The preview's labels, and the rule that keeps them the popup's (design.md D3)

- [ ] 2.1 In `apps/web/src/sections.ts`, declare the popup copy entries the preview depicts **by name**, plus the region's heading, its `Basis:` notes naming the requirement each sentence rests on, and the one present-tense distribution sentence from design.md D5. Verify the file compiles and every entry names a key the exported popup copy actually has.
- [ ] 2.2 Add `PAGE_ORDER`'s `extension` entry before `footer` and its `REGION_HOOKS` entry, and update the module note's paragraph that records `Extension preview` as absent — **delete it rather than reword it**, since it became false when M8 landed and a reworded version reads as current state.
- [ ] 2.3 Add the boundary assertion to `tests/architecture/boundaries.test.ts`: every declared entry resolves to a string in the popup's exported copy and contains no `{` token, and the failure names the section and the label. Verify it fails — by mutating a declared name, and by mutating one entry into a template — and that each mutation is caught by the intended assertion rather than by a compile error or an unrelated test.
- [ ] 2.4 Give the assertion its positive and negative controls, and verify **each control fails when removed**: a control that adds a label the popup does not render must be reported by name, and the conforming case must report nothing.

## 3. The region itself (design.md D1, D2, D6, D7)

- [ ] 3.1 Create `apps/web/src/ExtensionPreview.tsx`: a `<section>` with `data-region="extension"`, its own heading, the declared prose, and the `<figure>`/`<figcaption>` depiction rendering the popup's region headings and control labels **as text**. Verify it renders no `<button>`, `<a>`, `<input>`, or `role="button"` — asserted in a unit test over the rendered DOM, not by reading the source.
- [ ] 3.2 Render it in `App.tsx` between `<Reasons />` and `<PageFooter />`, and verify no product region's accessible name, control name, or `data-testid` changed by running `App.test.tsx`, `recovery.test.tsx`, and `Inbox.test.tsx` untouched.
- [ ] 3.3 Add the preview's rules to `apps/web/src/styles.css` using declared tokens only, and verify the boundary rule _"uses every class hook a client renders"_ passes — every class the component renders must have a rule, and the rule failing is the rule working.
- [ ] 3.4 Add the component's unit tests: the figure renders every declared label, renders no interactive element, and its caption names it as a description rather than as the popup.

## 4. The browser tier (design.md D2, D4, D7)

- [ ] 4.1 Rescope the two assertions that are false the moment this region ships — no `\bextension\b`, no `mail.tm` — from the whole page to _every region other than the preview_, using `data-region` as the scope. Verify each still **fails** when the forbidden word is planted in a different region, and record the control as a control rather than as coverage.
- [ ] 4.2 Add the case that the preview renders **no interactive element**, read from Chromium's own accessibility tree over CDP — no `button` role and no `link` role inside the region — rather than from a DOM query, because the AX tree is the instrument that caught `<footer>` inside `<main>` and a role query is the instrument that hid it.
- [ ] 4.3 Add the case that every label the built preview shows is one the popup renders, read from the served page, and verify it against a mutation of the declared labels.
- [ ] 4.4 Add the case that the preview names no capability the extension has declared absent — content script, side panel, notification, code copy or fill — and no cadence, since the popup polls nothing. Verify a mutation naming any of them is caught.
- [ ] 4.5 Verify the whole website browser tier passes against a real build, and that its existing thirteen cases still pass — **the count must rise by exactly the cases added here and no existing case may be edited except the two rescoped in 4.1**.
- [ ] 4.6 Run `pnpm test:browser` and verify the extension's tier is **unchanged at 16 cases**; a movement there would mean this change touched the extension client, which it does not.

## 5. Falsification, gates, and the record

- [ ] 5.1 Run the falsification pass: every new assertion in groups 2–4 is mutated in turn, and each mutation is recorded as **caught by the intended assertion**, `nocompile`, `noop`, `green`, `wrongcatch`, or `harness-error` — with the last four never counted as a pass. Restore every mutated file and verify restoration by SHA-256, then rebuild `dist/`, because restoring a source file does not restore what the browser serves.
- [ ] 5.2 Run `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and verify it exits 0 — proving the whole workspace is consistent with **no browser installed**.
- [ ] 5.3 Measure the counts from `--reporter=json` grouped by project, and verify what this change expects to move did and what it expects to hold held: `apps/web` up, `apps/extension` **20**, `packages/*` unchanged, architecture boundaries **53 → 54**, website browser cases up, extension browser cases **16**.
- [ ] 5.4 Update `docs/ROADMAP.md`'s slice 4 row to archived with its archive path, its measured counts, and the audit of what this section chose **not** to claim; and update the Project Status cursor to the next eligible objective.
- [ ] 5.5 Update `AGENTS.md` — the reconciled header, the Setup & commands counts, and the deletion of any sentence this change makes false. Record what the new checks prove **and what they do not**: no test reads a rendered pixel's colour or position, so how the section looks remains outside every gate here.

## 6. Not to be ticked by an agent

- [ ] 6.1 ~~Open the built page in a real browser and judge the section~~ — **deliberately left unticked.** No gate in this repository reads a rendered pixel's colour or position, and an agent opening the page is not the human judgement the task asks for. This is the same fourth limit `website-sections` recorded, unchanged by this slice.