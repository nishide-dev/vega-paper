import type { Command } from "commander";
import { lintSpec, type LintResult } from "../core/lint";
import { formatTable, toPrettyJson } from "../core/format";

type LintOptions = {
  json?: boolean;
  strict?: boolean;
};

type WriteOutput = (value: string) => void;
type RunLint = (inputPath: string) => Promise<LintResult>;
type SetExitCode = (exitCode: 0 | 1) => void;

export function registerLintCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runLint: RunLint = (inputPath) => lintSpec({ inputPath }),
  setExitCode: SetExitCode = (exitCode) => {
    process.exitCode = exitCode;
  },
): void {
  program
    .command("lint")
    .argument("<spec>", "Vega or Vega-Lite JSON input path")
    .description("Check a Vega or Vega-Lite spec for paper figure issues")
    .option("--json", "print JSON")
    .option("--strict", "exit with code 1 when warnings are present")
    .action(async (inputPath: string, options: LintOptions) => {
      const result = await runLint(inputPath);
      const exitCode = getLintExitCode(result, Boolean(options.strict));

      if (options.json) {
        writeOutput(toPrettyJson(result));
      } else if (result.issues.length === 0) {
        writeOutput("No lint issues found.\n");
      } else {
        writeOutput(formatHumanLintResult(result));
      }

      if (exitCode !== 0) {
        setExitCode(exitCode);
      }
    });
}

export function getLintExitCode(result: LintResult, strict: boolean): 0 | 1 {
  if (result.errorCount > 0) {
    return 1;
  }

  if (strict && result.warningCount > 0) {
    return 1;
  }

  return 0;
}

function formatHumanLintResult(result: LintResult): string {
  const summary = `${formatCount(result.warningCount, "warning")}, ${formatCount(
    result.errorCount,
    "error",
  )}`;
  const table = formatTable({
    headers: ["severity", "rule", "path", "message"],
    rows: result.issues.map((issue) => [
      issue.severity,
      issue.ruleId,
      issue.path,
      issue.message,
    ]),
  });

  return `${summary}\n${table}\n`;
}

function formatCount(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
