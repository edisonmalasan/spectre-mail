/**
 * `@spectre-mail/mail-parser` — message content interpretation.
 *
 * Owns: safe text extraction, one-time code detection, verification-link detection.
 *
 * ## What this package is for
 *
 * A temporary-mail product exists to hand a user one thing within a minute: the code
 * or the link they were sent. `packages/providers` gets a message here; this package is
 * what turns that message into the one value worth showing.
 *
 * ## Why it exists at all, given `Message.text` already exists
 *
 * `provider-adapters` requires that a provider's declared content type is **not**
 * trusted, and it deliberately gives `Message` a single `text` field with **no markup
 * field** — there is deliberately nothing a renderer could misuse.
 *
 * That is correct, and it means `Message.text` is not necessarily readable. M0
 * measured Guerrilla Mail declaring a plain-text content type while delivering an HTML
 * body, and the real delivered message arrived as raw HTML (`docs/PROVIDERS.md` §3).
 * So this package receives a string that may be prose or may be an HTML document, and
 * must produce readable text and detections from **both**, without ever consulting a
 * declared type — because there is none here to consult, and the ones providers do
 * publish are demonstrably wrong.
 *
 * The seam is therefore exactly `Message.text`.
 *
 * ## Detection is deterministic
 *
 * No AI, no network, no provider, no clock. The same message always yields the same
 * codes, links, and confidences. That is a product principle, not an implementation
 * detail: a user told "583291 is your code" is relying on that being a repeatable
 * answer rather than one sample from a model.
 *
 * It is also why this milestone can be completed without contacting a provider — and
 * why that matters. Every test in `packages/providers` replays a recording, so none of
 * them can tell us whether a detector works on mail nobody has sent us yet.
 *
 * ## Confidence is a judgement, not a probability
 *
 * Every score is traceable to a rule published in the module that produces it, and **no
 * score is ever reported as certain**. The evidence is wording, and wording is a signal
 * rather than a proof.
 *
 * ## What this package will not do
 *
 * - **Render** anything. There is no markup field to misuse, by design.
 * - **Open, fetch, or resolve** a link. Detection causes no side effect; a user who has
 *   not chosen to follow a link has not followed it by having their mail read.
 * - **Know which service sent a message**, and it does not try. It matches shapes, not
 *   brands.
 *
 * ## Correction to an earlier comment in this file
 *
 * This module previously stated "OTP and verification-link detection are M10". That was
 * wrong. The roadmap schedules **detection in M4**; M10 is the workflow that
 * *consumes* a detection — notifications, copy, fill, and open, all of which need a
 * user present. Detection with nothing to display it is still worth building, and
 * building it now is what lets M10 be a workflow rather than an engine.
 *
 * ## Boundary
 *
 * This package must never import from `apps/web` or `apps/extension`, and must never
 * import from `packages/providers` — a provider hands this package a message body, and
 * nothing more. Enforced by `tests/architecture/boundaries.test.ts`, which also asserts
 * that no module here reaches the global `fetch`.
 *
 * @module
 */

export type { MessageAnalysis } from "./analyse";
export { analyseMessage } from "./analyse";

export type { Anchor, ReadableContent } from "./extract";
export { decodeCharacterReferences, extractReadableContent } from "./extract";

export { detectVerificationCodes, explainCodePenalty } from "./detect-codes";
export {
  detectVerificationLinks,
  explainLinkSignals,
  LINK_CONFIDENCE_CEILING,
} from "./detect-links";
