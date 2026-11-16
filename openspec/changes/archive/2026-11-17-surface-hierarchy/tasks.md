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

- [x] 3.1 Delete `text-transform: uppercase` from `.popup h2, .panel h2` and rebuild the rule from the
  role's four tokens. Prove it in the browser tier: the `h2`'s computed `text-transform` is `none` and
  **its accessible name from `Accessibility.getFullAXTree` equals its `textContent`** — the assertion
  D1.1's measurement exists to hold.

  **Measured.** `.popup h2, .panel h2` now carries `--type-xs`, `--weight-medium`, `--leading-normal`
  and `--tracking-wide` and no transform, and `#create-heading` is read **before the create region
  unmounts** because it is the one region name a first-time visitor sees. `popup.spec.ts` asserts
  `text-transform: none`, and compares Chromium's own AX name to the element's text through
  `Accessibility.queryAXTree`. **Arm A05 returned the uppercase and the case failed on
  *"#create-heading: the name is transformed"*** — the only instrument in this repository that can
  see it, because `textContent` stays `Ready` while the AX tree says `READY`.
- [x] 3.2 Set the popup's address at `--type-2xl`, above `.popup__heading`'s size, and drop the muted
  colour to `ink-primary`. Prove it in the browser tier: the address's resolved `font-size` is larger
  than the brand heading's, which is the reversal the proposal measured.

  **Measured.** `.popup__address, .panel__address` resolves to `--type-2xl` (28 px) against
  `.popup__heading`'s `--type-xl` (22 px), and the case asserts the **ordering as a comparison**
  rather than only the value, so a later change that moved both would fail it. **Arm A13 — added after
  the first run, because D3 had an assertion and no arm — was caught on *"the address is not at
  --type-2xl"*.**
- [x] 3.3 Give the message list a real row: no marker, full width of the list, and four fields as
  distinct fields. Prove it in the browser tier: `list-style-type` is not `disc`, the row's width
  equals the list's, and a row with a long subject keeps its time and verdict in their own fields.

  **Measured.** `.message-row` is a grid with `width: 100%` and four named areas, and the popup case
  reads `list-style-type` as `none`, the row's width against the list's, and the three non-subject
  fields at their own rects. **Arm A08 returned the marker and the case failed on *"a message still
  carries a bullet"*.**

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
- [x] 3.4 Move the diagnostic report below the address, the status, the inbox and any opened message.
  Prove it in the unit tier by DOM order, and in the browser tier by `getBoundingClientRect().top`
  ordering on the built popup. **The component is moved, not rewritten** — a changed sentence in
  `diagnostic.ts` is out of scope.

  **Measured.** `Popup.tsx` renders `PopupDiagnostic` after the message section, and the browser case
  *"puts the report of the session below everything it is a report about"* reads rect tops on the
  built popup. **Arm A09 moved it back above the address and the case failed on *"the popup's sections
  are not in the order it declares"*.** No sentence in `diagnostic.ts` changed.
- [x] 3.5 Render the mailbox's provider through `providerDisplayName`, supplied by `App.tsx` from the
  manager it already builds. Update `Popup.test.tsx`'s heading assertion from `guerrilla` to
  `Guerrilla Mail` and keep its negative control (*`Mail.tm` is not on screen once a mailbox exists*),
  which is what stops the preference being rendered in place of the mailbox's own provider.

  **Measured.** `#address-heading` renders `providerDisplayName(providerNames, mailbox.provider)`, and
  the unit case's negative control still requires `Mail.tm` to be absent once a mailbox exists.
  **Arm A11 is the one that survived the first run**, and its cause is a defect in the *assertion*:
  `getByRole("heading", { name: "Mail.tm" })` matches by substring, and the create region's own name
  is *"Asking Mail.tm first"*. The assertion now reads `#address-heading` at its own node and adds the
  half a region-scoped check cannot hold — no `h2` on the surface may spell `mailtm` — and the same
  mutation is caught naming the claim. Full record: `design.md` D11.
