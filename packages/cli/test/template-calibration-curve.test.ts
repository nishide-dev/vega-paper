import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import type { CalibrationCurveRequest } from "../src/core/template";
import { buildCalibrationCurveSpec } from "../src/core/templates/calibration-curve";

function createRequest(
  optionOverrides: Partial<CalibrationCurveRequest["options"]> = {},
): CalibrationCurveRequest {
  return {
    template: "calibration-curve",
    inputPath: "examples/calibration-curve/data.csv",
    specOutputPath: "examples/calibration-curve/chart.vl.json",
    table: {
      header: ["bin", "confidence", "accuracy", "count"],
      rows: [
        ["0", "0.05", "0.02", "120"],
        ["1", "0.15", "0.11", "240"],
        ["2", "0.25", "0.21", "310"],
      ],
    },
    options: {
      confidenceField: "confidence",
      accuracyField: "accuracy",
      ...optionOverrides,
    },
  };
}

describe("buildCalibrationCurveSpec", () => {
  test("builds the full spec with diagonal rule, sized points, and ECE annotation", () => {
    const spec = buildCalibrationCurveSpec(createRequest({ countField: "count", ece: 0.041 }));

    expect(spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "data.csv" },
      width: 360,
      height: 240,
      layer: [
        {
          mark: { type: "rule", color: "#888888", strokeDash: [4, 4] },
          encoding: { x: { datum: 0 }, y: { datum: 0 }, x2: { datum: 1 }, y2: { datum: 1 } },
        },
        {
          mark: { type: "line", point: false },
          encoding: {
            x: { field: "confidence", type: "quantitative", scale: { domain: [0, 1] } },
            y: { field: "accuracy", type: "quantitative", scale: { domain: [0, 1] } },
          },
        },
        {
          mark: { type: "point", filled: true },
          encoding: {
            x: { field: "confidence", type: "quantitative", scale: { domain: [0, 1] } },
            y: { field: "accuracy", type: "quantitative", scale: { domain: [0, 1] } },
            size: { field: "count", type: "quantitative" },
          },
        },
        {
          data: { values: [{}] },
          mark: { type: "text", align: "left", baseline: "top" },
          encoding: {
            x: { datum: 0.05 },
            y: { datum: 0.95 },
            text: { value: "ECE = 0.041" },
          },
        },
      ],
    });
  });

  test("builds diagonal plus pointed line without count and ece", () => {
    const spec = buildCalibrationCurveSpec(createRequest());
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer).toHaveLength(2);
    expect(layer[0]?.mark).toEqual({ type: "rule", color: "#888888", strokeDash: [4, 4] });
    expect(layer[1]?.mark).toEqual({ type: "line", point: true });
  });

  test("rejects fields missing from the CSV header", () => {
    expect(() => buildCalibrationCurveSpec(createRequest({ countField: "missing" }))).toThrow(
      new VegaPaperError('Field "missing" was not found.'),
    );
  });
});
