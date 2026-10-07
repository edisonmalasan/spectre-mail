/**
 * Reading the stylesheet the browser actually loaded.
 *
 * ## Why this file exists rather than reading `dist/popup.css`
 *
 * The first version of the extension's literal sweep read `dist/popup.css` off disk and
 * **failed with twenty hex values, every one of which was correct to be there** — the
 * served bundle includes `tokens.css`, whose entire job is to be the file where a hex
 * lives. That is the same defect `apps/web/e2e/sections.spec.ts` recorded and fixed
 * first: a rule broader than the rule it documents cries wolf, and a crying wolf gets
 * deleted.
 *
 * ## Why it is duplicated rather than extracted
 *
 * `apps/web/e2e/sections.spec.ts` holds the same helper, and this is a second copy. The
 * reason it is **not** a shared module is already recorded in `AGENTS.md` and it is worth
 * repeating rather than rediscovering: **`tests/` is not typechecked** — it has no
 * `tsconfig` and `pnpm -r` covers workspace members only — which is the documented reason
 * the website's browser suite lives under `apps/web` at all. A shared e2e helper would
 * have to live somewhere with the same defect, so the smaller cost is two copies of a
 * forty-line pure function in two directories that each own a suite.
 *
 * **Extraction is not declined forever.** When a third client appears this becomes worth
 * doing, and the recorded reason to do it is that there would then be three copies.
 */

/** Fetch the stylesheet the page's `<link>` points at. */
export async function servedStylesheet(page: import("@playwright/test").Page): Promise<string> {
  const href = await page.evaluate(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]');
    return link?.href ?? "";
  });
  if (href === "") {
    throw new Error("the built popup must link a stylesheet");
  }

  const css = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return await response.text();
  }, href);

  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Remove the generated token layer's declarations, **by selector rather than by filename**.
 *
 * `tokens.css` emits exactly two blocks, `:root` and `:root` inside a dark-scheme media
 * query, and **every hex it holds is inside one of them**. The popup's own stylesheet
 * declares no `:root`. So the boundary is the generator's structure rather than its file
 * name, which is what keeps the strip correct when a bundler concatenates the two into
 * one file — which is exactly what Vite did here.
 */
export function stripGeneratedTokenBlocks(css: string): string {
  let out = "";
  let rest = css;

  for (;;) {
    const start = rest.search(/(^|[{}])\s*:root\s*\{/);
    if (start === -1) {
      out += rest;
      return out;
    }

    const open = rest.indexOf("{", start);
    out += rest.slice(0, start);

    // Walk to the matching brace so a nested block is consumed whole.
    let depth = 0;
    let cursor = open;
    for (; cursor < rest.length; cursor += 1) {
      if (rest[cursor] === "{") depth += 1;
      else if (rest[cursor] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    rest = rest.slice(cursor + 1);
  }
}
