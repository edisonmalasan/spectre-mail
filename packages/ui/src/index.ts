/**
 * `@spectre-mail/ui` — the design tokens, and the few values both clients must read
 * from one place.
 *
 * ## What this package owns
 *
 * The **design tokens** and the **contrast arithmetic** over them. Since M7 slice 1 it
 * also owns the contract the tokens are emitted through: `tokens.css`, generated from
 * `tokens.ts` and checked against it by a test.
 *
 * It also owns **`PRODUCT_NAME`**, the product's public name, and `name.ts` gives the argument
 * for its being here in full — which is an application of the rule quoted three paragraphs
 * below, not a second rule: *a palette is shared by definition and its interface is data, not
 * behaviour*, and so is a name.
 *
 * **And it owns the definition of a reportable value**, for the same reason: the website and the
 * extension each report the outcomes of their own session, and the thing that stops the two
 * drifting is that they read the same definition rather than each holding a copy. See
 * `./diagnostic.ts`.
 *
 * ## What it does not own
 *
 * **No component, and none is scheduled.** The roadmap's initial plan lists buttons, the
 * mailbox card, the provider badge, the status dot, the message row, the OTP component and the
 * verification-link component as belonging here. **There is no `.tsx` in this package**, and
 * each client owns the components it renders: `apps/web/src/` and `apps/extension/src/`
 * between them hold the address control, the mailbox card, the message row, the code control
 * and the link anchor.
 *
 * **M8 was named as the milestone that would force the question, and it shipped without
 * extracting any of them** — which is the answer rather than an omission. The components that
 * look shared are not the same component: `apps/web`'s `Inbox` and `apps/extension`'s
 * `MessageList` take different props, hold different state and offer different actions. Moving
 * one into a shared package before a second consumer has agreed the same interface would
 * freeze an API shape no second client asked for. **Tokens are the opposite case**: a palette
 * is shared by definition and its interface is data, not behaviour — which is exactly why they
 * are here and the components are not.
 *
 * Marketing-only website sections do not belong here either. This package holds design data
 * the clients share, not landing-page content.
 *
 * ## The three exports, and why there are three
 *
 * - `@spectre-mail/ui` — this module. Types, the contrast function, the tokens, and the shared
 *   definition of a reportable value.
 * - `@spectre-mail/ui/name` — `PRODUCT_NAME` alone, for a client that needs only the string.
 *   The subpath exists because importing the root once dragged `pairs.ts` into a client's
 *   program; the section below records that, and records why the subpath stays.
 * - `@spectre-mail/ui/tokens.css` — the stylesheet the page loads.
 *
 * **The stylesheet is not re-exported from here, and cannot be.** A client cannot
 * `import "./tokens.css"` and have a bundler pick it up from inside a package's
 * TypeScript entry point; the CSS subpath exists so a client asks for the file
 * explicitly. That is the same shape as every other `exports` entry in this workspace
 * pointing at source, and it is what lets `packages/ui` stay buildless.
 *
 * ## Why the contrast pairs are not exported from here
 *
 * **Because this module is the only entry point a client can import, and `pairs.ts` cannot be in a
 * client's program.** Measured 2026-10-20: `import { PRODUCT_NAME } from "@spectre-mail/ui"` in
 * `apps/web` fails with
 * `../../packages/ui/src/pairs.ts(31,73): error TS5097: An import path can only end with a '.ts'
 * extension when 'allowImportingTsExtensions' is enabled.`
 *
 * **The cause is `packages/ui/scripts/emit-tokens.ts` and `emit-design-doc.ts`, which run under
 * Node's own type stripping and therefore need an explicit `.ts` specifier** — `pairs.ts` says so
 * in its own note, and `design-doc.test.ts` asserts the form. **A client program cannot hold a
 * `.ts` specifier**, because `allowImportingTsExtensions` is a per-program option and the clients
 * do not set it — and setting it in `tsconfig.base.json` would widen a compiler option for every
 * workspace project to accommodate one package's emitters.
 *
 * **So the pairs stay in this package and stop being re-exported from its entry point.** They are
 * used by `design-doc.ts` (which generates `docs/DESIGN_SYSTEM.md`) and by `pairs.test.ts`, both of
 * which import them relatively; **nothing outside this package reads them**, and the package is
 * `private` and never published. **What the removal buys is that this entry point can be imported
 * at all**, which is what the shared diagnostic needs — and **the `./name` subpath was added once
 * already to work around this same obstacle** (`mailbox-history`'s apply stage, which repaired a
 * widened `tsconfig.base.json` by giving the name its own subpath rather than by fixing the
 * cause). **The cause is now fixed, and the subpath stays because a second path to one value is
 * not worth the churn of removing** — but the reason it exists is recorded, so nobody has to
 * rediscover the obstacle to wonder whether it is still needed.
 *
 * ## The direction
 *
 * Spectral Swiss Utility, as approved in `docs/ROADMAP.md`. The palette carries its
 * reasoning in `tokens.ts`; the accessibility rules are in `docs/DESIGN_SYSTEM.md`.
 *
 * Boundary: this package must never import from `apps/web` or `apps/extension`.
 * Enforced by `tests/architecture/boundaries.test.ts`.
 *
 * @packageDocumentation
 */

export {
  BODY_TEXT,
  LARGE_TEXT,
  NON_TEXT,
  contrastRatio,
  meets,
  relativeLuminance,
} from "./contrast";
export type { ContrastThreshold } from "./contrast";

export { PRODUCT_NAME } from "./name";

export {
  EXCLUDED_REPORTABLE_VALUES,
  REPORTABLE_VALUE_KINDS,
  isReportableValue,
  reportableCount,
  reportableOutcome,
} from "./diagnostic";
export type {
  DiagnosticEntry,
  DiagnosticReport,
  ExcludedReportableValue,
  ReportableCount,
  ReportableOutcome,
  ReportableValue,
  ReportableValueKind,
} from "./diagnostic";

export {
  COLOUR_NAMES,
  MOTION,
  METRICS,
  RADIUS,
  SCHEMES,
  SHARED_GROUPS,
  SPACE,
  TYPOGRAPHY,
} from "./tokens";
export type { ColourName, ColourSet, Scheme, TokenGroup } from "./tokens";
