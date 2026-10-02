import { describe, expect, it } from "vitest";

import { assertConfidence, createMessageSummary, isValidConfidence } from "./message";
import type { Message, MessageSummary, VerificationCode } from "./message";

/**
 * The fixture below is modelled on the one real message observed during M0:
 * a Guerrilla Mail delivery that arrived with an **empty subject** while its
 * sender and body were present (run `2026-10-01T18-08-41-251Z`). It is the reason
 * `subject` is required-but-possibly-empty rather than optional.
 */
const emptySubjectSummary: MessageSummary = {
  id: "message-1",
  mailboxId: "mailbox-1",
  from: "sender@example.com",
  subject: "",
  receivedAt: 1_700_000_100_000,
};

describe("createMessageSummary", () => {
  it("preserves a message that arrived with an empty subject", () => {
    const summary = createMessageSummary({
      id: "message-1",
      mailboxId: "mailbox-1",
      receivedAt: 1_700_000_100_000,
    });

    expect(summary.subject).toBe("");
    expect(summary.from).toBe("");
  });

  it("keeps values that were supplied", () => {
    const summary = createMessageSummary({
      id: "message-1",
      mailboxId: "mailbox-1",
      receivedAt: 1_700_000_100_000,
      from: "sender@example.com",
      subject: "Your code",
      fromName: "Example",
    });

    expect(summary).toEqual({
      id: "message-1",
      mailboxId: "mailbox-1",
      receivedAt: 1_700_000_100_000,
      from: "sender@example.com",
      subject: "Your code",
      fromName: "Example",
    });
  });

  it("distinguishes an absent optional field from an empty required one", () => {
    const noName = createMessageSummary({
      id: "message-1",
      mailboxId: "mailbox-1",
      receivedAt: 1_700_000_100_000,
    });

    // The provider gave us nothing to display as a name. That is different from a
    // blank name, and flattening the two would make it impossible to tell.
    expect("fromName" in noName).toBe(false);
    // The sender left the field blank. That is a value.
    expect(noName.from).toBe("");
  });

  it("never invents an unread state", () => {
    // No measured provider response established a reliable unread signal, so the
    // field is optional and nothing here fabricates one.
    const summary = createMessageSummary({
      id: "message-1",
      mailboxId: "mailbox-1",
      receivedAt: 1_700_000_100_000,
    });

    expect("unread" in summary).toBe(false);
  });
});

describe("Message body", () => {
  it("carries markup only as text, with no field that invites rendering it", () => {
    const message: Message = {
      ...emptySubjectSummary,
      // Measured: the provider declared plain text and delivered an HTML body.
      text: "<p>Your code is <b>123456</b></p>",
      verificationCodes: [{ value: "123456", confidence: 0.9 }],
      verificationLinks: [],
    };

    expect(message.text).toBe("<p>Your code is <b>123456</b></p>");

    // The whole body surface is exactly one string field, and the complete field
    // set is pinned here. Asserting every key rather than a filtered subset means
    // adding an `html`, `body`, or `content` field later fails this test, which is
    // the point: such a field would be an invitation to render untrusted provider
    // output as markup.
    expect(Object.keys(message).sort()).toEqual([
      "from",
      "id",
      "mailboxId",
      "receivedAt",
      "subject",
      "text",
      "verificationCodes",
      "verificationLinks",
    ]);

    const bodyLike = Object.keys(message).filter((key) =>
      /html|markup|body|content|richtext/i.test(key),
    );
    expect(bodyLike).toEqual([]);
  });

  it("extends the summary rather than redefining it", () => {
    const message: Message = {
      ...emptySubjectSummary,
      text: "hello",
      verificationCodes: [],
      verificationLinks: [],
    };

    const asSummary: MessageSummary = message;
    expect(asSummary.id).toBe(message.id);
    expect(asSummary.subject).toBe("");
  });
});

describe("confidence", () => {
  it("accepts both boundaries of the inclusive range", () => {
    expect(isValidConfidence(0)).toBe(true);
    expect(isValidConfidence(1)).toBe(true);
    expect(isValidConfidence(0.5)).toBe(true);
  });

  it("rejects values outside the range", () => {
    expect(isValidConfidence(-0.1)).toBe(false);
    expect(isValidConfidence(1.1)).toBe(false);
    expect(isValidConfidence(100)).toBe(false);
  });

  it("rejects values that are not numbers at all", () => {
    expect(isValidConfidence("0.9")).toBe(false);
    expect(isValidConfidence(null)).toBe(false);
    expect(isValidConfidence(undefined)).toBe(false);
    expect(isValidConfidence(Number.NaN)).toBe(false);
  });

  it("names the source when rejecting an out-of-range score", () => {
    // "Confidence was wrong" sends a reader to the wrong module entirely.
    expect(() => assertConfidence(1.4, "OTP detector")).toThrow(/OTP detector/);
    expect(() => assertConfidence(1.4, "OTP detector")).toThrow(/0\.\.1/);
  });

  it("returns an in-range score unchanged", () => {
    const code: VerificationCode = { value: "123456", confidence: 0.87 };
    expect(assertConfidence(code.confidence, "OTP detector")).toBe(0.87);
  });
});
