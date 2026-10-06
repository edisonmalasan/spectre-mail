/**
 * `@spectre-mail/ui` — reusable product UI and design tokens.
 *
 * ## What this package owns
 *
 * The **design tokens** and the **contrast arithmetic** over them. Since M7 slice 1 it
 * also owns the contract the tokens are emitted through: `tokens.css`, generated from
 * `tokens.ts` and checked against it by a test.
 *
 * ## What it does not own, and why not yet
 *
 * The roadmap's approved design lists buttons, the mailbox card, the provider badge, the
 * status dot, the message row, the OTP component, and the verification-link component as
 * belonging here. **None of them are here.** `apps/web` owns them, and the move is
 * deliberately deferred to M8 — the first second consumer, and the change that can
 * measure whether an extraction was right rather than whether it was tidy. Moving
 * components into a shared package before anything needs them shared risks freezing an
 * API shape no second client ever agreed to. Tokens are different: a palette is shared
 * by definition and its interface is data, not behaviour.
 *
 * Marketing-only website sections do not belong here. This package holds product UI
 * shared by the clients, not landing-page content.
 *
 * ## The two exports, and why there are two
 *
 * - `@spectre-mail/ui` — this module. Types and the contrast function.
 * - `@spectre-mail/ui/tokens.css` — the stylesheet the page loads.
 *
 * **The stylesheet is not re-exported from here, and cannot be.** A client cannot
 * `import "./tokens.css"` and have a bundler pick it up from inside a package's
 * TypeScript entry point; the CSS subpath exists so a client asks for the file
 * explicitly. That is the same shape as every other `exports` entry in this workspace
 * pointing at source, and it is what lets `packages/ui` stay buildless.
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

export { DECORATIVE, PAIRS, SURFACE_ONLY } from "./pairs";
export type { ContrastPair } from "./pairs";
