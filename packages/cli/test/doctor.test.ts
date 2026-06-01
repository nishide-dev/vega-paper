import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerDoctorCommand } from "../src/commands/doctor";
import {
  type DoctorCheck,
  getDoctorExitCode,
  runDoctorChecks,
  type DoctorEnvironment,
} from "../src/core/doctor";

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
      resolveVegaCliBinary: async (name) => {
        if (name === "vl2svg") {
          return "node_modules/.bun/vega-lite/bin/vl2svg";
        }

        if (name === "vg2svg") {
          return "node_modules/.bun/vega-cli/bin/vg2svg";
        }

        return undefined;
      },
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

  test("accepts PATH-only Vega binaries in the default environment", async () => {
    await withTemporaryWorkspace(async (workspace, pathDir) => {
      const fakeNode = join(pathDir, "node");
      const fakeVl2svg = join(pathDir, "vl2svg");
      const fakeVg2svg = join(pathDir, "vg2svg");

      await createExecutable(
        join(workspace, "node_modules", ".bin", "vega-paper"),
        "#!/bin/sh\nexit 0\n",
      );
      await createExecutable(fakeNode, "#!/bin/sh\necho v99.0.0\nexit 0\n");
      await createExecutable(fakeVl2svg, "#!/bin/sh\nexit 0\n");
      await createExecutable(fakeVg2svg, "#!/bin/sh\nexit 0\n");

      const checks = await runDoctorChecks();

      expect(checks.find((check) => check.name === "node")).toEqual({
        name: "node",
        status: "ok",
        message: "v99.0.0",
        required: true,
      });
      expect(checks.find((check) => check.name === "vl2svg")).toEqual({
        name: "vl2svg",
        status: "ok",
        message: fakeVl2svg,
        required: true,
      });
      expect(checks.find((check) => check.name === "vg2svg")).toEqual({
        name: "vg2svg",
        status: "ok",
        message: fakeVg2svg,
        required: true,
      });
    });
  });

  test("fails the node check when PATH node is missing in the default environment", async () => {
    await withTemporaryWorkspace(async () => {
      const checks = await runDoctorChecks();

      expect(checks.find((check) => check.name === "node")).toEqual({
        name: "node",
        status: "fail",
        message: "not found",
        required: true,
      });
    });
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
    const failingChecks: DoctorCheck[] = [
      { name: "bun", status: "fail", message: "not found", required: true },
    ];

    const output = await runDoctorCommand(["doctor", "--json"], failingChecks);

    expect(output.exitCode).toBe(1);
  });
});

async function runDoctorCommand(
  args: string[],
  checks: DoctorCheck[],
): Promise<{ stdout: string; exitCode: 0 | 1 | undefined }> {
  let stdout = "";
  let exitCode: 0 | 1 | undefined;
  const program = new Command();

  program.exitOverride();

  registerDoctorCommand(
    program,
    (value) => {
      stdout += value;
    },
    async () => checks,
    (value) => {
      exitCode = value;
    },
  );
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, exitCode };
}

async function withTemporaryWorkspace<T>(
  callback: (workspace: string, pathDir: string) => Promise<T>,
): Promise<T> {
  const previousCwd = process.cwd();
  const previousPath = process.env.PATH;
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-doctor-test-"));
  const pathDir = join(workspace, "path-bin");

  await mkdir(pathDir, { recursive: true });
  process.chdir(workspace);
  process.env.PATH = pathDir;

  try {
    return await callback(workspace, pathDir);
  } finally {
    process.chdir(previousCwd);
    process.env.PATH = previousPath;
    await rm(workspace, { force: true, recursive: true });
  }
}

async function createExecutable(path: string, contents: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, contents, { encoding: "utf8", mode: 0o755 });
}
