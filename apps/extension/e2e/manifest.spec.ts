/**
 * The manifest, checked against the extension Chromium actually loaded.
 *
 * ## The subject of this file
 *
 * Not "does `manifest.json` contain these keys" — a JSON file can be read with
 * `fs` in a Node test and the interesting part happens to be whether **Chromium
 * accepted it and granted what it declared**. So the manifest is asserted twice, by two
 * different instruments, because the two failure modes are different:
 *
 * - **As a file**, read off disk from the built `dist`.
 * - **As Chromium's own record**, read through `chrome.runtime.getManifest` **inside the
 *   worker's own context**, which is the manifest Chromium parsed rather than the one this
 *   process wrote.
 *
 * A file can satisfy the first and fail the second: a permission Chromium silently
 * refuses is still present in the JSON.
 *
 * **A first draft of this note said the second instrument was `chrome.management`, and
 * that API is not available to this extension** — reading an extension's own granted
 * permissions from inside itself has no API, which the case below now says out loud rather
 * than only in a comment beside the call. **The instrument was replaced, not the claim**, and
 * what the second instrument does establish is narrower than "what was granted": that the
 * worker is a real service worker holding the extension's own platform, and that Chromium's
 * parsed manifest agrees with the file.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { EXTENSION_DIST } from "../playwright.config";
import { FIXTURE_HTTP_ORIGIN, FIXTURE_ORIGIN } from "./helpers/in-page-fixture";
import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";
import { SCRIPTED_PROVIDER_ORIGINS } from "./recorded-provider";

/** The built extension's directory, as a path this file can read from. */
const EXTENSION_DIST_PATH = fileURLToPath(new URL(`../${EXTENSION_DIST}`, import.meta.url));

/** The client's own source tree, as a path this file can read from. */
const EXTENSION_SRC_PATH = fileURLToPath(new URL("../src", import.meta.url));

/** The justification shapes a map entry may take. Both are checked; neither is inferred. */
type EarnedBy =
  | {
      /**
       * A shipped module reaches the platform member through the one reflective read this client
       * allows itself. **Never the `chrome.<name>` member expression**, which this repository's own
       * boundary rule forbids across `apps/` — measured: after comments are stripped, that spelling
       * appears **nowhere** under `apps/extension/src`, so a scan for it would report every
       * permission as unjustified.
       */
      readonly kind: "platform read";
      readonly member: string;
    }
  | {
      /** The manifest key the permission is for, and which must still be declared. */
      readonly kind: "manifest key";
      readonly key: ManifestKeyName;
    };

/**
 * The manifest keys a {@link EarnedBy} may name.
 *
 * **Spelled as a union rather than read through an index signature**, so naming a key the built
 * manifest does not carry stops the case at `tsc` instead of leaving it to read `undefined` and
 * report nothing. The direction that matters here is the one where a *mistyped* key silently
 * satisfies nothing.
 */
type ManifestKeyName = "side_panel" | "action" | "background" | "content_scripts";

/**
 * What earns one declared permission, and nothing else.
 *
 * **Two kinds, and the second exists because `sidePanel` is earned by one of them.** Measured on
 * 2026-10-13 (`docs/PROVIDERS.md` §4.6's four cells): `chrome.sidePanel` exists **iff** the
 * `sidePanel` permission is declared — the `side_panel` key alone leaves it `undefined` — so the
 * entry below names the **permission**, and the `side_panel` key is recorded as *the surface the
 * permission is for*, which is what the delta's trace scenario asks a reader to find.
 *
 * **The map is the assertion, and a shipped read is deliberately NOT a fallback for it.** The
 * `tabs` permission is the standing proof, and it is proof from shipped code rather than from this
 * file's reasoning: `extension-platform.ts` reads `readPlatform()`'s `"tabs"` member twice, so
 * **`chrome.tabs` IS reached in this client and `tabs` is deliberately not declared** — `tab.url`
 * is withheld without it, which is why the panel asks the page's content script instead
 * (`docs/PROVIDERS.md` §4.6). **An entry added to this map without a reason is the defect this case
 * exists to report, and an entry removed because a read disappeared would be a repair nobody can
 * make**, so the map's failure mode is a stale entry and not a missing one.
 *
 * **Test-owned, deliberately.** `design.md` D6 rejects making the requirement's *prose* the source
 * of this mapping, because a rule a comment can satisfy is not a rule — and this repository has
 * recorded that failure twice, once specifically as *"prose must not be able to satisfy one,
 * because a module that only describes the coupling it lacks is exactly the defect"*. A fixture is
 * where a test's expectations belong, and a test that owns the map cannot drift from the manifest
 * without failing.
 */
