/**
 * Run-artifact writer.
 *
 * Two artifacts per run:
 *   .runs/<timestamp>.json  — machine readable, cited by docs/PROVIDERS.md
 *   .runs/<timestamp>.txt   — the human summary
 *
 * Both are written from the same in-memory summary, so they cannot disagree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { OUTCOMES } from "./probe-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const RUNS_DIR = path.resolve(here, "..", ".runs");

export function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function renderSummary(summary, { command }) {
  const lines = [];
  lines.push("SpectreMail M0 provider spike — run summary");
  lines.push("=".repeat(64));
  lines.push(`command    : ${command}`);
  lines.push(`started    : ${summary.startedAt}`);
  lines.push(`finished   : ${summary.finishedAt}`);
  lines.push(
    `totals     : ${summary.total} probes — ` +
      OUTCOMES.map((o) => `${o}=${summary.counts[o]}`).join(", "),
  );
  lines.push("");
  lines.push("probes");
  lines.push("-".repeat(64));
  for (const r of summary.results) {
    lines.push(`[${r.outcome.toUpperCase()}] ${r.id}`);
    lines.push(`    ${r.title}`);
    lines.push(`    ${r.detail}`);
    if (r.data && Object.keys(r.data).length > 0) {
      lines.push(`    data: ${JSON.stringify(r.data).slice(0, 600)}`);
    }
    lines.push("");
  }
  lines.push("=".repeat(64));
  lines.push(
    "Reminder: `unverified` means the check did not run. It is not a pass.",
  );
  return lines.join("\n");
}

export async function writeRunArtifacts(summary, { command, runsDir = RUNS_DIR }) {
  await mkdir(runsDir, { recursive: true });
  const slug = timestampSlug(new Date(summary.startedAt));
  const jsonPath = path.join(runsDir, `${slug}.json`);
  const txtPath = path.join(runsDir, `${slug}.txt`);

  const payload = { command, ...summary };
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(txtPath, renderSummary(summary, { command }), "utf8");

  return { jsonPath, txtPath, summaryText: renderSummary(summary, { command }) };
}
