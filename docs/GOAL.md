# GOAL: Pixel-Accurate Temp Mail UI/UX Reconstruction for SpectreMail

## 1. Primary objective

Reconstruct the complete **user-facing UI/UX of https://temp-mail.org/en/** inside the existing SpectreMail project.

This is a **reference-reconstruction task, NOT a redesign, UI modernization, or creative interpretation task**.

The goal is to make SpectreMail visually and behaviorally match Temp Mail's interface as closely as possible while retaining:

- The SpectreMail name, logo, and identity.
- SpectreMail's purple accent where appropriate.
- The existing temporary-email provider integration.
- Existing working application functionality.
- Existing project architecture and non-UI constraints.

**Priority order:**

1. Reference layout and component structure.
2. Visual fidelity: dimensions, alignment, spacing, typography, backgrounds, borders, and icons.
3. Interaction and navigation fidelity.
4. Responsive behavior.
5. Preservation of existing functionality.
6. SpectreMail-specific branding.

Do not use the existing SpectreMail layout as the visual design reference. It is the implementation that needs correction.

The Temp Mail reference is the visual source of truth.

## 2. Mandatory Superpowers workflow

Use the installed Superpowers OpenCode plugin throughout this task.

Discover and load the relevant skills using OpenCode's native `skill` tool rather than merely mentioning them.

Follow the applicable Superpowers workflows:

- `using-superpowers`
- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `executing-plans` or `subagent-driven-development`
- `requesting-code-review`
- `verification-before-completion`

Treat the reference screenshots and the requirements in this prompt as the approved design direction. Do not substitute an independently brainstormed design.

Before modifying code:

1. Inspect the repository, its requirements, existing UI components, styling, tests, and relevant OpenSpec/OpenSpecX documents.
2. Identify requirements that contradict this goal.
3. Produce an implementation plan describing what must be removed, replaced, preserved, and tested.
4. Execute the plan, then independently verify the result.

If an existing specification says the UI should contain only one Copy control, that constraint is superseded by this new visual-reconstruction requirement. Both reference Copy controls may be implemented, sharing the same underlying clipboard action.

Do not reinterpret the reference design to satisfy outdated UI constraints.

## 3. Mandatory reference inspection

Visit:

https://temp-mail.org/en/

Use the most capable browser-inspection method available in the current OpenCode environment.

Preferred inspection methods:
PREF: USING ORCA BROWSER to easily extract dom elements

1. An already-installed browser automation or browser inspection tool that supports screenshots, DOM evaluation, and interaction.
2. The installed `@reverse-engineer-anything` skill and its MCP tools, if available and configured.
3. A Chrome or Chromium browser controlled using the OpenCode Browse extension, if connected.
4. Playwright or Chrome DevTools Protocol, if available.

Inspect the actual rendered website rather than relying exclusively on HTML source or memory.

If a tool is not available, report that accurately and continue with the best working alternative.

Do not claim to have inspected the live DOM unless inspection actually succeeded. Do not bypass browser security restrictions or site access controls.

### Reference investigation requirements

Capture and inspect:

- Complete page structure and visual hierarchy.
- Header and navigation.
- Branding placement.
- Temporary-email address panel.
- Address input/display and adjacent actions.
- Four-button action toolbar.
- Inbox table and empty state.
- Message listing and message reader.
- Loading, error, and other relevant states.
- Desktop, tablet, and mobile layouts.
- Hover, focus, active, and disabled states.
- Scroll behavior and responsive transitions.

Use DOM extraction and computed styles wherever possible to obtain:

- Bounding boxes via `getBoundingClientRect()`.
- Widths, heights, margins, and padding.
- Font families, sizes, weights, and line heights.
- Borders, radius, backgrounds, shadows, and opacity.
- Alignment and layout rules.
- Breakpoints and viewport-dependent behavior.

Create a reference specification based on actual browser observations.

Do not invent measurements or claim unverified values are exact.

## 4. Required visual structure

The current implementation is visibly incorrect.

Rebuild the main application interface to reproduce Temp Mail's component hierarchy.

### A. Header

Match the reference's header geometry and alignment.

The reference has:

- A dark upper section.
- A centered brand identity.
- Supporting navigation elements on the left and right.
- A consistent content width and horizontal alignment.

Replace the Temp Mail branding with SpectreMail branding.

Do not retain the current header arrangement simply because it already works.

Do not invent fake store listings, subscription products, or destinations. Any nonessential unavailable navigation feature must be identified as an explicit deviation rather than implemented as a dead control.

### B. Temporary email hero

