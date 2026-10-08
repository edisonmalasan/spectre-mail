/**
 * The service worker's absences, asserted rather than reviewed.
 *
 * ## Why a test reads source text for this
 *
 * The claim is "this worker arms nothing, and holds nothing once it has answered". There is no
 * return value to inspect and no call to make — a loop that was *not* written is precisely the
 * thing a behavioural test cannot observe, since an empty worker and a worker that quietly polls
 * both pass every call-based assertion. **And retention is the same shape: a session held between
 * events is a reference in a scope, and a scope is not something a caller can observe.**
 *
 * So the assertions are on the source, and that is a real limit worth stating rather than hiding:
 * **this test proves the shipped worker source arms no timer and declares no module-scope binding,
 * and that the module that performs the work declares none either.** It cannot prove a runtime
 * with a different code path behaves that way, and it is a weaker instrument than a behavioural
 * test would be — accepted because the alternative is no instrument at all for a requirement that
 * exists to stop something being added by accident.
 *
 * ## The rule was rewritten rather than extended, and why that is the honest outcome
 *
 * This file used to forbid `createMailboxSession` and `createExtensionProviderManager` in the
 * worker. **`in-page-mailbox` made the worker create mailboxes**, so both strings became false — and
 * they had gone on passing *by import indirection* while it did: the worker names neither, because
 * `create-mailbox.ts` does, and the rule was reading a file that had never held them. That is the
 * thirty-first recorded instance of a check narrower than its rule, and the first one that was
 * **true while guarding nothing at all** — a rule listing identifiers the worker does not mention
 * cannot fail, whatever the worker does.
 *
 * What replaced them is the property the amendment to the requirement actually names: **the worker
 * keeps nothing after it has answered.** `in-page-mailbox`'s delta changed that requirement from
 * *emptiness* to *retention* precisely because an idle-terminated worker that holds a session holds
 * one that may be terminated holding it. Retention cannot be forbidden by naming the things it might
 * hold — there are too many, and a session is reachable through a function call — so it is forbidden
 * by the shape it must have: **a retained value needs a binding, and a module-scope binding is the
 * only one that survives a request.**
 *
 * ## The falsification this shape makes possible
 *
 * Deleting this file leaves the suite green, because nothing else observes the worker's contents.
 * That is exactly why each rule plants its forbidden shape into a copy of the real source and
 * requires the same reader to report it — so each reader is proven able to fail, not merely present.
 * Both rules are falsified separately, because a reader that reported everything would satisfy both
 * and a reader that reported nothing would fail both: the value is in the discrimination.
 *
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const WORKER_PATH = fileURLToPath(new URL("./service-worker.ts", import.meta.url));
const CREATION_PATH = fileURLToPath(new URL("./create-mailbox.ts", import.meta.url));

const workerSource = readFileSync(WORKER_PATH, "utf8");
const creationSource = readFileSync(CREATION_PATH, "utf8");

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
 * Calls that would constitute ambient background work, in the worker file itself.
 *
 * **`setTimeout` and `setInterval` are here because the shared session's scheduler is
 * built from them.** A worker that kept a session and drove it would schedule through
 * exactly these, so their absence in *this file* is what "arms nothing itself" reduces to
 * on this platform. The session the worker does build is released in the same request — a
 * fact asserted behaviourally by `create-mailbox.test.ts`'s request-count cases, because
 * "it arms no timer" and "it retains nothing" are different claims and only one of them
 * is readable from this file.
 */
const FORBIDDEN_IN_WORKER = ["chrome.alarms", "setInterval", "setTimeout"] as const;

/**
 * Module-scope bindings, named by the shape a retained value would take.
 *
 * **Column-anchored, so an indented `const` does not count.** `service-worker.ts` reads the
 * storage area *inside* its listener and *must*: caching a platform handle at module scope would
 * pin it for the lifetime of a context whose lifetime is unmeasured. So a reader that ignored
 * indentation would report the correct code as a violation — and a rule that fires on correct code
 * gets deleted, which is the same failure as a rule that fires on nothing.
 *
 * **`export const` counts too, and that is deliberate.** The binding cannot be reassigned, but it
 * can hold a value built once, and `const session = createMailboxSession(...)` at module scope is
 * exactly the defect being forbidden while looking entirely reasonable.
 */
const MODULE_SCOPE_BINDING = /^(?:export\s+)?(?:const|let|var)\s/m;

/** Module-scope binding names in `contents`, as the reader reports them. */
function retainedBindings(contents: string): readonly string[] {
  return code(contents)
    .split("\n")
    .flatMap((line) => (MODULE_SCOPE_BINDING.test(line) ? [line.trim()] : []));
}

describe("the extension's background service worker", () => {
  it("arms no alarm and schedules nothing of its own", () => {
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

  it("retains nothing, so a woken worker and a cold one behave identically", () => {
    // **The rule the amendment to the requirement asks for, and it covers two files.** The worker
    // is where a retained session would most obviously live; `create-mailbox.ts` is where it
    // actually would be, because that is the module that knows how to build one — so a rule scoped
    // to the worker alone would pass on a tree holding a session per module. Both are checked, and
    // both currently declare nothing, which is the state the requirement describes.
    expect(retainedBindings(workerSource)).toEqual([]);
    expect(retainedBindings(creationSource)).toEqual([]);
  });

  it("reports a planted binding in either file, and does not report an indented one", () => {
    // **Two controls in one case, because the reader has to discriminate in both directions.** A
    // reader matching any `const` would report the worker's correct per-request storage read and
    // this would fail — and a reader matching nothing would report neither planted binding and this
    // would fail too. Neither can pass, which is the only reason either assertion means anything.
    for (const source of [workerSource, creationSource]) {
      expect(
        retainedBindings(`${source}\nconst kept = somethingExpensive();\n`),
        "a planted module-scope binding must be reported",
      ).toHaveLength(1);

      // **The indentation arm, and it is the one that protects correct code.** `service-worker.ts`
      // reads its storage area inside the listener on purpose, so this is a shape the repository
      // ships and a rule that flagged it would be deleted on the first run in a stranger's tree.
      expect(
        retainedBindings(`${source}\nfunction listener() {\n  const inside = something();\n}\n`),
        "a binding inside a function is per-request and must not be reported",
      ).toEqual([]);
    }
  });

  it("declares the surfaces the manifest names", () => {
    // A worker that had stopped being referenced would still satisfy the rules
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
