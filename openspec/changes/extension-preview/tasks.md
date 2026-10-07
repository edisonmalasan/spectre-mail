# Tasks

## 1. The popup's copy becomes an importable declaration (design.md D8)

- [x] 1.1 Move `Popup.tsx`'s module-private `COPY` into an exported `apps/extension/src/popup-copy.ts`, importing it back where it was declared, and verify `apps/extension`'s unit count is **unchanged at 20** and `pnpm --filter @spectre-mail/extension typecheck` passes. **A count that moves here means a string changed**, and no string may change in this move.
- [x] 1.2 Add a unit test asserting the exported copy's string-valued entries contain no `{` substitution token unless they are the one template entry, and verify it fails when a new template entry is added without being declared. This is what makes design.md D3's "no `{` token" clause a check rather than a comment.

  **Measured during apply, and the limit is recorded here because it is the reason task 2.3
  exists.** The undeclared-template mutation is caught by the intended assertion — adding
  `` checking: "Checking {count}" `` turns _"carries a substitution token in exactly the entries
  it declares"_ red and nothing else. **A rename is not caught here, and cannot be:** mutating
  `create` to `"Make an address"` leaves all five cases green, because a rename preserves every
  property this file asserts (still a string, still untemplated, still non-empty). This file
  asserts the copy's **shape**; a rename changes its **content**, and the assertion that reads
  content is task 2.3's, in the boundary suite, because it is the assertion that knows what the
  website's depiction declares.
- [x] 1.3 Verify `pnpm test` reports `apps/extension` at 20 with `Popup.test.tsx` still at 8, read from `--reporter=json` and grouped by project rather than off a summary line.

  **Measured, and the figure this task predicted was wrong: `apps/extension` is 25, not 20.**
  Read from `--reporter=json`, `Popup.test.tsx` is **8** — unchanged, which is the half of
  this task that carried the evidence and the reason 1.1's move is trustworthy — and
  `popup-copy.test.ts` adds **5**. The workspace is **731 across 40 files**, from a baseline of
  **726 across 39**, and architecture boundaries are **53**, unchanged.

  **The prediction is corrected here rather than reinterpreted.** A task that names a number and
  is wrong about it is worse than one that does not name a number, and 1.2's five cases were
  written by this task's own group — the count could not have been anything else. `apps/web` is
  **114**, unchanged, which is the check that mattered: this group touched no website code.

## 2. The preview's labels, and the rule that keeps them the popup's (design.md D3)

- [x] 2.1 In `apps/web/src/sections.ts`, declare the popup copy entries the preview depicts **by name**, plus the region's heading, its `Basis:` notes naming the requirement each sentence rests on, and the one present-tense distribution sentence from design.md D5. Verify the file compiles and every entry names a key the exported popup copy actually has.

  **Amended during apply, and the amendment is in `design.md` D3.** This task said the website
  **imports** the entries. It does not: it declares `{ key, label }` pairs and the *equality* is
  enforced by the boundary rule. The measured reason is in D3 - no shipped source file in either
  client imports the other today, and an import would put `apps/extension/src` into `apps/web`'s
  build graph. Seven labels across three depicted regions: `copy`; `status`, `unknown`,
  `askStatus`; `inbox`, `empty`, `check`. The three **not** depicted are `reaching` (the one
  `{token}` template), `count` and `checkFailed` (functions of the count).
- [x] 2.2 Add `PAGE_ORDER`'s `extension` entry before `footer` and its `REGION_HOOKS` entry, and update the module note's paragraph that records `Extension preview` as absent — **delete it rather than reword it**, since it became false when M8 landed and a reworded version reads as current state.
- [x] 2.3 Add the boundary assertion to `tests/architecture/boundaries.test.ts`: every declared entry resolves to a string in the popup's exported copy and contains no `{` token, and the failure names the section and the label. Verify it fails — by mutating a declared name, and by mutating one entry into a template — and that each mutation is caught by the intended assertion rather than by a compile error or an unrelated test.
- [x] 2.4 Give the assertion its positive and negative controls, and verify **each control fails when removed**: a control that adds a label the popup does not render must be reported by name, and the conforming case must report nothing.

  **Measured. Four mutations, four catches, each by the intended assertion, restoration SHA-256
  verified:** a label the popup does not render; a popup entry renamed on the website side; an
  entry that is a function of its arguments; an entry that became a template. `noop`, `green`,
  `wrongcatch`, `nocompile` and `harness-error` are all zero.

  **The rule reports four distinct failures rather than one, and each has its own control through
  one call site.** A single control would have left three modes unexercised, and a fifth control
  asserts the conforming case reports nothing so that four controls cannot all pass on a rule that
  reports everything.

  **The rule does not require the preview to be exhaustive, and says so in its own note.** That is
  a decision rather than an omission; it is recorded in `design.md`'s falsification record as
  mutation `E01`, where dropping a label was correctly permitted.

