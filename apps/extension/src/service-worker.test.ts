/**
 * The service worker's absences, asserted rather than reviewed.
 *
 * ## Why a test reads source text for this
 *
 * The claims are about what the worker does **not** contain, and about what it does not decide twice.
 * There is no return value to inspect and no call to make — a listener that was *not* written is
 * precisely the thing a behavioural test cannot observe, since an empty worker and a worker that
 * quietly polls both pass every call-based assertion. **And retention is the same shape: a session
 * held between events is a reference in a scope, and a scope is not something a caller can
 * observe.**
 *
 * So the assertions are on the source, and that is a real limit worth stating rather than hiding:
 * **this test proves the shipped worker source arms no timer of its own, names no platform member,
 * declares no module-scope binding, and decides the alarm's period and name in exactly one place.**
 * It cannot prove a runtime with a different code path behaves that way, and it is a weaker
 * instrument than a behavioural test would be — accepted because the alternative is no instrument at
 * all for a requirement that exists to stop something being added by accident.
 *
 * ## The first rule's *name* was false, and only its name
 *
 * This file used to assert that the worker "arms no alarm". **`incoming-mail-notification` gave the
 * worker one alarm**, so that sentence became false while the rule behind it did not: the worker
 * still creates no alarm itself and still schedules no timer, because the schedule reaches the
 * platform through `extension-platform.ts` and the decision reaches it through `alarms.ts`. The rule
 * is retained with a corrected claim, because the alternative — deleting a rule whose underlying
 * property still holds — is the retired-rule defect this repository records twice.
 *
 * The rules about `createMailboxSession` and `createExtensionProviderManager` had gone on passing *by
 * import indirection* long before this and were replaced then: the worker names neither, because
 * `create-mailbox.ts` does. That is the thirty-first recorded instance of a check narrower than its
 * rule, and the first one **true while guarding nothing at all**. What replaced them is the property
 * the amendment to the requirement names: **the worker keeps nothing after it has answered.**
 * Retention cannot be forbidden by naming the things it might hold — there are too many, and a
 * session is reachable through a function call — so it is forbidden by the shape it must have: **a
 * retained value needs a binding, and a module-scope binding is the only one that survives a
 * request.**
 *
 * ## The two new rules are about *where a decision is made*, and that is why they scan a directory
 *
 * "Exactly one alarm" and "the period is the cadence's" are both true of `alarms.ts` alone and both
 * could be broken by a second module restating either. `alarms.test.ts` holds the first of those
 * claims for its own file; the rules here hold them **across the directory**, so a module that
 * spelled its own period would be reported by name rather than left to a reader nobody re-reads.
 * Their roots are the files on disk rather than a list, so a module added tomorrow is covered by
 * being created rather than by being remembered.
 *
 * ## Every rule plants its forbidden shape into a copy of the real source
 *
 * Deleting this file leaves the suite green, because nothing else observes the worker's contents.
 * That is exactly why each rule is paired with a control — so each reader is proven able to fail,
 * not merely present. A reader that reported everything would satisfy a control and no rule; a reader
 * that reported nothing would satisfy a rule and no control. **The value is in the discrimination,
 * which is why the retention rule's control also asserts the shape it must *not* report.**
 *
 * @vitest-environment node
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = fileURLToPath(new URL(".", import.meta.url));

const WORKER_PATH = fileURLToPath(new URL("./service-worker.ts", import.meta.url));
const CREATION_PATH = fileURLToPath(new URL("./create-mailbox.ts", import.meta.url));
const CHECK_PATH = fileURLToPath(new URL("./background-check.ts", import.meta.url));

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
 * Calls that would constitute ambient background work *in the worker file itself*.
 *
 * **`setTimeout` and `setInterval` are here because the shared session's scheduler is
 * built from them.** A worker that kept a session and drove it would schedule through
 * exactly these, so their absence in *this file* is what "schedules nothing itself" reduces to
 * on this platform. `chrome.alarms` is here for the same reason in the same shape: the worker
 * arms one alarm, through a seam, and naming `chrome.alarms` here would mean it had reached past
 * the module that owns the platform global — which the architecture boundary rule already forbids
 * for the whole client, and which is repeated here only because this file's claim is about the
 * worker and a reader that could not see the worker's own arms would be a reader guarding nothing.
 */
const FORBIDDEN_IN_WORKER = ["chrome.alarms", "setInterval", "setTimeout"] as const;

/**
 * Module-scope bindings, named by the shape a retained value would take.
 *
 * **Column-anchored, so an indented `const` does not count.** `service-worker.ts` reads the
 * storage area *inside* each of its listeners and *must*: caching a platform handle at module
 * scope would pin it for the lifetime of a context whose lifetime is unmeasured. So a reader
 * that ignored indentation would report the correct code as a violation — and a rule that
 * fires on correct code gets deleted, which is the same failure as a rule that fires on
 * nothing.
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

/**
 * Every shipped module's code, keyed by file name.
 *
 * **Read from the directory rather than listed, and test files excluded.** A reader whose roots
 * were a list would need that list edited when a module was added, and the failure mode is the
 * silent one: a module nobody remembered is a module nobody scans. The exclusion is by name
 * because a test file naming the period is a *reader* of the decision rather than a second place
 * it is made — and `alarms.test.ts` does name it, which is the point.
 */
