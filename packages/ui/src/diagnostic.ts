/**
 * What may be reported, and what may not.
 *
 * ## Why this is here and not in a client
 *
 * **Because the two clients must not be able to drift.** The website and the extension each report
 * the outcomes of their own session, and the thing that stops them drifting is that they read the
 * *same* definition of a reportable value rather than each holding a copy of the idea. A copy in each
 * client is two definitions that agree until the first edit, and the first edit is the one nobody
 * reviews.
 *
 * **`packages/ui` is the package that owns what the two clients already share** — the product's
 * public name lives here beside it — and a shared *rule* belongs beside a shared *name* for the
 * same reason `name.ts` gives for being here: *a palette is shared by definition and its interface
 * is data, not behaviour*, and so is the shape of a value a client is allowed to show.
 *
 * ## The three shapes, and why the list is short
 *
 * A reportable value is **a count, a normalized outcome, or an elapsed duration**. That is the whole
 * of it, and each entry answers a question about what would be unsafe:
 *
 * - **a count** — *how many times*, never *what*. A count of something is not a record of it.
 * - **a normalized outcome** — a name drawn from a closed vocabulary, never the raw answer that
 *   produced it. **A provider's normalized code is the fact; the response that carried it is not.**
 * - **an elapsed duration** — *how long a thing took*. See below for why a duration and not a
 *   timestamp.
 *
 * ## A duration is not a timestamp, and that is the whole reason a duration is allowed
 *
 * **A duration says how long a thing took and cannot be placed on a calendar.** A timestamp says
 * exactly that: it says *when*, and *when* is a record of a person's afternoon. The difference is
 * not a nicety — it is the difference between a value that survives the session and one that
 * pins the session to a moment, and this module's whole claim is that a reportable value does not
 * outlive the session it happened in.
 *
 * **The type makes it structural rather than a promise.** `ReportableDuration` carries a
 * `milliseconds` field and nothing else, so there is nowhere for a wall-clock time to be put.
 *
 * ## The exclusions are named, and naming them is the point
 *
 * {@link EXCLUDED_REPORTABLE_VALUES} names what a reportable value may **not** be: an address, a
 * message id, a sender, a subject, a hostname, a URL, a form, a field, or content.
 *
 * **A list of prohibitions is a list somebody has to extend one incident at a time** — and an
 * unnamed prohibition is not a prohibition at all, because the next editor cannot tell whether the
 * thing they are about to add was in the list or was simply not thought of. **So the list is
 * exported, by name, and a test holds it to exactly those nine names.** A tenth thing that is
 * forbidden cannot be added to this module without the list changing, which is the moment somebody
 * has to look at whether it should be allowed.
 *
 * ## What this module does not do
 *
 * **It does not own the vocabularies.** The provider's eight failure codes belong to
 * `@spectre-mail/core`, which owns them for both clients already, and the in-page recogniser's own
 * answers belong to the extension's protocol. **What this module owns is the shape** — the three
 * kinds, the nine exclusions, and the type every reported value has — so that a value one client
 * shows is a value the other client could show, and a value neither may show has nowhere to be
 * typed.
 *
 * @module
 */

/**
 * The three shapes a reportable value may take.
 *
 * **A closed list, and a value of any other shape is not a reportable value.** The list is closed
 * because an open one is a list somebody extends the first time they need a fourth kind, and the
 * fourth kind is the one that carries something nobody checked.
 */
export const REPORTABLE_VALUE_KINDS = ["count", "normalizedOutcome"] as const;

/** One of the three shapes a reportable value may take. */
export type ReportableValueKind = (typeof REPORTABLE_VALUE_KINDS)[number];

/**
 * What a reportable value may not be, by name.
 *
 * **Nine names, and the list is the module's own claim about itself.** Each one is something the
 * product holds elsewhere and that a report of this session has no business repeating:
 *
 * - **an address** — the product's own record, in the store.
 * - **a message id** — an identifier for a thing somebody wrote to.
 * - **a sender**, **a subject** — the content of a message, reduced to two fields and still
 *   content.
 * - **a hostname** — the one thing about a page this product is allowed to keep, and keeping it in
 *   a *report* would make it a second record of a page.
 * - **a URL** — a hostname plus the part that carries a token.
 * - **a form**, **a field** — the shape of somebody else's page.
 * - **content** — the catch-all, named so that it is a list somebody has to think about rather than
 *   a feeling.
 */
