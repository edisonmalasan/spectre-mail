/**
 * The message corpus, and what each message is expected to yield.
 *
 * ## Every fixture here is authored, not captured
 *
 * **This repository has never received verification mail from any service.** M0 sent
 * messages to two temporary-mail providers and received a provider welcome note and a
 * maintainer-sent message (run `2026-10-01T18-08-41-251Z`). Nothing else.
 *
 * So a fixture shaped like a service's mail is a fixture **written from a description
 * of that shape**, and every entry says so in its own `note`. A file of bodies that
 * looked like captures would create a false provenance claim in the one place a future
 * maintainer would rely on it: deciding whether a detector still works.
 *
 * The distinction is the same one M3 drew between a measured provider response and a
 * recording explicitly labelled `SYNTHETIC`, and it is why every fixture carries a
 * `synthetic: true` field rather than a comment that could be deleted.
 *
 * ## Declared expectations are the measurement
 *
 * Each fixture declares the ordered codes and links it yields. That is what makes a
 * regression a **visible diff in this file** rather than a silent discrepancy: add a
 * digit to a fixture and the expected list is wrong in the same commit.
 *
 * Expectations are declared as exact ordered value lists, not as exact scores, because
 * the scores are means rather than ends. What matters is *which* values appear and in
 * *what order* — that is what a false positive or a missed code looks like. Score
 * bounds and strict ordering are asserted separately in `corpus.test.ts`.
 *
 * ## Reserved domains only
 *
 * Every address uses `.example` or `.test`, which are reserved and cannot resolve. A
 * fixture pointing at a real domain would invite someone to send mail to it, and this
 * is a repository that has decided not to contact third parties to pass its tests.
 *
 * @module
 */

/** What a fixture is expected to produce. */
export interface FixtureExpectation {
  /**
   * One-time code values, in the order they should be reported — best first.
   *
   * An empty list means "nothing here should look like a code". Where a message has no
   * real code but does contain digit runs, the expectation lists the low-ranked values
   * rather than pretending they are absent: see `newsletter`, whose only digit run is
   * a copyright year, and `block-separated-code`, whose note explains the limit.
   */
  readonly codes: readonly string[];
  /** Verification link destinations, best first. Empty means no link is reported. */
  readonly links: readonly string[];
}

/**
 * The sentence a service-named fixture must carry, and must carry verbatim.
 *
 * Exported so the test asserting it and the notes containing it are reading the same
 * string. Written twice, the rule and the prose drift — and a drifted rule goes red for
 * a spelling difference, which trains a maintainer to change the prose to make a
 * provenance check pass rather than to fix provenance.
 */
export const PROVENANCE_SENTENCE = "This repository has never received mail from that service.";

/**
 * Every message shape the roadmap requires the parser to be exercised against.
 *
 * Named here as data rather than described in prose, so coverage is something a test can
 * assert instead of something a reader has to trust. The list is the roadmap's, in the
 * roadmap's order.
 */
export const ROADMAP_SHAPES: readonly string[] = [
  "a four-digit one-time code",
  "a six-digit one-time code",
  "an eight-digit one-time code",
  "multiple numeric candidates",
  "markup-heavy mail",
  "plain-text mail",
  "a magic link",
  "order-confirmation mail with misleading numbers",
  "a newsletter",
  "a password reset",
  "GitHub-style verification",
  "Discord-style verification",
  "generic SaaS verification",
];

/** One message body and what it is expected to yield. */
export interface MailFixture {
  /** Stable identifier, used in a failing test's name. */
  readonly id: string;
  /** The shape this fixture represents, in plain terms. */
  readonly shape: string;
  /**
   * Which roadmap shapes this fixture exercises.
   *
   * Empty for a fixture the roadmap did not ask for. Those are additions made because a
   * measurement demanded one, and they are counted separately so the decision is
   * reviewable rather than hidden among the required work.
   */
  readonly covers: readonly string[];
  /** Always `true`. Present so the corpus cannot silently gain a claimed capture. */
  readonly synthetic: true;
  /** Why this fixture is the shape it is, and what it is not. */
  readonly note: string;
  /** The message body, exactly as a provider would deliver it. */
  readonly body: string;
  readonly expect: FixtureExpectation;
}

