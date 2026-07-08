import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import { buildTemplateSpec, parseTemplateName, type TemplateRequest } from "../src/core/template";
import { parseNumericCell } from "../src/core/templates/shared";

describe("parseTemplateName", () => {
  test("accepts the four initial template names", () => {
    expect(parseTemplateName("benchmark-heatmap")).toBe("benchmark-heatmap");
    expect(parseTemplateName("pareto-frontier")).toBe("pareto-frontier");
    expect(parseTemplateName("scaling-law")).toBe("scaling-law");
    expect(parseTemplateName("calibration-curve")).toBe("calibration-curve");
  });

  test("rejects unknown template names", () => {
    expect(() => parseTemplateName("violin")).toThrow(
      new VegaPaperError(
        'Unknown template "violin". Expected one of: benchmark-heatmap, pareto-frontier, scaling-law, calibration-curve, multipanel.',
      ),
    );
  });
});

describe("parseNumericCell", () => {
  test("parses plain and scientific-notation numbers", () => {
    expect(parseNumericCell("68.2", "score")).toBe(68.2);
    expect(parseNumericCell(" 12 ", "latency_ms")).toBe(12);
    expect(parseNumericCell("1.2e20", "flops")).toBe(1.2e20);
  });

  test("rejects empty and non-numeric cells", () => {
    expect(() => parseNumericCell("", "score")).toThrow(
      new VegaPaperError('Field "score" contains a non-numeric value "".'),
    );
    expect(() => parseNumericCell("n/a", "score")).toThrow(
      new VegaPaperError('Field "score" contains a non-numeric value "n/a".'),
    );
  });
});

describe("buildTemplateSpec", () => {
  const commonRequest = {
    inputPath: "data.csv",
    specOutputPath: "chart.vl.json",
  };

  test("dispatches benchmark-heatmap requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "benchmark-heatmap",
      table: { header: ["model", "task", "score"], rows: [["Ours", "MMLU", "72.4"]] },
      options: { xField: "task", yField: "model", scoreField: "score" },
    };
    const spec = buildTemplateSpec(request);
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(layer[0]?.mark).toBe("rect");
    expect(layer[1]?.mark).toBe("text");
  });

  test("dispatches pareto-frontier requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "pareto-frontier",
      table: { header: ["model", "score", "latency_ms"], rows: [["Ours", "72.4", "18"]] },
      options: { xField: "latency_ms", yField: "score" },
    };
    const layer = buildTemplateSpec(request).layer as Array<Record<string, unknown>>;

    expect(layer[0]?.mark).toEqual({ type: "point", filled: true });
  });

  test("dispatches scaling-law requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "scaling-law",
      table: { header: ["family", "flops", "loss"], rows: [["ours", "1.2e20", "2.81"]] },
      options: { xField: "flops", yField: "loss", fit: "regression" },
    };
    const layer = buildTemplateSpec(request).layer as Array<Record<string, unknown>>;

    expect(layer[1]?.transform).toEqual([{ regression: "loss", on: "flops", method: "linear" }]);
  });

  test("dispatches calibration-curve requests", () => {
    const request: TemplateRequest = {
      ...commonRequest,
      template: "calibration-curve",
      table: { header: ["confidence", "accuracy"], rows: [["0.05", "0.02"]] },
      options: { confidenceField: "confidence", accuracyField: "accuracy" },
    };
    const layer = buildTemplateSpec(request).layer as Array<Record<string, unknown>>;

    expect(layer[0]?.mark).toEqual({ type: "rule", color: "#888888", strokeDash: [4, 4] });
  });
});
