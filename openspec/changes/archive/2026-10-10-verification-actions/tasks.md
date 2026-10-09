# Tasks

## 1. A recorded message that carries a verification link

The recorded corpus has a message carrying a code and **no link**
(`guerrillaMessageFetched`'s body is `"<pre>…Your code is 493028</pre>"`), so the page's
new anchor is unreachable in the browser tier from the corpus as it stands. `design.md` D6.

- [x] 1.1 Add a `SYNTHETIC` recorded step to `packages/providers/src/fixtures.ts` carrying a
      message with a verification link. It SHALL be marked `SYNTHETIC` with a comment saying no
      mail from any such service was received, and SHALL use a reserved `.example`/`.invalid`
      domain, following the precedent already in that file (`guerrillaThrottled`,
      `guerrillaUnclassifiable`). Verify: the provider suite passes and a new case asserts the
      marker is present, so the fixture cannot be read as recorded evidence later.
- [x] 1.2 Give `serveRecordedProvider` an option that selects which message step is served,
      defaulting to the existing `fetch_email` step. Verify: `apps/web/e2e/recorded-provider.ts`
      changes shape only additively, and no existing web spec's recorded traffic changes —
      measured by running the existing browser suite before and after, not by reading.

## 2. Copy a detected one-time code

`design.md` D2 and D3. The shape to mirror is `Address.tsx`, and the requirement to satisfy is
`A detected one-time code can be put on the clipboard`.

- [x] 2.1 Render **one copy control per detected code** in `MessageView.tsx`, its accessible
      name naming the value it copies. Verify: a jsdom case asserts one control per code for a
      message carrying two, that each control's accessible name contains that code's value, and
      that activating one places **that code's** value on the clipboard unchanged.
- [x] 2.2 Confirm the copy happened, exactly as the address control does. Verify: a jsdom case
      asserting the confirmation text after a successful write.
- [x] 2.3 Report a refused clipboard rather than appearing to succeed, and leave the code
      visible and selectable. Verify: a jsdom case for the refusal arm, asserting the report is
      shown **and** the code is still in the document's text — the two halves together, because
      the second is satisfied by a page that never cleared the code and the first by a page that
      hid it.
- [x] 2.4 Assert that **opening** a message carrying codes copies nothing. Verify: a jsdom case
      that opens a message with two codes and asserts the clipboard stub was never called. This
      case carries the whole of the removed requirement's surviving half, so it is the one that
      must be falsifiable — see 6.1.
- [x] 2.5 Record the D3 consequence as a case rather than a comment: re-opening the message
      resets each code's copy result to idle. Verify: a jsdom case asserting no confirmation is
      shown after the message is re-rendered without a second copy.

## 3. Reword the footer limit that this slice falsifies

`website-client`'s *"The page's limits are stated in its footer"* is `MODIFIED`: its third
subject — the code-and-link sentence — becomes false the moment 2.1 and 4.1 ship, and a false
sentence in a footer is the one stale claim this repository cannot afford. The list stays five
entries.

- [x] 3.1 Reword the code-and-link entry in `apps/web/src/sections.ts` to state that the page
      copies a code and opens a link **only when asked**, keeping the list at five entries.
      Verify: a case asserts the new sentence is rendered and that `LIMITS.length` is still `5` —
      both halves, because a reword that dropped an entry would satisfy the first alone.
- [x] 3.2 Update the two comments in `sections.ts` that name the removed requirement as this
      bullet's basis, so the file's own documentation does not cite a requirement that no longer
      exists. Verify: no comment under `apps/web/src/` names `shows what it found and does not act
      on it`; checked by grep and recorded here as the check it is.

## 4. Open a detected verification link

`design.md` D4 and D8.

- [x] 4.1 Render a detected link as `<a href={link.url} target="_blank"
      rel="noopener noreferrer">` with the host visible **inside** it and the URL still rendered
      as text beside it. Verify: a jsdom case asserting `href` is the detected URL, `target` is
      `_blank`, `rel` contains both `noopener` and `noreferrer`, the host is in the element's
      text, and the URL text is still present.
- [x] 4.2 Add `.link` to the **existing** `:focus-visible` selector list in `apps/web/src/styles.css`.
      Verify: `packages/ui` is still **38** tests and the stylesheet's token-resolution and
      literal-category assertions still pass — the first because a rise would mean visual surface
      no capability describes, the second because this is the only stylesheet line this slice
      touches.
- [x] 4.3 Add a browser case that opens a message carrying a link and asserts, in Chromium, that
      the rendered anchor has the `href`, `target`, and `rel` above, that the host is visible, and
      that focusing it yields a resolved outline that is **not** the browser's own `auto`.
      Verify: `pnpm test:browser` green; and see 6.1 for the mutation that must fail this case.
- [x] 4.4 Assert that opening a message carrying a link navigates nowhere and requests nothing.
      Verify: a browser case reading `ProviderTraffic.requested` for any URL on the link's host,
      **plus** a negative control that plants a same-origin request to that host and requires the
      reader to report it — without which a sweep matching nothing satisfies the assertion above
      it, and the negative control is what distinguishes the two.
- [x] 4.5 **Invert, rather than add to, the case that asserts the old behaviour.**
      `MessageView.test.tsx`'s *"shows a link as text with its destination host, and does not
      follow it"* asserts a prohibition this slice removes. Its subject stays the same — a link is
      shown with its host and is not followed by rendering — and only the anchor's presence
      changes. Record the supersession in the case's own comment, because a case that flipped
      direction with no note attached is the same defect as a requirement that quietly stopped
      applying. Verify: the case's title still names the property it asserts.

## 5. Retire the two boundary rules that enforced the removed requirement

`design.md` D5. **A rule retired with its requirement is not the same event as a property
dropped**, and the diff shows only the first.

- [x] 5.1 Remove `findCodeClipboardWrites`, `CODE_WORD_PATTERN`, `CODE_COPY_WINDOW`, and
      `DETECTED_LINK_HREF_PATTERN` from `tests/architecture/boundaries.test.ts`, together with the
      assertions that call them. Verify: `pnpm test` green and the boundary count falls by
      **exactly** the number of assertions those rules carried — measured from `--reporter=json`
      grouped by project, never transcribed, and any other movement explained before it is
      accepted.
- [x] 5.2 If the shared harness `clientViolationsWithIntroducedModule` has no remaining caller
      after 5.1, remove it rather than leaving an unused function for `pnpm lint` to complain
      about. Verify: `pnpm lint` exit `0` with no unused-symbol finding.
- [x] 5.3 Re-run the surviving rules' own controls. Two of them fire inside the same harness this
      slice edits, and deleting half a harness is how the other half silently stops being
      exercised. Verify: every surviving rule in that harness still reports its planted probe
      **by name**, and its negative half still reports nothing — both directions, because an
      assertion only proved from one side is a hole.

## 6. Falsification, gates, and documentation

- [x] 6.1 Run a falsification harness **outside the repository tree** over this slice's new
      assertions, with restoration SHA-256 verified per mutated file and `dist/` rebuilt from the
      restored source. The mutations this slice must catch, each attributed to the assertion
      aimed at it: the copy control's name **dropped from the accessible name** (D2's load-bearing
      claim, and the one a control that still copies would pass); the clipboard given a value
      other than the detected one; the confirmation shown on a **refused** write; a write
      performed on open rather than on activation; the `rel` attribute dropped; `target` changed
      to `_self`; the host removed from the anchor's text; the copy control removed from one code
      but not the others. Verify: every mutation is caught by its **intended** assertion, with
      `wrongcatch`, `green`, `nocompile`, `noop` and `harness-error` all zero. **A declared
      catcher that does not compile is not evidence about an assertion** and is reported as its own
      outcome.
