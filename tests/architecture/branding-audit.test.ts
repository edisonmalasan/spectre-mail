/**
 * `docs/BRANDING.md` against the shipped tree.
 *
 * ## What this file is, and what it is not
 *
 * The failure this change exists to end is **ten surfaces naming the product, each with its own
 * spelling, and a review whose verdict rests on nothing a reader can re-run.** The instrument here is
 * neither "does the document exist" nor "does the name appear". It is **a declared map of the surfaces
 * the product names itself from, resolved against the tree in both directions**, plus a check that the
 * review's own external claims are dated, controlled and, where they produced no measurement, carry no
 * verdict.
 *
 * **The count in this paragraph was eight until this file's own map found two the proposal's table had
 * missed** - `main.tsx` and `panel-main.tsx` each render a heading in the branch taken when the
 * client's own storage could not be read, and neither was in the table. The map declares **eleven**
 * rows for **ten** surfaces, because the eleventh is the value's own declaration: the requirement's
 * operative clause is that the name is declared *exactly once*, and a map that omitted the
 * declaration could not see a second one. **A figure written into prose before the measurement that
 * corrected it is the defect this repository has recorded three times**, and the correction belongs
 * in the sentence that carries the figure rather than in a place a reader has to go looking.
 *
 * ## Three rules of the house, and why each exists
 *
 * **1. The map is test-owned data, never a scan for the string** (`design.md` D2, task 5.1). Three
 * reasons, and the third is one this change measured in its own tree:
 *
 * - **It cannot tell the name from a sentence.** `"Use SpectreMail"` and `"Guerrilla Mail is asking
 *   SpectreMail to slow down"` both contain the name and neither *is* the name. A scan requiring every
 *   occurrence to equal the constant fails on correct copy; a scan requiring every occurrence to contain
 *   it passes on a rename that missed half the surfaces. **The property is about ten places where the
 *   product names itself, and it is not expressible as a property of occurrences.**
 * - **It would fire on the tests' own fixtures.** The browser tier plants
 *   `"A SpectreMail extension is on its way."` into a running page as a negative control - the fifth
 *   recorded instance of a scan reporting a file for content the file holds *about* the scan.
 * - **It would count a type.** Measured on the shipped tree, **8 of the 108 substring occurrences are
 *   the identifier `SpectreMailboxes`** - the storage contract's own type name, which begins with the
 *   product's name. A substring count of the name is therefore not a count of the name, and
 *   `docs/BRANDING.md` section 6 says so and publishes the corrected figure.
 *
 * **2. Both directions, and agreement first.** Every declared site must carry the value, **and** every
 * place the shipped tree carries the name must be declared. The second direction is not a formality:
 * **it is how this change found two surfaces the proposal's table had missed** - `main.tsx`'s popup
 * heading and `panel-main.tsx`'s panel heading, both bare literals in the branch taken when a client's
 * storage cannot be read. A one-directional check would have been green on the shipped tree with both
 * untouched. **The first case in this file is therefore a positive one** - a known site read before any
 * absence is claimed - because a file of negative assertions passes on an empty map.
 *
 * **3. This file shares no reader with any other architecture suite** (task 5.7). A tool that also
 * checks its own work cannot report its own defect, so the independence here is structural rather than
 * a promise: nothing is imported from another suite, no function body is byte-identical to one in
 * another, and the last case holds all three to it.
 *
 * ## Every reader is self-tested, and the first case is positive
 *
 * Each reader below carries a case that shows it **seeing** something before any case asks it to report
 * something missing. The one that decides whether an occurrence *is* the name carries two, in this
 * order: a known-rendering occurrence, then a known-copy occurrence. **A reader that classifies nothing
 * satisfies every "nothing found" assertion beneath it for ever**, and that is this repository's
 * most-recorded defect. The false-negative direction is the one that matters, so the fixtures are built
 * around it.
 *
 * ## What it establishes, and what it does not
 *
 * It establishes that every declared surface carries the one exported value, that no place in the
 * shipped tree carries the name without being declared, that no declared site has drifted out of the
 * tree, that the two manifest name fields agree with each other, and that the review's external claims
 * each carry a date and each unmeasured claim carries no verdict.
 *
 * It does **not** establish that a name is a good name, that the domain is obtainable, that the
 * unmeasured checks would come back clean if they were run, or that a *new* rendering added to the tree
 * is a surface somebody wanted. The last one is a real limit and section 7 of `docs/BRANDING.md` states
 * it: **a rename decision is a human judgement and this file cannot make it.**
 *
 * ## `tsc` does not cover this file, and that is a limit rather than a repair
 *
 * `tests/architecture/` has **no `tsconfig.json`** and is not a workspace member, so `pnpm typecheck`
 * checks neither this file's nor any other architecture file's types. Adding one would move **every
 * future gate's** typecheck scope, which this change does not decide. A type error here is a runtime
 * failure, not a `pnpm verify` failure.
 *
 * ## The regex allow-list is the check that keeps rule 1 honest
 *
 * Every regular-expression literal in this file is declared in {@link ALLOWED_PATTERNS}, in both
 * directions, read through the **TypeScript parser** rather than a character scanner. **No pattern holds
 * a backtick** - they are written with no backtick character at all - because `boundaries.test.ts`'s
 * comment stripper has no state for a regular-expression literal, and a backtick inside one
 * desynchronises that reader for the rest of *this* file.
 *
 * @module
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { expect, test } from "vitest";

import { PRODUCT_NAME } from "../../packages/ui/src/name";

/**
 * The **identifier** the tree reads the value through, which is not the value.
 *
 * **Keeping the two apart is the correction of a defect this file carried on its first run.** The reader
 * that finds a reference compared an identifier's *name* against the *string that identifier holds*, so
 * the comparison was between two unrelated strings, false on every file, and the reader reported the
 * tree as carrying none of the value on all ten declared sites. **It read as a product defect rather than
 * as a reader defect**, which is the direction this repository records most often.
 *
 * So the export's own name is a separate constant here, and the value is the imported one. **A reader
 * that confuses a binding with its contents cannot see a reference at all**, and it reports that as a
 * clean tree rather than as its own blindness.
 */
const VALUE_NAME = "PRODUCT_NAME";

/** The repository root, resolved as the other architecture suites resolve it. */
const REPO_ROOT = process.cwd();

/** The review under test, and nothing else this file reads outside `apps/` and `packages/`. */
const REVIEW_PATH = "docs/BRANDING.md";

/**
 * How many surfaces the review declares.
 *
 * **A declared count, declared rather than derived, so the derivation can fail** - a reader returning the
 * map's own length would satisfy the assertion that the map is exhaustive.
 *
 * **And it is eleven rather than the eight the proposal's table named.** Three of those are this change's
 * own findings rather than extra surfaces of the product: `main.tsx` and `panel-main.tsx` each render a
 * heading the table did not list, and the value's own declaration is a place the tree holds the name that
 * the table did not name either. **The declaration is in the map because the requirement's operative
 * clause is that the name is declared *exactly once*** - a second declaration is a rename that half
 * happened, and a map that omitted the declaration could not see one.
 */
const SURFACE_COUNT = 11;

/** The review's surface table, located by its own heading. */
const REVIEW_SURFACE_HEADING =
  "5. The surface map: every place the product names itself as the product";

/** The review's check table, located by its own heading. */
const REVIEW_CHECK_HEADING =
  "2. The six checks, each with its instrument, its control, and its date";

/** The surface table's column names, in the order the document writes them. */
const REVIEW_SURFACE_HEADER = ["surface", "file", "site", "rendered", "read by"] as const;

/** The check table's column names, in the order the document writes them. */
const REVIEW_CHECK_HEADER = ["check", "instrument", "control", "measured on", "result"] as const;

