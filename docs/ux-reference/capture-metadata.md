# M16 capture metadata and reproduction

Date: 2026-11-21. Browser: user's Chrome driven by OpenCode Browse extension (desktop browser tools), plus Playwright Chromium 1.63 for SpectreMail screenshots. Zoom 100%, deviceScaleFactor 1, fonts loaded (reference uses Roboto + Roboto Mono; SpectreMail uses system-ui + ui-monospace). Reference address values are dynamic and were live; mask them before any diff. No private APIs, auth, rate-limit bypass, or provider mailbox access was used.

## Reference captures

`captures/reference-{desktop,split,tablet,mobile,mobile360}.png` — full-page screenshots:

- desktop 1440×900 → image 1425×4281 (scrollbar reduces width)
- split 956×885 → 941×6175
- tablet 768×1024 → 753×6175
- mobile 390×844 → 390×6822
- mobile360 360×800 → 360×7082

`captures/reference-change-page.png` — full page at `/en/change`.
`captures/reference-qr-dialog.png`, `captures/reference-copy-state.png` — attempted interaction captures; no observable dialog/toast (recorded NOT INSPECTED).
`captures/reference-change-route.webm`, `captures/reference-motion.webm` — CDP screencast recordings of the navigation and Copy attempts. The recorder fell back to screenshot frames (~2.7 fps achieved), so these are interaction records, not smooth video.

SpectreMail captures: `captures/spectre-{desktop,split,tablet,mobile,mobile360}.png` at the same viewports, built from `main` at the M16 start.

## Reproduction

OpenCode Browse extension tools (real Chrome):

```
navigate https://temp-mail.org/en/ (allowed origin temp-mail.org, *.temp-mail.org)
emulate viewport {width, height, deviceScaleFactor:1, mobile: width<=390}
wait_for text "Your Temporary Email Address"
screenshot fullPage=true path=docs/ux-reference/captures/reference-<name>.png
```

For geometry, `eval` with `getBoundingClientRect()` and `getComputedStyle()`; read `document.getAnimations()` for active animations. Route inventory: navigate each URL in `reference-inventory.md`, then `eval` for headings/controls/text.

SpectreMail: `pnpm build:web`, serve `apps/web/dist` with `vite preview --port 4173 --strictPort`, then Playwright `page.screenshot({fullPage:true})` at the five viewports.

## Capture limits

- Cross-origin stylesheet `cssRules`/`media` were unreadable via `eval`: breakpoints and keyframes are UNKNOWN from this method; do not infer them.
- No controlled incoming message was sent, so populated-inbox and message-reader reference states were not captured.
- Only public no-account free routes were visited; premium/auth/app routes were not inspected and are out of scope.
