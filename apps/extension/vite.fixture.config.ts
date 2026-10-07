import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * The in-page fixture's build.
 *
 * ## Why a fixture needs a build at all
 *
 * The requirement is that the inserted address becomes **the value the page's own state
 * holds**. Asserting that against a hand-written imitation of a controlled input would be a
 * proxy for the thing under test — and this repository has a recorded habit of shipping exactly
 * that, then finding it read as coverage. So the fixture is a **real React app**, and React 19
 * ships no UMD build, so it has to be bundled.
 *
 * **A third build, and it is the cheapest of the three.** `apps/extension` already depends on
 * `react`, `react-dom`, Vite and `@vitejs/plugin-react`; this adds no dependency and no
 * version. It emits one IIFE beside the two files the suite serves.
 *
 * ## It is built, not served from source
 *
 * **The suite serves `dist/`, not `page.tsx`.** A page the browser had to transform would be a
 * different page from the one a reader of this file wrote, and "the built page" is the claim the
 * rest of this repository's browser tier makes.
 *
 * @module
 */

/** Where the suite looks for the built fixture. */
export const FIXTURE_DIST = "e2e/fixtures/in-page/dist";

/**
 * The fixture's own directory, which is **not** `__dirname`.
 *
 * `apps/extension/vite.config.ts` sets `root: __dirname` and gets away with it because the
 * package root is where its entry points live. This config's root is three directories down,
 * and the first version copied that line — so Rollup looked for `index.html` in the package
 * root and reported `Could not resolve entry module "index.html"`, which reads like a missing
 * file rather than a wrong directory.
 */
const FIXTURE_ROOT = path.resolve(__dirname, "e2e/fixtures/in-page");

export default defineConfig({
  root: FIXTURE_ROOT,
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, FIXTURE_DIST),
    emptyOutDir: true,
    target: "chrome120",
    rollupOptions: {
      input: { fixture: path.resolve(FIXTURE_ROOT, "page.tsx") },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]",
        inlineDynamicImports: true,
      },
    },
  },
});