- [x] 3.6 Render the address through one `AddressText` component that puts a `<wbr>` after its last
  `@`, so a 32-character address breaks between its local part and its domain instead of inside the
  domain. Prove it in the browser tier at the popup's own width: the rendered line breaks after `@`,
  and the element's `textContent` equals the address with nothing inserted. **A zero-width space is
  rejected** — it would enter the copied value.

  **Measured.** The case reads the address's child text nodes and requires **two**, split at the `@`,
  and its `textContent` equals the recorded address with nothing inserted. **Arm A03 removed the
  `<wbr>` and the case failed on *"the address is not split into two text nodes at the @"*.**

  **This task did not exist when the change was proposed, and the measurement is why it does.** At
  `--type-base` a 32-character Guerrilla address is about 307 px in a 304 px content box, so **the
  shipped popup was already splitting its domain** — this is a pre-existing defect that enlarging the
  address makes certain rather than likely. `extension-client` gains the fifth `ADDED` requirement for
  it, because the website's `@`-break clause is a `MODIFIED` block on a page requirement and cannot
  bind a popup.

## 4. The extension's panel

- [x] 4.1 Rebuild the panel's `h2` rule from the same four tokens, so both surfaces read one role.
  Prove it in the browser tier by comparing the two surfaces' resolved values, not by reading the
  stylesheet twice.

  **Measured, and the "one declaration" half turned out to be already true.** `.popup h2, .panel h2`
  is **one rule with one selector list**, so the panel could not have been rebuilt separately without
  first splitting a shared rule — the four tokens and the absent transform reach both surfaces through
  the same declaration. The browser case *"sets every region's name at the label step, and gives the
  address the step the popup gives it"* reads each of the panel's five region names
  (`#panel-host-heading`, `#panel-address-heading`, `#panel-inbox-heading`,
  `#panel-removal-heading`, `#panel-diagnostic-heading`) against `--type-xs`, `--weight-medium`,
  `--leading-normal`, `--tracking-wide`, `none` and `--ink-muted`. **The four values are read from
  `--` declarations resolved in the page**, not typed in, so a token change moves both sides. **Arm
  A05 returned the transform on that shared rule and the popup's case failed on *"#create-heading:
  the name is transformed"*** — one arm for one rule reaching two surfaces, which is the property the
  task asked for.
- [x] 4.2 Set the panel's address at `--type-2xl` from the same rule the popup uses. **One declaration
  for two surfaces** where the class is shared; where it is not, the two rules read the same tokens and
  the browser case asserts they resolve identically.

  **Measured, with the equality asserted rather than inferred.** `.popup__address, .panel__address`
  is one rule, and the panel's case reads **both surfaces** — the panel's address first, then the
  popup's opened as its own document — and requires the two to agree on `fontSize`, `color` and
  `display`, plus the text, plus the panel's address being larger than its brand heading. **A rule
  that reached only the popup would leave the panel at the base step and every other assertion in
  that tier would still pass**, which is the sentence in the case's own comment and the reason the
  comparison exists. Arm A13 moved the shared declaration to `--type-base` and the popup's case failed
  on *"the address is not at --type-2xl"*.
- [x] 4.3 Move the removal section below the inbox and any opened message. Prove it in the unit tier by
  DOM order and in the browser tier by rect ordering, and keep the existing two-press confirmation and
  its empty-area readback exactly as they are — **this task moves a control and changes no behaviour**.

  **Measured.** `Panel.tsx` renders removal at `:1113`, after the inbox (`:1016`) and any opened
  message (`:1061`). The unit assertion is `Panel.test.tsx:2517–2518`: the inbox precedes the removal
  region and the removal precedes the diagnostic report, read with `compareDocumentPosition` rather
  than as a CSS property. The browser case *"puts the removal of this device's records below the mail
  it is a record of"* reads rect tops on the built panel. **Arm A10 moved the removal back above the
  message and the case failed on *"the opened message is not above the removal region"*.** The
  two-press confirmation and the empty-area readback are the cases they were — `Panel.test.tsx` is
  **56** and the eight `extension-clear-data` browser cases are unmoved, which is the measurement that
  no behaviour changed.
