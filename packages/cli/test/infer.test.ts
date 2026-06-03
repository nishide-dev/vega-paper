import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inferVegaLiteSpec,
  parseCsv,
  parseJsonArray,
  type InferRequest,
} from "../src/core/infer";
import { VegaPaperError } from "../src/core/errors";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("parseCsv", () => {
  test("parses trimmed headers and ignores empty lines", () => {
    expect(parseCsv(" year , value \n1,2\n\n3,4\n")).toEqual({
      header: ["year", "value"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
    });
  });

  test("parses quoted values, commas, escaped quotes, and trailing empty cells", () => {
    expect(
      parseCsv(
        'name,quote,notes\n"Alice, Jr.","He said ""hello""",\nBob,"plain text",""\n',
      ),
    ).toEqual({
      header: ["name", "quote", "notes"],
      rows: [
        ["Alice, Jr.", 'He said "hello"', ""],
        ["Bob", "plain text", ""],
      ],
    });
  });

  test("parses CRLF-delimited CSV input", () => {
    expect(parseCsv("year,value\r\n2020,10\r\n2021,15\r\n")).toEqual({
      header: ["year", "value"],
      rows: [
        ["2020", "10"],
        ["2021", "15"],
      ],
    });
  });

  test("parses multiline quoted cells", () => {
    expect(parseCsv('name,notes\nAlice,"line 1\nline 2"\nBob,"single line"\n'))
      .toEqual({
        header: ["name", "notes"],
        rows: [
          ["Alice", "line 1\nline 2"],
          ["Bob", "single line"],
        ],
      });
  });

  test("rejects unterminated quoted fields", () => {
    expect(() => parseCsv('name,notes\nAlice,"missing end quote')).toThrow(
      VegaPaperError,
    );
  });

  test("rejects empty CSV input", () => {
    expect(() => parseCsv("\n\n")).toThrow(VegaPaperError);
  });

  test("rejects empty header names", () => {
    expect(() => parseCsv("name, ,value\nAlice,1,2\n")).toThrow(
      VegaPaperError,
    );
  });
});

describe("parseJsonArray", () => {
  test("collects union keys in first-seen order", () => {
    expect(parseJsonArray('[{"b":2,"a":1},{"c":3,"a":9}]')).toEqual({
      header: ["b", "a", "c"],
      rows: [
        ["2", "1", ""],
        ["", "9", "3"],
      ],
      values: [{ b: 2, a: 1 }, { a: 9, c: 3 }],
    });
  });

  test("normalizes null and missing keys to empty strings", () => {
    expect(parseJsonArray('[{"x":1},{"x":null,"y":"ok"}]')).toEqual({
      header: ["x", "y"],
      rows: [
        ["1", ""],
        ["", "ok"],
      ],
      values: [{ x: 1 }, { x: null, y: "ok" }],
    });
  });

  test("rejects empty arrays", () => {
    expect(() => parseJsonArray("[]")).toThrow(
      "JSON input must be a non-empty array of objects.",
    );
  });

  test("rejects non-array top level", () => {
    expect(() => parseJsonArray('{"mark":"bar"}')).toThrow(
      "JSON input must be a non-empty array of objects.",
    );
  });

  test("rejects non-object elements", () => {
    expect(() => parseJsonArray('[{"x":1},42]')).toThrow(
      "JSON input must contain only objects.",
    );
  });

  test("rejects nested cell values", () => {
    expect(() => parseJsonArray('[{"x":{"nested":true}}]')).toThrow(
      'JSON field "x" contains a nested value.',
    );
  });
});

describe("inferVegaLiteSpec", () => {
  test("builds a line spec with a relative CSV url", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "nested", "chart.vl.json");

    await Bun.write(inputPath, "year,value\n2020,10\n2021,15\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "year",
      yField: "value",
      specOutputPath,
      title: "Revenue",
    });

    expect(result).toEqual({
      spec: {
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        title: "Revenue",
        data: { url: "../data.csv" },
        mark: "line",
        width: 360,
        height: 240,
        encoding: {
          x: { field: "year", type: "quantitative" },
          y: { field: "value", type: "quantitative" },
        },
      },
    });
  });

  test("maps bar and scatter charts to bar and point marks", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "category,value\nA,10\nB,15\n");

    const baseRequest = {
      inputPath,
      xField: "category",
      yField: "value",
      specOutputPath: join(workspace, "chart.vl.json"),
    } satisfies Omit<
      InferRequest,
      "chart"
    >;

    await expect(
      inferVegaLiteSpec({ ...baseRequest, chart: "bar" }),
    ).resolves.toMatchObject({
      spec: {
        mark: "bar",
      },
    });

    await expect(
      inferVegaLiteSpec({ ...baseRequest, chart: "scatter" }),
    ).resolves.toMatchObject({
      spec: {
        mark: "point",
      },
    });
  });

  test("maps area chart to an area mark with line overlay", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "epoch,loss\n1,0.9\n2,0.7\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "area",
      xField: "epoch",
      yField: "loss",
      specOutputPath: join(workspace, "chart.vl.json"),
    });

    expect(result.spec).toMatchObject({
      mark: { type: "area", line: true },
      encoding: {
        x: { field: "epoch", type: "quantitative" },
        y: { field: "loss", type: "quantitative" },
      },
    });
  });

  test("infers nominal types for non-numeric x and y fields", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "quarter,status\nQ1,open\nQ2,closed\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "quarter",
      yField: "status",
      specOutputPath: join(workspace, "chart.vl.json"),
    });

    expect(result.spec).toMatchObject({
      encoding: {
        x: { field: "quarter", type: "nominal" },
        y: { field: "status", type: "nominal" },
      },
    });
  });

  test("infers nominal types for x and y fields that contain only empty values", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "x,y\n,\n,\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "scatter",
      xField: "x",
      yField: "y",
      specOutputPath: join(workspace, "chart.vl.json"),
    });

    expect(result.spec).toMatchObject({
      encoding: {
        x: { field: "x", type: "nominal" },
        y: { field: "y", type: "nominal" },
      },
    });
  });

  test("keeps color nominal even when its values are numeric", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "year,value,series\n2020,10,1\n2021,20,2\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "year",
      yField: "value",
      colorField: "series",
      specOutputPath: join(workspace, "chart.vl.json"),
    });

    expect(result.spec).toMatchObject({
      encoding: {
        color: { field: "series", type: "nominal" },
      },
    });
  });

  test("uses explicit width and height when provided", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "year,value\n2020,10\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "bar",
      xField: "year",
      yField: "value",
      width: 720,
      height: 480,
      specOutputPath: join(workspace, "chart.vl.json"),
    });

    expect(result.spec).toMatchObject({
      width: 720,
      height: 480,
    });
  });

  test("rejects missing x, y, and color fields", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "year,value,group\n2020,10,a\n");

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "missing-x",
        yField: "value",
        specOutputPath: join(workspace, "chart-a.vl.json"),
      }),
    ).rejects.toThrow('Field "missing-x" was not found.');

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "year",
        yField: "missing-y",
        specOutputPath: join(workspace, "chart-b.vl.json"),
      }),
    ).rejects.toThrow('Field "missing-y" was not found.');

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "year",
        yField: "value",
        colorField: "missing-color",
        specOutputPath: join(workspace, "chart-c.vl.json"),
      }),
    ).rejects.toThrow('Field "missing-color" was not found.');
  });

  test("rejects unsupported chart types", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const invalidChart = "boxplot" as unknown as InferRequest["chart"];

    await Bun.write(inputPath, "year,value\n2020,10\n");

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: invalidChart,
        xField: "year",
        yField: "value",
        specOutputPath: join(workspace, "chart.vl.json"),
      }),
    ).rejects.toThrow(
      'Unsupported chart type "boxplot". Expected one of: line, bar, scatter, area, heatmap.',
    );
  });

  test("rejects unreadable CSV files", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "missing.csv");

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "year",
        yField: "value",
        specOutputPath: join(workspace, "chart.vl.json"),
      }),
    ).rejects.toThrow(`CSV file not found or unreadable: ${inputPath}`);
  });

  test("xType temporal overrides nominal inference for date strings", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "date,value\n2024-01-01,10\n2024-01-02,15\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "date",
      yField: "value",
      specOutputPath,
      xType: "temporal",
    });

    expect(result.spec).toMatchObject({
      encoding: {
        x: { field: "date", type: "temporal" },
        y: { field: "value", type: "quantitative" },
      },
    });
  });

  test("xType ordinal overrides quantitative inference for numeric field", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1\n1,0.61\n2,0.68\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      specOutputPath,
      xType: "ordinal",
    });

    expect(result.spec).toMatchObject({
      encoding: {
        x: { field: "epoch", type: "ordinal" },
      },
    });
  });

  test("colorType ordinal overrides the default nominal color type", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "x,y,rating\n1,2,3\n4,5,5\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "scatter",
      xField: "x",
      yField: "y",
      colorField: "rating",
      specOutputPath,
      colorType: "ordinal",
    });

    expect(result.spec).toMatchObject({
      encoding: {
        color: { field: "rating", type: "ordinal" },
      },
    });
  });

  test("builds a line spec with a relative JSON url", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.json");
    const specOutputPath = join(workspace, "nested", "chart.vl.json");

    await Bun.write(
      inputPath,
      '[{"epoch":1,"f1":0.61},{"epoch":2,"f1":0.68}]',
    );

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      specOutputPath,
    });

    expect(result.spec).toMatchObject({
      data: { url: "../data.json" },
      encoding: {
        x: { field: "epoch", type: "quantitative" },
        y: { field: "f1", type: "quantitative" },
      },
    });
  });

  test("rejects unsupported input extensions", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.tsv");

    await Bun.write(inputPath, "epoch\tf1\n1\t0.5\n");

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "epoch",
        yField: "f1",
        specOutputPath: join(workspace, "chart.vl.json"),
      }),
    ).rejects.toThrow(
      'Unsupported input format ".tsv". Expected a .csv or .json file.',
    );
  });

  test("rejects invalid JSON files", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "broken.json");

    await Bun.write(inputPath, "[not json");

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "epoch",
        yField: "f1",
        specOutputPath: join(workspace, "chart.vl.json"),
      }),
    ).rejects.toThrow(`Invalid JSON in input file: ${inputPath}`);
  });

  test("embeds JSON objects in data.values when inlineData is true", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.json");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(
      inputPath,
      '[{"epoch":1,"f1":0.61},{"epoch":2,"f1":0.68}]',
    );

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      specOutputPath,
      inlineData: true,
    });

    expect(result.spec.data).toEqual({
      values: [{ epoch: 1, f1: 0.61 }, { epoch: 2, f1: 0.68 }],
    });
    expect(result.spec.data).not.toHaveProperty("url");
  });

  test("embeds CSV rows as all-string objects when inlineData is true", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1\n1,0.61\n2,0.68\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      specOutputPath,
      inlineData: true,
    });

    expect(result.spec.data).toEqual({
      values: [
        { epoch: "1", f1: "0.61" },
        { epoch: "2", f1: "0.68" },
      ],
    });
    expect(result.spec.data).not.toHaveProperty("url");
  });

  test("yType ordinal overrides quantitative inference for numeric y field", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "label,score\nA,1\nB,2\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "bar",
      xField: "label",
      yField: "score",
      specOutputPath,
      yType: "ordinal",
    });

    expect(result.spec).toMatchObject({
      encoding: {
        y: { field: "score", type: "ordinal" },
      },
    });
  });

  test("wraps spec in top-level facet when facetField is set", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1,model\n1,0.61,a\n2,0.68,a\n1,0.64,b\n2,0.71,b\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      facetField: "model",
      specOutputPath,
    });

    expect(result.spec).toEqual({
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { url: "data.csv" },
      facet: { field: "model", type: "nominal" },
      spec: {
        mark: "line",
        width: 360,
        height: 240,
        encoding: {
          x: { field: "epoch", type: "quantitative" },
          y: { field: "f1", type: "quantitative" },
        },
      },
    });
  });

  test("supports facet with a distinct color field", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1,split,series\n1,0.61,a,x\n2,0.68,a,x\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      facetField: "split",
      colorField: "series",
      specOutputPath,
    });

    expect(result.spec).toMatchObject({
      facet: { field: "split", type: "nominal" },
      spec: {
        encoding: {
          color: { field: "series", type: "nominal" },
        },
      },
    });
  });

  test("rejects missing facet fields", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "epoch,f1\n1,0.61\n");

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "epoch",
        yField: "f1",
        facetField: "missing-facet",
        specOutputPath: join(workspace, "chart.vl.json"),
      }),
    ).rejects.toThrow('Field "missing-facet" was not found.');
  });

  test("builds a heatmap spec with rect mark and ordinal x/y plus quantitative color", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "predicted,actual,count\na,a,10\na,b,2\nb,a,1\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "heatmap",
      xField: "predicted",
      yField: "actual",
      colorField: "count",
      specOutputPath,
    });

    expect(result.spec).toMatchObject({
      mark: "rect",
      encoding: {
        x: { field: "predicted", type: "ordinal" },
        y: { field: "actual", type: "ordinal" },
        color: { field: "count", type: "quantitative" },
      },
    });
  });

  test("adds aggregate transform on flat line chart when aggregateMethod is mean", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(
      inputPath,
      "epoch,f1,model\n1,0.61,a\n1,0.62,a\n2,0.68,a\n",
    );

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      colorField: "model",
      aggregateMethod: "mean",
      specOutputPath,
    });

    expect(result.spec.transform).toEqual([
      {
        aggregate: [{ op: "mean", field: "f1", as: "f1" }],
        groupby: ["epoch", "model"],
      },
    ]);
  });

  test("groups only by x when aggregate is set without color", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1\n1,0.61\n1,0.62\n2,0.68\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      aggregateMethod: "sum",
      specOutputPath,
    });

    expect(result.spec.transform).toEqual([
      {
        aggregate: [{ op: "sum", field: "f1", as: "f1" }],
        groupby: ["epoch"],
      },
    ]);
  });

  test("uses row-count aggregate without field when aggregateMethod is count", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "epoch,f1\n1,0.61\n1,0.62\n2,0.68\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      aggregateMethod: "count",
      specOutputPath,
    });

    expect(result.spec.transform).toEqual([
      {
        aggregate: [{ op: "count", as: "f1" }],
        groupby: ["epoch"],
      },
    ]);
  });

  test("places aggregate transform on inner spec when facet is set", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(
      inputPath,
      "epoch,f1,split,model\n1,0.61,a,x\n1,0.62,a,x\n2,0.68,a,x\n",
    );

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "line",
      xField: "epoch",
      yField: "f1",
      facetField: "split",
      colorField: "model",
      aggregateMethod: "mean",
      specOutputPath,
    });

    expect(result.spec.transform).toBeUndefined();
    expect(result.spec.spec).toMatchObject({
      transform: [
        {
          aggregate: [{ op: "mean", field: "f1", as: "f1" }],
          groupby: ["epoch", "model"],
        },
      ],
    });
  });

  test("aggregates heatmap color with groupby x and y", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const specOutputPath = join(workspace, "chart.vl.json");

    await Bun.write(inputPath, "col,row,value\na,x,1\na,x,2\nb,y,3\n");

    const result = await inferVegaLiteSpec({
      inputPath,
      chart: "heatmap",
      xField: "col",
      yField: "row",
      colorField: "value",
      aggregateMethod: "sum",
      specOutputPath,
    });

    expect(result.spec.transform).toEqual([
      {
        aggregate: [{ op: "sum", field: "value", as: "value" }],
        groupby: ["col", "row"],
      },
    ]);
  });

  test("rejects heatmap without a color field in the request", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");

    await Bun.write(inputPath, "x,y,v\na,b,1\n");

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "heatmap",
        xField: "x",
        yField: "y",
        specOutputPath: join(workspace, "chart.vl.json"),
      }),
    ).rejects.toThrow(
      'The "--color" option is required when --chart heatmap is used.',
    );
  });
});

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-infer-"));
  temporaryDirectories.push(workspace);
  return workspace;
}
