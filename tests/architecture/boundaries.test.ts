import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import ts from "typescript";

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

/**
 * This file's per-test budget, raised from Vitest's 5s default.
 *
 * **Measured, not assumed.** On 2026-10-03 the `it` that proves the framework-import
 * rule catches all five syntactic forms was run alone and took **236ms**; the same file
 * run on its own took 19.91s of test time across 37 assertions; and in a full 26-file
 * parallel run that one assertion exceeded the 5s default and failed with
 * `Test timed out in 5000ms` — while passing on the very next run. So the assertion was
 * never close to its own cost, and the failure was disk contention starving a test that
 * writes a probe file and then re-walks the whole of `apps/` or `packages/mailbox/`.
 *
 * A second measurement, taken during the independent verification pass on the same day,
 * put the *same suite* at 8.6s in one run and 37s in another, minutes apart. So the
 * contention is not a one-off and the assertion is not at fault; a budget is the honest
 * answer rather than pretending the variance is not there.
 *
 * A test that fails for no reason is worse here than a test that fails for the right one:
 * this repository's standard is that an assertion's failure must mean something, and a
 * timeout means only that the machine was busy. Re-running until green is the habit this
 * file exists to prevent.
 *
 * **Scoped to this file, not to the workspace.** `vitest.config.ts` is untouched, so no
 * other suite inherits a budget it did not ask for, and no genuinely slow unit test
 * anywhere else is masked by this decision. The value is generous rather than tight:
 * 60s is roughly 250x the measured single-test cost, so it cannot hide a regression —
 * a rule that stopped matching does not get *slower*, it gets wrong.
 */
const SCAN_ASSERTION_TIMEOUT_MS = 60_000;

// Applied here rather than per `it`, because the argument would then have to be repeated
// on the sixteen assertions that write a probe file — and an assertion that is easy to
// forget the timeout on is an assertion that will time out again.
vi.setConfig({ testTimeout: SCAN_ASSERTION_TIMEOUT_MS });

const REPO_ROOT = process.cwd();
const PACKAGES_DIR = join(REPO_ROOT, "packages");
const APPS_DIR = join(REPO_ROOT, "apps");
const SPIKE_DIR = join(REPO_ROOT, "tests", "provider-spike");

/**
 * File extensions every directory-walking rule treats as shipped source.
 *
 * ## `.css` joined this list at M7 slice 1, and that is a widening, not an addition
 *
 * Until then the list held no stylesheet extension, which was correct only while the
 * repository contained no stylesheet — measured, before this change: the single `.css`
 * file under `apps/` or `packages/` outside `node_modules` was jsdom's own. The moment
 * `packages/ui/src/tokens.css` and `apps/web/src/styles.css` landed, the largest piece of
 * shipped source in the repository became invisible to every rule in this file — the
 * silent-skip failure M5 slice 1 was bitten by, arriving through a file *type* rather
 * than a directory.
 *
 * **It joins this list rather than a second "and also CSS" list**, because this
 * repository has recorded twice that a second spelling of a set is the defect: the
 * collection rule that resolved `apps/` only, and the allowance constant two rules
 * shared so that widening one silenced the other.
 *
 * **Widening a scan is not free, and the obligation it creates is checked rather than
 * assumed.** The recorded false positive here is real: when the storage rule was
 * generalised from `packages/mailbox` to every shared package it immediately fired on a
 * `set-cookie` response header that `packages/providers` legitimately holds from the M0
 * spike, and read it as a cookie jar. CSS is full of words those patterns match. So the
 * existing rules were re-proven against the widened scan before this line was kept, by
 * running the whole suite with the two stylesheets present — **677 tests green, 47
 * boundary assertions green** — which is the only evidence that matters for a claim of
 * the form "this widening introduced no finding".
 */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"];

/** The one extension a *stylesheet* is, so a CSS rule need not restate the list. */
const CSS_EXTENSION = ".css";

/**
 * The generated token layer, by repository-relative path.
 *
 * **Named, not discovered, and the reason is a real limitation.** A custom property is
 * declared on `:root`, so it is globally visible to every stylesheet on the page — a read
 * resolves against the token layer *or* against a declaration earlier in its own file.
 * Which is precisely why this is one path rather than "whichever stylesheet has the most
 * `--` in it": a resolver that guessed the token layer would be guessing, and a rule
 * that guesses is a rule whose behaviour depends on file naming.
 *
 * There is exactly one token layer because there is exactly one token source of truth
 * (`packages/ui/src/tokens.ts`). If a second is ever added, the right fix is to make
 * both clients read both, not to make this rule enumerate them.
 */
const TOKEN_LAYER = "packages/ui/src/tokens.css";

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
  "runProviderConformance",
];

/**
 * Identifiers a client is *expected* to call, and which files may call them.
 *
 * These were in `PROVIDER_ADAPTER_IDENTIFIERS` at M3 and are not adapters; see the
 * note below for why that mattered.
 */
const PROVIDER_COMPOSITION_SEAMS = ["createProviderManager", "createFetchTransport"] as const;

/**
 * Identifiers a client is *expected* to call, and the files allowed to call them.
 *
 * ## Why these are not in the list above
 *
 * The rule this list feeds is named "confines provider adapters to
 * `packages/providers`". At M3 it also forbade `createProviderManager` and
 * `createFetchTransport` outside the package, which is **broader than the
 * requirement it claimed to enforce** — the twelfth recorded instance of that
 * defect class, and the first where being *too broad* rather than too narrow made
 * the approved architecture unusable:
 *
 * - A client cannot compose a provider manager without `createProviderManager`, so
 *   forbidding it left `MailProvider` and `ProviderManager` with no way to be
 *   instantiated outside the package that declares them. The abstraction was
 *   defined and unreachable at the same time.
 * - A browser cannot turn `fetch` into a `Transport` without `createFetchTransport`.
 *
 * Both are **references to a package's public API**, which is what a public API is
 * for. Confinement means an adapter may not be *implemented* or *re-exported*
 * outside the package, and may not be *named* except where a client is entitled to
 * choose its own providers.
 *
 * ## What replaces the blanket ban
 *
 * A named, **file-scoped** allowance instead, which is tighter than the old rule's
 * file scope even though its identifier scope is wider.
 *
 * Two different entitlements, because two different jobs:
 *
 *   name an *adapter*      a client's provider-configuration module, because
 *                          choosing which providers it can reach is that module's
 *                          entire purpose; plus test files, for the reason below.
 *   name the *seam*        a client's provider-configuration and transport modules,
 *                          which are the two places a browser actually turns a
 *                          choice into a reachable transport.
 *
 * **`packages/mailbox` was on the seam list and was removed.** The justification
 * said it "composes a manager on a client's behalf", which is not true of the code
 * as written: `createMailboxSession` *receives* a `ProviderManager` and never calls
 * `createProviderManager` or `createFetchTransport` outside its own tests, which the
 * test-file branch already covers. So the entry could be deleted with no effect at
 * all - a list of allowances nothing exercises cannot fail, which is the same defect
 * M3 corrected in the identifier list three changes ago. It was removed rather than
 * kept with a weaker rationale, because a live-looking permission nobody uses is
 * harder to notice than a missing one.
 *
 * If a future slice genuinely needs to compose a manager inside the session layer,
 * the entry returns here with a control proving it is reachable. That is the point:
 * an allowance should arrive with evidence, not with a plausible sentence.
 *
 * **Test files are exempt from the adapter half**, for the same reason this file is
 * exempt from the rule that names its own identifiers: a check that asserts a
 * name's absence has to be able to name it. A positive control has to drive a real
 * adapter, or it is not a control. Tests are not shipped runtime code, and the
 * wire-format rule above already takes exactly this position.
 *
 * ## Its stated limit
 *
 * The allowance is by **file path**, and this rule can only see paths. Renaming
 * `provider-config.ts` would need this list edited; nothing else in the repository
 * depends on the name. It also **cannot tell a definition from a call** — the
 * adapter-shaped pattern matches both — so in an allowed file, *minting* an adapter
 * goes unchecked here as well as *calling* one. Neither is verified *why* a file
 * holds the adapter: a client that reached for Mail.tm anyway would pass this rule
 * and be caught by `website-client`'s one-provider requirement instead. These are
 * real limits, stated rather than papered over.
 */
const PROVIDER_SEAM_ALLOWED_FILES = [
  /^apps\/[^/]+\/src\/provider-config\.ts$/,
  /^apps\/[^/]+\/src\/transport\.ts$/,
  /^(?:apps|packages)\/[^/]+\/src\/[^/]*\.test\.tsx?$/,
] as const;

/**
 * The narrower of the two: only a client's provider configuration, and test files.
 *
 * `packages/mailbox` composes a session but must not name an adapter. It is handed
 * providers; deciding which providers exist is not its to make.
 */
const PROVIDER_ADAPTER_ALLOWED_FILES = [
  /^apps\/[^/]+\/src\/provider-config\.ts$/,
  /^(?:apps|packages)\/[^/]+\/src\/[^/]*\.test\.tsx?$/,
] as const;

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

/**
 * Whether a file is a **test**, whatever the runner calls it.
 *
 * ## Why this exists rather than an inline `.test.tsx?`
 *
 * Several rules here exempt tests, because a test is allowed to do the thing the rule
 * forbids **in order to verify it** — `clientStorageApiViolations()` says so in its own
 * documentation: install `fake-indexeddb` on the global, or stub a clipboard. That
 * sentence means *tests*, and it was spelled as one filename.
 *
 * **So the spelling was narrower than the rule — the twenty-first instance of the
 * defect class this repository has recorded, and the first found by a change that had
 * to widen a rule rather than add one.** `browser-verification` added a browser suite
 * under `apps/web/e2e/` whose specs assert on `indexedDB.databases()`: the only way to
 * ask a browser what is still on the device, and the assertion the whole tier exists
 * for. Those files are named `*.spec.ts` because Playwright owns that convention, and
 * the rule reported every one of them.
 *
 * ## Why both spellings and not a directory
 *
 * A test is a **kind**, and a rule should be written against the kind. An exemption
 * keyed on a directory would be a boundary around where tests happen to live today,
 * which is the same mistake as exempting a package list — and it would fail open the
 * first time a suite appeared somewhere new, silently.
 *
 * **The cost, stated rather than discovered later:** a file named `*.spec.ts` that is
 * not a test would be exempt from these rules. Nothing here can produce one, and the
 * collection rules below independently require every `*.spec.ts` to be collected by a
 * browser suite, so an uncollected one fails the build by another route.
 */
function isTestFile(file: string): boolean {
  return /\.(?:test|spec)\.tsx?$/.test(file);
}

/**
 * Compile one of the glob forms this repository actually uses.
 *
 * A double star followed by a separator means "zero or more directories", so the
 * package glob matches a test directly inside `src` as well as one nested deeper.
 * Treating a double star as a plain "anything" would demand at least one separator and
 * report every test as uncovered — the failure mode of a matcher stricter than the glob
 * it is checking, which would read as a real coverage gap. (The literal globs are not
 * written here: a double star next to a slash ends this comment.)
 *
 * **At describe level rather than inside one test**, because two rules compile globs
 * now — the unit-test collection rule and the browser-spec rule — and the browser-spec
 * rule arrived needing the same conversion. Two copies of a glob compiler is two
 * chances to be wrong in the same way, and this file has already been bitten by a
 * duplicated `scanPackageWithProbe`.
 */
function toRepoPattern(pattern: string): RegExp {
  const ANY_DIRS = "\u0001";
  const ANY_CHARS = "\u0002";
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, ANY_DIRS)
    .replace(/\*\*/g, ANY_CHARS)
    .replace(/\*/g, "[^/]*")
    .replace(new RegExp(ANY_DIRS, "g"), "(?:.*/)?")
    .replace(new RegExp(ANY_CHARS, "g"), ".*");
  return new RegExp(`^${body}$`);
}

/** A browser suite's own configuration, as far as this repository needs to know it. */
interface BrowserSuite {
  /** Repo-relative path of the config file, for naming it in a failure. */
  readonly configPath: string;
  /** Repo-relative directory the suite collects from. */
  readonly testDir: string;
  /** The pattern a file inside `testDir` must match to be collected. */
  readonly testMatch: RegExp;
}

/**
 * Every browser suite configured in this repository, discovered from disk.
 *
 * **Discovered rather than listed**, for the same reason every other root here is: a
 * rule that watches one path is invisible in a second one until something is added
 * there, and a spec in the second one would then be uncollected and unreported at the
 * same time — which is the failure this exists to prevent.
 *
 * **A configuration this cannot read is returned as a suite that collects nothing**
 * rather than skipped, so an unparseable `playwright.config.ts` reports every spec as
 * uncovered. Skipping it would make the rule pass in exactly the case where it has
 * stopped working.
 */
function browserSuites(): BrowserSuite[] {
  const configs = collectSourceFiles(REPO_ROOT).filter((file) =>
    /(?:^|[\\/])playwright\.config\.[cm]?[jt]sx?$/.test(file),
  );

  return configs.map((file) => {
    const configPath = toRepoPath(file);
    const source = readFileSync(file, "utf8");

    // **Anchored to one line, because a regex literal cannot span lines.** A greedy
    // `.*` capture is the obvious spelling and it is wrong in a way this file would have
    // filed as a coverage failure rather than as a parser that is wrong: it runs past the
    // literal and latches onto a `/` inside a later comment, producing a pattern with
    // nothing to do with the suite's actual configuration.
    const testDir = source.match(/testDir:\s*["']([^"']+)["']/)?.[1];
    const literal = source.match(/testMatch:[ \t]*(\/(?:[^/\\\n]|\\.)+\/[gimsuy]*)/)?.[1];

    if (testDir === undefined || literal === undefined) {
      // **Collects nothing.** See the note above: an unreadable configuration must
      // report, not pass.
      return {
        configPath,
        testDir: `${configPath} `,
        testMatch: /(?!)/,
      };
    }

    // **The delimiters are stripped, and that is the whole fix.** The capture is a regex
    // *literal* — `/…/flags` — and handing it straight to `new RegExp` compiles the
    // slashes as characters to match, so the compiled pattern requires a literal `/`
    // immediately after its own end anchor and is therefore unsatisfiable. That was
    // measured, not reasoned about: the first version of this rule reported every
    // shipped spec as uncovered, which reads as a real coverage gap rather than as a
    // parser that is wrong.
    const lastSlash = literal.lastIndexOf("/");
    const testMatch = new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1));

    // `testDir` is written relative to the config file, which is what Playwright
    // resolves it against; resolving it here too keeps the two in step rather than
    // assuming every suite lives at the repository root.
    const resolved = relative(REPO_ROOT, join(file, "..", testDir))
      .split(sep)
      .join("/");
    return { configPath, testDir: resolved, testMatch };
  });
}

/**
 * Browser specs no discovered suite collects, named.
 *
 * Scans the whole repository rather than `apps/` and `packages/`, because the rule this
 * serves says **wherever a browser spec is placed**. The unit-test rule above watches
 * two roots; this one does not need a second because there is no defensible place for a
 * browser spec that `packages/` and `apps/` do not cover.
 */
