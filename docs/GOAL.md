# GOAL: SpectreMail — Production-Quality UX Reconstruction and Dynamic Multi-Domain Email System

## Mission

Fix the existing SpectreMail user experience and expand its temporary-email functionality to support multiple genuine, working, free disposable-email domains.

Reference website:
https://temp-mail.org/en/

The attached SpectreMail screen recording is the primary evidence for the current UX defects.

**This is a corrective implementation task, not a request to redesign SpectreMail from scratch.**

Preserve SpectreMail's identity and previously established Temp Mail-inspired UI, but make the application feel as smooth, reliable, coherent, and functional as the reference.

Do not declare the goal complete until the application has been tested through actual browser interactions and the domain integrations have been verified.

---

## 1. Use the Superpowers workflow

Activate the installed Superpowers plugin through OpenCode's available skills interface.

Use the applicable skills:

- `using-superpowers`
- `systematic-debugging`
- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `executing-plans` or `subagent-driven-development`
- `requesting-code-review`
- `verification-before-completion`

Discover the installed skill identifiers rather than assuming every command is available.

The project already has a clear design direction. Brainstorm implementation alternatives and trade-offs, not unrelated visual designs.

Inspect existing repository architecture, specifications, OpenSpec changes, API integrations, components, and tests before implementation.

Update conflicting specifications where necessary, preserving functional and architectural constraints that are still valid.

Create a concrete plan, then execute and verify it.

Do not stop at analysis or planning.

---

## 2. Diagnose the UX problems in the recording

Analyze the attached video carefully.

The following issues must be investigated and corrected.

### Problem A — Poor email address presentation

The email address currently wraps onto multiple lines when its length exceeds the available space.

The Copy confirmation also appears inside the address area, causing visible layout disruption.

**Required behavior:**

- Keep the address readable without breaking the surrounding layout.
- Use a responsive, carefully constrained address container.
- Prefer a single-line address with appropriate truncation or scrolling when required.
- Provide a way to access the complete address.
- Never let clipboard feedback resize the email field.
- Keep the address and Copy control visually stable.

### Problem B — Intrusive copy feedback

Copying an email address currently causes unnecessary text to appear inside the address component.

Replace this behavior with discreet feedback.

Requirements:

- Copy immediately on click.
- Show a small toast, tooltip, or temporary icon-state change.
- Use concise feedback such as "Copied".
- Automatically dismiss nonessential feedback.
- Never change the dimensions of the address field.
- Support keyboard activation and accessible announcements.
- Handle clipboard failures gracefully.

### Problem C — Poor mailbox transition behavior

When Change is used, the UI transitions through awkward loading states.

The inbox can disappear temporarily and content shifts unexpectedly.

Implement a predictable mailbox-switching flow.

Requirements:

1. Indicate when a new address is being generated.
2. Prevent duplicate concurrent generation requests.
3. Keep the page structure stable.
4. Replace the active address only after the new mailbox has been successfully created.
5. Clear messages and message selection belonging to the previous mailbox atomically.
6. Never display a previous mailbox's messages as if they belong to the new one.
7. Preserve the old mailbox if creation fails.
8. Provide appropriate retry feedback.

Use request cancellation or generation identifiers to ensure that stale responses cannot overwrite newer mailbox state.

### Problem D — Broken message reading experience

The recording shows message content expanding below the inbox without a properly structured reading experience.

It also appears that previously opened message content can remain visible after the inbox becomes empty.

Correct this behavior.

Provide a clean message-reader state with:

- Sender
- Subject
- Date received
- Message body
- Verification codes, if found
- Relevant links, if found
- Attachments, if supported
- A clear Back to inbox action

Message details must be displayed within a properly designed reading panel or reference-consistent view.

Do not append an uncontrolled block of raw message text below the table.

When changing addresses, deleting a mailbox, or returning to the empty state, clear obsolete message selections.

### Problem E — Incorrect timestamps

The video shows a message timestamp resembling:

`1970-01-01T00:00:00.000Z`

Investigate whether this originates from missing dates, incorrect units, parsing errors, or legitimate provider data.

Use correctly normalized timestamps and human-readable display.

Never silently convert a missing or invalid timestamp into the Unix epoch.

If a timestamp is unavailable, display an appropriate fallback rather than fabricated information.

### Problem F — Excessive empty space and weak visual hierarchy

The current desktop layout leaves large unused regions and makes the primary email interface feel unnecessarily small.

Re-evaluate:

