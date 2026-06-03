import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { registerInferCommand } from "../src/commands/infer";
import { VegaPaperError } from "../src/core/errors";
import { inferVegaLiteSpec } from "../src/core/infer";
import type { InferRequest, InferResult } from "../src/core/infer";
import type { LintResult } from "../src/core/lint";
import type { RenderRequest, RenderResult } from "../src/core/render";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("infer command", () => {
  test("writes only the generated spec when --spec-out is provided", async () => {
    const workspace = await createWorkspace();
    const specOutputPath = join(workspace, "figures", "chart.vl.json");
    const calls = createSpies();

    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--spec-out",
        specOutputPath,
      ],
      {
        ...calls,
        infer: async (request) => {
          calls.inferCalls.push(request);
          return createInferResult("../results.csv");
        },
      },
    );

    expect(calls.inferCalls).toEqual([
      {
        inputPath: "results.csv",
        chart: "line",
        xField: "epoch",
        yField: "score",
        specOutputPath,
      },
    ]);
    expect(calls.renderCalls).toEqual([]);
    expect(await readSpec(specOutputPath)).toEqual(createInferResult("../results.csv").spec);
  });

  test("writes a sibling .vl.json and renders when only --out is provided", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const calls = createSpies();

    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "bar",
        "--x",
        "label",
        "--y",
        "value",
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async (request) => {
          calls.inferCalls.push(request);
          return createInferResult("../results.csv");
        },
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    const specOutputPath = join(workspace, "figures", "chart.vl.json");

    expect(calls.inferCalls).toEqual([
      {
        inputPath: "results.csv",
        chart: "bar",
        xField: "label",
        yField: "value",
        specOutputPath,
      },
    ]);
    expect(calls.renderCalls).toEqual([
      {
        inputPath: specOutputPath,
        outputPath,
        format: "svg",
        themeName: undefined,
      },
    ]);
    expect(await readSpec(specOutputPath)).toEqual(createInferResult("../results.csv").spec);
  });

  test("renders from the explicit spec path when both --spec-out and --out are provided", async () => {
    const workspace = await createWorkspace();
    const specOutputPath = join(workspace, "specs", "custom.vl.json");
    const outputPath = join(workspace, "figures", "chart.svg");
    const calls = createSpies();

    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "scatter",
        "--x",
        "epoch",
        "--y",
        "score",
        "--spec-out",
        specOutputPath,
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async (request) => {
          calls.inferCalls.push(request);
          return createInferResult("../results.csv");
        },
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(calls.renderCalls).toEqual([
      {
        inputPath: specOutputPath,
        outputPath,
        format: "svg",
        themeName: undefined,
      },
    ]);
  });

  test("passes --theme through to the render runner", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const calls = createSpies();

    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--theme",
        "paper-clean",
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async (request) => {
          calls.inferCalls.push(request);
          return createInferResult("../results.csv");
        },
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(calls.renderCalls).toEqual([
      {
        inputPath: join(workspace, "figures", "chart.vl.json"),
        outputPath,
        format: "svg",
        themeName: "paper-clean",
      },
    ]);
  });

  test("runs lint on the saved spec path before rendering", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const specOutputPath = join(workspace, "figures", "chart.vl.json");
    const calls = createSpies();

    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async (request) => {
          calls.inferCalls.push(request);
          return createInferResult("../results.csv");
        },
        lint: async (inputPath, profileName) => {
          calls.lintCalls.push({ inputPath, profileName });
          return cleanLintResult();
        },
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(calls.lintCalls).toEqual([
      { inputPath: specOutputPath, profileName: "paper" },
    ]);
    expect(calls.renderCalls).toHaveLength(1);
  });

  test("prefers explicit --spec-out as the lint target when rendering", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const specOutputPath = join(workspace, "specs", "custom.vl.json");
    const calls = createSpies();

    await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--spec-out",
        specOutputPath,
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async (request) => {
          calls.inferCalls.push(request);
          return createInferResult("../results.csv");
        },
        lint: async (inputPath, profileName) => {
          calls.lintCalls.push({ inputPath, profileName });
          return cleanLintResult();
        },
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(calls.lintCalls).toEqual([
      { inputPath: specOutputPath, profileName: "paper" },
    ]);
    expect(calls.renderCalls).toEqual([
      {
        inputPath: specOutputPath,
        outputPath,
        format: "svg",
        themeName: undefined,
      },
    ]);
  });

  test("sets a failing exit code and stops before render when lint returns an error", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const specOutputPath = join(workspace, "figures", "chart.vl.json");
    const calls = createSpies();

    const output = await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        ...calls,
        infer: async () => createInferResult("../results.csv"),
        lint: async () =>
          createLintResult([
            {
              severity: "error",
              ruleId: "size-out-of-range",
              path: "$.width",
              message: "Width is too large.",
            },
          ]),
        render: async (request) => {
          calls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(output.exitCode).toBe(1);
    expect(calls.renderCalls).toEqual([]);
    expect(await readSpec(specOutputPath)).toEqual(createInferResult("../results.csv").spec);
  });

  test("treats warnings as blocking only in strict mode", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");
    const warningResult = createLintResult([
      {
        severity: "warning",
        ruleId: "axis-title-missing",
        path: "$.encoding.x",
        message: "Axis title is missing.",
      },
    ]);

    const strictCalls = createSpies();
    const strictOutput = await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--strict",
        "--out",
        outputPath,
      ],
      {
        ...strictCalls,
        infer: async () => createInferResult("../results.csv"),
        lint: async () => warningResult,
        render: async (request) => {
          strictCalls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(strictOutput.exitCode).toBe(1);
    expect(strictCalls.renderCalls).toEqual([]);

    const nonStrictCalls = createSpies();
    const nonStrictOutput = await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        ...nonStrictCalls,
        infer: async () => createInferResult("../results.csv"),
        lint: async () => warningResult,
        render: async (request) => {
          nonStrictCalls.renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(nonStrictOutput.exitCode).toBeUndefined();
    expect(nonStrictCalls.renderCalls).toHaveLength(1);
  });

  test("rejects --strict without --lint-profile", async () => {
    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--strict",
      ]),
    ).rejects.toThrow(
      new VegaPaperError('The "--strict" option requires "--lint-profile <name>".'),
    );
  });

  test("rejects unknown lint profiles before lint execution", async () => {
    const workspace = await createWorkspace();
    const specOutputPath = join(workspace, "figures", "chart.vl.json");
    const calls = createSpies();

    await expect(
      runInferCommand(
        [
          "infer",
          "results.csv",
          "--chart",
          "line",
          "--x",
          "epoch",
          "--y",
          "score",
          "--lint-profile",
          "unknown",
          "--spec-out",
          specOutputPath,
        ],
        {
          ...calls,
          infer: async (request) => {
            calls.inferCalls.push(request);
            return createInferResult("../results.csv");
          },
          writeSpec: async () => {
            calls.writeSpecCalls += 1;
          },
          lint: async (inputPath, profileName) => {
            calls.lintCalls.push({ inputPath, profileName });
            return cleanLintResult();
          },
        },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Unknown lint profile "unknown". Expected one of: paper, web, acl.'),
    );

    expect(calls.inferCalls).toEqual([]);
    expect(calls.lintCalls).toEqual([]);
    expect(calls.writeSpecCalls).toBe(0);
  });

  test("prints lint human output and still renders for non-strict warnings", async () => {
    const workspace = await createWorkspace();
    const outputPath = join(workspace, "figures", "chart.svg");

    const output = await runInferCommand(
      [
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--lint-profile",
        "paper",
        "--out",
        outputPath,
      ],
      {
        infer: async () => createInferResult("../results.csv"),
        lint: async () =>
          createLintResult([
            {
              severity: "warning",
              ruleId: "axis-title-missing",
              path: "$.encoding.x",
              message: "Axis title is missing.",
            },
          ]),
        render: async (request) => ({
          outputPath: request.outputPath,
          warnings: [],
        }),
      },
    );

    expect(output.stdout).toContain("1 warning, 0 errors");
    expect(output.stdout).toContain("axis-title-missing");
    expect(output.stdout).toContain(`Rendered ${outputPath}`);
    expect(output.exitCode).toBeUndefined();
  });

  test("rejects --theme without --out", async () => {
    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--theme",
        "paper-clean",
        "--spec-out",
        "chart.vl.json",
      ]),
    ).rejects.toThrow(
      new VegaPaperError('The "--theme" option requires "--out <path>".'),
    );
  });

  test("rejects missing both --out and --spec-out", async () => {
    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
      ]),
    ).rejects.toThrow(
      new VegaPaperError(
        'Missing output destination. Use "--spec-out <path>" and/or "--out <path>".',
      ),
    );
  });

  test("rejects missing --chart, --x, and --y with VegaPaperError", async () => {
    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--x",
        "epoch",
        "--y",
        "score",
        "--spec-out",
        "chart.vl.json",
      ]),
    ).rejects.toThrow(new VegaPaperError('Missing required option --chart <type>.'));

    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--y",
        "score",
        "--spec-out",
        "chart.vl.json",
      ]),
    ).rejects.toThrow(new VegaPaperError('Missing required option --x <field>.'));

    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--spec-out",
        "chart.vl.json",
      ]),
    ).rejects.toThrow(new VegaPaperError('Missing required option --y <field>.'));
  });

  test("rejects non-svg --out paths", async () => {
    await expect(
      runInferCommand([
        "infer",
        "results.csv",
        "--chart",
        "line",
        "--x",
        "epoch",
        "--y",
        "score",
        "--out",
        "chart.png",
      ]),
    ).rejects.toThrow(
      new VegaPaperError(
        'Unsupported output path "chart.png". This MVP supports only .svg outputs.',
      ),
    );
  });

  test("wraps spec write failures in VegaPaperError", async () => {
    await expect(
      runInferCommand(
        [
          "infer",
          "results.csv",
          "--chart",
          "line",
          "--x",
          "epoch",
          "--y",
          "score",
          "--spec-out",
          "/tmp/chart.vl.json",
        ],
        {
          infer: async () => createInferResult("../results.csv"),
          writeSpec: async () => {
            throw new Error("EACCES");
          },
        },
      ),
    ).rejects.toThrow(
      new VegaPaperError("Could not write generated spec to /tmp/chart.vl.json."),
    );
  });

  test("runs the real infer path and writes a generated spec", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "results.csv");
    const specOutputPath = join(workspace, "figures", "chart.vl.json");

    await writeFile(inputPath, "epoch,f1,model\n1,0.61,base\n2,0.68,large\n", "utf8");

    await runInferCommand([
      "infer",
      inputPath,
      "--chart",
      "line",
      "--x",
      "epoch",
      "--y",
      "f1",
      "--color",
      "model",
      "--spec-out",
      specOutputPath,
    ]);

    expect(await readSpec(specOutputPath)).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "../results.csv" },
      mark: "line",
      width: 360,
      height: 240,
      encoding: {
        x: { field: "epoch", type: "quantitative" },
        y: { field: "f1", type: "quantitative" },
        color: { field: "model", type: "nominal" },
      },
    });
  });
});

