# AGENTS.md



## Project overview



<!--

Describe the project explicitly. Do not make the agent guess the product,

architecture, purpose, or current state from repository files alone.



For brownfield, migration, preservation, reconstruction, or replacement

projects, describe what the existing implementation represents and what must

remain preserved during development.

-->



[PROJECT_NAME] is [PROJECT_DESCRIPTION].



[Describe the current implementation, existing system, or starting point.]



[Describe the intended architecture, migration path, or target state.]



<!--

Example for a migration / reconstruction project:



The existing [LEGACY_IMPLEMENTATION] is the reference implementation,

behavioral oracle, protocol specification, data corpus, content source, and

asset archive.



The migration path is:



    [LEGACY / CURRENT STATE]

        →

    [INTERMEDIATE / COMPATIBILITY STATE]

        →

    [TARGET STATE]



Do not treat the legacy repository as disposable code.



Remove or adapt this paragraph when the project is not a migration,

reconstruction, preservation, or brownfield project.

-->



---



## Stack



<!--

List it explicitly. Don't make the agent guess or infer from package.json,

go.mod, Dockerfiles, etc. alone.



Remove fields that do not apply and add project-specific fields when required.

Pin versions when exact versions matter.

-->



- Language(s): JavaScript (ESM, `.mjs`) — the only language currently in the repository.
  TypeScript is required by the roadmap for `apps/*` and `packages/*` but is not installed yet.

- Framework(s): none installed. The roadmap targets React + Vite for the website
  and React + Manifest V3 for the extension; neither exists yet.

- Runtime(s): Node.js `v26.10.0` (verified).

- Frontend / client: none yet.

- Backend / server: none. Intentionally `$0` paid backend infrastructure; see
  `docs/PROVIDERS.md` for why a SpectreMail-operated proxy is not a permitted
  workaround for Mail.tm.

- Database / storage: none yet. Roadmap target is IndexedDB in the web client and
  extension storage in the extension, behind a shared `SpectreStorage` contract
  (milestones M5–M6).

- ORM / data access: none yet.

- Package manager: pnpm `12.6.0` (verified). A pnpm workspace is **not** initialised
  yet — that is milestone M1.

- Build tooling: none installed. Roadmap target is Vite (web) and an extension build
  step (M1/M8).

- Testing: a disposable Node.js probe harness at `tests/provider-spike/`
  (`node:test`-free, hand-rolled, with a self-test at
  `pnpm --dir tests/provider-spike spike:selftest`). Vitest and Playwright-as-test-runner
  are roadmap targets for M1 and are not installed. Playwright `1.63.0` **is**
  installed as a spike-only dev dependency for browser-context probes.

- Infra / deploy: none. No CI workflow exists yet (roadmap M1 task).

- External services: `https://api.mail.tm` and `https://api.guerrillamail.com`.
  Both are exercised live by the M0 spike. See `docs/PROVIDERS.md` for measured
  behaviour, rate limits, and terms.

- Specification workflow: OpenSpec `1.13.2` (verified CLI version)

- Optional later infrastructure: none. Any own-domain mail infrastructure is
  explicitly a M15 decision, not a V1 requirement.



<!--

For migration / brownfield projects, additional fields may include:



- Legacy server:

- Legacy storage:

- Legacy client:

- Modern client:

- Compatibility layer:

- Target server:

- Target database:

-->



## Frontend design skills



The installed Taste skills under `.agents/skills/` define durable frontend design and implementation guidance for this project.



### Required skill usage



For frontend, UI, UX, visual-design, or styling work, use the installed skills in this order:



1. `design-taste-frontend`
   - Use as the default frontend design-quality and anti-slop baseline.
   - Apply its rules for hierarchy, spacing, composition, visual consistency, responsive behavior, accessibility, and avoidance of generic AI-generated UI patterns.
   - Use it for every nontrivial frontend design or redesign task.



2. `minimalist-ui`
   - Use as SpectreMail's primary visual-style skill.
   - Favor restrained composition, strong typography, generous negative space, clear information hierarchy, minimal decoration, and functional interfaces.
   - Keep the interface quiet, precise, trustworthy, technical, and product-focused.



3. `industrial-brutalist-ui`
   - Use only as a **secondary structural influence**, not as SpectreMail's full visual style.
   - Borrow compatible Swiss / International Style qualities such as strong grids, typographic hierarchy, asymmetrical balance, precise alignment, crisp borders, and confident structural contrast.
   - Do **not** let this skill turn SpectreMail into a harsh, intentionally ugly, cyberpunk, hacker-themed, or full-brutalist interface.
   - When this skill conflicts with `minimalist-ui`, the approved SpectreMail design direction, or the project design system, prefer the restrained SpectreMail direction.



4. `full-output-enforcement`
   - Use for frontend implementation tasks to ensure requested work is complete rather than partially scaffolded.
   - Do not leave placeholder sections, fake UI, TODO-only implementations, unfinished interactions, omitted responsive states, or knowingly broken visual states unless the active task explicitly scopes them out.
   - Complete the requested slice end-to-end while still respecting Change scope and OpenSpec boundaries.



