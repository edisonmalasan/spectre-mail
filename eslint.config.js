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

  prettier,
);
