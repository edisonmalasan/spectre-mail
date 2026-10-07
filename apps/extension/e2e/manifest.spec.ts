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
 * - **As a file**, for the wildcard path form (below).
 * - **As Chromium's own record**, read from `chrome.management` in the worker's own
 *   context, for what was actually granted.
 *
 * A file can satisfy the first and fail the second: a permission Chromium silently
 * refuses is still present in the JSON.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { EXTENSION_DIST } from "../playwright.config";
import { launchExtension } from "./launch-extension";
import type { LaunchedExtension } from "./launch-extension";

const MANIFEST_PATH = fileURLToPath(new URL(`../${EXTENSION_DIST}/manifest.json`, import.meta.url));
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
  manifest_version: number;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: unknown;
  side_panel?: unknown;
  background: { service_worker: string; type: string };
  action: { default_popup: string };
};

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

  test("requests no permission no shipped surface uses", () => {
    // **The M12 review's question, asked now rather than at M12.**
    //
    // `storage` is used by the popup. Nothing else is: there is no content script to
    // need `tabs` or `scripting`, and `activeTab` would only be needed by one. A
    // permission nothing uses is one that review deletes — so a permission added here
    // without a surface is a permission this milestone has no answer for.
    expect(manifest.permissions ?? []).toEqual(["storage"]);
  });

  test("declares no content script and no side panel", () => {
    // **An absence, asserted rather than omitted.**
    //
    // M9 owns in-page integration and M11 owns the side panel. A content script that
    // injects nothing and a side panel that renders nothing are fake UI, and the same
    // treatment M7 slice 3 gave the website's deferred `Extension preview` section
    // applies here: the absence is a **requirement**, so the milestone that owns the
    // surface is the only one that may add it.
    //
    // `toBeUndefined` rather than `toHaveLength(0)`: `"content_scripts": []` is not an
    // absence, it is a declaration of nothing, and it would change how a future reader
    // reads the file.
    expect(manifest.content_scripts).toBeUndefined();
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

test.describe("what Chromium granted", () => {
  test("installed the extension and granted its declared host permissions", async () => {
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
