import {
  defaultSpawn,
  missingOptionValue,
  printUsage,
  resolveCliEntry,
  resolveRepoRoot,
  type SpawnFn,
} from "./cli";

export type RenderChartOptions = {
  specPath: string;
  outPath: string;
  theme: string;
};

export function buildRenderChartCommand(
  repoRoot: string,
  options: RenderChartOptions,
): string[] {
  return [
    "bun",
    resolveCliEntry(repoRoot),
    "render",
    options.specPath,
    "--theme",
    options.theme,
    "--format",
    "svg",
    "--out",
    options.outPath,
  ];
}

export function parseRenderChartArgs(argv: string[]): RenderChartOptions {
  const positional: string[] = [];
  let outPath: string | undefined;
  let theme = "paper-clean";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--out") {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("-")) {
        missingOptionValue(arg);
      }

      outPath = value;
      index += 1;
      continue;
    }

    if (arg === "--theme") {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("-")) {
        missingOptionValue(arg);
      }

      theme = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }

    positional.push(arg);
  }

  if (positional.length !== 1 || outPath === undefined) {
    printUsage("render-chart.ts", ["<spec>", "--out <path>", "[--theme paper-clean]"]);
  }

  return {
    specPath: positional[0] as string,
    outPath,
    theme,
  };
}

export async function runRenderChart(
  options: RenderChartOptions,
  spawn: SpawnFn = defaultSpawn,
  repoRoot: string = resolveRepoRoot(),
): Promise<number> {
  const command = buildRenderChartCommand(repoRoot, options);
  const process = spawn(command, { cwd: repoRoot });
  return process.exited;
}

if (import.meta.main) {
  const exitCode = await runRenderChart(parseRenderChartArgs(process.argv.slice(2)));
  process.exitCode = exitCode;
}
