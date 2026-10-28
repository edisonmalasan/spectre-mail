import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CORPUS, SKIP_DIRECTORIES } from "./scan-corpus";
import { SCAN_ASSERTION_TIMEOUT_MS } from "./scan-budget";
import { languageOf, stripComments } from "./comments";

/**
 * The reader the boundary suite reads every file with, held to its own contract.
 *
 * ## Why this file exists
 *
 * **`boundaries.test.ts` had a comment reader that leaked comment text into "code" in seven of 262
 * scripts, and nothing in the repository noticed.** It was a character scanner with three string
 * delimiters and no state for a regular-expression literal, so a backtick inside a pattern opened a
 * template string it never closed and the reader was out of phase for the rest of the file. **A gate
 * that reads prose as code can fire on documentation, and a gate that reads code as prose can miss a
 * violation** - and the second is silent.
 *
 * **So the reader moved into `comments.ts` and this file is its instrument.** The contract is four
 * claims, one per case below, and each is written so that a reader returning its input unchanged
 * fails it:
 *
 * 1. it knows four languages and refuses anything else, loudly;
 * 2. in a script it blanks every comment form and changes nothing else, offsets included;
 * 3. in a script it keeps every string, template and pattern literal verbatim;
 * 4. in a stylesheet `//` is text, in markup only `<!-- -->` is a comment, and JSON is untouched;
 * 5. and over the whole corpus it reaches a fixpoint with a comment actually blanked in each of the
 *    three languages that have one.
 *
 * **The reader is not this file's subject in the sense of a second implementation.** The point of
 * `stripComments` is that every rule reads through it, so a defect here is a defect in every rule at
 * once, in whichever direction it fails. That is why the corpus case is here rather than a note in a
 * design record.
 *
 * ## What this file does not establish
 *
 * **Nothing about a file the reader refuses.** `languageOf` throws for an extension it does not know
 * and the corpus walk below treats that as "not a source file", so a *new* extension introduced into
 * this repository would be skipped by the fixpoint until somebody taught the reader about it. The
 * first case is what keeps that honest: the reader is held to every extension `collectSourceFiles`
 * walks, so a file the rules read can never be one the walk silently drops.
 *
 * **And nothing about a file the parser itself gives up on.** A deliberately broken fixture leaves its
 * comments visible - measured, and that is the loud direction on purpose: a comment left visible makes
 * a gate red and names a line, where a span marked when it is not one would hide code and say nothing.
 */

/** The languages `languageOf` answers with, taken from the function so there is no second list. */
type Language = ReturnType<typeof languageOf>;

/**
 * A failure message built from the rows that failed.
 *
 * **`expect(value, message)` replaces the matcher's own diff rather than adding to it**, so a case
 * that passes a fixed string and a list of offending files prints the string and never the files.
 * This repository has recorded that shape twice; the repair both times was to build the message out of
 * the rows, which is what this does.
 */
function report(rows: readonly string[], whenEmpty: string): string {
  return rows.length === 0 ? whenEmpty : `${rows.length} problem(s):\n  ${rows.join("\n  ")}`;
}

vi.setConfig({ testTimeout: SCAN_ASSERTION_TIMEOUT_MS });