- [x] 4.4 Render the mailbox's provider through `providerDisplayName`, supplied by `panel-main.tsx`
  from the manager it already builds. Update the panel's heading assertions and keep
  `PANEL_COPY.addressHeading` as the single place that decides the heading's text, now handed a name.

  **Measured.** `panel-main.tsx:93` passes `providerNames={providerDisplayNames(manager)}`, and
  `PANEL_COPY.addressHeading` is now `(provider: string): string => provider` — **the copy module still
  decides the heading's text**, and what changed is that it is handed a name instead of an identifier.
  The browser assertion is `#panel-address-heading` `toHaveText("Mail.tm")`, so the id `mailtm` would
  fail it. **The two surfaces now agree, which is the point**: before this change the panel's own
  failure sentences said *"Mail.tm"* while its most prominent label said *"mailtm"*.
- [x] 4.5 Prove the fallback: a stored mailbox whose provider no adapter in this build declares renders
  that identifier rather than an empty heading. A case must exist, because a fallback no case exercises
  is a fallback nobody has re-read.

  **Measured, and the case is the one the plan predicted would be needed.** `Panel.test.tsx:604` —
  *"names a provider this build no longer offers by the identifier its record carries"* — renders a
  stored mailbox whose provider is not in `providerDisplayNames` and requires the heading to carry the
  identifier. `providerDisplayName` returns `names[id] ?? id`, and **Arm A12 replaced the fallback with
  the empty string and the case failed on `expected '' to be 'guerrilla'`** — which is the shape a
  fallback that answered nothing would produce, and the shape an untested fallback would not have
  reported.

## 5. The opened message

- [x] 5.1 Render `from`, `subject`, `receivedAt` and `readable` in `OpenedMessageView`, above the codes.
  **No new control and no new dependency** — the fields are on the object the component is already
  handed, and the readable text was produced by the extraction the session already ran.

  **Measured.** `MessageSurface.tsx:365–386` renders `message-from`, `message-subject`,
  `message-received-at` and `message-readable` in that order, and the codes and links follow them in
  the same component. **No import was added** — the four values come off `opened.message`, which is
  the object the component already received, and `readable` is the parser's own output. The change to
  `MessageSurface.tsx` is a render and a grid area, not a capability.
- [x] 5.2 Render `readable` as text. Prove it in the unit tier: a body containing `<b>` renders the
  characters `<b>` and produces no `strong` element, and an `onerror`-shaped string produces no image.

  **Measured.** `Popup.test.tsx:830` renders a body that is literally
  `<b>Your code is 493028</b> <img src=x onerror=alert(1)>`; the `textContent` assertion requires the
  **characters** to be on screen and `querySelector("b")` and `querySelector("img")` are both `null`.
  **The text assertion alone would not hold this**, because an escaped rendering and a parsed one have
  the same `textContent` — the two `querySelector` assertions are what fail if somebody reaches for
  `dangerouslySetInnerHTML`, which is the recorded reason they are there.
- [x] 5.3 Prove the claim holds on **both** surfaces from one component: one case renders the popup's
  surface and one the panel's, and both read the same four fields. A popup-only case would pass with
  the panel rendering nothing.

  **Measured, and the two cases read the same four testids.** `Panel.test.tsx:779` and
  `Popup.test.tsx:830` each assert `message-from`, `message-subject`, `message-received-at` and
  `message-readable`, and each asserts document order against what was found inside the message — the
  panel against `code-list` **and** `link-list`, the popup against `code-list`. Both render
  `OpenedMessageView`, so the pair is a check on the one component from two mounts rather than two
  components agreeing by accident. **Arms A06 and A07 removed `readable` and `subject` in turn, and
  each case failed on its own missing field** (`[data-testid="message-readable"]` and
  `[data-testid="message-subject"]`).
- [x] 5.4 Keep the popup's absent clipboard control and the panel's present one exactly as they are.
  This is a reading change, not a capability change, and `MessageSurface.tsx`'s D2 is not reopened.

  **Measured.** `Popup.tsx:408` passes `opened`, `onClose`, `fill` and `onFill` and **no `onCopy`**;
  `Panel.tsx:1243` passes one. `OpenedMessageView` renders the per-code control behind
  `onCopy !== undefined` at `:521`, so the popup's absence is structural rather than a conditional in
  the popup, and the panel's presence is the same seam. **No capability changed**: the popup's
  `Popup.test.tsx` still asserts one fill control per code and no clipboard write, and the panel's
  clipboard cases are unmoved.

## 6. Verification

