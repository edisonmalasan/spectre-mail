/**
 * The generated half of `docs/DESIGN_SYSTEM.md`.
 *
 * ## Why this is a function and not a script that writes prose
 *
 * Because a document that describes a token layer by hand will be wrong within one
 * milestone, and it will be wrong **quietly**: a reader has no way to tell a stale hex
 * from a current one. `packages/ui/src/tokens.ts` is the only place a design value is
 * written down, so the document's tables are a projection of it, exactly as
 * `tokens.css` is.
 *
 * The alternative — `docs/DESIGN_SYSTEM.md` listing hex values with no link to the file
 * they came from — is the same drift that `tokens.ts` was created to prevent, reintroduced
 * in Markdown. A promotion to the M8 design contract that cites a table nobody can verify
 * is a contract with a copy of the truth in it.
 *
 * ## What it emits, and what it deliberately does not
 *
 * **Emits:** the colour table for both schemes, the contrast table with the ratio each
 * declared pair measures, the type/spacing/radius/metrics/motion tables, and the two
 * exclusion lists with their reasons.
 *
 * **Does not emit:** any prose about what the design *means*. A generated paragraph reads
 * as authoritative and is not, and the argument for the palette belongs in the file whose
 * `why` fields carry it — which is `pairs.ts`, linked from every row below.
 *
 * ## Why the tables are padded here rather than left to Prettier
 *
 * Because `pnpm format:check` governs this file from the moment it is created — it is not
 * in `.prettierignore`, and the exclusions there are for pre-existing long-form documents,
 * not a precedent. Prettier's markdown formatter realigns table columns to their widest
 * cell, so an unpadded table here would be rewritten on the next format run and the
 * byte-identity test would go red on a formatting change rather than on a design change.
 * Padding to the same width Prettier computes is what makes "the file is formatted" and
 * "the file is current" the same fact.
 *
 * @module
 */

/**
 * **The `.ts` extensions on these three imports are required, not a style choice**, and
 * `tokens-css.ts` already carries them for the same reason.
 *
 * Two emitters run under Node's type stripping, where a `.ts` file is loaded as an ES
 * module and Node's resolver needs a real path. An extensionless import resolves fine under
 * `vitest` and under `tsc`, and fails with `ERR_MODULE_NOT_FOUND` in the one place that
 * actually executes the code — which is why `pairs.ts` and this file both spell theirs out
 * even though every other import in the package does not. The test file beside this one
 * asserts the extensions are present, because dropping them is exactly the edit that type
 * checks and breaks only the emitter.
 */
import { contrastRatio, type ContrastThreshold } from "./contrast.ts";
import { DECORATIVE, PAIRS, SURFACE_ONLY } from "./pairs.ts";
import { COLOUR_NAMES, MOTION, SCHEMES, SHARED_GROUPS, type Scheme } from "./tokens.ts";

/**
 * The markers the emitter replaces between.
 *
 * **Deliberately visible HTML comments rather than nothing.** An emitter that rewrites a
 * whole file needs the prose around it to survive, so it needs a seam; a seam that is
 * invisible in rendered Markdown but greppable in source is exactly a pair of HTML comments,
 * and putting the generator's name inside them means the next reader learns where the
 * table came from before they decide to edit it.
 */
export const GENERATED_BEGIN =
  "<!-- BEGIN GENERATED: tokens. Written by packages/ui/scripts/emit-design-doc.ts from packages/ui/src/tokens.ts and packages/ui/src/pairs.ts. Edit those files and re-run the emitter; never edit this region by hand. -->";
export const GENERATED_END = "<!-- END GENERATED: tokens -->";

