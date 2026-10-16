/**
 * `docs/PRIVACY.md` against the shipped tree.
 *
 * ## What this file is, and what it is not
 *
 * The failure this change exists to end is **three surfaces restating two sentences each with nothing
 * holding them to one another**, so the instrument here is not *"does the document exist"*. It is a
 * **hand-written map from each enumerable claim in the document to the code that owns it**, plus a
 * set of **whole-sentence literals** for the claims that are prose rather than data.
 *
 * ## Three rules of the house, and why each exists
 *
 * **1. No claim is located by pattern** (`design.md` D3). A scan would match any plausible-looking key
 * or origin and report agreement on a document that says the wrong thing. Every enumeration is read
 * as a **markdown table**, located by its declared header row and compared against a constant
 * **imported from the code that owns it**. Every prose claim is compared as a **whole sentence** taken
 * from a list written by hand: a whole-sentence comparison cannot be satisfied by a coincidental run
 * of the same words somewhere else in the file, which a substring or a regular expression can.
 *
 * The **one** kind of check that searches is a **forbidden-claim** check, and it is not a loophole so
 * much as the only kind whose failure mode is a silent miss. `design.md` D8 requires one:
 * `docs/ROADMAP.md` §29 forbids *"Messages never leave your device."*, and a reader that cannot find it
 * would pass on a document that contains it. **Every forbidden reader in this file therefore carries a
 * planted control** — the sentence is inserted into a **copy of the real document** and the *same*
 * reader is required to report it. A reader never shown it can fire is not evidence of absence.
 *
 * **2. Both directions, and agreement first** (`design.md` D4). For every enumerable claim, the
 * document omitting something that exists is a record the product keeps and does not disclose; the
 * document naming something that does not exist is a stale name left behind after a rename, **and it is
 * the likelier of the two** because a privacy document is prose somebody edits without running anything.
 *
 * The **first** case in this file is therefore a positive control — the map agrees with the shipped tree
 * — and only then is any failure claimed. **A file of negative assertions passes on an empty map**, so
 * the order is the instrument rather than the formatting.
 *
 * **3. This file shares no reader with `boundaries.test.ts`** (`design.md` D2, task 3.8). A tool that
 * also checks its own work cannot report its own defect. The last case reads this file's own source and
 * holds every regular expression in it to an explicit allow-list of *structural* patterns, which is what
 * makes "no claim is matched by a pattern" a check rather than a promise. **No client surface is edited
 * to satisfy this file** (`design.md` D5): the website stays at 125 tests and `apps/web/src/styles.css`
 * stays byte-identical, so a green run here is evidence about the document and not about the page.
 *
 * ## What it establishes, and the three things it does not
 *
 * It establishes that every enumeration in the document equals a code-owned constant, that every
 * declared pointer resolves to a heading outside the document, that the three surfaces' claims are not
 * contradicted, and that the document says the forbidden things nowhere.
 *
 * It does **not** establish that the *does-not-collect* list is **complete** (`design.md` D9 — the
 * document says so in its own words), that the document's prose is *identical* to the surfaces' copy
 * (`design.md` D12 forbids that coupling, so requiring it would forbid the design), or that the website's
 * `LocalData.tsx` agrees as **strongly** as the extension's panel: that file keeps its copy inline and
 * exports no copy constant, so its half is held by declared markers and one literal, and the asymmetry
 * is recorded in `design.md` rather than smoothed over.
 *
 * ## On importing the tree
 *
 * The constants come from **relative source paths**, not from `@spectre-mail/*`. The workspace root has
 * no `node_modules/@spectre-mail` entry, so a bare specifier here would not resolve; a relative path
 * into a package resolves that package's own bare imports from that package's own `node_modules`, which
 * is the arrangement `vite` uses when it builds for production.
 *
 * `docs/PRIVACY.md` itself is never a support (`design.md` D9). **A document supporting its own claim is
 * the exact shape this change exists to end**, so a pointer into it fails on that reason rather than on
 * the missing heading.
 *
 * ## The manifest is read from `static/`, not from `dist/`
 *
 * The specification says "the built extension manifest". `apps/extension/static/manifest.json` **is**
 * that manifest's content — the build copies it — and `pnpm verify` runs `pnpm test` **before**
 * `pnpm build`, so a reader of `dist/` would report a failure caused by the order of two commands
 * rather than by anything about privacy. Recorded in `design.md` as an apply-stage decision.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import { EXTENSION_PROVIDER_IDS } from "../../apps/extension/src/provider-config";
import { PANEL_COPY, PANEL_COPY_KEYS } from "../../apps/extension/src/panel-copy";
import { WEBSITE_PROVIDER_IDS } from "../../apps/web/src/provider-config";
import { LIMITS } from "../../apps/web/src/sections";
import { createBrowserStorage } from "../../packages/storage/src/browser";
import {
  EXTENSION_MAILBOX_KEY,
  EXTENSION_MAILBOXES_KEY,
  EXTENSION_SEEN_MESSAGES_KEY,
  EXTENSION_SITE_MAILBOXES_KEY,
} from "../../packages/storage/src/chrome";
import { CURRENT_MAILBOX_KEY } from "../../packages/storage/src/indexeddb";

/** The repository root, resolved the way `boundaries.test.ts` resolves it. */
const REPO_ROOT = process.cwd();

/** The document under test, as a repository-relative path. Also the support this file must reject. */
const PRIVACY_PATH = "docs/PRIVACY.md";

/** The extension's manifest **source**, which the build copies into `dist` verbatim. */
const MANIFEST_PATH = "apps/extension/static/manifest.json";

/* ------------------------------------------------------------------------------------------------
 * Readers. Deliberately few, deliberately literal.
 * ---------------------------------------------------------------------------------------------- */

/** Reads a repository file as UTF-8 text. */
function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/**
 * TypeScript source scanned once, yielding **the code with comments and strings removed** and **every
 * regular-expression literal it contains**.
 *
 * Both come from one scan because a reader that produced them separately could disagree about what a
 * `/` means: strip the strings textually and a pattern containing a quote is mangled; keep the raw text
 * and a path like `apps/web/src` reads as a pattern. A character scan is the only reader here that has
 * to be right about both at once.
 */
function scanSource(source: string): { code: string; patterns: string[] } {
  let code = "";
  const patterns: string[] = [];
  let index = 0;
  /** The last character of `code`, ignoring whitespace — what decides whether a `/` divides or opens. */
  const before = (): string => code.replace(/\s+$/, "").slice(-1);

  while (index < source.length) {
    const character = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      code += " ";
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/"))
        index += 1;
      index += 2;
      code += " ";
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === character) {
          index += 1;
          break;
        }
        index += 1;
      }
      code += " ";
      continue;
    }

    if (character === "/" && !/[)\]}\w$]/.test(before())) {
      index += 1;
      let body = "";
      while (index < source.length) {
        if (source[index] === "\\") {
          body += source[index] ?? "";
          body += source[index + 1] ?? "";
          index += 2;
          continue;
        }
        if (source[index] === "/") {
          index += 1;
          break;
        }
        if (source[index] === "\n") break;
        body += source[index] ?? "";
        index += 1;
      }
      while (index < source.length && /[a-z]/.test(source[index] ?? "")) index += 1;
      patterns.push(body);
      code += " ";
      continue;
    }

    code += character;
    index += 1;
  }

  return { code, patterns };
}

/** Source with comments and string literals removed, leaving only code. See {@link scanSource}. */
function codeOnly(source: string): string {
  return scanSource(source).code;
}

/** Every regular-expression literal's body, in a source file. See {@link scanSource}. */
function regexLiteralsIn(source: string): string[] {
  return scanSource(source).patterns;
}

/**
 * Strips TypeScript comments only, leaving string literals in place.
 *
 * The third recorded instance of a check in this repository firing on its own documentation was fixed by
 * stripping comments rather than by rewording until the rule went quiet; this is the same arrangement,
 * applied to the reader that counts contract calls in shipped source. {@link codeOnly} is the stronger
 * arrangement and is used where a reader must not see a string at all.
 */
function stripSourceComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/**
 * Removes markdown emphasis and code markers and collapses whitespace.
 *
 * Emphasis is stripped because **Prettier normalises `*x*` to `_x_`** and this document is
 * Prettier-governed, so requiring the asterisks would make the check a statement about which formatter
 * ran last. Whitespace is collapsed so a sentence can be compared across the line break its source
 * happens to have.
 */
