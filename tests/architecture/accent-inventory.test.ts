/**
 * The accent inventory in `docs/DESIGN_SYSTEM.md`, held to the stylesheets it inventories.
 *
 * ## What this file is
 *
 * `DESIGN.md` says where the accent may go — five jobs, in a list it declares closed — and
 * `docs/DESIGN_SYSTEM.md` carries the other half: **a measurement of which declarations
 * actually use it.** The two are different claims about different things, and the second one is
 * the one that can go stale silently, because a stylesheet does not have to tell a document
 * that it changed.
 *
 * The section that carries the inventory used to carry a **second list of permitted surfaces**,
 * and it had drifted from the record in both directions — naming two surfaces as absent that
 * had shipped, counting five declarations while omitting every `--surface-accent` use, and
 * apologising for a declaration the record names outright. **A list beside an authority is a
 * list that drifts, and nothing says which one wins.** So the document now inventories the
 * tree, and this file is what keeps the inventory true.
 *
 * ## Why it is not a case in `design-record.test.ts`
 *
 * That file owns `DESIGN.md` and says so in its own doc block: it asserts the frontmatter, and
 * it is explicit that the body is prose a person owns and that no rule there checks whether the
 * prose is true. **This is the one prose claim that can be checked without asserting a
 * judgement**, because a declaration is a fact the stylesheets carry.
 *
 * ## What it asserts, and in which direction
 *
 * - **The tree is read first, and non-vacuously.** A reader whose paths stopped resolving
 *   reports nothing, and "nothing is missing from the document" is satisfied by nothing.
 * - **Tree → document.** Every declaration in either stylesheet that names one of the four
 *   accent tokens has a row naming the same file, selector, property and value.
 * - **Document → tree.** Every row names a declaration some stylesheet carries, and the two
 *   counts agree last.
 *
 * ## What it does not assert
 *
 * **The `Job` column is not checked against a taxonomy.** Which job a declaration serves is a
 * judgement about design, and a rule that nailed it down would be a list of exemptions dressed
 * as a measurement — the defect this repository records most often. The instrument requires
 * that the cell exists and says something; a person decides what it says.
 *
 * **It says nothing about whether the accent *should* be on a declaration.** Three of the rows
 * are on none of the record's five jobs, and the two focus rings are a job the record's own
 * paragraph names and its list does not. Both are recorded in the document rather than repaired
 * here, because moving a declaration off the accent changes what the page looks like.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { CORPUS } from "./scan-corpus";

const DOCUMENT = "docs/DESIGN_SYSTEM.md";

/** The heading the inventory lives under, and the table that carries it. */
const SECTION = "## Accent";
const COLUMNS: readonly string[] = ["File", "Selector", "Declaration", "Job"];

/**
 * The four tokens the accent is declared as.
 *
 * **`--focus` is in this list and `--ink-on-accent` is not**, which is the distinction the
 * fourth case exists to hold: the ring is the accent by declaration, while `--ink-on-accent` is
 * the ink that sits *on* it. A reader matching the substring `accent` would conflate them.
 */
const ACCENT_TOKENS: readonly string[] = ["accent", "ink-accent", "surface-accent", "focus"];

const STYLESHEETS: readonly string[] = ["apps/web/src/styles.css", "apps/extension/src/styles.css"];

type Declaration = {
  readonly file: string;
  readonly selector: string;
  readonly property: string;
  readonly value: string;
};

/** One line of the document, numbered as an editor numbers it. */
type Line = { readonly number: number; readonly text: string };

/* ================================================================================================ *
 * 1. READING THE TREE.
 * ================================================================================================ */

