/**
 * Safe extraction: untrusted message content in, readable text and anchors out.
 *
 * ## Why this is not a dependency
 *
 * The obvious move is to add an HTML parser. It was rejected, and the reasoning is
 * recorded here rather than in a design document nobody will read next to the code:
 *
 * - The needed surface is **narrow and unusual**. Strip tags, decode entities, drop
 *   script and style content, and recover each `href` paired with the text a reader
 *   would click. It is not "parse HTML" — no tree is built, no nesting is validated,
 *   and nothing is ever serialized.
 * - A general parser is the largest dependency this workspace would carry, sitting in
 *   a **security-relevant path** in both a web page and an MV3 service worker. Every
 *   line of it becomes ours to audit, and most of what it offers — tree
 *   construction, selector queries, serialization — is exactly what must *not* happen
 *   here, because each is a fresh opportunity to re-emit markup.
 * - A regular expression over the raw string cannot pair an `href` with its anchor
 *   text, cannot know what is inside a script, and fails silently on unclosed tags —
 *   corrupting precisely the content we are trying to read.
 *
 * ## What this is not
 *
 * **This is not a conforming HTML parser and does not claim to be.** It does not build
 * a DOM, does not validate nesting, does not resolve relative destinations, and does
 * not handle `srcset`, CSS `url()`, or character references beyond the named and
 * numeric forms below. Real mail contains markup none of this anticipates.
 *
 * The failure direction is the point: an unrecognised construct costs us its **tags**,
 * never its text. Every tag is removed without exception, so no markup can reach the
 * output regardless of how badly the input nests. Text may be imperfectly separated;
 * markup cannot survive.
 *
 * Do not reuse this where full parsing is needed.
 *
 * ## The security property this module exists to guarantee
 *
 * **No output of this module is markup.** `readable` is plain text, and each `Anchor`
 * carries two plain strings. There is no field a caller could mistake for something
 * renderable, which means rendering a message unsafely is not a decision any call site
 * is able to make. That is a stronger guarantee than "we were careful here", and it is
 * why extraction is its own module with its own tests rather than a helper buried in a
 * detector.
 *
 * @module
 */

/**
 * A link partway through the scan.
 *
 * Carries the offset of the block it opened in, which is what makes its surrounding
 * wording recoverable without a second pass. Internal to this module — it is never
 * part of the result, because an offset into an intermediate buffer is meaningless to a
 * caller.
 */
interface PendingAnchor extends Anchor {
  /** Offset into the in-progress readable text where this link's block began. */
  readonly windowStart: number;
}

/**
 * A link recovered from a message body.
 *
 * Every field is a plain string. `destination` is the absolute address the link names;
 * `text` is what a reader sees, which is the empty string when the link wraps an image
 * or nothing at all.
 */
export interface Anchor {
  readonly destination: string;
  readonly text: string;
  /**
   * The readable text surrounding this link, from the start of its block up to and
   * including the link's own text.
   *
   * Recovered here rather than reassembled downstream because it cannot be recovered
   * later: once markup is gone, the pairing between a link and the sentence that
   * introduces it is gone too. Link detection depends on exactly that pairing.
   *
   * The window is **asymmetric by design** — it stops at the link rather than running
   * to the end of the block. The wording a sender puts *before* a verification link
   * ("Please confirm your address") is the signal worth having, and the few words
   * after it are usually button-label debris. The limit is stated rather than hidden:
   * a link in the middle of a long block sees only what precedes it.
   */
  readonly context: string;
  /**
   * The readable text of the block immediately above this one, or `""` when there is
   * none.
   *
   * Separate from `context` because a very common template puts the introducing
   * sentence in its **own paragraph** and the button in the next one, which makes it a
   * different block. Without this field, "Please confirm the reset from this device:"
   * followed by a link reading "Reset password" would yield a link whose visible text
   * and surroundings both say nothing — and the most useful link in the message would
   * be missed.
   *
   * Kept as its own field rather than folded into `context` because folding it in
   * would make every link look like it was introduced by whatever precedes it, which
   * is how an unsubscribe link ends up reported as a verification link. Detection
   * decides when this field counts; the extractor only records it.
   */
  readonly above: string;
}