The reference uses a **compact, centered, dashed-border address panel** inside the dark hero region.

The current SpectreMail implementation incorrectly uses a much wider address panel and excessive vertical space.

Reconstruct:

- The positioning and dimensions of the hero.
- The dashed-border container.
- The centered monospaced heading.
- The compact email address pill.
- The small rounded controls adjacent to the address.
- The descriptive text below the panel.
- The spacing between the header, panel, description, and toolbar.

The title should visually match the reference heading:

**Your Temporary Email Address**

Preserve the actual generated email address and clipboard behavior.

Avoid the oversized address text and enormous field currently used by SpectreMail.

### C. Action toolbar

This is mandatory and must not be omitted.

Immediately below the dark hero, reproduce the reference's light-colored horizontal action strip.

It contains four rounded controls:

**Copy | Refresh | Change | Delete**

Each control must have:

- The correct icon treatment.
- Reference-matched sizing and spacing.
- Rounded pill styling.
- Appropriate background and hover states.
- The same visual grouping and relative position as the reference.

All four controls must work.

If the reference contains Copy controls in both the address field and the toolbar, implement both. They should call the same clipboard action.

Do not remove the toolbar because of a previous design requirement.

### D. Inbox

Immediately after the action toolbar, reconstruct the reference inbox presentation.

Required:

- Light inbox section background.
- Centered inbox container.
- Dark table header.
- Three columns: `SENDER`, `SUBJECT`, `VIEW`.
- A correctly aligned message list.
- Reference-style empty state.
- Matching row proportions, borders, spacing, and typography.

When empty, show the reference-style content:

**Your inbox is empty**

Waiting for incoming emails

Use a suitable empty-inbox illustration matching the reference's proportions and visual style.

Do not replace this with a plain paragraph in a generic card.

### E. Message reader

Inspect the actual reference message-opening workflow.

When a message arrives:

- Display it in the corresponding inbox row.
- Preserve the appropriate sender, subject, and view actions.
- Open the message using the same general interaction pattern as the reference.
- Display sender, subject, and message contents clearly.
- Provide reference-consistent navigation back to the inbox.

Preserve SpectreMail's existing code/link extraction functionality, but integrate it without introducing unrelated main-page sections.

### F. Responsive behavior

Do not implement desktop only.

The layout must adapt correctly to smaller screen sizes while preserving the reference's hierarchy.

Inspect the reference's mobile behavior before deciding whether controls should wrap, shrink, or stack.

No horizontal overflow, clipped controls, or unusable address fields are acceptable.

## 5. Remove unrelated content completely

**This is a critical acceptance requirement.**

The current SpectreMail page contains numerous sections that are not part of the reference's main temporary-email interaction.

Remove the existing explanatory and promotional sections from the main application page, including:

- Ready
- How long this address lasts
- What this browser remembers
- Addresses this browser remembers
- What this session did
- What happens, in order
- Why SpectreMail
- The extension, in this browser
- What this page can and cannot do

Also remove the existing verbose instructional paragraphs and unnecessary session-statistic panels.

These must not be moved below the inbox, hidden behind large accordions, or replaced with new informational cards.

The main page should contain only components directly supported by the reference design and required application functionality.

Do not add random headings, feature showcases, privacy explanations, timelines, onboarding cards, statistics, documentation, or marketing copy.

Preserve necessary application logic internally without displaying implementation details throughout the primary UI.

**Every visible component must be justified by an observed reference component or a necessary, explicitly approved SpectreMail-specific function.**

## 6. Preserve existing application functionality

This is a UI/UX reconstruction, not permission to rewrite the application's backend architecture.

Keep working functionality, including:

- Automatic temporary address generation.
- Current provider integration.
- Copy-to-clipboard.
- Inbox retrieval and refresh.
- Message opening and reading.
- Existing verification-code and link extraction.
- Address replacement and clearing where supported.
- Existing session/storage behavior when needed.
- Extension functionality, without adding extension documentation to the website's main page.

Inspect the actual provider capabilities before mapping Change or Delete actions. Do not fabricate provider-side deletion or mailbox expiry behavior.

Use genuine provider responses for production behavior. Mock responses are acceptable in isolated UI tests.

If the provider cannot supply a feature that the reference uses, implement the closest truthful equivalent and document the limitation.

Do not silently replace functional behavior with decorative buttons.

## 7. Visual fidelity is a blocking requirement

Passing unit tests does not prove this goal is complete.

Create a repeatable visual comparison process.

Use the following viewport targets:

