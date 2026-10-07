/**
 * The service worker's absences, asserted rather than reviewed.
 *
 * ## Why a test reads source text for this
 *
 * The claim is "this worker schedules no repeated provider request and creates no
 * alarm". There is no behaviour to call and no return value to inspect — a loop that was
 * *not* written is precisely the thing a behavioural test cannot observe, since an empty
 * worker and a worker that quietly polls both pass every call-based assertion.
 *
 * So the assertion is on the source, and that is a real limit worth stating rather than
 * hiding: **this test proves the shipped worker source contains no alarm and no repeated
 * scheduling call.** It cannot prove a runtime with a different code path behaves that
 * way, and it is a weaker instrument than a behavioural test would be — accepted because
 * the alternative is no instrument at all for a requirement that exists to stop something
 * being added by accident.
 *
 * ## The falsification this shape makes possible
 *
 * Deleting this test leaves the suite green, because nothing else observes the worker's
 * contents. That is exactly why `service-worker.test.ts` plants each forbidden call in a
 * copy of the real source and requires the same reader to report it — so the reader is
 * proven able to fail, not merely present.
 *
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const WORKER_PATH = fileURLToPath(new URL("./service-worker.ts", import.meta.url));

const workerSource = readFileSync(WORKER_PATH, "utf8");

/**
 * Code comments are stripped before matching.
 *
 * **Not cosmetic.** This file's own documentation names every one of these — it has to,
 * because the reasoning is the deliverable — so a reader that matched raw text would
 * fire on this module's prose about `chrome.alarms` and on the word "polling" in a comment
 * saying there is none. Stripping is what lets the documentation be honest without making
 * the rule unsatisfiable. It is the third time this repository has hit that, and the
 * first two are recorded in `AGENTS.md`: two rules fixed by rewriting their prose until
 * they went quiet, which is not a fix.
 */
function code(contents: string): string {
  return contents.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/**
 * Calls that would constitute ambient background work.
 *
 * **`setTimeout` and `setInterval` are here because the shared session's scheduler is
 * built from them.** A worker that created a `MailboxSession` and drove it would schedule
 * through exactly these, so their absence is what "carries no polling" reduces to on this
 * platform.
 */
const FORBIDDEN_IN_WORKER = [
  "chrome.alarms",
  "setInterval",
  "setTimeout",
  "createMailboxSession",
  "createExtensionProviderManager",
] as const;

describe("the extension's background service worker", () => {
  it("schedules no repeated provider request and creates no alarm", () => {
    const withoutComments = code(workerSource);

    for (const call of FORBIDDEN_IN_WORKER) {
      expect(withoutComments, `the worker must not reference ${call}`).not.toContain(call);
    }
  });

  it("reports each planted call, so the reader above is proven able to fail", () => {
    // **The control, and the reason this file exists as a test rather than a comment.**
    // Every planted call is inserted into a copy of the *real* source, so a reader that
    // had been narrowed — or scanning the wrong file, or matching nothing at all — would
    // report none of them and this would fail.
    for (const call of FORBIDDEN_IN_WORKER) {
      const mutated = `${workerSource}\nself.addEventListener("activate", () => { ${call}; });\n`;

      expect(code(mutated), `a planted \`${call}\` must be reported`).toContain(call);
    }
  });

  it("declares the surfaces the manifest names", () => {
    // A worker that had stopped being referenced would still satisfy the two rules
    // above, because both are absences. This is the positive half: the manifest's
    // `background.service_worker` must name a file this build emits.
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL("../static/manifest.json", import.meta.url)), "utf8"),
    ) as { background: { service_worker: string; type: string } };

    expect(manifest.background.service_worker).toBe("service-worker.js");
    // **`type: "module"` is what lets the worker be an ES module at all**, and it is
    // what the build emits: shared packages are consumed as TypeScript source, so the
    // worker is only loadable if its imports are bundled and its module type declared.
    expect(manifest.background.type).toBe("module");
  });
});
