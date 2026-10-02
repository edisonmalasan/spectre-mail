/**
 * The composition: one call from a message body to everything worth showing a user.
 *
 * ## The seam is `Message.text`, exactly
 *
 * A provider hands this package a body. It may be prose or it may be an HTML document,
 * and there is no declared content type here to consult — the ones providers publish
 * have been measured to be wrong. So the entry point takes the body string and nothing
 * else: it does not need a mailbox, a provider, an id, or a timestamp, which is what
 * makes it a pure function and what lets the whole milestone be verified offline.
 *
 * ## What it deliberately does not do
 *
 * - **It does not fetch, open, or resolve anything.** Detection is reading, and
 *   reading has no side effects. A user who has not chosen to follow a link has not
 *   followed it by having their mail read.
 * - **It does not choose.** Several codes in one message means several codes are
 *   returned, ranked. Picking one silently removes the user's only chance to tell them
 *   apart, and M10's workflow needs to be able to ask.
 * - **It does not apply a cut-off.** Every candidate that survived shape filtering is
 *   returned. Where to threshold is a product decision for whoever has a user in front
 *   of them; a constant here would let a wrong number delete a real code.
 * - **It does not widen the shared model.** Everything it returns is either a plain
 *   string or a value the model already defines.
 *
 * @module
 */

import type { VerificationCode, VerificationLink } from "@spectre-mail/core";

import { detectVerificationCodes } from "./detect-codes";
import { detectVerificationLinks } from "./detect-links";
import { extractReadableContent } from "./extract";

/** Everything the parser found in one message body. */
export interface MessageAnalysis {
  /**
   * The message's visible content as plain text.
   *
   * Markup-free by construction. There is no second field a client could mistake for
   * something renderable, so rendering a message unsafely is not a decision any call
   * site is able to make.
   */
  readonly readable: string;
  /** One-time code candidates, ranked, highest confidence first. Empty when none. */
  readonly codes: readonly VerificationCode[];
  /** Verification links, ranked. Empty when no link's wording names one. */
  readonly links: readonly VerificationLink[];
}

/**
 * Analyse one message body.
 *
 * Pure: the same body always produces the same result, and this function reads no
 * clock, consults no environment, and makes no request.
 *
 * @param body The message body exactly as received — the value a provider adapter put
 * in `Message.text`. It may be prose or markup; nothing here distinguishes them or
 * trusts anything about its origin.
 * @returns Readable text plus the codes and links found in it.
 */
export function analyseMessage(body: string): MessageAnalysis {
  const { readable, anchors } = extractReadableContent(body);

  return {
    readable,
    codes: detectVerificationCodes(readable),
    links: detectVerificationLinks(anchors),
  };
}
