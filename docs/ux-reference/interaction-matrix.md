# M16 — Temp Mail reference: interaction matrix

> **Status: investigation evidence only. No implementation claims. GOAL is NOT MET.**
> "After" cells record only what was observed in this session. Where nothing was observed the cell says
> **NOT INSPECTED** — this is not a claim that an effect is absent.

## Capture metadata (applies to every row)

| Field                          | Value                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture date                   | 2026-11-21                                                                                                                                          |
| Browser                        | Real Chrome via the OpenCode Browse extension; Chromium                                                                                             |
| Zoom                           | 100%                                                                                                                                                |
| Device pixel ratio             | 1                                                                                                                                                   |
| Fonts loaded at capture        | Roboto + Roboto Mono (confirmed loaded)                                                                                                             |
| Viewports used for interaction | Principally 1440×900 (viewport reported 1425 due to scrollbar); full-page captures also at 956×885, 768×1024, 390×844, 360×800                      |
| Dynamic values                 | Live address values were present; **mask in comparisons**. No address string reproduced here.                                                       |
| Captures                       | `captures/reference-desktop.png`, `reference-qr-dialog.png`, `reference-copy-state.png`, `reference-change-page.png`, `reference-change-route.webm` |
| Activation vocabulary          | "Pointer click" means a real pointer click in the browser. Keyboard activation was **not exercised** unless a row says so.                          |

### Status labels

- **MEASURED** — directly observed/recorded this session.
- **INFERRED** — reasoned from a measurement; not a direct observation.
- **UNKNOWN** — looked for but not obtainable.
- **NOT INSPECTED** — not observed this session; no negative claim made.

---

## Primary address surface and toolbar

| ID  | Control                      | Where                                                                                                      | Before (measured)                                                                                                                   | Activation                                       | After (observed)                                                                                                                                                                                                                       | Effect status                                                | Network dependency                                      | Capture                                                                        |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| I01 | Address input                | Dashed panel, `/en/`                                                                                       | 340×52 input inside a 400×60 wrapper (`rgba(255,255,255,0.04)`, radius 30px, padding 4px); Roboto 20px, padding 10px 15px, radius 0 | Not activated (value was live; masked)           | Live value present; no editing/typing attempted                                                                                                                                                                                        | **MEASURED** (geometry + live value) / editing NOT INSPECTED | UNKNOWN                                                 | `reference-desktop.png`                                                        |
| I02 | In-field Copy (round button) | Inside address wrapper                                                                                     | 52×52, bg `rgb(0,196,151)`, white glyph, radius 50%, Roboto 16px                                                                    | Pointer click                                    | **No observable dialog or toast text in this session** — recorded as NOT INSPECTED, not as an absent effect. Clipboard write not inspected                                                                                             | **NOT INSPECTED** (effect) / **MEASURED** (geometry)         | UNKNOWN (no request/clipboard log)                      | `reference-copy-state.png`                                                     |
| I03 | QR control                   | Dark band `section-top-qr` (1425×328)                                                                      | Band measured; control present in band                                                                                              | Pointer click                                    | **No observable dialog or toast text in this session** — recorded as NOT INSPECTED, not as an absent effect. QR payload/content not decoded                                                                                            | **NOT INSPECTED** (effect) / **MEASURED** (band)             | UNKNOWN                                                 | `reference-qr-dialog.png` (file present; no dialog text observed this session) |
| I04 | Toolbar **Copy**             | Pill 160×52 at x=359, y=432; bg `rgb(246,247,249)`, ink `rgb(34,36,43)`, Roboto Mono 16px/500, radius 25px | Pill measured                                                                                                                       | Not activated separately from I02                | NOT INSPECTED                                                                                                                                                                                                                          | **NOT INSPECTED** (effect) / **MEASURED** (geometry)         | UNKNOWN                                                 | `reference-desktop.png`                                                        |
| I05 | Toolbar **Refresh**          | Pill 160×52 at x=541, y=432                                                                                | Pill measured                                                                                                                       | Not activated                                    | NOT INSPECTED — no spinner, address change or request observed                                                                                                                                                                         | **NOT INSPECTED** (effect) / **MEASURED** (geometry)         | UNKNOWN                                                 | `reference-desktop.png`                                                        |
| I06 | Toolbar **Change**           | Pill 160×52 at x=724, y=432                                                                                | Pill measured                                                                                                                       | Navigation to `/en/change` (route was inspected) | Address-change page rendered: h1 "Change e-mail address - Temp Mail", text stating domain change is Premium-only, `input.form-control`, `select.select-domain` with `@domain***` placeholders, "Get Premium" button; scrollHeight 2483 | **MEASURED** (navigation + destination)                      | Page navigation observed; form submission NOT INSPECTED | `reference-change-page.png`, `reference-change-route.webm`                     |
| I07 | Toolbar **Delete**           | Pill 160×52 at x=906, y=432                                                                                | Pill measured                                                                                                                       | Not activated                                    | NOT INSPECTED — no confirmation dialog, address change or request observed                                                                                                                                                             | **NOT INSPECTED** (effect) / **MEASURED** (geometry)         | UNKNOWN                                                 | `reference-desktop.png`                                                        |

