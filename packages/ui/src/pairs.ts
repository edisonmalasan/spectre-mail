/**
 * The foreground/background pairs the palette is held to.
 *
 * ## Why a declared list rather than "every pair that happens to occur"
 *
 * A list nobody chose is a list nobody maintains, and a check that scans a stylesheet
 * for colour pairs will find the ones a developer happened to write and miss the one a
 * developer needed. So the pairs are **declared here, with the reason each exists**, and
 * `pairs.test.ts` holds every one of them to its threshold in both schemes.
 *
 * That makes the coverage a decision rather than an accident, and it makes the
 * *exclusions* a decision too — see {@link DECORATIVE}.
 *
 * ## The thresholds are WCAG's, and they are not interchangeable
 *
 * 4.5:1 for text, 3:1 for text at 24px (or 18.66px bold) and for anything a user must
 * *perceive* rather than read: a boundary, a focus indicator, a control's edge.
 *
 * @module
 */

/**
 * **The `.ts` extensions are required by the emitters, not by taste.**
 *
 * `packages/ui/scripts/emit-tokens.ts` and `emit-design-doc.ts` run under Node's type
 * stripping, which loads a `.ts` file as an ES module and resolves imports against the
 * filesystem. An extensionless specifier resolves under `vitest` and under `tsc` and fails
 * with `ERR_MODULE_NOT_FOUND` in the only place that runs it, so both spellings exist in
 * this package and the divergence is deliberate. `design-doc.test.ts` asserts the form.
 */
import { BODY_TEXT, LARGE_TEXT, NON_TEXT, type ContrastThreshold } from "./contrast.ts";
import type { ColourName } from "./tokens.ts";

/** One pair, named by the two tokens that make it and the reason it exists. */
export interface ContrastPair {
  /** The foreground token. */
  readonly ink: ColourName;
  /** The background token. */
  readonly surface: ColourName;
  /** The ratio this pair is held to. */
  readonly threshold: ContrastThreshold;
  /** Why this pair exists, for the reader who adds the next one. */
  readonly what: string;
}

/**
 * Every pair the palette is held to.
 *
 * **One pair per surface for the ink that appears on it**, rather than one pair per
 * component. The components' colours come from these tokens and nothing else — which is
 * what `visual-system` requires — so a pair declared here covers every use of it. The
 * alternative, enumerating component backgrounds, would be a list that goes stale the
 * first time a component is restyled.
 *
 * **`ink-accent` is held at `BODY_TEXT` everywhere including the tinted surfaces**, even
 * though it only ever appears large. It is held to the stricter number on purpose: an
 * accent is the one ink a future change is most likely to start using at body size, and
 * a pair that only just passes at 3:1 fails the moment that happens.
 */
