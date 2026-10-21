/**
 * `docs/SECURITY.md` against the specifications it cites.
 *
 * ## What this file is, and what it is not
 *
 * The failure this change exists to end is **a document nobody can check**, and the checkable form of
 * that is narrow: an audit that cites a requirement by name goes stale silently the day that
 * requirement is renamed, and nothing in this repository would say so. So the instrument here is
 * **not "does the document exist"** and not "does it look thorough". It resolves **every citation the
 * document makes**, against the specifications as they stand, and reports one that resolves to
 * nothing **by name**.
 *
 * **The nine-area count is measured rather than recalled**, because `docs/ROADMAP.md` itself said
 * *"eight"* until 2026-10-14 — a document written by the milestone that carries the instrument got the
 * count the instrument exists to catch wrong. The roadmap's own fenced block is the source, and this
 * file reads it.
 *
 * ## Three rules of the house, and why each exists
 *
 * **1. Citations are parsed by one structural pattern and resolved by structure, never by pattern.**
 * The pattern matches the audit's declared grammar — `` capability ``, an em dash, `_heading_`, and a
 * `path:line` — and every assertion after that is a comparison against the specification file's own
 * headings. **A scan that searched for a heading's words would pass on a document citing the wrong
 * requirement with the right vocabulary**, which is the same class of defect as the adapter-identifier
 * rule that listed three exports which did not exist.
 *
 * **The emphasis spelling is Prettier's, not this file's.** `format:check` rewrites `*heading*` to
 * `_heading_` in a markdown table, so a grammar written against the asterisk parsed **zero** of the
 * audit's eighteen citations on its first run. The disagreement was resolved on the side the formatter
 * owns, which is the same resolution `motion-and-reduced-motion`'s apply stage recorded — **two gates
 * disagreeing is not resolvable by pinning the bytes of a document a formatter owns.**
 *
 * **No literal backtick appears inside any regular-expression literal in this file.** That is not a
 * style preference: `boundaries.test.ts`'s `stripComments` tracks line comments, block comments and
 * three string delimiters and has **no state for a regular-expression literal**, so a backtick inside
 * one opens a string that runs to the next backtick, desynchronises that reader for the rest of the
 * file, and takes a red gate with a cause that reads as correct. The backtick is written `\x60`
 * throughout, and the pattern allow-list below is what makes that a check rather than an intention.
 *
 * **2. Coverage is deliberately not required** (`design.md` D5, task 3.2). **An area with no
 * requirement governing it is the audit's finding**, so a check that failed on one would make the
 * instrument useless precisely when the audit had something to report. The instrument resolves what
 * the document claims and checks nothing about what it omits, and §4 of the document says so in its
 * own words. **A row that carries neither a requirement nor an instrument is a row this file
 * tolerates**, and that tolerance is asserted against a planted row rather than left to be true.
 *
 * **3. Every reader carries a planted control, and the first case is a positive one.** A reader that
 * resolves nothing satisfies every absence claimed above it — and this repository's most-recorded
 * defect is exactly that shape: an instrument narrower than the rule it was written for returns a
 * clean result rather than an error. So the citation reader's self-test **begins with a citation known
 * to resolve** and only then plants one known not to.
 *
 * ## What it establishes, and the three things it does not
 *
 * It establishes that the nine areas are the roadmap's nine, in order and by spelling; that every
 * citation resolves to a requirement heading that exists in the file it names, in the capability
 * directory it names, within a bounded window at or above it; that every backticked token in a
 * requirement cell belongs to a citation; that every backticked token in an instrument column is a
 * repository path that exists; and that the audit names no provider credential field, per D8.
 *
 * It does **not** establish that a cited requirement still **says** what it said — a requirement
 * *weakened* rather than renamed resolves perfectly, and `design.md`'s risk section names this as the
 * failure mode the instrument bounds and not the only one. It does not establish that a cited **line
 * number** is the right line; it is checked for being near its heading, which is a bound and not a
 * proof. And it does not establish that the audit **should** have cited what it cited — a document
 * that cites nothing resolves perfectly too, which is why the non-vacuity assertions below are half
 * of what this file does.
 *
 * ## No reader is shared with the other two architecture suites, and that is asserted
 *
 * `boundaries.test.ts` and `privacy-disclosure.test.ts` both end with a case holding their own source
 * to their own rules. This file does the same, with two checks rather than the customary one: **no
 * module specifier** resolves to either suite, and **no function body** in this file is byte-identical
 * to one in either. The second is the stronger of the two, because it catches a copy as well as an
 * import, and it is falsifiable by a planted body taken from `boundaries.test.ts` itself.
 *
 * **A tool that also checks its own work cannot report its own defect**, so the independence here is
 * structural rather than a promise: nothing is imported from either suite, and this file's readers
 * are its own.
 *
 * ## `tsc` does not cover this file, and that is a limit rather than a repair
 *
 * `tests/architecture/` has **no `tsconfig.json`** and is not a workspace member, so `pnpm typecheck`
 * checks neither this file's nor either of the other two's types. Adding a `tsconfig.json` would move
 * **every future gate's** typecheck scope, which is a decision this change does not make. The
 * consequence is recorded here rather than smoothed over: **a type error in this file is a runtime
 * failure, not a `pnpm verify` failure.** The credential route that *is* covered — the `satisfies`
 * literals in `apps/extension/src/protocol.test.ts`, which **is** inside `apps/extension/tsconfig.json`
 * — is deliberately the one that carries the compiler.
 *
 * ## The regex allow-list is the check that keeps rule 1 honest
 *
 * The last case reads this file's own source through the **TypeScript parser** — not through a
 * character scanner, so a path or a markdown fragment in a comment is never counted as a pattern, and a
 * pattern written inside a string is not counted either. Every regular-expression literal the file
 * contains is declared below, in both directions, and the declaration is three entries long. **A new
 * pattern has to be added there, which makes adding one a decision somebody has to look at.**
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { expect, test } from "vitest";

/** The repository root, resolved the way the other architecture suites resolve it. */
const REPO_ROOT = process.cwd();

/** The audit under test, and the roadmap block it is measured against. */
const AUDIT_PATH = "docs/SECURITY.md";
const ROADMAP_PATH = "docs/ROADMAP.md";

/** The one section of the roadmap this change measures against, named rather than line-numbered. */
const ROADMAP_REVIEW_HEADING = "Security review";

/** The audit's own section holding the table, and the column headers that identify it. */
const AUDIT_TABLE_HEADING = "The nine areas";
const AUDIT_TABLE_HEADER = ["area", "verdict", "requirement", "instrument"] as const;

/**
 * How many areas the review covers.
 *
 * **A declared count, and it is declared rather than derived so the derivation can fail.** The
 * assertion below compares the roadmap's fenced block, the table's first column and this number in
 * one expression; a reader that returned the table's own length would satisfy itself.
 *
 * **`docs/ROADMAP.md` said "eight" until 2026-10-14.** The count in the ledger was wrong in the file
 * that carries the instrument, which is the reason this number is written where a change has to meet
 * it.
 */
const AREA_COUNT = 9;

/**
 * How far a cited line may sit from the heading of the requirement it names.
 *
 * **A bound, not a proof, and its own reason is recorded so it is not read as a licence.** Every
 * citation in the document today resolves at **distance zero** — the cited line *is* the requirement's
 * heading line — which is a measurement rather than a threshold. The window exists for the other
 * direction: a line number that has drifted into another requirement's block, or into a different file
 * entirely, resolves to nothing even though the file exists and the capability exists.
 *
 * **A number chosen to be large enough is the defect this repository records with a larger constant**,
 * so the bound is stated here and the distance is reported by name in the failure message.
 */
const CITATION_LINE_WINDOW = 40;

