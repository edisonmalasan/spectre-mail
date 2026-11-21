# M21 route status — M16 public free-web inventory

The 10 M16 routes are accounted for. Nine are now **implemented** as real in-app routes with
original SpectreMail copy (`apps/web/src/public-routes.ts`, `PublicRoutePage.tsx`); the home page
is the working product. No premium, authenticated, mobile-app or advertising destination is
faked. Browser evidence: `apps/web/e2e/public-routes.spec.ts` (51 website cases total).

| M16 route             | Status      | Evidence                                                                        |
| --------------------- | ----------- | ------------------------------------------------------------------------------- |
| `/en/` home           | IMPLEMENTED | working address, dashed panel, toolbar, inbox, below-fold regions and footer    |
| `/en/change`          | IMPLEMENTED | explanatory route plus the real domain choice inside the working Change toolbar |
| `/en/faq`             | IMPLEMENTED | Q&A article with original copy                                                  |
| `/en/api`             | IMPLEMENTED | truthful "no public API / no proxy" article                                     |
| `/en/10minutemail`    | IMPLEMENTED | short-lived-address article; no invented countdown                              |
| `/en/email-generator` | IMPLEMENTED | automatic generation and copy article                                           |
| `/privacy-policy`     | IMPLEMENTED | original summary; `docs/PRIVACY.md` remains the full record                     |
| `/terms-of-service`   | IMPLEMENTED | truthful as-is / provider-conditions article                                    |
| `/en/contact`         | IMPLEMENTED | states plainly that no send endpoint exists                                     |
| `/blog`               | IMPLEMENTED | original reading-list article                                                   |

The shared footer links to eight of these routes; `/change` stays a toolbar action rather than a
footer item, matching the reference's footer inventory. Every footer link is a real served route:
the browser test requests each one and requires HTTP 200.

## Honest limits

- Prose is original, not Temp Mail's protected text; the informational roles and layout positions
  match M16, not the exact wording.
- The external/premium/app destinations (store badges, Virtual Number, advertising, language
  locales) remain out of scope and are not rendered as dead controls.
- The reference page is still longer than SpectreMail's: original copy preserves the roles
  without copying protected articles.
