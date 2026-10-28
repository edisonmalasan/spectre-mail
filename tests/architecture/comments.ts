import ts from "typescript";

/**
 * The comment reader, and the four languages the architecture rules read.
 *
 * ## What it is for
 *
 * Every rule in this directory is about what the *code* says, and a doc comment that explains a
 * dependency is documentation rather than a dependency. Markup and stylesheets have the same
 * property for the same reason: a comment naming a remote origin must not be a finding, and - the
 * half that is easier to forget - a comment must not be able to *satisfy* a rule either.
 *
 * Blanking rather than deleting keeps every offset and every line number, so a finding still names
 * the line a reader has to open. That is the whole value of a finding.
 *
 * ## Why scripts are parsed rather than character-scanned
 *
 * The reader this replaces walked characters and tracked three string delimiters. **Measured on this
 * tree, seven of 262 script files leaked comment text into "code"**, and the cause was the state it
 * had no state for: a regular-expression literal. `privacy-disclosure.test.ts` carries a pattern
 * whose character class holds a backtick, and that backtick opened a template string the reader
 * never closed - so the reader was desynchronised for the rest of the file, and the doc comment
 * immediately below it, **which explains this very defect**, was emitted as if it were code.
 *
 * **A fourth delimiter cannot repair that**, because deciding what a slash means *is* the parse. So
 * the parse is asked instead, and the observation that makes it enough is narrow: **only a line
 * comment or a block comment can be mistaken for something else, and the only tokens that can hide
 * them are string and pattern literals**, which TypeScript names exactly. Those spans are marked in
 * a mask, and the scan blanks a comment opener only where the mask is clear. There is no quote
 * tracking, no backtick tracking and no slash heuristic anywhere below.
 *
 * **And it fails in the loud direction.** A span the parser missed leaves a comment visible, which
 * is red and names a line; a span marked when it is not one would hide code, which is silent. So the
 * mask is built only from node kinds the parser has already decided, never from a guess. The one
 * shape that survives is a source the parser itself gave up on - a deliberately broken fixture,
 * which is exactly what a negative control is - and that direction is the loud one.
 *
 * ## Stylesheets, markup and manifests are not scripts
 *
 * **A double slash is not a comment in CSS.** The reader that treated it as one blanked the slashes
 * inside an **unquoted** `url(https://…)`, so `REMOTE_CSS_PATTERNS` could not see the one remote
 * form that needs no quotes at all: measured, `url(https://cdn.example.invalid/pixel.png)` came out
 * of the old reader as `url(https:      ` and the rule stayed quiet. CSS has one comment form, and
 * quotes are tracked here so that a `content` declaration holding a block-comment opener cannot
 * open one.
 *
 * **Markup has one comment form too**, and a double slash in markup is a URL rather than a comment.
 *
 * **JSON has no comments at all**, and is returned unchanged. It is a named language rather than a
 * fallback, because `languageOf` throws for an extension it does not know: a reader that silently
 * returned its input would let a comment satisfy a rule, and that is the silent direction.
 */

/** What a path's file says about how its comments are written. */
export type Language = "script" | "stylesheet" | "markup" | "json";

/**
 * The four readers, by extension.
 *
 * **The path is required rather than defaulted**, because a call site that forgets it must fail
 * where it is rather than somewhere downstream: `stripComments`'s previous signature took the
 * contents alone, so a call site that handed it a *path* compiled, matched nothing, and passed its
 * assertion. That is measured - one case in the boundary suite called it with a filename and had
 * been proving nothing since the call was written.
 */
const LANGUAGES = new Map<string, Language>([
  [".ts", "script"],
  [".tsx", "script"],
  [".mts", "script"],
  [".cts", "script"],
  [".js", "script"],
  [".jsx", "script"],
  [".mjs", "script"],
  [".cjs", "script"],
  [".css", "stylesheet"],
  [".html", "markup"],
  [".htm", "markup"],
  [".json", "json"],
]);

/** The grammar each script extension is parsed with. `.mts` and `.cts` are TypeScript with a module intent. */
const SCRIPT_KINDS = new Map<string, ts.ScriptKind>([
  [".ts", ts.ScriptKind.TS],
  [".tsx", ts.ScriptKind.TSX],
  [".mts", ts.ScriptKind.TS],
  [".cts", ts.ScriptKind.TS],
  [".js", ts.ScriptKind.JS],
  [".jsx", ts.ScriptKind.JSX],
  [".mjs", ts.ScriptKind.JS],
  [".cjs", ts.ScriptKind.JS],
]);

/**
 * The syntax kinds whose text may hold a comment opener without it being a comment.
 *
 * **Every string form, every template piece, and both of the two literal kinds that are written in
 * characters.** A template is not one token: `TemplateHead`, `TemplateMiddle` and `TemplateTail`
 * are the literal pieces around its substitutions, and each is a separate span. A `JsxText` token is
 * the prose between two elements, which is where an apostrophe and a URL both live.
 */
const OPAQUE_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.JsxText,
]);

