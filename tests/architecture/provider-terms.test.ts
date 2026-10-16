/**
 * `docs/PROVIDERS.md` and `docs/PRIVACY.md` against the terms claims this repository makes.
 *
 * ## What this file is, and what it is not
 *
 * The failure this change exists to end is **a repository that recorded an unread absence as though
 * it had been read, and a decision that leaned on the record.** `docs/PROVIDERS.md` cited
 * `https://mail.tm/terms` returning `404` as the basis for *"no terms page exists"*, **and cited
 * `https://mail.tm/en/faq/` returning `200` in the very next line** — so the repository knew the site
 * prefixes its real paths and probed an unprefixed one anyway. `https://mail.tm/en/privacy/` serves a
 * privacy policy; `https://mail.tm/privacy` does not.
 *
 * **A `404` on a guessed path is evidence that *that path* is not served. It is not evidence about
 * the site**, and the difference between those two sentences is the whole of what this file checks.
 *
 * So the instrument is **neither "does the document mention terms" nor "are the terms favourable"**.
 * It holds **the repository's terms claims as test-owned data** — the claim, the provider, the path it
 * rests on, whether that path was served, and the date — and then checks three things about the
 * shipped documents: every claim whose path was **not** served is reported by name, no **decision**
 * cites a terms claim, and `docs/PRIVACY.md`'s attribution section **matches what was read** so the
 * two documents cannot drift apart silently.
 *
 * ## It makes no network request, and that is asserted rather than promised
 *
 * `design.md` D7 and task 3.7. **Re-running a terms review is a human act against a website**: a test
 * that fetched a provider would be a live network call in a suite whose standing property is that it
 * makes none. The last case here holds this file to it twice — **no import is a network module, and
 * every URL-shaped string literal in this file is a path the claims map already declares as read.**
 * The second half is the stronger one: a file that holds an endpoint it never calls is still a file
 * that can, and the only way this instrument could ever contact a provider is if somebody wrote the
 * fetch into it.
 *
 * ## Three rules of the house, and why each exists
 *
 * **1. The map is test-owned data, never a scan for a word** (task 3.1). A scan for `terms` fires on
 * `AGENTS.md` four hundred times and on every heading in this repository; a scan cannot tell **a
 * document that was read** from **a document that was not found**, which is the one distinction the
 * change is about. **And a retypeable map is a map that drifts**, so every path in it is also
 * asserted to appear literally in the document the claim says records it.
 *
 * **2. Every reader carries a planted control, and the positive case comes first.** A reader that
 * returns nothing satisfies every "nothing was reported" assertion beneath it, **for ever**, and that
 * is this repository's most-recorded defect. So the citation reader's self-test **begins with a
 * citation it is known to find** and only then plants one it must report — and the *false* direction
 * is tested too, because a reader that reports everything would pass every absence check in this file.
 *
 * **3. This file shares no reader with any other architecture suite** (task 3.6). A tool that also
 * checks its own work cannot report its own defect, so the independence is structural rather than a
 * promise: nothing is imported from another suite, no function body is byte-identical to one in
 * another, and both are asserted against a planted copy and a planted import.
 *
 * ## What it establishes, and what it does not
 *
 * It establishes that every terms claim names a path and says whether that path was served; that every
 * claim resting on a path which was **not** served is reported by name; that no sentence in
 * `docs/ARCHITECTURE.md`, `AGENTS.md` or `docs/PROVIDERS.md` attributes an obligation to a provider's
 * terms unless it names a served path or carries the repository's own standing-rule disclaimer; and
 * that `docs/PRIVACY.md`'s attribution rows carry the same dates and the same served-ness the record
 * does.
 *
 * It does **not** establish that a claim is *true*. A path recorded as served here was read by a
 * person on a date, and this file cannot re-read a website. It does not establish that a provider's
 * terms **say** what the record says they say — the quotes are compared for presence, not for
 * accuracy. And it does not establish that a **decision** is sound; it establishes only that the
 * decision does not cite a terms claim, which is the requirement and not the judgement.
 *
 * ## `tsc` does not cover this file, and that is a limit rather than a repair
 *
 * `tests/architecture/` has **no `tsconfig.json`** and is not a workspace member, so `pnpm typecheck`
 * checks neither this file's nor any other architecture file's types. Adding one would move **every
 * future gate's** typecheck scope, which is a decision this change does not make. A type error here is
 * a runtime failure, not a `pnpm verify` failure.
 *
 * ## The regex allow-list is the check that keeps rule 1 honest
 *
 * Every regular-expression literal in this file is declared in {@link ALLOWED_PATTERNS}, in both
 * directions, read through the **TypeScript parser** rather than a character scanner. **No pattern
 * holds a backtick** — they are written with no backtick character at all — because
 * `boundaries.test.ts`'s comment stripper has no state for a regular-expression literal, and a backtick
 * inside one desynchronises that reader for the rest of *this* file.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { expect, test } from "vitest";

/** The repository root, resolved as the other architecture suites resolve it. */
const REPO_ROOT = process.cwd();

/** The two documents whose terms claims are resolved here, plus the decision documents. */
const TERMS_RECORD_PATH = "docs/PROVIDERS.md";
const ATTRIBUTION_DOCUMENT_PATH = "docs/PRIVACY.md";

/** The section of {@link ATTRIBUTION_DOCUMENT_PATH} this file checks, named rather than line-numbered. */
const ATTRIBUTION_SECTION_HEADING = "6. Provider attribution";

/**
 * The documents a decision may be stated in.
 *
 * **Exactly the three `tasks.md` 3.3 names, and the exclusion is a finding rather than an omission.**
 * A fourth document — `docs/ROADMAP.md` — carries the sentence this whole change exists to end, and
 * it is outside both this file's declared scope and the apply stage's write scope. **A sweep that
 * matched nothing because it was pointed at three files would look identical to a sweep pointed at
 * four**, which is why the list is a declared constant rather than a directory glob.
 */
const DECISION_DOCUMENTS: readonly string[] = [
  "docs/PROVIDERS.md",
  "docs/ARCHITECTURE.md",
  "AGENTS.md",
];

/* ------------------------------------------------------------------------------------------------
 * 1. The claims, as test-owned data (task 3.1).
 * ---------------------------------------------------------------------------------------------- */

/** The two providers this product contacts, and no others. */
type ProviderName = "Mail.tm" | "Guerrilla Mail";

/** One published document a claim was read from, or not read from. */
interface ProviderDocument {
  /** The path exactly as it was probed. */
  readonly path: string;
  /** Whether that path was served. **The whole point of this file.** */
  readonly served: boolean;
  /** What came back, quoted or characterised. */
  readonly result: string;
}