/**
 * What a message body yields once markup is removed.
 */
export interface ReadableContent {
  /**
   * The visible content as plain text.
   *
   * Blocks are separated by a blank line, which is what makes the same-block
   * association used by detection mean what it says.
   */
  readonly readable: string;
  /** Every link found, in the order it appeared. */
  readonly anchors: readonly Anchor[];
}

/**
 * Elements whose **content** is not prose and is dropped entirely.
 *
 * Dropping the content, not merely the tags, is what keeps a script's body out of the
 * readable text — and a script body is frequently full of digit runs that would
 * otherwise be offered to the user as a verification code. Stripping tags alone would
 * turn a stylesheet's hex colours into plausible six-digit candidates.
 */
const DROPPED_CONTENT_ELEMENTS: readonly string[] = ["script", "style", "template", "noscript"];

/**
 * Elements that end a block of readable text.
 *
 * Without this, `one` and `two` in adjacent paragraphs read as `onetwo`, and a
 * candidate in the first would share a block with one in the second. The full list of
 * block-level elements is not needed for correctness — anything not listed simply joins
 * its neighbours — so this covers those that appear in real mail and nothing more.
 */
const BLOCK_ELEMENTS: readonly string[] = [
  "address",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tr",
  "ul",
];

/**
 * A tag, reduced to what this module needs from it.
 *
 * `inner` is the tag's raw text between the angle brackets, which is the only place a
 * destination can appear. Keeping it on the tag is what lets an attribute be read
 * without a second pass over the input, and without a shared variable between the two
 * halves of the scan — a global there would make the function's output depend on
 * history, which the determinism guarantee forbids.
 */
interface ConsumedTag {
  readonly rest: string;
  readonly inner: string;
  readonly name: string;
  readonly closing: boolean;
}

/** Matches an element's name from the start of a tag's inner text. */
const TAG_NAME_PATTERN = /^\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/;

/** The opening delimiter of a comment, so this file's own comment cannot terminate. */
const COMMENT_OPEN = "<!--";
const COMMENT_CLOSE = "-->";