- [x] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` — each recorded
  separately, because a green build is not a typecheck and a green suite is not a formatted tree.

  **Measured on 2026-11-12, and the first attempt is recorded rather than discarded.** Run
  individually with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory measured to hold **0** entries:
  `typecheck` **0** (8 of 8 projects, every one `tsc --noEmit`), `lint` **0**, `format:check` **0**
  (*"All matched files use Prettier code style!"*), `build` **0** (both clients, `content-script.js`
  at 17.48 kB), and **`test` 1 — three times, on one cause that was not the product**. Every red was
  `Startup Error: the architecture suites changed the tree they read, and the tree they read is the
  shipped tree: changed: openspec/changes/surface-hierarchy/tasks.md`, with **1421 of 1421 tests
  passing**. **The guard was doing its job**: this ledger was edited while the run was in flight, and
  a fingerprint taken before and compared after is exactly the instrument that catches that. **A guard
  that fires on the harness rather than on the product is not a flake and is not rounded to green**,
  so the repair was an order rather than a threshold — finish every write, then start the gate. On the
  frozen tree the five commands then ran in sequence **three times green**, and the `test` step
  reported **1421 passed (1421) across 77 files** in each, with `boundaries.test.ts` at **56**.
- [x] 6.2 `pnpm verify` three times with `PLAYWRIGHT_BROWSERS_PATH` pointed at a directory measured to
  hold no browsers. **Three, not one**, because this repository has twice found a red that a single
  green run could not have reported.

  **Measured: three runs, three exits `0`.** The directory was read immediately before the block and
  held **0 entries**, so the claim that `pnpm verify` needs no browser is a measurement of this run
  rather than an inheritance from the last one. **No edit was made between the runs or during them**,
  which is the property the two reds in 6.1 exist to force: the architecture `globalSetup` fingerprints
  the shipped tree before and after, so a green `verify` is also a statement that the tree held still.
- [x] 6.3 `pnpm test:browser`, and record both tiers' counts against the figures they replace
  (**52 website + 99 extension**). A tier that does not move is a claim that nothing in it was
  affected, and it is recorded rather than assumed.

  **Measured: `58 passed (14.0s)` in the website tier and `106 passed (1.5m)` in the extension tier**,
  against **52** and **99** — so **both tiers moved, and by exactly the cases this change added**:
  `surface-hierarchy.spec.ts` at **4**, `mailbox-history.spec.ts` **8 → 10**, `popup.spec.ts`
  **9 → 13** and `side-panel.spec.ts` **28 → 31**. **The movement is the claim**: six cases in one
  tier and ten in the other, and **no file this change did not touch moved at all**, which is how a
  restyle shows it changed a surface rather than a capability. The per-file figures were read from
  `playwright test --list --reporter=json` and then corroborated by this run, rather than the other
  way round — a `--list` count is a count of cases and says nothing about whether they pass.
- [x] 6.4 Re-measure `pnpm test` from a `--reporter=json` run grouped by project, and reconcile the
  movement per package. **A count that moves without an account of the movement is a count nobody
  re-read.**

  **Measured after the final edit: 1421 tests across 77 files**, from
  `vitest run --reporter=json --outputFile=…` walked by test file and attributed to its package —
  `apps/extension` **500**, `apps/web` **143**, `packages/core` **54**, `packages/mail-parser` **149**,
  `packages/mailbox` **172**, `packages/providers` **92**, `packages/storage` **103**,
  `packages/ui` **49**, `tests/architecture` **159**. **The movement against `1411 across 77` is +10,
  and all ten are in `apps/extension`**: `Popup.test.tsx` 25 → 29 (the four message fields and the
  absent subject's fallback), `Panel.test.tsx` 53 → 56 (the same fields from the panel's mount, the
  removal's order, and the provider fallback) and `provider-config.test.ts` 9 → 12
  (`providerDisplayNames`, `providerDisplayName` and the identifier fallback). **Every other package
  is unmoved, and that is the measurement rather than an absence of work** — a design pass that moved
  `packages/mail-parser` or `packages/mailbox` would have meant the change reached behaviour.
  **`packages/ui` staying at 49 is the one worth naming**: the ninth type role is composed of four
  tokens the layer already declares, so the token layer gained no value and no case.
- [x] 6.5 Falsify every new assertion: a mutation per claim, each restored byte-identical against a
  SHA-256 taken before the first mutation. At minimum — the label step reverted to 22 px; the accent
  returned to `Replace address`; the `@` break removed (so the domain splits); the prose measure
  restored on the row; `text-transform: uppercase` returned (the AX-name case must go red); the
  opened message's `readable` removed; the opened message's `subject` removed; the row's marker
  returned; the report moved back above the address; the removal section moved back above the inbox;
  the provider heading returned to the identifier; the fallback replaced by an empty string. **Each
  mutation names the assertion aimed at it, and a catcher naming an unrelated assertion is recorded as
  a wrong attribution rather than counted.**

  **Measured: 13 arms, and the harness lives outside the repository** at
  `…/Temp/opencode/surface-hierarchy-falsification.mjs` with a `--check` mode, because a measuring
  script left in the root becomes something every future `pnpm lint` has an opinion about — the
  recorded reason `extension-preview`'s harness was deleted rather than fixed. It restores from an
  in-memory copy taken before the first mutation, re-verifies each file's SHA-256, and rebuilds `dist`
  at the end, so a mutation cannot outlive the arm that made it. **Twelve were caught by the
  assertion each was aimed at on the first run**, with the messages naming the claim:
  *"product: the name is not at --type-xs"* (A01), *"the replace control still carries --accent"*
  (A02), *"the address is not split into two text nodes at the @"* (A03), *"the row's item stops short
  of the list"* (A04), *"#create-heading: the name is transformed"* (A05),
  `[data-testid="message-readable"]` (A06), `[data-testid="message-subject"]` (A07),
  *"a message still carries a bullet"* (A08), *"the popup's sections are not in the order it
  declares"* (A09), *"the opened message is not above the removal region"* (A10),
  `expected '' to be 'guerrilla'` (A12) and *"the address is not at --type-2xl"* (A13).

  **⇒ A11 survived, and the cause was the assertion rather than the product — see `design.md` D11.**
  `getByRole(role, { name })` matches the accessible name as a **case-insensitive substring**, and the
  popup's decoy is `"Asking Mail.tm first"` in the status region, so the case asserting the address
  heading read *"Mail.tm"* was satisfied **after the heading had been mutated back to the identifier**.
  The repair reads `#address-heading` **at its own node** and adds a surface-wide `h2`-identifier
  guard; **A11 was then re-run and failed on *"the address region is named by the provider's
  identifier, not by the provider"*, and the positive control was green.** **A13 was added after the
  first run**, because D3 had an assertion and no arm pointed at it — which is the check the tally
  exists for rather than a footnote to it. **The panel's half of A05 and A13 needed no arm of its
  own**: `.popup h2, .panel h2` and `.popup__address, .panel__address` are each **one rule with one
  selector list**, so a mutation reaches both surfaces and a second arm would have been the same arm.