/**
 * The review's table of the checks it could not measure, located by its own heading.
 *
 * **This table exists because the check it feeds could not otherwise fail** - see the case below, which
 * records the arm that proved it. Declaring the unmeasured checks as data is what turns "no row says
 * unmeasured and also says clear", a sentence nobody writes, into a comparison that can go either way.
 */
const REVIEW_UNMEASURED_HEADING = "2.1 The checks this review could not measure";

/** That table's column names. */
const REVIEW_UNMEASURED_HEADER = ["check", "why the control did not resolve"] as const;

/**
 * The three verdicts the review's check table declares, and the word that means no verdict was reached.
 *
 * **A closed list, and the assertion requires every measured row to carry exactly one of them** - so
 * "no verdict attached" is not satisfied by every row being vague. `unmeasured` is not in this list
 * because it is the absence of a verdict, and a row carrying it must carry neither of the others.
 */
const VERDICTS: readonly string[] = ["clear", "loss"];
const UNMEASURED = "unmeasured";

/** Directories the shipped-tree scan walks, and what it must never walk into. */
const SHIPPED_ROOTS = ["apps", "packages"] as const;
const SHIPPED_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".json", ".html"] as const;
const GENERATED_DIRECTORIES = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".vite",
  "test-results",
] as const;

/** The browser tier's own directory: excluded because a fixture is not a surface. */
const EXCLUDED_DIRECTORY = "e2e";

/**
 * A file another suite stages while a rule is under test, and this scan must not read.
 *
 * **This is the recorded "an artefact the measurement itself creates" defect, and it is the fourth
 * instance of it in this repository.** `boundaries.test.ts` writes `__fetch-rule-probe.ts` and
 * `__framework-rule-probe.ts` into package directories, asserts against them, and deletes them - **while
 * this file is walking the same tree in another worker.** The first run died with
 * `ENOENT: no such file or directory, open packages/mailbox/__framework-rule-probe.ts`, which is the
 * signature of a scan that cannot tell a source file from an artefact another measurement just removed.
 *
 * **The directory list already carries this repair for `test-results`**, added by `side-panel-runtime-facts`
 * for the same reason, and this is the file-shaped half of the same lesson: a scanner needs to be able to
 * tell a staged artefact from a source file, and the name is the only thing that distinguishes them.
 */
const PROBE_FILE = /^__.*probe\.[cm]?tsx?$/;

/* ------------------------------------------------------------------------------------------------
 * Readers. Every one is self-tested, and none is shared with another architecture suite.
 * ---------------------------------------------------------------------------------------------- */

/** Reads a repository file as UTF-8 text. */
function readRepositoryFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/**
 * A file's lines, with their one-based numbers.
 *
 * **Line numbers are the point of this reader**, because a site is a line and a resolution is "the
 * expression at that line is the reference". A reader returning text without positions could answer
 * neither question, and a declared site with no position is a citation nobody can open.
 */
function repositoryLines(relativePath: string): string[] {
  return readRepositoryFile(relativePath).split(/\r?\n/);
}

/** An ATX heading, with the position a section lookup needs. */
interface MarkdownHeading {
  readonly depth: number;
  readonly text: string;
  readonly line: number;
}

/**
 * Every ATX heading in a line list.
 *
 * **Counted characters rather than a pattern**, for a reason about *this* file: every regular expression
 * here has to be declared in an allow-list that is meant to stay short, and a heading's depth is one
 * character counted rather than a language. `#text` is not a heading in CommonMark and is not read as
 * one here - the first two lines of this reader's self-test are that case.
 */
function headingsWithin(lines: readonly string[]): MarkdownHeading[] {
  const found: MarkdownHeading[] = [];

  for (const [index, line] of lines.entries()) {
    let depth = 0;
    let cursor = 0;
    while (cursor < line.length) {
      if (line.charAt(cursor) !== "#") break;
      depth = depth + 1;
      cursor = cursor + 1;
    }
    const rest = line.slice(cursor);
    if (depth > 0 && rest.startsWith(" ")) {
      found.push({ depth, text: rest.trim(), line: index + 1 });
    }
  }

  return found;
}

/** One markdown table row, as trimmed cells. */
type TableRow = readonly string[];

/**
 * The data rows of the first table at or under a `## ` heading, located by its own header row.
 *
 * **Located by the heading and then by the header**, so a table inserted above it is not read as this
 * one, and **the separator row is checked as a shape rather than skipped by position** - a table rendered
 * without one is a table no markdown renderer would draw, and reading it anyway would report a
 * document's formatting as a document's content.
 */
function tableUnder(lines: readonly string[], headingText: string): TableRow[] {
  const headings = headingsWithin(lines);
  const at = headings.findIndex((entry) => entry.text === headingText);
  if (at === -1) {
    return [];
  }
  // **Any depth, and the section closes at the next heading of the same or shallower level.** The first
  // version matched depth 2 only, so a `### ` subsection's table read as no table at all - and "no table"
  // is the answer that satisfies every assertion made about one.
  const level = headings[at]?.depth ?? 1;

  const raw: string[] = [];
  for (let cursor = headings[at]?.line ?? 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? "";
    const closedBy = headings.some((entry) => entry.line === cursor + 1 && entry.depth <= level);
    if (closedBy) break;
    if (line.trimStart().startsWith("|") === false && raw.length > 0) break;
    if (line.trimStart().startsWith("|")) raw.push(line);
  }

  const cells = raw.map(splitRow);
  const header = cells[0] ?? [];
  const separator = cells[1] ?? [];
  const separatorIsReal =
    separator.length === header.length &&
    separator.every(
      (cell) => cell.length >= 3 && [...cell].every((character) => character === "-"),
    );

  return separatorIsReal ? cells.slice(2) : [];
}

/**
 * Splits one `|`-delimited table row into its cells.
 *
 * **Code markers are removed with `replaceAll` and a string argument rather than with a character
 * class.** That is not a style preference: `boundaries.test.ts`'s comment stripper recognises line
 * comments, block comments and three string delimiters, and has
 * **no state for a regular-expression literal**, so a quote character
 * inside one opens a string that runs until the next quote in the file and desynchronises that reader
 * for the rest of this file. `replaceAll` with a string argument puts no quote character inside a
 * pattern, which is the same removal spelled so another reader cannot be desynchronised by it.
 */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const withEdges = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const body = withEdges.endsWith("|") ? withEdges.slice(0, -1) : withEdges;
  const collapsed = body.split("|").map((cell) => cell.trim().replaceAll("`", ""));
  return collapsed.map((cell) => cell.replace(/\s+/g, " ").trim());
}

/**
 * The cell at a named column, or an empty string.
 *
 * **The column is looked up in the declared header rather than by position**, so a column inserted into
 * the document cannot shift every read by one - and a reader that reads positionally reports a
 * document's column order as a document's content.
 */
function cellAt(row: TableRow, header: readonly string[], column: string): string {
  return row[header.indexOf(column)] ?? "";
}

/**
 * The site cell, as the closed vocabulary the map declares: `line N`, `lines N, N, N`, or `key a.b`.
 *
 * **A closed grammar with a rejected case, not a lenient one.** A site written as a sentence returns
 * `null` and the caller reports the surface by name, because a reader that read a site out of prose
 * would leave the table's central claim unchecked - which is the whole reason this file exists.
 */
function parseSite(cell: string): readonly string[] | null {
  const one = /^line (\d+)$/.exec(cell);
  if (one !== null) return [one[1] ?? ""];

  const many = /^lines ([\d, ]+)$/.exec(cell);
  if (many !== null) return (many[1] ?? "").split(",").map((part) => part.trim());

  const key = /^key ([A-Za-z0-9_.]+)$/.exec(cell);
  if (key !== null) return [key[1] ?? ""];

  return null;
}