function normaliseProse(text: string): string {
  // **The three markers are removed with `replaceAll` rather than with one `/[*_`]/g`, and the reason is a
  // red gate this file caused rather than a preference.**
  //
  // `tests/architecture/boundaries.test.ts`'s `stripComments` recognises `//`, `/* */`, `'`, `"` and a
  // backtick — **and not a regular-expression literal.** A backtick inside one therefore *opens a string
  // that runs until the next backtick in the file*, and from that point the reader is out of phase with
  // the source: it read three provider-adapter identifiers out of **this file's own doc comment** and the
  // rule *"confines provider adapters to `packages/providers`"* went **red on the shipped tree** with six
  // violations. That is this repository's recorded *"a check fired on its own documentation"* shape, in
  // its reverse direction: the documentation was fine and the **other file's reader** could not see it.
  //
  // **`replaceAll` with string arguments puts no quote character inside a pattern**, so this file cannot
  // desynchronise a reader that does not understand regex literals. It is the same removal, spelled so
  // that a reader in another file cannot be desynchronised by it. The allow-list below loses its
  // `[*_\`]` entry as a result, and the entry was only ever there because the pattern existed.
  return text
    .replaceAll("*", "")
    .replaceAll("_", "")
    .replaceAll("`", "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Any prose, as a **list of whole sentences**.
 *
 * Headings, table rows and horizontal rules are removed first: headings are labels, and a table row's
 * content is data this file checks through {@link tableRows} rather than as sentences. List bullets keep
 * their text and lose their marker. Normalisation happens **before** the split, because a sentence
 * ending in `alone.**` would otherwise not be seen to end at all.
 */
function sentencesOf(markdown: string): string[] {
  return normaliseProse(
    markdown
      .split("\n")
      .filter((line) => !/^#{1,6} /.test(line) && !/^\|/.test(line) && !/^---+$/.test(line.trim()))
      .map((line) => (line.startsWith("- ") ? line.slice(2) : line))
      .join(" "),
  )
    .split(/\.\s+/)
    .map((sentence) => sentence.replace(/\.$/, ""))
    .filter((sentence) => sentence.length > 0);
}

/** Markdown text split into its `## ` sections, keyed by heading. */
function sectionsOf(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let heading: string | null = null;
  let body: string[] = [];

  for (const line of markdown.split("\n")) {
    if (/^## /.test(line)) {
      if (heading !== null) {
        sections.set(heading, body.join("\n"));
      }
      heading = line.slice(3).trim();
      body = [];
    } else if (heading !== null) {
      body.push(line);
    }
  }

  if (heading !== null) {
    sections.set(heading, body.join("\n"));
  }

  return sections;
}

/**
 * Every markdown table in a section whose **header row** equals `header`, each as raw data-row lines.
 *
 * Located by a **declared string list**, not a shape match, and read until the table ends. This is the
 * whole of *"the document is read as data"*: no enumeration in this file is found by looking for a word
 * in a paragraph.
 *
 * It returns a **list of tables** rather than the first one, because "exactly one table declares this
 * header" is a claim worth checking and a reader that returned the first match could not check it: the
 * first version asserted `length === 1` against a function that returned *rows*, so it was really
 * asserting *"this table has exactly one row"* and reported a five-row table as *"declares no table"*.
 * **A reader whose name, message and return value disagreed is the defect this file's own note is
 * about**, found here by running it.
 *
 * **Both the reader and the planting controls are built on this one locator.** The first version of the
 * attribution control built its own pattern out of the provider's display name, and a pattern literal
 * cannot interpolate — `${name}` inside `/…/` is seven literal characters, not a substitution — so the
 * planted row was never inserted and the control was reported as *"the planted row really added a line
 * to the table: expected 14293 to be greater than 14293"*. **A control that cannot plant its own defect
 * is the same shape as a sweep that matches nothing, wearing a stricter hat**, and the repair was the
 * locator rather than a threshold.
 */
function tablesWithHeader(sectionBody: string, header: readonly string[]): string[][] {
  const lines = sectionBody.split("\n").map((line) => line.trim());
  const tables: string[][] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || !line.startsWith("|")) {
      continue;
    }

    const cells = line.split("|").slice(1, -1).map(normaliseProse);
    const isHeader =
      cells.length === header.length && cells.every((cell, at) => cell === header[at]);
    if (!isHeader) {
      continue;
    }

    const rows: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor];
      if (next === undefined || !next.startsWith("|")) {
        break;
      }
      // The separator row is skipped **per cell**. Stripping the pipes first and collapsing the
      // whitespace they leave behind joins the cells into one string — `--- --- ---` — which no
      // cell-wise test can match, so the separator arrived as a *data row* and every table in the
      // document reported exactly one more row than it declares. **A row was being counted as a
      // claim**, which is the same defect as a sweep matching nothing, in the direction that
      // inflates rather than misses.
      const cells = next.split("|").slice(1, -1).map(normaliseProse);
      if (cells.length === header.length && cells.every((cell) => /^-{3,}$/.test(cell))) {
        continue;
      }
      rows.push(next);
    }
    tables.push(rows);
  }

  return tables;
}

/**
 * Inserts a row **into** a located table, immediately after the row whose first cell is `firstCell`.
 *
 * Used only by the planting controls, so that a planted defect is planted into the *structure* the reader
 * reads rather than into a string the reader happens to match. **It fails loudly when the anchor row is
 * not found**, because a control that silently inserts nothing is the defect this file's note is about.
 */
function insertTableRow(
  markdown: string,
  heading: string,
  header: readonly string[],
  firstCell: string,
  newRow: string,
): string {
  const body = sectionOf(markdown, heading);
  const rows = tablesWithHeader(body, header)[0] ?? [];
  const anchor = rows.findIndex((line) => normaliseProse(line.split("|")[1] ?? "") === firstCell);

  expect(anchor, `no row whose first cell is "${firstCell}" to plant after`).toBeGreaterThan(-1);
  expect(newRow.length, "the planted row is a row").toBeGreaterThan(0);

  const lines = body.split("\n");
  lines.splice(lines.indexOf(rows[anchor] ?? "") + 1, 0, newRow);

  const [before = "", after = ""] = markdown.split(body);
  return `${before}${lines.join("\n")}${after}`;
}

/**
 * GitHub's heading anchor: lowercase, drop everything that is not a letter, digit, space or hyphen,
 * spaces become hyphens.
 */
function slugOf(heading: string): string {
  return normaliseProse(heading)
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s/g, "-");
}

/** Every heading in a markdown file, at any depth. */
function slugsIn(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,6} /.test(line))
    .map((line) => slugOf(line.replace(/^#{1,6} /, "").trim()));
}

/**
 * The document's `## ` headings, **declared in full**.
 *
 * The `N. ` prefix is part of the heading and is included here, so a reader cannot find a section by
 * dropping it and cannot be satisfied by a document that renumbers itself: renumbering a section is a
 * change the instrument reports rather than one it silently follows. **The number is therefore part of
 * the document's identity here**, which is why `slugOf` still sees the number in an anchor.
 */
const SECTION = {
  extension: "1. What this device keeps — the browser extension",
  website: "2. What this device keeps — the website",
  providers: "3. What providers receive",
  notCollected: "4. What SpectreMail does not collect",
  removal: "5. Making this device forget",
  attribution: "6. Provider attribution",
  lifecycle: "7. Message lifecycle limitations",
  permissions: "8. What the browser extension asks for",
} as const;

/** One section of **any** markdown text, failing on the heading rather than returning nothing. */
function sectionOf(markdown: string, heading: string): string {
  const body = sectionsOf(markdown).get(heading);
  expect(body, `no section headed "${heading}"`).toBeDefined();
  return body ?? "";
}

/**
 * The single table one section of **any** markdown text declares with this header.
 *
 * The count is on **tables**, and it is checked here rather than inside `tableRows` so that the failure
 * message can name the section and the header it looked for — a message that says *"declares no table"*
 * when it has actually just found the table and mis-counted its rows is worse than no message.
 */
function rowsOf(markdown: string, heading: string, header: readonly string[]): string[][] {
  const body = sectionOf(markdown, heading);
  const tables = tablesWithHeader(body, header);

  expect(
    tables.length,
    `§"${heading}" declares ${tables.length} tables with the header ${header.join(" | ")}; exactly one is required`,
  ).toBe(1);

  return (tables[0] ?? []).map((line) => line.split("|").slice(1, -1).map(normaliseProse));
}

/** The document's own section's table, located by its header row. */
function rowsIn(heading: string, header: readonly string[]): string[][] {
  return rowsOf(PRIVACY, heading, header);
}

/* ------------------------------------------------------------------------------------------------
 * The shipped facts, measured rather than transcribed.
 * ---------------------------------------------------------------------------------------------- */

/** The document, read once. */
const PRIVACY = readRepoFile(PRIVACY_PATH);

/** Its prose, as a set of whole sentences. */
const PRIVACY_SENTENCES = new Set(sentencesOf(PRIVACY));

/**
 * The extension's four `chrome.storage.local` keys, **imported from the constants the adapters export**
 * rather than written beside them.
 *
 * The order is the adapters' own and carries no meaning; the checks compare **sets**.
 */
const ADAPTER_OWNED_KEYS: ReadonlySet<string> = new Set([
  EXTENSION_MAILBOX_KEY,
  EXTENSION_MAILBOXES_KEY,
  EXTENSION_SITE_MAILBOXES_KEY,
  EXTENSION_SEEN_MESSAGES_KEY,
]);

/**
 * Each provider's origin, held here rather than beside the document.
 *
 * The adapters keep their base URL module-private, so the origin cannot be imported — **and importing it
 * would have meant editing a source file this change must not touch**, which is a change's signal to
 * record rather than to act on. Holding the map here keeps it honest from **both** ends instead: every id
 * any client configures must appear here, every origin here must be one the manifest declares *and* the
 * extension configures, and nothing in `host_permissions` may be unaccounted for.
 */
const PROVIDER_ORIGIN: Readonly<Record<string, string>> = {
  mailtm: "https://api.mail.tm",
  guerrilla: "https://api.guerrillamail.com",
};

/** The manifest, parsed from the file the build copies into `dist`. */
const MANIFEST = JSON.parse(readRepoFile(MANIFEST_PATH)) as {
  readonly permissions?: readonly string[];
  readonly host_permissions?: readonly string[];
};

/** `host_permissions` with the wildcard path form stripped, as origins. */
const DECLARED_HOST_ORIGINS: ReadonlySet<string> = new Set(
  (MANIFEST.host_permissions ?? []).map((pattern) => pattern.replace("/*", "")),
);

/** The manifest's declared permissions. */
const DECLARED_PERMISSIONS: ReadonlySet<string> = new Set(MANIFEST.permissions ?? []);

/**
 * Each provider's display name, **read out of the file that declares it** rather than minted from the
 * adapter or written beside it.
 *
 * ## Why this is not `createGuerrillaAdapter({ … }).displayName`, which is what it replaced
 *
 * The first version imported both adapter factories and constructed them. **`tests/architecture/
 * boundaries.test.ts` forbids that**: `PROVIDER_ADAPTER_IDENTIFIERS` confines `createMailTmAdapter`,
 * `createGuerrillaAdapter` and `runProviderConformance` to `packages/providers`, to a client's own
 * `provider-config.ts`, and to **test files sitting in a package's `src` directory** — and
 * `tests/architecture/` is none of those. It reported **six** violations, and it was right: a file
 * that constructs an adapter outside the package is the shape the rule exists to catch.
 *
 * **And the record of that is worth one line of its own.** The first attempt to write it down here
 * put the allowance's own glob in this comment — and **a glob ending `/src/` closes a block comment**,
 * because the comment is JavaScript's, not Markdown's. The file failed to parse, the boundary rule read
 * the *leaked* remainder as code, and reported the three identifiers this paragraph is about. The
 * sentence the rule fired on was a sentence *describing* the rule. **Three of this repository's checks
 * have now fired on their own documentation, and this is the first one where the fix was the prose and
 * not the reader** — because the prose was carrying a token it had no business carrying.
 *
 * **Widening the allowance was available and was not taken.** Adding `tests/architecture/*.test.ts` to
 * that list would keep the assertion count at **53** and change no rule — and it would also mean an
 * architecture test that *names adapter factories*, which is a decision about the boundary rather than
 * about this document. That decision belongs to the root orchestrator, so the conflict is recorded here
 * and in `design.md` rather than resolved by this file widening a rule to suit itself.
 *
 * ## What it reads instead, and why that is still a measurement
 *
 * The name is extracted from the **declaration** in the adapter's own source — the same shape
 * `boundaries.test.ts`'s own *"stops a client restating a value a shared package already owns"* rule
 * reads — so a rename in `packages/providers` propagates here with no edit. It is **not** a copy:
 * {@link PROVIDER_DISPLAY_NAME_SOURCE} names *files*, and a file that declares no display name makes
 * the case report rather than pass.
 */
const PROVIDER_DISPLAY_NAME_SOURCE: Readonly<Record<string, string>> = {
  mailtm: "packages/providers/src/mailtm.ts",
  guerrilla: "packages/providers/src/guerrilla.ts",
};

/**
 * The shape of a display-name **declaration**, and the only pattern here that is not about markdown.
 *
 * It locates *where a value is assigned*, never *what a claim says*, which is the line
 * `design.md` D3 draws. It requires a double-quoted value in the same breath as the colon so that the
 * `readonly displayName: string;` in `contract.ts` and the `displayName: id` in a test double are both
 * outside it, and the value it captures is a **provider's own** string rather than this file's.
 */
const DISPLAY_NAME_DECLARATION = /displayName:\s*"([^"]+)"/g;

