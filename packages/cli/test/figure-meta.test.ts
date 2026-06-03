import { describe, expect, test } from "bun:test";
import {
  buildFigureMeta,
  buildInferSnapshot,
  resolveVegaDependencyVersions,
  toSiblingMetaPath,
} from "../src/core/figure-meta";

describe("toSiblingMetaPath", () => {
  test("derives a sibling .meta.json path from an svg output path", () => {
    expect(toSiblingMetaPath("figures/f1.svg")).toBe("figures/f1.meta.json");
    expect(toSiblingMetaPath("chart.svg")).toBe("chart.meta.json");
  });
});

describe("buildInferSnapshot", () => {
  test("includes required infer keys and only provided optional keys", () => {
    expect(
      buildInferSnapshot("line", {
        chart: "line",
        x: "epoch",
        y: "f1",
        color: "model",
        title: "Training F1",
      }),
    ).toEqual({
      chart: "line",
      x: "epoch",
      y: "f1",
      color: "model",
      title: "Training F1",
    });
  });

  test("maps error-band and inline-data flags", () => {
    expect(
      buildInferSnapshot("line", {
        chart: "line",
        x: "epoch",
        y: "f1",
        errorBand: "f1_se",
        inlineData: true,
        aggregate: "mean",
        facet: "split",
        xType: "quantitative",
        yType: "ordinal",
        colorType: "nominal",
        width: "480",
        height: "320",
      }),
    ).toEqual({
      chart: "line",
      x: "epoch",
      y: "f1",
      errorBand: "f1_se",
      inlineData: true,
      aggregate: "mean",
      facet: "split",
      xType: "quantitative",
      yType: "ordinal",
      colorType: "nominal",
      width: 480,
      height: 320,
    });
  });
});

describe("buildFigureMeta", () => {
  test("builds top-level provenance and omits theme when unset", () => {
    const meta = buildFigureMeta({
      inputPath: "examples/training-curve/data.csv",
      outputPath: "examples/training-curve/output.svg",
      specOutPath: "examples/training-curve/chart.vl.json",
      chart: "line",
      options: {
        chart: "line",
        x: "epoch",
        y: "f1",
        color: "model",
      },
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      versions: {
        vegaVersion: "6.2.0",
        vegaLiteVersion: "6.4.1",
      },
    });

    expect(meta).toEqual({
      generatedBy: "vega-paper",
      input: "examples/training-curve/data.csv",
      output: "examples/training-curve/output.svg",
      specOut: "examples/training-curve/chart.vl.json",
      createdAt: "2026-06-03T12:00:00.000Z",
      vegaVersion: "6.2.0",
      vegaLiteVersion: "6.4.1",
      infer: {
        chart: "line",
        x: "epoch",
        y: "f1",
        color: "model",
      },
    });
  });

  test("includes theme when provided", () => {
    const meta = buildFigureMeta({
      inputPath: "data.csv",
      outputPath: "figure.svg",
      specOutPath: "figure.vl.json",
      chart: "bar",
      options: {
        chart: "bar",
        x: "label",
        y: "value",
        theme: "paper-clean",
      },
      createdAt: new Date("2026-06-03T12:00:00.000Z"),
      versions: {
        vegaVersion: "6.2.0",
        vegaLiteVersion: "6.4.1",
      },
    });

    expect(meta.theme).toBe("paper-clean");
  });
});

describe("resolveVegaDependencyVersions", () => {
  test("reads installed vega package versions", async () => {
    const versions = await resolveVegaDependencyVersions();

    expect(versions.vegaVersion.length).toBeGreaterThan(0);
    expect(versions.vegaLiteVersion.length).toBeGreaterThan(0);
  });
});
