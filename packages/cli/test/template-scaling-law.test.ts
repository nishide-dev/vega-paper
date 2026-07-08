import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { ScalingLawRequest } from "../src/core/template";
import { buildScalingLawSpec } from "../src/core/templates/scaling-law";

function createRequest(
  optionOverrides: Partial<ScalingLawRequest["options"]> = {},
): ScalingLawRequest {
  return {
    template: "scaling-law",
    inputPath: "examples/scaling-law/data.csv",
    specOutputPath: "examples/scaling-law/chart.vl.json",
    table: {
      header: ["family", "params_b", "tokens_b", "flops", "loss", "accuracy"],
      rows: [
        ["baseline", "1.3", "300", "1.2e20", "2.81", "61.2"],
        ["baseline", "7.0", "1000", "2.8e21", "2.34", "68.1"],
        ["ours", "3.0", "500", "7.0e20", "2.42", "69.3"],
        ["ours", "13.0", "1200", "5.4e21", "2.11", "74.8"],
      ],
    },
    options: {
      xField: "flops",
      yField: "loss",
      ...optionOverrides,
    },
  };
}

describe("buildScalingLawSpec", () => {
  test("adds number parse hints for numeric CSV columns in data.format", () => {
    const spec = buildScalingLawSpec(createRequest());

    expect(spec.data).toEqual({
      url: "data.csv",
      format: {
        type: "csv",
        parse: {
          params_b: "number",
          tokens_b: "number",
          flops: "number",
          loss: "number",
          accuracy: "number",
        },
      },
    });
  });

  test("builds a log-x line spec with a grouped log regression layer", () => {
    const spec = buildScalingLawSpec(
      createRequest({ colorField: "family", xScale: "log", fit: "regression" }),
    );

    expect(spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: {
        url: "data.csv",
        format: {
          type: "csv",
          parse: {
            params_b: "number",
            tokens_b: "number",
            flops: "number",
            loss: "number",
            accuracy: "number",
          },
        },
      },
      width: 360,
      height: 240,
      layer: [
        {
          mark: { type: "line", point: true },
          encoding: {
            x: { field: "flops", type: "quantitative", scale: { type: "log" } },
            y: { field: "loss", type: "quantitative", scale: { zero: false } },
            color: { field: "family", type: "nominal" },
          },
        },
        {
          transform: [{ regression: "loss", on: "flops", method: "log", groupby: ["family"] }],
          mark: { type: "line", strokeDash: [4, 3], opacity: 0.6 },
          encoding: {
            x: { field: "flops", type: "quantitative", scale: { type: "log" } },
            y: { field: "loss", type: "quantitative", scale: { zero: false } },
            color: { field: "family", type: "nominal" },
          },
        },
      ],
    });
  });

  test("uses linear regression without --x-scale log and omits groupby without color", () => {
    const spec = buildScalingLawSpec(createRequest({ fit: "regression" }));
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer[1]?.transform).toEqual([{ regression: "loss", on: "flops", method: "linear" }]);
    expect(layer[0]?.encoding).toEqual({
      x: { field: "flops", type: "quantitative" },
      y: { field: "loss", type: "quantitative", scale: { zero: false } },
    });
  });

  test("emits a single line layer without --fit", () => {
    const spec = buildScalingLawSpec(createRequest({ xScale: "log" }));

    expect(spec.layer as unknown[]).toHaveLength(1);
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildScalingLawSpec(createRequest({ colorField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });
});