describe("the comment reader", () => {
  it("maps every shipped source extension to a language and refuses one it does not know", () => {
    // **Every extension this repository's rules walk, plus the ones the reader claims beside them.**
    // Written out rather than derived from the module's own map, because a test that reads its
    // expectation out of the thing under test cannot fail when that thing loses an entry. It is not a
    // second spelling of the set in the direction that matters: a reader that learns a new extension
    // is not reported here, and a reader that *forgets* one is.
    const expected: readonly (readonly [string, Language])[] = [
      ["a/b.ts", "script"],
      ["a/b.tsx", "script"],
      ["a/b.mts", "script"],
      ["a/b.cts", "script"],
      ["a/b.js", "script"],
      ["a/b.jsx", "script"],
      ["a/b.mjs", "script"],
      ["a/b.cjs", "script"],
      ["packages/ui/src/tokens.css", "stylesheet"],
      ["apps/web/index.html", "markup"],
      ["apps/web/index.htm", "markup"],
      ["package.json", "json"],
    ];

    const wrong = expected
      .map(([path, language]) => ({ path, language, actual: languageOf(path) }))
      .filter((row) => row.actual !== row.language)
      .map((row) => `${row.path} reads as ${row.actual}, expected ${row.language}`);

    expect(wrong, report(wrong, "every extension reads as the language it is")).toEqual([]);

    // **And the case is upper-insensitive**, because a Windows checkout is not the only place a
    // capitalised extension appears and a reader that answered `undefined` for one would be a silent
    // skip in the walk.
    expect(languageOf("a/b.TSX")).toBe("script");

    // **A path with no extension and a path whose only dot is a directory name are both refused**, and
    // refused by *throwing*: the fallback that returns the input unchanged is the silent direction,
    // because a comment could then satisfy a rule and nothing would say so. `v1.2/README` is the
    // second shape - `lastIndexOf(".")` finds the version directory, not an extension.
    const accepted: string[] = [];
    for (const unknown of ["LICENSE", "v1.2/README", "docs/PROVIDERS.md", "fixtures/mail.yaml"]) {
      try {
        accepted.push(`${unknown} reads as ${languageOf(unknown)}`);
      } catch {
        // Refused, which is the answer under test.
      }
    }

    expect(accepted, report(accepted, "every path without a known extension is refused")).toEqual(
      [],
    );
  });

  it("blanks every comment form in a script and keeps every offset and line break", () => {
    const source = [
      "// a line comment naming React",
      "const a = 1; /* a block comment naming React */",
      "/**",
      " * a doc comment naming React",
      " */",
      "function f() { /* the only thing inside a block */ }",
      "const b = 2;",
      "// a comment at end of file, with no newline after it",
    ].join("\n");

    const stripped = stripComments(source, "fixture.ts");

    // **Every comment form is gone, and the word the comments share is the witness.** `React` appears
    // three times in the source - a line comment, a block comment and a doc comment - and nowhere in
    // the code, so a reader that blanked two forms and missed the third leaves it visible. **The
    // source-side count is asserted too**, because `not.toContain` on its own is satisfied by a
    // fixture that never held the word, which is the shape of a control that proves nothing.
    expect(stripped).not.toContain("React");
    expect(source.split("React")).toHaveLength(4);

    // **And what is not a comment is untouched.** This is the half a reader that blanks too much
    // fails, and the half a length-only assertion cannot see.
    expect(stripped).toContain("const a = 1;");
    expect(stripped).toContain("function f() {");
    expect(stripped).toContain("const b = 2;");

    // **Offsets and line structure survive**, which is the property that makes a finding name a line
    // a reader can open. Blanking rather than deleting is the only way to have both.
    expect(stripped).toHaveLength(source.length);
    expect(stripped.split("\n")).toHaveLength(source.split("\n").length);
    expect(stripped.split("\n")[6]).toBe("const b = 2;");

    // **The only thing inside a block is a comment, and finding it is not a given.** TypeScript's
    // `getLeadingCommentRanges` cannot answer for a comment with no token after it in the same block,
    // which is why the reader builds a guard mask and scans instead.
    //
    // **Asserted by shape and not by a padding count**, because `" ".repeat(n)` is a number somebody
    // picked and it is wrong the first time the fixture's comment changes length: what the reader
    // promises is that the line keeps its own length and its own bounds, not that it holds 46 spaces.
    const blockLine = source.split("\n")[5] as string;
    const strippedBlockLine = stripped.split("\n")[5] as string;
    expect(strippedBlockLine).not.toContain("/*");
    expect(strippedBlockLine).not.toContain("only thing");
    expect(strippedBlockLine.startsWith("function f() {")).toBe(true);
    expect(strippedBlockLine.endsWith("}")).toBe(true);
    expect(strippedBlockLine).toHaveLength(blockLine.length);
  });

  it("keeps a string, a template and a pattern literal, including a backtick in a character class", () => {
    const source = [
      'const url = "https://example.invalid/a";',
      'const comment = "/* not a comment */";',
      "const template = `https://example.invalid/${id}`;",
      "const pattern = /[`]/;",
      "const slashes = /https?:\\/\\//;",
      "const division = total / 2;",
      "/** a doc comment that must be blanked */",
    ].join("\n");

    const stripped = stripComments(source, "fixture.ts");

    // **Every literal, verbatim.** A URL in a string is how the provider rules see a provider origin
    // and how the storage rules see a store name, so a reader that blanked one would make a violation
    // invisible.
    const literals = [
      '"https://example.invalid/a"',
      '"/* not a comment */"',
      "`https://example.invalid/${id}`",
      "/[`]/",
      "/https?:\\/\\//",
      "total / 2",
    ];
    const lost = literals.filter((literal) => !stripped.includes(literal));

    expect(lost, report(lost, "every literal in the fixture survives the reader")).toEqual([]);

    // **And the comment after them is gone**, which is the half that a reader desynchronised by the
    // backtick cannot do: it is out of phase from that point on, so everything below reads as code.
    // This is the exact shape `privacy-disclosure.test.ts` put in `boundaries.test.ts`'s way.
    expect(stripped).not.toContain("must be blanked");
  });

  it("treats a double slash as text in a stylesheet and a block comment as its only comment", () => {
    const source = [
      "/* a comment naming https://comment.example.invalid/fonts.css */",
      "body { background: url(https://cdn.example.invalid/pixel.png); }",
      'body { background: url("//cdn.example.invalid/pixel.png"); }',
      '.x { content: "/*"; }',
      ".y { outline: none; } /* trailing, naming React */",
    ].join("\n");

    const stripped = stripComments(source, "styles.css");

    // **The measured defect, in the direction that hid a violation.** `url(https://…)` is unquoted,
    // and a reader that treated `//` as a comment blanked everything after it - `url(https:` and the
    // remote-origin rule stayed quiet on the one CSS form that needs no quotes at all.
    expect(stripped).toContain("url(https://cdn.example.invalid/pixel.png)");
    expect(stripped).toContain('url("//cdn.example.invalid/pixel.png")');

    // **And a block-comment opener inside a declaration value does not open a comment**, because the
    // quote it sits in is tracked. A reader that opened one there would blank the rest of the file -
    // silent, and in the direction that hides code.
    expect(stripped).toContain('.x { content: "/*"; }');
    expect(stripped).toContain(".y { outline: none; }");

    // **The block comments are gone**, one of them naming a third `example.invalid` host and one
    // naming React. The source holds three such hosts and the code holds two, so the count is what
    // separates "the comment was blanked" from "the reader ate the file".
    expect(source.match(/example\.invalid/g)).toHaveLength(3);
    expect(stripped.match(/example\.invalid/g)).toHaveLength(2);
    expect(stripped).not.toContain("React");

    // And nothing else moved.
    expect(stripped).toHaveLength(source.length);
    expect(stripped.split("\n")).toHaveLength(source.split("\n").length);
  });

  it("strips only what markup calls a comment, and leaves a script block as text", () => {
    const source = [
      "<!doctype html>",
      "<html>",
      "  <!-- a comment naming https://asset.example.invalid/font.css -->",
      '  <link rel="stylesheet" href="/style.css" />',
      "  <!--",
      "    a multi-line comment naming both // and a block-comment opener",
      "  -->",
      "  <script>",
      '    const url = "https://example.invalid/a//b";',
      "  </script>",
      "</html>",
    ].join("\n");

    const stripped = stripComments(source, "index.html");

    // **Both comment forms are gone**, the single-line one and the one that spans lines.
    expect(stripped).not.toContain("a comment naming");
    expect(stripped).not.toContain("a multi-line comment naming");

    // **And the double slash inside the script block is text**, because HTML has one comment form and
    // a reader that borrowed CSS's or a script's would be reading a language this is not.
    expect(stripped).toContain('"https://example.invalid/a//b"');
    expect(stripped).toContain('<link rel="stylesheet" href="/style.css" />');

    // And the file's shape is intact.
    expect(stripped).toHaveLength(source.length);
    expect(stripped.split("\n")).toHaveLength(source.split("\n").length);
  });

  it("returns JSON unchanged, because JSON has no comments to read", () => {
    const source =
      '{\n  "url": "https://example.invalid//a",\n  "note": "/* not a comment */"\n}\n';

    // **Not a fallback that happens to agree with itself.** A manifest is a file the rules read - the
    // root `package.json` is one - and a reader that blanked a `//` inside a JSON string would read a
    // script name as a comment and miss a quarantined probe named in it.
    expect(stripComments(source, "package.json")).toBe(source);
  });
});