- Main content width
- Hero dimensions
- Inbox dimensions
- Relative spacing
- Control sizing
- Typography
- Vertical rhythm
- Responsive breakpoints

Match the structural proportions of Temp Mail rather than preserving the current narrow layout.

Preserve the dark SpectreMail identity and purple accent, while retaining the reference's intended separation between the hero, toolbar, and inbox.

Do not introduce new feature cards, explanation panels, statistics, or promotional sections.

---

## 3. Remove unnecessary provider branding

The current header prominently displays:

**Guerrilla Mail**

Remove this prominent provider-name badge from the primary SpectreMail interface.

SpectreMail should present itself as a unified temporary-email application rather than an advertisement for one provider.

The main header should prioritize:

**SpectreMail**

Provider-specific details should be hidden from the normal interaction flow unless they are operationally necessary or required for attribution.

Do not remove legally required attribution.

Do not falsely claim that SpectreMail operates its own independent mail servers.

Once alternative providers are fully working, remove Guerrilla Mail as the default provider if practical.

Do not delete a functioning provider integration before its replacement is verified.

Do not conceal real incoming messages to create the appearance of a different provider.

---

## 4. Investigate Temp Mail's actual domain system

This is a mandatory research and implementation workstream.

The reference website is:

https://temp-mail.org/en/

Temp Mail operates a rotating pool of disposable email domains.

However, possessing a domain name does not grant access to the corresponding mail server or mailbox.

**Do not confuse domain discovery with actual mailbox integration.**

Your task is to investigate whether SpectreMail can legitimately use the free domains exposed by Temp Mail itself.

Research:

1. The currently available Temp Mail domain-management features.
2. The official Temp Mail API and RapidAPI offering.
3. Whether the free domain list is accessible to external applications.
4. The permissions and authentication required.
5. API availability, costs, rate limits, and usage policies.
6. How mailbox creation, inbox retrieval, and message opening work.
7. Whether active domains can be enumerated through an authorized interface.
8. How Temp Mail rotates, removes, or retires domains.

Official starting references:

- https://temp-mail.org/en/api
- https://temp-mail.org/en/faq
- https://temp-mail.org/terms-of-service
- https://rapidapi.com/Privatix/api/temp-mail

Do not confuse `temp-mail.org` with similarly named independent services such as `temp-mail.io`.

Do not use old scraped lists as if they were the current active domain inventory.

Do not reverse-engineer private authenticated endpoints, evade access controls, or bypass rate limits and provider restrictions.

If the official API can legally provide the domain pool and mailbox access, prioritize that integration.

If it cannot, explicitly record the limitation and proceed with documented alternative providers.

Never falsely claim that an alternative provider's domains belong to Temp Mail.

---

## 5. Implement real multi-domain support

SpectreMail must no longer be tied to one hardcoded provider domain.

Implement a dynamic domain catalog populated by integrations that can actually create and access mailboxes.

Investigate these documented services:

### Provider 1 — Mail.tm

Documentation:
https://docs.mail.tm/

Research and implement supported functionality for:

- Fetching available domains.
- Creating addresses.
- Authenticating mailbox sessions.
- Listing messages.
- Reading messages.
- Managing mailbox lifecycle.

Respect attribution, rate limits, and the prohibition on unauthorized API proxying or resale.

### Provider 2 — Mail.gw

Documentation:
https://docs.mail.gw/

Investigate its compatibility with Mail.tm-style APIs and its distinct domain pool.

Implement it only if the intended SpectreMail distribution model complies with its terms.

### Provider 3 — DropMail

Documentation:
https://dropmail.me/api/

Research its GraphQL implementation, domain list, rotating-domain handling, mailbox sessions, and token requirements.

Use current authentication practices.

For a user-facing browser app, investigate the documented OAuth with PKCE rather than embedding one shared application-wide token.

### Provider 4 — Official Temp Mail

Evaluate its authorized API separately.

Integrate only if usable access and appropriate permissions are established.

### Domain catalog requirements

For every integrated provider:

- Fetch available domains from the provider's supported API.
- Include all currently active, usable domains returned by that API, handling pagination where applicable.
- Deduplicate domains.
- Track which provider owns each domain.
- Track domain availability and expiration where provided.
- Refresh cached domain listings appropriately.
- Exclude domains that are inactive, unsupported, or retired.
- Prevent selecting a domain when a mailbox cannot actually be created on it.
- Handle provider downtime and rate limiting.
- Never manufacture addresses by combining random usernames with arbitrary domain strings.

Each mailbox must retain the provider identity, session information, authentication context, and domain necessary to retrieve its own messages correctly.

