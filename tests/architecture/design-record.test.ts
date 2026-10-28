/**
 * `DESIGN.md` against the token layer it restates.
 *
 * ## What this file is
 *
 * Impeccable reads two records before it touches a surface: `PRODUCT.md`, which says what the
 * product is, and `DESIGN.md`, which says what the interface already looks like. **The second
 * carries a machine-readable frontmatter block, and that block is the half that can go wrong
 * silently** — a palette edited in `packages/ui/src/tokens.ts` and not here leaves a document
 * describing a product nobody ships, and nothing else in this repository would say so.
 *
 * **So the frontmatter is asserted against the token layer rather than generated from it.**
 * Generation was the obvious alternative and it is wrong here for a reason this repository has
 * already recorded about its own design document: the body is prose that design work must be free
 * to rewrite, and a generator that owned only the fence would still have to run — so the first
 * time somebody edits the body and not the generator, the file has two authors and no rule about
 * which one wins. **Assertion keeps one author: the person.**
 *
 * ## What it asserts, and in which direction
 *
 * Every group is checked **both ways**. One direction catches a value that drifted; the other
 * catches a token that moved and left its row behind. Only the first would pass with a colour
 * added to the layer and no entry here; only the second would pass with an entry naming a colour
 * the layer has never heard of.
 *
 * **And neither direction is written as a count.** A matching count is satisfied by the wrong set
 * as readily as by the right one — the defect this repository records as *a set spelled twice* —
 * so the assertions compare sets and name the key that disagreed.
 *
 * The groups: **thirty** colour entries (fifteen tokens in two declared schemes), **eight** type
 * roles, **four** radii, **ten** spacing steps. **The second entry per colour is deliberate**: the
 * product ships two declared schemes and holds both to the same contrast thresholds, so a
 * light-only map would be a false record of a palette that has a dark half.
 *
 * ## What it does not assert
 *
 * **Not that the prose is true.** Every named rule, every judgement about weight, and every
 * component description in the body is a claim a machine cannot check, and this file does not
 * pretend otherwise. It asserts that the eight canonical sections exist, are non-empty and are in
 * the canonical order, and that the body carries **no hex literal** — which is the one prose defect
 * that *is* mechanical, because it is exactly how a design document becomes a second source of
 * truth for values its frontmatter already declares.
 *
 * **And it does not assert that anyone has read it.** That is `DESIGN.md`'s own subject, and the
 * instrument for it is a person.
 *
 * ## Why the reader is hand-rolled
 *
 * **No YAML parser is installed in this workspace**, and adding one to check a document that this
 * file already knows the shape of would be a dependency bought to avoid writing a hundred lines.
 * The cost is that the reader is ours and can be wrong, so it is **self-tested against malformed
 * input in six shapes** — a reader that matches nothing reports the absence of the thing it looked
 * for, and this repository has recorded that failure more often than any other.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { PRODUCT_NAME } from "../../packages/ui/src/name";
import { COLOUR_NAMES, RADIUS, SCHEMES, SPACE, TYPOGRAPHY } from "../../packages/ui/src/tokens";

import { CORPUS } from "./scan-corpus";

/**
 * The record under test, at the repository root.
 *
 * **Root rather than `docs/`, because Impeccable reads it before it reads anything else** and
 * because all three surfaces — the website, the popup and the panel — inherit the same palette.
 * A file per surface would be three records that agree until the day one of them does not.
 */
const DOCUMENT = "DESIGN.md";

/** The eight sections the format defines, in the order it defines them. */
const CANONICAL_SECTIONS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts",
] as const;

/**
 * The frontmatter's typography roles, as **the tokens each one is built from**.
 *
 * **This is the one table the repository cannot derive**, and it is declared rather than computed
 * for a reason worth stating: the frontmatter's shape is *role → property → value*, and the token
 * layer's shape is *token name → value*. Nothing in either declares that `headline` means
 * `type-xl` at `weight-medium` in `leading-tight` with `tracking-tight`; that is a decision about
 * the product's hierarchy, and a derivation that guessed it would be inventing one.
 *
 * **A declared table is a place a typo can hide**, so it gets two checks rather than one: the case
 * below resolves every token it names through `TYPOGRAPHY` in both directions, and a separate case
 * asserts that every token it names *exists* — because a renamed token would otherwise be caught
 * only as an `undefined` value in a diff nobody reads.
 */