export const PAIRS: readonly ContrastPair[] = [
  // ── Primary text, on every surface it can land on ───────────────────────────────
  {
    ink: "ink-primary",
    surface: "surface-page",
    threshold: BODY_TEXT,
    what: "Body copy on the page background.",
  },
  {
    ink: "ink-primary",
    surface: "surface-raised",
    threshold: BODY_TEXT,
    what: "Body copy inside a raised surface — a message, an inbox row.",
  },
  {
    ink: "ink-primary",
    surface: "surface-sunken",
    threshold: BODY_TEXT,
    what: "Body copy on a sunken surface — the readable body of a message.",
  },
  {
    ink: "ink-primary",
    surface: "surface-accent",
    threshold: BODY_TEXT,
    what: "Body copy on the selected or active surface. A selected row that cannot be read is a row that has been made worse by being selected.",
  },
  {
    ink: "ink-primary",
    surface: "surface-danger",
    threshold: BODY_TEXT,
    what: "Body copy inside a region reporting a failure. The failure has to be legible as well as visible.",
  },

  // ── Secondary and muted text ────────────────────────────────────────────────────
  {
    ink: "ink-secondary",
    surface: "surface-page",
    threshold: BODY_TEXT,
    what: "Supporting copy on the page background.",
  },
  {
    ink: "ink-secondary",
    surface: "surface-raised",
    threshold: BODY_TEXT,
    what: "Supporting copy inside a raised surface.",
  },
  {
    ink: "ink-secondary",
    surface: "surface-accent",
    threshold: BODY_TEXT,
    what: "Supporting copy on the selected or active surface.",
  },
  {
    ink: "ink-secondary",
    surface: "surface-danger",
    threshold: BODY_TEXT,
    what: "Supporting copy inside a failure region.",
  },
  {
    ink: "ink-muted",
    surface: "surface-page",
    threshold: BODY_TEXT,
    what: "Technical metadata on the page background — an arrival time, a provider note.",
  },
  {
    ink: "ink-muted",
    surface: "surface-raised",
    threshold: BODY_TEXT,
    what: "Technical metadata inside a raised surface — a row's time and unread state.",
  },
  {
    ink: "ink-muted",
    surface: "surface-sunken",
    threshold: BODY_TEXT,
    what: "Technical metadata on a sunken surface.",
  },
  {
    ink: "ink-muted",
    surface: "surface-accent",
    threshold: BODY_TEXT,
    what: "Technical metadata on the selected or active surface.",
  },

  // ── The accent, as text and as ink on a tinted surface ──────────────────────────
  {
    ink: "ink-accent",
    surface: "surface-page",
    threshold: BODY_TEXT,
    what: "Accent text on the page background — the link-coloured case, held to the body threshold rather than the large-text one.",
  },
  {
    ink: "ink-accent",
    surface: "surface-raised",
    threshold: BODY_TEXT,
    what: "Accent text inside a raised surface.",
  },
  {
    ink: "ink-accent",
    surface: "surface-sunken",
    threshold: BODY_TEXT,
    what: "Accent text on a sunken surface.",
  },
  {
    ink: "ink-accent",
    surface: "surface-accent",
    threshold: BODY_TEXT,
    what: "Accent text on its own tinted surface.",
  },
  {
    ink: "accent",
    surface: "surface-page",
    threshold: BODY_TEXT,
    what: "The accent itself as text on the page background. Held to the body threshold because the codes it marks are rendered as text and must not be the one thing on the page that is hard to read.",
  },
  {
    ink: "accent",
    surface: "surface-raised",
    threshold: BODY_TEXT,
    what: "The accent as text inside a raised surface — a marked code in an opened message.",
  },
  {
    ink: "accent",
    surface: "surface-sunken",
    threshold: BODY_TEXT,
    what: "The accent as text on a sunken surface.",
  },
  {
    ink: "accent",
    surface: "surface-accent",
    threshold: NON_TEXT,
    what: "The accent as a rule or a marker on its own tinted surface. Non-text, because it reinforces a word the row already carries.",
  },

  // ── Failure ─────────────────────────────────────────────────────────────────────
  {
    ink: "ink-danger",
    surface: "surface-page",
    threshold: BODY_TEXT,
    what: "Failure copy on the page background — a save that did not complete.",
  },
  {
    ink: "ink-danger",
    surface: "surface-danger",
    threshold: BODY_TEXT,
    what: "Failure copy inside a failure region — a refused removal.",
  },
  {
    ink: "ink-danger",
    surface: "surface-raised",
    threshold: BODY_TEXT,
    what: "Failure copy inside a raised surface.",
  },

  // ── Focus, and the boundary that has to be perceivable to be identified ─────────
  {
    ink: "focus",
    surface: "surface-page",
    threshold: NON_TEXT,
    what: "The focus indicator against the page background. WCAG non-text contrast is the standard a focus indicator is held to, and it is a floor: an indicator that measures exactly 3:1 is technically compliant and easy to miss.",
  },
  {
    ink: "focus",
    surface: "surface-raised",
    threshold: NON_TEXT,
    what: "The focus indicator against a raised surface — which is where most controls sit.",
  },
  {
    ink: "focus",
    surface: "surface-sunken",
    threshold: NON_TEXT,
    what: "The focus indicator against a sunken surface.",
  },
  {
    ink: "focus",
    surface: "surface-accent",
    threshold: NON_TEXT,
    what: "The focus indicator against the selected or active surface.",
  },
  {
    ink: "line-strong",
    surface: "surface-page",
    threshold: NON_TEXT,
    what: "A control's boundary on the page background. The boundary is how a control without a fill is identified at all, so it is held to non-text contrast rather than left as a hairline.",
  },
  {
    ink: "line-strong",
    surface: "surface-raised",
    threshold: NON_TEXT,
    what: "A control's boundary inside a raised surface — an inbox row.",
  },
  {
    ink: "line-strong",
    surface: "surface-sunken",
    threshold: NON_TEXT,
    what: "A control's boundary on a sunken surface.",
  },
  {
    ink: "line-strong",
    surface: "surface-accent",
    threshold: NON_TEXT,
    what: "A control's boundary on the selected or active surface.",
  },
  {
    ink: "line-strong",
    surface: "surface-danger",
    threshold: NON_TEXT,
    what: "A control's boundary inside a failure region — the two-step removal's controls.",
  },

  // ── The large-text case, held where it actually occurs ──────────────────────────
  {
    ink: "ink-primary",
    surface: "surface-raised",
    threshold: LARGE_TEXT,
    what: "A heading inside a raised surface. Held at the large-text threshold it is actually rendered at, and it passes the body threshold too — `pairs.test.ts` asserts the stricter result as well, so a future tightening of the type scale cannot quietly drop a heading below it.",
  },
];