Domains do not become interchangeable merely because their strings are present in the catalog.

---

## 6. Design a clean domain-selection experience

Preserve the Temp Mail-inspired interface at rest.

Do not add a giant provider-management dashboard to the landing page.

Domain selection should be part of the existing mailbox-change workflow.

When the user selects **Change**, provide a lightweight way to:

- Generate a new random working address.
- Select from currently supported domains.
- Generate an address using the selected domain.
- Return to automatic domain selection.

If necessary, use a small popover or dialog.

Do not clutter the hero with provider names, technical API information, domain-count statistics, or extra cards.

The address itself should remain the primary focus.

Show a concise error when a domain becomes unavailable and allow the user to try another one.

Do not promise that a domain is unblocked by external services merely because it is fresh.

---

## 7. Provider selection, rotation, and fallback

Implement a provider-independent internal interface.

It should support capabilities equivalent to:

- `listDomains()`
- `createMailbox()`
- `getMailbox()`
- `listMessages()`
- `getMessage()`
- `deleteMailbox()` where supported
- `getCapabilities()`

Adapt the interfaces to the repository's existing language and architecture.

Avoid forcing features that an API does not support.

The application's domain-selection logic should:

1. Discover usable providers.
2. Load their current supported domains.
3. Choose an eligible domain.
4. Create a real mailbox.
5. Persist the required mailbox session.
6. Retrieve messages from the exact provider that created it.

If creation fails, retry appropriately using another supported domain or provider.

Do not silently switch providers for an already-created mailbox.

Do not lose access to a valid mailbox because one unrelated provider failed.

Do not introduce unlimited retry loops or aggressive polling.

Use timeouts, bounded retries, backoff, and request coalescing.

For rotating domains, respect provider-reported expiration dates and stop using expired domains for new mailboxes.

---

## 8. Build a predictable mailbox state machine

The app must distinguish these states:

**Initializing → Generating → Ready → Checking → Reading**

Also support error, changing, and deleted/cleared states.

Avoid a collection of loosely related booleans that can produce contradictory UI states.

Requirements:

- Initialization shows a stable loading placeholder.
- Generation cannot be accidentally duplicated.
- Refresh does not unnecessarily blank the existing inbox.
- Reading a message does not destroy or unexpectedly move the inbox.
- Changing a mailbox clears old-message state correctly.
- Deleting/resetting a mailbox follows the actual provider's capabilities.
- Switching domains does not mix sessions.
- Browser reload restores valid state where supported.
- Invalid or expired sessions are recovered gracefully.
- Old asynchronous responses cannot corrupt the active mailbox.

Apply the same state-management principles to the browser extension wherever the underlying code is shared.

---

## 9. Improve the four main controls

Keep the existing toolbar:

**Copy | Refresh | Change | Delete**

Each action needs clear behavior.

### Copy

Immediately copies the current address and shows unobtrusive feedback.

### Refresh

Checks the currently active inbox without destroying its existing layout.

A brief loading indicator can appear inside the Refresh button.

### Change

Generates a new address or allows choosing a supported domain.

Provide clear behavior for the old mailbox's session and messages.

### Delete

Use an appropriately clear destructive-action flow.

If provider-side deletion is supported, perform it.

If only local removal is supported, do not falsely imply the remote mailbox has been destroyed.

When deletion finishes, return to a valid, well-defined application state.

All actions must handle failure, duplicate clicks, keyboard interaction, and asynchronous transitions.

---

## 10. Secure message rendering

Treat received email content as untrusted.

Requirements:

- Sanitize HTML emails.
- Prevent script execution from message content.
- Block dangerous URLs and unsafe rendering behaviors.
- Never automatically open verification links.
- Display extracted OTP codes without silently submitting them anywhere.
- Do not load untrusted remote resources automatically without appropriate protections.
- Do not leak provider session tokens or API keys into public logs.
- Do not embed privileged shared provider keys in browser-distributed code.
- Keep mailbox state appropriately isolated between sessions.

Preserve SpectreMail's existing useful code and link extraction.

Improve its presentation without introducing unrelated visible sections.

---

## 11. Preserve architectural constraints

Inspect the existing repository's browser-only and no-backend requirements.

Prefer supported client-side integrations where technically feasible and permitted.

Before adding a proxy server or backend:

1. Determine whether it is genuinely necessary.
2. Determine whether the provider permits that architecture.
3. Assess CORS, authentication, credentials, quotas, and security.
4. Check existing project specifications.
5. Record the architectural trade-off.

