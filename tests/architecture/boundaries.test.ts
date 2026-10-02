import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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
 * Report every line matching `pattern`, with its 1-based line number and the
 * trimmed text.
 *
 * **This exists because `findOccurrences` was handed a regex's `.source` and so
 * matched nothing.** The caller below passed `pattern.source` — the literal text
 * `(?<![\w.$])fetch\s*\(` — to a function doing `line.includes(needle)`, and that
 * text appears in no source file. Both global-`fetch` patterns were therefore dead
 * code: a bare `fetch(` and a `window.fetch(` call compiled, ran, and were never
 * flagged. Only the separate `globalThis.fetch` substring check could fire, and it
 * is why the rule looked alive while holding nothing. A ninth instance of the same
 * defect class this repository keeps meeting: a rule that cannot be exercised is not
 * a rule.
 *
 * Line-by-line rather than whole-source, so a reported hit still names the line a
 * reader has to open. Each line is tested with a freshly built non-global copy,
 * because a shared `/g` regex carries `lastIndex` between calls and would skip
 * matches.
 */
function findPatternOccurrences(contents: string, pattern: RegExp): string[] {
  const hits: string[] = [];
  const perLine = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""));

  contents.split("\n").forEach((line, index) => {
    if (perLine.test(line)) {
      hits.push(`line ${index + 1}: ${line.trim()}`);
    }
  });

  return hits;
}

/**
 * The global `fetch` references a package in this repository must not contain.
 *
 * `createFetchTransport` receives `fetch` as a **parameter** and never calls the
 * global, so a signature or a `transport(fetchImpl)` call is not a violation — but a
 * `window.fetch(` and a bare `fetch(` are, and neither is caught by a rule that only
 * looks for `globalThis.fetch`. Note that the bare-`fetch` pattern excludes a
 * preceding `.`, which is what keeps `window.fetch` and `conformance.fetch` out of it;
 * they are matched by their own patterns instead, deliberately, so a member access
 * named `fetch` and a global call are distinguishable in a failure message.
 */
