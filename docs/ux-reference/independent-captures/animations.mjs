/* global document, getComputedStyle */
/**
 * Independent animation measurement on the BUILT SpectreMail page at 1440x900.
 * Reads document.getAnimations() immediately after activating the toolbar Copy
 * control, the same instrument used on the live reference in reference-live-dom.json.
 *
 * Run: node docs/ux-reference/independent-captures/animations.mjs
 * Writes only docs/ux-reference/independent-captures/animations.json.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DIST = join(REPO, "apps", "web", "dist");
const require = createRequire(join(REPO, "apps", "web", "package.json"));
const { chromium } = require("@playwright/test");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  let file = join(DIST, p === "/" ? "index.html" : p);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile())
    file = join(DIST, "index.html");
  res.writeHead(200, {
    "Content-Type": MIME[file.slice(file.lastIndexOf("."))] || "application/octet-stream",
  });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const readAnimations = () => {
  const d = document;
  return d.getAnimations().map((a) => {
    const t = a.effect?.getTiming?.();
    const kf =
      typeof a.effect?.getKeyframes === "function"
        ? a.effect
            .getKeyframes()
            .map((k) => ({ offset: k.offset, opacity: k.opacity, transform: k.transform }))
        : [];
    return {
      name: a.animationName || a.id || null,
      playState: a.playState,
      durationMs: t?.duration ?? null,
      easing: t?.easing ?? null,
      fill: t?.fill ?? null,
      iterations: t?.iterations ?? null,
      targetClass: a.effect?.target?.className ?? null,
      keyframes: kf,
    };
  });
};

const browser = await chromium.launch();
let out;
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    /* fixed wait below is the precondition */
  }
  await page.waitForTimeout(1500);
  const before = await page.evaluate(readAnimations);
  // Wait for the toolbar Copy control to be present, then activate it.
  await page.locator("button.toolbar__button").first().waitFor({ timeout: 10000 });
  await page.locator("button.toolbar__button").first().click();
  const after = await page.evaluate(readAnimations);
  const toast = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="copy-feedback"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      text: el.textContent,
      w: Math.round(r.width),
      h: Math.round(r.height),
      opacity: getComputedStyle(el).opacity,
    };
  });
  out = { viewport: { w: 1440, h: 900 }, before, afterCopyClick: after, toast };
  await page.close();
} finally {
  await browser.close();
  server.close();
}
mkdirSync(HERE, { recursive: true });
writeFileSync(join(HERE, "animations.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
