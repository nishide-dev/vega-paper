import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { ParetoFrontierRequest } from "../src/core/template";
import {
  buildParetoFrontierSpec,
  computeMaxYMinXFrontier,
} from "../src/core/templates/pareto-frontier";

function createRequest(
  optionOverrides: Partial<ParetoFrontierRequest["options"]> = {},
): ParetoFrontierRequest {
  return {
    template: "pareto-frontier",
    inputPath: "examples/pareto-frontier/data.csv",
    specOutputPath: "examples/pareto-frontier/chart.vl.json",
    table: {
      header: ["model", "family", "score", "latency_ms", "params_b"],
      rows: [
        ["TinyLM", "baseline", "68.1", "12", "1.3"],
        ["BaseLM", "baseline", "72.4", "28", "7.0"],
        ["Ours-S", "ours", "73.0", "18", "3.0"],
        ["Ours-L", "ours", "77.2", "42", "13.0"],
      ],
    },
    options: {
      xField: "latency_ms",
      yField: "score",
      ...optionOverrides,
    },
  };
}

describe("computeMaxYMinXFrontier", () => {
  test("keeps only non-dominated points sorted by x", () => {
    const request = createRequest();
    const options = { xField: "latency_ms", yField: "score" };

    expect(computeMaxYMinXFrontier(request.table.rows, 3, 2, options)).toEqual([
      { latency_ms: 12, score: 68.1 },
      { latency_ms: 18, score: 73 },
      { latency_ms: 42, score: 77.2 },
    ]);
  });

  test("prefers the higher y for tied x values", () => {
    const rows = [
      ["a", "10", "5"],
      ["b", "10", "7"],
      ["c", "20", "6"],
      ["d", "30", "9"],
    ];

    expect(computeMaxYMinXFrontier(rows, 1, 2, { xField: "x", yField: "y" })).toEqual([
      { x: 10, y: 7 },
      { x: 30, y: 9 },
    ]);
  });

  test("rejects non-numeric coordinates", () => {
    const rows = [["a", "fast", "5"]];

    expect(() => computeMaxYMinXFrontier(rows, 1, 2, { xField: "x", yField: "y" })).toThrow(
      new VegaPaperError('Field "x" contains a non-numeric value "fast".'),
    );
  });
});

describe("buildParetoFrontierSpec", () => {
  test("builds the full layered spec with frontier, points, and labels", () => {
    const spec = buildParetoFrontierSpec(
      createRequest({
        labelField: "model",
        colorField: "family",
        sizeField: "params_b",
        xScale: "log",
        frontier: "max-y-min-x",
      }),
    );

    expect(spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: {
        url: "data.csv",
        format: {
          type: "csv",
          parse: { score: "number", latency_ms: "number", params_b: "number" },
        },
      },
      width: 360,
      height: 240,
      layer: [
        {
          data: {
            values: [
              { latency_ms: 12, score: 68.1 },
              { latency_ms: 18, score: 73 },
              { latency_ms: 42, score: 77.2 },
            ],
          },
          mark: { type: "line", color: "#888888", strokeDash: [4, 3] },
          encoding: {
            x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
            y: { field: "score", type: "quantitative", scale: { zero: false } },
          },
        },
        {
          mark: { type: "point", filled: true },
          encoding: {
            x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
            y: { field: "score", type: "quantitative", scale: { zero: false } },
            color: { field: "family", type: "nominal" },
            size: { field: "params_b", type: "quantitative" },
          },
        },
        {
          mark: { type: "text", align: "left", dx: 6, dy: -6 },
          encoding: {
            x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
            y: { field: "score", type: "quantitative", scale: { zero: false } },
            text: { field: "model", type: "nominal" },
          },
        },
      ],
    });
  });

  test("builds a single point layer without optional channels", () => {
    const spec = buildParetoFrontierSpec(createRequest());
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer).toHaveLength(1);
    expect(layer[0]).toEqual({
      mark: { type: "point", filled: true },
      encoding: {
        x: { field: "latency_ms", type: "quantitative" },
        y: { field: "score", type: "quantitative", scale: { zero: false } },
      },
    });
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildParetoFrontierSpec(createRequest({ sizeField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });
});
