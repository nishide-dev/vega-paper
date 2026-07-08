import { VegaPaperError } from "../errors";
import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { BenchmarkHeatmapRequest } from "../template";
import { buildTemplateFrame, getCell, parseNumericCell } from "./shared";

export function buildBenchmarkHeatmapSpec(request: BenchmarkHeatmapRequest): JsonObject {
  const { header, rows } = request.table;
  const options = request.options;
  const xIndex = findFieldIndex(header, options.xField);
  const yIndex = findFieldIndex(header, options.yField);
  const scoreIndex = findFieldIndex(header, options.scoreField);
  const labelField = options.labelField ?? options.scoreField;
  findFieldIndex(header, labelField);

  const layer: JsonObject[] = [
    {
      mark: "rect",
      encoding: {
        x: axisEncoding(options.xField),
        y: axisEncoding(options.yField),
        color: { field: options.scoreField, type: "quantitative" },
      },
    },
    {
      mark: "text",
      encoding: {
        x: axisEncoding(options.xField),
        y: axisEncoding(options.yField),
        text: buildTextEncoding(labelField, options.scoreField),
      },
    },
  ];

  if (options.highlightBest === true) {
    layer.push({
      data: { values: computeBestCells(rows, xIndex, yIndex, scoreIndex, options) },
      mark: { type: "rect", fill: null, stroke: "#1a1a1a", strokeWidth: 2 },
      encoding: {
        x: axisEncoding(options.xField),
        y: axisEncoding(options.yField),
      },
    });
  }

  return buildTemplateFrame(request, layer);
}

export function computeBestCells(
  rows: string[][],
  xIndex: number,
  yIndex: number,
  scoreIndex: number,
  options: { xField: string; yField: string; scoreField: string },
): JsonObject[] {
  const bestByColumn = new Map<string, { y: string; score: number }>();
  const columnOrder: string[] = [];

  for (const row of rows) {
    const x = getCell(row, xIndex);
    const y = getCell(row, yIndex);
    const score = parseNumericCell(getCell(row, scoreIndex), options.scoreField);
    const best = bestByColumn.get(x);

    if (best === undefined) {
      columnOrder.push(x);
      bestByColumn.set(x, { y, score });
      continue;
    }

    if (score > best.score) {
      bestByColumn.set(x, { y, score });
    }
  }

  return columnOrder.map((x) => {
    const best = bestByColumn.get(x);

    if (best === undefined) {
      throw new VegaPaperError(`Could not determine the best score for column "${x}".`);
    }

    return { [options.xField]: x, [options.yField]: best.y };
  });
}

function axisEncoding(field: string): JsonObject {
  return { field, type: "ordinal" };
}

function buildTextEncoding(labelField: string, scoreField: string): JsonObject {
  if (labelField === scoreField) {
    return { field: labelField, type: "quantitative", format: ".1f" };
  }

  return { field: labelField, type: "nominal" };
}