### SpectreMail visual direction



The approved project visual direction is **Spectral Swiss Utility**.



Use:



- Swiss / International Typographic Style as the structural foundation.
- Minimalism as the dominant visual treatment.
- Strong modular grids and deliberate alignment.
- Large, clean grotesk typography for primary interface text.
- Monospace typography selectively for email addresses, OTP codes, provider state, and technical metadata.
- Generous whitespace and restrained density.
- Thin or precise borders instead of heavy depth effects.
- A mostly neutral palette with one restrained spectral-violet accent.
- Functional Bento-like grouping only where real application state benefits from modular blocks, such as inboxes, mailbox lists, or provider status.
- Subtle materialize/disappear motion for mailbox creation, incoming messages, and OTP appearance.
- Clear interaction states, keyboard focus, responsive behavior, and accessible contrast.



Avoid:



- Generic AI-SaaS landing-page composition.
- Purple mesh gradients, decorative gradient blobs, or unrelated color accents.
- Giant centered hero copy with a badge, two generic CTA buttons, and three equal feature cards by default.
- Excessive rounded cards, pills, floating glass panels, or glassmorphism.
- Putting every piece of content inside a card.
- Decorative dashboards, fake graphs, fake statistics, or fake product UI.
- Fake terminals, Matrix/cyberpunk styling, glitch effects, or stereotypical hacker aesthetics.
- Cartoon-ghost overload or novelty decoration that reduces trust.
- Random floating shapes, decorative status dots, meaningless labels, and ornamental section numbering.
- Heavy shadows, excessive 3D effects, or animation without functional purpose.
- Inconsistent radius, spacing, border, typography, or color systems.
- Copying a Taste skill's stylistic extremes when they conflict with the approved SpectreMail identity.



### Design authority and conflicts



For frontend design decisions, use this precedence:



1. Explicit user/task requirements.
2. Approved active OpenSpec design requirements.
3. `docs/DESIGN_SYSTEM.md` and other approved project design documentation when present.
4. Existing approved SpectreMail UI patterns.
5. `design-taste-frontend`.
6. `minimalist-ui`.
7. Compatible structural guidance from `industrial-brutalist-ui`.



`full-output-enforcement` governs implementation completeness, not product scope. It must never be used to expand an OpenSpec change, add unrelated features, or override Change scope.



Taste skills do not override architecture, security, privacy, testing, provider, Git/PR, OpenSpec, or repository-boundary rules in this file.



Do not manually edit the installed generated skill files under `.agents/skills/`; update or replace skills through their supported installation/update workflow.



---



## Architecture rules



<!--

Define durable architectural constraints here.



Keep rules explicit. Do not rely on the agent to infer architectural boundaries

from the current implementation alone.



Replace the placeholders below with project-specific architecture rules.

Remove only rules that genuinely do not apply.

-->



- Follow the project's primary architectural sequence: ****[ARCHITECTURAL SEQUENCE / PRINCIPLE]****.

- Keep the existing/reference implementation operational until its required behavior has verified replacements when performing migration or replacement work.

- Do not rewrite multiple major system boundaries simultaneously unless the approved change explicitly requires it.

- `[CLIENT / CONSUMER]` code must depend on `[ABSTRACTION / SERVICE INTERFACE]`, never directly on `[LEGACY / LOW-LEVEL IMPLEMENTATION DETAIL]`.

- Build `[INTERMEDIATE / COMPATIBILITY IMPLEMENTATION]` before `[TARGET IMPLEMENTATION]` when staged replacement is required.

- Preserve externally meaningful IDs; modern storage may add internal IDs but must retain `[LEGACY / EXTERNAL ID FIELD]` where compatibility requires it.

- Separate static definitions from runtime/player/entity state where applicable, e.g. `[DefinitionType]` vs `[InstanceType]`.

- Production server actions are authoritative when the architecture is server-authoritative: clients send intent, never trusted resource/XP/HP/result deltas.

- Standard HTTPS/JSON is the default for ordinary request/response APIs. Add WebSockets or another real-time transport only for genuinely real-time behavior.

- Archived/reference assets or runtimes may remain under preservation paths but must never silently become modern runtime dependencies.

- Keep transport, domain logic, persistence, and presentation boundaries explicit.

- Do not bypass an established abstraction merely because direct access is easier.

- All temporary-mail provider access goes through the provider abstraction. Presentation code must never interpret a provider's HTTP response or contain a provider JSON field name. See the `provider-abstraction` capability.

- Provider roles are assigned per client, not globally. The website uses Guerrilla Mail only; the extension uses Mail.tm primary with Guerrilla Mail fallback. Do not add a provider to a client whose environment cannot legally or technically reach it.

- **Never proxy a provider API.** Do not relay a provider through a SpectreMail-operated server, or any other intermediary, to work around a provider's CORS policy or origin restriction. This is a policy of the product, not a terms-compliance judgement: Mail.tm grants no CORS to third-party origins, so the correct response is to exclude it from the website, not to add a backend. Note that no Mail.tm terms page could be located, so no terms-derived justification may be cited for any provider decision.

