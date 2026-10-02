import { describe, expect, it } from "vitest";

import { extractReadableContent } from "./extract";
import type { Anchor } from "./extract";
import {
  LINK_CONFIDENCE_CEILING,
  detectVerificationLinks,
  explainLinkSignals,
} from "./detect-links";

/**
 * Detect against a message body, the way a caller will.
 *
 * Going through extraction rather than hand-building anchors is deliberate: every test
 * here then also exercises the real seam, and none of them can pass on an anchor shape
 * the extractor would never produce.
 */
function detectFrom(body: string): ReturnType<typeof detectVerificationLinks> {
  return detectVerificationLinks(extractReadableContent(body).anchors);
}

/**
 * The single anchor a body yields, or a thrown error.
 *
 * Written rather than asserted with a cast. This repository has already shipped a type
 * assertion that resolved to `never` for every possible input, and a test that cannot
 * distinguish "the value is an anchor" from "the assertion is nonsense" is not a test.
 */
function onlyAnchor(body: string): Anchor {
  const { anchors } = extractReadableContent(body);
  if (anchors.length !== 1) {
    throw new Error(`expected exactly one anchor, got ${anchors.length} from: ${body}`);
  }
  const [anchor] = anchors;
  if (anchor === undefined) {
    throw new Error("unreachable: length was checked");
  }
  return anchor;
}

describe("verification links are decided by wording", () => {
  it("reports a link whose own text asks the reader to verify", () => {
    const links = detectFrom('<a href="https://example.test/v">Verify your email</a>');

    expect(links).toHaveLength(1);
    expect(links[0]?.url).toBe("https://example.test/v");
  });

  it("reports a link whose surrounding wording does the asking", () => {
    const links = detectFrom(
      '<p>Please confirm your email address to finish signing up. <a href="https://example.test/c">Continue</a></p>',
    );

    expect(links.map((link) => link.url)).toEqual(["https://example.test/c"]);
  });

  it("scores a link higher when its own text agrees", () => {
    const byText = detectFrom('<a href="https://example.test/a">Verify your email</a>');
    const byContext = detectFrom(
      '<p>Please verify your email address. <a href="https://example.test/b">Continue</a></p>',
    );

    expect(byText[0]?.confidence).toBeGreaterThan(byContext[0]?.confidence ?? 0);
  });

  it("never reports certainty, even on the strongest possible match", () => {
    const links = detectFrom('<a href="https://example.test/v">Verify your email address now</a>');

    expect(links[0]?.confidence).toBeLessThan(1);
    expect(links[0]?.confidence).toBe(LINK_CONFIDENCE_CEILING);
  });
});

describe("the address never contributes to the score", () => {
  it("does not report a link whose address alone mentions verification", () => {
    // The rule this test exists for. `/confirm-email-preferences`,
    // `/unsubscribe/verify`, and every mail client's confirmation tracking link would
    // all light up an address-shape heuristic, on exactly the mail that should yield
    // nothing.
    const links = detectFrom(
      '<a href="https://example.test/account/verify-email-preferences?id=99">Manage settings</a>',
    );

    expect(links).toEqual([]);
  });

  it("reports the same address when only the wording changes", () => {
    const quiet = detectFrom('<a href="https://example.test/verify-me">Read more</a>');
    const loud = detectFrom(
      '<p>Click to verify your account: <a href="https://example.test/verify-me">Read more</a></p>',
    );

    // Same destination, opposite outcomes, decided entirely by wording.
    expect(quiet).toEqual([]);
    expect(loud).toHaveLength(1);
  });
});

describe("ordinary transactional links are not reported", () => {
  it("ignores an unsubscribe link", () => {
    const links = detectFrom(
      '<a href="https://example.test/unsubscribe?token=abc">Unsubscribe from weekly updates</a>',
    );

    expect(links).toEqual([]);
  });

  it("ignores a preferences link", () => {
    const links = detectFrom('<a href="https://example.test/prefs">Email preferences</a>');

    expect(links).toEqual([]);
  });

  it("ignores a link whose wording is a bare button label", () => {
    const links = detectFrom('<a href="https://example.test/x">Click here</a>');

    expect(links).toEqual([]);
  });

  it("reports nothing for a message with no links at all", () => {
    expect(detectFrom("<p>Nothing to click here.</p>")).toEqual([]);
  });
});

describe("destinations that are not web addresses are rejected", () => {
  it("drops a javascript destination entirely rather than down-ranking it", () => {
    const links = detectFrom('<a href="javascript:alert(1)">Verify your email</a>');

    // Down-ranking would leave it on screen next to a real link, where it is easiest to
    // tap by mistake. Absence is the only safe outcome.
    expect(links).toEqual([]);
  });

  it("drops a data destination entirely", () => {
    const links = detectFrom('<a href="data:text/html;base64,PHNjcmlwdD4=">Confirm</a>');

    expect(links).toEqual([]);
  });

  it("keeps only the followable link when a message mixes both", () => {
    const links = detectFrom(
      '<p>Verify your email: <a href="https://example.test/ok">Continue</a> ' +
        '<a href="javascript:alert(1)">Confirm</a></p>',
    );

    expect(links.map((link) => link.url)).toEqual(["https://example.test/ok"]);
  });

  it("drops a relative destination, because there is no base to resolve it against", () => {
    // A message's own relative link cannot be resolved to anything: there is no
    // document it belongs to. Inventing a base would point at a host nobody verified.
    const links = detectFrom('<a href="/verify/abc">Verify your email</a>');

    expect(links).toEqual([]);
  });

  it("drops a protocol-relative destination for the same reason", () => {
    expect(detectFrom('<a href="//example.test/verify">Verify</a>')).toEqual([]);
  });

  it("drops a destination the address parser cannot read at all", () => {
    // Realistic, not a security case: mail clients mangle destinations, and a space
    // inside a host is the commonest mangling. A URL that cannot be parsed cannot be
    // labelled, so it cannot be something we offer to open.
    const links = detectFrom('<a href="https://exa mple.test/verify">Verify your email</a>');

    expect(links).toEqual([]);
  });

  it("drops a destination with no host", () => {
    expect(detectFrom('<a href="https://">Verify your email</a>')).toEqual([]);
  });
});

