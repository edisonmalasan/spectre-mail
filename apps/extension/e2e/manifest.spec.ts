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

const MANIFEST_PATH = join(EXTENSION_DIST_PATH, "manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
  manifest_version: number;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: unknown;
  side_panel?: unknown;
  background: { service_worker: string; type: string };
  action: { default_popup: string };
};

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
    const [script] = manifest.content_scripts as [{ matches: string[] }];
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
    // stored address directly. Nothing else is: `tabs` and `scripting` would only be needed by
    // a surface that does not exist, and `activeTab` would only be needed by one. A permission
    // nothing uses is one that review deletes — so a permission added here without a surface is
    // a permission this milestone has no answer for.
    //
    // **Still exactly `["storage"]` after the content script landed, and that is a
    // measurement rather than a carry-over.** The content script's own note records the
    // alternative that was rejected on measurement: `activeTab`, which would grant access to
    // the current page on demand and cost nothing at install. What was measured instead is that
    // `chrome.storage` is readable *and writable* from a content script on the `storage`
    // permission alone, with `host_permissions` left at the two provider origins. So the
    // content script added a **surface** and no **permission**, and this assertion is what
    // says so.
    expect(manifest.permissions ?? []).toEqual(["storage"]);
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
    const [script] = manifest.content_scripts as [{ js: string[] }];
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
    const emittedJs = readdirSync(EXTENSION_DIST_PATH).filter((name) => name.endsWith(".js"));
    expect(emittedJs.sort()).toEqual(["content-script.js", "popup.js", "service-worker.js"]);
  });

  test("declares no side panel", () => {
    // **Still an absence, and it is the half of the old case that has not changed.**
    //
    // M11 owns the side panel. A side panel that renders nothing is fake UI, and the same
    // treatment M7 slice 3 gave the website's deferred `Extension preview` section applies
    // here: the absence is a **requirement**, so the milestone that owns the surface is the
    // only one that may add it.
    //
    // `toBeUndefined` rather than `toHaveLength(0)`: `"side_panel": {}` is not an absence, it
    // is a declaration of a surface with nothing in it, and it would change how a future
    // reader reads the file.
    expect(manifest.side_panel).toBeUndefined();
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