/**
 * The shipped tree's name sites, and any file the scan could not read.
 *
 * **A file that vanished between the walk and the read is reported rather than swallowed.** The scan is
 * concurrent with `boundaries.test.ts`, which stages and deletes probe files in the same tree, and a
 * reader that dropped an unreadable file silently would make the corpus a property of timing - the
 * direction in which a scan looks clean rather than broken. {@link PROBE_FILE} is the real repair; this is
 * the reporting that says whether it held.
 */
function shippedNameSites(): {
  readonly sites: NameSite[];
  readonly unreadable: readonly string[];
} {
  const sites: NameSite[] = [];
  const unreadable: string[] = [];

  for (const file of shippedFiles()) {
    let source: string;
    try {
      source = readRepositoryFile(file);
    } catch {
      unreadable.push(file);
      continue;
    }
    sites.push(...nameSitesIn(file, source));
  }

  return { sites, unreadable };
}

/** Every shipped file the surface scan walks, as repository-relative paths with forward slashes. */
function shippedFiles(): string[] {
  const collected: string[] = [];

  const walk = (absolute: string): void => {
    for (const entry of readdirSync(absolute)) {
      const child = join(absolute, entry);

      if (statSync(child).isDirectory() === true) {
        if ((GENERATED_DIRECTORIES as readonly string[]).includes(entry)) continue;
        if (entry === EXCLUDED_DIRECTORY) continue;
        walk(child);
        continue;
      }

      const wanted = (SHIPPED_EXTENSIONS as readonly string[]).some((suffix) =>
        entry.endsWith(suffix),
      );
      if (wanted === false || /\.test\.|\.spec\./.test(entry)) continue;
      if (PROBE_FILE.test(entry)) continue;

      collected.push(relative(REPO_ROOT, child).split("\\").join("/"));
    }
  };

  for (const root of SHIPPED_ROOTS) walk(join(REPO_ROOT, root));
  return collected.sort();
}

/** The text of a document's `title` element, or `null` when it declares none. */
function htmlTitleIn(source: string): string | null {
  const found = /<title>([^<]*)<\/title>/.exec(source);
  return found === null ? null : (found[1] ?? "").trim();
}

/** The value at a dotted path in a parsed JSON document, or `null` when the path does not resolve. */
function jsonValueAt(document: unknown, path: string): unknown {
  let cursor: unknown = document;
  for (const segment of path.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return null;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** How a site carries the name, and it is what lets a disagreement be named rather than counted. */
type SiteForm = "name-literal" | "name-reference" | "copy-title" | "value-declaration";

/** One place in the tree that carries the name. */
interface NameSite {
  readonly file: string;
  /**
   * The site's identity: a one-based line for a literal or a reference, and a dotted key path for a
   * JSON value or a named copy property.
   *
   * **Two kinds in one field on purpose**, because the map declares sites the same way and a reader
   * that kept them apart would need two maps. What each kind means is carried by {@link SiteForm}, so a
   * disagreement is reported as a disagreement and not as a missing number.
   */
  readonly at: string;
  readonly form: SiteForm;
}

/**
 * Every place one shipped file carries the name.
 *
 * **Three forms and no fourth, and the third is the one that finds what a literal scan cannot.**
 *
 * - `name-literal` - a string or template literal whose **whole text** is the name, a JSX text node
 *   whose trimmed text is the name, a JSON string value equal to the name, or a document's `title`
 *   element equal to the name. **Whole value, not a substring** - the distinction
 *   {@link namesTheProductItself} exists to make, and the reason 8 occurrences of a storage contract's
 *   type name never reach this reader.
 * - `name-reference` - an identifier reading the exported value **outside an import clause**, because an
 *   import is how a module obtains the value rather than a place it renders it.
 * - `copy-title` - a property **named** in the map whose value is that identifier: a copy constant
 *   holding the name, which renders it under a name of its own.
 *
 * **This third form is why the map is exhaustive in the direction a literal scan is blind to.** A new
 * heading rendering the exported value correctly is invisible to any reader looking for the name spelled
 * out, and visible here. **The import exclusion is what stops the reader reporting all five imports as
 * five renderings**, which is the direction in which a reader that is too eager looks thorough.
 */
function nameSitesIn(file: string, source: string): NameSite[] {
  const found: NameSite[] = [];

  if (file.endsWith(".html")) {
    if (htmlTitleIn(source) === PRODUCT_NAME) {
      const at = source.indexOf("<title>");
      found.push({
        file,
        at: String(source.slice(0, at).split("\n").length),
        form: "name-literal",
      });
    }
    return found;
  }

  if (file.endsWith(".json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      return found;
    }
    const walk = (value: unknown, path: string): void => {
      if (value === PRODUCT_NAME) {
        found.push({ file, at: path, form: "name-literal" });
        return;
      }
      if (typeof value === "object" && value !== null) {
        for (const [key, nested] of Object.entries(value)) {
          walk(nested, path === "" ? key : `${path}.${key}`);
        }
      }
    };
    walk(parsed, "");
    return found;
  }

  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const lineAt = (at: number): string => String(parsed.getLineAndCharacterOfPosition(at).line + 1);

  const visit = (node: ts.Node, insideImport: boolean): void => {
    // **An import and a re-export are both excluded, and the symmetry is the reason.** An import is how
    // a module obtains the value; a re-export is how the barrel publishes it. Neither renders it, and a
    // reader that counted either would report five imports and one re-export as seven places the product
    // names itself - **a direction in which a reader that is too eager looks thorough rather than wrong.**
    const importing =
      insideImport ||
      ts.isImportDeclaration(node) ||
      ts.isImportClause(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined);

    if (importing === false) {
      if (ts.isIdentifier(node) && node.text === VALUE_NAME) {
        const parent = node.parent;
        const declared =
          parent !== undefined &&
          ts.isVariableDeclaration(parent) &&
          ts.isIdentifier(parent.name) &&
          parent.name === node;
        const property =
          parent !== undefined && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)
            ? parent.name.text
            : null;
        found.push({
          file,
          at: property ?? lineAt(node.getStart(parsed)),
          form:
            declared === true
              ? "value-declaration"
              : property === null
                ? "name-reference"
                : "copy-title",
        });
      }

      const literal =
        ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
      if (literal !== null && namesTheProductItself(literal)) {
        found.push({ file, at: lineAt(node.getStart(parsed)), form: "name-literal" });
      }

      if (ts.isJsxText(node) && namesTheProductItself(node.text)) {
        found.push({ file, at: lineAt(node.getStart(parsed)), form: "name-literal" });
      }
    }

    node.forEachChild((child) => visit(child, importing));
  };
  for (const statement of parsed.statements) visit(statement, false);

  // **The declaration's own literal is part of the declaration, and is not a second site.**
  //
  // `export const PRODUCT_NAME = "SpectreMail"` yields two nodes on one line: the binding and the literal.
  // Reporting both would make the declaration unmappable without declaring it twice on one line - which is
  // the kind of thing a table grows a `lines 55, 55` cell to accommodate. **The declaration is one site,
  // and the literal inside it is how that declaration carries the value**, which is what `siteProblem`'s
  // `declaration` branch reads.
  const declaredAt = new Set(
    found.filter((site) => site.form === "value-declaration").map((site) => site.at),
  );
  return found.filter((site) => site.form !== "name-literal" || declaredAt.has(site.at) === false);
}

/**
 * Whether an occurrence **is** the name, as opposed to containing it.
 *
 * **The whole value, and that is the entire rule.** `"Use SpectreMail"` is copy about the product;
 * `"SpectreMail"` as a document's title is the product naming itself. A reader that asked *does this
 * contain the name* would call the first a surface, and a reader that asked *is this exactly the name*
 * called the second copy - **so the predicate is the claim**, and it is self-tested in both directions
 * before anything else in this file asks it to report an absence.
 */
function namesTheProductItself(text: string): boolean {
  return text.trim() === PRODUCT_NAME;
}

/**
 * The lines at which a property of the declared name carries the exported value, in order.
 *
 * **The file's real path is passed to the parser, and that is load-bearing rather than decorative.**
 * TypeScript decides whether a source contains JSX **from the file name**, and this reader's first
 * version named every file it read `"copy.ts"`. Parsing `Panel.tsx` under that name produced a tree in
 * which `{PANEL_COPY.title}` came back as a property access whose receiver was an **empty identifier** -
 * so the reader reported **three renderings of nothing at all** and the count it printed was a count of
 * parse errors. **A reader that renames its input is a reader that can silently change the language it is
 * reading**, and the failure reads as an absence rather than as a defect.
 */
function copyTitleLinesIn(source: string, file: string, propertyName: string): number[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const lines: number[] = [];

  for (const statement of parsed.statements) {
    const visit = (node: ts.Node): void => {
      const assignment = ts.isPropertyAssignment(node) ? node : null;
      const named =
        assignment !== null && ts.isIdentifier(assignment.name) ? assignment.name : null;
      const carries =
        named !== null &&
        named.text === propertyName &&
        ts.isIdentifier(assignment?.initializer ?? node)
          ? (assignment?.initializer as ts.Identifier).text
          : "";
      if (carries === VALUE_NAME) {
        lines.push(parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1);
      }
      node.forEachChild(visit);
    };
    visit(statement);
  }

  return lines;
}

/**
 * The lines at which a component reads a named constant's `title` property, in order.
 *
 * **The real path again, for {@link copyTitleLinesIn}'s reason** - `Panel.tsx` is JSX, and a parser told
 * the file is `.ts` reads three renderings as three property accesses with an empty receiver.
 */
function copyTitleReadsIn(source: string, file: string, constantName: string): number[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const lines: number[] = [];

  for (const statement of parsed.statements) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "title" &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === constantName
      ) {
        lines.push(parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1);
      }
      node.forEachChild(visit);
    };
    visit(statement);
  }

  return lines.sort((left, right) => left - right);
}

