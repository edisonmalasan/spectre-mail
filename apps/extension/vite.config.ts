import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The extension's build.
 *
 * ## Why a bundler at all
 *
 * An MV3 extension loads **plain files**. `manifest.json` names `service-worker.js`
 * and `popup.html` on disk, and nothing resolves a bare module specifier at runtime —
 * so `import { createMailbox } from "@spectre-mail/core"` cannot work as written, the
 * way it works for `apps/web` under Vite's dev server.
 *
 * Every shared package in this workspace is consumed **as TypeScript source** (each
 * `exports` points at `./src/index.ts`). That is deliberate and it stays that way;
 * what changes here is only that the extension needs the result on disk.
 *
 * ## Why Vite, which is already here
 *
 * `proposal.md` prefers a bundler already in the lockfile over a new tool, because a
 * bundler is the kind of dependency that arrives quietly and then owns the build.
 * Vite `7.3.6` is already a dependency of `apps/web`, its `esbuild` binary is already
 * permitted by `allowBuilds` in `pnpm-workspace.yaml`, and the same React plugin
 * already used by the website is available at the same version. **No new tool and no
 * new version** — this adds an entry point to an existing one.
 *
 * ## Three entry points, and why the worker is separate
 *
 * `popup.html` and `service-worker.js` are built as separate inputs with
 * `rollupOptions.output.format: "es"`, because `manifest.json` refers to each by
 * literal filename. The worker is declared `"type": "module"`, which is what lets it
 * be an ES module at all; Chromium supports that, and it is what the M0 spike's
 * fixture used when it measured that host permission is what grants the fetch.
 *
 * `manifest.json` and any static asset are copied verbatim by Vite's `publicDir`.
 * They are **not** generated, so the file a maintainer reads is the file Chromium
 * loads — and the unit test that asserts the wildcard path form reads the *built*
 * copy, so a hand-edit that breaks it fails the build rather than shipping.
 *
 * ## Two entry points here, and a third elsewhere
 *
 * The heading above says *three* entry points, and at the time it was written this config
 * declared **two**. The content script is the third, and it is built by a **separate** config
 * (`vite.content.config.ts`) because a Manifest V3 content script must be one classic script
 * that resolves no module specifier — which `format: "es"` and `chunks/[name].js`, both used
 * below, are the opposite of. The sentence is now true, and `package.json`'s `build` runs both
 * so no command in this repository names only one of them.
 */
export default defineConfig({
  root: __dirname,
  publicDir: "static",
  plugins: [react()],
  build: {
    outDir: "dist",
    // **`false`, and this changed when the second build was added.** `emptyOutDir: true`
    // here would delete `content-script.js` on the next popup build — the second build writes
    // into the same `dist`, so whoever runs last decides whether the extension loads at all.
    // Each build cleans its own kind of output instead: the first emits HTML and ES modules,
    // the second a single IIFE.
    emptyOutDir: false,
    // **No hash and no content hash in a filename.** `manifest.json` names these
    // files literally, so a hashed name would require rewriting the manifest after
    // the bundle was written — which is exactly the step where a stale manifest and a
    // fresh bundle drift apart.
    rollupOptions: {
      input: {
        "service-worker": "src/service-worker.ts",
        popup: "popup.html",
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