## 3. The region itself (design.md D1, D2, D6, D7)

- [x] 3.1 Create `apps/web/src/ExtensionPreview.tsx`: a `<section>` with `data-region="extension"`, its own heading, the declared prose, and the `<figure>`/`<figcaption>` depiction rendering the popup's region headings and control labels **as text**. Verify it renders no `<button>`, `<a>`, `<input>`, or `role="button"` — asserted in a unit test over the rendered DOM, not by reading the source.
- [x] 3.2 Render it in `App.tsx` between `<Reasons />` and `<PageFooter />`, and verify no product region's accessible name, control name, or `data-testid` changed by running `App.test.tsx`, `recovery.test.tsx`, and `Inbox.test.tsx` untouched.

  **Measured: all three untouched and all passing.** No existing test in `apps/web` was edited, and
  the six new cases are in a new file. `App.test.tsx` passing without edits is the evidence that
  the insertion changed no product region's name and no control's.
- [x] 3.3 Add the preview's rules to `apps/web/src/styles.css` using declared tokens only, and verify the boundary rule _"uses every class hook a client renders"_ passes — every class the component renders must have a rule, and the rule failing is the rule working.

  **Measured: eight rules, and the boundary rule passes.** `.preview`, `.preview__caption`,
  `.preview__regions`, `.preview__region`, `.preview__does`, `.preview__labels`, `.preview__label`,
  `.preview__note`. **No literal colour, radius, spacing step, type size or duration**, and the
  existing single breakpoint is unchanged because the preview's region list is one column at every
  width.
- [x] 3.4 Add the component's unit tests: the figure renders every declared label, renders no interactive element, and its caption names it as a description rather than as the popup.

  **Six cases, and the non-interactivity is checked twice on purpose.** Once by role and once by
  markup, because either reading alone passes while a control is present: counting `button`
  elements misses a `role="button"`, and a bare role query covers only the roles it knows. Both
  halves of the role sweep also run through Testing Library's own element-to-role mapping, which
  is a second instrument rather than a restatement.

  **A finding from running them.** `screen.queryAllByRole` is **not a function** in this project -
  `@testing-library/react` and the `@playwright`-independent `@testing-library/dom` copy that
  declares it resolve to different installations. The queries are bound from each `render()`
  result instead, and the reason is recorded beside the assertion rather than in a changelog.

## 4. The browser tier (design.md D2, D4, D7)

- [x] 4.1 Rescope the two assertions that are false the moment this region ships — no `\bextension\b`, no `mail.tm` — from the whole page to _every region other than the preview_, using `data-region` as the scope. Verify each still **fails** when the forbidden word is planted in a different region, and record the control as a control rather than as coverage.
- [x] 4.2 Add the case that the preview renders **no interactive element**, read from Chromium's own accessibility tree over CDP — no `button` role and no `link` role inside the region — rather than from a DOM query, because the AX tree is the instrument that caught `<footer>` inside `<main>` and a role query is the instrument that hid it.
- [x] 4.3 Add the case that every label the built preview shows is one the popup renders, read from the served page, and verify it against a mutation of the declared labels.
- [x] 4.4 Add the case that the preview names no capability the extension has declared absent — content script, side panel, notification, code copy or fill — and no cadence, since the popup polls nothing. Verify a mutation naming any of them is caught.
- [x] 4.5 Verify the whole website browser tier passes against a real build, and that its existing thirteen cases still pass — **the count must rise by exactly the cases added here and no existing case may be edited except the two rescoped in 4.1**.
- [x] 4.6 Run `pnpm test:browser` and verify the extension's tier is **unchanged at 16 cases**; a movement there would mean this change touched the extension client, which it does not.

  **Measured: website 34 → 37, `sections.spec.ts` 13 → 16, extension unchanged at 16.**
  `sections.spec.ts` is the only spec file edited, and only its two rescoped cases were edited
  within it. `pnpm test:browser` exits 0 against a real build of both clients.

  **`pnpm test:browser` is the only figure here.** A per-file count read with `Select-String`
  counts `test(` lines and would have reported the same number for a suite that did not run.

  **The two rescoped assertions each gained a negative control that plants the forbidden word into
  the running page**, because a sweep that matched nothing would satisfy every assertion above it
  and the exemption would be indistinguishable from a pattern that had silently stopped firing.

  **The AX case needed an instrument that does not yet exist in this repository.**
  `Accessibility.getFullAXTree` is a whole-tree read, and a whole-tree read cannot answer "does
  *this region* expose anything operable" without substituting this repository's judgement about
  which buttons belong elsewhere. So the case queries `Accessibility.queryAXTree` at the region's
  own DOM object and lets Chromium do the scoping. It also asserts the subtree is **present** in
  the tree, and plants a `<button>` to require the reader fires - a region emptied of content
  satisfies a role sweep for the wrong reason, and that is the cheapest way to produce a check
  narrower than its rule.

  **The operable-role list lost three entries before it was used.** `text`, `image` and `img` were
  in the first draft and the sweep fired on Chromium's own `StaticText` nodes for every label in
  the depiction. They were removed from the list rather than the pattern reworded until the
  assertion went quiet.

  **This spec imports `POPUP_COPY` across the client boundary**, which `design.md` D3 declines to do
  in shipped source. A Playwright spec is not shipped, is not in `apps/web`'s build path, and
  cannot be reached by a user, so it creates no coupling; the note beside the import says so.
  Without it, 4.3 could only compare the page against `EXTENSION_PREVIEW`'s own declarations -
  which the unit tier already covers, and which a component would satisfy by faithfully rendering
  declared data while the popup had renamed a label underneath it.

