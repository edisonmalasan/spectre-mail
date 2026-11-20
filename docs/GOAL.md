# GOAL G2: Unified Provider Experience, Real Email Delivery, and Production UX Verification

## Mission

Advance SpectreMail from a technically functional disposable-email application into a unified, reliable temporary-email service across its website and Chromium extension.

The previous milestone established:

- Website provider: Guerrilla Mail.
- Extension providers: Mail.tm with Guerrilla Mail fallback.
- Live Mail.tm domain discovery.
- Successful real mailbox creation on a selected domain.
- Passing automated browser and unit tests.
- Unverified end-to-end email reception.

The next milestone must resolve these remaining gaps without unnecessarily redesigning completed functionality.

**Primary objective: Enable working multi-domain mailbox creation on the website, align website and extension capabilities, and verify real email reception and reading end to end.**

## 1. Superpowers workflow

Use the installed Superpowers OpenCode skills to manage this milestone.

Discover and invoke the applicable skills:

- `using-superpowers`
- `systematic-debugging`
- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `executing-plans` or `subagent-driven-development`
- `requesting-code-review`
- `verification-before-completion`

Inspect the current repository before making changes.

Review:

- `docs/GOAL.md`
- `docs/superpowers/specs/2026-11-20-provider-domain-research.md`
- `docs/superpowers/specs/2026-11-20-production-ux-final-report.md`
- `apps/web/src/provider-config.ts`
- `apps/extension/src/provider-config.ts`
- `packages/providers/src`
- `apps/extension/e2e/live-domain-selection.mjs`

Identify reusable implementations and avoid duplicating provider logic.

Create a structured implementation plan and execute it.

## 2. Implement multi-domain support on the website

The website currently uses:

`WEBSITE_PROVIDER_IDS = ["guerrilla"]`

The extension supports Mail.tm and Guerrilla Mail.

Investigate whether Mail.tm can be integrated directly into the website using its documented public API.

**Important:** A provider working inside a Chromium extension does not automatically mean it works inside a normal browser page. Verify browser CORS behavior explicitly.

### Requirements

1. Test Mail.tm domain discovery from the actual website origin.
2. Test account creation and token authentication.
3. Test mailbox listing and message retrieval.
4. Verify CORS behavior using the real browser, not just Node.js.
5. Confirm relevant API restrictions and architectural compatibility.
6. Reuse the shared provider adapter wherever possible.

If these operations are supported, enable Mail.tm for the website.

If they are blocked by genuine browser restrictions, document the evidence rather than adding an unauthorized proxy or unsafe workaround.

Do not introduce a backend without an explicit architecture decision.

## 3. Implement unified domain selection

The website should offer the same general domain-selection capabilities as the extension.

Preserve the reference-inspired SpectreMail UI.

The intended user experience:

1. Open SpectreMail.
2. Automatically receive a working temporary email address.
3. Click Change to generate another address.
4. Optionally choose an available domain.
5. Generate a mailbox on that domain.
6. Start receiving email without additional setup.

### Domain requirements

- Discover domains dynamically.
- Do not hardcode domain lists.
- Show only currently usable domains.
- Maintain provider-domain ownership.
- Avoid duplicate domain entries.
- Refresh stale domain information appropriately.
- Handle domain disappearance and provider failures.
- Never display a generated address that has not been successfully provisioned.
- Do not switch providers silently when the user explicitly selected a domain.

Keep the provider implementation details out of the main interface.

Do not prominently display Guerrilla Mail or Mail.tm in the application header, except where required for attribution or operational clarity.

## 4. Complete the missing end-to-end reception test

The previous milestone remains partially verified because no controlled external email was received and opened through the browser.

Resolve this without unnecessarily requiring the user to disclose SMTP credentials.

### Preferred verification methods

**Method A — Local SMTP test configuration**

If approved test SMTP credentials or a sending endpoint are already configured, use the existing test infrastructure.

Load credentials from local environment variables.

Never print, commit, or expose credentials.

**Method B — Manually sent test email**

If no sending service is configured:

1. Create a fresh mailbox using a selected active domain.
2. Present the generated address to the user.
3. Allow the user to send a test email from their own email application.
4. Continue verification when the email arrives.
5. Open the received message.
6. Verify all parsed fields and message content.

Do not request the user's personal email password, SMTP password, or API token in chat.

### Test message

Subject:

`SpectreMail E2E Verification`

Body:

`SpectreMail delivery verification. Test code: 482731. Test link: https://example.com/verify`

Verify that SpectreMail correctly displays:

- Sender address
- Subject
- Received timestamp
- Message body
- Extracted verification code `482731`
- Extracted verification URL

Verify that the actual message was retrieved from the mailbox's provider and was not inserted through a mock fixture.

If no external sender is available, preserve the test as pending. Do not misrepresent mocked delivery as successful live reception.

## 5. Improve mailbox state transitions

Audit the actual website and extension using interactive browser testing.

Focus on:

### Address generation

- No duplicate generation requests.
- No unnecessary layout shifts.
- No unexpected provider switching.
- No stale addresses.
- Clear loading and failure states.

### Inbox refresh

- Keep existing messages visible during refresh.
- Do not reset the entire view unnecessarily.
- Prevent overlapping network responses from corrupting state.
- Display meaningful feedback when requests fail.

