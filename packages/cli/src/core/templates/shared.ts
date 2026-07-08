import { VegaPaperError } from "../errors";
import { toRelativeDataUrl } from "../infer";
import type { JsonObject } from "../spec";
import type { TemplateCommonRequest } from "../template";

export const TEMPLATE_VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v6.json";
export const TEMPLATE_DEFAULT_WIDTH = 360;
export const TEMPLATE_DEFAULT_HEIGHT = 240;

export function getCell(row: string[], index: number): string {
  return row[index] ?? "";
}

export function parseNumericCell(value: string, field: string): number {
  const trimmedValue = value.trim();
  const numericValue = Number(trimmedValue);

  if (trimmedValue === "" || !Number.isFinite(numericValue)) {
    throw new VegaPaperError(`Field "${field}" contains a non-numeric value "${value}".`);
  }

  return numericValue;
}

export function buildTemplateFrame(
  request: TemplateCommonRequest,
  layer: JsonObject[],
): JsonObject {
  const spec: JsonObject = {
    $schema: TEMPLATE_VEGA_LITE_SCHEMA,
    data: { url: toRelativeDataUrl(request.specOutputPath, request.inputPath) },
    width: request.width ?? TEMPLATE_DEFAULT_WIDTH,
    height: request.height ?? TEMPLATE_DEFAULT_HEIGHT,
    layer,
  };

  if (request.title !== undefined) {
    spec.title = request.title;
  }

  return spec;
}
