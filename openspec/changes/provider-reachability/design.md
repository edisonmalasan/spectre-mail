# Design

## Context

The website reaches exactly one provider. `apps/web/src/provider-config.ts`
exports `WEBSITE_PROVIDER_IDS = ["guerrilla"]` and a factory that calls
`createProviderManager([createGuerrillaAdapter({ transport, now })])`. The factory
never reads the constant.

The constant's own documentation claims an indirection that does not exist:

> A named constant rather than a value inlined at the call site, so a test can
> read the configuration instead of inferring it from rendered output, and so
> adding a provider is a visible edit to one list rather than a change spread
> across call sites.

"Adding a provider is a visible edit to one list" is false. It is an edit to the
list *and* to the factory. The gap is already documented rather than hidden — the
test at `provider-config.test.ts:51` says so, and pins the coupling with
`expect(manager.available).toHaveLength(WEBSITE_PROVIDER_IDS.length)`, an assertion
of coincidental equality.

Three constraints shape the approach, and all three are measurements or approved
rules rather than preferences:

- `provider-abstraction` forbids adding a provider a client cannot legally or
  technically reach, and forbids proxying one into reachability.
- Mail.tm's refusal of third-party CORS was measured against the live API in M0
  and is recorded in `docs/PROVIDERS.md`.
- M5 is structure, not appearance. No styling, token, or theme work belongs here.

See `proposal.md` for why this change exists and `specs/website-client/spec.md` for
what it requires.

## Goals / Non-Goals

**Goals:**

- One list is the website's provider configuration, and the factory derives from
  it. A test fails if the derivation is removed.
- The absence of a provider selector becomes an unconditional requirement, and the
  page names the provider it reaches.
- `docs/ROADMAP.md` records which M5 acceptance lines are delivered by M6 and M10,
  so the milestone's exit criteria are achievable.

**Non-Goals:**

- **No provider selector, and no preparation for one.** A `<select>` over one
  reachable option is a control that cannot act.
- **No styling, tokens, or theme.** `packages/ui/src/index.ts` states design
  tokens are applied from M7. The theme toggle listed in M5's V1 features has
  nothing to toggle until then.
- **No storage.** `SpectreStorage` is M6 and `packages/storage` is an M1
  placeholder with no exports.
- **No change to `provider-abstraction`.** Its clauses are cited, not restated.
- **No extension work.** The extension's Mail.tm-primary configuration is a
  different environment reaching a different provider; it is M8.

## Decisions

### D1 — The factory derives from the list, by lookup over a local registry

`createWebsiteProviderManager` maps each id in `WEBSITE_PROVIDER_IDS` to an adapter
through a small local registry, and passes the resulting array to
`createProviderManager`.

*Alternative considered — delete the constant and keep only the factory.* Rejected:
it removes the one thing a test can read to learn the configuration without
rendering anything, and it makes the configuration invisible to
`tests/architecture/boundaries.test.ts`, which reads the exported list.

*Alternative considered — move the registry into `packages/providers`.* Rejected:
a registry mapping id to adapter is client configuration, and putting it in the
shared package would let a client import an adapter it must not reach. The
boundary rule that confines adapters to `packages/providers` already exists; a
shared registry keyed by id would weaken the reason it exists.

*Cost, stated honestly.* A lookup can fail at runtime for an id with no entry,
whereas the direct construction could not. The map is total over the ids actually
declared, and a missing entry is a programming error that should fail loudly at
startup rather than degrade silently.

### D2 — The selector's absence is required, and the provider is named

The page states which provider it reaches. `App.tsx`'s limits list already says
"It reaches Guerrilla Mail and nothing else", and that line is what the new
scenario pins.

*Alternative considered — render an inert, disabled selector showing the single
provider.* Rejected: a disabled control communicates "unavailable" to a user who
has no way to make it available, which is the "coming soon" framing the existing
test at `App.test.tsx:735` explicitly forbids. It would also require styling to
communicate its disabled state, which M7 has not delivered.

### D3 — The existing conditional scenario is kept, not replaced

The delta adds a scenario rather than rewriting the conditional one, because
`openspec validate --strict` refuses a `MODIFIED` block that drops a scenario the
current spec has. The refusal turned out to be correct: its clauses are a sound
rule for any client that renders a selector, including the extension at M8.

*Alternative considered — delete it and satisfy the validator by moving the whole
requirement to `REMOVED` and re-adding it.* Rejected: `REMOVED` retires a
requirement rather than editing one, and the audit trail would misrepresent a
clarification as a retirement.

### D4 — The roadmap amendment is in this change

`docs/ROADMAP.md`'s M5 acceptance table names M6 for two lines and M10 for a
third. The correction goes in the same change as the work, following M5 slice 1's
precedent of amending this roadmap's shared-package list rather than leaving the
document to disagree with the tree.

*Alternative considered — amend the roadmap in its own change first.* Rejected: it
would produce a commit whose only content is a table edit, and the reason for the
amendment — that the remaining slices are blocked — is only visible alongside the
slice that documents the blocking.

### D5 — The boundary rule is extended rather than assumed

The existing rule confines naming a provider *adapter* to `packages/providers`, its
own `provider-config.ts`, and test files. The registry in D1 names
`createGuerrillaAdapter` inside that same allowed module, so no rule change is
required. This is recorded because "no rule change needed" is a claim, and the
claim is only worth something if someone checked.

## Risks / Trade-offs

- **The registry makes a configuration error possible that direct construction
  could not** → the lookup is total over the declared ids, and a new id without an
  entry fails immediately rather than at first use. A test asserts the derived set
  equals the declared list, which is the assertion that would catch it.
- **The change is small, and small changes get skipped** → the roadmap amendment is
  the larger half. It is what makes M5's exit criteria achievable, and it is easy
  to leave undone.
- **A future reader may add a second provider to the website and not read
  `provider-abstraction`** → the boundary rule forbids reaching an inaccessible
  provider, and D1's scenario requires the website to reach only providers it can
  actually access. Both are enforced, not merely documented.
- **`App.test.tsx`'s selector test will need its comment updated** → it currently
  says it is "expected to be **replaced**" by a later slice. That replacement is
  not happening, so the comment becomes false the moment this change lands. It is
  a task, not an afterthought.

## Migration Plan

None. No persisted state, no schema, no provider change, no user-visible
regression: the page reaches the same single provider and renders the same states.
The change is reversible by reverting one commit.

## Open Questions

None. Every question this design raised — whether a selector is buildable, whether
the constant should be deleted, whether the conditional scenario should be dropped
— was answered by a measurement, an approved rule, or the validator, and the
answers are recorded above with what was rejected.