- **Do not cite provider terms that were not verified.** Where a provider's terms could not be located, do not quote them, do not rely on them for an architectural decision, and do not assume a required obligation is absent. Mail.tm publishes **no terms page** (verified 2026-10-02); attribution, resale, and quota obligations are therefore all unverified in both directions.

- Do not trust a provider's declared message content type, and never render raw message content as HTML. Guerrilla Mail was measured returning `content_type: "text"` with an HTML body, and its real delivered message arrived as raw HTML. Only Mail.tm's delivered message has been observed as plain text, so the plain-text case is **not** evidence that Mail.tm's content typing is trustworthy either.

- Do not depend on a provider push transport that has not been verified against the live API. Mail.tm advertises SSE and serves none; message retrieval is adaptive polling.

- Surface provider throttling to the user rather than silently retrying or queueing. Mail.tm caps account creation at `1; w=60`.

- Do not assume a mailbox or session has a known lifetime, and do not derive a countdown from provider documentation. Mail.tm publishes a 7-day message retention and states a mailbox lasts until deleted, but neither value appears in any API response and neither was measured live; Guerrilla publishes nothing equivalent. Expiry must follow an observed signal, never an elapsed guess.

- Extension manifest host permissions for provider origins must use the wildcard path form (`https://api.example.com/*`). A slash-less pattern (`https://api.example.com`) is silently a no-op and must be covered by a test that exercises the declared pattern.

- Avoid shared mutable global state unless explicitly required and documented.

- Cross-cutting services must stay focused on their defined responsibility.



<!--

Keep or adapt this example for authoritative systems.

Remove it if the project does not use an authoritative server.

-->



```python

# Good: client sends intent.

perform_action(actor_id, action_id, target_id)



# Bad: client dictates authoritative outcome.

apply_client_state(resource=999999, progress=5000)

```



---



## Setup & commands



<!--

Document commands that were actually executed successfully for this repository.



Do not invent commands.



Replace every placeholder below with verified commands as the project develops.

Delete sections that genuinely do not apply.

-->



Current entry point:



```bash

pnpm --dir tests/provider-spike spike

```

There is **no application to start yet.** The only runnable entry point is the
disposable M0 provider spike. `pnpm dev` / `pnpm dev:web` do not exist and must
not be documented until M1 creates them.



Current dependency manifest / install command:



```bash

pnpm --dir tests/provider-spike install
pnpm --dir tests/provider-spike exec playwright install chromium

```

`tests/provider-spike/package.json` is the only manifest in the repository. It is
deliberately **not** a pnpm workspace member, because no workspace exists until M1.



Current baseline syntax / compile check:



```bash

# Parses every spike module without executing it. This is a syntax check only.
node --check tests/provider-spike/src/run.mjs
node --check tests/provider-spike/src/probe-runner.mjs
node --check tests/provider-spike/src/probes/mailtm.mjs
node --check tests/provider-spike/src/probes/guerrilla.mjs
node --check tests/provider-spike/src/probes/browser.mjs
node --check tests/provider-spike/src/probes/delivery.mjs
node --check tests/provider-spike/src/probes/cors-headers.mjs
node --check tests/provider-spike/src/senders/smtp.mjs
node --check tests/provider-spike/src/senders/index.mjs
node --check tests/provider-spike/src/browser/extension-fixture.mjs
node --check tests/provider-spike/src/report.mjs
node --check tests/provider-spike/src/selftest.mjs

```

Verified 2026-10-01: all 12 spike modules parse.

**This proves the spike parses. It proves nothing about behaviour, and nothing at
all about providers.** There is no type-check, lint, build, or application
runtime command yet — those arrive with M1.



<!--

Optional project/runtime installation prerequisite:



[TOOL / RUNTIME NAME AND VERSION]



```bash

[VERIFIED INSTALL COMMAND]

```



Verified [DATE]: [EXACT VERIFICATION RESULT].



Document unusual PATH behavior, executable paths, OS requirements, or other

important setup constraints here.

-->



Important:



- The supported development/runtime environment is **Windows 11, Node.js v26.10.0, pnpm 12.6.0** (all verified 2026-10-01).

- Executed dependency/package consistency check: `pnpm --dir tests/provider-spike install` (verified 2026-10-01, succeeds; a lockfile is committed). No workspace-wide check exists yet.

- Run risky, state-mutating, legacy, or preservation checks in an appropriate disposable environment when required.

- No verified automated test, lint, type-check, build, or runtime command exists unless it is explicitly listed in this section.

- Do not invent commands in this file.

- When new tooling is added, update this section only with commands that were actually executed successfully.

- Document what each verification command proves and what it explicitly does ****not**** prove.

- Do not convert a successful syntax/build command into a claim that behavior or tests passed.



<!--

Add verified project-specific tool commands below.



Repeat the following pattern for each important tool, validator, migration

utility, generator, test suite, asset processor, schema checker, etc.