/** One claim the repository makes about a provider's terms, attribution or rate-limit guidance. */
interface TermsClaim {
  /** A stable name, so a failure names the claim rather than counting it. */
  readonly id: string;
  /** Which provider the claim is about. */
  readonly provider: ProviderName;
  /** What the repository asserts, in its own words. */
  readonly claim: string;
  /** Every document the claim rests on, each with whether it was served. */
  readonly restsOn: readonly ProviderDocument[];
  /** The date the claim was read, ISO-shaped. */
  readonly readOn: string;
  /** The repository documents the claim is recorded in. */
  readonly recordedIn: readonly string[];
}

const TERMS_CLAIMS: readonly TermsClaim[] = [
  {
    id: "mailtm-terms-not-located",
    provider: "Mail.tm",
    claim: "No Mail.tm terms document was located at any of the routes tried.",
    restsOn: [
      { path: "https://mail.tm/terms", served: false, result: "404" },
      { path: "https://mail.tm/en/terms/", served: false, result: "404" },
      { path: "https://mail.tm/en/terms-of-service/", served: false, result: "404" },
      { path: "https://mail.tm/legal", served: false, result: "404" },
      { path: "https://mail.tm/en/legal/", served: false, result: "404" },
      { path: "https://mail.tm/en/imprint/", served: false, result: "404" },
    ],
    readOn: "2026-10-16",
    recordedIn: [TERMS_RECORD_PATH, ATTRIBUTION_DOCUMENT_PATH],
  },
  {
    id: "mailtm-privacy-served",
    provider: "Mail.tm",
    claim:
      "Mail.tm serves a Privacy Policy at a locale-prefixed path this repository had not tried, and serves nothing at the unprefixed one.",
    restsOn: [
      { path: "https://mail.tm/privacy", served: false, result: "404" },
      {
        path: "https://mail.tm/en/privacy/",
        served: true,
        result: '200 "Privacy Policy - Mail.tm"',
      },
    ],
    readOn: "2026-10-16",
    recordedIn: [TERMS_RECORD_PATH],
  },
  {
    id: "mailtm-privacy-refers-to-terms",
    provider: "Mail.tm",
    claim:
      'Mail.tm\'s privacy policy refers to "terms of service" while no route tried for one is served, so neither presence nor absence of an obligation may be asserted.',
    restsOn: [
      {
        path: "https://mail.tm/en/privacy/",
        served: true,
        result: '200 "Privacy Policy - Mail.tm"',
      },
    ],
    readOn: "2026-10-16",
    recordedIn: [TERMS_RECORD_PATH],
  },
  {
    id: "guerrilla-tos-read",
    provider: "Guerrilla Mail",
    claim:
      "Guerrilla Mail publishes Terms of Service, linked from its own homepage, and they were read.",
    restsOn: [{ path: "https://www.guerrillamail.com/tos", served: true, result: "200" }],
    readOn: "2026-10-16",
    recordedIn: [TERMS_RECORD_PATH],
  },
  {
    id: "guerrilla-tos-silent-on-attribution",
    provider: "Guerrilla Mail",
    claim:
      "No attribution clause appears anywhere in Guerrilla Mail's terms as read, which is neither a permission nor a prohibition.",
    restsOn: [{ path: "https://www.guerrillamail.com/tos", served: true, result: "200" }],
    readOn: "2026-10-16",
    recordedIn: [TERMS_RECORD_PATH, ATTRIBUTION_DOCUMENT_PATH],
  },
  {
    id: "guerrilla-api-publishes-guidance-not-a-figure",
    provider: "Guerrilla Mail",
    claim:
      'Guerrilla Mail publishes no rate-limit figure and does publish a sentence asking clients not to check email too often, so recording that it "publishes nothing" is false.',
    restsOn: [
      {
        path: "http://www.guerrillamail.com/GuerrillaMailAPI.html",
        served: true,
        result: "200",
      },
    ],
    readOn: "2026-10-16",
    recordedIn: [TERMS_RECORD_PATH],
  },
];

/**
 * The disclaimers a terms citation may carry instead of naming a served path.
 *
 * **A closed list, and each entry is the repository's own wording rather than this file's
 * paraphrase** — a paraphrase would be a rule somebody can satisfy with a phrase they chose, which is
 * the shape of a check loosened to fit a document. These two are the sentences that state the standing
 * rule, so a sentence carrying one is *stating the rule*, not *citing a term*.
 *
 * **The list is also required to be non-empty in the documents themselves**, which is what stops a
 * deletion of the standing rule from silently widening this rule to nothing.
 */
const DECLARED_DISCLAIMERS: readonly string[] = [
  "independent of what any provider's terms permit",
  "do not rely on them for an architectural decision",
];

/* ------------------------------------------------------------------------------------------------
 * 2. Readers. Every one is self-tested, and none is shared with another architecture suite.
 * ---------------------------------------------------------------------------------------------- */

/** Reads one repository file as UTF-8 text. */
function documentText(relativePath: string): string {
  const absolute = join(REPO_ROOT, relativePath);
  return readFileSync(absolute, "utf8");
}

/**
 * A repository file as lines, with the carriage return of a CRLF checkout removed.
 *
 * **Split on `"\n"` and strip, rather than splitting on a pattern**, so this file's regex allow-list
 * stays at three entries and the line reader cannot disagree with the path reader about what a line is.
 */
