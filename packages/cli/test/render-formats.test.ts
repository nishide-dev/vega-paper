import { describe, expect, test } from "bun:test";
import { buildVegaCliArgs, getVegaCliBinaryName } from "../src/backends/external-vega-cli";
import { VegaPaperError } from "../src/core/errors";
import {
  buildRenderRequest,
  inferFormatFromOutputPath,
  parseScale,
} from "../src/core/render-format";

describe("render format helpers", () => {
  test("infers format from output extension", () => {
    expect(inferFormatFromOutputPath("figure.svg")).toBe("svg");
    expect(inferFormatFromOutputPath("figure.png")).toBe("png");
    expect(inferFormatFromOutputPath("figure.pdf")).toBe("pdf");
    expect(inferFormatFromOutputPath("figure.out")).toBeUndefined();
  });

  test("builds png request with scale", () => {
    expect(
      buildRenderRequest({
        inputPath: "chart.vl.json",
        outputPath: "chart.png",
        scale: "2",
      }),
    ).toEqual({
      inputPath: "chart.vl.json",
      outputPath: "chart.png",
      format: "png",
      scale: 2,
      themeName: undefined,
    });
  });

  test("rejects scale on svg output", () => {
    expect(() => parseScale("2", "svg")).toThrow(
      'The "--scale" option applies only to png or pdf output.',
    );
  });

  test("rejects format and extension mismatch", () => {
    expect(() =>
      buildRenderRequest({
        inputPath: "chart.vl.json",
        outputPath: "chart.png",
        format: "pdf",
      }),
    ).toThrow(VegaPaperError);
  });
});

describe("Vega CLI binary mapping", () => {
  test("maps spec type and format to binary names", () => {
    expect(getVegaCliBinaryName("vega-lite", "svg")).toBe("vl2svg");
    expect(getVegaCliBinaryName("vega-lite", "png")).toBe("vl2png");
    expect(getVegaCliBinaryName("vega-lite", "pdf")).toBe("vl2pdf");
    expect(getVegaCliBinaryName("vega", "png")).toBe("vg2png");
  });

  test("passes scale flag before input and output paths", () => {
    expect(
      buildVegaCliArgs({
        specType: "vega-lite",
        inputPath: "spec.vl.json",
        outputPath: "out.png",
        format: "png",
        scale: 2,
      }),
    ).toEqual(["-s", "2", "spec.vl.json", "out.png"]);
  });

  test("omits scale flag when scale is 1", () => {
    expect(
      buildVegaCliArgs({
        specType: "vega-lite",
        inputPath: "spec.vl.json",
        outputPath: "out.svg",
        format: "svg",
      }),
    ).toEqual(["spec.vl.json", "out.svg"]);
  });
});
