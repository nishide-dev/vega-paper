import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { registerDoctorCommand } from "../src/commands/doctor";
import {
  type DoctorCheck,
  getDoctorExitCode,
  runDoctorChecks,
  type DoctorEnvironment,
} from "../src/core/doctor";

type ProcessExitCode = typeof process.exitCode;

describe("doctor core", () => {
  test("returns exit code 0 when required checks pass and optional checks warn", () => {
    expect(
      getDoctorExitCode([
        { name: "bun", status: "ok", message: "1.3.14", required: true },
        { name: "pdf/png", status: "warn", message: "not checked", required: false },
      ]),
    ).toBe(0);
  });

  test("returns exit code 1 when a required check fails", () => {
    expect(
      getDoctorExitCode([
        { name: "bun", status: "fail", message: "not found", required: true },
        { name: "pdf/png", status: "warn", message: "not checked", required: false },
      ]),
    ).toBe(1);
  });

  test("runs injected checks", async () => {
    const environment: DoctorEnvironment = {
      getBunVersion: async () => "1.3.14",
      getNodeVersion: async () => "v25.9.0",
      resolveExecutable: async (name) =>
        name === "vega-paper" ? "node_modules/.bin/vega-paper" : undefined,
      resolveVegaCliBinary: async (name) =>
        name === "vl2svg" ? "node_modules/.bun/vega-lite/bin/vl2svg" : "node_modules/.bun/vega-cli/bin/vg2svg",
    };

    expect(await runDoctorChecks(environment)).toEqual([
      { name: "bun", status: "ok", message: "1.3.14", required: true },
      { name: "node", status: "ok", message: "v25.9.0", required: true },
      {
        name: "vega-paper bin",
        status: "ok",
        message: "node_modules/.bin/vega-paper",
        required: true,
      },
      {
        name: "vl2svg",
        status: "ok",
        message: "node_modules/.bun/vega-lite/bin/vl2svg",
        required: true,
      },
      {
        name: "vg2svg",
        status: "ok",
        message: "node_modules/.bun/vega-cli/bin/vg2svg",
        required: true,
      },
      {
        name: "pdf/png",
        status: "warn",
        message: "not checked in this MVP",
        required: false,
      },
    ]);
  });
});

describe("doctor command", () => {
  const passingChecks: DoctorCheck[] = [
    { name: "bun", status: "ok", message: "1.3.14", required: true },
    {
      name: "pdf/png",
      status: "warn",
      message: "not checked in this MVP",
      required: false,
    },
  ];

  test("prints doctor checks as JSON", async () => {
    const output = await runDoctorCommand(["doctor", "--json"], passingChecks);
    const parsed = JSON.parse(output.stdout);

    expect(parsed).toEqual({ checks: passingChecks });
  });

  test("prints doctor checks as a table", async () => {
    const output = await runDoctorCommand(["doctor"], passingChecks);

    expect(output.stdout).toContain("status  name     message");
    expect(output.stdout).toContain("ok      bun      1.3.14");
    expect(output.stdout).toContain("warn    pdf/png  not checked in this MVP");
  });

  test("sets exit code 1 for failing required checks without leaking it", async () => {
    const originalExitCode = process.exitCode;
    const failingChecks: DoctorCheck[] = [
      { name: "bun", status: "fail", message: "not found", required: true },
    ];

    try {
      process.exitCode = 7;
      const previousExitCode = process.exitCode;
      const output = await runDoctorCommand(["doctor", "--json"], failingChecks);

      expect(output.exitCode).toBe(1);
      expect(process.exitCode).toBe(previousExitCode);
    } finally {
      restoreExitCode(originalExitCode);
    }
  });
});

async function runDoctorCommand(
  args: string[],
  checks: DoctorCheck[],
): Promise<{ stdout: string; exitCode: ProcessExitCode }> {
  let stdout = "";
  const program = new Command();
  const previousExitCode = process.exitCode;

  program.exitOverride();

  try {
    registerDoctorCommand(
      program,
      (value) => {
        stdout += value;
      },
      async () => checks,
    );
    await program.parseAsync(["node", "vega-paper", ...args]);

    return { stdout, exitCode: process.exitCode };
  } finally {
    restoreExitCode(previousExitCode);
  }
}

function restoreExitCode(exitCode: ProcessExitCode): void {
  if (exitCode === undefined && process.exitCode === undefined) {
    return;
  }

  process.exitCode = exitCode ?? 0;
}
