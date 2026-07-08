import { describe, expect, test } from "bun:test";
import { VegaPaperError } from "../src/core/errors";
import { parseTemplateName } from "../src/core/template";
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
        'Unknown template "violin". Expected one of: benchmark-heatmap, pareto-frontier, scaling-law, calibration-curve.',
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
