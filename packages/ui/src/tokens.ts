/**
 * Every design value in SpectreMail, declared once.
 *
 * ## Why this file and not `tokens.css`
 *
 * `tokens.css` exists and is what the page loads — but it is **generated from this
 * file**, and a test asserts the committed stylesheet matches what this file produces.
 *
 * That inversion is the whole point. If the values lived only in CSS, the contrast pairs
 * would have to restate them in TypeScript to be computable, and two declarations of one
 * colour would drift apart silently — the failure mode this repository has refused
 * everywhere else since M0. Here there is exactly one place a hex lives, and the
 * stylesheet is a projection of it.
 *
 * ## What belongs here
 *
 * Anything a second client will need and a human will want to change: colour, type,
 * spacing, radius, weight, motion. Not layout (that is a client's business — two
 * clients lay out differently), and not component styles.
 *
 * ## Why the dark scheme is its own values
 *
 * `build-and-verification` requires a browser check to reach no third-party origin, and
 * this repository has refused to derive a palette rather than declare one. A dark scheme
 * produced by `filter: invert()` or by filtering the light values is not a second
 * scheme; it is the first one, rearranged, and it will fail contrast somewhere
 * unremarkably. Both schemes are declared here and both are checked in `pairs.test.ts`.
 *
 * @module
 */

/** The colour schemes the product ships. */
export type Scheme = "light" | "dark";

/**
 * The colour token names.
 *
 * **A type, not a string alias, so a typo in a pair is a compile error.** Every
 * foreground/background pair in `pairs.ts` names its two ends from this union, so a
 * token that does not exist cannot be written down.
 */
export const COLOUR_NAMES = [
  "surface-page",
  "surface-raised",
  "surface-sunken",
  "surface-accent",
  "surface-danger",
  "ink-primary",
  "ink-secondary",
  "ink-muted",
  "ink-accent",
  "ink-danger",
  "line-subtle",
  "line-strong",
  "accent",
  "focus",
] as const;

export type ColourName = (typeof COLOUR_NAMES)[number];

/** One scheme's colour values, keyed by {@link ColourName}. */
export type ColourSet = Readonly<Record<ColourName, string>>;

/**
 * The palette.
 *
 * ## Why the neutrals are very slightly cool rather than warm or neutral
 *
 * The approved direction asks for a *warm off-white* page and a *restrained spectral
 * violet*. A warm background with a cool grey ink produces a colour cast that reads as
 * dirt on the text at small sizes, and the cast is exactly what a Swiss layout is trying
 * not to have. So the background carries the warmth and the ink does not: the page is
 * `#f4f4f2`, which is warm against pure white, and the text is `#16161a`, which is a
 * near-black with a trace of blue in it rather than a brown-black.
 *
 * ## The values themselves are not free choices
 *
 * Every ink and every boundary in here is held to a ratio in `pairs.ts`, in both
 * schemes, by a test. If a value below is changed, that test is the arbiter — not taste
 * in isolation.
 */
export const SCHEMES: Readonly<Record<Scheme, ColourSet>> = {
  light: {
    "surface-page": "#f4f4f2",
    "surface-raised": "#ffffff",
    "surface-sunken": "#e9e9e6",
    "surface-accent": "#efecfb",
    "surface-danger": "#fbeeee",
    "ink-primary": "#16161a",
    "ink-secondary": "#4a4a52",
    "ink-muted": "#5e5e68",
    "ink-accent": "#4a2fb8",
    "ink-danger": "#a4262c",
    "line-subtle": "#dcdcd8",
    "line-strong": "#6f6f78",
    accent: "#5a3fd0",
    focus: "#5a3fd0",
  },
  dark: {
    "surface-page": "#0e0e11",
    "surface-raised": "#17171b",
    "surface-sunken": "#08080a",
    "surface-accent": "#1e1a2e",
    "surface-danger": "#2a1618",
    "ink-primary": "#ecedf0",
    "ink-secondary": "#b0b0b8",
    "ink-muted": "#96969f",
    "ink-accent": "#b8a4f7",
    "ink-danger": "#f0928f",
    "line-subtle": "#2b2b32",
    "line-strong": "#7a7a87",
    accent: "#a48cf5",
    focus: "#a48cf5",
  },
};

