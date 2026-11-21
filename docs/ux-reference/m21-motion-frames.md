# Paired frame-level motion comparison — Copy tooltip fade

Date: 2026-11-21. This artifact closes the M18 exit gate's frame-comparison requirement for the
**one** motion effect the reference actually demonstrated. It does not claim parity for effects
the reference never showed (those remain UNKNOWN/NOT INSPECTED in `m18-motion-matrix.md`).

## Method

Both surfaces were sampled with the same controlled-replay instrument: a page-side hook pauses the
one-shot animation as soon as it appears, then `currentTime` is set to each offset and the
computed opacity is read. This avoids relying on the screencast recorder, which fell back to
sparse screenshot frames (~2.7–6.9 fps) in the reference session.

- Reference: `temp-mail.org/en/`, toolbar Copy click, tooltip `tooltip fade bs-tooltip-bottom show`.
- Local: built `apps/web/dist`, in-field `Copy address`, `.toast` with `spectre-tooltip-fade`.
- Reproduce locally: `node apps/web/e2e/motion-frames.mjs`.

## Samples

| Offset (ms) | Reference opacity | SpectreMail opacity | Match |
| ----------- | ----------------- | ------------------- | ----- |
| 0           | 0                 | 0                   | PASS  |
| 37.5        | 0.225             | 0.225               | PASS  |
| 75          | 0.45              | 0.45                | PASS  |
| 112.5       | 0.675             | 0.675               | PASS  |
| 150         | 0.9               | 0.9                 | PASS  |

Both report duration **150 ms**, easing **linear**, fill **backwards**, and keyframes
`offset 0 → opacity 0`, `offset 1 → opacity 0.9`.

## Finding the comparison exposed

The first local run matched offsets 0–112.5 but reported **1** at 150 ms: the toast had no resting
opacity declaration, and with `fill: backwards` the animation stops applying at its end, exposing
the underlying value. The reference's tooltip settles at 0.9. `.toast` now declares `opacity: 0.9`,
and the repeat run matches all five offsets. **This defect was found by the frame comparison, not
by a computed-style assertion at rest** — a rest assertion would have seen 1 in both and passed.

## Scope

The paired recording artifacts remain `captures/reference-motion.webm` and
`captures/reference-copy-fade.webm`; both carry the recorder's screenshot-fallback limitation and
are interaction records rather than smooth video. The deterministic frame data above is the
comparison evidence. No other reference motion state was observable, so none is claimed.