function read(path: string): string {
  try {
    return readFileSync(join(CORPUS, path), "utf8").replace(/\r\n/g, "\n");
  } catch {
    throw new Error(`${path} is absent from the corpus at ${join(CORPUS, path)}`);
  }
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
const TOKEN_REFERENCE = /var\(\s*--([a-z0-9-]+)\s*\)/g;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Every `var(--name)` a value reaches, in order. */
function tokenNames(value: string): readonly string[] {
  return [...value.matchAll(TOKEN_REFERENCE)].map((match) => match[1] as string);
}

function accentTokens(value: string): readonly string[] {
  return tokenNames(value).filter((name) => ACCENT_TOKENS.includes(name));
}

/**
 * Every declaration in one stylesheet whose value names an accent token, with the selector of
 * the rule it sits in.
 *
 * **The reader tracks braces rather than matching lines**, because a selector spans lines
 * (`.control:focus-visible,\n.inbox-row:focus-visible,\n.link__anchor:focus-visible {`) and a
 * line-oriented reader reports three selectors for one rule or none at all. The declaration is
 * what carries the colour, so the declaration is what is inventoried — a rule that carries the
 * accent does not make its neighbours accent declarations, and the first case asserts that.
 *
 * **A declaration is emitted for the innermost rule, not for an enclosing at-rule**, so a
 * declaration inside `@media` is reported against the selector a person would edit. There is no
 * such declaration in the tree today and the fourth case holds the reader able to see one.
 */
function declarationsOf(file: string, source: string): readonly Declaration[] {
  const text = source.replace(COMMENT, "");
  const frames: { readonly atRule: boolean; readonly prelude: string }[] = [];
  const found: Declaration[] = [];
  let buffer = "";

  const emit = (): void => {
    for (const statement of buffer.split(";")) {
      const colon = statement.indexOf(":");

      if (colon < 0) continue;

      const property = statement.slice(0, colon).trim();
      const value = collapse(statement.slice(colon + 1));

      if (property === "" || value === "") continue;
      if (accentTokens(value).length === 0) continue;

      const rule = [...frames].reverse().find((frame) => !frame.atRule);

      if (rule === undefined) continue;

      found.push({ file, selector: rule.prelude, property, value });
    }

    buffer = "";
  };

  for (const character of text) {
    if (character === "{") {
      frames.push({ atRule: collapse(buffer).startsWith("@"), prelude: collapse(buffer) });
      buffer = "";
      continue;
    }

    if (character === "}") {
      emit();
      frames.pop();
      buffer = "";
      continue;
    }

    if (character === ";") {
      emit();
      continue;
    }

    buffer += character;
  }

  return found;
}

/* ================================================================================================ *
 * 2. READING THE DOCUMENT.
 * ================================================================================================ */

/** The lines of the `## Accent` section, numbered, up to the next second-level heading. */
function accentSection(text: string): readonly Line[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === SECTION);

  if (start < 0) {
    throw new Error(`${DOCUMENT} carries no \`${SECTION}\` heading`);
  }

  const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  const stop = end < 0 ? lines.length : end;

  return lines
    .slice(start + 1, stop)
    .map((line, index) => ({ number: start + 2 + index, text: line }));
}

function cells(text: string): readonly string[] {
  const trimmed = text.trim();

  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];

  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function unquote(cell: string): string {
  return cell.length >= 2 && cell.startsWith("`") && cell.endsWith("`") ? cell.slice(1, -1) : cell;
}

/**
 * The inventory the document carries.
 *
 * **A malformed row is refused by line number rather than skipped**, because a skipped row is
 * a declaration the document silently stopped inventorying — and the case that compares the two
 * counts would then agree with the document about the wrong thing. A line that is not a table
 * row ends the table, which is what tells a malformed row apart from the table's end.
 */
function inventory(text: string): readonly Declaration[] {
  const lines = accentSection(text);
  const header = lines.findIndex((line) => {
    const found = cells(line.text);
    return found.length === COLUMNS.length && found.every((cell, index) => cell === COLUMNS[index]);
  });

  if (header < 0) {
    throw new Error(
      `${DOCUMENT}'s \`${SECTION}\` section carries no \`| ${COLUMNS.join(" | ")} |\` table, so there is no inventory to read`,
    );
  }

  const rows: Declaration[] = [];

  // The header's separator row is not a declaration.
  for (let index = header + 2; index < lines.length; index += 1) {
    const line = lines[index] as Line;
    const found = cells(line.text);

    if (found.length === 0) break;

    if (found.length !== COLUMNS.length) {
      throw new Error(
        `${DOCUMENT}:${line.number} is inside the accent inventory but carries ${found.length} cells rather than ${COLUMNS.length}: ${line.text}`,
      );
    }

    const declaration = unquote(found[2] as string);
    const colon = declaration.indexOf(":");

    if (colon < 0) {
      throw new Error(
        `${DOCUMENT}:${line.number}'s declaration cell is not \`property: value\`: ${line.text}`,
      );
    }

    if ((found[3] as string) === "") {
      throw new Error(
        `${DOCUMENT}:${line.number} inventories a declaration with no job named: ${line.text}`,
      );
    }

    rows.push({
      file: unquote(found[0] as string),
      selector: unquote(found[1] as string),
      property: declaration.slice(0, colon).trim(),
      value: collapse(declaration.slice(colon + 1)),
    });
  }

  return rows;
}

function keyOf(declaration: Declaration): string {
  return `${declaration.file} :: ${declaration.selector} :: ${declaration.property}: ${declaration.value}`;
}

/**
 * A failure message that carries the rows it is about.
 *
 * **`expect(value, message)` replaces the matcher's own output rather than adding to it**, which
 * this file's first falsification pass measured: a case that reported *"missing 1 declaration"*
 * printed `expected [ Array(1) ] to deeply equal []` and never named the declaration. **A report
 * that says something is wrong without saying which one is a report a reader has to reproduce by
 * hand**, and this repository has recorded that shape often enough to check for it here.
 */
function report(headline: string, rows: readonly string[]): string {
  return rows.length === 0 ? headline : [headline, ...rows.map((row) => `  ${row}`)].join("\n");
}

/* ================================================================================================ *
 * 3. THE TWO SIDES, READ ONCE. A file that is absent is a load failure on purpose.
 * ================================================================================================ */

const TEXT = read(DOCUMENT);
const TREE: readonly Declaration[] = STYLESHEETS.flatMap((file) =>
  declarationsOf(file, read(file)),
);

