# Objective UI/UX mismatch fixes — implementation report

Date: 2026-11-22. Scope: three measured, objective mismatches between the built SpectreMail
website and the dated Temp Mail reference captured under `docs/ux-reference/`. This record holds
only what was changed and what was run; it makes no aesthetic judgement and does not restate the
protected reference prose.

Ownership honoured: edits are confined to `apps/web/src/**`, `apps/web/e2e/**` and this new file.
Nothing was written to `docs/ux-reference/independent-ui-comparison.md`,
`docs/ux-reference/independent-captures/**`, `AGENTS.md`, `ROADMAP.md`, `docs/PROVIDERS.md`,
OpenSpec artifacts or `.github/workflows/`. No token value, `DESIGN.md`, `tokens.ts` or other
package was touched. No sixth page region was added.

## Finding 1 (major) — reference URL spellings rendered the home product

**Measured defect.** Nine reference article URLs were accounted for; seven of them answered HTTP
200 while rendering the home product (`productMounted=true, articleMounted=false`) because an
unrecognised path falls through to `<App />` in `main.tsx`. The two that already worked were
`/privacy-policy` and `/terms-of-service`.

**Fix.** Added an optional `aliases` field to `PublicRoute` in
`apps/web/src/public-routes.ts` and populated it for the seven affected routes:
`/en/change`, `/en/faq`, `/en/api`, `/en/10minutemail`, `/en/email-generator`, `/en/contact`,
`/blog/`. `routeFor()` in `apps/web/src/PublicRoutePage.tsx` now resolves a path against the bare
canonical `path` **or** its aliases, returning the same `PublicRoute` object for both. The bare
paths stay canonical — links and the footer still render `route.path` — and the original
SpectreMail copy has exactly one home, so the two spellings cannot drift into different articles.
No Temp Mail prose was copied.

**Evidence.** New `apps/web/e2e/reference-alias.spec.ts`:

- one case enumerates all seven aliases (so a silently dropped alias fails);
- 14 cases — every alias at a 1440×900 desktop viewport and a 390×844 mobile viewport — each
  requiring HTTP 200, the article H1 and `.public-route`, and **zero** address field / hero panel;
- one case compares each alias's `.public-route` HTML byte-for-byte with its canonical path.

## Finding 2 (major) — article region held no links

**Measured defect.** `[data-region="articles"]` rendered three plain `<li>` items and zero links,
while the reference has six; the source comment still said real routes would arrive in a future
task even though all nine are served.

**Fix.** `ArticlesSection` in `apps/web/src/PageSections.tsx` now renders six real anchors to served
routes (`/faq`, `/10minutemail`, `/email-generator`, `/change`, `/privacy-policy`, `/blog`), and the
stale comment is replaced with the reason they are links now. The anchors reuse the existing
`.link__anchor` hook, so they inherit the declared palette and the declared keyboard focus ring
without adding a token, a colour declaration or a new class hook.

**Evidence.** `reference-alias.spec.ts` asserts the region holds exactly six anchors, each with
non-empty text, an `href` that is a canonical `PUBLIC_ROUTES` path (not an alias, hash or invented
route), and a browser navigation that mounts an article and no product field. The focus suite's
full keyboard walk already covers the new links' focus indicator.

## Finding 3 (minor) — missing second Copy-button animation

**Measured defect.** The reference Copy control shows a second one-shot, fill-backwards feedback
animation on the button itself in addition to the tooltip fade. SpectreMail had only the tooltip
fade, which is an **exact** match (150 ms / linear / fill backwards / opacity 0→0.9) and was left
unchanged.

**Fix.** Added `@keyframes spectre-copy-feedback` and a `.address__copy--copied` rule in
`apps/web/src/styles.css`, using only declared motion tokens: `var(--duration-feedback)` (the
declared 150 ms) and `var(--ease-standard)` (the declared easing token), with `backwards` fill.
`Address.tsx` applies the state class whenever a copy outcome is showing, so the feedback plays on
a press rather than once on page load. The reduced-motion block also stops the new animation.

**Easing note.** The reference's easing is described as `ease-in-out`. No `ease-in-out` token is
declared, and this task forbids editing `tokens.ts`/`DESIGN.md` and restating an easing literally
in the stylesheet. The declared eased token `--ease-standard` is therefore used; this gives an
eased (non-linear, one-shot, fill-backwards) 150 ms feedback while honouring "declared motion
tokens only" and keeping the token layer byte-identical. No literal duration or easing function
was written into the stylesheet.

**Evidence.** `apps/web/e2e/motion.spec.ts` now includes `.address__copy--copied` in the stylesheet
audit and stops it under reduced motion, and adds two cases: one reads the button's computed
animation before a copy (`none`) and after a copy (`spectre-copy-feedback`, 150 ms, `backwards`,
declared easing) while re-asserting the tooltip fade is still `spectre-tooltip-fade` / linear /
backwards; the other requires reduced motion to remove the button feedback. The existing
`spectre-tooltip-fade` assertions and the tooltip's opacity declaration are untouched.

## OpenSpec delta consideration

No OpenSpec delta was judged mandatory: all three fixes are corrections inside already-served
routes and already-declared motion tokens, changing no product capability, requirement, page
region count or token value. Work stopped short of OpenSpec artifacts as instructed.

## Verification actually run (verbatim results)

- `pnpm verify` — **exit `0`**; `Test Files 79 passed (79)`, `Tests 1440 passed (1440)`,
  `pnpm build` emitted both clients. The first attempt was red only because a redirected output
  file written into the repo root tripped the architecture suite's shipped-tree fingerprint
  guard (`changed: verify-output.txt`); the file was removed and the gate re-run clean, with
  output written outside the tree.
- `pnpm --filter @spectre-mail/web build` — **exit `0`**, Vite emitted `dist/` (91 modules).
- `pnpm --filter @spectre-mail/web test:browser` — **exit `0`**, website tier summary
  **`70 passed (23.6s)`**. All 17 new alias/link cases and both new motion cases ran and passed.

## Limitations

- No test here reads a rendered pixel. The alias and link checks read DOM/HTTP/copy identity; the
  motion check reads a computed animation declaration on the built page. Whether the feedback
  _looks_ right is a human judgement outside every gate.
- The feedback class is applied while a copy outcome is showing, so a second press inside the
  same ~2.2 s outcome window does not restart the one-shot animation; restart-per-press was not
  part of the measured mismatch and was not added.