const TYPE_ROLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  display: {
    fontFamily: "font-sans",
    fontSize: "type-3xl",
    fontWeight: "weight-bold",
    lineHeight: "leading-tight",
    letterSpacing: "tracking-tight",
  },
  headline: {
    fontFamily: "font-sans",
    fontSize: "type-xl",
    fontWeight: "weight-medium",
    lineHeight: "leading-tight",
    letterSpacing: "tracking-tight",
  },
  title: {
    fontFamily: "font-sans",
    fontSize: "type-lg",
    fontWeight: "weight-medium",
    lineHeight: "leading-tight",
  },
  subtitle: {
    fontFamily: "font-sans",
    fontSize: "type-base",
    fontWeight: "weight-bold",
    lineHeight: "leading-normal",
  },
  body: {
    fontFamily: "font-sans",
    fontSize: "type-base",
    fontWeight: "weight-regular",
    lineHeight: "leading-relaxed",
  },
  label: {
    fontFamily: "font-sans",
    fontSize: "type-sm",
    fontWeight: "weight-medium",
    lineHeight: "leading-normal",
  },
  mono: {
    fontFamily: "font-mono",
    fontSize: "type-sm",
    lineHeight: "leading-relaxed",
  },
  code: {
    fontFamily: "font-mono",
    fontSize: "type-lg",
    letterSpacing: "tracking-wide",
  },
};

/** The token layer's own strings, widened so a name that is not a literal can be looked up. */
const TYPOGRAPHY_VALUES: Readonly<Record<string, string>> = TYPOGRAPHY;
const LIGHT: Readonly<Record<string, string>> = SCHEMES.light;
const DARK: Readonly<Record<string, string>> = SCHEMES.dark;

/* ================================================================================================ *
 * 1. THE READER. Strict, line-based, and self-tested below before any of its answers are believed.
 * ================================================================================================ */

/** A parsed frontmatter block, in the three shapes the format actually uses. */
interface DesignRecord {
  /** Top-level scalars: `name`, `description`. */
  readonly scalars: ReadonlyMap<string, string>;
  /** A top-level block of `key: value` rows: `colors`, `rounded`, `spacing`. */
  readonly tables: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** A top-level block of blocks: `typography`, whose rows are themselves rows. */
  readonly nested: ReadonlyMap<string, ReadonlyMap<string, ReadonlyMap<string, string>>>;
}

/** A key at any depth. Narrow on purpose: every scale name this repository uses fits it. */
const KEY = /^[A-Za-z][A-Za-z0-9-]*$/;

/**
 * A scalar value, in the three forms the format needs.
 *
 * **The number form exists because YAML types `1.15` as a number and the token layer types it as a
 * string**, so both are read as their text. `fontWeight: 600` and `lineHeight: "1.15"` therefore
 * compare equal to `TYPOGRAPHY["weight-bold"]` and `TYPOGRAPHY["leading-tight"]`, and a reader that
 * preserved the JavaScript type would report a mismatch that is not one.
 */
const QUOTED = /^"([^"]*)"$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const WORD = /^[A-Za-z][A-Za-z0-9._-]*$/;

/**
 * Read the frontmatter block, or throw naming the line that broke it.
 *
 * **Strict rather than forgiving, and the strictness is the instrument.** A lenient reader would
 * accept a block with a four-space indent, parse one level deeper than it looks, and report a
 * document as agreeing with a token layer it never actually compared against.
 */
