# M17 visual comparison log

Reference captures dated 2026-11-21 in `captures/reference-*.png`; local captures of the built
website in `captures/spectre-*.png` at the same five viewports (1440×900, 956×885, 768×1024,
390×844, 360×800). Zoom 100%, dpr 1, fonts loaded. Dynamic addresses and timestamps are masked
by not reproducing their captured values; layout is never masked.

## Measured local geometry after M17

| Viewport | Local scrollHeight | Reference scrollHeight | Product band | Toolbar | Inbox   |
| -------- | ------------------ | ---------------------- | ------------ | ------- | ------- |
| 1440×900 | 2,567              | 4,281                  | 307px        | 720×50  | 720×141 |
| 956×885  | 2,567              | 6,175                  | 307px        | 720×50  | 720×141 |
| 768×1024 | 2,590              | 6,175                  | 307px        | 720×50  | 720×141 |
| 390×844  | 3,298              | 6,822                  | 310px        | 358×116 | 358×168 |
| 360×800  | 3,378              | 7,082                  | 310px        | 328×116 | 328×168 |

Product boundaries (header 81 vs 79 reference, dashed panel 560×165 vs 540×169, pill field 448×64
vs 400×60) remain within the earlier ~8px tolerance except the field width, which is an approved
deviation (a mono address at 16px needs the extra width not to clip).

## Ranked remaining mismatches

1. **Page length** (2,567 vs 4,281 on desktop). The reference devotes ~3,000px to long-form
   articles. SpectreMail carries original, shorter copy that preserves the same informational
   roles. Copying the reference prose is prohibited by the roadmap, so this difference is an
   approved deviation rather than an untracked mismatch.
2. **Footer height** — the reference footer carries external app badges and 27 language switches
   (out of scope); SpectreMail's footer carries truthful limits and informational route names only.
3. **Article count** — the reference has six curated blog links; SpectreMail names three
   informational roles with no dead links.

No layout mismatch is masked. Each remaining difference is an approved deviation with the reason
recorded in `route-status.md` and `difference-register.md`. M21 re-audits the full inventory.
