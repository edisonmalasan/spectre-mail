#!/usr/bin/env node
/**
 * SpectreMail M0 provider compatibility spike — orchestrator.
 *
 * Usage:
 *   node src/run.mjs [--interactive] [--timeout-ms <n>] [--no-browser] [--headed]
 *
 * This is disposable spike scaffolding. It is not imported by any application
 * and is retired or absorbed during M1/M3.
 */

import { ProbeRunner, OUTCOMES } from "./probe-runner.mjs";
import { writeRunArtifacts } from "./report.mjs";
import { runCorsHeaderProbes } from "./probes/cors-headers.mjs";
import { runMailTmProbes, runMailTmDeletionProbes } from "./probes/mailtm.mjs";
import { runGuerrillaProbes } from "./probes/guerrilla.mjs";
import { runBrowserProbes, runMatchPatternProbe } from "./probes/browser.mjs";
import { runDeliveryProbes } from "./probes/delivery.mjs";
import { resolveSender } from "./senders/index.mjs";

function parseArgs(argv) {
  const args = {
    interactive: false,
    timeoutMs: undefined,
    browser: true,
    headless: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--interactive") args.interactive = true;
    else if (arg === "--no-browser") args.browser = false;
    else if (arg === "--headed") args.headless = false;
    else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node src/run.mjs [--interactive] [--timeout-ms <n>] [--no-browser] [--headed]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const command = `node src/run.mjs ${process.argv.slice(2).join(" ")}`.trim();

const runner = new ProbeRunner();

console.log("SpectreMail M0 — provider compatibility spike");
console.log("DISPOSABLE harness. Findings belong in docs/PROVIDERS.md.");
console.log(`mode: ${args.interactive ? "interactive delivery" : "non-interactive"}`);

await runCorsHeaderProbes(runner);

const mailtm = await runMailTmProbes(runner);
const guerrilla = await runGuerrillaProbes(runner);

if (args.browser) {
  await runBrowserProbes(
    runner,
    {
      headless: args.headless,
      targets: [
        { name: "mailtm", base: "https://api.mail.tm" },
        { name: "guerrilla", base: "https://api.guerrillamail.com" },
      ],
    },
  );

  await runMatchPatternProbe(runner, {
    targetOrigin: "https://api.mail.tm",
    targetUrl: "https://api.mail.tm/domains",
  });
} else {
  runner.section("Browser environments");
  console.log("  (skipped: --no-browser)");
}

await runDeliveryProbes(runner, {
  mailtm,
  guerrilla,
  sender: resolveSender(),
  interactive: args.interactive,
  timeoutMs: args.timeoutMs,
  mailFrom: process.env.SPECTRE_SPIKE_MAIL_FROM ?? null,
  log: console.log,
});

// Deletion revokes the Mail.tm token, so it MUST come after delivery. Running it
// earlier made the Mail.tm delivery probe poll a mailbox that no longer existed.
await runMailTmDeletionProbes(runner, mailtm);

const summary = runner.summary();
const { jsonPath, txtPath, summaryText } = await writeRunArtifacts(summary, {
  command,
});

console.log("");
console.log("=".repeat(64));
console.log(
  `TOTAL ${summary.total} probes — ` +
    OUTCOMES.map((o) => `${o}=${summary.counts[o]}`).join(", "),
);
console.log(`artifact: ${jsonPath}`);
console.log(`summary : ${txtPath}`);
console.log(
  summary.counts.unverified > 0
    ? "NOTE: unverified checks did not run. They are NOT passes."
    : "NOTE: no unverified checks.",
);
console.log("=".repeat(64));

await import("node:fs/promises").then((fs) =>
  fs.writeFile(txtPath, summaryText, "utf8").catch(() => {}),
);

process.exit(runner.exitCode());