- [x] 6.6 Confirm the eight claims that must **not** move: `page-composition`'s five regions and their
  order, the ten `h2` accessible names, the ~20 region-name assertions, `boundaries.test.ts`'s count,
  `packages/ui`'s count, `manifest.json` byte-identical, and `openspec/specs/` untouched at its
  current count until sync.

  **Measured, and the list is seven rather than eight because two of its items were one claim.** The
  ten `h2` accessible names and the ~20 region-name assertions are the same subject — a heading's
  announced name — and the diff against `8c49349` shows **only rank promotions with identical text
  plus the two declared provider repairs** (`mailtm` → `Mail.tm` on the panel and the popup), which is
  the measurement rather than a reading of the delta. **`PAGE_ORDER` is still
  `["product","steps","reasons","extension","footer"]`** and the per-region sweeps still find five.
  **`boundaries.test.ts` is 56**, unmoved — no rule was added, because every property this change
  introduces already had an instrument or got one in the browser tier. **`packages/ui` is 49**, which
  is the figure `branding-check` and `comment-reader` left it at, and **a rise would have meant visual
  surface no capability describes**. **`manifest.json`'s Git blob hash is
  `847ce07cfff39b00b4461067d12a6ffb0649a4a8`, identical to `main`** — a design pass that moved the
  extension's permissions would be a change to what the extension may do, not to how it looks.
  **`openspec/specs/` is clean at 190 requirements / 629 scenarios / 15 capabilities**, untouched until
  the sync stage.
