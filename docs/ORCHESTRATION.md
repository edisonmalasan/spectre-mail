# T3 Code orchestration runbook

A reusable runbook for running an OpenSpec change on SpectreMail from a T3 Code
orchestrator thread with isolated workers. It records the tool surface that was
actually available in a T3 Code thread on 2026-11-22, and the repository rules
that must survive delegation. It does **not** define product behaviour: the
behavioural source of truth is `openspec/specs/`, and the durable engineering
rules are in `AGENTS.md`. When this runbook and `AGENTS.md` disagree,
`AGENTS.md` wins.

The orchestrator thread does not implement application changes. It owns the
OpenSpec artifacts, the task ledger, integration, and final acceptance. Workers
implement in isolated worktrees and bring their own feature branches and PRs.

## 1. Verified tool surface

Every tool name and argument below was read from the code-mode tool catalog
available in this worktree on 2026-11-22. Nothing outside that catalog is
presented as verified; the gaps are listed in section 7.

### 1.1 Capability discovery

- `orchestrator_capabilities({ environmentId?, search? })` — call **once per
  thread, before the first `delegate_task`**. It reports `providers` (each with
  `providerInstanceId`, `driverKind`, `displayName`, `models`,
  `canRunChildTask`, `canRunCrossProviderChildTask`, `constraints`), the
  inherited `providerInstanceId` / `model` / `options`, `runtimeMode`,
  `interactionMode`, and `features` (`appOwnedSubagents`, `asyncPolling`,
  `cancellation`, `batchThreadCreation`, `threadManagement`,
  `incrementalThreadRead`, `scheduledTasks`, `maxBatchThreads`). Values used in
  `delegate_task.target` must come from here; do not guess a provider, model, or
  option id.
- `t3_environment_read({ environmentId? })` — read this server's identity,
  platform, and preferences (including `newWorktreesStartFromOrigin`). Useful
  when deciding whether a child starts from `origin/main` or a local base.

### 1.2 Delegation

- `delegate_task({ task, target?, title?, role?, isolation?, mode?, timeoutMs?,
clientRequestId?, runtimeMode?, interactionMode? })`.
  - `task` is the full worker brief (see section 4).
  - `role`: `implementation | research | review | design | test | general`.
  - `isolation`: `shared` (default, the parent checkout) or `worktree` (a new
    prepared checkout from the parent commit, so a child can have its own
    branch and PR; uncommitted parent edits stay out). **Use `worktree` for
    repository-mutating OpenSpec work.**
  - `mode`: `async` (default) or `wait`. `wait` is only for a turn that truly
    needs the result; a question or approval ends a wait. `timeoutMs` is
    `wait`-only, at most 45 000 ms, and a timeout does **not** cancel the child.
  - `target`: `{ providerInstanceId?, driverKind?, model?, options?,
environmentId?, projectId? }`. `options` come from
    `orchestrator_capabilities`; given values override inherited ones, and
    `[]` or `{}` clears them.
  - `runtimeMode?` / `interactionMode?`: omit unless a supervised child was
    explicitly requested. Narrow modes pause for human approval; a mode above
    the parent's is rejected.
  - Return fields to act on: `taskId`, `childThreadId`, `link?`, `status`
    (`queued | starting | running | waiting | completed | failed | cancelled |
interrupted`), `workState`, `next?`, `hasPendingQuestion`,
    `pendingApproval`, `waitTimedOut`, `summary`, `resultContextTransferId`.
- `task_status({ taskId })` — read a task's current state and terminal
  summary. It returns the same field set as `delegate_task`.
- `task_cancel({ taskId, reason?, clientRequestId? })` — stop a delegate you
  are replacing or no longer need. Its result can be `cancel_requested`;
  confirm the terminal state with `task_status`. Use this, **not**
  `t3_thread_interrupt`, on a `childThreadId`.
- Follow a running delegate's `next` guidance. Do not poll it with repeated
  `task_status`, sleeps, or watchers; a block of shell work is waited on with
  `t3_background_wait({ taskIds, waiting? })`, which takes background **shell**
  ids, not delegate `taskId`s.

### 1.3 Thread tools

