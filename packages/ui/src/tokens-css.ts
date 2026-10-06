/**
 * Renders the token layer to CSS.
 *
 * ## Why this is a function and not a template string in the emitter
 *
 * So that the file which **checks** the committed stylesheet and the file which
 * **writes** it are the same function. `tokens-css.test.ts` asserts
 * `tokens.css` equals {@link renderTokensCss}, and `scripts/emit-tokens.ts` writes
 * exactly that. A check that renders the expected value itself is a check of the
 * renderer, not of the file — which is the narrow-check defect this repository has
 * recorded twenty-one times, in a different costume.
 *
 * @module
 */

import { SCHEMES, SHARED_GROUPS, type ColourName, type Scheme, type TokenGroup } from "./tokens.ts";

/** The header every generated file carries, and the reason it must not be hand-edited. */
const BANNER = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source of truth: packages/ui/src/tokens.ts
 * Regenerate:     pnpm --filter @spectre-mail/ui tokens:emit
 * Verify:         pnpm test (tokens-css.test.ts asserts this file matches its source)
 *
 * Editing this file makes the build's own check fail, which is the intended outcome.
 * A hand-edited palette is a palette whose contrast was never computed.
 */`;

/**
 * A declaration value with its family names in the quote style Prettier's CSS formatter
 * produces.
 *
 * ## Why this exists, and why it is not tidying
 *
 * `pnpm format:check` governs this file — it is not in `.prettierignore`, and the exclusions
 * there are for pre-existing long-form documents, not for files this change created. So the
 * committed stylesheet must satisfy two rules at once: it must equal what this renderer
 * produces, **and** it must be what Prettier would write. Those two are the same claim only
 * if the renderer agrees with the formatter.
 *
 * They did not. A font stack is declared in `tokens.ts` with the family's own quotes —
 * `'Segoe UI'` — which is correct TypeScript and which Prettier's CSS formatter rewrites to
 * `"Segoe UI"`. So the first generated stylesheet was already Prettier-clean in every
 * respect except those two lines, and `format:check` reported it. That is the honest reading:
 * the file was wrong, and the file is generated.
 *
 * **Converting here rather than reformatting afterwards** is the only ordering that keeps
 * the byte-identity test true. Running Prettier over the emitter's output would make the
 * committed file differ from {@link renderTokensCss} by exactly the formatter's opinion, and
 * the assertion would then be checking the formatter.
 *
 * ## Why only quotes, and only when it is safe
 *
 * `'` becomes `"` and nothing else is touched, because a font stack's quotes delimit family
 * names and never appear inside one. A value containing a `"` would be left alone rather than
 * mangled: no font family name contains a double quote, so such a value is one no font stack
 * can legitimately have, and silently rewriting it would hide the mistake.
 */
function cssValue(value: string): string {
  if (value.includes('"')) return value;
  return value.replaceAll("'", '"');
}

/** Indent a declaration list by one level. */
function declarations(group: TokenGroup, indent: string): string {
  return Object.entries(group)
    .map(([name, value]) => `${indent}--${name}: ${cssValue(value)};`)
    .join("\n");
}

/** One scheme's colours, in declaration order. */
function schemeColours(scheme: Scheme): string {
  const colours = SCHEMES[scheme];
  // The declared order of `COLOUR_NAMES`, not object key order, so the emitted file
  // reads surfaces → ink → lines → accent rather than whatever the object literal
  // happened to be written in.
  return Object.keys(colours)
    .map((name) => `  --${name}: ${colours[name as ColourName]};`)
    .join("\n");
}

/** The shared, non-colour groups. */
function sharedGroups(): string {
  return SHARED_GROUPS.map(
    ([title, group]) => `  /* ${title} */\n${declarations(group, "  ")}`,
  ).join("\n\n");
}

/**
 * The complete contents of `tokens.css`.
 *
 * ## Why the dark scheme is a media query and not a class
 *
 * `prefers-color-scheme` follows the operating system, so the page is right on first
 * load and the user has to do nothing. A toggle would be a **feature** — a control, a
 * state, somewhere to persist it — and M7 slice 1 is not a feature milestone. It is
 * recorded as deliberately absent rather than as an oversight.
 *
 * ## Why `color-scheme` is set
 *
 * It is what makes the scrollbar, the form-control defaults, and the caret follow the
 * scheme. Without it a dark scheme paints this page's colours onto a light-mode
 * scrollbar, which reads as a rendering fault rather than a design.
 */
export function renderTokensCss(): string {
  return `${BANNER}

/* The light scheme is the default, so it is the \`:root\` block itself rather than a
   media query guarding it. A page opened in a browser with no \`prefers-color-scheme\`
   support at all still gets a complete, checked palette. */
:root {
  color-scheme: light dark;

  /* Surfaces */
${schemeColours("light")}

${sharedGroups()}
}

@media (prefers-color-scheme: dark) {
  :root {
    /* The dark scheme is declared in full, not derived. See tokens.ts. */
${schemeColours("dark").replace(/^ {2}/gm, "    ")}
  }
}
`;
}