function parseFrontmatter(text: string): DesignRecord {
  if (!text.startsWith("---\n")) {
    throw new Error("the frontmatter must open with a `---` line on the first line of the file");
  }

  const close = text.indexOf("\n---\n", 3);

  if (close < 0) {
    throw new Error("the frontmatter has no closing `---` line");
  }

  const lines = text.slice(4, close).split("\n");

  const scalars = new Map<string, string>();
  const tables = new Map<string, Map<string, string>>();
  const nested = new Map<string, Map<string, Map<string, string>>>();

  /** The open top-level block, and which of the two shapes it turned out to be. */
  let top: { key: string; kind: "table" | "nested" } | null = null;
  /** The open row inside a `nested` block. */
  let row: string | null = null;

  const fail = (line: number, problem: string): never => {
    throw new Error(`frontmatter line ${line + 1}: ${problem}`);
  };

  lines.forEach((raw, line) => {
    if (raw.trim().length === 0 || raw.trimStart().startsWith("#")) {
      return;
    }

    if (raw.includes("\t")) {
      fail(line, "a tab is not an indent");
    }

    const indent = raw.length - raw.trimStart().length;

    if (indent % 2 !== 0) {
      fail(line, `${indent} spaces is not a whole number of two-space levels`);
    }

    const level = indent / 2;
    const body = raw.trim();

    if (level > 2) {
      fail(line, `indent level ${level} is deeper than this format uses`);
    }

    const colon = body.indexOf(":");

    if (colon < 0) {
      fail(line, `"${body}" is not a \`key: value\` line`);
    }

    const key = body.slice(0, colon).trim();
    const rest = body.slice(colon + 1).trim();

    if (!KEY.test(key)) {
      fail(line, `"${key}" is not a key this reader can address`);
    }

    const value = rest.length === 0 ? null : scalar(rest, line, fail);

    if (level === 0) {
      row = null;
      top = null;

      if (value !== null) {
        if (scalars.has(key)) {
          fail(line, `\`${key}\` is declared twice`);
        }
        scalars.set(key, value);
      } else {
        if (tables.has(key) || nested.has(key)) {
          fail(line, `\`${key}\` is declared twice`);
        }
        top = { key, kind: "table" };
      }
      return;
    }

    if (top === null) {
      fail(line, `\`${key}\` is indented under nothing`);
    }

    if (level === 1) {
      row = null;

      if (value === null) {
        if (top.kind === "table" && tables.has(top.key)) {
          fail(line, `\`${top.key}\` holds rows and \`${key}\` opens a block`);
        }
        top.kind = "nested";
        const into = nested.get(top.key) ?? new Map<string, Map<string, string>>();
        if (into.has(key)) {
          fail(line, `\`${top.key}.${key}\` is declared twice`);
        }
        into.set(key, new Map<string, string>());
        nested.set(top.key, into);
        row = key;
      } else {
        if (top.kind === "nested") {
          fail(line, `\`${top.key}.${key}\` holds a value inside a block of blocks`);
        }
        const into = tables.get(top.key) ?? new Map<string, string>();
        if (into.has(key)) {
          fail(line, `\`${top.key}.${key}\` is declared twice`);
        }
        into.set(key, value);
        tables.set(top.key, into);
      }
      return;
    }

    if (top.kind !== "nested" || row === null) {
      fail(line, `\`${key}\` is indented two levels under nothing that holds blocks`);
    }

    if (value === null) {
      fail(line, `\`${top.key}.${row}.${key}\` opens a block, and the format stops at two`);
    }

    const into = nested.get(top.key)?.get(row);

    if (into === undefined) {
      fail(line, `\`${top.key}.${row}\` was never opened`);
    }

    if (into.has(key)) {
      fail(line, `\`${top.key}.${row}.${key}\` is declared twice`);
    }

    into.set(key, value);
  });

  return { scalars, tables, nested };
}

/**
 * One scalar, as text.
 *
 * **A quoted value may hold anything; a bare one is a number or a single word.** That is narrower
 * than YAML and deliberately so — a value this reader cannot classify is a value whose type this
 * file would otherwise have to guess, and the guesses are exactly where a comparison starts
 * silently comparing nothing.
 */
function scalar(
  text: string,
  line: number,
  fail: (line: number, problem: string) => never,
): string {
  const quoted = QUOTED.exec(text);

  if (quoted !== null) {
    return quoted[1] as string;
  }

  if (NUMBER.test(text) || WORD.test(text)) {
    return text;
  }

  if (text.startsWith('"')) {
    fail(line, "a quoted value is not terminated on its own line");
  }

  fail(line, `"${text}" is neither a quoted string, a number, nor a single word`);
}