- `t3_thread_read({ threadId, itemId?, textOffset?, view?, afterPosition?,
beforePosition?, limit?, runLimit?, maxCharsPerItem?, environmentId? })` —
  read a thread before answering about it. It reports `thread` (status,
  `branch`, `worktreePath`, `parentThreadId`, `relationshipToParent`,
  `linkedPullRequest`, `pullRequests?`, `pendingRequestCount`, `settled`,
  `archived`, timestamps), `recentRuns`, `items`, `nextPosition`, `hasMore`.
- `t3_thread_launch({ title, message?, attachments?, modelSelection?,
runtimeMode?, interactionMode?, workspaceStrategy?, scratch?, projectId?,
environmentId?, delegatedFrom?, clientRequestId? })` — new **top-level**
  thread, only when the user asks for a new thread. "Subagent", "delegate", and
  "parallel" do not mean this. For a worktree thread set `workspaceStrategy`;
  independent work uses the default branch as `remote/branch` with
  `startFromOrigin: true`, while unpublished commits or dependent work use the
  local base with `startFromOrigin: false`. With no `workspaceStrategy` the
  thread runs at the project root, not in your worktree.
- `create_threads({ threads: [{ prompt?, title?, target?, runtimeMode?,
interactionMode? }], clientRequestId? })` — batch creation (1–20 threads).
- `t3_thread_wait({ threadId, runId?, timeoutMs?,
untilDelegatedWorkSettled?, environmentId? })` — wait for a thread run;
  `untilDelegatedWorkSettled` also waits for its delegated/background work.
  Reports `status`, `timedOut`, `next?`, `resultRun?`.
- `t3_thread_configure`, `t3_thread_update`, `t3_thread_organize`,
  `t3_thread_transfer`, `t3_queue`, `t3_pending_request` — set provider/model,
  rename, settle/archive, fork/merge-back, queue a message, and answer a
  question that blocked a child. Use `t3_pending_request({ action: "respond",
threadId, requestId, answers })` for a delegate question that only the
  orchestrator can answer.

### 1.4 PR and CI tools

When `pull_request_*` tools are listed in the catalog, use them rather than
`gh`/`cafe` for PR operations.

- `pull_request_create({ title, body, base?, draft?, environmentId? })` — open
  a PR from the current branch. The harness states this links the PR for you;
  still verify with `t3_thread_read` or `list_thread_pull_requests`.
- `link_pull_request({ url? , repository?, number?, threadId?,
environmentId? })` — link an existing PR by URL, or by `repository` +
  `number`. `link_pull_requests({ urls[] })` links several and reports
  `linked` / `alreadyLinked` / `invalidUrls`.
- `unlink_pull_requests({ states[] })`, `pull_request_list`,
  `pull_request_read({ sections?, ... })`, `pull_request_review`,
  `pull_request_update`, `pull_request_merge({ expectedHeadSha, number?,
method?, auto?, stack? })`. For this repository the merge method must be
  `merge` (see section 2).
- `list_thread_pull_requests({ threadId?, states?, ... })` — PRs attached to a
  thread, with `watching` and stack information.
- `ci_logs({ number?, repository?, check?, tailLines? })` and
  `ci_rerun({ number?, repository?, check? })` — read failing check tails and
  rerun checks. Use these instead of guessing a red from a summary line.

### 1.5 Human-only inputs

`request_secret({ label, reason, url?, delivery?, timeoutMs?, ... })` is the
way to obtain a credential, token, or password that only the user can supply.
Never ask for one in chat and never invent a placeholder value.

## 2. Non-negotiable repository rules carried from `AGENTS.md`

- **`main` is the integration branch and stays clean.** Never do planned work
  directly on `main`. The main thread orchestrates; it does not implement
  application changes.
- **Workers own feature branches and PRs.** Before any repository-mutating
  stage: check `git status`, switch to `main`, `git pull --ff-only origin main`,
  create a technical branch (`feat/`, `fix/`, `test/`, `spike/`, `docs/`,
  `chore/archive-`), push it with `-u` immediately, then edit.