/** Every display name a source declares, with comments already stripped. */
function displayNamesDeclaredIn(source: string): string[] {
  const names: string[] = [];
  for (const match of stripSourceComments(source).matchAll(DISPLAY_NAME_DECLARATION)) {
    const value = match[1];
    if (value !== undefined && !names.includes(value)) names.push(value);
  }
  return names;
}

/**
 * The display name the file mapped to a provider id declares, **or a failure that names the file**.
 *
 * Called from inside the cases rather than resolved once at module scope, because an `expect` that
 * fails during collection is reported against no case at all, and **a check that fires outside a test
 * is a check whose failure nobody is reading.**
 */
function providerDisplayName(id: string): string {
  const path = PROVIDER_DISPLAY_NAME_SOURCE[id];
  expect(path, `no declaring source is mapped for the configured provider "${id}"`).toBeDefined();

  const names = displayNamesDeclaredIn(readRepoFile(path ?? ""));
  expect(
    names.length,
    `"${path ?? ""}" declares ${names.length} display names; exactly one is required`,
  ).toBe(1);

  return names[0] ?? "";
}

/** The display name of every provider id a shipped client configures, de-duplicated. */
function configuredProviderDisplayNames(): string[] {
  return [...new Set([...WEBSITE_PROVIDER_IDS, ...EXTENSION_PROVIDER_IDS])].map(
    providerDisplayName,
  );
}

/**
 * Splits a walked path into segments, on either separator.
 *
 * **Declared once because the same class was spelled three times**, and the third spelling is what the
 * pattern allow-list below reported: the tokenizer reads a pattern's body without its delimiters, so the
 * two occurrences hidden inside template literals produced no capture while the one in plain code did.
 * One declaration means one capture and one allow-list entry, which is what makes the entry checkable.
 */
const PATH_SEGMENTS = /[\\/]/;

/** Every display name any non-test source in `packages/providers` declares. */
function allDeclaredProviderDisplayNames(): string[] {
  const root = "packages/providers/src";
  const names: string[] = [];

  for (const name of readdirSync(join(REPO_ROOT, root), { recursive: true, encoding: "utf8" })) {
    if (!name.endsWith(".ts") || name.split(PATH_SEGMENTS).pop()?.includes(".test.") === true)
      continue;
    for (const declared of displayNamesDeclaredIn(
      readRepoFile(`${root}/${name.split(PATH_SEGMENTS).join("/")}`),
    )) {
      if (!names.includes(declared)) names.push(declared);
    }
  }

  return names;
}

/* ------------------------------------------------------------------------------------------------
 * The website's IndexedDB names, **observed** rather than imported.
 *
 * `DATABASE_NAME` and `STORE_NAME` in `packages/storage/src/browser.ts` are private on purpose — that
 * module's note says a client has no reason to know them and no way to choose. So this file does not
 * import them and does not retype them: it runs `createBrowserStorage()` against a recording `IDBFactory`
 * and reads back what the adapter actually asked the platform for. A rename therefore fails
 * observationally, and **no shipped source is edited to make it checkable.**
 * ---------------------------------------------------------------------------------------------- */

/** What the recording platform was asked for. */
interface PlatformRecord {
  readonly databases: readonly string[];
  readonly stores: readonly string[];
  readonly keys: readonly string[];
}

/**
 * An IDB request whose `onsuccess` fires on a later turn, **after its `result` is populated**.
 *
 * The ordering is the whole of this reader. `packages/storage/src/indexeddb.ts` reads
 * `request.result` *inside* `onsuccess`, so a request that fires before its result is set reports
 * a store that never existed — and the first version did exactly that, reporting
 * `Cannot set properties of undefined (setting 'onversionchange')` as an **unhandled** error
 * while the case that caused it passed, because the reader only ever counted what it had already
 * recorded. **A stub that answers before the question has been fully recorded is a stub that
 * reports its own timing as a fact about the tree.**
 */
function fakeRequest(result: () => unknown = () => undefined): {
  result: unknown;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
} {
  const created = {
    result: undefined as unknown,
    onsuccess: null as ((event: unknown) => void) | null,
    onerror: null as ((event: unknown) => void) | null,
  };

  setTimeout(() => {
    created.result = result();
    created.onsuccess?.({ target: { result: created.result } });
  }, 0);

  return created;
}

/** Records the platform calls `createBrowserStorage()` makes while reading a stored mailbox. */
async function observeWebsiteRecord(): Promise<PlatformRecord> {
  const seen = { databases: [] as string[], stores: [] as string[], keys: [] as string[] };

  const factory = {
    open(name: string): unknown {
      seen.databases.push(name);

      // **One database object, built before the request that reports it.** The adapter's
      // `onsuccess` reads `request.result`, and a database created inside the request's own
      // success path could not be there to be read.
      const database = {
        objectStoreNames: { contains: (store: string) => seen.stores.includes(store) },
        createObjectStore: (store: string): void => {
          seen.stores.push(store);
        },
        close: (): void => undefined,
        onversionchange: null as (() => void) | null,
        transaction: (store: string): unknown => {
          seen.stores.push(store);

          const transaction = {
            objectStore: (asked: string): unknown => {
              seen.stores.push(asked);
              return {
                get: (key: string): unknown => {
                  seen.keys.push(key);
                  return fakeRequest();
                },
              };
            },
            oncomplete: null as (() => void) | null,
            onerror: null as (() => void) | null,
            onabort: null as (() => void) | null,
          };

          // The adapter resolves its read on the **transaction**, not the request, so the
          // transaction's completion is what this stub has to fire.
          setTimeout(() => {
            transaction.oncomplete?.();
          }, 10);
          return transaction;
        },
      };

      return fakeRequest(() => database);
    },
  };

  const previous = Reflect.get(globalThis, "indexedDB");
  Reflect.set(globalThis, "indexedDB", factory);
  try {
    await createBrowserStorage().loadMailbox();
  } finally {
    Reflect.set(globalThis, "indexedDB", previous);
  }

  return {
    databases: [...new Set(seen.databases)],
    stores: [...new Set(seen.stores)],
    keys: [...new Set(seen.keys)],
  };
}

/* ------------------------------------------------------------------------------------------------
 * The claims that are prose: whole sentences the document is required to say, and sentences it is
 * forbidden to say. See rule 1 in the module note for why these are sentences and not patterns.
 * ---------------------------------------------------------------------------------------------- */

