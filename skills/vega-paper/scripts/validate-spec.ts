import {
  defaultSpawn,
  missingOptionValue,
  printUsage,
  resolveCliEntry,
  resolveRepoRoot,
  type SpawnFn,
} from "./cli";

export type ValidateSpecOptions = {
  specPath: string;
  lintProfile: string;
  strict: boolean;
};

export function buildValidateSpecCommand(
  repoRoot: string,
  options: ValidateSpecOptions,
): string[] {
  const command = [
    "bun",
    resolveCliEntry(repoRoot),
    "lint",
    options.specPath,
    "--profile",
    options.lintProfile,
  ];

  if (options.strict) {
    command.push("--strict");
  }

  return command;
}

export function parseValidateSpecArgs(argv: string[]): ValidateSpecOptions {
  const positional: string[] = [];
  let lintProfile = "paper";
  let strict = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--lint-profile" || arg === "--profile") {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("-")) {
        missingOptionValue(arg);
      }

      lintProfile = value;
      index += 1;
      continue;
    }

    if (arg === "--strict") {
      strict = true;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }

    positional.push(arg);
  }

  if (positional.length !== 1) {
    printUsage("validate-spec.ts", ["<spec>", "[--lint-profile paper]", "[--strict]"]);
  }

  return {
    specPath: positional[0] as string,
    lintProfile,
    strict,
  };
}

export async function runValidateSpec(
  options: ValidateSpecOptions,
  spawn: SpawnFn = defaultSpawn,
  repoRoot: string = resolveRepoRoot(),
): Promise<number> {
  const command = buildValidateSpecCommand(repoRoot, options);
  const process = spawn(command, { cwd: repoRoot });
  return process.exited;
}

if (import.meta.main) {
  const exitCode = await runValidateSpec(parseValidateSpecArgs(process.argv.slice(2)));
  process.exitCode = exitCode;
}
