# Tasks

## 1. Spike scaffold and probe runner

- [x] 1.1 Create `tests/provider-spike/` with its own `package.json` (Node ESM, `playwright` pinned exactly, no workspace membership) and verify `pnpm --dir tests/provider-spike install` succeeds
- [x] 1.2 Add `.gitignore` at the repository root covering `node_modules`, spike run output, and Playwright browser downloads, and verify `git status` stays clean after a spike run
- [x] 1.3 Implement the probe runner that records every probe as `passed | failed | unsupported | unverified` with a detail string, never aborting the run on a single failure, and verify a synthetic failing probe still lets later probes run and still prints a summary with the four outcome counts
- [x] 1.4 Implement the run-result writer that emits a machine-readable JSON artifact plus a human-readable summary, and verify both files are produced from one run

## 2. Mail.tm lifecycle probes

- [x] 2.1 Implement Mail.tm probes for domain discovery, account creation, token issuance, `me`, and message listing, and verify the run reports a real address and a bearer token length
- [x] 2.2 Implement Mail.tm probes for message fetch, message-list pagination past the end, and the `404` error body for an unknown message, and verify each recorded outcome matches the live response
- [x] 2.3 Implement the Mail.tm mailbox-deletion probe against the real hydrated resource URL and verify the account is unusable afterwards
- [x] 2.4 Implement the Mail.tm error-handling probes for invalid payload validation and wrong-password authentication, and verify the recorded status codes
- [x] 2.5 Implement the Mail.tm rate-limit probe that records the advertised `ratelimit-policy` header, and verify account-creation calls are serialised so the advertised budget is respected
- [x] 2.6 Implement the Mail.tm real-time probe over SSE candidate endpoints and a WebSocket candidate, and verify a negative result is recorded as a verified absence with the observed status codes
- [x] 2.7 Document the Mail.tm findings in `docs/PROVIDERS.md` from the recorded run, including endpoints, auth model, the creation rate limit, the absence of real-time delivery, and observed error shapes

## 3. Guerrilla Mail lifecycle probes

- [x] 3.1 Implement the Guerrilla session and address probes, recording that the session token is returned in the response body and whether cookies are required when no cookie jar is used, and verify the recorded result
- [x] 3.2 Implement the Guerrilla message-listing and message-fetch probes including a real message returned by the provider, and verify the recorded sender, subject, and content-type
- [x] 3.3 Implement the Guerrilla session-expiry and re-obtain probes, and verify the recorded behaviour when a stale session token is reused
- [x] 3.4 Implement the Guerrilla send-capability probe that records the captcha requirement, and verify it is reported as an observed provider limitation rather than a spike failure
- [x] 3.5 Document the Guerrilla Mail findings in `docs/PROVIDERS.md` from the recorded run, including endpoints, session model, raw-HTML content shape, captcha-gated sending, and observed browser-relevant headers

## 4. Browser-environment probes

- [x] 4.1 Build the throwaway MV3 extension fixture with provider host permissions under a generated temp directory, and verify the manifest is produced and its declared permissions are exactly the provider origins under test
- [x] 4.2 Implement the normal-web-page probe that issues the provider requests from a real page origin in headless Chromium, and verify the result distinguishes an allowed request from a CORS-blocked one
- [x] 4.3 Implement the preflight probe that issues a non-simple provider request so the preflight outcome is recorded separately from the request outcome, and verify both are present in the run artifact
- [x] 4.4 Implement the extension-context probe that loads the MV3 extension and issues the same requests from the extension service worker and an extension page, and verify the extension result is recorded separately from the normal-page result
- [x] 4.5 Make the browser probes report themselves `unverified` with the install or launch reason when Chromium is unavailable, and verify the run still completes and the summary shows the browser checks as unverified
- [x] 4.6 Document the browser and CORS findings per provider and per environment in `docs/PROVIDERS.md`, and verify every claim traces to a recorded result

## 5. Real external delivery check

- [x] 5.1 Implement the pluggable sender that reads SMTP or HTTP send configuration from environment variables without persisting credentials, and verify a run with no configuration reports delivery as `unverified` naming the missing capability
- [ ] 5.2 Implement interactive delivery mode that prints the live created address and polls until an inbound message appears or the timeout elapses, and verify the timeout path records `unverified` and preserves the address in the report — **implemented, timeout path observed as `unverified` in run `2026-10-01T17:20:33-861Z`, but the success path is still unexercised because no real message has been sent**
- [ ] 5.3 Execute the delivery check for real — using a configured sender if one is available, otherwise interactive mode completed by the maintainer — and verify the run artifact contains an observed inbound message with sender, subject, and a redacted body excerpt — **BLOCKED: needs a maintainer-sent message or a sending credential**
- [x] 5.4 Record the delivery outcome in `docs/PROVIDERS.md` as verified or explicitly unverified, and verify no unverified step is worded as a pass

## 6. Project documentation and roadmap reconciliation

- [x] 6.1 Add a root `README.md` covering what SpectreMail is, current development status, the verified spike command, project structure, and the privacy model as it stands today, and verify every command shown was actually executed
- [x] 6.2 Add a `Project Status` block to `docs/ROADMAP.md` recording M0 as in progress with the run date, and verify it names the evidence produced so far
- [x] 6.3 Update `docs/ROADMAP.md` with every M0 finding that contradicts a planning assumption, its effect on later milestones, and the resulting gate decision, and verify the original assumption is not left standing unannotated
- [x] 6.4 Add `tests/provider-spike/README.md` explaining that the harness is disposable, that nothing may import it, and that M1 and M3 are responsible for retiring it, and verify the file states all three points
- [ ] 6.5 Re-run the full spike from a clean state and verify the recorded summary matches the summary quoted in `docs/PROVIDERS.md` — **BLOCKED on 5.3: the quoted summary must be the one that includes the real-delivery result, so re-running now would only re-confirm `unverified`**
