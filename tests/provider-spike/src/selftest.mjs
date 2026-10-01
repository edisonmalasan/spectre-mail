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

// ---------------------------------------------------------------------------
// Regression coverage for the harness-fault contract.
//
// Both defects found while closing the delivery check were the same class of
// bug: the harness reported its own fault as a provider finding. These checks
// pin the classification so that class cannot silently return.
// ---------------------------------------------------------------------------

await (async () => {
  const { runDeliveryProbes } = await import("./probes/delivery.mjs");

  const realFetch = globalThis.fetch;
  const stubFetch = (handler) => {
    globalThis.fetch = handler;
  };
  const jsonResponse = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await check(
      "a revoked Mail.tm token is a harness fault, not unverified or a provider finding",
      async () => {
        const runner = new ProbeRunner(quiet);
        // Reproduces the original defect: the mailbox was deleted before delivery
        // polled it, so GET /messages answers 401 forever.
        stubFetch(async (input) => {
          const url = String(input?.url ?? input);
          if (url.includes("/messages")) return jsonResponse(401, { "hydra:description": "Unauthorized" });
          return jsonResponse(200, {});
        });

        await runDeliveryProbes(runner, {
          mailtm: { address: "spike@uberip.com", token: "revoked" },
          guerrilla: null,
          sender: null,
          interactive: true,
          timeoutMs: 2000,
          mailFrom: null,
          log: () => {},
        });

        const result = runner.summary().results.find((r) => r.id === "delivery.mailtm");
        assert.equal(result.outcome, "failed");
        assert.match(result.detail, /HARNESS FAULT/i);
        // It must not be reported as a provider limitation.
        assert.doesNotMatch(result.detail, /unverified/);
      },
    );

    await check(
      "a rejected Guerrilla session is a harness fault rather than an empty inbox",
      async () => {
        const runner = new ProbeRunner(quiet);
        // Measured dead-session shape: HTTP 200 with an `error` key and no `list`,
        // and `auth.success` still true. Any of those signals must abort the poll
        // as a harness fault rather than reading it as an empty inbox.
        stubFetch(async () =>
          jsonResponse(200, {
            error: "Please call get_email_address or set_email_user first",
            auth: { success: true, error_codes: [] },
          }),
        );

        await runDeliveryProbes(runner, {
          mailtm: null,
          guerrilla: { sid: "dead", address: "spike@guerrillamailblock.com", knownMailIds: new Set() },
          sender: null,
          interactive: true,
          timeoutMs: 2000,
          mailFrom: null,
          log: () => {},
        });

        const result = runner.summary().results.find((r) => r.id === "delivery.guerrilla");
        assert.equal(result.outcome, "failed");
        assert.match(result.detail, /HARNESS FAULT/i);
      },
    );

    await check(
      "a Guerrilla session with no address is a harness fault",
      async () => {
        const runner = new ProbeRunner(quiet);
        stubFetch(async () => jsonResponse(200, { list: [] }));

        await runDeliveryProbes(runner, {
          mailtm: null,
          guerrilla: { sid: "s", address: null },
          sender: null,
          interactive: true,
          timeoutMs: 2000,
          mailFrom: null,
          log: () => {},
        });

        const result = runner.summary().results.find((r) => r.id === "delivery.guerrilla");
        assert.equal(result.outcome, "failed");
        assert.match(result.detail, /HARNESS FAULT/i);
      },
    );

    await check(
      "the provider's own welcome message is never counted as external delivery",
      async () => {
        const runner = new ProbeRunner(quiet);
        // Guerrilla seeds the inbox with its own mail. Matching list[0] would have
        // recorded a false pass. Note the sender domain is the one the provider
        // actually uses.
        const welcome = {
          mail_id: "1",
          mail_from: "no-reply@guerrillamail.com",
          mail_subject: "Welcome to Guerrilla Mail",
        };
        stubFetch(async (input) => {
          const url = String(input?.url ?? input);
          if (url.includes("fetch_email")) {
            return jsonResponse(200, { mail_from: "no-reply@guerrillamail.com", mail_body: "welcome" });
          }
          return jsonResponse(200, { list: [welcome] });
        });

        await runDeliveryProbes(runner, {
          mailtm: null,
          guerrilla: { sid: "s", address: "spike@guerrillamailblock.com", knownMailIds: new Set() },
          sender: null,
          interactive: true,
          timeoutMs: 1200,
          mailFrom: null,
          log: () => {},
        });

        const result = runner.summary().results.find((r) => r.id === "delivery.guerrilla");
        assert.equal(result.outcome, "unverified");
      },
    );

    await check(
      "mail that predates the delivery check is ignored even from a non-provider sender",
      async () => {
        const runner = new ProbeRunner(quiet);
        // Covers the knownMailIds exclusion independently of the domain filter: a
        // pre-existing message from an ordinary sender must not count either.
        const preExisting = {
          mail_id: "77",
          mail_from: "someone.else@example.com",
          mail_subject: "Unrelated earlier mail",
        };
        stubFetch(async (input) => {
          const url = String(input?.url ?? input);
          if (url.includes("fetch_email")) {
            return jsonResponse(200, { mail_from: "someone.else@example.com", mail_body: "old" });
          }
          return jsonResponse(200, { list: [preExisting] });
        });

        await runDeliveryProbes(runner, {
          mailtm: null,
          guerrilla: {
            sid: "s",
            address: "spike@guerrillamailblock.com",
            knownMailIds: new Set(["77"]),
          },
          sender: null,
          interactive: true,
          timeoutMs: 1200,
          mailFrom: null,
          log: () => {},
        });

        const result = runner.summary().results.find((r) => r.id === "delivery.guerrilla");
        assert.equal(result.outcome, "unverified");
      },
    );

    await check(
      "a genuinely new external message IS still accepted as delivery",
      async () => {
        const runner = new ProbeRunner(quiet);
        // Guards against over-filtering: the exclusions must not swallow a real
        // inbound message, which would break the M0 gate itself.
        const welcome = {
          mail_id: "1",
          mail_from: "no-reply@guerrillamail.com",
          mail_subject: "Welcome to Guerrilla Mail",
        };
        const real = {
          mail_id: "2",
          mail_from: "sender@example.org",
          mail_subject: "Your code",
        };
        stubFetch(async (input) => {
          const url = String(input?.url ?? input);
          if (url.includes("fetch_email")) {
            return jsonResponse(200, { mail_from: "sender@example.org", mail_subject: "Your code", mail_body: "123456" });
          }
          return jsonResponse(200, { list: [welcome, real] });
        });

        await runDeliveryProbes(runner, {
          mailtm: null,
          guerrilla: {
            sid: "s",
            address: "spike@guerrillamailblock.com",
            knownMailIds: new Set(["1"]),
          },
          sender: null,
          interactive: true,
          timeoutMs: 1200,
          mailFrom: null,
          log: () => {},
        });

        const result = runner.summary().results.find((r) => r.id === "delivery.guerrilla");
        assert.equal(result.outcome, "passed");
        assert.equal(result.data.subject, "Your code");
      },
    );
  } finally {
    globalThis.fetch = realFetch;
  }
})();

if (failures > 0) {
  console.error(`\nself-test FAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log("\nself-test passed");