## 5. Falsification, gates, and the record

- [x] 5.1 Run the falsification pass: every new assertion in groups 2–4 is mutated in turn, and each mutation is recorded as **caught by the intended assertion**, `nocompile`, `noop`, `green`, `wrongcatch`, or `harness-error` — with the last four never counted as a pass. Restore every mutated file and verify restoration by SHA-256, then rebuild `dist/`, because restoring a source file does not restore what the browser serves.
- [x] 5.2 Run `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and verify it exits 0 — proving the whole workspace is consistent with **no browser installed**.
- [x] 5.3 Measure the counts from `--reporter=json` grouped by project, and verify what this change expects to move did and what it expects to hold held: `apps/web` up, `apps/extension` **20**, `packages/*` unchanged, architecture boundaries **53 → 54**, website browser cases up, extension browser cases **16**.
- [x] 5.4 Update `docs/ROADMAP.md`'s slice 4 row to archived with its archive path, its measured counts, and the audit of what this section chose **not** to claim; and update the Project Status cursor to the next eligible objective.
- [x] 5.5 Update `AGENTS.md` — the reconciled header, the Setup & commands counts, and the deletion of any sentence this change makes false. Record what the new checks prove **and what they do not**: no test reads a rendered pixel's colour or position, so how the section looks remains outside every gate here.

  **Measured, read from `--reporter=json` and grouped by project.** Baseline before this change
  was **726 across 39 files**.

  | project         | before | after  |
  | --------------- | ------ | ------ |
  | `packages/mailbox`   | 155 | **155** |
  | `packages/mail-parser` | 149 | **149** |
  | `apps/web`           | 114 | **120** |
  | `packages/providers` | 89  | **89**  |
  | architecture boundaries | 53 | **54** |
  | `packages/core`      | 54  | **54**  |
  | `packages/storage`   | 54  | **54**  |
  | `packages/ui`        | 38  | **38**  |
  | `apps/extension`     | 20  | **25**  |
  | **total**            | **726 across 39** | **738 across 41** |

  **Every prediction this change made held.** `apps/web` rose by exactly six (the new component's
  six cases), architecture by exactly one (the new boundary rule), `apps/extension` to 25 (which
  task 1.3 already corrected in place), and `packages/ui` stayed at **38** — the check that matters
  most, because `design.md` D6 committed this change to adding no token and no motion, and a rise
  there would have meant the preview had introduced visual surface the capability does not describe.
  `Popup.test.tsx` is still **8**.

  Browser tier, from `pnpm test:browser`'s own output: website **34 → 37**
  (`sections.spec.ts` **13 → 16**), extension **16 unchanged**.

  **`pnpm verify` exits 0 with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory holding zero
  entries.** It did **not** on the first attempt, for two reasons worth recording:
  `format:check` failed on three files committed earlier in this change without Prettier having
  been run over them, and `lint` failed on the falsification harness itself — four temporary
  scripts in the repository root, which were deleted rather than fixed, since a measuring
  instrument is not a shipped file. **`pnpm verify` was therefore run three times**: once red on
  `format:check`, once red on `lint`, and once green.

## 6. Not to be ticked by an agent

- [ ] 6.1 ~~Open the built page in a real browser and judge the section~~ — **deliberately left unticked.** No gate in this repository reads a rendered pixel's colour or position, and an agent opening the page is not the human judgement the task asks for. This is the same fourth limit `website-sections` recorded, unchanged by this slice.