Do not retain examples that do not apply to the project.

-->



### Verified project tool: M0 provider spike harness



Verified on `Windows 11 / Node.js v26.10.0 / pnpm 12.6.0` on 2026-10-01:



```bash

pnpm --dir tests/provider-spike install
pnpm --dir tests/provider-spike exec playwright install chromium
pnpm --dir tests/provider-spike spike:selftest
pnpm --dir tests/provider-spike spike
pnpm --dir tests/provider-spike spike:interactive

```



See `tests/provider-spike/README.md` for the harness contract and outcome
vocabulary, and `docs/PROVIDERS.md` for the findings a run produced.



These commands establish the measured behaviour of `api.mail.tm` and
`api.guerrillamail.com`, including the mailbox lifecycles, CORS reachability from
a real web page and a real MV3 extension context, advertised rate limits, and the
absence of any real-time transport. `spike:selftest` additionally establishes the
harness's own contract: the four outcome classes, that a failing probe never
aborts a run, and that both run artifacts are written.



Real external delivery **has** since been verified on both providers, in
`spike:interactive` run `2026-10-01T18-08-41-251Z`, where a maintainer-sent message
was observed on each live mailbox. A bare `spike` run still records both delivery
checks as `unverified`, because it has no sender and cannot observe inbound mail
unattended — that is the expected result, not a regression.

The non-interactive `spike` command does **not** by itself establish delivery,
long-run mailbox or session expiry, or any product behaviour, because no product
exists. Mail.tm publishes a 7-day message retention but exposes no TTL in its API,
and neither value was measured live. The spike is disposable and must never be
imported by an application.



Exit codes: `0` when no probe failed, `1` when at least one probe failed.
`unsupported` and `unverified` are findings, not failures, and never change the
exit code — but they are never reported as passes.



### Verified project tool: OpenSpec



Verified on `Windows 11` on 2026-10-01:



```bash

openspec --version                       # 1.13.2
openspec validate m0-provider-spike --strict
openspec status --change m0-provider-spike
```



See `openspec/` and `.agents/skills/openspec-*` for the workflow and artifact
format.



These commands establish that the active change's planning artifacts exist, are
internally consistent, and satisfy the schema's validation rules.



They do **not** establish that the implementation matches the change. Validation
is a static check over `proposal.md`, the spec delta, `design.md`, and
`tasks.md`. Only reading the implementation and the recorded run evidence
establishes that.



### Verified project tool: baseline syntax check



Verified on `Windows 11 / Node.js v26.10.0` on 2026-10-01:



```bash

node --check tests/provider-spike/src/run.mjs
node --check tests/provider-spike/src/probe-runner.mjs
node --check tests/provider-spike/src/probes/mailtm.mjs
node --check tests/provider-spike/src/probes/guerrilla.mjs
node --check tests/provider-spike/src/probes/browser.mjs
node --check tests/provider-spike/src/probes/delivery.mjs
node --check tests/provider-spike/src/probes/cors-headers.mjs
node --check tests/provider-spike/src/senders/smtp.mjs
node --check tests/provider-spike/src/report.mjs
node --check tests/provider-spike/src/selftest.mjs

```



These commands establish that every spike module parses as ESM.



They do **not** establish any behaviour, correctness, or provider fact. There is
no type-check, lint, or build command in this repository yet; do not claim one.



### Verified project tool: [TOOL / CHECK NAME]



Verified on `[ENVIRONMENT / RUNTIME]`:



```bash

[VERIFIED COMMAND]

[VERIFIED TEST COMMAND]

```



See `[README / DOCUMENTATION PATH]` for the executable, invocation, exit codes,

evidence classification, containment, and limitations.



These commands establish `[WHAT THE CHECK PROVES]`.



They do ****not**** establish `[WHAT THE CHECK DOES NOT PROVE]`.



<!--

Duplicate the "Verified project tool" section as required.



Examples of things that may deserve separate entries:



- unit tests

- integration tests

- E2E/browser checks

- schema generation

- schema validation

- API contract validation

- migration checks

- asset registry tools

- asset conversion tools

- replay tools

- state-diff tools

- data normalization tools

- content validation

- protocol catalog validation

- code generation

- static analysis

- package integrity checks

- deployment validation

-->



---



## Code style



<!--

Keep durable repository-wide style rules here.

Add language/framework-specific rules when needed.

-->



- Prefer small domain modules over giant dispatchers or god objects.

- Use explicit names and domain types; avoid untyped dictionaries/objects crossing modern domain boundaries.

- Keep transport, domain logic, persistence, and presentation separate.

- Prefer pure functions for reusable calculations where practical.

- Handle failures explicitly; never silently swallow exceptions.

- Do not leave dead compatibility code after its replacement is verified and the related migration explicitly retires it.

- Use consistent import conventions in new application packages.

- Keep scenes/components/modules focused; do not create giant global managers.

- Limit global/autoload/singleton services to genuine cross-cutting concerns such as `[SERVICE 1]`, `[SERVICE 2]`, `[SERVICE 3]`, `[SERVICE 4]`, `[SERVICE 5]`, and `[SERVICE 6]`.

