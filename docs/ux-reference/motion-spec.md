# M16 — Temp Mail reference: motion specification (observed only)

> **Status: investigation evidence only. No implementation claims. GOAL is NOT MET.**
> This file records only animation that the browser actually reported. It deliberately contains
> **no invented fades, spinners, springs or transitions** for effects that were not observed.

## Capture metadata

| Field                   | Value                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Capture date            | 2026-11-21                                                                                                      |
| Browser                 | Real Chrome via the OpenCode Browse extension; Chromium                                                         |
| Zoom                    | 100%                                                                                                            |
| Device pixel ratio      | 1                                                                                                               |
| Fonts loaded at capture | Roboto + Roboto Mono (confirmed loaded)                                                                         |
| Viewports captured      | 1440×900 (full page 1425×4281); 956×885 (941×6175); 768×1024 (753×6175); 390×844 (390×6822); 360×800 (360×7082) |
| Dynamic values          | Live address values present; **mask in comparisons**                                                            |
| Instrument              | Live `document.getAnimations()` read in the browser; capture set under `docs/ux-reference/captures/`            |

### Status labels

- **MEASURED** — directly returned by the browser or observed on screen.
- **INFERRED** — reasoned from a measurement; not a direct observation.
- **UNKNOWN** — looked for but not obtainable.
- **NOT INSPECTED** — not observed this session; no negative claim made.

---

## Observed animation — `rotation`

`document.getAnimations()` returned **four** animations on the reference home page. All four were
identical in form and were attached to **advertisement iframes/spinners**, **not to core product UI**.

| Field                                      | Value                                                                                                    | Status                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Animation name                             | `rotation` (all four)                                                                                    | **MEASURED**                                 |
| Count                                      | 4                                                                                                        | **MEASURED**                                 |
| Duration                                   | 2000 ms (all four)                                                                                       | **MEASURED**                                 |
| Easing                                     | `linear`                                                                                                 | **MEASURED**                                 |
| Iterations                                 | `Infinity`                                                                                               | **MEASURED**                                 |
| Play state at read                         | `running`                                                                                                | **MEASURED**                                 |
| Location / subject                         | Advertisement iframes / spinners, not core product UI                                                    | **MEASURED**                                 |
| Trigger                                    | **UNKNOWN** — animations were already running at read time; the initiating event was not observed        | **UNKNOWN**                                  |
| Initial state (frame 0)                    | **UNKNOWN** — keyframe contents were not readable (see limitations)                                      | **UNKNOWN**                                  |
| Final state                                | **UNKNOWN** — `Infinity` iterations means there is no terminal frame                                     | **MEASURED** (no final) / detail **UNKNOWN** |
| Keyframes / `transform` / `opacity` values | **UNKNOWN** — could not be read from the cross-origin stylesheet; do not assume a rotation axis or angle | **UNKNOWN**                                  |
| Repeat-click behavior                      | **NOT INSPECTED** — no second activation was performed against an ad spinner                             | **NOT INSPECTED**                            |
| Reduced-motion behavior                    | **NOT INSPECTED** — no `prefers-reduced-motion` emulation was recorded                                   | **NOT INSPECTED**                            |
| Capture                                    | `captures/reference-desktop.png` (home page containing the ad iframes/spinners)                          | **MEASURED**                                 |

**Interpretation limit (INFERRED):** because the subject is advertisement content, this animation is
**out of the SpectreMail reconstruction scope** under the M16 rule that advertising states are
inventoried but not faked. It is recorded here as the only observed animation, not as a target to reproduce.

---

## Core product UI — no observed motion

None of the following produced an observed transition, animation, toast or spinner in this session.
Each is listed as **NOT OBSERVED** with the effect status **NOT INSPECTED** where the action itself was
not exercised; no duration, easing or keyframe is asserted for any of them.