function shippedModules(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(SOURCE_DIRECTORY)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => [
        name,
        code(readFileSync(new URL(name, `file://${SOURCE_DIRECTORY}`), "utf8")),
      ]),
  );
}

/** The names of the shipped modules whose code mentions `token`, sorted so a mismatch reads. */
function modulesNaming(
  token: string,
  sources: Record<string, string> = shippedModules(),
): string[] {
  return Object.entries(sources)
    .filter(([, contents]) => contents.includes(token))
    .map(([name]) => name)
    .sort();
}

/**
 * The worker's own listeners on `self`, by the event name each was registered for.
 *
 * **Read as a list rather than counted, because the claim is which two and not how many.** A count
 * of two is satisfied by two different events; the claim this file makes is that the only listeners
 * this worker attaches to itself are the two that stay empty.
 */
function selfListeners(contents: string): string[] {
  return [...code(contents).matchAll(/self\.addEventListener\(\s*"([^"]+)"/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("the extension's background service worker", () => {
  it("arms no alarm itself and schedules nothing of its own", () => {
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

  it("attaches only the two listeners that stay empty, so every platform listener goes through the seam", () => {
    // **The positive half of the rule above, and it is the half that can fail quietly.** A worker
    // that registered its own `fetch` or `webRequest` listener would hold nothing and arm no timer
    // and satisfy both assertions above while doing ambient work on somebody else's page. So the two
    // rules stand together: this one says what it *may* attach, and the other says what it may not.
    expect(selfListeners(workerSource)).toEqual(["install", "activate"]);

    // **And the control in the other direction**, because a reader matching nothing would satisfy the
    // assertion above for ever.
    const mutated = `${workerSource}\nself.addEventListener("fetch", () => {});\n`;
    expect(selfListeners(mutated)).toContain("fetch");
  });

  it("retains nothing, so a woken worker and a cold one behave identically", () => {
    // **The rule the amendment to the requirement asks for, and it covers three files.** The worker
    // is where a retained session would most obviously live; `create-mailbox.ts` is where creation
    // happens; `background-check.ts` is where the *alarm* path builds one — and that third file is
    // the one this change added, so a rule not extended to it would have been a rule that stopped
    // covering the newest way this worker can hold a session.
    expect(retainedBindings(workerSource)).toEqual([]);
    expect(retainedBindings(creationSource)).toEqual([]);
    expect(retainedBindings(readFileSync(CHECK_PATH, "utf8"))).toEqual([]);
  });

  it("reports a planted binding in any of the three, and does not report an indented one", () => {
    // **Two controls in one case, because the reader has to discriminate in both directions.** A
    // reader matching any `const` would report the worker's correct per-request storage read and
    // this would fail — and a reader matching nothing would report neither planted binding and this
    // would fail too. Neither can pass, which is the only reason either assertion means anything.
    for (const source of [workerSource, creationSource, readFileSync(CHECK_PATH, "utf8")]) {
      expect(
        retainedBindings(`${source}\nconst kept = somethingExpensive();\n`),
        "a planted module-scope binding must be reported",
      ).toHaveLength(1);

      // **The indentation arm, and it is the one that protects correct code.** Every one of these
      // three files builds its session inside a function on purpose, so this is a shape the
      // repository ships and a rule that flagged it would be deleted on the first run in a
      // stranger's tree.
      expect(
        retainedBindings(`${source}\nfunction listener() {\n  const inside = something();\n}\n`),
        "a binding inside a function is per-request and must not be reported",
      ).toEqual([]);
    }
  });

  it("decides the alarm's period in one module, and restates it in none", () => {
    // **The structural half of the cadence claim.** `alarms.test.ts` holds it for `alarms.ts` on its
    // own; this holds it across the directory, so the defect it forbids — a second module spelling
    // the period so it can drift from `packages/mailbox`'s cadence — is reported by name wherever it
    // is committed. The second file listed is `alarms.ts` itself and nothing else, so a module that
    // merely *passed the period on* could not satisfy this: the period is not a parameter anywhere.
    expect(modulesNaming("INBOX_POLL_PROMPT_MS")).toEqual(["alarms.ts"]);

    // **The control**, planted into a copy of a real module under a name no shipped file uses, so a
    // reader that had stopped matching would report nothing here.
    const planted = { ...shippedModules(), "__planted.ts": "const p = INBOX_POLL_PROMPT_MS;" };
    expect(modulesNaming("INBOX_POLL_PROMPT_MS", planted)).toContain("__planted.ts");
  });

  it("names the alarm in the one module that owns it and the one module that recognises it", () => {
    // **Two names, and the second is the falsifiable half.** The alarm's identity is *created* in
    // `alarms.ts` and *compared* in `service-worker.ts`, because the comparison lives where a fired
    // alarm is recognised and a filter upstream would make "exactly one alarm" unfalsifiable. A
    // third module naming it would be a second place the identity is spelled.
    expect(modulesNaming("BACKGROUND_ALARM_NAME")).toEqual(["alarms.ts", "service-worker.ts"]);

    const planted = { ...shippedModules(), "__planted.ts": "const n = BACKGROUND_ALARM_NAME;" };
    expect(modulesNaming("BACKGROUND_ALARM_NAME", planted)).toContain("__planted.ts");
  });

  it("declares the surfaces the manifest names", () => {
    // A worker that had stopped being referenced would still satisfy the rules
    // above, because all of them are absences. This is the positive half: the manifest's
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