Do not silently add a backend just to force support for a provider.

If a provider cannot safely work within the project constraints, report it as unsupported rather than implementing a fragile workaround.

A smaller set of genuinely functioning providers is preferable to a long list of unusable domains.

---

## 12. Mandatory browser testing

Use the installed browser tools, Chrome inspection, OpenCode Browse extension, or Playwright where available.

Inspect the actual application while performing realistic user flows.

Test these sequences:

**Scenario A — Copy**

Generate address → Copy → Confirm clipboard value → Ensure layout does not shift.

**Scenario B — Refresh**

Generate address → Refresh repeatedly → Ensure inbox remains stable and no duplicate requests corrupt state.

**Scenario C — Change**

Generate address → Change → Verify new mailbox → Ensure old messages are not retained in the new inbox.

**Scenario D — Domain selection**

Open Change → Select an available domain → Generate mailbox → Confirm the exact domain is used.

**Scenario E — Multiple providers**

Create mailboxes using at least two supported providers → Verify each mailbox's requests are routed to its own provider.

**Scenario F — Receive and read**

Send a controlled test email to a newly created mailbox → Confirm receipt → Open it → Verify sender, subject, body, and timestamp → Return to inbox.

**Scenario G — Stale message regression**

Open a message → Change mailbox → Confirm the previous message reader disappears and cannot reappear because of a delayed request.

**Scenario H — Provider failure**

Simulate timeouts, domain retirement, HTTP errors, and rate limiting → Verify truthful feedback and bounded recovery.

**Scenario I — Responsive behavior**

Test at:

- 1440 × 900
- 956 × 885
- 390 × 844

Check overflow, wrapping, clickable targets, message readability, and layout stability.

Repeat important interactions using both mouse and keyboard.

---

## 13. Verification and completion criteria

The goal is not complete just because tests pass.

All of the following must be demonstrated:

- Email address layout remains stable.
- Copy feedback no longer changes layout dimensions.
- Refresh is smooth and does not destroy existing inbox content.
- Change switches mailboxes without stale state.
- Message reading works within a coherent interface.
- Message details disappear when the active mailbox changes.
- Invalid dates do not render as January 1, 1970.
- The Guerrilla Mail badge is no longer prominent.
- The interface remains close to the established Temp Mail reference.
- Domain listings are obtained dynamically from supported providers.
- Every selectable domain can be used to create a real address.
- Incoming messages are retrieved from the correct provider.
- Provider failures are handled predictably.
- No unsafe or unauthorized provider integration has been added.
- Mobile and desktop interactions have been visually tested.
- Existing extension functionality has not regressed.
- All relevant automated checks pass.

Do not claim full Temp Mail domain coverage unless the authorized official source actually provides it and every supported active domain has been accounted for.

Do not substitute mocked responses for required live integration verification.

---

## 14. Required final report

Provide these deliverables.

### A. UX defects and fixes

Describe each verified issue from the recording, its root cause, and the implemented correction.

### B. Domain research

Provide a table containing:

- Provider
- Official API
- Authentication requirement
- Free access status
- Domain discovery support
- Domain count verified at inspection time
- Inbox access support
- Browser-only compatibility
- Usage restrictions
- Implementation status

Distinguish authoritative provider data from third-party historical domain lists.

### C. Implemented domain coverage

Report the actual domains discovered from each connected provider.

Store the dynamic catalog through the application rather than freezing it into a manually maintained source list.

Explain any unavailable or unsupported providers.

### D. Visual verification

Include screenshots demonstrating the corrected UX.

### E. Functional verification

Show browser interaction results and automated test outputs.

### F. Final status

Use one of these outcomes:

- **GOAL MET** — UX and feasible verified provider integrations satisfy the requirements.
- **PARTIALLY MET** — specific visual or functional requirements remain unresolved.
- **BLOCKED** — implementation cannot continue because of a documented external restriction.

For mandatory requirements, do not redefine success to exclude an unresolved issue. Report it explicitly.

## Final directive

SpectreMail should feel like one cohesive temporary-email product.

The user should be able to open the website, instantly obtain a working address, copy it, refresh the inbox, read messages, change addresses, and choose from the genuinely available domains without dealing with provider-specific technical details.

The primary interface should remain visually faithful to Temp Mail.

The backend integration should be modular, reliable, and truthful.

**Do not invent domains. Do not fake mailbox functionality. Do not preserve broken interactions just because they technically work.**

Use Superpowers to investigate, plan, implement, review, and verify the work.

Do not report success without actual browser evidence.
