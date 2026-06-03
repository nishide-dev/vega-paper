import { dirname, extname, relative } from "node:path";
import { VegaPaperError } from "./errors";
import type { JsonObject } from "./spec";

export type InferChartType = "line" | "bar" | "scatter" | "area" | "heatmap" | "boxplot";

export type VegaLiteFieldType = "quantitative" | "nominal" | "ordinal" | "temporal";

export type InferAggregateMethod = "mean" | "median" | "sum" | "count" | "min" | "max";

export type InferRequest = {
  inputPath: string;
  chart: InferChartType;
  xField: string;
  yField: string;
  colorField?: string | undefined;
  title?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  specOutputPath: string;
  xType?: VegaLiteFieldType | undefined;
  yType?: VegaLiteFieldType | undefined;
  colorType?: VegaLiteFieldType | undefined;
  inlineData?: boolean | undefined;
  facetField?: string | undefined;
  aggregateMethod?: InferAggregateMethod | undefined;
  errorBandField?: string | undefined;
};

export type InferResult = {
  spec: JsonObject;
};

export type ParsedCsv = {
  header: string[];
  rows: string[][];
};

export type ParsedJsonArray = {
  header: string[];
  rows: string[][];
  values: JsonObject[];
};

type TabularInput = {
  header: string[];
  rows: string[][];
  jsonValues?: JsonObject[] | undefined;
};

type InputFormat = "csv" | "json";

type InferredFieldType = "quantitative" | "nominal";

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 240;
const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v6.json";

type InferMark = "line" | "bar" | "point" | "rect" | "boxplot" | { type: "area"; line: true };

type InferEncodingChannel = {
  field: string;
  type: VegaLiteFieldType;
  scale?: { zero: boolean };
};

const MARK_BY_CHART: Record<InferChartType, InferMark> = {
  line: "line",
  bar: "bar",
  scatter: "point",
  area: { type: "area", line: true },
  heatmap: "rect",
  boxplot: "boxplot",
};

export async function inferVegaLiteSpec(request: InferRequest): Promise<InferResult> {
  const chart = parseChartType(request.chart);
  const tabular = await loadTabularInput(request.inputPath);
  const xIndex = findFieldIndex(tabular.header, request.xField);
  const yIndex = findFieldIndex(tabular.header, request.yField);
  const colorIndex =
    request.colorField === undefined
      ? undefined
      : findFieldIndex(tabular.header, request.colorField);
  if (request.facetField !== undefined) {
    findFieldIndex(tabular.header, request.facetField);
  }
  if (request.errorBandField !== undefined) {
    assertErrorBandSupported(chart, request);
    findFieldIndex(tabular.header, request.errorBandField);
  }

  let encoding: {
    x: InferEncodingChannel;
    y: InferEncodingChannel;
    color?: InferEncodingChannel;
    yError?: InferEncodingChannel;
  };

  if (chart === "boxplot" && request.aggregateMethod !== undefined) {
    throw new VegaPaperError('The "--aggregate" option cannot be used with --chart boxplot.');
  }

  if (chart === "heatmap") {
    if (request.colorField === undefined) {
      throw new VegaPaperError('The "--color" option is required when --chart heatmap is used.');
    }

    findFieldIndex(tabular.header, request.colorField);

    encoding = {
      x: {
        field: request.xField,
        type: request.xType ?? "ordinal",
      },
      y: {
        field: request.yField,
        type: request.yType ?? "ordinal",
      },
      color: {
        field: request.colorField,
        type: request.colorType ?? "quantitative",
      },
    };
  } else if (chart === "boxplot") {
    encoding = {
      x: {
        field: request.xField,
        type: request.xType ?? "nominal",
      },
      y: {
        field: request.yField,
        type: request.yType ?? "quantitative",
        scale: { zero: false },
      },
    };

    if (request.colorField !== undefined && colorIndex !== undefined) {
      encoding.color = {
        field: request.colorField,
        type: request.colorType ?? "nominal",
      };
    }
  } else {
    encoding = {
      x: {
        field: request.xField,
        type: request.xType ?? inferFieldType(tabular.rows, xIndex),
      },
      y: {
        field: request.yField,
        type: request.yType ?? inferFieldType(tabular.rows, yIndex),
      },
    };

    if (request.colorField !== undefined && colorIndex !== undefined) {
      encoding.color = {
        field: request.colorField,
        type: request.colorType ?? "nominal",
      };
    }

    if (request.errorBandField !== undefined) {
      encoding.yError = {
        field: request.errorBandField,
        type: "quantitative",
      };
    }
  }

  const data: JsonObject = request.inlineData
    ? { values: buildInlineValues(tabular) }
    : { url: toRelativeDataUrl(request.specOutputPath, request.inputPath) };

  const innerSpec: JsonObject = {
    mark: MARK_BY_CHART[chart],
    width: request.width ?? DEFAULT_WIDTH,
    height: request.height ?? DEFAULT_HEIGHT,
    encoding,
  };

  if (request.aggregateMethod !== undefined) {
    innerSpec.transform = [buildAggregateTransform(chart, request)];
  }

  const spec: JsonObject =
    request.facetField === undefined
      ? {
          $schema: VEGA_LITE_SCHEMA,
          data,
          ...innerSpec,
        }
      : {
          $schema: VEGA_LITE_SCHEMA,
          data,
          facet: {
            field: request.facetField,
            type: "nominal",
          },
          spec: innerSpec,
        };

  if (request.title !== undefined) {
    spec.title = request.title;
  }

  return { spec };
}