/** The three verdicts the audit's §3 declares. Every row's verdict cell must be one of them. */
const VERDICTS: readonly string[] = [
  "closed",
  "closed by its own change",
  "open — closed by this change",
];

/**
 * §6, which enumerates the rows the review did **not** close, and the sentence fragment carrying its
 * count.
 *
 * **This section's count was wrong and no assertion covered it.** It read "the remaining four closed
 * rows" over a table carrying **five** plain `closed` verdicts — a counted figure in a document whose
 * whole purpose is to be checkable, unguarded, in the one section whose claim is a count. The fix is
 * the number; the instrument that would have caught it is the case below.
 */
const AUDIT_SECTION_SIX = "6. Areas closed before this review began";
const CLOSED_ROWS_PHRASE = "remaining ";

/**
 * The count words this file reads, and their values.
 *
 * **A closed map rather than a `parseInt`,** because the audit writes this count as a word and a
 * reader that silently returned 0 for a word it did not recognise would make the assertion below pass
 * on an unreadable document — which is the vacuous direction.
 */
const COUNT_WORDS: ReadonlyMap<string, number> = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);

/* ------------------------------------------------------------------------------------------------
 * Readers. Every one of them is self-tested, and none of them is shared with another suite.
 * ---------------------------------------------------------------------------------------------- */

/** Reads a repository file as UTF-8 text. */
function readRepositoryFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/**
 * A file's lines, with their one-based line numbers.
 *
 * **Line numbers are the point of this reader**, because a citation is `(path:line)` and a resolution
 * is "that heading is at that line". A reader that returned text without positions could not answer
 * either question, and the recorded shape of an audit that cannot be opened is a citation without one.
 */
function repositoryLines(relativePath: string): string[] {
  return readRepositoryFile(relativePath).split(/\r?\n/);
}

/** An ATX heading, with the position a citation or a section lookup needs. */
interface MarkdownHeading {
  /** The number of leading `#`. */
  readonly depth: number;
  /** The heading text, trimmed, with the leading `#` run removed. */
  readonly text: string;
  /** The one-based line the heading is on. */
  readonly line: number;
}

/**
 * Every ATX heading in a line list.
 *
 * **A character loop rather than a pattern**, for a reason that is about *this* file: every regular
 * expression literal here has to be declared in an allow-list that is meant to stay short, and a
 * heading's depth is one character counted, not a language. `#text` is not a heading in CommonMark and
 * is not read as one here.
 */
function headingsWithin(lines: readonly string[]): MarkdownHeading[] {
  const found: MarkdownHeading[] = [];

  lines.forEach((line, index) => {
    let depth = 0;
    while (depth < line.length && line.charAt(depth) === "#") {
      depth += 1;
    }
    if (depth === 0 || !line.slice(depth).startsWith(" ")) {
      return;
    }
    found.push({ depth, text: line.slice(depth).trim(), line: index + 1 });
  });

  return found;
}

/**
 * The lines of the first fenced block at or after a line, fences excluded.
 *
 * **The fence is three backticks built as a string constant rather than written as a pattern**, and
 * that is the same backtick concern as everywhere else in this file. The audit and the roadmap are both
 * markdown with fenced blocks, so this reader is not optional — it is where the nine areas come from.
 */
function fencedBlockAfter(lines: readonly string[], afterLine: number): string[] | null {
  const FENCE = "\x60\x60\x60";

  let open = -1;
  for (let index = afterLine; index < lines.length; index += 1) {
    if (lines[index]?.trimStart().startsWith(FENCE) === true) {
      open = index;
      break;
    }
  }
  if (open === -1) {
    return null;
  }

  for (let index = open + 1; index < lines.length; index += 1) {
    if (lines[index]?.trimStart().startsWith(FENCE) === true) {
      return lines.slice(open + 1, index);
    }
  }

  return null;
}

/** One markdown table row, as trimmed cells. */
type TableRow = readonly string[];

/** A markdown table found by its header, with the rows beneath it. */
interface MarkdownTable {
  readonly header: TableRow;
  readonly rows: readonly TableRow[];
}

/** Splits one `|`-delimited table row into its cells. */
function cellsOfRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const body = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return body.split("|").map((cell) => cell.trim());
}

/**
 * The first table at or under a heading, located by its own header row.
 *
 * **Located by the header rather than by position**, so a table added to the document above it is not
 * silently read as this one — and **the header is compared as a whole row**, because the recorded shape
 * of a table reader that compares only the first cell is a reader that finds any table.
 */
function tableUnder(lines: readonly string[], headingText: string): MarkdownTable | null {
  const headings = headingsWithin(lines);
  const heading = headings.find((entry) => entry.text === headingText);
  if (heading === undefined) {
    return null;
  }

  const collected: TableRow[] = [];
  let closed = false;

  for (let index = heading.line; index < lines.length && !closed; index += 1) {
    const line = lines[index] ?? "";
    if (
      headings.slice(0).some((entry) => entry.line === index + 1 && entry.depth <= heading.depth)
    ) {
      closed = true;
      break;
    }
    if (!line.trimStart().startsWith("|")) {
      if (collected.length > 0) {
        closed = true;
      }
      continue;
    }
    collected.push(cellsOfRow(line));
  }

  if (collected.length < 2) {
    return null;
  }

  const [header, separator, ...rest] = collected;
  const headerCells = header ?? [];
  const separatorCells = separator ?? [];

  // **The separator row is checked as a shape rather than skipped by position.** A table rendered
  // without one is a table a markdown reader would not render either, and reading it anyway would
  // report a document's absence where its formatting is merely wrong.
  const isSeparatorRow = (row: TableRow): boolean =>
    row.length === headerCells.length &&
    row.every((cell) => cell.length >= 3 && [...cell].every((character) => character === "-"));

  if (!isSeparatorRow(separatorCells)) {
    return null;
  }

  return { header: headerCells, rows: isSeparatorRow(rest[0] ?? []) ? rest.slice(1) : rest };
}

/**
 * One citation out of a requirement cell.
 *
 * **Three of the four fields are structural and the fourth is a position**, and all four are required
 * for the citation to be openable by a reader — which is the property the audit's §3 claims for its own
 * grammar.
 */
interface AuditCitation {
  /** The capability as the document names it, which is a directory name. */
  readonly capability: string;
  /** The requirement heading as the document names it. */
  readonly heading: string;
  /** The specification file the citation opens, as a repository-relative path. */
  readonly path: string;
  /** The one-based line the citation names. */
  readonly line: number;
}

/**
 * The audit's citation grammar, as one structural pattern.
 *
 * **Exactly the four parts §3 of the document declares**: a backticked capability, an em dash, the
 * heading in emphasis, and a backticked `path:line`. The heading is delimited by underscores, and
 * **that is Prettier's spelling rather than mine** — `format:check` rewrites `*heading*` to
 * `_heading_` in a markdown table, so a grammar written against the asterisk resolved **zero** of the
 * audit's eighteen citations on its first run. The recorded lesson from `motion-and-reduced-motion`'s
 * apply stage applies directly: **when two gates disagree, the disagreement is resolved on the side
 * the formatter owns**, and this document is not a generated artefact whose bytes the instrument may
 * pin.
 *
 * **The heading's characters are `[^_]+`**, because the emphasis is what delimits it. A heading in the
 * specifications contains no underscore today, and if one ever did the citation would fail to parse
 * and be **reported by name**, which is the honest direction.
 *
 * **Every backtick is `\x60`**, never a literal, for the reason in the file header.
 */
const CITATION_GRAMMAR = /\x60([a-z0-9][a-z0-9-]*)\x60 — _([^_]+)_ \(\x60([^\x60]+):(\d+)\x60\)/g;

