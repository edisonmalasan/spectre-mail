/**
 * M21 paired frame-level comparison of the one motion effect the reference demonstrated:
 * the Copy tooltip fade. Serves the built website and samples the animation at the same
 * offsets used for the reference capture (0, 37.5, 75, 112.5, 150 ms).
 *
 * @module
 */

import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIST = fileURLToPath(new URL("../dist", import.meta.url));
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.getByTestId("ready").waitFor();

  // Capture the one-shot animation before it finishes, exactly as the reference probe did.
  await page.evaluate(() => {
    globalThis.__cap = null;
    globalThis.__capTimer = setInterval(() => {
      const found = globalThis.document
        .getAnimations()
        .find(
          (a) =>
            a.effect &&
            a.effect.getTiming().iterations === 1 &&
            String(a.effect.target?.className ?? "").includes("toast"),
        );
      if (found) {
        globalThis.__cap = found;
        found.pause();
        globalThis.clearInterval(globalThis.__capTimer);
      }
    }, 5);
  });
  await page.getByTestId("address-copy").click();
  await page.waitForTimeout(200);

  const reading = await page.evaluate(() => {
    const one = globalThis.__cap;
    if (!one) return { error: "capture missed" };
    const info = {
      dur: one.effect.getTiming().duration,
      easing: one.effect.getTiming().easing,
      fill: one.effect.getTiming().fill,
      keyframes: one.effect.getKeyframes().map((k) => ({ o: k.offset, op: k.opacity })),
      samples: [],
    };
    for (const t of [0, 37.5, 75, 112.5, 150]) {
      one.currentTime = t;
      info.samples.push({ t, opacity: globalThis.getComputedStyle(one.effect.target).opacity });
    }
    return info;
  });
  console.log(JSON.stringify(reading, null, 2));
  await page.close();
} finally {
  await browser.close();
  server.close();
}
