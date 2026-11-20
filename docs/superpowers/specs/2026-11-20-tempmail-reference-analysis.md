# Temp Mail reference analysis — measured 2026-11-20

## Instrument

Live `https://temp-mail.org/en/` inspected in the user's real Chrome through the
`browse` extension (Playwright is Cloudflare-blocked on this host and was **not**
used as the reference instrument). DOM extraction via `tools.browse.eval` returned
`getBoundingClientRect()` and `getComputedStyle()` for every container below.
Screenshots were captured at the three goal viewports with `browse.emulate` +
`browse.screenshot`, saved under `C:\Users\Edison\AppData\Local\Temp\opencode\ref\`
(`ref-desktop2`, `ref-split2`, `ref-mobile2`).

## Structure and measured geometry

### Header (dark)

- `header.main-header`: full width, **79px** tall, background `rgb(33,35,42)`,
  padding `20px 0`.
- Left: two outlined pills "App Store" / "Google Play". Centre: envelope mark +
  `TEMPMail` wordmark. Right: "Virtual Number" pill and a yellow "Premium" pill.
- **Deviation:** SpectreMail has no store listings, no subscription and no virtual
  number product; the two sides carry truthful facts ("No account", "No server",
  "Disposable", "Guerrilla Mail") instead of dead controls.

### Dark hero band

- `div.section-top-qr`: full width, **310px** tall, `rgb(33,35,42)`, padding `20px 0`.
- Dashed panel `div.temp-emailbox`: **556 × 169px**, `2px dashed rgb(56,59,68)`,
  radius `10px`, padding `30px 0`, centred.
- Heading `h2`: mono (`Roboto Mono`), **20px / 700**, white, centred, text
  "Your Temporary Email Address", at y≈131.
- Field wrapper `div.input-warp`: **400 × 60px**, background
  `rgba(255,255,255,0.04)`, radius `30px`, padding `4px`. Inside: the address at
  20px, a `QR code` button and a green circular Copy button (`rgb(0,196,151)`,
  radius 50%).
- Below the panel: three centred mono lines of muted copy beginning "Forget about
  spam, advertising mailings, hacking and attacking robots...".

### Light action strip

- White full-width band, ~**78px** tall.
- Four pills, each **160 × 52px**, radius `25px`, background `rgb(246,247,249)`,
  subtle shadow (`rgba(34,36,43,0.16) 0 2px 4px`), mono 16px/500, left icon.
  Labels: **Copy | Refresh | Change | Delete**, evenly spaced and centred.
- At 956px and 390px the four wrap to a 2×2 grid.

### Inbox

- Light grey area; centred container ~**720px** wide.
- Dark header bar `rgb(30,32,39)`, **54px** tall, mono 16px/700 white cells:
  `SENDER` / `SUBJECT` / `VIEW`.
- Empty state: centred envelope-with-circular-arrow illustration, then "Your inbox
  is empty" (mono 20px, `rgb(88,93,106)`) and "Waiting for incoming emails"
  (mono 16px, muted).
- At 390px the three headers collapse to one `INBOX` label.

### Message reader / states

- Rows show sender, subject and a view action; opening a message renders it with a
  back control to the inbox. Loading shows "Loading.." in the field.

## Deviations (explicit)

1. No App Store / Google Play / Virtual Number / Premium links — unavailable, and
   dead controls are forbidden by the product's own rules.
2. No QR-code control — SpectreMail has no QR feature.
3. The field's Copy circle uses the declared purple accent, not the reference's
   green, per "keep SpectreMail's accent where appropriate".
4. The long marketing paragraphs below the panel are replaced by one truthful
   sentence; the goal requires removing explanatory sections.
5. `Delete` clears this device's saved address — the provider exposes no mailbox
   deletion API — documented rather than fabricated.
6. The address is 16px mono instead of 20px proportional: a mono address at the
   reference size does not fit the 400px field without wrapping the domain.
