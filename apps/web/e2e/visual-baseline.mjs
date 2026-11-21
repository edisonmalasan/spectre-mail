/**
 * M20 reproducible full-page visual comparison.
 *
 * Serves the built website, captures the full page at the five M16 viewports, masks dynamic
 * address/timestamp values, and writes a baseline manifest. Reference captures live in
 * docs/ux-reference/captures/reference-*.png and are dated 2026-11-21.
 *
 * Run: node apps/web/e2e/visual-baseline.mjs [--write-baseline]
 * The script is a measurement instrument, not a test: it records what it captured and where.
 *
 * @module
 */

import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WEB_DIST = join(ROOT, "web/dist");
const CAPTURES = join(ROOT, "../docs/ux-reference/captures");
const MANIFEST = join(ROOT, "../docs/ux-reference/visual-baselines.json");
mkdirSync(CAPTURES, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "split", width: 956, height: 885 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile360", width: 360, height: 800 },
];
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

if (!existsSync(join(WEB_DIST, "index.html"))) {
  console.error("Build the website first: pnpm build:web");
  process.exit(1);
}

const server = createServer((request, response) => {
  const name = (request.url || "/").split("?")[0];
  const file = join(WEB_DIST, name === "/" ? "index.html" : name);
  if (!file.startsWith(WEB_DIST) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404);
    response.end("not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": MIME[file.slice(file.lastIndexOf("."))] || "application/octet-stream",
  });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const browser = await chromium.launch();
const entries = [];
try {
  for (const view of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: view.width, height: view.height },
      isMobile: view.width <= 390,
      deviceScaleFactor: 1,
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const path = join(CAPTURES, `baseline-${view.name}.png`);
    await page.screenshot({ path, fullPage: true });
    const meta = await page.evaluate(() => {
      const d = globalThis.document;
      return {
        viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
        scrollHeight: d.documentElement.scrollHeight,
        scrollWidth: d.documentElement.scrollWidth,
        fonts: d.fonts.status,
        address: d.querySelector(".address__value")?.textContent ?? null,
        timestamp: d.querySelector(".message__time")?.textContent ?? null,
      };
    });
    entries.push({
      view: view.name,
      requested: { width: view.width, height: view.height },
      image: `docs/ux-reference/captures/baseline-${view.name}.png`,
      reference: `docs/ux-reference/captures/reference-${view.name}.png`,
      referenceDate: "2026-11-21",
      zoom: "100%",
      deviceScaleFactor: 1,
      fonts: meta.fonts,
      scrollHeight: meta.scrollHeight,
      overflowX: meta.scrollWidth > meta.viewport.width,
      masks: ["dynamic address value", "dynamic message timestamp"],
      layoutMasked: false,
      ...meta,
      address: meta.address === null ? null : "[MASKED]",
      timestamp: meta.timestamp === null ? null : "[MASKED]",
    });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const manifest = {
  createdAt: new Date().toISOString(),
  referenceDate: "2026-11-21",
  purpose:
    "M20 matched-viewport full-page visual baselines for SpectreMail vs dated Temp Mail captures",
  maskPolicy: "Only dynamic address values and timestamps are masked; layout is never masked.",
  entries,
};
if (process.argv.includes("--write-baseline")) {
  // Two-space JSON with a trailing newline is what the repository's Prettier config emits;
  // write it that way rather than leaving fmt:check red on the artifact this script owns.
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote ${MANIFEST} with ${entries.length} viewports`);
} else {
  console.log(JSON.stringify(manifest, null, 2));
}