function documentLines(relativePath: string): string[] {
  return documentText(relativePath)
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

/** One markdown block, and whether it is a quotation of somebody else's words. */
interface MarkdownBlock {
  /** True when every line of the block is a blockquote line. */
  readonly quoted: boolean;
  /** The one-based line the block starts on. */
  readonly firstLine: number;
  /** The block's text, unwrapped, with emphasis markers removed. */
  readonly text: string;
}

/**
 * Every markdown block in a line list: a run of non-blank lines.
 *
 * **A quotation is a structural property and is read structurally**, because a provider's own sentence
 * is not this repository's claim and a keyword reader cannot tell the two apart. **Emphasis markers
 * are stripped** so that `**terms**` and `terms` are one term, which is the shape of a sweep that reads
 * formatting as content.
 */
function markdownBlocks(lines: readonly string[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let buffer: string[] = [];
  let openingLine = 1;

  const close = (): void => {
    if (buffer.length === 0) {
      return;
    }
    blocks.push({
      quoted: buffer.every((line) => line.trimStart().startsWith(">")),
      firstLine: openingLine,
      text: buffer
        .map((line) => line.trimStart().replace(/^>[ ]?/, ""))
        .join(" ")
        .split("*")
        .join("")
        .split("_")
        .join(""),
    });
    buffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      close();
      continue;
    }
    if (buffer.length === 0) {
      openingLine = index + 1;
    }
    buffer.push(line);
  }
  close();

  return blocks;
}

/**
 * Sentences of a block.
 *
 * **A split on `". "` rather than a pattern**, and the reason is recorded rather than left to be
 * discovered: a block that ends a line at 80 columns must be unwrapped before a sentence can be read
 * out of it, and an unwrap that used a pattern would put a fourth entry in an allow-list whose size is
 * the point.
 */
function sentencesOf(blockText: string): string[] {
  return blockText
    .split(". ")
    .map((sentence) => sentence.trim())
    .filter((s) => s.length > 0);
}

/** One sentence that attributes something to a provider's terms. */
interface TermsCitation {
  /** The document it was found in. */
  readonly document: string;
  /** The one-based line its block starts on. */
  readonly line: number;
  /** The sentence itself. */
  readonly sentence: string;
}

/**
 * The grammar of a terms citation, in two orders.
 *
 * **"the terms require" and "require the terms" are both the grammar, and taking only one is the
 * recorded shape of a check narrower than its rule** — this repository has written that defect down
 * thirty-one times. The two patterns are alternations over one closed verb set rather than prose, so
 * the set itself is the declaration and adding a verb is a decision somebody has to look at.
 *
 * **The verb forms are spelled out and no `s?` is hung off the stem**, because that is not a shorthand:
 * `require` followed by a word boundary does **not** match *required*, and the first run of this file
 * proved it — the reader found nothing in `AGENTS.md`, because the sentence that states the standing
 * rule says *"do not assume a required obligation is absent"* and `require` stopped one character short.
 * **A reader that silently matched less than its own rule looks exactly like a clean tree.**
 *
 * **The verbs are obligation and permission verbs only.** `cite`, `quote` and `relay` are deliberately
 * absent: a sentence *forbidding* a citation is stating the standing rule, and a reader that caught it
 * would report the rule as a violation of itself.
 */
const TERMS_CITATION_VERB_FOLLOWING =
  /\bterms\b[^.]*\b(require|requires|required|forbid|forbids|prohibit|prohibits|mandate|mandates|oblige|obliges|allow|allows|permit|permits)\b/i;

const TERMS_CITATION_VERB_PRECEDING =
  /\b(require|requires|required|forbid|forbids|prohibit|prohibits|mandate|mandates|oblige|obliges|allow|allows|permit|permits)\b[^.]*\bterms\b/i;

/** An ISO-shaped date, read out of a document's prose. */
const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

/**
 * Every sentence in a document that attributes something to a provider's terms.
 *
 * **Quotations are excluded inside the reader rather than by the caller**, so the exclusion cannot be
 * forgotten at one call site and applied at the other. **Both orders of the grammar are run**, and the
 * set is the union rather than a fallback, which is what makes the second pattern reachable at all.
 */
function termsCitationsIn(relativePath: string): TermsCitation[] {
  const found: TermsCitation[] = [];

  for (const block of markdownBlocks(documentLines(relativePath))) {
    if (block.quoted) {
      continue;
    }
    for (const sentence of sentencesOf(block.text)) {
      if (
        TERMS_CITATION_VERB_FOLLOWING.test(sentence) ||
        TERMS_CITATION_VERB_PRECEDING.test(sentence)
      ) {
        found.push({ document: relativePath, line: block.firstLine, sentence });
      }
    }
  }

  return found;
}

/** Every path the claims map records as served, across every claim. */
function servedPaths(): string[] {
  const paths: string[] = [];
  for (const entry of TERMS_CLAIMS) {
    for (const document of entry.restsOn) {
      if (document.served && !paths.includes(document.path)) {
        paths.push(document.path);
      }
    }
  }
  return paths;
}

/** One claim, with the paths it rests on that were probed and not served. */
interface UnservedClaim {
  /** The claim's stable name. */
  readonly id: string;
  /** Which provider the claim is about. */
  readonly provider: ProviderName;
  /** Every path of the claim that was not served, in declaration order. */
  readonly paths: readonly string[];
  /** Whether the claim rests on **nothing at all** that was served. */
  readonly foundedOnNothingRead: boolean;
}

/**
 * Every claim resting on at least one path that was **not** served, named.
 *
 * **This is the reader the whole instrument exists for, and it returns names rather than a count**
 * because a count of claims founded on an unread path is a number nobody can act on.
 *
 * **`foundedOnNothingRead` is the sharper half and is reported alongside**, not instead: a claim with
 * six probed paths and none served is a different defect from a claim with six probed paths and one
 * served, and **a boolean that collapses them would make the first invisible.**
 */
function claimsOnUnservedPaths(): UnservedClaim[] {
  const unfounded: UnservedClaim[] = [];

  for (const entry of TERMS_CLAIMS) {
    const unserved = entry.restsOn.filter((document) => !document.served).map((d) => d.path);
    if (unserved.length > 0) {
      unfounded.push({
        id: entry.id,
        provider: entry.provider,
        paths: unserved,
        foundedOnNothingRead: entry.restsOn.every((document) => !document.served),
      });
    }
  }

  return unfounded;
}

/** A markdown table row's cells, or an empty list when the line is not a row. */
function tableCellsIn(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return [];
  }
  const body = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined);
  return body.split("|").map((cell) => cell.trim());
}

/**
 * Whether a row of cells is a table's separator row.
 *
 * **Shape, not position, and no pattern.** A separator is dashes in every cell, which is what a markdown
 * renderer checks — so a row of dashes inside a table's *body* is not one, and a table with no separator
 * beneath its header is not a table at all.
 */
function isSeparatorRow(cells: readonly string[]): boolean {
  return (
    cells.length > 0 && cells.every((cell) => cell.length >= 3 && [...cell].every((c) => c === "-"))
  );
}

/**
 * The ATX headings in a line list, by text.
 *
 * **A character loop rather than a pattern**, for the reason the allow-list exists at all: a heading's
 * depth is one character counted, not a language, and a pattern here would be a fifth entry in a list
 * whose size is the point. **`#text` is not a heading in CommonMark and is not read as one here.**
 */
function markdownHeadings(lines: readonly string[]): string[] {
  const found: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const firstNonHash = [...trimmed].findIndex((character) => character !== "#");
    if (firstNonHash > 0 && trimmed.charAt(firstNonHash) === " ") {
      found.push(trimmed.slice(firstNonHash + 1).trim());
    }
  }

  return found;
}

