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

import { readdirSync, readFileSync } from "node:fs";
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

  it("states what the motion is and what stops it, so a token cannot imply more than ships", () => {
    const region = renderDesignDoc();

    for (const token of ["rise", "blur", "duration-fast", "duration-base", "ease-standard"]) {
      expect(region).toContain(`\`--${token}\``);
    }

    // **This assertion changed with the behaviour it describes, and the change is
    // authorised by `motion-and-reduced-motion`'s delta rather than made to accommodate a
    // diff.** Its previous form read "states every motion token's being unused, since that
    // is the slice-2 constraint" and asserted the region contained "used by nothing", which
    // was true for exactly one milestone and false the moment the motion shipped.
    //
    // The test's *purpose* is unchanged and is why it was worth keeping rather than
    // deleting: a reader finding `--duration-base` in a design contract would reasonably
    // assume something moves, so the table has to say what moves and under what preference
    // it does not. It now asserts both halves rather than one.
    expect(region).toContain("One materialisation, three entrances");
    expect(region).toContain("`prefers-reduced-motion: reduce` removes the animation");

    // **And it asserts the limits, which is the half a table is most tempted to omit.**
    // The roadmap's phrase is "materialize/disappear" and only the first half ships, so a
    // document that said "motion" without saying "entrance only" would be describing a
    // capability the product does not have.
    expect(region).toContain("entrance only");
    expect(region).toContain("no `transition`");

    // The sentence the previous version required is now positively absent. Asserting the
    // replacement while leaving the old claim merely unreplaced would let a future edit
    // restore "used by nothing" alongside the new prose.
    expect(region).not.toContain("used by nothing");
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
    //
    // **The three names are the emitter's own run-time graph, and the scope is stated
    // because it is narrower than it reads.** `index.ts` is deliberately absent: it is the
    // package's public re-export barrel, nothing in `scripts/` imports it, and no browser
    // ever loads it — so there is no resolver there to break. It is also the only file in
    // the package whose relative imports lack extensions, which means a reader who took
    // this rule package-wide would find a violation and could not tell whether it was one.
    // **The rule is the three modules Node must resolve for `emit-design-doc.ts` to run at
    // all, and the pattern below matches `import … from` only** — `index.ts`'s four
    // `export … from` re-exports are the only re-exports in the package and they are in the
    // excluded file. Widening either the file list or the pattern would assert a property
    // about a module whose resolution no command in this repository depends on, and an
    // assertion nothing depends on is decoration.
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

  it("excludes exactly the modules no command in this package resolves at run time", () => {
    // **The assertion that keeps the exclusion above honest.** The rule above scans three
    // named files, and this records — mechanically, from the directory rather than from a
    // list written here — that the only relative specifier it would miss is in a module
    // nothing imports at run time.
    //
    // It exists because the pattern above matches `import … from` and **not** `export … from`,
    // so a re-export inside a scanned file would be silently unchecked. Four such
    // re-exports exist today and all four are in `index.ts`, which is outside the emitter's
    // graph. **If a future module gains an `export … from` and that module is scanned, this
    // test goes red** — which is the point: the gap in the pattern becomes a failure rather
    // than an omission nobody notices until a command dies with `ERR_MODULE_NOT_FOUND`.
    //
    // The scan is over `src/`, so a new file is covered by being created rather than by
    // being added to a list somewhere else — the shape this repository's boundary rules
    // already use.
    const scanned = new Set(["design-doc.ts", "pairs.ts", "tokens-css.ts"]);

    for (const name of readdirSync(join(REPO_ROOT, "packages", "ui", "src"))) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;

      const source = readFileSync(join(REPO_ROOT, "packages", "ui", "src", name), "utf8");
      const reExports = [...source.matchAll(/^export[^"']*from "(\.[^"]*)";/gm)].map(
        (match) => match[1] as string,
      );
      const imports = [...source.matchAll(/^import[^"']*from "(\.[^"]*)";/gm)].map(
        (match) => match[1] as string,
      );

      if (reExports.length > 0) {
        expect(
          { name, reExports, scanned: scanned.has(name) },
          `${name} re-exports relatively and the extension rule does not read re-exports, so it cannot cover this file`,
        ).toEqual({ name, reExports, scanned: false });
      }

      // And the converse: an unswept module must have no relative imports either, or the
      // exclusion above is hiding something the rule would otherwise have caught.
      if (!scanned.has(name)) {
        expect(
          { name, imports },
          `${name} is outside the scanned set but imports relatively`,
        ).toEqual({
          name,
          imports: [],
        });
      }
    }
  });
});
