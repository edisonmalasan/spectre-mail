# Tasks — surface hierarchy

Nine measured claims, nine requirement blocks, three capabilities. Every task names the instrument
that proves it, and no task is ticked until that instrument has been run against the built artefact.

**The block count moved from eight to nine during apply (2026-11-01)**, when the extension's address
turned out to be breaking inside its domain *before* this change enlarged it. `proposal.md` and
`design.md` D6 carry the measurement and the reason; the fifth `extension-client` requirement is task
3.6 below.

**Predicted before the work, so it cannot be adjusted after it**: `packages/ui/src/tokens.ts` is
untouched, `docs/DESIGN_SYSTEM.md`'s generated region is untouched, and `packages/ui`'s test count
does not move. A new token or a moving count means D1 was wrong about the defect being a missing
rank rather than a missing value.

## 1. The design record owns the role before any stylesheet reads it

- [x] 1.1 Add `region-label` to `DESIGN.md`'s frontmatter `typography:` map, built from
  `type-xs` + `weight-medium` + `leading-normal` + `tracking-wide`. **No colour and no
  `text-transform` in the frontmatter** — the property map describes typography, and D1.1 records why
  the transformation is not part of it.
- [x] 1.2 Add the same role to `tests/architecture/design-record.test.ts`'s `TYPE_ROLES` map and change
  the file's doc block from *eight type roles* to *nine*. The map is asserted in both directions, so a
  role in one home and not the other fails; that assertion is the instrument for 1.1.
- [x] 1.3 Rewrite `DESIGN.md`'s Hierarchy section: state the rule (*a region's name is the quietest
  text in the system; the datum a region presents outranks it*), list nine roles, and **delete** the
  sentence *"The **address** is set in monospace at the headline step"* rather than adding a caveat
  beside it. **Deletion is the deliverable**: that sentence is the defect the change exists to repair,
  and leaving it in place would put the record at odds with the page.
- [x] 1.4 Qualify `DESIGN.md`'s Layout paragraph: keep *"paragraphs and list items cap at 62
  characters"* for prose, and state that a row of fields is not prose and takes the width of its list.
  The two sentences it carries today contradict each other and a reader cannot tell which wins.
- [x] 1.5 Record in `DESIGN.md`'s Components section that an address is the largest datum on any
  surface that shows one, at `type-2xl`, and that `type-2xl` is no longer unused. A record that still
  says the step is unused is a record nobody re-read.
- [x] 1.6 `pnpm test tests/architecture` — expect `design-record.test.ts` green with the ninth role and
  its own count **unmoved**, because the assertions are table-driven over the map's entries. A moved
  count here means a case was written per role and the prediction was wrong.

## 2. The website's product region

- [x] 2.1 Apply the label step to `apps/web/src/styles.css` for **every region heading on the page** —
  the product's inner regions, the state heading, the three marketing regions and the footer — because
  the requirement's subject is a region's name, and a page where only the product's names are quiet
  would set the explanation above the product. **The global `h2` rule carries the four typographic
  tokens and no colour**; the colour is semantic — `ink-muted` on an ordinary region, `ink-danger` on
  a failure region, both declared pairs. **Read every value from the role's tokens** — a literal
  `0.75rem` is the defect a token layer exists to prevent. Prove it by computed style in the browser
  tier for one heading in each of the five `data-region`s: `font-size` resolves to `--type-xs`,
  `letter-spacing` to `--tracking-wide`, `text-transform` is `none`, and the colour is the declared
  one for that region's kind.
- [x] 2.2 Set `.address__value` at `--type-2xl` and change it from `inline-block` to a block that fills
  its container, so the line box is the container's width rather than the string's. **Keep
  `overflow-wrap: anywhere`** as the fallback for a domain that cannot fit.
- [x] 2.3 Insert one `<wbr>` after the `@` in `Address.tsx`. **No wrapper spans**: `<wbr>` is the whole
  mechanism, and a span pair carrying no declaration is markup a reader has to explain. Prove it in
  the browser tier at 390 px: the rendered line's break happens after `@`, and the element's
  `textContent` equals the address with nothing inserted. **A zero-width space is rejected** — it
  would enter the copied value.
- [x] 2.4 Move `control--primary` from `Replace address` to `Copy address`, leaving `Replace address`
  its border and its position. Prove it in the browser tier: the resolved `background-color` of the
  copy control is the declared `accent` and the replace control's is not, **with the replace control's
  accessible name and effect unchanged** — a promotion that renamed a control would break
  `page-composition`'s freeze.
- [x] 2.5 Scope `li { max-width: 62ch }` so it no longer caps `.inbox-row`, and let the row's grid span
  its list. Prove it in the browser tier: the row's width equals the list's width at 1440 px, and the
  row's grid resolves to two columns rather than three. **Keep the ISO instant verbatim** — this task
  changes its column's share, not its text.