### Message opening

- Proper message reader.
- Correct sender, subject, and date.
- Safe email body rendering.
- Correct verification-code extraction.
- Working Back to inbox navigation.

### Mailbox replacement

- Remove obsolete message selections.
- Prevent old requests from repopulating a new mailbox.
- Preserve the previous valid mailbox if replacement fails.

Use explicit mailbox state transitions rather than disconnected loading flags where appropriate.

## 6. Make the website and extension consistent

The website and extension must follow the same underlying rules for provider selection, mailbox creation, message retrieval, and error handling.

Reuse shared logic rather than writing two unrelated implementations.

Where possible, share:

- Provider interfaces.
- Domain discovery.
- Mailbox session models.
- Message normalization.
- Date parsing.
- OTP extraction.
- Link extraction.
- Retry and timeout policies.
- Error classification.

The two interfaces may differ visually because the extension has limited space.

However, equivalent actions should produce predictable, consistent results.

Do not force unsupported provider behavior into a shared abstraction.

## 7. Preserve UX fidelity

Do not use this milestone as an excuse to redesign the application.

Maintain the existing Temp Mail-inspired component hierarchy:

- Header
- Temporary address panel
- Four-button action toolbar
- Inbox table
- Message reader

Keep SpectreMail's own branding.

Do not add documentation sections, session statistics, promotional cards, provider dashboards, or unnecessary explanatory copy to the homepage.

Domain selection should remain a lightweight part of the existing Change interaction.

Keep loading feedback compact and prevent major page movement during routine operations.

## 8. Real browser test scenarios

Verify the following with Playwright, Chrome, or the available OpenCode browser tools.

### Scenario A — Website domain creation

Select a live available domain and create a mailbox.

Verify that the address is genuinely associated with the selected domain.

### Scenario B — Extension domain creation

Repeat the existing live extension domain-selection test to ensure no regressions.

### Scenario C — Actual email reception

Receive and read a real external test email.

Verify sender, subject, body, timestamp, code, and link.

### Scenario D — Mailbox switching

Open an email, change addresses, and verify that stale messages cannot reappear.

### Scenario E — Provider errors

Simulate unavailable domains, network failures, expired sessions, and rate limits.

Verify graceful recovery.

### Scenario F — Browser reload

Reload the website and extension.

Verify that supported mailbox sessions restore correctly.

### Scenario G — Responsive UX

Test at:

- 1440 × 900
- 956 × 885
- 390 × 844

Check layout stability, address readability, action controls, and message-reader behavior.

## 9. Security and architecture

Preserve the project's existing privacy and architecture requirements.

- Do not commit secrets.
- Do not expose privileged provider tokens.
- Sanitize untrusted email HTML.
- Prevent untrusted scripts from executing.
- Do not automatically follow links inside received emails.
- Do not introduce unsafe CORS workarounds.
- Respect provider rate limits and terms.
- Keep mailbox sessions isolated.
- Use provider-supported operations only.
- Do not claim to delete remote mailboxes when only local session removal is possible.

Document unavoidable differences between website and extension capabilities.

## 10. Acceptance criteria

This milestone is complete only when:

1. Website Mail.tm compatibility has been tested in an actual browser.
2. Mail.tm has been enabled on the website if genuinely supported under current constraints.
3. The website domain-selection UX is functional for all enabled multi-domain providers.
4. Extension domain selection continues working.
5. A real mailbox can be created using an available domain.
6. A real incoming email has been retrieved and opened, or the missing external sender is explicitly recorded as a blocking dependency.
7. Message timestamps and extracted content are correct.
8. Mailbox replacement does not leak stale message state.
9. Browser reload and failure recovery work as intended.
10. Relevant tests, builds, linting, type checks, and repository boundary checks pass.
11. Visual browser inspection confirms the interface remains consistent with the reference.
12. No existing functionality has regressed.

An unavailable external sender cannot be treated as successful end-to-end delivery verification.

## 11. Final deliverables

Provide:

**A. Provider compatibility report**

Explain which providers function on the website and extension, with tested evidence.

**B. Domain catalog report**

Report the live domains returned by supported APIs during verification, including retrieval time.

**C. Functional implementation summary**

List changes made to provider adapters, domain selection, mailbox sessions, and message reading.

**D. Live delivery evidence**

Report whether a genuine incoming email was received, opened, and parsed correctly.

**E. Screenshots**

Show desktop, mobile, domain selection, populated inbox, and message reader.

**F. Validation results**

Report actual commands executed and their outputs.

**G. Remaining limitations**

Clearly identify unsupported providers, architectural restrictions, and incomplete verification.

**H. GitHub delivery**

If the repository's existing workflow permits it, implement on a feature branch, open a PR, complete required CI checks, and merge after verification.

Do not bypass failing checks or merge unresolved mandatory defects.

## Final directive

Prioritize functional completeness and user experience rather than increasing the number of providers for appearance's sake.

One functioning domain that can receive and display real emails is more valuable than twenty unusable domains.

The desired outcome is a unified SpectreMail experience where a user can create an address, choose an available domain, receive email, read messages, and switch mailboxes confidently across both the website and extension.

Use Superpowers to plan, implement, test, review, and verify.

**Do not declare GOAL MET without evidence of the required end-to-end behavior.**