export const EXCLUDED_REPORTABLE_VALUES = [
  "address",
  "message id",
  "sender",
  "subject",
  "hostname",
  "URL",
  "form",
  "field",
  "content",
] as const;

/** One of the nine things a reportable value may not be. */
export type ExcludedReportableValue = (typeof EXCLUDED_REPORTABLE_VALUES)[number];

/**
 * How many times something happened.
 *
 * **A count and never a record of what.** The number says how many; it does not say what, and it
 * holds nothing that could be read back into the thing that was counted.
 */
export interface ReportableCount {
  readonly kind: "count";
  /** How many times. Never negative, and never anything but a number. */
  readonly value: number;
}

/**
 * A normalized outcome — a name drawn from a closed vocabulary.
 *
 * **The name, and never the answer that produced it.** A provider's normalized code is the fact;
 * the response that carried it is not, and a report that quoted the response would be holding a
 * piece of somebody else's answer.
 */
export interface ReportableOutcome {
  readonly kind: "normalizedOutcome";
  /** The normalized name. Which vocabulary it belongs to is the caller's business. */
  readonly outcome: string;
}

/**
 * How long something took.
 *
 * **A duration, and the field is named `milliseconds` because there is nowhere to put a clock.**
 * There is no `at`, no `startedAt`, no `finishedAt`: a duration says how long a thing took and
 * cannot be placed on a calendar, and that is the property that makes it the one time-shaped value
 * a report may carry.
 */
/** A value a report may carry. */
export type ReportableValue = ReportableCount | ReportableOutcome;

/**
 * Whether `value` is a reportable value.
 *
 * **A guard, and it is here so a client can check a value rather than assert it.** A report is
 * assembled from values that arrive from several places, and the check that a value is one of the
 * three shapes is worth making once, in one place, in a way both clients read.
 *
 * **The count and the duration are checked for being numbers, and a negative count is refused.**
 * A count of minus three is not a count of anything, and a duration of minus a second is not a
 * duration; both would be a bug in whatever produced them, and the guard is where a bug is caught
 * before it is shown to a person.
 */
export function isReportableValue(value: unknown): value is ReportableValue {
  if (typeof value !== "object" || value === null) return false;

  const kind: unknown = Reflect.get(value, "kind");

  if (kind === "count") {
    const count: unknown = Reflect.get(value, "value");
    return typeof count === "number" && Number.isFinite(count) && count >= 0;
  }

  if (kind === "normalizedOutcome") {
    const outcome: unknown = Reflect.get(value, "outcome");
    return typeof outcome === "string" && outcome.length > 0;
  }

  // **There is no third shape, and a value of any other shape is refused.** There was once an
  // elapsed duration here, and it is gone because the website's page forbids any interval of the
  // product's own and the panel has never shown one either -- so a report would have been the first
  // place the product showed a figure of its own, and **a shape with no consumer is a schema to
  // migrate rather than a feature**.
  return false;
}

/**
 * A count of how many times something happened.
 *
 * **A factory rather than an object literal, for the reason the rest of this repository's
 * constructors are factories:** one spelling of a value means two clients cannot disagree about
 * what a count is.
 */
export function reportableCount(value: number): ReportableCount {
  return { kind: "count", value };
}

/**
 * A normalized outcome.
 *
 * **The name is taken verbatim.** A normalized code is a fact this product produced, and altering
 * it would make the report say something the product did not.
 */
export function reportableOutcome(outcome: string): ReportableOutcome {
  return { kind: "normalizedOutcome", outcome };
}

/**
 * An elapsed duration.
 *
 * **Milliseconds, and never a moment.** See {@link ReportableDuration} for why a duration is the
 * one time-shaped value a report may carry.
 */
/**
 * One line of a report: what it is about, and the value it carries.
 *
 * **A label and a value, and the label is the only free text in the whole shape.** The label
 * belongs to the client that renders the report — the website and the extension say things in
 * their own voices — and the value is one of the three shapes above.
 */
export interface DiagnosticEntry {
  /** What this line reports, in the reporting client's own words. */
  readonly label: string;
  /** The value this line carries. */
  readonly value: ReportableValue;
}

/**
 * A report of one session.
 *
 * **A list and nothing else.** There is no timestamp on it, no session id, and no place for one:
 * a report of this session is only meaningful while this session is running, and a report that
 * could be filed and read later would be a record.
 */
export interface DiagnosticReport {
  /** The lines, in the order the reporting client chose. */
  readonly entries: readonly DiagnosticEntry[];
}