function browserSpecViolations(suites: readonly BrowserSuite[]): string[] {
  const violations: string[] = [];

  for (const file of collectSourceFiles(REPO_ROOT)) {
    if (!/\.spec\.tsx?$/.test(file)) continue;
    const path = toRepoPath(file);

    const claimed = suites.some(
      (suite) => path.startsWith(`${suite.testDir}/`) && suite.testMatch.test(path),
    );
    if (!claimed) {
      violations.push(`${path} (no browser suite collects it)`);
    }
  }

  return violations;
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
 * How many findings carry a label.
 *
 * **Added for the stylesheet rules, and the reason is that `toContain` is not enough for
 * them.** Those rules match several forms of one thing, so the assertion has to be about
 * *how many*, or a rule matching three of the four ways a CSS author can name a URL would
 * satisfy an assertion written for one of them. Counting by label also makes a rule that
 * silently began double-reporting fail, which a `toContain` cannot.
 */
function countMatching(violations: readonly string[], label: string): number {
  return violations.filter((violation) => violation.includes(`(${label})`)).length;
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
 * A client's provider configuration: the one module where it may name an adapter.
 *
 * Matched by path so a client added later is covered by the rule below without
 * anyone remembering to extend a list. The `.ts` shape is what exists today.
 */
const CLIENT_PROVIDER_CONFIG_FILES = /^apps\/[^/]+\/src\/provider-config\.tsx?$/;

/**
 * The name under which a configuration declares which providers it reaches.
 *
 * Matched by shape rather than by a fixed name, so a client is not required to call
 * its list something particular beyond saying what it is.
 */
const CLIENT_PROVIDER_IDS_PATTERN = /export\s+const\s+([A-Z][A-Z0-9_]*_PROVIDER_IDS)\s*=/g;

/**
 * Configurations whose exported provider-id list is never read as a value.
 *
 * The defect this exists for was real and was in this repository. `apps/web`'s
 * `WEBSITE_PROVIDER_IDS` was documented as making "adding a provider ... a visible
 * edit to one list rather than a change spread across call sites", while the factory
 * beside it constructed the adapter directly and never read it. The list and the
 * factory were two independent sources of truth, and the test that noticed recorded
 * the coupling in a comment instead — "the two constants must be changed together,
 * so that is now said rather than implied" — which is a claim about an indirection
 * the code did not have. So `provider-abstraction`'s clause that "adding a second
 * provider SHALL remain additive through the abstraction, not require a rewrite" was
 * true of the abstraction and false of this client.
 *
 * Two references are removed before the name is searched for, because neither is a
 * **use** of the list:
 *
 * - its own declaration, which every configuration necessarily contains;
 * - `typeof <NAME>`, which the id union is derived from and which reads the list's
 *   type without reading its value.
 *
 * What must survive is a reference that reads the list's **value**, which is what
 * makes it the configuration rather than documentation beside one.
 *
 * **Stated limit.** This counts references; it cannot prove a factory *derives* its
 * adapters from the list, and a dead statement such as `void WEBSITE_PROVIDER_IDS;`
 * would satisfy it. The looseness is deliberate: a tighter rule would have to parse
 * an expression, and a source scan that guesses at structure fails in ways a reader
 * cannot audit. The compile-time guarantee is separate and stronger — the registry
 * beside the list is typed `Record` over it, so an id declared with no adapter
 * beside it does not compile. And because comments are stripped first, prose cannot
 * satisfy this rule, which is the point: a comment naming the list is exactly the
 * defect.
 */
function collectUndrivenProviderConfigs(repoPath: string, contents: string): string[] {
  const code = stripComments(contents);
  const declared = [...code.matchAll(CLIENT_PROVIDER_IDS_PATTERN)];
  const violations: string[] = [];

  if (declared.length === 0) {
    violations.push(`${repoPath} declares no provider-id list`);
    return violations;
  }

  for (const match of declared) {
    const name = match[1];
    if (name === undefined) continue;

    const withoutDeclaration = code.replace(
      new RegExp(`export\\s+const\\s+${name}\\s*=[^;]*;`),
      "",
    );
    const withoutTypeOnlyUse = withoutDeclaration.replace(new RegExp(`typeof\\s+${name}`, "g"), "");

    if (!withoutTypeOnlyUse.includes(name)) {
      violations.push(`${repoPath} exports ${name} but never reads it as a value`);
    }
  }

  return violations;
}

/**
 * A UI framework reached by an import specifier.
 *
 * Matches the specifier's first path segment, so `react/jsx-runtime` and
 * `react-dom/client` are caught as readily as the bare package, and
 * `@spectre-mail/mail-parser` is not caught merely for containing the letters.
 *
 * **It covers all four import forms, and the first version of this rule did
 * not.** It originally matched `from "x"`, `import("x")`, and `require("x")` but
 * not a bare side-effect `import "x";` — which is the form a polyfill, a CSS
 * shim, and a `React` global pre-load actually take. `MODULE_SPECIFIER_PATTERN`
 * above has carried `\bimport\s+` since M1, after that exact gap was found there;
 * reproducing the gap in a rule written two hundred lines later is the same defect
 * in a new place. `\bimport\s+` is included below for that reason, and the rule
 * carries positive controls for **all four** forms rather than one, because a
 * control that exercises only the form the author happened to think of is how the
 * other three stayed unproven.
 *
 * `export ... from "x"` needs no alternative here: the `from\s+` branch already
 * matches it, because the rule looks at the specifier rather than at the statement.
 */
const FRAMEWORK_IMPORT_PATTERN =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*|\bimport\s+)["'](react|react-dom|preact|solid-js|vue|svelte)(\/[^"']*)?["']/g;

/**
 * A global store, a cookie jar, or the URL — anything a shared package could use
 * to remember something between page loads.
 *
 * **This exists because the compiler does not enforce it**, which was measured
 * rather than assumed: `packages/mailbox`'s `tsconfig.json` withholds `DOM`, which
 * rejects `window`, `document`, and `location`, but `navigator`, `localStorage`, and
 * `sessionStorage` all compile because `@types/node` declares them. `"types": []`
 * was tried and does not exclude them either. So "references no storage or cookie
 * API" had no enforcement of any kind for the two globals that matter most.
 *
 * A word boundary is required on each side: `mylocalStorage` is not the global,
 * and a rule that fires on ordinary code gets disabled within a week.
 *
 * **A hyphen counts as part of the word, and that was measured rather than
 * preferred.** Generalising this rule from `packages/mailbox` to every shared
 * package immediately reported `packages/providers/src/fixtures.ts`, which holds a
 * **recorded `set-cookie` response header** from the M0 spike:
 * `"set-cookie": "PHPSESSID=measured-php-session; domain=.api.guerrillamail.com"`.
 * That is provider *data* — the thing this repository must never confuse with a
 * cookie jar it opened itself — and a rule that cannot tell the two is a rule whose
 * first false positive would be a real one. `\w` does not include `-`, so the bare
 * global alternative now requires a non-hyphen on both sides.
 *
 * The stated cost: a global reached through a hyphenated name would be missed, and
 * no JavaScript global is written that way. `document.cookie` is unaffected — it is
 * matched by the property alternative, which never had a boundary requirement.
 */
const STORAGE_API_PATTERN =
  /(?<![\w.$-])(?:localStorage|sessionStorage|navigator|cookies?|location|history|indexedDB|caches)(?![\w$-])|\.cookie\b/g;

/**
 * Every shared package, named once, so a rule about "the shared packages" does not
 * quietly mean one of them.
 *
 * The storage rules below are the reason this list exists. Both were written when
 * `packages/storage` held no behaviour and the answer to "which packages must not
 * reach for a store" happened to be one name long. Writing the scan as
 * `packages/mailbox` would have kept passing when the rule's meaning changed and
 * nothing else had — which is exactly what happened with the collection rule at M5
 * slice 1, where deleting the package glob dropped the suite from 365 tests to 40
 * with a **green exit**.
 *
 * Read from the directory rather than maintained in step with it? No — a list is
 * wrong the moment a package is added, and the rule above that names the roadmap's
 * shared-package list already asserts this one matches it. Two lists that can
 * disagree is one too many; if they ever do, that assertion is the place it shows.
 */
const SHARED_PACKAGES = ["core", "mail-parser", "mailbox", "providers", "storage", "ui"] as const;

/**
 * The one shared package allowed to name a platform storage API.
 *
 * `packages/storage` is the layer whose job is to speak to one. Its `tsconfig`
 * declares `DOM` and `DOM.Iterable` for that reason and no other package does, so
 * the exception matches a real boundary rather than softening the rule.
 *
 * **A second allowance for the import rule, not one shared between both.** Falsifying
 * this change showed the coupling is observable: widening this list also silenced the
 * *import* rule, and the test that reported it was the wrong one. Two boundaries that
 * happen to agree today are two boundaries, and a control that cannot tell which rule
 * it is exercising is not a control on either.
 */
const STORAGE_API_ALLOWED_PACKAGES: readonly string[] = ["storage"];

/** The one shared package allowed to import the storage layer: itself, excluded in fact. */
const STORAGE_IMPORT_ALLOWED_PACKAGES: readonly string[] = ["storage"];

/** The specifier a shared package must not reach for. */
const STORED_STORAGE_SPECIFIER = "@spectre-mail/storage";

/** A module naming `indexedDB`, which the storage layer may and others may not. */
const INDEXED_DB_PROBE = "export const x = indexedDB.open('spectre-mail');";

/**
 * Shared packages that reach a global store or the URL, honouring the allowance.
 *
 * **The allowance lives here rather than in the rule body**, because a control that
 * calls a raw pattern matcher is not a control on the allowance at all — it is a
 * second run of the pattern. An earlier version of the storage control did exactly
 * that and failed on the storage package's own implementation, which is what this
 * extraction exists to prevent: the rule and its control now scan through one
 * function, so a change to the allowance cannot leave one of them behind.
 *
 * **It takes no package argument, and that is the point rather than the terseness.**
 * With one, a falsification pass rewrote a call site to `(["mailbox"])` and to `([])`
 * and the suite stayed green both times — every package the call site stopped
 * scanning happened to be clean, and the argument is a second, narrower spelling of
 * the very list this function exists to read. There is now exactly one spelling of
 * it, and the two ways it could be narrowed (`SHARED_PACKAGES`, and this loop) are
 * both asserted elsewhere. The per-package controls work by planting a probe and
 * reading the returned hits, not by asking for a smaller scan.
 */
function storageApiViolations(): string[] {
  const violations: string[] = [];

  for (const packageName of SHARED_PACKAGES) {
    if (STORAGE_API_ALLOWED_PACKAGES.includes(packageName)) continue;

    for (const file of collectSourceFiles(join(PACKAGES_DIR, packageName))) {
      if (file.endsWith(".test.ts")) continue;
      const contents = stripComments(readFileSync(file, "utf8"));
      for (const hit of findPatternOccurrences(contents, STORAGE_API_PATTERN)) {
        violations.push(`${toRepoPath(file)} ${hit} (reaches a global store or the URL)`);
      }
    }
  }

  return violations;
}

/**
 * Shared packages that reach for the storage layer's own specifier.
 *
 * **Extracted for the same reason as `storageApiViolations` above, and proved by
 * the same falsification pass.** The first version of this rule's control called
 * `scanPackageWithProbe` with `MODULE_SPECIFIER_PATTERN` directly, which meant
 * two mutations stayed green: one that broke the rule's specifier comparison, and
 * one that narrowed its pattern to `from "…"`. Both left the suite green because
 * the control was not the rule. The rule and its controls now go through one
 * function, with no argument for the same reason as above.
 *
 * **`apps/*` is not scanned here**, and the limit is worth stating: a client
 * importing this layer is the *intended* use, so this rule is deliberately about
 * shared packages only and says so.
 */
function storageImportViolations(): string[] {
  const violations: string[] = [];

  for (const packageName of SHARED_PACKAGES) {
    if (STORAGE_IMPORT_ALLOWED_PACKAGES.includes(packageName)) continue;

    for (const file of collectSourceFiles(join(PACKAGES_DIR, packageName))) {
      const repoPath = toRepoPath(file).split("\\").join("/");
      if (/\.test\.tsx?$/.test(file)) continue;

      const contents = stripComments(readFileSync(file, "utf8"));
      for (const hit of findPatternOccurrences(contents, MODULE_SPECIFIER_PATTERN)) {
        if (hit.includes(STORED_STORAGE_SPECIFIER)) {
          violations.push(`${repoPath} ${hit} (imports the storage layer)`);
        }
      }
    }
  }

  return violations;
}

/**
 * {@link STORAGE_API_PATTERN} with one member expression carved out, for clients.
 *
 * ## Why a client needs its own pattern at all
 *
 * `spectre-storage`'s promoted requirement says **no client and no shared package**
 * other than this layer may name a platform storage API. The enforced rule above scans
 * `packages/*` only — and until M6 slice 2 that was not a gap, because no client had
 * any reason to reach a store. The website becoming the first client with a mailbox to
 * persist is what made it one.
 *
 * **The tempting repair was to weaken the requirement text to match the scan.** "No
 * *shared* package may name a platform storage API" is exactly true of what is
 * enforced, it needs no new assertion, and it reads like a clarification rather than a
 * concession. It is also the wrong move, and `packages/storage/src/browser.ts` records
 * why in the place a reader will find it: a boundary written around "the code that
 * happens to be shared" is a boundary around the current code, not around the decision.
 * The first time a client found a platform store inconvenient, the rule would have
 * said nothing.
 *
 * So the requirement keeps saying *client* and this rule grows to match.
 *
 * ## The carve-out, and its cost
 *
 * `navigator` is in the pattern because `navigator.storage` is the Storage API, and a
 * client reaching that would be persisting outside this layer. It is also how
 * `apps/web/src/Address.tsx` copies a mailbox address, which `website-client` requires
 * and which has nothing to do with storage.
 *
 * `navigator(?!\s*\.\s*clipboard\b)` therefore excludes the clipboard and **nothing
 * else** — `navigator.userAgent`, `navigator.storage`, and `navigator.credentials` are
 * all still reported. The alternative, filtering whole lines whose text happens to
 * contain the allowed spelling, was rejected because it is blunter than it looks: a
 * line doing both `navigator.clipboard.writeText(a)` and `localStorage.setItem(...)`
 * would pass whole, and a rule that lets a real violation ride in on an allowed
 * neighbour is a rule with no line between "safe" and "not".
 *
 * The stated cost: a member spelled with whitespace around the dot
 * (`navigator . clipboard`) is still excluded, because the lookahead allows it. No
 * formatter this repository uses produces that, and `prettier` rewrites it on the next
 * `pnpm format`, so the gap is transient rather than permanent — but it is a gap, and
 * it is written down rather than discovered later.
 */
const CLIENT_STORAGE_API_PATTERN =
  /(?<![\w.$-])(?:localStorage|sessionStorage|navigator(?!\s*\.\s*clipboard\b)|cookies?|location|history|indexedDB|caches)(?![\w$-])|\.cookie\b/g;

/** A module naming `indexedDB` from a client, which no client may do. */
const CLIENT_STORAGE_PROBE = "export const x = indexedDB.open('spectre-mail');";

/**
 * Clients that reach a global store, the URL, or cookies.
 *
 * **Same shape as {@link storageApiViolations} for the same reasons, and the two are
 * deliberately separate functions rather than one with a root argument.** The argument
 * *is* the second spelling of what to scan: M6 slice 1's falsification pass rewrote a
 * call site to `(["mailbox"])`, then to `([])`, and the suite stayed green both times
 * because every package it stopped scanning happened to be clean. A root parameter here
 * would be exactly that mistake, one directory over — the scan would quietly stop
 * covering `apps/extension`, which today has no source files at all and would therefore
 * make the loss invisible until M8 writes some.
 *
 * **No allowance list, so there is nothing to widen.** The one permitted spelling is in
 * the pattern, where it is visible next to the thing it modifies. A separate allowance
 * constant is what made the sibling rule's control able to silence the wrong test, and
 * that mistake should not be repeated to avoid a slightly longer regex.
 *
 * **Test files are skipped**, as in every rule here: a client test has to be able to
 * install `fake-indexeddb` on the global or stub a clipboard, exactly as a provider test
 * has to name wire fields.
 */
function clientStorageApiViolations(): string[] {
  const violations: string[] = [];

  for (const file of collectSourceFiles(APPS_DIR)) {
    // **Exempt because it is a test, not because of how it is named.** See `isTestFile`
    // for why the previous `.test.tsx?` was the twenty-first instance of a check
    // narrower than its rule, and for what that widening costs.
    if (isTestFile(file)) continue;
    const repoPath = toRepoPath(file).split("\\").join("/");
    const contents = stripComments(readFileSync(file, "utf8"));
    for (const hit of findPatternOccurrences(contents, CLIENT_STORAGE_API_PATTERN)) {
      violations.push(`${repoPath} ${hit} (a client reached a global store)`);
    }
  }

  return violations;
}

/**
 * Any way a client can turn a string into markup.
 *
 * `innerHTML`, `outerHTML`, and the legacy `document.write` are included because a
 * client that used one of them would have the same problem as `dangerouslySetInnerHTML`
 * while looking nothing like it.
 */
const MARKUP_ESCAPE_PATTERN =
  /dangerouslySetInnerHTML|\.(?:inner|outer)HTML\s*=|insertAdjacentHTML|document\.write\s*\(/g;

/**
 * Every spelling of "acting on" something a message carried.
 *
 * ## Why this rule exists at all
 *
 * `website-client` says the page **shows what it found and does not act on it**: no
 * copy control for a one-time code, and no detected link rendered in a form that
 * follows it. Copying a code and opening a verification link are the verification
 * workflow, which `docs/ROADMAP.md` schedules at M10, and `design.md` D4 records the
 * conflict this resolves — the roadmap's M5 acceptance criteria list "copy the OTP"
 * while `AGENTS.md` assigns OTP copy to M10.
 *
 * Before this rule the requirement had **one behavioural test in one component**. That
 * is not nothing, and it is not enough: nothing stopped the *next* view from adding a
 * copy button, and a copy button appearing three weeks later would make the
 * implementation and the roadmap disagree in the one way a user notices — they would
 * press it, and it would work, and no requirement would have said it should not.
 *
 * ## What it does and does not catch
 *
 * **The clipboard half is deliberately narrower than "no clipboard".** The first version
 * of this rule forbade any clipboard write under `apps/`, and it immediately failed on
 * `apps/web/src/Address.tsx`, which copies the **mailbox address** — slice 1 behaviour
 * the roadmap's own M5 acceptance criteria require ("receive a working address … use it
 * externally" is not possible without it). So the rule forbids copying *a code*, which
 * is what the requirement forbids, and copying an address stays legal.
 *
 * That is this repository's recurring failure in miniature: an assertion **broader** than
 * the rule it documents, which is as much a capability failure as a narrower one. It
 * was caught only because the rule was run against real files rather than written and
 * left green.
 *
 * Matching a *code* rather than a whole clipboard API needs a window rather than a
 * single pattern, because `execCommand("copy")` copies whatever is selected and takes
 * no argument at all. The window is `CODE_COPY_WINDOW` characters either side of the
 * call, and the rule states the limit it has rather than implying more reach than it
 * has: a page that copied a code from a variable named something else could slip past.
 *
 * For links it catches `href={…url…}` — **the only way a detected URL becomes
 * followable in JSX**. It does not and cannot catch a hand-written anchor whose `href`
 * is a literal, because a literal in a client is a developer's own constant rather than
 * something a message carried.
 */
const DETECTED_LINK_HREF_PATTERN = /href\s*=\s*\{[^}]*\.(?:url|href)\b/g;

const occurrencesOf = (pattern: RegExp) => (contents: string) =>
  findPatternOccurrences(contents, pattern);

/** How far either side of a clipboard call this file looks for the word "code". */
const CODE_COPY_WINDOW = 160;

/**
 * What counts as naming a one-time code, within CODE_COPY_WINDOW of a copy.
 *
 * **A suffix-tolerant alternation, not a word-bounded `code`.** A word boundary needs
 * a non-word character on its left, so it cannot match `otpCode`, `foundCode`, or
 * `verificationCode` - every identifier a developer would plausibly reach for. The
 * previous pattern answered false on exactly the names most likely to be used.
 *
 * **The false-positive trade is accepted, as it is elsewhere in this file.** A local
 * named `pinboard` or `decodeStep` beside a copy would be reported. Renaming the local
 * is the fix, and a rule that missed the real thing would be worse.
 *
 * **The limits this does not reach, stated rather than implied.** An identifier that
 * spells the value with none of these words - `secret`, `digits` - is not caught.
 * Neither is a copy control that reaches no clipboard API at all: a `select()` followed
 * by the user pressing Ctrl+C. The first needs a name; the second is indistinguishable
 * from ordinary text selection, and a rule that banned text selection would fail on
 * selecting the mailbox address, which the roadmap requires.
 */
const CODE_WORD_PATTERN = /\bcode\b|(?:otp|verification|oneTime|found|detected)[A-Za-z]*Code\b/iu;

/**
 * Clipboard writes whose subject is a one-time code.
 *
 * Returns the matched call sites, so a failure names the line rather than only saying
 * that something was found.
 */
function findCodeClipboardWrites(contents: string): string[] {
  const calls = [
    ...contents.matchAll(/\.\s*writeText\s*\(/g),
    ...contents.matchAll(/execCommand\s*\(\s*["'`]copy["'`]/g),
    // **The rich-value form**, matched on both halves so either spelling is caught:
    // navigator.clipboard.write([...]) and a ClipboardItem built for another sink.
    ...contents.matchAll(/\bclipboard\s*\.\s*write\s*\(/g),
    ...contents.matchAll(/\bnew\s+ClipboardItem\b/g),
  ];

  return calls
    .filter((match) => {
      const index = match.index;
      const around = contents.slice(
        Math.max(0, index - CODE_COPY_WINDOW),
        index + CODE_COPY_WINDOW,
      );
      return CODE_WORD_PATTERN.test(around);
    })
    .map((match) => match[0].trim());
}

/**
 * Run a client rule against a module written into `apps/web/src` for the duration of
 * the assertion.
 *
 * The same trick the framework and fetch rules use, for the same reason: a rule proved
 * only by the absence of a violation in files that are already clean has never been
 * shown to fire at all.
 *
 * **It writes into the real client directory, not a fixture directory**, so the
 * `apps/`-shaped discovery in the rules above is what is exercised. A control written
 * somewhere else would prove the pattern works and prove nothing about the scope,
 * which is how the collection rule below stayed green while resolving `apps/` only.
 */
function clientViolationsWithIntroducedModule(
  moduleSource: string,
  match: (contents: string) => string[],
): string[] {
  const probePath = join(APPS_DIR, "web", "src", "__rule-probe.tsx");

  try {
    writeFileSync(probePath, moduleSource, "utf8");
    return collectSourceFiles(APPS_DIR).flatMap((file) =>
      match(stripComments(readFileSync(file, "utf8"))).map((hit) => `${toRepoPath(file)} ${hit}`),
    );
  } finally {
    rmSync(probePath, { force: true });
  }
}

/**
 * A module whose *documentation* names the escape hatch it does not use.
 *
 * Shaped like `apps/web/src/MessageView.tsx`'s module note, which exists to explain
 * that the component has no way to render markup. If `stripComments` stopped working,
 * this control would fail — which is the point of having it, because the alternative
 * is a rule that can be silenced by deleting an explanation.
 */
const MARKUP_PROBE_DOCUMENTATION = `/**
 * There is no \`dangerouslySetInnerHTML\` here and no \`.innerHTML =\`, and that is
 * because the decision was made upstream in the projection.
 */
export function note(): string {
  return "document.write is not used either";
}
`;

/**
 * What a message view looks like when it obeys the rule.
 *
 * Written out here rather than read from the real file so the assertion cannot be
 * satisfied by the file being empty, deleted, or moved — a control that reads its own
 * subject under test is not a control.
 */
const MESSAGE_VIEW = `export function View({ readable, link, code }: Props) {
  return (
    <section>
      <pre>{readable}</pre>
      <span>{link.hostname}</span>
      <span>{link.url}</span>
      <code>{code.value}</code>
    </section>
  );
}
`;

/**
 * Every way to read the clock or arm a timer, one entry per spelling.
 *
 * **The compiler does not enforce this, and that was measured rather than assumed.**
 * `packages/mailbox`'s `tsconfig` withholds the `DOM` lib, which rejects `window`,
 * `document`, `location`, `indexedDB`, `caches`, and `history` — but it does **not**
 * reject `setTimeout`, `setInterval`, `Date`, or `performance`, because `@types/node`
 * declares them exactly as it declares `navigator`, which slice 1's verification pass
 * measured compiling here. So "the poller cannot reach a timer" is true by
 * convention alone unless something here enforces it.
 *
 * This is that something. `MailboxScheduler` exists precisely so the package is given
 * its timer rather than finding one, and a rule that fires the moment it reaches for
 * a global is what keeps the seam from quietly becoming decorative.
 *
 * **`Date.parse` is in the list, not out of it.** Parsing a timestamp out of a string
 * is one step from deciding how long a mailbox has been alive, and
 * `provider-abstraction` forbids inferring expiry from elapsed time. `Date.UTC` is
 * deliberately *not* matched: it is date arithmetic that reads no clock and returns
 * the same number forever, which is why `test-support.ts` can pin an instant with it.
 *
 * **One pattern per spelling, because the first recorded instance of this repository's
 * recurring defect is a single-pattern rule with one control.** A rule here has stayed
 * green while guarding nothing four separate times; a list of forms with a control
 * each is the only shape that does not rot that way.
 */
// ═══════════════════════════════════════════════════════════════════════════════
// Stylesheets
//
// Three rules, added together because the milestone that needed them added all three
// facilities at once — and each of them can be satisfied by leaving the repository the
// same, so they are proven by the probes planted inside the same assertions that read
// the real tree.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Every stylesheet the product ships.
 *
 * ## Why the roots come from the disk and not from a list
 *
 * A list here would be a second spelling of "which stylesheets exist", and this file has
 * recorded what happens when a set gets two spellings: a rule becomes narrow in the
 * direction nobody re-reads. The directories are the same two every other rule here
 * already walks, so a new client's stylesheet is covered **by being created** rather than
 * by being listed.
 *
 * The control for that is not a comment. It is the fact that `apps/extension` has no
 * `src/` directory yet: the walk is over the client *root*, so the day M8 gives it a
 * stylesheet the rule covers it with no edit.
 */
function shippedStylesheets(): string[] {
  return [...collectSourceFiles(PACKAGES_DIR), ...collectSourceFiles(APPS_DIR)].filter((file) =>
    file.endsWith(CSS_EXTENSION),
  );
}

/**
 * A remote reference in a stylesheet, in every form that resolves one.
 *
 * Four forms, because a CSS author has four ways to name the same URL and a rule that
 * matches one of them matches a quarter of the ways this milestone's product would phone
 * a third party:
 *
 * - `@import url("https://…")`  the form a Google Fonts snippet ships in
 * - `@import "https://…"`      the bare-string form, no `url()`
 * - `url(https://…)`           a background, a mask, a `src` in `@font-face`
 * - `url("//…")`               protocol-relative, which is the same request
 *
 * **It says `http` as well as `https`, because a plain-`http` stylesheet is not a
 * conservative choice** — it is the same third-party request over a channel any network
 * on the path can rewrite, and this is a product whose page tells the user what is kept
 * on their device.
 *
 * **It cannot see an asset loaded from markup**, and says so rather than implying
 * coverage: a `<link href="https://fonts…">` in `index.html` is not a stylesheet, this
 * scan does not read HTML, and `markupAssetViolations()` exists because this one cannot
 * do that job. Neither check covers the other.
 */
const REMOTE_CSS_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "@import of a URL", pattern: /@import\s+url\(\s*['"]?\s*https?:\/\//i },
  { label: "@import of a bare string", pattern: /@import\s+['"]\s*(?:https?:)?\/\//i },
  { label: "url() pointing at an origin", pattern: /url\(\s*['"]?\s*(?:https?:)?\/\//i },
];

/**
 * A declaration that removes a focus indicator.
 *
 * ## What this catches, and the one thing it does not
 *
 * `outline: none`, `outline: 0`, and `outline-width: 0` — the three ways an author
 * silences an indicator, and the three the approved direction forbids outright.
 *
 * **It does not catch `outline: 2px solid transparent`, which defeats an indicator just
 * as thoroughly.** That is stated in the rule because it is the honest limit, and it is
 * why the browser spec asserting a *rendered* ring is not optional: only rendering
 * distinguishes a visible indicator from a declared one. A gate that catches the common
 * accident plus a spec that catches the class is better than either alone, and a gate
 * claiming to catch both would be claiming the second one.
 *
 * A custom property named `--outline-none` cannot reach this: the pattern requires
 * `outline` followed by a colon, and `--focus` / `--width-focus` are what the token layer
 * actually declares.
 */
const FOCUS_SUPPRESSION_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] =
  [
    { label: "outline removed", pattern: /(?:^|[;{\s])outline\s*:\s*(?:none|0)\s*(?:;|!|$)/i },
    {
      label: "outline width removed",
      pattern: /(?:^|[;{\s])outline-width\s*:\s*0(?:[a-z%]*)\s*(?:;|!|$)/i,
    },
  ];

/** A custom-property read, captured. */
const CSS_VARIABLE_READ = /var\(\s*(--[A-Za-z0-9_-]+)/g;

/** A custom-property declaration. */
const CSS_VARIABLE_DECLARATION = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g;

/**
 * Every custom property a stylesheet reads, with where it was read.
 *
 * ## Why the token layer and the reading file are both consulted
 *
 * Because that is what the platform does. A declaration on `:root` is visible to every
 * stylesheet; a declaration inside a selector is visible only within it. So a read
 * resolves if the name is declared **in the token layer** (anywhere in it) **or above the
 * read in the same file** (a local declaration) — and the rule is checked in that order
 * rather than by consulting every stylesheet for every read, which would let a local
 * declaration in one file satisfy a typo'd read in another.
 */
function collectUnresolvedTokens(repoPath: string, contents: string): string[] {
  const code = stripComments(contents);
  const tokenLayer = readFileSync(join(REPO_ROOT, TOKEN_LAYER), "utf8");

  const declaredGlobally = new Set<string>();
  const perLine = new RegExp(CSS_VARIABLE_DECLARATION.source, "g");
  for (const match of tokenLayer.matchAll(perLine)) {
    declaredGlobally.add(match[1] as string);
  }

  const lines = code.split("\n");
  /** Declared so far *in this file*, which is what a local declaration means. */
  const declaredLocally = new Set<string>();
  const violations: string[] = [];

  lines.forEach((line, index) => {
    for (const match of line.matchAll(new RegExp(CSS_VARIABLE_DECLARATION.source, "g"))) {
      declaredLocally.add(match[1] as string);
    }
    for (const match of line.matchAll(new RegExp(CSS_VARIABLE_READ.source, "g"))) {
      const name = match[1] as string;
      if (!declaredGlobally.has(name) && !declaredLocally.has(name)) {
        // Carries its rule's label in the same `(…)` form every other finding here
        // uses. **That consistency is load-bearing, and it was arrived at by a failed
        // assertion rather than by foresight**: the first version of this rule ended
        // its message at "never declared" while the assertion counted findings by the
        // label the other rules carry, so a rule that was working perfectly reported
        // zero and the assertion read that as "the rule found nothing". Two lessons,
        // both of which this file has learned before — a finding without its rule's
        // name cannot be counted or attributed, and a zero that arrives from a mismatch
        // between two conventions is indistinguishable from a rule that stopped
        // working.
        violations.push(
          `${repoPath} line ${index + 1}: ${name} is read but never declared (${UNRESOLVED_TOKEN_LABEL})`,
        );
      }
    }
  });

  return violations;
}

/**
 * The label every unresolved-token finding carries.
 *
 * **A named constant rather than an inline string, because it is written in two places
 * that must agree** — the rule that produces the finding and the assertion that counts
 * it. Written twice as a literal, it would be exactly the "two rules share one
 * allowance constant" defect in a new dress: changing one side silences the other and
 * the suite stays green.
 */
const UNRESOLVED_TOKEN_LABEL = "an undeclared custom property";

/**
 * Every violation of the three stylesheet rules, plus the markup rule that covers what
 * this one cannot see.
 *
 * **One entry point, deliberately.** The three rules read the same files, so a caller
 * that reached them separately could plant a probe in one file and read the result of a
 * different rule — which is the shape of the recorded defect where two rules shared one
 * allowance constant and widening it silenced the other. One function, one file list,
 * every finding labelled with the rule that produced it.
 */
function stylesheetViolations(): string[] {
  const violations: string[] = [];

  for (const file of shippedStylesheets()) {
    const repoPath = toRepoPath(file);
    const contents = readFileSync(file, "utf8");
    const code = stripComments(contents);

    for (const { label, pattern } of REMOTE_CSS_PATTERNS) {
      for (const hit of findPatternOccurrences(code, pattern)) {
        violations.push(`${repoPath} ${hit} (${label})`);
      }
    }

    for (const { label, pattern } of FOCUS_SUPPRESSION_PATTERNS) {
      for (const hit of findPatternOccurrences(code, pattern)) {
        violations.push(`${repoPath} ${hit} (${label})`);
      }
    }

    violations.push(...collectUnresolvedTokens(repoPath, contents));
  }

  // The markup rule is here rather than beside it because it is the same requirement —
  // "the page loads no third-party asset" — reached from the other direction. A `<link>`
  // in HTML and a `@import` in CSS are the two ways to ship a font, and each rule can see
  // only one of them.
  for (const html of markupFiles()) {
    const repoPath = toRepoPath(html);
    const code = stripComments(readFileSync(html, "utf8"));

    for (const hit of findPatternOccurrences(code, REMOTE_HTML_ASSET_PATTERN)) {
      violations.push(`${repoPath} ${hit} (a remote asset in markup)`);
    }
  }

  return violations;
}

/**
 * A client entry document.
 *
 * **Found rather than named.** `apps/web/index.html` is the only one today; naming it
 * would make a second client's remote webfont invisible, which is the exact shape of the
 * narrow-rule defect this file has recorded twenty-one times. `apps/extension` has no
 * `index.html` yet and is covered the day M8 writes one.
 */
function markupFiles(): string[] {
  return readdirSync(APPS_DIR).flatMap((entry) => {
    const absolute = join(APPS_DIR, entry);
    if (!statSync(absolute).isDirectory()) return [];
    const document = join(absolute, "index.html");
    return existsSync(document) ? [document] : [];
  });
}

/**
 * A `src` or `href` on the entry document that resolves to another origin.
 *
 * Covers both schemes and the protocol-relative form, for the same reason the CSS rule
 * does: all three are the same request and only one of them would look encrypted.
 */
const REMOTE_HTML_ASSET_PATTERN = /(?:src|href)\s*=\s*['"](?:https?:)?\/\//i;

/**
 * Every class hook a client actually renders, read from the **syntax tree**.
 *
 * ## Why a parser and not a pattern, and what that costs
 *
 * Because `className` is not a string in this codebase and a pattern over it is a guess.
 * The shapes in use are `className="control"`, `className="notice notice--danger"`, and
 * `className={condition ? "inbox-row inbox-row--carries" : "inbox-row"}` — a regular
 * expression matching the first would read the third as one unrecognised token and either
 * report a false violation or, worse, report nothing at all. That is the twenty-second
 * instance of the defect class this file exists to prevent, and it is cheaper to prevent
 * here than to discover.
 *
 * `typescript` is already a workspace dev dependency — `pnpm typecheck` cannot run without
 * it — so reading the tree costs nothing and is exact about comments and string
 * boundaries, which is where a hand-written pattern goes wrong.
 *
 * ## What it still does not see
 *
 * A `class` composed at runtime by string concatenation of a variable the parser cannot
 * follow is not collected, so such a token would go unstyled *and* unreported. **There is
 * none today**, which is a fact about this repository measured by reading it, not a
 * property this function guarantees. The rule below says so rather than implying coverage.
 */
function clientClassHooks(): { readonly file: string; readonly hooks: readonly string[] }[] {
  const found: { file: string; hooks: string[] }[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      if (SKIP_DIRECTORIES.has(entry)) continue;

      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;

      const hooks = new Set<string>();
      const tree = ts.createSourceFile(
        absolute,
        readFileSync(absolute, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      const collectFrom = (node: ts.Node): void => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          for (const token of node.text.split(/\s+/)) {
            // **A token that cannot be a class is not treated as one.** `className=""`
            // is legal and renders nothing; a conditional may also carry a non-class
            // string that the JSX happens to place there. Filtering to identifier-shaped
            // tokens keeps a finding a finding.
            if (/^[A-Za-z][\w-]*$/.test(token)) hooks.add(token);
          }
          return;
        }
        if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
          for (const token of node.text.split(/\s+/)) {
            if (/^[A-Za-z][\w-]*$/.test(token)) hooks.add(token);
          }
        }
        ts.forEachChild(node, collectFrom);
      };

      const visit = (node: ts.Node): void => {
        if (ts.isJsxAttribute(node) && node.name.text === "className" && node.initializer) {
          collectFrom(node.initializer);
        }
        ts.forEachChild(node, visit);
      };

      visit(tree);

      if (hooks.size > 0) found.push({ file: toRepoPath(absolute), hooks: [...hooks] });
    }
  };

  walk(APPS_DIR);
  return found;
}

/**
 * Class hooks a client renders that no shipped stylesheet selects.
 *
 * **One entry point and one direction.** The direction matters: this asks whether a hook
 * is *used*, not whether a stylesheet rule is *live*. The converse — a class selector in a
 * stylesheet that nothing renders — is dead CSS, which is untidy rather than wrong, and
 * several tokens here are legitimately applied by more than one component.
 */
function unstyledClassHooks(): string[] {
  const stylesheets = shippedStylesheets()
    .map((file) => stripComments(readFileSync(file, "utf8")))
    .join("\n");

  const violations: string[] = [];

  for (const { file, hooks } of clientClassHooks()) {
    for (const hook of hooks) {
      // Matched as a class selector, not as a substring: `.inbox-row` appearing in
      // `.inbox-rows` would satisfy a `includes` check for the shorter name, so the
      // probe below is written to be exactly the failure that substitution would cause.
      if (!new RegExp(`\\.${hook}(?![\\w-])`).test(stylesheets)) {
        violations.push(`${file}: \`${hook}\` is rendered but no stylesheet selects it`);
      }
    }
  }

  return violations;
}

const CLOCK_GLOBAL_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "Date.now", pattern: /(?<![\w.$])Date\.now\s*\(/g },
  { label: "Date.parse", pattern: /(?<![\w.$])Date\.parse\s*\(/g },
  { label: "new Date", pattern: /(?<![\w.$])new\s+Date\b/g },
  { label: "performance.now", pattern: /(?<![\w.$])performance\.now\s*\(/g },
  { label: "setTimeout", pattern: /(?<![\w.$])setTimeout\s*\(/g },
  { label: "setInterval", pattern: /(?<![\w.$])setInterval\s*\(/g },
  { label: "setImmediate", pattern: /(?<![\w.$])setImmediate\s*\(/g },
];

/**
 * The only package permitted to reach the mail parser.
 *
 * The parser is a pure function of a message body, and it is reached in one
 * direction on purpose: `packages/mailbox` calls it, and a client renders the
 * verdict the session cached. A client that could call the parser itself would be
 * able to re-parse on every render, which is precisely the twice-per-message work
 * `mailbox-session` requires it not to do — and the requirement would then be
 * enforced by nothing but good intentions in a view file.
 *
 * So this is a *direction* rule, not an existence rule: the parser must have exactly
 * one caller in this repository, and it is `packages/mailbox`.
 */
const PARSER_ALLOWED_IMPORTERS = ["mailbox"] as const;

/** Specifiers that resolve to the mail parser, however they are written. */
const PARSER_SPECIFIER_PATTERN = /@spectre-mail\/mail-parser|\.\.\/mail-parser|\.\/mail-parser/g;

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

/**
 * The package directories the `fetch` rule scans, in one place.
 *
 * **`packages/mailbox` joined this list at M5 slice 2, and it was a real gap rather
 * than tidiness.** The rule existed to hold the promoted `mailbox-session`
 * requirement that the session layer "reaches no network directly", and it covered
 * the two packages that *could* plausibly have wanted a transport. Then slice 2 added
 * a polling loop to a third package — and a loop is exactly the code whose temptation
 * is to reach for `fetch`. The behaviour was still correct (every call goes through a
 * `MailProvider`), but nothing held it: a `fetch` introduced into `inbox.ts` would
 * have turned no assertion red, because the behavioural test that drives a recording
 * transport only ever opened a mailbox, and the scan looked elsewhere.
 */
const NETWORK_FORBIDDEN_PACKAGES = ["providers", "mail-parser", "mailbox"] as const;

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

/**
 * The same trick for the framework rule: run the real scan over a module written
 * into `packages/mailbox` for the duration of the assertion.
 *
 * It exists because the rule was **narrower than it claimed for its whole life**.
 * Its controls exercised `import * as React from "react"`, which the pattern
 * matched — so the test was green, and a bare `import "react";` in a real file of
 * the package passed unnoticed. A control proves the form its author thought of;
 * only a control **per form** proves the rule.
 */
function frameworkViolationsWithIntroducedModule(moduleSource: string): string[] {
  const probePath = join(PACKAGES_DIR, "mailbox", "__framework-rule-probe.ts");

  try {
    writeFileSync(probePath, moduleSource, "utf8");
    return collectSourceFiles(join(PACKAGES_DIR, "mailbox"))
      .filter((file) => !file.endsWith(".test.ts"))
      .flatMap((file) => {
        const contents = stripComments(readFileSync(file, "utf8"));
        return findPatternOccurrences(contents, FRAMEWORK_IMPORT_PATTERN).map(
          (hit) => `${toRepoPath(file)} ${hit}`,
        );
      });
  } finally {
    rmSync(probePath, { force: true });
  }
}

/**
 * The same trick for the clock rule: run the real scan over a module written into
 * `packages/mailbox` for the duration of the assertion, and delete it either way.
 *
 * `try`/`finally` with an unconditional delete is what makes this safe: a probe never
 * survives the test, whether the assertion passes or throws.
 */
function clockViolationsWithIntroducedModule(moduleSource: string): string[] {
  return scanPackageWithProbe("mailbox", "__clock-rule-probe.ts", moduleSource, (contents) =>
    collectClockViolations(contents),
  );
}

/** Every clock or timer global in one module's comment-stripped source. */
function collectClockViolations(contents: string): string[] {
  const code = stripComments(contents);
  const violations: string[] = [];

  for (const { label, pattern } of CLOCK_GLOBAL_PATTERNS) {
    for (const hit of findPatternOccurrences(code, pattern)) {
      violations.push(`${hit} (${label})`);
    }
  }

  return violations;
}

/**
 * Write `moduleSource` into `packageName`, run `inspect` over every module there, and
 * remove the probe again whatever happens.
 *
 * One helper for the two rules that both need the whole pipeline exercised — file
 * collection, the `.test.ts` exemption, comment stripping — and only differ in the
 * pattern they apply. Editing a checked-in module instead would mean a failing
 * assertion left the repository in a state its own test caused.
 */
function scanPackageWithProbe(
  packageName: string,
  probeFileName: string,
  moduleSource: string,
  inspect: (contents: string) => string[],
): string[] {
  const probePath = join(PACKAGES_DIR, packageName, probeFileName);

  try {
    writeFileSync(probePath, moduleSource, "utf8");
    return collectSourceFiles(join(PACKAGES_DIR, packageName))
      .filter((file) => !file.endsWith(".test.ts"))
      .flatMap((file) =>
        inspect(readFileSync(file, "utf8")).map((hit) => `${toRepoPath(file)} ${hit}`),
      );
  } finally {
    rmSync(probePath, { force: true });
  }
}

/**
 * Every module outside `packages/mailbox` that names the mail parser.
 *
 * Scanned over the whole workspace rather than `packages/` alone, because the
 * interesting violation is a **client** reaching the parser directly: `apps/web` is
 * exactly where that would be tempting, and it is a directory this repository's
 * package-only scans have missed before.
 */
function parserDirectionViolations(): string[] {
  const violations: string[] = [];

  for (const root of [PACKAGES_DIR, APPS_DIR]) {
    for (const file of collectSourceFiles(root)) {
      const relative = toRepoPath(file).split("\\").join("/");

      // The parser itself names itself in its own public surface, and a test names
      // whatever it is exercising.
      if (relative.startsWith("packages/mail-parser/")) continue;
      // `tsx` as well as `ts`. Every other rule in this file exempts tests on the
      // stated ground that a check asserting a name's absence has to be able to name
      // it, and this one exempted only the extension-less form - so a future
      // `apps/web/src/*.test.tsx` importing the parser would be reported, which is the
      // inconsistency a reader would take for a rule that meant something.
      if (/\.test\.tsx?$/.test(file)) continue;

      const importer = relative.split("/")[1];
      if (importer !== undefined && PARSER_ALLOWED_IMPORTERS.includes(importer as never)) continue;

      const contents = stripComments(readFileSync(file, "utf8"));
      for (const hit of findPatternOccurrences(contents, PARSER_SPECIFIER_PATTERN)) {
        violations.push(`${relative} ${hit} (imports the mail parser directly)`);
      }
    }
  }

  return violations;
}

describe("architecture boundaries", () => {
  it("has the packages and apps the roadmap specifies", () => {
    // **This list is the roadmap's shared-package list, transcribed.** It was
    // written at M1 and left at M4, so after M5 slice 1 amended that list to add
    // `mailbox` and to move lifecycle behaviour out of `core`, this rule no longer
    // encoded the roadmap while still being named for it. A check that has quietly
    // stopped checking is worse than one that was never written.
    //
    // `mailbox` was previously guarded only by accident: the framework rule's own
    // `readdirSync` over the directory would have thrown if it did not exist. That is
    // not an assertion about the roadmap, and it stops guarding the moment that rule
    // changes.
    //
    // **The list itself is `SHARED_PACKAGES`,** so the roadmap's shared-package list
    // is transcribed once rather than twice. It was written here and again in the
    // storage rules in the same change, which is one list too many — a check that
    // disagrees with another check is a failure that reads as a pass in both.
    const expectedPackages = [...SHARED_PACKAGES];

    for (const name of expectedPackages) {
      expect(() => statSync(join(PACKAGES_DIR, name))).not.toThrow();
    }
    expect(() => statSync(join(APPS_DIR, "web"))).not.toThrow();
    expect(() => statSync(join(APPS_DIR, "extension"))).not.toThrow();

    // **And it names every package on disk, not only that everything it names
    // exists.** The loop above is one-directional, and a one-directional check is
    // exactly the shape that let a sixth package be added without appearing in
    // `SHARED_PACKAGES` — which would silently exempt it from both storage rules.
    // Falsifying this change found that gap: rewriting the storage rules' package
    // list to `["mailbox"]` left the suite **green**, so the rules could be
    // narrowed to one package while still being named for all of them. This
    // assertion is what makes a *narrowed* list fail rather than pass.
    const onDisk = readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    // Sorted both sides, because order carries no meaning here and a list that only
    // matches in one order is a list that fails for the wrong reason.
    expect([...expectedPackages].sort()).toEqual(onDisk);
  });

  it("declares exactly the roadmap's workspace layout", () => {
    expect(readWorkspaceGlobs()).toEqual(["apps/*", "packages/*"]);
  });

  it("keeps the storage layer's own dependencies to the domain model", () => {
    // The third direction, and the one with no rule of its own until now. The two
    // storage rules say which packages must not *reach* the layer and must not
    // *name* a store; neither says what the layer itself may depend on, and a
    // storage adapter that imported a provider adapter would make the platform seam
    // depend on the thing it exists to persist — so a second provider's wire format
    // would reach a client that never asked for it.
    //
    // `apps/*` is covered by the existing "a package never imports an app" rule, so
    // it is not restated here. This is the shared-package half, read from the
    // manifest rather than from import specifiers, because that is where the
    // dependency is declared and where a wrong one would be resolved.
    const manifest = JSON.parse(
      readFileSync(join(PACKAGES_DIR, "storage", "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

    // A precondition on the shape being read, so an empty `dependencies` cannot make
    // the allow-list assertion pass without ever having compared anything.
    expect(manifest.dependencies).toBeDefined();
    expect(Object.keys(manifest.dependencies ?? {})).not.toEqual([]);

    // The domain model, and nothing else. `@spectre-mail/core` holds the `Mailbox`
    // this layer stores and carries no provider wire format, which is the property
    // that makes it safe to depend on.
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(["@spectre-mail/core"]);

    // And the test-only dependency is not a runtime one. `fake-indexeddb` standing in
    // for a browser is a fixture; in `dependencies` it would ship to production.
    const runtime = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const name of Object.keys(manifest.devDependencies ?? {})) {
      expect(runtime.has(name), `${name} is both a runtime and a dev dependency`).toBe(false);
    }
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

      // **Comments are stripped, and this is the fourth recorded instance of a check
      // in this file firing on its own documentation.** `packages/mailbox`'s inbox
      // parser documents the grammar it reads a rate-limit window out of, and naming
      // the header it arrived in is exactly how a future reader learns where the
      // string came from. The rule fired on that sentence. Rewording the comment until
      // the rule went quiet would have been the wrong fix twice over: it would have
      // deleted a true statement about provenance, and it would have left the rule
      // able to fail on the next honest comment. Every other scan here strips
      // comments; this one did not, and that inconsistency is the defect.
      //
      // It still matches real code and real strings — `stripComments` removes
      // comments, not identifiers — and the control below drives a field name through
      // each of those so this is not taken on trust.
      const contents = stripComments(readFileSync(file, "utf8"));

      for (const field of PROVIDER_FIELD_NAMES) {
        for (const hit of findOccurrences(contents, field)) {
          violations.push(`${toRepoPath(file)} ${hit} (matched "${field}")`);
        }
      }
    }

    // The apps keep their own scan, unchanged: provider wire format has no
    // legitimate reason to appear there either.
    for (const file of collectSourceFiles(APPS_DIR)) {
      const contents = stripComments(readFileSync(file, "utf8"));

      for (const field of PROVIDER_FIELD_NAMES) {
        for (const hit of findOccurrences(contents, field)) {
          violations.push(`${toRepoPath(file)} ${hit} (matched "${field}")`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("catches a provider field name in code while ignoring one in a comment", () => {
    // One control per direction, because a rule that strips comments is only honest
    // if it is still capable of firing. The positive control is a real file written
    // with the name in an identifier position; the negative control is the same name
    // in prose. Both are driven through the same two entry points the rule uses.
    const inCode = `const value = record.mail_from ?? "";\n`;
    const inComment = `/** The sender arrived as \`mail_from\`. */\nexport const x = 1;\n`;

    // Positive: a field name read off an object.
    expect(findOccurrences(stripComments(inCode), "mail_from")).toHaveLength(1);
    // Negative: the same name, described rather than used.
    expect(findOccurrences(stripComments(inComment), "mail_from")).toHaveLength(0);
    // And the strip is what makes the difference, not a quirk of the fixture: read
    // raw, the comment *does* match, which is precisely the defect.
    expect(findOccurrences(inComment, "mail_from")).toHaveLength(1);
  });

  it("keeps the mailbox session layer free of a framework and a DOM", () => {
    // Task 1.6 and 5.1. `packages/mailbox` exists so two clients can share one
    // implementation, and it can only do that if it depends on neither React nor a
    // DOM. The website needs this package; the extension, scheduled for M8, needs it
    // too, and a package that had picked up `react` would force the extension to
    // either ship React or rewrite the shared layer.
    //
    // **This rule is a backstop, not the primary enforcement.** The package's own
    // `tsconfig.json` sets `"lib": ["ES2023"]` with no `"DOM"`, so `window`,
    // `document`, and `location` fail to *compile*. Measured name by name on
    // 2026-10-02: those three are rejected by `tsc`, while `navigator`,
    // `localStorage`, and `sessionStorage` all compile — they arrive through
    // `@types/node`, which a bare `lib` does not exclude. `types: []` was tried
    // and does not change this. So the compiler blocks **the DOM**, not **storage
    // or the navigator**, and the storage half of the no-storage requirement is
    // held by the separate rule below rather than by the compiler. The compiler is
    // still the stronger of the two, which is why it stays the primary and this
    // scan the supplement.
    //
    // **Its stated limit:** it matches import *specifiers* only. A framework reached
    // through a global, through a dynamic `import()` with a computed specifier, or
    // through a re-exported copy of it elsewhere, would pass this scan. It also
    // covers `packages/mailbox` only - it is not a repository-wide "no framework"
    // rule, and `apps/web` is expected to use React.
    const mailboxDir = join(PACKAGES_DIR, "mailbox");
    const violations: string[] = [];

    for (const file of collectSourceFiles(mailboxDir)) {
      const contents = stripComments(readFileSync(file, "utf8"));
      for (const hit of findPatternOccurrences(contents, FRAMEWORK_IMPORT_PATTERN)) {
        violations.push(`${toRepoPath(file)} ${hit} (imports a UI framework)`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("catches a framework import in every syntactic form, not only the obvious one", () => {
    // **One control per import form.** The rule above spent its whole life with a
    // single control — `import * as React from "react"` — which it matched. So the
    // test was green and a bare `import "react";` in a real module of the package
    // went unnoticed. A control proves the form its author happened to think of;
    // `MODULE_SPECIFIER_PATTERN` has carried `\bimport\s+` since M1 for exactly this
    // reason, and the gap was reproduced rather than avoided when this rule was
    // written later.
    const forms = {
      "static import": 'import * as React from "react";',
      "bare side-effect import": 'import "react";',
      "scoped subpath": 'import "react-dom/client";',
      "dynamic import": 'void import("react");',
      "commonjs require": 'const React = require("react");',
      "re-export": 'export { default } from "react";',
      "single quotes": "import 'vue';",
      "non-framework, same shape": 'import { x } from "spectre-mail-not-a-framework";',
    };

    for (const [name, source] of Object.entries(forms)) {
      const violations = frameworkViolationsWithIntroducedModule(source);
      if (name === "non-framework, same shape") {
        // The negative half of a positive control: a package whose name merely
        // contains the letters must not fire, or the rule is useless within a week.
        expect(violations).toEqual([]);
      } else {
        expect(violations.length, `${name} should be caught`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps storage, cookies, and the URL out of every shared package but the storage layer", () => {
    // Task 1.6's storage half, **generalised at M6 slice 1**, and it is a separate
    // rule because the compiler cannot do this job. `packages/mailbox`'s
    // `tsconfig.json` withholds `DOM`, which rejects `window`, `document`, and
    // `location` — measured name by name. It does *not* reject `navigator`,
    // `localStorage`, or `sessionStorage`: `@types/node` declares all three, and
    // `"types": []` was tried and does not exclude it. So a package that quietly
    // persisted itself would have compiled, typechecked, and passed every other
    // gate in this file.
    //
    // **Why it was generalised rather than left on `packages/mailbox`.** That is a
    // property of `@types/node`, not of one package: every workspace package
    // compiles `localStorage` today, and `packages/core` has no `tsconfig` excuse
    // to offer because it has nothing to exclude. A rule that described all of them
    // and checked one is the defect this file has already recorded seven times — and
    // the control below deliberately probes a package the old rule never looked at,
    // because a control in `mailbox` would pass for the same reason the old rule
    // did.
    //
    // Storage arrives behind a `SpectreStorage` contract that is passed *in*. A
    // shared package reaching for a global store would make that contract
    // decorative, and would put a per-client persistence decision inside a package
    // neither client can see.
    // **The rule and its positive control share ONE call site, and that is the whole
    // design of this test.** Falsifying this change found that a rule written
    // `expect(storageApiViolations()).toEqual([])` is structurally unfalsifiable: it
    // is a *negative* assertion, so narrowing the call site to `[]` or to
    // `["mailbox"]`, or narrowing `SHARED_PACKAGES`, all leave it satisfied — every
    // package it stopped scanning happened to be clean. Three separate attempts to
    // catch that with a control elsewhere in the file also stayed green, because a
    // control that calls the *function* is not a control on the *rule*.
    //
    // So the two halves are asserted here, in order, through the same call:
    // violations **with** a probe planted in every package the rule must scan (which
    // fails if it scans fewer), then violations **without** any probe (which is the
    // rule itself). A rule that stops scanning cannot satisfy the first; a rule that
    // cannot see a planted violation cannot satisfy the second.
    const planted: string[] = [];
    try {
      for (const packageName of SHARED_PACKAGES) {
        planted.push(packageName);
        writeFileSync(
          join(PACKAGES_DIR, packageName, "__storage-rule-probe.ts"),
          INDEXED_DB_PROBE,
          "utf8",
        );
      }

      // The allowance, **transcribed here rather than derived from the allowance
      // constant.** Deriving it — `planted.filter((n) => !STORAGE_API_ALLOWED_PACKAGES
      // .includes(n))` — is what an earlier version did, and falsifying the change
      // showed the consequence: widening the allowance moved *both* sides of the
      // comparison, so the assertion stayed true and the rule silently stopped
      // guarding `packages/core`. A control must not compute its own expectation out
      // of the thing it is testing.
      const mustScan = ["core", "mail-parser", "mailbox", "providers", "ui"];

      // Preconditions on the list itself, so a rule that scans nothing cannot make the
      // count below zero and look correct, and so a renamed package fails here rather
      // than as a puzzling count.
      expect([...planted].sort()).toEqual([...SHARED_PACKAGES].sort());
      expect(mustScan.length).toBe(SHARED_PACKAGES.length - 1);

      const reported = storageApiViolations().filter((hit) =>
        hit.includes("__storage-rule-probe.ts"),
      );

      expect(reported.length, `the rule should report all ${mustScan.length} packages`).toBe(
        mustScan.length,
      );

      // **Each expected package by name, not only as a count.** A count is satisfied
      // by reporting one package five times, and the platform would never do that —
      // but the assertion should not depend on that.
      expect(
        reported.map((hit) => hit.split("/__storage-rule-probe")[0]?.split("/").pop()),
        "the rule should report each expected package once",
      ).toEqual(mustScan);
    } finally {
      for (const packageName of planted) {
        rmSync(join(PACKAGES_DIR, packageName, "__storage-rule-probe.ts"), { force: true });
      }
    }

    // **The rule itself**, and the reason the allowance exists: `indexeddb.ts` names
    // `indexedDB` in its option type and in its destructuring, which is that package
    // doing its job rather than reaching for a global store.
    //
    // **What this line cannot prove, stated plainly.** It is a negative assertion, so
    // it is satisfied by a rule that reports nothing at all — which is why the
    // planted half above is in this same test rather than beside it. The pair is what
    // has teeth: a rule that scans nothing fails the first, and a rule that cannot see
    // a planted violation fails the second.
    expect(storageApiViolations()).toEqual([]);
  });

  it("catches a storage API in every spelling, through the rule's own scan", () => {
    // Each spelling is listed separately because `localStorage` and `sessionStorage`
    // are two distinct globals that one careless pattern would half-cover, and
    // because `document.cookie` is a property of an object rather than a bare
    // global. The loop does not stop at the first failure, so a pattern that catches
    // one form and misses three reports which.
    //
    // **Probed in `packages/core` on purpose.** A probe in `packages/mailbox` would be
    // satisfied by the rule as it was written before this change, and would therefore
    // establish nothing about whether the rule got any broader.
    const forms = {
      localStorage: "export const x = localStorage.length;",
      sessionStorage: "export const x = sessionStorage.length;",
      cookies: "export const x = document.cookie;",
      url: "export const x = location.href;",
      navigator: "export const x = navigator.userAgent;",
      indexedDB: INDEXED_DB_PROBE,
    };

    const path = join(PACKAGES_DIR, "core", "__storage-rule-probe.ts");
    try {
      for (const [name, source] of Object.entries(forms)) {
        writeFileSync(path, source, "utf8");
        // **Through the rule, not around it.** The first version of this control read
        // the probe file directly, which proved the pattern fires and proved nothing
        // about whether the rule's own file discovery would find it.
        //
        // **Filtered by `packages/core`'s path, not by the file name alone.** A
        // filename filter also matched probes planted in the other shared packages
        // during the rule test above, so a form the rule genuinely missed was
        // satisfied by an unrelated package's violation. That is the same shape of
        // defect this file has recorded repeatedly: an assertion satisfied by text it
        // did not name.
        expect(
          storageApiViolations().filter((hit) =>
            hit.startsWith(`packages/core/__storage-rule-probe.ts`),
          ),
          `${name} should be caught in packages/core`,
        ).not.toEqual([]);
      }
    } finally {
      rmSync(path, { force: true });
    }
  });

  it("reaches the storage layer only from a client", () => {
    // The **reverse** direction of the rule above, and it is what keeps the
    // dependency arrow pointing from host environments inward. Without it, a shared
    // package could depend on `packages/storage`, and the platform API would be one
    // `import` away from every layer that `mailbox-session`'s Purpose records as
    // unreachable from — a claim that would then be true only in prose.
    //
    // **What it does not check:** the dependency declared in a `package.json`, only
    // the specifier a module actually imports. A package that declared the
    // dependency and imported nothing would pass. That is a manifest-level fact, and
    // pnpm would refuse to link an undeclared specifier, so the two cannot drift
    // apart into a broken build.
    //
    // **The positive half comes first, in this same test and through this same call**,
    // for the reason the storage-API rule above gives: this assertion is negative, so
    // narrowing the rule's package list leaves it satisfied — every package it stopped
    // scanning happens to be clean, because no package imports this layer today.
    // A violation planted in every package the rule must scan is what makes the
    // negative assertion mean something.
    const forms = {
      "a named import":
        'import { SpectreStorage } from "@spectre-mail/storage";\nexport const x = SpectreStorage;',
      "a type import":
        'import type { SpectreStorage } from "@spectre-mail/storage";\nexport const x: SpectreStorage | null = null;',
      "a re-export": 'export { SpectreStorage } from "@spectre-mail/storage";',
      "a namespace import":
        'import * as storage from "@spectre-mail/storage";\nexport const x = storage;',
      "a dynamic import": 'export const x = import("@spectre-mail/storage");',
      "a side-effect import": 'import "@spectre-mail/storage";',
    };

    const planted: string[] = [];
    try {
      for (const packageName of SHARED_PACKAGES) {
        planted.push(packageName);
        writeFileSync(
          join(PACKAGES_DIR, packageName, "__storage-import-probe.ts"),
          forms["a named import"],
          "utf8",
        );
      }

      // **Every import form, one at a time, in `packages/core`**, for the reason the
      // framework rule's comment records: that rule originally missed a bare
      // side-effect `import "x";` and its single control used the form the author
      // happened to pick. One assertion per form, not one for the idea, and the loop
      // does not stop at the first failure.
      //
      // **Filtered by `packages/core`'s path, not by the file name alone** — every
      // shared package holds a probe by then, and a filename filter would satisfy a
      // form the rule genuinely missed with an unrelated package's violation. Falsifying
      // this change found exactly that: narrowing the rule's pattern to
      // `from "…"` left the suite **green**.
      const path = join(PACKAGES_DIR, "core", "__storage-import-probe.ts");
      for (const [name, source] of Object.entries(forms)) {
        writeFileSync(path, source, "utf8");
        expect(
          storageImportViolations().filter((hit) =>
            hit.startsWith(`packages/core/__storage-import-probe.ts`),
          ),
          `${name} should be caught`,
        ).not.toEqual([]);
      }
      writeFileSync(path, forms["a named import"], "utf8");

      // **Transcribed, not derived from the allowance constant** — for the reason the
      // storage-API rule above gives. Deriving the expectation out of the thing under
      // test moved both sides of the comparison when the allowance was widened, and
      // the rule stopped guarding `packages/core` with the suite still green.
      const mustScan = ["core", "mail-parser", "mailbox", "providers", "ui"];

      expect([...planted].sort()).toEqual([...SHARED_PACKAGES].sort());
      expect(mustScan.length).toBe(SHARED_PACKAGES.length - 1);

      const reported = storageImportViolations().filter((hit) =>
        hit.includes("__storage-import-probe.ts"),
      );

      expect(reported.length, `the rule should report all ${mustScan.length} packages`).toBe(
        mustScan.length,
      );
      expect(
        reported.map((hit) => hit.split("/__storage-import-probe")[0]?.split("/").pop()),
        "the rule should report each expected package once",
      ).toEqual(mustScan);
    } finally {
      for (const packageName of planted) {
        rmSync(join(PACKAGES_DIR, packageName, "__storage-import-probe.ts"), { force: true });
      }
    }

    // **The rule itself**, and the allowance it carries: `packages/storage` is the one
    // package excluded, and it is excluded by name — the probe planted in it above was
    // planted by the same loop and is *not* among the packages reported, which is the
    // allowance being load-bearing rather than merely present.
    //
    // The negative half is a comparison rather than an expectation of no hits, because
    // `packages/storage` does legitimately name its own specifier in prose — which is
    // why the scan strips comments before matching. A client importing this layer is
    // the intended use and `apps/*` is not scanned at all.
    expect(storageImportViolations()).toEqual([]);
  });

  it("keeps storage, cookies, and the URL out of every client", () => {
    // The other half of the requirement the sibling rule above already covers for
    // shared packages, and it exists because the website became the first client with
    // something to persist.
    //
    // **`spectre-storage` says "no client and no shared package".** Until this change
    // only the second half was enforced, and the rule that enforced it was correct
    // about what it scanned. The requirement was simply broader than its check — the
    // nineteenth shape of that defect in this repository, and the first where the
    // obvious fix was to *narrow the requirement* until it matched. That fix is not
    // made; `packages/storage/src/browser.ts` records why in the module a reader of the
    // entry point will actually open.
    //
    // **Same one-call-site design as the shared-package rule, for the same structural
    // reason.** This assertion is negative, so a rule that scanned nothing would
    // satisfy it — and `apps/extension` has no source files today, so a rule quietly
    // covering only `apps/web` would look identical from here until M8 writes the
    // extension. A probe planted in every client the rule must scan is what makes the
    // negative assertion mean something.
    const mustScan = ["web", "extension"];

    // Preconditions, transcribed rather than derived. Deriving the expected list from
    // the thing under test moved both sides of the comparison in the sibling rule's
    // falsification pass, and the rule stopped guarding a package with the suite still
    // green.
    for (const app of mustScan) {
      expect(() => statSync(join(APPS_DIR, app)), `apps/${app} should exist`).not.toThrow();
    }

    const planted: string[] = [];
    try {
      for (const app of mustScan) {
        planted.push(app);
        // **At the app root, not under `src/`**, because `apps/extension` has no `src`
        // directory and creating one to hold a probe would leave the workspace shaped by
        // a test. `collectSourceFiles` walks recursively, so its position does not
        // matter — and that is worth stating, because a probe's placement is the usual
        // reason a scan silently misses it.
        writeFileSync(
          join(APPS_DIR, app, "__client-storage-probe.ts"),
          CLIENT_STORAGE_PROBE,
          "utf8",
        );
      }

      const reported = clientStorageApiViolations().filter((hit) =>
        hit.includes("__client-storage-probe.ts"),
      );

      // **By name, not only as a count** — a count is satisfied by reporting one app
      // twice, and the platform would never do that, but the assertion should not depend
      // on that.
      //
      // **Sorted on both sides, and the sort is not a weakening.** Directory iteration
      // order put `extension` before `web` on the first run, which failed an otherwise
      // correct rule for a reason that has nothing to do with it. Sorting two
      // transcribed literals leaves the claim intact — *these exact apps, each once* —
      // where comparing in walk order would only be testing `readdirSync`.
      expect(
        reported.map((hit) => hit.split("/__client-storage-probe")[0]?.split("/").pop()).sort(),
        "the rule should report each client that must be scanned",
      ).toEqual([...mustScan].sort());
      expect(reported).toHaveLength(mustScan.length);

      // **The exemption itself, planted in every client and asserted by name.** A
      // widening is only safe if the thing it now permits is load-bearing on real code,
      // and only meaningful if permitting it is asserted rather than assumed. Both
      // spellings are planted, because `isTestFile` covers two and a control for one
      // would leave the other unguarded.
      //
      // **Two probes, adjacent, opposite outcomes.** This is the half that makes the
      // exemption a rule rather than a hole: `__exempt.spec.ts` and `__exempt.test.ts`
      // must go unreported while `__client-storage-probe.ts` beside them is reported. An
      // exemption widened to "skip anything in this directory", or to "skip anything",
      // satisfies both unreported assertions and fails the reported one.
      for (const app of mustScan) {
        for (const kind of ["spec", "test"]) {
          writeFileSync(join(APPS_DIR, app, `__exempt.${kind}.ts`), CLIENT_STORAGE_PROBE, "utf8");
        }
      }

      const exemptions = clientStorageApiViolations().filter((hit) => hit.includes("__exempt."));
      expect(
        exemptions,
        "a test may reach a store in order to verify it, and the shipped browser specs do",
      ).toEqual([]);
    } finally {
      for (const app of planted) {
        rmSync(join(APPS_DIR, app, "__client-storage-probe.ts"), { force: true });
        for (const kind of ["spec", "test"]) {
          rmSync(join(APPS_DIR, app, `__exempt.${kind}.ts`), { force: true });
        }
      }
    }

    // **The rule itself.** `apps/web/src/Address.tsx` copies a mailbox address through
    // `navigator.clipboard`, which is required behaviour and not a store — so this line
    // passing is also the carve-out being load-bearing on real shipped code rather than
    // only on a fixture.
    expect(clientStorageApiViolations()).toEqual([]);
  });

  it("catches a platform store or the URL in a client, in every spelling but the clipboard", () => {
    // One assertion per form, through the rule's own scan, and one **negative** control
    // for the carve-out. A carve-out asserted only by its absence leaves the pattern
    // free to exclude all of `navigator` and still pass the pair below — which is the
    // failure mode the sibling rules record three times over.
    const caught = {
      localStorage: "export const x = localStorage.length;",
      sessionStorage: "export const x = sessionStorage.length;",
      cookies: "export const x = document.cookie;",
      url: "export const x = location.href;",
      /** **Not the clipboard.** The single member the pattern excludes, checked against
       * its nearest neighbour so the exclusion cannot spread. */
      "navigator storage": "export const x = navigator.storage;",
      "navigator user agent": "export const x = navigator.userAgent;",
      indexedDB: CLIENT_STORAGE_PROBE,
    };

    const path = join(APPS_DIR, "web", "__client-storage-form-probe.ts");
    try {
      for (const [name, source] of Object.entries(caught)) {
        writeFileSync(path, source, "utf8");
        // **Filtered by `apps/web`'s path, not by file name alone.** Every client holds
        // a probe from the rule test above, and a name filter would satisfy a form the
        // rule genuinely missed with the other client's violation — the exact defect the
        // shared-package controls were rewritten for.
        expect(
          clientStorageApiViolations().filter((hit) =>
            hit.startsWith("apps/web/__client-storage-form-probe.ts"),
          ),
          `${name} should be caught in apps/web`,
        ).not.toEqual([]);
      }

      // **The carve-out, stated as a positive claim about what is allowed.** The
      // website's own copy control is this spelling, so it is not a fixture: if the
      // lookahead were broken, `clientStorageApiViolations()` would report
      // `Address.tsx` and the rule test above would fail — but a test that can only
      // catch that by breaking the whole suite is not a test of the carve-out.
      writeFileSync(path, "export const x = navigator.clipboard.writeText('a');", "utf8");
      expect(
        clientStorageApiViolations().filter((hit) =>
          hit.startsWith("apps/web/__client-storage-form-probe.ts"),
        ),
        "the clipboard is not a store",
      ).toEqual([]);
    } finally {
      rmSync(path, { force: true });
    }
  });

  it("stays quiet on the word framework in a comment", () => {
    // The negative control for the rule above, and the reason this file has a
    // comment-stripping helper at all. `packages/mailbox`'s own module
    // documentation explains at length what it does not depend on, and the first
    // version of the rule read raw text and fired on exactly that. A rule that
    // cannot tell a declaration from a comment about that declaration is measuring
    // the wrong thing - which has happened three times in this repository.
    const scanned = stripComments(join(PACKAGES_DIR, "mailbox", "src", "session.ts"));

    // The comment stripped above certainly names React; the stripped source must not.
    expect(readFileSync(join(PACKAGES_DIR, "mailbox", "src", "session.ts"), "utf8")).toMatch(
      /react/i,
    );
    expect(scanned).not.toMatch(/react/i);
  });

  it("keeps a clock and a timer out of the mailbox session layer", () => {
    // **The rule the compiler cannot enforce, and the one the seam exists for.**
    // `MailboxScheduler` is why this package can poll at all without holding a timer,
    // so a module quietly reaching for `setTimeout` would mean the seam had become
    // decorative — and a test that waits a real 30 seconds would then be the only
    // thing still proving the cadence.
    //
    // The stated limit, stated here rather than left for a reader to assume: this
    // matches spellings, not aliases. A module that took a timer as a parameter, or
    // read one off `globalThis["setTimeout"]`, would pass. So would a `Date` reached
    // through a destructured name. It is a backstop over the forms a careless
    // implementation actually takes, and the seam — not this scan — is the guarantee.
    const violations = clockViolationsWithIntroducedModule("export const ok = 1;\n");
    expect(violations).toEqual([]);
  });

  it("catches a clock global in every spelling, not only the obvious one", () => {
    // **One control per spelling, which is the whole point of the list.** The first
    // four times a rule in this repository stayed green while guarding nothing, the
    // cause was a single pattern checked by a single control exercising the form its
    // author happened to think of. `setTimeout` is the spelling an author would think
    // of; the other six are the ones that get missed.
    const forms = {
      "Date.now": "export const x = Date.now();",
      "Date.parse": 'export const x = Date.parse("2026-10-02T12:00:00Z");',
      "new Date": "export const x = new Date();",
      "performance.now": "export const x = performance.now();",
      setTimeout: "export const x = setTimeout(() => {}, 10);",
      setInterval: "export const x = setInterval(() => {}, 10);",
      setImmediate: "export const x = setImmediate(() => {});",
      // The negative half: a parameter named `setTimeout` and a local named `Date`
      // are ordinary code, and a rule that fires on them gets disabled within a week.
      "a parameter of the same name":
        "export function f(setTimeout: number) { return setTimeout; }",
      "a local binding of the same name": "export const f = (Date: number) => Date + 1;",
      "Date.UTC, which reads no clock": "export const x = Date.UTC(2026, 9, 2);",
    };

    for (const [name, source] of Object.entries(forms)) {
      const violations = clockViolationsWithIntroducedModule(source);
      const shouldFire = ![
        "a parameter of the same name",
        "a local binding of the same name",
        "Date.UTC, which reads no clock",
      ].includes(name);

      if (shouldFire) {
        expect(violations.length, `${name} should be caught`).toBeGreaterThan(0);
      } else {
        expect(violations, `${name} should not be caught`).toEqual([]);
      }
    }
  });

  it("reaches the mail parser through one direction only", () => {
    // `packages/mailbox` is the parser's only caller in this repository. A client
    // that imported it directly could re-parse on every render, undoing the
    // once-per-message requirement from the one place nothing would police.
    expect(parserDirectionViolations()).toEqual([]);
  });

  it("catches a client importing the mail parser directly", () => {
    // The positive control for the rule above, and the form the rule exists for:
    // the violation is not in a shared package at all, it is in `apps/web`, which
    // every package-only scan in this file would have missed.
    const probePath = join(APPS_DIR, "web", "__parser-direction-probe.ts");

    try {
      writeFileSync(
        probePath,
        'import { analyseMessage } from "@spectre-mail/mail-parser";\n',
        "utf8",
      );
      expect(parserDirectionViolations()).not.toEqual([]);
    } finally {
      rmSync(probePath, { force: true });
    }

    // And the probe really is gone, or the rule above would now be failing for a
    // reason that has nothing to do with the implementation.
    expect(parserDirectionViolations()).toEqual([]);
  });

  it("still allows the mailbox layer itself to import the parser", () => {
    // The other half of the direction rule: a rule that forbade the parser anywhere
    // would pass every assertion above while making the real implementation
    // impossible. So the permitted caller is asserted positively, not left implicit.
    const contents = stripComments(
      readFileSync(join(PACKAGES_DIR, "mailbox", "src", "inbox.ts"), "utf8"),
    );
    expect(findPatternOccurrences(contents, PARSER_SPECIFIER_PATTERN).length).toBeGreaterThan(0);
  });

  it("keeps the DOM lib out of the mailbox session layer's compiler, and the DOM out of its globals", () => {
    // Two halves of one claim, and **only the first is the compiler's.** The second
    // is measured here because a runtime claim needs a runtime check.
    //
    // `globalThis.document` does not compile in `packages/mailbox` - the package's
    // `tsconfig` has no `DOM` lib, so naming it is a type error - which is exactly
    // why the globals are read through `Reflect.get` below: writing `globalThis.window`
    // in this file to prove it is undefined would not compile here either. The
    // workaround is `Reflect.get`, and it is called out here because it would
    // otherwise read as a strange way to spell a property access.
    const tsconfig = JSON.parse(
      readFileSync(join(PACKAGES_DIR, "mailbox", "tsconfig.json"), "utf8"),
    ) as { compilerOptions?: { lib?: readonly string[] } };

    expect(tsconfig.compilerOptions?.lib).toEqual(["ES2023"]);
    expect(tsconfig.compilerOptions?.lib ?? []).not.toContain("DOM");

    // Vitest's own environment is `node`, which has no DOM — but that is the test
    // runner's environment, not this package's. Asserting on it states what was
    // actually observed and where.
    for (const name of ["window", "document", "location"]) {
      expect(Reflect.get(globalThis, name), `${name} should be absent here`).toBeUndefined();
    }

    // And the check above can fail: a global that really is present must be found by
    // the same read, or "absent" would be a property of `Reflect.get` rather than of
    // the environment.
    expect(Reflect.get(globalThis, "globalThis")).toBe(globalThis);
  });

  it("keeps a markup escape hatch out of every client", () => {
    // An address, a subject, and a message body are all provider-supplied strings.
    // Rendering one as markup is how a mailbox becomes an injection vector, and it
    // is the one thing `website-client` forbids outright.
    //
    // Comments are stripped, for the reason given above: `apps/web/src/Address.tsx`
    // documents *why* it has no escape hatch, by name, and the first version of this
    // rule fired on that sentence. Fixed by stripping, not by rewording - rewording
    // would have deleted the explanation the next reader needs.
    const violations: string[] = [];

    for (const file of collectSourceFiles(APPS_DIR)) {
      const contents = stripComments(readFileSync(file, "utf8"));
      for (const hit of findPatternOccurrences(contents, MARKUP_ESCAPE_PATTERN)) {
        violations.push(`${toRepoPath(file)} ${hit} (renders untrusted content as markup)`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("catches every form of markup escape hatch introduced into a client file", () => {
    // **This rule had no control at all until slice 3, and slice 3 is the slice that
    // made it load-bearing.** `MessageView.tsx` is the first component whose entire job
    // is rendering a provider-supplied body, and this rule is what stands between that
    // body and `dangerouslySetInnerHTML`. A rule nobody has ever watched fire is a rule
    // whose pattern may match nothing at all — and that is not a hypothetical in this
    // file: the framework rule below was narrower than its name for its whole life, and
    // the fetch rule did not follow the polling loop into a package it claimed to cover.
    //
    // **One control per form, because the pattern names five.** A single control proves
    // the form its author happened to pick; the other four are the ones that would have
    // been silently uncovered. `insertAdjacentHTML` and `document.write` are here for
    // the stated reason — a client using either would have the same problem as
    // `dangerouslySetInnerHTML` while looking nothing like it.
    for (const [name, source] of [
      ["dangerouslySetInnerHTML", "<div dangerouslySetInnerHTML={{ __html: body }} />"],
      ["an innerHTML assignment", "node.innerHTML = body;"],
      ["an outerHTML assignment", "node.outerHTML = body;"],
      ["insertAdjacentHTML", 'node.insertAdjacentHTML("beforeend", body);'],
      ["document.write", "document.write(body);"],
    ]) {
      expect(
        clientViolationsWithIntroducedModule(source, occurrencesOf(MARKUP_ESCAPE_PATTERN)),
        `${name} in a client should be caught`,
      ).not.toEqual([]);
    }
  });

  it("stays quiet on a client that documents the escape hatch it does not use", () => {
    // **The other half, and the reason `stripComments` exists.** A rule that fires on
    // its own documentation is measuring the wrong thing, and the fix is always to
    // strip comments rather than to reword until the rule goes quiet — rewording
    // deletes the explanation the next reader needs. `MessageView.tsx` names
    // `dangerouslySetInnerHTML` in its module note for exactly this reason, and this
    // control is what proves that sentence is not itself a violation.
    expect(
      clientViolationsWithIntroducedModule(
        MARKUP_PROBE_DOCUMENTATION,
        occurrencesOf(MARKUP_ESCAPE_PATTERN),
      ),
    ).toEqual([]);
  });

  it("keeps acting on a message's findings out of every client", () => {
    // `website-client`'s fourth requirement for this slice: the page displays what it
    // found and acts on neither. Copying a one-time code and following a verification
    // link are the verification workflow, which `docs/ROADMAP.md` schedules at M10.
    //
    // **Both patterns in one assertion, deliberately.** Two rules with two controls
    // could each drift while staying green; one assertion over the pair says what the
    // milestone actually promises, which is that neither is reachable.
    const violations = [
      ...clientViolationsWithIntroducedModule(MESSAGE_VIEW, findCodeClipboardWrites),
      ...clientViolationsWithIntroducedModule(
        MESSAGE_VIEW,
        occurrencesOf(DETECTED_LINK_HREF_PATTERN),
      ),
    ];

    expect(violations).toEqual([]);
  });

  it("catches a client copying a one-time code, in every form", () => {
    const uncaught: string[] = [];
    for (const [name, source] of [
      ["a navigator.clipboard write", "await navigator.clipboard.writeText(code.value);"],
      ["a bare writeText", "await clipboard.writeText(code);"],
      [
        "a rich clipboard write",
        "const otpCode = found.value;\nawait navigator.clipboard.write([new ClipboardItem({ plain: otpCode })]);",
      ],
      [
        "a ClipboardItem built for another sink",
        "const verificationCode = found.value;\nkeep.push(new ClipboardItem({ plain: verificationCode }));",
      ],
      [
        "a suffix spelling of code",
        "const oneTimeCode = found.value;\nawait clipboard.writeText(oneTimeCode);",
      ],
      [
        "execCommand over a selected code",
        'node.focus();\nconst code = found.value;\ndocument.execCommand("copy");',
      ],
    ]) {
      // **Every missed form is reported, not just the first.** A loop of
      // `expect(...).not.toEqual([])` per form stops at the first failure, so a rule
      // broken in three ways produces one name and proves nothing about the other two.
      // That is the same defect this file has recorded twice - a control that cannot
      // report its own failure - and it is why the missed forms are gathered and
      // asserted empty as a set. Running the rule with its last two call families and
      // its widened word pattern reverted turns all three new forms red here at once,
      // which is the observation recorded alongside this test.
      const missed = clientViolationsWithIntroducedModule(source, findCodeClipboardWrites);
      if (missed.length === 0) uncaught.push(name);
    }

    expect(uncaught).toEqual([]);
  });

  it("leaves copying the mailbox address alone, because the roadmap requires it", () => {
    // **The negative control, and the reason the rule is scoped the way it is.**
    // `apps/web/src/Address.tsx` copies the address, and "receive a working address …
    // use it externally" is not possible without it. The first version of the rule
    // forbade every clipboard write and failed here; narrowing it to codes is the fix,
    // and this control is what stops a later reader from re-widening it.
    expect(
      clientViolationsWithIntroducedModule(
        "await navigator.clipboard.writeText(mailbox.address);",
        findCodeClipboardWrites,
      ),
    ).toEqual([]);
    // And the real file, not only a probe shaped like it.
    expect(clientViolationsWithIntroducedModule(MESSAGE_VIEW, findCodeClipboardWrites)).toEqual([]);
  });

  it("keeps a remote origin and a removed focus indicator out of a shipped stylesheet", () => {
    /**
     * One assertion, one scan, four forms planted per rule.
     *
     * The shape is the one M6 slice 1's rules were driven to, and for the same reason: a
     * rule whose assertion is *negative* — no stylesheet may reach an origin — can be
     * satisfied by narrowing its own file list, its pattern, or its scan loop, because
     * every package it stopped scanning happens to be clean. So the planted probes come
     * **first**, through the **same** `stylesheetViolations()` call the real tree is read
     * with, and the tree's silence is only claimed afterwards.
     */
    const probeDir = join(APPS_DIR, "web", "src");
    const probe = join(probeDir, "__boundary-probe.css");
    /** Where a planted remote origin went, so the finding can be checked by identity. */
    const probeContent = [
      /* A comment describing the import below. Comments must not be able to satisfy — or
         trip — the rule, which is why every pattern reads the comment-stripped source. */
      '/* @import url("https://example.invalid/fonts.css"); */',
      '@import url("https://fonts.example.invalid/geist.css");',
      '@import "https://fonts.example.invalid/inter.css";',
      "body { background: url(https://cdn.example.invalid/pixel.png); }",
      'body { background: url("//cdn.example.invalid/pixel.png"); }',
      ".a { outline: none; }",
      ".b { outline: 0; }",
      ".c { outline-width: 0; }",
      ".d { color: var(--ink-primary); }",
      ".e { color: var(--colour-primary); }",
    ].join("\n");

    try {
      writeFileSync(probe, probeContent, "utf8");

      const violations = stylesheetViolations();

      // ── Every form of the remote-origin rule, by its own label. ───────────────────
      // Four forms rather than one, because a CSS author has four ways to name the same
      // URL and this milestone's whole point is that a CDN webfont must not ship.
      expect(countMatching(violations, "@import of a URL")).toBe(1);
      expect(countMatching(violations, "@import of a bare string")).toBe(1);
      // `url()` matches the https form and the protocol-relative form — two probes, two
      // hits — and a rule that matched only one would report one.
      expect(countMatching(violations, "url() pointing at an origin")).toBe(2);

      // ── Every form of the focus-suppression rule. ─────────────────────────────────
      expect(countMatching(violations, "outline removed")).toBe(2);
      expect(countMatching(violations, "outline width removed")).toBe(1);

      // ── The undeclared custom property, and the declared one beside it. ───────────
      // The control is the second declaration: a rule that flagged every `var()` would
      // report `--ink-primary` too, so the assertion below is on the *count* of
      // unresolved reads and not merely on the probe being present.
      expect(countMatching(violations, UNRESOLVED_TOKEN_LABEL)).toBe(1);
      expect(violations.some((v) => v.includes("--colour-primary"))).toBe(true);
      expect(violations.some((v) => v.includes("--ink-primary"))).toBe(false);

      // ── And the finding names the file, so a reader knows where to open. ───────────
      expect(violations.some((v) => v.includes("__boundary-probe.css"))).toBe(true);

      // ── The comment on the probe's first line must not have counted. ───────────────
      // The probe opens with an `@import url("https://…")` written **inside a comment**.
      // If comments were not stripped, that line would produce a second finding with the
      // same label and the count above would be 2 instead of 1 — so this asserts on the
      // line the finding names, not on a total the earlier assertion already checked.
      // Restating the count here would have been an assertion that could not fail.
      const importUrlFindings = violations.filter((v) => v.includes("(@import of a URL)"));
      expect(importUrlFindings).toHaveLength(1);
      expect(importUrlFindings[0]).toContain("line 2");
      expect(importUrlFindings[0]).not.toContain("line 1");
    } finally {
      rmSync(probe, { force: true });
    }

    // ── The negative half, through the same call site. ─────────────────────────────
    // The probe is gone, so the shipped stylesheets are the only input left. A rule that
    // reported nothing here because it stopped looking would be indistinguishable from
    // one that found nothing, which is exactly the distinction the planted probes above
    // exist to prevent.
    expect(stylesheetViolations()).toEqual([]);
  });

  it("keeps a remote asset out of the client's own markup", () => {
    /**
     * A separate assertion rather than a fourth form of the one above, because this is a
     * genuinely different job: the CSS rules read `**\/*.css` and **cannot see an HTML
     * document**, and a `<link href="https://fonts…">` in `index.html` reaches the same
     * third party the `@import` rules forbid. Folding it in would produce one rule that
     * appears to cover both and in fact covers neither.
     */
    const document = join(APPS_DIR, "web", "index.html");
    const original = readFileSync(document, "utf8");

    try {
      for (const attribute of ["src", "href"]) {
        writeFileSync(
          document,
          original.replace(
            '<div id="root"></div>',
            `<link ${attribute}="https://fonts.example.invalid/geist.css" /><div id="root"></div>`,
          ),
          "utf8",
        );

        const violations = stylesheetViolations();
        expect(countMatching(violations, "a remote asset in markup")).toBe(1);
        expect(violations.some((v) => v.includes("index.html"))).toBe(true);
      }

      // Protocol-relative and plain `http`, which are the same request as `https`.
      writeFileSync(
        document,
        original.replace(
          '<div id="root"></div>',
          '<link href="//fonts.example.invalid/geist.css" /><div id="root"></div>',
        ),
        "utf8",
      );
      expect(countMatching(stylesheetViolations(), "a remote asset in markup")).toBe(1);
    } finally {
      writeFileSync(document, original, "utf8");
    }

    // The real document names no origin. Measured rather than assumed — and it is the
    // half that would otherwise go unrecorded, because a rule with no violation is
    // indistinguishable from a rule that was never run.
    expect(stylesheetViolations()).toEqual([]);
  });

  it("uses every class hook a client renders", () => {
    /**
     * The direction that matters, with a probe that proves the direction.
     *
     * A rule that asked only "does every class in the stylesheet exist in the markup?"
     * would pass on a stylesheet full of dead rules and would say nothing about the
     * failure that actually happens — a hook added to a component, and never styled. So
     * the planted probe is an **unstyled** hook, and the control beside it is a styled one
     * whose name is a **prefix** of another class in the stylesheet.
     *
     * That prefix is the whole reason the selector match uses a negative lookahead rather
     * than `includes`. `.inbox-rows` contains `.inbox-row` as a substring, so a check
     * written with `includes` would report a hook as styled because a *different* hook's
     * selector contains its name — and this repository's own stylesheet is full of
     * `x`/`x__y`/`x--z` triples, so it is not a hypothetical.
     */
    const probe = join(APPS_DIR, "web", "src", "__BoundaryProbe.tsx");
    const probeSource = [
      "export function Probe() {",
      "  return (",
      "    <div>",
      '      <p className="control" />',
      '      <p className="inbox-row" />',
      '      <p className="hook-never-styled" />',
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");

    /**
     * **The non-vacuity guard, and it names the shape that a pattern would have missed.**
     *
     * Every hook above the probe is a plain string literal, so the probe alone would be
     * satisfied by a collector that only understood `className="…"`. The real page's
     * hardest case is `className={CARRIES_VERIFICATION.has(verdict.kind) ? "inbox-row
     * inbox-row--carries" : "inbox-row"}` — two hooks behind a condition, neither of them
     * written where a regex would see a value. So the guard asserts that the *conditional*
     * shape was collected, by name.
     *
     * Without it, a collector that read nothing at all would pass every assertion in this
     * test, including the negative half: "no hook is unstyled" is trivially true of an
     * empty set. That is the recorded failure mode for a negative rule, and it is the
     * reason the positive half is asserted first and through the same function.
     */
    const collected = clientClassHooks().flatMap((entry) => entry.hooks);
    expect(collected.length).toBeGreaterThan(0);
    expect(collected).toContain("inbox-row--carries");
    expect(collected).toContain("notice--danger");

    try {
      writeFileSync(probe, probeSource, "utf8");

      const violations = unstyledClassHooks();

      // The unstyled hook, named — so a rule that reported nothing for a different reason
      // cannot be mistaken for a rule that found nothing.
      const unstyled = violations.filter((violation) => violation.includes("hook-never-styled"));
      expect(unstyled).toHaveLength(1);
      expect(unstyled[0]).toContain("__BoundaryProbe.tsx");

      // **And the two beside it, which are styled.** `.control` is a real selector;
      // `.inbox-row` is satisfied only because the lookahead stops `.inbox-rows` from
      // answering for it.
      expect(violations.some((violation) => violation.includes('"control"'))).toBe(false);
      expect(violations.some((violation) => violation.includes('"inbox-row"'))).toBe(false);
    } finally {
      rmSync(probe, { force: true });
    }

    // The shipped page, read the same way.
    expect(unstyledClassHooks()).toEqual([]);
  });

  it("resolves a custom property read against a declaration above it in the same file", () => {
    /**
     * The local-declaration half of the rule, and the one a naive implementation drops.
     *
     * A read must resolve against `:root` **or** against a declaration earlier in its
     * own file. A resolver that consulted only the token layer would report a legitimate
     * locally-declared variable as undeclared, and a resolver that consulted every
     * stylesheet for every read would accept a typo'd read in one file because an
     * unrelated file declares the name — so both directions are checked here, in the same
     * file, with the ordering that makes them different.
     */
    const probeDir = join(APPS_DIR, "web", "src");
    const probe = join(probeDir, "__boundary-local-token.css");
    const probeContent = [
      /* Declared here, below, so this read must be reported: CSS is order-dependent
         within a file and this is the case that proves the rule is order-sensitive. */
      ".late { color: var(--declared-below); }",
      ".local { --declared-here: 1rem; }",
      ".use { padding: var(--declared-here); }",
      ".global { color: var(--ink-primary); }",
    ].join("\n");

    try {
      writeFileSync(probe, probeContent, "utf8");

      const unresolved = stylesheetViolations().filter((v) =>
        v.includes(`(${UNRESOLVED_TOKEN_LABEL})`),
      );

      // Two of the four reads are satisfied: one by the token layer, one by the local
      // declaration above it. Two are reported: the undeclared name, and the one read
      // *before* its local declaration.
      expect(unresolved.filter((v) => v.includes("--declared-below"))).toHaveLength(1);
      expect(unresolved.some((v) => v.includes("--declared-here"))).toBe(false);
      expect(unresolved.some((v) => v.includes("--ink-primary"))).toBe(false);
      expect(unresolved).toHaveLength(1);
    } finally {
      rmSync(probe, { force: true });
    }

    expect(stylesheetViolations()).toEqual([]);
  });

  it("catches a detected link rendered as an anchor, in every form", () => {
    const uncaught: string[] = [];
    for (const [name, source] of [
      ["a VerificationLink url", "<a href={link.url}>Verify</a>"],
      ["a summary href", "<a href={message.href}>Open</a>"],
      ["an expression reaching a url", "<a href={base + link.url}>Verify</a>"],
    ]) {
      // Gathered rather than asserted inside the loop, for the reason the clipboard
      // controls above give: a per-form assertion stops at the first failure, so it
      // cannot report that a second form is also uncaught.
      const missed = clientViolationsWithIntroducedModule(
        source,
        occurrencesOf(DETECTED_LINK_HREF_PATTERN),
      );
      if (missed.length === 0) uncaught.push(name);
    }

    expect(uncaught).toEqual([]);
  });

  it("collects every test this repository ships, rather than skipping them", () => {
    // The root Vitest `include` globs `apps/` as of M5 slice 1, and before it did
    // not. An app test placed under a glob that is not listed is **silently
    // skipped** - and a skipped test reads as covered. That is the exact failure the
    // package-shaped package glob was designed to prevent, reintroduced one
    // directory over.
    //
    // **This originally resolved `apps/` only, which left the same hole open one
    // level down.** Deleting `"packages/*/src/**/*.test.ts"` from the config dropped
    // the suite from 365 tests to 40 with a green exit: every one of `mailbox`'s 33,
    // and all of `core`, `providers`, and `mail-parser`, silently stopped running.
    // `passWithNoTests: false` did not help, because three files still ran. A rule
    // named for the client's own tests that only checked the client's own tests
    // reads as general and is not - the same defect class as the framework rule
    // above, one scope narrower than its name.
    //
    // This resolves the configured globs against the real test files rather than
    // asserting that a literal string is present. Narrowing a glob, deleting an
    // entry, or moving a test file each break it; a comment saying the entry is
    // there breaks none of them.
    const config = readFileSync(join(REPO_ROOT, "vitest.config.ts"), "utf8");
    const includeBlock = config.match(/include:\s*\[([^\]]*)\]/);
    expect(includeBlock).not.toBeNull();

    const patterns = [...(includeBlock?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (match) => match[1] as string,
    );
    expect(patterns.length).toBeGreaterThan(0);

    const matchers = patterns.map(toRepoPattern);

    // **Both** roots, not just the apps. `packages/` is where 33 of this change's
    // tests live, and an unchecked package glob is the silent-skip failure this rule
    // exists to catch - in the one directory the rule did not look at.
    const shippedTests = [
      ...collectSourceFiles(PACKAGES_DIR),
      ...collectSourceFiles(APPS_DIR),
    ].filter((file) => /\.test\.tsx?$/.test(file));

    // A precondition, so the assertions below cannot pass vacuously by finding no
    // files at all.
    expect(shippedTests.length).toBeGreaterThan(0);

    // And a precondition on the **spread**: a rule that only ever looked at one root
    // must not be able to satisfy this by finding one. `mailbox` is the package this
    // change added and `web` the client it reached, so their absence from the list is
    // exactly the regression being asserted against.
    const paths = shippedTests.map((file) => toRepoPath(file));
    expect(paths.filter((path) => path.startsWith("packages/mailbox/"))).not.toHaveLength(0);
    expect(paths.filter((path) => path.startsWith("apps/web/"))).not.toHaveLength(0);

    const uncovered = shippedTests
      .filter((file) => !matchers.some((matcher) => matcher.test(toRepoPath(file))))
      .map((file) => toRepoPath(file));

    expect(uncovered).toEqual([]);
  });

  it("collects every browser spec, and never as a unit test", () => {
    // ## Why this rule exists
    //
    // **The rule above watches `*.test.tsx?`, which is exactly the spelling a browser
    // spec does not use.** `browser-verification` added `apps/web/e2e/storage.spec.ts`
    // and the coverage rule could not see it — a test no runner collects reads as
    // coverage while verifying nothing, which is the same defect as a test that cannot
    // fail. This is the failure M5 slice 1 was bitten by when a client test was silently
    // skipped, arriving through a different door.
    //
    // ## Why the suite's configuration is read rather than assumed
    //
    // **Because the alternative cannot observe the thing this exists to catch.** A rule
    // asserting that specs sit under a hard-coded `apps/web/e2e` would pass unchanged
    // after someone narrowed `playwright.config.ts`'s `testDir` to an empty directory —
    // and the suite would then collect nothing while the rule stayed green. Narrowing the
    // configuration has to break something, or this rule is decoration. So the config is
    // parsed, and one that cannot be parsed reports rather than skips.
    //
    // ## Why a spec must also not be a unit test
    //
    // Two tiers execute different code against different platforms. One runner
    // collecting both would let a browser-free `pnpm test` report as covering a browser
    // suite — and `pnpm verify` is required by `build-and-verification` to run without a
    // browser installed, so that is not hypothetical.
    const suites = browserSuites();

    // Preconditions, so nothing below can pass by finding nothing.
    expect(suites.length).toBeGreaterThan(0);
    const shippedSpecs = collectSourceFiles(REPO_ROOT)
      .filter((file) => /\.spec\.tsx?$/.test(file))
      .map((file) => toRepoPath(file));
    expect(shippedSpecs.filter((path) => path.startsWith("apps/web/"))).not.toHaveLength(0);

    // **The negative control, planted where no discovered `testDir` reaches it.** A spec
    // nobody collects *is* the defect, so it is produced here and required to be reported
    // by name. Without it, the rule's own assertion below would be satisfied by a rule
    // that had stopped looking at all — which is the mistake this file records three
    // times over at slice 1.
    const orphan = join(APPS_DIR, "web", "__uncovered.spec.ts");
    try {
      writeFileSync(orphan, "export const probe = 1;\n", "utf8");
      expect(
        browserSpecViolations(suites).filter((hit) =>
          hit.startsWith("apps/web/__uncovered.spec.ts"),
        ),
        "a browser spec no suite collects should be named",
      ).not.toEqual([]);
    } finally {
      rmSync(orphan, { force: true });
    }

    // **The rule itself**, over every spec in the repository.
    expect(browserSpecViolations(suites)).toEqual([]);

    // **And the other half: the unit runner must not claim them.**
    const unitConfig = readFileSync(join(REPO_ROOT, "vitest.config.ts"), "utf8");
    const unitBlock = unitConfig.match(/include:\s*\[([^\]]*)\]/);
    expect(unitBlock).not.toBeNull();
    const unitMatchers = [...(unitBlock?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) =>
      toRepoPattern(match[1] as string),
    );
    expect(unitMatchers.length).toBeGreaterThan(0);
    expect(
      shippedSpecs.filter((path) => unitMatchers.some((matcher) => matcher.test(path))),
      "a browser spec must not be collected as a unit test",
    ).toEqual([]);
  });

  it("confines provider adapters to packages/providers", () => {
    const providersDir = join(PACKAGES_DIR, "providers");
    const violations: string[] = [];

    // Scanned across the whole repository, not just `packages/` and `apps/`.
    // The M1 verification pass proved the narrower scope was escapable: a
    // root-level module and a module under `tests/` could both name an adapter
    // and the test still passed. The requirement is that *no file outside the
    // package* references one.
    //
    // **Comments are stripped first.** They were not, at M3, and the rule fired on
    // its own code: `packages/mailbox`'s explanation of what it deliberately does
    // not do named `createProviderManager`, and the suite went red on a sentence
    // rather than on a declaration. That is the third time in this repository a
    // check has fired on its own documentation, and it is fixed by teaching the
    // rule to tell a declaration from a comment about that declaration — not by
    // rewording the documentation until the rule went quiet. Rewording would have
    // deleted the reason the reader needed.
    for (const file of collectSourceFiles(REPO_ROOT)) {
      if (file.startsWith(providersDir)) continue;

      // This file necessarily contains the identifiers as string literals.
      if (file === __filename) continue;

      const repoPath = toRepoPath(file);
      const contents = stripComments(readFileSync(file, "utf8"));
      const seamAllowed = PROVIDER_SEAM_ALLOWED_FILES.some((pattern) => pattern.test(repoPath));
      const adapterAllowed = PROVIDER_ADAPTER_ALLOWED_FILES.some((pattern) =>
        pattern.test(repoPath),
      );

      for (const identifier of PROVIDER_ADAPTER_IDENTIFIERS) {
        if (contents.includes(identifier) && !adapterAllowed) {
          violations.push(`${repoPath} references ${identifier}`);
        }
      }
      for (const match of contents.matchAll(PROVIDER_ADAPTER_PATTERN)) {
        // Subject to the same allowance, because this pattern cannot tell a
        // **definition** from a **call**: `const a = createGuerrillaAdapter(...)`
        // and `export const b = createGuerrillaAdapter(...)` are the same text. In
        // an allowed file, minting an adapter therefore goes unchecked here — see
        // the stated limit below.
        if (!adapterAllowed) {
          violations.push(`${repoPath} defines adapter-shaped identifier ${match[0]}`);
        }
      }

      // The composition seams are callable outside the package, but only from the
      // files whose job is to do so. See the note above for why this exists and
      // what it cannot check.
      for (const identifier of PROVIDER_COMPOSITION_SEAMS) {
        if (contents.includes(identifier) && !seamAllowed) {
          violations.push(
            `${repoPath} references ${identifier}, which is allowed only in a client's ` +
              `provider-config.ts, transport.ts, or packages/mailbox`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("makes a client's exported provider-id list the configuration it claims to be", () => {
    const configs = collectSourceFiles(APPS_DIR).filter((file) =>
      CLIENT_PROVIDER_CONFIG_FILES.test(toRepoPath(file)),
    );
    const violations: string[] = [];

    // The scan must find a client, or the rule passes vacuously on an empty list —
    // which is the ninth recorded way a check in this file can succeed for the wrong
    // reason. The collection rule below guards the same shape for tests, where a
    // client test was silently skipped and read as covered.
    expect(configs.length).toBeGreaterThan(0);

    for (const file of configs) {
      violations.push(
        ...collectUndrivenProviderConfigs(toRepoPath(file), readFileSync(file, "utf8")),
      );
    }

    expect(violations).toEqual([]);
  });

  it("catches a client whose id list is documentation beside its factory", () => {
    // The defect as it stood: the list is exported, the type union is derived from
    // it, and the factory never reads it. The two references that survive the
    // exclusion are both removed, so this must go red.
    const legacy = [
      `import { createGuerrillaAdapter, createProviderManager } from "@spectre-mail/providers";`,
      `import type { ProviderManager, Transport } from "@spectre-mail/providers";`,
      ``,
      `export const WEBSITE_PROVIDER_IDS = ["guerrilla"] as const;`,
      ``,
      `export type WebsiteProviderId = (typeof WEBSITE_PROVIDER_IDS)[number];`,
      ``,
      `export function createWebsiteProviderManager(transport: Transport): ProviderManager {`,
      `  return createProviderManager([createGuerrillaAdapter({ transport, now: () => Date.now() })]);`,
      `}`,
    ].join("\n");

    expect(collectUndrivenProviderConfigs("apps/web/src/provider-config.ts", legacy)).toEqual([
      "apps/web/src/provider-config.ts exports WEBSITE_PROVIDER_IDS but never reads it as a value",
    ]);
  });

  it("does not accept a list named only in a comment as a configuration", () => {
    // The inverse of the third time this file's checks fired on their own
    // documentation. There, a comment had to be *ignored* so prose could not fail a
    // rule. Here, prose must not be able to *satisfy* one, because a module that only
    // describes the coupling it lacks is precisely what this rule exists to catch.
    const describedButUnused = [
      `// The manager is built from WEBSITE_PROVIDER_IDS, in preference order.`,
      `export const WEBSITE_PROVIDER_IDS = ["guerrilla"] as const;`,
      ``,
      `export function createWebsiteProviderManager(): unknown {`,
      `  return "configured";`,
      `}`,
    ].join("\n");

    expect(
      collectUndrivenProviderConfigs("apps/web/src/provider-config.ts", describedButUnused),
    ).toEqual([
      "apps/web/src/provider-config.ts exports WEBSITE_PROVIDER_IDS but never reads it as a value",
    ]);
  });

  it("catches a client that reaches a provider without declaring which", () => {
    const undeclared = [
      `export function createWebsiteProviderManager(): unknown {`,
      `  return createProviderManager([]);`,
      `}`,
    ].join("\n");

    expect(collectUndrivenProviderConfigs("apps/web/src/provider-config.ts", undeclared)).toEqual([
      "apps/web/src/provider-config.ts declares no provider-id list",
    ]);
  });

  it("stays quiet on a configuration that reads its list, and on the type-only use", () => {
    // The positive control for the two exclusions. A rule that reported the
    // declaration or the `typeof` derivation would make the fix impossible to write:
    // the list has to be declared, and the id union has to come from somewhere.
    const derived = [
      `export const WEBSITE_PROVIDER_IDS = ["guerrilla"] as const;`,
      ``,
      `export type WebsiteProviderId = (typeof WEBSITE_PROVIDER_IDS)[number];`,
      ``,
      `export function createWebsiteProviderManager(): unknown {`,
      `  return createProviderManager(WEBSITE_PROVIDER_IDS.map((id) => ADAPTERS[id]()));`,
      `}`,
    ].join("\n");

    expect(collectUndrivenProviderConfigs("apps/web/src/provider-config.ts", derived)).toEqual([]);
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

  it("catches a bare fetch call introduced into the mailbox session layer too", () => {
    // **The control that was missing, and its absence was the gap.** `packages/mailbox`
    // is where the polling loop lives, and a loop is the code most likely to reach for
    // `fetch` directly. The scan did not include it, so a `fetch` introduced into
    // `inbox.ts` would have turned nothing red.
    //
    // Every form, not just the bare one, because the other two controls above proved
    // the patterns work — not that they are applied to *this* package's files.
    for (const [name, source] of [
      ["a bare call", FETCH_PROBE_MODULE],
      ["a window.fetch call", FETCH_PROBE_MODULE.replace("fetch(", "window.fetch(")],
      ["a globalThis.fetch reference", FETCH_PROBE_MODULE.replace("fetch(", "globalThis.fetch(")],
    ]) {
      expect(
        scanWithIntroducedModule("packages/mailbox", source),
        `${name} in packages/mailbox should be caught`,
      ).not.toEqual([]);
    }
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