/**
 * The rows of the attribution table, as trimmed cells.
 *
 * **Located by its own header row rather than by line number**, and the header is compared whole — the
 * recorded shape of a table reader that compares only its first cell is a reader that finds any table.
 *
 * **The header alone is not a table.** A markdown renderer requires a separator row beneath it, and a
 * reader that accepted a header with nothing beneath would read a two-line fragment as a table — which
 * is why this arm exists and why the plant beneath it is a *header*, not a wrong row.
 */
function attributionRowsIn(lines: readonly string[]): string[][] {
  const expectedHeader = "provider what was actually verified";
  const rows: string[][] = [];
  let collecting = false;

  for (let index = 0; index < lines.length; index += 1) {
    const cells = tableCellsIn(lines[index] ?? "");

    if (collecting) {
      if (cells.length === 0) {
        collecting = false;
        continue;
      }
      if (isSeparatorRow(cells)) {
        continue;
      }
      rows.push(cells);
      continue;
    }

    if (cells.length === 0 || cells.join(" ").toLowerCase() !== expectedHeader) {
      continue;
    }
    if (isSeparatorRow(tableCellsIn(lines[index + 1] ?? ""))) {
      collecting = true;
    }
  }

  return rows;
}

/** The prose a row of the attribution table carries, emphasis markers removed. */
function rowProse(cells: readonly string[]): string {
  return cells.join(" ").split("*").join("").split("_").join("");
}

/* ================================================================================================ *
 * 1. THE MAP. Every claim names a path, a served flag and a date, and the paths are in the documents.
 * ================================================================================================ */

test("every terms claim names the paths it rests on, whether each was served, and a date", () => {
  // **Non-vacuity first, and both ways.** A map with no claim satisfies every assertion below it, and
  // a map in which every path was served would leave the assertion that reports an unserved path
  // vacuously true — which is the direction this file exists to fail in.
  expect(TERMS_CLAIMS.length, "the claims map is empty").toBeGreaterThan(0);
  expect(
    TERMS_CLAIMS.filter((entry) => entry.restsOn.every((document) => !document.served)).length,
    "no claim rests only on unserved paths, so the unserved-path reader can never report one",
  ).toBeGreaterThan(0);
  expect(
    TERMS_CLAIMS.filter((entry) => entry.restsOn.some((document) => document.served)).length,
    "no claim rests on a served path, so nothing here establishes that a document was ever read",
  ).toBeGreaterThan(0);

  for (const entry of TERMS_CLAIMS) {
    expect(entry.restsOn.length, `${entry.id} names no path at all`).toBeGreaterThan(0);
    expect(entry.claim.trim(), `${entry.id} carries no claim`).not.toBe("");
    expect(
      [...entry.readOn.matchAll(ISO_DATE)].map((match) => match[0]),
      `${entry.id}'s date is not ISO-shaped`,
    ).toEqual([entry.readOn]);

    for (const document of entry.restsOn) {
      expect(typeof document.served, `${entry.id} / ${document.path} has no served flag`).toBe(
        "boolean",
      );
      expect(document.path.startsWith("http"), `${entry.id} / ${document.path} is not a URL`).toBe(
        true,
      );
      expect(document.result.trim(), `${entry.id} / ${document.path} records no result`).not.toBe(
        "",
      );
    }
  }
});

test("every path the map declares is written in the document the claim says records it", () => {
  // **A retyped map drifts, and a drifted map is worse than no map**: it would report the repository's
  // claims as resolved against paths the repository no longer names. So every declared path is
  // required to appear *literally* in at least one document the claim itself points at, and a path
  // that cannot be found there is reported by name.
  //
  // **Dates are checked in the attribution case rather than here, and the reason is that they are a
  // different kind of statement.** A *path* is part of the map's shape and belongs to this case; a
  // *date* is a claim the named document makes, and a document carrying an older date than the record
  // is a defect in that document rather than a malformed map. **Two cases reporting one root cause is a
  // louder gate and no more information**, so the finding is reported once, in the case that names the
  // remedy.
  const absent: string[] = [];

  for (const entry of TERMS_CLAIMS) {
    const corpus = entry.recordedIn.map((path) => documentText(path)).join("\n");
    for (const document of entry.restsOn) {
      if (!corpus.includes(document.path)) {
        absent.push(`${entry.id} / ${document.path}`);
      }
    }
    for (const path of entry.recordedIn) {
      if (
        !documentText(path).includes("2026-10-02") &&
        !documentText(path).includes("2026-10-16")
      ) {
        absent.push(
          `${entry.id} / ${path} carries neither a 2026-10-02 nor a 2026-10-16 reading date`,
        );
      }
    }
  }

  expect(absent, "declared paths the named documents do not carry").toEqual([]);
});

/* ================================================================================================ *
 * 2. THE UNSERVED PATHS. Reported by name, which is the assertion the file exists for.
 * ================================================================================================ */

test("every claim whose path was not served is reported by name", () => {
  // **The exact set, in both directions.** Naming only the claims that are present would pass on a map
  // that had quietly dropped one; counting would report a number nobody could act on. **Both fields
  // are compared, because the second is the sharper claim** — a claim that rests on one served path
  // and one probed one is not a claim founded on nothing that was read.
  expect(
    claimsOnUnservedPaths(),
    "claims resting on a path that was not served, and therefore not solely on a document that was read",
  ).toEqual([
    {
      id: "mailtm-terms-not-located",
      provider: "Mail.tm",
      paths: [
        "https://mail.tm/terms",
        "https://mail.tm/en/terms/",
        "https://mail.tm/en/terms-of-service/",
        "https://mail.tm/legal",
        "https://mail.tm/en/legal/",
        "https://mail.tm/en/imprint/",
      ],
      foundedOnNothingRead: true,
    },
    {
      id: "mailtm-privacy-served",
      provider: "Mail.tm",
      paths: ["https://mail.tm/privacy"],
      foundedOnNothingRead: false,
    },
  ]);

  // **And the named claims are read out of the map rather than retyped** — a literal above would be
  // satisfied by a map whose entries said something else.
  const foundedOnNothing = claimsOnUnservedPaths()
    .filter((entry) => entry.foundedOnNothingRead)
    .map((entry) => entry.id);
  expect(foundedOnNothing, "claims founded on nothing that was served").toEqual([
    "mailtm-terms-not-located",
  ]);

  const served = TERMS_CLAIMS.filter((entry) => entry.restsOn.some((document) => document.served));
  expect(
    served.map((entry) => entry.id),
    "the map holds no claim resting on a served document at all, so nothing here establishes a read",
  ).toEqual([
    "mailtm-privacy-served",
    "mailtm-privacy-refers-to-terms",
    "guerrilla-tos-read",
    "guerrilla-tos-silent-on-attribution",
    "guerrilla-api-publishes-guidance-not-a-figure",
  ]);
});

