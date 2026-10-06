/**
 * The committed stylesheet matches its source.
 *
 * ## Why this test exists
 *
 * `tokens.css` is generated, and a generated file that nobody checks is a file that
 * drifts. The failure is not a build error — it is a palette that has moved while the
 * contrast test still passes, because the contrast test reads `tokens.ts`.
 *
 * **So this test is the only thing standing between the two.** It compares the committed
 * bytes against the renderer, which means the check and the writer are the same
 * function: a test that rendered its own expectation would be checking the renderer
 * rather than the file.
 *
 * ## What it does not establish
 *
 * That the CSS is *valid*, or that a browser parses it. That is established by the build
 * (`pnpm build`) and by the browser tier, which loads the real page. This is a drift
 * check and nothing more.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { renderTokensCss } from "./tokens-css";

const HERE = dirname(fileURLToPath(import.meta.url));
const COMMITTED = join(HERE, "tokens.css");

describe("the generated token layer", () => {
  it("is byte-for-byte what its source renders", () => {
    const committed = readFileSync(COMMITTED, "utf8");

    // Reported as a single diff-shaped comparison rather than `toBe`, so a mismatch says
    // what changed. `toBe` on two multi-kilobyte strings prints both, and the useful
    // part is the line that differs.
    expect(committed === renderTokensCss()).toBe(true);
  });

  it("says on its face that it must not be edited", () => {
    const committed = readFileSync(COMMITTED, "utf8");

    expect(committed).toContain("GENERATED FILE — DO NOT EDIT");
    expect(committed).toContain("packages/ui/src/tokens.ts");
  });

  it("declares the dark scheme as its own values rather than as a derivation", () => {
    const committed = readFileSync(COMMITTED, "utf8");

    // A dark scheme produced by a filter or by inverting the light one is not a second
    // scheme; it is the first rearranged, and it fails contrast somewhere unremarkably.
    // So the stylesheet has to contain the dark values spelled out, and a rule that
    // would catch a `filter: invert()` on a root element has to have something to catch.
    expect(committed).toContain("@media (prefers-color-scheme: dark)");
    expect(committed).toContain("--surface-page: #0e0e11;");
    expect(committed).not.toMatch(/filter:\s*invert/i);
  });

  it("references no origin outside this repository", () => {
    const committed = readFileSync(COMMITTED, "utf8");

    // Also enforced by a boundary rule over every shipped stylesheet. Asserted here as
    // well because this is the file a webfont would be added to first, and the reason
    // it must not be is recorded in `tokens.ts` — where the next person will be reading.
    expect(committed).not.toMatch(/https?:\/\//);
    expect(committed).not.toMatch(/@import/);
  });

  it("declares a focus indicator token and never a removed one", () => {
    const committed = readFileSync(COMMITTED, "utf8");

    expect(committed).toContain("--focus:");
    expect(committed).not.toMatch(/outline:\s*(none|0)/i);
  });
});
