import { describe, expect, test } from "bun:test";
import { normalizeRenderOptions } from "../src/commands/render";
import { VegaPaperError } from "../src/core/errors";
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
      scale: 1,
      themeName: "paper-clean",
    });
  });

  test("infers png format from output path", () => {
    expect(
      normalizeRenderOptions("chart.vl.json", {
        out: "chart.png",
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

  test("accepts explicit pdf format", () => {
    expect(
      normalizeRenderOptions("chart.vl.json", {
        format: "pdf",
        out: "chart.pdf",
      }),
    ).toEqual({
      inputPath: "chart.vl.json",
      outputPath: "chart.pdf",
      format: "pdf",
      scale: 1,
      themeName: undefined,
    });
  });

  test("rejects unknown formats", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        format: "gif",
        out: "chart.gif",
      }),
    ).toThrow(VegaPaperError);
  });

  test("requires an output path", () => {
    expect(() => normalizeRenderOptions("chart.vl.json", { format: "svg" })).toThrow(
      "Missing --out <path>. Output must be written to a file.",
    );
  });

  test("requires a detectable format", () => {
    expect(() =>
      normalizeRenderOptions("chart.vl.json", {
        out: "chart.out",
      }),
    ).toThrow(
      "Missing or ambiguous --format <format>. Use svg, png, or pdf, or an .svg/.png/.pdf --out path.",
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

  test("reports unknown themes as CLI errors", async () => {
    await expect(
      renderChart({
        inputPath: "examples/basic-line/chart.vl.json",
        outputPath: "examples/basic-line/missing-theme.svg",
        format: "svg",
        themeName: "missing-theme",
      }),
    ).rejects.toBeInstanceOf(VegaPaperError);
  });
});
