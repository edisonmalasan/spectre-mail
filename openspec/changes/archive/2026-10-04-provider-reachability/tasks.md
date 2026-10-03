# Tasks

Scope: M5 slice 4. Resolve the provider line honestly and correct M5's recorded
scope so the milestone's exit criteria are achievable. See `proposal.md` for why,
`design.md` for how, and `specs/website-client/spec.md` for what is required.

## 1. The provider configuration becomes a single source of truth

- [x] 1.1 Drive `createWebsiteProviderManager` from `WEBSITE_PROVIDER_IDS` through a
      local id-to-adapter registry, per `design.md` D1, and verify the manager's
      `available` still resolves to exactly Guerrilla Mail by assertion.
- [x] 1.2 Add a control proving the derivation is real rather than coincidental: a
      test that fails when the factory stops reading the list. Verify the control
      fails when the list is ignored, and passes when the derivation is present —
      a coincidental length match must not be able to satisfy it.
- [x] 1.3 Correct the two comments that state the indirection exists: the
      `WEBSITE_PROVIDER_IDS` docstring in `provider-config.ts`, and the concession
      in `provider-config.test.ts` that the two constants "must be changed
      together". Verify no comment in the repository still claims the list is
      something it is not, by reading the diff rather than by grep for a phrase.
- [x] 1.4 Confirm the boundary rules need no change and say so from measurement, not
      assumption: the registry names `createGuerrillaAdapter` inside the module
      already allowed to name it. Verify `tests/architecture/boundaries.test.ts`
      passes unmodified, and record that it was checked rather than assumed.

## 2. The selector's absence becomes an unconditional requirement

- [x] 2.1 Add the test the new `website-client` scenario calls for: the page offers
      no provider-selection control **and names the provider it reaches**, in every
      rendered state. Verify it fails when the naming line is removed from the
      limits list, so it is not satisfied by the absence of a control alone.
- [x] 2.2 Keep the existing conditional scenario and its test, and update the test's
      comment, which currently states it is "expected to be **replaced**" when the
      selector slice lands. That replacement is not happening, per `design.md` D3,
      so the comment becomes false the moment this change lands. Verify the comment
      no longer predicts a replacement and still records why the conditional
      scenario is kept.
- [x] 2.3 Assert the page never describes the absence as missing or forthcoming, so
      "coming soon" and "unavailable provider" phrasing is caught. Verify the
      assertion has a fixture that would trip it — a page rendering that text must
      be caught, or the assertion passes for no reason.

## 3. `docs/ROADMAP.md` records M5's real scope

- [x] 3.1 Amend M5's acceptance-criteria table so each line names the slice or
      milestone that delivers it: the two storage-dependent lines to M6 over
      `SpectreStorage`, and copy-the-OTP to M10. Verify every one of the eight lines
      resolves to a slice or milestone, by reading the table against
      `docs/ROADMAP.md`'s own milestone list rather than against memory.
- [x] 3.2 Restate the remaining-slices line with the reason each is or is not
      currently buildable: theme needs M7's tokens, history and clear-data need M6's
      storage, and the provider line is resolved by this change. Verify each claim
      cites the file that establishes it — `packages/ui/src/index.ts` and
      `packages/storage/src/index.ts` — and not this document's own summary.
- [x] 3.3 Record the milestone-scope correction and its reason in the Project
      Status block, which a later session is told to reconcile before trusting.
      Verify the block names M6 as the next objective and states why, so the
      delivery-order rule no longer points at a milestone whose remaining slices are
      all blocked.

## 4. Verification

- [x] 4.1 Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
      `pnpm test`, `pnpm build`, and `pnpm verify`. Verify every command's exit code
      is read from output, and that test counts are read from the reporter rather
      than summed by hand.
- [x] 4.2 Run a falsification pass over this change's own assertions with a script
      kept outside the repository: every new assertion must be **observed to fail**
      with the intended test named, and every mutated file restored byte-identical
      by hash. Verify restoration is reported separately from the results.
- [x] 4.3 Record what this change does **not** establish, in each document's own
      words: no live browser run of the website has ever been made, every provider
      interaction in every test replays a recording, and `pnpm test` is not a claim
      about types. Verify each statement appears where a reader of that document
      would look for it.

## 5. Docs

- [x] 5.1 Update `AGENTS.md` and `README.md` for the configuration change: one list
      configures the website, and no provider selector exists. Verify any statement
      about the selector's absence matches the requirement rather than the
      superseded comment.
- [x] 5.2 Update `docs/ARCHITECTURE.md`'s website section for D1 and D3. Verify the
      boundary-rule section still describes the rules that exist and names no rule
      this change did not add.