/** Every backticked token in a cell, which is this file's own notation and not prose. */
const BACKTICKED_TOKEN = /\x60([^\x60]+)\x60/g;

/**
 * The citations a requirement cell makes.
 *
 * **The unmapped-match arm is a guard rather than a convenience.** Every group is destructured and
 * checked, so a pattern that stopped matching part of the grammar yields *fewer* citations rather than
 * an object of `undefined`s — and the token-count assertion below is what turns that into a failure,
 * because a cell whose tokens are unexplained is exactly what a narrower grammar produces.
 */
function citationsWithin(cell: string): AuditCitation[] {
  const parsed: AuditCitation[] = [];

  for (const match of cell.matchAll(CITATION_GRAMMAR)) {
    const [, capability, heading, path, line] = match;
    if (
      capability === undefined ||
      heading === undefined ||
      path === undefined ||
      line === undefined
    ) {
      continue;
    }
    parsed.push({
      capability,
      heading: heading.trim(),
      path,
      line: Number.parseInt(line, 10),
    });
  }

  return parsed;
}

/** Every backticked token in a cell, in order. */
function backtickedTokensWithin(cell: string): string[] {
  return [...cell.matchAll(BACKTICKED_TOKEN)].map((match) => match[1] ?? "");
}

/** One audit row, with the citations and tokens already extracted. */
interface AuditRow {
  readonly area: string;
  readonly verdict: string;
  readonly requirementCell: string;
  readonly instrumentCell: string;
  readonly citations: readonly AuditCitation[];
}

/** The audit's table, read as rows. */
function auditRowsIn(documentLines: readonly string[]): AuditRow[] {
  const table = tableUnder(documentLines, AUDIT_TABLE_HEADING);
  if (table === null) {
    return [];
  }

  return table.rows.map((row) => {
    const requirementCell = row[AUDIT_TABLE_HEADER.indexOf("requirement")] ?? "";
    const instrumentCell = row[AUDIT_TABLE_HEADER.indexOf("instrument")] ?? "";

    return {
      area: row[AUDIT_TABLE_HEADER.indexOf("area")] ?? "",
      verdict: (row[AUDIT_TABLE_HEADER.indexOf("verdict")] ?? "").replaceAll("*", "").trim(),
      requirementCell,
      instrumentCell,
      citations: citationsWithin(requirementCell),
    };
  });
}

/** How a citation is rendered back into a name, so a failure names the citation rather than a count. */
function citationName(citation: AuditCitation): string {
  return `${citation.capability} / ${citation.heading} / ${citation.path}:${citation.line}`;
}

/**
 * A citation that resolves to nothing, or `null` when it resolves.
 *
 * **Four checks, and each answers a different way a citation can rot.** The path must name a
 * specification *inside the capability directory it claims* — a capability renamed, or a citation aimed
 * at the wrong file, fails here before any heading is read. The file must exist. The heading must exist
 * **exactly once**, because two requirements sharing a heading is a specification defect this instrument
 * reports rather than resolves. And the line must sit inside that requirement's own block.
 */
/**
 * The line the next requirement's heading sits on, read from the file.
 *
 * **The line is read, not typed.** A plant that names a line as a number is a claim about a file
 * that any edit above it falsifies, **and this repository has recorded that shape twice** — once for
 * `docs/SECURITY.md`'s own citations, which a `MODIFIED` promotion moved, and once for this
 * file's own count of the boundary suite's assertions.
 *
 * **The scan is independent of the citation reader's heading finder**, because a control that calls
 * the reader is a control on the reader's helper and not on the reader — the recorded shape.
 */
function lineOfNextRequirementHeading(path: string, heading: string): number {
  const lines = repositoryLines(path);
  const at = lines.findIndex((line) => line === `### Requirement: ${heading}`);
  if (at === -1) {
    throw new Error(`no requirement heading "${heading}" in ${path}`);
  }
  for (let index = at + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith("### Requirement: ")) return index + 1;
  }
  throw new Error(`no requirement heading after "${heading}" in ${path}`);
}

function unresolvedCitation(citation: AuditCitation): string | null {
  const segments = citation.path.split("/");
  const capabilityDirectory = segments[segments.length - 2];
  if (capabilityDirectory !== citation.capability) {
    return `${citationName(citation)} — cited capability is not the directory the path names`;
  }

  const inPromotedSpecs =
    segments[0] === "openspec" && segments[1] === "specs" && segments.length === 4;
  const inAChange =
    segments[0] === "openspec" && segments[1] === "changes" && segments.length === 6;
  if (!inPromotedSpecs && !inAChange) {
    return `${citationName(citation)} — not a path under openspec/specs or a change's specs`;
  }

  if (!existsSync(join(REPO_ROOT, citation.path))) {
    return `${citationName(citation)} — no such file`;
  }

  const headings = headingsWithin(repositoryLines(citation.path)).filter(
    (entry) => entry.depth === 3 && entry.text === `Requirement: ${citation.heading}`,
  );
  if (headings.length === 0) {
    return `${citationName(citation)} — no requirement with that heading in that file`;
  }
  if (headings.length > 1) {
    return `${citationName(citation)} — ${headings.length} requirements carry that heading in that file`;
  }

  const headingLine = headings[0]?.line ?? 0;
  const nextRequirementLine = headingsWithin(repositoryLines(citation.path))
    .filter((entry) => entry.depth === 3 && entry.line > headingLine)
    .map((entry) => entry.line)
    .reduce<number | null>(
      (soonest, line) => (soonest === null ? line : Math.min(soonest, line)),
      null,
    );

  if (citation.line < headingLine) {
    return `${citationName(citation)} — names a line above the heading it cites`;
  }
  if (nextRequirementLine !== null && citation.line >= nextRequirementLine) {
    return `${citationName(citation)} — names a line ${citation.line - headingLine} past its heading, inside another requirement`;
  }
  if (citation.line - headingLine > CITATION_LINE_WINDOW) {
    return `${citationName(citation)} — names a line ${citation.line - headingLine} past its heading, past the declared window of ${CITATION_LINE_WINDOW}`;
  }

  return null;
}

/** Every citation the audit makes that resolves to nothing, named. */ function unresolvedCitationsIn(
  rows: readonly AuditRow[],
): string[] {
  return rows.flatMap((row) =>
    row.citations.flatMap((citation) => {
      const unresolved = unresolvedCitation(citation);
      return unresolved === null ? [] : [unresolved];
    }),
  );
}

/**
 * A backticked token in an instrument column that is not a repository path that exists.
 *
 * **Every token, not just the ones that look wrong.** §3 of the document declares that column to be
 * paths and nothing else, so a token naming a constant is a violation of the declared grammar rather
 * than a judgement call — and a reader that filtered on "looks like a path" first would answer the
 * easier question instead of the stated one.
 */
function unresolvableInstrumentPaths(rows: readonly AuditRow[]): string[] {
  return rows.flatMap((row) =>
    backtickedTokensWithin(row.instrumentCell)
      .filter((token) => !token.includes("/") || !existsSync(join(REPO_ROOT, token)))
      .map((token) => `${row.area} / ${token}`),
  );
}

/**
 * A backticked token in a requirement column that is not part of one of its citations.
 *
 * **The check that makes the grammar total.** A requirement cell's tokens are exactly its citations'
 * capability and `path:line`, two per citation; anything else in backticks is a reader being pointed at
 * something the instrument was never asked to resolve. **This is what turns a citation pattern that has
 * stopped matching into a failure**, because a cell whose tokens are all unexplained is exactly what a
 * narrower pattern produces — and a count-free comparison of two sets does that in both directions.
 */
function unexplainedRequirementTokens(rows: readonly AuditRow[]): string[] {
  return rows.flatMap((row) => {
    const explained = row.citations.flatMap((citation) => [
      citation.capability,
      `${citation.path}:${citation.line}`,
    ]);
    return backtickedTokensWithin(row.requirementCell)
      .filter((token) => !explained.includes(token))
      .map((token) => `${row.area} / ${token}`);
  });
}