/**
 * Swap the generated region inside a document, leaving every byte outside it alone.
 *
 * ## Why this lives here and not in the emitter
 *
 * Because a module the test suite imports must have no side effects, and the honest way to
 * achieve that is to make it impossible rather than to gate it.
 *
 * `replaceGeneratedRegion` originally sat in `scripts/emit-design-doc.ts` beside the
 * top-level write. `design-doc.test.ts` imports it, so **the test suite rewrote
 * `docs/DESIGN_SYSTEM.md` while running** — and a suite that repairs the artefact it is
 * checking can leave the file correct while the assertion still fails against its own
 * stale in-memory copy. The failure would have been real and the tree modified by the run
 * that reported it.
 *
 * The first repair was a `process.argv[1]` guard, and it was replaced rather than kept
 * because the test that could have checked it could only check the **text** of the guard
 * rather than the behaviour, which is the recorded "narrower than its rule" defect one
 * layer down: the assertion would have stayed green after the guard was inverted. Here
 * there is nothing to invert — this file imports no write API at all, and the test asserts
 * exactly that.
 *
 * ## Its refusals are part of the contract, not defensive noise
 *
 * A missing marker pair, or a reversed one, means the emitter cannot find its seam. The
 * only safe answers are to say so and change nothing: appending a second region would leave
 * two token tables in one document, and the document would then look authoritative while
 * half of it was stale.
 */
export function replaceGeneratedRegion(document: string, region: string): string {
  const begin = document.indexOf(GENERATED_BEGIN);
  const end = document.indexOf(GENERATED_END);

  if (begin === -1 || end === -1) {
    throw new Error(
      [
        `The markers are missing. Expected both`,
        `  ${GENERATED_BEGIN}`,
        `and`,
        `  ${GENERATED_END}`,
        `to be present, verbatim.`,
      ].join("\n"),
    );
  }

  if (end < begin) {
    throw new Error("The markers are the wrong way round: the end marker comes first.");
  }

  return `${document.slice(0, begin)}${region}${document.slice(end + GENERATED_END.length)}`;
}

/**
 * A threshold's name and value, so the table prints neither a bare number nor a restated one.
 *
 * **A function because the lookup was a compile error, and then because the function was a
 * false label.** The first version recovered the name by comparing values: `LARGE_TEXT` and
 * `NON_TEXT` are both `3`, so a `Record<number, string>` keyed by both declares the same
 * property twice and `tsc` rejects it. Distinguishing by identity did not help either, because
 * two constants holding the same primitive *are* the same value — so the comparison matched
 * `LARGE_TEXT` first and **every non-text pair printed "large text (3:1)"**.
 *
 * The name is now carried by the standard, so there is nothing to recover and nothing to get
 * wrong: this prints the name it was handed and the ratio from the same object, which cannot
 * disagree with each other.
 */
function thresholdName(threshold: ContrastThreshold): string {
  return `${threshold.name} (${threshold.ratio}:1)`;
}

/** The scheme names in the order a reader wants them. */
const SCHEME_ORDER: readonly Scheme[] = ["light", "dark"];

/**
 * A GitHub-flavoured Markdown table whose columns are padded to their widest cell.
 *
 * **Padded rather than emitted bare, because Prettier pads and this file is governed.**
 * See the module comment. The width used is `String.length`, which is what Prettier uses
 * for the ASCII identifiers and hex values in these tables; a cell containing an
 * astral-plane character would be counted as one unit rather than two and could then be
 * realigned by a format run, which is why the generated content is deliberately ASCII.
 */
