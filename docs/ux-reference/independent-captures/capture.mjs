/* global getComputedStyle */
/**
 * Independent UI/UX comparison harness (research task).
 *
 * Serves the built website (apps/web/dist) on a RANDOM local port with an SPA
 * history fallback, then drives real Chromium through Playwright to capture, for
 * every one of the 10 public reference routes at each of the 5 M16 viewports:
 *   - a full-page PNG,
 *   - DOM geometry via getBoundingClientRect(),
 *   - computed styles,
 *   - headings / landmarks / regions,
 *   - Chromium's accessibility tree via CDP Accessibility.getFullAXTree.
 *
 * It also reads the IHDR dimensions of every dated reference capture, and checks
 * what the built site renders at the *reference* URL spellings (/en/faq etc.).
 *
 * This is a measurement instrument, not a test. It writes only under
 * docs/ux-reference/independent-captures/. No product code is edited.
 *
 * Run: node docs/ux-reference/independent-captures/capture.mjs
 */

import { createServer } from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// docs/ux-reference/independent-captures -> repo root is ../../../
const REPO = join(HERE, "..", "..", "..");
const WEB_DIST = join(REPO, "apps", "web", "dist");
const REF_CAPTURES = join(REPO, "docs", "ux-reference", "captures");

// Resolve Playwright from the package that owns it, not from this script's folder.
const require = createRequire(join(REPO, "apps", "web", "package.json"));
const { chromium } = require("@playwright/test");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "split", width: 956, height: 885 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile360", width: 360, height: 800 },
];

// The 10 public reference routes, mapped to the built site's own path spelling.
const ROUTES = [
  { slug: "home", path: "/", reference: "/en/" },
  { slug: "change", path: "/change", reference: "/en/change" },
  { slug: "faq", path: "/faq", reference: "/en/faq" },
  { slug: "api", path: "/api", reference: "/en/api" },
  { slug: "10minutemail", path: "/10minutemail", reference: "/en/10minutemail" },
  { slug: "email-generator", path: "/email-generator", reference: "/en/email-generator" },
  { slug: "privacy-policy", path: "/privacy-policy", reference: "/privacy-policy" },
  { slug: "terms-of-service", path: "/terms-of-service", reference: "/terms-of-service" },
  { slug: "contact", path: "/contact", reference: "/en/contact" },
  { slug: "blog", path: "/blog", reference: "/blog/" },
];

