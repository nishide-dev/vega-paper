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

  test("training-curve error-band chart links to data-with-error.csv with yError", async () => {
    const spec = await readExampleSpec("examples/training-curve/chart-error-band.vl.json");

    expect(spec.data).toEqual({ url: "data-with-error.csv" });
    expect(spec.encoding).toMatchObject({
      y: { field: "f1", type: "quantitative" },
      yError: { field: "f1_se", type: "quantitative" },
    });
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
});