function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length)),
  );

  const line = (cells: readonly string[]): string =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(" | ")} |`;

  const divider = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;

  return [line(headers), divider, ...rows.map(line)].join("\n");
}

/** The colour one scheme declares, by name, without re-typing the union's keys. */
function colour(scheme: Scheme, name: string): string {
  return SCHEMES[scheme][name as keyof (typeof SCHEMES)[Scheme]];
}

/** `4.50` — the ratio a pair measures, to WCAG's stated precision. */
function ratio(ink: string, surface: string, scheme: Scheme): string {
  return contrastRatio(colour(scheme, ink), colour(scheme, surface)).toFixed(2);
}

/**
 * The whole generated region, including its markers.
 *
 * **One function, so the test and the emitter cannot disagree about what "generated"
 * means.** A test that re-derived the table would be a second generator, and a second
 * generator drifts from the first within a milestone for the same reason a second copy of
 * a spec drifts.
 */
export function renderDesignDoc(): string {
  /**
   * Section blocks, joined by a blank line.
   *
   * **Blocks rather than one flat list of lines, and the reason is measured.** The first
   * version pushed heading, blank, prose, blank, table as five consecutive strings, so every
   * section after the first began on the line immediately after the previous table. Prettier
   * requires a blank line before a heading and inserted one at each of the seven seams —
   * so `pnpm format:check` failed on the document **the emitter had just written**, and it
   * would keep failing on every run.
   *
   * The tempting fix was to run Prettier over the emitter's output, and that is precisely
   * the wrong one: the committed region would then differ from {@link renderDesignDoc} by
   * the formatter's opinion, and `design-doc.test.ts`'s byte-identity assertion — the whole
   * guarantee that the tables cannot drift from the token layer — would be checking
   * Prettier instead. **The renderer has to be already-formatted, not become formatted.**
   */
  const sections: string[] = [];

  sections.push(
    [
      "### Colour",
      "",
      "One hex per scheme, in `packages/ui/src/tokens.ts` and nowhere else. Every value below",
      "is held to a ratio in the table under it, in **both** schemes, by",
      "`packages/ui/src/pairs.test.ts`.",
      "",
      table(
        ["Token", ...SCHEME_ORDER],
        COLOUR_NAMES.map((name) => [
          `\`--${name}\``,
          ...SCHEME_ORDER.map((scheme) => `\`${SCHEMES[scheme][name]}\``),
        ]),
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "### Declared contrast",
      "",
      "Every pair below is declared in `pairs.ts` with a threshold and a reason, and is",
      "asserted in **both** schemes. The ratios are computed here from the same values, so a",
      "number in this document cannot disagree with a number in the test.",
      "",
      table(
        [
          "Foreground",
          "Background",
          "Threshold",
          ...SCHEME_ORDER.map((scheme) => `${scheme} ratio`),
          "Used for",
        ],
        PAIRS.map((pair) => [
          `\`--${pair.ink}\``,
          `\`--${pair.surface}\``,
          thresholdName(pair.threshold),
          ...SCHEME_ORDER.map((scheme) => ratio(pair.ink, pair.surface, scheme)),
          pair.what,
        ]),
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "### Deliberately held to no threshold",
      "",
      "**Listed rather than omitted.** An omission reads as an oversight, and the first",
      "person to move one of these into a pair list would find a red test with no explanation.",
      "",
      table(
        ["Token", "Why nothing depends on it being readable"],
        [
          ...DECORATIVE.map((entry) => [`\`--${entry.token}\``, entry.why]),
          ...SURFACE_ONLY.map((entry) => [`\`--${entry.token}\``, entry.why]),
        ],
      ),
    ].join("\n"),
  );

  /**
   * Every shared group except Motion.
   *
   * **Motion is emitted separately below, with prose.** It is in `SHARED_GROUPS` so the
   * generated stylesheet emits it in the right order, but the table needs the note saying it
   * is used by nothing yet, and a loop cannot attach prose to one row of five.
   */
  for (const [name, group] of SHARED_GROUPS) {
    if (name === "Motion") continue;

    sections.push(
      [
        `### ${name}`,
        "",
        table(
          ["Token", "Value"],
          Object.entries(group).map(([token, value]) => [`\`--${token}\``, `\`${value}\``]),
        ),
      ].join("\n"),
    );
  }

  sections.push(
    [
      "### Motion",
      "",
      "**Declared and used by nothing in this slice.** The motion itself arrives in M7 slice 2,",
      "atomically with `prefers-reduced-motion` handling — shipping an animation with no way to",
      "stop it would create the exact problem this milestone exists to solve. The tokens are",
      "here so that slice has one place to read, and so the first animation's duration is not",
      "chosen at the moment someone writes the animation.",
      "",
      table(
        ["Token", "Value"],
        Object.entries(MOTION).map(([token, value]) => [`\`--${token}\``, `\`${value}\``]),
      ),
    ].join("\n"),
  );

  /**
   * One blank line on each side of the region, and one between the sections.
   *
   * **Exactly one, which took a measurement to establish.** The marker comment and the first
   * heading are separated by an HTML comment, so Prettier treats the comment as its own block
   * and wants a blank line on each side of it — three lines in total around the marker, not
   * the four that `"\n\n"` produces between the marker and the first section.
   */
  return [GENERATED_BEGIN, "", sections.join("\n\n"), "", GENERATED_END].join("\n");
}