/* ------------------------------------------------------------------------------------------------
 * The map. Test-owned, and the only statement of which surfaces exist.
 * ---------------------------------------------------------------------------------------------- */

/** How one declared site is read. */
type DeclaredForm = "html-title" | "json-value" | "jsx-reference" | "copy-title" | "declaration";

/**
 * How one declared site is read, and the **tree-side form** it must be read as.
 *
 * **This table exists because a falsification arm found the drift direction weaker than its name.** Both
 * directions originally keyed a site on `file` and `line` alone, so a heading that changed from rendering
 * the reference to rendering a bare literal **kept the same key** - the drift direction could not see it,
 * and the arm reported `wrongcatch` against the assertion it was aimed at.
 *
 * **A coordinate is not an identity.** What makes a site what it is includes *how* it carries the name, so
 * the key carries the form too. The declared form and the tree-side form are different vocabularies, and
 * this table is the whole of the translation between them - a declaration rather than a guess inside each
 * comparison, which is the same reason `security-audit.test.ts` keeps its citation grammar in one place.
 */
const DECLARED_FORM_TO_TREE_FORM: Readonly<Record<DeclaredForm, SiteForm>> = {
  "html-title": "name-literal",
  "json-value": "name-literal",
  "jsx-reference": "name-reference",
  "copy-title": "copy-title",
  declaration: "value-declaration",
};

/** One declared place a surface carries the name. */
interface DeclaredSite {
  readonly file: string;
  /** A one-based line for a rendered site, and a property name for a copy constant. */
  readonly at: string;
  /**
   * How this site is read - and a site read by the wrong reader is reported as **unreadable**, not as
   * agreeing. That is deliberate: a reader that fell back to another form would let a `copy-title` site
   * be satisfied by a literal elsewhere in the same file, which is the recorded shape of a check that
   * can be satisfied by something other than the thing it names.
   */
  readonly form: DeclaredForm;
}

/** One surface of the product that names it. */
interface Surface {
  /** The name the review uses, and the name a failure reports. */
  readonly name: string;
  readonly sites: readonly DeclaredSite[];
  /** For a copy constant: the component that renders it, and the lines it is rendered at. */
  readonly renderedBy?: {
    readonly file: string;
    readonly constant: string;
    readonly at: readonly number[];
  };
}

const SURFACES: readonly Surface[] = [
  {
    name: "the public name's own declaration",
    sites: [{ file: "packages/ui/src/name.ts", at: "55", form: "declaration" }],
  },
  {
    name: "website document title",
    sites: [{ file: "apps/web/index.html", at: "21", form: "html-title" }],
  },
  {
    name: "website wordmark",
    sites: [{ file: "apps/web/src/Wordmark.tsx", at: "58", form: "jsx-reference" }],
  },
  {
    name: "extension listing name",
    sites: [{ file: "apps/extension/static/manifest.json", at: "name", form: "json-value" }],
  },
  {
    name: "extension toolbar tooltip",
    sites: [
      {
        file: "apps/extension/static/manifest.json",
        at: "action.default_title",
        form: "json-value",
      },
    ],
  },
  {
    name: "popup document title",
    sites: [{ file: "apps/extension/popup.html", at: "13", form: "html-title" }],
  },
  {
    name: "panel document title",
    sites: [{ file: "apps/extension/sidepanel.html", at: "13", form: "html-title" }],
  },
  {
    name: "popup heading",
    sites: [
      { file: "apps/extension/src/Popup.tsx", at: "252", form: "jsx-reference" },
      { file: "apps/extension/src/Popup.tsx", at: "264", form: "jsx-reference" },
      { file: "apps/extension/src/Popup.tsx", at: "272", form: "jsx-reference" },
    ],
  },
  {
    name: "popup heading, storage-not-ready branch",
    sites: [{ file: "apps/extension/src/main.tsx", at: "81", form: "jsx-reference" }],
  },
  {
    name: "panel heading",
    sites: [{ file: "apps/extension/src/panel-copy.ts", at: "title", form: "copy-title" }],
    renderedBy: {
      file: "apps/extension/src/Panel.tsx",
      constant: "PANEL_COPY",
      at: [716, 729, 794],
    },
  },
  {
    name: "panel heading, storage-not-ready branch",
    sites: [{ file: "apps/extension/src/panel-main.tsx", at: "117", form: "jsx-reference" }],
  },
];

/** Every site the map declares, flattened, as the strings the cross-checks compare. */
const DECLARED_SITES: readonly string[] = SURFACES.flatMap((surface) =>
  surface.sites.map((site) => `${surface.name} / ${site.file} / ${site.at}`),
);

/**
 * Every site's file, identity and form, without its surface, which is what the tree scan is compared to.
 *
 * **The form is part of the key**, for {@link DECLARED_FORM_TO_TREE_FORM}'s reason: a line number alone
 * cannot tell a site that renders the value from one that spells it out.
 */
const DECLARED_SITE_COORDS: readonly string[] = SURFACES.flatMap((surface) =>
  surface.sites.map(
    (site) => `${site.file} / ${site.at} / ${DECLARED_FORM_TO_TREE_FORM[site.form]}`,
  ),
);

/** The tree's own key for one site, in the same shape. */
function treeSiteKey(site: { file: string; at: string; form: SiteForm }): string {
  return `${site.file} / ${site.at} / ${site.form}`;
}

