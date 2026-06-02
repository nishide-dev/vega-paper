import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerLintCommand } from "../src/commands/lint";
import { lintSpec } from "../src/core/lint";
import type { LintResult } from "../src/core/lint";
import { runLintRules } from "../src/core/lint-rules";
import type { JsonObject, SpecType } from "../src/core/spec";

describe("runLintRules", () => {
  test("returns no issues for a clean minimal Vega-Lite spec", () => {
    expect(runRules(cleanVegaLiteSpec())).toEqual([]);
  });

  test("warns when axis titles are missing", () => {
    const spec = cleanVegaLiteSpec({
      encoding: {
        x: { field: "epoch", type: "quantitative" },
        y: { field: "accuracy", type: "quantitative" },
      },
    });

    expect(runRules(spec).map((issue) => issue.ruleId)).toEqual([
      "axis-title-missing",
      "axis-title-missing",
    ]);
  });

  test("accepts axis titles on Vega-Lite axis definitions", () => {
    const spec = cleanVegaLiteSpec({
      encoding: {
        x: {
          field: "epoch",
          type: "quantitative",
          axis: { title: "Epoch" },
        },
        y: {
          field: "accuracy",
          type: "quantitative",
          axis: { title: "Accuracy" },
        },
      },
    });

    expect(runRules(spec)).toEqual([]);
  });

  test("warns when the title is too long", () => {
    const spec = cleanVegaLiteSpec({
      title: "A".repeat(91),
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "title-too-long",
      path: "$.title",
      message: "Title is longer than 90 characters.",
      suggestion: "Shorten the title or move detail into the caption.",
    });
  });

  test("warns when object title text is too long", () => {
    const spec = cleanVegaLiteSpec({
      title: { text: "A".repeat(91) },
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "title-too-long",
      path: "$.title",
      message: "Title is longer than 90 characters.",
      suggestion: "Shorten the title or move detail into the caption.",
    });
  });

  test("warns when width or height is missing", () => {
    const spec = cleanVegaLiteSpec();
    delete spec.width;
    delete spec.height;

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "size-missing",
      path: "$",
      message: "Width and height are missing.",
      suggestion: "Set explicit width and height for reproducible paper figures.",
    });
  });

  test("warns when size is outside paper range", () => {
    const spec = cleanVegaLiteSpec({ width: 100, height: 900 });

    expect(runRules(spec).map((issue) => issue.ruleId)).toEqual([
      "size-out-of-range",
      "size-out-of-range",
    ]);
  });

  test("warns when inline data is large", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 501 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
        })),
      },
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "inline-data-large",
      path: "$.data.values",
      message: "Inline data has 501 rows.",
      suggestion: "Use external data or pre-aggregate before rendering.",
    });
  });

  test("warns when color has too many categories", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 13 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: `model-${index}`,
        })),
      },
      encoding: {
        x: { field: "epoch", type: "quantitative", title: "Epoch" },
        y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
        color: { field: "model", type: "nominal", title: "Model" },
      },
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "legend-too-many-categories",
      path: "$.encoding.color",
      message: 'Color field "model" has 13 categories.',
      suggestion: "Reduce categories, facet the chart, or group less important values.",
    });
  });

  test("warns when layered color encoding has too many categories from root data", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 13 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: `model-${index}`,
        })),
      },
      layer: [
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "Epoch" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
            color: { field: "model", type: "nominal", title: "Model" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "legend-too-many-categories",
      path: "$.layer[0].encoding.color",
      message: 'Color field "model" has 13 categories.',
      suggestion: "Reduce categories, facet the chart, or group less important values.",
    });
  });

  test("prefers child inline data for composed legend category counts", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 13 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: `root-${index}`,
        })),
      },
      layer: [
        {
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
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec).filter(
        (issue) => issue.ruleId === "legend-too-many-categories",
      ),
    ).toEqual([]);
  });

  test("skips composed legend category counts for child non-inline data", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: Array.from({ length: 13 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: `root-${index}`,
        })),
      },
      layer: [
        {
          data: { url: "child.csv" },
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "Epoch" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
            color: { field: "model", type: "nominal", title: "Model" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec).filter(
        (issue) => issue.ruleId === "legend-too-many-categories",
      ),
    ).toEqual([]);
  });

  test("warns when configured font sizes are too small", () => {
    const spec = cleanVegaLiteSpec({
      config: {
        axis: { labelFontSize: 7 },
        legend: { titleFontSize: 6 },
      },
    });

    expect(runRules(spec).map((issue) => issue.path)).toEqual([
      "$.config.axis.labelFontSize",
      "$.config.legend.titleFontSize",
    ]);
  });

  test("warns when bar chart y zero behavior is missing", () => {
    const spec = cleanVegaLiteSpec({
      mark: "bar",
      encoding: {
        x: { field: "epoch", type: "ordinal", title: "Epoch" },
        y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
      },
    });

    expect(runRules(spec)).toContainEqual({
      severity: "warning",
      ruleId: "bar-y-axis-zero-missing",
      path: "$.encoding.y.scale",
      message: "Bar charts with quantitative y should explicitly include zero.",
      suggestion: "Set encoding.y.scale.zero to true unless there is a documented reason not to.",
    });
  });

  test("does not warn at rule boundaries", () => {
    const categories = Array.from(
      { length: 12 },
      (_, index) => `model-${index}`,
    );
    const spec = cleanVegaLiteSpec({
      width: 180,
      height: 120,
      data: {
        values: Array.from({ length: 500 }, (_, index) => ({
          epoch: index,
          accuracy: index / 100,
          model: categories[index % categories.length],
        })),
      },
      mark: "bar",
      encoding: {
        x: { field: "epoch", type: "ordinal", title: "Epoch" },
        y: {
          field: "accuracy",
          type: "quantitative",
          title: "Accuracy",
          scale: { zero: true },
        },
        color: {
          field: "model",
          type: "nominal",
          title: "Model",
          scale: { domain: categories },
        },
      },
    });

    expect(runRules(spec)).toEqual([]);
  });

  test("warns for missing axis titles inside layered Vega-Lite specs", () => {
    const spec = cleanVegaLiteSpec({
      data: {
        values: [
          { epoch: 1, accuracy: 0.62, loss: 0.41 },
          { epoch: 2, accuracy: 0.68, loss: 0.36 },
        ],
      },
      layer: [
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative" },
            y: { field: "accuracy", type: "quantitative" },
          },
        },
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "Epoch" },
            y: { field: "loss", type: "quantitative" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual([
      "$.layer[0].encoding.x",
      "$.layer[0].encoding.y",
      "$.layer[1].encoding.y",
    ]);
  });

  test("warns for missing axis titles inside facet and repeat specs", () => {
    const facetSpec = cleanVegaLiteSpec({
      facet: { field: "model", type: "nominal" },
      spec: {
        mark: "point",
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
        },
      },
    });
    delete facetSpec.mark;
    delete facetSpec.encoding;

    const repeatSpec = cleanVegaLiteSpec({
      repeat: ["accuracy", "loss"],
      spec: {
        mark: "line",
        encoding: {
          x: { field: "epoch", type: "quantitative", title: "Epoch" },
          y: { field: "accuracy", type: "quantitative" },
        },
      },
    });
    delete repeatSpec.mark;
    delete repeatSpec.encoding;

    expect(
      runRules(facetSpec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual(["$.spec.encoding.x"]);
    expect(
      runRules(repeatSpec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual(["$.spec.encoding.y"]);
  });

  test("warns for missing axis titles inside concat specs", () => {
    const spec = cleanVegaLiteSpec({
      concat: [
        {
          mark: "line",
          encoding: {
            x: { field: "epoch", type: "quantitative" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
          },
        },
      ],
      hconcat: [
        {
          mark: "point",
          encoding: {
            x: { field: "epoch", type: "quantitative", title: "Epoch" },
            y: { field: "accuracy", type: "quantitative" },
          },
        },
      ],
      vconcat: [
        {
          mark: "bar",
          encoding: {
            x: { field: "epoch", type: "ordinal" },
            y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual([
      "$.concat[0].encoding.x",
      "$.hconcat[0].encoding.y",
      "$.vconcat[0].encoding.x",
    ]);
  });

  test("recurses through nested composed Vega-Lite specs", () => {
    const spec = cleanVegaLiteSpec({
      layer: [
        {
          facet: { field: "model", type: "nominal" },
          spec: {
            mark: "point",
            encoding: {
              x: { field: "epoch", type: "quantitative" },
              y: { field: "accuracy", type: "quantitative", title: "Accuracy" },
            },
          },
        },
      ],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(
      runRules(spec)
        .filter((issue) => issue.ruleId === "axis-title-missing")
        .map((issue) => issue.path),
    ).toEqual(["$.layer[0].spec.encoding.x"]);
  });

  test("ignores malformed composition fields without throwing", () => {
    const spec = cleanVegaLiteSpec({
      layer: { not: "an array" },
      facet: { spec: "not an object" },
      repeat: { spec: null },
      concat: ["not an object"],
      hconcat: [null],
      vconcat: [{ mark: "point" }],
    });
    delete spec.mark;
    delete spec.encoding;

    expect(runRules(spec)).toEqual([]);
  });

  test("does not run Vega-Lite-only rules for Vega specs", () => {
    expect(
      runRules(
        {
          $schema: "https://vega.github.io/schema/vega/v6.json",
          width: 360,
          height: 240,
          marks: [],
          scales: [],
        },
        "vega",
      ),
    ).toEqual([]);
  });
});

describe("lintSpec", () => {
  test("returns a clean result for a clean file", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeJson(inputPath, cleanVegaLiteSpec());

      expect(await lintSpec({ inputPath })).toEqual({
        ok: true,
        errorCount: 0,
        warningCount: 0,
        issues: [],
      });
    });
  });

  test("returns spec-unreadable for invalid JSON", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      await writeFile(inputPath, "{", "utf8");

      expect(await lintSpec({ inputPath })).toEqual({
        ok: false,
        errorCount: 1,
        warningCount: 0,
        issues: [
          {
            severity: "error",
            ruleId: "spec-unreadable",
            path: "$",
            message: `Could not read ${inputPath}: Invalid JSON in input file: ${inputPath}`,
            suggestion: "Provide a readable JSON object file.",
          },
        ],
      });
    });
  });

  test("returns spec-unknown-type for unknown JSON objects", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.json");
      await writeJson(inputPath, { title: "No recognizable spec fields" });

      expect(await lintSpec({ inputPath })).toEqual({
        ok: false,
        errorCount: 1,
        warningCount: 0,
        issues: [
          {
            severity: "error",
            ruleId: "spec-unknown-type",
            path: "$",
            message: "Could not determine whether the input is Vega-Lite or Vega.",
            suggestion:
              "Add a Vega/Vega-Lite $schema or recognizable mark/encoding or marks/scales fields.",
          },
        ],
      });
    });
  });

  test("returns warnings from static rules", async () => {
    await withTemporaryWorkspace(async (workspacePath) => {
      const inputPath = join(workspacePath, "chart.vl.json");
      const spec = cleanVegaLiteSpec();
      delete spec.width;
      await writeJson(inputPath, spec);

      const result = await lintSpec({ inputPath });

      expect(result.ok).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(1);
      expect(result.issues[0]?.ruleId).toBe("size-missing");
    });
  });
});

describe("lint command", () => {
  test("prints clean result without setting exit code", async () => {
    const output = await runLintCommand(["lint", "chart.vl.json"], cleanLintResult());

    expect(output.stdout).toBe("No lint issues found.\n");
    expect(output.exitCode).toBeUndefined();
  });

  test("prints human issue summary and table for one warning", async () => {
    const output = await runLintCommand(
      ["lint", "chart.vl.json"],
      createCommandLintResult([
        {
          severity: "warning",
          ruleId: "axis-title-missing",
          path: "$.encoding.x",
          message: "X axis is missing a title.",
        },
      ]),
    );

    expect(output.stdout).toContain("1 warning, 0 errors");
    expect(output.stdout).toContain("severity  rule                path          message");
    expect(output.stdout).toContain(
      "warning   axis-title-missing  $.encoding.x  X axis is missing a title.",
    );
    expect(output.exitCode).toBeUndefined();
  });

  test("prints JSON only in JSON mode", async () => {
    const result = createCommandLintResult([
      {
        severity: "warning",
        ruleId: "axis-title-missing",
        path: "$.encoding.x",
        message: "X axis is missing a title.",
      },
    ]);
    const output = await runLintCommand(["lint", "chart.vl.json", "--json"], result);

    expect(JSON.parse(output.stdout)).toEqual(result);
    expect(output.stdout).not.toContain("warning,");
  });

  test("sets exit code 1 for errors", async () => {
    const output = await runLintCommand(
      ["lint", "chart.vl.json"],
      createCommandLintResult([
        {
          severity: "error",
          ruleId: "spec-unreadable",
          path: "$",
          message: "Could not read chart.vl.json.",
        },
      ]),
    );

    expect(output.exitCode).toBe(1);
  });

  test("sets exit code 1 for warnings in strict mode", async () => {
    const output = await runLintCommand(
      ["lint", "chart.vl.json", "--strict"],
      createCommandLintResult([
        {
          severity: "warning",
          ruleId: "axis-title-missing",
          path: "$.encoding.x",
          message: "X axis is missing a title.",
        },
      ]),
    );

    expect(output.exitCode).toBe(1);
  });
});

function runRules(spec: JsonObject, specType: SpecType = "vega-lite") {
  return runLintRules({
    inputPath: "chart.vl.json",
    spec,
    specType,
  });
}

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

async function withTemporaryWorkspace(
  callback: (workspacePath: string) => Promise<void>,
) {
  const workspacePath = await mkdtemp(
    join(tmpdir(), "vega-paper-lint-test-"),
  );

  try {
    await callback(workspacePath);
  } finally {
    await rm(workspacePath, { force: true, recursive: true });
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value), "utf8");
}

async function runLintCommand(
  args: string[],
  result: LintResult,
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
    async () => result,
    (value) => {
      exitCode = value;
    },
  );
  await program.parseAsync(["node", "vega-paper", ...args]);

  return { stdout, exitCode };
}

function cleanLintResult(): LintResult {
  return createCommandLintResult([]);
}

function createCommandLintResult(issues: LintResult["issues"]): LintResult {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues,
  };
}
