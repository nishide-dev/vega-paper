import { describe, expect, test } from "bun:test";
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
