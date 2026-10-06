/**
 * The generated half of `docs/DESIGN_SYSTEM.md`, held to the same byte-identity property as
 * the generated stylesheet.
 *
 * ## Why a documentation claim needs a test
 *
 * Because a stale design token is worse than an undocumented one. A missing hex in a
 * document is an absence, which a reader notices; a **wrong** hex is a plausible value that
 * an implementer will use, and nothing in the document will contradict them. This repository
 * has refused exactly this pattern twice — in a versioned storage record and in a provider
 * wire format — and a design contract that quietly diverges from its source would be the
 * third.
 *
 * ## What this does and does not check
 *
 * It checks that the **generated region** equals `renderDesignDoc()` byte for byte, and it
 * does **not** check the prose around it. Prose is written by people and reviewed by people;
 * a test that re-derived a sentence would be a second generator, and two generators drift
 * apart for the same reason two declarations do.
 *
 * So the guarantee is narrow and stated: **the tables cannot drift from the token layer**,
 * and **the argument about them can.** Which is the correct division — the argument is the
 * part worth a human's attention, and it is the part a renderer cannot check.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  GENERATED_BEGIN,
  GENERATED_END,
  renderDesignDoc,
  replaceGeneratedRegion,
} from "./design-doc";

/** The repository root, resolved from this file rather than from the process's cwd. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const DOC_PATH = join(REPO_ROOT, "docs", "DESIGN_SYSTEM.md");
const DOC = readFileSync(DOC_PATH, "utf8");

/** The generated region as committed, markers included. */
function committedRegion(): string {
  const begin = DOC.indexOf(GENERATED_BEGIN);
  const end = DOC.indexOf(GENERATED_END);

  expect(begin, `docs/DESIGN_SYSTEM.md has no ${GENERATED_BEGIN}`).toBeGreaterThanOrEqual(0);
  expect(end, `docs/DESIGN_SYSTEM.md has no ${GENERATED_END}`).toBeGreaterThan(begin);

  return DOC.slice(begin, end + GENERATED_END.length);
}

