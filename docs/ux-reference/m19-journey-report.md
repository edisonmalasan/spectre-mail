# M19 — User journeys and live mailbox integrity

Date: 2026-11-21. Evidence from the current tree (`main` at `2336786`, branch `test/m19-user-journeys`).

## A. Browser journey evidence

| Journey                                    | Instrument                                                    | Result                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Address generation on first visit          | website unit + browser suites                                 | PASS — provider-confirmed address rendered with `data-testid="ready"`                                                           |
| Copy from field and toolbar, layout stable | `App.test.tsx`, `surface-hierarchy.spec.ts`, `motion.spec.ts` | PASS — both call one clipboard helper, field box unchanged, 150ms fade                                                          |
| Refresh keeps existing inbox               | `Inbox.test.tsx`, `motion.spec.ts`                            | PASS — row DOM identity survives a later poll, no re-materialisation                                                            |
| Change clears stale message state          | `App.test.tsx`, `MessageView.test.tsx`, `recovery.test.tsx`   | PASS — generation token rejects stale responses; previous mailbox kept until success                                            |
| Delete is device-side, truthful            | `storage.spec.ts`, `recovery.test.tsx`                        | PASS — `indexedDB.databases()` empty; no claim of remote deletion                                                               |
| Message open / Back / reader               | `MessageView.test.tsx`, `verification-actions.spec.ts`        | PASS — reader replaces inbox, inbox kept mounted hidden, codes/links extracted and acted on only by user                        |
| Domain selection on extension              | `live-domain-selection.mjs`                                   | PASS live — chose `@euploading.com` from Mail.tm's live `domains`; created `cvbrg7mqc29d@euploading.com`; only Mail.tm requests |
| Website provider truth                     | `live-domain-selection.mjs --website-cors`                    | PASS — all Mail.tm operations CORS-blocked from the website origin; Guerrilla remains the website provider                      |
| Responsive 1440/956/390                    | `pnpm test:browser` + `spectre-*.png` captures                | PASS — no horizontal overflow, address single-line/clipped, toolbar 2×2 on mobile                                               |
| Extension regressions                      | extension browser tier                                        | 108–109/109; load-driven live-domain flakes pass in isolation, recorded honestly                                                |

## B. Live reception — **BLOCKED on an external sender, explicitly**

The credential-free harness `apps/extension/e2e/live-reception.mjs` was run on this tree:

- `--prepare` created a **real** mailbox `jipv3ag3hbm2@euploading.com` on the live domain
  `euploading.com` through Mail.tm, with requests `GET /domains`, `POST /accounts`, `POST /token`.
- `--verify` reopened the same profile and reported:

```json
{
  "status": "PENDING",
  "checks": { "restoredAddressMatches": true },
  "note": "No message has arrived yet. Send the test email, then re-run --verify."
}
```

No external sender is configured (`SPECTRE_SPIKE_SMTP_*` and `SPECTRE_SPIKE_SEND_URL` unset), Mail.tm
is receive-only, and Guerrilla's send endpoint requires a captcha. The goal directs that this be
recorded as pending rather than claiming mocked delivery as live. The test itself is complete: when
a message is sent to the prepared address, `--verify` will check sender, subject, timestamp, body,
code `482731`, link `https://example.com/verify`, and that the listing came from Mail.tm.

## C. Provider and architecture integrity

- No proxy, backend, API key or shared token added.
- No provider silently switched for a chosen domain: the manager skips providers that do not own it.
- Message rendering stays a text `<pre>`; links are real anchors with `noopener noreferrer`; no
  automatic OTP submission or link navigation.
- Extension layout untouched; website and extension share provider/session/message contracts.

## D. Verdict

All in-scope journeys have browser evidence. Live reception is an explicitly recorded external
blocker, which M19's exit gate permits. M20 is the next milestone.