const GLOBAL_FETCH_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "globalThis.fetch reference", pattern: /globalThis\.fetch\b/ },
  { label: "window.fetch call", pattern: /window\.fetch\s*\(/ },
  { label: "bare fetch call", pattern: /(?<![\w.$])fetch\s*\(/ },
];

/**
 * Every global-`fetch` reference in one file's comment-stripped source.
 *
 * Split out from the test so the rule can be exercised directly against a snippet,
 * which is the only way to prove a rule fires without editing a package on disk.
 */
function collectFetchViolations(repoPath: string, contents: string): string[] {
  const code = stripComments(contents);
  const violations: string[] = [];

  for (const { label, pattern } of GLOBAL_FETCH_PATTERNS) {
    for (const hit of findPatternOccurrences(code, pattern)) {
      violations.push(`${repoPath} ${hit} (${label})`);
    }
  }

  return violations;
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

/**
 * A module containing one global `fetch` call, used by the positive controls.
 *
 * Written so the `fetch(` occurrence is a single, unambiguous literal substring: the
 * window and globalThis controls replace that one occurrence with their own form, so
 * each control introduces exactly one violation and nothing else in the file can
 * account for a hit.
 */
const FETCH_PROBE_MODULE = [
  "export function probe(url: string): void {",
  '  void fetch("https://example.test/beacon");',
  "}",
].join("\n");

/** The package directories the `fetch` rule scans, in one place. */
const NETWORK_FORBIDDEN_PACKAGES = ["providers", "mail-parser"] as const;

/**
 * Run the real `fetch` rule over a package directory into which `moduleSource` has
 * just been written as a temporary file.
 *
 * The positive controls need the rule exercised end to end — file collection, the
 * `.test.ts` exemption, the package filter, comment stripping and the patterns — and
 * the only way to do that is to put the violation in a file the scan will really
 * collect. Editing a checked-in package module instead would mean a failing assertion
 * left the repository in a state its own test caused.
 *
 * `try`/`finally` with an unconditional delete is what makes this safe to run: the
 * probe never survives the test, whether the assertion passes or throws.
 */
function scanWithIntroducedModule(packageDir: string, moduleSource: string): string[] {
  const probePath = join(REPO_ROOT, packageDir, "__fetch-rule-probe.ts");

  try {
    writeFileSync(probePath, moduleSource, "utf8");
    return NETWORK_FORBIDDEN_PACKAGES.flatMap((packageName) =>
      collectSourceFiles(join(PACKAGES_DIR, packageName))
        .filter((file) => !file.endsWith(".test.ts"))
        .flatMap((file) => collectFetchViolations(toRepoPath(file), readFileSync(file, "utf8"))),
    );
  } finally {
    rmSync(probePath, { force: true });
  }
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

  it("keeps a module-level fetch out of the provider and parser packages", () => {
    // The transport seam is what lets the conformance suite run without a provider.
    // A module-level `fetch` call anywhere in the package would bypass it, and the
    // suite would then contact a live provider — turning a third party's
    // availability into this repository's CI status.
    //
    // `mail-parser` is covered for a different and stronger reason: it has no network
    // seam at all, and it must never acquire one. Detection reads a message a provider
    // already delivered; a request inside it would mean parsing a message causes a
    // side effect, which is the opposite of what the milestone promises. That promise
    // is *also* proven by observation in `fixtures/corpus.test.ts` — this rule is the
    // cheap structural check that names the offending line, and the instrumented
    // transport is the expensive behavioural one. Neither substitutes for the other: a
    // source scan cannot see a resolver obtained indirectly, and an instrumented
    // transport cannot tell a maintainer which line to change.
    //
    // **Scope limit, stated so a reader does not assume more than it checks:** this rule
    // matches `fetch` and nothing else. It does not check `XMLHttpRequest`,
    // `WebSocket`, `EventSource`, `import()`, a dynamic import of a client, or a
    // package that reaches the network through some other global. It is one named
    // escape hatch, not a general I/O audit.
    //
    // Comments are stripped before matching, and that is load-bearing rather than
    // cosmetic: two rules in this file previously fired on their own documentation,
    // because a rule that cannot tell a declaration from a comment about that
    // declaration is measuring the wrong thing. The controls below pin both halves —
    // it must fire on a call, and it must stay quiet on a doc comment saying the same
    // word.
    const violations: string[] = [];

    for (const packageName of NETWORK_FORBIDDEN_PACKAGES) {
      for (const file of collectSourceFiles(join(PACKAGES_DIR, packageName))) {
        if (file.endsWith(".test.ts")) continue;

        violations.push(...collectFetchViolations(toRepoPath(file), readFileSync(file, "utf8")));
      }
    }

    expect(violations).toEqual([]);
  });

  it("catches a bare fetch call introduced into a real package file", () => {
    expect(scanWithIntroducedModule("packages/mail-parser/src", FETCH_PROBE_MODULE)).not.toEqual(
      [],
    );
  });

  it("catches a window.fetch call introduced into a real package file", () => {
    expect(
      scanWithIntroducedModule(
        "packages/mail-parser/src",
        FETCH_PROBE_MODULE.replace("fetch(", "window.fetch("),
      ),
    ).not.toEqual([]);
  });

  it("catches a globalThis.fetch reference introduced into a real package file", () => {
    expect(
      scanWithIntroducedModule(
        "packages/mail-parser/src",
        FETCH_PROBE_MODULE.replace("fetch(", "globalThis.fetch("),
      ),
    ).not.toEqual([]);
  });

  it("catches a bare fetch call introduced into the provider package too", () => {
    // Not a formality: the scan is per-package, so proving one package is scanned
    // says nothing about the other. This rule was never actually held for
    // `packages/providers` either, and the provider package is the one whose
    // conformance suite must never touch the network.
    expect(scanWithIntroducedModule("packages/providers/src", FETCH_PROBE_MODULE)).not.toEqual([]);
  });

  it("stays quiet when fetch is a parameter name rather than a global reference", () => {
    // The negative control, and it is the case the rule's own comment claimed to
    // cover. `createFetchTransport`'s real signature names a parameter and annotates it
    // with `typeof fetch`; neither is a global call, and a rule that flagged either
    // would have to be disabled rather than satisfied.
    const signatureOnly = [
      "export type FetchLike = typeof fetch;",
      "export function createFetchTransport(fetchImpl: FetchLike): Transport {",
      "  return { send: (request) => fetchImpl(request.url, { method: request.method }) };",
      "}",
      "export function callIt(transport: Transport): Promise<void> {",
      "  void transport;",
      "}",
    ].join("\n");

    expect(collectFetchViolations("signature-only.ts", signatureOnly)).toEqual([]);
  });

  it("stays quiet on the word fetch in a doc comment", () => {
    // The other half of the negative control, and the reason `stripComments` runs
    // before matching. Two rules in this file have already fired on their own
    // documentation.
    const prose = [
      "/**",
      " * This module must never call fetch( directly.",
      " * A bare fetch( here, or window.fetch( here, is a violation.",
      " */",
      "export const NETWORK_REFERENCE = 1;",
    ].join("\n");

    expect(collectFetchViolations("prose-only.ts", prose)).toEqual([]);
  });

  it("does not flag the real provider transport module", () => {
    // Held against the live file rather than a snippet, so the negative control cannot
    // pass by describing a signature the package does not actually have. If this goes
    // red, the rule has become too broad to keep.
    const transport = join(PACKAGES_DIR, "providers", "src", "transport.ts");

    expect(collectFetchViolations(toRepoPath(transport), readFileSync(transport, "utf8"))).toEqual(
      [],
    );
  });

  it("still reads every line of a file once rather than skipping past a match", () => {
    // A shared `/g` regex carries `lastIndex` between calls, so a whole-source
    // `matchAll` over a file reports every hit while a per-line `test` over the same
    // file silently alternates. The helper builds a fresh regex per file; this proves
    // that is what happens, because the two hits here sit on adjacent lines and a
    // stateful regex would report only one of them.
    const twoAdjacentHits = ["a", "fetch(", "b", "window.fetch(", "c"].join("\n");

    expect(findPatternOccurrences(twoAdjacentHits, /(?<![\w.$])fetch\s*\(/g)).toHaveLength(1);
    expect(findPatternOccurrences(twoAdjacentHits, /window\.fetch\s*\(/g)).toHaveLength(1);
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