---

## Header navigation

Header bar measured: `header.main-header` 1425×79, bg `rgb(33,35,42)`, padding 20px 0, Roboto 16px.
Labels below are the **measured** header items. Targets were not opened.

| ID  | Control                 | Before        | Activation    | After                                                       | Effect status                               |
| --- | ----------------------- | ------------- | ------------- | ----------------------------------------------------------- | ------------------------------------------- |
| I08 | App Store (header)      | Label present | Not activated | NOT INSPECTED — external target not opened                  | **MEASURED** (label) / target NOT INSPECTED |
| I09 | Google Play (header)    | Label present | Not activated | NOT INSPECTED — external target not opened                  | **MEASURED** (label) / target NOT INSPECTED |
| I10 | Temp Mail (header)      | Label present | Not activated | NOT INSPECTED (likely home link — INFERRED only)            | **MEASURED** (label) / target NOT INSPECTED |
| I11 | Virtual Number (header) | Label present | Not activated | NOT INSPECTED                                               | **MEASURED** (label) / target NOT INSPECTED |
| I12 | Premium (header)        | Label present | Not activated | NOT INSPECTED — premium gate, out of current free-web scope | **MEASURED** (label) / target NOT INSPECTED |

---

## Footer and public navigation

| ID  | Control                                 | Before                 | Activation                                      | After                                                          | Effect status                                        |
| --- | --------------------------------------- | ---------------------- | ----------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| I13 | PREMIUM (footer)                        | Label present          | Not activated                                   | NOT INSPECTED — premium state out of scope                     | **MEASURED** (label) / target NOT INSPECTED          |
| I14 | API → `/en/api`                         | href measured          | Direct navigation performed                     | Route rendered; contains a RapidAPI link (target not opened)   | **MEASURED** (route) / RapidAPI target NOT INSPECTED |
| I15 | Articles → `/blog`                      | href measured          | Not activated by click (route visited directly) | Route rendered; content not inspected                          | **MEASURED** (route) / content NOT INSPECTED         |
| I16 | 10 MINUTE MAIL → `/en/10minutemail`     | href measured          | Route inspected directly                        | Route rendered; content not inspected                          | **MEASURED** (route) / content NOT INSPECTED         |
| I17 | EMAIL GENERATOR → `/en/email-generator` | href measured          | Route inspected directly                        | Route rendered; content not inspected                          | **MEASURED** (route) / content NOT INSPECTED         |
| I18 | PRIVACY → `/privacy-policy`             | href measured          | Route inspected directly                        | Route rendered; content not inspected                          | **MEASURED** (route) / content NOT INSPECTED         |
| I19 | TERMS → `/terms-of-service`             | href measured          | Route inspected directly                        | Route rendered; content not inspected                          | **MEASURED** (route) / content NOT INSPECTED         |
| I20 | FAQ → `/en/faq`                         | href measured          | Route inspected directly                        | Route rendered; content not inspected                          | **MEASURED** (route) / content NOT INSPECTED         |
| I21 | CONTACTS → `/en/contact`                | href measured          | Route inspected directly                        | Route rendered with a **Send** button; no submission performed | **MEASURED** (route + Send button)                   |
| I22 | ADVERTISING                             | External link recorded | Not activated                                   | NOT INSPECTED — external target unknown                        | **MEASURED** (label) / target UNKNOWN                |
| I23 | App-store links (footer)                | Links present          | Not activated                                   | NOT INSPECTED — external targets                               | **MEASURED** (presence) / targets NOT INSPECTED      |
| I24 | Language switches (`/es/` etc.)         | Links present          | Not activated                                   | NOT INSPECTED — locale pages not opened                        | **MEASURED** (presence) / targets NOT INSPECTED      |

