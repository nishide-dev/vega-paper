import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { ParetoFrontierRequest } from "../template";
import { buildTemplateFrame, getCell, parseNumericCell } from "./shared";

export function buildParetoFrontierSpec(request: ParetoFrontierRequest): JsonObject {
  const { header, rows } = request.table;
  const options = request.options;
  const xIndex = findFieldIndex(header, options.xField);
  const yIndex = findFieldIndex(header, options.yField);

  if (options.labelField !== undefined) {
    findFieldIndex(header, options.labelField);
  }

  if (options.colorField !== undefined) {
    findFieldIndex(header, options.colorField);
  }

  if (options.sizeField !== undefined) {
    findFieldIndex(header, options.sizeField);
  }

  const layer: JsonObject[] = [];

  if (options.frontier === "max-y-min-x") {
    layer.push({
      data: {
        values: computeMaxYMinXFrontier(rows, xIndex, yIndex, {
          xField: options.xField,
          yField: options.yField,
        }),
      },
      mark: { type: "line", color: "#888888", strokeDash: [4, 3] },
      encoding: { x: buildXEncoding(options), y: buildYEncoding(options) },
    });
  }

  const pointEncoding: JsonObject = { x: buildXEncoding(options), y: buildYEncoding(options) };

  if (options.colorField !== undefined) {
    pointEncoding.color = { field: options.colorField, type: "nominal" };
  }

  if (options.sizeField !== undefined) {
    pointEncoding.size = { field: options.sizeField, type: "quantitative" };
  }

  layer.push({ mark: { type: "point", filled: true }, encoding: pointEncoding });

  if (options.labelField !== undefined) {
    layer.push({
      mark: { type: "text", align: "left", dx: 6, dy: -6 },
      encoding: {
        x: buildXEncoding(options),
        y: buildYEncoding(options),
        text: { field: options.labelField, type: "nominal" },
      },
    });
  }

  return buildTemplateFrame(request, layer);
}

export function computeMaxYMinXFrontier(
  rows: string[][],
  xIndex: number,
  yIndex: number,
  options: { xField: string; yField: string },
): JsonObject[] {
  const points = rows.map((row) => ({
    x: parseNumericCell(getCell(row, xIndex), options.xField),
    y: parseNumericCell(getCell(row, yIndex), options.yField),
  }));

  points.sort((a, b) => (a.x === b.x ? b.y - a.y : a.x - b.x));

  const frontier: JsonObject[] = [];
  let bestY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (point.y > bestY) {
      bestY = point.y;
      frontier.push({ [options.xField]: point.x, [options.yField]: point.y });
    }
  }

  return frontier;
}

function buildXEncoding(options: {
  xField: string;
  xScale?: "linear" | "log" | undefined;
}): JsonObject {
  const encoding: JsonObject = { field: options.xField, type: "quantitative" };

  if (options.xScale === "log") {
    encoding.scale = { type: "log" };
  }

  return encoding;
}

function buildYEncoding(options: { yField: string }): JsonObject {
  return { field: options.yField, type: "quantitative", scale: { zero: false } };
}
