import { defineConfig } from "vite";

/**
 * The content script's build, and why it is not a third input to the first one.
 *
 * ## A Manifest V3 content script is a classic script
 *
 * It has no `"type": "module"`, it cannot resolve a bare specifier at runtime, and it cannot
 * code-split: a chunk the platform never loads is a script that throws **before its first
 * line**, which no other gate in this repository can see. The popup's build emits
 * `format: "es"` and permits `chunks/[name].js` — exactly what a content script may not be.
 *
 * **So this is a second build with one input rather than a third input to the first.**
 * Making it an input of the existing build would need Rollup's `output` as an **array**, so the
 * entries could differ in `format`, plus per-entry chunk control so the content-script entry
 * did not inherit `chunkFileNames`. That is achievable, and it is how a client with three
 * content scripts should build them.
 *
 * The cost here is one more line in the package's build script. The benefit is that the
 * property that matters — *one file, no imports, no chunks* — is **checkable**, rather than a
 * consequence of two overlapping `output` entries that a future edit could quietly unpick.
 * `e2e/manifest.spec.ts` reads the built file and requires it to import nothing.
 *
 * ## No plugins, and no token stylesheet
 *
 * The React plugin transforms JSX, and there is no JSX here: the affordance is one `button` and
 * one `style` element, built with `document.createElement`. Importing `packages/ui`'s
 * `tokens.css` would inject a stylesheet into somebody else's document for no benefit, and
 * `design.md` D7 records that decision and its cost.
 *
 * ## The output filename is fixed, because the manifest names it
 *
 * `content-script.js` is the literal the manifest's `content_scripts[].js` refers to, so this
 * config and that JSON have to agree — and the browser suite reads **both** and compares them.
 * **A first draft of this comment named `content-script.bundle.js`**, which is the filename one of
 * this change's falsification mutations used precisely to break that agreement. A comment can be
 * wrong about a value that is right two lines below it, and nothing in the build reads prose.
 *
 * @module
 */

/** The file name `static/manifest.json` refers to. Shared with the suite that checks it. */
export const CONTENT_SCRIPT_FILE = "content-script.js";

export default defineConfig({
  build: {
    outDir: "dist",
    // A content script is loaded as one classic script, so an empty outDir is what "clean"
    // means here: this build must not inherit the popup build's HTML output.
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: "src/content-script/entry.ts",
      formats: ["iife"],
      name: "SpectreMailInPage",
      fileName: () => CONTENT_SCRIPT_FILE,
    },
    rollupOptions: {
      output: {
        // **This, and nothing else.** `inlineDynamicImports` is what forbids the code-splitting
        // a content script cannot survive.
        //
        // **A `manualChunks` was tried here as belt-and-braces and Rollup refuses the
        // combination** - `Invalid value for option "output.manualChunks" - this option is not
        // supported for "output.inlineDynamicImports"` - so the belt was removed rather than
        // the braces. Recording it because the comment that justified it claimed a protection
        // the build does not have: `inlineDynamicImports` alone is the whole guarantee, and
        // `e2e/manifest.spec.ts` reads the built file to confirm it survived.
        inlineDynamicImports: true,
      },
    },
  },
});