/** The document, read once. A fence this cannot read is a load failure on purpose. */
const TEXT = ((): string => {
  try {
    return readFileSync(join(CORPUS, DOCUMENT), "utf8").replace(/\r\n/g, "\n");
  } catch {
    throw new Error(`${DOCUMENT} is absent from the corpus at ${join(CORPUS, DOCUMENT)}`);
  }
})();

const RECORD = parseFrontmatter(TEXT);

/** The body: everything after the closing fence. */
const BODY = TEXT.slice(TEXT.indexOf("\n---\n", 3) + 5);

/** A `key: value` block, or a failure that names the block. */
function table(group: string): ReadonlyMap<string, string> {
  const found = RECORD.tables.get(group);

  if (found === undefined) {
    throw new Error(`${DOCUMENT}'s frontmatter has no \`${group}:\` block`);
  }

  return found;
}

/** A block of blocks, or a failure that names it. */
function nested(group: string): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const found = RECORD.nested.get(group);

  if (found === undefined) {
    throw new Error(`${DOCUMENT}'s frontmatter has no \`${group}:\` block`);
  }

  return found;
}

/** Every `##` heading in a body, in the order the document writes them. */
function sections(body: string): readonly string[] {
  return [...body.matchAll(/^## +(.+?) *$/gm)].map((match) => match[1] as string);
}

/**
 * Every hex colour literal in a body.
 *
 * **Three, four, six or eight digits and nothing else**, so a decision number or an issue reference
 * is not reported as a colour. A pattern that also matched five- and seven-digit runs would report
 * `#0000000` as a literal, and a rule that fires on the wrong thing is a rule somebody deletes.
 */
function hexLiterals(body: string): readonly string[] {
  return [
    ...body.matchAll(
      /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g,
    ),
  ].map((match) => match[0] as string);
}

/** A section's own prose, with its subheadings stripped, so a heading alone is not content. */
function proseOf(body: string, section: string): string {
  const start = body.search(new RegExp(`^## +${escapeRegExp(section)} *$`, "m"));

  if (start < 0) {
    return "";
  }

  const rest = body.slice(start);
  const next = rest.search(/\n## +/);
  const own = next < 0 ? rest : rest.slice(0, next);

  return own.replace(/^#{1,6} +.*$/gm, "").trim();
}

/** A literal for a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ================================================================================================ *
 * 2. THE FRONTMATTER IS THE TOKEN LAYER, RESTATED.
 * ================================================================================================ */

describe("the frontmatter restates the token layer", () => {
  test("names the product and says in one line what it is", () => {
    expect(RECORD.scalars.get("name"), `${DOCUMENT}'s \`name:\` is absent`).toBe(PRODUCT_NAME);
    expect(
      RECORD.scalars.get("description") ?? "",
      `${DOCUMENT}'s \`description:\` is empty, and the format requires one sentence`,
    ).not.toBe("");
  });

  test("declares every colour twice, once per declared scheme, and nothing else", () => {
    const declared = table("colors");
    const expected = new Map<string, string>();

    for (const name of COLOUR_NAMES) {
      expected.set(name, LIGHT[name] as string);
      expected.set(`${name}-dark`, DARK[name] as string);
    }

    // **The direction that catches an entry with no token behind it.**
    for (const key of declared.keys()) {
      expect(
        expected.has(key),
        `\`colors.${key}\` is declared and no colour of that name exists in \`tokens.ts\``,
      ).toBe(true);
    }

    // **The direction that catches a token with no entry behind it** — a colour added to the layer
    // and not to the record, which is the drift this file exists to end.
    for (const [key, value] of expected) {
      expect(declared.has(key), `\`colors.${key}\` is missing from ${DOCUMENT}`).toBe(true);
      expect(declared.get(key), `\`colors.${key}\` disagrees with \`tokens.ts\``).toBe(value);
    }

    // **And the count, last, so a duplicate cannot hide behind it.** A set comparison already
    // implies equality, and this line is the one that names the number in the failure.
    expect(declared.size, `${DOCUMENT} declares ${declared.size} colour entries`).toBe(
      COLOUR_NAMES.length * 2,
    );
  });

  test("builds every type role from tokens the layer declares", () => {
    for (const [role, properties] of Object.entries(TYPE_ROLES)) {
      for (const [property, token] of Object.entries(properties)) {
        expect(
          Object.prototype.hasOwnProperty.call(TYPOGRAPHY_VALUES, token),
          `\`${role}.${property}\` names \`${token}\`, which the token layer does not declare`,
        ).toBe(true);
      }
    }
  });

  test("declares exactly the type roles the role map names, each resolved through the layer", () => {
    const declared = nested("typography");

    for (const role of declared.keys()) {
      expect(
        Object.prototype.hasOwnProperty.call(TYPE_ROLES, role),
        `\`typography.${role}\` is declared and the role map has no such role`,
      ).toBe(true);
    }

    for (const [role, properties] of Object.entries(TYPE_ROLES)) {
      const rows = declared.get(role);

      expect(rows, `\`typography.${role}\` is missing from ${DOCUMENT}`).toBeDefined();

      const actual = rows as ReadonlyMap<string, string>;

      for (const property of actual.keys()) {
        expect(
          Object.prototype.hasOwnProperty.call(properties, property),
          `\`typography.${role}.${property}\` is declared and the role does not carry it`,
        ).toBe(true);
      }

      for (const [property, token] of Object.entries(properties)) {
        expect(actual.has(property), `\`typography.${role}.${property}\` is missing`).toBe(true);
        expect(actual.get(property), `\`typography.${role}.${property}\` is not \`${token}\``).toBe(
          TYPOGRAPHY_VALUES[token],
        );
      }
    }
  });

  test("declares the radius scale the layer declares, in both directions", () => {
    const declared = table("rounded");
    const expected: Readonly<Record<string, string>> = RADIUS;

    for (const key of declared.keys()) {
      expect(
        Object.prototype.hasOwnProperty.call(expected, key),
        `\`rounded.${key}\` is declared and the layer has no such radius`,
      ).toBe(true);
    }

    for (const [key, value] of Object.entries(expected)) {
      expect(declared.has(key), `\`rounded.${key}\` is missing from ${DOCUMENT}`).toBe(true);
      expect(declared.get(key), `\`rounded.${key}\` disagrees with \`tokens.ts\``).toBe(value);
    }
  });

  test("declares the spacing scale the layer declares, in both directions", () => {
    const declared = table("spacing");
    const expected: Readonly<Record<string, string>> = SPACE;

    for (const key of declared.keys()) {
      expect(
        Object.prototype.hasOwnProperty.call(expected, key),
        `\`spacing.${key}\` is declared and the layer has no such step`,
      ).toBe(true);
    }

    for (const [key, value] of Object.entries(expected)) {
      expect(declared.has(key), `\`spacing.${key}\` is missing from ${DOCUMENT}`).toBe(true);
      expect(declared.get(key), `\`spacing.${key}\` disagrees with \`tokens.ts\``).toBe(value);
    }
  });
});

/* ================================================================================================ *
 * 3. THE BODY. Eight canonical sections, in order, carrying prose and no values.
 * ================================================================================================ */

describe("the body carries the format's eight sections", () => {
  test("names the product in its title and opens with the first canonical section", () => {
    expect(TEXT, `${DOCUMENT} does not open with \`# Design System: ${PRODUCT_NAME}\``).toContain(
      `\n# Design System: ${PRODUCT_NAME}\n`,
    );
    expect(
      sections(BODY)[0],
      `${DOCUMENT}'s first \`##\` section is not \`${CANONICAL_SECTIONS[0]}\``,
    ).toBe(CANONICAL_SECTIONS[0]);
  });

  test("writes the eight canonical sections, once each, in the canonical order", () => {
    expect(
      sections(BODY),
      `${DOCUMENT}'s \`##\` headings are not the format's eight, in its order`,
    ).toEqual([...CANONICAL_SECTIONS]);
  });

  test("gives every canonical section prose of its own", () => {
    for (const section of CANONICAL_SECTIONS) {
      expect(
        proseOf(BODY, section).length,
        `\`## ${section}\` carries no prose of its own, so a heading is standing in for a section`,
      ).toBeGreaterThan(0);
    }
  });

  test("declares no colour literal in its body, so the frontmatter stays the only declaration", () => {
    const found = hexLiterals(BODY);

    expect(
      found,
      `${DOCUMENT}'s body declares ${found.join(", ")}; a value belongs in the frontmatter and the body names the token`,
    ).toEqual([]);
  });
});

/* ================================================================================================ *
 * 4. THE READERS' OWN SELF-TEST, because a reader that matches nothing reports the absence of the
 *    thing it looked for and reads exactly like a pass.
 * ================================================================================================ */

describe("the readers", () => {
  /** A frontmatter block this reader must accept, so the refusal cases below are about one defect. */
  const VALID = [
    "---",
    "name: SpectreMail",
    'description: "One sentence."',
    "colors:",
    '  surface-page: "#f4f4f2"',
    "typography:",
    "  body:",
    '    fontSize: "1rem"',
    "    lineHeight: 1.65",
    "rounded:",
    '  radius-sm: "2px"',
    "spacing:",
    '  space-0: "0"',
    "---",
    "",
    "# Design System: SpectreMail",
    "",
  ].join("\n");

  test("reads a valid block into its three shapes, and keeps a number as its own text", () => {
    const parsed = parseFrontmatter(VALID);

    expect(parsed.scalars.get("name")).toBe("SpectreMail");
    expect(parsed.tables.get("rounded")?.get("radius-sm")).toBe("2px");
    expect(
      parsed.tables.get("spacing")?.get("space-0"),
      "a bare `0` was read as absent rather than as the text `0`",
    ).toBe("0");
    expect(
      parsed.nested.get("typography")?.get("body")?.get("lineHeight"),
      "a bare number was not compared as its own text, which is what the token layer declares",
    ).toBe("1.65");
    expect(parsed.nested.get("typography")?.get("body")?.get("fontSize")).toBe("1rem");
  });

  const refusals: readonly (readonly [string, string, string])[] = [
    ["no opening fence", VALID.replace("---\nname:", "name:"), "must open with a `---` line"],
    ["no closing fence", VALID.replace("\n---\n\n# Design", "\n\n# Design"), "no closing `---`"],
    [
      "an indent that is not two spaces per level",
      VALID.replace('    fontSize: "1rem"', '   fontSize: "1rem"'),
      "not a whole number of two-space levels",
    ],
    [
      "a key declared twice in one block",
      VALID.replace('  radius-sm: "2px"', '  radius-sm: "2px"\n  radius-sm: "4px"'),
      "declared twice",
    ],
    [
      "an unterminated quoted value",
      VALID.replace('  radius-sm: "2px"', '  radius-sm: "2px'),
      "not terminated",
    ],
    [
      "a tab used as an indent",
      VALID.replace('  radius-sm: "2px"', '\tradius-sm: "2px"'),
      "a tab is not an indent",
    ],
  ];

  for (const [name, text, expected] of refusals) {
    test(`refuses ${name}`, () => {
      expect(
        text,
        `the fixture for "${name}" did not change, so this case would pass against any reader`,
      ).not.toBe(VALID);
      expect(() => parseFrontmatter(text)).toThrow(expected);
    });
  }

  test("sees a level-three heading as a subsection and never as a canonical section", () => {
    const body = "## Overview\n\nprose\n\n### Primary\n\nmore prose\n\n## Colors\n";
    const found = sections(body);

    expect(found).toEqual(["Overview", "Colors"]);
    expect(
      found,
      "a `###` heading was read as a section, so a document could satisfy the canonical order with subsections",
    ).not.toContain("Primary");
  });

  test("reports a planted hex literal and not a heading, and strips a subheading from prose", () => {
    const body = "## Colors\n\n### Primary\n\nThe accent is #5a3fd0 here.\n\n## Shapes\n";

    expect(hexLiterals(body), "a hex literal in the body was not reported").toEqual(["#5a3fd0"]);
    expect(hexLiterals("## Colors\n\n### Primary\n"), "a heading was reported as a colour").toEqual(
      [],
    );
    expect(
      hexLiterals("#12345 and #0000000 are not literals this rule claims"),
      "a five- or seven-digit run was reported as a colour, which is a rule that fires on the wrong thing",
    ).toEqual([]);
    expect(
      proseOf(body, "Colors"),
      "a section's own subheading was counted as its prose, so a heading could stand in for a section",
    ).toBe("The accent is #5a3fd0 here.");
  });
});
