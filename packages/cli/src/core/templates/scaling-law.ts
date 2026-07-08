import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { ScalingLawOptions, ScalingLawRequest } from "../template";
import { buildTemplateFrame } from "./shared";

export function buildScalingLawSpec(request: ScalingLawRequest): JsonObject {
  const { header } = request.table;
  const options = request.options;
  findFieldIndex(header, options.xField);
  findFieldIndex(header, options.yField);

  if (options.colorField !== undefined) {
    findFieldIndex(header, options.colorField);
  }

  const layer: JsonObject[] = [
    { mark: { type: "line", point: true }, encoding: buildEncoding(options) },
  ];

  if (options.fit === "regression") {
    const regression: JsonObject = {
      regression: options.yField,
      on: options.xField,
      method: options.xScale === "log" ? "log" : "linear",
    };

    if (options.colorField !== undefined) {
      regression.groupby = [options.colorField];
    }

    layer.push({
      transform: [regression],
      mark: { type: "line", strokeDash: [4, 3], opacity: 0.6 },
      encoding: buildEncoding(options),
    });
  }

  return buildTemplateFrame(request, layer);
}

function buildEncoding(options: ScalingLawOptions): JsonObject {
  const x: JsonObject = { field: options.xField, type: "quantitative" };

  if (options.xScale === "log") {
    x.scale = { type: "log" };
  }

  const encoding: JsonObject = {
    x,
    y: { field: options.yField, type: "quantitative", scale: { zero: false } },
  };

  if (options.colorField !== undefined) {
    encoding.color = { field: options.colorField, type: "nominal" };
  }

  return encoding;
}