/* ------------------------------------------------------------------------------------------------
 * The credential-field reader for rule D8, which reads `packages/core` rather than this file.
 * ---------------------------------------------------------------------------------------------- */

/** The module whose credential declarations the audit must not restate. */
/**
 * The lines of one `## ` section of the audit, the heading line and the next section excluded.
 *
 * **Returns an empty list rather than throwing when the section is absent**, so the assertion that
 * uses it reports `null` against a real count instead of failing inside a reader — a reader that threw
 * would be a failure no attribution could point at.
 */
function sectionLines(lines: readonly string[], headingText: string): string[] {
  const headings = headingsWithin(lines);
  const start = headings.findIndex(
    (heading) => heading.depth === 2 && heading.text === headingText,
  );

  if (start === -1) {
    return [];
  }

  const from = headings[start].line;
  const next = headings.slice(start + 1).find((heading) => heading.depth <= 2);

  return lines.slice(from, next ? next.line - 1 : lines.length);
}

/**
 * The count §6 states for the rows the review did not close, or `null` when it states none.
 *
 * **The word is looked up in a closed map and an unknown word yields `null` rather than 0**, so a
 * reworded sentence fails the comparison below instead of silently agreeing with it.
 */
function statedClosedRowCount(lines: readonly string[]): number | null {
  for (const line of sectionLines(lines, AUDIT_SECTION_SIX)) {
    const at = line.indexOf(CLOSED_ROWS_PHRASE);

    if (at === -1) {
      continue;
    }

    const rest = line.slice(at + CLOSED_ROWS_PHRASE.length);
    const space = rest.indexOf(" ");
    const word = space === -1 ? rest : rest.slice(0, space);
    const value = COUNT_WORDS.get(word);

    if (value !== undefined) {
      return value;
    }
  }

  return null;
}

const CREDENTIALS_PATH = "packages/core/src/credentials.ts";

/**
 * Every **exported** type declaration in a source file, as the property names it declares.
 *
 * **The TypeScript parser, for the reason the other two suites record in their own words**: a
 * declaration read by pattern cannot tell a comment from a declaration, and this file's header names
 * the reader defect that costs the most here. It reads **both** declaration kinds — an interface is
 * `packages/core`'s shape today and a union alias is the `ProviderCredentials` line beside it — and a
 * union of *named references* contributes no inline members, which is why the derivation below filters
 * on members of its own rather than skipping by name.
 */
function declaredCredentialMembers(source: string): Map<string, readonly string[]> {
  const parsed = ts.createSourceFile("credentials.ts", source, ts.ScriptTarget.Latest, true);
  const declared = new Map<string, readonly string[]>();

  const isExported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

  const propertyNames = (members: readonly ts.TypeElement[]): string[] =>
    members.flatMap((member) =>
      ts.isPropertySignature(member) && ts.isIdentifier(member.name) ? [member.name.text] : [],
    );

  for (const statement of parsed.statements) {
    if (!isExported(statement)) {
      continue;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      declared.set(statement.name.text, propertyNames(statement.members));
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      const variants = ts.isUnionTypeNode(statement.type)
        ? statement.type.types.filter(ts.isTypeLiteralNode)
        : [];
      declared.set(
        statement.name.text,
        variants.flatMap((variant) => propertyNames(variant.members)),
      );
    }
  }

  return declared;
}