/** The extension of a path's own file name, lowercased, or `""` when it has none. */
function extensionOf(path: string): string {
  const name = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * How this path's comments are written.
 *
 * **Throws rather than guessing**, and the direction is the point: an unreadable language must stop
 * the run, because the fallback that returns the input unchanged would let a comment satisfy a rule
 * and leave nothing to say so.
 */
export function languageOf(path: string): Language {
  const extension = extensionOf(path);
  const language = LANGUAGES.get(extension);
  if (language === undefined) {
    throw new Error(
      `No comment reader for "${path}". ` +
        `This module knows ${[...LANGUAGES.keys()].join(", ")} - ` +
        `add the language to tests/architecture/comments.ts rather than guessing at its comments.`,
    );
  }
  return language;
}

/** Replaces every character except a line break with a space, so offsets and line numbers survive. */
function blank(text: string): string {
  return text.replace(/[^\r\n]/g, " ");
}

/**
 * TypeScript, TSX, JavaScript and JSX: blank every comment that is not inside a string or a pattern.
 *
 * The mask is one byte per character of the source, so the scan below is linear and never has to
 * decide what a slash means - the parser already did.
 */
function stripScript(source: string, path: string): string {
  const extension = extensionOf(path);
  const kind = SCRIPT_KINDS.get(extension);
  if (kind === undefined) {
    throw new Error(
      `"${path}" is not a script this module can parse. ` +
        `This module knows ${[...SCRIPT_KINDS.keys()].join(", ")}.`,
    );
  }

  const file = ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, false, kind);

  const opaque = new Uint8Array(source.length);
  const mark = (node: ts.Node): void => {
    // `getStart` rather than `pos`: a node's `pos` is the end of the previous token, so it carries
    // the trivia in between - which is where the comments are.
    if (OPAQUE_KINDS.has(node.kind)) opaque.fill(1, node.getStart(file, false), node.end);
    ts.forEachChild(node, mark);
  };
  mark(file);

  const parts: string[] = [];
  let emitted = 0;
  let index = 0;

  for (;;) {
    const line = source.indexOf("//", index);
    const block = source.indexOf("/*", index);
    const start = line === -1 ? block : block === -1 ? line : Math.min(line, block);
    if (start === -1) break;

    if (opaque[start] === 1) {
      // Part of a string or a pattern. One character is enough: the next candidate is looked up
      // from here, and every position is asked the same question.
      index = start + 1;
      continue;
    }

    let end: number;
    if (source.slice(start, start + 2) === "/*") {
      const close = source.indexOf("*/", start + 2);
      end = close === -1 ? source.length : close + 2;
    } else {
      const close = source.indexOf("\n", start + 2);
      end = close === -1 ? source.length : close;
    }

    parts.push(source.slice(emitted, start), blank(source.slice(start, end)));
    emitted = end;
    index = end;
  }

  parts.push(source.slice(emitted));
  return parts.join("");
}

/**
 * CSS: blank every block comment, and treat a double slash as the characters it is.
 *
 * **Quotes are tracked, and they have to be**: `content: "/*"` is a legal declaration whose value
 * contains a comment opener, and a reader that opened a comment there would blank the rest of the
 * file. Backslash escapes are honoured because a CSS string's `\"` does not close it.
 */
function stripStylesheet(source: string): string {
  const parts: string[] = [];
  let emitted = 0;
  let index = 0;
  let quote: '"' | "'" | null = null;

  while (index < source.length) {
    const char = source[index];

    if (quote !== null) {
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      const end = close === -1 ? source.length : close + 2;
      parts.push(source.slice(emitted, index), blank(source.slice(index, end)));
      emitted = end;
      index = end;
      continue;
    }

    index += 1;
  }

  parts.push(source.slice(emitted));
  return parts.join("");
}

/**
 * HTML: blank every `<!-- -->`, and nothing else.
 *
 * **A double slash in markup is a URL**, and a block-comment opener is text, so neither is given a
 * meaning here.
 */
function stripMarkup(source: string): string {
  const parts: string[] = [];
  let emitted = 0;
  let index = 0;

  for (;;) {
    const start = source.indexOf("<!--", index);
    if (start === -1) break;

    const close = source.indexOf("-->", start + 4);
    const end = close === -1 ? source.length : close + 3;

    parts.push(source.slice(emitted, start), blank(source.slice(start, end)));
    emitted = end;
    index = end;
  }

  parts.push(source.slice(emitted));
  return parts.join("");
}

/**
 * The source with its comments blanked, in the language its path declares.
 *
 * **The path is the second argument and it is required**, so a call site cannot forget which
 * language it is reading. See `languageOf` for why an unknown extension throws.
 */
export function stripComments(source: string, path: string): string {
  const language = languageOf(path);

  switch (language) {
    case "script":
      return stripScript(source, path);
    case "stylesheet":
      return stripStylesheet(source);
    case "markup":
      return stripMarkup(source);
    case "json":
      return source;
  }
}
