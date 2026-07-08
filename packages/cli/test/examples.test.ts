import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../..");

async function readExampleSpec(relativePath: string): Promise<Record<string, unknown>> {
  return (await Bun.file(join(REPO_ROOT, relativePath)).json()) as Record<string, unknown>;
}

describe("examples", () => {
  test("training-curve chart links to data.csv", async () => {
    const spec = await readExampleSpec("examples/training-curve/chart.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(spec.mark).toBe("line");
  });

  test("training-curve aggregate chart links to runs.csv with mean transform", async () => {
    const spec = await readExampleSpec("examples/training-curve/chart-aggregate.vl.json");

    expect(spec.data).toEqual({ url: "runs.csv" });
    expect(spec.transform).toEqual([
      {
        aggregate: [{ op: "mean", field: "f1", as: "f1" }],
        groupby: ["epoch", "model"],
      },
    ]);
  });

  test("training-curve error-band chart links to data-with-error.csv with layered errorband", async () => {
    const spec = await readExampleSpec("examples/training-curve/chart-error-band.vl.json");

    expect(spec.data).toEqual({ url: "data-with-error.csv" });
    expect(spec.layer).toEqual([
      {
        mark: { type: "errorband", extent: "stderr", opacity: 0.25 },
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "f1", type: "quantitative" },
          color: { field: "model", type: "nominal" },
          yError: { field: "f1_se", type: "quantitative" },
        },
      },
      {
        mark: "line",
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "f1", type: "quantitative" },
          color: { field: "model", type: "nominal" },
        },
      },
    ]);
  });

  test("confusion-matrix chart is a heatmap", async () => {
    const spec = await readExampleSpec("examples/confusion-matrix/chart.vl.json");

    expect(spec.mark).toBe("rect");
    expect(spec.encoding).toMatchObject({
      color: { field: "count", type: "quantitative" },
    });
  });

  test("confusion-matrix trials chart sums n per cell", async () => {
    const spec = await readExampleSpec("examples/confusion-matrix/chart-from-trials.vl.json");

    expect(spec.data).toEqual({ url: "trials.csv" });
    expect(spec.transform).toEqual([
      {
        aggregate: [{ op: "sum", field: "n", as: "n" }],
        groupby: ["predicted", "actual"],
      },
    ]);
  });

  test("faceted-training chart wraps an inner line spec", async () => {
    const spec = await readExampleSpec("examples/faceted-training/chart.vl.json");

    expect(spec.facet).toEqual({ field: "split", type: "nominal" });
    expect(spec.spec).toMatchObject({
      mark: "line",
      encoding: {
        color: { field: "model", type: "nominal" },
      },
    });
  });

  test("boxplot chart uses boxplot mark with y scale zero false", async () => {
    const spec = await readExampleSpec("examples/boxplot/chart.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(spec.mark).toBe("boxplot");
    expect(spec.encoding).toEqual({
      x: { field: "model", type: "nominal" },
      y: {
        field: "f1",
        type: "quantitative",
        scale: { zero: false },
      },
    });
  });

  test("boxplot by-split chart adds nominal color encoding", async () => {
    const spec = await readExampleSpec("examples/boxplot/chart-by-split.vl.json");

    expect(spec.data).toEqual({ url: "data-by-split.csv" });
    expect(spec.encoding).toMatchObject({
      color: { field: "split", type: "nominal" },
    });
  });

  test("embedding-scatter chart is a point plot colored by label", async () => {
    const spec = await readExampleSpec("examples/embedding-scatter/chart.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(spec.mark).toBe("point");
    expect(spec.encoding).toMatchObject({
      x: { field: "x", type: "quantitative" },
      y: { field: "y", type: "quantitative" },
      color: { field: "label", type: "nominal" },
    });
    expect(spec.width).toBe(360);
    expect(spec.height).toBe(360);
  });

  test("ablation-bar chart is a bar chart of score by component and method", async () => {
    const spec = await readExampleSpec("examples/ablation-bar/chart.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(spec.mark).toBe("bar");
    expect(spec.encoding).toMatchObject({
      x: { field: "component", type: "nominal" },
      y: { field: "score", type: "quantitative" },
      color: { field: "method", type: "nominal" },
    });
    expect(spec.width).toBe(420);
    expect(spec.height).toBe(240);
  });

  test("ablation-bar grouped chart compares methods across datasets", async () => {
    const spec = await readExampleSpec("examples/ablation-bar/chart-grouped.vl.json");

    expect(spec.data).toEqual({ url: "grouped.csv" });
    expect(spec.mark).toBe("bar");
    expect(spec.encoding).toMatchObject({
      x: { field: "dataset", type: "nominal" },
      y: { field: "score", type: "quantitative" },
      color: { field: "method", type: "nominal" },
    });
  });

  test("benchmark-heatmap chart is a rect heatmap of scores", async () => {
    const spec = await readExampleSpec("examples/benchmark-heatmap/chart.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(spec.mark).toBe("rect");
    expect(spec.encoding).toMatchObject({
      x: { field: "task", type: "ordinal" },
      y: { field: "model", type: "ordinal" },
      color: { field: "score", type: "quantitative" },
    });
  });

  test("benchmark-heatmap labeled chart layers rect and text marks", async () => {
    const spec = await readExampleSpec("examples/benchmark-heatmap/chart-labeled.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    const layers = spec.layer as Record<string, unknown>[];
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({
      mark: "rect",
      encoding: { color: { field: "score", type: "quantitative" } },
    });
    expect(layers[1]).toMatchObject({
      mark: { type: "text" },
      encoding: { text: { field: "score", type: "quantitative" } },
    });
  });

  test("benchmark-heatmap data covers at least 4 models and 5 tasks", async () => {
    const csv = await Bun.file(join(REPO_ROOT, "examples/benchmark-heatmap/data.csv")).text();
    const rows = csv
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(","));

    expect(new Set(rows.map((row) => row[0])).size).toBeGreaterThanOrEqual(4);
    expect(new Set(rows.map((row) => row[1])).size).toBeGreaterThanOrEqual(5);
  });

  test("run-distribution boxplot chart summarizes score by method", async () => {
    const spec = await readExampleSpec("examples/run-distribution/chart-boxplot.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(spec.mark).toBe("boxplot");
    expect(spec.encoding).toEqual({
      x: { field: "method", type: "nominal" },
      y: {
        field: "score",
        type: "quantitative",
        scale: { zero: false },
      },
    });
  });

  test("run-distribution points chart layers boxplot and jittered raw points", async () => {
    const spec = await readExampleSpec("examples/run-distribution/chart-points.vl.json");

    expect(spec.data).toEqual({ url: "data.csv" });
    const layers = spec.layer as Record<string, unknown>[];
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({ mark: { type: "boxplot" } });
    expect(layers[1]).toMatchObject({
      mark: { type: "point" },
      encoding: { xOffset: { field: "jitter", type: "quantitative" } },
    });
  });

  test("benchmark-heatmap template chart layers rect, text, and best-cell outline", async () => {
    const spec = await readExampleSpec("examples/benchmark-heatmap/chart-template.vl.json");
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(layer).toHaveLength(3);
    expect(layer[0]?.mark).toBe("rect");
    expect(layer[1]?.mark).toBe("text");
    expect(layer[2]?.mark).toEqual({
      type: "rect",
      fill: null,
      stroke: "#1a1a1a",
      strokeWidth: 2,
    });
  });

  test("pareto-frontier chart layers frontier line, points, and labels with log x", async () => {
    const spec = await readExampleSpec("examples/pareto-frontier/chart.vl.json");
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(layer).toHaveLength(3);
    expect(layer[0]?.data).toEqual({
      values: [
        { latency_ms: 12, score: 68.1 },
        { latency_ms: 18, score: 73 },
        { latency_ms: 42, score: 77.2 },
      ],
    });
    expect(layer[1]?.encoding).toMatchObject({
      x: { field: "latency_ms", type: "quantitative", scale: { type: "log" } },
      size: { field: "params_b", type: "quantitative" },
    });
    expect(layer[2]?.encoding).toMatchObject({
      text: { field: "model", type: "nominal" },
    });
  });

  test("scaling-law chart uses a log x scale with a grouped regression layer", async () => {
    const spec = await readExampleSpec("examples/scaling-law/chart.vl.json");
    const layer = spec.layer as Array<Record<string, unknown>>;

    expect(spec.data).toEqual({ url: "data.csv" });
    expect(layer).toHaveLength(2);
    expect(layer[0]?.encoding).toMatchObject({
      x: { field: "flops", type: "quantitative", scale: { type: "log" } },
    });
    expect(layer[1]?.transform).toEqual([
      { regression: "loss", on: "flops", method: "log", groupby: ["family"] },
    ]);
  });
});