---

## In-page content and forms

| ID  | Control                             | Before                                                                                                                                                                                                                                                                                                                                                                                                                                            | Activation                                       | After                                                                                 | Effect status                                                  |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| I25 | Below-fold article headings         | Eight headings measured with document y positions (see reference-inventory.md): "What is Disposable Temporary E-mail?" (H1, y=986), "Popular Articles" (H3, 1278), "The Tech behind Disposable Email Addresses" (H2, 2011), "So, What Is A Disposable Email Address?" (2239), "Why would you need a fake email address?" (2559), "How to Choose a Disposable Email?" (3217), "How to Use Disposable Email Address?" (3589), "To Conclude:" (3865) | Scroll only                                      | Headings rendered in their measured positions; individual article links not activated | **MEASURED** (headings/positions) / link targets NOT INSPECTED |
| I26 | `/en/change` `input.form-control`   | Placeholder style `@domain***` recorded                                                                                                                                                                                                                                                                                                                                                                                                           | Not typed into                                   | NOT INSPECTED                                                                         | **MEASURED** (presence/placeholder)                            |
| I27 | `/en/change` `select.select-domain` | Placeholder style `@domain***` recorded; label text states domain change is Premium-only                                                                                                                                                                                                                                                                                                                                                          | Not operated (domain selection is premium-gated) | NOT INSPECTED / out of scope                                                          | **MEASURED** (presence/gate text) / selection NOT INSPECTED    |
| I28 | `/en/change` "Get Premium" button   | Button present                                                                                                                                                                                                                                                                                                                                                                                                                                    | Not activated                                    | NOT INSPECTED — premium gate, out of scope                                            | **MEASURED** (presence) / effect NOT INSPECTED                 |
| I29 | `/en/contact` Send button           | Button present                                                                                                                                                                                                                                                                                                                                                                                                                                    | Not activated                                    | NOT INSPECTED — no submission performed                                               | **MEASURED** (presence) / effect NOT INSPECTED                 |
| I30 | `/en/api` RapidAPI link             | Link present                                                                                                                                                                                                                                                                                                                                                                                                                                      | Not activated                                    | NOT INSPECTED — external target                                                       | **MEASURED** (presence) / target NOT INSPECTED                 |

---

## Not inspected (explicit non-claims)

The following were **not** exercised in this session and are recorded here so absence of a row is not read as a finding:

- Keyboard activation, focus order and focus rings for any control.
- Clipboard write result for either Copy control.
- QR payload content or modal/dialog state (S02/I03).
- Refresh spinner or mailbox replacement; Delete confirmation or address removal.
- Empty inbox, populated inbox, message reader, Back navigation, row interactions.
- Loading, error, retry and toast states.
- Premium, authenticated/account, mobile-app-only and access-restricted experiences.
- External targets (app stores, ADVERTISING, RapidAPI), locale pages and individual article pages.
- `/en/change` form submission and `/en/contact` Send submission.
- Any network request log (all per-control network dependency values are UNKNOWN).
- Any SpectreMail state — these artifacts contain reference observations only.