- **Merge commits only.** `gh pr merge <n> --merge --delete-branch`. No squash,
  no rebase. One coherent OpenSpec stage per branch/PR; never start a later
  stage from an unmerged branch.
- **Non-overlapping file ownership.** Give each worker a disjoint set of files
  or directories. Two agents must not edit the same file unless deliberately
  coordinated. Give each worker only the context its task needs.
- **OpenSpec lifecycle: Explore → Propose → Apply → Verify → Sync → Archive.**
  Check `openspec/changes/` before creating anything; resume an existing change
  instead of duplicating it. Never create a change for the whole roadmap.
  `sync` promotes the delta into `openspec/specs/`; `archive` runs with
  `--skip-specs` when a sync already promoted (and changes that declare
  `skip_specs` have no sync stage). Do not expand an active change with
  unrelated work.
- **Protected paths — do not touch unless the active task explicitly requires
  it:** `docs/PROVIDERS.md`, `.github/workflows/`, `.agents/skills/` (generated;
  use the supported update workflow), `openspec/changes/archive/`, and
  `AGENTS.md` itself. Also never commit `.env*`, credentials, tokens, private
  keys, or production secrets.
- **Evidence is command output, not claims.** Record the command and its exact
  result. Distinguish automated tests, static checks, manual inspection,
  runtime checks, and inferred conclusions. "It compiles" is not "tests
  passed"; a mocked, recorded, or pending result is not a live pass.
- **Never round a blocked or unverified row to a pass.** A `PENDING`,
  `BLOCKED`, `NOT INSPECTED`, `UNKNOWN`, or unattributed red stays that way in
  the record. A red that appears and disappears without the tree changing is
  not a result either way. A check that did not run is not a check that passed.
- **Blocker escalation is limited to genuinely human matters:** credentials or
  secrets, authorization, major product decisions, and final human acceptance
  (for example, a human-sent email or a person judging a rendered pixel). Do not
  escalate an implementation detail a worker can resolve from the spec.
- **A worker reports, it does not declare completion.** Files changed, checks
  run with exact results, blockers/unresolved concerns, commit SHA, and PR URL.
  Only the root orchestrator declares the change complete, after comparing the
  implementation against the change's artifacts rather than against ticked
  boxes.

## 3. Architecture (text diagram)

```text
        main thread (orchestrator, clean main)
        - owns OpenSpec artifacts + task ledger + roadmap status
        - integrates sequentially, merge commits only
                              |
                              | delegate_task({ isolation: "worktree", role, mode, target })
                              v
        +---------------------+----------------------+---------------------+
        |                     |                      |                     |
   worker A worktree     worker B worktree     verifier worktree     (idle / cancelled)
   branch feat/A         branch test/B         branch review/C
   PR #.. (open)         PR #.. (open)         PR #.. (open)
        |                     |                      |
        +--- review diff, compare to delta, re-run gates ---+
                              |
                  merge one PR at a time into origin/main
                              |
              sync specs -> promote -> archive -> reconcile ledger
```

Boundaries that make the diagram safe:

- The orchestrator's checkout never becomes a worker's scratch space. Workers
  get `isolation: "worktree"`; uncommitted orchestrator edits stay out.
- A worker never merges its own PR and never starts the next OpenSpec stage.
- The verifier is a fresh delegate (`role: "review"` or `"test"`) with its own
  worktree; it reads the worker's branch/PR and the approved delta, not the
  worker's ticked boxes.

## 4. Worker task-brief template

Paste this as the `task` string of `delegate_task`. Keep it bounded and
self-contained: a child starts with fresh context.