- Desktop: 1440 × 900
- Split-window desktop: approximately 956 × 885
- Mobile: 390 × 844

Capture the reference and SpectreMail at identical viewport dimensions, browser zoom, and comparable UI states.

Normalize or mask dynamic email address values when comparing.

For each viewport:

1. Capture a screenshot of Temp Mail.
2. Capture a screenshot of SpectreMail.
3. Compare them side by side.
4. Create an overlay or image difference where possible.
5. Identify visible mismatches.
6. Fix the mismatches.
7. Capture new screenshots.
8. Repeat until all major differences have been resolved.

Inspect and correct:

- Layout geometry and container boundaries.
- Header height and alignment.
- Hero proportions.
- Dashed panel dimensions.
- Email field sizing.
- Toolbar placement.
- Inbox position.
- Table widths and column proportions.
- Typography and text wrapping.
- Icons and button shapes.
- White space, color segmentation, and vertical rhythm.

Target a maximum deviation of approximately 8 CSS pixels for major layout boundaries when measured at matched viewport sizes, excluding documented branding differences.

This numeric target is a tolerance for measured geometry, not a substitute for visual inspection.

The reference's dark-hero/light-toolbar/light-inbox segmentation must be reproduced. Keeping the entire page dark is not an acceptable interpretation of the reference.

Keep SpectreMail's accent color where appropriate, but do not let the existing palette override the reference's layout and structural contrast.

## 8. Mandatory functional verification

Create or update automated tests where appropriate.

Test at minimum:

- Address generation.
- Address rendering.
- Both Copy controls, if present.
- Refresh action.
- Change action.
- Delete/reset action.
- Empty inbox rendering.
- Populated inbox rendering.
- Message opening and returning.
- Loading and error states.
- Responsive layouts.
- Keyboard navigation and accessible labels.

Inspect the rendered UI for unintended elements.

In particular, automated checks should detect prohibited informational headings on the main page.

Run the repository's actual available validation commands, including type checking, linting, tests, and production build where configured.

Record their real outputs.

Do not report success based on commands that were not executed.

## 9. Definition of done — non-negotiable

You are **NOT allowed to declare "Goal met," "Completed," or "Pixel perfect"** merely because:

- Code was committed.
- Tests passed.
- A page rendered.
- The address can be copied.
- The hero vaguely resembles the reference.
- One screenshot was captured.
- An implementation plan was fully checked off.

The goal is complete only when:

1. The reference has been inspected or inspection limitations have been explicitly reported.
2. The main UI structure matches the reference.
3. Unnecessary existing sections have been removed.
4. The four-button toolbar is present and functional.
5. The inbox table and empty state visually match.
6. Main UI workflows function correctly.
7. Desktop and mobile layouts have been reviewed.
8. Reference-versus-local screenshots have been compared.
9. All major visual differences have been corrected.
10. Available automated checks pass without regressions.
11. Any remaining deviations are clearly identified and not incorrectly labeled as complete.

Before reporting completion, invoke the Superpowers `verification-before-completion` workflow and review the implementation against every acceptance criterion.

Use `requesting-code-review` where applicable to independently assess specification compliance and code quality.

## 10. Required deliverables

Provide:

**A. Reference analysis**

A concise breakdown of the actual Temp Mail page structure, observed dimensions, and interaction behavior.

**B. Implementation summary**

Which components were changed, removed, or replaced.

**C. Visual evidence**

Before/after screenshots and reference-versus-local comparisons for the required viewports.

**D. Test evidence**

Actual validation commands and their results.

**E. Fidelity assessment**

A requirement-by-requirement PASS/FAIL report, including unresolved differences.

**F. Final status**

Use exactly one of these statuses:

- **GOAL MET** — all mandatory requirements are verified with evidence.
- **PARTIALLY MET** — the implementation works but mandatory visual or functional differences remain.
- **BLOCKED** — an external limitation prevents required work; identify the blocker and work already completed.

Do not classify missing browser verification as a successful visual comparison.

## Final instruction

**You are acting as a reference-driven frontend reconstruction engineer, not a product designer.**

Stop introducing original UX ideas.

Stop adding content to explain how the product works.

Stop interpreting a broadly similar interface as a complete match.

Use the live reference, DOM measurements, screenshots, working browser interactions, and iterative visual comparisons to reconstruct the interface.

If the current component architecture prevents accurate reproduction, refactor the layout components instead of compromising the design.

Implement, inspect, compare, correct, and verify.

**The task is not finished when the code looks reasonable. It is finished when the interface demonstrably matches the reference and the required behavior works.**
