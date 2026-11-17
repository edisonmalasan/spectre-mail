# Tasks

## 1. Make the fixtures say what was measured

- [ ] 1.1 Repair `guerrillaLiveList`'s envelope in `packages/providers/src/fixtures.ts`:
      the listing echoes the address under `email`, and `email_addr` appears only on
      `get_email_address`. Leave the recorded `list` entry byte-identical.
- [ ] 1.2 Correct that fixture's docblock. It currently claims *"the session's own
      address echoed back"* and *"the echoed address is the only evidence available"*,
      and both are false as written.
- [ ] 1.3 Repair `guerrillaDeadSession` to the measured dead body: a top-level `error`
      string, `auth.success: true` with `error_codes: []`, and **no** `list` and **no**
      `sid_token`. Remove the two invented fields (`sid_token` and
      `auth.session_id: "expired"`) and correct the docblock, which claims *"an empty
      list, no `error`"*.
- [ ] 1.4 Add `guerrillaEmptyLiveList`: the body captured on 2026-11-18 after deleting
      the provider's welcome message, with the address and token normalised to the
      file's own constants and the envelope otherwise verbatim — including `count: 0`
      as a number. Docblock begins `MEASURED` and names the capture date.
- [ ] 1.5 Run `pnpm --filter @spectre-mail/providers test` **before touching the
      adapter** and record the red: which cases fail, on which assertion, and why the
      old code cannot pass them. `fixtures.test.ts` must still report every exported
      fixture labelled, with its count moved by one.

## 2. Reproduce it in the browser tier

- [ ] 2.1 Run the website browser tier with the repaired fixtures and the unfixed
      adapter. Record which case goes red and on what — the tier that observed the
      defect live must be able to see it offline.
- [ ] 2.2 Run the extension browser tier and record whether any case reaches the
      Guerrilla listing path. If none does, say so rather than implying coverage: the
      extension's fallback failure is inferred from shared code.

## 3. Repair the adapter

- [ ] 3.1 Rewrite `sessionIsLive` in `packages/providers/src/guerrilla.ts` to the
      measured signals: a top-level `error` string, a `list` that is not an array, and
      an echoed address that is present and disagrees. An absent address is **not**
      evidence of death. Keep `GuerrillaListResponse` honest about which keys it reads.
- [ ] 3.2 Correct the three shipped statements that repeat the refuted shape: the
      module docblock (`guerrilla.ts:14–17`), the function docblock (`:214–216`), and
      the comment in `guerrilla.test.ts:137–141` that says the recording *"carries no
      `error`"*.
- [ ] 3.3 Rewrite the unit cases: the empty-live case drives `guerrillaEmptyLiveList`
      rather than a hand-built body, the different-address case uses `email`, and a
      case is added for a listing that names no address at all and must stay live.
- [ ] 3.4 Confirm the conformance dead-session case still reaches `MAILBOX_EXPIRED`
      and the `authFailure` slot still satisfies its own case, which asserts only that
      a rejected credential is neither success nor `MESSAGE_NOT_FOUND`.

## 4. Falsification

- [ ] 4.1 Run arms A1–A7 from `design.md` and record the assertion each was caught by.
      Run A8 and record it as a survivor that is the designed result, not as a hole.
- [ ] 4.2 Restore every mutated file byte-identically against a SHA-256 taken before
      the first mutation, and rebuild `dist/` if the browser tier was involved.

## 5. Documentation

- [ ] 5.1 Append the dated correction under `docs/PROVIDERS.md` §3's
      *"HTTP 200, no auth error, empty inbox"* line. Keep the original line; do not
      edit §4.5.
- [ ] 5.2 Record in this file that `docs/PROVIDERS.md` was edited by an explicit task,
      which is the do-not-touch condition the repository requires.

## 6. Gates

- [ ] 6.1 `pnpm verify` — record the exit code and the test count, run on a frozen
      tree. Run it three times; a single green is a fact about one execution.
- [ ] 6.2 `pnpm test:browser` — record the website and extension counts.
- [ ] 6.3 `openspec validate guerrilla-liveness-detection --strict`.

## 7. Live verification in the user's Chrome

- [ ] 7.1 Rebuild, serve, and create a fresh Guerrilla mailbox in the user's browser.
      Confirm the page lists the mail that arrives instead of reporting the address
      gone.
- [ ] 7.2 Confirm the empty arm against the live provider: with the inbox empty, the
      page says the inbox is empty and does not say the address is gone.
- [ ] 7.3 Record the page's own text and the provider bodies observed. Appearance is
      not in scope and no test here reads a pixel.

## 8. Record what moved

- [ ] 8.1 Re-measure `pnpm test` per package and reconcile the delta case by case.
- [ ] 8.2 Record the browser tier's per-file counts.
- [ ] 8.3 State what this change does not establish, from `design.md` D9, without
      softening it.
