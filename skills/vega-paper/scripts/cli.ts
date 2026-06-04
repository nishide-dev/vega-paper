import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export function resolveRepoRoot(): string {
  return join(SCRIPT_DIR, "../../..");
}

export function resolveCliEntry(repoRoot: string = resolveRepoRoot()): string {
  return join(repoRoot, "packages/cli/src/index.ts");
}

export type SpawnProcess = {
  exited: Promise<number>;
};

export type SpawnFn = (command: string[], options: { cwd: string }) => SpawnProcess;

export const defaultSpawn: SpawnFn = (command, options) => Bun.spawn({ cmd: command, ...options });

export function printUsage(scriptName: string, lines: string[]): never {
  console.error(`Usage: bun run skills/vega-paper/scripts/${scriptName} ${lines.join("\n       ")}`);
  process.exit(1);
}

export function missingOptionValue(flag: string): never {
  console.error(`Missing value for ${flag}.`);
  process.exit(1);
}