export const MAIL_FIXTURES: readonly MailFixture[] = [
  {
    id: "four-digit-code",
    shape: "a four-digit one-time code",
    covers: ["a four-digit one-time code"],
    synthetic: true,
    note:
      "The shortest length the roadmap admits. Some services use four digits rather " +
      "than six, which is the case a character-count heuristic gets wrong most often.",
    body: [
      "<p>Sign in to Example Cloud</p>",
      "<p>Your verification code is 8421</p>",
      "<p>This code expires in 10 minutes.</p>",
    ].join(""),
    expect: { codes: ["8421"], links: [] },
  },
  {
    id: "six-digit-code",
    shape: "a six-digit one-time code",
    covers: ["a six-digit one-time code"],
    synthetic: true,
    note:
      "The most common shape, and the one most likely to collide with a price or an " +
      "order reference — which is why the reducing shapes exist at all.",
    body: [
      "<p>Welcome to Example Cloud</p>",
      "<p>Your verification code is 483920</p>",
      "<p>If you did not ask for this, you can ignore this message.</p>",
    ].join(""),
    expect: { codes: ["483920"], links: [] },
  },
  {
    id: "eight-digit-code",
    shape: "an eight-digit one-time code",
    covers: ["an eight-digit one-time code"],
    synthetic: true,
    note:
      "The longest length the roadmap admits. Nine digits must not be accepted, " +
      "because a nine-digit run is usually an account number rather than a code.",
    body: "<p>Your verification code is 12345678</p>",
    expect: { codes: ["12345678"], links: [] },
  },
  {
    id: "block-separated-code",
    shape: "a code in its own block, with the wording in the block above it",
    // Not on the roadmap's list. Kept because it is the fixture that measured a defect
    // in the rule as proposed — see its note.
    covers: [],
    synthetic: true,
    note:
      "The fixture that forced a **widening of the rule proposed for this change**. " +
      "Under same-block association alone this scored 0.6, because templates that space " +
      "a number out put the wording and the code in different paragraphs — and a " +
      "detector that cannot rank the messages the roadmap describes is not finished. A " +
      "bare value now borrows the wording of the block above it, which is why this " +
      "scores the same as a code sitting in the same sentence as its wording. Kept as a " +
      "fixture because it is the case that limit has to be checked against.",
    body: ["<p>Your verification code is</p>", "<p><b>741852</b></p>"].join(""),
    expect: { codes: ["741852"], links: [] },
  },
  {
    id: "multiple-candidates",
    shape: "several values that could be a code",
    covers: ["multiple numeric candidates"],
    synthetic: true,
    note:
      "The roadmap's requirement to surface multiple candidates rather than " +
      "pretend certainty. A support reference appears beside the real code so the " +
      "ranking has something to do.",
    body: [
      "<p>Your verification code is 551203</p>",
      "<p>Your case reference is 992417</p>",
      "<p>Quote both if you contact support.</p>",
    ].join(""),
    expect: { codes: ["551203", "992417"], links: [] },
  },
  {
    id: "markup-heavy",
    shape: "markup-heavy mail with a stylesheet and a tracking pixel",
    covers: ["markup-heavy mail"],
    synthetic: true,
    note:
      "What a marketing-template send actually looks like. The stylesheet carries a " +
      "six-digit hex colour and the tracking comment a nine-digit id; both would be " +
      "offered to the user as codes if script, style, and comment content were only " +
      "stripped of their tags rather than dropped.",
    body: [
      "<!DOCTYPE html><html><head>",
      "<style>.btn{color:#4a9f2b;padding:12px}</style>",
      "</head><body>",
      "<!-- campaign pixel 998877665544 -->",
      "<table><tr><td><h1>Confirm your email</h1></td></tr>",
      "<tr><td>Your verification code is",
      "<span class='code'>638204</span></td></tr>",
      "<tr><td><a href='https://example.test/verify?t=a1'>Verify your email</a></td></tr>",
      "</table></body></html>",
    ].join(""),
    expect: { codes: ["638204"], links: ["https://example.test/verify?t=a1"] },
  },
  {
    id: "plain-text-code",
    shape: "a plain-text message with no markup at all",
    covers: ["plain-text mail"],
    synthetic: true,
    note:
      "The other half of the provider split. M0 measured one provider delivering an " +
      "HTML body under a plain-text content type, and only Mail.tm's delivered message " +
      "was observed as plain text — so this case is the one the parser must not " +
      "damage, not the one it exists to rescue.",
    body: [
      "Example Cloud",
      "",
      "Your one-time passcode is 305918",
      "",
      "It expires in 15 minutes.",
      "",
      "If this was not you, ignore this message.",
    ].join("\n"),
    expect: { codes: ["305918"], links: [] },
  },
  {
    id: "magic-link",
    shape: "a magic link with no code anywhere",
    covers: ["a magic link"],
    synthetic: true,
    note:
      "The case where the whole value of the message is one link. The button text is " +
      "deliberately plain, because that is how magic links are written — the wording " +
      "before it is the signal.",
    body: [
      "<p>Your Example Cloud sign-in link</p>",
      "<p>This link signs you in to Example Cloud and expires in one hour.</p>",
      '<p><a href="https://example.test/session/one-time-token">Sign in to continue</a></p>',
      "<p>If you did not request it, do nothing.</p>",
    ].join(""),
    expect: { codes: [], links: ["https://example.test/session/one-time-token"] },
  },
  {
    id: "order-confirmation-with-misleading-numbers",
    shape: "a transactional confirmation full of numbers, including a real code",
    covers: ["order-confirmation mail with misleading numbers"],
    synthetic: true,
    note:
      "The corpus's real false-positive test, and the reason the reducing shapes " +
      "exist. A price, an order number, a tracking number, a postal code, and a year " +
      "all sit beside one genuine verification code. The requirement is not that the " +
      "misleading numbers vanish — it is that the code outranks every one of them. " +
      "\n\nThe order of the runners-up is worth reading rather than sorting. The postal " +
      "code and the tracking number outrank the order number because each is the only " +
      "digit run in its own block while the order number shares a paragraph with a " +
      "date. That is the scoring working as published, not a mistake — and it is why " +
      "this fixture asserts an exact ordered list instead of a set.",
    body: [
      "<p>Your Example Store order is confirmed</p>",
      "<p>Order number 123456 was placed on 2026-04-15</p>",
      "<p>Tracking number 98765 ships within two days</p>",
      "<p>Total: $129.90 USD</p>",
      "<p>Shipping to ZIP 94103</p>",
      "<p>Confirm the billing change with verification code 706251</p>",
    ].join(""),
    expect: {
      codes: ["706251", "94103", "98765", "123456", "2026"],
      links: [],
    },
  },
  {
    id: "newsletter",
    shape: "ordinary bulk mail with no code",
    covers: ["a newsletter"],
    synthetic: true,
    note:
      "A newsletter's only digit run is its copyright year, and a year is a " +
      "**reducing** shape rather than an excluding one — so it is returned, ranked " +
      "last. The expectation says so rather than claiming zero candidates, because " +
      "claiming zero would require the parser to drop a digit run that the roadmap " +
      "forbade dropping. What must hold is that nothing here ranks above what a real " +
      "code scores.",
    body: [
      "<p>Example Notes — issue 42</p>",
      "<p>Three things we shipped this month, and one thing we did not.</p>",
      '<p><a href="https://example.test/unsubscribe?token=abc">Unsubscribe</a></p>',
      "<p>Copyright 2026 Example. All rights reserved.</p>",
    ].join(""),
    expect: { codes: ["2026"], links: [] },
  },
  {
    id: "password-reset",
    shape: "a password reset message",
    covers: ["a password reset"],
    synthetic: true,
    note:
      "A reset message where the useful link competes with an unsubscribe link. " +
      'The button text alone says nothing — "Reset password" names no verification ' +
      "wording — so the link is reported because of the sentence above it. That is the " +
      "whole case for looking at surrounding wording, and the unsubscribe link in the " +
      "same message is the contrast that shows it is not simply reporting links.",
    body: [
      "<p>Someone asked to reset your Example Cloud password</p>",
      "<p>Use this one-time code to choose a new password: 204817</p>",
      "<p>Or confirm the reset from this device:</p>",
      '<p><a href="https://example.test/reset?token=zz">Reset password</a></p>',
      '<p><a href="https://example.test/unsubscribe">Unsubscribe from security alerts</a></p>',
    ].join(""),
    expect: { codes: ["204817"], links: ["https://example.test/reset?token=zz"] },
  },
  {
    id: "github-style-verification",
    shape: "a short code in a sparse message with strong wording",
    covers: ["GitHub-style verification"],
    synthetic: true,
    note:
      "Named for the pattern the roadmap names — a short numeric code beside " +
      "unusually strong verification wording, in an otherwise very sparse message. " +
      `${PROVENANCE_SENTENCE} This is written from a description of the shape, not ` +
      "from a capture.",
    body: [
      "<p>Example Forge</p>",
      "<p>Your verification code is 812543</p>",
      "<p>It expires in 10 minutes.</p>",
    ].join(""),
    expect: { codes: ["812543"], links: [] },
  },
  {
    id: "discord-style-verification",
    shape: "a code shown as a standalone block with a heading above it",
    covers: ["Discord-style verification"],
    synthetic: true,
    note:
      "Named for the pattern the roadmap names — a code presented as its own visual " +
      "block beneath a short heading, with no explanatory sentence anywhere. " +
      `${PROVENANCE_SENTENCE}\n\n` +
      "The case is that the wording is a **heading**, and it is a heading rather than a " +
      "sentence precisely because there is no sentence. It scores the full 0.85 only " +
      "because a bare value borrows the block above it; the heading is the block above.",
    body: ["<h2>Example Chat — account verification</h2>", "<p>573091</p>"].join(""),
    expect: { codes: ["573091"], links: [] },
  },
  {
    id: "generic-saas-verification",
    shape: "an ordinary SaaS verification message",
    covers: ["generic SaaS verification"],
    synthetic: true,
    note:
      "The plainest possible case, and the one most representative of the traffic " +
      "this product exists for. Nothing distinguishes it from the others except that " +
      "its wording is less emphatic, which is worth knowing.",
    body: [
      "<p>Confirm your email address</p>",
      "<p>Enter this code to confirm your email address: 447190</p>",
      '<p><a href="https://example.test/confirm?token=q7">Confirm email address</a></p>',
    ].join(""),
    expect: { codes: ["447190"], links: ["https://example.test/confirm?token=q7"] },
  },
];
