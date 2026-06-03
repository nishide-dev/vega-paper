import { dirname, relative } from "node:path";
import { VegaPaperError } from "./errors";
import type { JsonObject } from "./spec";

export type InferChartType = "line" | "bar" | "scatter";

export type VegaLiteFieldType = "quantitative" | "nominal" | "ordinal" | "temporal";

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
};

export type InferResult = {
  spec: JsonObject;
};

export type ParsedCsv = {
  header: string[];
  rows: string[][];
};

type InferredFieldType = "quantitative" | "nominal";

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 240;
const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v6.json";

const MARK_BY_CHART: Record<InferChartType, "line" | "bar" | "point"> = {
  line: "line",
  bar: "bar",
  scatter: "point",
};

export async function inferVegaLiteSpec(
  request: InferRequest,
): Promise<InferResult> {
  const chart = parseChartType(request.chart);
  const csv = await readCsv(request.inputPath);
  const xIndex = findFieldIndex(csv.header, request.xField);
  const yIndex = findFieldIndex(csv.header, request.yField);
  const colorIndex =
    request.colorField === undefined
      ? undefined
      : findFieldIndex(csv.header, request.colorField);

  const encoding: {
    x: { field: string; type: VegaLiteFieldType };
    y: { field: string; type: VegaLiteFieldType };
    color?: { field: string; type: VegaLiteFieldType };
  } = {
    x: {
      field: request.xField,
      type: request.xType ?? inferFieldType(csv.rows, xIndex),
    },
    y: {
      field: request.yField,
      type: request.yType ?? inferFieldType(csv.rows, yIndex),
    },
  };

  if (request.colorField !== undefined && colorIndex !== undefined) {
    encoding.color = {
      field: request.colorField,
      type: request.colorType ?? "nominal",
    };
  }

  const spec: JsonObject = {
    $schema: VEGA_LITE_SCHEMA,
    data: {
      url: toRelativeDataUrl(request.specOutputPath, request.inputPath),
    },
    mark: MARK_BY_CHART[chart],
    width: request.width ?? DEFAULT_WIDTH,
    height: request.height ?? DEFAULT_HEIGHT,
    encoding,
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

function parseChartType(chart: string): InferChartType {
  if (chart === "line" || chart === "bar" || chart === "scatter") {
    return chart;
  }

  throw new VegaPaperError(
    `Unsupported chart type "${chart}". Expected one of: line, bar, scatter.`,
  );
}

function findFieldIndex(header: string[], field: string): number {
  const index = header.indexOf(field);

  if (index === -1) {
    throw new VegaPaperError(`CSV field "${field}" was not found.`);
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
