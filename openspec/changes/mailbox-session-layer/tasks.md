# Tasks

## 1. The session layer's shape

- [ ] 1.1 Create `packages/mailbox` with `package.json`, `tsconfig.json`, and an
  `index.ts`, declaring dependencies on `@spectre-mail/core` and
  `@spectre-mail/providers` **only**. Verify: `pnpm install` succeeds, the package
  appears in the workspace, and `pnpm --filter @spectre-mail/mailbox typecheck`
  exits 0. Its `exports` points at `./src/index.ts` like every other package, so
  there is no build step for it.

- [ ] 1.2 Define the session state as an immutable discriminated union —
  creating, ready-with-mailbox, failed-with-normalized-code — and export a
  narrowing helper per variant. Verify: a test asserts each variant's `kind` and
  that no state carries a field belonging to another variant.

- [ ] 1.3 Implement opening a session: ask the configured manager for a mailbox
  and report `ready` with it, or report `failed` with the normalized code. Verify:
  tests drive one stub provider to success and to each failure code, asserting the
  code rather than a message string.

- [ ] 1.4 Implement replacing the mailbox, which returns a **new** state rather
  than mutating the previous one. Verify: a test holds the first state, replaces
  the mailbox, and asserts the first state is unchanged and still names the first
  mailbox — an in-place mutation would fail that.

- [ ] 1.5 Implement reporting provider health by returning what the provider
  reported, with no derivation. Verify: a stub reports `throttled` with a rate-limit
  header; the test asserts the header survives **verbatim** and that no status was
  computed from it. A positive control asserts `ok` and `unavailable` pass through
  too.

- [ ] 1.6 Prove the session holds no framework and no storage. Verify:
  `packages/mailbox/src` imports nothing from `react`, `react-dom`, or `preact`,
  and references no storage or cookie API; the architecture rule added in 5.1
  asserts the first of those and states its own limit. **Record whether the rule
  can be made to fail** by importing a framework into a real file in the package.

## 2. One provider, and failures that stay specific

- [ ] 2.1 Make the session refuse to serve a mailbox whose provider it was not
  configured with, rather than falling back. Verify: a test configures a session
  with one stub, hands it a mailbox naming another, and asserts it reports the
  mismatch — a silent fallback would serve the wrong provider and is the failure
  this asserts against.

- [ ] 2.2 Make a rate-limited failure keep its code and the provider's own
  description, and never be retried. Verify: a stub that throws the throttled
  error, driven twice, is called exactly once — a retry would show a second call.

- [ ] 2.3 Make a total creation failure identify each provider that failed, and
  with a single configured provider surface that provider's own failure rather
  than a wrapper. Verify: a two-provider test asserts both are named in the
  report, and a one-provider test asserts the reported code equals the stub's own
  code.

- [ ] 2.4 Prove the session performs no request of its own. Verify: a recording
  transport is installed and a full open-then-health cycle is driven; the recording
  shows **zero** requests attributed to the session. A positive control puts a
  request through an adapter and confirms the recording is capable of observing
  one, so a zero is meaningful.

## 3. The website, reaching a real address

- [ ] 3.1 Configure the website's provider manager over Guerrilla Mail alone, from
  a named constant in `apps/web`. Verify: a test reads the configuration and
  asserts exactly one provider and that it is Guerrilla Mail, and the architecture
  scan finds no provider field name under `apps/`.

- [ ] 3.2 Prove the website contacts no other origin. Verify: the configuration
  test asserts the manager's provider list length is 1, so no Mail.tm origin can
  be reached from the page. **This does not prove** a live page issues no other
  request; record that as unproven rather than implied.

- [ ] 3.3 Replace the status page with a component that renders the session's
  three states as distinct labelled content, with no placeholder address while
  creating. Verify: each state renders different, named content, and none conveys
  meaning by colour alone.

- [ ] 3.4 Render the address as selectable text with an accessible copy action,
  and make copy failure a rendered state rather than an exception. Verify: the
  copy action has a name saying what it copies, and when the clipboard refuses the
  page reports the failure and leaves the address visible and selectable.

- [ ] 3.5 Remove the M1 status page's claims about having no mailbox feature, since
  the page now has one, and keep every statement that is still true. Verify: no
  text on the page contradicts what the page does, and no text claims a capability
  the milestone did not build.

## 4. The honest things the page must not say

- [ ] 4.1 Implement the no-known-expiry state: when the mailbox carries no
  provider-reported expiry, the page says the lifetime is unknown and shows no
  countdown. Verify: a test drives a mailbox with no `expiresAt` and asserts no
  time value is rendered. A positive control confirms the page **can** render a
  provider-reported expiry when one is present, so the absence is a decision and
  not an omission.

- [ ] 4.2 Make every failure state visible and retryable, naming the condition
  when it is known and showing no address. Verify: a throttled failure and an
  unavailable-provider failure each render their own message with a retry, and
  neither renders an address.

- [ ] 4.3 Confirm no untrusted value is inserted as markup. Verify: the website
  uses the rendering layer's own escaping for every provider- or message-derived
  string, with no `dangerouslySetInnerHTML` or equivalent anywhere under `apps/`;
  the architecture scan asserts the absence of both.

## 5. Boundaries, gates, and the record

- [ ] 5.1 Widen `tests/architecture/boundaries.test.ts` to cover
  `packages/mailbox`: no framework import, with the rule's scope limit stated in
  the rule's own comment. Verify: introducing `react` into a real file in the
  package makes the suite exit non-zero **naming that file and line**, and the
  file is restored byte-identical.

- [ ] 5.2 Add the same rule's negative control. Verify: a `fetch` parameter name,
  a doc comment, and the live `packages/providers/src/transport.ts` all stay
  silent — this is the control that would catch a rule firing on its own
  documentation, which has happened twice in this repository.

- [ ] 5.3 Run the falsification pass over every assertion this change adds,
  including a positive control in the opposite direction for each group. Verify:
  each mutation is observed to exit non-zero **naming the intended test**, the
  conforming case is observed still passing, and every mutated file is restored and
  confirmed byte-identical by hash. A mutation that turns the suite red on an
  unrelated assertion is a defective mutation and is corrected, not counted.

- [ ] 5.4 Run the full gate and record it honestly: `pnpm verify`,
  `pnpm --dir tests/provider-spike spike:selftest`, and
  `openspec validate mailbox-session-layer --type change --strict`. Verify: all
  exit 0, and the record states that the suite proves the session composes the
  abstraction correctly and **nothing about Guerrilla Mail's live behaviour**, since
  every provider interaction replays a recording.

- [ ] 5.5 Update `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and
  `README.md` with only what has been verified: the real test counts, that a
  fourth shared package exists and why the roadmap's list was amended, that the
  website reaches one provider for a measured reason, and that **a reload discards
  the mailbox** because storage is M6. Verify: every count quoted matches an
  observed run, and no document claims a user-visible milestone beyond this slice.

- [ ] 5.6 Perform an independent verification pass comparing the implementation
  against `specs/mailbox-session/spec.md` and `specs/website-client/spec.md`
  rather than against these boxes. Verify: every scenario is either covered by a
  test that genuinely exercises it or is **explicitly recorded as uncovered with
  its reason**. A scenario whose only coverage would pass with the behaviour
  removed is a vacuous scenario and must be fixed or reported, not counted.