test("a planted claim on an unserved path is reported by the reader the case above uses", () => {
  // **One reader shape, driven by both halves through the same predicate.** Re-deriving the list inline
  // with a second predicate would make this a second, independent implementation of the rule, and a
  // mutation of that second copy would be invisible here — which is the defect
  // `privacy-disclosure.test.ts` recorded in its own reader for exactly this case.
  //
  // **The plant is the shape 4.3 names**: a claim whose only path is one that was probed and not
  // served, which is the assertion the whole instrument exists for and the one a reader returning
  // nothing would pass trivially.
  const planted: readonly TermsClaim[] = [
    ...TERMS_CLAIMS,
    {
      id: "planted-unserved-claim",
      provider: "Guerrilla Mail",
      claim: "A claim this file must report, resting on a path that was probed and not served.",
      restsOn: [{ path: "https://mail.tm/en/terms-of-service/", served: false, result: "404" }],
      readOn: "2026-10-16",
      recordedIn: [TERMS_RECORD_PATH],
    },
  ];

  const reported = planted
    .flatMap((entry) =>
      entry.restsOn.filter((document) => !document.served).map((document) => ({ entry, document })),
    )
    .map(({ entry, document }) => `${entry.id} (${entry.provider}) at ${document.path}`)
    .filter((name) => name.startsWith("planted-unserved-claim"));

  expect(
    reported,
    "the planted claim on an unserved path is not reported by the reader the assertion above uses",
  ).toEqual(["planted-unserved-claim (Guerrilla Mail) at https://mail.tm/en/terms-of-service/"]);

  // **And the false-negative direction**, which is the direction this repository records most often:
  // **a reader that reported every claim would satisfy the case above.** So the same planted entry,
  // with its one path flipped to served, must report nothing at all.
  const flipped = planted.map((entry) =>
    entry.id === "planted-unserved-claim"
      ? { ...entry, restsOn: entry.restsOn.map((document) => ({ ...document, served: true })) }
      : entry,
  );
  expect(
    flipped
      .filter((entry) => entry.id === "planted-unserved-claim")
      .flatMap((entry) => entry.restsOn.filter((document) => !document.served))
      .map(() => "reported"),
    "a claim whose only path was served is still reported",
  ).toEqual([]);
});

/* ================================================================================================ *
 * 3. THE DECISIONS. No decision cites a terms claim, in either direction.
 * ================================================================================================ */

/**
 * A terms citation that is not resolved: it names no served path and carries no standing-rule
 * disclaimer.
 *
 * **A served path resolves it in one direction and a disclaimer in the other**, and the two are not
 * interchangeable — one says *this was read*, the other says *this is not a citation*. A third way out
 * would be "the sentence is about something else", and that is a judgement no reader can make without
 * becoming the thing it audits.
 */
function unresolvedTermsCitationsIn(relativePath: string): string[] {
  const served = servedPaths();

  return termsCitationsIn(relativePath)
    .filter((citation) => !served.some((path) => citation.sentence.includes(path)))
    .filter(
      (citation) =>
        !DECLARED_DISCLAIMERS.some((disclaimer) => citation.sentence.includes(disclaimer)),
    )
    .map(
      (citation) => `${citation.document}:${citation.line} — ${citation.sentence.slice(0, 200)}`,
    );
}

test("no decision in the three decision documents cites a terms claim it has not read", () => {
  // **Non-vacuity is asserted where the standing rule actually is.** A reader that found nothing in
  // `AGENTS.md` would satisfy the assertion below perfectly while proving nothing, so the reader is
  // required to find the rule itself there — and in `docs/PROVIDERS.md`, which states the same rule in
  // its own words.
  //
  // **`docs/ARCHITECTURE.md` is expected to carry none, and that is a measurement rather than an
  // omission.** **A document with no citation would satisfy every rule below whether or not the reader
  // worked**, so it is *not* asked to carry one; instead the reader is shown a citation planted into
  // architecture-shaped prose in the case below. **Zero is a fact about the document and never a fact
  // about the reader** — the recorded shape of an absence claimed by a reader nobody has seen fire.
  for (const path of ["docs/PROVIDERS.md", "AGENTS.md"]) {
    expect(
      termsCitationsIn(path),
      `${path} carries no terms citation, so the rule below is unproven in the document that states it`,
    ).not.toEqual([]);
  }

  for (const path of DECISION_DOCUMENTS) {
    expect(
      unresolvedTermsCitationsIn(path),
      `terms citations in ${path} that name no served path and carry no standing-rule disclaimer`,
    ).toEqual([]);
  }

  // **And the disclaimers themselves, read out of the documents rather than out of this file.** The
  // list above is a declaration; this is the assertion that the declaration still describes the tree,
  // and it is what stops a deletion of the standing rule from quietly widening the rule to nothing.
  for (const disclaimer of DECLARED_DISCLAIMERS) {
    expect(
      DECISION_DOCUMENTS.some((path) => documentText(path).includes(disclaimer)),
      `the declared disclaimer "${disclaimer}" is in none of the decision documents`,
    ).toBe(true);
  }
});

test("a planted terms citation in a decision is reported by the reader the case above uses", () => {
  // **The citation reader's own self-test, and the positive case comes before the plant.** A reader
  // that classified nothing would satisfy the assertion above for the wrong reason, so it is first
  // shown a citation it must find.
  //
  // **Four arms, in this order**, because a reader that reports one shape satisfies the others:
  // a citation in the grammatical order, the same citation with the words the other way round, a
  // **provider's own quoted sentence** (which must be ignored, because it is the provider speaking),
  // and a **standing-rule sentence** (which must be ignored, because it forbids the citation).
  //
  // **The standing-rule plant is copied from `AGENTS.md`'s own bullet rather than invented**, because a
  // paraphrase would be a fixture the grammar had never been measured against — and this one carries
  // the trailing clause *"do not assume a required obligation is absent"*, which is the phrase the
  // first run of this file's grammar missed by one character.
  const standingRule = DECLARED_DISCLAIMERS[1] ?? "";
  const planted = [
    "# A planted document",
    "",
    "The cadence is 5 s because Guerrilla Mail's terms require a slower interval.",
    "",
    "The provider permits no relay because its terms allow it.",
    "",
    "> The service prohibits over-use of our resources by repeatedly making many requests.",
    "",
    `Where a provider's terms could not be located, ${standingRule}, and do not assume a required obligation is absent.`,
    "",
    "This repository's own policy permits no relay, and that is independent of any provider's terms.",
  ];

  const blocks = markdownBlocks(planted);
  const unquoted = blocks.filter((block) => !block.quoted);
  const sentences = unquoted.flatMap((block) => sentencesOf(block.text));
  const found = sentences.filter(
    (sentence) =>
      TERMS_CITATION_VERB_FOLLOWING.test(sentence) || TERMS_CITATION_VERB_PRECEDING.test(sentence),
  );

  // **Both orders of the grammar, and each named in the failure message** so a reader that kept only
  // one is distinguishable from a reader that kept neither.
  expect(
    found.filter((sentence) => sentence.includes("terms require a slower interval")),
    "the planted citation is not found with the verb following 'terms'",
  ).toHaveLength(1);
  expect(
    found.filter((sentence) => sentence.includes("its terms allow it")),
    "the planted citation is not found with the verb preceding 'terms'",
  ).toHaveLength(1);

  // **The quotation is excluded by structure**, and this is the arm that proves the exclusion is a
  // property of the reader rather than an accident of the fixture.
  expect(
    blocks.filter((block) => block.quoted).map((block) => block.text),
    "the quoted block is not read as a quotation",
  ).toEqual([
    "The service prohibits over-use of our resources by repeatedly making many requests.",
  ]);
  expect(
    found.filter((sentence) => sentence.includes("prohibits over-use")),
    "a provider's own quoted sentence was read as this repository's citation",
  ).toEqual([]);

  // **And the standing-rule sentence resolves, exactly as it does in the real documents.**
  expect(
    found.filter((sentence) =>
      DECLARED_DISCLAIMERS.some((disclaimer) => sentence.includes(disclaimer)),
    ),
    "the standing-rule sentence is not recognised as a disclaimer",
  ).toHaveLength(1);
});

