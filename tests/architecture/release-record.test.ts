/**
 * The release procedure in `docs/RELEASE.md`, held to the scripts it names.
 *
 * ## Why this is an architecture case
 *
 * A procedure that names a command nobody can run is worse than no procedure: it reads as a step a
 * maintainer has verified, and it fails only when somebody tries it. **The check reads the
 * repository's own `package.json` scripts rather than carrying a list of its own**, because a second
 * list would be the second spelling of a set this repository records as a defect — the first thing
 * that drifted would be the list, and the document would keep passing.
 *
 * ## The three directions
 *
 * - **Document → scripts**: every `pnpm` command in the procedure resolves to a script a package on
 *   disk actually declares. A renamed script is reported by name.
 * - **Document → decisions**: both steps that need a host or an account are named as outstanding,
 *   and the document does not call the release complete.
 * - **Document → itself**: it carries no version literal, and the reader is run against a planted
 *   command that does not exist, so a reader that matched nothing cannot pass.
 *
 * ## What this does not establish
 *
 * **That any step was run.** This file checks that the procedure is coherent, not that a maintainer
 * followed it. Steps 4 and 5 of the document are outstanding by design, and nothing here turns them
 * into passes.
 *
 * @module
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(join(here, "..", ".."));

export const RELEASE_DOCUMENT_PATH = join(repositoryRoot, "docs", "RELEASE.md");

/** Every `pnpm <script>` command in a procedure, including `--filter <pkg>` forms. */
export interface NamedCommand {
  readonly line: string;
  readonly packageName: string | undefined;
  readonly script: string;
}

/**
 * Read the commands from a procedure's fenced blocks.
 *
 * **Only fenced `text` blocks are read**, so the prose explaining a command — which names other
 * `pnpm` invocations in passing — is not mistaken for a step. A command in prose is an explanation;
 * a command in the procedure block is a step a maintainer is told to run.
 */
export function readCommands(document: string): NamedCommand[] {
  const blocks = [...document.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
  const commands: NamedCommand[] = [];
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("pnpm ")) continue;
      const filtered = trimmed.match(/^pnpm\s+--filter\s+(\S+)\s+(\S+)/);
      if (filtered) {
        commands.push({ line: trimmed, packageName: filtered[1], script: filtered[2] ?? "" });
        continue;
      }
      const plain = trimmed.match(/^pnpm\s+(\S+)/);
      if (plain) commands.push({ line: trimmed, packageName: undefined, script: plain[1] ?? "" });
    }
  }
  return commands;
}

/** The scripts a package declares, read from disk rather than from a list in this file. */
function scriptsOf(packageDirectory: string): Set<string> {
  const path = join(repositoryRoot, packageDirectory, "package.json");
  if (!existsSync(path)) return new Set();
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  return new Set(Object.keys(manifest.scripts ?? {}));
}

/** The package directory a workspace package name maps to, discovered from disk. */
function workspaceDirectories(): Map<string, string> {
  const found = new Map<string, string>();
  for (const group of ["apps", "packages"]) {
    const base = join(repositoryRoot, group);
    for (const name of readdirNames(base)) {
      const manifestPath = join(base, name, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (typeof manifest.name === "string") found.set(manifest.name, join(group, name));
    }
  }
  return found;
}

function readdirNames(directory: string): string[] {
  return readdirSync(directory) as string[];
}

describe("the release procedure", () => {
  const document = readFileSync(RELEASE_DOCUMENT_PATH, "utf8");

  it("names only commands the repository actually exposes", () => {
    const commands = readCommands(document);
    expect(commands.length, "the procedure names no commands").toBeGreaterThan(0);

    const rootScripts = scriptsOf(".");
    const workspaces = workspaceDirectories();
    const builtIns = new Set(["install"]);

    const unresolved = commands.filter((command) => {
      if (command.packageName === undefined) {
        return !rootScripts.has(command.script) && !builtIns.has(command.script);
      }
      const directory = workspaces.get(command.packageName);
      return directory === undefined || !scriptsOf(directory).has(command.script);
    });

    expect(
      unresolved.map((command) => command.line),
      `commands in docs/RELEASE.md that the repository does not expose: ${unresolved.map((c) => c.line).join("; ")}`,
    ).toEqual([]);

    // **The reader's own negative control.** A planted command that does not exist is reported by
    // name; without this a reader that matched no commands at all would satisfy the assertion above.
    const planted = readCommands("```text\npnpm not-a-real-script\n```");
    expect(planted).toHaveLength(1);
    const plantedUnresolved = planted.filter(
      (command) => !rootScripts.has(command.script) && !builtIns.has(command.script),
    );
    expect(plantedUnresolved.map((command) => command.line)).toEqual(["pnpm not-a-real-script"]);
  });

  it("names both steps that need a decision the repository cannot make", () => {
    expect(document.toLowerCase()).toContain("deploy");
    expect(document.toLowerCase()).toContain("developer account");
    expect(document.toLowerCase()).toContain("outstanding");
    // **And it does not call the release complete.** A document that named both decisions but then
    // declared success would satisfy the first three assertions while saying the opposite.
    expect(document).not.toMatch(/release (?:is|was) complete/i);
  });

  it("carries no version number", () => {
    // **A version lives in the built manifest and nowhere else.** The one shape this document must
    // never acquire is a `1.2.3` that looks generated and drifts the first time a release is cut.
    expect(document.match(/\b\d+\.\d+\.\d+\b/g) ?? []).toEqual([]);
  });
});