describe("each reported link carries its own host", () => {
  it("attaches the host so no caller re-parses the address", () => {
    const links = detectFrom('<a href="https://accounts.example.test/verify?t=abc">Verify</a>');

    expect(links[0]?.hostname).toBe("accounts.example.test");
  });

  it("excludes a port from the host, because a host is not an authority", () => {
    const links = detectFrom(
      '<a href="https://example.test:8443/verify?t=abc">Verify your email</a>',
    );

    expect(links[0]?.hostname).toBe("example.test");
    expect(links[0]?.hostname).not.toContain("8443");
  });

  it("accepts an uppercase scheme, which a sender may well write", () => {
    const links = detectFrom('<a href="HTTPS://Example.test/verify">Verify your email</a>');

    expect(links.map((link) => link.url)).toEqual(["HTTPS://Example.test/verify"]);
    expect(links[0]?.hostname).toBe("example.test");
  });
});

describe("duplicates collapse", () => {
  it("reports a repeated destination once, keeping the stronger wording's score", () => {
    const links = detectFrom(
      '<p><a href="https://example.test/v">Verify your email</a></p>' +
        '<footer><a href="https://example.test/v">Continue</a></footer>',
    );

    expect(links).toHaveLength(1);
    expect(links[0]?.confidence).toBe(LINK_CONFIDENCE_CEILING);
  });

  it("reports distinct destinations separately", () => {
    const links = detectFrom(
      '<p><a href="https://example.test/verify">Verify your email</a> ' +
        '<a href="https://other.test/confirm">Confirm</a></p>',
    );

    expect(links).toHaveLength(2);
  });
});

describe("explanations", () => {
  it("names both signals when both are present", () => {
    const anchor = onlyAnchor(
      '<p>Please confirm your email address. <a href="https://example.test/v">Verify your email</a></p>',
    );

    expect(explainLinkSignals(anchor)).toEqual(["link text", "surrounding wording"]);
  });

  it("names only the surrounding wording when the link's own text is plain", () => {
    const anchor = onlyAnchor(
      '<p>Please verify your email address. <a href="https://example.test/v">Continue</a></p>',
    );

    expect(explainLinkSignals(anchor)).toEqual(["surrounding wording"]);
  });

  it("names the paragraph above when that is the only signal", () => {
    // The password-reset shape: the introducing sentence is its own paragraph, so the
    // link's own text ("Reset password") and its own block both say nothing.
    const anchor = onlyAnchor(
      "<p>Or confirm the reset from this device:</p>" +
        '<p><a href="https://example.test/reset">Reset password</a></p>',
    );

    expect(explainLinkSignals(anchor)).toEqual(["the paragraph above"]);
    expect(detectVerificationLinks([anchor])).toHaveLength(1);
  });

  it("does not let the paragraph above report a link inside a sentence", () => {
    // The narrowing. Unconditionally, this would report an unsubscribe link sitting
    // under a verification sentence — the false positive design.md D8 exists to
    // prevent.
    const anchor = onlyAnchor(
      "<p>Please confirm your email address</p>" +
        '<p>Manage it with <a href="https://example.test/unsubscribe">Unsubscribe</a></p>',
    );

    expect(explainLinkSignals(anchor)).toEqual([]);
    expect(detectVerificationLinks([anchor])).toEqual([]);
  });

  it("records the limit: a link followed by more of its sentence still reads as alone", () => {
    // `Anchor.context` is captured when the link closes, so words *after* it in the
    // same block are not in the window and the link looks like the only thing in its
    // block. Recorded rather than hidden: the widening above is therefore slightly
    // broader than its documentation implies, and this is the case where.
    //
    // The failure direction is acceptable — it can only *add* a signal to a link whose
    // own block begins with verification wording, which is a plausible reading — but it
    // is not what the rule says, and a rule that is not what it says is a bug waiting
    // to be mistaken for a guarantee.
    const anchor = onlyAnchor(
      "<p>Please confirm your email address</p>" +
        '<p><a href="https://example.test/unsubscribe">Unsubscribe</a> from security alerts</p>',
    );

    expect(anchor.context).toBe("Unsubscribe");
    expect(explainLinkSignals(anchor)).toEqual(["the paragraph above"]);
  });

  it("names only the link's own text when the surrounding wording is plain", () => {
    const anchor = onlyAnchor('<a href="https://example.test/v">Verify your email</a>');

    expect(explainLinkSignals(anchor)).toEqual(["link text"]);
  });

  it("names nothing for an ordinary link", () => {
    const anchor = onlyAnchor('<a href="https://example.test/unsubscribe">Unsubscribe</a>');

    expect(explainLinkSignals(anchor)).toEqual([]);
  });
});

describe("determinism and purity", () => {
  it("produces identical results for identical input", () => {
    const body = '<p>Verify: <a href="https://example.test/v">Verify your email</a></p>';
    const first = detectFrom(body);

    expect(detectFrom(body)).toEqual(first);
    expect(detectFrom(body)).toEqual(first);
  });
});
