/**
 * Verification-link detection.
 *
 * ## Wording decides, and nothing else does
 *
 * Whether a link looks like a verification link is decided by the text a reader sees
 * and the wording around it. **Nothing in the address contributes** — not the host,
 * not the path, not the query.
 *
 * That is narrower than it might sound, and the reason is measured rather than
 * principled: a large share of links in ordinary mail have addresses mentioning
 * verification-shaped words for reasons that have nothing to do with verification.
 * `/unsubscribe`, `/promo`, `/confirm-email-preferences`, and every confirmation
 * mail's own tracking parameters would light up an address-shape heuristic, on exactly
 * the mail that should yield nothing.
 *
 * The cost is named rather than hidden. A magic-link message whose button reads
 * "Click here" in a block with no verification wording scores low. That is the safe
 * direction: a missed link is visible to the user, while a false "verification link"
 * sitting on an unsubscribe address is a click they did not intend.
 *
 * ## A link is reported only when wording names it
 *
 * Unlike code candidates, links are **not** returned with a low score when the
 * wording says nothing. The roadmap defines a verification link by the wording around
 * it, and there is no "reduce confidence for ordinary links" instruction to balance
 * against. So the gate here is definitional, not a tuned threshold — and it means the
 * product can never surface an unsubscribe address as something to follow.
 *
 * @module
 */

import { assertConfidence } from "@spectre-mail/core";
import type { VerificationLink } from "@spectre-mail/core";

import type { Anchor } from "./extract";
import { clampConfidence } from "./scoring";

/** Score when the link's own text asks the reader to do something. */
const ANCHOR_TEXT_CONFIDENCE = 0.7;

/** Score when only the surrounding wording does. */
const CONTEXT_CONFIDENCE = 0.55;

/** The floor, so the clamp below is a guard rather than the mechanism. */
const MIN_CONFIDENCE = 0.05;

/**
 * The ceiling, which is `ANCHOR_TEXT_CONFIDENCE` by construction.
 *
 * Present as a clamp so the promise in the module comment survives someone adding a
 * rule later: no detection is ever reported as certain.
 */
const MAX_CONFIDENCE = 0.7;