export function parseCsv(contents: string): ParsedCsv {
  const rows = parseCsvRows(contents);

  if (rows.length === 0) {
    throw new VegaPaperError("CSV is empty.");
  }

  const [rawHeader, ...dataRows] = rows;

  if (rawHeader === undefined || rawHeader.length === 0) {
    throw new VegaPaperError("CSV must contain a header row.");
  }

  const header = rawHeader.map((field) => field.trim());

  if (header.some((field) => field.length === 0)) {
    throw new VegaPaperError("CSV header fields must not be empty.");
  }

  return {
    header,
    rows: dataRows,
  };
}

export function parseJsonArray(contents: string): ParsedJsonArray {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new VegaPaperError("Invalid JSON in input file.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new VegaPaperError("JSON input must be a non-empty array of objects.");
  }

  const header: string[] = [];
  const seenKeys = new Set<string>();

  for (const item of parsed) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new VegaPaperError("JSON input must contain only objects.");
    }

    for (const key of Object.keys(item as JsonObject)) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        header.push(key);
      }
    }
  }

  const values = parsed as JsonObject[];
  const rows = values.map((item) => header.map((key) => normalizeJsonCell(item[key], key)));

  return { header, rows, values };
}

function getInputFormat(inputPath: string): InputFormat {
  const extension = extname(inputPath).toLowerCase();

  if (extension === ".csv") {
    return "csv";
  }

  if (extension === ".json") {
    return "json";
  }

  throw new VegaPaperError(
    `Unsupported input format "${extension}". Expected a .csv or .json file.`,
  );
}

async function loadTabularInput(inputPath: string): Promise<TabularInput> {
  const format = getInputFormat(inputPath);

  if (format === "csv") {
    const csv = await readCsv(inputPath);
    return { header: csv.header, rows: csv.rows };
  }

  const json = await readJsonArray(inputPath);
  return {
    header: json.header,
    rows: json.rows,
    jsonValues: json.values,
  };
}

async function readCsv(inputPath: string): Promise<ParsedCsv> {
  const file = Bun.file(inputPath);

  if (!(await file.exists())) {
    throw new VegaPaperError(`CSV file not found or unreadable: ${inputPath}`);
  }

  try {
    return parseCsv(await file.text());
  } catch (error) {
    if (error instanceof VegaPaperError) {
      throw error;
    }

    throw new VegaPaperError(`CSV file not found or unreadable: ${inputPath}`);
  }
}

async function readJsonArray(inputPath: string): Promise<ParsedJsonArray> {
  const file = Bun.file(inputPath);

  if (!(await file.exists())) {
    throw new VegaPaperError(`JSON file not found or unreadable: ${inputPath}`);
  }

  try {
    return parseJsonArray(await file.text());
  } catch (error) {
    if (error instanceof VegaPaperError) {
      if (error.message === "Invalid JSON in input file.") {
        throw new VegaPaperError(`Invalid JSON in input file: ${inputPath}`);
      }

      if (
        error.message === "JSON input must be a non-empty array of objects." ||
        error.message === "JSON input must contain only objects."
      ) {
        throw new VegaPaperError(`${error.message.replace(/\.$/, "")}: ${inputPath}`);
      }

      throw error;
    }

    throw new VegaPaperError(`JSON file not found or unreadable: ${inputPath}`);
  }
}

function buildInlineValues(tabular: TabularInput): JsonObject[] {
  if (tabular.jsonValues !== undefined) {
    return tabular.jsonValues;
  }

  return tabular.rows.map((row) => {
    const record: JsonObject = {};

    for (let index = 0; index < tabular.header.length; index += 1) {
      const key = tabular.header[index];

      if (key === undefined) {
        continue;
      }

      record[key] = row[index] ?? "";
    }

    return record;
  });
}