/** Counts how many declarations of their own each member name appears in. */
function memberCountsIn(source: string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const members of declaredCredentialMembers(source).values()) {
    for (const member of members) {
      counts.set(member, (counts.get(member) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * The field names that hold a credential, derived rather than declared.
 *
 * **The rule is "declared by exactly one variant"**, which is `packages/core`'s own shape: the
 * discriminant is the one member every variant carries and is not a secret, while each variant's own
 * fields are its own. A hardcoded exemption list would be the opposite of this change's D3 — a list
 * somebody has to remember to update, and a list that is not updated is a list that has declared a new
 * field safe.
 */
function credentialFieldNamesIn(source: string): Set<string> {
  return new Set(
    [...memberCountsIn(source)].filter(([, count]) => count === 1).map(([name]) => name),
  );
}

/** The member names every credential variant declares, which the rule above excludes by computation. */
function sharedCredentialFieldsIn(source: string): Set<string> {
  const variants = [...declaredCredentialMembers(source).values()].filter(
    (members) => members.length > 0,
  );
  const first = variants[0] ?? [];
  return new Set(first.filter((name) => variants.every((members) => members.includes(name))));
}

/**
 * Occurrences of a word in a document, counted on **word boundaries**.
 *
 * **Boundaries, not substring**, because the alternative reports the plural of a field name as the
 * field name and would make the forbidden check fire on a sentence that never named one. **No pattern**:
 * the boundary test is two character comparisons, which keeps this file's pattern allow-list at three
 * entries and keeps the backtick concern out of a place where a field name would sit.
 */
function wordOccurrencesIn(haystack: string, needle: string): number {
  const isWordCharacter = (character: string): boolean =>
    character !== "" &&
    ((character >= "a" && character <= "z") ||
      (character >= "A" && character <= "Z") ||
      (character >= "0" && character <= "9") ||
      character === "_");

  let found = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    const before = haystack.charAt(at - 1);
    const after = haystack.charAt(at + needle.length);
    if (!isWordCharacter(before) && !isWordCharacter(after)) {
      found += 1;
    }
    at = haystack.indexOf(needle, at + 1);
  }

  return found;
}

/* ------------------------------------------------------------------------------------------------
 * What this file is checked to say.
 * ---------------------------------------------------------------------------------------------- */

const AUDIT_LINES = repositoryLines(AUDIT_PATH);
const AUDIT_ROWS = auditRowsIn(AUDIT_LINES);
const CREDENTIALS_SOURCE = readRepositoryFile(CREDENTIALS_PATH);
const CREDENTIAL_FIELDS = credentialFieldNamesIn(CREDENTIALS_SOURCE);
const SHARED_CREDENTIAL_FIELDS = sharedCredentialFieldsIn(CREDENTIALS_SOURCE);

/* ================================================================================================ *
 * 1. THE AREAS. Measured from the roadmap's own fenced block, not recalled.
 * ================================================================================================ */

test("the audit reviews the roadmap's nine areas, in order and by spelling", () => {
  const roadmapLines = repositoryLines(ROADMAP_PATH);
  const sectionHeading = headingsWithin(roadmapLines).find(
    (entry) => entry.text === ROADMAP_REVIEW_HEADING,
  );
  expect(
    sectionHeading,
    `docs/ROADMAP.md has no "## ${ROADMAP_REVIEW_HEADING}" section`,
  ).toBeDefined();

  const block = fencedBlockAfter(roadmapLines, sectionHeading?.line ?? 0);
  expect(block, "the roadmap's security review names no fenced block of areas").not.toBeNull();

  const roadmapAreas = (block ?? []).map((line) => line.trim()).filter((line) => line.length > 0);
  const auditAreas = AUDIT_ROWS.map((row) => row.area);

  // **The three-way comparison, in that order, and the count is the declared one.** A reader that
  // returned the audit's own areas would satisfy the first half; a reader that returned
  // `roadmapAreas.length` would satisfy the second. **The declared number is what neither can do.**
  expect(
    roadmapAreas.length,
    "the roadmap's fenced block does not hold the declared number of areas",
  ).toBe(AREA_COUNT);
  expect(auditAreas, "the audit's areas, in the order the roadmap names them").toEqual(
    roadmapAreas,
  );

  // **And the other direction of the same comparison**, so an area the audit dropped is named rather
  // than counted: a length assertion reports a number, and two lists of nine that differ report nothing.
  expect(
    roadmapAreas.filter((area) => !auditAreas.includes(area)),
    "areas the roadmap names that the audit does not",
  ).toEqual([]);
  expect(
    auditAreas.filter((area) => !roadmapAreas.includes(area)),
    "areas the audit names that the roadmap does not",
  ).toEqual([]);
});

test("the fenced-block reader and the heading reader both fire on a plant", () => {
  // **Both readers, and the first case in this file is a positive one.** A `fencedBlockAfter` that
  // answered `null` for everything would satisfy "the audit has a table" below for the wrong reason,
  // and a `headingsWithin` that found nothing would satisfy the control that follows.
  const planted = [
    "# A planted document",
    "",
    "## Security review",
    "",
    "```text",
    "first planted area",
    "second planted area",
    "```",
    "",
    "## After",
  ];

  const headings = headingsWithin(planted);
  expect(
    headings.filter((entry) => entry.text === "Security review").map((entry) => entry.depth),
    "the planted heading is not found at the depth it was planted at",
  ).toEqual([2]);
  expect(fencedBlockAfter(planted, 4), "the planted fenced block is not read").toEqual([
    "first planted area",
    "second planted area",
  ]);

  // **The negative half of the heading reader**, because a reader that matched any line would satisfy
  // the assertion above with a document that has no heading in it.
  expect(
    headingsWithin(["not a heading", "#no-space-is-not-one", "", "##  two spaces is"])
      .map((entry) => entry.text)
      .filter((text) => text !== "two spaces is"),
    "a line that is not an ATX heading was read as one",
  ).toEqual([]);
});

/* ================================================================================================ *
 * 2. THE TABLE. Located by its own header, and its columns read as the document declares them.
 * ================================================================================================ */

test("the audit's table is the one its header names, with a row per area", () => {
  const table = tableUnder(AUDIT_LINES, AUDIT_TABLE_HEADING);

  expect(table, `docs/SECURITY.md has no table under "## ${AUDIT_TABLE_HEADING}"`).not.toBeNull();
  expect(table?.header, "the table's header row").toEqual([...AUDIT_TABLE_HEADER]);
  expect(table?.rows.length, "one row per area").toBe(AREA_COUNT);
});

test("every row's verdict is one of the three the document declares", () => {
  // **Stripped of emphasis before comparison**, because the document writes two of the three as bold
  // and one plain; a reader that compared the raw cell would report a formatting difference as a
  // fourth verdict, which is the shape of a sweep that reads formatting as content.
  expect(
    AUDIT_ROWS.map((row) => row.verdict).filter((verdict) => !VERDICTS.includes(verdict)),
    "verdicts that are not among the three §3 declares",
  ).toEqual([]);

  // **And the vocabulary is used, not merely permitted.** §3 calls the distinction "the review's
  // output rather than its input", so an audit carrying only one verdict would satisfy the assertion
  // above while having decided nothing.
  expect(
    VERDICTS.filter((verdict) => !AUDIT_ROWS.some((row) => row.verdict === verdict)),
    "declared verdicts no row uses",
  ).toEqual([]);
});

test("§6 states the count the table carries, and names every area in it", () => {
  // **Both halves, and the second is the one that reads as coverage.** A stated count of five over a
  // list of four bullets is a number a reader can check by looking, and nobody was looking: the count
  // said "four", the bullets said five, and nothing in this file could see the disagreement.
  const plainClosed = AUDIT_ROWS.filter((row) => row.verdict === "closed").map((row) => row.area);

  expect(statedClosedRowCount(AUDIT_LINES), "§6's stated count of the remaining closed rows").toBe(
    plainClosed.length,
  );

  const section = sectionLines(AUDIT_LINES, AUDIT_SECTION_SIX);

  expect(section.length, "§6's own lines").not.toBe(0);

  for (const area of plainClosed) {
    expect(
      section.some((line) => line.includes("**" + area + "**")),
      `§6 names "${area}", which the table marks plain closed`,
    ).toBe(true);
  }
});

test("the table reader finds the table it was planted next to, and refuses a table with no separator", () => {
  const planted = [
    "# Planted",
    "",
    "## The nine areas",
    "",
    "| area | verdict | requirement | instrument |",
    "| --- | --- | --- | --- |",
    "| planted area | closed | none | none |",
    "",
    "## After the table",
  ];

  expect(tableUnder(planted, "The nine areas")?.rows, "the planted table is not read").toEqual([
    ["planted area", "closed", "none", "none"],
  ]);

  // **The separator arm, because the alternative is a reader that reports a document's formatting as a
  // document's content.** A table with no separator row is one a markdown renderer would not draw.
  //
  // **The second row is replaced with a row of content rather than with nothing, and that is the whole
  // repair.** The first version replaced it with an empty line, which left the table one row short, so
  // `tableUnder` returned `null` from its *length* guard and never examined the separator's shape at
  // all. **The case passed with the separator check deleted** — the plant was aimed at one guard and
  // satisfied by an earlier one, which is the defect this repository has recorded more often than any
  // other, and which a green run cannot report.
  expect(
    tableUnder(
      planted.map((line) =>
        line.replace("| --- | --- | --- | --- |", "| area | verdict | requirement | instrument |"),
      ),
      "The nine areas",
    ),
    "a table whose second row is not a separator was read as a table",
  ).toBeNull();
});

/* ================================================================================================ *
 * 3. THE CITATIONS. Resolved, and never by pattern-matching the requirement's own words.
 * ================================================================================================ */

/**
 * A citation known to resolve, written out for the self-test below.
 *
 * **Its own existence is the first claim the reader makes.** It is spelled here rather than taken from
 * the document under test, because a self-test that reads its expectation out of the subject is a test
 * that passes when the subject is empty.
 */
const KNOWN_CITATION: AuditCitation = {
  capability: "spectre-storage",
  heading: "What this device holds can be removed on request",
  path: "openspec/specs/spectre-storage/spec.md",
  line: 288,
};

test("the citation reader reads a known-resolving citation, and reports one that resolves to nothing", () => {
  // **The positive case first, and its position is the instrument rather than the formatting.** Every
  // absence below this line is satisfied by a reader that parses nothing, so the reader is shown a
  // citation that resolves **before** any failure is claimed.
  const cell =
    "`spectre-storage` — _What this device holds can be removed on request_ (`openspec/specs/spectre-storage/spec.md:288`)";

  expect(
    citationsWithin(cell),
    "the reader did not read a citation it was written in the audit's own grammar",
  ).toEqual([KNOWN_CITATION]);
  expect(
    unresolvedCitation(KNOWN_CITATION),
    "the reader's own parse of a known-resolving citation did not resolve",
  ).toBeNull();

  // **And the reader is shown two citations in one cell**, because the audit's requirement cells carry
  // several and a reader that took only the first would satisfy every row it was pointed at.
  expect(
    citationsWithin(
      `${cell}; \`mail-parsing\` — _Link destinations are recovered together with their anchor text_ (\`openspec/specs/mail-parsing/spec.md:66\`)`,
    ).map((citation) => citation.capability),
    "a cell carrying two citations yields both",
  ).toEqual(["spectre-storage", "mail-parsing"]);

  // **The negative control (`design.md` D5, task 3.4).** A citation that names a capability whose
  // directory the path does not name — which is the shape a renamed capability takes.
  const planted: AuditCitation = {
    capability: "provider-abstraction",
    heading:
      "A provider credential reaches the transport and this device's storage, and nothing else",
    path: "openspec/specs/mailbox-session/spec.md",
    line: 5,
  };
  expect(
    unresolvedCitation(planted),
    "a citation aimed at the wrong capability's file is not reported",
  ).toContain("cited capability is not the directory the path names");

  // **And the other ways it can fail to resolve**, each with its own reason, because a reader that
  // reported only the first would satisfy every control below it. **Each plant is built so that it
  // reaches the check it is aimed at** — a citation whose capability does not match the directory its
  // path names is caught by the *first* check and would never reach the third, which is why the path
  // shape plant below carries `docs` as its capability rather than the capability it is really about.
  expect(
    unresolvedCitation({ ...KNOWN_CITATION, path: "openspec/specs/nonexistent/spec.md" }),
  ).toContain("cited capability is not the directory");
  expect(
    unresolvedCitation({ ...KNOWN_CITATION, capability: "docs", path: "docs/SECURITY.md" }),
  ).toContain("not a path under openspec/specs");
  expect(
    unresolvedCitation({
      ...KNOWN_CITATION,
      path: "openspec/specs/spectre-storage/no-such-file.md",
    }),
  ).toContain("no such file");
  expect(
    unresolvedCitation({ ...KNOWN_CITATION, heading: "A requirement nobody wrote" }),
  ).toContain("no requirement with that heading");

  // **And the line window, both ways round the heading**, which is the only check that reads a cited
  // line rather than a cited path. The first is a line that has drifted into the requirement *after*
  // this one; the second is a line that has drifted above it.
  const driftedPast = unresolvedCitation({ ...KNOWN_CITATION, line: KNOWN_CITATION.line + 400 });
  expect(driftedPast, "a cited line hundreds of lines past its heading is not reported").toContain(
    "past its heading",
  );
  expect(
    unresolvedCitation({ ...KNOWN_CITATION, line: 1 }),
    "a cited line above the heading it names is not reported",
  ).toContain("names a line above the heading");

  // **And the one case the window above cannot reach, which is why it needed its own plant.**
  //
  // `KNOWN_CITATION`'s requirement is followed by the next one **100 lines** later, so for that
  // citation every line inside the 40-line window is automatically *before* the next heading: the window
  // check always fires first and the "at or past the next requirement" check is unreachable. **An arm
  // aimed at that check using this citation proves nothing, and it proved nothing when it was run** —
  // the guard was deleted and the case stayed green.
  //
  // So the plant below names a pair of requirements **12 lines apart**, and cites the line the next
  // heading sits on. That is 12 lines past its own heading, so the window is satisfied, and it is at the
  // next requirement, so the other check is not. **Only that check can report it**, which is what makes
  // this plant falsifiable rather than decorative.
  //
  // **And the line it cites is READ from the file, not typed.** The plant used to name it as the
  // number 128, **and a promotion that added a requirement moved the heading** — so the citation went
  // from *twelve lines past* the requirement to *ten lines above* it, and the arm was aimed at a
  // different check. **A line number typed into a test is a claim about a file that any edit above it
  // falsifies**, and this repository has recorded that shape twice: once for `docs/SECURITY.md`'s own
  // citations, and once for this file's count of the boundary suite's assertions.
  //
  // **The line is found by an independent scan of the file's lines** — not through the citation
  // reader's own heading finder, because a control that calls the reader is a control on the
  // reader's helper and not on the reader.
  expect(
    unresolvedCitation({
      capability: "build-and-verification",
      heading: "The website development server starts",
      path: "openspec/specs/build-and-verification/spec.md",
      line: lineOfNextRequirementHeading(
        "openspec/specs/build-and-verification/spec.md",
        "The website development server starts",
      ),
    }),
    "a citation pointing at the NEXT requirement's heading is not reported",
  ).toContain("inside another requirement");
});

test("every citation the audit makes resolves, and each is reported by name when it does not", () => {
  // **Non-vacuity first.** A document that cited nothing at all would satisfy the assertion below, and
  // that is not a smaller version of the claim — it is the opposite of it.
  const citationCount = AUDIT_ROWS.reduce((total, row) => total + row.citations.length, 0);
  expect(citationCount, "the audit cites no requirement at all").toBeGreaterThan(0);

  expect(
    unresolvedCitationsIn(AUDIT_ROWS),
    "citations that resolve to nothing. The window is declared in this file, not chosen per citation.",
  ).toEqual([]);

  // **Every cited line is inside its own requirement's block**, which is the whole of the line-number
  // check: at or after the heading, and before the next requirement heading. Reported per citation so a
  // drift is named rather than summed.
  const distances = AUDIT_ROWS.flatMap((row) =>
    row.citations.map((citation) => {
      const headings = headingsWithin(repositoryLines(citation.path)).filter(
        (entry) => entry.depth === 3 && entry.text === `Requirement: ${citation.heading}`,
      );
      const headingLine = headings[0]?.line ?? citation.line;
      return { name: citationName(citation), distance: citation.line - headingLine };
    }),
  );

  expect(
    distances.filter(({ distance }) => distance > CITATION_LINE_WINDOW).map(({ name }) => name),
    `citations past the declared window of ${CITATION_LINE_WINDOW} lines from their heading`,
  ).toEqual([]);
});

test("a planted unresolvable citation is reported by the reader the case above uses", () => {
  // **One function, called by both halves.** Re-deriving the rows from the document inline here would
  // make this a second, independent use of the same readers — and a mutation of a reader would then be
  // invisible to it, which is the defect `privacy-disclosure.test.ts` recorded in its own reader for
  // exactly this case. The row is built from the document's own first row and named separately.
  const plantedRows: AuditRow[] = [
    ...AUDIT_ROWS,
    {
      area: "planted area",
      verdict: "closed",
      requirementCell:
        "`spectre-storage` — _A requirement that does not exist anywhere in this repository_ (`openspec/specs/spectre-storage/spec.md:1`)",
      instrumentCell: "",
      citations: [],
    },
  ];
  plantedRows[plantedRows.length - 1] = {
    ...plantedRows[plantedRows.length - 1]!,
    citations: citationsWithin(
      "`spectre-storage` — _A requirement that does not exist anywhere in this repository_ (`openspec/specs/spectre-storage/spec.md:1`)",
    ),
  };

  expect(
    plantedRows[plantedRows.length - 1]?.citations,
    "the control did not parse its own plant",
  ).toHaveLength(1);

  // **Filtered to the planted citation, and the reason is a falsification run.** This read
  // `toHaveLength(1)` over a list built from **the document's own rows plus** the plant, so renaming a
  // heading anywhere in `docs/SECURITY.md` — a defect the case above exists to report — made this case
  // go red beside it, with a failure message that said nothing about the plant. **The claim is "the
  // reader reports _this_ citation", and an exact count over a corpus the document also feeds is a
  // claim about the document.** The non-vacuity of the whole list is asserted by the case above.
  expect(
    unresolvedCitationsIn(plantedRows).filter((name) =>
      name.includes("A requirement that does not exist anywhere in this repository"),
    ),
    "a planted citation that resolves to nothing is not reported by the reader the case above uses",
  ).toHaveLength(1);
});

test("a row with neither a requirement nor an instrument leaves this file green, per D5", () => {
  // **The tolerance, asserted rather than assumed.** `design.md` D5 and task 3.2 say the instrument
  // does not require coverage, because an area with no requirement is the audit's **finding**. An
  // instrument that failed on one would be useless precisely when the audit had something to report —
  // so this case plants that row and requires the checks to stay quiet about it.
  const withoutRequirement: AuditRow = {
    area: "an area with no requirement",
    verdict: "closed",
    requirementCell: "No requirement in this repository governs this area.",
    instrumentCell: "",
    citations: [],
  };
  const withoutInstrument: AuditRow = { ...withoutRequirement, area: "an area with no instrument" };

  // **Both tolerances, each by its own reader**, and the instrument column's tolerance is the one that
  // needs stating: §3 says a row with no instrument has no evidence behind it, and the reader only
  // checks the tokens that are **present**.
  expect(unresolvedCitationsIn([withoutRequirement, withoutInstrument])).toEqual([]);
  expect(unexplainedRequirementTokens([withoutRequirement, withoutInstrument])).toEqual([]);
  expect(unresolvableInstrumentPaths([withoutRequirement, withoutInstrument])).toEqual([]);

  // **And the document says so in its own words**, because an instrument that tolerates something the
  // document does not mention is a tolerance nobody was told about. §4 carries the sentence.
  expect(AUDIT_LINES.join("\n")).toContain(
    "An area with no requirement governing it does not fail",
  );
});

/* ================================================================================================ *
 * 4. THE INSTRUMENT COLUMN. Paths that exist, and nothing else.
 * ================================================================================================ */

test("every instrument the audit names is a path this repository holds", () => {
  const tokens = AUDIT_ROWS.flatMap((row) => backtickedTokensWithin(row.instrumentCell));

  // **Non-vacuity before the absence**, for the same reason as everywhere else: a document with an
  // empty instrument column would satisfy "every instrument resolves" while naming no instrument at all.
  expect(tokens.length, "the audit names no instrument in any row").toBeGreaterThan(0);

  expect(
    unresolvableInstrumentPaths(AUDIT_ROWS),
    "backticked tokens in an instrument column that are not a repository path that exists",
  ).toEqual([]);
});

test("a planted token that is not an openable path is reported by the reader the case above uses", () => {
  const plantedRow: AuditRow = {
    ...(AUDIT_ROWS[0] as AuditRow),
    instrumentCell:
      "`apps/extension/src/protocol.test.ts`, `apps/extension/src/no-such-file.test.ts`, `SOME_CONSTANT`",
  };

  expect(
    unresolvableInstrumentPaths([plantedRow]),
    "the planted tokens are not reported by the reader the case above uses",
  ).toEqual([
    "provider credentials / apps/extension/src/no-such-file.test.ts",
    "provider credentials / SOME_CONSTANT",
  ]);
});

test("every backticked token in a requirement cell belongs to one of that cell's citations", () => {
  expect(
    unexplainedRequirementTokens(AUDIT_ROWS),
    "backticked tokens in a requirement cell that are not a citation's capability or its path:line",
  ).toEqual([]);

  // **The control, in the shape a narrower citation grammar takes.** A cell carrying a token that its
  // citation does not account for is what a pattern that stopped matching part of the grammar produces,
  // and it is also what a stray `` `FOLLOWABLE_PROTOCOLS` `` in a requirement cell would produce — which
  // is the token `docs/SECURITY.md` §3 records having removed from this document for exactly that
  // reason.
  const plantedCell =
    "`spectre-storage` — _What this device holds can be removed on request_ (`openspec/specs/spectre-storage/spec.md:288`); `packages/mail-parser/src/detect-links.ts`";

  expect(
    unexplainedRequirementTokens([
      {
        area: "planted",
        verdict: "closed",
        requirementCell: plantedCell,
        instrumentCell: "",
        citations: citationsWithin(plantedCell),
      },
    ]),
    "a token a citation does not account for is not reported",
  ).toEqual(["planted / packages/mail-parser/src/detect-links.ts"]);
});

/* ================================================================================================ *
 * 5. THE AUDIT'S OWN CONSTRAINTS: D8's no-restatement rule, and D9's declared vocabulary.
 * ================================================================================================ */

test("the audit names no provider credential field, and the names come from packages/core", () => {
  // **The rule is derived, so this file cannot be the place a field name is written down.** `D3`'s
  // reasoning applies to a forbidden list exactly as it applies to an allowed one: a retyped list is a
  // list that can drift, and this repository has recorded that shape three times.
  expect(
    CREDENTIAL_FIELDS.size,
    "no credential field name was read from packages/core, so the check below is vacuous",
  ).toBeGreaterThan(0);
  expect(
    [...CREDENTIAL_FIELDS].filter((name) => SHARED_CREDENTIAL_FIELDS.has(name)),
    "a member every variant declares was read as a credential field",
  ).toEqual([]);

  const named = [...CREDENTIAL_FIELDS].filter(
    (name) => wordOccurrencesIn(AUDIT_LINES.join("\n"), name) > 0,
  );
  expect(
    named,
    `credential field names the audit restates. ${AUDIT_PATH} links to docs/PRIVACY.md for what a credential is, per D8.`,
  ).toEqual([]);
});

test("the credential reader brings in a field planted into packages/core, and reports one in the audit", () => {
  // **Two controls, aimed at the two assertions above, and the first is the derivation.** A parse that
  // returned nothing would satisfy "the audit names no credential field" perfectly, and would also
  // satisfy the non-vacuity assertion while finding nothing — so a field is planted into a **copy** of
  // `packages/core` and the same derivation is required to bring it in.
  const plantedSource = CREDENTIALS_SOURCE.replace(
    "  readonly sessionId: string;",
    "  readonly sessionId: string;\n  readonly mailboxPassword: string;",
  );
  expect(plantedSource, "the planted field was not planted into the copy").not.toBe(
    CREDENTIALS_SOURCE,
  );

  const plantedFields = credentialFieldNamesIn(plantedSource);
  expect(
    [...plantedFields].filter((name) => !CREDENTIAL_FIELDS.has(name)),
    "the planted field is not reported by the derivation the case above uses",
  ).toEqual(["mailboxPassword"]);
  expect(
    [...plantedFields].filter((name) => sharedCredentialFieldsIn(plantedSource).has(name)),
    "the planted field was classified as shared",
  ).toEqual([]);

  // **The second control is aimed at the forbidden reader itself**, and it uses a **derived** name
  // rather than a retyped one, so the control cannot drift from the rule in the same way a list would.
  const plantedName = [...CREDENTIAL_FIELDS][0] ?? "";
  expect(plantedName, "no credential field name is available to plant").not.toBe("");
  expect(
    wordOccurrencesIn(AUDIT_LINES.join("\n"), plantedName),
    "the audit names a credential field, so the control below would prove nothing",
  ).toBe(0);
  expect(
    wordOccurrencesIn(`A planted sentence about ${plantedName}.\n`, plantedName),
    "the forbidden reader does not see a credential field name planted into the audit",
  ).toBe(1);

  // **And the word-boundary half, because a reader that counted substrings would report the plural of
  // a field name as the field name** — which is a red gate on a sentence that never named one.
  expect(wordOccurrencesIn(`${plantedName}s and ${plantedName}`, plantedName)).toBe(1);
});

/* ================================================================================================ *
 * 6. THIS FILE'S OWN SHAPE. No shared reader, and no pattern beyond the declared three.
 * ================================================================================================ */

/**
 * The module names of the two suites this file must share no reader with, assembled rather than written.
 *
 * A literal would defeat the case it serves: an import specifier is a **string**, and this check has to
 * read text with strings intact, so the needle it looks for is the very text its own declaration would
 * contain. **A check that has to name what it forbids cannot hold that name contiguously in its own
 * source.**
 */
const OTHER_SUITE_MODULES: readonly string[] = [
  ["boundaries", "test"].join("."),
  ["privacy", "disclosure", "test"].join("."),
];

/**
 * Every regular-expression literal this file contains, read through the TypeScript parser.
 *
 * **A parser rather than a character scanner**, which is both shorter and the direction this repository
 * has needed most often: a scanner that counts a `/` inside a path or a markdown fragment as a pattern
 * fires on its own documentation, and one that stops at the first `//` in a string reports nothing. The
 * parser cannot tell a pattern from text, because a pattern **is** a node kind.
 */
function regexLiteralsIn(source: string): string[] {
  const parsed = ts.createSourceFile("self.ts", source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];

  const walk = (node: ts.Node): void => {
    if (ts.isRegularExpressionLiteral(node)) {
      found.push(node.text);
    }
    node.forEachChild(walk);
  };
  walk(parsed);

  return found;
}

/** Every module specifier a source imports, as written. */
function importedSpecifiersIn(source: string): string[] {
  const parsed = ts.createSourceFile("imports.ts", source, ts.ScriptTarget.Latest, true);

  return parsed.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  );
}

/**
 * A function body qualifies as a **reader** for the independence check when it holds more than one
 * statement.
 *
 * **One statement is an incantation rather than a reader**, and all three architecture suites read a
 * repository file the same one-expression way — `readFileSync(join(REPO_ROOT, path), "utf8")` — so
 * **the first version of this check reported exactly that and nothing else**, which is the recorded
 * shape of a check whose only findings are typography. Rewriting a working reader so that it differs
 * from another's would be contorting code to please a check; the check declares what it is looking for
 * instead. **The limit is stated here rather than left to be discovered by the next copy that
 * matters**, and the import-specifier check above — which has no such threshold — is the one that
 * holds unconditionally.
 */
const READER_MINIMUM_STATEMENTS = 2;

/** Every function declaration's full text, at any depth, narrowed to those that could be a reader. */
function functionBodiesIn(source: string): string[] {
  const parsed = ts.createSourceFile("bodies.ts", source, ts.ScriptTarget.Latest, true);
  const bodies: string[] = [];

  const walk = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.body !== undefined &&
      ts.isBlock(node.body) &&
      node.body.statements.length >= READER_MINIMUM_STATEMENTS
    ) {
      bodies.push(node.body.getText(parsed));
    }
    node.forEachChild(walk);
  };
  walk(parsed);

  return bodies;
}

