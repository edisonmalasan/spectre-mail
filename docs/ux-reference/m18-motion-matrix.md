# M18 motion matrix — reference vs SpectreMail

Date: 2026-11-21. Reference measured in real Chrome via OpenCode Browse `eval`/`recording`;
local measured by Playwright against the built website. A status of UNKNOWN means the reference
could not be read, NOT that the product is instant.

| Effect                                       | Trigger                                    | Reference measurement                                                                                         | Local measurement                                                                                               | Status                                         |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Copy feedback fade                           | toolbar Copy click                         | `tooltip fade bs-tooltip-bottom show`, 2 elements, opacity 0→0.9, **150 ms linear**, fill backwards, one-shot | `.toast` `spectre-tooltip-fade`, 150 ms linear, fill backwards, opacity 0→0.9; field box unchanged before/after | PASS (timing/geometry)                         |
| Copy feedback under reduced motion           | Copy with `prefers-reduced-motion: reduce` | UNKNOWN (not observable this session)                                                                         | `animationName: none`                                                                                           | UNKNOWN reference / implemented conservatively |
| Product entrances (address, inbox row, code) | element first appears                      | NOT INSPECTED for reference product UI; no product transition observed                                        | `materialise` 120/200 ms, token-timed, reduced-motion `none`                                                    | UNKNOWN reference                              |
| Ad/spinner rotation                          | page load                                  | 4 SVG `rotation` animations, **2000 ms linear infinite**                                                      | not present (out of scope: advertising)                                                                         | OBSERVED / APPROVED DEVIATION                  |
| Refresh spinner                              | Refresh click                              | NOT INSPECTED                                                                                                 | no animation (status text only)                                                                                 | NOT INSPECTED                                  |
| Mailbox replacement                          | Change click                               | NOT INSPECTED                                                                                                 | old address stays until new mailbox confirmed, no layout collapse                                               | NOT INSPECTED reference                        |
| Message open/back                            | row click / Back                           | NOT INSPECTED                                                                                                 | reader replaces inbox; inbox kept mounted and hidden so no row re-entrance                                      | NOT INSPECTED reference                        |

## Capture artifacts

- `captures/reference-motion.webm` — CDP screencast of a reference Copy attempt; the recorder fell
  back to still frames (~2.7 fps achieved), so the timing above comes from the Web Animations API,
  not from counting frames.
- `captures/reference-change-route.webm` — reference navigation to `/en/change`, same frame-rate
  limitation.
- No local video is claimed: the local assertions read computed styles and element boxes from the
  built page under Playwright, which is a different instrument.

## Honest limits

No high-severity motion discrepancy is labelled complete: where the reference was not observable,
the row says UNKNOWN or NOT INSPECTED, and the local behaviour is recorded without claiming
parity. The one measured product effect (Copy fade) matches its timing and leaves layout stable.
