import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { registerInferCommand } from "../src/commands/infer";
import { VegaPaperError } from "../src/core/errors";
import type { InferResult } from "../src/core/infer";
import type { RenderResult } from "../src/core/render";

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
});

type InferCommandHarness = {
  infer?: (request: {
    inputPath: string;
    chart: "line" | "bar" | "scatter";
    xField: string;
    yField: string;
    colorField?: string | undefined;
    title?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    specOutputPath: string;
  }) => Promise<InferResult>;
  render?: (request: {
    inputPath: string;
    outputPath: string;
    format: "svg";
    themeName?: string | undefined;
  }) => Promise<RenderResult>;
  inferCalls?: Array<Record<string, unknown>>;
  renderCalls?: Array<Record<string, unknown>>;
};

async function runInferCommand(
  args: string[],
  harness: InferCommandHarness = {},
): Promise<{ stdout: string }> {
  let stdout = "";
  const program = new Command();

  program.exitOverride();

  registerInferCommand(
    program,
    (value) => {
      stdout += value;
    },
    harness.infer,
    harness.render,
  );

  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout };
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

function createSpies(): {
  inferCalls: Array<Record<string, unknown>>;
  renderCalls: Array<Record<string, unknown>>;
} {
  return {
    inferCalls: [],
    renderCalls: [],
  };
}