describe("the design document's generated region", () => {
  it("is byte-for-byte what the token layer renders", () => {
    expect(committedRegion()).toBe(renderDesignDoc());
  });

  it("carries one entry per declared colour, in both schemes", () => {
    const region = renderDesignDoc();

    // A table that silently dropped a token would still be byte-identical to its generator,
    // because the generator is the thing that dropped it. So the generator is checked
    // against the layer's own declarations — which is the only place a value can be
    // missing from without the byte-identity test noticing.
    for (const name of ["surface-page", "ink-primary", "ink-accent", "line-strong", "focus"]) {
      expect(region).toContain(`\`--${name}\``);
    }

    for (const hex of ["#f4f4f2", "#16161a", "#5a3fd0", "#0e0e11", "#ecedf0", "#a48cf5"]) {
      expect(region).toContain(`\`${hex}\``);
    }
  });

  it("states every motion token's being unused, since that is the slice-2 constraint", () => {
    const region = renderDesignDoc();

    for (const token of ["duration-fast", "duration-base", "ease-standard"]) {
      expect(region).toContain(`\`--${token}\``);
    }

    // The tokens exist and are consumed by nothing, and the document says so. A reader
    // finding motion tokens in a design contract would reasonably assume something moves.
    expect(region).toContain("used by nothing");
  });

  it("keeps both exclusion lists, so a deliberate omission cannot read as an oversight", () => {
    const region = renderDesignDoc();

    expect(region).toContain("Deliberately held to no threshold");
    expect(region).toContain("`--line-subtle`");
    expect(region).toContain("`--surface-sunken`");
  });

  it("leaves the prose on both sides of the region untouched when the emitter runs", () => {
    // **The emitter's other half, and the one with no other coverage.** A rewrite that
    // dropped the "What is verified, and what is not" section would leave a document that
    // reads as a design contract while claiming nothing about its own limits — and the
    // byte-identity test would stay green, because that prose is not generated.
    //
    // **Both sides are checked**, which the first version of this test did not: it sliced
    // only up to the opening marker and so asserted on prose that lives after the region,
    // where it could never find it. The failing assertion was the honest outcome of a test
    // that had never been run against a document laid out the way the document actually is.
    const regenerated = replaceGeneratedRegion(DOC, renderDesignDoc());
    const cut = DOC.indexOf(GENERATED_BEGIN);
    const regeneratedCut = regenerated.indexOf(GENERATED_BEGIN);

    const before = DOC.slice(0, cut);
    const after = DOC.slice(DOC.indexOf(GENERATED_END) + GENERATED_END.length);
    const regeneratedBefore = regenerated.slice(0, regeneratedCut);
    const regeneratedAfter = regenerated.slice(
      regenerated.indexOf(GENERATED_END) + GENERATED_END.length,
    );

    expect(regeneratedBefore).toBe(before);
    expect(regeneratedAfter).toBe(after);

    // **Named on the side each half actually occupies.** The limits section is the last
    // thing in the document, so a check written against the leading prose would pass on a
    // document that had lost it entirely.
    expect(before).toContain("## Where the values actually live");
    expect(before).toContain("## The rules a token must follow");
    expect(after).toContain("### **Not** verified, and stated rather than implied");
    expect(after).toContain("No test in this repository reads a rendered pixel's colour");
    expect(after).toContain("`use it externally` remains open");
  });

  it("is a pure module, so importing it cannot rewrite the document", () => {
    // **Structural rather than textual, and the change of method is the substance here.**
    //
    // The original claim — "the emitter writes nothing when it is imported rather than
    // invoked" — was checked by reading the script's **text** and looking for a
    // `process.argv[1]` guard. That assertion would have stayed green after the guard was
    // inverted to `return true`, because the string `isEntryPoint()` would still be there
    // with the write still nested under it. That is the recorded "narrower than its rule"
    // defect one layer down from where this repository usually meets it, and it is why the
    // guard is gone.
    //
    // The repair is that there is now nothing to invert: `replaceGeneratedRegion` lives in
    // `design-doc.ts` alongside the renderer, that module imports **no filesystem write API
    // at all**, and the emitter script is entry-point-only code. So the guarantee is a
    // property of the module's own imports.
    const source = readFileSync(join(REPO_ROOT, "packages", "ui", "src", "design-doc.ts"), "utf8");

    expect(source).not.toMatch(/\bfrom "node:fs"/);
    expect(source).not.toMatch(/\b(writeFileSync|appendFileSync|mkdirSync|rmSync|renameSync)\b/);

    // **And the write lives in the script, which nothing imports.**
    const script = readFileSync(
      join(REPO_ROOT, "packages", "ui", "scripts", "emit-design-doc.ts"),
      "utf8",
    );
    expect(script).toContain("writeFileSync(DOC_PATH, next");
  });

  it("refuses to write a document whose markers are missing or reversed", () => {
    // Without the markers the emitter would either throw at an arbitrary place or, worse,
    // append a second region and leave two tables in one document.
    expect(() => replaceGeneratedRegion("# A document\n", renderDesignDoc())).toThrow(/marker/i);
    expect(() => replaceGeneratedRegion(`${GENERATED_END}\n\n${GENERATED_BEGIN}`, "x")).toThrow(
      /wrong way round/,
    );
  });
});

describe("the emitter's import form", () => {
  it("spells the extension on every import Node has to resolve at run time", () => {
    // **Written because the first version did not, and it failed only at run time.**
    //
    // `design-doc.ts` originally imported `./contrast`, `./pairs` and `./tokens` without
    // extensions, exactly like the two files that were already there. `vitest` resolved
    // them, `tsc` resolved them, and `node scripts/emit-design-doc.ts` died with
    // `ERR_MODULE_NOT_FOUND` — a failure that appears in no type check and no test, on the
    // one command a maintainer runs by hand when a design value changes.
    //
    // The assertion is on the **file text** rather than on behaviour because behaviour here
    // is Node's resolver, which this suite does not run.
    const sources = ["design-doc.ts", "pairs.ts", "tokens-css.ts"].map((name) =>
      readFileSync(join(REPO_ROOT, "packages", "ui", "src", name), "utf8"),
    );

    for (const source of sources) {
      const relativeImports = [...source.matchAll(/^import[^"']*from "(\.[^"]*)";/gm)].map(
        (match) => match[1] as string,
      );

      expect(relativeImports.length).toBeGreaterThan(0);
      for (const specifier of relativeImports) {
        expect(specifier, `${specifier} needs an extension to resolve under node`).toMatch(/\.ts$/);
      }
    }
  });
});
