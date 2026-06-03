import { VegaPaperError } from "./errors";

export type JsonObject = Record<string, unknown>;
export type SpecType = "vega-lite" | "vega";

export async function loadJsonSpec(inputPath: string): Promise<JsonObject> {
  let contents: string;

  try {
    contents = await Bun.file(inputPath).text();
  } catch {
    throw new VegaPaperError(`Input file not found or unreadable: ${inputPath}`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new VegaPaperError(`Invalid JSON in input file: ${inputPath}`);
  }

  if (!isPlainObject(parsed)) {
    throw new VegaPaperError(`Input JSON must be an object: ${inputPath}`);
  }

  return parsed;
}

export function detectSpecType(spec: JsonObject): SpecType {
  const schema = typeof spec.$schema === "string" ? spec.$schema : "";

  if (schema.includes("vega-lite")) {
    return "vega-lite";
  }

  if (schema.includes("/vega/")) {
    return "vega";
  }

  if ("mark" in spec && "encoding" in spec) {
    return "vega-lite";
  }

  if ("marks" in spec && "scales" in spec) {
    return "vega";
  }

  throw new VegaPaperError(
    "Could not determine whether the input is Vega-Lite or Vega. Include a recognized $schema, or Vega-Lite mark/encoding, or Vega marks/scales.",
  );
}

export function applyThemeToSpec(spec: JsonObject, themeConfig: JsonObject): JsonObject {
  const specConfig = isPlainObject(spec.config) ? spec.config : {};
  const config = deepMerge(themeConfig, specConfig);

  return {
    ...structuredClone(spec),
    config,
  };
}

function deepMerge(defaults: JsonObject, overrides: JsonObject): JsonObject {
  const merged = structuredClone(defaults) as JsonObject;

  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      merged[key] = deepMerge(existing, value);
      continue;
    }

    merged[key] = structuredClone(value);
  }

  return merged;
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
