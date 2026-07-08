import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { BenchmarkHeatmapRequest } from "../src/core/template";
import { buildBenchmarkHeatmapSpec } from "../src/core/templates/benchmark-heatmap";

function createRequest(
  optionOverrides: Partial<BenchmarkHeatmapRequest["options"]> = {},
  commonOverrides: Partial<Omit<BenchmarkHeatmapRequest, "template" | "options">> = {},
): BenchmarkHeatmapRequest {
  return {
    template: "benchmark-heatmap",
    inputPath: "examples/benchmark-heatmap/data.csv",
    specOutputPath: "examples/benchmark-heatmap/chart-template.vl.json",
    table: {
      header: ["model", "task", "score"],
      rows: [
        ["Baseline", "MMLU", "68.2"],
        ["Baseline", "GSM8K", "56.1"],
        ["Ours", "MMLU", "72.4"],
        ["Ours", "GSM8K", "61.8"],
      ],
    },
    options: {
      xField: "task",
      yField: "model",
      scoreField: "score",
      ...optionOverrides,
    },
    ...commonOverrides,
  };
}

describe("buildBenchmarkHeatmapSpec", () => {
  test("builds a layered rect+text spec with score labels by default", () => {
    expect(buildBenchmarkHeatmapSpec(createRequest())).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "data.csv" },
      width: 360,
      height: 240,
      layer: [
        {
          mark: "rect",
          encoding: {
            x: { field: "task", type: "ordinal" },
            y: { field: "model", type: "ordinal" },
            color: { field: "score", type: "quantitative" },
          },
        },
        {
          mark: "text",
          encoding: {
            x: { field: "task", type: "ordinal" },
            y: { field: "model", type: "ordinal" },
            text: { field: "score", type: "quantitative", format: ".1f" },
          },
        },
      ],
    });
  });

  test("uses a nominal text encoding when the label field differs from the score field", () => {
    const spec = buildBenchmarkHeatmapSpec(createRequest({ labelField: "model" }));
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer[1]?.encoding).toMatchObject({
      text: { field: "model", type: "nominal" },
    });
  });

  test("adds a best-cell outline layer per x column when highlightBest is set", () => {
    const spec = buildBenchmarkHeatmapSpec(createRequest({ highlightBest: true }));
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer).toHaveLength(3);
    expect(layer[2]).toEqual({
      data: {
        values: [
          { task: "MMLU", model: "Ours" },
          { task: "GSM8K", model: "Ours" },
        ],
      },
      mark: { type: "rect", fill: null, stroke: "#1a1a1a", strokeWidth: 2 },
      encoding: {
        x: { field: "task", type: "ordinal" },
        y: { field: "model", type: "ordinal" },
      },
    });
  });

  test("applies title, width, and height overrides", () => {
    const spec = buildBenchmarkHeatmapSpec(
      createRequest({}, { title: "Benchmark results", width: 420, height: 200 }),
    );

    expect(spec.title).toBe("Benchmark results");
    expect(spec.width).toBe(420);
    expect(spec.height).toBe(200);
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildBenchmarkHeatmapSpec(createRequest({ scoreField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });

  test("rejects non-numeric scores when computing best cells", () => {
    const request = createRequest({ highlightBest: true });
    request.table.rows[0] = ["Baseline", "MMLU", "n/a"];

    expect(() => buildBenchmarkHeatmapSpec(request)).toThrow(
      new VegaPaperError('Field "score" contains a non-numeric value "n/a".'),
    );
  });
});