/**
 * The complete set of regular-expression literals this file is allowed to contain.
 *
 * **Three entries, and that number is the point.** Each is **structural** — markdown shape, this
 * file's own citation and token syntax — and none is handed a requirement's words as its input, which is
 * what `design.md` D3 rejects for the audit's instrument and what the header's rule 1 states here. A
 * fourth pattern has to be added to this list, which makes adding one a decision somebody has to look at.
 *
 * **What this check does not establish, said here so it is not read as more than it is.** It establishes
 * that every pattern in the file is declared and structural. It does not establish that a declared
 * pattern is harmless, and it does not establish rule 1 — that claim is held by the **shape** of the
 * comparisons above, which are equality against a heading read out of the specification file.
 */
const ALLOWED_PATTERNS: readonly string[] = [
  // -- line numbering, which is what makes a `(path:line)` citation openable at all ---------------
  "/\\r?\\n/",
  // -- this file's own token syntax, with every backtick written as \x60 --------------------------------
  // The citation grammar, in full: capability, em dash, `_heading_`, `(path:line)`. **The underscores
  // are Prettier's markdown emphasis, not a preference**: `format:check` rewrites `*heading*`, and a
  // grammar written against the asterisk resolved none of the eighteen citations on its first run. A
  // literal backtick in either pattern would desynchronise `boundaries.test.ts`'s `stripComments` for
  // the rest of this file, which has no state for a regular-expression literal — see the header.
  "/\\x60([a-z0-9][a-z0-9-]*)\\x60 — _([^_]+)_ \\(\\x60([^\\x60]+):(\\d+)\\x60\\)/g",
  "/\\x60([^\\x60]+)\\x60/g",
];