const PERMISSION_IS_EARNED_BY: Record<string, EarnedBy> = {
  storage: { kind: "platform read", member: "storage" },
  alarms: { kind: "platform read", member: "alarms" },
  notifications: { kind: "platform read", member: "notifications" },
  // **The one entry with no shipped read behind it**, and its justification is the manifest key that
  // names the document Chromium mounts. See the block above for why the key is not what makes the
  // API exist and is recorded as the thing the permission is *for* rather than as its cause.
  sidePanel: { kind: "manifest key", key: "side_panel" },
};

/**
 * Replace comment content with spaces, preserving line structure.
 *
 * **A copy of `tests/architecture/boundaries.test.ts`'s own reader, and the duplication is recorded
 * rather than avoided**: the two files are in two runners with two collection roots, and
 * `tests/architecture` is not a typechecked workspace member, so a Playwright spec cannot import
 * from it. **It is a reader and not a list**, which is the distinction this repository's rule about
 * two spellings is about — two *lists* of expected values drift, and two scanners of the same text
 * do not.
 *
 * **Stripping is what makes the scan above mean anything, and that is measured rather than
 * asserted.** Every `chrome.<name>` occurrence under `apps/extension/src` is **inside a comment** —
 * 14 in `extension-platform.ts`, 9 in `storage.ts` — so an unstripped scan would justify `storage`,
 * `tabs` *and* `notifications` from prose in files that reach no platform member at all, and
 * `tabs` is a permission this extension deliberately does not declare.
 *
 * **Known to be imperfect, in the direction this repository records for the original:** it does not
 * understand regex literals, and `apps/extension/src` contains two (both in `*.test.ts`, which this
 * case does not read). Blanking rather than deleting keeps every line number correct, so a failure
 * still names the line a reader has to open.
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

    out += char;
    if (char === '"' || char === "'" || char === "`") {
      inString = char;
    }
  }

  return out;
}

/**
 * Every shipped module of this client, as comment-stripped source.
 *
 * **Found from disk, recursively, and never from a list.** A list of modules is a second spelling
 * of the tree, and a module added without appearing in it would be invisible to the case — which is
 * the recorded "a test that reads a list reads the list, not the code" failure. `boundary` rules
 * take their roots from directory contents for the same reason.
 *
 * **`*.test.ts` and `*.test.tsx` are excluded, and that exclusion is the assertion's subject rather
 * than housekeeping.** A test *describing* a platform read is documentation of one, and a fixture
 * that plants `"storage"` in a stub would otherwise justify the permission on its own — the same
 * shape `stripComments` exists to prevent, one construct further out. Nothing under `dist` counts
 * either: that is the build's output, and the build is what the manifest spec is measuring, so
 * reading it here would let a stale artefact justify a permission no source earns.
 */
function shippedModules(): { path: string; source: string }[] {
  const found: { path: string; source: string }[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (/\.test\.tsx?$/.test(entry.name)) continue;

      found.push({ path, source: stripComments(readFileSync(path, "utf8")) });
    }
  };

  walk(EXTENSION_SRC_PATH);
  return found;
}

/**
 * The one expression this client reaches the platform through.
 *
 * **Matched by its own shape rather than by a file name, because a name is a second spelling of
 * where the platform is read and this repository has recorded that a rule forced to name a module
 * gets widened the first time the module moves.** `tests/architecture/boundaries.test.ts` confines
 * the bare `chrome` token to one module, and this finds the same place by the call the code makes —
 * which is why the two can be edited independently and disagree loudly.
 */