- [x] 6.2 Run `pnpm verify` three times with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty
      directory. Verify: exit `0` each time, and the two reds this repository has recorded at this
      stage — `format:check` on files edited since Prettier last ran, and `lint` on a harness left
      in the repository root — are the two that are expected to appear and must be **fixed, not
      counted**. Report the count and the file, not the verdict.
- [x] 6.3 Run `pnpm test:browser` thirty consecutive times in three blocks of ten, counting
      failures. Verify: 30 passed, 0 failed, with the website and extension case counts printed
      per run. The block script's tally and its exit code must agree — a completed block reporting
      `exit 1` with no explanation, and an aborted one reporting the same, is the recorded shape of
      a check that did not run being read as a check that passed.
- [x] 6.4 Record the measured counts in `AGENTS.md`, `docs/ROADMAP.md` and `README.md` — the test
      totals grouped by project from `--reporter=json`, the browser tier's per-file case counts,
      and the boundary count. Verify: every number in those documents came from a run in this
      session; a count that moved after a change is a count that was wrong before somebody
      measured it again.
- [x] 6.5 Run `openspec validate verification-actions --type change --strict` and
      `openspec validate --specs --strict`. Verify: both exit `0`, and the promoted counts are
      unchanged because this stage promotes nothing.
- [x] 6.6 Update the roadmap's Project Status block to record M10 slice 1 as proposed and
      implementing, naming the file or promoted requirement behind each claim. Verify: the block
      is reconciled against `openspec list` and the branch, not against the previous session's
      summary.

## 7. Deliberately not ticked

Recorded here rather than left to look like an omission.

- [ ] 7.1 **Open the page in a browser and look at the copy control and the link.** No test in
      this repository reads a rendered pixel's colour or position, so whether these two controls
      read as right, legible, and consistent with the codes list beside them is a human
      judgement. An agent opening the page is not that judgement, and this task stays unticked for
      the same reason `tasks.md` 11.2 and 12.1 did in earlier milestones.
- [ ] 7.2 **Copy a code with the real clipboard, in a real browser.** `design.md` D7 records this
      as a limit rather than a gap: `navigator.clipboard.writeText` in headless Chromium needs a
      permission this tier does not grant, so the outcome is verified on jsdom and the tier
      verifies only that the control is reachable and named. This is the same shape as the
      recorded `blocked-deleteDatabase` limit — one substrate corroborated, not a general licence.