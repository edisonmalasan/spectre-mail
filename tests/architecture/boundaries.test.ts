import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Architecture boundary enforcement.
 *
 * These assertions exist because the equivalent rules in
 * `openspec/specs/provider-abstraction/spec.md` and `docs/ROADMAP.md` are
 * prose. Prose survives review for a long time and is violated once, under
 * deadline, by someone who did not know it existed. A test costs a few dozen
 * lines and fails loudly instead.
 *
 * Scope note: this is a **tripwire, not a proof of absence.** The field-name
 * check in particular is a heuristic over a fixed list of names measured from
 * real provider responses. It can produce a false positive on an unrelated local
 * identifier. That is the accepted trade: the fix is to rename the local, and a
 * weaker rule that misses real leakage would be worse. Failures name the file
 * and line so the judgement is easy.
 */

const REPO_ROOT = process.cwd();
const PACKAGES_DIR = join(REPO_ROOT, "packages");
const APPS_DIR = join(REPO_ROOT, "apps");
const SPIKE_DIR = join(REPO_ROOT, "tests", "provider-spike");

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

// `.git` and `.agents` matter because two rules below scan the whole repository
// rather than only `packages/` and `apps/`. Walking either would be slow, and
// `.agents` is generated content this repository must not edit anyway.
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".vite",
  ".git",
  ".agents",
]);

/**
 * Every module specifier a source file can name, in every syntactic form the
 * boundary rules must cover:
 *
 *   from "x"        static and `import type` re-exports
 *   import "x"      bare side-effect import
 *   import("x")     dynamic import
 *   require("x")    CommonJS, for completeness
 *
 * The M1 verification pass proved the earlier `from`-only pattern missed both
 * `import "x"` and `import("x")`, which is a real gap: a package could reach an
 * app through either and the test would stay green. `tsc` happens to reject the
 * dynamic form with TS2307, but a rule the documentation credits to this test
 * must actually be carried by this test.
 */
const MODULE_SPECIFIER_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;

/**
 * Provider JSON field names measured from live provider responses.
 *
 * Provenance, corrected by the M1 verification pass. The earlier comment cited
 * `docs/PROVIDERS.md` sections 2 and 3 for all seven, which is wrong: only
 * `mail_id`, `sid_token`, `content_type`, and `ratelimit-policy` appear there.
 * `mail_from`, `mail_date`, and `hydra:member` are recorded in the M0 spike
 * source (`tests/provider-spike/src/probes/mailtm.mjs` and its run artifacts),
 * not in that document. The list itself is sound; the citation was not.
 *
 * Deliberately specific. Broad words like `list`, `error`, `id`, or `token` are
 * excluded: they are common in ordinary application code, and a rule that fires
 * on them would be disabled within a week, which is worse than not having it.
 */
const PROVIDER_FIELD_NAMES = [
  "mail_from",
  "mail_id",
  "mail_date",
  "sid_token",
  "content_type",
  "ratelimit-policy",
  "hydra:member",
];

/**
 * Provider adapter identifiers, and the names that would introduce one.
 *
 * Both halves matter, and the second half is the one that keeps this rule honest.
 *
 * Provenance, and a third instance of this repository's recurring defect. The
 * original list held `MailTmProvider`, `GuerrillaMailProvider`, and
 * `SpectreMailProvider` — **none of which existed**. M3 named its exports
 * `createMailTmAdapter` and `createGuerrillaAdapter`, and the rule stayed green
 * while guarding nothing at all. A list of identifiers nothing references cannot
 * fail, so it was indistinguishable from having no rule, and it would have kept
 * passing after any adapter escaped.
 *
 * The factory names are therefore matched directly, and so is the pattern that
 * would mint a new adapter elsewhere. Matching `create*Adapter` is what stops this
 * from needing editing at the next milestone — which is when it would silently rot
 * again.
 */
const PROVIDER_ADAPTER_IDENTIFIERS = [
  "createMailTmAdapter",
  "createGuerrillaAdapter",
  "createFetchTransport",
  "runProviderConformance",
  "createProviderManager",
];

/**
 * Any identifier shaped like an adapter factory or contract implementation.
 *
 * A catch-all alongside the concrete list above: the list guards today's exports,
 * and this guards tomorrow's. `createSpectreAdapter` matches the factory shape, so a
 * new provider cannot be added outside the package without naming it here first.
 */
const PROVIDER_ADAPTER_PATTERN = /\bcreate[A-Z][A-Za-z]*Adapter\b/g;

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