- Match the existing formatter/linter conventions when they are already established.

- Prefer existing project abstractions over introducing parallel competing patterns.

- Avoid speculative abstractions that are not needed by the active task.

- Keep public interfaces small and explicit.

- Prefer composition over deep inheritance unless the framework or domain clearly benefits from inheritance.

- Keep framework-specific code at system boundaries where practical rather than spreading it through domain logic.



---



## Testing



- Every migrated or replaced legacy behavior must have a captured fixture or equivalent behavioral evidence before replacement when parity matters.

- Prefer golden fixtures containing `request`, `before`, `response`, and `after` state when applicable.

- Bug fixes require a regression test when the affected system has test infrastructure.

- Server-authoritative actions must test invalid ownership, insufficient resources, duplicate requests, stale revisions, and invalid state where applicable.

- Runtime/asset changes must not reintroduce retired or prohibited runtime dependencies.

- Run every relevant available check before finishing.

- Do not claim tests passed unless they were actually run.

- If a required check cannot be run, report exactly why.

- Never convert “code compiles” into “tests pass.”

- Test behavior at the narrowest useful layer first, then add integration/E2E coverage where system boundaries matter.

- Do not weaken existing tests simply to make a change pass.

- Do not delete failing tests without determining whether the implementation or the test is wrong.

- When a test is intentionally changed because behavior changed, ensure the approved requirement/specification supports that change.

- Verification evidence must distinguish automated tests, static checks, manual inspection, runtime checks, and inferred conclusions.



---



## Boundaries — do not touch



<!--

Keep universal safety boundaries and add project-specific protected areas.



For preservation projects, explicitly list source material that must never be

destroyed merely because replacements exist.

-->



- Never delete original/reference/source material merely because a replacement exists unless its retirement is explicitly approved.

- Never overwrite raw source assets during conversion; write generated/converted/runtime assets separately.

- Never silently drop unknown legacy/data fields during migration; preserve them for migration analysis when applicable.

- Never manually edit generated files under `.agents/skills/`.

- Never commit `.env`, `.env.*`, credentials, tokens, private keys, or production secrets.

- Never hardcode production secrets.

- Never package prohibited/retired runtimes or dependencies into the final application.

- Do not modify reference/legacy behavior merely to make modern implementation easier; document and reproduce it first when parity is required.

- Never modify generated artifacts by hand when a canonical generator owns them.

- Never bypass security boundaries for convenience.

- Never weaken authentication, authorization, validation, sandboxing, permission checks, or trust boundaries without explicit requirements.

- Never delete user data, migration data, production data, or preservation material as part of ordinary feature work.

- Do not modify CI/CD, deployment, infrastructure, security, or repository governance unless the active task requires it.

- Do not touch `[PROJECT-SPECIFIC PROTECTED PATHS / FILES]` unless the active task explicitly requires it.



---



## Change scope



- Make the smallest coherent change that satisfies the active task/OpenSpec change.

- Do not perform unrelated refactors or cleanup.

- Do not modify unrelated files.

- Do not upgrade dependencies without a concrete reason.

- Do not reorganize existing files during feature work unless the active change requires it.

- Use `git mv` when relocating preserved repository files where practical.

- Preserve existing behavior unless the task or approved spec explicitly changes it.

- Do not alter unrelated product behavior during parity, migration, or focused feature work.

- Prefer one domain/vertical slice at a time.

- Avoid “while I am here” changes.

- Separate required cleanup from optional cleanup.

- When additional work is discovered outside scope, record/report it rather than silently expanding the current change.

- Do not broaden an OpenSpec change simply because related opportunities are discovered during implementation.



---



## Migration order



<!--

Keep this section only when the project has an intentional migration,

reconstruction, modernization, or phased replacement sequence.



Replace the placeholders with the actual project migration order.

Delete this section only when the project genuinely has no phased sequence.

-->



Unless an approved OpenSpec change intentionally requires otherwise:



    [PHASE / DOMAIN 1]

        ↓

    [PHASE / DOMAIN 2]

        ↓

    [PHASE / DOMAIN 3]

        ↓

    [PHASE / DOMAIN 4]

        ↓

    [PHASE / DOMAIN 5]

        ↓

    [PHASE / DOMAIN 6]

        ↓

    [PHASE / DOMAIN 7]

        ↓

    [PHASE / DOMAIN 8]

        ↓

    [PHASE / DOMAIN 9]

        ↓

    [PHASE / DOMAIN 10]

        ↓

    [PHASE / DOMAIN 11]

        ↓

    [PHASE / DOMAIN 12]



The first major target is `[FIRST MAJOR TARGET / MILESTONE]`, not `[LATER OR NON-PRIORITY INFRASTRUCTURE WORK]`.



---



## Git / PR workflow



`main` is the integration branch. Never perform planned work directly on `main`.



Every repository-mutating OpenSpec stage must use a remote branch and PR. Local-only working branches are not allowed.



### Branch naming



