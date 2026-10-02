/**
 * Messages, verification codes, and verification links.
 *
 * A temporary-mail product exists to get a user one thing: a code or a link they
 * can paste somewhere within a minute. So the model puts those two detections
 * first-class, and everything else serves them.
 *
 * Two decisions here are shaped by measurement rather than taste, and both are
 * load-bearing:
 *
 * - **A required field may be empty.** A real Guerrilla message arrived with an
 *   empty subject while its sender and body were present (run
 *   `2026-10-01T18-08-41-251Z`). A model that treated emptiness as absence would
 *   discard a message that genuinely arrived.
 * - **The body is text, and there is no markup field.** Guerrilla was measured
 *   returning a declared plain-text content type while delivering an HTML body, and
 *   the real message arrived as raw HTML. Rather than trust a declared type or
 *   carry markup for a renderer to misuse, the model has exactly one body field and
 *   it is text.
 *
 * @module
 */

/**
 * What a message carried, without its body.
 *
 * Everything needed to render a mailbox list row. `text`, the codes, and the links
 * are absent here on purpose: listing a mailbox must not require fetching bodies.
 */
export interface MessageSummary {
  readonly id: string;
  readonly mailboxId: string;
  /**
   * The sender's address. Required, but **may be the empty string** when the sender
   * left it blank - see the module note.
   */
  readonly from: string;
  /**
   * The sender's display name, when the provider supplied one.
   *
   * Optional rather than possibly-empty because the two cases mean different
   * things: absent means the provider gave us nothing to show, empty would mean it
   * gave us a blank name. Distinguishing them costs one `?` and keeps a real
   * difference from being flattened.
   */
  readonly fromName?: string;
  /**
   * The subject line. Required, but **may be the empty string**. An empty subject
   * is not corruption and must not be treated as a delivery failure.
   */
  readonly subject: string;
  readonly receivedAt: number;
  /** Whether the provider reported this message as unread. See the note on this field. */
  readonly unread?: boolean;
}

/**
 * A detected one-time code, with how sure the detector is.
 *
 * Detection itself belongs to `packages/mail-parser`, which is deterministic by
 * product principle - no AI is involved in this path. This type only describes the
 * result.
 */
export interface VerificationCode {
  readonly value: string;
  /**
   * How confident the detector is, inclusively between 0 and 1.
   *
   * A plain `number` rather than a branded type. Branding it now would buy nothing
   * observable while nothing produces these values, because every construction site
   * would have to assert the brand and those assertions would compile forever after.
   * The range is checked where a detection enters the model instead.
   */
  readonly confidence: number;
}

/**
 * A link a user is expected to follow to verify an account.
 */
export interface VerificationLink {
  readonly url: string;
  /** The link's host, extracted so a UI can label it without parsing the URL again. */
  readonly hostname: string;
  /** See {@link VerificationCode.confidence}. */
  readonly confidence: number;
}

/**
 * A message with its body and its detected verifications.
 *
 * Extends {@link MessageSummary} rather than repeating it: a full message is
 * exactly a summary plus the parts a list row does not show.
 */
export interface Message extends MessageSummary {
  /**
   * The message body, as untrusted text.
   *
   * There is deliberately no markup field. `provider-abstraction` requires that a
   * provider's declared content type is not trusted and that raw content is never
   * rendered as HTML. Carrying markup for a renderer to misuse would leave the
   * decision to every call site; having no field to misuse makes the safe path the
   * only available one.
   */
  readonly text: string;
  readonly verificationCodes: readonly VerificationCode[];
  readonly verificationLinks: readonly VerificationLink[];
}

/**
 * The inclusive bounds a confidence value must fall within.
 */
const CONFIDENCE_MIN = 0;
const CONFIDENCE_MAX = 1;

/**
 * Whether `value` is a usable confidence score.
 *
 * Exported because a detector in `packages/mail-parser` will need it, and because
 * leaving the check in one place is what stops three producers from each inventing
 * slightly different bounds.
 */
export function isValidConfidence(value: unknown): value is number {
  return typeof value === "number" && value >= CONFIDENCE_MIN && value <= CONFIDENCE_MAX;
}

/**
 * Return `value` as a confidence score, or throw if it is outside `0..1`.
 *
 * Applied where a detection enters the model, not at every read. The point is that
 * an impossible score never reaches storage, where it would later be displayed to a
 * user as if it meant something.
 *
 * @throws {Error} If `value` is not a number within the inclusive range.
 */
export function assertConfidence(value: unknown, context: string): number {
  if (!isValidConfidence(value)) {
    throw new Error(
      `${context} reported a confidence of ${JSON.stringify(value)}, which is outside ` +
        `the inclusive range ${CONFIDENCE_MIN}..${CONFIDENCE_MAX}.`,
    );
  }
  return value;
}

/**
 * Build a message summary whose required fields may be empty.
 *
 * Exists mostly to make the empty-field rule impossible to overlook at a call
 * site: there is one obvious way to make a summary, and it does not check that
 * `subject` or `from` are non-empty.
 */
export function createMessageSummary(
  summary: Omit<MessageSummary, "subject" | "from"> &
    Partial<Pick<MessageSummary, "subject" | "from">>,
): MessageSummary {
  return {
    ...summary,
    from: summary.from ?? "",
    subject: summary.subject ?? "",
  };
}