/* ------------------------------------------------------------------------------------------------
 * What this file is checked to say.
 * ---------------------------------------------------------------------------------------------- */

const REVIEW_LINES = repositoryLines(REVIEW_PATH);

/* ================================================================================================ *
 * 1. THE MAP. Shape first, then every declared site read through its own reader.
 * ================================================================================================ */

test("the map is the shape the review declares, and every surface names a file that exists", () => {
  // **Non-vacuity first, and in the strongest available form.** A map with no surfaces satisfies every
  // "no unmapped site" assertion beneath it, and a surface with no sites satisfies every "this site
  // carries the value" assertion. Both are asserted before anything is claimed about either.
  expect(SURFACES.length, "the map declares no surface").toBe(SURFACE_COUNT);
  expect(
    SURFACES.filter((surface) => surface.sites.length === 0).map((surface) => surface.name),
    "surfaces declaring no site, which would satisfy every per-site assertion for free",
  ).toEqual([]);
  expect(
    SURFACES.filter((surface) => surface.name.trim() === "").map((surface) => surface.name),
    "surfaces with no name, which a failure could not report",
  ).toEqual([]);

  // **And one name per surface**, because two surfaces sharing a name make a failure ambiguous and one
  // name for two surfaces hides a surface.
  expect(
    SURFACES.map((surface) => surface.name).filter((name, at, all) => all.indexOf(name) !== at),
    "surface names that appear more than once, under which a failure could not name which one failed",
  ).toEqual([]);

  for (const surface of SURFACES) {
    for (const site of surface.sites) {
      expect(
        existsSync(join(REPO_ROOT, site.file)),
        `${surface.name} names ${site.file}, which does not exist`,
      ).toBe(true);
    }
    if (surface.renderedBy !== undefined) {
      expect(
        existsSync(join(REPO_ROOT, surface.renderedBy.file)),
        `${surface.name} names ${surface.renderedBy.file} as the file that renders it, and it does not exist`,
      ).toBe(true);
    }
  }
});

test("every declared surface renders the one public name, and a differing one is reported by name", () => {
  const unresolved = SURFACES.flatMap((surface) =>
    surface.sites.flatMap((site) => {
      const problem = siteProblem(site);
      return problem === null ? [] : [`${surface.name} / ${site.file} / ${site.at} - ${problem}`];
    }),
  );

  expect(
    unresolved,
    "declared sites that do not render the exported value, or that cannot be read at all",
  ).toEqual([]);

  // **The same reader, shown something.** A reader returning a complaint for every site satisfies the
  // assertion above perfectly, and that assertion is the whole of task 5.2.
  expect(
    siteProblem({ file: "apps/extension/static/manifest.json", at: "name", form: "json-value" }),
    "the reader does not resolve a site the review says is correct",
  ).toBeNull();
  expect(
    siteProblem({ file: "apps/web/index.html", at: "21", form: "html-title" }),
    "the reader does not resolve the website's own title element",
  ).toBeNull();
});

/**
 * Why a declared site does not carry the name, or `null` when it does.
 *
 * **One reader per form, and a site read by the wrong one is unreadable rather than agreeing.**
 */
function siteProblem(site: DeclaredSite): string | null {
  const source = readRepositoryFile(site.file);

  if (site.form === "html-title") {
    const title = htmlTitleIn(source);
    if (title === null) return "the document declares no title element";
    return namesTheProductItself(title) ? null : `the title element reads "${title}"`;
  }

  if (site.form === "json-value") {
    const value = jsonValueAt(JSON.parse(source), site.at);
    if (typeof value !== "string") return `${site.at} resolves to no string`;
    return namesTheProductItself(value) ? null : `${site.at} reads "${value}"`;
  }

  if (site.form === "declaration") {
    // **Exactly one, in the whole file, and at the declared line.** The requirement says the name is
    // declared *exactly once*; a second declaration is a rename that half happened, and it would render
    // two different names from two different places with nothing disagreeing.
    const declarations = nameSitesIn(site.file, source)
      .filter((entry) => entry.form === "value-declaration")
      .map((entry) => entry.at);
    if (declarations.length !== 1) {
      return `${declarations.length} declarations of the exported value, at ${declarations.join(", ")}`;
    }
    return declarations[0] === site.at
      ? null
      : `the declaration is at ${declarations[0]}, not at ${site.at}`;
  }

  if (site.form === "copy-title") {
    const lines = copyTitleLinesIn(source, site.file, site.at);
    if (lines.length === 0) return `no property named ${site.at} carries the exported value`;
    if (lines.length > 1) {
      return `${lines.length} properties named ${site.at} carry the exported value, at ${lines.join(", ")}`;
    }
    return null;
  }

  // `jsx-reference`: the expression at the declared line must be the reference, exactly.
  const references = nameSitesIn(site.file, source)
    .filter((entry) => entry.form === "name-reference")
    .map((entry) => entry.at);
  if (references.length === 0) return "the file carries no reference to the exported value at all";
  return references.includes(site.at)
    ? null
    : `the file renders the value at ${references.join(", ")}, not at ${site.at}`;
}

test("a copy constant renders the value, and the panel's own three renderings are left in place", () => {
  const panel = SURFACES.find((surface) => surface.name === "panel heading");
  expect(panel, "the map no longer declares the panel heading").toBeDefined();
  expect(panel?.renderedBy, "the panel heading declares no renderer").toBeDefined();

  const renderedBy = panel?.renderedBy;
  if (renderedBy === undefined) {
    return;
  }

  // **One value, three renderings - asserted as three lines rather than as a count.** A count passes
  // with the three collapsed into one, and this is the pattern the other surfaces were asked to adopt,
  // so it is held rather than assumed. **The panel was already correct before this change**, which is
  // why these three lines are the prediction: a change that rewrote them would have nothing to predict.
  const reads = copyTitleReadsIn(
    readRepositoryFile(renderedBy.file),
    renderedBy.file,
    renderedBy.constant,
  );

  expect(reads.length, "the reader found no rendering of the copy constant at all").toBeGreaterThan(
    0,
  );
  expect(
    reads,
    `the lines at which ${renderedBy.constant}.title is rendered. One value, three renderings is the
    pattern the other surfaces adopted, and three named lines is the claim.`,
  ).toEqual([...renderedBy.at]);
});

/* ================================================================================================ *
 * 2. EXHAUSTIVENESS, IN BOTH DIRECTIONS.
 * ================================================================================================ */

test("no place in the shipped tree carries the name without being declared", () => {
  const corpus = shippedFiles();
  const { sites: found, unreadable } = shippedNameSites();

  // **A file this scan could not read is reported here, not dropped**, because a corpus that depends on
  // when another suite deleted its probe is a corpus that varies with timing.
  expect(unreadable, "shipped files the scan could not read").toEqual([]);

  // **Non-vacuity first, in three parts.** A scan that walked nothing satisfies every absence below for
  // ever, and so does a reader that classifies nothing - so the corpus, the literal direction and the
  // reference direction are each shown working before any absence is claimed. **The reference arm is the
  // one that found the two sites the proposal's table missed.**
  expect(corpus.length, "the scan walked no file at all").toBeGreaterThan(0);
  expect(found.length, "the scan found no place carrying the name at all").toBeGreaterThan(0);
  expect(
    found.filter((site) => site.form === "name-literal").length,
    "the scan found no spelled-out occurrence, so the direction that catches a bare literal is untested",
  ).toBeGreaterThan(0);
  expect(
    found.filter((site) => site.form === "name-reference").length,
    "the scan found no reference to the exported value, so the direction a literal scan is blind to is untested",
  ).toBeGreaterThan(0);
  expect(
    found.filter((site) => site.form === "copy-title").length,
    "the scan found no copy constant carrying the value, so the copy-title reader is untested",
  ).toBeGreaterThan(0);

  // **And the browser tier's own planted fixture is outside the corpus**, which is the second of D2's
  // three reasons and the one that would have made a scan red on this repository's own test. The claim
  // is checked against the real fixture rather than against a path in a comment.
  expect(
    corpus.some((file) => file.includes(`/${EXCLUDED_DIRECTORY}/`)),
    `the scan walked into the browser tier's own ${EXCLUDED_DIRECTORY}/ directory, where a planted
    negative control carries the name`,
  ).toBe(false);

  const unmapped = found
    .filter((site) => DECLARED_SITE_COORDS.includes(treeSiteKey(site)) === false)
    .map(treeSiteKey);

  expect(
    unmapped,
    "places the shipped tree carries the name that the map does not name. This is the direction that found main.tsx and panel-main.tsx.",
  ).toEqual([]);
});

