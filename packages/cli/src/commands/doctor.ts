import type { Command } from "commander";
import {
  type DoctorCheck,
  getDoctorExitCode,
  runDoctorChecks,
} from "../core/doctor";
import { formatTable, toPrettyJson } from "../core/format";

type DoctorOptions = {
  json?: boolean;
};

type WriteOutput = (value: string) => void;
type RunChecks = () => Promise<DoctorCheck[]>;

export function registerDoctorCommand(
  program: Command,
  writeOutput: WriteOutput = (value) => {
    process.stdout.write(value);
  },
  runChecks: RunChecks = runDoctorChecks,
): void {
  program
    .command("doctor")
    .description("Check whether VegaPaper can render SVG charts")
    .option("--json", "print JSON")
    .action(async (options: DoctorOptions) => {
      const checks = await runChecks();
      const exitCode = getDoctorExitCode(checks);

      if (options.json) {
        writeOutput(toPrettyJson({ checks }));
      } else {
        writeOutput(
          `${formatTable({
            headers: ["status", "name", "message"],
            rows: checks.map((check) => [
              check.status,
              check.name,
              check.message,
            ]),
          })}\n`,
        );
      }

      if (exitCode !== 0) {
        process.exitCode = exitCode;
      }
    });
}