/**
 * Colours deliberately held to **no** threshold, each with the reason.
 *
 * ## Why this list exists instead of an omission
 *
 * `--line-subtle` is a hairline separator. WCAG's non-text contrast requirement covers
 * boundaries **required to identify a control or understand content**; a rule between two
 * stacked sections is decoration, and holding it to 3:1 would mean the layout depends on
 * a heavy line wherever two things are adjacent — the opposite of what the approved
 * direction asks for.
 *
 * **Listing it here rather than leaving it out is the point.** An omission reads as an
 * oversight, and the first person to add `--line-subtle` to a pair list would find a red
 * test and no explanation. `pairs.test.ts` asserts every token here is used by **no** pair
 * at all, so the exclusion is itself a checked fact and cannot rot into a gap.
 */
export const DECORATIVE: readonly { readonly token: ColourName; readonly why: string }[] = [
  {
    token: "line-subtle",
    why: "A section separator and a hairline under a row. Decoration, not an identifying boundary — the control boundary is `--line-strong`, which is held to 3:1 in both schemes.",
  },
];

/**
 * Colours that are backgrounds and are **never** a foreground.
 *
 * ## Why this is a separate list from {@link DECORATIVE}
 *
 * Because they are a different fact, and conflating them was a real defect this
 * repository's own test caught on the first run: an earlier draft listed
 * `surface-sunken` here with the reason "a surface is never a foreground", while
 * eleven pairs used it as a background **with a threshold**. The exclusion was therefore
 * false, and a test asserting the two lists could not disagree turned it red.
 *
 * So the two claims are separated. {@link DECORATIVE} says *nothing depends on this being
 * readable*. This list says *this is only ever a background*, which is a statement about
 * a token's role and is checked by asserting each entry **is** used as a surface — so the
 * list cannot accumulate entries describing colours the page never uses.
 */
export const SURFACE_ONLY: readonly { readonly token: ColourName; readonly why: string }[] = [
  {
    token: "surface-page",
    why: "The page background. Every text ink in the palette is held to its threshold against it, so it is the most-checked surface and the one never used as an ink.",
  },
  {
    token: "surface-raised",
    why: "Raised panels and controls: the message body, an inbox row. A background only.",
  },
  {
    token: "surface-sunken",
    why: "The readable body of a message, set below the raised surface around it. A background only.",
  },
  {
    token: "surface-accent",
    why: "The selected or active surface, and the tint behind a marked code. A background only — the accent that goes with it is `--accent` and `--ink-accent`.",
  },
  {
    token: "surface-danger",
    why: "The tint inside a region reporting a failure. A background only.",
  },
];