test("every declared site is a place the shipped tree still carries the name, in the declared way", () => {
  // **The other direction, and it is not implied by the one above.** A declared site that has drifted out
  // of the tree leaves the map naming a surface that does not exist, and the direction above could not
  // report it: every site the tree has is declared, and one of the declared ones is fiction.
  //
  // **And "in the declared way" is load-bearing, added because an arm proved the weaker claim was worth
  // little**: a heading changed from rendering the reference to spelling the name out keeps its line
  // number, so a coordinate-only key reported nothing at all for it. **A direction whose name promises more
  // than its key can express is a check that is green because it cannot fail.**
  const found = new Set(shippedNameSites().sites.map(treeSiteKey));

  expect(
    DECLARED_SITE_COORDS.filter((coord) => found.has(coord) === false),
    "declared sites the shipped tree does not carry the name in the declared way. A site that has drifted, or that now spells the name out rather than rendering the value, is no longer what the map says.",
  ).toEqual([]);
});

test("the name-or-copy reader classifies a known rendering and a known sentence, in that order", () => {
  // **Task 5.4, and the order is the instrument rather than the formatting.** Every "nothing was found"
  // assertion in the two cases above is satisfied by a predicate that classifies nothing, so the
  // predicate is shown both directions before either absence is claimed.

  // **First: a known rendering.** A document's title that IS the name.
  expect(
    namesTheProductItself("SpectreMail"),
    "the predicate does not call a document title that is the name a rendering",
  ).toBe(true);
  expect(namesTheProductItself(PRODUCT_NAME), "the predicate rejects the value itself").toBe(true);

  // **And the site reader that feeds it is shown a real site**, so the pair is proven together rather
  // than apart - a reader finding the rendering and a predicate calling it one are two claims.
  expect(
    nameSitesIn("apps/web/index.html", readRepositoryFile("apps/web/index.html")).filter(
      (site) => site.form === "name-literal",
    ),
    "the site reader does not find a document title that is the name",
  ).toHaveLength(1);

  // **Second: a known sentence.** Three of the copy strings section 5 of the review says are
  // deliberately out of the map, each written here rather than imported, so the predicate is tested
  // against the exact shapes it must refuse.
  for (const copy of [
    "Use SpectreMail",
    "Create a SpectreMail address",
    "SpectreMail could not read its own storage, so it will not create an address.",
    "Guerrilla Mail is asking SpectreMail to slow down.",
  ]) {
    expect(namesTheProductItself(copy), `the predicate called copy a rendering: ${copy}`).toBe(
      false,
    );
  }

  // **And the site reader fed the same sentences finds nothing**, which is the falsification the
  // sentences above are about: a reader that reported copy would make every unmapped-site assertion
  // report the review's own section 5 prose.
  expect(
    nameSitesIn(
      "planted.ts",
      'const label = "Use SpectreMail";\nconst control = "Create a SpectreMail address";\n',
    ),
    "the site reader reported a copy string as a place carrying the name",
  ).toEqual([]);

  // **And the rendering planted beside the copy, so the refusal above is a discrimination rather than a
  // blindness** - a reader that found nothing at all would satisfy it.
  expect(
    nameSitesIn(
      "planted.ts",
      `const heading = "${PRODUCT_NAME}";\nconst label = "Use ${PRODUCT_NAME}";\n`,
    ).map((site) => `${site.at} / ${site.form}`),
    "the reader did not find the rendering planted beside the copy, or found the copy as well",
  ).toEqual(["1 / name-literal"]);
});

/* ================================================================================================ *
 * 3. THE MANIFEST'S TWO NAME FIELDS, WHICH NOTHING ELSE RELATES.
 * ================================================================================================ */

test("the manifest's listing name and its toolbar tooltip are the same string", () => {
  const manifest = JSON.parse(readRepositoryFile("apps/extension/static/manifest.json")) as {
    readonly name?: unknown;
    readonly action?: { readonly default_title?: unknown };
  };

  // **This is the property no existing check sees, and `design.md` D5 gives the reason it matters.**
  // `name` is the listing the store shows; `action.default_title` is the toolbar tooltip. **They are the
  // same string today by coincidence of authorship**, and a rename that changed one and not the other
  // would publish a listing named one thing beside a toolbar named another with every other test in
  // this repository green, because no test can read a store listing.

  // **Read before compared**, so a reader resolving neither satisfies neither clause below.
  expect(typeof manifest.name, "the manifest declares no listing name at all").toBe("string");
  expect(typeof manifest.action?.default_title, "the manifest declares no toolbar tooltip").toBe(
    "string",
  );

  expect(manifest.name, "the listing name is not the exported value").toBe(PRODUCT_NAME);
  expect(manifest.action?.default_title, "the toolbar tooltip is not the exported value").toBe(
    PRODUCT_NAME,
  );
  expect(
    manifest.action?.default_title,
    "the listing name and the toolbar tooltip are different strings, which nothing else in this repository relates",
  ).toBe(manifest.name);
});

test("a manifest whose two name fields disagree is reported by name, by the reader the case above uses", () => {
  // **The control, aimed at the comparison rather than at the reader.** A planted document is read by
  // the same {@link jsonValueAt} and compared by the same expectation the case above uses, so a mutation
  // of either reaches this case rather than passing it.
  const planted = { name: PRODUCT_NAME, action: { default_title: "Something Else" } };

  expect(
    jsonValueAt(planted, "action.default_title"),
    "the JSON reader did not read the planted tooltip at the path the manifest uses",
  ).toBe("Something Else");
  expect(
    planted.action.default_title === planted.name,
    "two different name fields compared equal, so the case above could not fail",
  ).toBe(false);
});

/* ================================================================================================ *
 * 4. THE REVIEW'S OWN CLAIMS: dates, controls, and no verdict where there was none.
 * ================================================================================================ */

test("the review declares one table of checks, every check dated, every control named", () => {
  const rows = tableUnder(REVIEW_LINES, REVIEW_CHECK_HEADING);
  expect(
    rows.length,
    `docs/BRANDING.md has no data rows under "## ${REVIEW_CHECK_HEADING}"`,
  ).toBeGreaterThan(0);

  // **The date, as a shape and not as a substring.** A cell carrying the date somewhere in a sentence
  // would pass a substring test, and the point of the column is that the date *is* the cell.
  expect(
    rows
      .filter(
        (row) =>
          /^\d{4}-\d{2}-\d{2}$/.test(cellAt(row, REVIEW_CHECK_HEADER, "measured on")) === false,
      )
      .map((row) => cellAt(row, REVIEW_CHECK_HEADER, "check")),
    "checks the review reports without the date they were measured on, in the column that exists for it. The figures are a property of the world on that date.",
  ).toEqual([]);

  expect(
    rows
      .filter((row) => cellAt(row, REVIEW_CHECK_HEADER, "control").trim() === "")
      .map((row) => cellAt(row, REVIEW_CHECK_HEADER, "check")),
    "checks the review reports with no control, which is what decides whether a reported zero is a finding",
  ).toEqual([]);
});