function normalizeJsonCell(value: unknown, key: string): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    throw new VegaPaperError(`JSON field "${key}" contains a nested value.`);
  }

  return String(value);
}

function assertErrorBandSupported(chart: InferChartType, request: InferRequest): void {
  if (request.aggregateMethod !== undefined) {
    throw new VegaPaperError('The "--error-band" option cannot be used with --aggregate.');
  }

  if (chart === "heatmap") {
    throw new VegaPaperError('The "--error-band" option cannot be used with --chart heatmap.');
  }

  if (chart === "boxplot") {
    throw new VegaPaperError('The "--error-band" option cannot be used with --chart boxplot.');
  }
}

function buildAggregateTransform(chart: InferChartType, request: InferRequest): JsonObject {
  const method = request.aggregateMethod;

  if (method === undefined) {
    throw new VegaPaperError("Aggregate method is required to build transform.");
  }

  if (chart === "boxplot") {
    throw new VegaPaperError('The "--aggregate" option cannot be used with --chart boxplot.');
  }

  const isHeatmap = chart === "heatmap";
  if (isHeatmap && request.colorField === undefined) {
    throw new VegaPaperError('The "--color" option is required when --chart heatmap is used.');
  }

  const measureField = isHeatmap ? request.colorField : request.yField;
  const groupby = isHeatmap
    ? [request.xField, request.yField]
    : [request.xField, ...(request.colorField !== undefined ? [request.colorField] : [])];

  const aggregateEntry: JsonObject =
    method === "count"
      ? { op: "count", as: measureField }
      : { op: method, field: measureField, as: measureField };

  return {
    aggregate: [aggregateEntry],
    groupby,
  };
}

function parseChartType(chart: string): InferChartType {
  if (
    chart === "line" ||
    chart === "bar" ||
    chart === "scatter" ||
    chart === "area" ||
    chart === "heatmap" ||
    chart === "boxplot"
  ) {
    return chart;
  }

  throw new VegaPaperError(
    `Unsupported chart type "${chart}". Expected one of: line, bar, scatter, area, heatmap, boxplot.`,
  );
}

function findFieldIndex(header: string[], field: string): number {
  const index = header.indexOf(field);

  if (index === -1) {
    throw new VegaPaperError(`Field "${field}" was not found.`);
  }

  return index;
}

function inferFieldType(rows: string[][], index: number): InferredFieldType {
  let sawNonEmptyValue = false;

  const isQuantitative = rows.every((row) => {
    const trimmedValue = getCell(row, index).trim();

    if (trimmedValue === "") {
      return true;
    }

    sawNonEmptyValue = true;
    return Number.isFinite(Number(trimmedValue));
  });

  if (!sawNonEmptyValue) {
    return "nominal";
  }

  return isQuantitative ? "quantitative" : "nominal";
}

function getCell(row: string[], index: number): string {
  return row[index] ?? "";
}

function toRelativeDataUrl(specOutputPath: string, inputPath: string): string {
  return relative(dirname(specOutputPath), inputPath).replaceAll("\\", "/");
}

function parseCsvRows(contents: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let rowHasContent = false;

  const pushField = (): void => {
    currentRow.push(currentField);
    currentField = "";
  };

  const pushRow = (): void => {
    pushField();

    if (rowHasContent || currentRow.length > 1 || currentRow[0] !== "") {
      rows.push(currentRow);
    }

    currentRow = [];
    rowHasContent = false;
  };

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];

    if (character === undefined) {
      continue;
    }

    if (inQuotes) {
      if (character === '"') {
        const nextCharacter = contents[index + 1];

        if (nextCharacter === '"') {
          currentField += '"';
          index += 1;
          rowHasContent = true;
          continue;
        }

        inQuotes = false;
        rowHasContent = true;
        continue;
      }

      currentField += character;
      rowHasContent = true;
      continue;
    }

    if (character === '"') {
      if (currentField === "") {
        inQuotes = true;
      } else {
        currentField += character;
      }

      rowHasContent = true;
      continue;
    }

    if (character === ",") {
      pushField();
      rowHasContent = true;
      continue;
    }

    if (character === "\n") {
      pushRow();
      continue;
    }

    if (character === "\r") {
      if (contents[index + 1] === "\n") {
        index += 1;
      }

      pushRow();
      continue;
    }

    currentField += character;
    rowHasContent = true;
  }

  if (inQuotes) {
    throw new VegaPaperError("CSV contains an unterminated quoted field.");
  }

  if (rowHasContent || currentField !== "" || currentRow.length > 0) {
    pushRow();
  }

  return rows;
}