/* ================================================================================================ *
 * 4. THE MEASUREMENT, IN BOTH DIRECTIONS.
 * ================================================================================================ */

describe("the accent inventory restates the stylesheets", () => {
  test("reads both stylesheets, and every declaration it reports names an accent token", () => {
    for (const file of STYLESHEETS) {
      const carried = TREE.filter((declaration) => declaration.file === file);

      expect(
        carried.length,
        `${file} contributes no accent declaration, which is a reader that resolved nothing rather than a stylesheet with no accent in it`,
      ).toBeGreaterThan(0);
    }

    for (const declaration of TREE) {
      expect(
        accentTokens(declaration.value).length,
        `${declaration.file}'s \`${declaration.selector}\` declaration \`${declaration.property}\` was reported without naming an accent token, so the reader is matching something other than the value`,
      ).toBeGreaterThan(0);
    }

    // **A rule that carries the accent does not make its neighbours accent declarations.** The
    // focus rules carry `outline-offset: var(--offset-focus)` and margins beside their
    // `outline`, and a reader that inventoried whole rules would list them.
    const offsets = TREE.filter((declaration) => declaration.property === "outline-offset").map(
      (declaration) => keyOf(declaration),
    );

    expect(
      offsets,
      report("the reader is inventorying whole rules rather than declarations:", offsets),
    ).toEqual([]);
  });

  test("the document inventories every accent declaration either stylesheet carries", () => {
    const documented = new Set(inventory(TEXT).map((row) => keyOf(row)));
    const missing = TREE.filter((declaration) => !documented.has(keyOf(declaration))).map(
      (declaration) => keyOf(declaration),
    );

    expect(
      missing,
      report(
        `${DOCUMENT}'s accent inventory is missing ${missing.length} declaration(s) a stylesheet carries — add the row, or take the declaration off the accent:`,
        missing,
      ),
    ).toEqual([]);
  });

  test("the document invents no accent declaration, and the two counts agree last", () => {
    const documented = inventory(TEXT);
    const carried = new Set(TREE.map((declaration) => keyOf(declaration)));
    const invented = documented.filter((row) => !carried.has(keyOf(row))).map((row) => keyOf(row));

    expect(
      invented,
      report(
        `${DOCUMENT}'s accent inventory names ${invented.length} declaration(s) no stylesheet carries — the row is describing a rule that was renamed or removed:`,
        invented,
      ),
    ).toEqual([]);

    expect(
      documented.length,
      `${DOCUMENT} inventories ${documented.length} declaration(s) and the stylesheets carry ${TREE.length}`,
    ).toBe(TREE.length);
  });

  test("the two readers are self-tested before either is trusted", () => {
    // A declaration inside an at-rule is reported against the rule a person would edit.
    const atRule = declarationsOf(
      "fixture.css",
      "@media (min-width: 1px) {\n  .probe {\n    color: var(--accent);\n  }\n}\n",
    );

    expect(atRule.map((declaration) => declaration.selector)).toEqual([".probe"]);

    // A declaration inside a comment is not a declaration. Every rule in both stylesheets is
    // written with prose above it that names the token it uses.
    const commented = declarationsOf(
      "fixture.css",
      "/* .probe { color: var(--accent); } */\n.other { color: var(--ink-primary); }\n",
    );

    expect(
      commented.map((declaration) => keyOf(declaration)),
      report(
        "a declaration inside a comment must not be a declaration:",
        commented.map((declaration) => keyOf(declaration)),
      ),
    ).toEqual([]);

    // **The neighbours of the accent are not the accent.** `--ink-on-accent` is the ink on the
    // fill and `--surface-raised` is a neutral; a reader matching the word `accent` reports
    // both, and the inventory would then be a list of everything near a colour.
    const neighbours = declarationsOf(
      "fixture.css",
      ".probe { color: var(--ink-on-accent); background: var(--surface-raised); }\n",
    );

    expect(
      neighbours.map((declaration) => keyOf(declaration)),
      report(
        "a token whose name merely contains `accent` is not an accent token:",
        neighbours.map((declaration) => keyOf(declaration)),
      ),
    ).toEqual([]);

    const row =
      "| `apps/web/src/styles.css` | `.probe` | `color: var(--accent)` | Verification — a probe |";

    const wellFormed = [
      SECTION,
      "",
      `| ${COLUMNS.join(" | ")} |`,
      `| ${COLUMNS.map(() => "---").join(" | ")} |`,
      row,
    ];

    expect(
      inventory(wellFormed.join("\n")),
      "the row reader refuses a well-formed row",
    ).toHaveLength(1);

    // A malformed row is refused by line number rather than skipped, and the control above is
    // what stops "refuses everything" from satisfying this.
    const malformed = [
      SECTION,
      "",
      `| ${COLUMNS.join(" | ")} |`,
      `| ${COLUMNS.map(() => "---").join(" | ")} |`,
      row,
      "| `apps/web/src/styles.css` | `.probe` | `color: var(--accent)` |",
    ];

    expect(() => inventory(malformed.join("\n"))).toThrow(/:6 is inside the accent inventory/);
  });
});