| Effect                                                    | What was checked                                                                     | Result                                                          | Status            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------- |
| Initial address generation                                | Address input was live at capture; no generation sequence was watched frame-by-frame | No generation animation observed                                | **NOT INSPECTED** |
| In-field Copy feedback                                    | Round 52×52 Copy button clicked                                                      | No observable dialog or toast text; no animation observed       | **NOT INSPECTED** |
| Toolbar Copy feedback                                     | Pill not activated separately                                                        | No transition observed                                          | **NOT INSPECTED** |
| Refresh feedback                                          | Control not activated                                                                | No spinner or address-change animation observed                 | **NOT INSPECTED** |
| Change / mailbox replacement                              | Change navigation observed (route + controls), but no replacement animation observed | No transition observed                                          | **NOT INSPECTED** |
| Delete                                                    | Control not activated                                                                | No confirmation/removal animation observed                      | **NOT INSPECTED** |
| QR / modal state                                          | QR control clicked                                                                   | No observable dialog or toast text; no modal animation observed | **NOT INSPECTED** |
| Message appearance / row interactions / reader navigation | Inbox and reader were not observed at all                                            | No animation observed                                           | **NOT INSPECTED** |
| Toasts / error / loading / retry                          | Not observed                                                                         | No animation observed                                           | **NOT INSPECTED** |
| Mobile navigation motion                                  | Responsive captures exist (5 viewports) but no motion was recorded within them       | No navigation animation observed                                | **NOT INSPECTED** |

> Explicit statement: the reference was **instant or unobserved** for every core-product control above.
> An absent observation is recorded as **NOT INSPECTED**, not as proof that the reference has no
> animation. **No fade, spinner or transition is added to any reproduction on the basis of this file.**

---

## Inspection limitations (read before using this file)

- **Stylesheet keyframes were unreadable.** The reference stylesheet is cross-origin; `cssRules` and
  media queries were not accessible. Therefore `@keyframes` definitions, `transform`/`opacity` values,
  hover/press/focus rules and breakpoint-linked motion are all **UNKNOWN**. The `rotation` name,
  duration, easing, iterations and play state come from the **Web Animations API only**, not from CSS.
- **No frame-by-frame or video timing extraction** was performed for any core control. The only
  interaction video in the capture set is `captures/reference-change-route.webm`, which documents the
  Change route navigation, not a measured transition.
- **No reduced-motion inspection** was recorded. `prefers-reduced-motion` behavior is **UNKNOWN**.
- **Timings are this browser's reported values** on 2026-11-21 at zoom 100%, dpr 1, Chromium; they are
  not a claim about other engines or a contract for a reproduction.
- **This file contains reference observations only.** No SpectreMail motion was measured here, and no
  parity verdict is claimed. Motion reconstruction and comparison belong to later milestones (M18/M20).

## M18 addendum — Copy tooltip fade (measured 2026-11-21)

The M16 pass sampled animations before activating a control, so it saw only four continuous
`rotation` animations on ad/spinner SVGs. M18 activated the toolbar **Copy** control and read
`document.getAnimations()` immediately afterwards. The reference showed:

| Property       | Measured value                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Element        | `tooltip fade bs-tooltip-bottom show` (a Bootstrap-style tooltip), two elements                         |
| Animation name | unnamed keyframes (Web Animations API reported no `animationName`), so the keyframe identity is UNKNOWN |
| Duration       | **150 ms**                                                                                              |
| Easing         | **linear**                                                                                              |
| Iterations     | 1 (one-shot)                                                                                            |
| Fill           | **backwards**                                                                                           |
| Keyframes      | opacity `0` at offset 0 → opacity `0.9` at offset 1                                                     |

This is the only product-adjacent motion the reference actually demonstrated. It is a feedback
fade, not a layout transition: the tooltip is absolutely positioned and does not resize the
address field. `prefers-reduced-motion` behaviour was not observable in this session (UNKNOWN).
No other control was measured to animate; refresh/change/delete/message-open remain NOT INSPECTED
for motion, not "instant". The four `rotation` animations (2000 ms linear infinite) are on
advertisement SVG paths and are recorded as OBSERVED / OUT-OF-SCOPE for the product UI.
