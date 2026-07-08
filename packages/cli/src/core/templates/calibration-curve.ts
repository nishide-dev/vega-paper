import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { CalibrationCurveRequest } from "../template";
import { buildTemplateFrame } from "./shared";

export function buildCalibrationCurveSpec(request: CalibrationCurveRequest): JsonObject {
  const { header } = request.table;
  const options = request.options;
  findFieldIndex(header, options.confidenceField);
  findFieldIndex(header, options.accuracyField);

  if (options.countField !== undefined) {
    findFieldIndex(header, options.countField);
  }

  const layer: JsonObject[] = [
    {
      mark: { type: "rule", color: "#888888", strokeDash: [4, 4] },
      encoding: { x: { datum: 0 }, y: { datum: 0 }, x2: { datum: 1 }, y2: { datum: 1 } },
    },
    {
      mark: { type: "line", point: options.countField === undefined },
      encoding: {
        x: buildBinEncoding(options.confidenceField),
        y: buildBinEncoding(options.accuracyField),
      },
    },
  ];

  if (options.countField !== undefined) {
    layer.push({
      mark: { type: "point", filled: true },
      encoding: {
        x: buildBinEncoding(options.confidenceField),
        y: buildBinEncoding(options.accuracyField),
        size: { field: options.countField, type: "quantitative" },
      },
    });
  }

  if (options.ece !== undefined) {
    layer.push({
      data: { values: [{}] },
      mark: { type: "text", align: "left", baseline: "top" },
      encoding: {
        x: { datum: 0.05 },
        y: { datum: 0.95 },
        text: { value: `ECE = ${options.ece}` },
      },
    });
  }

  return buildTemplateFrame(request, layer);
}

function buildBinEncoding(field: string): JsonObject {
  return { field, type: "quantitative", scale: { domain: [0, 1] } };
}