/** Typography, shared by both schemes. */
export const TYPOGRAPHY = {
  /**
   * System grotesk stack. **No `@font-face`, no webfont, no remote origin.**
   *
   * The approved direction names Geist and Inter. Naming a family is an instruction
   * about where a family is *declared*, not a requirement to fetch it — and fetching one
   * would break the promoted no-network requirement and hand a third party the visitor's
   * IP on page load, in the one product whose stated subject is what is kept on this
   * device. The Swiss character comes from the grid, the scale, the weight contrast, and
   * the whitespace; all four are below. A later change can install Geist properly,
   * self-hosted, by editing this one value.
   */
  "font-sans": "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  /** System monospace, for the four things the direction assigns to it. */
  "font-mono": "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Menlo, Consolas, monospace",

  "type-xs": "0.75rem",
  "type-sm": "0.875rem",
  "type-base": "1rem",
  "type-lg": "1.125rem",
  "type-xl": "1.375rem",
  "type-2xl": "1.75rem",
  "type-3xl": "2.5rem",

  "leading-tight": "1.15",
  "leading-normal": "1.5",
  "leading-relaxed": "1.65",

  "tracking-tight": "-0.02em",
  "tracking-normal": "0",
  "tracking-wide": "0.08em",

  "weight-regular": "400",
  "weight-medium": "500",
  "weight-bold": "600",
} as const;

/**
 * Spacing, on a 4px base.
 *
 * **A closed scale rather than arbitrary values, because an arbitrary value is a value
 * nobody chose.** `AGENTS.md` names inconsistent spacing as a thing to avoid, and a
 * design system with thirty-one spacing values has thirty-one spacing values.
 */
export const SPACE = {
  "space-0": "0",
  "space-1": "0.25rem",
  "space-2": "0.5rem",
  "space-3": "0.75rem",
  "space-4": "1rem",
  "space-5": "1.5rem",
  "space-6": "2rem",
  "space-7": "3rem",
  "space-8": "4rem",
  "space-9": "6rem",
} as const;

/**
 * One radius scale, and it is small.
 *
 * The direction asks for thin or precise borders over heavy depth effects, and a large
 * radius on a bordered element reads as soft and friendly — a different product. So the
 * largest radius here is 6px, and the hairline is a hairline.
 */
export const RADIUS = {
  "radius-sm": "2px",
  "radius-md": "4px",
  "radius-lg": "6px",
  "radius-pill": "999px",
} as const;

/** Borders and measure. */
export const METRICS = {
  /** The only border weight the product uses. */
  "width-hairline": "1px",
  /** The focus indicator's width. Thick enough to see at any surface in the palette. */
  "width-focus": "2px",
  /** How far the focus ring sits from the control it marks. */
  "offset-focus": "2px",
  /** The reading measure. Long enough for prose, short enough to scan. */
  "measure-prose": "62ch",
  /** The page column. The mailbox is a working surface, not a poster. */
  "measure-page": "46rem",
} as const;

/**
 * Motion.
 *
 * **The order is effect first, then timing**, because a reader meeting
 * `blur(var(--blur))` inside a keyframes block wants to know how far something travels
 * before it wants to know how long that takes.
 *
 * ## Why the two distances are declared here and not borrowed from `SPACE`
 *
 * `--space-1` is `0.25rem`, which is exactly this milestone's 4px rise, so reusing it
 * would have added no token at all. It is still wrong. `--space-1` is read by roughly a
 * dozen layout rules, so a change made to a spacing step for layout reasons would
 * silently move the motion — and `docs/DESIGN_SYSTEM.md` would then describe a motion
 * nobody chose. These two are declared so the motion and the spacing scale can move
 * independently.
 *
 * They are pixels rather than `rem` because they are optical offsets on the way in, not
 * typographic or layout measures, and because the roadmap specifies them as pixels.
 *
 * **This is the second kind of value to test the layer's "not layout" clause**, after the
 * two `measure-*` tokens. The argument is the same and it holds: at rest the transform is
 * `none` and the filter is absent, so neither value affects where anything is. They are
 * what an element *does on the way in*, not what it *is*.
 */
export const MOTION = {
  /** How far a materialising element travels before it settles. */
  rise: "4px",
  /** How blurred a materialising element is before it resolves. */
  blur: "6px",
  "duration-fast": "120ms",
  "duration-base": "200ms",
  "ease-standard": "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/** A group of design values, as declared. */
export type TokenGroup = Readonly<Record<string, string>>;

/**
 * Everything that is **not** a colour, in the order it is emitted.
 *
 * Order is the order a reader wants: what a thing looks like, then how big it is, then
 * how much room it gets. A generated stylesheet whose order is alphabetical is
 * generated correctly and read as noise.
 */
export const SHARED_GROUPS: readonly (readonly [string, TokenGroup])[] = [
  ["Typography", TYPOGRAPHY],
  ["Spacing", SPACE],
  ["Radius", RADIUS],
  ["Metrics", METRICS],
  ["Motion", MOTION],
];