/** Recursively collect source files, skipping build and dependency directories. */
function collectSourceFiles(root: string): string[] {
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      if (SKIP_DIRECTORIES.has(entry)) continue;

      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
      } else if (isSourceFile(entry)) {
        found.push(absolute);
      }
    }
  };

  walk(root);
  return found;
}

function toRepoPath(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split(sep).join("/");
}

/**
 * Replace comment content with spaces, preserving line structure.
 *
 * Needed because several rules here are about what the *code* references, and a
 * prose mention of `fetch(` in a doc comment is documentation rather than a
 * dependency. Blanking rather than deleting keeps every line number correct, so a
 * failure still names the line a reader has to open.
 *
 * Deliberately simple, and known to be imperfect: it does not understand string
 * literals, so a provider field name written inside a string in a non-test file is
 * still caught (correct) while a `"fetch("` inside a string would be a false
 * positive. That direction of error is the safer one.
 */
function stripComments(source: string): string {
  let out = "";
  let inBlock = false;
  let inLine = false;
  let inString: '"' | "'" | "`" | null = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] as string;
    const next = source[i + 1];

    if (inLine) {
      if (char === "\n") {
        inLine = false;
        out += char;
      } else {
        out += " ";
      }
      continue;
    }

    if (inBlock) {
      if (char === "*" && next === "/") {
        inBlock = false;
        out += "  ";
        i += 1;
      } else {
        out += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (inString !== null) {
      out += char;
      if (char === "\\") {
        const following = source[i + 1];
        if (following !== undefined) {
          out += following;
          i += 1;
        }
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      inLine = true;
      out += " ";
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlock = true;
      out += " ";
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      out += char;
      continue;
    }

    out += char;
  }

  return out;
}

/**
 * Report every line containing `needle`, with its 1-based line number and the
 * trimmed text, so a failure is actionable rather than just red.
 */
function findOccurrences(contents: string, needle: string): string[] {
  const hits: string[] = [];

  contents.split("\n").forEach((line, index) => {
    if (line.includes(needle)) {
      hits.push(`line ${index + 1}: ${line.trim()}`);
    }
  });

  return hits;
}

/**
 * Workspace member globs, with comments stripped.
 *
 * Comments are stripped because `pnpm-workspace.yaml` documents the spike's
 * exclusion in prose right where the exclusion matters. Matching the raw file
 * would make the manifest assert against its own explanation.
 */
function readWorkspaceGlobs(): string[] {
  return readFileSync(join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8")
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.startsWith("- "))
    .map((line) =>
      line
        .slice(2)
        .trim()
        .replace(/^["']|["']$/g, ""),
    );
}

describe("architecture boundaries", () => {
  it("has the packages and apps the roadmap specifies", () => {
    const expectedPackages = ["core", "mail-parser", "providers", "storage", "ui"];

    for (const name of expectedPackages) {
      expect(() => statSync(join(PACKAGES_DIR, name))).not.toThrow();
    }
    expect(() => statSync(join(APPS_DIR, "web"))).not.toThrow();
    expect(() => statSync(join(APPS_DIR, "extension"))).not.toThrow();
  });

  it("declares exactly the roadmap's workspace layout", () => {
    expect(readWorkspaceGlobs()).toEqual(["apps/*", "packages/*"]);
  });

  it("keeps the M0 spike outside the workspace", () => {
    // The spike must not be a workspace member. That is what makes it
    // structurally unimportable by product code, rather than merely forbidden.
    for (const glob of readWorkspaceGlobs()) {
      expect(glob.startsWith("tests")).toBe(false);
    }

    // And it must still exist: it is the reproducible evidence behind
    // docs/PROVIDERS.md, which must be re-runnable before release.
    expect(() => statSync(join(SPIKE_DIR, "package.json"))).not.toThrow();
  });

  it("never lets a shared package import an app", () => {
    const packageFiles = collectSourceFiles(PACKAGES_DIR);
    expect(packageFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of packageFiles) {
      const contents = readFileSync(file, "utf8");

      for (const match of contents.matchAll(MODULE_SPECIFIER_PATTERN)) {
        const specifier = match[1];
        if (specifier === undefined) continue;

        const reachesApp =
          specifier.includes("apps/web") ||
          specifier.includes("apps/extension") ||
          /(^|\/)\.\.\/\.\.\/apps\//.test(specifier);

        if (reachesApp) {
          violations.push(`${toRepoPath(file)} imports "${specifier}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps provider wire format out of every package but the provider package", () => {
    const violations: string[] = [];
    const providersDir = join(PACKAGES_DIR, "providers");

    // Scope widened at M2, from `apps/` only to every shared package.
    //
    // The M2 falsification pass found this rule was narrower than the requirement
    // it enforced. It guarded `apps/`, so a shared package could name a provider's
    // wire fields freely - and `packages/core`, whose entire job is to be free of
    // them, was not covered at all. A green test was carrying a rule it did not
    // hold. That is the second time this exact failure has appeared in this
    // repository, which is why it is now checked rather than assumed.
    //
    // `packages/providers` is exempt, and must stay exempt: an adapter's entire
    // purpose is to speak the provider's vocabulary on the way in and SpectreMail's
    // on the way out.
    for (const file of collectSourceFiles(PACKAGES_DIR)) {
      if (file.startsWith(providersDir)) continue;

      // Test files are exempt for the same reason this file is exempt from the
      // adapter rule: a check that asserts a name's absence has to name it. Keep the
      // exemption to `*.test.ts` rather than to all tests, so a shared helper is
      // still covered. Tests are not shipped runtime code.
      if (file.endsWith(".test.ts")) continue;

      const contents = readFileSync(file, "utf8");

      for (const field of PROVIDER_FIELD_NAMES) {
        for (const hit of findOccurrences(contents, field)) {
          violations.push(`${toRepoPath(file)} ${hit} (matched "${field}")`);
        }
      }
    }

    // The apps keep their own scan, unchanged: provider wire format has no
    // legitimate reason to appear there either.
    for (const file of collectSourceFiles(APPS_DIR)) {
      const contents = readFileSync(file, "utf8");

      for (const field of PROVIDER_FIELD_NAMES) {
        for (const hit of findOccurrences(contents, field)) {
          violations.push(`${toRepoPath(file)} ${hit} (matched "${field}")`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("confines provider adapters to packages/providers", () => {
    const providersDir = join(PACKAGES_DIR, "providers");
    const violations: string[] = [];

    // Scanned across the whole repository, not just `packages/` and `apps/`.
    // The M1 verification pass proved the narrower scope was escapable: a
    // root-level module and a module under `tests/` could both name an adapter
    // and the test still passed. The requirement is that *no file outside the
    // package* references one.
    for (const file of collectSourceFiles(REPO_ROOT)) {
      if (file.startsWith(providersDir)) continue;

      // This file necessarily contains the identifiers as string literals.
      if (file === __filename) continue;

      const contents = readFileSync(file, "utf8");
      for (const identifier of PROVIDER_ADAPTER_IDENTIFIERS) {
        if (contents.includes(identifier)) {
          violations.push(`${toRepoPath(file)} references ${identifier}`);
        }
      }
      for (const match of contents.matchAll(PROVIDER_ADAPTER_PATTERN)) {
        violations.push(`${toRepoPath(file)} defines adapter-shaped identifier ${match[0]}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps a module-level fetch out of the provider package", () => {
    // The transport seam is what lets the conformance suite run without a provider.
    // A module-level `fetch` call anywhere in the package would bypass it, and the
    // suite would then contact a live provider — turning a third party's
    // availability into this repository's CI status.
    const violations: string[] = [];

    for (const file of collectSourceFiles(join(PACKAGES_DIR, "providers"))) {
      if (file.endsWith(".test.ts")) continue;

      const contents = readFileSync(file, "utf8");
      const code = stripComments(contents);

      for (const hit of findOccurrences(code, "globalThis.fetch")) {
        violations.push(`${toRepoPath(file)} ${hit}`);
      }
      // A bare `fetch(` is a global reference. `createFetchTransport` receives
      // `fetch` as a *parameter* and never calls it, and a local helper may reuse the
      // name — so the global forms are matched rather than the bare identifier.
      for (const pattern of [/(?<![\w.$])fetch\s*\(/g, /window\.fetch\s*\(/g]) {
        for (const hit of findOccurrences(code, pattern.source)) {
          violations.push(`${toRepoPath(file)} ${hit} (bare fetch reference)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps the spike unreachable from workspace code", () => {
    const workspaceFiles = [...collectSourceFiles(PACKAGES_DIR), ...collectSourceFiles(APPS_DIR)];
    const violations: string[] = [];

    for (const file of workspaceFiles) {
      if (readFileSync(file, "utf8").includes("provider-spike")) {
        violations.push(`${toRepoPath(file)} references the spike`);
      }
    }

    expect(violations).toEqual([]);
  });
});