/** Sentences the document is **required** to contain, grouped by the requirement that asks for them. */
const REQUIRED_SENTENCES: Readonly<Record<string, readonly string[]>> = {
  "§1 names the association rather than folding it into a sentence about what is not collected": [
    "A hostname association is kept, and section 1 names it",
    "It is the only record here that names a site, and it is listed rather than folded into a sentence about what is not collected",
  ],
  "§1 states the association's four qualifiers, which are decisions rather than reassurance": [
    "Only the hostname is retained for site-mailboxes, and four qualifiers are load-bearing rather than reassuring",
    "The hostname alone",
    "No registrable-domain folding: a.example.com and b.example.com are two different keys, not one",
    "No URL, path, query string, page title or form content is kept",
    "Written only after an insertion lands",
    "The record is written when an address is actually inserted into that page, never when one is merely on offer",
    "One mailbox id, not the address itself",
    "The value is an identifier; the address is already in mailboxes",
    "Removed with everything else",
    "There is no control that removes this association on its own",
  ],
  "§9 states the association in full, which is the record a document that omitted it would mislead about":
    [
      "A map, held in chrome.storage.local under the key site-mailboxes, from a page's hostname to the id of the mailbox an address was inserted on that page",
      "Only after an insertion actually lands in that page's field",
      "A control being offered records nothing; a tab being visited records nothing; a field taking focus records nothing",
      "The hostname, and a mailbox id",
      "The exact hostname, with no registrable-domain folding",
      "No URL, no path, no query string, no page title, no form contents, no field name, no value typed into anything",
      "Until the whole storage area is removed",
      "There is no per-site removal, and no time limit on it",
      "It is not a browsing history: it holds no page you visited, no sequence, and no timestamp",
      "It is a map from a hostname to a mailbox id, and nothing else",
    ],
  "§5 states the removal as a control over the whole area rather than as a promise": [
    "Both clients offer the same control, in the same shape: two steps, and the first press removes nothing",
    "The second press is what removes",
    "What is removed is the whole area, not a named key",
    "Not the current mailbox record, not the collection, not the hostname association by name — the whole thing",
    "A record kind added by a later build is removed by the same control, because the control does not enumerate the record kinds this build knows about",
    "What removal leaves behind is the address itself",
    "Removal deletes this device's note of the address",
    "The address continues to exist at the provider and continues to receive mail until the provider discards it, which is not something SpectreMail decides or can tell you the date of",
    "If the browser refuses, that is what is reported",
    "A removal that did not happen is said not to have happened, in the browser's own words",
    "It is not reported as a success, and it is not reported as safe — on the website's IndexedDB store a refused removal stays queued and completes on its own once the other tab holding it closes, so neither half would be a promise this product could keep",
  ],
  "§7 distinguishes a published figure from one this repository measured": [
    "A provider's figure and a figure measured by this project are different things, and the table says which is which",
    "Nothing in this repository has held a mailbox open long enough to observe either horizon, so every row below is a published statement or an absence",
    "published means the provider states it and this project has not verified it against the live API",
    "unmeasured means neither the provider nor this project has a figure",
    "Neither value appears in any provider's API response, so no client can discover it, and no countdown is derived from it: expiry is decided by an observed signal, never by elapsed time",
  ],
  "§6 states attribution in neither direction and withdraws the quotations that could not be located":
    [
      "Neither provider's attribution requirement has been established, and this document does not resolve it in either direction",
      'Saying "no attribution is required" would be exactly as unsupported as saying one is',
      "Earlier revisions of this project quoted Mail.tm terms requiring attribution",
      "Those quotations could not be located and are withdrawn",
    ],
  "§4 says grounding is not completeness, which is a limit a reader must not have to infer": [
    "Grounding is not completeness",
    "It does not prove that nothing else is collected: proving the absence of a shipped surface cannot be enumerated from the tree without becoming a second boundary suite",
    "Read this list as these claims are checkable, not as nothing else exists",
  ],
  "§3 states the no-relay fact and the no-third-party-asset fact rather than implying them": [
    "SpectreMail operates no server and relays nothing",
    "No SpectreMail page, popup or panel loads anything from another origin",
    "There is no analytics script, no font CDN, no crash reporter and no embedded content",
  ],
  "the document claims no jurisdiction and names no regime": [
    "No jurisdiction has been considered and no compliance regime is named, because naming one would be the single claim in this repository with the least evidence behind it",
  ],
};

/**
 * Sentences that must appear **nowhere** in the document, each with its planted control below.
 *
 * The first is `docs/ROADMAP.md` §29's, named by the roadmap as false while a provider receives the mail.
 * The rest are this change's own statements of the claims being prevented.
 */
const FORBIDDEN_SENTENCES: Readonly<Record<string, readonly string[]>> = {
  "the §29 claim, which is false while a third party receives the mail": [
    "Messages never leave your device",
    "Your mail never leaves your device",
  ],
  "the product described as keeping no record that names a site": [
    "No record of any site is kept",
    "SpectreMail keeps nothing that names a site",
    "No browsing data of any kind is stored",
    "Nothing is recorded about the sites you visit",
  ],
  "removal described as deleting the address rather than this device's note of it": [
    "Removal deletes the address",
    "The address is deleted when you remove it",
    "This removes the address itself",
    "The address is gone once you remove it",
  ],
  "a provider's published figure presented as this repository's measurement": [
    "We measured the seven day retention",
    "This repository measured that messages are kept for seven days",
  ],
};

/**
 * The attribution directions the document must not resolve, **in either direction** (`design.md` D6).
 *
 * Whole sentences, so the document's own sentence *"Saying \"no attribution is required\" would be
 * exactly as unsupported as saying one is"* — which is the **positive** half of D6 — cannot be mistaken
 * for one of these, and so cannot silence the reader.
 */
const FORBIDDEN_ATTRIBUTION_SENTENCES: readonly string[] = [
  "Attribution is required",
  "Attribution is not required",
  "No attribution is required",
  "Mail.tm requires attribution",
  "Guerrilla Mail requires attribution",
  "Neither provider requires attribution",
  "No provider requires attribution",
  "Attribution is required by Mail.tm",
];

/* ------------------------------------------------------------------------------------------------
 * The three surfaces that already carry a privacy-adjacent claim.
 *
 * Checked from **outside all three** (`design.md` D12, task 3.7), so a drift in any one is caught by
 * something that is not that surface. They keep their own wording; what is required is that the
 * document's account is **not contradicted** and that the structures it describes **exist**.
 * ---------------------------------------------------------------------------------------------- */

/** The website's footer, `apps/web/src/sections.ts`'s `LIMITS`. */
const FOOTER_PROVIDER_SENTENCE = LIMITS[0] ?? "";

/** The footer's no-server sentence, declared as the whole entry it has to be. */
const FOOTER_NO_SERVER_SENTENCE =
  "No server is involved. SpectreMail operates no backend and never relays a provider request.";

/**
 * The website's local-data region, `apps/web/src/LocalData.tsx`.
 *
 * **Weaker than the panel's half, and recorded as weaker.** This file keeps its copy inline and exports
 * no copy constant, so the only stable handles are the `data-testid` markers the region already declares
 * and one whole sentence. The panel's copy *is* exported and is compared as data.
 */
const WEBSITE_REMOVAL_SURFACE = {
  file: "apps/web/src/LocalData.tsx",
  /** The markers the second step, the refusal and the report are addressed by. */
  markers: ["local-data-confirmation", "local-data-refused", "local-data-removed"],
  /**
   * How many markers the list above declares, so **the list cannot be edited silently**.
   *
   * Found by the falsification pass and for the reason {@link PANEL_REMOVAL_COPY_KEY_COUNT} gives: a
   * list nothing counts can lose a member and leave every assertion above it satisfied, which is the
   * rot `design.md` D4 names. **This establishes that the declaration is not being quietly weakened; it
   * does not establish that the list is complete** — see that constant for why completeness is not
   * enumerable here at all.
   */
  markerCount: 3,
  /** What the region says the removal leaves behind. */
  saysAddressSurvives: "The address above still works until the provider discards it.",
} as const;

/**
 * Where each client's removal is issued, as **the declared chain of modules that reach the contract**.
 *
 * **The two clients are not the same shape, and the map says so rather than forcing them to be.** The
 * website's session hook holds the `SpectreStorage` contract itself and issues the removal from it. The
 * panel is barred by `PanelRecords` from depending on storage at all — its own module note says the
 * seam exists precisely so the panel does not know `clearAll` is the storage member — so its removal
 * passes through the module that builds the storage.
 *
 * A count is therefore not the claim. **The claim is that a removal reaches the contract from these
 * modules and from no others**, and it is compared as a list in both directions: a third caller is as
 * much a finding as a missing one, because a second surface clearing the area behind the document's
 * back is a surface the document has not disclosed.
 */
const REMOVAL_CHAIN: Readonly<Record<string, readonly string[]>> = {
  website: ["apps/web/src/useMailboxSession.ts"],
  extension: ["apps/extension/src/Panel.tsx", "apps/extension/src/panel-main.tsx"],
};

/** The client source roots the removal chain is searched in, keyed by the same client names. */
const CLIENT_SOURCE_ROOT: Readonly<Record<string, string>> = {
  website: "apps/web/src",
  extension: "apps/extension/src",
};

/**
 * The panel's removal copy, as the keys it declares.
 *
 * `PANEL_COPY_KEYS` is the object's own key list, so a copy entry **added** or **removed** upstream
 * shows up here as a difference — which is the second direction, and the one that rots.
 */
const PANEL_REMOVAL_COPY_KEYS: readonly string[] = [
  "removalHeading",
  "removalHoldsNothingYet",
  "removalOffers",
  "removalConfirmWarning",
  "removalConfirm",
  "removalKeep",
  "removing",
  "removalRefused",
  "removalDone",
  "removalDoneMeans",
];