const AUDIT_SOURCE = readRepositoryFile("tests/architecture/security-audit.test.ts");
const OTHER_SUITE_SOURCES: readonly string[] = [
  readRepositoryFile("tests/architecture/boundaries.test.ts"),
  readRepositoryFile("tests/architecture/privacy-disclosure.test.ts"),
];

test("this file contains no pattern beyond the declared three", () => {
  const found = regexLiteralsIn(AUDIT_SOURCE);

  expect(
    found.filter((pattern) => !ALLOWED_PATTERNS.includes(pattern)),
    "regular-expression literals in this file that are not in the structural allow-list",
  ).toEqual([]);
  expect(
    ALLOWED_PATTERNS.filter((pattern) => !found.includes(pattern)),
    "declared patterns this file no longer contains, which is how a stale allow-list entry is found",
  ).toEqual([]);

  // **And none of them holds a backtick**, which is the property the header states and the one the
  // boundary suite's own reader is unable to survive. Asserted here rather than left to the allow-list,
  // because an allow-list entry is a *declaration* and this is the *consequence*.
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

test("this file shares no reader with the other two architecture suites", () => {
  // **Two checks, because the two claims have different shapes.** An *import specifier* is a string and
  // is read as one; a *function body* is code and is compared whole, which catches a copy as well as an
  // import — a shared body is a shared reader wearing a different name.
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

  // **Both controls, through the same functions the assertions above use.** A control that calls the
  // reader is not a control on the assertion; it is a second use of the same reader, and a mutation of
  // the first is invisible to it. **The planted import is a type-only import on purpose**, so it is
  // erased before the file runs and the case reaches its assertion rather than failing to collect —
  // a mutation that stopped the file loading would be caught, but not by the assertion it is aimed at.
  const plantedImport = `import type { BoundariesViolations } from "./${OTHER_SUITE_MODULES[0]}";`;
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
  expect(OTHER_SUITE_SOURCES.length, "no other suite was read to compare against").toBe(2);
  expect(otherBodies.length, "the other two suites declare no function to share").toBeGreaterThan(
    0,
  );
});

test("the boundary suite's assertion count is declared, and the count moved when a case was added", () => {
  // **The count is read out of `boundaries.test.ts` itself**, through this file's own parser, rather
  // than asserted as a number typed here — because a number typed here is a number that stops being
  // checked the moment the suite moves. **This figure was 53, then 54, and it is 55**: the
  // `architecture-suite-isolation` change added the staged-probe vocabulary's completeness check,
  // and `firefox-compatibility-spike` added the discriminator's own control — **and the figure moved
  // with the thing it counts, both times.**
  //
  // **And the prediction this file used to carry is now recorded as what it was and what it
  // became.** The prediction was that the count would stay at 53, because every property that
  // change introduced already had an instrument: the credential boundary is a value-level map
  // rather than a structural one, and the rendering boundary is a rule that was already there.
  // **That reasoning still holds for the properties it was about, and it did not hold for the
  // vocabulary's completeness check** — which is a property no instrument had, because a list
  // nobody checks is a list that drifts.
  //
  // **And the second move was the same shape.** The Firefox spike did not add a *rule* so much as
  // it amended one — **and the amendment needed a control of its own**, because the rule's new
  // assertion (a probe must load through exactly one engine) **cannot be reached by editing the
  // list**, because the list holds probes that exist. **A check that cannot fail for the reason it
  // exists is not a check**, and the control is what makes the partition falsifiable.
  //
  // **So the count moved, and the title of this test moved with it.** A test whose title names a
  // number the assertion no longer expects is a test that reads as a claim about something else,
  // and **this file's own claim is that the count is checked rather than carried**.
  const parsed = ts.createSourceFile(
    "boundaries.ts",
    OTHER_SUITE_SOURCES[0] ?? "",
    ts.ScriptTarget.Latest,
    true,
  );
  let cases = 0;
  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "it"
    ) {
      cases += 1;
    }
    node.forEachChild(walk);
  };
  walk(parsed);

  // **The count moved from 54 to 55, and this is the record of why.** The boundary suite gained
  // one case — the discriminator's own control — so the figure this file declares moved with it.
  // **A declared count that does not move when the thing it counts moves is a count nobody has
  // re-read**, and this file's claim is that the count is read from the source rather than carried
  // by hand.
  expect(cases, "the boundary suite's case count, read from its own source").toBe(55);
});