/** The only two schemes a link may be surfaced under. */
const FOLLOWABLE_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * Wording that indicates a link is for verifying an account.
 *
 * The roadmap's list, plus the phrasings that actually appear in sign-in mail. `sign
 * in` and `log in` are included because a magic link's button frequently reads
 * "Sign in to continue"; bare `login` alone is kept too, since it appears in headings
 * far more often than it appears in unrelated mail.
 */
const LINK_KEYWORDS: readonly string[] = [
  "verify",
  "verification",
  "verify your",
  "confirm",
  "confirmation",
  "activate",
  "activation",
  "login",
  "log in",
  "sign in",
  "signin",
  "magic",
  "authentication",
  "authenticate",
  "validate",
  "one-time",
  "one time",
  "otp",
  "passcode",
  "pass code",
  "pin code",
];

/**
 * Whether the text names verification at all.
 *
 * Substring matching on a lower-cased haystack, which means a keyword can match inside
 * a larger word — `verify` matches "verification", which is intentional and is why
 * several longer terms in the list are redundant rather than harmful.
 */
function saysVerification(text: string): boolean {
  const haystack = text.toLowerCase();
  return LINK_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * Whether a link is the only thing in its own block.
 *
 * This is the condition for trusting the block above. A block containing nothing but a
 * link is a button, and a button has no sentence of its own — so whatever the
 * paragraph above it says is the only thing that could be introducing it. A block with
 * other words is a sentence about something, and its link is part of that sentence.
 */
function standsAlone(anchor: Anchor): boolean {
  return anchor.text !== "" && anchor.context.trim() === anchor.text.trim();
}

/**
 * Whether the wording *around* a link asks for verification, ignoring the link's own
 * words.
 *
 * `Anchor.context` runs from the start of the link's block **up to and including** the
 * link's own text, so it always contains that text. Testing it directly would make the
 * two signals indistinguishable: every link whose own text says "verify" would also
 * report surrounding wording, and an explanation of this detection is only useful if
 * it says which words were actually read.
 *
 * The link's own text is removed rather than captured separately, because it is always
 * the tail of the window — stripping it is exact, whereas storing a second offset would
 * be a second thing to get wrong.
 */
function saysVerificationAround(anchor: Anchor): boolean {
  const own = anchor.text;
  const surrounding =
    own === "" || !anchor.context.endsWith(own)
      ? anchor.context
      : anchor.context.slice(0, anchor.context.length - own.length);

  return saysVerification(surrounding);
}

/**
 * Whether the paragraph above a button-like link asks for verification.
 *
 * **A widening of the rule proposed for this change, made because the corpus showed the
 * original rule missing the most useful link in a real message.**
 *
 * The very common template puts the introducing sentence in its own paragraph and the
 * button in the next one, which makes them different blocks. The password-reset fixture
 * is exactly that: "Or confirm the reset from this device:" above a link reading "Reset
 * password" — whose own text names no verification wording. Under the original rule the
 * link was not reported at all, and a password reset is the single most important link
 * such a message contains.
 *
 * The same narrowing as the code detector keeps this from over-reaching: `above` counts
 * **only when the link is the only thing in its own block**. Unconditionally, the rule
 * would report an unsubscribe link sitting under a verification sentence, which is the
 * false positive `design.md` D8 was written to prevent.
 */
function saysVerificationAbove(anchor: Anchor): boolean {
  return standsAlone(anchor) && saysVerification(anchor.above);
}

/**
 * The host a destination names, or `undefined` when it is not a followable web address.
 *
 * Rejection rather than down-ranking, per `design.md` D9. M10 renders these as
 * something a user taps; a `javascript:` or `data:` destination in a message body is an
 * attack on exactly that affordance, and down-ranking leaves it on screen next to a
 * real link where it is easiest to tap by mistake.
 *
 * Also rejects anything `URL` cannot parse, which covers relative and
 * protocol-relative destinations. Those mean nothing to a user reading mail, and a
 * message's own relative link cannot be resolved to anything — there is no base to
 * resolve it against, and inventing one would point at a host we never verified.
 */
function readHost(destination: string): string | undefined {
  if (destination === "") {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return undefined;
  }
  return FOLLOWABLE_PROTOCOLS.has(url.protocol) ? url.hostname : undefined;
}

/**
 * Find the verification links in a message's recovered anchors.
 *
 * Pure: reads no clock, makes no request, and consults only the anchors it is given.
 * That last part is the load-bearing property — a resolver anywhere in this call path
 * would turn a green suite into a network dependency, and would do so invisibly.
 *
 * @param anchors Every link recovered from the message body, in order.
 * @returns Ranked verification links. Empty when no link's wording names one.
 */
export function detectVerificationLinks(anchors: readonly Anchor[]): VerificationLink[] {
  const best = new Map<string, VerificationLink>();

  for (const anchor of anchors) {
    const host = readHost(anchor.destination);
    if (host === undefined) {
      continue;
    }

    const inText = saysVerification(anchor.text);
    const inContext = saysVerificationAround(anchor);
    const inAbove = saysVerificationAbove(anchor);
    if (!inText && !inContext && !inAbove) {
      continue;
    }

    const confidence = clampConfidence(inText ? ANCHOR_TEXT_CONFIDENCE : CONTEXT_CONFIDENCE, {
      min: MIN_CONFIDENCE,
      max: MAX_CONFIDENCE,
    });
    const existing = best.get(anchor.destination);
    // Highest wins on a duplicate: a link repeated in a header and a footer must not
    // be reported twice, and the footer copy's weaker wording must not lower it.
    if (existing !== undefined && existing.confidence >= confidence) {
      continue;
    }

    best.set(anchor.destination, {
      url: anchor.destination,
      // Attached here so no caller ever re-parses the address to label it. A host is
      // `hostname`, not authority: a port is not part of the name a user recognises.
      hostname: host,
      confidence: assertConfidence(confidence, "link detection"),
    });
  }

  return [...best.values()].sort((left, right) => right.confidence - left.confidence);
}

/**
 * Which signals reported a link, so a result can be explained rather than merely shown.
 *
 * @param anchor The anchor as recovered from the message body.
 * @returns `"link text"`, `"surrounding wording"`, or both; empty when neither does.
 */
export function explainLinkSignals(anchor: Anchor): string[] {
  const signals: string[] = [];
  if (saysVerification(anchor.text)) {
    signals.push("link text");
  }
  if (saysVerificationAround(anchor)) {
    signals.push("surrounding wording");
  }
  if (saysVerificationAbove(anchor)) {
    signals.push("the paragraph above");
  }
  return signals;
}

/** The ceiling this module can reach, exported so a test can assert it rather than guess. */
export const LINK_CONFIDENCE_CEILING = MAX_CONFIDENCE;