```text
ROLE: <implementation | review | test | research>
CHANGE: <OpenSpec change id, and its stage: proposal | apply | verification | sync | archive>
OBJECTIVE: <one sentence>

SCOPE
- Do: <exact behaviour and files>
- Do not: <adjacent work explicitly out of scope>
- Protected paths: docs/PROVIDERS.md, .github/workflows/, .agents/skills/,
  openspec/changes/archive/, AGENTS.md (unless explicitly assigned)

OWNERSHIP
- You own: <files/directories you may create or edit>
- Others own: <files another worker or the orchestrator owns; read-only to you>
- Base: origin/main at <sha or branch>; create and push your own branch first.

ACCEPTANCE CRITERIA
- <criterion tied to a named requirement/scenario in openspec/changes/.../specs/>
- <criterion that must be falsifiable: state the assertion that can fail>
- Falsification: for each new assertion, introduce the violation, show the
  assertion fails, restore the file byte-identically, show the conforming
  case passes. A survivor is "the assertion did not catch this" until read.

EVIDENCE TO RETURN
- For every check: the exact command and its exact output/exit code.
- Distinguish automated tests, static checks, manual inspection, runtime
  checks, and inferences. Mark any PENDING / BLOCKED / NOT INSPECTED row as
  such; never round it to a pass. A mocked or recorded provider is not live.

REPORTING FORMAT
1. Files changed (paths)
2. Checks run, with exact results
3. Falsification table (mutation -> catching assertion -> restoration verified)
4. Blockers / unresolved concerns
5. Branch name, commit SHA, and full PR URL
6. One-line summary of what you did NOT verify
```

## 5. Checklists

### 5.1 Launch

- [ ] Confirm there is no active change that should be resumed:
      `openspec list`, and read the roadmap `Project Status` block.
- [ ] Read the relevant capability spec under `openspec/specs/` and the
      active change's `proposal.md`, `design.md`, `specs/`, `tasks.md`.
- [ ] Call `orchestrator_capabilities` once; record the inherited provider /
      model / options and `maxBatchThreads`.
- [ ] Choose worker count from genuinely independent file ownership; prefer at
      most two active delegates. Do not parallelize tasks sharing files or an
      unfinished interface.
- [ ] For each worker: `delegate_task` with `isolation: "worktree"`, an
      explicit `role`, `mode: "async"`, the brief from section 4, and a
      `target` derived from `orchestrator_capabilities`.
- [ ] Each worker creates its branch from updated `origin/main`, pushes with
      `-u` immediately, and opens its PR before reporting.

### 5.2 Monitor

- [ ] Follow each delegate's `next`; do not poll `task_status` in a loop.
- [ ] On a completion notification, call `task_status({ taskId })` once to
      read the terminal `status` and `summary`.
- [ ] If `hasPendingQuestion`, answer with `t3_pending_request` (or hand the
      genuinely human question to the user). If `pendingApproval`, check
      whether it is an authorization matter that must be escalated.
- [ ] If a worker is being replaced or is no longer needed, `task_cancel` it;
      confirm the terminal state. Never `t3_thread_interrupt` a child thread.
- [ ] Wait on background shell work with `t3_background_wait`, not on delegate
      tasks.
- [ ] Do not accept a green `summary` alone: read the reported command output.

### 5.3 Review

- [ ] Read each worker's diff (`pull_request_read` with `sections: ["diff"]`)
      and compare it to the approved delta, not to the worker's ticked boxes.
- [ ] Check disjoint file ownership against the actual diffs.
- [ ] Re-run the independent gates on each branch: `pnpm typecheck`, `pnpm
lint`, `pnpm format:check`, `pnpm test`, `pnpm build`. `pnpm verify`
      runs these in sequence and must pass with **no browser installed**.
- [ ] Run browser tiers separately when the change affects them; do not treat
      a load-driven flake as a product failure or a green single run as proof.
- [ ] Prove the change's new assertions can fail; check the falsification
      table and the byte-identical restoration.
- [ ] Confirm every `PENDING`/`BLOCKED`/`NOT INSPECTED`/unattributed red is
      recorded as such.
- [ ] Use `ci_logs` / `ci_rerun` for CI checks; name a failing case before
      attributing it.

### 5.4 Integrate

- [ ] Workers do not merge. Merge one coherent PR at a time with a **merge
      commit**: `gh pr merge <n> --merge --delete-branch`, or
      `pull_request_merge({ number, expectedHeadSha, method: "merge" })`.
- [ ] After each merge, switch to `main` and `git pull --ff-only origin main`
      before the next stage/branch. Never begin a stage from an unmerged
      branch.
- [ ] Link every created PR to the thread (`link_pull_request` /
      `link_pull_requests`) and report full URLs.
