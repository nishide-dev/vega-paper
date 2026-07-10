import { findFieldIndex } from "../infer";
import type { JsonObject } from "../spec";
import type { EcdfRequest } from "../template";
import { buildTemplateFrame } from "./shared";

export function buildEcdfSpec(request: EcdfRequest): JsonObject {
  const { header } = request.table;
  const options = request.options;
  findFieldIndex(header, options.xField);

  if (options.colorField !== undefined) {
    findFieldIndex(header, options.colorField);
  }

  const countField = uniqueDerivedFieldName("__ecdf_count", header);
  const totalField = uniqueDerivedFieldName("__ecdf_total", header);
  const proportionField = uniqueDerivedFieldName("__ecdf", header);
  const groupby = options.colorField === undefined ? undefined : [options.colorField];

  const runningCount: JsonObject = {
    window: [{ op: "count", as: countField }],
    sort: [{ field: options.xField, order: "ascending" }],
    frame: [null, 0],
  };
  const groupTotal: JsonObject = {
    joinaggregate: [{ op: "count", as: totalField }],
  };

  if (groupby !== undefined) {
    runningCount.groupby = groupby;
    groupTotal.groupby = groupby;
  }

  // Reorder so groupby (when present) sits before frame, purely for readability.
  const windowTransform: JsonObject =
    groupby === undefined
      ? runningCount
      : {
          window: runningCount.window,
          sort: runningCount.sort,
          groupby,
          frame: runningCount.frame,
        };

  const encoding: JsonObject = {
    x: buildMeasureEncoding(options),
    y: {
      field: proportionField,
      type: "quantitative",
      scale: { domain: [0, 1] },
      title: "Cumulative proportion",
    },
  };

  if (options.colorField !== undefined) {
    encoding.color = { field: options.colorField, type: "nominal" };
  }

  return buildTemplateFrame(request, [
    {
      transform: [
        windowTransform,
        groupTotal,
        {
          calculate: `datum['${countField}'] / datum['${totalField}']`,
          as: proportionField,
        },
      ],
      mark: { type: "line", interpolate: "step-after" },
      encoding,
    },
  ]);
}

// The window/joinaggregate/calculate transforms write helper columns; if the
// data already has a column of that name, prefix underscores until unique.
export function uniqueDerivedFieldName(base: string, header: string[]): string {
  const taken = new Set(header);
  let name = base;

  while (taken.has(name)) {
    name = `_${name}`;
  }

  return name;
}

function buildMeasureEncoding(options: EcdfRequest["options"]): JsonObject {
  const encoding: JsonObject = { field: options.xField, type: "quantitative" };

  // An ECDF is read by locating percentiles across the data's actual range, so
  // a zero baseline only wastes space; a log scale replaces it outright.
  encoding.scale = options.xScale === "log" ? { type: "log" } : { zero: false };

  return encoding;
}
