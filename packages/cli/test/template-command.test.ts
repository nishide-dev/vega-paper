import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import {
  buildTemplateOptionsSnapshot,
  buildTemplateRequest,
  registerTemplateCommand,
} from "../src/commands/template";
import { VegaPaperError } from "../src/core/errors";
import type { FigureMeta } from "../src/core/figure-meta";
import type { RenderRequest, RenderResult } from "../src/core/render";
import type { JsonObject } from "../src/core/spec";
import type { TemplateTable } from "../src/core/template";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const BENCHMARK_CSV = "model,task,score\nBaseline,MMLU,68.2\nOurs,MMLU,72.4\n";
const PARETO_CSV =
  "model,family,score,latency_ms,params_b\n" +
  "TinyLM,baseline,68.1,12,1.3\n" +
  "BaseLM,baseline,72.4,28,7.0\n" +
  "Ours-S,ours,73.0,18,3.0\n" +
  "Ours-L,ours,77.2,42,13.0\n";

const RUNS_CSV =
  "method,seed,score\n" +
  "baseline,1,79.4\n" +
  "baseline,2,80.1\n" +
  "baseline,3,80.6\n" +
  "ours,1,83.2\n" +
  "ours,2,84.0\n" +
  "ours,3,83.6\n";

const STUB_TABLE: TemplateTable = { header: ["a"], rows: [] };
const stubLoadTable = async (): Promise<TemplateTable> => STUB_TABLE;