- [ ] When all Apply PRs are merged, run Sync on its own branch/PR; then
      Archive on its own branch/PR with `--skip-specs` as appropriate.
- [ ] After Archive, verify promoted blocks are byte-identical to the
      **archived** delta, re-count requirements/scenarios by heading, run
      `openspec validate --specs --strict`, and confirm `openspec list`
      reports no active changes.

## 6. Resuming and reconciling after workers finish

- The roadmap `Project Status` block is a progress ledger, not behavioural
  truth. Reconcile it against Git, OpenSpec, and the repository before
  trusting any value written in a previous session.
- Only the root orchestrator updates that block. Record Lifecycle transitions
  (proposed, implementing, verifying, blocked, verified, archived, completed)
  and unresolved findings; do not hide a red.
- Re-measure counts rather than transcribing them: `pnpm test` with
  `--reporter=json` grouped by project, and `playwright test --list
--reporter=json` walked recursively for the browser tiers. A count nobody
  re-ran is a count nobody checked.
- After a Sync, re-count promoted requirements by heading because a `MODIFIED`
  block replaces rather than adds; a block count is not a requirement delta.
- If a worker finishes but its PR is unmerged, treat the change as unfinished:
  finish integration before starting the next stage or a new change.
- If a session is interrupted, start from `openspec list` + `git status` +
  the roadmap ledger to find the earliest incomplete milestone/stage, and
  resume it rather than opening a duplicate.

## 7. Known limits and uncertainties

### 7.1 Verified repository limits

- **Load-driven browser flakes.** The browser and architecture suites have a
  history of timing-dependent reds under CPU contention, including
  `[vitest-worker]: Timeout calling "onTaskUpdate"` with all tests passing,
  and `branding-audit` timeouts. A red that appears and disappears without a
  tree change is not attributable to the change. Re-run, report the rate, and
  do not convert a single green into a repeatability claim.
- **Port 4173 collisions.** The website tier serves `apps/web/dist` with
  `vite preview --strictPort`. Two concurrent `pnpm test:browser` runs collide:
  the loser prints `Process from config.webServer was not able to start` and
  produces zero tier summaries. A run with no tier summary must be recorded as
  `HARNESS-ERROR`, not counted as a pass. Never start two tiers in parallel.
- **Gitignored live-reception state is absent in fresh worktrees.** The live
  harness keeps its prepared mailbox and browser profile in
  `apps/extension/e2e/.live-reception/` (gitignored, per `.gitignore`). A fresh
  `worktree`-isolated worker does not inherit it, so `live-reception --verify`
  there will report `PENDING` with `restoredAddressMatches: false` (or no
  prepared address) even when a mailbox was prepared in another worktree. Live
  reception requires a human-sent message and is the canonical human-only
  escalation; never fabricate success from recorded fixtures.
- **No rendered-pixel judgement.** No test reads a rendered pixel's colour or
  position. Visual acceptance is a human matter and remains explicitly
  unverified.
- **A fresh worktree has no `node_modules`.** Run `pnpm install
--frozen-lockfile` once before any gate. Browser tiers additionally need a
  Playwright Chromium install; `pnpm verify` must still pass with no browser
  present.
- **`pnpm verify` does not run browser tiers.** They are a separate job. A
  green `verify` says nothing about a browser suite that was never executed.

### 7.2 Tools named in the harness preamble but not verified in the catalog

The following were mentioned in the orchestration preamble available to this
session but did **not** surface in the code-mode tool catalog searched here:
`watch_pull_request`, `unwatch_pull_request`, `t3_environment_links`, and
`t3_environment_link`. Their exact names or arguments are therefore **not**
asserted by this runbook. Before relying on them, re-check the current catalog
with `search`; if they are absent, use the verified alternatives
(`list_thread_pull_requests`, `pull_request_read`, `link_pull_request`,
`t3_environment_read`) and record that watching/linking could not be performed.

Equally, this runbook does not assert any behaviour for tools it did not read
signatures for. Where a worker brief names a tool not in section 1, verify it
first rather than extrapolating from a similar tool.
