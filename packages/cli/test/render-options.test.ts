import { describe, expect, test } from "bun:test";
import { normalizeRenderOptions } from "../src/commands/render";
import { renderChart } from "../src/core/render";

describe("normalizeRenderOptions", () => {
  test("accepts explicit svg format and output path", () => {
    expect(
      normalizeRenderOptions("chart.vl.json", {
        format: "svg",
        out: "chart.svg",
        theme: "paper-clean",
      }),
    ).toEqual({
      inputPath: "chart.vl.json",
      outputPath: "chart.svg",
      format: "svg",
      themeName: "paper-clean",
    });
  });

  test("infers svg format from output path", () => {
    expect(
      normalizeRenderOptions("chart.vl.json", {
        out: "chart.svg",
      }),
    ).toEqual({
      inputPath: "chart.vl.json",
      outputPath: "chart.svg",
      format: "svg",
      themeName: undefined,
    });
  });

  test("rejects unsupported formats", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        format: "png",
        out: "chart.png",
      }),
    ).toThrow('Unsupported format "png". This MVP supports only "svg".');
  });

  test("requires an output path", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        format: "svg",
      }),
    ).toThrow("Missing --out <path>. SVG output must be written to a file.");
  });

  test("requires a detectable format", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        out: "chart.out",
      }),
    ).toThrow(
      'Missing --format <format>. Use "--format svg" or an .svg output path.',
    );
  });
});

describe("renderChart", () => {
  test("loads the input spec before rendering", async () => {
    await expect(
      renderChart({
        inputPath: "chart.vl.json",
        outputPath: "chart.svg",
        format: "svg",
      }),
    ).rejects.toThrow("Input file not found or unreadable: chart.vl.json");
  });
});