/** Character-reference forms that appear in real mail. */
const REFERENCE_PATTERN = /&(#[Xx][0-9A-Fa-f]+|#\d+|[A-Za-z][A-Za-z0-9]*);?/g;

/**
 * The named character references that actually appear in mail.
 *
 * Deliberately a closed list rather than a general decoder. An unknown reference is
 * left as written, which is visible in the output and harmless, whereas guessing at
 * arbitrary entities is how a decoder starts inventing characters.
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  shy: "",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sect: "§",
  para: "¶",
  laquo: "«",
  raquo: "»",
  times: "×",
  divide: "÷",
  plusmn: "±",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  sup2: "²",
  sup3: "³",
  micro: "µ",
  dagger: "†",
  permil: "‰",
  prime: "′",
  Prime: "″",
  larr: "←",
  uarr: "↑",
  rarr: "→",
  darr: "↓",
  harr: "↔",
  infin: "∞",
  ne: "≠",
  le: "≤",
  ge: "≥",
  minus: "−",
};

/**
 * Decode the character references that appear in real mail.
 *
 * Handles named references from the closed list above, decimal references, and
 * hexadecimal references. An unrecognised reference is returned as written rather than
 * guessed at: a visible `&foo;` in a message is a smaller problem than a decoder
 * inventing characters.
 *
 * @param input Raw text to decode.
 * @returns The text with recognised references replaced.
 */
export function decodeCharacterReferences(input: string): string {
  return input.replace(REFERENCE_PATTERN, (match, body: string) => {
    if (body.startsWith("#")) {
      const digits = body.slice(1);
      const hexadecimal = digits.startsWith("x") || digits.startsWith("X");
      const codePoint = hexadecimal
        ? Number.parseInt(digits.slice(1), 16)
        : Number.parseInt(digits, 10);

      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return match;
      }
      try {
        // `fromCodePoint` rejects a lone surrogate, which hand-written mail does
        // produce, and it must not take the whole parse down with it.
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }

    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Consume one tag from the start of `input`.
 *
 * An unterminated tag runs to the end of the input. That is the safe direction: the
 * tag's own text is lost rather than the tag surviving in the output.
 */
function consumeTag(input: string): ConsumedTag {
  const body = input.slice(1);
  const end = body.indexOf(">");
  const inner = end === -1 ? body : body.slice(0, end);
  const match = TAG_NAME_PATTERN.exec(inner);

  return {
    rest: end === -1 ? "" : body.slice(end + 1),
    inner,
    name: (match?.[1] ?? "").toLowerCase(),
    closing: inner.startsWith("/"),
  };
}

/**
 * Read an attribute's value from a tag's inner text.
 *
 * Handles both quoted forms and an unquoted value, because real mail contains all
 * three and an unquoted destination is the common case for a mail client's tracking
 * link.
 */
function readAttribute(inner: string, attribute: string): string | undefined {
  const pattern = new RegExp(
    `(?:^|\\s)${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s]+))`,
    "i",
  );
  const match = pattern.exec(inner);
  if (!match) {
    return undefined;
  }
  const raw = match[1] ?? match[2] ?? match[3] ?? "";
  return decodeCharacterReferences(raw).trim();
}

/**
 * Drop a comment, doctype, or processing instruction outright.
 *
 * Returns whether the construct was one whose **content** must be discarded too. A
 * comment's text is not prose and can hold anything, including a digit run that would
 * otherwise be offered as a verification code.
 */
function consumeOpaqueConstruct(input: string): { readonly rest: string } | undefined {
  if (input.startsWith(COMMENT_OPEN)) {
    const end = input.indexOf(COMMENT_CLOSE);
    return { rest: end === -1 ? "" : input.slice(end + COMMENT_CLOSE.length) };
  }
  if (input.startsWith("!") || input.startsWith("?")) {
    const end = input.indexOf(">");
    return { rest: end === -1 ? "" : input.slice(end + 1) };
  }
  return undefined;
}

/** End the current block, unless the text is empty or already ends with a break. */
function endBlock(readable: string): string {
  if (readable === "" || readable.endsWith("\n\n")) {
    return readable;
  }
  return readable.endsWith("\n") ? `${readable}\n` : `${readable}\n\n`;
}

/**
 * Collapse the whitespace that tag removal leaves behind, without joining words that
 * were separated by a tag.
 */
function normalise(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Turn untrusted message content into readable text and the links it contained.
 *
 * Pure: the same input always produces the same output, and this function reads and
 * calls nothing outside itself.
 *
 * @param content A message body exactly as received. It may be prose or it may be
 * markup; there is no declared content type here to consult, and the ones providers do
 * declare have been measured to be wrong.
 * @returns The visible text with blocks separated by blank lines, plus every link.
 */
export function extractReadableContent(content: string): ReadableContent {
  const pending: PendingAnchor[] = [];
  let readable = "";
  /**
   * Names of the dropped-content elements currently open, innermost last.
   *
   * A stack rather than a counter, so a stray close tag leaves us suppressing rather
   * than resuming at the wrong depth.
   */
  const suppressing: string[] = [];
  /** Index into `pending` of the link being read, or -1 when outside one. */
  let openAnchor = -1;
  /**
   * Offset in `readable` where the current block began.
   *
   * This is what gives a link its surrounding wording: the window is measured from the
   * start of the block, so the sentence introducing a link is captured rather than
   * just the link's own text. Reset by the one place a block ends.
   */
  let blockStart = 0;
  /**
   * The readable text of the block before the current one.
   *
   * Maintained rather than derived, because a block's text cannot be recovered after
   * the fact: normalisation collapses the whitespace, and the offsets that would let it
   * be sliced out again have moved.
   */
  let above = "";

  /**
   * Append text, routing it to the open link as well when there is one.
   *
   * This is why anchor text and readable text agree. Link detection depends on the
   * wording a reader sees, and that wording is the text inside the link — so it has to
   * reach both places, decoded once.
   */
  const emit = (raw: string): void => {
    if (suppressing.length > 0 || raw === "") {
      return;
    }
    const decoded = decodeCharacterReferences(raw);
    readable += decoded;
    if (openAnchor !== -1) {
      const anchor = pending[openAnchor] as PendingAnchor;
      pending[openAnchor] = { ...anchor, text: anchor.text + decoded };
    }
  };

  let rest = content;
  while (rest.length > 0) {
    const next = rest.indexOf("<");
    if (next === -1) {
      emit(rest);
      break;
    }

    emit(rest.slice(0, next));
    rest = rest.slice(next);

    const opaque = consumeOpaqueConstruct(rest);
    if (opaque) {
      rest = opaque.rest;
      continue;
    }

    const tag = consumeTag(rest);
    rest = tag.rest;

    if (suppressing.length > 0) {
      const current = suppressing[suppressing.length - 1];
      if (current === undefined) {
        break;
      }
      if (tag.closing && tag.name === current) {
        suppressing.pop();
      }
      continue;
    }

    if (DROPPED_CONTENT_ELEMENTS.includes(tag.name)) {
      if (!tag.closing) {
        suppressing.push(tag.name);
      }
      continue;
    }

    if (tag.name === "a") {
      if (tag.closing) {
        if (openAnchor !== -1) {
          // Capture the surrounding wording now, while it is still adjacent in the
          // buffer. Once the scan ends it cannot be reassembled without a second pass
          // over offsets that normalisation has already moved.
          const anchor = pending[openAnchor] as PendingAnchor;
          pending[openAnchor] = {
            ...anchor,
            context: inlineWhitespace(readable.slice(anchor.windowStart)),
          };
        }
        openAnchor = -1;
        continue;
      }
      pending.push({
        destination: readAttribute(tag.inner, "href") ?? "",
        text: "",
        context: "",
        above,
        windowStart: blockStart,
      });
      openAnchor = pending.length - 1;
      continue;
    }

    if (BLOCK_ELEMENTS.includes(tag.name)) {
      // Only record a block that had text in it. Adjacent block elements — the `</p>`
      // of one paragraph and the `<p>` of the next — each end a block, and the empty
      // one between them would otherwise wipe the paragraph a reader actually wrote.
      const finished = inlineWhitespace(readable.slice(blockStart));
      if (finished !== "") {
        above = finished;
      }
      readable = endBlock(readable);
      blockStart = readable.length;
      // Any link still open belongs to the block that just ended, so its window is
      // whatever preceded it in that block rather than spilling into the next one.
      if (openAnchor !== -1) {
        const anchor = pending[openAnchor] as PendingAnchor;
        pending[openAnchor] = {
          ...anchor,
          context: inlineWhitespace(readable.slice(anchor.windowStart)),
        };
        openAnchor = -1;
      }
    }
  }

  if (openAnchor !== -1) {
    // An unclosed link at the end of the input. Its destination and text were
    // recovered on the way through; its window closes here.
    const anchor = pending[openAnchor] as PendingAnchor;
    pending[openAnchor] = {
      ...anchor,
      context: inlineWhitespace(readable.slice(anchor.windowStart)),
    };
  }

  return {
    readable: normalise(readable),
    anchors: pending.map((anchor) => ({
      destination: anchor.destination.trim(),
      text: inlineWhitespace(anchor.text),
      context: anchor.context,
      above: anchor.above,
    })),
  };
}

/** Collapse runs of whitespace without touching the line structure. */
function inlineWhitespace(text: string): string {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}
