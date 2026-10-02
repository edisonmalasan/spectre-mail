import { describe, expect, it } from "vitest";

import { decodeCharacterReferences, extractReadableContent } from "./extract";

/**
 * What makes these tests worth their existence.
 *
 * The module's central claim is a *negative* one — no markup survives — which is
 * exactly the kind of claim a test suite states without proving. Each test here is
 * written so that reintroducing the corresponding defect turns it red, and that was
 * checked rather than assumed (see the M4 falsification pass).
 */
describe("safe extraction", () => {
  it("leaves no tag in the readable text", () => {
    const result = extractReadableContent("<html><body><p>Hello <b>there</b></p></body></html>");

    expect(result.readable).toBe("Hello there");
    // The negative claim, stated as a positive check: nothing that looks like a tag.
    expect(result.readable).not.toContain("<");
    expect(result.readable).not.toContain(">");
  });

  it("drops script content rather than flattening it into text", () => {
    const result = extractReadableContent(
      "<p>Your code</p><script>var retry = 483920;</script><p>is below</p>",
    );

    // Stripping tags alone would leave "var retry = 483920;" as prose, and the digit
    // run would be offered to the user as a code.
    expect(result.readable).not.toContain("483920");
    expect(result.readable).not.toContain("var retry");
    expect(result.readable).toBe("Your code\n\nis below");
  });

  it("drops style content, so hex colours never look like codes", () => {
    const result = extractReadableContent("<style>.a{color:#4a9f2b}</style><p>Welcome</p>");

    expect(result.readable).not.toContain("4a9f2b");
    expect(result.readable).toBe("Welcome");
  });

  it("drops comment content, which is not prose", () => {
    const result = extractReadableContent("<!-- tracking pixel 998877 --><p>Receipt</p>");

    expect(result.readable).not.toContain("998877");
    expect(result.readable).toBe("Receipt");
  });

  it("decodes character references so a hidden code is still found", () => {
    const result = extractReadableContent("<p>Your code is &#x31;&#52;&#x39;&#x32;&#x30;</p>");

    expect(result.readable).toBe("Your code is 14920");
  });

  it("decodes named references including the ampersand a query string needs", () => {
    expect(decodeCharacterReferences("a&amp;b")).toBe("a&b");
    expect(decodeCharacterReferences("&lt;not a tag&gt;")).toBe("<not a tag>");
    expect(decodeCharacterReferences("it&#39;s")).toBe("it's");
    expect(decodeCharacterReferences("caf&eacute;")).toBe("caf&eacute;");
  });

  it("leaves an unrecognised reference as written rather than inventing a character", () => {
    // Guessing here is how a decoder starts producing text that was never in the
    // message. A visible `&bogus;` is the smaller problem.
    expect(decodeCharacterReferences("&bogus;")).toBe("&bogus;");
  });

  it("preserves a plain-text body without losing anything", () => {
    const body = "Hi there,\n\nYour verification code is 482913.\n\nThanks.";

    expect(extractReadableContent(body).readable).toBe(body);
  });

  it("separates blocks with a blank line so same-block association means something", () => {
    const result = extractReadableContent(
      "<p>Order 1234 confirmed</p><p>Tracking 98765</p><p>Code 551203</p>",
    );

    expect(result.readable).toBe("Order 1234 confirmed\n\nTracking 98765\n\nCode 551203");
  });

  it("does not let malformed markup survive into the output", () => {
    // Unclosed, mis-nested, and unterminated constructs, all at once. The requirement
    // is only about the *failure direction*: tags are lost, text is kept.
    const result = extractReadableContent(
      "<p>one<b>two</p></span>three<div>four<a href='https://example.test/x'>five",
    );

    expect(result.readable).not.toContain("<");
    expect(result.readable).not.toContain(">");
    expect(result.readable).toContain("one");
    expect(result.readable).toContain("two");
    expect(result.readable).toContain("three");
    expect(result.readable).toContain("four");
    expect(result.readable).toContain("five");
  });

  it("keeps suppressing after a stray close tag inside dropped content", () => {
    const result = extractReadableContent(
      "<div><script>if (a</div>) { 771234 }</script><p>Done</p>",
    );

    expect(result.readable).not.toContain("771234");
    expect(result.readable).toBe("Done");
  });

  describe("links", () => {
    it("recovers a destination and the text a reader would click", () => {
      const result = extractReadableContent(
        '<p>Confirm here: <a href="https://example.test/verify?t=abc">Verify your email</a></p>',
      );

      expect(result.anchors).toEqual([
        {
          destination: "https://example.test/verify?t=abc",
          text: "Verify your email",
          context: "Confirm here: Verify your email",
          above: "",
        },
      ]);
    });

    it("records the paragraph above a link, which is often its only introduction", () => {
      const result = extractReadableContent(
        "<p>Or confirm the reset from this device:</p>" +
          '<p><a href="https://example.test/reset">Reset password</a></p>',
      );

      // The common template puts the introducing sentence in its own paragraph, which
      // makes it a different block. Without this field the link's own text and its
      // surroundings would both say nothing, and the most useful link in the message
      // would be missed.
      expect(result.anchors[0]?.above).toBe("Or confirm the reset from this device:");
      expect(result.anchors[0]?.context).toBe("Reset password");
    });

    it("recovers the wording that introduces a link, which is the signal detection uses", () => {
      const result = extractReadableContent(
        "<p>Please confirm your email address to finish signing up. " +
          '<a href="https://example.test/confirm">Confirm</a></p>',
      );

      // Link detection depends on this pairing. Once markup is gone it cannot be
      // reassembled, which is why the extractor captures it rather than leaving it to
      // a detector.
      expect(result.anchors[0]?.context).toContain("Please confirm your email address");
      expect(result.anchors[0]?.context).toContain("Confirm");
    });

    it("does not let a link's context spill into the next block", () => {
      const result = extractReadableContent(
        '<p>Please verify your address: <a href="https://example.test/v">Verify</a></p>' +
          "<p>Unsubscribe from weekly updates</p>",
      );

      expect(result.anchors[0]?.context).not.toContain("Unsubscribe");
    });

    it("closes a link's context at the block that ends mid-link", () => {
      const result = extractReadableContent(
        '<p><a href="https://example.test/v">Verify</p><p>Order 12345 placed</p>',
      );

      expect(result.anchors[0]?.context).not.toContain("Order 12345");
    });

    it("recovers a destination split across line breaks and entity-encoded", () => {
      const result = extractReadableContent(
        '<a\n  href="https://example.test/a?x=1&amp;y=2"\n  class="btn">\n  Click <b>here</b>\n</a>',
      );

      expect(result.anchors).toHaveLength(1);
      expect(result.anchors[0]?.destination).toBe("https://example.test/a?x=1&y=2");
      // The nested tag contributes a space, not a break in the middle of a word.
      expect(result.anchors[0]?.text).toBe("Click here");
    });

    it("recovers an unquoted destination, which mail clients actually emit", () => {
      const result = extractReadableContent("<a href=https://example.test/x>Go</a>");

      expect(result.anchors[0]?.destination).toBe("https://example.test/x");
    });

    it("keeps a link whose text is an image, rather than dropping it", () => {
      const result = extractReadableContent(
        '<a href="https://example.test/magic"><img src="https://example.test/i.png" alt=""></a>',
      );

      // An empty text is a real case — the wording a reader sees is nothing. Dropping
      // the link would lose the one destination the message contained.
      expect(result.anchors).toHaveLength(1);
      expect(result.anchors[0]).toEqual({
        destination: "https://example.test/magic",
        text: "",
        context: "",
        above: "",
      });
    });

    it("records a link with no destination rather than inventing one", () => {
      const result = extractReadableContent("<a>Click here</a>");

      expect(result.anchors).toEqual([
        { destination: "", text: "Click here", context: "Click here", above: "" },
      ]);
    });

    it("keeps every link, in the order they appeared", () => {
      const result = extractReadableContent(
        '<a href="https://a.test/1">First</a> then <a href="https://b.test/2">Second</a>',
      );

      expect(result.anchors.map((anchor) => anchor.destination)).toEqual([
        "https://a.test/1",
        "https://b.test/2",
      ]);
    });

    it("ignores a link inside dropped content", () => {
      const result = extractReadableContent(
        '<script>var u = "https://tracker.test/pixel";</script><p>Real content</p>',
      );

      expect(result.anchors).toEqual([]);
    });
  });

  it("is a pure function of its input", () => {
    const body = '<p>Code 741852</p><a href="https://example.test/v">Verify</a>';

    const first = extractReadableContent(body);
    const second = extractReadableContent(body);

    expect(second).toEqual(first);
  });
});