const REFERENCE_URLS = [
  "/en/",
  "/en/change",
  "/en/faq",
  "/en/api",
  "/en/10minutemail",
  "/en/email-generator",
  "/privacy-policy",
  "/terms-of-service",
  "/en/contact",
  "/blog/",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

mkdirSync(HERE, { recursive: true });

if (!existsSync(join(WEB_DIST, "index.html"))) {
  console.error("Build the website first: pnpm --filter @spectre-mail/web build");
  process.exit(1);
}

const server = createServer((request, response) => {
  const urlPath = (request.url || "/").split("?")[0];
  const decoded = decodeURIComponent(urlPath);
  let file = join(WEB_DIST, decoded);
  if (!file.startsWith(WEB_DIST) || !existsSync(file) || !statSync(file).isFile()) {
    // SPA history fallback: every route is served the built entry document.
    file = join(WEB_DIST, "index.html");
  }
  const ext = file.slice(file.lastIndexOf("."));
  response.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;

// ---- reference PNG dimensions (IHDR is bytes 16..24) -----------------------
function pngSize(filePath) {
  const buf = readFileSync(filePath);
  if (buf.subarray(1, 4).toString("latin1") !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const referenceImages = {};
for (const name of ["desktop", "split", "tablet", "mobile", "mobile360"]) {
  const p = join(REF_CAPTURES, `reference-${name}.png`);
  const baseline = join(REF_CAPTURES, `baseline-${name}.png`);
  referenceImages[name] = {
    reference: existsSync(p) ? pngSize(p) : null,
    baseline: existsSync(baseline) ? pngSize(baseline) : null,
  };
}
const changePage = join(REF_CAPTURES, "reference-change-page.png");
const referenceChangePage = existsSync(changePage) ? pngSize(changePage) : null;

// ---- in-page measurement function -----------------------------------------
function measurePage() {
  const d = globalThis.document;
  const cs = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      color: s.color,
      backgroundColor: s.backgroundColor,
      borderTopWidth: s.borderTopWidth,
      borderTopStyle: s.borderTopStyle,
      borderTopColor: s.borderTopColor,
      borderRadius: s.borderRadius,
      padding: s.padding,
    };
  };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  };
  const one = (sel) => {
    const el = d.querySelector(sel);
    return el ? { rect: rect(el), style: cs(el) } : null;
  };
  const els = (sel) =>
    [...d.querySelectorAll(sel)].map((el) => ({
      rect: rect(el),
      text: (el.textContent || "").trim().slice(0, 90),
    }));

  return {
    url: d.location.pathname,
    viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
    scrollHeight: d.documentElement.scrollHeight,
    scrollWidth: d.documentElement.scrollWidth,
    fonts: d.fonts.status,
    title: d.title,
    body: cs(d.body),
    h1: els("h1"),
    headings: els("h1,h2,h3"),
    regions: [...d.querySelectorAll("[data-region]")].map((el) => ({
      region: el.getAttribute("data-region"),
      rect: rect(el),
    })),
    landmarks: {
      header: one("header.app-header"),
      main: one("main.page"),
      footer: one("footer.page-footer"),
      nav: one("nav.page-footer__nav"),
    },
    product: {
      hero: one("section.hero"),
      panel: one("div.hero__panel"),
      heroTitle: one("h2.hero__title"),
      field: one("div.hero__field"),
      address: one("p.address"),
      addressValue: one("code.address__value"),
      copy: one("button.address__copy"),
      toolbar: one("div.toolbar"),
      toolbarButtons: els("button.toolbar__button"),
      inboxSection: one("section.inbox-section"),
      inboxPanel: one("div.inbox-panel"),
    },
    publicRoute: {
      article: one("article.public-route"),
      heading: one("h1#public-route-heading"),
      intro: one("p.public-route__intro"),
      sections: els("section.public-route__section h2"),
    },
    // True when the working product (not the article shell) was mounted.
    productMounted: d.querySelector('[data-testid="address"]') !== null,
    articleMounted: d.querySelector("article.public-route") !== null,
  };
}

const browser = await chromium.launch();
const results = [];
const urlChecks = [];
try {
  for (const view of VIEWPORTS) {
    for (const route of ROUTES) {
      const page = await browser.newPage({
        viewport: { width: view.width, height: view.height },
        isMobile: view.width <= 390,
        deviceScaleFactor: 1,
      });
      let gotoNote = "ok";
      try {
        await page.goto(`${origin}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });
      } catch (error) {
        gotoNote = `goto-timeout: ${String(error.message).slice(0, 120)}`;
      }
      await page.waitForTimeout(1500);

      const shot = join(HERE, `independent-${view.name}-${route.slug}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const measured = await page.evaluate(measurePage);

      // Chromium accessibility tree at the whole document, via CDP.
      let ax = { total: 0, interesting: [] };
      try {
        const client = await page.context().newCDPSession(page);
        const { nodes } = await client.send("Accessibility.getFullAXTree");
        const wanted = new Set([
          "heading",
          "button",
          "link",
          "textbox",
          "banner",
          "main",
          "contentinfo",
          "navigation",
          "dialog",
          "status",
        ]);
        const interesting = nodes
          .filter((n) => !n.ignored && wanted.has(n.role?.value))
          .map((n) => ({ role: n.role?.value, name: n.name?.value ?? "" }))
          .slice(0, 80);
        ax = { total: nodes.length, interesting };
        await client.detach();
      } catch (error) {
        ax = { total: 0, interesting: [], error: String(error.message).slice(0, 120) };
      }

      results.push({
        view: view.name,
        route: route.slug,
        path: route.path,
        referencePath: route.reference,
        capture: `docs/ux-reference/independent-captures/independent-${view.name}-${route.slug}.png`,
        gotoNote,
        ...measured,
        ax,
      });
      await page.close();
    }
  }

  // Reference URL spellings at desktop: which article (if any) renders?
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const refPath of REFERENCE_URLS) {
    let note = "ok";
    try {
      await page.goto(`${origin}${refPath}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch (error) {
      note = `goto-timeout: ${String(error.message).slice(0, 80)}`;
    }
    await page.waitForTimeout(600);
    const seen = await page.evaluate(() => {
      const d = globalThis.document;
      return {
        h1: (d.querySelector("h1")?.textContent || "").trim().slice(0, 80),
        article: d.querySelector("article.public-route") !== null,
        product: d.querySelector('[data-testid="address"]') !== null,
      };
    });
    urlChecks.push({ referencePath: refPath, ...seen, note });
  }
  await page.close();
} finally {
  await browser.close();
  server.close();
}

const payload = {
  createdAt: new Date().toISOString(),
  purpose:
    "Independent objective UI/UX comparison of built SpectreMail against the 2026-11-21 Temp Mail reference",
  originNote: `served apps/web/dist on 127.0.0.1 random port ${port} with SPA history fallback`,
  referenceImages,
  referenceChangePage,
  urlChecks,
  rows: results,
};
writeFileSync(join(HERE, "evidence.json"), JSON.stringify(payload, null, 2) + "\n");
console.log(`Captured ${results.length} route/viewport combinations.`);
console.log(`Reference images: ${JSON.stringify(referenceImages)}`);
console.log(`Reference change page: ${JSON.stringify(referenceChangePage)}`);
console.log(`URL checks: ${urlChecks.length}`);
console.log(`Wrote ${join(HERE, "evidence.json")}`);