Branch names describe the technical work, not the raw OpenSpec change name.



- Proposal/docs: `docs/<technical-scope>-proposal`

- Feature: `feat/<technical-scope>`

- Fix: `fix/<technical-scope>`

- Refactor: `refactor/<technical-scope>`

- Tests/validation: `test/<technical-scope>`

- Technical spike: `spike/<technical-scope>`

- Spec sync: `docs/<technical-scope>-spec-sync`

- Archive: `chore/archive-<technical-scope>`



Examples:



- `docs/<technical-scope>-proposal`

- `feat/<technical-scope>`

- `fix/<technical-scope>`

- `docs/<technical-scope>-spec-sync`

- `chore/archive-<technical-scope>`



Do not use the OpenSpec change ID as the branch name unless it is also the clearest technical description.



### Branch lifecycle



Before starting any repository-mutating stage:



1. Check `git status`.

2. Switch to `main`.

3. Pull the latest `origin/main`.

4. Create a new branch from the updated `main`.

5. Immediately push the new branch to `origin` and set upstream tracking.

6. Only then begin modifying files.



Never leave active repository work only on a local branch.



Recommended pattern:



    git switch main

    git pull --ff-only origin main

    git switch -c <branch-name>

    git push -u origin <branch-name>



### OpenSpec Git lifecycle



#### Explore



`/openspec-explore` is normally read-only.



If no repository files change, no branch or PR is required.



If exploration intentionally modifies tracked documentation, treat it as a normal repository-mutating stage and use a branch + PR.



#### Propose



For `/openspec-propose`:



1. Start from updated `main`.

2. Create a technical proposal branch such as `docs/<scope>-proposal`.

3. Immediately push the branch to `origin`.

4. Create/update the OpenSpec proposal, design, specs, tasks, and roadmap status.

5. Review the diff.

6. Commit using Conventional Commits.

7. Push all proposal commits to the remote branch.

8. Open a PR into `main`.

9. After required checks pass, merge the PR using a ****merge commit****.

10. Delete the merged local and remote branch.

11. Return to `main` and pull the merged result before starting Apply.



Proposal artifacts should be committed and pushed so the exact remote PR diff can be reviewed.



Do not reuse the proposal branch for Apply.



#### Apply



For `/openspec-apply-change`:



1. Ensure the proposal PR has already been merged.

2. Return to `main`.

3. Pull the latest `origin/main`.

4. Create a new implementation branch from `main`.

5. Immediately push the new branch to `origin`.

6. Apply only the approved OpenSpec tasks.

7. Commit coherent implementation steps using Conventional Commits.

8. Push commits regularly to the remote branch.

9. Run all required verification.

10. Review the final diff and test results.

11. Open or update the PR into `main`.

12. Merge after required checks pass.

13. Merge using a ****merge commit****.

14. Delete the merged local and remote branch.

15. Return to updated `main`.



Do not reuse the proposal branch for Apply.



Do not begin Sync or Archive from an unmerged Apply branch.



#### Sync



If `/openspec-sync` modifies repository files:



1. Ensure the Apply PR has already been merged.

2. Return to `main` and pull latest `origin/main`.

3. Create `docs/<scope>-spec-sync`.

4. Immediately push it to `origin`.

5. Run the approved OpenSpec sync.

6. Review the diff.

7. Commit using Conventional Commits.

8. Push the commit(s).

9. Open a PR into `main`.

10. Merge using a ****merge commit**** after required checks pass.

11. Delete the local and remote branch.

12. Return to updated `main`.



Skip this stage when no spec synchronization is required.



#### Archive



For `/openspec-archive`:



1. Archive only after Apply and any required Sync are merged.

2. Return to `main`.

3. Pull latest `origin/main`.

4. Create `chore/archive-<technical-scope>`.

5. Immediately push the branch to `origin`.

6. Run the OpenSpec archive workflow.

7. Update Project Status, roadmap references, and archive links where required.

8. Review the diff.

9. Commit using Conventional Commits.

10. Push the archive commit(s).

11. Open a PR into `main`.

12. Merge after required checks pass.

13. Merge using a ****merge commit****.

14. Delete the local and remote branch.

15. Return to `main` and pull latest `origin/main` before beginning the next roadmap phase.



### Commit conventions



Use Conventional Commits:



- `feat:` new product capability

- `fix:` bug fix

- `refactor:` behavior-preserving restructuring

- `test:` tests or technical validation

- `docs:` documentation/specification

- `chore:` repository/tooling/archive maintenance



Examples:



- `docs: propose <technical scope>`

- `test: add <technical validation>`

- `feat: add <product capability>`

- `fix: prevent <bug>`

- `docs: sync <technical scope> requirements`

- `chore: archive <technical scope>`



Keep commits coherent and scoped.



Do not bundle unrelated changes into one commit.



### PR / merge conventions



- Every Propose, Apply, Sync, and Archive stage that changes repository files must go through a PR into `main`.

- Never silently commit completed stage work directly to `main`.

- Keep one coherent OpenSpec stage per branch.