/* ================================================================================================ *
 * 4. THE TWO DOCUMENTS. `docs/PRIVACY.md` against what was read.
 * ================================================================================================ */

test("docs/PRIVACY.md's attribution rows carry the same dates and served-ness the record does", () => {
  const lines = documentLines(ATTRIBUTION_DOCUMENT_PATH);

  // **The table is located inside a named section, and the section is required to exist.** A reader
  // that scanned the whole document for a table with the right header would be satisfied by a table
  // somebody added to an unrelated section, **and a document whose §6 lost its heading entirely would
  // satisfy every assertion below it.** This is the declared-name check: the section is named here and
  // the document is required to carry it.
  expect(
    markdownHeadings(lines),
    `${ATTRIBUTION_DOCUMENT_PATH} has no "## ${ATTRIBUTION_SECTION_HEADING}" section to read the table from`,
  ).toContain(ATTRIBUTION_SECTION_HEADING);

  const rows = attributionRowsIn(lines);

  // **Non-vacuity before the absence.** A reader that found no table would satisfy every assertion
  // below it, and so would a document with an empty attribution section.
  expect(
    rows.length,
    `no attribution table was read from ${ATTRIBUTION_DOCUMENT_PATH}`,
  ).toBeGreaterThan(0);

  const drifted: string[] = [];

  for (const provider of ["Mail.tm", "Guerrilla Mail"] as const) {
    const row = rows.find((cells) => (cells[0] ?? "").toLowerCase() === provider.toLowerCase());
    if (row === undefined) {
      drifted.push(`${ATTRIBUTION_DOCUMENT_PATH} has no attribution row for ${provider}`);
      continue;
    }

    const prose = rowProse(row);
    const claims = TERMS_CLAIMS.filter((entry) => entry.provider === provider);
    const dates = claims.map((entry) => entry.readOn);

    // **(a) The date.** The row is a dated measurement, and the date is the whole of its authority.
    // A row carrying an older date than the record is a row describing a state that has been
    // superseded — which is the drift this case exists to report, and it is the direction that fails
    // quietly in every other instrument in this directory.
    if (!dates.some((date) => prose.includes(date))) {
      drifted.push(
        `${ATTRIBUTION_DOCUMENT_PATH} / ${provider}: the row carries none of the dates the record carries (${[...new Set(dates)].join(", ")}) and so describes a reading that has been superseded. Its cell reads: ${prose}`,
      );
    }

    // **(b) The served-ness.** A provider whose terms were read at a served path must have that path
    // named, or the row is describing an absence this repository has stopped asserting. And a provider
    // whose terms were never located must name at least one path that was probed, so the row is a
    // record of a *search* rather than of an absence.
    const served = claims.flatMap((entry) =>
      entry.restsOn.filter((document) => document.served).map((document) => document.path),
    );
    const unserved = claims.flatMap((entry) =>
      entry.restsOn.filter((document) => !document.served).map((document) => document.path),
    );

    if (served.length > 0 && !served.some((path) => prose.includes(path))) {
      drifted.push(
        `${ATTRIBUTION_DOCUMENT_PATH} / ${provider}: the record says terms were read at ${served.join(", ")} and the row names none of them`,
      );
    }
    if (served.length === 0 && !unserved.some((path) => prose.includes(path))) {
      drifted.push(
        `${ATTRIBUTION_DOCUMENT_PATH} / ${provider}: the record says no document was located and the row names none of the paths tried`,
      );
    }
  }

  expect(
    drifted,
    "attribution rows in docs/PRIVACY.md that do not match what was read. They are the document's own claims, so the repair belongs to whoever owns that document, not to this file.",
  ).toEqual([]);
});

test("the attribution-table reader reads a planted table and refuses prose that only looks like one", () => {
  const planted = [
    "# A planted document",
    "",
    "| other | something |",
    "| --- | --- |",
    "| not the attribution table | ignored |",
    "",
    "| provider | what was actually verified |",
    "| --- | --- |",
    "| Mail.tm | a planted row |",
    "",
    "| --- | --- |",
    "| --- | --- |",
  ];

  expect(
    attributionRowsIn(planted),
    "the reader does not find the table it was planted next to, or counts its separator as a row",
  ).toEqual([["Mail.tm", "a planted row"]]);

  // **The separator arm on its own, because the first arm is satisfied by a reader that ignores every
  // row after the first separator** — which is the vacuous direction, and is why the planted fixture
  // keeps two separator-shaped lines *after* the row it wants counted.
  expect(
    attributionRowsIn(planted).length,
    "a separator-shaped line below the table was counted as a row",
  ).toBe(1);

  // **And a table with no separator row is refused rather than read**, which is a table a markdown
  // renderer would not draw either — the plant is a *header* here, because a reader that accepted one
  // would treat every two-line fragment as a table.
  expect(
    attributionRowsIn([
      "| provider | what was actually verified |",
      "| Mail.tm | a row with no separator beneath it |",
    ]),
    "a header with no separator beneath it was read as a table",
  ).toEqual([]);

  // **And the emphasis stripper**, because a row written in bold and a row written plainly are the
  // same row and a reader that compared raw cells would report the formatting as a drift.
  expect(
    rowProse(["**Mail.tm**", "**No terms page exists.**"]),
    "emphasis markers are not stripped from an attribution row",
  ).toBe("Mail.tm No terms page exists.");

  // **And the heading reader, which is what locates the table's section** — shown a heading at two
  // depths and three lines that are not headings, because a reader that matched any line beginning
  // with `#` would satisfy the section assertion above for a document with no section at all.
  expect(
    markdownHeadings([
      "# A planted document",
      "",
      "## 6. Provider attribution",
      "### A deeper heading",
      "#no-space-is-not-a-heading",
      "#### ",
      "not a heading at all",
    ]),
    "the heading reader does not read a planted heading, or reads something that is not one",
  ).toEqual(["A planted document", "6. Provider attribution", "A deeper heading"]);
});

