import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inferVegaLiteSpec,
  parseCsv,
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

  test("rejects empty CSV input", () => {
    expect(() => parseCsv("\n\n")).toThrow(VegaPaperError);
  });

  test("rejects empty header names", () => {
    expect(() => parseCsv("name, ,value\nAlice,1,2\n")).toThrow(
      VegaPaperError,
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
    ).rejects.toThrow('CSV field "missing-x" was not found.');

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "year",
        yField: "missing-y",
        specOutputPath: join(workspace, "chart-b.vl.json"),
      }),
    ).rejects.toThrow('CSV field "missing-y" was not found.');

    await expect(
      inferVegaLiteSpec({
        inputPath,
        chart: "line",
        xField: "year",
        yField: "value",
        colorField: "missing-color",
        specOutputPath: join(workspace, "chart-c.vl.json"),
      }),
    ).rejects.toThrow('CSV field "missing-color" was not found.');
  });

  test("rejects unsupported chart types", async () => {
    const workspace = await createWorkspace();
    const inputPath = join(workspace, "data.csv");
    const invalidChart = "area" as unknown as InferRequest["chart"];

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
      'Unsupported chart type "area". Expected one of: line, bar, scatter.',
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
});

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), "vega-paper-infer-"));
  temporaryDirectories.push(workspace);
  return workspace;
}
