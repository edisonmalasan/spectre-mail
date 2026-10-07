import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * Root ESLint flat config.
 *
 * Two deliberate choices:
 *
 * 1. `eslint-config-prettier` is applied LAST. Prettier owns formatting;
 *    ESLint is configured not to reformat. Running them in the other order
 *    makes the two fight, and produces errors that are formatting problems
 *    wearing a lint label.
 *
 * 2. TypeScript type-aware rules are NOT enabled. `tsc --noEmit` already reports
 *    every type error with better messages and better file/line precision than
 *    ESLint could. Running type-aware linting as well would report the same
 *    defects twice through two different reporters, and the second one has no
 *    line numbers. `pnpm typecheck` is the single source of type truth.
 *
 * The M0 spike at `tests/provider-spike/` is ignored. It is not a workspace
 * member, is hand-rolled .mjs, and is governed by its own harness contract and
 * self-test. It is never imported by product code, and linting it here would
 * only produce suppressions.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.vite/**",
      "**/*.tsbuildinfo",
      "tests/provider-spike/**",
      "openspec/changes/archive/**",
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  {
    // Tests and config files legitimately reach for Node globals and are not
    // shipped to a browser.
    files: ["**/*.test.ts", "**/*.config.ts", "eslint.config.js", "vitest.config.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // **Plain JavaScript, which until M8 had exactly one file in it and is now a
    // documented shape rather than an accident.**
    //
    // `js.configs.recommended` declares rules but no globals, and the block above is
    // scoped to `.ts`/`.tsx`. So a `.js` or `.mjs` file shipped under `apps/` was linted
    // with **no environment at all**, and `pnpm lint` reported `process is not defined`
    // and `fetch is not defined` in a Node harness script that uses both correctly.
    //
    // That failure is worth naming rather than just fixing: the rule was right and the
    // file was right, and the defect was that **the configuration had no opinion about a
    // file extension the repository had not used yet.** Naming the one file would have
    // left the second one to fail the same way, so this block is matched by extension.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // **A fixture that runs as a service worker**, which is neither a Node process nor a
    // page: it has `self` and `chrome`, and no `process` and no `document`.
    //
    // `apps/extension/e2e/fixtures/alarm-probe/` is the first file in this repository
    // that runs in a worker. Giving it Node globals would have been the wrong fix and a
    // silencing one — it would have taught the file it is a script, and the next
    // `no-undef` would have been reported against the wrong environment.
    //
    // Matched by shape (`e2e/fixtures/`) rather than by naming this directory, so a
    // second quarantined fixture is covered by existing rather than by remembering.
    files: ["**/e2e/fixtures/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },

  prettier,
);