const PLATFORM_READ = /Reflect\s*\.\s*get\s*\(\s*globalThis\s*,\s*["'`]chrome["'`]\s*\)/;

/**
 * Whether any shipped module reads the platform member the map names.
 *
 * **The member is matched as a string literal, which is the only spelling shipped code uses** — the
 * reflective read takes the member's name as data. **The looseness is in the direction that finds a
 * justification rather than losing one**, so an incidental `"alarms"` string in the platform module
 * would corroborate a stale entry; the map is the assertion and this is its corroboration, which is
 * stated in the map's own block rather than left for a reader to work out from the direction of the
 * error.
 */
function platformReadsMember(member: string): boolean {
  const quoted = new RegExp(`["'\`]${member}["'\`]`);

  return shippedModules().some(
    (module) => PLATFORM_READ.test(module.source) && quoted.test(module.source),
  );
}

/** A map entry, spelled for a failure message that names what was claimed and what was not there. */
function describeEarnedBy(earned: EarnedBy): string {
  return earned.kind === "platform read"
    ? `a shipped platform read of "${earned.member}"`
    : `the manifest key "${earned.key}"`;
}

const MANIFEST_PATH = join(EXTENSION_DIST_PATH, "manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
  manifest_version: number;
  permissions?: string[];
  host_permissions?: string[];
  /**
   * **Both keys, and this is a repair rather than a convenience.**
   *
   * The type read `[{ js: string[] }]` — a one-element tuple — and the `matches` reader cast to
   * `[{ matches: string[] }]`. A second reader needed `js` at the same time, so the element was
   * widened to an array, **and the cast at line 165 stopped compiling while every test in the file
   * still passed** — which is the recorded shape of a `tsc` failure a browser run cannot see.
   *
   * **The array and the cast are both gone.** The element now carries the two properties this file
   * actually reads, so there is one description of the shape rather than two that disagree and one
   * assertion that has to cast to reach the truth.
   */
  content_scripts?: { js: string[]; matches: string[] }[];
  side_panel?: { default_path?: unknown };
  icons?: unknown;
  background: { service_worker: string; type: string };
  action: { default_popup: string; default_icon?: unknown };
};

/**
 * The first content script the built manifest declares.
 *
 * **`noUncheckedIndexedAccess` means a destructure is `| undefined`, and an `expect(...).toBeDefined()`
 * does not narrow it** — so the first version of this helper returned the destructure and `tsc`
 * reported three errors that no test could see. **It throws instead**, which is also the right shape
 * for a reader: a manifest that declares no content script is a property to fail on, not a value to
 * carry onwards as possibly-absent.
 */
function firstContentScript(): { js: string[]; matches: string[] } {
  const [script] = manifest.content_scripts ?? [];

  if (script === undefined) {
    throw new Error("the built manifest declares no content script at all");
  }

  return script;
}

/**
 * Whether a Chromium match pattern can match an origin.
 *
 * ## What this is and is not
 *
 * **It is not Chromium's match-pattern engine, and it is not asked to be.**
 * `in-page.spec.ts` deliberately refuses to re-derive those rules, and this function does
 * not either — the platform's own answer is established there, by a page on a real origin
 * that the content script demonstrably ran on.
 *
 * What this answers is the *declaration's* question, and the property it establishes is
 * deliberately weaker than "this is how Chromium matches": **the declared pattern cannot
 * exclude this origin.** A pattern with a specific host, a specific port, or a path prefix
 * would exclude it, and the case above fails. A pattern this function cannot parse is
 * treated as excluding, so an unrecognised form fails rather than passing — the direction
 * that lets a violation through is the one this must not take.
 */
function matchesOrigin(pattern: string, origin: string): boolean {
  const parsed = /^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/.exec(pattern);
  if (parsed === null) return false;

  const [, scheme = "", host = "", path = ""] = parsed;
  const url = new URL(origin);

  if (scheme !== "*" && scheme !== url.protocol.replace(/:$/, "")) return false;
  // **A host that is neither the wildcard nor this origin's own excludes it.** A wildcard
  // with a port (`*://*.example.com:8080/*`) is not a host this recognises, and it is not
  // treated as a match: a pattern this narrow has not been measured here.
  if (host !== "*" && host !== url.host) return false;
  // **The path is compared as a prefix, and `/*` matches every path** - which is the only
  // path form the shipped declaration uses.
  return path === "/*" || url.pathname.startsWith(path);
}

let extension: LaunchedExtension;

test.beforeAll(async () => {
  extension = await launchExtension();
});

test.afterAll(async () => {
  await extension?.close();
});

test.describe("the built extension's manifest", () => {
  test("declares every host permission in the wildcard path form", () => {
    // **The recorded trap, asserted.**
    //
    // `https://api.mail.tm` — with no path — is **accepted by Chromium and grants
    // nothing**. Measured in the M0 spike: the extension loads, reports success, and
    // every cross-origin request then fails with an opaque `TypeError: Failed to fetch`
    // that names no permission at all. Nothing warns; the failure looks like the network.
    //
    // So the rule is asserted by pattern rather than by a list of good values, because
    // a list of good values would still pass while a *new* host permission was added in
    // the broken form.
    const hosts = manifest.host_permissions ?? [];
    expect(hosts.length).toBeGreaterThan(0);

    for (const host of hosts) {
      expect(host, `${host} must carry a path`).toMatch(/^https:\/\/[^/]+\/\*$/);
      // **Not `//*` and not `/**`** — a wider pattern than the origin would grant the
      // extension every path on that origin, which is more than the product asked for.
      expect(host).not.toMatch(/\/\/\*{1,2}$/);
    }
  });

  test("declares no host reach no shipped surface reaches", () => {
    // **The `in-page-integration` requirement's second scenario, which nothing asserted
    // until this case.**
    //
    // The requirement reads: *"WHEN a host pattern is declared that no shipped surface
    // matches THEN the extension's browser suite SHALL fail."* A file that read the
    // declaration and reported it back satisfies the requirement's prose while answering
    // none of it — before this case, **adding `https://example.com/*` to `host_permissions`
    // turned every one of this tier's cases green**, and the extension would have held
    // reach to a host nothing in the product requests.
    //
    // **The reach is compared against what the tier scripts, not against a second list.**
    // `SCRIPTED_PROVIDER_ORIGINS` is derived from `recorded-provider.ts`'s own script
    // table, so this is "does the manifest match the reach a shipped surface has" rather
    // than "does the manifest match a list a spec file typed out" — two lists are two
    // things that drift, and the recorded `recorded-provider.ts` module exists because
    // that drift had already been paid for once.
    //
    // **Both directions, because the requirement names both.** `matches` is compared to
    // `host_permissions` *and* to the origins this tier actually serves a page on, so
    // neither a host permission with no origin behind it nor an origin nothing matches
    // can pass.
    // **Origins on both sides of the comparison.** `host_permissions` carries a match
    // pattern and `SCRIPTED_PROVIDER_ORIGINS` carries an origin, so each pattern is
    // reduced to its origin before the two are compared - otherwise a correct declaration
    // and a correct script table are reported as different because one of them spells a
    // path, and the case would be checking a spelling rather than a reach.
    expect(
      (manifest.host_permissions ?? []).map((pattern) => new URL(pattern).origin).sort(),
      `host_permissions names reach the tier scripts no provider for: ` +
        `${JSON.stringify(SCRIPTED_PROVIDER_ORIGINS)}`,
    ).toEqual([...SCRIPTED_PROVIDER_ORIGINS].sort());

    // **And the content script's reach is the same set of origins the pages run on.**
    //
    // `content_scripts.matches` is a Chromium match pattern and `host_permissions` is a
    // match pattern too, but **they answer different questions** — one says which pages
    // the script is injected into, the other which hosts the extension may reach over the
    // network — so this is deliberately *not* a "these two lists must be equal" assertion.
    // What it does require is that a page origin this tier serves is a pattern the content
    // script matches. The wildcard makes that true for the shipped declaration; a
    // declaration narrowed to a provider origin would fail here, which is the correct
    // answer for a content script that would stop running on every ordinary page.
    const script = firstContentScript();
    const servesPages = [FIXTURE_ORIGIN, FIXTURE_HTTP_ORIGIN];

    for (const origin of servesPages) {
      const covered = script.matches.some((pattern) => matchesOrigin(pattern, origin));
      expect(
        covered,
        `${origin} is served by a shipped surface, but no declared content_scripts ` +
          `pattern matches it: ${JSON.stringify(script.matches)}`,
      ).toBe(true);
    }
  });

  test("requests no permission no shipped surface uses", () => {
    // **The M12 review's question, asked now rather than at M12.**
    //
    // `storage` is used by the popup **and by the content script**, which reads the same
    // stored address directly. `alarms` and `notifications` are used by the **background
    // service worker** — the one alarm and the notification a background check raises. `tabs` and
    // `scripting` would only be needed by a surface that does not exist, and `activeTab` would only
    // be needed by one. A permission nothing uses is one that review deletes — so a permission
    // added here without a surface is a permission this milestone has no answer for.
    //
    // **Still exactly `["storage"]` after the content script landed, and that is a
    // measurement rather than a carry-over.** The content script's own note records the
    // alternative that was rejected on measurement: `activeTab`, which would grant access to
    // the current page on demand and cost nothing at install. What was measured instead is that
    // `chrome.storage` is readable *and writable* from a content script on the `storage`
    // permission alone, with `host_permissions` left at the two provider origins. So the
    // content script added a **surface** and no **permission**, and this assertion is what
    // says so.
    //
    // **`alarms` and `notifications` arrived with `incoming-mail-notification`, and the reason the
    // requirement is unchanged is the point.** It forbids a permission no shipped surface uses;
    // that change ships two surfaces that need them, so the clause does its work rather than
    // being amended. **The two were measured to be granted at install with no prompt**
    // (`docs/PROVIDERS.md` §4.5), which is a claim about *this* permission kind and not about an
    // optional one, which prompts by design.
    //
    // **`sidePanel` arrived with this change, and it is the fourth of the same shape.** The panel
    // is a shipped surface and `chrome.sidePanel` is `undefined` without the permission — measured,
    // `docs/PROVIDERS.md` §4.6, on a control differing in exactly that permission and the
    // `side_panel` key. **And the entry is traceable to a requirement that cannot be met without
    // it**, which is what the requirement's own *"traceable to a requirement"* wording asks for.
    //
    // **`tabs` is still absent, and that is the entry this milestone is actually about.**
    // `tab.url` is withheld without it, so the panel asks the page's own content script instead —
    // §4.6 measured both readings, and `tabs` costs the ability to read across every window for
    // ever. The separate case *"requests no permission in order to name the page beside the
    // panel"* names it, because this one would not distinguish it from any other omission.
    expect(manifest.permissions ?? []).toEqual(["storage", "alarms", "notifications", "sidePanel"]);
  });

  test("earns every declared permission by a shipped platform read or by the manifest key it is for", () => {
    // **The other direction of the case above, and neither alone is the requirement.** That case
    // answers *"is the declaration still the one this milestone measured?"* — an exact list, which
    // cannot name a *reason*, so a permission added to `static/manifest.json` and to that list in
    // the same commit passes it while granting a capability no requirement asked for. This case
    // answers *"is each declared permission traceable to something?"* and the answer is written
    // out per permission rather than folded into a list.
    //
    // **The requirement's own wording is what makes this a map rather than a scan.** It requires a
    // declared permission to be *"traceable to a requirement"* — and `design.md` D6 rejected making
    // the requirement's prose the source of this mapping for a reason this repository has recorded
    // twice: a rule a comment can satisfy is not a rule, and "prose must not be able to satisfy
    // one, because a module that only describes the coupling it lacks is exactly the defect". So
    // the coupling is stated here, as data a test owns, and checked against the tree.
    //
    // **Two kinds, and neither is inferred from the other.** `platform read` is the ordinary case:
    // a shipped module reaches the member, and the read has to be there — a permission whose
    // surface was deleted earns nothing by having been read once. `manifest key` exists for
    // `sidePanel` alone, because §4.6 measured that `chrome.sidePanel` is `undefined` in a
    // variant carrying the `side_panel` key with the permission absent, and `present` in a variant
    // carrying the permission with the key absent: **the permission is the cause and the key is
    // the surface it is for**, so naming the key as the cause would be false and a scan looking
    // for a read would report `sidePanel` as unjustified.
    //
    // **The map is the assertion, so a shipped read is deliberately not a fallback.** `tabs` is the
    // standing proof from shipped code rather than from this file's reasoning: `extension-platform.ts`
    // reads `readPlatform()`'s `"tabs"` member twice, and `tabs` is deliberately **not declared** —
    // `tab.url` is withheld without it and the panel asks the page's content script instead
    // (§4.6). Had this case been built as "a read justifies a permission", `tabs` would be the
    // first entry it failed to hold, and the repair would have been to declare it.
    //
    // **Stale is the failure mode this map cannot have, and that asymmetry is deliberate.** A
    // permission declared with no entry here fails. An entry here for a permission the manifest no
    // longer declares is **not** a failure and is not asserted against — a repaired removal must be
    // allowed to leave its own bookkeeping behind without a reader having to decide whether the
    // entry is still true, and the loop is over `manifest.permissions` rather than over the map's
    // keys precisely so that removing a permission cannot be blocked by its own history.
    const declared = manifest.permissions ?? [];

    // **Every declared permission has a stated reason, reported by name.** A single
    // `Object.keys(...)`-shaped assertion would name the wrong thing: the failure a reader gets is
    // "permission not accounted for", and there is no `toEqual` for that.
    const unaccounted = declared.filter((permission) => !(permission in PERMISSION_IS_EARNED_BY));
    expect(
      unaccounted,
      `declared with no reason in PERMISSION_IS_EARNED_BY: ${unaccounted.join(", ")}`,
    ).toEqual([]);

    // **And each reason is checked against the tree, all offenders named in one run.** The two
    // checks are separate loops rather than one combined pass so the message can say *which kind*
    // of justification failed — "is not read" and "is not declared" are different defects with
    // different repairs, and one merged list would force the reader to work out which applied.
    const notRead: string[] = [];
    const notDeclared: string[] = [];

    for (const permission of declared) {
      const earned = PERMISSION_IS_EARNED_BY[permission];
      if (earned === undefined) continue;

      if (earned.kind === "platform read" && !platformReadsMember(earned.member)) {
        notRead.push(`${permission} (claims ${describeEarnedBy(earned)})`);
      }
      if (earned.kind === "manifest key" && manifest[earned.key] === undefined) {
        notDeclared.push(`${permission} (claims ${describeEarnedBy(earned)})`);
      }
    }

    expect(notRead, `claimed a shipped read that is not there: ${notRead.join(", ")}`).toEqual([]);
    expect(
      notDeclared,
      `claimed a manifest key the built manifest does not carry: ${notDeclared.join(", ")}`,
    ).toEqual([]);
  });

  test("ships the icon a notification names, and declares it nowhere else", () => {
    // **Read as bytes, because the failure this exists to catch returns a file.**
    //
    // `docs/PROVIDERS.md` §4.5 measured three arms on this Chromium: a notification with **no
    // icon** resolves its callback and **registers nothing**, an **SVG** is refused outright with a
    // `null`, and a **PNG** resolves *and* registers. So the icon is load-bearing, and a missing
    // asset does not fail a build, a test, or a callback — **it fails silently, which is the only
    // kind of failure nothing else would notice.** Reading the signature rather than the size is
    // what distinguishes the asset from an HTML error page served in its place.
    const icon = join(EXTENSION_DIST_PATH, "icon.png");
    expect(
      existsSync(icon),
      `${icon} is named by every notification and the build did not emit it`,
    ).toBe(true);

    const bytes = readFileSync(icon);
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // **A PNG header and nothing else is not enough**, so the file has to hold an image: a header
    // followed by no `IEND` chunk is a truncated write that every check above would accept.
    expect(bytes.subarray(-8, -4).toString("ascii")).toBe("IEND");

    // **And the toolbar is untouched, which is the half that could be forgotten.** The icon exists
    // to satisfy a notification, so how the toolbar looks is not this change's business: neither
    // `manifest.icons` nor `action.default_icon` may name it. **A reader matching nothing would
    // satisfy the three assertions above for ever**, so this half is what makes them mean anything.
    expect(manifest.icons).toBeUndefined();
    expect(manifest.action.default_icon).toBeUndefined();
  });

  test("declares one content script, on every page, running when the document is idle", () => {
    // **The positive form of what M9 slice 1 adds, replacing an assertion that required its
    // absence.** `declares no content script and no side panel` was true until this change and
    // would have been false the moment `content-script.js` landed; the honest replacement is
    // not to delete the case but to say what is now required to be there.
    //
    // **Exactly one entry.** A second `content_scripts` entry is not a second surface by
    // accident — it is a second place a reader has to check before believing the first, and
    // `matches` on one of them would decide what the extension reaches without any spec
    // noticing.
    expect(manifest.content_scripts).toHaveLength(1);

    const [script] = manifest.content_scripts as [
      { matches: string[]; js: string[]; css?: string[]; run_at: string; all_frames?: boolean },
    ];

    // **Every http and https page.** This is the widest reach the extension has, and it is
    // what the slice is for — a disposable address is wanted *in the page you are already on*.
    // Asserting the two schemes as a set rather than a list, because the order carries nothing.
    expect([...script.matches].sort()).toEqual(["http://*/*", "https://*/*"]);

    // **The file the build emits, named rather than globbed**, so a renamed or split bundle is
    // a red here instead of a content script that silently stops running on every page.
    expect(script.js).toEqual(["content-script.js"]);

    // **No stylesheet.** The affordance carries its own inside its shadow root, precisely so
    // it can be injected into a document this product does not own. A `css` entry here would
    // apply to the *page's* every element, which is the opposite of that decision and would be
    // invisible in any spec that only looked at the DOM.
    expect(script.css).toBeUndefined();

    // **`all_frames` absent, so the top frame only.** An affordance per iframe would put a
    // control inside third-party documents the user is not filling in. `undefined` rather than
    // `false` because the two are the same behaviour and the file should say which it means;
    // this asserts the file says nothing, which is the conservative reading.
    expect(script.all_frames).toBeUndefined();

    // **`document_idle`, and the reason is measured.** Measured in Chromium: it fires *after*
    // `DOMContentLoaded`, so a fixture page that waits for that event has a document the
    // content script can already act on. `document_start` would run before the page's own
    // script has created the fields the affordance looks for — which is not a failure mode
    // this slice needs to handle, and the more expensive way to find that out.
    expect(script.run_at).toBe("document_idle");
  });

  test("ships the content script the manifest declares, as one file with no imports", () => {
    // **The build claim, asserted against the artefact.** `design.md` D1 requires one file with
    // no imports and no chunks, and the reason is checkable: a content script is loaded by
    // Chromium as a single classic script, so an `import` in it is a runtime failure on every
    // page rather than a build warning.
    //
    // **Read from `dist`, and named from the manifest** — so this case and the case above are
    // one chain: the manifest names a file, the build emits it, and the emitted file is a
    // single self-contained script.
    const script = firstContentScript();
    const emitted = script.js.map((name) => join(EXTENSION_DIST_PATH, name));

    for (const path of emitted) {
      expect(
        existsSync(path),
        `${path} is declared by the manifest but the build did not emit it`,
      ).toBe(true);
    }

    const source = readFileSync(emitted[0]!, "utf8");

    // **No module syntax, and each form separately.** An `import`/`export` statement, a bare
    // dynamic `import()`, and a relative specifier are three different bundler outputs; a check
    // written for one passes while another is present. The specifier pattern is the broadest
    // of the three and would catch all of them, so it is asserted on its own as well as through
    // the keyword patterns.
    expect(source).not.toMatch(/(^|[^\w$.])import\s*[({"']/);
    expect(source).not.toMatch(/(^|[^\w$.])export\s/);
    expect(source).not.toMatch(/(^|[^\w$.])import\s*\(/);
    expect(source).not.toMatch(/["']\.\.?\//);

    // **And one file, not a bundle graph.** A chunked content script would have emitted
    // siblings under a hashed name, and Chromium loads exactly the one file the manifest names.
    //
    // **The list is pinned rather than filtered**, because a filter is a sweep that matches
    // nothing when the shape it watches moves — the defect `apps/web/e2e/sections.spec.ts` had
    // to be given a negative control for. `sidepanel.js` came with the panel; leaving it out
    // here would have made this case red for the wrong reason and taught nobody anything, and
    // leaving it in by pattern would have let a content script chunked into three files pass.
    const emittedJs = readdirSync(EXTENSION_DIST_PATH).filter((name) => name.endsWith(".js"));
    expect(emittedJs.sort()).toEqual([
      "content-script.js",
      "popup.js",
      "service-worker.js",
      "sidepanel.js",
    ]);
  });

  test("names a side panel, and the document that build emits", () => {
    //
    // **This case was an absence, and M11 is the milestone the absence was waiting for.**
    //
    // The old wording said a side panel is forbidden here because *"M11 owns the side panel.
    // A side panel that renders nothing is fake UI, and the same treatment M7 slice 3 gave the
    // website's deferred `Extension preview` section applies here: the absence is a
    // **requirement**, so the milestone that owns the surface is the only one that may add
    // it."* That was not a decoration — it was the rule this file was enforcing, and it was
    // right for four milestones.
    //
    // **`extension-client`'s delta rewrites the same claim into a form that holds either way**:
    // the extension SHALL NOT declare a surface it does not ship, rather than SHALL NOT declare
    // *a side panel*. So this case is now the **positive** half of the rewritten requirement,
    // and it is a stronger assertion than the absence was in the direction that matters —
    // `side_panel: {}` was explicitly called out by the old comment as *"not an absence, it is
    // a declaration of a surface with nothing in it"*, and only a positive assertion can catch
    // that shape now that the key is expected.
    expect(manifest.side_panel).toEqual({ default_path: "sidepanel.html" });

    // **And the document it names is one this build emitted**, read against `dist` rather
    // than against the source tree — a rule reading source passes a build that emitted nothing,
    // which is the defect `tasks.md` 6.3 names.
    expect(existsSync(join(EXTENSION_DIST_PATH, "sidepanel.html"))).toBe(true);
  });

  test("every document path the manifest names is a file this build emitted", () => {
    //
    // **`extension-client`'s *"a declared path resolves to nothing"* scenario, and it is read
    // against the built `dist` for the reason the scenario itself says: WHEN the built
    // extension is listed.** A rule reading `static/manifest.json` against `sidepanel.html` in
    // the source tree would pass a build that emitted neither — and `sidepanel.html` living in
    // `apps/extension/` is exactly the file a broken rollup input list would leave behind.
    //
    // **The paths are collected from the manifest rather than retyped here.** A list written out
    // in this file is a second spelling of the manifest, and it is a spelling that goes stale
    // silently: adding a fourth surface to the manifest would not add it to this list, so the
    // case would keep passing while covering less. Deriving it means a new surface is covered
    // by being declared, which is the same "roots come from what is on disk" rule
    // `tests/architecture/boundaries.test.ts` applies to its package lists.
    const declared = [
      manifest.action.default_popup,
      manifest.side_panel?.default_path,
      manifest.background.service_worker,
      ...(manifest.content_scripts ?? []).flatMap((entry) => entry.js),
    ].filter((path): path is string => typeof path === "string");

    // **Non-vacuous: the list is the manifest's own four, not an empty array matching an
    // empty expectation.** A filter that collected nothing would satisfy the assertion below
    // for ever.
    expect(declared.length).toBe(4);

    // **AND reported by name, which is the scenario's second clause.** An `every(...)` returning
    // a boolean says a path is missing without saying which, and a reader repairing the build
    // has to re-derive it. This names them.
    const missing = declared.filter((path) => !existsSync(join(EXTENSION_DIST_PATH, path)));
    expect(missing).toEqual([]);
  });

  test("requests no permission in order to name the page beside the panel", () => {
    //
    // **The manifest clause of `extension-client`'s host requirement, and it is the same clause
    // as `in-page-integration`'s — stated twice in two capabilities because a panel and a
    // content script reach a host by different means and a reader must not have to know that
    // to find the rule.**
    //
    // **What is asserted is the absence of `tabs`, by name.** `tab.url` and `tab.title` are
    // withheld to an extension holding no `tabs` permission, and `docs/PROVIDERS.md` §4.6
    // measured both readings. So the panel's route — asking the content script beside the page
    // over `chrome.tabs.sendMessage` — is the free half, and `tabs` is the one permission that
    // would make the host readable directly and would cost the ability to read across every
    // window for ever.
    //
    // **Named rather than counted**, for the reason this file has recorded elsewhere: a count
    // says how many and not which, so a manifest that grew a fourth permission would pass a
    // length assertion and fail this one.
    expect(manifest.permissions).not.toContain("tabs");

    // **And the permission the side panel *does* need is declared, so the case is not satisfied
    // by a manifest that dropped it.** `chrome.sidePanel` is `undefined` without it — measured,
    // §4.6 — so a panel whose permission was removed would still pass the line above.
    expect(manifest.permissions).toContain("sidePanel");
  });

  test("names a service worker and a popup that the build emits", () => {
    // **The positive half of the worker's own absences.** Both absences in
    // `service-worker.test.ts` would still hold for a manifest that had stopped naming
    // a worker at all, so something has to assert the manifest refers to something real.
    expect(manifest.background.service_worker).toBe("service-worker.js");
    expect(manifest.action.default_popup).toBe("popup.html");
    expect(manifest.manifest_version).toBe(3);
  });
});

test.describe("what Chromium made of that manifest", () => {
  test("installed the extension, and parsed the manifest this suite read", async () => {
    // **Chromium's own record, read from inside the worker.**
    //
    // Not the manifest file — a file is what was asked for, and this is what was
    // given. The two differ in exactly the case this milestone exists to catch: a
    // permission Chromium accepts and does not grant is still in the JSON.
    const granted = await extension.worker.evaluate(async () => {
      // **Read reflectively, for the reason `apps/extension/src/main.tsx` gives:**
      // nothing in this workspace declares an ambient `chrome`, deliberately, so that
      // the platform is reachable from exactly one expression rather than from every
      // file in the project. Inside the worker `chrome` genuinely exists — that is the
      // point of the measurement — and reading it through `Reflect.get` says so without
      // asserting a type the repository has declined to declare.
      const scope = globalThis as {
        chrome?: { runtime?: { getManifest?: () => { host_permissions?: string[] } } };
      };
      const runtime = scope.chrome?.runtime;

      // `chrome.management` is **not** among this extension's declared permissions, so
      // it is unavailable here by design. Reading the permissions an extension holds
      // from inside that extension has no API. What *is* available — and what this
      // asserts — is that the worker really is a service worker with the extension's own
      // `chrome` in scope, and that Chromium's *parsed* manifest says what the file said.
      return {
        hasExtensionApi: typeof runtime?.getManifest === "function",
        serviceWorker:
          typeof (globalThis as { registration?: { scope?: unknown } }).registration?.scope ===
          "string",
        declaredHosts: runtime?.getManifest?.().host_permissions ?? [],
      };
    });

    expect(granted.hasExtensionApi).toBe(true);
    expect(granted.serviceWorker).toBe(true);
    // **Chromium's own parsed manifest**, not the file this suite read. If Chromium
    // had rejected or altered the file, these would differ.
    //
    // **What this does *not* say, named here because the case's own first draft overstated
    // it.** Parsing a permission list is not being granted one: every provider response in
    // this tier is fulfilled by the harness, so **nothing here exercises the grant** — a
    // cross-origin `fetch` succeeding is the only observable of it, and that is the M0
    // spike's `live-host-permission.mjs`, which is quarantined from all three suites. So the
    // claim is "Chromium accepted the declaration", and `AGENTS.md`'s wording was narrowed to
    // match rather than left broader than the instrument under it.
    expect(granted.declaredHosts).toEqual(manifest.host_permissions);
  });

  test("registers a service worker at a chrome-extension origin", () => {
    // **The narrow precondition the whole tier rests on**, asserted once here so a
    // failure names it. If this fails, every other spec in this tier is measuring
    // nothing, and `launch-extension.ts` would already have thrown.
    expect(extension.worker.url()).toMatch(
      new RegExp(`^chrome-extension://${extension.extensionId}/service-worker\\.js$`),
    );
  });
});