- [x] 2.6 Put the accent on `RecentMailboxes`' current entry, beside the text and the structural
  difference it already carries. Prove it in the browser tier: the current entry's marking resolves to
  `--ink-accent`, and the entry is still the only one without a control — **so the accent is not the
  only difference**, which the requirement forbids.
- [x] 2.7 Leave `steps`, `reasons`, `extension` and `footer` **composed as they are**. Their grids,
  their content, their order and their share of the page are a composition question this change
  records and does not answer; **their headings take the role, and a diff anywhere else in them is
  out of scope.** A diff in one of those headings is the work, not an overrun — D1.3 records why
  leaving them out would have inverted the hierarchy.

## 3. The extension's popup

- [ ] 3.1 Delete `text-transform: uppercase` from `.popup h2, .panel h2` and rebuild the rule from the
  role's four tokens. Prove it in the browser tier: the `h2`'s computed `text-transform` is `none` and
  **its accessible name from `Accessibility.getFullAXTree` equals its `textContent`** — the assertion
  D1.1's measurement exists to hold.
- [ ] 3.2 Set the popup's address at `--type-2xl`, above `.popup__heading`'s size, and drop the muted
  colour to `ink-primary`. Prove it in the browser tier: the address's resolved `font-size` is larger
  than the brand heading's, which is the reversal the proposal measured.