/**
 * How many keys the list above declares, so **the list cannot be edited without this file noticing**.
 *
 * ## Why a hand-written count, and what it does and does not establish
 *
 * **The falsification pass deleted `removalDoneMeans` from the list and the whole file stayed green.**
 * That is not a broken mutant and it is not a weak assertion: `expect.arrayContaining` is a *subset*
 * assertion, so a smaller list is trivially contained in a larger key list; the per-key loop then covers
 * fewer keys and still passes; and the one sentence the specification cares about — *"the panel cannot
 * be read as deleting the address"* — is read from `PANEL_COPY.removalDoneMeans` **by name**, so it is
 * unaffected. The mutation was exactly what it claimed: a hand-written declaration can lose a member
 * silently.
 *
 * **The reverse direction a reader would reach for is not available here, and saying so is the point.**
 * It would need to enumerate the *removal* keys out of `PANEL_COPY_KEYS` — every entry of the copy
 * object, most of which are not removal copy — and the only way to do that is a predicate over the name
 * (`/^removal/`), which is **exactly the pattern-matched claim `design.md` D3 forbids** and exactly the
 * sweep that would report a correctly-named copy entry as a violation. Deriving the list instead of
 * declaring it would make the check check itself. `panel-copy.ts`'s own chooser list records the same
 * reasoning for the same reason.
 *
 * **So the count is the strongest check this shape allows**, and its honest claim is **that the
 * declaration is not being quietly weakened** — not that it is complete. A removal key *added* to
 * `PANEL_COPY` without being added here is a gap this file does not close, and it is recorded as one.
 */
const PANEL_REMOVAL_COPY_KEY_COUNT = 10;

/** The panel module that renders those copy constants, as a declared path. */
const PANEL_MODULE = "apps/extension/src/Panel.tsx";

/* ------------------------------------------------------------------------------------------------
 * Shared comparisons, so a falsification arm and its control run the *same* code path.
 * ---------------------------------------------------------------------------------------------- */

/** The keys **any** markdown text's §1 table declares. */
function declaredExtensionKeys(markdown: string): string[] {
  return rowsOf(markdown, SECTION.extension, ["key in chrome.storage.local", "what it holds"]).map(
    (row) => row[0] ?? "",
  );
}

/** Compares a declared key list against the adapter-owned set, **in both directions**. */
function keyDisagreements(declared: readonly string[]): { omitted: string[]; unowned: string[] } {
  return {
    omitted: [...ADAPTER_OWNED_KEYS].filter((key) => !declared.includes(key)).sort(),
    unowned: declared.filter((key) => !ADAPTER_OWNED_KEYS.has(key)).sort(),
  };
}

/** Runs the forbidden-sentence reader over any markdown text, reporting every literal it finds. */
function forbiddenSentencesIn(markdown: string, forbidden: readonly string[]): string[] {
  const sentences = new Set(sentencesOf(markdown));
  return forbidden.filter((sentence) => sentences.has(sentence));
}

/** Runs the attribution-direction reader over any markdown text. */
function attributionDirectionsIn(markdown: string): string[] {
  const rows = rowsOf(markdown, SECTION.attribution, ["provider", "what was actually verified"]);
  const cells = rows.map((row) => row[1] ?? "").join(" ");
  return FORBIDDEN_ATTRIBUTION_SENTENCES.filter((sentence) =>
    new Set(sentencesOf(cells)).has(sentence),
  );
}

/**
 * Why a *does-not-collect* support pointer is refused, or `null` when it is acceptable.
 *
 * A **reason** rather than a boolean, because the requirement is that the check fails *"on that reason
 * rather than passing because the sentence exists"*: a boolean cannot distinguish *"this document is not a
 * support"* from *"that heading does not exist"*, and the repair for the second is exactly the thing the
 * first exists to forbid — adding a heading to the document and pointing at it. Returning the reason is
 * what lets the control assert which of the two fired.
 */
function supportRefusal(pointer: string): string | null {
  if (pointer.length === 0) {
    return "the entry names no support at all";
  }

  const [path = "", fragment = ""] = pointer.split("#");

  if (path === PRIVACY_PATH) {
    return "the document supports its own claim";
  }
  if (fragment.length === 0) {
    return "the support names a file but no heading";
  }

  let target: string;
  try {
    target = readRepoFile(path);
  } catch {
    return `"${path}" is not a file this repository carries`;
  }

  if (!slugsIn(target).includes(fragment)) {
    return `"${path}" has no heading "${fragment}"`;
  }

  return null;
}

/** Counts **contract calls** — `something.clearAll(` — in a module, with comments already stripped. */
function countClearAllCalls(code: string): number {
  return code.split(`.clearAll(`).length - 1;
}

/* ================================================================================================
 * 1. THE POSITIVE CONTROL. Nothing below is trusted until the map is shown to agree with the tree.
 * ================================================================================================ */

test("the declared storage records agree with the shipped adapters, in both directions", () => {
  const declared = declaredExtensionKeys(PRIVACY);

  expect(declared.length, "one declared row per record the adapters own").toBe(
    ADAPTER_OWNED_KEYS.size,
  );
  expect(keyDisagreements(declared), "the §1 table against the exported key constants").toEqual({
    omitted: [],
    unowned: [],
  });
});

test("the website's declared record agrees with what its adapter asks the platform for", async () => {
  const observed = await observeWebsiteRecord();

  expect(observed.databases.length, "one database is opened").toBe(1);
  expect(observed.stores.length, "one object store is used").toBe(1);
  expect(observed.keys, "one key is read").toEqual([CURRENT_MAILBOX_KEY]);

  const rows = rowsIn(SECTION.website, ["database", "object store", "key", "what it holds"]);

  expect(rows.length, "one declared row").toBe(1);
  expect(rows[0]?.slice(0, 3), "database, store and key, as observed from the adapter").toEqual([
    observed.databases[0] ?? "",
    observed.stores[0] ?? "",
    CURRENT_MAILBOX_KEY,
  ]);
});

