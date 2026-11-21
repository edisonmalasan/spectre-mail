/**
 * Focused re-measurement of the home product band at 1440x900 using the exact
 * selectors the M16 inventory used. Complements capture.mjs (whose `product.field`
 * recorded the OUTER .hero__field wrapper, not the .hero__address pill).
 *
 * Run: node docs/ux-reference/independent-captures/home-geometry.mjs
 * Writes only docs/ux-reference/independent-captures/home-geometry.json.
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
    /* networkidle can time out on a live provider; the fixed wait below is the precondition */
  }
  await page.waitForTimeout(1500);
  out = await page.evaluate(() => {
    const d = document;
    const one = (sel) => {
      const el = d.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        rect: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
        font: `${s.fontFamily} ${s.fontSize} ${s.fontWeight}`,
        color: s.color,
        bg: s.backgroundColor,
        borderRadius: s.borderRadius,
        padding: s.padding,
        borderTop: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
      };
    };
    return {
      viewport: { w: innerWidth, h: innerHeight },
      scrollHeight: d.documentElement.scrollHeight,
      scrollWidth: d.documentElement.scrollWidth,
      header: one("header.app-header"),
      hero: one("section.hero"),
      panel: one("div.hero__panel"),
      title: one("h2.hero__title"),
      pill: one("div.hero__address"),
      addressValue: one("code.address__value"),
      copy: one("button.address__copy"),
      toolbar: one("div.toolbar__actions"),
      toolbarButtons: [...d.querySelectorAll("button.toolbar__button")].map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
      }),
      inboxPanel: one("div.inbox-panel"),
      footer: one("footer.page-footer"),
    };
  });
  await page.close();
} finally {
  await browser.close();
  server.close();
}
mkdirSync(HERE, { recursive: true });
writeFileSync(join(HERE, "home-geometry.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
