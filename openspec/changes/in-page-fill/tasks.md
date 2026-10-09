# Tasks

## 1. Recognise a one-time-code field

- [ ] 1.1 Add a content-script module that recognises a one-time-code field from the signals the requirement names — `autocomplete` declaring a one-time code, or a `name`/`id` identifying a code, verification or one-time-password field, or a numeric `inputmode` **together with** such a name or id — and verify by unit cases that a numeric `inputmode` alone is not recognised, that a non-`input` element is not recognised, and that a field declaring itself outranks one identified only by name.
- [ ] 1.2 Record in the module's own note that these signals are a requirement rather than a heuristic, so that recognising a further shape is a spec amendment instead of a silent widening, and verify the note names the requirement it serves.
- [ ] 1.3 Prove the recognition cases can fail — delete the `inputmode`-alone guard, add a positive-control case planting each forbidden signal, and confirm each mutation is caught by the case aimed at it.

## 2. Carry a code to a tab

- [ ] 2.1 Add one request and answer pair to `protocol.ts` for delivering a code to a tab, narrowed on both sides by the existing pattern, with every unrecognised shape becoming `null` rather than an exception, and verify by unit cases on both narrowers.
- [ ] 2.2 Read `chrome.tabs` through the module that already owns the extension's platform global rather than beside it, so the existing boundary rule is worked with and not widened, and verify the boundary suite passes with the rule unchanged and that adding a second reader of the global is reported.
- [ ] 2.3 Discover the target tab with the query `design.md` D1 measured — the active tab of the popup's own window — and refuse to deliver when that yields no tab, rather than falling back to any other tab, and verify by a case where the query returns nothing.
- [ ] 2.4 Verify that no tab the extension did not name is sent anything, by a case that asserts exactly one tab received the delivery when more than one is open.

## 3. Put the code into the field

- [ ] 3.1 Generalise `insert.ts` from an address to a value and update its call sites, keeping the prototype setter, the `input` event and the `change` event in the same order, and verify that the existing address-insertion cases still pass unchanged.
- [ ] 3.2 Add a case proving a controlled input receives an inserted **code** through the same path, so the renamed requirement's single set of scenarios covers both callers rather than the address alone.
- [ ] 3.3 Fill only into a field that is empty at the moment of filling — not the moment it was recognised — and verify by a case where the field acquires text between the two.
- [ ] 3.4 Refuse to fill from a document that is not the top-level one, and verify by a case where a framed document holds a qualifying field.
- [ ] 3.5 Submit nothing: verify that no `submit` event reaches the page, that no control inside the form is pressed, and that the code appears in the field while the page's own submit handler observed no activation.

## 4. Ask when several fields qualify

- [ ] 4.1 When more than one field qualifies and none is preferred, offer the fields as this extension's own control in the page's shadow root, and verify by a case with two qualifying fields that no field is filled before the person chooses.
- [ ] 4.2 When exactly one field qualifies, fill it without asking, and verify by a case with one qualifying field and a negative control asserting the asking control is absent.
- [ ] 4.3 When several qualify and one is preferred by the named signals, put that field to the person rather than filling it unasked, and verify by a case covering both the preferred and the unpreferred arrangement.
- [ ] 4.4 Remove the asking control once the person has chosen or dismissed it, and verify no control outlives its answer.

## 5. Show the codes in the popup

- [ ] 5.1 Render the messages a check returned instead of only their number, and verify by cases that the messages are named and that **no** message is marked as carrying a verification before it has been opened.
- [ ] 5.2 Open a message through the shared session and render the codes found in it, and verify that a message already opened by this session costs no provider request — with a positive control that does issue one, so the zero is a measurement and not an inert assertion.
- [ ] 5.3 Offer a control per detected code rather than one for the top-ranked code, since no detection is ever reported as certain, and verify a case carrying two codes finds two controls.
- [ ] 5.4 Report what the page answered, report an unconfirmed outcome as unconfirmed, and never report a code as filled when no page confirmed it — and verify by a case where the page confirms nothing.
- [ ] 5.5 Declare every new sentence in `popup-copy.ts` rather than inlining it, and verify the website's depiction assertion still resolves every label the preview shows against the popup's own copy.

## 6. Prove it in a real browser

- [ ] 6.1 Add an extension browser case that opens a real action popup, checks the inbox against recorded provider responses, opens a message, and puts a code into a page's `autocomplete="one-time-code"` field on one activation — and verify it fails when the delivery is removed.
- [ ] 6.2 Read the **built** extension's manifest in that case and require that no permission was added, so the requirement is enforced against the artefact that ships rather than the source it was written from.
- [ ] 6.3 Prove the case can fail for the reason it exists: mutate the delivery, the top-frame check, the emptiness check and the asking rule in turn, and confirm each is caught by the assertion aimed at it and not by an unrelated one.
- [ ] 6.4 Run the whole browser tier repeatedly rather than once, and record the run count and the case counts measured from the run rather than predicted.

## 7. Record what this does and does not establish

- [ ] 7.1 Update `AGENTS.md` and `docs/ROADMAP.md` with the observed state, including that a code is available only after a check the user asked for, that per-frame delivery is unmeasured, and that nothing here has run on a real signup page.
- [ ] 7.2 Count the workspace suites from the reporter grouped by project, and confirm `packages/ui` did not move — verifying that number against the run rather than against a figure written down earlier.
- [ ] 7.3 Run `pnpm verify` with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, and record what it proves and what it does not.

## 8. Left deliberately unticked

- [ ] 8.1 **A human opens a real signup page, fills a code, and says whether the flow is right.** Not ticked by an agent: no test in this repository reads a rendered pixel, and the surface under test is somebody else's page and stylesheet.
- [ ] 8.2 **A code is copied with the real clipboard in a real browser.** Not ticked: the clipboard outcome is verified against a stub, and one substrate corroborated is not a general licence.