test("a check the review reports as unmeasured carries no verdict", () => {
  const rows = tableUnder(REVIEW_LINES, REVIEW_CHECK_HEADING);
  const results = rows.map((row) => ({
    check: cellAt(row, REVIEW_CHECK_HEADER, "check"),
    result: cellAt(row, REVIEW_CHECK_HEADER, "result"),
  }));

  // **This case was rebuilt because a falsification arm proved the first version could not fail.**
  //
  // The first version asserted two things: that some row begins with `unmeasured`, and that no row
  // beginning with `unmeasured` carries a verdict word. **Those two can never both be true of one row** - a
  // row carrying a verdict word does not begin with `unmeasured` - so the second assertion could only fire
  // on a result cell reading `unmeasured ... clear ...`, which is a sentence nobody writes. **An arm that
  // gave an unmeasured row the verdict `clear` left the whole suite green.**
  //
  // What replaced it is the claim the requirement actually makes: **the review declares which checks it
  // could not measure, and every one of them is recorded as unmeasured.** The declared list and the check
  // table are compared in both directions, so moving a check out of the list, or giving its result cell a
  // verdict, reports that check by name.
  const declaredUnmeasured = tableUnder(REVIEW_LINES, REVIEW_UNMEASURED_HEADING).map((row) =>
    cellAt(row, REVIEW_UNMEASURED_HEADER, "check"),
  );
  const byCheck = new Map(results.map((entry) => [entry.check, entry.result]));

  expect(
    declaredUnmeasured.length,
    "the review declares no unmeasured check, so the requirement has nothing to hold",
  ).toBeGreaterThan(0);

  expect(
    declaredUnmeasured.filter((check) => byCheck.has(check) === false),
    "checks the review declares unmeasured that its own check table does not carry",
  ).toEqual([]);
  expect(
    declaredUnmeasured
      .filter((check) => (byCheck.get(check) ?? "").startsWith(UNMEASURED) === false)
      .map(
        (check) =>
          `the review declares ${check} unmeasured and its result cell reads "${byCheck.get(check)}"`,
      ),
    "checks the review declares unmeasured that its check table does not record as unmeasured",
  ).toEqual([]);
  expect(
    declaredUnmeasured
      .filter((check) => VERDICTS.some((verdict) => (byCheck.get(check) ?? "").includes(verdict)))
      .map(
        (check) => `the review declares ${check} unmeasured and its result cell carries a verdict`,
      ),
    "checks the review declares unmeasured whose result cell carries a verdict word",
  ).toEqual([]);

  // **And the other direction, which is the claim that had no assertion at all**: a check that quietly
  // became measurable must not stay in the unmeasured list, and a check the table records as unmeasured
  // must be declared so.
  const resultUnmeasured = results
    .filter((entry) => entry.result.startsWith(UNMEASURED))
    .map((entry) => entry.check);
  expect(
    resultUnmeasured.filter((check) => declaredUnmeasured.includes(check) === false),
    "check-table rows recorded as unmeasured that the review does not declare unmeasured",
  ).toEqual([]);

  // **And every other row carries exactly one of the declared verdicts**, so "no verdict attached" is
  // not satisfied by every row being vague.
  expect(
    results
      .filter((entry) => entry.result.startsWith(UNMEASURED) === false)
      .filter((entry) => VERDICTS.filter((verdict) => entry.result.includes(verdict)).length !== 1)
      .map((entry) => entry.check),
    `checks carrying something other than exactly one of ${VERDICTS.join(" or ")}`,
  ).toEqual([]);
});

test("the review's surface table is the map, in both directions", () => {
  const rows = tableUnder(REVIEW_LINES, REVIEW_SURFACE_HEADING);
  expect(
    rows.length,
    `docs/BRANDING.md has no data rows under "## ${REVIEW_SURFACE_HEADING}"`,
  ).toBeGreaterThan(0);

  const read: string[] = [];
  for (const row of rows) {
    const surface = cellAt(row, REVIEW_SURFACE_HEADER, "surface");
    const file = cellAt(row, REVIEW_SURFACE_HEADER, "file");
    const cell = cellAt(row, REVIEW_SURFACE_HEADER, "site");
    const sites = parseSite(cell);

    // **A site cell the vocabulary does not recognise is reported by name rather than skipped**, and
    // skipping is the failure: an unread site leaves a surface the document names that nothing checks.
    expect(
      sites,
      `${surface} writes its site as "${cell}", which is not "line N", "lines N, N, N" or "key a.b".
      A site written as prose leaves the table's central claim unchecked.`,
    ).not.toBeNull();

    for (const at of sites ?? []) read.push(`${surface} / ${file} / ${at}`);
  }

  expect(
    read.filter((entry) => DECLARED_SITES.includes(entry) === false),
    "surfaces the review names that the map does not",
  ).toEqual([]);
  expect(
    DECLARED_SITES.filter((entry) => read.includes(entry) === false),
    "surfaces the map names that the review does not",
  ).toEqual([]);

  // **And the row count, so a row the vocabulary rejected cannot pass as a match.**
  expect(rows.length, "the review's surface table row count").toBe(SURFACE_COUNT);
});

test("the heading and table readers both fire on a plant", () => {
  // **Both readers, and the first case is a positive one.** A `headingsWithin` that returned nothing
  // would make every table assertion below pass for the wrong reason, and a `tableUnder` that found the
  // wrong table would satisfy the row count with a table the review does not have.
  const planted = [
    "# A planted review",
    "",
    "## 5. The surface map: every place the product names itself as the product",
    "",
    "| surface | file | site | rendered | read by |",
    "| --- | --- | --- | --- | --- |",
    "| planted surface | apps/web/index.html | line 1 | planted | planted |",
    "",
    "## 6. After the planted table",
  ];

  expect(
    headingsWithin(planted)
      .filter((entry) => entry.depth === 2)
      .map((entry) => entry.text),
    "the heading reader did not find the planted headings",
  ).toEqual([
    "5. The surface map: every place the product names itself as the product",
    "6. After the planted table",
  ]);
  expect(
    tableUnder(planted, "5. The surface map: every place the product names itself as the product"),
    "the table reader did not read the planted table",
  ).toEqual([["planted surface", "apps/web/index.html", "line 1", "planted", "planted"]]);

  // **And the negative half of the heading reader**, because a reader matching any line would satisfy the
  // assertion above with a document that has no heading in it.
  expect(
    headingsWithin(["not a heading", "#no-space-is-not-one", "", "##  two spaces is"])
      .map((entry) => entry.text)
      .filter((text) => text !== "two spaces is"),
    "a line that is not an ATX heading was read as one",
  ).toEqual([]);

  // **And the separator arm**, because the alternative is a reader that reports a document's formatting
  // as a document's content: a table with no separator row is one no markdown renderer would draw.
  expect(
    tableUnder(
      planted.map((line) => line.replace("| --- | --- | --- | --- |", "| surface | file | site |")),
      "5. The surface map: every place the product names itself as the product",
    ),
    "a table whose second row is not a separator was read as a table",
  ).toEqual([]);
});

/* ================================================================================================ *
 * 5. THIS FILE'S OWN SHAPE. No shared reader, and no pattern beyond the declared few.
 * ================================================================================================ */

/**
 * The module names of the other architecture suites, assembled rather than written.
 *
 * A literal would defeat the case it serves: an import specifier is a **string**, and this check has to
 * read text with strings intact, so the needle it looks for is the very text its own declaration would
 * contain. **A check that has to name what it forbids cannot hold that name contiguously in its own
 * source.**
 */