- Open the PR from the remote branch, not from local-only work.

- Use ****merge commits only**** for OpenSpec and development PRs.

- Do ****not**** squash merge.

- Do ****not**** rebase merge.

- Preserve branch topology and individual branch commits in Git history.

- When using GitHub CLI, merge with:



      gh pr merge <PR_NUMBER> --merge --delete-branch



- Do not use:



      gh pr merge <PR_NUMBER> --squash



  or:



      gh pr merge <PR_NUMBER> --rebase



- Do not replace the default GitHub merge-commit title unless there is a specific reason.

- Prefer preserving the normal GitHub merge message, for example:



      Merge pull request #123 from owner/feat/<technical-scope>



- Delete local and remote branches only after the PR has successfully merged.

- The PR and merge commit are the permanent historical record after branch deletion.

- Never begin the next OpenSpec stage from an unmerged branch.

- After every merge, switch back to `main` and update it from `origin/main` before creating the next branch.



### Expected OpenSpec branch flow



For one OpenSpec change, the normal flow is:



    main

      │

      ├── docs/<scope>-proposal

      │      ↓ push remote immediately

      │      ↓ /openspec-propose

      │      ↓ commit + push

      │      ↓ PR

      │      ↓ merge commit

      │

      ├── feat|spike|test/<scope>

      │      ↓ push remote immediately

      │      ↓ /openspec-apply-change

      │      ↓ implementation

      │      ↓ verification

      │      ↓ commit + push

      │      ↓ PR

      │      ↓ merge commit

      │

      ├── docs/<scope>-spec-sync

      │      ↓ only if sync is required

      │      ↓ /openspec-sync

      │      ↓ PR

      │      ↓ merge commit

      │

      └── chore/archive-<scope>

             ↓ /openspec-archive

             ↓ update roadmap/status

             ↓ PR

             ↓ merge commit

             ↓ delete branch

             ↓ return to updated main



### Git safety



- Check `git status` before significant work.

- Inspect `git diff` before every commit.

- Inspect the final diff before opening a PR.

- Never discard existing user changes.

- Never force-push unless explicitly authorized.

- Never use destructive Git operations unless explicitly authorized.

- Never rewrite history unless explicitly authorized.

- Never merge a PR with failing required checks unless explicitly authorized.

- Never claim a branch was pushed, a PR was opened, or a merge occurred unless it actually happened.



---



## Source of truth



When deciding what the project should do, use this order:



1. Explicit user/task requirements

2. Approved active OpenSpec change

3. `openspec/specs/`

4. Recorded reference/legacy behavior or golden fixtures when applicable

5. Existing implementation and architecture

6. Tests

7. Repository documentation

8. Agent assumptions



When sources conflict, investigate the conflict. Do not silently invent a resolution.



For preservation/parity work, observed reference behavior is evidence; an accidental implementation difference is not automatically an improvement.



<!--

If the project is greenfield and has no legacy/reference behavior, adapt item 4

to the appropriate project authority, for example:



4. Approved product/design/API contracts



Do not silently alter the precedence without documenting it here.

-->



---



## Existing / brownfield project rules



<!--

Keep this section for any existing project.



Replace project-specific file/path examples with the repositories' important

implementation surfaces.

-->



Before modifying an existing capability:



- Inspect its implementation.

- Search `[CORE IMPLEMENTATION FILES / MODULES / ROUTES / CONFIGURATION / STORAGE / ASSETS]` as applicable.

- Read the relevant OpenSpec spec/change.

- Check `openspec/changes/` for active work.

- Identify the current request → state mutation → response/output behavior.

- Capture or locate behavioral fixtures before replacing existing behavior when parity matters.

- Do not assume undocumented means unused.

- Do not rewrite working systems merely because they are unfamiliar.

- Classify obscure systems explicitly as implemented, parity-verified, retired, deprecated, experimental, or out-of-scope.

- Identify consumers before changing public interfaces.

- Search for tests, documentation, migrations, fixtures, generated code, and external contracts connected to the capability.

- Preserve backwards compatibility when required by the active specification.

- Distinguish accidental implementation details from externally observable behavior before reproducing them.



---



## Spec-driven development — OpenSpec



This project uses OpenSpec for nontrivial behavioral and architectural changes.



Expected structure:



    openspec/

    ├── config.yaml

    ├── specs/

    └── changes/



Rules:



- Check `openspec/changes/` before starting nontrivial implementation.

- Continue an existing relevant change instead of creating a duplicate.

- Read the relevant `openspec/specs/` capability before modifying it.

- Create/propose a change before implementing new nontrivial behavior when no appropriate change exists.

- Keep implementation aligned with the active change's requirements, design, and tasks.

- If implementation reveals a missing or incorrect requirement, update the change instead of silently diverging.

- Do not expand an active change with unrelated work.

- Sync approved behavior back into main specs and archive completed changes using the installed OpenSpec workflow.

- Do not manually edit generated `.agents/skills/`; use `openspec update` when regeneration is required.



Typical workflow:



    Explore → Propose → Apply → Verify → Sync → Archive