describe("the corpus", () => {
  /**
   * Every file in the corpus the reader claims, with the language it claims.
   *
   * **The walk skips `SKIP_DIRECTORIES`, imported rather than copied**, so the fixpoint reads exactly
   * the tree the rules read. A second list here would be a second spelling of a set, and it would fail
   * in the silent direction: a fixpoint over a wider set proves something about files no rule sees.
   */
  function corpusFiles(): { path: string; language: Language }[] {
    const found: { path: string; language: Language }[] = [];

    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        if (SKIP_DIRECTORIES.has(entry)) continue;

        const absolute = join(directory, entry);
        if (statSync(absolute).isDirectory()) {
          walk(absolute);
          continue;
        }

        try {
          found.push({ path: absolute, language: languageOf(absolute) });
        } catch {
          // A file the reader refuses is a file no rule reads as source - held to that by the first
          // case above, which requires the reader to accept every extension the rules walk.
        }
      }
    };

    walk(CORPUS);
    return found;
  }

  it("reads every file it claims to a fixpoint, and blanks a comment in each language that has one", () => {
    const files = corpusFiles();
    const problems: string[] = [];
    const byLanguage = new Map<Language, { files: number; changed: number }>();

    for (const { path, language } of files) {
      const repoPath = relative(CORPUS, path).split(sep).join("/");
      const raw = readFileSync(path, "utf8");
      const once = stripComments(raw, path);
      const twice = stripComments(once, path);

      const entry = byLanguage.get(language) ?? { files: 0, changed: 0 };
      entry.files += 1;
      if (once !== raw) entry.changed += 1;
      byLanguage.set(language, entry);

      // **Length is the property that makes a finding openable**, so it is checked on its own line: a
      // reader that blanked a comment and also ate a line break would pass a fixpoint and move every
      // line number below it.
      if (once.length !== raw.length) {
        problems.push(`${repoPath} (${language}: the reader changed the file's length)`);
        continue;
      }

      // **The fixpoint is what "no comment survived" means**, and it is checked rather than assumed:
      // reading an already-read file must be the identity, which is exactly the statement that there
      // is nothing left to blank.
      if (twice !== once) {
        problems.push(`${repoPath} (${language}: a comment survived the reader)`);
      }
    }

    expect(
      problems,
      report(problems, `all ${files.length} files in the corpus are read to a fixpoint`),
    ).toEqual([]);

    // **The control, and it is the one that makes the fixpoint mean anything.** A reader that returned
    // its input unchanged is a perfect fixpoint, so each language that *has* comments must show at
    // least one file the reader changed. Measured: every shipped script, stylesheet and markup file
    // carries a comment, so a zero here is the reader having stopped reading rather than the tree
    // having stopped commenting.
    const inert = (["script", "stylesheet", "markup"] as const)
      .filter((language) => (byLanguage.get(language)?.changed ?? 0) === 0)
      .map(
        (language) =>
          `no ${language} file in the corpus had a comment blanked (${String(
            byLanguage.get(language)?.files ?? 0,
          )} read) - the fixpoint above would pass with the reader deleted`,
      );

    expect(
      inert,
      report(inert, "every language with comments shows a file the reader changed"),
    ).toEqual([]);

    // **And JSON is the one language that must come back byte-identical**, from a corpus that actually
    // contains some - otherwise "no JSON file changed" is a statement about nothing.
    expect(
      byLanguage.get("json")?.files ?? 0,
      "no JSON file was read, so 'a JSON file is returned unchanged' is a claim about nothing",
    ).toBeGreaterThan(0);
    expect(
      byLanguage.get("json")?.changed ?? 0,
      "a JSON file came back changed, and JSON has no comments to read",
    ).toBe(0);
  });
});