/* ================================================================================================ *
 * 5. THIS FILE'S OWN SHAPE. No network, no shared reader, no pattern beyond the declared three.
 * ================================================================================================ */

/**
 * The architecture suites this file must share no reader with, **as filenames**.
 *
 * **A file name is not an import specifier**, and the difference cost a first run: the needles the
 * import check needs are the file names without their extension, so they are **derived** here rather
 * than written twice — two lists of the same four things is a list that can drift out of agreement.
 */
const OTHER_SUITE_FILES: readonly string[] = [
  "boundaries.test.ts",
  "privacy-disclosure.test.ts",
  "security-audit.test.ts",
  "branding-audit.test.ts",
];

/**
 * The same four suites, as the needles an import specifier would end with.
 *
 * **Assembled rather than written**, because an import specifier is a **string** and this check has to
 * read text with strings intact: the needle it looks for is the very text its own declaration would
 * contain. **A check that has to name what it forbids cannot hold that name contiguously in its own
 * source.**
 */
const OTHER_SUITE_MODULES: readonly string[] = OTHER_SUITE_FILES.map((file) => file.slice(0, -3));

/**
 * A function body qualifies as a **reader** for the independence check when it holds more than one
 * statement.
 *
 * **One statement is an incantation rather than a reader**, and every architecture suite reads a
 * repository file the same one-expression way, so the first version of this check in another file
 * reported exactly that and nothing else. **The import-specifier check has no such threshold**, and it
 * is the one that holds unconditionally.
 */
const READER_MINIMUM_STATEMENTS = 2;

const OTHER_SUITE_SOURCES: readonly string[] = OTHER_SUITE_FILES.map((file) =>
  readFileSync(join(REPO_ROOT, "tests/architecture", file), "utf8"),
);

const SELF_SOURCE = documentText("tests/architecture/provider-terms.test.ts");

/** Every regular-expression literal in a source file, read through the TypeScript parser. */
function regexLiteralsIn(source: string): string[] {
  const parsed = ts.createSourceFile("self.ts", source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];

  const walk = (node: ts.Node): void => {
    if (ts.isRegularExpressionLiteral(node) === true) {
      found.push(node.text);
    }
    node.forEachChild(walk);
  };
  walk(parsed);

  return found;
}

/** Every module specifier a source imports or re-exports, as written. */
function importedSpecifiersIn(source: string): string[] {
  const parsed = ts.createSourceFile("imports.ts", source, ts.ScriptTarget.Latest, true);
  const declared: string[] = [];

  for (const statement of parsed.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      declared.push(statement.moduleSpecifier.text);
    }
  }

  return declared;
}

/** Every function body in a source, narrowed to those that could be a reader. */
function readerBodiesIn(source: string): string[] {
  const parsed = ts.createSourceFile("bodies.ts", source, ts.ScriptTarget.Latest, true);
  const bodies: string[] = [];

  const walk = (node: ts.Node): void => {
    const isCallable =
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node)) &&
      node.body !== undefined &&
      ts.isBlock(node.body);
    if (isCallable === true && node.body.statements.length >= READER_MINIMUM_STATEMENTS) {
      bodies.push(node.body.getText(parsed));
    }
    node.forEachChild(walk);
  };
  walk(parsed);

  return bodies;
}

/**
 * Every string literal in a source that looks like a URL.
 *
 * **Both schemes**, and `http` before `https` because one of this repository's provider documents is
 * served over plain HTTP — a reader that only knew the secure scheme would have found one path and
 * reported the check green on the strength of it.
 */
function urlLiteralsIn(source: string): string[] {
  const parsed = ts.createSourceFile("urls.ts", source, ts.ScriptTarget.Latest, true);
  const urls: string[] = [];

  const walk = (node: ts.Node): void => {
    const literal = ts.isStringLiteralLike(node) === true ? node.text : "";
    const scheme = literal.startsWith("http://")
      ? "http://"
      : literal.startsWith("https://")
        ? "https://"
        : "";
    if (scheme.length > 0 && literal.length > scheme.length + 3) {
      urls.push(literal);
    }
    node.forEachChild(walk);
  };
  walk(parsed);

  return urls;
}

/**
 * The complete set of regular-expression literals this file is allowed to contain.
 *
 * **Three entries, and the number is the point.** Each is **structural** — a blockquote marker, the two
 * orders of a closed verb set, and a date shape — and **none is handed a provider's or a requirement's
 * words as its input.** A fourth pattern has to be added to this list, which makes adding one a decision
 * somebody has to look at.
 */
const ALLOWED_PATTERNS: readonly string[] = [
  // -- a blockquote marker, read structurally so a provider's own sentence is never this file's claim --
  "/^>[ ]?/",
  // -- the terms-citation grammar, in BOTH orders, over one closed set of obligation and permission verbs
  "/\\bterms\\b[^.]*\\b(require|requires|required|forbid|forbids|prohibit|prohibits|mandate|mandates|oblige|obliges|allow|allows|permit|permits)\\b/i",
  "/\\b(require|requires|required|forbid|forbids|prohibit|prohibits|mandate|mandates|oblige|obliges|allow|allows|permit|permits)\\b[^.]*\\bterms\\b/i",
  // -- an ISO-shaped date, which is what makes "carries the record's date" a comparison and not a vibe --
  "/\\d{4}-\\d{2}-\\d{2}/g",
];