Use exploration for investigation only; it is not permission to implement.



OpenSpec owns feature requirements and change artifacts. This file owns durable repository-wide engineering rules.



---



## Reconstruction workflow



<!--

Keep this section for migrations, reconstructions, compatibility projects,

rewrites, preservation projects, or staged replacement work.



For ordinary greenfield projects, rename this section to "Implementation

workflow" and adapt the steps without removing verification discipline.

-->



For each migrated/reconstructed/replaced feature:



    1. Inspect the existing/reference implementation and related resources.

    2. Identify interfaces/endpoints/state/dependencies involved.

    3. Capture or locate reference fixtures/evidence when applicable.

    4. Read/create the OpenSpec change.

    5. Implement the smallest complete behavior.

    6. Add/update tests.

    7. Replay/compare against reference behavior when parity matters.

    8. Perform visual/runtime verification when relevant.

    9. Update migration/project status and documentation.

    10. Inspect diff and report checks actually run.



Do not mark an existing/reference feature replaced until parity has been verified or an approved spec explicitly changes its behavior.



---



## Orchestration mode



For nontrivial OpenSpec changes, the root Codex agent acts as the orchestrator.



- Use real Codex subagents when work can be divided into concrete, independent tasks without overlapping file ownership.

- The root orchestrator owns the active OpenSpec artifacts and task status.

- Implementation subagents must not independently edit `proposal.md`, `design.md`, specs, or `tasks.md` unless explicitly assigned that responsibility.

- Assign each worker a bounded task, owned files/directories, requirements, dependencies, and required verification.

- Do not parallelize tasks that depend on unfinished interfaces or behavior.

- Do not have multiple agents edit the same files unless intentionally coordinated.

- Worker agents must report files changed, checks run, results, and unresolved concerns.

- The root orchestrator must review worker diffs/results before accepting them.

- After implementation, use a separate verification pass or verifier subagent to compare the actual implementation against the active OpenSpec artifacts.

- Do not trust checked task boxes as evidence; inspect the implementation.

- Run OpenSpec strict validation and the installed OpenSpec verification workflow before considering the change complete.

- Any unresolved CRITICAL verification issue blocks completion.

- Any unresolved WARNING blocks completion unless explicitly accepted by the user or active specification.

- If verification fails, create bounded repair tasks, delegate when useful, then rerun verification.

- Only the root orchestrator may declare the OpenSpec change complete.

- Worker subagents should not spawn additional subagents unless the root explicitly authorizes nested delegation.



### Subagent



- Default to at most two active subagents per root session.

- Preferred roles are:

  1. implementation agent

  2. verification agent

- The root agent remains the orchestrator and owns OpenSpec artifacts, architectural decisions, integration, and final acceptance.

- Do not spawn additional agents merely because work can technically be parallelized.

- Prefer sequential delegation when the verifier depends on implementation output.

- Spawn additional agents beyond this default only when the task has clearly independent workstreams and the expected benefit outweighs duplicated context/token cost.

- Give subagents only the context necessary for their assigned task; do not require every subagent to rediscover the entire repository.



### OpenSpec bootstrap and resume



The root orchestrator must support both bootstrap and resume workflows.



Before creating a new OpenSpec change:



- Inspect `openspec/changes/` and the project status recorded in the development roadmap.

- If a relevant active change already exists, resume it instead of creating a duplicate.

- If a completed but unverified or unarchived change exists, finish its verification/lifecycle before creating another dependent change.

- If no active change exists, use the development roadmap and current repository state to determine the smallest coherent next change.

- Use OpenSpec exploration before proposing a new change when repository investigation, existing/reference behavior, architecture, dependencies, or scope need confirmation.

- Exploration must not implement code.

- After exploration is sufficiently resolved, create the change with the installed OpenSpec propose workflow.

- Validate the generated change before implementation.

- Do not create an OpenSpec change for the entire development roadmap. The roadmap is the program-level plan; OpenSpec changes are bounded implementation units.

- Do not skip ahead to a later roadmap milestone while required exit criteria or dependencies of the current milestone remain incomplete.

- Default to completing one OpenSpec change per orchestration run unless the user explicitly requests continuous milestone execution.



### Development roadmap ownership



The development roadmap contains a root-orchestrator-owned `Project Status` block.



- Only the root orchestrator may update the roadmap's `Project Status` block.

- Implementation and verification subagents must not modify the roadmap unless explicitly assigned.

- Treat the status block as a progress ledger, not as the behavioral source of truth.

- OpenSpec specs and active change artifacts remain the source of truth for specified behavior.

- Repository implementation and tests provide implementation evidence.

- Reconcile the roadmap status against Git, OpenSpec, and the repository before trusting stale status from a previous session.

- Update project status whenever the active change enters a meaningful lifecycle transition: proposed, implementing, verifying, blocked, verified, archived, or completed.

- Record blockers and unresolved verification findings rather than hiding them.

- After archiving a verified change, update the roadmap cursor to the next eligible objective but do not automatically begin that change unless the current orchestration request allows it.
