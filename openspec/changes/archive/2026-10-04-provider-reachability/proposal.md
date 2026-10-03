# Proposal

## Why

M5's provider line cannot be built the way the roadmap describes it, and M5's
acceptance criteria cannot be met the way they are written. Both facts are
recorded here rather than left to be discovered by the next slice, because the
delivery-order rule keeps selecting M5 as the earliest incomplete milestone while
each of its remaining slices is blocked by a milestone scheduled *after* it.

A user-facing provider selector is not available to build. The website reaches
exactly one provider, for a CORS reason measured against the live API in the M0
spike, and `provider-abstraction` forbids adding a provider a client cannot
legally or technically reach. `apps/web/src/App.tsx` already says what that means
for the UI: "a selector offering only one reachable provider is a control that
cannot do anything." A `<select>` with one option is not a feature, and shipping
one would be the kind of decorative control the design direction rules out.

What *is* available is smaller and real. Two defects sit next to the absent
selector, and one of them is a requirement the repository already fails.

## What Changes

- **The website's provider configuration becomes a single source of truth.**
  `WEBSITE_PROVIDER_IDS` is documented as making "adding a provider ... a visible
  edit to one list rather than a change spread across call sites", and
  `createWebsiteProviderManager` never reads it — it constructs
  `createGuerrillaAdapter` directly. Adding a provider therefore means editing the
  list *and* the factory, which is the spread the documentation denies. The
  existing test asserts the coupling that does not exist
  (`expect(manager.available).toHaveLength(WEBSITE_PROVIDER_IDS.length)`) and its
  own comment concedes "the two constants must be changed together, so that is now
  said rather than implied". This change makes the indirection real.

- **The provider selector stops being a conditional requirement whose condition
  never fires.** `website-client`'s selector scenario reads "WHEN the website
  renders a provider selector" — and the website renders none, so the `WHEN` never
  holds and the scenario constrains nothing. The test that notices this names the
  failure mode exactly: "A conditional scenario with nothing asserting the
  condition is the shape that hides a whole slice: nobody can tell whether the
  selector was forgotten, deliberately deferred, or quietly removed." That test
  also states it is "expected to be **replaced**" when the selector slice lands,
  "and the replacement is the honest thing to do". This change is that replacement:
  the absence becomes an unconditional requirement with its measured reason.

- **`docs/ROADMAP.md` is amended so M5's exit criteria are achievable.** Three of
  its eight acceptance lines are delivered elsewhere: "copy the OTP" is M10's
  (`AGENTS.md`), and "return to a recent mailbox" and "clear local SpectreMail
  data" are marked "over M6's storage" by the roadmap's own table.
  `packages/storage/src/index.ts` confirms the dependency — it is an M1
  placeholder whose `SpectreStorage` contract is M6 work that does not exist yet.
  Two further listed features are blocked the same way: the theme toggle needs
  design tokens, which `packages/ui/src/index.ts` states are applied from M7, and
  the mailbox-history and clear-data slices have nothing to persist until M6.

## Capabilities

### New Capabilities

None. This change resolves and records decisions; it introduces no behaviour that
needs a capability of its own.

### Modified Capabilities

- `website-client`: the requirement *The website reaches Guerrilla Mail and no
  other provider* gains an unconditional statement that no provider-selection
  control is offered and that its absence is not a missing feature, replacing a
  scenario conditional on a selector that is never rendered. It also gains a
  scenario requiring that a second reachable provider be added by editing the
  website's provider configuration alone, which is what makes `provider-abstraction`'s
  existing "adding a second provider SHALL remain additive" clause true for this
  client rather than aspirational.

`provider-abstraction` is **not** modified. Its scenario *A client has only one
provider* already requires that the single-provider dependency be recorded as a
known limitation and that a second provider be additive; this change makes the
website satisfy it, and cites it rather than restating it.

## Impact

**Code.** `apps/web/src/provider-config.ts` — drive the factory from
`WEBSITE_PROVIDER_IDS` so one list is the configuration. `apps/web/src/App.tsx` —
correct the comment that the list is what configures the client. Tests in
`provider-config.test.ts` and `App.test.tsx` — the selector test is replaced by
the requirement it was standing in for, and the configuration test gains a control
that fails if the factory stops reading the list.

**Specs.** `website-client` delta only. The delta carries the reason the selector
is not shipped, so the decision is a contract rather than a comment.

**Docs.** `docs/ROADMAP.md` — M5's acceptance-criteria table names M6 and M10 for
the three lines delivered elsewhere, and the four remaining slices are restated
with the reason each is or is not currently buildable. This is the milestone-scope
correction, made in the same change as the work, following the precedent M5 slice 1
set when it amended this roadmap's own shared-package list.

**Not touched, deliberately.** No styling, token, or theme work (M7). No storage
(`SpectreStorage` is M6). No provider is added to the website. No proxy. No
extension work (M8).

**What this does not establish.** Nothing here is a claim about a live provider, a
real browser, or a real network. No live browser run of the website has ever been
made, and every provider interaction in every test replays a recording.