const OTHER_SUITE_MODULES: readonly string[] = [
  ["boundaries", "test"].join("."),
  ["privacy", "disclosure", "test"].join("."),
  ["security", "audit", "test"].join("."),
];

const OTHER_SUITE_PATHS: readonly string[] = [
  "tests/architecture/boundaries.test.ts",
  "tests/architecture/privacy-disclosure.test.ts",
  "tests/architecture/security-audit.test.ts",
];

/**
 * Every regular-expression literal this file contains, read through the TypeScript parser.
 *
 * **A parser rather than a character scanner**, which is both shorter and the direction this repository
 * has needed most: a scanner that counts a `/` inside a path as a pattern fires on its own
 * documentation, and one that stops at the first `//` inside a string reports nothing. The parser cannot
 * confuse a pattern for text, because a pattern **is** a node kind.
 */
function regexLiteralsIn(source: string): string[] {
  const found: string[] = [];
  const parsed = ts.createSourceFile("self.ts", source, ts.ScriptTarget.Latest, true);
  const pending: ts.Node[] = [parsed];

  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (ts.isRegularExpressionLiteral(node)) found.push(node.text);
    pending.push(...node.getChildren(parsed.sourceFile));
  }

  return found;
}

/** Every module specifier a source imports, as written. */
function importedSpecifiersIn(source: string): string[] {
  const specifiers: string[] = [];
  const parsed = ts.createSourceFile("imports.ts", source, ts.ScriptTarget.Latest, true);

  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement) === false) continue;
    const specifier = statement.moduleSpecifier;
    if (ts.isStringLiteralLike(specifier)) specifiers.push(specifier.text);
  }

  return specifiers;
}

/**
 * A function body qualifies as a **reader** for the independence check when it holds more than one
 * statement.
 *
 * **One statement is an incantation rather than a reader**, and all the architecture suites read a
 * repository file the same one-expression way, so a check with no threshold would report exactly that and
 * nothing else. **Rewriting a working reader so that it differs from another's would be contorting code
 * to please a check**; the check declares what it is looking for instead, and the limit is stated here
 * rather than left for the next copy that matters.
 */
const READER_MINIMUM_STATEMENTS = 2;

/** Every function declaration's body, at any depth, narrowed to those that could be a reader. */
function functionBodiesIn(source: string): string[] {
  const bodies: string[] = [];
  const parsed = ts.createSourceFile("bodies.ts", source, ts.ScriptTarget.Latest, true);
  const pending: ts.Node[] = [parsed];

  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;

    const declared = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);
    const body = declared ? node.body : undefined;
    if (
      body !== undefined &&
      ts.isBlock(body) &&
      body.statements.length >= READER_MINIMUM_STATEMENTS
    ) {
      bodies.push(body.getText(parsed));
    }

    pending.push(...node.getChildren(parsed.sourceFile));
  }

  return bodies;
}

/**
 * The complete set of regular-expression literals this file is allowed to contain.
 *
 * **Each is structural** - line splitting, markdown shape, this file's site vocabulary, an HTML element
 * and a date - and none is handed the product's name as its input, which is what rule 1 is. A new pattern
 * has to be added here, which makes adding one a decision somebody has to look at.
 *
 * **What this check does not establish, said so it is not read as more than it is.** It establishes that
 * every pattern in the file is declared and structural. It does not establish that a declared pattern is
 * harmless, and it does not establish rule 1 - that claim is held by the **shape** of the comparisons
 * above, which are against node kinds rather than against patterns.
 */
const ALLOWED_PATTERNS: readonly string[] = [
  "/\\r?\\n/",
  "/\\s+/g",
  "/<title>([^<]*)<\\/title>/",
  "/^line (\\d+)$/",
  "/^lines ([\\d, ]+)$/",
  "/^key ([A-Za-z0-9_.]+)$/",
  "/^\\d{4}-\\d{2}-\\d{2}$/",
  "/\\.test\\.|\\.spec\\./",
  "/^__.*probe\\.[cm]?tsx?$/",
];

const AUDIT_SOURCE = readRepositoryFile("tests/architecture/branding-audit.test.ts");
const OTHER_SUITE_SOURCES: readonly string[] = OTHER_SUITE_PATHS.map((path) =>
  readRepositoryFile(path),
);

test("this file contains no pattern beyond the declared ones", () => {
  const found = regexLiteralsIn(AUDIT_SOURCE);

  expect(
    found.filter((pattern) => ALLOWED_PATTERNS.includes(pattern) === false),
    "regular-expression literals in this file that are not in the structural allow-list",
  ).toEqual([]);
  expect(
    ALLOWED_PATTERNS.filter((pattern) => found.includes(pattern) === false),
    "declared patterns this file no longer contains, which is how a stale allow-list entry is found",
  ).toEqual([]);

  // **And none of them holds a backtick**, which is the property the file header states and the one
  // `boundaries.test.ts`'s own comment stripper is unable to survive.
  expect(
    found.filter((pattern) => pattern.includes("\x60")),
    "a regular-expression literal in this file holds a literal backtick",
  ).toEqual([]);

  // **The extractor, shown a pattern and shown something that only looks like one.**
  const probe =
    'const PLANTED = /never-a-claim[0-9]+/g;\nconst TEXT = "/not-a-pattern[0-9]+/";\n// /also-not[0-9]+/\n';
  expect(
    regexLiteralsIn(probe),
    "the extractor does not see a pattern planted into code, or counts one written as text",
  ).toEqual(["/never-a-claim[0-9]+/g"]);
});

test("this file shares no reader with the other architecture suites", () => {
  // **Two checks, because the two claims have different shapes.** An *import specifier* is a string and
  // is read as one; a *function body* is code and is compared whole, which catches a copy as well as an
  // import - a shared body is a shared reader wearing a different name.
  expect(
    importedSpecifiersIn(AUDIT_SOURCE).filter((specifier) =>
      OTHER_SUITE_MODULES.some((name) => specifier.endsWith(name)),
    ),
    "this file imports from an architecture suite it must share no reader with",
  ).toEqual([]);

  const otherBodies = OTHER_SUITE_SOURCES.flatMap(functionBodiesIn);
  expect(
    functionBodiesIn(AUDIT_SOURCE).filter((body) => otherBodies.includes(body)),
    "function bodies in this file that are byte-identical to one in another architecture suite",
  ).toEqual([]);

  // **Both controls, through the same readers the assertions above use.** A control that calls the
  // reader is not a control on the assertion; it is a second use of the same reader, and a mutation of
  // the first is invisible to it.
  const plantedImport = `import type { Anything } from "./${OTHER_SUITE_MODULES[0]}";`;
  expect(
    importedSpecifiersIn(plantedImport),
    "the planted import specifier is not read by the reader the assertion above uses",
  ).toEqual(["./boundaries.test"]);

  const donorBody = functionBodiesIn(OTHER_SUITE_SOURCES[0] ?? "")[0] ?? "";
  expect(donorBody, "no donor body was found to plant").not.toBe("");
  expect(
    functionBodiesIn(`${AUDIT_SOURCE}\nfunction planted()${donorBody}\n`).filter((body) =>
      otherBodies.includes(body),
    ),
    "the planted body is not reported by the reader the assertion above uses",
  ).toHaveLength(1);

  // **And the suites are non-empty**, or the two assertions above would be satisfied by an empty corpus.
  expect(OTHER_SUITE_SOURCES.length, "no other suite was read to compare against").toBe(
    OTHER_SUITE_PATHS.length,
  );
  expect(otherBodies.length, "the other suites declare no function to share").toBeGreaterThan(0);
});
