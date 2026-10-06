/**
 * Writes `packages/ui/src/tokens.css` from `packages/ui/src/tokens.ts`.
 *
 * Run with `pnpm --filter @spectre-mail/ui tokens:emit`.
 *
 * ## Why the file is committed rather than built
 *
 * Because shared packages here are consumed **as TypeScript source** — every `exports`
 * entry points at `./src/index.ts` and there is no per-package build. A stylesheet that
 * were generated at install time would need a build step this workspace deliberately does
 * not have. So the generated file is committed, and `tokens-css.test.ts` is what keeps it
 * honest: if it drifts from its source, the test suite goes red.
 *
 * ## Why this is not run inside a test
 *
 * A test that **wrote** the file would pass on a machine where the file was wrong,
 * because writing fixes it. The check and the write have to be separate commands, or the
 * check is not a check.
 *
 * @module
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTokensCss } from "../src/tokens-css.ts";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "src", "tokens.css");

writeFileSync(target, renderTokensCss(), "utf8");
process.stdout.write(`wrote ${target}\n`);