describe("template command", () => {
  test("writes only the generated spec when --spec-out is provided", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "figures", "chart.vl.json");
    await writeFile(inputPath, BENCHMARK_CSV, "utf8");

    const { stdout } = await runTemplateCommand([
      "template",
      "benchmark-heatmap",
      inputPath,
      "--x",
      "task",
      "--y",
      "model",
      "--score",
      "score",
      "--spec-out",
      specOutputPath,
    ]);

    const spec = (await readJson(specOutputPath)) as JsonObject;
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(stdout).toBe(`Wrote ${specOutputPath}\n`);
    expect(spec.data).toEqual({
      url: "../data.csv",
      format: { type: "csv", parse: { score: "number" } },
    });
    expect(layer).toHaveLength(2);
    expect(layer[0]?.mark).toBe("rect");
    expect(layer[1]?.mark).toBe("text");
  });

  test("renders a sibling spec and writes template figure meta when --out is provided", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const outputPath = join(workspace, "figures", "output.svg");
    const specOutputPath = join(workspace, "figures", "output.vl.json");
    const metaOutputPath = join(workspace, "figures", "output.meta.json");
    await writeFile(inputPath, PARETO_CSV, "utf8");
    const renderCalls: RenderRequest[] = [];

    const { stdout } = await runTemplateCommand(
      [
        "template",
        "pareto-frontier",
        inputPath,
        "--x",
        "latency_ms",
        "--y",
        "score",
        "--label",
        "model",
        "--color",
        "family",
        "--theme",
        "paper-clean",
        "--out",
        outputPath,
      ],
      {
        render: async (request) => {
          renderCalls.push(request);
          return { outputPath: request.outputPath, warnings: [] };
        },
      },
    );

    expect(renderCalls).toEqual([
      {
        inputPath: specOutputPath,
        outputPath,
        format: "svg",
        scale: 1,
        themeName: "paper-clean",
      },
    ]);
    expect(stdout).toContain(`Wrote ${specOutputPath}`);
    expect(stdout).toContain(`Rendered ${outputPath}`);
    expect(stdout).toContain(`Wrote ${metaOutputPath}`);

    const meta = (await readJson(metaOutputPath)) as Record<string, unknown>;

    expect(meta.generatedBy).toBe("vega-paper");
    expect(meta.command).toBe("template");
    expect(meta.template).toBe("pareto-frontier");
    expect(meta.input).toBe(inputPath);
    expect(meta.output).toBe(outputPath);
    expect(meta.specOut).toBe(specOutputPath);
    expect(meta.theme).toBe("paper-clean");
    expect(meta.format).toBe("svg");
    expect(meta.options).toEqual({
      x: "latency_ms",
      y: "score",
      label: "model",
      color: "family",
    });
  });

  test("rejects unknown template names", async () => {
    await expect(
      runTemplateCommand(["template", "sankey", "data.csv", "--spec-out", "chart.vl.json"], {
        loadTable: stubLoadTable,
      }),
    ).rejects.toThrow(
      new VegaPaperError(
        'Unknown template "sankey". Expected one of: benchmark-heatmap, pareto-frontier, scaling-law, calibration-curve, violin, ecdf, multipanel.',
      ),
    );
  });

  test("rejects missing required options per template", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "benchmark-heatmap",
          "data.csv",
          "--x",
          "task",
          "--y",
          "model",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(new VegaPaperError("Missing required option --score <field>."));

    await expect(
      runTemplateCommand(
        [
          "template",
          "calibration-curve",
          "data.csv",
          "--confidence",
          "confidence",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(new VegaPaperError("Missing required option --accuracy <field>."));
  });

  test("rejects options that are not supported by the template", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "pareto-frontier",
          "data.csv",
          "--x",
          "latency_ms",
          "--y",
          "score",
          "--score",
          "score",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('The "--score" option is not supported by template "pareto-frontier".'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--frontier",
          "max-y-min-x",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('The "--frontier" option is not supported by template "scaling-law".'),
    );
  });

  test("rejects invalid enum and numeric option values", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "pareto-frontier",
          "data.csv",
          "--x",
          "latency_ms",
          "--y",
          "score",
          "--frontier",
          "min-y",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "min-y" for --frontier. Expected: max-y-min-x.'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--x-scale",
          "sqrt",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "sqrt" for --x-scale. Expected one of: linear, log.'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--fit",
          "spline",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "spline" for --fit. Expected: regression.'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "calibration-curve",
          "data.csv",
          "--confidence",
          "confidence",
          "--accuracy",
          "accuracy",
          "--ece",
          "abc",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "abc" for --ece. Expected a finite non-negative number.'),
    );
  });

  test("writes a violin spec with panel sizing from the CSV categories", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "runs.csv");
    const specOutputPath = join(workspace, "chart-violin.vl.json");
    await writeFile(inputPath, RUNS_CSV, "utf8");

    await runTemplateCommand([
      "template",
      "violin",
      inputPath,
      "--x",
      "method",
      "--y",
      "score",
      "--width",
      "360",
      "--spec-out",
      specOutputPath,
    ]);

    const spec = (await readJson(specOutputPath)) as {
      facet: { field: string };
      spec: { width: number; transform: Array<{ density: string }> };
    };

    expect(spec.facet.field).toBe("method");
    expect(spec.spec.transform[0]?.density).toBe("score");
    // Two categories in RUNS_CSV: (360 - 60) / 2 = 150 per panel.
    expect(spec.spec.width).toBe(150);
  });

  test("writes an ecdf spec with color grouping and log x scale", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "runs.csv");
    const specOutputPath = join(workspace, "chart-ecdf.vl.json");
    await writeFile(inputPath, RUNS_CSV, "utf8");

    await runTemplateCommand([
      "template",
      "ecdf",
      inputPath,
      "--x",
      "score",
      "--color",
      "method",
      "--x-scale",
      "log",
      "--spec-out",
      specOutputPath,
    ]);

    const spec = (await readJson(specOutputPath)) as {
      layer: Array<{
        transform: Array<Record<string, unknown>>;
        encoding: { x: { scale: unknown }; color: { field: string } };
      }>;
    };

    expect(spec.layer[0]?.transform[0]?.groupby).toEqual(["method"]);
    expect(spec.layer[0]?.encoding.x.scale).toEqual({ type: "log" });
    expect(spec.layer[0]?.encoding.color.field).toBe("method");
  });

  test("rejects --bandwidth outside violin and invalid --bandwidth values", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--bandwidth",
          "0.5",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('The "--bandwidth" option is not supported by template "scaling-law".'),
    );

    await expect(
      runTemplateCommand(
        [
          "template",
          "violin",
          "data.csv",
          "--x",
          "method",
          "--y",
          "score",
          "--bandwidth",
          "-1",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(
      new VegaPaperError('Invalid value "-1" for --bandwidth. Expected a positive finite number.'),
    );
  });

  test("rejects --theme without --out and missing output destinations", async () => {
    await expect(
      runTemplateCommand(
        [
          "template",
          "scaling-law",
          "data.csv",
          "--x",
          "flops",
          "--y",
          "loss",
          "--theme",
          "paper-clean",
          "--spec-out",
          "chart.vl.json",
        ],
        { loadTable: stubLoadTable },
      ),
    ).rejects.toThrow(new VegaPaperError('The "--theme" option requires "--out <path>".'));

    await expect(
      runTemplateCommand(["template", "scaling-law", "data.csv", "--x", "flops", "--y", "loss"], {
        loadTable: stubLoadTable,
      }),
    ).rejects.toThrow(
      new VegaPaperError(
        'Missing output destination. Use "--spec-out <path>" and/or "--out <path>".',
      ),
    );
  });

  test("rejects non-csv input files", async () => {
    await expect(
      runTemplateCommand([
        "template",
        "scaling-law",
        "data.json",
        "--x",
        "flops",
        "--y",
        "loss",
        "--spec-out",
        "chart.vl.json",
      ]),
    ).rejects.toThrow(
      new VegaPaperError('Unsupported input format ".json". Template input must be a .csv file.'),
    );
  });

  test("snapshots violin and ecdf options for figure meta", () => {
    const table: TemplateTable = {
      header: ["method", "score"],
      rows: [["baseline", "80.0"]],
    };

    const violinRequest = buildTemplateRequest(
      "violin",
      "runs.csv",
      "chart.vl.json",
      { x: "method", y: "score", bandwidth: "0.5" },
      table,
    );
    expect(buildTemplateOptionsSnapshot(violinRequest)).toEqual({
      x: "method",
      y: "score",
      bandwidth: 0.5,
    });

    const ecdfRequest = buildTemplateRequest(
      "ecdf",
      "runs.csv",
      "chart.vl.json",
      { x: "score", color: "method", xScale: "log" },
      table,
    );
    expect(buildTemplateOptionsSnapshot(ecdfRequest)).toEqual({
      x: "score",
      color: "method",
      xScale: "log",
    });
  });
});

type TemplateCommandHarness = {
  render?: (request: RenderRequest) => Promise<RenderResult>;
  writeSpec?: (specOutputPath: string, spec: JsonObject) => Promise<void>;
  writeFigureMeta?: (metaOutputPath: string, meta: FigureMeta) => Promise<void>;
  loadTable?: (inputPath: string) => Promise<TemplateTable>;
};

async function runTemplateCommand(
  args: string[],
  harness: TemplateCommandHarness = {},
): Promise<{ stdout: string }> {
  let stdout = "";
  const program = new Command();

  program.exitOverride();

  registerTemplateCommand(
    program,
    (value) => {
      stdout += value;
    },
    harness.render,
    harness.writeSpec,
    harness.writeFigureMeta,
    harness.loadTable,
  );

  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout };
}

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-template-command-"));
  temporaryDirectories.push(workspace);
  return workspace;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}