- [ ] 3.3 Give the message list a real row: no marker, full width of the list, and four fields as
  distinct fields. Prove it in the browser tier: `list-style-type` is not `disc`, the row's width
  equals the list's, and a row with a long subject keeps its time and verdict in their own fields.

  **Amendment, recorded during apply (2026-11-01), by `surface-hierarchy`.** This task said *"four
  fields in their own cells"*, and the shipped grid is `"from time" / "subject subject" / "verdict
  verdict" / "open open"` — **two cells on the first line and a full-width field for each of the
  other three**. The requirement's words are *"distinct fields rather than as one wrapped line"*, and
  a full-width field is a field; the cell count was this task's own shorthand for the claim and not
  the claim. **The reason for the deviation is the verdict's shape**: it is a full sentence
  (`"No verification was found in this message."`), and a column sized for a sentence would take most
  of the row away from the subject. **The time keeps a column of its own because it is `nowrap`** —
  the one field whose width cannot move.

  **And the fourth field needed a fallback the task did not name.** `POPUP_COPY.noSubject` (*"No
  subject"*) mirrors the website's row and `describeSender`'s unnamed-sender fallback, because a grid
  row whose subject is an empty box collapses to the gap between two other fields — which reads as a
  rendering fault rather than as a message with no subject. Measured: a real Guerrilla message arrived
  with an empty subject (`docs/PROVIDERS.md`, run `2026-10-01T18-08-41-251Z`).
- [ ] 3.4 Move the diagnostic report below the address, the status, the inbox and any opened message.
  Prove it in the unit tier by DOM order, and in the browser tier by `getBoundingClientRect().top`
  ordering on the built popup. **The component is moved, not rewritten** — a changed sentence in
  `diagnostic.ts` is out of scope.
- [ ] 3.5 Render the mailbox's provider through `providerDisplayName`, supplied by `App.tsx` from the
  manager it already builds. Update `Popup.test.tsx`'s heading assertion from `guerrilla` to
  `Guerrilla Mail` and keep its negative control (*`Mail.tm` is not on screen once a mailbox exists*),
  which is what stops the preference being rendered in place of the mailbox's own provider.
- [ ] 3.6 Render the address through one `AddressText` component that puts a `<wbr>` after its last
  `@`, so a 32-character address breaks between its local part and its domain instead of inside the
  domain. Prove it in the browser tier at the popup's own width: the rendered line breaks after `@`,
  and the element's `textContent` equals the address with nothing inserted. **A zero-width space is
  rejected** — it would enter the copied value.

  **This task did not exist when the change was proposed, and the measurement is why it does.** At
  `--type-base` a 32-character Guerrilla address is about 307 px in a 304 px content box, so **the
  shipped popup was already splitting its domain** — this is a pre-existing defect that enlarging the
  address makes certain rather than likely. `extension-client` gains the fifth `ADDED` requirement for
  it, because the website's `@`-break clause is a `MODIFIED` block on a page requirement and cannot
  bind a popup.

## 4. The extension's panel

- [ ] 4.1 Rebuild the panel's `h2` rule from the same four tokens, so both surfaces read one role.
  Prove it in the browser tier by comparing the two surfaces' resolved values, not by reading the
  stylesheet twice.
- [ ] 4.2 Set the panel's address at `--type-2xl` from the same rule the popup uses. **One declaration
  for two surfaces** where the class is shared; where it is not, the two rules read the same tokens and
  the browser case asserts they resolve identically.
- [ ] 4.3 Move the removal section below the inbox and any opened message. Prove it in the unit tier by
  DOM order and in the browser tier by rect ordering, and keep the existing two-press confirmation and
  its empty-area readback exactly as they are — **this task moves a control and changes no behaviour**.
- [ ] 4.4 Render the mailbox's provider through `providerDisplayName`, supplied by `panel-main.tsx`
  from the manager it already builds. Update the panel's heading assertions and keep
  `PANEL_COPY.addressHeading` as the single place that decides the heading's text, now handed a name.
- [ ] 4.5 Prove the fallback: a stored mailbox whose provider no adapter in this build declares renders
  that identifier rather than an empty heading. A case must exist, because a fallback no case exercises
  is a fallback nobody has re-read.

## 5. The opened message

- [ ] 5.1 Render `from`, `subject`, `receivedAt` and `readable` in `OpenedMessageView`, above the codes.
  **No new control and no new dependency** — the fields are on the object the component is already
  handed, and the readable text was produced by the extraction the session already ran.
- [ ] 5.2 Render `readable` as text. Prove it in the unit tier: a body containing `<b>` renders the
  characters `<b>` and produces no `strong` element, and an `onerror`-shaped string produces no image.
- [ ] 5.3 Prove the claim holds on **both** surfaces from one component: one case renders the popup's
  surface and one the panel's, and both read the same four fields. A popup-only case would pass with
  the panel rendering nothing.
- [ ] 5.4 Keep the popup's absent clipboard control and the panel's present one exactly as they are.
  This is a reading change, not a capability change, and `MessageSurface.tsx`'s D2 is not reopened.

## 6. Verification

- [ ] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` — each recorded
  separately, because a green build is not a typecheck and a green suite is not a formatted tree.
- [ ] 6.2 `pnpm verify` three times with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory measured to
  hold no browsers. **Three, not one**, because this repository has twice found a red that a single
  green run could not have reported.
- [ ] 6.3 `pnpm test:browser`, and record both tiers' counts against the figures they replace
  (**52 website + 99 extension**). A tier that does not move is a claim that nothing in it was
  affected, and it is recorded rather than assumed.
- [ ] 6.4 Re-measure `pnpm test` from a `--reporter=json` run grouped by project, and reconcile the
  movement per package. **A count that moves without an account of the movement is a count nobody
  re-read.**
- [ ] 6.5 Falsify every new assertion: a mutation per claim, each restored byte-identical against a
  SHA-256 taken before the first mutation. At minimum — the label step reverted to 22 px; the accent
  returned to `Replace address`; the `@` break removed (so the domain splits); the prose measure
  restored on the row; `text-transform: uppercase` returned (the AX-name case must go red); the
  opened message's `readable` removed; the opened message's `subject` removed; the row's marker
  returned; the report moved back above the address; the removal section moved back above the inbox;
  the provider heading returned to the identifier; the fallback replaced by an empty string. **Each
  mutation names the assertion aimed at it, and a catcher naming an unrelated assertion is recorded as
  a wrong attribution rather than counted.**
- [ ] 6.6 Confirm the eight claims that must **not** move: `page-composition`'s five regions and their
  order, the ten `h2` accessible names, the ~20 region-name assertions, `boundaries.test.ts`'s count,
  `packages/ui`'s count, `manifest.json` byte-identical, and `openspec/specs/` untouched at its
  current count until sync.
- [ ] 6.7 `openspec validate surface-hierarchy --strict` and `openspec validate --specs --strict`.

## 7. Documentation

- [ ] 7.1 `DESIGN.md` is task 1. `docs/DESIGN_SYSTEM.md`'s generated region needs no edit **if** the
  prediction holds; if the emitter's input changed, the emitter is re-run and the change is recorded
  rather than hand-edited.
- [ ] 7.2 Record in `docs/ROADMAP.md`'s Project Status block what this change did and what it left
  open — the four non-product regions, the in-page control, the report's vocabulary and the panel
  chooser's repeated address.
- [ ] 7.3 Update `AGENTS.md`'s standing counts from a fresh JSON run, and append the stage's entry with
  its measured figures. **A figure carried forward is a figure nobody checked.**
- [ ] 7.4 Leave `openspec/changes/archive/` untouched. Nothing in this change rewrites history.

## Out of scope, recorded rather than done

- The four non-product website regions' share of the page and their composition — their headings are
  in scope, everything else about them is not.
- The in-page shadow-root control's literal accent and its inability to read custom properties.
- The diagnostic report's code vocabulary (`MAILBOX_EXPIRED` in a person's face).
- The panel chooser's label, which repeats the full address to label a choice about it.
- Any copy rewrite. This change moves type, space, grids, order, one control's treatment, and the
  source of one heading's text.
