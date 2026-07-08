import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { registerLintCommand } from "../src/commands/lint";
import type { LintDomain, LintResult } from "../src/core/lint";
import { lintSpec, parseLintDomain } from "../src/core/lint";
import type { JsonObject } from "../src/core/spec";

describe("parseLintDomain", () => {
  test("accepts ml", () => {
    expect(parseLintDomain("ml")).toBe("ml");
  });

  test("throws a CLI error for unknown domains", () => {
    expect(() => parseLintDomain("web")).toThrow('Unknown lint domain "web". Expected one of: ml.');
  });
});

describe("lint command --domain", () => {
  test("passes domain to the lint runner", async () => {
    let receivedDomain: LintDomain | undefined;

    const output = await runLintCommandWithRunner(
      ["lint", "chart.vl.json", "--profile", "paper", "--domain", "ml"],
      async (_inputPath, _profileName, domain) => {
        receivedDomain = domain;
        return cleanLintResult();
      },
    );

    expect(output.stdout).toBe("No lint issues found.\n");
    expect(output.exitCode).toBeUndefined();
    expect(receivedDomain).toBe("ml");
  });

  test("passes undefined domain when --domain is omitted", async () => {
    let receivedDomain: LintDomain | undefined = "ml";

    await runLintCommandWithRunner(["lint", "chart.vl.json"], async (_input, _profile, domain) => {
      receivedDomain = domain;
      return cleanLintResult();
    });

    expect(receivedDomain).toBeUndefined();
  });

  test("propagates unknown domain errors", async () => {
    try {
      await runLintCommandWithRunner(["lint", "chart.vl.json", "--domain", "nlp"], async () =>
        cleanLintResult(),
      );
      throw new Error("Expected command to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Unknown lint domain "nlp". Expected one of: ml.');
    }
  });
});

describe("lintSpec with domain", () => {
  test("domain ml does not change results for a clean single-view spec", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec());

      const defaultResult = await lintSpec({ inputPath });
      const mlResult = await lintSpec({ inputPath, domain: "ml" });

      expect(defaultResult.issues).toEqual([]);
      expect(mlResult).toEqual(defaultResult);
    });
  });
});

// --- helpers -------------------------------------------------------------

function cleanVegaLiteSpec(overrides: JsonObject = {}): JsonObject {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title: "Accuracy by epoch",
    width: 360,
    height: 240,
    data: {
      values: [
        { epoch: 1, accuracy: 0.62, model: "baseline" },
        { epoch: 2, accuracy: 0.68, model: "baseline" },
      ],
    },
    mark: "line",
    encoding: {
      x: { field: "epoch", type: "quantitative", title: "Epoch" },
      y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
      color: { field: "model", type: "nominal", title: "Model" },
    },
    ...overrides,
  };
}

async function withTemporaryWorkspace(callback: (workspacePath: string) => Promise<void>) {
  const workspacePath = await mkdtemp(join(tmpdir(), "vega-paper-lint-ml-test-"));

  try {
    await callback(workspacePath);
  } finally {
    await rm(workspacePath, { force: true, recursive: true });
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value), "utf8");
}

function cleanLintResult(): LintResult {
  return { ok: true, errorCount: 0, warningCount: 0, issues: [] };
}

async function runLintCommandWithRunner(
  args: string[],
  runLint: (
    inputPath: string,
    profileName: string | undefined,
    domain: LintDomain | undefined,
  ) => Promise<LintResult>,
): Promise<{ stdout: string; exitCode: 0 | 1 | undefined }> {
  let stdout = "";
  let exitCode: 0 | 1 | undefined;
  const program = new Command();

  program.exitOverride();

  registerLintCommand(
    program,
    (value) => {
      stdout += value;
    },
    runLint,
    (value) => {
      exitCode = value;
    },
  );
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, exitCode };
}