- [x] 6.7 `openspec validate surface-hierarchy --strict` and `openspec validate --specs --strict`.

  **Both green.** `openspec validate surface-hierarchy --strict` reports the change valid, and
  `openspec validate --specs --strict` reports **15 passed, 0 failed** — the second is the check that
  the promotion at sync has a tree to land in rather than a count it will have to repair.

## 7. Documentation

- [x] 7.1 `DESIGN.md` is task 1. `docs/DESIGN_SYSTEM.md`'s generated region needs no edit **if** the
  prediction holds; if the emitter's input changed, the emitter is re-run and the change is recorded
  rather than hand-edited.

  **The prediction held, and it is a measurement rather than a promise.** `docs/DESIGN_SYSTEM.md` is
  **byte-identical to `main`** — `git status` lists it as unmodified — because the ninth role is
  **composed of four tokens the layer already declared**, so `tokens.ts` gained no value and the
  emitter's input did not change. `packages/ui/src/design-doc.test.ts`'s nine cases pass, including
  the one requiring the committed region to be byte-for-byte what the source renders, so the region
  was not hand-edited either. **`DESIGN.md`'s own frontmatter moved** — nine type roles rather than
  eight — and `tests/architecture/design-record.test.ts` holds that entry to the token layer in both
  directions.
- [x] 7.2 Record in `docs/ROADMAP.md`'s Project Status block what this change did and what it left
  open — the four non-product regions, the in-page control, the report's vocabulary and the panel
  chooser's repeated address.

  **Written into the Project Status block, after *"What that leaves is not a milestone."* and before
  the paragraph that counts the fifteen capabilities**, so the block's own order still reads as a
  ledger rather than as a section. **It records the gap the change repaired rather than the styles it
  wrote** — the ninth role exists because the record had no quiet region name — and it carries the
  measured figures rather than the predicted ones: **1421 / 77**, **58 website and 106 extension
  browser cases**, **boundaries 56**, **`packages/ui` 49**, and **`openspec/specs/` at 190 / 629 / 15
  until the sync**. **The four out-of-scope items are named as four different changes rather than as a
  smaller version of this one**, and the paragraph closes on the limit this repository states
  everywhere: **nothing here was judged by a person**, because no test reads a rendered pixel.
- [x] 7.3 Update `AGENTS.md`'s standing counts from a fresh JSON run, and append the stage's entry with
  its measured figures. **A figure carried forward is a figure nobody checked.**

  **Both halves done from measurements rather than from the previous paragraphs.** The Testing
  headline moved **1411 → 1421 across 77 files** with the movement reconciled per package and
  **`apps/extension` 490 → 500**, its breakdown re-summed rather than adjusted in place
  (25 + 123 + 70 + 23 + 22 + 29 + 56 + 17 + 17 + 9 + 11 + 9 + 12 + 17 + 11 + 7 + 10 + 12 + 5 + 8 + 4
  + 3 = **500**), and the three moved files named with the claim each one holds. **The browser-tier
  block moved 52/99 → 58/106** in four files, the per-file list extended rather than rewritten, and
  **the tier's own re-measurement history extended to four stages**. **The stage entry is at the top
  of the file**, and it records the 13-arm falsification **with A11's substring defect named as the
  finding** — because a tally of thirteen caught arms would have hidden the one arm that had to be
  repaired before it could catch anything.
- [x] 7.4 Leave `openspec/changes/archive/` untouched. Nothing in this change rewrites history.

  **Held.** `git status` lists no path under `openspec/changes/archive/`, and `openspec/specs/` is
  unmodified at **190 requirements / 629 scenarios / 15 capabilities** until the sync stage — the
  archive stage is a later, separate PR.

## Out of scope, recorded rather than done

- The four non-product website regions' share of the page and their composition — their headings are
  in scope, everything else about them is not.
- The in-page shadow-root control's literal accent and its inability to read custom properties.
- The diagnostic report's code vocabulary (`MAILBOX_EXPIRED` in a person's face).
- The panel chooser's label, which repeats the full address to label a choice about it.
- Any copy rewrite. This change moves type, space, grids, order, one control's treatment, and the
  source of one heading's text.
