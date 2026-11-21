# M17 route status — M16 public free-web inventory

Each M16 route has a decision. No premium, authenticated, app-only or advertising destination is
counted as delivered.

| M16 route             | Decision                                                                                                                                                                      | Evidence / reason                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/en/` (home)         | implemented as the single SpectreMail page with product + below-fold regions + footer                                                                                         | `apps/web/src/App.tsx`, `PageSections.tsx`, `PublicFooter.tsx`, `spectre-desktop.png` |
| `/en/change`          | approved deviation — the reference's domain-change form is Premium-only; SpectreMail offers domain choice inside the working Change toolbar and never fakes a standalone form | `apps/web/src/ActionToolbar.tsx`, `DomainPicker.tsx`                                  |
| `/en/faq`             | approved deviation — informational role represented by the on-page explainer; no standalone route in this build                                                               | `PageSections.tsx`                                                                    |
| `/en/api`             | approved deviation — developer API is outside the product's no-backend scope and must not be linked as a working route                                                        | M16 inventory                                                                         |
| `/en/10minutemail`    | approved deviation — same disposable-address role implemented by the one product surface, not a separate fake route                                                           | M16 inventory                                                                         |
| `/en/email-generator` | approved deviation — same as above                                                                                                                                            | M16 inventory                                                                         |
| `/privacy-policy`     | approved deviation — `docs/PRIVACY.md` is the authoritative disclosure; footer names Privacy as information, not a dead link                                                  | `docs/PRIVACY.md`                                                                     |
| `/terms-of-service`   | approved deviation — no SpectreMail terms route; footer states truthful limits, no licence claim                                                                              | M16 inventory                                                                         |
| `/en/contact`         | approved deviation — no send endpoint; footer names Contact as information only                                                                                               | M16 inventory                                                                         |
| `/blog`               | approved deviation — external editorial content is protected; on-page article-style section preserves the informational role with original copy                               | `PageSections.tsx`                                                                    |

External/premium/app destinations (App Store, Google Play, Virtual Number, Premium, advertising,
language locales, app-store links) are explicitly **out of scope** and are not rendered as
controls. The denominator is all 10 in-scope routes plus the out-of-scope set; none was silently
dropped.