type InferCommandHarness = {
  infer?: (request: InferRequest) => Promise<InferResult>;
  render?: (request: RenderRequest) => Promise<RenderResult>;
  lint?: (
    inputPath: string,
    profileName: string | undefined,
  ) => Promise<LintResult>;
  writeSpec?: (specOutputPath: string, spec: InferResult["spec"]) => Promise<void>;
  inferCalls?: Array<Record<string, unknown>>;
  lintCalls?: Array<{ inputPath: string; profileName: string | undefined }>;
  renderCalls?: Array<Record<string, unknown>>;
};

async function runInferCommand(
  args: string[],
  harness: InferCommandHarness = {},
): Promise<{ stdout: string; exitCode: 0 | 1 | undefined }> {
  let stdout = "";
  let exitCode: 0 | 1 | undefined;
  const program = new Command();

  program.exitOverride();

  registerInferCommand(
    program,
    (value) => {
      stdout += value;
    },
    harness.infer ?? inferVegaLiteSpec,
    harness.render,
    harness.writeSpec,
    harness.lint,
    (value) => {
      exitCode = value;
    },
  );

  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, exitCode };
}

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-infer-command-"));
  temporaryDirectories.push(workspace);
  return workspace;
}

async function readSpec(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function createInferResult(dataUrl: string): InferResult {
  return {
    spec: {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: dataUrl },
      mark: "line",
      width: 360,
      height: 240,
      encoding: {
        x: { field: "epoch", type: "quantitative" },
        y: { field: "score", type: "quantitative" },
      },
    },
  };
}

function createLintResult(issues: LintResult["issues"]): LintResult {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    ok: errorCount === 0,
    issues,
    warningCount,
    errorCount,
  };
}

function cleanLintResult(): LintResult {
  return createLintResult([]);
}

function createSpies(): {
  inferCalls: InferRequest[];
  lintCalls: Array<{ inputPath: string; profileName: string | undefined }>;
  renderCalls: RenderRequest[];
  writeSpecCalls: number;
} {
  return {
    inferCalls: [],
    lintCalls: [],
    renderCalls: [],
    writeSpecCalls: 0,
  };
}