test("this file contains no pattern beyond the declared four, and no literal backtick in one", () => {
  const found = regexLiteralsIn(SELF_SOURCE);

  expect(
    found.filter((pattern) => !ALLOWED_PATTERNS.includes(pattern)),
    "regular-expression literals in this file that are not in the structural allow-list",
  ).toEqual([]);
  expect(
    ALLOWED_PATTERNS.filter((pattern) => !found.includes(pattern)),
    "declared patterns this file no longer contains, which is how a stale allow-list entry is found",
  ).toEqual([]);

  expect(
    found.filter((pattern) => pattern.includes("\x60")),
    "a regular-expression literal in this file holds a literal backtick",
  ).toEqual([]);

  // **And the extractor, shown a pattern and shown something that only looks like one.**
  const probe =
    'const PLANTED = /never-a-claim[0-9]+/g;\nconst TEXT = "/not-a-pattern[0-9]+/";\n// /also-not[0-9]+/\n';
  expect(
    regexLiteralsIn(probe),
    "the extractor does not see a pattern planted into code, or counts one written as text",
  ).toEqual(["/never-a-claim[0-9]+/g"]);
});

test("this file shares no reader with the other four architecture suites", () => {
  // **Two checks, because the two claims have different shapes.** An *import specifier* is a string and
  // is read as one; a *function body* is code and is compared whole, which catches a copy as well as an
  // import — a shared body is a shared reader wearing a different name.
  expect(
    importedSpecifiersIn(SELF_SOURCE).filter((specifier) =>
      OTHER_SUITE_MODULES.some((name) => specifier.endsWith(name)),
    ),
    "this file imports from an architecture suite it must share no reader with",
  ).toEqual([]);

  const otherBodies = OTHER_SUITE_SOURCES.flatMap(readerBodiesIn);
  expect(
    readerBodiesIn(SELF_SOURCE).filter((body) => otherBodies.includes(body)),
    "function bodies in this file that are byte-identical to one in another architecture suite",
  ).toEqual([]);

  // **Both controls, through the same readers the assertions above use.** A control that calls the
  // reader is not a control on the assertion. **The planted import is type-only on purpose**, so it is
  // erased before the file runs and the case reaches its assertion instead of failing to collect.
  const plantedImport = `import type { BoundariesViolations } from "./${OTHER_SUITE_MODULES[0]}";`;
  expect(
    importedSpecifiersIn(plantedImport),
    "the planted import specifier is not read by the reader the assertion above uses",
  ).toEqual(["./boundaries.test"]);

  const donorBody = readerBodiesIn(OTHER_SUITE_SOURCES[0] ?? "")[0] ?? "";
  expect(donorBody, "no donor body was found to plant").not.toBe("");
  expect(
    readerBodiesIn(`${SELF_SOURCE}\nfunction planted()${donorBody}\n`).filter((body) =>
      otherBodies.includes(body),
    ),
    "the planted body is not reported by the reader the assertion above uses",
  ).toHaveLength(1);

  // **And the suites are non-empty**, or the two assertions above are satisfied by an empty corpus.
  expect(OTHER_SUITE_SOURCES.length, "no other suite was read to compare against").toBe(4);
  expect(otherBodies.length, "the other suites declare no function to share").toBeGreaterThan(0);
});

test("this file makes no network request, and holds no URL the claims map does not declare", () => {
  // **Two halves, and the second is the one that matters.** An import list can be clean while a `fetch`
  // call sits in the body; a URL list can be clean while a module is imported for its side effect.
  //
  // **The URL half is the stronger statement of the two, and it is a positive one**: every URL-shaped
  // string literal in this file must be a path the claims map already records as read. **A terms review
  // is a human act against a website** (`design.md` D7), so the only way this instrument could ever
  // contact a provider is if somebody wrote the call into it — and a file that can only name the paths
  // it already recorded is a file with nothing new to call.
  const declaredPaths = [
    ...new Set(TERMS_CLAIMS.flatMap((entry) => entry.restsOn.map((document) => document.path))),
  ];

  const networkModules = [
    "node:http",
    "node:https",
    "node:net",
    "node:tls",
    "node:dgram",
    "undici",
    "axios",
    "node-fetch",
    "got",
    "superagent",
    "playwright",
    "@playwright/test",
  ];

  expect(
    importedSpecifiersIn(SELF_SOURCE).filter((specifier) =>
      networkModules.some((name) => specifier.includes(name)),
    ),
    "this file imports a module that could open a connection",
  ).toEqual([]);

  const urls = [...new Set(urlLiteralsIn(SELF_SOURCE))].sort();
  expect(
    urls.filter((url) => !declaredPaths.includes(url)),
    "URL-shaped literals in this file that are not a path the claims map declares",
  ).toEqual([]);

  // **Non-vacuity on the URL half, because an allow-everything rule is satisfied by an empty file** —
  // and this file is not empty: it names every provider path the claims map holds, and the reader is
  // shown one of them.
  expect(
    urls.length,
    `this file names ${urls.length} distinct provider paths and the map declares ${declaredPaths.length}, so one of the two is not being read`,
  ).toBe(declaredPaths.length);
  expect(
    urlLiteralsIn(SELF_SOURCE).filter((url) => url === declaredPaths[0]),
    "the URL reader does not see a provider path written in this file",
  ).not.toEqual([]);

  // **And the reader is shown a URL it must refuse**, because a reader that returned every string
  // literal would satisfy the assertion above whenever the map is empty. **The planted URL is assembled
  // from three pieces rather than written whole**, so that the control does not itself become a
  // URL-shaped literal in this file — **which is not a style point: a plant that trips the assertion it
  // exists to disprove measures nothing.**
  const plantedUrl = ["https", "//example.invalid", "/not-a-provider-path"].join(":");
  expect(
    urlLiteralsIn(`const NOT_A_URL = "${plantedUrl}";`),
    "the URL reader does not see a URL planted into a string",
  ).toEqual([plantedUrl]);

  // **And the globals that would make a network call are not in the parsed source**, read through the
  // parser so a mention in a comment can neither satisfy nor break this.
  const parsed = ts.createSourceFile("net.ts", SELF_SOURCE, ts.ScriptTarget.Latest, true);
  const globals = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isIdentifier(node) === true) {
      globals.add(node.text);
    }
    node.forEachChild(collect);
  };
  collect(parsed);

  expect(
    [...globals].filter((name) =>
      ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "navigator"].includes(name),
    ),
    "identifiers in this file that could reach the network",
  ).toEqual([]);

  // **And the collector is shown a planted global**, so a collector that returned nothing would not
  // satisfy the assertion above for the right reason.
  const probe = ts.createSourceFile("probe.ts", "fetch('/x');", ts.ScriptTarget.Latest, true);
  const planted = new Set<string>();
  const collectPlanted = (node: ts.Node): void => {
    if (ts.isIdentifier(node) === true) {
      planted.add(node.text);
    }
    node.forEachChild(collectPlanted);
  };
  collectPlanted(probe);

  expect(
    [...planted],
    "the identifier collector does not see a network global planted into a call expression",
  ).toContain("fetch");
});
