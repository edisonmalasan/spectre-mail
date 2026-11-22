# Tasks — M22 Provider Catalog Foundations

## 1. Shared provenance model

- [ ] 1.1 Resolve the orchestrator decision recorded as Open Question 1 in
      `design.md` (same-spelling domains from different providers) and write the
      chosen policy into the design record; verify the requirement holds under the
      choice and no spec text is changed.
- [ ] 1.2 Add provider-sourced provenance fields to `Domain` in `packages/core`
      (discovery time, supported runtime, lifecycle/status, capability flags; a
      free/premium field only where a provider reports one), and verify
      `pnpm --filter @spectre-mail/core typecheck` plus new domain tests cover a
      provider-reported case and an unreported case without inventing a premium value.
- [ ] 1.3 Update every `Domain` construction site until `pnpm typecheck` is green;
      verify no fixture or product code supplies a premium value no provider reported.

## 2. Adapter capabilities and catalog provenance

- [ ] 2.1 Extend the contract's typed capability surface with domain-listing,
      chosen-domain-creation and restore answers, distinguishing "unobserved"
      from "known absent", and verify adapter and conformance tests read every
      flag from that surface while no client tests a provider identifier.
- [ ] 2.2 Expose the catalog's fetch time and aggregate provider catalogs so every
      entry keeps its supplying provider and runtime compatibility is filtered,
      and verify `catalog.test.ts` covers two same-spelling entries from different
      providers plus a foreign-domain refusal.
- [ ] 2.3 Bound pagination and report truncation, and verify the synthetic
      two-page fixture case is labelled synthetic and asserts an incomplete
      result rather than a whole inventory.
- [ ] 2.4 Verify a provider with no domain API contributes an empty catalog and
      that no rendered provider website list is used as one.

## 3. Bounded visible fallback and truthful failure

- [ ] 3.1 Keep creation fallback bounded to one attempt per configured provider,
      confined to creation, with the throttle surfaced verbatim, and verify
      manager tests with two stub providers show no second attempt or silent loop.
- [ ] 3.2 Preserve the normalized error code when several providers decline,
      and verify the counterfactual case fails when the composed failure is an
      untyped error whose only detail is prose.

## 4. Request-bound answers and three truth claims

- [ ] 4.1 Attach a generation token and coalescing guard at the calling seam so a
      late answer from an older request is discarded, and verify the stale answer
      neither replaces a newer mailbox nor restores a cleared reader selection.
- [ ] 4.2 Route every mailbox and message request to the provider and session that
      created it, and verify no fallback is consulted for an existing mailbox.
- [ ] 4.3 Model catalog-available, provider-confirmed-provisioned and
      `LIVE DELIVERY NOT VERIFIED` as three distinct reported facts in both
      clients' copy modules, and verify a recorded fixture or successful create
      never upgrades an address to delivery-verified.

## 5. Minimal Automatic/manual domain selection UX

- [ ] 5.1 Add a Change control beside Copy in the extension popup that opens the
      usable-domain list with Automatic first and manual rows, taking every label
      from `POPUP_COPY`, and verify `Popup.test.tsx` and copy-module tests assert
      the rendered names and that a chosen domain reaches `session.replace(domain?)`.
- [ ] 5.2 Coalesce repeated presses and discard out-of-order answers in the popup,
      and verify its own unit cases mirror the website's two-press and
      older-answer recovery cases rather than relying on a browser-only test.
- [ ] 5.3 Keep the previous mailbox until the provider confirms a replacement and
      clear the opened-message selection only on success, and verify both the
      failure-preservation and reader-clearing cases at the popup layer.
- [ ] 5.4 Preserve composition and accessibility, and verify the five regions,
      four actions, keyboard reachability and unchanged token/motion set through
      the existing browser cases and `tests/architecture/boundaries.test.ts`,
      adding a stylesheet rule for every new class hook rather than exempting it.
- [ ] 5.5 Verify the website needs no code change: its existing picker and guards
      already satisfy the selection requirement, and no `website-client`,
      `page-composition` or `visual-system` requirement is modified.

## 6. Integration verification

- [ ] 6.1 Run `pnpm verify` with no browser installed and record its exact exit
      code and output; a green run here does not cover either browser tier.
- [ ] 6.2 Run the website and extension browser tiers separately and sequentially,
      recording each tier's case count and exit code; name any red before
      attributing it and record a run with no tier summary as `HARNESS-ERROR`.
- [ ] 6.3 Produce the falsification table for every new assertion: mutation,
      catching assertion, byte-identical restoration, and the conforming case
      passing; report a survivor as "not caught" until the mutant has been read.
- [ ] 6.4 Run `openspec validate m22-provider-catalog-foundations --strict` and
      Prettier over the change's own files, recording exact output for both.

## 7. Sync and archive (orchestrator-owned handoff)

- [ ] 7.1 Promote the delta on its own branch and PR, re-count requirements and
      scenarios by heading, and verify each promoted `MODIFIED` block is
      byte-identical to its delta block with every pre-existing scenario intact.
- [ ] 7.2 Archive with `--skip-specs` after sync is merged, verify archived files
      byte-identical against pre-archive digests and `openspec list` reporting no
      active changes; record any human-only blocker as `BLOCKED` or
      `NOT VERIFIED` rather than closing it.