test("the declared provider origins agree with the manifest and with each client's configured list", () => {
  // Every configured id can be named by the document at all.
  for (const id of [...WEBSITE_PROVIDER_IDS, ...EXTENSION_PROVIDER_IDS]) {
    expect(
      PROVIDER_ORIGIN[id],
      `no origin is recorded for the configured provider "${id}"`,
    ).toBeDefined();
  }

  // Every origin recorded here is one the extension actually declares and actually configures.
  for (const [id, origin] of Object.entries(PROVIDER_ORIGIN)) {
    expect(DECLARED_HOST_ORIGINS.has(origin), `"${id}"'s origin is not a host permission`).toBe(
      true,
    );
    expect([...EXTENSION_PROVIDER_IDS], `"${id}" is not configured for the extension`).toContain(
      id,
    );
  }

  // And the manifest declares nothing this map cannot account for.
  expect(
    [...DECLARED_HOST_ORIGINS].filter((origin) => !Object.values(PROVIDER_ORIGIN).includes(origin)),
    "host permissions no configured provider accounts for",
  ).toEqual([]);

  // Per client, the document's row is exactly the origins that client reaches. **The split is the
  // claim**, so it is compared per client rather than as one union.
  const rows = rowsIn(SECTION.providers, ["client", "provider origins it reaches"]);
  expect(rows.length, "one row per client").toBe(2);

  for (const [client, configured] of [
    ["Website", WEBSITE_PROVIDER_IDS],
    ["Extension", EXTENSION_PROVIDER_IDS],
  ] as const) {
    const row = rows.find((candidate) => candidate[0] === client);
    expect(row, `the document declares no row for the ${client}`).toBeDefined();
    expect(
      (row?.[1] ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .sort(),
      `the ${client}'s declared origins`,
    ).toEqual(configured.map((id) => PROVIDER_ORIGIN[id] ?? "").sort());
  }
});

test("the declared permissions agree with the manifest, in both directions", () => {
  const rows = rowsIn(SECTION.permissions, ["permission", "the feature that needs it"]);

  const declared = rows.map((row) => row[0] ?? "");
  expect(
    [...DECLARED_PERMISSIONS].filter((permission) => !declared.includes(permission)),
    "declared permissions the document omits",
  ).toEqual([]);
  expect(
    declared.filter((permission) => !DECLARED_PERMISSIONS.has(permission)),
    "permissions the document names and the manifest does not declare",
  ).toEqual([]);

  // Every row justifies its permission with a non-empty feature, so the table cannot pass as a column
  // of names with a column of blanks beside it.
  for (const row of rows) {
    expect(row[1]?.length ?? 0, `the feature justifying "${row[0] ?? ""}"`).toBeGreaterThan(0);
  }

  // **The justification itself is not checked here.** `apps/extension/e2e/manifest.spec.ts` holds a
  // permission → the-call-that-reaches-it map, and a rule added where an instrument already exists is
  // not coverage (`design.md` D2). This table's claim is only that a *named* permission is a
  // *declared* one, in both directions — which is a `tabs`-proof check, where a pattern-based absence
  // scan would have reported the deliberately-undeclared permission as a failure.
  expect(DECLARED_PERMISSIONS.has("tabs"), "`tabs` is deliberately undeclared").toBe(false);
});

test("every does-not-collect entry names a support that resolves outside the document", () => {
  const rows = rowsIn(SECTION.notCollected, [
    "what SpectreMail does not collect",
    "what supports it",
  ]);

  expect(rows.length, "the list has one entry per claim").toBeGreaterThan(0);

  const refusals = rows
    .map((row) => ({ claim: row[0] ?? "", reason: supportRefusal(row[1] ?? "") }))
    .filter((entry) => entry.reason !== null);

  expect(
    refusals.map((entry) => `${entry.claim} → ${entry.reason ?? ""}`),
    "entries whose support does not resolve",
  ).toEqual([]);
});

test("every required sentence is present, as whole sentences", () => {
  const missing: string[] = [];
  for (const [group, sentences] of Object.entries(REQUIRED_SENTENCES)) {
    for (const sentence of sentences) {
      if (!PRIVACY_SENTENCES.has(sentence)) {
        missing.push(`${group} → ${sentence}`);
      }
    }
  }
  expect(missing, "sentences the document does not contain").toEqual([]);
});

test("the lifecycle table's status column is a closed vocabulary, and both providers are covered", () => {
  const vocabulary = ["published", "unmeasured", "measured"];
  const rows = rowsIn(SECTION.lifecycle, ["figure", "value", "status"]);

  for (const row of rows) {
    expect(vocabulary, `"${row[0] ?? ""}" declares the status "${row[2] ?? ""}"`).toContain(
      row[2] ?? "",
    );
    expect(row[1]?.length ?? 0, `the value for "${row[0] ?? ""}"`).toBeGreaterThan(0);
  }

  // Both directions against the providers the product reaches: a provider that publishes no figure must
  // be declared unmeasured rather than left out of the table.
  const declaredText = rows.flatMap((row) => [...row]).join(" ");
  for (const displayName of configuredProviderDisplayNames()) {
    expect(declaredText, `the lifecycle table names no row for ${displayName}`).toContain(
      displayName,
    );
  }
  expect(
    rows.some((row) => row[2] === "unmeasured"),
    "a provider publishes no figure, so at least one row must be unmeasured",
  ).toBe(true);
  expect(
    rows.some((row) => row[2] === "published"),
    "a provider does publish figures, so at least one row must be published",
  ).toBe(true);
});

test("every display name the provider package declares is one this file can name, and every configured provider has one", () => {
  // **Precondition on the scan, before anything claims to have found nothing.** A reader that
  // returned nothing would satisfy both directions below with no effort at all, and the recorded
  // defect is a sweep matching nothing reading as agreement.
  const declaredByPackage = allDeclaredProviderDisplayNames();
  expect(
    declaredByPackage,
    "packages/providers declares no display name for this check to watch",
  ).not.toEqual([]);

  // Direction one: a name the package declares that no configured provider maps to. This is the case
  // that catches **a third provider being added** — the map would not know about it, and the document
  // would have no row to check.
  expect(
    declaredByPackage.filter((name) => !configuredProviderDisplayNames().includes(name)),
    "display names the provider package declares and no configured provider maps to",
  ).toEqual([]);

  // Direction two: a configured provider whose mapped file declares nothing, or two.
  expect(
    [...new Set([...WEBSITE_PROVIDER_IDS, ...EXTENSION_PROVIDER_IDS])].filter(
      (id) => PROVIDER_DISPLAY_NAME_SOURCE[id] === undefined,
    ),
    "configured providers with no declaring source mapped",
  ).toEqual([]);

  // **And the reader is shown a declaration it can see**, because everything above says what must not
  // be there and nothing says the extractor works on the shape it is pointed at.
  expect(
    displayNamesDeclaredIn('const adapter: MailProvider = { displayName: "Planted Provider" };'),
    "the declaration reader cannot see a planted declaration",
  ).toEqual(["Planted Provider"]);
  // And it does not see the two shapes it is deliberately outside: a type and an identifier.
  expect(
    displayNamesDeclaredIn(
      'readonly displayName: string;\nconst other = { displayName: id };\n// displayName: "In a comment";',
    ),
    "the declaration reader reports a type, a test double, or a comment",
  ).toEqual([]);
});

test("the attribution table names both absences and resolves in neither direction", () => {
  const rows = rowsIn(SECTION.attribution, ["provider", "what was actually verified"]);

  expect(
    rows.map((row) => row[0] ?? "").sort(),
    "one row per provider the product reaches",
  ).toEqual([...new Set(configuredProviderDisplayNames())].sort());
  expect(attributionDirectionsIn(PRIVACY), "directions the table resolves attribution in").toEqual(
    [],
  );

  // Both absences named as measurements rather than implied.
  //
  // **Three of these four assertions were wrong about the world, and this change is what proved it.**
  // They used to read: `"No terms page exists."`, `toContain("https://mail.tm/terms")`,
  // `"Nothing this repository found."` — **and the second of the three was a rule that fired to keep
  // a false claim in place.** `https://mail.tm/terms` really does return 404, and the suite asserted
  // the document must *contain that URL*, so correcting the row's sentence was enough to turn this
  // suite red. That is the mirror of `security-surface-review`'s *"a rule that fires without a
  // requirement behind it"*: **a rule that fires against the correction because the rule encodes
  // the falsehood.**
  //
  // What replaced them is the property rather than the sentence. **A `404` on a probed path is
  // evidence that that path is not served, and not evidence about the site** — so the assertion now
  // requires the row to name the routes tried, which is what makes it true whatever any single
  // route returns.
  const mailTm = rows.find((row) => row[0] === providerDisplayName("mailtm"))?.[1] ?? "";
  expect(mailTm, "Mail.tm's terms are named as not located at the routes tried").toContain(
    "No terms document was located at any of the routes tried.",
  );
  expect(mailTm, "the 404 is the measurement, not an inference").toContain("https://mail.tm/terms");
  expect(mailTm, "the locale-prefixed routes are named too").toContain("/en/terms/");
  expect(mailTm, "the date the routes were tried is stated").toContain("2026-10-16");

  const guerrilla = rows.find((row) => row[0] === providerDisplayName("guerrilla"))?.[1] ?? "";
  expect(guerrilla, "Guerrilla Mail's terms are named as read").toContain(
    "https://www.guerrillamail.com/tos",
  );
  expect(
    guerrilla,
    "the silence is stated, and stated as neither a permission nor a prohibition",
  ).toContain("neither a permission nor a prohibition");
  expect(guerrilla, "the date the terms were read is stated").toContain("2026-10-16");
});

test("the removal is declared as two steps, and the document is reachable from the project", () => {
  expect(
    rowsIn(SECTION.removal, ["step", "what it does"]).map((row) => row[0]),
    "the declared steps, in order",
  ).toEqual(["offer", "confirm"]);

  expect(
    readRepoFile("README.md")
      .split("\n")
      .filter((line) => line.includes(PRIVACY_PATH)).length,
    "exactly one link to the document from the README",
  ).toBe(1);
});

/* ================================================================================================
 * 2. THE THREE SURFACES, CHECKED FROM OUTSIDE ALL THREE.
 * ================================================================================================ */

test("the footer's provider sentence names the provider the website is configured for", () => {
  const websiteProviders = WEBSITE_PROVIDER_IDS.map((id) => providerDisplayName(id));
  const extensionOnly = EXTENSION_PROVIDER_IDS.filter(
    (id) => !WEBSITE_PROVIDER_IDS.includes(id as (typeof WEBSITE_PROVIDER_IDS)[number]),
  ).map((id) => providerDisplayName(id));

  for (const name of websiteProviders) {
    expect(FOOTER_PROVIDER_SENTENCE, `the footer names ${name}`).toContain(name);
  }
  for (const name of extensionOnly) {
    expect(
      FOOTER_PROVIDER_SENTENCE,
      `the footer names ${name}, which a web page cannot reach`,
    ).not.toContain(name);
  }

  expect([...LIMITS], "the no-server sentence the document reports").toContain(
    FOOTER_NO_SERVER_SENTENCE,
  );
});

test("each client reaches the removal contract from the modules the map declares, and from no others", () => {
  expect(
    Object.keys(REMOVAL_CHAIN).sort(),
    "every client with a declared chain, and both roots declared for it",
  ).toEqual(Object.keys(CLIENT_SOURCE_ROOT).sort());

  for (const [client, declared] of Object.entries(REMOVAL_CHAIN)) {
    const root = CLIENT_SOURCE_ROOT[client] ?? "";
    // Forward-slashed, because `readdirSync` answers with this platform's separator and a declared
    // path written with forward slashes is the spelling every other declaration in this file uses.
    const modules = readdirSync(join(REPO_ROOT, root), { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => `${root}/${name.split(PATH_SEGMENTS).join("/")}`);

    const callers = modules
      .map((path) => ({ path, count: countClearAllCalls(stripSourceComments(readRepoFile(path))) }))
      .filter((entry) => entry.count > 0);

    // **Sorted, and the reason is that filesystem order is not a claim.** The removal *steps* in §5 are
    // compared in order, because the order is the requirement; the order of modules on a disk is not.
    expect(
      callers.map((entry) => entry.path).sort(),
      `${client}: modules that call the contract`,
    ).toEqual([...declared].sort());

    // **The leading dot is the whole mechanism, and the reason is stated rather than left to be
    // discovered.** `apps/web/src/storage-stub.ts` declares `async clearAll(): Promise<void>` — the
    // *stub* of the contract, not a call to it — and counting the bare identifier reads a test double
    // as a shipped removal site. Every caller in both chains is `something.clearAll(`, and no
    // declaration can be.
    for (const entry of callers) {
      expect(entry.count, `${client}: ${entry.path} calls it once`).toBe(1);
    }
  }
});

test("the website's local-data region declares the second step, the refusal and the surviving address", () => {
  const source = stripSourceComments(readRepoFile(WEBSITE_REMOVAL_SURFACE.file));

  // Same shape, and same reason, as the panel list above: a marker list nothing counts loses a member
  // silently. **The count is what makes the list non-editable, not what makes it complete.**
  expect(
    WEBSITE_REMOVAL_SURFACE.markers.length,
    "the declared marker list has lost or gained a member without the count being updated with it",
  ).toBe(WEBSITE_REMOVAL_SURFACE.markerCount);

  for (const marker of WEBSITE_REMOVAL_SURFACE.markers) {
    expect(source, `${WEBSITE_REMOVAL_SURFACE.file} declares no "${marker}"`).toContain(
      `data-testid="${marker}"`,
    );
  }

  expect(
    source.includes(WEBSITE_REMOVAL_SURFACE.saysAddressSurvives),
    "the region says the address survives its own removal",
  ).toBe(true);

  // It must not enumerate keys: it offers the whole area, and naming the keys would be a claim about
  // which records exist that this region has no way to act on.
  for (const key of ADAPTER_OWNED_KEYS) {
    expect(source, `${WEBSITE_REMOVAL_SURFACE.file} names the key "${key}"`).not.toContain(key);
  }
});

test("the panel's removal copy is declared as data and rendered from those constants", () => {
  // **First, because `arrayContaining` is a subset assertion and says nothing about a list's size.**
  // A falsification arm deleted a key from the declared list and this case stayed green without it.
  expect(
    PANEL_REMOVAL_COPY_KEYS.length,
    "the declared removal-copy list has lost or gained a member without the count being updated with it",
  ).toBe(PANEL_REMOVAL_COPY_KEY_COUNT);

  expect([...PANEL_COPY_KEYS], "the panel's own key list").toEqual(
    expect.arrayContaining([...PANEL_REMOVAL_COPY_KEYS]),
  );

  const panelSource = stripSourceComments(readRepoFile(PANEL_MODULE));
  for (const key of PANEL_REMOVAL_COPY_KEYS) {
    expect(panelSource, `${PANEL_MODULE} never renders PANEL_COPY.${key}`).toContain(
      `PANEL_COPY.${key}`,
    );
    expect(
      normaliseProse(String(PANEL_COPY[key as keyof typeof PANEL_COPY])),
      `PANEL_COPY.${key} is empty`,
    ).not.toBe("");
  }

  // And it says the address is not what went, so the panel cannot be read as deleting it.
  expect(normaliseProse(String(PANEL_COPY.removalDoneMeans))).toContain("address");
});

/* ================================================================================================
 * 3. THE FORBIDDEN CLAIMS, each shown it can fire.
 *
 * Every case below plants its sentence into a **copy of the real document** and runs the **same**
 * reader. This is the fifth place in this repository that has needed such a control, and the reason is
 * the sentence now earned five times: **a sweep matching nothing satisfies every assertion above it.**
 * ================================================================================================ */

test("no forbidden sentence appears, and the reader finds each one when it is planted", () => {
  for (const [reason, forbidden] of Object.entries(FORBIDDEN_SENTENCES)) {
    expect(forbiddenSentencesIn(PRIVACY, forbidden), reason).toEqual([]);

    for (const literal of forbidden) {
      const planted = `${PRIVACY}\n\n${literal}.\n`;
      expect(
        forbiddenSentencesIn(planted, forbidden),
        `the planted control for: ${reason}`,
      ).toEqual([literal]);
    }
  }
});

test("the attribution reader reports a planted sentence in either direction", () => {
  const guerrilla = providerDisplayName("guerrilla");

  for (const planted of FORBIDDEN_ATTRIBUTION_SENTENCES) {
    // **The period belongs to the planted prose, not to the expectation.** The first version wrote
    // `toEqual([`${planted}.`])` and reported a reader that had correctly found the sentence — the
    // reader returns the *forbidden literal*, which carries no period because a reader that
    // returned the text it found could be satisfied by any suffix. **An expectation shaped like the
    // reader's input rather than like the reader's output is a reader's defect reported as its
    // success.**
    const withRow = insertTableRow(
      PRIVACY,
      SECTION.attribution,
      ["provider", "what was actually verified"],
      guerrilla,
      `| ${guerrilla} | ${planted}. |`,
    );

    expect(
      withRow.length,
      `the planted row for "${planted}." really added a line to the table`,
    ).toBeGreaterThan(PRIVACY.length);
    expect(attributionDirectionsIn(withRow), `"${planted}." is not reported`).toEqual([planted]);
  }
});

test("a pointer into the document itself is refused as a support, on that reason rather than a missing heading", () => {
  // The pointer the requirement names: another part of the document. The heading **exists**, so the
  // only reason left to refuse it is the self-reference — which is why the reason is what is asserted
  // and not a boolean.
  expect(
    supportRefusal(`${PRIVACY_PATH}#4-what-spectremail-does-not-collect`),
    "the document is refused as its own support",
  ).toBe("the document supports its own claim");

  // The heading genuinely is there, so the refusal above cannot be an accident of a bad fragment. If it
  // were, the repair would be "add a heading and point at it" — which is the thing the rule forbids.
  expect(slugsIn(readRepoFile(PRIVACY_PATH)), "the pointed-at heading does exist").toContain(
    "4-what-spectremail-does-not-collect",
  );

  // And the other three refusals fire, so the rule is not a single `if` that happens to be true.
  expect(supportRefusal(""), "an entry naming no support").toBe(
    "the entry names no support at all",
  );
  expect(supportRefusal("docs/PROVIDERS.md"), "a support naming no heading").toBe(
    "the support names a file but no heading",
  );
  expect(supportRefusal("docs/NOPE.md#anything"), "a file this repository does not carry").toBe(
    '"docs/NOPE.md" is not a file this repository carries',
  );
  expect(supportRefusal("docs/PROVIDERS.md#no-such-heading"), "a heading that does not exist").toBe(
    '"docs/PROVIDERS.md" has no heading "no-such-heading"',
  );

  // **And the reader still accepts what the document actually declares**, so none of the four refusals
  // above is a refusal of everything. A reader that refuses every pointer passes all five.
  expect(supportRefusal("docs/PROVIDERS.md#2-mailtm"), "a real support").toBeNull();
});

test("the key reader reports an omission in one direction and a stale name in the other", () => {
  // The agreement, first — the same comparison the first case in this file makes against the real file.
  expect(keyDisagreements(declaredExtensionKeys(PRIVACY)), "as shipped").toEqual({
    omitted: [],
    unowned: [],
  });

  // Direction one: the document loses the row for a key the adapters still own. This is the case
  // `design.md` D1 exists for — a record the product keeps and the document does not disclose.
  const withoutAssociation = PRIVACY.split("\n")
    .filter((line) => !(line.startsWith("| ") && line.includes(EXTENSION_SITE_MAILBOXES_KEY)))
    .join("\n");
  expect(
    withoutAssociation.length,
    "the planted omission really removed a line from the document",
  ).toBeLessThan(PRIVACY.length);
  expect(keyDisagreements(declaredExtensionKeys(withoutAssociation)), "the omission").toEqual({
    omitted: [EXTENSION_SITE_MAILBOXES_KEY],
    unowned: [],
  });

  // Direction two: the document names a key no adapter writes — a stale name left behind by a rename,
  // and the likelier of the two failures, because a privacy document is prose edited without running
  // anything.
  //
  // **Planted structurally, through the same locator the reader uses, and the reason is that the first
  // version planted it with a pattern.** `PRIVACY.replace(/^(\| \`seen-messages\` \|[^\n]*)$/m, …)`
  // matched nothing — Prettier pads a table's first column, so the row is
  // `| \`seen-messages\`               | …` and the pattern's single space was never there. The control
  // therefore reported `expected 14293 to be greater than 14293`: a planting that inserted nothing,
  // failing a check that exists to prove the reader fires. **A control whose own defect is invisible
  // is indistinguishable from a reader that cannot fire, and the two are opposite findings.**
  const withStaleName = insertTableRow(
    PRIVACY,
    SECTION.extension,
    ["key in chrome.storage.local", "what it holds"],
    EXTENSION_SEEN_MESSAGES_KEY,
    "| `last-opened-site` | The page a mailbox was last read on. |",
  );
  expect(
    withStaleName.length,
    "the planted stale name really added a line to the document",
  ).toBeGreaterThan(PRIVACY.length);
  expect(keyDisagreements(declaredExtensionKeys(withStaleName)), "the stale name").toEqual({
    omitted: [],
    unowned: ["last-opened-site"],
  });
});

test("the per-client origin split cannot be flattened into one set", () => {
  const rows = rowsIn(SECTION.providers, ["client", "provider origins it reaches"]);

  const website = rows.find((row) => row[0] === "Website")?.[1] ?? "";
  const extensionRow = rows.find((row) => row[0] === "Extension")?.[1] ?? "";

  expect(website.split(",").length, "the website reaches exactly one origin").toBe(
    WEBSITE_PROVIDER_IDS.length,
  );
  expect(website, "the website's row names Mail.tm, which a web page cannot reach").not.toContain(
    PROVIDER_ORIGIN["mailtm"] ?? "",
  );
  expect(
    extensionRow
      .split(",")
      .map((origin) => origin.trim())
      .sort(),
  ).toEqual(EXTENSION_PROVIDER_IDS.map((id) => PROVIDER_ORIGIN[id] ?? "").sort());
});

/* ================================================================================================
 * 4. THIS FILE'S OWN SHAPE. A tool that also checks its own work cannot report its own defect.
 * ================================================================================================ */

/**
 * The complete set of regular-expression literals this file is allowed to contain.
 *
 * Written out rather than derived, because "no reader matches a claim by pattern" would otherwise be a
 * statement about this comment. They are all **structural** — markdown shape, table shape, path shape,
 * this file's own token syntax — and none of them is given a claim's text as its input, which is what
 * `design.md` D3 rejects. A new pattern has to be added here, and adding one is a decision somebody has
 * to look at.
 *
 * **What this check does not establish, stated so it is not read as more than it is.** It establishes
 * that every pattern in the file is declared and structural. It does not establish that no declared
 * pattern is harmless, and it does not prove D3 — the claim *"no claim is matched by pattern"* is held
 * by the **shape of the comparisons above** (a whole sentence from a hand-written list, or a table cell
 * against an imported constant), which a list of pattern strings can only summarise.
 */
const ALLOWED_PATTERNS: readonly string[] = [
  // -- this file's own TypeScript tokenizer (`scanSource`) ------------------------------------------------
  "\\s+$", // "the last non-whitespace character", which decides whether a `/` divides or opens
  "[)\\]}\\w$]", // the same question asked as "what may precede a `/` that opens a pattern"
  "[a-z]", // the flag letters of a pattern literal, which are not part of its body
  "\\/\\*[\\s\\S]*?\\*\\/", // a block comment
  "^[ \\t]*\\/\\/.*$", // a line comment

  // -- markdown shape, and nothing else (`sentencesOf`, `sectionsOf`, `slugsIn`) -------------------------
  // `normaliseProse`'s three markers are **not** here, because it removes them with `replaceAll` rather
  // than with a pattern. It used to carry a `/[*_\`]/g`, and the backtick inside that character class
  // desynchronised `boundaries.test.ts`'s `stripComments` — which does not recognise regex literals — for
  // the rest of the file. **An allow-list entry is not a neutral list: keeping the pattern would have
  // meant keeping the red gate**, so the pattern went and the entry went with it. See `normaliseProse`.
  "\\s+", // whitespace collapsed so a sentence survives the line break its source has
  "^#{1,6} ", // an ATX heading at any depth
  "^## ", // the `## ` section boundary
  "^\\|", // a table row, read as data rather than as prose
  "^---+$", // a thematic break
  "\\.\\s+", // a sentence boundary
  "\\.$", // the trailing period of the last sentence in a run

  // -- path shape (`PATH_SEGMENTS`) ---------------------------------------------------------------------------
  // The two separators `readdirSync` may answer with. The tokenizer keeps a pattern's body without its
  // delimiters, so the capture is `[\\` and not `[\\/]` — written here as it is captured, because an
  // allow-list entry that is not the exact string the reader produces fails the *other* half of this case.
  "[\\\\",

  // -- table shape (`tablesWithHeader`) ------------------------------------------------------------------
  "^-{3,}$", // the separator row, per cell
  // -- a field **declaration** (`DISPLAY_NAME_DECLARATION`), not a claim ------------------------------------------------
  // It locates where a value is assigned in `packages/providers`' own source. The captured text is a
  // provider's own string; the pattern is never given a sentence from the document or a surface.
  'displayName:\\s*"([^"]+)"',
  // -- anchor shape (`slugOf`) ---------------------------------------------------------------------------
  "[^a-z0-9 -]", // everything GitHub's anchor drops
  "\\s", // the spaces that become hyphens
];

/** This file's own source, read once. It is the subject of the two cases below, not of the ones above. */
const SOURCE = readRepoFile("tests/architecture/privacy-disclosure.test.ts");

/**
 * The boundary suite's module name, **assembled at runtime rather than written as a literal**.
 *
 * A literal would defeat the case it serves: an import specifier is a *string*, and this check has
 * to read text with strings kept, so the needle it looks for is the very text the needle's own
 * declaration would contain. **A check that has to name what it forbids cannot hold that
 * declaration in its own source**, so the name is built from two halves and never appears
 * contiguously here.
 */
const BOUNDARIES_MODULE = ["boundaries", "test"].join(".");

/**
 * The import shapes that would pull a reader in from the boundary suite.
 *
 * **Strings are kept in this reader, and that is the correction.** The first version read this
 * file with {@link codeOnly} — comments *and string literals* removed — which is right for the
 * identifier check below and **structurally blind to an import**, because a module specifier is
 * itself a string literal. The planted control therefore could not fire: the probe's own
 * specifier was stripped along with everything else, and the case reported a planted import that
 * it had just deleted. **A reader that removes the only form of the thing it is looking for is not
 * a weak reader; it is a reader that can never fire.**
 */
const BOUNDARY_IMPORT_SHAPES: readonly string[] = [
  `from "./${BOUNDARIES_MODULE}"`,
  `from "../architecture/${BOUNDARIES_MODULE}"`,
  `from "${BOUNDARIES_MODULE}"`,
];

/**
 * Every boundary-suite import shape a source declares, **read through the strings-kept reader**.
 *
 * **The assertion and its control both call this, and the first version did not — which is the finding
 * the falsification pass produced for this case.** The assertion read `stripSourceComments(SOURCE)`
 * inline while the control called `stripSourceComments(probe)` inline as well, so the two halves named
 * the same reader without *going through* anything that could be mutated: replacing either
 * `stripSourceComments(...)` call with `codeOnly(...)` — which is precisely the defect this case's own
 * comment describes — left the whole file **green**, because the control kept reading with the reader
 * that still worked. **A control that calls the reader is not a control on the assertion; it is a
 * second, independent use of the same reader, and a mutation of the first one is invisible to it.**
 *
 * One function, called by both halves, is what makes the pair one property rather than two
 * assertions that happen to agree.
 */
function boundaryImportsIn(source: string): string[] {
  return BOUNDARY_IMPORT_SHAPES.filter((shape) => stripSourceComments(source).includes(shape));
}

test("this file contains no pattern beyond the structural allow-list", () => {
  // Read with the **string literals already removed**, which is what makes this check about patterns
  // rather than about prose: a path like `apps/web/src` or a markdown fragment in a comment is not a
  // pattern, and counting one is the recorded shape of a sweep that fires on its own documentation.
  const found = regexLiteralsIn(SOURCE);

  expect(
    found.filter((pattern) => !ALLOWED_PATTERNS.includes(pattern)),
    "patterns in this file that are not structural",
  ).toEqual([]);
  expect(
    ALLOWED_PATTERNS.filter((pattern) => !found.includes(pattern)),
    "declared patterns this file no longer contains, which is how a stale allow-list entry would be found",
  ).toEqual([]);
});

test("the pattern extractor finds a pattern when one is planted, and ignores one written as text", () => {
  const planted = "const PLANTED = /never-a-claim[0-9]+/g;";
  expect(
    regexLiteralsIn(`${SOURCE}\n${planted}\n`),
    "the extractor does not see a pattern planted into code",
  ).toContain("never-a-claim[0-9]+");

  // And it does not report a pattern that only ever appears inside a string or a comment, which is the
  // other half: a reader that counted those would have made the check above pass for the wrong reason.
  const quoted = 'const QUOTED = "/not-a-pattern[0-9]+/";\n// /also-not-a-pattern[0-9]+/\n';
  expect(
    regexLiteralsIn(`${SOURCE}\n${quoted}\n`).filter(
      (pattern) => pattern.startsWith("not-a-pattern") || pattern.startsWith("also-not-a-pattern"),
    ),
    "a pattern written inside a string or a comment is not a pattern",
  ).toEqual([]);
});

test("this file shares no reader with the boundary suite, and adds nothing to the boundary count", () => {
  // **Two readers, because the two claims have different shapes.** An *identifier* is code, so it is
  // read with comments **and strings** removed — which is what keeps this file's own expectation
  // literals (the very strings being forbidden) out of the comparison; a raw-text read of this file
  // matched the assertion that makes it and reported the independence this case exists to establish.
  const code = codeOnly(SOURCE);
  expect(code, "this file calls a boundary scan function").not.toContain("boundariesViolations");

  // An *import specifier* is a string, so it is read with comments removed and strings kept — see
  // *one* wrong one, and {@link boundaryImportsIn} for why both halves below go **through** that
  // reader rather than each calling it themselves.
  expect(boundaryImportsIn(SOURCE), "this file imports a reader from the boundary suite").toEqual(
    [],
  );

  // **The control, in both directions and for both readers.** A reader that simply failed to look
  // would satisfy the assertions above, so a probe is planted in this file's own shape and the
  // *same* comparison is required to report it — one probe per reader, because one reader saying
  // nothing about the other's shape would leave the pair half-falsifiable. **Both probes are read
  // through the functions the assertions above use**, so a reader the assertions have stopped using
  // is a reader this control can no longer hide; that is the defect the falsification pass found here.
  const probe = `import { boundariesViolations } from "./${BOUNDARIES_MODULE}";`;
  expect(
    boundaryImportsIn(probe),
    "the planted import is not reported by the reader the assertion above uses",
  ).toEqual([`from "./${BOUNDARIES_MODULE}"`]);
  expect(
    codeOnly(probe),
    "the planted import is not reported by the identifier reader the assertion above uses",
  ).toContain("boundariesViolations");

  // The count `design.md` D2 predicts stays at 53 is this file's own: a new file contributes zero
  // assertions to the boundary suite, and saying so here is what makes "53 staying at 53" a prediction
  // about this change rather than about a reader's memory.
  expect(
    ALLOWED_PATTERNS.length,
    "the allow-list is not empty, so the check above is not vacuous",
  ).toBeGreaterThan(0);
});
