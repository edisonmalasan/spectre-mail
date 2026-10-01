#!/usr/bin/env node
/**
 * Self-test for the spike harness itself.
 *
 * Verifies the contract the spike depends on: a failing probe must not abort
 * the run, every probe must land on exactly one of the four outcomes, and the
 * run must produce both a JSON artifact and a summary.
 *
 * Runs offline and issues zero provider requests.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ProbeRunner,
  failed,
  passed,
  unsupported,
  unverified,
} from "./probe-runner.mjs";
import { writeRunArtifacts } from "./report.mjs";

let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

console.log("spike harness self-test");

const quiet = { log: () => {} };

await check("a passing probe is recorded as passed", async () => {
  const runner = new ProbeRunner(quiet);
  await runner.probe("x.pass", "t", async () => passed("fine"));
  assert.equal(runner.summary().counts.passed, 1);
});

await check("a throwing probe is recorded as failed, not propagated", async () => {
  const runner = new ProbeRunner(quiet);
  const record = await runner.probe("x.throw", "t", async () => {
    throw new Error("boom");
  });
  assert.equal(record.outcome, "failed");
  assert.match(record.detail, /boom/);
});

await check("later probes still run after an earlier failure", async () => {
  const runner = new ProbeRunner(quiet);
  await runner.probe("a", "t", async () => {
    throw new Error("boom");
  });
  await runner.probe("b", "t", async () => passed("still ran"));
  const s = runner.summary();
  assert.equal(s.total, 2);
  assert.equal(s.counts.failed, 1);
  assert.equal(s.counts.passed, 1);
  assert.equal(s.results[1].id, "b");
});

await check("unsupported and unverified stay distinct from failed", async () => {
  const runner = new ProbeRunner(quiet);
  await runner.probe("s", "t", async () => unsupported("nope"));
  await runner.probe("u", "t", async () => unverified("could not run"));
  const s = runner.summary();
  assert.equal(s.counts.unsupported, 1);
  assert.equal(s.counts.unverified, 1);
  assert.equal(s.counts.failed, 0);
});

await check("unverified does not fail the exit code, failed does", () => {
  const onlyUnverified = new ProbeRunner(quiet);
  onlyUnverified.record("u", "t", unverified("nope"));
  assert.equal(onlyUnverified.exitCode(), 0);

  const withFailure = new ProbeRunner(quiet);
  withFailure.record("f", "t", failed("nope"));
  assert.equal(withFailure.exitCode(), 1);
});

await check("an invalid outcome is coerced to failed", async () => {
  const runner = new ProbeRunner(quiet);
  const record = await runner.probe("bad", "t", async () => ({ outcome: "great" }));
  assert.equal(record.outcome, "failed");
  assert.match(record.detail, /invalid outcome/);
});

await check("summary counts sum to the total", async () => {
  const runner = new ProbeRunner(quiet);
  await runner.probe("a", "t", async () => passed("x"));
  await runner.probe("b", "t", async () => failed("x"));
  await runner.probe("c", "t", async () => unsupported("x"));
  const s = runner.summary();
  const sum = Object.values(s.counts).reduce((a, b) => a + b, 0);
  assert.equal(sum, s.total);
});

await (async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "spike-selftest-"));
  try {
    const runner = new ProbeRunner(quiet);
    await runner.probe("selftest.probe", "Self-test probe", async () =>
      passed("synthetic", { value: 1 }),
    );
    const { jsonPath, txtPath, summaryText } = await writeRunArtifacts(
      runner.summary(),
      { command: "selftest", runsDir: dir },
    );

    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    await check("run artifacts are produced from one run", () => {
      assert.equal(json.total, 1);
      assert.equal(json.command, "selftest");
      assert.equal(json.results[0].id, "selftest.probe");
    });

    const txt = await readFile(txtPath, "utf8");
    await check("the summary reports all four outcome counts", () => {
      for (const outcome of ["passed", "failed", "unsupported", "unverified"]) {
        assert.match(txt, new RegExp(`${outcome}=\\d`));
      }
    });

    await check("the summary warns that unverified is not a pass", () => {
      assert.match(summaryText, /unverified/);
      assert.match(summaryText, /not a pass/i);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
})();

if (failures > 0) {
  console.error(`\nself-test FAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log("\nself-test passed");
